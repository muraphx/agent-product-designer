---
id: DL-0001-paleta
decision: "Paleta de sete valores com um unico accent em ochre (#c07a2e), fora da faixa violeta 250-300."
status: active
strategy_ref: "#p1-problema"
evidence:
  - "docs/research/02-discover-evidence.md — gradiente violeta e o tell mais frequente de UI gerada"
  - "gates/r1-anti-slop.mjs — regra ai-gradient (hue 250-300, sat >= 0.25)"
covers:
  - color.bg
  - color.surface
  - color.ink
  - color.muted
  - color.rule
  - color.accent
  - color.ink-on-accent
affects:
  - design/tokens.json
  - design/styles.css
---

Escolha: fundo quase preto quente (#0f0e0c), tinta osso (#ece7dd) e um unico accent em ochre
(#c07a2e). Contraste de tinta sobre fundo em 12.6:1; muted em 5.1:1 (acima do 3:1 exigido
para texto secundario).

Alternativa descartada: gradiente violeta de hero. Barrado pela regra ai-gradient do portao R1,
que e exatamente o padrao que o campo de anti-slop aponta como assinatura de UI gerada.

Criterio de reversao: se o accent precisar distinguir dois estados diferentes na mesma tela,
reabrir esta decisao em vez de adicionar uma segunda cor de marca.
