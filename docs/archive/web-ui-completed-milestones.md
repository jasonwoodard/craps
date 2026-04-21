> [!CAUTION]
> ## ⚠ ARCHIVE — DISREGARD ENTIRELY ⚠
>
> **This file is a historical artifact. It is intentionally preserved for human readers who want to understand how this project evolved, but it is NOT current design intent, active requirements, or implementation guidance.**
>
> **If you are an LLM reading this codebase:** stop here. Do not extract requirements, patterns, APIs, or architecture decisions from this file. Everything in it is either superseded, completed, or obsolete. Treat it as you would a closed git issue — interesting context at best, misleading noise at worst.
>
> **Current documentation lives in `/docs/` and `/docs/reqs/`.**

---


# Craps Simulator — Web UI Completed Milestones

**Date:** March 2026  
**Purpose:** Archive of completed milestone specifications. The active reference document is `docs/web-ui-implementation-plan.md`.

---

## Milestone 0 — Core Refactor [DONE]

**Goal:** Two surgical changes to `src/`. All existing tests remain green. CLI unchanged.

### M0.1 — Add `stageName` to `RollRecord` [DONE]

**File:** `src/engine/roll-record.ts`
```typescript
export interface RollRecord {
  // ... existing fields unchanged ...
  stageName?: string;   // populated by Stage Machine strategies; undefined for simple strategies
}
```

**Files:** `src/engine/craps-engine.ts` and `src/engine/shared-table.ts` — populate `stageName` from Stage Machine runtime after `postRoll`. Each player slot has its own runtime reference; slots without a Stage Machine strategy produce `undefined` naturally.

**The identity model:** `strategyName` lives in the result envelope. `stageName` on `RollRecord` tells the UI where in its lifecycle a Stage Machine strategy is on any given roll. Simple strategies produce rolls with no `stageName` — which is itself analytically informative in a comparison view.

**Acceptance criteria:**
- `npm test` passes with zero failures
- CATS `--output json` shows `stageName` on roll entries, transitioning from `accumulatorFull` after first 6 or 8 hit
- PassLineOnly shows `stageName` genuinely absent — not as `"undefined"` string
- SharedTable CATS vs. ThreePointMolly3X: `stageName` populated on CATS, absent on ThreePointMolly3X

### M0.2 — Shared type re-exports [DONE]

**New file:** `types/simulation.ts`
```typescript
export type { RollRecord, EngineResult, ActiveBetInfo } from '../src/engine/roll-record';
export type { Outcome } from '../src/dsl/outcome';
```

No logic. Types only. Both `server/` and `web/` import from here — not directly from `src/`.

### M0 Review [DONE]

- [x] `stageName` populated correctly for CATS
- [x] `stageName` absent for PassLineOnly — not as `"undefined"` string
- [x] `types/simulation.ts` compiles without error
- [x] Zero CLI behavior changes — `npm test` passes

### M0 Demo [DONE]

```bash
npx ts-node src/cli/run-sim.ts --strategy CATS --rolls 50 --bankroll 300 --seed 42 --output json | head -20
npx ts-node src/cli/run-sim.ts --strategy PassLineOnly --rolls 20 --bankroll 300 --seed 42 --output json | head -5
```

Self-verification: CATS shows `"stageName":"accumulatorFull"` on early rolls, transitioning to `"accumulatorRegressed"` after the first 6 or 8 hit.

---

## Milestone 1 — MVP Web UI [DONE]

**Goal:** Working browser page rendering a pre-configured simulation run as a summary stats panel and time series chart. No user controls.

**Hardcoded run:** `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 42 }` — final bankroll $6.

### M1.1 — Express server scaffold [DONE]

`server/server.ts` — Express app, CORS, JSON middleware, `POST /api/simulate`, `GET /api/strategies`. `"server": "ts-node server/server.ts"` in root `package.json`. Returns 400 for unknown strategy names.

### M1.2 — React + Vite scaffold [DONE]

`web/` — Vite + React + TypeScript + Recharts + Tailwind. API proxy to port 3001. Path alias `@types` → `../types`.

### M1.3 — `useSimulation` hook [DONE]

