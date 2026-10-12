# 04 — Desenvolver: as 5 teses, o corte e a vencedora

**Data:** 2026-10-12 · Scorer executável: `scripts/score_theses.py` (rode e a tabela abaixo se reproduz).
Pesos e critérios de morte: `03-define-problems.md` seções 4 e 5. Toda pontuação puxa fonte da evidência —
nada aqui é "achismo pontuado".

## Placar (reproduzível: `python scripts/score_theses.py`)

| # | Tese | Score | Situação |
|---|---|---|---|
| 1 | **T1_prova_primeiro** | **9.12** | **sobrevive** |
| 2 | T4_servico_mcp | 7.02 | sobrevive (vira Fase 3, mesmo juiz) |
| 3 | T5_estudio_multiagente | 6.06 | **morta — K4** (só funciona com escrita paralela multi-agente) |
| 4 | T3_perfil_hermes | 5.78 | **morta — K1** (fork por client, contra o pedido textual) |
| 5 | T2_orquestrador_fino | 5.28 | **morta — K2 e K6** (compete na dimensão do impeccable; refém de terceiro já parado) |

Corte em 6.5; tese morta por K1–K6 sai **agora**, independente do score. T5 tem score OK e ainda assim
morre: a evidência (−70% em tarefa sequencial, 15x tokens, MAST "ganhos frequentemente mínimos") proíbe a
arquitetura, não o objetivo.

## Como cada tese perde (o que isso protege)

- **T5 (estúdio multiagente)** perde por **K4**. Cinco especialistas escrevendo o mesmo artefato é
  exatamente o cenário que a Cognition descreve como frágil (decisões implícitas conflitantes). Multi-agente
  fica **permitido só para ler**: fan-out de descoberta, fan-in determinístico, **um escritor**.
- **T3 (perfil Hermes)** perde por **K1**. É o caminho mais barato que existe (provisionamento já dominado),
  mas `SOUL.md`/`USER.md`/`MEMORY.md` não são lidos por nenhum outro client e **memória não é empacotável
  no padrão**. Copiar a *forma* (distribuição de agente inteiro) — não o *formato proprietário*.
- **T2 (orquestrador fino)** perde por **K2 + K6**. Se o valor é terceirizado, o diferencial vira lista de
  links; e `hallmark` está sem push desde 2026-08-06. Skills de terceiros entram como **conteúdo**, nunca
  como **proposta de valor**.

---

# A VENCEDORA — T1 "Prova Primeiro"

> O agente não vende gosto. Gosto é commodity grátis: impeccable tem 80.181★ e a plataforma entrega design
> no plano Free. O agente vende **prova e rastro**: a entrega sai com um número reproduzível de que é boa,
> e cada escolha visual aponta para a estratégia que a autorizou.

## 1. Arquitetura em uma frase

**Kernel portátil (skill + MCP, o único par que viaja)** + **três detectores bloqueantes** (R1/R2/R3) +
**quatro números publicados** (detector, escape, κ de leigos, invocação/ganho) + **escalonamento por
milestone com gate humano instrumentado** + **zero fan-out de escrita**.

## 2. O que muda de verdade (a inovação não é o "designer", é a prova)

| Peça | O que é | Por que ninguém tem | Fonte |
|---|---|---|---|
| **Juiz determinístico** | `judge/` = 38 tells de slop em regras sobre DOM/CSS, **política de 0 falso positivo** (incerto → `incomplete`, como axe-core) | O gap 4 da frente 2: nenhum publica harness com score reproduzível. impeccable tem 59 regras e **nenhuma acurácia publicada** | axe-core 57%/0 FP; designcourt F1 0.578 vs 0.170 |
| **Painel de leigos com κ** | 3 juízes humanos **não-designers** (o critério do próprio stakeholder: "humano comum julga muito bom e funcional"), artefato **cego A/B**, κ publicado | "Avaliar com humano comum" nunca é instrumentado; WebVoyager mostra que κ=0,70 é atingível com 3 anotadores | Q1 da entrevista; WebVoyager κ=0,70 (75,3% com 1 screenshot) |
| **Pré-registro** | `prereg/benchmark.md` com corpus, métrica, critério de vitória e ameaças à validade escritos **antes** de rodar | Ninguém escreve o que conta como vitória antes de ganhar | `design-canon/BENCHMARK.md` (6 ameaças já declaradas) + SWE-bench post-mortem |
| **Decision-log obrigatório** | nenhum token/fonte/movimento/raio existe sem entrada apontando para uma decisão de estratégia declarada antes; sem rastro → **build falha** | Todos os concorrentes geram output; ninguém ata decisão→fonte | Gap 9 da frente 2 (o espaço vazio literal) |
| **Tetos numéricos** | R3 como configuração versionada: nº de cores, pesos tipográficos, raios, sombras, elementos/tela, duração de animação; estourou → build falha | "Sem excessos" como valor declarado, nunca como verificação | Q4 da entrevista |
| **Gate humano instrumentado** | pacote de aprovação = **ação + escopo + evidência mínima** (nunca transcript), falha fechado, estado serializado; medindo **fila, reprovação e custo por aprovação** | **Nenhuma fonte mediu o custo de um gate humano** — só o padrão de implementação | OpenAI `needs_approval`; LangGraph `interrupt()`; lacuna declarada na frente 4 |

