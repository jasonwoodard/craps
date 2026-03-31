# Craps Simulator — Web UI Implementation Plan

**Date:** March 2026  
**Status:** Draft v1.7  
**Scope:** Visualization layer — engine changes are minimal and surgical (M0 only)

> **Completed milestones** (M0, M1, M2, M3) are documented in `docs/web-ui-completed-milestones.md`.

---

## Purpose

Add a web UI to the craps simulator that transforms structured simulation output into an analytical dashboard. The UI makes the mathematical behavior of craps strategies visible and internalize-able — the kind of insight a player would want before standing at a table.

This document follows the same milestone structure as `docs/implementation-plan.md`. Each milestone ends with a working, demonstrable result.

---

## Guiding Principles

**Minimal engine surface.** M0 made two surgical changes to `src/`. Everything else in `src/` is untouched forever.

**The CLI stays.** `src/cli/run-sim.ts` continues to work independently. The Express server is a separate entry point.

**Reuse existing types.** `RollRecord`, `EngineResult`, and `SharedTableResult` are the API contract. No translation layer.

**UI code can become a hot tangled mess.** Each milestone that introduces new UI complexity begins with an assessment task before any implementation. This is a first-class deliverable, not overhead.

**The user manual is the UX north star.** `docs/craps-simulator-user-manual.md` describes the intended user experience. Implementation decisions should be consistent with the mental model it describes.

---

## Page Map

| Page | URL | Question | Status |
|---|---|---|---|
| Session | `/session` | What happened in this run? | Done (M3), enhanced (M3.5) |
| Session Compare | `/session-compare` | Which strategy played these dice better? | M5a |
| Distribution | `/distribution` | What typically happens with this strategy? | Done (M4) |
| Distribution Compare | `/distribution-compare` | How does this strategy's profile differ from that one's? | M5b |

**Nav:** Session | Session Compare | Distribution | Distribution Compare

---

## Architecture

### Directory structure

```
craps/
├── src/                            ← untouched
├── types/                          ← shared type re-exports (M0)
│   └── simulation.ts
├── server/
│   ├── server.ts
│   ├── lib/
│   │   └── distribution.ts         ← computeAggregates, summarize (M4)
│   └── routes/
│       ├── simulate.ts
│       ├── strategies.ts
│       ├── distribution.ts         ← SSE stream endpoint (M4)
│       ├── session-compare.ts      ← SharedTable single-session (M5a)
│       └── distribution-compare.ts ← dual SSE stream (M5b)
├── web/
│   └── src/
│       ├── lib/
│       │   ├── stats.ts            ← computeHeatScores added in M3.5
│       │   ├── stages.ts
│       │   └── cats-thresholds.ts
│       ├── components/
│       │   ├── Shell.tsx
│       │   ├── RunControls.tsx
│       │   ├── SummaryPanel.tsx
│       │   ├── SessionChart.tsx
│       │   ├── HeatStrip.tsx               ← M3.5
│       │   ├── StageBreakdown.tsx
│       │   ├── StageOverlayChart.tsx
│       │   ├── TrendPanel.tsx
│       │   ├── BandChart.tsx
│       │   ├── OutcomeSummary.tsx
│       │   ├── RuinCurve.tsx
│       │   ├── ComparisonChart.tsx         ← M5a
│       │   └── DistributionCompareChart.tsx ← M5b
│       ├── pages/
│       │   ├── SessionPage.tsx
│       │   ├── SessionComparePage.tsx      ← M5a
│       │   ├── DistributionPage.tsx
│       │   └── DistributionComparePage.tsx ← M5b
│       └── hooks/
│           ├── useSimulation.ts
│           ├── useDistribution.ts
│           ├── useComparison.ts            ← M5a
│           └── useDistributionCompare.ts   ← M5b
└── package.json
```

### Request flow

```
Browser → Vite dev server (port 5173)
        → proxies /api/* → Express (port 3001)
                         → CrapsEngine / SharedTable (in-process)
                         → JSON or SSE stream
        ← Recharts renders charts
```

