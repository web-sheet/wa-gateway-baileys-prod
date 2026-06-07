import { Contact } from "../models/Contact.js";
import { getClient } from "../wa/initWA.js";

export const syncContacts = async (req, res) => {
  const userId = req.session.user._id;

  try {
    // 1. Validasi apakah koneksi WA user sedang aktif di server
    const sock = getClient(userId);
    if (!sock) {
      return res.status(400).json({
        success: false,
        message:
          "WhatsApp belum terhubung! Silakan hubungkan kembali akun WhatsApp Anda di halaman gateway.",
      });
    }

    // 2. Ambil seluruh data kontak milik user dari MongoDB
    const contacts = await Contact.find({ userId: userId }).sort({ name: 1 });
    const totalSaved = contacts.length;

    // 3. Jika database masih kosong (proses handshake awal Baileys belum selesai)
    if (totalSaved === 0) {
      return res.status(200).json({
        success: false,
        total: 0,
        contacts: [],
        message:
          "Database kontak kamu masih kosong. WhatsApp sedang menjabat tangan (handshake) riwayat HP kamu. Silakan pancing dengan mengirim chat teks acak dari HP kamu ke nomor lain, lalu klik tombol ini lagi.",
      });
    }

    // 4. Sukses mengambil data terbaru, kirimkan kembali ke front-end untuk di-render ke tabel
    return res.status(200).json({
      success: true,
      total: totalSaved,
      contacts: contacts, // 🎯 Data ini yang akan dibaca oleh tabel Front-End kamu
      message: `Sukses memuat ${totalSaved} kontak terbaru dari database!`,
    });
  } catch (error) {
    console.error(
      "[CONTROLLER ERROR] Gagal sinkronisasi/refresh kontak:",
      error,
    );
    return res.status(500).json({
      success: false,
      message:
        "Terjadi kesalahan internal server saat mengambil data kontak: " +
        error.message,
    });
  }
};

// Fungsi untuk mengambil data kontak untuk ditampilkan di UI Datatable/Tabel
export const getContactsPage = async (req, res) => {
  const userId = req.session.user._id; // Sesuaikan dengan sistem session/auth kamu
  try {
    const contacts = await Contact.find({ userId: userId }).sort({ name: 1 });
    // Render ke halaman view ejs kamu nanti (misal: contacts.ejs)
    res.render("user/contacts", {
      user: req.session.user,
      contacts: contacts,
      title: "Daftar Kontak WA",
      path: req.path,
    });
  } catch (error) {
    res.status(500).send("Error memuat halaman kontak");
  }
};
