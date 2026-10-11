// URL helpers for the sitemap (ROADMAP D2, D3): origin trimming, the
// origin + basePath + href join, XML escaping and `exclude` matching.

const XML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\'': '&apos;',
    '"': '&quot;',
}

/**
 * The site origin without trailing slashes, or '' when it is not a
 * non-empty string (the caller then warns and writes no sitemap).
 */
export function trimOrigin(origin) {
    if (typeof origin !== 'string') return ''
    return origin.trim().replace(/\/+$/, '')
}

/**
 * The absolute URL of a page: origin + basePath + the logical `meta.href`,
 * verbatim (`/index.html` stays as is, so it matches the site's own links).
 * `basePath` is core's normalized `app.basePath` ('' or '/sub').
 */
export function joinUrl(origin, basePath, href) {
    return `${origin}${basePath || ''}${href}`
}

/** Escapes the five XML special characters. */
export function escapeXml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => XML_ENTITIES[char])
}

/**
 * Whether `href` matches an `exclude` pattern: `*` matches any run of
 * characters (including `/`), everything else is literal, anchored at
 * both ends.
 */
export function matchesPattern(href, pattern) {
    const source = pattern
        .split('*')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')
    return new RegExp(`^${source}$`).test(href)
}

/** Whether `href` matches any of the `exclude` patterns. */
export function isExcluded(href, patterns = []) {
    return patterns.some((pattern) => matchesPattern(href, pattern))
}
