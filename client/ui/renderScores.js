export default function renderScores(scores, teamnames) {

  const scoresDiv = document.getElementById("scores");
  scoresDiv.innerHTML = "";

  const team0 = document.createElement("div");
  team0.className = "score-pill score-team0";
  team0.textContent = `${teamnames[0]}: ${scores.team0}`;

  const team1 = document.createElement("div");
  team1.className = "score-pill score-team1";
  team1.textContent = `${teamnames[1]}: ${scores.team1}`;

  // Highlight leading team
  if (scores.team0 > scores.team1) {
    team0.classList.add("score-leading");
  } else if (scores.team1 > scores.team0) {
    team1.classList.add("score-leading");
  }

  scoresDiv.appendChild(team0);
  scoresDiv.appendChild(team1);
}