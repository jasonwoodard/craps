# Craps Simulator — Web UI Implementation Plan

**Date:** March 2026  
**Status:** Draft v1.4  
**Scope:** Visualization layer — engine changes are minimal and surgical (M0 only)

---

## Purpose

Add a web UI to the craps simulator that transforms structured simulation output into an analytical dashboard. The UI makes the mathematical behavior of craps strategies visible and internalize-able — the kind of insight a player would want before standing at a table.

This document follows the same milestone structure as `docs/implementation-plan.md`. Each milestone ends with a working, demonstrable result.

---

## Guiding Principles

**Minimal engine surface.** M0 makes two surgical changes to `src/`: add `stageName` to `RollRecord`, and create a shared `types/` re-export. Everything else in `src/` is untouched forever.

**The CLI stays.** `src/cli/run-sim.ts` continues to work independently. The Express server is a separate entry point.

**Reuse existing types.** `RollRecord`, `EngineResult`, and `SharedTableResult` are the API contract. No translation layer.

**UI code can become a hot tangled mess.** Each milestone that introduces new UI complexity begins with an assessment task before any implementation. This is a first-class deliverable, not overhead.

---

## Page Map

| Page | URL | Theme |
|---|---|---|
| Session Detail | `/session` | Single run — what happened |
| Distribution | `/distribution` | Monte Carlo — what typically happens |
| Compare | `/compare` | Same-table head-to-head — strategy vs. strategy |

---

## Architecture

### Directory structure

```
craps/
├── src/                        ← minimal changes in M0 only
│   ├── engine/
│   │   └── roll-record.ts      ← add stageName?: string (M0)
│   ├── dsl/
│   ├── cli/
│   ├── bets/
│   ├── dice/
│   └── logger/
├── types/                      ← new in M0: shared type re-exports
│   └── simulation.ts
├── server/                     ← new in M1
│   ├── server.ts
│   ├── lib/
│   │   └── distribution.ts     ← computeAggregates, summarize (M4)
│   └── routes/
│       ├── simulate.ts
│       ├── strategies.ts
│       ├── distribution.ts     ← SSE stream endpoint (M4)
│       └── compare.ts          ← SharedTable endpoint (M5)
├── web/                        ← new in M1
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/
│       │   ├── stats.ts
│       │   ├── stages.ts
│       │   └── cats-thresholds.ts
│       ├── components/
│       │   ├── Shell.tsx
│       │   ├── RunControls.tsx
│       │   ├── SummaryPanel.tsx
│       │   ├── SessionChart.tsx
│       │   ├── StageBreakdown.tsx
│       │   ├── StageOverlayChart.tsx
│       │   ├── TrendPanel.tsx
│       │   ├── BandChart.tsx         ← M4
│       │   ├── OutcomeSummary.tsx    ← M4
│       │   ├── RuinCurve.tsx         ← M4
│       │   └── ComparisonChart.tsx   ← M5
│       ├── pages/
│       │   ├── SessionPage.tsx
│       │   ├── DistributionPage.tsx
│       │   └── ComparePage.tsx
│       └── hooks/
│           ├── useSimulation.ts
│           ├── useDistribution.ts    ← M4
│           └── useComparison.ts      ← M5
├── docs/
├── spec/
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

### `POST /api/simulate`

```typescript
// Request
{ strategy: string; rolls: number; bankroll: number; seed?: number; }

// Response — EngineResult plus echoed seed
{ ...EngineResult, seed: number }
```

Seed is always present in response — generated server-side if not provided.

### `GET /api/strategies`

Returns `string[]` — keys of `BUILT_IN_STRATEGIES`.

### `GET /api/distribution/stream` *(M4)*

SSE stream. Query params: `strategy`, `seeds`, `rolls`, `bankroll`.

Emits a JSON event every 10% of seeds completed:
```typescript
{
  progress: number;          // 0.0 → 1.0
  completed: number;         // seeds done so far
  aggregates: DistributionAggregates;
  done: boolean;
}
```

### `POST /api/compare` *(M5)*

```typescript
// Request
{ strategies: string[]; rolls: number; bankroll: number; seed?: number; }

