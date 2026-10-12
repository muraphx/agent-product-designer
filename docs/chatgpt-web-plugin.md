# Usar o agente como plugin/conector MCP no ChatGPT

Existem **duas superficies diferentes** chamadas "ChatGPT", e elas nao instalam do mesmo jeito:

| Superficie | Como o agente entra | Estado |
| --- | --- | --- |
| **App ChatGPT desktop** (Windows) | o app consome o host do Codex: `~/.codex/config.toml` (MCP), `~/.codex/skills/`, `~/.codex/AGENTS.md` | pronto: `node install.mjs --client chatgpt` — ver `docs/chatgpt-desktop.md` |
| **ChatGPT na web** (`chatgpt.com`) | "Add custom MCP server" em `chatgpt.com/plugins` — o servidor precisa ser **HTTPS publico** falando **SSE ou streaming HTTP** | este documento: `bin/remote-server.mjs` + tunel |

O `bin/memory-server.mjs` (stdio) **nao** serve para a web: o ChatGPT na web nao abre processo local. O mesmo agente exposto por rede vive em `bin/remote-server.mjs` — mesmas ferramentas, mesma memoria (os dois importam `bin/pd-core.mjs`).

## 1. Subir o servidor remoto

```bash
node bin/remote-server.mjs            # http://127.0.0.1:8787/mcp
```

- `PD_HTTP_PORT=<porta>` muda a porta, `PD_HTTP_HOST=0.0.0.0` abre na rede local.
- `PD_WORKSPACE=<dir>` decide onde ficam a memoria e os artefatos julgados.
- `PD_HTTP_TOKEN=<segredo>` passa a exigir `Authorization: Bearer <segredo>` (ou `?token=`).
- `node bin/remote-server.mjs --selftest` sobe, faz o handshake consigo mesmo e sai.

Ferramentas expostas (as mesmas do servidor stdio, mais o kernel):

| Ferramenta | Para que serve |
| --- | --- |
| `pd_kernel_rules` | as 3 regras duras, a politica de incerteza e o contrato de entrega — chame primeiro |
| `pd_read_caps` | o teto numerico (`budgets/caps.yaml`) achatado, o mesmo que o portao R3 usa |
| `pd_run_gates` | veredito maquina (`pass` / `fail` / `incomplete`) por portao, com regra, arquivo e evidencia |
| `pd_record_decision` | grava a decisao com `strategy_ref` + `evidence`; **recusa** sem fonte |
| `pd_list_decisions` | lista o que ja foi decidido |
| `pd_coverage_gaps` | tokens que nenhuma decisao ativa justifica |

O modelo na web nao tem filesystem: ele **manda o texto dos arquivos** dentro de `pd_run_gates.files` (caminhos relativos, `..` e caminho absoluto sao recusados). Quando falta rastro (tokens, estrategia, decisoes), a resposta traz `hint` dizendo exatamente o que enviar na mesma chamada.

## 2. Expor por HTTPS

### a) Tunel rapido (teste, 1 minuto)

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Sai uma URL `https://<aleatorio>.trycloudflare.com` — o endpoint e `https://<aleatorio>.trycloudflare.com/mcp`. A URL muda a cada start; serve para testar, nao para deixar rodando.

### b) Secure MCP Tunnel (recomendado para uso continuo, sem expor nada)

O servidor fica privado; o `tunnel-client` da OpenAI abre uma conexao de saida.

```bash
export CONTROL_PLANE_API_KEY="sk-..."   # runtime key do tunnel
tunnel-client init --sample sample_mcp_stdio_local --profile pd-remote \
  --tunnel-id tunnel_0123456789abcdef0123456789abcdef \
  --mcp-command "node <plugin>/bin/memory-server.mjs"      # ou --mcp-server-url http://127.0.0.1:8787/mcp
tunnel-client doctor --profile pd-remote --explain
tunnel-client run --profile pd-remote
```

