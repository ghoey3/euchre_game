import BaseAI from "./baseAI.js";
import {
  getEffectiveSuit,
  getCardPower,
  isRightBower,
  isLeftBower,
  rankValue
} from "../engine/cardUtils.js";

const SUITS = ["hearts","diamonds","clubs","spades"];

function countSuit(hand, suit, trump) {
  return hand.filter(c => getEffectiveSuit(c,trump)===suit).length;
}

function isAce(card) {
  return card.rank === "A";
}

function getLowest(cards, trump) {
  return cards.reduce((a,b)=>{
    if(!a) return b;
    return getCardPower(b,getEffectiveSuit(b,trump),trump)
      < getCardPower(a,getEffectiveSuit(a,trump),trump) ? b : a;
  },null);
}

function getHighest(cards, trump) {
  return cards.reduce((a,b)=>{
    if(!a) return b;
    return getCardPower(b,getEffectiveSuit(b,trump),trump)
      > getCardPower(a,getEffectiveSuit(a,trump),trump) ? b : a;
  },null);
}

export default class SimpleAI extends BaseAI {

  evaluateHand(hand, trump) {

    let score = 0;
    let trumpCount = 0;

    for (const c of hand) {

      if (isRightBower(c,trump)) score += 35;
      else if (isLeftBower(c,trump)) score += 30;
      else if (getEffectiveSuit(c,trump)===trump) score += 18 + rankValue(c.rank);
      else if (c.rank==="A") score += 14;
      else if (c.rank==="K") score += 7;
      else score += 2;

      if (getEffectiveSuit(c,trump)===trump) trumpCount++;
    }

    score += trumpCount * 5;

    // void bonus
    for (const s of SUITS) {
      if (s===trump) continue;
      if (countSuit(hand,s,trump)===0) score += 6;
    }

    return score;
  }

  orderUp(context) {

    const trump = context.upcard.suit;
    let score = this.evaluateHand(context.hand,trump);

    const trumps = context.hand.filter(c=>getEffectiveSuit(c,trump)===trump);

    if (trumps.length>=3) score += 12;
    if (trumps.some(c=>isRightBower(c,trump))) score += 10;

    return {
      call: score>=95,
      alone: score>=125
    };
  }

  callTrump(context) {

    let bestSuit=null;
    let bestScore=-Infinity;

    for(const s of SUITS) {
      if(s===context.upcard.suit) continue;
      const sc=this.evaluateHand(context.hand,s);
      if(sc>bestScore){bestScore=sc;bestSuit=s;}
    }

    return {
      call: bestScore>=95,
      suit: bestSuit,
      alone: bestScore>=125
    };
  }

  callTrumpForced(context) {

    return this.callTrump(context);
  }

  getDiscard(context) {

    const {hand,trump}=context;

    const nonTrump=hand.filter(c=>getEffectiveSuit(c,trump)!==trump);

    // prefer discarding singleton garbage
    for(const c of nonTrump) {
      const s=getEffectiveSuit(c,trump);
      if(countSuit(hand,s,trump)===1 && c.rank!=="A") {
        return {type:"discard",card:c};
      }
    }

    if(nonTrump.length) {
      return {type:"discard",card:getLowest(nonTrump,trump)};
    }

    return {type:"discard",card:getLowest(hand,trump)};
  }

  playCard(context) {

    const {hand,leadSuit,trump,trickCards,myIndex,makerTeam}=context;

    const legal = leadSuit
      ? hand.filter(c=>getEffectiveSuit(c,trump)===leadSuit)
      : hand;

    const cards = legal.length?legal:hand;

    const isMaker = (myIndex%2)===makerTeam;

    if(!leadSuit) {

      // lead ace if short
      for(const c of hand) {
        if(isAce(c) && countSuit(hand,getEffectiveSuit(c,trump),trump)===1) {
          return c;
        }
      }

      // draw trump if maker and long
      const trumps=hand.filter(c=>getEffectiveSuit(c,trump)===trump);
      if(isMaker && trumps.length>=3) return getHighest(trumps,trump);

      return getHighest(cards,trump);
    }

    // following
    let bestOnTable=-1;
    trickCards.forEach(t=>{
      bestOnTable=Math.max(bestOnTable,getCardPower(t.card,leadSuit,trump));
    });

    const winners=cards.filter(c=>getCardPower(c,leadSuit,trump)>bestOnTable);

    if(winners.length) return getLowest(winners,trump);

    return getLowest(cards,trump);
  }

  getAction(context) {

    switch(context.phase) {

      case "play_card":
        return {type:"play_card",card:this.playCard(context)};

      case "order_up":
        return {type:"order_up",...this.orderUp(context)};

      case "call_trump":
        return {type:"call_trump",...this.callTrump(context)};

      case "call_trump_forced":
        return {type:"call_trump_forced",...this.callTrumpForced(context)};

      case "discard":
        return this.getDiscard(context);

      default:
        throw new Error("Unknown phase: "+context.phase);
    }
  }
}