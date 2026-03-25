import type { RollRecord } from '@shared/simulation';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  rolls: RollRecord[];
  initialBankroll: number;
}

interface ChartPoint {
  roll: number;
  bankroll: number;
  tableLoad: number;
  sevenOut: boolean;
  pointMade: boolean;
}

export function SessionChart({ rolls, initialBankroll }: Props) {
  const data: ChartPoint[] = rolls.map(r => ({
    roll: r.rollNumber,
    bankroll: r.bankrollAfter,
    tableLoad: r.tableLoadBefore,
    sevenOut: r.pointBefore != null && r.rollValue === 7,
    pointMade: r.pointBefore != null && r.pointBefore === r.rollValue,
  }));

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <h2 className="text-sm font-mono text-gray-500 uppercase tracking-wide mb-4">Session Chart</h2>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data} margin={{ top: 8, right: 40, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="roll"
            label={{ value: 'Roll', position: 'insideBottomRight', offset: -8 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="bankroll"
            orientation="left"
            label={{ value: 'Bankroll ($)', angle: -90, position: 'insideLeft', offset: 10 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="load"
            orientation="right"
            label={{ value: 'Table Load ($)', angle: 90, position: 'insideRight', offset: 10 }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) => [`$${value}`, '']}
            labelFormatter={(label) => `Roll ${label}`}
          />
          <Legend />
          <ReferenceLine
            yAxisId="bankroll"
            y={initialBankroll}
            stroke="#9ca3af"
            strokeDasharray="6 3"
            label={{ value: 'Buy-in', position: 'right', fontSize: 11, fill: '#9ca3af' }}
          />
          <Area
            yAxisId="load"
            dataKey="tableLoad"
            name="Table Load"
            fill="#e0e7ff"
            stroke="#818cf8"
            strokeWidth={1}
            fillOpacity={0.4}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="bankroll"
            dataKey="bankroll"
            name="Bankroll"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {data.filter(d => d.sevenOut).map(d => (
            <ReferenceLine
              key={`seven-${d.roll}`}
              yAxisId="bankroll"
              x={d.roll}
              stroke="#ef4444"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
          ))}
          {data.filter(d => d.pointMade).map(d => (
            <ReferenceLine
              key={`point-${d.roll}`}
              yAxisId="bankroll"
              x={d.roll}
              stroke="#22c55e"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-xs text-gray-500 font-mono">
        <span><span className="inline-block w-3 h-0.5 bg-red-400 mr-1 align-middle"></span>7-out</span>
        <span><span className="inline-block w-3 h-0.5 bg-green-500 mr-1 align-middle"></span>Point made</span>
      </div>
    </div>
  );
}
