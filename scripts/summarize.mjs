#!/usr/bin/env node
// Re-scores an exported results JSON against fixtures/out/labels.json and
// prints Markdown tables. Re-scoring (rather than trusting the score stored
// in the export) means a scorer fix applies to old runs too.
//
//   node scripts/summarize.mjs results/*.json
//   node scripts/summarize.mjs results/phaseA.json --by lang,panel,subheading --fails

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

await import('../scoring.js');
const { score, aggregate, METRICS } = globalThis.Scoring;

const here = dirname(fileURLToPath(import.meta.url));
const labels = JSON.parse(readFileSync(join(here, '..', 'fixtures', 'out', 'labels.json'), 'utf8'));
const truthOf = Object.fromEntries(labels.fixtures.map(f => [f.id, f.truth]));

const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith('--'));
const byDims = (args.find(a => a.startsWith('--by=')) || '--by=').slice(5).split(',').filter(Boolean);
const showFails = args.includes('--fails');

const rows = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  for (const r of j.results) {
    if (r.dto && truthOf[r.fixture]) r.score = score(r.dto, truthOf[r.fixture]);
    r.__file = f;
    rows.push(r);
  }
}

const header = `| group | parsed | ${METRICS.map(([, l]) => l).join(' | ')} | avg ms |`;
const sep = `|---|---|${METRICS.map(() => '---').join('|')}|---|`;
const line = (label, rs) => {
  const a = aggregate(rs);
  return `| ${label} | ${a.ok}/${a.n} | ${METRICS.map(([k]) => `${a.c[k]}/${a.ok}`).join(' | ')} | ${a.ms ?? ''} |`;
};

const groups = [...new Set(rows.map(r => `${r.path} · ${r.rules}`))];
console.log(`${rows.length} runs from ${files.length} file(s)\n`);
console.log(header); console.log(sep);
for (const g of groups) console.log(line(`**${g}**`, rows.filter(r => `${r.path} · ${r.rules}` === g)));

for (const dim of byDims) {
  const vals = [...new Set(rows.map(r => String(r.variant[dim])))];
  console.log(`\n### by ${dim}\n`); console.log(header); console.log(sep);
  for (const g of groups) for (const v of vals) {
    const rs = rows.filter(r => `${r.path} · ${r.rules}` === g && String(r.variant[dim]) === v);
    if (rs.length) console.log(line(`${g} · ${dim}=${v}`, rs));
  }
}

if (showFails) {
  console.log('\n### failures (non-ok status)\n');
  for (const r of rows.filter(r => r.status !== 'ok')) console.log(`- ${r.fixture} · ${r.path} · ${r.rules} · run ${r.run}: ${r.status}`);
  for (const [k, l] of METRICS) {
    const bad = k === 'copied' || k === 'distractorHit' || k === 'dateFabricated';
    const rs = rows.filter(r => r.score && (bad ? r.score[k] : !r.score[k]));
    if (!rs.length) continue;
    console.log(`\n### ${bad ? l : l + ' — misses'} (${rs.length})\n`);
    for (const r of rs) {
      const v = k.startsWith('change') || k === 'distractorHit' ? r.dto.change_percent
              : k === 'priceOk' ? r.dto.price : k.startsWith('date') ? r.dto.published_at
              : k === 'instrumentOk' ? r.dto.instrument : k === 'sentimentOk' ? r.dto.sentiment : r.dto.headline;
      console.log(`- ${r.fixture} · ${r.path} · ${r.rules} · run ${r.run}: ${JSON.stringify(v)}`);
    }
  }
}
