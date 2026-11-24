import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePolarSignal,
  computeShakeOffset,
  createInitialState,
  startRun,
  stepSimulation,
  wrapAngle,
} from './engine';
import { GAME_CONFIG, InputState } from './types';

const NO_INPUT: InputState = {
  left: false,
  right: false,
  fireJustPressed: false,
};

test('computePolarSignal wraps 360 degrees cleanly and clamps 0..100', () => {
  // Radar pointing straight up (0 rad), ship directly up (0, 120) -> 100%
  const deadOn = computePolarSignal(0, 0, 120);
  assert.equal(Math.round(deadOn.signal), 100);
  assert.equal(Math.round(deadOn.angularDistanceDeg), 0);

  // Wrap-around across -pi / +pi: radar at +175 deg, ship at -175 deg -> 10 deg apart
  const radarRad = (175 * Math.PI) / 180;
  const shipAngle = (-175 * Math.PI) / 180;
  const shipX = Math.sin(shipAngle) * 120;
  const shipY = Math.cos(shipAngle) * 120;
  const wrapped = computePolarSignal(radarRad, shipX, shipY);
  assert.ok(Math.abs(wrapped.angularDistanceDeg - 10) < 0.01);
  assert.ok(Math.abs(wrapped.signal - 75) < 0.05);

  // Opposite side (180 deg) -> 0%
  const opposite = computePolarSignal(0, 0, -120);
  assert.equal(opposite.signal, 0);
});

test('center radar rotates smoothly 360 degrees left and right', () => {
  const state = startRun(null, () => 0.5);
  const startAngle = state.radar.angle;
  for (let i = 0; i < 40; i++) {
    stepSimulation(state, 0.05, { left: false, right: true, fireJustPressed: false });
  }
  assert.notEqual(state.radar.angle, startAngle);
  assert.ok(state.radar.angle >= -Math.PI && state.radar.angle <= Math.PI);
});

test('opponent ship orbits around center within radial bounds', () => {
  const state = startRun(null, () => 0.4);
  const initialAngle = state.ship.orbitAngle;
  for (let i = 0; i < 30; i++) {
    stepSimulation(state, 0.05, NO_INPUT);
  }
  assert.notEqual(state.ship.orbitAngle, initialAngle);
  const r = Math.hypot(state.ship.x, state.ship.y);
  assert.ok(r >= GAME_CONFIG.SHIP_ORBIT_MIN_RADIUS - 0.5);
  assert.ok(r <= GAME_CONFIG.SHIP_ORBIT_MAX_RADIUS + 0.5);
});

test('opponent reveals only when Signal >= 80', () => {
  const state = startRun(null, () => 0.5);
  // Place ship on opposite side of radar
  state.radar.angle = 0;
  state.ship.orbitAngle = Math.PI;
  state.ship.x = Math.sin(Math.PI) * 120;
  state.ship.y = Math.cos(Math.PI) * 120;
  stepSimulation(state, 0.016, NO_INPUT);
  assert.equal(state.ship.visible, false);
  assert.equal(state.signal, 0);

  // Align radar with ship's current orbitAngle
  state.radar.angle = state.ship.orbitAngle;
  const events = stepSimulation(state, 0.016, NO_INPUT);
  assert.ok(state.signal >= GAME_CONFIG.LOCK_SIGNAL_THRESHOLD);
  assert.equal(state.ship.visible, true);
  assert.ok(events.some((e) => e.type === 'lock_acquired'));
});

test('ShotActive guard prevents firing two missiles simultaneously from center', () => {
  const state = startRun(null, () => 0.5);
  const ev1 = stepSimulation(state, 0.016, {
    left: false,
    right: false,
    fireJustPressed: true,
  });
  assert.equal(state.missiles, 2);
  assert.equal(state.missile.active, true);
  assert.ok(ev1.some((e) => e.type === 'missile_fired'));

  const ev2 = stepSimulation(state, 0.016, {
    left: false,
    right: false,
    fireJustPressed: true,
  });
  assert.equal(state.missiles, 2);
  assert.equal(ev2.some((e) => e.type === 'missile_fired'), false);
});

