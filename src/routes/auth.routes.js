import express from "express";
import {
  showLogin,
  showRegister,
  register,
  login,
  logout,
  loginLimiter
} from "../controllers/auth.controller.js";

const router = express.Router();

router.get("/login", showLogin);
router.post("/login",loginLimiter, login);

router.get("/register", showRegister);
router.post("/register", register);

router.get("/logout", logout);

export default router;
