// gates/lib/caps.mjs — leitor do teto numerico (budgets/caps.yaml)
//
// YAML estrito: apenas `chave: valor`, mapa aninhado por indentacao de 2 espacos,
// comentarios com #, escalares (int/float/string/bool) e arrays inline [a, b].
// Qualquer outra construcao (listas em bloco, tabs, anchors, multi-doc) e ERRO.
// Motivo: zero dependencia externa e um unico formato para o teto — o parser falha
// alto em vez de interpretar errado e deixar passar um excesso.

import fs from 'node:fs';

const SCALAR = /^-?\d+(\.\d+)?$/;

function parseScalar(raw, lineNo) {
  const v = raw.trim();
  if (v === '') throw new Error(`caps.yaml:${lineNo}: valor vazio`);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (SCALAR.test(v)) return Number(v);
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => parseScalar(s, lineNo));
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

export function parseCapsStrict(text) {
  const root = {};
  const stack = [{ indent: -2, obj: root }];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    if (raw.includes('\t')) throw new Error(`caps.yaml:${lineNo}: tab proibido (use 2 espacos)`);
    const noComment = raw.replace(/(^|\s)#.*$/, '');
    if (noComment.trim() === '') continue;

    const indent = noComment.match(/^ */)[0].length;
    if (indent % 2 !== 0) throw new Error(`caps.yaml:${lineNo}: indentacao nao multipla de 2`);
    const body = noComment.trim();
    if (body.startsWith('- ')) {
      throw new Error(`caps.yaml:${lineNo}: listas em bloco nao suportadas (use [a, b])`);
    }
    const colon = body.indexOf(':');
    if (colon < 0) throw new Error(`caps.yaml:${lineNo}: linha sem ':' -> ${body}`);
    const key = body.slice(0, colon).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`caps.yaml:${lineNo}: chave invalida '${key}'`);
    }
    const valueRaw = body.slice(colon + 1);
    if (valueRaw.trim() === '') {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const parent = stack[stack.length - 1].obj;
      if (Object.hasOwn(parent, key)) throw new Error(`caps.yaml:${lineNo}: chave duplicada '${key}'`);
      parent[key] = {};
      stack.push({ indent, obj: parent[key] });
      continue;
    }
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (Object.hasOwn(parent, key)) throw new Error(`caps.yaml:${lineNo}: chave duplicada '${key}'`);
    parent[key] = parseScalar(valueRaw, lineNo);
  }

  const rootKeys = Object.keys(root);
  if (rootKeys.length === 0) throw new Error('caps.yaml: arquivo vazio');
  for (const k of rootKeys) {
    const v = root[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) {
      throw new Error(`caps.yaml: chave '${k}' sem valor nem filhos`);
    }
  }
  return root;
}

export function loadCaps(file) {
  if (!fs.existsSync(file)) throw new Error(`caps.yaml nao encontrado: ${file}`);
  return parseCapsStrict(fs.readFileSync(file, 'utf8'));
}

// Achata {a:{b:1}} em { "a.b": 1 } para consulta uniforme do teto.
export function flatCaps(caps) {
  const out = {};
  for (const [k, v] of Object.entries(caps)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) out[`${k}.${k2}`] = v2;
    } else out[k] = v;
  }
  return out;
}

export const CAP_KEYS = [
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
];
