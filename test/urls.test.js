import { describe, expect, it } from 'vitest'
import { encodePath, escapeXml, isExcluded, joinUrl, matchesPattern, trimOrigin } from '../src/urls.js'

describe('trimOrigin', () => {
    it('drops trailing slashes and surrounding whitespace', () => {
        expect(trimOrigin('https://example.com/')).toBe('https://example.com')
        expect(trimOrigin(' https://example.com// ')).toBe('https://example.com')
        expect(trimOrigin('https://example.com')).toBe('https://example.com')
    })

    it('returns an empty string for a missing or non-string origin', () => {
        expect(trimOrigin(undefined)).toBe('')
        expect(trimOrigin(42)).toBe('')
        expect(trimOrigin('  ')).toBe('')
        expect(trimOrigin('/')).toBe('')
    })
})

describe('joinUrl', () => {
    it('joins origin and href when there is no basePath', () => {
        expect(joinUrl('https://example.com', '', '/blog/a.html')).toBe('https://example.com/blog/a.html')
        expect(joinUrl('https://example.com', undefined, '/index.html')).toBe('https://example.com/index.html')
    })

    it('puts the basePath between origin and href', () => {
        expect(joinUrl('https://example.com', '/docs', '/index.html')).toBe('https://example.com/docs/index.html')
    })

    it('percent-encodes basePath and href, but not the origin', () => {
        expect(joinUrl('https://example.com', '/my docs', '/about us.html')).toBe('https://example.com/my%20docs/about%20us.html')
        expect(joinUrl('https://example.com', '', '/about%20us.html')).toBe('https://example.com/about%20us.html')
    })
})

describe('encodePath', () => {
    it('encodes a space, an umlaut and an emoji (surrogate pair) as UTF-8', () => {
        expect(encodePath('/about us.html')).toBe('/about%20us.html')
        expect(encodePath('/über.html')).toBe('/%C3%BCber.html')
        expect(encodePath('/😀.html')).toBe('/%F0%9F%98%80.html')
    })

    it('leaves a valid escape alone instead of encoding it twice', () => {
        expect(encodePath('/about%20us.html')).toBe('/about%20us.html')
        expect(encodePath('/%c3%bcber.html')).toBe('/%c3%bcber.html')
        expect(encodePath('/a%20b c.html')).toBe('/a%20b%20c.html')
    })

    it('encodes a % that does not start a valid escape', () => {
        expect(encodePath('/100%.html')).toBe('/100%25.html')
        expect(encodePath('/50%off.html')).toBe('/50%25off.html')
        expect(encodePath('/%2.html')).toBe('/%252.html')
    })

    it('keeps URL delimiters and XML special characters for escapeXml', () => {
        expect(encodePath('/a/b-c_d.e~f.html?x=1&y=2#top')).toBe('/a/b-c_d.e~f.html?x=1&y=2#top')
        expect(encodePath('/it\'s.html')).toBe('/it\'s.html')
    })

    it('replaces a lone surrogate instead of throwing', () => {
        expect(encodePath('/\uD800.html')).toBe('/%EF%BF%BD.html')
    })
})

describe('escapeXml', () => {
    it('escapes all five XML special characters', () => {
        expect(escapeXml('a&b<c>d\'e"f')).toBe('a&amp;b&lt;c&gt;d&apos;e&quot;f')
    })

    it('escapes an existing entity again rather than trusting it', () => {
        expect(escapeXml('&amp;')).toBe('&amp;amp;')
    })
})

describe('matchesPattern', () => {
    it('matches literally and anchored at both ends', () => {
        expect(matchesPattern('/imprint.html', '/imprint.html')).toBe(true)
        expect(matchesPattern('/de/imprint.html', '/imprint.html')).toBe(false)
        expect(matchesPattern('/imprint.html.bak', '/imprint.html')).toBe(false)
    })

    it('lets * match any run of characters, slashes included', () => {
        expect(matchesPattern('/drafts/a.html', '/drafts/*')).toBe(true)
        expect(matchesPattern('/drafts/2026/a.html', '/drafts/*')).toBe(true)
        expect(matchesPattern('/de/blog/print.html', '*/print.html')).toBe(true)
        expect(matchesPattern('/blog/a.html', '/drafts/*')).toBe(false)
    })

    it('treats regex characters in the pattern literally', () => {
        expect(matchesPattern('/a.html', '/a.html')).toBe(true)
        expect(matchesPattern('/axhtml', '/a.html')).toBe(false)
        expect(matchesPattern('/(x)+.html', '/(x)+.html')).toBe(true)
    })
})

describe('isExcluded', () => {
    it('is true when any pattern matches', () => {
        expect(isExcluded('/drafts/a.html', ['/x.html', '/drafts/*'])).toBe(true)
        expect(isExcluded('/blog/a.html', ['/x.html', '/drafts/*'])).toBe(false)
    })

    it('excludes nothing without patterns', () => {
        expect(isExcluded('/a.html')).toBe(false)
        expect(isExcluded('/a.html', [])).toBe(false)
    })
})
