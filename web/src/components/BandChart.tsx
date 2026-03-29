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
  aggregates: DistributionAggregates & { p95?: number[]; p99?: number[] };
  initialBankroll: number;
}

export function BandChart({ aggregates, initialBankroll }: Props) {
  const { p10, p50, p90, p95, p99 } = aggregates;
  const hasTails = p95 != null && p95.length > 0;
  const maxLen = Math.max(p10.length, p50.length, p90.length, p95?.length ?? 0, p99?.length ?? 0);

  const data = Array.from({ length: maxLen }, (_, i) => ({
    roll: i + 1,
    p10: p10[i] ?? 0,
    p50: p50[i] ?? 0,
    p90: p90[i] ?? 0,
    ...(hasTails && { p95: p95![i] ?? 0, p99: p99![i] ?? 0 }),
  }));

  function legendLabel(value: string): string {
    if (value === 'p10') return 'P10';
    if (value === 'p50') return 'P50 (median)';
    if (value === 'p90') return 'P90';
    if (value === 'p95') return 'P95';
    if (value === 'p99') return 'P99';
    return value;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
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
          formatter={(value, name) => [`$${value ?? 0}`, String(name)]}
          labelFormatter={(label) => `Roll ${label}`}
          contentStyle={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        <Legend
          wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }}
          formatter={legendLabel}
        />
        <ReferenceLine y={initialBankroll} stroke="#6b7280" strokeDasharray="4 2" label={{ value: 'Buy-in', fontSize: 11, fill: '#6b7280' }} />
        {/* Shaded band between P10 and P90 */}
        <Area
          type="monotone"
          dataKey="p90"
          stroke="none"
          fill="#bfdbfe"
          fillOpacity={0.4}
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="p10"
          stroke="none"
          fill="#f9fafb"
          fillOpacity={1}
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
        <Line type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="p90" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        {hasTails && (
          <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
        )}
        {hasTails && (
          <Line type="monotone" dataKey="p99" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
