// Efeitos sonoros do Sabá: as deixas de abrir e fechar os olhos na Alvorada e
// na Meia-Noite (badalada, sino, coruja e galo) e a risadinha de bruxa no fim
// da partida. Os sons vêm de gravações CC0 em sounds/ (créditos no README);
// se alguma não carregar, toca a versão sintetizada com Web Audio.
// Há também um som ambiente em loop (sounds/ambiente.mp3), que pode ser
// silenciado; os efeitos sonoros não, eles fazem parte do jogo.
// Navegadores só liberam áudio depois de um toque, então o contexto de áudio
// é liberado no primeiro gesto da pessoa.

const AMBIENT_KEY = 'saba-ambient';
const AMBIENT_VOL = 0.3;
let ctx = null;
let master = null; // efeitos
let ambientGain = null; // som ambiente (liga/desliga)
let ambientSrc = null;
let ambientOn = localStorage.getItem(AMBIENT_KEY) !== 'off';

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(ctx.destination);
  loadSamples();
  return ctx;
}

// ---------- gravações ----------
const SAMPLES = { sino: 'sounds/sino.mp3', coruja: 'sounds/coruja.mp3', galo: 'sounds/galo.mp3', risada: 'sounds/risada.mp3', ambiente: 'sounds/ambiente.mp3' };
const buffers = {};
function loadSamples() {
  for (const [k, url] of Object.entries(SAMPLES)) {
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => { buffers[k] = buf; if (k === 'ambiente') startAmbient(); })
      .catch((e) => console.warn(`[som] ${url} não carregou${k === 'ambiente' ? '; sem som ambiente' : '; usando o sintetizado'}.`, e));
  }
}

// toca uma gravação (com um pouco do reverb de igreja); false se ainda não carregou
function playSample(k, { rate = 1, gain = 1, wet = 0.3 } = {}) {
  const buf = buffers[k];
  if (!buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(master);
  sendReverb(ctx, g, master, wet);
  src.start(ctx.currentTime + 0.03);
  duckAmbient(buf.duration / rate);
  return true;
}

// ---------- som ambiente ----------
// toca em loop quando já carregou e o áudio já foi liberado por um toque
function startAmbient() {
  if (ambientSrc || !buffers.ambiente || !ctx || ctx.state !== 'running') return;
  ambientSrc = ctx.createBufferSource();
  ambientSrc.buffer = buffers.ambiente;
  ambientSrc.loop = true;
  ambientSrc.connect(ambientGain);
  ambientSrc.start();
  setAmbientLevel(ambientOn ? AMBIENT_VOL : 0, 3);
}

function setAmbientLevel(v, secs = 0.5) {
  if (!ambientGain) return;
  const t = ctx.currentTime;
  ambientGain.gain.cancelScheduledValues(t);
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, t);
  ambientGain.gain.linearRampToValueAtTime(v, t + secs);
}

// abaixa o ambiente enquanto um efeito toca, para a deixa se destacar
function duckAmbient(secs) {
  if (!ambientOn || !ambientSrc) return;
  const t = ctx.currentTime;
  const g = ambientGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(AMBIENT_VOL * 0.35, t + 0.2);
  g.setValueAtTime(AMBIENT_VOL * 0.35, t + secs + 0.5);
  g.linearRampToValueAtTime(AMBIENT_VOL, t + secs + 2.5);
}

export const ambientEnabled = () => ambientOn;

export function setAmbient(on) {
  ambientOn = on;
  localStorage.setItem(AMBIENT_KEY, on ? 'on' : 'off');
  unlock();
  setAmbientLevel(on ? AMBIENT_VOL : 0);
}
export const samplesLoaded = () => Object.keys(buffers);

// já cria o contexto (suspenso até o primeiro toque) para as gravações
// estarem decodificadas quando a primeira deixa tocar
if (typeof window !== 'undefined') { try { ensure(); } catch { /* sem Web Audio */ } }

