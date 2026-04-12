# Craps Integration Test Scenarios — Source of Truth

**Purpose:** Deterministic scenario scripts for simulator integration tests. Each step is an
observable table action. The simulator must match every rail amount at every step.

**Format:**
- **Rail** = cash on the felt's edge (not on table). Updated after every action.
- Actions: `bets`, `places odds`, `declares`, `rolls`, `pays`, `takes`, `pushes`, `returns`
- Actor is either `Player` or `Dealer`
- No implementation language — pure table actions

---

## Payout Reference

### Pass / Come Odds (true odds)

| Point | Odds Pay | $30 odds wins |
|-------|----------|---------------|
| 4 or 10 | 2:1 | $60 |
| 5 or 9 | 3:2 | $45 |
| 6 or 8 | 6:5 | $36 |

### Place Bets

| Number | Pays | $10 wins | $12 wins |
|--------|------|----------|----------|
| 4 or 10 | 9:5 | $18 | — |
| 5 or 9 | 7:5 | $14 | — |
| 6 or 8 | 7:6 | $11 (floor) | $14 |

### Buy Bets (vig on win only)

Vig = `Math.floor(winAmount × 0.05)`, minimum $1.

| Number | True odds | $20 buys | Vig | Net win |
|--------|-----------|----------|-----|---------|
| 4 or 10 | 2:1 | $40 | $1 | $39 |
| 5 or 9 | 3:2 | $30 | $1 | $29 |
| 6 or 8 | 6:5 | $24 | $1 | $23 |

### Lay Bets (vig on win only)

Lay bets win when 7 rolls before the number. Vig on win only.

| Number | Lay amount | True odds pay | Vig | Net win |
|--------|-----------|---------------|-----|---------|
| 4 or 10 | $40 | $20 | $1 | $19 |
| 5 or 9 | $30 | $20 | $1 | $19 |
| 6 or 8 | $24 | $20 | $1 | $19 |

### Don't Pass / Don't Come (come-out)

| Roll | Result |
|------|--------|
| 2 | Win |
| 3 | Win |
| 12 | Push (bar) |
| 7 | Lose |
| 11 | Lose |
| 4,5,6,8,9,10 | Point established — bet moves behind |

---

## Scenarios 001–010: Pass Line

---

```
Scenario 001 — Pass Line Flat, Point Made

Assumptions: $10 table. Player bankroll $100.
Point: 6. No odds.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 4 (point established: 6)  Rail: $90
Step 3   Dealer   rolls 9 (no action)             Rail: $90
Step 4   Dealer   rolls 6 (point made)            Rail: $90
Step 5   Dealer   pays $10                        Rail: $100
Step 6   Dealer   returns $10 flat bet            Rail: $110

Resolution: Pass line wins even money. Player returns to starting bankroll plus $10 profit.
```

---

```
Scenario 002 — Pass Line + Odds, Point Made (6)

Assumptions: $10 table, 3× odds. Player bankroll $100.
Point: 6. $30 odds (3× flat). 6 pays 6:5. $30 odds wins $36.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   places $30 odds                 Rail: $60
Step 4   Dealer   rolls 8 (no action)             Rail: $60
Step 5   Dealer   rolls 6 (point made)            Rail: $60
Step 6   Dealer   pays $10 (flat)                 Rail: $70
Step 7   Dealer   pays $36 (odds)                 Rail: $106
Step 8   Dealer   returns $10 flat + $30 odds     Rail: $146

Resolution: Pass line flat wins $10. Odds on 6 win $36 at 6:5. Total profit $46.
```

---

```
Scenario 003 — Pass Line Flat, Seven-Out

Assumptions: $10 table. Player bankroll $100.
Point: 8. No odds.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Dealer   rolls 5 (no action)             Rail: $90
Step 4   Dealer   rolls 7 (seven-out)             Rail: $90
Step 5   Dealer   takes $10 flat bet              Rail: $90

Resolution: Pass line loses on seven-out. Player down $10.
```

---

```
Scenario 004 — Pass Line + Odds, Seven-Out (9)

Assumptions: $10 table, 3× odds. Player bankroll $100.
Point: 9. $30 odds. Shooter sevens out before making point.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 9 (point established: 9)  Rail: $90
Step 3   Player   places $30 odds                 Rail: $60
Step 4   Dealer   rolls 4 (no action)             Rail: $60
Step 5   Dealer   rolls 7 (seven-out)             Rail: $60
Step 6   Dealer   takes $10 flat bet              Rail: $60
Step 7   Dealer   takes $30 odds                  Rail: $60

Resolution: Pass line and odds both lose on seven-out. Player down $40.
```

---

```
Scenario 005 — Pass Line, Come-Out Natural (7)

Assumptions: $10 table. Player bankroll $100. No point established.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 7 (natural)               Rail: $90
Step 3   Dealer   pays $10                        Rail: $100
Step 4   Dealer   returns $10 flat bet            Rail: $110

Resolution: Come-out 7 is an immediate winner. No point established. Profit $10.
```

---

```
Scenario 006 — Pass Line, Come-Out Craps (2)

Assumptions: $10 table. Player bankroll $100. No point established.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 2 (craps)                 Rail: $90
Step 3   Dealer   takes $10 flat bet              Rail: $90

Resolution: Come-out 2 is an immediate loser. No point established. Down $10.
```

---

