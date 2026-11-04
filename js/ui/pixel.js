// Pixel art própria do Sabá. Cada sprite é uma grade de caracteres → cores da paleta.
// Sprites com `m: true` guardam só a metade esquerda (8 colunas) e são espelhados.

export const PAL = {
  k: '#1b1224', K: '#08050c', w: '#f7f1e3', W: '#c9c1b4',
  o: '#f28c28', O: '#a8501a', y: '#f7d154', Y: '#c79a2b', f: '#ffb03a',
  r: '#d23c4b', R: '#7d1d2c', p: '#9d5bd2', P: '#4e2a78', v: '#c9a0f0',
  b: '#4b84d8', B: '#23407e', c: '#8fd8f0', g: '#5bb86a', G: '#2b6a3a',
  n: '#8b5a2b', N: '#4a2e16', h: '#f1c27d', H: '#c68e4e', s: '#a9b0bf', S: '#5c6273', m: '#fbeec1',
};

const S = {
  // ---------- baralho da vila ----------
  boato: { rows: [
    '................',
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwwk.',
    'kwwwwwwwwwwwwwwk',
    'kwwwwwwwwwwwwwWk',
    'kwwkkwwkkwwkkwWk',
    'kwwkkwwkkwwkkwWk',
    'kwwwwwwwwwwwwwWk',
    '.kwwwwwwwwwwwWk.',
    '..kkkwwkkkkkkk..',
    '....kwwk........',
    '...kwwk.........',
    '..kwk...........',
    '..kk............',
  ] },
  indicio: { m: true, rows: [
    '........', '.....kkk', '....knnn', '...knnnn', '...knkkn', '...knnnn', '...knnnk',
    '....knnn', '..kkknnn', '.knnnnnr', '.kkkknnn', '....knnn', '....knnk', '....knnk', '....kkkk',
  ] },
  flagrante: { m: true, rows: [
    '........', '........', '........', '...k..k.', '....kkkk', '..kkwwww', '.kwwwwkk', 'kwwwwkbb',
    'kwwwkbbk', 'kwwwkbbk', 'kwwwwkbb', '.kwwwwkk', '..kkwwww', '....kkkk',
  ] },
  corvo: { rows: [
    '................',
    '................',
    '..........kkk...',
    '.........kPPPk..',
    '.........kPyPkoo',
    '.........kPPPkO.',
    '....kkkkkkPPPk..',
    '..kkPPPPPPPPk...',
    '.kPPPvPPPPPPk...',
    'kPPPPvPPPPPk....',
    '.kkPPPPPPPk.....',
    '...kkPPPkk......',
    '.....k.k........',
    '....oo.oo.......',
  ] },
  circulo: { m: true, rows: [
    '........', '.....kkk', '...kkwww', '..kwwWkk', '.kwwkk..', '.kwk....', 'kwwk....', 'kwk.....',
    'kwk.....', 'kwwk....', '.kwk....', '.kwwkk..', '..kwwWkk', '...kkwww', '.....kkk',
  ] },
  amuleto: { m: true, rows: [
    '.s......', '..s.....', '...s....', '....s...', '.....s..', '......kk', '.....kyy', '....kybb',
    '...kybcb', '...kybcb', '...kybbb', '...kybbb', '....kybb', '.....kyy', '......kk',
  ] },
  laco: { m: true, rows: [
    '........', '.......k', '......kr', '......kr', '.....krr', '.....krr', '....krrr', '...krwrr',
    '...krwrr', '..krwrrr', '..krrrrr', '..krrrrr', '...krrrr', '....kRRR', '.....kkk',
  ] },
  fogueira: { m: true, rows: [
    '........', '.......k', '......ko', '......ko', '.....koo', '..k..koo', '.kok.koy', '.kookooy',
    '.koooooy', 'koooooyy', 'kooooyyy', 'koooyyyy', '.koooyyy', '..kooooo', '.NnNnNnN', '.kkkkkkk',
  ] },
  quebranto: { rows: [
    '................',
    '............y...',
    '...........yWy..',
    '............y...',
    '.........kk.....',
    '........kpk.....',
    '.......kPk......',
    '......kPk.......',
    '................',
    '....kk..........',
    '...kPk...y......',
    '..kPk...yWy.....',
    '.kPk.....y......',
    '.kk.............',
  ] },
  maoleve: { rows: [
    '................',
    '.....k.k.k.k....',
    '....khkhkhkhk...',
    '....khkhkhkhk...',
    '....khkhkhkhk...',
    '.kk.khhhhhhhk...',
    'khhkkhhhhhhhk...',
    '.khhhhhhhhhhk...',
    '..khhhhhhhhhk...',
    '...khhhhhhhk....',
    '...khhhhhhHk....',
    '....khhhhHk.....',
    '....kPPPPk......',
    '....kPvPPk......',
    '....kkkkkk......',
  ] },
  espantalho: { m: true, rows: [
    '......kk', '......kG', '..kkkkkG', '.koooOoo', 'kooOooOo', 'kooykooo', 'koyyykoo', 'kooooooo',
    'kooyoyoy', 'koyyyyyy', '.kooyyyy', '..kkkkkk', 'nnnnnnnN', '......kN', '......kN', '......kk',
  ] },
  aguabenta: { m: true, rows: [
    '........', '......kk', '.....knn', '.....knn', '......kk', '......kb', '.....kbb', '....kbbb',
    '...kbcbw', '..kbcbbw', '..kbcwww', '..kbbbbw', '..kbbbbw', '...kbbbb', '....kkkk',
  ] },
  tronco: { m: true, rows: [
    '........', '........', 'kkkkkkkk', 'knnnnnnn', 'knnNnnnn', 'knKKnnKK', 'kkKKkkKK', 'knKKnnKK',
    'knnnnnnn', 'kkkkkkkk', '...kNk..', '...kNk..', '...kNk..', '..kNNNk.', '.kkkkkkk',
  ] },
  eclipse: { m: true, rows: [
    '........', '.....kkk', '...kkyyy', '..kyyPPP', '.kyPPPPP', '.kyPPPPP', 'kyPPPPPP', 'kyPPPPPP',
    'kyPPPPPP', 'kyPPPPPP', '.kyPPPPP', '.kyPPPPP', '..kyyPPP', '...kkyyy', '.....kkk',
  ] },
  meianoite: { m: true, rows: [
    '........', '.....kkk', '...kkmmm', '..kmmmmm', '.kmmYmmm', '.kmYYmmm', 'kmmmmmmm', 'kmmmmmYm',
    'kmmmmYYm', 'kmmmmmmm', '.kmmYmmm', '.kmmmmmm', '..kmmmmm', '...kkmmm', '.....kkk',
  ] },

  // ---------- cartas de equipe ----------
  bruxa: { m: true, rows: [
    '.......k', '......kP', '......kP', '.....kPP', '.....kPP', '....kPPP', '....kPPP', '...kyyyy',
    '...kPPPP', 'kkkkPPPP', 'kPPPPPPP', '.kkkkkkk', '...kgggg', '...kgkgg', '....kggg', '.....kkk',
  ] },
  inocente: { m: true, rows: [
    '.......k', '......ky', '......ky', '.....kyf', '......kf', '......kN', '....kkkk', '....kwww',
    '....kwww', '....kwww', '....kwwW', '....kwwW', '....kwwW', '..kkkkkk', '..kYyyyy', '...kkkkk',
  ] },
  cacador: { m: true, rows: [
    '.....kkk', '....k...', '....k...', '...kkkkk', '..kSSSSS', '..ksyyyy', '..ksyfff', '..ksyfoo',
    '..ksyfoo', '..ksyfff', '..ksyyyy', '..kSSSSS', '...kkkkk', '....kSSS', '.....kkk',
  ] },

  // ---------- moradores ----------
  padre: { m: true, rows: [
    '......kk', '.....kyy', '.....kyy', '..kkkkyy', '.kyyyyyy', '.kYYYYyy', '..kkkkyy', '.....kyy',
    '.....kyy', '.....kyy', '.....kyy', '.....kYy', '.....kYY', '......kk',
  ] },
  parteira: { m: true, rows: [
    '........', '........', '.....kkk', '....kwww', '...kwkhh', '...kwhhh', '...kwhkh', '...kwhhh',
    '..kccwww', '.kcccccc', '.kccWccc', '.kcccccc', '..kccccc', '...kcccc', '....kkkk',
  ] },
  ferreiro: { m: true, rows: [
    '........', '..y.....', '.yWy....', '..y.....', '........', '........', 'kkkkkkkk', 'kSSSSSSs',
    '.kSSSSSS', '..kkSSSS', '....kSSS', '....kSSS', '...kSSSS', '..kSSSSS', '..kkkkkk',
  ] },
  viuva: { m: true, rows: [
    '........', '........', '........', '..kkkk..', '.kPPPPk.', 'kPvPPPPP', 'kPvPPPPP', 'kPPPPPPP',
    '.kPPPPPP', '..kPPPPP', '...kPPPP', '....kPPP', '.....kPP', '......kP', '.......k',
  ] },
  coveiro: { m: true, rows: [
    '........', '........', '....kkkk', '...kSSSS', '..kSsSSS', '..kSsSSk', '..kSsSkk', '..kSsSSk',
    '..kSsSSk', '..kSsSSS', '..kSsSSS', '..kSSSSS', '.kkkkkkk', 'kGgGgGgG', 'kkkkkkkk',
  ] },
  boticario: { m: true, rows: [
    '......kk', '.....knn', '......kk', '......kw', '......kw', '.....kgg', '...kkggg', '..kgggwg',
    '.kggwggg', '.kgggggg', '.kgGgggg', '.kgggggg', '..kgGGgg', '...kkkkk',
  ] },
  cartomante: { m: true, rows: [
    '........', '.....kkk', '...kkvvv', '..kvwvvv', '.kvwvvvv', '.kvvvvpv', '.kvvvpvv', '.kvvvvvv',
    '..kvvvvv', '...kkppp', '....kkkk', '...kYyyy', '..kYyyyy', '..kkkkkk',
  ] },
  juiz: { m: true, rows: [
    '........', '.......k', '......ky', '.kkkkkyy', '.yyyyyyy', '.k....ky', 'k.k...ky', 'k..k..ky',
    'kkkkk.ky', '.kYk..ky', '......ky', '......ky', '....kkyy', '...kyyyy', '...kkkkk',
  ] },
  xerife: { m: true, rows: [
    '........', '.......k', '......ky', '......ky', '.....kyy', 'kkkkkkyy', '.kyyyyyy', '..kyyyyy',
    '...kyyYy', '...kyyyy', '..kyyykk', '..kyykk.', '.kykk...', '.kk.....',
  ] },
  taberneira: { rows: [
    '................',
    '..kkkkkkkk......',
    '.kwwWwwWwwk.....',
    '.kwwwwwwwwk.....',
    '.kkyyyyyykkkk...',
    '..kyyyyyyk..kk..',
    '..kyyyyyyk...k..',
    '..kyYyyyyk...k..',
    '..kyYyyyyk...k..',
    '..kyYyyyyk..kk..',
    '..kyyyyyykkkk...',
    '..kyyyyyyk......',
    '..kkkkkkkk......',
  ] },
  lenhador: { rows: [
    '................',
    '................',
    '.........kkk....',
    '........kssskk..',
    '.......kssssssk.',
    '......knkssssWk.',
    '.....knk.kssWk..',
    '....knk...kkk...',
    '...knk..........',
    '..knk...........',
    '.knk............',
    'knk.............',
    'kk..............',
  ] },
  sacristao: { m: true, rows: [
    '........', '.......k', '......kY', '.....kyy', '....kyyy', '....kyWy', '...kyWyy', '...kyWyy',
    '...kyyyy', '..kyyyyy', '.kyyyyyy', 'kYYYYYYY', 'kkkkkkkk', '......ky', '.......k',
  ] },
  costureira: { m: true, rows: [
    '........', '........', '.kkkkkkk', '.knnnnnn', '..kkkkkk', '...krrrr', '...kRrrr', '...krRrr',
    '...krrRr', '...krrrR', '...krrrr', '..kkkkkk', '.knnnnnn', '.kkkkkkk',
  ] },
  aprendiz: { m: true, rows: [
    '........', '........', '........', '..kkk...', '.kwwwkk.', 'kwkkwwwk', 'kwwwkkwk', 'kwkkwwwk',
    'kwwwkkwk', 'kwkkwwwk', 'kwwwwwwk', 'kkkkwwwk', 'kBBBkkwk', '.kkkBBkk',
  ] },
  prefeito: { m: true, rows: [
    '........', '..kkkkkk', '..kKKKKK', '..kKPKKK', '..kKPKKK', '..kKPKKK', '..kKKKKK', '..krrrrr',
    '..kKKKKK', 'kkkKKKKK', 'kKKKKKKK', '.kkkkkkk',
  ] },

  // ---------- interface ----------
  abobora: { m: true, rows: [
    '......kk', '......kG', '..kkkkkG', '.koooOoo', 'kooOooOo', 'kooykooo', 'koyyykoo', 'kooooooo',
    'kooyoyoy', 'koyyyyyy', '.kooyyyy', '..kkkkkk',
  ] },
  sol: { m: true, rows: [
    '.......y', '.y.....y', '..y.....', '.....kkk', '....kyyy', '...kyyyy', '...kyyyy', 'yy.kyyyy',
    '...kyyyy', '...kyyyy', '....kyyy', '.....kkk', '..y.....', '.y.....y', '.......y',
  ] },
  caveira: { m: true, rows: [
    '........', '........', '....kkkk', '..kkwwww', '.kwwwwww', '.kwwwwww', 'kwwkkkww', 'kwwkkkww',
    'kwwwwwkw', '.kwwwwkk', '..kkwwww', '...kwkwk', '...kkkkk',
  ] },
  ampulheta: { m: true, rows: [
    '........', '.kkkkkkk', '.knnnnnn', '..kwwwww', '..kwyyyy', '...kwyyy', '....kwyy', '.....kwy',
    '.....kwy', '....kwwy', '...kwwwy', '..kwwyyy', '..kwyyyy', '.knnnnnn', '.kkkkkkk',
  ] },
  casa: { m: true, rows: [
    '........', '.......k', '......kr', '.....krr', '....krrr', '...krrrr', '..krrrrr', '.kkkkkkk',
    '..kWwwww', '..kWwwww', '..kkkwkk', '..kykwkn', '..kkkwkn', '..kWwwkn', '..kWwwkn', '..kkkkkk',
  ] },
  trofeu: { m: true, rows: [
    '........', '.kkkkkkk', 'kykyyyyy', 'kykyyyyy', '.kkyyyyy', '..kyyyyy', '...kyyyy', '....kyyy',
    '.....kyy', '......ky', '.....kYY', '....kyyy', '...kkkkk',
  ] },
  morcego: { m: true, rows: [
    '........', '........', '........', 'k.......', 'kk....k.', 'kkk...kk', 'kkkk.kkk', 'kkkkkkrk',
    '.kkkkkkk', '..k.kkkk', '......kk',
  ] },
};

