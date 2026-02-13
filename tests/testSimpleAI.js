import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import SimpleAI from "../server/ai/simpleAI.js";

const NUM_GAMES = 10000;

console.log(`Running ${NUM_GAMES} games of SimpleAI vs SimpleAI...\n`);

const players = [
  new SimpleAI(),
  new SimpleAI(),
  new SimpleAI(),
  new SimpleAI()
];

const engine = new AIGameEngine(players, {
  winningScore: 10,
  trackStats: true
});

const start = Date.now();

for (let i = 0; i < NUM_GAMES; i++) {
  try {
    engine.playGame();
  } catch (err) {
    console.error(`Crash on game ${i}`);
    console.error(err);
    process.exit(1);
  }
}

const duration = ((Date.now() - start) / 1000).toFixed(2);
const stats = engine.getStats();

console.log("Simulation complete.");
console.log("Duration:", duration, "seconds\n");

console.log("===== RESULTS =====");
console.log("Total Rounds:", stats.totalRounds);
console.log("Team0 Wins:", stats.team0Wins);
console.log("Team1 Wins:", stats.team1Wins);

const winRate0 = (stats.team0Wins / NUM_GAMES * 100).toFixed(2);
console.log("Team0 Win Rate:", winRate0 + "%");

console.log("\n===== ROUND STATS =====");
console.log("Sweeps:", stats.sweeps);
console.log("Euchres:", stats.euchres);

const euchreRate = (stats.euchres / stats.totalRounds * 100).toFixed(2);
console.log("Euchre Rate:", euchreRate + "%");

console.log("\n===== ALONE STATS =====");
console.log("Alone Calls:", stats.aloneCalls);
console.log("Alone Sweeps:", stats.aloneSweeps);
console.log("Alone Wins:", stats.aloneWins);
console.log("Alone Euchres:", stats.aloneEuchres);

const aloneCallRate =
  stats.totalRounds > 0
    ? (stats.aloneCalls / stats.totalRounds * 100).toFixed(2)
    : 0;

console.log("Alone Call Rate:", aloneCallRate + "%");

const aloneEV =
  stats.aloneCalls > 0
    ? (
        (
          stats.aloneSweeps * 2 +  // 2 pts
          stats.aloneWins * 1 -    // 1 pt
          stats.aloneEuchres * 2   // -2 pts
        ) / stats.aloneCalls
      ).toFixed(3)
    : 0;

console.log("Alone Expected Value:", aloneEV);