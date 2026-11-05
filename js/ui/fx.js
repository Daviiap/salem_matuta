// Animações de eventos do jogo. A tela é redesenhada a cada mudança, então os
// efeitos não ficam nos elementos da mesa: vivem numa camada própria (#fx),
// posicionada a partir de onde cada lugar está na tela. Tudo em passos
// (steps), no ritmo da pixel art. Quem pede menos movimento não vê nada.
import { CARDS, TRIALS } from '../engine/cards.js';
import { cardFace, cardBack } from './dom.js';
import { icon } from './pixel.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let layer;
function fxLayer() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.id = 'fx';
    document.body.append(layer);
  }
  return layer;
}

function spawn(html, { x, y }, cls = '') {
  const el = document.createElement('div');
  el.className = 'fx ' + cls;
  el.innerHTML = html;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  fxLayer().append(el);
  return el;
}

function run(el, frames, opts) {
  const a = el.animate(frames, { fill: 'both', ...opts });
  a.onfinish = () => el.remove();
  a.oncancel = () => el.remove();
  return a;
}

const center = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
};
const seatAt = (pid) => center(document.querySelector(`.seat[data-pid="${pid}"]`));
const deckAt = () => center(document.querySelector('.table-center .pile'));
const handAt = () => center(document.querySelector('.dock .fan'));

// uma carta voa de um ponto a outro, num arco
function fly(html, from, to, { delay = 0, dur = 560 } = {}) {
  if (!from || !to) return;
  const el = spawn(html, from, 'fx-card');
  const dx = to.x - from.x, dy = to.y - from.y;
  const lift = Math.min(80, 30 + Math.hypot(dx, dy) / 6);
  run(el, [
    { transform: 'translate(-50%,-50%) scale(.7) rotate(-8deg)', opacity: 0 },
    { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - lift}px)) scale(1.1) rotate(6deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.8) rotate(0deg)`, opacity: 1, offset: 0.92 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`, opacity: 0 },
  ], { duration: dur, delay, easing: 'steps(10)' });
}

