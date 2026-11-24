import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buyRadar,
  createDefaultProgress,
  equipRadar,
  isRadarUnlocked,
  isSubLevelUnlocked,
  recordLevelWin,
  sanitizeProgress,
  unlockAndEquipRadar,
} from './progression';
import { getNextLevel } from './levels';

test('default progress unlocks only sub-level 1 for Easy, Medium, and Hard while locking 2 through 5', () => {
  const prog = createDefaultProgress();

  for (const diff of ['easy', 'medium', 'hard'] as const) {
    assert.equal(isSubLevelUnlocked(prog, diff, 1), true);
    assert.equal(isSubLevelUnlocked(prog, diff, 2), false);
    assert.equal(isSubLevelUnlocked(prog, diff, 3), false);
    assert.equal(isSubLevelUnlocked(prog, diff, 4), false);
    assert.equal(isSubLevelUnlocked(prog, diff, 5), false);
  }

  assert.equal(prog.coins, 0);
  assert.equal(prog.selectedRadarId, 'mk1');
  assert.equal(isRadarUnlocked(prog, 'mk1'), true);
  assert.equal(isRadarUnlocked(prog, 'aegis'), false);
});

test('winning sub-levels 1 through 4 unlocks sub-levels 2 through 5 sequentially per difficulty', () => {
  let curr = createDefaultProgress();
  const win1 = recordLevelWin(curr, 'easy', 1, 3);

  assert.ok(win1.coinsEarned >= 45);
  assert.equal(win1.newlyUnlockedSubLevel, 2);
  assert.equal(isSubLevelUnlocked(win1.nextProgress, 'easy', 2), true);
  assert.equal(isSubLevelUnlocked(win1.nextProgress, 'easy', 3), false);
  assert.equal(isSubLevelUnlocked(win1.nextProgress, 'medium', 2), false);
  assert.equal(isSubLevelUnlocked(win1.nextProgress, 'hard', 2), false);

  curr = recordLevelWin(win1.nextProgress, 'easy', 2, 2).nextProgress;
  curr = recordLevelWin(curr, 'easy', 3, 2).nextProgress;
  const win4 = recordLevelWin(curr, 'easy', 4, 1);
  assert.equal(win4.newlyUnlockedSubLevel, 5);
  assert.equal(isSubLevelUnlocked(win4.nextProgress, 'easy', 5), true);

  const win5 = recordLevelWin(win4.nextProgress, 'easy', 5, 1);
  assert.equal(win5.newlyUnlockedSubLevel, null);
});

test('radars never auto-unlock on win or equip; only explicit buyRadar with enough coins unlocks them', () => {
  const poor = createDefaultProgress();
  const denied = buyRadar(poor, 'aegis');
  assert.equal(denied.purchased, false);
  assert.equal(denied.nextProgress.selectedRadarId, 'mk1');
  assert.equal(isRadarUnlocked(denied.nextProgress, 'aegis'), false);

  // Win Easy 1 with 3 missiles left -> 60 coins (exact cost of Aegis Wideband), still locked until bought
  const { nextProgress: rich } = recordLevelWin(poor, 'easy', 1, 3);
  assert.equal(rich.coins, 60);
  assert.equal(isRadarUnlocked(rich, 'aegis'), false);

  // Trying to equip without buying does not unlock or spend coins
  const equippedWithoutBuying = equipRadar(rich, 'aegis');
  assert.equal(equippedWithoutBuying.selectedRadarId, 'mk1');
  assert.equal(equippedWithoutBuying.coins, 60);
  assert.equal(isRadarUnlocked(equippedWithoutBuying, 'aegis'), false);

  // Explicit purchase when affordable unlocks, deducts coins, and equips
  const bought = buyRadar(rich, 'aegis');
  assert.equal(bought.purchased, true);
  assert.equal(bought.nextProgress.coins, 0);
  assert.equal(isRadarUnlocked(bought.nextProgress, 'aegis'), true);
  assert.equal(bought.nextProgress.selectedRadarId, 'aegis');

  // Can switch back to mk1 and back to aegis without spending more coins
  const backToMk1 = equipRadar(bought.nextProgress, 'mk1');
  assert.equal(backToMk1.selectedRadarId, 'mk1');
  const backToAegis = equipRadar(backToMk1, 'aegis');
  assert.equal(backToAegis.selectedRadarId, 'aegis');
  assert.equal(backToAegis.coins, 0);

  // Legacy unlockAndEquipRadar still respects coin guard
  const legacyDenied = unlockAndEquipRadar(poor, 'valkyrie');
  assert.equal(legacyDenied.purchased, false);
});

test('getNextLevel advances across all 5 sub-levels and difficulties cleanly', () => {
  assert.deepEqual(getNextLevel('easy', 1), { difficulty: 'easy', subLevel: 2 });
  assert.deepEqual(getNextLevel('easy', 4), { difficulty: 'easy', subLevel: 5 });
  assert.deepEqual(getNextLevel('easy', 5), { difficulty: 'medium', subLevel: 1 });
  assert.deepEqual(getNextLevel('medium', 5), { difficulty: 'hard', subLevel: 1 });
  assert.equal(getNextLevel('hard', 5), null);
});

test('sanitizeProgress rejects invalid data and preserves valid unlocks up to level 5', () => {
  const clean = sanitizeProgress({
    coins: 150,
    unlockedRadars: ['aegis', 'bogus'],
    selectedRadarId: 'valkyrie', // not unlocked -> falls back to mk1
    unlockedSubLevels: { easy: 5, medium: 99, hard: 4 },
    clearedLevelIds: ['easy-1', 123],
  });
  assert.equal(clean.coins, 150);
  assert.deepEqual(clean.unlockedRadars, ['mk1', 'aegis']);
  assert.equal(clean.selectedRadarId, 'mk1');
  assert.deepEqual(clean.unlockedSubLevels, { easy: 5, medium: 1, hard: 4 });
  assert.deepEqual(clean.clearedLevelIds, ['easy-1']);
});
