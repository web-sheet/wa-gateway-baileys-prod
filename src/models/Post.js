import mongoose from "mongoose";

const PostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    
    slug: {
      type: String,
      required: true,
      unique: true, // 🎯 Sangat penting untuk SEO agar tidak ada URL kembar
      trim: true,
    },
    
    content: {
      type: String,
      required: true, // Akan menampung data HTML mentah dari Text Editor
    },
    
    metaDesc: {
      type: String,
      required: true,
      maxLength: 160, // Batasan standar Google agar tidak terpotong di hasil pencarian
      trim: true,
    },
    
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft", // Default disimpan sebagai draft terlebih dahulu demi keamanan
    },
    
    // Opsional: Untuk mencatat admin mana yang menulis artikel ini
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true } // Otomatis membuat kolom createdAt dan updatedAt
);

export const Post = mongoose.model("Post", PostSchema);