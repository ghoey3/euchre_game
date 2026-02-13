import { getCardPower } from "./cardUtils.js";

export function determineTrickWinner(trickCards, leadSuit, trump) {
  let highest = -1;
  let winnerIndex = 0;

  trickCards.forEach((card, index) => {
    const power = getCardPower(card, leadSuit, trump);
    if (power > highest) {
      highest = power;
      winnerIndex = index;
    }
  });

  return winnerIndex;
}