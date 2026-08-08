# CATS: Craps Alpha-Transition Strategy

**Version:** 1.2  | Copyright 2026 Jason Woodard

**Table Basis:** $10 / $15 minimum, 5× odds  

**Status:** Complete — v1.2 correctness pass: standardized edge metrics (per-bet combined edge + expected loss per 100 rolls), corrected §1.1 and Turbo figures, reconciled Tight Molly loads, added §3.7 accounting definitions and §4 simulation findings

---

> **How to read this document**
>
> This document has three layers, meant to be read in order — or returned to independently as your understanding deepens.
>
> **§1–2 Mathematics** — the invariants. House edge, probability, variance. These do not negotiate. Read this to understand *why* the strategy is structured the way it is.
>
> **§3–4 Operations** — the playbook. Exact bet amounts, stage thresholds, step-up and step-down rules. Learn this rote. At the table, you follow the operations.
>
> **§5 Art of the Math** — the art. Once you know the operations cold and understand the math, this section is about judgment: reading a table, knowing when to color inside or outside the lines, understanding what you are actually trying to accomplish. This is where the strategy becomes yours.

---

# §1 Mathematical Foundations

## 1.1 Dice Combinatorics

Two dice produce 36 equally likely outcomes. Everything in craps flows from this table.

| Sum | Ways | Probability | Key significance |
|---|---|---|---|
| 2 | 1 | 2.78% | Craps (lose on come-out) |
| 3 | 2 | 5.56% | Craps (lose on come-out) |
| 4 | 3 | 8.33% | Point number |
| 5 | 4 | 11.11% | Point number |
| 6 | 5 | 13.89% | Point number — highest non-7 frequency |
| 7 | 6 | 16.67% | Natural (win on come-out) / 7-out (lose on point) |
| 8 | 5 | 13.89% | Point number — highest non-7 frequency |
| 9 | 4 | 11.11% | Point number |
| 10 | 3 | 8.33% | Point number |
| 11 | 2 | 5.56% | Natural (win on come-out) |
| 12 | 1 | 2.78% | Craps (lose on come-out for Pass and Come; push for Don't Pass/Don't Come) |

The 7 appears more than any other number. This is not bad luck — it is the structural fact that every other strategic decision rests on.

### Come-Out Roll

| Outcome | Numbers | Probability |
|---|---|---|
| Natural — Pass wins | 7, 11 | 22.22% |
| Craps — Pass loses | 2, 3, 12 | 11.11% |
| Point established | 4, 5, 6, 8, 9, 10 | 66.67% |

---

## 1.2 Sample Space Reduction & Point Resolution

Once a point is established, only two outcomes matter for resolving that bet: the point number and the 7. All other rolls are irrelevant — they extend the hand without resolving anything.

**P(win before 7) for each point:**

| Point | Ways to win | Ways to lose (7) | Reduced space | P(win) |
|---|---|---|---|---|
| 4 or 10 | 3 | 6 | 9 | 33.3% |
| 5 or 9 | 4 | 6 | 10 | 40.0% |
| 6 or 8 | 5 | 6 | 11 | 45.5% |

The denominator is always (ways to make point + 6). The 7 always has 6 ways. Only the numerator varies. This is why 6 and 8 are the most favorable point numbers — they have the best win-to-loss ratio in the reduced sample space.

---

## 1.3 House Edge by Bet Type

All CATS stages are built from bets at the top of this table. Every bet below the dividing line is either unused in CATS or explicitly forbidden.

| Bet | House Edge | CATS Stage |
|---|---|---|
| **Pass / Come + 5× flat Odds** | **0.33%** | Stage 3: 3-Point Molly (Loose) |
| Pass / Come + 2× Odds | 0.61% | Stage 2: Little Molly |
| Pass / Come + 1× Odds | 0.85% | Stage 2: Little Molly (conservative) |
| Pass / Come (flat only) | 1.41% | Entry cost — unavoidable |
| Don't Pass (flat only) | 1.36% | BATS baseline — see §6 |
| **Buy 4 or 10 (vig on win only)** | **1.67%** | Stage 4: Expanded Alpha |
| **Place 6 or 8** | **1.52%** | Stage 1: Accumulator |
| Buy 5 or 9 (vig on win only) | 2.00% | Stage 5: Max Alpha |
| ——— | ——— | ——— |
| Place 5 or 9 | 4.00% | Not used |
| Place 4 or 10 | 6.67% | Never — Buy instead |
| Field (12 pays 3:1) | 2.78% | Not used |
| Field (12 pays 2:1) | 5.56% | Never |
| Hardway 6 or 8 | 9.09% | Never |
| Hardway 4 or 10 | 11.11% | Never |
| Big 6 / Big 8 | 9.09% | Never — strictly worse than Place 6/8 |
| Any 7 | 16.67% | Never |

> **The Odds Bet** is the only bet in any casino with zero house edge — paid at exact mathematical true odds. CATS stages are specifically designed to maximize the proportion of total table load carried in odds bets.

---

## 1.4 Blended House Edge

When multiple bets are live simultaneously, no single "house edge" number describes the position. CATS uses two metrics, each answering a different question. Earlier drafts mixed them, which produced three different figures for the same configuration. v1.2 standardizes.

**Metric 1 — Combined edge per bet resolved.** Expected loss divided by total money wagered, per resolved pass/come decision. Odds are counted only for the ~2/3 of decisions where a point exists. This is the standard casino-literature figure and answers: *how efficient is this configuration per dollar I actually wager?*

$$\text{Combined edge} = \frac{1.41\%}{1 + k \cdot \tfrac{2}{3}} \quad \text{(flat } k\times \text{ odds)}$$

**Metric 2 — Expected loss per 100 rolls.** Each bet's per-resolution edge times its resolution frequency, summed across the board. This answers the question the stage tables need: *what does an hour in this stage cost?* (~100 rolls/hr at typical table pace.) It is the only metric that makes stages with different stack sizes comparable — and it is immune to the odds-denominator illusion, since zero-edge odds add exactly $0 regardless of multiple.

**CATS stage costs ($10 table, 5× odds):**

| Stage | Name | Flat bets | Odds | Total load | Core config edge (per bet) | E[loss] / 100 rolls |
|---|---|---|---|---|---|---|
| 1 | Accumulator (start) | $36 | — | $36 | 1.52% | ~$12 |
| 1 | Accumulator (regressed) | $24 | — | $24 | 1.52% | ~$8 |
| 2 | Little Molly | $20 | $40 (2×) | $60 | 0.61% | ~$8 |
| 3 | 3-Point Molly (Tight) | $30 | $60–90 (tier) | $90–120 | ~0.58% | ~$13 |
| 3 | 3-Point Molly (Loose) | $30 | $150 (5× flat) | $180 | **0.33%** | ~$13 |
| 4 | Expanded Alpha | $70 | $150 | $220 | mixed (0.33% + 1.67%) | **~$29** |
| 5 | Max Alpha | $110 | $150 | $260 | mixed (0.33% + 1.67% + 2.00%) | **~$52** |

