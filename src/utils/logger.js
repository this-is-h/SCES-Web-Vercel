const safeStringify = (value) => {
    try {
        if (value instanceof Error) {
            return `${value.name}: ${value.message}\n${value.stack || ''}`.trim()
        }
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

const now = () => new Date().toISOString()

export const createLogger = (scope = 'app') => {
    const prefix = `[${scope}]`

    const debugEnabled = () => {
        try {
            return !!import.meta?.env?.DEV
        } catch {
            return false
        }
    }

    const infoEnabled = () => {
        try {
            return !!import.meta?.env?.DEV
        } catch {
            return false
        }
    }

    const formatArgs = (args) =>
        args.map((a) => (typeof a === 'string' ? a : safeStringify(a)))

    return {
        debug: (...args) => {
            if (!debugEnabled()) return
            console.debug(prefix, now(), ...args)
        },
        info: (...args) => {
            if (!infoEnabled()) return
            console.info(prefix, now(), ...formatArgs(args))
        },
        warn: (...args) => console.warn(prefix, now(), ...formatArgs(args)),
        error: (...args) => console.error(prefix, now(), ...formatArgs(args)),
    }
}
