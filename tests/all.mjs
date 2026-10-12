#!/usr/bin/env node
// tests/all.mjs — a suite. Prova que cada portao acusa o que deve e cala quando nao ha defeito.
//
//   node tests/build-fixtures.mjs && node tests/all.mjs

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCapsStrict as parseCaps, loadCaps, CAP_KEYS } from '../gates/lib/caps.mjs';
import { CHECKS } from '../gates/r3-budgets.mjs';
import { structure } from '../gates/lib/scan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FIX = path.join(HERE, 'fixtures');

let pass = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function runGate(name, args = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'gates', 'run.mjs'), path.join(FIX, name), ...args], {
    encoding: 'utf8',
  });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    json = null;
  }
  return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

const gateOf = (report, id) => (report && report.gates ? report.gates.find((g) => g.gate === id) : null);
const rules = (g) => (g && g.violations ? g.violations.map((v) => v.rule) : []);

console.log('\n# 1. alvo limpo passa');
{
  const r = runGate('clean', ['--json']);
  check('limpo: exit 0', r.code === 0, `exit ${r.code}`);
  check('limpo: relatorio parseavel', !!r.json, r.stderr.slice(0, 200));
  check('limpo: status pass', r.json && r.json.status === 'pass', r.json && r.json.status);
  const v = (r.json && r.json.gates ? r.json.gates : []).flatMap((g) => g.violations || []);
  const i = (r.json && r.json.gates ? r.json.gates : []).flatMap((g) => g.incomplete || []);
  check('limpo: zero violacoes', v.length === 0, JSON.stringify(v.slice(0, 3)));
  check('limpo: zero incompletos', i.length === 0, JSON.stringify(i.slice(0, 3)));
}

console.log('\n# 2. slop barra em r1 (sem AI slop)');
{
  const r = runGate('slop', ['--json']);
  check('slop: exit 1', r.code === 1, `exit ${r.code}`);
  const r1 = gateOf(r.json, 'r1');
  const rs = rules(r1);
  check('slop: r1 fail', r1 && r1.status === 'fail', r1 && r1.status);
  check('slop: acusa gradiente violeta', rs.includes('ai-gradient'), rs.join(','));
  check('slop: acusa emoji decorativo', rs.includes('decorative-emoji'), rs.join(','));
  check('slop: acusa frase de catalogo', rs.includes('stock-copy'), rs.join(','));
  check('slop: r2 passa', gateOf(r.json, 'r2') && gateOf(r.json, 'r2').status === 'pass');
  check('slop: r3 passa', gateOf(r.json, 'r3') && gateOf(r.json, 'r3').status === 'pass', rules(gateOf(r.json, 'r3')).join(','));
}

console.log('\n# 3. entrega sem rastro barra em r2 (sem decisao sem estrategia)');
{
  const r = runGate('untraced', ['--json']);
  check('untraced: exit 1', r.code === 1, `exit ${r.code}`);
  const r2 = gateOf(r.json, 'r2');
  check('untraced: r2 fail', r2 && r2.status === 'fail', r2 && r2.status);
  check('untraced: acusa token sem decisao', rules(r2).includes('token-uncovered'), rules(r2).join(','));
  check('untraced: r1 passa', gateOf(r.json, 'r1') && gateOf(r.json, 'r1').status === 'pass');
  check('untraced: r3 passa', gateOf(r.json, 'r3') && gateOf(r.json, 'r3').status === 'pass');
}

console.log('\n# 4. excesso numerico barra em r3 (sem excessos)');
{
  const r = runGate('overcap', ['--json']);
  check('overcap: exit 1', r.code === 1, `exit ${r.code}`);
  const r3 = gateOf(r.json, 'r3');
  check('overcap: r3 fail', r3 && r3.status === 'fail', r3 && r3.status);
  check('overcap: acusa teto de cores', rules(r3).includes('over-cap-colors'), rules(r3).join(','));
  check('overcap: r1 passa', gateOf(r.json, 'r1') && gateOf(r.json, 'r1').status === 'pass');
  check('overcap: r2 passa', gateOf(r.json, 'r2') && gateOf(r.json, 'r2').status === 'pass', rules(gateOf(r.json, 'r2')).join(','));
}

console.log('\n# 5. duvida honesta vira incompleto, nunca chute');
{
  const r = runGate('uncertain', ['--json']);
  check('uncertain: exit 0 sem --strict', r.code === 0, `exit ${r.code}`);
  check('uncertain: status incomplete', r.json && r.json.status === 'incomplete', r.json && r.json.status);
  const v = (r.json && r.json.gates ? r.json.gates : []).flatMap((g) => g.violations || []);
  check('uncertain: zero violacoes', v.length === 0, JSON.stringify(v));
  const inc = (r.json && r.json.gates ? r.json.gates : []).flatMap((g) => (g.incomplete || []).map((x) => x.rule));
  check('uncertain: r1 declara centered na faixa de duvida', inc.includes('centered-everything'), inc.join(','));
  check('uncertain: r3 declara raio grande ambiguo', inc.includes('over-rounded'), inc.join(','));
  const s = runGate('uncertain', ['--json', '--strict']);
  check('uncertain: --strict barra (exit 1)', s.code === 1, `exit ${s.code}`);
}

