# BATS: Bearish Alpha-Transition Strategy

**Version:** 1.0 — Working Draft  
**Table Basis:** $10 / $15 minimum, 5× lay odds  
**Companion to:** CATS: Craps Alpha-Transition Strategy  
**Status:** Draft — simulation validation pending

---

> **How to read this document**
>
> BATS is a companion paper to CATS. It assumes familiarity with the Alpha-Transition
> framework: the concept of a Capital Generation Event, stage-gated escalation, blended
> house edge, and the variance-as-a-dial principle. If those terms are unfamiliar, read
> CATS first.
>
> **§1 Mathematics** — the darkside-specific math. Lay odds geometry, the come-out
> inversion, blended HE by stage. Foundational craps math (dice combinatorics, sample
> space reduction) is inherited from CATS §1 and not repeated here.
>
> **§2–3 Operations** — stage definitions, exact bet amounts, step-up and step-down
> rules. Learn this rote.
>
> **§4 Art of the Math** — the judgment layer. Why BATS exists, when to deploy it,
> how it differs from CATS not just mathematically but psychologically. The table
> villain framing. The switching protocol.

---

# §1 Mathematical Foundations

## 1.1 The Darkside Inversion

BATS bets against the shooter. Where CATS profits from numbers repeating, BATS profits
from the 7-out. This produces a structural inversion across every dimension of the strategy.

| Dimension | CATS (Lightside) | BATS (Darkside) |
|---|---|---|
| Profits from | Numbers repeating, long hands | 7-outs, short hands |
| Come-out 7 | Win (natural) | Lose — the primary vulnerability |
| Come-out 11 | Win (natural) | Lose |
| Come-out 2/3 | Lose | Win (2/3) or push (12) |
| Point established | Race begins — needs number | Race begins — needs 7 |
| Fully loaded | Needs 3 come bets to travel | Needs 3 don't come bets to travel |
| Structural weakness | Come-out 7 kills untraveled Come bets | Come-out 7/11 loses DP before point set |
| Fat tail trigger | Long shooter hitting many numbers | Choppy table, quick 7-outs, short hands |

The single most important difference: **the come-out 7 is CATS's friend and BATS's enemy.**
In CATS, a come-out 7 wins the pass line. In BATS, a come-out 7/11 loses the don't pass
and any don't come bets in transit. This inversion shapes every threshold and fallback rule
in the strategy.

---

## 1.2 Lay Odds Geometry

The odds bet in BATS works in reverse. Because you are the *favorite* to win (the 7 is
more likely than any point number), the casino pays you *less* than you risk. You lay more
to win less — the price of being on the right side of the probability.

**Lay odds structure (to win $50 on a $10 flat bet at 5× odds):**

| Point | True odds | Lay ratio | You risk | You win |
|---|---|---|---|---|
| 4 or 10 | 6 ways to win : 3 ways to lose | 2:1 | $100 | $50 |
| 5 or 9 | 6 ways to win : 4 ways to lose | 3:2 | $75 | $50 |
| 6 or 8 | 6 ways to win : 5 ways to lose | 6:5 | $60 | $50 |

Unlike CATS where all odds pay the same $50 win on $50 risked (flat 5×), BATS odds loads
vary dramatically by point. A 4 or 10 requires $100 in lay odds to win $50 — $40 more
capital than a 6 or 8. This creates significant load variance depending on which points
get established, and makes BATS inherently more capital-intensive than CATS.

**Load range for a fully loaded 3-Point Dolly ($10 table, 5× lay odds):**

| Point combination | Odds load | Flat load | Total |
|---|---|---|---|
| Best case: 6 + 8 + 5 | $195 | $30 | **$225** |
| Typical: 4 + 5 + 6 | $235 | $30 | **$265** |
| Worst case: 4 + 10 + 5 | $275 | $30 | **$305** |

