export interface BaseBet { amount: number; }
export interface OddsBet { amount: number; point: number; }
export interface ComeBet { base: BaseBet; odds?: OddsBet; point: number; }

export interface PlayerState {
  passLine?: BaseBet;
  passLineOdds?: OddsBet;
  comeBets: ComeBet[];
  unresolvedCome?: BaseBet;
  placeBets: Record<number, BaseBet>;
}
