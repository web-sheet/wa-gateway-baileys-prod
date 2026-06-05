import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true },
    password: String,

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    waNumber: {
      type: String,
      default: null,
    },

    waStatus: {
      type: String,
      enum: ["disconnected", "connecting", "connected"],
      default: "disconnected",
    },

    apiKey: {
      type: String,
      unique: true,
      sparse: true,
    },

    webhookUrl: {
      type: String,
      default: null,
    },

    // 🟢 Webhook 2: Ditambahkan khusus untuk Bot / Pesan Umum Baru
    webhookBotUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", UserSchema);
