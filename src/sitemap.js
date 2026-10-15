// The pure sitemap builder: page data in, sitemaps.org XML out (ROADMAP
// D2–D5 and "XML shape"). No file system, no config — the hooks pass the
// resolved origin, basePath, robots default and exclude patterns.

import { escapeXml, isExcluded, joinUrl } from './urls.js'

const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

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
// `updated` is the key @nera-static/theme-blog and plugin-feed read.
const LASTMOD_KEYS = ['lastmod', 'updatedAt', 'updated', 'date']

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

/** The first valid date among `lastmod`, `updatedAt`, `updated`, `date`, or null. */
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

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

const nonEmptyString = (value) => typeof value === 'string' && value !== ''

// Translations paired by a frontmatter key (O1, the way canonical-links
// pairs them by its `page_identifier`): every listed page with a language
// and the same identifier value is one group. Within a group the first page
// per language in href order wins, so a duplicate cannot make the output
// depend on input order. A duplicate in a group that has translations is
// reported through `onWarning`, once per identifier value and language; in
// a one-language group it changes nothing, so a monolingual site never
// hears about it.
function pairByIdentifier(listed, identifier, langOf, onWarning) {
    const groups = new Map()
    const keyOf = new Map()
    for (const [href, meta] of listed) {
        const value = meta[identifier]
        const lang = langOf(meta)
        if (!lang || !(nonEmptyString(value) || Number.isFinite(value))) continue
        const key = String(value)
        if (!groups.has(key)) groups.set(key, new Map())
        const group = groups.get(key)
        if (!group.has(lang)) group.set(lang, [])
        group.get(lang).push(href)
        keyOf.set(href, key)
    }
    for (const [key, group] of groups) {
        if (group.size < 2) continue
        for (const [lang, hrefs] of group) {
            if (hrefs.length < 2) continue
            onWarning(
                `${hrefs.length} pages share ${identifier} "${key}" in language "${lang}": ` +
                    `${hrefs.join(', ')}. The hreflang alternates use ${hrefs[0]} for ` +
                    `"${lang}"; give the others their own ${identifier}.`
            )
        }
    }
    const firsts = new Map()
    for (const [key, group] of groups) {
        firsts.set(key, new Map([...group].map(([lang, hrefs]) => [lang, hrefs[0]])))
    }
    const translations = new Map()
    for (const [href, key] of keyOf) translations.set(href, firsts.get(key))
    return translations
}

// Translations taken from plugin-canonical-links' `meta.alternateLinks`
// (O1). Its `href` is `origin + basePath + meta.href` since canonical-links
// 2.2.3 and `origin + meta.href` before it (O3), unencoded either way, so
// both forms are resolved back to a listed page (the current one wins if
// they collide) and the URL is rebuilt from that page's `href`; a link to
// an unlisted page (excluded, no layout) or to a page in another language
// than its `hreflang` is dropped.
function pairByAlternateLinks(listed, origin, basePath, langOf) {
    const byUrl = new Map()
    for (const href of listed.keys()) byUrl.set(`${origin}${href}`, href)
    for (const href of listed.keys()) byUrl.set(`${origin}${basePath}${href}`, href)

    const translations = new Map()
    for (const [href, meta] of listed) {
        const lang = langOf(meta)
        if (!lang) continue
        const group = new Map([[lang, href]])
        for (const link of Array.isArray(meta.alternateLinks) ? meta.alternateLinks : []) {
            if (!link || !nonEmptyString(link.hreflang) || group.has(link.hreflang)) continue
            const target = byUrl.get(link.href)
            if (target && langOf(listed.get(target)) === link.hreflang) group.set(link.hreflang, target)
        }
        translations.set(href, group)
    }
    return translations
}

