---
id: DL-0001-paleta
decision: "Paleta de dez valores com um unico accent em ochre (#c07a2e), fora da faixa violeta 250-300; tinta/fundo em 15.3:1 e nenhum texto abaixo de 4.5:1."
status: active
strategy_ref: "#p1-problema"
evidence:
  - "docs/research/02-discover-evidence.md — gradiente violeta e o tell mais frequente de UI gerada"
  - "gates/r1-anti-slop.mjs — regra ai-gradient (hue 250-300, sat >= 0.25)"
  - "docs/delivery/phase-2 — auditoria visual: terracota #b4553f media 3.9:1 em texto pequeno e foi trocado por #d98a6b (7.0:1)"
covers:
  - color.bg
  - color.panel
  - color.ink
  - color.muted
  - color.mutedStrong
  - color.rule
  - color.accent
affects:
  - design/tokens.json
  - design/index.html
---

Escolha: fundo quase preto quente (#12110f), painel um degrau acima (#181614), tinta osso (#ece7dd),
secundario em (#9a9083) e um unico accent em ochre (#c07a2e). Contraste tinta sobre fundo em 15.3:1;
muted em 6.0:1; o rodape usa (#a89e8f) em 7.2:1 porque texto de 14.4px em fundo escuro precisa de
mais que o minimo de 4.5:1 para nao cansar.

Alternativa descartada: gradiente violeta de hero. Barrado pela regra ai-gradient do portao R1 — o
mesmo padrao que o campo de anti-slop aponta como assinatura de UI gerada.

Criterio de reversao: se uma segunda cor de marca for necessaria para distinguir dois estados na
mesma tela, reabrir esta decisao em vez de acrescentar um accent.