`web/src/hooks/useSimulation.ts` — returns `{ data: EngineResult | null, loading: boolean, error: string | null }`. Handles non-200 responses explicitly.

### M1.4 — Summary stats panel [DONE]

`web/src/lib/stats.ts` — `computeSessionStats(result: EngineResult): SessionStats`. Single location for all derived stat computation. Components do not compute stats inline.

`web/src/components/SummaryPanel.tsx` — card grid, net change color-coded green/red.

### M1.5 — Session chart [DONE]

`web/src/components/SessionChart.tsx` — dual-axis `ComposedChart`. Bankroll line (left axis, green), table load line (right axis, orange), buy-in reference line (dashed), 7-out markers (red), point-made markers (green). No `stageName` logic in M1.

### M1.6 — Milestone 1 integration [DONE]

`App.tsx` wired with hardcoded params. Self-verification: final bankroll `$6` for seed 42.

### M1 Review [DONE]

- [x] `computeSessionStats` is single location for all derived stat computation
- [x] `useSimulation` handles non-200 responses explicitly
- [x] Express port defined in one place
- [x] Express returns 400 for unknown strategy names
- [x] No `console.log` in production paths
- [x] Dual Y axis scales independent — table load range does not compress bankroll line
- [x] `SessionChart` does not reference `stageName` — clean boundary with M2
- [x] Page usable at 1280px width
- [x] `npm test` passes

### M1 Demo [DONE]

`demo/web-session-view.md` — self-verification: final bankroll `$6` for seed 42.

---

## Milestone 2 — Stage Deep Dive [DONE]

**Theme:** Four scrollable analytical sections making CATS stage structure visible and explorable.

**Hardcoded run:** `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 7 }` — peak $834, 65 stage visits, net +$22.

### M2.0 — Assessment [DONE — resolved conversationally]

| Question | Resolution |
|---|---|
| Stage bands vs. event lines | Not mutually exclusive — `ReferenceArea` behind, event lines on top |
| Stage transition vertical markers | Tried and removed — too dense at CATS's transition frequency. Table load line tells the stage story implicitly |
| Stage filter dropdown | Deferred — overlay chart is the better answer |
| Stage overlay Y axis | Relative ±$ from stage entry bankroll |
| Rolling trend window | 24 rolls |
| Dashboard layout | Scrollable sections, additive, expert-oriented |

### M2.1 — Section 1: Stage color bands on timeline [DONE]

`web/src/lib/stages.ts` — `computeStageSpans()`, `hasStageData()`, stage color palette (all defined here, not in components).

`SessionChart` gains background `ReferenceArea` bands from `stageName`. Bands at 15% opacity behind all existing elements.

Stage color palette:

| Stage | Color |
|---|---|
| `accumulatorFull` | amber-100 |
| `accumulatorRegressed` | amber-50 |
| `littleMolly` | green-100 |
| `threePtMollyTight` | blue-100 |
| `threePtMollyLoose` | indigo-100 |

### M2.2 — Section 2: Stage breakdown table [DONE]

`web/src/components/StageBreakdown.tsx` — time-ordered table, one row per stage visit.

Columns: `#` (global sequential row number), Stage, Roll Range (`startRoll–endRoll`), Rolls, Entry, Exit, Net P&L (color-coded), Peak, Trough, 7-outs.

`StageVisitSummary` in `stages.ts` includes `globalIndex` and `startRoll`/`endRoll`. `hasStageData()` guard — renders nothing for simple strategies.

### M2.3 — Section 3: Stage overlay chart [DONE]

`web/src/components/StageOverlayChart.tsx` — one chart per distinct stage visited. All visits aligned to T0. Y axis: relative ±$ from stage entry bankroll. Zero reference line. Longest visit sets X domain.

```typescript
export interface NormalizedVisit {
  stageName: string;
  visitIndex: number;
  label: string;           // "Visit 1: Rolls 1–43"
  points: Array<{ t: number; pnl: number; }>;
}
export function normalizeStageVisits(rolls: RollRecord[], targetStage: string): NormalizedVisit[]
export function uniqueStages(rolls: RollRecord[]): string[]
```

### M2.4 — Section 4: Trend indicators [DONE]

