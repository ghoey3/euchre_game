import { createDeck, shuffle } from "../../engine/deck.js";
import { determineTrickWinner } from "../../engine/trickLogic.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";

export default class AIGameEngine {
  constructor(players, options = {}) {
    this.players = players;
    this.winningScore = options.winningScore ?? 10;
    this.trackStats = options.trackStats ?? false;

    this.dealerIndex = 0;
    this.scores = { team0: 0, team1: 0 };

    if (this.trackStats) {
      this.resetStats();
    }
  }

  /* ============================= */
  /* ========= GAME LOOP ========= */
  /* ============================= */

  playGame() {
    this.scores = { team0: 0, team1: 0 };

    while (!this.isGameOver()) {
      this.playRound();
      this.rotateDealer();
    }

    if (this.trackStats) {
      if (this.scores.team0 > this.scores.team1) {
        this.stats.team0Wins++;
      } else {
        this.stats.team1Wins++;
      }
    }

    return this.scores;
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
  /* ========= ROUND LOGIC ======= */
  /* ============================= */
  playRound() {
    if (this.trackStats) this.stats.totalRounds++;

    this.playedCards = [];
    this.voidInfo = { 0:{},1:{},2:{},3:{} };

    const deck = shuffle(createDeck());
    const hands = this.dealCards(deck);
    const upcard = deck.pop();

    let trump = null;
    let makerTeam = null;
    let alonePlayerIndex = null;

    /* ============================= */
    /* ===== FIRST ROUND BIDDING === */
    /* ============================= */

    for (let i = 1; i <= 4; i++) {
        const playerIndex = (this.dealerIndex + i) % 4;

        const context = {
        phase: "order_up",
        hand: hands[playerIndex],
        upcard,
        dealerIndex: this.dealerIndex,
        myIndex: playerIndex,
        score: this.scores
        };

        const action = this.players[playerIndex].getAction(context);

        /* -------- VALIDATE ACTION -------- */

        if (!action || action.type !== "order_up") {
        throw new Error(
            `Player ${playerIndex} returned invalid order_up action`
        );
        }

        if (typeof action.call !== "boolean") {
        throw new Error(
            `Player ${playerIndex} order_up missing call boolean`
        );
        }

        if (!action.call) continue;

        /* -------- APPLY ORDER UP -------- */

        trump = upcard.suit;
        makerTeam = this.getTeam(playerIndex);
        alonePlayerIndex = action.alone ? playerIndex : null;

        if (this.trackStats && action.alone) {
        this.stats.aloneCalls++;
        }

        /* -------- DEALER PICKUP -------- */

        hands[this.dealerIndex].push(upcard);

        const discard = this.players[this.dealerIndex].getAction({
        phase: "discard",
        hand: hands[this.dealerIndex],
        trump,
        dealerIndex: this.dealerIndex
        });

        /* -------- VALIDATE DISCARD -------- */

        if (!discard || discard.type !== "discard") {
        throw new Error("Dealer returned invalid discard action");
        }

        if (!discard.card) {
        throw new Error("Dealer discard missing card");
        }

        const discardIndex = hands[this.dealerIndex].findIndex(
        c =>
            c.rank === discard.card.rank &&
            c.suit === discard.card.suit
        );

        if (discardIndex === -1) {
        throw new Error(
            "Dealer attempted to discard a card not in hand"
        );
        }

        hands[this.dealerIndex].splice(discardIndex, 1);
        this.playedCards.push(discard.card);

        break;
    }

    /* ============================= */
    /* ===== SECOND ROUND BIDDING == */
    /* ============================= */

    if (!trump) {
        for (let i = 1; i <= 4; i++) {
        const playerIndex = (this.dealerIndex + i) % 4;

        const baseContext = {
            hand: hands[playerIndex],
            upcard,
            dealerIndex: this.dealerIndex,
            myIndex: playerIndex,
            score: this.scores
        };

        let action = this.players[playerIndex].getAction({
            ...baseContext,
            phase: "call_trump"
        });

        if (!action || action.type !== "call_trump") {
            throw new Error(
            `Player ${playerIndex} returned invalid call_trump action`
            );
        }

        if (i === 4 && !action.call) {
            action = this.players[playerIndex].getAction({
            ...baseContext,
            phase: "call_trump_forced"
            });

            if (!action || action.type !== "call_trump_forced") {
            throw new Error(
                `Dealer ${playerIndex} returned invalid forced call`
            );
            }

            action.call = true; // forced must call
        }

        if (!action.call) continue;

        if (!action.suit) {
            throw new Error(
            `Player ${playerIndex} called trump without suit`
            );
        }

        if (action.suit === upcard.suit) {
            throw new Error(
            `Illegal trump call: cannot call upcard suit in second round`
            );
        }

        trump = action.suit;
        makerTeam = this.getTeam(playerIndex);
        alonePlayerIndex = action.alone ? playerIndex : null;

        if (this.trackStats && action.alone) {
            this.stats.aloneCalls++;
        }

        break;
        }
    }

    /* ============================= */
    /* ===== SAFETY CHECK ========= */
    /* ============================= */

    if (!trump) {
        throw new Error("No trump selected after bidding phase");
    }

    /* ============================= */
    /* ===== PLAY TRICKS ========== */
    /* ============================= */

    const tricksWon = this.playTricks(
        hands,
        trump,
        alonePlayerIndex,
        makerTeam
    );

    this.scoreRound(tricksWon, makerTeam, alonePlayerIndex);
    }

  /* ============================= */
  /* ========= TRICKS ============ */
  /* ============================= */

  playTricks(hands, trump, alonePlayerIndex, makerTeam) {

    let leader = this.simLeader ?? (this.dealerIndex + 1) % 4;

    const tricksWon = this.simTricksWon
      ? [this.simTricksWon.team0, this.simTricksWon.team1]
      : [0, 0];

    // ⭐ clone — never share reference
    let played_cards = this.simPlayedCards
      ? [...this.simPlayedCards]
      : [];

    const partnerIndex =
      alonePlayerIndex !== null
        ? (alonePlayerIndex + 2) % 4
        : null;

    const tricksCompleted = tricksWon[0] + tricksWon[1];

    for (let trick = 0; trick < 5 - tricksCompleted; trick++) {

      let trickCards =
        trick === 0 && this.simTrickCards?.length
          ? this.simTrickCards.map(t => ({ ...t }))
          : [];

      let leadSuit =
        trick === 0
          ? this.simLeadSuit ?? null
          : null;

      const playOrder = [];

      for (let i = 0; i < 4; i++) {

        const p = (leader + i) % 4;

        if (p === partnerIndex) continue;

        // skip players who already played
        if (!trickCards.some(t => t.player === p)) {
          playOrder.push(p);
        }
      }

      for (let playerIndex of playOrder) {

        const action = this.players[playerIndex].getAction({
          phase: "play_card",
          hand: hands[playerIndex],
          trump,
          trickCards,
          leadSuit,
          played_cards,
          trickLeader: leader,
          myIndex: playerIndex,
          alonePlayerIndex,
          voidInfo: this.voidInfo,
          tricksSoFar: {
            team0: tricksWon[0],
            team1: tricksWon[1]
          },
          makerTeam
        });

        if (!action || action.type !== "play_card" || !action.card) {
          throw new Error(`Invalid play from player ${playerIndex}`);
        }

        const card = action.card;
        const hand = hands[playerIndex];

        const cardIndex = hand.findIndex(
          c => c.rank === card.rank && c.suit === card.suit
        );

        if (cardIndex === -1) {
          throw new Error(`Illegal play: player ${playerIndex} does not have card`);
        }

        if (leadSuit) {

          const hasLeadSuit = hand.some(
            c => getEffectiveSuit(c, trump) === leadSuit
          );

          const effective = getEffectiveSuit(card, trump);

          if (hasLeadSuit && effective !== leadSuit) {
            throw new Error(`Illegal play: player ${playerIndex} failed to follow suit`);
          }
        }

        played_cards.push(card);
        hand.splice(cardIndex, 1);

        if (!leadSuit) {
          leadSuit = getEffectiveSuit(card, trump);
        }

        trickCards.push({ player: playerIndex, card });
        this.playedCards.push(card);
      }

      if (!trickCards.length) continue;

      const winnerOffset = determineTrickWinner(
        trickCards.map(t => t.card),
        leadSuit,
        trump
      );

      const winner = trickCards[winnerOffset].player;

      tricksWon[this.getTeam(winner)]++;
      leader = winner;
    }

    return tricksWon;
  }
  /* ============================= */
  /* ========= SCORING =========== */
  /* ============================= */

  scoreRound(tricksWon, makerTeam, alonePlayerIndex) {
    const defending = 1 - makerTeam;
    const makerTricks = tricksWon[makerTeam];

    if (makerTricks >= 3) {
      if (makerTricks === 5) {
        this.scores[`team${makerTeam}`] += 2;
        if (this.trackStats) {
          this.stats.sweeps++;
          if (alonePlayerIndex !== null) this.stats.aloneSweeps++;
        }
      } else {
        this.scores[`team${makerTeam}`] += 1;
        if (this.trackStats && alonePlayerIndex !== null) {
          this.stats.aloneWins++;
        }
      }
    } else {
      this.scores[`team${defending}`] += 2;
      if (this.trackStats) {
        this.stats.euchres++;
        if (alonePlayerIndex !== null) this.stats.aloneEuchres++;
      }
    }
  }

  /* ============================= */
  /* ========= HELPERS =========== */
  /* ============================= */

  dealCards(deck) {
    const hands = { 0:[],1:[],2:[],3:[] };

    for (let i = 0; i < 5; i++) {
      for (let j = 1; j <= 4; j++) {
        const playerIndex = (this.dealerIndex + j) % 4;
        hands[playerIndex].push(deck.pop());
      }
    }

    return hands;
  }

  removeCardFromHand(hand, card) {
    const index = hand.findIndex(
      c => c.rank === card.rank && c.suit === card.suit
    );

    if (index === -1) {
      throw new Error("Invalid card removal");
    }

    hand.splice(index, 1);
  }

  /* ============================= */
  /* ========= STATS ============= */
  /* ============================= */

  resetStats() {
    this.stats = {
      totalRounds: 0,
      team0Wins: 0,
      team1Wins: 0,
      sweeps: 0,
      euchres: 0,
      aloneCalls: 0,
      aloneSweeps: 0,
      aloneWins: 0,
      aloneEuchres: 0
    };
  }

  getStats() {
    return this.trackStats ? this.stats : null;
  }
  resetGame() {
    this.scores = { team0: 0, team1: 0 };
  }
}