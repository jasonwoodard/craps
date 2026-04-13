# Previously Failing Integration Scenarios — Post-Fix Record

**Generated from:** `spec/integration/**/*-spec.ts`  
**Current test run:** 515 specs, **0 failures** (both bugs resolved)  
**Original failure count:** 11  

This document is retained as a record of the root causes and the reasoning behind the
fixes. See `docs/come-bet-odds.md §8` for the canonical rule statement that prevents
these bugs from re-appearing.

---

## Bug 1 — Come Bet Flat Incorrectly Survived Seven-Out (FIXED)

**Affected scenarios:** 015, 017, 018, 019  
**File:** `src/bets/come-bet.ts`  
**Root cause:** The implementation branched on `table.isPointOn` inside the seven
handler, treating a seven-out (point ON) differently from a come-out seven (point OFF).
The point-ON path called `this.lose()`, zeroing both `amount` and `oddsAmount` — forfeiting
off odds that should have been pushed. A later attempt to fix this introduced a
"flat survives" model where `payOut = 0` signalled settlement to return odds without
removing the bet, which was also wrong.

**The correct rule** (see `come-bet-odds.md §8`):  
Once a come bet has traveled to its own point, a seven **always** loses the flat —
there is no distinction between a seven-out and a come-out seven. The `table.isPointOn`
state is irrelevant. Only `oddsWorking` matters for the odds:

```typescript
// come-bet.ts — correct
} else if (rollValue === 7) {
  if (this.oddsWorking) {
    this.lose();        // flat and odds both forfeited
  } else {
    this.amount = 0;    // flat always lost; oddsAmount preserved for push
  }
}
```

### Scenario Detail (corrected expected values — no double-deduction accounting)

| # | Expected rail | Was wrong at | Delta from wrong value | Notes |
|---|--------------|-------------|------------------------|-------|
| 015 | $80 | $50 | +$30 | come-9 odds pushed not lost |
| 017 | $70 | $110 (doc) | — | flat lost on seven-out; come bet removed; no cm on table for come-out 9 |
| 018 | $170 | $110 | +$60 | two sets of come odds pushed not lost |
| 019 | $235 | $215 (doc) | +$20 | come-8 odds pushed; no double-deduction of pass and come-8 flat |

**Note on scenarios 017 and 019:** The values in `integration-scenarios.md` for these
scenarios contain two errors: (1) the seven-out incorrectly shows "Dealer takes" steps
that double-deduct losses already subtracted at placement, and (2) scenario 017 shows the
come flat surviving the seven-out (incorrect — flat is always lost). The test assertions
use correct accounting; see the "Notes on Document vs. Implementation Accounting" section
below for the general rule.

---

## Bug 2 — DontComeBet Did Not Implement Transit Phase (FIXED)

**Affected scenarios:** 042, 043, 044, 045, 047, 048, 049  
**File:** `src/bets/dont-come-bet.ts`  
**Root cause:** `DontComeBet` extended `DontPassBet` and inherited its
`evaluateDiceRoll` without override. `DontPassBet.evaluateDiceRoll` uses two
phases keyed on `table.isPointOn`:

- **Point OFF (come-out):** checks 2/3/7/11/12 — *correct for DontPass*
- **Point ON (point phase):** wins on 7, loses on `table.currentPoint` — *correct
  for DontPass but **wrong** for DontCome during its transit phase*

When a `DontComeBet` is first placed (the table point is **ON**), the bet is in
transit. During transit it should behave identically to a Don't Pass bet *on the
come-out*: win on 2/3, push on 12, lose on 7/11, and travel to any point number.
The inherited logic saw `table.isPointOn === true` and used the point-phase
branch instead, producing the wrong outcome for every transit roll.

Additionally, once the bet has "traveled" to its own number, it needs to track that
number independently of `table.currentPoint`. The original implementation never set
`this.point` on a `DontComeBet`, so it always compared against the table's pass-line
point rather than the DC's own traveled-to point.

