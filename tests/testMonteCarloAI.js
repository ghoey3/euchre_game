import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import MonteCarloAI from "../server/ai/monteCarloAI.js";
import SimpleAI from "../server/ai/simpleAI.js";
import { audit } from "../server/ai/auditStats.js";


const NUM_GAMES = 1000;

const THRESHOLDS = [0.3, 0.35, 0.4, 0.45, 0.5];
// const THRESHOLDS = [0.4];
console.log(`Running threshold sweep with ${NUM_GAMES} games each...\n`);

for (const threshold of THRESHOLDS) {

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

    if ((i % 100) === 0) {
      console.log(`on game: ${i}`);
    }

    const players = [
      new MonteCarloAI({
        simulationsPerCardPlay: 200,
        simulationsPerOrderUp: 600,
        callThreshold: threshold
      }),
      new SimpleAI(),
      new MonteCarloAI({
        simulationsPerCardPlay: 200,
        simulationsPerOrderUp: 600,
        callThreshold: threshold
      }),
      new SimpleAI()
    ];

    const engine = new AIGameEngine(players, { trackStats: true });

    const finalScore = engine.playGame();

    if (finalScore.team0 > finalScore.team1) {
      monteWins++;
    } else {
      simpleWins++;
    }

    const stats = engine.stats;

    aggregateStats.totalRounds += stats.totalRounds;
    aggregateStats.sweeps += stats.sweeps;
    aggregateStats.euchres += stats.euchres;
    aggregateStats.aloneCalls += stats.aloneCalls;
    aggregateStats.aloneSweeps += stats.aloneSweeps;
    aggregateStats.aloneWins += stats.aloneWins;
    aggregateStats.aloneEuchres += stats.aloneEuchres;
  }

  const winRate = (monteWins / NUM_GAMES * 100).toFixed(2);

  console.log("\n===== RESULTS =====");
  console.log("Threshold:", threshold);
  console.log("Monte Wins:", monteWins);
  console.log("Simple Wins:", simpleWins);
  console.log("Win Rate:", winRate + "%");

  console.log("\n===== ROUND STATS =====");
  console.log("Total Rounds:", aggregateStats.totalRounds);
  console.log("Sweeps:", aggregateStats.sweeps);
  console.log("Euchres:", aggregateStats.euchres);

  console.log(
    "Euchre Rate:",
    (aggregateStats.euchres / aggregateStats.totalRounds * 100).toFixed(2) + "%"
  );

  console.log("\n===== ALONE STATS =====");
  console.log("Alone Calls:", aggregateStats.aloneCalls);
  console.log("Alone Sweeps:", aggregateStats.aloneSweeps);
  console.log("Alone Wins:", aggregateStats.aloneWins);
  console.log("Alone Euchres:", aggregateStats.aloneEuchres);

  const aloneEV =
    aggregateStats.aloneCalls > 0
      ? (
          (aggregateStats.aloneSweeps * 4 +
           aggregateStats.aloneWins * 1 -
           aggregateStats.aloneEuchres * 2)
          / aggregateStats.aloneCalls
        ).toFixed(3)
      : 0;

  console.log("Alone Expected Value:", aloneEV);

  console.log("\n===== MONTE AUDIT =====");

  console.log("Calls:", audit.calls);
  console.log("Positive EV calls:", audit.positiveCalls);

  console.log("Total plays:", audit.plays);
  console.log("Trump played:", audit.trumpPlayed);

  const trumpRate =
    audit.plays ? (audit.trumpPlayed / audit.plays).toFixed(3) : 0;

  console.log("Trump play rate:", trumpRate);

}