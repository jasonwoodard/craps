import { CrapsTable } from '../craps-table';
import { ReconcileEngine, StrategyDefinition } from '../dsl/strategy';
import { GameState } from '../dsl/game-state';
import { BetCommand, stringToBetType, betTypeToString } from '../dsl/bet-reconciler';
import { Dice, LiveDice } from '../dice/dice';
import { BaseBet } from '../bets/base-bet';
import { PassLineBet } from '../bets/pass-line-bet';
import { ComeBet } from '../bets/come-bet';
import { PlaceBet } from '../bets/place-bet';
import { FieldBet } from '../bets/field-bet';
import { DontPassBet } from '../bets/dont-pass-bet';
import { DontComeBet } from '../bets/dont-come-bet';
import { RunLogger } from '../logger/run-logger';
import { RollRecord, ActiveBetInfo, EngineResult } from './roll-record';
import { STAGE_MACHINE_RUNTIME } from '../dsl/strategy';
import { StageMachineRuntime } from '../dsl/stage-machine-state';
import { Outcome } from '../dsl/outcome';

export { RollRecord, ActiveBetInfo, EngineResult } from './roll-record';

export interface CrapsEngineConfig {
  strategy: StrategyDefinition;
  bankroll: number;
  rolls: number;
  seed?: number;
  dice?: Dice;
  logger?: RunLogger;
}

interface BetSnapshot {
  bet: BaseBet;
  amount: number;
  oddsAmount: number;
}

export class CrapsEngine {
  private table: CrapsTable;
  private reconcileEngine: ReconcileEngine;
  private strategy: StrategyDefinition;
  private bankroll: number;
  private initialBankroll: number;
  private maxRolls: number;
  private logger?: RunLogger;
  private playerId = 'engine-player';

  constructor(config: CrapsEngineConfig) {
    this.strategy = config.strategy;
    this.bankroll = config.bankroll;
    this.initialBankroll = config.bankroll;
    this.maxRolls = config.rolls;
    this.logger = config.logger;

    this.table = new CrapsTable();
    if (config.dice) {
      this.table.dice = config.dice;
    } else if (config.seed != null) {
      this.table.dice = new LiveDice(config.seed);
    }

    const gameState = new GameState(this.table.dice);
    this.reconcileEngine = new ReconcileEngine(this.table, this.playerId, gameState);
  }

  run(): EngineResult {
    const rolls: RollRecord[] = [];
    let rollNumber = 0;

    while (this.shouldContinue(rollNumber)) {
      const record = this.playRoll(rollNumber + 1);
      rolls.push(record);
      if (this.logger) {
        this.logger.onRoll(record);
      }
      rollNumber++;
    }

    return {
      finalBankroll: this.bankroll,
      initialBankroll: this.initialBankroll,
      rollsPlayed: rollNumber,
      rolls,
    };
  }

  private shouldContinue(rollsPlayed: number): boolean {
    if (rollsPlayed >= this.maxRolls) return false;
    const hasBetsOnTable = this.table.getPlayerBets(this.playerId).length > 0;
    const hasBankroll = this.bankroll > 0;
    return hasBankroll || hasBetsOnTable;
  }

