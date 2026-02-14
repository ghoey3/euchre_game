import { determineTrickWinner } from "../../engine/trickLogic.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";

const DEBUG = false;

export default class OrderUpSimulator {

  constructor({
    rootContext,
    forcedCard = null,
    playoutAI,
    fixedHands,
    simulatePickup = false
  }) {

    if (!fixedHands) {
      throw new Error("OrderUpSimulator needs fixedHands");
    }

    this.ctx = JSON.parse(JSON.stringify(rootContext));
    this.ai = playoutAI;
    this.hands = JSON.parse(JSON.stringify(fixedHands));

    this.forcedCard = forcedCard;
    this.forcedUsed = false;
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

    if (this.simulatePickup && this.ctx.upcard && this.trump === this.ctx.upcard.suit) {
      this.applyPickup();
    }

    return this.playOut();
  }

  applyPickup() {

    const dealer = this.ctx.dealerIndex;

    this.hands[dealer].push(this.ctx.upcard);

    const discard = this.ai.getAction({
      phase: "discard",
      hand: this.hands[dealer],
      trump: this.trump,
      dealerIndex: dealer
    });

    this.removeCard(this.hands[dealer], discard.card);
  }

  playOut() {

    const team0 = this.ctx.tricksSoFar?.team0 ?? 0;
    const team1 = this.ctx.tricksSoFar?.team1 ?? 0;

    let tricks = [team0, team1];
    let leader = this.ctx.trickLeader;

    let trickCards = [...(this.ctx.trickCards || [])];

    if (DEBUG) {
      console.log("\n=== START PLAYOUT ===");
      console.log("Leader:", leader);
      console.log("Initial trick:", trickCards);
      console.log("Tricks so far:", tricks);
    }

    if (trickCards.length > 0) {
      leader = this.finishTrick(trickCards, leader, tricks);
    }

    while (tricks[0] + tricks[1] < 5) {

      trickCards = [];
      let leadSuit = null;

      for (let offset = 0; offset < 4; offset++) {

        const player = (leader + offset) % 4;

        if (DEBUG) {
          console.log("\n------ TURN DEBUG ------");
          console.log("Leader:", leader);
          console.log("Offset:", offset);
          console.log("Player:", player);
          console.log("Trick size:", trickCards.length);
          console.log("Trick cards:", trickCards);
          console.log("Lead suit:", leadSuit);
          console.log("Player hand:", this.hands[player]);
        }

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

          if (DEBUG) console.log("FORCED MOVE:", card);
        } else {

          const action = this.ai.getAction({
            phase: "play_card",
            hand: this.hands[player],
            trump: this.trump,
            trickCards,
            leadSuit,
            trickLeader: leader,
            myIndex: player,
            makerTeam: this.ctx.makerTeam,
            alonePlayerIndex: this.ctx.alonePlayerIndex,
            voidInfo: this.ctx.voidInfo || {0:{},1:{},2:{},3:{}},
            played_cards: this.playedCards
          });

          card = action?.card;
        }

        if (!card) {
          console.error("=== ROLLOUT FAILURE ===");
          console.error("Player:", player);
          console.error("Hand:", this.hands[player]);
          console.error("Trick:", trickCards);
          console.error("Lead suit:", leadSuit);
          throw new Error("Rollout returned no card");
        }

        if (!leadSuit) {
          leadSuit = getEffectiveSuit(card, this.trump);
        }

        card = this.enforceLegalPlay(player, card, leadSuit);

        this.removeCard(this.hands[player], card);
        this.playedCards.push(card);

        trickCards.push({ player, card });
      }

      const winnerOffset = determineTrickWinner(
        trickCards.map(t => t.card),
        leadSuit,
        this.trump
      );

      leader = trickCards[winnerOffset].player;
      tricks[leader % 2]++;

      if (DEBUG) {
        console.log("Trick winner:", leader);
        console.log("Score:", tricks);
      }
    }

    return tricks[0] - tricks[1];
  }

  finishTrick(trickCards, leader, tricks) {

    let leadSuit = getEffectiveSuit(trickCards[0].card, this.trump);

    for (let i = trickCards.length; i < 4; i++) {

      const player = (leader + i) % 4;

      if (DEBUG) {
        console.log("FINISH TRICK TURN:", player);
        console.log("Existing trick:", trickCards);
      }

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

        if (DEBUG) console.log("FORCED MID-TRICK:", card);
      } else {

        const action = this.ai.getAction({
          phase: "play_card",
          hand: this.hands[player],
          trump: this.trump,
          trickCards,
          leadSuit,
          trickLeader: leader,
          myIndex: player,
          played_cards: this.playedCards
        });

        card = action?.card;
      }

      if (!card) {
        throw new Error("finishTrick — no card");
      }

      card = this.enforceLegalPlay(player, card, leadSuit);

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

    return winner;
  }

  enforceLegalPlay(player, card, leadSuit) {

    const hand = this.hands[player];

    const follow = hand.filter(c =>
      getEffectiveSuit(c, this.trump) === leadSuit
    );

    if (follow.length === 0) return card;

    const legal = follow.some(c =>
      c.rank === card.rank && c.suit === card.suit
    );

    if (!legal) {
      console.warn("Simulator corrected illegal play");
      return follow[0];
    }

    return card;
  }

  removeCard(hand, card) {

    const idx = hand.findIndex(
      c => c.rank === card.rank && c.suit === card.suit
    );

    if (idx === -1) {

      console.error("=== SIM ERROR ===");
      console.error("Trying to remove:", card);
      console.error("Hand was:", hand);
      console.error("Context:", this.ctx);

      throw new Error("Card removal failed — inconsistent sim");
    }

    hand.splice(idx, 1);
  }
}