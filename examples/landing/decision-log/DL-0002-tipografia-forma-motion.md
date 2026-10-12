---
id: DL-0002-tipografia-forma-motion
decision: "Duas familias, dois pesos, dois raios, duas sombras discretas e duas duracoes de motion."
status: active
strategy_ref: "#p3-provavel"
evidence:
  - "docs/research/02-discover-evidence.md — 816 clusters de skills byte-identicos: excesso tipografico fixa preco no piso"
  - "budgets/caps.yaml — tokens.radii_max 3, tokens.shadows_max 3, tokens.font_weights_max 3"
covers:
  - font.family
  - font.weight
  - radius.tight
  - radius.soft
  - shadow.hairline
  - shadow.lift
  - motion.fast
  - motion.base
affects:
  - design/tokens.json
  - design/styles.css
---

Escolha: Newsreader para titulo, Inter para texto, pesos 400 e 600. Raios de 2px (codigo, chips)
e 6px (blocos). Sombras hairline 0 1px 0 e lift 0 2px 8px, nenhuma com blur acima de 8px.
Motion de 120ms para feedback e 240ms para entrada.

Alternativa descartada: escala tipografica de cinco pesos e raios generosos de 24px para
"parecer amigavel". Barrado pelo portao R3 (over-rounded) e sem justificativa de estrategia.

Criterio de reversao: se um componente precisar de terceiro raio para funcionar, o componente
esta mal resolvido — resolver o componente antes de abrir a escala.
