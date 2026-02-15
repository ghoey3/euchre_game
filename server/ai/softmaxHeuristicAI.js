import BaseAI from "./baseAI.js";
import {
  getEffectiveSuit,
  getCardPower,
  isRightBower,
  isLeftBower,
  rankValue
} from "../engine/cardUtils.js";

const SUITS = ["hearts","diamonds","clubs","spades"];

function softmaxSample(options, temperature) {

  const weights = options.map(o => Math.exp(o.score / temperature));
  const total = weights.reduce((a,b)=>a+b,0);

  let r = Math.random()*total;

  for (let i=0;i<options.length;i++) {
    r -= weights[i];
    if (r <= 0) return options[i].item;
  }

  return options[options.length-1].item;
}

function countSuit(hand, suit, trump) {
  return hand.filter(c=>getEffectiveSuit(c,trump)===suit).length;
}

export default class SoftmaxHeuristicAI extends BaseAI {

  constructor({ temperature = 0.35 } = {}) {
    super("SoftmaxHeuristicAI");
    this.temperature = temperature;
  }

  /* ================= EVALUATION ================= */

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

    for (const s of SUITS) {
      if (s===trump) continue;
      if (countSuit(hand,s,trump)===0) score += 6;
    }

    return score;
  }

  /* ================= ORDER UP ================= */

  orderUp(context) {

    const trump = context.upcard.suit;
    const score = this.evaluateHand(context.hand,trump);

    const threshold = 95;

    const utilityCall = score - threshold;
    const utilityPass = 0;

    const decision = softmaxSample([
      { item:true, score:utilityCall },
      { item:false, score:utilityPass }
    ], this.temperature);

    return {
      call: decision,
      alone: score > 125 && Math.random()<0.7
    };
  }

  /* ================= CALL TRUMP ================= */

  callTrump(context) {

    const options = [];

    for (const suit of SUITS) {

      if (suit === context.upcard.suit) continue;

      const score = this.evaluateHand(context.hand,suit);

      options.push({
        item:{ suit, score },
        score: score - 95
      });
    }

    options.push({ item:null, score:0 }); // pass

    const choice = softmaxSample(options,this.temperature);

    if (!choice) return { call:false };

    return {
      call:true,
      suit: choice.suit,
      alone: choice.score > 125 && Math.random()<0.6
    };
  }

  callTrumpForced(context) {

    let bestSuit=null;
    let bestScore=-Infinity;

    for(const s of SUITS) {
      if(s===context.upcard.suit) continue;
      const sc=this.evaluateHand(context.hand,s);
      if(sc>bestScore){bestScore=sc;bestSuit=s;}
    }

    return { call:true, suit:bestSuit };
  }

  /* ================= DISCARD ================= */

  getDiscard(context) {

    const { hand, trump } = context;

    const options = hand.map(card => {

      const eff = getEffectiveSuit(card,trump);

      let score = 0;

      if (eff===trump) score -= 10;
      if (card.rank==="A") score -= 8;

      score -= getCardPower(card,eff,trump);

      return { item:card, score };
    });

    return {
      type:"discard",
      card: softmaxSample(options,this.temperature)
    };
  }

  /* ================= PLAY ================= */

  getLegal(hand, leadSuit, trump) {

    if (!leadSuit) return hand;

    const follow = hand.filter(c=>getEffectiveSuit(c,trump)===leadSuit);

    return follow.length ? follow : hand;
  }

  scoreCard(card, context) {

    const { leadSuit, trump, trickCards } = context;

    const eff = getEffectiveSuit(card,trump);

    let score = getCardPower(card,leadSuit||eff,trump);

    if (!leadSuit && eff===trump) score -= 3;

    if (leadSuit) {

      let best=-1;

      trickCards.forEach(t=>{
        best=Math.max(best,getCardPower(t.card,leadSuit,trump));
      });

      if (getCardPower(card,leadSuit,trump)>best) score += 8;
    }

    return score;
  }

  playCard(context) {

    const { hand, leadSuit, trump } = context;

    const legal = this.getLegal(hand,leadSuit,trump);

    const options = legal.map(card=>({
      item:card,
      score:this.scoreCard(card,context)
    }));

    return softmaxSample(options,this.temperature);
  }

  /* ================= ROUTER ================= */

  getAction(context) {

    switch(context.phase) {

      case "play_card":
        return { type:"play_card", card:this.playCard(context) };

      case "order_up":
        return { type:"order_up", ...this.orderUp(context) };

      case "call_trump":
        return { type:"call_trump", ...this.callTrump(context) };

      case "call_trump_forced":
        return { type:"call_trump_forced", ...this.callTrumpForced(context) };

      case "discard":
        return this.getDiscard(context);

      default:
        throw new Error("Unknown phase "+context.phase);
    }
  }
}