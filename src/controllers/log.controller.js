import { MessageLog } from "../models/MessageLog.js";

/**
 * Controller untuk menampilkan halaman riwayat pesan user
 */
export const renderUserLogsPage = async (req, res) => {
  try {
    // 1. Ambil userId dari session login aktif
    const userId = req.session.user._id;

    // 2. Tarik data log milik user tersebut dari MongoDB
    const userLogs = await MessageLog.find({ userId })
      .sort({ createdAt: -1 }) // Urutkan dari yang paling baru
      .limit(100); // Batasi 100 data agar load halaman tetap instan

    // 3. Render file EJS (misal namanya: user-logs.ejs)
    // dan kirim data logs serta data user session-nya
    return res.render("user-logs", {
      logs: userLogs,
      user: req.session.user,
    });
  } catch (error) {
    console.error("🔴 Error pada logController:", error.message);

    // Jika ada error, kembalikan response yang aman agar aplikasi tidak crash
    return res
      .status(500)
      .send("Terjadi kesalahan saat memuat riwayat pesan: " + error.message);
  }
};

// ... (Kodingan fungsi renderUserLogsPage kamu yang lama tetap biarkan di atas)

/**
 * 🟢 FUNGSI BARU: Khusus melayani request AJAX / Fetch dari tombol Refresh (Mengembalikan JSON)
 */
export const getUserLogsJson = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // 🟢 HITUNG TOTAL PESAN MILIK USER
    const totalLogs = await MessageLog.countDocuments({ userId });

    const userLogs = await MessageLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.json({
      success: true,
      data: userLogs,
      page: page,
      hasMore: userLogs.length === limit,
      total: totalLogs, // 👈 Kirim jumlah total ke frontend
    });
  } catch (error) {
    console.error("🔴 Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
