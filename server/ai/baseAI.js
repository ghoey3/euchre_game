export default class BaseAI {
  constructor(name) {
    this.name = name;
  }

  // First round of bidding
  orderUp(context) {
    throw new Error("orderUp not implemented");
  }

  // Second round of bidding
  callTrump(context) {
    throw new Error("callTrump not implemented");
  }

  callTrumpForced(context) {
    throw new Error("forceCallTrump not implemented");
  }
  // Must choose a legal card
  playCard(context) {
    throw new Error("playCard not implemented");
  }

  getDiscard(context) {
    throw new Error("getDiscard not implemented");
  }
  
  getAction(context) {
    throw new Error("getAction not implemented");
  }
}