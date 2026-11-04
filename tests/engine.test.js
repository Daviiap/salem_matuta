import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, addPlayer, startGame, applyAction, tick, getP, alivePlayers,
  accusationPoints, threshold, GameError,
} from '../js/engine/game.js';
import { viewFor } from '../js/engine/view.js';
import { SETUP_TABLE, CARDS } from '../js/engine/cards.js';

function setup(n, seed = 1) {
  const s = createGame();
  s.seed = seed;
  for (let i = 0; i < n; i++) addPlayer(s, 'p' + i, 'Jogador ' + i);
  startGame(s);
  if (s.phase === 'choose') for (const p of s.players) applyAction(s, p.id, { type: 'pickCharacter', character: p.options[0] });
  return s;
}

function finishDawn(s, target = null) {
  const ws = s.players.filter((p) => p.everWitch);
  const t = target || s.players[0].id;
  for (const w of ws) applyAction(s, w.id, { type: 'dawnVote', target: t });
}

const give = (s, pid, type) => { const c = { uid: 'x' + Math.random(), type }; getP(s, pid).hand.push(c); return c; };

test('montagem para 4 a 12 jogadores', () => {
  for (let n = 4; n <= 12; n++) {
    const s = setup(n, n);
    const [ino, bru, cac, per] = SETUP_TABLE[n];
    const all = s.players.flatMap((p) => p.trials);
    assert.equal(all.length, ino + bru + cac);
    assert.equal(all.filter((t) => t.type === 'bruxa').length, bru);
    for (const p of s.players) { assert.equal(p.trials.length, per); assert.equal(p.hand.length, 3); assert.ok(p.character); }
    assert.equal(s.deck.at(-1).type, 'meianoite');
    const total = s.deck.length + s.players.reduce((k, p) => k + p.hand.length, 0) + s.aside.length;
    assert.equal(total, Object.values(CARDS).reduce((k, c) => k + c.count, 0));
    assert.equal(s.phase, 'dawn');
  }
});

test('alvorada exige unanimidade do coven e o escolhido começa', () => {
  const s = setup(6, 3);
  const ws = s.players.filter((p) => p.everWitch);
  assert.equal(ws.length, 2);
  applyAction(s, ws[0].id, { type: 'dawnVote', target: 'p2' });
  applyAction(s, ws[1].id, { type: 'dawnVote', target: 'p3' });
  assert.equal(s.phase, 'dawn');
  applyAction(s, ws[1].id, { type: 'dawnVote', target: 'p2' });
  assert.equal(s.phase, 'day');
  assert.equal(s.turn.pid, 'p2');
  assert.ok(getP(s, 'p2').front.some((c) => c.type === 'corvo'));
});

test('acusação chega a 7 e pede revelação; excesso é descartado', () => {
  const s = setup(5, 7);
  finishDawn(s, 'p0');
  for (const p of s.players) p.character = 'padre' === p.character ? 'juiz' : p.character; // sem redutores
  s.players.forEach((p) => { if (['ferreiro', 'xerife', 'prefeito', 'aprendiz', 'padre'].includes(p.character)) p.character = 'viuva'; });
  const ev = give(s, 'p0', 'indicio'); const ev2 = give(s, 'p0', 'indicio'); const b = give(s, 'p0', 'boato');
  applyAction(s, 'p0', { type: 'play', uid: ev.uid, targets: ['p1'] });
  applyAction(s, 'p0', { type: 'play', uid: ev2.uid, targets: ['p1'] });
  assert.equal(accusationPoints(s, getP(s, 'p1')), 6);
  assert.equal(s.pending, null);
  applyAction(s, 'p0', { type: 'play', uid: b.uid, targets: ['p1'] });
  assert.equal(s.pending?.kind, 'reveal');
  assert.equal(accusationPoints(s, getP(s, 'p1')), 0);
  applyAction(s, 'p0', { type: 'reveal', index: 0 });
  assert.ok(getP(s, 'p1').trials[0].revealed);
});

test('limiares: Ferreiro 8, Xerife 6, Xerife contra Ferreiro 7, Padre reduz Indício', () => {
  const s = setup(5, 9);
  finishDawn(s);
  const [a, b] = [getP(s, 'p0'), getP(s, 'p1')];
  a.character = 'xerife'; b.character = 'ferreiro';
  assert.equal(threshold(s, b), 8);
  assert.equal(threshold(s, b, a), 7);
  b.character = 'viuva';
  assert.equal(threshold(s, b, a), 6);
  b.character = 'padre';
  b.front.push({ uid: 'z', type: 'indicio' });
  assert.equal(accusationPoints(s, b), 1);
});

