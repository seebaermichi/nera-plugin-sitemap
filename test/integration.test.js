import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { describe, it, expect, beforeAll } from 'vitest'
import { build, tempDir, write } from './helpers.js'

// End to end through core's real pipeline (ROADMAP slice 6): a throwaway
// site in a temp dir loads this repo's index.js as a local plugin from its
// `plugins/` folder, and `run()` builds it — core's frontmatter parsing,
// every plugin hook, and the `getAssets` copy into public/.

const pluginEntry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.js')

const page = (frontmatter, body = 'Text.') => `---\n${frontmatter}\n---\n${body}\n`

/**
 * A bilingual site (en at the root, de under /de) with one page for each
 * D3/D4 case. `files` adds or overrides site files by relative path.
 */
function makeSite(root, files = {}) {
    const site = {
        'package.json': JSON.stringify({ name: 'demo', private: true, type: 'module' }),
        'config/app.yaml': 'name: Demo\nlang: en\norigin: https://example.com/\n',
        'views/layout.pug': 'doctype html\nhtml\n  body\n    main!= content',
        'plugins/sitemap/index.js': `export * from '${pathToFileURL(pluginEntry).href}'\n`,
        'pages/index.md': page('title: Home\nlayout: layout.pug\ndate: 2026-10-01'),
        'pages/q&a.md': page('title: Q and A\nlayout: layout.pug\nlastmod: 2026-10-05T12:30:00Z'),
        'pages/de/index.md': page('title: Start\nlayout: layout.pug\nlang: de\nupdatedAt: 2026-09'),
        'pages/de/impressum.md': page('title: Impressum\nlayout: layout.pug\nlang: de'),
        'pages/fragment.md': page('title: No layout, never rendered'),
        'pages/hidden.md': page('title: Hidden\nlayout: layout.pug\nsitemap: false'),
        'pages/private.md': page('title: Private\nlayout: layout.pug\nrobots: noindex, follow'),
        ...files,
    }
    for (const [rel, content] of Object.entries(site)) write(path.join(root, rel), content)
}

const read = (root, rel) => fs.readFileSync(path.join(root, 'public', rel), 'utf-8')

const SITEMAP = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '    <url>',
    '        <loc>https://example.com/de/impressum.html</loc>',
    '    </url>',
    '    <url>',
    '        <loc>https://example.com/de/index.html</loc>',
    '        <lastmod>2026-09</lastmod>',
    '    </url>',
    '    <url>',
    '        <loc>https://example.com/index.html</loc>',
    '        <lastmod>2026-10-01</lastmod>',
    '    </url>',
    '    <url>',
    '        <loc>https://example.com/q&amp;a.html</loc>',
    '        <lastmod>2026-10-05T12:30:00Z</lastmod>',
    '    </url>',
    '</urlset>',
    '',
].join('\n')

const ROBOTS = 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\n'

describe('a bilingual site without config/sitemap.yaml', () => {
    let root
    let warnings

    beforeAll(async () => {
        root = tempDir('nera-sitemap-int-')
        makeSite(root)
        warnings = await build(root)
    }, 60_000)

    it('builds without warnings', () => {
        expect(warnings).toEqual([])
    })

    it('writes public/sitemap.xml with every rendered, indexable page of both languages', () => {
        expect(read(root, 'sitemap.xml')).toBe(SITEMAP)
    })

    it('writes the robots.txt pointer (D6)', () => {
        expect(read(root, 'robots.txt')).toBe(ROBOTS)
    })

    it('renders the excluded pages, so they are missing only from the sitemap', () => {
        expect(fs.existsSync(path.join(root, 'public', 'hidden.html'))).toBe(true)
        expect(fs.existsSync(path.join(root, 'public', 'private.html'))).toBe(true)
        expect(fs.existsSync(path.join(root, 'public', 'fragment.html'))).toBe(false)
    })

    it('writes a byte-identical sitemap and robots.txt on a second build', async () => {
        const first = [read(root, 'sitemap.xml'), read(root, 'robots.txt')]
        expect(await build(root)).toEqual([])
        expect([read(root, 'sitemap.xml'), read(root, 'robots.txt')]).toEqual(first)
    }, 60_000)
})

