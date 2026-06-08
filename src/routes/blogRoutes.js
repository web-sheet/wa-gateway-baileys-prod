import express from "express";
import * as blogController from "../controllers/blogController.js";
import { authRequired } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * 🔒 AREA DASHBOARD ADMIN (Menggunakan Layout Utama/Dashboard)
 * Rute-rute di bawah ini dilindungi oleh middleware 'isAdmin'
 */
// Menampilkan form untuk menulis artikel baru
router.get("/dashboard/blog/create", authRequired, blogController.showCreateForm);

// Memproses penyimpanan data artikel baru dari form ke database
router.post("/dashboard/blog/store", authRequired, blogController.storePost);

// Menghapus artikel berdasarkan ID (Khusus Admin)
router.post("/dashboard/blog/delete/:id", authRequired, blogController.deletePost);


/**
 * 🌐 AREA PUBLIK (Menggunakan Layout Publik / Tanpa Sidebar)
 * Rute ini bisa diakses oleh siapapun (termasuk bot Google untuk SEO)
 */
// Menampilkan detail isi artikel berdasarkan slug-nya
router.get("/blog/:slug", blogController.showDetailPost);
// Menampilkan daftar semua artikel blog (Halaman Utama Blog)
router.get("/blog", blogController.showAllPosts);


// Rute untuk menampilkan halaman edit
router.get("/dashboard/blog/edit/:id", authRequired, blogController.showEditForm);

// Rute untuk memproses perubahan data edit
router.post("/dashboard/blog/update/:id", authRequired, blogController.updatePost);

export default router;