// Response
{ results: SharedTableResult; seed: number; }
```

---

## Milestone 0 — Core Refactor [DONE]

**Goal:** Two surgical changes to `src/`. All existing tests remain green. CLI unchanged.

### M0.1 — Add `stageName` to `RollRecord` [DONE]

`src/engine/roll-record.ts` — add `stageName?: string`. `src/engine/craps-engine.ts` and `src/engine/shared-table.ts` — populate from Stage Machine runtime after `postRoll`. Slots without a Stage Machine strategy produce `undefined` naturally.

**Acceptance criteria:**
- `npm test` passes
- CATS `--output json` shows `stageName` on roll entries
- PassLineOnly shows `stageName` genuinely absent
- SharedTable CATS vs. ThreePointMolly3X: `stageName` on CATS, absent on ThreePointMolly3X

### M0.2 — Shared type re-exports [DONE]

**New file:** `types/simulation.ts`
```typescript
export type { RollRecord, EngineResult, ActiveBetInfo } from '../src/engine/roll-record';
export type { Outcome } from '../src/dsl/outcome';
```

### M0 Review [DONE]

- [x] `stageName` populated correctly for CATS
- [x] `stageName` absent for PassLineOnly — not as `"undefined"` string
- [x] `types/simulation.ts` compiles without error
- [x] `npm test` passes, CLI unchanged

### M0 Demo [DONE]

```bash
npx ts-node src/cli/run-sim.ts --strategy CATS --rolls 50 --bankroll 300 --seed 42 --output json | head -20
npx ts-node src/cli/run-sim.ts --strategy PassLineOnly --rolls 20 --bankroll 300 --seed 42 --output json | head -5
```

---

## Milestone 1 — MVP Web UI [DONE]

**Goal:** Working browser page rendering a pre-configured simulation run. No user controls.

**Hardcoded run:** `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 42 }` — final bankroll $6.

### M1.1 — Express server scaffold [DONE]

`server/server.ts` — Express app, CORS, JSON middleware. `POST /api/simulate`, `GET /api/strategies`. `"server": "ts-node server/server.ts"` in root `package.json`.

### M1.2 — React + Vite scaffold [DONE]

`web/` — Vite + React + TypeScript + Recharts + Tailwind. API proxy to port 3001. Path alias `@types` → `../types`.

### M1.3 — `useSimulation` hook [DONE]

Returns `{ data: EngineResult | null, loading: boolean, error: string | null }`. Handles non-200 responses explicitly.

### M1.4 — Summary stats panel [DONE]

`web/src/lib/stats.ts` — `computeSessionStats()`. Single location for all derived stat computation.

`web/src/components/SummaryPanel.tsx` — card grid, net change color-coded.

### M1.5 — Session chart [DONE]

`web/src/components/SessionChart.tsx` — dual-axis `ComposedChart`. Bankroll line (left), table load line in orange (right), buy-in reference line, 7-out and point-made event markers. No `stageName` logic.

### M1.6 — Milestone 1 integration [DONE]

`App.tsx` wired with hardcoded params. Self-verification: final bankroll `$6` for seed 42.

### M1 Review [DONE]

- [x] `computeSessionStats` is single location for all stat computation
- [x] `useSimulation` handles non-200 responses
- [x] Express port in one place, returns 400 for unknown strategies
- [x] No `console.log` in production paths
- [x] Dual Y axis scales independent
- [x] `SessionChart` does not reference `stageName`
- [x] `npm test` passes

### M1 Demo [DONE]

`demo/web-session-view.md` — self-verification: final bankroll `$6` for seed 42.

---

## Milestone 2 — Stage Deep Dive

**Theme:** Four scrollable analytical sections making CATS stage structure visible and explorable.

**Hardcoded run for M2:** `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 7 }` — peak $834, 65 stage visits.

### M2.0 — Assessment [DONE — resolved conversationally]

| Question | Resolution |
|---|---|
| Stage bands vs. event lines | Not mutually exclusive — `ReferenceArea` behind, event lines on top |
| Stage transition vertical markers | Tried and removed — too dense. Table load line sufficient |
| Stage filter dropdown | Deferred — overlay chart is the better answer |
| Stage overlay Y axis | Relative ±$ from stage entry bankroll |
| Rolling trend window | 24 rolls |
| Dashboard layout | Scrollable sections, additive |

### M2.1 — Section 1: Stage color bands on timeline [DONE]

`web/src/lib/stages.ts` — `computeStageSpans()`, `hasStageData()`, stage color palette. `SessionChart` gains background `ReferenceArea` bands. No vertical transition markers.

### M2.2 — Section 2: Stage breakdown table [DONE]

`web/src/components/StageBreakdown.tsx` — time-ordered table, one row per stage visit. Columns: `#` (global sequential), Stage, Roll Range, Rolls, Entry, Exit, Net P&L, Peak, Trough, 7-outs. `hasStageData()` guard.

