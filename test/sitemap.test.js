import { describe, expect, it } from 'vitest'
import { buildSitemap, isListed, pickLastmod, toLastmod } from '../src/sitemap.js'

const ORIGIN = 'https://example.com'
const page = (meta) => ({ content: '', meta: { layout: 'pages/default.pug', ...meta } })

describe('toLastmod', () => {
    it('writes a Date at UTC midnight as YYYY-MM-DD', () => {
        expect(toLastmod(new Date('2026-10-01T00:00:00Z'))).toBe('2026-10-01')
    })

    it('writes any other Date as ISO without milliseconds', () => {
        expect(toLastmod(new Date('2026-10-01T09:30:15.123Z'))).toBe('2026-10-01T09:30:15Z')
    })

    it('keeps W3C Datetime strings verbatim', () => {
        for (const value of [
            '2026',
            '2026-10',
            '2026-10-01',
            '2026-10-01T09:30Z',
            '2026-10-01T09:30:15+02:00',
            '2026-10-01T09:30:15.5-05:00',
        ]) {
            expect(toLastmod(value)).toBe(value)
        }
    })

    it('rejects anything else', () => {
        for (const value of [
            new Date('nope'),
            'yesterday',
            '01.10.2026',
            '2026-13-01',
            '2026-10-01T09:30',
            '2026-10-01 09:30:00Z',
            1759276800000,
            null,
            undefined,
        ]) {
            expect(toLastmod(value)).toBeNull()
        }
    })

    it('never falls back to Date#toString', () => {
        const date = new Date('2026-10-01T09:30:00Z')
        expect(toLastmod(date)).not.toBe(date.toString())
        expect(toLastmod(date)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    })
})

describe('pickLastmod', () => {
    it('prefers lastmod, then updatedAt, then date', () => {
        const all = { lastmod: '2026-03-01', updatedAt: '2026-02-01', date: '2026-01-01' }
        expect(pickLastmod(all)).toBe('2026-03-01')
        expect(pickLastmod({ ...all, lastmod: undefined })).toBe('2026-02-01')
        expect(pickLastmod({ date: '2026-01-01' })).toBe('2026-01-01')
    })

    it('skips an invalid value and tries the next key', () => {
        expect(pickLastmod({ lastmod: 'soon', date: new Date('2026-01-01T00:00:00Z') })).toBe('2026-01-01')
    })

    it('never uses createdAt (core may have filled it from the birthtime)', () => {
        expect(pickLastmod({ createdAt: new Date('2026-01-01T00:00:00Z') })).toBeNull()
        expect(pickLastmod({ createdAt: '2026-01-01' })).toBeNull()
    })
})

describe('isListed', () => {
    it('lists a rendered page with an href', () => {
        expect(isListed({ layout: 'x.pug', href: '/a.html' })).toBe(true)
    })

    it('skips pages without layout or href, and missing meta', () => {
        expect(isListed({ href: '/a.html' })).toBe(false)
        expect(isListed({ layout: 'x.pug' })).toBe(false)
        expect(isListed({ layout: 'x.pug', href: '' })).toBe(false)
        expect(isListed({ layout: 'x.pug', href: 42 })).toBe(false)
        expect(isListed(undefined)).toBe(false)
    })

    it('skips sitemap: false', () => {
        expect(isListed({ layout: 'x.pug', href: '/a.html', sitemap: false })).toBe(false)
        expect(isListed({ layout: 'x.pug', href: '/a.html', sitemap: true })).toBe(true)
    })

    it('skips a noindex robots value from frontmatter or the site default', () => {
        expect(isListed({ layout: 'x.pug', href: '/a.html', robots: 'NoIndex, follow' })).toBe(false)
        expect(isListed({ layout: 'x.pug', href: '/a.html' }, { robots: 'noindex' })).toBe(false)
        expect(isListed({ layout: 'x.pug', href: '/a.html', robots: 'index, follow' }, { robots: 'noindex' })).toBe(true)
        expect(isListed({ layout: 'x.pug', href: '/a.html' }, { robots: 'index, follow' })).toBe(true)
    })

    it('skips hrefs matching an exclude pattern', () => {
        expect(isListed({ layout: 'x.pug', href: '/drafts/a.html' }, { exclude: ['/drafts/*'] })).toBe(false)
        expect(isListed({ layout: 'x.pug', href: '/blog/a.html' }, { exclude: ['/drafts/*'] })).toBe(true)
    })
})

describe('buildSitemap', () => {
    it('writes the documented XML shape', () => {
        const xml = buildSitemap([
            page({ href: '/blog/hello.html', date: new Date('2026-10-01T00:00:00Z') }),
            page({ href: '/index.html' }),
        ], { origin: ORIGIN })

        expect(xml).toBe([
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            '    <url>',
            '        <loc>https://example.com/blog/hello.html</loc>',
            '        <lastmod>2026-10-01</lastmod>',
            '    </url>',
            '    <url>',
            '        <loc>https://example.com/index.html</loc>',
            '    </url>',
            '</urlset>',
            '',
        ].join('\n'))
    })

    it('writes a valid empty urlset when no page is listable', () => {
        expect(buildSitemap([], { origin: ORIGIN })).toBe(
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            '</urlset>\n'
        )
    })

    it('prefixes the basePath', () => {
        const xml = buildSitemap([page({ href: '/index.html' })], { origin: ORIGIN, basePath: '/docs' })
        expect(xml).toContain('<loc>https://example.com/docs/index.html</loc>')
    })

    it('escapes the URL', () => {
        const xml = buildSitemap([page({ href: '/a&b/<c>/\'d".html' })], { origin: ORIGIN })
        expect(xml).toContain('<loc>https://example.com/a&amp;b/&lt;c&gt;/&apos;d&quot;.html</loc>')
    })

    it('leaves out unlisted pages and survives junk entries from other plugins', () => {
        const xml = buildSitemap([
            page({ href: '/kept.html' }),
            { meta: { href: '/no-layout.html' } },
            page({ href: undefined }),
            page({ href: '/opt-out.html', sitemap: false }),
            page({ href: '/hidden.html', robots: 'noindex' }),
            page({ href: '/drafts/x.html' }),
            null,
            {},
        ], { origin: ORIGIN, exclude: ['/drafts/*'] })

        expect(xml.match(/<loc>/g)).toHaveLength(1)
        expect(xml).toContain('<loc>https://example.com/kept.html</loc>')
    })

    it('applies the site-wide robots default', () => {
        const xml = buildSitemap([
            page({ href: '/a.html' }),
            page({ href: '/b.html', robots: 'index' }),
        ], { origin: ORIGIN, robots: 'noindex' })

        expect(xml).not.toContain('/a.html')
        expect(xml).toContain('/b.html')
    })

    it('sorts by href in plain string order and drops duplicates', () => {
        const pages = [
            page({ href: '/de/index.html' }),
            page({ href: '/b.html' }),
            page({ href: '/B.html' }),
            page({ href: '/index.html' }),
            page({ href: '/b.html', lastmod: '2026-01-01' }),
        ]
        const xml = buildSitemap(pages, { origin: ORIGIN })
        const locs = [...xml.matchAll(/<loc>(.*)<\/loc>/g)].map((m) => m[1].slice(ORIGIN.length))

        expect(locs).toEqual(['/B.html', '/b.html', '/de/index.html', '/index.html'])
        // the first entry for a duplicate href wins (it has no lastmod here)
        expect(xml).not.toContain('<lastmod>')
    })

    it('is byte-identical for the same pages in any input order', () => {
        const pages = [
            page({ href: '/c.html', date: '2026-03-01' }),
            page({ href: '/a.html', updatedAt: new Date('2026-01-01T12:00:00Z') }),
            page({ href: '/de/b.html', lang: 'de' }),
        ]
        expect(buildSitemap([...pages].reverse(), { origin: ORIGIN }))
            .toBe(buildSitemap(pages, { origin: ORIGIN }))
    })

    it('lists every language under its own URL, without hreflang', () => {
        const xml = buildSitemap([
            page({ href: '/index.html', lang: 'en' }),
            page({ href: '/de/index.html', lang: 'de' }),
        ], { origin: ORIGIN })

        expect(xml).toContain('<loc>https://example.com/index.html</loc>')
        expect(xml).toContain('<loc>https://example.com/de/index.html</loc>')
        expect(xml).not.toContain('hreflang')
    })

    it('ignores createdAt for lastmod', () => {
        const xml = buildSitemap([page({ href: '/a.html', createdAt: new Date() })], { origin: ORIGIN })
        expect(xml).not.toContain('<lastmod>')
    })
})