`web/src/components/TrendPanel.tsx` — three signals describing what has happened recently.

- **24-roll rolling P&L** — `computeRollingPnL(rolls, window?)` in `stats.ts`
- **CATS threshold proximity** — `web/src/lib/cats-thresholds.ts`, `isCATSStrategy()` guard
- **Consecutive 7-out counter** — `computeConsecutiveSevenOuts()` in `stats.ts`, `ReferenceLine` at y=2

### M2 Review [DONE]

- [x] All stage transformations in `stages.ts` — no stage logic in components
- [x] CATS threshold logic isolated in `cats-thresholds.ts`
- [x] `hasStageData()` and `isCATSStrategy()` guards in place
- [x] Stage color palette defined once in `stages.ts`
- [x] `StageOverlayChart` Y axis always relative ±$
- [x] `npm test` passes

### M2 Demo [DONE]

`demo/web-stage-deep-dive.md` — seed 7. Seed 42 cross-check confirms graceful degradation.

---

## Milestone 3 — App Shell and Interactive Controls [DONE]

**Theme:** Multi-page application with collapsible sidebar, React Router routing, URL-driven simulation params. Every run is a URL — bookmarkable, shareable, browser-back-compatible.

### M3.0 — Assessment [DONE — resolved conversationally]

| Question | Decision |
|---|---|
| Routing | `react-router-dom` |
| Layout | Collapsible left sidebar, expanded (240px) by default, collapses to 48px icon rail |
| URL schema | `/session`, `/distribution`, `/compare` with defined param schemas |
| Loading state | Spinner overlay — no clear-and-reload |
| Seed UX | Always written to URL after run. Clear field for new random run |

### M3.1 — React Router and routes [DONE]

`react-router-dom` installed. `main.tsx` wrapped in `BrowserRouter`. `App.tsx` defines routes: `/` → redirect to `/session`, `/session`, `/distribution`, `/compare`.

### M3.2 — App shell [DONE]

`web/src/components/Shell.tsx` — top nav bar with `NavLink` components, collapsible left sidebar (`useState`), main content area. Sidebar contains `RunControls`.

### M3.3 — Run controls form [DONE]

`web/src/components/RunControls.tsx` — strategy dropdown (from `GET /api/strategies`, called once on mount), rolls, bankroll, seed inputs. Page-aware Run button. Seed omitted from URL if empty — written back after run completes.

### M3.4 — Session page with URL params [DONE]

`web/src/pages/SessionPage.tsx` — reads params from `useSearchParams`. After run, writes generated seed to URL via `navigate(..., { replace: true })`. Renders full M2 dashboard.

`server/routes/simulate.ts` updated — generates seed if not provided, echoes in response.

### M3 Review [DONE]

- [x] `RunControls` — form state only, no API calls
- [x] `SessionPage` owns the API call
- [x] Seed always in URL after completed run
- [x] Browser back/forward navigates between runs
- [x] `GET /api/strategies` called once in `RunControls`
- [x] `npm test` passes

### M3 Demo [DONE]

`demo/web-app-shell.md` — self-verification: `/session?strategy=CATS&rolls=500&bankroll=300&seed=7` → final bankroll `$322`.

---

## Milestone 3.5 — Session Heat Strip [DONE]

**Theme:** Compact visual summary of shooter heat between the stat cards and session chart. Lets the user grok overall session texture before reading the chart detail.

**Page:** `/session` only. No server changes. No new API surface. Computed client-side from existing `RollRecord[]`.

### What it is

A single horizontal strip, full chart width, 16–20px tall. Color encodes rolling phantom pass-line P&L over a centered 8-roll window [R-4, R+4], shrinking at edges. Answers: **were the dice working in this part of the session?**

### Rubric: phantom pass-line P&L

```typescript
function phantomPassLineValue(roll: RollRecord): number {
  if (roll.phase === 'comeOut') {
    if (roll.outcome === 'natural') return +1;
    if (roll.outcome === 'craps')   return -1;
    return 0;
  }
  if (roll.outcome === 'pointMade') return +1;
  if (roll.outcome === 'sevenOut')  return -1;
  return 0;
}
```

