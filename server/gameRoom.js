import GameEngine from "./engine/engine.js";

export default class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;

    this.seats = [null, null, null, null];
    this.pendingActions = {};

    this.engine = null;


    this.started = false;
    this.hostSocketId = null;
    this.teamNames = {
      0: generateTeamName(),
      1: generateTeamName()
    };
  }

  /* ------------------------------------------------ */
  /* SEAT MANAGEMENT                                 */
  /* ------------------------------------------------ */

  addHumanPlayer(socket, name = "Player") {

    const seatIndex = this.findEmptySeat();
    if (seatIndex === -1) return null;

    this.seats[seatIndex] = {
      type: "human",
      socket,
      hand: [],
      name
    };

    socket.data.roomId = this.roomId;
    socket.data.seatIndex = seatIndex;

    if (!this.hostSocketId) {
      this.hostSocketId = socket.id;
    }
    socket.emit("seat_assigned", { seatIndex });

    this.attachSocketHandlers(socket);

    this.broadcastLobbyState();

    console.log("Human joined seat:", seatIndex);

    return seatIndex;
  }

  addAIPlayer(strategy) {
    const seatIndex = this.findEmptySeat();
    if (seatIndex === -1) return null;

    this.seats[seatIndex] = {
      type: "ai",
      strategy,
      hand: [],
      name: randomAIName()
    };

    console.log("AI added to seat:", seatIndex);

    this.broadcastLobbyState();

    return seatIndex;
  }
  handleKickRequest(requestingSocket, targetSeatIndex) {

    // Only host can kick
    if (requestingSocket.id !== this.hostSocketId) return;

    const targetSeat = this.seats[targetSeatIndex];
    if (!targetSeat || targetSeat.type !== "human") return;

    // Host cannot kick themselves
    if (targetSeat.socket.id === this.hostSocketId) return;

    // Notify kicked player
    targetSeat.socket.emit("kicked");

    // Delegate removal
    this.removePlayerBySeat(targetSeatIndex);
  }

  removePlayerBySeat(seatIndex) {
    const removedSeat = this.seats[seatIndex];
    if (!removedSeat) return;

    const removedSocketId =
      removedSeat.type === "human"
        ? removedSeat.socket.id
        : null;

    this.seats[seatIndex] = null;
    delete this.pendingActions[seatIndex];

    // If host left, reassign
    if (removedSocketId && removedSocketId === this.hostSocketId) {
      const nextHuman = this.seats.find(seat => seat?.type === "human");
      this.hostSocketId = nextHuman?.socket.id || null;
    }

    this.broadcastLobbyState();
  }

  removePlayerBySocket(socketId) {
    const seatIndex = this.seats.findIndex(
      seat => seat?.type === "human" && seat.socket.id === socketId
    );

    if (seatIndex !== -1) {
      this.removePlayerBySeat(seatIndex);
    }
  }
  handleRemoveAI(seatIndex) {
    const seat = this.seats[seatIndex];
    if (!seat) return;

    // Only AI seats can be removed
    if (seat.type !== "ai") return;

    this.seats[seatIndex] = null;

    this.broadcastLobbyState();
  }

  findEmptySeat() {
    return this.seats.findIndex(seat => seat === null);
  }

  isFull() {
    return this.seats.every(seat => seat !== null);
  }

  /* ------------------------------------------------ */
  /* SOCKET HANDLING                                 */
  /* ------------------------------------------------ */


  attachSocketHandlers(socket) {

    socket.on("player_action", (action) => {
      const seatIndex = socket.data.seatIndex;
      this.handlePlayerAction(seatIndex, action);
    });

    socket.on("disconnect", () => {
      this.removePlayerBySocket(socket.id);
    });
  }


  broadcastLobbyState() {

    if (this.started) return;

    const players = this.seats
      .map((seat, index) => {
        if (!seat) return null;

        return {
          seatIndex: index,
          name: seat.name,
          type: seat.type,
          socketId: seat.type === "human"
            ? seat.socket.id
            : null
        };
      })
      .filter(Boolean);

    console.log("Broadcasting lobby:", players);

    this.broadcast({
      type: "lobby_update",
      players,
      hostSocketId: this.hostSocketId,
      code: this.roomId,
      teamNames: this.teamNames
    });
  }

  isHost(socketId) {
    return socketId === this.hostSocketId;
  }

  hasHumans() {
    return this.seats.some(seat => seat?.type === "human");
  }

  handlePlayerAction(playerIndex, action) {
    const resolver = this.pendingActions[playerIndex];
    if (!resolver) return;

    delete this.pendingActions[playerIndex];
    resolver(action);
  }

  /* ------------------------------------------------ */
  /* ENGINE INTERFACE                                */
  /* ------------------------------------------------ */

  async waitForPlayerAction(playerIndex, context) {
    const seat = this.seats[playerIndex];
    console.log("WAITING FOR:", playerIndex, context.phase);
    if (!seat) {
      throw new Error("Seat does not exist");
    }

    // Human: wait for socket response
    return new Promise(resolve => {
      this.pendingActions[playerIndex] = resolve;

      seat.socket.emit("game_event", {
        type: "your_turn",
        context
      });
    });
  }

  broadcast(message) {
    this.seats.forEach(seat => {
      if (seat?.type === "human") {
        seat.socket.emit("game_event", message);
      }
    });
  }

  /* ------------------------------------------------ */
  /* GAME FLOW                                       */
  /* ------------------------------------------------ */

  async startGame(requestingSocketId = null) {

    if (this.started) return;

    if (requestingSocketId &&
        requestingSocketId !== this.hostSocketId) {
      return;
    }

    if (!this.isFull()) {
      console.log("Not full:", this.seats);
      return;
    }

    this.started = true;
    this.engine = new GameEngine(this);
    console.log("=== STARTING GAME ===");

    try {
      this.seats.forEach((seat, index) => {
        if (seat?.type === "human") {
          seat.socket.emit("game_event", {
            type: "game_start",
            seatIndex: index,
            players: this.seats
              .map((s, i) =>
                s ? {
                  seatIndex: i,
                  name: s.name,
                  type: s.type
                } : null
              )
              .filter(Boolean)
          });
        }
      });
      await this.engine.start();
    } catch (err) {
      console.error("Game loop crashed:", err);
      this.started = false;
    }
  }
  
  handleSeatRequest(socket, targetSeatIndex) {
    const currentSeatIndex = socket.data.seatIndex;

    if (currentSeatIndex === undefined) return;
    if (targetSeatIndex < 0 || targetSeatIndex > 3) return;
    if (currentSeatIndex === targetSeatIndex) return;

    const targetSeat = this.seats[targetSeatIndex];
    const currentSeat = this.seats[currentSeatIndex];

    if (!currentSeat) return;
    // 🔥 Empty seat → simple move
    if (!targetSeat) {
      this.seats[targetSeatIndex] = currentSeat;
      this.seats[currentSeatIndex] = null;

      socket.data.seatIndex = targetSeatIndex;
    }

    // 🔥 Occupied → SWAP
    else {
      this.seats[targetSeatIndex] = currentSeat;
      this.seats[currentSeatIndex] = targetSeat;

      socket.data.seatIndex = targetSeatIndex;

      if (targetSeat.type === "human") {
        targetSeat.socket.data.seatIndex = currentSeatIndex;
      }
    }

    this.broadcastLobbyState();
  }



}

