import type { RollRecord } from '@shared/simulation';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { computeRollingPnL, computeConsecutiveSevenOuts } from '../lib/stats';
import { computeThresholdProximity, isCATSStrategy } from '../lib/cats-thresholds';
import { fmtPnL } from '../lib/stages';

interface Props {
  rolls: RollRecord[];
  initialBankroll: number;
  strategyName: string;
}

export function TrendPanel({ rolls, initialBankroll, strategyName }: Props) {
  const rollingPnL = computeRollingPnL(rolls);
  const consecutiveSevenOuts = computeConsecutiveSevenOuts(rolls);
  const isCats = isCATSStrategy(strategyName);
  const thresholdData = isCats ? computeThresholdProximity(rolls, initialBankroll) : null;

  const rollingData = rolls.map((r, i) => ({
    roll: r.rollNumber,
    pnl: rollingPnL[i],
  }));

  const thresholdChartData = thresholdData
    ? rolls.map((r, i) => ({
        roll: r.rollNumber,
        stepUp: thresholdData[i].stepUpDistance,
        stepDown: thresholdData[i].stepDownCushion,
      }))
    : null;

  const sevenOutData = rolls.map((r, i) => ({
    roll: r.rollNumber,
    count: consecutiveSevenOuts[i],
  }));

  return (
    <div className="bg-white border border-gray-200 rounded p-4 mt-6">
      <h2 className="text-sm font-mono text-gray-500 uppercase tracking-wide mb-6">Trend Indicators</h2>

      <div className="mb-8">
        <h3 className="text-xs font-mono text-gray-600 font-medium mb-2">24-Roll Rolling P&amp;L</h3>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={rollingData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="roll" tick={{ fontSize: 10 }} label={{ value: 'Roll', position: 'insideBottomRight', offset: -8, fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}$${v}`}
            />
            <Tooltip
              formatter={(v) => [fmtPnL(Number(v ?? 0)), '24-roll P&L']}
              labelFormatter={(l) => `Roll ${l}`}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
            <Line
              dataKey="pnl"
              name="24-roll P&L"
              dot={false}
              strokeWidth={1.5}
              stroke="#3b82f6"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {isCats && thresholdChartData && (
        <div className="mb-8">
          <h3 className="text-xs font-mono text-gray-600 font-medium mb-2">
            CATS Threshold Proximity
          </h3>
          <p className="text-xs text-gray-400 font-mono mb-2">
            Step-up distance: $ below next advance threshold. Step-down cushion: $ above retreat threshold.
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={thresholdChartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="roll" tick={{ fontSize: 10 }} label={{ value: 'Roll', position: 'insideBottomRight', offset: -8, fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                formatter={(v, name) =>
                  v != null ? [`$${v}`, String(name)] : ['—', String(name)]
                }
                labelFormatter={(l) => `Roll ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
              <Line
                dataKey="stepUp"
                name="Step-up distance"
                dot={false}
                strokeWidth={1.5}
                stroke="#10b981"
                isAnimationActive={false}
                connectNulls={false}
              />
              <Line
                dataKey="stepDown"
                name="Step-down cushion"
                dot={false}
                strokeWidth={1.5}
                stroke="#f59e0b"
                isAnimationActive={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <h3 className="text-xs font-mono text-gray-600 font-medium mb-2">Consecutive 7-Outs</h3>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={sevenOutData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="roll" tick={{ fontSize: 10 }} label={{ value: 'Roll', position: 'insideBottomRight', offset: -8, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              formatter={(v) => [v ?? 0, 'Consecutive 7-outs']}
              labelFormatter={(l) => `Roll ${l}`}
            />
            <ReferenceLine
              y={2}
              stroke="#ef4444"
              strokeDasharray="4 2"
              label={{ value: 'Step-down threshold', position: 'right', fontSize: 9, fill: '#ef4444' }}
            />
            <Bar
              dataKey="count"
              name="Consecutive 7-outs"
              fill="#ef4444"
              fillOpacity={0.6}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
