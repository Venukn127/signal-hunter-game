import {
  DifficultyId,
  LevelConfig,
  RadarConfig,
  RadarId,
  SubLevelNumber,
} from './levels';

export type GamePhase =
  | 'title'
  | 'armory'
  | 'levels'
  | 'playing'
  | 'paused'
  | 'gameover';

export type GameOutcome = 'win' | 'lose' | null;

export type LossReason = 'missiles' | 'timeout' | null;

export interface RadarState {
  angle: number; // radians, 0 = UP, positive = clockwise
  angularVel: number;
}

export interface ShipState {
  x: number;
  y: number;
  orbitAngle: number; // radians around (0, 0)
  orbitRadius: number;
  baseRadius: number;
  radialAmp: number;
  radialFreq: number;
  radialPhase: number;
  orbitDir: 1 | -1;
  angularVel: number;
  targetAngularVel: number;
  turnTimer: number;
  headingAngle: number;
  flightSeed: number;
  visible: boolean;
}

export interface MissileState {
  active: boolean;
  x: number;
  y: number;
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  angle: number;
  flightTime: number;
}

export interface LaunchShockwave {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  elapsed: number;
  duration: number;
}

export interface EnemyStrikeState {
  active: boolean;
  phase: 'incoming' | 'impact';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  impactRemaining: number;
  reason: Exclude<LossReason, null>;
}

export interface BlastState {
  active: boolean;
  x: number;
  y: number;
  elapsed: number;
  duration: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  fireJustPressed: boolean;
}

export interface SimEvent {
  type:
    | 'lock_acquired'
    | 'lock_lost'
    | 'missile_fired'
    | 'shield_hit'
    | 'missile_hit'
    | 'missile_miss'
    | 'enemy_counter_fire'
    | 'player_destroyed'
    | 'win'
    | 'lose';
  x?: number;
  y?: number;
}

export interface RunSnapshot {
  outcome: Exclude<GameOutcome, null>;
  lossReason: LossReason;
  difficulty: DifficultyId;
  subLevel: SubLevelNumber;
  levelName: string;
  radarId: RadarId;
  timeRemaining: number;
  timeElapsed: number;
  missilesLeft: number;
  maxMissiles: number;
  missilesUsed: number;
  peakSignal: number;
  lockThreshold: number;
  playerDestroyed: boolean;
}

export interface RunSelection {
  difficulty?: DifficultyId;
  subLevel?: SubLevelNumber;
  radarId?: RadarId;
}

export interface GameState {
  phase: GamePhase;
  outcome: GameOutcome;
  lossReason: LossReason;
  difficulty: DifficultyId;
  subLevel: SubLevelNumber;
  levelConfig: LevelConfig;
  radarConfig: RadarConfig;
  playerAlive: boolean;
  pendingWinRemaining: number | null;
  enemyStrike: EnemyStrikeState | null;
  radar: RadarState;
  ship: ShipState;
  missile: MissileState;
  launchShockwave: LaunchShockwave;
  blast: BlastState;
  signal: number;
  angularDistanceDeg: number;
  enemyHp: number;
  enemyMaxHp: number;
  missiles: number;
  maxMissiles: number;
  timeLeft: number;
  roundDuration: number;
  roundElapsed: number;
  peakSignal: number;
  promptTimer: number;
  hitstopTimer: number;
  trauma: number;
  shipFlashTimer: number;
  playerFlashTimer: number;
  lastSnapshot: RunSnapshot | null;
}

export const STAGE_BOUNDS = {
  MIN_X: -240,
  MAX_X: 240,
  MIN_Y: -180,
  MAX_Y: 180,
  WIDTH: 480,
  HEIGHT: 360,
  RADAR_RADIUS: 158,
} as const;

export const GAME_CONFIG = {
  RADAR_ROTATE_SPEED_DEG: 140, // base degrees per second
  SHIP_ORBIT_MIN_RADIUS: 64,
  SHIP_ORBIT_MAX_RADIUS: 150,
  SHIP_ORBIT_BASE_MIN: 74,
  SHIP_ORBIT_BASE_MAX: 140,
  SHIP_ORBIT_SPEED_RAD: 0.45, // base radians per second
  MISSILE_SPEED: 540,
  MISSILE_MAX_RANGE: 185,
  ENEMY_MISSILE_SPEED: 310,
  HIT_TOLERANCE: 20,
  PLAYER_HIT_RADIUS: 10,
  LOCK_SIGNAL_THRESHOLD: 80,
  SIGNAL_FALLOFF_PER_DEG: 2.5, // 80% at 8 deg, 0% at 40 deg
  INITIAL_MISSILES: 3,
  ROUND_DURATION: 30,
  PROMPT_DURATION: 4,
  BLAST_DURATION: 0.44,
  HITSTOP_DURATION: 0.055,
} as const;