test('aligned missile fired from center destroys opponent ship and wins', () => {
  const state = startRun(null, () => 0.5);
  // Lead slightly ahead of opponent's orbit
  state.radar.angle = wrapAngle(
    state.ship.orbitAngle + state.ship.orbitDir * 0.14
  );

  stepSimulation(state, 0.016, {
    left: false,
    right: false,
    fireJustPressed: true,
  });

  let sawHit = false;
  let sawWin = false;
  for (let i = 0; i < 60; i++) {
    const events = stepSimulation(state, 0.03, NO_INPUT);
    if (events.some((e) => e.type === 'missile_hit')) sawHit = true;
    if (events.some((e) => e.type === 'win')) sawWin = true;
    if (state.phase === 'gameover') break;
  }

  assert.equal(sawHit, true);
  assert.equal(sawWin, true);
  assert.equal(state.phase, 'gameover');
  assert.equal(state.outcome, 'win');
  assert.equal(state.playerAlive, true);
});

test('three misses trigger opponent counter-strike that destroys our center ship', () => {
  const state = startRun(null, () => 0.5);

  for (let shot = 0; shot < 3; shot++) {
    // Always aim 180 degrees away from opponent so all 3 shots miss
    state.radar.angle = wrapAngle(state.ship.orbitAngle + Math.PI);
    stepSimulation(state, 0.016, {
      left: false,
      right: false,
      fireJustPressed: true,
    });
    for (let f = 0; f < 40; f++) {
      stepSimulation(state, 0.03, NO_INPUT);
      if (!state.missile.active) break;
    }
  }

  let sawCounterFire = false;
  let sawPlayerDestroyed = false;
  for (let f = 0; f < 60; f++) {
    const events = stepSimulation(state, 0.03, NO_INPUT);
    if (events.some((e) => e.type === 'enemy_counter_fire')) sawCounterFire = true;
    if (events.some((e) => e.type === 'player_destroyed')) sawPlayerDestroyed = true;
    if (state.phase === 'gameover') break;
  }

  assert.equal(state.missiles, 0);
  assert.equal(sawCounterFire || state.enemyStrike !== null || !state.playerAlive, true);
  assert.equal(sawPlayerDestroyed, true);
  assert.equal(state.playerAlive, false);
  assert.equal(state.phase, 'gameover');
  assert.equal(state.outcome, 'lose');
  assert.equal(state.lossReason, 'missiles');
  assert.equal(state.lastSnapshot?.playerDestroyed, true);
});

test('30-second timeout triggers opponent counter-strike and restart revives player', () => {
  const state = startRun(null, () => 0.5);
  let sawCounter = false;
  let sawPlayerDestroyed = false;

  for (let i = 0; i < 680; i++) {
    const events = stepSimulation(state, 0.05, NO_INPUT);
    if (events.some((e) => e.type === 'enemy_counter_fire')) sawCounter = true;
    if (events.some((e) => e.type === 'player_destroyed')) sawPlayerDestroyed = true;
    if (state.phase === 'gameover') break;
  }

  assert.equal(state.timeLeft, 0);
  assert.equal(sawCounter, true);
  assert.equal(sawPlayerDestroyed, true);
  assert.equal(state.playerAlive, false);
  assert.equal(state.phase, 'gameover');
  assert.equal(state.outcome, 'lose');
  assert.equal(state.lossReason, 'timeout');

  const restarted = startRun(state, () => 0.2);
  assert.equal(restarted.phase, 'playing');
  assert.equal(restarted.playerAlive, true);
  assert.equal(restarted.enemyStrike, null);
  assert.equal(restarted.radar.angle, 0);
  assert.equal(restarted.missiles, restarted.maxMissiles);
  assert.equal(restarted.timeLeft, restarted.roundDuration);
});

