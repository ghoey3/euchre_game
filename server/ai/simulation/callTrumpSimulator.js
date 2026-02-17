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
    this.ctx.makerIndex = this.ctx.myIndex;
    const rolloutCtx = {
      ...this.ctx,
      hand: this.hands[this.ctx.myIndex],
      trickCards: this.ctx.trickCards ?? [],
      playedCards: this.playedCards,
      tricksSoFar: this.ctx.tricksSoFar ?? { team0: 0, team1: 0 }
    };
    
    // console.log("=== CONTRACT calltrumpsim ===", {
    //   sim: this.constructor.name,
    //   myIndex: this.myIndex ?? this.ctx.myIndex,
    //   dealer: this.dealer ?? this.dealerIndex ?? this.ctx.dealerIndex,
    //   trump: this.ctx.trump,
    //   upcard: this.ctx.upcard?.rank + this.ctx.upcard?.suit,
    //   dealerPickedUp: this.ctx.dealerPickedUp,
    //   makerIndex: this.ctx.makerIndex,
    //   makerTeam: this.ctx.makerTeam,
    //   alone: this.ctx.alonePlayerIndex
      
    // });

    const rollout = new PlayRolloutSim({
      context: rolloutCtx,
      fixedHands: this.hands,
      aiFactory: this.aiFactory,
      rootPlayerIndex: this.ctx.myIndex
    });

    return rollout.run();
  }
}