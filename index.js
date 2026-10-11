// @nera-static/plugin-sitemap — a sitemap.xml for every rendered page.
//
// `getAppData` guards the core version (core < 4.13.0 never calls
// `getAssets`, so the build would exit 0 without a sitemap). `getAssets`
// sees the final pagesData, writes the sitemap (and, unless the site or its
// theme ships one, a `robots.txt` pointing at it) to `.nera-cache/sitemap/` and
// hands both to core to copy into `public/`. See ROADMAP.md for the
// decisions (D1–D7) behind each step.
import fs from 'fs'
import path from 'path'
import { loadConfig, resolveOrigin } from './src/config.js'
import { assertCoreVersion, coreVersion } from './src/guard.js'
import { robotsAssets } from './src/robots.js'
import { buildSitemap, protocolLimitWarning } from './src/sitemap.js'
import { joinUrl } from './src/urls.js'
import { warn } from './src/warn.js'

/** The plugin's cache folder, relative to the site root (D1). */
export const CACHE_DIR = path.join('.nera-cache', 'sitemap')

export function getAppData({ app }) {
    assertCoreVersion(coreVersion(process.cwd()))
    return app
}

export function getAssets({ app = {}, pagesData = [] } = {}) {
    const cwd = process.cwd()
    const config = loadConfig({ cwd, app })
    const origin = resolveOrigin({ cwd, app })
    if (!origin) {
        warn(
            'no site origin, so no sitemap was written. Set `origin` in ' +
                'config/app.yaml (or `app_origin` in config/canonical-links.yaml).'
        )
        return []
    }

    const xml = buildSitemap(pagesData, {
        origin,
        basePath: app.basePath,
        robots: app.robots,
        exclude: config.exclude,
        lang: app.lang,
        alternates: config.alternates,
        identifier: config.alternates_identifier,
    })
    const limitWarning = protocolLimitWarning(xml)
    if (limitWarning) warn(limitWarning)
    const cacheDir = path.resolve(cwd, CACHE_DIR)
    const from = path.resolve(cacheDir, config.output)
    fs.mkdirSync(path.dirname(from), { recursive: true })
    fs.writeFileSync(from, xml)
    const entries = [{ from, to: config.output }]
    if (!config.robots) return entries

    const sitemapUrl = joinUrl(origin, app.basePath, `/${config.output}`)
    return [...entries, ...robotsAssets({ cwd, app, sitemapUrl, cacheDir })]
}
