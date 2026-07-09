import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

// 1. Define allowed origins for both development and production
const allowedOrigins = [
  "https://echo.madebysaksham.space",
  "https://chatdemo-8xv.pages.dev"
];

// 2. Configure Express CORS
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

const server = http.createServer(app);

// 3. Configure Socket.io CORS to match Express exactly
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
});

const createdRooms = new Set();

app.get("/", (req, res) => {
  res.send("Socket.io backend is running");
});

io.on("connection", (socket) => {

  socket.on("create-room", (roomCode) => {
    if (createdRooms.has(roomCode)) {
      socket.emit("room-code-exists");
      return;
    }

    createdRooms.add(roomCode);

    // Creator joins the room immediately
    socket.join(roomCode);

    socket.emit("room-created", roomCode);
    socket.emit("room-joined", roomCode);

    io.to(roomCode).emit("connected-users", 1);

    console.log(`Room created: ${roomCode}`);
    console.log(`${socket.id} joined room ${roomCode}`);
  });

  socket.on("check-room", (roomCode) => {
    if (!createdRooms.has(roomCode)) {
      socket.emit("invalid-room");
      return;
    }

    const room = io.sockets.adapter.rooms.get(roomCode);
    const roomSize = room ? room.size : 0;

    if (roomSize >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.emit("room-valid", roomCode);
  });

  socket.on("join-room", (roomCode) => {
    if (!createdRooms.has(roomCode)) {
      socket.emit("invalid-room");
      return;
    }

    const alreadyInRoom = socket.rooms.has(roomCode);
    const room = io.sockets.adapter.rooms.get(roomCode);
    const roomSize = room ? room.size : 0;

    if (!alreadyInRoom && roomSize >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomCode);

    const updatedRoom = io.sockets.adapter.rooms.get(roomCode);
    const connectedUsers = updatedRoom ? updatedRoom.size : 0;

    socket.emit("room-joined", roomCode);
    io.to(roomCode).emit("connected-users", connectedUsers);

    console.log(`${socket.id} joined room ${roomCode}`);
  });

  socket.on("send-message", ({ roomCode, message }) => {
    if (!socket.rooms.has(roomCode)) {
      console.log(`${socket.id} tried to send without joining room ${roomCode}`);
      return;
    }

    console.log("Message received:", message, "Room:", roomCode);

    socket.to(roomCode).emit("receive-message", message);
  });

  socket.on("leave-room", (roomCode) => {
    // Ignore old/stale leave-room calls
    if (!socket.rooms.has(roomCode)) {
      console.log(`${socket.id} tried to leave old room ${roomCode}, ignored`);
      return;
    }

    socket.leave(roomCode);

    const room = io.sockets.adapter.rooms.get(roomCode);
    const connectedUsers = room ? room.size : 0;

    if (connectedUsers === 0) {
      createdRooms.delete(roomCode);
    }

    io.to(roomCode).emit("connected-users", connectedUsers);

    console.log(`${socket.id} left room ${roomCode}`);
  });

  socket.on("disconnecting", () => {
    socket.rooms.forEach((roomCode) => {
      if (roomCode !== socket.id) {
        const room = io.sockets.adapter.rooms.get(roomCode);
        const connectedUsers = room ? room.size - 1 : 0;

        if (connectedUsers <= 0) {
          createdRooms.delete(roomCode);
        }

        socket.to(roomCode).emit("connected-users", connectedUsers);
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server running on render ");
  console.log("Server running on render ");
});