const cache = new Map();

function grid(id) {
  const sp = S[id];
  if (!sp) return null;
  const rows = sp.rows.map((r) => (sp.m ? r.padEnd(8, '.').slice(0, 8) + [...r.padEnd(8, '.').slice(0, 8)].reverse().join('') : r.padEnd(16, '.').slice(0, 16)));
  while (rows.length < 16) rows.push('.'.repeat(16));
  // centraliza verticalmente
  const filled = rows.map((r) => /[^.]/.test(r));
  const top = filled.indexOf(true), bot = filled.lastIndexOf(true);
  const h = bot - top + 1, pad = Math.floor((16 - h) / 2);
  const out = Array(16).fill('.'.repeat(16));
  for (let i = 0; i < h; i++) out[pad + i] = rows[top + i];
  return out;
}

export function spriteUrl(id) {
  if (cache.has(id)) return cache.get(id);
  const g = grid(id);
  if (!g) return '';
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  const ctx = cv.getContext('2d');
  g.forEach((row, y) => [...row].forEach((ch, x) => {
    if (PAL[ch]) { ctx.fillStyle = PAL[ch]; ctx.fillRect(x, y, 1, 1); }
  }));
  const url = cv.toDataURL();
  cache.set(id, url);
  return url;
}

export const hasSprite = (id) => !!S[id];
export const spriteIds = () => Object.keys(S);

