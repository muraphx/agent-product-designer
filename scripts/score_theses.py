#!/usr/bin/env python3
"""Pontua as teses concorrentes do Agente Product Designer (fase Desenvolver do Double Diamond).

Criterios C1-C7 com pesos justificados pela evidencia (docs/research/02-discover-evidence.md;
justificativa dos pesos em docs/research/03-define-problems.md, secao 4).
Cada tese tambem e checada contra os criterios de morte K1-K6.

Uso: python scripts/score_theses.py
"""
from dataclasses import dataclass, field

# (id, nome, peso, o que 10 significa, fonte do peso)
CRITERIA = [
    ("C1", "diferenciacao_verificavel", 0.22,
     "produz numero medido que concorrente nenhum tem, por metodo auditavel",
     "gap 4 da frente 2 (ninguem publica harness com score reproduzivel) + 56% de skills nunca invocadas"),
    ("C2", "portabilidade_cross_client", 0.18,
     "mesmo pacote roda em Hermes, Claude, Codex/ChatGPT e Cursor sem fork de conteudo",
     "frente 1: 3 formatos de MCP, placeholders incompativos, so skill+MCP viajam"),
    ("C3", "reuso_ativo_do_disco", 0.16,
     "transforma designcourt/frictionmap/design-canon em produto em vez de reescrever",
     "designcourt 17/17 testes, corpus 48 paginas, F1 0.578 vs 0.170 do impeccable"),
    ("C4", "escalabilidade_template", 0.14,
     "vira agente full-stack trocando o pacote de skills, sem mexer no kernel",
     "pedido explicito do stakeholder (Q2)"),
    ("C5", "coragem_de_metodo", 0.12,
     "define o PROCESSO (descoberta->definicao->desenvolvimento->entrega), nao so o output",
     "gaps 1/2/9 da frente 2: espaco vazio do alvo"),
    ("C6", "custo_construcao", 0.10,
     "10 = sai em um fim de semana; 0 = semanas de engenharia",
     "restricao de tempo real; multi-agente consome 15x tokens"),
    ("C7", "risco_dependencia", 0.08,
     "10 = nao morre quando um terceiro muda; 0 = refem de 1 fornecedor",
     "hallmark parado desde 2026-08-06; Cursor quebra mcp.json do padrao"),
]

KILL = {
    "K1": "exige fork de conteudo por client",
    "K2": "o diferencial e 'mais comandos/mais regras' (dimensao do impeccable, 80k estrelas)",
    "K3": "nao tem baseline sem-agente nem baseline site-medio",
    "K4": "so funciona com fan-out de escrita multi-agente",
    "K5": "memoria vetorial como default (abaixo de ~120k tokens piora o resultado medido)",
    "K6": "depende de um unico terceiro para funcionar",
}

