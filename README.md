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
node install.mjs --client all        # claude | hermes | agents | codex | chatgpt
node gates/run.mjs examples/landing  # veredito dos três portões
npm test                             # 158 asserções
```

Usando no **ChatGPT desktop**: passo a passo verificado em [`docs/chatgpt-desktop.md`](docs/chatgpt-desktop.md)
— `node install.mjs --client chatgpt` grava a memória MCP em `~/.codex/config.toml`, as skills em
`~/.codex/skills` e o kernel em `~/.codex/AGENTS.md`; reinicie o app e confira em `Settings → MCP servers`.

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

Sem Node no host (ex.: sandbox do ChatGPT web)? O mesmo veredito em Python stdlib-only:

```bash
python dist/chatgpt/gates.py <alvo>   # paridade contra o runner Node medida em dist/chatgpt/PARITY.md
```

## Estrutura

```
plugin.json            manifesto (Agent Plugins Spec 1.0.0)
mcp.json / .mcp.json   memória MCP: spec e Claude, mesmo servidor
AGENTS.md              kernel sempre-ativo (leia isto primeiro)
install.mjs            instalador: --client claude|hermes|agents|codex|chatgpt|all
budgets/caps.yaml      o teto numérico, com dono único por regra
bin/memory-server.mjs  servidor MCP stdio: record_decision, list_decisions, coverage_gaps, read_caps
gates/                 r1, r2, r3 + biblioteca de leitura determinística (caps.mjs, scan.mjs)
dist/chatgpt/          port stdlib-only dos portões (gates.py) + paridade medida (PARITY.md)
skills/                design-process, strategy-trace, anti-slop, product-designer
                       (+ impeccable, hallmark, motion-design vendorizadas)
examples/landing/      alvo de referência: página real que passa nos três portões
tests/                 fixtures com UM defeito cada + suíte que prova acusação e silêncio
                       swap.mjs: troca skills/ e o teto por outra disciplina e exige que o kernel siga de pé
                       mcp-smoke.mjs: sobe o servidor de memória e conversa MCP por stdio, de verdade
