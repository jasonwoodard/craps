import type { RollRecord } from '@shared/simulation';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fmtPnL, hasStageData, normalizeStageVisits, STAGE_COLORS, STAGE_LABELS, uniqueStages } from '../lib/stages';
import { InfoTip } from './InfoTip';

const VISIT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

interface Props {
  rolls: RollRecord[];
}

function buildChartData(visits: ReturnType<typeof normalizeStageVisits>): Record<string, number | undefined>[] {
  const maxLen = Math.max(...visits.map(v => v.points.length));
  return Array.from({ length: maxLen }, (_, t) => {
    const row: Record<string, number | undefined> = { t };
    for (const visit of visits) {
      if (t < visit.points.length) {
        row[`visit_${visit.visitIndex}`] = visit.points[t].pnl;
      }
    }
    return row;
  });
}

function StageChart({ stageName, visits }: { stageName: string; visits: ReturnType<typeof normalizeStageVisits> }) {
  const data = buildChartData(visits);
  const label = STAGE_LABELS[stageName] ?? stageName;
  const bandColor = STAGE_COLORS[stageName] ?? '#f5f5f5';

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{ backgroundColor: bandColor, border: '1px solid #d1d5db' }}
        />
        <h3 className="text-sm font-mono text-gray-700 font-medium">
          {label} — {visits.length} {visits.length === 1 ? 'visit' : 'visits'}
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="t"
            label={{ value: 'Rolls into stage', position: 'insideBottomRight', offset: -8, fontSize: 10 }}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            label={{ value: 'P&L ($)', angle: -90, position: 'insideLeft', offset: 12, fontSize: 10 }}
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v}`}
          />
          <Tooltip
            formatter={(v) => [fmtPnL(Number(v ?? 0)), '']}
            labelFormatter={(t) => `Roll +${t}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: 'Entry', position: 'right', fontSize: 9, fill: '#94a3b8' }} />
          {visits.map((visit, i) => (
            <Line
              key={visit.label}
              dataKey={`visit_${visit.visitIndex}`}
              name={visit.label}
              dot={false}
              strokeWidth={1.5}
              stroke={VISIT_COLORS[i % VISIT_COLORS.length]}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StageOverlayChart({ rolls }: Props) {
  if (!hasStageData(rolls)) return null;

  const seenStages = uniqueStages(rolls);

  return (
    <div className="bg-white border border-gray-200 rounded p-4 mt-6">
      <h2 className="text-sm font-mono text-gray-500 uppercase tracking-wide mb-4 flex items-center">
        Stage Overlay
        <InfoTip text="All visits to each stage aligned to a common start point (T0). A tight cluster means the stage behaves consistently. A wide fan means high variance between visits." />
      </h2>
      <p className="text-xs text-gray-400 font-mono mb-4">
        Each chart overlays all visits to that stage aligned to T0. Y axis is ±$ from stage entry bankroll.
      </p>
      {seenStages.map(stageName => {
        const visits = normalizeStageVisits(rolls, stageName);
        return (
          <StageChart key={stageName} stageName={stageName} visits={visits} />
        );
      })}
    </div>
  );
}
