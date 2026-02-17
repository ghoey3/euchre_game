export function cloneCtx(ctx) {
  return structuredClone(ctx);
}


// export function cloneCtx(ctx) {
//   return {
//     ...ctx,

//     hand: ctx.hand ? ctx.hand.slice() : undefined,

//     upcard: ctx.upcard ?? null,

//     trickCards: ctx.trickCards
//       ? ctx.trickCards.map(t => ({
//           player: t.player,
//           card: t.card
//         }))
//       : [],

//     tricksSoFar: ctx.tricksSoFar
//       ? { team0: ctx.tricksSoFar.team0, team1: ctx.tricksSoFar.team1 }
//       : { team0: 0, team1: 0 },

//     // ⚠️ shallow copy instead of structuredClone
//     voidInfo: ctx.voidInfo
//       ? {
//           0: { ...ctx.voidInfo[0] },
//           1: { ...ctx.voidInfo[1] },
//           2: { ...ctx.voidInfo[2] },
//           3: { ...ctx.voidInfo[3] }
//         }
//       : {0:{},1:{},2:{},3:{}},

//     playedCards: ctx.playedCards ? ctx.playedCards.slice() : [],
//     cardsRemaining: ctx.cardsRemaining ? { ...ctx.cardsRemaining } : undefined,
//     alonePlayerIndex: ctx.alonePlayerIndex ?? null,
//     dealerPickedUp: ctx.dealerPickedUp ?? null,
//     dealerIndex: ctx.dealerIndex ?? null
//   };
// }

function cloneHand(hand) {
  return hand ? hand.slice() : [];
}

export function cloneHands(hands) {
  return {
    0: cloneHand(hands[0]),
    1: cloneHand(hands[1]),
    2: cloneHand(hands[2]),
    3: cloneHand(hands[3])
  };
}