```
Scenario 007 — Pass Line, Come-Out Craps (12)

Assumptions: $10 table. Player bankroll $100. No point established.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 12 (craps)                Rail: $90
Step 3   Dealer   takes $10 flat bet              Rail: $90

Resolution: Come-out 12 is an immediate loser on the pass line. Down $10.
```

---

```
Scenario 008 — Pass Line, Come-Out Yo (11)

Assumptions: $10 table. Player bankroll $100. No point established.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 11 (yo)                   Rail: $90
Step 3   Dealer   pays $10                        Rail: $100
Step 4   Dealer   returns $10 flat bet            Rail: $110

Resolution: Come-out 11 is an immediate winner. No point established. Profit $10.
```

---

```
Scenario 009 — Pass Line, Multi-Roll Point Then Made (5)

Assumptions: $10 table, 3× odds. Player bankroll $100.
Point: 5. $30 odds. 5 pays 3:2. $30 odds wins $45.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 5 (point established: 5)  Rail: $90
Step 3   Player   places $30 odds                 Rail: $60
Step 4   Dealer   rolls 3 (no action)             Rail: $60
Step 5   Dealer   rolls 10 (no action)            Rail: $60
Step 6   Dealer   rolls 5 (point made)            Rail: $60
Step 7   Dealer   pays $10 (flat)                 Rail: $70
Step 8   Dealer   pays $45 (odds at 3:2)          Rail: $115
Step 9   Dealer   returns $10 flat + $30 odds     Rail: $155

Resolution: Point 5 made after two neutral rolls. Flat wins $10, odds win $45. Total profit $55.
```

---

```
Scenario 010 — Pass Line, Multi-Roll Then Seven-Out

Assumptions: $10 table, 3× odds. Player bankroll $100.
Point: 10. $30 odds. Shooter sevens out before making point.

Step 1   Player   bets $10 Pass Line               Rail: $90
Step 2   Dealer   rolls 10 (point established: 10) Rail: $90
Step 3   Player   places $30 odds                  Rail: $60
Step 4   Dealer   rolls 6 (no action)              Rail: $60
Step 5   Dealer   rolls 8 (no action)              Rail: $60
Step 6   Dealer   rolls 7 (seven-out)              Rail: $60
Step 7   Dealer   takes $10 flat                   Rail: $60
Step 8   Dealer   takes $30 odds                   Rail: $60

Resolution: Point 10 never made. Flat and odds both lost. Down $40.
```

---

## Scenarios 011–019: Come Bets

---

```
Scenario 011 — Come Bet, Natural During Travel (7)

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Come bet placed. Next roll is 7.
Note: 7 ends the shooter AND wins the traveling come bet simultaneously.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Come                   Rail: $80
Step 4   Dealer   rolls 7 (come natural; seven-out) Rail: $80
Step 5   Dealer   pays $10 (come bet wins)         Rail: $90
Step 6   Dealer   returns $10 come flat            Rail: $100
Step 7   Dealer   takes $10 Pass Line              Rail: $90

Resolution: Traveling come bet wins on 7. Pass line loses simultaneously. Net: flat.
```

---

```
Scenario 012 — Come Bet, Craps During Travel (2)

Assumptions: $10 table. Player bankroll $100.
Point is ON (8). Come bet placed. Next roll is 2.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Player   bets $10 Come                   Rail: $80
Step 4   Dealer   rolls 2 (craps — come loses)    Rail: $80
Step 5   Dealer   takes $10 come flat             Rail: $80

Resolution: Come bet loses on craps during travel. Pass line unaffected. Down $20 total.
```

---

```
Scenario 013 — Come Bet, Point Established Then Made (flat only)

Assumptions: $10 table. Player bankroll $100.
Pass line point: 8. Come bet travels to 5. Shooter makes 5.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Player   bets $10 Come                   Rail: $80
Step 4   Dealer   rolls 5 (come point: 5)         Rail: $80
Step 5   Dealer   rolls 9 (no action)             Rail: $80
Step 6   Dealer   rolls 5 (come point made)       Rail: $80
Step 7   Dealer   pays $10 (come flat wins)       Rail: $90
Step 8   Dealer   returns $10 come flat           Rail: $100

Resolution: Come point 5 made. Flat wins $10. Pass line still active. Net profit $10 on come.
```

---

```
Scenario 014 — Come Bet + Odds, Point Made (9)

Assumptions: $10 table, 3× odds. Player bankroll $100.
Pass line point: 6. Come point: 9. $30 come odds. 9 pays 3:2. $30 odds wins $45.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Come                   Rail: $80
Step 4   Dealer   rolls 9 (come point: 9)         Rail: $80
Step 5   Player   places $30 come odds on 9       Rail: $50
Step 6   Dealer   rolls 4 (no action)             Rail: $50
Step 7   Dealer   rolls 9 (come point made)       Rail: $50
Step 8   Dealer   pays $10 (come flat)            Rail: $60
Step 9   Dealer   pays $45 (come odds at 3:2)     Rail: $105
Step 10  Dealer   returns $10 flat + $30 odds     Rail: $145

Resolution: Come point 9 made. Flat wins $10, odds win $45. Total come profit $55.
```

---