  private playRoll(rollNumber: number): RollRecord {
    const bankrollBefore = this.bankroll;

    // 1. Reconcile strategy → apply bet commands to table
    const commands = this.reconcileEngine.reconcile(this.strategy, this.bankroll);
    this.applyCommands(commands);

    // 2. Snapshot state before roll (capture point 1: activeBets, tableLoad.before)
    const pointBefore = this.table.currentPoint;
    const betsSnapshot = this.snapshotBets();
    const activeBets = this.buildActiveBetInfo(betsSnapshot);
    const tableLoadBefore = betsSnapshot.reduce((sum, s) => sum + s.amount + s.oddsAmount, 0);

    // 3. Roll dice (capture point 2: die1/die2/sum, pointBefore/After)
    const diceRoll = this.table.rollDice();
    const pointAfter = this.table.currentPoint;

    // 4. Collect outcomes (capture point 3: outcomes[])
    const outcomes = this.collectOutcomes(betsSnapshot);
    this.settleBets(betsSnapshot);

    // Capture point 4: bankroll.after, tableLoad.after
    const tableLoadAfter = this.table.getPlayerBets(this.playerId)
      .reduce((sum, bet) => sum + bet.totalAmount, 0);

    // 5. Post-roll: update strategy trackers
    this.reconcileEngine.postRoll(outcomes, {
      bankroll: this.bankroll,
      pointBefore,
      pointAfter,
      rollValue: diceRoll.sum,
    });

    const runtime = (this.strategy as any)[STAGE_MACHINE_RUNTIME] as StageMachineRuntime | undefined;

    return {
      rollNumber,
      die1: diceRoll.die1,
      die2: diceRoll.die2,
      rollValue: diceRoll.sum,
      pointBefore,
      pointAfter,
      outcomes,
      bankrollBefore,
      bankrollAfter: this.bankroll,
      activeBets,
      tableLoadBefore,
      tableLoadAfter,
      stageName: runtime?.getCurrentStage(),
    };
  }

  private buildActiveBetInfo(snapshots: BetSnapshot[]): ActiveBetInfo[] {
    return snapshots.map(({ bet, amount, oddsAmount }) => ({
      type: betTypeToString(bet.betType),
      point: bet.point ?? null,
      amount,
      odds: oddsAmount,
    }));
  }

  private applyCommands(commands: BetCommand[]): void {
    for (const cmd of commands) {
      switch (cmd.type) {
        case 'place':
          this.applyPlaceCommand(cmd);
          break;
        case 'remove':
          this.applyRemoveCommand(cmd);
          break;
        case 'updateOdds':
          this.applyUpdateOddsCommand(cmd);
          break;
      }
    }
  }

  private applyPlaceCommand(cmd: BetCommand & { type: 'place' }): void {
    const bet = this.createBet(cmd.betType, cmd.amount, cmd.point);
    if (!bet) return;

    if (!bet.isOkayToPlace(this.table)) return;
    if (this.bankroll < bet.totalAmount) return;

    this.bankroll -= bet.totalAmount;
    bet.player = this.playerId;
    this.table.placeBet(bet);
  }

  private applyRemoveCommand(cmd: BetCommand & { type: 'remove' }): void {
    const betType = stringToBetType(cmd.betType);
    if (betType === undefined) return;

    const playerBets = this.table.getPlayerBets(this.playerId);
    for (const bet of playerBets) {
      if (bet.betType === betType && (cmd.point == null || bet.point === cmd.point)) {
        this.bankroll += bet.totalAmount;
        this.table.removeBet(bet);
        break;
      }
    }
  }

  private applyUpdateOddsCommand(cmd: BetCommand & { type: 'updateOdds' }): void {
    const playerBets = this.table.getPlayerBets(this.playerId);
    for (const bet of playerBets) {
      if (bet instanceof PassLineBet || bet instanceof ComeBet) {
        const typeStr = betTypeToString(bet.betType);
        if (typeStr === cmd.betType && (cmd.point == null || bet.point === cmd.point)) {
          const oldOdds = bet.oddsAmount;
          const newOdds = cmd.amount;
          const diff = newOdds - oldOdds;
          if (diff > 0 && this.bankroll >= diff) {
            this.bankroll -= diff;
            bet.oddsAmount = newOdds;
          } else if (diff < 0) {
            this.bankroll += Math.abs(diff);
            bet.oddsAmount = newOdds;
          }
          break;
        }
      } else if (bet instanceof DontPassBet) {
        const typeStr = betTypeToString(bet.betType);
        if (typeStr === cmd.betType && (cmd.point == null || bet.point === cmd.point)) {
          const oldLay = bet.layOddsAmount;
          const newLay = cmd.amount;
          const diff = newLay - oldLay;
          if (diff > 0 && this.bankroll >= diff) {
            this.bankroll -= diff;
            bet.layOddsAmount = newLay;
          } else if (diff < 0) {
            this.bankroll += Math.abs(diff);
            bet.layOddsAmount = newLay;
          }
          break;
        }
      }
    }
  }

