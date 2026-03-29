import type { DistributionAggregates } from '../../../types/simulation';

type FinalBankrollWithTails = DistributionAggregates['finalBankroll'] & { p95?: number; p99?: number };

interface Props {
  aggregates: DistributionAggregates & { finalBankroll: FinalBankrollWithTails };
  initialBankroll: number;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: 'green' | 'red' | 'neutral';
}

function StatCard({ label, value, sub, highlight }: StatCardProps) {
  const valueColor =
    highlight === 'green' ? 'text-green-600' :
    highlight === 'red'   ? 'text-red-600' :
    'text-gray-900';

  return (
    <div className="bg-white border border-gray-200 rounded p-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-mono text-lg font-semibold ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function OutcomeSummary({ aggregates, initialBankroll }: Props) {
  const { finalBankroll, peakBankroll, rollsToPeak, winRate, ruinRate } = aggregates;
  const hasTails = finalBankroll.p95 != null;

  const medianNet = finalBankroll.p50 - initialBankroll;
  const netSign = medianNet >= 0 ? '+' : '';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        label="Median Final"
        value={`$${finalBankroll.p50}`}
        sub={`${netSign}$${medianNet} net`}
        highlight={medianNet >= 0 ? 'green' : 'red'}
      />
      <StatCard
        label="Win Rate"
        value={pct(winRate)}
        sub="Sessions above buy-in"
        highlight={winRate >= 0.5 ? 'green' : 'neutral'}
      />
      <StatCard
        label="Ruin Rate"
        value={pct(ruinRate)}
        sub="Sessions reaching $0"
        highlight={ruinRate > 0.1 ? 'red' : 'neutral'}
      />
      <StatCard
        label="Median Peak"
        value={`$${peakBankroll.p50}`}
        sub="Typical best moment"
      />
      <StatCard
        label="Median Roll to Peak"
        value={String(rollsToPeak.p50)}
        sub="When peak typically occurs"
      />
      <StatCard
        label="P10 / P90 Final"
        value={`$${finalBankroll.p10} / $${finalBankroll.p90}`}
        sub="Bad vs. good session"
      />
      {hasTails && (
        <StatCard
          label="P95 Final"
          value={`$${finalBankroll.p95}`}
          sub="Top-5% session outcome"
          highlight="green"
        />
      )}
      {hasTails && (
        <StatCard
          label="P99 Final"
          value={`$${finalBankroll.p99}`}
          sub="Top-1% session outcome"
          highlight="green"
        />
      )}
    </div>
  );
}
