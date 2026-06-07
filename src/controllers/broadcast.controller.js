import Broadcast from "../models/Broadcast.js";
import { MessageLog } from "../models/MessageLog.js"; // Import MessageLog untuk menyimpan status antri awal
import { addMessageToQueue } from "../wa/queueService.js"; // Import fungsi antrean terpusat

export const showBroadcastPage = async (req, res) => {
  const broadcasts = await Broadcast.find({
    userId: req.session.user._id,
  }).sort({ createdAt: -1 });

  res.render("user/broadcast", {
    user: req.session.user,
    broadcasts,
    path: req.path,
  });
};

export const sendBroadcast = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const { title, message, numbers, delayMin, delayMax } = req.body;

    const targets = numbers
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (targets.length === 0) {
      return res.send("Nomor tujuan kosong");
    }

    // 1. Simpan dokumentasi rekap grup broadcast utama
    const broadcastRecord = await Broadcast.create({
      userId,
      title,
      message,
      totalTarget: targets.length,
      status: "running", // Dianggap running karena antrean langsung bergerak
    });

    // 2. Loop untuk mendaftarkan nomor tujuan ke dalam log database & sistem antrean (Queue)
    for (const number of targets) {
      const formattedJid = `${number}@s.whatsapp.net`;

      // Buat ID unik acak sementara untuk mengaitkan log database dengan antrean worker
      const tempMessageId =
        "BCAST_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

      // 🟢 SIMPAN STATUS 'QUEUE' (ANTRI) AWAL KE DATABASE LOG PESAN
      await MessageLog.create({
        userId,
        messageId: tempMessageId,
        to: number,
        message: message,
        status: "pending", // Mengindikasikan status sedang antri
        broadcastId: broadcastRecord._id, // Menyimpan relasi jika sewaktu-waktu dibutuhkan
      });

      // 🟢 MASUKKAN JOB KE SISTEM QUEUE SERVICE TERPUSAT
      addMessageToQueue(userId, formattedJid, {
        type: "text",
        message: message,
        messageId: tempMessageId, // Dilempar agar worker bisa mengupdate status log ini nanti
        delayMin: delayMin, // Mengirim parameter pengaturan jeda minimal dari form
        delayMax: delayMax,
        broadcastId: broadcastRecord._id, // Mengirim parameter pengaturan jeda maksimal dari form
      });
    }

    // Karena semua sudah dimasukkan ke antrean RAM, langsung redirect tanpa hambatan
    res.redirect("/dashboard/broadcast");
  } catch (err) {
    console.log(err);
    res.status(500).send(err.message);
  }
};
