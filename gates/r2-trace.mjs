// gates/r2-trace.mjs — R2: nenhuma decisao sem estrategia
//
// Verifica o rastro: cada token do artefato precisa de uma decisao registrada, e cada
// decisao precisa de referencia viva para a estrategia + evidencia nao vazia.

import fs from 'node:fs';
import path from 'node:path';
import { readIfExists, tokenPaths, rel } from './lib/scan.mjs';

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const LIST_KEYS = new Set(['evidence', 'covers', 'affects']);

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { data: null, error: 'sem frontmatter (--- no inicio)' };
  const data = {};
  let currentKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const item = raw.match(/^\s+-\s+(.*)$/);
    if (item) {
      if (!currentKey) return { data: null, error: `item de lista sem chave: ${raw.trim()}` };
      data[currentKey].push(stripQuotes(item[1].trim()));
      continue;
    }
    const kv = raw.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!kv) return { data: null, error: `linha invalida no frontmatter: ${raw.trim()}` };
    const [, key, value] = kv;
    if (value.trim() === '') {
      data[key] = [];
      currentKey = key;
      continue;
    }
    if (value.trim().startsWith('[')) {
      data[key] = value
        .trim()
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
      currentKey = null;
      continue;
    }
    data[key] = stripQuotes(value.trim());
    currentKey = null;
  }
  for (const k of Object.keys(data)) {
    if (LIST_KEYS.has(k) && !Array.isArray(data[k])) data[k] = [data[k]];
  }
  return { data, error: null };
}

function stripQuotes(s) {
  return s.replace(/^["']|["']$/g, '');
}

export function strategyAnchors(strategyPath) {
  const text = readIfExists(strategyPath);
  if (text === null) return { anchors: null, error: 'strategy.md ausente' };
  const anchors = new Set();
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) anchors.add('#' + slugify(h[2]));
  }
  for (const line of text.split(/\r?\n/)) {
    const explicit = line.match(/\{#([a-z0-9-]+)\}/i);
    if (explicit) anchors.add('#' + explicit[1].toLowerCase());
  }
  return { anchors, error: null };
}

export function analyzeTrace(dir) {
  const logDir = path.join(dir, 'decision-log');
  const strategyPath = path.join(dir, 'strategy.md');
  const tokensFile = path.join(dir, 'design', 'tokens.json');
  const files = fs.existsSync(logDir)
    ? fs.readdirSync(logDir).filter((f) => /^DL-.*\.md$/i.test(f)).sort().map((f) => path.join(logDir, f))
    : [];

  let tokens = null;
  let tokensError = null;
  const tokenText = readIfExists(tokensFile);
  if (tokenText === null) tokensError = 'design/tokens.json ausente';
  else {
    try {
      tokens = JSON.parse(tokenText);
    } catch (e) {
      tokensError = `design/tokens.json invalido: ${e.message}`;
    }
  }

  const { anchors, error: anchorError } = strategyAnchors(strategyPath);

  const entries = files.map((f) => {
    const text = fs.readFileSync(f, 'utf8');
    const { data, error } = parseFrontmatter(text);
    return { file: f, rel: rel(dir, f), data, error };
  });

  return { entries, tokens, tokensError, anchors, anchorError, tokenPaths: tokenPaths(tokens || {}) };
}

export function runR2(dir) {
  const violations = [];
  const incomplete = [];
  const t = analyzeTrace(dir);

  if (t.tokensError) {
    violations.push({ rule: 'tokens-missing-or-invalid', file: 'design/tokens.json', line: 0, evidence: t.tokensError });
  }
  if (t.anchorError) {
    violations.push({ rule: 'strategy-missing', file: 'strategy.md', line: 0, evidence: t.anchorError });
  }
  if (t.entries.length === 0) {
    violations.push({ rule: 'no-decisions', file: 'decision-log/', line: 0, evidence: 'nenhuma entrada DL-*.md — nenhuma decisao registrada' });
  }

  const covered = new Set();
  for (const e of t.entries) {
    if (e.error) {
      incomplete.push({ rule: 'decision-unreadable', file: e.rel, reason: e.error });
      continue;
    }
    const d = e.data;
    if (!d.id) violations.push({ rule: 'decision-no-id', file: e.rel, line: 0, evidence: 'campo id ausente' });
    if (!d.decision) violations.push({ rule: 'decision-no-statement', file: e.rel, line: 0, evidence: 'campo decision ausente' });
    if (!d.strategy_ref) {
      violations.push({ rule: 'decision-no-strategy-ref', file: e.rel, line: 0, evidence: 'campo strategy_ref ausente — decisao sem estrategia' });
    } else if (t.anchors) {
      const refs = String(d.strategy_ref).split(',').map((s) => s.trim());
      for (const r of refs) {
        if (!t.anchors.has(r)) {
          violations.push({ rule: 'strategy-ref-dead', file: e.rel, line: 0, evidence: `strategy_ref "${r}" nao existe em strategy.md` });
        }
      }
    }
    const evidence = (d.evidence || []).filter((x) => String(x).trim() !== '');
    if (!evidence.length) {
      violations.push({ rule: 'decision-no-evidence', file: e.rel, line: 0, evidence: 'lista evidence vazia — decisao sem fonte' });
    }
    for (const a of d.affects || []) {
      const p = path.join(dir, String(a).replace(/^\.\//, ''));
      if (!fs.existsSync(p)) {
        violations.push({ rule: 'decision-affects-missing', file: e.rel, line: 0, evidence: `affects aponta para caminho inexistente: ${a}` });
      }
    }
    const status = String(d.status || 'active').toLowerCase();
    for (const c of d.covers || []) {
      const key = String(c).trim();
      if (status === 'active') covered.add(key);
    }
  }

  for (const tp of t.tokenPaths) {
    if (!covered.has(tp)) {
      violations.push({
        rule: 'token-uncovered',
        file: 'design/tokens.json',
        line: 0,
        evidence: `token "${tp}" sem decisao ativa que o justifique (covers)`,
      });
    }
  }
  for (const c of covered) {
    if (t.tokens && !t.tokenPaths.includes(c)) {
      incomplete.push({ rule: 'cover-without-token', file: 'decision-log/', reason: `decisao cobre "${c}" que nao existe em tokens.json` });
    }
  }

  return { gate: 'r2', violations, incomplete, metrics: { decisions: t.entries.length, uncoveredTokens: violations.filter((v) => v.rule === 'token-uncovered').length } };
}
