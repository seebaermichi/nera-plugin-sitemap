# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-10-25

### Fixed

-   README: drop the pointer to `ROADMAP.md`, which is no longer part of the repository.

## [1.1.0] - 2026-10-15

### Added

-   `<lastmod>` also reads the frontmatter key `updated`, after `lastmod` and `updatedAt` and before `date`. It is the key `@nera-static/theme-blog` and `@nera-static/plugin-feed` use for a post's last change, so a post with `date` and `updated` was listed with its publication date.

## [1.0.1] - 2026-10-11

### Fixed

-   `repository.url` in `package.json` uses the `git+https://….git` form, so `npm publish` no longer warns that it auto-corrected it.

## [1.0.0] - 2026-10-11

### Added

-   First release. Requires `@nera-static/core` 4.13.0 or later (the `getAssets` hook); on an older core the build stops with a message naming the required version.
-   `public/sitemap.xml` in the [sitemaps.org](https://www.sitemaps.org/protocol.html) format, built from the final page list in `getAssets`, so pages other plugins generate are included. Written to `.nera-cache/sitemap/` and copied into `public/` by core.
-   Absolute `<loc>` URLs: `origin` from `config/app.yaml`, else `app_origin` from `config/canonical-links.yaml`, plus `base_path`, plus the page's `href`. Paths are percent-encoded (`about us.html` → `about%20us.html`, non-ASCII as UTF-8 escapes; an existing `%XX` escape is kept, never encoded twice), then XML-escaped. Without an origin the build warns and writes neither file.
-   A build warning when the sitemap exceeds the protocol's limit of 50,000 URLs or 50 MB for one file; the sitemap is still written as one file.
-   Only rendered pages (with `layout`) are listed, sorted by `href`, duplicates dropped. Frontmatter `sitemap: false`, a `robots` value containing `noindex` (frontmatter, else `robots` in `config/app.yaml`) and `exclude` patterns leave a page out.
-   `<lastmod>` from frontmatter `lastmod`, `updatedAt` or `date` (a YAML date or a W3C Datetime string); `createdAt` is never used, because core may fill it from the file's creation time.
-   `public/robots.txt` pointing at the sitemap, unless the site ships its own `robots.txt` in its assets folder (not excluded by its `.neraignore`) or its theme ships one in `assets/`; a file without a `Sitemap:` line gets a warning with the line to add.
-   `hreflang` alternates (`xhtml:link`) for every page that exists in more than one language, itself included: paired like `@nera-static/plugin-canonical-links` pairs them when it ran, else by the frontmatter `slug`. Alternates only point at listed pages; a single-language site gets none. Two translated pages sharing a `slug` in one language warn, naming both; the first in `href` order is used.
-   `config/sitemap.yaml` with `output` (default `sitemap.xml`), `exclude` (default `[]`), `robots` (default `true`), `alternates` (default `auto`, `false` turns them off) and `alternates_identifier` (default `slug`); an invalid `output`, `exclude`, `alternates` or `alternates_identifier` and unknown keys warn and fall back to the default; any `robots` value but `false` counts as `true`.
