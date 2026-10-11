# Plan: [nera-plugin-sitemap] sitemap.xml plugin

- **Issue:** `01a1260d-9038-71ac-85ef-772486490e43`
- **Type:** feature
- **Plan written:** 2026-10-11

## Context

`nera-cli/ROADMAP-ai.md` L8 asks for `@nera-static/plugin-sitemap`: a `sitemap.xml`
plus a `robots.txt` pointer, needed by the planned `blog` starter. The repo is empty
apart from the Snagio setup (`de3f825`), so this issue writes the plugin's own
`ROADMAP.md`, scaffolds the package like the fleet (`../nera-plugin-code-blocks` is the
model), implements it, and prepares the 1.0.0 release handover. The plugin works in
the `getAssets` hook (core ≥ 4.13.0): it runs after every plugin's `getMetaData`, so
it sees the final `pagesData` (including pages other plugins generate), writes the
XML to a cache file and returns `{ from, to }` so core copies it into `public/`.
`meta.href` is logical (un-prefixed); `base_path` is only rewritten into HTML/CSS, so
the plugin applies `app.basePath` itself. The npm name is free (404 on 2026-10-11).
Publishing, pushing and the catalog commits in other repos are handed over, not run.

## Design decisions

**D1 — Generate in `getAssets`, write to `.nera-cache/sitemap/`.** Final page data, no write into `public/`; fail loudly on core < 4.13.0 (guard copied from code-blocks).
**D2 — URLs = origin + basePath + `meta.href`, verbatim.** Origin from `app.origin`, else canonical-links' `app_origin`; trailing slashes trimmed; `/index.html` kept as is so the sitemap agrees with canonical links. No origin → one warning, no sitemap, no robots.txt.
**D3 — Which pages.** Only pages with `layout`; excluded by frontmatter `sitemap: false` or `robots` containing `noindex`, or by config `exclude` (href patterns, `*` wildcard, no dependency). Sorted by href for byte-identical output.
**D4 — `lastmod` only from frontmatter.** `lastmod` → `updatedAt` → `date`, `Date` or W3C string both accepted; `meta.createdAt` is never used (core's frontmatter options include `customTags: ['timestamp']`, so authored dates are `Date`s too and an authored `createdAt` cannot be told from the birthtime fallback — corrected in Step 1, user decision 2026-10-11); invalid dates omitted. No `changefreq`/`priority` (ignored by Google; optional per protocol).
**D5 — Multilingual: all languages in one sitemap, no hreflang in 1.0.** Every page is listed under its own URL; `xhtml:link` alternates are carried forward.
**D6 — `robots.txt` pointer on by default.** Ship `User-agent: *` / `Allow: /` / `Sitemap: <url>` unless the site has its own `assets/robots.txt` (site wins in core's copy order); if that file lacks a `Sitemap:` line, warn with the line to add. `robots: false` turns it off.
**D7 — Config keys (all optional):** `output` (default `sitemap.xml`), `exclude` (`[]`), `robots` (`true`). No views, no new runtime dependency besides `@nera-static/plugin-utils`.

## Acceptance criteria

- [ ] The repo has its own `ROADMAP.md` as the plugin's spec (L8 points to it)
- [ ] A site depending on the plugin gets a valid sitemaps.org `public/sitemap.xml` with absolute, escaped, `base_path`-aware URLs
- [ ] A `robots.txt` pointer to the sitemap is produced (D6)
- [ ] The package matches the fleet (CI workflows, LICENSE, README linking nera.js.org, CHANGELOG, `files`) and is ready for the 1.0.0 bootstrap publish
- [ ] The PLUGINS.md and three website catalog entries are prepared for the release handover

## Steps

### Step 1 — Write the plugin's ROADMAP.md — ✅ done

- **Goal:** `ROADMAP.md` holds the problem, verified facts (getAssets order, logical `meta.href`, `base_path` scope, YAML `core` schema → string dates, free npm name), D1–D7, config reference, XML shape, slices matching this plan, open items (hreflang, sitemap index > 50 000 URLs).
- **Files:** `ROADMAP.md` — new
- **Verify:** `test -f ROADMAP.md && grep -c '^### D' ROADMAP.md` — prints 7
- **Review hardest:** every "verified fact" is checked against `../generator/src/` (core 4.15.x), not memory
- **Risks:** a fact wrong here propagates into every later step
- **Walkthrough:** none

### Step 2 — Scaffold the package like the fleet — ✅ done

- **Goal:** an installable, lint-clean, testable empty plugin at 1.0.0 with CI and lockfile.
- **Files:** `package.json` (name, `files`, engines `^20.19.0 || >=22.0.0`, peer `@nera-static/core >=4.13.0`, dep `@nera-static/plugin-utils`, devDeps core/eslint/vitest/husky), `package-lock.json` (npm ≥ 10.9), `eslint.config.js`, `LICENSE`, `.github/workflows/{test,publish}.yml` (copied from code-blocks), `index.js` + `test/index.test.js` (hooks exported, smoke test); `.gitignore` gains `node_modules`, `.nera-cache`
- **Verify:** `PATH=~/.nvm/versions/node/v22.22.0/bin:$PATH npx vitest run && npm run lint` — green
- **Review hardest:** workflows identical to code-blocks except names; lockfile committed in this step
- **Risks:** npm 10.8 lockfile crashes vitest 5; husky `prepare` failing without `.husky/`
- **Walkthrough:** none

### Step 3 — Pure sitemap builder — ✅ done

- **Goal:** `src/sitemap.js` turns `(pagesData, { origin, basePath, exclude })` into deterministic XML per D2–D5.
- **Files:** `src/sitemap.js`, `src/urls.js` (origin trim, basePath join, XML escape, pattern match), `test/sitemap.test.js`, `test/urls.test.js`
- **Verify:** `npx vitest run && npm run lint` — green; tests cover escaping `&<>'"`, basePath, no-layout/`sitemap: false`/`noindex`/`exclude`, lastmod order (`createdAt` ignored, `Date` and string accepted), sorting
- **Review hardest:** the ROADMAP D4 `lastmod` rule and the date format (`YYYY-MM-DD` or W3C datetime, never `toString()`)
- **Risks:** pages generated by other plugins lacking `href`/`layout` must be skipped, not crash
- **Walkthrough:** none

### Step 4 — Hooks, config and core guard — ✅ done

- **Goal:** `getAssets` reads `config/sitemap.yaml` (fallbacks for every key), resolves the origin, writes the XML to `.nera-cache/sitemap/` and returns `[{ from, to }]`; warns and returns `[]` without origin; throws on core < 4.13.0.
- **Files:** `index.js`, `src/config.js`, `src/guard.js` (from code-blocks), `config/sitemap.yaml` (documented defaults), `test/config.test.js`, `test/guard.test.js`
- **Verify:** `npx vitest run && npm run lint` — green; missing config file still yields a sitemap
- **Review hardest:** hook stays synchronous and returns an array in every branch; `output` cannot escape `public/` (`../`)
- **Risks:** cwd-relative paths in tests; canonical-links config read when its file is absent
- **Walkthrough:** short (generated sitemap)

### Step 5 — robots.txt pointer — ✅ done

- **Goal:** D6: a generated `robots.txt` entry unless `robots: false` or the site ships `assets/robots.txt`; a warning when the site's file has no `Sitemap:` line.
- **Files:** `src/robots.js`, `index.js`, `test/robots.test.js`
- **Verify:** `npx vitest run && npm run lint` — green
- **Review hardest:** the site's assets folder comes from `app.folders.assets` (default `./assets`), not a hard-coded path; sitemap URL in robots includes basePath
- **Risks:** overriding a site's deliberate robots.txt — must never happen
- **Walkthrough:** full (generated sitemap, robots.txt pointer)

### Step 6 — Integration test through core `run()` — ✅ done

- **Goal:** a throwaway site in a temp dir, built with `@nera-static/core`'s `run()`, writes `public/sitemap.xml` and `public/robots.txt` as asserted; second build byte-identical; `base_path` and two languages covered.
- **Files:** `test/integration.test.js`, `test/helpers.js`
- **Verify:** `npx vitest run && npm run lint` — green, no network
- **Review hardest:** the plugin is loaded the way a real site loads it (local `plugins/` dir or package dependency), and cwd is restored after each test
- **Risks:** core's base_path rewrite touching the XML; slow or flaky temp-dir cleanup
- **Walkthrough:** none

### Step 7 — README, CHANGELOG and release preparation — ✅ done

- **Goal:** the package is ready for the 1.0.0 bootstrap: README (install, config, D6 behaviour, link to https://nera.js.org), `CHANGELOG.md` `## [1.0.0] - <date>`, `npm pack --dry-run` ships only intended files; ROADMAP gets slice status and the prepared PLUGINS.md + en/de/es catalog entries for the handover.
- **Files:** `README.md`, `CHANGELOG.md`, `ROADMAP.md`
- **Verify:** `npx vitest run && npm run lint && npm pack --dry-run` — green; tarball lists only `index.js`, `src/`, `config/`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`
- **Review hardest:** catalog descriptions contain no raw `: `; README config table matches `src/config.js`
- **Risks:** README promising behaviour the code does not have
- **Walkthrough:** none

### Step 8 — Valid `<loc>` URLs and the protocol-cap warning (triage #1, #2) — ✅ done

- **Goal:** (#1) `joinUrl` percent-encodes characters not allowed in a URL (space, non-ASCII, …) and leaves an existing `%XX` untouched, so `pages/about us.md` → `<loc>…/about%20us.html</loc>` and an already-encoded href is not double-encoded; D2 amended. (#2) the build warns once when the sitemap exceeds 50 000 URLs or 50 MB and still writes one file; ROADMAP O2 and README say so; the warning goes into the unpublished `## [1.0.0]` CHANGELOG entry.
- **Files:** `src/urls.js`, `src/sitemap.js` (or `index.js`, wherever the XML string is final), `test/urls.test.js`, `test/sitemap.test.js`, `README.md`, `CHANGELOG.md`, `ROADMAP.md`
- **Verify:** `npx vitest run && npm run lint` — green; tests pin a space, an umlaut, an emoji (surrogate pair), an already-encoded `%20`, a literal `%` not followed by two hex digits, and the cap warning on both limits (URL count and bytes) without writing 50 MB to disk
- **Review hardest:** no double-encoding; `escapeXml` still runs after encoding; `exclude` patterns still match the logical (unencoded) href
- **Risks:** changing hrefs the site's own links use verbatim; a slow cap test
- **Walkthrough:** none

### Step 9 — A theme package's robots.txt and test temp-dir cleanup (triage #3, #4) — ⬜ todo

- **Goal:** (#3) when `app.theme.package` names an installed theme whose `assets/robots.txt` exists, the plugin treats it like the site's own file (no generated pointer, warn when it lacks a `Sitemap:` line); the site's own file still wins; ROADMAP O4 → resolved, D6 amended, README updated. (#4) `tempDir()` registers each dir and an `afterEach` in the helper removes them, so `npx vitest run` leaves no `nera-sitemap-*` dirs in `os.tmpdir()`.
- **Files:** `src/robots.js`, `test/robots.test.js`, `test/helpers.js`, `test/integration.test.js` (only if its own cleanup now double-removes), `README.md`, `ROADMAP.md`
- **Verify:** `npx vitest run && npm run lint` — green; `ls $TMPDIR | grep -c nera-sitemap-` unchanged before vs after a run
- **Review hardest:** resolving the theme package from the site's cwd (not the plugin's own `node_modules`); a missing/unresolvable theme package falls back silently to the generated file
- **Risks:** `afterEach` removing a dir while the cwd is still inside it
- **Walkthrough:** none

### Step 10 — hreflang alternates in the sitemap (triage #5, ROADMAP O1) — ⬜ todo

- **Goal:** a multilingual site gets `xhtml:link rel="alternate" hreflang="…"` entries per `<url>` (plus `xmlns:xhtml` on `<urlset>`) for every translation of that page, including itself. Translations come from `meta.alternateLinks` when `plugin-canonical-links` ran first (it does: alphabetical order), else are paired by the frontmatter key `alternates_identifier` (default `slug`, the same as canonical-links' `page_identifier`). New config key `alternates` (`auto` default: written only when a page has ≥ 2 languages; `false` disables). Hrefs go through the same origin + basePath + encoding as `<loc>`. D5 amended, O1 resolved, README config table, CHANGELOG 1.0.0 entry.
- **Files:** `src/sitemap.js`, `src/config.js`, `test/sitemap.test.js`, `test/config.test.js`, `README.md`, `ROADMAP.md` (+ `CHANGELOG.md`)
- **Verify:** `npx vitest run && npm run lint` — green; tests cover a monolingual site (no `xmlns:xhtml`, output unchanged), en/de/es pairing, an untranslated page, an excluded translation (no alternate pointing at it), `alternates: false`
- **Review hardest:** no alternate points at an excluded or unrendered (`layout`-less) page; deterministic order; output byte-identical for monolingual sites
- **Risks:** canonical-links' `alternateLinks` lacking `base_path` (Step 11) — build from `meta.href`, not its `href`
- **Walkthrough:** none

### Step 11 — canonical-links honours `base_path` (triage #6, ROADMAP O3) — ⬜ todo

- **Goal:** in `../nera-plugin-canonical-links`, canonical and alternate hrefs are `origin + app.basePath + meta.href`, matching the sitemap on a `base_path` site; a test pins it; patch version bump + CHANGELOG `### Fixed` in that repo (no publish — the tag/push goes into the release handover); this repo's ROADMAP O3 → resolved and D2's "known divergence" note removed.
- **Files:** `../nera-plugin-canonical-links/index.js`, its test file, its `CHANGELOG.md` + `package.json`/`package-lock.json` (via `npm version patch --no-git-tag-version`), `ROADMAP.md`
- **Verify:** in that repo `npx vitest run && npm run lint` — green; here `npx vitest run` still green
- **Review hardest:** sites without `base_path` produce byte-identical output; commit lands in that repo, not this one
- **Risks:** classification — a changed canonical URL on `base_path` sites is a bugfix (patch), state that in the CHANGELOG
- **Walkthrough:** none
