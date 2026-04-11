# Come Bet Odds Behavior — Source of Truth

**Scope:** Resolution of a come bet with odds during the shooter's come-out roll.

**Standing Assumptions**
- Table minimum: $10
- Maximum odds: 5×
- Come bet flat wager: $10
- Come point: 9
- Odds wager behind come-9: $50
- Shooter is in come-out phase (no active pass line point)
- Odds status: **off** (default; player has not declared working)

---

## Section 1 — The Nature of "Off" Odds

**1.1** Odds placed behind a come point are off by default during the shooter's come-out roll.

**1.2** Off odds are not at risk. They cannot win and they cannot lose during the come-out roll.

**1.3** Off odds that are returned to the player are neither a win nor a loss. They are the player's own money coming back.

**1.4** A returned odds wager leaves the player in exactly the financial position they were in before placing that odds wager. Nothing gained, nothing lost on that amount.

---

## Section 2 — Come-Out Roll: Come Point Hits (Shooter Rolls 9)

**2.1** The come-9 flat bet wins. The player is paid $10 on their $10 flat wager.

**2.2** The $50 odds do not win. The point hitting does not trigger an odds payout when odds are off.

**2.3** The $50 odds are returned to the player intact.

**2.4** The player's net gain from this event is $10.

**2.5** The $50 returned to the player is not part of the gain. It is restoration of their own wager.

---

## Section 3 — Come-Out Roll: Shooter Rolls 7

**3.1** The come-9 flat bet loses. The house takes the $10 flat wager.

**3.2** The $50 odds do not lose. The seven-out does not forfeit off odds.

**3.3** The $50 odds are returned to the player intact.

**3.4** The player's net loss from this event is $10.

**3.5** The $50 returned to the player is not part of the loss. It is restoration of their own wager.

---

## Section 4 — The Symmetry Principle

**4.1** In both Section 2 and Section 3, the $50 odds produce the same outcome: returned intact.

**4.2** The come-out roll result (9 or 7) determines what happens to the flat bet only. It has no bearing on the disposition of off odds.

**4.3** Off odds are indifferent to the come-out roll result.

---

## Section 5 — Contrast: Odds Declared Working

**5.1** A player may declare their odds working during the come-out roll. This overrides the default off state for that player's odds only.

**5.2** With odds working and shooter hits 9: the $50 odds win at true odds for the 9. The 9 pays 3:2, so the player wins $75 on their $50 wager. Net gain: $10 (flat) + $75 (odds) = $85.

**5.3** With odds working and shooter rolls 7: the $50 odds lose along with the $10 flat. Net loss: $60.

**5.4** The working declaration is a player-level setting, not a table-level setting.

---

## Section 6 — Accounting Truths

**6.1** Any system that records a returned odds wager as a winning will overstate the player's gains.

**6.2** Any system that records a returned odds wager as a loss will overstate the player's losses.

**6.3** The correct treatment of a returned odds wager produces zero effect on the player's net position for that event.

**6.4** In a multi-come strategy (e.g., two or three active come points), a single seven-out may return odds on multiple points simultaneously. Each returned amount is independently subject to 6.1–6.3.

**6.5** A simulation measuring session profitability that misclassifies returned odds will produce compounding error proportional to the number of come points carried and the frequency of seven-outs.

---

## Section 7 — Push: Definition and Metrics

**7.1** A push is a bet resolution event in which the player's net position does not change. The wager is returned intact. Nothing is gained, nothing is lost.

**7.2** A push is distinct from a non-event. The bet was live, a resolution event occurred, the bet was evaluated, and it was returned. Capital was at risk and survived.

**7.3** A push is distinct from a win. A win increases the player's net position. A push does not.

**7.4** A push is distinct from a loss. A loss decreases the player's net position. A push does not.

**7.5** Returned off odds are a push. The resolution event (come-out roll) occurred, the odds were evaluated, and they were returned intact.

**7.6** Push amount is the dollar value of wagers returned in a single push event. In the standing assumptions, the push amount is $50.

**7.7** A single resolution event may produce multiple simultaneous pushes. In a three-come strategy with $50 odds on each point, a seven-out returns $150 in pushed odds across three independent push events.

**7.8** Push volume is a valid session-level metric: the total dollar amount pushed across all resolution events in a session. It is independent of wins and losses.

**7.9** Push volume is not profit. Push volume is not loss. It must not appear in any calculation of net session result.

**7.10** Push rate — pushed dollars as a proportion of total odds wagered — is a measure of capital efficiency. A high push rate indicates that a significant portion of odds wagers survived resolution events without generating a return.

**7.11** The decision to declare odds working converts a guaranteed push into a live wager. The player accepts loss exposure in exchange for win potential. This is a quantifiable variance tradeoff, not a strategic improvement or degradation in expected value.
