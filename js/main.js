import { HostRoom, ClientRoom, hostedRooms, forgetRoom, brokerUrl, setBrokerUrl, BROKERS } from './net/room.js';
import { cryptoAvailable } from './net/crypto.js';
import { esc, $, toast, buzz, P, fmtSecs, icon } from './ui/dom.js';
import { newUi, renderPlayer, renderModerator, sheetFor, rulesSheet } from './ui/game.js';
import { installPixelAssets, spriteIds, spriteUrl } from './ui/pixel.js';

installPixelAssets();
document.getElementById('ic-home').src = spriteUrl('casa');
document.getElementById('ic-rules').src = spriteUrl('aprendiz');
document.querySelector('#sky .moon').innerHTML = `<img class="px" src="${spriteUrl('meianoite')}" alt="">`;

const app = {
  room: null,
  view: null,
  ui: newUi(),
  offset: 0,
  net: 'off',
  screen: 'home',
};
window.saba = app; // útil para depuração

const params = new URLSearchParams(location.search);

// ================= telas =================
function renderHome() {
  $('#topbar').hidden = true;
  document.body.classList.remove('night');
  const code = (params.get('sala') || '').toUpperCase();
  const lastName = localStorage.getItem('saba-name') || '';
  const hosted = hostedRooms();
  const secure = cryptoAvailable();
  $('#app').innerHTML = `
  <div class="hero">
    <div class="hero-sprites">${icon('morcego', 'hero-bat')}${icon('abobora', 'hero-main')}${icon('bruxa', 'hero-main')}${icon('corvo', 'hero-main')}${icon('morcego', 'hero-bat flip-x')}</div>
    <h1>SABÁ</h1>
    <p class="tagline">Há bruxas escondidas entre os vizinhos.</p>
    <p class="muted">Dedução social para 4 a 12 pessoas, cada uma no próprio celular.</p>
  </div>
  ${secure ? '' : '<div class="panel warn">Este navegador não liberou a criptografia (WebCrypto). Abra o jogo por <b>https</b> (por exemplo, no GitHub Pages) ou em <b>localhost</b>.</div>'}
  <section class="panel stack">
    <h2>${icon('casa', 'inline')} Entrar numa sala</h2>
    <div><label>Código da sala</label><input id="join-code" class="code-input" maxlength="4" autocapitalize="characters" placeholder="ABCD" value="${esc(code)}"></div>
    <div><label>Seu nome</label><input id="join-name" maxlength="20" placeholder="Como te chamam na vila" value="${esc(lastName)}"></div>
    <button class="block" data-a="join">Entrar</button>
  </section>
  <section class="panel stack">
    <h2>${icon('inocente', 'inline')} Criar uma sala</h2>
    <label class="check"><input type="checkbox" id="create-mod"> Serei o moderador (conduzo a partida e não jogo)</label>
    <div id="create-name-wrap"><label>Seu nome</label><input id="create-name" maxlength="20" value="${esc(lastName)}"></div>
    <p class="muted small-text">O aparelho de quem cria a sala roda as regras e precisa ficar aberto durante a partida. Com um moderador, nenhum jogador tem acesso ao estado completo.</p>
    <button class="block" data-a="create">Criar sala</button>
  </section>
  ${hosted.length ? `<section class="panel"><h2>${icon('tronco', 'inline')} Salas que você hospeda</h2>${hosted.map((r) => `<div class="row list-row">
      <span class="grow"><b class="mono">${r.code}</b> <small>${r.players} pessoa(s) · ${esc(r.phase)}</small></span>
      <button class="small" data-a="resume" data-code="${r.code}">Retomar</button><button class="small ghost" data-a="forget" data-code="${r.code}">X</button></div>`).join('')}</section>` : ''}
  <section class="panel">
    <details><summary>Conexão</summary>
      <p class="muted small-text">As mensagens passam por um broker MQTT público via WebSocket. As cartas secretas vão cifradas. Se a conexão falhar, todos na sala devem trocar para o mesmo broker.</p>
      <select id="broker">${BROKERS.map((b) => `<option ${b === brokerUrl() ? 'selected' : ''}>${b}</option>`).join('')}${BROKERS.includes(brokerUrl()) ? '' : `<option selected>${esc(brokerUrl())}</option>`}</select>
      <input id="broker-custom" placeholder="ou digite outro wss://…" style="margin-top:8px">
      <button class="ghost small" style="margin-top:8px" data-a="saveBroker">Salvar</button>
    </details>
  </section>
  <section class="panel"><button class="ghost block" data-a="rules">${icon('aprendiz', 'inline')} Regras</button></section>`;
  const mod = $('#create-mod');
  mod.onchange = () => { $('#create-name-wrap').hidden = mod.checked; };
}

