import { Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/Shell';
import { SessionPage } from './pages/SessionPage';
import { DistributionPage } from './pages/DistributionPage';
import { SessionComparePage } from './pages/SessionComparePage';
import { DistributionComparePage } from './pages/DistributionComparePage';
import { StrategiesPage } from './pages/StrategiesPage';
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
        <Route path="/guide" element={<GuidePage />} />
      </Routes>
    </Shell>
  );
}

export default App;
