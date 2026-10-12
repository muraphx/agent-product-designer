# 05 — Entregar: plano de materialização da tese vencedora

**Tese:** T1 "Prova Primeiro" (score 9.12, `04-develop-theses.md`).
**Stakeholder:** Murilo Oliveira (@muraphx) — **ele aprova ou rejeita**, no gate dos 3 checks + painel.
**Output desta fase:** artefato no navegador (`strategy.html` + `strategy.png`) e o plano abaixo.

---

## 1. Definição de pronto (acceptance criteria)

A materialização está pronta quando **todos** os itens abaixo forem verdade **verificados por execução**,
não por descrição:

- [ ] **A1 — Portabilidade provada:** o mesmo pacote instalado em **Hermes** e **Claude Code** (mínimo) e
      validado em Codex/ChatGPT e Cursor; `claude plugin validate --strict` passa; a skill instalada aparece
      com `name` + `description` idênticos nos dois. Sem fork de conteúdo.
- [ ] **A2 — R1 bloqueante:** injetar um artefato com gradiente roxo genérico / emoji decorativo / sombra
      difusa / contraste baixo / `border-radius` aleatório → o build **falha** com o tell apontado; e no
      corpus limpo o detector **não** acusa (0 falso positivo; incerto → `incomplete`).
- [ ] **A3 — R2 bloqueante:** apagar uma linha do `decision-log/` de uma entrega → o build **falha**
      ("decisão sem estratégia declarada").
- [ ] **A4 — R3 bloqueante:** subir 1 cor acima do teto em `budgets/caps.yaml` → o build **falha**.
- [ ] **A5 — Números publicados:** N1–N5 de `04-develop-theses.md` §4 no README com corpus, amostra,
      baselines e **ameaças à validade ao lado do número**.
- [ ] **A6 — Degradação declarada:** a matriz §6 do 04 escrita no repo, com o que funciona em cada client.
- [ ] **A7 — Template testado:** trocar `skills/` + `budgets/` + `judge/corpus` por um pacote de outra
      disciplina **sem tocar no kernel** (prova de C4).
- [ ] **A8 — Licença:** **MIT** (é a licença dos repos de skill que viraram produto; os sem-SPDX —
      `anthropics/skills`, `vercel-labs/agent-skills`, `openai/skills` — não monetizam).

## 2. Ordem de execução (crítica: prova antes de gosto)

**Fase 1 — kernel que recusa (fim de semana).**
`plugin.json` + `AGENTS.md` + `mcp.json` + `budgets/caps.yaml` + skills `design-process`,
`strategy-trace`, `anti-slop`. Os gates R1/R2/R3 entram como **teste que falha primeiro**. Prova A1 nos
4 clients. Nada de UI bonita nesta fase.

**Fase 2 — a prova (semana).**
`judge/` promovendo `designcourt` (17/17 testes, corpus 48 páginas) a componente versionado; publicar
N1 com precisão/recall **por classe** e taxa de escape. `prereg/benchmark.md` com vitória escrita antes.
`panel/` com protocolo de A/B cego e κ de 3 juízes leigos. Botar o `frictionmap` como walker da jornada
(método objetivo: passos/decisões/drift — evita o problema do juiz LLM).

**Fase 3 — alcance (semana).**
Publicação: `npx skills add` (78 harnesses), `.claude-plugin/marketplace.json` no repo (nível 1 do
Claude: qualquer repo com esse arquivo já é marketplace), ZIP no diretório OpenAI, README com tabela por
client e uma linha de instalação. Depois T4 (juiz como serviço MCP) reusando o mesmo juiz.

## 3. Riscos vivos (com o que os segura)

| Risco | Evidência que o sustenta | Contenção |
|---|---|---|
| Painel de leigos é caro e ruidoso | avaliador único tem só 42% de chance de achar problema maior; severidade com α≈0 na heurística automática | **n≥3 juízes**, A/B cego, κ publicado como parte do número (não escondido) |
| Detector vira "só sabe ganhar" | "um benchmark que só sabe ganhar é propaganda"; SWE-bench post-mortem: 59,4% de verifier defeituoso | pré-registro + corpus rotulado por 3 pessoas + declarar escape e FP |
| Contaminação do corpus | UIs de referência vêm de fontes públicas (C4); SWE-bench sofreu disso | declarar a ameaça; preferir corpus próprio datado; nunca usar similaridade de texto |
| Memória degrada o resultado | prompt focado de 300 tokens bate haystack de 113k | arquivo + índice por metadado; vetor só acima de ~120k tokens |
| Métrica não prevê uso real | 56% das skills instaladas nunca são invocadas | medir invocação (N4) + ganho quando invocada, com telemetria própria |
| Autor único (bus factor) | repos de skill param (hallmark desde 2026-08-06) | kernel documentado e testado; vendors pinados por versão; gates são testes, não opinião |

## 4. O que eu recuso explicitamente (escopo morto)

Marketplace próprio · cobrança · dashboard web · multi-agente de escrita · design system de empresa ·
"gerar UI bonita do zero" (commodity: impeccable 80.181★, plataforma entrega design no Free) ·
perseguir contagem de comandos/regras (dimensão onde o impeccable já é dono) ·
similaridade de texto como proxy de qualidade (associação negativa medida).

## 5. Trilha de evidência (o Double Diamond inteiro, auditável)

| Fase | Arquivo | O que contém |
|---|---|---|
| Descobrir | `01-discover-inventory.md` | inventário do disco em 4 estados (o que já existe e está desconectado) |
| Descobrir | `02-discover-evidence.md` | 119 achados com fonte, 5 frentes, números preservados |
| Descobrir | `_evidence-raw.json` | payload íntegro (151 KB) — `claim` + `quote` + `source_url` + `confidence` |
| Definir | `03-define-problems.md` | 3 clusters → 6 insights → 1 problema → HMW-1/2/3 → C1–C7, K1–K6, R1–R3 |
| Desenvolver | `04-develop-theses.md` | 5 teses, placar reproduzível, mortes justificadas, arquitetura da vencedora |
| Entregar | este arquivo + `strategy.html` + `strategy.png` | critérios de pronto, ordem de execução, riscos, escopo morto |
| Entrevista | `00-brief-interview.md` | respostas verbatim do stakeholder (evidência primária) |

**Reprodução:** `python scripts/score_theses.py` reconstrói o placar; `_evidence-raw.json` reconstrói todo
número citado em `02`. Se um número não estiver lá, ele não entra no artefato.