*(Per-roll components: each maintained $10 pass/come flat ≈ $0.042/roll; regressed Place 6/8 pair, come-out-adjusted ≈ $0.078/roll; Buy 4/10 pair ≈ $0.167/roll; Buy 5/9 pair ≈ $0.222/roll. Tight Molly odds and load vary with which numbers the Come bets land on.)*

> **On the Loose Molly figure:** The original CATS document cited 0.37% for the 3-Point Molly, reflecting the standard 3-4-5× odds structure (weighted average ~4.17×). CATS uses flat 5× on all numbers, which improves the combined per-bet edge from 0.374% to **0.326%**. (An earlier draft claimed 0.235% — that figure came from assuming odds are always on, a metric artifact rather than a real improvement. Flat 5× is better than 3-4-5×, just not by that much.)

> **What the two metrics reveal together:** Per-dollar efficiency improves dramatically up the ladder (1.52% → 0.33%), but per-roll cost does not fall — it rises, because load grows faster than edge shrinks. The Accumulator and Little Molly both cost ~$8/100 rolls; the Mollys ~$13; the Buy stages $29–52. What the ladder buys with that rising spend is coverage and fat-tail exposure, not cheaper play. Be honest with yourself about that trade — §2.5 and §2.6 price it explicitly.

---

## 1.5 The Odds Bet: Variance Without Edge

Taking odds does not change your expected loss per hand. It changes how volatile your session is.

| Odds multiple | Combined edge (per bet resolved — Metric 1) | Std dev (units) | 7-out cost ($10 flat) |
|---|---|---|---|
| 0× | 1.41% | 1.00 | $10 |
| 1× | 0.85% | 1.41 | $20 |
| 2× | 0.61% | 1.73 | $30 |
| 3× | 0.47% | 2.00 | $40 |
| 5× (max) | 0.33% | 2.45 | $60 |

More odds = lower blended edge + higher variance. This is the only lever in craps that reduces edge without adding expected loss rate. The question is never *whether* to take odds — always take them — but *how much*, calibrated to your cushion and intent.

---

## 1.6 Win/Lose Ratio by Coverage State

The 7 appears on 6/36 = 16.7% of rolls — immovable. What you control is how many numbers pay you before the 7 arrives. The win/lose ratio measures this directly.

| Numbers covered | Example | Ways to win/roll | P(win/roll) | P(lose/roll) | Win:Lose |
|---|---|---|---|---|---|
| 1 | 6 only | 5 | 13.9% | 16.7% | 0.83:1 |
| 1 | 5 only | 4 | 11.1% | 16.7% | 0.67:1 |
| 1 | 4 only | 3 | 8.3% | 16.7% | 0.50:1 |
| 2 | 6 + 8 | 10 | 27.8% | 16.7% | 1.67:1 |
| 2 | 6 + 5 | 9 | 25.0% | 16.7% | 1.50:1 |
| 2 | 6 + 10 | 8 | 22.2% | 16.7% | 1.33:1 |
| 3 | 6 + 8 + 5 | 14 | 38.9% | 16.7% | 2.33:1 |
| 3 | 6 + 5 + 10 | 12 | 33.3% | 16.7% | 2.00:1 |
| 3 | 6 + 8 + 10 | 11 | 30.6% | 16.7% | 1.83:1 |
| 4 | 6 + 8 + 5 + 9 | 18 | 50.0% | 16.7% | 3.00:1 |

**Coverage tiers for odds decisions:**

| Tier | Condition | Win:Lose | Odds posture |
|---|---|---|---|
| Sweet spot | 6 or 8 AND 5 or 9 covered | ≥ 2.33:1 | Tier rule: 3× on 6/8, 2× on 5/9, 1× on 4/10 |
| Middle | 6 or 8, no 5/9 — or reloading | 1.83–2.17:1 | 2× on 6/8 only, 1× on 4/10 |
| Rough | No 6 or 8 working | < 1.83:1 | 1× across the board |

**The table check:** *Do I have a 6 or 8 working?* This single question separates sweet spot and middle from rough. The 6 and 8 each contribute 5 ways to win — more than any other number — and their presence or absence is the dominant signal for odds sizing.

---

## 1.7 Risk of Ruin

For a negative EV game, risk of ruin approximation:

$$\text{RoR} \approx e^{-2eB/\sigma^2}$$

Where *e* = edge per unit, *B* = bankroll in units, *σ* = standard deviation per unit.

**Practical rule of thumb:** To sustain ~95% session survival over 100 decisions, maintain a bankroll ≥ 20× your average total bet in action (including odds).

**Survival implications by stage ($10 table, $300 buy-in):**

| Stage | Table load | Max consecutive losses before ruin |
|---|---|---|
| Accumulator (regressed) | $24 | ~12 |
| Little Molly | $60 | ~5 |
| 3-Point Molly (Tight) | ~$120 | ~2–3 |
| 3-Point Molly (Loose) | $180 | ~1–2 |
| Expanded Alpha | $220 | ~1 |

> **Caveat:** this matrix divides raw buy-in by load — a deliberately conservative floor. In practice the profit-funded thresholds guarantee extra cushion at every step-up: entering Loose Molly implies equity of at least $450–500 ($300 buy-in + $150–200 profit), which survives 2–3 fully loaded 7-outs, not 1–2. The matrix understates the protection the ladder itself provides.

> This is why CATS funds each stage with profit before stepping up. The Accumulator is not optional preamble — it is the capitalization event that makes the Molly stages survivable with a standard buy-in.

---

# §2 CATS Strategy Stages

## 2.0 Stage Overview

CATS is a five-stage escalation system. Each stage is funded by profit from the previous stage. You never increase table load with buy-in capital — only with accumulated profit. While you are in a stage, you are watching for the threshold that lets you step up to the next one.

| # | Stage | Board | E[loss] / 100 rolls | Step-Up threshold | Step-Down threshold |
|---|---|---|---|---|---|
| 1 | **Accumulator** | Place 6/8 | ~$8 | Profit ≥ **+$70** | Starting state — no step-down |
| 2 | **Little Molly** | Pass + 1 Come + 2× odds | ~$8 | Profit ≥ **+$150** | Profit < +$70 or 2× consecutive 7-outs |
| 3 | **3-Point Molly** | Pass + 2 Come + scaled odds | ~$13 | Profit ≥ **+$250** | Profit < +$150 or 2× consecutive 7-outs |
| 4 | **Expanded Alpha** | Molly + Buy 4/10 | **~$29** | Profit ≥ **+$400** | Profit < +$250 |
| 5 | **Max Alpha** | Expanded Alpha + Buy 5/9 | **~$52** | The long roll — see §2.5 | Profit < +$400 |