const titles = ["Captain", "Professor", "Dr.", "Lord", "Sir"];
const adjectives = ["Sneaky", "Aggressive", "Confused", "Bold", "Suspicious"];
const nouns = ["Bower", "Reneg", "Trump", "Dealer", "Passer"];

function rand(array) {
  return Math.floor(Math.random() * array.length);
}
function randomAIName() {
  return `${titles[rand(titles)]} ${adjectives[rand(adjectives)]} ${nouns[rand(nouns)]}`;
}

const teamNouns = [
  "Bowers",
  "Trumps",
  "Dealers",
  "Makers",
  "Tricksters",
  "High Rollers",
  "Card Sharks",
  "Overtrumps",
  "Callers",
  "Table Kings",
  "Suit Masters",
  "Marchers",
  "Cutters",
  "Lone Wolves",
  "Hand Winners"
];

const teamAdjectives = [
  "Golden",
  "Iron",
  "Silent",
  "Ruthless",
  "Midnight",
  "Royal",
  "Savage",
  "Crimson",
  "Wild",
  "Shadow",
  "Fearless",
  "Hidden",
  "Lucky",
  "Stormborn",
  "Swift",
  "High Stakes",
  "Cold",
  "Bold"
];
function generateTeamName() {
  const adj =
    teamAdjectives[
      Math.floor(Math.random() * teamAdjectives.length)
    ];

  const noun =
    teamNouns[
      Math.floor(Math.random() * teamNouns.length)
    ];

  return `${adj} ${noun}`;
}