`StageVisitSummary` in `stages.ts` includes `globalIndex` and `startRoll`/`endRoll`.

### M2.3 — Section 3: Stage overlay chart

**New component:** `web/src/components/StageOverlayChart.tsx`

One chart per distinct stage visited. All visits aligned to T0. Y axis: relative ±$ from stage entry. Zero reference line at entry. Longest visit sets X domain.

**Data transformation** (add to `stages.ts`):

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

Heading per chart: `"Accumulator Regressed — 21 visits"`. Tight cluster = consistent behavior. Wide fan = high variance.

**Acceptance test:** Seed 7 renders one chart per visited stage with multiple labeled lines. Seed 42 renders without error.

### M2.4 — Section 4: Trend indicators

**New component:** `web/src/components/TrendPanel.tsx`

Three signals — context for judgment, not prediction.

**Signal 1: 24-roll rolling P&L**
```typescript
// stats.ts
export function computeRollingPnL(rolls: RollRecord[], window?: number): number[]
```

**Signal 2: CATS threshold proximity**
```typescript
// web/src/lib/cats-thresholds.ts
export function computeCATSThresholdProximity(rolls: RollRecord[]): ThresholdProximity[]
export function isCATSStrategy(strategyName: string): boolean
```

CATS thresholds: `accumulatorRegressed` step-up +$70; `littleMolly` step-up +$150 / step-down +$70; `threePtMollyTight` step-up +$200 / step-down +$150; `threePtMollyLoose` step-up +$250 / step-down +$150. `isCATSStrategy()` guard — renders nothing for non-CATS.

**Signal 3: Consecutive 7-out counter**
```typescript
// stats.ts — derived from RollRecord, no engine changes
export function computeConsecutiveSevenOuts(rolls: RollRecord[]): number[]
```
Bar chart. `ReferenceLine` at y=2 marks the CATS step-down trigger.

**Acceptance test:** Seed 7 renders all three panels. Seed 42 and PassLineOnly render without error.

### M2 Review

- [ ] All stage transformations in `stages.ts` — no stage logic in components
- [ ] CATS threshold logic isolated in `cats-thresholds.ts`
- [ ] `hasStageData()` guard in all M2 components
- [ ] `isCATSStrategy()` guard in `TrendPanel`
- [ ] Stage color palette defined once in `stages.ts`
- [ ] `StageOverlayChart` Y axis always relative ±$
- [ ] `computeConsecutiveSevenOuts` derived from `RollRecord` only
- [ ] Seed 7 and seed 42 both render without error
- [ ] No M1 regressions, `npm test` passes

### M2 Demo

`demo/web-stage-deep-dive.md` — seed 7. Scroll all four sections. Cross-check seed 42.

---

## Milestone 3 — App Shell and Interactive Controls

**Theme:** Multi-page application with collapsible sidebar, React Router routing, URL-driven simulation params. Every run is a URL.

**Re-run vs. cache:** Re-run on request. Sub-100ms simulations. URL is the cache for fixed seeds.

### M3.0 — Assessment [DONE — resolved conversationally]