---

## API Contract

### `POST /api/simulate` *(M1, updated M3)*

```typescript
// Request
{ strategy: string; rolls: number; bankroll: number; seed?: number; }

// Response — EngineResult plus echoed seed
{ ...EngineResult, seed: number }
```

### `GET /api/strategies` *(M1)*

Returns `string[]`.

### `GET /api/distribution/stream` *(M4)*

SSE stream. Query params: `strategy`, `seeds`, `rolls`, `bankroll`.

Emits every 10% of seeds:
```typescript
{ progress: number; completed: number; aggregates: DistributionAggregates; done: boolean; }
```

### `POST /api/session-compare` *(M5a)*

```typescript
// Request
{ strategies: string[]; rolls: number; bankroll: number; seed?: number; }

// Response
{ results: SharedTableResult; seed: number; }
```

### `GET /api/distribution-compare/stream` *(M5b)*

SSE stream. Query params: `strategy` (baseline), `test` (challenger), `seeds`, `rolls`, `bankroll`.

Uses `SharedTable` per seed — both strategies see identical dice in each session.

Emits every 10% of seeds:
```typescript
{
  progress: number;
  completed: number;
  baseline: DistributionAggregates;
  test: DistributionAggregates;
  done: boolean;
}
```

---

## Milestone 4 — Distribution Analysis [DONE]

**Theme:** Monte Carlo analysis of a single strategy across N seeds. Streaming results via SSE.

**Page:** `/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500`

**Seed presets:** Quick (200) | Standard (500) | Deep (1000). Seeds are sequential integers — presets are nested subsets, so bands refine smoothly rather than jumping when upgrading from Quick to Standard.

**Tail analysis (P95/P99):** CLI-only via `--seeds N --output distribution`. M6 handles loading those results into the UI via `FileReader` (no server round-trip).

### M4.1 — Server: SSE distribution endpoint [DONE]

`server/routes/distribution.ts` — `GET /api/distribution/stream`. Runs N `CrapsEngine` sessions, emits aggregated results every 10% of seeds. `server/lib/distribution.ts` — `computeAggregates()` and `summarize()`. Raw `RollRecord[]` never leaves the server.

### M4.2 — Client: SSE hook [DONE]

`web/src/hooks/useDistribution.ts` — `EventSource` hook. Closes on `done: true` or unmount.

### M4.3 — Distribution page [DONE]

`web/src/pages/DistributionPage.tsx` — four sections:
1. Controls and progress (seed presets, progress bar, Load file button)
2. Bankroll band chart (`BandChart.tsx`) — P10/P50/P90, updates as seeds stream
3. Session outcome summary (`OutcomeSummary.tsx`) — median final, win rate, ruin rate, median peak, median roll to peak, P10/P90 final
4. Ruin probability curve (`RuinCurve.tsx`) — P(ruin) over roll number

File loader accepts `.distribution.json` (CLI-generated). When loaded, adds P95/P99 lines to band chart and P95/P99 stats to outcome summary.

### M4.4 — Nav updated [DONE]

Shell nav updated to include Distribution.

### M4 Review [DONE]

- [x] SSE closes cleanly on unmount
- [x] Aggregates server-side — no raw roll arrays to client
- [x] Band chart updates smoothly
- [x] Seed presets update URL and restart stream
- [x] `computeAggregates` in `server/lib/distribution.ts`
- [x] File loader: duplicate data source bug fixed — `activeData = fileData ?? streamingData`
- [x] `npm test` passes

### M4 Demo [DONE]

`demo/web-distribution.md` — seed 7 CATS 500 seeds. Load `cats-10k.distribution.json` for P95/P99 tail bands.

---

## Milestone 3.5 — Session Heat Strip

**Theme:** A compact visual summary of shooter heat across the session, placed between the stat
cards and the session chart. Lets the user grok the overall texture of a session before reading
the detail in the chart below.

