
import BaseAI from "./baseAI.js";
import { getEffectiveSuit, getCardPower} from "../engine/cardUtils.js";
import { sameColorSuit } from "../engine/cardUtils.js";

// {
//   hand: [...],
//   upcard: {...},
//   dealerIndex: 2,
//   myIndex: 1,
//   currentTrick: [...],
//   leadSuit: "hearts",
//   trump: "spades",
//   trickNumber: 3,
//   score: { team1: 4, team2: 6 }
// }
function getRawCardPower(card, trump) {
  const effectiveSuit = getEffectiveSuit(card, trump);
  return getCardPower(card, effectiveSuit, trump);
}
function getLowestCard(cards, trump) {
  return cards.reduce((lowest, card) => {
    if (!lowest) return card;

    return getRawCardPower(card, trump) <
           getRawCardPower(lowest, trump)
      ? card
      : lowest;
  }, null);
}

function getHighestCard(cards, trump) {
  return cards.reduce((highest, card) => {
    if (!highest) return card;

    return getRawCardPower(card, trump) >
           getRawCardPower(highest, trump)
      ? card
      : highest;
  }, null);
}


export default class SimpleAI extends BaseAI {
  
  countTrumpStrength(hand, trump) {
    let count = 0;
    let hasRight = false;
    let hasLeft = false;
    let hasAce = false;

    for (let card of hand) {
      if (card.rank === "J" && card.suit === trump) {
        hasRight = true;
        count++;
      } else if (
        card.rank === "J" &&
        card.suit === sameColorSuit(trump)
      ) {
        hasLeft = true;
        count++;
      } else if (card.suit === trump) {
        count++;
        if (card.rank === "A") hasAce = true;
      }
    }

    return { count, hasRight, hasLeft, hasAce };
  }

  orderUp(context) {
    const trump = context.upcard.suit;

    const { count, hasRight, hasLeft, hasAce } =
      this.countTrumpStrength(context.hand, trump);

    if (count >= 2) {
      const goAlone =
        count >= 4 ||
        (hasRight && hasLeft && hasAce);

      return {
        call: true,
        alone: goAlone
      };
    }

    return {
      call: false,
      alone: false
    };
  }

  callTrump(context) {
    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const excluded = context.upcard.suit;

    let bestSuit = null;
    let bestStrength = -1;
    let bestData = null;

    for (let suit of suits) {
      if (suit === excluded) continue;

      const strength = this.countTrumpStrength(
        context.hand,
        suit
      );

      if (strength.count > bestStrength) {
        bestStrength = strength.count;
        bestSuit = suit;
        bestData = strength;
      }
    }

    if (bestStrength >= 3) {
      const goAlone =
        bestData.count >= 4 ||
        (bestData.hasRight && bestData.hasLeft && bestData.hasAce);

      return {
        call: true,
        suit: bestSuit,
        alone: goAlone
      };
    }

    return {
      call: false,
      suit: null,
      alone: false
    };
  }



