import PlayRolloutSim from "./playRolloutSimulator.js";
import { createDeck, shuffle } from "../../engine/deck.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";

export default class PlayDecisionSim {

  constructor({ simulations = 200, playoutAI }) {
    this.simulations = simulations;
    this.playoutAI = playoutAI;
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

        // remove move from my hand
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
          playoutAI: this.playoutAI,
          fixedHands: hands
        });

        totals.set(move, totals.get(move) + rollout.run());
      }
    }

    return [...totals.entries()]
      .sort((a,b)=>b[1]-a[1])[0][0];
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