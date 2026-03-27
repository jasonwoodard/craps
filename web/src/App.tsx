import { Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/Shell';
import { SessionPage } from './pages/SessionPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ComparePage } from './pages/ComparePage';

function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/session" replace />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </Shell>
  );
}

export default App;
