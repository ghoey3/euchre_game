const suits = ["hearts", "diamonds", "clubs", "spades"];
const ranks = ["9", "10", "J", "Q", "K", "A"];

export function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffle(deck) {
  return deck.sort(() => Math.random() - 0.5);
}