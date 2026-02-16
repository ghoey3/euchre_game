import { determineTrickWinner } from "../../engine/trickLogic.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";
import { cloneCtx, cloneHands } from "./simClone.js";


const DEBUG = false;

export default class OrderUpSimulator {

  constructor({
    rootContext,
    playoutAI,
    aiFactory,
    fixedHands,
    simulatePickup = false
  }) {

    if (!fixedHands) {
      throw new Error("OrderUpSimulator needs fixedHands");
    }
    this.ctx = cloneCtx(rootContext);
    this.hands = cloneHands(fixedHands);

    // Build per-player AI table
    if (aiFactory) {
      this.ais = {
        0: aiFactory(0),
        1: aiFactory(1),
        2: aiFactory(2),
        3: aiFactory(3)
      };
    } else if (playoutAI) {
      this.ais = {
        0: playoutAI,
        1: playoutAI,
        2: playoutAI,
        3: playoutAI
      };
    } else {
      throw new Error("Need playoutAI or aiFactory");
    }

    this.simulatePickup = simulatePickup;

    this.trump = this.ctx.trump;
    this.myIndex = this.ctx.myIndex;

    this.playedCards = [...(this.ctx.playedCards || [])];

    if (this.ctx.trickLeader === undefined || this.ctx.trickLeader === null) {
      if (this.ctx.dealerIndex !== undefined) {
        this.ctx.trickLeader = (this.ctx.dealerIndex + 1) % 4;
      } else {
        throw new Error("Cannot determine trick leader");
      }
    }
  }

  run() {

    if (
      this.simulatePickup &&
      this.ctx.upcard &&
      this.trump === this.ctx.upcard.suit
    ) {
      this.applyPickup();
    }

    return this.playOut();
  }

  /* ================= PICKUP ================= */

  applyPickup() {

    const dealer = this.ctx.dealerIndex;
    const ai = this.ais[dealer];

    this.hands[dealer].push(this.ctx.upcard);

    const discard = ai.getAction({
      phase: "discard",
      hand: this.hands[dealer],
      trump: this.trump,
      dealerIndex: dealer
    });

    if (!discard || !discard.card) {
      throw new Error("Discard failed during pickup");
    }

    this.removeCard(this.hands[dealer], discard.card);

    if (this.hands[dealer].length !== 5) {
      throw new Error("Pickup hand size wrong");
    }
  }

  /* ================= PLAYOUT ================= */

  playOut() {

    let tricks = [
      this.ctx.tricksSoFar?.team0 ?? 0,
      this.ctx.tricksSoFar?.team1 ?? 0
    ];

    let leader = this.ctx.trickLeader;

    let trickCards = [...(this.ctx.trickCards || [])];

    if (trickCards.length > 0) {
      leader = this.finishTrick(trickCards, leader, tricks);
    }

    while (tricks[0] + tricks[1] < 5) {

      trickCards = [];
      let leadSuit = null;

      for (let offset = 0; offset < 4; offset++) {

        const player = (leader + offset) % 4;
        const ai = this.ais[player];

        const action = ai.getAction({
          phase: "play_card",
          hand: this.hands[player],
          trump: this.trump,
          trickCards: [...trickCards],
          leadSuit,
          trickLeader: leader,
          myIndex: player,
          makerTeam: this.ctx.makerTeam,
          alonePlayerIndex: this.ctx.alonePlayerIndex,
          voidInfo: this.ctx.voidInfo || {0:{},1:{},2:{},3:{}},
          playedCards: [...this.playedCards]
        });

        if (!action || !action.card) {
          throw new Error("Rollout returned no card");
        }

        let card = action.card;

        if (!leadSuit) {
          leadSuit = getEffectiveSuit(card, this.trump);
        }

        card = this.enforceLegalPlay(player, card, leadSuit);

        this.removeCard(this.hands[player], card);

        trickCards.push({ player, card });
      }

      const winnerOffset = determineTrickWinner(
        trickCards.map(t => t.card),
        leadSuit,
        this.trump
      );

      leader = trickCards[winnerOffset].player;
      tricks[leader % 2]++;
      for (const t of trickCards) {
        this.playedCards.push(t.card);
      }
      trickCards = [];
    }

 
    const result = this.scoreRound(
      tricks,
      this.ctx.makerTeam,
      this.ctx.alonePlayerIndex ?? null
    );
    
    return result
  }

  /* ================= FINISH TRICK ================= */

  finishTrick(trickCards, leader, tricks) {

    let leadSuit = getEffectiveSuit(trickCards[0].card, this.trump);

    for (let i = trickCards.length; i < 4; i++) {

      const player = (leader + i) % 4;
      const ai = this.ais[player];

      const action = ai.getAction({
        phase: "play_card",
        hand: this.hands[player],
        trump: this.trump,
        trickCards: [...trickCards],
        leadSuit,
        trickLeader: leader,
        myIndex: player,
        playedCards: [...this.playedCards]
      });

      if (!action || !action.card) {
        throw new Error("finishTrick — no card");
      }

      let card = this.enforceLegalPlay(player, action.card, leadSuit);

      this.removeCard(this.hands[player], card);
      this.playedCards.push(card);

      trickCards.push({ player, card });
    }

    const winnerOffset = determineTrickWinner(
      trickCards.map(t => t.card),
      leadSuit,
      this.trump
    );

    const winner = trickCards[winnerOffset].player;
    tricks[winner % 2]++;
    for (const t of trickCards) {
      this.playedCards.push(t.card);
    }
    return winner;
  }

  /* ================= HELPERS ================= */

  enforceLegalPlay(player, card, leadSuit) {

    const hand = this.hands[player];

    const follow = hand.filter(c =>
      getEffectiveSuit(c, this.trump) === leadSuit
    );

    if (!follow.length) return card;

    const legal = follow.some(c =>
      c.rank === card.rank && c.suit === card.suit
    );

    return legal ? card : follow[0];
  }

  scoreRound(tricks, makerTeam, alonePlayerIndex) {

    const makers = tricks[makerTeam];

    if (makers >= 3) {

      if (alonePlayerIndex !== null && makers === 5) return 4;
      if (makers === 5) return 2;

      return 1;

    } else {

      return -2;

    }
  }

  removeCard(hand, card) {

    const idx = hand.findIndex(
      c => c.rank === card.rank && c.suit === card.suit
    );

    if (idx === -1) {
      throw new Error("Card removal failed — inconsistent sim");
    }

    hand.splice(idx, 1);
  }
}