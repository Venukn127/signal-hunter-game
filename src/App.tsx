import { useCallback, useEffect, useRef, useState } from 'react';
import { ArmoryOverlay } from './components/ArmoryOverlay';
import { GameHud, HudSnapshot } from './components/GameHud';
import { GameModal } from './components/GameModal';
import { LevelSelectOverlay } from './components/LevelSelectOverlay';
import { TitleOverlay } from './components/TitleOverlay';
import { SoundEngine } from './game/audio';
import {
  computeShakeOffset,
  createInitialState,
  startRun,
  stepSimulation,
} from './game/engine';
import {
  DifficultyId,
  RadarId,
  SubLevelNumber,
  getLevelConfig,
  getNextLevel,
  getRadarConfig,
} from './game/levels';
import {
  PlayerProgress,
  buyRadar,
  equipRadar,
  isSubLevelUnlocked,
  loadProgress,
  recordLevelWin,
  saveProgress,
} from './game/progression';
import { GameRenderer } from './game/renderer';
import { GamePhase, GameState, RunSnapshot } from './game/types';

function shouldAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1';
}

function toHudSnapshot(state: GameState): HudSnapshot {
  const sig = Math.round(state.signal);
  return {
    signal: sig,
    timeLeft: Math.max(0, Math.round(state.timeLeft)),
    missiles: state.missiles,
    maxMissiles: state.maxMissiles,
    enemyHp: state.enemyHp,
    enemyMaxHp: state.enemyMaxHp,
    lockThreshold: state.levelConfig.lockThreshold,
    difficulty: state.difficulty,
    subLevel: state.subLevel,
    radarAccentHex: state.radarConfig.accentHex,
    shotActive: state.missile.active,
    locked: sig >= state.levelConfig.lockThreshold,
  };
}

