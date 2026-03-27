import { useSearchParams } from 'react-router-dom';
import { useDistribution } from '../hooks/useDistribution';
import { BandChart } from '../components/BandChart';
import { OutcomeSummary } from '../components/OutcomeSummary';
import { RuinCurve } from '../components/RuinCurve';

const SEED_PRESETS = [
  { label: 'Quick', seeds: 200 },
  { label: 'Standard', seeds: 500 },
  { label: 'Deep', seeds: 1000 },
];

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-mono font-semibold text-gray-800">{title}</h3>
      {sub && <p className="text-xs text-gray-500 font-mono">{sub}</p>}
    </div>
  );
}

function ProgressBar({ progress, completed, total }: { progress: number; completed: number; total: number }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs font-mono text-gray-500 mb-1">
        <span>{completed} / {total} seeds</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DistributionPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const strategy = searchParams.get('strategy') ?? 'CATS';
  const seeds = Number(searchParams.get('seeds') ?? 500);
  const rolls = Number(searchParams.get('rolls') ?? 500);
  const bankroll = Number(searchParams.get('bankroll') ?? 300);

  const { aggregates, progress, done, error } = useDistribution({ strategy, seeds, rolls, bankroll });

  function selectPreset(presetSeeds: number) {
    const next = new URLSearchParams(searchParams);
    next.set('seeds', String(presetSeeds));
    setSearchParams(next, { replace: false });
  }

  const completed = aggregates?.seedCount ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-xl font-mono font-bold mb-1">Distribution Analysis</h2>
      <p className="text-sm text-gray-500 font-mono mb-5">
        {strategy} · {rolls} rolls · ${bankroll} buy-in
      </p>

      {/* Section 1 — Controls and progress */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wide mr-1">Seeds:</span>
          {SEED_PRESETS.map(({ label, seeds: presetSeeds }) => (
            <button
              key={presetSeeds}
              onClick={() => selectPreset(presetSeeds)}
              className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                seeds === presetSeeds
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {label} ({presetSeeds})
            </button>
          ))}
        </div>

        <ProgressBar progress={progress} completed={completed} total={seeds} />

        {error && (
          <div className="text-sm text-red-600 font-mono mb-2">Error: {error}</div>
        )}
      </div>

      {aggregates ? (
        <>
          {/* Section 2 — Band chart */}
          <div className="bg-white border border-gray-200 rounded p-4 mb-6">
            <SectionTitle
              title="Bankroll Bands"
              sub="P10 (red) / P50 median (blue) / P90 (green) — watch bands stabilize as seeds accumulate"
            />
            <BandChart aggregates={aggregates} initialBankroll={bankroll} />
          </div>

          {/* Section 3 — Outcome summary */}
          <div className="mb-6">
            <SectionTitle
              title="Session Outcomes"
              sub={`${done ? 'Final' : 'Partial'} results across ${completed} seeds`}
            />
            <OutcomeSummary aggregates={aggregates} initialBankroll={bankroll} />
          </div>

          {/* Section 4 — Ruin curve */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <SectionTitle
              title="Ruin Probability"
              sub="Cumulative probability of reaching $0 by each roll"
            />
            <RuinCurve aggregates={aggregates} />
          </div>
        </>
      ) : (
        <div className="text-center text-gray-500 font-mono py-12">
          {error ? `Error: ${error}` : 'Starting simulation…'}
        </div>
      )}
    </div>
  );
}