> **The $330 source note:** The original BATS document cited $330 as the 3-Point Dolly
> load at a $10 table. This figure is not achievable with $10 flat bets — the maximum
> computed load at $10 minimum, 5× odds, worst-case points is $305. The $330 figure
> is closer to a $15 table with mixed point combinations. The figures in this document
> use computed values throughout.

---

## 1.3 Point Resolution: BATS Perspective

In CATS, the reduced sample space for each point asks: "does this number appear before a 7?"
In BATS, the question inverts: "does the 7 appear before this number?"

| Point | P(7 before point) = P(BATS wins) | P(point before 7) = P(BATS loses) |
|---|---|---|
| 4 or 10 | 6/9 = **66.7%** | 3/9 = 33.3% |
| 5 or 9 | 6/10 = **60.0%** | 4/10 = 40.0% |
| 6 or 8 | 6/11 = **54.5%** | 5/11 = 45.5% |

BATS is the favorite on every established point. This is the appeal — and the trap.
Being the favorite on each individual resolution does not mean winning the session.
The come-out 7/11 risk, the capital required to lay odds, and the catastrophic
exposure of a long shooter can overwhelm the per-point probability advantage.

---

## 1.4 Blended House Edge by Stage

BATS blended HE is computed the same way as CATS: weighted average of all money in
action by its individual edge.

Don't Pass / Don't Come flat edge: **1.364%** (the bar-12 rule gives the house a slight
edge over the mirror-image Don't Pass; 0.054pp better than the Pass line's 1.41%).
Lay odds edge: **0%** — same as take odds. The zero-edge principle is symmetric.

**$10 table, 5× lay odds:**

| Stage | Name | Flat load | Avg odds load | Total load | Blended HE |
|---|---|---|---|---|---|
| 1 | Bearish Accumulator | $10 | ~$15 | ~$25 | **0.546%** |
| 2 | 3-Point Dolly (best case) | $30 | $195 | $225 | **0.182%** |
| 2 | 3-Point Dolly (typical) | $30 | $235 | $265 | **0.154%** |
| 2 | 3-Point Dolly (worst case) | $30 | $275 | $305 | **0.134%** |
| 3 | Expanded Dark Alpha | $30 | $235 + $40 | $305 | **0.406%** |
| 4 | Max Dark Alpha | $30 | $235 + $80 | $345 | **0.615%** |

Two things stand out from this table and deserve explicit attention:

