import { determineTrickWinner } from "../../engine/trickLogic.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";
import { profiler } from "../profiler.js";
import { cloneCtx, cloneHands } from "./simClone.js";

import { validateWorld } from "./monteSentinel.js";

const DEBUG = false;

function dlog(...args) {
  if (DEBUG) console.log("[ROLLOUT]", ...args);
}

export default class PlayRolloutSim {

  constructor({ context, fixedHands, playoutAI, aiFactory, rootPlayerIndex }) {

    dlog("=== CONSTRUCTOR START ===");
    this.cardsRemaining = { ...(context.cardsRemaining || {}) };
    this.rootPlayerIndex = rootPlayerIndex ?? context.myIndex;
    this.ctx = normalizeCtx(cloneCtx(context));
    this.hands = cloneHands(fixedHands);

    dlog("Hands after clone:");
    for (let i = 0; i < 4; i++) {
      dlog("Seat", i, "hand:", this.hands[i]?.map(c => c.rank + c.suit));
      if (!this.hands[i]) {
        throw new Error(`Rollout missing hand for seat ${i}`);
      }
    }


    this.ais = {};

    for (let i = 0; i < 4; i++) {

      let ai = null;

      if (aiFactory) {
        ai = aiFactory(i);
        dlog("AI factory seat", i, "->", ai?.constructor?.name);
      } else if (playoutAI) {
        ai = playoutAI;
        dlog("Using playoutAI for seat", i);
      }

      if (!ai) {
        throw new Error(`No AI returned for seat ${i}`);
      }

      if (typeof ai.getAction !== "function") {
        dlog("BAD AI OBJECT:", ai);
        throw new Error(`AI missing getAction for seat ${i}`);
      }

      this.ais[i] = ai;
    }

    this.trump = this.ctx.trump;
    if (this.ctx.trickLeader != null) {
      this.leader = this.ctx.trickLeader;
    } else if (this.ctx.trickCards?.length > 0) {
      this.leader = this.ctx.trickCards[0].player;
    } else if (this.ctx.dealerIndex != null) {
      this.leader = (this.ctx.dealerIndex + 1) % 4;
    } else {
      this.leader = this.rootPlayerIndex ?? 0;
    }

    if (!Number.isFinite(this.leader)) {
      throw new Error("Invalid leader in rollout");
    }

    this.playedCards = [...(this.ctx.playedCards || [])];
    dlog("[ROLLOUT TOTAL]",
      Object.values(this.hands).flat().length +
      (this.playedCards.length || 0) +
      (this.ctx.trickCards.length || 0)
    );
    validateWorld({
      hands: this.hands,
      playedCards: this.playedCards,
      trickCards: this.ctx.trickCards
    });
    dlog("Leader:", this.leader);
    dlog("PlayedCards:", this.playedCards.map(c => c.rank + c.suit));
    dlog("=== CONSTRUCTOR END ===");
  }

  buildSeatOrder(leader) {

    const partner =
      this.ctx.alonePlayerIndex != null
        ? (this.ctx.alonePlayerIndex + 2) % 4
        : null;

    const order = [];

    for (let offset = 0; offset < 4; offset++) {
      const p = (leader + offset) % 4;
      if (p === partner) continue;
      order.push(p);
    }

    dlog("Seat order:", order);
    return order;
  }

