import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildExportWorkbookBuffer } from './export.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../..')

const readJson = async (filePath, fallback) => {
    try {
        const text = await fs.readFile(filePath, 'utf8')
        return JSON.parse(text)
    } catch {
        return fallback
    }
}

const parseArgs = () => {
    const [, , scope = 'class', ...rest] = process.argv
    const args = { scope }
    for (let i = 0; i < rest.length; i += 2) {
        const key = rest[i]
        const val = rest[i + 1]
        if (!key?.startsWith('--')) continue
        args[key.slice(2)] = val
    }
    return args
}

const studentConfig = (await import('../../../public/configs/student.js')).default

const runExport = async ({ scope, students, out }) => {
    const result = await buildExportWorkbookBuffer({
        studentConfig,
        students,
        scope,
        templateBuffer: await fs.readFile(path.resolve(root, 'public/example.xlsx')),
    })
    await fs.mkdir(path.dirname(out), { recursive: true })
    await fs.writeFile(out, Buffer.from(result.buffer))
    console.log(`exported: ${out}`)
}

const main = async () => {
    const { scope, students: studentsArg, out } = parseArgs()
    const studentsPath = path.resolve(root, studentsArg || 'tmp/students.json')
    const outputPath = path.resolve(root, out || `tmp/${scope}-export.xlsx`)
    const students = await readJson(studentsPath, [])
    await runExport({ scope, students, out: outputPath })
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
