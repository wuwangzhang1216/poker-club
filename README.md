# Gemini Poker Club

A polished, browser‑based Texas Hold’em experience with AI opponents powered by Google Gemini. Play against configurable AI players, tune blinds and starting stacks, and enjoy a modern UI with animations, sound effects, and mobile‑friendly layout.

## Features

- AI opponents: configurable count and difficulty (easy/medium/hard)
- Real‑time game flow: blinds, betting rounds, showdown, and chip movement
- Monte Carlo odds: on‑the‑fly win probability and hand‑rank estimation
- Modern UI: responsive layout, smooth animations, chip and card visuals
- Sound design: dealing, betting, folding, shuffling, and win effects
- Quick actions: pot‑fraction bet shortcuts and raise slider with min/max guards

## Tech Stack

- React 19 + TypeScript
- Vite 6 (dev/build tooling)
- Tailwind via CDN (styling)
- Google Gemini via `@google/genai`
- Web Audio API for sound effects

## Quick Start

Prerequisites:
- Node.js 18+ (LTS recommended)
- A Google Gemini API key

Setup:
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` and add your key:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the app at the URL Vite prints (usually http://localhost:5173).

Notes:
- The first user interaction unlocks audio playback (per browser policy).
- If the AI can’t be reached, the game falls back to safe actions.

## Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview the production build locally

## Configuration

- `GEMINI_API_KEY`: required for AI decisions. Vite injects this at build time
  (see `vite.config.ts`). For production, consider proxying requests server‑side
  to avoid exposing keys in client bundles.
- Default model: `gemini-2.5-flash` (see `services/geminiService.ts`). You can
  change the model, temperature, or persona mapping by editing that file.

## Project Structure

```
.
├─ App.tsx                   # Main application and game loop
├─ components/               # UI components (table, players, actions, modals)
├─ services/
│  ├─ pokerLogic.ts         # Poker engine: dealing, betting, evaluation
│  ├─ geminiService.ts      # AI integration with @google/genai
│  └─ audioService.ts       # Web Audio loader/player
├─ types.ts                  # Shared game types and enums
├─ constants.ts              # Card constants and rank values
├─ sounds/                   # Audio assets
├─ index.html                # App shell (Tailwind via CDN)
├─ index.tsx                 # React entrypoint
├─ vite.config.ts            # Vite config (env injection)
└─ server/                   # (Optional) Socket.IO server prototype
```

The `server/` folder contains a Socket.IO/Express prototype for multiplayer
rooms and game orchestration. It is not required for single‑player vs AI.

## Gameplay Tips

- Use the raise slider or quick buttons (1/4, 1/3, 1/2 pot) to size bets.
- Odds display updates during active phases (pre‑flop → river) for the
  human player while they are in the hand.
- AI difficulty influences persona and randomness; “hard” plays more
  unpredictable and aggressive lines.

## Troubleshooting

- AI not acting or errors in console:
  - Verify `GEMINI_API_KEY` is set in `.env.local` and restart dev server.
  - Check network access and model availability in your region.
- No sound:
  - Interact with the page to unlock audio (click/tap). Some browsers block
    autoplay until user gesture.
- High CPU usage:
  - Reduce the Monte Carlo sample size in `services/pokerLogic.ts` (see
    `SIMULATION_COUNT` inside `calculateStats`).

## Deployment

1. Build the app: `npm run build`
2. Serve the contents of `dist/` via any static host (e.g., Vercel, Netlify,
   Cloudflare Pages, Nginx). Ensure environment injection matches your host’s
   process. For production, prefer a server proxy for Gemini.

---

Enjoy the game, and feel free to open issues or share ideas for improvements!
