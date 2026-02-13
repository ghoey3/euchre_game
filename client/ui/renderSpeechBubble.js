export function renderSpeechBubble(playerIndex, mySeatIndex, text) {

  const relative = (playerIndex - mySeatIndex + 4) % 4;

  const seatMap = {
    0: "player-bottom",
    1: "player-left",
    2: "player-top",
    3: "player-right"
  };

  const seat = document.getElementById(seatMap[relative]);
  if (!seat) return;

  // Remove existing bubble in that seat only
  const oldBubble = seat.querySelector(":scope > .speech-bubble");
  if (oldBubble) oldBubble.remove();

  const bubble = document.createElement("div");
  bubble.className = "speech-bubble";
  bubble.textContent = text;

  seat.appendChild(bubble);

  setTimeout(() => {
    if (bubble.parentElement) {
      bubble.remove();
    }
  }, 3000);
}