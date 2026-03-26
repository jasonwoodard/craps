# Craps Simulator — Web UI Implementation Plan

**Date:** March 2026  
**Status:** Draft v1.1  
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
├── src/                    ← minimal changes in M0 only
│   ├── engine/
│   │   └── roll-record.ts  ← add stageName?: string (M0)
│   ├── dsl/
│   ├── cli/
│   ├── bets/
│   ├── dice/
│   └── logger/
├── types/                  ← new in M0: shared type re-exports
│   └── simulation.ts
├── server/                 ← new in M1: Express API server
│   ├── server.ts
│   └── routes/
│       ├── simulate.ts
│       └── strategies.ts
├── web/                    ← new in M1: React frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/
│       │   └── stats.ts
│       ├── components/
│       │   ├── SummaryPanel.tsx
│       │   └── SessionChart.tsx
│       └── hooks/
│           └── useSimulation.ts
├── docs/
├── spec/
└── package.json            ← add Express to devDeps, add "server" script
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

In development: Vite and Express run as two separate processes. In any future production packaging: Express serves the Vite build as static files from `web/dist/`.

---

## API Contract

### `POST /api/simulate`

**Request body:**
```typescript
{
  strategy: string;      // key from BUILT_IN_STRATEGIES
  rolls: number;
  bankroll: number;
  seed?: number;         // omit for random
}
```

**Response:** `EngineResult` serialized as JSON — no transformation. Full `rolls: RollRecord[]` included.

### `GET /api/strategies`

Returns `string[]` — keys of `BUILT_IN_STRATEGIES`. Drives the strategy selector in M3.

---

## Milestone 0 — Core Refactor [DONE]

**Goal:** Two surgical changes to `src/` that the rest of the web milestones depend on. All existing tests remain green. CLI behavior is unchanged.

**Why M0 is its own milestone:** These changes are prerequisites for everything that follows and have their own acceptance criteria. Conflating them with server or frontend work creates confusion about what broke what.

---

### M0.1 — Add `stageName` to `RollRecord` [DONE]

**File:** `src/engine/roll-record.ts`

Add one optional field:

```typescript
export interface RollRecord {
  // ... existing fields unchanged ...
  stageName?: string;   // populated by Stage Machine strategies; undefined for simple strategies
}
```

**File:** `src/engine/craps-engine.ts`

In `playRoll()`, after `this.reconcileEngine.postRoll()`, read the current stage from the Stage Machine runtime if present and write it to the `RollRecord`:

```typescript
const runtime = (this.strategy as any)[STAGE_MACHINE_RUNTIME] as StageMachineRuntime | undefined;
record.stageName = runtime?.getCurrentStage();
```

**File:** `src/engine/shared-table.ts`

Same pattern — each player slot has its own `ReconcileEngine` instance with its own cached runtime reference. Populate `stageName` per slot after `postRoll`. Slots whose strategy is not a Stage Machine strategy will produce `undefined` naturally — no special casing needed.

**The identity model:**

`strategyName` lives in the result envelope — `SharedTable` returns results keyed by strategy name, and `CrapsEngine` receives it via request params. It does not need to be on `RollRecord`. `stageName` on `RollRecord` is sufficient for the UI to know where in its lifecycle a Stage Machine strategy is on any given roll. Simple strategies produce rolls with no `stageName` — which is itself analytically informative in a comparison view.

**Acceptance criteria:**
- `npm test` passes with zero failures
- A single CATS run via `CrapsEngine` with `--output json` shows `stageName` populated on roll entries, transitioning from `accumulatorFull` after first 6 or 8 hit
- A single PassLineOnly run shows `stageName` genuinely absent on roll entries — not present as the string `"undefined"`
- A `SharedTable` comparison run with CATS vs. ThreePointMolly3X produces `stageName` populated on CATS roll records and absent on ThreePointMolly3X roll records — confirming per-slot isolation works correctly with mixed strategy types

---

### M0.2 — Shared type re-exports [DONE]

**New file:** `types/simulation.ts`

```typescript
// Single re-export point for engine types consumed by server/ and web/
// Source of truth remains src/engine/roll-record.ts and src/dsl/outcome.ts
export type { RollRecord, EngineResult, ActiveBetInfo } from '../src/engine/roll-record';
export type { Outcome } from '../src/dsl/outcome';
```

