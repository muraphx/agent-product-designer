#!/usr/bin/env node
// tests/build-fixtures.mjs — gera os alvos de teste de forma reprodutivel.
//
// Cada fixture e um workspace completo (design/ + decision-log/ + strategy.md) com
// UM defeito injetado por vez, para provar que cada portao acusa so o que deve.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures');

const STRATEGY = `# Estrategia — agente product designer

## P1 — problema
Design generico e ausencia de decisao registrada, nao falta de gosto.

## P2 — criterio de morte
Se o benchmark nao puder ser publicado, a tese perde valor e o corte se reabre.
`;

const BASE_COLORS = {
  bg: '#12110f',
  surface: '#1a1815',
  ink: '#ece7dd',
  muted: '#8a8279',
  rule: '#2a2724',
  accent: '#b8722c',
  'ink-on-accent': '#f0e7dc',
};

function tokens(extraColors = {}) {
  return {
    color: { ...BASE_COLORS, ...extraColors },
    font: { family: ['Fraunces', 'Inter'], weight: [400, 600, 700] },
    radius: { sm: '4px', md: '8px' },
    shadow: { hairline: '0 1px 0 #2a2724', lift: '0 2px 6px rgba(0,0,0,0.34)' },
    motion: { fast: '120ms', base: '220ms' },
  };
}

const CSS = `:root {
  --bg: #12110f;
  --surface: #1a1815;
  --ink: #ece7dd;
  --muted: #8a8279;
  --rule: #2a2724;
  --accent: #b8722c;
  --ink-on-accent: #f0e7dc;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: Inter, system-ui, sans-serif;
}

.wrap { max-width: 72ch; padding: 4rem 1.5rem; }
h1 { font-family: Fraunces, serif; font-size: 2.5rem; line-height: 1.1; }
.kicker { color: var(--accent); text-transform: uppercase; letter-spacing: .08em; }
.lede { color: var(--muted); font-size: 1.15rem; }
section { border-top: 1px solid var(--rule); padding: 1.5rem 0; }
`;

const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Agente Product Designer — prova antes de gosto</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main class="wrap">
  <section class="hero">
    <p class="kicker">Product design com portao</p>
    <h1>Tres regras que o agente nao consegue contornar</h1>
    <p class="lede">Sem slop. Sem decisao sem estrategia. Sem excesso. Cada uma delas roda como teste antes da entrega.</p>
  </section>
  <section class="why">
    <h2>Por que provar</h2>
    <p>Design generico nao e falta de gosto: e ausencia de decisao registrada.</p>
    <ul>
      <li>Estrategia escrita antes do pixel</li>
      <li>Teto numerico versionado</li>
      <li>Rastro ligando cada token a uma decisao</li>
    </ul>
  </section>
  <section class="how">
    <h2>Como funciona</h2>
    <p>Quatro etapas: descobrir, definir, desenvolver, entregar. Cada uma fecha com um portao.</p>
    <p>Portao vermelho recusa a entrega. Recusar e o comportamento correto.</p>
  </section>
  <section class="evidence">
    <h2>O que e medido</h2>
    <p>Confronto contra um juiz deterministico de 38 regras sobre um corpus de 48 paginas rotuladas.</p>
    <p>Numero com ameaca a validade ao lado, sempre.</p>
  </section>
  <section class="next">
    <h2>Proximo passo</h2>
    <p>O humano aprova a tese. O agente materializa a fase um.</p>
  </section>
</main>
</body>
</html>
`;

function decisionLog(id, covers, { ref = '#p1-problema', status = 'active', affects = ['design/tokens.json'] } = {}) {
  return `---
id: ${id}
decision: "Paleta de 7 valores com um unico accent em ochre (#b8722c), fora da faixa violeta."
status: ${status}
strategy_ref: "${ref}"
evidence:
  - "01-discover-inventory.md — o esqueleto prometia conectores que nao existiam"
covers:
${covers.map((c) => `  - ${c}`).join('\n')}
affects:
${affects.map((a) => `  - ${a}`).join('\n')}
---

