import bcrypt from "bcrypt";
import crypto from "crypto";
import { User } from "../models/User.js";
import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Terlalu banyak percobaan login, silakan coba lagi nanti.",
  },
});

export const showLogin = (req, res) => {
  res.render("auth/login", {layout: false});
};

export const showRegister = (req, res) => {
  // Ambil data user dari session, atau default null jika belum login
  const user = req.session.user || null;

  // Kirim data user ke dalam file EJS auth/register
  res.render("auth/register", { 
    user: user,   path: req.path, 
  });
};
export const register = async (req, res) => {
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await User.create({
    username,
    password: hash,
    apiKey: crypto.randomBytes(32).toString("hex"),
  });

  res.redirect("/login");
};

// 2. FUNGSI LOGIN YANG AMAN
export const login = async (req, res) => {
  try {
    // Sanitasi dasar: Pastikan input berupa string murni, bukan objek/array
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.redirect("/login");
    }

    const user = await User.findOne({ username }).select("+password");

    // 🎯 FIX TIMING ATTACK & ENUMERATION:
    // Jika user tidak ditemukan, buat "fake hash" agar proses bcrypt.compare tetap berjalan
    // dengan durasi waktu yang sama persis, sehingga hacker tidak bisa menebak lewat waktu respons.
    const fakeHash =
      "$2b$10$Nx7YvN0bXN9YvN0bXN9YvOa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p";
    const dbPassword = user ? user.password : fakeHash;

    const match = await bcrypt.compare(password, dbPassword);

    // Keduanya (user salah ATAU password salah) akan dialihkan ke tempat yang sama
    // dan menghabiskan waktu pemrosesan server yang sama.
    if (!user || !match) {
      return res.redirect("/login");
    }

    // ✅ REGENERATE SESSION ID (Mencegah Session Fixation Attack)
    // Menghancurkan session lama dan membuat session baru setelah sukses login
    req.session.regenerate((err) => {
      if (err) return res.redirect("/login");

      req.session.user = {
        _id: user._id.toString(),
        username: user.username,
        role: user.role,
      };

      res.redirect("/dashboard");
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.redirect("/login");
  }
};

export const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
};