No logic. Types only. Both `server/` and `web/` import from this file — not directly from `src/`.

**Acceptance criteria:**
- `tsc --noEmit` from repo root passes
- `import type { RollRecord } from '../types/simulation'` works from a file in `server/`

---

### M0 Review [DONE]

- [x] `stageName` is populated correctly for CATS — spot-check 10 roll records from `--output json`
- [x] `stageName` is absent for PassLineOnly — not present as `"undefined"` string, genuinely absent
- [x] `types/simulation.ts` re-exports compile without error
- [x] Zero changes to CLI behavior — `npm test` and all manual CLI commands still work
- [x] No new `any` casts introduced beyond the existing `STAGE_MACHINE_RUNTIME` symbol lookup pattern

---

### M0 Demo [DONE]

```bash
# Confirm stageName appears in JSON output for a Stage Machine strategy
npx ts-node src/cli/run-sim.ts --strategy CATS --rolls 50 --bankroll 300 --seed 42 --output json \
  | head -20

# Confirm stageName is absent for a simple strategy
npx ts-node src/cli/run-sim.ts --strategy PassLineOnly --rolls 20 --bankroll 300 --seed 42 --output json \
  | head -5
```

Self-verification: CATS output shows `"stageName":"accumulatorFull"` on early rolls, transitioning to `"accumulatorRegressed"` after the first 6 or 8 hit.

---

## Milestone 1 — MVP Web UI [DONE]

**Goal:** A working browser page that renders a pre-configured simulation run as a summary stats panel and a time series chart. No user controls. No stage filter logic. Get the visual foundation right.

**Hardcoded run for M1:** `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 42 }`  
This is the same run used in manual CLI testing — final bankroll $6, a dramatically bad session that exercises the full chart range.

**Stage handling in M1:** Color banding only — background bands derived from `stageName` changes in the roll array. No dropdown, no filter, no zoom. That work belongs in M2.

**Does not include:** User controls, strategy selection, comparison runs, multi-session aggregation, stage filter or overlay.

---

### M1.1 — Express server scaffold [DONE]

**New file:** `server/server.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { simulateRoute } from './routes/simulate';
import { strategiesRoute } from './routes/strategies';

const app = express();
app.use(cors());
app.use(express.json());
app.post('/api/simulate', simulateRoute);
app.get('/api/strategies', strategiesRoute);

app.listen(3001, () => console.log('Server running on :3001'));
```

**New file:** `server/routes/simulate.ts`

Imports `CrapsEngine` and `BUILT_IN_STRATEGIES` directly. Validates request body — returns 400 for unknown strategy name or invalid params. Runs simulation. Returns `EngineResult` as JSON.

**New file:** `server/routes/strategies.ts`

Returns `Object.keys(BUILT_IN_STRATEGIES)` as JSON.

**Root `package.json` additions:**
```json
{
  "devDependencies": {
    "express": "^4.18",
    "cors": "^2.8",
    "@types/express": "^4.17",
    "@types/cors": "^2.8"
  },
  "scripts": {
    "server": "ts-node server/server.ts"
  }
}
```

**Acceptance test:**
```bash
curl -X POST http://localhost:3001/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"strategy":"CATS","rolls":500,"bankroll":300,"seed":42}'
# Returns JSON — rolls[0] has stageName: "accumulatorFull"
```

---

### M1.2 — React + Vite scaffold [DONE]

**New directory:** `web/`

```bash
cd web && npm create vite@latest . -- --template react-ts
npm install
npm install recharts
npm install -D tailwindcss @tailwindcss/vite
```

