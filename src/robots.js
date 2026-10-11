// The `robots.txt` pointer to the sitemap (ROADMAP D6). Generated only when
// the site ships no `robots.txt` of its own: a site's file is deliberate and
// is never overridden, only checked for a `Sitemap:` line.
import fs from 'fs'
import path from 'path'
import { warn } from './warn.js'

/** The file name, both in the site's assets folder and under `public/`. */
export const ROBOTS_FILE = 'robots.txt'

/** The generated `robots.txt`: allow everything, point at the sitemap. */
export function robotsTxt(sitemapUrl) {
    return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`
}

/** Whether a `robots.txt` has a `Sitemap:` line (case-insensitive, at line start). */
export function hasSitemapLine(text) {
    return /^sitemap\s*:/im.test(text)
}

/**
 * The site's own `robots.txt`: in `app.folders.assets` (core's resolved
 * folder, `./theme/assets` on a theme-folder site), else `./assets`,
 * resolved from the site root.
 */
export function siteRobotsPath({ cwd = process.cwd(), app } = {}) {
    return path.resolve(cwd, app?.folders?.assets || './assets', ROBOTS_FILE)
}

const isFile = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true

/**
 * The `getAssets` entries for `robots.txt`: `[]` when the site ships its own
 * (warning once when that file lacks a `Sitemap:` line), else the generated
 * file, written to `cacheDir` and copied to `public/robots.txt`.
 *
 * @param {{ cwd?: string, app?: object, sitemapUrl: string, cacheDir: string }} options
 * @returns {{ from: string, to: string }[]}
 */
export function robotsAssets({ cwd = process.cwd(), app, sitemapUrl, cacheDir }) {
    const own = siteRobotsPath({ cwd, app })
    if (isFile(own)) {
        if (!hasSitemapLine(fs.readFileSync(own, 'utf-8'))) {
            warn(
                `${path.relative(cwd, own)} has no Sitemap line, so crawlers ` +
                    `reading it will not find the sitemap. Add: Sitemap: ${sitemapUrl}`
            )
        }
        return []
    }

    const from = path.resolve(cacheDir, ROBOTS_FILE)
    fs.mkdirSync(path.dirname(from), { recursive: true })
    fs.writeFileSync(from, robotsTxt(sitemapUrl))
    return [{ from, to: ROBOTS_FILE }]
}
