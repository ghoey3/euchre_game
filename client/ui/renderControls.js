let goAloneState = false;

export default function renderControls(context, socket) {

  const controlsDiv = document.getElementById("controls");
  if (!controlsDiv) return;

  // Reset state if leaving bidding phases
  if (context.phase !== "order_up" && context.phase !== "call_trump") {
    goAloneState = false;
  }

  controlsDiv.innerHTML = "";
  controlsDiv.classList.add("active");

  function createAloneToggle() {
    const aloneBtn = document.createElement("button");
    aloneBtn.className = "control-btn alone-toggle";
    aloneBtn.textContent = "Go Alone";

    if (goAloneState) {
      aloneBtn.classList.add("active");
    }

    aloneBtn.onclick = () => {
      goAloneState = !goAloneState;
      aloneBtn.classList.toggle("active", goAloneState);
    };

    controlsDiv.appendChild(aloneBtn);
  }

  /* =========================
     ORDER UP
  ========================= */
  if (context.phase === "order_up") {

    createAloneToggle();

    const orderBtn = document.createElement("button");
    orderBtn.className = "control-btn primary";
    orderBtn.textContent = "Order Up";
    orderBtn.onclick = () => {
      socket.emit("player_action", {
        type: "order_up",
        call: true,
        alone: goAloneState
      });
    };

    const passBtn = document.createElement("button");
    passBtn.className = "control-btn pass";
    passBtn.textContent = "Pass";
    passBtn.onclick = () => {
      socket.emit("player_action", {
        type: "order_up",
        call: false
      });
    };

    controlsDiv.appendChild(orderBtn);
    controlsDiv.appendChild(passBtn);
  }

  /* =========================
     CALL TRUMP (Round 2)
  ========================= */
  if (context.phase === "call_trump") {

    createAloneToggle();
    
    const excludedSuit = context.upcard?.suit;
    console.log("Excluded suit:", excludedSuit);
    ["hearts","diamonds","clubs","spades"]
      .filter(suit => suit !== excludedSuit)
      .forEach(suit => {

        const btn = document.createElement("button");
        btn.className = "control-btn suit primary";

        const symbols = {
          hearts: "♥",
          diamonds: "♦",
          clubs: "♣",
          spades: "♠"
        };

        btn.textContent = symbols[suit];

        btn.onclick = () => {
          socket.emit("player_action", {
            type: "call_trump",
            call: true,
            suit,
            alone: goAloneState
          });
        };

        controlsDiv.appendChild(btn);
      });

    const passBtn = document.createElement("button");
    passBtn.className = "control-btn pass";
    passBtn.textContent = "Pass";
    passBtn.onclick = () => {
      socket.emit("player_action", {
        type: "call_trump",
        call: false
      });
    };

    controlsDiv.appendChild(passBtn);
  }
}