```
Scenario 015 — Come Bet + Odds, Seven-Out (Odds Off)

Assumptions: $10 table, 3× odds. Player bankroll $100.
Pass line point: 8. Come point: 9. $30 come odds. Odds are OFF (default).

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Player   bets $10 Come                   Rail: $80
Step 4   Dealer   rolls 9 (come point: 9)         Rail: $80
Step 5   Player   places $30 come odds on 9       Rail: $50
Step 6   Dealer   rolls 4 (no action)             Rail: $50
Step 7   Dealer   rolls 7 (seven-out)             Rail: $50
Step 8   Dealer   takes $10 Pass Line flat        Rail: $50
Step 9   Dealer   takes $10 Come flat             Rail: $50
Step 10  Dealer   pushes $30 come odds            Rail: $80

Resolution: Seven-out. Pass and come flats both lose. Come odds pushed (not lost). Down $20.
```

---

```
Scenario 016 — Come Bet + Odds, Seven-Out (Odds Working)

Assumptions: $10 table, 3× odds. Player bankroll $100.
Pass line point: 8. Come point: 9. $30 come odds declared WORKING.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Player   bets $10 Come                   Rail: $80
Step 4   Dealer   rolls 9 (come point: 9)         Rail: $80
Step 5   Player   places $30 come odds on 9       Rail: $50
Step 6   Player   declares come odds working      Rail: $50
Step 7   Dealer   rolls 4 (no action)             Rail: $50
Step 8   Dealer   rolls 7 (seven-out)             Rail: $50
Step 9   Dealer   takes $10 Pass Line flat        Rail: $50
Step 10  Dealer   takes $10 Come flat             Rail: $50
Step 11  Dealer   takes $30 Come odds             Rail: $50

Resolution: Seven-out. All three bets lost. Working odds are live and forfeit. Down $50.
```

---

```
Scenario 017 — Come Bet + Odds, Come-Out Hits Come Point (Odds Off)

Assumptions: $10 table, 3× odds. Player bankroll $100.
Shooter sevens out. New come-out begins. Come-9 is established with $30 odds (OFF).
Shooter rolls 9 on come-out — hits the come point while odds are off.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Player   bets $10 Come                   Rail: $80
Step 4   Dealer   rolls 9 (come point: 9)         Rail: $80
Step 5   Player   places $30 come odds on 9       Rail: $50
Step 6   Dealer   rolls 7 (seven-out)             Rail: $50
Step 7   Dealer   takes $10 Pass Line             Rail: $50
Step 8   Dealer   takes $10 Come flat             Rail: $40
Step 9   Dealer   pushes $30 come odds            Rail: $70
Step 10  Player   bets $10 Pass Line (new come-out) Rail: $60
Step 11  Dealer   rolls 9 (come-out hits come point) Rail: $60
Step 12  Dealer   pays $10 (come flat wins)        Rail: $70
Step 13  Dealer   pushes $30 come odds (off — not paid) Rail: $100
Step 14  Dealer   returns $10 come flat            Rail: $110

Resolution: Come-out roll hits the come point. Flat wins $10. Odds pushed — not paid.
Net come profit $10 only.
```

---

```
Scenario 018 — Two Come Bets, Seven-Out (Both Odds Off)

Assumptions: $10 table, 3× odds. Player bankroll $200.
Pass line point: 6. Come-5 with $30 odds. Come-9 with $30 odds. Both odds OFF.

Step 1   Player   bets $10 Pass Line               Rail: $190
Step 2   Dealer   rolls 6 (point established: 6)   Rail: $190
Step 3   Player   bets $10 Come                    Rail: $180
Step 4   Dealer   rolls 5 (come point: 5)          Rail: $180
Step 5   Player   places $30 come odds on 5        Rail: $150
Step 6   Player   bets $10 Come                    Rail: $140
Step 7   Dealer   rolls 9 (come point: 9)          Rail: $140
Step 8   Player   places $30 come odds on 9        Rail: $110
Step 9   Dealer   rolls 7 (seven-out)              Rail: $110
Step 10  Dealer   takes $10 Pass Line              Rail: $110
Step 11  Dealer   takes $10 Come-5 flat            Rail: $110
Step 12  Dealer   pushes $30 Come-5 odds           Rail: $140
Step 13  Dealer   takes $10 Come-9 flat            Rail: $140
Step 14  Dealer   pushes $30 Come-9 odds           Rail: $170

Resolution: Seven-out. Three flats lost ($30 total). Two odds sets pushed ($60 returned).
Net loss $30.
```

---

```
Scenario 019 — Two Come Bets, One Made Then Seven-Out

Assumptions: $10 table, 3× odds. Player bankroll $200.
Pass line point: 6. Come-5 with $30 odds. Come-8 with $30 odds.
Shooter rolls 5 (come-5 pays), then 7 (come-8 and pass line lose).

Step 1   Player   bets $10 Pass Line               Rail: $190
Step 2   Dealer   rolls 6 (point established: 6)   Rail: $190
Step 3   Player   bets $10 Come                    Rail: $180
Step 4   Dealer   rolls 5 (come point: 5)          Rail: $180
Step 5   Player   places $30 come odds on 5        Rail: $150
Step 6   Player   bets $10 Come                    Rail: $140
Step 7   Dealer   rolls 8 (come point: 8)          Rail: $140
Step 8   Player   places $30 come odds on 8        Rail: $110
Step 9   Dealer   rolls 5 (come-5 point made)      Rail: $110
Step 10  Dealer   pays $10 (come-5 flat)           Rail: $120
Step 11  Dealer   pays $45 (come-5 odds at 3:2)    Rail: $165
Step 12  Dealer   returns $10 flat + $30 odds      Rail: $205
Step 13  Dealer   rolls 7 (seven-out)              Rail: $205
Step 14  Dealer   takes $10 Pass Line              Rail: $195
Step 15  Dealer   takes $10 Come-8 flat            Rail: $185
Step 16  Dealer   pushes $30 Come-8 odds           Rail: $215

Resolution: Come-5 wins $55 profit. Seven-out takes pass and come-8 flat ($20).
Come-8 odds pushed. Net session profit $15.
```