**Page:** `/session` — Session page only. No server changes. No new API surface. Computed
client-side from the `RollRecord[]` already present in the simulation response.

---

### What it is

A single horizontal strip, full chart width, 16–20px tall. Each pixel column maps to a roll.
Color encodes the rolling phantom pass-line P&L over a centered 8-roll window [R-4, R+4],
shrinking at the edges.

It answers: **were the dice working in this part of the session?**

---

### Placement

```
┌──────────────────────────────────────────────────────────────┐
│  [stat cards — two rows]                                     │
│                                                              │
│  ░░░▓▓▓███▓▓░░░░░░▓▓▓░░░░░░░░░░░▓▓▓███████▓▓░░░░░░░░░░░░░  │  ← heat strip (16–20px)
│                                                              │
│  SESSION CHART                                               │
│  [chart]                                                     │
└──────────────────────────────────────────────────────────────┘
```

No label needed on the strip itself — a subtle section header ("SHOOTER HEAT") above it is
sufficient. The strip shares the same left/right margins as the session chart so the X axes
are visually aligned.

---

### Rubric: phantom pass-line P&L

Walk the `RollRecord[]` and assign a pass-line unit result to each roll. No engine re-run —
pure accounting on the existing roll log:

```typescript
function phantomPassLineValue(roll: RollRecord): number {
  // Come-out phase
  if (roll.phase === 'comeOut') {
    if (roll.outcome === 'natural') return +1;  // 7 or 11
    if (roll.outcome === 'craps')   return -1;  // 2, 3, 12
    return 0;                                    // point established
  }
  // Point phase
  if (roll.outcome === 'pointMade') return +1;
  if (roll.outcome === 'sevenOut')  return -1;
  return 0;                                      // number rolled, no resolution
}
```

For each roll R, compute the centered window score:

```typescript
function heatScore(rolls: RollRecord[], r: number, halfWindow = 4): number {
  const lo = Math.max(0, r - halfWindow);
  const hi = Math.min(rolls.length - 1, r + halfWindow);
  let sum = 0;
  for (let i = lo; i <= hi; i++) {
    sum += phantomPassLineValue(rolls[i]);
  }
  return sum;
}
```

Window is centered at R and shrinks naturally at both edges — no padding, no special casing.
Edges carry less data, which is true and acceptable. Maximum window is 9 rolls ([R-4, R+4]);
minimum is 5 rolls at the extreme edges ([0, 4] for roll 0, [N-5, N-1] for roll N-1).

---

### Color mapping

Five buckets, symmetric around zero. Scores are clamped to [-2, +2]:

| Score | Color | Tailwind approx | Meaning |
|---|---|---|---|
| ≥ +2 | Deep green | `green-600` | Hot — point conversions dominating |
| +1 | Light green | `green-300` | Warm |
| 0 | Neutral gray | `slate-200` | Choppy — no clear signal |
| -1 | Light red | `red-300` | Cool |
| ≤ -2 | Deep red | `red-600` | Cold — 7-outs dominating |

With a 9-roll max window and pass-line resolution being sparse, scores beyond ±3 are possible
on very long or very short hands but rare. Clamping to ±2 keeps the palette stable.

---

### Tooltip

On hover over any cell, show a small tooltip:

```
Rolls 34–41  (window: 8)
Point made · 7-out · Natural
Score: +1  Warm
```

Lists the shooter events in the window (point mades, 7-outs, naturals, craps) and the computed
score. Helps the user build intuition for how the rubric works.

---

### Component

**New file:** `web/src/components/HeatStrip.tsx`

```typescript
interface HeatStripProps {
  rolls: RollRecord[];
  width: number;        // match session chart content width in px
  height?: number;      // default 18
  halfWindow?: number;  // default 4 → 9-roll max window
}
```

Render as SVG — one `<rect>` per roll, width = `contentWidth / rolls.length`, height = full
strip height, fill from color map. SVG is preferred over a flex row of divs for clean subpixel
alignment with the Recharts plot area.

