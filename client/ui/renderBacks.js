export default function renderBacks(
  seatId,
  count,
  seatIndex,
  mySeatIndex
) {
  const seat = document.getElementById(seatId);
  if (!seat) return;

  // Ensure .hand exists
  let handContainer = seat.querySelector(".hand");
  if (!handContainer) {
    handContainer = document.createElement("div");
    handContainer.className = "hand";
    seat.appendChild(handContainer);
  }

  // Clear only the cards
  handContainer.innerHTML = "";

  const relative =
    (seatIndex - mySeatIndex + 4) % 4;

  // Left (1) and Right (3) should be vertical stacks
  const isHorizontal =
    (relative === 1 || relative === 3);

  for (let i = 0; i < count; i++) {
    const div = document.createElement("div");
    div.className = "card back";

    if (isHorizontal) {
      div.classList.add("horizontal-back");
    }

    handContainer.appendChild(div);
  }
}