`tunnel_id` sai de [Platform → tunnel settings](https://platform.openai.com/settings/organization/tunnels). Precisa de Tunnels **Read + Manage** (criar) e **Read + Use** (rodar), e o tunnel precisa estar associado ao workspace do ChatGPT que vai usar. Na hora de adicionar o conector, escolha **Tunnel** em vez de Server URL. Observacao oficial: o Secure MCP Tunnel nao serve para **publicar** plugin no diretorio — para uso proprio, sim.

### c) Host publico (para publicar de verdade)

Qualquer host HTTPS que responda `POST /mcp` (Cloudflare Workers, Fly, VPS atras de proxy). O endpoint publico tem de ser estavel para submissao de plugin publico.

## 3. Adicionar no ChatGPT

1. `chatgpt.com/plugins` → botao **+** → **Add custom MCP server**.
2. Nome (ex.: `Product Designer`) e descricao.
3. Em **Connection**: cole a **Server URL** — `https://<host>/mcp` — ou escolha **Tunnel**.
4. **Authentication**: `No authentication` (se voce nao definiu `PD_HTTP_TOKEN`) ou OAuth.
   - O formulario oferece **OAuth**, **No authentication** e **OAuth or no authentication**. Token por header (`Bearer`) **nao** e uma opcao da interface: se quiser auth de verdade na web, use OAuth ou o Secure MCP Tunnel. `PD_HTTP_TOKEN` continua valendo para Codex/curl/outros clientes.
5. Leia o aviso de risco → **I understand and want to continue** → **Create as a plugin**.
6. Instale o plugin no seu perfil/workspace.
7. Na conversa, digite `@` e escolha o plugin. Seja explicito:
   - `Use the Product Designer app's pd_run_gates tool with these files …`
   - `Nao use browser nem outras ferramentas; so o app Product Designer.`

Detalhes de gerenciamento: em app settings existe uma pagina por app, com liga/desliga de ferramentas e **refresh** — e por ele que o ChatGPT relê `instructions`, descricoes e lista de tools (rode o refresh depois de mudar o servidor).

## 4. Prova de que funciona (executada)

Servidor local + tunel rapido, os tres pedacos exercitados **de fora**, por HTTPS, sem sessao:

```bash
curl -s https://<aleatorio>.trycloudflare.com/health
# {"ok":true,"server":"pd-remote","workspace":"...","memory":"...decisions.jsonl","auth":"none","tools":6}

curl -s -X POST https://<aleatorio>.trycloudflare.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
# {"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{...}},"serverInfo":{"name":"pd-remote","version":"0.1.0"},"instructions":"Agente product designer sob tres portoes bloqueantes. ..."}}

curl -s -X POST https://<aleatorio>.trycloudflare.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"pd_run_gates","arguments":{"files":[{"path":"design/index.html","content":"<div style=\"background: linear-gradient(135deg,#8b5cf6,#a78bfa); text-align:center\"><h1>Supercharge your workflow</h1></div>"}]}}}'
# {"result":{"content":[{"type":"text","text":"{\"exit_code\":1,\"status\":\"fail\", ... \"rule\":\"ai-gradient\" ... \"rule\":\"stock-copy\" ...}"}]}}
```

A suite de protocolo roda offline e cobre handshake, lista de ferramentas, recusa, veredito, lote JSON-RPC, auth por token e caminho malicioso:

```bash
node tests/remote-smoke.mjs     # 39 ok, 0 falhas
```

## 5. Limites, declarados

- **Sem SSE no servidor**: `POST /mcp` responde JSON direto (modo stateless); `GET /mcp` devolve 405 declarando `POST, DELETE`. Os protocolos aceitos pelo ChatGPT (SSE e streaming HTTP) sao atendidos no modo "responder na mesma requisicao".
- **Sem sessao**: cada requisicao e independente; nenhum estado entre chamadas alem do que esta em disco no workspace.
- **O modelo na web nao ve o repo**: tudo que o portao precisa julgar tem de ir dentro da chamada.
- **Artefato aberto no navegador continua sendo seu**: a web do ChatGPT nao abre arquivo local; o `pd_run_gates` julga o texto enviado, e o arquivo real na sua maquina continua sendo o entregavel.
- **Tunel rapido e efemero**: URL nova a cada start; para uso continuo, Secure MCP Tunnel ou host proprio.
- **Nunca exponha sem `PD_HTTP_TOKEN`** se o host for publico e o workspace tiver dados reais: sem token qualquer um com a URL chama as ferramentas.
- Skills na web: o plugin do ChatGPT aceita skills no empacotamento; as nossas entram pelo host Codex (desktop) e por `~/.agents/skills/`. Na web, o que chega ao modelo sao **as ferramentas MCP + `instructions`**.
