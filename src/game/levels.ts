export type DifficultyId = 'easy' | 'medium' | 'hard';
export type SubLevelNumber = 1 | 2 | 3 | 4 | 5;
export type RadarId = 'mk1' | 'aegis' | 'valkyrie' | 'solaris';

export interface LevelConfig {
  id: string;
  difficulty: DifficultyId;
  subLevel: SubLevelNumber;
  name: string;
  subtitle: string;
  roundDuration: number;
  missiles: number;
  hitsRequired: number;
  lockThreshold: number;
  signalFalloffPerDeg: number;
  enemySpeedRad: number;
  radialAmpMin: number;
  radialAmpMax: number;
  flipChance: number;
  turnMinSec: number;
  turnMaxSec: number;
  hitTolerance: number;
  coinReward: number;
}

export interface RadarConfig {
  id: RadarId;
  name: string;
  tagline: string;
  cost: number;
  rotationSpeedMult: number;
  signalFalloffMult: number; // < 1 means wider detection cone / stronger signal
  missileSpeedMult: number;
  accentHex: string;
  accentRgb: string;
  lockHex: string;
  lockRgb: string;
  ringRgb: string;
}

export const DIFFICULTIES: readonly {
  id: DifficultyId;
  label: string;
  summary: string;
}[] = [
  {
    id: 'easy',
    label: 'Easy',
    summary: '5 escalating sectors · wide lock beam rising to armored targets.',
  },
  {
    id: 'medium',
    label: 'Medium',
    summary: '5 tactical sectors · agile interceptors & multi-hit shields.',
  },
  {
    id: 'hard',
    label: 'Hard',
    summary: '5 extreme sectors · stealth locks, erratic evasion, zero margin.',
  },
] as const;

