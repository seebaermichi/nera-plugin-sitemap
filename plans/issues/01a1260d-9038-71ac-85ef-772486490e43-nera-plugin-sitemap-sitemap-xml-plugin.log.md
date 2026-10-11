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
commit: 86f8939

## Step 3 — started (2026-10-11)

base_sha: 86f89396557a59c065cf87b97f079c73c0ab3d71
mode: fresh

## Step 3 — implemented (2026-10-11)

base_sha: 86f89396557a59c065cf87b97f079c73c0ab3d71

### Changed
- `src/urls.js` — `trimOrigin`, `joinUrl` (origin + basePath + href verbatim, D2), `escapeXml` (all five chars), `matchesPattern`/`isExcluded` (`*` glob, anchored, regex chars literal, D3)
- `src/sitemap.js` — `toLastmod`/`pickLastmod` (D4: lastmod → updatedAt → date, createdAt never; UTC-midnight Date → `YYYY-MM-DD`, other Date → ISO without ms, W3C strings verbatim, anything else dropped), `isListed` (D3: layout + string href, `sitemap: false`, `noindex` from `meta.robots || app.robots` case-insensitive, exclude), `buildSitemap` (dedup by href, plain string sort, documented XML shape, empty `<urlset>` when nothing listable)
- `test/urls.test.js`, `test/sitemap.test.js` — 34 new unit tests (escaping, basePath, every exclusion path, junk entries, lastmod order/format, sort/dedup, determinism, multilingual without hreflang)
- `ROADMAP.md` — slice 3 ticked with a done note (signature incl. `robots`, duplicate rule, exclude expects strings)

### Fixed alongside
- none

### Carry forward
- none

### Verification
```
npx vitest run → Test Files  3 passed (3) / Tests  37 passed (37)
npm run lint → eslint . (no output, exit 0)
```

### Self-critique
- `buildSitemap` takes a fourth option `robots` (the site default `app.robots`) not named in the plan's signature — D3 requires it and the builder has no `app`; slice 4 passes `app.robots`.
- The W3C regex checks field ranges but not calendar validity (`2026-02-31` passes as a string). Rejected a `Date.parse` cross-check: it would reject/accept differently across forms (`YYYY` alone) for little gain; authored strings are verbatim per D4.
- Duplicate hrefs: first entry in `pagesData` order wins, so byte-identity with duplicates relies on core's page order being stable; duplicates are an anomaly (two plugins generating the same page).
- `matchesPattern` throws on a non-string pattern; normalization is slice 4's job (ROADMAP config table: non-strings dropped). A regex is compiled per page × pattern — fine at site scale.
- `noindex` is a substring test (`/noindex/i`), as D3 says "contains".

### Pressure-test questions for the reviewer
1. Does `toLastmod` ever emit something sitemaps.org rejects — e.g. a `Date` with non-zero ms at midnight (`T00:00:00.500Z` → full ISO, correct) or a timezone-shifted YAML date?
2. Is "first wins" the right duplicate rule, or should it be deterministic regardless of input order?
3. Should `isListed` also require `href` to start with `/` (a relative href would yield `https://example.comfoo.html`)?

## Step 3 — reviewed (2026-10-11)

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
Goal (`buildSitemap` pages → XML per D2–D5, matches ROADMAP "XML shape" byte for byte) · `npx vitest run` → 3 files / 37 tests passed; `npm run lint` → exit 0, no output · Non-negotiables, Framework correctness, Tests & hygiene (no UI) · self-critique: `robots` option recorded in ROADMAP slice 3 note, W3C regex range-only check matches D4 "verbatim", first-wins duplicate rule written into ROADMAP, `matchesPattern` non-string left to slice 4 per ROADMAP config table, `/noindex/i` = D3 "contains" · scope: only the step's four files + ROADMAP tick + plan/log · no new dependency · walkthrough n/a (`none`).