Width alignment: use a `ResizeObserver` on the chart container, or accept the chart's plot area
width as a prop from `SessionPage`. The strip must account for the Y-axis label space on the
left — the colored region should begin and end at the same X position as the chart's data area,
not the chart's outer bounding box.

**New export in `web/src/lib/stats.ts`:**

```typescript
export function computeHeatScores(rolls: RollRecord[], halfWindow = 4): number[]
```

Returns a clamped score in [-2, +2] for each roll. Keeps computation out of the component.
This is the function that carries the unit tests.

---

### Integration

In `web/src/pages/SessionPage.tsx`, place `<HeatStrip>` between the stat cards section and
the `<SessionChart>`. Pass the same `rolls` array already fetched by `useSimulation`. No new
state, no new fetches.

The strip is stateless — no controls, no filters, no interaction beyond hover tooltip.

---

### Acceptance criteria

- [ ] Strip renders full width, colored region visually aligned with session chart X axis
- [ ] Colors map correctly — deep green on long hands with point conversions, deep red on
      clusters of 7-outs, gray on choppy stretches with few resolutions
- [ ] Window shrinks correctly at roll 0 and roll N-1 — no out-of-bounds errors
- [ ] Hover tooltip shows correct roll range, shooter events, and score label
- [ ] `computeHeatScores` has unit tests covering: come-out natural (+1), come-out craps (-1),
      point made (+1), 7-out (-1), mixed window, edge roll 0, edge roll N-1
- [ ] No new API calls — computed entirely from existing `EngineResult`
- [ ] `npm test` passes

---

### M3.5 Demo

```bash
open "http://localhost:5173/session?strategy=CATS&rolls=500&bankroll=300&seed=693414"
```

This seed (-$22 net, peak $382, trough $144) has a cold-ish open, visible warming around
roll 100, a cold valley near roll 170, and a hot climb through rolls 200–300 that matches the
bankroll recovery in the chart. The heat strip should show that texture clearly.

Cross-check: deep red cells should cluster loosely near the vertical red 7-out markers in the
session chart below. They won't align exactly (centered window smooths them) but the
correlation should be visually unmistakable.

---

## Milestone 5 — Comparison Pages

**Theme:** Two focused comparison pages. Each has a single question and clean URL. The `/compare`
route has been renamed to `/session-compare` for consistency with the four-page model.

---

### M5a — Session Compare

**Question:** Which strategy played these dice better?

**Page:** `/session-compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7`

**Mechanics:** `SharedTable` — one dice sequence, two independent bankrolls. Any divergence in
outcome is purely strategy, not luck.

---

#### M5a.1 — Routing rename

Rename existing `/compare` route to `/session-compare` throughout:

- `web/src/App.tsx` — update route path
- `web/src/components/Shell.tsx` — update `NavLink` target and label
- `web/src/components/RunControls.tsx` — update page-aware navigation
- `server/server.ts` — update route registration if path is hardcoded there

No logic changes — rename only. The existing `useComparison` hook and `server/routes/compare.ts`
(rename file to `session-compare.ts`) are otherwise untouched.

**Acceptance test:** `/session-compare` loads correctly. No 404s. Old `/compare` URL redirects
or 404s cleanly — no silent broken state.

---

#### M5a.2 — Session Compare page

**New file:** `web/src/pages/SessionComparePage.tsx`

Two strategy selectors in sidebar (Strategy A, Strategy B). Shared rolls/bankroll/seed. Seed
written to URL after run.

**Section 1 — Head-to-head timeline**

**New component:** `web/src/components/ComparisonChart.tsx`

Single `ComposedChart`. Two bankroll lines: Strategy A = blue, Strategy B = orange. Shared X
axis — identical dice. Buy-in reference line. Legend.

The headline visual: two lines diverging on the same dice. Where they separate is where strategy
matters.

**Section 2 — Side-by-side summary**

