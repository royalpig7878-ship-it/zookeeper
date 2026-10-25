import type Phaser from 'phaser';
import { Rng } from '../core/rng';
import { SettingsStore, volumeOf } from '../core/settings';
import { Ambience, SCALE_HZ, SfxName, VoiceLimit, ambienceFor, nextGapSeconds, nextNoteIndex } from './plan';

/**
 * The game's sound, all made in the browser with the Web Audio API (so there are no audio files and
 * no licences to track). It starts only after the first touch or key press, as browsers require, and
 * does nothing at all if the browser has no Web Audio or the sound is off. It can never stop the game:
 * every call is guarded.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private rainGain!: GainNode;
  private noise: AudioBuffer | null = null;
  private voices = new VoiceLimit(6);
  private rng = new Rng('audio');
  private noteIndex = 4;
  private nextNoteAt = 0;
  private timer: number | null = null;
  private ambience: Ambience = { rain: false, thunder: false, birds: false };
  private weather = { rain: false, kind: 'clear' };
  private daylight = 1;
  private nextBirdAt = 0;
  private nextThunderAt = 0;
  private started = false;

  constructor(private events: Phaser.Events.EventEmitter, private settings: SettingsStore) {}

  /** Wire up to the game. Call once. */
  start() {
    if (this.started) return;
    this.started = true;
    const unlock = () => this.unlock();
    for (const type of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(type, unlock, { once: false, passive: true });
    this.events.on('sfx', (name: SfxName) => this.sfx(name));
    this.events.on('ui:weather', (w: { rain: boolean; kind?: string }) => {
      this.weather = { rain: w.rain, kind: w.kind ?? (w.rain ? 'rain' : 'clear') };
      this.updateAmbience();
    });
    this.events.on('ui:daylight', (d: number) => {
      this.daylight = d;
      this.updateAmbience();
    });
    this.events.on('ui:toast', () => this.sfx('soft'));
    document.addEventListener('visibilitychange', () => {
      try {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      } catch {
        /* sound is optional */
      }
    });
    this.settings.onChange(() => this.applyVolumes());
  }

  private unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.buildGraph();
        this.timer = window.setInterval(() => this.tick(), 250);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null; // no sound on this device
    }
  }

  private buildGraph() {
    const ctx = this.ctx!;
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    for (const g of [this.musicGain, this.sfxGain, this.rainGain]) g.connect(ctx.destination);
    // two seconds of noise, looped, is the rain
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.6;
    src.connect(filter).connect(this.rainGain);
    src.start();
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings.get();
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(volumeOf(s.music, s.muted) * 0.9, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(volumeOf(s.sfx, s.muted) * 1.0, t, 0.05);
    this.rainGain.gain.setTargetAtTime(this.ambience.rain ? volumeOf(s.sfx, s.muted) * 0.45 : 0, t, 0.6);
  }

  private updateAmbience() {
    this.ambience = ambienceFor(this.weather, this.daylight);
    this.applyVolumes();
  }

  /** Runs four times a second: schedules the next music note, a bird, or thunder when it is time. */
  private tick() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
    if (ctx.state !== 'running') return;
    const s = this.settings.get();
    const now = ctx.currentTime;
    if (volumeOf(s.music, s.muted) > 0 && now >= this.nextNoteAt) {
      this.noteIndex = nextNoteIndex(this.rng, this.noteIndex);
      this.note(SCALE_HZ[this.noteIndex], now + 0.05, 2.4, 0.6);
      if (this.rng.next() < 0.25) this.note(SCALE_HZ[Math.max(0, this.noteIndex - 3)] / 2, now + 0.05, 3.6, 0.28); // a soft low note under it
      this.nextNoteAt = now + nextGapSeconds(this.rng);
    }
    if (this.ambience.birds && now >= this.nextBirdAt) {
      this.sfx('chirp');
      this.nextBirdAt = now + 3 + this.rng.next() * 7;
    }
    if (this.ambience.thunder && now >= this.nextThunderAt) {
      if (this.nextThunderAt > 0) this.sfx('thunder');
      this.nextThunderAt = now + 12 + this.rng.next() * 25;
    }
  }

  /** One soft music note: a triangle wave with a slow attack and a long fade. */
  private note(freq: number, at: number, length: number, level: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + 0.08);
    env.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(env).connect(this.musicGain);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  /** A short sound effect. Quietly ignored if sound is off, unavailable, or too many sounds are playing. */
  sfx(name: SfxName) {
    try {
      const ctx = this.ctx;
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') void ctx.resume(); // the first tap may arrive before the browser has finished waking the sound
      const s = this.settings.get();
      if (volumeOf(s.sfx, s.muted) <= 0) return;
      const done = this.voices.take();
      if (!done) return;
      const t = ctx.currentTime;
      let length = 0.2;
      switch (name) {
        case 'click': this.blip(660, t, 0.06, 'square', 0.25); length = 0.08; break;
        case 'soft': this.blip(520, t, 0.12, 'sine', 0.2); length = 0.14; break;
        case 'complete':
          this.blip(523.25, t, 0.14, 'triangle', 0.4);
          this.blip(659.25, t + 0.12, 0.14, 'triangle', 0.4);
          this.blip(783.99, t + 0.24, 0.3, 'triangle', 0.4);
          length = 0.6;
          break;
        case 'born':
          this.blip(784, t, 0.2, 'sine', 0.35);
          this.blip(988, t + 0.18, 0.2, 'sine', 0.35);
          this.blip(1175, t + 0.36, 0.4, 'sine', 0.35);
          length = 0.8;
          break;
        case 'step': this.burst(t, 0.05, 500, 0.35); length = 0.07; break;
        case 'work': this.burst(t, 0.18, 900, 0.5); length = 0.2; break;
        case 'door': this.blip(110, t, 0.18, 'sine', 0.6); this.burst(t, 0.08, 300, 0.4); length = 0.25; break;
        case 'splash': this.burst(t, 0.3, 1800, 0.5); length = 0.32; break;
        case 'chirp': {
          const f = 2200 + this.rng.next() * 900;
          this.sweep(f, f * 1.35, t, 0.09, 0.18);
          this.sweep(f * 1.2, f * 0.9, t + 0.12, 0.09, 0.18);
          length = 0.3;
          break;
        }
        case 'thunder': this.burst(t, 1.6, 140, 0.9, 1.4); length = 1.7; break;
      }
      window.setTimeout(done, length * 1000 + 50);
    } catch {
      /* sound is optional */
    }
  }

  private blip(freq: number, at: number, length: number, type: OscillatorType, level: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(level, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(env).connect(this.sfxGain);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  private sweep(from: number, to: number, at: number, length: number, level: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.linearRampToValueAtTime(to, at + length);
    env.gain.setValueAtTime(level, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(env).connect(this.sfxGain);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  /** A burst of filtered noise: footsteps, digging, a splash, thunder. */
  private burst(at: number, length: number, cutoff: number, level: number, attack = 0.005) {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + attack);
    env.gain.exponentialRampToValueAtTime(0.001, at + length);
    src.connect(filter).connect(env).connect(this.sfxGain);
    src.start(at, this.rng.next() * 1.5);
    src.stop(at + length + 0.02);
  }

  /** Stop everything (when the page is closed). */
  dispose() {
    if (this.timer !== null) window.clearInterval(this.timer);
    try {
      void this.ctx?.close();
    } catch {
      /* nothing to do */
    }
    this.ctx = null;
  }
}