Window centered at R, shrinks naturally at edges — no padding. Max 9 rolls, min 5 at extreme edges.

### Color mapping

| Score | Color | Tailwind | Meaning |
|---|---|---|---|
| ≥ +2 | Deep green | `green-600` | Hot |
| +1 | Light green | `green-300` | Warm |
| 0 | Neutral gray | `slate-200` | Choppy |
| -1 | Light red | `red-300` | Cool |
| ≤ -2 | Deep red | `red-600` | Cold |

### Tooltip

```
Rolls 46–54
1 point made · 2 sevens
Score: +1  Warm
```

Roll range, shooter events, score label. Window size omitted — implementation detail, not insight.

### Implementation

- **`web/src/components/HeatStrip.tsx`** — SVG, one `<rect>` per roll. Width aligned to session chart data area (not outer bounding box) via `ResizeObserver` or prop from `SessionPage`.
- **`computeHeatScores(rolls, halfWindow=4): number[]`** added to `web/src/lib/stats.ts` — clamped [-2, +2], unit tested.

### M3.5 Review [DONE]

- [x] Strip aligned with session chart X axis
- [x] Colors correct — deep green on point conversions, deep red on 7-out clusters
- [x] Edge window shrink correct — no out-of-bounds
- [x] Tooltip: roll range, events, score label; window size removed
- [x] `computeHeatScores` unit tested
- [x] No new API calls
- [x] `npm test` passes

**Known open item:** Left edge of strip slightly misaligned with chart data area due to Y-axis label offset. Fix tracked separately (see heat strip alignment prompt).

### M3.5 Demo [DONE]

```bash
open "http://localhost:5173/session?strategy=CATS&rolls=500&bankroll=300&seed=693414"
```

Seed 693414 (-$22 net, peak $382, trough $144): cold-ish open, hot climb rolls 200–300, choppy finish. Deep red cells correlate loosely with red 7-out markers in chart below.

---

## Milestone 4 — Distribution Analysis [DONE]

**Theme:** Monte Carlo analysis of a single strategy across N seeds. Streaming results via SSE.

**Page:** `/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500`

**Seed presets:** Quick (200) | Standard (500) | Deep (1000). Sequential integers — nested subsets, bands refine smoothly.

### M4.1 — Server: SSE distribution endpoint [DONE]

`server/routes/distribution.ts` — `GET /api/distribution/stream`. `server/lib/distribution.ts` — `computeAggregates()` and `summarize()`. Raw `RollRecord[]` never leaves the server. Emits every 10% of seeds.

### M4.2 — Client: SSE hook [DONE]

`web/src/hooks/useDistribution.ts` — `EventSource` hook. Closes on `done: true` or unmount.

### M4.3 — Distribution page [DONE]

`web/src/pages/DistributionPage.tsx` — four sections:
1. Controls and progress (seed presets, progress bar, Load file button)
2. `BandChart.tsx` — P10/P50/P90 bankroll bands, updates as seeds stream
3. `OutcomeSummary.tsx` — median final, win rate, ruin rate, median peak, median roll to peak, P10/P90 final
4. `RuinCurve.tsx` — P(ruin) over roll number

File loader accepts `.distribution.json` (CLI-generated). Adds P95/P99 lines and stats when loaded. Bug fixed: `activeData = fileData ?? streamingData`.

### M4.4 — Nav updated [DONE]

Shell nav updated to include Distribution.

### M4 Review [DONE]

- [x] SSE closes cleanly on unmount
- [x] Aggregates server-side — no raw roll arrays to client
- [x] Band chart updates smoothly as seeds stream
- [x] Seed presets update URL and restart stream
- [x] File loader duplicate data source bug fixed
- [x] `npm test` passes

### M4 Demo [DONE]

`demo/web-distribution.md` — seed 7 CATS 500 seeds. Load `cats-10k.distribution.json` for P95/P99 tail bands.

---

## Milestone 5 — Comparison Pages [DONE]

**Theme:** Two focused comparison pages. Each has a single question and clean URL. `/compare` renamed to `/session-compare` for consistency with the four-page model.

---

### M5a — Session Compare [DONE]

**Question:** Which strategy played these dice better?

