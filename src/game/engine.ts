import { getLevelConfig, getRadarConfig } from './levels';
import {
  GAME_CONFIG,
  GameOutcome,
  GameState,
  InputState,
  LossReason,
  RunSelection,
  ShipState,
  SimEvent,
} from './types';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const TWO_PI = Math.PI * 2;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function wrapAngle(angle: number): number {
  let a = (angle + Math.PI) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a - Math.PI;
}

export function computeShakeOffset(
  trauma: number,
  timeSec: number,
  maxOffsetPx = 14
): { x: number; y: number; rotDeg: number } {
  const clamped = clamp(trauma, 0, 1);
  if (clamped <= 0.01) {
    return { x: 0, y: 0, rotDeg: 0 };
  }
  const intensity = clamped * clamped;
  const x =
    intensity *
    maxOffsetPx *
    (Math.sin(timeSec * 57) * 0.65 + Math.cos(timeSec * 93) * 0.35);
  const y =
    intensity *
    maxOffsetPx *
    (Math.cos(timeSec * 61) * 0.65 + Math.sin(timeSec * 87) * 0.35);
  const rotDeg = intensity * 0.9 * Math.sin(timeSec * 43);
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    rotDeg: Math.round(rotDeg * 100) / 100,
  };
}

export function computePolarSignal(
  radarAngle: number,
  shipX: number,
  shipY: number,
  falloffPerDeg: number = GAME_CONFIG.SIGNAL_FALLOFF_PER_DEG
): {
  angularDistanceDeg: number;
  signal: number;
} {
  // 0 rad = UP (0, 1), clockwise positive: atan2(x, y)
  const shipAngle = Math.atan2(shipX, shipY);
  const diff = Math.abs(wrapAngle(shipAngle - radarAngle));
  const angularDistanceDeg = diff * RAD_TO_DEG;
  const rawSignal = 100 - angularDistanceDeg * falloffPerDeg;
  const signal = clamp(rawSignal, 0, 100);
  return { angularDistanceDeg, signal };
}

function shipCoordsFromOrbit(orbitAngle: number, orbitRadius: number): {
  x: number;
  y: number;
} {
  return {
    x: Math.sin(orbitAngle) * orbitRadius,
    y: Math.cos(orbitAngle) * orbitRadius,
  };
}

function nextFlightRand(ship: ShipState): number {
  ship.flightSeed = (Math.imul(ship.flightSeed, 1664525) + 1013904223) >>> 0;
  return ship.flightSeed / 4294967296;
}

function computeInstantHeading(
  orbitAngle: number,
  orbitRadius: number,
  angularVel: number,
  radialVel: number
): number {
  const sinA = Math.sin(orbitAngle);
  const cosA = Math.cos(orbitAngle);
  const vx = radialVel * sinA + orbitRadius * cosA * angularVel;
  const vy = radialVel * cosA - orbitRadius * sinA * angularVel;
  if (Math.hypot(vx, vy) < 1e-4) {
    return wrapAngle(
      orbitAngle + (angularVel >= 0 ? 1 : -1) * (Math.PI * 0.5)
    );
  }
  return Math.atan2(vx, vy);
}

