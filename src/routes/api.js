import express from "express";
import { User } from "../models/User.js";
import { getClient } from "../wa/initWA.js";
import { downloadFile } from "../helpers/fileDownloader.js";
import { addMessageToQueue, getQueueLength } from "../wa/queueService.js"; // 👈 Import layanan antrian baru
import { MessageLog } from "../models/MessageLog.js";
import { updateProfile } from "./updateProfile.js";

const router = express.Router();

 
router.post("/send", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res
        .status(401)
        .json({ success: false, message: "API Key required" });
    }

    const user = await User.findOne({ apiKey });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid API Key" });
    }

    const sock = getClient(user._id.toString());
    if (!sock) {
      return res
        .status(400)
        .json({ success: false, message: "WhatsApp belum connect" });
    }

    const { number, message } = req.body;

    if (!number) {
      return res
        .status(400)
        .json({ success: false, message: "Parameter 'number' wajib diisi" });
    }

    // 📦 NORMALISASI: Paksa input 'number' menjadi Array, baik dikirim teks biasa maupun array
    const targetNumbers = Array.isArray(number) ? number : [number];
    const targetsProcessed = [];

    // 🔄 PERULANGAN UTAMA: Memecah Nomor Tujuan
    for (const rawNumber of targetNumbers) {
      // 🔍 LOGIKA PENENTUAN JID (Pribadi vs Grup)
      let jid;
      if (rawNumber.includes("@g.us")) {
        jid = rawNumber;
      } else if (rawNumber.endsWith("-") || rawNumber.length > 15) {
        jid = `${rawNumber}@g.us`;
      } else {
        const cleanNumber = rawNumber.replace(/\D/g, "");
        jid = `${cleanNumber}@s.whatsapp.net`;
      }

      // 🟢 LANGKAH 1: Buat ID unik sementara untuk tracking antrian RAM
      const internalMsgId =
        "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

      // 🟢 LANGKAH 2: Simpan draf log teks ke MongoDB dengan status 'pending'
      await MessageLog.create({
        userId: user._id,
        to: jid,
        messageType: "text",
        message: message, // Isi teks pesan utama
        status: "pending",
        messageId: internalMsgId, // Simpan ID sementara untuk pelacakan worker nanti
      });

      // 🟢 LANGKAH 3: Masukkan nomor ke antrian RAM (teruskan internalMsgId-nya)
      addMessageToQueue(user._id.toString(), jid, {
        type: "text",
        message: message,
        messageId: internalMsgId, // 👈 Teruskan ID ini ke antrian RAM
      });

      targetsProcessed.push(jid);
    }
    const sisaAntrian = getQueueLength(user._id.toString());

    // Langsung beri respon ke user setelah semua nomor sukses masuk antrian
    return res.json({
      success: true,
      message: `${targetsProcessed.length} pesan berhasil dimasukkan ke antrian.`,
      targets: targetsProcessed,
      queueRemaining: sisaAntrian,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
 
router.post("/send-image", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res
        .status(401)
        .json({ success: false, message: "API Key required" });
    }

    const user = await User.findOne({ apiKey });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid API Key" });
    }

    const sock = getClient(user._id.toString());
    if (!sock) {
      return res
        .status(400)
        .json({ success: false, message: "WhatsApp belum connect" });
    }

    // 📥 AMBIL DATA: Sekarang kita mengekstrak 'images' (bukan imageUrl dan caption tunggal lagi)
    const { number, images } = req.body;

    if (!number || !images) {
      return res.status(400).json({
        success: false,
        message: "Parameter 'number' dan 'images' wajib diisi",
      });
    }

    // 📦 NORMALISASI INPUT
    const targetNumbers = Array.isArray(number) ? number : [number];
    const imageList = Array.isArray(images) ? images : [images]; // Jaga-jaga jika konsumen mengirim objek tunggal

    let totalJobsAdded = 0;
    const targetsProcessed = [];

    // 🔄 PERULANGAN 1: Memecah Nomor Telepon
    for (const rawNumber of targetNumbers) {
      // 🟢 LANGKAH 1: TENTUKAN JID TERLEBIH DAHULU (Pribadi vs Grup)
      let jid;
      if (rawNumber.includes("@g.us")) {
        jid = rawNumber;
      } else if (rawNumber.endsWith("-") || rawNumber.length > 15) {
        jid = `${rawNumber}@g.us`;
      } else {
        const cleanNumber = rawNumber.replace(/\D/g, "");
        jid = `${cleanNumber}@s.whatsapp.net`;
      }

      // 🔄 PERULANGAN 2: Memecah Array Gambar untuk JID Terkait
      for (const imgData of imageList) {
        const imageUrl = imgData.url || imgData.imageUrl;
        const caption = imgData.caption || "";

        if (!imageUrl) continue; // Lewati jika data URL gambar kosong

        // 🟢 LANGKAH 2: Buat ID unik sementara untuk tracking antrian RAM
        const internalMsgId =
          "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

        // 🟢 LANGKAH 3: Simpan draf log ke MongoDB dengan status 'pending'
        await MessageLog.create({
          userId: user._id,
          to: jid,
          messageType: "image",
          message: caption,
          mediaUrl: imageUrl,
          status: "pending",
          messageId: internalMsgId, // Simpan ID sementara ini
        });

        // 🟢 LANGKAH 4: Masukkan ke sistem antrian RAM (teruskan internalMsgId-nya)
        addMessageToQueue(user._id.toString(), jid, {
          type: "image",
          imageUrl,
          caption,
          messageId: internalMsgId, // 👈 Sangat penting untuk proses update 'sent'/'failed' nanti
        });

        totalJobsAdded++;
      }

      // Catat nomor JID yang sukses diproses ke array response
      targetsProcessed.push(jid);
    }

    const sisaAntrian = getQueueLength(user._id.toString());

    return res.json({
      success: true,
      message: `${totalJobsAdded} tugas gambar berhasil didaftarkan ke dalam antrian untuk ${targetsProcessed.length} nomor tujuan.`,
      targets: targetsProcessed,
      queueRemaining: sisaAntrian,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/send-document", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res
        .status(401)
        .json({ success: false, message: "API Key required" });
    }

    const user = await User.findOne({ apiKey });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid API Key" });
    }

    const sock = getClient(user._id.toString());
    if (!sock) {
      return res
        .status(400)
        .json({ success: false, message: "WhatsApp belum connect" });
    }

    // 🟢 Ambil 'number' dan array 'documents' dari body
    const { number, documents } = req.body;

    if (
      !number ||
      !documents ||
      !Array.isArray(documents) ||
      documents.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Parameter 'number' dan array 'documents' wajib diisi dengan benar",
      });
    }

    // 📦 NORMALISASI NOMOR: Paksa input 'number' menjadi Array
    const targetNumbers = Array.isArray(number) ? number : [number];
    const targetsProcessed = [];
    let totalJobsAdded = 0;

    // 🔄 PERULANGAN UTAMA: Memecah Nomor Tujuan
    // 🔄 PERULANGAN UTAMA: Memecah Nomor Tujuan
    for (const rawNumber of targetNumbers) {
      // 🔍 LOGIKA PENENTUAN JID (Pribadi vs Grup)
      let jid;
      if (rawNumber.includes("@g.us")) {
        jid = rawNumber;
      } else if (rawNumber.endsWith("-") || rawNumber.length > 15) {
        jid = `${rawNumber}@g.us`;
      } else {
        const cleanNumber = rawNumber.replace(/\D/g, "");
        jid = `${cleanNumber}@s.whatsapp.net`;
      }

      // 🔄 PERULANGAN KEDUA: Memasukkan setiap dokumen ke dalam antrian nomor tersebut
      for (const doc of documents) {
        // Validasi internal objek dokumen memastikan url-nya ada
        if (!doc.url) continue;

        // 🟢 LANGKAH 1: Buat ID unik sementara untuk tracking antrian RAM
        const internalMsgId =
          "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

        // 🟢 LANGKAH 2: Simpan draf log dokumen ke MongoDB dengan status 'pending'
        await MessageLog.create({
          userId: user._id,
          to: jid,
          messageType: "document",
          message: doc.caption || "", // Caption dokumen disimpan di kolom message
          mediaUrl: doc.url, // URL file PDF/Excel/dll disimpan di mediaUrl
          fileName: doc.fileName || "Document", // Nama file dokumen
          status: "pending",
          messageId: internalMsgId, // Simpan ID sementara untuk pelacakan worker nanti
        });

        // 🟢 LANGKAH 3: Masukkan ke sistem antrian RAM (tergantung struktur worker kamu)
        addMessageToQueue(user._id.toString(), jid, {
          type: "document",
          documentUrl: doc.url,
          fileName: doc.fileName || "Document",
          caption: doc.caption || "",
          messageId: internalMsgId, // 👈 Teruskan ID ini ke antrian RAM
        });

        totalJobsAdded++;
      }

      targetsProcessed.push(jid);
    }

    const sisaAntrian = getQueueLength(user._id.toString());

    // Berikan respon sukses instan ke client API beserta total antrian baru
    return res.json({
      success: true,
      message: `${totalJobsAdded} tugas dokumen berhasil dimasukkan ke antrian untuk ${targetsProcessed.length} nomor tujuan.`,
      targets: targetsProcessed,
      queueRemaining: sisaAntrian,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/status", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "API Key required",
      });
    }

    const user = await User.findOne({ apiKey });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid API Key",
      });
    }

    const sock = getClient(user._id.toString());

    return res.json({
      success: true,
      connected: !!sock,
      waNumber: user.waNumber || null,
      waStatus: user.waStatus || "disconnected",
      username: user.username,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post('/update-profile', updateProfile);
// 1. RUTE GET: Untuk menampilkan/merender halaman profil


export default router;
