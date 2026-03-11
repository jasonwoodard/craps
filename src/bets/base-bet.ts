import { CrapsTable } from "../craps-table";

export enum BetTypes {
  UNKNOWN,
  PASS_LINE,
  COME,
  PLACE
}

export abstract class BaseBet {
  betType: BetTypes = BetTypes.UNKNOWN;
  amount: number;
  player: string;
  payOut: number;
  point: number;

  constructor(betType: BetTypes, amount: number, playerId: string) {
    this.betType = betType;
    this.amount = amount;
    this.player = playerId;
  }

  get totalAmount () : number {
    return this.amount;
  }

  isEqual(checkBet: BaseBet): boolean {
    return (
      this.betType == checkBet.betType &&
      this.point == checkBet.point &&
      this.amount == checkBet.amount &&
      this.player == checkBet.player
    );
  }

  abstract isOkayToPlace(crapsTable : CrapsTable) : boolean
  abstract evaluateDiceRoll(rollValue: number, table: CrapsTable): void;
  abstract win(table: CrapsTable): void;
  abstract lose(): void;
}
