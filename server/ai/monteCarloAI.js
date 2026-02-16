import BaseAI from "./baseAI.js";
import SimpleAI from "./simpleAI.js";
import SoftmaxHeuristicAI from "./softmaxHeuristicAI.js";

import OrderUpPassSimulator from "./simulation/orderUpPassSimulator.js";
import { CallTrumpPassSimulator } from "./simulation/callTrumpPassSimulator.js";
import OrderUpSimulator from "./simulation/orderUpSimulator.js";
import PlayDecisionSim from "./simulation/playDecisionSimulator.js";
import CallTrumpSimulator from "./simulation/callTrumpSimulator.js";
import { sampleWorld } from "./simulation/worldSampler.js";

import { cloneCtx } from "./simulation/simClone.js";

import { getEffectiveSuit } from "../engine/cardUtils.js";

import { audit } from "./auditStats.js";
import { profiler } from "./profiler.js";

const DEBUG = false;
const FAST = true;

export default class MonteCarloAI extends BaseAI {

  constructor(options = {}) {
    super("MonteCarloAI");

    this.callThreshold = options.callThreshold ?? 0.4;
    this.simPlay = options.simulationsPerMove ?? 200;
    this.simOrder = options.simulationsPerOrderUp ?? 600;

    this.fallbackAI = new SimpleAI();
    this.orderCounter = 0;
    this.rolloutAIFactory = this.createAIFactory();
    this.playDecision = new PlayDecisionSim({
      simulations: this.simPlay,
      aiFactory: this.rolloutAIFactory
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

    let callTotal = 0;
    let passTotal = 0;
    let sims = 0;

    for (let i = 0; i < this.simOrder; i++) {

      const simCtx = cloneCtx(context);

      const fixedHands = sampleWorld(simCtx);

      //
      // ===== CALL EV =====
      //

      const callSim = new OrderUpSimulator({
        rootContext: simCtx,
        fixedHands,
        aiFactory: this.createAIFactory(),
        simulatePickup: true
      });

      callTotal += callSim.run();

      //
      // ===== PASS EV =====
      //

      const passSim = new OrderUpPassSimulator({
        rootContext: simCtx,
        fixedHands,
        aiFactory: this.createAIFactory()
      });

      const passResult = passSim.run();

      if (passResult !== null) {

        // someone ordered
        passTotal += passResult;

      } else {

        // nobody ordered → round 2

        const round2Sim = new CallTrumpPassSimulator({
          rootContext: simCtx,
          fixedHands,
          aiFactory: this.createAIFactory()
        });

        passTotal += round2Sim.run();
      }

      sims++;
    }

    const callEV = callTotal / sims;
    const passEV = passTotal / sims;
    console.log("OrderUpEV", callEV);
    console.log("PassEV", passEV);
    profiler.end("orderUp", start);

    return {
      call: callEV > passEV,
      alone: callEV > 2.5
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
  /* ================= call trump ================= */ 

  callTrump(context) {

    const start = profiler.start("callTrump");

    const candidates = this.getCandidateSuits(context);

    let bestSuit = null;
    let bestEV = -Infinity;

    for (const suit of candidates) {

      let total = 0;
      let sims = 0;

      for (let i = 0; i < this.simOrder; i++) {

        const simCtx = cloneCtx(context);

        const fixedHands = sampleWorld(simCtx);

        const sim = new CallTrumpSimulator({
          rootContext: simCtx,
          suit,
          fixedHands,
          aiFactory: this.createAIFactory()
        });

        total += sim.run();
        sims++;
        // Early stop if obvious
        if (i > 150) {
          const avg = total / sims;
          if (Math.abs(avg) > 1.5) break;
        }
      }

      const avgEV = total / sims;
      console.log("Call EV", suit, avgEV);

      if (avgEV > bestEV) {
        bestEV = avgEV;
        bestSuit = suit;
      }
    }

    profiler.end("callTrump", start);

    return {
      call: bestEV > 0,
      suit: bestSuit,
      alone: bestEV > 2.5
    };
  }



  /* ================= ACTION ================= */

  getAction(context) {

    switch (context.phase) {

      case "order_up":
        return { type: "order_up", ...this.orderUp(context) };

      case "play_card":
        return { type: "play_card", card: this.playCard(context) };

      case "call_trump":
        return { type: "call_trump", card: this.callTrump(context) };

      default:
        return this.fallbackAI.getAction(context);
    }
  }

  getCandidateSuits(context) {

    const suits = ["hearts","diamonds","clubs","spades"];
    const heuristic = new SoftmaxHeuristicAI({ temperature: 0.3 });

    const scored = suits
      .filter(s => s !== context.upcard.suit)
      .map(s => ({
        suit: s,
        score: heuristic.evaluateHand(context.hand, s)
      }))
      .sort((a,b) => b.score - a.score);

    // Always include best
    const candidates = [scored[0].suit];

    // Include second if close
    if (scored[1] && scored[1].score > scored[0].score - 15) {
      candidates.push(scored[1].suit);
    }

    return candidates;
  }
}