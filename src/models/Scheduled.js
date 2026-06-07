import mongoose from "mongoose";

const scheduledSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  totalTarget: { type: Number, required: true },
  success: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  repeatType: {
    type: String,
    enum: ["once", "daily", "weekly"],
    default: "once",
  },
  status: {
    type: String,
    enum: ["scheduled", "running", "completed"],
    default: "scheduled",
  },
  scheduledAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  // Cukup gunakan model Scheduled yang kemarin, tinggal lengkapi fieldnya:
  sendType: { type: String, enum: ["chat", "status"], default: "chat" },
  mediaUrl: { type: String, default: null }, // Menyimpan path gambar status jika ada
});

const Scheduled = mongoose.model("Scheduled", scheduledSchema);
export default Scheduled;