> **Reading the threshold column:** While you are in Stage 1 (Accumulator), you are watching for profit ≥ +$70. That is the moment you step up to Stage 2. You are not thinking about exit conditions — you are thinking about the step-up target.

---

## 2.1 Stage 1: Accumulator

**Purpose:** Generate the capital buffer that funds Little Molly. This is a gate, not a destination.

**Board:** Place 6 and 8 at one unit above table minimum.

| Table min | Initial bet (each) | Load | After first hit | Regressed load |
|---|---|---|---|---|
| $10 | $18 | $36 | $12 each | $24 |
| $15 | $24 | $48 | $18 each | $36 |

**The De-Leverage Rule:** On the first hit, collect the payout and immediately tell the dealer: *"Pull my place bets down to [amount] each."* Do not press. Do not wait for a second hit. The regressed 6 and 8 keep working — their job is now to grind toward +$70, not to catch a heater.

**Why 1.52% is acceptable here:** The Accumulator is the highest-edge stage in CATS. This is intentional. The 6 and 8 win on 10/36 rolls — frequently enough to build the buffer at acceptable speed. The edge cost is the price of admission to the near-zero-edge Alpha stages. Every dollar you press into a Place 6/8 instead of racking is a dollar taxed at 1.52% that could have been odds at 0%.

**Step-Up threshold:** Profit ≥ +$70. Step up to Little Molly.

---

## 2.2 Stage 1b: Turbo CATS (Alternate Accumulator)

**Purpose:** Reach the +$70 Little Molly threshold faster by covering all numbers immediately after the point is set.

**Board:** $64 Across immediately after point is established.

| Bet | Numbers | $10 table | $15 table | Payout |
|---|---|---|---|---|
| Place 4 and 10 | 4, 10 | $10 each | $15 each | $18 / $27 |
| Place 5 and 9 | 5, 9 | $10 each | $15 each | $14 / $21 |
| Place 6 and 8 | 6, 8 | $12 each | $18 each | $14 / $21 |
| **Total** | All box numbers | **$64** | **$96** | Avg ~$15 |

**Blended HE: 3.90%** — the speed tax. ($20 × 6.67% + $20 × 4.00% + $24 × 1.52% = $2.50 ÷ $64.) Per-roll, the full board bleeds ~$0.67/roll — acceptable for the intended 1–2 roll dwell before regression, ruinous if left working. The regression step is not optional.

**Execution:**
1. Point is established — drop the full Across load
2. First hit on any number — collect payout
3. *"Take down everything except my 6 and 8"* — all other place bets come off, leaving only the regressed 6/8

**Net position after step 3:** You recover all non-6/8 bet amounts + payout. Net capital at risk: approximately $10 of original buy-in covering the remaining $24 on 6/8.

**Win probability per roll:** 24/36 = 66.7% — involved in two of every three rolls.

> ⚠️ **Cold table warning — read before deploying Turbo:**
> Three consecutive point-seven-outs costs $192 — 64% of a $300 buy-in. Turbo is a velocity tool on neutral or warm tables only. If the last two shooters have point-seven-outed immediately, use the standard Accumulator. The speed advantage evaporates when your buy-in evaporates with it.

**Use Turbo when:** Table energy is neutral or positive. Shooters are reaching 4+ rolls before a 7-out. You want to minimize Accumulator time.

**Avoid Turbo when:** Two or more recent immediate point-seven-outs. Slow dealer or crowded table. Short session where buy-in preservation matters.

**Step-Up threshold:** Same as standard Accumulator — Profit ≥ +$70.

---

## 2.3 Stage 2: Little Molly *(new)*

**Purpose:** Two functions simultaneously. First: drop blended edge from 1.52% to ~0.61% the moment you step up from the Accumulator. Second: take a read on whether this table and shooter deserve the full 3-Point Molly's variance before you commit $180. Two numbers covered at $60 load — enough skin in the game to feel the table, not enough to crater your session on a bad run.

**Board:** Pass line + 1 Come bet + 2× odds on both.

| Table min | Pass flat | Come flat | Odds each (2×) | Total load |
|---|---|---|---|---|
| $10 | $10 | $10 | $20 | $60 |
| $15 | $15 | $15 | $30 | $90 |

**Combined edge: 0.61% per bet resolved | E[loss]: ~$8 / 100 rolls**
> Per dollar wagered, this is a ~2.5× efficiency improvement over the Accumulator (1.52% → 0.61%). Note what does *not* improve: expected cost per roll stays at ~$8, because the load more than doubles while the edge falls. The step-up buys efficiency and a second covered number — not cheaper play.

**Odds rule:**

*Basic (default while learning this stage):* Flat 2× on everything. One rule, no decisions.

*Advanced (once comfortable):* Apply the tier rule by number. **6 or 8:** take 3× odds — these hit most often (45.5% P(win before 7)), so your odds capital works hardest here. **4 or 10:** take 1× odds — these resolve slowly (33.3%), tying up capital between payouts. **5 or 9:** take 2× odds, splitting the difference. Once this is instinct at the table, you are ready for Stage 3 Tight.

**Win/Lose ratio:** 1.33–1.67:1 depending on which numbers land. Better than the Accumulator's single-number exposure. Meaningfully less volatile than the 3-Point Molly.

**What you are watching:** Are shooters reaching multiple point cycles? Are numbers repeating? Are you getting 4–6 rolls before a 7-out? Little Molly answers this question at $60 of risk instead of $180. When the answer is consistently yes — step up.

**Step-Up threshold:** Profit ≥ +$150. Step up to 3-Point Molly.

**Step-Down rule:** Return to Accumulator if profit falls below +$70 OR after 2 consecutive 7-outs in Little Molly.

> **On the 2 consecutive 7-out rule:** This trigger is not profit-based by design — but be clear-eyed about what it is and is not. Dice are memoryless: two consecutive 7-outs have zero predictive power over the next roll. The rule's value is *pre-commitment*: it fires automatically at exactly the moment your in-the-moment judgment is most compromised — right after two straight losses, when the instinct is to chase. It converts a tilt-prone decision into a mechanical one, throttles load while your read of the table resets, and costs almost nothing in EV terms (the Accumulator bleeds the same ~$8/100 rolls as Little Molly). Step down, let the Accumulator run, and reassess with a clear head.

---

## 2.4 Stage 3: 3-Point Molly

**Purpose:** The primary Alpha stage. Three numbers covered at the best per-dollar efficiency in CATS — 0.326% combined edge in Loose mode. This is where casino money starts hunting fat tails.

**Board (steady state — 3 numbers covered):**