export function icon(id, cls = '') {
  return `<img class="px ${cls}" src="${spriteUrl(id)}" alt="" draggable="false">`;
}

// ---------- texturas geradas: versos das cartas, céu estrelado, favicon ----------
function drawSprite(ctx, id, ox, oy, scale = 1) {
  const g = grid(id);
  g.forEach((row, y) => [...row].forEach((ch, x) => {
    if (PAL[ch]) { ctx.fillStyle = PAL[ch]; ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale); }
  }));
}

function backUrl({ bg, bg2, line, emblem }) {
  const W = 40, H = 56;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  // losangos pontilhados
  c.fillStyle = bg2;
  for (let y = 4; y < H - 4; y += 4) for (let x = 4 + ((y / 4) % 2) * 2; x < W - 4; x += 4) c.fillRect(x, y, 1, 1);
  // moldura dupla
  c.fillStyle = line;
  c.fillRect(2, 2, W - 4, 1); c.fillRect(2, H - 3, W - 4, 1); c.fillRect(2, 2, 1, H - 4); c.fillRect(W - 3, 2, 1, H - 4);
  for (let x = 5; x < W - 5; x += 2) { c.fillRect(x, 4, 1, 1); c.fillRect(x, H - 5, 1, 1); }
  for (let y = 5; y < H - 5; y += 2) { c.fillRect(4, y, 1, 1); c.fillRect(W - 5, y, 1, 1); }
  // cantos
  for (const [x, y] of [[6, 6], [W - 9, 6], [6, H - 9], [W - 9, H - 9]]) { c.fillRect(x + 1, y, 1, 3); c.fillRect(x, y + 1, 3, 1); }
  // medalhão
  c.fillStyle = bg;
  c.fillRect(10, 18, 20, 20);
  c.fillStyle = line;
  c.fillRect(11, 17, 18, 1); c.fillRect(11, 38, 18, 1); c.fillRect(9, 19, 1, 18); c.fillRect(30, 19, 1, 18);
  c.fillRect(10, 18, 1, 1); c.fillRect(29, 18, 1, 1); c.fillRect(10, 37, 1, 1); c.fillRect(29, 37, 1, 1);
  drawSprite(c, emblem, 12, 20);
  return cv.toDataURL();
}

function starsUrl() {
  const N = 96;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const c = cv.getContext('2d');
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * N), y = Math.floor(r() * N);
    c.fillStyle = r() < 0.2 ? '#f7d154' : r() < 0.5 ? '#c9a0f0' : '#6d5a92';
    c.fillRect(x, y, 1, 1);
    if (r() < 0.12) { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); }
  }
  return cv.toDataURL();
}

export function installPixelAssets() {
  const root = document.documentElement.style;
  root.setProperty('--back-village', `url(${backUrl({ bg: '#3a1f5c', bg2: '#5b3a86', line: '#f7d154', emblem: 'meianoite' })})`);
  root.setProperty('--back-trial', `url(${backUrl({ bg: '#4a1424', bg2: '#7d2a3c', line: '#f7d154', emblem: 'flagrante' })})`);
  root.setProperty('--stars', `url(${starsUrl()})`);
  const link = document.querySelector('link[rel=icon]') || Object.assign(document.createElement('link'), { rel: 'icon' });
  link.href = spriteUrl('abobora');
  document.head.appendChild(link);
}
