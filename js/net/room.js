// Salas: o anfitrião (HostRoom) roda o motor e o cliente (ClientRoom) envia intenções.
// Tópicos: saba-v1/<CODIGO>/room (anúncio, retained), /in (jogadores → anfitrião),
//          /p/<pid> (anfitrião → jogador, cifrado, retained).
import { MqttClient } from './mqtt.js';
import { generateKeys, deriveShared, seal, open, sameKey, pubOnly } from './crypto.js';
import * as G from '../engine/game.js';
import { viewFor } from '../engine/view.js';

export const DEFAULT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
export const BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081',
];
const NS = 'saba-v1';
const HEARTBEAT = 15000;
const OFFLINE_AFTER = 45000;

export function brokerUrl() { return localStorage.getItem('saba-broker') || DEFAULT_BROKER; }
export function setBrokerUrl(u) { localStorage.setItem('saba-broker', u); }

const profile = () => new URLSearchParams(location.search).get('perfil') || '';
const idKey = (code) => `saba-id${profile()}-${code}`;
const hostKey = (code) => `saba-host${profile()}-${code}`;

export function randomCode() {
  const L = 'BCDFGHJKLMNPQRSTVWXZ';
  const r = crypto.getRandomValues(new Uint8Array(4));
  return [...r].map((x) => L[x % L.length]).join('');
}
const randomId = () => 'p' + [...crypto.getRandomValues(new Uint8Array(6))].map((x) => x.toString(16).padStart(2, '0')).join('');

