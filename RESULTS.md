# Results

Chrome 152 stable (Windows 11), built-in on-device model, image and text input both
`available`. Tesseract.js 6 (`kor+eng`, PSM 3) on the 1024px-longest-edge copy of each
fixture. One session per call, `responseConstraint` = the schema in `index.html`,
default sampling. Timeout 90 s per call; no call timed out and every response parsed.

Raw runs: `results/phaseA_v1_all16_x3.json` (144 runs) and
`results/phaseB_v1h_pad_padh_deck8_x3.json` (144 runs). Re-score at any time with

```bash
node scripts/summarize.mjs results/*.json --by=lang,panel,subheading --fails
```

## What this was built to check, and what happened

This benchmark exists to test two claims that came out of an earlier, non-public probe on
real phone screenshots of financial news (dark-mode, dense, mixed-language app UI):

1. **OCR-first beats the vision path** for structured extraction: feeding the model OCR text
   instead of the image removed a specific contamination (a CPI/rate percentage in the
   body landing in `change_percent`), and a hybrid (OCR base, vision only for `price`)
   was best overall.
2. **Prompt length alone degrades rule compliance**: inserting inert, non-imperative
   paragraphs into the rules made the model copy a sub-headline line as the headline
   and drift in output language.

On the synthetic fixtures here (clean, light-mode, large type, two fictional articles ×
en/ko × quote panel × sub-headline), **neither claim reproduces as stated.**

| claim | result on synthetic fixtures |
|---|---|
| OCR-first beats vision | **No.** Vision wins on topic, language, change, date and instrument. OCR wins only on avoiding the distractor percentage, and only by 3 vs 1 runs out of 48. |
| Hybrid best overall | **No.** Hybrid is the only path with 0 distractor hits, but it inherits the OCR path's language and date failures and its gate skipped vision on 15 runs where a panel was present. |
| Length breaks headline copying | **No.** Headline copying was 0/24 in every rules variant, short or padded, on both paths. |
| Length breaks language compliance | **No.** Vision: v1 24/24, pad 24/24, padh 24/24. OCR: v1 17/24, v1h 21/24, pad 18/24, padh 19/24. No length-ordered drop. |

Two things did reproduce, and one new thing appeared:

