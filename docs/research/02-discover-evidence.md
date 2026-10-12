# 02 — Descobrir: evidência externa (5 frentes, 119 achados com fonte)

**Data:** 2026-10-12 · **Método:** fan-out de 5 subagentes de pesquisa (leitura + curl, sem browser),
`docs/research/_evidence-raw.json` guarda o payload íntegro (151 KB) com `claim`, `quote`,
`source_url`, `confidence` de cada achado. Este arquivo é a síntese **com os números preservados** —
toda afirmação abaixo tem fonte no JSON.

Legenda de confiança: **alta** = fonte primária lida na data · **média** = fonte secundária,
cache ou não replicada.

---

## Frente 1 — Empacotamento multi-client (39 achados, `capability_matrix` de 7 clientes)

### O que é portável de verdade

| Camada | Padrão / mecanismo | Portabilidade |
|---|---|---|
| Skill | **Agent Skills** (`agentskills.io`): diretório com `SKILL.md` | **Universal** — 44 clients compatíveis, incl. Claude Code, Codex/ChatGPT, Cursor, Hermes |
| Plugin | **Agent Plugins Spec v1.0.0** (`agent-plugins.org`): `plugin.json` + `skills/` + `mcp.json` | **Universal, mas só 2 componentes**: skill e MCP server |
| Memória / rules / hooks / subagents / commands | — | **NÃO são portáveis no padrão** (achado de confiança alta) |
| Regras que sempre valem | **`AGENTS.md`** | Claude Code lê, Codex lê, Hermes lê (cadeia `.hermes.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`) |

Frontmatter normativo do `SKILL.md`: `name` obrigatório (≤64 chars, lowercase+hyphen, **deve** igualar o
nome do diretório pai), `description` obrigatório (≤1024), opcionais `license`, `compatibility` (≤500),
`metadata`, `allowed-tools` (experimental). Todo path relativo declarado deve começar com `./` e ficar
contido na raiz do plugin — `../` invalida o componente.

### Contradições reais medidas (não são bugs nossos, são gaps do ecossistema)

1. **Nome do arquivo de MCP diverge**: `.mcp.json` (Claude Code), `mcp.json` (Agent Plugins, Cursor),
   `mcp_servers` dentro de `config.yaml` (Hermes). **Não existe um arquivo único** consumível pelos 4.
2. **Placeholders de path divergem**: `${CLAUDE_PLUGIN_ROOT}` vs `${CURSOR_PLUGIN_ROOT}` vs
   `${PLUGIN_ROOT}` do padrão. **Cursor declara que NÃO expande as variáveis do padrão** → um `mcp.json`
   conforme a spec quebra no Cursor.
3. **OpenAI contradiz a própria doc**: documenta consumir o pacote portátil, mas o scaffold atual do
   `@plugin-creator` gera o layout de compatibilidade `.codex-plugin/plugin.json`.
4. **Assimetria de diretórios**: Cursor lê skills de `.claude/` e `.agents/`; Claude Code e Codex **não
   leem** `.cursor/`. Reuso cruzado só funciona numa direção.
5. **Skills standalone ≠ skills empacotadas** na OpenAI: standalone só no desktop/CLI/IDE; empacotada em
   plugin alcança web e mobile. Mesmo conteúdo, alcance diferente pela forma.
6. **Migração é mão de única**: Hermes importa `CLAUDE.md`/`AGENTS.md` para memória; nada exporta
   `SOUL.md`/`USER.md`/`MEMORY.md` de volta para o ecossistema.

### Consequência para o desenho (decisão de arquitetura)

- **Regras e processo** vão em `AGENTS.md` + skills — é o único canal que os 4 clients leem.
- **Identidade** fica em `SOUL.md` (Hermes-only) e o agente **degrada bem** sem ele.
- **Memória de trabalho** (decisões, gosto, histórico de entrega) tem que ser **arquivo versionado no
  repo**, não recurso de plataforma — porque memória não é empacotável.
- **MCP** é declarado por client via registro de extensão; nada de assumir `${PLUGIN_ROOT}`.
- Hermes é o único dos 4 com distribuição de **agente inteiro** (`distribution.yaml`, instalável com um
  comando) — modelo a copiar na forma, sem virar Hermes-only no conteúdo.

