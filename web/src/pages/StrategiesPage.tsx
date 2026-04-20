export function StrategiesPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-mono font-bold mb-1">Strategies</h1>
      <p className="text-sm text-slate-500 font-mono mb-6">Understand what each strategy bets and how it escalates.</p>

      <StrategySection
        name="CATS"
        tagline="Five-stage escalating strategy. Starts conservative and escalates as session profit grows."
        houseEdge="Accumulator: pass line 1.41% · Molly stages: come bets with odds ~0.5–0.8%"
        stages={CATS_STAGES}
      >
        <p>
          CATS (Conservative Accumulator → Three-point Strategy) is a stage machine: it defines
          five distinct betting modes and rules for moving between them based on session profit
          and recent seven-out history. The strategy starts in its most conservative state and
          escalates only when the session is winning, retreating automatically when it isn't.
        </p>
        <p>
          The Accumulator stages use flat pass line bets with minimal odds. The Molly stages
          add come bets and increase odds as profit milestones are reached. Step-down rules
          mirror step-up thresholds — two consecutive seven-outs at any Molly stage triggers a
          retreat to the prior stage, protecting gains rather than pressing through cold dice.
        </p>
        <p>
          CATS is the only strategy in the simulator with stage data. The Session page's Stage
          Breakdown table, Stage Overlay charts, and Trend Indicators are all designed around
          CATS's structure. Running CATS on Session gives the fullest picture of how the
          strategy moves through its phases over the course of a real session.
        </p>
      </StrategySection>

      <StrategySection
        name="HardwaysHedge"
        tagline="Pass line hedged with hardways bets on 6 and 8. Adds a speculative overlay to the core bet."
        houseEdge="Pass line: 1.41% · Hard 6/8: 9.09% each"
      >
        <p>
          HardwaysHedge places a $10 pass line bet alongside $5 hardways bets on the 6 and 8.
          When the point is 6 or 8, a hard hit — both dice showing the same value — pays 9:1 on
          the hardways bet on top of whatever the pass line eventually returns. Points on other
          numbers leave the hardways bets working as speculative overlays with no connection to
          the table point.
        </p>
        <p>
          The hardways bets persist until they win, until a 7-out clears them, or until the
          target number is rolled the easy way. Because they stay up across many rolls, a single
          session can see multiple hardways resolutions before a seven-out. The 9.09% house edge
          on each hardways bet is steep — this strategy's long-run expectation is materially worse
          than PassLineOnly. Use Distribution Compare against PassLineOnly to quantify the cost
          of adding the hardways overlay.
        </p>
      </StrategySection>

      <StrategySection
        name="IronCross"
        tagline="Field plus place bets on 5, 6, and 8. Wins on every number except 7 once a point is set."
        houseEdge="Field: 2.78% · Place 5: 4.0% · Place 6/8: 1.52%"
      >
        <p>
          IronCross combines a $10 field bet with place bets on the 5 ($10), 6 ($12), and 8
          ($12), for a total table load of $44 while a point is established. Together these bets
          cover every possible roll outcome except the 7: the 5, 6, and 8 pay their place odds;
          the 2, 3, 4, 9, 10, 11, and 12 pay the field.
        </p>
        <p>
          There is no pass line, so the strategy accepts come-out 7s as a necessary cost of
          maintaining full coverage during the point phase. Place bets are off during the
          come-out, but the field stays active — the come-out 7 and 11 still resolve the field
          bet (losing on 7, winning on 11).
        </p>
        <p>
          The high hit frequency feels exciting during hot streaks, but the blended house edge
          across all active bets is higher than simpler strategies. A seven-out clears all four
          bets at once, making the loss event steep relative to a single-bet approach. Compare
          against Place6And8 on Distribution to evaluate the risk-reward tradeoff.
        </p>
      </StrategySection>

      <StrategySection
        name="IronCrossWithCE"
        tagline="IronCross plus a C&E bet on every roll. Adds coverage on craps and eleven to the full-coverage structure."
        houseEdge="Field: 2.78% · Place 5: 4.0% · Place 6/8: 1.52% · C&E: 11.11%"
      >
        <p>
          IronCrossWithCE extends the standard IronCross setup (field + place 5/6/8) with a $10
          C&E bet on every roll. C&E wins 3:1 net if a craps number (2, 3, or 12) is thrown and
          7:1 net if eleven is thrown. On come-out rolls, where the IronCross has no place bets
          active but the field stays live, the C&E provides an extra win on craps hits.
        </p>
        <p>
          The C&E's 11.11% house edge is the most expensive component of this strategy —
          significantly higher than every other bet in the combination. It is best understood as
          a high-cost boost to come-out and point-phase action rather than a genuine edge
          improvement. Compare against plain IronCross on Distribution to see exactly what the
          C&E overlay costs in long-run expectation.
        </p>
      </StrategySection>

      <StrategySection
        name="JustField"
        tagline="Single $10 field bet on every roll. Simple, high-frequency action."
        houseEdge="Field: 2.78% (standard 2× on 2, 2× on 12)"
      >
        <p>
          JustField places a flat $10 field bet before every roll. The field wins on 2, 3, 4, 9,
          10, 11, and 12 (16 of 36 combinations) and loses on 5, 6, 7, and 8. Because the bet
          resolves on every roll, the strategy generates constant action regardless of whether a
          point is established.
        </p>
        <p>
          The house edge on the field is approximately 2.78% under standard casino rules (2× payout
          on both 2 and 12). Some tables pay 3× on the 12, which reduces the edge to 1.39%. The
          flat bet and single-bet structure make variance easy to model — use Distribution to see
          the ruin curve at your buy-in before playing.
        </p>
      </StrategySection>

      <StrategySection
        name="MartingaleField"
        tagline="Field bet with Martingale progression. Doubles on loss, resets on win. Capped at $160."
        houseEdge="Field: 2.78% — edge is unchanged; progression shifts variance, not expectation"
      >
        <p>
          MartingaleField applies the classic Martingale doubling system to the field bet. It
          starts at $10 and doubles after each loss: $10 → $20 → $40 → $80 → $160. After any
          win the bet resets to $10. The progression is capped at $160 (four doublings from
          base), preventing unlimited exposure.
        </p>
        <p>
          The Martingale does not change the house edge — every field bet, regardless of size,
          carries the same 2.78% disadvantage. What the progression does is trade frequent small
          wins against occasional large losses. Runs of five or more consecutive field losses
          (which occur with meaningful probability) strand the strategy at its cap and absorb
          all prior gains.
        </p>
        <p>
          Use Distribution Compare against JustField to see the Martingale failure profile
          directly: MartingaleField will show a similar median outcome but a fatter left tail,
          reflecting the sessions where the losing streak exceeds the cap.
        </p>
      </StrategySection>

      <StrategySection
        name="PassLineOnly"
        tagline="The simplest possible craps strategy. Useful as a baseline for comparison."
        houseEdge="Pass line: 1.41%"
      >
        <p>
          PassLineOnly places a single pass line bet before every come-out roll and does not back
          it with odds. When the come-out roll establishes a point, the bet remains on the table
          until the point is made or a seven-out resolves it. No come bets, no place bets, no
          odds — just the pass line repeated.
        </p>
        <p>
          Because it carries no odds, table load is fixed and predictable. Variance is low
          compared to strategies that add come bets or odds. It is the natural benchmark: any
          more complex strategy should be evaluated against what PassLineOnly would have returned
          on the same dice.
        </p>
      </StrategySection>

      <StrategySection
        name="PassAndHards"
        tagline="Pass line plus all four hardways bets. Broadest possible hardways coverage."
        houseEdge="Pass line: 1.41% · Hard 4/10: 11.11% each · Hard 6/8: 9.09% each"
      >
        <p>
          PassAndHards places a $10 pass line bet with $5 hardways bets on every hardways number:
          4 (2+2), 6 (3+3), 8 (4+4), and 10 (5+5). The hardways bets pay 7:1 on the 4 and 10
          and 9:1 on the 6 and 8, but only when the number is rolled as a matching pair. Rolling
          the number any other way — or rolling a 7 — immediately loses the corresponding
          hardways bet.
        </p>
        <p>
          All four hardways bets work simultaneously, so a hard 6 (3+3) resolves that bet while
          the others remain up. The bets can cycle through wins and losses independently across
          many rolls before a seven-out ends the hand. The high house edges on hardways (9–11%)
          are a substantial drag on long-run results; the strategy produces entertaining large
          payouts on hard rolls but costs considerably more than PassLineOnly over time. Use
          Distribution to model the ruin rate at your bankroll before playing.
        </p>
      </StrategySection>

      <StrategySection
        name="PassWithCEInsurance"
        tagline="Pass line with C&E on every roll. C&E softens craps losses on come-out."
        houseEdge="Pass line: 1.41% · C&E: 11.11%"
      >
        <p>
          PassWithCEInsurance places a $10 pass line bet and a $10 C&E bet before every roll.
          On come-out rolls, if a craps number (2, 3, or 12) is thrown — which loses the pass
          line — the C&E pays 3:1 net, partially offsetting the pass-line loss. If eleven is
          rolled, the C&E adds a 7:1 net payout on top of the pass-line natural win.
        </p>
        <p>
          The "insurance" framing is intuitive, but the C&E carries an 11.11% house edge, which
          means the protection costs more over time than it recovers. The net effect on the
          session is negative relative to a pure pass line. Compare against PassLineOnly on
          Distribution to see the long-run cost of adding the C&E; the comparison makes the
          trade-off concrete rather than theoretical.
        </p>
      </StrategySection>

      <StrategySection
        name="Place6And8"
        tagline="Place bets on 6 and 8 only. No pass line, no come bets."
        houseEdge="Place 6/8: 1.52%"
      >
        <p>
          Place6And8 skips the pass line entirely and places fixed bets directly on the 6 and
          8 after a point is established. The 6 and 8 are the most frequently rolled point
          numbers (five ways to make each out of 36 combinations), giving this strategy a high
          hit frequency relative to other place numbers.
        </p>
        <p>
          Because there is no pass line and no come bet phase, table load is constant while the
          two bets are working. The strategy takes no action on come-out rolls, waiting instead
          for a point to be set before activating. Seven-outs clear both place bets; points made
          on numbers other than 6 or 8 do not directly pay but do keep the shooter rolling.
        </p>
        <p>
          House edge on Place 6/8 is 1.52%, slightly higher than the pass line at 1.41%, but
          the consistent table structure makes variance easy to reason about. Ruin risk at a
          given bankroll is straightforward to model using Distribution.
        </p>
      </StrategySection>

      <StrategySection
        name="Place6And8Progressive"
        tagline="Place 6 and 8 with progressive press on wins."
        houseEdge="Place 6/8: 1.52%"
      >
        <p>
          Place6And8Progressive starts with the same 6 and 8 place bets as Place6And8 but adds
          a press mechanic: after a win, the bet size increases according to a preset progression
          rather than staying flat. A session with a sustained hot streak will see the bet size
          step up repeatedly, amplifying returns while the roll stays hot.
        </p>
        <p>
          The house edge per bet is unchanged from Place6And8. The difference is variance: a
          seven-out at the top of a progression wipes out a much larger bet than the opening
          size. The Stage Breakdown view (where available) is useful for tracking where the
          progression was at each transition point.
        </p>
      </StrategySection>

      <StrategySection
        name="PlaceAll"
        tagline="Place bets on all six point numbers: 4, 5, 6, 8, 9, and 10."
        houseEdge="4/10: 6.67% · 5/9: 4.0% · 6/8: 1.52%"
      >
        <p>
          PlaceAll covers every point number with a place bet. This maximises hit frequency —
          24 of 36 possible rolls will pay something while all bets are working — but also
          maximises exposure on seven-outs. The 4 and 10 carry the highest house edge in the
          place-bet family (6.67%), which drags on the strategy's long-run performance.
        </p>
        <p>
          Sessions with extended point-making runs will look impressive on PlaceAll because
          something hits on nearly every non-seven point roll. The Distribution page, however,
          will show a wider ruin envelope than the tighter place strategies due to the larger
          table load and the high-edge bets on the 4 and 10.
        </p>
      </StrategySection>

      <StrategySection
        name="PlaceInside"
        tagline="Place bets on 5, 6, 8, and 9 — the four inside numbers."
        houseEdge="Place 5/9: 4.0% · Place 6/8: 1.52%"
      >
        <p>
          PlaceInside extends the place-bet approach to cover all four inside numbers: 5, 6, 8,
          and 9. The 5 and 9 each have four ways to roll (out of 36); the 6 and 8 each have
          five. Together these four numbers account for 18 of 36 possible roll combinations —
          exactly half — giving the strategy the highest hit frequency of any standard
          place-bet configuration.
        </p>
        <p>
          The tradeoff is that the 5 and 9 carry a higher house edge (4.0%) than the 6 and 8
          (1.52%), so the blended edge is higher than Place6And8. Table load is also higher,
          which increases both win potential and seven-out exposure.
        </p>
      </StrategySection>

      <StrategySection
        name="ThreePointMolly1X"
        tagline="Pass line plus two come bets, each backed with 1X odds."
        houseEdge="Come bets with odds: ~0.8% blended"
      >
        <p>
          ThreePointMolly1X builds up to three simultaneous working bets: a pass line bet and up
          to two come bets. After the pass line establishes a point, come bets are placed on
          successive come-out rolls until three bets are active. Each bet is backed with 1X true
          odds, which carry zero house edge and reduce the overall edge on the session.
        </p>
        <p>
          When a point is made or a come bet hits, the strategy immediately replaces it with a
          new bet to stay at three points working. Seven-outs clear all active bets at once,
          which is the source of this strategy's variance. The three-bet structure means a
          single seven-out can cost three bets simultaneously.
        </p>
      </StrategySection>

      <StrategySection
        name="ThreePointMolly2X"
        tagline="Pass line plus two come bets, each backed with 2X odds."
        houseEdge="Come bets with 2X odds: ~0.6% blended"
      >
        <p>
          ThreePointMolly2X is identical in structure to ThreePointMolly1X but backs each bet
          with 2X true odds instead of 1X. The higher odds increase table load — up to three
          bets each with 2X odds active simultaneously — which amplifies both the upside when
          points hit and the loss when a seven-out clears the table.
        </p>
        <p>
          The blended house edge is lower than 1X because a larger fraction of each bet is on
          odds (zero edge) rather than the flat bet (1.41%). This is the classic
          "three-point molly" as commonly described in craps strategy guides.
        </p>
      </StrategySection>

      <StrategySection
        name="ThreePointMolly3X"
        tagline="Pass line plus two come bets, each backed with 3X odds."
        houseEdge="Come bets with 3X odds: ~0.5% blended"
      >
        <p>
          ThreePointMolly3X extends the same structure to 3X odds. Three active bets each
          backed at 3X produces the highest table load of the flat ThreePointMolly variants.
          Wins are larger when points hit in sequence; losses are correspondingly steeper on
          seven-outs.
        </p>
        <p>
          The further reduction in blended house edge versus 2X is small because the flat bet
          stays fixed — only the odds portion scales. Sessions with cold dice will show
          materially worse drawdowns than the 1X variant on the same dice sequence.
        </p>
      </StrategySection>

      <StrategySection
        name="ThreePointMolly4X"
        tagline="Pass line plus two come bets, each backed with 4X odds."
        houseEdge="Come bets with 4X odds: ~0.4% blended"
      >
        <p>
          ThreePointMolly4X follows the same three-point structure with 4X odds backing each
          active bet. At this level the odds portion of each bet substantially exceeds the flat
          bet, so the blended house edge continues to fall toward zero. Table load can reach
          five times the flat bet amount when three bets are fully loaded.
        </p>
        <p>
          Suitable for bankrolls with sufficient depth to absorb multiple back-to-back seven-outs
          without reaching ruin. Best evaluated via Distribution to understand the ruin rate at
          a given buy-in before committing to this level of odds.
        </p>
      </StrategySection>

      <StrategySection
        name="ThreePointMolly5X"
        tagline="Pass line plus two come bets, each backed with 5X odds."
        houseEdge="Come bets with 5X odds: ~0.3% blended"
      >
        <p>
          ThreePointMolly5X is the most aggressive of the flat ThreePointMolly variants. Each
          of the three active bets carries 5X true odds, producing the lowest blended house edge
          in this family but also the highest variance. A single seven-out at full table load
          is a significant bankroll event.
        </p>
        <p>
          The near-zero blended edge does not make this a profitable strategy — the flat bet
          still carries 1.41% and there are no strategies that overcome the house edge over
          time. What 5X odds provides is a more favorable variance structure for bankrolls
          large enough to weather the swings.
        </p>
      </StrategySection>
    </div>
  );
}

