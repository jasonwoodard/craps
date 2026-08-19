import { useState } from 'react';
import { isSeedRange, type RunManifest } from '@shared/manifest';

interface Props {
  manifest: RunManifest | null | undefined;
  /** Extra context for the expanded view, e.g. "served from cache". */
  note?: string;
}

function seedLabel(seeds: RunManifest['seeds']): string {
  if (isSeedRange(seeds)) return `seeds 0–${seeds.count - 1}`;
  return seeds.seed == null ? 'seed random' : `seed ${seeds.seed}`;
}

/**
 * Run identity as a first-class UI element (webui-plan.md §2). Determinism
 * makes the manifest the archive — a run is reproducible from exactly what
 * this chip shows, so every result view carries one.
 */
export function ManifestChip({ manifest, note }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!manifest) return null;

  const summary = [
    manifest.strategySpec,
    `$${manifest.tableMin} table`,
    `$${manifest.bankroll} buy-in`,
    `${manifest.rolls} rolls`,
    seedLabel(manifest.seeds),
  ].join(' · ');

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const rows: [string, string][] = [
    ['strategySpec', manifest.strategySpec],
    ['tableMin', `$${manifest.tableMin}`],
    ['bankroll', `$${manifest.bankroll}`],
    ['rolls', String(manifest.rolls)],
    ['seeds', seedLabel(manifest.seeds)],
    ['engineVersion', manifest.engineVersion],
    ['generatedAt', manifest.generatedAt],
    ['schemaVersion', String(manifest.schemaVersion)],
  ];

  return (
    <div className="my-3" data-testid="manifest-chip">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 font-mono text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors max-w-full"
          title="Run manifest — this run is reproducible from these fields"
        >
          <span className="text-slate-400">manifest</span>
          <span className="truncate">{summary}</span>
          <span className="text-slate-400">{open ? '▴' : '▾'}</span>
        </button>
        {note && <span className="font-mono text-xs text-slate-400">{note}</span>}
      </div>

      {open && (
        <div className="mt-2 rounded border border-slate-200 bg-white p-3">
          <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 font-mono text-xs">
            {rows.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-slate-400">{key}</dt>
                <dd className="text-slate-700 break-all">{value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={copy}
            className="mt-3 rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors"
          >
            {copied ? 'Copied' : 'Copy as JSON'}
          </button>
        </div>
      )}
    </div>
  );
}