---

## Frente 2 — Estado da arte dos skills de design + o espaço vazio (27 achados + 13 no landscape + 9 gaps)

| Projeto | Tração (2026-10-12) | Licença | O que é de fato |
|---|---|---|---|
| `pbakaus/impeccable` | **80.181★** · 4.771 forks | Apache-2.0 | 1 skill, **24 comandos**, **59 regras de detector determinísticas**, CLI npm 4.5.2 (41 versões desde 2026-03-30) |
| `nextlevelbuilder/ui-ux-pro-max-skill` | **135.091★** · 347k instalações | MIT | 192 regras de raciocínio + 79 estilos pesquisáveis |
| `emilkowalski/skills` | 45.624★ | MIT | packs `animate`, `review-animations`, `animation-performance` |
| `Nutlope/hallmark` | 29.945★ (push parado desde 2026-08-06) | MIT | anti-slop, 57–58 gates, 4 verbos, 21 macroestruturas, 21 temas |
| `google-labs-code/design.md` | 28.350★ | Apache-2.0 | **formato + linter** (`@google/design.md` 0.4.0: lint/diff/spec/export), **sem julgamento estético** |
| `LottieFiles/motion-design-skill` | 2.138★ | MIT | filosofia-first, **não gera código nem animação** |
| `v0`, `Figma Make`, `Lovable`, `Builder.io Fusion`, `Subframe` | — | proprietário | geram app, **platform-locked**, não são template portátil |

### Os 9 gaps declarados — o decisivo é o último

1. Nenhum cobre o processo completo (descoberta → pesquisa → IA → fluxos → spec → handoff); todos são
   rule-packs de geração de UI ou geradores de app.
2. Nenhum faz **design de descoberta**: entrevista com stakeholder, síntese de pesquisa, teste de
   usabilidade. impeccable grava "product truth" em `PRODUCT.md`, mas não tem método de pesquisa.
3. Comparado a `design.md`: é formato+linter sem julgamento; impeccable/hallmark têm julgamento mas em
   formatos proprietários, **sem padrão cruzado entre ferramentas**.
4. **Nenhum publica harness de avaliação com score reproduzível** vs curadoria humana. O mais próximo são
   as 59 regras do impeccable — sem acurácia nem benchmark público.
5. Motion: o único skill da área **recusa explicitamente gerar animação** — ninguém fecha o loop até
   movimento executável.
6. Ninguém cobre governança de design system em escala como agente (só Builder.io Enterprise, fechado).
7. Ninguém ataca conteúdo/IA com método próprio — clareza de copy aparece como comando solto.
8. *(duplicata de 1, mantida por fidelidade)*
9. **NENHUM é simultaneamente: (a) template de repositório reproduzível, (b) define o PROCESSO (não só o
   output), (c) entrega artefatos com proveniência (decisão → fonte).** ← espaço vazio alvo.

---

## Frente 3 — Como se MEDE qualidade de design (20 métodos com números e modos de falha)

### Detectores determinísticos (o que máquina pode afirmar)

- **axe-core**: **57%** das issues WCAG são automatizáveis (Deque: 57,38% sobre 13.000+ páginas e ~300.000
  issues); 16 de 50 critérios WCAG 2.1 AA cobertos por regra; 26 regras "consistentes" no W3C ACT.
  Garante **zero falso positivo** rebaixando casos incertos para `incomplete` — o preço é o teto de 57%.
- **Lint de tokens (CSS/AST, ex. stylelint)**: bloqueia valor hardcoded em tempo de lint; **não existe
  benchmark público** de precisão/recall; falso positivo alto quando a regra é heurística.
- **Thresholds de regressão visual**: convenções `maxDiffPixelRatio=0.01`, `threshold` per-pixel `0.2`
  (`0.1` para design systems), `maxDiffPixels` ~100 página / ~10 componente. Falso positivo estrutural:
  anti-aliasing de 1px, timestamps, scrollbar, drift de renderização entre SO/navegador.

### Juiz (o que precisa de humano por definição)

