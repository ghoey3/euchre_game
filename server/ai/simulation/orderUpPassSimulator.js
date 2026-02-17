import { cloneCtx, cloneHands } from "./simClone.js";
import PlayRolloutSim from "./playRolloutSimulator.js";

export default class OrderUpPassSimulator {

  constructor({ rootContext, fixedHands, aiFactory }) {

    this.ctx = cloneCtx(rootContext);
    this.hands = cloneHands(fixedHands);
    this.aiFactory = aiFactory;

    this.ais = {
      0: aiFactory(0),
      1: aiFactory(1),
      2: aiFactory(2),
      3: aiFactory(3)
    };

    this.myIndex = this.ctx.myIndex;
    this.dealer = this.ctx.dealerIndex;

    this.playedCards = [...(this.ctx.playedCards || [])];
  }

  run() {

    // ----- ROUND 1 remaining players -----

    const upcardSuit = this.ctx.upcard.suit;

    let seat = (this.myIndex + 1) % 4;

    while (true) {

    const ai = this.ais[seat];

    const decision = ai.getAction({
        phase: "order_up",
        hand: this.hands[seat],
        upcard: this.ctx.upcard,
        dealerIndex: this.dealer,
        myIndex: seat
    });

    if (decision?.call) {

        this.ctx.trump = this.ctx.upcard.suit;
        this.ctx.makerTeam = seat % 2;
        this.ctx.alonePlayerIndex = decision.alone ? seat : null;
        this.ctx.makerIndex = seat;
        if (seat !== this.dealer) {
        this.applyPickup();
        }

        return this.rollout();
    }

    if (seat === this.dealer) break;

    seat = (seat + 1) % 4;
    }

    // ----- ROUND 2 bidding -----

    return this.round2();
  }

  round2() {

    const forbidden = this.ctx.upcard.suit;

    for (let offset = 1; offset <= 4; offset++) {

      const seat = (this.dealer + offset) % 4;
      const ai = this.ais[seat];

      const decision = ai.getAction({
        phase: "call_trump",
        hand: this.hands[seat],
        upcard: this.ctx.upcard,
        dealerIndex: this.dealer,
        myIndex: seat
      });

      if (decision?.call) {

        this.ctx.trump = decision.suit;
        this.ctx.makerTeam = seat % 2;
        this.ctx.alonePlayerIndex = decision.alone ? seat : null;
        this.ctx.makerIndex = seat;

        return this.rollout();
      }
    }

    // dealer forced

    const dealerAI = this.ais[this.dealer];

    const forced = dealerAI.getAction({
      phase: "call_trump_forced",
      hand: this.hands[this.dealer],
      upcard: this.ctx.upcard,
      dealerIndex: this.dealer,
      myIndex: this.dealer
    });

    this.ctx.trump = forced.suit;
    this.ctx.makerTeam = this.dealer % 2;
    this.ctx.alonePlayerIndex = null;
    this.ctx.makerIndex = this.dealer;

    return this.rollout();
  }

  applyPickup() {

    const dealerAI = this.ais[this.dealer];

    this.hands[this.dealer].push(this.ctx.upcard);

    const discard = dealerAI.getAction({
      phase: "discard",
      hand: this.hands[this.dealer],
      trump: this.ctx.upcard.suit,
      dealerIndex: this.dealer
    });

    const idx = this.hands[this.dealer].findIndex(
      c => c.rank === discard.card.rank && c.suit === discard.card.suit
    );

    this.hands[this.dealer].splice(idx, 1);
    this.ctx.dealerPickedUp = true
  }

  rollout() {

    const rolloutCtx = {
      ...this.ctx,
      hand: this.hands[this.myIndex],
      trickCards: [],
      playedCards: this.playedCards,
      tricksSoFar: { team0: 0, team1: 0 },
      rootPlayerIndex: this.myIndex
    };
    // console.log("=== CONTRACT orderupPassSimulator ===", {
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
    const sim = new PlayRolloutSim({
      context: rolloutCtx,
      fixedHands: this.hands,
      aiFactory: (s) => this.ais[s],
      
    });

    return sim.run();
  }
}