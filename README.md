# agent-product-designer

Um agente de **product design** que recusa entregar. Três regras duras — sem AI slop, sem decisão
sem estratégia, sem excessos — implementadas como **portões executáveis** que rodam sobre o próprio
artefato. Portão vermelho = entrega barrada. Você aprova ou rejeita; ele não se auto-aprova.

Não vende gosto. Vende **prova**: estratégia escrita, artefato executável e rastro que liga cada
escolha a uma decisão registrada com fonte.

```bash
npx --yes github:muraphx/agent-product-designer --client all   # quando o repo estiver publicado
```

Sem `npx`? Clone e rode direto:

```bash
git clone https://github.com/muraphx/agent-product-designer && cd agent-product-designer
node install.mjs --client all        # claude | hermes | agents | codex
node gates/run.mjs examples/landing  # veredito dos três portões
npm test                             # 84 asserções
```

## Os três portões

| Portão | Regra dura | Acusa | Arquivo |
|---|---|---|---|
| `r1` | sem AI slop | gradiente na faixa violeta, emoji decorativo, brilho profundo, frase de catálogo, contraste < 4.5:1 | `gates/r1-anti-slop.mjs` |
| `r2` | sem decisão sem estratégia | token sem decisão, decisão sem fonte, `strategy_ref` que não existe no `strategy.md` | `gates/r2-trace.mjs` |
| `r3` | sem excessos | qualquer contagem acima do teto de `budgets/caps.yaml` (cores, fontes, pesos, raios, sombras, durações, seções, palavras) | `gates/r3-budgets.mjs` |

Três estados, não dois:

- `pass` — entrega liberada.
- `fail` — entrega recusada, com regra e linha.
- `incomplete` — o detector **não tem certeza**. Nunca vira `fail` por chute e nunca é silêncio: a
  dúvida viaja no relatório e chega ao humano. `--strict` transforma `incomplete` em `exit 1`.

```bash
node gates/run.mjs <alvo>            # relatório legível
node gates/run.mjs <alvo> --json     # relatório de máquina
node gates/run.mjs <alvo> --strict   # incerteza barra
```

Código de saída: `0` = pass (ou incomplete sem `--strict`), `1` = fail ou incomplete com `--strict`.

## Estrutura

```
plugin.json            manifesto (Agent Plugins Spec 1.0.0)
mcp.json / .mcp.json   memória MCP: spec e Claude, mesmo servidor
AGENTS.md              kernel sempre-ativo (leia isto primeiro)
install.mjs            instalador: --client claude|hermes|agents|codex|all
budgets/caps.yaml      o teto numérico, com dono único por regra
bin/memory-server.mjs  servidor MCP stdio: record_decision, list_decisions, coverage_gaps, read_caps
gates/                 r1, r2, r3 + biblioteca de leitura determinística (caps.mjs, scan.mjs)
skills/                design-process, strategy-trace, anti-slop (+ impeccable, hallmark, motion-design vendorizadas)
examples/landing/      alvo de referência: página real que passa nos três portões
tests/                 fixtures com UM defeito cada + suíte que prova acusação e silêncio
docs/research/         Double Diamond de pesquisa: 00 brief … 05 plano de entrega
legacy/                esqueleto anterior + diagnóstico do que estava errado
```

## Memória

`bin/memory-server.mjs` é um servidor MCP real (stdio, JSON-RPC por linha). Ele **recusa** gravar
decisão sem `id`, sem `decision`, sem `strategy_ref` ou sem `evidence[]` — a recusa é testada. O
mesmo número de cobertura que o portão `r2` usa sai de `coverage_gaps`, então memória e portão não
podem divergir.

Memória é dado do usuário: vive no diretório de dados do client, nunca no repositório. Nada de
`SOUL.md`/`MEMORY.md` — foi medido que nenhum client lê esses arquivos.

## Portabilidade

| Client | Mecanismo |
|---|---|
| Claude Code | `.claude-plugin/marketplace.json` + `plugin.json` + `skills/` + `.mcp.json` |
| Codex / ChatGPT | `AGENTS.md` + `skills/` (bloco de inclusão no `~/.codex/AGENTS.md`) |
| Cursor | `AGENTS.md` + `skills/` |
| Hermes Agent | `skills/` (copiadas para o diretório de skills do profile) |
| Qualquer outro | `~/.agents/` (diretório portátil de Agent Skills) |

O instalador imprime o caminho/comando exato de cada ação e **relê o destino** para confirmar.
Nada é sobrescrito sem `--force`. `node install.mjs --validate` roda o validador oficial do Claude
mais a suíte de empacotamento.

## O que este repo **não** prova

- Passar nos portões não prova que o design é bom. Prova que ele não é genérico por acidente, que
  tem rastro e que não estourou o teto. Gosto continua sendo julgamento humano.
- O benchmark público contra o juiz determinístico **ainda não foi rodado**. As ameaças à validade
  estão pré-registradas em `docs/research/` — inclusive a que mata o projeto: se o benchmark não
  puder ser publicado, a tese "prova primeiro" perde valor.
- As skills `impeccable` e `hallmark` citam comandos (`npx impeccable`, scripts próprios) cujos
  binários **não** estão vendorizados aqui. O texto está completo; o binário não.
- `motion-design` não traz arquivo de licença no pacote de origem (ver `vendor-status.json`).

## Fases

1. **Kernel que recusa** — portões, testes, memória MCP, instalador. ← esta fase
2. **Harness público** — corpus rotulado, juiz determinístico, placar reprodutível.
3. **Confronto publicado** — F1 e escape contra o `impeccable`, κ do painel de leigos, ganho
   contra "sem agente", taxa de invocação, gate humano medido.

## Licença e créditos

MIT para o kernel. Skills de terceiros mantêm suas licenças — ver `NOTICE.md` e `vendor-licenses/`.
