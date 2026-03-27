import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { DistributionAggregates } from '../../../types/simulation';

interface Props {
  aggregates: DistributionAggregates;
}

export function RuinCurve({ aggregates }: Props) {
  const { ruinByRoll } = aggregates;

  const data = ruinByRoll.map((p, i) => ({
    roll: i + 1,
    ruin: Math.round(p * 1000) / 10,  // convert to percentage, 1 decimal
  }));

  const maxRuin = Math.max(...ruinByRoll) * 100;
  const yMax = Math.min(100, Math.ceil(maxRuin / 5) * 5 + 5);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="roll"
          tick={{ fontSize: 11, fontFamily: 'monospace' }}
          label={{ value: 'Roll', position: 'insideBottom', offset: -2, fontSize: 11 }}
        />
        <YAxis
          domain={[0, yMax]}
          tick={{ fontSize: 11, fontFamily: 'monospace' }}
          tickFormatter={(v: number) => `${v}%`}
          width={48}
        />
        <Tooltip
          formatter={(value) => [`${value ?? 0}%`, 'P(ruin)']}
          labelFormatter={(label) => `Roll ${label}`}
          contentStyle={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="ruin"
          stroke="#ef4444"
          fill="#fee2e2"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