function renderSprites() {
  $('#app').innerHTML = `<section class="panel"><h2>Sprites</h2><div class="sprite-grid">${spriteIds().map((id) => `<figure>${icon(id, 'big')}<figcaption>${id}</figcaption></figure>`).join('')}</div></section>`;
}

function renderLobby() {
  const v = app.view;
  const host = app.room.isHost;
  const link = `${location.origin}${location.pathname}?sala=${app.room.code}`;
  const n = v.players.length;
  $('#app').innerHTML = `
  <section class="panel center">
    <p class="muted">Código da sala</p>
    <div class="code-big">${app.room.code}</div>
    <button class="ghost small" data-a="share" data-link="${esc(link)}">Compartilhar link</button>
  </section>
  <section class="panel">
    <h2>${icon('casa', 'inline')} Na vila · ${n}/12</h2>
    <p class="muted small-text">A ordem abaixo é a ordem da mesa. ${host ? 'Use as setas para ajustar.' : ''}</p>
    ${v.players.map((p, i) => `<div class="row list-row">
      <span class="dot ${v.online?.[p.id] === false ? 'bad' : 'ok'}"></span>
      <span class="grow"><b>${i + 1}.</b> ${esc(p.name)} ${p.id === v.me ? '<span class="tag">você</span>' : ''}</span>
      ${host ? `<button class="small ghost" data-a="move" data-pid="${p.id}" data-d="-1">▲</button><button class="small ghost" data-a="move" data-pid="${p.id}" data-d="1">▼</button>
        ${p.id !== v.me ? `<button class="small ghost" data-a="kick" data-pid="${p.id}">X</button>` : ''}` : ''}
    </div>`).join('') || '<p class="muted">Ninguém ainda…</p>'}
  </section>
  ${host ? `<section class="panel stack">
    <h2>${icon('ampulheta', 'inline')} Ajustes</h2>
    <div class="row"><label class="grow">Ampulheta (segundos)</label><input type="number" id="cfg-hg" min="15" max="300" value="${v.config.hourglass}" style="width:110px"></div>
    <div class="row"><label class="grow">Tempo de confissão (segundos)</label><input type="number" id="cfg-cf" min="10" max="120" value="${v.config.confess}" style="width:110px"></div>
    <button class="block" data-a="start" ${n >= 4 && n <= 12 ? '' : 'disabled'}>Começar a partida ${n < 4 ? `(faltam ${4 - n})` : ''}</button>
    ${app.room.moderator ? '' : '<p class="muted small-text">Você é o anfitrião: mantenha esta aba aberta. Se ela fechar, abra o jogo de novo e toque em "Retomar".</p>'}
  </section>` : `<section class="panel center"><p>${icon('ampulheta', 'inline')} Aguardando o anfitrião começar…</p></section>`}`;
  if (host) {
    const save = () => app.room.setConfig({ hourglass: clamp(+$('#cfg-hg').value, 15, 300), confess: clamp(+$('#cfg-cf').value, 10, 120) });
    $('#cfg-hg').onchange = save;
    $('#cfg-cf').onchange = save;
  }
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x || a));

