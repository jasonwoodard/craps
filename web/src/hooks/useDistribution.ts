import { useState, useEffect } from 'react';
import type { DistributionAggregates } from '../../../types/simulation';

export interface DistributionParams {
  strategy: string;
  seeds: number;
  rolls: number;
  bankroll: number;
}

export interface DistributionState {
  aggregates: DistributionAggregates | null;
  progress: number;
  done: boolean;
  error: string | null;
}

export function useDistribution(params: DistributionParams): DistributionState {
  const [state, setState] = useState<DistributionState>({
    aggregates: null,
    progress: 0,
    done: false,
    error: null,
  });

  useEffect(() => {
    setState({ aggregates: null, progress: 0, done: false, error: null });

    const query = new URLSearchParams({
      strategy: params.strategy,
      seeds: String(params.seeds),
      rolls: String(params.rolls),
      bankroll: String(params.bankroll),
    });

    const source = new EventSource(`/api/distribution/stream?${query.toString()}`);

    source.onmessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as {
        progress: number;
        aggregates: DistributionAggregates;
        done: boolean;
      };
      setState({
        aggregates: data.aggregates,
        progress: data.progress,
        done: data.done,
        error: null,
      });
      if (data.done) source.close();
    };

    source.onerror = () => {
      setState(prev => ({ ...prev, error: 'Connection error', done: true }));
      source.close();
    };

    return () => source.close();
  }, [params.strategy, params.seeds, params.rolls, params.bankroll]);

  return state;
}
