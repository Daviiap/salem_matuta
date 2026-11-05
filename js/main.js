import { HostRoom, ClientRoom, hostedRooms, forgetRoom, brokerUrl, setBrokerUrl, BROKERS } from './net/room.js';
import { cryptoAvailable } from './net/crypto.js';
import { TestRoom } from './net/testroom.js';
import { CARDS } from './engine/cards.js';
import { esc, $, toast, buzz, P, fmtSecs, icon } from './ui/dom.js';
import { newUi, renderPlayer, renderModerator, sheetFor, rulesSheet } from './ui/game.js';
import { installPixelAssets, spriteIds, spriteUrl } from './ui/pixel.js';
import { setSky } from './ui/sky.js';
import { unlock, cackle, bell, owl, rooster, cue, setAmbient, ambientEnabled } from './ui/audio.js';

installPixelAssets();
document.getElementById('ic-home').src = spriteUrl('casa');
document.getElementById('ic-rules').src = spriteUrl('aprendiz');
document.querySelector('#sky .moon').innerHTML = `<img class="px" src="${spriteUrl('meianoite')}" alt="">`;
document.querySelector('#sky .sun').innerHTML = `<img class="px" src="${spriteUrl('sol')}" alt="">`;

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
const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(location.hostname) || params.has('teste');

// ================= telas =================
function renderHome() {
  $('#topbar').hidden = true;
  document.body.classList.remove('night', 'has-dock', 'in-game');
  setSky(1, false);
  const code = (params.get('sala') || '').toUpperCase();
  const lastName = localStorage.getItem('saba-name') || '';
  const hosted = hostedRooms();
  const secure = cryptoAvailable();
  $('#app').innerHTML = `
  <div class="hero">
    <div class="hero-sprites">${icon('morcego', 'hero-bat')}${icon('abobora', 'hero-main')}${icon('bruxa', 'hero-main')}${icon('corvo', 'hero-main')}${icon('morcego', 'hero-bat flip-x')}</div>
    <h1>SABRINA</h1>
    <p class="tagline">Há bruxas escondidas entre os vizinhos.</p>
    <p class="muted">Dedução social para 4 a 12 pessoas, cada uma no próprio celular.</p>
    <button class="ghost small" data-a="sound">${soundLabel()}</button>
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
  <section class="panel"><button class="ghost block" data-a="rules">${icon('aprendiz', 'inline')} Regras</button></section>
  ${isLocal ? `<section class="panel stack">
    <h2>${icon('cartomante', 'inline')} Modo de teste</h2>
    <p class="muted small-text">Roda a sala inteira nesta aba, sem internet. Bots jogam pelos outros e você pode trocar de jogador a qualquer momento.</p>
    <div class="row"><label class="grow">Pessoas na mesa</label><input type="number" id="test-n" min="4" max="12" value="5" style="width:90px"></div>
    <button class="ghost block" data-a="testMode">Abrir modo de teste</button>
  </section>` : ''}`;
  const mod = $('#create-mod');
  mod.onchange = () => { $('#create-name-wrap').hidden = mod.checked; };
}

