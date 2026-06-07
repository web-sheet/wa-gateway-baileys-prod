import express from "express";
import { authRequired } from "../middlewares/auth.middleware.js";
import { userDashboard } from "../controllers/user.controller.js";
import { initWA, disconnectWA, getClient, getGroupList } from "../wa/initWA.js"; // 👈 Import fungsi barunya di sini
import { User } from "../models/User.js";
import upload from "../middlewares/upload.middleware.js";

import {
  showBroadcastPage,
  sendBroadcast,
} from "../controllers/broadcast.controller.js";

// Import controller scheduled yang baru kita pisah
import {
  showScheduledPage,
  createScheduledMessage,
  deleteScheduledMessage, // ⚡ Baru
} from "../controllers/scheduledController.js";

// 🎯 IMPORT BARU: Controller Jadwal Status WA
import {
  showStatusSchedulePage,
  createStatusSchedule,
  deleteStatusSchedule,
} from "../controllers/statusScheduleController.js";

const router = express.Router();

router.get("/dashboard", authRequired, userDashboard);

router.get("/dashboard/broadcast", authRequired, showBroadcastPage);

router.post("/wa/connect", authRequired, async (req, res) => {
  const userId = req.session.user._id;

  await initWA(req.session.user._id);

  res.json({
    success: true,
    message: "Inisialisasi WhatsApp dimulai",
  });
});

router.post("/wa/disconnect", authRequired, async (req, res) => {
  try {
    const userId = req.session.user._id;

    // Panggil fungsi pembasmi sesi yang ada di initWA.js
    await disconnectWA(userId);

    res.json({
      success: true,
      message: "Koneksi WhatsApp berhasil diputuskan",
    });
  } catch (error) {
    console.error("Error pada router disconnect:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal server saat memutuskan koneksi",
    });
  }
});

router.post("/wa/send", async (req, res) => {
  try {
    const userId = req.session.user._id;

    const { number, message } = req.body;

    const sock = getClient(userId);

    if (!sock) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp belum connect",
      });
    }

    const jid = number + "@s.whatsapp.net";

    await sock.sendMessage(jid, {
      text: message,
    });

    res.json({
      success: true,
      message: "Pesan terkirim",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.get("/profile", async (req, res) => {
  const user = await User.findById(req.session.user._id).select(
    "username apiKey waNumber waStatus",
  );

  res.render("profile", {
    user,
    path: req.path,
  });
});

router.get("/wa/:userId/groups", async (req, res) => {
  try {
    const { userId } = req.params;

    const groups = await getGroupList(userId);

    res.json({
      success: true,
      data: groups,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post("/webhook/save", async (req, res) => {
  try {
    const userId = req.session.user._id;

    // 🟢 Ambil kedua data webhook dari request body (termasuk webhook bot baru)
    const { webhookUrl, webhookBotUrl } = req.body;

    // 💾 Perbarui kedua data tersebut secara bersamaan di database Mongoose
    await User.findByIdAndUpdate(userId, {
      webhookUrl,
      webhookBotUrl, // Tambahkan ini
    });

    return res.json({
      success: true,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get("/profile", authRequired, (req, res) => {
  // Ambil data user dari session yang sedang login untuk dioper ke EJS
  res.render("profile", { user: req.session.user });
});

router.post(
  "/dashboard/broadcast",
  authRequired,
  upload.single("file"),
  sendBroadcast,
);

// Jalur Fitur Pesan Terjadwal Baru (Terpisah Total)
router.get("/dashboard/scheduled", authRequired, showScheduledPage);
router.post("/dashboard/scheduled/send", authRequired, createScheduledMessage);
router.delete(
  "/dashboard/scheduled/delete/:id",
  authRequired,
  deleteScheduledMessage,
);

// 🎯 JALUR JADWAL STATUS WHATSAPP BARU (Terpisah Total)
router.get("/dashboard/scheduled-status", authRequired, showStatusSchedulePage);
router.post(
  "/dashboard/scheduled-status/send",
  authRequired,
  upload.single("statusImage"), // 👈 Menggunakan middleware upload bawaan untuk menangani file gambar status
  createStatusSchedule,
);
router.delete("/dashboard/scheduled-status/delete/:id", deleteStatusSchedule);

export default router;