**`web/vite.config.ts`:**
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': 'http://localhost:3001' }
  },
  resolve: {
    alias: { '@types': path.resolve(__dirname, '../types') }
  }
});
```

**`web/tsconfig.json`** — path alias:
```json
{
  "compilerOptions": {
    "paths": { "@types/*": ["../types/*"] }
  }
}
```

**Acceptance test:** `cd web && npm run dev` opens a blank page at `localhost:5173` without errors. `import type { RollRecord } from '@types/simulation'` compiles cleanly.

---

### M1.3 — `useSimulation` hook [DONE]

**New file:** `web/src/hooks/useSimulation.ts`

Calls `POST /api/simulate` on mount. Returns `{ data: EngineResult | null, loading: boolean, error: string | null }`. Handles non-200 responses and network errors explicitly — surfaces error state, does not silently fail.

`params` is a parameter (not hardcoded inside the hook) — designed for M3 when params become user-controlled.

---

### M1.4 — Summary stats panel [DONE]

**New file:** `web/src/lib/stats.ts`

`computeSessionStats(result: EngineResult)` — single location for all derived stat computation. Components do not compute stats inline.

```typescript
export interface SessionStats {
  totalRolls: number;
  netChange: number;
  peakBankroll: number;
  troughBankroll: number;
  maxDrawdown: number;
  winRolls: number;
  lossRolls: number;
  noActionRolls: number;
  avgTableLoad: number;
  maxTableLoad: number;
}

export function computeSessionStats(result: EngineResult): SessionStats { ... }
```

**New component:** `web/src/components/SummaryPanel.tsx`

Renders `SessionStats` as a card grid. Net change color-coded green/red. Monospaced numbers. Dense but readable.

---

### M1.5 — Session chart [DONE]

**New component:** `web/src/components/SessionChart.tsx`

Dual-axis time series using Recharts `ComposedChart`.

**X axis:** Roll number

**Left Y axis — Bankroll:**
- `Line` — `bankrollAfter` per roll
- `ReferenceLine` — `initialBankroll`, dashed, labeled "Buy-in"

**Right Y axis — Table load:**
- `Area` — `tableLoadBefore` per roll, muted color, secondary visual weight

**Event markers:**
- Red marker on X axis: `pointBefore != null && rollValue === 7` (7-out)
- Green marker on X axis: `pointBefore != null && pointBefore === rollValue` (point made)

No stage logic of any kind in M1. `stageName` is in the data but the chart does not read it. Stage visualization belongs in M2 where it can be designed with full context.

**Acceptance test:** Chart renders with both lines, reference line visible, dual Y axes correctly labeled, event markers present.

---

### M1.6 — Milestone 1 integration [DONE]

Wire everything in `App.tsx`:

```tsx
const HARDCODED_PARAMS = { strategy: 'CATS', rolls: 500, bankroll: 300, seed: 42 };

function App() {
  const { data, loading, error } = useSimulation(HARDCODED_PARAMS);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-mono mb-6">Craps Simulator</h1>
      <SummaryPanel result={data} params={HARDCODED_PARAMS} />
      <SessionChart rolls={data.rolls} initialBankroll={data.initialBankroll} />
    </div>
  );
}
```

**Acceptance test:** Both processes running → browser shows summary panel and chart. Stage color bands visible. Final bankroll in summary panel matches CLI output: `$300 → $6`.

---

### M1 Review [DONE]

Run the simplify pass across all new files:

- `types/simulation.ts`
- `server/server.ts`, `server/routes/simulate.ts`, `server/routes/strategies.ts`
- `web/src/lib/stats.ts`
- `web/src/hooks/useSimulation.ts`
- `web/src/components/SummaryPanel.tsx`
- `web/src/components/SessionChart.tsx`
- `web/src/App.tsx`

**Checklist:**

- [x] `computeSessionStats` is the single location for all derived stat computation — nothing inline in components
- [x] `useSimulation` handles non-200 responses and network errors explicitly
- [x] Express port (3001) defined in one place — not hardcoded in multiple files
- [x] Express returns 400 (not 500) for unknown strategy names
- [x] No `console.log` in production paths
- [x] Dual Y axis scales are independent — table load range does not compress bankroll line
- [x] `SessionChart` does not read or reference `stageName` — confirmed clean boundary with M2
- [x] Page is usable at 1280px width
- [x] `npm test` (existing Jasmine suite) still passes — no engine regressions

---

### M1 Demo

**File:** `demo/web-session-view.md`

```bash
# Terminal 1
npm run server

# Terminal 2
cd web && npm run dev

