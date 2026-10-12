#!/usr/bin/env node
// tests/mcp-smoke.mjs — prova que a memoria do agente e um MCP server de verdade.
//
// Nao basta o arquivo existir: um host (ChatGPT desktop, Codex, Claude) so usa a memoria se o
// handshake JSON-RPC sobre stdio responder. Este teste fala o protocolo com o processo real e
// confere o efeito no disco.
//
//   node tests/mcp-smoke.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { loadCaps, flatCaps } from '../gates/lib/caps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SERVER = path.join(ROOT, 'bin', 'memory-server.mjs');

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

const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-mcp-'));
fs.mkdirSync(path.join(ws, 'design'), { recursive: true });
fs.writeFileSync(
  path.join(ws, 'design', 'tokens.json'),
  JSON.stringify({ color: { bg: '#12110f', ink: '#ece7dd', accent: '#c07a2e' }, space: { s1: '4px' } }, null, 2),
);
const memoryFile = path.join(ws, 'decision-log', 'decisions.jsonl');

const child = spawn(process.execPath, [SERVER], {
  cwd: os.tmpdir(), // cwd errado de proposito: quem manda e PD_WORKSPACE
  env: { ...process.env, PD_WORKSPACE: ws, PD_MEMORY_FILE: '', PD_CAPS_FILE: '' },
  stdio: ['pipe', 'pipe', 'pipe'],
});

const rl = readline.createInterface({ input: child.stdout });
const pending = [];
rl.on('line', (line) => {
  const t = line.trim();
  if (t === '') return;
  let msg = null;
  try {
    msg = JSON.parse(t);
  } catch {
    msg = { parseError: t };
  }
  const waiter = pending.shift();
  if (waiter) waiter(msg);
});
let stderr = '';
child.stderr.on('data', (d) => (stderr += String(d)));

