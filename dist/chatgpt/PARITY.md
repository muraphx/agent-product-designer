# PARITY.md — port Python (`dist/chatgpt/gates.py`) vs runner Node (`gates/run.mjs`)

Evidencia crua de paridade. Todo bloco deste arquivo e saida de comando; nada foi escrito a mao.

## Ambiente da medicao

- maquina: win32 10.0.26200, x64
- node: v24.12.0 (via `node --version`)
- python: 3.11.16 (via `python --version`)
- raiz do repo / cwd de todas as execucoes: `C:\Users\muzph\projetos\agent-product-designer`
- data: 2026-10-12

## Comandos exatos

```text
node gates/run.mjs <alvo>
python dist/chatgpt/gates.py <alvo>
node gates/run.mjs <alvo> --json
python dist/chatgpt/gates.py <alvo> --json --caps budgets/caps.yaml
```

O `--caps budgets/caps.yaml` no lado python existe para que a linha do teto seja comparavel:
o Node le o teto de `gates/../budgets/caps.yaml` e imprime o caminho relativo ao cwd, enquanto o
port resolve o teto na ordem exigida (argv, ao lado do script, subindo do alvo) e encontra
`dist/chatgpt/budgets/caps.yaml`. O arquivo e copia byte a byte do do repo:

- sha256 `budgets/caps.yaml`: `167137e9010cb9a8203c2d9916d5e48a7c6f7027962f47d47402b80f24738a1e`
- sha256 `dist/chatgpt/budgets/caps.yaml`: `167137e9010cb9a8203c2d9916d5e48a7c6f7027962f47d47402b80f24738a1e`

## Alvos

Todos os alvos abaixo foram rodados nos dois lados. Nenhum foi pulado.

- `examples/landing` — alvo de referencia publicado.
- `docs/delivery/phase-2` — entrega da fase 2.
- `tests/fixtures/clean`, `tests/fixtures/slop`, `tests/fixtures/untraced`, `tests/fixtures/overcap`,
  `tests/fixtures/uncertain` — os cinco fixtures gerados por `tests/build-fixtures.mjs`; todos tem `design/`.
- `tests/fixtures` — o diretorio pai, que e alvo de portao valido (sem `design/`, com subdiretorios):
  o runner Node **nao** recusa (exit 2 so acontece com alvo inexistente ou nao-diretorio; ver secao de erros).

## Resumo — veredito, contagem e rule ids

| alvo | exit node | exit python | veredito node | veredito python | violacoes node | violacoes python | rule ids iguais | saida byte a byte igual (com `--caps`) |
|---|---|---|---|---|---|---|---|---|
| `examples/landing` | 0 | 0 | pass | pass | 0 | 0 | sim | sim |
| `docs/delivery/phase-2` | 0 | 0 | pass | pass | 0 | 0 | sim | sim |
| `tests/fixtures/clean` | 0 | 0 | pass | pass | 0 | 0 | sim | sim |
| `tests/fixtures/slop` | 1 | 1 | fail | fail | 7 | 7 | sim | sim |
| `tests/fixtures/uncertain` | 0 | 0 | incomplete | incomplete | 0 | 0 | sim | sim |
| `tests/fixtures/overcap` | 1 | 1 | fail | fail | 1 | 1 | sim | sim |
| `tests/fixtures/untraced` | 1 | 1 | fail | fail | 7 | 7 | sim | sim |
| `tests/fixtures` | 1 | 1 | fail | fail | 3 | 3 | sim | sim |

**Nenhum alvo difere em veredito, em contagem de violacoes/incertezas ou no conjunto de rule ids.**
Com `--caps budgets/caps.yaml`, a saida legivel e a saida `--json` do python sao identicas byte a byte
as do Node nos oito alvos.

## Saida bruta por alvo

### `examples/landing`

node — exit 0, veredito `pass`, violacoes [-], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\examples\landing
teto: version 1 (budgets\caps.yaml)

PASS        r1
PASS        r2
PASS        r3

resultado: PASS (0 violacoes, 0 incertezas)
```

python — exit 0, veredito `pass`, violacoes [-], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\examples\landing
teto: version 1 (dist\chatgpt\budgets\caps.yaml)

PASS        r1
PASS        r2
PASS        r3

resultado: PASS (0 violacoes, 0 incertezas)
```

`diff` entre as duas saidas acima (2 linha(s) de diferenca):

