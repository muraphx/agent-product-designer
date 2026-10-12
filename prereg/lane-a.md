# Pré-registro — Lanche A: o detector bate o baseline?

**Escrito em:** 2026-10-12, antes de qualquer execução desta medição.
**Autor:** Murilo Oliveira (@muraphx) — autor do detector **e** anotador do corpus. Ameaça declarada, não escondida.
**Fonte do corpus e do juiz:** `designcourt` @ `d568871` (repositório do próprio autor).
**Regra:** este arquivo é congelado na data acima. Se um número publicado não estiver em
`bench/results/lane-a.json`, ele não entra no README. Se uma hipótese morrer, ela é publicada morta.

---

## 1. Pergunta

Os portões deste repositório (`r1` anti-slop + `r3` tetos) e o juiz determinístico vendorizado
detectam slop **melhor que o baseline**, no mesmo corpus rotulado, de forma reproduzível?

Isto é N1 do plano (`docs/research/04-develop-theses.md` §4): F1 do detector + taxa de escape.

## 2. Hipóteses (escritas antes)

| # | Hipótese | Corte |
|---|---|---|
| **H1** | O juiz tem F1 ≥ 2× o F1 do `impeccable` no mesmo corpus | 2× ou morre |
| **H2** | A taxa de escape de blocker do juiz é ≤ 0,15 | ≤ 0,15 ou morre |
| **H3** | Os portões deste repo têm precisão ≥ 0,80 nos tells que declaram cobrir | ≥ 0,80 |
| **H4** | Duas execuções seguidas produzem o mesmo JSON (sem relógio, sem aleatório) | byte a byte |

**Vitória** = H1 ∧ H2 ∧ H4. **H3 não tem corte de vitória**: o kernel é medido, não defendido —
a cobertura dele é estreita por desenho (ele recusa poucas coisas com certeza mecânica), e publicar
um F1 baixo com cobertura declarada é o resultado honesto, não um fracasso a esconder.

**Condição que mata a tese:** escape do juiz ≥ 0,25 **ou** F1 < 0,40. Nesse caso o repo publica
o número ruim no README e a promessa "melhor que um leigo" fica retirada até haver detector que passe.

## 3. Corpus (congelado)

`bench/corpus/` — 48 páginas, 38 tells distintos, rótulo por `(arquivo, tell)`:

| severidade | páginas |
|---|---|
| clean | 1 |
| minor | 14 |
| major | 18 |
| blocker | 15 |

Rotulado por **1 anotador** (o autor). Sem painel. κ de painel é Fase 2b e **não** está medido aqui.

## 4. Convenções de métrica (congeladas, herdadas de `designcourt/bench/lib/metrics.mjs`)

1. Detecção é por `(arquivo, tell)`: o detector detecta se emite ≥ 1 achado mapeado para aquele tell.
2. `precisão = tp / (tp + fp)`; **0** quando o detector não prevê nada — silêncio nunca pontua melhor
   que ruído.
3. `recall = tp / (tp + fn)` sobre tells com suporte > 0.
4. Média **macro** sobre os tells com suporte > 0, peso igual por tell.
5. **Escape** = arquivos com rótulo `blocker` que a ferramenta classifica como `clean` ou
   `pass_with_notes`, sobre todos os arquivos `blocker`. **Silêncio conta como escape** —
   ferramenta que não diz nada não reportou a ofensa. `incomplete` conta como escape pelo mesmo motivo.
6. Bootstrap com PRNG semeado (`mulberry32`): todo intervalo publicado é reproduzível pela semente.
   Sem `Math.random`, sem relógio, sem formatação dependente de locale.

## 5. Ferramentas na lane (todas declaradas, nenhuma omitida)

| ferramenta | o que é | cobertura declarada |
|---|---|---|
| `kernel` | `gates/run.mjs` (r1 + r3) deste repo | **6 de 38 tells** (tabela item 6) |
| `judge` | `judge/` vendorizado de designcourt @ `d568871` | 38 tells |
| `impeccable` | CLI `impeccable detect` via npx | 5 mapeamentos |
| `gate_baseline` | `designkit/scripts/anti-slop-check.py` (portão legado, pai deste repo) | 7 mapeamentos |

Ferramenta ausente no ambiente = **INDISPONÍVEL** no relatório, nunca um zero inventado.

## 6. Tabela de mapeamento do kernel (congelada antes da execução)

| regra do portão | tell do corpus |
|---|---|
| `ai-gradient` (r1) | `purple-gradient` |
| `decorative-emoji` (r1) | `emoji-as-icon` |
| `glow-shadow` (r1) | `neon-glow` |
| `low-contrast-pair` (r1) | `contrast-aa` |
| `accents` (r3) | `multi-accent` |
| `radii` (r3) | `mixed-radii` |
| `stock-copy`, `centered-everything`, `colors`, `font_families` (r1/r3) | **sem mapeamento** — fica contado como falso positivo se disparar |

Regra de decisão do veredito do kernel por página: qualquer violação → `fail`; só `incomplete` →
`incomplete` (conta como escape); nada → `clean`.

## 7. Ameaças à validade (escritas antes, com o número)

- **Anotador = autor do detector.** Viés de auto-serviço no rótulo. Sem painel cego, o rótulo não é
  independente. É a maior ameaça e não é resolvida por software.
- **Corpus construído pelo autor** (`bench/build-corpus.mjs`), com 1 página limpa contra 47 sujas:
  precisão é instável e a classe `clean` não sustenta intervalo confiável.
- **Rótulo por tell, não por página**: uma página com 6 tells vale 6 no numerador, não 1.
- **`impeccable` via npx**: versão não pinada aqui; o número dele é do ambiente, não do repo.
- **Contaminação**: as páginas de referência derivam de fontes públicas; o juiz nunca viu treino, mas
  as regras foram escritas olhando o corpus. Corpus datado, regras datadas, cutoff declarado.
- **Escape mede blocker**: 15 arquivos. Um arquivo = 6,7 pontos percentuais.

## 8. Reprodução

```bash
node bench/run-lane-a.mjs          # grava bench/results/lane-a.json
node bench/lib/metrics.mjs --self-check
```

Semente do bootstrap: `20261012`. Duas execuções → JSON idêntico (H4).
