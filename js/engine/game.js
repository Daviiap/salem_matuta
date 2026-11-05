// Motor de regras do Sabá. Puro: sem DOM e sem rede.
// O estado é um objeto JSON simples, alterado no lugar por applyAction/tick.
import { CARDS, CHARACTERS, TRIALS, SETUP_TABLE } from './cards.js';
import { newSeed, rand, shuffle, buildDeck, buildTrials, characterOptions, mkCard } from './setup.js';

export class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

const LOG_MAX = 250;
export const SWAP_SECS = 30;
// Meia-Noite: todos fecham os olhos, o coven acorda, depois o Caçador.
export const NIGHT_SECS = { sleep: 10, witches: 30, witchesSleep: 5, hunter: 20, hunterSleep: 5 };
// Alvorada: mesmo ritual, mas só o coven acorda (para entregar o Corvo).
export const DAWN_SECS = { sleep: 10, witches: 30, wake: 5 };
// quando o coven entra em acordo, espera um pouco antes do sino
export const DECIDED_SECS = 3;

export function createGame(config = {}) {
  return {
    phase: 'lobby',
    // allSound: todos os aparelhos tocam os sons (senão, só o do anfitrião)
    config: { hourglass: 60, confess: 30, moderator: false, allSound: false, ...config },
    seed: newSeed(),
    uidSeq: 0,
    players: [],
    deck: [],
    discard: [],
    aside: [],
    turn: null,
    steps: [],
    pending: null,
    night: null,
    dawn: null,
    report: null,
    cycle: 0,
    log: [],
    logSeq: 0,
    winner: null,
    seq: 0,
    round: 0,
  };
}

// ---------- utilidades ----------
export const getP = (s, id) => s.players.find((p) => p.id === id);
const mustP = (s, id) => getP(s, id) || fail('Jogador desconhecido.');
export const alivePlayers = (s) => s.players.filter((p) => p.alive);
const name = (p) => p?.name ?? '?';
const cname = (type) => CARDS[type].name;

export function log(s, text, to = null) {
  s.log.push({ id: ++s.logSeq, text, ...(to ? { to } : {}) });
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

function seatIndex(s, id) { return s.players.findIndex((p) => p.id === id); }

// próximo jogador vivo na ordem da mesa (dir = 1) ou anterior (dir = -1)
export function nextAlive(s, id, dir = 1) {
  const n = s.players.length;
  let i = seatIndex(s, id);
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    const p = s.players[i];
    if (p.alive && p.id !== id) return p;
  }
  return null;
}

// habilidade copiada pelo Aprendiz: o primeiro morador vivo antes dele na mesa
export function copiedAbility(s, p) {
  if (p.character !== 'aprendiz' || !p.alive) return null;
  const prev = nextAlive(s, p.id, -1);
  return prev && prev.character !== 'aprendiz' ? prev.character : null;
}

export function has(s, p, ability) {
  if (!p || !p.alive) return false;
  return p.character === ability || copiedAbility(s, p) === ability;
}

const unrevealed = (p) => p.trials.filter((t) => !t.revealed);
const frontHas = (p, type) => p.front.some((c) => c.type === type);
const isRed = (c) => CARDS[c.type].color === 'red';
const isBlue = (c) => CARDS[c.type].color === 'blue';

export function cardValue(s, card, target) {
  if (card.type === 'boato') return card.val || 1;
  if (card.type === 'indicio') return has(s, target, 'padre') ? 1 : 3;
  if (card.type === 'flagrante') return 7;
  return 0;
}

export function accusationPoints(s, p) {
  return p.front.filter(isRed).reduce((sum, c) => sum + cardValue(s, c, p), 0);
}

export function threshold(s, target, accuser = null) {
  let t = has(s, target, 'ferreiro') ? 8 : 7;
  if (accuser && has(s, accuser, 'xerife')) t -= 1;
  return t;
}

const fewAlive = (s) => alivePlayers(s).length <= 2;

// ---------- lobby ----------
export function addPlayer(s, id, playerName) {
  if (s.phase !== 'lobby') fail('A partida já começou.');
  if (getP(s, id)) { getP(s, id).name = playerName; return; }
  if (s.players.length >= 12) fail('A sala está cheia (máximo de 12).');
  s.players.push(newPlayer(id, playerName));
  s.seq++;
}

function newPlayer(id, playerName) {
  return {
    id, name: playerName, character: null, options: [], alive: true,
    hand: [], front: [], trials: [], everWitch: false, knows: [],
    uses: { boticario: 0, cartomante: 0, sacristao: 0 },
  };
}

export function removePlayer(s, id) {
  if (s.phase !== 'lobby') fail('Só dá para remover jogadores no lobby.');
  s.players = s.players.filter((p) => p.id !== id);
  s.seq++;
}

export function movePlayer(s, id, dir) {
  const i = seatIndex(s, id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.players.length) return;
  [s.players[i], s.players[j]] = [s.players[j], s.players[i]];
  s.seq++;
}

export function startGame(s, now = Date.now()) {
  const n = s.players.length;
  if (!SETUP_TABLE[n]) fail('São necessários de 4 a 12 jogadores.');
  // permite "jogar de novo": zera os jogadores e mantém nomes e ordem
  s.players = s.players.map((p) => newPlayer(p.id, p.name));
  Object.assign(s, { deck: [], discard: [], aside: [], turn: null, steps: [], pending: null, night: null, dawn: null, report: null, winner: null, round: s.round + 1 });
  log(s, `Começa a partida nº ${s.round} com ${n} pessoas.`);

  const opts = characterOptions(s, n);
  s.players.forEach((p, i) => { p.options = opts[i]; });
  if (opts[0].length === 1) {
    s.players.forEach((p) => { p.character = p.options[0]; });
    dealAndDawn(s, now);
  } else {
    s.phase = 'choose';
  }
  s.seq++;
}

