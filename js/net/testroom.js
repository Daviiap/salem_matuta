// Modo de teste local: a sala inteira roda nesta aba, sem broker e sem
// criptografia. Você "veste" qualquer jogador (ou o moderador) e bots jogam
// pelos demais. Serve para testar a interface sem juntar 4 celulares.
import * as G from '../engine/game.js';
import { viewFor } from '../engine/view.js';
import { CARDS } from '../engine/cards.js';
import { HostRoom } from './room.js';

const NAMES = ['Ana', 'Bento', 'Caio', 'Dora', 'Elias', 'Flora', 'Gil', 'Iara', 'Juca', 'Lia', 'Mara'];
const REDS = ['boato', 'indicio', 'flagrante'];
const pickRand = (a) => a[Math.floor(Math.random() * a.length)];
let nextId = 0;
const newId = () => `t${Date.now().toString(36)}${nextId++}`;

export class TestRoom extends HostRoom {
  static create({ players = 5, myName = 'Você' } = {}) {
    const state = G.createGame({});
    const me = newId();
    G.addPlayer(state, me, myName);
    const room = new TestRoom({ code: 'TESTE', keys: null, state, localPid: me, peers: {} });
    for (let i = 1; i < players; i++) room.addBot();
    return room;
  }

  constructor(d) {
    super(d);
    this.test = true;
    this.bots = true; // bots jogam por todos menos por quem você está vendo
    this.speed = 900;
  }

  // sem persistência nem rede
  save() {}
  announce() {}
  broadcast() {}
  broadcastIfOnlineChanged() {}
  async sendTo(pid, obj) { if (obj.err) console.info(`[teste] ${G.getP(this.state, pid)?.name}: ${obj.err}`); }
  isOnline() { return true; }

  start() {
    this.emit('status', 'connected');
    this.ticker = setInterval(() => { if (G.tick(this.state, Date.now())) this.changed(); }, 400);
    this.restartBots();
    this.emitLocal();
  }

  stop() { clearInterval(this.ticker); clearInterval(this.botTimer); }

  restartBots() {
    clearInterval(this.botTimer);
    this.botTimer = setInterval(() => { if (this.bots) this.botStep(); }, this.speed);
  }

  setSpeed(ms) { this.speed = ms; this.restartBots(); this.emitLocal(); }
  setBots(on) { this.bots = on; this.emitLocal(); }

  addBot() {
    const used = new Set(this.state.players.map((p) => p.name));
    const nm = NAMES.find((x) => !used.has(x)) || `Bot ${this.state.players.length}`;
    this.hostOp(() => G.addPlayer(this.state, newId(), nm));
  }

  removeBot() {
    const last = [...this.state.players].reverse().find((p) => p.id !== this.localPid);
    if (last) this.hostOp(() => G.removePlayer(this.state, last.id));
  }

  // troca de perspectiva: pid = jogador, null = moderador (vê tudo)
  viewAs(pid) {
    this.localPid = pid || null;
    this.moderator = !pid;
    this.emitLocal();
  }

  emitLocal() {
    const v = this.moderator ? viewFor(this.state, null, { all: true }) : viewFor(this.state, this.localPid);
    v.isHost = true;
    v.test = { bots: this.bots, speed: this.speed, viewing: this.localPid, deck: this.state.deck.length };
    this.emit('view', this.decorate(v), Date.now());
  }

  // ---- atalhos de teste ----
  cheat(fn) { this.hostOp(() => { fn(this.state); this.state.seq++; }); }

  // coloca uma carta preta no topo do baralho: a próxima compra a dispara
  blackOnTop(type) {
    this.cheat((s) => {
      let i = s.deck.findIndex((c) => c.type === type);
      if (i >= 0) { s.deck.unshift(s.deck.splice(i, 1)[0]); return; }
      for (const pile of [s.discard, s.aside]) {
        i = pile.findIndex((c) => c.type === type);
        if (i >= 0) { s.deck.unshift(pile.splice(i, 1)[0]); return; }
      }
      throw new G.GameError(`${CARDS[type].name} não está disponível.`);
    });
  }

  // dá uma carta à mão de quem você está vendo (do baralho, do descarte ou, em último caso, da mão de outra pessoa)
  giveCard(type) {
    const p = G.getP(this.state, this.localPid);
    if (!p) { this.emit('error', 'Escolha um jogador para receber a carta.'); return; }
    this.cheat((s) => {
      for (const pile of [s.deck, s.discard, ...s.players.filter((q) => q !== p).map((q) => q.hand)]) {
        const i = pile.findIndex((c) => c.type === type);
        if (i >= 0) { p.hand.push(pile.splice(i, 1)[0]); G.log(s, `[teste] ${p.name} recebeu ${CARDS[type].name}.`); return; }
      }
      throw new G.GameError(`Não há ${CARDS[type].name} disponível (pode estar na mesa).`);
    });
  }

