# Agente Product Designer — Double Diamond

**Data:** 2026-10-12 · **Alvo:** `C:/Users/muzph/projetos/agent-product-designer`
**Pedido:** um agente product designer (estratégia, prática, visual, motion, interação) como
assistente único do humano-aprovador, num repositório com template escalável e reproduzível,
com memória, conectores, tools e skills, sozinho ou sob orquestrador, rodando em Hermes,
Claude, ChatGPT e outros clients.

**Output deste processo:** `strategy.html` (artefato no navegador) + este relatório.

---

## Diamante 1 — Descobrir

### Inventário da própria máquina, em quatro estados

Nada aqui é memória: cada linha foi lida no disco hoje.

| Ativo | Estado | Evidência |
|---|---|---|
| `agent-product-designer/IDENTITY.md` (1.6K) + `GATES.md` (1014B) | **works, nunca rodou** | arquivos existem; nenhum client jamais carregou o par |
| `agent.json` (715B) | **dormant** | declara `skills/strategy-jtbd`, `visual-craft`, `motion-physics`, `friction-audit`, `prototype-builder` — **nenhum existe** em disco |
| `connectors/claude/CLAUDE.md`, `connectors/cursor/.cursorrules` | **works parcial** | só ponteiro em texto; `agent.json` promete `hermes` e `chatgpt`, que não existem |
| `skills/impeccable` (13.593 B) | **dormant** | idêntico à cópia Hermes v4.3.1, mas com 2 references de ~25 |
| `skills/hallmark/SKILL.md` (68.018 B) | **dormant** | copiado, sem versão pinada nem lockfile |
| `skills/motion-design/SKILL.md` (12.895 B) | **dormant** | upstream tem 17 arquivos (`director/`, `patterns/`, `reference/`); chegou 1 |
| `memory/taste-profile.json` (1.3K) | **dormant** | nenhum script lê esse arquivo |
| `designcourt` | **works** | 17/17 testes passam hoje; MCP exporta `plan`, `judge`, `decide`; F1 0.578 medido |
| `design-canon` (frictionmap) | **works** | `plugin.json` Agent Plugins + `.claude-plugin/` + `.codex-plugin/` + `marketplace.json` |
| `designkit` | **works** | `DESIGN.md` 17.3K, tokens, gallery |
| evals do próprio agente | **never implemented** | nenhum repo de design roda eval do artefato que o agente produz |
| mesmo agente no ChatGPT | **unsupported hoje** | sem `plugin.json` no formato Agent Plugins não há empacotamento |

### O que as três skills pedidas realmente entregam

- **impeccable** (`npx impeccable install` → `/impeccable init`) — 1 skill, 24 comandos, 59–61
  regras de detector, iteração ao vivo no navegador. Apache 2.0.
- **hallmark** (`npx skills add nutlope/hallmark`) — 21 temas, 4 verbos (build/study/audit/redesign),
  57 gates anti-slop antes de emitir. MIT.
- **motion-design** — 17 arquivos; arquétipos de personalidade de motion (Playful/Premium/Corporate/
  Energetic), 3 pilares, camadas primary/secondary/ambient, checklist de 8 passos. Limitação
  declarada: **não gera código**, só princípios.

As três são o *gosto emprestado*. Nenhuma delas decide nada nem mede a jornada — e é exatamente
aí que estão `designcourt` (decisão + juiz) e `frictionmap` (walker).

### O padrão que faltava

**Agent Plugins 1.0.0** (`agent-plugins.org`, vendor-neutral) empacota *Agent Skills + MCP servers*
no mesmo formato. É o que faz "roda em Hermes, Claude, ChatGPT" ser uma linha de `plugin.json`
em vez de quatro cópias de conteúdo. `frictionmap` já usa esse schema.

---

## Diamante 1 — Definir

**P1 · Design sem decisão é a média do dataset.** Sem uma camada que decida antes, o agente
produz o gradiente roxo com três cards iguais.
**P2 · Gosto sem restrição verificável vira tela plausível.** Sem juiz determinístico não existe
como saber se o agente piorou.
**P3 · O ativo está repartido e nenhum repo é o produto.** Cinco repos bons, um agente inerte.
**P4 · Portabilidade é hoje copiar-e-rezar.** Três clients, três pastas, zero lockfile de versão.
**P5 · Memória decorativa.** `taste-profile.json` existe e ninguém lê: memória sem leitor é enfeite.

**Anti-escopo (o que isto NÃO é):** não é gerador de imagem; não substitui Figma/Maestri; não é
serviço hospedado na v1; não publica sem gate humano; não tenta vender "gosto" sem exemplo anotado.

---

## Diamante 2 — Desenvolver

Cinco teses, sete critérios ponderados, pontuadas por script (`scripts/score_theses.py`):