# Browser
open http://localhost:5173
```

**What to verify:**

- Summary panel shows all stats; net change is red (-$294)
- Chart shows bankroll declining from $300 to near $0 over 500 rolls
- Buy-in reference line ($300) is visible as a dashed horizontal
- 7-out markers cluster visibly on the X axis — this seed has many of them
- Table load area shows brief jumps when Molly stages are entered before collapsing back
- No stage banding or `stageName` references anywhere in the rendered UI

Self-verification: Final bankroll in browser matches `$6` from CLI run with same seed.

---

## Milestone 2 — Stage Deep Dive

**Theme:** Make CATS stage structure analytically visible and explorable. This milestone justifies the complexity of the Stage Machine by surfacing what it actually does during a session. The dashboard is a scrollable analytical report — sections are additive, each independently useful. Build one section at a time.

**UI code can become a hot tangled mess.** M2 is scoped into four sub-milestones matching four dashboard sections. Each is a clean addition below the existing M1 content — no refactoring of `SessionChart` or `SummaryPanel`.

**Hardcoded run for M2 development:** `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 7 }` — this session reaches multiple stages and revisits stages, making it the right fixture for developing and verifying stage visualizations. Seed 42 (M1 fixture) never escapes the Accumulator and is insufficient for M2 testing.

---

### M2.0 — Assessment [DONE — replaced by this spec]

The M2.0 assessment was conducted conversationally and its conclusions are embedded in the milestone designs below. Key resolved decisions:

| Question | Resolution |
|---|---|
| Stage bands vs. red/green event lines | Not mutually exclusive — `ReferenceArea` renders behind, event lines render on top. Keep both. |
| Stage filter dropdown | Deferred — the overlay chart (M2.3) does this better |
| Stage overlay Y axis | Relative ±$ from stage entry bankroll, starting at 0 each visit |
| Rolling trend window | 24 rolls |
| Table load in overlay | Implicit in relative ±$ — not shown separately |
| Dashboard layout | Scrollable sections, additive, expert-oriented |

---

### M2.1 — Section 1 enhancement: Timeline with stage context

**What changes:** `SessionChart` gains stage color bands and transition markers. The existing bankroll line, table load line, and event markers are untouched — bands layer behind them.

**New utility:** `web/src/lib/stages.ts`

All stage-related data transformations live here. `SessionChart` imports from this file — no stage logic inline in the component.

```typescript
export interface StageSpan {
  stageName: string;
  startRoll: number;
  endRoll: number;
  visitIndex: number;      // 1st visit, 2nd visit, etc. — for labeling
}

// Detect consecutive stageName runs in RollRecord[]
export function computeStageSpans(rolls: RollRecord[]): StageSpan[]

// Returns null if rolls have no stageName (simple strategies)
export function hasStageData(rolls: RollRecord[]): boolean
```

**Stage color palette** — defined in `stages.ts`, not in the chart component:

| Stage | Color | Rationale |
|---|---|---|
| `accumulatorFull` | amber-100 | Warm, early |
| `accumulatorRegressed` | amber-50 | Same family, lighter |
| `littleMolly` | green-100 | Transition to Molly stages |
| `threePtMollyTight` | blue-100 | Alpha territory |
| `threePtMollyLoose` | indigo-100 | Deep Alpha |

All bands at 15% opacity — readable but not distracting.

**`SessionChart` additions:**

```tsx
// Background bands (renders behind everything)
{stageSpans.map(span => (
  <ReferenceArea
    key={`${span.stageName}-${span.visitIndex}`}
    x1={span.startRoll}
    x2={span.endRoll}
    fill={STAGE_COLORS[span.stageName]}
    fillOpacity={0.15}
  />
))}

