class HumanPlayer extends Player {
  async playCard(context) {
    return new Promise(resolve => {
      enableCardSelection(context, resolve);
    });
  }

  async orderUp(context) {
    return await showOrderUpUI(context);
  }

  async callTrump(context) {
    return await showCallSuitUI(context);
  }

  async callTrumpForced(context) {
    return await showCallSuitUI(context, true);
  }
  async discard(context) {
    return new Promise(resolve => {
      enableCardSelection(context, card => {
        resolve({
          type: "discard",
          card
        });
      });
    });
  }
}