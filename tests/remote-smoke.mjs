#!/usr/bin/env node
// tests/remote-smoke.mjs — prova de protocolo do servidor HTTP (o caminho do ChatGPT web).
//
// Por que existe: o caminho do ChatGPT NAO e stdio. Um cliente remoto fala JSON-RPC por POST
// /mcp, recebe o veredito por JSON e pode nao ter filesystem nenhum. Este teste sobe o servidor
// de verdade numa porta efemera e conversa com ele por HTTP — se o handshake, a lista de
// ferramentas, a recusa e o veredito dos portoes nao passarem daqui, o plugin nao funciona la.
//
//   node tests/remote-smoke.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'bin', 'remote-server.mjs');

let pass = 0;
let fail = 0;
const problems = [];
function ok(label) {
  pass++;
  console.log(`  ok   ${label}`);
}
function bad(label, detail) {
  fail++;
  problems.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}
function is(label, cond, detail) {
  cond ? ok(label) : bad(label, detail);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-remote-test-'));
const ws = path.join(tmp, 'ws');
fs.mkdirSync(path.join(ws, 'decision-log'), { recursive: true });
fs.mkdirSync(path.join(ws, 'design'), { recursive: true });
fs.writeFileSync(
  path.join(ws, 'design', 'tokens.json'),
  JSON.stringify({ color: { bg: '#ffffff', ink: '#111111', accent: '#1f4e5f' }, font: { body: '16px' } }, null, 2),
  'utf8',
);
fs.writeFileSync(
  path.join(ws, 'strategy.md'),
  '# estrategia de teste\n\n## #p1-problema\n\ntexto\n\n## #p2-publico\n\ntexto\n',
  'utf8',
);
const MEM = path.join(ws, 'decision-log', 'decisions.jsonl');

// Artefato que passa: o exemplo do proprio repo, lido do disco inteiro (design/, decision-log/).
// Se ele derrubar o portao, o repo esta quebrado, nao o teste.
function artifactFrom(dir) {
  const files = [];
  const walk = (rel = '') => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else files.push({ path: r, content: fs.readFileSync(path.join(dir, r), 'utf8') });
    }
  };
  walk();
  return files;
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: { ...process.env, PD_HTTP_PORT: '0', PD_HTTP_HOST: '127.0.0.1', PD_WORKSPACE: ws, PD_MEMORY_FILE: MEM, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout.on('data', (c) => (out += c));
  child.stderr.on('data', (c) => (err += c));
  const ready = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`servidor nao subiu em 15s; stdout=${out.slice(0, 200)}; stderr=${err.slice(0, 200)}`)), 15000);
    const poll = setInterval(() => {
      const m = /http:\/\/127\.0\.0\.1:(\d+)\/mcp/.exec(out);
      if (m) {
        clearInterval(poll);
        clearTimeout(t);
        resolve(Number(m[1]));
      }
    }, 50);
  });
  return { child, ready, stderr: () => err };
}

function rpcFactory(port, token) {
  return async (body, headers = {}) => {
    const r = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await r.text();
    let json = null;
    try {
      json = text === '' ? null : JSON.parse(text);
    } catch {
      json = { _raw: text.slice(0, 200) };
    }
    return { status: r.status, json };
  };
}

const toolText = (res) => {
  const c = res.json?.result?.content?.[0]?.text;
  if (typeof c !== 'string') throw new Error(`sem conteudo de texto na resposta: ${JSON.stringify(res.json).slice(0, 300)}`);
  return JSON.parse(c);
};

const call = (rpc, name, args = {}) => rpc({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } });

console.log('remote-smoke: servidor HTTP (ChatGPT web / conector MCP)');

