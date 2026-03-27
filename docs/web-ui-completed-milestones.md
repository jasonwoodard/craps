# Craps Simulator — Web UI Completed Milestones

**Date:** March 2026  
**Purpose:** Archive of completed milestone specifications. The active implementation plan is `docs/web-ui-implementation-plan.md`.

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

`SessionChart` gains background `ReferenceArea` bands from `stageName`. Bands at 15% opacity behind all existing elements. No vertical transition markers — removed after implementation as too dense.

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

**What the table revealed on seed 7:** 65 rows. Little Molly visits are almost all 1–2 rolls before stepping back down. Accumulator Regressed visit 21 (rows 105–165) is 61 rolls alone. The roll range column makes temporal patterns immediately legible.

### M2.3 — Section 3: Stage overlay chart [DONE]

`web/src/components/StageOverlayChart.tsx` — one chart per distinct stage visited. All visits aligned to T0. Y axis: relative ±$ from stage entry bankroll. Zero reference line. Longest visit sets X domain.

`stages.ts` additions:
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

**Analytic value:** Multiple visits to the same stage overlaid at T0 reveal whether stage behavior is consistent or highly variable — a question that summary statistics cannot answer.

### M2.4 — Section 4: Trend indicators [DONE]

`web/src/components/TrendPanel.tsx` — three signals describing what has happened recently, not predictions.

**Signal 1: 24-roll rolling P&L**
`computeRollingPnL(rolls, window?)` added to `stats.ts`. Line chart with zero reference.

**Signal 2: CATS threshold proximity**
`web/src/lib/cats-thresholds.ts` — `computeCATSThresholdProximity()`, `isCATSStrategy()`. CATS-specific logic isolated here, never in general utilities. `isCATSStrategy()` guard — renders nothing for non-CATS strategies.

Thresholds: `accumulatorRegressed` step-up +$70; `littleMolly` step-up +$150 / step-down +$70; `threePtMollyTight` step-up +$200 / step-down +$150; `threePtMollyLoose` step-up +$250 / step-down +$150.

**Signal 3: Consecutive 7-out counter**
`computeConsecutiveSevenOuts()` added to `stats.ts` — derived from `RollRecord` fields, no engine changes. Bar chart with `ReferenceLine` at y=2 marking the CATS step-down trigger.

### M2 Review [DONE]

- [x] All stage transformations in `stages.ts` — no stage logic in components
- [x] CATS threshold logic isolated in `cats-thresholds.ts`
- [x] `hasStageData()` guard in all M2 components
- [x] `isCATSStrategy()` guard in `TrendPanel`
- [x] Stage color palette defined once in `stages.ts`
- [x] `StageOverlayChart` Y axis always relative ±$
- [x] `computeConsecutiveSevenOuts` derived from `RollRecord` only — no engine changes
- [x] Seed 7 and seed 42 both render without error
- [x] No M1 regressions
- [x] `npm test` passes

### M2 Demo [DONE]

`demo/web-stage-deep-dive.md` — seed 7. All four sections verified. Seed 42 cross-check confirms graceful degradation.

---

## Milestone 3 — App Shell and Interactive Controls [DONE]

**Theme:** Multi-page application with collapsible sidebar, React Router routing, URL-driven simulation params. Every run is a URL — bookmarkable, shareable, browser-back-compatible.

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

### M3.1 — React Router and routes [DONE]

`react-router-dom` installed. `main.tsx` wrapped in `BrowserRouter`. `App.tsx` defines routes: `/` → redirect to `/session`, `/session`, `/distribution`, `/compare`.

### M3.2 — App shell [DONE]

`web/src/components/Shell.tsx` — top nav bar with `NavLink` components, collapsible left sidebar (`useState`, not URL state), main content area. Sidebar contains `RunControls`. Collapse state local only.

### M3.3 — Run controls form [DONE]

`web/src/components/RunControls.tsx` — form state only, no API calls. Strategy dropdown (from `GET /api/strategies`, called once on mount), rolls, bankroll, seed inputs. Run navigates to `/session?...`. Seed omitted from URL if empty — written back after run completes.

### M3.4 — Session page with URL params [DONE]

`web/src/pages/SessionPage.tsx` — reads params from `useSearchParams`. Calls `useSimulation`. After run, writes generated seed to URL via `navigate(..., { replace: true })`. Renders full M2 dashboard.

`server/routes/simulate.ts` updated — generates seed if not provided, echoes in response:
```typescript
const seed = body.seed ?? Math.floor(Math.random() * 1_000_000);
return res.json({ ...result, seed });
```

### M3.5 — Stub pages [DONE]

`web/src/pages/DistributionPage.tsx` and `web/src/pages/ComparePage.tsx` — stubs replaced by full implementations in M4 and M5.

### M3 Review [DONE]

- [x] `RunControls` — form state only, no API calls
- [x] `SessionPage` owns the API call
- [x] Seed always in URL after completed run
- [x] Browser back/forward navigates between runs
- [x] Sidebar collapse state is local `useState`
- [x] `GET /api/strategies` called once in `RunControls`
- [x] All M2 components render correctly in `SessionPage`
- [x] `npm test` passes

### M3 Demo [DONE]

`demo/web-app-shell.md` — nav, sidebar collapse, run controls, seed reproducibility, browser back. Self-verification: `/session?strategy=CATS&rolls=500&bankroll=300&seed=7` → final bankroll `$322`.