Two `SummaryPanel` instances, color-coded headers (blue / orange). Net change delta between
strategies shown prominently above both panels.

**Section 3 — Dice verification**

"Both strategies saw identical dice ✓" — shows first 5 roll values from each strategy's log.
Confirms `SharedTable` correctness. Collapsible.

**Section 4 — Stage comparison**

If either strategy has `stageName` data, shows its `StageBreakdown` table alongside the other's
plain session stats. Makes CATS's structural behavior visible against a flat strategy on the
same dice.

**Acceptance test:** `/session-compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7`
— two lines render, dice verification ✓, CATS stage breakdown visible alongside ThreePointMolly3X
plain stats.

---

### M5b — Distribution Compare

**Question:** How does this strategy's variance profile differ from that one's?

**Page:** `/distribution-compare?strategy=CATS&test=ThreePointMolly3X&rolls=500&bankroll=300&seeds=500`

**URL params:** `strategy` = baseline (the reference), `test` = challenger. Deliberate asymmetry
— makes the swap concept explicit.

---

#### M5b.1 — Server: dual distribution SSE endpoint

**New file:** `server/routes/distribution-compare.ts`

`GET /api/distribution-compare/stream` — runs N seeds, using `SharedTable` per seed so both
strategies face identical dice in each session. Aggregates both independently.

```typescript
// Per seed: SharedTable with both strategies, collect both trajectories
// Aggregate baseline and test separately, stream both together
app.get('/api/distribution-compare/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { strategy, test, seeds, rolls, bankroll } = req.query;
  const N = Number(seeds);
  const batchSize = Math.max(1, Math.floor(N / 10));
  const baselineResults: SessionSummary[] = [];
  const testResults: SessionSummary[] = [];

  for (let i = 0; i < N; i++) {
    // SharedTable: same dice for both strategies on this seed
    const table = new SharedTable({ seed: i, rolls: Number(rolls) });
    table.addStrategy('baseline', lookupStrategy(strategy as string), { bankroll: Number(bankroll) });
    table.addStrategy('test', lookupStrategy(test as string), { bankroll: Number(bankroll) });
    const results = table.run();

    baselineResults.push(summarize(results['baseline'], i));
    testResults.push(summarize(results['test'], i));

    if ((i + 1) % batchSize === 0 || i === N - 1) {
      res.write(`data: ${JSON.stringify({
        progress: (i + 1) / N,
        completed: i + 1,
        baseline: computeAggregates(baselineResults),
        test: computeAggregates(testResults),
        done: i === N - 1,
      })}\n\n`);
    }
  }

  res.end();
});
```

Using `SharedTable` per seed is critical — it means the distributional comparison is controlled
at the seed level. Both strategies face the same dice in each of the N sessions, making the
comparison as fair as the single-session compare.

**Acceptance test:** `curl "http://localhost:3001/api/distribution-compare/stream?strategy=CATS&test=ThreePointMolly3X&seeds=20&rolls=500&bankroll=300"`
streams ~3 SSE events containing both `baseline` and `test` aggregates, closes cleanly.

---

#### M5b.2 — Client: dual distribution hook

**New file:** `web/src/hooks/useDistributionCompare.ts`

```typescript
export function useDistributionCompare(params: DistributionCompareParams) {
  const [baseline, setBaseline] = useState<DistributionAggregates | null>(null);
  const [test, setTest] = useState<DistributionAggregates | null>(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const source = new EventSource(
      `/api/distribution-compare/stream?${new URLSearchParams(params)}`
    );
    source.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.progress);
      setBaseline(data.baseline);
      setTest(data.test);
      if (data.done) { setDone(true); source.close(); }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [JSON.stringify(params)]);

  return { baseline, test, progress, done };
}
```

---

#### M5b.3 — Distribution Compare page

**New file:** `web/src/pages/DistributionComparePage.tsx`

Sidebar: strategy selector (baseline), strategy selector (test), shared rolls/bankroll controls,
seed preset buttons (Quick/Standard/Deep), **Swap button**.