**BATS 3-Point Dolly is mathematically superior to CATS 3-Point Molly Loose.** The Dolly
achieves 0.134–0.182% blended HE vs. CATS Loose Molly at 0.235%. The Don't Pass's 1.364%
flat edge (vs. Pass line's 1.41%) plus the larger relative proportion of zero-edge odds
in the total load produces a lower blended HE. On paper, BATS has better math in the
Alpha stages.

**The Bearish Accumulator is more efficient than the CATS Accumulator.** 0.546% vs. 1.52%.
This is the structural advantage of betting the Don't Pass — even before the Dolly stages,
BATS has lower edge cost. The tradeoff is the come-out vulnerability and the requirement
for more capital to fund the lay odds.

---

## 1.5 The Come-Out Vulnerability

This is BATS's structural weakness and the primary reason it requires different
fallback logic than CATS.

On a new come-out roll, the probability distribution is:

| Outcome | Probability | BATS result |
|---|---|---|
| 7 | 6/36 = 16.7% | **Don't Pass loses** |
| 11 | 2/36 = 5.6% | **Don't Pass loses** |
| 2 | 1/36 = 2.8% | Don't Pass wins |
| 3 | 2/36 = 5.6% | Don't Pass wins |
| 12 | 1/36 = 2.8% | Don't Pass pushes |
| Point | 24/36 = 66.7% | Game continues |

P(lose on come-out) = 22.2%. P(win on come-out) = 8.3%. P(push) = 2.8%.

BATS loses on the come-out 2.7× more often than it wins. Once a point is established,
BATS is the favorite. But the come-out is always a negative-expectation hurdle — the
price paid for being the favorite on every subsequent roll.

**For the 3-Point Dolly specifically:** while loading up to three don't come bets, any
come-out 7 not only wins the new don't pass but *kills any don't come bets in transit*
— the same structural gap the Molly faces, mirrored. The 7 that helps BATS on the point
harms it on the come-out reload.

This is why the BATS step-down trigger includes "2x points made" — back-to-back
point repeaters are the BATS equivalent of back-to-back 7-outs in CATS. The hot
shooter is BATS's natural predator.

---

## 1.6 CATS vs. BATS: The Efficiency Comparison

The Molly vs. Dolly efficiency table from leverage and cost-of-profit perspective:

| Bet | Point | Load | Payout on win | Leverage factor | Tax per $100 win |
|---|---|---|---|---|---|
| Molly (CATS) | 4 or 10 | $60 | $110 | 1.83× | $0.13 |
| Molly (CATS) | 5 or 9 | $60 | $85 | 1.41× | $0.16 |
| Molly (CATS) | 6 or 8 | $60 | $70 | 1.16× | $0.20 |
| Dolly (BATS) | 4 or 10 | $110 | $60 | 0.54× | $0.22 |
| Dolly (BATS) | 5 or 9 | $85 | $60 | 0.70× | $0.22 |
| Dolly (BATS) | 6 or 8 | $72 | $60 | 0.83× | $0.22 |

Molly wins on every leverage metric. On a 4 or 10, Molly produces $1.83 for every
$1 at risk. Dolly produces $0.54 — reverse leverage. BATS pays a higher tax per dollar
of profit because the casino is compensating for giving you the probability advantage.

**The implication:** CATS is the growth play. BATS is the income play. CATS hunts the
fat tail. BATS harvests the mean. These are not better or worse — they are designed
for different table conditions and different session objectives.

---

# §2 BATS Strategy Stages

## 2.0 Stage Overview

BATS follows the same five-stage escalation logic as CATS: each stage is funded by
profit from the previous stage, and table load only increases when accumulated profit
justifies the variance.

| # | Stage | Board | Blended HE | Step-Up threshold | Step-Down threshold |
|---|---|---|---|---|---|
| 1 | **Bearish Accumulator** | Don't Pass + 1-unit lay odds | 0.546% | Profit ≥ **+$120** | Starting state |
| 2 | **Little Dolly** | DP + 1 DC + 2× lay odds | `[RECOMPUTE]` | Profit ≥ **+$225** | Profit < +$120 or 2× come-out losses |
| 3 | **3-Point Dolly** | DP + 2 DC + max lay odds | 0.134–0.182% | Profit ≥ **+$350** | Profit < +$225 or 2× point repeaters |
| 4 | **Expanded Dark Alpha** | Dolly + Lay 4/10 (win-vig) | 0.406% | Profit ≥ **+$500** | Profit < +$350 |
| 5 | **Max Dark Alpha** | Exp. Dark + Lay 5/9 (win-vig) | 0.615% | The cold table | Profit < +$500 |

> **On thresholds:** BATS step-up thresholds are set higher relative to load than CATS,
> because the Dolly's load variance by point combination means you may face $305 in
> exposure even when the typical case is $265. The extra buffer accounts for this.
> The truly funded threshold for Stage 3 is profit ≥ max load ≈ $305, rounded to $350
> for a clean multiplier with margin.

> **Little Dolly (Stage 2) is new** — same rationale as CATS's Little Molly. Bridges
> the $25 Bearish Accumulator load to the $225–305 full Dolly in a controlled step.

---

## 2.1 Stage 1: Bearish Accumulator

**Purpose:** Generate the capital buffer that funds the Dolly stages. Bet against the
shooter surviving the come-out at minimum load.

**Board:** Don't Pass + lay odds to win approximately 1 unit.

| Table min | DP flat | Lay odds (to win ~1 unit) | Total load |
|---|---|---|---|
| $10 | $10 | ~$15 avg (depends on point) | ~$25 |
| $15 | $15 | ~$22 avg | ~$37 |

**Lay odds to win 1 unit by point ($10 table):**

| Point | Lay to win $10 |
|---|---|
| 4 or 10 | $20 |
| 5 or 9 | $15 |
| 6 or 8 | $12 |

**The De-Leverage logic:** The Bearish Accumulator has no mechanical regress moment
like CATS's first-hit regression — because it is already minimal by design. The flat
bet is small, the odds are calibrated to win exactly 1 unit. There is no "press" moment.
Every 7-out win goes directly to the rack.

**The come-out protocol:** Place the Don't Pass before the come-out. If the come-out
produces a 7 or 11, accept the loss and post another Don't Pass for the next come-out.
Do not add lay odds until a point is established. The come-out is always a negative
hurdle — get through it, then lay odds once you are the favorite.

**Step-Up threshold:** Profit ≥ +$120 (+12× TM). Step up to Little Dolly.

---

## 2.2 Stage 2: Little Dolly *(new)*

**Purpose:** Mirrors Little Molly in CATS. Two functions: drop blended HE from 0.546%
to sub-0.3% immediately on step-up, and take a table read on whether short-hand
behavior is consistent enough to justify the full Dolly's load variance.

**Board:** Don't Pass + 1 Don't Come + 2× lay odds on both.

| Table min | DP flat | DC flat | Lay odds each (2×) | Total load |
|---|---|---|---|---|
| $10 | $10 | $10 | ~$30 avg | ~$70 |
| $15 | $15 | $15 | ~$45 avg | ~$105 |

**Blended HE: ~0.341%** (weighted average across point combinations)
> ($20 × 1.364% + $60 × 0.00%) ÷ $80 = **0.341%** — weighted by point probability.
> Range: 0.273% (both points on 4/10) to 0.401% (both on 6/8). Unlike CATS where
> 2× odds cost the same regardless of number, BATS load — and therefore blended HE —
> varies by which points get established. Higher-leverage points (4/10) cost more to
> lay against but produce a lower blended HE because the odds proportion is larger.

**What you are watching:** Are shooters establishing points and sevening out within
3–5 rolls? Are come-out 7s appearing at normal frequency (not a streak)? Is the table
quiet — few players winning, dealers moving fast? Little Dolly answers these questions
at ~$70 of risk instead of $265–305. When the answer is consistently yes — step up.

**Step-Up threshold:** Profit ≥ +$225. Step up to 3-Point Dolly.

**Step-Down rule:** Return to Bearish Accumulator if profit falls below +$120 OR
after 2 consecutive come-out losses (7 or 11 on come-out for the Don't Pass).

> **On the 2× come-out loss rule:** Two consecutive come-out losses signals that
> naturals are clustering — a pattern that is exactly the wrong environment for BATS.
> The come-out hurdle is the one moment BATS is structurally disadvantaged; back-to-back
> losses there suggest the table is running warm, not cold. Step down and reassess.

---

## 2.3 Stage 3: 3-Point Dolly

**Purpose:** The primary BATS Alpha stage. Three don't bets working with maximum lay
odds. Blended HE drops to 0.134–0.182% — the best achievable edge in standard craps.

**Board (steady state — 3 don't bets working):**

| Table min | Flat (×3) | Avg lay odds | Typical load | Worst-case load |
|---|---|---|---|---|
| $10 | $30 | $235 | $265 | $305 |
| $15 | $45 | $352 | $397 | $457 |

**Note on load variance:** Unlike the Molly where all odds cost the same ($50 per
number at 5×), the Dolly's odds cost varies by point. A session that establishes 4, 10,
and 5 costs $275 in odds. A session that establishes 6, 8, and 5 costs $195. This
±$40 swing is inherent to BATS and cannot be eliminated — it must be anticipated in
your cushion sizing. The step-up threshold of +$350 provides buffer for worst-case load.

**Odds rule:** Max lay odds on all working don't bets. Unlike CATS's Tight/Loose
distinction, BATS does not have a tiered odds mode in Stage 3 — the math uniformly
favors max odds on all points, and the load variance is driven by point combination,
not by a choice. Take max odds every time.

> #### 📐 Deep Dive: Why BATS Doesn't Need a Tight Mode
>
> CATS introduced Tight Molly because a player stepping up at exactly +$150 cushion
> might face $180 in Loose Molly exposure — a thin funded position. BATS's higher
> step-up threshold (+$350 for a max load of ~$305) provides genuine buffer from day
> one of Stage 3. The Tight mode exists in CATS to bridge an underfunded entry. BATS
> is designed so that entry is properly funded before Stage 3 begins.
>
> The other difference: CATS's Tight mode was calibrated around the 6/8 being
> highest-win-probability numbers that deserve more odds. In BATS, the probability
> advantage is *highest* on the 4/10 (66.7% P(7 before point)) — but those numbers
> also require the most capital to lay against. The tier logic would perversely
> recommend more capital on the hardest numbers to fund. Max odds on all numbers,
> let the step-up threshold handle the cushion question.

**The point-repeater step-down trigger:** When a shooter makes their point, they have
just inflicted the worst possible BATS outcome — the established number appeared before
the 7, costing you the flat bet plus any lay odds on that number. Two consecutive point
makes is the BATS equivalent of two consecutive 7-outs in CATS: a behavioral signal
that the table is running hot, not cold. Step down immediately.

**Step-Up threshold:** Profit ≥ +$350. Step up to Expanded Dark Alpha.

**Step-Down rule:** Return to Little Dolly if profit falls below +$225 OR after 2
consecutive point repeaters on any shooter.

---

## 2.4 Stage 4: Expanded Dark Alpha

**Purpose:** Add Lay 4/10 to the Dolly. The 4 and 10 have P(7 before point) = 66.7%
— the most favorable resolution probability in craps. Adding lay bets at 1.67% edge
into a sub-0.2% base is an acceptable trade for the expanded coverage.

> ⚠️ **Confirm win-vig before placing Lay bets.** Same rule as CATS Buy bets: if the
> casino charges vig on all lay bets (not wins only), the edge is 4.76%. Ask: *"Do you
> charge the vig only on winning Lay bets?"* If no — skip the Lay bets entirely and let
> Don't Come bets cover those numbers at 0% edge.

**Board:**

| Table min | Dolly load (typical) | Lay 4 | Lay 10 | Total |
|---|---|---|---|---|
| $10 | $265 | $20 | $20 | $305 |
| $15 | $397 | $30 | $30 | $457 |

**Blended HE: 0.406%**

**The Swap Rule (BATS version):** If a Don't Come bet travels to 4 or 10 while a
Lay bet is active on that number — pull the Lay bet. The Don't Come + max lay odds
at 0.154% blended dominates the standalone Lay bet at 1.67%. Tell the dealer:
*"Take down my Lay [number]."*

**Step-Up threshold:** Profit ≥ +$500. Step up to Max Dark Alpha.

**Step-Down rule:** Return to 3-Point Dolly if profit falls below +$350.

---

## 2.5 Stage 5: Max Dark Alpha

**Purpose:** Maximum board coverage against the 7. Infrastructure for the sustained
choppy table — many shooters, all failing quickly. In practice, reaching Stage 5
requires exceptional table conditions sustained across many shooters.

**Board:** Expanded Dark Alpha + Lay 5 and Lay 9 (win-vig only).

| Table min | Expanded Dark load | Lay 5 | Lay 9 | Total |
|---|---|---|---|---|
| $10 | $305 | $20 | $20 | $345 |
| $15 | $457 | $30 | $30 | $517 |

**Blended HE: 0.615%**

**Step-Down rule:** Return to Expanded Dark Alpha if profit falls below +$500.

---

# §3 Operations Playbook

## 3.1 Step-Up / Step-Down Gate Table

### $10 Table Minimum, 5× Lay Odds

| Stage | Name | Typical load | Step-Up when | Step-Down when |
|---|---|---|---|---|
| **1** | Bearish Accumulator | ~$25 | Profit ≥ **+$120** | Starting state |
| **2** | Little Dolly | ~$70 | Profit ≥ **+$225** | Profit < +$120 or 2× come-out losses |
| **3** | 3-Point Dolly | $225–305 | Profit ≥ **+$350** | Profit < +$225 or 2× point repeaters |
| **4** | Expanded Dark Alpha | ~$305 | Profit ≥ **+$500** | Profit < +$350 |
| **5** | Max Dark Alpha | ~$345 | The cold table | Profit < +$500 |

### $15 Table Minimum, 5× Lay Odds

| Stage | Name | Typical load | Step-Up when | Step-Down when |
|---|---|---|---|---|
| **1** | Bearish Accumulator | ~$37 | Profit ≥ **+$180** | Starting state |
| **2** | Little Dolly | ~$105 | Profit ≥ **+$340** | Profit < +$180 or 2× come-out losses |
| **3** | 3-Point Dolly | $337–457 | Profit ≥ **+$525** | Profit < +$340 or 2× point repeaters |
| **4** | Expanded Dark Alpha | ~$457 | Profit ≥ **+$750** | Profit < +$525 |
| **5** | Max Dark Alpha | ~$517 | The cold table | Profit < +$750 |

---

## 3.2 Exact Bet Amounts by Stage

### Stage 1: Bearish Accumulator

| Table min | Don't Pass | Lay odds by point | Total load |
|---|---|---|---|
| $10 | $10 | $20 on 4/10 · $15 on 5/9 · $12 on 6/8 | ~$25 |
| $15 | $15 | $30 on 4/10 · $24 on 5/9 · $18 on 6/8 | ~$37 |

*Post Don't Pass before come-out. Wait for point. Then lay odds.*

### Stage 2: Little Dolly

| Table min | DP flat | DC flat | Lay odds each (2×) | Total load |
|---|---|---|---|---|
| $10 | $10 | $10 | ~$30 avg | ~$70 |
| $15 | $15 | $15 | ~$45 avg | ~$105 |

### Stage 3: 3-Point Dolly — Max Lay Odds

| Table min | Flat (×3) | Lay odds by point | Load range |
|---|---|---|---|
| $10 | $30 | $100 on 4/10 · $75 on 5/9 · $60 on 6/8 | $225–$305 |
| $15 | $45 | $150 on 4/10 · $112 on 5/9 · $90 on 6/8 | $337–$457 |

### Stage 4: Expanded Dark Alpha

| Table min | Dolly load | Lay 4 | Lay 10 | Total |
|---|---|---|---|---|
| $10 | $265 (typical) | $20 | $20 | ~$305 |
| $15 | $397 (typical) | $30 | $30 | ~$457 |

*Confirm win-vig only before placing.*

### Stage 5: Max Dark Alpha

| Table min | Exp. Dark load | Lay 5 | Lay 9 | Total |
|---|---|---|---|---|
| $10 | ~$305 | $20 | $20 | ~$345 |
| $15 | ~$457 | $30 | $30 | ~$517 |

---

## 3.3 Step-Down Rules

**2× come-out loss rule (Stages 2–5):** Two consecutive come-out 7s or 11s on the
Don't Pass triggers a step-down. Come-out naturals clustering indicates a warm table —
the wrong environment for BATS.

**2× point repeater rule (Stages 3–5):** Two consecutive point makes by the same or
successive shooters triggers a step-down from Stage 3. Hot shooters are BATS's
natural predator.

**Profit threshold step-down:** If profit falls below the current stage's entry
threshold, step down immediately — same rule as CATS.

**Hard reset:** Profit < +$20 from any stage → return to Bearish Accumulator.

---

## 3.4 The Swap Rule (Stages 4–5)

If a Don't Come bet travels to 4 or 10 while a Lay bet is active on that number:

1. Confirm the Don't Come is working on that number
2. Tell the dealer: *"Take down my Lay [number]"*
3. Take full max lay odds on the Don't Come instead

The Don't Come + max odds at ~0.15% blended replaces the standalone Lay at 1.67%.

---

## 3.5 Recommended Buy-In

| Session intent | $10 table | $15 table |
|---|---|---|
| Standard BATS (grind from Stage 1) | $300* | $500* |
| Full session comfort | $500 | $750 |

*$300 at a $10 table covers the Bearish Accumulator indefinitely and funds Stage 3
if the Accumulator performs. The Dolly's load variance ($225–305) means $300 is thin
once in Stage 3 — $500 is the recommended working buy-in for a full BATS session.*

---

# §4 Art of the Math

## 4.1 The Table Villain

CATS is a social strategy. You cheer with the table. Every number that hits pays you.
The crowd is your ally. The game's natural momentum — hope, energy, the excitement
of a long roll — aligns with your position.

BATS is not social. You are betting against every other player at the rail. When the
shooter makes their point, the table erupts and you lose. When the shooter sevens out,
everyone groans and you collect. You are, by definition, the table villain.

This psychological dimension is real and should not be underestimated. Some players
find BATS uncomfortable — collecting chips while others are losing is its own kind of
cognitive friction. Others find it liberating — you are no longer dependent on the
shooter, no longer hoping for a specific number. You are simply waiting for the
statistical mean to assert itself.

The right player for BATS is not someone who hates craps — it is someone who has
internalized the math deeply enough to be comfortable acting on it regardless of the
social grain of the table.

---

## 4.2 When the Math Points to BATS

BATS is not a permanent strategy. It is a *deployment decision* made based on table
conditions. The same player might run CATS for one shooter and BATS for the next.

**Deploy BATS when:**

| Signal | What you observe | What it means |
|---|---|---|
| Short hands | Shooters establishing a point and sevening out within 3–5 rolls | Mean reversion is asserting itself |
| Quiet rail | Light racks, few side conversations, dealers relaxed | Table is cold; CATS players losing |
| Come-out frequency | Frequent 2s, 3s, and early 7-outs before points establish | Come-out volatility favoring Don't |
| Choppy pattern | No shooter lasting more than one point cycle | Exactly the BATS hunting ground |

**Stay with CATS (or switch back) when:**

| Signal | What you observe |
|---|---|
| Long hands | Shooter surpassing 8–10 rolls, numbers repeating |
| Heavy racks | Players pressing bets, chips stacking |
| Come-out naturals | Multiple 7s and 11s on come-outs |
| "The crowd woke up" | Energy shift, table getting loud |

The animal swap is always available: CATS profit can fund BATS Alpha stages, and vice
versa. The entry method does not dictate the Alpha strategy. Casino money is fungible.

---

## 4.3 The Load Tax: BATS's Real Cost

BATS has better blended HE numbers than CATS in the Alpha stages. So why doesn't
everyone play BATS?

The load tax. Laying 4 or 10 at max odds costs $100 in lay bets to win $50. The
Molly on a 4 or 10 costs $60 in odds to win $50. BATS requires 67% more capital
per bet to generate the same profit. This is not an edge problem — the odds are still
zero-edge. It is a capital efficiency problem.

The Molly's leverage factor on a 4/10 is 1.83× — you risk $60 and win $110 total.
The Dolly's leverage factor on a 4/10 is 0.54× — you risk $110 and win $60. Same
zero-edge odds structure. Completely different capital requirement.

**What BATS is trading:** lower variance and higher win frequency for lower leverage
and higher capital requirement. It is income play vs. growth play. If your session
goal is steady grinding with fewer large swings, BATS delivers that. If your goal is
fat-tail hunting — finding the one long shooter who funds the weekend — CATS delivers
that. The choice is about objective, not about which strategy is "better."

---

## 4.4 The Switching Protocol

The Alpha-Transition framework is dynamic. These three rules govern switching between
CATS and BATS within a session:

**The Animal Swap:** Profit accumulated in any Accumulator stage is fungible. A $120
profit in the Bearish Accumulator can fund CATS's Little Molly just as easily as
BATS's Little Dolly. The entry vehicle does not dictate the Alpha vehicle.

**The Momentum Shift:** If a shooter makes two consecutive points while you are in
BATS, they have signaled bullish activity. Step down BATS, and consider CATS for the
next shooter. The table has given you evidence about its current character.

**Capital Preservation:** After a hard reset, return to whichever Accumulator matches
the *current* table energy — not the one that just lost. The Bearish Accumulator on
a cold table. The CATS Accumulator on a warm one. The decision is always forward-looking.

---

## 4.5 BATS Survival Matrix

*Consecutive maximum-loss outcomes before reaching $0. For BATS, the worst case is
not 7-outs (which are wins) but point repeaters and come-out losses.*

*$10 table, 5× lay odds. "Max loss events" = point makes at max load.*

| Buy-in | Bearish Accumulator | Little Dolly | 3-Point Dolly | Expanded Dark Alpha |
|---|---|---|---|---|
| $300 | ~12 come-out losses | ~4–5 | ~1–2 | ~1 |
| $500 | ~20 come-out losses | ~7 | ~2–3 | ~2 |
| $700 | ~28 come-out losses | ~10 | ~3–4 | ~2–3 |

The BATS survival matrix numbers look similar to CATS at the Dolly stages. But the
character of losses is different — BATS losses happen on high-probability adverse
events (point makes), not on low-probability catastrophic events (the hot shooter
making multiple points rapidly). BATS bleeds more smoothly. CATS can hemorrhage on
a single long shooter.

---

# §5 Appendix: CATS vs. BATS Quick Reference

| Dimension | CATS | BATS |
|---|---|---|
| Strategy archetype | Growth | Income |
| Hunts | The fat tail (long roll) | The mean (quick 7-out) |
| Come-out | 7/11 = win | 7/11 = lose |
| Best table | Warm, energetic, repeating numbers | Cold, choppy, short hands |
| Stage 1 edge | 1.52% | 0.546% |
| Alpha stage edge | 0.235% (Loose Molly) | 0.134–0.182% (Dolly) |
| Load variance | Low (fixed by table min) | High (varies by point combination) |
| Leverage | High (1.83× on 4/10) | Low (0.54× on 4/10) |
| Win frequency | Lower (need numbers) | Higher (need 7) |
| Social dynamic | With the table | Against the table |
| Recommended buy-in | $300–500 | $400–500 |
| Worst enemy | The quick 7-out | The hot shooter |

---

# §6 Simulation Results

`[TODO — pending bet structure implementation in simulator. Key comparisons to run:
BATS vs. CATS (head-to-head), BATS vs. PassLine+Odds, BATS vs. DontPass+MaxOdds
(the pure darkside baseline), BATS vs. AccumulatorOnly. Primary metrics: ruin rate,
median final, median peak, roll-to-peak.]`

---




---

> **Implementation notes for the coding agent** are in a separate document:
> `bats-implementation.md`. That document covers engine extensions required,
> lay odds DSL usage, stage machine structure, and the implementation checklist.

*— End of working draft v1.0 —*

**Open items before v1.0 final:**
1. `[RECOMPUTE]` Little Dolly blended HE
2. `[RECOMPUTE]` $15 table thresholds — verify multiples consistent
3. `[TODO]` Simulation results — §6 after simulator build-out
4. `[TODO]` Wallet cards — BATS $10/$15 after thresholds confirmed
