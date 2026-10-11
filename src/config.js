import path from 'path'
import { getConfig } from '@nera-static/plugin-utils'
import { trimOrigin } from './urls.js'
import { warn } from './warn.js'

// `config/sitemap.yaml` is optional and every key has a default (ROADMAP D7
// and "Configuration"). `getConfig` returns `{}` for a missing file, so each
// key gets its own JS fallback here. A key with a bad value warns and falls
// back to its default rather than failing the build.

export function defaults() {
    return {
        output: 'sitemap.xml',
        exclude: [],
        robots: true,
    }
}

const isPlainObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)

const show = (value) => JSON.stringify(value)

function bad(key, value, fallback) {
    warn(`config/sitemap.yaml: invalid ${key} ${show(value)}, using ${show(fallback)}`)
    return fallback
}

/**
 * `output` as a normalized POSIX path inside `public/`, or null when it is
 * not a non-empty relative file path that stays there (absolute, a drive
 * letter, `..` climbing out, or a directory such as `.` or `foo/`).
 */
export function safeOutput(value) {
    if (typeof value !== 'string') return null
    const slashed = value.trim().replace(/\\/g, '/')
    if (slashed === '' || slashed.endsWith('/')) return null
    if (slashed.startsWith('/') || /^[A-Za-z]:/.test(slashed)) return null
    const normalized = path.posix.normalize(slashed)
    if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) return null
    return normalized
}

function readExclude(value, fallback) {
    const list = typeof value === 'string' ? [value] : value
    if (!Array.isArray(list)) return bad('exclude', value, fallback)
    const patterns = list.filter((pattern) => typeof pattern === 'string' && pattern !== '')
    if (patterns.length !== list.length) {
        warn('config/sitemap.yaml: ignoring exclude entries that are not non-empty strings')
    }
    return patterns
}

const readers = {
    output: (value, fallback) => safeOutput(value) ?? bad('output', value, fallback),
    exclude: readExclude,
    // Anything but `false` keeps the pointer on (ROADMAP "Configuration").
    robots: (value) => value !== false,
}

/**
 * Merge a raw config object over the defaults, key by key, with validation.
 * Pure apart from warnings; `normalizeConfig({})` is the full default config.
 *
 * @param {object} raw parsed `config/sitemap.yaml`
 * @returns {{ output: string, exclude: string[], robots: boolean }}
 */
export function normalizeConfig(raw) {
    const config = defaults()
    if (raw === null || raw === undefined) return config
    if (!isPlainObject(raw)) {
        warn('config/sitemap.yaml: expected a mapping at the top level, using defaults')
        return config
    }

    for (const [key, value] of Object.entries(raw)) {
        const read = readers[key]
        if (!read) {
            warn(`config/sitemap.yaml: ignoring unknown key ${show(key)}`)
            continue
        }
        // A key present but empty reads as null; treat it like an absent key.
        if (value === null) continue
        config[key] = read(value, config[key])
    }
    return config
}

const configFile = (cwd, app, name) =>
    path.resolve(cwd, app?.folders?.config || 'config', name)

/**
 * Read and normalize the site's `config/sitemap.yaml`. Called inside the
 * hook, not at module scope, so each build (and each test) sees the current
 * file. `app.folders.config` is honoured when set, like the rest of the
 * pipeline.
 *
 * @param {{ cwd?: string, app?: object }} [options]
 */
export function loadConfig({ cwd = process.cwd(), app } = {}) {
    return normalizeConfig(getConfig(configFile(cwd, app, 'sitemap.yaml')))
}

/**
 * The site origin without trailing slashes (D2): `app.origin`, else
 * `app_origin` from `config/canonical-links.yaml` — the order
 * plugin-canonical-links and validate use. '' when neither is set; the
 * canonical-links file is only read when `app.origin` is missing, and a
 * missing file reads as `{}`.
 *
 * @param {{ cwd?: string, app?: object }} [options]
 */
export function resolveOrigin({ cwd = process.cwd(), app } = {}) {
    const own = trimOrigin(app?.origin)
    if (own) return own
    const canonical = getConfig(configFile(cwd, app, 'canonical-links.yaml'))
    return trimOrigin(isPlainObject(canonical) ? canonical.app_origin : undefined)
}
