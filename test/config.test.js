import path from 'path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getConfig } from '@nera-static/plugin-utils'
import { defaults, loadConfig, normalizeConfig, resolveOrigin, safeOutput } from '../src/config.js'
import { tempDir, write } from './helpers.js'

let warn

beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('normalizeConfig', () => {
    it('returns the defaults for an empty or missing config', () => {
        expect(normalizeConfig({})).toEqual(defaults())
        expect(normalizeConfig(null)).toEqual(defaults())
        expect(normalizeConfig(undefined)).toEqual(defaults())
        expect(warn).not.toHaveBeenCalled()
    })

    it('defaults match the ROADMAP configuration', () => {
        expect(defaults()).toEqual({ output: 'sitemap.xml', exclude: [], robots: true })
    })

    it('the shipped config/sitemap.yaml documents exactly the defaults', () => {
        const shipped = getConfig(path.resolve('config/sitemap.yaml'))
        expect(normalizeConfig(shipped)).toEqual(defaults())
        expect(warn).not.toHaveBeenCalled()
    })

    it('accepts valid values', () => {
        expect(normalizeConfig({
            output: 'seo/map.xml',
            exclude: ['/drafts/*', '/404.html'],
            robots: false,
        })).toEqual({
            output: 'seo/map.xml',
            exclude: ['/drafts/*', '/404.html'],
            robots: false,
        })
        expect(warn).not.toHaveBeenCalled()
    })

    it('treats a key present but empty like an absent key', () => {
        expect(normalizeConfig({ output: null, exclude: null, robots: null })).toEqual(defaults())
    })

    it('falls back to the default output when it would escape public/', () => {
        for (const output of ['../sitemap.xml', 'a/../../x.xml', '/sitemap.xml', 'C:\\x.xml', '..\\x.xml', '', '  ', '.', 'dir/', 42]) {
            expect(normalizeConfig({ output }).output).toBe('sitemap.xml')
        }
        expect(warn).toHaveBeenCalledWith(
            '⚠️ plugin-sitemap: config/sitemap.yaml: invalid output "../sitemap.xml", using "sitemap.xml"'
        )
    })

    it('treats a single exclude string as a one-item list and drops non-strings', () => {
        expect(normalizeConfig({ exclude: '/drafts/*' }).exclude).toEqual(['/drafts/*'])
        expect(warn).not.toHaveBeenCalled()
        expect(normalizeConfig({ exclude: ['/a', 3, '', null, '/b'] }).exclude).toEqual(['/a', '/b'])
        expect(warn).toHaveBeenCalledWith(
            '⚠️ plugin-sitemap: config/sitemap.yaml: ignoring exclude entries that are not non-empty strings'
        )
    })

    it('falls back to [] for an exclude that is neither a string nor a list', () => {
        expect(normalizeConfig({ exclude: { a: 1 } }).exclude).toEqual([])
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('counts anything but false as robots: true', () => {
        expect(normalizeConfig({ robots: false }).robots).toBe(false)
        expect(normalizeConfig({ robots: 'no' }).robots).toBe(true)
        expect(normalizeConfig({ robots: 0 }).robots).toBe(true)
        expect(normalizeConfig({ robots: true }).robots).toBe(true)
    })

    it('warns about unknown keys and a non-mapping top level', () => {
        expect(normalizeConfig({ changefreq: 'daily' })).toEqual(defaults())
        expect(warn).toHaveBeenCalledWith(
            '⚠️ plugin-sitemap: config/sitemap.yaml: ignoring unknown key "changefreq"'
        )
        expect(normalizeConfig(['x'])).toEqual(defaults())
        expect(normalizeConfig('x')).toEqual(defaults())
        expect(warn).toHaveBeenCalledTimes(3)
    })
})

describe('safeOutput', () => {
    it('normalizes a relative path inside public/', () => {
        expect(safeOutput('sitemap.xml')).toBe('sitemap.xml')
        expect(safeOutput(' ./seo//map.xml ')).toBe('seo/map.xml')
        expect(safeOutput('a/../map.xml')).toBe('map.xml')
        expect(safeOutput('seo\\map.xml')).toBe('seo/map.xml')
    })

    it('rejects anything that leaves public/ or names no file', () => {
        expect(safeOutput('..')).toBeNull()
        expect(safeOutput('../x.xml')).toBeNull()
        expect(safeOutput('/x.xml')).toBeNull()
        expect(safeOutput('d:/x.xml')).toBeNull()
        expect(safeOutput('./')).toBeNull()
        expect(safeOutput(undefined)).toBeNull()
    })
})

describe('loadConfig', () => {
    it('yields the defaults when the site has no config file', () => {
        expect(loadConfig({ cwd: tempDir() })).toEqual(defaults())
        expect(warn).not.toHaveBeenCalled()
    })

    it('reads config/sitemap.yaml from the site root', () => {
        const cwd = tempDir()
        write(path.join(cwd, 'config/sitemap.yaml'), 'robots: false\nexclude: /drafts/*\n')
        expect(loadConfig({ cwd })).toEqual({ output: 'sitemap.xml', exclude: ['/drafts/*'], robots: false })
    })

    it('honours app.folders.config', () => {
        const cwd = tempDir()
        write(path.join(cwd, 'settings/sitemap.yaml'), 'output: map.xml\n')
        expect(loadConfig({ cwd, app: { folders: { config: 'settings' } } }).output).toBe('map.xml')
    })
})

describe('resolveOrigin', () => {
    it('prefers app.origin and trims trailing slashes', () => {
        const cwd = tempDir()
        write(path.join(cwd, 'config/canonical-links.yaml'), 'app_origin: https://other.example\n')
        expect(resolveOrigin({ cwd, app: { origin: 'https://example.com//' } })).toBe('https://example.com')
    })

    it('falls back to app_origin in config/canonical-links.yaml', () => {
        const cwd = tempDir()
        write(path.join(cwd, 'config/canonical-links.yaml'), 'app_origin: https://example.org/\n')
        expect(resolveOrigin({ cwd, app: {} })).toBe('https://example.org')
    })

    it('returns "" when neither is set, also without a canonical-links file', () => {
        expect(resolveOrigin({ cwd: tempDir(), app: {} })).toBe('')
        expect(resolveOrigin({ cwd: tempDir() })).toBe('')
        const cwd = tempDir()
        write(path.join(cwd, 'config/canonical-links.yaml'), '- not a mapping\n')
        expect(resolveOrigin({ cwd, app: { origin: '  ' } })).toBe('')
        expect(warn).not.toHaveBeenCalled()
    })
})
