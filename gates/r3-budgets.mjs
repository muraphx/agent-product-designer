// gates/r3-budgets.mjs — R3: sem excessos
//
// Compara o que foi medido contra o teto de budgets/caps.yaml.
// Teto afrouxado sem decisao registrada e violacao deste portao.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { loadCaps, flatCaps } from './lib/caps.mjs';
import {
  loadTokens, loadArtifact, structure, centeredRatio, visibleText, wordCount, numericPx, findAll, rel,
} from './lib/scan.mjs';
import { analyzeTrace } from './r2-trace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');

export function loadBudgets() {
  const file = path.join(REPO_ROOT, 'budgets', 'caps.yaml');
  return { file, caps: loadCaps(file), flat: flatCaps(loadCaps(file)) };
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (v === undefined || v === null) return [];
  return [v];
}

// Um accent e uma cor de marca. Chave que descreve texto SOBRE o accent
// (ex.: ink-on-accent) nao e um segundo accent.
function isAccentName(k) {
  return /(^|[-_])(accent|brand|primary)([-_]|$)/i.test(k) && !/^(ink|text|fg|foreground|on)[-_]/i.test(k);
}

export function measure(dir) {
  const { tokens, tokensError } = loadTokens(dir);
  const art = loadArtifact(dir);
  const t = tokens || {};
  const color = t.color || {};
  const values = Object.values(color).map(String);
  const parseable = values.filter((v) => /#[0-9a-fA-F]{3,8}|rgba?\(/.test(v));

  const colorKeys = Object.keys(color);
  const radii = Object.keys(t.radius || {});
  const radiusValues = radii.map((k) => numericPx(t.radius[k])).filter((v) => v !== null);

  const struct = art.html ? structure(art.html) : { wellFormed: false, sections: 0, maxElementsPerSection: 0 };
  const c = art.html ? centeredRatio(art.html, art.css) : { ratio: 0, uncertain: true, reason: 'sem artefato' };
  const text = visibleText(art.html || '');
  const trace = analyzeTrace(dir);
  const uncovered = trace.tokens ? trace.tokenPaths.filter((tp) => {
    const covered = new Set();
    for (const e of trace.entries) {
      if (!e.data || e.error) continue;
      if (String(e.data.status || 'active').toLowerCase() !== 'active') continue;
      for (const cv of asArray(e.data.covers)) covered.add(String(cv).trim());
    }
    return !covered.has(tp);
  }).length : trace.tokenPaths.length;

  return {
    metrics: {
      colors: parseable.length,
      accents: colorKeys.filter((k) => isAccentName(k)).length,
      font_families: asArray((t.font || {}).family).length || asArray((t.font || {}).families).length,
      font_weights: asArray((t.font || {}).weight || (t.font || {}).weights).length,
      radii: radii.length,
      shadows: Object.keys(t.shadow || {}).length,
      motion_durations: Object.keys(t.motion || {}).length,
      sections: struct.sections,
      elements_per_section: struct.maxElementsPerSection,
      centered_ratio: Number(c.ratio.toFixed(3)),
      words: wordCount(text),
      decisions: trace.entries.length,
      uncovered_tokens: uncovered,
    },
    uncertainty: {
      tokens: tokensError || null,
      structure: struct.wellFormed ? null : 'nao foi possivel delimitar secoes com certeza (HTML malformado ou sem <section>)',
      centered: c.uncertain ? c.reason : null,
    },
    artifact: { htmlFile: art.htmlFile, cssFiles: art.cssFiles },
    radiusValues,
  };
}

export const CHECKS = [
  ['colors', 'tokens.colors_max', 'cores'],
  ['accents', 'tokens.accent_max', 'accents'],
  ['font_families', 'tokens.font_families_max', 'familias tipograficas'],
  ['font_weights', 'tokens.font_weights_max', 'pesos tipograficos'],
  ['radii', 'tokens.radii_max', 'raios'],
  ['shadows', 'tokens.shadows_max', 'sombras'],
  ['motion_durations', 'tokens.motion_durations_max', 'duracoes de motion'],
  ['sections', 'layout.sections_max', 'secoes'],
  ['elements_per_section', 'layout.elements_per_section_max', 'elementos por secao'],
  ['words', 'copy.words_max', 'palavras'],
];

export function runR3(dir) {
  const violations = [];
  const incomplete = [];
  const { flat } = loadBudgets();
  const m = measure(dir);
  const metrics = m.metrics;

  for (const [metric, capKey, label] of CHECKS) {
    const cap = flat[capKey];
    if (cap === undefined) {
      incomplete.push({ rule: 'cap-missing', file: 'budgets/caps.yaml', reason: `teto ${capKey} ausente — portao nao pode decidir` });
      continue;
    }
    const value = metrics[metric];
    if (typeof value !== 'number' || Number.isNaN(value)) continue;
    const uncertain = (metric === 'sections' || metric === 'elements_per_section') && m.uncertainty.structure;
    if (value > cap) {
      if (uncertain) {
        incomplete.push({ rule: `over-cap-${metric}`, file: 'design/', reason: `${value} ${label} acima do teto ${cap}, porem delimitacao incerta: ${m.uncertainty.structure}` });
      } else {
        violations.push({
          rule: `over-cap-${metric}`,
          file: metric === 'words' ? 'design/index.html' : 'design/tokens.json',
          line: 0,
          evidence: `${value} ${label} > teto ${cap} (${capKey})`,
        });
      }
    }
  }

  // Dono deste eixo e o r1 (tell de centered). O r3 nao duplica.
  // Dono do rastro e o r2. O r3 reporta o numero, nao julga cobertura.

  // over-rounded — mais de um raio >= 24px distinto: "amigavel" automatico.
  const big = [...new Set(m.radiusValues.filter((v) => v >= 24))];
  if (big.length > 1) {
    violations.push({
      rule: 'over-rounded',
      file: 'design/tokens.json',
      line: 0,
      evidence: `${big.length} raios distintos >= 24px (${big.join('px, ')}px) — cantos arredondados por reflexo`,
    });
  } else if (big.length === 1) {
    incomplete.push({ rule: 'over-rounded', file: 'design/tokens.json', reason: 'um raio >= 24px: pode ser pill legitimo — decisao humana' });
  }

  return { gate: 'r3', violations, incomplete, metrics };
}
