import { GAME_CONFIG, GameState, STAGE_BOUNDS } from './types';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
}

interface TrailPoint {
  active: boolean;
  x: number;
  y: number;
}

interface MissPulse {
  active: boolean;
  x: number;
  y: number;
  elapsed: number;
  duration: number;
}

interface NebulaCloud {
  canvas: HTMLCanvasElement;
  nx: number; // normalized anchor 0..1
  ny: number;
  scaleFactor: number;
  depth: number; // parallax weight
  driftX: number;
  driftY: number;
  alpha: number;
}

const MAX_PARTICLES = 200;
const MAX_TRAIL = 16;
const STAR_COUNT = 84;
const AIRCRAFT_SPRITE_URL = '/assets/aistudio/image_fee50dfe.png';

function buildProceduralNebulae(): NebulaCloud[] {
  if (typeof document === 'undefined') return [];

  let seed = 8191;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const palettes: Array<[number, number, number, number, number, number]> = [
    [56, 189, 248, 20, 184, 166], // cyan-teal cosmic veil
    [99, 102, 241, 139, 92, 246], // deep indigo-violet dust
    [245, 158, 11, 190, 24, 93], // warm amber-crimson filament
    [14, 116, 144, 59, 130, 246], // abyssal blue-teal drift
  ];

  return palettes.map((pal, idx) => {
    const size = 220;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const nctx = canvas.getContext('2d');
    if (nctx) {
      const puffs = 8;
      for (let p = 0; p < puffs; p++) {
        const angle = rand() * Math.PI * 2;
        const dist = rand() * size * 0.22;
        const px = size * 0.5 + Math.cos(angle) * dist;
        const py = size * 0.5 + Math.sin(angle) * dist;
        const r = size * (0.22 + rand() * 0.24);
        const mix = rand();
        const cr = Math.round(pal[0] * (1 - mix) + pal[3] * mix);
        const cg = Math.round(pal[1] * (1 - mix) + pal[4] * mix);
        const cb = Math.round(pal[2] * (1 - mix) + pal[5] * mix);
        const peakAlpha = 0.05 + rand() * 0.045;

        const grad = nctx.createRadialGradient(px, py, 2, px, py, r);
        grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${peakAlpha.toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, ${(peakAlpha * 0.42).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        nctx.fillStyle = grad;
        nctx.beginPath();
        nctx.arc(px, py, r, 0, Math.PI * 2);
        nctx.fill();
      }
    }

    return {
      canvas,
      nx: (idx * 0.29 + 0.12) % 1,
      ny: (idx * 0.34 + 0.15) % 1,
      scaleFactor: 0.38 + (idx % 2) * 0.14,
      depth: 0.32 + idx * 0.16,
      driftX: (idx % 2 === 0 ? 1 : -1) * (0.004 + idx * 0.0015),
      driftY: 0.005 + idx * 0.002,
      alpha: 0.9,
    };
  });
}

function buildKeyedAircraftSprites(img: HTMLImageElement): {
  player: HTMLCanvasElement;
  enemy: HTMLCanvasElement;
} | null {
  if (typeof document === 'undefined') return null;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const playerCanvas = document.createElement('canvas');
  playerCanvas.width = w;
  playerCanvas.height = h;
  const pCtx = playerCanvas.getContext('2d');
  if (!pCtx) return null;

  pCtx.drawImage(img, 0, 0, w, h);
  const imgData = pCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample top-left pixel as solid backdrop color to key out cleanly
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];
  const bgAlpha = data[3];

  const enemyCanvas = document.createElement('canvas');
  enemyCanvas.width = w;
  enemyCanvas.height = h;
  const eCtx = enemyCanvas.getContext('2d');
  const enemyData = eCtx ? eCtx.createImageData(w, h) : null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      let a = data[idx + 3];

      // Trim stray 1-3px artifact on far right edge of source image
      if (x >= w - 4) {
        a = 0;
      } else if (bgAlpha > 200) {
        const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
        if (dist < 14) {
          a = 0;
        } else if (dist < 34) {
          a = Math.round(a * ((dist - 14) / 20));
        }
      }

      data[idx + 3] = a;

      if (enemyData) {
        // Hostile crimson/amber color-shifted fighter variant
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        enemyData.data[idx] = Math.min(255, Math.round(lum * 1.48 + 42));
        enemyData.data[idx + 1] = Math.max(0, Math.round(g * 0.42));
        enemyData.data[idx + 2] = Math.max(0, Math.round(b * 0.36));
        enemyData.data[idx + 3] = a;
      }
    }
  }

  pCtx.putImageData(imgData, 0, 0);
  if (eCtx && enemyData) {
    eCtx.putImageData(enemyData, 0, 0);
  }

  return { player: playerCanvas, enemy: enemyCanvas };
}

