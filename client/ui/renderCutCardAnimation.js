export function renderCutCardAnimation(seatIndex, mySeatIndex, cardData) {
  const layer = document.getElementById("upcard-layer");
  layer.innerHTML = "";
  if (seatIndex == null || !cardData) return;

  const table = document.getElementById("table");
  const tableRect = table.getBoundingClientRect();

  // === Create outer card ===
  const card = document.createElement("div");
  card.className = "cut-card";
  card.style.left = tableRect.width / 2 + "px";
  card.style.top = tableRect.height / 2 + "px";
  card.style.transform = "translate(-50%, -50%)";

  // === Build flip structure immediately ===
  const inner = document.createElement("div");
  inner.className = "cut-inner";

  const front = document.createElement("div");
  front.className = "cut-front card";

  const symbol = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠"
  }[cardData.suit];

  const isRed =
    cardData.suit === "hearts" ||
    cardData.suit === "diamonds";

  front.classList.add(isRed ? "red" : "black");

  front.innerHTML = `
    <div class="rank">${cardData.rank}</div>
    <div class="suit">${symbol}</div>
  `;

  const back = document.createElement("div");
  back.className = "cut-back card back";

  inner.appendChild(front);
  inner.appendChild(back);
  card.appendChild(inner);
  layer.appendChild(card);

  // === Compute final position using shared function ===
  const { left, top, transform } =
    getDealerUpcardPosition(seatIndex, mySeatIndex);

  // === Slide to seat ===
  requestAnimationFrame(() => {
    card.style.left = left + "px";
    card.style.top = top + "px";
    card.style.transform = transform;
  });

  // === Flip after slide completes ===
  setTimeout(() => {
    card.classList.add("cut-flip");

    if (cardData.rank === "J") {
      card.classList.add("cut-jack");
    }
  }, 600);
}

function getDealerUpcardPosition(dealerIndex, mySeatIndex) {
  const relative = (dealerIndex - mySeatIndex + 4) % 4;

  const seatMap = {
    0: "player-bottom",
    1: "player-left",
    2: "player-top",
    3: "player-right"
  };

  const dealerSeat = document.getElementById(seatMap[relative]);
  const table = document.getElementById("table");

  const tableRect = table.getBoundingClientRect();
  const seatRect = dealerSeat.getBoundingClientRect();

  const gap = 25;
  const verticalShift = 75;
  const horizontalShift = 155;

  let left, top, transform = "translate(-50%, -50%)";

  switch (relative) {
    case 0:
      left = seatRect.left - tableRect.left + seatRect.width / 2;
      top  = seatRect.top - tableRect.top - gap - verticalShift;
      break;

    case 2:
      left = seatRect.left - tableRect.left + seatRect.width / 2;
      top  = seatRect.bottom - tableRect.top + gap + verticalShift;
      break;

    case 1:
      left = seatRect.right - tableRect.left + gap + horizontalShift;
      top  = seatRect.top - tableRect.top + seatRect.height / 2;
      transform += " rotate(90deg)";
      break;

    case 3:
      left = seatRect.left - tableRect.left - gap - horizontalShift;
      top  = seatRect.top - tableRect.top + seatRect.height / 2;
      transform += " rotate(90deg)";
      break;
  }

  return { left, top, transform };
}