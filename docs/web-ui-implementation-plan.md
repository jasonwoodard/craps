## Milestone 2 — Stage Deep Dive

**Theme:** Make CATS stage structure analytically visible and explorable. This milestone justifies the complexity of the Stage Machine by surfacing what it actually does during a session.

**Dashboard philosophy:** The dashboard is a scrollable analytical report, not an app. Sections are additive — each independently useful, each built below the previous without touching it. Expert-oriented: length is not a problem, clarity is.

**Hardcoded run for M2:** `{ strategy: 'CATS', rolls: 500, bankroll: 300, seed: 7 }` — this session reaches multiple stages and revisits them repeatedly, making it the right fixture for developing and verifying stage visualizations. Seed 42 (M1 fixture) never escapes the Accumulator and is insufficient for M2 testing.

---

### M2.0 — Assessment [DONE — resolved conversationally]

Key decisions from the assessment:

| Question | Resolution |
|---|---|
| Stage bands vs. red/green event lines | Not mutually exclusive — `ReferenceArea` renders behind, event lines on top. Keep both. |
| Stage transition vertical markers | Removed — too dense at CATS's transition frequency. Table load line tells the stage story implicitly. |
| Stage filter dropdown | Deferred — overlay chart (M2.3) is the better answer to the multi-visit problem. |
| Stage overlay Y axis | Relative ±$ from stage entry bankroll, starting at 0 each visit. |
| Rolling trend window | 24 rolls. |
| Dashboard layout | Scrollable sections, additive, no refactoring of prior sections. |

---

### M2.1 — Section 1 enhancement: Stage color bands on timeline [DONE]

**What was built:** `SessionChart` gained background `ReferenceArea` color bands derived from `stageName` on each `RollRecord`. Bands render behind all existing chart elements — bankroll line, table load line, 7-out markers, and point-made markers are all unaffected.

**New utility:** `web/src/lib/stages.ts` — all stage data transformations live here. No stage logic in components.

```typescript
export interface StageSpan {
  stageName: string;
  startRoll: number;
  endRoll: number;
  visitIndex: number;
}

export function computeStageSpans(rolls: RollRecord[]): StageSpan[]
export function hasStageData(rolls: RollRecord[]): boolean
```

**Stage color palette** (defined in `stages.ts`):

| Stage | Color |
|---|---|
| `accumulatorFull` | amber-100 |
| `accumulatorRegressed` | amber-50 |
| `littleMolly` | green-100 |
| `threePtMollyTight` | blue-100 |
| `threePtMollyLoose` | indigo-100 |

All bands at 15% opacity. Stage transition vertical markers and top labels were implemented then removed — too dense at CATS's transition frequency.