**Fix applied:** Overrode `evaluateDiceRoll` in `DontComeBet` with a two-phase
transit/established model — analogous to how `ComeBet` overrides `PassLineBet`:
1. Transit (`this.point === undefined` while `table.isPointOn`): apply 2/3/7/11/12 rules.
2. When a point number is rolled in transit: set `this.point = rollValue`.
3. Established phase: win on 7, lose when `rollValue === this.point`.
4. Override `win()` to use `this.point` (not `table.currentPoint`) for lay-odds payout.

### Scenario Detail (corrected expected values)

| # | Roll | Expected | Pre-fix actual | Notes |
|---|------|----------|----------------|-------|
| 042 | 7 in transit | DC loses (rail $80) | DC wins (rail $100) | Point ON → DontPass point-phase fired, 7 = win |
| 043 | 11 in transit | DC loses, removed | DC no action, stays | 11 ≠ 7, 11 ≠ currentPoint → ignored |
| 044 | 2 in transit | DC wins (rail $100) | No action (rail $80) | Point ON → come-out branch not reached |
| 045 | 12 in transit | DC pushed (rail $90) | No action (rail $80) | Same — push logic not reached |
| 047 | Own point re-rolled | DC loses, removed | No action, stays | 9 ≠ table.currentPoint(6) |
| 048 | 7-out after travel | Rail $120 | Rail $125 (bug) then $115 (doc) | Doc has double-deduction; lay-odds used point 6 not 9 |
| 049 | Own point re-rolled (+lay odds) | DC loses, removed | No action, stays | Same as 047 |

---

## Summary Table (corrected values — all passing)

| Scenario | Category | Test file | Correct rail | Pre-fix rail | Bug |
|----------|----------|-----------|-------------|--------------|-----|
| 015 | Come Bet | `011-019-come-bet-spec.ts` | $80 | $50 | Bug 1 |
| 017 | Come Bet | `011-019-come-bet-spec.ts` | $70 | $40 | Bug 1 |
| 018 | Come Bet | `011-019-come-bet-spec.ts` | $170 | $110 | Bug 1 |
| 019 | Come Bet | `011-019-come-bet-spec.ts` | $235 | $205 | Bug 1 |
| 042 | Don't Come | `042-049-dont-come-spec.ts` | $80 | $100 | Bug 2 |
| 043 | Don't Come | `042-049-dont-come-spec.ts` | DC removed | DC stays | Bug 2 |
| 044 | Don't Come | `042-049-dont-come-spec.ts` | $100 | $80 | Bug 2 |
| 045 | Don't Come | `042-049-dont-come-spec.ts` | $90 | $80 | Bug 2 |
| 047 | Don't Come | `042-049-dont-come-spec.ts` | DC removed | DC stays | Bug 2 |
| 048 | Don't Come | `042-049-dont-come-spec.ts` | $120 | $125 | Bug 2 |
| 049 | Don't Come | `042-049-dont-come-spec.ts` | DC removed | DC stays | Bug 2 |

---

## Notes on Document vs. Implementation Accounting

Several scenarios in `integration-scenarios.md` show `Dealer takes $X` steps that
*decrease* the rail after a losing bet is resolved. This is a documentation
inconsistency: in the implementation (and in correct craps accounting), a bet's
cost is deducted from the rail **when it is placed**. A subsequent loss does not
produce a second deduction. The integration tests use correct accounting, which
differs from intermediate rail values in the source document for scenarios 011,
017, 019, 020–025, 027, 046, 048, 050–053.

**Scenario 017 additionally** contains a factual error in `integration-scenarios.md`:
it shows the come flat surviving the seven-out (Step 14 "returns $10 come flat").
This is wrong. The flat is always lost on any seven once the come bet has traveled
(see `come-bet-odds.md §8`). The correct final rail for scenario 017 is $70, not $110.

The **net profit/loss** figures stated in the scenario "Resolution" notes are
correct; only the intermediate step-by-step rails are affected by the double-deduction
and flat-survival errors.