  run() {

    dlog("=== RUN START ===");

    const start = profiler.start("rollout");

    let tricks = [
      this.ctx.tricksSoFar?.team0 ?? 0,
      this.ctx.tricksSoFar?.team1 ?? 0
    ];

    let trickCards = [...(this.ctx.trickCards || [])];
    validateWorld({
      hands: this.hands,
      playedCards: this.playedCards,
      trickCards
    });
    dlog("Initial trickCards:", trickCards);

    while (tricks[0] + tricks[1] < 5) {

      dlog("--- New trick loop ---");
      dlog("Leader:", this.leader);

      const seatOrder = this.buildSeatOrder(this.leader);

      if (trickCards.length === 0) {

        let leadSuit = null;

        for (const player of seatOrder) {

          dlog("Turn:", player);

          const ai = this.ais[player];
          if (!ai) throw new Error("AI undefined for seat " + player);

          const hand = this.hands[player];
          if (!hand) throw new Error("Hand undefined for seat " + player);

          dlog("Hand:", hand.map(c => c.rank + c.suit));

          const action = ai.getAction({
            phase: "play_card",
            hand,
            trump: this.trump,
            trickCards,
            leadSuit,
            trickLeader: this.leader,
            myIndex: player,
            playedCards: this.playedCards
          });

          if (!action || !action.card) {
            throw new Error(`Seat ${player} returned invalid action`);
          }

          let card = action.card;

          dlog("Chosen card:", card.rank + card.suit);

          if (!leadSuit) {
            leadSuit = getEffectiveSuit(card, this.trump);
            dlog("Lead suit set to:", leadSuit);
          }

          card = this.enforceLegal(player, card, leadSuit);
          if (DEBUG) {
            console.log(
              `[REMOVE] seat ${player}`,
              card.rank + card.suit
            );
          }
          this.removeCard(hand, card);
          trickCards.push({ player, card });

          validateWorld({
            hands: this.hands,
            playedCards: this.playedCards,
            trickCards
          });
        }

      } else {

        let leadSuit = getEffectiveSuit(trickCards[0].card, this.trump);

        for (const player of seatOrder) {

          if (trickCards.some(t => t.player === player)) continue;

          dlog("Finishing trick — turn:", player);

          const ai = this.ais[player];
          if (!ai) throw new Error("AI undefined for seat " + player);

          const action = ai.getAction({
            phase: "play_card",
            hand: this.hands[player],
            trump: this.trump,
            trickCards,
            leadSuit,
            trickLeader: this.leader,
            myIndex: player,
            playedCards: this.playedCards
          });

          if (!action || !action.card) {
            throw new Error(`Seat ${player} invalid action`);
          }

          let card = this.enforceLegal(player, action.card, leadSuit);
          if (DEBUG) {
            console.log(
              `[REMOVE] seat ${player}`,
              card.rank + card.suit
            );
          }
          this.removeCard(this.hands[player], card);
          trickCards.push({ player, card });
        }
      }

      dlog("Trick complete:", trickCards.map(t => `${t.player}:${t.card.rank}${t.card.suit}`));

      const leadSuit = getEffectiveSuit(trickCards[0].card, this.trump);

      const winOffset = determineTrickWinner(
        trickCards.map(t => t.card),
        leadSuit,
        this.trump
      );

      const winner = trickCards[winOffset].player;

      dlog("Winner:", winner);

      this.leader = winner;
      tricks[winner % 2]++;

      for (const t of trickCards) {
        this.playedCards.push(t.card);
      }
      validateWorld({
        hands: this.hands,
        playedCards: this.playedCards,
        trickCards: []
      });
      trickCards = [];

      this.checkInvariant();
    }

    profiler.end("rollout", start);

    const myTeam = this.rootPlayerIndex % 2;

    dlog("=== RUN END ===");

    return myTeam === 0
      ? tricks[0] - tricks[1]
      : tricks[1] - tricks[0];
  }

  checkInvariant() {

    const seen = new Set();

    const add = (card) => {
      const key = card.rank + card.suit;
      if (seen.has(key)) {
        throw new Error("Duplicate card: " + key);
      }
      seen.add(key);
    };

    Object.values(this.hands).forEach(h => h.forEach(add));
    this.playedCards.forEach(add);

    const total =
      Object.values(this.hands).flat().length +
      this.playedCards.length;

    dlog("Invariant total:", total);

    if (total !== 20) {
      throw new Error("Card conservation violated: " + total);
    }
  }

  enforceLegal(player, card, leadSuit) {

    const hand = this.hands[player];

    const follow = hand.filter(c =>
      getEffectiveSuit(c, this.trump) === leadSuit
    );

    if (!follow.length) return card;

    const legal = follow.some(c =>
      c.rank === card.rank && c.suit === card.suit
    );

    return legal ? card : follow[0];
  }

  removeCard(hand, card) {

    const idx = hand.findIndex(c =>
      c.rank === card.rank && c.suit === card.suit
    );

    if (idx === -1) {
      throw new Error("Removal drift");
    }

    hand.splice(idx, 1);
  }
}

function normalizeCtx(ctx) {
  return {
    ...ctx,
    trickCards: ctx.trickCards ?? [],
    playedCards: ctx.playedCards ?? [],
    tricksSoFar: ctx.tricksSoFar ?? { team0: 0, team1: 0 },
    voidInfo: ctx.voidInfo ?? {0:{},1:{},2:{},3:{}}
  };
}