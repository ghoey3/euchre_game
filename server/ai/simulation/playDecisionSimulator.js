import PlayRolloutSim from "./playRolloutSimulator.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";
import { cloneHands } from "./simClone.js";
import { sampleWorld } from "./worldSampler.js";
const DEBUG = false

const cardKey  = c => c.rank + c.suit;
export default class PlayDecisionSim {

  constructor({ simulations = 200, playoutAI = null, aiFactory = null }) {
    this.simulations = simulations;
    this.playoutAI = playoutAI;
    this.aiFactory = aiFactory;
  }

  chooseCard(context) {

    const legal = this.getLegalCards(
      context.hand,
      context.leadSuit,
      context.trump
    );

    if (legal.length === 1) return legal[0];

    const totals = new Map();
    legal.forEach(card => totals.set(cardKey(card), 0));

    for (let i = 0; i < this.simulations; i++) {
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

      const world = sampleWorld(context);
      if (DEBUG) {
        console.log("\n[SAMPLE WORLD]");
        for (let i = 0; i < 4; i++) {
          console.log(
            `Seat ${i}:`,
            (world[i] || []).map(c => c.rank + c.suit)
          );
        }

        const total =
          Object.values(world).flat().length +
          (context.playedCards?.length || 0) +
          (context.trickCards?.length || 0);

        console.log("Total cards including history:", total);
      }

      for (const move of legal) {

        const hands = cloneHands(world);

        hands[context.myIndex] =
          hands[context.myIndex].filter(c =>
            !(c.rank === move.rank && c.suit === move.suit)
          );
        if (DEBUG) {
          console.log(
            `[AFTER REMOVE] seat ${context.myIndex}:`,
            hands[context.myIndex].map(c => c.rank + c.suit)
          );
        }
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
          rootPlayerIndex: context.myIndex // ⭐ ADD
        });
        const k = cardKey(move);
        totals.set(k, totals.get(k) + rollout.run());
        
      }
    }

    return legal.sort(
      (a,b) => totals.get(cardKey(b)) - totals.get(cardKey(a))
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