| Table min | Pass/Come flat (×3) | Odds | Total load (Loose) |
|---|---|---|---|
| $10 | $30 | $150 (5× max) | $180 |
| $15 | $45 | $225 (5× max) | $270 |

**Combined edge (Loose): 0.326% per bet resolved | E[loss]: ~$13 / 100 rolls**

### Tight vs. Loose: Two modes of the same stage

The 3-Point Molly is played in one of two modes depending on cushion depth and table read. This is a CATS innovation — standard Molly play defaults to flat max odds.

**Coverage** is the set of point numbers currently active — your pass line point plus any Come bets that have traveled to their own numbers. A fully loaded 3-Point Molly has three numbers covered. Coverage state tells you how favorable your win/lose ratio is on any given roll.

**Tight Molly** — tier-based odds scaled to coverage:

| Coverage state | 6/8 odds | 5/9 odds | 4/10 odds | Approx. load |
|---|---|---|---|---|
| Sweet spot (6/8 + 5/9 covered) | 3× | 2× | 1× | ~$90–120 (coverage-dependent) |
| Middle (6/8, no 5/9) | 2× | — | 1× | ~$100 |
| Rough (no 6/8) | 1× | 1× | 1× | ~$60 |

**Combined edge (Tight): ~0.58% per bet resolved | E[loss]: ~$13 / 100 rolls**
> Tight's load and odds total depend on which numbers the Come bets land on — with 6 *and* 8 covered, tier odds run $80 on $30 flat (~$110 load); with one of them, $60 on $30 (~$90). What is constant: the flat bets. Tight and Loose carry identical flats ($30), so they have **identical expected cost per roll** (~$13/100). The Tight/Loose choice moves zero expected dollars — it is purely a variance dial, which is exactly why it is safe to key it to cushion depth and table read.

**Loose Molly** — max 5× odds on all numbers, all the time:

| Coverage state | All numbers | Load |
|---|---|---|
| Any | 5× | $180 ($10 table) |

**When to play Tight:** You just stepped up from Little Molly and your cushion is at +$150 (minimum funded). The table is uncertain. Play Tight until you reach +$200 and have a read on the shooter.

**When to play Loose:** Cushion is +$200 or deeper. Shooter is sustaining hands. You are here to hunt the fat tail — max odds is the correct expression of that intent. A Loose Molly at full load is not reckless; it is the point of the whole Accumulator grind.

---

> #### 📐 Deep Dive: Tiered Odds — CATS Innovation vs. Standard Molly Play
>
> Standard 3-Point Molly play takes maximum odds on all numbers at all times. This is mathematically correct in isolation — the odds bet has zero edge regardless of multiple, so more is always better. CATS departs from this in Tight mode, and the reason is cushion mechanics, not edge math.
>
> When a player first steps up from Little Molly, their profit cushion is at +$150 — the minimum funded threshold. Full Loose Molly load is $180. A single 7-out in Loose mode at step-up leaves the player $30 below buy-in. Tight mode reduces that 7-out cost to ~$90–110 at zero expected-value cost — Tight and Loose share the same flats and therefore the same ~$13/100-roll expected loss — buying time to either deepen the cushion or confirm the shooter before committing maximum variance. The protection Tight provides is variance reduction, purchased free.
>
> The transition from Tight to Loose is not a concession to conservatism — it is sequencing. The Accumulator existed to fund this moment. Once cushion clears +$200 and the table read is favorable, Loose Molly is the correct expression of everything the earlier stages built toward: maximum odds, minimum edge, full fat-tail exposure.
>
> **The max odds moment is Loose Molly. The Accumulator was its funding event.**

---

**Step-Up threshold:** Profit ≥ +$250. Step up to Expanded Alpha.

**Step-Down rule:** Return to Little Molly if profit falls below +$150 OR after 2 consecutive 7-outs.

---

## 2.5 Stage 4: Expanded Alpha

**Purpose:** Add Buy 4/10 to the Molly. The 4 and 10 have the highest leverage factor in the casino at this edge level — a $20 Buy pays $39 net of the $1 win-vig (2:1 less commission). Adding them at 1.67% edge into a 0.326% base is a trade for targeted coverage and payout — priced honestly below.

> ⚠️ **Confirm win-vig rule before placing Buy bets.** If the casino charges 5% on every Buy bet (not only on wins), edge is 4.76% — worse than Place 4/10. Ask the dealer: *"Do you charge the vig only on winning Buy bets?"* If yes: 1.67%. If no: skip the Buy bets entirely and let Come bets cover those numbers at 0.326% combined.

**Board:**

| Table min | Molly load | Buy 4 | Buy 10 | Total load |
|---|---|---|---|---|
| $10 | $180 | $20 | $20 | $220 |
| $15 | $270 | $30 | $30 | $330 |

**E[loss]: ~$29 / 100 rolls — more than double the Loose Molly's ~$13**
> The honest price: Buy bets resolve on 9 of 36 rolls, so their edge is charged relentlessly — the Buy 4/10 pair adds ~$17/100 rolls on its own. Know the alternative before paying it: a fourth Come bet adds long-roll action at ~$4/100 rolls, roughly a quarter of the Buys' cost. What the ~$13/100-roll premium purchases is *immediate, targeted* coverage of the 4 and 10 — Come bets wander to whatever number rolls. At +$400 cushion, buying certainty of coverage for a long-roll hunt is a defensible trade. It is a trade, not a free upgrade.

**The Swap Rule:** If a Come bet travels to 4 or 10 while a Buy is active on that number — pull the Buy immediately. The Come bet + 5× odds at 0.326% combined edge dominates the Buy at 1.67%. Tell the dealer: *"Take down my Buy [number]."* You just improved your per-dollar edge on that number roughly 5× at no cost.

**Step-Up threshold:** Profit ≥ +$400. Step up to Max Alpha.

**Step-Down rule:** Return to 3-Point Molly if profit falls below +$250.

---

## 2.6 Stage 5: Max Alpha

**Purpose:** Maximum board coverage. This stage is infrastructure for the outlier roll — the long shooter that pays for a weekend. In practice, most sessions never reach Stage 5, and that is fine. The strategy is designed so that deep Expanded Alpha play is already excellent. Max Alpha is the ceiling, not the expectation.

**Board:** Expanded Alpha + Buy 5 and Buy 9 (vig on win only).

| Table min | Expanded Alpha load | Buy 5 | Buy 9 | Total load |
|---|---|---|---|---|
| $10 | $220 | $20 | $20 | $260 |
| $15 | $330 | $30 | $30 | $390 |

**E[loss]: ~$52 / 100 rolls — the most expensive stage in CATS, roughly 4× the Loose Molly**
> The Buy 5/9 pair resolves on 10 of 36 rolls and adds ~$22/100 rolls on top of Expanded Alpha's ~$29. Per dollar wagered the stage still looks respectable, but per hour it is by far the priciest configuration in the system. That is not a reason to skip it — it is the reason Stage 5 is gated behind +$400 of accumulated profit and framed as long-roll infrastructure rather than a default posture. Enter it knowing the meter is running.