// "Hi-hi-hi-ha-ha-haaa": sílabas com vibrato rápido passando por formantes
// de vogal, subindo e depois descendo de tom.
function synthCackle() {
  const t0 = ctx.currentTime + 0.05;
  const out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(master);
  const syl = [
    [1050, 'i'], [1150, 'i'], [1250, 'i'], [1120, 'e'], [980, 'a'], [860, 'a'], [760, 'a'], [640, 'a'],
  ];
  const FORM = { i: [350, 2300], e: [500, 1900], a: [800, 1250] };
  let t = t0;
  syl.forEach(([f, v], k) => {
    const last = k === syl.length - 1;
    const dur = last ? 0.55 : 0.12;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.08, t);
    o.frequency.exponentialRampToValueAtTime(f * (last ? 0.7 : 0.92), t + dur);
    // tremor da voz
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 23;
    lfoG.gain.value = f * 0.06;
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.9, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env);
    for (const ff of FORM[v]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = ff * 1.25; // voz fininha
      bp.Q.value = 6;
      env.connect(bp);
      bp.connect(out);
    }
    // sopro de ar no começo de cada "h"
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.value = 0.15;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(out);
    noise.start(t);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
    t += last ? dur : dur + 0.035;
  });
}

// Sino de igreja de filme de terror: um sinão grave e rachado, badalando
// devagar dentro de uma nave de pedra (reverb longo gerado na hora).
// Parciais de sino afinado (hum, prime, tierce menor, quint, nominal…),
// cada uma em par levemente desafinado para o "batimento" que ondula.
const BELL_PARTIALS = [
  // [múltiplo do hum, volume, decaimento em s]
  [1, 0.55, 11],
  [2, 0.45, 8],
  [2.4, 0.42, 6.5], // tierce menor: o que dá o tom lúgubre
  [3, 0.18, 4.5],
  [4, 0.5, 6], // nominal: a "nota" que se ouve
  [5.04, 0.14, 3],
  [6, 0.16, 2.6],
  [7.1, 0.06, 1.6], // parcial fora do lugar: soa rachado
  [8, 0.1, 2],
  [10.1, 0.05, 1.2],
];
const BELL_HUM = 49; // sol bem grave
const TOLLS = 1;
const TOLL_GAP = 2.4;

// Um único reverb por contexto de áudio, ligado uma vez à saída. Cada som
// manda para ele uma parte do sinal (sendReverb), na quantidade que quiser.
const reverbs = new WeakMap();
function churchReverb(ac, dest) {
  const cached = reverbs.get(ac);
  if (cached) return cached;
  const secs = 6;
  const len = ac.sampleRate * secs;
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / ac.sampleRate;
      // primeiras reflexões esparsas e depois a cauda densa
      const early = t < 0.08 && Math.random() < 0.02 ? 0.8 : 0;
      d[i] = ((Math.random() * 2 - 1) * Math.exp(-t / 1.6) + early) * (t < 0.01 ? t / 0.01 : 1);
    }
  }
  const conv = ac.createConvolver();
  conv.buffer = ir;
  // a pedra engole os agudos
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  conv.connect(lp);
  lp.connect(dest);
  const rv = { input: conv };
  reverbs.set(ac, rv);
  return rv;
}

function sendReverb(ac, node, dest, amount) {
  const g = ac.createGain();
  g.gain.value = amount;
  node.connect(g);
  g.connect(churchReverb(ac, dest).input);
}

function bellInto(ac, dest, t0, hum = BELL_HUM) {
  const dry = ac.createGain();
  dry.gain.value = 0.5;
  const bus = ac.createGain();
  bus.gain.value = 0.5;
  bus.connect(dry);
  dry.connect(dest);
  sendReverb(ac, bus, dest, 0.55);
  for (let k = 0; k < TOLLS; k++) {
    const t = t0 + k * TOLL_GAP;
    const strike = k === 1 ? 0.85 : 1;
    for (const [mult, vol, dec] of BELL_PARTIALS) {
      for (const beat of [-0.7, 0.7]) { // dois osciladores por parcial = batimento lento
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = hum * mult + beat * (mult > 3 ? 1.6 : 1);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * strike * 0.5, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g);
        g.connect(bus);
        o.start(t);
        o.stop(t + dec + 0.1);
      }
    }
    // pancada metálica do badalo
    const n = Math.floor(ac.sampleRate * 0.08);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n / 6));
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 3;
    const ng = ac.createGain();
    ng.gain.value = 0.5 * strike;
    src.connect(bp); bp.connect(ng); ng.connect(bus);
    src.start(t);
  }
  return (TOLLS - 1) * TOLL_GAP + 11; // duração total em segundos
}

const ready = () => ensure() && ctx.state === 'running';

export function bell() {
  if (!ready()) return;
  if (!playSample('sino', { wet: 0.55 })) bellInto(ctx, master, ctx.currentTime + 0.05);
}

export function cackle() {
  if (!ready()) return;
  if (!playSample('risada', { wet: 0.25 })) synthCackle();
}

