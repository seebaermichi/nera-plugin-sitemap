# Work log — 01a1260d-9038-71ac-85ef-772486490e43-nera-plugin-sitemap-sitemap-xml-plugin

- **Issue:** `01a1260d-9038-71ac-85ef-772486490e43`

## Issue snapshot (2026-10-11)

- **Id:** `01a1260d-9038-71ac-85ef-772486490e43`
- **Type:** feature
- **Group:** Parallel: themes and plugins
- **Status:** in_progress
- **Title:** [nera-plugin-sitemap] sitemap.xml plugin
- **External ref:** roadmap-ai/l8/sitemap

Spec: `nera-cli/ROADMAP-ai.md` — L8.

New repo with its own ROADMAP; add to PLUGINS.md and the website catalogs (3 languages) on release.

## Decision (2026-10-11)

**D1 — getAssets + `.nera-cache/sitemap/`.** `getMetaData` would miss pages added by plugins ordered later; `getAssets` runs after all of them with final data (setup-plugins.js:240). Writing to `public/` directly is lost (core deletes it). Cost: needs core ≥ 4.13.0, enforced by the code-blocks guard.

**D2 — href verbatim, origin from app.origin else canonical-links app_origin.** Rewriting `/index.html` → `/` would contradict canonical-links (which emits `origin + meta.href`), and Google treats conflicting canonical/sitemap URLs as a weak signal. Same origin precedence as canonical-links and nera-validate's output pass. base_path: core keeps `meta.href` logical and rewrites only rendered HTML/CSS, so the plugin prefixes `app.basePath` (already normalised by core) itself. Without origin no relative-URL sitemap — the protocol requires absolute URLs.

**D3 — page selection.** Core only renders pages with `layout`, so others would 404. `sitemap: false` and `robots: noindex` are the common frontmatter opt-outs; config `exclude` handles e.g. `/404.html` without a glob dependency (simple `*` matcher). Sort by href → deterministic.

**D4 — lastmod from frontmatter only.** `meta.createdAt` falls back to file birthtime (core.js), which CI stamps uniformly → wrong lastmod everywhere. Core parses frontmatter with the YAML `core` schema, so dates are strings; a `Date` instance therefore signals the fallback and is skipped. Alternative of always omitting lastmod loses real value for blogs. changefreq/priority dropped: Google ignores them.

**D5 — no hreflang alternates in 1.0.** Would need canonical-links' `page_identifier` matching; separate URLs per language are valid without it. Carried forward.

**D6 — robots.txt on by default, site file wins.** A missing robots.txt is common on Nera sites; an allow-all + Sitemap line is harmless. Core copies site assets after plugin assets, so a site's own file always wins — the plugin just warns when it lacks the pointer. Alternative (append to the site's file) rejected: it would mean rewriting a user-authored file.

**D7 — three config keys.** Smallest useful surface; every key has a fallback so no config file is needed.

## Carry forward (2026-10-11)

- design · M · src/sitemap.js — hreflang `xhtml:link` alternates for multilingual sites — needs canonical-links identifier matching; not required by L8
- design · S · src/sitemap.js — sitemap index when > 50 000 URLs / 50 MB — no Nera site comes close; warn only for now
- infra · S · ../generator/PLUGINS.md, ../nera-website/pages/{,de/,es/}plugins/index.md — catalog entries — other repos, after the maintainer's 1.0.0 publish
- infra · S · ../nera-cli/ROADMAP-ai.md — mark L8 sitemap done — at reconciliation

## Step 1 — started (2026-10-11)

base_sha: de3f8259a5982cfe53a7167263833ecb3f43d3ec
mode: fresh

## Decision (2026-10-11)

