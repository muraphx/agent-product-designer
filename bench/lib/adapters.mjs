// bench/lib/adapters.mjs - adapters da Lane A para ESTE repo (agent-product-designer).
//
// Portado de designcourt/bench/lib/adapters.mjs @ d568871 e adaptado ao que este repo tem:
//   - runKernel e NOVO: mede os portoes deste repo (r1 anti-slop + r3 tetos) in-process
//   - runJudge importa o juiz vendorizado em judge/src/judge.mjs (antes: src/judge/judge.mjs)
//   - runImpeccable e runGateBaseline sao o port verbatim do upstream
//
// Regra dura: sem em-dash ou en-dash em string de relatorio deste repo. O texto vindo do upstream
// (MAPPINGS, comentarios) fica como esta.
//
// Contrato de retorno de cada adapter:
//   { adapter, file, verdict, detected_tells: string[], available: boolean, note? }
// verdict pertence a: 'fail' | 'pass_with_notes' | 'clean' | 'incomplete' | 'error' | 'unavailable'

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

// Sem npx pendurado: um adapter que trava trava a suite inteira. 60s e 100x o custo medido.
const IMPECCABLE_TIMEOUT_MS = 60000;

export const MAPPINGS = {
  judge: {
    // Identity mapping: judge findings use tell_id directly
    map(finding) {
      return finding.tell_id;
    }
  },

  gate_baseline: {
    // Map designkit anti-slop-check output to tell_ids
    // [PASS/FAIL] <check_name> <details>
    map(checkName) {
      const table = {
        'em-dash': 'em-dash',
        'hex': 'hardcoded-hex',
        'inter': 'inter-default',
        'eyebrows': 'eyebrow-density',
        'nomes': 'generic-names',
        'paleta': 'premium-consumer-palette',
        'scroll': 'scroll-cues'
      };
      return table[checkName] || null;
    }
  },

  impeccable: {
    // Map impeccable anti-patterns to designcourt tell_ids
    map(pattern) {
      const table = {
        'gray-on-color': 'contrast-aa',
        'low-contrast': 'contrast-aa',
        'dark-glow': 'neon-glow',
        'radial-halo': 'purple-gradient', // when on dark or purple
        'extreme-negative-tracking': null,
        'overused-font': 'inter-default',
        'skipped-heading': null,
        'marketing-buzzword': 'filler-verbs',
        'horizontal-scroll': null,
        'centered-body-text': null,
        'all-caps-body': null,
        'tiny-tap-target': null,
        'missing-alt': null,
        'empty-button': null
      };
      return table[pattern] !== undefined ? table[pattern] : null;
    }
  }
};

// ---------------------------------------------------------------------------
// kernel: os portoes deste repo (r1 + r3), medidos como ferramenta da lane
// ---------------------------------------------------------------------------

// TABELA CONGELADA (prereg/lane-a.md secao 6). 6 tells. Nao inventar mapeamento novo para o
// numero ficar melhor: regra sem linha aqui NAO produz tell e aparece em unmapped_rules.
export const KERNEL_MAPPING = {
  'ai-gradient': 'purple-gradient',
  'decorative-emoji': 'emoji-as-icon',
  'glow-shadow': 'neon-glow',
  'low-contrast-pair': 'contrast-aa',
  'accents': 'multi-accent', // regra do r3, emitida como over-cap-accents
  'radii': 'mixed-radii' // regra do r3, emitida como over-cap-radii
};

// O r3 emite as regras de teto prefixadas (over-cap-<metric>). A tabela congelada nomeia a regra
// pelo eixo (accents, radii), entao o prefixo e removido antes da consulta.
function kernelTell(rule) {
  const key = String(rule).replace(/^over-cap-/, '');
  return KERNEL_MAPPING[key] || null;
}

// Temp dirs vivem num registro para que Ctrl-C/erro nao deixe lixo.
const TEMP_DIRS = new Set();
let tempHooksInstalled = false;