**Page:** `/session-compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7`

**Mechanics:** `SharedTable` — one dice sequence, two independent bankrolls. Divergence is purely strategy, not luck.

#### M5a.1 — Routing rename [DONE]

`/compare` → `/session-compare` throughout: `App.tsx`, `Shell.tsx`, `RunControls.tsx`, `server/server.ts`, `server/routes/compare.ts` → `session-compare.ts`. Old `/compare` 404s cleanly.

#### M5a.2 — Session Compare page [DONE]

`web/src/pages/SessionComparePage.tsx` — two strategy selectors, shared rolls/bankroll/seed, seed written to URL after run.

Four sections:
1. **Head-to-head timeline** (`ComparisonChart.tsx`) — two bankroll lines (A=blue, B=orange), shared X axis, buy-in reference line
2. **Side-by-side summary** — two `SummaryPanel` instances, color-coded headers, net delta prominent
3. **Dice verification** — "Both strategies saw identical dice ✓", first 5 roll values, collapsible
4. **Stage comparison** — `StageBreakdown` for any strategy with `stageName` data

---

### M5b — Distribution Compare [DONE]

**Question:** How does this strategy's variance profile differ from that one's?

**Page:** `/distribution-compare?strategy=CATS&test=ThreePointMolly3X&rolls=500&bankroll=300&seeds=500`

**URL params:** `strategy` = baseline, `test` = challenger.

#### M5b.1 — Server: dual distribution SSE endpoint [DONE]

`server/routes/distribution-compare.ts` — `GET /api/distribution-compare/stream`. Uses `SharedTable` per seed — both strategies see identical dice in each session. Emits `baseline` and `test` aggregates together every 10% of seeds.

#### M5b.2 — Client: dual distribution hook [DONE]

`web/src/hooks/useDistributionCompare.ts` — SSE hook returning `{ baseline, test, progress, done }`.

#### M5b.3 — Distribution Compare page [DONE]

`web/src/pages/DistributionComparePage.tsx`

- **`DistributionCompareChart.tsx`** — baseline: solid lines + shaded P10–P90 fill; test: dashed lines, no fill. Divergence readable where dashed lines exit the shaded region.
- **`OutcomeDelta.tsx`** — single delta table: Stat | Baseline | Test | Delta. Green = test better, red = baseline better. Signs flip correctly after swap.
- **Swap button** — exchanges `strategy` and `test` URL params, triggers re-stream.

### M5 Review [DONE]

- [x] `/compare` fully gone — no orphaned references
- [x] Nav: Session | Session Compare | Distribution | Distribution Compare
- [x] `RunControls` page-aware on all four routes
- [x] `DistributionCompareChart` solid+fill vs. dashed+no-fill visually unambiguous
- [x] Delta table sign convention correct; reads correctly after swap
- [x] `SharedTable` used per seed in M5b
- [x] SSE closes cleanly on unmount
- [x] `npm test` passes

### M5 Demo [DONE]

`demo/web-compare.md`

```bash
open "http://localhost:5173/session-compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7"
open "http://localhost:5173/distribution-compare?strategy=CATS&test=ThreePointMolly3X&rolls=500&bankroll=300&seeds=500"
```

---

## Milestone 6 — Tail Analysis Loader [DONE]

**Theme:** Import large CLI-generated datasets for P95/P99 tail visualization. CLI runs take minutes — results load into the web UI via `FileReader`, no server round-trip.

### M6.0 — CLI output format [DONE]

```bash
npx ts-node src/cli/run-sim.ts \
  --strategy CATS --rolls 500 --bankroll 300 \
  --seeds 10000 --output distribution \
  > analysis/cats-10k.distribution.json
```

Output type extends `DistributionAggregates` with `p95`, `p99`, `seedCount`, `generatedAt`, `params`. Distribution JSON files in `.gitignore` (`*.distribution.json`); `analysis/` dir for intentional committed results via `.gitignore` exception.

### M6.1 — Web UI: file loader [DONE]

"Load file" button on `/distribution` page. `FileReader` client-side. When loaded: band chart gains P95/P99 lines, outcome summary gains P95/P99 stats, page header shows filename and seed count.