  playCard(context) {
    const {
      hand,
      leadSuit,
      trump,
      trickCards,
      myIndex,
      trickNumber,
      alonePlayerIndex
    } = context;

    const partnerIndex = (myIndex + 2) % 4;

    const IAmAlone = alonePlayerIndex === myIndex;

    // Determine legal cards (must follow suit if possible)
    let legalCards = hand;

    if (leadSuit) {
      const followCards = hand.filter(
        c => getEffectiveSuit(c, trump) === leadSuit
      );

      if (followCards.length > 0) {
        legalCards = followCards;
      }
    }

    // ====================================
    // ALONE AGGRESSIVE LOGIC
    // ====================================
    if (IAmAlone) {

      // If leading → pull highest trump
      if (!leadSuit) {
        const trumpCards = hand.filter(
          c => getEffectiveSuit(c, trump) === trump
        );

        if (trumpCards.length > 0) {
          return getHighestCard(trumpCards, trump);
        }

        // No trump left → play highest remaining
        return getHighestCard(hand, trump);
      }

      // If following
      const trumpCards = legalCards.filter(
        c => getEffectiveSuit(c, trump) === trump
      );

      if (trumpCards.length > 0) {
        return getHighestCard(trumpCards, trump);
      }

      return getHighestCard(legalCards, trump);
    }

    // ====================================
    // NORMAL LEADING LOGIC
    // ====================================
    if (!leadSuit) {

      if (trickNumber === 0) {
        const nonTrumpCards = hand.filter(
          c => getEffectiveSuit(c, trump) !== trump
        );

        if (nonTrumpCards.length > 0) {
          return getHighestCard(nonTrumpCards, trump);
        }

        return getLowestCard(hand, trump);
      }

      return getLowestCard(hand, trump);
    }

    // ====================================
    // FOLLOWING LOGIC
    // ====================================

    
    let highestPower = -1;
    let winningPlayerOffset = 0;

    if (leadSuit && trickCards.length > 0) {
      trickCards.forEach((card, index) => {
        const power = getCardPower(card, leadSuit, trump);
        if (power > highestPower) {
          highestPower = power;
          winningPlayerOffset = index;
        }
      });
    }

    const defendingAgainstAlone =
      alonePlayerIndex !== null &&
      alonePlayerIndex !== myIndex;
    // =============================
    // FULLY AGGRESSIVE DEFENSE MODE
    // =============================
    if (defendingAgainstAlone) {

      // 1️⃣ Try to win with smallest winning card
      const winningOptions = legalCards.filter(card =>
        getCardPower(card, leadSuit, trump) > highestPower
      );

      if (winningOptions.length > 0) {
        return getLowestCard(winningOptions, trump);
      }

      // 2️⃣ If void in lead suit and have trump → TRUMP ANYWAY
      const hasLeadSuit = hand.some(
        c => getEffectiveSuit(c, trump) === leadSuit
      );

      const trumpCards = hand.filter(
        c => getEffectiveSuit(c, trump) === trump
      );

      if (!hasLeadSuit && trumpCards.length > 0) {
        return getLowestCard(trumpCards, trump);
      }

      // 3️⃣ Cannot win and cannot trump → apply pressure
      return getHighestCard(legalCards, trump);
    }

    const trickLeader = context.trickLeader;

    const winningPlayerIndex =
      (trickLeader + winningPlayerOffset) % 4;

    const partnerWinning =
      winningPlayerIndex === partnerIndex;

    if (partnerWinning) {
      return getLowestCard(legalCards, trump);
    }

    const winningOptions = legalCards.filter(card =>
      getCardPower(card, leadSuit, trump) > highestPower
    );

    if (winningOptions.length > 0) {
      return getLowestCard(winningOptions, trump);
    }

    return getLowestCard(legalCards, trump);
  }
  
  callTrumpForced(context) {
    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const excluded = context.upcard.suit;

    let bestSuit = null;
    let bestStrength = -1;
    let bestData = null;

    for (let suit of suits) {
      if (suit === excluded) continue;

      const strength = this.countTrumpStrength(
        context.hand,
        suit
      );

      if (strength.count > bestStrength) {
        bestStrength = strength.count;
        bestSuit = suit;
        bestData = strength;
      }
    }

    const goAlone =
      bestData.count >= 4 ||
      (bestData.hasRight && bestData.hasLeft && bestData.hasAce);

    return {
      call: true,
      suit: bestSuit,
      alone: goAlone
    };
  }

  getDiscard(context) { 
    return {
      type: "discard",
      card: getLowestCard(context.hand, context.trump)
    };
  }
  getAction(context) {
    switch (context.phase) {

      case "play_card": {
        const card = this.playCard(context);
        return {
          type: "play_card",
          card
        };
      }

      case "order_up": {
        const result = this.orderUp(context);
        return {
          type: "order_up",
          call: result.call,
          alone: result.alone
        };
      }

      case "call_trump": {
        const result = this.callTrump(context);
        return {
          type: "call_trump",
          call: result.call,
          suit: result.suit,
          alone: result.alone
        };
      }

      case "call_trump_forced": {
        const result = this.callTrumpForced(context);
        return {
          type: "call_trump_forced",
          suit: result.suit,
          alone: result.alone
        };
      }

      case "discard": {
        const card = getLowestCard(context.hand, context.trump);
        return {
          type: "discard",
          card
        };
      }

      default:
        throw new Error("Unknown phase: " + context.phase);
    }
  }
}