## 3. Estrutura do repositório (o template que vira full-stack)

```
plugin.json                 # Agent Plugins v1.0.0 — o único manifesto portátil
AGENTS.md                   # regras que SEMPRE valem — único canal lido pelos 4 clients
mcp.json                    # portátil; registro por client para placeholders divergentes
skills/
  design-process/           # Descobrir→Definir→Desenvolver→Entregar como procedimentos
  design-system/            # tokens, estados, governança  (superfície escolhida: Q3)
  documentation/            # leitura, hierarquia, densidade (Q3)
  delivery/                 # handoff, specs, checklists (Q3)
  strategy-trace/           # R2: como escrever o decision-log
  anti-slop/                # R1: como rodar o detector e o que fazer com "incomplete"
  motion/                   # reaproveitado (LottieFiles MIT) + fechar o loop até animação executável
  vendor/impeccable/        # Apache-2.0, vendorizado COMPLETO (hoje: 2 de ~24 refs)
  vendor/hallmark/          # MIT — anti-slop (ativo, mas parado desde 2026-08-06)
budgets/caps.yaml           # R3 — tetos numéricos versionados
decision-log/               # R2 — um arquivo por entrega, decisão→fonte
prereg/benchmark.md         # critério de vitória escrito antes de rodar
judge/                      # designcourt promovido a componente (detector + corpus + relatório)
panel/                      # protocolo do painel de leigos + planilha de κ
dist/                       # manifestos por client gerados: .claude-plugin/, .codex-plugin/, .cursor-plugin/
```

**Regra de ouro do template:** trocar `skills/`, `budgets/` e `judge/corpus` → vira agente de outra
disciplina (full-stack, dados, escrita). O **kernel** (gates + prova + gate humano + distribuição) não muda.
Isso é o C4=9: o valor reutilizável não é o conteúdo de design, é a **esteira de prova**.

## 4. Os quatro números publicados (o benchmark é o produto)

Rode sempre com **três baselines**: (a) modelo puro sem agente, (b) site médio da web (mediana do corpus de
48 páginas), (c) impeccable como estado da arte.

| # | Número | Meta | Como se mede | Ameaça à validade (declarada antes) |
|---|---|---|---|---|
| N1 | **F1 do detector** + precisão/recall **por classe** + taxa de escape | F1 ≥ 0.70, escape ≤ 10%, **FP = 0 na política "incomplete"** | corpus de 48 páginas rotuladas por 3 anotadores | overfitting ao corpus; 48 páginas é pouco; corpus em inglês |
| N2 | **κ do painel de leigos** | κ ≥ 0.60 (WebVoyager fez 0,70) | 3 juízes não-designers, A/B cego, Likert | leigo ≠ usuário; n=3 é frágil; A/B vaza ordem (viés de posição medido em >150k instâncias) |
| N3 | **Ganho do painel vs baseline sem-agente** | positivo e reportado com intervalo | mesmo painel, artefato do agente vs artefato do modelo puro | efeito novidade; prompt do baseline pode estar subótimo |
| N4 | **Taxa de invocação da skill** + ganho quando invocada | invocação > 80% (a Vercel mediu **56% de não-invocação**) | telemetria própria local (o canal não dá feedback) | auto-seleção de tarefa; mede uso, não valor |
| N5 | **Gate humano**: tempo de fila, taxa de reprovação, custo por aprovação | publicar a série (sem meta — **ninguém tem linha de base**) | log do gate | n=1 usuário; gate artificialmente rápido por ser o autor |

