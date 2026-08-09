# CATS Stage 1→2 Gate — Threshold Sensitivity

Sensitivity sweep of the Stage 1 → Stage 2 (Little Molly) profit gate,
holding all higher ladder gates proportional (`CATS({ stage2Gate })` scales
$150/$200/$250/$400 by `gate/70`, rounded to the dollar; the §3.4 hard-reset
floor stays at $20). Produced by `src/cli/sweep-thresholds.ts`:

```
npx ts-node src/cli/sweep-thresholds.ts --gates 40,55,70,85,100 \
    --rolls 1000 --bankroll 300 --seeds 2000
```

2,000 sessions per gate value, $10 table, $300 buy-in, sessions capped at
1,000 rolls and ended at ruin. Seeds 0–1999 are shared across gate values, so
each column difference reflects the gate, not the dice. **This is input to a
design decision, not a change** — the strategy's thresholds remain as
documented in `strategy/cats-strategy.md` (+$70 baseline, bold row).

| Stage 1→2 gate | Stage-2 reach | Median rolls → Stage 2 | P&L p10 | P&L p50 | P&L p90 | Sessions positive | Ruin rate |
|---|---|---|---|---|---|---|---|
| +$40 | 80.8% | 36 | −$297 | −$291 | +$38 | 12.8% | 61.5% |
| +$55 | 76.8% | 56 | −$297 | −$290 | +$59 | 14.9% | 59.1% |
| **+$70** | **72.2%** | **81** | **−$297** | **−$289** | **+$90** | **17.9%** | **53.8%** |
| +$85 | 68.8% | 103 | −$297 | −$289 | +$109 | 20.9% | 52.8% |
| +$100 | 63.9% | 130 | −$297 | −$289 | +$119 | 22.6% | 51.4% |

## Summary

The trade-off is monotone across the swept range: every $15 added to the gate
costs roughly 4 percentage points of Stage-2 reach and ~25 median rolls of
additional Accumulator grind, and buys roughly 2–3 points of win rate, 2–4
points less ruin, and a fatter right tail (p90 from +$38 at the $40 gate to
+$119 at $100). The mechanism is capitalization at escalation: a low gate
promotes thin cushions into Molly-sized loads that a single bad hand can
erase, while a high gate means the sessions that do climb are funded well
enough to survive the variance they are buying. The left side of the
distribution is insensitive to the gate — p10 and p50 are pinned near full
buy-in loss by the sessions that never escape the Accumulator's negative
drift over this long horizon, whatever the gate. In short, the gate is not a
knob on expected value; it trades participation (how often a session gets to
play the Alpha stages, and how soon) against the quality of outcomes once
there.