function dealAndDawn(s, now = Date.now()) {
  const n = s.players.length;
  const per = SETUP_TABLE[n][3];
  const trials = buildTrials(s, n);
  s.players.forEach((p, i) => {
    p.trials = trials.slice(i * per, i * per + per);
    p.everWitch = p.trials.some((t) => t.type === 'bruxa');
  });

  const all = buildDeck(s);
  const pull = (type) => { const i = all.findIndex((c) => c.type === type); return all.splice(i, 1)[0]; };
  const corvo = pull('corvo');
  const eclipse = pull('eclipse');
  const meianoite = pull('meianoite');
  shuffle(s, all);
  for (const p of s.players) p.hand = all.splice(0, 3);
  all.push(eclipse);
  shuffle(s, all);
  all.push(meianoite);
  s.deck = all;
  s.cycle = all.length;
  s.aside = [corvo];

  for (const p of s.players) log(s, `${name(p)} é ${CHARACTERS[p.character].name}.`);
  s.phase = 'dawn';
  s.dawn = { stage: 'sleep', deadline: now + DAWN_SECS.sleep * 1000, votes: {}, target: null };
  updateWitchKnowledge(s);
  log(s, `Alvorada: todos fecham os olhos (${DAWN_SECS.sleep} s).`);
}

// Etapas: sleep (todos fecham os olhos) → witches (o coven se reconhece e
// escolhe quem recebe o Corvo) → wake (o coven fecha os olhos) → dia.
function advanceDawn(s, now) {
  const d = s.dawn;
  if (!d) return;
  if (d.stage === 'sleep') {
    d.stage = 'witches';
    d.deadline = now + DAWN_SECS.witches * 1000;
    log(s, `O sino toca: o coven acorda e tem ${DAWN_SECS.witches} s para entregar o Corvo Agourento.`);
  } else if (d.stage === 'witches') {
    const ws = s.players.filter((q) => q.everWitch);
    let target = d.target || agreedDawn(s);
    if (!target) {
      // sem acordo a tempo: sorteia entre os votos dados ou, sem votos, entre quem não é do coven
      const voted = ws.map((w) => d.votes[w.id]).filter(Boolean);
      const pool = voted.length ? voted : s.players.filter((q) => !q.everWitch).map((q) => q.id);
      target = pool[Math.floor(rand(s) * pool.length)];
      log(s, `O tempo acabou: o destino entregou o Corvo a ${name(getP(s, target))}.`, ws.map((w) => w.id));
    }
    d.target = target;
    d.stage = 'wake';
    d.deadline = now + DAWN_SECS.wake * 1000;
    log(s, 'O sino toca de novo: o coven fecha os olhos.');
  } else if (d.stage === 'wake') {
    const t = getP(s, d.target);
    const corvo = s.aside.splice(s.aside.findIndex((c) => c.type === 'corvo'), 1)[0];
    t.front.push(corvo);
    s.dawn = null;
    s.phase = 'day';
    log(s, `Todos abrem os olhos. O Corvo Agourento pousou diante de ${name(t)}. ${name(t)} começa.`);
    startTurn(s, t.id);
  }
}

function agreedDawn(s) {
  const votes = s.players.filter((q) => q.everWitch).map((w) => s.dawn.votes[w.id]);
  return votes.length && votes.every((v) => v && v === votes[0]) ? votes[0] : null;
}

function updateWitchKnowledge(s) {
  const coven = alivePlayers(s).filter((p) => p.everWitch).map((p) => p.id);
  for (const p of s.players) if (p.alive && p.everWitch) p.knows = coven.filter((id) => id !== p.id);
}

// ---------- compras e eventos ----------
function reshuffleDiscard(s) {
  s.deck.push(...shuffle(s, s.discard.splice(0)));
}

function drawOne(s, p) {
  for (let guard = 0; guard < 200; guard++) {
    if (!s.deck.length) {
      reshuffleDiscard(s);
      if (!s.deck.length) { log(s, 'O baralho acabou.'); return null; }
    }
    const card = s.deck.shift();
    const def = CARDS[card.type];
    if (def.color === 'black') {
      log(s, `${name(p)} comprou ${def.name}!`);
      if (card.type === 'eclipse') {
        s.discard.push(card);
        s.steps.unshift({ t: 'eclipse', drawer: p.id }, { t: 'swap' });
      } else {
        s.aside.push(card);
        s.steps.unshift({ t: 'night' });
      }
      return card;
    }
    if (def.color === 'blue' && fewAlive(s)) {
      s.aside.push(card);
      continue; // azul fora de jogo: compra outra
    }
    p.hand.push(card);
    return card;
  }
  return null;
}

function run(s, now) {
  while (!s.pending && s.phase !== 'over' && s.steps.length) {
    doStep(s, s.steps.shift(), now);
  }
}

