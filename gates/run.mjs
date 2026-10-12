#!/usr/bin/env node
// gates/run.mjs — os tres portoes bloqueantes (R1, R2, R3)
//
//   node gates/run.mjs <dir>            relatorio legivel
//   node gates/run.mjs <dir> --json     relatorio maquina
//   node gates/run.mjs <dir> --strict   incomplete tambem derruba (exit 1)
//
// Exit: 0 = nenhum fail | 1 = ao menos um fail | 2 = erro de uso/ambiente.

import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';
import { runR1 } from './r1-anti-slop.mjs';
import { runR2 } from './r2-trace.mjs';
import { runR3, loadBudgets } from './r3-budgets.mjs';

function usage(code = 2) {
  console.error('uso: node gates/run.mjs <dir-do-artefato> [--json] [--strict]');
  process.exit(code);
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
if (positional.length !== 1) usage();

const target = path.resolve(positional[0]);
if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
  console.error(`alvo nao e um diretorio: ${target}`);
  process.exit(2);
}

let budgets;
try {
  budgets = loadBudgets();
} catch (e) {
  console.error(`teto invalido: ${e.message}`);
  process.exit(2);
}

const gates = [runR1(target), runR2(target), runR3(target)];
const failed = gates.filter((g) => g.violations.length > 0);
const uncertain = gates.filter((g) => g.violations.length === 0 && g.incomplete.length > 0);
const status = failed.length ? 'fail' : uncertain.length ? 'incomplete' : 'pass';

const report = {
  target,
  status,
  caps: { version: budgets.caps.version, file: path.relative(process.cwd(), budgets.file) },
  gates: gates.map((g) => ({
    gate: g.gate,
    status: g.violations.length ? 'fail' : g.incomplete.length ? 'incomplete' : 'pass',
    violations: g.violations,
    incomplete: g.incomplete,
    metrics: g.metrics || undefined,
  })),
  counts: {
    violations: gates.reduce((a, g) => a + g.violations.length, 0),
    incomplete: gates.reduce((a, g) => a + g.incomplete.length, 0),
  },
};

if (flags.has('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const line = (s) => console.log(s);
  line(`alvo: ${target}`);
  line(`teto: version ${budgets.caps.version} (${report.caps.file})`);
  line('');
  for (const g of report.gates) {
    const mark = g.status === 'pass' ? 'PASS' : g.status === 'fail' ? 'FAIL' : 'INCOMPLETE';
    line(`${mark.padEnd(11)} ${g.gate}`);
    for (const v of g.violations) line(`   fail  [${v.rule}] ${v.file}${v.line ? ':' + v.line : ''} — ${v.evidence}`);
    for (const i of g.incomplete) line(`   incerto [${i.rule}] ${i.file} — ${i.reason}`);
  }
  line('');
  line(`resultado: ${status.toUpperCase()} (${report.counts.violations} violacoes, ${report.counts.incomplete} incertezas)`);
  if (status === 'fail') line('entrega recusada: corrija a causa, nunca o relatorio.');
  if (status === 'incomplete') line('entrega permitida com incerteza declarada — o humano decide.');
}

const exitCode = failed.length || (flags.has('--strict') && uncertain.length) ? 1 : 0;
process.exit(exitCode);
