// bin/pd-core.mjs — logica compartilhada dos servidores MCP do agente.
//
// Existe para que o servidor stdio (bin/memory-server.mjs, usado por Codex/Claude) e o servidor
// HTTP (bin/remote-server.mjs, usado como plugin/conector do ChatGPT web) nao divirjam: memoria,
// cobertura de tokens, teto e veredito dos portoes saem daqui, de um lugar so.
// Dependencia externa: nenhuma.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCaps, flatCaps } from '../gates/lib/caps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = path.resolve(HERE, '..');

function envPath(key, fallback) {
  const v = process.env[key];
  const chosen = v && v.trim() !== '' && !v.includes('${') ? v : fallback;
  return path.resolve(chosen);
}

// Sem workspace explicito o host GUI resolve o cwd errado e a memoria cai em qualquer lugar.
export function workspace() {
  return envPath('PD_WORKSPACE', process.cwd());
}

export function memoryFile() {
  return envPath('PD_MEMORY_FILE', path.join(workspace(), 'decision-log', 'decisions.jsonl'));
}

export function capsFile() {
  const wsCaps = path.join(workspace(), 'budgets', 'caps.yaml');
  return envPath('PD_CAPS_FILE', fs.existsSync(wsCaps) ? wsCaps : path.join(PLUGIN_ROOT, 'budgets', 'caps.yaml'));
}

export const REQUIRED = ['id', 'decision', 'strategy_ref'];

export function readDecisions() {
  const file = memoryFile();
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch {
        throw new Error(`linha ${i + 1} de ${file} nao e JSON valido`);
      }
    });
}

// Recusa e comportamento correto: decisao sem fonte nao entra na memoria (o portao R2 depende dela).
export function appendDecision(entry) {
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
  const file = memoryFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

export function coverageGaps() {
  const file = path.join(workspace(), 'design', 'tokens.json');
  if (!fs.existsSync(file)) return { error: 'design/tokens.json ausente' };
  const tokens = JSON.parse(fs.readFileSync(file, 'utf8'));
  const paths = Object.entries(tokens).flatMap(([g, v]) => Object.keys(v).map((k) => `${g}.${k}`));
  const covered = new Set();
  for (const d of readDecisions()) {
    if ((d.status || 'active') !== 'active') continue;
    for (const c of d.covers || []) covered.add(String(c).trim());
  }
  const uncovered = paths.filter((p) => !covered.has(p));
  return { tokens: paths.length, covered: paths.length - uncovered.length, uncovered };
}

export function readCaps() {
  const file = capsFile();
  if (!fs.existsSync(file)) throw new Error(`teto ausente: ${file}`);
  const caps = loadCaps(file);
  return { file, caps, flat: flatCaps(caps) };
}

// Caminho de arquivo vindo de fora (modelo/LLM) nunca pode escapar do diretorio temporario:
// sem isso um `../../` escreveria em qualquer lugar do disco do usuario.
export function safeRelPath(p) {
  const s = String(p || '').replace(/\\/g, '/');
  if (s === '' || s.startsWith('/') || /^[A-Za-z]:/.test(s)) throw new Error(`caminho invalido: ${p}`);
  const parts = s.split('/').filter((x) => x !== '' && x !== '.');
  if (parts.some((x) => x === '..')) throw new Error(`caminho com '..': ${p}`);
  return parts.join('/');
}

export function materializeFiles(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('files precisa ser uma lista nao vazia de {path, content}');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-remote-'));
  for (const f of files) {
    const rel = safeRelPath(f && f.path);
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, String(f.content ?? ''), 'utf8');
  }
  return dir;
}

// Roda os tres portoes sobre um diretorio e devolve o veredito MAQUINA (JSON), nao a prosa.
export function runGates(dir, { strict = false } = {}) {
  const args = [path.join(PLUGIN_ROOT, 'gates', 'run.mjs'), dir, '--json'];
  if (strict) args.push('--strict');
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: PLUGIN_ROOT, timeout: 120000 });
  let report = null;
  try {
    report = JSON.parse(r.stdout);
  } catch {
    report = null;
  }
  return { exitCode: r.status, report, stderr: (r.stderr || '').trim().slice(0, 500) };
}
