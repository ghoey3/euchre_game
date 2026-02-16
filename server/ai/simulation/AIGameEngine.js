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

  /* ================= GAME LOOP ================= */

  playGame() {

    this.scores = { team0: 0, team1: 0 };

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

  getTeam(playerIndex) {
    return playerIndex % 2;
  }

  /* ================= ROUND ================= */

  playRound() {

    if (this.trackStats) {
      this.currentRoundLog = {};
      this.stats.totalRounds++;
    }

    this.playedCards = [];
    this.voidInfo = { 0:{},1:{},2:{},3:{} };

    const deck = shuffle(createDeck());
    const hands = this.dealCards(deck);
    this.cardsRemaining = {
      0: hands[0].length,
      1: hands[1].length,
      2: hands[2].length,
      3: hands[3].length
    };
    const upcard = deck.pop();

    let trump = null;
    let makerTeam = null;
    let alonePlayerIndex = null;
    let dealerPickedUp = false; // ⭐ NEW

    /* ===== FIRST ROUND ===== */

    for (let i = 1; i <= 4; i++) {

      const playerIndex = (this.dealerIndex + i) % 4;

      const action = this.players[playerIndex].getAction({
        phase: "order_up",
        hand: hands[playerIndex],
        upcard,
        dealerIndex: this.dealerIndex,
        myIndex: playerIndex,
        score: this.scores,
        tricksSoFar: {
            team0: 0,
            team1: 0
         },
        cardsRemaining: {
          0: hands[0].length,
          1: hands[1].length,
          2: hands[2].length,
          3: hands[3].length
        },
      });

      if (!action.call) continue;

      trump = upcard.suit;
      makerTeam = this.getTeam(playerIndex);
      alonePlayerIndex = action.alone ? playerIndex : null;

      hands[this.dealerIndex].push(upcard);
      dealerPickedUp = true; // ⭐ IMPORTANT

      const discard = this.players[this.dealerIndex].getAction({
        phase: "discard",
        hand: hands[this.dealerIndex],
        trump,
        tricksSoFar: {
          team0: 0,
          team1: 0
        },
        dealerIndex: this.dealerIndex
      });

      const idx = hands[this.dealerIndex].findIndex(
        c => c.rank === discard.card.rank && c.suit === discard.card.suit
      );

      hands[this.dealerIndex].splice(idx, 1);

      break;
    }

    /* ===== SECOND ROUND ===== */

    if (!trump) {

      for (let i = 1; i <= 4; i++) {

        const playerIndex = (this.dealerIndex + i) % 4;

        let action = this.players[playerIndex].getAction({
          phase: "call_trump",
          hand: hands[playerIndex],
          upcard,
          dealerIndex: this.dealerIndex,
          myIndex: playerIndex,
          score: this.scores,
          cardsRemaining: {
            0: hands[0].length,
            1: hands[1].length,
            2: hands[2].length,
            3: hands[3].length
          },
        });

        if (i === 4 && !action.call) {
          action = this.players[playerIndex].getAction({
            phase: "call_trump_forced",
            hand: hands[playerIndex],
            upcard,
            dealerIndex: this.dealerIndex,
            myIndex: playerIndex,
            score: this.scores,
              cardsRemaining: {
              0: hands[0].length,
              1: hands[1].length,
              2: hands[2].length,
              3: hands[3].length
            },
          });
          action.call = true;
        }

        if (!action.call) continue;

        trump = action.suit;
        makerTeam = this.getTeam(playerIndex);
        alonePlayerIndex = action.alone ? playerIndex : null;

        dealerPickedUp = false; // ⭐ explicitly false

        break;
      }
    }

    if (!trump) throw new Error("No trump selected");

    const tricksWon = this.playTricks(
      hands,
      trump,
      alonePlayerIndex,
      makerTeam,
      dealerPickedUp // ⭐ pass flag
    );

    this.scoreRound(tricksWon, makerTeam, alonePlayerIndex);
  }

  /* ================= TRICKS ================= */

  playTricks(hands, trump, alonePlayerIndex, makerTeam, dealerPickedUp) {

    let leader = (this.dealerIndex + 1) % 4;
    const tricksWon = [0,0];

    const partner =
      alonePlayerIndex !== null
        ? (alonePlayerIndex + 2) % 4
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
          trump,
          trickCards,
          leadSuit,
          myIndex: p,
          makerTeam,
          alonePlayerIndex,
          leaderIndex: leader,
          playedCards: this.playedCards,
          voidInfo: this.voidInfo,
          dealerPickedUp,
          upcard: this.upcard,
          tricksSoFar: {
            team0: tricksWon[0],
            team1: tricksWon[1]
          },
          cardsRemaining: {
            0: hands[0].length,
            1: hands[1].length,
            2: hands[2].length,
            3: hands[3].length
          },
        });

        const card = action.card;
        const hand = hands[p];

        const idx = hand.findIndex(
          c => c.rank === card.rank && c.suit === card.suit
        );

        if (idx === -1) throw new Error("Illegal play");

        if (leadSuit) {
          const hasSuit = hand.some(
            c => getEffectiveSuit(c, trump) === leadSuit
          );
          if (hasSuit && getEffectiveSuit(card, trump) !== leadSuit) {
            throw new Error("Failed to follow suit");
          }
        }

        hand.splice(idx,1);
        this.cardsRemaining[p]--;
        if (!leadSuit) {
          leadSuit = getEffectiveSuit(card, trump);
        }

        trickCards.push({ player:p, card });
      }

      const winnerOffset = determineTrickWinner(
        trickCards.map(t=>t.card),
        leadSuit,
        trump
      );

      const winner = trickCards[winnerOffset].player;
      tricksWon[this.getTeam(winner)]++;
      leader = winner;

      // Only now add to history
      for (const t of trickCards) {
        this.playedCards.push(t.card);
      }

    }

    return tricksWon;
  }

  /* ================= SCORING ================= */

  scoreRound(tricksWon, makerTeam, alonePlayerIndex) {

    const defending = 1 - makerTeam;
    const makerTricks = tricksWon[makerTeam];

  if (makerTricks >= 3) {
    if (alonePlayerIndex !== null && makerTricks === 5) {
      this.scores[`team${makerTeam}`] += 4;
    } else if (makerTricks === 5) {
      this.scores[`team${makerTeam}`] += 2;
    } else {
      this.scores[`team${makerTeam}`] += 1;
    }
  } else {
    this.scores[`team${defending}`] += 2;
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

  /* ================= STATS ================= */

  resetStats() {
    this.stats = { totalRounds: 0, roundLogs: [], team: {0:{},1:{}} };
  }

  getStats() {
    return this.trackStats ? this.stats : null;
  }

  resetGame() {
    this.scores = { team0: 0, team1: 0 };
  }
}