import fs from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasSitemapLine, robotsAssets, robotsTxt, siteRobotsPath } from '../src/robots.js'
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

    it('treats a robots.txt directory as no site file', () => {
        fs.mkdirSync(path.join(cwd, 'assets/robots.txt'), { recursive: true })
        expect(robotsAssets({ cwd, app: {}, sitemapUrl: SITEMAP_URL, cacheDir }))
            .toEqual([{ from: path.join(cacheDir, 'robots.txt'), to: 'robots.txt' }])
    })
})
