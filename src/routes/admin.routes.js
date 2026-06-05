import express from "express";
import { adminDashboard, deleteUser } from "../controllers/admin.controller.js";
import { authRequired, adminOnly } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/admin", authRequired, adminOnly, adminDashboard);
router.get("/admin/delete/:id", authRequired, adminOnly, deleteUser);

export default router;
