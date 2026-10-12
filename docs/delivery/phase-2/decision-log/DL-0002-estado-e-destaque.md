---
id: DL-0002-estado-e-destaque
decision: "Tres cores fora da paleta base, todas semanticas: ok (#7d9a5b), bad (#b4553f) e row (#1d1a17) para a linha do proprio juiz no placar."
status: active
strategy_ref: "#p2-criterio-de-morte"
evidence:
  - "prereg/lane-a.md — hipoteses H1-H4 tem veredito confirmada/refutada, e o veredito precisa cor"
  - "bench/results/lane-a.json — escape, precisao e F1 sao os numeros que decidem a fase"
  - "gates/lib/caps.mjs — teto de cores do pacote (r3), hoje 12"
covers:
  - color.ok
  - color.bad
  - color.row
affects:
  - design/tokens.json
  - design/index.html
---

Escolha: verde para hipotese confirmada, terracota para refutada e um fundo levemente elevado para
destacar a linha do juiz deterministico contra os tres outros detectores. As tres sao semanticas, nao
decorativas: sem elas o leitor nao distingue o que passou do que falhou no placar.

Alternativa descartada: pintar a tabela inteira de verde no veredito geral. Isso transforma o
relatorio em propaganda — o mesmo defeito que a fase 2 existe para medir.

Criterio de reversao: se um quarto estado aparecer (por exemplo "inconclusivo"), reabrir a decisao em
vez de reaproveitar ok/bad com outra carga.
