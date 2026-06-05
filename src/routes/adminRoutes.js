import express from "express";
import { MessageLog } from "../models/MessageLog.js";
import { authRequired } from "../middlewares/auth.js"; // Pastikan sudah login

const router = express.Router();

// Jalur untuk merender halaman dashboard admin via EJS
router.get("/admin/dashboard", authRequired, async (req, res) => {
  try {
    // 🔒 Opsional: Tambahkan proteksi jika di session kamu ada status role user
    // if (req.session.user.role !== 'admin') return res.status(403).send("Akses Ditolak");

    // Tarik semua log pesan, lalu join (populate) dengan data User untuk ambil nama/email pengirim
    const allLogs = await MessageLog.find({})
      .populate("userId", "name email") // Mengambil field 'name' dan 'email' dari koleksi User
      .sort({ createdAt: -1 })
      .limit(200); // Batasi 200 data terakhir agar tidak berat

    // Render file 'admin-dashboard.ejs' dan kirimkan data logs ke dalamnya
    res.render("admin-dashboard", { logs: allLogs, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Terjadi kesalahan sistem: " + err.message);
  }
});

export default router;