### Answers to the pressure-test questions
1. No. Core parses frontmatter with `yaml` (`generator/src/core.js:43`); checked: `date: 2026-10-01` → `2026-10-01T00:00:00.000Z` (→ `2026-10-01`), `2026-10-01 09:30:00 +02:00` → `2026-10-01T07:30:00.000Z` (→ `2026-10-01T07:30:00Z`, valid UTC). A midnight Date with ms (`.500Z`) does not end in `.000Z`, so it takes the second branch and `.500Z` is stripped → `T00:00:00Z` — valid W3C. Invalid Dates, numbers and free strings yield null; `toString()` is never reached (tested).
2. "First wins" is acceptable: it is documented in ROADMAP slice 3, duplicates are an anomaly, and core's page order plus fixed plugin order is stable for the same site, so D3's byte-identity holds. Making it order-independent (e.g. max lastmod) would be a new rule needing a decision for no observed case.
3. Not needed now. Core always builds `href` as `/${page…}` (`generator/src/core.js:227`) and spreads frontmatter *before* it, so frontmatter cannot override it; the fleet's generated pages (`nera-plugin-tags/index.js:184,227`) also emit rooted hrefs. A relative href would be a bug in the producing plugin; D3 only requires "a string `meta.href`".

## Step 3 — approved (2026-10-11)

snagio: ticked
commit: 99efd7b

## Step 4 — started (2026-10-11)

base_sha: 99efd7be9c08fdac8de8da162e273a23a315b305
mode: fresh

## Step 4 — implemented (2026-10-11)

base_sha: 99efd7be9c08fdac8de8da162e273a23a315b305

