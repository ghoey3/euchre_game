export function renderUpcard(upcard, dealerIndex, mySeatIndex) {
  const layer = document.getElementById("upcard-layer");
  layer.innerHTML = "";
  if (!upcard) return;

  const relative = (dealerIndex - mySeatIndex + 4) % 4;

  const seatMap = {
    0: "player-bottom",
    1: "player-left",
    2: "player-top",
    3: "player-right"
  };

  const dealerSeat = document.getElementById(seatMap[relative]);
  if (!dealerSeat) return;

  const table = document.getElementById("table");
  const tableRect = table.getBoundingClientRect();
  const seatRect = dealerSeat.getBoundingClientRect();

  const card = document.createElement("div");
  card.className = "card upcard";

  const symbol = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠"
  }[upcard.suit];

  const isRed = upcard.suit === "hearts" || upcard.suit === "diamonds";
  card.classList.add(isRed ? "red" : "black");

  card.innerHTML = `
    <div class="rank">${upcard.rank}</div>
    <div class="suit">${symbol}</div>
  `;

  layer.appendChild(card);

  const gap = 25;

  // 🔥 Tune these two independently
  const verticalShift = 55;
  const horizontalShift = 105;

  switch (relative) {

    // Bottom → move upward toward center
    case 0: {
      const centerX =
        seatRect.left - tableRect.left + seatRect.width / 2;

      const centerY =
        seatRect.top - tableRect.top - gap - verticalShift;

      card.style.left = centerX + "px";
      card.style.top = centerY + "px";
      break;
    }

    // Top → move downward toward center
    case 2: {
      const centerX =
        seatRect.left - tableRect.left + seatRect.width / 2;

      const centerY =
        seatRect.bottom - tableRect.top + gap + verticalShift;

      card.style.left = centerX + "px";
      card.style.top = centerY + "px";
      break;
    }

    // Left → move right toward center
    case 1: {
      const centerX =
        seatRect.right - tableRect.left + gap + horizontalShift;

      const centerY =
        seatRect.top - tableRect.top + seatRect.height / 2;

      card.style.left = centerX + "px";
      card.style.top = centerY + "px";

      card.style.transform =
        "translate(-50%, -50%) rotate(90deg) translateY(-8px)";
      break;
    }

    // Right → move left toward center
    case 3: {
      const centerX =
        seatRect.left - tableRect.left - gap - horizontalShift;

      const centerY =
        seatRect.top - tableRect.top + seatRect.height / 2;

      card.style.left = centerX + "px";
      card.style.top = centerY + "px";

      card.style.transform =
        "translate(-50%, -50%) rotate(90deg) translateY(-8px)";
      break;
    }
  }
}

export function clearUpcard() {
  const upcard = document.querySelector(".upcard");

  if (!upcard) return;

  upcard.classList.add("fade-out");

  setTimeout(() => {
    upcard.remove();
  }, 400);
}