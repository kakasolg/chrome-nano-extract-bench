#!/usr/bin/env node
// Renders every article × variant combination to fixtures/out/<id>.png and
// writes fixtures/out/labels.json with the ground truth for each image.
//
// No npm dependencies: HTML is written by hand and screenshotted with the
// locally installed Chrome in headless mode. Playwright would be nicer but
// would add a ~300MB download to a repo whose whole point is "open one page".
//
// Usage:
//   node fixtures/generate.mjs             # html + png + labels.json
//   node fixtures/generate.mjs --html-only # skip screenshots (no Chrome needed)
//   CHROME=/path/to/chrome node fixtures/generate.mjs

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ARTICLES, VARIANTS } from "./articles.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "out");
const htmlOnly = process.argv.includes("--html-only");

// Portrait phone-screenshot proportions. Height is a ceiling; the page is
// shorter than this and Chrome crops to the window, so we keep a fixed
// canvas so every fixture has identical pixel dimensions.
const WIDTH = 860;
const HEIGHT = 1500;

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error("Chrome not found. Set CHROME=/path/to/chrome.");
  return hit;
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fmtChange(c) {
  const sign = c > 0 ? "+" : c < 0 ? "−" : "";
  return `${sign}${Math.abs(c).toFixed(1)}%`;
}

function renderHtml(article, lang, panel, subheading, css) {
  const t = article[lang];
  const q = article.quote;
  const quoteBox = panel
    ? `<div class="quote">
        <span class="tk">${esc(q.ticker)}</span>
        <span class="ex">${esc(q.exchange)}</span>
        <span class="px">${esc(q.currency)} ${q.price.toFixed(2)}</span>
        <span class="chg ${q.change_percent >= 0 ? "up" : "down"}">${fmtChange(q.change_percent)}</span>
      </div>`
    : "";
  const deck = subheading ? `<p class="deck">${esc(t.subheading)}</p>` : "";
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="page">
  <div class="outlet">${esc(t.outlet)}</div>
  <h1>${esc(t.headline)}</h1>
  ${deck}
  <div class="meta"><span>${esc(t.byline)}</span><span>${esc(t.date_display)}</span></div>
  ${quoteBox}
  <div class="body">${t.body.map((p) => `<p>${esc(p)}</p>`).join("\n")}</div>
</div></body></html>`;
}

function screenshot(chrome, htmlPath, pngPath) {
  const url = pathToFileURL(resolve(htmlPath)).href;
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${WIDTH},${HEIGHT}`,
      `--screenshot=${resolve(pngPath)}`,
      url,
    ],
    { stdio: "ignore", timeout: 60_000 }
  );
}

function main() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const css = readFileSync(join(here, "templates", "article.css"), "utf8");
  const chrome = htmlOnly ? null : findChrome();

  const labels = [];
  for (const article of ARTICLES) {
    for (const lang of VARIANTS.lang) {
      for (const panel of VARIANTS.panel) {
        for (const subheading of VARIANTS.subheading) {
          const id = `${article.id}_${lang}_${panel ? "panel" : "nopanel"}_${subheading ? "deck" : "nodeck"}`;
          const html = renderHtml(article, lang, panel, subheading, css);
          const htmlPath = join(outDir, `${id}.html`);
          writeFileSync(htmlPath, html);
          if (chrome) screenshot(chrome, htmlPath, join(outDir, `${id}.png`));

          const t = article[lang];
          labels.push({
            id,
            file: `${id}.png`,
            article: article.id,
            variant: { lang, panel, subheading },
            truth: {
              language: lang,
              headline: t.headline,
              // The line a lazy model copies instead of the headline. Null
              // when the variant hides it — then nothing on the page is
              // copyable and the language metric is uncontaminated.
              subheading: subheading ? t.subheading : null,
              published_at: article.truth.published_at,
              instrument: article.truth.instrument,
              price: panel ? article.quote.price : null,
              change_percent: panel ? article.quote.change_percent : null,
              // Always present in the body regardless of variant.
              distractor_percent: article.truth.distractor_percent,
              sentiment: article.truth.sentiment,
              topic: article.truth.topic,
            },
          });
          process.stdout.write(`${chrome ? "png " : "html"} ${id}\n`);
        }
      }
    }
  }

  writeFileSync(
    join(outDir, "labels.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), width: WIDTH, height: HEIGHT, fixtures: labels }, null, 2)
  );
  process.stdout.write(`\n${labels.length} fixtures → ${outDir}\n`);
}

main();
