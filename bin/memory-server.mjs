#!/usr/bin/env node
// bin/memory-server.mjs — servidor MCP (stdio) de memoria do agente.
//
// Por que existe: memoria em memoria-de-arquivo solta (SOUL.md/MEMORY.md) nao e lida
// por nenhum client e nao e empacotavel. Entrada MCP, ao contrario, e normatizada pela
// Agent Plugins Spec 1.0.0 — funciona igual em Claude, Codex, Cursor e Hermes.
//
// Sem dependencia externa. JSON-RPC 2.0 delimitado por linha, como manda o transporte
// stdio do MCP.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { loadCaps, flatCaps } from '../gates/lib/caps.mjs';

const PROTOCOL = '2024-11-05';
const SERVER = { name: 'pd-memory', version: '0.1.0' };
const HERE = path.dirname(fileURLToPath(import.meta.url));

function envPath(key, fallback) {
  const v = process.env[key];
  const chosen = v && v.trim() !== '' && !v.includes('${') ? v : fallback;
  return path.resolve(chosen);
}

// Sem PD_WORKSPACE o host GUI (ChatGPT desktop) resolve o cwd errado: a memoria cairia em
// qualquer lugar. Aqui o cwd e so o ultimo recurso, e memoria/teto derivam do workspace.
const WORKSPACE = envPath('PD_WORKSPACE', process.cwd());
const MEMORY_FILE = envPath('PD_MEMORY_FILE', path.join(WORKSPACE, 'decision-log', 'decisions.jsonl'));
const WORKSPACE_CAPS = path.join(WORKSPACE, 'budgets', 'caps.yaml');
// Workspace de cliente nao traz o teto do pacote: cai para o que veio junto do servidor.
const CAPS_FILE = envPath('PD_CAPS_FILE', fs.existsSync(WORKSPACE_CAPS) ? WORKSPACE_CAPS : path.join(HERE, '..', 'budgets', 'caps.yaml'));

const REQUIRED = ['id', 'decision', 'strategy_ref'];

function readDecisions() {
  if (!fs.existsSync(MEMORY_FILE)) return [];
  return fs
    .readFileSync(MEMORY_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch {
        throw new Error(`linha ${i + 1} de ${MEMORY_FILE} nao e JSON valido`);
      }
    });
}

function appendDecision(entry) {
  const missing = REQUIRED.filter((k) => !entry[k] || String(entry[k]).trim() === '');
  if (missing.length) throw new Error(`decisao incompleta: falta ${missing.join(', ')}`);
  if (!Array.isArray(entry.evidence) || entry.evidence.filter((e) => String(e).trim() !== '').length === 0) {
    throw new Error('decisao sem evidencia: campo evidence (lista, nao vazia) e obrigatorio');
  }
  const record = {
    id: String(entry.id),
    decision: String(entry.decision),
    strategy_ref: String(entry.strategy_ref),
    evidence: entry.evidence.map(String),
    covers: (entry.covers || []).map(String),
    affects: (entry.affects || []).map(String),
    status: String(entry.status || 'active'),
    recorded_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
  fs.appendFileSync(MEMORY_FILE, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

function tokenPaths() {
  const file = path.join(WORKSPACE, 'design', 'tokens.json');
  if (!fs.existsSync(file)) return null;
  const tokens = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.entries(tokens).flatMap(([g, v]) => Object.keys(v).map((k) => `${g}.${k}`));
}

function coverageGaps() {
  const paths = tokenPaths();
  if (paths === null) return { error: 'design/tokens.json ausente' };
  const covered = new Set();
  for (const d of readDecisions()) {
    if ((d.status || 'active') !== 'active') continue;
    for (const c of d.covers || []) covered.add(String(c).trim());
  }
  const uncovered = paths.filter((p) => !covered.has(p));
  return { tokens: paths.length, covered: paths.length - uncovered.length, uncovered };
}

const TOOLS = [
  {
    name: 'record_decision',
    description: 'Registra uma decisao de design com fonte. Recusa decisao sem evidencia, sem id ou sem estrategia — o portao R2 depende deste registro.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ex.: DL-0007-paleta' },
        decision: { type: 'string' },
        strategy_ref: { type: 'string', description: 'ancora em strategy.md, ex.: #p1-problema' },
        evidence: { type: 'array', items: { type: 'string' }, description: 'fontes: arquivo + achado' },
        covers: { type: 'array', items: { type: 'string' }, description: 'tokens justificados, ex.: color.accent' },
        affects: { type: 'array', items: { type: 'string' }, description: 'caminhos afetados; precisam existir' },
        status: { type: 'string', enum: ['active', 'superseded'], default: 'active' },
      },
      required: ['id', 'decision', 'strategy_ref', 'evidence'],
    },
  },
  {
    name: 'list_decisions',
    description: 'Lista as decisoes registradas (por padrao apenas ativas).',
    inputSchema: { type: 'object', properties: { status: { type: 'string' } } },
  },
  {
    name: 'coverage_gaps',
    description: 'Lista tokens de design/tokens.json que nenhuma decisao ativa justifica. Lista vazia = rastro completo.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'read_caps',
    description: 'Le o teto numerico (budgets/caps.yaml) e devolve o mapa achatado usado pelo portao R3.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function callTool(name, args = {}) {
  switch (name) {
    case 'record_decision': {
      const rec = appendDecision(args);
      const gaps = coverageGaps();
      return {
        recorded: rec,
        total: readDecisions().length,
        uncovered: gaps.uncovered || [],
        note: 'rode `node gates/run.mjs <alvo>` para o veredito dos tres portoes',
      };
    }
    case 'list_decisions': {
      const all = readDecisions();
      const status = args.status ? String(args.status) : 'active';
      return { status, decisions: all.filter((d) => (d.status || 'active') === status), total: all.length };
    }
    case 'coverage_gaps':
      return coverageGaps();
    case 'read_caps': {
      if (!fs.existsSync(CAPS_FILE)) throw new Error(`teto ausente: ${CAPS_FILE}`);
      const caps = loadCaps(CAPS_FILE);
      return { file: CAPS_FILE, caps, flat: flatCaps(caps) };
    }
    default:
      throw new Error(`ferramenta desconhecida: ${name}`);
  }
}

function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER,
        instructions: `Memoria de decisoes do agente product designer. Arquivo: ${MEMORY_FILE}. Workspace: ${WORKSPACE}.`,
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
  if (id === undefined) return null; // notificacao
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `metodo nao suportado: ${method}` } };
}

if (process.argv.includes('--selftest')) {
  const rec = appendDecision({
    id: 'DL-selftest',
    decision: 'teste do servidor de memoria',
    strategy_ref: '#p1-problema',
    evidence: ['selftest'],
    covers: [],
  });
  let refused = false;
  try {
    appendDecision({ id: 'x', decision: 'sem evidencia', strategy_ref: '#p1' });
  } catch {
    refused = true;
  }
  console.log(JSON.stringify({ recorded: rec.id, refusedWithoutEvidence: refused, gaps: coverageGaps().uncovered?.length ?? null }, null, 2));
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed === '') return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalido' } }) + '\n');
    return;
  }
  const res = handle(msg);
  if (res) process.stdout.write(JSON.stringify(res) + '\n');
});
