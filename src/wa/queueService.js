// wa/queueService.js

import { getClient } from "./initWA.js";
import { downloadFile } from "../helpers/fileDownloader.js"; // Pastikan helper download di-import
// 🟢 LANGKAH 1: Import model MessageLog untuk akses ke MongoDB
import { MessageLog } from "../models/MessageLog.js";
// 🎯 IMPORT BARU: Ambil model Broadcast untuk di-update rekapnya
import Broadcast from "../models/Broadcast.js";
const { User } = await import("../models/User.js"); // 🎯 Pastikan path ke model User milikmu benar
import fs from "fs";
// Biasanya diimport dari: import { generateWAMessageFromContent } from "@whiskeysockets/baileys";
const { generateWAMessageFromContent } =
  await import("@whiskeysockets/baileys");

const userQueues = {};
const processingStates = {};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 🎯 FUNGSI BARU: Menghasilkan angka acak antara min dan max (dalam Milidetik)
const getRandomDelay = (minSeconds, maxSeconds) => {
  const min = parseInt(minSeconds || 4) * 1000; // Default min 4 detik jika kosong
  const max = parseInt(maxSeconds || 8) * 1000; // Default max 4 detik jika kosong
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

import Scheduled from "../models/Scheduled.js";

// Fungsi update otomatis yang sekarang mendukung dua model terpisah
async function updateSummaryRekap(broadcastId, messageId) {
  if (!broadcastId || !messageId) return;

  try {
    const isScheduledJob = messageId.startsWith("SCH_");
    const ModelTarget = isScheduledJob ? Scheduled : Broadcast;

    // 🔍 1. Hitung status terkini dari MessageLog
    const pendingCount = await MessageLog.countDocuments({
      broadcastId,
      status: "pending",
    });
    const successCount = await MessageLog.countDocuments({
      broadcastId,
      status: "sent",
    });
    const failedCount = await MessageLog.countDocuments({
      broadcastId,
      status: "failed",
    });

    // Tentukan status (Jika tipe 'once' dan antrean habis, set completed. Jika berulang daily/weekly, biarkan scheduled)
    let currentStatus = pendingCount === 0 ? "completed" : "running";

    if (isScheduledJob) {
      const schData = await Scheduled.findById(broadcastId);
      // Jika tipenya berulang (daily/weekly), statusnya dikembalikan ke 'scheduled' agar siap untuk siklus berikutnya
      if (schData && schData.repeatType !== "once" && pendingCount === 0) {
        currentStatus = "scheduled";
      }
    }

    // 🔄 2. Update ke masing-masing table yang sesuai
    await ModelTarget.findByIdAndUpdate(broadcastId, {
      success: successCount,
      failed: failedCount,
      status: currentStatus,
    });
  } catch (err) {
    console.error("[QUEUE SUMMARY ERROR]:", err.message);
  }
}

// Fungsi pembantu baru untuk menghitung ulang & mengupdate status grup Broadcast utama
async function updateBroadcastSummary(broadcastId) {
  if (!broadcastId) return;

  try {
    // 🔍 1. Periksa apakah masih ada nomor di grup broadcast ini yang antri/pending
    const pendingCount = await MessageLog.countDocuments({
      broadcastId,
      status: "pending",
    });

    // 🔍 2. Hitung jumlah yang sukses dan gagal saat ini
    const successCount = await MessageLog.countDocuments({
      broadcastId,
      status: "sent",
    });
    const failedCount = await MessageLog.countDocuments({
      broadcastId,
      status: "failed",
    });

    // Tentukan apakah semua antrean nomor milik broadcast ini sudah habis
    const currentStatus = pendingCount === 0 ? "completed" : "running";

    // 🔄 3. Update dokumentasi master Broadcast di database
    await Broadcast.findByIdAndUpdate(broadcastId, {
      success: successCount,
      failed: failedCount,
      status: currentStatus,
    });

    if (pendingCount === 0) {
      console.log(
        `[QUEUE-BCAST] Rekap Broadcast ID: ${broadcastId} dinyatakan SELESAI (Completed).`,
      );
    }
  } catch (err) {
    console.error(
      "[QUEUE-BCAST ERROR] Gagal update rekap master broadcast:",
      err.message,
    );
  }
}
/**
 * Fungsi memasukkan berbagai tipe pesan ke dalam antrian per user
 */
export function addMessageToQueue(userId, jid, data) {
  if (!userQueues[userId]) {
    userQueues[userId] = [];
  }

  userQueues[userId].push({ jid, ...data });
  console.log(
    `[QUEUE] Job baru (${data.type}) ditambahkan untuk User ${userId}. Sisa antrian: ${userQueues[userId].length}`,
  );

  if (!processingStates[userId]) {
    processUserQueue(userId);
  }
}

/**
 * Worker Antrian Per User
 */
// async function processUserQueue(userId) {
//   if (!userQueues[userId] || userQueues[userId].length === 0) {
//     processingStates[userId] = false;
//     console.log(`[QUEUE] Semua antrian untuk User ${userId} telah selesai.`);
//     return;
//   }

//   processingStates[userId] = true;

//   const currentJob = userQueues[userId].shift();
//   // 🟢 LANGKAH 2: Ekstrak properti 'messageId' yang dikirim dari router API kamu
//   const { jid, type, message, imageUrl, documentUrl, fileName, caption, messageId } = currentJob;

//   try {
//     const sock = getClient(userId);

//     if (!sock) {
//       console.log(`[QUEUE - ${userId}] Gagal mengirim: Instansi WA tidak aktif.`);
//       // Jika WhatsApp tidak aktif, lempar error agar ditangkap blok catch di bawah
//       throw new Error("WhatsApp belum connect / tidak aktif");
//     } else {

//       let result;

//       // 📋 PERBEDAAN EKSEKUSI BERDASARKAN TIPE PESAN
//       if (type === "image") {
//         console.log(`[QUEUE - ${userId}] Mendownload gambar untuk ${jid}...`);
//         const { buffer } = await downloadFile(imageUrl);
//         result = await sock.sendMessage(jid, { image: buffer, caption: caption || "" });

//       } else if (type === "document") {
//         console.log(`[QUEUE - ${userId}] Mendownload dokumen untuk ${jid}...`);
//         const { buffer, fileSize } = await downloadFile(documentUrl);

//         // Validasi ukuran berkas di dalam antrian (Batas 10 MB)
//         const maxSize = 10 * 1024 * 1024;
//         if (fileSize && Number(fileSize) > maxSize) {
//           throw new Error(`Ukuran berkas melebihi batas maksimal 10 MB (Terdeteksi: ${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
//         }

//         result = await sock.sendMessage(jid, {
//           document: buffer,
//           fileName: fileName || "document.pdf",
//           mimetype: "application/pdf", // Bisa disesuaikan otomatis jika contentType tersedia dari helper
//           caption: caption || "",
//         });

//       } else {
//         // Default tipe "text"
//         result = await sock.sendMessage(jid, { text: message });
//       }

//       console.log(`[QUEUE - ${userId}] Sukses mengirim ${type} ke ${jid}`);

//       // 🟢 LANGKAH 3: JIKA SUKSES TERKIRIM, UPDATE KE MONGODB
//       if (messageId) {
//         // Ambil ID resmi dari server WhatsApp jika ada (kembalian dari sock.sendMessage)
//         const waMessageId = result?.key?.id || messageId;

//         await MessageLog.findOneAndUpdate(
//           { messageId: messageId }, // Cari berdasarkan ID acak sementara
//           {
//             status: "sent",
//             messageId: waMessageId // Perbarui dengan ID resmi dari WA
//           }
//         ).catch(err => console.error("Gagal update DB status 'sent':", err.message));
//       }
//     }
//   } catch (error) {
//     console.error(`[QUEUE - ${userId}] Gagal memproses ${type} ke ${jid}. Alasan:`, error.message);

//     // 🔴 LANGKAH 4: JIKA GAGAL TERKIRIM, UPDATE KE MONGODB
//     if (messageId) {
//       await MessageLog.findOneAndUpdate(
//         { messageId: messageId },
//         {
//           status: "failed",
//           errorReason: error.message || "Unknown error"
//         }
//       ).catch(err => console.error("Gagal update DB status 'failed':", err.message));
//     }
//   }

//   // ⏱️ ANTI-BANNED DELAY (4 detik antar setiap aktivitas)
//   const jedaAman = 4000;
//   await delay(jedaAman);

//   processUserQueue(userId);
// }

// async function processUserQueue(userId) {
//   if (!userQueues[userId] || userQueues[userId].length === 0) {
//     processingStates[userId] = false;
//     console.log(`[QUEUE] Semua antrian untuk User ${userId} telah selesai.`);
//     return;
//   }

//   processingStates[userId] = true;

//   const currentJob = userQueues[userId].shift();

//   // 🎯 UPDATE: Ambil parameter delayMin dan delayMax dari payload data job broadcast
//   const {
//     jid,
//     type,
//     message,
//     imageUrl,
//     documentUrl,
//     fileName,
//     caption,
//     messageId,
//     delayMin,
//     delayMax,
//     broadcastId,
//   } = currentJob;

//   try {
//     const sock = getClient(userId);

//     if (!sock) {
//       console.log(
//         `[QUEUE - ${userId}] Gagal mengirim: Instansi WA tidak aktif.`,
//       );
//       throw new Error("WhatsApp belum connect / tidak aktif");
//     } else {
//       let result;

//       if (type === "image") {
//         console.log(`[QUEUE - ${userId}] Mendownload gambar untuk ${jid}...`);
//         const { buffer } = await downloadFile(imageUrl);
//         result = await sock.sendMessage(jid, {
//           image: buffer,
//           caption: caption || "",
//         });
//       } else if (type === "document") {
//         console.log(`[QUEUE - ${userId}] Mendownload dokumen untuk ${jid}...`);
//         const { buffer, fileSize } = await downloadFile(documentUrl);

//         const maxSize = 10 * 1024 * 1024;
//         if (fileSize && Number(fileSize) > maxSize) {
//           throw new Error(
//             `Ukuran berkas melebihi batas maksimal 10 MB (Terdeteksi: ${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
//           );
//         }

//         result = await sock.sendMessage(jid, {
//           document: buffer,
//           fileName: fileName || "document.pdf",
//           mimetype: "application/pdf",
//           caption: caption || "",
//         });
//       } else {
//         result = await sock.sendMessage(jid, { text: message });
//       }

//       console.log(
//         `[QUEUE - ${userId}] Sukses mengirim ${type || "text"} ke ${jid}`,
//       );

//       if (messageId) {
//         const waMessageId = result?.key?.id || messageId;

//         await MessageLog.findOneAndUpdate(
//           { messageId: messageId },
//           {
//             status: "sent",
//             messageId: waMessageId,
//           },
//         ).catch((err) =>
//           console.error("Gagal update DB status 'sent':", err.message),
//         );

//         // 🎯 TRACKING UPDATE: Jalankan fungsi rekap update data Broadcast
//         await updateSummaryRekap(broadcastId, messageId);
//       }
//     }
//   } catch (error) {
//     console.error(
//       `[QUEUE - ${userId}] Gagal memproses ${type || "text"} ke ${jid}. Alasan:`,
//       error.message,
//     );

//     if (messageId) {
//       await MessageLog.findOneAndUpdate(
//         { messageId: messageId },
//         {
//           status: "failed",
//           errorReason: error.message || "Unknown error",
//         },
//       ).catch((err) =>
//         console.error("Gagal update DB status 'failed':", err.message),
//       );

//       // 🎯 TRACKING UPDATE: Jalankan fungsi rekap update data Broadcast meskipun gagal
//       await updateBroadcastSummary(broadcastId);
//     }
//   }

//   // 🎯 UPDATE JEDA: Pakai jeda acak dinamis jika dikirim oleh broadcast, jika tidak pakai default 4 detik
//   const waktuJeda = getRandomDelay(delayMin || 4, delayMax || 4);
//   console.log(
//     `[QUEUE - ${userId}] Menunggu jeda selama ${waktuJeda / 1000} detik...`,
//   );
//   await delay(waktuJeda);

//   processUserQueue(userId);
// }

async function processUserQueue(userId) {
  if (!userQueues[userId] || userQueues[userId].length === 0) {
    processingStates[userId] = false;
    console.log(`[QUEUE] Semua antrian untuk User ${userId} telah selesai.`);
    return;
  }

  processingStates[userId] = true;

  const currentJob = userQueues[userId].shift();

  const {
    jid,
    type,
    message,
    imageUrl,
    mediaUrl, // 🎯 TAMBAHAN: Untuk membaca path file lokal dari modul status
    documentUrl,
    fileName,
    caption,
    messageId,
    delayMin,
    delayMax,
    broadcastId,
  } = currentJob;

  try {
    const sock = getClient(userId);

    if (!sock) {
      console.log(
        `[QUEUE - ${userId}] Gagal mengirim: Instansi WA tidak aktif.`,
      );
      throw new Error("WhatsApp belum connect / tidak aktif");
    } else {
      let result;
      const isStatusJob = jid === "status@broadcast"; // 🎯 Deteksi apakah ini job Status WA

      // ================= CANGKONGAN LOGIKA KHUSUS STATUS WA =================
      if (isStatusJob) {
        const { User } = await import("../models/User.js");
        const { Contact } = await import("../models/Contact.js"); // 🎯 IMPORT MODEL KONTAK BARU

        // 1. Ambil data nomor dari database untuk pengirim
        const dbUser = await User.findById(userId);
        if (!dbUser || !dbUser.waNumber) {
          throw new Error(`Data nomor WA user tidak ditemukan.`);
        }

        const cleanNumber = dbUser.waNumber.replace(/\D/g, "");
        const myCleanJid = `${cleanNumber}@s.whatsapp.net`;

        // 2. 🎯 OTOMATISASI TARGET: Ambil semua JID kontak yang terfilter hanya milik user ini
        const savedContacts = await Contact.find({ userId: userId }).select(
          "jid",
        );

        let targetBroadcastList = [];
        if (savedContacts.length > 0) {
          targetBroadcastList = savedContacts.map((c) => c.jid);
        }

        // Pengaman: Jika database kontak kosong, minimal masukkan nomor sendiri seperti pancingan kemarin
        if (!targetBroadcastList.includes(myCleanJid)) {
          targetBroadcastList.push(myCleanJid);
        }

        console.log(
          `[QUEUE - ${userId}] Mengirim status ke ${targetBroadcastList.length} kontak di database.`,
        );

        if (type === "image" || mediaUrl) {
          console.log(`[QUEUE - ${userId}] Mengunggah Status GAMBAR...`);

          const cleanPath = mediaUrl.startsWith("/")
            ? mediaUrl.substring(1)
            : mediaUrl;
          const fileBuffer = fs.readFileSync(cleanPath);

          result = await sock.sendMessage(
            "status@broadcast",
            {
              image: fileBuffer,
              caption: message || caption || "",
            },
            {
              backgroundColor: "#333333",
              broadcast: true,
              statusJidList: targetBroadcastList, // 🎯 Terisi otomatis dari DB kontak user!
            },
          );
        } else {
          console.log(`[QUEUE - ${userId}] Mengunggah Status TEKS...`);

          result = await sock.sendMessage(
            "status@broadcast",
            {
              text: String(message),
            },
            {
              backgroundColor: "#075E54",
              font: 1,
              broadcast: true,
              statusJidList: targetBroadcastList, // 🎯 Terisi otomatis dari DB kontak user!
              participant: myCleanJid,
            },
          );
        }

        console.log(
          `[QUEUE - ${userId}] Status Sukses Diterima oleh Node WhatsApp.`,
        );
      } else {
        if (type === "image") {
          console.log(`[QUEUE - ${userId}] Mendownload gambar untuk ${jid}...`);
          const { buffer } = await downloadFile(imageUrl);
          result = await sock.sendMessage(jid, {
            image: buffer,
            caption: caption || "",
          });
        } else if (type === "document") {
          console.log(
            `[QUEUE - ${userId}] Mendownload dokumen untuk ${jid}...`,
          );
          const { buffer, fileSize } = await downloadFile(documentUrl);

          const maxSize = 10 * 1024 * 1024;
          if (fileSize && Number(fileSize) > maxSize) {
            throw new Error(
              `Ukuran berkas melebihi batas maksimal 10 MB (Terdeteksi: ${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
            );
          }

          result = await sock.sendMessage(jid, {
            document: buffer,
            fileName: fileName || "document.pdf",
            mimetype: "application/pdf",
            caption: caption || "",
          });
        } else {
          result = await sock.sendMessage(jid, { text: message });
        }
      }

      console.log(
        `[QUEUE - ${userId}] Sukses mengirim ${type || "text"} ke ${jid}`,
      );

      if (messageId) {
        const waMessageId = result?.key?.id || messageId;

        await MessageLog.findOneAndUpdate(
          { messageId: messageId },
          {
            status: "sent",
            messageId: waMessageId,
          },
        ).catch((err) =>
          console.error("Gagal update DB status 'sent':", err.message),
        );

        // 🎯 DISESUAIKAN: Gunakan updateSummaryRekap yang mendukung dua tipe model
        await updateSummaryRekap(broadcastId, messageId);
      }
    }
  } catch (error) {
    console.error(
      `[QUEUE - ${userId}] Gagal memproses ${type || "text"} ke ${jid}. Alasan:`,
      error.message,
    );

    if (messageId) {
      await MessageLog.findOneAndUpdate(
        { messageId: messageId },
        {
          status: "failed",
          errorReason: error.message || "Unknown error",
        },
      ).catch((err) =>
        console.error("Gagal update DB status 'failed':", err.message),
      );

      // 🎯 DISESUAIKAN: Mengganti updateBroadcastSummary bawaan ke fungsi baru agar rekap status terjadwal ikut ter-update saat gagal
      await updateSummaryRekap(broadcastId, messageId);
    }
  }

  const waktuJeda = getRandomDelay(delayMin || 4, delayMax || 4);
  console.log(
    `[QUEUE - ${userId}] Menunggu jeda selama ${waktuJeda / 1000} detik...`,
  );
  await delay(waktuJeda);

  processUserQueue(userId);
}

export function getQueueLength(userId) {
  return userQueues[userId] ? userQueues[userId].length : 0;
}
