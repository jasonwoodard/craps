import { useState, useEffect } from 'react';
import type { SharedTableResult } from '@shared/simulation';

export interface CompareParams {
  strategies: [string, string];
  rolls: number;
  bankroll: number;
  seed?: number;
}

export interface ComparisonState {
  data: { results: SharedTableResult; seed: number } | null;
  loading: boolean;
  error: string | null;
}

export function useComparison(params: CompareParams): ComparisonState {
  const [state, setState] = useState<ComparisonState>({ data: null, loading: true, error: null });

  useEffect(() => {
    setState({ data: null, loading: true, error: null });

    fetch('/api/session-compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then((body: { error?: string }) => {
            throw new Error(body.error ?? `Server error: ${res.status}`);
          });
        }
        return res.json() as Promise<{ results: SharedTableResult; seed: number }>;
      })
      .then(data => setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setState({ data: null, loading: false, error: message });
      });
  }, [params.strategies[0], params.strategies[1], params.rolls, params.bankroll, params.seed]);

  return state;
}
