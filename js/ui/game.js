// Renderização da partida (jogador e moderador) e folhas de ação, em pixel art.
import { CARDS, CHARACTERS, TRIALS } from '../engine/cards.js';
import { esc, P, pname, charOf, cardFace, cardBack, trialCard, charCard, stackHtml, meterHtml, fmtSecs, icon } from './dom.js';
import { rulesHtml } from './rules.js';

export function newUi() {
  return { play: null, swap: null, sheet: null, botic: [], carto: [], decoy: null, overSeen: 0, reveal: { taberna: true, juiz: true }, confessPick: false, fresh: new Set(), flips: new Set() };
}

const remaining = (app, deadline) => deadline - (Date.now() + app.offset);
const me = (v) => (v.me ? P(v, v.me) : null);
const alive = (v) => v.players.filter((p) => p.alive);
const has = (p, ab) => p.alive && (p.character === ab || p.copied === ab);
const sprite = (p) => (p.alive ? (p.character || 'aprendiz') : 'caveira');

function timer(app, deadline) {
  return `<span class="timer" data-deadline="${deadline}">${fmtSecs(remaining(app, deadline))}</span>`;
}

// ---------- tapete de cada jogador ----------
function matHtml(app, v, p) {
  const isTurn = v.turn?.pid === p.id && v.phase === 'day';
  const mine = p.id === v.me;
  const c = charOf(p);
  const online = v.online?.[p.id] !== false;
  const coven = p.everWitch && (v.moderator || v.phase === 'over' || mine || (v.coven || []).includes(p.id));
  const seeTypes = mine || v.moderator;
  const trials = p.trials.map((t) => trialCard(t, { size: 'xs', mine: seeTypes, fresh: app.ui.flips })).join('');
  const front = p.front.map((x) => cardFace(x, { size: 'xs' })).join('');
  const tags = [
    mine ? '<span class="tag">você</span>' : '',
    isTurn ? '<span class="tag turn">vez</span>' : '',
    coven ? '<span class="tag coven">coven</span>' : '',
    online ? '' : '<span class="tag off">offline</span>',
  ].join('');
  const hand = v.moderator && p.hand?.length ? `<div class="mat-hand">${p.hand.map((h) => cardFace(h, { size: 'xs' })).join('')}</div>` : '';
  return `<div class="mat ${isTurn ? 'turn' : ''} ${p.alive ? '' : 'dead'} ${mine ? 'me' : ''}" data-a="seatInfo" data-pid="${p.id}">
    <div class="mat-head">
      <span class="portrait">${icon(sprite(p))}</span>
      <div class="mat-id"><div class="mat-name">${esc(p.name)}</div>
        <div class="mat-char">${esc(c.name)}${p.character === 'aprendiz' && p.copied ? ` · ${esc(CHARACTERS[p.copied].name)}` : ''}</div>
        <div class="tags">${tags}</div></div>
      ${stackHtml(p.handCount)}
    </div>
    <div class="mat-trials">${trials}</div>
    ${p.alive ? `<div class="mat-front">${meterHtml(p.points, p.threshold)}<span class="front-cards">${front}</span></div>` : '<div class="mat-front"><span class="dead-label">fora do jogo</span></div>'}
    ${hand}
  </div>`;
}

function tableHtml(app, v) {
  const top = v.discard.at(-1);
  return `<section class="panel felt">
    <div class="table-center">
      <div class="pile" title="Baralho">
        ${stackHtml(v.deckCount, { size: 'sm', max: 6 })}
        <div class="pile-label">Baralho<br><small>Meia-Noite em ${v.deckCount}</small></div>
      </div>
      <div class="pile" data-a="openSheet" data-s="discard" title="Descarte">
        <span class="stack sm" style="--n:1">${top ? cardFace(top, { size: 'sm' }) : cardBack('village', { size: 'sm', cls: 'ghost' })}<b class="stack-n">${v.discard.length}</b></span>
        <div class="pile-label">Descarte<br><small>toque para ver</small></div>
      </div>
    </div>
    <div class="mats">${v.players.map((p) => matHtml(app, v, p)).join('')}</div>
  </section>`;
}

