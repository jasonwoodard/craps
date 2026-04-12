# Failing Integration Scenarios

**Generated from:** `spec/integration/**/*-spec.ts`  
**Test run:** 515 specs, **11 failures**  
**All failures are genuine implementation bugs** (test setup errors were corrected during authoring).

---

## Bug 1 — Come Bet Odds Lost on Seven-Out (should be Pushed)

**Affected scenarios:** 015, 017, 018, 019  
**File:** `src/bets/come-bet.ts`  
**Root cause:** `ComeBet.evaluateDiceRoll` calls `this.lose()` on a regular seven-out
(`table.isPointOn === true`). `lose()` zeros **both** `amount` and `oddsAmount`.
Under real craps rules, come-bet odds that are **OFF** (the default) are *not at risk*
on a seven-out — they must be returned to the player (pushed), not forfeited.

```typescript
// come-bet.ts — current (buggy)
} else if (rollValue === 7) {
  if (table.isPointOn) {
    // Seven-out: base AND odds both lose.   ← BUG: odds should be returned if OFF
    this.lose();
  }
```

**Expected fix:** When `table.isPointOn && rollValue === 7`, only zero `amount` if
`!this.oddsWorking`. Preserve `oddsAmount` so the engine/helper returns it to the player.

### Scenario Detail

| # | Expected rail | Actual rail | Delta |
|---|--------------|-------------|-------|
| 015 | $80 | $50 | −$30 (come odds lost, not pushed) |
| 017 | $110 | $40 | −$70 (compounded: odds lost on seven-out AND come-out hit with zero odds) |
| 018 | $170 | $110 | −$60 (two sets of come odds lost, not pushed) |
| 019 | $215 | $205 | −$10 (come-8 odds lost after come-5 made correctly) |

---

## Bug 2 — DontComeBet Does Not Implement Transit Phase

**Affected scenarios:** 042, 043, 044, 045, 047, 048, 049  
**File:** `src/bets/dont-come-bet.ts`  
**Root cause:** `DontComeBet` extends `DontPassBet` and inherits its
`evaluateDiceRoll` without override. `DontPassBet.evaluateDiceRoll` uses two
phases keyed on `table.isPointOn`:

- **Point OFF (come-out):** checks 2/3/7/11/12 — *correct for DontPass*
- **Point ON (point phase):** wins on 7, loses on `table.currentPoint` — *correct
  for DontPass but **wrong** for DontCome during its transit phase*

When a `DontComeBet` is first placed (the table point is **ON**), the bet is in
transit. During transit it should behave identically to a Don't Pass bet *on the
come-out*: win on 2/3, push on 12, lose on 7/11, and travel to any point number.
But the inherited logic sees `table.isPointOn === true` and uses the point-phase
branch instead, producing the wrong outcome for every transit roll.

Additionally, once the bet has "traveled" to its own number, it needs to track that
number independently of `table.currentPoint`. The current implementation never sets
`this.point` on a `DontComeBet`, so it always compares against the table's pass-line
point rather than the DC's own traveled-to point.

### Scenario Detail

| # | Roll | Expected | Actual | Notes |
|---|------|----------|--------|-------|
| 042 | 7 in transit | DC **loses** | DC **wins** | Point ON → DontPass point-phase fires, 7 = win |
| 043 | 11 in transit | DC **loses** | No action | 11 ≠ 7, 11 ≠ currentPoint → ignored |
| 044 | 2 in transit | DC **wins** | No action | Point ON → come-out branch not reached |
| 045 | 12 in transit | DC **pushed** | No action | Same — push logic not reached |
| 047 | Own point re-rolled | DC **loses** | No action | 9 ≠ table.currentPoint(6) |
| 048 | 7-out after travel | Rail **$110** | **$125** | Lay-odds payout uses point 6 not 9; pays $25 instead of $20 |
| 049 | Own point re-rolled (+ lay odds) | DC **loses** | No action | Same as 047 |

**Expected fix:** Override `evaluateDiceRoll` in `DontComeBet` to implement a
two-phase transit/established model — analogous to how `ComeBet` overrides
`PassLineBet` — that:
1. In transit (`this.point === undefined` while `table.isPointOn`): apply 2/3/7/11/12 rules.
2. When a point number (4–6, 8–10) is rolled in transit: set `this.point = rollValue`.
3. In the established phase: win on 7, lose when `rollValue === this.point`.
4. Use `this.point` (not `table.currentPoint`) for lay-odds payout calculation.

---

## Summary Table

| Scenario | Category | Test file | Expected | Actual | Bug |
|----------|----------|-----------|----------|--------|-----|
| 015 | Come Bet | `011-019-come-bet-spec.ts` | $80 | $50 | Bug 1 |
| 017 | Come Bet | `011-019-come-bet-spec.ts` | $110 | $40 | Bug 1 |
| 018 | Come Bet | `011-019-come-bet-spec.ts` | $170 | $110 | Bug 1 |
| 019 | Come Bet | `011-019-come-bet-spec.ts` | $215 | $205 | Bug 1 |
| 042 | Don't Come | `042-049-dont-come-spec.ts` | rail $80 | rail $100 | Bug 2 |
| 043 | Don't Come | `042-049-dont-come-spec.ts` | DC removed | DC stays | Bug 2 |
| 044 | Don't Come | `042-049-dont-come-spec.ts` | rail $100 | rail $80 | Bug 2 |
| 045 | Don't Come | `042-049-dont-come-spec.ts` | rail $90 | rail $80 | Bug 2 |
| 047 | Don't Come | `042-049-dont-come-spec.ts` | DC removed | DC stays | Bug 2 |
| 048 | Don't Come | `042-049-dont-come-spec.ts` | rail $110 | rail $125 | Bug 2 |
| 049 | Don't Come | `042-049-dont-come-spec.ts` | DC removed | DC stays | Bug 2 |

---

## Notes on Document vs. Implementation Accounting

Several scenarios in `integration-scenarios.md` show `Dealer takes $X` steps that
*decrease* the rail after a losing bet is resolved. This is a documentation
inconsistency: in the implementation (and in correct craps accounting), a bet's
cost is deducted from the rail **when it is placed**. A subsequent loss does not
produce a second deduction. The integration tests have been written using correct
accounting, which differs from some intermediate rail values shown in the document
(scenarios 011, 020–025, 027, 046, 050–053).

The **net profit/loss** figures stated in the scenario "Resolution" notes are
correct; only the intermediate step-by-step rails are affected.
