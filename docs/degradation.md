# Degradação por client

O que este pacote faz em cada client, e o que ele **perde**. A6 do plano (`docs/research/05-deliver-plan.md`).

Regra de leitura: `verificado` significa que eu rodei e vi o resultado. `declarado` significa que o
arquivo existe e o client afirma ler aquilo — ninguém rodou. `não funciona` significa que o client
não tem o mecanismo.

## Matriz

| Capacidade | Claude Code | Hermes Agent | Codex CLI / ChatGPT desktop | ChatGPT web (conector) | Cursor | Client que só lê `AGENTS.md` |
|---|---|---|---|---|---|---|
| Portões (CLI `node gates/run.mjs`) | verificado | verificado | verificado | verificado por HTTPS (prova em `docs/chatgpt-web-plugin.md`) | verificado | verificado |
| Suíte (`npm test`, 197 asserções) | verificado | verificado | verificado | verificado | verificado | verificado |
| Agent Skills (`skills/`) | verificado: plugin instalado e habilitado, `claude plugin list` | verificado: 6 skills copiadas e relidas do diretório do profile | verificado: `--client chatgpt` copiou 8 skills para `~/.codex/skills` e releu cada uma | **não se aplica**: na web o modelo recebe ferramentas MCP + `instructions`, não skills de pasta | declarado: lê `~/.agents/skills` | declarado |
| Kernel sempre-ativo (`AGENTS.md`) | **não funciona** (lê `CLAUDE.md`) | **não funciona** (lê skills + memória) | verificado: bloco anexado a `~/.codex/AGENTS.md` e sessão do host rodada com ele | verificado: o kernel chega no campo `instructions` do `initialize` | declarado: lê `AGENTS.md` | verificado |
| Memória MCP (`bin/memory-server.mjs`) | declarado em `.mcp.json` (`${CLAUDE_PLUGIN_ROOT}`); servidor verificado por fora, conexão na sessão **não verificada** | **não registrado** no profile: rodar à mão | **verificado**: `codex mcp list` lista `pd-memory`; `read_caps` + `record_decision` chamados de dentro do host gravaram em `decision-log/decisions.jsonl` | verificado: `record_decision`/`list_decisions`/`coverage_gaps` pelo servidor HTTP (mesma memória, `bin/pd-core.mjs`) | não registrado | não se aplica |
| Veredito dos portões por rede (`pd_run_gates`) | não se aplica | não se aplica | não se aplica | verificado: `tools/call` por HTTPS devolveu `fail` com `ai-gradient` e `stock-copy` | não se aplica | não se aplica |
| Slash commands / hooks | não embarcados (fora da Agent Plugins Spec 1.0.0) | não embarcados | não embarcados | não embarcados | não embarcados | não embarcados |

Asserções: `npm test` (105) + `tests/swap.mjs` (30) + `tests/mcp-smoke.mjs` (23) + `tests/remote-smoke.mjs` (39) = **197**.

## O piso: o que funciona sem client nenhum

Quatro coisas não dependem de client, porque são um processo Node e um diretório de arquivos:

1. `node gates/run.mjs <alvo>` — os três portões, com código de saída. Qualquer CI roda isso.
2. `node bin/memory-server.mjs` — memória como servidor MCP stdio (JSON-RPC por linha). Qualquer
   client que fale MCP pode ligá-lo; nenhum precisa entender o repo. `tests/mcp-smoke.mjs` sobe o
   servidor num diretório temporário e conversa com ele pelo protocolo.
3. `node install.mjs --client agents` — skills no diretório portátil `~/.agents/skills`.
4. `python dist/chatgpt/gates.py <alvo>` — os mesmos três portões onde **não existe Node** (sandbox do
   ChatGPT web, interpretador de código). Paridade do veredito medida em `dist/chatgpt/PARITY.md`.

Esse piso é o que sobra quando o client não coopera. A degradação real é **conveniência**, não
capacidade: sem plugin instalado, o humano tem que lembrar de rodar os portões. Com plugin, o
kernel está no contexto o tempo todo.

## O que degrada de verdade

1. **Kernel sempre-ativo** em Claude Code e Hermes. Os dois não leem `AGENTS.md` sozinhos. Lá, o
   kernel vira *skill* (carregada por gatilho) ou instrução copiada à mão. Não é o mesmo que
   sempre-ativo: o agente pode agir sem lembrar do portão.
2. **Memória MCP** fora do Claude Code e do Codex/ChatGPT. O `.mcp.json` só vale no plugin do Claude;
   nos outros clients o servidor tem que ser registrado à mão. A recusa de gravar decisão incompleta
   continua valendo — ela é do servidor, não do client.
3. **Skills vendorizadas e os binários que elas citam.** `impeccable`, `hallmark` e `motion-design`
   chegam como texto. `impeccable` ainda chama `npx impeccable`: sem rede, o benchmark o reporta
   `unavailable` (nunca `0`).
4. **Orçamento de contexto de skills no ChatGPT desktop.** O host corta descrições quando o conjunto
   não cabe: *"Skill descriptions were shortened to fit the skills context budget"*. Todas continuam
   visíveis, mas skill que não se usa ocupa espaço — desabilite com `[[skills.config]] enabled = false`
   em `~/.codex/config.toml`.
5. **ChatGPT na web não tem filesystem nem sessão.** O servidor HTTP responde em modo stateless e
   `POST`-only (`GET /mcp` → 405 declarando os métodos); o modelo só vê o que vai dentro da chamada.
   O entregável (arquivo no seu disco, aberto no navegador) continua sendo local — a web recebe o
   texto e devolve veredito. Skills de pasta também não atravessam: na web chegam ferramentas + kernel.

## O que eu não verifiquei

- Conexão MCP viva dentro do Claude Code e dentro do Hermes (declarei o arquivo, não a conexão).
- A **interface** do ChatGPT desktop: instalei, `codex mcp list` confirmou o servidor e a sessão do
  host executou as ferramentas — mas eu não abri `Settings → MCP servers` nem o `/mcp` do composer.
- Cursor de ponta a ponta: escrevi o bloco de inclusão e conferi o conteúdo do arquivo; não abri sessão.
- A **interface** de conector do ChatGPT web: `chatgpt.com/plugins` → *Add custom MCP server* não foi
  exercitado por mim (é GUI de conta); o que verifiquei foi o servidor, por HTTPS, do lado de fora —
  `health`, `initialize`, `tools/list` e `tools/call` com veredito real.
- Nenhum client fora dos acima.
