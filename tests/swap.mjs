#!/usr/bin/env node
// tests/swap.mjs — prova que o kernel e agnostico de disciplina.
//
// O kernel e gates/**. O pacote de disciplina e skills/ + budgets/caps.yaml (dado do pacote,
// nao codigo do kernel). Este teste copia o repo para um temp, troca o pacote por um de outra
// area e exige que os tres portoes continuem funcionando:
//   1. teto apertado no pacote -> examples/landing REPROVA em r3
//   2. teto original do pacote + skills estrangeiras -> examples/landing PASSA
//   3. o kernel nao cita disciplina nenhuma por nome (nem o alvo de referencia)
//
//   node tests/swap.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// Disciplina estrangeira: nada a ver com design de produto. Se os portoes dependessem do
// pacote de design, este diretorio substituido derrubaria a entrega.
const FOREIGN = 'marine-ecology';

// Teto de R3 apertado de proposito. `copy.words_max` foi escolhido porque:
// (a) e contagem inteira, sem delimitacao ambigua (sections dependem de HTML bem formado);
// (b) examples/landing tem 240 palavras medidas (gates r3 metrics), entao 60 morde de verdade;
// (c) o exemplo respeita o teto real (1200), ou seja o pacote original nao acusa nada aqui.
const TIGHT_KEY = 'words_max';
const TIGHT_VALUE = 60;

// O que nunca vai para a copia: historico, dependencias, fixtures geradas, medicao e esqueleto morto.
const SKIP = ['.git', 'node_modules', 'tests/fixtures', 'bench/results', 'legacy'];

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

