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
  aggregates: DistributionAggregates;
  initialBankroll: number;
}

export function BandChart({ aggregates, initialBankroll }: Props) {
  const { p10, p50, p90 } = aggregates;
  const maxLen = Math.max(p10.length, p50.length, p90.length);

  const data = Array.from({ length: maxLen }, (_, i) => ({
    roll: i + 1,
    p10: p10[i] ?? 0,
    p50: p50[i] ?? 0,
    p90: p90[i] ?? 0,
    // Area between p10 and p90: recharts Area with two data keys
    band: [p10[i] ?? 0, p90[i] ?? 0] as [number, number],
  }));

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
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          formatter={((value: number, name: string) => [`$${value}`, name]) as any}
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          labelFormatter={((label: number) => `Roll ${label}`) as any}
          contentStyle={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        <Legend
          wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }}
          formatter={(value: string) =>
            value === 'p10' ? 'P10' : value === 'p50' ? 'P50 (median)' : 'P90'
          }
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
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="p10"
          stroke="none"
          fill="#f9fafb"
          fillOpacity={1}
          legendType="none"
          isAnimationActive={false}
        />
        <Line type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="p90" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
