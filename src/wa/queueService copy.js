// wa/queueService.js
import { getClient } from "./initWA.js";
import { downloadFile } from "../helpers/fileDownloader.js"; // Pastikan helper download di-import
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
  // Ambil semua kemungkinan data properti dari antrian
  const { jid, type, message, imageUrl, documentUrl, fileName, caption } = currentJob;

  try {
    const sock = getClient(userId);
    
    if (!sock) {
      console.log(`[QUEUE - ${userId}] Gagal mengirim: Instansi WA tidak aktif.`);
    } else {
      
      // 📋 PERBEDAAN EKSEKUSI BERDASARKAN TIPE PESAN
      if (type === "image") {
        console.log(`[QUEUE - ${userId}] Mendownload gambar untuk ${jid}...`);
        const { buffer } = await downloadFile(imageUrl);
        await sock.sendMessage(jid, { image: buffer, caption: caption || "" });

      } else if (type === "document") {
        console.log(`[QUEUE - ${userId}] Mendownload dokumen untuk ${jid}...`);
        const { buffer, fileSize } = await downloadFile(documentUrl);
        
        // Validasi ukuran berkas di dalam antrian (Batas 10 MB)
        const maxSize = 10 * 1024 * 1024;
        if (fileSize && Number(fileSize) > maxSize) {
          throw new Error(`Ukuran berkas melebihi batas maksimal 10 MB (Terdeteksi: ${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        }

        await sock.sendMessage(jid, {
          document: buffer,
          fileName: fileName || "document.pdf",
          mimetype: "application/pdf", // Bisa disesuaikan otomatis jika contentType tersedia dari helper
          caption: caption || "",
        });

      } else {
        // Default tipe "text"
        await sock.sendMessage(jid, { text: message });
      }

      console.log(`[QUEUE - ${userId}] Sukses mengirim ${type} ke ${jid}`);
    }
  } catch (error) {
    console.error(`[QUEUE - ${userId}] Gagal memproses ${type} ke ${jid}. Alasan:`, error.message);
  }

  // ⏱️ ANTI-BANNED DELAY (4 detik antar setiap aktivitas)
  const jedaAman = 4000; 
  await delay(jedaAman);

  processUserQueue(userId);
}

export function getQueueLength(userId) {
  return userQueues[userId] ? userQueues[userId].length : 0;
}