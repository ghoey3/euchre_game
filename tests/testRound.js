import GameEngine from "../engine/engine.js";
import Player from "../engine/player.js";
import SimpleAIStrategy from "../ai/simpleAI.js";

const NUM_ROUNDS = 10000;

const players = [
  new Player({ id: 0, strategy: new SimpleAIStrategy() }),
  new Player({ id: 1, strategy: new SimpleAIStrategy() }),
  new Player({ id: 2, strategy: new SimpleAIStrategy() }),
  new Player({ id: 3, strategy: new SimpleAIStrategy() }),
];

const engine = new GameEngine(players);

console.log(`Running ${NUM_ROUNDS} rounds...`);

let aloneCount = 0;

for (let i = 0; i < NUM_ROUNDS; i++) {
  try {
    const result = engine.playRound();

    if (result?.alonePlayerIndex !== null) {
      aloneCount++;
    }

    engine.rotateDealer();

  } catch (err) {
    console.error("Crash on round:", i);
    console.error(err);
    process.exit(1);
  }
}

console.log("Simulation complete.");
console.log("Final Scores:", engine.scores);
console.log("Stats:", engine.stats);

const aloneEV =
  engine.stats.aloneCalls > 0
    ? (
        (engine.stats.aloneSweeps * 4 +
         engine.stats.aloneWins * 1 -
         engine.stats.aloneEuchres * 2) /
        engine.stats.aloneCalls
      ).toFixed(3)
    : 0;

console.log("Alone Expected Value:", aloneEV);