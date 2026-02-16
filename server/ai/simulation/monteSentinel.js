const DEBUG_SENTINEL = false;

function cardKey(c) {
  return c.rank + c.suit;
}

function dumpWorld({ hands, playedCards, trickCards }) {

  console.log("\n========== MONTE SENTINEL DUMP ==========");

  console.log("Hands:");
  for (let p = 0; p < 4; p++) {
    const h = hands[p] || [];
    console.log(`Seat ${p}:`, h.map(cardKey));
  }

  console.log("Played:");
  console.log((playedCards || []).map(cardKey));

  console.log("Trick:");
  console.log(
    (trickCards || []).map(
      t => `${t.player}:${cardKey(t.card)}`
    )
  );

  const total =
    [0,1,2,3].reduce((sum,p)=>sum+(hands[p]?.length||0),0) +
    (playedCards?.length || 0) +
    (trickCards?.length || 0);

  console.log("TOTAL CARDS:", total);
  console.log("========================================\n");
}

export function validateWorld({ hands, playedCards, trickCards }) {

  const seen = new Map();
  const refSeen = new Set();

  function checkRef(card, location) {
    if (refSeen.has(card)) {
      if (DEBUG_SENTINEL) dumpWorld({ hands, playedCards, trickCards });
      throw new Error(`CARD OBJECT SHARED at ${location}`);
    }
    refSeen.add(card);
  }

  function add(card, location) {

    if (!card || !card.rank || !card.suit) {
      throw new Error(`INVALID CARD at ${location}`);
    }

    checkRef(card, location);

    const key = cardKey(card);

    if (seen.has(key)) {
      if (DEBUG_SENTINEL) dumpWorld({ hands, playedCards, trickCards });
      throw new Error(
        `CARD DUPLICATE: ${key}\nFirst at: ${seen.get(key)}\nAgain at: ${location}`
      );
    }

    seen.set(key, location);
  }

  // Validate hands
  for (let p = 0; p < 4; p++) {
    const hand = hands[p] || [];

    if (hand.length > 5) {
      throw new Error(`HAND TOO LARGE seat ${p}`);
    }

    hand.forEach(c => add(c, `hand ${p}`));
  }

  // Validate played
  (playedCards || []).forEach(c => add(c, "played"));

  // Validate trick
  if (trickCards && trickCards.length > 4) {
    throw new Error("TRICK TOO LARGE");
  }

  (trickCards || []).forEach(t => add(t.card, `trick player ${t.player}`));

  // Card conservation
  const total =
    [0,1,2,3].reduce((sum,p)=>sum+(hands[p]?.length||0),0) +
    (playedCards?.length || 0) +
    (trickCards?.length || 0);

  if (total !== 20) {
    if (DEBUG_SENTINEL) dumpWorld({ hands, playedCards, trickCards });
    throw new Error(`CARD COUNT WRONG: ${total}`);
  }
}