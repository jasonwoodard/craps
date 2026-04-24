import { type ReactNode } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { RunToolbar } from './RunToolbar';

interface ShellProps {
  children: ReactNode;
}

const NAV_LINKS = [
  { to: '/session', label: 'Session', icon: '📈' },
  { to: '/session-compare', label: 'Session Compare', icon: '⚖️' },
  { to: '/distribution', label: 'Distribution', icon: '📊' },
  { to: '/distribution-compare', label: 'Dist. Compare', icon: '📐' },
];

const NAV_LINKS_SECONDARY = [
  { to: '/strategies', label: 'Strategies', icon: '📋' },
  { to: '/guide', label: 'Guide', icon: '📖' },
];

export function Shell({ children }: ShellProps) {
  const [searchParams] = useSearchParams();

  const navTo = (path: string) => {
    // Carry forward shared params, drop page-specific ones
    const shared = new URLSearchParams();
    const strategy = searchParams.get('strategy');
    const rolls = searchParams.get('rolls');
    const bankroll = searchParams.get('bankroll');
    const seed = searchParams.get('seed');
    if (strategy) shared.set('strategy', strategy);
    if (rolls) shared.set('rolls', rolls);
    if (bankroll) shared.set('bankroll', bankroll);
    if (seed) shared.set('seed', seed);
    const qs = shared.toString();
    return qs ? `${path}?${qs}` : path;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar — always expanded, fixed width */}
      <aside className="fixed top-0 left-0 bottom-0 w-60 bg-gray-800 text-white flex flex-col z-10">
        {/* App title */}
        <div className="px-4 py-3 border-b border-gray-700">
          <span className="font-mono font-bold text-sm tracking-tight">Craps Simulator</span>
        </div>

        {/* Primary nav links */}
        <nav className="flex flex-col gap-1 p-2">
          {NAV_LINKS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={navTo(to)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-2 rounded font-mono text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <span className="text-base flex-shrink-0">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Secondary nav — Strategies + Guide, with divider */}
        <div className="border-t border-gray-700 mx-2 my-1" />
        <nav className="flex flex-col gap-1 px-2 pb-2">
          {NAV_LINKS_SECONDARY.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={navTo(to)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-2 rounded font-mono text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <span className="text-base flex-shrink-0">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1" style={{ marginLeft: '240px' }}>
        <RunToolbar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <footer className="py-4 border-t border-slate-100 px-6">
          <p className="text-xs text-slate-400 text-center">
            Craps Simulator is an analytical tool for educational purposes only. It does not constitute gambling advice. No strategy eliminates the house edge.&nbsp;&nbsp;·&nbsp;&nbsp;MIT License&nbsp;&nbsp;·&nbsp;&nbsp;© 2026 Jason Woodard
          </p>
        </footer>
      </div>
    </div>
  );
}
