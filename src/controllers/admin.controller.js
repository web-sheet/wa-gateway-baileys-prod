import { User } from "../models/User.js";
// 🟢 Sesuaikan path import di bawah ini dengan lokasi fungsi getClient/sessions kamu
import { getClient } from "../wa/initWA.js"; // 👈 Import fungsi barunya di sini

export const adminDashboard = async (req, res) => {
  try {
    const rawUsers = await User.find().select("-password").sort({ createdAt: -1 });

    const processedUsers = rawUsers.map((u) => {
      return {
        ...u.toObject(),
        // 🟢 Cek apakah waStatus di DB bernilai "connected"
        isOnline: u.waStatus === "connected", 
      };
    });

    res.render("admin/dashboard", {
      user: req.session.user,
      users: processedUsers,
    });
  } catch (error) {
    console.error("Error Admin Dashboard:", error);
    res.status(500).send("Terjadi kesalahan pada server.");
  }
};

export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
  } catch (error) {
    console.error("Error Delete User:", error);
    res.status(500).send("Gagal menghapus user.");
  }
};