Escolha: paleta de 7 valores, um unico accent em ochre (#b8722c), fora da faixa violeta.
Alternativa descartada: gradiente violeta (tell de slop, barrado pelo portao r1).
Criterio de reversao: se o accent precisar cobrir duas superficies distintas, reabrir esta decisao.
`;
}

function allTokenPaths(t) {
  return Object.entries(t).flatMap(([g, v]) => Object.keys(v).map((k) => `${g}.${k}`));
}

function write(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
  }
}

function baseFixture(name, { html = HTML, css = CSS, tok = tokens(), covers = null, decisions = null } = {}) {
  const dir = path.join(FIX, name);
  fs.rmSync(dir, { recursive: true, force: true });
  const paths = covers || allTokenPaths(tok);
  const logs = decisions || { 'DL-0001-paleta.md': decisionLog('DL-0001', paths) };
  write(dir, {
    'strategy.md': STRATEGY,
    'design/tokens.json': JSON.stringify(tok, null, 2) + '\n',
    'design/index.html': html,
    'design/styles.css': css,
    ...Object.fromEntries(Object.entries(logs).map(([k, v]) => [`decision-log/${k}`, v])),
  });
  return dir;
}

// 1. clean — tudo conforme
baseFixture('clean');

// 2. slop — r1 deve acusar: gradiente violeta, emoji, frase de catalogo
baseFixture('slop', {
  html: HTML
    .replace('<h1>Tres regras que o agente nao consegue contornar</h1>', '<h1>Eleve seu produto ao proximo nivel ✨</h1>')
    .replace('<p class="lede">Sem slop.', '<div class="bg-violet-600"></div>\n    <p class="lede">Sem esforço, seamless.')
    .replace('Numero com ameaca a validade ao lado, sempre.', 'Solucao de ponta: unlock the power.'),
  css: CSS + `\n.hero { background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 2rem; }\n`,
});

// 3. untraced — r2 deve acusar: token sem decisao
{
  const tok = tokens();
  const paths = allTokenPaths(tok);
  baseFixture('untraced', { tok, covers: paths.slice(0, 8) });
}

// 4. overcap — r3 deve acusar: 14 cores > teto 12
{
  const extra = Object.fromEntries(
    ['tone-1', 'tone-2', 'tone-3', 'tone-4', 'tone-5', 'tone-6', 'tone-7'].map((k, i) => [k, `#1${i}1${i}1${i}`]),
  );
  const tok = tokens(extra);
  baseFixture('overcap', { tok, covers: allTokenPaths(tok) });
}

// 5. uncertain — nada certo, mas duas incertezas (centered 40-60%, um raio >= 24px)
{
  const centeredHtml = HTML.replace(
    /<p>Design generico([\s\S]*?)<\/p>/,
    '<p class="center">Design generico$1</p>',
  )
    .replace('<p>Quatro etapas: descobrir, definir, desenvolver, entregar. Cada uma fecha com um portao.</p>', '<p class="center">Quatro etapas: descobrir, definir, desenvolver, entregar. Cada uma fecha com um portao.</p>')
    .replace('<p>Portao vermelho recusa a entrega. Recusar e o comportamento correto.</p>', '<p class="center">Portao vermelho recusa a entrega. Recusar e o comportamento correto.</p>')
    .replace('<p>Confronto contra um juiz deterministico de 38 regras sobre um corpus de 48 paginas rotuladas.</p>', '<p class="center">Confronto contra um juiz deterministico de 38 regras sobre um corpus de 48 paginas rotuladas.</p>')
    .replace('<p>Numero com ameaca a validade ao lado, sempre.</p>', '<p class="center">Numero com ameaca a validade ao lado, sempre.</p>')
    .replace('<p>O humano aprova a tese. O agente materializa a fase um.</p>', '<p class="center">O humano aprova a tese. O agente materializa a fase um.</p>')
    .replace('<h2>Por que provar</h2>', '<h2 class="center">Por que provar</h2>');
  const tok = tokens();
  tok.radius.md = '24px';
  baseFixture('uncertain', {
    html: centeredHtml,
    css: CSS + '\n.center { text-align: center; }\n',
    tok,
    covers: allTokenPaths(tok),
  });
}

console.log(`fixtures geradas em ${FIX}`);
for (const name of ['clean', 'slop', 'untraced', 'overcap', 'uncertain']) {
  const dir = path.join(FIX, name);
  const count = fs.readdirSync(dir, { recursive: true }).length;
  console.log(`  ${name} — ${count} entradas`);
}
