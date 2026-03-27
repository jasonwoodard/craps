# Craps Simulator — User Manual

**Version:** 1.0  
**Audience:** Players familiar with craps who want to understand strategy behavior analytically.

---

## What This Tool Is

The Craps Simulator runs mathematically exact craps strategy simulations and visualizes the results. It is not a game — there are no dice to click, no chips to drag. It is an analytical instrument for understanding how a strategy *behaves* over time: how it wins, how it loses, how it manages risk, and how it compares against alternatives.

The simulator knows craps rules precisely: pass line, come bets, place bets, odds, point resolution, seven-outs — all resolved correctly at every roll. The house edge is what it is. The simulator does not sugarcoat it.

---

## The Sidebar: Your Configuration Panel

The left sidebar is your control panel. It holds the parameters that define *what* you are analyzing:

- **Strategy** — which betting strategy to run (CATS, Three Point Molly, Pass Line Only, etc.)
- **Rolls** — how many dice rolls to simulate (500 is approximately a 4–5 hour table session)
- **Bankroll** — your starting stake in dollars
- **Seed** — a number that pins the dice sequence (see below)

These settings travel with you as you move between pages. When you change strategy in the sidebar and click **Run**, the current page re-runs with the new configuration. The Distribution page runs a distribution analysis of the new strategy. The Compare page uses the new strategy as one of the two being compared.

**The Run button is page-aware.** It does not always take you to the Session page. It re-runs the current analysis — whatever page you are on — with the current sidebar settings.

---

## Seeds: Pinning the Dice

A **seed** is a number that controls the dice sequence. Two runs with the same seed produce identical dice — every roll, in the same order. A run with no seed gets a random dice sequence every time.

This matters because it lets you answer questions that would otherwise be impossible:

- *Does CATS outperform Three Point Molly, or did CATS just get luckier dice?* — Run both on the same seed. Same dice, different strategies. The comparison is fair.
- *How does CATS behave on a bad table?* — Find a seed with a rough session, pin it, explore it from every angle.
- *Did my code change actually improve the strategy?* — Pin a seed, run before and after. The dice are controlled, so any difference is real.

When you run a simulation without entering a seed, the simulator generates one and **writes it to the URL**. This means every completed run is reproducible — you can copy the URL, share it, or return to it later and see exactly the same result.

To get a fresh random run, clear the seed field and click Run again.

---

## The Three Pages

### Session — What Happened

The Session page shows a single simulation run in full detail. It is the place to understand *one specific session* — one strategy, one set of dice, from roll 1 to roll N.

**What you see:**

The **Summary Panel** at the top gives you the headline numbers: net change, peak bankroll, trough, max drawdown, win/loss roll counts, average table load. These are the stats a serious player would want after any session.

The **Session Chart** shows bankroll and table load over time. The bankroll line tells the session story — where it climbed, where it fell, how it ended. The table load line is a proxy for strategy intensity: a flat $24 line means you're grinding the Accumulator; a jump to $60 or $180 means CATS stepped up into the Molly stages. Seven-outs are marked in red; points made in green.

For CATS and other multi-stage strategies, the chart adds **stage color bands** behind the data — each stage has a distinct background color so you can see at a glance how long the session spent in each phase and when transitions happened.

Below the chart, the **Stage Breakdown Table** lists every stage visit as a row: which stage, which rolls, how long, what it cost or earned. This table reveals patterns that the chart cannot — for example, that Little Molly is almost always a 1–2 roll tollbooth rather than a sustained phase, or that a single long Accumulator Regressed visit is doing most of the session's work.

The **Stage Overlay Charts** take each stage and overlay all visits to it on a common timeline starting at zero. If Little Molly's 26 visits are a tight cluster of similar lines, the stage is behaving consistently. If they fan out wildly, variance is dominating. This is the question no summary statistic can answer.

The **Trend Indicators** at the bottom show momentum signals: a rolling 24-roll P&L line, proximity to CATS's step-up and step-down thresholds, and the consecutive seven-out counter that drives CATS's retreat rules.

**URL:** `/session?strategy=CATS&rolls=500&bankroll=300&seed=7`

---

### Distribution — What Typically Happens

The Distribution page runs the same strategy hundreds of times across different dice sequences and shows you the *range of outcomes*. It answers the questions a single session cannot:

- What does a typical session look like?
- How often does this strategy end profitable?
- When does ruin typically happen if it happens at all?
- What bankroll peak should I expect on a good session?

**Seed presets:**

| Preset | Seeds | Best for |
|---|---|---|
| Quick | 200 | Fast exploration, rough shape |
| Standard | 500 | Reliable P10/P50/P90 estimates |
| Deep | 1000 | Stable tail behavior |

