#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dist/chatgpt/gates.py — os tres portoes bloqueantes (R1, R2, R3) sem Node.

Port stdlib-only de:
    gates/run.mjs, gates/r1-anti-slop.mjs, gates/r2-trace.mjs, gates/r3-budgets.mjs,
    gates/lib/scan.mjs, gates/lib/caps.mjs

Uso:
    python gates.py <dir-do-artefato>              relatorio legivel
    python gates.py <dir-do-artefato> --json       relatorio de maquina
    python gates.py <dir-do-artefato> --strict     incomplete tambem derruba (exit 1)
    python gates.py <dir-do-artefato> --caps <arquivo>
    python gates.py --self-check                   prova interna (sem alvo, sem repo)

Exit: 0 = nenhum fail | 1 = ao menos um fail | 2 = erro de uso/ambiente.

Resolucao do teto, nesta ordem:
    1. --caps <arquivo>                     (argv)
    2. budgets/caps.yaml ao lado do script  (dist/chatgpt/budgets/caps.yaml)
    3. budgets/caps.yaml subindo a partir do diretorio alvo

Sem dependencia externa: so a biblioteca padrao do Python 3.9+.
"""

from __future__ import annotations

import contextlib
import io
import json
import math
import os
import re
import sys
import tempfile
import unicodedata
from decimal import Decimal, ROUND_HALF_UP

HERE = os.path.dirname(os.path.abspath(__file__))
PROG = 'gates.py'


# --------------------------------------------------------------------------
# gates/lib/scan.mjs — leitura deterministica do alvo
# --------------------------------------------------------------------------

SKIP_DIRS = frozenset(('node_modules', '.git', 'dist', 'vendor', 'cache'))


def list_files(base, exts=None):
    out = []

    def walk(d):
        try:
            entries = sorted(os.scandir(d), key=lambda e: e.name)
        except OSError:
            return
        for e in entries:
            if e.name in SKIP_DIRS:
                continue
            if e.is_dir(follow_symlinks=False):
                walk(e.path)
            elif exts is None or os.path.splitext(e.name)[1].lower() in exts:
                out.append(e.path)

    walk(base)
    return sorted(out)


def read_if_exists(path):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            return fh.read()
    except OSError:
        return None


def rel(base, path):
    return os.path.relpath(path, base).replace(os.sep, '/')


def line_of(text, index):
    # Node: conta '\n' com i < index e i < text.length.
    return text.count('\n', 0, index) + 1


class Hit:
    """Resultado de um match, na forma que o scan.mjs expoe (index/match/line/groups)."""

    __slots__ = ('index', 'match', 'line', '_m')

    def __init__(self, m, text):
        self.index = m.start()
        self.match = m.group(0)
        self.line = line_of(text, m.start())
        self._m = m

    def group(self, n):
        return self._m.group(n)


def find_all(text, pattern, flags=0):
    return [Hit(m, text) for m in re.compile(pattern, flags).finditer(text)]


# ---------- artefato ----------

def load_artifact(d):
    design_dir = os.path.join(d, 'design')
    html_file = None
    for name in ('index.html', 'artifact.html'):
        candidate = os.path.join(design_dir, name)
        if os.path.exists(candidate):
            html_file = candidate
            break
    css_files = list_files(design_dir, ('.css',))
    html = (read_if_exists(html_file) or '') if html_file else ''
    css = '\n'.join((read_if_exists(f) or '') for f in css_files)
    return {'designDir': design_dir, 'htmlFile': html_file, 'html': html, 'cssFiles': css_files, 'css': css}


def visible_text(html):
    text = re.sub(r'<script[\s\S]*?</script>', ' ', html, flags=re.I)
    text = re.sub(r'<style[\s\S]*?</style>', ' ', text, flags=re.I)
    text = re.sub(r'<code[\s\S]*?</code>', ' ', text, flags=re.I)
    text = re.sub(r'<pre[\s\S]*?</pre>', ' ', text, flags=re.I)
    text = re.sub(r'<!--[\s\S]*?-->', ' ', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&[a-z]+;', ' ', text, flags=re.I)
    return re.sub(r'\s+', ' ', text).strip()


def bold_text(html):
    text = re.sub(r'<script[\s\S]*?</script>', ' ', html, flags=re.I)
    text = re.sub(r'<style[\s\S]*?</style>', ' ', text, flags=re.I)
    text = re.sub(r'<code[\s\S]*?</code>', ' ', text, flags=re.I)
    text = re.sub(r'<pre[\s\S]*?</pre>', ' ', text, flags=re.I)
    return re.sub(r'<!--[\s\S]*?-->', ' ', text)


def word_count(text):
    return len([w for w in re.split(r'\s+', text) if re.search(r'[A-Za-z\u00C0-\u00FF0-9]', w)])


TAG_RE = re.compile(r'<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>')


def centered_class_names(html):
    blocks = [m.group(1) for m in re.finditer(r'<style[^>]*>([\s\S]*?)</style>', html, re.I)]
    return '\n'.join(blocks)


def structure(html):
    """Conta elementos por <section> e devolve as classes centradas do <style> inline."""
    sections = []
    stack = []
    current = None
    ok = True
    pos = 0
    low = html.lower()
    while True:
        m = TAG_RE.search(html, pos)
        if m is None:
            break
        closing, tag, self_close = m.group(1), m.group(2), m.group(4)
        name = tag.lower()
        if name == 'script' or name == 'style':
            end = low.find('</' + name + '>', m.end())
            pos = end + len(name) + 3 if end >= 0 else m.end()
            continue
        if closing:
            last = stack.pop() if stack else None
            if last is None:
                ok = False
                pos = m.end()
                continue
            if current is not None and len(stack) == current['depth']:
                sections.append(current)
                current = None
            pos = m.end()
            continue
        if self_close:
            pos = m.end()
            continue
        if name == 'section':
            current = {'depth': len(stack), 'count': 0}
        elif current is not None and len(stack) == current['depth'] + 1:
            current['count'] += 1
        stack.append(name)
        pos = m.end()
    if current is not None:
        sections.append(current)
    if len(stack) != 0:
        ok = False
    counts = [s['count'] for s in sections]
    return {
        'wellFormed': ok and len(counts) > 0,
        'sections': len(counts),
        'maxElementsPerSection': max(counts) if counts else 0,
        'centeredClasses': centered_class_names(html),
    }


def text_blocks(html):
    out = []
    for m in re.finditer(r'<(p|h1|h2|h3|h4|h5|h6|li|blockquote)\b([^>]*)>', html, re.I | re.A):
        out.append({'tag': m.group(1).lower(), 'attrs': m.group(2), 'index': m.start(),
                    'line': line_of(html, m.start())})
    return out


def centered_ratio(html, css):
    blocks = text_blocks(html)
    if not blocks:
        return {'ratio': 0, 'blocks': 0, 'uncertain': True, 'reason': 'sem blocos de texto'}
    inline = '\n'.join(m.group(1) for m in re.finditer(r'<style[^>]*>([\s\S]*?)</style>', html, re.I))
    all_css = css + '\n' + inline
    centered_classes = set()
    global_centered = False
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', all_css):
        sel, body = m.group(1), m.group(2)
        if not re.search(r'text-align\s*:\s*center', body, re.I):
            continue
        for part in sel.split(','):
            s = part.strip()
            if re.fullmatch(r'body|\*|html', s):
                global_centered = True
            for cls in re.finditer(r'\.([A-Za-z0-9_-]+)', s):
                centered_classes.add(cls.group(1))
    centered = 0
    for b in blocks:
        if re.search(r'text-align\s*:\s*center', b['attrs'], re.I):
            centered += 1
            continue
        cm = re.search(r'class\s*=\s*"([^"]*)"', b['attrs'], re.I)
        class_attr = cm.group(1) if cm else ''
        classes = [c for c in re.split(r'\s+', class_attr) if c]
        if any(c in centered_classes for c in classes):
            centered += 1
        elif global_centered and not class_attr:
            centered += 1
    ratio = centered / len(blocks)
    uncertain = css.strip() == '' and not re.search(r'<style', html, re.I)
    if uncertain:
        reason = 'nenhum CSS disponivel para atribuir text-align'
    else:
        reason = 'sem CSS nao e possivel atribuir; ratio por classe/inline = ' + to_fixed(ratio, 2)
    return {'ratio': ratio, 'blocks': len(blocks), 'centered': centered,
            'uncertain': uncertain, 'reason': reason}


# ---------- tokens ----------

def _load_tokens_raw(d):
    path = os.path.join(d, 'design', 'tokens.json')
    text = read_if_exists(path)
    if text is None:
        return None, 'design/tokens.json ausente'
    try:
        return json.loads(text), None
    except ValueError as e:
        return None, 'design/tokens.json invalido: ' + str(e)


def load_tokens(d):
    tokens, error = _load_tokens_raw(d)
    if error is None:
        return {'ok': True, 'tokens': tokens, 'errors': [], 'file': os.path.join(d, 'design', 'tokens.json')}
    return {'ok': False, 'tokens': None, 'errors': [error], 'uncertain': False,
            'file': os.path.join(d, 'design', 'tokens.json')}


def token_paths(tokens):
    out = []
    for group, val in (tokens or {}).items():
        if isinstance(val, dict):
            for k in val.keys():
                out.append(group + '.' + k)
    return sorted(out)


HEX6 = re.compile(r'^#([0-9a-f]{6})$', re.I)
HEX3 = re.compile(r'^#([0-9a-f]{3})$', re.I)
RGBA = re.compile(r'rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)', re.I | re.A)


def hex_to_rgb(value):
    v = str(value).strip()
    m6 = HEX6.match(v)
    if m6:
        n = int(m6.group(1), 16)
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    m3 = HEX3.match(v)
    if m3:
        return [int(c + c, 16) for c in m3.group(1)]
    mf = RGBA.search(v)
    if mf:
        return [float(mf.group(1)), float(mf.group(2)), float(mf.group(3))]
    return None


def luminance(rgb):
    def channel(c):
        s = c / 255
        return s / 12.92 if s <= 0.03928 else math.pow((s + 0.055) / 1.055, 2.4)

    r, g, b = [channel(c) for c in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = (la, lb) if la > lb else (lb, la)
    return (hi + 0.05) / (lo + 0.05)


def hue_sat(value):
    rgb = hex_to_rgb(value)
    if rgb is None:
        return None
    r, g, b = [c / 255 for c in rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    h = 0.0
    s = 0.0
    if mx != mn:
        dd = mx - mn
        s = dd / (2 - mx - mn) if l > 0.5 else dd / (mx + mn)
        if mx == r:
            h = ((g - b) / dd + (6 if g < b else 0)) * 60
        elif mx == g:
            h = ((b - r) / dd + 2) * 60
        else:
            h = ((r - g) / dd + 4) * 60
    return {'h': h, 's': s, 'l': l}


PX_NUM = re.compile(r'(-?\d+(?:\.\d+)?)\s*px')


def numeric_px(value):
    m = PX_NUM.search(str(value))
    return float(m.group(1)) if m else None


# --------------------------------------------------------------------------
# formato numerico identico ao JS (Number.prototype.toString / toFixed)
# --------------------------------------------------------------------------

def js_num(x):
    """Number.prototype.toString: sem '.0' sobrando."""
    if isinstance(x, bool):
        return 'true' if x else 'false'
    if isinstance(x, int):
        return str(x)
    if x == int(x) and abs(x) < 1e21:
        return str(int(x))
    return repr(x)


def to_fixed(x, digits):
    """Replica Number.prototype.toFixed: arredonda no valor exato do double; empate para cima."""
    quant = Decimal(1).scaleb(-digits)
    return str(Decimal(x).quantize(quant, rounding=ROUND_HALF_UP))


def js_number(x):
    """Number(...) de um toFixed: inteiro vira int, para o JSON sair igual ao do JS (0, nao 0.0)."""
    f = float(x)
    return int(f) if f == int(f) else f


# --------------------------------------------------------------------------
# gates/r1-anti-slop.mjs — R1: sem AI slop
# --------------------------------------------------------------------------

EMOJI = r'[\U0001F000-\U0001FAFF\u2728\u2705\u274C\u26A1\u2B50]'

STOCK = [
    'elevate your', 'seamlessly', 'unlock the power', 'cutting-edge', 'game changer', 'game-changer',
    'revolutioniz', 'take it to the next level', 'lorem ipsum', 'empower your', 'supercharge',
    'next-generation', 'state-of-the-art', "in today's fast-paced",
    'eleve seu', 'eleve sua', 'sem esforço', 'revolucione', 'transforme sua', 'solução completa',
    'de ponta', 'poder transformador',
]

PURPLE_HUES = (250, 300)


def is_purple(value):
    hs = hue_sat(value)
    if hs is None:
        return False
    return PURPLE_HUES[0] <= hs['h'] <= PURPLE_HUES[1] and hs['s'] >= 0.25


def run_r1(d):
    violations = []
    incomplete = []
    art = load_artifact(d)

    def reld(p):
        return rel(d, p)

    if not art['htmlFile']:
        incomplete.append({'rule': 'artifact-missing', 'file': 'design/index.html',
                           'reason': 'nenhum artefato HTML encontrado — nao ha o que auditar'})
        return {'gate': 'r1', 'violations': violations, 'incomplete': incomplete}

    html_text = art['html'] + '\n' + art['css']
    html_file = reld(art['htmlFile'])

    # 1. ai-gradient — stop de gradiente em faixa violeta
    for m in find_all(html_text, r'(linear|radial|conic)-gradient\(([^)]*)\)', re.I):
        stops = [s.match for s in find_all(m.group(2) or '', r'#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)')]
        purple = [s for s in stops if is_purple(s)]
        if purple:
            violations.append({
                'rule': 'ai-gradient',
                'file': html_file,
                'line': line_of(html_text, m.index),
                'evidence': '%s com stop violeta %s (hue 250-300, sat>=0.25)' % (m.match[:80], ', '.join(purple)),
            })
    for m in find_all(html_text, r'\b(?:from|via|to|bg|text)-(purple|violet|indigo|fuchsia)-\d{2,3}\b', re.I | re.A):
        violations.append({
            'rule': 'ai-gradient',
            'file': html_file,
            'line': line_of(html_text, m.index),
            'evidence': 'classe utilitaria de violeta: ' + m.match,
        })

    # 2. decorative-emoji — emoji em texto visivel
    for m in find_all(bold_text(art['html']), EMOJI):
        violations.append({
            'rule': 'decorative-emoji',
            'file': html_file,
            'line': m.line,
            'evidence': 'emoji em texto visivel: %s (code point U+%X)' % (m.match, ord(m.match[0])),
        })

    # 3. glow-shadow — blur grande; 24-31px fica incerto
    shadow_text = art['css'] + '\n' + art['html']
    shadow_file = reld(art['cssFiles'][0]) if art['css'] else reld(art['htmlFile'])
    for m in find_all(shadow_text, r'''box-shadow\s*:\s*([^;}"']+)''', re.I):
        nums = [float(x.group(1)) for x in find_all(m.group(1) or '', r'(\d+(?:\.\d+)?)px', re.A)]
        blur = nums[2] if len(nums) >= 3 else (nums[1] if len(nums) >= 2 else None)
        if blur is None:
            continue
        if blur >= 32:
            violations.append({
                'rule': 'glow-shadow',
                'file': shadow_file,
                'line': line_of(shadow_text, m.index),
                'evidence': 'box-shadow com blur %spx (>=32) — profundidade fingida' % js_num(blur),
            })
        elif blur >= 24:
            incomplete.append({
                'rule': 'glow-shadow',
                'file': shadow_file,
                'reason': 'blur %spx na faixa duvidosa (24-32): pode ser elevacao legitima — decisao humana'
                          % js_num(blur),
            })

    # 4. stock-copy — frases de catalogo
    text = visible_text(art['html']).lower()
    for phrase in STOCK:
        start = text.find(phrase)
        while start != -1:
            violations.append({
                'rule': 'stock-copy',
                'file': html_file,
                'line': 0,
                'evidence': 'frase de catalogo: "%s"' % phrase,
            })
            start = text.find(phrase, start + len(phrase))

    # 5. low-contrast-pair — pares texto/fundo declarados nos tokens
    css_vars = {}
    for m in find_all(art['css'] + '\n' + art['html'], r'''--([A-Za-z0-9_-]+)\s*:\s*([^;}"']+)'''):
        css_vars[m.group(1)] = m.group(2).strip()
    pairs = [
        ('--ink', '--bg'), ('--text', '--bg'), ('--fg', '--bg'), ('--ink', '--surface'),
        ('--body', '--bg'), ('--ink-2', '--bg'), ('--muted', '--bg'), ('--ink-dim', '--bg'),
    ]
    color_lit = re.compile(r'#[0-9a-fA-F]{3,8}|rgba?\(')
    contrast_file = reld(art['cssFiles'][0]) if art['css'] else html_file
    checked = 0
    for fg, bg in pairs:
        if fg not in css_vars or bg not in css_vars:
            continue
        a, b = css_vars[fg], css_vars[bg]
        if not color_lit.search(a) or not color_lit.search(b):
            continue
        ra, rb = hex_to_rgb(a), hex_to_rgb(b)
        ratio = contrast_ratio(ra, rb) if (ra is not None and rb is not None) else None
        if ratio is None:
            continue
        checked += 1
        threshold = 3.0 if re.search(r'muted|dim|subtle', fg) else 4.5
        if ratio < threshold:
            violations.append({
                'rule': 'low-contrast-pair',
                'file': contrast_file,
                'line': 0,
                'evidence': '%s (%s) sobre %s (%s) = %s:1, abaixo de %s:1'
                            % (fg, a, bg, b, to_fixed(ratio, 2), js_num(threshold)),
            })
    if checked == 0 and not css_vars:
        incomplete.append({'rule': 'low-contrast-pair', 'file': html_file,
                           'reason': 'sem variaveis CSS de cor no artefato — contraste nao verificavel'})

    # 6. centered-everything — >0.6 acusa, 0.4-0.6 fica incerto
    c = centered_ratio(art['html'], art['css'])
    if c['uncertain']:
        incomplete.append({'rule': 'centered-everything', 'file': html_file, 'reason': c['reason']})
    elif c['ratio'] > 0.6:
        violations.append({
            'rule': 'centered-everything',
            'file': html_file,
            'line': 0,
            'evidence': '%d/%d blocos de texto centralizados (%s%% > 60%%)'
                        % (c['centered'], c['blocks'], to_fixed(c['ratio'] * 100, 0)),
        })
    elif c['ratio'] >= 0.4:
        incomplete.append({
            'rule': 'centered-everything',
            'file': html_file,
            'reason': '%s%% centralizado, faixa duvidosa (40-60%%) — padrao pode ser legitimo'
                      % to_fixed(c['ratio'] * 100, 0),
        })

    return {'gate': 'r1', 'violations': violations, 'incomplete': incomplete}


# --------------------------------------------------------------------------
# gates/r2-trace.mjs — R2: nenhuma decisao sem estrategia
# --------------------------------------------------------------------------

DIACRITICS = re.compile(r'[\u0300-\u036f]')
NON_SLUG = re.compile(r'[^a-z0-9\s-]')
SPACES = re.compile(r'\s+')


def slugify(text):
    t = unicodedata.normalize('NFD', text.lower())
    t = DIACRITICS.sub('', t)
    t = NON_SLUG.sub('', t)
    return SPACES.sub('-', t.strip())


LIST_KEYS = frozenset(('evidence', 'covers', 'affects'))

FRONTMATTER = re.compile(r'^---\r?\n([\s\S]*?)\r?\n---')
FM_ITEM = re.compile(r'^\s+-\s+(.*)$')
FM_KV = re.compile(r'^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$')


def strip_quotes(s):
    return re.sub(r'^["\']|["\']$', '', s)


def parse_frontmatter(text):
    m = FRONTMATTER.match(text)
    if not m:
        return {'data': None, 'error': 'sem frontmatter (--- no inicio)'}
    data = {}
    current_key = None
    for raw in re.split(r'\r?\n', m.group(1)):
        if raw.strip() == '' or raw.strip().startswith('#'):
            continue
        item = FM_ITEM.match(raw)
        if item:
            if not current_key:
                return {'data': None, 'error': 'item de lista sem chave: ' + raw.strip()}
            data[current_key].append(strip_quotes(item.group(1).strip()))
            continue
        kv = FM_KV.match(raw)
        if not kv:
            return {'data': None, 'error': 'linha invalida no frontmatter: ' + raw.strip()}
        key, value = kv.group(1), kv.group(2)
        if value.strip() == '':
            data[key] = []
            current_key = key
            continue
        if value.strip().startswith('['):
            inner = re.sub(r'^\[|\]$', '', value.strip())
            data[key] = [s for s in (strip_quotes(part.strip()) for part in inner.split(',')) if s]
            current_key = None
            continue
        data[key] = strip_quotes(value.strip())
        current_key = None
    for k in list(data.keys()):
        if k in LIST_KEYS and not isinstance(data[k], list):
            data[k] = [data[k]]
    return {'data': data, 'error': None}


HEADING = re.compile(r'^(#{1,6})\s+(.*)$')
EXPLICIT_ANCHOR = re.compile(r'\{#([a-z0-9-]+)\}', re.I)


def strategy_anchors(strategy_path):
    text = read_if_exists(strategy_path)
    if text is None:
        return {'anchors': None, 'error': 'strategy.md ausente'}
    lines = re.split(r'\r?\n', text)
    anchors = set()
    for line in lines:
        h = HEADING.match(line)
        if h:
            anchors.add('#' + slugify(h.group(2)))
    for line in lines:
        for ex in EXPLICIT_ANCHOR.finditer(line):
            anchors.add('#' + ex.group(1).lower())
    return {'anchors': anchors, 'error': None}


def analyze_trace(d):
    log_dir = os.path.join(d, 'decision-log')
    strategy_path = os.path.join(d, 'strategy.md')
    try:
        names = sorted(f for f in os.listdir(log_dir) if re.match(r'^DL-.*\.md$', f, re.I))
    except OSError:
        names = []
    files = [os.path.join(log_dir, f) for f in names]

    tokens, tokens_error = _load_tokens_raw(d)
    sa = strategy_anchors(strategy_path)

    entries = []
    for f in files:
        fm = parse_frontmatter(read_if_exists(f) or '')
        entries.append({'file': f, 'rel': rel(d, f), 'data': fm['data'], 'error': fm['error']})

    return {
        'entries': entries,
        'tokens': tokens,
        'tokensError': tokens_error,
        'anchors': sa['anchors'],
        'anchorError': sa['error'],
        'tokenPaths': token_paths(tokens or {}),
    }


def run_r2(d):
    violations = []
    incomplete = []
    t = analyze_trace(d)

    if t['tokensError']:
        violations.append({'rule': 'tokens-missing-or-invalid', 'file': 'design/tokens.json', 'line': 0,
                           'evidence': t['tokensError']})
    if t['anchorError']:
        violations.append({'rule': 'strategy-missing', 'file': 'strategy.md', 'line': 0, 'evidence': t['anchorError']})
    if not t['entries']:
        violations.append({'rule': 'no-decisions', 'file': 'decision-log/', 'line': 0,
                           'evidence': 'nenhuma entrada DL-*.md — nenhuma decisao registrada'})

    covered = {}
    for e in t['entries']:
        if e['error']:
            incomplete.append({'rule': 'decision-unreadable', 'file': e['rel'], 'reason': e['error']})
            continue
        dd = e['data']
        if not dd.get('id'):
            violations.append({'rule': 'decision-no-id', 'file': e['rel'], 'line': 0, 'evidence': 'campo id ausente'})
        if not dd.get('decision'):
            violations.append({'rule': 'decision-no-statement', 'file': e['rel'], 'line': 0,
                               'evidence': 'campo decision ausente'})
        if not dd.get('strategy_ref'):
            violations.append({'rule': 'decision-no-strategy-ref', 'file': e['rel'], 'line': 0,
                               'evidence': 'campo strategy_ref ausente — decisao sem estrategia'})
        elif t['anchors']:
            for r in [x.strip() for x in str(dd['strategy_ref']).split(',')]:
                if r not in t['anchors']:
                    violations.append({'rule': 'strategy-ref-dead', 'file': e['rel'], 'line': 0,
                                       'evidence': 'strategy_ref "%s" nao existe em strategy.md' % r})
        evidence = [x for x in (dd.get('evidence') or []) if str(x).strip() != '']
        if not evidence:
            violations.append({'rule': 'decision-no-evidence', 'file': e['rel'], 'line': 0,
                               'evidence': 'lista evidence vazia — decisao sem fonte'})
        for a in (dd.get('affects') or []):
            p = os.path.join(d, re.sub(r'^\./', '', str(a)))
            if not os.path.exists(p):
                violations.append({'rule': 'decision-affects-missing', 'file': e['rel'], 'line': 0,
                                   'evidence': 'affects aponta para caminho inexistente: %s' % a})
        status = str(dd.get('status') or 'active').lower()
        for c in (dd.get('covers') or []):
            if status == 'active':
                covered[str(c).strip()] = True

    for tp in t['tokenPaths']:
        if tp not in covered:
            violations.append({
                'rule': 'token-uncovered',
                'file': 'design/tokens.json',
                'line': 0,
                'evidence': 'token "%s" sem decisao ativa que o justifique (covers)' % tp,
            })
    for c in covered.keys():
        if t['tokens'] and c not in t['tokenPaths']:
            incomplete.append({'rule': 'cover-without-token', 'file': 'decision-log/',
                               'reason': 'decisao cobre "%s" que nao existe em tokens.json' % c})

    return {
        'gate': 'r2',
        'violations': violations,
        'incomplete': incomplete,
        'metrics': {'decisions': len(t['entries']),
                    'uncoveredTokens': len([v for v in violations if v['rule'] == 'token-uncovered'])},
    }


# --------------------------------------------------------------------------
# gates/lib/caps.mjs — leitor do teto numerico (budgets/caps.yaml)
# --------------------------------------------------------------------------

class CapsError(Exception):
    pass


CAP_SCALAR = re.compile(r'^-?\d+(\.\d+)?$')
CAP_KEY = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
COMMENT = re.compile(r'(^|\s)#.*$')


def parse_caps_scalar(raw, line_no):
    v = raw.strip()
    if v == '':
        raise CapsError('caps.yaml:%d: valor vazio' % line_no)
    if v == 'true':
        return True
    if v == 'false':
        return False
    if CAP_SCALAR.match(v):
        return int(v) if '.' not in v else float(v)
    if v.startswith('[') and v.endswith(']'):
        inner = v[1:-1].strip()
        if inner == '':
            return []
        return [parse_caps_scalar(s, line_no) for s in inner.split(',')]
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        return v[1:-1]
    return v


def parse_caps_strict(text):
    root = {}
    stack = [(-2, root)]
    lines = re.split(r'\r?\n', text)

    for i, raw in enumerate(lines):
        line_no = i + 1
        if '\t' in raw:
            raise CapsError('caps.yaml:%d: tab proibido (use 2 espacos)' % line_no)
        no_comment = COMMENT.sub('', raw)
        if no_comment.strip() == '':
            continue

        indent = len(no_comment) - len(no_comment.lstrip(' '))
        if indent % 2 != 0:
            raise CapsError('caps.yaml:%d: indentacao nao multipla de 2' % line_no)
        body = no_comment.strip()
        if body.startswith('- '):
            raise CapsError('caps.yaml:%d: listas em bloco nao suportadas (use [a, b])' % line_no)
        colon = body.find(':')
        if colon < 0:
            raise CapsError("caps.yaml:%d: linha sem ':' -> %s" % (line_no, body))
        key = body[:colon].strip()
        if not CAP_KEY.match(key):
            raise CapsError("caps.yaml:%d: chave invalida '%s'" % (line_no, key))
        value_raw = body[colon + 1:]
        if value_raw.strip() == '':
            while stack and stack[-1][0] >= indent:
                stack.pop()
            parent = stack[-1][1]
            if key in parent:
                raise CapsError("caps.yaml:%d: chave duplicada '%s'" % (line_no, key))
            parent[key] = {}
            stack.append((indent, parent[key]))
            continue
        while stack and stack[-1][0] >= indent:
            stack.pop()
        parent = stack[-1][1]
        if key in parent:
            raise CapsError("caps.yaml:%d: chave duplicada '%s'" % (line_no, key))
        parent[key] = parse_caps_scalar(value_raw, line_no)

    root_keys = list(root.keys())
    if not root_keys:
        raise CapsError('caps.yaml: arquivo vazio')
    for k in root_keys:
        v = root[k]
        if isinstance(v, dict) and not v:
            raise CapsError("caps.yaml: chave '%s' sem valor nem filhos" % k)
    return root


def load_caps(path):
    if not os.path.exists(path):
        raise CapsError('caps.yaml nao encontrado: ' + path)
    text = read_if_exists(path)
    if text is None:
        raise CapsError('caps.yaml nao encontrado: ' + path)
    return parse_caps_strict(text)


def flat_caps(caps):
    out = {}
    for k, v in caps.items():
        if isinstance(v, dict):
            for k2, v2 in v.items():
                out['%s.%s' % (k, k2)] = v2
        else:
            out[k] = v
    return out


CAP_KEYS = [
    'tokens.colors_max',
    'tokens.accent_max',
    'tokens.font_families_max',
    'tokens.font_weights_max',
    'tokens.radii_max',
    'tokens.shadows_max',
    'tokens.motion_durations_max',
    'layout.sections_max',
    'layout.elements_per_section_max',
    'copy.words_max',
]


def caps_candidates(argv_caps, target):
    out = []
    if argv_caps:
        out.append(os.path.abspath(argv_caps))
    out.append(os.path.join(HERE, 'budgets', 'caps.yaml'))
    if target:
        d = os.path.abspath(target)
        while True:
            out.append(os.path.join(d, 'budgets', 'caps.yaml'))
            parent = os.path.dirname(d)
            if parent == d:
                break
            d = parent
    return out


def resolve_caps(argv_caps, target):
    """Primeiro caminho existente na ordem: --caps, ao lado do script, subindo do alvo."""
    candidates = caps_candidates(argv_caps, target)
    if argv_caps:
        if os.path.exists(candidates[0]):
            return candidates[0]
        raise CapsError('caps.yaml nao encontrado: %s' % candidates[0])
    for c in candidates:
        if os.path.exists(c):
            return c
    raise CapsError('caps.yaml nao encontrado: %s (nem subindo a partir de %s)' % (candidates[0], target))


# --------------------------------------------------------------------------
# gates/r3-budgets.mjs — R3: sem excessos
# --------------------------------------------------------------------------

def as_array(v):
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        return [s for s in (x.strip() for x in re.split(r'[,;]', v)) if s]
    if v is None:
        return []
    return [v]


ACCENT_YES = re.compile(r'(^|[-_])(accent|brand|primary)([-_]|$)', re.I)
ACCENT_NO = re.compile(r'^(ink|text|fg|foreground|on)[-_]', re.I)


def is_accent_name(k):
    return bool(ACCENT_YES.search(k)) and not ACCENT_NO.search(k)


def _obj(value):
    return value if isinstance(value, dict) else {}


def measure(d):
    tokens, tokens_error = _load_tokens_raw(d)
    art = load_artifact(d)
    t = tokens if isinstance(tokens, dict) else {}
    color = _obj(t.get('color'))
    values = [str(v) for v in color.values()]
    parseable = [v for v in values if re.search(r'#[0-9a-fA-F]{3,8}|rgba?\(', v)]

    color_keys = list(color.keys())
    radii = list(_obj(t.get('radius')).keys())
    radius_values = [numeric_px(_obj(t.get('radius'))[k]) for k in radii]
    radius_values = [v for v in radius_values if v is not None]

    struct = structure(art['html']) if art['html'] else {'wellFormed': False, 'sections': 0, 'maxElementsPerSection': 0}
    c = centered_ratio(art['html'], art['css']) if art['html'] else {'ratio': 0, 'uncertain': True, 'reason': 'sem artefato'}
    text = visible_text(art['html'] or '')
    trace = analyze_trace(d)

    if trace['tokens']:
        uncovered = 0
        for tp in trace['tokenPaths']:
            covered = {}
            for e in trace['entries']:
                if not e['data'] or e['error']:
                    continue
                if str(e['data'].get('status') or 'active').lower() != 'active':
                    continue
                for cv in as_array(e['data'].get('covers')):
                    covered[str(cv).strip()] = True
            if tp not in covered:
                uncovered += 1
    else:
        uncovered = len(trace['tokenPaths'])

    font = _obj(t.get('font'))
    font_families = len(as_array(font.get('family')))
    if not font_families:
        font_families = len(as_array(font.get('families')))
    font_weights = len(as_array(font.get('weight') or font.get('weights')))

    return {
        'metrics': {
            'colors': len(parseable),
            'accents': len([k for k in color_keys if is_accent_name(k)]),
            'font_families': font_families,
            'font_weights': font_weights,
            'radii': len(radii),
            'shadows': len(_obj(t.get('shadow')).keys()),
            'motion_durations': len(_obj(t.get('motion')).keys()),
            'sections': struct['sections'],
            'elements_per_section': struct['maxElementsPerSection'],
            'centered_ratio': js_number(to_fixed(c['ratio'], 3)),
            'words': word_count(text),
            'decisions': len(trace['entries']),
            'uncovered_tokens': uncovered,
        },
        'uncertainty': {
            'tokens': tokens_error or None,
            'structure': None if struct['wellFormed']
                         else 'nao foi possivel delimitar secoes com certeza (HTML malformado ou sem <section>)',
            'centered': c['reason'] if c['uncertain'] else None,
        },
        'artifact': {'htmlFile': art['htmlFile'], 'cssFiles': art['cssFiles']},
        'radiusValues': radius_values,
    }


CHECKS = [
    ('colors', 'tokens.colors_max', 'cores'),
    ('accents', 'tokens.accent_max', 'accents'),
    ('font_families', 'tokens.font_families_max', 'familias tipograficas'),
    ('font_weights', 'tokens.font_weights_max', 'pesos tipograficos'),
    ('radii', 'tokens.radii_max', 'raios'),
    ('shadows', 'tokens.shadows_max', 'sombras'),
    ('motion_durations', 'tokens.motion_durations_max', 'duracoes de motion'),
    ('sections', 'layout.sections_max', 'secoes'),
    ('elements_per_section', 'layout.elements_per_section_max', 'elementos por secao'),
    ('words', 'copy.words_max', 'palavras'),
]


def run_r3(d, flat):
    violations = []
    incomplete = []
    m = measure(d)
    metrics = m['metrics']

    for metric, cap_key, label in CHECKS:
        cap = flat.get(cap_key)
        if cap is None:
            incomplete.append({'rule': 'cap-missing', 'file': 'budgets/caps.yaml',
                               'reason': 'teto %s ausente — portao nao pode decidir' % cap_key})
            continue
        value = metrics[metric]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or math.isnan(value):
            continue
        uncertain = metric in ('sections', 'elements_per_section') and m['uncertainty']['structure']
        if value > cap:
            if uncertain:
                incomplete.append({'rule': 'over-cap-%s' % metric, 'file': 'design/',
                                   'reason': '%s %s acima do teto %s, porem delimitacao incerta: %s'
                                             % (js_num(value), label, js_num(cap), m['uncertainty']['structure'])})
            else:
                violations.append({
                    'rule': 'over-cap-%s' % metric,
                    'file': 'design/index.html' if metric == 'words' else 'design/tokens.json',
                    'line': 0,
                    'evidence': '%s %s > teto %s (%s)' % (js_num(value), label, js_num(cap), cap_key),
                })

    # over-rounded — mais de um raio >= 24px distinto: "amigavel" automatico.
    big = list(dict.fromkeys([v for v in m['radiusValues'] if v >= 24]))
    if len(big) > 1:
        violations.append({
            'rule': 'over-rounded',
            'file': 'design/tokens.json',
            'line': 0,
            'evidence': '%d raios distintos >= 24px (%s) — cantos arredondados por reflexo'
                        % (len(big), 'px, '.join(js_num(v) for v in big) + 'px'),
        })
    elif len(big) == 1:
        incomplete.append({'rule': 'over-rounded', 'file': 'design/tokens.json',
                           'reason': 'um raio >= 24px: pode ser pill legitimo — decisao humana'})

    return {'gate': 'r3', 'violations': violations, 'incomplete': incomplete, 'metrics': metrics}


# --------------------------------------------------------------------------
# gates/run.mjs — os tres portoes
# --------------------------------------------------------------------------

def build_report(target, caps, caps_path, gates):
    failed = [g for g in gates if g['violations']]
    uncertain = [g for g in gates if not g['violations'] and g['incomplete']]
    status = 'fail' if failed else ('incomplete' if uncertain else 'pass')

    gate_rows = []
    for g in gates:
        if g['violations']:
            gate_status = 'fail'
        elif g['incomplete']:
            gate_status = 'incomplete'
        else:
            gate_status = 'pass'
        row = {'gate': g['gate'], 'status': gate_status,
               'violations': g['violations'], 'incomplete': g['incomplete']}
        if g.get('metrics'):
            row['metrics'] = g['metrics']
        gate_rows.append(row)

    return {
        'target': target,
        'status': status,
        'caps': {'version': caps['version'], 'file': os.path.relpath(caps_path)},
        'gates': gate_rows,
        'counts': {
            'violations': sum(len(g['violations']) for g in gates),
            'incomplete': sum(len(g['incomplete']) for g in gates),
        },
        '_failed': len(failed),
        '_uncertain': len(uncertain),
    }


def render_human(report):
    out = ['alvo: %s' % report['target'],
           'teto: version %s (%s)' % (js_num(report['caps']['version']), report['caps']['file']),
           '']
    for g in report['gates']:
        mark = 'PASS' if g['status'] == 'pass' else ('FAIL' if g['status'] == 'fail' else 'INCOMPLETE')
        out.append('%s %s' % (mark.ljust(11), g['gate']))
        for v in g['violations']:
            out.append('   fail  [%s] %s%s — %s'
                       % (v['rule'], v['file'], ':' + str(v['line']) if v['line'] else '', v['evidence']))
        for i in g['incomplete']:
            out.append('   incerto [%s] %s — %s' % (i['rule'], i['file'], i['reason']))
    out.append('')
    out.append('resultado: %s (%d violacoes, %d incertezas)'
               % (report['status'].upper(), report['counts']['violations'], report['counts']['incomplete']))
    if report['status'] == 'fail':
        out.append('entrega recusada: corrija a causa, nunca o relatorio.')
    if report['status'] == 'incomplete':
        out.append('entrega permitida com incerteza declarada — o humano decide.')
    return out


USAGE = 'uso: python %s <dir-do-artefato> [--json] [--strict] [--caps <arquivo>]' % PROG


def emit(text, stream=None):
    (stream or sys.stdout).write(text + '\n')


def parse_argv(argv):
    """Devolve (flags, positional, caps_arg). --caps consome o argumento seguinte."""
    flags = set()
    positional = []
    caps_arg = None
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--caps':
            if i + 1 >= len(argv):
                return flags, positional, None, False
            caps_arg = argv[i + 1]
            i += 2
            continue
        if a.startswith('--'):
            flags.add(a)
        else:
            positional.append(a)
        i += 1
    return flags, positional, caps_arg, True


def run_cli(argv):
    """Executa o portao e devolve o codigo de saida (nao chama sys.exit)."""
    flags, positional, caps_arg, caps_ok = parse_argv(argv)

    if '--self-check' in flags:
        return run_self_check()

    if not caps_ok or len(positional) != 1:
        emit(USAGE, sys.stderr)
        return 2

    target = os.path.abspath(positional[0])
    if not os.path.exists(target) or not os.path.isdir(target):
        emit('alvo nao e um diretorio: %s' % target, sys.stderr)
        return 2

    try:
        caps_path = resolve_caps(caps_arg, target)
        caps = load_caps(caps_path)
    except CapsError as e:
        emit('teto invalido: %s' % e, sys.stderr)
        return 2

    flat = flat_caps(caps)
    gates = [run_r1(target), run_r2(target), run_r3(target, flat)]
    report = build_report(target, caps, caps_path, gates)

    if '--json' in flags:
        emit(json.dumps({k: v for k, v in report.items() if not k.startswith('_')},
                        indent=2, ensure_ascii=False))
    else:
        for line in render_human(report):
            emit(line)

    if report['_failed'] or ('--strict' in flags and report['_uncertain']):
        return 1
    return 0


# --------------------------------------------------------------------------
# --self-check — prova interna, sem alvo, sem repo, sem Node, sem rede
# --------------------------------------------------------------------------

CLEAN_HTML = """<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Amostra</title></head>
<body><main>
<section class="hero"><h1>Amostra</h1><p>Texto curto de amostra.</p></section>
<section><h2>Segunda</h2><p>Mais texto curto.</p></section>
</main></body></html>
"""

CLEAN_CSS = """:root { --bg: #ffffff; --ink: #111111; --radius-sm: 4px; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, sans-serif; }
"""

CLEAN_TOKENS = {
    "color": {"bg": "#ffffff", "ink": "#111111"},
    "radius": {"sm": "4px"},
    "font": {"family": "Inter, sans-serif", "weight": "400"},
    "motion": {"base": "180ms"},
    "shadow": {"hairline": "0 0 0 1px #e5e5e5"},
}

CLEAN_STRATEGY = "# Estrategia\n\n## Amostra\n\nTexto de estrategia.\n"

CLEAN_COVERS = 'color.bg, color.ink, font.family, font.weight, motion.base, radius.sm, shadow.hairline'

CLEAN_DECISION = """---
id: DL-0001
decision: Paleta e escala minimas
strategy_ref: #amostra
covers: [%s]
evidence:
  - docs/research/01-amostra.md
---

Corpo da decisao.
""" % CLEAN_COVERS

STRICT_CAPS = """version: 1

tokens:
  colors_max: 1
  accent_max: 1
  font_families_max: 2
  font_weights_max: 3
  radii_max: 3
  shadows_max: 3
  motion_durations_max: 3

layout:
  sections_max: 9
  elements_per_section_max: 14

copy:
  words_max: 1200
"""


def _write(path, content):
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(content)


def _make_target(root, html=CLEAN_HTML, css=CLEAN_CSS, decision=CLEAN_DECISION):
    os.makedirs(os.path.join(root, 'design'), exist_ok=True)
    os.makedirs(os.path.join(root, 'decision-log'), exist_ok=True)
    _write(os.path.join(root, 'design', 'index.html'), html)
    _write(os.path.join(root, 'design', 'styles.css'), css)
    _write(os.path.join(root, 'design', 'tokens.json'), json.dumps(CLEAN_TOKENS, indent=2) + '\n')
    _write(os.path.join(root, 'strategy.md'), CLEAN_STRATEGY)
    _write(os.path.join(root, 'decision-log', 'DL-0001-amostra.md'), decision)
    return root


def _capture(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = run_cli(argv)
    return code, out.getvalue(), err.getvalue()


def _sorted_rules(report, gate):
    for g in report['gates']:
        if g['gate'] == gate:
            return sorted(v['rule'] for v in g['violations'])
    return []


def run_self_check():
    checks = []

    def check(name, cond, detail=''):
        checks.append((name, bool(cond), detail))
        print('  %s %s%s' % ('ok  ' if cond else 'FAIL', name, (' — ' + detail) if (detail and not cond) else ''))

    print('self-check do port python (sem Node, sem alvo, sem repo)')
    print('')

    # 1. teto: resolve, parseia, acha os numeros
    try:
        caps_path = resolve_caps(None, HERE)
        caps = load_caps(caps_path)
        check('caps: resolve o teto', True)
        check('caps: version 1', caps.get('version') == 1, repr(caps.get('version')))
        check('caps: tokens.colors_max 12', caps['tokens']['colors_max'] == 12, repr(caps['tokens']['colors_max']))
        check('caps: copy.words_max 1200', caps['copy']['words_max'] == 1200, repr(caps['copy']['words_max']))
        flat = flat_caps(caps)
        orphans = [k for k in flat if k != 'version' and k not in CAP_KEYS]
        check('caps: nenhum teto orfao', orphans == [], ','.join(orphans))
        check('caps: CAP_KEYS cobre tudo', all(k in flat for k in CAP_KEYS),
              ','.join(k for k in CAP_KEYS if k not in flat))
    except CapsError as e:
        flat = {}
        check('caps: resolve o teto', False, str(e))

    # 2. o parser estrito rejeita o que nao e o subconjunto
    def raises(src):
        try:
            parse_caps_strict(src)
            return False
        except CapsError:
            return True

    check('caps: rejeita tabulacao', raises('a:\n\tb: 1\n'))
    check('caps: rejeita lista em bloco', raises('a:\n  - b\n'))
    check('caps: rejeita chave duplicada', raises('a: 1\na: 2\n'))
    check('caps: rejeita valor vazio no array inline', raises('a: [1, ]\n'))
    check('caps: rejeita chave sem valor nem filhos', raises('a:\n'))
    scalar = parse_caps_strict('a: 1\nb: 2.5\nc: true\nd: "x y"\ne:\n  f: 3\ng: [1, 2]\n')
    check('caps: aceita escalares e array inline',
          scalar == {'a': 1, 'b': 2.5, 'c': True, 'd': 'x y', 'e': {'f': 3}, 'g': [1, 2]}, repr(scalar))

    # 3. leitura deterministica do HTML
    page = ('<!DOCTYPE html><html><body><main>'
            '<section class="a"><h1>Titulo</h1><p>Um</p></section>'
            '<section class="b"><h2>Dois</h2><div><span>x</span><span>y</span><span>z</span></div></section>'
            '<section class="c"><p>Tres</p><ul><li>a</li><li>b</li></ul></section>'
            '</main></body></html>')
    st = structure(page)
    check('estrutura: conta todas as sections', st['sections'] == 3, 'sections=%d' % st['sections'])
    check('estrutura: conta filhos diretos, nao netos', st['maxElementsPerSection'] == 2,
          'max=%d' % st['maxElementsPerSection'])
    check('estrutura: html bem formado', st['wellFormed'] is True)
    wide = '<!DOCTYPE html><html><body><section><a>1</a><b>2</b><i>3</i><u>4</u></section></body></html>'
    check('estrutura: bloco largo conta 4', structure(wide)['maxElementsPerSection'] == 4,
          'max=%d' % structure(wide)['maxElementsPerSection'])
    nested = '<!DOCTYPE html><html><body><div><section><p>x</p></section></div></body></html>'
    check('estrutura: section aninhada conta 1', structure(nested)['sections'] == 1,
          'sections=%d' % structure(nested)['sections'])
    unbalanced = '<!DOCTYPE html><html><body><section><p>x</p></body></html>'
    check('estrutura: html desbalanceado nao passa por bom', structure(unbalanced)['wellFormed'] is False)

    # 4. medicao binaria e contraste
    check('cor: hexToRgb 6 digitos', hex_to_rgb('#7c3aed') == [124, 58, 237], repr(hex_to_rgb('#7c3aed')))
    check('cor: hexToRgb 3 digitos', hex_to_rgb('#fff') == [255, 255, 255], repr(hex_to_rgb('#fff')))
    check('cor: contraste preto/branco = 21', to_fixed(contrast_ratio([0, 0, 0], [255, 255, 255]), 2) == '21.00')
    purple = hue_sat('#7c3aed')
    check('cor: violeta na faixa 250-300', is_purple('#7c3aed') and 250 <= purple['h'] <= 300,
          'hue=%s' % (purple['h'] if purple else None))
    check('cor: verde nao e violeta', not is_purple('#00a000'))

    # 5. formato numerico identico ao JS
    check('formato: toFixed(0.4444, 2) = 0.44', to_fixed(0.4444, 2) == '0.44', to_fixed(0.4444, 2))
    check('formato: toFixed(1.005, 2) = 1.00 (duplo, nao decimal)', to_fixed(1.005, 2) == '1.00', to_fixed(1.005, 2))
    check('formato: toFixed(2.5, 0) = 3 (empate para cima)', to_fixed(2.5, 0) == '3', to_fixed(2.5, 0))
    check('formato: js_num(4.0) = 4', js_num(4.0) == '4', js_num(4.0))

    # 6. sem dependencia externa
    try:
        stdlib = set(sys.stdlib_module_names)
    except AttributeError:
        stdlib = {'json', 'os', 're', 'sys', 'math', 'unicodedata', 'decimal', 'contextlib', 'io', 'tempfile', 'ast'}
    with open(os.path.abspath(__file__), 'r', encoding='utf-8') as fh:
        imported = set(re.findall(r'^(?:import|from)\s+([A-Za-z_][A-Za-z0-9_]*)', fh.read(), re.M))
    imported.discard('__future__')
    external = sorted(m for m in imported if m not in stdlib)
    check('imports: apenas biblioteca padrao', external == [], ','.join(external))

    # 7. fim a fim, em diretorio temporario: passa limpo, acusa sujeira
    with tempfile.TemporaryDirectory() as tmp:
        clean = _make_target(os.path.join(tmp, 'clean'))
        code, out, _err = _capture([clean, '--json'])
        report = None
        try:
            report = json.loads(out)
        except ValueError as e:
            check('fim a fim: relatorio --json parseavel', False, str(e))
        if report:
            check('fim a fim: alvo limpo exit 0', code == 0, 'exit %d' % code)
            check('fim a fim: alvo limpo status pass', report['status'] == 'pass', report['status'])
            check('fim a fim: alvo limpo 0 violacoes e 0 incertezas',
                  report['counts'] == {'violations': 0, 'incomplete': 0}, repr(report['counts']))
            r3 = [g for g in report['gates'] if g['gate'] == 'r3'][0]
            check('fim a fim: medicao conta as 2 sections do alvo sintetico', r3['metrics']['sections'] == 2,
                  repr(r3['metrics']['sections']))
            check('fim a fim: rastro cobre todos os tokens',
                  [g for g in report['gates'] if g['gate'] == 'r2'][0]['metrics']['uncoveredTokens'] == 0)
        code, out, _err = _capture([clean])
        check('fim a fim: resumo legivel exato',
              'resultado: PASS (0 violacoes, 0 incertezas)' in out.splitlines(),
              repr(out.splitlines()[-1] if out else ''))
        check('fim a fim: linha do teto presente',
              any(l.startswith('teto: version 1 (') for l in out.splitlines()))

        dirty = _make_target(os.path.join(tmp, 'dirty'),
                             css=CLEAN_CSS + '.hero { background: linear-gradient(135deg, #7c3aed, #6d28d9); }\n')
        code, out, _err = _capture([dirty, '--json'])
        rep = json.loads(out)
        check('fim a fim: gradiente violeta acusa ai-gradient', 'ai-gradient' in _sorted_rules(rep, 'r1'),
              ','.join(_sorted_rules(rep, 'r1')))
        check('fim a fim: fail derruba com exit 1', code == 1 and rep['status'] == 'fail', 'exit %d' % code)

        untraced = _make_target(os.path.join(tmp, 'untraced'),
                                decision=CLEAN_DECISION.replace('radius.sm, ', ''))
        code, out, _err = _capture([untraced, '--json'])
        rep = json.loads(out)
        check('fim a fim: token sem decisao acusa token-uncovered',
              _sorted_rules(rep, 'r2') == ['token-uncovered'], ','.join(_sorted_rules(rep, 'r2')))
        check('fim a fim: token-uncovered derruba com exit 1', code == 1, 'exit %d' % code)

        caps_file = os.path.join(tmp, 'caps-estrito.yaml')
        _write(caps_file, STRICT_CAPS)
        code, out, _err = _capture([clean, '--caps', caps_file, '--json'])
        rep = json.loads(out)
        check('fim a fim: --caps com teto apertado acusa over-cap-colors',
              _sorted_rules(rep, 'r3') == ['over-cap-colors'], ','.join(_sorted_rules(rep, 'r3')))
        check('fim a fim: teto resolvido vem do --caps',
              os.path.basename(rep['caps']['file']) == 'caps-estrito.yaml', rep['caps']['file'])

        duo = _make_target(os.path.join(tmp, 'duvida'),
                           html=CLEAN_HTML.replace('<h1>Amostra</h1>', '<h1 class="center">Amostra</h1>')
                                          .replace('<h2>Segunda</h2>', '<h2 class="center">Segunda</h2>'),
                           css=CLEAN_CSS + '.center { text-align: center; }\n')
        code, out, _err = _capture([duo, '--json'])
        rep = json.loads(out)
        rules_inc = sorted(i['rule'] for g in rep['gates'] for i in g['incomplete'])
        check('fim a fim: 50% centralizado vira incerto, nunca fail',
              code == 0 and rep['status'] == 'incomplete' and 'centered-everything' in rules_inc
              and rep['counts']['violations'] == 0, repr(rules_inc))
        code, out, _err = _capture([duo, '--strict', '--json'])
        check('fim a fim: --strict derruba o incerto (exit 1)', code == 1, 'exit %d' % code)

        code, _out, err = _capture([os.path.join(tmp, 'nao-existe')])
        check('uso: alvo inexistente = exit 2', code == 2 and 'alvo nao e um diretorio' in err, 'exit %d' % code)
        code, _out, err = _capture([])
        check('uso: sem alvo = exit 2 com a linha de uso', code == 2 and 'uso:' in err, 'exit %d' % code)
        code, _out, err = _capture([clean, '--caps', os.path.join(tmp, 'nao-existe.yaml')])
        check('uso: --caps inexistente = exit 2', code == 2 and 'teto invalido' in err, 'exit %d' % code)

    failures = [c for c in checks if not c[1]]
    print('')
    print('self-check: %s (%d checagens, %d falhas)' % ('PASS' if not failures else 'FAIL', len(checks), len(failures)))
    if failures:
        print('')
        print('falhas:')
        for name, _ok, detail in failures:
            print('  - %s%s' % (name, (' — ' + detail) if detail else ''))
        return 1
    return 0


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', newline='\n')
        except (AttributeError, ValueError):
            pass
    return run_cli(argv)


if __name__ == '__main__':
    sys.exit(main())
