// @nera-static/plugin-sitemap — a sitemap.xml for every rendered page.
//
// `getAppData` guards the core version (core < 4.13.0 never calls
// `getAssets`, so the build would exit 0 without a sitemap). `getAssets`
// sees the final pagesData, writes the sitemap to `.nera-cache/sitemap/`
// and hands it to core to copy into `public/`. See ROADMAP.md for the
// decisions (D1–D7) behind each step.
import fs from 'fs'
import path from 'path'
import { loadConfig, resolveOrigin } from './src/config.js'
import { assertCoreVersion, coreVersion } from './src/guard.js'
import { buildSitemap } from './src/sitemap.js'
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
    })
    const from = path.resolve(cwd, CACHE_DIR, config.output)
    fs.mkdirSync(path.dirname(from), { recursive: true })
    fs.writeFileSync(from, xml)
    return [{ from, to: config.output }]
}
