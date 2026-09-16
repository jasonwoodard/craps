import { catsUnits, type CatsUnits } from '@engine/dsl/units';
import type { RunManifest } from '@shared/manifest';
import { useStrategyCatalog, findStrategy } from '../../lib/strategy-meta';
import { ManifestChip } from '../../components/ManifestChip';
import { LadderTable, Section, StrategyPageLayout, type LadderRow } from './StrategyPageLayout';

/**
 * Board descriptions per entry-stage slug. Every amount is read off
 * `catsUnits(tableMin)`; nothing here is a literal dollar figure
 * (webui-plan.md cross-phase guardrail, enforced by the units-parity test).
 */
function boardFor(slug: string, U: CatsUnits): string {
  switch (slug) {
    case 'accumulator':
      return `Place 6 & 8 at $${U.accumulatorStart} each; after the first hit, regress to $${U.accumulatorRegressed} each`;
    case 'littleMolly':
      return `Pass $${U.flat} + 1 Come $${U.flat}, each backed with $${U.oddsLittle} odds (2×)`;
    case 'threePtMollyTight':
      return `Pass $${U.flat} + 2 Come $${U.flat}; tiered odds by coverage — $${U.tier.sweet.passLine} / $${U.tier.middle.passLine} / $${U.tier.rough.passLine} (3-2-1×)`;
    case 'threePtMollyLoose':
      return `Pass $${U.flat} + 2 Come $${U.flat}, each backed with $${U.oddsLoose} odds (5×)`;
    case 'expandedAlpha':
      return `Loose board, plus Buy 4 & 10 at $${U.buyAmount} each (Swap Rule applies)`;
    case 'maxAlpha':
      return `Expanded board, plus Buy 5 & 9 at $${U.buyAmount} each (Swap Rule applies)`;
    default:
      return '';
  }
}

/**
 * Headline figures from cats-strategy.md §4, quoted with the run that
 * produced them. They predate manifest-stamped output, so the engine version
 * was not recorded — the manifest says so rather than guessing a sha.
 */
const FINDINGS_MANIFEST: RunManifest = {
  schemaVersion: 1,
  strategySpec: 'CATS',
  tableMin: 10,
  bankroll: 300,
  rolls: 1000,
  seeds: { count: 2000 },
  engineVersion: 'not recorded',
  generatedAt: '',
};

const FINDINGS = [
  { value: '72%', label: 'of sessions reach Little Molly before the buy-in is gone' },
  { value: '26%', label: 'reach Max Alpha, the top of the ladder' },
  { value: '18%', label: 'end the 1,000-roll horizon in profit' },
  { value: '54%', label: 'end at ruin — the ladder does not repeal the house edge' },
];