// ---------- status e ações ----------
function statusHtml(app, v) {
  const m = me(v);
  const t = v.turn;
  const box = (ic, html, mine = false, actions = '') => `<div class="status ${mine ? 'mine' : ''}">${icon(ic, 'st-ic')}<div class="st-body">${html}${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  if (v.phase === 'choose') return box('aprendiz', 'Cada pessoa escolhe seu morador…');
  if (v.phase === 'dawn') return box('sol', 'Alvorada: o coven escolhe quem recebe o Corvo Agourento…');
  if (v.phase === 'night') {
    const n = v.night;
    return box('meianoite', n.stage === 'confess' ? `Meia-Noite: hora das confissões ${timer(app, n.deadline)}` : 'Meia-Noite: o coven e o Caçador agem…');
  }
  if (v.phase === 'over') {
    return box('trofeu', v.winner === 'vila' ? 'A Vila venceu!' : 'O Coven venceu!', true,
      v.isHost ? '<button data-a="again">Jogar de novo</button><button class="ghost" data-a="lobby">Voltar ao lobby</button>' : '');
  }
  if (v.phase !== 'day' || !t) return '';
  const pd = v.pending;
  if (pd?.kind === 'reveal') return box('flagrante', `${pname(v, pd.chooser)} escolhe uma carta de ${pname(v, pd.target)} para revelar…`, pd.chooser === v.me);
  if (pd?.kind === 'cartomante') return box('cartomante', `${pname(v, pd.pid)} consulta o baralho…`);
  const hg = t.hourglass ? ` ${icon('ampulheta', 'inline')} ${timer(app, t.hourglass)}` : '';
  const myTurn = t.pid === v.me;
  const btns = [];
  if (myTurn && m?.alive && !v.busy) {
    if (!t.mode) {
      btns.push('<button data-a="draw">Comprar 2</button>');
      if (has(m, 'cartomante') && m.uses.cartomante < 1) btns.push(`<button class="ghost" data-a="cartomante">${icon('cartomante', 'inline')} Cartomante</button>`);
      if (has(m, 'boticario') && m.uses.boticario < 2) btns.push(`<button class="ghost" data-a="openSheet" data-s="boticario">${icon('boticario', 'inline')} Boticário (${2 - m.uses.boticario})</button>`);
    }
    if (t.mode === 'play') btns.push('<button data-a="endTurn">Encerrar vez</button>');
  } else if (!myTurn && m?.alive && !t.hourglass) {
    btns.push(`<button class="ghost small" data-a="hourglass">${icon('ampulheta', 'inline')} Virar ampulheta</button>`);
  }
  const label = myTurn
    ? (t.mode === 'play' ? 'Sua vez: jogue mais cartas ou encerre.' : 'Sua vez! Compre 2 ou toque numa carta da mão.')
    : `Vez de <b>${pname(v, t.pid)}</b>${t.mode === 'play' ? ' (jogando)' : ''}.`;
  return box(myTurn ? 'sol' : sprite(P(v, t.pid)), label + hg, myTurn, btns.join(''));
}

function logHtml(v) {
  return `<section class="panel"><h3>${icon('aprendiz', 'inline')} Crônica da vila</h3>
    <div class="log">${[...v.log].reverse().map((e) => `<div class="${e.to ? 'priv' : ''}">${esc(e.text)}</div>`).join('')}</div></section>`;
}

// ---------- mão em leque ----------
function fanHtml(app, hand) {
  if (!hand.length) return '<p class="muted center">Sua mão está vazia.</p>';
  const n = hand.length, mid = (n - 1) / 2;
  const step = n > 1 ? Math.min(5, 22 / (n - 1)) : 0;
  const cards = hand.map((h, i) => {
    const r = (i - mid) * step;
    const y = (r * r) * 0.09;
    return cardFace(h, { size: '', act: 'card', sel: app.ui.play?.uid === h.uid, cls: app.ui.fresh.has(h.uid) ? 'deal' : '', style: `--r:${r.toFixed(2)}deg;--y:${y.toFixed(1)}px;z-index:${i + 1}` });
  }).join('');
  return `<div class="fan" style="--n:${n};--d:${Math.max(n - 1, 1)}">${cards}</div>`;
}

// ---------- tela do jogador ----------
export function renderPlayer(app) {
  const v = app.view;
  const m = me(v);
  const ui = app.ui;
  let mine = '';
  if (m && m.character) {
    const trials = m.trials.map((t, i) => trialCard(t, { size: 'mdm', mine: true, fresh: ui.flips, act: t.revealed ? null : 'swap', i, sel: ui.swap === i })).join('');
    const coven = m.everWitch
      ? `<p class="note coven">${icon('bruxa', 'inline')} Você é do <b>coven</b>${v.coven?.length ? ` com <b>${v.coven.map((id) => pname(v, id)).join(', ')}</b>` : ''}. Domine a vila.</p>`
      : '';
    mine = `<section class="panel my">
      <h2>Seu lugar</h2>
      <div class="my-top">
        ${charCard(m.character, { size: 'mdm', copied: m.copied, act: 'seatInfo', pid: m.id })}
        <div class="my-info">
          <div class="my-name">${esc(m.name)}</div>
          <div class="ability">${esc(charOf(m).desc)}${m.character === 'aprendiz' ? `<br><b>Copiando:</b> ${m.copied ? esc(CHARACTERS[m.copied].name) : 'nada'}` : ''}</div>
          ${coven}
          ${m.alive ? '' : `<p class="note">${icon('caveira', 'inline')} Você morreu. Assista em silêncio.</p>`}
        </div>
      </div>
      <h3>Cartas de equipe <small>· toque em duas ocultas para trocar a ordem</small></h3>
      <div class="row-cards">${trials}</div>
      <h3>Sua mão <small>· ${m.hand.length} carta(s)</small></h3>
      ${fanHtml(app, m.hand)}
    </section>`;
  }
  return `${statusHtml(app, v)}${tableHtml(app, v)}${mine}${logHtml(v)}`;
}

// ---------- tela do moderador ----------
function scriptFor(v) {
  switch (v.phase) {
    case 'choose': return 'Bem-vindos à vila. Cada um escolha no celular o morador que vai interpretar.';
    case 'dawn': return 'A Alvorada se aproxima… Todos olhem para o celular. Bruxas, reconheçam-se e decidam quem recebe o Corvo Agourento.';
    case 'night': return v.night.stage === 'act'
      ? 'Soa a Meia-Noite. Todos olhem para o celular. Bruxas, escolham sua vítima. Caçador, erga a Lanterna para proteger alguém.'
      : 'O sino silencia. Quem quiser pode confessar agora para salvar a própria pele…';
    case 'day': return v.pending?.kind === 'reveal' ? 'A vila exige respostas! Uma carta será revelada.' : `É a vez de ${pname(v, v.turn?.pid)}.`;
    case 'over': return v.winner === 'vila' ? 'A vila respira aliviada: todas as bruxas foram descobertas.' : 'Ao amanhecer, só restam bruxas na vila…';
    default: return '';
  }
}

export function renderModerator(app) {
  const v = app.view;
  const n = v.night;
  let info = '';
  if (n) {
    const votes = Object.entries(n.votes || {}).map(([w, t]) => `${pname(v, w)} → ${pname(v, t)}`).join('<br>') || '—';
    info = `<p><b>Votos do coven:</b><br>${votes}</p><p><b>Caçador:</b> ${n.hunter ? pname(v, n.hunter) : 'nenhum'} → ${n.pick ? pname(v, n.pick) : '…'}</p>
      ${n.stage === 'confess' ? `<p><b>Já decidiram:</b> ${Object.keys(n.done).map((id) => pname(v, id)).join(', ') || '—'}</p>` : ''}`;
  }
  if (v.dawn?.votes) info = `<p><b>Votos da Alvorada:</b><br>${Object.entries(v.dawn.votes).map(([w, t]) => `${pname(v, w)} → ${pname(v, t)}`).join('<br>') || '—'}</p>`;
  return `${statusHtml(app, v)}
    <section class="panel"><h2>Painel do moderador</h2>
      <div class="script">${scriptFor(v)}</div>${info}
      <div class="mod-grid">
        <button class="ghost" data-a="undo">Desfazer</button>
        <button class="ghost" data-a="mod" data-m="skipTurn">Pular vez</button>
        <button class="ghost" data-a="mod" data-m="stopHourglass">Parar ampulheta</button>
        <button class="ghost" data-a="mod" data-m="endNightTimer">Encerrar confissões</button>
        <button class="danger" data-a="lobby">Voltar ao lobby</button>
      </div>
      <p class="muted">Coven: ${(v.coven || []).map((id) => pname(v, id)).join(', ') || '—'}</p>
    </section>
    ${tableHtml(app, v)}${logHtml(v)}`;
}

// ---------- escolha de jogadores ----------
function playerChoices(v, list, act, { sel = null, votes = null, info = null } = {}) {
  return `<div class="choices">${list.map((p) => {
    const who = votes ? Object.entries(votes).filter(([, t]) => t === p.id).map(([w]) => (w === v.me ? 'você' : pname(v, w))) : [];
    const sub = info ? info(p) : who.length ? 'voto: ' + who.join(', ') : charOf(p).name;
    return `<button class="pchoice ${sel === p.id ? 'sel' : ''}" data-a="${act}" data-pid="${p.id}">${icon(sprite(p))}<span><b>${esc(p.name)}</b><small>${sub}</small></span></button>`;
  }).join('')}</div>`;
}

// ---------- jogar carta ----------
function targetOk(v, ui, card) {
  const d = CARDS[card.type];
  return (p) => p.alive && p.id !== v.me && !ui.play.targets.includes(p.id)
    && !(d.color === 'red' && p.front.some((c) => c.type === 'amuleto'))
    && !(card.type === 'quebranto' && !p.front.some((c) => CARDS[c.type].color === 'blue'));
}

function playSheet(app) {
  const v = app.view;
  const m = me(v);
  const ui = app.ui;
  const card = m.hand.find((h) => h.uid === ui.play.uid);
  if (!card) { ui.play = null; return ''; }
  const d = CARDS[card.type];
  const myTurn = v.phase === 'day' && v.turn?.pid === v.me && !v.pending && !v.busy && v.turn.mode !== 'draw' && m.alive;
  const step = ui.play.targets.length;
  let body;
  if (!myTurn) body = '<p class="muted center">Você só pode jogar cartas na sua vez.</p>';
  else if (d.color === 'blue' && alive(v).length <= 2) body = '<p class="muted center">Com só 2 pessoas vivas, as cartas azuis não são usadas.</p>';
  else if (step < d.targets) {
    const label = d.targets === 2 ? (step === 0 ? (card.type === 'maoleve' ? 'De quem pegar a mão?' : 'De quem tirar as cartas?') : 'Para quem entregar?') : 'Em quem jogar?';
    const opts = v.players.filter(targetOk(v, ui, card));
    body = `<h3>${label}</h3>${opts.length ? playerChoices(v, opts, 'pickTarget', { info: (p) => `${p.points}/${p.threshold} pts · ${p.handCount} na mão` }) : '<p class="muted">Nenhum alvo válido.</p>'}`;
  } else {
    let extra = '';
    if (card.type === 'quebranto') {
      const t = P(v, ui.play.targets[0]);
      const blues = t.front.filter((c) => CARDS[c.type].color === 'blue');
      if (!ui.play.blue) ui.play.blue = blues[0]?.uid;
      extra = `<h3>Qual encanto quebrar?</h3><div class="row-cards">${blues.map((b) => cardFace(b, { size: 'mdm', act: 'pickBlue', sel: ui.play.blue === b.uid })).join('')}</div>`;
    }
    body = `${extra}<p class="center">Alvo: <b>${ui.play.targets.map((id) => pname(v, id)).join(' → ')}</b></p><button class="block" data-a="confirmPlay">Jogar ${esc(d.name)}</button>`;
  }
  return dialog(`<div class="card-show">${cardFace(card, { size: 'lg' })}</div>${body}
    <div class="actions"><button class="ghost" data-a="closeSheet">Fechar</button>${step ? '<button class="ghost" data-a="resetTargets">Refazer alvos</button>' : ''}</div>`);
}

const dialog = (html, cls = '') => `<div class="inner ${cls}">${html}</div>`;

// ---------- folhas automáticas ----------
function chooseSheet(app) {
  const m = me(app.view);
  return dialog(`<h2>Escolha seu morador</h2><p class="muted">Ele é público: todos saberão quem você é, mas não de que lado está.</p>
    <div class="row-cards big">${m.options.map((id) => charCard(id, { size: 'lg', act: 'pickChar', attrs: `data-c="${id}"` })).join('')}</div>`);
}

function decoySheet(app, title, text) {
  const v = app.view;
  return dialog(`<h2>${title}</h2><p>${text}</p>
    ${playerChoices(v, alive(v).filter((p) => p.id !== v.me), 'decoy', { sel: app.ui.decoy })}
    ${app.ui.decoy ? '<p class="muted center">Anotado. Aguarde os outros…</p>' : ''}`, 'night-box');
}

function dawnSheet(app) {
  const v = app.view;
  const m = me(v);
  if (!m.everWitch) return decoySheet(app, 'Alvorada', 'O coven está agindo. Para ninguém perceber, toque em quem você acha suspeito.');
  return dialog(`<h2>${icon('bruxa', 'inline')} Alvorada</h2>
    <p>Você é do <b>coven</b>${v.coven?.length ? ` com <b>${v.coven.map((id) => pname(v, id)).join(', ')}</b>` : ' e age sozinha nesta partida'}.</p>
    <div class="row-cards">${cardFace({ type: 'corvo' }, { size: 'mdm' })}<p class="grow">Escolham juntas quem recebe o <b>Corvo Agourento</b>. Pode ser uma de vocês. Todas precisam votar na mesma pessoa.</p></div>
    ${playerChoices(v, v.players, 'dawnVote', { sel: v.dawn?.votes?.[v.me], votes: v.dawn?.votes || {} })}`, 'night-box');
}

function nightSheet(app) {
  const v = app.view;
  const n = v.night;
  const m = me(v);
  const ui = app.ui;
  if (n.stage === 'confess') {
    const t = timer(app, n.deadline);
    if (n.done[v.me]) return dialog(`<h2>Confissões ${t}</h2><p>${n.confessed[v.me] ? 'Você confessou.' : 'Você decidiu não confessar.'} Aguardando os outros…</p>`, 'night-box');
    if (ui.confessPick) {
      return dialog(`<h2>Qual carta confessar? ${t}</h2><p class="muted">A carta fica revelada para todos. Se for uma Bruxa, você morre.</p>
        <div class="row-cards">${m.trials.map((tr, i) => (tr.revealed ? '' : trialCard(tr, { size: 'md', mine: true, act: 'confess', i }))).join('')}</div>
        <button class="ghost" data-a="confessBack">Voltar</button>`, 'night-box');
    }
    return dialog(`<h2>${icon('inocente', 'inline')} Confissões ${t}</h2>
      <p>Quem confessar (revelar uma das próprias cartas) fica protegido do ataque desta noite.</p>
      <div class="actions"><button data-a="confessOpen">Confessar</button>
      ${n.canSacristao ? `<button class="ghost" data-a="sacristao">${icon('sacristao', 'inline')} Sem revelar</button>` : ''}
      <button class="ghost" data-a="pass">Não confessar</button></div>`, 'night-box');
  }
  const parts = [];
  if (n.role === 'witch' || n.role === 'both') {
    parts.push(`<h3>${icon('bruxa', 'inline')} O coven escolhe a vítima</h3>
      <p class="muted">Coven: ${[v.me, ...(v.coven || [])].map((id) => (id === v.me ? 'você' : pname(v, id))).join(', ')}. Todas precisam votar na mesma pessoa.</p>
      ${playerChoices(v, alive(v), 'nightVote', { sel: n.votes?.[v.me], votes: n.votes || {} })}`);
  }
  if (n.role === 'hunter' || n.role === 'both') {
    parts.push(`<h3>${icon('cacador', 'inline')} Caçador: erga a Lanterna</h3><p class="muted">Proteja outra pessoa da vítima do coven.</p>
      ${playerChoices(v, alive(v).filter((p) => p.id !== v.me), 'hunterPick', { sel: n.pick })}`);
  }
  if (!parts.length) return decoySheet(app, `${icon('meianoite', 'inline')} Meia-Noite`, 'O coven e o Caçador estão agindo. Para ninguém perceber, toque em alguém por quem você reza esta noite.');
  return dialog(`<h2>${icon('meianoite', 'inline')} Meia-Noite</h2>${parts.join('')}<p class="muted center">Aguardando todos decidirem…</p>`, 'night-box');
}

function revealSheet(app) {
  const v = app.view;
  const pd = v.pending;
  const t = P(v, pd.target);
  const ui = app.ui;
  const opts = [];
  if (pd.taberna) opts.push(`<label class="check"><input type="checkbox" data-a="opt" data-o="taberna" ${ui.reveal.taberna ? 'checked' : ''}> Taberneira: comprar 2 cartas</label>`);
  if (pd.juiz) opts.push(`<label class="check"><input type="checkbox" data-a="opt" data-o="juiz" ${ui.reveal.juiz ? 'checked' : ''}> Juiz: descartar as acusações na sua frente</label>`);
  return dialog(`<h2>${icon('flagrante', 'inline')} Revelar uma carta de ${esc(t.name)}</h2>
    <p class="muted">${pd.cause === 'eclipse' ? 'Eclipse: quem tem o Corvo revela uma carta.' : 'A acusação chegou ao limite.'} Toque numa carta virada.</p>
    ${opts.join('')}
    <div class="row-cards">${t.trials.map((tr, i) => trialCard(tr, { size: 'md', act: tr.revealed ? null : 'reveal', i, cls: tr.revealed ? 'dim' : 'pickme' })).join('')}</div>`);
}

function cartomanteSheet(app) {
  const v = app.view;
  const ui = app.ui;
  const cards = v.pending.cards || [];
  const order = ui.carto;
  return dialog(`<h2>${icon('cartomante', 'inline')} As cartas do topo</h2><p class="muted">Toque nas cartas na ordem em que devem sair. A primeira tocada fica no topo.</p>
    <div class="row-cards">${cards.map((c) => { const k = order.indexOf(c.uid); return `<span class="ordered">${cardFace(c, { size: 'mdm', act: 'carto', sel: k >= 0 })}${k >= 0 ? `<b class="order-n">${k + 1}</b>` : ''}</span>`; }).join('')}</div>
    <div class="actions"><button class="ghost" data-a="cartoReset">Recomeçar</button><button data-a="cartoDone" ${order.length === cards.length ? '' : 'disabled'}>Confirmar ordem</button></div>`);
}

function boticarioSheet(app) {
  const v = app.view;
  const ui = app.ui;
  const cards = v.discard.filter((c) => CARDS[c.type].color !== 'black');
  return dialog(`<h2>${icon('boticario', 'inline')} Boticário</h2><p class="muted">Escolha até 2 cartas do descarte. Isso encerra a sua vez.</p>
    ${cards.length ? `<div class="row-cards">${cards.map((c) => cardFace(c, { size: 'mdm', act: 'botic', sel: ui.botic.includes(c.uid) })).join('')}</div>` : '<p>O descarte está vazio.</p>'}
    <div class="actions"><button class="ghost" data-a="closeSheet">Cancelar</button><button data-a="boticDone" ${ui.botic.length ? '' : 'disabled'}>Pegar ${ui.botic.length}</button></div>`);
}

function discardSheet(app) {
  const v = app.view;
  return dialog(`<h2>Descarte · ${v.discard.length}</h2>
    ${v.discard.length ? `<div class="row-cards">${[...v.discard].reverse().map((c) => cardFace(c, { size: 'sm' })).join('')}</div>` : '<p class="muted">Vazio.</p>'}
    <button class="ghost block" data-a="closeSheet">Fechar</button>`);
}

function overSheet(app) {
  const v = app.view;
  return dialog(`<div class="winner">${icon(v.winner === 'vila' ? 'casa' : 'bruxa', 'big')}<div>${v.winner === 'vila' ? 'A Vila venceu!' : 'O Coven venceu!'}</div></div>
    <div class="over-list">${v.players.map((p) => `<div class="over-row ${p.alive ? '' : 'dead'}">${icon(sprite(p))}
      <span class="grow"><b>${esc(p.name)}</b> <span class="tag ${p.everWitch ? 'coven' : ''}">${p.everWitch ? 'coven' : 'vila'}</span></span>
      <span class="row-cards tight">${p.trials.map((t) => trialCard(t, { size: 'xs', fresh: app.ui.flips })).join('')}</span></div>`).join('')}</div>
    <div class="actions">${v.isHost ? '<button data-a="again">Jogar de novo</button>' : ''}<button class="ghost" data-a="dismissOver">Ver a mesa</button></div>`);
}

function seatInfoSheet(app, pid) {
  const v = app.view;
  const p = P(v, pid);
  if (!p) return '';
  const front = p.front.length ? `<h3>Na frente</h3><div class="row-cards">${p.front.map((x) => cardFace(x, { size: 'mdm' })).join('')}</div>` : '';
  return dialog(`<h2>${esc(p.name)}</h2>
    <div class="card-show">${charCard(p.character, { size: 'lg', copied: p.copied })}</div>
    <p class="center">Acusação ${p.points}/${p.threshold} · ${p.handCount} carta(s) na mão</p>${front}
    <button class="ghost block" data-a="closeSheet">Fechar</button>`);
}

export function rulesSheet() {
  return dialog(`${rulesHtml()}<button class="block" data-a="closeSheet">Fechar</button>`);
}

export function sheetFor(app) {
  const v = app.view;
  const ui = app.ui;
  const m = me(v);
  if (ui.sheet === 'rules') return rulesSheet();
  if (ui.sheet === 'discard') return discardSheet(app);
  if (ui.sheet?.startsWith?.('seat:')) return seatInfoSheet(app, ui.sheet.slice(5));
  if (v.phase === 'over') return ui.overSeen === v.round ? '' : overSheet(app);
  if (!m) return '';
  if (v.phase === 'choose' && !m.character) return chooseSheet(app);
  if (v.phase === 'dawn') return dawnSheet(app);
  if (v.phase === 'night' && m.alive) return nightSheet(app);
  if (v.pending?.kind === 'reveal' && v.pending.chooser === v.me) return revealSheet(app);
  if (v.pending?.kind === 'cartomante' && v.pending.pid === v.me) return cartomanteSheet(app);
  if (ui.sheet === 'boticario') return boticarioSheet(app);
  if (ui.play) return playSheet(app);
  return '';
}
