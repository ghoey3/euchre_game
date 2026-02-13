import renderControls from "./ui/renderControls.js";
import renderTrick from "./ui/renderTrick.js";
import renderHand from "./ui/renderHand.js";
import renderScores from "./ui/renderScores.js";
import renderBacks from "./ui/renderBacks.js";
import renderTrump from "./ui/renderTrump.js";
import renderUpcard from "./ui/renderUpcard.js";
import { renderAloneIndicator, highlightActivePlayer, clearActiveHighlight } from "./ui/renderIndicators.js";
import { renderSpeechBubble } from "./ui/renderSpeechBubble.js";
import { renderTrickInfo } from "./ui/renderTrickInfo.js";
import { renderPlayerNames } from "./ui/renderPlayerNames.js";
import { updateSeatMarkers } from "./ui/renderSeatMarkers.js";  


const socket = io();

/* =========================
   APP STATE CONTROLLER
========================= */

let appState = "landing";

const screens = {
  landing: document.getElementById("landing-screen"),
  lobby: document.getElementById("lobby-screen"),
  game: document.getElementById("game-screen")
};

function setAppState(newState) {
  appState = newState;

  Object.values(screens).forEach(screen => {
    screen.classList.remove("active");
  });

  screens[newState]?.classList.add("active");
}

const nameInput = document.getElementById("player-name-input");
const playAiBtn = document.getElementById("play-ai-btn");
const createLobbyBtn = document.getElementById("create-lobby-btn");
const joinLobbyBtn = document.getElementById("join-lobby-btn");
const joinCodeInput = document.getElementById("join-code-input");

playAiBtn.onclick = () => {
  const name = nameInput.value.trim() || "Player";

  socket.emit("start_vs_ai", { name });

};

createLobbyBtn.onclick = () => {
  const name = nameInput.value.trim() || "Player";

  socket.emit("create_lobby", { name });

  setAppState("lobby");
};

joinLobbyBtn.onclick = () => {
  const name = nameInput.value.trim() || "Player";
  const code = joinCodeInput.value.trim().toUpperCase();

  socket.emit("join_lobby", { name, code });
  console.log("mySeat:", state.mySeatIndex);
  console.log("hostSeat:", lobbyState.hostSeatIndex);
}
/* =========================
   GLOBAL CLIENT STATE
========================= */

let lobbyState = {
  players: [],
  hostSeatIndex: null,
  code: null,
  teamNames: ["Team 0", "Team 1"]
};

let state = {
  mySeatIndex: null,
  hand: [],
  trick: { cards: [] },
  scores: { team0: 0, team1: 0 },
  phase: null,

  cardCounts: { 0:5, 1:5, 2:5, 3:5 },

  round: {
    dealerIndex: null,
    trickLeader: null,
    trump: null,
    makerTeam: null,
    tricks: { team0: 0, team1: 0 },
    alonePlayerIndex: null
  }
  
};

