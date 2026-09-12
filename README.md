# chrome-nano-extract-bench

Reproducible benchmark for structured extraction from screenshots with Chrome's
built-in on-device model (the Prompt API / `LanguageModel`), comparing the
vision path (image → JSON) with an OCR-first path (image → text → JSON).

Status: **fixtures only.** The benchmark page and results come next.

## Fixtures

`fixtures/` renders synthetic news-article screenshots with known ground truth.
All content is fictional (companies, tickers, people, outlets, numbers).

Each of 2 articles is rendered in every combination of three binary variables,
16 images total, `860×1500` PNG:

| variable | values | what it isolates |
|---|---|---|
| `lang` | `en`, `ko` | same facts, different script; output-language compliance |
| `panel` | price quote box present / absent | whether `price` / `change_percent` exist to be read at all; when absent the truth is `null` and a non-null answer is fabrication |
| `subheading` | one-line deck under the headline present / absent | a verbatim-copyable line; when absent, headline copying is structurally impossible and the language metric is uncontaminated |

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