test('title, armory, and levels menu phases stay idle unless autostart=true', () => {
  const menuState = createInitialState(() => 0.5, false);
  assert.equal(menuState.phase, 'title');
  const events = stepSimulation(menuState, 0.05, {
    left: false,
    right: true,
    fireJustPressed: true,
  });
  assert.equal(events.length, 0);
  assert.equal(menuState.radar.angle, 0);

  for (const menuPhase of ['armory', 'levels'] as const) {
    menuState.phase = menuPhase;
    const menuEvents = stepSimulation(menuState, 0.05, {
      left: false,
      right: true,
      fireJustPressed: true,
    });
    assert.equal(menuEvents.length, 0);
    assert.equal(menuState.radar.angle, 0);
  }
});

test('computeShakeOffset scales quadratically with trauma and zeroes at rest', () => {
  assert.deepEqual(computeShakeOffset(0, 1.2), { x: 0, y: 0, rotDeg: 0 });
  assert.deepEqual(computeShakeOffset(0.01, 1.2), { x: 0, y: 0, rotDeg: 0 });

  const light = computeShakeOffset(0.4, 0.5, 14);
  const heavy = computeShakeOffset(1.0, 0.5, 14);
  assert.ok(Math.abs(light.x) > 0 || Math.abs(light.y) > 0);
  assert.ok(Math.hypot(heavy.x, heavy.y) > Math.hypot(light.x, light.y) * 3);
});

test('firing missile and player hit spike trauma for HUD screen shake', () => {
  const state = startRun(null, () => 0.5);
  assert.equal(state.trauma, 0);

  stepSimulation(state, 0.016, {
    left: false,
    right: false,
    fireJustPressed: true,
  });
  assert.ok(state.trauma >= 0.45);

  // Trigger player hit via timeout counter-strike
  state.roundElapsed = GAME_CONFIG.ROUND_DURATION;
  stepSimulation(state, 0.016, NO_INPUT);
  let hitTrauma = 0;
  for (let i = 0; i < 60; i++) {
    const events = stepSimulation(state, 0.03, NO_INPUT);
    if (events.some((e) => e.type === 'player_destroyed')) {
      hitTrauma = state.trauma;
      break;
    }
  }
  assert.equal(hitTrauma, 1.0);
});

test('each game load and restart places opponent at a different orbital distance from radar', () => {
  const makeRng = (val: number) => () => val;
  const closeRun = startRun(null, makeRng(0.08));
  const midRun = startRun(null, makeRng(0.5));
  const farRun = startRun(null, makeRng(0.92));

  assert.ok(closeRun.ship.baseRadius < midRun.ship.baseRadius - 20);
  assert.ok(midRun.ship.baseRadius < farRun.ship.baseRadius - 20);
  assert.notEqual(
    Math.round(closeRun.ship.orbitRadius),
    Math.round(farRun.ship.orbitRadius)
  );

  // Even after simulating 1.5s, their average/current radii remain distinctly separated
  for (let i = 0; i < 30; i++) {
    stepSimulation(closeRun, 0.05, NO_INPUT);
    stepSimulation(farRun, 0.05, NO_INPUT);
  }
  const closeR = Math.hypot(closeRun.ship.x, closeRun.ship.y);
  const farR = Math.hypot(farRun.ship.x, farRun.ship.y);
  assert.ok(farR > closeR + 15);
});

