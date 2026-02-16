import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  const pressurePerCall =
    data.calls > 0 ? pressure / data.calls : 0;

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
  console.log("Net pressure:", pressure / NUM_GAMES);
  console.log("pressure per call:", pressurePerCall);
  console.log("\n🎯 Decision quality");
  console.log("Call success:", ((1-callFailRate)*100).toFixed(2)+"%");
}


function variance(arr) {
  if (!arr.length) return 0;
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  return arr.reduce((a,b)=>a+(b-mean)**2,0)/arr.length;
}

const promises = [];

for (let i = 0; i < THRESHOLDS.length; i++) {
  for (let j = i + 1; j < THRESHOLDS.length; j++) {

    promises.push(new Promise((resolve, reject) => {

      const worker = new Worker(
      path.resolve(__dirname, "./matchWorker.js"),
        {
          workerData: { tA: THRESHOLDS[i], tB:THRESHOLDS[j]  }
        }
      );
      console.log(`launched match ${ THRESHOLDS[i]} vs ${THRESHOLDS[j] }`)

      worker.on("message", resolve);
      worker.on("error", reject);

      worker.on("exit", code => {
        if (code !== 0) {
          console.error("Worker exited with code", code);
        }
      });

    }));

  }
}

const results = await Promise.all(promises);

results.sort((a,b) => a.tA - b.tA || a.tB - b.tB);

for (const { tA, tB, A, B } of results) {

  console.log(`\n\n===== MATCH ${tA} vs ${tB} =====`);

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