// import { getEffectiveSuit, getCardPower} from "../engine/cardUtils.js";
// import { sameColorSuit } from "../engine/cardUtils.js";

// // {
// //   hand: [...],
// //   upcard: {...},
// //   dealerIndex: 2,
// //   myIndex: 1,
// //   currentTrick: [...],
// //   leadSuit: "hearts",
// //   trump: "spades",
// //   trickNumber: 3,
// //   score: { team1: 4, team2: 6 }
// // }
// function getRawCardPower(card, trump) {
//   const effectiveSuit = getEffectiveSuit(card, trump);
//   return getCardPower(card, effectiveSuit, trump);
// }
// function getLowestCard(cards, trump) {
//   return cards.reduce((lowest, card) => {
//     if (!lowest) return card;

//     return getRawCardPower(card, trump) <
//            getRawCardPower(lowest, trump)
//       ? card
//       : lowest;
//   }, null);
// }

// function getHighestCard(cards, trump) {
//   return cards.reduce((highest, card) => {
//     if (!highest) return card;

//     return getRawCardPower(card, trump) >
//            getRawCardPower(highest, trump)
//       ? card
//       : highest;
//   }, null);
// }


// export default class SimpleAI extends BaseAI {
  
//   countTrumpStrength(hand, trump) {
//     let count = 0;
//     let hasRight = false;
//     let hasLeft = false;
//     let hasAce = false;

//     for (let card of hand) {
//       if (card.rank === "J" && card.suit === trump) {
//         hasRight = true;
//         count++;
//       } else if (
//         card.rank === "J" &&
//         card.suit === sameColorSuit(trump)
//       ) {
//         hasLeft = true;
//         count++;
//       } else if (card.suit === trump) {
//         count++;
//         if (card.rank === "A") hasAce = true;
//       }
//     }

//     return { count, hasRight, hasLeft, hasAce };
//   }

//   orderUp(context) {
//     const trump = context.upcard.suit;

//     const { count, hasRight, hasLeft, hasAce } =
//       this.countTrumpStrength(context.hand, trump);

//     if (count >= 2) {
//       const goAlone =
//         count >= 4 ||
//         (hasRight && hasLeft && hasAce);

//       return {
//         call: true,
//         alone: goAlone
//       };
//     }

//     return {
//       call: false,
//       alone: false
//     };
//   }

//   callTrump(context) {
//     const suits = ["hearts", "diamonds", "clubs", "spades"];
//     const excluded = context.upcard.suit;

//     let bestSuit = null;
//     let bestStrength = -1;
//     let bestData = null;

//     for (let suit of suits) {
//       if (suit === excluded) continue;

//       const strength = this.countTrumpStrength(
//         context.hand,
//         suit
//       );

//       if (strength.count > bestStrength) {
//         bestStrength = strength.count;
//         bestSuit = suit;
//         bestData = strength;
//       }
//     }

//     if (bestStrength >= 3) {
//       const goAlone =
//         bestData.count >= 4 ||
//         (bestData.hasRight && bestData.hasLeft && bestData.hasAce);

//       return {
//         call: true,
//         suit: bestSuit,
//         alone: goAlone
//       };
//     }

//     return {
//       call: false,
//       suit: null,
//       alone: false
//     };
//   }



//   playCard(context) {
//     const {
//       hand,
//       leadSuit,
//       trump,
//       trickCards,
//       myIndex,
//       trickNumber,
//       alonePlayerIndex
//     } = context;

//     const partnerIndex = (myIndex + 2) % 4;

//     const IAmAlone = alonePlayerIndex === myIndex;

//     // Determine legal cards (must follow suit if possible)
//     let legalCards = hand;

//     if (leadSuit) {
//       const followCards = hand.filter(
//         c => getEffectiveSuit(c, trump) === leadSuit
//       );

//       if (followCards.length > 0) {
//         legalCards = followCards;
//       }
//     }

//     // ====================================
//     // ALONE AGGRESSIVE LOGIC
//     // ====================================
//     if (IAmAlone) {

//       // If leading → pull highest trump
//       if (!leadSuit) {
//         const trumpCards = hand.filter(
//           c => getEffectiveSuit(c, trump) === trump
//         );