test('opponent flight path reverses direction and varies radius rather than looping one way', () => {
  const state = startRun(null, () => 0.42);
  let minVel = state.ship.angularVel;
  let maxVel = state.ship.angularVel;
  let minRadius = state.ship.orbitRadius;
  let maxRadius = state.ship.orbitRadius;
  let sawSignFlip = false;
  const initialSign = Math.sign(state.ship.angularVel);

  for (let i = 0; i < 240; i++) {
    stepSimulation(state, 0.05, NO_INPUT); // 12 seconds
    minVel = Math.min(minVel, state.ship.angularVel);
    maxVel = Math.max(maxVel, state.ship.angularVel);
    minRadius = Math.min(minRadius, state.ship.orbitRadius);
    maxRadius = Math.max(maxRadius, state.ship.orbitRadius);
    if (Math.sign(state.ship.angularVel) !== initialSign && Math.abs(state.ship.angularVel) > 0.1) {
      sawSignFlip = true;
    }
    assert.ok(state.ship.orbitRadius >= GAME_CONFIG.SHIP_ORBIT_MIN_RADIUS - 0.01);
    assert.ok(state.ship.orbitRadius <= GAME_CONFIG.SHIP_ORBIT_MAX_RADIUS + 0.01);
  }

  assert.equal(sawSignFlip, true, 'expected opponent to reverse orbital direction');
  assert.ok(maxVel - minVel > 0.5, 'expected angular velocity variation');
  assert.ok(maxRadius - minRadius > 12, 'expected radial distance variation during flight');
});

test('difficulty modes and equipped radars apply distinct mechanical scaling across 5 levels', () => {
  const easy = startRun(null, () => 0.5, {
    difficulty: 'easy',
    subLevel: 1,
    radarId: 'mk1',
  });
  const hard = startRun(null, () => 0.5, {
    difficulty: 'hard',
    subLevel: 5,
    radarId: 'solaris',
  });

  assert.equal(easy.maxMissiles, 4);
  assert.equal(easy.enemyMaxHp, 1);
  assert.equal(easy.timeLeft, 35);
  assert.equal(easy.levelConfig.lockThreshold, 72);

  assert.equal(hard.maxMissiles, 3);
  assert.equal(hard.enemyMaxHp, 3);
  assert.equal(hard.timeLeft, 20);
  assert.equal(hard.levelConfig.lockThreshold, 92);
  assert.ok(hard.levelConfig.enemySpeedRad > easy.levelConfig.enemySpeedRad * 3);

  // Solaris radar rotates faster and boosts missile velocity
  stepSimulation(easy, 0.05, { left: false, right: true, fireJustPressed: true });
  stepSimulation(hard, 0.05, { left: false, right: true, fireJustPressed: true });

  assert.ok(hard.radar.angularVel > easy.radar.angularVel);
  assert.ok(Math.hypot(hard.missile.vx, hard.missile.vy) > Math.hypot(easy.missile.vx, easy.missile.vy));
  assert.equal(easy.launchShockwave.active, true);
  assert.ok(easy.missile.flightTime > 0);
});

test('multi-hit armored levels require multiple direct hits and trigger counter-strike if missiles < enemyHp', () => {
  const state = startRun(null, () => 0.5, {
    difficulty: 'easy',
    subLevel: 4,
    radarId: 'mk1',
  });
  assert.equal(state.enemyMaxHp, 2);
  assert.equal(state.enemyHp, 2);

  // First direct hit cracks armor (shield_hit) without ending game
  state.radar.angle = wrapAngle(state.ship.orbitAngle + state.ship.orbitDir * 0.14);
  stepSimulation(state, 0.016, { left: false, right: false, fireJustPressed: true });
  let sawShieldHit = false;
  for (let i = 0; i < 40; i++) {
    const ev = stepSimulation(state, 0.025, NO_INPUT);
    if (ev.some((e) => e.type === 'shield_hit')) sawShieldHit = true;
    if (!state.missile.active) break;
  }
  assert.equal(sawShieldHit, true);
  assert.equal(state.enemyHp, 1);
  assert.equal(state.phase, 'playing');

  // Second direct hit destroys the armored ship
  state.hitstopTimer = 0;
  state.radar.angle = wrapAngle(state.ship.orbitAngle + state.ship.orbitDir * 0.14);
  stepSimulation(state, 0.016, { left: false, right: false, fireJustPressed: true });
  for (let i = 0; i < 60; i++) {
    stepSimulation(state, 0.03, NO_INPUT);
    if (state.outcome !== null) break;
  }
  assert.equal(state.enemyHp, 0);
  assert.equal(state.outcome, 'win');
});



