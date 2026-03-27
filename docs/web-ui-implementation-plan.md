# Craps Simulator — Web UI Implementation Plan

**Date:** March 2026  
**Status:** Draft v1.5  
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

---

## Page Map

| Page | URL | Theme | Status |
|---|---|---|---|
| Session Detail | `/session` | Single run — what happened | Done (M3) |
| Distribution | `/distribution` | Monte Carlo — what typically happens | M4 |
| Compare | `/compare` | Same-table head-to-head | M5 |

---

## Architecture

### Directory structure

```
craps/
├── src/                        ← untouched
├── types/                      ← shared type re-exports (M0)
│   └── simulation.ts
├── server/
│   ├── server.ts
│   ├── lib/
│   │   └── distribution.ts     ← computeAggregates, summarize (M4)
│   └── routes/
│       ├── simulate.ts
│       ├── strategies.ts
│       ├── distribution.ts     ← SSE stream endpoint (M4)
│       └── compare.ts          ← SharedTable endpoint (M5)
├── web/
│   └── src/
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
│       │   ├── DistributionPage.tsx  ← M4
│       │   └── ComparePage.tsx       ← M5
│       └── hooks/
│           ├── useSimulation.ts
│           ├── useDistribution.ts    ← M4
│           └── useComparison.ts      ← M5
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

Emits a JSON event every 10% of seeds completed:
```typescript
{
  progress: number;          // 0.0 → 1.0
  completed: number;
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

## Milestone 4 — Distribution Analysis

**Theme:** Monte Carlo analysis of a single strategy across N seeds. Streaming results via SSE. Answers "what typically happens" rather than "what happened on this run."

**Page:** `/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500`

**Seed presets:** Quick (200) | Standard (500) | Deep (1000).

**Tail analysis (P95/P99):** CLI-only — M6 handles loading those results into the UI.

**The sizzle:** Band chart updates as seeds stream in. Watching P10/P50/P90 lines converge from noisy to stable makes statistical convergence visible and is the headline experience of this page.

**Statistical note:** P50 is reliable at 200 seeds. P10/P90 need ~500. P95/P99 need 1000+ and are reserved for CLI runs.

---

### M4.0 — Assessment [DONE — resolved conversationally]

| Question | Decision |
|---|---|
| Streaming architecture | SSE via `GET /api/distribution/stream` |
| Seed presets | Quick: 200, Standard: 500, Deep: 1000 |
| Tail analysis | CLI-only (M6) |
| Polling fallback | Not implemented |

---

### M4.1 — Server: SSE distribution endpoint [DONE]

**New file:** `server/routes/distribution.ts`

`GET /api/distribution/stream` — runs N `CrapsEngine` sessions sequentially, emits aggregated results every 10% of seeds completed.

```typescript
app.get('/api/distribution/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { strategy, seeds, rolls, bankroll } = req.query;
  const N = Number(seeds);
  const strategyFn = lookupStrategy(strategy as string);
  const batchSize = Math.max(1, Math.floor(N / 10));
  const allResults: SessionSummary[] = [];

  for (let i = 0; i < N; i++) {
    const engine = new CrapsEngine({ strategy: strategyFn, bankroll: Number(bankroll), rolls: Number(rolls), seed: i });
    // Seeds are sequential integers (0, 1, 2...) — intentional.
    // Quick/Standard/Deep presets are nested subsets: Standard includes all Quick seeds.
    // This means bands refine smoothly when upgrading presets rather than jumping.
    allResults.push(summarize(engine.run(), i));

    if ((i + 1) % batchSize === 0 || i === N - 1) {
      res.write(`data: ${JSON.stringify({
        progress: (i + 1) / N,
        completed: i + 1,
        aggregates: computeAggregates(allResults),
        done: i === N - 1,
      })}\n\n`);
    }
  }

  res.end();
});
```

**New file:** `server/lib/distribution.ts`

`computeAggregates(results: SessionSummary[]): DistributionAggregates` and `summarize(result: EngineResult, seed: number): SessionSummary`. All computation here — not inline in the route handler.

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

Raw `RollRecord[]` for all sessions never leaves the server.

**Acceptance test:** `curl "http://localhost:3001/api/distribution/stream?strategy=CATS&seeds=50&rolls=500&bankroll=300"` streams ~6 SSE events and closes cleanly.

---

### M4.2 — Client: SSE hook [DONE]

**New file:** `web/src/hooks/useDistribution.ts`

```typescript
export function useDistribution(params: DistributionParams) {
  const [aggregates, setAggregates] = useState<DistributionAggregates | null>(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const source = new EventSource(`/api/distribution/stream?${new URLSearchParams(params)}`);
    source.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.progress);
      setAggregates(data.aggregates);
      if (data.done) { setDone(true); source.close(); }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [JSON.stringify(params)]);

  return { aggregates, progress, done };
}
```

**Acceptance test:** Hook receives progressive updates. `progress` goes 0 → 1. `done` becomes true on final message. `EventSource` closed on unmount.

---

### M4.3 — Distribution page layout [DONE]

**New file:** `web/src/pages/DistributionPage.tsx` (replaces M3 stub)

Reads params from URL. Calls `useDistribution`. Four sections, each updating as seeds stream in.

**Section 1 — Controls and progress**

Seed preset buttons: Quick | Standard | Deep. Clicking updates URL and restarts stream. Progress bar showing seeds completed / total.

**Section 2 — Bankroll band chart**

**New component:** `web/src/components/BandChart.tsx`

X axis: roll number. Y axis: bankroll. Three lines: P10, P50, P90. Buy-in reference line. Updates on each SSE message — this is the headline visual. Bands start noisy, stabilize visibly as seeds accumulate.

**Section 3 — Session outcome summary**

**New component:** `web/src/components/OutcomeSummary.tsx`

Stat cards updating progressively:

| Stat | Description |
|---|---|
| Median final bankroll | P50 final bankroll |
| Win rate | % sessions ending above buy-in |
| Ruin rate | % sessions reaching $0 |
| Median peak | P50 peak bankroll — typical best moment |
| Median roll to peak | When does the typical session hit its high? |
| P10 / P90 final | Typical bad vs. typical good session |

**Section 4 — Ruin probability curve**

**New component:** `web/src/components/RuinCurve.tsx`

X axis: roll number. Y axis: P(ruin) 0–100%. Single rising line. Shows *when* ruin typically happens across the session length, not just whether it does.

---

### M4.4 — Update nav [DONE]

Shell nav updated: Session | Distribution | Compare.

---

### M4 Review [DONE]

- [x] SSE connection closes cleanly on component unmount
- [x] Aggregates computed server-side — no raw roll arrays sent to client
- [x] Band chart updates smoothly on each SSE message
- [x] Progress bar accurately reflects seed completion
- [x] Seed preset buttons update URL and restart the stream
- [x] `computeAggregates` in `server/lib/distribution.ts` — not inline in route handler
- [x] `useDistribution` cleans up `EventSource` on unmount
- [x] Page degrades gracefully if SSE connection drops
- [x] `npm test` still passes

---

### M4 Demo [DONE]

**File:** `demo/web-distribution.md`

```bash
open "http://localhost:5173/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500"
```

**What to verify:**

- Progress bar starts at 0, updates ~10 times, reaches 100%
- Band chart starts noisy, stabilizes visibly as seeds accumulate — this is the headline moment
- Win rate, ruin rate, median peak all update progressively
- Ruin curve shows CATS's ruin profile over 500 rolls
- Quick (200 seeds): faster, noisier final result
- Deep (1000 seeds): slower, tighter bands
- Switch to ThreePointMolly3X — different band shape, different ruin curve

---

## Milestone 5 — Strategy Comparison

**Theme:** Same-table head-to-head. Two strategies, identical dice. Controlled experiment — luck held constant, strategy is the variable.

**Page:** `/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7`

**Cognitive sweet spot:** Two strategies only. Two lines on one chart — immediately readable.

---

### M5.0 — Assessment [DONE — resolved conversationally]

| Question | Decision |
|---|---|
| Max strategies | 2 |
| Dice control | `SharedTable` — single dice sequence, both strategies see identical rolls |
| Seed behavior | Fixed for reproducibility; random written to URL after run |
| Output | Single-session (fast, deterministic) — no SSE needed |
| Monte Carlo comparison | Future enhancement |

---

### M5.1 — Server: compare endpoint

**New file:** `server/routes/compare.ts`

```typescript
app.post('/api/compare', (req, res) => {
  const { strategies, rolls, bankroll, seed } = req.body;
  const actualSeed = seed ?? Math.floor(Math.random() * 1_000_000);
  const table = new SharedTable({ seed: actualSeed, rolls });
  for (const name of strategies) {
    table.addStrategy(name, lookupStrategy(name), { bankroll });
  }
  const results = table.run();
  return res.json({ results, seed: actualSeed });
});
```

**Acceptance test:** `POST /api/compare` with `strategies: ["CATS", "ThreePointMolly3X"]` returns `SharedTableResult` keyed by strategy name plus echoed seed.

---

### M5.2 — Client: compare hook

**New file:** `web/src/hooks/useComparison.ts`

Calls `POST /api/compare`. Returns `{ data: SharedTableResult | null, loading, error }`. No SSE — comparison runs are fast (single session, SharedTable already built).

---

### M5.3 — Compare page layout

**New file:** `web/src/pages/ComparePage.tsx` (replaces M3 stub)

Two strategy selectors in sidebar (Strategy A, Strategy B). Shared rolls/bankroll/seed controls. Seed written to URL after run.

**Section 1 — Head-to-head timeline**

**New component:** `web/src/components/ComparisonChart.tsx`

Single `ComposedChart`. Two bankroll lines, color-coded by strategy (A = blue, B = orange). Shared X axis — identical dice makes the comparison controlled. Buy-in reference line. Legend.

This is the headline visual: two lines diverging on the same dice. Where they separate tells the story.

**Section 2 — Side-by-side summary**

Two `SummaryPanel` instances side by side, color-coded headers. Net change delta between strategies shown prominently above both panels.

**Section 3 — Dice verification**

Small confirmation panel: "Both strategies saw identical dice ✓". Shows first 5 roll values from each strategy's log — confirms SharedTable is working correctly. Collapsible after verification.

**Section 4 — Stage comparison**

If either strategy has `stageName` data, shows its `StageBreakdown` table alongside the other strategy's plain session stats. Makes CATS's structural behavior visible against a flat strategy on the same dice — the most analytically interesting part of a CATS vs. anything comparison.

**Acceptance test:** `/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7` renders two bankroll lines. Dice verification shows ✓. Side-by-side summary correct for both strategies.

---

### M5.4 — Update nav

Nav finalized: Session | Distribution | Compare.

---

### M5 Review

- [ ] `useComparison` handles strategy array — not hardcoded to exactly 2
- [ ] Dice verification confirms roll identity, not just seed identity
- [ ] Side-by-side panels visually balanced at 1280px
- [ ] Stage comparison renders nothing when neither strategy has `stageName`
- [ ] Seed written to URL after random run — comparison is reproducible
- [ ] `npm test` still passes

---

### M5 Demo

**File:** `demo/web-compare.md`

```bash
open "http://localhost:5173/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7"
```

**What to verify:**

- Two bankroll lines on identical dice — divergence visible
- Dice verification shows ✓
- Side-by-side summary: CATS net +$22, ThreePointMolly3X net (seed 7 value)
- Stage breakdown shows CATS's 65 stage visits alongside ThreePointMolly3X flat play
- Try seed 42 — both strategies grind a bad session, CATS Accumulator structure visible
- Copy URL, open new tab — identical output confirms reproducibility

---

## Milestone 6 — Tail Analysis Loader

**Theme:** Import large CLI-generated datasets into the web UI for P95/P99 tail visualization. Heavy computation stays in the CLI; interactive exploration stays in the web UI.

**Why CLI for tails:** 10,000-seed runs take minutes — appropriate for a background job, not an interactive stream.

---

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
  generatedAt: string;   // ISO timestamp
  params: { strategy: string; rolls: number; bankroll: number };
}
```

---

### M6.1 — Web UI: distribution file loader

"Load file" button on `/distribution` page alongside seed preset buttons. Accepts `.distribution.json`. Reads client-side via `FileReader` — no server round-trip (already aggregated).

When loaded:
- Band chart gains P95/P99 lines in addition to P10/P50/P90
- Outcome summary gains P95/P99 stats
- Page header shows: `"Loaded: cats-10k.distribution.json (10,000 seeds)"`

---

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
| `server/routes/simulate.ts` | M1.1 | POST /api/simulate (M3: add seed echo) |
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