```diff
--- node
+++ python
@@ -2 +2 @@
-teto: version 1 (budgets\caps.yaml)
+teto: version 1 (dist\chatgpt\budgets\caps.yaml)
```

Mesmos dois comandos, lado python com `--caps budgets/caps.yaml`:

- saida legivel vs Node: **identica byte a byte**
- saida `--json` vs Node: **identica byte a byte**

### `docs/delivery/phase-2`

node — exit 0, veredito `pass`, violacoes [-], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\docs\delivery\phase-2
teto: version 1 (budgets\caps.yaml)

PASS        r1
PASS        r2
PASS        r3

resultado: PASS (0 violacoes, 0 incertezas)
```

python — exit 0, veredito `pass`, violacoes [-], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\docs\delivery\phase-2
teto: version 1 (dist\chatgpt\budgets\caps.yaml)

PASS        r1
PASS        r2
PASS        r3

resultado: PASS (0 violacoes, 0 incertezas)
```

`diff` entre as duas saidas acima (2 linha(s) de diferenca):

```diff
--- node
+++ python
@@ -2 +2 @@
-teto: version 1 (budgets\caps.yaml)
+teto: version 1 (dist\chatgpt\budgets\caps.yaml)
```

Mesmos dois comandos, lado python com `--caps budgets/caps.yaml`:

- saida legivel vs Node: **identica byte a byte**
- saida `--json` vs Node: **identica byte a byte**

### `tests/fixtures/clean`

node — exit 0, veredito `pass`, violacoes [-], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\clean
teto: version 1 (budgets\caps.yaml)

PASS        r1
PASS        r2
PASS        r3

resultado: PASS (0 violacoes, 0 incertezas)
```

python — exit 0, veredito `pass`, violacoes [-], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\clean
teto: version 1 (dist\chatgpt\budgets\caps.yaml)

PASS        r1
PASS        r2
PASS        r3

resultado: PASS (0 violacoes, 0 incertezas)
```

`diff` entre as duas saidas acima (2 linha(s) de diferenca):

```diff
--- node
+++ python
@@ -2 +2 @@
-teto: version 1 (budgets\caps.yaml)
+teto: version 1 (dist\chatgpt\budgets\caps.yaml)
```

Mesmos dois comandos, lado python com `--caps budgets/caps.yaml`:

- saida legivel vs Node: **identica byte a byte**
- saida `--json` vs Node: **identica byte a byte**

### `tests/fixtures/slop`

node — exit 1, veredito `fail`, violacoes [ai-gradient, ai-gradient, decorative-emoji, stock-copy, stock-copy, stock-copy, stock-copy], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\slop
teto: version 1 (budgets\caps.yaml)

