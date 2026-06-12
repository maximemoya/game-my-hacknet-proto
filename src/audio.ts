const BGM_TRACKS = ["bgm01.ogg", "bgm02.ogg", "bgm03.ogg", "bgm04.ogg"]
  .map(f => `${import.meta.env.BASE_URL}music/${f}`);
const CROSSFADE_S = 3;
const FIRST_FADE_IN_S = 2.5;
const DEFAULT_BGM_VOLUME = 0.25;
const DEFAULT_SFX_VOLUME = 0.5;

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let bgmVolume = loadVolume("bgmVolume", DEFAULT_BGM_VOLUME);
let sfxVolume = loadVolume("sfxVolume", DEFAULT_SFX_VOLUME);

interface BgmSlot {
  el: HTMLAudioElement;
  gain: GainNode;
}

let slots: BgmSlot[] = [];
let activeSlot = 0;
let currentTrack = -1;
let crossfading = false;

function loadVolume(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  sfxGain = ctx.createGain();
  sfxGain.gain.value = sfxVolume;
  sfxGain.connect(ctx.destination);

  bgmGain = ctx.createGain();
  bgmGain.gain.value = bgmVolume;
  bgmGain.connect(ctx.destination);

  noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  return ctx;
}

export function setupAudio(): void {
  const unlock = () => {
    document.removeEventListener("keydown", unlock);
    document.removeEventListener("pointerdown", unlock);
    const c = ensureContext();
    if (!c) return;
    c.resume().then(() => startBgm());
  };
  document.addEventListener("keydown", unlock);
  document.addEventListener("pointerdown", unlock);
  setupVolumeUi();
}

// --- SFX: synthesized mechanical keyboard ---

function noiseHit(centerHz: number, q: number, gainValue: number, durationS: number): void {
  if (!ctx || !sfxGain || !noiseBuffer || ctx.state !== "running") return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = centerHz;
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(gainValue, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationS);
  src.connect(filter).connect(env).connect(sfxGain);
  src.start();
  src.stop(ctx.currentTime + durationS);
}

export function playKeyClick(): void {
  noiseHit(2000 + Math.random() * 2000, 1.2, 0.25 + Math.random() * 0.15, 0.03);
}

export function playCommandRun(): void {
  noiseHit(1200, 1, 0.5, 0.05);
  if (!ctx || !sfxGain || ctx.state !== "running") return;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 120;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.4, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(env).connect(sfxGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

// --- per-command space SFX ---

function sweep(type: OscillatorType, f0: number, f1: number, durationS: number, gainValue: number, delayS = 0): void {
  if (!ctx || !sfxGain || ctx.state !== "running") return;
  const t0 = ctx.currentTime + delayS;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + durationS);
  const env = ctx.createGain();
  env.gain.setValueAtTime(gainValue, t0);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + durationS);
  osc.connect(env).connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + durationS);
}

function blipSeq(freqs: number[], stepS = 0.09, durationS = 0.07, gainValue = 0.2): void {
  freqs.forEach((f, i) => sweep("sine", f, f, durationS, gainValue, i * stepS));
}

const COMMAND_SFX: Record<string, () => void> = {
  scan: () => { sweep("sine", 600, 1400, 0.35, 0.25); sweep("sine", 600, 1400, 0.3, 0.08, 0.45); },
  connect: () => blipSeq([440, 660, 880]),
  disconnect: () => blipSeq([880, 660, 440]),
  rm: () => sweep("sawtooth", 900, 80, 0.25, 0.2),
  clear: () => noiseHit(800, 0.5, 0.3, 0.3),
  run: () => sweep("sawtooth", 200, 900, 0.3, 0.15),
  save: () => blipSeq([700, 700, 1100]),
  load: () => blipSeq([1100, 700, 700]),
  reset: () => sweep("triangle", 400, 60, 0.5, 0.3),
  help: () => blipSeq([520, 780], 0.12),
  ls: () => blipSeq([900, 900], 0.06, 0.04),
  cat: () => blipSeq([600, 900, 1200], 0.06, 0.05),
  pwd: () => blipSeq([750]),
  cd: () => sweep("sine", 500, 700, 0.12, 0.2),
  whoami: () => blipSeq([300, 600], 0.12),
  echo: () => { blipSeq([800]); blipSeq([800], 0.09, 0.07, 0.07); },
  mem: () => blipSeq([400, 500, 600], 0.07, 0.05),
  changeAuth: () => blipSeq([500, 1000], 0.1),
};

