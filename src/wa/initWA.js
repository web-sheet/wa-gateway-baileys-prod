//file initWA.js

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion, // 🎯 TAMBAHKAN IMPORT INI
} from "@whiskeysockets/baileys";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
// 2. 🎯 GUNAKAN PAKET BARU YANG KAMU TEMUKAN
import pkg from "@naanzitos/baileys-make-in-memory-store";
const { makeInMemoryStore } = pkg;
import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import axios from "axios";
import { User } from "../models/User.js";
import { DeviceLog } from "../models/DeviceLog.js";
import { fileURLToPath } from "url";
import { getIO } from "./socket/io.js";
import { handleLocationMessage } from "./handlers/messageHandler.js"; // sesuaikan path filenya
import { handleAutoreplyMessage } from "./handlers/autoReplyHandler.js"; // sesuaikan path filenya
import {
  kirimNotifAdmin,
  getDisconnectReason,
} from "../helpers/whatsappNotif.js"; // Sesuaikan path-nya

// 1. Import di bagian paling atas file utama
import { handleAccountingMessage } from "./handlers/accountingHandler.js";
import { saveBotReplyLog } from "../helpers/botLogHelper.js";

const pino = require("pino"); // 🎯 AMBIL PINO LOGGER DI SINI

const clients = {};
const qrCache = {};

