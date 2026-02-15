# Euchre Browser Game

A browser-based Euchre game built with vanilla JavaScript and Socket.IO. The project includes a custom game engine, real-time multiplayer support, a lobby system, and AI opponents. It is designed as a lightweight implementation focused on gameplay and experimentation with different AI strategies.

## Overview

This project allows players to create or join a game lobby and play Euchre in real time. Games can be played with friends or with computer-controlled players. The server manages the game state and enforces the rules, while the client handles rendering and user interaction in the browser.

The codebase is organized to separate the game engine, networking logic, AI players, and UI rendering so that each part can be developed and tested independently.

## Features

- Real-time multiplayer using WebSockets
- Lobby system with join codes
- Play with friends or add AI players
- Two AI strategies:
  - Rule-based heuristic AI
  - Monte Carlo simulation AI
- Custom Euchre game engine implementing dealing, trump selection, trick play, and scoring
- Lightweight browser UI with basic animations
- Test utilities for starting games quickly

## Project Structure

```
euchre_game/
├── client/
│   ├── ui/            Rendering modules
│   ├── index.html
│   ├── main.js
│   └── styles.css
│
├── server/
│   ├── engine/        Core game logic
│   ├── ai/            AI players and simulations
│   └── server code
│
├── test/              Utilities for testing and simulations
└── package.json
```

## Running the Project

### Install dependencies

```
npm install
```

### Start the server

```
npm start
```

Open the client in your browser, create or join a lobby, add players or AI, and start a game.

## How It Works

The server runs the game engine and keeps the authoritative state of each match. Clients connect through Socket.IO to receive updates and send player actions. The UI renders the current state of the table, including hands, tricks, scores, and player information.

AI players run on the server and make decisions based on either simple heuristics or simulated outcomes.

## Limitations

- No reconnect handling if a player disconnects
- Limited animations and visual polish
- Not currently deployed
- Basic error handling

## Future Improvements

- Reconnect support
- Improved UI and animations
- Deployment and hosting
- Additional game settings
- Better mobile support

## Notes

This project is intended as a functional implementation of Euchre with room for experimentation and further development.