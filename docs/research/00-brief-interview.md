# 00 — Brief de pesquisa (entrevista com o stakeholder)

**Data:** 2026-10-12 · **Stakeholder:** Murilo Oliveira (@muraphx), Product Designer, Maringá/PR
**Papel dele no projeto:** humano que decide (aprova / rejeita). Agente decide direção, humano aprova.
**Dito por ele, verbatim:** *"eu sou o humano que aprova ou não"*.

## Respostas da entrevista (evidência primária, não interpretada)

### Q1 — o que é "melhor que um leigo"
> "ele gera resultados onde um humano comum julga como muito bom e funcional"

Implicação: o critério de sucesso **não** é preferência do autor nem nota de modelo.
É **julgamento de humano comum** (leigo) + **funcionalidade**. Métrica candidata:
painel de juízes leigos (não-designers) em escala Likert, com artefato cego A/B contra
baseline "sem agente" e contra baseline "site médio da web".

### Q2 — quem usa e distribuição
> "Eu + publicar aberto no GitHub com instalador de uma linha e benchmark público"

Implicação: **não** é ferramenta privada. Sai com: `npx <algo>` de 1 linha, benchmark
reproduzível e público, licença aberta. O benchmark vira parte do produto (prova).

### Q3 — primeira superfície
> "design system + documentação + delivery"

Implicação: superfície = **design system** (tokens, componentes, estados, governança),
**documentação** (leitura, hierarquia, densidade) e **delivery** (handoff, specs,
checklists de entrega). Motion e interação entram como *camadas do mesmo artefato*,
não como superfície separada.

### Q4 — antipadrões que ele NÃO tolera (regras duras)
> "nao deve gerar ai slop, nem decisoes de design sem estrategia, nem excessos."

Três regras duras, cada uma auditável:

| # | Regra dura | Como vira verificação |
|---|---|---|
| R1 | Sem AI slop | detector determinístico de tells de slop (gradiente roxo, emoji decorativo, sombra excessiva, contraste baixo, `border-radius` aleatório, lorem, hero genérico) |
| R2 | Nenhuma decisão de design sem estratégia | toda escolha (cor, tipo, movimento) tem que ser rastreável a uma decisão de estratégia declarada antes; sem rastro = bloqueio |
| R3 | Sem excessos | tetos numéricos explícitos (nº de cores, pesos tipográficos, raios, sombras, elementos por tela, duração de animação) |

## O que ainda NÃO sei (a pesquisa tem que responder)

- Julgamento de "humano comum" é medível de forma barata e repetível? (qual instrumento, quantos juízes, qual concordância)
- Existe benchmark público de design por agente? Se não existe, o que eu invento precisa ser defensável.
- Um pacote único roda mesmo igual em Claude Code / Codex+ChatGPT / Cursor / Hermes? Quais são os gaps reais?
- O que impede o agente de virar gerador de slop quando o modelo é medíocre?

## Escopo declarado x escopo real

Ele pediu cobertura ampla (estratégia, prática, visual, motion, interação) **e** superfície
focada (design system + documentação + delivery). Isso é coerente: o **corpo de conhecimento**
é amplo; o **primeiro entregável medido** é estreito. A estratégia final tem que respeitar
essa assimetria — cobertura ampla de skills, prova estreita e dura em uma superfície.
