// Quiz-show sound effects synthesized with the Web Audio API, so there are no audio files to license or load.
type Ctx = BaseAudioContext;
type ToneOptions = { to?: number; attack?: number; out?: AudioNode };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function audioRunning() { return ctx?.state === 'running'; }

// Browsers only start audio from a user gesture, so call this from a click/tap/key handler.
export async function unlockAudio() {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx!.createGain();
    master.gain.value = 0.85;
    const limiter = ctx!.createDynamicsCompressor();
    master.connect(limiter);
    limiter.connect(ctx!.destination);
  }
  if (ctx!.state !== 'running') { try { await ctx!.resume(); } catch { /* stays locked until the next gesture */ } }
  return ctx!.state === 'running';
}

function tone(ac: Ctx, out: AudioNode, type: OscillatorType, freq: number, start: number, duration: number, peak: number, options: ToneOptions = {}) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + (options.attack ?? 0.005));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(options.out ?? out);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function lowpass(ac: Ctx, out: AudioNode, frequency: number) {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  filter.connect(out);
  return filter;
}

function riser(ac: Ctx, out: AudioNode, start: number, duration: number, peak: number) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(300, start);
  band.frequency.exponentialRampToValueAtTime(5000, start + duration);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + duration * 0.95);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(band);
  band.connect(gain);
  gain.connect(out);
  source.start(start);
}

// The sub-bass carries on a PA system; the triangle layer keeps the beat audible on laptop and phone speakers.
function heartbeat(ac: Ctx, out: AudioNode, start: number, gap: number, peak: number) {
  tone(ac, out, 'sine', 72, start, 0.2, peak, { to: 42 });
  tone(ac, out, 'triangle', 190, start, 0.13, peak * 0.45, { to: 95 });
  tone(ac, out, 'sine', 64, start + gap, 0.18, peak * 0.6, { to: 40 });
  tone(ac, out, 'triangle', 170, start + gap, 0.11, peak * 0.28, { to: 90 });
}

// A question opens: rising whoosh into a low impact with a dark minor chord.
export function questionSting(ac: Ctx, out: AudioNode, t: number) {
  riser(ac, out, t, 0.7, 0.22);
  const hit = t + 0.7;
  tone(ac, out, 'sine', 130, hit, 1.1, 0.9, { to: 34 });
  tone(ac, out, 'triangle', 880, hit, 0.35, 0.14, { to: 420 });
  const dark = lowpass(ac, out, 900);
  for (const freq of [73.42, 146.83, 174.61, 220]) tone(ac, out, 'sawtooth', freq, hit, 1.6, 0.11, { attack: 0.02, out: dark });
}

// Once per remaining second: clock tick over a heartbeat, doubling up for the last 10s and rising for the last 5s.
export function countdownTick(ac: Ctx, out: AudioNode, t: number, left: number) {
  const urgent = left <= 10;
  const pitch = urgent ? 1180 : left % 2 ? 880 : 700;
  tone(ac, out, 'square', pitch, t, 0.035, urgent ? 0.09 : 0.06);
  heartbeat(ac, out, t, urgent ? 0.17 : 0.22, urgent ? 0.5 : 0.36);
  if (urgent) {
    tone(ac, out, 'square', pitch * 0.84, t + 0.5, 0.035, 0.07);
    heartbeat(ac, out, t + 0.5, 0.17, 0.42);
  }
  if (left <= 5) tone(ac, out, 'sawtooth', 196 * 2 ** ((6 - left) / 6), t, 0.9, 0.07, { attack: 0.3, out: lowpass(ac, out, 1400) });
}

export function timeUp(ac: Ctx, out: AudioNode, t: number) {
  const muffled = lowpass(ac, out, 700);
  tone(ac, out, 'square', 155, t, 0.75, 0.22, { attack: 0.01, out: muffled });
  tone(ac, out, 'square', 116, t, 0.75, 0.2, { attack: 0.01, out: muffled });
}

export function answerReveal(ac: Ctx, out: AudioNode, t: number) {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    tone(ac, out, 'sine', freq, t + i * 0.09, 0.7, 0.2);
    tone(ac, out, 'triangle', freq * 2, t + i * 0.09, 0.4, 0.05);
  });
}

export function fanfare(ac: Ctx, out: AudioNode, t: number) {
  [[392, 0], [523.25, 0.16], [659.25, 0.32], [783.99, 0.48], [1046.5, 0.72]].forEach(([freq, at], i) => {
    tone(ac, out, 'triangle', freq, t + at, i === 4 ? 1.2 : 0.3, 0.2, { attack: 0.01 });
    tone(ac, out, 'sine', freq / 2, t + at, i === 4 ? 1.2 : 0.3, 0.14, { attack: 0.01 });
  });
}

type Effect = (ac: Ctx, out: AudioNode, t: number, ...rest: any[]) => void;
export function play(effect: Effect, ...rest: any[]) {
  if (!ctx || !master || ctx.state !== 'running') return;
  effect(ctx, master, ctx.currentTime + 0.02, ...rest);
}
