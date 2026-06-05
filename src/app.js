import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import sessionConfig from "./config/session.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import userRoutes from "./routes/user.routes.js";
import apiRoutes from "./routes/api.js";
import logRoutes from "./routes/logRoutes.js";
import { authRequired } from "./middlewares/auth.middleware.js";
import http from "http";
import { initSocket } from "./wa/socket/io.js";
import { restoreSessions } from "./wa/wa.js";

import path from "path";
import { fileURLToPath } from "url";

// Definisikan __dirname terlebih dahulu jika menggunakan ES Module (import/export)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const server = http.createServer(app);

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(sessionConfig);

app.use(authRoutes);
app.use(adminRoutes);
app.use(userRoutes);
app.use(logRoutes);
app.use("/api", apiRoutes);

// ROOT PAGE
https://websheetapp.my.id/login


// --- Rute untuk memanggil Halaman Dokumentasi ---
app.get("/documentation", (req, res) => {
  // Sesuaikan 'views/docs.html' dengan lokasi asli file dokumentasi kamu
  res.sendFile(path.join(__dirname, "public", "docs.html")); 
});


app.get("/dashboard", authRequired, (req, res) => {
  res.send(`Halo ${req.session.user.username}`);
});

(async () => {
  await initSocket(server);

  server.listen(3000, () => {
    console.log("Server running http://localhost:3000");
  });

  await restoreSessions();
})();
