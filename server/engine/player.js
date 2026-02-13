export default class Player {
  constructor({ id, strategy }) {
    this.id = id;
    this.strategy = strategy;
    this.hand = [];
  }

  setHand(cards) {
    this.hand = cards;
  }

  removeCard(card) {
    this.hand = this.hand.filter(
      c => !(c.suit === card.suit && c.rank === card.rank)
    );
  }

  orderUp(context) {
    return this.strategy.orderUp(context);
  }

  callTrump(context, options) {
    return this.strategy.callTrump(context, options);
  }
  callTrumpForced(context) {
    if (typeof this.strategy.callTrumpForced !== "function") {
      throw new Error(
        `Strategy for Player ${this.id} does not implement callTrumpForced()`
      );
    }

    const suit = this.strategy.callTrumpForced(context);

    if (!suit) {
      throw new Error(
        `Forced trump call must return a suit (Player ${this.id})`
      );
    }

    return suit;
  }

  playCard(context) {
    return this.strategy.playCard(context);
  }
}