### Changed
- `index.js` — `getAppData` runs the core guard and returns `app`; `getAssets` loads config, resolves origin, warns + `[]` without one, else writes `.nera-cache/sitemap/<output>` and returns `[{ from, to: output }]`. Both synchronous, array in every branch (also when called without arguments).
- `src/config.js` — `defaults`, `normalizeConfig` (per-key fallbacks + warnings, unknown keys warn, `null` = absent), `safeOutput` (rejects absolute, drive letter, `..` escape, directories; normalizes to POSIX), `loadConfig` and `resolveOrigin` (`app.origin`, else canonical-links `app_origin`, read only when needed; both honour `app.folders.config`).
- `src/guard.js` — copied from code-blocks, message adapted (no opt-out key here).
- `src/warn.js` — fleet-style `⚠️ plugin-sitemap:` prefix (not in the step's file list; same pattern as code-blocks).
- `config/sitemap.yaml` — documented defaults; `package.json` `files` gains `config` so it ships (like code-blocks).
- `test/config.test.js`, `test/guard.test.js`, `test/helpers.js`, `test/index.test.js` — config fallbacks/validation, shipped yaml = defaults, origin resolution, guard, hook behaviour incl. old-core throw, missing config, basePath/robots/exclude, escape attempt, no-origin, determinism.
- `ROADMAP.md` — slice 4 ticked with a dated Done note recording the decisions above.

### Fixed alongside
- none

### Carry forward
- design · S · `ROADMAP.md` O2 — "1.0 writes one file and warns when the cap (50 000 URLs / 50 MB) is exceeded" has no plan step; belongs in Step 6/7 or a ROADMAP correction — not in this step's goal.

### Verification
```
npx vitest run → Test Files  5 passed (5) / Tests  67 passed (67)
npm run lint → eslint . (no output, exit 0)
missing config file → test "works without any config file (all defaults)" passes
```

### Self-critique
- `robots` is read and normalized but unused until Step 5 — deliberate, the key belongs to the config contract now.
- Rejected forbidding every `..` segment outright; `a/../map.xml` normalizes to `map.xml` and stays inside, so it is accepted. A directory-looking `output` (`foo/`, `.`) is rejected too, beyond the ROADMAP table — recorded in the Done note.
- Non-string `exclude` entries warn (ROADMAP only says "dropped"); a silent drop seemed worse.
- File-system errors on the cache write are not caught: a failed write should fail the build rather than ship without a sitemap.
- Least sure: the old-core test fakes `node_modules/@nera-static/core/package.json` in a temp cwd and relies on `createRequire(cwd/package.json)` resolving it first.

### Pressure-test questions for the reviewer
1. Can any `output` value make `path.resolve(cwd, CACHE_DIR, output)` leave `.nera-cache/sitemap/` (backslashes, `C:`, `..\\`, whitespace)?
2. Does every `getAssets` branch return an array, including a missing `app`/`pagesData`?
3. Is reading `canonical-links.yaml` from `app.folders.config` right, given canonical-links itself reads `config/` cwd-relative?

#### UI walkthrough — generated sitemap (short pass)
Tier 1, Playwright MCP. Throwaway `nera new` site in the scratchpad with the local plugin installed by path (Node 22). The first build without an origin printed the warning and wrote no sitemap. Then `origin: https://nonce-s4k7.example/` and `output: seo/map-s4k7.xml`, `nera serve --port 3124`.

| control | label promises | nonce | observed after | resulting URL | verdict |
|---|---|---|---|---|---|
| `output` + `origin` config | sitemap at the configured path with absolute URLs | s4k7 | `text/xml`, 0 parsererror, locs `["https://nonce-s4k7.example/index.html"]` | http://localhost:3124/seo/map-s4k7.xml | ✅ |
| rebuild | byte-identical output | s4k7 | shasum a7a8d010… before and after `nera build` | — | ✅ |

Console: Total messages: 0 (Errors: 0, Warnings: 0)
Teardown: browser closed, server on :3124 stopped, temp site deleted.

## Step 4 — reviewed (2026-10-11)

Verdict: approve

### 🔴 Blocking
- none

### Fixed in review
- none

### Fixed alongside
- none

### Carry forward
- design · S · `ROADMAP.md:216` — O2 says 1.0 warns when one file exceeds 50 000 URLs / 50 MB, but no plan step implements it — fold into Step 6/7 or correct the ROADMAP (already raised by the implementer; decision)

### Checked
Goal met (getAssets reads config with per-key fallbacks, resolves origin, writes `.nera-cache/sitemap/<output>`, returns `[{ from, to }]`; no origin → warning + `[]`; guard throws on core < 4.13.0) · `npx vitest run` → 5 files / 67 tests passed · `npm run lint` → exit 0 · Non-negotiables (no write into `public/`, sync hooks, right shapes, site config via `getConfig`, ROADMAP Done note written back), Framework correctness (origin order matches canonical-links/validate, `app.basePath` is core's normalized key — `core.js:148`), Tests & hygiene · all self-critique claims verified · walkthrough n/a (short pass in log reads as evidence: nonce, URL, shasum, console, teardown)

### Answers to the pressure-test questions
1. No. `safeOutput` trims, turns `\` into `/`, rejects a leading `/` (also `\\server\share` → `//…`), any `X:` drive prefix, and anything whose `path.posix.normalize` is `.`, `..` or starts with `../`; so `..\\x.xml`, `C:\\x.xml`, `a/../../x.xml` all fall back to `sitemap.xml` (tested in `test/config.test.js`, and `test/index.test.js` proves no `evil.xml` lands in the site root). Only `app.yaml`-independent `output` feeds the path, and `to` is the same normalized relative string.
2. Yes. Missing args → default `{ app = {}, pagesData = [] } = {}` (tested). `app: null` reaches `loadConfig`/`resolveOrigin` via `app?.…` → no origin → `[]`. `pagesData: null` with an origin → `buildSitemap` iterates `pagesData || []` (`src/sitemap.js:75`) → empty urlset entry. The only non-array exit is a thrown fs error, deliberately (build should fail).
3. Defensible and matches the ROADMAP's reference: `@nera-static/validate` resolves `canonical-links.yaml` from `model.folders.config` (`../nera-validate/src/output.js:115`), and core always sets `app.folders.config` (`core.js:141-143`). `plugin-canonical-links` reads `config/` cwd-relative (`index.js:7`), so they diverge only on a site that relocates its config folder — on the default every reader hits the same file.

## Step 4 — approved (2026-10-11)

snagio: ticked
commit: a1d4a4e

## Step 5 — started (2026-10-11)

base_sha: a1d4a4e0886fbe4eeadf0f44849bc9d1c22ffbe1
mode: fresh

## Step 5 — implemented (2026-10-11)

base_sha: a1d4a4e

### Changed
- `src/robots.js` — new: `robotsTxt` (D6 content), `hasSitemapLine` (`/^sitemap\s*:/im`), `siteRobotsPath` (`app.folders.assets` || `./assets`, from the site root), `robotsAssets` (site file present → `[]` + one warning without a `Sitemap:` line; else writes `.nera-cache/sitemap/robots.txt` and returns `{ from, to: 'robots.txt' }`)
- `index.js` — `getAssets` appends the robots entries unless `robots: false`; the pointer URL is `joinUrl(origin, app.basePath, '/' + output)`, the same join as page URLs; header comment updated
- `src/config.js` — `output: robots.txt` (after normalization) is rejected with the usual warning, since sitemap and pointer would collide in the cache and in `public/` (a collision this step creates, so handled here)
- `test/robots.test.js` — new: content, Sitemap-line matching (comments, mid-line mentions, CRLF), assets-folder resolution incl. `theme/assets` and a non-default folder ignoring `./assets`, the site file never rewritten, warning text verbatim, a `robots.txt` directory
- `test/index.test.js` — hook returns both entries; basePath + custom output in the pointer; `robots: false`; site file in `app.folders.assets` → no entry + warning with basePath URL; no origin → no robots.txt
- `test/config.test.js` — `robots.txt` output collision falls back; `seo/robots.txt` still allowed
- `ROADMAP.md` — slice 5 ticked with a Done note (choices below), config table notes the `robots.txt` rejection

### Fixed alongside
- none

### Carry forward
- none

### Verification
```
npx vitest run → Test Files  6 passed (6) / Tests  81 passed (81)
npm run lint → eslint . (no output, exit 0)
```

### Self-critique
- Site file detection uses `isFile` rather than `existsSync`: a directory named `robots.txt` would otherwise crash the build on `readFileSync` (EISDIR). Such a site then gets the generated file, and core's copy of the site's directory probably clashes. Exotic, so I kept the cheap guard.
- `.neraignore` is not consulted: a site file the site ignores still suppresses the generated one (written into the ROADMAP). Reading `.neraignore` would duplicate core's matching for a corner case.
- Rejecting `output: robots.txt` even with `robots: false` keeps the rule simple and the output path independent of another key.
- A stale `.nera-cache/sitemap/robots.txt` from an earlier build stays when the site later adds its own file. It is harmless (never returned), but it is clutter in the cache.
- Least sure: `hasSitemapLine` allows whitespace before the colon. That is more lenient than "at line start" in D6, though crawlers parse it the same way.

### Pressure-test questions for the reviewer
1. Can any path make the plugin return a `robots.txt` entry while the site's own file exists in core's resolved assets folder (theme probe, custom `folders.assets`)?
2. Is the pointer URL right with basePath + nested `output` (`https://example.com/sub/seo/map.xml`)? It is asserted in `test/index.test.js`.
3. Should the warning also fire with `robots: false`? I followed D6 ("when … `robots` is not `false`"), so it does not.

#### UI walkthrough — generated sitemap + robots.txt pointer (short pass)
Throwaway site from `nera new` (scaffold has `theme/`, so assets = `./theme/assets`), local plugin installed, `origin: https://wt-5b2e.example.com/`, `nera serve --port 3124`.

| control | label promises | nonce | observed after | resulting URL | verdict |
|---|---|---|---|---|---|
| `/robots.txt` (no site file) | generated pointer to the sitemap | wt-5b2e | `User-agent: * Allow: / Sitemap: https://wt-5b2e.example.com/sitemap.xml` | /robots.txt | ✓ |
| `/sitemap.xml` | sitemaps.org urlset with absolute URLs | wt-5b2e | `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, `<loc>https://wt-5b2e.example.com/index.html</loc>` | /sitemap.xml | ✓ |
| `/robots.txt` after adding `theme/assets/robots.txt` without Sitemap, rebuild | site file wins, warning names the line | WT-c41f | served `User-agent: * Disallow: /WT-c41f/`; build log: `⚠️ plugin-sitemap: theme/assets/robots.txt has no Sitemap line, so crawlers reading it will not find the sitemap. Add: Sitemap: https://wt-5b2e.example.com/sitemap.xml` | /robots.txt | ✓ |

Console: `[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:3124/favicon.ico:0` (scaffold has no favicon; unrelated)
Divergence: none — the scaffold resolves assets to `theme/assets`, which is exactly why the `app.folders.assets` lookup matters.

## Step 5 — reviewed (2026-10-11)

Verdict: approve

### 🔴 Blocking
- none

### Fixed in review
- none

### Fixed alongside
- none

### Carry forward
- design · S · `src/robots.js:41` — an installed npm theme package (`@nera-static/theme-*`) that ships `assets/robots.txt` gets overridden by the generated pointer, because core copies theme → plugins → site (`generator/src/index.js:69-76`) and the plugin checks only `app.folders.assets`. D6 covers just the site's own file, so whether a theme's robots.txt counts as deliberate needs a decision (e.g. also check `theme.assetsRoot`). — why not now: decision

### Checked
goal (D6 entry, `robots: false`, site file never overridden, warning) · `npx vitest run` → 6 files / 81 tests passed, `npm run lint` → exit 0, no output · Non-negotiables, Framework correctness, Tests & hygiene · self-critique: `isFile` guard (tested), `.neraignore` not consulted (in ROADMAP), `output: robots.txt` rejected even with `robots: false` (tested, also in a real build), stale cache file harmless (never returned), `\s*:` leniency (written into ROADMAP) · core's `computeFolders` (`generator/src/core.js:86-112`) puts the theme probe into `app.folders.assets` before plugins run, so reading it is correct · full walkthrough done

### Answers to the pressure-test questions
1. Not for the site's assets folder. Core resolves `app.folders.assets` (custom value, else `./theme/assets` when `theme/` exists, else `./assets`) in `computeFolders` before plugins run, and `siteRobotsPath` resolves exactly that from cwd. Real build: `theme/assets/robots.txt` present → no entry, site file served (scenarios B/C below). Even if the plugin did return an entry, core copies site assets last, so the site would still win. The one gap is an npm theme package's `assets/robots.txt`, which comes before plugin assets in the copy order (carried forward).
2. Yes. `test/index.test.js` asserts `Sitemap: https://example.com/sub/seo/map.xml`, and a real build with `base_path: /sub` + `output: seo/map.xml` wrote `Sitemap: https://rv-7d1a.example.com/sub/seo/map.xml`. Core's base_path rewrite of copied assets did not double the prefix.
3. No. D6 makes the whole pointer conditional on `robots` not being `false`, and `robots: false` means the site wants no robots.txt involvement from the plugin. Keep it as implemented.

#### UI walkthrough — generated sitemap + robots.txt pointer (full pass)
Throwaway site from `nera new` (has `theme/`), local plugin installed, `origin: https://rv-7d1a.example.com/`, `base_path: /sub`. `nera build` for each state, then `nera serve --port 3124` + Playwright on the final state.

| control | label promises | nonce | observed after | resulting URL | verdict |
|---|---|---|---|---|---|
| `/robots.txt`, no site file (A, browser) | generated pointer incl. basePath | rv-7d1a | `User-agent: * Allow: / Sitemap: https://rv-7d1a.example.com/sub/sitemap.xml` | /robots.txt | ✓ |
| `/sitemap.xml` (browser) | sitemaps.org urlset, absolute URLs | rv-7d1a | `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, `<loc>https://rv-7d1a.example.com/sub/index.html</loc>` | /sitemap.xml | ✓ |
| site `theme/assets/robots.txt` with Sitemap line (B) | site file wins, no warning | RV-a90c | `public/robots.txt` = `Disallow: /RV-a90c/` + its Sitemap line; no ⚠️ in build log | /robots.txt | ✓ |
| site file without Sitemap line (C) | site file wins, one warning with the line to add | RV-b31e | `Disallow: /RV-b31e/` served; `⚠️ plugin-sitemap: theme/assets/robots.txt has no Sitemap line, so crawlers reading it will not find the sitemap. Add: Sitemap: https://rv-7d1a.example.com/sub/sitemap.xml` | /robots.txt | ✓ |
| `robots: false` + `output: seo/map.xml` (D) | no robots.txt | — | `public/robots.txt` absent, `public/seo/map.xml` present | — | ✓ |
| `output: robots.txt` (E) | rejected, default used | — | `⚠️ plugin-sitemap: config/sitemap.yaml: invalid output "robots.txt", using "sitemap.xml"`; robots.txt is the pointer, sitemap.xml exists | /robots.txt | ✓ |
| `output: seo/map.xml` (F) | pointer follows output | — | `Sitemap: https://rv-7d1a.example.com/sub/seo/map.xml` | /robots.txt | ✓ |

Console: `[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:3124/favicon.ico:0` (the scaffold has no favicon, unrelated)
Divergence: none. As the source predicted, core's base_path asset rewrite leaves robots.txt alone (the `/sub` prefix shows up once).

## Step 5 — approved (2026-10-11)

snagio: ticked
commit: 3e9e080

## Step 6 — started (2026-10-11)

base_sha: 3e9e0807e515088081103d0b80179d9d2894b736
mode: fresh

## Step 6 — implemented (2026-10-11)

base_sha: 3e9e080

### Changed
- `test/integration.test.js` — new: four throwaway sites built with core's real `run()`, plugin loaded as a site-local plugin (`plugins/sitemap/index.js` re-exporting this repo's `index.js`). (1) bilingual en/de site, no `config/sitemap.yaml`: exact `public/sitemap.xml` (escaped `q&amp;a.html`, `lastmod` from `date`/`lastmod`/`updatedAt`, layout-less, `sitemap: false` and `robots: noindex` pages left out but still rendered), exact `robots.txt`, no warnings, second build byte-identical; (2) `base_path: /sub/` + origin from `canonical-links.yaml` + `output: seo/map.xml` + `exclude: /de/*`: every URL prefixed exactly once (core's asset rewrite does not touch `.xml`/`.txt`), robots pointer to `/sub/seo/map.xml`, no `public/sitemap.xml`; (3) own `assets/robots.txt`: kept verbatim, exactly one warning with the line to add; (4) no origin: one warning, neither file, pages still built.
- `test/helpers.js` — `build(root)`: chdir into the site, `run()` with absolute folders, console silenced, warnings returned, cwd and spies restored in `finally`. `tempDir()` now returns `fs.realpathSync(...)`.
- `ROADMAP.md` — slice 6 ticked with a "Done" paragraph.

### Fixed alongside
- none (the realpath change in `tempDir` is a test-harness fix, not a production defect: the integration test first produced `../../../../var/folders/…/assets/robots.txt` in the warning because the absolute folders used `/var/…` while `process.cwd()` after chdir reports `/private/var/…`. The CLI passes no folders — core resolves them relative to cwd — so real builds are unaffected.)

### Carry forward
- bug · S · `src/urls.js:22` — `joinUrl` puts `meta.href` into `<loc>` verbatim, so a page file with a space or non-ASCII character (`pages/about us.md`) yields `<loc>https://example.com/about us.html</loc>`, which is not a valid RFC 3986 URL as sitemaps.org requires. Fix would be `encodeURI` on the href (idempotence against already-encoded hrefs needs care) — not now: D2 says "verbatim", so it is a decision, and urls.js is outside this step.

### Verification
```
npx vitest run → Test Files  7 passed (7) / Tests  92 passed (92)
npm run lint → exit 0, no output
npx vitest run test/integration.test.js ×3 → Tests  11 passed (11) each, 1.1–2.2 s
temp dirs left in os.tmpdir() matching nera-sitemap-int → 0
```

### Self-critique
- Loaded via local `plugins/` dir only, not as a `node_modules/@nera-static/plugin-sitemap` dependency; the dependency path is core's discovery logic, not this plugin's, and symlinking the repo into a temp `node_modules` would make the guard resolve core through the symlink — more moving parts for no new coverage of plugin code.
- `build()` lives in `helpers.js`, so every unit test file importing helpers now also imports core (a static import). Suite time is unaffected in practice (2.8 s total); a dynamic import inside `build()` would avoid it if the reviewer prefers.
- Assertions on `sitemap.xml` are exact strings in the main case — brittle by intent, since the XML shape is the public contract.
- Least sure: the exact warning string in case (3) couples the test to the message wording; I kept it exact because the message *is* the D6 behaviour.

### Pressure-test questions for the reviewer
1. Is the cwd restored when `run()` throws (the `finally` in `build()`), and are the console spies restored so a failure does not swallow later output?
2. Does case (2) really prove core does not double-prefix — i.e. would `rewriteAssetUrls` ever touch `.xml`? (render.js rewrites only CSS, manifest and JSON.)
3. Is the space-in-href `<loc>` (carry forward) acceptable for 1.0, or should it block the release?

## Step 6 — reviewed (2026-10-11)

Verdict: approve

### 🔴 Blocking
- none

### Fixed in review
- `test/helpers.js:32` — `process.chdir(root)` moved inside the `try`, so a failing chdir (missing root) still restores the console spies instead of leaving `console.log`/`warn` silenced for the rest of the worker — `npx vitest run && npm run lint` → 92/92 passed, lint exit 0

### Fixed alongside
- none

### Carry forward
- debt · S · `test/helpers.js:16` — the unit suites' `tempDir()` calls (config/robots/index/guard tests, earlier steps) never remove their dirs: each `npx vitest run` leaves 33 `nera-sitemap-*` dirs in `os.tmpdir()` (311 present before this review, 344 after one run); only the integration test cleans up — unrelated to this step's goal, and the fix touches four test files outside it

### Checked
goal (4 sites through real `run()`, exact sitemap/robots, byte-identical rebuild, base_path, en/de) · `npx vitest run` → 7 files / 92 tests passed, `npm run lint` → exit 0 · Non-negotiables + Framework correctness (no hook writes to public/, getAssets path exercised, config fallback with no sitemap.yaml, lastmod from frontmatter, layout-less page absent, deterministic output) · self-critique: local `plugins/` re-export is how a real site loads a local plugin (core `folders.plugins`) — accepted; static core import in helpers costs nothing measurable (suite 4 s) — accepted; exact strings intended as contract — accepted · scope: only test/, ROADMAP slice 6, plan/log · walkthrough n/a (none)

### Answers to the pressure-test questions
1. Yes for cwd: `process.chdir(prev)` and both `mockRestore()` sit in `finally`, so a throwing `run()` restores all three. The one gap was a throwing `chdir(root)` before the `try` — fixed in review above.
2. Proven: core's `rewriteAssetUrls` (`node_modules/@nera-static/core/src/render.js:127-150`) only touches files ending `.css`, `.webmanifest`, `.json`; `.xml`/`.txt` are never rewritten, and case (2) asserts the exact `<loc>` list with `/sub/` once and the robots pointer `https://example.org/sub/seo/map.xml`.
3. Not a blocker for this step — it is already carried forward by the implementer (D2 "verbatim" makes it a user decision). Recommend deciding it in step 7 or a follow-up: Nera page filenames with spaces/non-ASCII are rare, but `encodeURI` on the href would make `<loc>` RFC 3986-valid.

## Step 6 — approved (2026-10-11)

snagio: ticked
commit: 80d4fac

## Step 7 — started (2026-10-11)

base_sha: 80d4fac72023da00a8661c2230a953ea86c95a0f
mode: fresh

## Step 7 — implemented (2026-10-11)

base_sha: 80d4fac

### Changed
- `README.md` — new, modelled on plugin-code-blocks (badges under the title, nera.js.org link, Compatibility/Development/License); documents origin resolution, which pages are listed (D3), `lastmod` (D4), multilingual (D5), the robots.txt pointer incl. the `base_path` caveat (D6), config table matching `src/config.js` readers (D7), known limitations (O2, O3)
- `CHANGELOG.md` — new, Keep a Changelog, `## [1.0.0] - 2026-10-11` with one Added bullet per contract piece
- `ROADMAP.md` — slice 7 ticked with Done note; "Release handover" (repo + fleet-check, bootstrap publish, Trusted Publisher, CI 1.0.1 within ~2 days, catalogs, ROADMAP-ai L8 pointer) and the prepared PLUGINS.md + en/de/es catalog entries; acceptance criteria ticked; O2 corrected

### Fixed alongside
- `ROADMAP.md:220` — O2 promised "warns when the cap is exceeded", the code has no such warning (grep: no cap check in `src/`) — doc corrected to what the code does, README names the limit — docs only, no test

### Carry forward
- design · S · `src/sitemap.js` — a warning above 50 000 URLs / 50 MB (O2) — not in this step's goal; additive patch/minor later

### Verification
```
npx vitest run → Test Files  7 passed (7) / Tests  92 passed (92)
npm run lint → eslint . (no output, exit 0)
npm pack --dry-run → total files: 12 — CHANGELOG.md, LICENSE, README.md, config/sitemap.yaml, index.js, package.json, src/{config,guard,robots,sitemap,urls,warn}.js
catalog descriptions with a raw ": " after the key → 0
```

### Self-critique
- Fixed O2 by correcting the doc rather than adding the warning: adding behaviour in a docs step would widen the step; the README states the limit honestly.
- Did not tick the acceptance criteria in the plan file (only the ROADMAP's) — `/approve-step` / `/work-issue` own the plan.
- Least sure: the handover step 2 order (tag push after the hand publish makes the tag's CI publish fail on the existing version) — mirrors the code-blocks/images bootstrap, but the maintainer may prefer not to push `v1.0.0` at all.
- German/Spanish catalog wording is mine; "Generiert"/"Genera" match the neighbouring entries' style.

### Pressure-test questions for the reviewer
1. Does every README claim hold against the code — esp. "unknown key prints a warning", "directory output rejected", W3C string examples (`'2026-10'`, `'2026-10-08T11:30+02:00'`) passing `W3C_DATETIME`, and "`.nera-cache` ignored by git in `nera new` sites"?
2. Config table vs `src/config.js` readers: `exclude` non-list (e.g. a number) → warning + default, which the table's "Invalid value" column does not spell out — enough?
3. Are the catalog entries in the right alphabetical slot (after "Simple page list", before "Social media links") and the PLUGINS.md count right (16 → 17)?

## Step 7 — reviewed (2026-10-11)

Verdict: approve

### 🔴 Blocking
- none

### Fixed in review
- `ROADMAP.md:221` — handover pointed at `.claude/scripts/fleet-check.sh`; the script lives at `generator/scripts/fleet-check.sh` (run from the workspace root) — `ls ../generator/scripts/` → `fleet-check.sh`
- `README.md:124` — `exclude` row now also says "any other type → warning, default used" (`readExclude` → `bad()`) — `npx vitest run` → 92 passed
- `CHANGELOG.md:18` — "invalid values … warn" overpromised for `robots`, which never warns (`value !== false`); now says only `output`/`exclude` warn, any `robots` but `false` is `true` — `npm run lint` → clean

### Fixed alongside
- none

### Carry forward
- none (the O2 cap warning is already carried by the implementer)

### Checked
goal (README/CHANGELOG/ROADMAP handover + catalogs) · `npx vitest run` 92/92, `npm run lint` clean, `npm pack --dry-run` 12 files = exactly the intended list · Non-negotiables (no publish/push, ROADMAP as source of truth, Keep a Changelog four-space bullets), Framework correctness, Tests & hygiene · self-critique (O2 doc correction honest: no cap check in `src/`) · pressure-test answers below · walkthrough n/a (`none`)

### Answers to the pressure-test questions
1. Yes. Unknown key → `normalizeConfig` warns `ignoring unknown key`; directory output (`.`, `foo/`) → `safeOutput` null → warning + default; `'2026-10'` and `'2026-10-08T11:30+02:00'` both match `W3C_DATETIME` (`src/sitemap.js:11`); `lastmod: 2026-10-08T09:30:00Z` → `toLastmod` strips ms → `2026-10-08T09:30:00Z` as the README shows; `.nera-cache` is in `../nera-cli/template/_gitignore:6`; robots.txt body matches `src/robots.js:13`; README's YAML block is identical to the shipped `config/sitemap.yaml` (minus its header comment).
2. Not quite — fixed in review (README `exclude` row now names the non-list case). Also the CHANGELOG claimed invalid `robots` warns; corrected.
3. Yes. "Simple page list" < "Sitemap" < "Social…" in `../generator/PLUGINS.md:27-28` and in the website lists (en/de lines 53/57); heading is `(16)` today → `(17)` correct. Entry format matches neighbours (four-space list indent, quoted `package`); no description contains a raw `: `.

## Step 7 — approved (2026-10-11)

snagio: ticked