// badalada ainda mais grave: marca o começo da Alvorada e da Meia-Noite
export function toll() {
  if (!ready()) return;
  // o mesmo sino tocado mais devagar soa mais grave e mais longo
  if (!playSample('sino', { rate: 0.7, gain: 1.15, wet: 0.7 })) bellInto(ctx, master, ctx.currentTime + 0.05, 37);
}

// Coruja: dois "uuu" graves e suaves (o segundo mais longo), com o mesmo
// reverb de igreja. É a deixa do Caçador.
function owlInto(ac, dest, t0) {
  const bus = ac.createGain();
  bus.gain.value = 0.6;
  bus.connect(dest);
  sendReverb(ac, bus, dest, 0.4);
  const hoot = (t, dur, f) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.92, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(f * 0.86, t + dur);
    // um pouco de sopro, para não soar como apito
    const o2 = ac.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 2;
    const g2 = ac.createGain();
    g2.gain.value = 0.08;
    o2.connect(g2);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.06);
    g.gain.setValueAtTime(0.5, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g2.connect(g); g.connect(bus);
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 1.5;
    bp.Q.value = 2;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.05, t + 0.05);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(ng); ng.connect(bus);
    for (const x of [o, o2, src]) { x.start(t); x.stop(t + dur + 0.05); }
  };
  hoot(t0, 0.32, 390);
  hoot(t0 + 0.5, 0.9, 370);
  hoot(t0 + 1.7, 0.28, 380);
  hoot(t0 + 2.05, 0.7, 360);
}

export function owl() {
  if (!ready()) return;
  if (!playSample('coruja', { wet: 0.35 })) owlInto(ctx, master, ctx.currentTime + 0.05);
}

// Galo: "có-có-ri-cóóó" com voz rouca (dente de serra por formantes) e
// trinado no fim. É a deixa para todos abrirem os olhos.
function roosterInto(ac, dest, t0) {
  const bus = ac.createGain();
  bus.gain.value = 0.6;
  bus.connect(dest);
  sendReverb(ac, bus, dest, 0.2);
  // [início, duração, freq inicial, freq do pico, freq final]
  const SYL = [[0, 0.16, 520, 640, 560], [0.2, 0.16, 600, 720, 640], [0.4, 0.2, 700, 900, 820], [0.64, 1.1, 820, 980, 520]];
  for (const [st, dur, f0, f1, f2] of SYL) {
    const t = t0 + st;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + dur * 0.3);
    o.frequency.linearRampToValueAtTime(f2, t + dur);
    // trinado
    const lfo = ac.createOscillator();
    lfo.frequency.value = 28;
    const lg = ac.createGain();
    lg.gain.value = f1 * 0.03;
    lfo.connect(lg); lg.connect(o.frequency);
    const env = ac.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.8, t + 0.02);
    env.gain.setValueAtTime(0.7, t + dur * 0.75);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env);
    for (const [ff, q] of [[f1 * 1.1, 4], [f1 * 2.4, 6], [3200, 5]]) {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = ff;
      bp.Q.value = q;
      env.connect(bp); bp.connect(bus);
    }
    for (const x of [o, lfo]) { x.start(t); x.stop(t + dur + 0.05); }
  }
}

export function rooster() {
  if (!ready()) return;
  if (!playSample('galo', { wet: 0.15 })) roosterInto(ctx, master, ctx.currentTime + 0.05);
}

// som de cada deixa da Alvorada e da Meia-Noite
const CUES = {
  'night:sleep': toll,
  'night:witches': bell,
  'night:witchesSleep': bell,
  'night:hunter': owl,
  'night:hunterSleep': owl,
  'night:confess': rooster,
  'dawn:sleep': toll,
  'dawn:witches': bell,
  'dawn:wake': bell,
  'day:start': rooster,
};

export function cue(key) {
  CUES[key]?.();
}

// para inspeção: renderiza um som offline e devolve o buffer
export async function renderOffline(kind = 'bell') {
  const ac = new OfflineAudioContext(2, 44100 * 14, 44100);
  ({ bell: (a, d, t) => bellInto(a, d, t), toll: (a, d, t) => bellInto(a, d, t, 37), owl: owlInto, rooster: roosterInto })[kind](ac, ac.destination, 0.05);
  return ac.startRendering();
}

// chamado a cada toque: o primeiro libera o áudio e começa o ambiente
export function unlock() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume().then(startAmbient);
  else startAmbient();
}
