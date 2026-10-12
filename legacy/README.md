# legacy/ — esqueleto anterior, mantido como registro

Estes arquivos são a primeira tentativa de montar o agente (antes da pesquisa). Estão aqui porque
a pesquisa os mediu, e o diagnóstico é parte do valor do repo. **Nada aqui é operante.** O kernel
vivo está na raiz (`gates/`, `skills/`, `budgets/`, `AGENTS.md`).

## Por que foi aposentado

Verificado no disco em 12/out/2026:

- `agent.json` declara conectores `hermes/` e `chatgpt/` em `connectors/`. **Nenhum dos dois
  existe**: só há `claude/` e `cursor/`. Promessa de portabilidade que o disco não cumpre.
- `memory/taste-profile.json` define `accent: #6366f1` (violeta) e, no mesmo arquivo, lista
  `"generic purple AI hero gradients"` como anti-padrão. O perfil contradiz a si próprio — e
  ninguém o lia, porque nenhum client carrega `memory/*.json`.
- Skills de terceiros vendorizadas pela metade: `motion-design` com 1 de 17 arquivos, `impeccable`
  com 2 de ~24 referências. Uma skill que aponta para arquivos ausentes é pior que não ter skill.
- `GATES.md` descreve os três portões em prosa, mas **não há teste**. Prosa não recusa entrega.

## O que foi mantido como ideia

As três regras duras (sem AI slop, sem decisão sem estratégia, sem excessos) sobreviveram — como
portões executáveis (`gates/r1-anti-slop.mjs`, `r2-trace.mjs`, `r3-budgets.mjs`) e testes. A
diferença entre o que está aqui e o kernel é exatamente essa: aqui é promessa, lá é código que
falha.
