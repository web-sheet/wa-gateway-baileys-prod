// controllers/scheduledController.js
import Scheduled from "../models/Scheduled.js"; // 🎯 Model Scheduled
import { MessageLog } from "../models/MessageLog.js";
import { addMessageToQueue } from "../wa/queueService.js";
import cron from "node-cron";

// Objek global untuk menyimpan referensi Cron Task yang aktif agar bisa dimanipulasi/dihentikan di latar belakang
const activeCronTasks = {};

// Tampilkan halaman utama dan daftar antrean jadwal
export const showScheduledPage = async (req, res) => {
  try {
    const schedules = await Scheduled.find({
      userId: req.session.user._id,
    }).sort({ createdAt: -1 });

    res.render("user/scheduled", {
      user: req.session.user,
      schedules,
      path: req.path,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// Buat jadwal pengiriman baru (Create)
export const createScheduledMessage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const {
      title,
      message,
      numbers,
      delayMin,
      delayMax,
      scheduledAt,
      repeatType,
    } = req.body;

    const targets = numbers
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (targets.length === 0)
      return res.status(400).send("Nomor tujuan kosong");

    const targetDate = new Date(scheduledAt);

    // 🎯 1. Simpan ke koleksi model Scheduled
    const scheduleRecord = await Scheduled.create({
      userId,
      title,
      message,
      totalTarget: targets.length,
      status: "scheduled",
      scheduledAt: targetDate,
      repeatType: repeatType || "once",
    });

    const cronPattern = generateCronPattern(targetDate, repeatType);

    // 🚀 2. Daftarkan Cron Task dan simpan ke objek memori server
    registerCronJob(
      scheduleRecord._id.toString(),
      cronPattern,
      repeatType,
      async () => {
        await releaseToQueueSystem(
          userId,
          scheduleRecord._id,
          targets,
          message,
          delayMin,
          delayMax,
          repeatType,
        );
      },
    );

    res.redirect("/dashboard/scheduled");
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// 🗑️ FITUR HAPUS JADWAL (DELETE)
export const deleteScheduledMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await Scheduled.findOne({
      _id: id,
      userId: req.session.user._id,
    });

    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Jadwal tidak ditemukan." });
    }

    // 🔒 PROTEKSI: Tidak boleh menghapus jadwal yang statusnya sedang berjalan ('running')
    if (schedule.status === "running") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Tidak bisa menghapus jadwal yang sedang berjalan.",
        });
    }

    // 🛑 1. Matikan cron task aktif dari memori server agar tidak mengeksekusi di masa mendatang
    if (activeCronTasks[id]) {
      activeCronTasks[id].stop();
      delete activeCronTasks[id];
    }

    // 🗑️ 2. Hapus data dari database secara permanen
    await Scheduled.deleteOne({ _id: id });

    return res
      .status(200)
      .json({
        success: true,
        message: "Jadwal berhasil dihapus secara permanen.",
      });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================================
// 🛠️ HELPER FUNCTIONS
// ========================================================

// Fungsi Pembantu 1: Generator Pola Cron
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

// Fungsi Pembantu 2: Pendaftaran Cron Task ke Server Memori
const registerCronJob = (id, pattern, repeatType, executionCallback) => {
  const task = cron.schedule(pattern, async () => {
    try {
      await executionCallback();
    } catch (err) {
      console.error("Cron Execution Error:", err.message);
    } finally {
      if (repeatType === "once") {
        task.stop();
        if (activeCronTasks[id]) delete activeCronTasks[id];
      }
    }
  });

  // Amankan referensi task ke memori global
  activeCronTasks[id] = task;
};

// Fungsi Pembantu 3: Logika Pelepasan Pesan ke Sistem Antrean WA
const releaseToQueueSystem = async (
  userId,
  scheduleId,
  targets,
  message,
  delayMin,
  delayMax,
  repeatType,
) => {
  // 🔒 JIKA ONCE: Kunci statusnya ke 'running' agar tidak bisa dihapus saat sedang jalan
  if (repeatType === "once") {
    await Scheduled.findByIdAndUpdate(scheduleId, { status: "running" });
  }

  // Kirim data ke antrean
  for (const number of targets) {
    const formattedJid = `${number}@s.whatsapp.net`;
    const tempMessageId =
      "SCH_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

    await MessageLog.create({
      userId,
      to: formattedJid,
      messageType: "text",
      message: message,
      status: "pending",
      messageId: tempMessageId,
      broadcastId: scheduleId,
    });

    addMessageToQueue(userId, formattedJid, {
      type: "text",
      message: message,
      messageId: tempMessageId,
      delayMin: delayMin,
      delayMax: delayMax,
      broadcastId: scheduleId,
    });
  }
};