// gates/lib/scan.mjs — leitura deterministica do alvo (HTML/CSS/tokens)
//
// Principio: este arquivo so extrai o que pode ser medido sem ambiguidade.
// Quando nao consegue decidir com certeza, devolve `uncertain: true` com a razao,
// e o portao reporta `incomplete` em vez de acusar (zero falso positivo).

import fs from 'node:fs';
import path from 'node:path';

export function listFiles(dir, exts = null) {
  const out = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'vendor', 'cache']);
  const walk = (d) => {
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (!exts || exts.includes(path.extname(e.name).toLowerCase())) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

export function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function rel(base, file) {
  return path.relative(base, file).split(path.sep).join('/');
}

export function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') n++;
  return n;
}

export function findAll(text, regex) {
  const out = [];
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ index: m.index, match: m[0], line: lineOf(text, m.index), groups: m.slice(1) });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

// ---------- artefato ----------

export function loadArtifact(dir) {
  const designDir = path.join(dir, 'design');
  const htmlFile = ['index.html', 'artifact.html'].map((n) => path.join(designDir, n)).find((p) => fs.existsSync(p)) || null;
  const cssFiles = listFiles(designDir, ['.css']);
  const html = htmlFile ? fs.readFileSync(htmlFile, 'utf8') : '';
  const css = cssFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  return { designDir, htmlFile, html, cssFiles, css };
}

export function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function boldText(html) {
  // Texto cru com tags preservadas, para achar emoji fora de code/pre.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

export function wordCount(text) {
  const words = text.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ0-9]/.test(w));
  return words.length;
}

// Conta elementos por <section> e elementos de texto centralizados.
export function structure(html) {
  const sections = [];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g;
  const stack = [];
  let current = null;
  let m;
  let ok = true;
  while ((m = tagRe.exec(html)) !== null) {
    const [, closing, tag, attrs, selfClose] = m;
    const name = tag.toLowerCase();
    if (name === 'script' || name === 'style') {
      // pula conteudo
      const end = html.toLowerCase().indexOf(`</${name}>`, tagRe.lastIndex);
      if (end >= 0) tagRe.lastIndex = end + name.length + 3;
      continue;
    }
    if (closing) {
      const last = stack.pop();
      if (last === undefined) {
        ok = false;
        continue;
      }
      // Fecha apenas quando voltamos ao nivel da section aberta (nao em tag interna).
      if (current && stack.length === current.depth) {
        sections.push(current);
        current = null;
      }
      continue;
    }
    if (selfClose) continue;
    if (name === 'section') {
      current = { depth: stack.length, count: 0 };
    } else if (current && stack.length === current.depth + 1) {
      current.count++;
    }
    stack.push(name);
  }
  if (current) sections.push(current);
  if (stack.length !== 0) ok = false;
  const counts = sections.map((s) => s.count);
  const centeredClasses = centeredClassNames(html);
  return {
    wellFormed: ok && counts.length > 0,
    sections: counts.length,
    maxElementsPerSection: counts.length ? Math.max(...counts) : 0,
    centeredClasses,
  };
}

function centeredClassNames(html) {
  const cssBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  return cssBlocks.join('\n');
}

export function textBlocks(html) {
  const out = [];
  const re = /<(p|h1|h2|h3|h4|h5|h6|li|blockquote)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ tag: m[1].toLowerCase(), attrs: m[2], index: m.index, line: lineOf(html, m.index) });
  }
  return out;
}

export function centeredRatio(html, css) {
  const blocks = textBlocks(html);
  if (!blocks.length) return { ratio: 0, blocks: 0, uncertain: true, reason: 'sem blocos de texto' };
  const all = css + '\n' + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const rules = [...all.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const centeredClasses = new Set();
  let globalCentered = false;
  for (const [, sel, body] of rules) {
    if (!/text-align\s*:\s*center/i.test(body)) continue;
    for (const part of sel.split(',')) {
      const s = part.trim();
      if (/^body$|^\*$|^html$/.test(s)) globalCentered = true;
      for (const cls of s.matchAll(/\.([A-Za-z0-9_-]+)/g)) centeredClasses.add(cls[1]);
    }
  }
  let centered = 0;
  for (const b of blocks) {
    if (/text-align\s*:\s*center/i.test(b.attrs)) centered++;
    else {
      const classes = (b.attrs.match(/class\s*=\s*"([^"]*)"/i) || [, ''])[1].split(/\s+/).filter(Boolean);
      if (classes.some((c) => centeredClasses.has(c))) centered++;
      else if (globalCentered && !(b.attrs.match(/class\s*=\s*"([^"]*)"/i) || [, ''])[1]) centered++;
    }
  }
  const ratio = centered / blocks.length;
  const uncertain = css.trim() === '' && !/<style/i.test(html);
  return {
    ratio,
    blocks: blocks.length,
    centered,
    uncertain,
    reason: uncertain ? 'nenhum CSS disponivel para atribuir text-align' : `sem CSS nao e possivel atribuir; ratio por classe/inline = ${ratio.toFixed(2)}`,
  };
}

// ---------- tokens ----------

export function loadTokens(dir) {
  const file = path.join(dir, 'design', 'tokens.json');
  const text = readIfExists(file);
  if (text === null) return { ok: false, tokens: null, errors: ['design/tokens.json ausente'], uncertain: false };
  try {
    const tokens = JSON.parse(text);
    return { ok: true, tokens, file, errors: [] };
  } catch (e) {
    return { ok: false, tokens: null, errors: [`design/tokens.json invalido: ${e.message}`], uncertain: false, file };
  }
}

export function tokenPaths(tokens) {
  const out = [];
  for (const [group, val] of Object.entries(tokens || {})) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (const k of Object.keys(val)) out.push(`${group}.${k}`);
    }
  }
  return out.sort();
}

export function hexToRgb(value) {
  const v = String(value).trim();
  const m6 = v.match(/^#([0-9a-f]{6})$/i);
  if (m6) {
    const n = parseInt(m6[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m3 = v.match(/^#([0-9a-f]{3})$/i);
  if (m3) {
    const [r, g, b] = m3[1].split('').map((c) => parseInt(c + c, 16));
    return [r, g, b];
  }
  const mf = v.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (mf) return [Number(mf[1]), Number(mf[2]), Number(mf[3])];
  return null;
}

export function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function hueSat(value) {
  const rgb = hexToRgb(value);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

export function numericPx(value) {
  const m = String(value).match(/(-?\d+(?:\.\d+)?)\s*px/);
  return m ? Number(m[1]) : null;
}