test('não pode mirar a si mesmo; Amuleto bloqueia vermelhas', () => {
  const s = setup(5, 11);
  finishDawn(s, 'p0');
  const c = give(s, 'p0', 'boato');
  assert.throws(() => applyAction(s, 'p0', { type: 'play', uid: c.uid, targets: ['p0'] }), GameError);
  getP(s, 'p1').front.push({ uid: 'am', type: 'amuleto' });
  assert.throws(() => applyAction(s, 'p0', { type: 'play', uid: c.uid, targets: ['p1'] }), /Amuleto/);
});

test('meia-noite: vítima morre sem proteção; Lanterna salva', () => {
  for (const protect of [false, true]) {
    const s = setup(6, 21);
    finishDawn(s, 'p0');
    const ws = s.players.filter((p) => p.everWitch);
    const victim = s.players.find((p) => !p.everWitch && !p.trials.some((t) => t.type === 'cacador'));
    s.deck.unshift(...s.deck.splice(s.deck.findIndex((c) => c.type === 'meianoite'), 1));
    const turnP = s.turn.pid;
    applyAction(s, turnP, { type: 'draw' }, 0);
    assert.equal(s.phase, 'night');
    for (const w of ws) applyAction(s, w.id, { type: 'nightVote', target: victim.id }, 0);
    const hunter = s.night.hunter;
    if (hunter) {
      const pick = protect ? victim.id : s.players.find((p) => p.id !== hunter && p.id !== victim.id).id;
      if (hunter === victim.id) continue;
      applyAction(s, hunter, { type: 'hunterPick', target: pick }, 0);
    }
    assert.equal(s.night.stage, 'confess');
    tick(s, 10 ** 9);
    assert.equal(getP(s, victim.id).alive, protect);
    assert.equal(s.report.target, victim.id);
    assert.deepEqual(s.report.deaths.map((d) => d.id).includes(victim.id), !protect);
    if (protect) assert.equal(s.report.protected, victim.id);
    if (s.phase !== 'over') {
      assert.equal(s.phase, 'day');
      assert.equal(s.deck.at(-1).type, 'meianoite');
    }
  }
});

test('eclipse: cada um escolhe uma carta do vizinho; sem escolha, sorteia ao fim do tempo', () => {
  const s = setup(5, 33);
  finishDawn(s, 'p0');
  for (const p of s.players) p.front = p.front.filter((c) => c.type !== 'corvo');
  s.deck.unshift(...s.deck.splice(s.deck.findIndex((c) => c.type === 'eclipse'), 1));
  applyAction(s, s.turn.pid, { type: 'draw' }, 0);
  assert.equal(s.pending?.kind, 'swap');
  const before = s.players.map((p) => p.trials.length);
  const p0 = getP(s, 'p0'), p1 = getP(s, 'p1');
  const chosen = p1.trials[2];
  assert.throws(() => applyAction(s, 'p0', { type: 'swapTrials', i: 0, j: 1 }, 0), GameError);
  applyAction(s, 'p0', { type: 'swapPick', index: 2 }, 0);
  assert.throws(() => applyAction(s, 'p0', { type: 'swapPick', index: 1 }, 0), GameError);
  const v = viewFor(s, 'p0');
  assert.equal(v.pending.from, 'p1');
  assert.equal(v.pending.pick, 2);
  assert.ok(!v.pending.waiting.includes('p0'));
  tick(s, 29000);
  assert.equal(s.pending?.kind, 'swap');
  tick(s, 30000);
  assert.equal(s.pending, null);
  assert.ok(p0.trials.includes(chosen));
  assert.ok(!p1.trials.includes(chosen));
  assert.deepEqual(s.players.map((p) => p.trials.length), before);
});

test('laço de sangue mata o parceiro', () => {
  const s = setup(6, 33);
  finishDawn(s, 'p0');
  s.players.forEach((p) => { if (p.character === 'costureira' || p.character === 'coveiro') p.character = 'viuva'; });
  const [a, b] = [getP(s, 'p2'), getP(s, 'p3')];
  a.front.push({ uid: 'l1', type: 'laco' }); b.front.push({ uid: 'l2', type: 'laco' });
  a.trials.forEach((t) => { t.type = 'inocente'; });
  // revela todas as cartas de a
  for (let i = 0; i < a.trials.length; i++) {
    s.pending = { kind: 'reveal', chooser: 'p0', target: a.id, cause: 'accuse' };
    applyAction(s, 'p0', { type: 'reveal', index: i });
    if (s.phase === 'over') return;
  }
  assert.equal(a.alive, false);
  assert.equal(b.alive, false);
});

test('vista do jogador esconde cartas alheias', () => {
  const s = setup(5, 44);
  const v = viewFor(s, 'p0');
  const other = v.players.find((p) => p.id === 'p1');
  assert.equal(other.hand, undefined);
  assert.ok(other.trials.every((t) => t.type === null));
  const mine = v.players.find((p) => p.id === 'p0');
  assert.ok(mine.trials.every((t) => t.type));
  assert.equal(mine.hand.length, 3);
});

