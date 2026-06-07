import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Indexing untuk pencarian cepat per user
    },
    jid: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: "Tanpa Nama",
    },
    idKontakWa: {
      type: String, // ID kontak bawaan dari Baileys store jika diperlukan
    }
  },
  { timestamps: true }
);

// Mengunci keunikan: Satu user tidak boleh menyimpan JID yang sama dua kali
contactSchema.index({ userId: 1, jid: 1 }, { unique: true });

export const Contact = mongoose.model("Contact", contactSchema);