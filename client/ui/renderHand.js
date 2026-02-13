export default function renderHand(hand, socket, phase) {

  const bottomSeat = document.getElementById("player-bottom");

  // Ensure .hand container exists
  let handContainer = bottomSeat.querySelector(".hand");

  if (!handContainer) {
    handContainer = document.createElement("div");
    handContainer.className = "hand";
    bottomSeat.appendChild(handContainer);
  }

  // Clear only cards
  handContainer.innerHTML = "";

  hand.forEach(card => {

    const div = document.createElement("div");
    div.className = "card";

    const isRed =
      card.suit === "hearts" ||
      card.suit === "diamonds";

    div.classList.add(isRed ? "red" : "black");

    const suitSymbol = {
      hearts: "♥",
      diamonds: "♦",
      clubs: "♣",
      spades: "♠"
    }[card.suit];

    div.innerHTML = `
      <div class="rank">${card.rank}</div>
      <div class="suit">${suitSymbol}</div>
    `;

    div.onclick = () => {

      if (phase === "discard") {

        hand = hand.filter(c =>
          !(c.rank === card.rank && c.suit === card.suit)
        );

        renderHand(hand, socket, phase);

        socket.emit("player_action", {
          type: "discard",
          card
        });

      } else {

        socket.emit("player_action", {
          type: "play_card",
          card
        });

      }
    };

    handContainer.appendChild(div);
  });
}