THESES = {
    "T1_prova_primeiro": {
        "scores": {"C1": 10, "C2": 10, "C3": 9, "C4": 9, "C5": 10, "C6": 5, "C7": 9},
        "kills": {},
        "resumo": (
            "Kernel portatil (Agent Skills + Agent Plugins) onde o diferencial NAO sao comandos de design, "
            "e sim a PROVA: detector deterministico com politica de 0 falso positivo, painel de juizes leigos "
            "com kappa publicado, pre-registro antes de rodar, e decision-log obrigatorio ligando cada escolha "
            "visual a uma estrategia declarada. impeccable/hallmark/motion entram como conteudo reaproveitado, "
            "nao como diferencial."
        ),
        "nota": (
            "E a unica tese em que o numero que o stakeholder pediu (benchmark publico) E o produto. "
            "Reusa o que ja existe (designcourt = juiz, frictionmap = walker, design-canon = pre-registro). "
            "Custo alto (C6=5) porque exige montar o painel de juizes e o pre-registro."
        ),
    },
    "T2_orquestrador_fino": {
        "scores": {"C1": 3, "C2": 7, "C3": 5, "C4": 6, "C5": 4, "C6": 10, "C7": 3},
        "kills": {"C1": "K2", "C7": "K6"},
        "resumo": (
            "Agente magro que so aponta para skills de terceiros instaladas por `npx skills add` "
            "(impeccable, hallmark, motion-design), sem corpo proprio."
        ),
        "nota": (
            "Barato e honesto, mas TODO o valor esta em terceiros: o diferencial vira uma lista de links com "
            "sotaque. Mata em K2 (compete na dimensao do impeccable) e K6 (hallmark ja esta parado)."
        ),
    },
    "T3_perfil_hermes": {
        "scores": {"C1": 6, "C2": 3, "C3": 7, "C4": 5, "C5": 6, "C6": 9, "C7": 6},
        "kills": {"C2": "K1"},
        "resumo": (
            "Perfil Hermes com SOUL.md + skills + cron, usando o provisionamento ja dominado "
            "(specialist-agent-provisioning)."
        ),
        "nota": (
            "Rapido e verificavel via CLI, mas SOUL.md/USER.md/MEMORY.md nao sao lidos por nenhum outro client "
            "e memoria nao e empacotavel no padrao. Mata em K1 pelo pedido textual do stakeholder: "
            "'pode ser usado em Hermes Agent, Claude, ChatGPT e qualquer outro client'."
        ),
    },
    "T4_servico_mcp": {
        "scores": {"C1": 9, "C2": 9, "C3": 6, "C4": 6, "C5": 7, "C6": 3, "C7": 6},
        "kills": {},
        "resumo": (
            "Design-decision-as-a-service: o juiz e o metodo vivem num servidor MCP; qualquer client com MCP "
            "consome a mesma prova, e o benchmark roda centralizado (sem contaminação local)."
        ),
        "nota": (
            "Maior alcance possivel e a prova fica auditavel num unico lugar. Mas exige deploy, auth, versao de "
            "endpoint e custo operacional: e estrategia de produto, nao de repositorio. NAO morre por criterio "
            "de morte — vira FASE 2 do mesmo kernel (T1 primeiro, T4 depois, mesmo juiz)."
        ),
    },
    "T5_estudio_multiagente": {
        "scores": {"C1": 7, "C2": 5, "C3": 8, "C4": 7, "C5": 7, "C6": 2, "C7": 4},
        "kills": {"C6": "K4"},
        "resumo": (
            "Orquestrador + 5 especialistas de design (estrategia, visual, motion, interacao, conteudo) "
            "trabalhando em paralelo sobre o mesmo artefato."
        ),
        "nota": (
            "Orquestracao e a parte facil de escrever e a mais cara de manter: 15x tokens, ganhos 'frequentemente "
            "minimos' (MAST) e -70% em tarefa sequencial. Sem evals por papel, 5 agentes divergem o gosto em 5 "
            "direcoes. Mata em K4: a escrita precisa continuar single-threaded."
        ),
    },
}

CUTOFF = 6.5


@dataclass
class Row:
    name: str
    total: float
    contrib: dict
    killed_by: list = field(default_factory=list)


def score() -> list[Row]:
    rows = []
    for name, t in THESES.items():
        total = 0.0
        contrib = {}
        for cid, _, weight, _, _ in CRITERIA:
            c = t["scores"][cid] * weight
            contrib[cid] = round(c, 3)
            total += c
        killed = [f"{v} ({KILL[v]})" for v in t["kills"].values()]
        rows.append(Row(name, round(total, 2), contrib, killed))
    return sorted(rows, key=lambda r: -r.total)


if __name__ == "__main__":
    rows = score()
    print("PESOS (justificados na secao 4 de 03-define-problems.md)")
    for cid, nm, w, meaning, src in CRITERIA:
        print(f"  {cid} {nm:<28} w={w:<5} {meaning}")
        print(f"       fonte: {src}")
    print()
    print("=" * 78)
    print(f"{'#':<3}{'tese':<24}{'score':<8}{'situacao'}")
    print("=" * 78)
    for i, r in enumerate(rows, 1):
        if r.killed_by:
            st = "MORTA: " + "; ".join(r.killed_by)
        elif r.total < CUTOFF:
            st = f"fora do corte ({CUTOFF})"
        else:
            st = "sobrevive"
        print(f"{i:<3}{r.name:<24}{r.total:<8}{st}")
    print()
    print(f"Corte: {CUTOFF}. Regra: tese morta por K1-K6 sai do escopo AGORA, independente do score.")
    print()
    for r in rows:
        print(f"--- {r.name}  score={r.total} ---")
        for cid, nm, w, _, _ in CRITERIA:
            raw = THESES[r.name]["scores"][cid]
            print(f"  {cid} {nm:<28} raw={raw:>2}/10 w={w} -> {r.contrib[cid]:<6}")
        best = max(r.contrib, key=r.contrib.get)
        worst = min(r.contrib, key=r.contrib.get)
        print(f"  maior forca: {best} | maior perda: {worst}")
        print(f"  resumo: {THESES[r.name]['resumo']}")
        print(f"  nota:   {THESES[r.name]['nota']}")
        print()
