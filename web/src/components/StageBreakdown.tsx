import type { RollRecord } from '@shared/simulation';
import { computeStageVisitSummaries, hasStageData, STAGE_COLORS, STAGE_LABELS } from '../lib/stages';

interface Props {
  rolls: RollRecord[];
}

function fmt(n: number): string {
  return `$${Math.abs(n)}`;
}

function fmtPnL(n: number): string {
  return `${n >= 0 ? '+' : '-'}$${Math.abs(n)}`;
}

export function StageBreakdown({ rolls }: Props) {
  if (!hasStageData(rolls)) return null;

  const summaries = computeStageVisitSummaries(rolls);

  return (
    <div className="bg-white border border-gray-200 rounded p-4 mt-6">
      <h2 className="text-sm font-mono text-gray-500 uppercase tracking-wide mb-4">Stage Breakdown</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-left">
              <th className="py-1 pr-3 font-medium">#</th>
              <th className="py-1 pr-3 font-medium">Stage</th>
              <th className="py-1 pr-3 font-medium text-right">Roll Range</th>
              <th className="py-1 pr-3 font-medium text-right">Rolls</th>
              <th className="py-1 pr-3 font-medium text-right">Entry</th>
              <th className="py-1 pr-3 font-medium text-right">Exit</th>
              <th className="py-1 pr-3 font-medium text-right">Net P&amp;L</th>
              <th className="py-1 pr-3 font-medium text-right">Peak</th>
              <th className="py-1 pr-3 font-medium text-right">Trough</th>
              <th className="py-1 font-medium text-right">7-outs</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s, i) => {
              const stageColor = STAGE_COLORS[s.stageName] ?? '#f5f5f5';
              const label = STAGE_LABELS[s.stageName] ?? s.stageName;
              const pnlClass = s.netPnL >= 0 ? 'text-green-700' : 'text-red-600';
              return (
                <tr
                  key={`${s.stageName}-${s.visitIndex}`}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="py-1 pr-3 text-gray-400">{i + 1}</td>
                  <td className="py-1 pr-3">
                    <span
                      className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle"
                      style={{ backgroundColor: stageColor, opacity: 0.8, border: '1px solid #d1d5db' }}
                    />
                    {label}
                  </td>
                  <td className="py-1 pr-3 text-right text-gray-600">{s.startRoll}–{s.endRoll}</td>
                  <td className="py-1 pr-3 text-right text-gray-600">{s.rollCount}</td>
                  <td className="py-1 pr-3 text-right text-gray-600">{fmt(s.entryBankroll)}</td>
                  <td className="py-1 pr-3 text-right text-gray-600">{fmt(s.exitBankroll)}</td>
                  <td className={`py-1 pr-3 text-right font-medium ${pnlClass}`}>{fmtPnL(s.netPnL)}</td>
                  <td className="py-1 pr-3 text-right text-green-700">{fmtPnL(s.peakPnL)}</td>
                  <td className="py-1 pr-3 text-right text-red-600">{fmtPnL(s.troughPnL)}</td>
                  <td className="py-1 text-right text-gray-600">{s.sevenOuts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
