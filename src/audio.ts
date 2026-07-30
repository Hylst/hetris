let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicTimeout: ReturnType<typeof setTimeout> | null = null;
let ambienceInterval: ReturnType<typeof setInterval> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let muted = false;
let volume = 0.7;
let currentMusicBeat = 0;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (!masterGain) {
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : volume;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

function output(): GainNode {
  getCtx();
  return masterGain!;
}

function applyMasterGain() {
  if (!masterGain || !audioCtx) return;
  masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(
    muted ? 0 : volume,
    audioCtx.currentTime + 0.08
  );
}

function tone({
  freq,
  endFreq,
  start = 0,
  duration = 0.1,
  gain = 0.08,
  type = "sine",
  pan = 0,
  filterFreq,
}: {
  freq: number;
  endFreq?: number;
  start?: number;
  duration?: number;
  gain?: number;
  type?: OscillatorType;
  pan?: number;
  filterFreq?: number;
}) {
  const ctx = getCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const p = ctx.createStereoPanner();
  const now = ctx.currentTime + start;

  o.type = type;
  o.frequency.setValueAtTime(freq, now);
  if (endFreq) {
    o.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  }
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  p.pan.value = pan;

  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    o.connect(f).connect(g).connect(p).connect(output());
  } else {
    o.connect(g).connect(p).connect(output());
  }
  o.start(now);
  o.stop(now + duration + 0.02);
}

function chord(frequencies: number[], start = 0, duration = 0.2, gain = 0.05) {
  frequencies.forEach((freq, i) => {
    tone({
      freq,
      start: start + i * 0.02,
      duration,
      gain: gain / frequencies.length,
      type: "triangle",
      pan: (Math.random() - 0.5) * 0.4,
    });
  });
}

function noise(duration = 0.14, gain = 0.05, filterFreq = 900) {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.2;
  g.gain.value = gain;
  source.connect(filter).connect(g).connect(output());
  source.start();
}

export function resumeAudio() {
  const ctx = getCtx();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  applyMasterGain();
}

export function setMuted(value: boolean) {
  muted = value;
  applyMasterGain();
}

export function setVolume(value: number) {
  volume = Math.max(0, Math.min(1, value));
  applyMasterGain();
}

export function playMove() {
  tone({ freq: 360, endFreq: 260, duration: 0.05, gain: 0.04, type: "sine" });
}

export function playRotate() {
  tone({ freq: 580, endFreq: 460, duration: 0.07, gain: 0.055, type: "triangle" });
}

export function playDrop() {
  tone({ freq: 160, endFreq: 50, duration: 0.16, gain: 0.1, type: "sawtooth" });
  noise(0.1, 0.035, 700);
}

export function playClear(lines = 1) {
  const base = lines >= 4 ? [523, 659, 784, 1047] : lines === 3 ? [440, 554, 659] : [392, 523];
  base.forEach((freq, i) => {
    tone({
      freq,
      start: i * 0.04,
      duration: 0.2 + lines * 0.03,
      gain: 0.065,
      type: lines >= 4 ? "square" : "triangle",
      pan: (i - base.length / 2) * 0.15,
    });
  });
  noise(0.18, lines >= 4 ? 0.07 : 0.04, 1200);
}

export function playQuad() {
  [523, 659, 784, 1047, 988, 784, 1047].forEach((freq, i) => {
    tone({ freq, start: i * 0.08, duration: 0.22, gain: 0.075, type: "square" });
  });
  chord([659, 783, 1047], 0.4, 0.5, 0.06);
}

export function playCombo(combo: number) {
  const base = 420 + Math.min(combo, 10) * 55;
  tone({ freq: base, endFreq: base * 1.7, duration: 0.12, gain: 0.08, type: "triangle" });
  tone({ freq: base * 1.25, endFreq: base * 2, duration: 0.1, gain: 0.05, type: "sine" });
}

export function playLevelUp() {
  [392, 523, 659, 784, 1047].forEach((freq, i) => {
    tone({ freq, start: i * 0.07, duration: 0.32, gain: 0.08, type: "square" });
  });
  chord([523, 659, 784, 1047], 0.35, 0.8, 0.07);
}

export function playGameOver() {
  [440, 349, 294, 220, 147].forEach((freq, i) => {
    tone({ freq, start: i * 0.16, duration: 0.34, gain: 0.11, type: "sawtooth" });
  });
  chord([147, 196, 247], 0.6, 1.2, 0.08);
}

