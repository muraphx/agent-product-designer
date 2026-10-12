// bench/run-lane-a.mjs - roda os quatro adapters da Lane A sobre o corpus rotulado deste repo.
//
// Portado de designcourt/bench/run-detector-bench.mjs @ d568871, com quatro ajustes:
//   1. roda kernel + judge + impeccable + gate_baseline (na ordem do manifesto)
//   2. adapter indisponivel e reportado como unavailable, NUNCA como 0
//   3. escape conta 'incomplete' e 'error' alem de 'clean' e 'pass_with_notes' (ver secao Escape)
//   4. o JSON nao carrega relogio: H4 exige byte-identidade entre duas execucoes (o tempo de
//      execucao e impresso na tela, nunca gravado no arquivo)
//
// Regra dura: sem em-dash ou en-dash em string de relatorio deste repo.
//
//   node bench/run-lane-a.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS } from './lib/adapters.mjs';
import { loadCorpus, evaluateDetections, escapeRate, round } from './lib/metrics.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

export const SEED = 20261012;
const CORPUS_PATH = resolve(REPO_ROOT, 'bench/corpus/labeled.jsonl');
const DEFAULT_OUT_PATH = resolve(REPO_ROOT, 'bench/results/lane-a.json');

// `--only=kernel,judge` roda um subconjunto (a suite usa isso para provar o determinismo sem pagar
// os ~200s do `impeccable`, que e CLI de terceiro via npx). `--out=<path>` redireciona o JSON.
// A lane publicada e a lane completa: nenhum numero do README sai de execucao parcial.
const argv = process.argv.slice(2);
const onlyArg = argv.find((a) => a.startsWith('--only='));
const outArg = argv.find((a) => a.startsWith('--out='));
export const ONLY = onlyArg
  ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean))
  : null;
const OUT_PATH = outArg ? resolve(process.cwd(), outArg.slice('--out='.length)) : DEFAULT_OUT_PATH;

// Escape = ferramenta que classificou uma pagina com rotulo blocker como inofensiva. Silencio
// tambem e escape: quem nao diz nada nao reportou a ofensa. Por isso 'incomplete' (portao recusou
// decidir) e 'error' (adapter quebrou) entram na lista, junto de 'clean' e 'pass_with_notes'.
export const ESCAPE_VERDICTS = ['clean', 'pass_with_notes', 'incomplete', 'error'];

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

function nullMetrics() {
  return {
    tp: null,
    fp: null,
    fn: null,
    precision: null,
    recall: null,
    f1: null,
    blockers: null,
    escaped_blockers: null,
    escape_rate: null
  };
}

async function runAdapter(entry, rows) {
  const detections = [];
  for (const row of rows) {
    let res;
    try {
      res = await entry.runner(row.html);
    } catch (err) {
      res = {
        adapter: entry.name,
        file: row.html,
        verdict: 'error',
        detected_tells: [],
        available: true,
        note: String((err && err.message) || err)
      };
    }
    detections.push(res);
  }

  const available = detections.every((d) => d.available !== false);
  const unmapped = new Set();
  for (const d of detections) {
    for (const rule of d.unmapped_rules || []) unmapped.add(rule);
  }
  const unmapped_rules = Array.from(unmapped).sort();

  if (!available) {
    const notes = detections.map((d) => d.note).filter(Boolean);
    return {
      metrics: { adapter: entry.name, coverage: entry.coverage, available: false, unmapped_rules, ...nullMetrics() },
      notes,
      detections
    };
  }

  // tp/fp/fn por (arquivo, tell), metricas pelas funcoes reais de bench/lib/metrics.mjs.
  const findings = new Map();
  const verdicts = [];
  for (const d of detections) {
    findings.set(d.file, d.detected_tells || []);
    verdicts.push({ file: d.file, verdict: d.verdict });
  }

  const evaluated = evaluateDetections(rows, findings);
  const escape = escapeRate(rows, verdicts, { escapeVerdicts: ESCAPE_VERDICTS });

  const metrics = {
    adapter: entry.name,
    coverage: entry.coverage,
    available: true,
    tp: evaluated.totals.tp,
    fp: evaluated.totals.fp,
    fn: evaluated.totals.fn,
    precision: round(evaluated.micro.precision, 3),
    recall: round(evaluated.micro.recall, 3),
    f1: round(evaluated.micro.f1, 3),
    blockers: escape.blocker_files,
    escaped_blockers: escape.escaped_count,
    escape_rate: round(escape.rate, 3),
    unmapped_rules
  };

  return { metrics, notes: [], detections };
}

async function main() {
  const corpusText = readFileSync(CORPUS_PATH, 'utf8');
  const rows = loadCorpus(CORPUS_PATH, { checkFiles: true, root: REPO_ROOT });

  console.log('\n======================================================');
  console.log('LANE A DETECTOR BENCHMARK: agent-product-designer');
  console.log(`Corpus: ${rows.length} paginas | seed ${SEED} | ${process.version}`);
  console.log('======================================================\n');

  const selected = ONLY ? ADAPTERS.filter((a) => ONLY.has(a.name)) : ADAPTERS;
  const unknown = ONLY ? [...ONLY].filter((n) => !ADAPTERS.some((a) => a.name === n)) : [];
  if (unknown.length) {
    console.error(`adapter desconhecido em --only: ${unknown.join(', ')} (existem: ${ADAPTERS.map((a) => a.name).join(', ')})`);
    process.exit(2);
  }

  const adapters = [];
  const table = [];

  for (const entry of selected) {
    process.stdout.write(`Running ${entry.name} (${entry.coverage})... `);
    const start = Date.now();
    const { metrics, notes } = await runAdapter(entry, rows);
    const elapsedSeconds = (Date.now() - start) / 1000;

    if (!metrics.available) {
      console.log(`UNAVAILABLE (${elapsedSeconds.toFixed(1)}s)`);
      for (const note of notes) console.log(`  note: ${note}`);
    } else {
      const esc = metrics.escape_rate === null ? 'n/a' : `${(metrics.escape_rate * 100).toFixed(1)}%`;
      console.log(`done in ${elapsedSeconds.toFixed(1)}s (F1: ${metrics.f1}, Escape: ${esc})`);
      if (metrics.unmapped_rules.length) console.log(`  unmapped rules (contam como falso positivo): ${metrics.unmapped_rules.join(', ')}`);
    }

    adapters.push(metrics);
    table.push({
      adapter: metrics.adapter,
      available: metrics.available,
      tp: metrics.tp,
      fp: metrics.fp,
      fn: metrics.fn,
      precision: metrics.precision,
      recall: metrics.recall,
      f1: metrics.f1,
      blockers: metrics.blockers,
      escaped: metrics.escaped_blockers,
      escape_rate: metrics.escape_rate,
      unmapped: metrics.unmapped_rules.length,
      elapsed_s: Number(elapsedSeconds.toFixed(1))
    });
  }

  const report = {
    seed: SEED,
    corpus_files: rows.length,
    corpus_sha256: sha256(corpusText),
    node_version: process.version,
    adapters
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log('\n======================================================');
  console.log('LANE A SUMMARY');
  console.log('======================================================');
  console.table(table);
  console.log(`Results saved to ${relative(REPO_ROOT, OUT_PATH).replaceAll('\\', '/')} (sha256 ${sha256(JSON.stringify(report, null, 2) + '\n').slice(0, 16)}...)`);
  console.log('O tempo de execucao acima NAO entra no JSON: H4 exige byte-identidade entre execucoes.\n');
}

await main();
