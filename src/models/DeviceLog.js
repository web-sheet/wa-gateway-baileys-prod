import mongoose from "mongoose";

const DeviceLogSchema = new mongoose.Schema(
  {
    // Menghubungkan log ini ke ID User dari skema yang sudah kamu punya
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // Nomor WhatsApp yang sedang diproses (opsional, untuk mempermudah filter)
    waNumber: {
      type: String,
      required: true,
    },

    // Status koneksi saat event terjadi
    status: {
      type: String,
      enum: ["connecting", "connected", "disconnected"],
      required: true,
    },

    // Alasan mendetail (misal: "Logged Out", "Connection Lost", "Sesi berhasil dibuka")
    reason: {
      type: String,
      required: true,
    },
  },
  { 
    // Otomatis membuat kolom 'createdAt' dan 'updatedAt'
    // 'createdAt' nanti akan berfungsi sebagai waktu/jam kejadian log
    timestamps: true 
  }
);

export const DeviceLog = mongoose.model("DeviceLog", DeviceLogSchema);