export function createInitialState(
  rng: () => number = Math.random,
  autostart = false,
  selection: RunSelection = {}
): GameState {
  const difficulty = selection.difficulty ?? 'medium';
  const subLevel = selection.subLevel ?? 1;
  const radarId = selection.radarId ?? 'mk1';
  const levelConfig = getLevelConfig(difficulty, subLevel);
  const radarConfig = getRadarConfig(radarId);

  const effectiveFalloff =
    levelConfig.signalFalloffPerDeg * radarConfig.signalFalloffMult;

  const orbitAngle = wrapAngle(rng() * TWO_PI - Math.PI);
  const baseRadius =
    GAME_CONFIG.SHIP_ORBIT_BASE_MIN +
    rng() * (GAME_CONFIG.SHIP_ORBIT_BASE_MAX - GAME_CONFIG.SHIP_ORBIT_BASE_MIN);
  const radialAmp =
    levelConfig.radialAmpMin +
    rng() * (levelConfig.radialAmpMax - levelConfig.radialAmpMin);
  const radialFreq = 0.7 + rng() * 0.8;
  const radialPhase = rng() * TWO_PI;
  const orbitRadius = clamp(
    baseRadius + Math.sin(radialPhase) * radialAmp,
    GAME_CONFIG.SHIP_ORBIT_MIN_RADIUS,
    GAME_CONFIG.SHIP_ORBIT_MAX_RADIUS
  );
  const orbitDir: 1 | -1 = rng() >= 0.5 ? 1 : -1;
  const angularSpeed = levelConfig.enemySpeedRad * (0.85 + rng() * 0.35);
  const angularVel = orbitDir * angularSpeed;
  const turnTimer =
    levelConfig.turnMinSec +
    rng() * (levelConfig.turnMaxSec - levelConfig.turnMinSec);
  const flightSeed = Math.floor(rng() * 0xffffffff) >>> 0 || 1;
  const radialVel = radialAmp * radialFreq * Math.cos(radialPhase);
  const headingAngle = computeInstantHeading(
    orbitAngle,
    orbitRadius,
    angularVel,
    radialVel
  );

  const { x: shipX, y: shipY } = shipCoordsFromOrbit(orbitAngle, orbitRadius);
  const { angularDistanceDeg, signal } = computePolarSignal(
    0,
    shipX,
    shipY,
    effectiveFalloff
  );

  return {
    phase: autostart ? 'playing' : 'title',
    outcome: null,
    lossReason: null,
    difficulty,
    subLevel,
    levelConfig,
    radarConfig,
    playerAlive: true,
    pendingWinRemaining: null,
    enemyStrike: null,
    radar: {
      angle: 0,
      angularVel: 0,
    },
    ship: {
      x: shipX,
      y: shipY,
      orbitAngle,
      orbitRadius,
      baseRadius,
      radialAmp,
      radialFreq,
      radialPhase,
      orbitDir,
      angularVel,
      targetAngularVel: angularVel,
      turnTimer,
      headingAngle,
      flightSeed,
      visible: signal >= levelConfig.lockThreshold,
    },
    missile: {
      active: false,
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      flightTime: 0,
    },
    launchShockwave: {
      active: false,
      x: 0,
      y: 0,
      angle: 0,
      elapsed: 0,
      duration: 0.22,
    },
    blast: {
      active: false,
      x: 0,
      y: 0,
      elapsed: 0,
      duration: GAME_CONFIG.BLAST_DURATION,
    },
    signal,
    angularDistanceDeg,
    enemyHp: levelConfig.hitsRequired,
    enemyMaxHp: levelConfig.hitsRequired,
    missiles: levelConfig.missiles,
    maxMissiles: levelConfig.missiles,
    timeLeft: levelConfig.roundDuration,
    roundDuration: levelConfig.roundDuration,
    roundElapsed: 0,
    peakSignal: Math.round(signal),
    promptTimer: GAME_CONFIG.PROMPT_DURATION,
    hitstopTimer: 0,
    trauma: 0,
    shipFlashTimer: 0,
    playerFlashTimer: 0,
    lastSnapshot: null,
  };
}

export function startRun(
  prev: GameState | null,
  rng: () => number = Math.random,
  selection?: RunSelection
): GameState {
  const resolvedSelection: RunSelection = {
    difficulty: selection?.difficulty ?? prev?.difficulty ?? 'medium',
    subLevel: selection?.subLevel ?? prev?.subLevel ?? 1,
    radarId: selection?.radarId ?? prev?.radarConfig.id ?? 'mk1',
  };

  const fresh = createInitialState(rng, true, resolvedSelection);
  const effectiveFalloff =
    fresh.levelConfig.signalFalloffPerDeg * fresh.radarConfig.signalFalloffMult;

  // Ensure opponent does not spawn already dead-center in front of the initial 0-deg radar
  if (fresh.angularDistanceDeg < 35) {
    fresh.ship.orbitAngle = wrapAngle(fresh.ship.orbitAngle + Math.PI * 0.65);
    const coords = shipCoordsFromOrbit(
      fresh.ship.orbitAngle,
      fresh.ship.orbitRadius
    );
    fresh.ship.x = coords.x;
    fresh.ship.y = coords.y;
    const radialVel =
      fresh.ship.radialAmp *
      fresh.ship.radialFreq *
      Math.cos(fresh.ship.radialPhase);
    fresh.ship.headingAngle = computeInstantHeading(
      fresh.ship.orbitAngle,
      fresh.ship.orbitRadius,
      fresh.ship.angularVel,
      radialVel
    );
    const { angularDistanceDeg, signal } = computePolarSignal(
      fresh.radar.angle,
      fresh.ship.x,
      fresh.ship.y,
      effectiveFalloff
    );
    fresh.angularDistanceDeg = angularDistanceDeg;
    fresh.signal = signal;
    fresh.ship.visible = signal >= fresh.levelConfig.lockThreshold;
    fresh.peakSignal = Math.round(signal);
  }
  if (prev) {
    fresh.lastSnapshot = null;
  }
  return fresh;
}