**Note on Buy 5/9 edge:** At 2.00%, the Buy 5/9 is the highest-edge component in CATS. At Stage 5 cushion levels (+$400), this is an acceptable cost for the coverage. The Molly's Come bets already cover 5 and 9 at 0.326% combined edge — the Buy bets add *additional* action at those numbers, capturing more of a long shooter's production.

**Step-Down rule:** Return to Expanded Alpha if profit falls below +$400.

**On reaching Max Alpha:** If you are here, the session is going well. Stay disciplined on the Swap Rule. Do not press the Buy bets beyond their standard amounts — the Come bet + odds structure is already doing most of the work. Max Alpha is about coverage, not about increasing load beyond what the stage calls for.

---

# §3 Operations Playbook

*Learn this section rote. At the table, you execute these rules.*

## 3.1 Step-Up / Step-Down Gate Table

### $10 Table Minimum, 5× Odds

| Stage | Name | Load | Step-Up when | Step-Down when |
|---|---|---|---|---|
| **1** | Accumulator | $24–36 | Profit ≥ **+$70** | Starting state |
| **2** | Little Molly | $60 | Profit ≥ **+$150** | Profit < +$70 or 2× 7-outs |
| **3** | 3-Point Molly | $120–180 | Profit ≥ **+$250** | Profit < +$150 or 2× 7-outs |
| **4** | Expanded Alpha | $220 | Profit ≥ **+$400** | Profit < +$250 |
| **5** | Max Alpha | $260 | The long roll | Profit < +$400 |

### $15 Table Minimum, 5× Odds

| Stage | Name | Load | Step-Up when | Step-Down when |
|---|---|---|---|---|
| **1** | Accumulator | $36–48 | Profit ≥ **+$105** | Starting state |
| **2** | Little Molly | $90 | Profit ≥ **+$225** | Profit < +$105 or 2× 7-outs |
| **3** | 3-Point Molly | $180–270 | Profit ≥ **+$375** | Profit < +$225 or 2× 7-outs |
| **4** | Expanded Alpha | $330 | Profit ≥ **+$600** | Profit < +$375 |
| **5** | Max Alpha | $390 | The long roll | Profit < +$600 |

---

## 3.2 Exact Bet Amounts by Stage

### Stage 1: Accumulator

| Table min | Place 6 | Place 8 | Load | First hit instruction | Regressed load |
|---|---|---|---|---|---|
| $10 | $18 | $18 | $36 | *"Pull my place bets down to $12 each"* | $24 |
| $15 | $24 | $24 | $48 | *"Pull my place bets down to $18 each"* | $36 |

### Stage 1b: Turbo CATS

| Table min | Place 4/10 | Place 5/9 | Place 6/8 | Total | First hit instruction |
|---|---|---|---|---|---|
| $10 | $10 each | $10 each | $12 each | $64 | *"Take down everything except my 6 and 8"* |
| $15 | $15 each | $15 each | $18 each | $96 | *"Take down everything except my 6 and 8"* |

### Stage 2: Little Molly

| Table min | Pass line | Come | Odds (Basic 2×) | Total |
|---|---|---|---|---|
| $10 | $10 | $10 | $20 each | $60 |
| $15 | $15 | $15 | $30 each | $90 |

*Take odds immediately when the Come bet travels. Do not wait.*

### Stage 3: 3-Point Molly

**Tight — tier odds:**

| Table min | Pass/Come flat | 6/8 odds (3×) | 5/9 odds (2×) | 4/10 odds (1×) | Sweet spot load |
|---|---|---|---|---|---|
| $10 | $10 | $30 | $20 | $10 | ~$90–120 |
| $15 | $15 | $45 | $30 | $15 | ~$180 |

**Loose — max odds:**

| Table min | Pass/Come flat | All odds (5×) | Total load |
|---|---|---|---|
| $10 | $10 | $50 each | $180 |
| $15 | $15 | $75 each | $270 |

*Play Tight at +$150. Shift to Loose at +$200 or deeper with a live shooter.*

### Stage 4: Expanded Alpha

| Table min | Molly (Loose) | Buy 4 | Buy 10 | Total |
|---|---|---|---|---|
| $10 | $180 | $20 | $20 | $220 |
| $15 | $270 | $30 | $30 | $330 |

*Confirm win-vig only before placing any Buy bet.*

### Stage 5: Max Alpha

| Table min | Expanded Alpha | Buy 5 | Buy 9 | Total |
|---|---|---|---|---|
| $10 | $220 | $20 | $20 | $260 |
| $15 | $330 | $30 | $30 | $390 |

---

## 3.3 Tier-Based Odds Rule (Stages 3–5)

At the table, ask one question: **Do I have a 6 or 8 working?**

| State | Condition | Tight odds | Loose odds |
|---|---|---|---|
| Sweet spot | 6 or 8 AND 5 or 9 working | 3×/2×/1× | 5×/5×/5× |
| Middle | 6 or 8, no 5/9 | 2× on 6/8, 1× on 4/10 | 5× on 6/8, 2× on 4/10 |
| Rough | No 6 or 8 | 1× everywhere | 2× everywhere |
| Reloading | Come bet in transit | Match current coverage state | Match current coverage state |

---

## 3.4 Step-Down and Hard Reset Rules

**2 consecutive 7-out rule:** Two 7-outs back-to-back in any Molly stage triggers a step-down — return to the previous stage regardless of profit level. Reset the counter when you collect a win.

**Profit threshold step-down:** If profit falls below the current stage's entry threshold, step down immediately.

**Hard reset:** If profit falls below +$20 from any stage, return to the Accumulator. Rebuild the buffer before committing Alpha load again.

**Never chase:** A step-down is the strategy working. The Accumulator is always there. Return to it without hesitation.

---

## 3.5 The Swap Rule (Stages 4–5)

If a Come bet travels to a number with an active Buy bet:

1. Confirm the Come bet is working on that number
2. Tell the dealer: *"Take down my Buy [number]"*
3. Take full 5× odds on the Come bet

The Come + odds at 0.326% combined edge replaces the Buy at 1.67%. You improve your per-dollar edge on that number roughly 5× at no cost.

---

## 3.6 Recommended Buy-In

| Session intent | $10 table | $15 table |
|---|---|---|
| Standard CATS (grind up from Stage 1) | $300* | $450* |
| Full session comfort (absorb early variance) | $500 | $750 |

*$300 at a $10 table works — the Accumulator is designed for it. See §5 Art of the Math for the buy-in philosophy and when a higher buy-in changes the session shape rather than just the safety margin.*