export class GameRenderer {
  private particles: Particle[];
  private particleCursor = 0;
  private missileTrail: TrailPoint[];
  private missileTrailCount = 0;
  private enemyTrail: TrailPoint[];
  private enemyTrailCount = 0;
  private missPulse: MissPulse = {
    active: false,
    x: 0,
    y: 0,
    elapsed: 0,
    duration: 0.34,
  };
  private stars: Star[];
  private nebulae: NebulaCloud[];
  private ambientTime = 0;
  private bgCache: HTMLCanvasElement | null = null;
  private bgCacheW = 0;
  private bgCacheH = 0;
  private scopeCache: HTMLCanvasElement | null = null;
  private scopeCacheKey = '';
  private playerSprite: HTMLCanvasElement | null = null;
  private enemySprite: HTMLCanvasElement | null = null;
  private spriteDirty = false;

  constructor() {
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      r: 255,
      g: 255,
      b: 255,
    }));

    this.missileTrail = Array.from({ length: MAX_TRAIL }, () => ({
      active: false,
      x: 0,
      y: 0,
    }));

    this.enemyTrail = Array.from({ length: MAX_TRAIL }, () => ({
      active: false,
      x: 0,
      y: 0,
    }));

    let seed = 4219;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    this.stars = Array.from({ length: STAR_COUNT }, () => ({
      x: rand() * 2 - 1,
      y: rand() * 2 - 1,
      radius: 0.7 + rand() * 1.4,
      alpha: 0.16 + rand() * 0.55,
      speed: 0.008 + rand() * 0.022,
    }));

    this.nebulae = buildProceduralNebulae();

    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        const processed = buildKeyedAircraftSprites(img);
        if (processed) {
          this.playerSprite = processed.player;
          this.enemySprite = processed.enemy;
          this.spriteDirty = true;
        }
      };
      img.src = AIRCRAFT_SPRITE_URL;
    }
  }

  public consumeDirty(): boolean {
    if (!this.spriteDirty) return false;
    this.spriteDirty = false;
    return true;
  }

  public clearParticles(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles[i].active = false;
    }
    this.missileTrailCount = 0;
    this.enemyTrailCount = 0;
    this.missPulse.active = false;
  }

  public spawnMissPulse(x: number, y: number): void {
    this.missPulse.active = true;
    this.missPulse.x = x;
    this.missPulse.y = y;
    this.missPulse.elapsed = 0;
    this.missPulse.duration = 0.34;
  }

  public hasActiveVisuals(): boolean {
    if (this.missPulse.active) return true;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.particles[i].active) return true;
    }
    return false;
  }

  public spawnBurst(
    x: number,
    y: number,
    count: number,
    color: [number, number, number],
    speedMin: number,
    speedMax: number,
    lifeMin: number,
    lifeMax: number,
    sizeMin: number,
    sizeMax: number
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;

      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = lifeMin + Math.random() * (lifeMax - lifeMin);
      p.life = p.maxLife;
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.r = color[0];
      p.g = color[1];
      p.b = color[2];
    }
  }

  public spawnDirectionalExhaust(
    x: number,
    y: number,
    backVx: number,
    backVy: number,
    color: [number, number, number]
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;

    p.active = true;
    p.x = x + (Math.random() - 0.5) * 3;
    p.y = y + (Math.random() - 0.5) * 3;
    p.vx = backVx + (Math.random() - 0.5) * 28;
    p.vy = backVy + (Math.random() - 0.5) * 28;
    p.maxLife = 0.18 + Math.random() * 0.14;
    p.life = p.maxLife;
    p.size = 1.6 + Math.random() * 1.5;
    p.r = color[0];
    p.g = color[1];
    p.b = color[2];
  }

  private pushTrailPoint(
    trail: TrailPoint[],
    count: number,
    x: number,
    y: number
  ): number {
    const nextCount = Math.min(MAX_TRAIL, count + 1);
    for (let i = nextCount - 1; i > 0; i--) {
      trail[i].x = trail[i - 1].x;
      trail[i].y = trail[i - 1].y;
      trail[i].active = true;
    }
    trail[0].x = x;
    trail[0].y = y;
    trail[0].active = true;
    return nextCount;
  }

  public updateVisuals(dt: number, state: GameState): void {
    this.ambientTime += dt;

    for (let i = 0; i < this.nebulae.length; i++) {
      const n = this.nebulae[i];
      n.nx += n.driftX * dt;
      n.ny += n.driftY * dt;
      if (n.nx > 1.35) n.nx = -0.35;
      if (n.nx < -0.35) n.nx = 1.35;
      if (n.ny > 1.35) n.ny = -0.35;
      if (n.ny < -0.35) n.ny = 1.35;
    }

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.y += s.speed * dt;
      if (s.y > 1.05) {
        s.y = -1.05;
      }
    }

    if (this.missPulse.active) {
      this.missPulse.elapsed += dt;
      if (this.missPulse.elapsed >= this.missPulse.duration) {
        this.missPulse.active = false;
      }
    }

    if (state.phase === 'playing' && state.missile.active) {
      const tailX =
        state.missile.x - Math.sin(state.missile.angle) * 7;
      const tailY =
        state.missile.y - Math.cos(state.missile.angle) * 7;
      this.missileTrailCount = this.pushTrailPoint(
        this.missileTrail,
        this.missileTrailCount,
        tailX,
        tailY
      );

      const bx = -Math.sin(state.missile.angle) * 95;
      const by = -Math.cos(state.missile.angle) * 95;
      this.spawnDirectionalExhaust(
        tailX,
        tailY,
        bx,
        by,
        [245, 158, 11]
      );
      this.spawnDirectionalExhaust(
        tailX,
        tailY,
        bx * 0.75,
        by * 0.75,
        [254, 240, 138]
      );
      this.spawnDirectionalExhaust(
        tailX,
        tailY,
        bx * 0.45,
        by * 0.45,
        [148, 163, 184]
      );
    } else if (this.missileTrailCount > 0) {
      // Fade trail tail smoothly once missile resolves
      this.missileTrailCount = Math.max(0, this.missileTrailCount - 1);
    }

    if (
      state.phase === 'playing' &&
      state.enemyStrike &&
      state.enemyStrike.phase === 'incoming'
    ) {
      const es = state.enemyStrike;
      const tailX = es.x - Math.sin(es.angle) * 7;
      const tailY = es.y - Math.cos(es.angle) * 7;
      this.enemyTrailCount = this.pushTrailPoint(
        this.enemyTrail,
        this.enemyTrailCount,
        tailX,
        tailY
      );
      const bx = -Math.sin(es.angle) * 85;
      const by = -Math.cos(es.angle) * 85;
      this.spawnDirectionalExhaust(tailX, tailY, bx, by, [239, 68, 68]);
      this.spawnDirectionalExhaust(tailX, tailY, bx * 0.7, by * 0.7, [249, 115, 22]);
    } else if (this.enemyTrailCount > 0) {
      this.enemyTrailCount = Math.max(0, this.enemyTrailCount - 1);
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
  }

  private ensureBgCache(width: number, height: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    if (this.bgCache && this.bgCacheW === width && this.bgCacheH === height) {
      return this.bgCache;
    }
    const offscreen = this.bgCache ?? document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const octx = offscreen.getContext('2d');
    if (octx) {
      const bgGrad = octx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.08,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, '#0D1524');
      bgGrad.addColorStop(0.65, '#080D17');
      bgGrad.addColorStop(1, '#05080F');
      octx.fillStyle = bgGrad;
      octx.fillRect(0, 0, width, height);
    }
    this.bgCache = offscreen;
    this.bgCacheW = width;
    this.bgCacheH = height;
    return offscreen;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: GameState
  ): void {
    // 1. Deep-space obsidian backdrop
    const cachedBg = this.ensureBgCache(width, height);
    if (cachedBg) {
      ctx.drawImage(cachedBg, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#070B12';
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Parallax-scrolling procedurally generated cosmic nebulae
    const parallaxSrcAngle =
      state.phase === 'title' ||
      state.phase === 'armory' ||
      state.phase === 'levels'
        ? this.ambientTime * 0.45
        : state.radar.angle;
    const pSin = Math.sin(parallaxSrcAngle);
    const pCos = Math.cos(parallaxSrcAngle);
    const baseSpan = Math.max(width, height);

    for (let i = 0; i < this.nebulae.length; i++) {
      const n = this.nebulae[i];
      const drawSize = baseSpan * n.scaleFactor;
      const px =
        n.nx * width - pSin * n.depth * 34 - drawSize * 0.5;
      const py =
        n.ny * height - pCos * n.depth * 24 - drawSize * 0.5;
      ctx.globalAlpha = n.alpha;
      ctx.drawImage(n.canvas, px, py, drawSize, drawSize);
    }
    ctx.globalAlpha = 1;

    // 3. Full-bleed parallax starfield
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const sx = ((s.x * 0.5 + 0.5) * width - pSin * s.radius * 6 + width) % width;
      const sy = ((s.y * 0.5 + 0.5) * height - pCos * s.radius * 4 + height) % height;
      const twinkle = 0.78 + 0.22 * Math.sin(this.ambientTime * 1.8 + i);
      ctx.fillStyle = `rgba(226, 232, 240, ${(s.alpha * twinkle).toFixed(2)})`;
      const size = s.radius * 1.6;
      ctx.fillRect(sx, sy, size, size);
    }

    // Playfield scale ensures orbiting enemy aircraft spans generously while staying visible below HUD
    const padTop = Math.max(76, height * 0.13);
    const padBottom = Math.max(32, height * 0.06);
    const availW = Math.max(220, width - 32);
    const availH = Math.max(220, height - padTop - padBottom);
    const scale = Math.min(availW / 380, availH / 320);

    const centerX = width * 0.5;
    const centerY = padTop + availH * 0.5;
    // Full-screen radar radius spans from center all the way to the farthest screen corner
    const fullScreenRadius =
      Math.hypot(Math.max(centerX, width - centerX), Math.max(centerY, height - centerY)) *
      1.04;

    // Quadratic camera trauma shake
    const shakeMag = state.trauma * state.trauma * 11;
    const shakeX = shakeMag > 0.05 ? (Math.random() * 2 - 1) * shakeMag : 0;
    const shakeY = shakeMag > 0.05 ? (Math.random() * 2 - 1) * shakeMag : 0;

    const toPxX = (sx: number) => centerX + shakeX + sx * scale;
    const toPxY = (sy: number) => centerY + shakeY - sy * scale;

    // 4. Menu phases ambient full-screen radar sweep (reflects selected radar theme)
    if (
      state.phase === 'title' ||
      state.phase === 'armory' ||
      state.phase === 'levels'
    ) {
      this.renderTitleAmbientRadar(
        ctx,
        toPxX,
        toPxY,
        scale,
        width,
        height,
        state
      );
      return;
    }

    // 4. Full-screen polar radar scope rings & edge-to-edge crosshairs
    this.renderFullScreenScope(
      ctx,
      toPxX(0),
      toPxY(0),
      width,
      height,
      fullScreenRadius,
      scale,
      state
    );

    // 5. Rotating full-screen radar beam & center player aircraft
    this.renderCenterRadarAndShip(
      ctx,
      toPxX(0),
      toPxY(0),
      fullScreenRadius,
      scale,
      state
    );

    // 6. Launch Shockwave Cone at center launcher
    if (state.launchShockwave.active) {
      this.renderLaunchShockwave(ctx, toPxX, toPxY, scale, state);
    }

    // 7. Opponent Aircraft (visible when Signal >= lockThreshold, flashing on hit, or counter-attacking)
    if (state.ship.visible || state.shipFlashTimer > 0) {
      this.renderOpponentShip(ctx, toPxX, toPxY, scale, state);
    }

    // 8. Player Missile contrail + detailed animated interceptor missile
    if (this.missileTrailCount > 1) {
      this.renderContrail(
        ctx,
        this.missileTrail,
        this.missileTrailCount,
        toPxX,
        toPxY,
        scale,
        state.radarConfig.accentRgb,
        '254, 240, 138'
      );
    }
    if (state.missile.active) {
      this.renderMissile(
        ctx,
        toPxX(state.missile.x),
        toPxY(state.missile.y),
        state.missile.angle,
        scale,
        state.radarConfig.accentHex,
        '#FEF3C7',
        '#F97316'
      );
    }

    // 9. Enemy Counter-Strike (sightline + contrail + incoming enemy missile targeting center)
    if (state.enemyStrike && state.enemyStrike.phase === 'incoming') {
      this.renderEnemyStrike(ctx, toPxX, toPxY, scale, state);
    }

    // 10. Miss Fizzle Ring & Blast circles
    if (this.missPulse.active) {
      this.renderMissPulse(ctx, toPxX, toPxY, scale);
    }
    if (state.blast.active) {
      this.renderBlast(ctx, toPxX, toPxY, scale, state);
    }

    // 11. Pooled particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(toPxX(p.x), toPxY(p.y), p.size * (scale / 1.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // 11. Diegetic start instruction whisper on mobile (desktop uses the highlighted GameHud control legend)
    if (
      width < 768 &&
      state.phase === 'playing' &&
      state.promptTimer > 0 &&
      state.pendingWinRemaining === null &&
      state.enemyStrike === null
    ) {
      const promptAlpha = Math.min(1, state.promptTimer / 0.8);
      ctx.save();
      ctx.font = `600 ${Math.max(12, Math.round(10.5 * Math.min(scale, 1.35)))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(253, 224, 71, ${(0.94 * promptAlpha).toFixed(3)})`;
      ctx.fillText(
        `Tap ↺ / ↻ to lock ≥ ${state.levelConfig.lockThreshold}%, then Fire Missile!`,
        width * 0.5,
        height - 136
      );
      ctx.restore();
    }
  }

  private renderFullScreenScope(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    fullScreenRadius: number,
    scale: number,
    state: GameState
  ): void {
    const isThreat = state.enemyStrike !== null || !state.playerAlive;
    const radar = state.radarConfig;
    const w = Math.ceil(width);
    const h = Math.ceil(height);
    const key = `${w}:${h}:${Math.round(scale * 100)}:${isThreat ? 1 : 0}:${radar.id}`;

    if (typeof document !== 'undefined') {
      if (!this.scopeCache || this.scopeCacheKey !== key) {
        const off = this.scopeCache ?? document.createElement('canvas');
        off.width = w;
        off.height = h;
        const octx = off.getContext('2d');
        if (octx) {
          const ocx = w * 0.5;
          const ocy = cy;
          octx.clearRect(0, 0, w, h);
          octx.save();

          // Full-screen crosshair axes spanning edge-to-edge
          octx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
          octx.lineWidth = 1;
          octx.beginPath();
          octx.moveTo(0, ocy);
          octx.lineTo(w, ocy);
          octx.moveTo(ocx, 0);
          octx.lineTo(ocx, h);
          octx.stroke();

          // Subtle diagonal 45-deg bearing lines spanning full screen
          octx.strokeStyle = 'rgba(148, 163, 184, 0.055)';
          for (const deg of [45, 135]) {
            const rad = (deg * Math.PI) / 180;
            const dx = Math.cos(rad) * fullScreenRadius;
            const dy = Math.sin(rad) * fullScreenRadius;
            octx.beginPath();
            octx.moveTo(ocx - dx, ocy - dy);
            octx.lineTo(ocx + dx, ocy + dy);
            octx.stroke();
          }

          // Concentric radar range rings extending across the entire screen
          const ringStep = 65 * scale;
          let ringIdx = 1;
          for (let r = ringStep; r < fullScreenRadius; r += ringStep) {
            const isOrbitBoundary = ringIdx === 2;
            octx.strokeStyle = isThreat
              ? 'rgba(239, 68, 68, 0.18)'
              : isOrbitBoundary
                ? `rgba(${radar.ringRgb}, 0.28)`
                : 'rgba(148, 163, 184, 0.12)';
            octx.lineWidth = isOrbitBoundary ? 1.5 : 1;
            octx.setLineDash(
              radar.id === 'valkyrie' && ringIdx % 2 === 1
                ? [10, 5]
                : ringIdx % 2 === 1
                  ? [5, 7]
                  : []
            );
            octx.beginPath();
            octx.arc(ocx, ocy, r, 0, Math.PI * 2);
            octx.stroke();
            ringIdx++;
          }
          octx.setLineDash([]);

          // Degree tick marks along the main tactical ring (plus Solaris outer azimuth ticks)
          const tickRing = ringStep * 2;
          const degStep = radar.id === 'solaris' ? 10 : 15;
          for (let deg = 0; deg < 360; deg += degStep) {
            const rad = (deg * Math.PI) / 180;
            const major = deg % 45 === 0 || (radar.id === 'solaris' && deg % 30 === 0);
            const inner = tickRing - (major ? 10 : 4.5) * scale * 0.75;
            const dx = Math.sin(rad);
            const dy = -Math.cos(rad);
            octx.strokeStyle = major
              ? `rgba(${radar.ringRgb}, 0.48)`
              : 'rgba(148, 163, 184, 0.20)';
            octx.lineWidth = major ? 1.5 : 1;
            octx.beginPath();
            octx.moveTo(ocx + dx * inner, ocy + dy * inner);
            octx.lineTo(ocx + dx * tickRing, ocy + dy * tickRing);
            octx.stroke();
          }

          octx.restore();
        }
        this.scopeCache = off;
        this.scopeCacheKey = key;
      }

      if (this.scopeCache) {
        // Apply shake delta relative to unshaken center
        const dx = cx - width * 0.5;
        ctx.drawImage(this.scopeCache, dx, 0);
      }
    }
  }

  private renderTitleAmbientRadar(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    width: number,
    height: number,
    state: GameState
  ): void {
    const cx = toPxX(115);
    const cy = toPxY(0);
    const fullR = Math.hypot(width, height);
    const radar = state.radarConfig;
    const sweepAngle = this.ambientTime * (0.85 * radar.rotationSpeedMult);

    const w = Math.ceil(width);
    const h = Math.ceil(height);
    const key = `title:${w}:${h}:${Math.round(scale * 100)}:${radar.id}`;

    if (typeof document !== 'undefined') {
      if (!this.scopeCache || this.scopeCacheKey !== key) {
        const off = this.scopeCache ?? document.createElement('canvas');
        off.width = w;
        off.height = h;
        const octx = off.getContext('2d');
        if (octx) {
          octx.clearRect(0, 0, w, h);
          octx.strokeStyle = `rgba(${radar.ringRgb}, 0.14)`;
          octx.lineWidth = 1;
          for (let r = 68 * scale; r < fullR; r += 68 * scale) {
            octx.beginPath();
            octx.arc(cx, cy, r, 0, Math.PI * 2);
            octx.stroke();
          }
        }
        this.scopeCache = off;
        this.scopeCacheKey = key;
      }
      if (this.scopeCache) {
        ctx.drawImage(this.scopeCache, 0, 0);
      }
    }

    ctx.save();

    // Lightweight dual-step translucent sweep beam (avoids software radial gradient rasterization per frame)
    const canvasAngle = sweepAngle - Math.PI / 2;
    ctx.fillStyle = `rgba(${radar.accentRgb}, 0.06)`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, fullR, canvasAngle - 0.32, canvasAngle + 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(${radar.accentRgb}, 0.12)`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, Math.min(fullR, 360 * scale), canvasAngle - 0.24, canvasAngle + 0.03);
    ctx.closePath();
    ctx.fill();

    // Sweeping beam leading edge
    ctx.strokeStyle = `rgba(${radar.accentRgb}, 0.80)`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(canvasAngle) * fullR,
      cy + Math.sin(canvasAngle) * fullR
    );
    ctx.stroke();

    // Center showcase fighter jet sprite
    this.drawAircraftIcon(ctx, cx, cy, sweepAngle, scale * 1.1, false, false);

    ctx.restore();
  }

  private renderCenterRadarAndShip(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    fullScreenRadius: number,
    scale: number,
    state: GameState
  ): void {
    const radar = state.radarConfig;
    const locked = state.signal >= state.levelConfig.lockThreshold;
    const hasSignal = state.signal > 2;
    const isThreat = state.enemyStrike !== null;

    ctx.save();

    if (state.playerAlive) {
      // 1. Full-Screen Rotating Radar Detection Cone from Center (0, 0)
      const canvasAngle = state.radar.angle - Math.PI / 2;
      const baseSpread = radar.id === 'aegis' || radar.id === 'solaris' ? 0.31 : 0.27;
      const spreadRad = locked
        ? 0.115
        : hasSignal
          ? baseSpread - 0.05 - (state.signal / 100) * 0.09
          : baseSpread;
      const beamColor = isThreat
        ? '239, 68, 68'
        : locked
          ? radar.lockRgb
          : hasSignal
            ? radar.accentRgb
            : radar.id === 'mk1'
              ? '100, 116, 139'
              : radar.accentRgb;

      ctx.fillStyle = `rgba(${beamColor}, ${
        locked ? 0.16 : hasSignal ? 0.11 : radar.id === 'mk1' ? 0.06 : 0.08
      })`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(
        cx,
        cy,
        fullScreenRadius,
        canvasAngle - spreadRad,
        canvasAngle + spreadRad
      );
      ctx.closePath();
      ctx.fill();

      // Radar-specific outer sector edges for Aegis & Solaris
      if (radar.id === 'aegis' || radar.id === 'solaris') {
        ctx.strokeStyle = `rgba(${beamColor}, 0.24)`;
        ctx.lineWidth = 1;
        for (const edge of [canvasAngle - spreadRad, canvasAngle + spreadRad]) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(
            cx + Math.cos(edge) * fullScreenRadius,
            cy + Math.sin(edge) * fullScreenRadius
          );
          ctx.stroke();
        }
      }

      // Full-screen aim centerline
      ctx.strokeStyle = locked
        ? `rgba(${radar.lockRgb}, 0.72)`
        : hasSignal
          ? `rgba(${radar.accentRgb}, 0.56)`
          : `rgba(${radar.accentRgb}, 0.32)`;
      ctx.lineWidth = Math.max(1.2, scale * 0.75);
      ctx.setLineDash(radar.id === 'valkyrie' ? [10, 4] : [6, 6]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(canvasAngle) * fullScreenRadius,
        cy + Math.sin(canvasAngle) * fullScreenRadius
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Expanding sonar pulse wave when tracking signal
      if (hasSignal && !isThreat) {
        const rate = locked ? 2.1 : 0.85 + (state.signal / 100) * 1.1;
        const p = (this.ambientTime * rate) % 1;
        ctx.strokeStyle = `rgba(${beamColor}, ${((1 - p) * 0.44).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.4, scale * 0.75);
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          (22 + p * (STAGE_BOUNDS.RADAR_RADIUS * 1.15)) * scale,
          canvasAngle - spreadRad * 1.15,
          canvasAngle + spreadRad * 1.15
        );
        ctx.stroke();
      }

      // Crimson lock ring around center aircraft during incoming enemy counter-strike
      if (isThreat) {
        const pulse = 0.65 + 0.35 * Math.sin(this.ambientTime * 18);
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse.toFixed(2)})`;
        ctx.lineWidth = Math.max(2, scale * 1.2);
        ctx.beginPath();
        ctx.arc(cx, cy, 28 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2. Turret Ring + Radar-specific Outer Halo + Center Fighter Jet Sprite
      ctx.strokeStyle =
        state.playerFlashTimer > 0
          ? '#FFFFFF'
          : locked
            ? `rgba(${radar.lockRgb}, 0.90)`
            : `rgba(${radar.accentRgb}, 0.78)`;
      ctx.lineWidth = Math.max(1.6, scale * 0.9);
      ctx.beginPath();
      ctx.arc(cx, cy, 22 * scale, 0, Math.PI * 2);
      ctx.stroke();

      if (radar.id === 'valkyrie' || radar.id === 'solaris') {
        ctx.strokeStyle = `rgba(${locked ? radar.lockRgb : radar.accentRgb}, 0.38)`;
        ctx.lineWidth = Math.max(1, scale * 0.6);
        ctx.beginPath();
        ctx.arc(cx, cy, 27 * scale, canvasAngle - 0.8, canvasAngle + 0.8);
        ctx.stroke();
      }

      this.drawAircraftIcon(
        ctx,
        cx,
        cy,
        state.radar.angle,
        scale,
        false,
        state.playerFlashTimer > 0
      );
    } else {
      // Destroyed center aircraft debris
      ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = Math.max(1.5, scale * 0.8);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6 * scale, Math.sin(a) * 6 * scale);
        ctx.lineTo(Math.cos(a) * 18 * scale, Math.sin(a) * 18 * scale);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawAircraftIcon(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    angleRad: number,
    scale: number,
    isEnemy: boolean,
    isFlashing: boolean
  ): void {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angleRad);

    const sprite = isEnemy ? this.enemySprite : this.playerSprite;
    const sizePx = Math.max(38, 30 * scale);

    if (sprite && !isFlashing) {
      ctx.drawImage(sprite, -sizePx * 0.5, -sizePx * 0.5, sizePx, sizePx);
      ctx.restore();
      return;
    }

    // Crisp fallback fighter jet silhouette (also used for brief 60ms white hit flash)
    const s = scale * 0.85;
    ctx.fillStyle = isFlashing ? '#FFFFFF' : isEnemy ? '#EF4444' : '#94A3B8';
    ctx.strokeStyle = isFlashing ? '#FFFFFF' : isEnemy ? '#FCA5A5' : '#E2E8F0';
    ctx.lineWidth = Math.max(1.2, s * 0.9);
    ctx.beginPath();
    ctx.moveTo(0, -16 * s);
    ctx.lineTo(3.5 * s, -5 * s);
    ctx.lineTo(15 * s, 5 * s);
    ctx.lineTo(13 * s, 9 * s);
    ctx.lineTo(4 * s, 6 * s);
    ctx.lineTo(6 * s, 13 * s);
    ctx.lineTo(0, 10 * s);
    ctx.lineTo(-6 * s, 13 * s);
    ctx.lineTo(-4 * s, 6 * s);
    ctx.lineTo(-13 * s, 9 * s);
    ctx.lineTo(-15 * s, 5 * s);
    ctx.lineTo(-3.5 * s, -5 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isFlashing) {
      ctx.fillStyle = isEnemy ? '#FEF08A' : '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(0, -5 * s, 2.2 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderOpponentShip(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    state: GameState
  ): void {
    const sx = toPxX(state.ship.x);
    const sy = toPxY(state.ship.y);
    const isFlashing = state.shipFlashTimer > 0;
    const isCounterAttacking = state.enemyStrike !== null;

    ctx.save();
    ctx.translate(sx, sy);

    const bracketSize = 23 * scale;
    const cornerLen = 7 * scale;
    ctx.strokeStyle = isFlashing
      ? '#FFFFFF'
      : isCounterAttacking
        ? '#EF4444'
        : '#10B981';
    ctx.lineWidth = Math.max(1.5, scale * 0.95);
    ctx.beginPath();
    ctx.moveTo(-bracketSize, -bracketSize + cornerLen);
    ctx.lineTo(-bracketSize, -bracketSize);
    ctx.lineTo(-bracketSize + cornerLen, -bracketSize);
    ctx.moveTo(bracketSize - cornerLen, -bracketSize);
    ctx.lineTo(bracketSize, -bracketSize);
    ctx.lineTo(bracketSize, -bracketSize + cornerLen);
    ctx.moveTo(-bracketSize, bracketSize - cornerLen);
    ctx.lineTo(-bracketSize, bracketSize);
    ctx.lineTo(-bracketSize + cornerLen, bracketSize);
    ctx.moveTo(bracketSize - cornerLen, bracketSize);
    ctx.lineTo(bracketSize, bracketSize);
    ctx.lineTo(bracketSize, bracketSize - cornerLen);
    ctx.stroke();
    // Multi-hit enemy armor pips above bracket
    if (state.enemyMaxHp > 1 && !isCounterAttacking) {
      const pipW = 8 * scale;
      const pipH = 3 * scale;
      const gap = 3 * scale;
      const totalW =
        state.enemyMaxHp * pipW + (state.enemyMaxHp - 1) * gap;
      const startX = -totalW * 0.5;
      const pipY = -bracketSize - 8 * scale;
      for (let i = 0; i < state.enemyMaxHp; i++) {
        ctx.fillStyle =
          i < state.enemyHp ? '#EF4444' : 'rgba(148, 163, 184, 0.25)';
        ctx.fillRect(startX + i * (pipW + gap), pipY, pipW, pipH);
      }
    }
    ctx.restore();

    const heading = isCounterAttacking
      ? Math.atan2(-state.ship.x, -state.ship.y)
      : state.ship.headingAngle;

    this.drawAircraftIcon(ctx, sx, sy, heading, scale * 0.95, true, isFlashing);
  }

  private renderLaunchShockwave(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    state: GameState
  ): void {
    const sw = state.launchShockwave;
    const t = Math.min(1, sw.elapsed / sw.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const alpha = Math.max(0, 1 - t);
    const px = toPxX(sw.x);
    const py = toPxY(sw.y);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(sw.angle);

    // Forward ignition flash cone
    ctx.fillStyle = `rgba(254, 240, 138, ${(alpha * 0.55).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(0, -14 * ease * scale);
    ctx.lineTo(10 * (1 - t * 0.5) * scale, 8 * scale);
    ctx.lineTo(-10 * (1 - t * 0.5) * scale, 8 * scale);
    ctx.closePath();
    ctx.fill();

    // Expanding shock ring
    ctx.strokeStyle = `rgba(${state.radarConfig.accentRgb}, ${(alpha * 0.8).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.4, (1 - t) * 2.5 * scale);
    ctx.beginPath();
    ctx.arc(0, 0, (6 + ease * 24) * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private renderContrail(
    ctx: CanvasRenderingContext2D,
    trail: TrailPoint[],
    count: number,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    outerRgb: string,
    coreRgb: string
  ): void {
    if (count < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < count - 1; i++) {
      const a = trail[i];
      const b = trail[i + 1];
      if (!a.active || !b.active) continue;
      const frac = 1 - i / count;
      ctx.strokeStyle = `rgba(${outerRgb}, ${(frac * 0.42).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.5, frac * 6.5 * scale);
      ctx.beginPath();
      ctx.moveTo(toPxX(a.x), toPxY(a.y));
      ctx.lineTo(toPxX(b.x), toPxY(b.y));
      ctx.stroke();

      ctx.strokeStyle = `rgba(${coreRgb}, ${(frac * 0.72).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.8, frac * 2.4 * scale);
      ctx.beginPath();
      ctx.moveTo(toPxX(a.x), toPxY(a.y));
      ctx.lineTo(toPxX(b.x), toPxY(b.y));
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderMissPulse(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number
  ): void {
    const mp = this.missPulse;
    const t = Math.min(1, mp.elapsed / mp.duration);
    const ease = 1 - Math.pow(1 - t, 2);
    const alpha = Math.max(0, 1 - t);
    const px = toPxX(mp.x);
    const py = toPxY(mp.y);

    ctx.save();
    ctx.strokeStyle = `rgba(148, 163, 184, ${(alpha * 0.75).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.2, (1 - t) * 2.6 * scale);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(px, py, (6 + ease * 26) * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderMissile(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    angle: number,
    scale: number,
    bodyColor: string,
    coreColor: string,
    flameColor: string
  ): void {
    const s = Math.max(1, scale * 0.95);
    const flicker = 0.78 + 0.35 * Math.abs(Math.sin(this.ambientTime * 68));

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);

    // Outer plasma glow around thruster & fuselage
    ctx.fillStyle = `${bodyColor}33`;
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 6.5 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Multi-layer flickering supersonic exhaust flame
    ctx.fillStyle = flameColor;
    ctx.beginPath();
    ctx.moveTo(-2.6 * s, 7.5 * s);
    ctx.lineTo(0, (17 + 7 * flicker) * s);
    ctx.lineTo(2.6 * s, 7.5 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-1.3 * s, 7.5 * s);
    ctx.lineTo(0, (12 + 4 * flicker) * s);
    ctx.lineTo(1.3 * s, 7.5 * s);
    ctx.closePath();
    ctx.fill();

    // Swept stabilizing tail fins
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-2.3 * s, 3.5 * s);
    ctx.lineTo(-5.8 * s, 8.2 * s);
    ctx.lineTo(-2.1 * s, 7.5 * s);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(2.3 * s, 3.5 * s);
    ctx.lineTo(5.8 * s, 8.2 * s);
    ctx.lineTo(2.1 * s, 7.5 * s);
    ctx.closePath();
    ctx.fill();

    // Sleek missile fuselage & pointed warhead cone
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(0, -11.5 * s);
    ctx.lineTo(2.7 * s, -4.5 * s);
    ctx.lineTo(2.5 * s, 7.5 * s);
    ctx.lineTo(-2.5 * s, 7.5 * s);
    ctx.lineTo(-2.7 * s, -4.5 * s);
    ctx.closePath();
    ctx.fill();

    // Bright metallic nose highlight & core band
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.moveTo(0, -11.5 * s);
    ctx.lineTo(1.4 * s, -5 * s);
    ctx.lineTo(1.2 * s, 3.5 * s);
    ctx.lineTo(-1.2 * s, 3.5 * s);
    ctx.lineTo(-1.4 * s, -5 * s);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderEnemyStrike(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    state: GameState
  ): void {
    const es = state.enemyStrike;
    if (!es) return;

    const sx = toPxX(state.ship.x);
    const sy = toPxY(state.ship.y);
    const cx = toPxX(0);
    const cy = toPxY(0);

    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = Math.max(1.5, scale * 0.8);
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (this.enemyTrailCount > 1) {
      this.renderContrail(
        ctx,
        this.enemyTrail,
        this.enemyTrailCount,
        toPxX,
        toPxY,
        scale,
        '239, 68, 68',
        '254, 202, 202'
      );
    }

    this.renderMissile(
      ctx,
      toPxX(es.x),
      toPxY(es.y),
      es.angle,
      scale * 1.1,
      '#EF4444',
      '#FECACA',
      '#F97316'
    );
  }

  private renderBlast(
    ctx: CanvasRenderingContext2D,
    toPxX: (x: number) => number,
    toPxY: (y: number) => number,
    scale: number,
    state: GameState
  ): void {
    const bx = toPxX(state.blast.x);
    const by = toPxY(state.blast.y);
    const t = Math.min(1, state.blast.elapsed / state.blast.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const alpha = Math.max(0, 1 - t);

    ctx.save();

    ctx.strokeStyle = `rgba(254, 240, 138, ${(alpha * 0.9).toFixed(3)})`;
    ctx.lineWidth = Math.max(2, (1 - t) * 4 * scale);
    ctx.beginPath();
    ctx.arc(bx, by, (10 + ease * 44) * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(239, 68, 68, ${(alpha * 0.78).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bx, by, (8 + ease * 28) * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(245, 158, 11, ${(alpha * 0.88).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bx, by, (5 + ease * 18) * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.95).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bx, by, (3 + ease * 9) * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