---

## Scenarios 020–027: Place Bets

---

```
Scenario 020 — Place 6, Hit Then Seven-Out

Assumptions: $10 table. Player bankroll $100.
Point is ON (9). Place 6 for $12 (standard unit). 6 pays 7:6. $12 wins $14.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 9 (point established: 9)  Rail: $90
Step 3   Player   bets $12 Place 6                Rail: $78
Step 4   Dealer   rolls 6 (place 6 hits)          Rail: $78
Step 5   Dealer   pays $14                        Rail: $92
Step 6   Dealer   returns $12 place bet           Rail: $104
Step 7   Dealer   rolls 7 (seven-out)             Rail: $104
Step 8   Dealer   takes $10 Pass Line             Rail: $94
Step 9   Dealer   takes $12 Place 6               Rail: $82

Resolution: Place 6 hits once for $14 profit, then loses to seven-out.
Pass line also lost. Net: down $18.
```

---

```
Scenario 021 — Place 8, Hit Then Seven-Out

Assumptions: $10 table. Player bankroll $100.
Point is ON (5). Place 8 for $12. 8 pays 7:6. $12 wins $14.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 5 (point established: 5)  Rail: $90
Step 3   Player   bets $12 Place 8                Rail: $78
Step 4   Dealer   rolls 8 (place 8 hits)          Rail: $78
Step 5   Dealer   pays $14                        Rail: $92
Step 6   Dealer   returns $12 place bet           Rail: $104
Step 7   Dealer   rolls 7 (seven-out)             Rail: $104
Step 8   Dealer   takes $10 Pass Line             Rail: $94
Step 9   Dealer   takes $12 Place 8               Rail: $82

Resolution: Place 8 hits once for $14 profit, then loses to seven-out.
Pass line also lost. Net: down $18.
```

---

```
Scenario 022 — Place 5, Hit Then Seven-Out

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Place 5 for $10. 5 pays 7:5. $10 wins $14.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Place 5                Rail: $80
Step 4   Dealer   rolls 5 (place 5 hits)          Rail: $80
Step 5   Dealer   pays $14                        Rail: $94
Step 6   Dealer   returns $10 place bet           Rail: $104
Step 7   Dealer   rolls 7 (seven-out)             Rail: $104
Step 8   Dealer   takes $10 Pass Line             Rail: $94
Step 9   Dealer   takes $10 Place 5               Rail: $84

Resolution: Place 5 hits once for $14 profit, then loses to seven-out.
Pass line also lost. Net: down $16.
```

---

```
Scenario 023 — Place 9, Hit Then Seven-Out

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Place 9 for $10. 9 pays 7:5. $10 wins $14.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Place 9                Rail: $80
Step 4   Dealer   rolls 9 (place 9 hits)          Rail: $80
Step 5   Dealer   pays $14                        Rail: $94
Step 6   Dealer   returns $10 place bet           Rail: $104
Step 7   Dealer   rolls 7 (seven-out)             Rail: $104
Step 8   Dealer   takes $10 Pass Line             Rail: $94
Step 9   Dealer   takes $10 Place 9               Rail: $84

Resolution: Place 9 hits once for $14 profit, then loses to seven-out.
Pass line also lost. Net: down $16.
```

---

```
Scenario 024 — Place 4, Hit Then Seven-Out

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Place 4 for $10. 4 pays 9:5. $10 wins $18.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Place 4                Rail: $80
Step 4   Dealer   rolls 4 (place 4 hits)          Rail: $80
Step 5   Dealer   pays $18                        Rail: $98
Step 6   Dealer   returns $10 place bet           Rail: $108
Step 7   Dealer   rolls 7 (seven-out)             Rail: $108
Step 8   Dealer   takes $10 Pass Line             Rail: $98
Step 9   Dealer   takes $10 Place 4               Rail: $88

Resolution: Place 4 hits once for $18 profit, then loses to seven-out.
Pass line also lost. Net: down $12.
```

---

```
Scenario 025 — Place 10, Hit Then Seven-Out

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Place 10 for $10. 10 pays 9:5. $10 wins $18.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Place 10               Rail: $80
Step 4   Dealer   rolls 10 (place 10 hits)        Rail: $80
Step 5   Dealer   pays $18                        Rail: $98
Step 6   Dealer   returns $10 place bet           Rail: $108
Step 7   Dealer   rolls 7 (seven-out)             Rail: $108
Step 8   Dealer   takes $10 Pass Line             Rail: $98
Step 9   Dealer   takes $10 Place 10              Rail: $88

Resolution: Place 10 hits once for $18 profit, then loses to seven-out.
Pass line also lost. Net: down $12.
```

---