function renderLobby() {

  setAppState("lobby");

  const codeDisplay = document.getElementById("lobby-code-display");
  const addAiBtn = document.getElementById("add-ai-btn");
  const startBtn = document.getElementById("start-game-btn");
  const leaveBtn = document.getElementById("leave-lobby-btn");
  document.querySelectorAll(".team-label").forEach(el => el.remove());

  // Determine my team
  const myTeam =
    state.mySeatIndex != null
      ? state.mySeatIndex % 2
      : null;

  // -------------------------
  // TEAM 0 LABEL
  // -------------------------

  const team0Label = document.createElement("div");
  team0Label.className = "team-label team-0-label";
  team0Label.textContent = lobbyState.teamNames[0] || "Team 0";

  // Only allow editing if I’m on Team 0
  if (myTeam === 0) {
    team0Label.classList.add("editable");

    team0Label.onclick = () => {
      const newName = prompt("Enter new Team 0 name:");
      if (newName && newName.trim()) {
        socket.emit("set_team_name", {
          teamIndex: 0,
          name: newName.trim()
        });
      }
    };
  }

  document.querySelector(".lobby-table").appendChild(team0Label);


  // -------------------------
  // TEAM 1 LABEL
  // -------------------------

  const team1Label = document.createElement("div");
  team1Label.className = "team-label team-1-label";
  team1Label.textContent = lobbyState.teamNames[1] || "Team 1";

  // Only allow editing if I’m on Team 1
  if (myTeam === 1) {
    team1Label.classList.add("editable");

    team1Label.onclick = () => {
      const newName = prompt("Enter new Team 1 name:");
      if (newName && newName.trim()) {
        socket.emit("set_team_name", {
          teamIndex: 1,
          name: newName.trim()
        });
      }
    };
  }

  document.querySelector(".lobby-table").appendChild(team1Label);
  // Show lobby code
  codeDisplay.textContent = lobbyState.code
    ? `Lobby Code: ${lobbyState.code}`
    : "";

  const amHost = socket.id === lobbyState.hostSocketId;

  // Render 4 fixed seats
  for (let seatIndex = 0; seatIndex < 4; seatIndex++) {

    const seatEl = document.querySelector(
      `.lobby-seat[data-seat="${seatIndex}"]`
    );

    if (!seatEl) continue;

    const player = lobbyState.players.find(
      p => p.seatIndex === seatIndex
    );

    // Reset classes
    seatEl.className = seatEl.className
      .split(" ")
      .filter(c => c.startsWith("seat-")) // keep position class
      .join(" ");

    seatEl.classList.add("lobby-seat");

    seatEl.innerHTML = "";

    if (!player) {
      seatEl.classList.add("empty");
      seatEl.innerHTML = `<span>Empty Seat</span>`;
    } else {

      seatEl.classList.add(player.type);

      const nameDiv = document.createElement("div");
      nameDiv.textContent = player.name;

      if (player.type === "ai") {
        nameDiv.innerHTML += " <small>[AI]</small>";
      }

      seatEl.appendChild(nameDiv);

      // Host glow
      if (seatIndex === lobbyState.hostSeatIndex) {
        seatEl.classList.add("host");
      }

      // Highlight your seat
      if (seatIndex === state.mySeatIndex) {
        const team = seatIndex % 2;

        seatEl.classList.add("you");

        if (team === 0) {
          seatEl.classList.add("you-team-0");
        } else {
          seatEl.classList.add("you-team-1");
        }
      }

      // Host can remove AI
      if (amHost && player.type === "ai") {
        const removeBtn = document.createElement("button");
        removeBtn.className = "mini-btn";
        removeBtn.textContent = "Remove";
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          socket.emit("remove_ai", { seatIndex });
        };
        seatEl.appendChild(removeBtn);
      }

      // Host can kick humans (not self)
      if (
        amHost &&
        player.type === "human" &&
        player.socketId !== socket.id
      ) {
        const kickBtn = document.createElement("button");
        kickBtn.className = "mini-btn";
        kickBtn.textContent = "Kick";
        kickBtn.onclick = (e) => {
          e.stopPropagation();
          socket.emit("kick_player", { seatIndex });
        };
        seatEl.appendChild(kickBtn);
      }
    }

    // 🔥 Seat click = request swap / move
    seatEl.onclick = () => {
      socket.emit("request_seat", { seatIndex });
    };
  }

  // Host Controls
  addAiBtn.style.display = amHost ? "inline-flex" : "none";

  startBtn.style.display =
    amHost && lobbyState.players.length === 4
      ? "inline-flex"
      : "none";

  if (leaveBtn) {
    leaveBtn.style.display = "inline-flex";
  }
}

document.getElementById("add-ai-btn").onclick = () => {
  console.log("ADD AI CLICKED");
  socket.emit("add_ai", { aiType: "simple" });
};

document.getElementById("start-game-btn").onclick = () => {
  console.log("START CLICKED");
  socket.emit("start_game");
};

document.getElementById("leave-lobby-btn").onclick = () => {

  socket.emit("leave_lobby");

  // Reset local lobby state
  lobbyState.players = [];
  lobbyState.hostSeatIndex = null;
  lobbyState.code = null;

  state.mySeatIndex = null;

  setAppState("landing");
};

const controlsDiv = document.getElementById("controls");
const statusDiv = document.getElementById("status");

/* =========================
   HELPERS
========================= */

function getTeamFromSeat(seatIndex) {
  return seatIndex % 2; // 0 & 2 = team0, 1 & 3 = team1
}

function clearUpcard() {
  const old = document.querySelector(".upcard");
  if (old) old.remove();
}

/* =========================
   SOCKET LISTENERS
========================= */

socket.on("seat_assigned", ({ seatIndex }) => {
  state.mySeatIndex = seatIndex;

  if (appState === "lobby") {
    renderLobby();
  }
});
socket.on("lobby_created", ({ code }) => {
  lobbyState.code = code;
  setAppState("lobby");
});

