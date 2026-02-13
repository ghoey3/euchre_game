import { createDeck, shuffle } from "./deck.js";
import { determineTrickWinner } from "./trickLogic.js";
import { getEffectiveSuit } from "./cardUtils.js";

export default class GameEngine {
  constructor(room) {
    this.room = room;
    this.dealerIndex = null;
    this.scores = { team0: 0, team1: 0 };
    this.winningScore = 10;
    this.invalidMoveCounts = {}
  }

  /* ============================= */
  /* ========= CORE LOOP ========= */
  /* ============================= */

  async start() {
    if (this.isGameOver()){
      this.room.broadcast({
      type: "game_over",
      scores: this.scores
      });
    return;
    };
    await this.determineDealerByJack()

    this.room.broadcast({
      type: "players_update",
      players: this.room.seats.map((seat, index) => ({
        seatIndex: index,
        name: seat?.name || null,
        type: seat?.type || null
      }))
    });
    while (!this.isGameOver()) {
      await this.playRound();
      this.rotateDealer();
    }
    if (this.isGameOver()){
      this.room.broadcast({
      type: "game_over",
      scores: this.scores
      });
    return;
    };
  }

  async determineDealerByJack() {
    let deck = createDeck(); // however you build deck
    deck = shuffle(deck);

    for (let i = 0; i < deck.length; i++) {
      const seatIndex = i % 4;
      const card = deck[i];
      console.log("CUT CARD:", card);
      // Tell clients a card was dealt to seatIndex
      this.room.broadcast({
        type: "dealer_cut_card",
        seatIndex,
        card
      });

      await sleep(1200); // pause for animation

      if (card.rank === "J") {
        this.dealerIndex = seatIndex;

        this.room.broadcast({
          type: "dealer_selected",
          dealerIndex: seatIndex
        });

        await new Promise(res => setTimeout(res, 800));
        return;
      }
    }
  }
  initializeRound() {
    console.log("Initializing first round...");

    this.deck = createDeck();
    shuffle(this.deck);
    this.dealCards();

    this.room.seats.forEach((seat, index) => {
      if (seat && seat.socket) {
        seat.socket.emit("game_event", {
          type: "hand_update",
          hand: seat.hand,
          mySeatIndex: index
        });
      }
    });

    const upcard = this.deck.pop();

    this.room.broadcast({
      type: "round_start",
      dealerIndex: this.dealerIndex,
      upcard: upcard,
      scores: this.scores
    });

    return upcard; // 🔥 important
  }
    

  isGameOver() {
    return (
      this.scores.team0 >= this.winningScore ||
      this.scores.team1 >= this.winningScore
    );
  }

  rotateDealer() {
    this.dealerIndex = (this.dealerIndex + 1) % 4;
  }

  getTeam(playerIndex) {
    return playerIndex % 2;
  }

  /* ============================= */
  /* ========= UTILITIES ========= */
  /* ============================= */

  dealCards() {

    this.room.seats.forEach(seat => {
      if (seat) seat.hand = [];
    });

    for (let i = 0; i < 5; i++) {
      for (let j = 1; j <= 4; j++) {

        const playerIndex =
          (this.dealerIndex + j) % 4;

        const card = this.deck.pop();

        if (!card) {
          throw new Error("Deck ran out of cards!");
        }

        this.room.seats[playerIndex].hand.push(card);
      }
    }
  }

  buildContext(playerIndex, upcard, trump, trickState = {}, alonePlayerIndex = null) {
    const player = this.room.seats[playerIndex];
    if (!player) {
      throw new Error(`Seat ${playerIndex} is empty during buildContext`);
    }
    return {
      phase: trickState.phase || null,
      hand: [...this.room.seats[playerIndex].hand],
      upcard,
      trump,
      dealerIndex: this.dealerIndex,
      myIndex: playerIndex,
      alonePlayerIndex,
      ...trickState,
      score: this.scores
    };
  }

  async getAction(playerIndex, context) {
    const seat = this.room.seats[playerIndex];

    if (seat.type === "ai") {

      // Longer delay for card play
      if (context.phase === "play_card") {
        await sleep(1800 + Math.random() * 800);
      }

      // Shorter delay for bidding
      else if (
        context.phase === "order_up" ||
        context.phase === "call_trump" ||
        context.phase === "call_trump_forced"
      ) {
        await sleep(800 + Math.random() * 500);
      }

      return seat.strategy.getAction(context);
    }

    if (seat.type === "human") {
      return await this.room.waitForPlayerAction(playerIndex, context);
    }

    throw new Error("Invalid seat type");
  }

