# @nera-static/plugin-sitemap

[![Test](https://github.com/seebaermichi/nera-plugin-sitemap/actions/workflows/test.yml/badge.svg)](https://github.com/seebaermichi/nera-plugin-sitemap/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@nera-static/plugin-sitemap)](https://www.npmjs.com/package/@nera-static/plugin-sitemap)

A plugin for the [Nera](https://github.com/seebaermichi/nera) static site generator that writes a [sitemaps.org](https://www.sitemaps.org/protocol.html) `sitemap.xml` for every rendered page at build time, plus a `robots.txt` that points crawlers at it.

📖 **Documentation:** [nera.js.org](https://nera.js.org)

> Requires `@nera-static/core` **4.13.0 or later** (see [Compatibility](#compatibility)).

## ✨ Features

- One `sitemap.xml` built from the final page list, including pages other plugins generate (e.g. tag overview pages)
- Absolute, percent-encoded and XML-escaped URLs that honour `base_path`
- `<lastmod>` from the page's frontmatter (`lastmod`, `updatedAt` or `date`), never from file dates
- Pages leave the sitemap with `sitemap: false`, a `noindex` robots value, or an `exclude` pattern
- `hreflang` alternates for every page that exists in more than one language
- A `robots.txt` pointer to the sitemap, unless your site or its theme ships its own `robots.txt`
- Byte-identical output for the same site, no configuration needed

## 🚀 Installation

```bash
npm install @nera-static/plugin-sitemap
```

Nera detects the plugin and writes the sitemap during `nera build`. Set your site's origin in `config/app.yaml`, because a sitemap needs absolute URLs:

```yaml
origin: https://example.com
```

A site that already uses `@nera-static/plugin-canonical-links` can keep its origin there instead: without `origin` in `config/app.yaml` the plugin reads `app_origin` from `config/canonical-links.yaml`. With neither set, the build prints a warning and writes no sitemap and no `robots.txt`.

`nera build` then writes `public/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://example.com/blog/hello.html</loc>
        <lastmod>2026-10-01</lastmod>
    </url>
    <url>
        <loc>https://example.com/index.html</loc>
    </url>
</urlset>
```

and `public/robots.txt`:

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

## Which pages are listed

Every page Nera renders, which means every page with a `layout` in its frontmatter, sorted by its URL. A page is left out when:

- its frontmatter sets `sitemap: false`;
- its `robots` value contains `noindex` (case-insensitive, e.g. `robots: noindex, follow`). Without `robots` in the frontmatter, `robots` from `config/app.yaml` counts, the same value the default layout writes into `<meta name="robots">`;
- its URL matches an `exclude` pattern in `config/sitemap.yaml`.

Every language of a multilingual site is in the same sitemap, each page under its own URL (`/de/…` pages are just pages).

## Multilingual sites: `hreflang` alternates

A page that exists in more than one language gets an `hreflang` alternate for each of them, itself included:

```xml
<url>
    <loc>https://example.com/about.html</loc>
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/about.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/about.html"/>
</url>
```

A page's language is its frontmatter `lang`, else `lang` from `config/app.yaml`. Translations are found like this:

- with `@nera-static/plugin-canonical-links` installed and configured with `available_languages`, the sitemap uses the same pairs it writes into each page's HTML;
- otherwise pages with the same `slug` in their frontmatter are translations of each other (`alternates_identifier` picks another key).

Only listed pages appear as alternates, so a translation that is excluded or `noindex` is never linked. A page without a translation, and so a single-language site, gets no alternates. Set `alternates: false` to turn them off.

URLs are `origin` + `base_path` + the page's path, exactly as the site links to it: `pages/index.md` is listed as `https://example.com/index.html`, not shortened to `/`.

## `lastmod`

`<lastmod>` comes from the first of these frontmatter keys that holds a valid date: `lastmod`, `updatedAt`, `date`.

```markdown
---
layout: pages/default.pug
title: Hello
date: 2026-10-01
lastmod: 2026-10-08T09:30:00Z
---
```

- A date without a time (`2026-10-01`) is written as `2026-10-01`.
- A date with a time is written in UTC, `2026-10-08T09:30:00Z`.
- A quoted string already in [W3C Datetime](https://www.w3.org/TR/NOTE-datetime) form (`'2026-10'`, `'2026-10-08T11:30+02:00'`) is written as is.
- Anything else is ignored, and the page is listed without `<lastmod>`.

`createdAt` is **never** used: Nera fills it from the file's creation time when the frontmatter has none, and on CI every file is created at the same moment. A page that only sets `createdAt:` gets no `<lastmod>`; add `date:` or `lastmod:`.

There is no `<changefreq>` and no `<priority>`. Both are optional in the protocol, and Google ignores them.

## `robots.txt`

When a sitemap is written, the plugin also writes `public/robots.txt` (shown above), unless:

- `robots: false` is set in `config/sitemap.yaml`, or
- your site has its own `robots.txt` in its assets folder (`assets/robots.txt`, or `folders.assets` from `config/app.yaml`). Your file is never replaced. If it has no `Sitemap:` line, the build prints a warning with the exact line to add.
- your theme ships `assets/robots.txt` (a theme package or a local `./…` theme). The theme's file is kept too; without a `Sitemap:` line the build asks you to copy it into your assets folder and add the line. Your own file wins over the theme's.

Crawlers only read `robots.txt` at the root of a host. On a site deployed under a `base_path` (e.g. `https://example.com/docs/`), the generated `public/robots.txt` ends up at `/docs/robots.txt`, where crawlers do not look. It does no harm there; add the `Sitemap:` line to the host's own `robots.txt` instead, or submit the sitemap in Google Search Console and Bing Webmaster Tools.

## ⚙️ Configuration

Every key is optional, and `config/sitemap.yaml` itself is optional. The package ships the file with its defaults (`node_modules/@nera-static/plugin-sitemap/config/sitemap.yaml`); copy it into your site's `config/` folder to change them:

```yaml
# Where the sitemap lands, relative to public/. Must stay inside public/
# (no leading "/", no "..").
output: sitemap.xml

# Logical hrefs (without base_path) to leave out. "*" matches any characters.
exclude: []
#   - /drafts/*
#   - /404.html

# Generate public/robots.txt pointing at the sitemap, unless the site or its
# theme ships its own robots.txt.
robots: true

# hreflang alternates (xhtml:link) for every page that exists in more than one
# language: "auto" writes them when a page has translations, false never.
alternates: auto

# The frontmatter key that pairs translations when
# @nera-static/plugin-canonical-links has not paired them already.
alternates_identifier: slug
```

| Key | Type | Default | Invalid value |
| --- | --- | --- | --- |
| `output` | string | `sitemap.xml` | not a string, empty, absolute, a directory, outside `public/`, or `robots.txt` → warning, default used |
| `exclude` | list of strings | `[]` | a single string is treated as a one-item list; entries that are not non-empty strings are dropped with a warning; any other type → warning, default used |
| `robots` | boolean | `true` | anything but `false` counts as `true` |
| `alternates` | `auto` or `false` | `auto` | `true` counts as `auto`; any other value → warning, default used |
| `alternates_identifier` | string | `slug` | not a non-empty string → warning, default used |

An unknown key prints a warning and is ignored.

`exclude` patterns are matched against the page's path **without** `base_path`, from start to end: `*` matches any characters, including `/`. `/drafts/*` leaves out everything under `pages/drafts/`, `*/print.html` every `print.html` in any folder, and `/404.html` just that page.

The plugin writes its files to `.nera-cache/sitemap/` in your site (ignored by git in sites created with `nera new`) and lets Nera copy them into `public/`. It adds nothing to `app` or `meta`, and has no templates.

## Known limitations

- One sitemap file. The protocol allows at most 50,000 URLs or 50 MB per file. Above either limit the build prints a warning and still writes one file; a sitemap index for larger sites is not written yet.
- On a `base_path` site, `@nera-static/plugin-canonical-links` before 2.2.3 leaves `base_path` out of its canonical URLs, so they disagree with the sitemap, whose URLs are the deployed ones. Update it to 2.2.3 or later; the sitemap's alternates work with either version.

## Compatibility

- **`@nera-static/core` 4.13.0 or later** (the `getAssets` hook, through which the files reach `public/`). On an older core the build stops with a message naming the required version, rather than exiting cleanly without a sitemap.
- Node.js 20.19.0 or later (or 22.0.0 or later), like `@nera-static/core`.

## 🧪 Development

```bash
npx vitest run
npm run lint
```

`npm test` runs Vitest in watch mode. The integration tests build throwaway sites with the real `@nera-static/core` in a temp directory. `ROADMAP.md` records the design decisions behind the plugin.

## 📦 License

MIT
