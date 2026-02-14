import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import MonteCarloAI from "../server/ai/monteCarloAI.js";
import SimpleAI from "../server/ai/simpleAI.js";

const NUM_GAMES = 1000;

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

console.log(`Running ${NUM_GAMES} full games...`);

console.log(`\nmonte 200, 600 and monte 200, 600 vs simple and simple`);


for (let i = 0; i < NUM_GAMES; i++) {
  if ( (i % 100) === 0) {
    console.log(`on game: ${i}`)
  }
  const players = [
    new MonteCarloAI({ simulationsPerCardPlay: 200, simulationsPerOrderUp: 600}),
    new SimpleAI(),
    new MonteCarloAI({ simulationsPerCardPlay: 200, simulationsPerOrderUp: 600 }),
    new SimpleAI()
  ];
//   const players = [
//     new MonteCarloAI({ simulationsPerCardPlay: 200 }),
//     new MonteCarloAI({ simulationsPerCardPlay: 200 }),
//     new MonteCarloAI({ simulationsPerCardPlay: 200 }),
//     new MonteCarloAI({ simulationsPerCardPlay: 200 })
//   ];
  const engine = new AIGameEngine(players, {trackStats: true });

  const finalScore = engine.playGame();

  if (finalScore.team0 > finalScore.team1) {
    monteWins++;
  } else {
    simpleWins++;
  }

  // Aggregate stats
  const stats = engine.stats;

  aggregateStats.totalRounds += stats.totalRounds;
  aggregateStats.sweeps += stats.sweeps;
  aggregateStats.euchres += stats.euchres;
  aggregateStats.aloneCalls += stats.aloneCalls;
  aggregateStats.aloneSweeps += stats.aloneSweeps;
  aggregateStats.aloneWins += stats.aloneWins;
  aggregateStats.aloneEuchres += stats.aloneEuchres;
}

console.log("\n===== GAME RESULTS =====");
console.log("Monte Wins:", monteWins);
console.log("Simple Wins:", simpleWins);
console.log("Monte Win Rate:", (monteWins / NUM_GAMES * 100).toFixed(2) + "%");

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