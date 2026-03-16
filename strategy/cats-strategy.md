# CATS: Craps Alpha-Transition Strategy

**Version:** 1.1  
**Table Basis:** $10 / $15 minimum, 5× odds  
**Status:** Complete — Appendix removed; survival matrix integrated into §5.4

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
| 12 | 1 | 2.78% | Craps (push on come-out for Pass; lose for Come) |

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
| **Pass / Come + 3-4-5× Odds** | **0.37%** | Stage 3: 3-Point Molly (Loose) |
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

When multiple bets are live simultaneously, your effective edge is a weighted average across all money in action.

**Formula:**

$$\text{Blended HE} = \frac{\sum(\text{Bet}_i \times \text{HE}_i)}{\sum \text{Bet}_i}$$

**CATS stage blended edges ($10 table, 5× odds):**

| Stage | Name | Flat bets | Odds | Total load | Blended HE |
|---|---|---|---|---|---|
| 1 | Accumulator (start) | $36 | — | $36 | 1.52% |
| 1 | Accumulator (regressed) | $24 | — | $24 | 1.52% |
| 2 | Little Molly | $20 | $40 (2×) | $60 | **0.470%** |
| 3 | 3-Point Molly (Tight) | $30 | $60 (tier) | $90 | **0.470%** |
| 3 | 3-Point Molly (Loose) | $30 | $150 (5× flat) | $180 | **0.235%** |
| 4 | Expanded Alpha | $70 | $150 | $220 | **0.496%** |
| 5 | Max Alpha | $110 | $150 | $260 | **0.727%** |

> **On the Loose Molly figure:** The original CATS document cited 0.37% for the 3-Point Molly. That figure reflects the standard casino 3-4-5× odds structure (3× on 4/10, 4× on 5/9, 5× on 6/8), which produces a weighted average of ~4.17× per bet. CATS uses flat 5× on all numbers, which is more aggressive and yields a lower blended edge of 0.235%. The strategy is better than previously stated.

---

## 1.5 The Odds Bet: Variance Without Edge

Taking odds does not change your expected loss per hand. It changes how volatile your session is.

| Odds multiple | Blended HE (pass line basis) | Std dev (units) | 7-out cost ($10 flat) |
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

> This is why CATS funds each stage with profit before stepping up. The Accumulator is not optional preamble — it is the capitalization event that makes the Molly stages survivable with a standard buy-in.

---

# §2 CATS Strategy Stages

## 2.0 Stage Overview

CATS is a five-stage escalation system. Each stage is funded by profit from the previous stage. You never increase table load with buy-in capital — only with accumulated profit. While you are in a stage, you are watching for the threshold that lets you step up to the next one.

| # | Stage | Board | Blended HE | Step-Up threshold | Step-Down threshold |
|---|---|---|---|---|---|
| 1 | **Accumulator** | Place 6/8 | 1.52% | Profit ≥ **+$70** | Starting state — no step-down |
| 2 | **Little Molly** | Pass + 1 Come + 2× odds | ~0.61% | Profit ≥ **+$150** | Profit < +$70 or 2× consecutive 7-outs |
| 3 | **3-Point Molly** | Pass + 2 Come + scaled odds | 0.37–0.61% | Profit ≥ **+$250** | Profit < +$150 or 2× consecutive 7-outs |
| 4 | **Expanded Alpha** | Molly + Buy 4/10 | **0.496%** | Profit ≥ **+$400** | Profit < +$250 |
| 5 | **Max Alpha** | Expanded Alpha + Buy 5/9 | **0.727%** | The long roll — see §2.5 | Profit < +$400 |

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

**Blended HE: 4.00%** — the speed tax.

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

**Blended HE: 0.470%**
> ($20 × 1.41% + $40 × 0.00%) ÷ $60 = **0.470%** — a 3× improvement over the Accumulator's 1.52%.

**Odds rule:**

*Basic (default while learning this stage):* Flat 2× on everything. One rule, no decisions.

*Advanced (once comfortable):* Apply the tier rule by number. **6 or 8:** take 3× odds — these hit most often (45.5% P(win before 7)), so your odds capital works hardest here. **4 or 10:** take 1× odds — these resolve slowly (33.3%), tying up capital between payouts. **5 or 9:** take 2× odds, splitting the difference. Once this is instinct at the table, you are ready for Stage 3 Tight.

