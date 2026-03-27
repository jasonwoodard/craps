# Strategy Comparison — Local Dev Demo

## Start servers

```bash
# Terminal 1 — Express API
npm run server

# Terminal 2 — Vite dev server
cd web && npm run dev
```

## Open the page

```bash
open "http://localhost:5173/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7"
```

## What to verify

- Two bankroll lines on identical dice — divergence is visible
- Dice verification shows ✓ with matching roll values for first 5 rolls
- Net delta shown above side-by-side summary panels
- CATS stage breakdown appears alongside ThreePointMolly3X flat session
- Seed written to URL after a random run — copy URL, open new tab, identical output

## Try these URLs

```bash
# Seed 7 — default demo
open "http://localhost:5173/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7"

# Seed 42 — both strategies grind a bad session, CATS Accumulator structure visible
open "http://localhost:5173/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=42"

# Random run — seed written to URL after completion
open "http://localhost:5173/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300"

# Compare two flat strategies
open "http://localhost:5173/compare?strategies=PassLineOnly,ThreePointMolly3X&rolls=500&bankroll=300&seed=7"
```

## Sidebar behavior

- Strategy A (blue) and Strategy B (orange) selectors appear on the Compare page
- Changing Strategy A/B and clicking Run re-runs the comparison on a new seed
- Enter a specific seed to pin dice and isolate strategy differences
- Clear the seed field for a fresh random comparison
