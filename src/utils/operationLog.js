import { fileSystemManager } from '@/utils/FileSystemManager'

const normalizeScope = (scope) => {
    const s = scope == null ? 'class' : String(scope)
    return s === 'grade' ? 'grade' : 'class'
}

export const operationLogPath = (scope = 'class') =>
    `${normalizeScope(scope)}/logs/operations.jsonl`

export const appendOperationLog = async ({ scope = 'class', entry }) => {
    const path = operationLogPath(scope)
    const previousText = (await fileSystemManager.readFile(path)) || ''
    const line = `${JSON.stringify({ ts: new Date().toISOString(), ...(entry || {}) })}\n`
    await fileSystemManager.writeFile(path, previousText + line)
    return { path, previousText }
}
