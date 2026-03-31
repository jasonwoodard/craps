import type { DistributionAggregates } from '../../../types/simulation';

interface Props {
  baseline: DistributionAggregates;
  test: DistributionAggregates;
}

interface DeltaRow {
  stat: string;
  baseline: string;
  test: string;
  delta: string;
  // positive means test is better on this metric
  testBetter: boolean | null;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function dollar(v: number): string {
  return `$${v}`;
}

export function OutcomeDelta({ baseline, test }: Props) {
  const medFinalDelta = test.finalBankroll.p50 - baseline.finalBankroll.p50;
  const winRateDelta = test.winRate - baseline.winRate;
  const ruinRateDelta = test.ruinRate - baseline.ruinRate;
  const medPeakDelta = test.peakBankroll.p50 - baseline.peakBankroll.p50;

  const rows: DeltaRow[] = [
    {
      stat: 'Median final',
      baseline: dollar(baseline.finalBankroll.p50),
      test: dollar(test.finalBankroll.p50),
      delta: (medFinalDelta >= 0 ? '+' : '') + dollar(medFinalDelta),
      // Higher final bankroll is better
      testBetter: medFinalDelta > 0 ? true : medFinalDelta < 0 ? false : null,
    },
    {
      stat: 'Win rate',
      baseline: pct(baseline.winRate),
      test: pct(test.winRate),
      delta: (winRateDelta >= 0 ? '+' : '') + pct(winRateDelta),
      // Higher win rate is better
      testBetter: winRateDelta > 0 ? true : winRateDelta < 0 ? false : null,
    },
    {
      stat: 'Ruin rate',
      baseline: pct(baseline.ruinRate),
      test: pct(test.ruinRate),
      delta: (ruinRateDelta >= 0 ? '+' : '') + pct(ruinRateDelta),
      // Lower ruin rate is better, so positive delta (more ruin) means test is worse
      testBetter: ruinRateDelta < 0 ? true : ruinRateDelta > 0 ? false : null,
    },
    {
      stat: 'Median peak',
      baseline: dollar(baseline.peakBankroll.p50),
      test: dollar(test.peakBankroll.p50),
      delta: (medPeakDelta >= 0 ? '+' : '') + dollar(medPeakDelta),
      // Higher peak is better
      testBetter: medPeakDelta > 0 ? true : medPeakDelta < 0 ? false : null,
    },
  ];

  const thClass = 'text-left pb-2 text-gray-400 font-normal text-xs uppercase tracking-wide pr-6';
  const tdClass = 'py-1.5 pr-6 font-mono text-sm text-gray-700';

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-200">
          <th className={thClass}>Stat</th>
          <th className={thClass}>Baseline</th>
          <th className={thClass}>Test</th>
          <th className={`${thClass} pr-0`}>Delta</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.stat} className="border-b border-gray-100 last:border-0">
            <td className={`${tdClass} text-gray-500`}>{row.stat}</td>
            <td className={tdClass}>{row.baseline}</td>
            <td className={tdClass}>{row.test}</td>
            <td className={`${tdClass} pr-0 font-semibold ${
              row.testBetter === true
                ? 'text-green-600'
                : row.testBetter === false
                ? 'text-red-500'
                : 'text-gray-500'
            }`}>
              {row.delta}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
