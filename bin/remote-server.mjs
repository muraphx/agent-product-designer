#!/usr/bin/env node
// bin/remote-server.mjs — o agente como plugin/conector do ChatGPT (MCP remoto sobre HTTP).
//
// Por que existe: o ChatGPT na web NAO fala stdio — ele exige um endpoint HTTPS publico que fale
// Streamable HTTP (ou SSE). O bin/memory-server.mjs continua sendo o caminho do Codex desktop e do
// Claude Code; este arquivo e o mesmo agente exposto por rede, para `chatgpt.com/plugins`.
//
// O servidor nao guarda sessao (Streamable HTTP stateless): cada POST /mcp e um lote JSON-RPC
// respondido por JSON. Sem dependencia externa.
//
//   node bin/remote-server.mjs                 # http://127.0.0.1:8787/mcp
//   PD_HTTP_PORT=9000 PD_HTTP_HOST=0.0.0.0 node bin/remote-server.mjs
//   PD_HTTP_TOKEN=segredo node bin/remote-server.mjs   # exige Authorization: Bearer segredo
//   node bin/remote-server.mjs --selftest      # sobe, fala JSON-RPC consigo mesmo e sai

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import {
  PLUGIN_ROOT,
  workspace,
  appendDecision,
  readDecisions,
  coverageGaps,
  readCaps,
  materializeFiles,
  runGates,
  memoryFile,
} from './pd-core.mjs';

const SERVER = { name: 'pd-remote', version: '0.1.0' };
const DEFAULT_PROTOCOL = '2025-06-18';
const TOKEN = (process.env.PD_HTTP_TOKEN || '').trim();
const PORT = Number(process.env.PD_HTTP_PORT || 8787);
const HOST = process.env.PD_HTTP_HOST || '127.0.0.1';

// Primeiros 512 caracteres precisam se sustentar sozinhos: e o texto que o modelo le sempre.
const INSTRUCTIONS = [
  'Agente product designer sob tres portoes bloqueantes. Use pd_kernel_rules antes de produzir',
  'qualquer artefato visual e pd_run_gates antes de afirmar que uma entrega esta pronta: o veredito',
  'vem de exit code e JSON, nunca de opiniao. Regra dura: entrega com status fail e recusada;',
  'entrega incomplete so segue com a incerteza declarada ao humano. Registrar escolha exige',
  'pd_record_decision com strategy_ref e evidence nao vazia — sem isso a memoria recusa. O humano',
  'aprova ou rejeita; o agente nao se auto-aprova.',
].join(' ');

const TOOLS = [
  {
    name: 'pd_kernel_rules',
    description:
      'Use this when starting any design deliverable (landing page, UI, design system, visual artifact) for this workspace. Returns the three blocking rules (no AI slop, no decision without strategy, no excess), the mandatory uncertainty policy, and the delivery contract. Call it first; the other tools enforce what it states.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'pd_read_caps',
    description:
      'Use this when you need the numeric ceiling this workspace enforces (max colors, accents, font families/weights/radii/shadows/durations, sections, elements per section, words). The gate pd_run_gates fails any artifact above these numbers, so read them before writing tokens or copy.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'pd_run_gates',
    description:
      'Use this when an artifact exists and you are about to claim it is ready, or when the user asks whether a deliverable passes. Pass every file of the artifact (HTML/CSS/JS/tokens/strategy as text). Returns the machine verdict per gate (pass | fail | incomplete) with rule ids and evidence. A fail means the delivery is refused: fix the cause in the files and call again. Do not describe the artifact as approved without calling this.',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          description: 'Artifact files. Path is relative inside the artifact folder (e.g. "index.html", "design/tokens.json", "strategy.md").',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'relative path, e.g. index.html — no absolute path, no ".."' },
              content: { type: 'string', description: 'full file content as text' },
            },
            required: ['path', 'content'],
          },
        },
        strict: { type: 'boolean', description: 'true turns declared uncertainty (incomplete) into a non-zero exit as well' },
      },
      required: ['files'],
    },
  },
  {
    name: 'pd_record_decision',
    description:
      'Use this when a design choice is made and must be traceable to a source (palette, type scale, state color, spacing). Writes one record to the append-only decision log; the trace gate depends on it. Refused when id, decision, strategy_ref or a non-empty evidence list is missing — the refusal is the feature, not an error to work around.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'e.g. DL-0007-paleta' },
        decision: { type: 'string', description: 'what was decided, in one sentence' },
        strategy_ref: { type: 'string', description: 'anchor in strategy.md, e.g. #p1-problema' },
        evidence: { type: 'array', items: { type: 'string' }, description: 'sources: file + finding, one per item' },
        covers: { type: 'array', items: { type: 'string' }, description: 'tokens justified by this decision, e.g. color.accent' },
        affects: { type: 'array', items: { type: 'string' }, description: 'affected paths' },
        status: { type: 'string', enum: ['active', 'superseded'], default: 'active' },
      },
      required: ['id', 'decision', 'strategy_ref', 'evidence'],
    },
  },
  {
    name: 'pd_list_decisions',
    description: 'Use this when you need the decisions already recorded in this workspace before contradicting one. Returns the records (active by default).',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'superseded'] } } },
  },
  {
    name: 'pd_coverage_gaps',
    description:
      'Use this when checking whether every design token is justified. Returns the tokens that no active decision covers; an empty list means the trace is complete. Same number the trace gate uses.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function kernelRules() {
  return {
    rules: [
      { id: 'R1', name: 'sem AI slop', gate: 'r1', fails_when: 'a real slop tell is found (gradient violet, decorative emoji, catalogue phrase, centered-everything, generic hero)' },
      { id: 'R2', name: 'sem decisao sem estrategia', gate: 'r2', fails_when: 'a token has no active decision covering it, or a decision has no valid strategy reference' },
      { id: 'R3', name: 'sem excessos', gate: 'r3', fails_when: 'any count in caps.yaml is exceeded' },
    ],
    uncertainty_policy: 'When the detector is not sure the gate returns incomplete — never fail, never silence. incomplete reaches the human.',
    false_positive_policy: 'fail requires mechanical evidence; otherwise the finding is incomplete with the declared reason.',
    delivery_contract: [
      'research/ with the four research Double Diamond stages',
      'runnable artifact (HTML/CSS/component) that opens without error',
      'named design tokens + decision-log/DL-*.md covering every token',
      'node gates/run.mjs <dir> with no fail',
      'measured number, not adjective; a claim of improvement ships its metric and its threat to validity',
    ],
    how_to_check: 'call pd_run_gates with the artifact files; exit 0 and status pass (or an explicitly human-approved incomplete) is the only ready state',
    human_gate: 'the human approves or rejects; the agent never self-approves',
  };
}

