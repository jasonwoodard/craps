import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { RollRecord } from '@shared/simulation';

interface Props {
  rollsA: RollRecord[];
  rollsB: RollRecord[];
  nameA: string;
  nameB: string;
  initialBankroll: number;
}

export function ComparisonChart({ rollsA, rollsB, nameA, nameB, initialBankroll }: Props) {
  const maxLen = Math.max(rollsA.length, rollsB.length);

  const data = Array.from({ length: maxLen }, (_, i) => ({
    roll: i + 1,
    a: rollsA[i]?.bankrollAfter ?? null,
    b: rollsB[i]?.bankrollAfter ?? null,
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
          formatter={(value, name) => [`$${value ?? 0}`, String(name) === 'a' ? nameA : nameB]}
          labelFormatter={(label) => `Roll ${label}`}
          contentStyle={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        <Legend
          wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }}
          formatter={(value: string) => value === 'a' ? nameA : nameB}
        />
        <ReferenceLine
          y={initialBankroll}
          stroke="#6b7280"
          strokeDasharray="4 2"
          label={{ value: 'Buy-in', fontSize: 11, fill: '#6b7280' }}
        />
        <Line type="monotone" dataKey="a" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} name="a" />
        <Line type="monotone" dataKey="b" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} name="b" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
