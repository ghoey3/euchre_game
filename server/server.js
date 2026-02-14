import express from "express";
import http from "http";
import { Server } from "socket.io";
import GameRoom from "./gameRoom.js";
import SimpleAIStrategy from "./ai/simpleAI.js";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const limiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 120,                // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

const server = http.createServer(app);
const io = new Server(server)
// const io = new Server(server, {
//   cors: {
//     origin: ["http://localhost:3000"],
//     // origin: ["https://yourdomain.up.railway.app"], //CHANGE THIS 
//     methods: ["GET", "POST"]
//   }
// });

app.use(express.static(path.join(__dirname, "../client")));

const rooms = new Map(); // 🔥 multiple rooms now

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const connectionCounts = new Map();

io.use((socket, next) => {
  const ip = socket.handshake.address;

  const count = connectionCounts.get(ip) || 0;

  if (count > 20) {
    return next(new Error("Too many connections"));
  }

  connectionCounts.set(ip, count + 1);

  socket.on("disconnect", () => {
    connectionCounts.set(ip, connectionCounts.get(ip) - 1);
  });

  next();
});

io.on("connection", socket => {

  /* =========================
     VS AI (unchanged)
  ========================= */
  socket.on("start_vs_ai", ({ name }) => {
    const room = new GameRoom("vs-ai-" + socket.id, io, 'ai');

    room.addHumanPlayer(socket, name);
    room.addAIPlayer(new SimpleAIStrategy());
    room.addAIPlayer(new SimpleAIStrategy());
    room.addAIPlayer(new SimpleAIStrategy());

    room.startGame();
  });
  socket.on("leave_lobby", () => {

    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.removePlayerBySocket(socket.id);

    socket.leave(roomId);

    // If room is empty, delete it
    if (!room.hasHumans()) {
      rooms.delete(roomId);
    }
  });

  /* =========================
     CREATE LOBBY
  ========================= */
  socket.on("create_lobby", (payload = {}) => {

    let name =
      typeof payload.name === "string"
        ? payload.name.trim().slice(0, 24)
        : "";

    if (!name) return;
    if (rooms.size > 200) {
      socket.emit("error_message", "Server busy.");
      return;
    }
    const code = generateCode();

    const room = new GameRoom(code, io, "lobby", () => {
      rooms.delete(code);
    });
    rooms.set(code, room);

    room.addHumanPlayer(socket, name);
    socket.join(code);

    socket.emit("lobby_created", { code });
    room.broadcastLobbyState();
  });

  /* =========================
     JOIN LOBBY
  ========================= */
  socket.on("join_lobby", ({ name, code }) => {

    const room = rooms.get(code);
    if (!room) {
      socket.emit("error_message", "Lobby not found");
      return;
    }

    room.addHumanPlayer(socket, name);
    socket.join(code);

    // 🔥 send confirmation
    socket.emit("lobby_joined", { code });

    room.broadcastLobbyState();
  });

  socket.on("add_ai", ({ aiType }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!roomId) return;

    if (!room) return;

    if (room.isFull()) return;

    let strategy;

    switch (aiType) {
      case "simple":
        strategy = new SimpleAIStrategy();
        break;

      case "aggressive":
        strategy = new SimpleAIStrategy(); // placeholder
        break;

      case "defensive":
        strategy = new SimpleAIStrategy(); // placeholder
        break;

      default:
        strategy = new SimpleAIStrategy();
    }

    room.addAIPlayer(strategy);
  });
  socket.on("start_game", () => {
    console.log("START GAME received");
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const seatIndex = socket.data.seatIndex;
    if (seatIndex === undefined) return;

    room.startGame(socket.id);
  });
  socket.on("request_seat", ({ seatIndex }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || room.started) return;

    room.handleSeatRequest(socket, seatIndex);
  });
  socket.on("kick_player", ({ seatIndex }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.handleKickRequest(socket, seatIndex);
  });
  socket.on("remove_ai", ({ seatIndex }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // Only host can remove AI
    if (socket.id !== room.hostSocketId) return;

    room.handleRemoveAI(seatIndex);
  });
  socket.on("set_team_name", ({ teamIndex, name }) => {

    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const seatIndex = socket.data.seatIndex;
    if (seatIndex == null) return;

    const playerTeam = seatIndex % 2;
    if (playerTeam !== teamIndex) return;

    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;

    const otherTeam = teamIndex === 0 ? 1 : 0;

    const currentOtherName = room.teamNames[otherTeam] || "";

    console.log("Comparing:", trimmed, "vs", currentOtherName);

    if (
      trimmed.toLowerCase() ===
      currentOtherName.toLowerCase()
    ) {
      socket.emit("error_message", "Team names must be different.");
      return;
    }

    room.teamNames[teamIndex] = trimmed;

    console.log("Updated teamNames:", room.teamNames);

    room.broadcastLobbyState();
  });
});


const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// server.listen(3000, () => {
//   console.log("Server running on port 3000");
// });