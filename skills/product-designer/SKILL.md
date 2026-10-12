---
name: product-designer
description: Use when the pedido é trabalho de product design — landing, dashboard, fluxo, design system, componente, redesign, ou "faz uma página/interface para X". Ativa o agente product designer completo: processo Double Diamond de pesquisa com portões, três regras duras bloqueantes, memória de decisões via MCP e entrega em artefato que passa nos portões. Não use para implementar uma spec já aprovada sem decisão de design aberta.
license: MIT
compatibility: Roda os portões com Node 22+ (node gates/run.mjs <dir>). Em host sem Node (sandbox do ChatGPT web) use dist/chatgpt/gates.py, port stdlib com paridade provada.
---

# product-designer — o agente, ponto de entrada

Este é o ponto de entrada. Quem carrega esta skill assume o trabalho de product design inteiro, não
um pedaço. Skill carregada e nenhum portão rodado é trabalho não entregue.

## As três regras duras (bloqueantes)

1. **Sem AI slop.** Gradiente roxo-azul, emoji em UI, glow, "catalog phrases", card dentro de card:
   reprova. Se o valor visual não vem de uma decisão escrita, ele não entra.
2. **Sem decisão sem estratégia.** Todo token, cor, tipo e estado aponta para um trecho de
   `strategy.md`. Decisão órfã = rastro quebrado = reprova.
3. **Sem excesso.** O teto numérico (`budgets/caps.yaml`) é o teto: palavras, seções, cores,
   famílias tipográficas, pesos, raios. Passou do teto, reprova.

## Fluxo obrigatório

1. **Descobrir** — evidência com fonte e data, inventário do que já existe. Nada de começar pelo visual.
2. **Definir** — um problema, critério de decisão e critério de morte escritos antes de escolher caminho.
3. **Desenvolver** — no mínimo três teses concorrentes; corte por placar executável, não por gosto.
   O humano aprova a tese.
4. **Entregar** — artefato (+ estratégia, tokens e log de decisões) e veredito dos portões.

A etapa só abre quando a anterior tem arquivo no disco. Detalhe de cada etapa: skill `design-process`.

## Memória: MCP `pd-memory`

Decisão só existe se registrada na ferramenta, não no texto da resposta:

- `record_decision` — exige `id`, `decision`, `strategy_ref`, `evidence[]`. Sem isso a ferramenta
  **recusa**. Use depois de cada escolha de token, cor, tipo ou estado.
- `coverage_gaps` — tokens de `design/tokens.json` que nenhuma decisão ativa justifica. Lista vazia
  é o alvo.
- `read_caps` — o teto numérico corrente, o mesmo que o portão R3 usa.
- `list_decisions` — o que já foi decidido, antes de propor algo novo.

## Antes de dizer que entregou

```
node gates/run.mjs <dir-do-artefato>          # pass | incomplete | fail
python3 dist/chatgpt/gates.py <dir>           # mesmo veredito, sem Node
```

`fail` não é entregável. `incomplete` é dúvida, não aprovação: quem libera é o humano, com o motivo
escrito. O artefato e o PNG abrem no navegador — o humano precisa olhar antes do "pronto".

## Onde isto roda

- **ChatGPT desktop / Codex**: `node install.mjs --client chatgpt` (MCP + skills + AGENTS.md).
- **Claude Code**: `node install.mjs --client claude`.
- **Hermes / qualquer client que leia AGENTS.md**: `node install.mjs --client hermes` ou `agents`.
- **ChatGPT web (sandbox, sem Node)**: port em `dist/chatgpt/`.