---

## 3.7 Accounting Definitions

The step-up and step-down thresholds are meaningless without a definition of what is being measured. CATS uses these conventions — the simulator implements the same ones:

**Profit** = (rack + working bets at face value) − buy-in, evaluated after each roll's payouts settle. Working bets count at face: a $60 Molly board with $240 in the rack after a $300 buy-in is +$0, not −$60. Do not use rack-only accounting — with $180 on the felt, the two definitions differ by more than a full stage gate.

**Place and Buy bets are OFF on the come-out roll** (the standard table default). All per-roll cost figures in §1.4 assume this.

**The consecutive 7-out counter** resets on any collected win and carries across stage transitions — stepping down does not clear it; a win does.

---

# §4 Simulation Findings

*CATS lives in a simulator repository; the strategy must answer to its own engine. This section reports what simulation shows about the ladder as specified — the numbers a player should know before choosing a buy-in and a session plan. Preliminary figures below are from an independent Monte Carlo of Stage 1 as written (200k trials); they are being reproduced and extended in the repo's TypeScript engine, which implements CATS through Stage 3 as `CATS()` in `src/dsl/strategies-staged.ts`.*

## 4.1 Stage 1 gate: how often the path gets trodden

| Metric | Result ($10 table, $300 buy-in) |
|---|---|
| P(reach +$70 before exhausting buy-in) | ~74% |
| P(never leaving Stage 1 — full buy-in lost in the Accumulator) | ~26% |
| Median rolls to +$70 | ~62 (≈ 35–40 min at ~100 rolls/hr) |
| Mean rolls to +$70 | ~132 (right-skewed — some grinds run hours) |

Read that honestly: **roughly one session in four never reaches Little Molly.** That is not a flaw discovered late — it is the price of ruin control at a $300 buy-in, and it was always implied by the negative drift of the Accumulator. But it is a first-order property of the strategy, and it bears directly on the buy-in philosophy in §5.4: the $500 buy-in doesn't just add Molly runway, it shrinks the probability of a pure-grind losing session and shortens the median time to Alpha play. If the Accumulator grind would make the session feel like work, §5.4's $500/Stage-2-entry path is the sanctioned answer — not looser discipline.

## 4.2 Metrics the engine tracks (roadmap)

Stage-reach probabilities for every stage; time-in-stage distributions (the session-experience metric: what fraction of a session is grind vs. Alpha play); session P&L distribution by buy-in and roll count; and threshold sensitivity (how stage-reach and P&L respond to moving the +$70/+$150/+$250 gates). Results replace the preliminary figures above as they land.

---

# §5 Art of the Math

The mathematics and operations sections tell you what craps *is* and what to *do*. This section is about what you are actually *trying to accomplish* — and how to improvise intelligently when the table doesn't read the script.

A player who has memorized the operations is competent. A player who understands the math can adapt. A player who has internalized this section can read a live table, make a judgment call that departs from the written rules, and know whether that call was correct.

---

## 5.1 The Capital Lifecycle: The Accumulator as a Gate

The most common mistake in craps is treating every stage of a session the same. The Accumulator feels like craps. The 3-Point Molly feels like craps. From the outside they look similar — dice rolling, bets paying, dealers pushing chips. But they are doing fundamentally different things.

The Accumulator is not a strategy for winning at craps. It is a **capital generation event** — a mechanism for extracting a buffer from the casino at 1.52% edge before committing to the near-zero-edge Alpha stages. Every dollar in the rack after a 6 or 8 hit is a dollar that no longer belongs to the casino's edge math. It is fuel.

This reframe matters because it changes how you feel about pressing. When a shooter gets hot in the Accumulator, the instinct is to press — put more on the 6 and 8, ride the momentum. Within the Alpha-Transition framework, this is a misallocation of capital. A pressed Place 6/8 is still taxed at 1.52%. The rack is not. Every dollar pressed is a dollar that will eventually fund an odds bet at 0.00% but is instead paying 1.52% rent on the way there.

The regress-after-first-hit rule exists precisely to resist this instinct. It is not conservative — it is a priority decision. The 6 and 8 are employees with one job: generate the licensing fee for the Molly stages. You do not give them a raise before the business can afford its infrastructure.

Once you internalize the capital lifecycle, the Accumulator stops feeling slow. It is not slow — it is *sequenced*. You are building the cushion that makes the fat-tail hunt possible without existential risk to your session.

> The survival matrix in §5.4 puts exact numbers on this runway — how many consecutive 7-outs each buy-in can absorb at each stage. Worth reading before you decide on a session buy-in.

---

## 5.2 Variance as a Dial

Here is something most craps players never fully grasp: **taking more odds does not increase your expected loss per hand.**

To be precise about what that means: P(7-out) doesn't change with odds — that's fixed by the dice at whatever the point resolution probability is. What changes is the *dollar amount* riding on each outcome. The casino pays the odds bet at exactly true mathematical probability — so the expected value of the odds bet in isolation is zero. It's constructed to cancel: P(win) × payout = P(lose) × risk, exactly. The only expected loss comes from the flat bet at 1.41% edge.

The practical result: adding $50 in odds to a $10 pass line bet adds $0 to your expected loss for that hand. What it adds is *dollar swing* — the 7-out costs more, the win pays more, and the long-run average is unchanged. The session distribution gets wider in both directions. This is not recklessness. It is the only dial in the casino that changes session shape without changing expected cost.

### Example: Same shooter, same hand, different odds multiple

Imagine a shooter establishes a point of 6. They roll nine times before hitting it. Same hand, two players at the table:

| | Player A (1× odds) | Player B (5× odds) |
|---|---|---|
| Pass line | $10 | $10 |
| Odds | $10 | $50 |
| Total at risk | $20 | $60 |
| Payout on win (6:5 odds) | $10 flat + $12 odds = **+$22** | $10 flat + $60 odds = **+$70** |
| Loss on 7-out | **−$20** | **−$60** |
| Expected loss per hand* | ~$0.28 | ~$0.28 |

*Expected loss = pass line flat × 1.41% edge. Odds contribute zero regardless of multiple.*

Both players pay the same expected cost. Player B's session is dramatically more volatile — bigger wins, bigger losses, same long-run average. This is not recklessness. It is the correct expression of fat-tail hunting when cushion supports it.

### The Little Molly / Tight Molly relationship

An earlier draft celebrated a "striking identity": Little Molly and Tight Molly both computed to 0.470% blended edge. v1.2 retires that claim — it was an arithmetic artifact of the old snapshot metric (any configuration whose aggregate odds happen to run 2× its flats produces the same number), and it held only for particular coverage draws. Here is the corrected comparison:

