# Craps Simulator — UX Polish Queue

**Date:** April 2026  
**Purpose:** Queue of UX refinement tasks for Claude Code. Each item is self-contained and
independently implementable. No item requires architectural changes.

---

## UX-1 — Remove top navigation and sidebar collapse

**Files:** `web/src/components/Shell.tsx`, related CSS/Tailwind

Remove the top nav bar entirely. Remove the sidebar collapse toggle — the sidebar is always
expanded, no icon-rail state.

The sidebar already contains the Run button and all simulation controls. The top nav duplicated
page links that are accessible via the sidebar. At current scale (four pages, single-user tool)
the nav adds chrome without adding utility.

**What to keep:**
- Sidebar itself (always expanded, fixed width)
- Page links inside the sidebar
- All `RunControls` content

**What to remove:**
- `<nav>` top bar with `NavLink` items
- Collapse toggle button
- All collapsed/expanded `useState` and conditional rendering for sidebar width
- The 48px icon-rail state

**Acceptance:**
- All pages navigable via sidebar links
- No top bar visible
- Sidebar is fixed width, no toggle
- `npm test` passes

---

## UX-2 — Strategies page

**New file:** `web/src/pages/StrategiesPage.tsx`  
**Route:** `/strategies`  
**Sidebar link:** Add "Strategies" to sidebar nav, below the four analysis pages, separated by
a subtle divider.

A documentation page describing each named strategy available in the simulator. Content is
static — no API calls, no simulation. The goal is to give a new user enough context to
understand what they are selecting before they run anything.

**Page structure:**

One section per strategy, in the same order they appear in the strategy dropdown. Each section:

```
[Strategy Name]                          ← h2, monospace, matches app type style
[One-sentence description]               ← what kind of player this is for

Bets & Structure
[Prose description of what bets are placed and when — 3–6 sentences]

Stages                                   ← only for stage-machine strategies (CATS)
[Table or list of stage names with brief description of each]

House Edge
[Dominant bet type and approximate edge — e.g. "Place 6/8: 1.52%"]
```

**Strategies to document** (use `GET /api/strategies` order as canonical):

- **PassLineOnly** — Flat pass line bet with no odds. The simplest possible craps strategy. Useful as a baseline for comparison.
- **ThreePointMolly2X** / **ThreePointMolly3X** — Pass line plus two come bets, each backed with 2X or 3X odds. Classic aggressive come-bet strategy.
- **Place6And8** — Place bets on 6 and 8 only. No pass line, no come bets. Pure number-frequency play.
- **CATS** — Five-stage escalating strategy. Starts conservative (Accumulator) and escalates through Little Molly and Three Point Molly variants as the session profit grows. Full stage descriptions below.

**CATS stage table:**

| Stage | Entry condition | Bets active |
|---|---|---|
| Accumulator Full | Session start | Pass line + 1X odds |
| Accumulator Regressed | After first point made | Pass line + 1X odds, regressed |
| Little Molly | +$70 net | Pass line + 1 come + odds |
| Three Point Molly Tight | +$150 net | Pass line + 2 come + odds |
| Three Point Molly Loose | +$250 net | Pass line + 2 come + max odds |

Step-down rules mirror step-up thresholds — two consecutive 7-outs at any Molly stage triggers
a retreat to the prior stage.

**Acceptance:**
- Page renders with no API calls
- All strategies documented with bet structure and house edge
- CATS stage table present and accurate
- Sidebar link navigates to `/strategies`
- `RunControls` Run button on this page navigates to `/session` (strategy pages don't run simulations)

---

## UX-3 — Section heading info icons

Add a small ⓘ icon after major section headings that reveals a plain-language explanation of
the chart or panel on hover.

**Implementation:**

New component: `web/src/components/InfoTip.tsx`

```tsx
interface InfoTipProps {
  text: string;  // plain-language explanation
}
```

Renders as a gray circle ⓘ icon (`text-slate-400`, `hover:text-slate-600`) inline after the
heading text. On hover: a small popover with `text` content. Use Tailwind's group hover or a
simple `useState` show/hide — no external tooltip library needed.

**Headings to annotate and their tooltip text:**

| Heading | Page | Tooltip |
|---|---|---|
| Bankroll Percentile Bands | Distribution, Distribution Compare | "Shows the range of bankroll outcomes across all simulated sessions. P10 = a bad session (only 10% did worse). P50 = the median session. P90 = a good session (only 10% did better)." |
| Outcome Summary | Distribution | "Aggregate statistics across all sessions. Win rate = sessions that ended above buy-in. Ruin rate = sessions that reached $0." |
| Ruin Curve | Distribution | "Probability of going broke by a given roll number. A steep early curve means the strategy is vulnerable to quick losses. A flat curve means it holds up over time." |
| Outcome Delta | Distribution Compare | "Side-by-side comparison of key stats. Green delta = the test strategy is better on this metric. Red delta = the baseline is better. A strategy can win on some metrics and lose on others." |
| Stage Breakdown | Session | "Every visit to every stage, in order. One row per visit. Shows how the strategy actually moved through its phases — which stages lasted longest, which were costly, which were productive." |
| Stage Overlay | Session | "All visits to each stage aligned to a common start point (T0). A tight cluster means the stage behaves consistently. A wide fan means high variance between visits." |
| Trend Indicators | Session | "Recent momentum signals. Rolling P&L shows the last 24 rolls. Threshold proximity shows how close the current bankroll is to a CATS stage transition. The 7-out counter tracks consecutive losses." |
| Shooter Heat | Session | "Dice heat by window of rolls, using a phantom pass-line rubric. Green = shooters were making points. Red = shooters were sevening out. Gray = choppy, no clear signal." |

**Acceptance:**
- `InfoTip` renders as ⓘ only — no `?` variant
- Icon does not shift heading layout
- Tooltip appears on hover, disappears on mouse-out
- All listed headings annotated
- Mobile: tooltip accessible on tap

---

## UX-4 — Page subtitle line

Add a single-line subtitle below the page heading and above the strategy/params statement on
each page. Crisp, functional, tells the user what this page is for.

**Subtitles:**

| Page | Subtitle |
|---|---|
| Session | See how a strategy plays out over a single session. |
| Session Compare | Compare two strategies on identical dice. |
| Distribution | See the range of outcomes across hundreds of sessions. |
| Distribution Compare | Compare how two strategies' outcome profiles differ. |
| Strategies | Understand what each strategy bets and how it escalates. |
| Guide | How to use the simulator and what everything means. |

**Placement:** Between the `<h1>` page title and the params line (e.g. "CATS · 500 rolls · $300
buy-in · seed 693414"). Same font size as the params line, `text-slate-500`.

**Acceptance:**
- Subtitle visible on all pages
- Does not interfere with params line below it
- Correct text per page

---

## UX-5 — Guide page

**New file:** `web/src/pages/GuidePage.tsx`  
**Route:** `/guide`  
**Sidebar link:** Add "Guide" to sidebar nav, below "Strategies", same divider group.

Renders the content of `docs/craps-simulator-user-manual.md` as a styled page. Static content,
no API calls.

Content is already written — see `docs/craps-simulator-user-manual.md` (v2.0). Render it as
formatted prose with section headings matching the app's typographic style.

**Sections to include:**
- What This Tool Is
- Seeds: Pinning the Dice
- The Pages (Session, Session Compare, Distribution, Distribution Compare, Strategies)
- Navigation and URLs
- A Typical Analytical Session
- A Note on House Edge

**Acceptance:**
- Page renders with all manual sections
- Section headings styled consistently with app
- Sidebar link label is "Guide", route is `/guide`
- Readable at 1280px width
