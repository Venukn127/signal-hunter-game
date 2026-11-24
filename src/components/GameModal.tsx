import React from 'react';
import { DifficultyId, SubLevelNumber, getNextLevel } from '../game/levels';
import { GamePhase, RunSnapshot } from '../game/types';
import { CoinIcon } from './TitleOverlay';

interface GameModalProps {
  phase: GamePhase;
  snapshot: RunSnapshot | null;
  difficulty: DifficultyId;
  subLevel: SubLevelNumber;
  currentTimeLeft: number;
  currentMissiles: number;
  maxMissiles: number;
  currentSignal: number;
  lockThreshold: number;
  coinsEarned: number;
  totalCoins: number;
  newlyUnlockedSubLevel: SubLevelNumber | null;
  onResume: () => void;
  onNextLevel: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export const GameModal: React.FC<GameModalProps> = ({
  phase,
  snapshot,
  difficulty,
  subLevel,
  currentTimeLeft,
  currentMissiles,
  maxMissiles,
  currentSignal,
  lockThreshold,
  coinsEarned,
  totalCoins,
  newlyUnlockedSubLevel,
  onResume,
  onNextLevel,
  onRestart,
  onTitle,
}) => {
  if (phase !== 'paused' && phase !== 'gameover') {
    return null;
  }

  const isPaused = phase === 'paused';
  const isWin = phase === 'gameover' && snapshot?.outcome === 'win';
  const nextTarget = isWin ? getNextLevel(difficulty, subLevel) : null;

  const heading = isPaused
    ? 'Hunt Paused'
    : isWin
      ? 'YOU WIN! SIGNAL DESTROYED'
      : 'YOU LOSE. SHIP DESTROYED';

  const subtitle = isPaused
    ? 'Radar sweep suspended. Resume when ready.'
    : isWin
      ? `Target eliminated in ${difficulty.toUpperCase()} Level ${subLevel}${
          newlyUnlockedSubLevel
            ? ` — Level ${newlyUnlockedSubLevel} unlocked!`
            : '.'
        }`
      : snapshot?.lossReason === 'missiles'
        ? 'All missiles missed — the opponent locked on and destroyed your ship.'
        : 'The countdown window expired — the opponent dropped cloak and destroyed your ship.';

  const timeDisplay = isPaused ? currentTimeLeft : (snapshot?.timeRemaining ?? 0);
  const missilesDisplay = isPaused
    ? currentMissiles
    : (snapshot?.missilesLeft ?? 0);
  const maxMissilesDisplay = isPaused
    ? maxMissiles
    : (snapshot?.maxMissiles ?? maxMissiles);
  const peakSignalDisplay = isPaused
    ? currentSignal
    : (snapshot?.peakSignal ?? 0);
  const thresholdDisplay = isPaused
    ? lockThreshold
    : (snapshot?.lockThreshold ?? lockThreshold);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-5 bg-[#05080F]/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-[#0D1524] border border-slate-700/80 p-6 sm:p-8 shadow-2xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={`font-mono-tabular text-xs font-semibold tracking-[0.16em] uppercase ${
              isPaused
                ? 'text-amber-400'
                : isWin
                  ? 'text-emerald-400'
                  : 'text-red-400'
            }`}
          >
            {isPaused
              ? 'Standby'
              : isWin
                ? 'Mission Complete'
                : 'Signal Lost'}
          </span>
          <span className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {difficulty} · Lv {subLevel}
          </span>
        </div>

        <h2
          id="game-modal-title"
          className="font-display text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight mb-2"
        >
          {heading}
        </h2>

        <p className="text-slate-300 text-sm leading-relaxed mb-5">{subtitle}</p>

        {/* Coin reward callout on Victory */}
        {isWin && coinsEarned > 0 && (
          <div
            data-testid="modal-coin-reward"
            className="mb-5 flex items-center justify-between px-4 py-2.5 rounded-lg bg-amber-500/12 border border-amber-500/40"
          >
            <div className="flex items-center gap-2">
              <CoinIcon className="w-4 h-4 shrink-0" />
              <span className="font-display text-sm font-bold text-amber-300">
                +{coinsEarned} Coins Earned
              </span>
            </div>
            <span className="font-mono-tabular text-xs font-semibold text-slate-300">
              Bank: {totalCoins}
            </span>
          </div>
        )}

        {/* 3 tabular-nums telemetry tiles */}
        <div className="grid grid-cols-3 gap-3 mb-7">
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-3 text-center">
            <div className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">
              Time Left
            </div>
            <div className="font-mono-tabular text-xl font-bold text-slate-100">
              {timeDisplay}s
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-3 text-center">
            <div className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">
              Missiles
            </div>
            <div className="font-mono-tabular text-xl font-bold text-slate-100">
              {missilesDisplay}/{maxMissilesDisplay}
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-3 text-center">
            <div className="font-mono-tabular text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">
              {isPaused ? 'Signal' : 'Peak Signal'}
            </div>
            <div
              className={`font-mono-tabular text-xl font-bold ${
                peakSignalDisplay >= thresholdDisplay
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {peakSignalDisplay}%
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {isPaused ? (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onResume();
              }}
              className="flex-1 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              Resume
            </button>
          ) : isWin && nextTarget ? (
            <>
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onNextLevel();
                }}
                className="flex-1 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                Next Level
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestart();
                }}
                className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-display font-semibold text-sm transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                Replay
              </button>
            </>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="flex-1 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              {isWin ? 'Play Again' : 'Try Again'}
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-display font-semibold text-sm transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              Restart
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTitle();
            }}
            className="px-4 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-display font-semibold text-sm transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            Armory
          </button>
        </div>

        <p className="mt-4 text-center font-mono-tabular text-xs text-slate-400">
          {isPaused
            ? 'Esc or P to Resume · R to Restart'
            : isWin && nextTarget
              ? 'Press Enter for Next Level · R to Replay'
              : 'Press R or Enter to Play Again'}
        </p>
      </div>
    </div>
  );
};