| Attribute | Little Molly | 3-Point Molly Tight |
|---|---|---|
| Flat bets | $20 | $30 |
| Odds (aggregate) | $40 | $60–90 (coverage-dependent) |
| E[loss] / 100 rolls | ~$8 | ~$13 |
| Numbers covered | 2 | 3 |
| Win:lose per roll | 1.33–1.67:1 | 1.83–2.33:1 |
| 7-out cost | $60 | $90–120 |

What the step-up actually buys: a third flat bet (~+$4/100 rolls in expected cost) purchases a third covered number and a meaningfully better win rate per roll, at a $30–60 increase in 7-out exposure. The step-up is mostly a variance-and-coverage decision with a small, known expected cost — funded by the cushion you built to absorb exactly that volatility. Within Stage 3, the Tight/Loose choice then moves *zero* expected dollars (identical flats) — that dial is pure variance, and §2.4 keys it to cushion accordingly.

---

## 5.3 Reading the Room

The operations define two mechanical triggers: profit below threshold, or two consecutive 7-outs. These tell you when the math *requires* a step-down. The art is reading conditions that *suggest* one before the trigger fires — and conversely, recognizing when the table is telling you to push.

### What to look for

Craps is a memoryless game. The dice carry no history. What table energy actually measures is *shooter behavior* — and human behavior does have patterns, even when dice outcomes don't.

**A hot table looks like this:** Heavy racks up and down the rail. Players pressing their bets between rolls. The stickman is working fast — the crew is busy. Shooters are taking their time, settling into a grip, same motion every throw. The crowd is leaning in. You hear numbers called before the dice land — regulars tracking the pattern. When you find this table, push for a spot. This is the environment where the Molly stages do their best work.

**A cold table looks like this:** Light racks, dealers standing relaxed, little side conversation. Shooters picking up the dice quickly, throwing without settling. Repeated immediate 7-outs — point set, one or two rolls, 7. Players going quiet between shooters. The crew makes eye contact with each other. When you see this, run the Accumulator conservatively or consider BATS (see §6).

**A choppy table** is the harder read — some shooters sustain hands, others die immediately, no pattern holds. This is where CATS earns its keep. The Accumulator loses slowly. Little Molly gives you a read at low cost. You stay patient and wait for a shooter who looks different.

### Acting on the read

The operations do not change based on table read. What changes is your *pace* through the stages and your *odds multiple within* a stage.

On a hot table: step up to threshold promptly. Shift to Loose Molly once at +$200. Let the variance run — this is what the cushion is for.

On a cold or choppy table: stay in Little Molly even after reaching the +$150 step-up threshold. Extending Little Molly costs nothing extra in expected dollars — it runs one fewer flat than the Molly (~$8 vs ~$13 per 100 rolls), so waiting actually *reduces* your expected loss while you watch. What you forgo is coverage and fat-tail exposure, not efficiency. Wait for a shooter who sustains before committing to Loose Molly at $180 load. The step-up threshold is a *permission*, not a command.

> #### 📐 Sidebar: The Consecutive 7-Out Rule
>
> The two consecutive 7-out step-down trigger is a formalization of the cold table read. Its value is that it removes the decision from your hands in the moment — when you've just lost twice in a row, judgment is compromised. The rule fires automatically.
>
> What it is really measuring: a short-hand pattern in the current shooter population. Two back-to-back immediate 7-outs suggests the table is in a mode where Molly variance is structurally punishing. Step down, run the Accumulator, watch two or three more shooters. If the table normalizes, step back up with a fresh read and a rebuilt cushion. If it doesn't, you've been losing at $24 load instead of $180.

---

## 5.4 Buy-In Philosophy: Two Valid Games

There is a version of CATS where you buy in for $300, grind the Accumulator, and step through the stages using casino money to fund each escalation. There is another where you buy in for $600 and enter Stage 3 immediately. Both are valid. They are different games.

| Buy-in | Entry stage | Session shape | Risk profile | Best for |
|---|---|---|---|---|
| $200 | Stage 1 | Long grind, slow step-up | Lowest variance, most resilient | Learning the stages, short session |
| $300 | Stage 1 | Standard CATS grind | Moderate — Accumulator funds Stage 2+ | Full session, standard play |
| $500 | Stage 1 or 2 | Faster step-up, more cushion at Stage 3 | Comfortable at Loose Molly | Recommended for a full CATS session |
| $600 | Stage 3 direct | Skip Accumulator entirely | All buy-in at Stage 3 variance | When you have a trip buffer |
| $1,000+ | Stage 3–4 | Immediate Alpha exposure | High variance, no grind buffer | Power session, full weekend budget |

The $300 buy-in is not a limitation — it is a feature. It constrains early variance, forces grind discipline, and makes the step-up moments feel earned. The Accumulator phase at $300 is not overhead. It is part of the game.

The $600 direct entry skips the grind and starts where the math is best — 0.326% combined edge from the first roll. The cost: all $600 is your own money from the start. A bad run in Stage 3 hurts differently when the cushion is buy-in rather than accumulated profit. The variance is identical. The psychological frame is not.

**The multi-session path** is the natural synthesis. Run $300 grind sessions first. Bank any profit. If Sessions 1 and 2 go well, Session 3 becomes the Power Session — enter at Stage 3 with a larger buy-in funded partly by earlier winnings. You get the direct entry *and* a casino-funded cushion. This is the Alpha-Transition logic applied across a trip rather than within a single session.

### Survival matrix: consecutive maximum-load 7-outs before reaching $0

*$10 table, 5× odds. Assumes you advance stages as thresholds are met.*

| Buy-in | Accumulator | Little Molly | Molly Loose | Expanded Alpha |
|---|---|---|---|---|
| $300 | ~12 shooters | ~5 | ~1–2 | ~1 |
| $500 | ~20 shooters | ~8 | ~3 | ~2 |
| $700 | ~29 shooters | ~11 | ~4–5 | ~3 |

What this table is really showing: the Accumulator is the most forgiving stage by a large margin. A $300 buy-in survives roughly 12 consecutive bad shooters there. The same $300 buy-in — now partially depleted by the time it funds the Molly — survives 1–2 fully loaded Loose Molly 7-outs. This asymmetry is the numerical argument for the capital lifecycle framing in §5.1. The Molly stages are fragile by design; the Accumulator exists to make that fragility survivable.

The $500 buy-in doubles Molly runway without changing the stage structure. If variance tolerance matters more than grinding from scratch, that is the lever to pull.

---

## 5.5 Improvising in Relative Safety

### The decision space map

Every stage in CATS occupies a position on two axes: how much edge you are paying, and how much variance you are carrying. Understanding where each stage sits on that map is what tells you whether a given improvisation is calibrated caution or an edge violation.