export function fireMissile(state: GameState, events: SimEvent[]): boolean {
  if (state.phase !== 'playing') return false;
  if (state.pendingWinRemaining !== null || state.enemyStrike !== null)
    return false;
  if (state.missiles <= 0) return false;
  if (state.missile.active) return false;

  const angle = state.radar.angle;
  const dirX = Math.sin(angle);
  const dirY = Math.cos(angle);
  const speed = GAME_CONFIG.MISSILE_SPEED * state.radarConfig.missileSpeedMult;

  state.missiles -= 1;
  state.missile.active = true;
  state.missile.angle = angle;
  // Launch from center station nose
  state.missile.startX = dirX * 14;
  state.missile.startY = dirY * 14;
  state.missile.x = state.missile.startX;
  state.missile.y = state.missile.startY;
  state.missile.vx = dirX * speed;
  state.missile.vy = dirY * speed;
  state.missile.flightTime = 0;

  state.launchShockwave = {
    active: true,
    x: state.missile.startX,
    y: state.missile.startY,
    angle,
    elapsed: 0,
    duration: 0.22,
  };

  state.trauma = Math.min(1, state.trauma + 0.48);

  events.push({
    type: 'missile_fired',
    x: state.missile.x,
    y: state.missile.y,
  });

  return true;
}

function triggerEnemyCounterStrike(
  state: GameState,
  reason: Exclude<LossReason, null>,
  events: SimEvent[]
): void {
  // Opponent drops cloak and launches a lethal counter-strike at the center station (0, 0)
  state.ship.visible = true;
  state.missile.active = false;

  const dx = -state.ship.x;
  const dy = -state.ship.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const vx = (dx / dist) * GAME_CONFIG.ENEMY_MISSILE_SPEED;
  const vy = (dy / dist) * GAME_CONFIG.ENEMY_MISSILE_SPEED;
  const angle = Math.atan2(dx, dy);

  state.enemyStrike = {
    active: true,
    phase: 'incoming',
    x: state.ship.x,
    y: state.ship.y,
    vx,
    vy,
    angle,
    impactRemaining: GAME_CONFIG.BLAST_DURATION,
    reason,
  };

  events.push({
    type: 'enemy_counter_fire',
    x: state.ship.x,
    y: state.ship.y,
  });
}

function finalizeOutcome(
  state: GameState,
  outcome: Exclude<GameOutcome, null>,
  lossReason: LossReason,
  events: SimEvent[]
): void {
  state.phase = 'gameover';
  state.outcome = outcome;
  state.lossReason = lossReason;
  state.pendingWinRemaining = null;
  state.enemyStrike = null;
  state.lastSnapshot = {
    outcome,
    lossReason,
    difficulty: state.difficulty,
    subLevel: state.subLevel,
    levelName: state.levelConfig.name,
    radarId: state.radarConfig.id,
    timeRemaining: Math.max(0, Math.round(state.timeLeft)),
    timeElapsed: Math.min(
      state.roundDuration,
      Math.round(state.roundElapsed * 10) / 10
    ),
    missilesLeft: state.missiles,
    maxMissiles: state.maxMissiles,
    missilesUsed: state.maxMissiles - state.missiles,
    peakSignal: Math.round(state.peakSignal),
    lockThreshold: state.levelConfig.lockThreshold,
    playerDestroyed: !state.playerAlive,
  };

  events.push({
    type: outcome === 'win' ? 'win' : 'lose',
    x: outcome === 'win' ? state.ship.x : 0,
    y: outcome === 'win' ? state.ship.y : 0,
  });
}