export function playCommandSfx(name: string): void {
  const fx = COMMAND_SFX[name];
  if (fx) fx();
  else playCommandRun();
}

export function playError(): void {
  if (!ctx || !sfxGain || ctx.state !== "running") return;
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 110;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.15, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(env).connect(sfxGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

// --- BGM: random infinite loop with crossfade ---

function startBgm(): void {
  if (!ctx || !bgmGain || slots.length > 0) return;
  slots = [0, 1].map(() => {
    const el = new Audio();
    el.preload = "auto";
    const gain = ctx!.createGain();
    gain.gain.value = 0;
    ctx!.createMediaElementSource(el).connect(gain).connect(bgmGain!);
    return { el, gain };
  });

  for (const slot of slots) {
    slot.el.addEventListener("timeupdate", () => {
      if (crossfading || slot !== slots[activeSlot]) return;
      const remaining = slot.el.duration - slot.el.currentTime;
      if (Number.isFinite(remaining) && remaining <= CROSSFADE_S) {
        crossfadeToNext();
      }
    });
    slot.el.addEventListener("ended", () => {
      if (slot === slots[activeSlot] && !crossfading) crossfadeToNext();
    });
  }

  const first = slots[activeSlot];
  playTrack(first, pickNextTrack(), 0);
  first.gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FIRST_FADE_IN_S);
}

function pickNextTrack(): number {
  let next: number;
  do {
    next = Math.floor(Math.random() * BGM_TRACKS.length);
  } while (next === currentTrack && BGM_TRACKS.length > 1);
  currentTrack = next;
  return next;
}

function playTrack(slot: BgmSlot, track: number, targetGain: number): void {
  slot.el.src = BGM_TRACKS[track];
  slot.gain.gain.setValueAtTime(targetGain, ctx!.currentTime);
  slot.el.play().catch(() => { /* play can fail before user gesture; next crossfade retries */ });
}

function crossfadeToNext(): void {
  if (!ctx) return;
  crossfading = true;
  const from = slots[activeSlot];
  activeSlot = 1 - activeSlot;
  const to = slots[activeSlot];

  const now = ctx.currentTime;
  from.gain.gain.setValueAtTime(from.gain.gain.value, now);
  from.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_S);

  playTrack(to, pickNextTrack(), 0);
  to.gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_S);

  setTimeout(() => {
    from.el.pause();
    crossfading = false;
  }, CROSSFADE_S * 1000 + 100);
}

// --- Volume UI ---

function setupVolumeUi(): void {
  const bgmSlider = document.getElementById("bgmVol") as HTMLInputElement | null;
  const sfxSlider = document.getElementById("sfxVol") as HTMLInputElement | null;

  if (bgmSlider) {
    bgmSlider.value = String(bgmVolume);
    bgmSlider.addEventListener("input", () => {
      bgmVolume = Number(bgmSlider.value);
      localStorage.setItem("bgmVolume", bgmSlider.value);
      if (bgmGain && ctx) bgmGain.gain.setValueAtTime(bgmVolume, ctx.currentTime);
    });
  }
  if (sfxSlider) {
    sfxSlider.value = String(sfxVolume);
    sfxSlider.addEventListener("input", () => {
      sfxVolume = Number(sfxSlider.value);
      localStorage.setItem("sfxVolume", sfxSlider.value);
      if (sfxGain && ctx) sfxGain.gain.setValueAtTime(sfxVolume, ctx.currentTime);
    });
  }
}