function makeTempDir(prefix) {
  if (!tempHooksInstalled) {
    tempHooksInstalled = true;
    const sweep = () => {
      for (const dir of TEMP_DIRS) {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* nada a fazer no desligamento */
        }
      }
      TEMP_DIRS.clear();
    };
    process.on('exit', sweep);
    process.on('SIGINT', () => {
      sweep();
      process.exit(130);
    });
    process.on('SIGTERM', () => {
      sweep();
      process.exit(143);
    });
  }
  const dir = mkdtempSync(join(os.tmpdir(), prefix));
  TEMP_DIRS.add(dir);
  return dir;
}

function dropTempDir(dir) {
  TEMP_DIRS.delete(dir);
  rmSync(dir, { recursive: true, force: true });
}

function firstLine(text, max = 400) {
  const line = String(text || '').split(/\r?\n/).find((l) => l.trim() !== '') || '';
  return line.trim().slice(0, max);
}

// Materializa a pagina como artefato deste repo (o gate exige design/index.html, ver
// gates/lib/scan.mjs loadArtifact) e roda r1 + r3 in-process.
//
// Nao roda runR2 nem gates/run.mjs: r2 mede rastro (strategy/decision-log), nao slop, e dispararia
// falso positivo em pagina isolada do corpus.
export async function runKernel(filePath) {
  const abs = resolve(REPO_ROOT, filePath);
  const tmp = makeTempDir('pd-kernel-');
  try {
    mkdirSync(join(tmp, 'design'), { recursive: true });
    writeFileSync(join(tmp, 'design', 'index.html'), readFileSync(abs, 'utf8'), 'utf8');

    const { runR1 } = await import('../../gates/r1-anti-slop.mjs');
    const { runR3 } = await import('../../gates/r3-budgets.mjs');
    const r1 = runR1(tmp);
    const r3 = runR3(tmp);

    const violations = [...r1.violations, ...r3.violations];
    const incomplete = [...r1.incomplete, ...r3.incomplete];

    const tells = new Set();
    const unmapped = new Set();
    for (const v of violations) {
      const tell = kernelTell(v.rule);
      if (tell) tells.add(tell);
      else unmapped.add(v.rule);
    }

    const verdict = violations.length > 0 ? 'fail' : incomplete.length > 0 ? 'incomplete' : 'clean';
    return {
      adapter: 'kernel',
      file: filePath,
      verdict,
      detected_tells: Array.from(tells).sort(),
      unmapped_rules: Array.from(unmapped).sort(),
      available: true
    };
  } catch (err) {
    return {
      adapter: 'kernel',
      file: filePath,
      verdict: 'error',
      detected_tells: [],
      unmapped_rules: [],
      available: true,
      note: firstLine(err && err.message)
    };
  } finally {
    dropTempDir(tmp);
  }
}

// ---------------------------------------------------------------------------
// judge: o juiz vendorizado deste repo
// ---------------------------------------------------------------------------

export async function runJudge(filePath) {
  const abs = resolve(REPO_ROOT, filePath);
  const { judgeHtml } = await import('../../judge/src/judge.mjs');
  const html = readFileSync(abs, 'utf8');
  const verdict = judgeHtml({ html });
  const tells = new Set();
  for (const f of verdict.findings) {
    if (f.tell_id) tells.add(f.tell_id);
  }
  return {
    adapter: 'judge',
    file: filePath,
    verdict: verdict.verdict,
    raw_findings_count: verdict.findings.length,
    detected_tells: Array.from(tells),
    available: true
  };
}

// ---------------------------------------------------------------------------
// gate_baseline: o portao legado (designkit/scripts/anti-slop-check.py)
// ---------------------------------------------------------------------------

export const BASELINE_SCRIPT = resolve(REPO_ROOT, '../designkit/scripts/anti-slop-check.py');

