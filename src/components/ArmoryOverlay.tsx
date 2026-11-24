import React from 'react';
import { RADARS, RadarId, getRadarConfig } from '../game/levels';
import { PlayerProgress, isRadarUnlocked } from '../game/progression';
import { CoinIcon } from './TitleOverlay';

interface ArmoryOverlayProps {
  progress: PlayerProgress;
  radarConfirmed: boolean;
  onSelectRadar: (radarId: RadarId) => void;
  onBuyRadar: (radarId: RadarId) => void;
  onNext: () => void;
  onBackToTitle: () => void;
}

const LockIcon: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const ArmoryOverlay: React.FC<ArmoryOverlayProps> = ({
  progress,
  radarConfirmed,
  onSelectRadar,
  onBuyRadar,
  onNext,
  onBackToTitle,
}) => {
  const activeRadar = getRadarConfig(progress.selectedRadarId);

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-7 lg:p-10 overflow-y-auto pointer-events-none"
      aria-label="Radar and Weapon Selection"
    >
      {/* Top Bar: Back to Title & Coin Bank */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between gap-4 pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onBackToTitle();
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0A101C]/92 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-display text-xs font-semibold tracking-wide transition-colors cursor-pointer"
        >
          <span aria-hidden="true">←</span>
          Back
        </button>

        <div
          data-testid="armory-coins"
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0A101C]/92 border border-slate-800 shadow-md"
        >
          <CoinIcon className="w-4 h-4 shrink-0" />
          <span className="font-mono-tabular text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Coins
          </span>
          <span className="font-mono-tabular text-base font-bold text-amber-300">
            {progress.coins}
          </span>
        </div>
      </div>

      {/* Centered Radar & Weapons Armory Panel */}
      <div className="w-full max-w-4xl mx-auto my-auto py-3 sm:py-4 pointer-events-auto">
        <div className="rounded-xl bg-[#0A101C]/94 border border-slate-800/95 p-4 sm:p-7 shadow-2xl space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.16em] text-amber-400 uppercase">
                Step 1 of 2 · Armory
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight mt-0.5">
                Select Radar &amp; Weapons
              </h2>
            </div>
            <p className="font-mono-tabular text-xs text-slate-400">
              Buy upgrades with earned coins or select an owned array.
            </p>
          </div>

          {/* Radar & Weapon Array Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {RADARS.map((radar) => {
              const unlocked = isRadarUnlocked(progress, radar.id);
              const selected =
                radarConfirmed && progress.selectedRadarId === radar.id;
              const isCurrentDefault =
                !radarConfirmed && progress.selectedRadarId === radar.id;
              const canAfford = progress.coins >= radar.cost;

              const sweepPct = Math.round((radar.rotationSpeedMult - 1) * 100);
              const conePct = Math.round((1 - radar.signalFalloffMult) * 100);
              const thrustPct = Math.round((radar.missileSpeedMult - 1) * 100);

              if (unlocked) {
                return (
                  <button
                    key={radar.id}
                    type="button"
                    data-testid={`radar-${radar.id}`}
                    aria-pressed={selected}
                    aria-label={
                      selected
                        ? `${radar.name} selected`
                        : `Select ${radar.name}`
                    }
                    onClick={() => onSelectRadar(radar.id)}
                    className={`text-left rounded-lg p-4 border transition-colors flex flex-col justify-between gap-2.5 cursor-pointer ${
                      selected
                        ? 'bg-emerald-500/10 border-emerald-400 text-slate-100'
                        : isCurrentDefault
                          ? 'bg-slate-900/90 border-amber-500/50 hover:border-amber-400 text-slate-100'
                          : 'bg-slate-900/75 border-slate-800 hover:border-slate-600 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: radar.accentHex }}
                        />
                        <span className="font-display text-base font-bold">
                          {radar.name}
                        </span>
                      </div>
                      <span
                        className={`font-mono-tabular text-[11px] font-bold uppercase ${
                          selected ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {selected ? 'Selected' : 'Select'}
                      </span>
                    </div>

                    <p className="text-xs leading-snug text-slate-300">
                      {radar.tagline}
                    </p>

                    <div className="font-mono-tabular text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span>Sweep {sweepPct >= 0 ? `+${sweepPct}%` : `${sweepPct}%`}</span>
                      <span>Beam +{conePct}%</span>
                      <span>Missile +{thrustPct}%</span>
                    </div>
                  </button>
                );
              }

              // Locked radar/weapon card — NEVER auto-unlocks; requires explicit Buy button click with enough coins
              return (
                <div
                  key={radar.id}
                  data-testid={`radar-${radar.id}`}
                  className="rounded-lg p-4 border bg-slate-950/75 border-slate-800/80 text-slate-300 flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 opacity-75"
                        style={{ backgroundColor: radar.accentHex }}
                      />
                      <span className="font-display text-base font-bold text-slate-200">
                        {radar.name}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 font-mono-tabular text-[11px] font-semibold text-slate-400 uppercase">
                      <LockIcon className="w-3.5 h-3.5" />
                      Locked
                    </span>
                  </div>

                  <p className="text-xs leading-snug text-slate-400">
                    {radar.tagline}
                  </p>

                  <div className="font-mono-tabular text-[11px] text-slate-500 flex items-center justify-between gap-2">
                    <span>Sweep +{sweepPct}%</span>
                    <span>Beam +{conePct}%</span>
                    <span>Missile +{thrustPct}%</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono-tabular text-xs font-bold text-amber-300">
                      <CoinIcon className="w-3.5 h-3.5" />
                      {radar.cost} Coins
                    </span>
                    <button
                      type="button"
                      disabled={!canAfford}
                      data-testid={`buy-radar-${radar.id}`}
                      aria-label={
                        canAfford
                          ? `Buy ${radar.name} for ${radar.cost} coins`
                          : `${radar.name} requires ${radar.cost} coins`
                      }
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onBuyRadar(radar.id);
                      }}
                      className={`px-3.5 py-1.5 rounded-md font-display text-xs font-bold tracking-wide transition-colors whitespace-nowrap ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? `Buy (${radar.cost})` : 'Need Coins'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Bar: Prompt before selection -> Next button appears after selection */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 min-h-[56px]">
            {radarConfirmed ? (
              <>
                <div className="text-xs font-mono-tabular text-slate-300">
                  Selected Array:{' '}
                  <strong style={{ color: activeRadar.accentHex }}>
                    {activeRadar.name}
                  </strong>{' '}
                  — ready for sector selection.
                </div>
                <button
                  type="button"
                  data-next="true"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onNext();
                  }}
                  className="px-7 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:translate-y-px text-slate-950 font-display font-bold text-sm sm:text-base tracking-wide transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Next →
                </button>
              </>
            ) : (
              <p className="m-0 font-mono-tabular text-xs text-amber-300/90">
                Click an owned radar &amp; weapon array above to select it and
                reveal the Next button.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="w-full max-w-4xl mx-auto text-xs text-slate-400 font-mono-tabular pt-2">
        <p className="m-0">
          Step 1: Choose or purchase a radar &amp; weapon array, then click
          Next.
        </p>
      </div>
    </div>
  );
};