function soundLabel() { return ambientEnabled() ? '♪ Som ambiente ligado' : '♪ Som ambiente desligado'; }
function syncSoundBtn() {
  const b = $('#btn-sound');
  b.classList.toggle('muted-btn', !ambientEnabled());
  b.title = ambientEnabled() ? 'Silenciar som ambiente' : 'Ligar som ambiente';
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
    ${app.room.test ? '<p class="muted small-text">Sala local de teste: ninguém de fora entra.</p>' : `<button class="ghost small" data-a="share" data-link="${esc(link)}">Compartilhar link</button>`}
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
    ${v.config.moderator ? '<p class="muted small-text">Com moderador não há sinos: você anuncia quando fechar e abrir os olhos (siga o roteiro na tela).</p>' : `<label class="check"><input type="checkbox" id="cfg-snd" ${v.config.allSound ? 'checked' : ''}> Todos os aparelhos tocam os sons</label>
    <p class="muted small-text">Desmarcado, só este aparelho toca os sons da Alvorada e da Meia-Noite (deixe o volume alto); os outros só vibram.</p>`}
    <button class="block" data-a="start" ${n >= 4 && n <= 12 ? '' : 'disabled'}>Começar a partida ${n < 4 ? `(faltam ${4 - n})` : ''}</button>
    ${app.room.moderator || app.room.test ? '' : '<p class="muted small-text">Você é o anfitrião: mantenha esta aba aberta. Se ela fechar, abra o jogo de novo e toque em "Retomar".</p>'}
  </section>` : `<section class="panel center"><p>${icon('ampulheta', 'inline')} Aguardando o anfitrião começar…</p></section>`}`;
  if (host) {
    const save = () => app.room.setConfig({ hourglass: clamp(+$('#cfg-hg').value, 15, 300), confess: clamp(+$('#cfg-cf').value, 10, 120), allSound: !!$('#cfg-snd')?.checked });
    $('#cfg-hg').onchange = save;
    $('#cfg-cf').onchange = save;
    if ($('#cfg-snd')) $('#cfg-snd').onchange = save;
  }
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x || a));

function render() {
  syncSoundBtn();
  renderTestbar();
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
  // antes do primeiro dia o céu é de madrugada; no dia, escurece conforme a Meia-Noite se aproxima
  setSky(v.phase === 'day' || v.phase === 'night' ? v.dusk ?? 0 : v.phase === 'over' ? 0.15 : 0.85, v.phase === 'night');
  document.body.classList.toggle('has-dock', !v.moderator && !!v.me && v.phase !== 'lobby');
  document.body.classList.toggle('in-game', v.phase !== 'lobby');
  if (v.phase === 'lobby') renderLobby();
  else $('#app').innerHTML = v.moderator ? renderModerator(app) : renderPlayer(app);
  renderSheet();
  fitTable();
}

// os lugares da mesa são posicionados conforme o tamanho real dela: mede e,
// se mudou, desenha de novo
function fitTable() {
  const el = document.querySelector('.roundtable');
  if (!el) return;
  const w = el.clientWidth, h = el.clientHeight;
  const old = app.tableBox;
  if (old && Math.abs(old.w - w) < 4 && Math.abs(old.h - h) < 4) return;
  app.tableBox = { w, h };
  $('#app').innerHTML = app.view.moderator ? renderModerator(app) : renderPlayer(app);
}

