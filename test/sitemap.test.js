import { describe, expect, it } from 'vitest'
import { MAX_BYTES, MAX_URLS, buildSitemap, collectAlternates, isListed, pickLastmod, protocolLimitWarning, toLastmod } from '../src/sitemap.js'

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

    it('escapes the URL: & and \' XML-escaped, <, > and " percent-encoded', () => {
        const xml = buildSitemap([page({ href: '/a&b/<c>/\'d".html' })], { origin: ORIGIN })
        expect(xml).toContain('<loc>https://example.com/a&amp;b/%3Cc%3E/&apos;d%22.html</loc>')
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

    it('lists every language under its own URL, without hreflang when nothing pairs them', () => {
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

    it('percent-encodes a <loc> before XML-escaping it', () => {
        const xml = buildSitemap([page({ href: '/a&b c.html' }), page({ href: '/über.html' })], { origin: ORIGIN })
        expect(xml).toContain('<loc>https://example.com/a&amp;b%20c.html</loc>')
        expect(xml).toContain('<loc>https://example.com/%C3%BCber.html</loc>')
    })

    it('matches exclude patterns against the unencoded href', () => {
        const xml = buildSitemap([page({ href: '/über uns/a.html' }), page({ href: '/b.html' })], {
            origin: ORIGIN,
            exclude: ['/über uns/*'],
        })
        expect(xml).not.toContain('a.html')
        expect(xml).toContain('<loc>https://example.com/b.html</loc>')
    })
})

describe('hreflang alternates', () => {
    const XHTML = 'xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    const link = (hreflang, href) =>
        `        <xhtml:link rel="alternate" hreflang="${hreflang}" href="https://example.com${href}"/>`
    const trilingual = [
        page({ href: '/about.html', lang: 'en', slug: 'about', date: '2026-10-01' }),
        page({ href: '/de/about.html', lang: 'de', slug: 'about' }),
        page({ href: '/es/about.html', lang: 'es', slug: 'about' }),
        page({ href: '/imprint.html', lang: 'en', slug: 'imprint' }),
    ]

    it('leaves a monolingual site byte-identical, with no xhtml namespace', () => {
        const pages = [
            page({ href: '/index.html', slug: 'home' }),
            page({ href: '/about.html', slug: 'about' }),
        ]
        const xml = buildSitemap(pages, { origin: ORIGIN, lang: 'en' })
        expect(xml).toBe(buildSitemap(pages, { origin: ORIGIN, alternates: false }))
        expect(xml).not.toContain('xmlns:xhtml')
    })

    it('pairs en/de/es by slug, the page itself included, sorted by hreflang', () => {
        const xml = buildSitemap(trilingual, { origin: ORIGIN })
        const all = [link('de', '/de/about.html'), link('en', '/about.html'), link('es', '/es/about.html')]

        expect(xml).toBe([
            '<?xml version="1.0" encoding="UTF-8"?>',
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ${XHTML}>`,
            '    <url>',
            '        <loc>https://example.com/about.html</loc>',
            '        <lastmod>2026-10-01</lastmod>',
            ...all,
            '    </url>',
            '    <url>',
            '        <loc>https://example.com/de/about.html</loc>',
            ...all,
            '    </url>',
            '    <url>',
            '        <loc>https://example.com/es/about.html</loc>',
            ...all,
            '    </url>',
            '    <url>',
            '        <loc>https://example.com/imprint.html</loc>',
            '    </url>',
            '</urlset>',
            '',
        ].join('\n'))
    })

    it('gives an untranslated page no alternates', () => {
        const alternates = collectAlternates(new Map([
            ['/a.html', { lang: 'en', slug: 'a' }],
            ['/de/b.html', { lang: 'de', slug: 'b' }],
        ]), { origin: ORIGIN })
        expect(alternates.size).toBe(0)
    })

    it('never points at an excluded, noindex or layout-less translation', () => {
        const xml = buildSitemap([
            page({ href: '/a.html', lang: 'en', slug: 'a' }),
            page({ href: '/de/a.html', lang: 'de', slug: 'a' }),
            page({ href: '/es/a.html', lang: 'es', slug: 'a' }),
            page({ href: '/fr/a.html', lang: 'fr', slug: 'a', robots: 'noindex' }),
            { content: '', meta: { href: '/it/a.html', lang: 'it', slug: 'a' } },
        ], { origin: ORIGIN, exclude: ['/es/*'] })

        expect(xml).toContain(link('de', '/de/a.html'))
        expect(xml).toContain(link('en', '/a.html'))
        expect(xml).not.toMatch(/\/(es|fr|it)\/a\.html/)
    })

    it('uses the site lang for pages without one and skips pages without an identifier', () => {
        const xml = buildSitemap([
            page({ href: '/a.html', slug: 'a' }),
            page({ href: '/de/a.html', lang: 'de', slug: 'a' }),
            page({ href: '/b.html', lang: 'en' }),
            page({ href: '/de/b.html', lang: 'de' }),
        ], { origin: ORIGIN, lang: 'en' })

        expect(xml).toContain(link('en', '/a.html'))
        expect(xml.match(/<xhtml:link/g)).toHaveLength(4)
    })

    it('keeps the first page per language in href order', () => {
        const pages = [
            page({ href: '/b.html', lang: 'en', slug: 'x' }),
            page({ href: '/a.html', lang: 'en', slug: 'x' }),
            page({ href: '/de/x.html', lang: 'de', slug: 'x' }),
        ]
        const xml = buildSitemap(pages, { origin: ORIGIN })
        expect(xml).toContain(link('en', '/a.html'))
        expect(xml).not.toContain(link('en', '/b.html'))
        expect(xml).toBe(buildSitemap([...pages].reverse(), { origin: ORIGIN }))
    })

    it('pairs by the configured identifier', () => {
        const xml = buildSitemap([
            page({ href: '/a.html', lang: 'en', key: 1 }),
            page({ href: '/de/a.html', lang: 'de', key: 1, slug: 'other' }),
        ], { origin: ORIGIN, identifier: 'key' })
        expect(xml).toContain(link('de', '/de/a.html'))
    })

    it('writes nothing with alternates: false', () => {
        const xml = buildSitemap(trilingual, { origin: ORIGIN, alternates: false })
        expect(xml).not.toContain('xhtml')
    })

    it('rebuilds canonical-links alternates from meta.href, with basePath and encoding', () => {
        const alternateLinks = (pairs) =>
            pairs.map(([hreflang, href]) => ({ href: `${ORIGIN}${href}`, hreflang, rel: 'alternate' }))
        const xml = buildSitemap([
            page({ href: '/über.html', lang: 'en', alternateLinks: alternateLinks([['de', '/de/über.html']]) }),
            page({ href: '/de/über.html', lang: 'de', alternateLinks: alternateLinks([['en', '/über.html'], ['es', '/es/gone.html']]) }),
            page({ href: '/x.html', lang: 'en', slug: 's', alternateLinks: [] }),
            page({ href: '/de/x.html', lang: 'de', slug: 's', alternateLinks: [] }),
        ], { origin: ORIGIN, basePath: '/docs' })

        expect(xml).toContain(
            '        <xhtml:link rel="alternate" hreflang="de" href="https://example.com/docs/de/%C3%BCber.html"/>'
        )
        expect(xml).toContain(
            '        <xhtml:link rel="alternate" hreflang="en" href="https://example.com/docs/%C3%BCber.html"/>'
        )
        expect(xml).not.toContain('gone.html')
        // canonical-links ran, so its (empty) pairing wins over the slug
        expect(xml).not.toContain('/de/x.html"/>')
    })

    // canonical-links 2.2.3 puts base_path into its hrefs (O3), older
    // versions do not; both must resolve to the same listed pages.
    it.each([
        ['with base_path (canonical-links ≥ 2.2.3)', '/docs'],
        ['without base_path (canonical-links < 2.2.3)', ''],
    ])('resolves canonical-links alternates %s', (_, linkBase) => {
        const alternates = collectAlternates(new Map([
            ['/a.html', { lang: 'en', alternateLinks: [{ href: `${ORIGIN}${linkBase}/de/a.html`, hreflang: 'de' }] }],
            ['/de/a.html', { lang: 'de', alternateLinks: [{ href: `${ORIGIN}${linkBase}/a.html`, hreflang: 'en' }] }],
        ]), { origin: ORIGIN, basePath: '/docs' })
        expect(alternates.get('/a.html')).toEqual([
            { hreflang: 'de', href: '/de/a.html' },
            { hreflang: 'en', href: '/a.html' },
        ])
    })

    it('drops a canonical-links alternate whose page has another language', () => {
        const alternates = collectAlternates(new Map([
            ['/a.html', { lang: 'en', alternateLinks: [{ href: `${ORIGIN}/de/a.html`, hreflang: 'fr' }] }],
            ['/de/a.html', { lang: 'de' }],
        ]), { origin: ORIGIN })
        expect(alternates.size).toBe(0)
    })
})

describe('protocolLimitWarning', () => {
    it('is null within both caps', () => {
        expect(protocolLimitWarning(buildSitemap([page({ href: '/a.html' })], { origin: ORIGIN }))).toBeNull()
        expect(protocolLimitWarning('<url>'.repeat(MAX_URLS))).toBeNull()
    })

    it('names the URL count above 50,000', () => {
        const message = protocolLimitWarning('<url>'.repeat(MAX_URLS + 1))
        expect(message).toContain(`${MAX_URLS + 1} URLs (limit 50000)`)
        expect(message).not.toContain('bytes')
        expect(message).toContain('written as one file')
    })

    it('names the size above 50 MB (in memory, nothing on disk)', () => {
        const message = protocolLimitWarning('x'.repeat(MAX_BYTES + 1))
        expect(message).toContain(`${MAX_BYTES + 1} bytes (limit 52428800)`)
        expect(message).not.toContain('URLs')
    })

    it('counts bytes, not characters', () => {
        expect(protocolLimitWarning('ü'.repeat(MAX_BYTES / 2))).toBeNull()
        expect(protocolLimitWarning(`${'ü'.repeat(MAX_BYTES / 2)}x`)).toContain('bytes')
    })
})
