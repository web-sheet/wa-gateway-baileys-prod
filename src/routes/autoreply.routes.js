import express from "express";
import { 
  getAutoreplyPage, 
  createAutoreply, 
  deleteAutoreply 
} from "../controllers/autoreply.controller.js";
import { authRequired } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Halaman utama manajemen autoreply
router.get("/dashboard/autoreply", authRequired, getAutoreplyPage);

// Aksi untuk menambah data baru
router.post("/dashboard/autoreply", authRequired, createAutoreply);

// Aksi untuk menghapus data
router.delete("/dashboard/autoreply/:id", authRequired, deleteAutoreply);

export default router;