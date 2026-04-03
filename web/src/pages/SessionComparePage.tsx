import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useComparison } from '../hooks/useComparison';
import { ComparisonChart } from '../components/ComparisonChart';
import { SummaryPanel } from '../components/SummaryPanel';
import { StageBreakdown } from '../components/StageBreakdown';
import type { EngineResult, RollRecord } from '@shared/simulation';

const DEFAULT_STRATEGIES: [string, string] = ['CATS', 'ThreePointMolly3X'];

function toEngineResult(log: RollRecord[], finalBankroll: number, bankroll: number): EngineResult {
  return {
    finalBankroll,
    initialBankroll: bankroll,
    rollsPlayed: log.length,
    rolls: log,
  };
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-mono font-semibold text-gray-800">{title}</h3>
      {sub && <p className="text-xs text-gray-500 font-mono">{sub}</p>}
    </div>
  );
}

export function SessionComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawStrategies = searchParams.get('strategies') ?? DEFAULT_STRATEGIES.join(',');
  const parts = rawStrategies.split(',').map(s => s.trim());
  const strategies: [string, string] = [
    parts[0] ?? DEFAULT_STRATEGIES[0],
    parts[1] ?? DEFAULT_STRATEGIES[1],
  ];

  const rolls = Number(searchParams.get('rolls') ?? 500);
  const bankroll = Number(searchParams.get('bankroll') ?? 300);
  const seed = searchParams.get('seed') ? Number(searchParams.get('seed')) : undefined;

  const { data, loading, error } = useComparison({ strategies, rolls, bankroll, seed });

  // Write resolved seed to URL so the run is reproducible.
  useEffect(() => {
    if (data?.seed != null && !searchParams.get('seed')) {
      const next = new URLSearchParams(searchParams);
      next.set('seed', String(data.seed));
      navigate(`/session-compare?${next.toString()}`, { replace: true });
    }
  }, [data]);

  if (loading) {
    return <div className="p-6 text-center text-gray-500 font-mono">Running comparison…</div>;
  }
  if (error || !data) {
    return <div className="p-6 text-center text-red-600 font-mono">Error: {error ?? 'Unknown error'}</div>;
  }

  const resultA = data.results[strategies[0]];
  const resultB = data.results[strategies[1]];

  if (!resultA || !resultB) {
    return <div className="p-6 text-center text-red-600 font-mono">Invalid comparison results</div>;
  }

  const engResultA = toEngineResult(resultA.log, resultA.finalBankroll, bankroll);
  const engResultB = toEngineResult(resultB.log, resultB.finalBankroll, bankroll);
  const paramsA = { strategy: strategies[0], rolls, bankroll, seed: data.seed };
  const paramsB = { strategy: strategies[1], rolls, bankroll, seed: data.seed };

  const delta = resultA.netChange - resultB.netChange;
  const aheadName = delta >= 0 ? strategies[0] : strategies[1];
  const deltaSign = delta >= 0 ? '+' : '';

  const hasStageA = resultA.log.some(r => r.stageName != null);
  const hasStageB = resultB.log.some(r => r.stageName != null);

  // Confirm dice identity: first 5 rolls must be identical across both strategies.
  const diceVerified = resultA.log.slice(0, 5).every((r, i) => {
    const rb = resultB.log[i];
    return rb != null && r.die1 === rb.die1 && r.die2 === rb.die2;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-xl font-mono font-bold mb-1">Session Compare</h2>
      <p className="text-sm text-slate-500 font-mono mb-1">Compare two strategies on identical dice.</p>
      <p className="text-sm text-gray-500 font-mono mb-5">
        {strategies[0]} vs {strategies[1]} · {rolls} rolls · ${bankroll} buy-in · seed {data.seed}
      </p>

      {/* Section 1 — Head-to-head timeline */}
      <div className="bg-white border border-gray-200 rounded p-4 mb-6">
        <SectionTitle
          title="Head-to-Head Bankroll"
          sub={`${strategies[0]} (blue) vs ${strategies[1]} (orange) — identical dice`}
        />
        <ComparisonChart
          rollsA={resultA.log}
          rollsB={resultB.log}
          nameA={strategies[0]}
          nameB={strategies[1]}
          initialBankroll={bankroll}
        />
      </div>

      {/* Section 2 — Side-by-side summary */}
      <div className="mb-6">
        <div className="font-mono text-sm mb-4">
          <span className="text-gray-500">Net delta: </span>
          <span className={delta >= 0 ? 'text-blue-600 font-semibold' : 'text-orange-500 font-semibold'}>
            {deltaSign}${delta}
          </span>
          <span className="text-gray-500"> — {aheadName} ahead</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-mono font-semibold text-blue-600 uppercase tracking-wide mb-2 border-b-2 border-blue-500 pb-1">
              Strategy A — {strategies[0]}
            </div>
            <SummaryPanel result={engResultA} params={paramsA} />
          </div>
          <div>
            <div className="text-xs font-mono font-semibold text-orange-500 uppercase tracking-wide mb-2 border-b-2 border-orange-500 pb-1">
              Strategy B — {strategies[1]}
            </div>
            <SummaryPanel result={engResultB} params={paramsB} />
          </div>
        </div>
      </div>

      {/* Section 3 — Dice verification */}
      <div className="bg-white border border-gray-200 rounded p-4 mb-6">
        <SectionTitle
          title={`Dice Verification ${diceVerified ? '✓' : '✗'}`}
          sub={
            diceVerified
              ? 'Both strategies saw identical dice — the comparison is controlled.'
              : 'Warning: dice sequences do not match.'
          }
        />
        <table className="text-xs font-mono text-gray-600">
          <thead>
            <tr className="text-gray-400 border-b border-gray-200">
              <th className="pr-6 text-left pb-1">Roll</th>
              <th className="pr-6 text-left pb-1">{strategies[0]}</th>
              <th className="pr-6 text-left pb-1">{strategies[1]}</th>
              <th className="text-left pb-1">Match</th>
            </tr>
          </thead>
          <tbody>
            {resultA.log.slice(0, 5).map((r, i) => {
              const rb = resultB.log[i];
              const match = rb != null && r.die1 === rb.die1 && r.die2 === rb.die2;
              return (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="pr-6 py-1">{r.rollNumber}</td>
                  <td className="pr-6 py-1">[{r.die1}+{r.die2}={r.rollValue}]</td>
                  <td className="pr-6 py-1">{rb ? `[${rb.die1}+${rb.die2}=${rb.rollValue}]` : '—'}</td>
                  <td className={match ? 'text-green-600' : 'text-red-600'}>{match ? '✓' : '✗'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Section 4 — Stage comparison (only when at least one strategy has stage data) */}
      {(hasStageA || hasStageB) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasStageA && (
            <div>
              <div className="text-xs font-mono font-semibold text-blue-600 uppercase tracking-wide mb-1">
                {strategies[0]} — Stage Breakdown
              </div>
              <StageBreakdown rolls={resultA.log} />
            </div>
          )}
          {!hasStageA && hasStageB && (
            <div className="text-xs font-mono text-gray-400 italic">
              {strategies[0]} — no stage data
            </div>
          )}
          {hasStageB && (
            <div>
              <div className="text-xs font-mono font-semibold text-orange-500 uppercase tracking-wide mb-1">
                {strategies[1]} — Stage Breakdown
              </div>
              <StageBreakdown rolls={resultB.log} />
            </div>
          )}
          {hasStageA && !hasStageB && (
            <div className="text-xs font-mono text-gray-400 italic">
              {strategies[1]} — no stage data
            </div>
          )}
        </div>
      )}
    </div>
  );
}
