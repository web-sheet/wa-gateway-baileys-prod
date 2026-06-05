//file initWA.js

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";

import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import axios from "axios";
import { User } from "../models/User.js";
import { fileURLToPath } from "url";
import { getIO } from "./socket/io.js";
import { handleLocationMessage } from "./handlers/messageHandler.js"; // sesuaikan path filenya
// 1. Import di bagian paling atas file utama
import { handleAccountingMessage } from "./handlers/accountingHandler.js";
import { saveBotReplyLog } from "../helpers/botLogHelper.js";

const clients = {};
const qrCache = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initWA(userId) {
  const user = await User.findById(userId);
  // ✅ AMBIL IO DARI SINGLETON
  const io = getIO();
  console.log(userId);

  // 🔒 cegah double init
  if (clients[userId]) {
    console.log("WA already running:", userId);
    return clients[userId];
  }

  // 📁 SESSION PATH (ABSOLUT & AMAN)
  const sessionDir = path.join(__dirname, "../../sessions", userId.toString());
  fs.mkdirSync(sessionDir, { recursive: true });

  // 🔐 AUTH STATE
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  // 🔌 CREATE SOCKET
  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    browser: ["Chrome", "Linux", "20"],
  });

  clients[userId] = sock;

  // 💾 SAVE SESSION
  sock.ev.on("creds.update", saveCreds);

  // 🔁 CONNECTION HANDLER
  sock.ev.on("connection.update", async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      console.log("QR generated for:", userId);

      const qrDataUrl = await qrcode.toDataURL(qr);

      // 🔥 SIMPAN QR
      qrCache[userId] = qrDataUrl;

      io.to(`user-${userId}`).emit("qr", { qr: qrDataUrl });
    }

    if (connection === "open") {
      console.log("WA connected:", userId);

      io.to(`user-${userId}`).emit("ready");

      const phone = sock.user?.id
        ?.split(":")[0]
        ?.replace("@s.whatsapp.net", "");

      await User.findByIdAndUpdate(userId, {
        waStatus: "connected",
        waNumber: phone,
      });
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log("WA disconnected:", userId, code);

      await User.findByIdAndUpdate(userId, {
        waStatus: "disconnected",
      });

      delete clients[userId];

      // 🛑 DAFTAR ERROR YANG TIDAK BOLEH AUTO-RECONNECT (Mencegah Loop Abadi)
      // 401 = Terjadi timeout saat scan QR / Session Salah
      // 403 = Akun diblokir oleh WhatsApp
      const janganReconnect = [
        DisconnectReason.loggedOut, // User sengaja logout
        401,
        403,
        408,
      ];

      if (!janganReconnect.includes(code)) {
        // Jika putus karena jaringan/RTO biasa, silakan auto-reconnect
        console.log(
          `[RECONNECT] Mencoba menyambungkan kembali user ${userId} dalam 3 detik...`,
        );
        setTimeout(() => initWA(userId), 3000);
      } else {
        // Jika putus karena kelamaan tidak di-scan (401) atau logout
        const sessionDir = path.join(
          __dirname,
          "../../sessions",
          userId.toString(),
        );

        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          console.log("Old session cleared for clean login:", userId);
        }

        // Beri tahu frontend bahwa sesi mati total, minta mereka refresh manual di web jika ingin scan lagi
        io.to(`user-${userId}`).emit("logout", {
          reason:
            code === 401 ? "QR Scan Timeout / Invalid Session" : "Logged Out",
        });
      }
    }
  });

  // sock.ev.on("messages.upsert", async ({ messages, type }) => {
  //   if (type !== "notify") return;

  //   const msg = messages[0];
  //   if (!msg.message) return;
  //   if (msg.key.fromMe) return;

  //   const from = msg.key.remoteJid;

  //   // 1. Ambil teks mentah pesan secara aman
  //   const text =
  //     msg.message.conversation || msg.message.extendedTextMessage?.text || "";
  //   const messageType = Object.keys(msg.message)[0];

  //   // 2. Daftar prefiks resmi untuk sistem Akuntansi kamu
  //   const validPrefixes = [
  //     "/d",
  //     "/add",
  //     "Paid",
  //     "paid",
  //     "Settle",
  //     "settle",
  //     "ccl",
  //     "hitung"
  //   ];

  //   // 3. Klasifikasikan tipe pesan masuk (Boolean)
  //   const isLocation =
  //     messageType === "locationMessage" ||
  //     messageType === "liveLocationMessage";
  //   const isAccounting = validPrefixes.some((prefix) =>
  //     text.startsWith(prefix),
  //   );

  //   // ========================================================
  //   // SELEKSI JALUR WEBHOOK (DIPISAH SECARA TEGAS)
  //   // ========================================================

  //   if (isLocation) {
  //     // 📍 JALUR LOKASI: Hanya jalankan fungsi pemetaan lokasi
  //     console.log(
  //       `[ROUTE] Pesan Lokasi terdeteksi dari ${from}. Meneruskan ke Handler Lokasi.`,
  //     );
  //     await handleLocationMessage(sock, msg, from, user);
  //   } else if (isAccounting) {
  //     // 📊 JALUR AKUNTANSI: Hanya jalankan fungsi transaksi akuntansi
  //     console.log(
  //       `[ROUTE] Pesan Akuntansi (/d, /add, dll) terdeteksi dari ${from}. Meneruskan ke Handler Akuntansi.`,
  //     );
  //     await handleAccountingMessage(sock, msg, from, user);
  //   } else {
  //     // 🤖 JALUR BOT (PESAN UMUM): Jika bukan lokasi & bukan akuntansi
  //     // Hanya berjalan jika konsumen mengisi 'webhookBotUrl' di dashboard mereka
  //     if (
  //       user &&
  //       user.webhookBotUrl &&
  //       (messageType === "conversation" ||
  //         messageType === "extendedTextMessage")
  //     ) {
  //       try {
  //         console.log(
  //           `[ROUTE] Pesan Umum/Bot terdeteksi. Meneruskan ke Webhook Bot: ${user.webhookBotUrl}`,
  //         );

  //         // Kirim payload ke server bot eksternal milik konsumen
  //         await axios.post(
  //           user.webhookBotUrl,
  //           {
  //             userId: user._id,
  //             from: from,
  //             pushName: msg.pushName || "WhatsApp User",
  //             messageId: msg.key.id,
  //             text: text,
  //             timestamp: msg.messageTimestamp,
  //             rawMessage: msg, // data full object bawaan baileys (berjaga-jaga jika bot mereka butuh data extra)
  //           },
  //           { timeout: 5000 },
  //         ); // Timeout 5 detik agar tidak menyumbat antrean gateway jika server bot mereka down
  //       } catch (error) {
  //         console.error(
  //           `[WEBHOOK BOT ERROR] Gagal mengirim ke ${user.webhookBotUrl}:`,
  //           error.message,
  //         );
  //       }
  //     }
  //   }

  //   // 🏓 Fitur Testing Ping-Pong bawaan kamu (Tetap dipertahankan di luar jalur webhook)
  //   if (text?.toLowerCase() === "ping") {
  //     await sock.sendMessage(from, {
  //       text: "pong 🏓",
  //     });
  //   }
  // });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;

    // 1. Ambil teks mentah pesan secara aman
    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const messageType = Object.keys(msg.message)[0];

    // 2. Daftar prefiks resmi untuk sistem Akuntansi kamu
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

    // 3. Klasifikasikan tipe pesan masuk (Boolean)
    const isLocation =
      messageType === "locationMessage" ||
      messageType === "liveLocationMessage";
    const isAccounting = validPrefixes.some((prefix) =>
      text.startsWith(prefix),
    );

    // ========================================================
    // ⚡ SOLUSI JITU: AMBIL DATA USER PALING FRESH DARI DB
    // ========================================================
    // Ini memastikan URL Webhook yang dibaca selalu yang paling baru setelah diganti di FE
    let currentUser = user;
    try {
      const freshUser = await User.findById(userId);
      if (freshUser) {
        currentUser = freshUser; // Timpa dengan data paling up-to-date
      }
    } catch (dbErr) {
      console.error(
        "[DB ERROR] Gagal mengambil data user terbaru, menggunakan cache lama:",
        dbErr.message,
      );
    }

    // ========================================================
    // SELEKSI JALUR WEBHOOK (MENGGUNAKAN currentUser)
    // ========================================================

    if (isLocation) {
      console.log(
        `[ROUTE] Pesan Lokasi dari ${from}. Meneruskan ke Handler Lokasi.`,
      );
      // Gunakan currentUser agar webhookUrl terbaru yang terkirim
      await handleLocationMessage(sock, msg, from, currentUser);
    } else if (isAccounting) {
      console.log(
        `[ROUTE] Pesan Akuntansi terdeteksi dari ${from}. Meneruskan ke Handler Akuntansi.`,
      );
      // Gunakan currentUser agar webhookUrl terbaru yang terkirim
      await handleAccountingMessage(sock, msg, from, currentUser);
    } else {
      // JALUR BOT (PESAN UMUM)
      if (
        currentUser &&
        currentUser.webhookBotUrl &&
        (messageType === "conversation" ||
          messageType === "extendedTextMessage")
      ) {
        try {
          console.log(
            `[ROUTE] Pesan Umum/Bot meneruskan ke Webhook: ${currentUser.webhookBotUrl}`,
          );

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
          console.error(
            `[WEBHOOK BOT ERROR] Gagal mengirim ke ${currentUser.webhookBotUrl}:`,
            error.message,
          );
        }
      }
    }

    // Fitur Testing Ping-Pong bawaan kamu
    if (text?.toLowerCase() === "ping") {
      const replyMsg = "pong 🏓";

      // 1. Kirim pesan ke WhatsApp dan tampung hasilnya ke variabel
      const result = await sock.sendMessage(from, { text: replyMsg });

      // 2. 🟢 PANGGIL HELPER LOG (Satu baris, super rapi!)
      if (currentUser) {
        await saveBotReplyLog(currentUser._id, from, replyMsg, result);
      }
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

// export function getClient(userId) {
//   return clients[userId];
// }

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
