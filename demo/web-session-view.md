# Web Session View — Local Dev Instructions

## Running the app locally

```bash
# Terminal 1 — Express API server
npm run server

# Terminal 2 — Vite dev server
cd web && npm run dev

# Browser
open http://localhost:5173
```

## What to verify

- Summary panel shows all stats; net change is red (-$294)
- Chart shows bankroll declining from $300 to near $0 over 500 rolls
- Buy-in reference line ($300) is visible as a dashed horizontal
- 7-out markers cluster visibly on the X axis
- Table load area shows brief jumps when Molly stages are entered before collapsing back
- No stage banding or `stageName` references anywhere in the rendered UI

## Self-verification

Final bankroll shown in browser should match CLI output: **$300 → $6** (seed 42).

```bash
# CLI confirmation
npx ts-node src/cli/run-sim.ts --strategy CATS --rolls 500 --bankroll 300 --seed 42 --output summary
```

Expected: `Bankroll: $300 → $6 (net: $-294)`
