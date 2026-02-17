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

function makeStat() {
  return { n: 0, mean: 0, m2: 0 };
}

function pushStat(stat, value) {
  stat.n++;
  const delta = value - stat.mean;
  stat.mean += delta / stat.n;
  const delta2 = value - stat.mean;
  stat.m2 += delta * delta2;
}

function variance(stat) {
  if (stat.n < 2) return Infinity;
  return stat.m2 / (stat.n - 1);
}

function stdError(stat) {
  if (stat.n < 2) return Infinity;
  return Math.sqrt(variance(stat) / stat.n);
}

export default class MonteCarloAI extends BaseAI {

  constructor(options = {}) {
    super("MonteCarloAI");

    this.callThreshold = options.callThreshold ?? 0.4;

    this.simPlay =
      options.simulationsPerMove ??
      options.simulationsPerCardPlay ??
      80;

    this.simOrderCall =
      options.simulationsPerOrderUpCall ??
      options.simulationsPerOrderUp ??
      160;
    this.simOrderPass =
      options.simulationsPerOrderUpPass ??
      options.simulationsPerOrderUp ??
      120;
    this.simCallTrump =
      options.simulationsPerCallTrump ??
      options.simulationsPerOrderUp ??
      100;

    this.minSims = options.minSims ?? 40;
    this.maxSims = options.maxSims ?? 200;
    this.evMarginStop = options.evMarginStop ?? 0.35;
    this.confidenceStop = options.confidenceStop ?? 1.25;
    this.totalRolloutsPerDecision =
      options.totalRolloutsPerDecision ?? 120;

    this.fallbackAI = new SimpleAI();
    this.orderCounter = 0;
    this.rolloutAIFactory = this.createAIFactory();
    this.playDecision = new PlayDecisionSim({
      simulations: this.simPlay,
      totalRolloutsPerDecision: this.totalRolloutsPerDecision,
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

    const callStats = makeStat();
    const passStats = makeStat();

    const callBudget = Math.min(this.simOrderCall, this.maxSims);
    const passBudget = Math.min(this.simOrderPass, this.maxSims);
    const loopBudget = Math.max(callBudget, passBudget);

    for (let i = 0; i < loopBudget; i++) {

      const simCtx = cloneCtx(context);
      const sampleStart = profiler.start("orderUp.sampleWorld");
      const fixedHands = sampleWorld(simCtx);
      profiler.end("orderUp.sampleWorld", sampleStart);

      if (i < callBudget) {
        const callStart = profiler.start("orderUp.callEV");
        const callSim = new OrderUpSimulator({
          rootContext: simCtx,
          fixedHands,
          aiFactory: this.createAIFactory(),
          simulatePickup: true
        });
        pushStat(callStats, callSim.run());
        profiler.end("orderUp.callEV", callStart);
      }

      if (i < passBudget) {
        const passRound1Start = profiler.start("orderUp.passEV.round1");
        const passSim = new OrderUpPassSimulator({
          rootContext: simCtx,
          fixedHands,
          aiFactory: this.createAIFactory()
        });

        const passResult = passSim.run();
        profiler.end("orderUp.passEV.round1", passRound1Start);

        if (passResult !== null) {
          pushStat(passStats, passResult);
        } else {
          const passRound2Start = profiler.start("orderUp.passEV.round2");
          const round2Sim = new CallTrumpPassSimulator({
            rootContext: simCtx,
            fixedHands,
            aiFactory: this.createAIFactory()
          });
          pushStat(passStats, round2Sim.run());
          profiler.end("orderUp.passEV.round2", passRound2Start);
        }
      }

      if (
        callStats.n >= this.minSims &&
        passStats.n >= this.minSims
      ) {
        const delta = callStats.mean - passStats.mean;
        const combinedSE =
          Math.sqrt(stdError(callStats) ** 2 + stdError(passStats) ** 2);

        if (
          Number.isFinite(combinedSE) &&
          Math.abs(delta) >
            this.evMarginStop + this.confidenceStop * combinedSE
        ) {
          break;
        }
      }
    }

    const callEV = callStats.mean;
    const passEV = passStats.mean;
    profiler.end("orderUp", start);

    if (DEBUG) {
      console.log("OrderUp EV", { callEV, passEV, callN: callStats.n, passN: passStats.n });
    }

    const decision = {
      call: callEV > passEV,
      alone: callEV > 2.5
    };
    if (decision.call) {
      audit.calls = (audit.calls || 0) + 1;
    }
    return decision;
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

  /* ================= CALL TRUMP ================= */

  callTrump(context) {

    const start = profiler.start("callTrump");

    const candidates = this.getCandidateSuits(context);

    let bestSuit = null;
    let bestEV = -Infinity;

    for (const suit of candidates) {

      const stats = makeStat();
      const localBudget = Math.min(this.simCallTrump, this.maxSims);

      for (let i = 0; i < localBudget; i++) {

        const simCtx = cloneCtx(context);
        const fixedHands = sampleWorld(simCtx);

        const sim = new CallTrumpSimulator({
          rootContext: simCtx,
          suit,
          fixedHands,
          aiFactory: this.createAIFactory()
        });

        pushStat(stats, sim.run());

        if (stats.n >= this.minSims && Number.isFinite(bestEV)) {
          const se = stdError(stats);
          const margin = this.confidenceStop * se + this.evMarginStop;
          const upperBound = stats.mean + margin;

          if (upperBound < bestEV) {
            break;
          }
        }
      }

      const avgEV = stats.mean;

      if (avgEV > bestEV) {
        bestEV = avgEV;
        bestSuit = suit;
      }
    }

    profiler.end("callTrump", start);

    const decision = {
      call: bestEV > 0,
      suit: bestSuit,
      alone: bestEV > 2.5
    };
    if (decision.call) {
      audit.calls = (audit.calls || 0) + 1;
    }
    return decision;
  }

  /* ================= ACTION ================= */

  getAction(context) {

    switch (context.phase) {

      case "order_up":
        return { type: "order_up", ...this.orderUp(context) };

      case "play_card":
        return { type: "play_card", card: this.playCard(context) };

      case "call_trump":
        return { type: "call_trump", ...this.callTrump(context) };

      default:
        return this.fallbackAI.getAction(context);
    }
  }

  getCandidateSuits(context) {

    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const heuristic = new SoftmaxHeuristicAI({ temperature: 0.3 });

    const scored = suits
      .filter(s => s !== context.upcard.suit)
      .map(s => ({
        suit: s,
        score: heuristic.evaluateHand(context.hand, s)
      }))
      .sort((a, b) => b.score - a.score);

    const candidates = [scored[0].suit];

    if (scored[1] && scored[1].score > scored[0].score - 15) {
      candidates.push(scored[1].suit);
    }

    return candidates;
  }
}