// ----- partidas completas com bots aleatórios -----
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function botStep(s, now) {
  const alive = alivePlayers(s);
  if (s.phase === 'dawn') {
    const t = rnd(s.players).id;
    for (const w of s.players.filter((p) => p.everWitch)) applyAction(s, w.id, { type: 'dawnVote', target: t }, now);
    return;
  }
  if (s.pending?.kind === 'reveal') {
    const t = getP(s, s.pending.target);
    const idx = t.trials.findIndex((x) => !x.revealed);
    applyAction(s, s.pending.chooser, { type: 'reveal', index: idx, taberna: true, juiz: true }, now);
    return;
  }
  if (s.pending?.kind === 'swap') {
    for (const { to, from } of [...s.pending.pairs]) {
      if (s.pending?.kind !== 'swap' || s.pending.picks[to] != null || Math.random() < 0.3) continue; // alguns deixam o tempo acabar
      const idx = getP(s, from).trials.findIndex((x) => !x.revealed);
      applyAction(s, to, { type: 'swapPick', index: idx }, now);
    }
    return;
  }
  if (s.pending?.kind === 'cartomante') {
    applyAction(s, s.pending.pid, { type: 'cartomanteOrder', order: [...s.pending.cards].reverse() }, now);
    return;
  }
  if (s.phase === 'night') {
    const n = s.night;
    if (n.stage === 'act') {
      const t = rnd(alive).id;
      for (const w of alive.filter((p) => p.everWitch)) applyAction(s, w.id, { type: 'nightVote', target: t }, now);
      if (n.hunter && !n.pick && s.phase === 'night') {
        const opts = alive.filter((p) => p.id !== n.hunter);
        if (opts.length) applyAction(s, n.hunter, { type: 'hunterPick', target: rnd(opts).id }, now);
      }
      return;
    }
    for (const p of alive) {
      if (s.phase !== 'night' || !p.alive || s.night.done[p.id]) continue;
      if (Math.random() < 0.2) {
        const idx = p.trials.findIndex((x) => !x.revealed);
        applyAction(s, p.id, { type: 'confess', index: idx }, now);
      } else applyAction(s, p.id, { type: 'pass' }, now);
    }
    return;
  }
  if (s.phase === 'day') {
    const p = getP(s, s.turn.pid);
    if (Math.random() < 0.05 && !s.turn.mode) {
      try { applyAction(s, p.id, { type: rnd(['cartomante', 'boticario']), uids: s.discard.slice(0, 2).map((c) => c.uid) }, now); return; } catch (e) { if (!(e instanceof GameError)) throw e; }
    }
    if (!s.turn.mode && Math.random() < 0.35) { applyAction(s, p.id, { type: 'draw' }, now); return; }
    for (let tries = 0; tries < 6 && p.hand.length; tries++) {
      const c = rnd(p.hand);
      const others = alive.filter((q) => q.id !== p.id);
      const t1 = rnd(others); const t2 = rnd(others.filter((q) => q !== t1)) || t1;
      try {
        applyAction(s, p.id, { type: 'play', uid: c.uid, targets: [t1.id, t2.id] }, now);
        return;
      } catch (e) { if (!(e instanceof GameError)) throw e; }
    }
    if (s.turn.mode === 'play') applyAction(s, p.id, { type: 'endTurn' }, now);
    else applyAction(s, p.id, { type: 'draw' }, now);
  }
}

test('200 partidas aleatórias terminam sem erro', () => {
  let vila = 0, coven = 0;
  for (let g = 0; g < 200; g++) {
    const n = 4 + (g % 9);
    const s = setup(n, 1000 + g);
    let now = 0, steps = 0;
    while (s.phase !== 'over') {
      botStep(s, now);
      now += 1000;
      tick(s, now);
      if (++steps > 5000) throw new Error(`partida ${g} não terminou (fase ${s.phase})`);
      // invariantes
      const allCards = [...s.deck, ...s.discard, ...s.aside, ...s.players.flatMap((p) => [...p.hand, ...p.front])];
      if (allCards.some((c) => !c)) throw new Error(`carta indefinida na partida ${g}: ` + s.log.slice(-6).map((e) => e.text).join(' | '));
      assert.equal(new Set(allCards.map((c) => c.uid)).size, allCards.length, 'carta duplicada');
      assert.equal(allCards.length + (s.pending?.kind === 'night' ? 0 : 0), 59, `total de cartas na partida ${g}: ` + s.log.slice(-4).map((e) => e.text).join(' | '));
      for (const p of s.players) {
        if (!p.alive) assert.ok(p.trials.every((t) => t.revealed));
        viewFor(s, p.id);
      }
      viewFor(s, null, { all: true });
    }
    if (s.winner === 'vila') vila++; else coven++;
  }
  console.log(`vitórias: vila ${vila}, coven ${coven}`);
});
