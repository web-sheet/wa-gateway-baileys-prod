import { User } from "../models/User.js"; // Sesuaikan path model User kamu
import { DisconnectReason } from "@whiskeysockets/baileys"; // Pastikan import library Baileys
import axios from "axios";
/**
 * Fungsi untuk menerjemahkan kode error WhatsApp (statusCode) menjadi alasan yang manusiawi
 * @param {number} code - Status code error dari lastDisconnect
 * @returns {string} Alasan error dalam bahasa Indonesia
 */



/**
 * Fungsi untuk mengirim notifikasi dari Nomor Admin ke Nomor Pribadi Kamu via API
 * @param {string} message - Isi pesan notifikasi mengenai status akun user
 */
export async function kirimNotifAdmin(message) {
  try {
    // 🎯 1. HARDCODE: Ganti dengan Nomor Pribadi kamu yang khusus menerima notifikasi (Format: 628xxx)
    const nomorPenerimaNotif = "62895415163173"; 

    // 🎯 2. HARDCODE: Ganti dengan API KEY milik akun Admin kamu yang sudah terkoneksi ke gateway
    const apiKeyAdminPengirim = "0bbf91e97a6beee2457fd7ba5fe20ab37ddf461604313ec022e37ebb2e808b5a"; 

    // 🎯 3. HARDCODE: Ganti dengan URL API endpoint kirim pesan teks milikmu
    const urlApi = "https://websheetapp.my.id/api/send"; 
    // Catatan: Jika di VPS, gunakan domain/IP kamu (misal: https://websheetapp.my.id/send-message)

    // Susun Payload/Body sesuai format API kamu
    const payload = {
      number: nomorPenerimaNotif, // Dikirim ke nomor penerima
      message: message,           // Isi laporan status akun user
      delayMin: 1, 
      delayMax: 3
    };

    // Eksekusi HTTP POST menembak API menggunakan API Key milik Admin
    const response = await axios.post(urlApi, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKeyAdminPengirim // <-- Menggunakan API Key Admin selaku pengirim tetap
      }
    });

    console.log(`[NOTIF ADMIN] Notifikasi status berhasil dikirim oleh Admin. Response:`, response.data);
    return true;

  } catch (error) {
    console.error("[NOTIF ADMIN] Gagal mengirim notifikasi via API Admin:", error.response?.data || error.message);
    return false;
  }
}


export function getDisconnectReason(code) {
  switch (code) {
    case DisconnectReason.loggedOut:
    case 401:
      return "Sesi dikeluarkan (Logged Out) oleh pengguna atau QR expired.";
    case DisconnectReason.connectionLost:
    case 408:
      return "Koneksi hilang/timeout (Masalah jaringan pada server atau perangkat HP).";
    case DisconnectReason.connectionClosed:
      return "Koneksi ditutup secara sepihak oleh WhatsApp. Mencoba menyambungkan ulang...";
    case DisconnectReason.connectionReplaced:
    case 411:
      return "Sesi digantikan (Akun WhatsApp ini sedang dibuka di server atau device lain).";
    case DisconnectReason.restartRequired:
    case 515:
      return "Stream terputus (Server WhatsApp meminta reload/restart koneksi).";
    case DisconnectReason.timedOut:
      return "Koneksi ke server WhatsApp mencapai batas waktu (Timed Out).";
    case DisconnectReason.badSession:
      return "File sesi rusak atau tidak valid. Silakan hapus sesi dan scan QR ulang.";
    default:
      return `Terputus dengan kode error tidak dikenal: ${code || "Unknown"}`;
  }
}