| Question | Decision |
|---|---|
| Routing | `react-router-dom` — industry standard |
| Layout | Collapsible left sidebar, expanded (240px) by default, collapses to 48px icon rail |
| URL schema | `/session`, `/distribution`, `/compare` with defined param schemas |
| Loading state | Spinner overlay — no clear-and-reload |
| Seed UX | Always written to URL after run. Clear field for new random run |

**URL schema:**
```
/session?strategy=CATS&rolls=500&bankroll=300&seed=7
/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500
/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7
```

Defaults when absent: `strategy=CATS`, `rolls=500`, `bankroll=300`, seed generated and written back.

### M3.1 — Install React Router and define routes

```bash
cd web && npm install react-router-dom
```

`main.tsx` — wrap in `BrowserRouter`. `App.tsx` — `Routes` with `/`, `/session`, `/distribution`, `/compare`. `/` redirects to `/session`. `/distribution` and `/compare` are stubs in M3.

### M3.2 — App shell: collapsible sidebar layout

**New component:** `web/src/components/Shell.tsx`

Top nav bar (app name + nav links via `NavLink`). Left sidebar (collapsible, `useState`, contains `RunControls`). Main content area (`children`). Collapse state is local — not in URL.

### M3.3 — Run controls form

**New component:** `web/src/components/RunControls.tsx`

Form state only — no API calls. Strategy dropdown (from `GET /api/strategies`, called once), rolls, bankroll, seed inputs. Run button navigates to `/session?...`. Seed empty = omit from URL; written back after run completes.

### M3.4 — Session page with URL params

**New file:** `web/src/pages/SessionPage.tsx`

Reads params from `useSearchParams`. Calls `useSimulation`. After run, writes generated seed to URL via `navigate(..., { replace: true })`. Renders full M2 dashboard: `SummaryPanel`, `SessionChart`, `StageBreakdown`, `StageOverlayChart`, `TrendPanel`.

**`server/routes/simulate.ts` addition:** Generate seed if not provided, echo in response:
```typescript
const seed = body.seed ?? Math.floor(Math.random() * 1_000_000);
return res.json({ ...result, seed });
```

**Acceptance test:** `/session?strategy=CATS&rolls=500&bankroll=300&seed=7` → final bankroll `$322`.

### M3.5 — Stub pages

`web/src/pages/DistributionPage.tsx`, `web/src/pages/ComparePage.tsx` — heading + "Coming soon". Confirm routing works.

### M3 Review

- [ ] `RunControls` — form state only, no API calls
- [ ] `SessionPage` owns the API call
- [ ] Seed always in URL after completed run
- [ ] Browser back/forward navigates between runs
- [ ] Sidebar collapse state is local `useState`
- [ ] `GET /api/strategies` called once in `RunControls`
- [ ] All M2 components render correctly in `SessionPage`
- [ ] `npm test` passes

### M3 Demo

`demo/web-app-shell.md` — nav, sidebar collapse, run controls, seed reproducibility, browser back, direct URL `/session?strategy=CATS&rolls=500&bankroll=300&seed=7` → `$322`.

---

## Milestone 4 — Distribution Analysis

**Theme:** Monte Carlo analysis of a single strategy across N seeds. Streaming results via SSE. Answers "what typically happens" rather than "what happened on this run."

**Page:** `/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500`

**Seed presets:** Quick (200) | Standard (500) | Deep (1000). Tail analysis (P95/P99) is CLI-only — M6 handles loading those results into the UI.

**The sizzle:** Band chart updates as seeds stream in. Watching P10/P50/P90 lines converge from noisy to stable makes statistical convergence visible.

### M4.0 — Assessment [DONE — resolved conversationally]

| Question | Decision |
|---|---|
| Streaming architecture | SSE via `GET /api/distribution/stream` |
| Seed presets | Quick: 200, Standard: 500, Deep: 1000 |
| Tail analysis | CLI-only (M6 handles web loading) |
| Polling fallback | Not implemented |

### M4.1 — Server: SSE distribution endpoint

**New file:** `server/routes/distribution.ts`

`GET /api/distribution/stream` — runs N `CrapsEngine` sessions sequentially, emits aggregated results every 10% of seeds.

