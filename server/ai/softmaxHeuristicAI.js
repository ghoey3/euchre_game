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
  const max = Math.max(...options.map(o => o.score));
  const weights = options.map(o => Math.exp((o.score - max) / temperature));
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

  orderUp(context) {
    const trump = context.upcard.suit;
    const score = this.evaluateHand(context.hand,trump);
    const threshold = 95;

    const decision = softmaxSample([
      { item:true, score: score - threshold },
      { item:false, score: 0 }
    ], this.temperature);

    return {
      call: decision,
      alone: score > 125 && Math.random()<0.7
    };
  }

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

    options.push({ item:null, score:0 });

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

  getLegal(hand, leadSuit, trump) {
    if (!leadSuit) return hand;

    const follow = hand.filter(c=>getEffectiveSuit(c,trump)===leadSuit);
    return follow.length ? follow : hand;
  }

  getPlayerForCard(context, i) {
    return (context.leaderIndex + i) % 4;
  }

  currentWinner(context) {
    const { trickCards, leadSuit, trump } = context;

    if (!trickCards.length) return null;

    const lead = leadSuit ?? getEffectiveSuit(trickCards[0], trump);

    let bestPower = -Infinity;
    let winner = null;

    for (let i = 0; i < trickCards.length; i++) {
      const card = trickCards[i];
      const player = this.getPlayerForCard(context, i);
      const power = getCardPower(card, lead, trump);

      if (power > bestPower) {
        bestPower = power;
        winner = player;
      }
    }

    return winner;
  }

  getPartnerIndex(myIndex, alonePlayerIndex) {
    if (alonePlayerIndex != null) {
      if (alonePlayerIndex === myIndex) return null;
      if ((alonePlayerIndex + 2) % 4 === myIndex) return null;
    }
    return (myIndex + 2) % 4;
  }

  getTrickNumber(context) {

    if (!context.tricksSoFar) return 0;

    const t = context.tricksSoFar;

    if (typeof t.team0 === "number" && typeof t.team1 === "number") {
      return t.team0 + t.team1;
    }

    // fallback if simulator uses array
    if (Array.isArray(t)) {
      return (t[0] || 0) + (t[1] || 0);
    }

    return 0;
  }

  scoreCard(card, context) {
    const { leadSuit, trump, trickCards, myIndex } = context;

    const eff = getEffectiveSuit(card, trump);
    const effectiveLead = leadSuit ?? eff;

    let score = getCardPower(card, effectiveLead, trump);

    const winner = this.currentWinner(context);
    const partnerIndex =
      this.getPartnerIndex(myIndex, context.alonePlayerIndex);

    const partnerWinning = winner === partnerIndex;

    let bestPower = -Infinity;
    for (const c of trickCards) {
      const p = getCardPower(c, effectiveLead, trump);
      if (p > bestPower) bestPower = p;
    }

    const myPower = getCardPower(card, effectiveLead, trump);
    const wouldWin = myPower > bestPower;

    if (partnerWinning && wouldWin) {
      score -= 12;
      if (eff === trump) score -= 8;
    }

    const trickNumber = this.getTrickNumber(context);
    const isTrump = eff === trump;

    if (isTrump) {
      if (trickNumber <= 1) score -= 6;
      if (partnerWinning) score -= 12;
      if (!wouldWin) score -= 5;
      if (trickNumber >= 3) score += 4;
    }

    return score;
  }

  playCard(context) {

    const { hand, leadSuit, trump } = context;

    // Defensive: if no cards, return null (sim should handle)
    if (!hand || hand.length === 0) {
      return null;
    }

    const legal = this.getLegal(hand, leadSuit, trump);

    // If something went wrong, fallback to random card
    const candidates = legal.length ? legal : hand;

    const options = candidates.map(card => ({
      item: card,
      score: this.scoreCard(card, context)
    }));

    // Final guard
    if (options.length === 0) {
      return hand[0];
    }

    return softmaxSample(options, this.temperature);
  }

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



// import BaseAI from "./baseAI.js";
// import {
//   getEffectiveSuit,
//   getCardPower,
//   isRightBower,
//   isLeftBower,
//   rankValue
// } from "../engine/cardUtils.js";

// const SUITS = ["hearts","diamonds","clubs","spades"];

// function softmaxSample(options, temperature) {

//   if (!options || options.length === 0) {
//     return null;
//   }

//   const max = Math.max(...options.map(o => o.score));
//   const weights = options.map(o => Math.exp((o.score - max) / temperature));
//   const total = weights.reduce((a,b)=>a+b,0);

//   if (total <= 0) {
//     return options[0].item;
//   }

//   let r = Math.random()*total;

//   for (let i=0;i<options.length;i++) {
//     r -= weights[i];
//     if (r <= 0) return options[i].item;
//   }

//   return options[options.length-1]?.item ?? options[0].item;
// }

// function countSuit(hand, suit, trump) {
//   return hand.filter(c=>getEffectiveSuit(c,trump)===suit).length;
// }