D4 premise wrong (core 4.15.1 frontmatter uses `customTags: ['timestamp']`, so unquoted dates are `Date`s and `meta.createdAt` may be birthtime) — which lastmod rule? → Drop createdAt: `lastmod` → `updatedAt` → `date`, `Date` or string both accepted, `meta.createdAt` never used (the plugin cannot tell an authored `createdAt` from core's birthtime fallback; simple and never wrong).

## Step 1 — implemented (2026-10-11)

base_sha: de3f825

### Changed
- `ROADMAP.md` — new: the plugin's spec. Problem, goal, verified facts (core 4.15.1), D1–D7, config reference + validation table, XML contract, slices 1–7 mirroring the plan, open items O1–O4, semver notes, acceptance criteria.
- `plans/issues/…-sitemap-xml-plugin.md` — plan header D4 and Step 3's Verify/Review lines brought in line with the logged D4 decision (the plan is untracked, so this does not show in `git diff`).

### Fixed alongside
- none

### Carry forward
- bug · S · `../nera-plugin-canonical-links/index.js:63` — canonical URLs are `${origin}${meta.href}` without `app.basePath`, so they differ from the sitemap on a `base_path` site — unrelated repo (ROADMAP O3)
- infra · S · `../nera-cli/ROADMAP-ai.md:402` — L8 should point to this ROADMAP — other repo, part of the Step 7 release handover

### Verification
```
test -f ROADMAP.md && grep -c '^### D' ROADMAP.md → 7
```
Fact checks run against `../generator` (HEAD 147b00a, 4.15.1):
```
yaml.parse('date: 2026-01-02 …', {schema:'core',customTags:['timestamp'],merge:true,uniqueKeys:false}) → date: 2026-01-02T00:00:00.000Z (Date), quoted → '2026-01-02' (string)
npm view @nera-static/plugin-sitemap version → npm error 404 Not Found
```
Sources: `src/setup-plugins.js:230-264` (getAssets order, validateAsset), `src/index.js:56-86` (delete → html → theme → plugin → site assets → rewriteAssetUrls → hash), `src/render.js:127-155` (rewrite only .css/.webmanifest/.json), `:178` (hash only .html/.htm), `:481` (layout check), `src/core.js:7-14` (frontmatter options), `:200-240` (createdAt fallback, logical href), `:87-114` (computeFolders theme probe).

### Self-critique
- The plan's D4 rested on a wrong fact (frontmatter dates as strings). Asked the user; they chose to drop `createdAt` from the chain. Logged as a Decision and written into ROADMAP D4 and the plan header.
- I added details the plan left open, for later steps to implement: `exclude` semantics (anchored, `*` crosses `/`), dedupe by href, the lastmod output format (UTC-midnight `Date` → `YYYY-MM-DD`, else ISO without ms, W3C strings verbatim), the invalid-config table (single-string `exclude`, `output` fallback with warning), a warning when the 50 000-URL cap is exceeded (O2), and running the core guard in `getAppData`, since `getAssets` is never called on an old core. Each is small, but each is a spec choice the reviewer should accept or reject now.
- Least sure: D6's "skip the entry when the site has its own robots.txt" plus the `base_path` caveat (on a subdirectory deploy, crawlers never read the generated robots.txt). It's correct, but it may be worth a sentence more in the README.
- O4 (a theme package's robots.txt gets overwritten by the plugin's) is real per the copy order. I recorded it rather than designed for it.

### Pressure-test questions for the reviewer
1. Does the `getAppData` placement of the core guard hold, given that a site where this plugin is the only one with hooks still gets `getAppData` called on core < 4.13? (Check `setup-plugins.js` on an old core, not just 4.15.)
2. Is the D4 date formatting right for a `Date` with a non-midnight time in a non-UTC author timezone? (YAML timestamps without an offset are UTC.)
3. Are the extra spec details listed above acceptable as decided, or should any go back to the user?

## Step 1 — reviewed (2026-10-11)

Verdict: approve

### 🔴 Blocking
- none

### Fixed in review
- `ROADMAP.md:85` — D3's noindex rule now uses the effective robots value (frontmatter `robots`, else `app.robots`), matching the `nera new` layout's `meta(name="robots" content=meta.robots || app.robots)` (`../nera-cli/template/theme/views/layouts/layout.pug:11`, `config/app.yaml:3`). Without it a site with `robots: noindex` in app.yaml (staging) would list every noindex page in its sitemap. `ROADMAP.md:151` lists the app.yaml keys read. `test -f ROADMAP.md && grep -c '^### D' ROADMAP.md` → 7

### Fixed alongside
- none

### Carry forward
- none (the implementer's two carry-forwards stand; not logged again)

### Checked
Goal (problem, facts, D1–D7, config, XML, slices 1–7, O1–O4 incl. hreflang + 50 000 cap) · Verify → 7 · every verified fact re-checked against ../generator HEAD 147b00a (4.15.1): setup-plugins.js getAssets step 6 + validateAsset, index.js delete → html → theme → plugin → site → rewriteAssetUrls → hash, render.js rewrite only .css/.webmanifest/.json and hashing only .css/.html/.htm, layout check render.js:481, core.js FRONTMATTER_OPTIONS + createdAt fallback + logical href, computeFolders theme/assets switch; canonical-links origin order + trim (index.js:16-22) and missing basePath (:63); validate output.js:111-125 origin order; `.nera-cache` in nera-cli template `_gitignore`; L8 in ROADMAP-ai.md:401 has no pointer yet (carried) · Non-negotiables + Framework correctness (lastmod never from birthtime, base_path, escaping, determinism, multilingual decided) · self-critique claims · UI walkthrough n/a (none)

### Answers to the pressure-test questions
1. Yes. `git show v4.12.0:src/setup-plugins.js:206-215` calls (and awaits) `getAppData` for every plugin that exports it, independent of other hooks, so the guard in `getAppData` fires on core < 4.13; `getAssets` is never looked up there. A thrown error is not caught by setup-plugins (no try around the hook loop), so the build fails loudly. code-blocks' `src/guard.js` passes an unknown version, which is acceptable.
2. Yes. With `TZ=Europe/Berlin`, yaml 2 + core's options give `2026-10-01 09:30:00` → `09:30:00.000Z`, `…T09:30:00+02:00` → `07:30:00.000Z`, `2026-10-01` → `00:00:00.000Z`: offset-less timestamps are UTC and host-TZ independent, and `toISOString()` without ms + `Z` is valid W3C Datetime. Only edge: an authored `T02:00:00+02:00` becomes UTC midnight and is written date-only (`2026-10-01`) — still the correct UTC day, acceptable.
3. Acceptable as decided: anchored `*`-crosses-`/` exclude, dedupe by href, lastmod formats, invalid-config table, 50 000 warning and the guard in `getAppData` each have one obvious outcome and no user-visible trade-off; none needs the user. D6's base_path caveat is already slated for the README (Slice 7).

## Step 1 — approved (2026-10-11)

snagio: ticked
commit: 29a3ef0

## Step 2 — started (2026-10-11)

base_sha: 29a3ef0cb43fd3ad2fc1d36b1f1d73e2a8d42752
mode: fresh

## Step 2 — implemented (2026-10-11)

base_sha: 29a3ef0

### Changed
- `package.json` — `@nera-static/plugin-sitemap` 1.0.0, ESM, `files` [index.js, src, CHANGELOG.md], engines `^20.19.0 || >=22.0.0`, peer core `>=4.13.0`, dep plugin-utils `^1.6.1`, devDeps core `^4.15.1`/eslint/husky/vitest (versions as code-blocks), `prepare: husky`
- `package-lock.json` — generated with Node 22.22.0 / npm 10.9.4; committed in this step, before any `npm ci` run
- `.github/workflows/publish.yml` — byte-identical copy of code-blocks
- `.github/workflows/test.yml` — copy of code-blocks; only the Node-matrix comment changed (it named cheerio, which this plugin does not use; now names core's floor)
- `.husky/pre-commit`, `.husky/pre-push`, `LICENSE`, `eslint.config.js` — identical copies of code-blocks (`prepare` works since `.husky/` exists; `.husky/_` is self-ignored)
- `.gitignore` — gains `.nera-cache/` (`node_modules/` was already there)
- `index.js` — placeholder synchronous `getAppData` (returns `app`) and `getAssets` (returns `[]`), header comment states they are placeholders until slices 3–4
- `test/index.test.js` — smoke test: both hooks exported, not async, right return shapes
- `ROADMAP.md` — slice 2 ticked with a dated "Done" note

### Fixed alongside
- none

### Carry forward
- none

### Verification
```
PATH=~/.nvm/versions/node/v22.22.0/bin:$PATH npx vitest run → Test Files 1 passed (1) / Tests 3 passed (3)
npm run lint → eslint . (exit 0, no output)
npx vitest run under default Node 20.20.0 → passes too (pre-commit hook uses the shell's node)
npm pack --dry-run → 3 files (LICENSE, package.json, index.js); README/CHANGELOG/src arrive in later steps
```

### Self-critique
- Kept `getAppData` even though it does nothing yet: ROADMAP D1/§guard puts the core-version guard there, so the export shape is final now.
- `files` lists `src` and `CHANGELOG.md` before they exist — npm ignores missing entries, and it avoids touching `files` again in steps 3/7. No `config/` shipped (ROADMAP: no views, config doc lives in README).
- Least sure: whether `test.yml` should stay byte-identical including the stale cheerio comment; I chose an honest comment (CLAUDE.md says the variants differ only in that comment).
- The `constructor.name === 'Function'` check is a cheap guard against an `async` hook slipping in later.

### Pressure-test questions for the reviewer
1. `diff ../nera-plugin-code-blocks/.github/workflows/publish.yml .github/workflows/publish.yml` — empty?
2. Does `npm ci` succeed from the committed lockfile (`rm -rf node_modules && npm ci`)?
3. Is `^4.15.1` for the core devDependency right vs. code-blocks' `^4.14.0` (latest is 4.15.1, which the ROADMAP facts were checked against)?

## Step 2 — reviewed (2026-10-11)

Verdict: approve

### 🔴 Blocking
- none

### Fixed in review
- none

### Fixed alongside
- none

### Carry forward
- none

### Checked
goal (installable, lint-clean, testable 1.0.0 scaffold with CI + lockfile) · `rm -rf node_modules && npm ci` + `npx vitest run` (1 file / 3 tests passed) + `npm run lint` (exit 0) under Node 22.22.0 / npm 10.9.4 · diff of every copied file against code-blocks · `npm pack --dry-run` (LICENSE, index.js, package.json) · Non-negotiables + Framework correctness (ESM, engines `^20.19.0 || >=22.0.0`, peer core `>=4.13.0`, synchronous hooks with right shapes, no new runtime dep beyond plugin-utils, eslint style) · self-critique claims (all confirmed) · walkthrough n/a (`none`)

### Answers to the pressure-test questions
1. Yes — `diff ../nera-plugin-code-blocks/.github/workflows/publish.yml .github/workflows/publish.yml` is empty; `eslint.config.js`, `LICENSE`, `.husky/pre-commit`, `.husky/pre-push` are identical too. `test.yml` differs only in lines 16–17, the Node-matrix comment (cheerio → core's `^20.19.0 || >=22.0.0` floor), which is accurate for this plugin and the kind of variant CLAUDE.md calls cosmetic.
2. Yes — `rm -rf node_modules && npm ci` from the committed lockfile (lockfileVersion 3) succeeds, "found 0 vulnerabilities", and the suite then passes.
3. Yes — `npm view @nera-static/core version` → 4.15.1; a devDependency at the current latest is right for a new package (consumers never install it; the peer range `>=4.13.0` is what carries the contract). plugin-utils `^1.6.1` matches latest 1.6.1 and code-blocks; eslint/husky/vitest ranges match code-blocks exactly.

## Step 2 — approved (2026-10-11)

snagio: ticked