**New file:** `server/lib/distribution.ts`

`computeAggregates(results: SessionSummary[]): DistributionAggregates` and `summarize(result: EngineResult, seed: number): SessionSummary`. Computation here — not inline in the route handler.

```typescript
interface DistributionAggregates {
  p10: number[];           // bankroll at each roll index, P10 across seeds
  p50: number[];
  p90: number[];
  finalBankroll: { p10: number; p50: number; p90: number; mean: number };
  peakBankroll:  { p10: number; p50: number; p90: number; mean: number };
  rollsToPeak:   { p10: number; p50: number; p90: number; mean: number };
  ruinByRoll:    number[];   // P(ruin) at each roll index
  winRate:       number;     // sessions ending above buy-in
  ruinRate:      number;     // sessions reaching $0
  seedCount:     number;
}
```

Raw `RollRecord[]` for all sessions never leaves the server — aggregated only.

**Acceptance test:** `curl "http://localhost:3001/api/distribution/stream?strategy=CATS&seeds=50&rolls=500&bankroll=300"` streams ~6 SSE events and closes.

### M4.2 — Client: SSE hook

**New file:** `web/src/hooks/useDistribution.ts`

`EventSource` connecting to `/api/distribution/stream`. Updates `aggregates` and `progress` on each message. Closes connection on `done: true` or component unmount.

```typescript
export function useDistribution(params: DistributionParams) {
  // returns { aggregates, progress, done }
}
```

### M4.3 — Distribution page layout

**New file:** `web/src/pages/DistributionPage.tsx` (replaces M3.5 stub)

**Section 1 — Controls and progress**

Seed preset buttons: Quick | Standard | Deep. Clicking updates URL and restarts stream. Progress bar showing seeds completed / total.

**Section 2 — Bankroll band chart**

**New component:** `web/src/components/BandChart.tsx`

Three lines: P10, P50, P90 bankroll over roll number. Buy-in reference line. Updates on each SSE message — this is the headline visual.

**Section 3 — Session outcome summary**

**New component:** `web/src/components/OutcomeSummary.tsx`

Stat cards updating as seeds stream: median final bankroll, win rate, ruin rate, median peak, median roll to peak, P10/P90 final bankroll.

**Section 4 — Ruin probability curve**

**New component:** `web/src/components/RuinCurve.tsx`

X axis: roll number. Y axis: P(ruin). Single rising line. Shows *when* ruin typically happens across the session length.

### M4.4 — Update nav

Shell nav: Session | Distribution | Compare.

### M4 Review

- [ ] SSE connection closes cleanly on unmount
- [ ] Aggregates computed server-side — no raw roll arrays to client
- [ ] Band chart updates smoothly on each SSE message
- [ ] Progress bar accurately reflects seed completion
- [ ] Seed preset buttons update URL and restart stream
- [ ] `computeAggregates` in `server/lib/distribution.ts` — not inline in route
- [ ] `useDistribution` cleans up `EventSource` on unmount
- [ ] Page degrades gracefully if SSE connection drops
- [ ] `npm test` passes

### M4 Demo

`demo/web-distribution.md`

```bash
open "http://localhost:5173/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500"
```

Verify: progress bar updates, band chart stabilizes visibly, ruin curve appears. Switch to ThreePointMolly3X — different band shape. Compare Quick vs. Deep — noisier vs. stable final result.

---

## Milestone 5 — Strategy Comparison

**Theme:** Same-table head-to-head. Two strategies, identical dice. Controlled experiment — luck held constant, strategy is the variable.

**Page:** `/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7`

**Cognitive sweet spot:** Two strategies only. Two lines on one chart — immediately readable.

### M5.0 — Assessment [DONE — resolved conversationally]

| Question | Decision |
|---|---|
| Max strategies | 2 |
| Dice control | `SharedTable` — single dice sequence |
| Seed behavior | Fixed for reproducibility; random written to URL after run |
| Output | Single-session (fast, deterministic) |
| Monte Carlo comparison | Future enhancement |

