# M2 Demo — Stage Deep Dive

Verify the full M2 dashboard using seed 7 (reaches multiple stages, revisits them repeatedly).

## Start both processes

```bash
# Terminal 1
npm run server

# Terminal 2
cd web && npm run dev

# Browser
open http://localhost:5173
```

App.tsx hardcoded params: `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 7 }`

---

## Scroll top to bottom and verify

**Section 1 — Timeline (SessionChart)**
- Stage color bands visible behind bankroll and table load lines
- All M1 event markers still visible on top of bands (red 7-out lines, green point-made lines)
- Buy-in reference line ($300) still visible as dashed horizontal
- No vertical stage transition markers

**Section 2 — Stage breakdown table (StageBreakdown)**
- Rows numbered sequentially (#1, #2, #3…)
- Roll Range column shows timeline position (e.g. `1–43`)
- Little Molly visits are mostly 1–2 rolls
- Net P&L column color-coded green/red

**Section 3 — Stage overlay (StageOverlayChart)**
- One chart per distinct stage visited
- Accumulator Regressed chart shows 10+ visit lines overlaid from T0
- Y axis reads ±$ (relative from stage entry, not absolute bankroll)
- Tight cluster = consistent behavior; wide fan = high variance
- Each visit labeled: "Visit 1: Rolls 1–43", "Visit 2: Rolls 67–89", etc.

**Section 4 — Trend indicators (TrendPanel)**
- 24-Roll Rolling P&L: shows positive momentum in early rolls, declining later
- CATS Threshold Proximity: session approaching but not sustaining +$70 step-up
- Consecutive 7-Outs: spikes with y=2 reference line visible; spikes correspond to step-downs in Section 2 table

---

## Cross-check: seed 42

Change `HARDCODED_PARAMS` in `web/src/App.tsx` to `seed: 42` and reload.

All sections must render without error:
- SessionChart: bankroll declines from $300 to near $0, no stage bands (seed 42 never escapes Accumulator Full — verify this is correct or that bands appear for accumulatorFull)
- StageBreakdown: renders (or renders nothing if no stage transitions)
- StageOverlayChart: fewer overlay lines, or single-visit charts — no crashes
- TrendPanel: flat trend signals, threshold proximity shows session never approaching step-up — no crashes
