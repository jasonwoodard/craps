# Design Note — Funded Entry, Units, and Run Architecture (v4)

*Status: decisions recorded; two items pending review (§4 units, §5 storage). Supersedes v3. On approval of §4–5, this note converts to a Claude Code work order.*

---

## 1. Decisions log (resolved this revision)

| # | Question | Decision |
|---|---|---|
| 1 | Entry-stage cap | **None.** Consequence-free experimentation; impose no limits not technically warranted. Any entryStage, any B > 0 — even B below the entry gate runs (documented, not blocked) |
| 2 | Seven-out counter at funded entry | Starts at zero; identical semantics across entry configs. Flagged as an observation target in first funded-entry runs |
| 3 | Hard-reset rule (§3.4) | **Retired on implementation** — redundant with Accumulator-band entry |
| 4 | Turbo | Out of main CATS; not currently implemented in the engine (Stage 1b was never built). Future paired experiment parked: "Turbo-Accumulator-only vs Accumulator-only" |
| 5 | Min-ratio units | Proposal in §4 — **pending review** |
| 6 | Output storage | Architecture in §5 — **pending review** |
| 7 | BATS | Same mechanism, zero BATS-specific code — the generality test (§2) |

## 2. Generalized arbitrary stage entry

**Placement: the stage-machine core, not CATS.** Stage predicates already speak "profit"; funded entry redefines its zero point:

- Config: `{ entryStage?: StageId }` on any staged strategy; default = first stage (classic behavior).
- Engine derives **origin = B − gate(entryStage)** once at session start; thereafter `SessionContext.profit = equity − origin`. Stage definitions, gates, and retreat logic are untouched.
- **Generality requirement:** implemented once in the stage machine; CATS and BATS (Dolly ladder) inherit it with no per-strategy code. BATS working unmodified is the acceptance test for "general solution, not CATS solution."
- No validation beyond B > 0. B < gate(entryStage) yields a negative origin — you enter the stage undercapitalized and the physics handles the rest. Documented as a legitimate experimental configuration.
- Accumulator band = [0, origin + gate₁): wide under classic entry (bootstrap), narrow under funded entry (guardrail).

### Naming and UI manifestation

- **Stable slug ids are the keys** (`accumulator`, `littleMolly`, `threePtMollyTight`, `threePtMollyLoose`, `expandedAlpha`, `maxAlpha`); **display names are metadata** (`"3-Point Molly — Loose"`). Keys never change; display names may.
- Canonical string encoding for CLI, URLs, and manifests: `CATS@entry=threePtMollyLoose`. Base name alone (`CATS`) means default entry.
- Stage machines export their stage list + display names + entry gates so UIs render the entry dropdown generically for any staged strategy.
- Comparison tooling accepts multiple strategy specs and runs them on **shared seeds**: `--strategy CATS@entry=accumulator --strategy CATS@entry=threePtMollyLoose` → side-by-side stage metrics, session P&L, and stopping-menu results on identical dice. This is the target workflow.

## 3. Post-hoc stopping — now streaming

Exit rules are stopping times (v3), which enables a stronger form: **evaluate the whole standard menu in one pass during simulation.** Each rule tracks its trigger state per roll; when it fires, its banked P&L is recorded and the session continues playing out for the remaining rules and the played-fully-out baseline. No trajectory persistence is required for the standard menu {none, hard targets kB, trailing floor, fall-below-stage, roll cap}. Trajectory archival is needed only to evaluate *newly invented* rules against *old* runs — a local/CLI workflow, not a serving-path one. Censoring reporting per v3 stands.

## 4. Unit system (REVIEW ITEM)

**u = table minimum** for line bets, gates, and risk; **p = smallest proper place bet ≥ u** (7:6 quantization to $6 increments) for place bets, with explicit rounding instead of implicit fudging.

| Quantity | Canonical spec | $10 | $15 |
|---|---|---|---|
| Pass/Come flat | 1u | $10 | $15 |
| Odds — Little Molly | 2× flat | $20 | $30 |
| Odds — Loose | 5× flat | $50 | $75 |
| Odds — Tight | tier 3×/2×/1× flat | tier | tier |
| Accumulator start (each 6/8) | p + $6 | $18 | $24 |
| Accumulator regressed (each) | p | $12 | $18 |
| Buy 4/10, 5/9 (each) | 2u | $20 | $30 |
| **Gates above origin** | **7u / 15u / 25u / 40u** | $70/150/250/400 | $105/225/375/600 |
| Classic declared risk B | 30u | $300 | $450 |
| Reference funded configs | B 20u @ Tight; B 15u @ Little Molly | $200 / $150 | $300 / $225 |
| Vig | floor(5% of bet), min $1, win-only | $1 | $1 |

Verification: reproduces every v1.2 hand-scaled $10/$15 figure — a formalization, not a change. **Operational-ease note (recorded, not yet optimized for):** unit phrasing is more memorable than dollars — "gates at seven, fifteen, twenty-five, forty minimums; buys are two minimums; flats are one" — and future rule-writing should prefer unit-speak. This is a simulation of a human-executed system; memorability is a real requirement.

## 5. Run architecture and storage (REVIEW ITEM)

**Principle: determinism makes the manifest the archive.** A run is fully reproducible from `{strategySpec, B, rolls, seeds, engineVersion (git sha)}` — a few hundred bytes. Therefore:

| Layer | What persists | Where |
|---|---|---|
| Manifest | Always — embedded in every output | With results / Firestore doc |
| Aggregates (stage metrics, P&L percentiles, stopping-menu results) | Memoized, keyed by manifest hash | Server memory + optional Firestore cache |
| Full trajectories (JSONL) | **Never on the server.** Cache, not data | Local CLI only, on demand, for retroactive rule analysis |

Cloud Run consequences: no files emitted, no accumulating storage, no overwrite problem; a repeated WebUI request is a cache hit or a fast recompute. Existing JSONL records (`equityAfter`, `stagePlayed`) already suffice for local retroactive analysis (v3 OQ-6: closed). Add the manifest block to all output modes; version it.

## 6. Remaining scope for the work order (on §4–5 approval)

1. Stage-machine `entryStage` + origin-based profit; retire hard-reset; counter-at-zero spec
2. Registry parameterization + `@entry=` spec parsing; stage metadata export (slugs, display names, gates)
3. Unit-system module: canonical spec + table-min instantiation ($10/$15), replacing hard-coded dollar literals in CATS/BATS definitions
4. Streaming stopping-menu evaluator in `analyze-stages`; exit-reason distribution, peak-capture, hitting probabilities with censoring
5. Multi-spec comparison mode (shared seeds) in `analyze-stages`
6. Manifest block in all outputs; server-side memoization by manifest hash
7. BATS acceptance test: `BATS@entry=<dolly-stage>` with zero BATS-specific changes
8. Doc updates last: `cats-strategy.md` (unit tables, hard-reset retirement note), `analytics-guide.md` (I/O schemas incl. manifest, evaluator outputs)
