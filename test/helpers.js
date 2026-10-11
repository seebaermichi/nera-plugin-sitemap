import fs from 'fs'
import os from 'os'
import path from 'path'
import { vi } from 'vitest'
import run from '@nera-static/core'

export const write = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
}

// The real path: on macOS the tmpdir sits behind the /var -> /private/var
// symlink, and process.cwd() after a chdir reports the real one, so paths
// built from both sides would disagree in `path.relative`.
export const tempDir = (prefix = 'nera-sitemap-') =>
    fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)))

/**
 * Build the site at `root` with core's real `run()`, from inside `root` the
 * way `nera build` runs it. Console output is silenced; the returned array
 * holds every `console.warn` line. The cwd is restored even when the build
 * throws.
 *
 * @param {string} root the site root
 * @returns {Promise<string[]>}
 */
export async function build(root) {
    const prev = process.cwd()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
        process.chdir(root)
        await run({
            folders: {
                config: path.join(root, 'config'),
                pages: path.join(root, 'pages'),
                views: path.join(root, 'views'),
                assets: path.join(root, 'assets'),
                dist: path.join(root, 'public'),
                plugins: path.join(root, 'plugins'),
            },
        })
        return warn.mock.calls.map((call) => call.join(' '))
    } finally {
        process.chdir(prev)
        log.mockRestore()
        warn.mockRestore()
    }
}
