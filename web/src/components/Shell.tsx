import { useState, type ReactNode } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { RunControls } from './RunControls';

interface ShellProps {
  children: ReactNode;
}

const NAV_LINKS = [
  { to: '/session', label: 'Session', icon: '📈' },
  { to: '/distribution', label: 'Distribution', icon: '📊' },
  { to: '/compare', label: 'Compare', icon: '⚖️' },
];

export function Shell({ children }: ShellProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
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
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      {/* Top nav bar */}
      <header className="fixed top-0 left-0 right-0 h-12 bg-gray-900 text-white flex items-center px-4 z-10">
        <span className="font-mono font-bold text-base tracking-tight mr-8">Craps Simulator</span>
        <nav className="flex gap-4">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={navTo(to)}
              className={({ isActive }) =>
                `font-mono text-sm px-2 py-1 rounded transition-colors ${
                  isActive
                    ? 'text-white bg-gray-700'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Body below top nav */}
      <div className="flex flex-1 pt-12">
        {/* Sidebar */}
        <aside
          className="fixed top-12 left-0 bottom-0 bg-gray-800 text-white flex flex-col z-10 transition-all duration-200"
          style={{ width: sidebarExpanded ? '240px' : '48px' }}
        >
          {/* Sidebar nav icons (always visible) */}
          <nav className="flex flex-col gap-1 p-2 flex-1 overflow-hidden">
            {NAV_LINKS.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={navTo(to)}
                title={!sidebarExpanded ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-2 py-2 rounded font-mono text-sm transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <span className="text-base flex-shrink-0">{icon}</span>
                {sidebarExpanded && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Run controls — visible only when expanded */}
          {sidebarExpanded && (
            <div className="border-t border-gray-700">
              <RunControls />
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarExpanded((v) => !v)}
            className="flex items-center justify-center h-10 border-t border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors font-mono text-xs"
            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarExpanded ? '← collapse' : '→'}
          </button>
        </aside>

        {/* Main content */}
        <main
          className="flex-1 overflow-y-auto transition-all duration-200"
          style={{ marginLeft: sidebarExpanded ? '240px' : '48px' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
