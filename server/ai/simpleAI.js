import BaseAI from "./baseAI.js";
import {
  getEffectiveSuit,
  getCardPower,
  isRightBower,
  isLeftBower,
  rankValue
} from "../engine/cardUtils.js";

const SUITS = ["hearts","diamonds","clubs","spades"];

function getLowestCard(cards, trump) {
  return cards.reduce((lowest, card) => {
    if (!lowest) return card;

    const eff = getEffectiveSuit(card, trump);
    const lowEff = getEffectiveSuit(lowest, trump);

    const p1 = getCardPower(card, eff, trump);
    const p2 = getCardPower(lowest, lowEff, trump);

    return p1 < p2 ? card : lowest;
  }, null);
}

function getHighestCard(cards, trump) {
  return cards.reduce((highest, card) => {
    if (!highest) return card;

    const eff = getEffectiveSuit(card, trump);
    const highEff = getEffectiveSuit(highest, trump);

    const p1 = getCardPower(card, eff, trump);
    const p2 = getCardPower(highest, highEff, trump);

    return p1 > p2 ? card : highest;
  }, null);
}

export default class SimpleAI extends BaseAI {

  /* ============================= */
  /* ========= EVALUATION ======== */
  /* ============================= */

  getStrategicValue(card, trump) {
    if (isRightBower(card, trump)) return 30;
    if (isLeftBower(card, trump)) return 26;

    const rank = rankValue(card.rank);

    if (getEffectiveSuit(card, trump) === trump) {
      return 18 + rank;
    }

    if (card.rank === "A") return 12;
    if (card.rank === "K") return 7;
    if (card.rank === "Q") return 5;

    return 2;
  }

  evaluateHand(hand, trump) {
    let score = 0;
    let trumpCount = 0;

    for (let card of hand) {
      score += this.getStrategicValue(card, trump);
      if (getEffectiveSuit(card, trump) === trump) {
        trumpCount++;
      }
    }

    // Trump synergy bonus
    score += trumpCount * 4;

    // Void bonus
    for (let suit of SUITS) {
      if (suit === trump) continue;

      const count = hand.filter(
        c => getEffectiveSuit(c, trump) === suit
      ).length;

      if (count === 0) score += 5;
    }

    return score;
  }

  /* ============================= */
  /* ========= BIDDING =========== */
  /* ============================= */

  orderUp(context) {
    const trump = context.upcard.suit;
    const score = this.evaluateHand(context.hand, trump);

    const myIndex = context.myIndex;
    const dealerIndex = context.dealerIndex;
    const myTeam = myIndex % 2;
    const dealerTeam = dealerIndex % 2;

    const isDealer = myIndex === dealerIndex;
    const partnerIsDealer = myTeam === dealerTeam && !isDealer;
    const opponentIsDealer = myTeam !== dealerTeam;

    /* =============================
      Upcard Strength Adjustment
    ============================= */

    const upcard = context.upcard;
    let upcardBonus = 0;

    if (upcard.rank === "J") {
      // Right bower is huge
      upcardBonus = 15;
    } else if (upcard.rank === "A") {
      upcardBonus = 10;
    } else if (upcard.rank === "K") {
      upcardBonus = 6;
    } else if (upcard.rank === "Q") {
      upcardBonus = 4;
    } else {
      upcardBonus = 0; // 9 / 10 weak
    }

    let adjustedScore = score + upcardBonus;

    /* =============================
      Dealer / Team Adjustments
    ============================= */

    // Partner picking up → we gain full value
    if (partnerIsDealer) {
      adjustedScore += 8;
    }

    // We are dealer → moderate bonus
    if (isDealer) {
      adjustedScore += 5;
    }

    // Opponent dealer → more cautious
    if (opponentIsDealer) {
      adjustedScore -= 8;
    }

    /* =============================
      Decision Thresholds
    ============================= */

    // Strong call
    if (adjustedScore >= 105) {
      return {
        call: true,
        alone: adjustedScore >= 125
      };
    }

    // Medium call
    if (adjustedScore >= 90) {
      return {
        call: true,
        alone: false
      };
    }

    return {
      call: false,
      alone: false
    };
  }
  
