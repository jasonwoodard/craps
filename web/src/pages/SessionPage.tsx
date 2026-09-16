import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useSimulation } from '../hooks/useSimulation';
import { SummaryPanel } from '../components/SummaryPanel';
import { SessionChart } from '../components/SessionChart';
import { StageBreakdown } from '../components/StageBreakdown';
import { StageOverlayChart } from '../components/StageOverlayChart';
import { TrendPanel } from '../components/TrendPanel';
import { ManifestChip } from '../components/ManifestChip';
import { useOrigin } from '../lib/strategy-meta';
import { parseStrategySpec } from '@engine/cli/strategy-spec';

/** Table minimum a canonical spec asks for; the engine defaults to $10. */
function specTableMin(spec: string): number {
  try {
    return parseStrategySpec(spec).options.tableMin ?? 10;
  } catch {
    return 10;
  }
}

function SpinnerOverlay() {
  return (
    <div className="p-6 text-center text-gray-500 font-mono">
      Running simulation…
    </div>
  );
}

function ErrorState({ message }: { message: string | null }) {
  return (
    <div className="p-6 text-center text-red-600 font-mono">
      Error: {message ?? 'Unknown error'}
    </div>
  );
}

export function SessionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const params = {
    strategy: searchParams.get('strategy') ?? 'CATS',
    rolls: Number(searchParams.get('rolls') ?? 500),
    bankroll: Number(searchParams.get('bankroll') ?? 300),
    seed: searchParams.get('seed') ? Number(searchParams.get('seed')) : undefined,
  };

  const tableMin = specTableMin(params.strategy);
  const { data, loading, error } = useSimulation(params);
  // Profit's zero point: B - gate(entry). Funded entries start mid-ladder.
  const origin = useOrigin(params.strategy, params.bankroll, tableMin);

  useEffect(() => {
    if (data?.seed != null && !searchParams.get('seed')) {
      const next = new URLSearchParams(searchParams);
      next.set('seed', String(data.seed));
      navigate(`/session?${next.toString()}`, { replace: true });
    }
  }, [data]);

  if (loading) return <SpinnerOverlay />;
  if (error || !data) return <ErrorState message={error} />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-mono font-bold mb-1">Session</h1>
      <p className="text-sm text-slate-500 font-mono mb-1">See how a strategy plays out over a single session.</p>
      <ManifestChip manifest={data.manifest} />
      <SummaryPanel result={data} params={params} />
      <div className="rounded border border-slate-200">
        <SessionChart rolls={data.rolls} initialBankroll={data.initialBankroll} strategySpec={params.strategy} tableMin={tableMin} />
      </div>
      <StageBreakdown rolls={data.rolls} strategySpec={params.strategy} tableMin={tableMin} />
      <StageOverlayChart rolls={data.rolls} strategySpec={params.strategy} tableMin={tableMin} />
      <TrendPanel
        rolls={data.rolls}
        initialBankroll={data.initialBankroll}
        strategySpec={params.strategy}
        tableMin={tableMin}
        origin={origin}
      />
    </div>
  );
}
