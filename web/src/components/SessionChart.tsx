import type { RollRecord } from '@shared/simulation';
import { computeStageSpans, hasStageData, STAGE_COLORS, STAGE_LABELS } from '../lib/stages';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
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
  const stageSpans = hasStageData(rolls) ? computeStageSpans(rolls) : [];

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
            formatter={(value: number, name: string) => [`$${value}`, name]}
            labelFormatter={(label) => `Roll ${label}`}
          />
          <Legend />
          {stageSpans.map(span => (
            <ReferenceArea
              key={`band-${span.stageName}-${span.visitIndex}`}
              yAxisId="bankroll"
              x1={span.startRoll}
              x2={span.endRoll}
              fill={STAGE_COLORS[span.stageName] ?? '#f5f5f5'}
              fillOpacity={0.15}
            />
          ))}
          {stageSpans.slice(1).map(span => (
            <ReferenceLine
              key={`transition-${span.stageName}-${span.visitIndex}`}
              yAxisId="bankroll"
              x={span.startRoll}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              label={{ value: STAGE_LABELS[span.stageName] ?? span.stageName, position: 'top', fontSize: 9, fill: '#64748b' }}
            />
          ))}
          <ReferenceLine
            yAxisId="bankroll"
            y={initialBankroll}
            stroke="#9ca3af"
            strokeDasharray="6 3"
            label={{ value: 'Buy-in', position: 'right', fontSize: 11, fill: '#9ca3af' }}
          />
          <Line
            yAxisId="load"
            dataKey="tableLoad"
            name="Table Load"
            stroke="#e97316"
            strokeWidth={2}
            strokeOpacity={0.9}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="bankroll"
            dataKey="bankroll"
            name="Bankroll"
            stroke="#014d00"
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
