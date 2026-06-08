import { Post } from "../models/Post.js";

// 1. Menampilkan Form Input Artikel (Khusus Admin)
// 1. Menampilkan Halaman Manajemen Blog (Form + Tabel Daftar Artikel)
export const showCreateForm = async (req, res) => {
  try {
    // Ambil semua artikel milik admin (baik draft maupun published), urutkan dari yang terbaru
    const articles = await Post.find().sort({ createdAt: -1 });
   
    res.render("blog/create", {
      title: "Manajemen Blog - Websheet Gateway",
      user: req.session.user,
      path: req.path,
      articles, // 🎯 Kirim data artikel ke file EJS
    });
  } catch (error) {
    console.error("Gagal memuat halaman manajemen blog:", error);
    return res.status(500).send("Terjadi kesalahan pada server.");
  }
};

// 2. Menyimpan Artikel Baru ke Database
export const storePost = async (req, res) => {
  try {
    const { title, metaDesc, content, status } = req.body;

    // ⚡ PROSES OTOMATISASI SLUG (SEO Friendly URL)
    // Contoh: "Cara Menggunakan REST API!" -> "cara-menggunakan-rest-api"
    let slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Hapus semua karakter khusus/simbol kecuali spasi dan minus
      .replace(/\s+/g, "-") // Ubah semua spasi menjadi satu tanda minus
      .replace(/-+/g, "-"); // Bersihkan jika ada tanda minus ganda yang berdampingan

    // 🛡️ Antisipasi jika slug ternyata kembar di database
    const existingPost = await Post.findOne({ slug });
    if (existingPost) {
      // Jika kembar, tambahkan timestamp unik di belakangnya agar tetap unik
      slug = `${slug}-${Date.now()}`;
    }

    // Simpan data ke MongoDB menggunakan model Post
    const newPost = new Post({
      title,
      slug,
      content,
      metaDesc,
      status,
      author: req.session.user._id, // Mengambil ID admin yang sedang login dari session
    });

    await newPost.save();

    // Jika sukses, alihkan kembali ke halaman manajemen blog (atau dashboard)
    // Sementara kita redirect ke halaman form lagi dengan penanda sukses
    return res.redirect("/dashboard/blog/create?success=true");
  } catch (error) {
    console.error("Gagal menyimpan artikel blog:", error);
    return res
      .status(500)
      .send("Terjadi kesalahan internal saat menyimpan artikel.");
  }
};

// 3. Menampilkan Detail Artikel untuk Publik (Berdasarkan Slug)
export const showDetailPost = async (req, res) => {
  try {
    const { slug } = req.params;

    // Cari artikel di MongoDB yang statusnya 'published' dan slug-nya cocok
    const article = await Post.findOne({ slug, status: "published" }).populate(
      "author",
      "username",
    );

    // Jika artikel tidak ditemukan atau masih berupa draft, lempar ke halaman 404
    if (!article) {
      return res
        .status(404)
        .send("Maaf, artikel tidak ditemukan atau telah dihapus.");
    }

    // Render halaman detail dengan data artikel
    res.render("blog/detail", {
      article,
      title: `${article.title} - Websheet Gateway Blog`,
      metaDesc: article.metaDesc, // Dikirim ke layout untuk tag <meta description>
      layout: "layout-public", // 🎯 Menggunakan layout publik khusus (Tanpa Sidebar Dashboard)
    });
  } catch (error) {
    console.error("Gagal memuat artikel blog:", error);
    return res.status(500).send("Terjadi kesalahan internal pada server.");
  }
};
// 4. Menampilkan Halaman Utama Blog (Daftar Semua Artikel dengan Paginasi)
export const showAllPosts = async (req, res) => {
  try {
    // 1. Tentukan halaman aktif (default: halaman 1) dan batas artikel per halaman
    const page = parseInt(req.query.page) || 1;
    const limit = 6; // Kamu bisa ubah angka ini sesuai selera (misal: 6, 9, atau 12)
    const skip = (page - 1) * limit;

    // 2. Hitung total artikel yang terbit (untuk kalkulasi jumlah halaman)
    const totalArticles = await Post.countDocuments({ status: "published" });
    const totalPages = Math.ceil(totalArticles / limit);

    // 3. Ambil data artikel yang sudah dipotong (pagination)
    const articles = await Post.find({ status: "published" })
      .populate("author", "username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 4. Render ke EJS dengan membawa data paginasi
    res.render("blog/index", {
      articles,
      currentPage: page,
      totalPages,
      totalArticles,
      title: "Blog & Tutorial - Websheet Gateway",
      metaDesc: "Pusat panduan, tutorial, dan tips seputar otomatisasi Google Sheets, AppSheet, dan WhatsApp API Gateway.",
      layout: "layout-public",
    });
  } catch (error) {
    console.error("Gagal memuat daftar blog:", error);
    return res.status(500).send("Terjadi kesalahan pada server.");
  }
};

// 5. Menghapus Artikel Blog (Khusus Admin)
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    // Cari dan hapus artikel berdasarkan ID-nya di MongoDB
    await Post.findByIdAndDelete(id);

    // Kembali ke halaman manajemen dengan tanda sukses dihapus (?deleted=true)
    return res.redirect("/dashboard/blog/create?deleted=true");
  } catch (error) {
    console.error("Gagal menghapus artikel:", error);
    return res
      .status(500)
      .send("Terjadi kesalahan internal saat menghapus data.");
  }
};

// 6. Menampilkan Form Edit Artikel (Khusus Admin)
export const showEditForm = async (req, res) => {
  try {
    const { id } = req.params;
    const article = await Post.findById(id);

    if (!article) {
      return res.status(404).send("Artikel tidak ditemukan.");
    }

    res.render("blog/edit", {
      title: "Edit Artikel - Websheet Gateway",

      article,
      user: req.session.user,
      path: req.path,
    });
  } catch (error) {
    console.error("Gagal memuat form edit blog:", error);
    return res.status(500).send("Terjadi kesalahan pada server.");
  }
};

// 7. Memproses Pembaruan Artikel di Database
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, metaDesc, content, status } = req.body;

    // Generate slug baru yang diperbarui dari judul baru
    let slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    // Pastikan slug tidak bentrok dengan artikel LAIN
    const existingPost = await Post.findOne({ slug, _id: { $ne: id } });
    if (existingPost) {
      slug = `${slug}-${Date.now()}`;
    }

    // Update data di MongoDB
    await Post.findByIdAndUpdate(id, {
      title,
      slug,
      content,
      metaDesc,
      status,
    });

    // Lempar kembali ke halaman utama manajemen blog dengan query success
    return res.redirect("/dashboard/blog/create?success=true");
  } catch (error) {
    console.error("Gagal memperbarui artikel:", error);
    return res
      .status(500)
      .send("Terjadi kesalahan internal saat memperbarui data.");
  }
};
