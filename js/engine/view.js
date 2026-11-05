// Projeções do estado: o que cada pessoa pode ver.
import { getP, accusationPoints, threshold, copiedAbility, has } from './game.js';

// viewer: id do jogador; null + all=true para moderador
export function viewFor(s, viewer, { all = false } = {}) {
  const me = viewer ? getP(s, viewer) : null;
  const over = s.phase === 'over';
  const seeAll = all || over;

  const players = s.players.map((p) => {
    const self = p.id === viewer;
    return {
      id: p.id,
      name: p.name,
      character: p.character,
      copied: copiedAbility(s, p),
      options: self || all ? p.options : undefined,
      alive: p.alive,
      handCount: p.hand.length,
      hand: self || all ? p.hand.map(({ uid, type }) => ({ uid, type })) : undefined,
      front: p.front.map(({ uid, type, val }) => ({ uid, type, val })),
      trials: p.trials.map((t) => ({
        uid: t.revealed || all ? t.uid : undefined, // só cartas reveladas têm id (evita rastrear as ocultas)
        revealed: t.revealed,
        type: t.revealed || self || seeAll ? t.type : null,
      })),
      points: accusationPoints(s, p),
      threshold: threshold(s, p),
      everWitch: seeAll || (self && p.everWitch) || (me?.knows.includes(p.id) && me.everWitch) ? p.everWitch : undefined,
      uses: self || all ? p.uses : undefined,
    };
  });

  const v = {
    phase: s.phase,
    seq: s.seq,
    round: s.round,
    config: s.config,
    winner: s.winner,
    me: viewer,
    moderator: all,
    players,
    deckCount: s.deck.length,
    // 0 = começo do dia, 1 = Meia-Noite (a Meia-Noite é sempre a última carta do baralho)
    dusk: s.phase === 'night' ? 1 : s.phase === 'day' && s.cycle > 1 ? Math.min(1, Math.max(0, 1 - (s.deck.length - 1) / (s.cycle - 1))) : 0,
    report: s.report,
    discard: s.discard.map(({ uid, type }) => ({ uid, type })),
    turn: s.turn ? { pid: s.turn.pid, mode: s.turn.mode, hourglass: s.turn.hourglass } : null,
    busy: s.steps.length > 0,
    pending: null,
    night: null,
    dawn: null,
    coven: me?.everWitch ? me.knows : (all ? s.players.filter((p) => p.everWitch).map((p) => p.id) : undefined),
    log: s.log.filter((e) => !e.to || all || e.to.includes(viewer)).slice(-80)
      .map((e) => (all && e.to ? { ...e, text: `[${e.to.map((id) => getP(s, id)?.name).join(', ')}] ${e.text}` } : e)),
  };

  const pd = s.pending;
  if (pd?.kind === 'reveal') {
    v.pending = { kind: 'reveal', chooser: pd.chooser, target: pd.target, cause: pd.cause, taberna: pd.taberna, juiz: pd.juiz };
  } else if (pd?.kind === 'cartomante') {
    v.pending = { kind: 'cartomante', pid: pd.pid };
    if (pd.pid === viewer || all) {
      v.pending.cards = pd.cards.map((u) => s.deck.find((c) => c.uid === u)).map(({ uid, type }) => ({ uid, type }));
    }
  } else if (pd?.kind === 'swap') {
    const pair = pd.pairs.find((x) => x.to === viewer);
    v.pending = {
      kind: 'swap', deadline: pd.deadline,
      from: pair?.from ?? null,
      pick: viewer ? pd.picks[viewer] ?? null : null,
      waiting: pd.pairs.filter((x) => pd.picks[x.to] == null).map((x) => x.to),
    };
    if (all) v.pending.pairs = pd.pairs.map((x) => ({ ...x, pick: pd.picks[x.to] ?? null }));
  }

  if (s.dawn) {
    v.dawn = { stage: s.dawn.stage, deadline: s.dawn.deadline };
    if (me?.everWitch || all) { v.dawn.votes = s.dawn.votes; v.dawn.target = s.dawn.target; }
  }

  const n = s.night;
  if (n) {
    v.night = { stage: n.stage, deadline: n.deadline, done: n.done, confessed: n.confessed };
    const witch = me?.alive && me.everWitch;
    const hunter = me && n.hunter === me.id;
    v.night.role = witch ? 'witch' : hunter ? 'hunter' : 'none';
    if (hunter && witch) v.night.role = 'both';
    if (witch || all) { v.night.votes = n.votes; v.night.victim = n.victim; }
    if (hunter || all) v.night.pick = n.pick;
    if (all) { v.night.hunter = n.hunter; }
    // quem a Lanterna protegeu fica sabendo quando todos abrem os olhos (e não precisa confessar)
    if (me && n.stage === 'confess' && n.pick === me.id) v.night.lantern = true;
    v.night.canSacristao = me ? has(s, me, 'sacristao') && me.uses.sacristao < 1 : false;
  }
  return v;
}