/**
 * The hreflang alternates of every listed page (O1): href → `[{ hreflang,
 * href }]` sorted by hreflang, the page itself included. Only pages with at
 * least two languages get an entry, so a monolingual site gets none.
 *
 * Translations come from `meta.alternateLinks` when plugin-canonical-links
 * filled it for any listed page, else from pairing pages by the frontmatter
 * key `identifier`. A page's language is `meta.lang`, else the site's `lang`.
 * Two translated pages sharing an identifier and a language are reported
 * through `onWarning` (D5); the first in href order is kept.
 *
 * @param {Map<string, object>} listed listed pages, href → meta, in href order
 * @param {{ origin: string, basePath?: string, lang?: string, identifier?: string,
 *   onWarning?: (message: string) => void }} options
 * @returns {Map<string, Array<{ hreflang: string, href: string }>>}
 */
export function collectAlternates(listed, {
    origin,
    basePath = '',
    lang,
    identifier = 'slug',
    onWarning = () => {},
}) {
    const langOf = (meta) =>
        (nonEmptyString(meta.lang) && meta.lang) || (nonEmptyString(lang) && lang) || ''
    const fromLinks = [...listed.values()]
        .some((meta) => Array.isArray(meta.alternateLinks) && meta.alternateLinks.length > 0)
    const translations = fromLinks
        ? pairByAlternateLinks(listed, origin, basePath || '', langOf)
        : pairByIdentifier(listed, identifier, langOf, onWarning)

    const alternates = new Map()
    for (const [href, group] of translations) {
        if (group.size < 2) continue
        alternates.set(href, [...group]
            .sort(([a], [b]) => byString(a, b))
            .map(([hreflang, target]) => ({ hreflang, href: target })))
    }
    return alternates
}

/**
 * The sitemap XML for `pagesData`. Listed pages are deduplicated and
 * sorted by `href` (plain string order), so the same site always yields
 * a byte-identical file. With `alternates: 'auto'` every page that has
 * translations gets `xhtml:link` alternates (O1), and only then does
 * `<urlset>` declare the `xhtml` namespace.
 *
 * @param {Array<{ meta: object }>} pagesData core's page data
 * @param {{ origin: string, basePath?: string, robots?: string, exclude?: string[],
 *   lang?: string, alternates?: 'auto' | false, identifier?: string,
 *   onWarning?: (message: string) => void }} options
 *   `origin` already trimmed (see `trimOrigin`), `robots` and `lang` the
 *   site-wide `app.robots`/`app.lang` defaults, `identifier` the frontmatter
 *   key pairing translations, `onWarning` told about duplicate translations
 * @returns {string}
 */
export function buildSitemap(pagesData, {
    origin,
    basePath = '',
    robots,
    exclude = [],
    lang,
    alternates = 'auto',
    identifier = 'slug',
    onWarning,
}) {
    const byHref = new Map()
    for (const page of pagesData || []) {
        const meta = page && page.meta
        if (!isListed(meta, { robots, exclude })) continue
        if (!byHref.has(meta.href)) byHref.set(meta.href, meta)
    }

    const listed = new Map([...byHref].sort(([a], [b]) => byString(a, b)))
    const alternatesOf = alternates === false
        ? new Map()
        : collectAlternates(listed, { origin, basePath, lang, identifier, onWarning })
    const url = (href) => escapeXml(joinUrl(origin, basePath, href))

    const body = []
    for (const [href, meta] of listed) {
        body.push('    <url>')
        body.push(`        <loc>${url(href)}</loc>`)
        const lastmod = pickLastmod(meta)
        if (lastmod) body.push(`        <lastmod>${lastmod}</lastmod>`)
        for (const alternate of alternatesOf.get(href) || []) {
            body.push(
                '        <xhtml:link rel="alternate" ' +
                    `hreflang="${escapeXml(alternate.hreflang)}" href="${url(alternate.href)}"/>`
            )
        }
        body.push('    </url>')
    }
    const xhtml = alternatesOf.size > 0 ? ` xmlns:xhtml="${XHTML_NAMESPACE}"` : ''
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<urlset xmlns="${NAMESPACE}"${xhtml}>`,
        ...body,
        '</urlset>',
    ]
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
