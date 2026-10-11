import { describe, expect, it } from 'vitest'
import * as plugin from '../index.js'

describe('plugin hooks', () => {
    it('exports the synchronous hooks core calls', () => {
        expect(typeof plugin.getAppData).toBe('function')
        expect(typeof plugin.getAssets).toBe('function')
        expect(plugin.getAppData.constructor.name).toBe('Function')
        expect(plugin.getAssets.constructor.name).toBe('Function')
    })

    it('getAppData returns the app object unchanged', () => {
        const app = { lang: 'en', origin: 'https://example.com' }
        expect(plugin.getAppData({ app, pagesData: [] })).toBe(app)
    })

    it('getAssets returns an array of asset entries', () => {
        expect(plugin.getAssets({ app: {}, pagesData: [] })).toEqual([])
    })
})
