import { createDeck, shuffle } from "../../engine/deck.js";
import { getEffectiveSuit } from "../../engine/cardUtils.js";

const DEBUG = false;
function sameCard(a, b) {
  return a.rank === b.rank && a.suit === b.suit;
}

export function sampleWorld(context) {
  const voidInfo = context.voidInfo || {0:{},1:{},2:{},3:{}};

  const deck = createDeck();

  const hands = {0:[],1:[],2:[],3:[]};

  const known = [
    ...context.hand,
    ...(context.playedCards || []),
    ...(context.trickCards || []).map(t => t.card)
  ];

  let remaining = deck.filter(card =>
    !known.some(k => sameCard(k, card))
  );

  shuffle(remaining);

  hands[context.myIndex] = [...context.hand];

  const playedCount = {0:0,1:0,2:0,3:0};

  for (const t of context.trickCards || []) {
    playedCount[t.player]++;
  }
  const targetSizes = context.cardsRemaining;

  if (!targetSizes) {
    throw new Error("cardsRemaining missing from context");
  }
  if (context.cardsRemaining[context.myIndex] !== context.hand.length) {
    throw new Error("cardsRemaining mismatch for my seat");
  }

  if (
    context.dealerPickedUp &&
    context.upcard &&
    context.dealerIndex !== context.myIndex
  ) {
    const dealer = context.dealerIndex;

    const alreadyInHand = hands[dealer].some(c =>
      sameCard(c, context.upcard)
    );

    const upcardSeen =
      (context.playedCards || []).some(c => sameCard(c, context.upcard)) ||
      (context.trickCards || []).some(t => sameCard(t.card, context.upcard));

    if (!alreadyInHand && !upcardSeen) {
      hands[dealer].push(context.upcard);
    }
  }
  for (let p = 0; p < 4; p++) {
    if (p === context.myIndex) continue;

    const voids = voidInfo[p] || {};

    while (hands[p].length < targetSizes[p]) {
      let idx = remaining.findIndex(card => {
        const eff = getEffectiveSuit(card, context.trump);
        return !voids[eff];
      });

      if (idx === -1) idx = 0;
      if (remaining.length === 0) {
        throw new Error("Sampler ran out of cards");
      }
      hands[p].push(remaining.splice(idx, 1)[0]);
    }
  }

  const total =
    Object.values(hands).flat().length +
    (context.playedCards?.length || 0) +
    (context.trickCards?.length || 0);

// debug only
  if (DEBUG) {
    console.log("Sample total:", total);
  }


  return hands;
}