function doStep(s, st, now) {
  switch (st.t) {
    case 'draw': {
      const p = getP(s, st.pid);
      if (!p?.alive) return;
      const c = drawOne(s, p);
      if (c && st.track && s.turn) s.turn.drawn.push(c.type);
      if (c && st.notify && CARDS[c.type].color !== 'black') log(s, `Você comprou ${cname(c.type)}.`, [p.id]);
      return;
    }
    case 'lenhador': {
      const p = getP(s, st.pid);
      if (has(s, p, 'lenhador') && s.turn?.drawn.length === 2 && s.turn.drawn.every((t) => t === 'boato')) {
        log(s, `${name(p)} mostra dois Boatos e compra mais uma carta.`);
        s.steps.unshift({ t: 'draw', pid: p.id });
      }
      return;
    }
    case 'endTurn':
      advanceTurn(s);
      return;
    case 'eclipse': {
      const holder = s.players.find((p) => p.alive && frontHas(p, 'corvo'));
      if (!holder) { log(s, 'Ninguém tem o Corvo: nada é revelado.'); return; }
      if (has(s, holder, 'costureira')) { log(s, `${name(holder)} ignora o Corvo.`); return; }
      const drawer = getP(s, st.drawer);
      const chooser = drawer?.alive ? drawer : holder;
      s.pending = { kind: 'reveal', chooser: chooser.id, target: holder.id, cause: 'eclipse' };
      log(s, `${name(chooser)} escolhe uma carta de ${name(holder)}, que tem o Corvo, para revelar.`);
      return;
    }
    case 'swap':
      startSwap(s, now);
      return;
    case 'night':
      startNight(s, now);
      return;
  }
}

// Eclipse: cada pessoa escolhe (às cegas) uma carta de equipe do vizinho seguinte.
// As escolhas são simultâneas; quem não escolher a tempo recebe uma carta aleatória.
function startSwap(s, now) {
  const pairs = [];
  for (const p of alivePlayers(s)) {
    if (!unrevealed(p).length) continue;
    const from = nextAlive(s, p.id, 1);
    if (!from || !unrevealed(from).length) continue;
    pairs.push({ to: p.id, from: from.id });
  }
  if (pairs.length < 2) return;
  s.pending = { kind: 'swap', pairs, picks: {}, deadline: now + SWAP_SECS * 1000 };
  log(s, `Eclipse: cada pessoa escolhe, às cegas, uma carta de equipe do vizinho seguinte (${SWAP_SECS} s).`);
}

function resolveSwap(s) {
  const pd = s.pending;
  const moves = [];
  let auto = 0;
  for (const { to, from } of pd.pairs) {
    const src = getP(s, from);
    let idx = pd.picks[to];
    if (idx == null || !src.trials[idx] || src.trials[idx].revealed) {
      const pool = src.trials.map((t, i) => (t.revealed ? -1 : i)).filter((i) => i >= 0);
      idx = pool[Math.floor(rand(s) * pool.length)];
      auto++;
    }
    moves.push({ to: getP(s, to), from: src, trial: src.trials[idx] });
  }
  for (const m of moves) m.from.trials = m.from.trials.filter((t) => t !== m.trial);
  for (const m of moves) {
    m.to.trials.push(m.trial);
    if (m.trial.type === 'bruxa') m.to.everWitch = true;
    log(s, `Você recebeu de ${name(m.from)} a carta ${TRIALS[m.trial.type].name}.`, [m.to.id]);
  }
  s.pending = null;
  log(s, `Eclipse: as cartas de equipe trocaram de mãos${auto ? ` (${auto} escolha(s) automática(s))` : ''}.`);
}

// ---------- turnos ----------
function startTurn(s, pid) {
  for (let guard = 0; guard < 100; guard++) {
    const p = getP(s, pid);
    if (!p) return;
    const tronco = p.front.find((c) => c.type === 'tronco');
    if (tronco) {
      p.front = p.front.filter((c) => c !== tronco);
      s.discard.push(tronco);
      log(s, `${name(p)} está no Tronco e perde a vez.`);
      const nx = nextAlive(s, p.id);
      if (!nx) return;
      pid = nx.id;
      continue;
    }
    s.turn = { pid: p.id, mode: null, drawn: [], hourglass: null };
    log(s, `Vez de ${name(p)}.`);
    return;
  }
}

function advanceTurn(s) {
  if (s.phase !== 'day') return;
  const cur = s.turn?.pid;
  const nx = cur ? nextAlive(s, cur) : alivePlayers(s)[0];
  if (nx) startTurn(s, nx.id);
}

// ---------- revelações e mortes ----------
function revealTrial(s, target, idx, cause, chooser = null) {
  const t = target.trials[idx];
  if (!t || t.revealed) fail('Essa carta já está revelada.');
  t.revealed = true;
  const how = cause === 'confess' ? 'confessou' : 'teve revelada';
  log(s, `${name(target)} ${how} uma carta: ${TRIALS[t.type].name}!`);
  if ((cause === 'accuse' || cause === 'eclipse')) {
    for (const p of alivePlayers(s)) {
      if (p !== target && has(s, p, 'parteira')) s.steps.unshift({ t: 'draw', pid: p.id, notify: true });
    }
  }
  if (t.type === 'bruxa') kill(s, target, 'uma Bruxa foi revelada');
  else if (!unrevealed(target).length) kill(s, target, 'todas as cartas foram reveladas');
  checkWin(s);
}

