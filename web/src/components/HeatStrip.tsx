import { useRef, useEffect, useState } from 'react';
import type { RollRecord } from '@shared/simulation';
import { computeHeatScores } from '../lib/stats';

// Color fill for each clamped score bucket
const HEAT_COLORS: Record<number, string> = {
  2:  '#16a34a',  // green-600 — hot
  1:  '#86efac',  // green-300 — warm
  0:  '#e2e8f0',  // slate-200 — choppy
  [-1]: '#fca5a5',  // red-300 — cool
  [-2]: '#dc2626',  // red-600 — cold
};

const SCORE_LABELS: Record<number, string> = {
  2: 'Hot',
  1: 'Warm',
  0: 'Choppy',
  [-1]: 'Cool',
  [-2]: 'Cold',
};

// Left and right offsets approximating the Recharts ComposedChart Y-axis layout.
// SessionChart uses margin={{ left: 8, right: 40 }} with two Y-axes (~60px each).
// These values align the colored strip with the chart's data area visually.
const CHART_LEFT_OFFSET = 68;   // 8px margin + ~60px Y-axis
const CHART_RIGHT_OFFSET = 100; // 40px margin + ~60px right Y-axis

interface TooltipData {
  rollIndex: number;
  x: number;
  y: number;
}

interface HeatStripProps {
  rolls: RollRecord[];
  height?: number;      // default 18
  halfWindow?: number;  // default 4 → 9-roll max window
}

export function HeatStrip({ rolls, height = 18, halfWindow = 4 }: HeatStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scores = computeHeatScores(rolls, halfWindow);
  const n = rolls.length;

  // Width of the colored data region
  const dataWidth = Math.max(0, containerWidth - CHART_LEFT_OFFSET - CHART_RIGHT_OFFSET);
  const cellWidth = n > 0 ? dataWidth / n : 0;

  // Build tooltip content for hovered roll
  function buildTooltip(r: number) {
    const lo = Math.max(0, r - halfWindow);
    const hi = Math.min(n - 1, r + halfWindow);
    const windowSize = hi - lo + 1;
    const window = rolls.slice(lo, hi + 1);

    const events: string[] = [];
    for (const roll of window) {
      const isComeOut = roll.pointBefore == null;
      if (isComeOut) {
        if (roll.rollValue === 7 || roll.rollValue === 11) events.push('Natural');
        else if (roll.rollValue === 2 || roll.rollValue === 3 || roll.rollValue === 12) events.push('Craps');
      } else {
        if (roll.rollValue === roll.pointBefore) events.push('Point made');
        else if (roll.rollValue === 7) events.push('7-out');
      }
    }

    const score = scores[r];
    const label = SCORE_LABELS[score] ?? '';
    const uniqueEvents = [...new Set(events)];

    return {
      rollRange: `Rolls ${lo + 1}–${hi + 1}  (window: ${windowSize})`,
      events: uniqueEvents.length > 0 ? uniqueEvents.join(' · ') : 'No resolutions',
      score: `Score: ${score >= 0 ? '+' : ''}${score}  ${label}`,
    };
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (n === 0 || cellWidth === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xInData = e.clientX - rect.left - CHART_LEFT_OFFSET;
    const rollIndex = Math.min(n - 1, Math.max(0, Math.floor(xInData / cellWidth)));
    setTooltip({ rollIndex, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  const tooltipData = tooltip != null ? buildTooltip(tooltip.rollIndex) : null;

  return (
    <div className="bg-white border border-gray-200 rounded px-4 pt-3 pb-2">
      <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wide mb-2">Shooter Heat</h2>
      <div ref={containerRef} className="relative w-full">
        {containerWidth > 0 && (
          <svg
            width={containerWidth}
            height={height}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'crosshair', display: 'block' }}
          >
            {scores.map((score, i) => (
              <rect
                key={i}
                x={CHART_LEFT_OFFSET + i * cellWidth}
                y={0}
                width={Math.ceil(cellWidth)}
                height={height}
                fill={HEAT_COLORS[score] ?? HEAT_COLORS[0]}
              />
            ))}
          </svg>
        )}
        {tooltip != null && tooltipData != null && (
          <div
            className="absolute z-10 bg-gray-900 text-white text-xs font-mono rounded px-2 py-1 pointer-events-none whitespace-nowrap"
            style={{
              left: Math.min(tooltip.x + 10, containerWidth - 220),
              top: height + 4,
            }}
          >
            <div>{tooltipData.rollRange}</div>
            <div className="text-gray-300">{tooltipData.events}</div>
            <div>{tooltipData.score}</div>
          </div>
        )}
      </div>
    </div>
  );
}
