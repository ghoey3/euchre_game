import BaseAI from "./baseAI.js";
import SimpleAI from "./simpleAI.js";
import { getEffectiveSuit } from "../engine/cardUtils.js";

/*
  MonteCarloAI
  - Extends BaseAI
  - Delegates heuristic logic to SimpleAI
  - Overrides play_card with Monte Carlo
*/

export default class MonteCarloAI extends BaseAI {

  constructor(options = {}) {
    super("MonteCarloAI");

    this.simulationsPerMove = options.simulationsPerMove ?? 200;
    this.explorationThreshold = options.explorationThreshold ?? 1;

    // Heuristic fallback
    this.fallbackAI = new SimpleAI();
  }

  /* ============================= */
  /* ========= BIDDING =========== */
  /* ============================= */

  orderUp(context) {
    return this.fallbackAI.orderUp(context);
  }

  callTrump(context) {
    return this.fallbackAI.callTrump(context);
  }

  callTrumpForced(context) {
    return this.fallbackAI.callTrumpForced(context);
  }

  getDiscard(context) {
    return this.fallbackAI.getDiscard(context);
  }

  /* ============================= */
  /* ========= CARD PLAY ========= */
  /* ============================= */

  playCard(context) {
    const { hand, leadSuit, trump } = context;

    const legalMoves = this.getLegalCards(hand, leadSuit, trump);

    // If trivial, use heuristic
    if (legalMoves.length <= this.explorationThreshold) {
      return this.fallbackAI.playCard(context);
    }

    return this.runMonteCarlo(context, legalMoves);
  }

  /* ============================= */
  /* ========= LEGAL MOVES ======= */
  /* ============================= */

  getLegalCards(hand, leadSuit, trump) {
    if (!leadSuit) return hand;

    const follow = hand.filter(
      c => getEffectiveSuit(c, trump) === leadSuit
    );

    return follow.length > 0 ? follow : hand;
  }

  /* ============================= */
  /* ========= MONTE CARLO ======= */
  /* ============================= */

  runMonteCarlo(context, legalMoves) {

    let bestCard = legalMoves[0];
    let bestEV = -Infinity;

    for (const candidate of legalMoves) {

      let totalEV = 0;

      for (let i = 0; i < this.simulationsPerMove; i++) {

        const simState = this.createSimulationState(
          context,
          candidate
        );

        const ev = this.simulateFromState(simState);

        totalEV += ev;
      }

      const avgEV = totalEV / this.simulationsPerMove;

      if (avgEV > bestEV) {
        bestEV = avgEV;
        bestCard = candidate;
      }
    }

    return bestCard;
  }

  /* ============================= */
  /* ===== SIMULATION HELPERS ==== */
  /* ============================= */

  createSimulationState(context, candidateCard) {
    // TODO:
    // - clone state
    // - remove candidate
    // - assign unknown cards
    // - copy void info
    return {};
  }

  simulateFromState(simState) {
    // TODO:
    // - use RoundSimulator
    // - return EV relative to this player
    return 0;
  }

  /* ============================= */
  /* ========= ACTION ROUTER ===== */
  /* ============================= */

  getAction(context) {
    switch (context.phase) {
      case "play_card":
        return { type: "play_card", card: this.playCard(context) };

      case "order_up":
        return { type: "order_up", ...this.orderUp(context) };

      case "call_trump":
        return { type: "call_trump", ...this.callTrump(context) };

      case "call_trump_forced":
        return { type: "call_trump_forced", ...this.callTrumpForced(context) };

      case "discard":
        return this.getDiscard(context);

      default:
        throw new Error("Unknown phase: " + context.phase);
    }
  }
}