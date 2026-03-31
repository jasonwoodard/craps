import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { DistributionAggregates } from '../../../types/simulation';

interface Props {
  baseline: DistributionAggregates;
  test: DistributionAggregates;
  baselineName: string;
  testName: string;
  initialBankroll: number;
}

export function DistributionCompareChart({ baseline, test, baselineName, testName, initialBankroll }: Props) {
  const maxLen = Math.max(
    baseline.p10.length, baseline.p50.length, baseline.p90.length,
    test.p10.length, test.p50.length, test.p90.length,
  );

  const data = Array.from({ length: maxLen }, (_, i) => ({
    roll: i + 1,
    // Baseline band (solid + fill)
    b_p10: baseline.p10[i] ?? 0,
    b_p50: baseline.p50[i] ?? 0,
    b_p90: baseline.p90[i] ?? 0,
    // Test lines (dashed, no fill)
    t_p10: test.p10[i] ?? 0,
    t_p50: test.p50[i] ?? 0,
    t_p90: test.p90[i] ?? 0,
  }));

  function legendLabel(value: string): string {
    switch (value) {
      case 'b_p10': return `${baselineName} P10`;
      case 'b_p50': return `${baselineName} P50 (median)`;
      case 'b_p90': return `${baselineName} P90`;
      case 't_p10': return `${testName} P10`;
      case 't_p50': return `${testName} P50 (median)`;
      case 't_p90': return `${testName} P90`;
      default: return value;
    }
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="roll"
          tick={{ fontSize: 11, fontFamily: 'monospace' }}
          label={{ value: 'Roll', position: 'insideBottom', offset: -2, fontSize: 11 }}
        />
        <YAxis
          tick={{ fontSize: 11, fontFamily: 'monospace' }}
          tickFormatter={(v: number) => `$${v}`}
          width={56}
        />
        <Tooltip
          formatter={(value, name) => [`$${value ?? 0}`, legendLabel(String(name))]}
          labelFormatter={(label) => `Roll ${label}`}
          contentStyle={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        <Legend
          wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }}
          formatter={legendLabel}
        />
        <ReferenceLine
          y={initialBankroll}
          stroke="#6b7280"
          strokeDasharray="4 2"
          label={{ value: 'Buy-in', fontSize: 11, fill: '#6b7280' }}
        />
        {/* Baseline: shaded fill between P10 and P90 */}
        <Area
          type="monotone"
          dataKey="b_p90"
          stroke="none"
          fill="#bfdbfe"
          fillOpacity={0.4}
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="b_p10"
          stroke="none"
          fill="#f9fafb"
          fillOpacity={1}
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
        {/* Baseline: solid lines */}
        <Line type="monotone" dataKey="b_p10" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="b_p50" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="b_p90" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        {/* Test: dashed lines, no fill */}
        <Line type="monotone" dataKey="t_p10" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="t_p50" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="t_p90" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
