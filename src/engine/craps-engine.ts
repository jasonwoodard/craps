import { CrapsTable } from '../craps-table';
import { ReconcileEngine, StrategyDefinition } from '../dsl/strategy';
import { GameState } from '../dsl/game-state';
import { BetCommand, stringToBetType, betTypeToString } from '../dsl/bet-reconciler';
import { Outcome } from '../dsl/outcome';
import { Dice, LiveDice } from '../dice/dice';
import { BaseBet } from '../bets/base-bet';
import { PassLineBet } from '../bets/pass-line-bet';
import { ComeBet } from '../bets/come-bet';
import { PlaceBet } from '../bets/place-bet';

export interface CrapsEngineConfig {
  strategy: StrategyDefinition;
  bankroll: number;
  rolls: number;
  seed?: number;
  dice?: Dice;
}

export interface RollRecord {
  rollNumber: number;
  rollValue: number;
  pointBefore: number | undefined;
  pointAfter: number | undefined;
  outcomes: Outcome[];
  bankrollBefore: number;
  bankrollAfter: number;
}

export interface EngineResult {
  finalBankroll: number;
  initialBankroll: number;
  rollsPlayed: number;
  rolls: RollRecord[];
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
  private playerId = 'engine-player';

  constructor(config: CrapsEngineConfig) {
    this.strategy = config.strategy;
    this.bankroll = config.bankroll;
    this.initialBankroll = config.bankroll;
    this.maxRolls = config.rolls;

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
    const commands = this.reconcileEngine.reconcile(this.strategy);
    this.applyCommands(commands);

    // 2. Snapshot state before roll
    const pointBefore = this.table.currentPoint;
    const betsSnapshot = this.snapshotBets();

    // 3. Roll dice (resolves bets and updates point)
    this.table.rollDice();
    const rollValue = this.table.getLastRoll();

    const pointAfter = this.table.currentPoint;

    // 4. Collect outcomes and settle bankroll
    const outcomes = this.collectOutcomes(betsSnapshot);
    this.settleBets(betsSnapshot);

    // 6. Post-roll: update strategy trackers
    this.reconcileEngine.postRoll(outcomes);

    return {
      rollNumber,
      rollValue,
      pointBefore,
      pointAfter,
      outcomes,
      bankrollBefore,
      bankrollAfter: this.bankroll,
    };
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
      default:
        return null;
    }
  }

  private snapshotBets(): BetSnapshot[] {
    return this.table.getPlayerBets(this.playerId).map(bet => ({
      bet,
      amount: bet.amount,
      oddsAmount: (bet instanceof PassLineBet) ? bet.oddsAmount : 0,
    }));
  }

  private collectOutcomes(snapshots: BetSnapshot[]): Outcome[] {
    const outcomes: Outcome[] = [];
    for (const { bet, amount } of snapshots) {
      if (bet.payOut > 0) {
        outcomes.push({
          result: 'win',
          betType: bet.betType,
          point: bet.point,
          amount,
          payout: bet.payOut,
        });
      } else if (bet.amount === 0) {
        outcomes.push({
          result: 'loss',
          betType: bet.betType,
          point: bet.point,
          amount,
          payout: 0,
        });
      }
    }
    return outcomes;
  }

  private settleBets(snapshots: BetSnapshot[]): void {
    for (const { bet, amount, oddsAmount } of snapshots) {
      if (bet.payOut > 0) {
        // Collect winnings — payOut semantics differ by bet type:
        // PassLine/Come: payOut = profit only (even money + odds payout)
        // PlaceBet: payOut = original amount + profit
        if (bet instanceof PassLineBet) {
          // Return original flat bet + odds + profit
          this.bankroll += amount + oddsAmount + bet.payOut;
        } else {
          // PlaceBet: payOut already includes original
          this.bankroll += bet.payOut;
        }

        // Clean up the winning bet so reconcile can re-place if needed
        bet.payOut = 0;
        bet.amount = 0;
        if (bet instanceof PassLineBet) bet.oddsAmount = 0;

        this.table.removeBet(bet);
      }
      // Lost bets: already removed by resolveBets, bankroll was deducted at placement
    }
  }
}
