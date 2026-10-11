import fs from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    hasSitemapLine,
    isIgnored,
    readIgnoreList,
    robotsAssets,
    robotsTxt,
    siteRobotsPath,
    themeRobotsPath,
} from '../src/robots.js'
import { tempDir, write } from './helpers.js'

const SITEMAP_URL = 'https://example.com/sitemap.xml'

let warn
let cwd
let cacheDir

beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    cwd = tempDir()
    cacheDir = path.join(cwd, '.nera-cache/sitemap')
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('robotsTxt', () => {
    it('allows everything and points at the sitemap (ROADMAP D6)', () => {
        expect(robotsTxt(SITEMAP_URL)).toBe([
            'User-agent: *',
            'Allow: /',
            '',
            'Sitemap: https://example.com/sitemap.xml',
            '',
        ].join('\n'))
    })
})

describe('hasSitemapLine', () => {
    it('finds a Sitemap line at the start of any line, case-insensitive', () => {
        expect(hasSitemapLine('User-agent: *\nSitemap: https://x/s.xml\n')).toBe(true)
        expect(hasSitemapLine('sitemap: https://x/s.xml')).toBe(true)
        expect(hasSitemapLine('User-agent: *\r\nSITEMAP : https://x/s.xml\r\n')).toBe(true)
    })

    it('ignores a Sitemap mention that is not a directive', () => {
        expect(hasSitemapLine('User-agent: *\nDisallow: /\n')).toBe(false)
        expect(hasSitemapLine('# Sitemap: https://x/s.xml')).toBe(false)
        expect(hasSitemapLine('Disallow: /sitemap:old')).toBe(false)
        expect(hasSitemapLine('')).toBe(false)
    })
})

describe('siteRobotsPath', () => {
    it('defaults to ./assets/robots.txt under the site root', () => {
        expect(siteRobotsPath({ cwd, app: {} })).toBe(path.join(cwd, 'assets/robots.txt'))
        expect(siteRobotsPath({ cwd })).toBe(path.join(cwd, 'assets/robots.txt'))
    })

    it('follows app.folders.assets (core resolves theme/assets there)', () => {
        const app = { folders: { assets: './theme/assets' } }
        expect(siteRobotsPath({ cwd, app })).toBe(path.join(cwd, 'theme/assets/robots.txt'))
    })
})

// An installed theme package in the site's node_modules, as `npm install`
// leaves it; `app.theme` is what core hands the plugins (`{ name, package }`).
const installTheme = (pkg, files = {}) => {
    const root = path.join(cwd, 'node_modules', pkg)
    write(path.join(root, 'package.json'), JSON.stringify({ name: pkg, version: '1.0.0' }))
    for (const [rel, content] of Object.entries(files)) write(path.join(root, rel), content)
    return root
}
const themeApp = (pkg) => ({ theme: { name: pkg, package: pkg } })

describe('themeRobotsPath', () => {
    it('is null without a theme', () => {
        expect(themeRobotsPath({ cwd, app: {} })).toBe(null)
        expect(themeRobotsPath({ cwd })).toBe(null)
    })

    it('resolves a theme package from the site, not from the plugin', () => {
        const root = installTheme('@acme/theme-x')
        expect(themeRobotsPath({ cwd, app: themeApp('@acme/theme-x') }))
            .toBe(path.join(root, 'assets/robots.txt'))

        // Installed next to this plugin, but not in the site: not the site's theme.
        expect(themeRobotsPath({ cwd, app: themeApp('@nera-static/core') })).toBe(null)
    })

    it('is null for a theme package that cannot be resolved', () => {
        expect(themeRobotsPath({ cwd, app: themeApp('@acme/missing') })).toBe(null)

        const root = path.join(cwd, 'node_modules/@acme/closed')
        write(path.join(root, 'package.json'), JSON.stringify({ name: '@acme/closed', exports: { '.': './index.js' } }))
        expect(themeRobotsPath({ cwd, app: themeApp('@acme/closed') })).toBe(null)
    })

    it('resolves a local ./ theme from the site root', () => {
        const app = { theme: { name: './themes/classic', package: null } }
        expect(themeRobotsPath({ cwd, app })).toBe(path.join(cwd, 'themes/classic/assets/robots.txt'))
    })
})

describe('readIgnoreList', () => {
    it('is empty without a .neraignore', () => {
        expect(readIgnoreList(cwd)).toEqual([])
    })

    it('reads trimmed, non-blank lines from the site root, not from assets/', () => {
        write(path.join(cwd, '.neraignore'), 'robots.txt\r\n\n  drafts  \n')
        write(path.join(cwd, 'assets/.neraignore'), 'other\n')
        expect(readIgnoreList(cwd)).toEqual(['robots.txt', 'drafts'])
    })
})

