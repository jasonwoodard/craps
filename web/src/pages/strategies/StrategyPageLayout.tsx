import type { ReactNode } from 'react';
import { Link } from 'react-router';

const GITHUB_BLOB = 'https://github.com/jasonwoodard/craps/blob/master';

interface LayoutProps {
  /** Acronym exactly as it expands — the page is the canonical spelling. */
  name: string;
  expansion: string;
  tagline: string;
  /** Repo-relative path to the strategy document that is the source of truth. */
  docPath: string;
  draft?: boolean;
  children: ReactNode;
}

export function StrategyPageLayout({ name, expansion, tagline, docPath, draft, children }: LayoutProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/strategies" className="text-xs font-mono text-slate-400 hover:text-slate-700">
        ← All strategies
      </Link>

      <div className="mt-2 flex items-baseline gap-3 flex-wrap">
        <h1 className="text-xl font-mono font-bold">{name}</h1>
        {draft && (
          <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-semibold text-amber-800 uppercase tracking-wide">
            Draft
          </span>
        )}
      </div>
      <p className="text-sm font-mono text-slate-600">{expansion}</p>
      <p className="mt-1 text-sm font-mono text-slate-500">{tagline}</p>

      {children}

      <section className="mt-10 border-t border-slate-200 pt-4">
        <p className="text-xs font-mono text-slate-500">
          This page is an abridgement. The strategy document is the source of truth:{' '}
          <a
            className="text-blue-600 underline hover:text-blue-800"
            href={`${GITHUB_BLOB}/${docPath}`}
            target="_blank"
            rel="noreferrer"
          >
            {docPath}
          </a>
        </p>
      </section>
    </div>
  );
}

export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-mono font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 font-mono mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}

export interface LadderRow {
  /** Machine-declared display name — never restated in web/. */
  displayName: string;
  /** Board description, with every amount derived from the unit system. */
  board: string;
  gateAtTen: number;
  gateAtFifteen: number;
}

/**
 * The ladder as a table in units, with the $10 and $15 instantiations beside
 * each other. Stage names and gates come from stage metadata; board amounts
 * come from `src/dsl/units.ts`. Nothing here is typed by hand.
 */
export function LadderTable({ rows, gateHeading }: { rows: LadderRow[]; gateHeading: string }) {
  if (rows.length === 0) {
    return <p className="text-sm font-mono text-slate-400">Stage metadata unavailable.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table data-testid="ladder" className="w-full text-xs font-mono border border-gray-200 rounded">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-left">
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Board</th>
            <th className="px-3 py-2 font-medium text-right">{gateHeading} · $10</th>
            <th className="px-3 py-2 font-medium text-right">{gateHeading} · $15</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.displayName} className="border-b border-gray-100 last:border-0 align-top">
              <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{row.displayName}</td>
              <td className="px-3 py-2 text-gray-600">{row.board}</td>
              <td className="px-3 py-2 text-gray-600 text-right whitespace-nowrap">
                {row.gateAtTen === 0 ? 'entry' : `+$${row.gateAtTen}`}
              </td>
              <td className="px-3 py-2 text-gray-600 text-right whitespace-nowrap">
                {row.gateAtFifteen === 0 ? 'entry' : `+$${row.gateAtFifteen}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
