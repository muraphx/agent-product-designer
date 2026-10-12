# 03 — Definir: do achado ao problema (com critérios de decisão e critérios de morte)

**Data:** 2026-10-12 · Insumos: `00-brief-interview.md`, `01-discover-inventory.md`,
`02-discover-evidence.md`. Aqui a pesquisa para de coletar e começa a **escolher**.

---

## 1. Agrupamento (5 achados → 3 clusters)

**Cluster A — Tudo que existe resolve "gerar", nada resolve "provar"**
- impeccable (80.181★, Apache-2.0) tem **59 regras determinísticas** e nenhuma acurácia publicada.
- `design.md` (Google, 28.350★) é formato + linter, **sem julgamento estético**; impeccable/hallmark têm
  julgamento em **formato proprietário** — nenhum padrão cruzado entre ferramentas.
- Nenhum benchmark público mede "isto é bom design?"; Design2Code mede **fidelidade à referência**
  (79,9% de acurácia preditiva) e WebArena mede **conclusão de tarefa**.
- SWE-bench mostra como benchmark morre: **59,4%** dos problemas auditados com verifier defeituoso,
  **35,5%** com teste estreito que rejeita solução correta, e contaminação.

**Cluster B — O processo de product design está órfão (todos entregam output, ninguém entrega método)**
- Gap declarado: nenhum candidato conduz **descoberta** (entrevista com stakeholder, síntese de pesquisa,
  teste com usuário). impeccable grava "product truth" em `PRODUCT.md` — sem método de pesquisa.
- Motion: o único skill da área **recusa gerar animação**; ninguém fecha o loop até movimento executável.
- Ninguém ata **decisão → fonte**. O agente que só gera não tem como explicar por que escolheu aquele tipo,
  aquele movimento, aquele raio.

**Cluster C — O agente que acumula contexto piora (memória e orquestração são armadilhas)**
- Prompt focado de **300 tokens** bate haystack de **113k tokens** com a mesma informação (18 modelos).
- Memória externa/RAG **não supera** long-context de forma consistente até **~120k tokens** (ICML 2026).
- Multi-agente: **+80,8%** em tarefa decomponível, **−70%** em sequencial; 15x tokens; escrita paralela
  é frágil — o padrão que sobrou é **leitura paralela + escrita single-threaded**.
- Os dois maiores modos de falha em produção são **loop sem progresso (15,7%)** e **não parar (12,4%)**.
- **Nenhuma fonte mediu o custo real de um gate humano** — a parte que o stakeholder mais quer (ele
  aprova) é a menos medida.

---

## 2. Insights (o que só aparece quando os 3 clusters se cruzam)

**I1 — O diferencial não é gosto, é rastro.** Gosto virou commodity grátis: impeccable tem 80k★ e a
plataforma entrega design no plano Free. Um agente que "tem bom gosto" compete com 111.810 skills e 816
clusters byte-idênticos. Um agente que **prova** e **rastreia** compete com ninguém.

**I2 — Provar exige separar detectar de julgar.** Máquina tem autoridade só sobre o determinístico
(axe-core: 57% das issues, 0 falso positivo por rebaixar incerto para `incomplete`). "É bom?" é
julgamento humano — e o ground truth humano é ruidoso (**42%** de recall para um avaliador único). A
saída honesta é a de WebVoyager: **medir o próprio juiz** (κ=0,70 com 3 anotadores) e publicar a
concordância, não a nota.

**I3 — O processo é a peça que ninguém empacotou — e processo é portável.** Como só **skill + MCP** viajam
entre clients, o método tem que virar **skill + arquivos versionados** (`AGENTS.md` para regras que sempre
valem, `SKILL.md` para procedimento, arquivos para estado). Isso não é limitação: é o que faz o mesmo
agente rodar em Hermes, Claude, Codex e Cursor sem fork.

**I4 — O benchmark é parte do produto, não anexo.** O stakeholder pediu "instalador de uma linha +
benchmark público". A evidência dá razão dura a ele: **em 56% dos casos uma skill instalada nunca é
invocada** e não há ganho sobre o baseline; instalação, estrela e badge não medem nada. O benchmark é o
único canal de confiança num mercado onde **36% das skills testadas tinham prompt injection** e faltam
update/uninstall/version-pinning.

**I5 — O agente tem que ser burro de contexto e teimoso de estado.** A memória que ajuda é **arquivo
curado + índice por metadado**, com estado de tarefa reafirmado a cada milestone — porque o desempenho
decai com a distância causal **mesmo com contexto completo**. E o gate humano, que nunca foi medido por
ninguém, tem que virar **instrumento com números próprios** (fila, reprovação, custo por aprovação).

**I6 — As três regras duras do stakeholder são exatamente o produto.** "Sem AI slop / sem decisão sem
estratégia / sem excessos" = detector determinístico + proveniência obrigatória + tetos numéricos. Não
são princípios de gosto; são **verificações bloqueantes**. A intuição de leigo dele acertou o desenho
técnico que a evidência recomenda.

---

## 3. Problema definido (declaração única)

> **Como dar a um agente de product design — rodando no mesmo pacote em Hermes, Claude, Codex/ChatGPT e
> Cursor — uma PROVA REPRODUZÍVEL de que a entrega é boa (separando o que a máquina detecta do que só
> humano julga), com cada decisão de design rastreada a uma estratégia declarada antes, sem que ele vire
> mais um rule-pack de slop e sem que a memória o faça piorar com o tempo?**

