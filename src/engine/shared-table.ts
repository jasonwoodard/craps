import { CrapsTable } from '../craps-table';
import { ReconcileEngine, StrategyDefinition } from '../dsl/strategy';
import { GameState } from '../dsl/game-state';
import { BetCommand, stringToBetType, betTypeToString } from '../dsl/bet-reconciler';
import { Dice, LiveDice } from '../dice/dice';
import { BaseBet } from '../bets/base-bet';
import { PassLineBet } from '../bets/pass-line-bet';
import { ComeBet } from '../bets/come-bet';
import { PlaceBet } from '../bets/place-bet';
import { RunLogger, SummaryRecord } from '../logger/run-logger';
import { RollRecord, ActiveBetInfo } from './roll-record';
import { Outcome } from '../dsl/outcome';

export interface SharedTableConfig {
  seed?: number;
  rolls: number;
  dice?: Dice;
}

export interface SharedTableResult {
  [strategyName: string]: {
    finalBankroll: number;
    netChange: number;
    log: RollRecord[];
    summary: SummaryRecord;
  };
}

interface BetSnapshot {
  bet: BaseBet;
  amount: number;
  oddsAmount: number;
}

interface PlayerSlot {
  name: string;
  strategy: StrategyDefinition;
  bankroll: number;
  initialBankroll: number;
  reconcileEngine: ReconcileEngine;
  playerId: string;
  log: RollRecord[];
  logger: RunLogger;
  // Scratch space for pre-roll data; populated in phase 1, consumed in phase 2.
  preRoll?: {
    snapshots: BetSnapshot[];
    activeBets: ActiveBetInfo[];
    tableLoadBefore: number;
    bankrollBefore: number;
  };
}

export class SharedTable {
  private table: CrapsTable;
  private maxRolls: number;
  private players: Map<string, PlayerSlot> = new Map();
  private gameState: GameState;

  constructor(config: SharedTableConfig) {
    this.maxRolls = config.rolls;
    this.table = new CrapsTable();

    if (config.dice) {
      this.table.dice = config.dice;
    } else if (config.seed != null) {
      this.table.dice = new LiveDice(config.seed);
    }

    this.gameState = new GameState(this.table.dice);
  }

  addStrategy(name: string, strategy: StrategyDefinition, opts: { bankroll: number }): void {
    const playerId = `player-${name}`;
    const reconcileEngine = new ReconcileEngine(this.table, playerId, this.gameState);
    const logger = new RunLogger({ strategyName: name, playerId, initialBankroll: opts.bankroll });

    this.players.set(name, {
      name,
      strategy,
      bankroll: opts.bankroll,
      initialBankroll: opts.bankroll,
      reconcileEngine,
      playerId,
      log: [],
      logger,
    });
  }

  run(): SharedTableResult {
    let rollNumber = 0;

    while (this.shouldContinue(rollNumber)) {
      rollNumber++;
      this.playRoll(rollNumber);
    }

    const result: SharedTableResult = {};
    for (const [name, slot] of this.players) {
      result[name] = {
        finalBankroll: slot.bankroll,
        netChange: slot.bankroll - slot.initialBankroll,
        log: slot.log,
        summary: slot.logger.buildSummary(),
      };
    }
    return result;
  }

  private shouldContinue(rollsPlayed: number): boolean {
    if (rollsPlayed >= this.maxRolls) return false;
    for (const slot of this.players.values()) {
      if (this.isSlotActive(slot)) return true;
    }
    return false;
  }

  private isSlotActive(slot: PlayerSlot): boolean {
    const hasBets = this.table.getPlayerBets(slot.playerId).length > 0;
    return slot.bankroll > 0 || hasBets;
  }

