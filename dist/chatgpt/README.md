# Port dos portões sem Node (`dist/chatgpt/`)

> Para **usar o agente no ChatGPT desktop**, o caminho é outro: `node install.mjs --client chatgpt`
> (memória MCP + skills + `AGENTS.md`). Guia verificado em `docs/chatgpt-desktop.md`. Este diretório
> é o plano B para onde **não existe Node** — o sandbox do ChatGPT web, por exemplo.

Port **stdlib-only** de `gates/run.mjs` (+ `r1-anti-slop`, `r2-trace`, `r3-budgets`, `lib/scan`,
`lib/caps`) para rodar os três portões onde **não existe Node** — por exemplo o interpretador de
código do ChatGPT. Python 3.9+, nenhum import de terceiro, nenhuma rede.

Arquivos:

|Arquivo|O que é|
|---|---|
|`gates.py`|os três portões em arquivo único: `r1` (sem AI slop), `r2` (sem decisão sem estratégia), `r3` (sem excessos)|
|`budgets/caps.yaml`|cópia byte a byte de `budgets/caps.yaml` do repo (mesmo sha256) — o teto numérico que o `r3` consulta|
|`PARITY.md`|evidência crua de paridade contra o runner Node (saída dos dois lados, por alvo)|
|`parity.py`|comparador independente: roda `node gates/run.mjs <alvo> --json` e `python dist/chatgpt/gates.py <alvo> --json` no mesmo alvo e diz se divergem|

## Como rodar

```bash
# 1. prova interna: parser do teto, leitura do HTML, formato numérico, fim a fim em diretório
#    temporário. Não precisa de alvo, nem do resto do repo, nem de Node.
python dist/chatgpt/gates.py --self-check

# 2. os três portões num alvo (mesma interface do runner Node)
python dist/chatgpt/gates.py <dir-do-artefato>
python dist/chatgpt/gates.py <dir-do-artefato> --json
python dist/chatgpt/gates.py <dir-do-artefato> --strict
python dist/chatgpt/gates.py <dir-do-artefato> --caps budgets/caps.yaml
```

Saída, mensagens em português, ids de regra e códigos de saída são os mesmos do Node:

- exit `0` = nenhum `fail` (ou `incomplete` sem `--strict`)
- exit `1` = ao menos um `fail` (ou `incomplete` com `--strict`)
- exit `2` = erro de uso/ambiente (alvo inexistente, alvo não-diretorio, teto inválido)

Linhas de resumo idênticas: `teto: version 1 (…)` e
`resultado: PASS|FAIL|INCOMPLETE (N violacoes, M incertezas)`.

## Resolução do teto

Nesta ordem, o primeiro que existir:

1. `--caps <arquivo>` (argv);
2. `budgets/caps.yaml` ao lado do script (`dist/chatgpt/budgets/caps.yaml`);
3. `budgets/caps.yaml` subindo a partir do diretório alvo.

O parser aceita só o subconjunto do `caps.yaml` deste repo — mapas aninhados por indentação de 2
espaços, escalares (int/float/bool/string), comentários com `#`, array inline `[a, b]` — e **falha
alto** em tabulação, lista em bloco, chave duplicada, valor vazio ou chave sem filhos. Não há
PyYAML: parser próprio, `caps.yaml:linha: motivo`.

## O que o port NÃO faz

- **Não** sobe o servidor MCP de memória (`bin/memory-server.mjs`) nem implementa
  `record_decision` / `coverage_gaps`. A memória continua sendo do client, via MCP, no Node.
- **Não** substitui os scripts npm do repo (`gates`, `test`, `bench`, `install`), nem
  `install.mjs`, nem as skills vendorizadas. Nada de `bench/` ou `tests/` foi portado.
- **Não** implementa o modo multiagente, o juiz determinístico (`judge/`) nem o corpus de `bench/`.
- **Não** inventa métrica: se o alvo alega melhoria, ele traz a métrica e a ameaça à validade — o
  port só reproduz o que o Node já reporta.
- **Não** é uma reescrita: é um port. Onde há divergência de texto (não de veredito), ela está
  declarada em `PARITY.md`, na seção "Divergencias residuais".

## Paridade

`PARITY.md` traz a saída bruta dos dois lados para `examples/landing`, `docs/delivery/phase-2`,
os cinco fixtures de `tests/fixtures/` e o diretório `tests/fixtures` inteiro. Resultado medido:
veredito, contagem e conjunto de ids de regra idênticos em todos os alvos; com
`--caps budgets/caps.yaml` no lado python, a saída legível e a saída `--json` são **idênticas byte
a byte** às do Node. As duas divergências residuais (caminho do teto na execução default; texto do
erro de JSON inválido em `tokens.json`) estão medidas e explicadas lá.

Na montagem para a qual o port existe — `gates.py` e `budgets/caps.yaml` copiados juntos para uma
sandbox sem Node — a linha sai `teto: version 1 (budgets/caps.yaml)`, igual à do Node; a evidência
dessa execução está no fim de `PARITY.md`.
