import BaseAI from "./baseAI.js";
import SimpleAI from "./simpleAI.js";

import OrderUpSimulator from "./simulation/orderUpSimulator.js";
import PlaySimulator from "./simulation/playCardSimulator.js";
import PlayDecisionSim from "./simulation/playDecisionSimulator.js";

import { createDeck, shuffle } from "../engine/deck.js";
import { getEffectiveSuit } from "../engine/cardUtils.js";

const DEBUG = false;

export default class MonteCarloAI extends BaseAI {

  constructor(options = {}) {
    super("MonteCarloAI");

    this.simPlay = options.simulationsPerMove ?? 200;
    this.simOrder = options.simulationsPerOrderUp ?? 600;

    this.fallbackAI = new SimpleAI();

    this.playDecision = new PlayDecisionSim({
      simulations: this.simPlay,
      playoutAI: this.fallbackAI
    });
  }

  /* ================= ORDER UP ================= */

  orderUp(context) {

    let callScore = 0;

    for (let i = 0; i < this.simOrder; i++) {

      const simCtx = JSON.parse(JSON.stringify(context));

      simCtx.trump = context.upcard.suit;
      simCtx.makerTeam = context.myIndex % 2;

      const fixedHands = this.sampleDeal(simCtx);

      const sim = new OrderUpSimulator({
        rootContext: simCtx,
        playoutAI: this.fallbackAI,
        fixedHands,
        simulatePickup: true
      });

      callScore += sim.run();
    }

    const avg = callScore / this.simOrder;

    if (DEBUG) {
      console.log("ORDER avg EV:", avg.toFixed(3));
    }

    return {
      call: avg > .4,
      alone: avg > 2.5
    };
  }

  /* ================= PLAY CARD ================= */

  playCard(context) {

    const card = this.playDecision.chooseCard(context);

    //console.log("PLAY decision:", card);

    return card;
  }

  /* ================= SAMPLERS ================= */

  sampleDeal(context) {

    const deck = createDeck();

    const known = [
      ...context.hand,
      context.upcard
    ].filter(Boolean);

    let remaining = deck.filter(c =>
      !known.some(k => k.rank === c.rank && k.suit === c.suit)
    );

    shuffle(remaining);

    const hands = {0:[],1:[],2:[],3:[]};
    hands[context.myIndex] = [...context.hand];

    for (let p = 0; p < 4; p++) {

      if (p === context.myIndex) continue;

      hands[p] = remaining.splice(0, 5);
    }

    return hands;
  }

  sampleWorld(context) {

    const deck = createDeck();

    const known = [
      ...context.hand,
      ...(context.playedCards || []),
      ...(context.trickCards || []).map(t => t.card)
    ].filter(Boolean);

    let remaining = deck.filter(c =>
      !known.some(k => k.rank === c.rank && k.suit === c.suit)
    );

    shuffle(remaining);

    const hands = {0:[],1:[],2:[],3:[]};
    hands[context.myIndex] = [...context.hand];

    const target = context.hand.length;
    const trump = context.trump;
    const voidInfo = context.voidInfo || {0:{},1:{},2:{},3:{}};

    // deal one card at a time to respect constraints
    for (let p = 0; p < 4; p++) {

      if (p === context.myIndex) continue;

      while (hands[p].length < target && remaining.length > 0) {

        // try to find valid card
        let idx = remaining.findIndex(card => {

          const eff = getEffectiveSuit(card, trump);
          return !voidInfo[p]?.[eff];
        });

        // fallback if no valid card (constraints impossible)
        if (idx === -1) idx = 0;

        const card = remaining.splice(idx, 1)[0];
        hands[p].push(card);
      }
    }

    return hands;
  }

  /* ================= ACTION ================= */

  getAction(context) {

    switch (context.phase) {

      case "order_up":
        return { type: "order_up", ...this.orderUp(context) };

      case "play_card":
        return { type: "play_card", card: this.playCard(context) };

      default:
        return this.fallbackAI.getAction(context);
    }
  }
}