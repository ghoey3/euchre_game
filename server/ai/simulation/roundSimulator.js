import { determineTrickWinner } from "../engine/trickLogic.js";
import { getEffectiveSuit } from "../engine/cardUtils.js";

export default class RoundSimulator {

  constructor(players) {
    // players = array of AI objects (usually SimpleAI)
    this.players = players;
  }

  simulateToEnd(state) {
    while (!state.isHandOver()) {
      this.playTrick(state);
    }

    return this.calculateEV(state);
  }

  playTrick(state) {
    let leadSuit =
      state.trickCards.length > 0
        ? getEffectiveSuit(
            state.trickCards[0].card,
            state.trump
          )
        : null;

    const partnerIndex =
      state.alonePlayerIndex !== null
        ? (state.alonePlayerIndex + 2) % 4
        : null;

    const playOrder = [];
    for (let i = 0; i < 4; i++) {
      const p = (state.leader + i) % 4;
      if (p === partnerIndex) continue;
      playOrder.push(p);
    }

    for (let playerIndex of playOrder) {

      if (state.trickCards.some(t => t.player === playerIndex))
        continue;

      const context = {
        phase: "play_card",
        hand: state.hands[playerIndex],
        trump: state.trump,
        trickCards: state.trickCards,
        leadSuit,
        trickLeader: state.leader,
        myIndex: playerIndex,
        alonePlayerIndex: state.alonePlayerIndex,
        voidInfo: state.voidInfo
      };

      const action = this.players[playerIndex].getAction(context);
      const card = action.card;

      this.removeCard(state.hands[playerIndex], card);

      if (leadSuit) {
        const eff = getEffectiveSuit(card, state.trump);
        if (eff !== leadSuit) {
          state.voidInfo[playerIndex][leadSuit] = true;
        }
      }

      if (!leadSuit) {
        leadSuit = getEffectiveSuit(card, state.trump);
      }

      state.trickCards.push({ player: playerIndex, card });
    }

    const winnerOffset = determineTrickWinner(
      state.trickCards.map(t => t.card),
      leadSuit,
      state.trump
    );

    const winner =
      state.trickCards[winnerOffset].player;

    state.tricksWon[winner % 2]++;
    state.leader = winner;
    state.trickCards = [];
  }

  removeCard(hand, card) {
    const index = hand.findIndex(
      c => c.rank === card.rank && c.suit === card.suit
    );

    if (index === -1) {
      throw new Error("Simulation card removal failed");
    }

    hand.splice(index, 1);
  }

  calculateEV(state) {
    const makerTeam = state.makerTeam;
    const defending = 1 - makerTeam;

    const makerTricks = state.tricksWon[makerTeam];

    if (makerTricks >= 3) {
      return makerTricks === 5 ? 2 : 1;
    } else {
      return -2;
    }
  }
}