// Transition markers (renders in front of bands, behind lines)
{stageSpans.slice(1).map(span => (
  <ReferenceLine
    key={`transition-${span.visitIndex}`}
    x={span.startRoll}
    stroke="#94a3b8"
    strokeDasharray="3 3"
    label={{ value: span.stageName, position: 'top', fontSize: 9 }}
  />
))}
```

**`SessionChart` props addition:**

```tsx
interface SessionChartProps {
  rolls: RollRecord[];
  initialBankroll: number;
  // showStageContext defaults to true when stageName data present
}
```

**Acceptance test:** Seed 7 CATS run shows colored bands across the timeline. Transition points are marked with dashed verticals. The existing bankroll line, table load line, 7-out markers, and point-made markers are all still visible and readable.

---

### M2.2 — Section 2: Stage breakdown table

**New component:** `web/src/components/StageBreakdown.tsx`

A compact table showing what happened in each stage visit. Positioned below the session chart.

**Data shape** (computed in `stages.ts`):

```typescript
export interface StageVisitSummary {
  stageName: string;
  visitIndex: number;
  startRoll: number;
  endRoll: number;
  rollCount: number;
  entryBankroll: number;
  exitBankroll: number;
  netPnL: number;           // exitBankroll - entryBankroll
  peakPnL: number;          // max bankrollAfter - entryBankroll within visit
  troughPnL: number;        // min bankrollAfter - entryBankroll within visit
  winRolls: number;
  lossRolls: number;
  sevenOuts: number;
}

export function computeStageVisitSummaries(rolls: RollRecord[]): StageVisitSummary[]
```

**Table layout:**

| Visit | Stage | Rolls | Entry | Exit | Net P&L | Peak | Trough | 7-outs |
|---|---|---|---|---|---|---|---|---|
| 1 | Accumulator Full | 8 | $300 | $264 | -$36 | +$0 | -$36 | 0 |
| 2 | Accumulator Regressed | 162 | $264 | $382 | +$118 | +$134 | -$48 | 12 |
| 3 | Little Molly | 44 | $382 | $351 | -$31 | +$22 | -$62 | 4 |
| ... | | | | | | | | |

Net P&L column color-coded green/red. The table makes it immediately visible which stages generated profit and which consumed it.

**`App.tsx` addition:**

```tsx
<StageBreakdown rolls={data.rolls} />
```

**Acceptance test:** Table renders for seed 7 CATS run. Each stage visit is a row. Net P&L is color-coded. For strategies without `stageName` (PassLineOnly), the component renders nothing — `hasStageData()` guard.

---

### M2.3 — Section 3: Stage overlay chart

**New component:** `web/src/components/StageOverlayChart.tsx`

One chart per stage that was visited during the session. Each chart overlays all visits to that stage, aligned to a common T0. Y axis is relative ±$ from stage entry bankroll. This answers: "Are multiple visits to the same stage structurally similar, or does variance dominate?"

**Data transformation** (in `stages.ts`):

```typescript
export interface NormalizedVisit {
  stageName: string;
  visitIndex: number;
  label: string;           // "Visit 1: Rolls 1–47"
  points: Array<{
    t: number;             // roll offset from stage entry (0, 1, 2, ...)
    pnl: number;           // bankrollAfter - entryBankroll
  }>;
}

export function normalizeStageVisits(
  rolls: RollRecord[],
  stageName: string
): NormalizedVisit[]
```

**Chart structure per stage:**

```tsx
<ComposedChart data={/* longest visit length */}>
  <XAxis dataKey="t" label="Rolls into stage" />
  <YAxis label="P&L ($)" />
  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" label="Entry" />
  {visits.map((visit, i) => (
    <Line
      key={visit.label}
      data={visit.points}
      dataKey="pnl"
      name={visit.label}
      dot={false}
      strokeWidth={1.5}
      stroke={VISIT_COLORS[i % VISIT_COLORS.length]}
    />
  ))}
  <Legend />
  <Tooltip formatter={(v) => `$${v >= 0 ? '+' : ''}${v}`} />
