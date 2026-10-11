# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-11

### Added

-   First release. Requires `@nera-static/core` 4.13.0 or later (the `getAssets` hook); on an older core the build stops with a message naming the required version.
-   `public/sitemap.xml` in the [sitemaps.org](https://www.sitemaps.org/protocol.html) format, built from the final page list in `getAssets`, so pages other plugins generate are included. Written to `.nera-cache/sitemap/` and copied into `public/` by core.
-   Absolute `<loc>` URLs: `origin` from `config/app.yaml`, else `app_origin` from `config/canonical-links.yaml`, plus `base_path`, plus the page's `href`. Paths are percent-encoded (`about us.html` → `about%20us.html`, non-ASCII as UTF-8 escapes; an existing `%XX` escape is kept, never encoded twice), then XML-escaped. Without an origin the build warns and writes neither file.
-   A build warning when the sitemap exceeds the protocol's limit of 50,000 URLs or 50 MB for one file; the sitemap is still written as one file.
-   Only rendered pages (with `layout`) are listed, sorted by `href`, duplicates dropped. Frontmatter `sitemap: false`, a `robots` value containing `noindex` (frontmatter, else `robots` in `config/app.yaml`) and `exclude` patterns leave a page out.
-   `<lastmod>` from frontmatter `lastmod`, `updatedAt` or `date` (a YAML date or a W3C Datetime string); `createdAt` is never used, because core may fill it from the file's creation time.
-   `public/robots.txt` pointing at the sitemap, unless the site ships its own `robots.txt` in its assets folder; a site file without a `Sitemap:` line gets a warning with the line to add.
-   `config/sitemap.yaml` with `output` (default `sitemap.xml`), `exclude` (default `[]`) and `robots` (default `true`); an invalid `output` or `exclude` and unknown keys warn and fall back to the default; any `robots` value but `false` counts as `true`.
