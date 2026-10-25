/* Year 8 Algebra Question Generator */
'use strict';

const CATEGORIES = [
  { id: 'linear', name: 'Linear equations', hint: 'one- and two-step linear equations such as 3x + 5 = 20, including negative and decimal answers' },
  { id: 'both-sides', name: 'Equations with variables on both sides', hint: 'e.g. 5x - 3 = 2x + 9, including brackets on one or both sides' },
  { id: 'fractions', name: 'Equations involving fractions', hint: 'e.g. (x + 2)/3 = 5 or x/2 + x/3 = 10' },
  { id: 'simultaneous', name: 'Simultaneous equations', hint: 'pairs of linear equations solved by elimination or substitution, integer solutions' },
  { id: 'factorisation', name: 'Factorisation', hint: 'common factors (e.g. 6x + 9, 4x^2 - 8x) and simple quadratics x^2 + bx + c' },
  { id: 'quadratic', name: 'Quadratic equations', hint: 'solve x^2 + bx + c = 0 by factorising, or x^2 = k; integer roots' },
  { id: 'indices', name: 'Exponents / indices', hint: 'laws of indices: multiplying, dividing, powers of powers, zero and negative indices' },
  { id: 'polynomial', name: 'Polynomial questions', hint: 'expanding brackets, collecting like terms, substituting values into polynomials' },
  { id: 'surds', name: 'Radical / surd questions', hint: 'simplifying square roots like sqrt(48), multiplying surds, adding like surds' },
  { id: 'rational', name: 'Rational expressions and equations', hint: 'simplifying algebraic fractions by cancelling common factors, simple equations with x in the denominator' },
  { id: 'exponential', name: 'Exponential equations', hint: 'equations like 2^x = 32 or 3^(x+1) = 81 solvable by writing both sides with the same base' }
];

const STORAGE_KEY = 'y8-algebra-settings';

/* ---------- Pure helpers (also exported for tests) ---------- */

function distribute(total, ids) {
  const out = {};
  const n = Math.max(0, Math.floor(total) || 0);
  if (!ids.length) return out;
  const base = Math.floor(n / ids.length);
  const rem = n % ids.length;
  ids.forEach((id, i) => { out[id] = base + (i < rem ? 1 : 0); });
  return out;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// LLMs often write LaTeX like "\frac" or "\(" inside JSON strings without doubling the
// backslash. "\f" silently becomes a form feed and "\(" is invalid JSON, so double them.
// Letters b/n/r/t/u are also valid JSON escapes, so only treat them as LaTeX for known commands.
const LATEX_JSON_ESCAPE_CMDS = /^(neq|ne|nu|not|newline|nabla|times|text|textbf|theta|tau|tan|to|triangle|therefore|tfrac|right|rho|rangle|rm|beta|begin|bar|boxed|binom|big|bigg|bmatrix|bullet)(?![a-zA-Z])/;
function sanitizeJson(raw) {
  return String(raw).replace(/\\\\|\\([a-zA-Z]+)|\\(?=[()[\]{},;:! ])/g, (m, word, offset, s) => {
    if (m === '\\\\') return m;
    if (word === undefined) return '\\\\';
    if (/^[bnrtu]/.test(word) && !LATEX_JSON_ESCAPE_CMDS.test(word)) return m;
    return '\\\\' + word;
  });
}

function extractJson(raw) {
  const s = String(raw).trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  return start >= 0 && end > start ? s.slice(start, end + 1) : s;
}

function parseQuestions(raw) {
  const text = extractJson(raw);
  let data;
  try { data = JSON.parse(sanitizeJson(text)); } catch (e) { data = JSON.parse(text); }
  const list = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(list)) throw new Error('Response JSON has no "questions" array');
  return list.map((q, i) => {
    if (!q || typeof q.question !== 'string' || !q.question.trim()) throw new Error(`Question ${i + 1} is missing text`);
    const working = Array.isArray(q.working) ? q.working : (q.working ? [q.working] : []);
    return { question: q.question.trim(), answer: String(q.answer ?? '').trim(), working: working.map(w => String(w).trim()).filter(Boolean) };
  });
}

function buildPrompt(cat, count) {
  const nonce = Math.random().toString(36).slice(2, 10);
  return [
    { role: 'system', content: 'You are an experienced UK secondary maths teacher writing practice questions for Year 8 students (age 12-13, KS3). You always reply with valid JSON only.' },
    { role: 'user', content:
`Write exactly ${count} NEW, varied algebra question(s) on the topic "${cat.name}" (${cat.hint}).
Pitch them for a Year 8 student in the UK; keep numbers friendly. Vary difficulty from easier to harder. Avoid textbook clichés. Variety seed: ${nonce}.

For each question give the final answer and full step-by-step working a student could follow. Check every answer (e.g. by substitution) before replying.

Formatting rules:
- Write all mathematics in LaTeX wrapped in \\( ... \\), e.g. \\(\\frac{x+2}{3} = 5\\).
- In JSON strings every backslash must be escaped as \\\\ (so \\frac is written "\\\\frac").
- Do not put line breaks inside strings; use one array item per working step.

Reply with JSON in exactly this shape:
{"questions":[{"question":"...","answer":"...","working":["step 1","step 2"]}]}` }
  ];
}

