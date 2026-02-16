import BaseAI from "./baseAI.js";
import SimpleAI from "./simpleAI.js";
import SoftmaxHeuristicAI from "./softmaxHeuristicAI.js";

import OrderUpSimulator from "./simulation/orderUpSimulator.js";
import PlayDecisionSim from "./simulation/playDecisionSimulator.js";
import { sampleWorld } from "./simulation/worldSampler.js";

import { cloneCtx } from "./simulation/simClone.js";

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
      aiFactory: (seatIndex) => this.createRolloutAI(seatIndex)
    });
  }

  randomTemperature() {
    return 0.25 + Math.random() * 0.2;
  }

  createRolloutAI(seatIndex) {
    return new SoftmaxHeuristicAI({
      temperature: this.randomTemperature(),
      seatIndex
    });
  }

  createAIFactory() {
    return (seatIndex) => this.createRolloutAI(seatIndex);
  }

  /* ================= ORDER UP ================= */

  orderUp(context) {

    const start = profiler.start("orderUp");

    let callScore = 0;
    let simsRun = 0;

    for (let i = 0; i < this.simOrder; i++) {

      const simCtx = cloneCtx(context);

      simCtx.trump = context.upcard.suit;
      simCtx.makerTeam = context.myIndex % 2;
      if (DEBUG) {
        console.log("CONTEXT CHECK", {
          hand: context.hand.length,
          played: context.playedCards?.length || 0,
          trick: context.trickCards?.length || 0
        });
        console.log("simCtx CHECK", {
          hand: simCtx.hand.length,
          played: simCtx.playedCards?.length || 0,
          trick: simCtx.trickCards?.length || 0
        });
      }
      
      const fixedHands = sampleWorld(simCtx);

      const sim = new OrderUpSimulator({
        rootContext: simCtx,
        aiFactory: this.createAIFactory(),
        fixedHands,
        simulatePickup: true
      });

      callScore += sim.run();
      simsRun++;

      if (i > 150) {
        const avg = callScore / simsRun;
        if (Math.abs(avg) > 1.5) break;
      }
    }

    const avg = callScore / simsRun;

    audit.calls++;
    if (avg > 0) audit.positiveCalls++;

    profiler.end("orderUp", start);

    return {
      call: avg > this.callThreshold,
      alone: avg > 2.5
    };
  }

  /* ================= PLAY CARD ================= */

  playCard(context) {

    const start = profiler.start("playDecision");

    const card = this.playDecision.chooseCard(context);

    audit.plays = (audit.plays || 0) + 1;

    const isTrump =
      getEffectiveSuit(card, context.trump) === context.trump;

    if (isTrump) {
      audit.trumpPlayed = (audit.trumpPlayed || 0) + 1;
    }

    profiler.end("playDecision", start);

    return card;
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