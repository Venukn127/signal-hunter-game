export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private pingAccum = 0;

  // Procedural tactical gameplay music state
  private musicGain: GainNode | null = null;
  private musicTimerId: number | null = null;
  private musicStep = 0;
  private musicDesired = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMusicGain();
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyMusicGain();
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx
        .resume()
        .then(() => {
          this.applyMusicGain();
          if (this.musicDesired && !this.muted && this.musicTimerId === null) {
            this.startMusicLoop();
          }
        })
        .catch(() => {});
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      this.unlock();
    }
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private applyMusicGain(): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const target =
      this.musicDesired && !this.muted && this.ctx.state === 'running'
        ? 0.12
        : 0;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(target, now, 0.08);
  }

  public syncMusic(shouldPlay: boolean): void {
    this.musicDesired = shouldPlay;
    if (shouldPlay && !this.muted) {
      this.unlock();
      this.applyMusicGain();
      if (this.ctx && this.ctx.state === 'running' && this.musicTimerId === null) {
        this.startMusicLoop();
      }
    } else {
      this.stopMusic();
    }
  }

  public stopMusic(): void {
    this.musicDesired = false;
    this.applyMusicGain();
    if (this.musicTimerId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
  }

  private startMusicLoop(): void {
    if (typeof window === 'undefined' || this.musicTimerId !== null) return;
    this.musicStep = 0;
    this.scheduleMusicStep();
    // 128 BPM eighth-note tactical groove (~234ms per step)
    this.musicTimerId = window.setInterval(() => {
      this.scheduleMusicStep();
    }, 234);
  }

  private scheduleMusicStep(): void {
    if (!this.musicDesired || this.muted) return;
    const ctx = this.ctx;
    const bus = this.musicGain;
    if (!ctx || !bus || ctx.state !== 'running') return;

    const now = ctx.currentTime + 0.015;
    const step = this.musicStep % 32;
    const bar = Math.floor(step / 8); // 4 bars of 8 eighth-notes (D minor -> Bb -> C -> A)

    // Chord progression roots (Hz) & arp voicings
    const bassRoots = [73.42, 58.27, 65.41, 55.0]; // D2, Bb1, C2, A1
    const arpChords: number[][] = [
      [293.66, 349.23, 440.0, 523.25], // Dm7
      [233.08, 293.66, 349.23, 440.0], // Bbmaj7
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 277.18, 329.63, 392.0],  // A7
    ];
    const padNotes: [number, number][] = [
      [146.83, 220.0],
      [116.54, 174.61],
      [130.81, 196.0],
      [110.0, 164.81],
    ];

    // 1. Driving filtered synth bass pulse on every step (accented on downbeats)
    const bassFreq =
      step % 4 === 2 ? bassRoots[bar] * 2 : bassRoots[bar];
    const bassOsc = ctx.createOscillator();
    const bassFilter = ctx.createBiquadFilter();
    const bassEnv = ctx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassFreq, now);
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(step % 2 === 0 ? 440 : 280, now);
    bassFilter.frequency.exponentialRampToValueAtTime(140, now + 0.2);

    const bassAmp = step % 2 === 0 ? 0.36 : 0.22;
    bassEnv.gain.setValueAtTime(0.0001, now);
    bassEnv.gain.linearRampToValueAtTime(bassAmp, now + 0.015);
    bassEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassEnv);
    bassEnv.connect(bus);
    bassOsc.start(now);
    bassOsc.stop(now + 0.22);

    // 2. Atmospheric pad chord swell at start of each bar
    if (step % 8 === 0) {
      for (const freq of padNotes[bar]) {
        const padOsc = ctx.createOscillator();
        const padEnv = ctx.createGain();
        padOsc.type = 'triangle';
        padOsc.frequency.setValueAtTime(freq, now);
        padEnv.gain.setValueAtTime(0.0001, now);
        padEnv.gain.linearRampToValueAtTime(0.14, now + 0.35);
        padEnv.gain.exponentialRampToValueAtTime(0.0001, now + 1.82);
        padOsc.connect(padEnv);
        padEnv.connect(bus);
        padOsc.start(now);
        padOsc.stop(now + 1.85);
      }
    }

    // 3. Tactical sci-fi arpeggio lead (gentle syncopated pattern)
    if (step % 2 === 0 || step % 8 === 5 || step % 8 === 7) {
      const chord = arpChords[bar];
      const noteFreq = chord[(step + bar) % chord.length];
      const leadOsc = ctx.createOscillator();
      const leadEnv = ctx.createGain();
      leadOsc.type = 'triangle';
      leadOsc.frequency.setValueAtTime(noteFreq, now);
      leadEnv.gain.setValueAtTime(0.0001, now);
      leadEnv.gain.linearRampToValueAtTime(0.16, now + 0.012);
      leadEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      leadOsc.connect(leadEnv);
      leadEnv.connect(bus);
      leadOsc.start(now);
      leadOsc.stop(now + 0.2);
    }

    // 4. Soft electronic kick thump on beats 1 & 3 (steps 0, 4)
    if (step % 4 === 0) {
      const kickOsc = ctx.createOscillator();
      const kickEnv = ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(118, now);
      kickOsc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      kickEnv.gain.setValueAtTime(0.38, now);
      kickEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      kickOsc.connect(kickEnv);
      kickEnv.connect(bus);
      kickOsc.start(now);
      kickOsc.stop(now + 0.14);
    }

    // 5. Crisp off-beat hi-hat tick
    if (step % 2 === 1) {
      const hatSize = Math.floor(ctx.sampleRate * 0.035);
      const hatBuf = ctx.createBuffer(1, hatSize, ctx.sampleRate);
      const hatData = hatBuf.getChannelData(0);
      for (let i = 0; i < hatSize; i++) {
        hatData[i] = (Math.random() * 2 - 1) * (1 - i / hatSize);
      }
      const hatSrc = ctx.createBufferSource();
      hatSrc.buffer = hatBuf;
      const hatFilter = ctx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.setValueAtTime(5200, now);
      const hatEnv = ctx.createGain();
      hatEnv.gain.setValueAtTime(0.08, now);
      hatEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      hatSrc.connect(hatFilter);
      hatFilter.connect(hatEnv);
      hatEnv.connect(bus);
      hatSrc.start(now);
    }

    this.musicStep = (this.musicStep + 1) % 32;
  }

  public tickRadarPing(dt: number, signal: number, active: boolean): void {
    if (!active || this.muted || signal <= 2) {
      this.pingAccum = 0;
      return;
    }

    // Ping interval speeds up from 0.52s at signal=5 to 0.14s at signal=100
    const interval = Math.max(0.14, 0.52 - (signal / 100) * 0.38);
    this.pingAccum += dt;
    if (this.pingAccum >= interval) {
      this.pingAccum = 0;
      this.playRadarPing(signal);
    }
  }

  private playRadarPing(signal: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const locked = signal >= 80;
    const freq = locked ? 980 : 380 + (signal / 100) * 440;

    osc.type = locked ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const peak = locked ? 0.055 : 0.032;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playLockAcquired(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [660, 990];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.055;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.075, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  public playMissileFire(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pitchJitter = 0.94 + Math.random() * 0.12;

    // 1. Crisp launch punch & plasma sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(135 * pitchJitter, now + 0.22);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    // 2. Filtered rocket thruster whoosh
    const bufferSize = Math.floor(ctx.sampleRate * 0.28);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.3);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.27);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.14, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  public playShieldHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.18);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playMissileHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Deep sub-bass explosion shockwave
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.52);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.57);

    // 2. Reactor-overload downward shatter chirp
    const crunchOsc = ctx.createOscillator();
    const crunchGain = ctx.createGain();
    crunchOsc.type = 'square';
    crunchOsc.frequency.setValueAtTime(920, now);
    crunchOsc.frequency.exponentialRampToValueAtTime(140, now + 0.34);

    crunchGain.gain.setValueAtTime(0.0001, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
    crunchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    crunchOsc.connect(crunchGain);
    crunchGain.connect(ctx.destination);
    crunchOsc.start(now);
    crunchOsc.stop(now + 0.36);

    // 3. Wide plasma explosion noise burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.48);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.15);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(130, now + 0.48);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  public playMissileMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.14);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playWinFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.07;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.085, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playEnemyCounterFire(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.28);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  public playLoseSting(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [280, 220, 165];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.11;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.065, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }
}
