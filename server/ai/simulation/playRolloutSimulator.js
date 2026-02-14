import { determineTrickWinner } from "../../engine/trickLogic.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";

const DEBUG = true;

export default class PlayRolloutSim {

  constructor({ context, fixedHands, playoutAI }) {

    this.ctx = JSON.parse(JSON.stringify(context));
    this.hands = JSON.parse(JSON.stringify(fixedHands));
    this.ai = playoutAI;

    this.trump = this.ctx.trump;
    this.myIndex = this.ctx.myIndex;

    this.leader =
      this.ctx.trickLeader ??
      ((this.ctx.dealerIndex + 1) % 4);

    this.playedCards = [...(this.ctx.playedCards || [])];

    // Remove cards already played in current trick
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

    let tricks = [
      this.ctx.tricksSoFar?.team0 ?? 0,
      this.ctx.tricksSoFar?.team1 ?? 0
    ];

    let trickCards = [...(this.ctx.trickCards || [])];

    if (trickCards.length > 0) {
      this.leader = this.finishTrick(trickCards, tricks);
    }

    while (tricks[0] + tricks[1] < 5) {

      // Stop if no cards left
      if (this.totalCardsLeft() === 0) break;

      trickCards = [];
      let leadSuit = null;

      for (let offset = 0; offset < 4; offset++) {

        const player = (this.leader + offset) % 4;
        const hand = this.hands[player];

        if (!hand.length) break;

        const action = this.ai.getAction({
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
          console.error("AI returned no card");
          console.error("Hand:", hand);
          console.error("Trick:", trickCards);
          throw new Error("Null play");
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

    return tricks[0] - tricks[1];
  }

  finishTrick(trickCards, tricks) {

    let leadSuit = getEffectiveSuit(trickCards[0].card, this.trump);

    for (let i = trickCards.length; i < 4; i++) {

      const player = (this.leader + i) % 4;
      const hand = this.hands[player];

      if (!hand.length) break;

      const action = this.ai.getAction({
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
        console.error("AI returned no card (finishTrick)");
        console.error("Hand:", hand);
        throw new Error("Null play");
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
      console.error("Card:", card);
      console.error("Player hand:", hand);
      console.error("Full hands:", this.hands);
      console.error("Current trick:", trickCards);
      console.error("Played:", this.playedCards);
      console.error("======================");
      throw new Error("Rollout removal failed — state drift");
    }

    hand.splice(idx, 1);
  }
}