**Swap button behavior:** Exchanges the `strategy` and `test` URL params — navigates to the same
page with params swapped, which causes `useDistributionCompare` to start a new stream. This is
intentional — swapping is a meaningful analytical act, not just a display toggle.

> **Note:** A pure client-side swap (no refetch) would require storing both distributions in
> state and swapping which renders as baseline vs. test. That is also valid and avoids the
> re-stream cost. Implement whichever is simpler — both are correct. Document the choice in
> code comments.

**Band chart**

**New component:** `web/src/components/DistributionCompareChart.tsx`

- **Baseline:** solid P10/P50/P90 lines, light shaded fill between P10 and P90
- **Test:** dashed P10/P50/P90 lines, same color family as baseline, no fill
- Single Y axis (bankroll), shared X axis (roll number)
- Buy-in reference line
- Legend clearly labels baseline vs. test strategy names
- Progress bar above chart while streaming

The visual logic: solid + shading = "this is the reference envelope." Dashed = "this is what
we're comparing against it." Divergence is immediately readable where dashed lines exit the
shaded region.

**Outcome delta summary**

**New component:** `web/src/components/OutcomeDelta.tsx`

Not two separate `OutcomeSummary` panels — a single delta-focused table:

| Stat | Baseline | Test | Delta |
|---|---|---|---|
| Median final | $193 | $218 | **+$25** |
| Win rate | 26.3% | 31.2% | **+4.9%** |
| Ruin rate | 7.5% | 5.1% | **-2.4%** |
| Median peak | $400 | $385 | -$15 |
| Median roll to peak | 146 | 139 | -7 |

Delta column: green = test is better on this metric, red = baseline is better. Makes tradeoffs
explicit — a strategy can win on some metrics and lose on others, and that tension is the whole
point. After swap: all delta signs flip. The table reads correctly in either orientation.

**Acceptance test:** `/distribution-compare?strategy=CATS&test=ThreePointMolly3X&rolls=500&bankroll=300&seeds=500`
— band chart shows solid CATS bands with dashed ThreePointMolly3X lines. Delta table updates as
seeds stream. Swap exchanges baseline/test — band chart and delta table both update correctly.

---

### M5 Review

- [ ] `/compare` fully renamed to `/session-compare` — no orphaned route references, no broken nav links
- [ ] Nav shows four flat items: Session | Session Compare | Distribution | Distribution Compare
- [ ] `RunControls` page-aware navigation handles all four routes correctly
- [ ] `DistributionCompareChart` baseline/test distinction is visually unambiguous (solid+fill vs. dashed+no fill)
- [ ] Delta table sign convention correct: positive delta = test better on that metric
- [ ] Delta table reads correctly after swap in both orientations
- [ ] `SharedTable` used per seed in M5b — dice controlled at seed level
- [ ] SSE connection for distribution compare closes cleanly on unmount
- [ ] `npm test` passes

---

### M5 Demo

**File:** `demo/web-compare.md`

```bash
# Session Compare
open "http://localhost:5173/session-compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7"

# Distribution Compare
open "http://localhost:5173/distribution-compare?strategy=CATS&test=ThreePointMolly3X&rolls=500&bankroll=300&seeds=500"
```

**Session Compare:** Two bankroll lines diverge on identical dice. CATS stage breakdown shows
65 visits. ThreePointMolly3X shows flat play. Dice verification ✓. Try seed 42 — both grind
a bad session.

**Distribution Compare:** Solid CATS bands with light fill. Dashed ThreePointMolly3X lines.
Watch them stream and stabilize. Delta table shows which strategy wins on which metrics. Hit
Swap — dashed/solid exchange, delta signs flip, no visual glitching.

---

## Milestone 6 — Tail Analysis Loader

**Theme:** Import large CLI-generated datasets into the web UI for P95/P99 tail visualization.

