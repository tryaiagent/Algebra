# Year‑8 Algebra Question Generator — Plan

## Problem
A static, GitHub‑Pages‑hosted HTML app (repo `tryaiagent/tryaiagent.github.io`) that uses the Groq LLM to generate fresh UK Year‑8 algebra questions, producing two standalone HTML files — **questions.html** and **answers.html** (with full step‑by‑step working) — which can be downloaded and also committed to the repo via the GitHub REST API.

## Decisions (confirmed with user)
- **Question count**: a number input = *total* questions, distributed evenly across selected categories (remainder spread round‑robin; min 1 per category if total ≥ selected count). Default total = 2 × number of categories (22).
- **Categories** (11 checkboxes, all checked by default, plus Select all / none): Linear equations; Variables on both sides; Equations with fractions; Simultaneous equations; Factorisation; Quadratic equations; Exponents/indices; Polynomials; Radicals/surds; Rational expressions & equations; Exponential equations.
- **Groq key**: entered in page, stored in `localStorage` (with "forget key" button). Calls `https://api.groq.com/openai/v1/chat/completions` directly from the browser.
- **GitHub push**: Personal Access Token (fine‑grained, contents:write on the repo) entered in page, stored in `localStorage`. Uses Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`).
- **Target**: repo `tryaiagent/tryaiagent.github.io`, branch `main`, path `worksheets/YYYY-MM-DD_HHMM/questions.html` & `answers.html`, plus auto‑updated `worksheets/index.html` listing all sets (newest first).
- **Download**: buttons to download both files locally (Blob + `<a download>`).

## Assumptions (adjust if wrong)
- App lives at `algebra/index.html` in the repo (served at `https://tryaiagent.github.io/algebra/`); developed locally in `MathsAlgebra/`.
- Model: `llama-3.3-70b-versatile` default, with a dropdown for other Groq models.
- Maths rendered with KaTeX (CDN) using `\( … \)` delimiters; LLM instructed to emit LaTeX.
- Repo/branch/folder shown as editable fields pre‑filled with the defaults above.

## Approach / Architecture
Files in `MathsAlgebra/` (copied into the repo's `algebra/` folder):
- `index.html` — UI (settings, categories, count, generate/download/push buttons, preview tabs, status log).
- `app.js` — logic, split into small modules/sections:
  - **config**: categories with Year‑8‑appropriate descriptions/difficulty hints.
  - **distribute(total, categories)** → per‑category counts.
  - **groq client**: one request per category (run in parallel, limited concurrency, retry once on 429/parse failure). Uses `response_format: {type: "json_object"}` and a strict prompt returning `{questions:[{question, answer, steps:[...]}]}`; temperature ~0.9 + random seed/nonce for variety.
  - **validation**: check JSON shape/counts; escape HTML; keep LaTeX.
  - **renderers**: build self‑contained `questions.html` and `answers.html` strings (inline CSS, KaTeX CDN, print‑friendly, numbered and grouped by category, title/date header, link between the two).
  - **download** helper.
  - **github client**: get SHA if file exists, base64(UTF‑8) encode, PUT files; fetch/parse/regenerate `worksheets/index.html` (keep a `worksheets/index.json` manifest as the source of truth to avoid HTML parsing).
- `styles.css` — app styling.
- `README.md` — setup: getting a Groq key, creating a fine‑grained PAT, deploying to GitHub Pages, security note (keys live in your browser only).

## Todos
1. scaffold-ui — index.html + styles.css with all controls, defaults, localStorage persistence.
2. categories-distribution — category config + distribution function.
3. groq-client — prompt design, parallel calls, JSON validation, retry, error reporting.
4. output-renderers — questions.html & answers.html generators with KaTeX + working steps; preview in app.
5. download — download both files.
6. github-push — Contents API commit of both files + manifest/index update.
7. readme — setup & security docs.
8. verify — open locally in browser, test generation with a real key (user‑supplied), test distribution edge cases, test push against repo (or dry‑run).

## Notes / Risks
- Browser‑stored tokens are visible to anyone with access to that browser; use a fine‑grained PAT scoped to just this repo.
- Groq CORS: confirmed allowed for browser calls historically; if blocked, fallback would need a proxy (out of scope unless needed).
- GitHub Pages rebuild takes ~1 min after push before new worksheet URLs are live.
- LLM may produce wrong answers; prompt asks the model to self‑verify by substitution, but output should be teacher‑reviewed.