export const LEVELS: readonly LevelConfig[] = [
  // ================= EASY (5 SUB-LEVELS) =================
  {
    id: 'easy-1',
    difficulty: 'easy',
    subLevel: 1,
    name: 'Scout Orbit',
    subtitle: 'Slow recon craft on a forgiving sweep.',
    roundDuration: 35,
    missiles: 4,
    hitsRequired: 1,
    lockThreshold: 72,
    signalFalloffPerDeg: 2.2,
    enemySpeedRad: 0.32,
    radialAmpMin: 8,
    radialAmpMax: 16,
    flipChance: 0.45,
    turnMinSec: 2.4,
    turnMaxSec: 4.0,
    hitTolerance: 22,
    coinReward: 30,
  },
  {
    id: 'easy-2',
    difficulty: 'easy',
    subLevel: 2,
    name: 'Weave Patrol',
    subtitle: 'Wider radial drift and sharper course reversals.',
    roundDuration: 32,
    missiles: 4,
    hitsRequired: 1,
    lockThreshold: 76,
    signalFalloffPerDeg: 2.35,
    enemySpeedRad: 0.42,
    radialAmpMin: 10,
    radialAmpMax: 20,
    flipChance: 0.58,
    turnMinSec: 2.0,
    turnMaxSec: 3.5,
    hitTolerance: 20,
    coinReward: 40,
  },
  {
    id: 'easy-3',
    difficulty: 'easy',
    subLevel: 3,
    name: 'Phantom Drift',
    subtitle: '3 missiles against an elusive inner/outer cruiser.',
    roundDuration: 30,
    missiles: 3,
    hitsRequired: 1,
    lockThreshold: 80,
    signalFalloffPerDeg: 2.5,
    enemySpeedRad: 0.52,
    radialAmpMin: 12,
    radialAmpMax: 24,
    flipChance: 0.68,
    turnMinSec: 1.6,
    turnMaxSec: 3.0,
    hitTolerance: 19,
    coinReward: 55,
  },
  {
    id: 'easy-4',
    difficulty: 'easy',
    subLevel: 4,
    name: 'Ironclad Escort',
    subtitle: 'Armored hull requires 2 direct missile strikes.',
    roundDuration: 30,
    missiles: 4,
    hitsRequired: 2,
    lockThreshold: 82,
    signalFalloffPerDeg: 2.6,
    enemySpeedRad: 0.58,
    radialAmpMin: 14,
    radialAmpMax: 25,
    flipChance: 0.72,
    turnMinSec: 1.4,
    turnMaxSec: 2.7,
    hitTolerance: 18,
    coinReward: 70,
  },
  {
    id: 'easy-5',
    difficulty: 'easy',
    subLevel: 5,
    name: 'Vanguard Warden',
    subtitle: '2 hits with 3 missiles against brisk evasive turns.',
    roundDuration: 28,
    missiles: 3,
    hitsRequired: 2,
    lockThreshold: 84,
    signalFalloffPerDeg: 2.75,
    enemySpeedRad: 0.66,
    radialAmpMin: 15,
    radialAmpMax: 27,
    flipChance: 0.76,
    turnMinSec: 1.25,
    turnMaxSec: 2.4,
    hitTolerance: 17,
    coinReward: 90,
  },

  // ================= MEDIUM (5 SUB-LEVELS) =================
  {
    id: 'medium-1',
    difficulty: 'medium',
    subLevel: 1,
    name: 'Vector Sweep',
    subtitle: 'Tactical interceptor with frequent directional snaps.',
    roundDuration: 28,
    missiles: 3,
    hitsRequired: 1,
    lockThreshold: 82,
    signalFalloffPerDeg: 2.65,
    enemySpeedRad: 0.56,
    radialAmpMin: 12,
    radialAmpMax: 24,
    flipChance: 0.75,
    turnMinSec: 1.4,
    turnMaxSec: 2.8,
    hitTolerance: 18,
    coinReward: 80,
  },
  {
    id: 'medium-2',
    difficulty: 'medium',
    subLevel: 2,
    name: 'Evasive Arc',
    subtitle: 'Shielded striker demanding 2 accurate intercepts.',
    roundDuration: 28,
    missiles: 3,
    hitsRequired: 2,
    lockThreshold: 84,
    signalFalloffPerDeg: 2.8,
    enemySpeedRad: 0.65,
    radialAmpMin: 14,
    radialAmpMax: 26,
    flipChance: 0.80,
    turnMinSec: 1.2,
    turnMaxSec: 2.4,
    hitTolerance: 17,
    coinReward: 100,
  },
  {
    id: 'medium-3',
    difficulty: 'medium',
    subLevel: 3,
    name: 'Ghost Interceptor',
    subtitle: 'High-agility craft weaving fast across stealth lanes.',
    roundDuration: 26,
    missiles: 3,
    hitsRequired: 2,
    lockThreshold: 86,
    signalFalloffPerDeg: 2.95,
    enemySpeedRad: 0.74,
    radialAmpMin: 15,
    radialAmpMax: 28,
    flipChance: 0.84,
    turnMinSec: 1.05,
    turnMaxSec: 2.1,
    hitTolerance: 16,
    coinReward: 125,
  },
  {
    id: 'medium-4',
    difficulty: 'medium',
    subLevel: 4,
    name: 'Twin-Core Striker',
    subtitle: 'Heavy 3-hit armor; only 1 missed shot permitted.',
    roundDuration: 26,
    missiles: 4,
    hitsRequired: 3,
    lockThreshold: 87,
    signalFalloffPerDeg: 3.1,
    enemySpeedRad: 0.80,
    radialAmpMin: 16,
    radialAmpMax: 30,
    flipChance: 0.86,
    turnMinSec: 0.95,
    turnMaxSec: 1.9,
    hitTolerance: 15,
    coinReward: 150,
  },
  {
    id: 'medium-5',
    difficulty: 'medium',
    subLevel: 5,
    name: 'Mirage Corvette',
    subtitle: '3 hits in 3 missiles — zero misses allowed.',
    roundDuration: 24,
    missiles: 3,
    hitsRequired: 3,
    lockThreshold: 88,
    signalFalloffPerDeg: 3.2,
    enemySpeedRad: 0.88,
    radialAmpMin: 16,
    radialAmpMax: 31,
    flipChance: 0.88,
    turnMinSec: 0.85,
    turnMaxSec: 1.7,
    hitTolerance: 14,
    coinReward: 185,
  },

  // ================= HARD (5 SUB-LEVELS) =================
  {
    id: 'hard-1',
    difficulty: 'hard',
    subLevel: 1,
    name: 'Redline Ambush',
    subtitle: '2-hit stealth raider with narrow lock & jinking speed.',
    roundDuration: 24,
    missiles: 3,
    hitsRequired: 2,
    lockThreshold: 87,
    signalFalloffPerDeg: 3.15,
    enemySpeedRad: 0.78,
    radialAmpMin: 15,
    radialAmpMax: 29,
    flipChance: 0.86,
    turnMinSec: 0.9,
    turnMaxSec: 1.85,
    hitTolerance: 16,
    coinReward: 160,
  },
  {
    id: 'hard-2',
    difficulty: 'hard',
    subLevel: 2,
    name: 'Apex Stealth',
    subtitle: 'Razor-thin 89% signature and relentless reversals.',
    roundDuration: 23,
    missiles: 3,
    hitsRequired: 2,
    lockThreshold: 89,
    signalFalloffPerDeg: 3.3,
    enemySpeedRad: 0.88,
    radialAmpMin: 17,
    radialAmpMax: 31,
    flipChance: 0.88,
    turnMinSec: 0.8,
    turnMaxSec: 1.65,
    hitTolerance: 14.5,
    coinReward: 195,
  },
  {
    id: 'hard-3',
    difficulty: 'hard',
    subLevel: 3,
    name: 'Shadow Dreadnought',
    subtitle: '3-hit cloaked battleship surging across orbits.',
    roundDuration: 24,
    missiles: 4,
    hitsRequired: 3,
    lockThreshold: 90,
    signalFalloffPerDeg: 3.45,
    enemySpeedRad: 0.94,
    radialAmpMin: 18,
    radialAmpMax: 32,
    flipChance: 0.90,
    turnMinSec: 0.72,
    turnMaxSec: 1.45,
    hitTolerance: 14,
    coinReward: 230,
  },
  {
    id: 'hard-4',
    difficulty: 'hard',
    subLevel: 4,
    name: 'Void Specter',
    subtitle: '3 perfect shots in 22s against extreme evasion.',
    roundDuration: 22,
    missiles: 3,
    hitsRequired: 3,
    lockThreshold: 91,
    signalFalloffPerDeg: 3.6,
    enemySpeedRad: 1.04,
    radialAmpMin: 18,
    radialAmpMax: 33,
    flipChance: 0.92,
    turnMinSec: 0.62,
    turnMaxSec: 1.25,
    hitTolerance: 13,
    coinReward: 280,
  },
  {
    id: 'hard-5',
    difficulty: 'hard',
    subLevel: 5,
    name: 'Omega Leviathan',
    subtitle: '20s, 3/3 perfect hits, 92% lock, supersonic evasion.',
    roundDuration: 20,
    missiles: 3,
    hitsRequired: 3,
    lockThreshold: 92,
    signalFalloffPerDeg: 3.75,
    enemySpeedRad: 1.15,
    radialAmpMin: 20,
    radialAmpMax: 34,
    flipChance: 0.94,
    turnMinSec: 0.55,
    turnMaxSec: 1.1,
    hitTolerance: 12,
    coinReward: 350,
  },
] as const;

