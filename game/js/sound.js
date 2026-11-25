// sound.js — WebAudio sound effects, synthesized only. No audio files,
// no network. Everything is created lazily on the first user gesture so
// browsers allow it; muted state is kept here and toggled with M.

let audioCtx = null;
let sizzleNodes = null;
let muted = false;

export function setMuted(value) {
  muted = value;
  if (muted) stopSizzle();
}

export function isMuted() {
  return muted;
}

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();
  return audioCtx;
}

// Call once from any user gesture so later sounds are allowed to play.
export function unlockAudio() {
  ensureAudio();
}

// A short two-note ding when a bowl is served.
export function playDing() {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1318.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.09 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.09);
    osc.stop(now + i * 0.09 + 0.4);
  });
}

// A low buzz when an order fails or noodles burn.
export function playBuzz() {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.linearRampToValueAtTime(90, now + 0.3);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

// A soft pop when an ingredient is picked up, chopped, or added.
export function playPop() {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

// A looping filtered-noise sizzle while noodles cook. Starts and stops
// with the pot; calling start twice is harmless.
export function startSizzle() {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx || sizzleNodes) return;
  const length = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 4200;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  sizzleNodes = { source, gain };
}

export function stopSizzle() {
  if (!sizzleNodes) return;
  try {
    sizzleNodes.source.stop();
  } catch (e) {
    // Already stopped; nothing to do.
  }
  sizzleNodes = null;
}