// export default class SoftmaxHeuristicAI extends BaseAI {

//   constructor({ temperature = 0.35 } = {}) {
//     super("SoftmaxHeuristicAI");
//     this.temperature = temperature;
//   }

//   evaluateHand(hand, trump) {

//     let score = 0;
//     let trumpCount = 0;

//     for (const c of hand) {

//       if (isRightBower(c,trump)) score += 35;
//       else if (isLeftBower(c,trump)) score += 30;
//       else if (getEffectiveSuit(c,trump)===trump) score += 18 + rankValue(c.rank);
//       else if (c.rank==="A") score += 14;
//       else if (c.rank==="K") score += 7;
//       else score += 2;

//       if (getEffectiveSuit(c,trump)===trump) trumpCount++;
//     }

//     score += trumpCount * 5;

//     for (const s of SUITS) {
//       if (s===trump) continue;
//       if (countSuit(hand,s,trump)===0) score += 6;
//     }

//     return score;
//   }

//   orderUp(context) {

//     const trump = context.upcard.suit;
//     const score = this.evaluateHand(context.hand,trump);

//     const threshold = 95;

//     const utilityCall = score - threshold;
//     const utilityPass = 0;

//     const decision = softmaxSample([
//       { item:true, score:utilityCall },
//       { item:false, score:utilityPass }
//     ], this.temperature);

//     return {
//       call: decision,
//       alone: score > 125 && Math.random()<0.7
//     };
//   }

//   callTrump(context) {

//     const options = [];

//     for (const suit of SUITS) {

//       if (suit === context.upcard.suit) continue;

//       const score = this.evaluateHand(context.hand,suit);

//       options.push({
//         item:{ suit, score },
//         score: score - 95
//       });
//     }

//     options.push({ item:null, score:0 });

//     const choice = softmaxSample(options,this.temperature);

//     if (!choice) return { call:false };

//     return {
//       call:true,
//       suit: choice.suit,
//       alone: choice.score > 125 && Math.random()<0.6
//     };
//   }

//   callTrumpForced(context) {

//     let bestSuit=null;
//     let bestScore=-Infinity;

//     for(const s of SUITS) {
//       if(s===context.upcard.suit) continue;
//       const sc=this.evaluateHand(context.hand,s);
//       if(sc>bestScore){bestScore=sc;bestSuit=s;}
//     }

//     return { call:true, suit:bestSuit };
//   }

//   getDiscard(context) {

//     const { hand, trump } = context;

//     const options = hand.map(card => {

//       const eff = getEffectiveSuit(card,trump);

//       let score = 0;

//       if (eff===trump) score -= 10;
//       if (card.rank==="A") score -= 8;

//       score -= getCardPower(card,eff,trump);

//       return { item:card, score };
//     });

//     return {
//       type:"discard",
//       card: softmaxSample(options,this.temperature)
//     };
//   }

//   getLegal(hand, leadSuit, trump) {

//     if (!leadSuit) return hand;

//     const follow = hand.filter(c=>getEffectiveSuit(c,trump)===leadSuit);

//     return follow.length ? follow : hand;
//   }

//   scoreCard(card, context) {

//     const { leadSuit, trump, trickCards } = context;

//     const eff = getEffectiveSuit(card,trump);

//     let score = getCardPower(card,leadSuit||eff,trump);

//     if (!leadSuit && eff===trump) score -= 3;

//     if (leadSuit) {

//       let best=-1;

//       trickCards.forEach(t=>{
//         best=Math.max(best,getCardPower(t.card,leadSuit,trump));
//       });

//       if (getCardPower(card,leadSuit,trump)>best) score += 8;
//     }

//     return score;
//   }

//   playCard(context) {
//     if (!context.hand || context.hand.length === 0) {
//       console.error("EMPTY HAND STATE", context);
//       throw new Error("Simulator called playCard with empty hand");
//     }
//     const { hand, leadSuit, trump } = context;

//     if (!hand || hand.length === 0) {
//       return null;
//     }

//     const legal = this.getLegal(hand, leadSuit, trump);
//     const candidates = legal.length ? legal : hand;

//     if (!candidates.length) {
//       return null;
//     }

//     const options = candidates.map(card => ({
//       item: card,
//       score: this.scoreCard(card, context)
//     }));

//     return softmaxSample(options, this.temperature);
//   }

//   getAction(context) {

//     switch(context.phase) {

//       case "play_card":
//         return { type:"play_card", card:this.playCard(context) };

//       case "order_up":
//         return { type:"order_up", ...this.orderUp(context) };

//       case "call_trump":
//         return { type:"call_trump", ...this.callTrump(context) };

//       case "call_trump_forced":
//         return { type:"call_trump_forced", ...this.callTrumpForced(context) };

//       case "discard":
//         return this.getDiscard(context);

//       default:
//         throw new Error("Unknown phase "+context.phase);
//     }
//   }
// }