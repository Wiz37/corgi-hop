/**
 * SoundService — WebAudio-based procedural sound engine for Corgi Hop.
 *
 * Why procedural: (a) zero binary asset bloat — no .mp3 / .ogg files to load,
 * cache, or ship in the App Store bundle, (b) deterministic across builds
 * and devices, (c) works everywhere WebAudio is supported (iOS Safari, iOS
 * WKWebView / Capacitor, Android Chrome, desktop), (d) fits Corgi Hop's
 * casual-arcade aesthetic (bright chip-tune blips and a cheerful looping
 * riff) better than a licensed royalty-free track.
 *
 * iOS unlock: iOS suspends `AudioContext` until a user gesture touches the
 * page. `ensureUnlocked()` re-`resume()`s the context on the FIRST pointer/
 * key event we see; every SFX also calls it as a defensive belt-and-braces.
 *
 * API:
 *   sound.init()                    // once, from main.ts (or first call auto-inits)
 *   sound.playBounce()              // corgi jump
 *   sound.playThud()                // corgi land
 *   sound.playDing()                // hurdle cleared / score++
 *   sound.playGameOver()            // corgi hit
 *   sound.startMusic()              // begins looping upbeat riff
 *   sound.pauseMusic()              // pause (pause screen)
 *   sound.resumeMusic()             // resume from pause
 *   sound.stopMusic()               // full stop (game over / menu)
 *   sound.toggleMuted() → boolean   // returns new mute state
 *   sound.isMuted → boolean         // reactive getter
 *   sound.onMuteChanged(cb)         // listener for HUD icon refresh
 *
 * Mute state is persisted to localStorage under `corgi_hop_muted`.
 */
