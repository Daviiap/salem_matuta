// Dados do jogo "Sabrina": cartas, moradores e tabela de preparação.

export const TRIALS = {
  bruxa:    { name: 'Bruxa', desc: 'Você faz parte do coven, para sempre, mesmo se perder esta carta. Se ela for revelada, você morre.' },
  inocente: { name: 'Inocente', desc: 'Apenas um morador comum.' },
  cacador:  { name: 'Caçador', desc: 'Na Meia-Noite, você ergue a Lanterna para proteger outra pessoa. Se esta carta for revelada, o papel some.' },
};

// [inocentes, bruxas, caçador, cartas por pessoa]
export const SETUP_TABLE = {
  4:  [18, 1, 1, 5],
  5:  [23, 1, 1, 5],
  6:  [27, 2, 1, 5],
  7:  [32, 2, 1, 5],
  8:  [29, 2, 1, 4],
  9:  [33, 2, 1, 4],
  10: [27, 2, 1, 3],
  11: [30, 2, 1, 3],
  12: [33, 2, 1, 3],
};

// targets: 0 = sem alvo, 1 = um alvo, 2 = dois alvos (origem, destino)
export const CARDS = {
  boato:      { name: 'Boato',          color: 'red',   count: 35, pts: 1, targets: 1, desc: '1 ponto de acusação contra alguém.' },
  indicio:    { name: 'Indício',        color: 'red',   count: 5,  pts: 3, targets: 1, desc: '3 pontos de acusação contra alguém.' },
  flagrante:  { name: 'Flagrante',      color: 'red',   count: 1,  pts: 7, targets: 1, desc: '7 pontos de acusação: costuma revelar na hora.' },

  corvo:      { name: 'Corvo Agourento',color: 'blue',  count: 1,  targets: 1, desc: 'Entregue pelo coven na Alvorada. Quando vier o Eclipse, quem tem o Corvo revela uma carta.' },
  circulo:    { name: 'Círculo de Sal', color: 'blue',  count: 1,  targets: 1, desc: 'Protege quem o tem da vítima do coven na Meia-Noite.' },
  amuleto:    { name: 'Amuleto',        color: 'blue',  count: 1,  targets: 1, desc: 'Ninguém pode jogar cartas vermelhas diretamente em quem o tem.' },
  laco:       { name: 'Laço de Sangue', color: 'blue',  count: 2,  targets: 1, desc: 'Liga duas pessoas: se uma morrer, a outra também morre. As duas cartas na mesma pessoa se anulam.' },

  fogueira:   { name: 'Fogueira',       color: 'green', count: 1,  targets: 1, desc: 'O alvo descarta a mão inteira.' },
  quebranto:  { name: 'Quebranto',      color: 'green', count: 1,  targets: 1, desc: 'Descarta uma carta azul na frente de outra pessoa.' },
  maoleve:    { name: 'Mão Leve',       color: 'green', count: 1,  targets: 2, desc: 'Pega a mão inteira de alguém e entrega a uma terceira pessoa.' },
  espantalho: { name: 'Espantalho',     color: 'green', count: 2,  targets: 2, desc: 'Move todas as cartas na frente de uma pessoa para outra.' },
  aguabenta:  { name: 'Água Benta',     color: 'green', count: 3,  targets: 1, desc: 'Remove até 3 pontos de acusação de alguém.' },
  tronco:     { name: 'Tronco',         color: 'green', count: 3,  targets: 1, desc: 'O alvo perde a próxima vez de jogar.' },

  eclipse:    { name: 'Eclipse',        color: 'black', count: 1,  targets: 0, desc: 'Quem tem o Corvo revela uma carta. Depois, cada pessoa pega às cegas uma carta de equipe do vizinho seguinte.' },
  meianoite:  { name: 'Meia-Noite',     color: 'black', count: 1,  targets: 0, desc: 'O coven escolhe uma vítima, o Caçador protege alguém e todos podem confessar.' },
};

export const CHARACTERS = {
  padre:      { name: 'O Padre', desc: 'Indícios jogados contra ele valem 1 ponto, em vez de 3.' },
  parteira:   { name: 'A Parteira', desc: 'Toda vez que uma carta de equipe de outra pessoa é revelada por acusação ou pelo Eclipse, ela compra 1 carta.' },
  ferreiro:   { name: 'O Ferreiro', desc: 'Só revela uma carta com 8 pontos de acusação, em vez de 7.' },
  viuva:      { name: 'A Viúva', desc: 'Fogueira e Mão Leve contra ela não fazem efeito.' },
  coveiro:    { name: 'O Coveiro', desc: 'Quando alguém morre, ele recolhe para a mão as cartas da mão do morto e as azuis na frente dele.' },
  boticario:  { name: 'O Boticário', desc: 'Duas vezes por partida, em vez de comprar, pega até 2 cartas do descarte (exceto pretas). Isso encerra a vez dele.' },
  cartomante: { name: 'A Cartomante', desc: 'Uma vez por partida, antes de agir na sua vez, vê as 5 cartas do topo do baralho e as reordena.' },
  juiz:       { name: 'O Juiz', desc: 'Quando faz a acusação que revela uma carta, pode descartar todas as acusações na frente dele mesmo.' },
  xerife:     { name: 'O Xerife', desc: 'Se ele colocar o 6º ponto em alguém, já revela uma carta.' },
  taberneira: { name: 'A Taberneira', desc: 'Quando faz a acusação que revela uma carta, compra 2 cartas e pode seguir jogando.' },
  lenhador:   { name: 'O Lenhador', desc: 'Se comprar 2 Boatos na mesma compra, mostra os dois e compra mais 1.' },
  sacristao:  { name: 'O Sacristão', desc: 'Uma vez por partida, confessa na Meia-Noite sem revelar nenhuma carta.' },
  costureira: { name: 'A Costureira', desc: 'O Corvo não a faz revelar no Eclipse, e o Laço de Sangue não a afeta.' },
  aprendiz:   { name: 'O Aprendiz', desc: 'Copia a habilidade do primeiro morador vivo antes dele na ordem da mesa. A cópia muda quando alguém morre.' },
  prefeito:   { name: 'O Prefeito', desc: 'Os Boatos que ele joga valem 2 pontos.' },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS);