function kill(s, p, reason) {
  if (!p.alive) return;
  const wasCostureira = has(s, p, 'costureira');
  const hadLaco = frontHas(p, 'laco');
  p.alive = false;
  for (const t of p.trials) t.revealed = true;
  if (s.night) s.night.deaths.push({ id: p.id, reason });
  log(s, `${name(p)} morreu (${reason}). Equipe: ${p.everWitch ? 'Coven' : 'Vila'}.`);

  const toHeirs = [...p.hand, ...p.front.filter(isBlue)];
  s.discard.push(...p.front.filter((c) => !isBlue(c)));
  p.hand = []; p.front = [];
  const heirs = alivePlayers(s).filter((q) => has(s, q, 'coveiro'))
    .sort((a, b) => (a.character === 'coveiro' ? -1 : b.character === 'coveiro' ? 1 : 0));
  if (heirs.length) {
    toHeirs.forEach((c, i) => heirs[i % heirs.length].hand.push(c));
    if (toHeirs.length) log(s, `${heirs.map(name).join(' e ')} recolhe(m) ${toHeirs.length} carta(s) de ${name(p)}.`);
  } else {
    s.discard.push(...toHeirs);
  }

  if (hadLaco && !wasCostureira) {
    const partner = alivePlayers(s).find((q) => frontHas(q, 'laco'));
    if (partner && !has(s, partner, 'costureira')) kill(s, partner, 'Laço de Sangue');
  }
  if (fewAlive(s)) {
    for (const q of s.players) {
      const blues = q.front.filter(isBlue);
      if (blues.length) { q.front = q.front.filter((c) => !isBlue(c)); s.aside.push(...blues); }
    }
  }
}

function checkWin(s) {
  if (s.phase === 'over' || s.phase === 'lobby') return;
  const witchCards = s.players.flatMap((p) => p.trials).filter((t) => t.type === 'bruxa');
  let winner = null;
  if (witchCards.every((t) => t.revealed)) winner = 'vila';
  else if (alivePlayers(s).every((p) => p.everWitch)) winner = 'coven';
  if (winner) {
    s.winner = winner;
    s.phase = 'over';
    s.pending = null;
    s.steps = [];
    s.night = null;
    for (const p of s.players) for (const t of p.trials) t.revealed = true;
    log(s, winner === 'vila' ? 'A Vila venceu: todas as Bruxas foram descobertas!' : 'O Coven venceu: só restam bruxas na vila!');
  }
}

// ---------- noite ----------
// Etapas, cada uma com uma deixa sonora no aparelho do anfitrião:
// sleep (todos fecham os olhos) → witches (o coven acorda e escolhe) →
// witchesSleep (o coven fecha os olhos) → hunter (o Caçador acorda e protege) →
// hunterSleep (o Caçador fecha os olhos) → confess (todos abrem os olhos).
function startNight(s, now = Date.now()) {
  s.phase = 'night';
  const hunter = alivePlayers(s).find((p) => p.trials.some((t) => t.type === 'cacador' && !t.revealed));
  s.night = {
    stage: 'sleep', deadline: now + NIGHT_SECS.sleep * 1000, votes: {}, victim: null,
    hunter: hunter?.id ?? null, pick: null, confessed: {}, done: {}, decoy: {}, deaths: [],
  };
  s.pending = { kind: 'night' };
  updateWitchKnowledge(s);
  log(s, `Meia-Noite! Todos fecham os olhos (${NIGHT_SECS.sleep} s).`);
}

function nightWitches(s) { return alivePlayers(s).filter((p) => p.everWitch); }

function agreedVictim(s) {
  const ws = nightWitches(s);
  if (!ws.length) return null;
  const votes = ws.map((w) => s.night.votes[w.id]);
  return votes.every((v) => v && v === votes[0]) ? votes[0] : null;
}

function nightVictim(s) { return s.night.victim; }

// avança a Meia-Noite para a próxima etapa (por acordo, escolha ou fim do tempo)
function advanceNight(s, now) {
  const n = s.night;
  if (!n) return;
  if (n.stage === 'sleep') {
    if (!nightWitches(s).length) { n.stage = 'witches'; advanceNight(s, now); return; }
    n.stage = 'witches';
    n.deadline = now + NIGHT_SECS.witches * 1000;
    log(s, `O sino toca: o coven acorda e tem ${NIGHT_SECS.witches} s para escolher a vítima.`);
  } else if (n.stage === 'witches') {
    let victim = n.victim || agreedVictim(s);
    const ws = nightWitches(s);
    if (!victim && ws.length) {
      // sem acordo a tempo: sorteia entre os votos dados ou, sem votos, entre quem não é do coven
      const voted = ws.map((w) => n.votes[w.id]).filter((id) => getP(s, id)?.alive);
      const pool = voted.length ? voted : alivePlayers(s).filter((p) => !p.everWitch).map((p) => p.id);
      victim = pool.length ? pool[Math.floor(rand(s) * pool.length)] : null;
      if (victim) log(s, `O tempo acabou: o destino escolheu ${name(getP(s, victim))} como vítima.`, ws.map((w) => w.id));
    }
    n.victim = victim;
    n.stage = 'witchesSleep';
    n.deadline = now + NIGHT_SECS.witchesSleep * 1000;
    log(s, 'O sino toca de novo: o coven fecha os olhos.');
  } else if (n.stage === 'witchesSleep') {
    n.stage = 'hunter';
    const h = n.hunter && getP(s, n.hunter);
    // sem Caçador vivo a etapa dura um tempo aleatório, para ninguém perceber
    const secs = h?.alive ? NIGHT_SECS.hunter : 6 + Math.floor(rand(s) * 7);
    n.deadline = now + secs * 1000;
    log(s, 'O Caçador acorda e ergue a Lanterna.');
  } else if (n.stage === 'hunter') {
    n.stage = 'hunterSleep';
    n.deadline = now + NIGHT_SECS.hunterSleep * 1000;
    log(s, 'O Caçador fecha os olhos.');
  } else if (n.stage === 'hunterSleep') {
    n.stage = 'confess';
    n.deadline = now + s.config.confess * 1000;
    log(s, `Todos abrem os olhos: ${s.config.confess} segundos para confissões.`);
  }
}

