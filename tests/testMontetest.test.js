import test from "node:test";
import assert from "node:assert";

import MonteCarloAI from "../server/ai/monteCarloAI.js";
import SimpleAI from "../server/ai/simpleAI.js";

import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import { sampleWorld } from "../server/ai/simulation/worldSampler.js";
import PlayRolloutSim from "../server/ai/simulation/playRolloutSimulator.js";

function c(rank, suit) {
  return { rank, suit };
}

function freshCounts() {
  return { 0:5, 1:5, 2:5, 3:5 };
}

/* ================= BASIC ROUND ================= */

test("round plays without crash", () => {
  const engine = new AIGameEngine([
    new MonteCarloAI(),
    new SimpleAI(),
    new MonteCarloAI(),
    new SimpleAI()
  ]);

  engine.playRound();

  assert.ok(engine.scores);
});

/* ================= MULTIPLE ROUNDS ================= */

test("multiple rounds remain stable", () => {
  const engine = new AIGameEngine([
    new MonteCarloAI({ simulationsPerMove: 20 }),
    new SimpleAI(),
    new MonteCarloAI({ simulationsPerMove: 20 }),
    new SimpleAI()
  ]);

  for (let i = 0; i < 30; i++) {
    engine.playRound();
  }

  assert.ok(engine.scores.team0 >= 0);
  assert.ok(engine.scores.team1 >= 0);
});

/* ================= FULL GAME ================= */

test("full game completes", () => {
  const engine = new AIGameEngine(
    [
      new MonteCarloAI({ simulationsPerMove: 20 }),
      new SimpleAI(),
      new MonteCarloAI({ simulationsPerMove: 20 }),
      new SimpleAI()
    ],
    { winningScore: 10 }
  );

  engine.playGame();

  assert.ok(engine.scores.team0 >= 0);
});

/* ================= MONTE RETURNS LEGAL ACTION ================= */

test("Monte returns legal card", () => {
  const ai = new MonteCarloAI();

  const context = {
    phase: "play_card",
    hand: [c("A","hearts"), c("K","hearts"), c("A","spades"), c("K","clubs"), c("J","hearts")],
    trump: "hearts",
    trickCards: [],
    myIndex: 0,
    playedCards: [],
    cardsRemaining: {0:5,1:5,2:5,3:5}
  };

  const action = ai.getAction(context);

  assert.ok(context.hand.some(
    card => card.rank === action.card.rank && card.suit === action.card.suit
  ));
});

/* ================= CONTEXT IMMUTABILITY ================= */

test("Monte does not mutate context", () => {
  const ai = new MonteCarloAI();

  const context = {
    phase: "play_card",
    hand: [c("A","hearts"), c("K","hearts"), c("10","diamonds"), c("9","spades"), c("J","hearts")],
    trump: "hearts",
    trickCards: [],
    myIndex: 0,
    playedCards: [],
    cardsRemaining: {0:5,1:5,2:5,3:5}
  };

  const before = JSON.stringify(context);

  ai.getAction(context);

  const after = JSON.stringify(context);

  assert.equal(after, before);
});

/* ================= WORLD SAMPLER CONSISTENCY ================= */

test("sampleWorld produces consistent hands", () => {
  const context = {
    hand: [c("A","hearts"), c("K","hearts"), c("Q","hearts"), c("J","hearts"), c("9","hearts")],
    myIndex: 0,
    trump: "hearts",
    playedCards: [],
    trickCards: [],
    cardsRemaining: {0:5,1:5,2:5,3:5}
  };

  for (let i = 0; i < 20; i++) {
    const world = sampleWorld(context);

    const total =
      Object.values(world).flat().length +
      context.playedCards.length +
      context.trickCards.length;

    assert.equal(total, 20);
  }
});

test("sampleWorld valid mid trick counts", () => {
  const context = {
    hand: [c("A","hearts"), c("K","hearts"), c("Q","clubs"), c("9","spades"), c("10","diamonds")],
    myIndex: 0,
    trump: "hearts",

    trickCards: [
      { player: 1, card: c("9","clubs") },
      { player: 2, card: c("J","clubs") }
    ],

    playedCards: [],

    cardsRemaining: {0:5,1:4,2:4,3:5}
  };

  const world = sampleWorld(context);

  const total =
    Object.values(world).flat().length +
    context.trickCards.length;

  assert.equal(total, 20);
});

test("sampleWorld mid hand trick 3 prefix consistent", () => {
  const context = {
    hand: [c("A","hearts"), c("K","hearts"), c("Q","clubs")],
    myIndex: 0,
    trump: "hearts",

    playedCards: Array(8).fill(c("9","spades")), // count only

    trickCards: [
      { player: 1, card: c("10","clubs") },
      { player: 2, card: c("J","clubs") }
    ],

    cardsRemaining: {0:3,1:2,2:2,3:3}
  };

  const world = sampleWorld(context);

  const total =
    Object.values(world).flat().length +
    context.playedCards.length +
    context.trickCards.length;

  assert.equal(total, 20);
});

test("sampleWorld start of last trick consistent", () => {
  const context = {
    hand: [c("A","hearts")],
    myIndex: 0,
    trump: "hearts",

    playedCards: Array(16).fill(c("9","clubs")),
    trickCards: [],

    cardsRemaining: {0:1,1:1,2:1,3:1}
  };

  const world = sampleWorld(context);

  const total =
    Object.values(world).flat().length +
    context.playedCards.length;

  assert.equal(total, 20);
});


