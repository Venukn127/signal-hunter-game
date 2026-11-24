import {
  DifficultyId,
  RADARS,
  RadarId,
  SubLevelNumber,
  getLevelConfig,
  getRadarConfig,
} from './levels';

export interface PlayerProgress {
  coins: number;
  unlockedRadars: RadarId[];
  selectedRadarId: RadarId;
  unlockedSubLevels: Record<DifficultyId, SubLevelNumber>;
  clearedLevelIds: string[];
}

export const PROGRESS_STORAGE_KEY = 'signal_hunter_progress_v1';

export function createDefaultProgress(): PlayerProgress {
  return {
    coins: 0,
    unlockedRadars: ['mk1'],
    selectedRadarId: 'mk1',
    // Only the 1st sub-level of Easy, Medium, and Hard starts unlocked; sub-levels 2 & 3 stay locked until the prior sub-level is achieved.
    unlockedSubLevels: {
      easy: 1,
      medium: 1,
      hard: 1,
    },
    clearedLevelIds: [],
  };
}

export function isSubLevelUnlocked(
  progress: PlayerProgress,
  difficulty: DifficultyId,
  subLevel: SubLevelNumber
): boolean {
  const highest = progress.unlockedSubLevels[difficulty] ?? 1;
  return subLevel <= highest;
}

export function isLevelCleared(
  progress: PlayerProgress,
  difficulty: DifficultyId,
  subLevel: SubLevelNumber
): boolean {
  const cfg = getLevelConfig(difficulty, subLevel);
  return progress.clearedLevelIds.includes(cfg.id);
}

export function isRadarUnlocked(
  progress: PlayerProgress,
  radarId: RadarId
): boolean {
  return progress.unlockedRadars.includes(radarId);
}

export function computeWinCoinReward(
  difficulty: DifficultyId,
  subLevel: SubLevelNumber,
  missilesLeft: number,
  isFirstClear: boolean
): {
  baseCoins: number;
  ammoBonus: number;
  firstClearBonus: number;
  totalCoins: number;
} {
  const level = getLevelConfig(difficulty, subLevel);
  const baseCoins = level.coinReward;
  const ammoBonus = Math.max(0, missilesLeft) * 5;
  const firstClearBonus = isFirstClear ? 15 : 0;
  return {
    baseCoins,
    ammoBonus,
    firstClearBonus,
    totalCoins: baseCoins + ammoBonus + firstClearBonus,
  };
}

export function recordLevelWin(
  progress: PlayerProgress,
  difficulty: DifficultyId,
  subLevel: SubLevelNumber,
  missilesLeft: number
): {
  nextProgress: PlayerProgress;
  coinsEarned: number;
  newlyUnlockedSubLevel: SubLevelNumber | null;
} {
  const level = getLevelConfig(difficulty, subLevel);
  const isFirstClear = !progress.clearedLevelIds.includes(level.id);
  const reward = computeWinCoinReward(
    difficulty,
    subLevel,
    missilesLeft,
    isFirstClear
  );

  const currentUnlocked = progress.unlockedSubLevels[difficulty] ?? 1;
  let nextUnlocked = currentUnlocked;
  let newlyUnlockedSubLevel: SubLevelNumber | null = null;

  if (subLevel >= currentUnlocked && subLevel < 5) {
    nextUnlocked = (subLevel + 1) as SubLevelNumber;
    newlyUnlockedSubLevel = nextUnlocked;
  }

  const nextCleared = isFirstClear
    ? [...progress.clearedLevelIds, level.id]
    : progress.clearedLevelIds;

  const nextProgress: PlayerProgress = {
    ...progress,
    coins: progress.coins + reward.totalCoins,
    unlockedSubLevels: {
      ...progress.unlockedSubLevels,
      [difficulty]: nextUnlocked,
    },
    clearedLevelIds: nextCleared,
  };

  return {
    nextProgress,
    coinsEarned: reward.totalCoins,
    newlyUnlockedSubLevel,
  };
}

export function equipRadar(
  progress: PlayerProgress,
  radarId: RadarId
): PlayerProgress {
  if (!isRadarUnlocked(progress, radarId)) {
    return progress;
  }
  return {
    ...progress,
    selectedRadarId: radarId,
  };
}

export function buyRadar(
  progress: PlayerProgress,
  radarId: RadarId
): { nextProgress: PlayerProgress; purchased: boolean } {
  if (isRadarUnlocked(progress, radarId)) {
    return { nextProgress: progress, purchased: false };
  }
  const radar = getRadarConfig(radarId);
  if (progress.coins < radar.cost) {
    return { nextProgress: progress, purchased: false };
  }
  return {
    nextProgress: {
      ...progress,
      coins: progress.coins - radar.cost,
      unlockedRadars: [...progress.unlockedRadars, radarId],
      selectedRadarId: radarId,
    },
    purchased: true,
  };
}

export function unlockAndEquipRadar(
  progress: PlayerProgress,
  radarId: RadarId
): { nextProgress: PlayerProgress; purchased: boolean } {
  if (isRadarUnlocked(progress, radarId)) {
    return {
      nextProgress: equipRadar(progress, radarId),
      purchased: false,
    };
  }
  return buyRadar(progress, radarId);
}

export function sanitizeProgress(raw: unknown): PlayerProgress {
  const fallback = createDefaultProgress();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<PlayerProgress>;

  const validRadarIds = new Set(RADARS.map((r) => r.id));
  const unlockedRadars: RadarId[] = Array.isArray(obj.unlockedRadars)
    ? Array.from(
        new Set([
          'mk1' as RadarId,
          ...obj.unlockedRadars.filter((id): id is RadarId =>
            validRadarIds.has(id as RadarId)
          ),
        ])
      )
    : ['mk1'];

  const selectedRadarId: RadarId =
    obj.selectedRadarId && unlockedRadars.includes(obj.selectedRadarId)
      ? obj.selectedRadarId
      : 'mk1';

  const clampSub = (v: unknown): SubLevelNumber => {
    if (v === 2) return 2;
    if (v === 3) return 3;
    if (v === 4) return 4;
    if (v === 5) return 5;
    return 1;
  };

  const unlockedSubLevels = {
    easy: clampSub(obj.unlockedSubLevels?.easy),
    medium: clampSub(obj.unlockedSubLevels?.medium),
    hard: clampSub(obj.unlockedSubLevels?.hard),
  };

  const clearedLevelIds = Array.isArray(obj.clearedLevelIds)
    ? obj.clearedLevelIds.filter((x): x is string => typeof x === 'string')
    : [];

  return {
    coins:
      typeof obj.coins === 'number' && Number.isFinite(obj.coins) && obj.coins >= 0
        ? Math.floor(obj.coins)
        : 0,
    unlockedRadars,
    selectedRadarId,
    unlockedSubLevels,
    clearedLevelIds,
  };
}

export function loadProgress(): PlayerProgress {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultProgress();
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return createDefaultProgress();
    return sanitizeProgress(JSON.parse(raw));
  } catch {
    return createDefaultProgress();
  }
}

export function saveProgress(progress: PlayerProgress): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota / private mode errors
  }
}