  /* ============================= */
  /* ========= ROUND LOGIC ======= */
  /* ============================= */

  async playRound() {
    const upcard = this.initializeRound();

    let trump = null;
    let makerTeam = null;
    let alonePlayerIndex = null;

    /* -------- FIRST ROUND (ORDER UP) -------- */

    for (let i = 1; i <= 4; i++) {

      const playerIndex = (this.dealerIndex + i) % 4;

      const context = this.buildContext(
        playerIndex,
        upcard,
        null
      );

      context.phase = "order_up";

      const action = await this.getAction(playerIndex, context);

      // Always broadcast speech
      if (action.type === "order_up") {
        this.room.broadcast({
          type: "player_spoke",
          player: playerIndex,
          text: action.call ? "Pick it up" : "Pass",
          alone: action.alone || false
        });
      }

      // If they DID NOT call, continue loop
      if (!action.call) {
        continue;
      }

      // ===============================
      // SOMEONE ORDERED IT UP
      // ===============================

      trump = upcard.suit;
      makerTeam = this.getTeam(playerIndex);

      if (action.alone) {
        alonePlayerIndex = playerIndex;
      }

      // ===============================
      // DEALER PICKS UP UPCARD
      // ===============================

      const dealerSeat = this.room.seats[this.dealerIndex];

      dealerSeat.hand.push(upcard);

      this.room.broadcast({
        type: "dealer_pickup",
        dealerIndex: this.dealerIndex,
        upcard
      });

      // ===============================
      // DEALER DISCARD
      // ===============================

      const discardAction = await this.getAction(
        this.dealerIndex,
        {
          phase: "discard",
          hand: [...dealerSeat.hand],
          trump,
          dealerIndex: this.dealerIndex
        }
      );

      if (!discardAction || discardAction.type !== "discard") {
        throw new Error("Dealer must discard a card");
      }

      const discardIndex = dealerSeat.hand.findIndex(
        c =>
          c.rank === discardAction.card.rank &&
          c.suit === discardAction.card.suit
      );

      if (discardIndex === -1) {
        throw new Error("Invalid discard card");
      }

      dealerSeat.hand.splice(discardIndex, 1);

      this.room.broadcast({
        type: "dealer_discard",
        dealerIndex: this.dealerIndex
      });

      break; 
    }
    /* -------- SECOND ROUND (CALL TRUMP) -------- */

    if (!trump) {
      this.room.broadcast({
        type: "phase_change",
        phase: "call_trump"
      });
      for (let i = 1; i <= 4; i++) {
        const playerIndex = (this.dealerIndex + i) % 4;

        let context = this.buildContext(playerIndex, upcard, null);
        context.phase = "call_trump";

        let action = await this.getAction(playerIndex, context);

        // Stick the dealer
        if (i === 4 && !action.call) {
          context = this.buildContext(playerIndex, upcard, null);
          context.phase = "call_trump_forced";

          action = await this.getAction(playerIndex, context);
        }

        // 🔹 Broadcast speech exactly once
        this.room.broadcast({
          type: "player_spoke",
          player: playerIndex,
          text: action.call
            ? action.suit.toUpperCase()
            : "Pass",
          alone: !!action.alone
        });

        // 🔹 Apply trump if chosen
        if (action.call) {
          trump = action.suit;
          makerTeam = this.getTeam(playerIndex);

          if (action.alone) {
            alonePlayerIndex = playerIndex;
          }

          break;
        }
      }
    }

    this.room.broadcast({
      type: "bidding_result",
      trump,
      makerTeam,
      alonePlayerIndex
    });

    /* -------- PLAY TRICKS -------- */

    const trickResults = await this.playTricks(trump, alonePlayerIndex);

    /* -------- SCORING -------- */

    this.scoreRound(trickResults, makerTeam);

    this.room.broadcast({
      type: "round_result",
      scores: this.scores,
      trickResults
    });
  }

  /* ============================= */
  /* ========= TRICKS ============ */
  /* ============================= */

