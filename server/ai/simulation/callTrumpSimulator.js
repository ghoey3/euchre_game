import { cloneCtx, cloneHands } from "./simClone.js";
import PlayRolloutSim from "./playRolloutSimulator.js";

const DEBUG = false;

export default class CallTrumpSimulator {

  constructor({
    rootContext,
    suit,
    fixedHands,
    aiFactory
  }) {

    if (!fixedHands) {
      throw new Error("CallTrumpSimulator needs fixedHands");
    }

    this.ctx = cloneCtx(rootContext);
    this.hands = cloneHands(fixedHands);

    this.suit = suit;
    this.aiFactory = aiFactory;

    // Apply round 2 decision
    this.ctx.trump = suit;
    this.ctx.makerTeam = this.ctx.myIndex % 2;
    this.ctx.alonePlayerIndex = null;
    this.ctx.trickLeader = (this.ctx.dealerIndex + 1 ) % 4;
    this.playedCards = [...(this.ctx.playedCards || [])];
    this.ctx.cardsRemaining = {0:5,1:5,2:5,3:5};
    this.ctx.dealerPickedUp = false;
    this.ctx.upcard = rootContext.upcard;
    this.ctx.playedCards = this.playedCards;
    if (DEBUG) {
      console.log("CALL SIM", {
          suit: this.suit,
          leader: this.ctx.trickLeader,
          trump: this.ctx.trump
      });
      }
  }

  run() {

    const rolloutCtx = {
      ...this.ctx,
      hand: this.hands[this.ctx.myIndex],
      trickCards: this.ctx.trickCards ?? [],
      playedCards: this.playedCards,
      tricksSoFar: this.ctx.tricksSoFar ?? { team0: 0, team1: 0 }
    };

    const rollout = new PlayRolloutSim({
      context: rolloutCtx,
      fixedHands: this.hands,
      aiFactory: this.aiFactory,
      rootPlayerIndex: this.ctx.myIndex
    });

    return rollout.run();
  }
}