function maybeResolveNight(s, now, force = false) {
  const n = s.night;
  if (!n || n.stage !== 'confess') return;
  const all = alivePlayers(s).every((p) => n.done[p.id]);
  if (!all && !force && now < n.deadline) return;
  resolveNight(s);
}

function resolveNight(s) {
  const n = s.night;
  const victim = getP(s, nightVictim(s));
  const reasons = [];
  if (victim && victim.alive) {
    if (n.pick === victim.id) reasons.push('Lanterna do Caçador');
    if (n.confessed[victim.id]) reasons.push('confissão');
    if (frontHas(victim, 'circulo')) reasons.push('Círculo de Sal');
    if (reasons.length) log(s, `O coven atacou ${name(victim)}, que sobreviveu (${reasons.join(', ')}).`);
    else kill(s, victim, 'atacado(a) pelo coven na Meia-Noite');
  } else {
    log(s, 'A noite passou sem vítimas.');
  }
  s.report = {
    id: s.logSeq,
    target: victim?.id ?? null,
    saved: reasons,
    protected: n.hunter && n.pick ? n.pick : null,
    confessed: Object.keys(n.confessed),
    deaths: n.deaths.slice(),
  };
  checkWin(s);
  if (s.phase === 'over') return;
  // refaz o baralho com a Meia-Noite no fundo
  const mn = s.aside.findIndex((c) => c.type === 'meianoite');
  const midnight = mn >= 0 ? s.aside.splice(mn, 1)[0] : mkCard(s, 'meianoite');
  s.deck = shuffle(s, [...s.deck, ...s.discard.splice(0)]);
  s.deck.push(midnight);
  s.cycle = s.deck.length;
  s.night = null;
  s.pending = null;
  s.phase = 'day';
  log(s, 'Amanhece. O baralho foi refeito.');
}

// ---------- ações ----------
export function applyAction(s, pid, a, now = Date.now()) {
  if (!a || typeof a.type !== 'string') fail('Ação inválida.');
  const p = mustP(s, pid);
  const handler = ACTIONS[a.type];
  if (!handler) fail('Ação desconhecida.');
  handler(s, p, a, now);
  finalize(s, now);
}

function finalize(s, now = Date.now()) {
  run(s, now);
  if (s.phase === 'day' && !s.pending && !s.steps.length && s.turn && !getP(s, s.turn.pid)?.alive) {
    advanceTurn(s);
    run(s, now);
  }
  autoTurn(s, now);
  s.seq++;
}

function drawTwo(s, p) {
  s.turn.mode = 'draw';
  s.turn.hourglass = null;
  s.steps.push({ t: 'draw', pid: p.id, track: true, notify: true }, { t: 'draw', pid: p.id, track: true, notify: true }, { t: 'lenhador', pid: p.id }, { t: 'endTurn' });
}

// Mão vazia não tem escolha: quem fica sem cartas depois de jogar encerra a
// vez, e quem começa a vez sem cartas compra 2. A exceção é quem ainda pode
// usar a Cartomante ou o Boticário, que agem antes de (ou em vez de) comprar.
function autoTurn(s, now) {
  for (let guard = 0; guard < 50; guard++) {
    if (s.phase !== 'day' || s.pending || s.steps.length || !s.turn) return;
    const p = getP(s, s.turn.pid);
    if (!p?.alive || p.hand.length) return;
    if (s.turn.mode === 'play') {
      log(s, `${name(p)} ficou sem cartas e encerra a vez.`);
      advanceTurn(s);
    } else if (!s.turn.mode) {
      const carto = has(s, p, 'cartomante') && p.uses.cartomante < 1 && s.deck.length > 0;
      const botic = has(s, p, 'boticario') && p.uses.boticario < 2 && s.discard.some((c) => CARDS[c.type].color !== 'black');
      if (carto || botic) return;
      drawTwo(s, p);
      log(s, `${name(p)} está sem cartas e compra 2.`);
      run(s, now);
    } else return;
  }
}

function requireTurn(s, p, { fresh = false } = {}) {
  if (s.phase !== 'day') fail('Agora não é hora de jogar.');
  if (s.pending || s.steps.length) fail('Aguarde a resolução atual.');
  if (s.turn?.pid !== p.id) fail('Não é a sua vez.');
  if (fresh && s.turn.mode) fail('Você já agiu nesta vez.');
}

function requireTarget(s, p, id, label = 'alvo') {
  const t = getP(s, id);
  if (!t || !t.alive) fail(`Escolha um ${label} vivo.`);
  if (t.id === p.id) fail('Você nunca pode mirar a si mesmo.');
  return t;
}

function startReveal(s, accuser, target, cause) {
  const reds = target.front.filter(isRed);
  target.front = target.front.filter((c) => !isRed(c));
  s.discard.push(...reds);
  s.pending = {
    kind: 'reveal', chooser: accuser.id, target: target.id, cause,
    taberna: cause === 'accuse' && has(s, accuser, 'taberneira'),
    juiz: cause === 'accuse' && has(s, accuser, 'juiz') && accuser.front.some(isRed),
  };
  log(s, `${name(target)} chegou ao limite de acusações! ${name(accuser)} escolhe uma carta para revelar.`);
}

function checkThreshold(s, accuser, target, accuserBonus) {
  const pts = accusationPoints(s, target);
  if (pts >= threshold(s, target, accuserBonus ? accuser : null)) startReveal(s, accuser, target, 'accuse');
}

