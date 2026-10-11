import fs from 'fs'
import os from 'os'
import path from 'path'

export const write = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
}

export const tempDir = (prefix = 'nera-sitemap-') =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))
