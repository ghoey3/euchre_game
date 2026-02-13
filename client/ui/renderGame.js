import  renderHand from "./renderHand.js";
import renderControls  from "./renderControls.js";
import  renderTrick  from "./renderTrick.js";

export default function renderGame(state, mySeatIndex) {
  renderHand(state, mySeatIndex);
  renderControls(state, mySeatIndex);
  renderTrick(state, mySeatIndex);
}