- **LLM-as-judge**: >80% de concordância com preferência humana (mesmo nível de humano-humano), mas com
  **viés de posição** (inverter a ordem muda o veredito; medido em >150.000 instâncias, 15 juízes, 22
  tarefas), **viés de verbosidade** e **auto-preferência** (juiz tende a preferir a própria família).
- **WebVoyager** achou o caminho honesto: juiz multimodal com **85,3% de concordância e κ=0,70** usando a
  trajetória completa — mas só **75,3%** com 1 screenshot. **A concordância é escolha de design, não
  medida neutra.**
- **Avaliação heurística automatizada**: κ=0,50 (issue) / exato 84%; severidade com α de Krippendorff
  **≈0** → variabilidade run-to-run. **Não é determinístico.**
- **Avaliador humano único**: **42%** de chance de encontrar um dado problema maior (Nielsen 1992) → o
  ground truth humano é caro e ruidoso por natureza.
- **Baymard** (regra de engenharia): usa LLM só para **detectar o estilo do componente**, nunca para
  concluir se é bom/ruim; meta declarada de ≥95% de acurácia antes de liberar ferramenta.

### Benchmarks e como eles morrem

- **Design2Code**: 484 páginas reais; modelo de regressão sobre métricas de render atinge **79,9%** de
  acurácia preditiva de preferência humana — e **text similarity teve associação negativa/fraca** com
  julgamento humano (métrica plausível que aponta para o lado errado).
- **WebArena**: 812 tarefas; GPT-4 **14,41%** vs humano **78,24%**. VisualWebArena: 910 tarefas; humano
  ~88,7% vs agentes <20%. Mede **conclusão de tarefa** (funcional), não qualidade estética.
- **SWE-bench Verified**: 68,3% das amostras **descartadas** na triagem (93 devs, 3 anotadores/item, 500
  mantidas) — filtro agressivo enviesa o corpus para o fácil.
- **Post-mortem SWE-bench (2026)**: auditoria de 138 problemas achou **59,4%** com testes defeituosos;
  **35,5%** testes estreitos que **rejeitam solução correta**; e modelos reproduziram o fix humano. Dois
  modos universais: **verifier imperfeito** e **contaminação**.

### Consequências obrigatórias no desenho

1. **Separar detectar de julgar.** Máquina afirma só o que é determinístico (com política de 0 FP, como
   axe-core); "é bom?" vai para julgamento humano/preferência com κ medido.
2. **Publicar o κ do próprio juiz** e os thresholds de "incerto" — sem isso a nota não é evidência.
3. **Pré-registrar** o benchmark antes de rodar: corpus, métrica, critério de vitória e ameaças à
   validade (o `design-canon/BENCHMARK.md` já faz isso — "um benchmark que só sabe ganhar é propaganda").
4. **Nunca usar similaridade de texto como proxy de qualidade** (associação negativa medida).
5. Toda métrica de sucesso tem que ter **baseline sem agente** e **baseline site médio da web**.

---

## Frente 4 — Memória e orquestração (32 achados + 8 padrões)

### Memória

- **Context rot é universal** (Anthropic): recall cai com o crescimento de tokens; contexto é recurso
  finito com "attention budget".
- **Chroma/LongMemEval (18 modelos)**: prompt focado de **~300 tokens** com a mesma informação supera
  sistematicamente um haystack de **~113k tokens** com contexto irrelevante. Coerência estrutural do
  haystack **piora** o desempenho.
- **LongMemEval**: sem desenho de memória explícito, continuidade entre sessões perde **30%** de acurácia.
- **MemoryArena (ICML 2026)**: memória externa/RAG **não supera** long-context de forma consistente
  (representation mismatch + training mismatch). Ajuda quando os traces passam de **~120k tokens** ou a
  subtarefa exige raciocínio complexo/domínio-específico. Para reuso **exato** de informação, índice
  verbatim (BM25) é mais robusto que consolidação pesada (Mem0/Letta/Mirix).
- **Desempenho decai monotonicamente com a distância de dependência causal** — e o problema **não** é
  "não ver a informação": mesmo com contexto completo os agentes pioram. Precisa de estado de tarefa
  explícito reafirmado a cada milestone.
