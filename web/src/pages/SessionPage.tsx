import { useSimulation } from '../hooks/useSimulation';
import { SummaryPanel } from '../components/SummaryPanel';
import { SessionChart } from '../components/SessionChart';
import { StageBreakdown } from '../components/StageBreakdown';
import { StageOverlayChart } from '../components/StageOverlayChart';
import { TrendPanel } from '../components/TrendPanel';

const HARDCODED_PARAMS = { strategy: 'CATS', rolls: 500, bankroll: 300, seed: 7 };

function LoadingState() {
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
  const { data, loading, error } = useSimulation(HARDCODED_PARAMS);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SummaryPanel result={data} params={HARDCODED_PARAMS} />
      <SessionChart rolls={data.rolls} initialBankroll={data.initialBankroll} />
      <StageBreakdown rolls={data.rolls} />
      <StageOverlayChart rolls={data.rolls} />
      <TrendPanel rolls={data.rolls} initialBankroll={data.initialBankroll} strategyName={HARDCODED_PARAMS.strategy} />
    </div>
  );
}