export class SoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private musicPlaying = false;
  private musicPausedAt = 0; // context-relative start time of the next bar
  private musicTimerId: number | null = null;
  private unlockPromise: Promise<boolean> | null = null;
  private initialized = false;
  private muteListeners = new Set<(muted: boolean) => void>();

  private static readonly STORAGE_KEY = 'corgi_hop_muted';
  private static readonly AUDIO_FIX_KEY = 'corgi_hop_audio_fix_v2';

  constructor() {
    // Build 2 migration: older TestFlight installs may have persisted a muted
    // flag while the iOS audio session was not configured. Reset that stale
    // value once so the repaired build starts audible; later mute choices are
    // still persisted normally.
    try {
      const fixApplied = window.localStorage.getItem(SoundService.AUDIO_FIX_KEY) === '1';
      if (!fixApplied) {
        this.muted = false;
        window.localStorage.setItem(SoundService.STORAGE_KEY, '0');
        window.localStorage.setItem(SoundService.AUDIO_FIX_KEY, '1');
      } else {
        this.muted = window.localStorage.getItem(SoundService.STORAGE_KEY) === '1';
      }
    } catch (_) { /* private-mode Safari */ }
  }

  /** Lazily create the AudioContext + master gain. Safe to call repeatedly. */
  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC() as AudioContext;
      const g = ctx.createGain();
      g.gain.value = this.muted ? 0 : 0.55;
      g.connect(ctx.destination);
      this.ctx = ctx;
      this.masterGain = g;
      return ctx;
    } catch (_) {
      return null;
    }
  }

  /**
   * iOS + some Android WebViews park the AudioContext in "suspended" state
   * until the FIRST user gesture. Every SFX call runs this defensively. Also
   * called explicitly by `init()` on the first pointerdown/keydown event we
   * intercept in `main.ts`.
   */
  async ensureUnlocked(): Promise<boolean> {
    const ctx = this.ensureCtx();
    if (!ctx) return false;
    if (ctx.state === 'running') return true;
    if (this.unlockPromise) return this.unlockPromise;

    this.unlockPromise = (async () => {
      try {
        await ctx.resume();

        // iOS WKWebView can report a resumed context but still withhold its
        // output route until an AudioBufferSourceNode starts inside a user
        // gesture. A one-frame silent buffer reliably opens that route.
        const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);

        if (String(ctx.state) !== 'running') await ctx.resume();
        return String(ctx.state) === 'running';
      } catch (error) {
        console.warn('[Corgi Hop audio] Unable to unlock AudioContext', error);
        return false;
      } finally {
        this.unlockPromise = null;
      }
    })();

    return this.unlockPromise;
  }

  /**
   * Keep unlock listeners active until iOS confirms the AudioContext is
   * actually running. The extra click/touchend listeners cover WKWebView
   * versions that do not deliver pointerdown consistently.
   */
  init(): void {
    if (typeof document === 'undefined' || this.initialized) return;
    this.initialized = true;

    let unlock: () => void;

    const removeUnlockListeners = () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('touchend', unlock, true);
      document.removeEventListener('click', unlock, true);
    };

    unlock = () => {
      void this.ensureUnlocked().then((running) => {
        if (running) removeUnlockListeners();
      });
    };

    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('touchend', unlock, true);
    document.addEventListener('click', unlock, true);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.ensureUnlocked();
    });
    window.addEventListener('focus', () => { void this.ensureUnlocked(); });
  }

  // ================================================================== SFX

  playBounce(): void {
    // Short upward sine chirp 320 → 720 Hz, ~110 ms with a quick attack /
    // exponential decay. Reads as a light, cartoon-friendly "boing".
    void this.envelope((ctx, out, now) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.85, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(g).connect(out);
      osc.start(now);
      osc.stop(now + 0.14);
    });
  }

  playThud(): void {
    // Low-frequency noise burst through a lowpass filter — reads as a soft
    // paw-down thud. Duration ~140 ms.
    void this.envelope((ctx, out, now) => {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.14), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        // Brown-ish noise: integrated white noise, decaying
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(260, now);
      lp.frequency.exponentialRampToValueAtTime(140, now + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.6, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      src.connect(lp).connect(g).connect(out);
      src.start(now);
      src.stop(now + 0.16);
    });
  }

  playDing(): void {
    // Bell-like two-oscillator FM synth — bright but short, ~280 ms. Base
    // 900 Hz sine + tremolo modulator; a stacked 1200 Hz partial gives the
    // "ding" its shimmer. Reads as "point scored" without being intrusive.
    void this.envelope((ctx, out, now) => {
      const play = (freq: number, offset: number, decay: number, level: number) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now + offset);
        g.gain.exponentialRampToValueAtTime(level, now + offset + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + offset + decay);
        osc.connect(g).connect(out);
        osc.start(now + offset);
        osc.stop(now + offset + decay + 0.02);
      };
      play(1174.66, 0.00, 0.28, 0.5);   // D6
      play(1568.00, 0.00, 0.24, 0.35);  // G6 partial
      play(1975.53, 0.01, 0.18, 0.2);   // B6 shimmer
    });
  }

  playGameOver(): void {
    // Descending 4-note arpeggio (G5 → E5 → C5 → A4), each note ~130 ms with
    // a sawtooth-through-lowpass timbre. Slightly detuned to feel cartoon-y
    // rather than dramatic.
    void this.envelope((ctx, out, now) => {
      const notes = [783.99, 659.25, 523.25, 440.00];
      notes.forEach((f, i) => {
        const start = now + i * 0.12;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.35, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
        osc.connect(lp).connect(g).connect(out);
        osc.start(start);
        osc.stop(start + 0.15);
      });
    });
  }

  // Shared helper: creates a per-shot gain node fed by masterGain so muting
  // is instant and the shot survives context resume/pause.
  private async envelope(build: (ctx: AudioContext, out: AudioNode, now: number) => void): Promise<void> {
    const running = await this.ensureUnlocked();
    const ctx = this.ctx;
    if (!running || !ctx || !this.masterGain || this.muted) return;
    build(ctx, this.masterGain, ctx.currentTime + 0.005);
  }

  // ================================================================ MUSIC

  /**
   * Start the looping upbeat riff. Idempotent — calling twice is a no-op.
   * We schedule one 8-second bar at a time and reschedule on `setTimeout` so
   * the loop can be paused/resumed without drifting.
   */
  startMusic(): void {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.musicPausedAt = 0;

    void this.ensureUnlocked().then((running) => {
      if (!running || !this.musicPlaying) {
        if (!running) this.musicPlaying = false;
        return;
      }
      this.scheduleBar();
    });
  }

  pauseMusic(): void {
    if (!this.musicPlaying) return;
    this.musicPlaying = false;
    if (this.musicTimerId != null) {
      clearTimeout(this.musicTimerId);
      this.musicTimerId = null;
    }
    // The currently-scheduled bar's OscillatorNodes will run to completion
    // (up to ~8 s) but no new bar is scheduled. To hard-stop we could keep
    // references and .stop() each one; the trade-off is more allocations
    // per bar. For a background loop, letting the tail die is fine.
  }

  resumeMusic(): void {
    if (this.musicPlaying) return;
    this.startMusic();
  }

  stopMusic(): void {
    this.pauseMusic();
  }

  // Cheerful 8-bar-ish riff over I-vi-IV-V (C major, 120 BPM). Melody in the
  // treble, arpeggiated bass under it. Each call schedules ~8 seconds of
  // audio and sets a timer to schedule the next block.
  private scheduleBar(): void {
    const ctx = this.ctx;
    const out = this.masterGain;
    if (!this.musicPlaying || !ctx || !out) return;

    // Music sub-gain so mute can drop the loop without killing SFX shots.
    const mgain = ctx.createGain();
    mgain.gain.value = 0.35;
    mgain.connect(out);

    // ------------------------------- BASS (arpeggiated triads under chords)
    const BPM = 120;
    const beat = 60 / BPM;                // 0.5 s per beat
    const bar = beat * 4;                 // 2.0 s per 4/4 bar
    const barsPerBlock = 4;               // one 8-second block ≈ 4 bars
    const blockDur = bar * barsPerBlock;
    const now = ctx.currentTime + 0.05;   // small look-ahead

    const chords = [
      [130.81, 164.81, 196.00], // C3 E3 G3
      [110.00, 130.81, 164.81], // A2 C3 E3
      [174.61, 220.00, 261.63], // F3 A3 C4
      [196.00, 246.94, 293.66], // G3 B3 D4
    ];

    const playTone = (
      freq: number, start: number, dur: number, level: number,
      type: OscillatorType = 'square', filterHz: number | null = null,
    ) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(level, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      let last: AudioNode = osc;
      if (filterHz != null) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = filterHz;
        last.connect(lp);
        last = lp;
      }
      last.connect(g).connect(mgain);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };

    // 4 bars → 4 chord slots. Bass: root eighth-notes; middle: 3rd on offbeats.
    for (let b = 0; b < barsPerBlock; b++) {
      const [root, third, fifth] = chords[b % chords.length];
      const barStart = now + b * bar;
      for (let e = 0; e < 8; e++) {
        const t = barStart + e * (beat / 2);
        const note = e % 3 === 0 ? root : (e % 3 === 1 ? third : fifth);
        playTone(note, t, beat * 0.45, 0.28, 'triangle', 600);
      }
    }

    // ------------------------------- MELODY (bright square-wave lead)
    // Simple hop-along tune: root-3rd-5th-3rd repeated across the chords.
    for (let b = 0; b < barsPerBlock; b++) {
      const [root, third, fifth] = chords[b % chords.length];
      const barStart = now + b * bar;
      const melody = [
        root * 4, third * 4, fifth * 4, third * 4,
        root * 4, fifth * 4, third * 4, root * 4,
      ];
      melody.forEach((f, i) => {
        const t = barStart + i * (beat / 2);
        playTone(f, t, beat * 0.35, 0.16, 'square', 1800);
      });
    }

    // Schedule the next block just before this one ends so bars butt-join
    // smoothly. `blockDur * 0.95` leaves ~0.4 s of overlap-safety margin.
    this.musicTimerId = window.setTimeout(() => {
      this.musicTimerId = null;
      this.scheduleBar();
    }, blockDur * 950); // 950 = 0.95 s per second → ms
  }

  // =============================================================== MUTE

  get isMuted(): boolean { return this.muted; }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    try { window.localStorage.setItem(SoundService.STORAGE_KEY, muted ? '1' : '0'); } catch (_) { /* */ }
    if (this.masterGain && this.ctx) {
      // Instant mute: smooth 30 ms ramp to zero avoids clicks.
      const g = this.masterGain.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(muted ? 0 : 0.55, now + 0.03);
    }
    if (!muted) void this.ensureUnlocked();
    this.muteListeners.forEach((cb) => { try { cb(muted); } catch (_) { /* */ } });
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  onMuteChanged(cb: (muted: boolean) => void): () => void {
    this.muteListeners.add(cb);
    return () => this.muteListeners.delete(cb);
  }
}

// Singleton — imported directly by the scenes.
export const sound = new SoundService();