```
Scenario 026 — Place 6, Off During Come-Out (No Loss on 7)

Assumptions: $10 table. Player bankroll $100.
Point is ON (9). Place 6 active. Shooter sevens out. New come-out begins.
Place bets are OFF by default during come-out. Shooter rolls 7 on come-out.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 9 (point established: 9)  Rail: $90
Step 3   Player   bets $12 Place 6                Rail: $78
Step 4   Dealer   rolls 7 (seven-out)             Rail: $78
Step 5   Dealer   takes $10 Pass Line             Rail: $78
Step 6   Dealer   takes $12 Place 6               Rail: $78
Step 7   Player   bets $10 Pass Line (new come-out) Rail: $68
Step 8   Dealer   rolls 7 (come-out natural — point OFF) Rail: $68
Step 9   Dealer   pays $10 Pass Line              Rail: $78
Step 10  Dealer   returns $10 Pass Line           Rail: $88

Note: Place 6 is not active during come-out. The come-out 7 does not affect it.
The place bet must be re-established after a new point is set.

Resolution: Seven-out takes pass and place. Come-out 7 wins pass line only.
Place 6 has no action during come-out. Net from come-out roll: +$10 pass line win.
```

---

```
Scenario 027 — Place 6, Multiple Hits Before Seven-Out

Assumptions: $10 table. Player bankroll $100.
Point is ON (9). Place 6 for $12. Hits twice, then seven-out.
Each hit: $12 wins $14 (7:6).

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 9 (point established: 9)  Rail: $90
Step 3   Player   bets $12 Place 6                Rail: $78
Step 4   Dealer   rolls 6 (place 6 hit #1)        Rail: $78
Step 5   Dealer   pays $14                        Rail: $92
Step 6   Dealer   returns $12 place bet           Rail: $104
Step 7   Dealer   rolls 6 (place 6 hit #2)        Rail: $104
Step 8   Dealer   pays $14                        Rail: $118
Step 9   Dealer   returns $12 place bet           Rail: $130
Step 10  Dealer   rolls 7 (seven-out)             Rail: $130
Step 11  Dealer   takes $10 Pass Line             Rail: $120
Step 12  Dealer   takes $12 Place 6               Rail: $108

Resolution: Place 6 hits twice ($28 profit), then loses to seven-out with pass line.
Net profit $8.
```

---

## Scenarios 028–032: Buy Bets

---

```
Scenario 028 — Buy 4, Hit (Vig on Win Only)

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Buy 4 for $20. True odds 2:1. Wins $40. Vig = floor($40 × 0.05) = $2.
Net win: $38.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $20 Buy 4                  Rail: $70
Step 4   Dealer   rolls 4 (buy 4 hits)            Rail: $70
Step 5   Dealer   pays $38 (net after $2 vig)     Rail: $108
Step 6   Dealer   returns $20 buy bet             Rail: $128
Step 7   Dealer   rolls 7 (seven-out)             Rail: $128
Step 8   Dealer   takes $10 Pass Line             Rail: $118

Resolution: Buy 4 wins $38 net. Seven-out then takes pass line. Net profit $28.
```

---

```
Scenario 029 — Buy 10, Hit (Vig on Win Only)

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Buy 10 for $20. True odds 2:1. Wins $40. Vig = $2. Net win: $38.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $20 Buy 10                 Rail: $70
Step 4   Dealer   rolls 10 (buy 10 hits)          Rail: $70
Step 5   Dealer   pays $38 (net after $2 vig)     Rail: $108
Step 6   Dealer   returns $20 buy bet             Rail: $128
Step 7   Dealer   rolls 7 (seven-out)             Rail: $128
Step 8   Dealer   takes $10 Pass Line             Rail: $118

Resolution: Buy 10 wins $38 net. Seven-out then takes pass line. Net profit $28.
```

---

```
Scenario 030 — Buy 4, Seven-Out (No Vig Charged)

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Buy 4 for $20. Shooter sevens out. Vig not charged on loss.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $20 Buy 4                  Rail: $70
Step 4   Dealer   rolls 9 (no action)             Rail: $70
Step 5   Dealer   rolls 7 (seven-out)             Rail: $70
Step 6   Dealer   takes $10 Pass Line             Rail: $70
Step 7   Dealer   takes $20 Buy 4 (no vig)        Rail: $70

Resolution: Seven-out takes both bets. No vig on losing buy. Down $30.
```

---

```
Scenario 031 — Buy 5, Hit (Vig on Win Only)

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Buy 5 for $20. True odds 3:2. Wins $30. Vig = floor($30 × 0.05) = $1.
Net win: $29.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $20 Buy 5                  Rail: $70
Step 4   Dealer   rolls 5 (buy 5 hits)            Rail: $70
Step 5   Dealer   pays $29 (net after $1 vig)     Rail: $99
Step 6   Dealer   returns $20 buy bet             Rail: $119
Step 7   Dealer   rolls 7 (seven-out)             Rail: $119
Step 8   Dealer   takes $10 Pass Line             Rail: $109

Resolution: Buy 5 wins $29 net. Seven-out then takes pass line. Net profit $19.
```

---

```
Scenario 032 — Buy 9, Seven-Out (No Vig Charged)

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Buy 9 for $20. Shooter sevens out. Vig not charged on loss.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $20 Buy 9                  Rail: $70
Step 4   Dealer   rolls 7 (seven-out)             Rail: $70
Step 5   Dealer   takes $10 Pass Line             Rail: $70
Step 6   Dealer   takes $20 Buy 9 (no vig)        Rail: $70

Resolution: Seven-out takes both bets. No vig on losing buy. Down $30.
```