**What was NOT built (and won't be):** Stage transition `ReferenceLine` components. The table load line tells the stage story sufficiently. Explicit markers added noise without insight.

---

### M2.2 — Section 2: Stage breakdown table [DONE]

**New component:** `web/src/components/StageBreakdown.tsx`

A time-ordered table showing every stage visit as a row. Positioned below `SessionChart`.

**Data shape** (computed in `stages.ts`):

```typescript
export interface StageVisitSummary {
  stageName: string;
  visitIndex: number;      // per-stage visit count (used for color dot)
  globalIndex: number;     // sequential row number across all stages
  startRoll: number;
  endRoll: number;
  rollCount: number;
  entryBankroll: number;
  exitBankroll: number;
  netPnL: number;
  peakPnL: number;
  troughPnL: number;
  winRolls: number;
  lossRolls: number;
  sevenOuts: number;
}
```

**Table columns (in order):**

| # | Stage | Roll Range | Rolls | Entry | Exit | Net P&L | Peak | Trough | 7-outs |
|---|---|---|---|---|---|---|---|---|---|

- `#` — global sequential row number (1, 2, 3...) making temporal order unambiguous
- `Roll Range` — `startRoll–endRoll` (e.g. `"1–43"`) showing timeline position
- Net P&L — color-coded green/red

For strategies without `stageName`, the component renders nothing — `hasStageData()` guard.

**What the table reveals:** With seed 7, Little Molly visits are almost all 1–2 rolls before stepping back down. Accumulator Regressed visits are doing the real grinding work. Visit 11 of Accumulator Regressed is 61 rolls alone. The roll range column makes these patterns immediately legible.

---

### M2.3 — Section 3: Stage overlay chart

**New component:** `web/src/components/StageOverlayChart.tsx`

One chart per stage that was visited during the session. Each chart overlays all visits to that stage, aligned to a common T0. Answers: "Are multiple visits to the same stage structurally similar, or does variance dominate?"

**Why this has analytic value:** When CATS steps back down to Accumulator after a bad run, is that second visit structurally different from the first? The first starts from a cold table with a full bankroll. The second starts post-losses. If the overlay shows visits tracking similarly — same slope, same dwell time — the step-down rule is working as designed and stage behavior is consistent. If they're wildly different, that's meaningful variance that a summary statistic would hide. This is a question nobody can answer without this data model.

**Data transformation** (add to `stages.ts`):

```typescript
export interface NormalizedVisit {
  stageName: string;
  visitIndex: number;
  label: string;           // "Visit 1: Rolls 1–43"
  points: Array<{
    t: number;             // roll offset from stage entry (0, 1, 2...)
    pnl: number;           // bankrollAfter - entryBankroll (relative ±$)
  }>;
}

export function normalizeStageVisits(
  rolls: RollRecord[],
  targetStage: string
): NormalizedVisit[]

// Returns all unique stage names present in the session
export function uniqueStages(rolls: RollRecord[]): string[]
```

**Chart structure per stage:**

```tsx
<ComposedChart>
  <XAxis dataKey="t" label={{ value: 'Rolls into stage', position: 'insideBottom' }} />
  <YAxis label={{ value: 'P&L ($)', angle: -90 }} />
  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" label="Entry" />
  <Tooltip formatter={(v: number) => `${v >= 0 ? '+' : ''}$${v}`} />
  <Legend />
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
</ComposedChart>
```

**Layout:** One chart per distinct stage visited, stacked vertically. Each has a heading: `"Accumulator Regressed — 12 visits"`. Stages with only one visit still render — a single line is still informative.

**Y axis is always relative ±$.** Absolute bankroll would be meaningless across visits that start at different bankroll levels. The zero reference line represents stage entry — every visit starts at 0, gains and losses are relative to that.

**X axis domain:** The longest visit determines the right edge. Shorter visits end before it — their lines simply stop. No padding or extrapolation.

**Acceptance test:** Seed 7 CATS run renders one chart per visited stage. Multiple Accumulator Regressed visits appear as distinct labeled lines from T0. Y axis reads ±$. The spread between visit lines — tight cluster vs. wide fan — is immediately readable.

---

### M2.4 — Section 4: Trend indicators

**New component:** `web/src/components/TrendPanel.tsx`

Three derived signals showing session dynamics over time. These describe *what has happened recently* — useful context for judgment, not predictions. Positioned below the stage overlay charts.

**Signal 1: 24-roll rolling P&L**

Rolling net bankroll change over the last 24 rolls. 24 is approximately 3× the average shooter hand length, smoothing single-hand noise while remaining responsive to trend shifts.

```typescript
// Add to stats.ts
export function computeRollingPnL(rolls: RollRecord[], window: number = 24): number[]
```

Rendered as a `Line` in a small `ComposedChart` with a zero reference line. The CATS consecutive 7-out step-down rule is a discrete approximation of this signal — the rolling P&L makes the underlying trend continuous and visible.

**Signal 2: Proximity to CATS thresholds**

For each roll, compute distance from current profit to the nearest step-up and step-down thresholds for the current stage.

```typescript
// New file: web/src/lib/cats-thresholds.ts
// CATS-specific logic isolated here — not in general utilities

export interface ThresholdProximity {
  rollNumber: number;
  currentProfit: number;
  stepUpThreshold: number | null;    // null if no step-up from current stage
  stepDownThreshold: number | null;  // null if at starting stage
  distanceToStepUp: number | null;
  cushionAboveStepDown: number | null;
}

export function computeCATSThresholdProximity(rolls: RollRecord[]): ThresholdProximity[]
```

CATS thresholds by stage:

| Stage | Step-up at | Step-down at |
|---|---|---|
| `accumulatorFull` | (transitions on hit, not profit) | — |
| `accumulatorRegressed` | +$70 | — |
| `littleMolly` | +$150 | +$70 |
| `threePtMollyTight` | +$200 | +$150 |
| `threePtMollyLoose` | +$250 | +$150 |

Rendered as two lines on a shared chart — distance to step-up (how far to go) and cushion above step-down (how much buffer). A `ReferenceLine` at y=0 marks each threshold boundary.

This component uses `isCATSStrategy(strategyName: string): boolean` — for non-CATS strategies it renders nothing. CATS threshold logic is isolated in `cats-thresholds.ts` and never leaks into general utilities.

**Signal 3: Consecutive 7-out counter over time**

A bar chart showing the consecutive 7-out count at each roll. The CATS step-down rule fires at 2 — a horizontal `ReferenceLine` at y=2 makes the trigger threshold visible. Counter drops to 0 after any win, so spikes show where step-downs fired.

```typescript
// Add to stats.ts — derivable from RollRecord, no engine changes needed
export function computeConsecutiveSevenOuts(rolls: RollRecord[]): number[]
// Logic: 7-out (pointBefore != null && rollValue === 7) increments counter
//        any win outcome resets counter to 0
//        no-action rolls leave counter unchanged
```

**Acceptance test:** Seed 7 CATS run renders all three panels. Rolling P&L shows positive momentum in the first ~300 rolls followed by decline. Threshold proximity shows the session repeatedly approaching but not sustaining Little Molly threshold. Consecutive 7-out counter shows spikes that triggered step-downs, with the y=2 reference line visible.

Cross-check with seed 42: All panels render without error. Rolling P&L is flat/negative throughout (Accumulator-only session). Threshold proximity shows profit never reaching +$70. Consecutive 7-out counter shows the frequency of 7-outs that kept the session trapped.

---

### M2 Review

Run the simplify pass across all new and modified files:

- `web/src/lib/stages.ts`
- `web/src/lib/cats-thresholds.ts`
- `web/src/components/StageBreakdown.tsx`
- `web/src/components/StageOverlayChart.tsx`
- `web/src/components/TrendPanel.tsx`
- `web/src/components/SessionChart.tsx` (M2.1 changes)

**Checklist:**

- [ ] All stage data transformations in `stages.ts` — no stage logic inline in components
- [ ] CATS threshold logic isolated in `cats-thresholds.ts` — not in `stages.ts` or `stats.ts`
- [ ] `hasStageData()` guard used in all M2 components — simple strategies render nothing gracefully
- [ ] `isCATSStrategy()` guard in `TrendPanel` — threshold proximity panel renders nothing for non-CATS strategies
- [ ] Stage color palette defined once in `stages.ts` — not duplicated
- [ ] `StageOverlayChart` Y axis is always relative ±$ — never absolute bankroll
- [ ] `computeConsecutiveSevenOuts` derived from `RollRecord` fields only — no engine changes
- [ ] Seed 7 self-verification: overlay chart shows multiple Accumulator Regressed visits as distinct lines
- [ ] Seed 42 self-verification: all sections render without error, overlay has single or few visits per stage
- [ ] No regressions to M1 components — `SessionChart` bands still visible, `SummaryPanel` unchanged
- [ ] `npm test` still passes

---

### M2 Demo

**File:** `demo/web-stage-deep-dive.md`

Update `App.tsx` hardcoded params to seed 7 for M2 development:
```tsx
const HARDCODED_PARAMS = { strategy: 'CATS', rolls: 500, bankroll: 300, seed: 7 };
```

```bash
# Terminal 1
npm run server

# Terminal 2
cd web && npm run dev

# Browser
open http://localhost:5173
```

**Scroll top to bottom and verify:**

**Section 1 — Timeline:** Stage color bands visible behind bankroll and table load lines. All M1 event markers (7-outs, point made) still visible on top of bands. No vertical transition markers.

**Section 2 — Stage breakdown table:** Rows numbered sequentially (#1, #2, #3...). Roll Range column shows timeline position of each visit (e.g. `"1–43"`). Little Molly visits are mostly 1–2 rolls. Accumulator Regressed visits vary widely in length. Net P&L color-coded.

**Section 3 — Stage overlay:** One chart per visited stage. Accumulator Regressed chart shows 10+ visit lines overlaid from T0. Y axis reads ±$. Tight cluster of lines = consistent stage behavior. Wide fan = high variance within the stage.

**Section 4 — Trend indicators:** Three panels. Rolling P&L shows momentum shift around roll 300. Threshold proximity shows session approaching but not sustaining +$70 step-up level consistently. Consecutive 7-out spikes correspond to visible step-downs in Section 2 table.

**Cross-check:** Switch to seed 42. All sections render. Dashboard degrades gracefully — fewer overlay lines, flat trend signals, no crashes.
