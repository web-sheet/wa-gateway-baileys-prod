
import { saveBotReplyLog } from "../../helpers/botLogHelper.js";
// 📝 FUNGSI UNTUK MENGIRIM DATA KE GOOGLE APPS SCRIPT
async function logMessageToGoogleSheets(webhookUrl, payload) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Kita tangkap hasilnya langsung dari response POST
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error logging message to Google Sheets:", error);
    return null;
  }
}
 


// 🤖 MAIN HANDLER UNTUK BAILEYS
export async function handleAccountingMessage(sock, msg, from, user) {
  const messageBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

  // Ambil identifier pengirim asli (Bisa nomor atau ID LID)
  let rawJid = from;
  if (from.endsWith("@g.us")) {
    rawJid = msg.key.participant || from;
  } else if (from.endsWith("@lid")) {
    rawJid = msg.key.participant || msg.participant || from;
  }
  let sender = rawJid.split("@")[0];

  // 🔍 BYPASS @LID KODE (Terjemahkan nomor jika tersinkronisasi)
  if (rawJid.endsWith("@lid")) {
    try {
      const contactInfo = (await sock.getContact?.(rawJid)) || (await sock.getContactInfo?.(rawJid));
      if (contactInfo?.jid?.endsWith("@s.whatsapp.net")) {
        sender = contactInfo.jid.split("@")[0];
      }
    } catch (err) {
      // Jika gagal, variabel sender tetap menggunakan ID LID numerik panjang
    }
  }

  // 📌 LOGIKA 1: JIKA USER MEMAKAI FITUR "HITUNG" KALKULATOR
  if (messageBody.toLowerCase().startsWith("hitung")) {
    const expression = messageBody.slice(6).trim();
    
    if (!expression) {
      await sock.sendPresenceUpdate("composing", from);
      const instructionText = "Silakan masukkan angka yang ingin dihitung.\nContoh: *hitung 500.000 + 10%*";
      
      const result = await sock.sendMessage(
        from,
        { text: instructionText },
        { quoted: msg }
      );
      await sock.sendPresenceUpdate("paused", from); // Matikan pengetikan

      // 🟢 LOG 1: Catat pesan petunjuk kalkulator
      if (user) await saveBotReplyLog(user._id, from, instructionText, result);
      return;
    }

    // Jalankan penghitungan kalkulator
    await sock.sendPresenceUpdate("composing", from);
    const resultCalc = calculateExpression(expression);
    const formatMessage = expression; 
    const replyCalcText = `Hasil: ${formatMessage} = ${resultCalc}`;

    const result = await sock.sendMessage(
      from,
      { text: replyCalcText },
      { quoted: msg }
    );
    await sock.sendPresenceUpdate("paused", from); // Matikan pengetikan

    // 🟢 LOG 2: Catat hasil perhitungan kalkulator
    if (user) await saveBotReplyLog(user._id, from, replyCalcText, result);
    return;
  }

  // 📌 LOGIKA 2: JIKA USER MENGIRIM NOTASI AKUNTANSI UNTUK SHEET (/d, /add, Paid, dll.)
  const validPrefixes = ["/d", "/add", "Paid", "paid", "Settle", "settle", "ccl"];
  const isValidMessage = validPrefixes.some((prefix) => messageBody.startsWith(prefix));

  if (isValidMessage && user.webhookUrl) {
    // Menyalakan status "sedang mengetik"
    await sock.sendPresenceUpdate("composing", from);
    
    let groupName = "Personal Chat";
    let senderPayload = sender; 

    if (from.endsWith("@g.us")) {
      senderPayload = from.split("@")[0];
      try {
        const groupMetadata = await sock.groupMetadata(from);
        groupName = groupMetadata.subject;
      } catch (e) {
        groupName = "Unknown Group";
      }
    }

    // Bungkus payload data
    const payload = {
      sender: senderPayload,
      groupName: groupName,
      message: messageBody,
    };

    // Tembak ke Google Apps Script Webhook
    console.log(`[ACCOUNTING LOG] Mengirim data nota dari ${sender} ke Sheets...`);
    
    const sheetResponse = await logMessageToGoogleSheets(user.webhookUrl, payload);
    console.log(sheetResponse);

    // Jika Apps Script mengembalikan teks balasan rekap (response)
    if (sheetResponse && sheetResponse.response) {
      const replyText = sheetResponse.response.replace(/\\n/g, "\n");
      
      // 📴 Matikan status mengetik
      await sock.sendPresenceUpdate("paused", from);

      // Kirim balik rekap keuangan ke WhatsApp (Reply ke user)
      const result = await sock.sendMessage(from, { text: replyText }, { quoted: msg });

      // 🟢 LOG 3: Catat balasan rekap akuntansi dari Google Sheets
      if (user) await saveBotReplyLog(user._id, from, replyText, result);
    } else {
      // Jaga-jaga jika response kosong, status mengetik harus tetap mati
      await sock.sendPresenceUpdate("paused", from);
    }
  }
}

// ==========================================
// 🧮 FUNGSI MATEMATIKA KALKULATOR BEKAS WWEBJS
// ==========================================
function calculateExpression(expression) {
  let cleanExpression = expression.replace(/[,.]/g, (match, offset, string) => {
    const postMatch = string.slice(offset + 1);
    if (/^\d{1,2}$/.test(postMatch.split(/[+\-*/\s%]/)[0])) {
      return ".";
    }
    return "";
  });

  cleanExpression = cleanExpression.replace(/\s*x\s*/g, "*");
  const validExpression = /^[0-9+\-*/().\s%]+$/;
  if (!validExpression.test(cleanExpression)) return "Format salah";

  cleanExpression = cleanExpression.replace(/(\d+)%/g, "($1 / 100)");

  try {
    const result = eval(cleanExpression);
    return numToStringFormat(result);
  } catch (error) {
    return "Error perhitungan";
  }
}

function numToStringFormat(num) {
  if (isNaN(num)) return "Bukan angka valid";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