Três perguntas "Como poderíamos" derivadas (HMW), em ordem de prioridade:

- **HMW-1 (núcleo):** como tornar o julgamento de qualidade **reproduzível e público** — com o κ do
  próprio juiz exposto, pré-registro antes de rodar, baseline sem-agente e baseline site-médio?
- **HMW-2 (método):** como forçar **estratégia → decisão → artefato** de modo que nenhuma escolha visual
  exista sem rastro, e que o rastro seja legível por um leigo?
- **HMW-3 (sustentação):** como manter o custo de contexto e o risco de orquestração sob controle, com
  **gate humano instrumentado** (ele aprova/rejeita e isso é medido)?

**O que o problema NÃO é** (escopo morto, para não voltar depois):
- não é "gerar UI bonita" (commodity, resolvido);
- não é "ter mais comandos que o impeccable" (24 comandos + 59 regras, 80k★);
- não é "design system da empresa X" (proprietário, Builder.io Enterprise);
- não é "planilha de tokens" (design.md já é isso, e é Apache-2.0);
- não é "marketplace de skills" (111.810 skills, 816 clones byte-idênticos).

---

## 4. Critérios de decisão (pesos justificados pela evidência, não por gosto)

| # | Critério | Peso | Por que esse peso (fonte na evidência) |
|---|---|---|---|
| C1 | **Diferenciação verificável** (existe número medido que concorrente não bate) | **0,22** | Nenhum publica harness com score reproduzível (gap 4 da frente 2); instalação não mede nada (56% nunca invocada) |
| C2 | **Portabilidade real cross-client** | **0,18** | 4 clients, 3 formatos de MCP, placeholders incompatíveis; só skill+MCP viajam (frente 1) |
| C3 | **Reuso ativo do que já existe no disco** | **0,16** | `designcourt` 17/17 testes, corpus 48 páginas, judge F1 0.578 vs 0.170 do impeccable; `frictionmap`; `design-canon` pré-registro |
| C4 | **Escalabilidade do template** (vira agente full-stack trocando skills) | **0,14** | Pedido explícito do stakeholder (Q2) |
| C5 | **Coragem de método** (define processo, não só output) | **0,12** | Gap 1/2/9 da frente 2 — o espaço vazio do alvo |
| C6 | **Custo de construção** | **0,10** | Restrição de tempo real; multi-agente custa 15x tokens |
| C7 | **Risco de dependência** (terceiro quebra → agente morre) | **0,08** | `hallmark` parado desde 2026-08-06; Cursor quebra `mcp.json` do padrão |

**Perguntas decisivas** (o que separa uma tese da outra):
1. A tese produz um número que **ninguém** tem, medido por método auditável?
2. Ela roda **igual** nos 4 clients, ou degrada num deles sem avisar?
3. Ela transforma peça já pronta (designcourt/frictionmap/design-canon) em produto, ou exige reescrever?
4. O stakeholder consegue **rejeitar** com critério explícito (R1/R2/R3), ou ele só "não gostou"?
5. Ela sobrevive quando o modelo por baixo é medíocre?

**Critérios de morte** (kill criteria — se qualquer um bater, a tese está morta):
- **K1** Exige fork de conteúdo por client (contradiz o pedido textual "qualquer outro client").
- **K2** O diferencial é "mais comandos/mais regras" — dimensão onde impeccable já tem 80k★.
- **K3** Não tem baseline sem-agente nem baseline site-médio → não é benchmark, é vitrine.
- **K4** Só funciona com fan-out de escrita multi-agente (evidência: −70% em tarefa sequencial).
- **K5** Memória vetorial como default (<120k tokens, piora o resultado medido).
- **K6** Depende de um único terceiro para funcionar.

---

## 5. Regras duras do stakeholder → verificações obrigatórias

| Regra (dita por ele) | Verificação no produto | Natureza |
|---|---|---|
| R1 — sem AI slop | detector determinístico de tells (gradiente roxo genérico, emoji decorativo, sombra difusa excessiva, contraste insuficiente, `border-radius` aleatório, lorem, hero genérico) com política de **0 falso positivo** (incerto → `incomplete`, como axe-core) | **bloqueante, automático** |
| R2 — sem decisão sem estratégia | todo token/fonte/movimento/raio precisa de entrada no **decision-log** apontando para uma decisão de estratégia declarada **antes**; sem rastro → bloqueio | **bloqueante, automático** |
| R3 — sem excessos | **tetos numéricos** declarados (nº de cores, pesos tipográficos, raios, sombras, elementos por tela, duração de animação); estourou → bloqueio | **bloqueante, automático** |

E o gate humano, que a evidência diz ser o menos medido de tudo, entra como **instrumento**:
pacote de aprovação = **ação + escopo + evidência mínima** (nunca transcript inteiro), falha **fechado**,
estado **serializado** (sobrevive a run longo), e métricas próprias — **tempo de fila, taxa de reprovação,
custo por aprovação**, que nenhuma fonte publica hoje.

---

## 6. Saída desta fase (o que vai para Desenvolver)

Não é uma arquitetura. São **5 teses concorrentes** com pesos, sob C1–C7, sujeitas a K1–K6, medidas por
HMW-1/2/3 e restritas por R1/R2/R3 — materializadas em `04-develop-theses.md`.
