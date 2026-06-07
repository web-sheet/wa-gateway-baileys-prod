import { User } from "../models/User.js";
// 🟢 1. Jangan lupa import model MessageLog di bagian atas
import { MessageLog } from "../models/MessageLog.js";

export const userDashboard = async (req, res) => {
  try {
    const userId = req.session.user._id;

    // Kode asli kamu untuk mengambil data user
    const user = await User.findById(userId);
    const totalLogs = await MessageLog.countDocuments({ userId });

    // 🟢 2. Tarik 10 data log pesan terbaru milik user ini dari MongoDB
    const recentLogs = await MessageLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10); // Batasi 10 data saja agar dashboard utama tetap ringan saat dimuat

    // 🟢 3. Oper data 'recentLogs' ke dalam EJS dengan nama variabel 'logs'
    res.render("user/dashboard", {
      user,
      logs: recentLogs,
      totalLogs: totalLogs, // 👈 Ini wajib ditambahkan
      path: req.path,
    });
  } catch (error) {
    console.error("🔴 Gagal memuat user dashboard:", error.message);
    res.status(500).send("Terjadi kesalahan sistem saat memuat dashboard.");
  }
};
