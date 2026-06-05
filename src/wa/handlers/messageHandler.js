// handlers/messageHandler.js
import { saveBotReplyLog } from "../../helpers/botLogHelper.js";

export async function handleLocationMessage(sock, msg, from, user) {
  // 🔍 1. TANGKAP INPUT (Bisa lokasi biasa atau live location)
  const isLive = !!msg.message?.liveLocationMessage;
  const rawLocation =
    msg.message?.locationMessage || msg.message?.liveLocationMessage;

  // Jika dua-duanya kosong, langsung keluar
  if (!rawLocation) return;

  // 🎭 2. PENYAMARAN: Bungkus data agar formatnya selalu seperti lokasi biasa/statis
  const location = {
    degreesLatitude: rawLocation.degreesLatitude,
    degreesLongitude: rawLocation.degreesLongitude,
    // Jika live location, set default text atau gunakan caption sebagai alamat/nama jika ada
    address: isLive
      ? rawLocation.caption || "Live Location Share"
      : rawLocation.address,
    name: isLive ? "Live Location" : rawLocation.name,
  };

  // 3. Tentukan JID Mentah Pengirim
  let rawJid = from;
  if (from.endsWith("@g.us")) {
    rawJid = msg.key.participant || from;
  } else if (from.endsWith("@lid")) {
    rawJid = msg.key.participant || msg.participant || from;
  }

  let sender = rawJid.split("@")[0];

  // 🔍 4. JIKA TERDETEKSI @LID, PAKSA BAILEYS MENERJEMAHKAN KE NOMOR ASLI
  if (rawJid.endsWith("@lid")) {
    try {
      const contactInfo =
        (await sock.getContact?.(rawJid)) ||
        (await sock.getContactInfo?.(rawJid));
      if (
        contactInfo &&
        contactInfo.jid &&
        contactInfo.jid.endsWith("@s.whatsapp.net")
      ) {
        sender = contactInfo.jid.split("@")[0];
      }
    } catch (err) {
      console.log("[LID BYPASS] Gagal menerjemahkan LID secara otomatis.");
    }
  }

  // Mengambil data dari objek hasil penyamaran di langkah 2
  const latitude = location.degreesLatitude;
  const longitude = location.degreesLongitude;
  const url = location.address;
  const name = location.name;

  console.log(
    `[LOCATION MAPPER] Tipe Asli: ${isLive ? "LIVE" : "STATIC"}. Terbaca sebagai lokasi biasa untuk: ${sender}`,
  );
  console.log(user.webhookUrl);

  if (user.webhookUrl) {
    try {
      // Mengirim POST dengan format yang selalu seragam ke webhook kamu
      const postResponse = await fetch(user.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender,
          latitude,
          longitude,
          url,
          name,
        }),
      });

      const response = await fetch(`${user.webhookUrl}?query=${sender}`);
      const data = await response.json();

      console.log("Response dari webhook:", data.response);

      if (data.response) {
        const replyText = data.response.replace(/\\n/g, "\n");

        const result = await sock.sendMessage(
          from,
          {
            text: replyText,
          },
          {
            quoted: msg,
          },
        );

        // 2. 🟢 LOG DI SINI: Catat ke DB menggunakan objek 'user' dari parameter
        if (user) {
          await saveBotReplyLog(user._id, from, replyText, result);
        }
      }
    } catch (error) {
      console.error(
        `Gagal memproses webhook/kirim pesan untuk ${sender}:`,
        error.message,
      );
    }
  }
}
