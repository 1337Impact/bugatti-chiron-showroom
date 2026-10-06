// All sound is synthesised with Web Audio, so there are no audio files to load.

export class Sound {
  constructor() {
    this.enabled = false;
    this.ctx = null;
  }

  async setEnabled(on) {
    this.enabled = on;
    if (on) {
      if (!this.ctx) this.build();
      await this.ctx.resume();
      this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4);
    } else if (this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
  }

  build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // ambient bed: detuned saws + sub, slowly breathing low-pass
    const bed = ctx.createGain();
    bed.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    lp.Q.value = 0.7;
    for (const [type, freq, gain] of [['sawtooth', 55, 0.5], ['sawtooth', 55.35, 0.5], ['sine', 27.5, 0.9], ['triangle', 82.4, 0.25]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g).connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    lp.connect(bed).connect(this.master);

    // one second of white noise, reused by the whoosh
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  tick(pitch = 1) {
    if (!this.enabled || !this.ctx) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1150 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(520 * pitch, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.13);
  }

  whoosh(duration = 1.1) {
    if (!this.enabled || !this.ctx) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(220, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + duration * 0.45);
    bp.frequency.exponentialRampToValueAtTime(260, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + duration * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  servo(duration = 1.1) {
    if (!this.enabled || !this.ctx) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, t);
    o.frequency.linearRampToValueAtTime(235, t + duration * 0.3);
    o.frequency.linearRampToValueAtTime(210, t + duration);
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.06);
    g.gain.setValueAtTime(0.03, t + duration - 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  shutter() {
    if (!this.enabled || !this.ctx) return;
    this.tick(0.5);
    setTimeout(() => this.tick(0.35), 70);
  }
}
