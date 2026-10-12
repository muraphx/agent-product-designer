# Lane A — o detector bate o baseline?

Pré-registro congelado **antes** da medição: `prereg/lane-a.md` (106 linhas). Este arquivo é o
resultado. Se os dois discordarem, o pré-registro ganha.

## Veredito

| Hipótese | Critério | Medido | Veredito |
|---|---|---|---|
| **H1** | F1 do juiz ≥ 2× o F1 do `impeccable` | 0,574 vs 0,124 (4,6×) | **confirmada** |
| **H2** | taxa de escape de blocker do juiz ≤ 0,15 | 0,067 | **confirmada** |
| **H3** | precisão dos portões deste repo ≥ 0,80 nos tells que declaram cobrir | 1,000 | **confirmada** |
| **H4** | duas execuções produzem JSON byte-idêntico | 3 execuções, `595c71866674c924` | **confirmada** |

Condição que mata a tese (escape ≥ 0,25 **ou** F1 < 0,40): **não disparou**. A tese segue viva.

## Placar (corpus completo, 48 páginas)

| Adapter | Cobertura declarada | tp | fp | fn | precisão | recall | F1 | escape | s |
|---|---|---|---|---|---|---|---|---|---|
| `kernel` (portões r1/r2/r3) | 6 tells | 2 | 0 | 91 | 1,000 | 0,022 | 0,042 | 0,867 | 0,6 |
| `judge` (juiz determinístico) | 38 tells | 74 | 91 | 19 | 0,448 | 0,796 | 0,574 | 0,067 | 3,3 |
| `impeccable` 3.6.0 | 5 mapeamentos | 9 | 43 | 84 | 0,173 | 0,097 | 0,124 | 0,133 | 139,2 |
| `gate_baseline` (produto anterior) | 7 mapeamentos | 11 | 181 | 82 | 0,057 | 0,118 | 0,077 | 1,000 | 10,8 |

15 arquivos do corpus são `blocker`. Um arquivo vale 6,7 pontos de escape.

Leitura honesta: **o juiz acusa 74 dos 93 blockers e deixa passar 1** (`escape 0,067`). O `impeccable`
deixa passar 2 e erra 43 vezes para o lado do falso positivo. O baseline anterior deste repo —
os portões que eu publiquei na fase 1 — **escapou 100%**: em todas as 15 páginas bloqueantes ele
não barrou nada. A fase 1 media 6 tells; o corpus exige 93 acusações.

Segunda leitura, menos confortável: o `kernel` tem precisão 1,000 e recall 0,022. Ele quase não
acusa — quando acusa, acerta. Como detector é fraco; como **portão sobre o artefato que o agente
acabou de escrever** (onde o custo de um falso positivo é jogar fora trabalho bom e o custo de uma
acusação perdida é um humano revisando) essa troca é deliberada, e o pré-registro a registra.
1 regra do juiz não foi mapeada para os portões (`stock-copy`) — o JSON lista em `unmapped_rules`.

## Reprodução

```bash
npm run bench          # lane completa (~140s, o `impeccable` é CLI de terceiro via npx)
npm run bench:quick    # kernel + judge (~4s)
npm test               # 158 asserções, inclui o determinismo da lane
```

Relatório de máquina: `bench/results/lane-a.json`.

| Campo | Valor |
|---|---|
| corpus | `bench/corpus/labeled.jsonl`, 48 páginas |
| `corpus_sha256` | `2a89573272b668f2e6...` (completo em `bench/VENDORED.md`) |
| seed | `20261012` |
| Node | `v24.12.0` (Windows 11) |
| `impeccable` | 3.6.0, via `npx --yes impeccable` |
| sha256 do JSON (3 execuções) | `595c71866674c924...` |

Reprodução em Windows, sem TTY: chame o Node pelo **caminho absoluto**
(`C:/nvm4w/nodejs/node.exe bench/run-lane-a.mjs`, visto neste host). Com o nome curto `node`, em
processo sem TTY neste host, o comando é interceptado por um wrapper de shell que imprime
`stdin is not a tty` e sai 1 — a lane morre **antes** de escrever o JSON e o arquivo anterior fica
intacto. Consequência prática: **hash repetido não é prova de determinismo quando o exit code é
diferente de 0** — confira o exit antes de ler o sha256. Com o caminho absoluto, a mesma lane roda
headless em background e reproduz `595c71866674c924...`.
(O adapter `impeccable` também roda com `stdio: ['ignore','pipe','pipe']` e `npx --yes`, defensivo.)

## Ameaças à validade (declaradas, não resolvidas)

1. **Conflito de interesse.** Eu sou autor do juiz **e** anotador do corpus. O rótulo do corpus é
   minha opinião sobre o que é blocker. Um anotador independente pode discordar, e o κ entre nós
   não foi medido. Isto está no pré-registro, item por item.
2. **O corpus vem do `designcourt`** (mesmo autor), não de uma amostra de páginas do mundo real.
   48 páginas não sustentam intervalo de confiança — os números são ordens de grandeza, não pontos.
3. **`impeccable` não está pinado aqui.** 3.6.0 veio do `npx` no dia da medição, e a versão que o
   `designcourt` mediu (F1 0,170) não era necessariamente esta. A comparação é entre o juiz e
   *alguma* versão do `impeccable`; o número dele é indicativo, não um veredito sobre a ferramenta.
4. **Escape é a métrica que importa.** F1 pune o juiz por falar demais; num portão, falar demais
   custa revisão humana, silêncio custa entrega ruim. H2 mede o que dói.
5. **O juiz não viu o corpus do `designcourt` rotulado por outra pessoa.** Se algum dia houver
   anotador independente, o resultado a republicar é este arquivo, com a diferença declarada.
6. **Nada aqui diz que o design é bom.** Mede detecção de defeito estrutural. Gosto continua sendo
   julgamento humano — o repo não vende gosto, vende prova.

## O que este placar não prova

- Que o juiz generaliza: o corpus é pequeno, enviesado e rotulado por mim.
- Que o baseline anterior é inútil: ele media 6 tells, e para 6 tells ele acerta (precisão 1,000).
  O placar mede cobertura de um corpus maior, não a correção do que ele já declarava cobrir.
- Que o ganho se mantém em outra máquina: o `impeccable` depende de `npx` e de rede.
