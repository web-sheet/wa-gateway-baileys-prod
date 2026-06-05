// handlers/accountingHandler.js

export async function handleAccountingMessage(sock, msg, from) {
  // 1. Ambil teks pesan dari berbagai kemungkinan tipe chat di Baileys
  const messageBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

  // 2. Cek apakah pesan diawali dengan kata "hitung" (tidak peduli huruf besar/kecil)
  if (!messageBody.toLowerCase().startsWith("hitung")) return;

  // Potong kata "hitung " di depan (mengambil ekspresi matematikanya saja)
  const expression = messageBody.slice(6).trim(); 
  if (!expression) {
    await sock.sendMessage(from, { text: "Silakan masukkan angka yang ingin dihitung.\nContoh: *hitung 500,000 + 10%*" }, { quoted: msg });
    return;
  }

  // 3. Jalankan kalkulator
  const result = calculateExpression(expression);
  const formatMessage = formatNumbersInString(expression);

  // 4. Kirim balasan ke user/grup dengan fitur QUOTED (REPLY CHAT)
  await sock.sendMessage(from, { 
    text: `Hasil: ${formatMessage} = ${result}` 
  }, { 
    quoted: msg // ✨ Ini yang bikin bot membalas sambil mengutip pesan user
  });
}

// ==========================================
// 🧮 FUNGSI MATEMATIKA (DIBAWA DARI KODE LAMA KAMU)
// ==========================================

function calculateExpression(expression) {
  // Bersihkan pemisah ribuan titik/koma dari user sebelum di-eval (misal: 500.000 menjadi 500000)
  // Menyesuaikan input akuntansi Indonesia yang sering pakai titik atau koma untuk ribuan
  let cleanExpression = expression.replace(/[,.]/g, (match, offset, string) => {
    // Cek jika titik/koma bertindak sebagai desimal (diikuti kurang dari 3 angka di akhir)
    const postMatch = string.slice(offset + 1);
    if (/^\d{1,2}$/.test(postMatch.split(/[+\-*/\s%]/)[0])) {
      return '.'; // jadikan desimal standar javascript
    }
    return ''; // hapus jika itu ribuan
  });

  cleanExpression = cleanExpression.replace(/\s*x\s*/g, '*');
  
  // Validasi karakter aman
  const validExpression = /^[0-9+\-*/().\s%]+$/;
  if (!validExpression.test(cleanExpression)) {
    return "Format salah / Karakter tidak diizinkan";
  }

  // Handle persentase
  cleanExpression = cleanExpression.replace(/(\d+)%/g, '($1 / 100)');

  try {
    // Jalankan kalkulasi
    const result = eval(cleanExpression);
    return formatNumber(result);
  } catch (error) {
    console.error('Error evaluating expression:', error);
    return "Error perhitungan";
  }
}

function formatNumber(num) {
  if (isNaN(num)) return "Bukan angka valid";
  // Memformat hasil akhir dengan pemisah ribuan koma
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatNumbersInString(str) {
  // Fungsi pembantu bawaan kamu untuk merapikan tampilan ekspresi matematika
  return str; 
}