// 🎯 CACHE STORE UNTUK MENAMPUNG KONEKSI MULTI-USER AGAR TIDAK SALING TERTUKAR
const stores = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initWA(userId) {
  const user = await User.findById(userId);
  const io = getIO();
  console.log(userId);

  if (clients[userId]) {
    console.log("WA already running:", userId);
    return clients[userId];
  }

  const sessionDir = path.join(__dirname, "../../sessions", userId.toString());
  fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    browser: ["Chrome", "Linux", "20"],
  });

  clients[userId] = sock;

  sock.ev.on("creds.update", saveCreds);

  // ========================================================
  // 🎯 STRATEGI TANPA STORE: LANGSUNG TANGKAP & SIMPAN KE DB
  // ========================================================

  // Ambil kontak saat pertama kali scan / sinkronisasi riwayat awal
  sock.ev.on("messaging-history.set", async (historyData) => {
    try {
      const { contacts } = historyData;
      if (contacts && contacts.length > 0) {
        console.log(
          `[WA EVENT] Menerima ${contacts.length} riwayat kontak dari HP.`,
        );
        await saveContactsToMongoDB(userId, contacts);
      }
    } catch (err) {
      console.error("Gagal memproses messaging-history:", err.message);
    }
  });

  // Ambil kontak baru atau update kontak yang masuk secara berkala
  sock.ev.on("contacts.upsert", async (contacts) => {
    try {
      if (contacts && contacts.length > 0) {
        console.log(
          `[WA EVENT] Ada ${contacts.length} kontak baru/update masuk.`,
        );
        await saveContactsToMongoDB(userId, contacts);
      }
    } catch (err) {
      console.error("Gagal memproses contacts.upsert:", err.message);
    }
  });
  // ========================================================

  sock.ev.on("connection.update", async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      console.log("QR generated for:", userId);
      const qrDataUrl = await qrcode.toDataURL(qr);
      qrCache[userId] = qrDataUrl;
      io.to(`user-${userId}`).emit("qr", { qr: qrDataUrl });
    }

    if (connection === "open") {
      console.log("WA connected:", userId);
      io.to(`user-${userId}`).emit("ready");

      const phone = sock.user?.id
        ?.split(":")[0]
        ?.replace("@s.whatsapp.net", "");

      // Ambil data user dari database untuk tahu username-nya di dalam pesannotif
      const targetUser = await User.findById(userId);
      const username = targetUser?.username || "Unknown User";

      await User.findByIdAndUpdate(userId, {
        waStatus: "connected",
        waNumber: phone,
      });

      await DeviceLog.create({
        userId: userId,
        waNumber: phone,
        status: "connected",
        reason: "Sesi berhasil dibuka dan terhubung ke server.",
      });

      // 🎯 NOTIFIKASI: Admin mengabarkan bahwa ada user yang konek
      const pesanNotifSukses = `📢 *LAPORAN GATEWAY: AKUN KONEK*\n\nHalo bos, menginfokan bahwa akun milik *${username}* (${phone}) telah *BERHASIL TERCONNECTED* ke server.`;
      await kirimNotifAdmin(pesanNotifSukses);
    }

    // if (connection === "close") {
    //   const code = lastDisconnect?.error?.output?.statusCode;
    //   console.log("WA disconnected:", userId, code);

    //   await User.findByIdAndUpdate(userId, { waStatus: "disconnected" });
    //   delete clients[userId];

    //   const janganReconnect = [DisconnectReason.loggedOut, 401, 403, 408];

    //   if (!janganReconnect.includes(code)) {
    //     console.log(
    //       `[RECONNECT] Mencoba menyambungkan kembali user ${userId} dalam 3 detik...`,
    //     );
    //     setTimeout(() => initWA(userId), 3000);
    //   } else {
    //     const sessionDir = path.join(
    //       __dirname,
    //       "../../sessions",
    //       userId.toString(),
    //     );
    //     if (fs.existsSync(sessionDir)) {
    //       fs.rmSync(sessionDir, { recursive: true, force: true });
    //       console.log("Old session cleared for clean login:", userId);
    //     }
    //     io.to(`user-${userId}`).emit("logout", {
    //       reason:
    //         code === 401 ? "QR Scan Timeout / Invalid Session" : "Logged Out",
    //     });
    //   }
    // }

    // if (connection === "close") {
    //   const code = lastDisconnect?.error?.output?.statusCode;
    //   console.log("WA disconnected:", userId, code);

    //   // 🎯 SEKARANG CUKUP PANGGIL FUNGSI INI:
    //   const logReason = getDisconnectReason(code);

    //   // 1. Update status utama user menjadi disconnected
    //   const targetUser = await User.findById(userId);
    //   const savedPhone = targetUser?.waNumber || currentPhone;

    //   await User.findByIdAndUpdate(userId, { waStatus: "disconnected" });
    //   delete clients[userId];

    //   // 2. Catat sejarah disconnect beserta alasannya ke DeviceLog
    //   await DeviceLog.create({
    //     userId: userId,
    //     waNumber: savedPhone,
    //     status: "disconnected",
    //     reason: logReason, // <-- Hasil string dari fungsi getDisconnectReason()
    //   });

    //   // 🎯 NOTIFIKASI: Admin mengabarkan bahwa ada user yang putus beserta alasannya
    //   if (savedPhone && savedPhone !== "unknown") {
    //     const pesanNotifGagal = `⚠️ *LAPORAN GATEWAY: AKUN PUTUS*\n\nHalo bos, peringatan bahwa akun milik *${username}* (${savedPhone}) telah *TERPUTUS* dari server.\n\n*Alasan:* ${logReason}`;
    //     await kirimNotifAdmin(pesanNotifGagal);
    //   }

    //   // --- LOGIKA RECONNECT BAWAAN KAMU ---
    //   const janganReconnect = [DisconnectReason.loggedOut, 401, 403, 408];
    //   if (!janganReconnect.includes(code)) {
    //     console.log(
    //       `[RECONNECT] Mencoba menyambungkan kembali user ${userId} dalam 3 detik...`,
    //     );
    //     setTimeout(() => initWA(userId), 3000);
    //   } else {
    //     const sessionDir = path.join(
    //       __dirname,
    //       "../../sessions",
    //       userId.toString(),
    //     );
    //     if (fs.existsSync(sessionDir)) {
    //       fs.rmSync(sessionDir, { recursive: true, force: true });
    //     }
    //     io.to(`user-${userId}`).emit("logout", {
    //       reason:
    //         code === 401 ? "QR Scan Timeout / Invalid Session" : "Logged Out",
    //     });
    //   }
    // }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log("WA disconnected:", userId, code);

      const logReason = getDisconnectReason(code);

      // 1. Ambil data user dari database TERLEBIH DAHULU
      const targetUser = await User.findById(userId);

      // 2. Definisikan variabel savedPhone dan username dari data database di atas
      const savedPhone = targetUser?.waNumber || currentPhone;
      const username = targetUser?.username || "Unknown User"; // 🎯 Variabel username dibuat di sini

      // 3. Update status utama user menjadi disconnected di database
      await User.findByIdAndUpdate(userId, { waStatus: "disconnected" });

      // 4. Hapus session aktif dari memory RAM
      delete clients[userId];

      // 5. Catat sejarah disconnect beserta alasannya ke DeviceLog
      await DeviceLog.create({
        userId: userId,
        waNumber: savedPhone,
        status: "disconnected",
        reason: logReason,
      });

      // 6. Kirim notifikasi via API Admin (Sekarang variabel username & savedPhone sudah pasti aman digunakan)
      if (savedPhone && savedPhone !== "unknown") {
        const pesanNotifGagal = `⚠️ *LAPORAN GATEWAY: AKUN PUTUS*\n\nHalo bos, peringatan bahwa akun milik *${username}* (${savedPhone}) telah *TERPUTUS* dari server.\n\n*Alasan:* ${logReason}`;
        await kirimNotifAdmin(pesanNotifGagal);
      }

      // --- LOGIKA RECONNECT BAWAAN KAMU ---
      const janganReconnect = [DisconnectReason.loggedOut, 401, 403, 408];
      if (!janganReconnect.includes(code)) {
        console.log(
          `[RECONNECT] Mencoba menyambungkan kembali user ${userId} dalam 3 detik...`,
        );
        setTimeout(() => initWA(userId), 3000);
      } else {
        const sessionDir = path.join(
          __dirname,
          "../../sessions",
          userId.toString(),
        );
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        io.to(`user-${userId}`).emit("logout", {
          reason:
            code === 401 ? "QR Scan Timeout / Invalid Session" : "Logged Out",
        });
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];

    console.log(JSON.stringify(msg.key, null, 2));

    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;

    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const messageType = Object.keys(msg.message)[0];

    const validPrefixes = [
      "/d",
      "/add",
      "Paid",
      "paid",
      "Settle",
      "settle",
      "ccl",
      "hitung",
    ];
    const isLocation =
      messageType === "locationMessage" ||
      messageType === "liveLocationMessage";
    const isAccounting = validPrefixes.some((prefix) =>
      text.startsWith(prefix),
    );

    let currentUser = user;
    try {
      const freshUser = await User.findById(userId);
      if (freshUser) currentUser = freshUser;
    } catch (dbErr) {
      console.error(
        "[DB ERROR] Gagal mengambil data user terbaru:",
        dbErr.message,
      );
    }

    const isAutoreplySent = await handleAutoreplyMessage(
      sock,
      { messages },
      currentUser._id,
    );
    if (isAutoreplySent) return;

    if (isLocation) {
      await handleLocationMessage(sock, msg, from, currentUser);
    } else if (isAccounting) {
      await handleAccountingMessage(sock, msg, from, currentUser);
    } else {
      if (
        currentUser &&
        currentUser.webhookBotUrl &&
        (messageType === "conversation" ||
          messageType === "extendedTextMessage")
      ) {
        try {
          await axios.post(
            currentUser.webhookBotUrl,
            {
              userId: currentUser._id,
              from: from,
              pushName: msg.pushName || "WhatsApp User",
              messageId: msg.key.id,
              text: text,
              timestamp: msg.messageTimestamp,
              rawMessage: msg,
            },
            { timeout: 5000 },
          );
        } catch (error) {
          console.error(`[WEBHOOK ERROR]:`, error.message);
        }
      }
    }

    if (text?.toLowerCase() === "ping") {
      const replyMsg = "pong 🏓";
      const result = await sock.sendMessage(from, { text: replyMsg });
      if (currentUser)
        await saveBotReplyLog(currentUser._id, from, replyMsg, result);
    }
  });

  return sock;
}