---

## Scenarios 033–041: Don't Pass

---

```
Scenario 033 — Don't Pass, Come-Out 7 (Loss)

Assumptions: $10 table. Player bankroll $100. No point established.

Step 1   Player   bets $10 Don't Pass             Rail: $90
Step 2   Dealer   rolls 7 (DP loses on come-out)  Rail: $90
Step 3   Dealer   takes $10 Don't Pass            Rail: $90

Resolution: Come-out 7 is an immediate loser for don't pass. Down $10.
```

---

```
Scenario 034 — Don't Pass, Come-Out 11 (Loss)

Assumptions: $10 table. Player bankroll $100. No point established.

Step 1   Player   bets $10 Don't Pass             Rail: $90
Step 2   Dealer   rolls 11 (DP loses on come-out) Rail: $90
Step 3   Dealer   takes $10 Don't Pass            Rail: $90

Resolution: Come-out 11 is an immediate loser for don't pass. Down $10.
```

---

```
Scenario 035 — Don't Pass, Come-Out 2 (Win)

Assumptions: $10 table. Player bankroll $100. No point established.

Step 1   Player   bets $10 Don't Pass             Rail: $90
Step 2   Dealer   rolls 2 (DP wins on come-out)   Rail: $90
Step 3   Dealer   pays $10                        Rail: $100
Step 4   Dealer   returns $10 Don't Pass          Rail: $110

Resolution: Come-out 2 is an immediate winner for don't pass. Profit $10.
```

---

```
Scenario 036 — Don't Pass, Come-Out 3 (Win)

Assumptions: $10 table. Player bankroll $100. No point established.

Step 1   Player   bets $10 Don't Pass             Rail: $90
Step 2   Dealer   rolls 3 (DP wins on come-out)   Rail: $90
Step 3   Dealer   pays $10                        Rail: $100
Step 4   Dealer   returns $10 Don't Pass          Rail: $110

Resolution: Come-out 3 is an immediate winner for don't pass. Profit $10.
```

---

```
Scenario 037 — Don't Pass, Come-Out 12 (Push / Bar)

Assumptions: $10 table. Player bankroll $100. No point established.

Step 1   Player   bets $10 Don't Pass             Rail: $90
Step 2   Dealer   rolls 12 (bar — push)           Rail: $90
Step 3   Dealer   pushes $10 Don't Pass           Rail: $100

Resolution: Come-out 12 is barred — the don't pass bet is pushed. No gain, no loss.
```

---

```
Scenario 038 — Don't Pass, Point Established Then Seven-Out (Win)

Assumptions: $10 table. Player bankroll $100.
Point: 8. Don't pass moves behind. Shooter sevens out.

Step 1   Player   bets $10 Don't Pass             Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Dealer   rolls 5 (no action)             Rail: $90
Step 4   Dealer   rolls 7 (seven-out — DP wins)   Rail: $90
Step 5   Dealer   pays $10                        Rail: $100
Step 6   Dealer   returns $10 Don't Pass          Rail: $110

Resolution: Don't pass wins when shooter sevens out. Profit $10.
```

---

```
Scenario 039 — Don't Pass, Point Established Then Point Made (Loss)

Assumptions: $10 table. Player bankroll $100.
Point: 8. Don't pass moves behind. Shooter makes the point.

Step 1   Player   bets $10 Don't Pass             Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Dealer   rolls 4 (no action)             Rail: $90
Step 4   Dealer   rolls 8 (point made — DP loses) Rail: $90
Step 5   Dealer   takes $10 Don't Pass            Rail: $90

Resolution: Shooter makes the point. Don't pass loses. Down $10.
```

---

```
Scenario 040 — Don't Pass + Lay Odds, Seven-Out (Win)

Assumptions: $10 table, 3× odds. Player bankroll $100.
Point: 6. Lay odds on 6: true odds 5:6. To win $30 at 5:6, lay $36.
Net: flat wins $10, lay odds win $30.

Step 1   Player   bets $10 Don't Pass             Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   lays $36 odds on Don't Pass     Rail: $54
Step 4   Dealer   rolls 3 (no action)             Rail: $54
Step 5   Dealer   rolls 7 (seven-out — DP wins)   Rail: $54
Step 6   Dealer   pays $10 (DP flat)              Rail: $64
Step 7   Dealer   pays $30 (lay odds at 5:6)      Rail: $94
Step 8   Dealer   returns $10 flat + $36 lay odds Rail: $140

Resolution: Seven-out wins don't pass flat and lay odds. Total profit $40.
```

---

```
Scenario 041 — Don't Pass + Lay Odds, Point Made (Loss)

Assumptions: $10 table, 3× odds. Player bankroll $100.
Point: 6. Lay odds: $36 to win $30. Shooter makes the point. Both bets lose.

Step 1   Player   bets $10 Don't Pass             Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   lays $36 odds on Don't Pass     Rail: $54
Step 4   Dealer   rolls 6 (point made — DP loses) Rail: $54
Step 5   Dealer   takes $10 Don't Pass flat       Rail: $54
Step 6   Dealer   takes $36 lay odds              Rail: $54

Resolution: Point made. Don't pass and lay odds both lose. Down $46.
```

