export function renderTrickInfo(context) {

  const infoDiv = document.getElementById("trick-info");
  if (!infoDiv) return;

  infoDiv.innerHTML = "";

  if (!context || !context.trump) return;

  const { trump, makerTeam, tricks, alonePlayerIndex } = context;

  // === Caller Team ===
  if (makerTeam !== undefined) {
    const caller = document.createElement("div");
    caller.className = `trick-pill ${
      makerTeam === 0 ? "trick-caller-0" : "trick-caller-1"
    }`;
    caller.textContent = `Team ${makerTeam} Called`;
    infoDiv.appendChild(caller);
  }

  // === Trick Count ===
  if (tricks) {
    const trickScore = document.createElement("div");
    trickScore.className = "trick-pill trick-highlight";
    trickScore.textContent =
      `Tricks: ${tricks.team0 ?? 0} - ${tricks.team1 ?? 0}`;
    infoDiv.appendChild(trickScore);
  }

  // === Alone Indicator ===
  if (alonePlayerIndex !== null && alonePlayerIndex !== undefined) {
    const alone = document.createElement("div");
    alone.className = "trick-pill";
    alone.textContent = "Going Alone";
    infoDiv.appendChild(alone);
  }
}