export async function disconnectWA(userId) {
  const io = getIO();
  const sock = clients[userId];

  // 1. Jika instance bot masih aktif di RAM, matikan secara resmi ke server WA
  if (sock) {
    try {
      await sock.logout();
    } catch (err) {
      console.log(
        "Socket Baileys sudah mati atau gagal .logout():",
        err.message,
      );
    }
    // Hapus dari memory cache RAM server
    delete clients[userId];
  }

  // Jaga-jaga jika cache QR masih menyimpan data user ini, bersihkan juga
  if (qrCache[userId]) {
    delete qrCache[userId];
  }

  // 2. Bersihkan status di database MongoDB
  await User.findByIdAndUpdate(userId, {
    waStatus: "disconnected",
    waNumber: "-",
  });

  // 3. Hapus folder session fisiknya agar token lamanya benar-benar lenyap
  const sessionDir = path.join(__dirname, "../../sessions", userId.toString());
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    console.log("Folder sesi dibersihkan via fungsi disconnectWA:", userId);
  }

  // 4. Beri tahu frontend lewat Socket.io untuk mengubah tampilan secara real-time
  io.to(`user-${userId}`).emit("logout", {
    reason: "Logged Out dari Dashboard",
  });
}

// 🎯 HELPER BARU: Fungsi untuk bulk update langsung ke MongoDB
async function saveContactsToMongoDB(userId, contactsArray) {
  try {
    const { Contact } = await import("../models/Contact.js");

    const bulkOps = contactsArray
      .filter(
        (c) => c.id && c.id.endsWith("@s.whatsapp.net") && !c.id.includes("-"),
      )
      .map((c) => {
        const finalName =
          c.name || c.verifiedName || c.notify || "Pelanggan Tanpa Nama";
        return {
          updateOne: {
            filter: { userId: userId, jid: c.id },
            update: { $set: { name: finalName } },
            upsert: true,
          },
        };
      });

    if (bulkOps.length > 0) {
      await Contact.bulkWrite(bulkOps);
      console.log(
        `[MONGODB] Berhasil mengamankan ${bulkOps.length} kontak murni ke database.`,
      );
    }
  } catch (error) {
    console.error("[MONGODB ERROR] Gagal bulkwrite kontak:", error.message);
  }
}

export function getClient(userId) {
  if (!userId) return null;
  return clients[userId.toString()] || null; // 👈 Pastikan ada .toString()
}

export async function getGroupList(userId) {
  const sock = clients[userId];

  if (!sock) {
    throw new Error("WA not connected");
  }

  // 🔥 Ambil semua group yang diikuti akun WA ini
  const groups = await sock.groupFetchAllParticipating();

  // format jadi array simple untuk FE
  return Object.values(groups).map((group) => ({
    id: group.id,
    name: group.subject,
    size: group.size,
    desc: group.desc,
  }));
}