</ComposedChart>
```

**Layout:** If CATS visits 3 distinct stages, 3 charts render stacked vertically. Each chart has a heading: "Accumulator Regressed — 4 visits". Charts for stages with only one visit are still rendered — a single line is still informative.

**The analytic payoff:** If all Accumulator Regressed visits show a similar slope (slow grind, modest wins), the strategy is behaving consistently. If one visit is a steep cliff (rapid losses), that visit was exceptional and worth noting. This is the view that makes the CATS stage design legible without reading the source code.

**Acceptance test:** Seed 7 CATS run renders one chart per visited stage. Multiple visits to the same stage appear as distinct labeled lines. Y axis starts at 0 for all visits. The longest visit determines the X axis domain; shorter visits end before the right edge.

---

### M2.4 — Section 4: Trend indicators

**New component:** `web/src/components/TrendPanel.tsx`

Three derived signals that show session dynamics over time. Not predictive — these describe *what has happened recently* as context for judgment. Positioned below the stage overlay charts.

**Signal 1: 24-roll rolling P&L**

Rolling net bankroll change over the last 24 rolls. Computed in `stats.ts`:

```typescript
export function computeRollingPnL(rolls: RollRecord[], window: number = 24): number[]
```

Rendered as a `Line` in a small `ComposedChart` with a zero reference line. Green when positive, red when negative. This is the session's momentum signal — a sustained negative trend is what CATS's consecutive 7-out rule is approximating.

**Signal 2: Proximity to CATS thresholds**

For each roll, compute distance from current profit to the nearest step-up and step-down thresholds for the current stage. Rendered as two lines on a shared chart:

```
Current profit: $118
Step-up threshold (littleMolly → threePtMollyTight): $150  →  $32 away
Step-down threshold (littleMolly → accumulatorRegressed): $70  →  $48 cushion
```

This is CATS-specific logic. It belongs in a `cats-thresholds.ts` utility, not in general `stats.ts` or `stages.ts`. The component should gracefully render nothing for non-CATS strategies — a `isCATSStrategy(strategyName)` guard.

**Signal 3: Consecutive 7-out counter over time**

A simple bar chart showing the consecutive 7-out count at each roll. The CATS step-down rule fires at 2 — a horizontal reference line at y=2 makes this threshold visible. Shows exactly when the step-down rule fired (counter drops back to 0 after a win).

**Note on consecutive 7-out data:** This signal requires `consecutiveSevenOuts` per roll, which is currently only in `SessionState` at the end of the session — not in `RollRecord`. Two options: (a) derive it client-side from the roll sequence (a 7-out increments the counter, any win resets it — fully derivable from `RollRecord` fields), or (b) add it to `RollRecord` in a future engine pass. Prefer (a) — no engine changes, fully computable from existing data.

```typescript
// In stats.ts — derivable from RollRecord without engine changes
export function computeConsecutiveSevenOuts(rolls: RollRecord[]): number[]
```

**Acceptance test:** Three charts render for seed 7 CATS run. Rolling P&L shows the momentum shift around roll 300 where the session starts declining. Threshold proximity shows the session entering and leaving Little Molly territory. Consecutive 7-out counter shows the spikes that triggered step-downs.

---

### M2 Review

Run the simplify pass across all new files:

- `web/src/lib/stages.ts`
- `web/src/components/StageBreakdown.tsx`
- `web/src/components/StageOverlayChart.tsx`
- `web/src/components/TrendPanel.tsx`
- `web/src/components/cats-thresholds.ts`

**Checklist:**

- [ ] All stage data transformations live in `stages.ts` — no stage logic in components
- [ ] `hasStageData()` guard used in all M2 components — simple strategies render nothing gracefully
- [ ] Stage color palette defined once in `stages.ts` — not duplicated across components
- [ ] `StageOverlayChart` Y axis is always relative ±$ — never absolute bankroll
- [ ] CATS threshold logic isolated in `cats-thresholds.ts` — not in general utilities
- [ ] `computeConsecutiveSevenOuts` derived from `RollRecord` fields only — no engine changes
- [ ] Seed 7 self-verification: overlay chart shows multiple Accumulator Regressed visits as distinct lines
- [ ] Seed 42 self-verification: overlay chart shows single Accumulator Full visit and many Accumulator Regressed visits (session never escaped Accumulator stages)
- [ ] No regressions to M1 components — `SessionChart` and `SummaryPanel` unchanged
- [ ] `npm test` still passes

---

### M2 Demo

**File:** `demo/web-stage-deep-dive.md`

```bash
# Terminal 1
npm run server

# Terminal 2
cd web && npm run dev

