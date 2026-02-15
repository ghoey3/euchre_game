import { determineTrickWinner } from "../../engine/trickLogic.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";
import { profiler } from "../profiler.js"
const DEBUG = false;

export default class PlayRolloutSim {

  constructor({ context, fixedHands, playoutAI, aiFactory }) {

    this.ctx = JSON.parse(JSON.stringify(context));
    this.hands = JSON.parse(JSON.stringify(fixedHands));

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

    this.trump = this.ctx.trump;
    this.myIndex = this.ctx.myIndex;

    this.leader =
      this.ctx.trickLeader ??
      ((this.ctx.dealerIndex + 1) % 4);

    this.playedCards = [...(this.ctx.playedCards || [])];

    // Remove already played cards
    for (const t of (this.ctx.trickCards || [])) {
      const hand = this.hands[t.player];
      const idx = hand.findIndex(c =>
        c.rank === t.card.rank && c.suit === t.card.suit
      );
      if (idx !== -1) hand.splice(idx, 1);
    }
  }

  totalCardsLeft() {
    return Object.values(this.hands).reduce((sum,h)=>sum+h.length,0);
  }

  run() {
    const start = profiler.start("rollout");


    let tricks = [
      this.ctx.tricksSoFar?.team0 ?? 0,
      this.ctx.tricksSoFar?.team1 ?? 0
    ];

    let trickCards = [...(this.ctx.trickCards || [])];

    if (trickCards.length > 0) {
      this.leader = this.finishTrick(trickCards, tricks);
    }

    while (tricks[0] + tricks[1] < 5) {

      if (this.totalCardsLeft() === 0) break;

      trickCards = [];
      let leadSuit = null;

      for (let offset = 0; offset < 4; offset++) {

        const player = (this.leader + offset) % 4;
        const hand = this.hands[player];
        const ai = this.ais[player];

        if (!hand.length) break;

        const action = ai.getAction({
          phase: "play_card",
          hand,
          trump: this.trump,
          trickCards,
          leadSuit,
          trickLeader: this.leader,
          myIndex: player,
          played_cards: this.playedCards
        });

        if (!action || !action.card) {
          throw new Error("Rollout returned no card");
        }

        let card = action.card;

        if (!leadSuit) {
          leadSuit = getEffectiveSuit(card, this.trump);
        }

        card = this.enforceLegal(player, card, leadSuit);

        this.removeCard(hand, card, trickCards);

        this.playedCards.push(card);
        trickCards.push({ player, card });
      }

      if (trickCards.length < 4) break;

      const winOffset = determineTrickWinner(
        trickCards.map(t => t.card),
        leadSuit,
        this.trump
      );

      this.leader = trickCards[winOffset].player;
      tricks[this.leader % 2]++;
    }

    profiler.end("rollout", start);
    return tricks[0] - tricks[1];
  }

  finishTrick(trickCards, tricks) {

    let leadSuit = getEffectiveSuit(trickCards[0].card, this.trump);

    for (let i = trickCards.length; i < 4; i++) {

      const player = (this.leader + i) % 4;
      const hand = this.hands[player];
      const ai = this.ais[player];

      if (!hand.length) break;

      const action = ai.getAction({
        phase: "play_card",
        hand,
        trump: this.trump,
        trickCards,
        leadSuit,
        trickLeader: this.leader,
        myIndex: player,
        played_cards: this.playedCards
      });

      if (!action || !action.card) {
        throw new Error("finishTrick returned no card");
      }

      let card = this.enforceLegal(player, action.card, leadSuit);

      this.removeCard(hand, card, trickCards);

      this.playedCards.push(card);
      trickCards.push({ player, card });
    }

    if (trickCards.length < 4) return this.leader;

    const winOffset = determineTrickWinner(
      trickCards.map(t => t.card),
      leadSuit,
      this.trump
    );

    const winner = trickCards[winOffset].player;
    tricks[winner % 2]++;

    return winner;
  }

  enforceLegal(player, card, leadSuit) {

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

  removeCard(hand, card, trickCards) {

    const idx = hand.findIndex(c =>
      c.rank === card.rank && c.suit === card.suit
    );

    if (idx === -1) {
      console.error("=== DRIFT DETECTED ===");
      throw new Error("Rollout removal failed — state drift");
    }

    hand.splice(idx, 1);
  }
}