test("sampleWorld deep loner state — 2/2/3/5 cards remaining", () => {
  // Seat 0 is loner → partner seat 2 sits out
  const context = {
    myIndex: 0,
    trump: "hearts",

    hand: [
      c("A","hearts"),
      c("K","hearts"),
      c("Q","clubs")
    ],

    alonePlayerIndex: 0,

    // Two full tricks (6 cards) + 2 cards into current trick
    playedCards: [
      c("J","hearts"), c("9","hearts"), c("A","clubs"),
      c("K","clubs"), c("Q","hearts"), c("10","hearts")
    ],

    trickCards: [
      { player: 1, card: c("9","clubs") },
      { player: 3, card: c("10","clubs") }
    ],

    cardsRemaining: {
      0: 3, // loner
      1: 2,
      2: 5, // partner sitting out
      3: 2
    }
  };

  const world = sampleWorld(context);

  const total =
    Object.values(world).flat().length +
    context.playedCards.length +
    context.trickCards.length;

  assert.equal(total, 20);

  // Partner must still have full hand
  assert.equal(world[2].length, 5);
});

test("sampleWorld never produces duplicate cards", () => {
  for (let i = 0; i < 100; i++) {
    const context = {
      hand: [c("A","hearts"), c("K","hearts"), c("Q","hearts"), c("J","hearts"), c("9","hearts")],
      myIndex: 0,
      trump: "hearts",
      playedCards: [],
      trickCards: [],
      cardsRemaining: {0:5,1:5,2:5,3:5}
    };

    const world = sampleWorld(context);

    const all = Object.values(world).flat();

    const set = new Set(all.map(c => c.rank + c.suit));

    assert.equal(set.size, all.length);
  } 
  
});

test("sampleWorld respects void info", () => {
  for (let i = 0; i < 100; i++) {

    // Trick history:
    // Player 0 led spades
    // Player 1 played hearts → failed to follow → void in spades

    const context = {
      hand: [
        c("A","clubs"),
        c("K","clubs"),
        c("Q","hearts"),
        c("J","hearts")
      ],
      myIndex: 0,
      trump: "hearts",

      playedCards: [
        c("9","spades"),   // lead
        c("9","hearts"),   // player 1 fails to follow → void spades
        c("10","spades"),
        c("J","spades")
      ],

      trickCards: [],

      voidInfo: {
        1: { spades: true }
      },

      cardsRemaining: {
        0: 4,
        1: 4,
        2: 4,
        3: 4
      }
    };

    const world = sampleWorld(context);

    // Player 1 must not receive spades
    for (const card of world[1]) {
      assert.notEqual(card.suit, "spades");
    }

    // Sanity: totals still 20
    const total =
      Object.values(world).flat().length +
      context.playedCards.length;

    assert.equal(total, 20);
  }
});

test("sampleWorld dealer upcard assumption does not break totals", () => {
  const context = {
    hand: [c("A","hearts"), c("K","hearts"), c("Q","hearts"), c("J","hearts"), c("9","hearts")],
    myIndex: 0,
    trump: "hearts",
    playedCards: [],
    trickCards: [],
    dealerIndex: 1,
    upcard: c("10","hearts"),
    dealerPickedUp: true,
    cardsRemaining: {0:5,1:5,2:5,3:5}
  };

  const world = sampleWorld(context);

  const total = Object.values(world).flat().length;

  assert.equal(total, 20);
});



/* ================= ROLLOUT STABILITY ================= */

test("rollout returns finite result", () => {
  const context = {
  hand: [c("A","hearts"), c("K","hearts"), c("Q","hearts"), c("J","hearts"), c("9","hearts")],
  myIndex: 0,
  trump: "hearts",
  playedCards: [],
  trickCards: [],
  cardsRemaining: {0:5,1:5,2:5,3:5}
};
  const world = sampleWorld(context);

  const sim = new PlayRolloutSim({
    context,
    fixedHands: world,
    rootPlayerIndex: 0,
    playoutAI: new SimpleAI()
  });

  const result = sim.run();

  assert.ok(Number.isFinite(result));
});

/* ================= REPEATED MONTE CALLS ================= */

test("repeated Monte calls remain stable", () => {
  const ai = new MonteCarloAI({ simulationsPerMove: 30 });

  const context = {
    phase: "play_card",
    hand: [c("A","hearts"), c("K","hearts"), c("9","hearts"), c("10","spades"), c("Q","clubs")],
    trump: "hearts",
    trickCards: [{ player: 1, card: c("9","spades") }],
    leadSuit: "spades",
    myIndex: 0,
    playedCards: [],
    cardsRemaining: {0:5,1:4,2:5,3:5}
  };

  for (let i = 0; i < 50; i++) {
    const action = ai.getAction(context);
    assert.ok(action.card);
    assert.ok(context.hand.some(
      card => card.rank === action.card.rank && card.suit === action.card.suit
    ));
    assert.equal(action.card.suit, "spades");
  }
});

/* ================= LONG RUN ENGINE STABILITY ================= */

test("engine stable over long run", () => {
  const engine = new AIGameEngine([
    new MonteCarloAI({ simulationsPerMove: 10 }),
    new SimpleAI(),
    new MonteCarloAI({ simulationsPerMove: 10 }),
    new SimpleAI()
  ]);

  for (let i = 0; i < 100; i++) {
    engine.playRound();
  }

  assert.ok(engine.scores.team0 >= 0);
});
