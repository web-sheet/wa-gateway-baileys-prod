import mongoose from "mongoose";

const messageLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: String, required: true },
  messageType: { type: String, enum: ["text", "image", "document"], default: "text" },
  message: { type: String, default: "" },       // Isi teks atau caption media
  mediaUrl: { type: String, default: null },     // URL Gambar / PDF
  fileName: { type: String, default: null },     // Nama file khusus dokumen
  status: { type: String, enum: ["pending", "sent", "failed", "scheduled"], default: "pending" },
  messageId: { type: String, default: null },    // 🔑 ID unik dari Baileys untuk tracking status
  errorReason: { type: String, default: null },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 60 * 60 * 24 * 7 // 🕒 Auto-delete setelah 7 hari
  }
});

// Indexing agar pencarian cepat
messageLogSchema.index({ userId: 1, createdAt: -1 });
messageLogSchema.index({ messageId: 1 });

export const MessageLog = mongoose.model("MessageLog", messageLogSchema);