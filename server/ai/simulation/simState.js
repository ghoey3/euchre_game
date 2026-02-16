import { cloneHands } from "./simClone.js";

export default class SimState {
  constructor({
    hands,
    trump,
    leader,
    trickCards = [],
    tricksWon = [0, 0],
    voidInfo = {},
    alonePlayerIndex = null
  }) {
    // { 0:[], 1:[], 2:[], 3:[] }
    this.hands = hands;

    this.trump = trump;

    // Player index who leads next card
    this.leader = leader;

    // [{ player, card }]
    this.trickCards = trickCards;

    // [team0Tricks, team1Tricks]
    this.tricksWon = tricksWon;

    // { 0:{hearts:true}, 1:{}, ... }
    this.voidInfo = voidInfo;

    this.alonePlayerIndex = alonePlayerIndex;
  }

  clone() {
    return new SimState({
        hands: cloneHands(this.hands),
        trump: this.trump,
        leader: this.leader,
        trickCards: this.trickCards.map(t => ({ ...t })),
        tricksWon: [...this.tricksWon],
        voidInfo: structuredClone(this.voidInfo),
        alonePlayerIndex: this.alonePlayerIndex
    });
  }

  getTeam(playerIndex) {
    return playerIndex % 2;
  }

  isHandOver() {
    // All players have no cards left
    return Object.values(this.hands).every(
      hand => hand.length === 0
    );
  }
} 