const relTo = (base, file) => path.relative(base, file).split(path.sep).join('/');
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function mjsIn(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.mjs')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function runGate(cwd, target, args = []) {
  const r = spawnSync(process.execPath, [path.join(cwd, 'gates', 'run.mjs'), target, ...args], {
    cwd,
    encoding: 'utf8',
  });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    json = null;
  }
  return { code: r.status, json, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const gateOf = (report, id) => (report && report.gates ? report.gates.find((g) => g.gate === id) : null);
const rules = (g) => (g && g.violations ? g.violations.map((v) => v.rule) : []);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-swap-'));
const copy = path.join(tmp, 'repo');
const example = path.join(copy, 'examples', 'landing');
const capsFile = path.join(copy, 'budgets', 'caps.yaml');

try {
  console.log('\n# 1. copia do repo em temp, com o que nao e kernel fora');
  {
    fs.cpSync(ROOT, copy, {
      recursive: true,
      filter: (src) => {
        const rel = relTo(ROOT, src);
        if (rel === '') return true;
        return !SKIP.some((s) => rel === s || rel.startsWith(`${s}/`));
      },
    });
    check('copia: diretorio temp criado', fs.existsSync(copy), copy);
    check('copia: kernel vem junto (gates/run.mjs)', fs.existsSync(path.join(copy, 'gates', 'run.mjs')));
    const skipped = SKIP.filter((s) => fs.existsSync(path.join(copy, s)));
    check('copia: .git/node_modules/fixtures/bench/legacy ficaram fora', skipped.length === 0, skipped.join(','));
    check('copia: alvo de referencia vem junto', fs.existsSync(path.join(example, 'design', 'index.html')));
    check('copia: teto identico ao do repo', sha256(capsFile) === sha256(path.join(ROOT, 'budgets', 'caps.yaml')));
  }

  console.log('\n# 2. pacote de disciplina trocado por um de outra area');
  {
    const originalSkillNames = fs.readdirSync(path.join(copy, 'skills')).sort();
    fs.rmSync(path.join(copy, 'skills'), { recursive: true, force: true });
    const skillDir = path.join(copy, 'skills', FOREIGN);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        `name: ${FOREIGN}`,
        'description: Use when classifying benthic substrate samples, estimating coral cover from quadrat photographs, or reconciling transect counts with the species register. Reads the survey protocol, refuses a count without a sampling unit, and reports coverage gaps instead of interpolating missing stations. Not for writing the survey protocol itself.',
        '---',
        '',
        `# ${FOREIGN} — registro de campo`,
        '',
        'Um SKILL.md valido basta: o kernel nao le skill, so o pacote que a embala.',
        '',
      ].join('\n'),
    );

    const skillText = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    const name = (skillText.match(/^name:\s*(.+)$/m) || [])[1];
    const desc = (skillText.match(/^description:\s*(.+)$/m) || [])[1] || '';
    check('pacote: skills/ antigas removidas', originalSkillNames.length > 0 && !fs.existsSync(path.join(copy, 'skills', 'impeccable')), originalSkillNames.join(','));
    check('pacote: uma skill estrangeira no lugar', fs.existsSync(path.join(skillDir, 'SKILL.md')) && fs.readdirSync(path.join(copy, 'skills')).length === 1);
    check('pacote: frontmatter com name == diretorio', name === FOREIGN, String(name));
    check(`pacote: description valida (${desc.length} <= 1024)`, desc.length > 0 && desc.length <= 1024);
    check('pacote: name em minusculas-com-hifen', /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(name)), String(name));
  }

  console.log('\n# 3. teto apertado no pacote reprova o exemplo (r3 morde)');
  {
    const originalCaps = fs.readFileSync(capsFile, 'utf8');
    const tight = originalCaps.replace(new RegExp(`^(\\s*${TIGHT_KEY}:\\s*).*$`, 'm'), `$1${TIGHT_VALUE}`);
    check('teto: chave encontrada e reescrita', tight !== originalCaps && tight.includes(`${TIGHT_KEY}: ${TIGHT_VALUE}`));
    fs.writeFileSync(capsFile, tight);

    const r = runGate(copy, example, ['--json']);
    check('teto apertado: relatorio parseavel', !!r.json, r.stderr.slice(0, 200));
    check('teto apertado: exit 1', r.code === 1, `exit ${r.code}`);
    check('teto apertado: status fail', r.json && r.json.status === 'fail', r.json && r.json.status);
    const r3 = gateOf(r.json, 'r3');
    check('teto apertado: r3 acusa', r3 && r3.status === 'fail', r3 && r3.status);
    check(`teto apertado: regra over-cap-${TIGHT_KEY.slice(0, -4)} nomeada`, rules(r3).includes(`over-cap-${TIGHT_KEY.slice(0, -4)}`), rules(r3).join(','));
    const capsRel = r.json ? String(r.json.caps.file).split(path.sep).join('/') : '';
    check('teto apertado: teto vem do arquivo do pacote', capsRel === 'budgets/caps.yaml', capsRel);
    check('teto apertado: r1 e r2 continuam passando', (gateOf(r.json, 'r1') || {}).status === 'pass' && (gateOf(r.json, 'r2') || {}).status === 'pass', `r1=${(gateOf(r.json, 'r1') || {}).status} r2=${(gateOf(r.json, 'r2') || {}).status}`);

    fs.writeFileSync(capsFile, originalCaps);
    check('teto: restaurado byte a byte', sha256(capsFile) === sha256(path.join(ROOT, 'budgets', 'caps.yaml')));
  }

  console.log('\n# 4. teto do pacote restaurado + skills estrangeiras: o kernel funciona igual');
  {
    check('estrangeiro: skills/ ainda e a de outra area', fs.existsSync(path.join(copy, 'skills', FOREIGN, 'SKILL.md')));
    const r = runGate(copy, example, ['--json']);
    check('estrangeiro: relatorio parseavel', !!r.json, r.stderr.slice(0, 200));
    check('estrangeiro: exit 0', r.code === 0, `exit ${r.code}`);
    check('estrangeiro: status pass', r.json && r.json.status === 'pass', r.json && r.json.status);
    check('estrangeiro: zero violacoes', !!r.json && r.json.counts.violations === 0, r.json && JSON.stringify(r.json.counts));
    check('estrangeiro: r1, r2 e r3 passam', ['r1', 'r2', 'r3'].every((id) => (gateOf(r.json, id) || {}).status === 'pass'));
  }

  console.log('\n# 5. o kernel nao conhece disciplina nenhuma por nome');
  {
    const kernelFiles = [...mjsIn(path.join(ROOT, 'gates')), path.join(ROOT, 'bin', 'memory-server.mjs')];
    const literals = ['examples/landing', 'impeccable', 'hallmark'];
    const offenders = [];
    for (const f of kernelFiles) {
      const text = fs.readFileSync(f, 'utf8').toLowerCase();
      for (const lit of literals) if (text.includes(lit)) offenders.push(`${relTo(ROOT, f)}:${lit}`);
    }
    check(`kernel: ${kernelFiles.length} arquivos lidos, alvo de referencia fora`, !offenders.some((o) => o.endsWith('examples/landing')), offenders.join(','));
    check('kernel: nenhuma marca de disciplina citada', offenders.length === 0, offenders.join(','));
    check('kernel: os arquivos lidos sao os do kernel', kernelFiles.length >= 6 && kernelFiles.every((f) => relTo(ROOT, f).startsWith('gates/') || relTo(ROOT, f) === 'bin/memory-server.mjs'));

    // O passe acima so vale se o kernel medido for byte a byte o kernel do repo.
    const kernelRel = kernelFiles.map((f) => relTo(ROOT, f));
    const drifted = kernelRel.filter((rel) => sha256(path.join(ROOT, rel)) !== sha256(path.join(copy, rel)));
    check('kernel: copia roda o mesmo kernel do repo', drifted.length === 0, drifted.join(','));
  }

  console.log('\n# 6. limpeza');
  {
    fs.rmSync(tmp, { recursive: true, force: true });
    check('temp: diretorio removido', !fs.existsSync(tmp), tmp);
  }
} finally {
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} ok, ${failures.length} falhas`);
if (failures.length) {
  console.log('\nfalhas:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
