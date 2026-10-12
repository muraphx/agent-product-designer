#!/usr/bin/env node
// install.mjs — instalador de uma linha, um client por vez.
//
//   node install.mjs --client claude     modo plugin (marketplace local)
//   node install.mjs --client hermes     copia skills para o diretorio de skills do Hermes
//   node install.mjs --client agents     diretorio portatil ~/.agents (qualquer client que leia AGENTS.md)
//   node install.mjs --client codex      bloco de inclusao no ~/.codex/AGENTS.md
//   node install.mjs --client chatgpt    ChatGPT desktop: MCP + skills + AGENTS.md (mesmo host do Codex)
//   node install.mjs --client chatgpt-web ChatGPT web: prova o servidor MCP remoto e imprime os enderecos
//   node install.mjs --validate          valida o empacotamento
//
// Opcoes: --workspace <dir> (workspace do MCP de memoria), --dry-run, --force.
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
Memoria de decisoes via MCP \`pd-memory\` (\`record_decision\`, \`list_decisions\`, \`coverage_gaps\`,
\`read_caps\`): decisao sem \`strategy_ref\` ou sem \`evidence\` e recusada pela ferramenta.
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

// TOML: o host do ChatGPT desktop e o do Codex compartilham ~/.codex/config.toml, entao o bloco
// precisa conviver com o que ja esta la (nao reescrevemos o arquivo inteiro).
const TOML_START = '# agent-product-designer:start';
const TOML_END = '# agent-product-designer:end';

function upsertTomlBlock(file, label, block) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const already = existing.includes(TOML_START);
  if (already && !FORCE) {
    report(label, `bloco ja presente em ${file} (use --force para regravar)`);
    return;
  }
  const next = already
    ? existing.replace(new RegExp(`${TOML_START}[\\s\\S]*?${TOML_END}`), block.trim())
    : `${existing.trimEnd()}${existing.trim() ? '\n\n' : ''}${block.trim()}\n`;
  if (DRY) {
    report(label, `seria escrito em ${file}`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (existing && !already && !fs.existsSync(`${file}.pd-bak`)) fs.copyFileSync(file, `${file}.pd-bak`);
  fs.writeFileSync(file, next, 'utf8');
  const back = fs.readFileSync(file, 'utf8');
  if (back.includes(TOML_START) && back.includes('[mcp_servers.pd-memory]')) report(label, `verificado: ${file}`);
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

// ChatGPT desktop e Codex CLI compartilham o host: config.toml, skills/ e AGENTS.md em ~/.codex.
// O app nao le Agent Skills de pasta arbitraria nem tem sistema de plugin proprio — o que ele
// consome e (1) MCP servers do config, (2) skills de ~/.codex/skills, (3) AGENTS.md global.
function installChatgpt() {
  const ws = path.resolve(argOf('--workspace') || ROOT);
  const entry = path.join(ROOT, 'bin', 'memory-server.mjs');
  const caps = path.join(ROOT, 'budgets', 'caps.yaml');
  if (!fs.existsSync(entry)) {
    fail('chatgpt: memory-server', `ausente: ${entry}`);
    return;
  }
  if (DRY) {
    report('chatgpt', `seria registrado ${entry} com workspace ${ws}`);
    copySkills(path.join(HOME, '.codex', 'skills'), 'chatgpt');
    appendBlock(path.join(HOME, '.codex', 'AGENTS.md'), 'chatgpt: AGENTS.md');
    upsertTomlBlock(path.join(HOME, '.codex', 'config.toml'), 'chatgpt: MCP pd-memory', '');
    return;
  }
  // cargoes o servidor em ~/.codex/config.toml; a leitura de volta prova que o TOML ficou valido.
  const block = `${TOML_START}
[mcp_servers.pd-memory]
command = '${process.execPath}'
args = ['${entry}']
startup_timeout_sec = 30