### M5.1 — Server: compare endpoint

**New file:** `server/routes/compare.ts`

`POST /api/compare` — wraps `SharedTable`. Generates seed if not provided, echoes in response.

### M5.2 — Client: compare hook

**New file:** `web/src/hooks/useComparison.ts`

Calls `POST /api/compare`. Returns `{ data: SharedTableResult | null, loading, error }`. No SSE — comparison runs are fast.

### M5.3 — Compare page layout

**New file:** `web/src/pages/ComparePage.tsx` (replaces M3.5 stub)

Two strategy selectors in sidebar (Strategy A, Strategy B). Shared rolls/bankroll/seed controls.

**Section 1 — Head-to-head timeline**

**New component:** `web/src/components/ComparisonChart.tsx`

Single `ComposedChart`. Two bankroll lines, color-coded by strategy. Shared X axis — identical dice. Buy-in reference line. Legend.

**Section 2 — Side-by-side summary**

Two `SummaryPanel` instances side by side. Net change delta between strategies shown prominently.

**Section 3 — Dice verification**

Confirmation panel: "Both strategies saw identical dice ✓". Shows first 5 roll values from each strategy's log. Collapses after confirming.

**Section 4 — Stage comparison**

If either strategy has `stageName` data, shows its `StageBreakdown` alongside the other strategy's plain session stats. Makes CATS's structural behavior visible against a flat strategy on the same dice.

**Acceptance test:** `/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7` renders two bankroll lines. Dice verification shows ✓. Side-by-side summary correct.

### M5.4 — Update nav

Nav finalized: Session | Distribution | Compare.

### M5 Review

- [ ] `useComparison` handles strategy array — not hardcoded to 2
- [ ] Dice verification confirms roll identity, not just seed identity
- [ ] Side-by-side panels visually balanced at 1280px
- [ ] Stage comparison renders nothing when neither strategy has `stageName`
- [ ] Seed written to URL after random run
- [ ] `npm test` passes

### M5 Demo

`demo/web-compare.md`

```bash
open "http://localhost:5173/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7"
```

Verify: two lines on identical dice, dice verification ✓, CATS stage breakdown visible alongside ThreePointMolly3X flat play. Try seed 42 — both grind a bad session.

---

## Milestone 6 — Tail Analysis Loader

**Theme:** Import large CLI-generated datasets into the web UI for P95/P99 tail visualization. Heavy computation stays in the CLI; interactive exploration stays in the web UI.

**Why CLI for tails:** 10,000-seed runs take minutes — appropriate for a background job, not an interactive stream. The web UI loads pre-computed results.

### M6.0 — CLI output format for tail analysis

New CLI flag `--seeds N --output distribution` produces a `.distribution.json` file:

```bash
npx ts-node src/cli/run-sim.ts \
  --strategy CATS --rolls 500 --bankroll 300 \
  --seeds 10000 --output distribution \
  > cats-10k.distribution.json
```

Output shape extends `DistributionAggregates` with P95/P99:

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

### M6.1 — Web UI: distribution file loader

"Load file" button on `/distribution` page alongside seed preset buttons. Accepts `.distribution.json`. Reads client-side via `FileReader` — no server round-trip needed (already aggregated).

When loaded: band chart gains P95/P99 lines. Outcome summary gains P95/P99 stats. Page header shows "Loaded: cats-10k.distribution.json (10,000 seeds)".

### M6 Review / M6 Demo

*Defined when M6 is implemented.*

Key acceptance test: 10,000-seed CLI run loaded into web UI shows stable P95/P99 bands that the 500-seed streaming run cannot produce.

---

## Milestone 7 — Polish and Hardening

*Placeholder for cross-cutting concerns deferred from M3–M6: error boundaries, mobile layout, performance tuning for large datasets, UX rough edges identified during use.*

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
| URL schema | `/session`, `/distribution`, `/compare` with defined param schemas |
| Loading state | Spinner overlay — no clear-and-reload |
| Seed UX | Always written to URL after run. Clear field for new random run |
| Distribution streaming | SSE via `GET /api/distribution/stream` |
| Seed presets | Quick: 200, Standard: 500, Deep: 1000 |
| Tail analysis | CLI-only for P95/P99. M6 loads results into web UI |
| Comparison strategies | 2 max — cognitive and visual sweet spot |
| Comparison mode | `SharedTable` — identical dice, controlled experiment |

