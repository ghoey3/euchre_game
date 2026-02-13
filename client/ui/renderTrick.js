export default function renderTrick(state, mySeatIndex) {

  const trickArea = document.getElementById("trick-area");

  if (!state.trick || !state.trick.cards) return;

  const existingCards = trickArea.querySelectorAll(".trick-card").length;
  const plays = state.trick.cards;

  // Only render newly added cards
  for (let i = existingCards; i < plays.length; i++) {

    const play = plays[i];
    const card = play.card;

    const div = document.createElement("div");
    div.className = "card trick-card"; // 👈 no-animation class

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

    div.dataset.player = play.player;

    const relative =
      (play.player - mySeatIndex + 4) % 4;

    trickArea.appendChild(div);

    positionTrickCard(div, relative);
  }
}

function positionTrickCard(card, relativeSeat) {

  const trickArea = document.getElementById("trick-area");
  const rect = trickArea.getBoundingClientRect();

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const offset = rect.width * 0.22;

  card.style.position = "absolute";

  let x = 0;
  let y = 0;
  let rotation = 0;

  switch (relativeSeat) {
    case 0: // bottom
      x = 0;
      y = offset;
      rotation = 0;
      break;

    case 1: // left
      x = -offset;
      y = 0;
      rotation = -90;
      break;

    case 2: // top
      x = 0;
      y = -offset;
      rotation = 180;
      break;

    case 3: // right
      x = offset;
      y = 0;
      rotation = 90;
      break;
  }

  card.style.left = `${centerX}px`;
  card.style.top = `${centerY}px`;

  card.style.transform = `
    translate(-50%, -50%)
    translate(${x}px, ${y}px)
    rotate(${rotation}deg)
  `;
}