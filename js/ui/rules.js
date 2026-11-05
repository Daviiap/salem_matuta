import { CARDS, CHARACTERS, TRIALS, SETUP_TABLE } from '../engine/cards.js';
import { esc } from './dom.js';
import { icon } from './pixel.js';

const item = (id, name, desc, extra = '') => `<li>${icon(id, 'inline')} <b>${esc(name)}</b>${extra}: ${esc(desc)}</li>`;

export function rulesHtml() {
  const cards = Object.entries(CARDS).map(([id, c]) => item(id, c.name, c.desc, ` ×${c.count}`)).join('');
  const chars = Object.entries(CHARACTERS).map(([id, c]) => item(id, c.name, c.desc)).join('');
  const trials = Object.entries(TRIALS).map(([id, c]) => item(id, c.name, c.desc)).join('');
  const table = Object.entries(SETUP_TABLE).map(([n, r]) => `<tr><td>${n}</td><td>${r[1]}</td><td>${r[3]}</td></tr>`).join('');
  return `<div class="rules">
  <h2>${icon('aprendiz', 'inline')} Como jogar o Sabá</h2>
  <p>Há bruxas escondidas entre os vizinhos. Cada pessoa tem um <b>morador</b> público, com uma habilidade, e algumas <b>cartas de equipe</b> secretas, viradas para baixo.</p>
  <ul class="plain">
    <li><b>A Vila vence</b> quando todas as cartas Bruxa em jogo são reveladas.</li>
    <li><b>O Coven vence</b> quando todas as pessoas vivas são da equipe das bruxas.</li>
    <li>Quem recebe uma carta Bruxa entra no coven <b>para sempre</b>, mesmo se perder a carta depois.</li>
  </ul>
  <h3>Sua vez</h3>
  <ul class="plain">
    <li><b>Comprar 2</b> cartas e encerrar a vez, <b>ou</b></li>
    <li><b>Jogar</b> quantas cartas quiser e depois tocar em "Encerrar vez".</li>
    <li>Ninguém pode mirar a si mesmo.</li>
    <li>Qualquer outra pessoa viva pode <b>virar a ampulheta</b> para quem está demorando. Se o tempo acabar antes de a pessoa agir, ela compra 2.</li>
  </ul>
  <h3>Acusações</h3>
  <p>Cartas vermelhas somam pontos diante do alvo. Ao chegar a <b>7</b>, quem fez a acusação escolhe uma carta oculta do alvo para revelar, e as vermelhas vão para o descarte. Se for uma Bruxa, o alvo morre. Se todas as cartas de alguém forem reveladas, essa pessoa também morre.</p>
  <p>Você pode trocar de lugar as suas cartas ocultas (toque em duas) para confundir quem acusa.</p>
  <h3>Alvorada, Eclipse e Meia-Noite</h3>
  <ul class="plain">
    <li><b>Alvorada:</b> no começo, o coven se reconhece e entrega o Corvo Agourento a alguém, que começa a partida.</li>
    <li><b>Eclipse:</b> quem comprou escolhe uma carta de quem tem o Corvo para revelar. Depois, cada pessoa escolhe, às cegas, uma carta de equipe do vizinho seguinte. Quem não escolher em 30 segundos recebe uma carta sorteada.</li>
    <li><b>Meia-Noite:</b> é sempre a última carta do baralho. Tudo acontece de <b>olhos fechados</b>, guiado por sons: <i>badalada grave</i>, todos fecham os olhos (10 s); <i>sino</i>, as bruxas abrem os olhos e escolhem juntas a vítima (até 30 s; sem acordo, o destino sorteia); <i>sino</i>, as bruxas fecham os olhos; <i>coruja</i>, o Caçador abre os olhos e ergue a Lanterna para proteger outra pessoa (até 20 s); <i>coruja</i>, o Caçador fecha os olhos; <i>galo</i>, todos abrem os olhos e podem <b>confessar</b> (revelar uma carta própria) para se salvar. Em seguida, o baralho é refeito.</li>
    <li><b>Alvorada:</b> segue o mesmo ritual: <i>badalada grave</i>, todos fecham os olhos; <i>sino</i>, as bruxas abrem os olhos, se reconhecem e entregam o Corvo Agourento (até 30 s; sem acordo, o destino sorteia); <i>sino</i>, as bruxas fecham os olhos; <i>galo</i>, todos abrem os olhos e começa o dia.</li>
    <li>Por padrão, só o aparelho do anfitrião toca os sons: deixe-o com volume alto, no meio da mesa. Os outros celulares vibram. Durante a noite, todos mexam no celular, para o barulho dos toques não entregar ninguém.</li>
    <li><b>Com moderador</b> não há sinos nem vibração: o moderador anuncia quando cada um fecha e abre os olhos, seguindo o roteiro na tela dele.</li>
    <li>O botão <b>♪</b> liga e desliga o som ambiente. Os efeitos (sino, coruja, galo, risada) continuam sempre ligados.</li>
  </ul>
  <h3>Cartas de equipe</h3><ul>${trials}</ul>
  <table><tr><th>Jogadores</th><th>Bruxas</th><th>Cartas por pessoa</th></tr>${table}</table>
  <h3>Baralho da vila</h3><ul>${cards}</ul>
  <h3>Moradores</h3><ul>${chars}</ul>
  <h3>Leis da vila</h3>
  <ul class="plain">
    <li>Uma carta jogada não volta para a mão.</li>
    <li>Com só 2 pessoas vivas, as cartas azuis saem de jogo.</li>
    <li>Quem morre pode dizer poucas palavras finais na call. Depois, fica em silêncio.</li>
  </ul>
  </div>`;
}
