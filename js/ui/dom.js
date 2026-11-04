import { CARDS, CHARACTERS, TRIALS } from '../engine/cards.js';
import { icon } from './pixel.js';

export { icon };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel) => document.querySelector(sel);

let toastTimer;
export function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export function buzz(pattern = [120]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

export const P = (v, id) => v.players.find((p) => p.id === id);
export const pname = (v, id) => esc(P(v, id)?.name ?? '?');

export function charOf(p) {
  if (!p?.character) return { name: 'Escolhendo…', desc: '' };
  return CHARACTERS[p.character];
}

export function fmtSecs(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ================= cartas =================
// Tamanhos: xs, sm, mdm, md, lg. Sem tamanho: herda --w do contêiner (leque da mão).
const COLOR_INFO = {
  red: { label: 'Acusação', pip: null },
  blue: { label: 'Encanto', pip: '◆' },
  green: { label: 'Feitiço', pip: '✦' },
  black: { label: 'Evento', pip: '☾' },
};

function attrsOf({ act, uid, pid, i, attrs = '' }) {
  return [act ? `data-a="${act}"` : '', uid ? `data-uid="${uid}"` : '', pid ? `data-pid="${pid}"` : '', i != null ? `data-i="${i}"` : '', attrs].join(' ');
}

function gcard({ kind, size = 'md', title, sprite, text = '', type = '', pip = '', sel, cls = '', style = '', ...rest }) {
  return `<div class="gcard ${kind} ${size} ${sel ? 'sel' : ''} ${cls}" style="${style}" ${attrsOf(rest)}>
    <div class="gc-inner">
      ${pip ? `<div class="gc-corner tl">${pip}</div><div class="gc-corner br">${pip}</div>` : ''}
      <div class="gc-title">${esc(title)}</div>
      <div class="gc-art">${icon(sprite)}</div>
      ${text ? `<div class="gc-text">${esc(text)}</div>` : ''}
      <div class="gc-type">${esc(type)}</div>
    </div></div>`;
}

export function cardFace(c, opts = {}) {
  const d = CARDS[c.type];
  const v = d.pts ? (c.val || d.pts) : null;
  return gcard({
    kind: d.color, title: d.name, sprite: c.type, text: d.desc,
    type: COLOR_INFO[d.color].label + (v ? ` ${v}` : ''),
    pip: v ?? COLOR_INFO[d.color].pip, uid: c.uid, ...opts,
  });
}

export function cardBack(kind = 'village', { size = 'md', cls = '', style = '', ...rest } = {}) {
  return `<div class="gcard back back-${kind} ${size} ${cls}" style="${style}" ${attrsOf(rest)}><div class="gc-inner"></div></div>`;
}

export function trialCard(t, { mine = false, size = 'md', fresh, cls = '', ...rest } = {}) {
  if (!t.type) return cardBack('trial', { size, cls, ...rest });
  const d = TRIALS[t.type];
  const flags = [cls, t.revealed ? 'revealed' : '', mine && !t.revealed ? 'secret' : '', t.uid && fresh?.has(t.uid) ? 'flip' : ''].join(' ');
  const type = t.revealed ? 'Revelada' : mine ? 'Oculta' : (t.type === 'bruxa' ? 'Coven' : 'Vila');
  return gcard({ kind: 'trial-' + t.type, title: d.name, sprite: t.type, text: d.desc, type, size, cls: flags, ...rest });
}

export function charCard(id, { size = 'md', copied = null, ...rest } = {}) {
  if (!id) return cardBack('village', { size, ...rest });
  const c = CHARACTERS[id];
  let text = c.desc;
  if (id === 'aprendiz' && copied) text += ` Agora copia: ${CHARACTERS[copied].name}.`;
  return gcard({ kind: 'char', title: c.name, sprite: id, text, type: 'Morador', size, ...rest });
}

export function stackHtml(count, { kind = 'village', size = 'xs', max = 4 } = {}) {
  const k = Math.max(1, Math.min(count, max));
  const backs = Array.from({ length: k }, (_, i) => cardBack(kind, { size, cls: count ? '' : 'ghost', style: `--k:${i}` })).join('');
  return `<span class="stack ${size}" style="--n:${k}">${backs}<b class="stack-n">${count}</b></span>`;
}

// medidor segmentado, estilo barra de vida
export function meterHtml(points, threshold) {
  const segs = Array.from({ length: threshold }, (_, i) => `<i class="${i < points ? 'on' : ''}"></i>`).join('');
  return `<span class="meter" title="${points} de ${threshold} pontos de acusação">${segs}<b>${points}/${threshold}</b></span>`;
}
