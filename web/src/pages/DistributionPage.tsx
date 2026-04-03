import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDistribution } from '../hooks/useDistribution';
import { BandChart } from '../components/BandChart';
import { OutcomeSummary } from '../components/OutcomeSummary';
import { RuinCurve } from '../components/RuinCurve';
import { InfoTip } from '../components/InfoTip';
import type { FullDistributionAggregates } from '../../../types/simulation';

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
  const [loadedFile, setLoadedFile] = useState<{ name: string; data: FullDistributionAggregates } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const strategy = searchParams.get('strategy') ?? 'CATS';
  const seeds = Number(searchParams.get('seeds') ?? 500);
  const rolls = Number(searchParams.get('rolls') ?? 500);
  const bankroll = Number(searchParams.get('bankroll') ?? 300);

  const { aggregates: streamAggregates, progress, done, error } = useDistribution({ strategy, seeds, rolls, bankroll });

  // When a file is loaded, use it instead of the stream
  const aggregates = loadedFile ? loadedFile.data : streamAggregates;
  const displayBankroll = loadedFile ? loadedFile.data.params.bankroll : bankroll;

  function selectPreset(presetSeeds: number) {
    const next = new URLSearchParams(searchParams);
    next.set('seeds', String(presetSeeds));
    setSearchParams(next, { replace: false });
    setLoadedFile(null);
    setLoadError(null);
  }

  function handleFileButtonClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be re-selected
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const raw = evt.target?.result as string;
        const parsed = JSON.parse(raw) as FullDistributionAggregates;
        // Basic shape validation
        if (!Array.isArray(parsed.p10) || !Array.isArray(parsed.p50) || !Array.isArray(parsed.p90)) {
          throw new Error('File does not look like a .distribution.json file.');
        }
        setLoadedFile({ name: file.name, data: parsed });
        setLoadError(null);
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : 'Failed to parse file.');
        setLoadedFile(null);
      }
    };
    reader.onerror = () => {
      setLoadError('Failed to read file.');
    };
    reader.readAsText(file);
  }

  const completed = aggregates?.seedCount ?? 0;
  const isLoaded = loadedFile != null;
  const hasTails = isLoaded && loadedFile.data.p95 != null && loadedFile.data.p95.length > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-xl font-mono font-bold mb-1">Distribution Analysis</h2>
      <p className="text-sm text-slate-500 font-mono mb-3">See the range of outcomes across hundreds of sessions.</p>
      {isLoaded ? (
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 bg-blue-50 border border-blue-200 rounded px-3 py-1.5 text-sm font-mono text-blue-800">
            Loaded: {loadedFile.name} ({loadedFile.data.seedCount.toLocaleString()} seeds)
          </div>
          <button
            onClick={() => { setLoadedFile(null); setLoadError(null); }}
            className="text-xs font-mono text-gray-500 hover:text-gray-700 underline"
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 font-mono mb-5">
          {strategy} · {rolls} rolls · ${bankroll} buy-in
        </p>
      )}

      {/* Section 1 — Controls and progress */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wide mr-1">Seeds:</span>
          {SEED_PRESETS.map(({ label, seeds: presetSeeds }) => (
            <button
              key={presetSeeds}
              onClick={() => selectPreset(presetSeeds)}
              className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                !isLoaded && seeds === presetSeeds
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {label} ({presetSeeds})
            </button>
          ))}

          <span className="text-gray-300 mx-1">|</span>

          <button
            onClick={handleFileButtonClick}
            className="px-3 py-1 text-xs font-mono rounded border border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            Load file…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {!isLoaded && (
          <ProgressBar progress={progress} completed={completed} total={seeds} />
        )}

        {(error || loadError) && (
          <div className="text-sm text-red-600 font-mono mb-2">
            Error: {error ?? loadError}
          </div>
        )}
      </div>

      {aggregates ? (
        <>
          {/* Section 2 — Band chart */}
          <div className="bg-white border border-gray-200 rounded p-4 mb-6">
            <div className="mb-3">
              <h3 className="font-mono font-semibold text-gray-800 flex items-center">
                Bankroll Percentile Bands
                <InfoTip text="Shows the range of bankroll outcomes across all simulated sessions. P10 = a bad session (only 10% did worse). P50 = the median session. P90 = a good session (only 10% did better)." />
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                {hasTails
                  ? 'P10 (red) / P50 (blue) / P90 (green) / P95 (amber) / P99 (purple) — loaded from file'
                  : 'P10 (red) / P50 median (blue) / P90 (green) — watch bands stabilize as seeds accumulate'}
              </p>
            </div>
            <BandChart aggregates={aggregates} initialBankroll={displayBankroll} />
          </div>

          {/* Section 3 — Outcome summary */}
          <div className="mb-6">
            <div className="mb-3">
              <h3 className="font-mono font-semibold text-gray-800 flex items-center">
                Outcome Summary
                <InfoTip text="Aggregate statistics across all sessions. Win rate = sessions that ended above buy-in. Ruin rate = sessions that reached $0." />
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                {isLoaded
                  ? `Results across ${completed.toLocaleString()} seeds${hasTails ? ' · includes P95/P99 tail stats' : ''}`
                  : `${done ? 'Final' : 'Partial'} results across ${completed} seeds`}
              </p>
            </div>
            <OutcomeSummary aggregates={aggregates} initialBankroll={displayBankroll} />
          </div>

          {/* Section 4 — Ruin curve */}
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="mb-3">
              <h3 className="font-mono font-semibold text-gray-800 flex items-center">
                Ruin Curve
                <InfoTip text="Probability of going broke by a given roll number. A steep early curve means the strategy is vulnerable to quick losses. A flat curve means it holds up over time." />
              </h3>
              <p className="text-xs text-gray-500 font-mono">Cumulative probability of reaching $0 by each roll</p>
            </div>
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
