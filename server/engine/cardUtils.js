export function sameColorSuit(suit) {
  if (suit === "hearts") return "diamonds";
  if (suit === "diamonds") return "hearts";
  if (suit === "spades") return "clubs";
  if (suit === "clubs") return "spades";
}

export function isRightBower(card, trump) {
  return card.rank === "J" && card.suit === trump;
}

export function isLeftBower(card, trump) {
  return card.rank === "J" && card.suit === sameColorSuit(trump);
}

export function getCardPower(card, leadSuit, trump) {
  if (isRightBower(card, trump)) return 100;
  if (isLeftBower(card, trump)) return 99;

  if (card.suit === trump) {
    return 80 + rankValue(card.rank);
  }

  if (card.suit === leadSuit) {
    return 40 + rankValue(card.rank);
  }

  return 0;
}

export function getEffectiveSuit(card, trump) {
  // Left bower becomes trump suit
  if (
    card.rank === "J" &&
    card.suit === sameColorSuit(trump)
  ) {
    return trump;
  }

  return card.suit;
}

export function rankValue(rank) {
  const values = {
    "A": 6,
    "K": 5,
    "Q": 4,
    "J": 3,
    "10": 2,
    "9": 1,
  };
  return values[rank];
}