**Why CLI for tails:** 10,000-seed runs take minutes. The web UI loads pre-computed results via
`FileReader` — no server round-trip.

### M6.0 — CLI output format

New CLI flag `--seeds N --output distribution`:

```bash
npx ts-node src/cli/run-sim.ts \
  --strategy CATS --rolls 500 --bankroll 300 \
  --seeds 10000 --output distribution \
  > analysis/cats-10k.distribution.json
```

Output extends `DistributionAggregates`:

```typescript
interface FullDistributionAggregates extends DistributionAggregates {
  p95: number[];
  p99: number[];
  finalBankroll: { p10: number; p50: number; p90: number; p95: number; p99: number; mean: number };
  seedCount: number;
  generatedAt: string;
  params: { strategy: string; rolls: number; bankroll: number };
}
```

Distribution JSON files are in `.gitignore` (`*.distribution.json`). The `analysis/` directory
can hold intentional committed results via `.gitignore` exception.

### M6.1 — Web UI: file loader [DONE]

"Load file" button on `/distribution` page. `FileReader` client-side. When loaded: band chart
gains P95/P99 lines, outcome summary gains P95/P99 stats, page header shows filename and seed
count.

### M6 Review / M6 Demo

*Defined when M6 CLI work is implemented.*

Key acceptance test: 10,000-seed CLI run loaded shows stable P95/P99 bands that 500-seed
streaming cannot produce.

---

## Milestone 7 — Polish and Hardening

*Placeholder for cross-cutting concerns deferred from M3–M6: error boundaries, mobile layout,
performance tuning for large datasets, UX rough edges identified during use.*

---

## Resolved Decisions

| Decision | Resolution |
|---|---|
| Type sharing | Shared `types/simulation.ts` at repo root re-exports from engine source |
| Server package location | Shares root `package.json`. `"server"` script in root |
| `stageName` in `RollRecord` | Added in M0.1. Optional, Stage Machine strategies only |
| Stage transition markers | Tried and removed — too dense. Table load tells stage story |
| Stage overlay Y axis | Relative ±$ from stage entry bankroll |
| Rolling trend window | 24 rolls |
| Stage filter dropdown | Deferred — overlay chart is the better answer |
| Routing library | `react-router-dom` |
| Layout | Collapsible left sidebar, expanded by default, collapses to 48px icon rail |
| URL schema | `/session`, `/session-compare`, `/distribution`, `/distribution-compare` |
| Loading state | Spinner overlay — no clear-and-reload |
| Seed UX | Always written to URL after run. Clear field for new random run |
| Distribution streaming | SSE via `GET /api/distribution/stream` |
| Seed presets | Quick: 200, Standard: 500, Deep: 1000 — sequential integers, nested subsets |
| Tail analysis | CLI-only for P95/P99. M6 loads results into web UI via FileReader |
| Comparison page naming | `/session-compare` and `/distribution-compare` — parallel and self-describing |
| Distribution compare dice | `SharedTable` per seed — dice controlled at seed level, not just strategy |
| Distribution compare visual | Baseline = solid + fill. Test = dashed + no fill. Swap = URL param exchange |
| Swap behavior | URL param swap (triggers re-stream) or client state swap — either valid, document choice |
| Heat strip rubric | Phantom pass-line P&L — canonical dice heat, no engine re-run needed |
| Heat strip window | Centered ±4 rolls (9-roll max), shrinks at edges — no padding |
| Heat strip placement | Between stat cards and session chart, full chart width, 16–20px tall |

---

## New Files Summary

