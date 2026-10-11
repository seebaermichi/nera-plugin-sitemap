# Browser test: 01a1260d-9038-71ac-85ef-772486490e43 — [nera-plugin-sitemap] sitemap.xml plugin

**Date:** 2026-10-11 · **Branch:** main · **Base URL:** http://localhost:3124/
**AC source:** plan + snapshot 2026-10-11

Not browser-testable, left to the review loop: AC 1 (`ROADMAP.md`), AC 4 (fleet match,
release readiness), AC 5 (catalog entries prepared). This guide covers AC 2 and AC 3.

## Preconditions

- **Role / user:** crawler (anonymous), no login
- **Test data:** throwaway site from the conventions' boot line (temp dir, local plugin
  installed by path), plus — in that temp site only — `origin: https://example.com` in
  `config/app.yaml`, a page `pages/a&b.md` (with `layout`), a page with `sitemap: false`,
  a page with `robots: noindex`; for TC-4 a second build with `base_path: /sub`; for
  TC-6 an own `robots.txt` in the site's assets folder (`theme/assets/` on a scaffolded site) without a `Sitemap:` line.

## Test cases

### TC-1 — `/sitemap.xml` is a valid sitemaps.org document with absolute URLs

**AC:** "A site depending on the plugin gets a valid sitemaps.org `public/sitemap.xml` with absolute, escaped, `base_path`-aware URLs"
**Status:** PASS

1. Navigate to `/sitemap.xml`.
2. Expect: the browser parses it as XML (no parse error); root `urlset` in namespace `http://www.sitemaps.org/schemas/sitemap/0.9`; every `loc` starts with `https://example.com/`; `/index.html` is listed; entries sorted by href.

**Expected:** a well-formed urlset listing every rendered page under the origin.
**Evidence:** 200 text/xml, 0 parse errors, root urlset in the sitemaps.org 0.9 namespace; 3 locs under https://example.com/, sorted (a&b, blog/post with lastmod 2026-10-01, index.html); no console errors

---

### TC-2 — special characters are escaped

**AC:** (same as TC-1 — "escaped")
**Status:** PASS

1. Navigate to `/sitemap.xml` and read the raw source.
2. Expect: the `a&b` page's `loc` is written `a&amp;b` in the source and parses to `a&b`.

**Expected:** the document stays well-formed with an `&` in a URL.
**Evidence:** source has a&amp;b.html, DOMParser reads https://example.com/a&b.html; document well-formed

---

### TC-3 — excluded pages are absent (negative)

**AC:** (same as TC-1; D3 exclusion rules)
**Status:** PASS

1. Navigate to `/sitemap.xml`.
2. Expect: the `sitemap: false` page and the `robots: noindex` page are not listed; the pages themselves still open in the browser.

**Expected:** excluded pages are built but not in the sitemap.
**Evidence:** hidden.html (sitemap: false) and noindex.html (robots: noindex, follow) absent from the sitemap; both pages return 200

---

### TC-4 — `base_path` is applied

**AC:** (same as TC-1 — "`base_path`-aware")
**Status:** PASS

1. Rebuild with `base_path: /sub`, serve, navigate to the sitemap.
2. Expect: every `loc` starts with `https://example.com/sub/`, no double slash.

**Expected:** URLs carry the base path exactly once.
**Evidence:** with base_path /sub: all 3 locs start https://example.com/sub/, no double slash; 0 parse errors

---

### TC-5 — `/robots.txt` points at the sitemap

**AC:** "A `robots.txt` pointer to the sitemap is produced (D6)"
**Status:** PASS

1. Navigate to `/robots.txt`.
2. Expect: `User-agent: *`, `Allow: /`, `Sitemap: https://example.com/sitemap.xml` (with `/sub` in the base-path build).

**Expected:** a robots.txt whose `Sitemap:` line is the sitemap's absolute URL.
**Evidence:** text/plain: User-agent: *, Allow: /, Sitemap: https://example.com/sitemap.xml (…/sub/sitemap.xml in the base-path build)

---

### TC-6 — the site's own `robots.txt` wins (negative)

**AC:** (same as TC-5; D6)
**Status:** PASS

1. Add `theme/assets/robots.txt` (the site's assets folder) without a `Sitemap:` line, rebuild, navigate to `/robots.txt`.
2. Expect: the site's own file is served unchanged; the build printed a warning naming the `Sitemap:` line to add.

**Expected:** the plugin never overwrites an authored robots.txt.
**Evidence:** theme/assets/robots.txt served unchanged (User-agent: * / Disallow: /private/); build warned 'Add: Sitemap: https://example.com/sub/sitemap.xml'. Guide said assets/robots.txt — the scaffold's assets folder is theme/assets, a guide error, not a plugin defect

---
