import { useState, useEffect } from 'react';
import type { DistributionAggregates } from '../../../types/simulation';
import type { RunManifest } from '@shared/manifest';

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
  /** Run identity for this stream (session-lifecycle.md v4 §5). */
  manifest: RunManifest | null;
  /** True when the server answered from its manifest-keyed memo. */
  cached: boolean;
}

export function useDistribution(params: DistributionParams): DistributionState {
  const [state, setState] = useState<DistributionState>({
    aggregates: null,
    progress: 0,
    done: false,
    error: null,
    manifest: null,
    cached: false,
  });

  useEffect(() => {
    setState({ aggregates: null, progress: 0, done: false, error: null, manifest: null, cached: false });

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
        manifest?: RunManifest;
        cached?: boolean;
      };
      setState({
        aggregates: data.aggregates,
        progress: data.progress,
        done: data.done,
        error: null,
        manifest: data.manifest ?? null,
        cached: data.cached ?? false,
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
