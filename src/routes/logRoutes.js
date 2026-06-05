import express from "express";
import { MessageLog } from "../models/MessageLog.js";
// Import middleware autentikasi yang sama dengan rute connect kamu
import { authRequired } from "../middlewares/auth.middleware.js";
// Import kedua fungsi dari controller kamu
import {getUserLogsJson } from "../controllers/log.controller.js";

const router = express.Router();

 
router.get("/wa/logs", authRequired, getUserLogsJson);

export default router;