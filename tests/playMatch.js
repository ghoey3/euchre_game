import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import MonteCarloAI from "../server/ai/monteCarloAI.js";

export function makeData() {
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

export function playMatch(tA, tB, NUM_GAMES = 300) {

  const A = makeData();
  const B = makeData();

  for (let g = 0; g < NUM_GAMES; g++) {

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
        const makerTricks = r.tricksWon[teamA];
        if (makerTricks < 3) {
          A.callLosses++;
          A.euchres++;
        }
      }

      if (r.makerTeam === teamB) {
        B.calls++;
        const makerTricks = r.tricksWon[teamB];
        if (makerTricks < 3) {
          B.callLosses++;
          B.euchres++;
        }
      }
    }
  }

  return { tA, tB, A, B };
}