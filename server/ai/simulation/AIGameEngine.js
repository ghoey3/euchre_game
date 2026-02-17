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
    this.stats = null;
    if (this.trackStats) {
      this.resetStats();
    }

    this.resetContract();
  }

  /* ================= CONTRACT ================= */

  resetContract() {
    this.trump = null;
    this.makerIndex = null;
    this.makerTeam = null;
    this.alonePlayerIndex = null;
    this.dealerPickedUp = false;
  }

  /* ================= CONTEXT BUILDER ================= */

  buildBaseContext(playerIndex) {
    return {
      myIndex: playerIndex,
      dealerIndex: this.dealerIndex,

      trump: this.trump,
      upcard: this.upcard,

      makerIndex: this.makerIndex,
      makerTeam: this.makerTeam,
      alonePlayerIndex: this.alonePlayerIndex,
      dealerPickedUp: this.dealerPickedUp,

      playedCards: this.playedCards,
      voidInfo: this.voidInfo,

      cardsRemaining: this.cardsRemaining,

      score: this.scores,
    };
  }

  /* ================= GAME LOOP ================= */

  playGame() {
    this.scores = { team0: 0, team1: 0 };
    if (this.trackStats) {
      this.resetStats();
    }

    while (!this.isGameOver()) {
      this.playRound();
      this.rotateDealer();
    }

    if (this.trackStats) {
      const winner = this.scores.team0 > this.scores.team1 ? 0 : 1;
      this.stats.team[winner].wins++;
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

  getTeam(i) {
    return i % 2;
  }

  /* ================= ROUND ================= */

  playRound() {
    this.resetContract();

    this.playedCards = [];
    this.voidInfo = {0:{},1:{},2:{},3:{}};

    const deck = shuffle(createDeck());
    const hands = this.dealCards(deck);

    this.cardsRemaining = {
      0: hands[0].length,
      1: hands[1].length,
      2: hands[2].length,
      3: hands[3].length
    };

    this.upcard = deck.pop();

    /* ===== ORDER UP ROUND ===== */

    for (let i = 1; i <= 4; i++) {

      const p = (this.dealerIndex + i) % 4;

      const action = this.players[p].getAction({
        phase: "order_up",
        hand: hands[p],
        ...this.buildBaseContext(p)
      });

      if (!action.call) continue;

      this.trump = this.upcard.suit;
      this.makerIndex = p;
      this.makerTeam = this.getTeam(p);
      this.alonePlayerIndex = action.alone ? p : null;
      if (this.trackStats && this.alonePlayerIndex !== null) {
        this.stats.aloneCalls++;
      }

      hands[this.dealerIndex].push(this.upcard);
      this.dealerPickedUp = true;

      const discard = this.players[this.dealerIndex].getAction({
        phase: "discard",
        hand: hands[this.dealerIndex],
        trump: this.trump,
        dealerIndex: this.dealerIndex
      });

      const idx = hands[this.dealerIndex].findIndex(
        c => c.rank === discard.card.rank && c.suit === discard.card.suit
      );

      hands[this.dealerIndex].splice(idx, 1);
      break;
    }

    /* ===== CALL TRUMP ROUND ===== */

    if (!this.trump) {

      for (let i = 1; i <= 4; i++) {

        const p = (this.dealerIndex + i) % 4;

        let action = this.players[p].getAction({
          phase: "call_trump",
          hand: hands[p],
          ...this.buildBaseContext(p)
        });

        if (i === 4 && !action.call) {
          action = this.players[p].getAction({
            phase: "call_trump_forced",
            hand: hands[p],
            ...this.buildBaseContext(p)
          });
          action.call = true;
        }

        if (!action.call) continue;

        this.trump = action.suit;
        this.makerIndex = p;
        this.makerTeam = this.getTeam(p);
        this.alonePlayerIndex = action.alone ? p : null;
        if (this.trackStats && this.alonePlayerIndex !== null) {
          this.stats.aloneCalls++;
        }
        this.dealerPickedUp = false;

        break;
      }
    }

    if (!this.trump) throw new Error("No trump selected");

    const tricksWon = this.playTricks(hands);

    this.scoreRound(tricksWon);
    if (this.trackStats) {
      this.stats.totalRounds++;
    }
  }

  /* ================= TRICKS ================= */

  playTricks(hands) {

    let leader = (this.dealerIndex + 1) % 4;
    const tricksWon = [0,0];

    const partner =
      this.alonePlayerIndex !== null
        ? (this.alonePlayerIndex + 2) % 4
        : null;

    for (let t = 0; t < 5; t++) {

      let trickCards = [];
      let leadSuit = null;

      for (let i = 0; i < 4; i++) {

        const p = (leader + i) % 4;
        if (p === partner) continue;

        const action = this.players[p].getAction({
          phase: "play_card",
          hand: hands[p],
          trickCards,
          leadSuit,
          tricksSoFar: {
            team0: tricksWon[0],
            team1: tricksWon[1]
          },
          ...this.buildBaseContext(p)
        });

        const card = action.card;
        const hand = hands[p];

        const idx = hand.findIndex(
          c => c.rank === card.rank && c.suit === card.suit
        );

        if (idx === -1) throw new Error("Illegal play");

        if (leadSuit) {
          const hasSuit = hand.some(
            c => getEffectiveSuit(c, this.trump) === leadSuit
          );
          if (hasSuit && getEffectiveSuit(card, this.trump) !== leadSuit) {
            throw new Error("Failed to follow suit");
          }
        }

        hand.splice(idx, 1);
        this.cardsRemaining[p]--;

        if (!leadSuit) {
          leadSuit = getEffectiveSuit(card, this.trump);
        }

        trickCards.push({ player:p, card });
      }

      const winnerOffset = determineTrickWinner(
        trickCards.map(t=>t.card),
        leadSuit,
        this.trump
      );

      const winner = trickCards[winnerOffset].player;
      tricksWon[this.getTeam(winner)]++;
      leader = winner;

      for (const t of trickCards) {
        this.playedCards.push(t.card);
      }
    }

    return tricksWon;
  }

  /* ================= SCORING ================= */

  scoreRound(tricksWon) {

    const defending = 1 - this.makerTeam;
    const makerTricks = tricksWon[this.makerTeam];
    const isSweep = makerTricks === 5;
    const isEuchre = makerTricks < 3;
    const isAlone = this.alonePlayerIndex !== null;

    if (!isEuchre) {
      if (isAlone && isSweep) {
        this.scores[`team${this.makerTeam}`] += 4;
      } else if (isSweep) {
        this.scores[`team${this.makerTeam}`] += 2;
      } else {
        this.scores[`team${this.makerTeam}`] += 1;
      }
    } else {
      this.scores[`team${defending}`] += 2;
    }

    if (this.trackStats) {
      if (isSweep) this.stats.sweeps++;
      if (isEuchre) this.stats.euchres++;

      if (isAlone) {
        if (isSweep) this.stats.aloneSweeps++;
        else if (isEuchre) this.stats.aloneEuchres++;
        else this.stats.aloneWins++;
      }

      if (isEuchre) {
        this.stats.team[defending].euchresInflicted++;
        this.stats.team[this.makerTeam].euchresSuffered++;
      }

      this.stats.roundLogs.push({
        makerTeam: this.makerTeam,
        makerIndex: this.makerIndex,
        alonePlayerIndex: this.alonePlayerIndex,
        dealerIndex: this.dealerIndex,
        tricksWon: [...tricksWon]
      });
    }
  }

  /* ================= HELPERS ================= */

  dealCards(deck) {
    const hands = {0:[],1:[],2:[],3:[]};

    for (let i=0;i<5;i++) {
      for (let j=1;j<=4;j++) {
        const p = (this.dealerIndex + j) % 4;
        hands[p].push(deck.pop());
      }
    }

    return hands;
  }
  resetGame() {
    this.scores = { team0: 0, team1: 0 };
    if (this.trackStats) this.resetStats();
    this.resetContract();
  }

  resetStats() {
    this.stats = {
      totalRounds: 0,
      sweeps: 0,
      euchres: 0,
      aloneCalls: 0,
      aloneSweeps: 0,
      aloneWins: 0,
      aloneEuchres: 0,
      roundLogs: [],
      team: {
        0: { euchresInflicted: 0, euchresSuffered: 0, wins: 0 },
        1: { euchresInflicted: 0, euchresSuffered: 0, wins: 0 }
      }
    };
  }
}