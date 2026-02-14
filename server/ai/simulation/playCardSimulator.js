import { determineTrickWinner } from "../../engine/trickLogic.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";

const DEBUG = true;

export default class PlaySimulator {

  constructor({ context, playoutAI, fixedHands, forcedCard = null }) {

    if (!fixedHands) throw new Error("PlaySimulator needs fixedHands");

    this.ctx = JSON.parse(JSON.stringify(context));
    this.ai = playoutAI;
    this.hands = JSON.parse(JSON.stringify(fixedHands));

    this.trump = this.ctx.trump;
    this.myIndex = this.ctx.myIndex;

    this.forcedCard = forcedCard;
    this.forcedUsed = false;

    this.playedCards = [...(this.ctx.playedCards || [])];

    this.leader = this.ctx.trickLeader ?? ((this.ctx.dealerIndex + 1) % 4);
    for (const t of (this.ctx.trickCards || [])) {

      const hand = this.hands[t.player];

      const idx = hand.findIndex(c =>
          c.rank === t.card.rank && c.suit === t.card.suit
      );

      if (idx !== -1) {
          hand.splice(idx, 1);
      }
    }
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

      trickCards = [];
      let leadSuit = null;

      for (let offset = 0; offset < 4; offset++) {

        const player = (this.leader + offset) % 4;

        let card;

        const alreadyPlayed = trickCards.some(t => t.player === this.myIndex);

        if (
          player === this.myIndex &&
          this.forcedCard &&
          !this.forcedUsed &&
          !alreadyPlayed
        ) {
          card = this.forcedCard;
          this.forcedUsed = true;
        } else {

          const action = this.ai.getAction({
            phase: "play_card",
            hand: this.hands[player],
            trump: this.trump,
            trickCards,
            leadSuit,
            trickLeader: this.leader,
            myIndex: player,
            played_cards: this.playedCards
          });

          card = action.card;
        }

        if (!leadSuit) {
          leadSuit = getEffectiveSuit(card, this.trump);
        }

        card = this.enforceLegal(player, card, leadSuit);

        this.removeCard(this.hands[player], card);
        this.playedCards.push(card);

        trickCards.push({ player, card });
      }

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

      const action = this.ai.getAction({
        phase: "play_card",
        hand: this.hands[player],
        trump: this.trump,
        trickCards,
        leadSuit,
        trickLeader: this.leader,
        myIndex: player,
        played_cards: this.playedCards
      });

      let card = action.card;

      card = this.enforceLegal(player, card, leadSuit);

      this.removeCard(this.hands[player], card);
      this.playedCards.push(card);

      trickCards.push({ player, card });
    }

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

  removeCard(hand, card, player = null) {
    console.trace("REMOVE TRACE");
    const idx = hand.findIndex(c =>
      c.rank === card.rank && c.suit === card.suit
    );

    if (idx === -1) {

      const isForced =
        this.forcedCard &&
        card.rank === this.forcedCard.rank &&
        card.suit === this.forcedCard.suit;

      console.warn("\n=== REMOVE SKIPPED ===");
      console.warn("Card:", card);
      console.warn("Player:", player);
      console.warn("Is forced card:", isForced);
      console.warn("Forced used:", this.forcedUsed);
      console.warn("Hand was:", hand);
      console.warn("Trick:", this.currentTrick || []);
      console.warn("Leader:", this.currentLeader);
      console.warn("Trump:", this.trump);
      console.warn("======================\n");

      return;
    }

    hand.splice(idx, 1);
  }
}