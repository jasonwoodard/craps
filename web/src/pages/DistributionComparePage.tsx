import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDistributionCompare } from '../hooks/useDistributionCompare';
import { DistributionCompareChart } from '../components/DistributionCompareChart';
import { OutcomeDelta } from '../components/OutcomeDelta';
import { InfoTip } from '../components/InfoTip';

export function DistributionComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const strategy = searchParams.get('strategy') ?? 'CATS';
  const test = searchParams.get('test') ?? 'ThreePointMolly3X';
  const rolls = Number(searchParams.get('rolls') ?? 500);
  const bankroll = Number(searchParams.get('bankroll') ?? 300);
  const seeds = Number(searchParams.get('seeds') ?? 500);

  const { baseline, test: testAgg, progress, done, error } = useDistributionCompare({
    strategy,
    test,
    seeds,
    rolls,
    bankroll,
  });

  function handleSwap() {
    // Swap strategy and test URL params — this triggers a new stream with roles exchanged.
    // The new stream re-runs both distributions so the delta table always reads
    // "baseline vs. test" in the orientation the user chose.
    const next = new URLSearchParams(searchParams);
    next.set('strategy', test);
    next.set('test', strategy);
    navigate(`/distribution-compare?${next.toString()}`);
  }

  function setSeedPreset(n: number) {
    const next = new URLSearchParams(searchParams);
    next.set('seeds', String(n));
    navigate(`/distribution-compare?${next.toString()}`);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-1 flex-wrap">
        <h2 className="text-xl font-mono font-bold">Distribution Compare</h2>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setSeedPreset(200)}
            className={`px-3 py-1 font-mono text-xs rounded border transition-colors ${
              seeds === 200
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            Quick (200)
          </button>
          <button
            onClick={() => setSeedPreset(500)}
            className={`px-3 py-1 font-mono text-xs rounded border transition-colors ${
              seeds === 500
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            Standard (500)
          </button>
          <button
            onClick={() => setSeedPreset(1000)}
            className={`px-3 py-1 font-mono text-xs rounded border transition-colors ${
              seeds === 1000
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            Deep (1000)
          </button>
          <button
            onClick={handleSwap}
            className="px-3 py-1 font-mono text-xs rounded border bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-600 transition-colors"
            title="Swap baseline and test — starts a new stream"
          >
            ⇄ Swap
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-500 font-mono mb-1">Compare how two strategies' outcome profiles differ.</p>
      <p className="text-sm text-gray-500 font-mono mb-5">
        <span className="text-blue-600">{strategy}</span> (baseline, solid)
        {' '}vs{' '}
        <span className="text-orange-500">{test}</span> (test, dashed)
        {' '}· {rolls} rolls · ${bankroll} buy-in · {seeds} seeds
      </p>

      {/* Progress bar */}
      {!done && (
        <div className="mb-4">
          <div className="flex justify-between text-xs font-mono text-gray-500 mb-1">
            <span>Simulating…</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded">
            <div
              className="h-2 bg-blue-500 rounded transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 font-mono text-sm">
          Error: {error}
        </div>
      )}

      {/* Band chart */}
      {baseline && testAgg ? (
        <div className="bg-white border border-gray-200 rounded p-4 mb-6">
          <div className="mb-3">
            <h3 className="font-mono font-semibold text-gray-800 flex items-center">
              Bankroll Percentile Bands
              <InfoTip text="Shows the range of bankroll outcomes across all simulated sessions. P10 = a bad session (only 10% did worse). P50 = the median session. P90 = a good session (only 10% did better)." />
            </h3>
            <p className="text-xs text-gray-500 font-mono">
              Solid + shaded = {strategy} (baseline) · Dashed = {test} (test) · P10 / P50 / P90
            </p>
          </div>
          <DistributionCompareChart
            baseline={baseline}
            test={testAgg}
            baselineName={strategy}
            testName={test}
            initialBankroll={bankroll}
          />
        </div>
      ) : (
        !error && (
          <div className="bg-white border border-gray-200 rounded p-4 mb-6 h-40 flex items-center justify-center text-gray-400 font-mono text-sm">
            Waiting for first batch…
          </div>
        )
      )}

      {/* Outcome delta table */}
      {baseline && testAgg && (
        <div className="bg-white border border-gray-200 rounded p-4">
          <div className="mb-3">
            <h3 className="font-mono font-semibold text-gray-800 flex items-center">
              Outcome Delta
              <InfoTip text="Side-by-side comparison of key stats. Green delta = the test strategy is better on this metric. Red delta = the baseline is better. A strategy can win on some metrics and lose on others." />
            </h3>
            <p className="text-xs text-gray-500 font-mono">
              Green = test better · Red = baseline better · Based on {baseline.seedCount} seeds so far
            </p>
          </div>
          <OutcomeDelta baseline={baseline} test={testAgg} />
        </div>
      )}
    </div>
  );
}
