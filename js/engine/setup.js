// Aleatoriedade determinística (semente guardada no estado) e montagem do baralho.
import { CARDS, SETUP_TABLE, CHARACTER_IDS } from './cards.js';

export function newSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 2 ** 32);
}

// mulberry32: a semente vive em state.seed para o estado ser serializável
export function rand(s) {
  s.seed = (s.seed + 0x6D2B79F5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function mkCard(s, type) {
  return { uid: 'c' + (++s.uidSeq), type };
}

export function buildDeck(s) {
  const cards = [];
  for (const [type, def] of Object.entries(CARDS)) {
    for (let i = 0; i < def.count; i++) cards.push(mkCard(s, type));
  }
  return cards;
}

export function buildTrials(s, n) {
  const row = SETUP_TABLE[n];
  if (!row) throw new Error(`O jogo é para 4 a 12 jogadores (há ${n}).`);
  const [inocentes, bruxas, cacador] = row;
  const trials = [];
  const add = (type, k) => { for (let i = 0; i < k; i++) trials.push({ uid: 't' + (++s.uidSeq), type, revealed: false }); };
  add('inocente', inocentes);
  add('bruxa', bruxas);
  add('cacador', cacador);
  return shuffle(s, trials);
}

export function characterOptions(s, n) {
  const ids = shuffle(s, [...CHARACTER_IDS]);
  const per = n <= 7 ? 2 : 1;
  const out = [];
  for (let i = 0; i < n; i++) out.push(ids.slice(i * per, i * per + per));
  return out;
}
