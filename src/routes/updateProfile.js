import bcrypt from 'bcrypt';
import { User } from "../models/User.js";

export const updateProfile = async (req, res) => {
  const { username, currentPassword, newPassword,  } = req.body;
  const loggedInUserId = req.session.user?._id; // Mengambil ID user dari session aktif

  if (!loggedInUserId) {
    return res.status(401).json({ success: false, message: "Sesi Anda telah habis, silakan login ulang." });
  }

  try {
    // 1. Ambil user dari database (Wajib sertakan password untuk pengecekan bcrypt)
    const user = await User.findById(loggedInUserId).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }

    // 2. Validasi apakah password lama yang dimasukkan benar
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Password lama salah!" });
    }

    // 3. Update Username
    user.username = username;

    // 4. Update Password Baru jika form diisi
    if (newPassword && newPassword.trim() !== "") {
      user.password = await bcrypt.hash(newPassword, 10);
    }

    // 5. Simpan ke MongoDB Atlas
    await user.save();

    // 6. Sinkronkan ulang data di session web agar data terbaru langsung aktif
    req.session.user.username = user.username;

    return res.json({ success: true, message: "Profil berhasil diperbarui!" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui profil di server." });
  }
};