import { useState, useEffect } from 'react';
import type { EngineResult } from '@shared/simulation';

export interface SimParams {
  strategy: string;
  rolls: number;
  bankroll: number;
  seed?: number;
}

export interface SimulationState {
  data: EngineResult | null;
  loading: boolean;
  error: string | null;
}

export function useSimulation(params: SimParams): SimulationState {
  const [state, setState] = useState<SimulationState>({ data: null, loading: true, error: null });

  useEffect(() => {
    setState({ data: null, loading: true, error: null });

    fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(body => {
            throw new Error(body.error ?? `Server error: ${res.status}`);
          });
        }
        return res.json() as Promise<EngineResult>;
      })
      .then(data => setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setState({ data: null, loading: false, error: message });
      });
  }, [params.strategy, params.rolls, params.bankroll, params.seed]);

  return state;
}
