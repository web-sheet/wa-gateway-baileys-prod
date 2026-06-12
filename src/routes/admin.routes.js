import express from "express";
import { adminDashboard, deleteUser } from "../controllers/admin.controller.js";
import { authRequired, adminOnly } from "../middlewares/auth.middleware.js";
import { DeviceLog } from "../models/DeviceLog.js"; // Pastikan path model sesuai

const router = express.Router();

router.get("/admin", authRequired, adminOnly, adminDashboard);
router.get("/admin/delete/:id", authRequired, adminOnly, deleteUser);

// Router halaman log koneksi perangkat
router.get("/dashboard/device-logs", async (req, res) => {
  try {
    // Ambil data log, gabungkan dengan skema User (untuk mengambil field username)
    // Diurutkan berdasarkan waktu terbaru (createdAt: -1)
    const logs = await DeviceLog.find()
      .populate("userId", "username")
      .sort({ createdAt: -1 });

    const user = req.session.user || null;

    // Render file EJS halaman log baru kamu
    res.render("admin/device-logs", {
      logs: logs,
      user: user,
      path: req.path, // Jika kamu mempassing data user yang sedang login
    });
  } catch (error) {
    console.error("Gagal memuat log perangkat:", error);
    res.status(500).send("Internal Server Error");
  }
});

export default router;