| File | Milestone | Purpose |
|---|---|---|
| `src/engine/roll-record.ts` | M0.1 | Add `stageName?: string` |
| `src/engine/craps-engine.ts` | M0.1 | Populate `stageName` from Stage Machine runtime |
| `src/engine/shared-table.ts` | M0.1 | Populate `stageName` per player slot |
| `types/simulation.ts` | M0.2 | Shared type re-exports |
| `server/server.ts` | M1.1 | Express entry point |
| `server/routes/simulate.ts` | M1.1 | POST /api/simulate (M3: seed echo) |
| `server/routes/strategies.ts` | M1.1 | GET /api/strategies |
| `server/routes/distribution.ts` | M4.1 | GET /api/distribution/stream (SSE) |
| `server/routes/session-compare.ts` | M5a.1 | POST /api/session-compare (renamed from compare.ts) |
| `server/routes/distribution-compare.ts` | M5b.1 | GET /api/distribution-compare/stream (dual SSE) |
| `server/lib/distribution.ts` | M4.1 | computeAggregates, summarize |
| `web/package.json` | M1.2 | Frontend package |
| `web/vite.config.ts` | M1.2 | Vite config with API proxy and SSE support |
| `web/tsconfig.json` | M1.2 | TypeScript config with path alias |
| `web/src/main.tsx` | M3.1 | BrowserRouter wrapper |
| `web/src/App.tsx` | M1.6 → M3.1 → M5a.1 | Root component → routes → session-compare rename |
| `web/src/lib/stats.ts` | M1.4, M3.5 | computeSessionStats, rolling P&L, computeHeatScores |
| `web/src/lib/stages.ts` | M2.1 | Stage spans, visit normalization, color palette |
| `web/src/lib/cats-thresholds.ts` | M2.4 | CATS threshold proximity logic |
| `web/src/hooks/useSimulation.ts` | M1.3 | Single-run data fetching hook |
| `web/src/hooks/useDistribution.ts` | M4.2 | SSE distribution hook |
| `web/src/hooks/useComparison.ts` | M5a.2 | Session compare data hook |
| `web/src/hooks/useDistributionCompare.ts` | M5b.2 | Dual SSE distribution compare hook |
| `web/src/components/Shell.tsx` | M3.2 | App layout — top nav + collapsible sidebar |
| `web/src/components/RunControls.tsx` | M3.3 | Simulation params form (page-aware) |
| `web/src/components/SummaryPanel.tsx` | M1.4 | Stats card grid |
| `web/src/components/SessionChart.tsx` | M1.5 | Dual-axis chart with stage color banding |
| `web/src/components/HeatStrip.tsx` | M3.5 | Shooter heat strip — phantom P&L color band |
| `web/src/components/StageBreakdown.tsx` | M2.2 | Stage visit summary table |
| `web/src/components/StageOverlayChart.tsx` | M2.3 | T0-normalized stage overlay charts |
| `web/src/components/TrendPanel.tsx` | M2.4 | Rolling P&L, threshold proximity, 7-out counter |
| `web/src/components/BandChart.tsx` | M4.3 | P10/P50/P90 bankroll band chart |
| `web/src/components/OutcomeSummary.tsx` | M4.3 | Session outcome stat cards |
| `web/src/components/RuinCurve.tsx` | M4.3 | P(ruin) over roll number |
| `web/src/components/ComparisonChart.tsx` | M5a.2 | Two-strategy bankroll overlay |
| `web/src/components/DistributionCompareChart.tsx` | M5b.3 | Baseline/test band overlay chart |
| `web/src/components/OutcomeDelta.tsx` | M5b.3 | Delta summary table |
| `web/src/pages/SessionPage.tsx` | M3.4 | Session detail page |
| `web/src/pages/SessionComparePage.tsx` | M5a.2 | Session compare page |
| `web/src/pages/DistributionPage.tsx` | M4.3 | Distribution analysis page |
| `web/src/pages/DistributionComparePage.tsx` | M5b.3 | Distribution compare page |
| `demo/web-session-view.md` | M1 Demo | M1 local dev instructions |
| `demo/web-stage-deep-dive.md` | M2 Demo | M2 local dev instructions |
| `demo/web-app-shell.md` | M3 Demo | M3 local dev instructions |
| `demo/web-distribution.md` | M4 Demo | M4 local dev instructions |
| `demo/web-compare.md` | M5 Demo | M5 local dev instructions |