| Stage | Mode | E[loss] / 100 rolls | Variance | 7-out cost ($10) | What you are doing |
|---|---|---|---|---|---|
| Accumulator | — | ~$8 | Low | $24 | Paying to generate capital. Variance is controlled by design. |
| Little Molly | Basic (2× flat) | ~$8 | Low-Med | $60 | Same expected cost as the Accumulator, better efficiency per dollar. Reading the table. |
| 3-Point Molly | Tight (tier odds) | ~$13 | Medium | $90–120 | Same expected cost as Loose, less variance. Cushion-aware. |
| 3-Point Molly | Loose (5× flat) | ~$13 | High | $180 | Best per-dollar edge in CATS (0.33%). Maximum fat-tail exposure. |
| Expanded Alpha | Loose + Buy 4/10 | ~$29 | High | $220 | Double the burn rate, purchased for targeted 4/10 coverage. |
| Max Alpha | Expanded + Buy 5/9 | ~$52 | Very High | $260 | 4× the Molly's burn rate. Built for the long roll, gated at +$400. |
| Hardways / Props | — | Off the chart | Very High | Varies | **Off the map.** Not a variance choice — a tax. |

Three things this map shows that prose cannot:

First, the **edge cliff between CATS and non-CATS bets** is stark. The worst CATS stage (Accumulator at 1.52%) is still less than one-sixth the edge of the cheapest Hardway (9.09%). These are not comparable decisions on a spectrum — they are different categories.

Second, **delaying step-up is free — or better.** Little Molly bleeds ~$8/100 rolls against the Molly's ~$13, so extending it to read the table *saves* expected dollars. What you pay for patience is forgone coverage and fat-tail exposure — upside variance, not efficiency. The old framing (that waiting "costs edge") had the sign backwards; the cost of buying information here is zero.

Third, **Loose Molly is the inflection point** — the best per-dollar edge in CATS (0.326% combined) at the same expected cost per roll as Tight, with maximum variance. Everything in CATS before this moment exists to make this moment survivable. Everything after it *raises* the burn rate to buy coverage — the map's right-hand stages are purchases, not upgrades.

CATS gives you a framework, not a cage. Once you understand why every rule exists, you know which ones have latitude and which are fixed by math that doesn't care how you feel about the next roll.

### What you never adjust

These are edge violations. No read, no feel, no hot streak changes them.

| Rule | Why it is fixed |
|---|---|
| Do not press Place 6/8 during Accumulator | 1.52% edge regardless of bet size. Every pressed dollar is a dollar not in odds at 0% |
| Do not take Hardways, Big 6/8, or Prop bets | 9–16.67% edge. No session justifies these |
| Do not play Place 5/9 or Place 4/10 | 4.00–6.67% edge. Buy instead, or let Come bets cover them. *Sole exception: Turbo CATS (§2.2), where full-board Place bets ride for an intended 1–2 roll dwell before regression* |
| Do not stay in a Molly stage after 2 consecutive 7-outs | The trigger exists because in-moment judgment is compromised after consecutive losses |
| Always confirm win-vig before Buy bets | If casino charges on all bets (not wins only): Buy 4/10 edge jumps from 1.67% to 4.76% |

### Where you have latitude

Improvising in CATS means adjusting timing and odds multiples. Nothing else. These are the two levers that move variance without moving edge.

| Decision | CATS indicates | Your latitude |
|---|---|---|
| When to step up | Step up at threshold | Can *delay* step-up on cold table — threshold is permission, not command |
| Odds multiple in Stage 3 | Tight below +$200, Loose above | Can stay Tight above +$200 if table reads uncertain |
| Turbo vs. Standard Accumulator | Turbo on warm tables | Standard on any table — Turbo is a speed option, not required |
| Staying in Little Molly | Step up at +$150 | Can extend Little Molly to read additional shooters — costs nothing in expected dollars; forgoes coverage and upside while you watch |
| Stage-down timing | Step down at threshold | Can step down *earlier* if table clearly cold — below threshold is required, above it is optional |

### What varying looks like in practice

The two columns above can feel abstract. Here is a concrete roll sequence showing CATS defaults vs. a player who is reading the table.

**Setup:** $10 table, profit at +$165. CATS indicates stepping up to 3-Point Molly (Loose) — threshold met, load $180.

| # | What happened | CATS indicates | Player observes | Player action | Within bounds? |
|---|---|---|---|---|---|
| Shooter 1 | Point-7-out in 2 rolls | — | Immediate 7-out | Stay in Little Molly, watch | ✅ Delaying a permitted step-up |
| Shooter 2 | Point-7-out in 3 rolls | Step up to Molly (profit still +$145, below +$150) | Two quick 7-outs, cold pattern | Step *down* to Accumulator | ✅ Early step-down, table signal |
| Shooter 3 | Rolls 12 times, hits 3 points | Step up when profit clears +$150 again | Shooter settling in, crew busy | Step up to Tight Molly at +$155, not Loose | ✅ Tight instead of Loose — cushion thin |
| Shooter 3 continues | Two more numbers hit, profit now +$210 | Shift to Loose Molly | Shooter still alive, heavy racks around the table | Shift to Loose, take 5× odds | ✅ Loose at +$210, cushion supports it |
| Shooter 3 | 7-out | — | Good hand, normal end | Reset Come bets, stay in Molly | ✅ Normal operation |

What the player varied: *when* to step up, *which mode* of Molly to play, and *when* to shift from Tight to Loose. What they never varied: bet selection, odds on 0% bets, or the fundamental stage structure.

**The distinction that matters:** staying in Little Molly two extra shooters costs you nothing in expected dollars — it actually runs ~$4/100 rolls cheaper than the Molly; what you give up is coverage and the chance to catch a hot hand at full exposure. A Hard 8 at any point in that sequence costs 9.09% edge on that bet. These are not similar decisions dressed differently. One is free calibrated caution within the framework. The other is a tax.

# §6 BATS Strategy (Darkside)

`[DEFERRED — same structure as CATS. Known issue: Dolly Stage 2 load ($330) does not reconcile with stated $10 table minimum. Needs audit before content is written.]`

---

*— End of v1.2 —*

*v1.2 changelog: standardized on two named edge metrics (§1.4) and propagated corrected figures throughout; fixed §1.1 (twelve loses for Pass, pushes for Don't Pass); Turbo blended edge corrected to 3.90% with burn-rate warning; Tight Molly loads reconciled as coverage-dependent ($90–120); retired the Little/Tight "0.470% identity" as a metric artifact; reframed the consecutive-7-out rule as pre-commitment; reframed odds-multiple and step-up-timing choices as variance decisions with correct EV signs; priced Stages 4–5 in $/100 rolls against the fourth-Come alternative; added §3.7 accounting definitions, §4 simulation findings, Turbo carve-out, and the §1.7 cushion caveat.*

**BATS Strategy** — deferred to a companion paper. Same Alpha-Transition architecture, darkside mechanics. See §6 stub for known audit items before drafting.
