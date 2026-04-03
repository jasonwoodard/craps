import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSimulation } from '../hooks/useSimulation';
import { SummaryPanel } from '../components/SummaryPanel';
import { SessionChart } from '../components/SessionChart';
import { StageBreakdown } from '../components/StageBreakdown';
import { StageOverlayChart } from '../components/StageOverlayChart';
import { TrendPanel } from '../components/TrendPanel';

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

  const { data, loading, error } = useSimulation(params);

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
      <SummaryPanel result={data} params={params} />
      <div className="rounded border border-slate-200">
        <SessionChart rolls={data.rolls} initialBankroll={data.initialBankroll} />
      </div>
      <StageBreakdown rolls={data.rolls} />
      <StageOverlayChart rolls={data.rolls} />
      <TrendPanel rolls={data.rolls} initialBankroll={data.initialBankroll} strategyName={params.strategy} />
    </div>
  );
}
