---
name: strategy-trace
description: Use when recording or auditing the link between a design choice and the strategy that justifies it — creating decision-log entries, naming tokens, or checking coverage of tokens by decisions. Enforces gate r2 (no decision without strategy). Not for writing the strategy itself.
license: MIT
compatibility: Requires Node 22+ to run gate r2 (node gates/run.mjs <dir>).
---

# strategy-trace — nenhuma decisão sem estratégia (R2)

O que separa este agente de um gerador de tela bonita: **todo valor no artefato aponta para uma
decisão registrada, e toda decisão aponta para uma linha da estratégia com evidência**. Isso é
verificável por máquina, não por retórica.

## Anatomia de uma decisão

`decision-log/DL-0001-slug.md`:

```markdown
---
id: DL-0001
status: active            # active | superseded | rejected
strategy_ref: "#p3"       # âncora obrigatória; precisa existir em strategy.md
evidence:
  - "02-discover-evidence.md#E41 — 3 fontes concordam que X"
covers:                   # tokens que esta decisão justifica
  - color.accent
  - color.ink
affects:
  - design/tokens.json
---

Escolha: um único accent, hue fora da faixa 250–300.
Alternativa descartada: gradiente violeta (tell de slop; barrado por r1).
Critério de reversão: se o uso crescer para 2 superfícies distintas, reabrir.
```

Regras do portão `r2`:

1. `strategy_ref` precisa resolver para um título existente em `strategy.md`. Referência morta =
   `fail`. Estratégia é documento vivo; apontar para o nada é decoração.
2. Todo token em `design/tokens.json` precisa estar coberto por alguma decisão (`covers`). Token
   órfão = `fail` — é assim que "escolhi porque ficou bom" é mecanicamente impossível.
3. Toda decisão precisa de pelo menos uma `evidence` não vazia.
4. `affects` precisa apontar para caminho que existe. Decisão sobre arquivo fantasma = `fail`.
5. `status: superseded`/`rejected` mantém histórico; a decisão substituída não pode ser a única
   cobertura do token (o portão reprova).

## Como registrar sem travar o trabalho

- Escreveu um token novo → escreveu (ou atualizou) a decisão no mesmo passo. Não depois.
- Descobriu que a decisão antiga estava errada → nova entrada `superseded` + nova `active`. Não
  reescrever a história: o rastro é o produto.
- Não conseguiu justificar um valor → o valor sai do artefato. Um valor a menos não é perda; valor
  sem razão é slop por definição.

## Diferente de burocracia

Cinco linhas por decisão, não cinco páginas. O que se exige é **rastreabilidade**, não cerimônia.
Se uma decisão não muda o artefato, ela não precisa existir.

## Auditoria rápida

```
node gates/run.mjs <dir>          # r2 entre os três
node gates/run.mjs <dir> --json   # achados com arquivo e linha
```

`incomplete` aparece quando o portão não consegue decidir (ex.: tokens em formato que ele não
interpreta). Incerto nunca vira `fail` — e nunca vira silêncio.