console.log('\n# 6. parser de teto e estrito de verdade');
{
  const caps = loadCaps(path.join(ROOT, 'budgets', 'caps.yaml'));
  check('caps: version 1', caps.version === 1, String(caps.version));
  check('caps: colors_max 12', caps.tokens.colors_max === 12);
  check('caps: palavras_max 1200', caps.copy.words_max === 1200);
  const throws = (src) => {
    try {
      parseCaps(src);
      return false;
    } catch {
      return true;
    }
  };
  check('caps: rejeita tabulacao', throws('a:\n\tb: 1\n'));
  check('caps: rejeita lista em bloco', throws('a:\n  - b\n'));
  check('caps: rejeita chave duplicada', throws('a: 1\na: 2\n'));
  check('caps: rejeita valor vazio', throws('a:\n'));
  check('caps: aceita escalares', (() => {
    const c = parseCaps('a: 1\nb: 2.5\nc: true\nd: "x y"\ne:\n  f: 3\n');
    return c.a === 1 && c.b === 2.5 && c.c === true && c.d === 'x y' && c.e.f === 3;
  })());
}

console.log('\n# 7. teto sem dono e bug — todo cap e consultado');
{
  const caps = loadCaps(path.join(ROOT, 'budgets', 'caps.yaml'));
  const flat = [];
  const walk = (obj, prefix = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object') walk(v, key);
      else flat.push(key);
    }
  };
  walk(caps);
  const used = new Set(CHECKS.map((c) => c[1]));
  const orphans = flat.filter((k) => k !== 'version' && !used.has(k));
  check('caps: nenhum teto orfao', orphans.length === 0, orphans.join(','));
  check('caps: CAP_KEYS cobre tudo', flat.filter((k) => k !== 'version').every((k) => CAP_KEYS.includes(k)));
}

console.log('\n# 8. empacotamento (Agent Plugins 1.0.0 + Agent Skills)');
{
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin.json'), 'utf8'));
  const allowed = ['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'skills', 'mcp'];
  const extra = Object.keys(plugin).filter((k) => !allowed.includes(k));
  check('plugin.json: sem campo inventado', extra.length === 0, extra.join(','));
  check('plugin.json: nome valido', /^[a-z0-9][a-z0-9-]{0,63}$/.test(plugin.name), plugin.name);
  check('plugin.json: versao semver', /^\d+\.\d+\.\d+/.test(plugin.version), plugin.version);
  check('plugin.json: schema oficial', plugin.$schema === 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');

  const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, 'mcp.json'), 'utf8'));
  const mcpExtra = Object.keys(mcp).filter((k) => !['$schema', 'mcpServers'].includes(k));
  check('mcp.json: sem campo inventado', mcpExtra.length === 0, mcpExtra.join(','));
  check('mcp.json: um servidor stdio', Object.values(mcp.mcpServers).every((s) => s.type === 'stdio' && s.command));

  const skillsDir = path.join(ROOT, 'skills');
  const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  check('skills: existe pelo menos uma skill', dirs.length > 0);
  for (const d of dirs) {
    const f = path.join(skillsDir, d, 'SKILL.md');
    if (!fs.existsSync(f)) {
      check(`skills/${d}: SKILL.md existe`, false);
      continue;
    }
    const raw = fs.readFileSync(f, 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) {
      check(`skills/${d}: frontmatter presente`, false);
      continue;
    }
    const fm = m[1];
    const name = (fm.match(/^name:\s*(.+)$/m) || [])[1];
    const desc = (fm.match(/^description:\s*(.+)$/m) || [])[1] || '';
    check(`skills/${d}: name == diretorio`, (name || '').trim() === d, `${name} vs ${d}`);
    check(`skills/${d}: description <= 1024`, desc.length <= 1024, `${desc.length} chars`);

    // Defeito de classe: skill que aponta para arquivo que nao foi vendorizado.
    const cited = [...raw.matchAll(/(?:^|[\s(\[])((?:references?|scripts|director|patterns)\/[A-Za-z0-9._/-]+)/g)]
      .map((m) => m[1].replace(/[.,;)]+$/, ''))
      .filter((p) => !/\/$/.test(p));
    const missing = [...new Set(cited)].filter((p) => !fs.existsSync(path.join(skillsDir, d, p)));
    check(`skills/${d}: toda referencia citada existe`, missing.length === 0, missing.slice(0, 4).join(','));
  }
}

