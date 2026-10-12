# VENDORED: judge (designcourt judge)

Copiado **verbatim** do repositorio upstream. Onde o caminho de import mudou, so o caminho mudou.

| campo | valor |
|---|---|
| repositorio upstream | `C:/Users/muzph/projetos/designcourt` (designcourt, designcourt judge v1.0) |
| commit | `d568871` |
| data da copia | 2026-10-12 |
| licenca | MIT (mesma do repositorio upstream, ver LICENSE) |
| arquivos | 10 |

Ajustes aplicados na copia: nenhum. Os quatro modulos do juiz importam apenas `./dom.mjs` e
`./checks.mjs`, ambos no mesmo diretorio, entao a mudanca de profundidade
(`src/judge/` -> `judge/src/`) nao quebrou import relativo algum. Verificado:
`grep -rn "\.\./\.\./" judge/` nao retorna nada dentro de `judge/`.

## Arquivos e sha256

| arquivo | sha256 |
|---|---|
| `judge/src/judge.mjs` | `5af26393bb1e445793c8effbe477cca990108019a51b03020576ec5a4b029225` |
| `judge/src/checks.mjs` | `9e1aa007f2d4e75e0f433a63b3d60e5d16507822f8349d39b8ed13a43aeb27a7` |
| `judge/src/dom.mjs` | `8cab64916a9bc5139671a2ebb3638625d346ef68ade32d58d85a3a6409c57881` |
| `judge/src/cli.mjs` | `e25bab09284ac4c2537b7453744872260178623c3d9847ee1eee2239fe768128` |
| `judge/src/__fixtures__/clean.html` | `f346e08a0415510120a160caf1625b6bd5feacb8147f3df48876452b399e6da6` |
| `judge/src/__fixtures__/escape-regression.html` | `bd61a7d36fa63cc987fae1b4535c864877bf4ce9542574e95db3b91c66534f73` |
| `judge/src/__fixtures__/slop.html` | `9cd2b59175df95a6fd3bb0a5a54f6723fdccb68cf48a928736aef9db767a50ea` |
| `skills/designcourt-judge/SKILL.md` | `e6d0e80f49e6d4cec05945b9e9ab2830cd84e8f16ae5abed19a1f308798da72e` |
| `judge/spec/CHECKS.md` | `090486af160586002145312bf31beeb3c0a819a6f4c56e516812b8ab625ee4f9` |
| `bench/spec/BENCH-PROTOCOL.md` | `79fb948efd88396a4d5deba05d903c1c46915bb62f9e5ebaa15a1bf7afe42038` |

`judge/spec/CHECKS.md` e a lista de checagens citada pelo juiz.
`bench/spec/BENCH-PROTOCOL.md` e o protocolo de medicao da Lane A.
`skills/designcourt-judge/SKILL.md` e a skill vendorizada (name do frontmatter == nome do diretorio).