O que **nunca** entra como métrica: similaridade de texto (associação **negativa** com julgamento humano
medida no Design2Code) e contagem de instalação/estrela (56% nunca invocada).

## 5. Guardas de contexto e orquestração (anti-armadilha)

- **Default single-agent.** Fan-out só para leitura/descoberta; **um escritor** do artefato.
- **Memória = arquivos + índice por metadado** (`decision-log/`, `prereg/`, notas datadas), consultados sob
  demanda — progressive disclosure em 3 níveis, como o Agent Skills já faz. **Vetor só acima de ~120k
  tokens** (abaixo disso a evidência mostra que piora: 300 tokens focados batem 113k de haystack).
- **Estado de tarefa reafirmado a cada milestone** em arquivo (o desempenho decai com a distância causal
  mesmo com contexto completo).
- **Orçamento de esforço em `AGENTS.md`**, não deixado ao modelo (esforço escala com complexidade:
  1 agente/3–10 tool calls para fato simples; 2–4 subagentes para comparação; >10 só em pesquisa complexa).
- **Supervisor leve + condição de parada explícita** — ataca os dois maiores modos de falha medidos
  (loop sem progresso 15,7%, não reconhecer que terminou 12,4%).
- **Perfil de falha instrumentado** com a taxonomia MAST (step repetition, não-reconhecimento de conclusão,
  falha de especificação, derailment) antes de culpar o modelo.

## 6. Degradação graciosa por client (a parte chata que ninguém faz direito)

| Client | O que funciona | O que degrada | Mitigação no pacote |
|---|---|---|---|
| Hermes | skills + `SOUL.md` + distribuição de agente inteiro | nada | oferecer `distribution.yaml` como bônus, não como requisito |
| Claude Code | skills, commands, agents, hooks, MCP, marketplace (`/plugin marketplace add`) | memória | `AGENTS.md` + `CLAUDE.md` como ponte |
| Codex / ChatGPT | `.agents/skills`, plugin portátil, ZIP no diretório | `hooks`, `commands` legados (conversão é lossy) | nada de hooks no caminho crítico; procedure dentro da skill |
| Cursor | Agent Plugins + Cursor Plugins; **lê** `.claude/` e `.agents/` | **não expande `${PLUGIN_ROOT}`** | `mcp.json` declarado por client; nunca assumir placeholder do padrão |

## 7. Fases (o que existe em cada uma)

- **Fase 0 — hoje:** trilha de pesquisa fechada (`docs/research/00–05`), tese escolhida e pontuada.
- **Fase 1 — kernel (fim de semana):** `plugin.json` + `AGENTS.md` + `mcp.json` + skills mínimas
  (`design-process`, `strategy-trace`, `anti-slop`) + `budgets/caps.yaml` + os 3 gates R1/R2/R3 como
  **teste que falha**. Prova de instalação nos 4 clients.
- **Fase 2 — prova (semana):** `judge/` (designcourt promovido) + `prereg/benchmark.md` + `panel/`
  (protocolo + κ) + os 4 números publicados no README com as ameaças à validade ao lado.
- **Fase 3 — alcance:** distribuição (`npx skills add` + `.claude-plugin/marketplace.json` + ZIP OpenAI) e
  T4 (juiz como serviço MCP) reusando **o mesmo juiz**, sem fork.
- **Fora de escopo (declarado):** marketplace, cobrança, painel web, multi-agente de escrita, design
  system de empresa, gerar UI do zero (commodity).

## 8. O que o stakeholder rejeita, e como

Ele aprova/rejeita por **R1/R2/R3 rodando**, não por opinião: se o build passa, o artefato não tem slop
detectável, tem rastro completo e não estourou teto. Se ele discordar do *gosto* (mesmo com R1/R2/R3 ok),
o caminho é editar `budgets/caps.yaml` ou o decision-log — o desacordo vira **configuração**, não
retrabalho de código. E o painel de leigos (N2/N3) é o árbitro que ele pediu: **humano comum julga muito
bom e funcional**.
