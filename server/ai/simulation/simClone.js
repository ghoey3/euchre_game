export function cloneCtx(ctx) {
  return {
    ...ctx,

    hand: ctx.hand
      ? ctx.hand.map(c => ({ rank: c.rank, suit: c.suit }))
      : undefined,

    upcard: ctx.upcard
      ? { rank: ctx.upcard.rank, suit: ctx.upcard.suit }
      : undefined,

    trickCards: ctx.trickCards
      ? ctx.trickCards.map(t => ({
          player: t.player,
          card: { rank: t.card.rank, suit: t.card.suit }
        }))
      : [],

    tricksSoFar: ctx.tricksSoFar
      ? { team0: ctx.tricksSoFar.team0, team1: ctx.tricksSoFar.team1 }
      : { team0: 0, team1: 0 },

    voidInfo: ctx.voidInfo
      ? structuredClone(ctx.voidInfo)
      : {0:{},1:{},2:{},3:{}},

    playedCards: ctx.playedCards
      ? ctx.playedCards.map(c => ({ rank: c.rank, suit: c.suit }))
      : [],

    alonePlayerIndex: ctx.alonePlayerIndex ?? null
  };
}

function cloneHand(hand) {
  return hand.map(c => ({ rank: c.rank, suit: c.suit }));
}

export function cloneHands(hands) {
  return {
    0: cloneHand(hands[0] || []),
    1: cloneHand(hands[1] || []),
    2: cloneHand(hands[2] || []),
    3: cloneHand(hands[3] || [])
  };
}