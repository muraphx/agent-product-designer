# 01 — Descobrir: inventário do que já existe (estado real, verificado)

**Método:** inspeção direta do disco em `C:/Users/muzph/projetos/` (12/out/2026), com contagem
de bytes e listagem de arquivos. Sem estimativa: tudo abaixo tem comando que reproduz.

## Achado central

O agente **já existe como esqueleto** — e o esqueleto é bom. O que falta não é ideia, é
**lastro**: skills vendorizadas pela metade, conectores prometidos que não existem, memória que
nenhum script lê, e zero evals. Ou seja: a distância até "funciona" é de *integração e prova*,
não de *concepção*. Isso muda a estratégia: o trabalho é fechar lacunas nomeadas, não começar de novo.

## Inventário em 4 estados

| Estado | Significado |
|---|---|
| **FUNCIONA** | roda hoje, foi exercitado, tem evidência |
| **DORMENTE** | arquivo existe, nada o lê / ninguém o executou |
| **NUNCA RODOU** | declarado no manifesto, ausente no disco |
| **SEM SUPORTE** | não existe formato/instalação para isso hoje |

### `agent-product-designer` (o repo alvo)

| Item | Estado | Evidência |
|---|---|---|
| `IDENTITY.md` (1.904 B) | FUNCIONA (como texto) | define tri-skill laws, Double Diamond, gates |
| `GATES.md` (1.014 B) | DORMENTE | 5 gates, gate 01 `PENDING`, 02–05 `LOCKED`, log de assinaturas vazio |
| `agent.json` v2.0.0 | FUNCIONA (como manifesto) | declara 3 skills + 4 conectores |
| `connectors/claude/CLAUDE.md` (468 B) | FUNCIONA | ponteiro portátil, o padrão certo |
| `connectors/cursor/.cursorrules` (414 B) | FUNCIONA | idem |
| `connectors/hermes/` | **NUNCA RODOU** | declarado no `agent.json`, ausente no disco |
| `connectors/chatgpt/` | **NUNCA RODOU** | declarado no `agent.json`, ausente no disco |
| `skills/impeccable/` | DORMENTE (parcial) | `SKILL.md` 13.593 B + 2 refs (`craft-floor.md`, `operate.md`); o upstream tem ~24 comandos e 59–61 regras → a cópia cobre uma fração |
| `skills/hallmark/SKILL.md` (68.018 B) | DORMENTE (parcial) | maior arquivo do repo; 21 temas / 4 verbos / 57 gates declarados pelo upstream |
| `skills/motion-design/SKILL.md` (12.895 B) | DORMENTE (parcial) | upstream entrega 17 arquivos (director / patterns / reference); aqui só o SKILL.md |
| `memory/taste-profile.json` (1.3 KB) | DORMENTE | nenhum script lê; nenhum eval alimenta |
| `scripts/score_theses.py` | FUNCIONA | pontuação de teses com critérios ponderados |
| `index.html` + `preview.png` | FUNCIONA (artefato antigo) | tese anterior materializada no browser |

**Contradição encontrada na memória de gosto:** `memory/taste-profile.json` define
`colors.accent = "#6366f1"` (indigo) enquanto o próprio arquivo lista
`anti_patterns: ["generic purple AI hero gradients", ...]`. A memória de gosto **viola a
própria regra dura**. Isso não é detalhe estético: é a prova de que memória sem validador
apodrece. Regra que sai daqui: *toda memória tem gate de consistência com as regras duras do
próprio agente*.

### Repos vizinhos (o material que já tem lastro)

| Repo | Estado | O que entrega hoje |
|---|---|---|
| `designcourt` | FUNCIONA | juiz determinístico de design: 38 tells, 17/17 testes passando, expõe MCP (`plan` / `judge` / `decide`); F1 medido 0.578 / recall 0.796 / escape 6.7% contra 0.170 / 9.7% / 40% da alternativa baseada em modelo |
| `design-canon` | FUNCIONA | `plugin.json` (Agent Plugins 1.0.0) + `.claude-plugin/` + `.codex-plugin/` + `marketplace.json`: **o template de distribuição multi-client já existe** |
| `designkit` | FUNCIONA | design system de referência (`DESIGN.md` + tokens) — casa com a superfície escolhida (design system) |
| skills Hermes locais (`impeccable` etc.) | FUNCIONA | v4.3.1 instalada em `%LOCALAPPDATA%/hermes/skills/creative/` |
| `hallmark`, `motion-design` | NUNCA RODOU localmente | não instalados como skill no Hermes, só copiados no repo alvo |
| evals de design no agente | **NUNCA RODOU** | nenhum repo de design roda eval do próprio artefato de agente |
| "rodar igual no ChatGPT" | **SEM SUPORTE** | sem `plugin.json` Agent Plugins não há formato universal |

## Leitura da lacuna

1. **Cópia parcial é pior que ausência.** Skill vendorizada pela metade dá a ilusão de cobertura
   e falha silenciosamente quando o agente precisa do arquivo que não veio. → instalar por
   *installer + lockfile de versão*, não por `cp`.
2. **Manifesto mente.** `agent.json` promete 2 conectores que não existem. → manifesto tem que
   ser validado contra o disco (teste que falha quando declarado ≠ presente).
3. **Memória sem leitor e sem gate** é enfeite que se contradiz.
4. **Juiz e walker já existem** (`designcourt`, `design-canon`) e estão desconectados do agente.
   Conectar é o maior ganho pelo menor custo.
5. **Distribuição multi-client já foi resolvida uma vez** em `design-canon` — reaproveitar, não reinventar.

## Comandos que reproduzem este inventário

```bash
cd ~/projetos/agent-product-designer
cat agent.json; find skills connectors -type f | sort; wc -c skills/*/SKILL.md
cd ~/projetos/design-canon && ls; ls .claude-plugin .codex-plugin; grep -A5 '"scripts"' package.json
cd ~/projetos/designcourt && node test/all.mjs
```
