---
name: design-process
description: Use when starting, resuming or reviewing any product design task — page, landing, dashboard, flow, design system, component, redesign. Runs the four gated stages of the research Double Diamond (Descobrir, Definir, Desenvolver, Entregar), forces written strategy before any visual work, and refuses to advance a stage whose gate is red. Not for implementing an already approved spec with no design decisions left.
license: MIT
compatibility: Requires Node 22+ to run the gates (node gates/run.mjs <dir>) and git for history.
---

# design-process — o processo, com portões

Processo de **pesquisa** aplicado a design. Não é estrutura de agente, não é organograma: é a
sequência obrigatória que transforma pedido vago em artefato defensável.

Regra central: **etapa só abre quando a anterior tem artefato no disco.** Sem isso, o agente
produz opinião com estética — que é exatamente o que este repo existe para evitar.

## Etapa 1 — Descobrir

Objetivo: evidência, não impressão.

- Enunciar o pedido literal do humano e o que ele quer do resultado (usar as palavras dele).
- Inventariar o que já existe no disco antes de propor qualquer coisa: estado real, tamanho,
  hash. Esqueleto que promete o que não tem é achado, não base.
- Buscar evidência externa com fonte e data. Cada achado carrega `claim` + `quote` + `url` +
  confiança. Achado sem fonte não entra.
- Preferir leitura paralela (vários leitores) e nunca escrita paralela.
- Saída: `docs/research/01-discover-*.md` + `docs/research/_evidence-raw.json`.

Não começar por visual. Não começar por framework.

## Etapa 2 — Definir

Objetivo: virar problema decidível.

- Agrupar achados em clusters; extrair insights; escolher **um** problema.
- Escrever o critério de decisão e o **critério de morte** antes de escolher qualquer caminho.
- Toda hipótese entra com o teste que a derruba. Se nada pode derrubá-la, ela é fé.
- Saída: `docs/research/03-define-*.md`.

## Etapa 3 — Desenvolver

Objetivo: teses concorrentes e um corte que não depende de gosto.

- No mínimo três teses, escritas com o mesmo nível de esforço.
- Placar executável por script versionado (`scripts/score_*.py` ou `.mjs`), com pesos
  rastreáveis à evidência da etapa 1. Escolher por execução, não por preferência.
- Toda tese perdedora tem causa da morte registrada.
- Saída: `docs/research/04-develop-*.md` + script do placar.

## Etapa 4 — Entregar

Objetivo: artefato que existe e passa nos portões.

- Tokens nomeados + `decision-log/DL-*.md` cobrindo cada token (gate `r2`).
- Artefato executável que abre sem erro.
- `node gates/run.mjs <alvo>` sem `fail` (gates `r1`, `r2`, `r3`).
- Número medido ao lado de qualquer alegação de melhoria, com a ameaça à validade escrita.
- Saída: artefato + `docs/research/05-deliver-*.md` + relatório dos portões.

## Gates e gate humano

```
node gates/run.mjs <dir>            # r1, r2, r3 — falha o processo se houver fail
node gates/run.mjs <dir> --strict   # incomplete também derruba
```

- `pass` — segue.
- `incomplete` — segue **reportando**; a incerteza chega ao humano, nunca é escondida.
- `fail` — **entrega recusada**. Corrigir a causa, não o relatório.

Decisão irreversível, escolha de posicionamento e publicação passam pelo humano. O agente prepara; o
humano aprova. O agente nunca escreve "aprovado" no lugar dele.

## Antipadrões que este processo mata

- Visual antes de estratégia.
- Escolher caminho por gosto e depois inventar justificativa.
- Métrica inventada ou benchmark que "só sabe ganhar".
- Memória que nenhum client lê.
- Cópia parcial de skill de terceiro apresentada como instalação completa.
- Paralelismo de escrita para parecer rápido.
