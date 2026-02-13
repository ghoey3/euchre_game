export function updateSeatMarkers({ dealerIndex, leaderIndex, mySeatIndex }) {
  clearSeatMarkers();

  const seatMap = {
    0: "player-bottom",
    1: "player-left",
    2: "player-top",
    3: "player-right"
  };

  const roles = [
    { index: dealerIndex, type: "dealer" },
    { index: leaderIndex, type: "leader" }
  ];

  roles.forEach(({ index, type }) => {
    if (index == null) return;

    const relative = (index - mySeatIndex + 4) % 4;
    const seat = document.getElementById(seatMap[relative]);
    if (!seat) return;

    let markerContainer = seat.querySelector(".seat-markers");

    if (!markerContainer) {
      markerContainer = document.createElement("div");
      markerContainer.className = "seat-markers";
      seat.prepend(markerContainer);
    }

    const marker = document.createElement("div");
    marker.classList.add("seat-marker");

    if (type === "dealer") {
      marker.classList.add("marker-dealer");
      marker.textContent = "D";
    } else {
      marker.classList.add("marker-leader");
      marker.textContent = "L";
    }

    markerContainer.appendChild(marker);
  });
}