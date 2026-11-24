import React from 'react';
import {
  DIFFICULTIES,
  DifficultyId,
  SubLevelNumber,
  getLevelConfig,
  getLevelsForDifficulty,
  getRadarConfig,
} from '../game/levels';
import {
  PlayerProgress,
  isLevelCleared,
  isSubLevelUnlocked,
} from '../game/progression';
import { CoinIcon } from './TitleOverlay';

interface LevelSelectOverlayProps {
  progress: PlayerProgress;
  selectedDifficulty: DifficultyId;
  selectedSubLevel: SubLevelNumber;
  onSelectDifficulty: (difficulty: DifficultyId) => void;
  onSelectSubLevel: (subLevel: SubLevelNumber) => void;
  onLaunchMission: () => void;
  onBackToArmory: () => void;
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

export const LevelSelectOverlay: React.FC<LevelSelectOverlayProps> = ({
  progress,
  selectedDifficulty,
  selectedSubLevel,
  onSelectDifficulty,
  onSelectSubLevel,
  onLaunchMission,
  onBackToArmory,
}) => {
  const levels = getLevelsForDifficulty(selectedDifficulty);
  const activeLevel = getLevelConfig(selectedDifficulty, selectedSubLevel);
  const activeRadar = getRadarConfig(progress.selectedRadarId);
  const activeDiffInfo = DIFFICULTIES.find((d) => d.id === selectedDifficulty);

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-7 lg:p-10 overflow-y-auto pointer-events-none"
      aria-label="Difficulty and Level Selection"
    >
      {/* Top Bar: Back to Armory, Active Array, Coin Bank */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-3 pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onBackToArmory();
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0A101C]/92 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-display text-xs font-semibold tracking-wide transition-colors cursor-pointer"
        >
          <span aria-hidden="true">←</span>
          Back to Armory
        </button>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A101C]/92 border border-slate-800 font-mono-tabular text-xs text-slate-300">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: activeRadar.accentHex }}
            />
            <span>{activeRadar.name}</span>
          </div>

          <div
            data-testid="levels-coins"
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
      </div>

      {/* Centered Difficulty & Sub-level Panel */}
      <div className="w-full max-w-5xl mx-auto my-auto py-3 sm:py-4 pointer-events-auto">
        <div className="rounded-xl bg-[#0A101C]/94 border border-slate-800/95 p-4 sm:p-6 shadow-2xl space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <span className="font-mono-tabular text-[11px] font-semibold tracking-[0.16em] text-amber-400 uppercase">
                Step 2 of 2 · Mission Select
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight mt-0.5">
                Select Difficulty &amp; Sector
              </h2>
            </div>
            <p className="font-mono-tabular text-xs text-slate-400">
              {activeDiffInfo?.summary}
            </p>
          </div>

