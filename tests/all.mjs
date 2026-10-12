#!/usr/bin/env node
// tests/all.mjs — a suite. Prova que cada portao acusa o que deve e cala quando nao ha defeito.
//
//   node tests/build-fixtures.mjs && node tests/all.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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

console.log('\n# 13. a medicao e reproduzivel e o preregistro veio antes');
{
  const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
  const node = (rel) => path.join(ROOT, ...rel.split('/'));

  // (a) a convencao de metrica tem prova propria
  const selfCheck = spawnSync(process.execPath, [node('bench/lib/metrics.mjs'), '--self-check'], { encoding: 'utf8' });
  const selfTail = (selfCheck.stdout || '').trim().split('\n').slice(-1)[0];
  check('metrics: --self-check sai 0', selfCheck.status === 0, `${selfTail} | ${(selfCheck.stderr || '').slice(0, 200)}`);

  // (b) o corpus medido e o corpus registrado
  const labeledPath = node('bench/corpus/labeled.jsonl');
  const labeledRaw = fs.readFileSync(labeledPath);
  const rows = labeledRaw.toString('utf8').trim().split(/\r?\n/).filter((l) => l.trim() !== '');
  check('corpus: 48 paginas rotuladas', rows.length === 48, `${rows.length} linhas`);
  const corpusSha = sha256(labeledRaw);
  const vendored = fs.readFileSync(node('bench/VENDORED.md'), 'utf8');
  check('corpus: sha256 do labeled.jsonl igual ao de bench/VENDORED.md', vendored.includes(corpusSha), corpusSha.slice(0, 16));

  // (c) determinismo: o JSON nao pode carregar relogio, entao duas execucoes tem que bater byte a byte.
  // Roda o subconjunto kernel+judge para nao pagar os ~200s do impeccable (CLI de terceiro via npx)
  // em cada `npm test`. A lane completa e verificada na publicacao e o hash das duas execucoes
  // completas fica em bench/RESULTS.md.
  const laneJson = node('bench/results/lane-a.json');
  const tmpOut = node('bench/results/.determinism.json');
  // cwd explicito e --out absoluto: sem isso, quem chama de outro diretorio (npx/install.mjs
  // --validate) faz a lane gravar o JSON relativo ao CWD do chamador e a comparacao le null vs null.
  const runLane = (args = []) => spawnSync(process.execPath, [node('bench/run-lane-a.mjs'), ...args], { encoding: 'utf8', cwd: ROOT });
  const det = ['--only=kernel,judge', `--out=${tmpOut}`];
  const first = runLane(det);
  check('lane-a: primeira execucao deterministica sai 0', first.status === 0, (first.stderr || '').slice(0, 200));
  const hashFirst = fs.existsSync(tmpOut) ? sha256(fs.readFileSync(tmpOut)) : null;
  const second = runLane(det);
  check('lane-a: segunda execucao deterministica sai 0', second.status === 0, (second.stderr || '').slice(0, 200));
  const hashSecond = fs.existsSync(tmpOut) ? sha256(fs.readFileSync(tmpOut)) : null;
  check('lane-a: duas execucoes produzem o mesmo JSON (H4)', !!hashFirst && hashFirst === hashSecond, `${String(hashFirst).slice(0, 12)} vs ${String(hashSecond).slice(0, 12)}`);
  if (fs.existsSync(tmpOut)) fs.rmSync(tmpOut);
  check('lane-a: o JSON publicado existe (lane completa ja foi medida)', fs.existsSync(laneJson));

  const lane = JSON.parse(fs.readFileSync(laneJson, 'utf8'));
  const allKeys = [];
  const walkKeys = (value) => {
    if (Array.isArray(value)) value.forEach(walkKeys);
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        allKeys.push(k);
        walkKeys(v);
      }
    }
  };
  walkKeys(lane);
  check('lane-a: nenhum campo de relogio no JSON', !allKeys.some((k) => /timestamp|elapsed|_at$/i.test(k)), allKeys.filter((k) => /timestamp|elapsed|_at$/i.test(k)).join(','));

  // (d) o preregistro nomeia as metricas que o resultado publica (o prereg e em portugues:
  //     cada metrica tem que ser nomeada na sua lingua, e o JSON tem que carregar a chave exata)
  const prereg = fs.readFileSync(node('prereg/lane-a.md'), 'utf8');
  const laneRaw = fs.readFileSync(laneJson, 'utf8');
  const METRICS = {
    precision: /precis[ãa]o|precision/i,
    recall: /recall|revoca[çc][ãa]o|sensibilidade/i,
    f1: /\bF1\b/i,
    escape_rate: /escape|taxa de escape/i
  };
  for (const [key, named] of Object.entries(METRICS)) {
    check(`lane-a: "${key}" do prereg aparece no resultado`, named.test(prereg) && laneRaw.includes(`"${key}"`));
  }

  check('lane-a: quatro adapters medidos', Array.isArray(lane.adapters) && lane.adapters.length === 4, `${lane.adapters && lane.adapters.length}`);
  check('lane-a: adapter indisponivel nao vira zero', lane.adapters.every((a) => a.available === true || a.precision === null), JSON.stringify(lane.adapters.filter((a) => a.available === false).map((a) => [a.adapter, a.precision])));
  check('lane-a: escape conta incomplete e error', fs.readFileSync(node('bench/run-lane-a.mjs'), 'utf8').includes("'incomplete'") && fs.readFileSync(node('bench/run-lane-a.mjs'), 'utf8').includes("'error'"));
}

console.log(`\n${pass} ok, ${failures.length} falhas`);
if (failures.length) {
  console.log('\nfalhas:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