- **Agent Skills fazem progressive disclosure em 3 níveis** (name+description no prompt; corpo e anexos
  sob demanda) → a memória procedural do agente deve ser pasta de skills, não prompt gigante.
- **Medir memória por "acertou o fato" é insuficiente**: o teste é se a memória **muda a próxima entrega**.

### Orquestração

- **Cognition**: subagentes paralelos **escrevendo** são frágeis (ações carregam decisões implícitas e
  pressupostos conflitantes). 10 meses depois, o padrão que funciona: **inteligência paralela, escrita
  single-threaded**.
- **Anthropic**: multi-agente de pesquisa 90,2% acima do single-agent no eval interno, mas ~**15x tokens**
  (agente geral ~4x); **token usage explica 80% da variância** — e 95% com número de tool calls. Multi-agente
  **não** serve para domínios que exigem contexto compartilhado ou muitas dependências.
- **MAST (1.600+ traces, 7 frameworks)**: ganhos de multi-agente em benchmarks populares são "frequentemente
  mínimos"; modos de falha mais frequentes = **step repetition 15,7%**, **derailment 13,2%**, **não
  reconhecer que terminou 12,4%**.
- **SupervisorAgent (ICLR 2026)**: supervisão em runtime, sem mudar arquitetura, corta **29,68%** dos tokens
  no GAIA sem reduzir sucesso.
- **Scaling (260 configs, 6 benchmarks)**: alinhamento arquitetura-tarefa decide — a mesma stack que dá
  **+80,8%** em tarefa decomponível dá **−70%** em tarefa sequencial. Arquiteturas sem verificação
  centralizada propagam erro (modelo preditivo acerta a melhor arquitetura em **87%** dos held-out).
- **Gates humanos** (OpenAI `needs_approval` / LangGraph `interrupt()`): gate é **ponto de persistência**,
  não bloqueio em memória; escopo no nível da **ferramenta sensível** (write/delete/deploy), falha
  **fechado**, pacote de aprovação = ação + escopo + evidência mínima, nunca o transcript inteiro.
  Efeitos colaterais antes do gate têm que ser idempotentes para o resume ser seguro.
- **Lacuna honesta**: nenhuma fonte mediu custo/latência de um gate humano (fila, taxa de reprovação,
  custo por aprovação) — só o padrão de implementação.

### Consequências obrigatórias

1. **Default single-agent.** Fan-out só para **leitura/descoberta** (subtarefas independentes), com
   **fan-in determinístico** e **um único escritor** do artefato.
2. **Memória = arquivos + índice por metadados** (nome de arquivo/data como sinal), consultados sob
   demanda; vetor só quando o acervo passar de ~120k tokens ou a latência exigir.
3. **Orçamento de esforço escrito em arquivo de política**, não deixado ao modelo.
4. **Gate por milestone com estado serializado** + evidência de ground truth (teste/saída de ferramenta)
   e **condição de parada explícita** — ataque direto aos dois maiores modos de falha (loop sem progresso
   e não parar).
5. **Supervisor leve** (filtro/herança de contexto) antes de redesenhar orquestração.

---

## Frente 5 — Demanda, distribuição e economia (21 achados + canais + sinais de adoção)

### Canal de distribuição já existe e é de uma linha

- **`npx skills add <owner/repo>`** (Vercel Labs, MIT, `vercel-labs/skills` 33.975★) instala qualquer skill
  de qualquer repo, suporta **78 harnesses**, ranqueia por telemetria anônima de instalação — ranking
  contestado por viés pró-Vercel.
- **Marketplace oficial do Claude** (314 plugins no `marketplace.json` oficial) = alto alcance, baixo custo
  de entrada. Nível 1: **qualquer repo com `.claude-plugin/marketplace.json` já é marketplace**.
- Codex/ChatGPT aceitam ZIP de skills em `platform.openai.com/plugins`, com desafio de domínio.

### Instalação não mede adoção — medido