prereg/lane-a.md       pré-registro do benchmark, congelado antes de medir
bench/                 corpus rotulado, métricas, juiz e adapters medidos; RESULTS.md é o placar
docs/delivery/phase-2/ artefato da fase 2: strategy.md + tokens + decisões + o relatório (que passa nos portões)
docs/chatgpt-desktop.md como usar no ChatGPT desktop, com a saída real do instalador e da prova de ponta a ponta
docs/degradation.md    o que cada client ganha e o que ele perde
docs/research/         Double Diamond de pesquisa: 00 brief … 05 plano de entrega
legacy/                esqueleto anterior + diagnóstico do que estava errado
```

## Memória

`bin/memory-server.mjs` é um servidor MCP real (stdio, JSON-RPC por linha). Ele **recusa** gravar
decisão sem `id`, sem `decision`, sem `strategy_ref` ou sem `evidence[]` — a recusa é testada. O
mesmo número de cobertura que o portão `r2` usa sai de `coverage_gaps`, então memória e portão não
podem divergir.

`npm run test:mcp` sobe o servidor com `PD_WORKSPACE` apontando para um diretório temporário,
completa o handshake, chama as ferramentas pelo protocolo e confere o arquivo gravado — 23 asserções.
O workspace vem de `PD_WORKSPACE` (senão, do diretório atual): no ChatGPT desktop esse env é escrito
pelo instalador, para a memória não cair em lugar imprevisível.

Memória é dado do usuário: vive no diretório de dados do client, nunca no repositório. Nada de
`SOUL.md`/`MEMORY.md` — foi medido que nenhum client lê esses arquivos.

## Portabilidade

| Client | Mecanismo |
|---|---|
| Claude Code | `.claude-plugin/marketplace.json` + `plugin.json` + `skills/` + `.mcp.json` |
| ChatGPT desktop / Codex | `~/.codex/config.toml` (`[mcp_servers.pd-memory]`) + `~/.codex/skills/` + bloco em `~/.codex/AGENTS.md` |
| Cursor | `AGENTS.md` + `skills/` |
| Hermes Agent | `skills/` (copiadas para o diretório de skills do profile) |
| Qualquer outro | `~/.agents/` (diretório portátil de Agent Skills) |

O instalador imprime o caminho/comando exato de cada ação e **relê o destino** para confirmar.
Nada é sobrescrito sem `--force`. `node install.mjs --validate` roda o validador oficial do Claude
mais a suíte de empacotamento.

A tabela acima diz o que funciona; `docs/degradation.md` diz o que **quebra** em cada client — Claude
Code e Hermes não leem `AGENTS.md`, então ali o kernel deixa de ser sempre-ativo e vira skill de
gatilho. Declarado, não descoberto depois.

## Benchmark (Lane A, medido)

Corpus rotulado de 48 páginas, 15 delas com defeito bloqueante. Pré-registro em `prereg/lane-a.md`
foi **congelado antes** da medição; o resultado está em `bench/RESULTS.md`.

| Adapter | Cobertura | precisão | recall | F1 | escape |
|---|---|---|---|---|---|
| juiz determinístico | 38 tells | 0,448 | 0,796 | **0,574** | **0,067** |
| `impeccable` 3.6.0 | 5 mapeamentos | 0,173 | 0,097 | 0,124 | 0,133 |
| portões r1/r2/r3 deste repo | 6 tells | 1,000 | 0,022 | 0,042 | 0,867 |
| produto anterior (baseline) | 7 mapeamentos | 0,057 | 0,118 | 0,077 | 1,000 |

Critérios do pré-registro: F1 ≥ 2× o `impeccable` (0,574 vs 0,124 — 4,6×), escape ≤ 0,15 (0,067),
precisão dos portões ≥ 0,80 (1,000), JSON byte-idêntico em execuções repetidas (3×,
`595c71866674c924`). **Todos confirmados**; a condição que matava a tese não disparou.

```bash
npm run bench       # lane completa (inclui o `impeccable` via npx, ~140s)
npm run bench:quick # kernel + judge, ~4s
```

Conflito de interesse declarado: eu escrevi o juiz **e** rotulei o corpus. As cinco ameaças à
validade estão em `bench/RESULTS.md` — a primeira é essa.

O relatório da fase 2 é o artefato em `docs/delivery/phase-2/design/index.html` (PNG ao lado), com
estratégia e três decisões registradas. Ele passa nos próprios portões:

```bash
node gates/run.mjs docs/delivery/phase-2   # PASS (0 violações, 0 incertezas)
```

## O que este repo **não** prova

- **Passar nos portões não prova que o design é bom.** Prova que ele não é genérico por acidente,
  que tem rastro e que não estourou o teto. Gosto continua sendo julgamento humano.
- **O corpus do benchmark é meu, pequeno e enviesado.** 48 páginas, rótulo de um anotador só
  (autor do juiz). Não sustenta intervalo de confiança; sustenta ordem de grandeza.
- **Os portões têm precisão alta e recall baixo por escolha** (1,000 / 0,022). Eles barram o que
  sabem provar e mandam o resto para revisão humana. Ler 0,022 como "detector ruim" é errado;
  ler como "detector suficiente" também.
- **`impeccable` não está pinado**: foi medido via `npx` no dia, versão 3.6.0. O F1 dele aqui é
  indicativo.
- As skills `impeccable` e `hallmark` citam comandos (`npx impeccable`, scripts próprios) cujos
  binários **não** estão vendorizados aqui. O texto está completo; o binário não.
- `motion-design` não traz arquivo de licença no pacote de origem (ver `vendor-status.json`).
- **O port Python é do gate runner, não do agente.** No sandbox sem Node você tem julgamento e
  veredito; não tem a memória MCP nem o benchmark.

## Fases

1. **Kernel que recusa** — portões, testes, memória MCP, instalador. ✔
2. **Harness público** — corpus rotulado, juiz determinístico, placar reprodutível. ✔ (Lane A medida,
   pré-registro antes da medição, `bench/RESULTS.md`)
3. **Confronto publicado** — κ de um painel de leigos, ganho contra "sem agente", taxa de invocação,
   gate humano medido. ← falta isto: os números que exigem **gente**, não código.

## Licença e créditos

MIT para o kernel. Skills de terceiros mantêm suas licenças — ver `NOTICE.md` e `vendor-licenses/`.