  private playRoll(rollNumber: number): void {
    // Phase 1: reconcile bets, then capture pre-roll state (before dice roll).
    const pointBefore = this.table.currentPoint;
    for (const slot of this.players.values()) {
      if (this.isSlotActive(slot)) {
        const commands = slot.reconcileEngine.reconcile(slot.strategy, slot.bankroll);
        this.applyCommands(commands, slot);
      }
      const snapshots = this.snapshotBets(slot.playerId);
      slot.preRoll = {
        snapshots,
        activeBets: this.buildActiveBetInfo(snapshots),
        tableLoadBefore: snapshots.reduce((sum, s) => sum + s.amount + s.oddsAmount, 0),
        bankrollBefore: slot.bankroll,
      };
    }

    // Phase 2: Roll dice ONCE, then settle each strategy independently.
    const diceRoll = this.table.rollDice();
    const pointAfter = this.table.currentPoint;

    for (const slot of this.players.values()) {
      const pre = slot.preRoll!;
      const outcomes = this.collectOutcomes(pre.snapshots);
      this.settleBets(pre.snapshots, slot);

      const tableLoadAfter = this.table.getPlayerBets(slot.playerId)
        .reduce((sum, bet) => sum + bet.totalAmount, 0);

      slot.reconcileEngine.postRoll(outcomes, {
        bankroll: slot.bankroll,
        pointBefore,
        pointAfter,
        rollValue: diceRoll.sum,
      });

      const record: RollRecord = {
        rollNumber,
        die1: diceRoll.die1,
        die2: diceRoll.die2,
        rollValue: diceRoll.sum,
        pointBefore,
        pointAfter,
        outcomes,
        bankrollBefore: pre.bankrollBefore,
        bankrollAfter: slot.bankroll,
        activeBets: pre.activeBets,
        tableLoadBefore: pre.tableLoadBefore,
        tableLoadAfter,
      };

      slot.log.push(record);
      slot.logger.onRoll(record);
    }
  }

  private applyCommands(commands: BetCommand[], slot: PlayerSlot): void {
    for (const cmd of commands) {
      switch (cmd.type) {
        case 'place':
          this.applyPlaceCommand(cmd, slot);
          break;
        case 'remove':
          this.applyRemoveCommand(cmd, slot);
          break;
        case 'updateOdds':
          this.applyUpdateOddsCommand(cmd, slot);
          break;
      }
    }
  }

  private applyPlaceCommand(cmd: BetCommand & { type: 'place' }, slot: PlayerSlot): void {
    const bet = this.createBet(cmd.betType, cmd.amount, slot.playerId, cmd.point);
    if (!bet) return;
    if (!bet.isOkayToPlace(this.table)) return;
    if (slot.bankroll < bet.totalAmount) return;

    slot.bankroll -= bet.totalAmount;
    this.table.placeBet(bet);
  }

  private applyRemoveCommand(cmd: BetCommand & { type: 'remove' }, slot: PlayerSlot): void {
    const betType = stringToBetType(cmd.betType);
    if (betType === undefined) return;

    const playerBets = this.table.getPlayerBets(slot.playerId);
    for (const bet of playerBets) {
      if (bet.betType === betType && (cmd.point == null || bet.point === cmd.point)) {
        slot.bankroll += bet.totalAmount;
        this.table.removeBet(bet);
        break;
      }
    }
  }

  private applyUpdateOddsCommand(cmd: BetCommand & { type: 'updateOdds' }, slot: PlayerSlot): void {
    const playerBets = this.table.getPlayerBets(slot.playerId);
    for (const bet of playerBets) {
      if (bet instanceof PassLineBet || bet instanceof ComeBet) {
        const typeStr = betTypeToString(bet.betType);
        if (typeStr === cmd.betType && (cmd.point == null || bet.point === cmd.point)) {
          const oldOdds = bet.oddsAmount;
          const newOdds = cmd.amount;
          const diff = newOdds - oldOdds;
          if (diff > 0 && slot.bankroll >= diff) {
            slot.bankroll -= diff;
            bet.oddsAmount = newOdds;
          } else if (diff < 0) {
            slot.bankroll += Math.abs(diff);
            bet.oddsAmount = newOdds;
          }
          break;
        }
      }
    }
  }

  private createBet(betType: string, amount: number, playerId: string, point?: number): BaseBet | null {
    switch (betType) {
      case 'passLine':
        return new PassLineBet(amount, playerId);
      case 'come':
        return new ComeBet(amount, playerId);
      case 'place':
        if (point == null) return null;
        return new PlaceBet(amount, point, playerId);
      default:
        return null;
    }
  }

  private snapshotBets(playerId: string): BetSnapshot[] {
    return this.table.getPlayerBets(playerId).map(bet => ({
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

  private settleBets(snapshots: BetSnapshot[], slot: PlayerSlot): void {
    for (const { bet, amount, oddsAmount } of snapshots) {
      if (bet.payOut > 0) {
        if (bet instanceof PassLineBet) {
          slot.bankroll += amount + oddsAmount + bet.payOut;
        } else {
          slot.bankroll += bet.payOut;
        }

        bet.payOut = 0;
        bet.amount = 0;
        if (bet instanceof PassLineBet) bet.oddsAmount = 0;

        this.table.removeBet(bet);
      }
    }
  }

  private buildActiveBetInfo(snapshots: BetSnapshot[]): ActiveBetInfo[] {
    return snapshots.map(({ bet, amount, oddsAmount }) => ({
      type: betTypeToString(bet.betType),
      point: bet.point ?? null,
      amount,
      odds: oddsAmount,
    }));
  }
}
