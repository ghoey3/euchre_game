export function highlightDealer(dealerIndex, mySeatIndex) {

  document.querySelectorAll(".seat")
    .forEach(s => s.classList.remove("dealer-seat"));

  const relative = (dealerIndex - mySeatIndex + 4) % 4;

  const seatMap = {
    0: "player-bottom",
    1: "player-left",
    2: "player-top",
    3: "player-right"
  };

  const seat = document.getElementById(seatMap[relative]);
  if (seat) seat.classList.add("dealer-seat");
}

export function highlightLeader(leaderIndex, mySeatIndex) {

  clearLeaderHighlight();

  const relative = (leaderIndex - mySeatIndex + 4) % 4;

  const seatMap = {
    0: "player-bottom",
    1: "player-left",
    2: "player-top",
    3: "player-right"
  };

  const seat = document.getElementById(seatMap[relative]);

  if (seat) {
    seat.classList.add("leader-seat");
  }
}

export function clearLeaderHighlight() {
  document.querySelectorAll(".seat").forEach(seat =>
    seat.classList.remove("leader-seat")
  );
}

export function renderAloneIndicator(aloneIndex, mySeatIndex) {
  // Clear previous states
  document.querySelectorAll(".hand").forEach(hand => {
    hand.classList.remove("alone-hand");
    hand.classList.remove("partner-faded");
  });

  if (aloneIndex === null || aloneIndex === undefined) return;

  const aloneRelative = (aloneIndex - mySeatIndex + 4) % 4;
  const partnerIndex = (aloneIndex + 2) % 4;
  const partnerRelative = (partnerIndex - mySeatIndex + 4) % 4;

  const seatMap = {
    0: "player-bottom",
    1: "player-left",
    2: "player-top",
    3: "player-right"
  };

  // Alone hand
  const aloneSeat = document.getElementById(seatMap[aloneRelative]);
  const aloneHand = aloneSeat?.querySelector(".hand");
  if (aloneHand) aloneHand.classList.add("alone-hand");

  // Partner hand
  const partnerSeat = document.getElementById(seatMap[partnerRelative]);
  const partnerHand = partnerSeat?.querySelector(".hand");
  if (partnerHand) partnerHand.classList.add("partner-faded");
}

export function highlightActivePlayer(playerIndex, mySeatIndex) {

  document.querySelectorAll(".hand").forEach(hand =>
    hand.classList.remove("active-hand")
  );

  if (playerIndex === null || playerIndex === undefined) return;

  const relative = (playerIndex - mySeatIndex + 4) % 4;

  const seatMap = {
    0: "player-bottom",
    1: "player-left",
    2: "player-top",
    3: "player-right"
  };

  const seat = document.getElementById(seatMap[relative]);
  const hand = seat?.querySelector(".hand");

  if (!hand) return;

  hand.classList.add("active-hand");
}

export function clearActiveHighlight() {
  document.querySelectorAll(".hand").forEach(hand =>
    hand.classList.remove("active-hand")
  );
}