export default function App() {
  const initialAutostart = shouldAutostart();
  const initialProgress = loadProgress();
  const initialDifficulty: DifficultyId = 'easy';
  const initialSubLevel: SubLevelNumber = 1;

  const progressRef = useRef<PlayerProgress>(initialProgress);
  const selectionRef = useRef<{
    difficulty: DifficultyId;
    subLevel: SubLevelNumber;
    radarId: RadarId;
  }>({
    difficulty: initialDifficulty,
    subLevel: initialSubLevel,
    radarId: initialProgress.selectedRadarId,
  });

  const stateRef = useRef<GameState>(
    initialAutostart
      ? startRun(null, Math.random, {
          difficulty: initialDifficulty,
          subLevel: initialSubLevel,
          radarId: initialProgress.selectedRadarId,
        })
      : createInitialState(Math.random, false, {
          difficulty: initialDifficulty,
          subLevel: initialSubLevel,
          radarId: initialProgress.selectedRadarId,
        })
  );

  const rendererRef = useRef<GameRenderer>(new GameRenderer());
  const audioRef = useRef<SoundEngine>(new SoundEngine());

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const damageFlashRef = useRef<HTMLDivElement | null>(null);
  const signalFillRef = useRef<HTMLDivElement | null>(null);

  const keysHeldRef = useRef<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });
  const touchHeldRef = useRef<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });
  const fireQueuedRef = useRef<boolean>(false);

  const [progress, setProgress] = useState<PlayerProgress>(initialProgress);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<DifficultyId>(initialDifficulty);
  const [selectedSubLevel, setSelectedSubLevel] =
    useState<SubLevelNumber>(initialSubLevel);
  const [phase, setPhase] = useState<GamePhase>(stateRef.current.phase);
  const [hud, setHud] = useState<HudSnapshot>(() =>
    toHudSnapshot(stateRef.current)
  );
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(
    stateRef.current.lastSnapshot
  );
  const [lastCoinsEarned, setLastCoinsEarned] = useState<number>(0);
  const [newlyUnlockedSubLevel, setNewlyUnlockedSubLevel] =
    useState<SubLevelNumber | null>(null);
  const [radarConfirmed, setRadarConfirmed] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // Sync body[data-state] and tactical gameplay music with current phase & mute
  useEffect(() => {
    document.body.dataset.state = phase;
    audioRef.current.syncMusic(phase === 'playing' && !muted);
  }, [phase, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio.stopMusic();
    };
  }, []);

  const clearInputs = useCallback(() => {
    keysHeldRef.current.left = false;
    keysHeldRef.current.right = false;
    touchHeldRef.current.left = false;
    touchHeldRef.current.right = false;
    fireQueuedRef.current = false;
  }, []);

  const syncHudFromState = useCallback((state: GameState) => {
    const next = toHudSnapshot(state);
    setHud((prev) => {
      if (
        prev.signal === next.signal &&
        prev.timeLeft === next.timeLeft &&
        prev.missiles === next.missiles &&
        prev.maxMissiles === next.maxMissiles &&
        prev.enemyHp === next.enemyHp &&
        prev.enemyMaxHp === next.enemyMaxHp &&
        prev.lockThreshold === next.lockThreshold &&
        prev.difficulty === next.difficulty &&
        prev.subLevel === next.subLevel &&
        prev.radarAccentHex === next.radarAccentHex &&
        prev.shotActive === next.shotActive &&
        prev.locked === next.locked
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const launchLevel = useCallback(
    (difficulty: DifficultyId, subLevel: SubLevelNumber, radarId: RadarId) => {
      audioRef.current.unlock();
      clearInputs();
      rendererRef.current.clearParticles();

      selectionRef.current = { difficulty, subLevel, radarId };
      setSelectedDifficulty(difficulty);
      setSelectedSubLevel(subLevel);
      setLastCoinsEarned(0);
      setNewlyUnlockedSubLevel(null);

      const nextState = startRun(stateRef.current, Math.random, {
        difficulty,
        subLevel,
        radarId,
      });
      stateRef.current = nextState;

      document.body.dataset.state = 'playing';
      setSnapshot(null);
      setPhase('playing');
      syncHudFromState(nextState);

      if (signalFillRef.current) {
        signalFillRef.current.style.transform = `scaleX(${
          nextState.signal <= 0 ? 0 : Math.max(0.02, nextState.signal / 100)
        })`;
      }
      canvasRef.current?.focus();
    },
    [clearInputs, syncHudFromState]
  );

  const handleStartOrRestart = useCallback(() => {
    const sel = selectionRef.current;
    launchLevel(sel.difficulty, sel.subLevel, progressRef.current.selectedRadarId);
  }, [launchLevel]);

  const handleNextLevel = useCallback(() => {
    const sel = selectionRef.current;
    const next = getNextLevel(sel.difficulty, sel.subLevel);
    if (!next) {
      handleStartOrRestart();
      return;
    }
    if (!isSubLevelUnlocked(progressRef.current, next.difficulty, next.subLevel)) {
      handleStartOrRestart();
      return;
    }
    launchLevel(
      next.difficulty,
      next.subLevel,
      progressRef.current.selectedRadarId
    );
  }, [handleStartOrRestart, launchLevel]);

  const handleSelectDifficulty = useCallback((difficulty: DifficultyId) => {
    const highest = progressRef.current.unlockedSubLevels[difficulty] ?? 1;
    const clampedSub: SubLevelNumber =
      selectionRef.current.subLevel <= highest
        ? selectionRef.current.subLevel
        : 1;
    selectionRef.current = {
      ...selectionRef.current,
      difficulty,
      subLevel: clampedSub,
    };
    stateRef.current.difficulty = difficulty;
    stateRef.current.subLevel = clampedSub;
    stateRef.current.levelConfig = getLevelConfig(difficulty, clampedSub);
    setSelectedDifficulty(difficulty);
    setSelectedSubLevel(clampedSub);
  }, []);

  const handleSelectSubLevel = useCallback((subLevel: SubLevelNumber) => {
    const diff = selectionRef.current.difficulty;
    if (!isSubLevelUnlocked(progressRef.current, diff, subLevel)) {
      return;
    }
    selectionRef.current = {
      ...selectionRef.current,
      subLevel,
    };
    stateRef.current.subLevel = subLevel;
    stateRef.current.levelConfig = getLevelConfig(diff, subLevel);
    setSelectedSubLevel(subLevel);
  }, []);

  const handleSelectRadar = useCallback((radarId: RadarId) => {
    audioRef.current.unlock();
    const nextProgress = equipRadar(progressRef.current, radarId);
    if (nextProgress.selectedRadarId !== radarId) {
      return;
    }
    if (nextProgress !== progressRef.current) {
      progressRef.current = nextProgress;
      saveProgress(nextProgress);
      setProgress(nextProgress);
    }
    setRadarConfirmed(true);
    selectionRef.current = {
      ...selectionRef.current,
      radarId: nextProgress.selectedRadarId,
    };
    stateRef.current.radarConfig = getRadarConfig(nextProgress.selectedRadarId);
  }, []);

  const handleBuyRadar = useCallback((radarId: RadarId) => {
    audioRef.current.unlock();
    const { nextProgress, purchased } = buyRadar(progressRef.current, radarId);
    if (!purchased) {
      return;
    }
    audioRef.current.playLockAcquired();
    progressRef.current = nextProgress;
    saveProgress(nextProgress);
    setProgress(nextProgress);
    setRadarConfirmed(true);

    selectionRef.current = {
      ...selectionRef.current,
      radarId: nextProgress.selectedRadarId,
    };
    stateRef.current.radarConfig = getRadarConfig(nextProgress.selectedRadarId);
  }, []);

  const handleTogglePause = useCallback(() => {
    const current = stateRef.current;
    if (
      current.phase === 'playing' &&
      current.pendingWinRemaining === null &&
      current.enemyStrike === null
    ) {
      clearInputs();
      current.phase = 'paused';
      document.body.dataset.state = 'paused';
      setPhase('paused');
      syncHudFromState(current);
    } else if (current.phase === 'paused') {
      clearInputs();
      current.phase = 'playing';
      document.body.dataset.state = 'playing';
      setPhase('playing');
      canvasRef.current?.focus();
    }
  }, [clearInputs, syncHudFromState]);

  const handleEnterArmory = useCallback(
    (preserveConfirmation = false) => {
      audioRef.current.unlock();
      clearInputs();
      rendererRef.current.clearParticles();
      const sel = selectionRef.current;
      const armoryState = createInitialState(Math.random, false, {
        difficulty: sel.difficulty,
        subLevel: sel.subLevel,
        radarId: progressRef.current.selectedRadarId,
      });
      armoryState.phase = 'armory';
      stateRef.current = armoryState;
      document.body.dataset.state = 'armory';
      setSnapshot(null);
      setLastCoinsEarned(0);
      setNewlyUnlockedSubLevel(null);
      setRadarConfirmed(preserveConfirmation);
      setPhase('armory');
      syncHudFromState(armoryState);
    },
    [clearInputs, syncHudFromState]
  );

  const handleGoToLevels = useCallback(() => {
    audioRef.current.unlock();
    clearInputs();
    const sel = selectionRef.current;
    const levelsState = createInitialState(Math.random, false, {
      difficulty: sel.difficulty,
      subLevel: sel.subLevel,
      radarId: progressRef.current.selectedRadarId,
    });
    levelsState.phase = 'levels';
    stateRef.current = levelsState;
    document.body.dataset.state = 'levels';
    setPhase('levels');
    syncHudFromState(levelsState);
  }, [clearInputs, syncHudFromState]);

  const handleReturnToTitle = useCallback(() => {
    clearInputs();
    rendererRef.current.clearParticles();
    const sel = selectionRef.current;
    const titleState = createInitialState(Math.random, false, {
      difficulty: sel.difficulty,
      subLevel: sel.subLevel,
      radarId: progressRef.current.selectedRadarId,
    });
    stateRef.current = titleState;
    document.body.dataset.state = 'title';
    setSnapshot(null);
    setLastCoinsEarned(0);
    setNewlyUnlockedSubLevel(null);
    setRadarConfirmed(false);
    setPhase('title');
    syncHudFromState(titleState);
  }, [clearInputs, syncHudFromState]);

  const handleToggleMute = useCallback(() => {
    audioRef.current.unlock();
    const nextMuted = audioRef.current.toggleMute();
    setMuted(nextMuted);
  }, []);

  // Keyboard & window focus listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const current = stateRef.current;

      if (
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }

      if (code === 'KeyM' && !e.repeat) {
        handleToggleMute();
        return;
      }

      if (current.phase === 'title') {
        if ((code === 'Enter' || code === 'Space') && !e.repeat) {
          handleEnterArmory(false);
        }
        return;
      }

      if (current.phase === 'armory') {
        if (code === 'Escape' && !e.repeat) {
          handleReturnToTitle();
        }
        return;
      }

      if (current.phase === 'levels') {
        if (code === 'Enter' && !e.repeat) {
          handleStartOrRestart();
        } else if (code === 'Escape' && !e.repeat) {
          handleEnterArmory(true);
        }
        return;
      }

      if (current.phase === 'gameover') {
        if (code === 'KeyR' && !e.repeat) {
          handleStartOrRestart();
          return;
        }
        if (code === 'Enter' && !e.repeat) {
          if (current.outcome === 'win') {
            handleNextLevel();
          } else {
            handleStartOrRestart();
          }
        }
        return;
      }

      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        handleTogglePause();
        return;
      }

      if (code === 'KeyR' && !e.repeat) {
        handleStartOrRestart();
        return;
      }

      if (current.phase !== 'playing') {
        return;
      }

      if (code === 'ArrowLeft' || code === 'KeyA') {
        audioRef.current.unlock();
        keysHeldRef.current.left = true;
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        audioRef.current.unlock();
        keysHeldRef.current.right = true;
      } else if (code === 'Space' && !e.repeat) {
        audioRef.current.unlock();
        fireQueuedRef.current = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') {
        keysHeldRef.current.left = false;
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        keysHeldRef.current.right = false;
      }
    };

    const onBlur = () => {
      clearInputs();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearInputs();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [
    clearInputs,
    handleEnterArmory,
    handleNextLevel,
    handleReturnToTitle,
    handleStartOrRestart,
    handleToggleMute,
    handleTogglePause,
  ]);

  // Isolated 60fps Canvas & Simulation loop
  useEffect(() => {
    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let viewportW = container.clientWidth || window.innerWidth;
    let viewportH = container.clientHeight || window.innerHeight;
    let needsRender = true;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      viewportW = Math.max(1, Math.floor(rect.width));
      viewportH = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(viewportW * dpr);
      canvas.height = Math.floor(viewportH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      needsRender = true;
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    let rafId = 0;
    let lastTime = performance.now();
    let titleRenderAccum = 0;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      const state = stateRef.current;
      const prevPhase = state.phase;

      // Consume edge-triggered fire input
      const fireJustPressed = fireQueuedRef.current;
      fireQueuedRef.current = false;

      const events = stepSimulation(state, dt, {
        left: keysHeldRef.current.left || touchHeldRef.current.left,
        right: keysHeldRef.current.right || touchHeldRef.current.right,
        fireJustPressed,
      });

      // Handle simulation events (particles + procedural Web Audio synth)
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        switch (ev.type) {
          case 'lock_acquired':
            audioRef.current.playLockAcquired();
            break;
          case 'missile_fired':
            audioRef.current.playMissileFire();
            if (ev.x !== undefined && ev.y !== undefined) {
              rendererRef.current.spawnBurst(
                ev.x,
                ev.y,
                10,
                [245, 158, 11],
                35,
                95,
                0.16,
                0.32,
                1.6,
                3.2
              );
              rendererRef.current.spawnBurst(
                ev.x,
                ev.y,
                6,
                [254, 240, 138],
                25,
                70,
                0.12,
                0.24,
                1.4,
                2.5
              );
            }
            break;
          case 'shield_hit':
            audioRef.current.playShieldHit();
            if (ev.x !== undefined && ev.y !== undefined) {
              rendererRef.current.spawnBurst(
                ev.x,
                ev.y,
                16,
                [56, 189, 248],
                35,
                145,
                0.2,
                0.4,
                1.8,
                3.4
              );
              rendererRef.current.spawnBurst(
                ev.x,
                ev.y,
                10,
                [254, 240, 138],
                25,
                100,
                0.15,
                0.3,
                1.5,
                2.8
              );
            }
            break;
          case 'missile_hit':
            audioRef.current.playMissileHit();
            if (ev.x !== undefined && ev.y !== undefined) {
              rendererRef.current.spawnBurst(
                ev.x,
                ev.y,
                28,
                [239, 68, 68],
                40,
                180,
                0.28,
                0.58,
                2.0,
                4.2
              );
              rendererRef.current.spawnBurst(
                ev.x,
                ev.y,
                16,
                [253, 224, 71],
                25,
                120,
                0.2,
                0.42,
                1.8,
                3.5
              );
            }
            break;
          case 'missile_miss':
            audioRef.current.playMissileMiss();
            if (ev.x !== undefined && ev.y !== undefined) {
              rendererRef.current.spawnMissPulse(ev.x, ev.y);
              rendererRef.current.spawnBurst(
                ev.x,
                ev.y,
                12,
                [148, 163, 184],
                24,
                88,
                0.2,
                0.38,
                1.5,
                2.8
              );
            }
            break;
          case 'enemy_counter_fire':
            audioRef.current.playEnemyCounterFire();
            if (ev.x !== undefined && ev.y !== undefined) {
              rendererRef.current.spawnBurst(
                ev.x,
                ev.y,
                10,
                [239, 68, 68],
                30,
                90,
                0.2,
                0.35,
                1.8,
                3.0
              );
            }
            break;
          case 'player_destroyed':
            audioRef.current.playMissileHit();
            rendererRef.current.spawnBurst(
              0,
              0,
              32,
              [239, 68, 68],
              45,
              195,
              0.3,
              0.62,
              2.2,
              4.4
            );
            rendererRef.current.spawnBurst(
              0,
              0,
              18,
              [56, 189, 248],
              35,
              150,
              0.25,
              0.5,
              1.8,
              3.4
            );
            break;
          case 'win':
            audioRef.current.playWinFanfare();
            break;
          case 'lose':
            audioRef.current.playLoseSting();
            break;
        }
      }

      // Radar proximity audio pulse while actively hunting
      audioRef.current.tickRadarPing(
        dt,
        state.signal,
        state.phase === 'playing' &&
          state.pendingWinRemaining === null &&
          state.enemyStrike === null
      );

      // Update visual particles & starfield even on menu/gameover (pause freezes motion)
      const isPaused = state.phase === 'paused';
      const isAmbientMenu =
        state.phase === 'title' ||
        state.phase === 'armory' ||
        state.phase === 'levels';
      const isSettledGameOver =
        state.phase === 'gameover' &&
        !state.blast.active &&
        state.trauma <= 0.01 &&
        !rendererRef.current.hasActiveVisuals();

      if (!isPaused && !isSettledGameOver) {
        rendererRef.current.updateVisuals(dt, state);
        if (isAmbientMenu) {
          titleRenderAccum += dt;
          if (titleRenderAccum >= 0.065) {
            titleRenderAccum = 0;
            needsRender = true;
          }
        } else {
          needsRender = true;
        }
      }

      if (rendererRef.current.consumeDirty()) {
        needsRender = true;
      }

      if (needsRender) {
        rendererRef.current.render(ctx, viewportW, viewportH, state);
        needsRender = false;
      }

      // Smoothly update signal bar fill & HUD screen-shake via DOM refs (no React re-renders)
      if (signalFillRef.current && state.phase === 'playing') {
        signalFillRef.current.style.transform = `scaleX(${
          state.signal <= 0 ? 0 : Math.max(0.02, state.signal / 100)
        })`;
      }

      if (hudRef.current) {
        const reducedMotion =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reducedMotion && !isPaused && state.trauma > 0.01) {
          const { x, y, rotDeg } = computeShakeOffset(state.trauma, now / 1000, 14);
          hudRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotDeg}deg)`;
        } else if (hudRef.current.style.transform !== 'none') {
          hudRef.current.style.transform = 'none';
        }
      }

      if (damageFlashRef.current) {
        if (!isPaused && state.playerFlashTimer > 0) {
          const flashAlpha = Math.min(0.65, (state.playerFlashTimer / 0.14) * 0.65);
          damageFlashRef.current.style.opacity = flashAlpha.toFixed(2);
        } else if (damageFlashRef.current.style.opacity !== '0') {
          damageFlashRef.current.style.opacity = '0';
        }
      }

      // Sync React HUD only on discrete integer/phase transitions
      if (state.phase === 'playing') {
        syncHudFromState(state);
      }
      if (prevPhase !== state.phase) {
        document.body.dataset.state = state.phase;
        setPhase(state.phase);
        if (state.phase === 'gameover') {
          setSnapshot(state.lastSnapshot);
          if (state.outcome === 'win') {
            const winResult = recordLevelWin(
              progressRef.current,
              state.difficulty,
              state.subLevel,
              state.missiles
            );
            progressRef.current = winResult.nextProgress;
            saveProgress(winResult.nextProgress);
            setProgress(winResult.nextProgress);
            setLastCoinsEarned(winResult.coinsEarned);
            setNewlyUnlockedSubLevel(winResult.newlyUnlockedSubLevel);
          } else {
            setLastCoinsEarned(0);
            setNewlyUnlockedSubLevel(null);
          }
        }
        syncHudFromState(state);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [syncHudFromState]);

  const currentLevelCfg = getLevelConfig(selectedDifficulty, selectedSubLevel);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#070B12] select-none">
      {/* Isolated Canvas Mount */}
      <div ref={canvasContainerRef} className="fixed inset-0 z-0">
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          tabIndex={0}
          aria-label="Signal Hunter radar playfield"
          className="block w-full h-full outline-none"
        />
      </div>

      {/* Step 1: Clean Title Screen */}
      {phase === 'title' && (
        <TitleOverlay
          selectedRadarId={progress.selectedRadarId}
          onEnterHangar={() => handleEnterArmory(false)}
        />
      )}

      {/* Step 2: Radar & Weapon Array Selection */}
      {phase === 'armory' && (
        <ArmoryOverlay
          progress={progress}
          radarConfirmed={radarConfirmed}
          onSelectRadar={handleSelectRadar}
          onBuyRadar={handleBuyRadar}
          onNext={handleGoToLevels}
          onBackToTitle={handleReturnToTitle}
        />
      )}

      {/* Step 3: Difficulty & Sub-Level Selection */}
      {phase === 'levels' && (
        <LevelSelectOverlay
          progress={progress}
          selectedDifficulty={selectedDifficulty}
          selectedSubLevel={selectedSubLevel}
          onSelectDifficulty={handleSelectDifficulty}
          onSelectSubLevel={handleSelectSubLevel}
          onLaunchMission={handleStartOrRestart}
          onBackToArmory={() => handleEnterArmory(true)}
        />
      )}

      {/* Playing / Paused / End HUD */}
      {phase !== 'title' && phase !== 'armory' && phase !== 'levels' && (
        <GameHud
          hud={hud}
          coins={progress.coins}
          muted={muted}
          hudRef={hudRef}
          damageFlashRef={damageFlashRef}
          signalFillRef={signalFillRef}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onRestart={handleStartOrRestart}
          onTouchLeftStart={() => {
            audioRef.current.unlock();
            touchHeldRef.current.left = true;
          }}
          onTouchLeftEnd={() => {
            touchHeldRef.current.left = false;
          }}
          onTouchRightStart={() => {
            audioRef.current.unlock();
            touchHeldRef.current.right = true;
          }}
          onTouchRightEnd={() => {
            touchHeldRef.current.right = false;
          }}
          onTouchFire={() => {
            audioRef.current.unlock();
            fireQueuedRef.current = true;
          }}
        />
      )}

      {/* Pause / Victory / Defeat Modal */}
      <GameModal
        phase={phase}
        snapshot={snapshot}
        difficulty={selectedDifficulty}
        subLevel={selectedSubLevel}
        currentTimeLeft={hud.timeLeft}
        currentMissiles={hud.missiles}
        maxMissiles={hud.maxMissiles}
        currentSignal={hud.signal}
        lockThreshold={currentLevelCfg.lockThreshold}
        coinsEarned={lastCoinsEarned}
        totalCoins={progress.coins}
        newlyUnlockedSubLevel={newlyUnlockedSubLevel}
        onResume={handleTogglePause}
        onNextLevel={handleNextLevel}
        onRestart={handleStartOrRestart}
        onTitle={() => handleEnterArmory(true)}
      />
    </main>
  );
}
