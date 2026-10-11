import { describe, expect, it } from 'vitest'
import { escapeXml, isExcluded, joinUrl, matchesPattern, trimOrigin } from '../src/urls.js'

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
