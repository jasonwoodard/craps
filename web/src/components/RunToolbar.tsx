import { useState, useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

interface FormState {
  strategyA: string;
  strategyB: string;
  rolls: string;
  bankroll: string;
  seed: string;
  seeds: string;
}

interface FormErrors {
  rolls?: string;
  bankroll?: string;
  seed?: string;
}

interface PillProps {
  id: string;
  label: string;
  displayValue: string;
  wide?: boolean;
  locked?: boolean;
  suffix?: string;
  hasChev?: boolean;
  open: boolean;
  onToggle: (id: string) => void;
  error?: string;
  children: ReactNode;
}

function Pill({ id, label, displayValue, wide, locked, suffix, hasChev = true, open, onToggle, error, children }: PillProps) {
  return (
    <div className="pill-wrap">
      <button
        type="button"
        className={'pill' + (locked ? ' pill--locked' : '')}
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className={`pill__stack${wide ? ' pill__stack--wide' : ' pill__stack--narrow'}`}>
          <span className="pill__label">{label}</span>
          <span className="pill__value-row">
            {suffix && <span className="pill__suffix">{suffix}</span>}
            <span className="pill__value">{displayValue}</span>
          </span>
        </div>
        {hasChev && <span className="pill__chev">▾</span>}
      </button>
      {open && (
        <div className="pill-popover">
          {children}
          {error && <p className="pill-popover__error">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function RunToolbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [strategies, setStrategies] = useState<string[]>(['CATS']);
  const [errors, setErrors] = useState<FormErrors>({});
  const [openPill, setOpenPill] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const isDistribution = location.pathname === '/distribution';
  const isCompare = location.pathname === '/session-compare';
  const isDistributionCompare = location.pathname === '/distribution-compare';
  const isStaticPage = location.pathname === '/strategies' || location.pathname === '/guide';

  const [form, setForm] = useState<FormState>(() => {
    const strategiesParts = searchParams.get('strategies')?.split(',').map(s => s.trim()) ?? [];
    return {
      strategyA: searchParams.get('strategy') ?? strategiesParts[0] ?? 'CATS',
      strategyB: searchParams.get('test') ?? strategiesParts[1] ?? 'ThreePointMolly3X',
      rolls: searchParams.get('rolls') ?? '500',
      bankroll: searchParams.get('bankroll') ?? '300',
      seed: searchParams.get('seed') ?? '',
      seeds: searchParams.get('seeds') ?? '500',
    };
  });

  useEffect(() => {
    fetch('/api/strategies')
      .then(res => res.json() as Promise<string[]>)
      .then(setStrategies)
      .catch(() => {/* keep default */});
  }, []);

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
    return errs;
  }

  function handleRun() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (errs.rolls) setOpenPill('rolls');
      else if (errs.bankroll) setOpenPill('bankroll');
      else if (errs.seed) setOpenPill('seed');
      return;
    }
    setErrors({});
    setOpenPill(null);
    const base = isStaticPage ? '/session' : location.pathname;
    const params = new URLSearchParams({
      rolls: form.rolls,
      bankroll: form.bankroll,
      ...(form.seed !== '' ? { seed: form.seed } : {}),
    });
    if (isCompare) {
      params.set('strategies', `${form.strategyA},${form.strategyB}`);
    } else if (isDistributionCompare) {
      params.set('strategy', form.strategyA);
      params.set('test', form.strategyB);
      params.set('seeds', form.seeds);
    } else {
      params.set('strategy', form.strategyA);
      if (isDistribution) params.set('seeds', form.seeds);
    }
    navigate(`${base}?${params.toString()}`);
  }

  function setField(name: keyof FormState, value: string) {
    setForm(f => ({ ...f, [name]: value }));
    if (name in errors) setErrors(e => ({ ...e, [name]: undefined }));
  }

  function togglePill(id: string) {
    setOpenPill(prev => (prev === id ? null : id));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { setOpenPill(null); return; }
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'SELECT') handleRun();
  }

  const showComparePills = isCompare || isDistributionCompare;
  const showSeedsPill = isDistribution || isDistributionCompare;

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
              open={openPill === 'baseline'}
              onToggle={togglePill}
            >
              <select
                value={form.strategyA}
                onChange={e => { setField('strategyA', e.target.value); setOpenPill(null); }}
                className="pill-popover__select"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              >
                {strategies.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Pill>

            <span className="runbar__vs">vs</span>

            <Pill
              id="test"
              label="Test"
              displayValue={form.strategyB}
              wide
              open={openPill === 'test'}
              onToggle={togglePill}
            >
              <select
                value={form.strategyB}
                onChange={e => { setField('strategyB', e.target.value); setOpenPill(null); }}
                className="pill-popover__select"
                autoFocus
              >
                {strategies.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Pill>
          </>
        ) : (
          <Pill
            id="strategy"
            label="Strategy"
            displayValue={form.strategyA}
            wide
            open={openPill === 'strategy'}
            onToggle={togglePill}
          >
            <select
              value={form.strategyA}
              onChange={e => { setField('strategyA', e.target.value); setOpenPill(null); }}
              className="pill-popover__select"
              autoFocus
            >
              {strategies.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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
            className="pill-popover__input"
            autoFocus
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
            className="pill-popover__input"
            autoFocus
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
              className="pill-popover__input"
              autoFocus
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
            className="pill-popover__input"
            autoFocus
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