**Win/Lose ratio:** 1.33–1.67:1 depending on which numbers land. Better than the Accumulator's single-number exposure. Meaningfully less volatile than the 3-Point Molly.

**What you are watching:** Are shooters reaching multiple point cycles? Are numbers repeating? Are you getting 4–6 rolls before a 7-out? Little Molly answers this question at $60 of risk instead of $180. When the answer is consistently yes — step up.

**Step-Up threshold:** Profit ≥ +$150. Step up to 3-Point Molly.

**Step-Down rule:** Return to Accumulator if profit falls below +$70 OR after 2 consecutive 7-outs in Little Molly.

> **On the 2 consecutive 7-out rule:** This trigger is not profit-based by design. Two immediate 7-outs in a row is a signal about table behavior, not just your stack. It suggests shooters are failing to sustain hands — a short-hand pattern that makes the Molly stages structurally punishing regardless of cushion. Profit is a lagging indicator of what already happened. Consecutive 7-out frequency is a leading indicator of what is likely to happen next. Step down, let the Accumulator run, and reassess.

---

## 2.4 Stage 3: 3-Point Molly

**Purpose:** The primary Alpha stage. Three numbers covered, blended edge at 0.37% (Loose) or better. This is where casino money starts hunting fat tails.

**Board (steady state — 3 numbers covered):**

| Table min | Pass/Come flat (×3) | Odds | Total load (Loose) |
|---|---|---|---|
| $10 | $30 | $150 (5× max) | $180 |
| $15 | $45 | $225 (5× max) | $270 |

**Blended HE (Loose): 0.37%**

### Tight vs. Loose: Two modes of the same stage

The 3-Point Molly is played in one of two modes depending on cushion depth and table read. This is a CATS innovation — standard Molly play defaults to flat max odds.

**Coverage** is the set of point numbers currently active — your pass line point plus any Come bets that have traveled to their own numbers. A fully loaded 3-Point Molly has three numbers covered. Coverage state tells you how favorable your win/lose ratio is on any given roll.

**Tight Molly** — tier-based odds scaled to coverage:

| Coverage state | 6/8 odds | 5/9 odds | 4/10 odds | Approx. load |
|---|---|---|---|---|
| Sweet spot (6/8 + 5/9 covered) | 3× | 2× | 1× | ~$120 |
| Middle (6/8, no 5/9) | 2× | — | 1× | ~$100 |
| Rough (no 6/8) | 1× | 1× | 1× | ~$60 |

**Blended HE (Tight, sweet spot): 0.470%**
> ($30 × 1.41% + $60 × 0.00%) ÷ $90 = **0.470%** — identical to Little Molly's profile. Same edge efficiency, more numbers covered, higher load.

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
> When a player first steps up from Little Molly, their profit cushion is at +$150 — the minimum funded threshold. Full Loose Molly load is $180. A single 7-out in Loose mode at step-up leaves the player $30 below buy-in. Tight mode reduces that 7-out cost to ~$90 while maintaining the same 0.470% blended edge as Little Molly — buying time to either deepen the cushion or confirm the shooter before committing maximum variance.
>
> The transition from Tight to Loose is not a concession to conservatism — it is sequencing. The Accumulator existed to fund this moment. Once cushion clears +$200 and the table read is favorable, Loose Molly is the correct expression of everything the earlier stages built toward: maximum odds, minimum edge, full fat-tail exposure.
>
> **The max odds moment is Loose Molly. The Accumulator was its funding event.**

---

**Step-Up threshold:** Profit ≥ +$250. Step up to Expanded Alpha.

**Step-Down rule:** Return to Little Molly if profit falls below +$150 OR after 2 consecutive 7-outs.

---

## 2.5 Stage 4: Expanded Alpha

**Purpose:** Add Buy 4/10 to the Molly. The 4 and 10 have the highest leverage factor in the casino at this edge level — a $20 Buy pays $40 (2:1). Adding them at 1.67% edge into a 0.37% base is an acceptable trade for the coverage and payout they add.

