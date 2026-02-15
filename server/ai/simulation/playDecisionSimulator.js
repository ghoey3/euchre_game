import PlayRolloutSim from "./playRolloutSimulator.js";
import { createDeck, shuffle } from "../../engine/deck.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";


const DEBUG_PLAY = false;

function cardStr(c) {
  return `${c.rank}${c.suit}`;
}
export default class PlayDecisionSim {

  constructor({
    simulations = 200,
    playoutAI = null,
    aiFactory = null
  }) {
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
    legal.forEach(card => totals.set(card, 0));

    for (let i = 0; i < this.simulations; i++) {

      const world = this.sampleWorld(context);

      for (const move of legal) {

        const hands = JSON.parse(JSON.stringify(world));

        hands[context.myIndex] =
          context.hand.filter(c =>
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
          playoutAI: this.playoutAI
        });

        totals.set(move, totals.get(move) + rollout.run());
      }
    }

    const sorted = [...totals.entries()]
      .sort((a,b)=>b[1]-a[1]);

    const chosen = sorted[0][0];
  

    if (DEBUG_PLAY) {

      console.log("\n================ PLAY DECISION ================");

      console.log("Seat:", context.myIndex);
      console.log("Trump:", context.trump);
      console.log("Lead suit:", context.leadSuit ?? "(leading)");

      console.log("\nTrick so far:");

      (context.trickCards || []).forEach(t => {
        console.log(`Player ${t.player} -> ${cardStr(t.card)}`);
      });

      console.log(
        "\nHand:",
        context.hand.map(cardStr).join(" ")
      );

      console.log(
        "Legal:",
        legal.map(cardStr).join(" ")
      );

      console.log("\nRollout totals:");

      for (const [card, score] of sorted) {
        console.log(`${cardStr(card)} -> ${score.toFixed(3)}`);
      }

      console.log("\nChosen:", cardStr(chosen));
      console.log("================================================\n");
    }

    return chosen;
  }

  getLegalCards(hand, leadSuit, trump) {

    if (!leadSuit) return hand;

    const follow = hand.filter(c =>
      getEffectiveSuit(c, trump) === leadSuit
    );

    return follow.length ? follow : hand;
  }

  sampleWorld(context) {

    const deck = createDeck();

    const known = [
      ...context.hand,
      ...(context.playedCards || []),
      ...(context.trickCards || []).map(t => t.card),
      context.upcard
    ].filter(Boolean);

    let remaining = deck.filter(c =>
      !known.some(k => k.rank === c.rank && k.suit === c.suit)
    );

    shuffle(remaining);

    const hands = {0:[],1:[],2:[],3:[]};
    hands[context.myIndex] = [...context.hand];

    const target = context.hand.length;

    for (let p = 0; p < 4; p++) {

      if (p === context.myIndex) continue;

      const voids = context.voidInfo?.[p] || {};

      while (hands[p].length < target && remaining.length) {

        const card = remaining.pop();

        const eff = getEffectiveSuit(card, context.trump);

        if (voids[eff]) continue;

        hands[p].push(card);
      }
    }

    return hands;
  }
}