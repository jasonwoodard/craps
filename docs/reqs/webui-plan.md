# Web UI Plan — Analytics Surfacing, Strategy Pages, and the Mobile Reference

*Spec for the next Web UI evolution of the craps simulator (`craps.jasonwoodard.com`). Executable in three phases (W1–W3), each a self-contained Claude Code iteration with acceptance criteria and required tests. Engine changes are out of scope for all phases — this is web/ and server/ surface only, consuming Phase 3 capabilities (funded entry, units, stopping evaluator, comparison, manifests).*

---

## 1. Product architecture: two surfaces, one domain

| Attribute | Desktop Analytics App (existing) | Mobile Reference (new) |
|---|---|---|
| Job | Explore and compare strategy behavior; interpret distributions | Review CATS at the table, 60 seconds before buy-in |
| Audience posture | Seated, large screen, analytical | Standing in a casino, one thumb |
| Route | `/` and current pages | `/reference` |
| Density | High — charts, tables, comparisons | Minimal — one config, one ladder, big type |
| Mobile behavior | Not designed for mobile (intentional) | Mobile-first exclusively |

Root behavior: mobile visitors to `/` are auto-redirected to `/reference` (viewport-based detection), with a "Full site" link at the bottom of the reference that sets a session opt-out (no redirect loop). Desktop nav gains a "Reference" link so the surface is findable from the big app too.

## 2. Information architecture (target nav)

Session · Session Compare · Distribution · Dist. Compare · **Exit Rules** (new) · Strategies (**overview → per-strategy pages**) · Guide · **Reference** (link out to mobile surface)

Top control bar (all analytics pages): Strategy · **Entry Stage** (new — populated from stage metadata; renders for staged strategies only) · **Table Min** (new: $10/$15/$25 presets + free entry) · Rolls · Bankroll · Seed/Seeds. Every result view displays a **manifest chip** (compact, expandable, copy-as-JSON) — run identity surfaced as a first-class UI element.

Canonical spec strings (`CATS@entry=threePtMollyLoose`) are the URL/state currency: all pages read and write them in query params, so any view is shareable and reproducible.

---

## Phase W1 — Foundation and Strategy Pages

**Scope**

