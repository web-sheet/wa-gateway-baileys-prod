// import Autoreply from "../../models/Autoreply.js";
// // 🎯 FIX IMPORT: Ambil seluruh modul Baileys sebagai satu objek global
// import * as baileys from "@whiskeysockets/baileys";

// /**
//  * Handler Otomatis Autoreply untuk Baileys v7.0.0+ (Solusi Final Gagal Import)
//  */
// export const handleAutoreplyMessage = async (sock, { messages }, userId) => {
//   try {
//     const msg = messages?.[0];
//     if (!msg || !msg.message || msg.key.fromMe) return false;

//     const incomingText =
//       msg.message.conversation || msg.message.extendedTextMessage?.text || "";
//     const cleanText = incomingText.toLowerCase().trim();
//     if (!cleanText) return false;

//     const remoteJid = msg.key.remoteJid;

//     if (remoteJid.endsWith("@g.us")) return false;

//     const matchReply = await Autoreply.findOne({
//       userId: userId,
//       keyword: cleanText,
//     });

//     if (matchReply) {
//       // ========================================================
//       // 📝 OPSI A: Jika Tipe Balasan adalah Teks Murni
//       // ========================================================
//       if (matchReply.replyType === "text") {
//         await sock.sendMessage(remoteJid, { text: matchReply.replyContent });
//         console.log(
//           `[Autoreply] Sukses membalas TEKS untuk keyword: "${cleanText}"`,
//         );
//         return true;
//       }

//       // ========================================================
//       // 📋 OPSI B: Jika Tipe Balasan adalah Tombol List Message
//       // ========================================================
//       else if (matchReply.replyType === "list") {
//         const { buttonText, sections } = matchReply.listData || {};

//         if (
//           !sections ||
//           sections.length === 0 ||
//           !sections[0].rows ||
//           sections[0].rows.length === 0
//         ) {
//           await sock.sendMessage(remoteJid, { text: matchReply.replyContent });
//           return true;
//         }

//         const formattedSections = sections.map((sec) => ({
//           title: sec.title || "Daftar Pilihan",
//           rows: sec.rows.map((row) => ({
//             header: "",
//             title: row.title,
//             description: row.description || "",
//             id: row.rowId || `id_${Date.now()}`,
//           })),
//         }));

//         // 🎯 STRUKTUR REGULER (Tanpa viewOnceMessage agar tidak di-drop Meta)
//         const msgContent = {
//           interactiveMessage: {
//             body: { text: matchReply.replyContent },
//             footer: { text: "Websheet Gateway" },
//             header: { title: "Pilih Menu Utama", hasMediaAttachment: false },
//             nativeFlowMessage: {
//               buttons: [
//                 {
//                   name: "single_select",
//                   buttonParamsJson: JSON.stringify({
//                     title: buttonText || "Buka Menu",
//                     sections: formattedSections,
//                   }),
//                 },
//               ],
//             },
//           },
//         };

//         // 🎯 DETEKSI FUNGSI SECARA DINAMIS (Anti-Error Versi Beda/Baru)
//         // Kita cari fungsi generateWAMessageFromContent di semua kemungkinan tempat eksport Baileys v7
//         const generateMessage =
//           baileys.generateWAMessageFromContent ||
//           baileys.default?.generateWAMessageFromContent;

//         // Jaga-jaga jika Baileys v7 memindahkannya ke dalam internal object class sock langsung
//         const finalGenerate =
//           generateMessage || sock.generateWAMessageFromContent;

//         if (!finalGenerate) {
//           throw new Error(
//             "Fungsi 'generateWAMessageFromContent' benar-benar tidak ditemukan di library Baileys kamu.",
//           );
//         }

//         // Jalankan fungsi generate message yang asli
//         const waMessage = finalGenerate(remoteJid, msgContent, {
//           userJid: sock.user.id,
//           quoted: msg,
//         });

//         // Tembak menggunakan relayMessage
//         await sock.relayMessage(remoteJid, waMessage.message, {
//           messageId: waMessage.key.id,
//         });

//         console.log(
//           `[Autoreply] Sukses membalas TOMBOL LIST untuk keyword: "${cleanText}"`,
//         );
//         return true;
//       }
//     }

//     return false;
//   } catch (error) {
//     console.error("Error fatal di dalam Autoreply Handler:", error);
//     return false;
//   }
// };

import Autoreply from "../../models/Autoreply.js";

/**
 * Handler Autoreply - Versi Murni Teks (Fitur List Dihapus)
 */
export const handleAutoreplyMessage = async (sock, { messages }, userId) => {
  try {
    const msg = messages?.[0];
    // Validasi dasar: pastikan ada pesan, bukan dari bot sendiri
    if (!msg || !msg.message || msg.key.fromMe) return false;

    // Ambil teks masuk dari chat personal biasa maupun dari reply/quote text
    const incomingText =
      msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const cleanText = incomingText.toLowerCase().trim();
    if (!cleanText) return false;

    const remoteJid = msg.key.remoteJid;

    // Proteksi: Abaikan jika pesan masuk dari dalam Group WA
    if (remoteJid.endsWith("@g.us")) return false;

    // Cari keyword yang cocok milik user yang bersangkutan
    const matchReply = await Autoreply.findOne({
      userId: userId,
      keyword: cleanText,
    });

    // Jika keyword ditemukan
    if (matchReply) {
      // Kirim isi pesan teks murni ke target
      await sock.sendMessage(
        remoteJid,
        { text: matchReply.replyContent },
        { quoted: msg },
      );
      console.log(`[Autoreply] Sukses membalas kata kunci: "${cleanText}"`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error di dalam Autoreply Handler:", error);
    return false;
  }
};
