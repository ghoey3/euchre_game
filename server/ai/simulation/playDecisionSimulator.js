import PlayRolloutSim from "./playRolloutSimulator.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";
import { cloneHands } from "./simClone.js";
import { sampleWorld } from "./worldSampler.js";
import { profiler } from "../profiler.js";

const DEBUG = false;

const cardKey = c => c.rank + c.suit;

export default class PlayDecisionSim {

  constructor({
    simulations = 200,
    totalRolloutsPerDecision = null,
    playoutAI = null,
    aiFactory = null
  }) {
    this.simulations = simulations;
    this.totalRolloutsPerDecision = totalRolloutsPerDecision;
    this.playoutAI = playoutAI;
    this.aiFactory = aiFactory;
  }

  chooseCard(input) {
    const context = structuredClone(input);
    this.ctx = context;
    this.myIndex = context.myIndex;
    this.dealerIndex = context.dealerIndex;

    const legal = this.getLegalCards(
      context.hand,
      context.leadSuit,
      context.trump
    );

    if (legal.length === 1) return legal[0];

    const totals = new Map();
    legal.forEach(card => totals.set(cardKey(card), 0));

    const totalBudget =
      this.totalRolloutsPerDecision ??
      (this.simulations * legal.length);

    const simsPerMove = Math.floor(totalBudget / legal.length);
    const extraMoves = totalBudget % legal.length;

    for (let i = 0; i < this.simulations; i++) {
      if (i >= simsPerMove + (extraMoves > 0 ? 1 : 0)) {
        break;
      }

      if (DEBUG) {
        console.log("PLAY SIM CONTEXT", {
          myIndex: context.myIndex,
          hand: context.hand.length,
          played: context.playedCards?.length || 0,
          trick: context.trickCards?.length || 0,
          trump: context.trump,
          leadSuit: context.leadSuit
        });
      }

      const sampleStart = profiler.start("playDecision.sampleWorld");
      const world = sampleWorld(context);
      profiler.end("playDecision.sampleWorld", sampleStart);

      if (DEBUG) {
        const total =
          Object.values(world).flat().length +
          (context.playedCards?.length || 0) +
          (context.trickCards?.length || 0);

        console.log("Total cards including history:", total);
      }

      for (let moveIndex = 0; moveIndex < legal.length; moveIndex++) {
        const move = legal[moveIndex];

        if (moveIndex >= extraMoves && i >= simsPerMove) {
          continue;
        }

        const hands = cloneHands(world);

        hands[context.myIndex] =
          hands[context.myIndex].filter(c =>
            !(c.rank === move.rank && c.suit === move.suit)
          );

        const nextContext = {
          ...context,
          hand: hands[context.myIndex],
          trickCards: [
            ...(context.trickCards || []),
            { player: context.myIndex, card: move }
          ],
          leadSuit:
            context.leadSuit ||
            getEffectiveSuit(move, context.trump)
        };

        const rollout = new PlayRolloutSim({
          context: nextContext,
          fixedHands: hands,
          aiFactory: this.aiFactory,
          playoutAI: this.playoutAI,
          rootPlayerIndex: context.myIndex
        });

        const rolloutStart = profiler.start("playDecision.rollout");
        const result = rollout.run();
        profiler.end("playDecision.rollout", rolloutStart);

        const k = cardKey(move);
        totals.set(k, totals.get(k) + result);
      }
    }

    return legal.sort(
      (a, b) => totals.get(cardKey(b)) - totals.get(cardKey(a))
    )[0];
  }

  getLegalCards(hand, leadSuit, trump) {

    if (!leadSuit) return hand;

    const follow = hand.filter(c =>
      getEffectiveSuit(c, trump) === leadSuit
    );

    return follow.length ? follow : hand;
  }
}