---

## Scenarios 042–049: Don't Come

---

```
Scenario 042 — Don't Come, Natural (7) During Travel (Loss)

Assumptions: $10 table. Player bankroll $100.
Point is ON (8). Don't come placed. Next roll is 7.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Player   bets $10 Don't Come             Rail: $80
Step 4   Dealer   rolls 7 (DC loses; seven-out)   Rail: $80
Step 5   Dealer   takes $10 Don't Come            Rail: $80
Step 6   Dealer   takes $10 Pass Line             Rail: $80

Resolution: Don't come loses on 7 during travel. Pass line also loses. Down $20.
```

---

```
Scenario 043 — Don't Come, 11 During Travel (Loss)

Assumptions: $10 table. Player bankroll $100.
Point is ON (8). Don't come placed. Next roll is 11.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Player   bets $10 Don't Come             Rail: $80
Step 4   Dealer   rolls 11 (DC loses during travel) Rail: $80
Step 5   Dealer   takes $10 Don't Come            Rail: $80

Resolution: Don't come loses on 11 during travel. Pass line unaffected. Down $20 total.
```

---

```
Scenario 044 — Don't Come, 2 During Travel (Win)

Assumptions: $10 table. Player bankroll $100.
Point is ON (8). Don't come placed. Next roll is 2.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Player   bets $10 Don't Come             Rail: $80
Step 4   Dealer   rolls 2 (DC wins during travel) Rail: $80
Step 5   Dealer   pays $10                        Rail: $90
Step 6   Dealer   returns $10 Don't Come          Rail: $100

Resolution: Don't come wins immediately on 2 during travel. Net flat on session so far.
```

---

```
Scenario 045 — Don't Come, 12 During Travel (Push)

Assumptions: $10 table. Player bankroll $100.
Point is ON (8). Don't come placed. Next roll is 12. Barred — push.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 8 (point established: 8)  Rail: $90
Step 3   Player   bets $10 Don't Come             Rail: $80
Step 4   Dealer   rolls 12 (bar — DC pushed)      Rail: $80
Step 5   Dealer   pushes $10 Don't Come           Rail: $90

Resolution: Don't come pushed on 12. No gain, no loss on that bet.
```

---

```
Scenario 046 — Don't Come, Point Established Then Seven-Out (Win)

Assumptions: $10 table. Player bankroll $100.
Pass line point: 6. Don't come travels to 9. Shooter sevens out.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Don't Come             Rail: $80
Step 4   Dealer   rolls 9 (DC point: 9)           Rail: $80
Step 5   Dealer   rolls 4 (no action)             Rail: $80
Step 6   Dealer   rolls 7 (seven-out — DC wins)   Rail: $80
Step 7   Dealer   pays $10 (DC wins)              Rail: $90
Step 8   Dealer   returns $10 Don't Come          Rail: $100
Step 9   Dealer   takes $10 Pass Line             Rail: $90

Resolution: Don't come wins on seven-out. Pass line loses. Net flat.
```

---

```
Scenario 047 — Don't Come, Point Established Then Number Made (Loss)

Assumptions: $10 table. Player bankroll $100.
Pass line point: 6. Don't come travels to 9. Shooter rolls 9.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Don't Come             Rail: $80
Step 4   Dealer   rolls 9 (DC point: 9)           Rail: $80
Step 5   Dealer   rolls 9 (DC point made — DC loses) Rail: $80
Step 6   Dealer   takes $10 Don't Come            Rail: $80

Resolution: Number made, don't come loses. Down $20 total. Pass line still active.
```

---

```
Scenario 048 — Don't Come + Lay Odds, Seven-Out (Win)

Assumptions: $10 table. Player bankroll $100.
Pass line point: 6. Don't come point: 9. Lay odds on DC-9: lay $30 to win $20 (3:2 true odds).

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Don't Come             Rail: $80
Step 4   Dealer   rolls 9 (DC point: 9)           Rail: $80
Step 5   Player   lays $30 DC odds on 9           Rail: $50
Step 6   Dealer   rolls 7 (seven-out — DC wins)   Rail: $50
Step 7   Dealer   pays $10 (DC flat)              Rail: $60
Step 8   Dealer   pays $20 (lay odds at 2:3)      Rail: $80
Step 9   Dealer   returns $10 flat + $30 lay odds Rail: $120
Step 10  Dealer   takes $10 Pass Line             Rail: $110

Resolution: Seven-out wins DC flat and lay odds ($30 total profit). Pass line loses.
Net profit $20.
```

---

```
Scenario 049 — Don't Come + Lay Odds, Number Made (Loss)

Assumptions: $10 table. Player bankroll $100.
Pass line point: 6. Don't come point: 9. Lay odds: $30.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   bets $10 Don't Come             Rail: $80
Step 4   Dealer   rolls 9 (DC point: 9)           Rail: $80
Step 5   Player   lays $30 DC odds on 9           Rail: $50
Step 6   Dealer   rolls 9 (DC point made — DC loses) Rail: $50
Step 7   Dealer   takes $10 DC flat               Rail: $50
Step 8   Dealer   takes $30 DC lay odds           Rail: $50

Resolution: Number made. DC flat and lay odds both lose. Down $40. Pass line still active.
```

---

## Scenarios 050–054: Lay Bets (Standalone)

---

