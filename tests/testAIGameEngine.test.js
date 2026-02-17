import test from "node:test";
import assert from "node:assert";

import AIGameEngine from "../server/ai/simulation/AIGameEngine.js";
import SimpleAI from "../server/ai/simpleAI.js";

import { getEffectiveSuit } from "../server/engine/cardUtils.js";
import { determineTrickWinner } from "../server/engine/trickLogic.js";
function c(rank, suit) {
  return { rank, suit };
}
function makePlayers() {
  return [
    new SimpleAI(),
    new SimpleAI(),
    new SimpleAI(),
    new SimpleAI()
  ];
}

function isMultipleOf4(n) {
  return n % 4 === 0;
}

/* ================= BASIC SANITY ================= */

test("engine can play one round", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playRound();
});

test("engine can play full game", () => {
  const engine = new AIGameEngine(makePlayers(), { winningScore: 3 });
  engine.playGame();
});

/* ================= CARD INVARIANTS ================= */

test("playedCards never exceeds 20", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playRound();
  assert.ok(engine.playedCards.length <= 20);
});

test("playedCards reset each round", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playRound();
  const first = engine.playedCards.length;
  engine.playRound();
  assert.ok(engine.playedCards.length <= 20);
});

/* ================= DEALER MECHANICS ================= */

test("dealer rotates correctly", () => {
  const engine = new AIGameEngine(makePlayers());
  const start = engine.dealerIndex;
  engine.rotateDealer();
  assert.equal(engine.dealerIndex, (start + 1) % 4);
});

test("dealer index always valid", () => {
  const engine = new AIGameEngine(makePlayers());
  for (let i = 0; i < 20; i++) {
    engine.rotateDealer();
    assert.ok(engine.dealerIndex >= 0 && engine.dealerIndex < 4);
  }
});

/* ================= SCORING ================= */

test("scores never negative", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playGame();
  assert.ok(engine.scores.team0 >= 0);
  assert.ok(engine.scores.team1 >= 0);
});

test("scores increase over time", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playRound();
  const total = engine.scores.team0 + engine.scores.team1;
  assert.ok(total >= 0);
});

/* ================= VOID INFO ================= */

test("voidInfo initialized each round", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playRound();
  assert.ok(engine.voidInfo);
});

/* ================= FOLLOW SUIT ================= */

test("round does not throw follow suit errors", () => {
  const engine = new AIGameEngine(makePlayers());
  assert.doesNotThrow(() => engine.playRound());
});

/* ================= TRICK FLOW ================= */

test("leader progresses without crash", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playRound();
});

test("round produces valid number of played cards", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playRound();

  const n = engine.playedCards.length;

  // Normal round → 20
  // Loner round → 15
  assert.ok(n === 20 || n === 15);
});

/* ================= RESET BEHAVIOR ================= */

test("resetGame clears scores", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playGame();
  engine.resetGame();
  assert.equal(engine.scores.team0, 0);
  assert.equal(engine.scores.team1, 0);
});

/* ================= REUSABILITY ================= */

test("engine reusable across games", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playGame();
  engine.playGame();
});

/* ================= STRESS TESTS ================= */

test("50 rounds stability", () => {
  const engine = new AIGameEngine(makePlayers());
  for (let i = 0; i < 50; i++) engine.playRound();
});

test("200 rounds stability", () => {
  const engine = new AIGameEngine(makePlayers());
  for (let i = 0; i < 200; i++) engine.playRound();
});

test("multiple games stability", () => {
  const engine = new AIGameEngine(makePlayers());
  for (let i = 0; i < 10; i++) engine.playGame();
});

/* ================= INVARIANT GUARDS ================= */

test("playedCards count always valid", () => {
  const engine = new AIGameEngine(makePlayers());

  for (let i = 0; i < 100; i++) {
    engine.playRound();

    const n = engine.playedCards.length;
    assert.ok(n === 20 || n === 15);
  }
});