FAIL        r1
   fail  [ai-gradient] design/index.html:66 — linear-gradient(135deg, #7c3aed, #6d28d9) com stop violeta #7c3aed, #6d28d9 (hue 250-300, sat>=0.25)
   fail  [ai-gradient] design/index.html:13 — classe utilitaria de violeta: bg-violet-600
   fail  [decorative-emoji] design/index.html:12 — emoji em texto visivel: ✨ (code point U+2728)
   fail  [stock-copy] design/index.html — frase de catalogo: "unlock the power"
   fail  [stock-copy] design/index.html — frase de catalogo: "eleve seu"
   fail  [stock-copy] design/index.html — frase de catalogo: "sem esforço"
   fail  [stock-copy] design/index.html — frase de catalogo: "de ponta"
PASS        r2
PASS        r3

resultado: FAIL (7 violacoes, 0 incertezas)
entrega recusada: corrija a causa, nunca o relatorio.
```

python — exit 1, veredito `fail`, violacoes [ai-gradient, ai-gradient, decorative-emoji, stock-copy, stock-copy, stock-copy, stock-copy], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\slop
teto: version 1 (dist\chatgpt\budgets\caps.yaml)

FAIL        r1
   fail  [ai-gradient] design/index.html:66 — linear-gradient(135deg, #7c3aed, #6d28d9) com stop violeta #7c3aed, #6d28d9 (hue 250-300, sat>=0.25)
   fail  [ai-gradient] design/index.html:13 — classe utilitaria de violeta: bg-violet-600
   fail  [decorative-emoji] design/index.html:12 — emoji em texto visivel: ✨ (code point U+2728)
   fail  [stock-copy] design/index.html — frase de catalogo: "unlock the power"
   fail  [stock-copy] design/index.html — frase de catalogo: "eleve seu"
   fail  [stock-copy] design/index.html — frase de catalogo: "sem esforço"
   fail  [stock-copy] design/index.html — frase de catalogo: "de ponta"
PASS        r2
PASS        r3

resultado: FAIL (7 violacoes, 0 incertezas)
entrega recusada: corrija a causa, nunca o relatorio.
```

`diff` entre as duas saidas acima (2 linha(s) de diferenca):

```diff
--- node
+++ python
@@ -2 +2 @@
-teto: version 1 (budgets\caps.yaml)
+teto: version 1 (dist\chatgpt\budgets\caps.yaml)
```

Mesmos dois comandos, lado python com `--caps budgets/caps.yaml`:

- saida legivel vs Node: **identica byte a byte**
- saida `--json` vs Node: **identica byte a byte**

### `tests/fixtures/uncertain`

node — exit 0, veredito `incomplete`, violacoes [-], incertezas [centered-everything, over-rounded]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\uncertain
teto: version 1 (budgets\caps.yaml)

INCOMPLETE  r1
   incerto [centered-everything] design/index.html — 44% centralizado, faixa duvidosa (40-60%) — padrao pode ser legitimo
PASS        r2
INCOMPLETE  r3
   incerto [over-rounded] design/tokens.json — um raio >= 24px: pode ser pill legitimo — decisao humana

resultado: INCOMPLETE (0 violacoes, 2 incertezas)
entrega permitida com incerteza declarada — o humano decide.
```

python — exit 0, veredito `incomplete`, violacoes [-], incertezas [centered-everything, over-rounded]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\uncertain
teto: version 1 (dist\chatgpt\budgets\caps.yaml)

INCOMPLETE  r1
   incerto [centered-everything] design/index.html — 44% centralizado, faixa duvidosa (40-60%) — padrao pode ser legitimo
PASS        r2
INCOMPLETE  r3
   incerto [over-rounded] design/tokens.json — um raio >= 24px: pode ser pill legitimo — decisao humana

resultado: INCOMPLETE (0 violacoes, 2 incertezas)
entrega permitida com incerteza declarada — o humano decide.
```

`diff` entre as duas saidas acima (2 linha(s) de diferenca):

```diff
--- node
+++ python
@@ -2 +2 @@
-teto: version 1 (budgets\caps.yaml)
+teto: version 1 (dist\chatgpt\budgets\caps.yaml)
```

Mesmos dois comandos, lado python com `--caps budgets/caps.yaml`:

- saida legivel vs Node: **identica byte a byte**
- saida `--json` vs Node: **identica byte a byte**

### `tests/fixtures/overcap`

node — exit 1, veredito `fail`, violacoes [over-cap-colors], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\overcap
teto: version 1 (budgets\caps.yaml)

PASS        r1
PASS        r2
FAIL        r3
   fail  [over-cap-colors] design/tokens.json — 14 cores > teto 12 (tokens.colors_max)

resultado: FAIL (1 violacoes, 0 incertezas)
entrega recusada: corrija a causa, nunca o relatorio.
```

python — exit 1, veredito `fail`, violacoes [over-cap-colors], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\overcap
teto: version 1 (dist\chatgpt\budgets\caps.yaml)

PASS        r1
PASS        r2
FAIL        r3
   fail  [over-cap-colors] design/tokens.json — 14 cores > teto 12 (tokens.colors_max)

resultado: FAIL (1 violacoes, 0 incertezas)
entrega recusada: corrija a causa, nunca o relatorio.
```

`diff` entre as duas saidas acima (2 linha(s) de diferenca):

```diff
--- node
+++ python
@@ -2 +2 @@
-teto: version 1 (budgets\caps.yaml)
+teto: version 1 (dist\chatgpt\budgets\caps.yaml)
```

Mesmos dois comandos, lado python com `--caps budgets/caps.yaml`:

- saida legivel vs Node: **identica byte a byte**
- saida `--json` vs Node: **identica byte a byte**

### `tests/fixtures/untraced`

node — exit 1, veredito `fail`, violacoes [token-uncovered, token-uncovered, token-uncovered, token-uncovered, token-uncovered, token-uncovered, token-uncovered], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\untraced
teto: version 1 (budgets\caps.yaml)

PASS        r1
FAIL        r2
   fail  [token-uncovered] design/tokens.json — token "font.weight" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "motion.base" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "motion.fast" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "radius.md" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "radius.sm" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "shadow.hairline" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "shadow.lift" sem decisao ativa que o justifique (covers)
PASS        r3

resultado: FAIL (7 violacoes, 0 incertezas)
entrega recusada: corrija a causa, nunca o relatorio.
```

python — exit 1, veredito `fail`, violacoes [token-uncovered, token-uncovered, token-uncovered, token-uncovered, token-uncovered, token-uncovered, token-uncovered], incertezas [-]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures\untraced
teto: version 1 (dist\chatgpt\budgets\caps.yaml)

PASS        r1
FAIL        r2
   fail  [token-uncovered] design/tokens.json — token "font.weight" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "motion.base" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "motion.fast" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "radius.md" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "radius.sm" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "shadow.hairline" sem decisao ativa que o justifique (covers)
   fail  [token-uncovered] design/tokens.json — token "shadow.lift" sem decisao ativa que o justifique (covers)
PASS        r3

resultado: FAIL (7 violacoes, 0 incertezas)
entrega recusada: corrija a causa, nunca o relatorio.
```

`diff` entre as duas saidas acima (2 linha(s) de diferenca):

```diff
--- node
+++ python
@@ -2 +2 @@
-teto: version 1 (budgets\caps.yaml)
+teto: version 1 (dist\chatgpt\budgets\caps.yaml)
```

Mesmos dois comandos, lado python com `--caps budgets/caps.yaml`:

- saida legivel vs Node: **identica byte a byte**
- saida `--json` vs Node: **identica byte a byte**

### `tests/fixtures`

node — exit 1, veredito `fail`, violacoes [no-decisions, strategy-missing, tokens-missing-or-invalid], incertezas [artifact-missing]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures
teto: version 1 (budgets\caps.yaml)

INCOMPLETE  r1
   incerto [artifact-missing] design/index.html — nenhum artefato HTML encontrado — nao ha o que auditar
FAIL        r2
   fail  [tokens-missing-or-invalid] design/tokens.json — design/tokens.json ausente
   fail  [strategy-missing] strategy.md — strategy.md ausente
   fail  [no-decisions] decision-log/ — nenhuma entrada DL-*.md — nenhuma decisao registrada
PASS        r3

resultado: FAIL (3 violacoes, 1 incertezas)
entrega recusada: corrija a causa, nunca o relatorio.
```

python — exit 1, veredito `fail`, violacoes [no-decisions, strategy-missing, tokens-missing-or-invalid], incertezas [artifact-missing]:

```text
alvo: C:\Users\muzph\projetos\agent-product-designer\tests\fixtures
teto: version 1 (dist\chatgpt\budgets\caps.yaml)

INCOMPLETE  r1
   incerto [artifact-missing] design/index.html — nenhum artefato HTML encontrado — nao ha o que auditar
FAIL        r2
   fail  [tokens-missing-or-invalid] design/tokens.json — design/tokens.json ausente
   fail  [strategy-missing] strategy.md — strategy.md ausente
   fail  [no-decisions] decision-log/ — nenhuma entrada DL-*.md — nenhuma decisao registrada
PASS        r3

resultado: FAIL (3 violacoes, 1 incertezas)
entrega recusada: corrija a causa, nunca o relatorio.
```

`diff` entre as duas saidas acima (2 linha(s) de diferenca):

```diff
--- node
+++ python
@@ -2 +2 @@
-teto: version 1 (budgets\caps.yaml)
+teto: version 1 (dist\chatgpt\budgets\caps.yaml)
```

Mesmos dois comandos, lado python com `--caps budgets/caps.yaml`:

- saida legivel vs Node: **identica byte a byte**
- saida `--json` vs Node: **identica byte a byte**

## `--json` — prova de identidade

`node gates/run.mjs <alvo> --json` vs `python dist/chatgpt/gates.py <alvo> --json --caps budgets/caps.yaml`:

```text
examples/landing             identico byte a byte
docs/delivery/phase-2        identico byte a byte
tests/fixtures/clean         identico byte a byte
tests/fixtures/slop          identico byte a byte
tests/fixtures/uncertain     identico byte a byte
tests/fixtures/overcap       identico byte a byte
tests/fixtures/untraced      identico byte a byte
tests/fixtures               identico byte a byte
```

Os dois JSONs carregam o mesmo `target` absoluto, o mesmo `status`, a mesma `caps.file`
(o `--caps` faz o caminho bater), as mesmas violacoes com as mesmas linhas e a mesma `evidence`,
e as mesmas `metrics` de r2/r3 (inclusive `centered_ratio`, `sections`, `words`, `uncovered_tokens`).

## `--strict` — mesma barra para incerteza

```text
$ node gates/run.mjs tests/fixtures/uncertain --strict
  -> exit 1
$ python dist/chatgpt/gates.py tests/fixtures/uncertain --strict --caps budgets/caps.yaml
  -> exit 1, saida identica byte a byte
$ node gates/run.mjs tests/fixtures/clean --strict
  -> exit 0
$ python dist/chatgpt/gates.py tests/fixtures/clean --strict --caps budgets/caps.yaml
  -> exit 0, saida identica byte a byte
$ node gates/run.mjs examples/landing --strict
  -> exit 0
$ python dist/chatgpt/gates.py examples/landing --strict --caps budgets/caps.yaml
  -> exit 0, saida identica byte a byte
$ node gates/run.mjs tests/fixtures/slop --strict
  -> exit 1
$ python dist/chatgpt/gates.py tests/fixtures/slop --strict --caps budgets/caps.yaml
  -> exit 1, saida identica byte a byte
```

## Erros de uso/ambiente — exit 2

```text
$ node gates/run.mjs nao-existe
alvo nao e um diretorio: C:\Users\muzph\projetos\agent-product-designer\nao-existe
  -> exit 2
$ python dist/chatgpt/gates.py nao-existe
alvo nao e um diretorio: C:\Users\muzph\projetos\agent-product-designer\nao-existe
  -> exit 2
$ node gates/run.mjs
uso: node gates/run.mjs <dir-do-artefato> [--json] [--strict]
  -> exit 2
$ python dist/chatgpt/gates.py
uso: python gates.py <dir-do-artefato> [--json] [--strict] [--caps <arquivo>]
  -> exit 2
$ python dist/chatgpt/gates.py examples/landing --caps dist/chatgpt/budgets/nao-existe.yaml
teto invalido: caps.yaml nao encontrado: C:\Users\muzph\projetos\agent-product-designer\dist\chatgpt\budgets\nao-existe.yaml
  -> exit 2
```

A mensagem de uso difere no nome do programa e na flag extra (`--caps`), que o Node nao tem.
O codigo de saida e o mesmo (2).

## Divergencias residuais (medidas, nao supostas)

### 1. Caminho do teto na execucao default (sem `--caps`) — so o texto da linha `teto:`

O port resolve o teto na ordem exigida: `--caps`, depois `budgets/caps.yaml` ao lado do script,
depois subindo do alvo. Rodando da raiz do repo, o port acha `dist/chatgpt/budgets/caps.yaml`,
entao imprime `teto: version 1 (dist\chatgpt\budgets\caps.yaml)` onde o Node imprime
`teto: version 1 (budgets\caps.yaml)`. Mesmo `version` (1), arquivo identico byte a byte
(sha256 igual, acima) e **nenhum efeito em veredito, contagem ou rule ids**.
Com `--caps budgets/caps.yaml` a linha fica identica e a saida inteira tambem.

### 2. Texto do erro quando `design/tokens.json` tem JSON invalido

Caminho nao exercitado por nenhum alvo do repo (todos tem `tokens.json` valido ou ausente).
Medido num alvo temporario com `design/tokens.json` = `{ nope`:

```text
node   exit 1  rule tokens-missing-or-invalid
       evidence: design/tokens.json invalido: Expected property name or '}' in JSON at position 2 (line 1 column 3)
python exit 1  rule tokens-missing-or-invalid
       evidence: design/tokens.json invalido: Expecting property name enclosed in double quotes: line 1 column 3 (char 2)
```

Mesmo rule id, mesma linha (`line: 0`), mesmo veredito (`fail`), mesmo exit (1). So a redacao da
mensagem do parser difere: V8 diz `Expected property name or ... in JSON at position 2 (line 1 column 3)`,
CPython diz `Expecting property name enclosed in double quotes: line 1 column 3 (char 2)`.
Nao ha como unificar sem reimplementar o parser do V8; a evidencia e diagnostico humano, nao regra.

### 3. `--caps` e flag nova (so do port)

O Node nao conhece `--caps`: para ele o valor viraria argumento posicional e a execucao cairia
em `uso:` com exit 2. A evidencia de identidade byte a byte acima usa `--caps budgets/caps.yaml`
no lado python justamente para neutralizar a divergencia 1.

### 4. Fora do escopo do port (nao replicado, por decisao)

- servidor MCP de memoria (`bin/memory-server.mjs`), scripts npm, `install.mjs`, skills vendorizadas, `bench/`.
- `tests/` e `bench/` continuam rodando so no Node; o port nao os substitui.

## `python dist/chatgpt/gates.py --self-check`

exit 0

```text
self-check do port python (sem Node, sem alvo, sem repo)

  ok   caps: resolve o teto
  ok   caps: version 1
  ok   caps: tokens.colors_max 12
  ok   caps: copy.words_max 1200
  ok   caps: nenhum teto orfao
  ok   caps: CAP_KEYS cobre tudo
  ok   caps: rejeita tabulacao
  ok   caps: rejeita lista em bloco
  ok   caps: rejeita chave duplicada
  ok   caps: rejeita valor vazio no array inline
  ok   caps: rejeita chave sem valor nem filhos
  ok   caps: aceita escalares e array inline
  ok   estrutura: conta todas as sections
  ok   estrutura: conta filhos diretos, nao netos
  ok   estrutura: html bem formado
  ok   estrutura: bloco largo conta 4
  ok   estrutura: section aninhada conta 1
  ok   estrutura: html desbalanceado nao passa por bom
  ok   cor: hexToRgb 6 digitos
  ok   cor: hexToRgb 3 digitos
  ok   cor: contraste preto/branco = 21
  ok   cor: violeta na faixa 250-300
  ok   cor: verde nao e violeta
  ok   formato: toFixed(0.4444, 2) = 0.44
  ok   formato: toFixed(1.005, 2) = 1.00 (duplo, nao decimal)
  ok   formato: toFixed(2.5, 0) = 3 (empate para cima)
  ok   formato: js_num(4.0) = 4
  ok   imports: apenas biblioteca padrao
  ok   fim a fim: alvo limpo exit 0
  ok   fim a fim: alvo limpo status pass
  ok   fim a fim: alvo limpo 0 violacoes e 0 incertezas
  ok   fim a fim: medicao conta as 2 sections do alvo sintetico
  ok   fim a fim: rastro cobre todos os tokens
  ok   fim a fim: resumo legivel exato
  ok   fim a fim: linha do teto presente
  ok   fim a fim: gradiente violeta acusa ai-gradient
  ok   fim a fim: fail derruba com exit 1
  ok   fim a fim: token sem decisao acusa token-uncovered
  ok   fim a fim: token-uncovered derruba com exit 1
  ok   fim a fim: --caps com teto apertado acusa over-cap-colors
  ok   fim a fim: teto resolvido vem do --caps
  ok   fim a fim: 50% centralizado vira incerto, nunca fail
  ok   fim a fim: --strict derruba o incerto (exit 1)
  ok   uso: alvo inexistente = exit 2
  ok   uso: sem alvo = exit 2 com a linha de uso
  ok   uso: --caps inexistente = exit 2

self-check: PASS (46 checagens, 0 falhas)
```

## Sandbox sem Node — resolucao do teto (medido)

So `gates.py` e `budgets/caps.yaml` foram copiados para `port/`; o alvo e uma copia de
`examples/landing` em `art/`. Nenhum Node envolvido, nenhum repo em volta.

```text
$ cd port && python gates.py ../art     # caps ao lado do script
alvo: C:\tmp\sandbox2\art
teto: version 1 (budgets\caps.yaml)

PASS        r1
PASS        r2
PASS        r3

resultado: PASS (0 violacoes, 0 incertezas)
  -> exit 0

$ mkdir ../budgets && mv budgets/caps.yaml ../budgets/caps.yaml && rmdir budgets
$ python gates.py ../art                # sem caps ao lado do script: sobe a partir do alvo
alvo: C:\tmp\sandbox2\art
teto: version 1 (..\budgets\caps.yaml)

PASS        r1
PASS        r2
PASS        r3

resultado: PASS (0 violacoes, 0 incertezas)
  -> exit 0

$ rm ../budgets/caps.yaml && rmdir ../budgets && python gates.py ../art
$                                       # nenhum caps em lugar nenhum
teto invalido: caps.yaml nao encontrado: C:\tmp\sandbox2\port\budgets\caps.yaml (nem subindo a partir de C:\tmp\sandbox2\art)
  -> exit 2
```

Com o teto ao lado do script (o arranjo para o qual o port existe), a linha sai
`teto: version 1 (budgets\caps.yaml)` — identica a do Node. A divergencia 1 acima e so o efeito
de rodar o port de dentro do repo, onde o candidato 2 (ao lado do script) vem antes do
`budgets/` da raiz.