| # | Tese | Score | O que a define |
|---|---|---|---|
| 1 | **A · plugin-harness** | **8.88** | plugin portátil (Agent Plugins 1.0.0), skill-first, com decisão + juiz + walker próprios |
| 2 | D · mcp design-service | 6.78 | design-decision-as-a-service; ganha alcance, entrega em semanas |
| 3 | E · estúdio multiagente | 6.15 | orquestrador + 5 especialistas; caro de manter, gosto diverge |
| 4 | C · perfil Hermes | 5.96 | barato e verificável por CLI, mas preso a um client |
| 5 | B · orquestrador fino | 5.63 | só aponta para skills de terceiros; sem número próprio, é lista de links |

Corte: **6.5**. Abaixo disso não entra no escopo de agora.

---

## Diamante 2 — Entregar

### A melhor tese: um kernel, um pacote de skills

> Um plugin portátil onde o **kernel** (identidade, gates, memória, evals, adapters de client) é
> fixo e o **pacote de skills** é o que troca. Product designer hoje; agente full-stack amanhã,
> trocando `skills/` e reescrevendo `IDENTITY.md` — sem tocar em kernel, gates ou evals.

**Quatro camadas**

1. **Decidir** — designcourt (`plan`/`judge`/`decide`), antes de escrever código: 38 tells, F1 0.578,
   escape de bloqueadores 6.7% contra 40% do impeccable, 1.5 s.
2. **Produzir** — pacote de skills: estratégia (JTBD, anti-escopo, árvore de métrica), visual
   (impeccable), motion (as 17 referências + física de mola), anticânone (hallmark) e auditoria.
3. **Julgar** — designcourt no artefato HTML/CSS; frictionmap na jornada real (passos, decisões
   por tela, drift de rótulo). É a única camada que mede o que ninguém mede.
4. **Lembrar** — `memory/taste-profile.json` **com leitor**, `decisions/` (ADR de design) e
   `evals/` com 10–15 briefs reais. Sem eval, o agente é opinião com sotaque.

**Portabilidade** — um conteúdo, quatro adapters: Hermes (perfil `--clone` + `SOUL.md`), Claude
(`.claude-plugin/` + marketplace), Codex/ChatGPT (`.codex-plugin/` + zip), Cursor (`.cursorrules`).
Os três primeiros têm código de referência funcionando em `design-canon`.

**Orquestração opcional, não inicial** — solo até os evals ficarem verdes; depois no máximo 3 papéis
(estrategista, craft, auditor) com "arquivos que eu possuo / nunca toco" explícito. Cinco papéis
num pipeline de baixo volume compram deriva, não volume.

**Ordem de execução (a ordem de build não é a ordem de score)**

| Fase | Entrega | Custo |
|---|---|---|
| 0 | `git init`, `agent.json` → `plugin.json` Agent Plugins, `AGENT.md`, corrigir skills fantasma | ½ dia |
| 1 | `skills.lock` + installers pinados (impeccable, hallmark, motion-design completos) | 1 dia |
| 2 | designcourt como decisão+juiz (MCP) e frictionmap como walker pós-render | 1 dia |
| 3 | `evals/`: 10–15 briefs reais, medir escape rate antes/depois | 1 dia |
| 4 | connectors Hermes + Codex/ChatGPT | ½ dia |
| 5 | orquestrador de 3 papéis (só com Fase 3 verde) | depois |

**Métricas de sucesso:** escape de bloqueadores ≤ 10% nos briefs reais; recall ≥ 0.7; tempo
brief → protótipo; % de briefs aprovados no Gate 2 sem retorno; tempo de vida do `taste-profile`
(memória só vale se muda a próxima entrega).

**Riscos, ditos na cara:** o harness eleva o piso, não o teto — convergência barata demais mata a
divergência, então proteja tempo de exploração que o harness não cobre; precisão 0.454 do juiz
gera falso positivo, que vira burocracia; terceiros mudam (impeccable já trocou a contagem de
regras) — daí o lockfile; e "melhor que um leigo" só é medível por proxy, não por genialidade.

**O que ainda não está provado:** nenhum agente aqui já rodou num client real; os 6.7% de escape
são de corpus sintético (39 pares injetados + 8 páginas reais), não de briefs seus; e não existe
ainda um eval de "a decisão de design foi boa", só de "o artefato tem defeito".

---

## Gate de aprovação humana

| Gate | Nome | Status | Decisão |
|---|---|---|---|
| 01 | Enquadramento e anti-escopo | **aguarda** | esta página |
| 02 | Arquitetura do repo + `plugin.json` | bloqueado | — |
| 03 | Direção visual + tokens + memória | bloqueado | — |
| 04 | Protótipo navegável no browser | bloqueado | — |
| 05 | Handoff de produção | bloqueado | — |