// ================= painel do modo de teste =================
function renderTestbar() {
  const el = $('#testbar');
  const room = app.room;
  if (!room?.test || !app.view) { el.hidden = true; el.innerHTML = ''; return; }
  const v = app.view;
  const t = v.test;
  el.hidden = false;
  if (!app.testOpen) { el.innerHTML = `<button class="small test-toggle" data-a="testToggle">TESTE ▸</button>`; return; }
  const live = v.phase !== 'lobby';
  const blacks = Object.keys(CARDS).filter((k) => CARDS[k].color === 'black');
  const give = Object.keys(CARDS).filter((k) => CARDS[k].color !== 'black' && k !== 'corvo');
  el.innerHTML = `<div class="test-panel">
    <div class="row"><b class="grow">Modo de teste</b><button class="small ghost" data-a="testToggle">◂</button></div>
    <label>Ver como</label>
    <select data-change="testView">
      ${v.players.map((p) => `<option value="${p.id}" ${p.id === t.viewing ? 'selected' : ''}>${esc(p.name)}${room.state.players.find((q) => q.id === p.id)?.everWitch && live ? ' (bruxa)' : ''}${p.alive ? '' : ' ✝'}</option>`).join('')}
      <option value="" ${t.viewing ? '' : 'selected'}>Moderador (vê tudo)</option>
    </select>
    <label class="check"><input type="checkbox" data-change="testBots" ${t.bots ? 'checked' : ''}> Bots jogam pelos outros</label>
    <div class="row"><label class="grow">Ritmo</label><select data-change="testSpeed" style="width:auto">
      ${[[300, 'rápido'], [900, 'normal'], [2000, 'lento']].map(([ms, l]) => `<option value="${ms}" ${t.speed === ms ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="test-btns">
      <button class="small ghost" data-a="testStep">1 passo de bot</button>
      <button class="small ghost" data-a="undo">Desfazer</button>
      <button class="small ghost" data-a="testBell">🔔 Sino</button>
      <button class="small ghost" data-a="testOwl">Coruja</button>
      <button class="small ghost" data-a="testRooster">Galo</button>
      <button class="small ghost" data-a="testCackle">Risada</button>
      ${v.phase === 'lobby' ? `<button class="small ghost" data-a="testAdd">+ pessoa</button><button class="small ghost" data-a="testDel">− pessoa</button>`
        : `<button class="small ghost" data-a="mod" data-m="skipTurn">Pular vez</button>
           <button class="small ghost" data-a="mod" data-m="endNightTimer">Fim da contagem</button>
           <button class="small ghost" data-a="testRestart">Nova partida</button>`}
    </div>
    ${live && v.phase !== 'over' ? `<label>Topo do baralho (${t.deck} cartas)</label>
    <div class="test-btns">${blacks.map((k) => `<button class="small ghost" data-a="testBlack" data-c="${k}">${esc(CARDS[k].name)}</button>`).join('')}</div>
    <label>Dar carta a quem você vê</label>
    <div class="row"><select id="test-give" style="flex:1">${give.map((k) => `<option value="${k}">${esc(CARDS[k].name)}</option>`).join('')}</select>
      <button class="small ghost" data-a="testGive">Dar</button></div>` : ''}
  </div>`;
}

function renderSheet() {
  const el = $('#sheet');
  let html = '';
  if (app.screen === 'home' || app.view?.phase === 'lobby' || !app.view) html = app.ui.sheet === 'rules' ? rulesSheet() : '';
  else html = sheetFor(app);
  if (!html) { el.hidden = true; el.innerHTML = ''; el.dataset.key = ''; el.dataset.id = ''; return; }
  // evita perder a rolagem da folha quando nada mudou
  if (el.dataset.key === html) return;
  const v = app.view;
  const id = JSON.stringify([app.screen, app.ui.sheet, app.ui.play?.uid, v?.phase, v?.pending?.kind, v?.night?.stage, v?.dawn?.stage]);
  const box = el.firstElementChild;
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  const next = tpl.content.firstElementChild;
  if (!el.hidden && box && next && el.dataset.id === id && box.className === next.className && tpl.content.childElementCount === 1) {
    // mesma folha: troca só o conteúdo, sem reabrir a caixa (nem repetir a animação)
    const scroll = box.scrollTop;
    box.replaceChildren(...next.childNodes);
    box.scrollTop = scroll;
  } else {
    el.innerHTML = html;
    el.hidden = false;
  }
  el.dataset.key = html;
  el.dataset.id = id;
}

// ================= sala =================
function bindRoom(room) {
  app.room = room;
  app.view = null;
  app.ui = newUi();
  app.ui.reportSeen = room.test ? 0 : +localStorage.getItem('saba-report-' + room.code) || 0;
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
  if (room.test) history.replaceState(null, '', '?teste');
  else history.replaceState(null, '', `?sala=${room.code}${params.get('perfil') ? '&perfil=' + params.get('perfil') : ''}`);
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
    // só o aparelho do anfitrião toca os sons (com vários celulares tocando
    // juntos, o atraso da rede vira eco); os outros só vibram
    const soundHere = v.isHost || v.config?.allSound;
    if (v.phase === 'day' && v.turn?.pid === v.me && prev.turn?.pid !== v.me) buzz([100, 60, 100]);
    // deixas de abrir e fechar os olhos: um som para cada etapa
    const st = v.night?.stage, pst = prev.night?.stage;
    const ds = v.dawn?.stage, pds = prev.dawn?.stage;
    let key = null;
    if (st && st !== pst) key = 'night:' + st;
    else if (ds && ds !== pds) key = 'dawn:' + ds;
    else if (prev.phase === 'dawn' && v.phase === 'day') key = 'day:start';
    if (key) {
      // com moderador, é ele quem chama: sem sinos nem vibração
      if (!v.config?.moderator) { if (soundHere) cue(key); buzz([400, 200, 400]); }
    }
    if (v.phase === 'over' && prev.phase !== 'over' && soundHere) cackle();
    if (v.pending?.kind === 'reveal' && v.pending.chooser === v.me && prev.pending?.kind !== 'reveal') buzz([80, 40, 80]);
    const newPriv = v.log.filter((e) => e.to && !prev.log.some((x) => x.id === e.id));
    if (!v.moderator) for (const e of newPriv.slice(-2)) toast(e.text);
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
  // folhas opcionais saem do caminho quando algo exige a atenção de todos
  if ((v.phase !== prev?.phase || v.pending?.kind !== prev?.pending?.kind) && /^(profile|discard|seat:)/.test(ui.sheet || '')) ui.sheet = null;
  if (v.night?.stage !== prev?.night?.stage) ui.confessPick = false;
  if (ui.sheet === 'boticario' && (v.turn?.pid !== v.me || v.turn?.mode)) { ui.sheet = null; ui.botic = []; }
  render();
}

function startTest(n) {
  app.room?.stop();
  const room = TestRoom.create({ players: n, myName: localStorage.getItem('saba-name') || 'Você' });
  app.testOpen = true;
  bindRoom(room);
}

// troca de perspectiva no modo de teste: a interface recomeça do zero, como num aparelho novo
function testChange(kind, el) {
  const room = app.room;
  if (!room?.test) return;
  if (kind === 'testView') {
    app.ui = newUi();
    app.view = null;
    room.viewAs(el.value);
  } else if (kind === 'testBots') room.setBots(el.checked);
  else if (kind === 'testSpeed') room.setSpeed(+el.value);
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
  sound() { unlock(); setAmbient(!ambientEnabled()); render(); },

  // modo de teste
  testMode() {
    const n = clamp(+($('#test-n')?.value || 5), 4, 12);
    startTest(n);
  },
  testToggle() { app.testOpen = !app.testOpen; renderTestbar(); },
  testStep() { app.room.botStep(); },
  testBell() { unlock(); bell(); },
  testOwl() { unlock(); owl(); },
  testRooster() { unlock(); rooster(); },
  testCackle() { unlock(); cackle(); },
  testAdd() { app.room.addBot(); },
  testDel() { app.room.removeBot(); },
  testRestart() { app.ui.overSeen = 0; app.room.startGame(); },
  testBlack(d) { app.room.blackOnTop(d.c); toast(`${CARDS[d.c].name} está no topo do baralho.`); },
  testGive() { app.room.giveCard($('#test-give').value); },
  closeSheet() {
    if (app.ui.sheet) app.ui.sheet = null;
    else if (app.ui.play) app.ui.play = null;
    app.ui.botic = [];
    render();
  },

  // lobby
  async share(d) {
    try {
      if (navigator.share) await navigator.share({ title: 'Sabrina', text: `Entre na sala ${app.room.code} de Sabrina`, url: d.link });
      else { await navigator.clipboard.writeText(d.link); toast('Link copiado!'); }
    } catch { /* cancelado */ }
  },
  move(d) { app.room.move(d.pid, +d.d); },
  kick(d) { if (confirm('Remover esta pessoa da sala?')) app.room.kick(d.pid); },
  start() { app.room.startGame(); },
  again() { app.ui.overSeen = 0; app.room.startGame(); },
  lobby() { if (confirm('Voltar ao lobby? A partida atual será encerrada.')) app.room.backToLobby(); },
  dismissReport() {
    const id = app.view?.report?.id || 0;
    app.ui.reportSeen = id;
    localStorage.setItem('saba-report-' + app.room.code, id);
    render();
  },
  swapPick(d) { send({ type: 'swapPick', index: +d.i }); },
  dismissOver() { app.ui.overSeen = app.view.round; render(); },

  // partida
  pickChar(d) { send({ type: 'pickCharacter', character: d.c }); },
  dawnVote(d) { send({ type: 'dawnVote', target: d.pid }); },
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
  toggleRed(d) {
    const r = app.ui.play?.reds;
    if (!r) return;
    const i = r.indexOf(d.uid);
    if (i >= 0) r.splice(i, 1); else r.push(d.uid);
    render();
  },
  pickAccused(d) { if (app.ui.play) { app.ui.play.targets = [d.pid]; render(); } },
  confirmAccuse() {
    const p = app.ui.play;
    send({ type: 'accuse', uids: p.reds, target: p.targets[0] });
    app.ui.play = null;
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
  togglePeek() { app.ui.peekOpen = !app.ui.peekOpen; app.ui.swap = null; if (!app.ui.peekOpen) peek(false); render(); },
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

// lembra se a Crônica da vila está aberta ('toggle' não sobe, por isso a captura)
document.addEventListener('toggle', (e) => {
  if (e.target.classList?.contains('log-box')) localStorage.setItem('saba-log-open', e.target.open ? '1' : '0');
}, true);

// a mesa redonda depende da largura da tela
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (app.view && app.screen === 'game') render(); }, 150); });

// navegadores só liberam áudio depois de um gesto
document.addEventListener('pointerdown', unlock);
document.addEventListener('keydown', unlock);

// espiar as cartas de equipe: passar o mouse no botão mostra; clicar deixa aberto (togglePeek)
const peek = (on) => document.body.classList.toggle('peeking', on);
document.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse' && e.target.closest('[data-peek]')) peek(true); });
document.addEventListener('pointerout', (e) => { const b = e.target.closest('[data-peek]'); if (b && !b.contains(e.relatedTarget)) peek(false); });
addEventListener('blur', () => peek(false));

// arrastar uma carta de equipe sobre outra troca as duas de lugar
let dragTrial = null;
document.addEventListener('dragstart', (e) => {
  const el = e.target.closest?.('[data-drag-trial]');
  if (!el) return;
  dragTrial = +el.dataset.i;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(dragTrial));
  el.classList.add('dragging');
});
document.addEventListener('dragover', (e) => {
  const el = e.target.closest?.('[data-drag-trial]');
  if (dragTrial == null || !el) return;
  e.preventDefault();
  document.querySelectorAll('.drop-over').forEach((x) => x !== el && x.classList.remove('drop-over'));
  if (+el.dataset.i !== dragTrial) el.classList.add('drop-over');
});
document.addEventListener('drop', (e) => {
  const el = e.target.closest?.('[data-drag-trial]');
  if (dragTrial == null || !el) return;
  e.preventDefault();
  const j = +el.dataset.i;
  if (j !== dragTrial) { send({ type: 'swapTrials', i: dragTrial, j }); app.ui.swap = null; }
});
document.addEventListener('dragend', () => {
  dragTrial = null;
  document.querySelectorAll('.dragging, .drop-over').forEach((x) => x.classList.remove('dragging', 'drop-over'));
});

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
  const tc = e.target.closest('[data-change]');
  if (tc) testChange(tc.dataset.change, tc);
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
  if (params.has('teste')) { startTest(clamp(+params.get('teste') || 5, 4, 12)); return; }
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