describe('isIgnored', () => {
    const root = path.join('/site', 'assets')

    it('matches an exact path relative to the assets folder', () => {
        expect(isIgnored(['robots.txt'], path.join(root, 'robots.txt'), root)).toBe(true)
        expect(isIgnored(['assets/robots.txt'], path.join(root, 'robots.txt'), root)).toBe(false)
    })

    it('matches a directory prefix only at a / boundary', () => {
        expect(isIgnored(['seo'], path.join(root, 'seo/robots.txt'), root)).toBe(true)
        expect(isIgnored(['robots'], path.join(root, 'robots.txt'), root)).toBe(false)
        expect(isIgnored(['robots.tx'], path.join(root, 'robots.txt'), root)).toBe(false)
    })

    it('ignores nothing with an empty list', () => {
        expect(isIgnored([], path.join(root, 'robots.txt'), root)).toBe(false)
    })
})

describe('robotsAssets', () => {
    it('writes the generated file to the cache and returns its entry', () => {
        const entries = robotsAssets({ cwd, app: {}, sitemapUrl: SITEMAP_URL, cacheDir })
        const from = path.join(cacheDir, 'robots.txt')
        expect(entries).toEqual([{ from, to: 'robots.txt' }])
        expect(fs.readFileSync(from, 'utf-8')).toBe(robotsTxt(SITEMAP_URL))
        expect(warn).not.toHaveBeenCalled()
    })

    it('never overrides the site\'s own robots.txt, and stays quiet when it has a Sitemap line', () => {
        const own = 'User-agent: *\nDisallow: /private/\nSitemap: https://example.com/sitemap.xml\n'
        write(path.join(cwd, 'assets/robots.txt'), own)
        expect(robotsAssets({ cwd, app: {}, sitemapUrl: SITEMAP_URL, cacheDir })).toEqual([])
        expect(fs.readFileSync(path.join(cwd, 'assets/robots.txt'), 'utf-8')).toBe(own)
        expect(fs.existsSync(path.join(cacheDir, 'robots.txt'))).toBe(false)
        expect(warn).not.toHaveBeenCalled()
    })

    it('warns once with the line to add when the site\'s file has no Sitemap line', () => {
        write(path.join(cwd, 'assets/robots.txt'), 'User-agent: *\nDisallow:\n')
        expect(robotsAssets({ cwd, app: {}, sitemapUrl: SITEMAP_URL, cacheDir })).toEqual([])
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledWith(
            '⚠️ plugin-sitemap: assets/robots.txt has no Sitemap line, so crawlers reading it ' +
                'will not find the sitemap. Add: Sitemap: https://example.com/sitemap.xml'
        )
    })

    it('looks for the site\'s file in app.folders.assets, not a hard-coded ./assets', () => {
        const app = { folders: { assets: './theme/assets' } }
        write(path.join(cwd, 'theme/assets/robots.txt'), 'Sitemap: https://example.com/sitemap.xml\n')
        expect(robotsAssets({ cwd, app, sitemapUrl: SITEMAP_URL, cacheDir })).toEqual([])

        // A robots.txt in the unused ./assets folder is not the site's file.
        write(path.join(cwd, 'assets/robots.txt'), 'Sitemap: https://example.com/sitemap.xml\n')
        expect(robotsAssets({ cwd, app: { folders: { assets: './static' } }, sitemapUrl: SITEMAP_URL, cacheDir }))
            .toEqual([{ from: path.join(cacheDir, 'robots.txt'), to: 'robots.txt' }])
    })

    it('generates the file when .neraignore excludes the site\'s robots.txt', () => {
        write(path.join(cwd, 'assets/robots.txt'), 'User-agent: *\nDisallow:\n')
        write(path.join(cwd, '.neraignore'), 'images\nrobots.txt\n')
        expect(robotsAssets({ cwd, app: {}, sitemapUrl: SITEMAP_URL, cacheDir }))
            .toEqual([{ from: path.join(cacheDir, 'robots.txt'), to: 'robots.txt' }])
        expect(warn).not.toHaveBeenCalled()
    })

    it('reads .neraignore from the site root for a site with app.folders.assets', () => {
        const app = { folders: { assets: './theme/assets' } }
        write(path.join(cwd, 'theme/assets/robots.txt'), 'User-agent: *\nDisallow:\n')
        write(path.join(cwd, '.neraignore'), 'robots.txt\n')
        expect(robotsAssets({ cwd, app, sitemapUrl: SITEMAP_URL, cacheDir }))
            .toEqual([{ from: path.join(cacheDir, 'robots.txt'), to: 'robots.txt' }])
        expect(warn).not.toHaveBeenCalled()
    })

    it('keeps the site\'s robots.txt when no .neraignore pattern matches it', () => {
        write(path.join(cwd, 'assets/robots.txt'), 'User-agent: *\nDisallow:\n')
        write(path.join(cwd, '.neraignore'), 'robots\nrobots.txt/\nassets/robots.txt\n')
        expect(robotsAssets({ cwd, app: {}, sitemapUrl: SITEMAP_URL, cacheDir })).toEqual([])
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('falls back to the theme\'s robots.txt when the site\'s is ignored', () => {
        installTheme('@acme/theme-x', { 'assets/robots.txt': 'Sitemap: https://example.com/sitemap.xml\n' })
        write(path.join(cwd, 'assets/robots.txt'), 'User-agent: *\nDisallow:\n')
        write(path.join(cwd, '.neraignore'), 'robots.txt\n')
        expect(robotsAssets({ cwd, app: themeApp('@acme/theme-x'), sitemapUrl: SITEMAP_URL, cacheDir })).toEqual([])
        expect(warn).not.toHaveBeenCalled()
    })

    it('asks to un-ignore the site copy when the theme\'s robots.txt has no Sitemap line', () => {
        installTheme('@acme/theme-x', { 'assets/robots.txt': 'User-agent: *\nDisallow:\n' })
        write(path.join(cwd, '.neraignore'), 'robots.txt\n')
        expect(robotsAssets({ cwd, app: themeApp('@acme/theme-x'), sitemapUrl: SITEMAP_URL, cacheDir })).toEqual([])
        expect(warn).toHaveBeenCalledWith(
            '⚠️ plugin-sitemap: node_modules/@acme/theme-x/assets/robots.txt has no Sitemap line, ' +
                'so crawlers reading it will not find the sitemap. ' +
                'Copy it to assets/robots.txt (and remove it from .neraignore) and add: ' +
                'Sitemap: https://example.com/sitemap.xml'
        )
    })

    it('treats a robots.txt directory as no site file', () => {
        fs.mkdirSync(path.join(cwd, 'assets/robots.txt'), { recursive: true })
        expect(robotsAssets({ cwd, app: {}, sitemapUrl: SITEMAP_URL, cacheDir }))
            .toEqual([{ from: path.join(cacheDir, 'robots.txt'), to: 'robots.txt' }])
    })

    it('never overrides a theme package\'s robots.txt (ROADMAP O4)', () => {
        installTheme('@acme/theme-x', { 'assets/robots.txt': 'Sitemap: https://example.com/sitemap.xml\n' })
        expect(robotsAssets({ cwd, app: themeApp('@acme/theme-x'), sitemapUrl: SITEMAP_URL, cacheDir })).toEqual([])
        expect(fs.existsSync(path.join(cacheDir, 'robots.txt'))).toBe(false)
        expect(warn).not.toHaveBeenCalled()
    })

    it('tells the site to copy a theme\'s robots.txt that has no Sitemap line', () => {
        installTheme('@acme/theme-x', { 'assets/robots.txt': 'User-agent: *\nDisallow:\n' })
        expect(robotsAssets({ cwd, app: themeApp('@acme/theme-x'), sitemapUrl: SITEMAP_URL, cacheDir })).toEqual([])
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledWith(
            '⚠️ plugin-sitemap: node_modules/@acme/theme-x/assets/robots.txt has no Sitemap line, ' +
                'so crawlers reading it will not find the sitemap. ' +
                'Copy it to assets/robots.txt and add: Sitemap: https://example.com/sitemap.xml'
        )
    })

    it('checks only the site\'s file when both the site and the theme ship one', () => {
        installTheme('@acme/theme-x', { 'assets/robots.txt': 'User-agent: *\nDisallow:\n' })
        write(path.join(cwd, 'assets/robots.txt'), 'Sitemap: https://example.com/sitemap.xml\n')
        expect(robotsAssets({ cwd, app: themeApp('@acme/theme-x'), sitemapUrl: SITEMAP_URL, cacheDir })).toEqual([])
        expect(warn).not.toHaveBeenCalled()
    })

    it('generates the file when the theme ships none or cannot be resolved', () => {
        installTheme('@acme/theme-x', { 'views/layout.pug': 'p' })
        const generated = [{ from: path.join(cacheDir, 'robots.txt'), to: 'robots.txt' }]
        expect(robotsAssets({ cwd, app: themeApp('@acme/theme-x'), sitemapUrl: SITEMAP_URL, cacheDir }))
            .toEqual(generated)
        expect(robotsAssets({ cwd, app: themeApp('@acme/missing'), sitemapUrl: SITEMAP_URL, cacheDir }))
            .toEqual(generated)
        expect(warn).not.toHaveBeenCalled()
    })
})
