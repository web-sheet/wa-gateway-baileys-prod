// wa/queueService.js

import { getClient } from "./initWA.js";
import { downloadFile } from "../helpers/fileDownloader.js"; // Pastikan helper download di-import
// 🟢 LANGKAH 1: Import model MessageLog untuk akses ke MongoDB
import { MessageLog } from "../models/MessageLog.js"; 

const userQueues = {};
const processingStates = {};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fungsi memasukkan berbagai tipe pesan ke dalam antrian per user
 */
export function addMessageToQueue(userId, jid, data) {
  if (!userQueues[userId]) {
    userQueues[userId] = [];
  }

  userQueues[userId].push({ jid, ...data });
  console.log(`[QUEUE] Job baru (${data.type}) ditambahkan untuk User ${userId}. Sisa antrian: ${userQueues[userId].length}`);
  
  if (!processingStates[userId]) {
    processUserQueue(userId);
  }
}

/**
 * Worker Antrian Per User
 */
async function processUserQueue(userId) {
  if (!userQueues[userId] || userQueues[userId].length === 0) {
    processingStates[userId] = false;
    console.log(`[QUEUE] Semua antrian untuk User ${userId} telah selesai.`);
    return;
  }

  processingStates[userId] = true;

  const currentJob = userQueues[userId].shift();
  // 🟢 LANGKAH 2: Ekstrak properti 'messageId' yang dikirim dari router API kamu
  const { jid, type, message, imageUrl, documentUrl, fileName, caption, messageId } = currentJob;

  try {
    const sock = getClient(userId);
    
    if (!sock) {
      console.log(`[QUEUE - ${userId}] Gagal mengirim: Instansi WA tidak aktif.`);
      // Jika WhatsApp tidak aktif, lempar error agar ditangkap blok catch di bawah
      throw new Error("WhatsApp belum connect / tidak aktif");
    } else {
      
      let result;

      // 📋 PERBEDAAN EKSEKUSI BERDASARKAN TIPE PESAN
      if (type === "image") {
        console.log(`[QUEUE - ${userId}] Mendownload gambar untuk ${jid}...`);
        const { buffer } = await downloadFile(imageUrl);
        result = await sock.sendMessage(jid, { image: buffer, caption: caption || "" });

      } else if (type === "document") {
        console.log(`[QUEUE - ${userId}] Mendownload dokumen untuk ${jid}...`);
        const { buffer, fileSize } = await downloadFile(documentUrl);
        
        // Validasi ukuran berkas di dalam antrian (Batas 10 MB)
        const maxSize = 10 * 1024 * 1024;
        if (fileSize && Number(fileSize) > maxSize) {
          throw new Error(`Ukuran berkas melebihi batas maksimal 10 MB (Terdeteksi: ${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        }

        result = await sock.sendMessage(jid, {
          document: buffer,
          fileName: fileName || "document.pdf",
          mimetype: "application/pdf", // Bisa disesuaikan otomatis jika contentType tersedia dari helper
          caption: caption || "",
        });

      } else {
        // Default tipe "text"
        result = await sock.sendMessage(jid, { text: message });
      }

      console.log(`[QUEUE - ${userId}] Sukses mengirim ${type} ke ${jid}`);

      // 🟢 LANGKAH 3: JIKA SUKSES TERKIRIM, UPDATE KE MONGODB
      if (messageId) {
        // Ambil ID resmi dari server WhatsApp jika ada (kembalian dari sock.sendMessage)
        const waMessageId = result?.key?.id || messageId;

        await MessageLog.findOneAndUpdate(
          { messageId: messageId }, // Cari berdasarkan ID acak sementara
          { 
            status: "sent",
            messageId: waMessageId // Perbarui dengan ID resmi dari WA
          }
        ).catch(err => console.error("Gagal update DB status 'sent':", err.message));
      }
    }
  } catch (error) {
    console.error(`[QUEUE - ${userId}] Gagal memproses ${type} ke ${jid}. Alasan:`, error.message);

    // 🔴 LANGKAH 4: JIKA GAGAL TERKIRIM, UPDATE KE MONGODB
    if (messageId) {
      await MessageLog.findOneAndUpdate(
        { messageId: messageId },
        { 
          status: "failed",
          errorReason: error.message || "Unknown error"
        }
      ).catch(err => console.error("Gagal update DB status 'failed':", err.message));
    }
  }

  // ⏱️ ANTI-BANNED DELAY (4 detik antar setiap aktivitas)
  const jedaAman = 4000; 
  await delay(jedaAman);

  processUserQueue(userId);
}

export function getQueueLength(userId) {
  return userQueues[userId] ? userQueues[userId].length : 0;
}