- **Eval da Vercel**: em **56% dos casos a skill nunca foi invocada** e não houve ganho sobre o baseline.
- **SkillsBench** (87 tarefas, 8 domínios, 18 configs modelo-harness): pass rate **33,9% → 50,5%**
  (+16,6 pp; ganho normalizado 25,5%) — e **skills focadas vencem bundles grandes**.
- **Os autores do repo mais adotado instrumentaram telemetria própria** porque "skills e plugins não dão
  nenhum feedback aos criadores" → sem analytics próprio não há evidência.

### Mercado de design: saturado na superfície, vazio na prova

- **111.810 skills ativas**, +715/dia, **816 clusters byte-idênticos** sob nomes diferentes; design é
  **1.392 skills (1,2%)** do corpus.
- Adoção de design é enorme: `anthropics/skills` frontend-design **862.000 instalações** (180.692★);
  `Leonxlnx/taste-skill` **~1,7M** instalações somando 5 skills; `ui-ux-pro-max` 347k instalações.
- **Custo de confiança é material**: auditoria de 22.511 skills achou **140.963 problemas** (6,3/skill);
  Snyk ToxicSkills achou **prompt injection em 36%** das skills testadas.
- **Design é julgada commodity por quem usa**: no Show HN do Hallmark, usuários dizem que skills de design
  "convergem para a mesma coisa"; um usuário cortou de ~150 skills para 37 e pergunta se elas "brigam".
- Falta gestão de pacote estrutural: o instalador não documenta **update, version-pinning ou uninstall**
  ("sensação de faroeste pré-controle de versão").
- **Plataforma entrega design de graça**: Claude Docs/Slides/Design saíram de beta para **todos os planos,
  inclusive Free** → o valor migra do output para **processo e conformidade de formato**.

### Economia (o que isso diz sobre o alvo)

- Vender arquivo genérico **satura em ~US$1k/mês**; faixas: US$5–29 genérica, US$49–199 workflow,
  US$299–2.499 expertise vertical.
- Quem monetiza **vende execução, não `SKILL.md`**: Agent37 hospeda instância a partir de **US$3,44/mês**,
  >**1.000 pagantes**, #1 Product of the Day.
- **Licença define monetização**: `anthropics/skills`, `vercel-labs/agent-skills` e `openai/skills` não
  trazem SPDX; os que viram produto usam **MIT**.
- **Fórmula do repo mais adotado**: licença MIT + instalador de 1 linha por harness + **evals próprios** +
  oferta comercial separada. Autor conhecido domina: `obra/superpowers` 298.070★, `mattpocock/skills`
  287.541★, `anthropics/skills` 180.692★.
- Demanda viva por *design taste*: post pedindo recomendação de skill de frontend/UX para dashboards
  (duplicado em r/ClaudeDesign e r/ClaudeAI, 02/10/2026) porque as skills que a pessoa tem "são fracas";
  "I condensed 8 years of product design experience into a Claude skill" com **875 upvotes**.

---

## Convergência das 5 frentes (o achado que fecha Descobrir)

Cinco pesquisas independentes, cinco metodologias, **uma mesma conclusão**:

| Frente | O que ela prova isolada |
|---|---|
| 1. Empacotamento | Só **skill + MCP** viajam. Processo, memória e prova têm que vir como **skill + arquivos versionados**. |
| 2. Landscape | Ninguém é, ao mesmo tempo, **template reproduzível + processo definido + proveniência decisão→fonte**. |
| 3. Medição | Nenhum benchmark público mede **"isto é bom design?"**; o mais próximo é preferência humana (79,9%). |
| 4. Memória/orquestração | Memória só vale **em arquivo curado**; orquestração só vale com **escrita single-threaded + verificação central**. |
| 5. Economia | **Instalação não mede nada** (56% nunca invocada). Quem **mede** ganha o argumento e a distribuição. |

**A escassez migrou de "gerar UI" para "provar que é bom e rastrear por quê".** Gerar já é commodity
grátis (impeccable 80k★, plataforma entregando design no plano Free). Prova, rastro e reprodutibilidade
não existem em ninguém. Esse é o problema que a estratégia tem que resolver — e é exatamente o que o
stakeholder pediu como distribuição: **benchmark público reprodutível**.