console.log('\n# 9. medicao nao pode ser cega (ponto cego = aprovacao falsa)');
{
  const page = `<!DOCTYPE html><html><body><main>
    <section class="a"><h1>Titulo</h1><p>Um</p></section>
    <section class="b"><h2>Dois</h2><div><span>x</span><span>y</span><span>z</span></div></section>
    <section class="c"><p>Tres</p><ul><li>a</li><li>b</li></ul></section>
  </main></body></html>`;
  const st = structure(page);
  check('estrutura: conta todas as sections, com atributos', st.sections === 3, `sections=${st.sections}`);
  check('estrutura: conta filhos diretos, nao netos', st.maxElementsPerSection === 2, `max=${st.maxElementsPerSection}`);
  const wide = `<!DOCTYPE html><html><body><section><a>1</a><b>2</b><i>3</i><u>4</u></section></body></html>`;
  check('estrutura: bloco largo conta 4', structure(wide).maxElementsPerSection === 4, `max=${structure(wide).maxElementsPerSection}`);
  check('estrutura: html bem formado', st.wellFormed === true);
  const nested = `<!DOCTYPE html><html><body><div><section><p>x</p></section></div></body></html>`;
  check('estrutura: section aninhada conta 1', structure(nested).sections === 1, `sections=${structure(nested).sections}`);
  const unbalanced = `<!DOCTYPE html><html><body><section><p>x</p></body></html>`;
  check('estrutura: html desbalanceado nao passa por bom', structure(unbalanced).wellFormed === false);
}

console.log('\n# 10. o exemplo publicado passa nos proprios portoes');
{
  const r = spawnSync(process.execPath, [path.join(ROOT, 'gates', 'run.mjs'), path.join(ROOT, 'examples', 'landing'), '--json'], { encoding: 'utf8' });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    json = null;
  }
  check('exemplo: relatorio parseavel', !!json, (r.stderr || '').slice(0, 200));
  check('exemplo: exit 0', r.status === 0, `exit ${r.status}`);
  check('exemplo: status pass', json && json.status === 'pass', json && json.status);
  const r2 = json && json.gates ? json.gates.find((g) => g.gate === 'r2') : null;
  check('exemplo: rastro cobre todos os tokens', r2 && r2.metrics.uncoveredTokens === 0, r2 && JSON.stringify(r2.metrics));
  const r3 = json && json.gates ? json.gates.find((g) => g.gate === 'r3') : null;
  check('exemplo: medicao ve as cinco sessoes', r3 && r3.metrics.sections === 5, r3 && JSON.stringify(r3.metrics.sections));
}

console.log('\n# 11. memoria MCP: mesmo servidor para o spec e para o Claude');
{
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'mcp.json'), 'utf8'));
  const claude = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
  const a = spec.mcpServers['pd-memory'];
  const b = claude.mcpServers['pd-memory'];
  check('mcp: os dois manifestos declaram pd-memory', !!a && !!b);
  check('mcp: mesmo comando', a.command === b.command, `${a.command} vs ${b.command}`);
  check('mcp: mesmo numero de args', a.args.length === b.args.length);
  check('mcp: apontam para bin/memory-server.mjs', a.args.join(' ').includes('bin/memory-server.mjs') && b.args.join(' ').includes('bin/memory-server.mjs'));
  check('mcp: o script do servidor existe', fs.existsSync(path.join(ROOT, 'bin', 'memory-server.mjs')));

  // Fim a fim: sobe o servidor, faz o handshake e pede as ferramentas.
  const probe = spawnSync(process.execPath, [path.join(ROOT, 'bin', 'memory-server.mjs')], {
    input:
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) +
      '\n' +
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) +
      '\n' +
      JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'record_decision', arguments: { id: 'DL-probe', decision: 'probe', strategy_ref: '#p1-problema' } } }) +
      '\n',
    encoding: 'utf8',
    env: { ...process.env, PD_MEMORY_FILE: path.join(FIX, 'probe-memory.jsonl'), PD_WORKSPACE: path.join(FIX, 'clean') },
  });
  const lines = (probe.stdout || '').split(/\r?\n/).filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
  const init = lines.find((l) => l.id === 1);
  const list = lines.find((l) => l.id === 2);
  const refused = lines.find((l) => l.id === 3);
  check('mcp: handshake responde initialize', init && init.result && init.result.serverInfo.name === 'pd-memory', JSON.stringify(init).slice(0, 120));
  check('mcp: tools/list devolve quatro ferramentas', list && list.result.tools.length === 4, list && list.result.tools.length);
  check('mcp: recusa decisao sem evidencia', refused && refused.result.isError === true, JSON.stringify(refused).slice(0, 160));
  check('mcp: recusa sem gravar nada', !fs.existsSync(path.join(FIX, 'probe-memory.jsonl')) || fs.readFileSync(path.join(FIX, 'probe-memory.jsonl'), 'utf8').trim() === '');
}

console.log('\n# 12. as instrucoes nao citam arquivo que nao existe');
{
  const md = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  // `tools/call` e `tools/list` sao nomes de metodo MCP, nao caminhos de arquivo.
  const PROTOCOL = new Set(['tools/call', 'tools/list']);
  const cited = [...md.matchAll(/`([A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+)`/g)]
    .map((m) => m[1])
    .filter((p) => !p.includes('*') && !PROTOCOL.has(p));
  const missing = [...new Set(cited)].filter((p) => !fs.existsSync(path.join(ROOT, p)));
  check(`AGENTS.md: ${cited.length} caminhos citados existem`, missing.length === 0, missing.slice(0, 5).join(','));
}

console.log(`\n${pass} ok, ${failures.length} falhas`);
if (failures.length) {
  console.log('\nfalhas:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
