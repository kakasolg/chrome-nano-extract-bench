# Results

Chrome 152 stable (Windows 11), built-in on-device model, image and text input both
`available`. Tesseract.js 6 (`kor+eng`, PSM 3) on the 1024px-longest-edge copy of each
fixture. One session per call, `responseConstraint` = the schema in `index.html`,
default sampling. Timeout 90 s per call; one call each in phases C and D timed out, every
other response parsed.

Raw runs: `results/phaseA_v1_all16_x3.json` (144), `results/phaseB_v1h_pad_padh_deck8_x3.json`
(144), `results/phaseC_v1x_all16_x3.json` (96), `results/phaseD_v1n_all16_x3.json` (96),
`results/phaseE_v1n2_all16_x3.json` (96), `results/phaseF_latency_ab_{vision,ocr}_x3.json`
(96 + 96), `results/phaseG_dark_v1n_x3.json` (96), `results/phaseH_dark_ocr_adaptive_v1n_x3.json`
(48). Re-score at any time with

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

## Phase D — nullable schema (`v1n`), 16 fixtures × vision/ocr × 3

`v1n` is `v1x` with every "empty string" instruction reworded to "null", paired with a
schema where `instrument`, `published_at`, `price` and `change_percent` are
`type: ["string", "null"]`. Chrome's `responseConstraint` accepted the union type
without complaint. Raw runs: `results/phaseD_v1n_all16_x3.json`.

| path · rules | parsed | topic | lang | distractor→change | change ok | price ok | date ok | date fab | instr ok | `"null"` str | avg ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| vision · v1 | 48/48 | 38/48 | 48/48 | 3/48 | 43/48 | 48/48 | 42/48 | 6/48 | 22/48 | 0 | 8845 |
| vision · v1x | 47/48 | 36/47 | 47/47 | 5/47 | 35/47 | 46/47 | 34/47 | 12/47 | 24/47 | 0 | 10684 |
| vision · v1n | 48/48 | 40/48 | 47/48 | **1/48** | **41/48** | 47/48 | 35/48 | 12/48 | 19/48 | 2 | **5214** |
| ocr · v1 | 48/48 | 32/48 | 34/48 | 1/48 | 27/48 | 47/48 | 30/48 | 12/48 | 8/48 | 0 | 6678 |
| ocr · v1x | 48/48 | 32/48 | 33/48 | 1/48 | 24/48 | 47/48 | 29/48 | 11/48 | 8/48 | 0 | 8290 |
| ocr · v1n | 47/48 | 33/47 | 33/47 | **0/47** | 25/47 | 45/47 | 30/47 | 10/47 | 9/47 | 1 | **3789** |

The `"null"` str column counts runs where the model wrote the *word* `"null"` as a string
instead of JSON `null`; the scorer treats both as empty. Across the four nullable fields
the model emitted JSON `null` 77 times, the string `"null"` 5 times, an empty string 0
times, and a literal zero 7 times.

**What the schema change did:**

