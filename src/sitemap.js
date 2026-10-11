// The pure sitemap builder: page data in, sitemaps.org XML out (ROADMAP
// D2–D5 and "XML shape"). No file system, no config — the hooks pass the
// resolved origin, basePath, robots default and exclude patterns.

import { escapeXml, isExcluded, joinUrl } from './urls.js'

const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'

/** The protocol's cap for one sitemap file: 50,000 URLs (ROADMAP O2). */
export const MAX_URLS = 50000

/** The protocol's cap for one uncompressed sitemap file: 50 MB (O2). */
export const MAX_BYTES = 50 * 1024 * 1024

// W3C Datetime: YYYY, YYYY-MM, YYYY-MM-DD, or a date with
// Thh:mm[:ss[.s]] and a Z/±hh:mm offset.
const W3C_DATETIME = new RegExp(
    '^\\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\\d|3[01])' +
    '(T([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d(\\.\\d+)?)?' +
    '(Z|[+-]([01]\\d|2[0-3]):[0-5]\\d))?)?)?$'
)

// Frontmatter keys tried for <lastmod>, in order. `createdAt` is left out
// on purpose: core fills it from the file's birthtime (D4).
const LASTMOD_KEYS = ['lastmod', 'updatedAt', 'date']

/**
 * A frontmatter value as a W3C Datetime string, or null when it is not a
 * valid date. A `Date` at UTC midnight (YAML's `2026-10-01`) becomes
 * `YYYY-MM-DD`, any other `Date` an ISO string without milliseconds; a
 * string already in W3C form is kept verbatim.
 */
export function toLastmod(value) {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null
        const iso = value.toISOString()
        if (iso.endsWith('T00:00:00.000Z')) return iso.slice(0, 10)
        return iso.replace(/\.\d{3}Z$/, 'Z')
    }
    if (typeof value === 'string' && W3C_DATETIME.test(value)) return value
    return null
}

/** The first valid date among `lastmod`, `updatedAt`, `date`, or null. */
export function pickLastmod(meta) {
    for (const key of LASTMOD_KEYS) {
        const lastmod = toLastmod(meta[key])
        if (lastmod) return lastmod
    }
    return null
}

/**
 * Whether a page belongs in the sitemap (D3): it is rendered (`layout`),
 * has a string `href`, and is not opted out via `sitemap: false`, a
 * `noindex` robots value (frontmatter, else the site default) or an
 * `exclude` pattern.
 */
export function isListed(meta, { robots, exclude = [] } = {}) {
    if (!meta || !meta.layout) return false
    if (typeof meta.href !== 'string' || meta.href === '') return false
    if (meta.sitemap === false) return false
    const effectiveRobots = meta.robots || robots
    if (typeof effectiveRobots === 'string' && /noindex/i.test(effectiveRobots)) return false
    return !isExcluded(meta.href, exclude)
}

/**
 * The sitemap XML for `pagesData`. Listed pages are deduplicated and
 * sorted by `href` (plain string order), so the same site always yields
 * a byte-identical file.
 *
 * @param {Array<{ meta: object }>} pagesData core's page data
 * @param {{ origin: string, basePath?: string, robots?: string, exclude?: string[] }} options
 *   `origin` already trimmed (see `trimOrigin`), `robots` the site-wide
 *   `app.robots` default
 * @returns {string}
 */
export function buildSitemap(pagesData, { origin, basePath = '', robots, exclude = [] }) {
    const byHref = new Map()
    for (const page of pagesData || []) {
        const meta = page && page.meta
        if (!isListed(meta, { robots, exclude })) continue
        if (!byHref.has(meta.href)) byHref.set(meta.href, meta)
    }

    const hrefs = [...byHref.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<urlset xmlns="${NAMESPACE}">`,
    ]
    for (const href of hrefs) {
        lines.push('    <url>')
        lines.push(`        <loc>${escapeXml(joinUrl(origin, basePath, href))}</loc>`)
        const lastmod = pickLastmod(byHref.get(href))
        if (lastmod) lines.push(`        <lastmod>${lastmod}</lastmod>`)
        lines.push('    </url>')
    }
    lines.push('</urlset>')
    return `${lines.join('\n')}\n`
}

/**
 * A warning naming every protocol cap the sitemap `xml` exceeds, or null
 * when it is within both (O2). The file is still written as one; this
 * only tells the site owner that search engines may ignore it.
 */
export function protocolLimitWarning(xml) {
    // `<url>` cannot occur inside a <loc>: joinUrl percent-encodes `<`.
    const urls = (xml.match(/<url>/g) || []).length
    const bytes = Buffer.byteLength(xml)
    const exceeded = []
    if (urls > MAX_URLS) exceeded.push(`${urls} URLs (limit ${MAX_URLS})`)
    if (bytes > MAX_BYTES) exceeded.push(`${bytes} bytes (limit ${MAX_BYTES})`)
    if (exceeded.length === 0) return null
    return `the sitemap has ${exceeded.join(' and ')}, above the sitemaps.org ` +
        'limit for one file, so search engines may ignore it. It was written ' +
        'as one file anyway; a sitemap index is not supported yet.'
}