// O veredito bruto nao basta para um modelo que nao ve o repo: diz o que falta mandar na mesma chamada.
const RULE_HINTS = {
  'tokens-missing-or-invalid': 'send design/tokens.json in the same call (named tokens, e.g. {"color":{"bg":"#..","ink":"#..","accent":"#.."}})',
  'strategy-missing': 'send strategy.md in the same call: problem, audience, positioning, the anchors your decisions point at',
  'no-decisions': 'record the choices first with pd_record_decision (strategy_ref + non-empty evidence), then send decision-log/*.md too',
  'artifact-missing': 'send the artifact HTML file(s) in the same call; r1 cannot judge what it cannot read',
  'token-uncovered': 'every token needs an active decision covering it: use pd_coverage_gaps then pd_record_decision',
  'strategy-ref-dead': 'strategy_ref must be an anchor that exists in the strategy.md you send (#p1-problema, #p2-publico, ...)',
  'low-contrast-pair': 'raise the contrast of the flagged pair to at least 4.5:1 (body text) or 3:1 (large text and non-text UI)',
  'cap-missing': 'send the caps file the workspace uses; R3 cannot count without the ceiling',
  'cover-without-token': 'a decision claims to cover a token that does not exist in design/tokens.json: fix covers[] or add the token',
  'decision-no-evidence': 'a decision in the log has an empty evidence list: rewrite it with the source it came from',
  'decision-no-strategy-ref': 'a decision in the log has no strategy_ref: point it at the strategy.md anchor that justifies it',
  'decision-affects-missing': 'a decision points at a file that does not exist: fix affects[] to paths you actually send',
};

function hintFor(report) {
  if (!report) return 'gates did not return JSON: the artifact folder could not be read';
  const rules = new Set();
  for (const g of report.gates) for (const v of g.violations) rules.add(v.rule);
  const hints = [...rules].map((r) => RULE_HINTS[r]).filter(Boolean);
  if (hints.length === 0) return undefined;
  return [...new Set(hints)];
}

function callTool(name, args = {}) {
  switch (name) {
    case 'pd_kernel_rules':
      return kernelRules();
    case 'pd_read_caps':
      return readCaps();
    case 'pd_run_gates': {
      const dir = materializeFiles(args.files);
      const out = runGates(dir, { strict: Boolean(args.strict) });
      const r = out.report;
      return {
        exit_code: out.exitCode,
        status: r ? r.status : 'error',
        counts: r ? r.counts : null,
        gates: r
          ? r.gates.map((g) => ({
              gate: g.gate,
              status: g.status,
              violations: g.violations,
              incomplete: g.incomplete,
            }))
          : null,
        verdict:
          out.exitCode === 0
            ? r && r.status === 'pass'
              ? 'pass: nothing found; ready for the human'
              : 'incomplete: allowed only with the uncertainty declared to the human'
            : 'refused: at least one rule failed; fix the cause in the files, never the report',
        hint: hintFor(r),
        stderr: out.stderr || undefined,
      };
    }
    case 'pd_record_decision': {
      const rec = appendDecision(args);
      const gaps = coverageGaps();
      return {
        recorded: rec,
        total: readDecisions().length,
        uncovered: gaps.uncovered || [],
        note: 'call pd_run_gates on the artifact to get the three gates verdict',
      };
    }
    case 'pd_list_decisions': {
      const all = readDecisions();
      const status = args.status ? String(args.status) : 'active';
      return { status, decisions: all.filter((d) => (d.status || 'active') === status), total: all.length };
    }
    case 'pd_coverage_gaps':
      return coverageGaps();
    default:
      throw new Error(`ferramenta desconhecida: ${name}`);
  }
}