const ACTIONS = {
  pickCharacter(s, p, a, now) {
    if (s.phase !== 'choose') fail('Não é hora de escolher morador.');
    if (!p.options.includes(a.character)) fail('Morador inválido.');
    p.character = a.character;
    if (s.players.every((q) => q.character)) dealAndDawn(s, now);
  },

  dawnVote(s, p, a, now) {
    if (s.phase !== 'dawn' || s.dawn.stage !== 'witches') fail('Não é hora de entregar o Corvo.');
    if (s.dawn.target) fail('O coven já decidiu.');
    if (!p.everWitch) return;
    const t = getP(s, a.target);
    if (!t) fail('Alvo inválido.');
    s.dawn.votes[p.id] = t.id;
    const agreed = agreedDawn(s);
    if (agreed) {
      // acordo: trava a escolha e o sino toca em alguns segundos
      s.dawn.target = agreed;
      s.dawn.deadline = Math.min(s.dawn.deadline, now + DECIDED_SECS * 1000);
    }
  },

  decoy(s, p, a) {
    // toque de despiste de quem não é do coven/caçador: sem efeito
    if (s.night) s.night.decoy[p.id] = a.target || true;
  },

  swapTrials(s, p, a) {
    if (s.phase === 'over' || s.phase === 'lobby') fail('Fora de jogo.');
    if (s.pending?.kind === 'reveal' && s.pending.target === p.id) fail('Não dá para reorganizar agora.');
    if (s.pending?.kind === 'swap') fail('Espere o Eclipse terminar para reorganizar.');
    const [i, j] = [a.i, a.j];
    const ti = p.trials[i], tj = p.trials[j];
    if (!ti || !tj || ti.revealed || tj.revealed) fail('Só cartas ocultas podem trocar de lugar.');
    p.trials[i] = tj; p.trials[j] = ti;
  },

  draw(s, p) {
    requireTurn(s, p, { fresh: true });
    drawTwo(s, p);
    log(s, `${name(p)} compra 2 cartas.`);
  },

  // várias acusações de uma vez no mesmo alvo: da mais forte para a mais fraca, parando
  // quando o alvo chega ao limite (as que sobram continuam na mão)
  accuse(s, p, a) {
    requireTurn(s, p);
    const uids = [...new Set(a.uids || [])];
    if (!uids.length) fail('Escolha ao menos uma acusação.');
    const target = requireTarget(s, p, a.target);
    const cards = uids.map((uid) => p.hand.find((c) => c.uid === uid));
    if (cards.some((c) => !c)) fail('Essa carta não está na sua mão.');
    if (cards.some((c) => !isRed(c))) fail('Só cartas de acusação podem ser jogadas juntas.');
    cards.sort((x, y) => cardValue(s, y, target) - cardValue(s, x, target));
    ACTIONS.play(s, p, { uid: cards[0].uid, targets: [target.id] });
    let used = 1;
    for (const c of cards.slice(1)) {
      if (s.pending || s.steps.length || s.phase !== 'day' || s.turn?.pid !== p.id || !target.alive) break;
      ACTIONS.play(s, p, { uid: c.uid, targets: [target.id] });
      used++;
    }
    if (used < cards.length) log(s, `${name(p)} guarda ${cards.length - used} acusação(ões): ${name(target)} já chegou ao limite.`);
  },

  play(s, p, a) {
    requireTurn(s, p);
    if (s.turn.mode === 'draw') fail('Você já comprou nesta vez.');
    const idx = p.hand.findIndex((c) => c.uid === a.uid);
    if (idx < 0) fail('Essa carta não está na sua mão.');
    const card = p.hand[idx];
    const def = CARDS[card.type];
    if (def.color === 'blue' && fewAlive(s)) fail('Com só 2 pessoas vivas, cartas azuis não são usadas.');
    const targets = a.targets || [];
    let t1, t2;
    if (def.targets >= 1) t1 = requireTarget(s, p, targets[0]);
    if (def.targets === 2) {
      t2 = requireTarget(s, p, targets[1], 'segundo alvo');
      if (t1 === t2) fail('Escolha duas pessoas diferentes.');
    }
    if (def.color === 'red' && frontHas(t1, 'amuleto')) fail(`${name(t1)} está protegido(a) pelo Amuleto.`);
    if (card.type === 'quebranto' && !t1.front.some((c) => isBlue(c) && (!a.blue || c.uid === a.blue))) fail('Esse alvo não tem carta azul.');

    p.hand.splice(idx, 1);
    s.turn.mode = 'play';
    s.turn.hourglass = null;
    const tag = `${name(p)} jogou ${def.name}`;

    if (def.color === 'red') {
      if (card.type === 'boato' && has(s, p, 'prefeito')) card.val = 2;
      card.by = p.id;
      t1.front.push(card);
      log(s, `${tag} em ${name(t1)} (${accusationPoints(s, t1)}/${threshold(s, t1)} pts).`);
      checkThreshold(s, p, t1, true);
      return;
    }
    if (def.color === 'blue') {
      if (card.type === 'laco' && frontHas(t1, 'laco')) {
        const other = t1.front.find((c) => c.type === 'laco');
        t1.front = t1.front.filter((c) => c !== other);
        s.discard.push(card, other);
        log(s, `${tag} em ${name(t1)}, que já tinha um Laço: os dois se anulam.`);
        return;
      }
      t1.front.push(card);
      log(s, `${tag} diante de ${name(t1)}.`);
      return;
    }
    // verdes
    switch (card.type) {
      case 'fogueira':
        if (has(s, t1, 'viuva')) log(s, `${tag} em ${name(t1)}, mas a Viúva é imune.`);
        else { s.discard.push(...t1.hand.splice(0)); log(s, `${tag}: ${name(t1)} descarta a mão inteira.`); }
        break;
      case 'quebranto': {
        const blue = t1.front.find((c) => isBlue(c) && (!a.blue || c.uid === a.blue));
        t1.front = t1.front.filter((c) => c !== blue);
        s.discard.push(blue);
        log(s, `${tag}: ${cname(blue.type)} de ${name(t1)} foi descartado.`);
        break;
      }
      case 'maoleve':
        if (has(s, t1, 'viuva')) log(s, `${tag} em ${name(t1)}, mas a Viúva é imune.`);
        else { const k = t1.hand.length; t2.hand.push(...t1.hand.splice(0)); log(s, `${tag}: as ${k} cartas de ${name(t1)} vão para ${name(t2)}.`); }
        break;
      case 'espantalho': {
        const moved = t1.front.splice(0);
        t2.front.push(...moved);
        const lacos = t2.front.filter((c) => c.type === 'laco');
        if (lacos.length >= 2) {
          t2.front = t2.front.filter((c) => c.type !== 'laco');
          s.discard.push(...lacos);
        }
        log(s, `${tag}: ${moved.length} carta(s) de ${name(t1)} vão para ${name(t2)}.`);
        s.discard.push(card);
        checkThreshold(s, p, t2, false);
        return;
      }
      case 'aguabenta': {
        const reds = t1.front.filter(isRed).sort((x, y) => cardValue(s, y, t1) - cardValue(s, x, t1));
        let budget = 3; const removed = [];
        for (const c of reds) { const v = cardValue(s, c, t1); if (v <= budget) { budget -= v; removed.push(c); } }
        t1.front = t1.front.filter((c) => !removed.includes(c));
        s.discard.push(...removed);
        log(s, `${tag} em ${name(t1)}: ${3 - budget} ponto(s) removido(s).`);
        break;
      }
      case 'tronco':
        t1.front.push(card);
        log(s, `${tag}: ${name(t1)} vai perder a próxima vez.`);
        return;
    }
    s.discard.push(card);
  },

  endTurn(s, p) {
    requireTurn(s, p);
    if (s.turn.mode !== 'play') fail('Jogue ao menos uma carta ou compre 2.');
    advanceTurn(s);
  },

  boticario(s, p, a) {
    requireTurn(s, p, { fresh: true });
    if (!has(s, p, 'boticario')) fail('Você não tem essa habilidade.');
    if (p.uses.boticario >= 2) fail('Habilidade já usada duas vezes.');
    const uids = (a.uids || []).slice(0, 2);
    if (!uids.length) fail('Escolha até 2 cartas do descarte.');
    const picks = uids.map((u) => s.discard.find((c) => c.uid === u));
    if (picks.some((c) => !c || CARDS[c.type].color === 'black')) fail('Carta inválida no descarte.');
    s.discard = s.discard.filter((c) => !picks.includes(c));
    p.hand.push(...picks);
    p.uses.boticario++;
    log(s, `${name(p)} pegou ${picks.length} carta(s) do descarte: ${picks.map((c) => cname(c.type)).join(', ')}.`);
    advanceTurn(s);
  },

  cartomante(s, p) {
    requireTurn(s, p, { fresh: true });
    if (!has(s, p, 'cartomante')) fail('Você não tem essa habilidade.');
    if (p.uses.cartomante >= 1) fail('Habilidade já usada.');
    const top = [];
    for (const c of s.deck) { if (top.length >= 5) break; if (c.type !== 'meianoite') top.push(c.uid); else break; }
    p.uses.cartomante++;
    s.pending = { kind: 'cartomante', pid: p.id, cards: top };
    log(s, `${name(p)} consulta as cartas do topo do baralho.`);
  },

  cartomanteOrder(s, p, a) {
    const pd = s.pending;
    if (pd?.kind !== 'cartomante' || pd.pid !== p.id) fail('Nada para ordenar.');
    const order = a.order || pd.cards;
    if (order.length !== pd.cards.length || ![...order].sort().every((u, i) => u === [...pd.cards].sort()[i])) fail('Ordem inválida.');
    const cards = order.map((u) => s.deck.find((c) => c.uid === u));
    s.deck = [...cards, ...s.deck.filter((c) => !pd.cards.includes(c.uid))];
    s.pending = null;
  },

  reveal(s, p, a) {
    const pd = s.pending;
    if (pd?.kind !== 'reveal' || pd.chooser !== p.id) fail('Você não está escolhendo uma revelação.');
    const target = getP(s, pd.target);
    const idx = a.index;
    if (!target.trials[idx] || target.trials[idx].revealed) fail('Escolha uma carta oculta.');
    s.pending = null;
    if (pd.juiz && a.juiz) {
      const reds = p.front.filter(isRed);
      p.front = p.front.filter((c) => !isRed(c));
      s.discard.push(...reds);
      log(s, `${name(p)} usa o Juiz e descarta as acusações diante de si.`);
    }
    if (pd.taberna && a.taberna) {
      s.steps.unshift({ t: 'draw', pid: p.id, notify: true }, { t: 'draw', pid: p.id, notify: true });
      log(s, `${name(p)} usa a Taberneira e compra 2 cartas.`);
    }
    revealTrial(s, target, idx, pd.cause, p);
  },

  hourglass(s, p, a, now) {
    if (s.phase !== 'day' || !s.turn || s.pending) fail('Agora não dá para virar a ampulheta.');
    if (s.turn.pid === p.id) fail('Você não pode virar a ampulheta na sua própria vez.');
    if (!p.alive) fail('Só quem está vivo pode virar a ampulheta.');
    if (s.turn.hourglass) fail('A ampulheta já está correndo.');
    s.turn.hourglass = now + s.config.hourglass * 1000;
    log(s, `${name(p)} virou a ampulheta para ${name(getP(s, s.turn.pid))}.`);
  },

  nightVote(s, p, a, now) {
    const n = s.night;
    if (!n || n.stage !== 'witches') fail('Não é hora disso.');
    if (n.victim) fail('O coven já decidiu.');
    if (!p.alive || !p.everWitch) return;
    const t = getP(s, a.target);
    if (!t?.alive) fail('Escolha alguém vivo.');
    n.votes[p.id] = t.id;
    const agreed = agreedVictim(s);
    if (agreed) {
      // acordo: trava a escolha e o sino toca em alguns segundos
      n.victim = agreed;
      n.deadline = Math.min(n.deadline, now + DECIDED_SECS * 1000);
    }
  },

  hunterPick(s, p, a, now) {
    const n = s.night;
    if (!n || n.stage !== 'hunter' || n.hunter !== p.id) fail('Não é hora disso.');
    if (n.pick) fail('Você já ergueu a Lanterna.');
    const t = requireTarget(s, p, a.target, 'protegido');
    n.pick = t.id;
    log(s, `Você ergueu a Lanterna para ${name(t)}.`, [p.id]);
    // trava a escolha e dá alguns segundos antes da próxima deixa
    n.deadline = Math.min(n.deadline, now + DECIDED_SECS * 1000);
  },

  confess(s, p, a, now) {
    const n = s.night;
    if (!n || n.stage !== 'confess' || !p.alive || n.done[p.id]) fail('Não dá para confessar agora.');
    if (a.sacristao) {
      if (!has(s, p, 'sacristao') || p.uses.sacristao >= 1) fail('Você não pode usar o Sacristão.');
      p.uses.sacristao++;
      n.confessed[p.id] = true;
      n.done[p.id] = true;
      log(s, `${name(p)} confessou sem revelar nada (Sacristão).`);
    } else {
      n.confessed[p.id] = true;
      n.done[p.id] = true;
      revealTrial(s, p, a.index, 'confess');
      if (s.phase === 'over') return;
    }
    maybeResolveNight(s, now);
  },

  swapPick(s, p, a) {
    const pd = s.pending;
    if (pd?.kind !== 'swap') fail('Não há Eclipse em andamento.');
    const pair = pd.pairs.find((x) => x.to === p.id);
    if (!pair) fail('Você não pega carta neste Eclipse.');
    if (pd.picks[p.id] != null) fail('Você já escolheu.');
    const t = getP(s, pair.from).trials[a.index];
    if (!t || t.revealed) fail('Escolha uma carta virada para baixo.');
    pd.picks[p.id] = a.index;
    if (pd.pairs.every((x) => pd.picks[x.to] != null)) resolveSwap(s);
  },

  pass(s, p, a, now) {
    const n = s.night;
    if (!n || n.stage !== 'confess' || !p.alive) fail('Não é hora disso.');
    n.done[p.id] = true;
    maybeResolveNight(s, now);
  },
};