const PAGE_STYLE = `
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;color:#1d2330;line-height:1.5}
h1{color:#2b4c9b;margin-bottom:.2rem}.meta{color:#5a6378;margin-top:0}
h2{border-bottom:2px solid #2b4c9b;padding-bottom:.2rem;margin-top:2rem;color:#2b4c9b;font-size:1.2rem}
ol{padding-left:1.5rem}li.q{margin:.8rem 0}
.answer{background:#eef5ee;border-left:4px solid #3a8a3a;padding:.4rem .7rem;margin:.4rem 0;font-weight:600}
.working{margin:.3rem 0 .2rem;padding-left:1.4rem;color:#333}.working li{margin:.15rem 0}
.space{height:3.5rem}a{color:#2b4c9b}
@media print{.noprint{display:none}.space{height:5rem}h2{break-after:avoid}li.q{break-inside:avoid}}`;

const KATEX_HEAD = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{delimiters:[{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false},{left:'$$',right:'$$',display:true}],throwOnError:false})"></script>`;

function pageShell(title, meta, body) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>${KATEX_HEAD}
<style>${PAGE_STYLE}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${meta}</p>
${body}
</body>
</html>
`;
}

// sections: [{ category: {name}, questions: [...] }]
function buildQuestionsHtml(sections, dateLabel) {
  let n = 0;
  const body = sections.map(s => `<h2>${escapeHtml(s.category.name)}</h2>
<ol start="${n + 1}">
${s.questions.map(q => { n++; return `<li class="q">${escapeHtml(q.question)}<div class="space"></div></li>`; }).join('\n')}
</ol>`).join('\n');
  return pageShell('Year 8 Algebra – Questions', `${escapeHtml(dateLabel)} · ${n} questions · <a class="noprint" href="answers.html">Answers</a>`, body);
}

function buildAnswersHtml(sections, dateLabel) {
  let n = 0;
  const body = sections.map(s => `<h2>${escapeHtml(s.category.name)}</h2>
<ol start="${n + 1}">
${s.questions.map(q => { n++; return `<li class="q">${escapeHtml(q.question)}
<ol class="working" type="a">${q.working.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ol>
<div class="answer">Answer: ${escapeHtml(q.answer)}</div></li>`; }).join('\n')}
</ol>`).join('\n');
  return pageShell('Year 8 Algebra – Answers & Working', `${escapeHtml(dateLabel)} · ${n} questions · <a class="noprint" href="questions.html">Questions</a>`, body);
}

function buildIndexHtml(manifest) {
  const rows = [...manifest].sort((a, b) => b.id.localeCompare(a.id)).map(e =>
    `<li><strong>${escapeHtml(e.date)}</strong> – ${e.count} questions (${escapeHtml(e.categories.join(', '))})<br>
<a href="${encodeURIComponent(e.id)}/questions.html">Questions</a> · <a href="${encodeURIComponent(e.id)}/answers.html">Answers</a></li>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Year 8 Algebra Worksheets</title><style>${PAGE_STYLE} li{margin:.8rem 0}</style></head>
<body>
<h1>Year 8 Algebra Worksheets</h1>
<p class="meta">${manifest.length} worksheet set(s)</p>
<ul>
${rows || '<li>No worksheets yet.</li>'}
</ul>
</body>
</html>
`;
}

function folderStamp(d) {
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function uniqueId(base, manifest) {
  const ids = new Set(manifest.map(e => e.id));
  if (!ids.has(base)) return base;
  let i = 2;
  while (ids.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function base64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

/* ---------- Network clients ---------- */

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function groqGenerate(apiKey, model, cat, count, log) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: buildPrompt(cat, count),
          temperature: 0.9,
          response_format: { type: 'json_object' }
        })
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) throw Object.assign(new Error('Invalid Groq API key (401)'), { fatal: true });
        if (res.status === 429 || res.status >= 500) {
          const wait = (Number(res.headers.get('retry-after')) || attempt * 3) * 1000;
          log(`  ${cat.name}: Groq ${res.status}, retrying in ${Math.round(wait / 1000)}s…`);
          await sleep(wait);
          lastErr = new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
          continue;
        }
        throw new Error(`Groq ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = await res.json();
      const qs = parseQuestions(data.choices?.[0]?.message?.content ?? '');
      if (qs.length < count) throw new Error(`expected ${count} questions, got ${qs.length}`);
      return qs.slice(0, count);
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
      if (attempt < 3) log(`  ${cat.name}: ${e.message} – retrying…`);
    }
  }
  throw lastErr;
}