let nextId = 1;
function rpc(method, params, raw = null) {
  const id = nextId++;
  const line = raw !== null ? raw : JSON.stringify({ jsonrpc: '2.0', id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout em ${method}`)), 15000);
    pending.push((msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    child.stdin.write(line + '\n');
  });
}
function notify(method) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
}
const textOf = (res) => {
  const c = res && res.result && res.result.content;
  return c && c[0] ? c[0].text : '';
};
const jsonOf = (res) => {
  try {
    return JSON.parse(textOf(res));
  } catch {
    return null;
  }
};

console.log('\n# handshake MCP (stdio, JSON-RPC 2.0)');
{
  const init = await rpc('initialize', { protocolVersion: '2024-11-05', clientInfo: { name: 'smoke', version: '1' } });
  check('initialize responde protocolVersion', init.result && init.result.protocolVersion === '2024-11-05', JSON.stringify(init).slice(0, 200));
  check('serverInfo.name == pd-memory', init.result && init.result.serverInfo && init.result.serverInfo.name === 'pd-memory');
  check('instructions aponta o workspace', typeof (init.result && init.result.instructions) === 'string' && init.result.instructions.includes(ws));
  notify('notifications/initialized');

  const list = await rpc('tools/list', {});
  const names = ((list.result && list.result.tools) || []).map((t) => t.name).sort();
  const want = ['coverage_gaps', 'list_decisions', 'read_caps', 'record_decision'];
  check('tools/list traz as 4 ferramentas', JSON.stringify(names) === JSON.stringify(want), names.join(','));

  const ping = await rpc('ping', {});
  check('ping responde resultado vazio', ping.result !== undefined && ping.error === undefined, JSON.stringify(ping).slice(0, 120));
}

console.log('\n# read_caps: teto do pacote quando o workspace nao tem budgets/');
{
  const res = await rpc('tools/call', { name: 'read_caps', arguments: {} });
  const out = jsonOf(res);
  const flatDirect = flatCaps(loadCaps(path.join(ROOT, 'budgets', 'caps.yaml')));
  check('read_caps responde sem erro', out !== null, textOf(res).slice(0, 200));
  check('flat do MCP == flat do kernel', out && JSON.stringify(out.flat) === JSON.stringify(flatDirect), JSON.stringify(out && out.flat).slice(0, 200));
  check('caps.file caiu para o teto do pacote', out && String(out.file).includes('budgets'), out && out.file);
}

console.log('\n# record_decision: escreve no disco e recusa decisao sem evidencia');
{
  const good = await rpc('tools/call', {
    name: 'record_decision',
    arguments: {
      id: 'DL-0001-paleta',
      decision: 'paleta escura com um unico accent',
      strategy_ref: '#p1-problema',
      evidence: ['strategy.md#p1-problema', 'docs/research/02-clusters.md'],
      covers: ['color.bg'],
    },
  });
  const out = jsonOf(good);
  check('record_decision aceita decisao completa', out && out.recorded && out.recorded.id === 'DL-0001-paleta', textOf(good).slice(0, 200));
  check('arquivo criado no workspace', fs.existsSync(memoryFile), memoryFile);
  const rows = fs.readFileSync(memoryFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  check('uma linha JSONL persistida', rows.length === 1, `linhas: ${rows.length}`);
  check('linha carrega strategy_ref e recorded_at', rows[0] && rows[0].strategy_ref === '#p1-problema' && !!rows[0].recorded_at, JSON.stringify(rows[0] || {}).slice(0, 200));

  const bad = await rpc('tools/call', { name: 'record_decision', arguments: { id: 'DL-0002', decision: 'sem evidencia', strategy_ref: '#p1' } });
  check('recusa decisao sem evidence (isError)', bad.result && bad.result.isError === true, textOf(bad).slice(0, 160));
  check('mensagem de recusa nomeia evidence', textOf(bad).includes('evidence'), textOf(bad).slice(0, 160));

  const missing = await rpc('tools/call', { name: 'record_decision', arguments: { id: 'DL-0003', evidence: ['x'] } });
  check('recusa decisao sem decision/strategy_ref', missing.result && missing.result.isError === true && textOf(missing).includes('strategy_ref'), textOf(missing).slice(0, 160));
  check('nada a mais foi escrito', fs.readFileSync(memoryFile, 'utf8').trim().split('\n').length === 1);
}

console.log('\n# coverage_gaps e list_decisions leem o mesmo estado');
{
  const gaps = jsonOf(await rpc('tools/call', { name: 'coverage_gaps', arguments: {} }));
  check('coverage_gaps ve 4 tokens', gaps && gaps.tokens === 4, JSON.stringify(gaps));
  check('coverage_gaps acusa 3 sem decisao', gaps && gaps.uncovered.length === 3, JSON.stringify(gaps && gaps.uncovered));
  const list = jsonOf(await rpc('tools/call', { name: 'list_decisions', arguments: {} }));
  check('list_decisions devolve a decisao ativa', list && list.decisions.length === 1 && list.decisions[0].id === 'DL-0001-paleta', JSON.stringify(list).slice(0, 200));
}

console.log('\n# erros do protocolo');
{
  const unknown = await rpc('tools/call', { name: 'nao_existe', arguments: {} });
  check('ferramenta desconhecida falha como isError', unknown.result && unknown.result.isError === true, textOf(unknown).slice(0, 120));
  const method = await rpc('metodo/inexistente', {});
  check('metodo nao suportado devolve -32601', method.error && method.error.code === -32601, JSON.stringify(method).slice(0, 160));
  const broken = await rpc('', null, '{isso nao e json');
  check('JSON invalido devolve -32700', broken.error && broken.error.code === -32700, JSON.stringify(broken).slice(0, 160));
}

child.stdin.end();
child.kill();
check('servidor sem stderr', stderr.trim() === '', stderr.slice(0, 200));
fs.rmSync(ws, { recursive: true, force: true });

console.log(`\n${pass} ok, ${failures.length} falhas`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