  async playTricks(trump, alonePlayerIndex = null) {
    let leader = (this.dealerIndex + 1) % 4;
    const tricksWon = [0, 0];

    const partnerIndex =
      alonePlayerIndex !== null
        ? (alonePlayerIndex + 2) % 4
        : null;

    for (let trickNumber = 0; trickNumber < 5; trickNumber++) {

      this.room.broadcast({
        type: "trick_start",
        trickLeader: leader
      });

      const trickCards = [];
      let leadSuit = null;

      const playOrder = [];
      for (let i = 0; i < 4; i++) {
        const playerIndex = (leader + i) % 4;
        if (playerIndex === partnerIndex) continue;
        playOrder.push(playerIndex);
      }

      for (let playerIndex of playOrder) {
        this.invalidMoveCounts[playerIndex] = 0;
        const seat = this.room.seats[playerIndex];
        let validPlay = false;
        let card;

        while (!validPlay) {

          const context = this.buildContext(
            playerIndex,
            null,
            trump,
            {
              phase: "play_card",
              trickCards: [...trickCards],
              leadSuit,
              trickNumber,
              trickLeader: leader
            },
            alonePlayerIndex
          );

          const action = await this.getAction(playerIndex, context);

          if (!action || action.type !== "play_card") {
            if (seat.type === "ai") {
              throw new Error(`AI returned invalid action`);
            }
            this.sendInvalidMove(playerIndex, "Invalid action.");
            continue;
          }

          const validationError =
            this.validateCardPlay(
              playerIndex,
              action.card,
              leadSuit,
              trump
            );

          if (validationError) {
            if (seat.type === "ai") {
              throw new Error(
                `AI cheat detected: ${validationError}`
              );
            }

            this.sendInvalidMove(playerIndex, validationError);
            continue; // 🔥 retry loop
          }

          card = action.card;
          validPlay = true;
        }

        // Remove card after successful validation
        const hand = seat.hand;
        const index = hand.findIndex(
          c => c.rank === card.rank && c.suit === card.suit
        );
        hand.splice(index, 1);

        if (!leadSuit) {
          leadSuit = getEffectiveSuit(card, trump);
        }

        trickCards.push({
          player: playerIndex,
          card
        });

        this.room.broadcast({
          type: "trick_update",
          trickCards,
          trickNumber
        });
      }

      const winnerOffset = determineTrickWinner(
        trickCards.map(t => t.card),
        leadSuit,
        trump
      );

      const winningPlayerIndex =
        trickCards[winnerOffset].player;

      tricksWon[this.getTeam(winningPlayerIndex)]++;

      this.room.broadcast({
        type: "trick_winner",
        winner: winningPlayerIndex,
        trickNumber
      });

      await sleep(1200);

      leader = winningPlayerIndex;
    }

    return tricksWon;
  }

  validateCardPlay(playerIndex, card, leadSuit, trump) {

    const seat = this.room.seats[playerIndex];
    const hand = seat.hand;

    const cardIndex = hand.findIndex(
      c => c.rank === card.rank && c.suit === card.suit
    );

    if (cardIndex === -1) {
      return "You do not have that card.";
    }

    if (!leadSuit) return null;

    const hasLeadSuit = hand.some(
      c => getEffectiveSuit(c, trump) === leadSuit
    );

    if (
      hasLeadSuit &&
      getEffectiveSuit(card, trump) !== leadSuit
    ) {
      return "You must follow suit.";
    }

    return null;
  }

  sendInvalidMove(playerIndex, message) {

    const seat = this.room.seats[playerIndex];

    if (!seat?.socket) return;

    this.invalidMoveCounts[playerIndex] ??= 0;
    this.invalidMoveCounts[playerIndex]++;

    // 🔥 Rate limit: 5 bad attempts max
    if (this.invalidMoveCounts[playerIndex] > 5) {
      seat.socket.emit("game_event", {
        type: "invalid_move_fatal",
        message: "Too many invalid attempts."
      });
      throw new Error(`Player ${playerIndex} exceeded invalid move limit`);
    }

    seat.socket.emit("game_event", {
      type: "invalid_move",
      message
    });
  }

  /* ============================= */
  /* ========= SCORING =========== */
  /* ============================= */

  scoreRound(tricksWon, makerTeam) {
    const defendingTeam = 1 - makerTeam;

    if (tricksWon[makerTeam] >= 3) {
      this.scores[`team${makerTeam}`] +=
        tricksWon[makerTeam] === 5 ? 2 : 1;
    } else {
      this.scores[`team${defendingTeam}`] += 2;
    }
  }
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

