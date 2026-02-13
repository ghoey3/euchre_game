export default function renderTrump(trump) {

  const div = document.getElementById("trump-indicator");

  if (!trump) {
    div.innerHTML = "";
    return;
  }
  
  const symbol = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠"
  }[trump];

  const isRed = trump === "hearts" || trump === "diamonds";

  div.innerHTML = `
    <span style="color:${isRed ? "#c40000" : "white"}">
      Trump: ${symbol}
    </span>
  `;
}