---
name: anti-slop
description: Use before delivering any visual artifact and when auditing existing UI — pages, landing pages, dashboards, components, marketing sites. Detects machine-generated design tells (AI gradient, decorative emoji, glow shadows, stock copy, over-rounded, centered-everything), enforces the numeric budget caps, and refuses delivery when a tell is certain. Not for judging taste without evidence.
license: MIT
compatibility: Requires Node 22+ to run gate r1/r3 (node gates/run.mjs <dir>).
---

# anti-slop — sem slop, sem excesso (R1, R3)

Slop não é feiúra. Slop é **default de máquina**: o que um modelo produz quando ninguém decidiu
nada. Por isso é detectável por regra mecânica — e por isso o portão é código, não opinião.

## Tells que o portão `r1` marca como `fail` (certeza mecânica)

| Tell | Detecção | Por que é slop |
|---|---|---|
| `ai-gradient` | stop de gradiente com hue em 250–300 e saturação alta | assinatura de default de LLM |
| `decorative-emoji` | emoji em texto visível de artefato de produto | enfeite substituindo decisão |
| `glow-shadow` | `box-shadow` com blur ≥ 24px ou padrão `0 0 Npx` | profundidade fingida |
| `stock-copy` | frases de catálogo ("elevate your", "seamlessly", "unlock the power", "cutting-edge", "game-changer", lorem ipsum) | texto que não diz nada |
| `low-contrast-pair` | par texto/fundo declarado nos tokens com razão WCAG < 4.5 | inacessível por descuido |
| `over-rounded` | mais de um raio ≥ 24px distinto em container grande | "amigável" automático |
| `rainbow-palette` | mais de 12 cores ou mais de 1 accent nos tokens | ausência de hierarquia |
| `hero-slop-grid` | 3 irmãos com dimensões idênticas e mesmo conteúdo genérico | template |

## Tells que o portão marca como `incomplete` (sem certeza)

- Texto centralizado em 40–60% dos blocos (acima de 60% vira `fail`; abaixo de 40% é normal).
- Três cards iguais **sem** conteúdo genérico — pode ser padrão legítimo.
- Densidade de elementos por seção entre 14 e 20.
- Animação declarada sem duração em token.

`incomplete` **não** derruba a entrega: ele viaja no relatório e chega ao humano. Portão que finge
certeza é o problema que este repo combate.

## Teto numérico (gate `r3`)

`budgets/caps.yaml` é a fonte. Mudar um teto é uma decisão: exige `decision-log/DL-*.md` e bump de
`version` no arquivo. O agente não afrouxa teto para passar. Nunca.

Contagens medidas: cores, accents, famílias, pesos, raios, sombras, durações, seções, elementos por
seção, palavras, frases de catálogo, tokens sem cobertura.

## Comportamento obrigatório

- Tell certo detectado → **recusa entregar** e diz qual regra, qual arquivo, qual linha, qual
  evidência. Recusar é a resposta correta.
- Sem certeza → entrega com `incomplete` declarado.
- Não conseguiu rodar o portão → diz que não conseguiu. Nunca afirma "passou" sem exit code.
- Corrigir a causa, nunca o relatório. Desativar regra para passar é a única falha irreversível.
- Zero falso positivo: preferir `incomplete` a acusar errado. Um portão que acusa inocente é
  desligado pela equipe na terceira vez — e aí não protege nada.

## Uso

```
node gates/run.mjs <dir>            # relatório humano
node gates/run.mjs <dir> --json     # relatório máquina (achado com arquivo, linha, evidência)
```

Regra de ouro: **o agente não assina o que não pode provar.** Sem medição, escreve "não medido".