function render() {
  if (app.screen === 'sprites') { renderSprites(); return; }
  if (app.screen === 'home') { renderHome(); renderSheet(); return; }
  $('#topbar').hidden = false;
  $('#room-code').textContent = app.room?.code || '';
  const dot = $('#net-dot');
  dot.className = 'dot ' + (app.net === 'connected' ? (app.hostOk === false ? 'wait' : 'ok') : app.net === 'connecting' ? 'wait' : 'bad');
  dot.title = app.net === 'connected' ? (app.hostOk === false ? 'anfitrião offline' : 'conectado') : 'sem conexão';
  const v = app.view;
  if (!v) {
    $('#app').innerHTML = `<section class="panel center"><p>${icon('cartomante', 'inline')} Conectando à sala <b>${esc(app.room.code)}</b>…</p>
      <p class="muted">${app.net === 'connected' ? 'Esperando resposta do anfitrião. Confira se o código está certo e se o anfitrião está com o jogo aberto.' : 'Conectando ao servidor de mensagens…'}</p></section>`;
    renderSheet();
    return;
  }
  document.body.classList.toggle('night', v.phase === 'night' || v.phase === 'dawn');
  if (v.phase === 'lobby') renderLobby();
  else $('#app').innerHTML = v.moderator ? renderModerator(app) : renderPlayer(app);
  renderSheet();
}

function renderSheet() {
  const el = $('#sheet');
  let html = '';
  if (app.screen === 'home' || app.view?.phase === 'lobby' || !app.view) html = app.ui.sheet === 'rules' ? rulesSheet() : '';
  else html = sheetFor(app);
  if (!html) { el.hidden = true; el.innerHTML = ''; el.dataset.key = ''; return; }
  // evita perder a rolagem da folha quando nada mudou
  if (el.dataset.key === html) return;
  const scroll = el.firstElementChild?.scrollTop || 0;
  el.innerHTML = html;
  el.dataset.key = html;
  el.hidden = false;
  if (el.firstElementChild) el.firstElementChild.scrollTop = scroll;
}

// ================= sala =================
function bindRoom(room) {
  app.room = room;
  app.view = null;
  app.ui = newUi();
  app.screen = 'game';
  room.on('status', (st, msg) => {
    app.net = st;
    if (st === 'error' && msg) toast(msg);
    render();
  });
  room.on('host', (ok) => { app.hostOk = ok; if (!ok) toast('O anfitrião parece offline…'); render(); });
  room.on('error', (msg) => { toast(msg); });
  room.on('kicked', () => { toast('Você foi removido da sala.'); leave(); });
  room.on('view', (v, receivedAt) => onView(v, receivedAt));
  room.start();
  history.replaceState(null, '', `?sala=${room.code}${params.get('perfil') ? '&perfil=' + params.get('perfil') : ''}`);
  keepAwake();
  render();
}

function onView(v, receivedAt) {
  const prev = app.view;
  app.offset = v.now - receivedAt;
  app.view = v;
  app.hostOk = true;
  const ui = app.ui;
  // reações a mudanças
  const m = v.me ? P(v, v.me) : null;
  if (prev) {
    if (v.phase === 'day' && v.turn?.pid === v.me && prev.turn?.pid !== v.me) buzz([100, 60, 100]);
    if (v.phase === 'night' && prev.phase !== 'night') buzz([300]);
    if (v.pending?.kind === 'reveal' && v.pending.chooser === v.me && prev.pending?.kind !== 'reveal') buzz([80, 40, 80]);
    const newPriv = v.log.filter((e) => e.to && !prev.log.some((x) => x.id === e.id));
    for (const e of newPriv.slice(-2)) toast(e.text);
  }
  // animações: cartas novas na mão e cartas recém-reveladas
  if (prev) {
    const pm = prev.me ? P(prev, prev.me) : null;
    const had = new Set(pm?.hand?.map((h) => h.uid) || []);
    ui.fresh = new Set((m?.hand || []).filter((h) => !had.has(h.uid)).map((h) => h.uid));
    const rev = new Set(prev.players.flatMap((p) => p.trials.filter((t) => t.revealed && t.uid).map((t) => t.uid)));
    ui.flips = new Set(v.players.flatMap((p) => p.trials.filter((t) => t.revealed && t.uid && !rev.has(t.uid)).map((t) => t.uid)));
    clearTimeout(app.animTimer);
    app.animTimer = setTimeout(() => { ui.fresh = new Set(); ui.flips = new Set(); }, 900);
  }
  if (ui.play && (!m || !m.hand.some((h) => h.uid === ui.play.uid))) ui.play = null;
  if (ui.swap != null && (!m || !m.trials[ui.swap] || m.trials[ui.swap].revealed)) ui.swap = null;
  if (v.phase !== prev?.phase) { ui.decoy = null; ui.confessPick = false; ui.carto = []; }
  if (v.night?.stage !== prev?.night?.stage) ui.confessPick = false;
  if (ui.sheet === 'boticario' && (v.turn?.pid !== v.me || v.turn?.mode)) { ui.sheet = null; ui.botic = []; }
  render();
}