The **Band Chart** is the headline visual. Three lines — P10, P50, P90 — show bankroll over time across all runs. P50 is the median session: half of all runs finished above this line, half below. P10 is the typical bad session. P90 is the typical good one. Watch the bands as seeds accumulate — they start noisy and stabilize into a clear picture of the strategy's variance structure.

The **Outcome Summary** shows aggregate statistics: median final bankroll, win rate (sessions ending above buy-in), ruin rate (sessions reaching $0), median peak bankroll, and the median roll at which that peak occurred. That last number is particularly useful — if the typical session peaks around roll 200, walking away at your high point in the first half of a session is statistically well-timed.

The **Ruin Curve** shows probability of ruin as a function of roll number. A strategy that ruins quickly on bad seeds looks very different from one that grinds slowly to zero. This curve tells you how long your bankroll protection typically lasts.

Results stream in progressively as seeds complete. The page is live — you are watching statistical convergence happen in real time.

**URL:** `/distribution?strategy=CATS&rolls=500&bankroll=300&seeds=500`

---

### Compare — Same Dice, Different Strategies

The Compare page runs two strategies on **identical dice** and shows the results side by side. This is the only fair way to compare strategies — holding luck constant so that any difference in outcome is purely a function of betting decisions.

This is what `SharedTable` does under the hood: one dice sequence, two independent bankrolls and bet sets. Roll 47 produces the same number for both strategies. What they do with it is up to them.

**What you see:**

The **Head-to-Head Chart** shows both bankroll lines on the same axes. Where the lines diverge is where the strategies made different decisions on the same roll. A strategy that steps up into higher odds at the right moment will separate itself visibly from one playing flat.

The **Side-by-Side Summary** shows the headline stats for each strategy next to each other. The net change delta — how much better or worse one strategy did — is shown prominently.

The **Dice Verification** panel confirms that both strategies saw identical dice. This is not just a trust-but-verify note — it is the mathematical guarantee that makes the comparison meaningful.

For CATS comparisons, the **Stage Breakdown** shows CATS's full stage visit history alongside the other strategy's flat session. This is where the structural difference becomes visceral: CATS's 65-row stage table next to Three Point Molly's undifferentiated grind on the same dice makes the complexity tradeoff visible.

**URL:** `/compare?strategies=CATS,ThreePointMolly3X&rolls=500&bankroll=300&seed=7`

---

## Navigation and URLs

Every analytical state in the simulator is a URL. This is intentional.

A URL like `/session?strategy=CATS&rolls=500&bankroll=300&seed=7` is a complete description of a simulation. You can bookmark it, share it, or return to it a week later and see exactly the same result. The dice are pinned, the strategy is specified, the parameters are explicit.

**Moving between pages preserves your configuration.** If you are looking at a CATS Distribution analysis and navigate to Compare, the sidebar still shows CATS as Strategy A — you are continuing the same analytical thread, not starting over.

**The sidebar Run button is page-aware.** On the Session page, Run runs a session. On the Distribution page, Run runs a distribution analysis. On the Compare page, Run runs a comparison. The page you are on defines what kind of analysis Run executes.

---

## A Typical Analytical Session

Here is how an experienced user might work through a strategy evaluation:

1. **Start on Session.** Pick CATS, 500 rolls, $300 bankroll. Run a few random seeds to get a feel for how sessions look. Find an interesting one — a session that reached Three Point Molly Loose, or a brutal grind that never escaped the Accumulator.

2. **Pin the seed.** The URL now contains the seed. Bookmark it. This is your reference session.

3. **Explore it on Session.** Read the Stage Breakdown table. Look at the Overlay charts. Does Little Molly behave consistently across visits? When did the Threshold Proximity signal approach the step-down line?

4. **Go to Distribution.** Run Standard (500 seeds) to understand the strategy's typical behavior. Is the reference session a typical outcome or an outlier? Where does it sit on the P10/P50/P90 bands?

5. **Go to Compare.** Use the pinned seed. Run CATS against Three Point Molly 3X on the same dice. Did CATS outperform because of its structure, or despite it? The stage breakdown makes this question answerable.

6. **Change the strategy in the sidebar.** Switch to a different variant or strategy. The current page re-runs with the new configuration. The seed stays pinned — you are now comparing analytical runs on controlled dice.

---

## A Note on House Edge

The simulator does not offer winning strategies. The house edge is real and does not negotiate. What the simulator offers is *clarity about variance* — understanding when a strategy's structure helps you manage a losing game in a way that fits your style and session goals.

A strategy that has a 35% chance of ending a session profitable is not a winning strategy. It is a strategy with a particular variance profile that happens to suit some players' preferences. The Distribution page makes this profile explicit rather than leaving it to imagination or folklore.

The goal is informed play, not magical thinking.
