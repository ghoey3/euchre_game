import { cloneCtx, cloneHands } from "./simClone.js";
import PlayRolloutSim from "./playRolloutSimulator.js";

export class CallTrumpPassSimulator {

  constructor({
    rootContext,
    fixedHands,
    aiFactory
  }) {

    if (!fixedHands) {
      throw new Error("CallTrumpPassSimulator needs fixedHands");
    }

    this.ctx = cloneCtx(rootContext);
    this.hands = cloneHands(fixedHands);

    this.aiFactory = aiFactory;

    this.myIndex = this.ctx.myIndex;
    this.dealerIndex = this.ctx.dealerIndex;

    this.playedCards = [...(this.ctx.playedCards || [])];
  }

  run() {

    const startSeat = (this.myIndex + 1) % 4;

    let seat = startSeat;
    let chosenSuit = null;
    let makerIndex = null;

    //
    // ===== ROUND 2 bidding =====
    //

    do {

      const ai = this.aiFactory(seat);

      const action = ai.getAction({
        phase: "call_trump",
        hand: this.hands[seat],
        upcard: this.ctx.upcard,
        dealerIndex: this.dealerIndex,
        myIndex: seat,
        score: this.ctx.score ?? { team0: 0, team1: 0 }
      });

      if (action.call) {

        chosenSuit = action.suit;
        makerIndex = seat;
        this.ctx.makerIndex = makerIndex;
        break;

      }

      seat = (seat + 1) % 4;

    } while (seat !== this.dealerIndex);

    //
    // ===== dealer forced call if needed =====
    //

    if (!chosenSuit) {

      const dealerAI = this.aiFactory(this.dealerIndex);

      const forced = dealerAI.getAction({
        phase: "call_trump_forced",
        hand: this.hands[this.dealerIndex],
        upcard: this.ctx.upcard,
        dealerIndex: this.dealerIndex,
        myIndex: this.dealerIndex,
        score: this.ctx.score ?? { team0: 0, team1: 0 }
      });

      chosenSuit = forced.suit;
      makerIndex = this.dealerIndex;
    }

    //
    // ===== apply decision =====
    //

    this.ctx.trump = chosenSuit;
    this.ctx.makerTeam = makerIndex % 2;
    this.ctx.alonePlayerIndex = null;
    this.ctx.trickLeader = (this.dealerIndex + 1) % 4;

    const rolloutCtx = {
      ...this.ctx,
      hand: this.hands[this.myIndex],
      trickCards: this.ctx.trickCards ?? [],
      playedCards: this.playedCards,
      tricksSoFar: this.ctx.tricksSoFar ?? { team0: 0, team1: 0 }
    };
    // console.log("=== CONTRACT calltrumppass ===", {
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
      rootPlayerIndex: this.myIndex
    });

    return rollout.run();
  }
}