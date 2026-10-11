import { describe, it, expect } from 'vitest'
import { assertCoreVersion, coreVersion, satisfies } from '../src/guard.js'
import { tempDir } from './helpers.js'

describe('core version guard (D1)', () => {
    it('compares versions', () => {
        expect(satisfies('4.13.0')).toBe(true)
        expect(satisfies('4.14.2')).toBe(true)
        expect(satisfies('5.0.0')).toBe(true)
        expect(satisfies('4.12.9')).toBe(false)
        expect(satisfies('3.99.0')).toBe(false)
        expect(satisfies('4.13.0-beta.1')).toBe(true)
        expect(satisfies('garbage')).toBe(false)
    })

    it('throws on an old core and names the way out', () => {
        expect(() => assertCoreVersion('4.12.0')).toThrow(
            /plugin-sitemap: @nera-static\/core 4\.12\.0 is too old.*>= 4\.13\.0.*npm update/
        )
    })

    it('passes a new or unknown core', () => {
        expect(() => assertCoreVersion('4.14.0')).not.toThrow()
        expect(() => assertCoreVersion(null)).not.toThrow()
    })

    it('finds the installed core', () => {
        // Falls back to the plugin's own devDependency from an empty dir.
        expect(coreVersion(tempDir())).toMatch(/^\d+\.\d+\.\d+/)
    })
})
