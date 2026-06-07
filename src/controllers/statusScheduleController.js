import Scheduled from "../models/Scheduled.js";
import { MessageLog } from "../models/MessageLog.js";
import { addMessageToQueue } from "../wa/queueService.js";
import cron from "node-cron";

// 🚀 Penyimpanan memori global khusus untuk mencatat Cron Task Jadwal Status yang aktif
const activeStatusCronTasks = {};

// 1. Menampilkan Halaman Jadwal Status
export const showStatusSchedulePage = async (req, res) => {
  try {
    const schedules = await Scheduled.find({
      userId: req.session.user._id,
      sendType: "status", // 🎯 Kunci: Hanya mengambil yang tipenya status
    }).sort({ createdAt: -1 });

    res.render("user/scheduled-status", {
      user: req.session.user,
      schedules,
      path: req.path,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// 2. Memproses Pembuatan Jadwal Status Baru
export const createStatusSchedule = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { title, message, repeatType, scheduledAt } = req.body;

    // Ambil path file gambar jika user mengupload gambar
    let mediaUrl = null;
    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`; // Path relative untuk diakses publik/server
    }

    const targetDate = new Date(scheduledAt);

    // Simpan data jadwal status ke database
    const scheduleRecord = await Scheduled.create({
      userId,
      title,
      message, // Berfungsi sebagai teks status atau caption gambar
      sendType: "status",
      mediaUrl,
      totalTarget: 1, // Status dihitung sebagai 1 kali broadcast global
      status: "scheduled",
      repeatType: repeatType || "once",
      scheduledAt: targetDate,
    });

    // Kalkulasi Pola Cron
    const cronPattern = generateCronPattern(targetDate, repeatType);
    const scheduleIdStr = scheduleRecord._id.toString();

    // Jalankan Pendaftaran Cron & Simpan ke Memory Map
    const task = cron.schedule(cronPattern, async () => {
      try {
        await releaseStatusToSystem(
          userId,
          scheduleRecord._id,
          message,
          mediaUrl,
          repeatType,
        );
      } catch (cronErr) {
        console.error("[CRON STATUS ERR]:", cronErr.message);
      } finally {
        if (repeatType === "once") {
          task.stop();
          if (activeStatusCronTasks[scheduleIdStr]) {
            delete activeStatusCronTasks[scheduleIdStr];
          }
        }
      }
    });

    // Amankan referensi task agar bisa di-stop saat dihapus nanti
    activeStatusCronTasks[scheduleIdStr] = task;

    res.redirect("/dashboard/scheduled-status");
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// ========================================================
// 🗑️ FITUR BARU: HAPUS JADWAL STATUS (DELETE)
// ========================================================
export const deleteStatusSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await Scheduled.findOne({
      _id: id,
      userId: req.session.user._id,
      sendType: "status",
    });

    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Jadwal status tidak ditemukan." });
    }

    // 🔒 PROTEKSI: Tidak boleh menghapus jadwal status yang sedang berjalan ('running')
    if (schedule.status === "running") {
      return res.status(400).json({
        success: false,
        message: "Tidak bisa menghapus jadwal status yang sedang dikirim.",
      });
    }

    // 🛑 1. Hentikan pemicu cron job dari RAM server jika masih aktif
    if (activeStatusCronTasks[id]) {
      activeStatusCronTasks[id].stop();
      delete activeStatusCronTasks[id];
    }

    // 🗑️ 2. Hapus dokumen fisik dari database MongoDB
    await Scheduled.deleteOne({ _id: id });

    return res.status(200).json({
      success: true,
      message: "Jadwal status berhasil dihapus secara permanen.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================================
// 🛠️ HELPER FUNCTIONS
// ========================================================

// Helper 1: Generator Pola Cron
const generateCronPattern = (targetDate, repeatType) => {
  const minute = targetDate.getMinutes();
  const hour = targetDate.getHours();
  const dayOfMonth = targetDate.getDate();
  const month = targetDate.getMonth() + 1;
  const dayOfWeek = targetDate.getDay();

  if (repeatType === "daily") return `${minute} ${hour} * * *`;
  if (repeatType === "weekly") return `${minute} ${hour} * * ${dayOfWeek}`;
  return `${minute} ${hour} ${dayOfMonth} ${month} *`; // once
};

// Helper 2: Logika Pelepasan Pesan Status ke Antrean Pusat
const releaseStatusToSystem = async (
  userId,
  scheduleId,
  message,
  mediaUrl,
  repeatType,
) => {
  if (repeatType === "once") {
    await Scheduled.findByIdAndUpdate(scheduleId, { status: "running" });
  }

  const tempMessageId = "SCH_STATUS_" + Date.now();

  // Buat log transaksi di MessageLog
  await MessageLog.create({
    userId,
    to: "status@broadcast", // 🎯 JID khusus WhatsApp Status internal
    messageType: mediaUrl ? "image" : "text",
    message: message,
    status: "pending",
    messageId: tempMessageId,
    broadcastId: scheduleId,
  });

  // Lempar ke Antrean Pusat Utama biar dikirim dengan jeda aman
  addMessageToQueue(userId, "status@broadcast", {
    type: mediaUrl ? "image" : "text",
    message: message,
    mediaUrl: mediaUrl,
    messageId: tempMessageId,
    delayMin: 5,
    delayMax: 10,
    broadcastId: scheduleId,
  });
};