---

## New Files Summary

| File | Milestone | Purpose |
|---|---|---|
| `src/engine/roll-record.ts` | M0.1 | Add `stageName?: string` |
| `src/engine/craps-engine.ts` | M0.1 | Populate `stageName` from Stage Machine runtime |
| `src/engine/shared-table.ts` | M0.1 | Populate `stageName` per player slot |
| `types/simulation.ts` | M0.2 | Shared type re-exports |
| `server/server.ts` | M1.1 | Express entry point |
| `server/routes/simulate.ts` | M1.1 | POST /api/simulate (M3.4: add seed echo) |
| `server/routes/strategies.ts` | M1.1 | GET /api/strategies |
| `server/routes/distribution.ts` | M4.1 | GET /api/distribution/stream (SSE) |
| `server/routes/compare.ts` | M5.1 | POST /api/compare |
| `server/lib/distribution.ts` | M4.1 | computeAggregates, summarize |
| `web/package.json` | M1.2 | Frontend package |
| `web/vite.config.ts` | M1.2 | Vite config with API proxy and path alias |
| `web/tsconfig.json` | M1.2 | TypeScript config with path alias |
| `web/src/main.tsx` | M3.1 | BrowserRouter wrapper |
| `web/src/App.tsx` | M1.6 → M3.1 | Root component → route definitions |
| `web/src/lib/stats.ts` | M1.4 | computeSessionStats, rolling P&L, consecutive 7-outs |
| `web/src/lib/stages.ts` | M2.1 | Stage spans, visit normalization, color palette |
| `web/src/lib/cats-thresholds.ts` | M2.4 | CATS threshold proximity logic |
| `web/src/hooks/useSimulation.ts` | M1.3 | Single-run data fetching hook |
| `web/src/hooks/useDistribution.ts` | M4.2 | SSE distribution hook |
| `web/src/hooks/useComparison.ts` | M5.2 | Comparison data fetching hook |
| `web/src/components/Shell.tsx` | M3.2 | App layout — top nav + collapsible sidebar |
| `web/src/components/RunControls.tsx` | M3.3 | Simulation params form |
| `web/src/components/SummaryPanel.tsx` | M1.4 | Stats card grid |
| `web/src/components/SessionChart.tsx` | M1.5 | Dual-axis chart with stage color banding |
| `web/src/components/StageBreakdown.tsx` | M2.2 | Stage visit summary table |
| `web/src/components/StageOverlayChart.tsx` | M2.3 | T0-normalized stage overlay charts |
| `web/src/components/TrendPanel.tsx` | M2.4 | Rolling P&L, threshold proximity, 7-out counter |
| `web/src/components/BandChart.tsx` | M4.3 | P10/P50/P90 bankroll band chart |
| `web/src/components/OutcomeSummary.tsx` | M4.3 | Session outcome stat cards |
| `web/src/components/RuinCurve.tsx` | M4.3 | P(ruin) over roll number |
| `web/src/components/ComparisonChart.tsx` | M5.3 | Two-strategy bankroll overlay |
| `web/src/pages/SessionPage.tsx` | M3.4 | Session detail page (URL-driven) |
| `web/src/pages/DistributionPage.tsx` | M3.5 → M4.3 | Distribution analysis page |
| `web/src/pages/ComparePage.tsx` | M3.5 → M5.3 | Strategy comparison page |
| `demo/web-session-view.md` | M1 Demo | M1 local dev instructions |
| `demo/web-stage-deep-dive.md` | M2 Demo | M2 local dev instructions |
| `demo/web-app-shell.md` | M3 Demo | M3 local dev instructions |
| `demo/web-distribution.md` | M4 Demo | M4 local dev instructions |
| `demo/web-compare.md` | M5 Demo | M5 local dev instructions |