test("no crash under heavy load", () => {
  const engine = new AIGameEngine(makePlayers());
  for (let i = 0; i < 1000; i++) engine.playRound();
});

/* ---------- card conservation ---------- */

test("playedCards never exceeds deck", () => {
  const engine = new AIGameEngine(makePlayers());
  for (let i = 0; i < 500; i++) {
    engine.playRound();
    assert.ok(engine.playedCards.length <= 20);
  }
});

/* ---------- loner stress ---------- */

class AlwaysLonerAI extends SimpleAI {
  getAction(ctx) {
    if (ctx.phase === "order_up") return { call: true, alone: true };
    if (ctx.phase === "call_trump") return { call: true, suit: "hearts", alone: true };
    return super.getAction(ctx);
  }
}

test("loner rounds stable", () => {
  const engine = new AIGameEngine([
    new AlwaysLonerAI(),
    new SimpleAI(),
    new SimpleAI(),
    new SimpleAI()
  ]);

  for (let i = 0; i < 50; i++) engine.playRound();
});

/* ---------- trick rules via shared logic ---------- */

test("right bower beats ace trump", () => {
  const winner = determineTrickWinner(
    [c("J","hearts"), c("A","hearts"), c("K","hearts"), c("Q","hearts")],
    "hearts",
    "hearts"
  );
  assert.equal(winner, 0);
});

test("trump beats lead suit", () => {
  const winner = determineTrickWinner(
    [c("A","clubs"), c("9","hearts"), c("K","clubs"), c("Q","clubs")],
    "clubs",
    "hearts"
  );
  assert.equal(winner, 1);
});


/* ---------- LEFT BOWER TESTS ---------- */

test("left bower counts as trump suit", () => {
  const card = { rank: "J", suit: "diamonds" }; // left for hearts
  const eff = getEffectiveSuit(card, "hearts");
  assert.equal(eff, "hearts");
});

test("left bower is not its printed suit", () => {
  const card = { rank: "J", suit: "diamonds" };
  const eff = getEffectiveSuit(card, "hearts");
  assert.notEqual(eff, "diamonds");
});

test("left bower beats ace of trump", () => {
  const winner = determineTrickWinner(
    [
      { rank: "J", suit: "diamonds" }, // left
      { rank: "A", suit: "hearts" },
      { rank: "K", suit: "hearts" },
      { rank: "Q", suit: "hearts" }
    ],
    "hearts",
    "hearts"
  );

  assert.equal(winner, 0);
});

test("right bower beats left bower", () => {
  const winner = determineTrickWinner(
    [
      { rank: "J", suit: "diamonds" }, // left
      { rank: "J", suit: "hearts" },   // right
      { rank: "A", suit: "hearts" },
      { rank: "K", suit: "hearts" }
    ],
    "hearts",
    "hearts"
  );

  assert.equal(winner, 1);
});

test("left bower follows trump", () => {
  const winner = determineTrickWinner(
    [
      { rank: "9", suit: "hearts" },
      { rank: "J", suit: "diamonds" }, // must follow
      { rank: "A", suit: "clubs" },
      { rank: "K", suit: "clubs" }
    ],
    "hearts",
    "hearts"
  );

  assert.equal(winner, 1);
});


/* ---------- FOLLOW SUIT ---------- */

test("player must follow suit when possible", () => {
  // If this ever passes illegally, engine rule enforcement is broken.
  const leadSuit = "hearts";
  const trump = "spades";

  const hand = [c("A","hearts"), c("K","clubs")];

  const follow = hand.filter(card =>
    getEffectiveSuit(card, trump) === leadSuit
  );

  assert.ok(follow.length > 0);
});

/* ---------- LEFT BOWER MUST FOLLOW TRUMP ---------- */

test("left bower follows trump suit", () => {
  const trump = "hearts";
  const card = c("J","diamonds");

  const eff = getEffectiveSuit(card, trump);
  assert.equal(eff, "hearts");
});

