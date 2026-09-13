// Shared scoring. Loaded by index.html as a classic script and by
// scripts/summarize.mjs via dynamic import; both read globalThis.Scoring.
// Keep this file free of imports/exports so it works in both.
(() => {
  const hasHangul = (s) => /[가-힣]/.test(String(s || ''));
  // Numeric value of a model string: strips currency codes/symbols, %, commas,
  // whitespace and the Unicode minus. "NOK 187.40" → 187.4, "−4.6%" → -4.6.
  const num = (v) => {
    if (v == null) return null;
    const s = String(v).replace(/−/g, '-').replace(/[^0-9.\-]/g, '');
    if (s === '' || s === '-' || s === '.') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const norm = (s) => String(s || '').toLowerCase().replace(/[\s"'“”‘’.,!?—–\-:;()]/g, '');
  // The literal string "null" is what the constrained decoder emits when the
  // schema allows null but the model writes the word. Treat it as empty for
  // the accuracy metrics (the intent is clear) and count it separately.
  const isNullStr = (v) => typeof v === 'string' && v.trim().toLowerCase() === 'null';
  const empty = (v) => v == null || String(v).trim() === '' || isNullStr(v);

  const METRICS = [
    ['topicOk', 'topic'], ['langOk', 'lang'], ['copied', 'copied'], ['distractorHit', 'distractor→change'],
    ['changeOk', 'change ok'], ['priceOk', 'price ok'], ['dateOk', 'date ok'], ['dateFabricated', 'date fab'],
    ['instrumentOk', 'instr ok'], ['sentimentOk', 'sent ok'], ['nullString', '"null" str']
  ];

  // dto: parsed model output. truth: labels.json entry's `truth`.
  function score(dto, truth) {
    const T = truth;
    const cpN = isNullStr(dto.change_percent) ? null : num(dto.change_percent);
    const prN = isNullStr(dto.price) ? null : num(dto.price);
    const h = String(dto.headline || '');
    const r = {};
    r.topicOk = T.keywords.some(k => h.toLowerCase().includes(k.toLowerCase()));
    r.langOk = hasHangul(h) === (T.language === 'ko');
    r.copied = T.subheading != null && norm(h) === norm(T.subheading);
    r.distractorHit = cpN !== null && Math.abs(cpN - T.distractor_percent) < 0.005;
    r.changeOk = T.change_percent == null
      ? empty(dto.change_percent)
      : (cpN !== null && Math.abs(cpN - T.change_percent) < 0.05);
    r.priceOk = T.price == null
      ? empty(dto.price)
      : (prN !== null && Math.abs(prN - T.price) < 0.05);
    r.dateOk = String(dto.published_at || '').startsWith(T.published_at);
    r.dateFabricated = !r.dateOk && /\d{4}-\d{2}-\d{2}/.test(String(dto.published_at || ''));
    r.instrumentOk = T.instrument == null
      ? empty(dto.instrument)
      : String(dto.instrument || '').trim().toUpperCase() === T.instrument;
    r.sentimentOk = dto.sentiment === T.sentiment;
    r.nullString = ['instrument', 'published_at', 'price', 'change_percent'].some(k => isNullStr(dto[k]));
    return r;
  }

  function aggregate(rows) {
    const ok = rows.filter(r => r.status === 'ok' && r.score);
    const c = {};
    for (const [k] of METRICS) c[k] = ok.filter(r => r.score[k]).length;
    const ms = ok.map(r => r.inferMs).filter(Boolean);
    return { n: rows.length, ok: ok.length, c, ms: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null };
  }

  globalThis.Scoring = { score, aggregate, num, norm, hasHangul, METRICS };
})();
