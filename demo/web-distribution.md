# Distribution Analysis — Local Dev Demo

## Start servers

```bash
# Terminal 1 — Express API
npm run server

# Terminal 2 — Vite dev server
cd web && npm run dev
```

## Open the page

```bash
open "http://localhost:5173/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500"
```

## What to verify

- Progress bar starts at 0, updates ~10 times, reaches 100%
- Band chart starts noisy, stabilizes visibly as seeds accumulate — this is the headline moment
- Win rate, ruin rate, median peak all update progressively
- Ruin curve shows CATS's ruin profile over 500 rolls
- Quick (200 seeds): faster, noisier final result
- Deep (1000 seeds): slower, tighter bands
- Switch to ThreePointMolly3X — different band shape, different ruin curve

## Seed presets

| Preset   | Seeds | Notes                         |
|----------|-------|-------------------------------|
| Quick    | 200   | Fast, P50 reliable             |
| Standard | 500   | P10/P90 reliable (default)     |
| Deep     | 1000  | Tightest bands                 |

## Try these URLs

```bash
# CATS default
open "http://localhost:5173/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500"

# ThreePointMolly3X comparison
open "http://localhost:5173/distribution?strategy=ThreePointMolly3X&rolls=500&bankroll=300&seeds=500"

# Quick run
open "http://localhost:5173/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=200"

# Deep run
open "http://localhost:5173/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=1000"
```
