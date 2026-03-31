import { useState, useEffect } from 'react';
import type { DistributionAggregates } from '../../../types/simulation';

export interface DistributionCompareParams {
  strategy: string;
  test: string;
  seeds: number;
  rolls: number;
  bankroll: number;
}

export interface DistributionCompareState {
  baseline: DistributionAggregates | null;
  test: DistributionAggregates | null;
  progress: number;
  done: boolean;
  error: string | null;
}

export function useDistributionCompare(params: DistributionCompareParams): DistributionCompareState {
  const [state, setState] = useState<DistributionCompareState>({
    baseline: null,
    test: null,
    progress: 0,
    done: false,
    error: null,
  });

  useEffect(() => {
    setState({ baseline: null, test: null, progress: 0, done: false, error: null });

    const query = new URLSearchParams({
      strategy: params.strategy,
      test: params.test,
      seeds: String(params.seeds),
      rolls: String(params.rolls),
      bankroll: String(params.bankroll),
    });

    const source = new EventSource(`/api/distribution-compare/stream?${query.toString()}`);

    source.onmessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as {
        progress: number;
        baseline: DistributionAggregates;
        test: DistributionAggregates;
        done: boolean;
      };
      setState({
        baseline: data.baseline,
        test: data.test,
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
  }, [params.strategy, params.test, params.seeds, params.rolls, params.bankroll]);

  return state;
}