let srv;
try {
  srv = startServer();
  const port = await srv.ready;
  const rpc = rpcFactory(port);
  is('servidor sobe e anuncia a porta', Number.isInteger(port) && port > 0);

  const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
  is('/health responde ok', health.ok === true, JSON.stringify(health).slice(0, 120));
  is('/health aponta a memoria do workspace', health.memory === MEM, health.memory);
  is('/health diz auth=nenhuma sem PD_HTTP_TOKEN', health.auth === 'none', health.auth);

  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } });
  is('initialize devolve serverInfo pd-remote', init.json?.result?.serverInfo?.name === 'pd-remote', JSON.stringify(init.json).slice(0, 160));
  is('initialize ecoa a versao pedida', init.json?.result?.protocolVersion === '2025-06-18', init.json?.result?.protocolVersion);
  const instr = init.json?.result?.instructions || '';
  is('instructions presente e dentro do teto de 1024', instr.length > 0 && instr.length <= 1024, `${instr.length} chars`);
  is('instructions e auto-suficiente (cita as ferramentas)', instr.includes('pd_kernel_rules') && instr.includes('pd_run_gates'), instr.slice(0, 80));

  const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const tools = list.json?.result?.tools || [];
  is('tools/list devolve 6 ferramentas', tools.length === 6, String(tools.length));
  is('toda ferramenta tem inputSchema e descricao de acao', tools.every((t) => t.inputSchema && /^Use this when/.test(t.description || '')), tools.map((t) => t.name).join(','));
  is('nomes esperados presentes', ['pd_kernel_rules', 'pd_read_caps', 'pd_run_gates', 'pd_record_decision', 'pd_list_decisions', 'pd_coverage_gaps'].every((n) => tools.some((t) => t.name === n)));

  const rules = toolText(await call(rpc, 'pd_kernel_rules'));
  is('pd_kernel_rules devolve as 3 regras duras', (rules.rules || []).length === 3 && rules.rules[0].id === 'R1', JSON.stringify(rules.rules?.map((r) => r.id)));
  is('pd_kernel_rules declara a politica de incerteza e o portao humano', typeof rules.uncertainty_policy === 'string' && typeof rules.human_gate === 'string');

  const caps = toolText(await call(rpc, 'pd_read_caps'));
  is('pd_read_caps devolve o teto achatado', caps.flat && Object.keys(caps.flat).length === 11, `${Object.keys(caps.flat || {}).length} chaves`);
  is('pd_read_caps aponta um caps.yaml existente', fs.existsSync(caps.file), caps.file);

  const minimal = toolText(await call(rpc, 'pd_run_gates', { files: [{ path: 'index.html', content: '<!doctype html><html><body><h1>ok</h1></body></html>' }] }));
  is('artefato solto sem rastro e recusado (exit != 0)', minimal.exit_code !== 0, String(minimal.exit_code));
  is('veredito diz refused', /^refused/.test(minimal.verdict || ''), minimal.verdict);
  is('hint diz o que mandar na mesma chamada', Array.isArray(minimal.hint) && minimal.hint.length > 0, JSON.stringify(minimal.hint).slice(0, 120));

  const clean = toolText(await call(rpc, 'pd_run_gates', { files: artifactFrom(path.join(ROOT, 'examples', 'landing')) }));
  is('artefato completo do repo passa (exit 0, status pass)', clean.exit_code === 0 && clean.status === 'pass', `exit=${clean.exit_code} status=${clean.status}`);
  is('veredito de pass e explicito', /^pass/.test(clean.verdict || ''), clean.verdict);

  const traversal = await call(rpc, 'pd_run_gates', { files: [{ path: '../escaped.html', content: 'x' }] });
  is('caminho com .. e recusado (nao escreve fora do tmp)', traversal.json?.result?.isError === true, JSON.stringify(traversal.json).slice(0, 160));

  const noEvidence = await call(rpc, 'pd_record_decision', { id: 'DL-x', decision: 'sem fonte', strategy_ref: '#p1-problema' });
  is('decisao sem evidencia e recusada como isError', noEvidence.json?.result?.isError === true, JSON.stringify(noEvidence.json).slice(0, 160));
  is('a recusa explica o campo que falta', /evidence|evidencia/.test(noEvidence.json?.result?.content?.[0]?.text || ''));

  const rec = toolText(
    await call(rpc, 'pd_record_decision', {
      id: 'DL-0001-teste',
      decision: 'tokens de teste justificados pela estrategia',
      strategy_ref: '#p1-problema',
      evidence: ['strategy.md#p1-problema'],
      covers: ['color.bg', 'color.ink', 'color.accent', 'font.body'],
    }),
  );
  is('decisao completa e gravada e devolve o id', rec.recorded?.id === 'DL-0001-teste', JSON.stringify(rec).slice(0, 160));
  is('gravou de fato no disco do workspace', fs.existsSync(MEM) && fs.readFileSync(MEM, 'utf8').trim().split('\n').length === 1, `${MEM} -> ${fs.existsSync(MEM) ? fs.readFileSync(MEM, 'utf8').trim().split('\n').length : 'ausente'} linha(s)`);

  const gaps = toolText(await call(rpc, 'pd_coverage_gaps'));
  is('cobertura fecha depois da decisao (uncovered vazio)', Array.isArray(gaps.uncovered) && gaps.uncovered.length === 0, JSON.stringify(gaps).slice(0, 160));

  const listed = toolText(await call(rpc, 'pd_list_decisions'));
  is('pd_list_decisions lista a decisao ativa', listed.decisions?.length === 1 && listed.total === 1, JSON.stringify(listed).slice(0, 160));

  const batch = await rpc([
    { jsonrpc: '2.0', id: 10, method: 'tools/list' },
    { jsonrpc: '2.0', id: 11, method: 'ping' },
  ]);
  is('lote JSON-RPC devolve lote de respostas', Array.isArray(batch.json) && batch.json.length === 2, JSON.stringify(batch.json).slice(0, 120));

  const note = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
  is('notificacao (sem id) e aceita com 202 sem corpo', note.status === 202 && note.json === null, `status=${note.status}`);

  const junk = await rpc('{nao e json');
  is('JSON invalido devolve 400 e -32700', junk.status === 400 && junk.json?.error?.code === -32700, JSON.stringify(junk.json).slice(0, 120));

  const unknown = await call(rpc, 'pd_nao_existe');
  is('ferramenta desconhecida vira isError (nao derruba o servidor)', unknown.json?.result?.isError === true);

  const badMethod = await rpc({ jsonrpc: '2.0', id: 12, method: 'resources/list' });
  is('metodo nao suportado devolve -32601', badMethod.json?.error?.code === -32601, JSON.stringify(badMethod.json).slice(0, 120));

  const getMcp = await fetch(`http://127.0.0.1:${port}/mcp`);
  is('GET /mcp responde 405 declarando o metodo aceito', getMcp.status === 405 && String(getMcp.headers.get('allow') || '').includes('POST'), `status=${getMcp.status} allow=${getMcp.headers.get('allow')}`);

  const del = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'DELETE' });
  is('DELETE /mcp responde 204 (sessao sem estado)', del.status === 204, String(del.status));

  const lost = await fetch(`http://127.0.0.1:${port}/nao-existe`);
  is('rota desconhecida devolve 404 com dica', lost.status === 404);

  const stderrSoFar = srv.stderr();
  is('servidor sem stderr', stderrSoFar.trim() === '', stderrSoFar.slice(0, 200));
} catch (e) {
  bad('execucao', e.message);
} finally {
  if (srv) srv.child.kill();
}

// Token: o modo publico. Sem servidor de teste separado nao haveria como provar que a auth barra.
let srv2;
try {
  srv2 = startServer({ PD_HTTP_TOKEN: 'segredo-de-teste' });
  const port2 = await srv2.ready;
  const rpc2 = rpcFactory(port2, 'segredo-de-teste');
  const noAuth = await fetch(`http://127.0.0.1:${port2}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  is('com PD_HTTP_TOKEN, requisicao sem header e 401', noAuth.status === 401, String(noAuth.status));
  const withAuth = await rpc2({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  is('com PD_HTTP_TOKEN, header Bearer passa', withAuth.status === 200 && (withAuth.json?.result?.tools || []).length === 6, String(withAuth.status));
  const byQuery = await fetch(`http://127.0.0.1:${port2}/mcp?token=segredo-de-teste`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' }),
  });
  is('token por query string tambem passa (clientes sem header)', byQuery.status === 200, String(byQuery.status));
} catch (e) {
  bad('execucao com token', e.message);
} finally {
  if (srv2) srv2.child.kill();
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} ok, ${fail} falhas`);
if (problems.length) console.log(problems.map((p) => `  - ${p}`).join('\n'));
process.exit(fail === 0 ? 0 : 1);