export const RADARS: readonly RadarConfig[] = [
  {
    id: 'mk1',
    name: 'MK-I Pulse',
    tagline: 'Balanced amber tactical array.',
    cost: 0,
    rotationSpeedMult: 1.0,
    signalFalloffMult: 1.0,
    missileSpeedMult: 1.0,
    accentHex: '#F59E0B',
    accentRgb: '245, 158, 11',
    lockHex: '#10B981',
    lockRgb: '16, 185, 129',
    ringRgb: '245, 158, 11',
  },
  {
    id: 'aegis',
    name: 'Aegis Wideband',
    tagline: '+12% wider signal lock & +8% sweep speed.',
    cost: 60,
    rotationSpeedMult: 1.08,
    signalFalloffMult: 0.88,
    missileSpeedMult: 1.02,
    accentHex: '#38BDF8',
    accentRgb: '56, 189, 248',
    lockHex: '#34D399',
    lockRgb: '52, 211, 153',
    ringRgb: '56, 189, 248',
  },
  {
    id: 'valkyrie',
    name: 'Valkyrie Hyper',
    tagline: '+24% sweep speed & +15% missile thrust.',
    cost: 140,
    rotationSpeedMult: 1.24,
    signalFalloffMult: 0.94,
    missileSpeedMult: 1.15,
    accentHex: '#C084FC',
    accentRgb: '192, 132, 252',
    lockHex: '#2DD4BF',
    lockRgb: '45, 212, 191',
    ringRgb: '192, 132, 252',
  },
  {
    id: 'solaris',
    name: 'Solaris Apex',
    tagline: '+16% wider lock, +20% sweep & +18% missile thrust.',
    cost: 240,
    rotationSpeedMult: 1.2,
    signalFalloffMult: 0.84,
    missileSpeedMult: 1.18,
    accentHex: '#FACC15',
    accentRgb: '250, 204, 21',
    lockHex: '#4ADE80',
    lockRgb: '74, 222, 128',
    ringRgb: '250, 204, 21',
  },
] as const;

export function getLevelsForDifficulty(difficulty: DifficultyId): LevelConfig[] {
  return LEVELS.filter((lvl) => lvl.difficulty === difficulty);
}

export function getLevelConfig(
  difficulty: DifficultyId,
  subLevel: SubLevelNumber
): LevelConfig {
  return (
    LEVELS.find(
      (lvl) => lvl.difficulty === difficulty && lvl.subLevel === subLevel
    ) ?? LEVELS[0]
  );
}

export function getRadarConfig(radarId: RadarId): RadarConfig {
  return RADARS.find((r) => r.id === radarId) ?? RADARS[0];
}

export function getNextLevel(
  difficulty: DifficultyId,
  subLevel: SubLevelNumber
): { difficulty: DifficultyId; subLevel: SubLevelNumber } | null {
  if (subLevel < 5) {
    return { difficulty, subLevel: (subLevel + 1) as SubLevelNumber };
  }
  if (difficulty === 'easy') {
    return { difficulty: 'medium', subLevel: 1 };
  }
  if (difficulty === 'medium') {
    return { difficulty: 'hard', subLevel: 1 };
  }
  return null;
}