async function joinRoom(code, nm) {
  const room = new ClientRoom(code, nm);
  await room.init();
  bindRoom(room);
}

function leave() {
  app.room?.stop();
  app.room = null;
  app.view = null;
  app.screen = 'home';
  app.ui = newUi();
  history.replaceState(null, '', location.pathname + (params.get('perfil') ? '?perfil=' + params.get('perfil') : ''));
  params.delete('sala');
  render();
}

let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.onrelease = () => { wakeLock = null; }; } } catch { /* ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && app.room) keepAwake(); });

// ================= ações =================
const send = (action) => app.room.act(action);

const H = {
  // início
  async join() {
    const code = $('#join-code').value.trim().toUpperCase();
    const nm = $('#join-name').value.trim();
    if (!/^[A-Z]{4}$/.test(code)) return toast('O código tem 4 letras.');
    if (!nm) return toast('Digite seu nome.');
    if (!cryptoAvailable()) return toast('Abra por https ou localhost.');
    localStorage.setItem('saba-name', nm);
    await joinRoom(code, nm);
  },
  async create() {
    const moderator = $('#create-mod').checked;
    const nm = $('#create-name').value.trim();
    if (!moderator && !nm) return toast('Digite seu nome.');
    if (!cryptoAvailable()) return toast('Abra por https ou localhost.');
    if (nm) localStorage.setItem('saba-name', nm);
    const room = await HostRoom.create({ moderator, hostName: nm });
    bindRoom(room);
  },
  resume(d) {
    const room = HostRoom.resume(d.code);
    if (!room) return toast('Sala não encontrada.');
    bindRoom(room);
  },
  forget(d) {
    if (!confirm(`Apagar a sala ${d.code} deste aparelho?`)) return;
    forgetRoom(d.code);
    render();
  },
  saveBroker() {
    const custom = $('#broker-custom').value.trim();
    const url = custom || $('#broker').value;
    if (!/^wss?:\/\//.test(url)) return toast('O endereço deve começar com wss://');
    setBrokerUrl(url);
    toast('Broker salvo.');
    render();
  },
  rules() { app.ui.sheet = 'rules'; renderSheet(); },
  closeSheet() {
    if (app.ui.sheet) app.ui.sheet = null;
    else if (app.ui.play) app.ui.play = null;
    app.ui.botic = [];
    render();
  },

  // lobby
  async share(d) {
    try {
      if (navigator.share) await navigator.share({ title: 'Sabá', text: `Entre na sala ${app.room.code} do Sabá`, url: d.link });
      else { await navigator.clipboard.writeText(d.link); toast('Link copiado!'); }
    } catch { /* cancelado */ }
  },
  move(d) { app.room.move(d.pid, +d.d); },
  kick(d) { if (confirm('Remover esta pessoa da sala?')) app.room.kick(d.pid); },
  start() { app.room.startGame(); },
  again() { app.ui.overSeen = 0; app.room.startGame(); },
  lobby() { if (confirm('Voltar ao lobby? A partida atual será encerrada.')) app.room.backToLobby(); },
  dismissOver() { app.ui.overSeen = app.view.round; render(); },

  // partida
  pickChar(d) { send({ type: 'pickCharacter', character: d.c }); },
  dawnVote(d) { send({ type: 'dawnVote', target: d.pid }); },
  decoy(d) { app.ui.decoy = d.pid; render(); },
  nightVote(d) { send({ type: 'nightVote', target: d.pid }); },
  hunterPick(d) { send({ type: 'hunterPick', target: d.pid }); },
  confessOpen() { app.ui.confessPick = true; render(); },
  confessBack() { app.ui.confessPick = false; render(); },
  confess(d) { send({ type: 'confess', index: +d.i }); app.ui.confessPick = false; },
  sacristao() { send({ type: 'confess', sacristao: true }); },
  pass() { send({ type: 'pass' }); },
  draw() { send({ type: 'draw' }); },
  endTurn() { send({ type: 'endTurn' }); },
  hourglass() { send({ type: 'hourglass' }); },
  cartomante() { app.ui.carto = []; send({ type: 'cartomante' }); },
  carto(d) {
    const o = app.ui.carto;
    if (!o.includes(d.uid)) o.push(d.uid);
    render();
  },
  cartoReset() { app.ui.carto = []; render(); },
  cartoDone() { send({ type: 'cartomanteOrder', order: app.ui.carto }); app.ui.carto = []; },
  openSheet(d) { app.ui.sheet = d.s; app.ui.botic = []; render(); },
  botic(d) {
    const b = app.ui.botic;
    const i = b.indexOf(d.uid);
    if (i >= 0) b.splice(i, 1); else if (b.length < 2) b.push(d.uid);
    render();
  },
  boticDone() { send({ type: 'boticario', uids: app.ui.botic }); app.ui.sheet = null; app.ui.botic = []; render(); },
  card(d) {
    app.ui.play = { uid: d.uid, targets: [], blue: null };
    render();
  },
  pickTarget(d) {
    if (!app.ui.play) return;
    app.ui.play.targets.push(d.pid);
    render();
  },
  pickBlue(d) { app.ui.play.blue = d.uid; render(); },
  resetTargets() { app.ui.play.targets = []; app.ui.play.blue = null; render(); },
  confirmPlay() {
    const p = app.ui.play;
    send({ type: 'play', uid: p.uid, targets: p.targets, blue: p.blue || undefined });
    app.ui.play = null;
    render();
  },
  reveal(d) {
    const r = app.ui.reveal;
    send({ type: 'reveal', index: +d.i, taberna: r.taberna, juiz: r.juiz });
  },
  opt(d, el) { app.ui.reveal[d.o] = el.checked; },
  swap(d) {
    const i = +d.i;
    const ui = app.ui;
    if (ui.swap == null) { ui.swap = i; render(); return; }
    if (ui.swap === i) { ui.swap = null; render(); return; }
    send({ type: 'swapTrials', i: ui.swap, j: i });
    ui.swap = null;
  },
  seatInfo(d) { app.ui.sheet = 'seat:' + d.pid; render(); },
  noop() {},

  // moderador
  undo() { app.room.undo(); },
  mod(d) { app.room.mod({ type: d.m }); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) {
    // toque fora da folha fecha folhas opcionais
    if (e.target.id === 'sheet' && (app.ui.sheet || app.ui.play)) H.closeSheet();
    return;
  }
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return; // tratado no change
  const fn = H[el.dataset.a];
  if (fn) { e.preventDefault(); Promise.resolve(fn({ ...el.dataset }, el)).catch((err) => { console.error(err); toast('Erro: ' + err.message); }); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-a="opt"]');
  if (el) H.opt({ ...el.dataset }, el);
});

