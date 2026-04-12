import { ComeBet } from '../../src/bets/come-bet';
import { CrapsTable } from '../../src/craps-table';
import { TableMaker } from '../table-maker/table-maker';

// Standing assumptions (matching docs/come-bet-odds.md §1):
//   flat wager:  $10
//   come point:  9  (set as bet.point in established-phase tests)
//   odds wager:  $50 (used in come-out odds tests; transit tests use no odds)
//   odds status: OFF by default during come-out (§1.1)

describe('ComeBet', () => {
  const playerId = 'test-player';
  let comeBet: ComeBet;
  const betAmount: number = 10;

  beforeEach(() => {
    comeBet = new ComeBet(betAmount, playerId);
  });

  // ---------------------------------------------------------------------------
  // Placement
  // ---------------------------------------------------------------------------

  it('should indicate okToPlace only when the point is on', () => {
    let table = TableMaker.getTable().withPoint(10).value();
    expect(ComeBet.isOkayToPlace(table)).toBe(true);

    table = TableMaker.getTable().value();
    expect(ComeBet.isOkayToPlace(table)).toBe(false);
  });

  it('should not set the ComeBet point unless the table point is on', () => {
    const table: CrapsTable = TableMaker.getTable().value(); // point OFF
    expect(comeBet.point).toBeUndefined();
    comeBet.evaluateDiceRoll({ die1: 2, die2: 3, sum: 5 }, table);
    // Rolling a box number during come-out has no effect on the come bet —
    // it cannot be in transit when the table point is off.
    expect(comeBet.point).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Transit phase — table point ON, bet has no own point yet
  // ---------------------------------------------------------------------------

  describe('transit phase (no own point yet — table point ON)', () => {
    it('should win on 7 before traveling', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      expect(bet.payOut).toBe(10); // natural: flat wins 1:1, no odds yet
      expect(bet.amount).toBeGreaterThan(0);
    });

    it('should win on 11 before traveling', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 11, sum: 11 }, table);
      expect(bet.payOut).toBe(10);
    });

    it('should lose on 2 before traveling (craps)', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 2, sum: 2 }, table);
      expect(bet.amount).toBe(0);
    });

    it('should lose on 3 before traveling (craps)', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 3, sum: 3 }, table);
      expect(bet.amount).toBe(0);
    });

    it('should lose on 12 before traveling (craps)', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 12, sum: 12 }, table);
      expect(bet.amount).toBe(0);
    });

    it('should travel to the box number and set its own point', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table);
      // Own point is 9 — distinct from the table point (6).
      expect(bet.point).toBe(9);
      expect(bet.payOut).toBeUndefined(); // not resolved, only traveled
    });
  });

  // ---------------------------------------------------------------------------
  // Established phase — point phase (table point ON)
  // ---------------------------------------------------------------------------

  describe('established phase — point phase (table point ON)', () => {
    it('should win when OWN point is rolled, regardless of the table point', () => {
      // Table point is 6, come bet has traveled to 9.
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // travels to 9
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // hits own point
      expect(bet.payOut).toBeGreaterThan(0);
    });

    // NOTE: expected to fail until PassLineBet.win() is overridden in ComeBet
    // to compute odds from this.point rather than table.currentPoint.
    // Bug: table.currentPoint is 6 (6:5 → $60 profit on $50); correct is point 9 (3:2 → $75).
    it('should pay true odds based on the come bet OWN point, not the table point', () => {
      const table = TableMaker.getTable().withPoint(6).value(); // table point 6 (6:5)
      const bet = new ComeBet(10, playerId);
      bet.point = 9;      // come bet point 9 (3:2)
      bet.oddsAmount = 50;
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table);
      // $10 flat + $75 odds (3:2 on $50) = $85
      expect(bet.payOut).toBe(85);
    });

    it('should NOT win when the table point is rolled but not the come bet own point', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // travels to 9
      bet.evaluateDiceRoll({ die1: 0, die2: 6, sum: 6 }, table); // table point hit — irrelevant
      expect(bet.payOut).toBeUndefined();
      expect(bet.amount).toBe(10); // still alive
    });

    it('should have no action on 11 after traveling (11 is not a natural once established)', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // travels to 9
      bet.evaluateDiceRoll({ die1: 0, die2: 11, sum: 11 }, table);
      expect(bet.payOut).toBeUndefined();
      expect(bet.amount).toBe(10);
    });

    it('should lose both base and odds on seven-out (table point ON)', () => {
      // Table point is ON: odds are active and at risk. Seven-out forfeits both.
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // travels to 9
      bet.oddsAmount = 50;
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table); // seven-out
      expect(bet.amount).toBe(0);      // base lost
      expect(bet.oddsAmount).toBe(0);  // odds lost — they were active
      expect(bet.payOut).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Established phase — come-out roll, odds OFF (default)
  //
  // Spec §§1–4, §§6–7: off odds cannot win and cannot lose during come-out.
  // Their return is a push: the player's own money coming back, neither gain nor loss.
  // ---------------------------------------------------------------------------

  describe('established phase — come-out roll (table point OFF, odds OFF by default)', () => {

    // §§2.1–2.3: come point rolls during come-out — flat wins 1:1, odds returned.
    it('should win base 1:1 on come-out own-point hit; odds returned intact, not paid (§§2.1–2.3)', () => {
      const table = TableMaker.getTable().value(); // point OFF (come-out)
      const bet = new ComeBet(10, playerId);
      bet.point = 9;
      bet.oddsAmount = 50;
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table);
      expect(bet.payOut).toBe(10);     // §2.1: flat wins 1:1 only
      expect(bet.oddsAmount).toBe(50); // §2.3: $50 odds returned intact
      // §2.2: odds did not win — payOut is flat only, not flat + odds (§6.1).
      // If payOut were 60, that would record the returned odds as a win and
      // overstate the player's gain by $50.
    });

    // §§3.1–3.3: seven during come-out — flat loses, odds returned.
    // §6.2: returned odds must NOT be recorded as a win (payOut stays undefined).
    it('should lose base on come-out 7; odds returned intact, not lost (§§3.1–3.3, §6.2)', () => {
      const table = TableMaker.getTable().value(); // point OFF (come-out)
      const bet = new ComeBet(10, playerId);
      bet.point = 9;
      bet.oddsAmount = 50;
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      expect(bet.amount).toBe(0);       // §3.1: base lost
      expect(bet.oddsAmount).toBe(50);  // §3.3: $50 odds returned intact
      expect(bet.payOut).toBeUndefined(); // §3.2/§6.2: returned odds not recorded as win
    });

    // §§4.1–4.3: symmetry — the come-out roll result does not affect odds disposition.
    // Off odds return $50 whether the roll was 7 or 9.
    it('should return the same odds amount regardless of whether 7 or own-point was rolled (§4)', () => {
      const tableOwn = TableMaker.getTable().value();
      const betOwn = new ComeBet(10, playerId);
      betOwn.point = 9;
      betOwn.oddsAmount = 50;
      betOwn.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, tableOwn); // own point

      const tableSeven = TableMaker.getTable().value();
      const betSeven = new ComeBet(10, playerId);
      betSeven.point = 9;
      betSeven.oddsAmount = 50;
      betSeven.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, tableSeven); // seven

      // §4.1: both return the same odds amount — the roll result is irrelevant to
      // off odds disposition (§4.3).
      expect(betOwn.oddsAmount).toBe(50);
      expect(betSeven.oddsAmount).toBe(50);
      expect(betOwn.oddsAmount).toBe(betSeven.oddsAmount);
    });

    // §7.5: returned off odds are a push — a resolution event in which the
    // player's net position does not change on that wager.
    // §7.6: push amount = dollar value of the odds returned ($50).
    // §6.3: correct treatment produces zero effect on net position from odds.
    it('push: net position change equals the flat bet only — odds contribute zero (§7.5, §7.6, §6.3)', () => {
      // Come-out own-point: net gain = $10 (flat only). Odds $50 pushed, not won.
      const tableOwn = TableMaker.getTable().value();
      const betOwn = new ComeBet(10, playerId);
      betOwn.point = 9;
      betOwn.oddsAmount = 50;
      betOwn.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, tableOwn);
      expect(betOwn.payOut).toBe(10);    // net gain = flat only (§2.4)
      expect(betOwn.oddsAmount).toBe(50); // push amount = $50 returned (§7.6)

      // Come-out seven: net loss = $10 (flat only). Odds $50 pushed, not lost.
      const tableSeven = TableMaker.getTable().value();
      const betSeven = new ComeBet(10, playerId);
      betSeven.point = 9;
      betSeven.oddsAmount = 50;
      betSeven.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, tableSeven);
      expect(betSeven.amount).toBe(0);        // net loss = flat only (§3.4)
      expect(betSeven.payOut).toBeUndefined(); // odds not recorded as win (§6.2)
      expect(betSeven.oddsAmount).toBe(50);   // push amount = $50 returned (§7.6)
    });
  });

  // ---------------------------------------------------------------------------
  // Established phase — come-out roll, odds WORKING (§5)
  //
  // A player may declare odds working, overriding the default off state.
  // This converts the guaranteed push into a live wager (§7.11).
  //
  // NOTE: all tests in this block are expected to fail until evaluateDiceRoll
  // reads the oddsWorking flag. The oddsWorking property is stubbed as false by
  // default; these tests set it to true to describe the intended behavior.
  // ---------------------------------------------------------------------------

  describe('established phase — come-out roll (odds declared WORKING)', () => {

    // §5.2: odds working + own point rolls → flat wins 1:1, odds win at true odds.
    // Point 9 pays 3:2: $50 odds → $75 profit. Net gain = $10 + $75 = $85.
    it('should win flat 1:1 and pay true odds when own point rolls and odds are working (§5.2)', () => {
      const table = TableMaker.getTable().value(); // point OFF (come-out)
      const bet = new ComeBet(10, playerId);
      bet.point = 9;
      bet.oddsAmount = 50;
      bet.oddsWorking = true;
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table);
      // §5.2: $10 flat + $75 (3:2 on $50) = $85
      expect(bet.payOut).toBe(85);
    });

    // §5.3: odds working + seven → both flat AND odds lose. Net loss = $60.
    it('should lose both flat and odds on come-out 7 when odds are working (§5.3)', () => {
      const table = TableMaker.getTable().value(); // point OFF (come-out)
      const bet = new ComeBet(10, playerId);
      bet.point = 9;
      bet.oddsAmount = 50;
      bet.oddsWorking = true;
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      expect(bet.amount).toBe(0);       // base lost
      expect(bet.oddsAmount).toBe(0);   // odds lost — they were working
      expect(bet.payOut).toBeUndefined();
    });

    // §5.4: working is a player-level (bet-level) setting, not a table-level setting.
    // Two come bets at the same table during the same come-out 7 resolve differently
    // depending on their individual oddsWorking flag.
    it('should respect per-bet working flag independently — non-working odds still push (§5.4)', () => {
      const table = TableMaker.getTable().value(); // point OFF (come-out)

      const working = new ComeBet(10, playerId);
      working.point = 9;
      working.oddsAmount = 50;
      working.oddsWorking = true; // this player declared odds working

      const notWorking = new ComeBet(10, playerId);
      notWorking.point = 9;
      notWorking.oddsAmount = 50;
      // oddsWorking defaults to false — odds are off

      working.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      notWorking.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);

      // Working bet: both flat and odds lost
      expect(working.amount).toBe(0);
      expect(working.oddsAmount).toBe(0);

      // Non-working bet: flat lost, odds pushed (returned)
      expect(notWorking.amount).toBe(0);
      expect(notWorking.oddsAmount).toBe(50); // odds intact — pushed, not lost
    });
  });
});