//         if (trumpCards.length > 0) {
//           return getHighestCard(trumpCards, trump);
//         }

//         // No trump left → play highest remaining
//         return getHighestCard(hand, trump);
//       }

//       // If following
//       const trumpCards = legalCards.filter(
//         c => getEffectiveSuit(c, trump) === trump
//       );

//       if (trumpCards.length > 0) {
//         return getHighestCard(trumpCards, trump);
//       }

//       return getHighestCard(legalCards, trump);
//     }

//     // ====================================
//     // NORMAL LEADING LOGIC
//     // ====================================
//     if (!leadSuit) {

//       if (trickNumber === 0) {
//         const nonTrumpCards = hand.filter(
//           c => getEffectiveSuit(c, trump) !== trump
//         );

//         if (nonTrumpCards.length > 0) {
//           return getHighestCard(nonTrumpCards, trump);
//         }

//         return getLowestCard(hand, trump);
//       }

//       return getLowestCard(hand, trump);
//     }

//     // ====================================
//     // FOLLOWING LOGIC
//     // ====================================

    
//     let highestPower = -1;
//     let winningPlayerOffset = 0;

//     if (leadSuit && trickCards.length > 0) {
//       trickCards.forEach((card, index) => {
//         const power = getCardPower(card, leadSuit, trump);
//         if (power > highestPower) {
//           highestPower = power;
//           winningPlayerOffset = index;
//         }
//       });
//     }

//     const defendingAgainstAlone =
//       alonePlayerIndex !== null &&
//       alonePlayerIndex !== myIndex;
//     // =============================
//     // FULLY AGGRESSIVE DEFENSE MODE
//     // =============================
//     if (defendingAgainstAlone) {

//       // 1️⃣ Try to win with smallest winning card
//       const winningOptions = legalCards.filter(card =>
//         getCardPower(card, leadSuit, trump) > highestPower
//       );

//       if (winningOptions.length > 0) {
//         return getLowestCard(winningOptions, trump);
//       }

//       // 2️⃣ If void in lead suit and have trump → TRUMP ANYWAY
//       const hasLeadSuit = hand.some(
//         c => getEffectiveSuit(c, trump) === leadSuit
//       );

//       const trumpCards = hand.filter(
//         c => getEffectiveSuit(c, trump) === trump
//       );

//       if (!hasLeadSuit && trumpCards.length > 0) {
//         return getLowestCard(trumpCards, trump);
//       }

//       // 3️⃣ Cannot win and cannot trump → apply pressure
//       return getHighestCard(legalCards, trump);
//     }

//     const trickLeader = context.trickLeader;

//     const winningPlayerIndex =
//       (trickLeader + winningPlayerOffset) % 4;

//     const partnerWinning =
//       winningPlayerIndex === partnerIndex;

//     if (partnerWinning) {
//       return getLowestCard(legalCards, trump);
//     }

//     const winningOptions = legalCards.filter(card =>
//       getCardPower(card, leadSuit, trump) > highestPower
//     );

//     if (winningOptions.length > 0) {
//       return getLowestCard(winningOptions, trump);
//     }

//     return getLowestCard(legalCards, trump);
//   }
  
//   callTrumpForced(context) {
//     const suits = ["hearts", "diamonds", "clubs", "spades"];
//     const excluded = context.upcard.suit;

//     let bestSuit = null;
//     let bestStrength = -1;
//     let bestData = null;

//     for (let suit of suits) {
//       if (suit === excluded) continue;

//       const strength = this.countTrumpStrength(
//         context.hand,
//         suit
//       );

//       if (strength.count > bestStrength) {
//         bestStrength = strength.count;
//         bestSuit = suit;
//         bestData = strength;
//       }
//     }

//     const goAlone =
//       bestData.count >= 4 ||
//       (bestData.hasRight && bestData.hasLeft && bestData.hasAce);

//     return {
//       call: true,
//       suit: bestSuit,
//       alone: goAlone
//     };
//   }

//   getDiscard(context) { 
//     return {
//       type: "discard",
//       card: getLowestCard(context.hand, context.trump)
//     };
//   }