# Craps Simulator — Web UI Implementation Plan

**Date:** March 2026  
**Status:** Draft v1.3  
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

**KISS on M1.** Get the visuals right before adding complexity. M1 renders a hardcoded simulation run with a summary panel and a time series chart. No stage logic beyond color banding. No user controls.

**UI code can become a hot tangled mess.** Each milestone that introduces new UI complexity begins with an assessment task before any implementation. This is a first-class deliverable, not overhead.

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
├── server/                     ← new in M1: Express API server
│   ├── server.ts
│   └── routes/
│       ├── simulate.ts
│       └── strategies.ts
├── web/                        ← new in M1: React frontend
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
│       │   └── TrendPanel.tsx
│       ├── pages/
│       │   ├── SessionPage.tsx
│       │   ├── AnalysisPage.tsx
│       │   └── ComparePage.tsx
│       └── hooks/
│           └── useSimulation.ts
├── docs/
├── spec/
└── package.json
```

### Request flow

```
Browser → Vite dev server (port 5173)
        → proxies /api/* → Express (port 3001)
                         → CrapsEngine (in-process)
                         → EngineResult (JSON)
        ← JSON response
        ← Recharts renders charts
```

---

## API Contract

### `POST /api/simulate`

**Request body:**
```typescript
{
  strategy: string;
  rolls: number;
  bankroll: number;
  seed?: number;         // omit for random — server generates and echoes back
}
```

**Response:** `EngineResult` plus the seed used:
```typescript
{
  ...EngineResult,
  seed: number;          // always present — generated if not provided
}
```

### `GET /api/strategies`

Returns `string[]` — keys of `BUILT_IN_STRATEGIES`.

---

## Milestone 0 — Core Refactor [DONE]

**Goal:** Two surgical changes to `src/` that the rest of the web milestones depend on. All existing tests remain green. CLI behavior is unchanged.

---

### M0.1 — Add `stageName` to `RollRecord` [DONE]

**File:** `src/engine/roll-record.ts`

```typescript
export interface RollRecord {
  // ... existing fields unchanged ...
  stageName?: string;   // populated by Stage Machine strategies; undefined for simple strategies
}
```

**Files:** `src/engine/craps-engine.ts` and `src/engine/shared-table.ts` — populate `stageName` from Stage Machine runtime after `postRoll`. Each player slot has its own runtime reference; slots without a Stage Machine strategy produce `undefined` naturally.

**The identity model:** `strategyName` lives in the result envelope. `stageName` on `RollRecord` tells the UI where in its lifecycle a Stage Machine strategy is on any given roll.

**Acceptance criteria:**
- `npm test` passes with zero failures
- CATS run with `--output json` shows `stageName` on roll entries
- PassLineOnly run shows `stageName` genuinely absent
- `SharedTable` comparison run with CATS vs. ThreePointMolly3X produces `stageName` on CATS slots and absent on ThreePointMolly3X slots

---

### M0.2 — Shared type re-exports [DONE]

**New file:** `types/simulation.ts`

```typescript
export type { RollRecord, EngineResult, ActiveBetInfo } from '../src/engine/roll-record';
export type { Outcome } from '../src/dsl/outcome';
```

---

### M0 Review [DONE]

- [x] `stageName` populated correctly for CATS
- [x] `stageName` absent for PassLineOnly — not present as `"undefined"` string
- [x] `types/simulation.ts` compiles without error
- [x] Zero CLI behavior changes — `npm test` passes

---

### M0 Demo [DONE]

```bash
npx ts-node src/cli/run-sim.ts --strategy CATS --rolls 50 --bankroll 300 --seed 42 --output json | head -20
npx ts-node src/cli/run-sim.ts --strategy PassLineOnly --rolls 20 --bankroll 300 --seed 42 --output json | head -5
```

---

## Milestone 1 — MVP Web UI [DONE]

**Goal:** A working browser page rendering a pre-configured simulation run as a summary stats panel and time series chart. No user controls.

**Hardcoded run:** `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 42 }` — final bankroll $6.

---

### M1.1 — Express server scaffold [DONE]

Server at `server/server.ts`. Routes: `POST /api/simulate`, `GET /api/strategies`. Shares root `package.json`. `"server": "ts-node server/server.ts"` script in root.

---

### M1.2 — React + Vite scaffold [DONE]

`web/` directory. Vite + React + TypeScript. Recharts + Tailwind. API proxy to port 3001. Path alias `@types` → `../types`.

---

### M1.3 — `useSimulation` hook [DONE]

`web/src/hooks/useSimulation.ts` — calls `POST /api/simulate`, returns `{ data, loading, error }`. Handles non-200 responses explicitly.

---

### M1.4 — Summary stats panel [DONE]

`web/src/lib/stats.ts` — `computeSessionStats(result: EngineResult): SessionStats`. Single location for all derived stat computation.

`web/src/components/SummaryPanel.tsx` — card grid, net change color-coded green/red.

---

### M1.5 — Session chart [DONE]

`web/src/components/SessionChart.tsx` — dual-axis `ComposedChart`. Bankroll line (left axis), table load line in orange (right axis), buy-in reference line, 7-out and point-made event markers. No `stageName` logic in M1.

---

### M1.6 — Milestone 1 integration [DONE]

`App.tsx` wired with hardcoded params. Final bankroll matches CLI: `$300 → $6`.

---

### M1 Review [DONE]

- [x] `computeSessionStats` is single location for all derived stat computation
- [x] `useSimulation` handles non-200 responses explicitly
- [x] Express port defined in one place
- [x] Express returns 400 for unknown strategy names
- [x] No `console.log` in production paths
- [x] Dual Y axis scales independent
- [x] `SessionChart` does not reference `stageName`
- [x] `npm test` passes

---

### M1 Demo [DONE]

`demo/web-session-view.md` — self-verification: final bankroll `$6` for seed 42.

---

## Milestone 2 — Stage Deep Dive

**Theme:** Make CATS stage structure analytically visible and explorable across four scrollable dashboard sections.

**Hardcoded run for M2:** `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 7 }` — peak $834, 65 stage visits.

---

### M2.0 — Assessment [DONE — resolved conversationally]

| Question | Resolution |
|---|---|
| Stage bands vs. event lines | Not mutually exclusive — `ReferenceArea` behind, event lines on top |
| Stage transition vertical markers | Tried and removed — too dense. Table load line tells stage story implicitly |
| Stage filter dropdown | Deferred — overlay chart is the better answer |
| Stage overlay Y axis | Relative ±$ from stage entry bankroll |
| Rolling trend window | 24 rolls |
| Dashboard layout | Scrollable sections, additive |

---

### M2.1 — Section 1: Stage color bands on timeline [DONE]

`web/src/lib/stages.ts` — `computeStageSpans()`, `hasStageData()`. Stage color palette defined here.

`SessionChart` gains background `ReferenceArea` bands from `stageName`. No vertical markers — removed after implementation as too dense.

---

### M2.2 — Section 2: Stage breakdown table [DONE]

`web/src/components/StageBreakdown.tsx` — time-ordered table, one row per stage visit.

`StageVisitSummary` in `stages.ts` includes `globalIndex` (sequential row number) and `startRoll`/`endRoll` (roll range column). Net P&L color-coded. `hasStageData()` guard — renders nothing for simple strategies.

---

### M2.3 — Section 3: Stage overlay chart

**New component:** `web/src/components/StageOverlayChart.tsx`

One chart per distinct stage visited. Each overlays all visits aligned to T0. Y axis is relative ±$ from stage entry bankroll — absolute bankroll is meaningless across visits starting at different levels.

**Data transformation** (add to `stages.ts`):

```typescript
export interface NormalizedVisit {
  stageName: string;
  visitIndex: number;
  label: string;           // "Visit 1: Rolls 1–43"
  points: Array<{
    t: number;             // roll offset from stage entry
    pnl: number;           // bankrollAfter - entryBankroll
  }>;
}

export function normalizeStageVisits(rolls: RollRecord[], targetStage: string): NormalizedVisit[]
export function uniqueStages(rolls: RollRecord[]): string[]
```

**Chart structure:** `ComposedChart` with one `Line` per visit. Zero `ReferenceLine` at entry. Longest visit sets X domain — shorter visits end before right edge. Heading: `"Accumulator Regressed — 21 visits"`.

**Why this has analytic value:** Multiple visits to the same stage overlaid at T0 show whether stage behavior is consistent (tight cluster) or highly variable (wide fan). A summary statistic hides this. The table in M2.2 shows what happened; this chart shows whether it was typical.

**Acceptance test:** Seed 7 renders one chart per visited stage. Multiple Accumulator Regressed visits appear as distinct labeled lines. Y axis reads ±$. Seed 42 renders without error (fewer visits, graceful degradation).

---

### M2.4 — Section 4: Trend indicators

**New component:** `web/src/components/TrendPanel.tsx`

Three derived signals. Positioned below stage overlay charts. These describe what has happened recently — context for judgment, not predictions.

**Signal 1: 24-roll rolling P&L**

```typescript
// Add to stats.ts
export function computeRollingPnL(rolls: RollRecord[], window: number = 24): number[]
```

Line chart with zero reference. Shows momentum — the CATS consecutive 7-out rule is a discrete approximation of this signal.

**Signal 2: CATS threshold proximity**

```typescript
// New file: web/src/lib/cats-thresholds.ts
export function computeCATSThresholdProximity(rolls: RollRecord[]): ThresholdProximity[]
export function isCATSStrategy(strategyName: string): boolean
```

CATS thresholds by stage:

| Stage | Step-up at | Step-down at |
|---|---|---|
| `accumulatorRegressed` | +$70 | — |
| `littleMolly` | +$150 | +$70 |
| `threePtMollyTight` | +$200 | +$150 |
| `threePtMollyLoose` | +$250 | +$150 |

Two lines: distance to step-up, cushion above step-down. `isCATSStrategy()` guard — renders nothing for non-CATS strategies.

**Signal 3: Consecutive 7-out counter**

```typescript
// Add to stats.ts — derived from RollRecord, no engine changes
export function computeConsecutiveSevenOuts(rolls: RollRecord[]): number[]
```

Bar chart. `ReferenceLine` at y=2 marks the CATS step-down trigger.

**Acceptance test:** Seed 7 renders all three panels. Seed 42 renders without error. PassLineOnly renders nothing for threshold proximity panel.

---

### M2 Review

- [ ] All stage transformations in `stages.ts` — no stage logic in components
- [ ] CATS threshold logic isolated in `cats-thresholds.ts`
- [ ] `hasStageData()` guard in all M2 components
- [ ] `isCATSStrategy()` guard in `TrendPanel`
- [ ] Stage color palette defined once in `stages.ts`
- [ ] `StageOverlayChart` Y axis always relative ±$
- [ ] `computeConsecutiveSevenOuts` derived from `RollRecord` only — no engine changes
- [ ] Seed 7 and seed 42 both render without error
- [ ] No M1 regressions
- [ ] `npm test` passes

---

### M2 Demo

`demo/web-stage-deep-dive.md` — seed 7. Scroll through all four sections. Cross-check seed 42 for graceful degradation.

---

## Milestone 3 — App Shell and Interactive Controls

**Theme:** Transform the single hardcoded page into a navigable multi-page application. Introduce the collapsible sidebar, React Router routing, and URL-driven simulation params. Every run is a URL — bookmarkable, shareable, browser-back-compatible.

**Re-run vs. cache:** Re-run on request. Simulations are sub-100ms. The URL is the cache — the same URL with a fixed seed always produces the same result.

**Terminology:** "App shell" or "layout" — not "chrome" (conflicts with the browser name).

---

### M3.0 — Assessment [DONE — resolved conversationally]

| Question | Decision |
|---|---|
| Routing library | `react-router-dom` — industry standard, handles nested routes, `useSearchParams`, `useNavigate` cleanly. Manual `URLSearchParams` doesn't compose across multiple pages. |
| Layout | Collapsible left sidebar (expanded by default, collapses to 48px icon rail). Full vertical height available for charts. |
| URL schema | Defined below. Seed always written to URL after run. |
| Loading state | Spinner overlay on existing content — no clear-and-reload. Runs are fast enough that full skeleton screens add complexity without benefit. |
| Seed UX | Always written to URL after completed run. Clear the field for a new random run. Every completed run is reproducible by URL. |

**URL schema:**

```
/session?strategy=CATS&rolls=500&bankroll=300&seed=7
/analysis?strategy=CATS&rolls=500&bankroll=300&seeds=1000
/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7
```

Defaults when params absent: `strategy=CATS`, `rolls=500`, `bankroll=300`, `seed` generated randomly and written back.

---

### M3.1 — Install React Router and define routes

**New dependency:**
```bash
cd web && npm install react-router-dom
```

**`web/src/main.tsx`:**
```tsx
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

**`web/src/App.tsx`:**
```tsx
import { Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/session" replace />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </Shell>
  );
}
```

**Acceptance test:** `/session`, `/analysis`, `/compare` each render correct page without full reload. `/` redirects to `/session`.

---

### M3.2 — App shell: collapsible sidebar layout

**New component:** `web/src/components/Shell.tsx`

Persistent app frame. Top navigation bar + collapsible left sidebar + main content area.

**Top nav bar:**
- App name: "Craps Simulator"
- Nav links: Session | Analysis | Compare
- Active link highlighted via React Router `NavLink`

**Left sidebar:**
- Default: expanded (240px)
- Collapsed: icon rail (48px) — icons only, no labels
- Toggle button at sidebar bottom
- Contains `RunControls` — hidden when collapsed
- Collapse state is local UI state (`useState`) — not in URL

**Layout:**
```
┌─────────────────────────────────────────┐
│  Top nav bar (fixed)                    │
├────────┬────────────────────────────────┤
│        │                               │
│ Side-  │  Main content (scrollable)    │
│ bar    │                               │
│        │  <children />                 │
│        │                               │
└────────┴────────────────────────────────┘
```

**Acceptance test:** Sidebar collapses/expands. Nav links navigate without full reload. Layout holds at 1280px.

---

### M3.3 — Run controls form

**New component:** `web/src/components/RunControls.tsx`

Lives inside the sidebar. Manages form state only — no API calls. Submitting navigates to `/session?...` with updated params.

**Controls:**

| Control | Type | Default |
|---|---|---|
| Strategy | Dropdown | CATS |
| Rolls | Number input | 500 |
| Bankroll | Number input | 300 |
| Seed | Number input | (empty = random) |
| Run | Button | — |

**Submission behavior:**
1. Validate inputs
2. If seed empty: leave it out of the URL — server will generate and echo back
3. Navigate to `/session?strategy=X&rolls=N&bankroll=N` (seed added after run completes)

**Strategies dropdown** populated from `GET /api/strategies` — called once on mount, not on every render.

**`RunControls` is stateless with respect to simulation data.** Form state only.

**Acceptance test:** Clicking Run with valid inputs navigates to the correct `/session?...` URL. Invalid inputs show inline validation errors without navigating.

---

### M3.4 — Session page with URL params

**New file:** `web/src/pages/SessionPage.tsx`

Replaces hardcoded `App.tsx` content. Reads params from URL, calls API, renders dashboard.

```tsx
export function SessionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const params = {
    strategy: searchParams.get('strategy') ?? 'CATS',
    rolls: Number(searchParams.get('rolls') ?? 500),
    bankroll: Number(searchParams.get('bankroll') ?? 300),
    seed: searchParams.get('seed') ? Number(searchParams.get('seed')) : undefined,
  };

  const { data, loading, error } = useSimulation(params);

  // After run: write generated seed back to URL — makes run reproducible
  useEffect(() => {
    if (data?.seed && !searchParams.get('seed')) {
      const next = new URLSearchParams(searchParams);
      next.set('seed', String(data.seed));
      navigate(`/session?${next.toString()}`, { replace: true });
    }
  }, [data]);

  if (loading) return <SpinnerOverlay />;
  if (error || !data) return <ErrorState message={error} />;

  return (
    <>
      <SummaryPanel result={data} params={params} />
      <SessionChart rolls={data.rolls} initialBankroll={data.initialBankroll} />
      <StageBreakdown rolls={data.rolls} />
      <StageOverlayChart rolls={data.rolls} />
      <TrendPanel rolls={data.rolls} strategyName={params.strategy} />
    </>
  );
}
```

**`server/routes/simulate.ts` change** — generate seed if not provided, echo in response:
```typescript
const seed = body.seed ?? Math.floor(Math.random() * 1_000_000);
const engine = new CrapsEngine({ ...params, seed });
const result = engine.run();
return res.json({ ...result, seed });
```

**Acceptance test:** `/session?strategy=CATS&rolls=500&bankroll=300&seed=7` renders final bankroll `$322`. `/session?strategy=CATS&rolls=500&bankroll=300` runs and updates URL with generated seed.

---

### M3.5 — Stub pages for M4 and M5

**New files:** `web/src/pages/AnalysisPage.tsx`, `web/src/pages/ComparePage.tsx`

Each renders a heading and "Coming soon" placeholder. Purpose: confirm routing works, give nav links a destination.

---

### M3 Review

- [ ] `RunControls` manages form state only — no simulation logic
- [ ] `SessionPage` owns the API call — nothing in `Shell` or `RunControls` touches the API
- [ ] Seed always in URL after completed run
- [ ] Browser back/forward works — navigates between runs
- [ ] Sidebar collapse state is local `useState` — not in URL
- [ ] `GET /api/strategies` called once in `RunControls`, not on every render
- [ ] All M2 components render correctly inside `SessionPage`
- [ ] Stub pages render without errors
- [ ] `npm test` still passes

---

### M3 Demo

**File:** `demo/web-app-shell.md`

```bash
# Terminal 1
npm run server

# Terminal 2
cd web && npm run dev

open http://localhost:5173
```

**What to verify:**

- Nav links: Session | Analysis | Compare all navigate correctly without full reload
- Sidebar: collapses to icon rail, expands back, chart area widens when collapsed
- Run controls: select ThreePointMolly3X, 300 rolls, $500 bankroll, no seed → Run → URL updates with generated seed, dashboard renders
- Seed reproducibility: copy URL, open new tab, paste → identical output
- Browser back: after two runs, back returns to previous run's URL and re-renders it
- Direct URL: `/session?strategy=CATS&rolls=500&bankroll=300&seed=7` → final bankroll `$322`

---

## Milestone 4 — Multi-Session Analysis

**Goal:** Run N sessions across a seed range, render percentile distributions. Answer the exit-threshold and ruin-probability questions.

- P10/P50/P90 bankroll bands over time
- Peak bankroll distribution — the "when to walk" signal
- Ruin probability by session length
- Stage dwell time histogram for CATS

**Page URL:** `/analysis?strategy=CATS&rolls=500&bankroll=300&seeds=1000`

**API addition:** `POST /api/analyze` — server computes percentile aggregates server-side. Does not return raw `RollRecord[]` for all sessions (too large). Returns pre-aggregated distributions.

**Why multi-session before comparison:** The stage dwell histogram validates CATS threshold calibration. Understanding one strategy deeply before comparing multiple strategies is the right analytical sequence.

---

## Milestone 5 — Strategy Comparison

**Goal:** Head-to-head comparison using `SharedTable`. Two or more strategies on identical dice. Multiple bankroll lines on the same chart.

**Page URL:** `/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7`

**API addition:** `POST /api/compare` — wraps `SharedTable`, returns `SharedTableResult`.

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
| URL schema | `/session`, `/analysis`, `/compare` with defined param schemas |
| Loading state | Spinner overlay — no clear-and-reload |
| Seed UX | Always written to URL after run. Clear field for new random run |

---

## New Files Summary

| File | Milestone | Purpose |
|---|---|---|
| `src/engine/roll-record.ts` | M0.1 | Add `stageName?: string` |
| `src/engine/craps-engine.ts` | M0.1 | Populate `stageName` from Stage Machine runtime |
| `src/engine/shared-table.ts` | M0.1 | Populate `stageName` per player slot |
| `types/simulation.ts` | M0.2 | Shared type re-exports |
| `server/server.ts` | M1.1 | Express entry point |
| `server/routes/simulate.ts` | M1.1 | POST /api/simulate handler (M3.4: add seed echo) |
| `server/routes/strategies.ts` | M1.1 | GET /api/strategies handler |
| `web/package.json` | M1.2 | Frontend package |
| `web/vite.config.ts` | M1.2 | Vite config with API proxy and path alias |
| `web/tsconfig.json` | M1.2 | TypeScript config with path alias |
| `web/src/lib/stats.ts` | M1.4 | `computeSessionStats`, rolling P&L, consecutive 7-outs |
| `web/src/hooks/useSimulation.ts` | M1.3 | Data fetching hook |
| `web/src/components/SummaryPanel.tsx` | M1.4 | Stats card grid |
| `web/src/components/SessionChart.tsx` | M1.5 | Dual-axis chart with stage color banding |
| `web/src/App.tsx` | M1.6 → M3.1 | Root component → route definitions |
| `web/src/main.tsx` | M3.1 | BrowserRouter wrapper |
| `demo/web-session-view.md` | M1 Demo | M1 local dev instructions |
| `web/src/lib/stages.ts` | M2.1 | Stage spans, visit normalization, color palette |
| `web/src/components/StageBreakdown.tsx` | M2.2 | Stage visit summary table |
| `web/src/components/StageOverlayChart.tsx` | M2.3 | T0-normalized stage overlay charts |
| `web/src/lib/cats-thresholds.ts` | M2.4 | CATS threshold proximity logic |
| `web/src/components/TrendPanel.tsx` | M2.4 | Rolling P&L, threshold proximity, 7-out counter |
| `demo/web-stage-deep-dive.md` | M2 Demo | M2 local dev instructions |
| `web/src/components/Shell.tsx` | M3.2 | App layout — top nav + collapsible sidebar |
| `web/src/components/RunControls.tsx` | M3.3 | Simulation params form |
| `web/src/pages/SessionPage.tsx` | M3.4 | Session detail page (URL-driven) |
| `web/src/pages/AnalysisPage.tsx` | M3.5 | Multi-session analysis stub |
| `web/src/pages/ComparePage.tsx` | M3.5 | Strategy comparison stub |
| `demo/web-app-shell.md` | M3 Demo | M3 local dev instructions |
