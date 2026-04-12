/**
 * ScenarioTable — lightweight harness for integration scenario tests.
 *
 * Models the "rail" (player's chip stack not currently on the table) and
 * mirrors the payout-settlement logic from CrapsEngine.settleBets so the
 * tests work against the raw CrapsTable rather than the full engine.
 *
 * Payout semantics (matching CrapsEngine):
 *   PassLineBet / ComeBet / DontPassBet / DontComeBet:
 *     payOut = profit only;  original stake (amount + oddsAmount) returned separately.
 *     ⟹ rail += amount + oddsAmount + payOut
 *
 *   PlaceBet / BuyBet / LayBet:
 *     payOut = original stake + profit (already includes amount).
 *     ⟹ rail += payOut  (then remove one-time bets)
 *
 *   ComeBet come-out push (amount zeroed, oddsAmount preserved):
 *     ⟹ rail += oddsAmount  (odds returned intact; flat was lost)
 */

import { CrapsTable } from '../../../src/craps-table';
import { RiggedDice } from '../../dice/rigged-dice';
import { BaseBet } from '../../../src/bets/base-bet';
import { PassLineBet } from '../../../src/bets/pass-line-bet';
import { ComeBet } from '../../../src/bets/come-bet';
import { PlaceBet } from '../../../src/bets/place-bet';
import { DontPassBet } from '../../../src/bets/dont-pass-bet';

interface BetSnapshot {
  bet: BaseBet;
  amount: number;
  oddsAmount: number;
}

export class ScenarioTable {
  public table: CrapsTable;
  public rail: number;

  constructor(startingBankroll: number, rolls: number[]) {
    this.rail = startingBankroll;
    this.table = new CrapsTable();
    this.table.dice = new RiggedDice(rolls);
  }

  /** Place a bet, deducting flat amount from the rail. */
  bet(b: BaseBet): this {
    this.rail -= b.amount;
    this.table.placeBet(b);
    return this;
  }

  /** Set (or update) take-odds on a PassLineBet or ComeBet, deducting from rail. */
  setOdds(b: PassLineBet, amount: number): this {
    this.rail -= amount - b.oddsAmount; // only deduct the delta (in case updating)
    b.oddsAmount = amount;
    return this;
  }

  /** Set (or update) lay odds on a DontPassBet or DontComeBet, deducting from rail. */
  setLayOdds(b: DontPassBet, amount: number): this {
    this.rail -= amount - b.layOddsAmount;
    b.layOddsAmount = amount;
    return this;
  }

  /** Declare come-bet odds working during come-out. */
  setOddsWorking(b: ComeBet): this {
    b.oddsWorking = true;
    return this;
  }

  /**
   * Roll the next pre-loaded die value, then settle all payouts.
   * Returns `this` for chaining.
   */
  roll(): this {
    const snapshots = this._snapshot();
    this.table.rollDice();
    this._settle(snapshots);
    return this;
  }

  /** Assert the current rail equals `expected`. Returns `this` for chaining. */
  expectRail(expected: number, description?: string): this {
    const label = description ? ` (${description})` : '';
    expect(this.rail).withContext(`rail${label}`).toBe(expected);
    return this;
  }

  // ─── private ────────────────────────────────────────────────────────────────

  private _snapshot(): BetSnapshot[] {
    return this.table.bets.map(bet => ({
      bet,
      amount: bet.amount,
      oddsAmount: (bet instanceof PassLineBet) ? bet.oddsAmount
               : (bet instanceof DontPassBet)  ? bet.layOddsAmount
               : 0,
    }));
  }

  private _settle(snapshots: BetSnapshot[]): void {
    for (const { bet, amount, oddsAmount } of snapshots) {
      const payout = bet.payOut ?? 0;

      if (payout > 0) {
        if (bet instanceof PlaceBet) {
          // PlaceBet: payOut = original + profit; bet stays on table for re-hit.
          this.rail += payout;
          bet.payOut = undefined;
        } else if (bet instanceof PassLineBet || bet instanceof DontPassBet) {
          // PassLineBet / ComeBet / DontPassBet / DontComeBet:
          // payOut = profit only; return original flat + odds separately.
          this.rail += amount + oddsAmount + payout;
          bet.payOut = 0;
          bet.amount = 0;
          if (bet instanceof PassLineBet) bet.oddsAmount = 0;
          if (bet instanceof DontPassBet) bet.layOddsAmount = 0;
          this.table.removeBet(bet);
        } else {
          // BuyBet / LayBet: payOut = original + profit; one-time bet, remove.
          this.rail += payout;
          bet.payOut = 0;
          bet.amount = 0;
          this.table.removeBet(bet);
        }
      } else if (bet instanceof ComeBet && bet.amount === 0 && bet.oddsAmount > 0) {
        // Any seven with odds OFF: flat always lost, odds returned intact.
        this.rail += bet.oddsAmount;
        bet.oddsAmount = 0;
      } else if (bet instanceof DontPassBet && bet.payOut === 0) {
        // DC bar-12 push in transit: return original flat stake, no profit.
        this.rail += amount;
        this.table.removeBet(bet);
      }
      // Losses: amount already zeroed by evaluateDiceRoll; table auto-removes them.
    }
  }
}
