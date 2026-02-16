import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import MonteCarloAI from "../server/ai/monteCarloAI.js";

const NUM_GAMES = 500;

const AGG = 0.25;
const CONS = 0.45;

function makeData() {
  return {
    games: 0,
    wins: 0,
    points: 0,

    calls: 0,
    callLosses: 0,

    euchres: 0,
    euchresInflicted: 0,
    euchresSuffered: 0,

    pointDiffs: []
  };
}

const agg = makeData();
const cons = makeData();

function variance(arr) {
  if (!arr.length) return 0;
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  return arr.reduce((a,b)=>a+(b-mean)**2,0)/arr.length;
}

for (let g = 0; g < NUM_GAMES; g++) {

  if (g % 50 === 0) console.log("game", g);

  const swap = g % 2 === 0;

  const players = swap
    ? [
        new MonteCarloAI({ callThreshold: AGG }),
        new MonteCarloAI({ callThreshold: CONS }),
        new MonteCarloAI({ callThreshold: AGG }),
        new MonteCarloAI({ callThreshold: CONS })
      ]
    : [
        new MonteCarloAI({ callThreshold: CONS }),
        new MonteCarloAI({ callThreshold: AGG }),
        new MonteCarloAI({ callThreshold: CONS }),
        new MonteCarloAI({ callThreshold: AGG })
      ];

  const engine = new AIGameEngine(players, { trackStats: true });

  const finalScore = engine.playGame();

  const s = engine.stats.team;

  const aggTeam = swap ? 0 : 1;
  const consTeam = swap ? 1 : 0;

  const aggStats = s[aggTeam];
  const consStats = s[consTeam];

  agg.games++;
  cons.games++;

  const aggPoints = finalScore[`team${aggTeam}`];
  const consPoints = finalScore[`team${consTeam}`];

  agg.points += aggPoints;
  cons.points += consPoints;

  agg.pointDiffs.push(aggPoints - consPoints);
  cons.pointDiffs.push(consPoints - aggPoints);

  if (
    (aggTeam === 0 && finalScore.team0 > finalScore.team1) ||
    (aggTeam === 1 && finalScore.team1 > finalScore.team0)
  ) agg.wins++;
  else cons.wins++;

  // pressure stats
  agg.euchresInflicted += aggStats.euchresInflicted;
  agg.euchresSuffered += aggStats.euchresSuffered;

  cons.euchresInflicted += consStats.euchresInflicted;
  cons.euchresSuffered += consStats.euchresSuffered;

  // round logs for regret signals
  for (const r of engine.stats.roundLogs) {

    if (r.makerTeam === aggTeam) {
      agg.calls++;

      const diff =
        r.tricksWon[aggTeam] - r.tricksWon[1-aggTeam];

      if (diff < 0) agg.callLosses++;
      if (diff < 0) agg.euchres++;
    }

    if (r.makerTeam === consTeam) {
      cons.calls++;

      const diff =
        r.tricksWon[consTeam] - r.tricksWon[1-consTeam];

      if (diff < 0) cons.callLosses++;
      if (diff < 0) cons.euchres++;
    }
  }
}

function report(label, data) {

  const winRate = data.wins / data.games;
  const meanPoints = data.points / data.games;

  const varOutcome = variance(data.pointDiffs);
  const std = Math.sqrt(varOutcome);

  const riskAdjustedEV = std > 0 ? meanPoints / std : 0;

  const callFailRate =
    data.calls > 0 ? data.callLosses / data.calls : 0;

  const severeLossRate =
    data.calls > 0 ? data.euchres / data.calls : 0;

  const pressure =
    data.euchresInflicted - data.euchresSuffered;

  console.log(`\n==============================`);
  console.log(`HEALTH REPORT — ${label}`);
  console.log(`==============================`);

  console.log("\n🏆 Performance");
  console.log("Win rate:", (winRate*100).toFixed(2)+"%");
  console.log("Points/game:", meanPoints.toFixed(3));

  console.log("\n⚖️ Risk");
  console.log("Variance:", varOutcome.toFixed(3));
  console.log("Risk-adjusted EV:", riskAdjustedEV.toFixed(3));

  console.log("\n🧬 Nash proxy");
  console.log("Distance from 50%:", (Math.abs(winRate-0.5)*100).toFixed(2)+"%");

  console.log("\n🔁 Regret signals");
  console.log("Call failure rate:", (callFailRate*100).toFixed(2)+"%");
  console.log("Severe loss rate:", (severeLossRate*100).toFixed(2)+"%");

  console.log("\n🔥 Pressure");
  console.log("Net pressure:", pressure);

  console.log("\n🎯 Decision quality");
  console.log("Call success:", ((1-callFailRate)*100).toFixed(2)+"%");
}

report("Aggressive", agg);
report("Conservative", cons);