# chrome-nano-extract-bench

Reproducible benchmark for structured extraction from screenshots with Chrome's
built-in on-device model (the Prompt API / `LanguageModel`), comparing the
vision path (image → JSON) with an OCR-first path (image → text → JSON).

Status: **thirteen phases, 1584 runs.** Full write-up in [RESULTS.md](RESULTS.md).

Earlier companion: [ondevice-summarizer-bench](https://github.com/kakasolg/ondevice-summarizer-bench) — the live demo
and the first reliability run that found the vision path and non-English screenshots as the weak spots measured here.

## What this measures, and what it found

This is a set of paired measurements on Chrome's *shipped* on-device model (Chrome 152
stable), not a new technique. The two remedies that worked are both known in general
form; what did not exist was numbers for them on this model, alongside the things that
did not work.

**Worked, measured here**

- **Nullable schema beats prose rules for leaving a field empty.** With
  `type: ["string", "null"]` the no-panel `change_percent` becomes `null`; with the
  same instruction in prose it becomes `0`, the nearest number in the text, or a
  format example from the prompt. Replicated in an interleaved A/B. The idea is standard
  advice (Willison, *LLM schemas*; freeCodeCamp, *reliable structured data*), given
  there without measurements.
- **A native-resolution crop, re-asked for the small-text fields, recovers what the
  downscaled full page loses.** Date 35 → 83 of 96, ticker 42 → 92, change 81 → 96,
  price 91 → 96, on phone-density fixtures, for one extra ~1 s call. The Prompt API
  resizes every image to one fixed size ([prompt-api #84](https://github.com/webmachinelearning/prompt-api/issues/84));
  [prompt-api #133](https://github.com/webmachinelearning/prompt-api/issues/133) (open,
  Chrome staff) proposes a resize-or-tile option for exactly this reason and carries no
  data. Phases K–M are that data. The crop/zoom remedy itself is established VLM
  practice — the *resolution curse* write-up, V\*, CropVLM, Dragonfly.

**Did not work, measured here** (not reported elsewhere as far as I could find)

- OCR-first (Tesseract → model) never beat the vision path on numbers under any
  condition tried: light, dark, dense, framed. It loses decimal points, the Korean
  date line, and small tickers, and noisy Korean OCR text makes the model translate.
- Prompt-rule variants (headline rule, inert padding, removing format examples,
  "a company name is not a ticker") moved nothing reliably, and each one that targeted
  one field disturbed another.
- Format examples in the rules leak verbatim into outputs (`+2.34`, seconds `:28`);
  removing them stops the leak and does not improve accuracy.
- `samplingMode: "most-predictable"` is deterministic and changes nothing: the wrong
  years and filled-in zeros are the model's argmax, not sampling noise. (It also works
  on Chrome 152 without an origin-trial token, contrary to the docs.)

**Related work that is not this**

- [thiagotigaz/ocr-it](https://github.com/thiagotigaz/ocr-it) benches Tesseract,
  PaddleOCR, EasyOCR, RapidOCR, Qwen-VL and Gemini Nano on *transcription* CER over 24
  synthetic English samples. Different task; consult it for raw OCR quality.

## Run it

Hosted: **https://kakasolg.github.io/chrome-nano-extract-bench/** — open it in desktop
Chrome 148+ with the on-device model available (`LanguageModel.availability()` returns
`available`); the page checks and says so at the top. Everything runs in your tab;
nothing is sent anywhere.

Locally:

```bash
python -m http.server 8765      # any static server; file:// blocks fetch of labels.json
# open http://127.0.0.1:8765/
```

Pick paths, rule variants and fixtures, press Run, then Export JSON into `results/` and
summarise with `node scripts/summarize.mjs results/<file>.json --by=lang,panel --fails`.

## Fixtures

`fixtures/` renders synthetic news-article screenshots with known ground truth.
All content is fictional (companies, tickers, people, outlets, numbers).

Each of 2 articles is rendered in every combination of five binary variables,
64 images total, `860×1500` PNG:

| variable | values | what it isolates |
|---|---|---|
| `lang` | `en`, `ko` | same facts, different script; output-language compliance |
| `panel` | price quote box present / absent | whether `price` / `change_percent` exist to be read at all; when absent the truth is `null` and a non-null answer is fabrication |
| `subheading` | one-line deck under the headline present / absent | a verbatim-copyable line; when absent, headline copying is structurally impossible and the language metric is uncontaminated |
| `theme` | `light`, `dark` | dark = light text on near-black, as phone news apps render at night; the OCR path binarises (adaptive) or inverts dark images before Tesseract, selectable |
| `frame` | `none`, `phone` | phone = status bar and a Korean app nav bar above the article, denser type — the shape of the real captures |

Every article body also carries a **distractor percentage** (an inflation print
or a policy rate) that is not the price change. `change_percent` must not be
filled from it.

Regenerate:

```bash
node fixtures/generate.mjs             # html + png + labels.json (uses local Chrome headless)
node fixtures/generate.mjs --html-only # no Chrome needed
CHROME=/path/to/chrome node fixtures/generate.mjs
```

No npm dependencies. Output goes to `fixtures/out/` with `labels.json` holding
the per-image truth. Add articles in `fixtures/articles.mjs`; each needs both
languages with identical facts.

## License

Code: MIT. Fixture images and results: CC BY 4.0.
