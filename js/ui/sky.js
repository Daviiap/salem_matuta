// Céu de fundo: amarelo no começo do dia, escurecendo até a Meia-Noite.
// dusk: 0 = dia claro, 1 = Meia-Noite.
const STOPS = [
  // posição, topo, meio, horizonte
  [0.00, '#f9d45a', '#fce7a0', '#f3b64a'],
  [0.35, '#f4a841', '#f9c96e', '#e8843a'],
  [0.60, '#d0605a', '#ec8a4c', '#8a3458'],
  [0.80, '#4b2569', '#7b3567', '#3d1d4c'],
  [1.00, '#120a20', '#23123a', '#3a1d4a'],
];
const MIDNIGHT = ['#05040c', '#0b1030', '#141a44'];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const [x, y] = [hex(a), hex(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

function colorsAt(d) {
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, ...c1] = STOPS[i];
    const [p0, ...c0] = STOPS[i - 1];
    if (d <= p1) {
      const t = (d - p0) / (p1 - p0);
      return c0.map((c, k) => mix(c, c1[k], t));
    }
  }
  return STOPS.at(-1).slice(1);
}

let last = null;
export function setSky(dusk, midnight = false) {
  const d = Math.max(0, Math.min(1, +dusk || 0));
  const key = midnight ? 'm' : d.toFixed(3);
  if (key === last) return;
  last = key;
  const [a, b, c] = midnight ? MIDNIGHT : colorsAt(d);
  const st = document.body.style;
  st.setProperty('--sky1', a);
  st.setProperty('--sky2', b);
  st.setProperty('--sky3', c);
  st.setProperty('--dusk', midnight ? 1 : d);
}