1. **Web test harness** (prerequisite for everything): Vitest + React Testing Library for components; Playwright for smoke/E2E including a mobile-viewport project. CI runs both. (The repo currently has no web tests — establishing the harness is W1's first commit.)
2. **Stage metadata to the frontend.** Single source of truth: the engine's stage metadata export and `src/dsl/units.ts`. Preferred seam: direct TypeScript import into the web build (same repo); fallback if the build boundary resists: a small `GET /api/meta/strategies` endpoint. Either way, **no duplicated stage lists, display names, gates, or dollar tables anywhere in web/** — enforced by test (see below).
3. **Controls upgrade:** Entry Stage dropdown (display names from metadata; slugs in state/URLs), Table Min control, spec-string round-tripping in URLs, manifest chip component rendered on Session and Distribution pages.
4. **Strategies restructure:** overview page (cards per strategy) linking to `/strategies/cats` and `/strategies/bats`. The CATS page is the abridged "What is CATS": what it is and the correct acronym; the ladder as a table in units with $10/$15 columns; entry configurations (classic vs funded, with the sizing rule "B and the stage you buy into"); the rules that matter (regression, two-consecutive-7-outs as pre-commitment, the Swap Rule); a "what simulation shows" teaser (3–4 headline numbers with their manifest); a link to the full `strategy/cats-strategy.md` on GitHub as source of truth. The BATS page follows the same template from Dolly metadata + short prose, badged **Draft** (the BATS strategy doc is not yet at publication quality — content parity is not required, structural parity is).

**Acceptance criteria**

- `npm run test:web` and a Playwright smoke suite exist, pass, and run in CI.
- Selecting "CATS — Entry: 3-Point Molly (Loose)" produces a Session run whose manifest chip shows `strategySpec: CATS@entry=threePtMollyLoose`; the URL round-trips (paste → identical config).
- Entry dropdown options and every dollar figure on the CATS strategy page are *derived* from metadata/units — the **units-parity test** renders the page/dropdown and asserts equality with `units.ts` output at $10 and $15. This test is the anti-drift keystone for all three phases.
- Table Min changes propagate to run requests and the manifest.
- Strategy pages render at `/strategies/cats` and `/strategies/bats`; overview links to both; acronym correct everywhere.

**Required tests:** units-parity (component ↔ units.ts); spec round-trip (URL ↔ state ↔ manifest); metadata contract test (shape of the import/endpoint); Playwright smoke: load each nav destination, run one CATS session, assert manifest chip present.

---

## Phase W2 — Analytics Surfacing (Exit Rules and the Entry Race)

**Scope**

1. **Exit Rules page** (new nav destination), driven by the streaming stopping evaluator via the server: for the configured spec(s) — banked P&L per rule (p10/p50/p90 grouped bars), trigger/ruin/censored breakdown per rule (stacked bar), peak-capture ratio per rule, hitting probabilities P(2·B/3·B/6·B) with censored fraction stated, and the peak-equity distribution itself. Every chart footnoted with its manifest. Copy explains rules in plain language ("walk at double your buy-in") with unit phrasing where natural.
2. **Entry Race preset:** on Session Compare and Dist. Compare, a one-click preset pitting `CATS@entry=accumulator` vs `CATS@entry=threePtMollyLoose` on shared seeds; compare pages accept arbitrary spec strings generally (any `NAME@entry=...`, including BATS).
3. **Session/Distribution additions:** exit-reason breakdown and peak-P&L overlay where the data is already returned; stage-reach funnel gains funded-entry awareness (stages below entry render as "—", matching CLI semantics).
4. **Server:** endpoints (or extensions) exposing analyze/compare/stopping aggregates, memoized by manifest hash via the existing `server/lib/memo.ts`; no trajectory persistence (per `docs/reqs/session-lifecycle.md` §5).

**Acceptance criteria**

- Exit Rules page reproduces, for a pinned manifest (fixed seeds), the exact CLI numbers from `analyze-stages` — a **CLI-parity fixture test** (same manifest → same JSON → rendered values match to the dollar).
- The Entry Race preset returns both specs computed on shared seeds (asserted via manifest seed fields) and renders side-by-side.
- Censoring is always displayed wherever hitting probabilities appear (UI may not omit it).
- Repeated identical requests hit the memo cache (assert via response header or timing flag exposed for tests).
- No chart renders without its manifest footnote.

**Required tests:** CLI-parity fixture (golden JSON committed with its manifest); API contract tests for new endpoints; component tests for Exit Rules charts from fixture data; Playwright: run the Entry Race preset end-to-end.

---

## Phase W3 — The Mobile Reference

**Scope**

1. **`/reference` route, mobile-first.** Inputs: Table Min ($10/$15/$25 presets + free entry) and Entry Stage (display names). Outputs, all derived live from `units.ts` + stage metadata (never hardcoded):
   - **The equity ladder** — the centerpiece: actual dollar thresholds for this config. Origin = B − gate(entry); each stage row shows its step-up and step-down equity levels ("with $200 in, entering Tight at $10: step up to Loose at $300 total, retreat below $250"), rendered as rack-plus-felt numbers a player can compare to the chips in front of them.
   - **Suggested buy-in options:** minimum viable B for the chosen entry, plus the reference risk levels (15u / 20u / 30u) with one-line characterizations; free-entry B recomputes the ladder.
   - **Per-stage board cards**, swipeable, in dealer-speak: "Place 6 & 8 at $18 each; after first hit, regress to $12 each"; "Pass $10 + one Come, 2× odds"; Buy amounts with vig noted. Plus the always-on rules card: two-consecutive-7-outs step-down, the Swap Rule, and "money that must not be bet is not on the table."
2. **Discoverability:** root auto-redirect for mobile viewports with sessionStorage opt-out; "Full site" link at the reference's foot; "Reference" link in desktop nav; shareable config URLs (`/reference?min=15&entry=threePtMollyTight&b=300`).
3. **PWA-lite:** web manifest + icons so "Add to Home Screen" yields a clean standalone launch (no service worker/offline scope in this phase).

**Acceptance criteria**

- Playwright mobile-viewport suite: visiting `/` at phone viewport lands on `/reference`; "Full site" opts out for the session (no redirect loop on back-navigation); direct desktop visits to `/` are never redirected.
- Units-parity test extended to the reference: for ($10, $15, $25) × every entry stage, all rendered dollar figures equal `units.ts`/metadata computations — zero hardcoded dollars in the reference components (enforced additionally by a lint/grep check for dollar literals in `web/src/reference/`).
- Ladder correctness fixture: for B=$200, min=$10, entry=Tight — origin $50; step-up thresholds $300/$450(?)… *(fixture values generated from units.ts at implementation time and committed; the test asserts render == fixture == live computation, catching both drift directions)*.
- Config URL round-trips; changing B recomputes the ladder without reload.
- Lighthouse mobile usability passes (tap targets, viewport, font sizes) on `/reference`.
- The reference contains no analytics charts — scope discipline: it is a card, not a dashboard.

**Required tests:** redirect matrix (mobile/desktop × direct/opt-out); reference units-parity across min × entry grid; ladder fixture; URL round-trip; PWA manifest presence smoke.

---

## Cross-phase guardrails

- **Engine untouched.** Any discovered engine need is flagged, not implemented — it goes back through a design note.
- **Single source for numbers.** `units.ts` + stage metadata are the only origins of stage names, gates, and dollar amounts anywhere in web/. The units-parity tests are the enforcement mechanism and must never be weakened to pass.
- Manifests everywhere a number is shown; spec strings everywhere state is shared.
- One focused commit per scope item; each phase ends with the full test suite (engine + web + Playwright) green and a short summary of deviations.

## Open items (defaults chosen; change before W1 if desired)

1. BATS page ships structurally complete, content-thin, badged Draft — *default: yes*.
2. Free-entry table minimums accepted (any value ≥ $5) with place-bet arithmetic handled by `minPlaceBet` — *default: yes*.
3. Redirect is automatic (not an interstitial banner) — *default: yes, with the opt-out*.
4. PWA-lite in W3 (manifest only, no offline) — *default: yes*.
