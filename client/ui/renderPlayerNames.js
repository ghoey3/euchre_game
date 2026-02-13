export function renderPlayerNames(players, mySeatIndex) {
  if (!players) return;

  const layer = document.getElementById("player-names-layer");
  if (!layer) return;

  // 🔥 Clear everything
  layer.innerHTML = "";

  players.forEach(player => {
    const relative = (player.seatIndex - mySeatIndex + 4) % 4;

    const teamClass =
      player.seatIndex % 2 === 0
        ? "team-0"
        : "team-1";

    const idMap = {
      0: "name-bottom",
      1: "name-left",
      2: "name-top",
      3: "name-right"
    };

    const id = idMap[relative];

    const nameDiv = document.createElement("div");
    nameDiv.id = id;
    nameDiv.className = `player-name ${teamClass}`;
    nameDiv.textContent = player.name;

    layer.appendChild(nameDiv);
  });
}