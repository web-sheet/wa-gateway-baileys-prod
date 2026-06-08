import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import sessionConfig from "./config/session.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import userRoutes from "./routes/user.routes.js";
import autoreplyRoutes from "./routes/autoreply.routes.js";
import apiRoutes from "./routes/api.js";
import logRoutes from "./routes/logRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import { authRequired } from "./middlewares/auth.middleware.js";
import http from "http";
import { initSocket } from "./wa/socket/io.js";
import { restoreSessions } from "./wa/wa.js";
import expressLayouts from "express-ejs-layouts";
import blogRoutes from "./routes/blogRoutes.js";


import path from "path";
import { fileURLToPath } from "url";

// Definisikan __dirname terlebih dahulu jika menggunakan ES Module (import/export)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
connectDB();

const app = express();
app.use(expressLayouts);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const server = http.createServer(app);

app.set("view engine", "ejs");

app.set("layout", "layout");
app.use(express.urlencoded({ extended: false }));
app.use(sessionConfig);

app.set("trust proxy", 1);

app.use(authRoutes);
app.use(adminRoutes);
app.use(userRoutes);
app.use(logRoutes);
app.use(autoreplyRoutes);
app.use(contactRoutes);
app.use(blogRoutes);

app.use("/api", apiRoutes);
app.use((req, res, next) => {
  res.locals.path = req.path;
  next();
});

// ROOT PAGE
app.get("/", (req, res) => {
  // Cek apakah ada data session user yang aktif
  if (req.session && req.session.user) {
    // Jika sudah login, langsung lempar ke dashboard
    return res.redirect("/dashboard");
  }

  // Jika belum login, lempar ke halaman login
  res.redirect("/login");
});

https: app.get("/documentation", (req, res) => {
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
