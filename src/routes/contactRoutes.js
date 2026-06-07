import express from "express";
import { syncContacts, getContactsPage } from "../controllers/contactController.js";

const router = express.Router();

// Route untuk menampilkan halaman dashboard tabel kontak
router.get("/contacts", getContactsPage);

// 🎯 UBAH MENJADI .get AGAR SINKRON DENGAN FETCH DI UI
router.get("/contacts/sync", syncContacts);

export default router;