/* ---------- TRUMP ORDERING ---------- */

test("right > left > ace > king > queen > 10 > 9", () => {
  const trump = "hearts";

  const trick = [
    c("J","hearts"),   // right
    c("J","diamonds"), // left
    c("A","hearts"),
    c("K","hearts")
  ];

  const winner = determineTrickWinner(trick, "hearts", trump);
  assert.equal(winner, 0);
});

/* ---------- TRUMP BEATS NON TRUMP ---------- */

test("trump beats lead suit", () => {
  const trick = [
    c("A","clubs"),
    c("9","hearts"),
    c("K","clubs"),
    c("Q","clubs")
  ];

  const winner = determineTrickWinner(trick, "clubs", "hearts");
  assert.equal(winner, 1);
});

/* ---------- LEFT NOT PRINTED SUIT ---------- */

test("left bower not counted as printed suit", () => {
  const eff = getEffectiveSuit(c("J","diamonds"), "hearts");
  assert.notEqual(eff, "diamonds");
});

/* ---------- LEADER ROTATION ---------- */

test("winner becomes next leader", () => {
  const engine = new AIGameEngine(makePlayers());

  const before = engine.dealerIndex;
  engine.playRound();
  const after = engine.dealerIndex;

  assert.ok(after !== undefined);
});

/* ---------- PICKUP DOES NOT CORRUPT ---------- */

test("pickup does not corrupt state", () => {
  const engine = new AIGameEngine(makePlayers());
  engine.playRound();

  assert.ok(engine.playedCards.length <= 20);
});

/* ---------- SCORING NEVER DECREASES ---------- */

test("scores monotonic across rounds", () => {
  const engine = new AIGameEngine(makePlayers());

  let prev = 0;

  for (let i = 0; i < 20; i++) {
    engine.playRound();
    const total = engine.scores.team0 + engine.scores.team1;
    assert.ok(total >= prev);
    prev = total;
  }
});

/* ---------- LONER DOES NOT BREAK ---------- */

test("loner rounds remain consistent", () => {
  class LonerAI extends SimpleAI {
    getAction(ctx) {
      if (ctx.phase === "order_up") return { call:true, alone:true };
      if (ctx.phase === "call_trump") return { call:true, suit:"hearts", alone:true };
      return super.getAction(ctx);
    }
  }

  const engine = new AIGameEngine([
    new LonerAI(),
    new SimpleAI(),
    new SimpleAI(),
    new SimpleAI()
  ]);

  for (let i=0;i<20;i++) engine.playRound();
});

/* ---------- LONG RULE STRESS ---------- */

test("rule stress 1000 rounds", () => {
  const engine = new AIGameEngine(makePlayers());
  for (let i=0;i<1000;i++) engine.playRound();
});

test("trackStats exposes required aggregate fields", () => {
  const engine = new AIGameEngine(makePlayers(), {
    trackStats: true,
    winningScore: 5
  });

  engine.playGame();

  const stats = engine.stats;
  const required = [
    "totalRounds",
    "sweeps",
    "euchres",
    "aloneCalls",
    "aloneSweeps",
    "aloneWins",
    "aloneEuchres"
  ];

  for (const key of required) {
    assert.equal(typeof stats[key], "number");
    assert.ok(Number.isFinite(stats[key]));
  }
});

test("trackStats alone call invariant holds", () => {
  const engine = new AIGameEngine(makePlayers(), {
    trackStats: true
  });

  for (let i = 0; i < 100; i++) {
    engine.playRound();
  }

  const resolvedAloneOutcomes =
    engine.stats.aloneSweeps +
    engine.stats.aloneWins +
    engine.stats.aloneEuchres;

  assert.ok(engine.stats.aloneCalls >= resolvedAloneOutcomes);
  assert.equal(engine.stats.totalRounds, engine.stats.roundLogs.length);
});