// ---------- controles do moderador e tempo ----------
export function moderatorAction(s, a, now = Date.now()) {
  switch (a.type) {
    case 'skipTurn':
      if (s.phase !== 'day' || s.pending || s.steps.length) fail('Não há vez para pular agora.');
      log(s, 'O moderador encerrou a vez.');
      advanceTurn(s);
      break;
    case 'stopHourglass':
      if (s.turn) s.turn.hourglass = null;
      break;
    case 'endNightTimer':
      if (s.night?.stage === 'confess') { maybeResolveNight(s, now, true); }
      else if (s.night) advanceNight(s, now);
      else if (s.dawn) advanceDawn(s, now);
      else if (s.pending?.kind === 'swap') resolveSwap(s);
      else fail('Não há contagem em andamento.');
      break;
    default:
      fail('Ação desconhecida.');
  }
  finalize(s, now);
}

// Chamado periodicamente pelo anfitrião. Retorna true se o estado mudou.
export function tick(s, now = Date.now()) {
  if (s.phase === 'day' && s.turn?.hourglass && now >= s.turn.hourglass && !s.pending && !s.steps.length) {
    const p = getP(s, s.turn.pid);
    s.turn.hourglass = null;
    if (s.turn.mode === 'play') {
      log(s, `O tempo de ${name(p)} acabou.`);
      advanceTurn(s);
    } else {
      log(s, `O tempo de ${name(p)} acabou: compra 2 cartas.`);
      s.turn.mode = 'draw';
      s.steps.push({ t: 'draw', pid: p.id, track: true, notify: true }, { t: 'draw', pid: p.id, track: true, notify: true }, { t: 'lenhador', pid: p.id }, { t: 'endTurn' });
    }
    finalize(s, now);
    return true;
  }
  if (s.phase === 'dawn' && s.dawn && now >= s.dawn.deadline) {
    advanceDawn(s, now);
    finalize(s, now);
    return true;
  }
  if (s.night && s.night.stage !== 'confess' && now >= s.night.deadline) {
    advanceNight(s, now);
    finalize(s, now);
    return true;
  }
  if (s.night?.stage === 'confess' && now >= s.night.deadline) {
    maybeResolveNight(s, now, true);
    finalize(s, now);
    return true;
  }
  if (s.pending?.kind === 'swap' && now >= s.pending.deadline) {
    resolveSwap(s);
    finalize(s, now);
    return true;
  }
  return false;
}
