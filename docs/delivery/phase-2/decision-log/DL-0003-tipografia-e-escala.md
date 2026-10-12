---
id: DL-0003-tipografia-e-escala
decision: "Duas familias (Newsreader no display, Inter no corpo), tres pesos, dois raios: 2px para chips e code, 6px para painel e tabela."
status: active
strategy_ref: "#p3-provavel"
evidence:
  - "gates/lib/caps.mjs — teto do pacote: 2 familias, 3 pesos, 3 raios por entrega"
  - "docs/research/02-discover-evidence.md — monocultura de peso e raio grande sao tells de UI gerada"
covers:
  - font.family
  - font.weight
  - radius.tight
  - radius.soft
affects:
  - design/tokens.json
  - design/index.html
---

Escolha: serifada (Newsreader) so no display, onde voce le uma frase por tela; Inter no corpo e nas
tabelas, onde se le numero. Pesos 400/500/600; nada de 800-900, que em tela escura engrossa e vira
ruido. Raio 2px em chip e code, 6px em painel e tabela — o suficiente para separar superficie sem
arredondar tudo igual.

Alternativa descartada: familia unica de sans no documento inteiro. Perde a hierarquia que o placar
precisa (titulo de hipotese vs numero medido) e cai no visual de dashboard padrao.

Criterio de reversao: se o documento virar instrumento de leitura rapida em celular, reabrir o par de
familias antes de aumentar o peso do corpo.