> ⚠️ **Confirm win-vig rule before placing Buy bets.** If the casino charges 5% on every Buy bet (not only on wins), edge is 4.76% — worse than Place 4/10. Ask the dealer: *"Do you charge the vig only on winning Buy bets?"* If yes: 1.67%. If no: skip the Buy bets entirely and let Come bets cover those numbers at 0.37%.

**Board:**

| Table min | Molly load | Buy 4 | Buy 10 | Total load |
|---|---|---|---|---|
| $10 | $180 | $20 | $20 | $220 |
| $15 | $270 | $30 | $30 | $330 |

**Blended HE: 0.496%**
> ($30 × 1.41% + $150 × 0.00% + $40 × 1.67%) ÷ $220 = **0.496%** — a modest rise from the Loose Molly's 0.235%, absorbed by the leverage the Buy 4/10 adds.

**The Swap Rule:** If a Come bet travels to 4 or 10 while a Buy is active on that number — pull the Buy immediately. The Come bet + 5× odds at 0.37% blended dominates the Buy at 1.67%. Tell the dealer: *"Take down my Buy [number]."* You just improved your edge on that number by a factor of 4.5× at no cost.

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

**Blended HE: 0.727%**
> ($30 × 1.41% + $150 × 0.00% + $40 × 1.67% + $40 × 2.00%) ÷ $260 = **0.727%** — the highest in CATS, still less than half the Accumulator's 1.52%.

**Note on Buy 5/9 edge:** At 2.00%, the Buy 5/9 is the highest-edge component in CATS. At Stage 5 cushion levels (+$400), this is an acceptable cost for the coverage. The Molly's Come bets already cover 5 and 9 at blended 0.37% — the Buy bets add *additional* action at those numbers, capturing more of a long shooter's production.

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
| $10 | $10 | $30 | $20 | $10 | ~$120 |
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

The Come + odds at 0.37% blended replaces the Buy at 1.67%. You improve your edge on that number by 4.5× at no cost.

---

## 3.6 Recommended Buy-In

| Session intent | $10 table | $15 table |
|---|---|---|
| Standard CATS (grind up from Stage 1) | $300* | $450* |
| Full session comfort (absorb early variance) | $500 | $750 |

*$300 at a $10 table works — the Accumulator is designed for it. See §5 Art of the Math for the buy-in philosophy and when a higher buy-in changes the session shape rather than just the safety margin.*

---



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

### The Little Molly / Tight Molly identity

When the blended edge calculations were run, a striking result emerged: Little Molly (2× flat odds, $60 load) and 3-Point Molly Tight (tier odds, $90 load) both compute to **0.470% blended edge** — identical.

| Configuration | Flat bets | Odds | Load | Blended HE |
|---|---|---|---|---|
| Little Molly | $20 @ 1.41% | $40 @ 0% | $60 | **0.470%** |
| 3-Point Molly Tight | $30 @ 1.41% | $60 @ 0% | $90 | **0.470%** |

Same edge efficiency. Different load. Different coverage.

What this means in practice: when you step from Little Molly to Tight Molly, you are not buying a better edge. You are buying *more numbers covered* at the same edge cost — moving from 2 numbers to 3, from 1.33–1.67:1 win/lose ratio to 1.83–2.33:1, at a $30 increase in 7-out exposure. The step-up is a variance decision, not an efficiency decision. You are accepting more volatility in exchange for better coverage and a higher win rate per roll — funded by the cushion you built to absorb exactly that volatility.

This is what the math looks like when it confirms the operations. Little Molly was not designed to share an edge profile with Tight Molly. It turned out that way because the tier rule is calibrated correctly.

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

On a cold or choppy table: stay in Little Molly even after reaching the +$150 step-up threshold. You are buying more information at 0.470% edge. Wait for a shooter who sustains before committing to Loose Molly at $180 load. The step-up threshold is a *permission*, not a command.

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

The $600 direct entry skips the grind and starts where the math is best — 0.235% edge from the first roll. The cost: all $600 is your own money from the start. A bad run in Stage 3 hurts differently when the cushion is buy-in rather than accumulated profit. The variance is identical. The psychological frame is not.

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

