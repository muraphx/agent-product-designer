// gates/r1-anti-slop.mjs — R1: sem AI slop
//
// Só acusa com certeza mecânica. Sem certeza -> `incomplete` (nunca `fail`, nunca silêncio).
// Regra de falso positivo: melhor incompleto que acusar inocente.

import path from 'node:path';
import {
  loadArtifact, visibleText, boldText, findAll, contrastRatio, hexToRgb, hueSat, lineOf, centeredRatio, rel,
} from './lib/scan.mjs';

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2728}\u{2705}\u{274C}\u{26A1}\u{2B50}]/gu;

const STOCK = [
  'elevate your', 'seamlessly', 'unlock the power', 'cutting-edge', 'game changer', 'game-changer',
  'revolutioniz', 'take it to the next level', 'lorem ipsum', 'empower your', 'supercharge',
  'next-generation', 'state-of-the-art', 'in today\'s fast-paced',
  'eleve seu', 'eleve sua', 'sem esforço', 'revolucione', 'transforme sua', 'solução completa',
  'de ponta', 'poder transformador',
];

const PURPLE_HUES = [250, 300];

function isPurple(value) {
  const hs = hueSat(value);
  if (!hs) return false;
  return hs.h >= PURPLE_HUES[0] && hs.h <= PURPLE_HUES[1] && hs.s >= 0.25;
}