```
Scenario 050 — Lay 4, Seven-Out (Win, Vig on Win)

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Lay 4: lay $40 to win $20 (true odds 1:2). Vig = floor($20 × 0.05) = $1.
Net win: $19.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   lays $40 on 4                   Rail: $50
Step 4   Dealer   rolls 9 (no action)             Rail: $50
Step 5   Dealer   rolls 7 (seven-out — lay wins)  Rail: $50
Step 6   Dealer   pays $19 (net after $1 vig)     Rail: $69
Step 7   Dealer   returns $40 lay bet             Rail: $109
Step 8   Dealer   takes $10 Pass Line             Rail: $99

Resolution: Lay 4 wins $19 net on seven-out. Pass line loses. Net profit $9.
```

---

```
Scenario 051 — Lay 4, Number Rolls (Loss)

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Lay 4 for $40. Shooter rolls 4 before 7. Lay loses. No vig.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   lays $40 on 4                   Rail: $50
Step 4   Dealer   rolls 4 (lay 4 loses)           Rail: $50
Step 5   Dealer   takes $40 lay bet (no vig)      Rail: $50

Resolution: 4 rolls before 7. Lay loses full amount. No vig on loss. Down $50 from start.
```

---

```
Scenario 052 — Lay 10, Seven-Out (Win, Vig on Win)

Assumptions: $10 table. Player bankroll $100.
Point is ON (6). Lay 10: lay $40 to win $20. Vig = $1. Net win: $19.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 6 (point established: 6)  Rail: $90
Step 3   Player   lays $40 on 10                  Rail: $50
Step 4   Dealer   rolls 7 (seven-out — lay wins)  Rail: $50
Step 5   Dealer   pays $19 (net after $1 vig)     Rail: $69
Step 6   Dealer   returns $40 lay bet             Rail: $109
Step 7   Dealer   takes $10 Pass Line             Rail: $99

Resolution: Lay 10 wins $19 net. Pass line loses. Net profit $9.
```

---

```
Scenario 053 — Lay 6, Seven-Out (Win, Vig on Win)

Assumptions: $10 table. Player bankroll $100.
Point is ON (9). Lay 6: lay $24 to win $20 (true odds 5:6). Vig = floor($20 × 0.05) = $1.
Net win: $19.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 9 (point established: 9)  Rail: $90
Step 3   Player   lays $24 on 6                   Rail: $66
Step 4   Dealer   rolls 4 (no action)             Rail: $66
Step 5   Dealer   rolls 7 (seven-out — lay wins)  Rail: $66
Step 6   Dealer   pays $19 (net after $1 vig)     Rail: $85
Step 7   Dealer   returns $24 lay bet             Rail: $109
Step 8   Dealer   takes $10 Pass Line             Rail: $99

Resolution: Lay 6 wins $19 net. Pass line loses. Net profit $9.
```

---

```
Scenario 054 — Lay 6, Number Rolls (Loss)

Assumptions: $10 table. Player bankroll $100.
Point is ON (9). Lay 6 for $24. Shooter rolls 6 before 7. Lay loses. No vig.

Step 1   Player   bets $10 Pass Line              Rail: $90
Step 2   Dealer   rolls 9 (point established: 9)  Rail: $90
Step 3   Player   lays $24 on 6                   Rail: $66
Step 4   Dealer   rolls 6 (lay 6 loses)           Rail: $66
Step 5   Dealer   takes $24 lay bet (no vig)      Rail: $66

Resolution: 6 rolls before 7. Lay loses. No vig on loss. Down $34 from start.
```

---

## Scenario 055: Multi-Bet Combination

---

```
Scenario 055 — Pass Line + 3× Odds + Place 6 + Place 8, Point Made

Assumptions: $10 table, 3× odds. Player bankroll $200.
Point: 5. Pass line $10 + $30 odds. Place 6 for $12. Place 8 for $12.
5 pays 3:2. $30 odds wins $45.
Place 6 hits once (7:6, $12 wins $14). Place 8 does not hit before point made.

Step 1   Player   bets $10 Pass Line              Rail: $190
Step 2   Dealer   rolls 5 (point established: 5)  Rail: $190
Step 3   Player   places $30 odds on Pass Line    Rail: $160
Step 4   Player   bets $12 Place 6                Rail: $148
Step 5   Player   bets $12 Place 8                Rail: $136
Step 6   Dealer   rolls 6 (place 6 hits)          Rail: $136
Step 7   Dealer   pays $14 (place 6)              Rail: $150
Step 8   Dealer   returns $12 place 6 bet         Rail: $162
Step 9   Dealer   rolls 9 (no action)             Rail: $162
Step 10  Dealer   rolls 5 (point made)            Rail: $162
Step 11  Dealer   pays $10 (pass line flat)       Rail: $172
Step 12  Dealer   pays $45 (pass odds at 3:2)     Rail: $217
Step 13  Dealer   returns $10 flat + $30 odds     Rail: $257
Step 14  Dealer   takes $12 Place 6               Rail: $245
Step 15  Dealer   takes $12 Place 8               Rail: $233

Note (Step 14–15): Point made ends the roll. Place bets do not pay when the pass line
point is made — they are taken down or turned off. Place bets only pay when their own
number is rolled, not when the point is made on a different number.

Resolution: Pass line + odds profit $55. Place 6 hit for $14 profit. Place 6 and 8
both taken on point completion. Net profit $69.
```