  callTrump(context) {
    let bestSuit = null;
    let bestScore = -Infinity;

    for (let suit of SUITS) {
      if (suit === context.upcard.suit) continue;

      const score = this.evaluateHand(context.hand, suit);

      if (score > bestScore) {
        bestScore = score;
        bestSuit = suit;
      }
    }

    if (bestScore >= 100) {
      return { call: true, suit: bestSuit, alone: bestScore >= 120 };
    }

    if (bestScore <= 75) {
      return { call: false, suit: null, alone: false };
    }

    return { call: true, suit: bestSuit, alone: false };
    }

  callTrumpForced(context) {
    let bestSuit = null;
    let bestScore = -Infinity;

    for (let suit of SUITS) {
      if (suit === context.upcard.suit) continue;

      const score = this.evaluateHand(context.hand, suit);

      if (score > bestScore) {
        bestScore = score;
        bestSuit = suit;
      }
    }

    return {
      call: true,
      suit: bestSuit,
      alone: bestScore >= 120
    };
  }

  /* ============================= */
  /* ========= DISCARD =========== */
  /* ============================= */

  getDiscard(context) {
    const hand = context.hand;
    const trump = context.trump;

    const nonTrump = hand.filter(
      c => getEffectiveSuit(c, trump) !== trump
    );

    if (nonTrump.length > 0) {
      return {
        type: "discard",
        card: getLowestCard(nonTrump, trump)
      };
    }

    return {
      type: "discard",
      card: getLowestCard(hand, trump)
    };
  }

  /* ============================= */
  /* ========= CARD PLAY ========= */
  /* ============================= */

  playCard(context) {
    const {
      hand,
      leadSuit,
      trump,
      trickCards,
      myIndex,
      alonePlayerIndex
    } = context;

    const partnerIndex = (myIndex + 2) % 4;
    const IAmAlone = alonePlayerIndex === myIndex;

    let legalCards = hand;

    if (leadSuit) {
      const follow = hand.filter(
        c => getEffectiveSuit(c, trump) === leadSuit
      );
      if (follow.length > 0) legalCards = follow;
    }

    /* -------- LEADING -------- */

    if (!leadSuit) {

      const trumpCards = hand.filter(
        c => getEffectiveSuit(c, trump) === trump
      );

      const nonTrump = hand.filter(
        c => getEffectiveSuit(c, trump) !== trump
      );

      if (IAmAlone && trumpCards.length > 0) {
        return getHighestCard(trumpCards, trump);
      }

      if (trumpCards.length >= 3) {
        return getHighestCard(trumpCards, trump);
      }

      if (nonTrump.length > 0) {
        const suitCounts = {};
        for (let card of nonTrump) {
          const s = getEffectiveSuit(card, trump);
          suitCounts[s] = (suitCounts[s] || 0) + 1;
        }

        const bestSuit = Object.keys(suitCounts)
          .sort((a,b) => suitCounts[b] - suitCounts[a])[0];

        const suitCards = nonTrump.filter(
          c => getEffectiveSuit(c, trump) === bestSuit
        );

        return getHighestCard(suitCards, trump);
      }

      return getLowestCard(hand, trump);
    }

    /* -------- FOLLOWING -------- */

    let highestPower = -1;
    let winningOffset = 0;

    trickCards.forEach((t, i) => {
      const p = getCardPower(t.card, leadSuit, trump);
      if (p > highestPower) {
        highestPower = p;
        winningOffset = i;
      }
    });

    const trickLeader = context.trickLeader;
    const winningPlayer =
      (trickLeader + winningOffset) % 4;

    const partnerWinning = winningPlayer === partnerIndex;

    // If partner winning → dump lowest
    if (!IAmAlone && partnerWinning) {
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