[mcp_servers.pd-memory.env]
PD_WORKSPACE = '${ws}'
PD_CAPS_FILE = '${caps}'
${TOML_END}`;
  upsertTomlBlock(path.join(HOME, '.codex', 'config.toml'), 'chatgpt: MCP pd-memory', block);
  copySkills(path.join(HOME, '.codex', 'skills'), 'chatgpt');
  appendBlock(path.join(HOME, '.codex', 'AGENTS.md'), 'chatgpt: AGENTS.md');

  const cli = which('codex');
  if (cli) {
    const r = spawnSync('codex', ['mcp', 'list'], { encoding: 'utf8', timeout: 90000 });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    if (out.includes('pd-memory')) report('chatgpt: servidor visivel', 'verificado em `codex mcp list`');
    else fail('chatgpt: servidor visivel', 'nao aparece em `codex mcp list`');
  } else {
    warn('chatgpt: CLI codex ausente', 'confirme em Settings → MCP servers dentro do app');
  }
  console.log(`  nota ChatGPT desktop: reinicie o app; o workspace do MCP e ${ws}`);
}

// ChatGPT web (chatgpt.com): nao existe "instalar plugin" por linha de comando — o connector e
// adicionado na interface. O que o instalador pode fazer e (1) provar que o servidor remoto sobe,
// (2) dizer o endereco exato a colar e (3) apontar o tunel. Nada aqui escreve no host.
function installChatgptWeb() {
  const port = argOf('--port') || process.env.PD_HTTP_PORT || '8787';
  const entry = path.join(ROOT, 'bin', 'remote-server.mjs');
  if (!fs.existsSync(entry)) {
    fail('chatgpt-web: servidor', `ausente: ${entry}`);
    return;
  }
  const r = spawnSync(process.execPath, [entry, '--selftest'], { encoding: 'utf8', cwd: ROOT, timeout: 120000 });
  const out = (r.stdout || '').trim();
  let tools = null;
  try {
    tools = JSON.parse(out).tools;
  } catch {
    tools = null;
  }
  if (r.status === 0 && Array.isArray(tools)) report('chatgpt-web: servidor responde JSON-RPC', `${tools.length} ferramentas: ${tools.join(', ')}`);
  else fail('chatgpt-web: servidor responde JSON-RPC', (out || r.stderr || `exit ${r.status}`).slice(0, 300));

  const tunnel = which('cloudflared');
  if (tunnel) report('chatgpt-web: tunel disponivel', tunnel);
  else warn('chatgpt-web: tunel', 'cloudflared ausente: instale ou use o Secure MCP Tunnel da OpenAI');

  console.log(`
  ChatGPT web (chatgpt.com/plugins) — o endpoint precisa ser HTTPS publico:
    1. terminal 1:  node bin/remote-server.mjs
    2. terminal 2:  cloudflared tunnel --url http://127.0.0.1:${port}
    3. copie a URL https://...trycloudflare.com e use https://.../mcp
    4. em chatgpt.com/plugins → + → Add custom MCP server → cole a URL → Create as a plugin
       autenticacao na interface: OAuth ou nenhuma. Header Bearer (PD_HTTP_TOKEN) vale para
       curl/Codex; para a web com auth de verdade use OAuth ou o Secure MCP Tunnel.
  Guia completo: docs/chatgpt-web-plugin.md`);
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
  // A suite depende de tests/fixtures/, que e gitignored e nasce de build-fixtures.mjs.
  // Sem construir antes, todo alvo de fixture nao existe e os portoes sairam com exit 2 —
  // foi assim que a validacao falhou num clone limpo do GitHub.
  const suites = [
    ['tests/build-fixtures.mjs', 'fixtures de teste'],
    ['tests/all.mjs', 'testes de empacotamento'],
    ['tests/swap.mjs', 'testes de troca de disciplina'],
    ['tests/mcp-smoke.mjs', 'testes do MCP (stdio)'],
    ['tests/remote-smoke.mjs', 'testes do MCP remoto (ChatGPT web)'],
  ];
  for (const [file, label] of suites) {
    const r = spawnSync(process.execPath, [path.join(ROOT, ...file.split('/'))], { encoding: 'utf8', cwd: ROOT });
    const out = (r.stdout || r.stderr || '').trim().split(/\r?\n/).filter(Boolean);
    const tail = out.slice(-1)[0];
    if (r.status === 0) report(label, tail || 'ok');
    else fail(label, tail || `exit ${r.status}`);
  }
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
if (client === 'chatgpt') installChatgpt();
if (client === 'all' || client === 'chatgpt-web') installChatgptWeb();
if (has('--validate') || client === 'all') validate();

console.log(`\n${ok} acoes confirmadas, ${problems.length} problemas`);
if (problems.length) {
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