export function stepSimulation(
  state: GameState,
  rawDt: number,
  input: InputState
): SimEvent[] {
  const events: SimEvent[] = [];
  const dt = Math.min(Math.max(rawDt, 0), 0.05);

  if (state.phase !== 'playing' || dt <= 0) {
    return events;
  }

  // Decay visual trauma, hit flashes, launch shockwave, and active blast even during hitstop
  state.trauma = Math.max(0, state.trauma - dt * 1.9);
  state.shipFlashTimer = Math.max(0, state.shipFlashTimer - dt);
  state.playerFlashTimer = Math.max(0, state.playerFlashTimer - dt);

  if (state.launchShockwave.active) {
    state.launchShockwave.elapsed += dt;
    if (state.launchShockwave.elapsed >= state.launchShockwave.duration) {
      state.launchShockwave.active = false;
    }
  }

  if (state.blast.active) {
    state.blast.elapsed += dt;
    if (state.blast.elapsed >= state.blast.duration) {
      state.blast.active = false;
    }
  }

  // Hitstop pauses simulation physics briefly for impact weight
  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return events;
  }

  // Pending win resolution beat (watching opponent blast expand)
  if (state.pendingWinRemaining !== null) {
    state.pendingWinRemaining -= dt;
    if (state.pendingWinRemaining <= 0) {
      finalizeOutcome(state, 'win', null, events);
    }
    return events;
  }

  // Enemy counter-strike sequence (destroying player center ship on defeat)
  if (state.enemyStrike !== null) {
    const strike = state.enemyStrike;
    if (strike.phase === 'incoming') {
      strike.x += strike.vx * dt;
      strike.y += strike.vy * dt;

      const distToCenter = Math.hypot(strike.x, strike.y);
      if (distToCenter <= GAME_CONFIG.PLAYER_HIT_RADIUS) {
        strike.phase = 'impact';
        strike.impactRemaining = GAME_CONFIG.BLAST_DURATION;
        state.playerAlive = false;
        state.playerFlashTimer = 0.14;
        state.hitstopTimer = GAME_CONFIG.HITSTOP_DURATION;
        state.trauma = 1.0;
        state.blast = {
          active: true,
          x: 0,
          y: 0,
          elapsed: 0,
          duration: GAME_CONFIG.BLAST_DURATION,
        };
        events.push({ type: 'player_destroyed', x: 0, y: 0 });
      }
    } else {
      strike.impactRemaining -= dt;
      if (strike.impactRemaining <= 0) {
        finalizeOutcome(state, 'lose', strike.reason, events);
      }
    }
    return events;
  }

  // 1. Prompt timer
  if (state.promptTimer > 0) {
    state.promptTimer = Math.max(0, state.promptTimer - dt);
  }

  // 2. Round timer countdown
  state.roundElapsed += dt;
  state.timeLeft = Math.max(0, state.roundDuration - state.roundElapsed);
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    triggerEnemyCounterStrike(state, 'timeout', events);
    return events;
  }

  // 3. Center radar rotation scaled by equipped radar gimbal speed
  const turnAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const rotateSpeedRad =
    GAME_CONFIG.RADAR_ROTATE_SPEED_DEG *
    state.radarConfig.rotationSpeedMult *
    DEG_TO_RAD;
  state.radar.angularVel = turnAxis * rotateSpeedRad;
  state.radar.angle = wrapAngle(
    state.radar.angle + state.radar.angularVel * dt
  );

  // 4. Opponent ship evasive path scaled by current difficulty & sub-level
  const prevShipX = state.ship.x;
  const prevShipY = state.ship.y;

  state.ship.turnTimer -= dt;
  if (state.ship.turnTimer <= 0) {
    const flipRoll = nextFlightRand(state.ship);
    const speedRoll = nextFlightRand(state.ship);
    const timerRoll = nextFlightRand(state.ship);
    if (flipRoll < state.levelConfig.flipChance) {
      state.ship.orbitDir = state.ship.orbitDir === 1 ? -1 : 1;
    }
    const speedMult = 0.65 + speedRoll * 0.9;
    state.ship.targetAngularVel =
      state.ship.orbitDir * state.levelConfig.enemySpeedRad * speedMult;
    state.ship.turnTimer =
      state.levelConfig.turnMinSec +
      timerRoll * (state.levelConfig.turnMaxSec - state.levelConfig.turnMinSec);
  }

  const damp = Math.min(1, dt * 3.8);
  state.ship.angularVel +=
    (state.ship.targetAngularVel - state.ship.angularVel) * damp;
  state.ship.orbitAngle = wrapAngle(
    state.ship.orbitAngle + state.ship.angularVel * dt
  );

  const radialWave =
    Math.sin(
      state.roundElapsed * state.ship.radialFreq + state.ship.radialPhase
    ) * state.ship.radialAmp;
  state.ship.orbitRadius = clamp(
    state.ship.baseRadius + radialWave,
    GAME_CONFIG.SHIP_ORBIT_MIN_RADIUS,
    GAME_CONFIG.SHIP_ORBIT_MAX_RADIUS
  );

  const nextShipPos = shipCoordsFromOrbit(
    state.ship.orbitAngle,
    state.ship.orbitRadius
  );
  state.ship.x = nextShipPos.x;
  state.ship.y = nextShipPos.y;

  const moveDx = state.ship.x - prevShipX;
  const moveDy = state.ship.y - prevShipY;
  if (Math.hypot(moveDx, moveDy) > 0.001) {
    state.ship.headingAngle = Math.atan2(moveDx, moveDy);
  }

  // 5. Angular distance & Signal calculation + lock-on visibility
  const prevVisible = state.ship.visible;
  const effectiveFalloff =
    state.levelConfig.signalFalloffPerDeg * state.radarConfig.signalFalloffMult;
  const { angularDistanceDeg, signal } = computePolarSignal(
    state.radar.angle,
    state.ship.x,
    state.ship.y,
    effectiveFalloff
  );
  state.angularDistanceDeg = angularDistanceDeg;
  state.signal = signal;
  if (signal > state.peakSignal) {
    state.peakSignal = Math.round(signal);
  }
  state.ship.visible = signal >= state.levelConfig.lockThreshold;

  if (!prevVisible && state.ship.visible) {
    events.push({ type: 'lock_acquired', x: state.ship.x, y: state.ship.y });
  } else if (prevVisible && !state.ship.visible) {
    events.push({ type: 'lock_lost', x: state.ship.x, y: state.ship.y });
  }

  // 6. Edge-triggered firing from center
  if (input.fireJustPressed) {
    fireMissile(state, events);
  }

  // 7. Active missile flight & hit/miss resolution
  if (state.missile.active) {
    state.missile.flightTime += dt;
    state.missile.x += state.missile.vx * dt;
    state.missile.y += state.missile.vy * dt;

    const distToShip = Math.hypot(
      state.missile.x - state.ship.x,
      state.missile.y - state.ship.y
    );
    const rangeFromCenter = Math.hypot(state.missile.x, state.missile.y);

    if (distToShip < state.levelConfig.hitTolerance) {
      state.missile.active = false;
      state.ship.visible = true;
      state.shipFlashTimer = 0.08;
      state.hitstopTimer = GAME_CONFIG.HITSTOP_DURATION;
      state.enemyHp = Math.max(0, state.enemyHp - 1);

      if (state.enemyHp > 0) {
        // Shield/armor damaged — enemy craft jolts into an evasive counter-jink!
        state.trauma = Math.min(1, state.trauma + 0.52);
        state.ship.orbitDir = state.ship.orbitDir === 1 ? -1 : 1;
        state.ship.targetAngularVel =
          state.ship.orbitDir * state.levelConfig.enemySpeedRad * 1.45;
        state.ship.turnTimer = state.levelConfig.turnMinSec * 0.75;
        events.push({ type: 'shield_hit', x: state.ship.x, y: state.ship.y });

        if (state.missiles < state.enemyHp) {
          triggerEnemyCounterStrike(state, 'missiles', events);
        }
      } else {
        state.trauma = 0.88;
        state.blast = {
          active: true,
          x: state.ship.x,
          y: state.ship.y,
          elapsed: 0,
          duration: GAME_CONFIG.BLAST_DURATION,
        };
        state.pendingWinRemaining = GAME_CONFIG.BLAST_DURATION;
        events.push({ type: 'missile_hit', x: state.ship.x, y: state.ship.y });
      }
    } else if (rangeFromCenter >= GAME_CONFIG.MISSILE_MAX_RANGE) {
      const missX = state.missile.x;
      const missY = state.missile.y;
      state.missile.active = false;
      state.trauma = Math.min(1, state.trauma + 0.22);
      events.push({ type: 'missile_miss', x: missX, y: missY });

      if (state.missiles <= 0 || state.missiles < state.enemyHp) {
        triggerEnemyCounterStrike(state, 'missiles', events);
      }
    }
  }

  return events;
}
