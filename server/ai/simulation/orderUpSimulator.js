import { determineTrickWinner } from "../../engine/trickLogic.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";
import { cloneCtx, cloneHands } from "./simClone.js";
import PlayRolloutSim from "./playRolloutSimulator.js";

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

      // Apply pickup if dealer ordered up
      if (
        this.simulatePickup &&
        this.ctx.upcard &&
        this.trump === this.ctx.upcard.suit
      ) {
        this.applyPickup();
      }

      // Build rollout context
      const rolloutCtx = {
        ...this.ctx,
        hand: this.hands[this.myIndex],
        trickCards: this.ctx.trickCards ?? [],
        playedCards: this.playedCards ?? [],
        tricksSoFar: this.ctx.tricksSoFar ?? { team0: 0, team1: 0 }
      };
      if (DEBUG){ 
        console.log(rolloutCtx)
      } 
      const rollout = new PlayRolloutSim({
        context: rolloutCtx,
        fixedHands: this.hands,
        aiFactory: (seat) => this.ais[seat],
        rootPlayerIndex: this.myIndex,
        makerIndex: this.myIndex
      });

      return rollout.run();
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