#!/usr/bin/env python3
"""Paridade Node x Python do runner de portoes.

Roda `node gates/run.mjs <alvo> --json` e `python dist/chatgpt/gates.py <alvo> --json` no
mesmo alvo e compara veredito, ids de violacao e incertezas. Nao inventa: se divergir, diz.

Uso:
  python dist/chatgpt/parity.py [alvo ...] [--md dist/chatgpt/PARITY.md]
Padrao de alvos: examples/landing, docs/delivery/phase-2 e cada pasta em tests/fixtures/.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PY = os.path.join(ROOT, "dist", "chatgpt", "gates.py")
DEFAULTS = ["examples/landing", "docs/delivery/phase-2"]


def targets(argv):
    given = [a for a in argv if not a.startswith("--")]
    if given:
        return given
    out = list(DEFAULTS)
    fix = os.path.join(ROOT, "tests", "fixtures")
    if os.path.isdir(fix):
        for name in sorted(os.listdir(fix)):
            p = os.path.join(fix, name)
            if os.path.isdir(p):
                out.append(os.path.join("tests", "fixtures", name))
    return out


def run(cmd, cwd):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    try:
        return json.loads(p.stdout), p.returncode
    except json.JSONDecodeError:
        return None, p.returncode


def shape(doc):
    if not doc:
        return None
    return {
        "status": doc.get("status"),
        "violations": sorted(v["rule"] for g in doc.get("gates", []) for v in g.get("violations", [])),
        "incomplete": sorted(v["rule"] for g in doc.get("gates", []) for v in g.get("incomplete", [])),
        "gates": {g["gate"]: g["status"] for g in doc.get("gates", [])},
    }


def main():
    argv = sys.argv[1:]
    md_path = None
    if "--md" in argv:
        i = argv.index("--md")
        md_path = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if os.path.isabs(PY) is False:
        pass

    rows, diffs = [], []
    for t in targets(argv):
        abs_t = os.path.join(ROOT, t) if not os.path.isabs(t) else t
        if not os.path.isdir(abs_t):
            rows.append((t, "SKIP", "alvo nao e diretorio", "", ""))
            continue
        n_doc, n_rc = run(["node", os.path.join("gates", "run.mjs"), t, "--json"], ROOT)
        p_doc, p_rc = run([sys.executable, PY, t, "--json"], ROOT)
        n, p = shape(n_doc), shape(p_doc)
        if n is None or p is None:
            rows.append((t, "ERRO", "json invalido", str(n_rc), str(p_rc)))
            diffs.append((t, "json invalido"))
            continue
        same = (
            n["status"] == p["status"]
            and n["violations"] == p["violations"]
            and n["incomplete"] == p["incomplete"]
            and n["gates"] == p["gates"]
        )
        rows.append(
            (
                t,
                "IGUAL" if same else "DIVERGE",
                f"{n['status']} / {p['status']}",
                f"{n_rc} / {p_rc}",
                ("r1,r2,r3:" + "".join(n["gates"].get(g, "?")[0] for g in ("r1", "r2", "r3"))),
            )
        )
        if not same:
            diffs.append((t, json.dumps({"node": n, "python": p}, ensure_ascii=False)))

    for r in rows:
        print(" | ".join(str(x) for x in r))
    print()
    print(f"alvos: {len(rows)} | divergentes: {len(diffs)}")
    for t, d in diffs:
        print(f"DIVERGE {t}: {d}")

    if md_path:
        lines = [
            "# Paridade: `node gates/run.mjs` x `python dist/chatgpt/gates.py`",
            "",
            "Gerado por `python dist/chatgpt/parity.py --md dist/chatgpt/PARITY.md`. Cada linha e uma",
            "execucao real dos dois runners no mesmo alvo; `IGUAL` exige mesmo veredito por portao,",
            "mesma lista de ids de violacao e mesma lista de incertezas.",
            "",
            "| Alvo | Veredito | node / python | exit | portoes |",
            "|---|---|---|---|---|",
        ]
        for t, verdict, status, rc, gates in rows:
            lines.append(f"| `{t}` | {verdict} | {status} | {rc} | {gates} |")
        lines += ["", f"**Alvos medidos:** {len(rows)} · **divergentes:** {len(diffs)}", ""]
        if diffs:
            lines.append("## Divergencias")
            lines.append("")
            for t, d in diffs:
                lines.append(f"- `{t}`: {d}")
        else:
            lines.append("Nenhuma divergencia: veredito, ids de violacao e incertezas identicos em todos os alvos.")
        lines += [
            "",
            "Auto-checagem do port:",
            "",
            "```",
            "$ python dist/chatgpt/gates.py --self-check",
            "```",
            "",
        ]
        with open(os.path.join(ROOT, md_path) if not os.path.isabs(md_path) else md_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    return 1 if diffs else 0


if __name__ == "__main__":
    sys.exit(main())
