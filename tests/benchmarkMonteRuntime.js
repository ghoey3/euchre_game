import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import MonteCarloAI from "../server/ai/monteCarloAI.js";
import SimpleAI from "../server/ai/simpleAI.js";
import { profiler } from "../server/ai/profiler.js";
import { audit } from "../server/ai/auditStats.js";

function runBenchmark({
  games = 20,
  winningScore = 10,
  monteOptions = {}
} = {}) {
  profiler.data = {};
  Object.keys(audit).forEach(k => {
    if (typeof audit[k] === "number") audit[k] = 0;
  });

  let monteWins = 0;
  const start = performance.now();

  for (let g = 0; g < games; g++) {
    const players = [
      new MonteCarloAI(monteOptions),
      new SimpleAI(),
      new MonteCarloAI(monteOptions),
      new SimpleAI()
    ];

    const engine = new AIGameEngine(players, { winningScore, trackStats: true });
    const score = engine.playGame();
    if (score.team0 > score.team1) monteWins++;
  }

  const elapsedMs = performance.now() - start;
  const elapsedSec = elapsedMs / 1000;
  const winRate = (monteWins / games) * 100;

  console.log("\n===== MONTE RUNTIME BENCH =====");
  console.log("games:", games);
  console.log("win rate:", `${winRate.toFixed(2)}%`);
  console.log("runtime:", `${elapsedSec.toFixed(2)} sec`);
  console.log("sec/game:", `${(elapsedSec / games).toFixed(3)}`);
  console.log("audit calls:", audit.calls || 0);
  console.log("audit plays:", audit.plays || 0);

  console.log("\n===== PROFILER BREAKDOWN =====");
  const entries = Object.entries(profiler.data)
    .sort((a, b) => b[1].total - a[1].total);

  for (const [name, stat] of entries) {
    const avg = stat.count ? stat.total / stat.count : 0;
    console.log(
      `${name}: total=${stat.total.toFixed(1)}ms avg=${avg.toFixed(3)}ms calls=${stat.count}`
    );
  }
}

const mode = process.argv[2] || "quick";

if (mode === "full") {
  runBenchmark({
    games: 50,
    monteOptions: {
      simulationsPerMove: 80,
      simulationsPerOrderUpCall: 160,
      simulationsPerOrderUpPass: 120,
      simulationsPerCallTrump: 100,
      totalRolloutsPerDecision: 120,
      minSims: 40,
      maxSims: 200,
      evMarginStop: 0.35,
      confidenceStop: 1.25
    }
  });
} else {
  runBenchmark({
    games: 20,
    monteOptions: {
      simulationsPerMove: 80,
      simulationsPerOrderUpCall: 160,
      simulationsPerOrderUpPass: 120,
      simulationsPerCallTrump: 100,
      totalRolloutsPerDecision: 120,
      minSims: 40,
      maxSims: 200,
      evMarginStop: 0.35,
      confidenceStop: 1.25
    }
  });
}