          {/* Difficulty Buttons */}
          <div className="space-y-3">
            <span className="block font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
              Difficulty Level
            </span>
            <div
              role="tablist"
              aria-label="Difficulty Mode"
              className="grid grid-cols-3 gap-2.5"
            >
              {DIFFICULTIES.map((diff) => {
                const active = diff.id === selectedDifficulty;
                return (
                  <button
                    key={diff.id}
                    type="button"
                    role="tab"
                    data-testid={`difficulty-${diff.id}`}
                    aria-selected={active}
                    onClick={() => onSelectDifficulty(diff.id)}
                    className={`px-4 py-3 rounded-lg font-display text-sm font-bold tracking-wide border transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-500 border-amber-400 text-slate-950'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    {diff.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5 Sub-levels for the selected difficulty */}
          <div className="space-y-3">
            <span className="block font-mono-tabular text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
              Sector Sub-Levels (1 – 5)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {levels.map((lvl) => {
                const unlocked = isSubLevelUnlocked(
                  progress,
                  lvl.difficulty,
                  lvl.subLevel
                );
                const cleared = isLevelCleared(
                  progress,
                  lvl.difficulty,
                  lvl.subLevel
                );
                const selected =
                  lvl.difficulty === selectedDifficulty &&
                  lvl.subLevel === selectedSubLevel;

                return (
                  <button
                    key={lvl.id}
                    type="button"
                    disabled={!unlocked}
                    data-testid={`level-${lvl.id}`}
                    aria-label={`${lvl.difficulty} level ${lvl.subLevel} ${lvl.name}${
                      !unlocked ? ' locked' : cleared ? ' cleared' : ''
                    }`}
                    onClick={() => onSelectSubLevel(lvl.subLevel)}
                    className={`text-left rounded-lg p-3 border transition-colors flex flex-col justify-between ${
                      !unlocked
                        ? 'bg-slate-950/60 border-slate-800/60 text-slate-500 cursor-not-allowed opacity-70'
                        : selected
                          ? 'bg-amber-500/12 border-amber-400 text-slate-100 cursor-pointer'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-600 text-slate-200 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-amber-400">
                          Level {lvl.subLevel}
                        </span>
                        {!unlocked ? (
                          <LockIcon className="w-3.5 h-3.5 text-slate-500" />
                        ) : cleared ? (
                          <span className="font-mono-tabular text-[10px] font-semibold uppercase text-emerald-400">
                            Cleared
                          </span>
                        ) : (
                          <span className="font-mono-tabular text-[10px] text-slate-400">
                            Open
                          </span>
                        )}
                      </div>
                      <div className="font-display text-sm font-bold leading-snug mb-1">
                        {lvl.name}
                      </div>
                      <p className="text-[11px] leading-snug text-slate-400 mb-2">
                        {lvl.subtitle}
                      </p>
                    </div>
                    <div>
                      <div className="font-mono-tabular text-[10px] text-slate-300 flex items-center justify-between gap-1 pt-1.5 border-t border-slate-800/70">
                        <span>
                          {lvl.roundDuration}s · {lvl.missiles}M · {lvl.hitsRequired}H
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-amber-300 font-semibold">
                          +{lvl.coinReward}
                        </span>
                      </div>
                      <div className="mt-1 font-mono-tabular text-[10px] text-slate-400">
                        {!unlocked
                          ? `Finish Lv ${lvl.subLevel - 1} to unlock`
                          : `Lock ≥ ${lvl.lockThreshold}%`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Launch Bar */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs font-mono-tabular text-slate-300 space-y-0.5">
              <div>
                Mission:{' '}
                <strong className="text-amber-300 uppercase">
                  {selectedDifficulty} Lv {selectedSubLevel}
                </strong>{' '}
                — {activeLevel.name}
              </div>
              <div>
                Array:{' '}
                <strong style={{ color: activeRadar.accentHex }}>
                  {activeRadar.name}
                </strong>{' '}
                · {activeLevel.roundDuration}s · {activeLevel.missiles} Missiles ·{' '}
                {activeLevel.hitsRequired} {activeLevel.hitsRequired === 1 ? 'Hit' : 'Hits'}
              </div>
            </div>

            <button
              type="button"
              data-launch="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onLaunchMission();
              }}
              className="px-7 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:translate-y-px text-slate-950 font-display font-bold text-sm sm:text-base tracking-wide transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 cursor-pointer whitespace-nowrap shrink-0"
            >
              Launch Mission
            </button>
          </div>
        </div>
      </div>

      {/* Bottom highlighted playing controls reminder */}
      <div className="w-full max-w-5xl mx-auto text-xs text-slate-300 font-mono-tabular pt-2">
        <div className="inline-flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-[#0A101C]/88 border border-amber-500/30 px-3.5 py-2">
          <span className="text-amber-400 font-bold uppercase">Controls:</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-400/50 text-amber-300 font-bold">
              ← / →
            </kbd>{' '}
            or{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-400/50 text-amber-300 font-bold">
              A / D
            </kbd>{' '}
            Rotate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-emerald-400/50 text-emerald-300 font-bold">
              SPACE
            </kbd>{' '}
            Fire Missile
          </span>
        </div>
      </div>
    </div>
  );
};
