import fs from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as plugin from '../index.js'
import { tempDir, write } from './helpers.js'

const page = (href, extra = {}) => ({ content: '', meta: { layout: 'pages/default.pug', href, ...extra } })

let warn
let cwd

beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    cwd = tempDir()
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('plugin hooks', () => {
    it('exports the synchronous hooks core calls', () => {
        expect(typeof plugin.getAppData).toBe('function')
        expect(typeof plugin.getAssets).toBe('function')
        expect(plugin.getAppData.constructor.name).toBe('Function')
        expect(plugin.getAssets.constructor.name).toBe('Function')
    })

    it('getAppData returns the app object unchanged on a current core', () => {
        const app = { lang: 'en', origin: 'https://example.com' }
        expect(plugin.getAppData({ app, pagesData: [] })).toBe(app)
    })

    it('getAppData throws when the site runs a core without getAssets', () => {
        write(path.join(cwd, 'package.json'), '{}')
        write(path.join(cwd, 'node_modules/@nera-static/core/package.json'), '{"name":"@nera-static/core","version":"4.12.0"}')
        expect(() => plugin.getAppData({ app: {}, pagesData: [] })).toThrow(/4\.12\.0 is too old/)
    })
})

describe('getAssets', () => {
    it('writes the sitemap and robots.txt to the cache and returns their entries for public/', () => {
        const result = plugin.getAssets({
            app: { origin: 'https://example.com/' },
            pagesData: [page('/b.html'), page('/a.html', { date: '2026-10-01' }), { meta: { href: '/nolayout.html' } }],
        })
        const from = path.join(cwd, '.nera-cache/sitemap/sitemap.xml')
        const robots = path.join(cwd, '.nera-cache/sitemap/robots.txt')
        expect(result).toEqual([{ from, to: 'sitemap.xml' }, { from: robots, to: 'robots.txt' }])
        expect(fs.readFileSync(robots, 'utf-8')).toContain('Sitemap: https://example.com/sitemap.xml\n')
        expect(fs.readFileSync(from, 'utf-8')).toBe([
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            '    <url>',
            '        <loc>https://example.com/a.html</loc>',
            '        <lastmod>2026-10-01</lastmod>',
            '    </url>',
            '    <url>',
            '        <loc>https://example.com/b.html</loc>',
            '    </url>',
            '</urlset>',
            '',
        ].join('\n'))
        expect(warn).not.toHaveBeenCalled()
    })

    it('works without any config file (all defaults)', () => {
        const [entry, robots] = plugin.getAssets({ app: { origin: 'https://example.com' }, pagesData: [page('/index.html')] })
        expect(entry.to).toBe('sitemap.xml')
        expect(robots.to).toBe('robots.txt')
        expect(fs.readFileSync(entry.from, 'utf-8')).toContain('<loc>https://example.com/index.html</loc>')
    })

    it('applies basePath, app.robots, exclude and output from the config', () => {
        write(path.join(cwd, 'config/sitemap.yaml'), 'output: seo/map.xml\nexclude: [/drafts/*]\n')
        const [entry, robots] = plugin.getAssets({
            app: { origin: 'https://example.com', basePath: '/sub', robots: 'index, follow' },
            pagesData: [page('/index.html'), page('/drafts/x.html'), page('/hidden.html', { robots: 'noindex' })],
        })
        expect(fs.readFileSync(robots.from, 'utf-8')).toContain('Sitemap: https://example.com/sub/seo/map.xml\n')
        expect(entry).toEqual({ from: path.join(cwd, '.nera-cache/sitemap/seo/map.xml'), to: 'seo/map.xml' })
        const xml = fs.readFileSync(entry.from, 'utf-8')
        expect(xml).toContain('<loc>https://example.com/sub/index.html</loc>')
        expect(xml).not.toContain('drafts')
        expect(xml).not.toContain('hidden')
    })

    it('writes hreflang alternates with app.lang as the default and honours the alternates config', () => {
        const pagesData = [page('/index.html', { key: 'home' }), page('/de/index.html', { lang: 'de', key: 'home' })]
        const app = { origin: 'https://example.com', lang: 'en' }
        write(path.join(cwd, 'config/sitemap.yaml'), 'alternates_identifier: key\n')
        const [entry] = plugin.getAssets({ app, pagesData })
        expect(fs.readFileSync(entry.from, 'utf-8'))
            .toContain('<xhtml:link rel="alternate" hreflang="en" href="https://example.com/index.html"/>')

        write(path.join(cwd, 'config/sitemap.yaml'), 'alternates_identifier: key\nalternates: false\n')
        plugin.getAssets({ app, pagesData })
        expect(fs.readFileSync(entry.from, 'utf-8')).not.toContain('xhtml')
    })

    it('takes the origin from config/canonical-links.yaml when app.yaml has none', () => {
        write(path.join(cwd, 'config/canonical-links.yaml'), 'app_origin: https://example.org/\n')
        const [entry] = plugin.getAssets({ app: {}, pagesData: [page('/index.html')] })
        expect(fs.readFileSync(entry.from, 'utf-8')).toContain('<loc>https://example.org/index.html</loc>')
    })

    it('never writes outside the cache when output tries to escape public/', () => {
        write(path.join(cwd, 'config/sitemap.yaml'), 'output: ../../evil.xml\n')
        const [entry] = plugin.getAssets({ app: { origin: 'https://example.com' }, pagesData: [] })
        expect(entry).toEqual({ from: path.join(cwd, '.nera-cache/sitemap/sitemap.xml'), to: 'sitemap.xml' })
        // `.nera-cache/sitemap/../../evil.xml` would land in the site root.
        expect(fs.existsSync(path.join(cwd, 'evil.xml'))).toBe(false)
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('warns once and returns [] without an origin, writing nothing', () => {
        expect(plugin.getAssets({ app: {}, pagesData: [page('/index.html')] })).toEqual([])
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0][0]).toMatch(/plugin-sitemap: no site origin.*config\/app\.yaml.*canonical-links\.yaml/)
        expect(fs.existsSync(path.join(cwd, '.nera-cache'))).toBe(false)
    })

    it('returns no robots.txt entry with robots: false in the config', () => {
        write(path.join(cwd, 'config/sitemap.yaml'), 'robots: false\n')
        const entries = plugin.getAssets({ app: { origin: 'https://example.com' }, pagesData: [page('/index.html')] })
        expect(entries.map((entry) => entry.to)).toEqual(['sitemap.xml'])
        expect(fs.existsSync(path.join(cwd, '.nera-cache/sitemap/robots.txt'))).toBe(false)
    })

    it('leaves the site\'s own robots.txt alone and warns when it lacks a Sitemap line', () => {
        write(path.join(cwd, 'theme/assets/robots.txt'), 'User-agent: *\nDisallow: /private/\n')
        const entries = plugin.getAssets({
            app: { origin: 'https://example.com', basePath: '/sub', folders: { assets: './theme/assets' } },
            pagesData: [page('/index.html')],
        })
        expect(entries.map((entry) => entry.to)).toEqual(['sitemap.xml'])
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0][0]).toMatch(/theme\/assets\/robots\.txt has no Sitemap line.*Add: Sitemap: https:\/\/example\.com\/sub\/sitemap\.xml$/)
    })

    it('writes no robots.txt without an origin', () => {
        expect(plugin.getAssets({ app: {}, pagesData: [page('/index.html')] })).toEqual([])
        expect(fs.existsSync(path.join(cwd, '.nera-cache/sitemap/robots.txt'))).toBe(false)
    })

    it('returns an array when called without arguments', () => {
        expect(plugin.getAssets()).toEqual([])
    })

    it('gives byte-identical output for the same site', () => {
        const args = { app: { origin: 'https://example.com' }, pagesData: [page('/b.html'), page('/a.html')] }
        const [first] = plugin.getAssets(args)
        const once = fs.readFileSync(first.from, 'utf-8')
        plugin.getAssets({ ...args, pagesData: [...args.pagesData].reverse() })
        expect(fs.readFileSync(first.from, 'utf-8')).toBe(once)
    })

    it('warns above the protocol cap and still writes one sitemap', () => {
        const pagesData = Array.from({ length: 50001 }, (_, index) => page(`/p${index}.html`))
        const [entry] = plugin.getAssets({ app: { origin: 'https://example.com' }, pagesData })
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0][0]).toMatch(/plugin-sitemap: the sitemap has 50001 URLs \(limit 50000\)/)
        expect(entry.to).toBe('sitemap.xml')
        expect(fs.existsSync(entry.from)).toBe(true)
    })
})
