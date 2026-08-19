import { useState, useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router';
import { canonicalizeSpec, parseStrategySpec } from '@engine/cli/strategy-spec';
import { findStrategy, useStrategyCatalog } from '../lib/strategy-meta';

/** Table minimums the toolbar offers as one-click presets; any value >= $5 is accepted. */
export const TABLE_MIN_PRESETS = [10, 15, 25];
/** The engine's default table minimum — omitted from canonical specs. */
export const DEFAULT_TABLE_MIN = 10;
/** Below this there is no table; the unit system needs u > 0. */
export const MIN_TABLE_MIN = 5;

interface FormState {
  /** Base registry names; spec options live in their own fields. */
  strategyA: string;
  strategyB: string;
  /** Funded-entry stage slug, or '' for classic entry. */
  entryA: string;
  tableMin: string;
  rolls: string;
  bankroll: string;
  seed: string;
  seeds: string;
}

interface FormErrors {
  rolls?: string;
  bankroll?: string;
  seed?: string;
  tableMin?: string;
}

interface PillProps {
  id: string;
  label: string;
  displayValue: string;
  wide?: boolean;
  locked?: boolean;
  suffix?: string;
  hasChev?: boolean;
  /** true → dropdown popover; false → inline edit */
  isDropdown?: boolean;
  open: boolean;
  onToggle: (id: string) => void;
  error?: string;
  children: ReactNode;
}

function Pill({
  id, label, displayValue, wide, locked, suffix,
  hasChev = true, isDropdown = false, open, onToggle, error, children,
}: PillProps) {
  const stackClass = `pill__stack${wide ? ' pill__stack--wide' : ' pill__stack--narrow'}`;
  const lockedClass = locked ? ' pill--locked' : '';

  // Inline-edit mode: pill becomes a <div> so the nested <input> is valid HTML
  if (open && !isDropdown) {
    return (
      <div className="pill-wrap">
        <div className={`pill pill--open${lockedClass}`}>
          <div className={stackClass}>
            <span className="pill__label">{label}</span>
            <span className="pill__value-row">
              {suffix && <span className="pill__suffix">{suffix}</span>}
              {children}
            </span>
          </div>
          {hasChev && <span className="pill__chev">▾</span>}
        </div>
        {error && <p className="pill-inline-error">{error}</p>}
      </div>
    );
  }

  const btnClass = [
    'pill',
    lockedClass,
    open ? ' pill--open' : '',
    open && isDropdown ? ' pill--dropdown-open' : '',
  ].join('').trim();

  return (
    <div className="pill-wrap">
      <button
        type="button"
        className={btnClass}
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-haspopup={isDropdown ? 'listbox' : undefined}
      >
        <div className={stackClass}>
          <span className="pill__label">{label}</span>
          <span className="pill__value-row">
            {suffix && <span className="pill__suffix">{suffix}</span>}
            <span className="pill__value">{displayValue}</span>
          </span>
        </div>
        {hasChev && (
          <span className={`pill__chev${open && isDropdown ? ' pill__chev--open' : ''}`}>▾</span>
        )}
      </button>
      {open && isDropdown && (
        <div className="pill-popover">
          {children}
          {error && <p className="pill-popover__error">{error}</p>}
        </div>
      )}
    </div>
  );
}

// Maps pill IDs to FormState keys (used for revert-on-escape)
const PILL_TO_FORM_KEY: Partial<Record<string, keyof FormState>> = {
  strategy: 'strategyA',
  baseline: 'strategyA',
  test:     'strategyB',
  entry:    'entryA',
  tableMin: 'tableMin',
  rolls:    'rolls',
  bankroll: 'bankroll',
  seed:     'seed',
  seeds:    'seeds',
};

/** Split a URL spec into the toolbar's separate controls; unparseable specs fall back to the raw name. */
function splitSpec(spec: string): { name: string; entry: string; tableMin: number } {
  try {
    const parsed = parseStrategySpec(spec);
    return {
      name: parsed.name,
      entry: parsed.options.entry ?? '',
      tableMin: parsed.options.tableMin ?? DEFAULT_TABLE_MIN,
    };
  } catch {
    return { name: spec, entry: '', tableMin: DEFAULT_TABLE_MIN };
  }
}

/**
 * Compose the canonical spec the URL, the run request, and the manifest all
 * share. The engine's default table minimum is omitted so a plain CATS run at
 * a $10 table stays `CATS` and a funded entry stays `CATS@entry=<slug>`.
 */
export function buildSpec(name: string, entry: string, tableMin: number): string {
  return canonicalizeSpec(name, {
    ...(entry ? { entry } : {}),
    ...(tableMin !== DEFAULT_TABLE_MIN ? { tableMin } : {}),
  });
}

export function RunToolbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [strategies, setStrategies] = useState<string[]>(['CATS']);
  const [errors, setErrors] = useState<FormErrors>({});
  const [openPill, setOpenPill] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const editStartRef = useRef<Record<string, string>>({});

  const isDistribution = location.pathname === '/distribution';
  const isCompare = location.pathname === '/session-compare';
  const isDistributionCompare = location.pathname === '/distribution-compare';
  const isStaticPage = location.pathname.startsWith('/strategies') || location.pathname === '/guide';

  const [form, setForm] = useState<FormState>(() => {
    const strategiesParts = searchParams.get('strategies')?.split(',').map(s => s.trim()) ?? [];
    const specA = searchParams.get('strategy') ?? strategiesParts[0] ?? 'CATS';
    const a = splitSpec(specA);
    return {
      strategyA: a.name,
      strategyB: splitSpec(searchParams.get('test') ?? strategiesParts[1] ?? 'ThreePointMolly3X').name,
      entryA:    a.entry,
      tableMin:  String(a.tableMin),
      rolls:     searchParams.get('rolls')    ?? '500',
      bankroll:  searchParams.get('bankroll') ?? '300',
      seed:      searchParams.get('seed')     ?? '',
      seeds:     searchParams.get('seeds')    ?? '500',
    };
  });

  const tableMinNum = Number(form.tableMin);
  const catalogTableMin = Number.isInteger(tableMinNum) && tableMinNum >= MIN_TABLE_MIN
    ? tableMinNum
    : DEFAULT_TABLE_MIN;
  const { catalog } = useStrategyCatalog(catalogTableMin);
  const meta = findStrategy(catalog, form.strategyA);

  // Stage lists, display names, and gates come from metadata only — never from
  // a table in web/ (webui-plan.md cross-phase guardrail).
  const entryStages = meta?.stages ?? [];
  const isStaged = entryStages.length > 1;
  const isParameterized = meta?.parameterized ?? false;
  const showEntryPill = isStaged && !isCompare && !isDistributionCompare;
  const showTableMinPill = isParameterized && !isCompare && !isDistributionCompare;

  useEffect(() => {
    fetch('/api/strategies')
      .then(res => res.json() as Promise<string[]>)
      .then(setStrategies)
      .catch(() => {/* keep default */});
  }, []);

  // An entry slug is only meaningful for the strategy that declares it.
  useEffect(() => {
    if (!catalog || !form.entryA) return;
    if (!entryStages.some(s => s.slug === form.entryA)) {
      setForm(f => ({ ...f, entryA: '' }));
    }
  }, [catalog, form.strategyA, form.entryA, entryStages]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenPill(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    const rolls = Number(form.rolls);
    if (!form.rolls || !Number.isInteger(rolls) || rolls <= 0) errs.rolls = 'Must be a positive integer';
    const bankroll = Number(form.bankroll);
    if (!form.bankroll || !Number.isInteger(bankroll) || bankroll <= 0) errs.bankroll = 'Must be a positive integer';
    if (form.seed !== '') {
      const seed = Number(form.seed);
      if (!Number.isInteger(seed)) errs.seed = 'Must be an integer';
    }
    if (showTableMinPill) {
      if (!form.tableMin || !Number.isInteger(tableMinNum) || tableMinNum < MIN_TABLE_MIN) {
        errs.tableMin = `Must be a whole dollar amount of at least $${MIN_TABLE_MIN}`;
      }
    }
    return errs;
  }

  function handleRun() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (errs.rolls) setOpenPill('rolls');
      else if (errs.bankroll) setOpenPill('bankroll');
      else if (errs.tableMin) setOpenPill('tableMin');
      else if (errs.seed) setOpenPill('seed');
      return;
    }
    setErrors({});
    setOpenPill(null);
    const base = isStaticPage ? '/session' : location.pathname;
    const specA = buildSpec(
      form.strategyA,
      showEntryPill ? form.entryA : '',
      showTableMinPill ? tableMinNum : DEFAULT_TABLE_MIN,
    );
    const params = new URLSearchParams({
      rolls: form.rolls,
      bankroll: form.bankroll,
      ...(form.seed !== '' ? { seed: form.seed } : {}),
    });
    if (isCompare) {
      params.set('strategies', `${specA},${form.strategyB}`);
    } else if (isDistributionCompare) {
      params.set('strategy', specA);
      params.set('test', form.strategyB);
      params.set('seeds', form.seeds);
    } else {
      params.set('strategy', specA);
      if (isDistribution) params.set('seeds', form.seeds);
    }
    navigate(`${base}?${params.toString()}`);
  }

  function setField(name: keyof FormState, value: string) {
    setForm(f => ({ ...f, [name]: value }));
    if (name in errors) setErrors(e => ({ ...e, [name]: undefined }));
  }

  function togglePill(id: string) {
    setOpenPill(prev => {
      if (prev !== id) {
        const key = PILL_TO_FORM_KEY[id];
        if (key) editStartRef.current[id] = form[key];
      }
      return prev === id ? null : id;
    });
  }

  function commitInline() {
    setOpenPill(null);
  }

  function revertAndClose(id: string) {
    const key = PILL_TO_FORM_KEY[id];
    const startVal = editStartRef.current[id];
    if (key !== undefined && startVal !== undefined) setField(key, startVal);
    setOpenPill(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { setOpenPill(null); return; }
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'SELECT') handleRun();
  }

  const showComparePills = isCompare || isDistributionCompare;
  const showSeedsPill = isDistribution || isDistributionCompare;

  // Inline input handlers shared by all number pills
  function inlineHandlers(id: string) {
    return {
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter')  { e.preventDefault(); commitInline(); }
        if (e.key === 'Escape') { e.preventDefault(); revertAndClose(id); }
      },
      onBlur: commitInline,
    };
  }

  const classicStage = entryStages[0];
  const entryLabel = form.entryA
    ? entryStages.find(s => s.slug === form.entryA)?.displayName ?? form.entryA
    : classicStage ? `${classicStage.displayName} (classic)` : 'Classic';

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Run settings"
      className="runbar"
      onKeyDown={handleKeyDown}
    >
      <div className="runbar__group">
        {showComparePills ? (
          <>
            <Pill
              id="baseline"
              label="Baseline"
              displayValue={form.strategyA}
              wide
              isDropdown
              open={openPill === 'baseline'}
              onToggle={togglePill}
            >
              <ul className="pill-option-list" role="listbox" aria-label="Baseline strategy">
                {strategies.map(s => (
                  <li
                    key={s}
                    role="option"
                    aria-selected={form.strategyA === s}
                    className={`pill-option${form.strategyA === s ? ' pill-option--active' : ''}`}
                    onClick={() => { setField('strategyA', s); setOpenPill(null); }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </Pill>

            <span className="runbar__vs">vs</span>

            <Pill
              id="test"
              label="Test"
              displayValue={form.strategyB}
              wide
              isDropdown
              open={openPill === 'test'}
              onToggle={togglePill}
            >
              <ul className="pill-option-list" role="listbox" aria-label="Test strategy">
                {strategies.map(s => (
                  <li
                    key={s}
                    role="option"
                    aria-selected={form.strategyB === s}
                    className={`pill-option${form.strategyB === s ? ' pill-option--active' : ''}`}
                    onClick={() => { setField('strategyB', s); setOpenPill(null); }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </Pill>
          </>
        ) : (
          <Pill
            id="strategy"
            label="Strategy"
            displayValue={form.strategyA}
            wide
            isDropdown
            open={openPill === 'strategy'}
            onToggle={togglePill}
          >
            <ul className="pill-option-list" role="listbox" aria-label="Strategy">
              {strategies.map(s => (
                <li
                  key={s}
                  role="option"
                  aria-selected={form.strategyA === s}
                  className={`pill-option${form.strategyA === s ? ' pill-option--active' : ''}`}
                  onClick={() => { setField('strategyA', s); setOpenPill(null); }}
                >
                  {s}
                </li>
              ))}
            </ul>
          </Pill>
        )}

        {showEntryPill && (
          <Pill
            id="entry"
            label="Entry Stage"
            displayValue={entryLabel}
            wide
            isDropdown
            open={openPill === 'entry'}
            onToggle={togglePill}
          >
            <ul className="pill-option-list" role="listbox" aria-label="Entry stage">
              {entryStages.map((stage, i) => {
                // The gate-0 stage IS classic entry, so it writes a bare spec.
                const value = i === 0 ? '' : stage.slug;
                const selected = form.entryA === value;
                return (
                  <li
                    key={stage.slug}
                    role="option"
                    aria-selected={selected}
                    data-slug={stage.slug}
                    className={`pill-option${selected ? ' pill-option--active' : ''}`}
                    onClick={() => { setField('entryA', value); setOpenPill(null); }}
                  >
                    {i === 0 ? `${stage.displayName} (classic)` : stage.displayName}
                    {stage.gate > 0 && <span className="pill-option__hint"> · buy in at +${stage.gate}</span>}
                  </li>
                );
              })}
            </ul>
          </Pill>
        )}

        {showTableMinPill && (
          <Pill
            id="tableMin"
            label="Table Min"
            displayValue={form.tableMin}
            suffix="$"
            isDropdown
            open={openPill === 'tableMin'}
            onToggle={togglePill}
            error={errors.tableMin}
          >
            <ul className="pill-option-list" role="listbox" aria-label="Table minimum">
              {TABLE_MIN_PRESETS.map(preset => (
                <li
                  key={preset}
                  role="option"
                  aria-selected={tableMinNum === preset}
                  className={`pill-option${tableMinNum === preset ? ' pill-option--active' : ''}`}
                  onClick={() => { setField('tableMin', String(preset)); setOpenPill(null); }}
                >
                  ${preset}
                </li>
              ))}
            </ul>
            <label className="pill-popover__field">
              <span className="pill-popover__field-label">Other</span>
              <input
                type="number"
                min={MIN_TABLE_MIN}
                step={1}
                value={form.tableMin}
                onChange={e => setField('tableMin', e.target.value)}
                aria-label="Custom table minimum"
                className="pill__inline-input"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitInline(); } }}
              />
            </label>
          </Pill>
        )}

        <Pill
          id="rolls"
          label="Rolls"
          displayValue={form.rolls}
          open={openPill === 'rolls'}
          onToggle={togglePill}
          error={errors.rolls}
        >
          <input
            type="number"
            value={form.rolls}
            onChange={e => setField('rolls', e.target.value)}
            className="pill__inline-input"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            {...inlineHandlers('rolls')}
          />
        </Pill>

        <Pill
          id="bankroll"
          label="Bankroll"
          displayValue={form.bankroll}
          suffix="$"
          open={openPill === 'bankroll'}
          onToggle={togglePill}
          error={errors.bankroll}
        >
          <input
            type="number"
            value={form.bankroll}
            onChange={e => setField('bankroll', e.target.value)}
            className="pill__inline-input"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            {...inlineHandlers('bankroll')}
          />
        </Pill>

        {showSeedsPill && (
          <Pill
            id="seeds"
            label="Seeds"
            displayValue={form.seeds}
            open={openPill === 'seeds'}
            onToggle={togglePill}
          >
            <input
              type="number"
              value={form.seeds}
              onChange={e => setField('seeds', e.target.value)}
              className="pill__inline-input"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              {...inlineHandlers('seeds')}
            />
          </Pill>
        )}

        <Pill
          id="seed"
          label="Seed"
          displayValue={form.seed || 'random'}
          locked={!form.seed}
          hasChev={false}
          open={openPill === 'seed'}
          onToggle={togglePill}
          error={errors.seed}
        >
          <input
            type="number"
            value={form.seed}
            onChange={e => setField('seed', e.target.value)}
            placeholder="random"
            className="pill__inline-input"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            {...inlineHandlers('seed')}
          />
        </Pill>
      </div>

      <div className="runbar__spacer" />

      <button type="button" className="run-btn" onClick={handleRun}>
        <span className="run-btn__glyph">▶</span>
        <span>Run</span>
      </button>
    </div>
  );
}