describe('a site deployed under base_path', () => {
    let root
    let warnings

    beforeAll(async () => {
        root = tempDir('nera-sitemap-int-')
        makeSite(root, {
            'config/app.yaml': 'name: Demo\nlang: en\nbase_path: /sub/\n',
            'config/canonical-links.yaml': 'app_origin: https://example.org\n',
            'config/sitemap.yaml': 'output: seo/map.xml\nexclude:\n    - /de/*\n',
        })
        warnings = await build(root)
    }, 60_000)

    it('builds without warnings', () => {
        expect(warnings).toEqual([])
    })

    it('prefixes every URL with base_path exactly once, origin from canonical-links', () => {
        const xml = read(root, 'seo/map.xml')
        expect([...xml.matchAll(/<loc>(.*)<\/loc>/g)].map((match) => match[1])).toEqual([
            'https://example.org/sub/index.html',
            'https://example.org/sub/q&amp;a.html',
        ])
    })

    it('points robots.txt at the configured output under base_path', () => {
        expect(read(root, 'robots.txt')).toBe(
            'User-agent: *\nAllow: /\n\nSitemap: https://example.org/sub/seo/map.xml\n'
        )
        expect(fs.existsSync(path.join(root, 'public', 'sitemap.xml'))).toBe(false)
    })
})

describe('a site with its own robots.txt', () => {
    let root
    let warnings

    beforeAll(async () => {
        root = tempDir('nera-sitemap-int-')
        makeSite(root, { 'assets/robots.txt': 'User-agent: *\nDisallow: /private.html\n' })
        warnings = await build(root)
    }, 60_000)

    it('keeps the site file and warns with the line to add', () => {
        expect(read(root, 'robots.txt')).toBe('User-agent: *\nDisallow: /private.html\n')
        expect(warnings).toEqual([
            '⚠️ plugin-sitemap: assets/robots.txt has no Sitemap line, so crawlers ' +
                'reading it will not find the sitemap. Add: Sitemap: https://example.com/sitemap.xml',
        ])
    })

    it('still writes the sitemap', () => {
        expect(read(root, 'sitemap.xml')).toBe(SITEMAP)
    })
})

describe('a site whose .neraignore excludes its own robots.txt', () => {
    let root
    let warnings

    beforeAll(async () => {
        root = tempDir('nera-sitemap-int-')
        makeSite(root, {
            'assets/robots.txt': 'User-agent: *\nDisallow: /private.html\n',
            '.neraignore': 'robots.txt\n',
        })
        warnings = await build(root)
    }, 60_000)

    it('writes the generated pointer instead, without a missing-Sitemap warning', () => {
        expect(read(root, 'robots.txt')).toBe(ROBOTS)
        expect(warnings).toEqual([])
    })
})

describe('a bilingual site with two pages sharing a slug in one language', () => {
    let root
    let warnings

    beforeAll(async () => {
        root = tempDir('nera-sitemap-int-')
        makeSite(root, {
            'pages/about.md': page('title: About\nlayout: layout.pug\nslug: about'),
            'pages/about-old.md': page('title: About (old)\nlayout: layout.pug\nslug: about'),
            'pages/de/about.md': page('title: Über\nlayout: layout.pug\nlang: de\nslug: about'),
        })
        warnings = await build(root)
    }, 60_000)

    it('warns once, naming the slug, the language and both pages', () => {
        expect(warnings).toEqual([
            '⚠️ plugin-sitemap: 2 pages share slug "about" in language "en": ' +
                '/about-old.html, /about.html. The hreflang alternates use /about-old.html ' +
                'for "en"; give the others their own slug.',
        ])
    })

    it('still lists both pages, the first in href order as the alternate', () => {
        const xml = read(root, 'sitemap.xml')
        expect(xml).toContain('<loc>https://example.com/about.html</loc>')
        expect(xml).toContain('hreflang="en" href="https://example.com/about-old.html"')
        expect(xml).not.toContain('hreflang="en" href="https://example.com/about.html"')
    })
})

describe('a site without an origin', () => {
    let root
    let warnings

    beforeAll(async () => {
        root = tempDir('nera-sitemap-int-')
        makeSite(root, { 'config/app.yaml': 'name: Demo\nlang: en\n' })
        warnings = await build(root)
    }, 60_000)

    it('warns once and writes neither sitemap nor robots.txt (D2)', () => {
        expect(warnings).toHaveLength(1)
        expect(warnings[0]).toMatch(/^⚠️ plugin-sitemap: no site origin/)
        expect(fs.existsSync(path.join(root, 'public', 'sitemap.xml'))).toBe(false)
        expect(fs.existsSync(path.join(root, 'public', 'robots.txt'))).toBe(false)
        expect(fs.existsSync(path.join(root, 'public', 'index.html'))).toBe(true)
    })
})
