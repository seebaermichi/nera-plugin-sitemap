// The `robots.txt` pointer to the sitemap (ROADMAP D6). Generated only when
// neither the site nor its theme ships a `robots.txt`: such a file is
// deliberate and is never overridden, only checked for a `Sitemap:` line. A
// site file its `.neraignore` excludes never reaches `public/`, so it does
// not count as shipped.
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
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

/**
 * The theme's `robots.txt`, or `null` without a theme or when its root cannot
 * be found. Core copies theme assets first and plugin assets over them, so a
 * generated file would replace the theme's (ROADMAP O4). The root is found the
 * way core finds it: a package's `package.json` resolved from the site, not
 * from this plugin, or a local `./…` theme relative to the site root. Core has
 * already failed the build on a theme it cannot resolve, so a lookup failure
 * here only means "no theme file".
 */
export function themeRobotsPath({ cwd = process.cwd(), app } = {}) {
    const theme = app?.theme
    if (theme?.package) {
        try {
            const requireFromSite = createRequire(path.join(cwd, 'package.json'))
            const root = path.dirname(requireFromSite.resolve(`${theme.package}/package.json`))
            return path.join(root, 'assets', ROBOTS_FILE)
        } catch {
            return null
        }
    }
    if (typeof theme?.name === 'string' && theme.name.startsWith('.')) {
        return path.resolve(cwd, theme.name, 'assets', ROBOTS_FILE)
    }
    return null
}

/** The site's ignore list file, read from the site root as core reads it. */
export const IGNORE_FILE = '.neraignore'

/**
 * The patterns in the site's `.neraignore` (one per line, trimmed, blank
 * lines dropped), or `[]` without one — core's `getIgnoredFiles` in
 * `render.js`, which reads the file from the site root, not `assets/`.
 */
export function readIgnoreList(cwd = process.cwd()) {
    const file = path.join(cwd, IGNORE_FILE)
    if (!fs.existsSync(file)) return []
    return fs.readFileSync(file, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
}

/**
 * Whether core's site asset pass skips `file`: its path relative to
 * `assetsRoot`, with POSIX separators, equals a pattern or starts with a
 * pattern plus `/` — core's `ignoreFiles` in `render.js`, inverted. So
 * `robots` never matches `robots.txt`, and there are no wildcards.
 */
export function isIgnored(ignoreList, file, assetsRoot) {
    const relative = path.relative(assetsRoot, file).replace(/\\/g, '/')
    return ignoreList.some((pattern) => relative === pattern || relative.startsWith(`${pattern}/`))
}

const isFile = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true

/**
 * The `getAssets` entries for `robots.txt`: `[]` when the site or its theme
 * ships one (the site's file wins, as in core's copy order; warning once when
 * the file that ends up in `public/` lacks a `Sitemap:` line), else the
 * generated file, written to `cacheDir` and copied to `public/robots.txt`.
 * A site file excluded by `.neraignore` is skipped; the theme's never is,
 * since core copies theme assets unfiltered.
 *
 * @param {{ cwd?: string, app?: object, sitemapUrl: string, cacheDir: string }} options
 * @returns {{ from: string, to: string }[]}
 */
export function robotsAssets({ cwd = process.cwd(), app, sitemapUrl, cacheDir }) {
    const site = siteRobotsPath({ cwd, app })
    const theme = themeRobotsPath({ cwd, app })
    const siteIgnored = isIgnored(readIgnoreList(cwd), site, path.dirname(site))
    const own = isFile(site) && !siteIgnored ? site : theme && isFile(theme) ? theme : null
    if (own) {
        if (!hasSitemapLine(fs.readFileSync(own, 'utf-8'))) {
            // A theme's file is not the site's to edit: the fix is a site copy,
            // which `.neraignore` must not exclude.
            const unignore = siteIgnored ? ` (and remove it from ${IGNORE_FILE})` : ''
            const fix = own === site
                ? `Add: Sitemap: ${sitemapUrl}`
                : `Copy it to ${path.relative(cwd, site)}${unignore} and add: Sitemap: ${sitemapUrl}`
            warn(
                `${path.relative(cwd, own)} has no Sitemap line, so crawlers ` +
                    `reading it will not find the sitemap. ${fix}`
            )
        }
        return []
    }

    const from = path.resolve(cacheDir, ROBOTS_FILE)
    fs.mkdirSync(path.dirname(from), { recursive: true })
    fs.writeFileSync(from, robotsTxt(sitemapUrl))
    return [{ from, to: ROBOTS_FILE }]
}
