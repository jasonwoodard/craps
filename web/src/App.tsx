import { Routes, Route, Navigate } from 'react-router';
import { Shell } from './components/Shell';
import { SessionPage } from './pages/SessionPage';
import { DistributionPage } from './pages/DistributionPage';
import { SessionComparePage } from './pages/SessionComparePage';
import { DistributionComparePage } from './pages/DistributionComparePage';
import { StrategiesPage } from './pages/StrategiesPage';
import { CatsStrategyPage } from './pages/strategies/CatsStrategyPage';
import { BatsStrategyPage } from './pages/strategies/BatsStrategyPage';
import { GuidePage } from './pages/GuidePage';

function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/session" replace />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/distribution" element={<DistributionPage />} />
        <Route path="/session-compare" element={<SessionComparePage />} />
        <Route path="/distribution-compare" element={<DistributionComparePage />} />
        <Route path="/strategies" element={<StrategiesPage />} />
        <Route path="/strategies/cats" element={<CatsStrategyPage />} />
        <Route path="/strategies/bats" element={<BatsStrategyPage />} />
        <Route path="/guide" element={<GuidePage />} />
      </Routes>
    </Shell>
  );
}

export default App;