// texto que sobe e some (+3, BRUXA!…)
function floatText(text, at, cls, delay = 0) {
  if (!at) return;
  const el = spawn(text, { x: at.x, y: at.y - (at.h || 0) * 0.2 }, 'fx-text ' + cls);
  run(el, [
    { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
    { transform: 'translate(-50%,-90%) scale(1.25)', opacity: 1, offset: 0.2 },
    { transform: 'translate(-50%,-120%) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translate(-50%,-190%) scale(1)', opacity: 0 },
  ], { duration: 1300, delay, easing: 'steps(12)' });
}

// moldura que pisca por cima de um lugar
function flash(at, cls, delay = 0) {
  if (!at) return;
  const el = spawn('', at, 'fx-flash ' + cls);
  el.style.width = at.w + 12 + 'px';
  el.style.height = at.h + 12 + 'px';
  run(el, [
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
    { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 0.2, offset: 0.25 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.5 },
    { transform: 'translate(-50%,-50%) scale(1.14)', opacity: 0 },
  ], { duration: 700, delay, easing: 'steps(6)' });
}

// sprites que espirram para os lados
function burst(at, sprites, { n = 8, delay = 0, dist = 70 } = {}) {
  if (!at) return;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = dist * (0.7 + Math.random() * 0.6);
    const el = spawn(icon(sprites[i % sprites.length]), at, 'fx-spark');
    run(el, [
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px), calc(-50% + ${Math.sin(ang) * d}px)) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * d * 1.2}px), calc(-50% + ${Math.sin(ang) * d * 1.2 + 24}px)) scale(.8)`, opacity: 0 },
    ], { duration: 900, delay: delay + i * 20, easing: 'steps(9)' });
  }
}

// a caveira sobe de quem morreu
function skull(at, delay = 0) {
  if (!at) return;
  const el = spawn(icon('caveira'), at, 'fx-skull');
  run(el, [
    { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
    { transform: 'translate(-50%,-80%) scale(1.6)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%,-90%) scale(1.5) rotate(-6deg)', opacity: 1, offset: 0.45 },
    { transform: 'translate(-50%,-100%) scale(1.5) rotate(6deg)', opacity: 1, offset: 0.65 },
    { transform: 'translate(-50%,-220%) scale(1.2)', opacity: 0 },
  ], { duration: 1600, delay, easing: 'steps(14)' });
}

// faixa grande no meio da tela
export function banner(text, cls = '') {
  if (reduced()) return;
  const el = spawn(text, { x: innerWidth / 2, y: innerHeight * 0.38 }, 'fx-banner ' + cls);
  run(el, [
    { transform: 'translate(-150%,-50%) skewX(-12deg)', opacity: 0 },
    { transform: 'translate(-50%,-50%) skewX(0)', opacity: 1, offset: 0.18 },
    { transform: 'translate(-50%,-50%) scale(1.06)', opacity: 1, offset: 0.3 },
    { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.8 },
    { transform: 'translate(60%,-50%) skewX(12deg)', opacity: 0 },
  ], { duration: 1500, easing: 'steps(15)' });
}

// chuva de sprites no fim da partida
function rain(sprites, n = 36) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * innerWidth;
    const el = spawn(icon(sprites[i % sprites.length]), { x, y: -40 }, 'fx-rain');
    const drift = (Math.random() - 0.5) * 160;
    run(el, [
      { transform: 'translate(-50%,0) rotate(0deg)' },
      { transform: `translate(calc(-50% + ${drift}px), ${innerHeight + 80}px) rotate(${Math.random() < 0.5 ? -1 : 1}turn)` },
    ], { duration: 2200 + Math.random() * 1600, delay: Math.random() * 1800, easing: 'steps(24)' });
  }
}

// compara a vista anterior com a nova e dispara os efeitos (depois de desenhar)
export function playFx(prev, v) {
  if (!prev || reduced() || v.phase === 'lobby' || prev.phase === 'lobby') return;
  const me = v.me;
  const owner = new Map();
  for (const p of prev.players) for (const c of p.front) owner.set(c.uid, p.id);
  const pme = prev.players.find((p) => p.id === me);
  const myPrevHand = new Set(pme?.hand?.map((h) => h.uid) || []);
  const actor = prev.turn?.pid || v.turn?.pid;
  let flights = 0;
  const arrive = {}; // quando a última carta chega em cada lugar

  // cartas que chegam diante de alguém (acusações, Corvo, Amuleto, Espantalho…)
  for (const p of v.players) {
    const to = seatAt(p.id);
    for (const c of p.front) {
      const was = owner.get(c.uid);
      if (was === p.id || flights > 20) continue;
      const from = was ? seatAt(was)
        : myPrevHand.has(c.uid) ? handAt()
        : actor && actor !== p.id ? seatAt(actor) : deckAt();
      const delay = flights++ * 160;
      fly(cardFace(c, { size: 'xs' }), from, to, { delay });
      arrive[p.id] = Math.max(arrive[p.id] || 0, delay + 520);
    }
  }

  // acusação que estoura o limite: a carta vai direto para o descarte (e os pontos
  // zeram), então a mostramos voando até o acusado antes do "LIMITE!"
  const pd = v.pending;
  if (pd?.kind === 'reveal' && pd.cause === 'accuse' && prev.pending?.kind !== 'reveal') {
    const to = seatAt(pd.target);
    const old = new Set(prev.discard.map((c) => c.uid));
    const fresh = v.discard.filter((c) => !old.has(c.uid) && CARDS[c.type]?.color === 'red');
    // as que já estavam diante do acusado saem dele; as novas vêm de quem acusou
    const q = prev.players.find((x) => x.id === pd.target);
    const before = new Set(q?.front.map((c) => c.uid) || []);
    let t = 0;
    for (const c of fresh.filter((c) => !before.has(c.uid))) {
      const from = myPrevHand.has(c.uid) ? handAt() : seatAt(pd.chooser);
      fly(cardFace(c, { size: 'xs' }), from, to, { delay: t });
      t += 160;
    }
    const at = to;
    setTimeout(() => {
      flash(at, 'hot');
      floatText('LIMITE!', at, 'hot');
      burst(at, ['boato', 'indicio', 'flagrante'], { n: 9, dist: 80 });
    }, t + 420);
  }

  // compras: versos voam do baralho até quem comprou
  for (const p of v.players) {
    const q = prev.players.find((x) => x.id === p.id);
    const diff = (p.handCount ?? 0) - (q?.handCount ?? 0);
    if (!q || diff <= 0 || diff > 6) continue;
    const to = p.id === me && handAt() ? handAt() : seatAt(p.id);
    for (let i = 0; i < Math.min(diff, 3) && flights < 24; i++) fly(cardBack('village', { size: 'xs' }), deckAt(), to, { delay: i * 120 + (flights++ % 4) * 40, dur: 480 });
  }

  const revealing = new Set();
  // revelações: cada carta de equipe virada estoura no lugar de quem a tinha
  if (v.phase !== 'over') {
    const before = new Set(prev.players.flatMap((p) => p.trials.filter((t) => t.revealed && t.uid).map((t) => t.uid)));
    for (const p of v.players) {
      for (const t of p.trials) {
        if (!t.revealed || !t.uid || before.has(t.uid)) continue;
        revealing.add(p.id);
        const at = seatAt(p.id);
        if (t.type === 'bruxa') {
          flash(at, 'witch');
          burst(at, ['morcego', 'bruxa', 'morcego'], { n: 10, dist: 90 });
          floatText('BRUXA!', at, 'witch', 150);
        } else {
          flash(at, 'good');
          burst(at, [t.type === 'cacador' ? 'cacador' : 'inocente', 'sol'], { n: 6, dist: 60 });
          floatText(TRIALS[t.type]?.name || '', at, 'good', 150);
        }
      }
    }
  }

  // pontos de acusação: +N quando a carta chega; -N quando a Água Benta tira
  for (const p of v.players) {
    const q = prev.players.find((x) => x.id === p.id);
    if (!q || !p.alive) continue;
    const d = p.points - q.points;
    const at = seatAt(p.id);
    if (d > 0) {
      const delay = arrive[p.id] || 0;
      floatText('+' + d, at, p.points >= p.threshold - 1 ? 'hot' : 'red', delay);
      flash(at, p.points >= p.threshold - 1 ? 'hot' : 'red', delay);
    } else if (d < 0 && !revealing.has(p.id) && v.pending?.kind !== 'reveal') {
      floatText(String(d), at, 'blue');
      burst(at, ['aguabenta'], { n: 5, dist: 50 });
    }
  }

  // mortes
  for (const p of v.players) {
    const q = prev.players.find((x) => x.id === p.id);
    if (q?.alive && !p.alive) { const at = seatAt(p.id); flash(at, 'dead', 200); skull(at, 200); }
  }

  // sua vez
  if (v.phase === 'day' && v.turn?.pid === me && prev.turn?.pid !== me && !v.pending) banner('Sua vez!');

  // fim de jogo
  if (v.phase === 'over' && prev.phase !== 'over') {
    const vila = v.winner === 'vila';
    banner(vila ? 'A Vila venceu!' : 'O Coven venceu!', vila ? 'good' : 'witch');
    rain(vila ? ['sol', 'inocente', 'abobora', 'trofeu'] : ['bruxa', 'morcego', 'caveira', 'abobora']);
  }
}

// sem uso direto, mas útil no console para ver cada efeito
export const fxDemo = { fly, floatText, flash, burst, skull, banner, rain, seatAt, deckAt, handAt, cardType: (t) => CARDS[t] };
