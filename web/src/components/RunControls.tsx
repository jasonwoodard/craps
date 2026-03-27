import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface FormState {
  strategy: string;
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

export function RunControls() {
  const navigate = useNavigate();
  const location = useLocation();
  const [strategies, setStrategies] = useState<string[]>(['CATS']);
  const [form, setForm] = useState<FormState>({
    strategy: 'CATS',
    rolls: '500',
    bankroll: '300',
    seed: '',
    seeds: '500',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const isDistribution = location.pathname === '/distribution';

  useEffect(() => {
    fetch('/api/strategies')
      .then(res => res.json() as Promise<string[]>)
      .then(setStrategies)
      .catch(() => {/* keep default */});
  }, []);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    const rolls = Number(form.rolls);
    if (!form.rolls || !Number.isInteger(rolls) || rolls <= 0) {
      errs.rolls = 'Must be a positive integer';
    }
    const bankroll = Number(form.bankroll);
    if (!form.bankroll || !Number.isInteger(bankroll) || bankroll <= 0) {
      errs.bankroll = 'Must be a positive integer';
    }
    if (form.seed !== '') {
      const seed = Number(form.seed);
      if (!Number.isInteger(seed)) errs.seed = 'Must be an integer';
    }
    return errs;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    const base = location.pathname;
    const params = new URLSearchParams({
      strategy: form.strategy,
      rolls: form.rolls,
      bankroll: form.bankroll,
      ...(form.seed !== '' ? { seed: form.seed } : {}),
      ...(isDistribution ? { seeds: form.seeds } : {}),
    });
    navigate(`${base}?${params.toString()}`);
  }

  function setField(name: keyof FormState, value: string) {
    setForm(f => ({ ...f, [name]: value }));
    if (name in errors) {
      setErrors(e => ({ ...e, [name]: undefined }));
    }
  }

  const inputClass =
    'w-full bg-gray-700 text-white rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-400 font-mono text-sm';
  const labelClass = 'block text-gray-300 text-xs mb-1';
  const errorClass = 'text-red-400 text-xs mt-1';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-3">
      <div>
        <label className={labelClass}>Strategy</label>
        <select
          value={form.strategy}
          onChange={e => setField('strategy', e.target.value)}
          className={inputClass}
        >
          {strategies.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Rolls</label>
        <input
          type="number"
          value={form.rolls}
          onChange={e => setField('rolls', e.target.value)}
          className={inputClass}
        />
        {errors.rolls && <p className={errorClass}>{errors.rolls}</p>}
      </div>

      <div>
        <label className={labelClass}>Bankroll</label>
        <input
          type="number"
          value={form.bankroll}
          onChange={e => setField('bankroll', e.target.value)}
          className={inputClass}
        />
        {errors.bankroll && <p className={errorClass}>{errors.bankroll}</p>}
      </div>

      <div>
        <label className={labelClass}>
          Seed <span className="text-gray-500">(optional)</span>
        </label>
        <input
          type="number"
          value={form.seed}
          onChange={e => setField('seed', e.target.value)}
          placeholder="random"
          className={`${inputClass} placeholder-gray-500`}
        />
        {errors.seed && <p className={errorClass}>{errors.seed}</p>}
      </div>

      {isDistribution && (
        <div>
          <label className={labelClass}>Seeds</label>
          <input
            type="number"
            value={form.seeds}
            onChange={e => setField('seeds', e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <button
        type="submit"
        className="mt-1 bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-2 font-mono text-sm transition-colors"
      >
        Run
      </button>
    </form>
  );
}