export function CatsStrategyPage() {
  const ten = useStrategyCatalog(10);
  const fifteen = useStrategyCatalog(15);

  const metaTen = findStrategy(ten.catalog, 'CATS');
  const metaFifteen = findStrategy(fifteen.catalog, 'CATS');
  const U10 = catsUnits(10);
  const U15 = catsUnits(15);

  const gatesAtFifteen = new Map((metaFifteen?.stages ?? []).map(s => [s.slug, s.gate]));
  const rows: LadderRow[] = (metaTen?.stages ?? []).map(stage => ({
    displayName: stage.displayName,
    board: boardFor(stage.slug, U10),
    gateAtTen: stage.gate,
    gateAtFifteen: gatesAtFifteen.get(stage.slug) ?? 0,
  }));

  // Display names are metadata: read them, never restate them. Until the
  // catalog arrives the cell is a dash rather than a second copy of the name.
  const displayNameOf = (slug: string) =>
    metaTen?.stages.find(s => s.slug === slug)?.displayName ?? '—';

  const entryConfigs = [
    {
      name: 'Classic',
      entry: displayNameOf(metaTen?.stages[0]?.slug ?? ''),
      riskTen: U10.classicRisk,
      riskFifteen: U15.classicRisk,
      note: 'Grind the Accumulator; every escalation is funded by profit.',
    },
    {
      name: 'Funded — Tight',
      entry: displayNameOf('threePtMollyTight'),
      riskTen: U10.referenceFunded.tight,
      riskFifteen: U15.referenceFunded.tight,
      note: 'Skip the grind and start at stage 3 — the cushion is your own money.',
    },
    {
      name: 'Funded — Little Molly',
      entry: displayNameOf('littleMolly'),
      riskTen: U10.referenceFunded.littleMolly,
      riskFifteen: U15.referenceFunded.littleMolly,
      note: 'A short middle path: line bets from the first roll, modest declared risk.',
    },
  ];

  return (
    <StrategyPageLayout
      name="CATS"
      expansion="Craps Alpha-Transition Strategy"
      tagline="A five-stage ladder that escalates on accumulated profit and retreats on its own rules."
      docPath="strategy/cats-strategy.md"
    >
      <Section title="What CATS is">
        <div className="text-sm text-gray-700 leading-relaxed space-y-2">
          <p>
            CATS is a stage machine. Each stage declares a board and a profit gate; you never
            increase table load with buy-in capital, only with profit already earned. The
            Accumulator is a gate, not a destination — its job is to fund the near-zero-edge
            line-and-odds stages above it.
          </p>
          <p>
            Descent is symmetrical and automatic. Every stage above the Accumulator names a floor
            it retreats below, and the floors tile the whole profit range, so a sustained losing
            run walks back down one link at a time. There is no separate panic rule.
          </p>
        </div>
      </Section>

      <Section
        title="The ladder"
        subtitle="One unit (u) is the table minimum. Gates sit at 7u / 15u / 25u / 40u above origin — the same rule at every table."
      >
        <LadderTable rows={rows} gateHeading="Gate" />
        <p className="text-xs text-gray-500 font-mono mt-2">
          Rote phrasing: gates at seven, fifteen, twenty-five, forty minimums; buys are two
          minimums; flats are one.
        </p>
      </Section>

      <Section
        title="Entry configurations"
        subtitle="A session is described by two numbers: B, the declared risk, and the stage you buy into."
      >
        <div className="overflow-x-auto">
          <table data-testid="entry-configs" className="w-full text-xs font-mono border border-gray-200 rounded">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
                <th className="px-3 py-2 font-medium">Configuration</th>
                <th className="px-3 py-2 font-medium">Entry stage</th>
                <th className="px-3 py-2 font-medium text-right">B · $10</th>
                <th className="px-3 py-2 font-medium text-right">B · $15</th>
                <th className="px-3 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {entryConfigs.map(config => (
                <tr key={config.name} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{config.name}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{config.entry}</td>
                  <td className="px-3 py-2 text-gray-600 text-right">${config.riskTen}</td>
                  <td className="px-3 py-2 text-gray-600 text-right">${config.riskFifteen}</td>
                  <td className="px-3 py-2 text-gray-600">{config.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-sm text-gray-700 leading-relaxed space-y-2 mt-3">
          <p>
            <strong>The sizing rule:</strong> a funded entry sets profit's zero point at
            origin = B − gate(entry). Buy into 3-Point Molly — Loose with B = $
            {U10.classicRisk} at a $10 table and you begin with $
            {U10.gates.expandedAlpha} of declared cushion already counted as profit; the origin
            underneath it is ${U10.classicRisk - U10.gates.expandedAlpha}. Nothing else changes:
            the same gates, the same retreat floors, the same board.
          </p>
          <p>
            In the simulator this is a canonical spec — <code>CATS@entry=threePtMollyLoose</code>{' '}
            — and it is what the Entry Stage control writes into the URL and the manifest.
          </p>
        </div>
      </Section>

      <Section title="The rules that matter">
        <div className="text-sm text-gray-700 leading-relaxed space-y-3">
          <p>
            <strong>Regression.</strong> The Accumulator opens at $
            {U10.accumulatorStart} on each of the 6 and 8. On the <em>first</em> hit, collect and
            pull both down to ${U10.accumulatorRegressed}. Do not press, and do not wait for a
            second hit — the regressed board's job is to grind to the first gate, not to catch a
            heater.
          </p>
          <p>
            <strong>Two consecutive 7-outs.</strong> Two back-to-back 7-outs in any Molly stage
            step you down one stage, regardless of profit. The counter resets on any collected
            win and carries across stage transitions. This is a pre-commitment: it fires when you
            least want it to, which is exactly when it is worth having.
          </p>
          <p>
            <strong>The Swap Rule.</strong> In the Alpha stages, if a Come bet travels to a number
            you have bought, take the Buy down and put full odds on the Come instead. The Come
            plus odds is a far cheaper way to hold the same number, so the Buy only ever exists
            while the line has not covered that number itself.
          </p>
        </div>
      </Section>

      <Section
        title="What simulation shows"
        subtitle="Measured, not argued. Every figure below belongs to one run — its manifest is attached."
      >
        {/*
          Exempt from the units-parity scan: these are engine outputs, not
          unit-system rules. They carry a manifest instead.
        */}
        <div data-figures="simulation">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FINDINGS.map(finding => (
              <div key={finding.value} className="rounded border border-slate-200 p-3">
                <p className="font-mono text-lg font-bold text-slate-800">{finding.value}</p>
                <p className="mt-1 text-xs text-slate-500 leading-snug">{finding.label}</p>
              </div>
            ))}
          </div>
          <ManifestChip
            manifest={FINDINGS_MANIFEST}
            note="quoted from cats-strategy.md §4 (v1.3) · analyze-stages --stop-at-ruin"
          />
        </div>
      </Section>
    </StrategyPageLayout>
  );
}