  // ---- bots ----
  botStep() {
    if (this.state.phase === 'lobby' || this.state.phase === 'over') return;
    for (const p of this.state.players) {
      if (p.id === this.localPid) continue;
      for (const a of this.botActions(p.id)) {
        if (this.tryAct(p.id, a)) return; // uma ação por passo, para dar para acompanhar
      }
    }
  }

  tryAct(pid, a) {
    const snap = JSON.stringify(this.state);
    try {
      G.applyAction(this.state, pid, a, Date.now());
    } catch (e) {
      this.state = JSON.parse(snap);
      if (!(e instanceof G.GameError)) console.error(e);
      return false;
    }
    this.pushUndo(snap);
    this.changed();
    return true;
  }

  // ações candidatas, em ordem de preferência; a primeira válida é usada
  botActions(pid) {
    const v = viewFor(this.state, pid);
    const me = v.players.find((p) => p.id === pid);
    const coven = new Set(v.coven || []);
    const others = v.players.filter((p) => p.alive && p.id !== pid);
    const enemies = others.filter((p) => !(me.everWitch && coven.has(p.id)));
    const hidden = (p) => p.trials.map((t, i) => (t.revealed ? -1 : i)).filter((i) => i >= 0);
    const pd = v.pending;

    if (v.phase === 'choose') return me.character ? [] : [{ type: 'pickCharacter', character: pickRand(me.options) }];
    if (v.phase === 'dawn') {
      if (!me.everWitch || v.dawn?.stage !== 'witches' || v.dawn?.target || v.dawn?.votes?.[pid]) return [];
      // segue o voto de outra bruxa, se houver, para o coven entrar em acordo
      const prev = Object.values(v.dawn?.votes || {})[0];
      return [{ type: 'dawnVote', target: prev || pickRand(enemies.length ? enemies : others).id }];
    }
    if (pd?.kind === 'reveal') {
      if (pd.chooser !== pid) return [];
      const t = v.players.find((p) => p.id === pd.target);
      let idx = hidden(t);
      if (t.id === pid) { const safe = idx.filter((i) => me.trials[i].type !== 'bruxa'); if (safe.length) idx = safe; }
      return [{ type: 'reveal', index: pickRand(idx), taberna: true, juiz: true }];
    }
    if (pd?.kind === 'swap') {
      const pair = v.pending.from;
      if (!pair || v.pending.pick != null) return [];
      return [{ type: 'swapPick', index: pickRand(hidden(v.players.find((p) => p.id === pair))) }];
    }
    if (pd?.kind === 'cartomante') return pd.pid === pid ? [{ type: 'cartomanteOrder', order: pd.cards.map((c) => c.uid) }] : [];

    if (v.phase === 'night' && v.night && me.alive) {
      const n = v.night;
      const out = [];
      if (n.stage === 'witches' && (n.role === 'witch' || n.role === 'both') && !n.victim && !n.votes?.[pid]) {
        const prev = Object.values(n.votes || {})[0];
        out.push({ type: 'nightVote', target: prev || pickRand(enemies).id });
      }
      if (n.stage === 'hunter' && (n.role === 'hunter' || n.role === 'both') && !n.pick) out.push({ type: 'hunterPick', target: pickRand(others).id });
      if (n.stage === 'confess' && !n.done[pid]) {
        // às vezes confessa uma carta inocente, para exercitar essa tela
        const safe = hidden(me).filter((i) => me.trials[i].type !== 'bruxa');
        if (safe.length && Math.random() < 0.3) out.push({ type: 'confess', index: pickRand(safe) });
        out.push({ type: 'pass' });
      }
      return out;
    }

    if (v.phase === 'day' && v.turn?.pid === pid && !pd && !v.busy && me.alive) {
      if (v.turn.mode === 'play') return [{ type: 'endTurn' }];
      if (v.turn.mode) return [];
      const out = [];
      const targets = enemies.filter((p) => !p.front.some((c) => c.type === 'amuleto'))
        .sort((a, b) => b.points / b.threshold - a.points / a.threshold);
      for (const c of me.hand) {
        const d = CARDS[c.type];
        if (REDS.includes(c.type) && targets[0]) out.push({ type: 'play', uid: c.uid, targets: [targets[0].id] });
        else if (d.color === 'green' && Math.random() < 0.3 && enemies.length) {
          const t = pickRand(enemies);
          const t2 = others.find((p) => p.id !== t.id);
          out.push({ type: 'play', uid: c.uid, targets: d.targets === 2 && t2 ? [t.id, t2.id] : [t.id] });
        }
      }
      out.push({ type: 'draw' });
      return out;
    }
    return [];
  }
}
