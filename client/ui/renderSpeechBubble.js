export function renderSpeechBubble(playerIndex, mySeatIndex, text) {
  const relative = (playerIndex - mySeatIndex + 4) % 4;

  const seatMap = {
    0: "player-bottom",
    1: "player-left",
    2: "player-top",
    3: "player-right"
  };

  const seat = document.getElementById(seatMap[relative]);
  const layer = document.getElementById("speech-layer");

  if (!seat || !layer) return;

  // Remove existing bubble for this player
  const existing = layer.querySelector(
    `.speech-bubble[data-player="${relative}"]`
  );
  if (existing) existing.remove();

  const bubble = document.createElement("div");
  bubble.className = "speech-bubble";
  bubble.dataset.player = relative;
  bubble.textContent = text;

  layer.appendChild(bubble);

  // Position bubble relative to seat
  const seatRect = seat.getBoundingClientRect();
  const tableRect = layer.getBoundingClientRect();

  const centerX = seatRect.left + seatRect.width / 2 - tableRect.left;
  const centerY = seatRect.top + seatRect.height / 2 - tableRect.top;

  bubble.style.position = "absolute";

  // Position differently depending on seat
  switch (relative) {
    case 0: // bottom
      bubble.style.left = `${centerX}px`;
      bubble.style.top = `${seatRect.top - tableRect.top - 20}px`;
      bubble.style.transform = "translate(-50%, -100%)";
      break;

    case 2: // top
      bubble.style.left = `${centerX}px`;
      bubble.style.top = `${seatRect.bottom - tableRect.top + 20}px`;
      bubble.style.transform = "translate(-50%, 0)";
      break;

    case 1: // left
      bubble.style.left = `${seatRect.right - tableRect.left + 20}px`;
      bubble.style.top = `${centerY}px`;
      bubble.style.transform = "translate(0, -50%)";
      break;

    case 3: // right
      bubble.style.left = `${seatRect.left - tableRect.left - 20}px`;
      bubble.style.top = `${centerY}px`;
      bubble.style.transform = "translate(-100%, -50%)";
      break;
  }

  setTimeout(() => {
    bubble.remove();
  }, 3000);
}