  private createBet(betType: string, amount: number, point?: number): BaseBet | null {
    switch (betType) {
      case 'passLine':
        return new PassLineBet(amount, this.playerId);
      case 'come':
        return new ComeBet(amount, this.playerId);
      case 'place':
        if (point == null) return null;
        return new PlaceBet(amount, point, this.playerId);
      case 'field':
        return new FieldBet(amount, this.playerId);
      case 'dontPass':
        return new DontPassBet(amount, this.playerId);
      case 'dontCome':
        return new DontComeBet(amount, this.playerId);
      default:
        return null;
    }
  }

  private snapshotBets(): BetSnapshot[] {
    return this.table.getPlayerBets(this.playerId).map(bet => ({
      bet,
      amount: bet.amount,
      oddsAmount: (bet instanceof PassLineBet) ? bet.oddsAmount
               : (bet instanceof DontPassBet)  ? bet.layOddsAmount
               : 0,
    }));
  }

  private collectOutcomes(snapshots: BetSnapshot[]): Outcome[] {
    const outcomes: Outcome[] = [];
    for (const { bet, amount, oddsAmount } of snapshots) {
      if ((bet.payOut ?? 0) > 0) {
        outcomes.push({
          result: 'win',
          betType: bet.betType,
          point: bet.point,
          amount,
          payout: bet.payOut ?? 0,
        });
      } else if (bet instanceof DontPassBet && bet.payOut === 0 && bet.amount === 0) {
        // DontCome bar-12 transit push: payOut explicitly set to 0 (not undefined, which
        // signals a loss from lose()). The flat stake is returned intact — no win, no loss.
        outcomes.push({
          result: 'push',
          betType: bet.betType,
          point: bet.point,
          amount,
          payout: 0,
        });
      } else if (bet.amount === 0) {
        outcomes.push({
          result: 'loss',
          betType: bet.betType,
          point: bet.point,
          amount,
          payout: 0,
        });
        // ComeBet seven-out with odds OFF: flat is lost (above), but odds were never
        // at risk — they are returned to the player. Record as a separate push outcome.
        if (bet instanceof ComeBet && oddsAmount > 0) {
          outcomes.push({
            result: 'push',
            betType: bet.betType,
            point: bet.point,
            amount: oddsAmount,
            payout: 0,
          });
        }
      }
    }
    return outcomes;
  }

  private settleBets(snapshots: BetSnapshot[]): void {
    for (const { bet, amount, oddsAmount } of snapshots) {
      if ((bet.payOut ?? 0) > 0) {
        // Collect winnings — payOut semantics differ by bet type:
        // PassLine/Come: payOut = profit only (even money + odds payout)
        // PlaceBet: payOut = original amount + profit
        if (bet instanceof PassLineBet || bet instanceof DontPassBet) {
          // Return original flat bet + odds/layOdds + profit
          this.bankroll += amount + oddsAmount + (bet.payOut ?? 0);
        } else {
          // PlaceBet/FieldBet: payOut already includes original
          this.bankroll += bet.payOut ?? 0;
        }

        // Clean up the winning bet so reconcile can re-place if needed
        bet.payOut = 0;
        bet.amount = 0;
        if (bet instanceof PassLineBet) bet.oddsAmount = 0;
        if (bet instanceof DontPassBet) bet.layOddsAmount = 0;

        this.table.removeBet(bet);
      } else if (bet instanceof ComeBet && bet.amount === 0 && bet.oddsAmount > 0) {
        // Any seven with odds OFF: flat always lost; credit odds back to bankroll
        // without recording a win (odds were never at risk).
        this.bankroll += bet.oddsAmount;
        bet.oddsAmount = 0;
      } else if (bet instanceof DontPassBet && bet.payOut === 0) {
        // DC bar-12 push in transit: return original flat stake, no profit.
        this.bankroll += amount;
      }
      // Lost bets: already removed by resolveBets, bankroll was deducted at placement
    }
  }
}
