// Sonido generado por código con WebAudio: nada que descargar. Capas
// continuas (viento, lluvia, grillos) que siguen a la escena, y efectos
// cortos. Se enciende con el primer gesto de ella (teclado o clic).

export interface Ambience { day: number; night: number; storm: number }

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private rainGain!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private cricketTimer = 0;
  private cricketBurst = 0;
  private birdTimer = 2;
  muted = false;

  /** Crea el contexto (solo tras un gesto del usuario). Idempotente. */
  ensure(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    // Ruido blanco de 2 s en bucle: base de viento, lluvia y truenos.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Viento: ruido grave, con ráfagas lentas.
    const wind = this.loop();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 260; this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);

    // Lluvia: ruido medio-agudo.
    const rain = this.loop();
    const rf = ctx.createBiquadFilter();
    rf.type = 'bandpass'; rf.frequency.value = 2200; rf.Q.value = 0.5;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(rf).connect(this.rainGain).connect(this.master);
  }

  private loop(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise; src.loop = true; src.start();
    return src;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  /** Cada cuadro: ajusta las capas continuas y dispara grillos y pájaros. */
  update(dt: number, amb: Ambience): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(0.22 * amb.storm, t, 0.4);
    this.windGain.gain.setTargetAtTime(0.03 + 0.12 * amb.storm, t, 0.6);
    this.windFilter.frequency.setTargetAtTime(220 + 140 * amb.storm + 90 * Math.sin(t * 0.37), t, 0.5);

    // Grillos de noche (fuera de la tormenta): ráfagas de pitidos muy suaves.
    const cricket = amb.night * (1 - amb.storm);
    if (cricket > 0.3) {
      this.cricketTimer -= dt;
      if (this.cricketTimer <= 0) {
        this.blip(4300 + Math.random() * 300, 0.018, 0.012 * cricket);
        this.cricketBurst++;
        this.cricketTimer = this.cricketBurst < 7 ? 0.07 : (this.cricketBurst = 0, 0.6 + Math.random() * 0.9);
      }
    }
    // Pájaros de día.
    if (amb.day > 0.4 && amb.storm < 0.2) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.chirp(t + i * 0.13, 2400 + Math.random() * 900, 0.05 * amb.day);
        this.birdTimer = 2.5 + Math.random() * 4;
      }
    }
  }

  private blip(freq: number, dur: number, gain: number): void {
    const ctx = this.ctx!, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  private chirp(t: number, f0: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.05); o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.13);
  }

  private burst(freq: number, q: number, attack: number, decay: number, gain: number, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx!, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + attack + decay);
    src.connect(f).connect(g).connect(this.master); src.start(t); src.stop(t + attack + decay + 0.05);
  }

  /** Trueno: retumbo grave que se apaga en un par de segundos. */
  thunder(near = 1): void {
    if (!this.ctx) return;
    this.burst(160, 0.7, 0.04, 1.6 + near, 0.55 * near, 'lowpass');
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(48, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * near, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.8);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 2);
  }
  /** Golpe seco al tronco. */
  hit(): void { if (this.ctx) this.burst(700, 1.2, 0.005, 0.12, 0.3); }
  /** El tronco se parte. */
  crack(): void { if (this.ctx) { this.burst(420, 0.9, 0.005, 0.35, 0.4); this.burst(1600, 1.5, 0.002, 0.08, 0.25); } }
  /** Crujido del árbol antes de caer. */
  creak(): void { if (this.ctx) this.burst(300, 2.5, 0.05, 0.5, 0.18); }
  /** Golpe sordo del árbol al caer. */
  thud(): void { if (this.ctx) this.burst(140, 0.8, 0.01, 0.5, 0.45, 'lowpass'); }
  /** Chimuelo despierta: ronroneo corto. */
  purr(): void {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.25); o.frequency.exponentialRampToValueAtTime(300, t + 0.45);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.5);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.55);
  }
  /** Corazones: tres notas que suben. */
  twinkle(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [1046.5, 1318.5, 1568].forEach((f, i) => {
      const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.11); g.gain.linearRampToValueAtTime(0.08, t + i * 0.11 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + i * 0.11 + 0.35);
      o.connect(g).connect(this.master); o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.4);
    });
  }
  /** Aleteo suave (mariposas, pájaros del arbusto). */
  flutter(): void { if (this.ctx) this.burst(1200, 0.6, 0.01, 0.25, 0.12, 'highpass'); }
  /** Un auto que pasa cerca. */
  whoosh(): void {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.35); f.frequency.exponentialRampToValueAtTime(400, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.95);
    src.connect(f).connect(g).connect(this.master); src.start(t); src.stop(t + 1);
  }
  /** Bocina y frenazo. */
  horn(): void {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const f0 of [392, 494]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = f0;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.02); g.gain.setValueAtTime(0.07, t + 0.45); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.6);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.65);
    }
    this.burst(2600, 2, 0.02, 0.5, 0.18, 'bandpass');
  }
  /** Hojas al sacudir un arbusto. */
  rustle(): void { if (this.ctx) this.burst(2500, 0.5, 0.01, 0.18, 0.1, 'highpass'); }
}
