# Browser test: 01a1260d-9038-71ac-85ef-772486490e43 — [nera-plugin-sitemap] sitemap.xml plugin

**Date:** 2026-10-11 · **Branch:** main · **Base URL:** http://localhost:3124/
**AC source:** plan + snapshot 2026-10-11

Second run, after the triage steps 8–11 (percent-encoded `<loc>`, theme `robots.txt`,
hreflang alternates, canonical-links with `base_path`). Not browser-testable, left to
the review loop: AC 1 (`ROADMAP.md`), AC 4 (fleet match, release readiness), AC 5
(catalog entries prepared). A theme *package's* `robots.txt` (step 9) needs a theme
package installed and is covered by the integration test, not here. This guide covers
AC 2 and AC 3.

## Preconditions

- **Role / user:** crawler (anonymous), no login
- **Test data:** throwaway site from the conventions' boot line (temp dir, local plugin
  installed by path), plus — in that temp site only — `origin: https://example.com` in
  `config/app.yaml`; pages (all with `layout`): `pages/a&b.md`, `pages/about us.md`,
  `pages/café.md`, one with `sitemap: false`, one with `robots: noindex`; a translated
  pair `pages/hello.md` (`lang: en`, `slug: hello`) and `pages/de/hello.md`
  (`lang: de`, `slug: hello`); for TC-4/TC-10 a second build with `base_path: /sub`;
  for TC-6 an own `robots.txt` in the site's assets folder (`theme/assets/` on a
  scaffolded site) without a `Sitemap:` line.

## Test cases

### TC-1 — `/sitemap.xml` is a valid sitemaps.org document with absolute URLs

**AC:** "A site depending on the plugin gets a valid sitemaps.org `public/sitemap.xml` with absolute, escaped, `base_path`-aware URLs"
**Status:** PASS

1. Navigate to `/sitemap.xml`.
2. Expect: parsed as XML (no parse error); root `urlset` in namespace `http://www.sitemaps.org/schemas/sitemap/0.9`; every `loc` starts with `https://example.com/`; `/index.html` listed; entries sorted by href.

**Expected:** a well-formed urlset listing every rendered page under the origin.
**Evidence:** 200 text/xml, 0 parse errors, root urlset in the sitemaps.org 0.9 namespace; 6 locs under https://example.com/, sorted, index.html listed; no console errors (scaffold favicon.ico 404 only)

---

### TC-2 — `&` is XML-escaped

**AC:** (same as TC-1 — "escaped")
**Status:** PASS

1. Read the raw source of `/sitemap.xml`.
2. Expect: the `a&b` page's `loc` is `a&amp;b.html` in the source and parses to `a&b.html`.

**Expected:** the document stays well-formed with an `&` in a URL.
**Evidence:** source has a&amp;b.html, DOMParser reads https://example.com/a&b.html

---

### TC-3 — spaces and non-ASCII are percent-encoded

**AC:** (same as TC-1 — "absolute, escaped" URLs; step 8)
**Status:** PASS

1. Read `/sitemap.xml`.
2. Expect: `about%20us.html` and `caf%C3%A9.html`; each loc parses with `new URL()` unchanged; opening both URLs (on localhost) returns the page.

**Expected:** every `loc` is a valid RFC 3986 URL that resolves to its page.
**Evidence:** about%20us.html and caf%C3%A9.html; new URL(loc).href === loc for all 6 locs; both pages return 200

---

### TC-4 — excluded pages are absent (negative)

**AC:** (same as TC-1; D3 exclusion rules)
**Status:** PASS

1. Navigate to `/sitemap.xml`.
2. Expect: the `sitemap: false` and `robots: noindex` pages are not listed; both pages still open.

**Expected:** excluded pages are built but not in the sitemap.
**Evidence:** hidden.html (sitemap: false) and noindex.html (robots: noindex, follow) absent; both pages return 200

---

### TC-5 — hreflang alternates for a translated page

**AC:** (same as TC-1; step 10, ROADMAP O1)
**Status:** PASS

1. Navigate to `/sitemap.xml`.
2. Expect: the root declares `xmlns:xhtml="http://www.w3.org/1999/xhtml"`; the `hello.html` and `de/hello.html` entries each carry two `xhtml:link rel="alternate"` (`hreflang="en"` and `hreflang="de"`, itself included) with absolute hrefs.

**Expected:** each language version lists every version of the page.
**Evidence:** root declares xmlns:xhtml; hello.html and de/hello.html each carry de + en alternates (itself included), absolute hrefs. Chrome renders the file as text, not the XML tree — normal for any sitemap with XHTML-namespace elements, parse clean

---

### TC-6 — single-language pages get no alternates (negative)

**AC:** (same as TC-5)
**Status:** PASS

1. Navigate to `/sitemap.xml`.
2. Expect: `index.html`, `a&b.html`, `about%20us.html`, `caf%C3%A9.html` have no `xhtml:link`.

**Expected:** alternates only where a translation exists.
**Evidence:** index, a&b, about%20us, caf%C3%A9 have no xhtml:link

---

### TC-7 — `base_path` is applied to locs and alternates

**AC:** (same as TC-1 — "`base_path`-aware"; step 11)
**Status:** PASS

1. Rebuild with `base_path: /sub`, serve, navigate to `/sub/sitemap.xml` (or where the server puts it).
2. Expect: every `loc` and every alternate `href` starts with `https://example.com/sub/`, no double slash; the alternates of the hello pair are still present.

**Expected:** URLs carry the base path exactly once, alternates included.
**Evidence:** base_path /sub: all 6 locs and 4 alternate hrefs start https://example.com/sub/, no double slash, alternates still present; 0 parse errors

---

### TC-8 — `/robots.txt` points at the sitemap

**AC:** "A `robots.txt` pointer to the sitemap is produced (D6)"
**Status:** PASS

1. Navigate to `/robots.txt`.
2. Expect: `User-agent: *`, `Allow: /`, `Sitemap: https://example.com/sitemap.xml` (`…/sub/sitemap.xml` in the base-path build).

**Expected:** a robots.txt whose `Sitemap:` line is the sitemap's absolute URL.
**Evidence:** text/plain: User-agent: * / Allow: / / Sitemap: https://example.com/sitemap.xml (…/sub/sitemap.xml in the base-path build)

---

### TC-9 — the site's own `robots.txt` wins (negative)

**AC:** (same as TC-8; D6)
**Status:** PASS

1. Add `theme/assets/robots.txt` without a `Sitemap:` line, rebuild, navigate to `/robots.txt`.
2. Expect: the site's own file is served unchanged; the build printed a warning naming the `Sitemap:` line to add.

**Expected:** the plugin never overwrites an authored robots.txt.
**Evidence:** theme/assets/robots.txt served unchanged (User-agent: * / Disallow: /private/); build warned 'Add: Sitemap: https://example.com/sub/sitemap.xml'

---
