import { useState } from 'react';

interface InfoTipProps {
  text: string;
}

export function InfoTip({ text }: InfoTipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex items-center ml-1.5" style={{ verticalAlign: 'middle' }}>
      <button
        type="button"
        className={`text-slate-400 hover:text-slate-600 transition-colors leading-none cursor-help select-none ${visible ? 'text-slate-600' : ''}`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        aria-label="More information"
      >
        ⓘ
      </button>
      {visible && (
        <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-900 text-white text-xs font-mono font-normal rounded px-2.5 py-2 pointer-events-none leading-relaxed shadow-lg normal-case tracking-normal">
          {text}
        </span>
      )}
    </span>
  );
}
