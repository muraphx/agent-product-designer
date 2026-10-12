#!/usr/bin/env node
// install.mjs — instalador de uma linha, um client por vez.
//
//   node install.mjs --client claude     modo plugin (marketplace local)
//   node install.mjs --client hermes     copia skills para o diretorio de skills do Hermes
//   node install.mjs --client agents     diretorio portatil ~/.agents (qualquer client que leia AGENTS.md)
//   node install.mjs --client codex      bloco de inclusao no ~/.codex/AGENTS.md
//   node install.mjs --validate          valida o empacotamento
//
// Contrato: toda acao imprime o caminho/comando exato e RE-LE o resultado para confirmar.
// Nunca sobrescreve arquivo existente sem --force.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};
const DRY = has('--dry-run');
const FORCE = has('--force');

let ok = 0;
const problems = [];

function report(label, detail) {
  ok++;
  console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
}
function warn(label, detail) {
  console.log(`  warn ${label}${detail ? ` — ${detail}` : ''}`);
}
function fail(label, detail) {
  problems.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const MARK_START = '<!-- agent-product-designer:start -->';
const MARK_END = '<!-- agent-product-designer:end -->';

const INCLUDE = `${MARK_START}
## Agente Product Designer

Este workspace opera com o agente product designer. Regras ativas: leia \`AGENTS.md\` do plugin
(kernel dos tres portoes) e rode os portoes antes de entregar qualquer artefato:

\`\`\`
node <plugin>/gates/run.mjs <alvo>
\`\`\`

Entrega so passa com status \`pass\` (ou \`incomplete\` explicitamente aprovado por humano).
${MARK_END}
`;

function skillsOf() {
  return fs
    .readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function copySkills(targetDir, label) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const name of skillsOf()) {
    const from = path.join(ROOT, 'skills', name);
    const to = path.join(targetDir, name);
    if (fs.existsSync(to) && !FORCE) {
      // Idempotente: so considera ok se o SKILL.md de destino existir (re-install de versao igual).
      if (fs.existsSync(path.join(to, 'SKILL.md'))) {
        report(`${label}/${name}`, 'ja instalado (use --force para regravar)');
        continue;
      }
      fail(`${label}/${name}`, 'diretorio de destino existe sem SKILL.md');
      continue;
    }
    if (DRY) {
      report(`${label}/${name}`, `seria copiado de ${from}`);
      continue;
    }
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true });
    const back = fs.existsSync(path.join(to, 'SKILL.md'));
    if (back) report(`${label}/${name}`, `verificado: ${path.join(to, 'SKILL.md')}`);
    else fail(`${label}/${name}`, 'copiou mas SKILL.md nao aparece no destino');
  }
}

function appendBlock(file, label) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (existing.includes(MARK_START) && !FORCE) {
    report(label, `bloco ja presente em ${file}`);
    return;
  }
  const next = existing.includes(MARK_START)
    ? existing.replace(new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`), INCLUDE.trim())
    : `${existing.trimEnd()}${existing.trim() ? '\n\n' : ''}${INCLUDE}`;
  if (DRY) {
    report(label, `seria escrito em ${file}`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next, 'utf8');
  if (fs.readFileSync(file, 'utf8').includes('agent-product-designer')) report(label, `verificado: ${file}`);
  else fail(label, `escrita nao confirmada em ${file}`);
}

const which = (cmd) => {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout.split(/\r?\n/)[0] || '').trim() : null;
};

function installClaude() {
  const cli = which('claude');
  const cmd = `claude plugin marketplace add "${ROOT}" && claude plugin install agent-product-designer@agent-product-designer`;
  if (!cli) {
    warn('claude: CLI nao encontrada', `rode manualmente: ${cmd}`);
    return;
  }
  if (DRY) {
    report('claude', `seria executado: ${cmd}`);
    return;
  }
  const add = spawnSync('claude', ['plugin', 'marketplace', 'add', ROOT], { encoding: 'utf8' });
  if (add.status !== 0) {
    fail('claude: marketplace add', (add.stderr || add.stdout || '').trim().slice(0, 300) || cmd);
    return;
  }
  const inst = spawnSync('claude', ['plugin', 'install', 'agent-product-designer@agent-product-designer'], { encoding: 'utf8' });
  if (inst.status !== 0) {
    fail('claude: plugin install', (inst.stderr || inst.stdout || '').trim().slice(0, 300) || cmd);
    return;
  }
  const list = spawnSync('claude', ['plugin', 'list'], { encoding: 'utf8' });
  const seen = (list.stdout || '').includes('agent-product-designer');
  if (seen) report('claude: plugin instalado', 'verificado em `claude plugin list`');
  else fail('claude: plugin install', 'install retornou 0 mas nao aparece em `claude plugin list`');
}

function validate() {
  const cli = which('claude');
  if (cli) {
    const r = spawnSync('claude', ['plugin', 'validate', ROOT], { encoding: 'utf8' });
    const out = (r.stdout || r.stderr || '').trim();
    if (r.status === 0) report('claude plugin validate', out.split(/\r?\n/).slice(-1)[0] || 'ok');
    else warn('claude plugin validate', out.slice(0, 400));
  } else {
    warn('claude plugin validate', 'CLI ausente: validacao oficial pulada');
  }
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests', 'all.mjs')], { encoding: 'utf8' });
  const tail = (r.stdout || '').trim().split(/\r?\n/).slice(-1)[0];
  if (r.status === 0) report('testes de empacotamento', tail);
  else fail('testes de empacotamento', tail);
}

const client = argOf('--client') || (has('--validate') ? null : 'all');

console.log(`instalando a partir de ${ROOT}${DRY ? ' (dry-run)' : ''}`);
if (client === 'all' || client === 'claude') installClaude();
if (client === 'all' || client === 'hermes') copySkills(path.join(LOCALAPPDATA, 'hermes', 'skills'), 'hermes');
if (client === 'all' || client === 'agents') {
  copySkills(path.join(HOME, '.agents', 'skills'), 'agents');
  appendBlock(path.join(HOME, '.agents', 'AGENTS.md'), 'agents: AGENTS.md');
}
if (client === 'all' || client === 'codex') appendBlock(path.join(HOME, '.codex', 'AGENTS.md'), 'codex: AGENTS.md');
if (has('--validate') || client === 'all') validate();

console.log(`\n${ok} acoes confirmadas, ${problems.length} problemas`);
if (problems.length) {
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