| Stage | Mode | Blended HE | Variance | 7-out cost ($10) | What you are doing |
|---|---|---|---|---|---|
| Accumulator | — | 1.52% | Low | $24 | Paying to generate capital. Variance is controlled by design. |
| Little Molly | Basic (2× flat) | 0.470% | Low-Med | $60 | Same edge profile as Tight Molly, lower load. Reading the table. |
| 3-Point Molly | Tight (tier odds) | 0.470% | Medium | $90 | Same edge as Little Molly, better coverage. Cushion-aware. |
| 3-Point Molly | Loose (5× flat) | 0.235% | High | $180 | Minimum achievable edge. Maximum fat-tail exposure. |
| Expanded Alpha | Loose + Buy 4/10 | 0.496% | High | $220 | Small edge cost for significant leverage on 4/10. |
| Max Alpha | Expanded + Buy 5/9 | 0.727% | Very High | $260 | Highest edge in Alpha stages. Built for the long roll. |
| Hardways / Props | — | 9–17% | Very High | Varies | **Off the map.** Not a variance choice — a tax. |

Three things this map shows that prose cannot:

First, the **edge cliff between CATS and non-CATS bets** is stark. The worst CATS stage (Accumulator at 1.52%) is still less than one-sixth the edge of the cheapest Hardway (9.09%). These are not comparable decisions on a spectrum — they are different categories.

Second, **Little Molly and Tight Molly share an edge profile.** When you delay stepping up from Little Molly, you are staying at 0.470% edge instead of moving to 0.235% (Loose). That costs efficiency — but it costs it at a rate that is still inside the CATS framework. The cost of buying information is measured in fractions of a percent.

Third, **Loose Molly is the inflection point** — the stage where edge drops below 0.25% and variance goes high simultaneously. Everything in CATS before this moment exists to make this moment survivable. Everything after it exists to extract value from it.

CATS gives you a framework, not a cage. Once you understand why every rule exists, you know which ones have latitude and which are fixed by math that doesn't care how you feel about the next roll.

### What you never adjust

These are edge violations. No read, no feel, no hot streak changes them.

| Rule | Why it is fixed |
|---|---|
| Do not press Place 6/8 during Accumulator | 1.52% edge regardless of bet size. Every pressed dollar is a dollar not in odds at 0% |
| Do not take Hardways, Big 6/8, or Prop bets | 9–16.67% edge. No session justifies these |
| Do not play Place 5/9 or Place 4/10 | 4.00–6.67% edge. Buy instead, or let Come bets cover them |
| Do not stay in a Molly stage after 2 consecutive 7-outs | The trigger exists because in-moment judgment is compromised after consecutive losses |
| Always confirm win-vig before Buy bets | If casino charges on all bets (not wins only): Buy 4/10 edge jumps from 1.67% to 4.76% |

### Where you have latitude

Improvising in CATS means adjusting timing and odds multiples. Nothing else. These are the two levers that move variance without moving edge.

| Decision | CATS indicates | Your latitude |
|---|---|---|
| When to step up | Step up at threshold | Can *delay* step-up on cold table — threshold is permission, not command |
| Odds multiple in Stage 3 | Tight below +$200, Loose above | Can stay Tight above +$200 if table reads uncertain |
| Turbo vs. Standard Accumulator | Turbo on warm tables | Standard on any table — Turbo is a speed option, not required |
| Staying in Little Molly | Step up at +$150 | Can extend Little Molly to read additional shooters — costs 0.470% edge while you watch |
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

**The distinction that matters:** staying in Little Molly two extra shooters costs you edge efficiency — you're at 0.470% instead of 0.235% for those hands. That's a real cost, and it's the cost of buying information. A Hard 8 at any point in that sequence costs 9.09% edge on that bet. These are not similar decisions dressed differently. One is calibrated caution within the framework. The other is a tax.

# §6 BATS Strategy (Darkside)

`[DEFERRED — same structure as CATS. Known issue: Dolly Stage 2 load ($330) does not reconcile with stated $10 table minimum. Needs audit before content is written.]`

---

*— End of working draft v2.1 —*

**BATS Strategy** — deferred to a companion paper. Same Alpha-Transition architecture, darkside mechanics. See §6 stub for known audit items before drafting.
