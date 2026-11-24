import React from 'react';
import { RadarId, getRadarConfig } from '../game/levels';

interface TitleOverlayProps {
  selectedRadarId: RadarId;
  onEnterHangar: () => void;
}

export const CoinIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <circle
      cx="12"
      cy="12"
      r="9.5"
      fill="#F59E0B"
      stroke="#FDE68A"
      strokeWidth="1.6"
    />
    <circle cx="12" cy="12" r="5.5" stroke="#92400E" strokeWidth="1.4" />
    <path
      d="M12 8.5V15.5"
      stroke="#78350F"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  selectedRadarId,
  onEnterHangar,
}) => {
  const activeRadar = getRadarConfig(selectedRadarId);

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 md:p-14 pointer-events-none"
      aria-label="Signal Hunter Title Screen"
    >
      {/* Top spacer for clean negative-space framing */}
      <div className="h-2" />

      {/* Primary left-anchored focal lockup over calm cosmic negative space */}
      <div className="max-w-xl pointer-events-auto">
        <div className="mb-5 flex items-center gap-3">
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle
              cx="22"
              cy="22"
              r="19"
              stroke="#1E293B"
              strokeWidth="2"
              fill="#0A101C"
            />
            <circle
              cx="22"
              cy="22"
              r="13"
              stroke={activeRadar.accentHex}
              strokeOpacity="0.55"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <path
              d="M22 22 L34 10"
              stroke={activeRadar.accentHex}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="29" cy="15" r="2.5" fill={activeRadar.lockHex} />
            <circle cx="22" cy="22" r="2.5" fill="#FDE68A" />
          </svg>
          <span className="font-mono-tabular text-xs font-semibold tracking-[0.18em] text-amber-400 uppercase">
            Orbital Intercept
          </span>
        </div>

        {/* Bespoke inline SVG title lockup */}
        <h1 className="sr-only">Signal Hunter</h1>
        <svg
          viewBox="0 0 460 112"
          className="w-full max-w-[440px] h-auto mb-5"
          role="img"
          aria-label="Signal Hunter"
        >
          <text
            x="0"
            y="48"
            fill="#F8FAFC"
            fontFamily="Outfit, sans-serif"
            fontWeight="800"
            fontSize="48"
            letterSpacing="2"
          >
            SIGNAL
          </text>
          <text
            x="0"
            y="98"
            fill="#F59E0B"
            fontFamily="Outfit, sans-serif"
            fontWeight="800"
            fontSize="48"
            letterSpacing="2"
          >
            HUNTER
          </text>
          <line
            x1="218"
            y1="82"
            x2="340"
            y2="82"
            stroke="#334155"
            strokeWidth="2"
          />
          <circle cx="348" cy="82" r="4" fill={activeRadar.lockHex} />
        </svg>

        <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-md mb-8">
          Rotate your center radar 360° to expose the cloaked alien craft. Lock
          the signal and fire from center before time runs out—or it will
          destroy your ship.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onEnterHangar();
            }}
            className="px-7 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:translate-y-px text-slate-950 font-display font-bold text-base tracking-wide transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 cursor-pointer whitespace-nowrap shrink-0"
          >
            Start Hunt
          </button>
        </div>
      </div>

      {/* Highlighted Playing Instructions & Control Keys */}
      <div
        data-testid="title-controls-guide"
        className="w-fit max-w-full rounded-xl bg-[#0A101C]/90 border border-amber-500/40 px-4 py-3 shadow-lg pointer-events-auto"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm font-mono-tabular text-slate-200">
          <span className="font-bold uppercase tracking-wider text-amber-400">
            How to Play
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-amber-400/60 text-amber-300 font-bold">
              ← / →
            </kbd>
            <span className="text-slate-400">or</span>
            <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-amber-400/60 text-amber-300 font-bold">
              A / D
            </kbd>
            <span className="text-slate-100 font-semibold">Rotate Radar</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-emerald-400/60 text-emerald-300 font-bold">
              SPACE
            </kbd>
            <span className="text-slate-100 font-semibold">
              Lock &amp; Fire Missile
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-200 font-bold">
              P
            </kbd>
            <span className="text-slate-300">Pause</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-200 font-bold">
              M
            </kbd>
            <span className="text-slate-300">Mute</span>
          </span>
        </div>
      </div>
    </div>
  );
};