class Emitter {
  constructor() { this.h = {}; }
  on(ev, fn) { (this.h[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { for (const fn of this.h[ev] || []) { try { fn(...a); } catch (e) { console.error(e); } } }
}

export function hostedRooms() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const prefix = `saba-host${profile()}-`;
    if (k.startsWith(prefix) && /^[A-Z]{4}$/.test(k.slice(prefix.length))) {
      try {
        const d = JSON.parse(localStorage.getItem(k));
        out.push({ code: d.code, phase: d.state.phase, players: d.state.players.length, savedAt: d.savedAt });
      } catch { /* ignore */ }
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}
export function forgetRoom(code) { localStorage.removeItem(hostKey(code)); }

// ================= anfitrião =================
export class HostRoom extends Emitter {
  static async create({ moderator, hostName, config }) {
    const code = randomCode();
    const keys = await generateKeys();
    const state = G.createGame({ ...config, moderator });
    const localPid = moderator ? null : randomId();
    if (!moderator) G.addPlayer(state, localPid, hostName);
    const room = new HostRoom({ code, keys, state, localPid, peers: {} });
    room.save();
    return room;
  }

  static resume(code) {
    const raw = localStorage.getItem(hostKey(code));
    if (!raw) return null;
    const d = JSON.parse(raw);
    return new HostRoom(d);
  }

  constructor({ code, keys, state, localPid, peers }) {
    super();
    this.code = code;
    this.keys = keys;
    this.state = state;
    this.localPid = localPid;
    this.isHost = true;
    this.moderator = !localPid;
    this.peers = {}; // pid -> { key(jwk), name, shared(CryptoKey), lastJson, seen }
    for (const [pid, p] of Object.entries(peers || {})) this.peers[pid] = { key: p.key, name: p.name, seen: 0 };
    this.undoStack = [];
    this.chain = Promise.resolve();
    this.base = `${NS}/${code}`;
  }

  save() {
    const peers = {};
    for (const [pid, p] of Object.entries(this.peers)) peers[pid] = { key: p.key, name: p.name };
    localStorage.setItem(hostKey(this.code), JSON.stringify({
      code: this.code, keys: this.keys, state: this.state, localPid: this.localPid, peers, savedAt: Date.now(),
    }));
  }

  start() {
    this.mqtt = new MqttClient(brokerUrl());
    this.mqtt.on('status', (st, msg) => {
      this.emit('status', st, msg);
      if (st === 'connected') { this.announce(); this.broadcast(true); }
    });
    this.mqtt.on('message', (topic, payload) => {
      if (topic !== `${this.base}/in`) return;
      this.chain = this.chain.then(() => this.onIn(payload)).catch((e) => console.warn(e));
    });
    this.mqtt.subscribe(`${this.base}/in`);
    this.mqtt.connect();
    this.hb = setInterval(() => { this.announce(); this.broadcastIfOnlineChanged(); }, HEARTBEAT);
    this.ticker = setInterval(() => {
      if (G.tick(this.state, Date.now())) this.changed();
    }, 400);
    this.emitLocal();
  }

  stop() {
    clearInterval(this.hb); clearInterval(this.ticker);
    this.mqtt?.close();
  }

  announce() {
    this.mqtt.publish(`${this.base}/room`, JSON.stringify({
      v: 1, hostKey: this.keys.pub, t: Date.now(), phase: this.state.phase,
    }), { retain: true });
  }

  async sharedFor(pid) {
    const p = this.peers[pid];
    if (!p) return null;
    if (!p.shared) p.shared = await deriveShared(this.keys.priv, p.key);
    return p.shared;
  }

  async onIn(payload) {
    let msg;
    try { msg = JSON.parse(payload); } catch { return; }
    const pid = msg.pid;
    if (typeof pid !== 'string' || pid === this.localPid) return;

    if (msg.t === 'hello') {
      const known = this.peers[pid];
      if (known && !sameKey(known.key, msg.key)) return; // outra chave tentando usar o mesmo id
      if (!known) this.peers[pid] = { key: pubOnly(msg.key), name: String(msg.name || '').slice(0, 20) || 'Sem nome', seen: Date.now() };
      const peer = this.peers[pid];
      const wasOffline = !this.isOnline(pid);
      peer.seen = Date.now();
      if (this.state.phase === 'lobby' && !G.getP(this.state, pid)) {
        try { G.addPlayer(this.state, pid, peer.name); } catch (e) { await this.sendTo(pid, { err: e.message }); }
        this.changed();
      } else {
        peer.lastJson = null; // força reenvio
        await this.sendView(pid);
        if (wasOffline) this.broadcast();
      }
      return;
    }

    if (msg.t === 'act') {
      const key = await this.sharedFor(pid);
      if (!key) return;
      let action;
      try { action = await open(key, msg); } catch { return; }
      this.peers[pid].seen = Date.now();
      this.apply(pid, action);
    }
  }

  isOnline(pid) {
    if (pid === this.localPid) return true;
    const p = this.peers[pid];
    return !!p && Date.now() - p.seen < OFFLINE_AFTER;
  }

  apply(pid, action) {
    if (!G.getP(this.state, pid)) { this.sendTo(pid, { err: 'Você está só assistindo.' }); return; }
    const snap = JSON.stringify(this.state);
    try {
      G.applyAction(this.state, pid, action, Date.now());
    } catch (e) {
      if (e instanceof G.GameError) {
        if (pid === this.localPid) this.emit('error', e.message); else this.sendTo(pid, { err: e.message });
        return;
      }
      console.error(e);
      this.state = JSON.parse(snap);
      const msg = 'Erro interno: ' + e.message;
      if (pid === this.localPid) this.emit('error', msg); else this.sendTo(pid, { err: msg });
      return;
    }
    this.pushUndo(snap);
    this.changed();
  }

  pushUndo(snap) {
    this.undoStack.push(snap);
    if (this.undoStack.length > 40) this.undoStack.shift();
  }

  // ---- interface comum com ClientRoom ----
  act(action) { this.apply(this.localPid, action); }

  // ---- controles do anfitrião ----
  hostOp(fn) {
    const snap = JSON.stringify(this.state);
    try { fn(); } catch (e) {
      if (e instanceof G.GameError) { this.emit('error', e.message); return; }
      throw e;
    }
    this.pushUndo(snap);
    this.changed();
  }
  setConfig(cfg) { this.hostOp(() => { Object.assign(this.state.config, cfg); this.state.seq++; }); }
  move(pid, dir) { this.hostOp(() => G.movePlayer(this.state, pid, dir)); }
  kick(pid) {
    this.hostOp(() => G.removePlayer(this.state, pid));
    this.sendTo(pid, { kicked: true });
    delete this.peers[pid];
    this.save();
  }
  startGame() { this.hostOp(() => G.startGame(this.state)); }
  backToLobby() {
    this.hostOp(() => {
      Object.assign(this.state, { phase: 'lobby', turn: null, pending: null, night: null, dawn: null, steps: [] });
      this.state.seq++;
    });
  }
  mod(action) { this.hostOp(() => G.moderatorAction(this.state, action, Date.now())); }
  undo() {
    const snap = this.undoStack.pop();
    if (!snap) { this.emit('error', 'Nada para desfazer.'); return; }
    this.state = JSON.parse(snap);
    G.log(this.state, 'O moderador desfez a última ação.');
    this.state.seq++;
    this.changed();
  }

  // ---- envio ----
  changed() {
    this.save();
    this.emitLocal();
    this.broadcast();
  }

  decorate(v) {
    v.now = Date.now();
    v.code = this.code;
    v.online = Object.fromEntries(this.state.players.map((p) => [p.id, this.isOnline(p.id)]));
    return v;
  }

  emitLocal() {
    const v = this.moderator ? viewFor(this.state, null, { all: true }) : viewFor(this.state, this.localPid);
    v.isHost = true;
    this.emit('view', this.decorate(v), Date.now());
  }

  broadcastIfOnlineChanged() {
    const sig = this.state.players.map((p) => this.isOnline(p.id) ? 1 : 0).join('');
    if (sig !== this.onlineSig) { this.onlineSig = sig; this.broadcast(); this.emitLocal(); }
  }

  broadcast(force = false) {
    for (const pid of Object.keys(this.peers)) {
      if (force) this.peers[pid].lastJson = null;
      this.chain = this.chain.then(() => this.sendView(pid)).catch((e) => console.warn(e));
    }
  }

  async sendView(pid) {
    const peer = this.peers[pid];
    if (!peer || !this.mqtt?.connected) return;
    const v = viewFor(this.state, G.getP(this.state, pid) ? pid : null);
    const json = JSON.stringify(v) + JSON.stringify(this.state.players.map((p) => this.isOnline(p.id)));
    if (json === peer.lastJson) return;
    peer.lastJson = json;
    await this.sendTo(pid, { view: this.decorate(v) }, true);
  }

  async sendTo(pid, obj, retain = false) {
    const key = await this.sharedFor(pid);
    if (!key) return;
    const box = await seal(key, obj);
    this.mqtt.publish(`${this.base}/p/${pid}`, JSON.stringify(box), { retain });
  }
}

// ================= jogador =================
export class ClientRoom extends Emitter {
  constructor(code, playerName) {
    super();
    this.code = code;
    this.name = playerName;
    this.base = `${NS}/${code}`;
    this.isHost = false;
    this.hostSeen = 0;
    this.hostKeyJwk = null;
    this.shared = null;
  }

  async init() {
    const raw = localStorage.getItem(idKey(this.code));
    let id = raw ? JSON.parse(raw) : null;
    if (!id) {
      id = { pid: randomId(), keys: await generateKeys(), name: this.name };
    }
    if (this.name) id.name = this.name;
    this.name = id.name;
    this.id = id;
    this.pid = id.pid;
    localStorage.setItem(idKey(this.code), JSON.stringify(id));
  }

  static savedName(code) {
    const raw = localStorage.getItem(idKey(code));
    return raw ? JSON.parse(raw).name : null;
  }

  start() {
    this.mqtt = new MqttClient(brokerUrl());
    this.mqtt.on('status', (st, msg) => {
      this.emit('status', st, msg);
      if (st === 'connected' && this.hostKeyJwk) this.hello();
    });
    this.mqtt.on('message', (topic, payload) => {
      this.chain = (this.chain || Promise.resolve()).then(() => this.onMsg(topic, payload)).catch((e) => console.warn(e));
    });
    this.mqtt.subscribe(`${this.base}/room`);
    this.mqtt.subscribe(`${this.base}/p/${this.pid}`);
    this.mqtt.connect();
    this.keep = setInterval(() => { if (this.hostKeyJwk) this.hello(); this.emit('host', this.hostOnline()); }, 20000);
  }

  stop() { clearInterval(this.keep); this.mqtt?.close(); }

  hostOnline() { return Date.now() - this.hostSeen < OFFLINE_AFTER; }

  hello() {
    this.lastHello = Date.now();
    this.mqtt.publish(`${this.base}/in`, JSON.stringify({ t: 'hello', pid: this.pid, key: this.id.keys.pub, name: this.name }));
  }

  async onMsg(topic, payload) {
    if (topic === `${this.base}/room`) {
      let m; try { m = JSON.parse(payload); } catch { return; }
      if (!m.hostKey) return;
      if (Date.now() - m.t < OFFLINE_AFTER) this.hostSeen = Date.now();
      const changed = !sameKey(this.hostKeyJwk, m.hostKey);
      if (changed) {
        this.hostKeyJwk = m.hostKey;
        this.shared = await deriveShared(this.id.keys.priv, m.hostKey);
        this.hello();
      } else if (Date.now() - (this.lastHello || 0) > 5000) {
        this.hello(); // o anfitrião pode ter recarregado: reapresenta-se logo
      }
      this.emit('host', this.hostOnline(), m);
      return;
    }
    if (topic === `${this.base}/p/${this.pid}`) {
      if (!this.shared || !payload) return;
      let m;
      try { m = await open(this.shared, JSON.parse(payload)); } catch { return; }
      if (m.view) { this.hostSeen = Date.now(); this.emit('view', m.view, Date.now()); }
      if (m.err) this.emit('error', m.err);
      if (m.kicked) { localStorage.removeItem(idKey(this.code)); this.emit('kicked'); }
    }
  }

  async act(action) {
    if (!this.shared) { this.emit('error', 'Ainda conectando ao anfitrião…'); return; }
    const box = await seal(this.shared, action);
    this.mqtt.publish(`${this.base}/in`, JSON.stringify({ t: 'act', pid: this.pid, ...box }));
  }
}