- **The no-panel `change_percent` slot is now mostly left empty.** On the English no-panel
  fixtures every vision run (12/12) and 11/12 OCR runs returned `null`. The distractor
  hits dropped to 1 (vision) and 0 (OCR). This is the effect the prose rule ("MUST be
  empty") was asking for and never got in v1/v1x.
- **Korean no-panel fixtures are still filled.** The remaining wrong values are all on
  `_ko_` fixtures: `"3.4"` (the distractor), `"0"`, `"412"` (a fragment of the OCR'd
  timestamp), `"41~43"` (the shipment range). The Korean runs are the weak spot on every
  metric in every phase; a nullable schema does not change that.
- **`instrument` moved the other way.** Given permission to write `null`, the model
  instead wrote the company name (`"Halvorsen"`, `"라크스퍼 에너지"`) on every no-panel
  fixture, so `instr ok` fell (22 → 19 vision). The rule text says "if you cannot find
  instrument, set it to null", and the model reads a company name as an instrument.
  That is a rule-wording problem, not a schema one.
- **Year fabrication is unchanged** (18 wrong years across 96 runs).
- **Latency roughly halved** on both paths (vision 8.8 s → 5.2 s, OCR 6.7 s → 3.8 s).
  This run was the fourth in a row in the same tab, so warm caches may account for some
  of it, but v1x was the third and got slower, not faster. A plausible mechanism is
  that `null` is one token where a fabricated value is several, and constrained
  decoding spends less time exploring. Worth an isolated A/B before claiming it.

Net: **nullable schema is the first change that moved the distractor metric in the right
direction on both paths**, and it cost nothing in the other columns except the
`instrument` wording problem. The prose-rules variants (v1h, pad, padh, v1x) moved
nothing reliably.

## Phase E — instrument wording (`v1n2`), 16 fixtures × vision/ocr × 3

`v1n2` is `v1n` with rule 1 rewritten: *instrument is the ticker symbol shown in a quote
panel (a short all-caps code next to a price); if there is no quote panel it MUST be
null — a company name is NOT an instrument.* Schema unchanged from v1n. Raw runs:
`results/phaseE_v1n2_all16_x3.json`. All 96 parsed.

| path · rules | topic | lang | distractor→change | change ok | price ok | date ok | instr ok | `"null"` str | avg ms |
|---|---|---|---|---|---|---|---|---|---|
| vision · v1n | 40/48 | 47/48 | 1/48 | 41/48 | 47/48 | 35/48 | 19/48 | 2 | 5214 |
| vision · v1n2 | 38/48 | 47/48 | 2/48 | 43/48 | 47/48 | 37/48 | 22/48 | 7 | 5054 |
| ocr · v1n | 33/47 | 33/47 | 0/47 | 25/47 | 45/47 | 30/47 | 9/47 | 1 | 3789 |
| ocr · v1n2 | 30/48 | 30/48 | 0/48 | 31/48 | 40/48 | 32/48 | 12/48 | 3 | 3955 |

**The wording did not produce nulls. It produced invented tickers.** On the 48 no-panel
runs the model wrote `null` (JSON or the word) 7 times and a ticker-shaped code it made
up from the company name 23 times: `HAL`, `HALV`, `HAL.TO`, `LARK`, `LARKSPUR`, `SRY`.
Under v1n the same slots held the company name in plain text, which at least was
visibly not a ticker. Told that a company name is not an instrument, the model kept the
field filled and changed the *format* of the fabrication to match the rule's description
("a short all-caps code"). `instr ok` rose by 3 on each path, entirely from the 7 nulls.

Side effect on the OCR path: `price ok` fell 45 → 40, all on the `battery_ko_panel`
fixtures where price went from `42.15` to `null` in 6/6 runs. The rule's new phrase
"next to a price" appears to have pulled the model into treating the garbled Korean OCR
panel line as not-a-panel, and once the panel was "absent" it nulled price too.

This is the second time in this series that a prose rule aimed at one field moved a
different field (v1h hurt `change ok` on vision, phase B). The nullable schema (phase D)
remains the only change that improved its target metric without a side effect.

**Reading across D and E:** the model will leave a field empty when the schema allows
it *and* the field has an obvious "nothing here" reading (no quote panel → no
change_percent). It will not leave a field empty when there is anything in the input
that could plausibly fill it (a company name → an instrument). Prose does not change
that; it only changes what shape the filler takes. If `instrument` must be null without a
panel, the app should null it in code when its own gate says no panel, exactly as the
hybrid path already does for vision — not ask the model.

## Phase F — latency A/B, `v1x` vs `v1n` interleaved call by call

Phase D's halved latency needed an isolated test. Same 16 fixtures, 3 repeats, `v1x`
and `v1n` alternating on every call (v1x, v1n, v1x, v1n …) so warm-up, thermal and
order effects fall on both equally. Run as two halves in a fresh tab — vision (96
calls) then OCR (96 calls) — after a first attempt crashed the tab at 96/192; the
half-way numbers from that attempt (v1x 5.6 s / v1n 5.9 s vision, 4.3 s / 4.3 s OCR)
agree with the rerun. Raw runs: `results/phaseF_latency_ab_vision_x3.json`,
`results/phaseF_latency_ab_ocr_x3.json`.

| path | v1x mean (median, sd) | v1n mean (median, sd) | paired v1n − v1x | v1n faster in |
|---|---|---|---|---|
| vision | 5383 ms (5014, 1803) | 5307 ms (4690, 1468) | −76 ms (sd 1635) | 18 / 48 |
| ocr | 4031 ms (4051, 521) | 4244 ms (4271, 512) | +212 ms (sd 513) | 18 / 47 |

**No latency effect from the nullable schema.** The "halving" in phase D was run order:
inside each half of this A/B the second 48 calls averaged 600–700 ms faster than the
first 48 (vision 5652 → 5038, OCR 4435 → 3756), with the schema variable balanced.
Phase D was the fourth consecutive run in one tab; phase A was the first. Compare
latencies only within an interleaved run.

The A/B doubles as a replication of phase D's accuracy result, on a fresh tab and a
different call order:

| path · rules | topic | lang | distractor→change | change ok | date ok | instr ok |
|---|---|---|---|---|---|---|
| vision · v1x | 36/48 | 48/48 | 4/48 | 38/48 | 39/48 | 25/48 |
| vision · v1n | 40/48 | 48/48 | **0/48** | **45/48** | 38/48 | 18/48 |
| ocr · v1x | 32/47 | 35/47 | 0/47 | 22/47 | 30/47 | 9/47 |
| ocr · v1n | 32/48 | 33/48 | 0/48 | **29/48** | 30/48 | 9/48 |

Same direction and size as phase D: nullable schema removes the distractor
contamination on the vision path (4 → 0) and lifts `change ok` on both (+7 each), at the
cost of `instrument` on vision (company names where null was meant, see phase E).
That is now two independent runs, 96 + 96 calls, agreeing.

## Phase G — dark-mode fixtures, `v1n`, 16 dark fixtures × vision/ocr × 3

The original real-world failure cases were dark-mode phone captures. Every fixture now
also exists as a dark render (`_dark` suffix; light text on `#121417`, muted grey
metadata, green/red change colour — 32 fixtures total). The OCR path gained the
preprocessing the original probe had: grayscale, then invert when mean luminance is
below 128 (fired on all 16 dark images, luma 27–35; OCR confidence 81–91, same as
light). The vision path gets the untouched image. Raw runs:
`results/phaseG_dark_v1n_x3.json`. A first dark run was discarded: the template had
left `<html>` white, so the PNGs were dark only down to the end of the article and the
inversion never fired.

Light `v1n` rows below pool phase D and the two phase F halves (96 runs per path).

| path · theme | topic | lang | distractor→change | change ok | price ok | date ok | date fab | instr ok | avg ms |
|---|---|---|---|---|---|---|---|---|---|
| vision · light | 80/96 | 95/96 | 1/96 | 86/96 | 95/96 | 73/96 | 22/96 | 37/96 | 5261 |
| vision · dark | 37/48 | 48/48 | 1/48 | 45/48 | 46/48 | 30/48 | 14/48 | 19/48 | 5572 |
| ocr · light | 65/95 | 66/95 | 0/95 | 54/95 | 91/95 | 60/95 | 22/95 | 18/95 | 4019 |
| ocr · dark | 39/48 | 41/48 | 0/48 | 23/48 | 47/48 | **14/48** | **33/48** | 10/48 | 3998 |

**The vision path does not care about dark mode.** Every column is within noise of the
light numbers; `date ok` is a few points lower (62% vs 76%) with the same year-moving
fabrications (`2020-03-14`, `2026-06-02`).

**The OCR path splits.** Two things got *better* on dark with inversion: the quote-panel
gate was right on 16/16 (first time in this series), and the Korean OCR text made the
model translate less (7/24 English headlines vs about 14/24 on light), which lifts
`topic` and `lang`. Two things got much worse: `change ok` halved (23/48) and `date`
collapsed (14/48 correct, 33/48 fabricated).

The date collapse has a mechanical cause. The byline/date line is rendered in muted
grey (`#8b9098`) on dark; after inversion it is light grey on near-white, and
Tesseract drops it — the OCR text for the `battery` fixtures reads `By Tomas Reyes a AM`
with the date gone. The model then fabricates a full timestamp with the year moved.
Inversion is not neutral: it lowers the contrast of anything that was low-contrast by
design. A threshold-based binarisation, or per-line contrast normalisation, would be
the next thing to try on the OCR side — but it is an OCR-engine problem, not a model
one, and the vision path simply reads the grey line correctly.

The `change` misses on dark OCR are model-side: the OCR text has `-4.6%` and `11.8%`
intact, and the model returned `16`, `115%`, `118`, `275` (the distractor `2.75%` with
its point dropped) — number mangling that did not occur on the same fixtures in light
mode, with no obvious difference in the OCR text it was given.

**Bottom line for the original claim:** dark mode is not what made OCR-first win in the
original probe. On dark fixtures the vision path is still better on every numeric and
date field; OCR-first is better only on language compliance for Korean, and only
because inversion happened to help Tesseract's Korean. Whatever made the original
screenshots hard for the vision path is not reproduced by dark colours alone —
candidates left are phone-density type, app chrome around the article, and JPEG
compression of real captures.

## Phase H — adaptive binarisation for dark OCR, 16 dark fixtures × ocr × 3

Replaces whole-image inversion with adaptive binarisation before Tesseract: each pixel
is compared with the mean of a 31 px window (integral image), kept as foreground if it
differs by more than 12 levels, polarity chosen from the global mean so the output is
black-on-white either way. Only the OCR path changes; `v1n` rules and schema as before.
Raw runs: `results/phaseH_dark_ocr_adaptive_v1n_x3.json`. `invert` rows are phase G.

| ocr · dark · preprocess | topic | lang | distractor→change | change ok | price ok | date ok | date fab | instr ok |
|---|---|---|---|---|---|---|---|---|
| invert (phase G) | 39/48 | 41/48 | 0/48 | 23/48 | 47/48 | 14/48 | 33/48 | 10/48 |
| adaptive | 44/48 | 46/48 | 2/48 | 23/48 | 43/48 | **28/48** | **11/48** | 4/48 |

By language, adaptive: en `date ok` 21/24 (invert 6/24), ko 7/24 (8/24). Korean
English-headline rate fell to 2/24, the lowest of any OCR condition in this series
(light v1n about 14/24, dark-invert 7/24). OCR confidence 78–87 vs 81–91 for invert.
The quote-panel gate was right on 15/16 (invert: 16/16).

**What it fixed:** the muted grey byline survives — the OCR text now carries
`By Ingrid Solberg - March 14, 2026 4:12 PM` where inversion had left `By Tomas Reyes a
AM` — so the English date column recovers from 6/24 to 21/24 and fabrication drops by
two thirds. Topic and language also improve, both plausibly from cleaner Korean text.

**What it did not fix:** numbers. `change ok` is unchanged at 23/48 because the
decimal point is still lost (`−4.6%` → `-45%`/`-46%`, `+11.8%` → `1.8`/`11.8`), and
binarisation at this window size slightly hurts small glyphs — `price` slips 47 → 43 and
`instrument` 10 → 4 as the ticker line degrades (`LKSP` → nothing or fragments). Korean
dates stay bad (7/24) because the Korean date line OCRs as `2026년 38 14일 오후 412`
under both preprocessors; the loss there is in Tesseract's `kor` model, not contrast.

Net for the OCR-first design: adaptive binarisation is the right default for dark
input, and the remaining OCR damage is concentrated in decimal points and the Korean
date/ticker lines. That is a Tesseract problem. The vision path reads all of these
correctly on the same images (phase G), which is the standing reason OCR-first does not
beat vision on this benchmark.

## What to change before trusting any of this further

- ~~Take the example numbers out of the rules and re-run.~~ Done (phase C): the leak
  signatures vanish, accuracy does not improve. The open problem is the model filling
  fields that should stay empty; ~~a schema-level fix is the next thing to test~~ —
  done (phase D): nullable `change_percent` fixes the English no-panel cases outright.
- ~~Fix the `instrument` wording now that null is allowed.~~ Done (phase E): the model
  invents ticker-shaped codes instead. Null `instrument` in code when no panel is
  detected; stop trying to get it from the prompt.
- ~~Isolate the latency drop seen with the nullable schema.~~ Done (phase F): no effect;
  it was run order. Never compare latency across separate runs in this harness.
- ~~Add dark-mode fixtures.~~ Done (phase G): vision is unaffected; OCR-first gets
  worse on numbers and dates (inversion kills low-contrast grey text). Still untested:
  phone-density type, an app header line above the article, JPEG compression of real
  captures, and a deck line more quotable than the headline.
- ~~OCR preprocessing: adaptive binarisation.~~ Done (phase H): dates recover (14 → 28),
  fabrication drops (33 → 11), numbers do not move — Tesseract still loses decimal
  points and the Korean date line. Next on the OCR side would be a different engine,
  not more preprocessing.
- **Try `most-predictable` sampling** (Chrome 148 origin-trial preset) to see whether the
  leak and the year fabrication are sampling noise.
- Per-cell sample sizes are 12 or 24. Differences under about 3 runs are noise.
