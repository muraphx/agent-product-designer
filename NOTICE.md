# NOTICE — terceiros vendorizados

Três skills de terceiros são redistribuídas **completas** em `skills/`. O agente carrega o texto
original; o kernel não reescreve nem resume skill de terceiro — quem cita é o upstream.

| Skill | Origem | Versão | Licença | Estado |
|---|---|---|---|---|
| `impeccable` | github.com/pbakaus/impeccable | 4.5.2 | Apache-2.0 | completa (57 arquivos, todas as referências citadas presentes) |
| `hallmark` | github.com/nutlope/hallmark | 1.1.0 | MIT | completa (107 arquivos) |
| `motion-design` | awesomeskill.ai/skill/lottiefiles-motion-design-skill-motion-design | 1.0.0 | MIT (declarada) | completa (17 arquivos) |

Arquivos de licença em `vendor-licenses/`:

- `impeccable-APACHE-2.0.txt` — LICENSE do tarball oficial upstream.
- `hallmark-MIT.txt` — LICENSE do repositório upstream.
- motion-design: o pacote distribuído **não traz arquivo de licença**; a licença MIT é a declarada
  na listagem de origem. Registrado como pendência de verificação em `vendor-status.json`.

## Skills próprias (licença do repositório, MIT)

`design-process`, `strategy-trace`, `anti-slop` — escritas para este repo, uma por regra dura.
Não contêm texto de terceiros.

## Regra de vendorização

Só entra em `skills/` o que está completo: nome do diretório igual ao `name` do frontmatter,
`description` presente e **toda referência citada presente no disco**. O teste `# 8` da suíte
verifica isso a cada execução — foi assim que a vendorização pela metade (hallmark com 66 KB de
SKILL.md citando 28 referências ausentes) foi detectada e corrigida.

## Harness de medicao vendorizado (designcourt)

Alem das skills, este repo vendoriza o **juiz** e o **harness de benchmark** do repositorio
`designcourt` (MIT), commit `d568871`, copiados verbatim em 2026-10-12:

| O que | Onde | Licenca |
|---|---|---|
| juiz deterministico (`judge.mjs`, `checks.mjs`, `dom.mjs`, `cli.mjs`, fixtures, `spec/CHECKS.md`) | `judge/` | MIT (upstream) |
| skill `designcourt-judge` | `skills/designcourt-judge/` | MIT (upstream) |
| metricas, corpus rotulado e builder do corpus | `bench/lib/metrics.mjs`, `bench/corpus/`, `bench/build-corpus.mjs` | MIT (upstream) |
| protocolo de medicao da Lane A | `bench/spec/BENCH-PROTOCOL.md` | MIT (upstream) |

Nada de terceiro foi reescrito: onde um caminho de import mudou, so o caminho mudou.
`judge/VENDORED.md` e `bench/VENDORED.md` registram arquivo por arquivo com sha256.
`bench/lib/adapters.mjs` e `bench/run-lane-a.mjs` sao deste repo, nao do upstream.