- **Year fabrication** (the original probe's `published_at` finding): with "2026" legible
  in the input, the model wrote 2024 or 2020. OCR path 17 runs, hybrid 8, vision 4, out of
  120 / 48 / 120.
- **Distractor percentage → `change_percent`** happens on the vision path (4/120) more
  than OCR (1/120), directionally as claimed, but at a rate too low to build a design on.
- **Prompt example values leak into the output.** The rules cite `"+2.34"` and `"135.20"` as
  formatting examples and `2026-09-03T06:18:28Z` as the ISO example. Outputs returned
  `change_percent` of exactly ±2.34 in 16/120 OCR-path runs vs 4/120 vision runs, and
  timestamps ending in `:28` in 13/120 vision and 7/120 OCR runs. The original probe did
  not look for this; it may explain some of what it attributed to prompt length.

## Phase A — three paths, rules v1, 16 fixtures × 3

| path | parsed | topic | lang | copied | distractor→change | change ok | price ok | date ok | date fab | instr ok | sent ok | avg ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vision | 48/48 | 38/48 | 48/48 | 0/48 | 3/48 | 43/48 | 48/48 | 42/48 | 6/48 | 22/48 | 47/48 | 8845 |
| ocr | 48/48 | 32/48 | 34/48 | 0/48 | 1/48 | 27/48 | 47/48 | 30/48 | 12/48 | 8/48 | 48/48 | 6678 |
| hybrid | 48/48 | 38/48 | 41/48 | 0/48 | 0/48 | 25/48 | 43/48 | 32/48 | 11/48 | 8/48 | 48/48 | 8782 |

OCR itself averaged 2.98 s per image on top of the model call.

By language:

| path · lang | topic | lang | change ok | date ok | date fab | instr ok | avg ms |
|---|---|---|---|---|---|---|---|
| vision · en | 24/24 | 24/24 | 22/24 | 24/24 | 0/24 | 10/24 | 6489 |
| vision · ko | 14/24 | 24/24 | 21/24 | 18/24 | 6/24 | 12/24 | 11202 |
| ocr · en | 24/24 | 24/24 | 20/24 | 20/24 | 3/24 | 5/24 | 5607 |
| ocr · ko | 8/24 | 10/24 | 7/24 | 10/24 | 9/24 | 3/24 | 7749 |
| hybrid · en | 24/24 | 24/24 | 18/24 | 20/24 | 3/24 | 5/24 | 6496 |
| hybrid · ko | 14/24 | 17/24 | 7/24 | 12/24 | 8/24 | 3/24 | 11068 |

### Why OCR-first loses here

- **Korean OCR text makes the model translate.** On Korean fixtures the OCR path produced
  an English headline in 28/60 runs across both phases (vision: 2/60), despite a
  language directive at the top of the prompt in both languages. Tesseract's `kor` output
  is legible but noisy (`노스계이트`, `몰해`, `SEE`), and the model treats it as something
  to rewrite rather than summarise in place. The vision path, reading the same pixels,
  stays in Korean.
- **OCR loses the decimal point in the quote panel.** `−4.6%` came through as `-46%` and
  the model faithfully reported `-46` (6 runs). `+11.8%` lost its sign. The ticker
  `LKSP` became `1650` on the Korean render.
- **The date line is the most OCR-damaged line on the page** (`arch 14,2026 412 PM`,
  `2026년 38 14일 오후 412`), so the OCR path fabricates dates the vision path reads
  correctly.
- **`instrument` is weak on every path** because the ticker is only in the panel and the
  model often answers with the company name or the OCR-garbled token (`HVM osc`).

### Hybrid and the gate

The gate (skip vision when OCR text shows no quote panel) was right on all 8 `metals`
fixtures and wrong on all 8 `battery` fixtures in phase A, because it required a decimal
point and a sign that OCR had dropped. Fixed after phase A (`index.html`); phase B shows
the `metals` gates correct and the `battery` gates still missing on the unsigned `11.8%`,
fixed again afterwards. Net effect in phase A: hybrid ran as text-only on 39/48 runs, so
its numbers are mostly the OCR path's numbers with `price` occasionally overridden.

## Phase B — prompt length, deck fixtures (8) × vision/ocr × 3

`v1` rows are the phase A runs on the same 8 fixtures. Rule text lengths (en):
v1 1162 chars, v1h 1536, pad 2108, padh 2482.

| path · rules | topic | lang | copied | distractor→change | change ok | date ok | date fab | avg ms |
|---|---|---|---|---|---|---|---|---|
| vision · v1 | 18/24 | 24/24 | 0/24 | 1/24 | 23/24 | 21/24 | 3/24 | 8221 |
| vision · v1h | 16/24 | 22/24 | 0/24 | 0/24 | 16/24 | 23/24 | 1/24 | 7494 |
| vision · pad | 18/24 | 24/24 | 0/24 | 0/24 | 23/24 | 23/24 | 1/24 | 7574 |
| vision · padh | 18/24 | 24/24 | 0/24 | 0/24 | 21/24 | 23/24 | 1/24 | 7509 |
| ocr · v1 | 15/24 | 17/24 | 0/24 | 1/24 | 14/24 | 12/24 | 6/24 | 6872 |
| ocr · v1h | 21/24 | 21/24 | 0/24 | 0/24 | 13/24 | 13/24 | 7/24 | 5351 |
| ocr · pad | 17/24 | 18/24 | 0/24 | 0/24 | 17/24 | 13/24 | 5/24 | 5451 |
| ocr · padh | 19/24 | 19/24 | 0/24 | 0/24 | 15/24 | 13/24 | 7/24 | 5345 |

No headline was ever the deck line verbatim. The headline rule (`v1h`) helped the OCR
path's topic and language scores and hurt vision's `change ok` (16/24, with `+2.34`
appearing twice — the example-value leak again). Padding did nothing consistent.

The original probe saw copying only on one real article whose deck line was a
Trump-related sentence more salient than the headline. The synthetic decks here are
bland ("Analysts trim targets after weak factory data"). Copying may need a deck line
that is more quotable than the headline, which these fixtures do not test.

## Example-value leak, by condition

Count of runs whose `change_percent` is exactly ±2.34 (a number that appears nowhere in
any fixture, only in the rules as a format example):

| phase · path · rules | n | ±2.34 | ts ends `:28` |
|---|---|---|---|
| A vision v1 | 48 | 0 | 9 |
| A ocr v1 | 48 | 3 | 3 |
| A hybrid v1 | 48 | 3 | 4 |
| B vision v1h | 24 | 2 | 1 |
| B ocr v1h | 24 | 4 | 1 |
| B vision pad | 24 | 0 | 2 |
| B ocr pad | 24 | 3 | 3 |
| B vision padh | 24 | 2 | 1 |
| B ocr padh | 24 | 6 | 0 |

The leak is worst when the input is noisy (OCR) and the panel is absent (nothing real to
put in the field). `135.20`, the price example, never leaked — `price` had a real value
on panel fixtures and the empty-string rule held on the rest.

## Phase C — the example numbers removed (`v1x`), 16 fixtures × vision/ocr × 3

`v1x` is `v1` with exactly three literals deleted: the `"135.20", "+2.34"` format
example in rule 2 and the `2026-09-03T06:18:28Z` example in rule 5 (en 1162 → 1111
chars, ko 657 → 611). Nothing else changed. Raw runs:
`results/phaseC_v1x_all16_x3.json`. One vision call timed out at 90 s; every other
response parsed.

| path · rules | parsed | topic | lang | distractor→change | change ok | price ok | date ok | date fab | instr ok | avg ms |
|---|---|---|---|---|---|---|---|---|---|---|
| vision · v1 | 48/48 | 38/48 | 48/48 | 3/48 | 43/48 | 48/48 | 42/48 | 6/48 | 22/48 | 8845 |
| vision · v1x | 47/48 | 36/47 | 47/47 | 5/47 | 35/47 | 46/47 | 34/47 | 12/47 | 24/47 | 10684 |
| ocr · v1 | 48/48 | 32/48 | 34/48 | 1/48 | 27/48 | 47/48 | 30/48 | 12/48 | 8/48 | 6678 |
| ocr · v1x | 48/48 | 32/48 | 33/48 | 1/48 | 24/48 | 47/48 | 29/48 | 11/48 | 8/48 | 8290 |

| leak / fabrication, per 48 runs | vision v1 | vision v1x | ocr v1 | ocr v1x |
|---|---|---|---|---|
| `change_percent` = ±2.34 | 0 | **0** | 3 | **0** |
| `published_at` ends `:28` | 9 | **0** | 3 | **0** |
| year ≠ 2026 | 3 | 9 | 8 | 6 |
| `published_at` empty | 0 | 2 | 2 | 4 |
| distractor → `change_percent` | 3 | 5 | 1 | 1 |

**The leak is real and the examples were its only source: both signatures went to
zero.** But removing them did not make the answers better. The slots that used to hold
`+2.34` now hold other wrong things — on no-panel fixtures the vision path wrote the
distractor `3.4%` three times in a row and `0` five times where the rule says empty
string; dates that used to end in `:28` now end in `:00` with the year moved to 2020,
2023 or 2024. `change ok` and `date ok` got worse on the vision path (43 → 35, 42 → 34),
though with 47-run cells and a 90 s timeout in the mix that is within noise for
everything except the two leak rows.

Reading: the example values were a *symptom* of the model's reluctance to leave a
field empty, not the cause of the misses. With the examples present it filled the gap
with the number it had just been shown; without them it fills the gap with the nearest
number in the input or with `0`. The fix the rules ask for ("MUST be empty strings")
is not one the model reliably honours on either path, and that is the finding worth
carrying forward — not "prompt examples leak", which is now the easy half.

## What to change before trusting any of this further

- ~~Take the example numbers out of the rules and re-run.~~ Done (phase C): the leak
  signatures vanish, accuracy does not improve. The open problem is the model filling
  fields that should stay empty; a schema-level fix (make `change_percent` nullable
  or an enum-gated object) is the next thing to test, not more prompt wording.
- **Add fixtures that look like the original failure cases**: dark mode, phone-density
  type, an app header line above the article, and a deck line more quotable than the
  headline. The clean renders here are an easy case for the vision path; the original
  claim may hold only on hard images, which is a narrower and more useful statement.
- **Try `most-predictable` sampling** (Chrome 148 origin-trial preset) to see whether the
  leak and the year fabrication are sampling noise.
- Per-cell sample sizes are 12 or 24. Differences under about 3 runs are noise.
