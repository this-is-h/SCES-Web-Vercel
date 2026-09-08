import { createLogger } from '@/utils/logger'

const log = createLogger('error')

export class AppUserError extends Error {
    constructor(message, { title = '操作失败', userMessage } = {}) {
        super(String(message || userMessage || '操作失败'))
        this.name = 'AppUserError'
        this.isUserError = true
        this.userFacing = true
        this.title = title
        this.userMessage = userMessage || String(message || '操作失败')
    }
}

export const createUserError = ({ message, title, userMessage } = {}) => {
    return new AppUserError(message || userMessage || '操作失败', { title, userMessage })
}

export const isUserError = (err) => {
    return !!(
        err &&
        typeof err === 'object' &&
        (err.userFacing === true || err.isUserError === true || err.name === 'AppUserError')
    )
}

const normalizeError = (err) => {
    if (err instanceof Error) return err
    if (typeof err === 'string') return new Error(err)
    try {
        return new Error(JSON.stringify(err))
    } catch {
        return new Error(String(err))
    }
}

const isChunkLoadError = (err) => {
    const msg = String(err?.message || err || '')
    return (
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('ChunkLoadError')
    )
}

export const reportError = (err, context = {}) => {
    const meta =
        err && typeof err === 'object'
            ? {
                  userFacing: err.userFacing === true || err.isUserError === true,
                  title: typeof err.title === 'string' ? err.title : undefined,
                  userMessage: typeof err.userMessage === 'string' ? err.userMessage : undefined,
              }
            : {}
    const e = normalizeError(err)

    log.error({
        message: e.message,
        stack: e.stack,
        context,
    })

    try {
        window.dispatchEvent(
            new CustomEvent('app:error', {
                detail: {
                    message: e.message,
                    stack: e.stack,
                    context,
                    ...meta,
                    chunkLoad: isChunkLoadError(e),
                    at: Date.now(),
                },
            }),
        )
    } catch {}

    return e
}

const normalizePathHints = (paths) => {
    const arr = Array.isArray(paths) ? paths : paths == null ? [] : [paths]
    const seen = new Set()
    const out = []
    for (const item of arr) {
        const raw = item == null ? '' : String(item)
        const next = raw.replace(/\\/g, '/').replace(/^\/+/, '').trim()
        if (!next || seen.has(next)) continue
        seen.add(next)
        out.push(next)
    }
    return out
}

const appendPathHint = ({ message, paths, missing }) => {
    const normalized = normalizePathHints(paths)
    if (!normalized.length) return message
    const label = missing ? '缺失路径' : '相关路径'
    return `${message}（${label}：${normalized.join('；')}）`
}

export const mapFileSystemErrorToUserMessage = (
    err,
    { action = '操作', pathHints = [] } = {},
) => {
    const name = String(err?.name || '')
    const message = String(err?.message || err || '')
    const lower = message.toLowerCase()

    if (name === 'AbortError') return `${action}已取消`

    if (name === 'NotFoundError') {
        return appendPathHint({
            message: `${action}失败：未找到所需文件或目录`,
            paths: pathHints,
            missing: true,
        })
    }

    if (name === 'TypeMismatchError') {
        return appendPathHint({
            message: `${action}失败：路径类型不匹配（文件/目录类型错误）`,
            paths: pathHints,
            missing: false,
        })
    }

    if (
        name === 'NotAllowedError' ||
        name === 'SecurityError' ||
        lower.includes('permission denied') ||
        lower.includes('not allowed')
    ) {
        return `${action}失败：没有目录访问权限，请重新授权文件夹`
    }

    if (message === 'NO_ROOT_HANDLE') {
        return `${action}失败：未检测到已授权目录，请先完成目录授权`
    }

    if (lower.includes('a requested file or directory could not be found')) {
        return appendPathHint({
            message: `${action}失败：未找到所需文件或目录`,
            paths: pathHints,
            missing: true,
        })
    }

    return message || `${action}失败，请稍后重试`
}
