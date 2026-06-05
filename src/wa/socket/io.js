// src/wa/socket/io.js
let ioInstance = null;
const qrCache = {}; // <-- INI YANG KURANG

export async function initSocket(server) {
  const { Server } = await import("socket.io");

  ioInstance = new Server(server, {
    cors: { origin: "*" },
  });

  console.log("✅ Socket.IO initialized");

  ioInstance.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join", (userId) => {
      const room = `user-${userId}`;
      socket.join(room);
      console.log(`✅ ${socket.id} joined ${room}`);

      // 🔥 KIRIM QR JIKA ADA
      if (qrCache[userId]) {
        socket.emit("qr", { qr: qrCache[userId] });
      }
    });
  });

  return ioInstance;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error("❌ Socket.IO NOT initialized");
  }
  return ioInstance;
}