export function playHold() {
  tone({ freq: 330, endFreq: 550, duration: 0.11, gain: 0.075, type: "triangle" });
}

export function playDanger() {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(110, now);
  o.frequency.linearRampToValueAtTime(90, now + 0.25);
  g.gain.setValueAtTime(0.06, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  o.connect(g).connect(output());
  o.start(now);
  o.stop(now + 0.3);
}

// La zicmu de fond. Rien de pre-enregistre, tout est synthetise au vol.
export function startMusic(level = 1) {
  stopMusic();
  currentMusicBeat = 0;
  const ctx = getCtx();

  // Plus le niveau monte, plus la gamme devient tendue
  const scales = [
    [65, 73, 82, 98, 110, 98, 82, 73],
    [65, 78, 87, 98, 110, 98, 87, 78],
    [62, 74, 83, 93, 110, 93, 83, 74],
    [58, 70, 78, 93, 110, 93, 78, 70],
  ];
  const scale = scales[Math.min(level - 1, scales.length - 1)];
  const leadNotes = [
    [196, 247, 294, 330, 294, 247, 220, 196],
    [220, 262, 330, 392, 330, 262, 247, 220],
    [247, 294, 349, 440, 349, 294, 262, 247],
    [196, 247, 311, 370, 311, 247, 220, 196],
  ][Math.min(level - 1, 3)];

  function playBeat() {
    if (!audioCtx || audioCtx.state === "closed") return;
    const tension = Math.min(level, 15) / 15;
    const idx = currentMusicBeat % scale.length;
    const interval = Math.max(360, 720 - level * 22);
    const now = ctx.currentTime;

    // la basse qui tape en bas
    tone({
      freq: scale[idx],
      duration: 0.5,
      gain: 0.035 + tension * 0.02,
      type: "triangle",
      pan: -0.15,
    });

    // kick sur les temps 0 et 4
    if (idx % 4 === 0) {
      tone({
        freq: 55,
        endFreq: 35,
        duration: 0.18,
        gain: 0.08 + tension * 0.025,
        type: "sine",
        pan: 0.1,
      });
    }

    // la petite melodie par-dessus
    if (idx % 2 === 0) {
      tone({
        freq: leadNotes[idx],
        start: 0.06,
        duration: 0.34,
        gain: 0.022 + tension * 0.012,
        type: "sine",
        pan: 0.15,
      });
    }

    // hi-hat
    if (idx % 2 === 1) {
      noise(0.03, 0.018, 7000);
    }

    // niveau 3+ : on rajoute un arpege
    if (level >= 3 && idx % 4 === 3) {
      chord(
        [leadNotes[idx], leadNotes[idx] * 1.25, leadNotes[idx] * 1.5],
        0.08,
        0.22,
        0.035
      );
    }

    // niveau 6+ : on sort la scie, ca devient sale
    if (level >= 6 && idx % 4 === 0) {
      const saw = ctx.createOscillator();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      saw.type = "sawtooth";
      saw.frequency.setValueAtTime(scale[idx] * 2, now);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(260, now);
      filter.frequency.linearRampToValueAtTime(80, now + 0.4);
      g.gain.setValueAtTime(0.015, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      saw.connect(filter).connect(g).connect(output());
      saw.start(now);
      saw.stop(now + 0.5);
    }

    currentMusicBeat++;
    musicTimeout = setTimeout(playBeat, interval);
  }

  playBeat();
}

export function stopMusic() {
  if (musicTimeout) {
    clearTimeout(musicTimeout);
    musicTimeout = null;
  }
}

export function updateAmbienceLevel(level: number) {
  stopAmbience();
  if (level <= 1) return;

  const period = Math.max(1100, 4800 - (level - 1) * 280);

  ambienceInterval = setInterval(() => {
    tone({
      freq: Math.max(32, 82 - level * 3),
      endFreq: Math.max(28, 62 - level * 2),
      duration: 0.9,
      gain: 0.02 + Math.min(level, 12) * 0.002,
      type: "sine",
    });
  }, period);

  // niveau 8+ : battement de coeur, histoire de mettre la pression
  if (level >= 8) {
    heartbeatInterval = setInterval(() => {
      playDanger();
    }, Math.max(800, 2000 - (level - 8) * 120));
  }
}

export function stopAmbience() {
  if (ambienceInterval !== null) {
    clearInterval(ambienceInterval);
    ambienceInterval = null;
  }
  if (heartbeatInterval !== null) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
