import Autoreply from "../models/Autoreply.js";

// 1. Menampilkan Halaman Utama & Daftar Data
export const getAutoreplyPage = async (req, res) => {
  try {
    const replies = await Autoreply.find({
      userId: req.session.user._id,
    }).sort({
      createdAt: -1,
    });

    res.render("user/autoreply", {
      user: req.session.user,
      replies: replies,
      path: req.path,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

// 2. Menambah Data Baru (Sinkronisasi UI + Database + Proteksi)
export const createAutoreply = async (req, res) => {
  try {
    const {
      keyword,
      replyType,
      replyContent,
      buttonText,
      rowTitles,
      rowDescriptions,
      rowIds, // 🎯 SEKARANG DITANGKAP: Ambil data input ID dari UI EJS
    } = req.body;

    const newReply = {
      userId: req.session.user._id,
      keyword: keyword.toLowerCase().trim(),
      replyType,
      replyContent,
    };

    if (replyType === "list") {
      // 🎯 FIX 1: Deklarasikan array penampung di atas sebelum proses loop
      const rows = [];

      // Jika input dari UI berupa array (Lebih dari 1 baris menu)
      if (Array.isArray(rowTitles)) {
        for (let i = 0; i < rowTitles.length; i++) {
          if (rowTitles[i] && rowTitles[i].trim() !== "") {
            rows.push({
              title: rowTitles[i].trim(),
              // 🎯 SINKRON: Pakai ID dari UI jika diisi, jika kosong baru buat otomatis
              rowId:
                rowIds[i] && rowIds[i].trim() !== ""
                  ? rowIds[i].trim()
                  : `id_${Date.now()}_${i}`,
              description: rowDescriptions[i] ? rowDescriptions[i].trim() : "",
            });
          }
        }
      } else if (rowTitles && rowTitles.trim() !== "") {
        // Jika input dari UI berupa string tunggal (Hanya 1 baris menu)
        rows.push({
          title: rowTitles.trim(),
          // 🎯 SINKRON: Pakai ID dari UI jika diisi, jika kosong baru buat otomatis
          rowId:
            rowIds && rowIds.trim() !== "" ? rowIds.trim() : `id_${Date.now()}`,
          description: rowDescriptions ? rowDescriptions.trim() : "",
        });
      }

      // 🎯 FIX 2: Validasi ditaruh di bawah setelah rows diproses
      if (rows.length === 0) {
        return res.status(400).send("Minimal 1 pilihan menu harus diisi");
      }

      newReply.listData = {
        buttonText: buttonText || "Lihat Menu",
        sections: [{ title: "Daftar Pilihan", rows: rows }],
      };
    }

    await Autoreply.create(newReply);
    res.redirect("/dashboard/autoreply");
  } catch (error) {
    console.error("Error createAutoreply:", error);
    res.status(500).send("Gagal menambah autoreply");
  }
};

// 3. Menghapus Data
export const deleteAutoreply = async (req, res) => {
  try {
    await Autoreply.findOneAndDelete({
      _id: req.params.id,
      userId: req.session.user._id,
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Gagal menghapus" });
  }
};
