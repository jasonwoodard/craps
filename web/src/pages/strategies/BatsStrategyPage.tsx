import { batsUnits, type BatsUnits } from '@engine/dsl/units';
import { useStrategyCatalog, findStrategy } from '../../lib/strategy-meta';
import { LadderTable, Section, StrategyPageLayout, type LadderRow } from './StrategyPageLayout';

/**
 * Board descriptions per entry-stage slug, with every amount read off
 * `batsUnits(tableMin)`. Lay odds are stated as the amount they win — the
 * unit system sizes lays by target win, not by amount risked.
 */
function boardFor(slug: string, B: BatsUnits): string {
  switch (slug) {
    case 'bearishAccumulator':
      return `Don't Pass $${B.flat}, lay odds sized to win $${B.layWinAccumulator}`;
    case 'littleDolly':
      return `DP + 1 Don't Come at $${B.flat}, lay odds sized to win $${B.layWinDolly} each`;
    case 'threePtDolly':
      return `DP + 2 Don't Come at $${B.flat}, lay odds sized to win $${B.layWinThreePt} each`;
    case 'expandedDarkAlpha':
      return `Dolly board, plus Lay 4 & 10 sized to win $${B.layWinStandalone} each (Swap Rule applies)`;
    case 'maxDarkAlpha':
      return `Dolly board, plus Lay 4, 5, 9 & 10 sized to win $${B.layWinStandalone} each (Swap Rule applies)`;
    default:
      return '';
  }
}

export function BatsStrategyPage() {
  const ten = useStrategyCatalog(10);
  const fifteen = useStrategyCatalog(15);

  const metaTen = findStrategy(ten.catalog, 'BATS');
  const metaFifteen = findStrategy(fifteen.catalog, 'BATS');
  const B10 = batsUnits(10);

  const gatesAtFifteen = new Map((metaFifteen?.stages ?? []).map(s => [s.slug, s.gate]));
  const rows: LadderRow[] = (metaTen?.stages ?? []).map(stage => ({
    displayName: stage.displayName,
    board: boardFor(stage.slug, B10),
    gateAtTen: stage.gate,
    gateAtFifteen: gatesAtFifteen.get(stage.slug) ?? 0,
  }));

  return (
    <StrategyPageLayout
      name="BATS"
      expansion="Bearish Alpha-Transition Strategy"
      tagline="The darkside ladder: the same escalation logic, betting against the shooter."
      docPath="strategy/bats-strategy.md"
      draft
    >
      <Section title="Status">
        <p className="text-sm text-gray-700 leading-relaxed">
          The BATS document is not yet at publication quality, so this page is structurally
          complete but deliberately content-thin. The ladder and gates below are read live from
          the engine and are accurate; the prose will grow when the strategy document does.
        </p>
      </Section>

      <Section title="What BATS is">
        <div className="text-sm text-gray-700 leading-relaxed space-y-2">
          <p>
            BATS is the darkside companion to CATS, built on the same stage machine: five stages,
            profit gates above origin, automatic retreat. Don't Pass and Don't Come replace Pass
            and Come, and lay odds replace take odds — you lay more to win less, at zero house
            edge on the odds portion.
          </p>
          <p>
            The mirror is structural, not cosmetic. Funded entry, canonical specs
            (<code>BATS@entry=threePtDolly</code>), and the unit system all work on BATS with no
            BATS-specific code — that generality is the acceptance test for the stage machine
            itself.
          </p>
        </div>
      </Section>

      <Section
        title="The ladder"
        subtitle="One unit (u) is the table minimum; lay odds are sized by the amount they win."
      >
        <LadderTable rows={rows} gateHeading="Gate" />
      </Section>

      <Section
        title="Entry configurations"
        subtitle="Same rule as CATS: a session is B, the declared risk, plus the stage you buy into."
      >
        <p className="text-sm text-gray-700 leading-relaxed">
          A funded entry sets origin = B − gate(entry), so the session begins with the entry
          stage's gate already counted as profit. BATS does not yet publish reference buy-in
          levels the way CATS does — that belongs with the strategy document, and it is not
          invented here.
        </p>
      </Section>

      <Section title="The rules that matter">
        <div className="text-sm text-gray-700 leading-relaxed space-y-3">
          <p>
            <strong>Two consecutive come-out losses.</strong> Little Dolly retreats to the Bearish
            Accumulator after two come-out naturals in a row. On the dark side the come-out 7 is
            the hazard, so the counter watches come-outs rather than 7-outs.
          </p>
          <p>
            <strong>The point-repeater streak.</strong> 3-Point Dolly retreats after two hands in
            a row where the shooter makes their point. A hot shooter is the enemy of darkside
            coverage, and this is the rule that concedes it early.
          </p>
          <p>
            <strong>The Swap Rule.</strong> In the Dark Alpha stages a Lay is only declared while
            no Don't Come bet already covers that number — when a Don't Come travels there, the
            standalone Lay comes down.
          </p>
        </div>
      </Section>
    </StrategyPageLayout>
  );
}