socket.on("lobby_joined", ({ code }) => {
  lobbyState.code = code;
  setAppState("lobby");
});

socket.on("error_message", (msg) => {
  alert(msg);
});

socket.on("kicked", () => {
  alert("You were kicked from the lobby.");

  // Reset state
  lobbyState.players = [];
  lobbyState.hostSeatIndex = null;
  lobbyState.code = null;
  state.mySeatIndex = null;

  setAppState("landing");
});

/* =========================
   GAME EVENTS
========================= */

socket.on("game_event", (message) => {
  console.log("GAME EVENT:", message);
  switch (message.type) {

    case "lobby_update":
      lobbyState.players = message.players;
      lobbyState.hostSocketId = message.hostSocketId;
      lobbyState.code = message.code;
      lobbyState.teamNames = message.teamNames || lobbyState.teamNames;

      // 🔥 Sync mySeatIndex from players array
      const me = message.players.find(
        p => p.socketId === socket.id
      );

      if (me) {
        state.mySeatIndex = me.seatIndex;
      }

      renderLobby();
      break;

    case "players_update":
      console.log("PLAYERS UPDATE:", message.players);
      state.players = message.players;

      renderPlayerNames(state.players, state.mySeatIndex);

      break;

    /* =========================
       GAME START
    ========================= */
    case "game_start":
      console.log("SWITCH HIT GAME_START");

      setAppState("game");
      statusDiv.textContent = "Game started!";

      state.mySeatIndex = message.seatIndex;
      state.players = message.players;   // ← ADD THIS

      state.scores = { team0: 0, team1: 0 };
      renderScores(state.scores);

      state.cardCounts = { 0:5, 1:5, 2:5, 3:5 };

      renderPlayerNames(state.players, state.mySeatIndex);  // ← ADD THIS

      renderHand(state.hand, socket);
      updateBacks(state);
      renderAloneIndicator(null, state.mySeatIndex);

      break;

    /* =========================
       ROUND START
    ========================= */
    case "round_start":
      state.trick = { cards: [] };
      document.getElementById("trick-area").innerHTML = "";
      controlsDiv.innerHTML = "";

      state.round = {
        dealerIndex: message.dealerIndex,
        trickLeader: null,
        trump: null,
        makerTeam: null,
        tricks: { team0: 0, team1: 0 },
        alonePlayerIndex: null
      };

      state.upcard = message.upcard;
      state.cardCounts = { 0:5, 1:5, 2:5, 3:5 };

      updateSeatMarkers({
        dealerIndex: state.round.dealerIndex,
        leaderIndex: null,
        mySeatIndex: state.mySeatIndex
      });
      renderUpcard(state.upcard, state.round.dealerIndex, state.mySeatIndex);
      updateBacks(state);

      renderTrickInfo(state.round);
      renderAloneIndicator(null, state.mySeatIndex);
      break;

    /* =========================
       TRICK START
    ========================= */
    case "trick_start":

      state.round.trickLeader = message.trickLeader;
      renderAloneIndicator(
        state.round.alonePlayerIndex,
        state.mySeatIndex
      );
      highlightActivePlayer(message.trickLeader, state.mySeatIndex);
      updateSeatMarkers({
        dealerIndex: state.round.dealerIndex,
        leaderIndex: state.round.trickLeader,
        mySeatIndex: state.mySeatIndex
      });

      break;

    /* =========================
       YOUR TURN
    ========================= */
    case "your_turn": {

      const context = message.context;

      state.phase = context.phase;
      state.hand = context.hand || [];

      renderTrump(context.trump || null);
      renderHand(state.hand, socket, state.phase);
      renderControls(context, socket);

      statusDiv.textContent = `Your turn (${context.phase})`;

      break;
    }

    /* =========================
       BIDDING RESULT
    ========================= */
    case "bidding_result":

      state.round.trump = message.trump;
      state.round.makerTeam = message.makerTeam;
      state.round.alonePlayerIndex = message.alonePlayerIndex ?? null;

      renderTrump(message.trump);
      clearUpcard();

      renderAloneIndicator(
        state.round.alonePlayerIndex,
        state.mySeatIndex
      );

      renderTrickInfo(state.round);

      break;

    /* =========================
       TRICK UPDATE
    ========================= */
    case "trick_update": {

      state.trick.cards = message.trickCards;
      const leader = state.round.trickLeader;
      const nextPlayer =
        (leader + message.trickCards.length) % 4;

      highlightActivePlayer(nextPlayer, state.mySeatIndex);
      const lastPlay =
        message.trickCards[message.trickCards.length - 1];

      if (lastPlay.player === state.mySeatIndex) {

        state.hand = state.hand.filter(card =>
          !(card.rank === lastPlay.card.rank &&
            card.suit === lastPlay.card.suit)
        );

        renderHand(state.hand, socket, state.phase);
      } else {
        state.cardCounts[lastPlay.player]--;
        updateBacks(state);
      }

      renderTrick(state, state.mySeatIndex);

      break;
    }

    /* =========================
       TRICK WINNER
    ========================= */
    case "trick_winner": {
      clearActiveHighlight();
      const winner = message.winner;
      const winnerTeam = getTeamFromSeat(winner);
      state.round.trickLeader = winner;

      updateSeatMarkers({
        dealerIndex: state.round.dealerIndex,
        leaderIndex: state.round.trickLeader,
        mySeatIndex: state.mySeatIndex
      });
      if (winnerTeam === 0) {
        state.round.tricks.team0++;
      } else {
        state.round.tricks.team1++;
      }

      renderTrickInfo(state.round);

      statusDiv.textContent = `Seat ${winner} won the trick`;

      const winningCardEl = document.querySelector(
        `#trick-area .card[data-player="${winner}"]`
      );

      if (winningCardEl) {
        winningCardEl.classList.add("winning-card");
      }

      setTimeout(() => {
        state.trick = { cards: [] };
        document.getElementById("trick-area").innerHTML = "";
      }, 1200);

      break;
    }

    /* =========================
       ROUND RESULT
    ========================= */
    case "round_result":

      state.scores = message.scores;
      renderScores(state.scores);

      state.round = {
        dealerIndex: null,
        trickLeader: null,
        trump: null,
        makerTeam: null,
        tricks: { team0: 0, team1: 0 },
        alonePlayerIndex: null
      };  
      
      state.trick = { cards: [] };
      document.getElementById("trick-area").innerHTML = "";

      renderTrickInfo(state.round);

      renderTrump(null);
      clearUpcard();
      renderAloneIndicator(null, state.mySeatIndex);
      updateSeatMarkers({
        dealerIndex: null,
        leaderIndex: null,
        mySeatIndex: state.mySeatIndex
      });

      statusDiv.textContent = "Round complete";

      break;

    /* =========================
       HAND UPDATE
    ========================= */
    case "hand_update":

      state.hand = message.hand;
      state.mySeatIndex = message.mySeatIndex;

      renderHand(state.hand, socket);
      updateBacks(state);

      break;

    /* =========================
       PLAYER SPOKE
    ========================= */
    case "player_spoke":

      let text = message.text;

      if (message.alone) {
        text += " (Alone)";
      }

      renderSpeechBubble(
        message.player,
        state.mySeatIndex,
        text
      );

      break;

    /* =========================
       GAME OVER
    ========================= */
    case "game_over":

      statusDiv.textContent = "Game Over!";
      break;
    /* =========================
       Dealer Pickup
    ========================= */

    case "dealer_pickup":

      clearUpcard();

      const dealerIndex = state.round.dealerIndex;

      if (dealerIndex !== state.mySeatIndex) {
        state.cardCounts[dealerIndex]++;
        updateBacks(state);
      }

      break;

    case "dealer_discard":
      state.cardCounts[state.round.dealerIndex]--;
      updateBacks(state);
      // Remove visual upcard immediately
      // this.room.broadcast({
      //   type: "dealer_discard",
      //   dealerIndex: this.dealerIndex
      // });
      break;
  }
});


function updateBacks(state) {
  if (
    state.mySeatIndex === null ||
    state.mySeatIndex === undefined ||
    !state.cardCounts
  ) return;

  if (state.mySeatIndex === null) return;

  for (let seatIndex = 0; seatIndex < 4; seatIndex++) {

    // Skip rendering backs for yourself
    if (seatIndex === state.mySeatIndex) continue;

    const seatMap = {
      0: "player-bottom",
      1: "player-left",
      2: "player-top",
      3: "player-right"
    };

    const relative =
      (seatIndex - state.mySeatIndex + 4) % 4;

    const seatId = seatMap[relative];

    const count = state.cardCounts[seatIndex] || 0;

    renderBacks(
      seatId,
      count,
      seatIndex,
      state.mySeatIndex
    );
  }
}