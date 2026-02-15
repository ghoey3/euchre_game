import BaseAI from "./baseAI.js";
import SimpleAI from "./simpleAI.js";
import SoftmaxHeuristicAI from "./softmaxHeuristicAI.js";

import OrderUpSimulator from "./simulation/orderUpSimulator.js";
import PlayDecisionSim from "./simulation/playDecisionSimulator.js";

import { createDeck, shuffle } from "../engine/deck.js";
import { getEffectiveSuit } from "../engine/cardUtils.js";

import { audit } from "./auditStats.js";
import { profiler } from "./profiler.js";

const DEBUG = false;

export default class MonteCarloAI extends BaseAI {

  constructor(options = {}) {
    super("MonteCarloAI");

    this.callThreshold = options.callThreshold ?? 0.4;
    this.simPlay = options.simulationsPerMove ?? 200;
    this.simOrder = options.simulationsPerOrderUp ?? 600;

    this.fallbackAI = new SimpleAI();
    this.orderCounter = 0;

    this.playDecision = new PlayDecisionSim({
      simulations: this.simPlay,
      aiFactory: () => this.createRolloutAI()
    });
  }

  randomTemperature() {
    return 0.25 + Math.random() * 0.2;
  }

  createRolloutAI() {
    return new SoftmaxHeuristicAI({
      temperature: this.randomTemperature()
    });
  }

  createAIFactory() {
    return () => this.createRolloutAI();
  }

  /* ================= ORDER UP ================= */

  orderUp(context) {
    const start = profiler.start("orderUp");
    let callScore = 0;

    for (let i = 0; i < this.simOrder; i++) {

      const simCtx = {
        ...context,
        hand: [...context.hand],
        trickCards: [...(context.trickCards || [])],
        playedCards: [...(context.playedCards || [])]
      };
      simCtx.trump = context.upcard.suit;
      simCtx.makerTeam = context.myIndex % 2;

      const fixedHands = this.sampleDeal(simCtx);

      const sim = new OrderUpSimulator({
        rootContext: simCtx,
        aiFactory: this.createAIFactory(),
        fixedHands,
        simulatePickup: true
      });

      callScore += sim.run();
      if (i > 150) {
        const avg = callScore / (i + 1);

        if (Math.abs(avg) > 1.5) break;
      }
    }

    const avg = callScore / this.simOrder;

    audit.calls++;
    if (avg > 0) audit.positiveCalls++;

    const decision = {
      call: avg > this.callThreshold,
      alone: avg > 2.5
    };

    if (DEBUG) {

      this.orderCounter++;

      console.log("====================================");
      console.log(`ORDER #${this.orderCounter}`);
      console.log("Seat:", context.myIndex);
      console.log("Dealer:", context.dealerIndex);
      console.log("Upcard:", context.upcard.rank + context.upcard.suit);

      console.log(
        "Hand:",
        context.hand.map(c => c.rank + c.suit).join(" ")
      );

      console.log("Avg EV:", avg.toFixed(3));
      console.log("Decision:", decision);
      console.log("====================================");
    }
    profiler.end("orderUp", start);
    return decision;
  }

  /* ================= PLAY CARD ================= */

  playCard(context) {
    const start = profiler.start("playDecision");
    const card = this.playDecision.chooseCard(context);

    audit.plays = (audit.plays || 0) + 1;

    const isTrump =
      getEffectiveSuit(card, context.trump) === context.trump;

    if (isTrump)
      audit.trumpPlayed = (audit.trumpPlayed || 0) + 1;
    profiler.end("playDecision", start);
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

    for (let p = 0; p < 4; p++) {

      if (p === context.myIndex) continue;

      while (hands[p].length < target && remaining.length > 0) {

        let idx = remaining.findIndex(card => {
          const eff = getEffectiveSuit(card, trump);
          return !voidInfo[p]?.[eff];
        });

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