export function runR1(dir) {
  const violations = [];
  const incomplete = [];
  const art = loadArtifact(dir);
  const relDir = (p) => rel(dir, p);

  if (!art.htmlFile) {
    incomplete.push({ rule: 'artifact-missing', file: 'design/index.html', reason: 'nenhum artefato HTML encontrado — nao ha o que auditar' });
    return { gate: 'r1', violations, incomplete };
  }

  const htmlText = art.html + '\n' + art.css;

  // 1. ai-gradient — stop de gradiente em faixa violeta
  for (const m of findAll(htmlText, /(linear|radial|conic)-gradient\(([^)]*)\)/gi)) {
    const stops = findAll(m.groups[1] || '', /#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g).map((s) => s.match);
    const purple = stops.filter(isPurple);
    if (purple.length) {
      violations.push({
        rule: 'ai-gradient',
        file: art.htmlFile ? relDir(art.htmlFile) : 'design/styles.css',
        line: lineOf(htmlText, m.index),
        evidence: `${m.match.slice(0, 80)} com stop violeta ${purple.join(', ')} (hue 250-300, sat>=0.25)`,
      });
    }
  }
  for (const m of findAll(htmlText, /\b(?:from|via|to|bg|text)-(purple|violet|indigo|fuchsia)-\d{2,3}\b/gi)) {
    violations.push({
      rule: 'ai-gradient',
      file: art.htmlFile ? relDir(art.htmlFile) : 'design/styles.css',
      line: lineOf(htmlText, m.index),
      evidence: `classe utilitaria de violeta: ${m.match}`,
    });
  }

  // 2. decorative-emoji — emoji em texto visivel
  const bold = boldText(art.html);
  for (const m of findAll(bold, EMOJI)) {
    violations.push({
      rule: 'decorative-emoji',
      file: relDir(art.htmlFile),
      line: m.line,
      evidence: `emoji em texto visivel: ${m.match} (code point U+${m.match.codePointAt(0).toString(16).toUpperCase()})`,
    });
  }

  // 3. glow-shadow — blur grande; 24-31px fica incerto
  for (const m of findAll(art.css + '\n' + art.html, /box-shadow\s*:\s*([^;}"']+)/gi)) {
    const nums = [...(m.groups[0] || '').matchAll(/(\d+(?:\.\d+)?)px/g)].map((x) => Number(x[1]));
    const blur = nums.length >= 3 ? nums[2] : nums[1];
    if (blur === undefined) continue;
    if (blur >= 32) {
      violations.push({
        rule: 'glow-shadow',
        file: art.css ? relDir(art.cssFiles[0]) : relDir(art.htmlFile),
        line: lineOf(art.css + '\n' + art.html, m.index),
        evidence: `box-shadow com blur ${blur}px (>=32) — profundidade fingida`,
      });
    } else if (blur >= 24) {
      incomplete.push({
        rule: 'glow-shadow',
        file: art.css ? relDir(art.cssFiles[0]) : relDir(art.htmlFile),
        reason: `blur ${blur}px na faixa duvidosa (24-32): pode ser elevacao legitima — decisao humana`,
      });
    }
  }

  // 4. stock-copy — frases de catalogo
  const text = visibleText(art.html).toLowerCase();
  for (const phrase of STOCK) {
    const hits = findAll(text, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    for (const h of hits) {
      violations.push({
        rule: 'stock-copy',
        file: relDir(art.htmlFile),
        line: 0,
        evidence: `frase de catalogo: "${phrase}"`,
      });
    }
  }

  // 5. low-contrast-pair — pares texto/fundo declarados nos tokens
  const cssVars = {};
  for (const m of findAll(art.css + '\n' + art.html, /--([A-Za-z0-9_-]+)\s*:\s*([^;}"']+)/g)) {
    cssVars[m.groups[0]] = m.groups[1].trim();
  }
  const pairs = [
    ['--ink', '--bg'], ['--text', '--bg'], ['--fg', '--bg'], ['--ink', '--surface'],
    ['--body', '--bg'], ['--ink-2', '--bg'], ['--muted', '--bg'], ['--ink-dim', '--bg'],
  ];
  let checked = 0;
  for (const [fg, bg] of pairs) {
    if (!(fg in cssVars) || !(bg in cssVars)) continue;
    const a = cssVars[fg];
    const b = cssVars[bg];
    const parseable = /#[0-9a-fA-F]{3,8}|rgba?\(/.test(a) && /#[0-9a-fA-F]{3,8}|rgba?\(/.test(b);
    if (!parseable) continue;
    const ra = hexToRgb(a);
    const rb = hexToRgb(b);
    const ratio = ra && rb ? contrastRatio(ra, rb) : null;
    if (ratio === null) continue;
    checked++;
    const threshold = /muted|dim|subtle/.test(fg) ? 3.0 : 4.5;
    if (ratio < threshold) {
      violations.push({
        rule: 'low-contrast-pair',
        file: art.css ? relDir(art.cssFiles[0]) : relDir(art.htmlFile),
        line: 0,
        evidence: `${fg} (${a}) sobre ${bg} (${b}) = ${ratio.toFixed(2)}:1, abaixo de ${threshold}:1`,
      });
    }
  }
  if (checked === 0 && Object.keys(cssVars).length === 0) {
    incomplete.push({ rule: 'low-contrast-pair', file: relDir(art.htmlFile), reason: 'sem variaveis CSS de cor no artefato — contraste nao verificavel' });
  }

  // 6. centered-everything — >0.6 acusa, 0.4-0.6 fica incerto
  const c = centeredRatio(art.html, art.css);
  if (c.uncertain) {
    incomplete.push({ rule: 'centered-everything', file: relDir(art.htmlFile), reason: c.reason });
  } else if (c.ratio > 0.6) {
    violations.push({
      rule: 'centered-everything',
      file: relDir(art.htmlFile),
      line: 0,
      evidence: `${c.centered}/${c.blocks} blocos de texto centralizados (${(c.ratio * 100).toFixed(0)}% > 60%)`,
    });
  } else if (c.ratio >= 0.4) {
    incomplete.push({
      rule: 'centered-everything',
      file: relDir(art.htmlFile),
      reason: `${(c.ratio * 100).toFixed(0)}% centralizado, faixa duvidosa (40-60%) — padrao pode ser legitimo`,
    });
  }

  return { gate: 'r1', violations, incomplete };
}
