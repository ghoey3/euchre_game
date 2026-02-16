import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import MonteCarloAI from "../server/ai/monteCarloAI.js";

const NUM_GAMES = 300;

const THRESHOLDS = [0.25, 0.35, 0.45, 0.55];

const elo = {};

function ensureElo(t) {
  if (!elo[t]) elo[t] = 1500;
}

const standings = {};

function ensureStandings(threshold) {
  if (!standings[threshold]) {
    standings[threshold] = {
      matches: 0,
      matchWins: 0,
      gamesWon: 0,
      gamesLost: 0,
      points: 0
    };
  }
}

function updateElo(A, B, scoreA) {

  const K = 16;

  const RA = elo[A];
  const RB = elo[B];

  const expectedA = 1 / (1 + Math.pow(10, (RB - RA) / 400));
  const expectedB = 1 - expectedA;

  const scoreB = 1 - scoreA;

  elo[A] = RA + K * (scoreA - expectedA);
  elo[B] = RB + K * (scoreB - expectedB);
}

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

function variance(arr) {
  if (!arr.length) return 0;
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  return arr.reduce((a,b)=>a+(b-mean)**2,0)/arr.length;
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

function playMatch(tA, tB) {

  const A = makeData();
  const B = makeData();

  console.log(`\n\n===== MATCH ${tA} vs ${tB} =====`);

  for (let g = 0; g < NUM_GAMES; g++) {

    if (g % 50 === 0) console.log("game", g);

    const swap = g % 2 === 0;

    const players = swap
      ? [
          new MonteCarloAI({ callThreshold: tA }),
          new MonteCarloAI({ callThreshold: tB }),
          new MonteCarloAI({ callThreshold: tA }),
          new MonteCarloAI({ callThreshold: tB })
        ]
      : [
          new MonteCarloAI({ callThreshold: tB }),
          new MonteCarloAI({ callThreshold: tA }),
          new MonteCarloAI({ callThreshold: tB }),
          new MonteCarloAI({ callThreshold: tA })
        ];

    const engine = new AIGameEngine(players, { trackStats: true });

    const finalScore = engine.playGame();
    const s = engine.stats.team;

    const teamA = swap ? 0 : 1;
    const teamB = swap ? 1 : 0;

    const statsA = s[teamA];
    const statsB = s[teamB];

    A.games++;
    B.games++;

    const ptsA = finalScore[`team${teamA}`];
    const ptsB = finalScore[`team${teamB}`];

    A.points += ptsA;
    B.points += ptsB;

    A.pointDiffs.push(ptsA - ptsB);
    B.pointDiffs.push(ptsB - ptsA);

    if (ptsA > ptsB) A.wins++;
    else B.wins++;

    A.euchresInflicted += statsA.euchresInflicted;
    A.euchresSuffered += statsA.euchresSuffered;

    B.euchresInflicted += statsB.euchresInflicted;
    B.euchresSuffered += statsB.euchresSuffered;

    for (const r of engine.stats.roundLogs) {

      if (r.makerTeam === teamA) {
        A.calls++;

        const diff = r.tricksWon[teamA] - r.tricksWon[1-teamA];

        if (diff < 0) {
          A.callLosses++;
          A.euchres++;
        }
      }

      if (r.makerTeam === teamB) {
        B.calls++;

        const diff = r.tricksWon[teamB] - r.tricksWon[1-teamB];

        if (diff < 0) {
          B.callLosses++;
          B.euchres++;
        }
      }
    }
  } 
  ensureStandings(tA);
  ensureStandings(tB);

  standings[tA].matches++;
  standings[tB].matches++;

  standings[tA].gamesWon += A.wins;
  standings[tA].gamesLost += B.wins;
  standings[tA].points += A.points;

  standings[tB].gamesWon += B.wins;
  standings[tB].gamesLost += A.wins;
  standings[tB].points += B.points;

  ensureElo(tA);
  ensureElo(tB);

  const scoreA = A.wins / (A.wins + B.wins);

  updateElo(tA, tB, scoreA);

  if (A.wins > B.wins) standings[tA].matchWins++;
  else standings[tB].matchWins++;

  report(`Threshold ${tA}`, A);
  report(`Threshold ${tB}`, B);
}

for (let i = 0; i < THRESHOLDS.length; i++) {
  for (let j = i + 1; j < THRESHOLDS.length; j++) {
    playMatch(THRESHOLDS[i], THRESHOLDS[j]);
  }
}

console.log("\n\n===== TOURNAMENT RANKINGS =====");

const table = Object.entries(standings)
  .map(([t,s]) => ({
    threshold: t,
    matchWins: s.matchWins,
    winRate: s.gamesWon / (s.gamesWon + s.gamesLost),
    avgPoints: s.points / s.matches
  }))
  .sort((a,b)=> b.matchWins - a.matchWins);

for (const row of table) {
  console.log(
    `Threshold ${row.threshold} | Match wins: ${row.matchWins} | Game WR: ${(row.winRate*100).toFixed(2)}% | Avg pts: ${row.avgPoints.toFixed(2)}`
  );
}


console.log("\n===== ELO RATINGS =====");

Object.entries(elo)
  .sort((a,b)=>b[1]-a[1])
  .forEach(([t,r])=>{
    console.log(`Threshold ${t}: ${r.toFixed(1)}`);
  });