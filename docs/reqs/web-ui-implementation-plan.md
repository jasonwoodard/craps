# Craps Simulator — Web UI Implementation Plan

**Date:** March 2026  
**Status:** Implementation complete. Active work: launch preparation.

All milestones (M0–M6) are documented in `docs/web-ui-completed-milestones.md`.  
Remaining work is tracked in `docs/launch-checklist.md`.

---

## Purpose

A web UI for the craps simulator that transforms structured simulation output into an analytical dashboard. Makes the mathematical behavior of craps strategies visible and internalize-able.

---

## Guiding Principles

**Minimal engine surface.** M0 made two surgical changes to `src/`. Everything else in `src/` is untouched.

**The CLI stays.** `src/cli/run-sim.ts` continues to work independently.

**Reuse existing types.** `RollRecord`, `EngineResult`, and `SharedTableResult` are the API contract. No translation layer.

**The user manual is the UX north star.** `docs/craps-simulator-user-manual.md` describes the intended user experience.

---

## Page Map

| Page | URL | Question | Status |
|---|---|---|---|
| Session | `/session` | What happened in this run? | Done (M3, M3.5) |
| Session Compare | `/session-compare` | Which strategy played these dice better? | Done (M5a) |
| Distribution | `/distribution` | What typically happens with this strategy? | Done (M4, M6) |
| Distribution Compare | `/distribution-compare` | How does this strategy's profile differ from that one's? | Done (M5b) |

**Nav:** Session | Session Compare | Distribution | Distribution Compare

---

## Architecture

### Directory structure

```
craps/
├── src/                            ← untouched
├── types/
│   └── simulation.ts               ← shared type re-exports (M0)
├── server/
│   ├── server.ts
│   ├── lib/
│   │   └── distribution.ts         ← computeAggregates, summarize
│   └── routes/
│       ├── simulate.ts
│       ├── strategies.ts
│       ├── distribution.ts         ← SSE stream
│       ├── session-compare.ts      ← SharedTable single-session
│       └── distribution-compare.ts ← dual SSE stream
├── web/
│   └── src/
│       ├── lib/
│       │   ├── stats.ts            ← computeSessionStats, computeHeatScores, rolling P&L
│       │   ├── stages.ts           ← stage spans, normalization, color palette
│       │   └── cats-thresholds.ts  ← CATS threshold proximity
│       ├── components/
│       │   ├── Shell.tsx
│       │   ├── RunControls.tsx
│       │   ├── SummaryPanel.tsx
│       │   ├── SessionChart.tsx
│       │   ├── HeatStrip.tsx
│       │   ├── StageBreakdown.tsx
│       │   ├── StageOverlayChart.tsx
│       │   ├── TrendPanel.tsx
│       │   ├── BandChart.tsx
│       │   ├── OutcomeSummary.tsx
│       │   ├── RuinCurve.tsx
│       │   ├── ComparisonChart.tsx
│       │   ├── DistributionCompareChart.tsx
│       │   └── OutcomeDelta.tsx
│       ├── pages/
│       │   ├── SessionPage.tsx
│       │   ├── SessionComparePage.tsx
│       │   ├── DistributionPage.tsx
│       │   └── DistributionComparePage.tsx
│       └── hooks/
│           ├── useSimulation.ts
│           ├── useDistribution.ts
│           ├── useComparison.ts
│           └── useDistributionCompare.ts
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

### Running locally

```bash
# Terminal 1
npm run server        # Express on :3001

# Terminal 2
cd web && npm run dev  # Vite on :5173
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

### `GET /api/strategies`

Returns `string[]`.

### `GET /api/distribution/stream`

SSE stream. Query params: `strategy`, `seeds`, `rolls`, `bankroll`.  
Emits every 10% of seeds: `{ progress, completed, aggregates: DistributionAggregates, done }`

### `POST /api/session-compare`

```typescript
// Request
{ strategies: string[]; rolls: number; bankroll: number; seed?: number; }
// Response
{ results: SharedTableResult; seed: number; }
```

### `GET /api/distribution-compare/stream`

SSE stream. Query params: `strategy` (baseline), `test` (challenger), `seeds`, `rolls`, `bankroll`.  
Uses `SharedTable` per seed — both strategies see identical dice.  
Emits every 10% of seeds: `{ progress, completed, baseline: DistributionAggregates, test: DistributionAggregates, done }`

---

## Resolved Decisions

| Decision | Resolution |
|---|---|
| Type sharing | `types/simulation.ts` at repo root re-exports from engine source |
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
| Tail analysis | CLI-only for P95/P99. Loaded into web UI via FileReader |
| Comparison page naming | `/session-compare` and `/distribution-compare` — parallel and self-describing |
| Distribution compare dice | `SharedTable` per seed — dice controlled at seed level |
| Distribution compare visual | Baseline = solid + fill. Test = dashed + no fill |
| Swap behavior | URL param swap (triggers re-stream). Client-state swap also valid — document choice in code |
| Heat strip rubric | Phantom pass-line P&L — canonical dice heat, no engine re-run needed |
| Heat strip window | Centered ±4 rolls (9-roll max), shrinks at edges — no padding |
| Heat strip placement | Between stat cards and session chart, full chart width, 16–20px tall |
| Heat strip tooltip | Roll range, shooter events, score label — window size omitted |

---

## New Files Summary

| File | Milestone | Purpose |
|---|---|---|
| `src/engine/roll-record.ts` | M0.1 | Add `stageName?: string` |
| `src/engine/craps-engine.ts` | M0.1 | Populate `stageName` from Stage Machine runtime |
| `src/engine/shared-table.ts` | M0.1 | Populate `stageName` per player slot |
| `types/simulation.ts` | M0.2 | Shared type re-exports |
| `server/server.ts` | M1.1 | Express entry point |
| `server/routes/simulate.ts` | M1.1 | POST /api/simulate |
| `server/routes/strategies.ts` | M1.1 | GET /api/strategies |
| `server/routes/distribution.ts` | M4.1 | GET /api/distribution/stream (SSE) |
| `server/routes/session-compare.ts` | M5a.1 | POST /api/session-compare |
| `server/routes/distribution-compare.ts` | M5b.1 | GET /api/distribution-compare/stream (dual SSE) |
| `server/lib/distribution.ts` | M4.1 | computeAggregates, summarize |
| `web/package.json` | M1.2 | Frontend package |
| `web/vite.config.ts` | M1.2 | Vite config with API proxy and SSE support |
| `web/tsconfig.json` | M1.2 | TypeScript config with path alias |
| `web/src/main.tsx` | M3.1 | BrowserRouter wrapper |
| `web/src/App.tsx` | M1.6 | Root component and routes |
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
| `demo/web-session-view.md` | M1 | Local dev instructions |
| `demo/web-stage-deep-dive.md` | M2 | Local dev instructions |
| `demo/web-app-shell.md` | M3 | Local dev instructions |
| `demo/web-distribution.md` | M4 | Local dev instructions |
| `demo/web-compare.md` | M5 | Local dev instructions |
