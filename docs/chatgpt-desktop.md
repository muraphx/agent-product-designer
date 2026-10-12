# Usar o agente no ChatGPT desktop (e no Codex) — verificado

O ChatGPT desktop **não tem sistema de plugin próprio**. Ele roda no mesmo host do Codex e consome
três coisas, todas em `~/.codex/`:

| O que | Caminho | Papel |
|---|---|---|
| MCP servers | `~/.codex/config.toml` → `[mcp_servers.*]` | a memória de decisões do agente (`pd-memory`) |
| Agent Skills | `~/.codex/skills/<nome>/SKILL.md` | as sete skills do pacote, incluindo o ponto de entrada `product-designer` |
| Kernel sempre-ativo | `~/.codex/AGENTS.md` | as três regras duras + `node gates/run.mjs <alvo>` |

Instalação, um comando:

```bash
node install.mjs --client chatgpt                    # workspace do MCP = este repo
node install.mjs --client chatgpt --workspace <dir>  # workspace = o projeto do cliente
```

O instalador escreve o bloco TOML, copia as skills, anexa o bloco do `AGENTS.md` e depois **relê os
três destinos**. Saída real, capturada do comando acima já instalado (a primeira execução diz
`verificado: <caminho>` em vez de `bloco ja presente`):

```
  ok   chatgpt: MCP pd-memory — bloco ja presente em C:\Users\muzph\.codex\config.toml (use --force para regravar)
  ok   chatgpt/anti-slop — ja instalado (use --force para regravar)
  ok   chatgpt/design-process — ja instalado
  ok   chatgpt/designcourt-judge — ja instalado
  ok   chatgpt/hallmark — ja instalado
  ok   chatgpt/impeccable — ja instalado
  ok   chatgpt/motion-design — ja instalado
  ok   chatgpt/product-designer — ja instalado
  ok   chatgpt/strategy-trace — ja instalado
  ok   chatgpt: AGENTS.md — bloco ja presente em C:\Users\muzph\.codex\AGENTS.md
  ok   chatgpt: servidor visivel — verificado em `codex mcp list`
  nota ChatGPT desktop: reinicie o app; o workspace do MCP e C:\Users\muzph\projetos\agent-product-designer

11 acoes confirmadas, 0 problemas
```

Oito skills (as sete do kernel + o ponto de entrada `product-designer`), um bloco de memória e um de
kernel. Re-executar é idempotente: nada duplica, nada sobrescreve sem `--force`.

Bloco gravado em `config.toml` (convive com o que já estava lá; backup único em `config.toml.pd-bak`
na primeira escrita, e re-executar não duplica):

```toml
# agent-product-designer:start
[mcp_servers.pd-memory]
command = 'C:\nvm4w\nodejs\node.exe'
args = ['C:\Users\muzph\projetos\agent-product-designer\bin\memory-server.mjs']
startup_timeout_sec = 30

[mcp_servers.pd-memory.env]
PD_WORKSPACE = 'C:\Users\muzph\projetos\agent-product-designer'
PD_CAPS_FILE = 'C:\Users\muzph\projetos\agent-product-designer\budgets\caps.yaml'
# agent-product-designer:end
```

`command` é o **caminho absoluto** do `node.exe`: app gráfico não herda o `PATH` do shell, e `node`
solto funciona no CLI e falha no app. `PD_WORKSPACE` existe pelo mesmo motivo — sem ele o servidor
resolve o `cwd` do host e a memória cai em lugar imprevisível.

Depois de instalar: **reinicie o app**. Em `Settings → MCP servers` (ou `/mcp` no composer) o
`pd-memory` deve aparecer habilitado.

## Prova de ponta a ponta

O host é o mesmo para o app e para o CLI, então dá para provar a integração sem abrir a interface.
Rodado no repo, com o modelo corrigido na linha de comando (ver Limites):

```bash
codex exec -m gpt-5.5 -c sandbox_mode='"workspace-write"' \
  "Chame pd-memory/read_caps; registre DL-teste-mcp com record_decision; rode node gates/run.mjs docs/delivery/phase-2"
```

Saída real, resumida:

```
{"flatKeyCount": 11, "recorded": "DL-teste-mcp", "isError": false}
PASS r1 / PASS r2 / PASS r3  →  resultado: PASS (0 violacoes, 0 incertezas)
```

E o efeito no disco, com o host como autor:

```
$ wc -l decision-log/decisions.jsonl     # 0 antes  →  1 depois
{"id":"DL-teste-mcp","decision":"teste de integracao do MCP a partir do host",
 "strategy_ref":"#p1-problema","evidence":["tests/mcp-smoke.mjs"],"recorded_at":"2026-10-12T19:22:10.814Z"}
```

Três coisas ficaram provadas juntas: o servidor MCP sobe pelo host, a ferramenta de recusa **grava**
decisão completa, e os três portões rodam dentro da sessão do host.

## Limites medidos (não teoria)

1. **`AGENTS.md` global é global.** O bloco vale para toda sessão do app, não só para design. Texto
   curto de propósito — é contexto que entra em tudo.
2. **Skills sofrem corte de contexto.** O host avisou: *"Skill descriptions were shortened to fit the
   skills context budget"*. Todas continuam visíveis; as descrições encolhem. Skill que não se usa
   deve ser desabilitada (`[[skills.config]]` com `enabled = false`) para liberar espaço.
3. **Modelo do CLI ≠ modelo do app.** O `config.toml` estava com `gpt-6-luna`, que funciona no app e
   foi **recusado** pelo CLI (`model is not supported when using Codex with a ChatGPT account`). Para
   testar por linha de comando, passe `-m` explícito.
4. **Sandbox.** O CLI abriu `sandbox: read-only` por padrão: leitura de portão passa, escrita de
   memória não. Necessário `-c sandbox_mode='"workspace-write"'`. No app, isso é a permissão de
   acesso da sessão.
5. **Sem Node, sem portão no host** — só no ChatGPT web. Ali use `dist/chatgpt/gates.py`
   (stdlib, paridade provada em `dist/chatgpt/PARITY.md`); o MCP de memória não existe nesse caminho.

## O que o app **não** ganha

Nada de hooks, subagents, slash commands ou rules do Agent Plugins Spec 1.0.0: o app normatiza MCP e
skills, e só. O portão continua sendo um processo Node que alguém precisa mandar rodar — o bloco do
`AGENTS.md` é o que faz o agente lembrar, e é texto, não enforcement.
