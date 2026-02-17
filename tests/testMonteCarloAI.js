import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import MonteCarloAI from "../server/ai/monteCarloAI.js";
import SimpleAI from "../server/ai/simpleAI.js";
import { audit } from "../server/ai/auditStats.js";

import { profiler } from "../server/ai/profiler.js";


const NUM_GAMES = 50;

// const THRESHOLDS = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
const THRESHOLDS = [0.25];
console.log(`Running threshold sweep with ${NUM_GAMES} games each...\n`);

  for (const threshold of THRESHOLDS) {

    // ✅ reset audit
    Object.keys(audit).forEach(k => audit[k] = 0);

    // ✅ reset profiler
    profiler.data = {};

    const thresholdStart = performance.now();

    let monteWins = 0;
    let simpleWins = 0;

    let aggregateStats = {
      totalRounds: 0,
      sweeps: 0,
      euchres: 0,
      aloneCalls: 0,
      aloneSweeps: 0,
      aloneWins: 0,
      aloneEuchres: 0
    };

    console.log(`\n==============================`);
    console.log(`Testing threshold: ${threshold}`);
    console.log(`==============================`);

    for (let i = 0; i < NUM_GAMES; i++) {

      if ((i % 10) === 0) {
        console.log(`on game: ${i}`);
      }

      const players = [
        new MonteCarloAI({
          simulationsPerMove: 80,
          simulationsPerOrderUpCall: 160,
          simulationsPerOrderUpPass: 120,
          simulationsPerCallTrump: 100,
          totalRolloutsPerDecision: 120,
          minSims: 40,
          maxSims: 200,
          evMarginStop: 0.35,
          confidenceStop: 1.25,
          callThreshold: threshold
        }),
        new SimpleAI(),
        new MonteCarloAI({
          simulationsPerMove: 80,
          simulationsPerOrderUpCall: 160,
          simulationsPerOrderUpPass: 120,
          simulationsPerCallTrump: 100,
          totalRolloutsPerDecision: 120,
          minSims: 40,
          maxSims: 200,
          evMarginStop: 0.35,
          confidenceStop: 1.25,
          callThreshold: threshold
        }),
        new SimpleAI()
      ];

      const engine = new AIGameEngine(players, { trackStats: true });

      const finalScore = engine.playGame();

      if (finalScore.team0 > finalScore.team1) monteWins++;
      else simpleWins++;

      const stats = engine.stats;

      aggregateStats.totalRounds += stats.totalRounds;
      aggregateStats.sweeps += stats.sweeps;
      aggregateStats.euchres += stats.euchres;
      aggregateStats.aloneCalls += stats.aloneCalls;
      aggregateStats.aloneSweeps += stats.aloneSweeps;
      aggregateStats.aloneWins += stats.aloneWins;
      aggregateStats.aloneEuchres += stats.aloneEuchres;
    }

    const elapsedSec = ((performance.now() - thresholdStart) / 1000).toFixed(1);

    console.log("\n===== RESULTS =====");
    console.log("Threshold:", threshold);
    console.log("Win Rate:", (monteWins / NUM_GAMES * 100).toFixed(2) + "%");
    console.log("Runtime:", elapsedSec, "seconds");

    console.log("\n===== MONTE AUDIT =====");
    console.log("Calls:", audit.calls);
    console.log("Total plays:", audit.plays);
    console.log("Trump rate:",
      audit.plays ? (audit.trumpPlayed / audit.plays).toFixed(3) : 0
    );

    profiler.report();
  }
