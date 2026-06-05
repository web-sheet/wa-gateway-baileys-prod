import { MessageLog } from "../models/MessageLog.js";
import mongoose from "mongoose";

/**
 * Helper otomatis untuk mencatat log pesan keluar dari Bot / Autoreply
 * @param {string} userId - ID pemilik instansi WA
 * @param {string} to - JID nomor tujuan (WhatsApp ID)
 * @param {string} message - Isi text balasan dari bot
 * @param {object} sendResult - Hasil return dari sock.sendMessage (opsional untuk ambil MessageID asli)
 */
export const saveBotReplyLog = async (userId, to, message, sendResult = null) => {
  try {
    // Ambil ID resmi dari WhatsApp, jika gagal buat ID fallback unik bawaan bot
    const waMessageId = sendResult?.key?.id || "bot_" + new mongoose.Types.ObjectId();

    await MessageLog.create({
      userId: userId,
      messageId: waMessageId,
      to: to,
      messageType: "text", // Autoreply bot rata-rata bertipe text
      message: message,
      status: "sent" // Karena bot langsung kirim via socket, statusnya langsung 'sent'
    });
    
    console.log(`[BOT LOG SUCCESS] Berhasil mencatat balasan bot ke ${to.split('@')[0]}`);
  } catch (err) {
    console.error("🔴 [BOT LOG ERROR] Gagal menyimpan log autoreply:", err.message);
  }
};