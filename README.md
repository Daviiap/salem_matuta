# Sabrina: a vila tem bruxas entre os vizinhos

Jogo de dedução social com bruxas para 4 a 12 pessoas. Cada uma joga no próprio celular, reunidas numa call do Discord ou na mesma sala.
É feito em HTML/CSS/JS puro, sem build e sem dependências, e é hospedado no GitHub Pages.

## Como jogar
1. Uma pessoa abre o site e toca em **Criar sala**. Ela pode marcar "Serei o moderador" para conduzir a partida sem jogar.
2. As outras pessoas entram com o **código de 4 letras** ou pelo link compartilhado.
3. O anfitrião ajusta a ordem da mesa e toca em **Começar**.
4. As regras completas estão no ícone de livro dentro do jogo.

> O aparelho de quem cria a sala roda as regras e **precisa ficar aberto** durante a partida.
> Se ele fechar ou recarregar, basta abrir o site de novo e tocar em **Retomar**, porque o estado fica salvo no navegador.
> Os jogadores que recarregarem a página voltam automaticamente para o mesmo lugar.

## Como funciona a rede
- O GitHub Pages só serve arquivos estáticos. Por isso, as mensagens passam por um **broker MQTT público via WebSocket** (`wss://broker.hivemq.com:8884/mqtt` por padrão, que dá para trocar em Conexão, na tela inicial).
- O navegador do anfitrião é a autoridade: ele aplica as regras e manda a cada pessoa só o que ela pode ver.
- Tudo o que é privado (mão, cartas de equipe, votos da noite) vai **cifrado** com ECDH P-256 e AES-GCM (WebCrypto). Quem escuta o broker público não consegue ler.
- Com moderador, nenhum jogador tem acesso ao estado completo. Sem moderador, o anfitrião joga e, tecnicamente, poderia espiar pelo console do navegador.

## Publicar no GitHub Pages
O repositório já vem com o workflow `.github/workflows/pages.yml`. A cada push na `main`, ele roda os testes e publica o site.
1. No GitHub, abra **Settings → Pages** e, em *Build and deployment → Source*, escolha **GitHub Actions**. Isso só precisa ser feito uma vez.
2. Faça um push na `main`. O jogo fica em `https://<usuario>.github.io/<repo>/`.

Só `index.html`, `css/` e `js/` vão para o site. Os testes e o PDF de referência (ignorado pelo git) ficam de fora.

## Visual
O visual é retrô, todo em pixel art própria. Os sprites estão desenhados como grades de texto em `js/ui/pixel.js`, e os versos das cartas e o céu estrelado são gerados em canvas. Abra `?sprites` para ver a galeria completa.
As fontes são Pixelify Sans e VT323, carregadas do Google Fonts. Sem internet, o jogo usa uma fonte monoespaçada.

## Desenvolvimento
```bash
python3 -m http.server 8000     # abra http://localhost:8000
npm test                        # testes do motor (node --test)
```
- Para testar a interface sozinho, abra `http://localhost:8000/?teste` (ou `?teste=8` para 8 pessoas): a sala inteira roda na aba, bots jogam pelos outros e um painel permite trocar de jogador, puxar a Meia-Noite, dar cartas e tocar os sons.
- Para simular vários jogadores no mesmo navegador, abra abas com `?perfil=1`, `?perfil=2`, etc. Cada perfil tem a própria identidade.
- A WebCrypto exige `https` ou `localhost`. Pelo IP da rede local (`http://192.168…`), o celular não consegue cifrar. Use o GitHub Pages ou um túnel https.

## Estrutura
```
index.html, css/style.css
js/engine/   motor puro: cards.js (dados), setup.js, game.js (regras), view.js (o que cada um vê)
js/net/      mqtt.js (cliente MQTT-over-WebSocket), crypto.js, room.js (anfitrião e cliente)
js/net/testroom.js  sala local do modo de teste (?teste), com bots
js/ui/       pixel.js (sprites em pixel art), dom.js (cartas), game.js (mesa, folhas, moderador), rules.js, audio.js (sons)
js/main.js   telas e eventos
sounds/      gravações dos efeitos sonoros (CC0)
tests/       testes do motor, inclusive 200 partidas aleatórias com bots
```
As cartas, os moradores e a tabela de preparação ficam em `js/engine/cards.js`. Dá para ajustar nomes, quantidades e textos ali.

## Créditos dos sons
Todos em domínio público (CC0), do [Freesound](https://freesound.org). Foram recortados e tiveram o volume ajustado. O som ambiente toca em loop e pode ser silenciado no botão ♪; os efeitos tocam sempre.

| Arquivo | Som original | Autor |
|---|---|---|
| `sounds/sino.mp3` | [Death Knell - Totenglocke](https://freesound.org/people/donStevo/sounds/553299/) | donStevo |
| `sounds/coruja.mp3` | [Owl Hoot](https://freesound.org/people/Breviceps/sounds/465697/) | Breviceps |
| `sounds/galo.mp3` | [Rooster Crow 1](https://freesound.org/people/BenjaminNelan/sounds/435508/) | BenjaminNelan |
| `sounds/risada.mp3` | [Witch's Laugh.wav](https://freesound.org/people/NikoMyth/sounds/348142/) | NikoMyth |
| `sounds/ambiente.mp3` | [Witch forest Atmo](https://freesound.org/people/szegvari/sounds/577936/) (emendado para tocar em loop) | szegvari |