$('#btn-home').onclick = () => {
  if (!confirm(app.room?.isHost ? 'Sair? A sala fica salva neste aparelho e você pode retomá-la depois. Enquanto isso, ninguém consegue jogar.' : 'Sair da sala?')) return;
  leave();
};
$('#btn-rules').onclick = () => { app.ui.sheet = 'rules'; renderSheet(); };

// atualiza os cronômetros sem redesenhar tudo
setInterval(() => {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    const ms = +el.dataset.deadline - (Date.now() + app.offset);
    const txt = fmtSecs(ms);
    if (el.textContent !== txt) el.textContent = txt;
  }
}, 250);

// entrada direta: ?sala=XXXX com nome salvo para essa sala → reconecta
(async function boot() {
  if (params.has('sprites')) { app.screen = 'sprites'; render(); return; }
  const code = (params.get('sala') || '').toUpperCase();
  if (/^[A-Z]{4}$/.test(code)) {
    if (HostRoom.resume(code) && hostedRooms().some((r) => r.code === code)) {
      // o anfitrião recarregou a página
      bindRoom(HostRoom.resume(code));
      return;
    }
    const saved = ClientRoom.savedName(code);
    if (saved && cryptoAvailable()) { await joinRoom(code, saved); return; }
  }
  render();
})();