function parseBaseline(out) {
  const tells = new Set();
  for (const line of String(out).split('\n')) {
    const m = line.match(/\[(FAIL|AVISO)\]\s+([a-z-]+)/);
    if (m) {
      const mapped = MAPPINGS.gate_baseline.map(m[2]);
      if (mapped) tells.add(mapped);
    }
  }
  return tells;
}

export function runGateBaseline(filePath) {
  const abs = resolve(REPO_ROOT, filePath);
  if (!existsSync(BASELINE_SCRIPT)) {
    return {
      adapter: 'gate_baseline',
      file: filePath,
      verdict: 'unavailable',
      detected_tells: [],
      available: false,
      note: `baseline ausente: ${BASELINE_SCRIPT}`
    };
  }
  try {
    const out = execFileSync('python', [BASELINE_SCRIPT, abs], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const tells = parseBaseline(out);
    const isFail = /ANTI-SLOP: FAIL/.test(out);
    return {
      adapter: 'gate_baseline',
      file: filePath,
      verdict: isFail ? 'fail' : 'clean',
      detected_tells: Array.from(tells),
      available: true
    };
  } catch (err) {
    const out = String(err.stdout || '') + String(err.stderr || '');
    if (err && err.code === 'ENOENT') {
      return {
        adapter: 'gate_baseline',
        file: filePath,
        verdict: 'unavailable',
        detected_tells: [],
        available: false,
        note: `python ausente: ${firstLine(err.message)}`
      };
    }
    const tells = parseBaseline(out);
    return {
      adapter: 'gate_baseline',
      file: filePath,
      verdict: 'fail',
      detected_tells: Array.from(tells),
      available: true
    };
  }
}

// ---------------------------------------------------------------------------
// impeccable: CLI de mercado, via npx, em cwd temporario
// ---------------------------------------------------------------------------

function parseImpeccable(out) {
  const tells = new Set();
  for (const line of String(out).split('\n')) {
    const m = line.match(/^\s*\[([a-z-]+)\]/);
    if (m) {
      const mapped = MAPPINGS.impeccable.map(m[1]);
      if (mapped) tells.add(mapped);
    }
  }
  return tells;
}

export function runImpeccable(filePath) {
  const abs = resolve(REPO_ROOT, filePath);
  const tmp = makeTempDir('pd-impeccable-');
  try {
    const out = execFileSync('npx', ['impeccable', 'detect', abs], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd: tmp,
      timeout: IMPECCABLE_TIMEOUT_MS
    });
    const tells = parseImpeccable(out);
    const hasFindings = /anti-patterns? found/.test(out);
    return {
      adapter: 'impeccable',
      file: filePath,
      verdict: hasFindings ? 'fail' : 'clean',
      detected_tells: Array.from(tells),
      available: true
    };
  } catch (err) {
    const out = String(err.stdout || '') + String(err.stderr || '');
    const tells = parseImpeccable(out);
    // Ferramenta ausente/falha de pacote: INDISPONIVEL com o stderr. Zero inventado, nunca.
    if (tells.size === 0 && !/anti-patterns? found/.test(out)) {
      return {
        adapter: 'impeccable',
        file: filePath,
        verdict: 'unavailable',
        detected_tells: [],
        available: false,
        note: `npx impeccable nao rodou: ${firstLine(err.stderr || err.message)}`
      };
    }
    return {
      adapter: 'impeccable',
      file: filePath,
      verdict: tells.size > 0 ? 'fail' : 'clean',
      detected_tells: Array.from(tells),
      available: true
    };
  } finally {
    dropTempDir(tmp);
  }
}

// ---------------------------------------------------------------------------
// Manifesto: os quatro adapters da Lane A, na ordem declarada no preregistro
// ---------------------------------------------------------------------------

export const ADAPTERS = [
  { name: 'kernel', runner: runKernel, coverage: '6 tells' },
  { name: 'judge', runner: runJudge, coverage: '38 tells' },
  { name: 'impeccable', runner: runImpeccable, coverage: '5 mapeamentos' },
  { name: 'gate_baseline', runner: runGateBaseline, coverage: '7 mapeamentos' }
];