interface StrategySectionProps {
  name: string;
  tagline: string;
  houseEdge: string;
  stages?: { stage: string; entry: string; bets: string }[];
  children: React.ReactNode;
}

const CATS_STAGES = [
  { stage: 'Accumulator Full', entry: 'Session start', bets: 'Pass line + 1X odds' },
  { stage: 'Accumulator Regressed', entry: 'After first point made', bets: 'Pass line + 1X odds, regressed' },
  { stage: 'Little Molly', entry: '+$70 net', bets: 'Pass line + 1 come + odds' },
  { stage: 'Three Point Molly Tight', entry: '+$150 net', bets: 'Pass line + 2 come + odds' },
  { stage: 'Three Point Molly Loose', entry: '+$250 net', bets: 'Pass line + 2 come + max odds' },
];

function StrategySection({ name, tagline, houseEdge, stages, children }: StrategySectionProps) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-mono font-bold text-gray-900 mb-1">{name}</h2>
      <p className="text-sm text-slate-500 font-mono mb-4">{tagline}</p>

      <div className="mb-4">
        <h3 className="text-xs font-mono font-semibold text-gray-500 uppercase tracking-wide mb-2">Bets &amp; Structure</h3>
        <div className="text-sm text-gray-700 leading-relaxed space-y-2">
          {children}
        </div>
      </div>

      {stages && (
        <div className="mb-4">
          <h3 className="text-xs font-mono font-semibold text-gray-500 uppercase tracking-wide mb-2">Stages</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Entry condition</th>
                  <th className="px-3 py-2 font-medium">Bets active</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 text-gray-800 font-medium">{s.stage}</td>
                    <td className="px-3 py-2 text-gray-600">{s.entry}</td>
                    <td className="px-3 py-2 text-gray-600">{s.bets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-2">
            Step-down rules mirror step-up thresholds — two consecutive 7-outs at any Molly stage triggers a retreat to the prior stage.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-xs font-mono font-semibold text-gray-500 uppercase tracking-wide mb-1">House Edge</h3>
        <p className="text-sm font-mono text-gray-700">{houseEdge}</p>
      </div>
    </section>
  );
}