function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    const asked = params && params.protocolVersion;
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: typeof asked === 'string' && asked.trim() !== '' ? asked : DEFAULT_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
      },
    };
  }
  if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  if (method === 'tools/call') {
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    try {
      const out = callTool(name, args);
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: false } };
    } catch (e) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `recusado: ${e.message}` }], isError: true } };
    }
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (method === 'notifications/initialized' || id === undefined) return null;
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `metodo nao suportado: ${method}` } };
}

function authorized(req, url) {
  if (!TOKEN) return true;
  const h = String(req.headers.authorization || '');
  if (h === `Bearer ${TOKEN}`) return true;
  return url.searchParams.get('token') === TOKEN;
}

function send(res, code, body, extra = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload), ...extra });
  res.end(payload);
}

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, server: SERVER.name, workspace: workspace(), memory: memoryFile(), auth: TOKEN ? 'bearer' : 'none', tools: TOOLS.length });
    }
    if (url.pathname !== '/mcp') return send(res, 404, { error: 'not found', hint: 'use POST /mcp' });
    if (!authorized(req, url)) return send(res, 401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer' });
    if (req.method === 'DELETE') return send(res, 204, '');
    if (req.method === 'GET') {
      // Sem SSE: o modo stateless responde tudo no POST. Declarado em vez de meia-boca.
      return send(res, 405, { error: 'method not allowed', allowed: ['POST', 'DELETE'] }, { allow: 'POST, DELETE' });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' }, { allow: 'POST, DELETE' });

    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 4_000_000) req.destroy();
    });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(raw === '' ? 'null' : raw);
      } catch {
        return send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalido' } });
      }
      const out = [];
      for (const msg of Array.isArray(parsed) ? parsed : [parsed]) {
        if (!msg || typeof msg !== 'object') continue;
        try {
          const r = handle(msg);
          if (r) out.push(r);
        } catch (e) {
          out.push({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32603, message: e.message } });
        }
      }
      if (out.length === 0) return send(res, 202, '');
      return send(res, 200, Array.isArray(parsed) ? out : out[0]);
    });
  });
}

if (process.argv.includes('--selftest')) {
  const srv = createServer();
  srv.listen(0, '127.0.0.1', async () => {
    const port = srv.address().port;
    const url = `http://127.0.0.1:${port}/mcp`;
    const post = async (body) => {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, json: text === '' ? null : JSON.parse(text) };
    };
    try {
      const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: DEFAULT_PROTOCOL, capabilities: {}, clientInfo: { name: 'selftest', version: '0' } } });
      const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
      const caps = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'pd_read_caps', arguments: {} } });
      const bad = await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'pd_record_decision', arguments: { id: 'x', decision: 'sem fonte' } } });
      const gates = await post({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'pd_run_gates', arguments: { files: [{ path: 'index.html', content: '<!doctype html><html><body><h1>ok</h1></body></html>' }] } },
      });
      const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
      console.log(
        JSON.stringify(
          {
            initialize: init.json?.result?.serverInfo?.name,
            instructions_chars: init.json?.result?.instructions?.length,
            tools: (list.json?.result?.tools || []).map((t) => t.name),
            caps: Object.keys(caps.json?.result ? JSON.parse(caps.json.result.content[0].text).flat : {}).length,
            refusal_isError: bad.json?.result?.isError === true,
            gates_exit: gates.json?.result ? JSON.parse(gates.json.result.content[0].text).exit_code : null,
            health_ok: health.ok === true,
            plugin_root: path.basename(PLUGIN_ROOT),
            caps_file_exists: fs.existsSync(path.join(PLUGIN_ROOT, 'budgets', 'caps.yaml')),
          },
          null,
          2,
        ),
      );
      srv.close(() => process.exit(0));
    } catch (e) {
      console.error(`selftest falhou: ${e.message}`);
      srv.close(() => process.exit(1));
    }
  });
} else {
  const srv = createServer();
  srv.listen(PORT, HOST, () => {
    const actual = srv.address().port;
    const shown = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
    console.log(`pd-remote ouvindo em http://${shown}:${actual}/mcp`);
    console.log(`  workspace: ${workspace()}`);
    console.log(`  memoria:   ${memoryFile()}`);
    console.log(`  auth:      ${TOKEN ? 'Authorization: Bearer <PD_HTTP_TOKEN>' : 'nenhuma (nao exponha publico sem PD_HTTP_TOKEN)'}`);
    console.log(`  ferramentas: ${TOOLS.map((t) => t.name).join(', ')}`);
  });
}
