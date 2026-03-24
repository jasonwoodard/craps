import type { EngineResult } from '@shared/simulation';
import type { SimParams } from '../hooks/useSimulation';
import { computeSessionStats } from '../lib/stats';

interface Props {
  result: EngineResult;
  params: SimParams;
}

export function SummaryPanel({ result, params }: Props) {
  const stats = computeSessionStats(result);
  const netPositive = stats.netChange >= 0;

  return (
    <div className="mb-6">
      <div className="text-sm text-gray-500 mb-3 font-mono">
        {params.strategy} · {params.rolls} rolls · ${params.bankroll} buy-in
        {params.seed != null ? ` · seed ${params.seed}` : ''}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Net Change" value={`${netPositive ? '+' : ''}$${stats.netChange}`} highlight={netPositive ? 'green' : 'red'} />
        <StatCard label="Final Bankroll" value={`$${result.finalBankroll}`} />
        <StatCard label="Peak" value={`$${stats.peakBankroll}`} />
        <StatCard label="Trough" value={`$${stats.troughBankroll}`} />
        <StatCard label="Max Drawdown" value={`$${stats.maxDrawdown}`} />
        <StatCard label="Total Rolls" value={String(stats.totalRolls)} />
        <StatCard label="Win Rolls" value={String(stats.winRolls)} />
        <StatCard label="Loss Rolls" value={String(stats.lossRolls)} />
        <StatCard label="No Action" value={String(stats.noActionRolls)} />
        <StatCard label="Avg Table Load" value={`$${stats.avgTableLoad}`} />
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  highlight?: 'green' | 'red';
}

function StatCard({ label, value, highlight }: StatCardProps) {
  const valueColor =
    highlight === 'green' ? 'text-green-600' :
    highlight === 'red' ? 'text-red-600' :
    'text-gray-900';

  return (
    <div className="bg-white border border-gray-200 rounded p-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-mono text-lg font-semibold ${valueColor}`}>{value}</div>
    </div>
  );
}