async function gh(token, method, url, body) {
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${method} ${url} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// Commits both worksheets plus the updated index in a single commit (Git Data API).
async function pushToGitHub({ token, repo, branch, folder, questionsHtml, answersHtml, entry }, log) {
  folder = folder.replace(/^\/+|\/+$/g, '');
  const ref = await gh(token, 'GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  const parentSha = ref.object.sha;
  const parent = await gh(token, 'GET', `/repos/${repo}/git/commits/${parentSha}`);

  let manifest = [];
  try {
    const file = await gh(token, 'GET', `/repos/${repo}/contents/${folder}/index.json?ref=${encodeURIComponent(branch)}`);
    manifest = JSON.parse(base64ToUtf8(file.content));
  } catch (e) {
    if (e.status !== 404) throw e;
    log('  No existing manifest – creating a new index.');
  }

  const id = uniqueId(entry.id, manifest);
  manifest.push({ ...entry, id });

  const tree = await gh(token, 'POST', `/repos/${repo}/git/trees`, {
    base_tree: parent.tree.sha,
    tree: [
      { path: `${folder}/${id}/questions.html`, mode: '100644', type: 'blob', content: questionsHtml },
      { path: `${folder}/${id}/answers.html`, mode: '100644', type: 'blob', content: answersHtml },
      { path: `${folder}/index.json`, mode: '100644', type: 'blob', content: JSON.stringify(manifest, null, 2) + '\n' },
      { path: `${folder}/index.html`, mode: '100644', type: 'blob', content: buildIndexHtml(manifest) }
    ]
  });
  const commit = await gh(token, 'POST', `/repos/${repo}/git/commits`, {
    message: `Add Year 8 algebra worksheet ${id}`,
    tree: tree.sha,
    parents: [parentSha]
  });
  await gh(token, 'PATCH', `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha });
  return { id, commitUrl: commit.html_url, folder };
}

/* ---------- UI ---------- */

function initUI() {
  const $ = id => document.getElementById(id);
  const els = {
    groqKey: $('groqKey'), model: $('model'), ghToken: $('ghToken'), ghRepo: $('ghRepo'),
    ghBranch: $('ghBranch'), ghFolder: $('ghFolder'), remember: $('remember'), total: $('total'),
    cats: $('categories'), hint: $('distHint'), log: $('log'), preview: $('preview'), previewCard: $('previewCard')
  };
  const state = { questionsHtml: '', answersHtml: '', entry: null, tab: 'q' };

  els.cats.innerHTML = CATEGORIES.map(c =>
    `<label><input type="checkbox" value="${c.id}" checked> ${escapeHtml(c.name)} <span class="count" data-count="${c.id}"></span></label>`).join('');
  const boxes = () => [...els.cats.querySelectorAll('input[type=checkbox]')];
  const selectedIds = () => boxes().filter(b => b.checked).map(b => b.value);

  function updateHint() {
    const ids = selectedIds();
    const dist = distribute(Number(els.total.value), ids);
    els.cats.querySelectorAll('[data-count]').forEach(s => {
      const v = dist[s.dataset.count];
      s.textContent = v === undefined ? '' : `×${v}`;
    });
    const zero = ids.filter(id => dist[id] === 0).length;
    els.hint.textContent = ids.length
      ? `${Number(els.total.value) || 0} question(s) across ${ids.length} topic(s).` + (zero ? ` ${zero} topic(s) will get none – increase the total.` : '')
      : 'Select at least one topic.';
  }

  const FIELDS = ['groqKey', 'model', 'ghToken', 'ghRepo', 'ghBranch', 'ghFolder', 'total'];
  function save() {
    if (!els.remember.checked) { localStorage.removeItem(STORAGE_KEY); return; }
    const data = { selected: selectedIds() };
    FIELDS.forEach(f => { data[f] = els[f].value; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data) return;
      FIELDS.forEach(f => { if (data[f] !== undefined && data[f] !== '') els[f].value = data[f]; });
      if (Array.isArray(data.selected)) boxes().forEach(b => { b.checked = data.selected.includes(b.value); });
    } catch { /* ignore corrupt settings */ }
  }

  const log = msg => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    els.log.textContent += `[${time}] ${msg}\n`;
    els.log.scrollTop = els.log.scrollHeight;
  };

  function showPreview() {
    els.previewCard.hidden = false;
    els.preview.srcdoc = state.tab === 'q' ? state.questionsHtml : state.answersHtml;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
  }

  function download(name, html) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setOutputsEnabled(on) {
    ['dlQuestions', 'dlAnswers', 'pushBtn'].forEach(id => { $(id).disabled = !on; });
  }

  async function generate() {
    const key = els.groqKey.value.trim();
    const ids = selectedIds();
    const total = Number(els.total.value);
    els.log.textContent = '';
    if (!key) return log('⚠️ Please enter your Groq API key.');
    if (!ids.length) return log('⚠️ Please select at least one topic.');
    if (!(total >= 1 && total <= 100)) return log('⚠️ Total questions must be between 1 and 100.');
    save();

    const dist = distribute(total, ids);
    const cats = CATEGORIES.filter(c => dist[c.id] > 0);
    $('generateBtn').disabled = true;
    setOutputsEnabled(false);
    log(`Generating ${total} question(s) across ${cats.length} topic(s) with ${els.model.value}…`);

    try {
      const sections = [];
      for (const [i, cat] of cats.entries()) {
        log(`(${i + 1}/${cats.length}) ${cat.name}…`);
        try {
          const questions = await groqGenerate(key, els.model.value, cat, dist[cat.id], log);
          log(`✓ ${cat.name}: ${questions.length}`);
          sections.push({ category: cat, questions });
        } catch (e) {
          if (e.fatal) throw e;
          log(`✗ ${cat.name}: ${e.message}`);
        }
      }

      if (!sections.length) throw new Error('No questions were generated.');
      const now = new Date();
      const dateLabel = now.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
      state.questionsHtml = buildQuestionsHtml(sections, dateLabel);
      state.answersHtml = buildAnswersHtml(sections, dateLabel);
      const count = sections.reduce((s, x) => s + x.questions.length, 0);
      state.entry = { id: folderStamp(now), date: dateLabel, count, categories: sections.map(s => s.category.name) };
      log(`Done: ${count} question(s) generated.${sections.length < cats.length ? ' Some topics failed – see above.' : ''}`);
      setOutputsEnabled(true);
      state.tab = 'q';
      showPreview();
    } catch (e) {
      log(`✗ ${e.message}`);
    } finally {
      $('generateBtn').disabled = false;
    }
  }

  async function push() {
    const token = els.ghToken.value.trim();
    const repo = els.ghRepo.value.trim();
    if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      log('⚠️ Enter a GitHub token and repository (owner/name) under "GitHub publishing".');
      document.querySelector('details').open = true;
      return;
    }
    save();
    $('pushBtn').disabled = true;
    log(`Pushing to ${repo}@${els.ghBranch.value}…`);
    try {
      const r = await pushToGitHub({
        token, repo, branch: els.ghBranch.value.trim() || 'main', folder: els.ghFolder.value.trim() || 'worksheets',
        questionsHtml: state.questionsHtml, answersHtml: state.answersHtml, entry: state.entry
      }, log);
      const [owner, name] = repo.split('/');
      const site = name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? `https://${name.toLowerCase()}` : `https://${owner.toLowerCase()}.github.io/${name}`;
      log(`✓ Committed: ${r.commitUrl}`);
      log(`  Live in ~1 min: ${site}/${r.folder}/${r.id}/questions.html`);
      log(`  Index: ${site}/${r.folder}/`);
    } catch (e) {
      log(`✗ ${e.message}`);
      $('pushBtn').disabled = false;
    }
  }

  load();
  updateHint();
  els.total.addEventListener('input', () => { updateHint(); save(); });
  els.cats.addEventListener('change', () => { updateHint(); save(); });
  $('selectAll').onclick = () => { boxes().forEach(b => { b.checked = true; }); updateHint(); save(); };
  $('selectNone').onclick = () => { boxes().forEach(b => { b.checked = false; }); updateHint(); save(); };
  FIELDS.forEach(f => els[f].addEventListener('change', save));
  els.remember.addEventListener('change', save);
  $('forgetBtn').onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    els.groqKey.value = ''; els.ghToken.value = '';
    log('Saved keys cleared from this browser.');
  };
  $('generateBtn').onclick = generate;
  $('dlQuestions').onclick = () => download('questions.html', state.questionsHtml);
  $('dlAnswers').onclick = () => download('answers.html', state.answersHtml);
  $('pushBtn').onclick = push;
  document.querySelectorAll('.tab').forEach(t => { t.onclick = () => { state.tab = t.dataset.tab; showPreview(); }; });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initUI);
}

if (typeof module !== 'undefined') {
  module.exports = {
    CATEGORIES, distribute, sanitizeJson, parseQuestions, buildPrompt, buildQuestionsHtml,
    buildAnswersHtml, buildIndexHtml, folderStamp, uniqueId, utf8ToBase64, base64ToUtf8, escapeHtml,
    groqGenerate, pushToGitHub
  };
}