# Browser
open http://localhost:5173
```

**Switch hardcoded params to seed 7** for M2 development:
```tsx
const HARDCODED_PARAMS = { strategy: 'CATS', rolls: 500, bankroll: 300, seed: 7 };
```

**What to verify, scrolling top to bottom:**

**Section 1 — Timeline:** Stage color bands visible behind the bankroll and table load lines. Transition markers at stage boundaries. All M1 event markers (7-outs, point made) still visible on top of the bands.

**Section 2 — Stage breakdown table:** Multiple rows for Accumulator Regressed (multiple visits). Net P&L column shows which visits were profitable. Total rolls per visit shows dwell time variation.

**Section 3 — Stage overlay:** Accumulator Regressed chart shows multiple visit lines overlaid from T0. Lines are distinguishable by color and labeled in legend. Y axis reads ±$ relative to stage entry. Visits with similar slopes confirm consistent stage behavior. Outlier visits are visually obvious.

**Section 4 — Trend panel:** Rolling P&L trend shows positive momentum in the first ~300 rolls followed by decline. Threshold proximity shows the session repeatedly approaching but not reaching Tight Molly. Consecutive 7-out counter shows the spikes that triggered step-downs back to Accumulator.

**Cross-check:** Run with seed 42 to verify graceful behavior when stages are limited (Accumulator only). All four sections should render — just with fewer rows, fewer overlay lines, and flat trend signals.

---

## Milestone 3 — Interactive Controls

**Goal:** Replace hardcoded simulation params with user controls. Strategy selector, roll count, bankroll, seed input with optional lock. Run button triggers new simulation.

*Not designed in detail — depends on M1 visual foundation being stable.*

Key decisions after M1:
- Form layout: sidebar vs. above chart
- Seed UX: explicit input vs. auto-generate with "lock" toggle
- Loading state: re-render in place vs. clear and reload

---

## Milestone 4 — Multi-Session Analysis

**Goal:** Run N sessions across a seed range, render percentile distributions.

- P10/P50/P90 bankroll bands over time
- Peak bankroll distribution — when to walk
- Ruin probability by session length
- Stage dwell time distribution for CATS

**API addition:** `POST /api/analyze` — server computes percentile aggregates, does not return raw `RollRecord[]` for all sessions.

---

## Milestone 5 — Strategy Comparison

**Goal:** Head-to-head comparison using `SharedTable`. Two strategies, identical dice, two bankroll lines on the same chart.

**API addition:** `POST /api/compare` — wraps `SharedTable`, returns `SharedTableResult`.

---

## Resolved Decisions

| Decision | Resolution |
|---|---|
| Type sharing | Shared `types/simulation.ts` at repo root re-exports from engine source. No duplication. |
| Server package location | Shares root `package.json`. Express in root `devDependencies`. `"server"` script in root. |
| `stageName` in `RollRecord` | Added in M0.1. Optional field, populated by Stage Machine strategies only. |
| Stage filter/overlay complexity | Evaluated in M2.0 assessment before any M2 implementation. |

---

## New Files Summary

| File | Milestone | Purpose |
|---|---|---|
| `src/engine/roll-record.ts` | M0.1 | Add `stageName?: string` |
| `src/engine/craps-engine.ts` | M0.1 | Populate `stageName` from Stage Machine runtime |
| `src/engine/shared-table.ts` | M0.1 | Populate `stageName` per player slot |
| `types/simulation.ts` | M0.2 | Shared type re-exports |
| `server/server.ts` | M1.1 | Express entry point |
| `server/routes/simulate.ts` | M1.1 | POST /api/simulate handler |
| `server/routes/strategies.ts` | M1.1 | GET /api/strategies handler |
| `web/package.json` | M1.2 | Frontend package (React, Vite, Recharts, Tailwind) |
| `web/vite.config.ts` | M1.2 | Vite config with API proxy and path alias |
| `web/tsconfig.json` | M1.2 | TypeScript config with path alias for shared types |
| `web/src/lib/stats.ts` | M1.4 | `computeSessionStats` — all derived stat computation |
| `web/src/hooks/useSimulation.ts` | M1.3 | Data fetching hook |
| `web/src/components/SummaryPanel.tsx` | M1.4 | Stats card grid |
| `web/src/components/SessionChart.tsx` | M1.5 | Dual-axis chart with stage color banding |
| `web/src/App.tsx` | M1.6 | Root component |
| `demo/web-session-view.md` | M1 Demo | Local dev instructions and self-verification |
| `docs/web-ui-m2-assessment.md` | M2.0 | Stage deep dive complexity assessment |
