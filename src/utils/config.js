import { fileSystemManager } from '@/utils/FileSystemManager'
import { safeJsonParse } from '@/utils/json'

const normalizeScope = (scope) => {
    const s = scope == null ? 'class' : String(scope)
    return s === 'grade' ? 'grade' : 'class'
}

const configPath = (scope) => `${normalizeScope(scope)}/config.json`

export const migrateLocalConfig = (raw) => {
    if (!raw || typeof raw !== 'object') {
        return { config: { schemaVersion: 1 }, migrated: true }
    }

    if (raw.schemaVersion >= 1) {
        return { config: raw, migrated: false }
    }

    const { grade, major, class: className, ...rest } = raw
    const migrated = {
        schemaVersion: 1,
        ...rest,
    }

    if (!migrated.class && (grade || major || className)) {
        migrated.class = {
            grade: grade != null ? String(grade) : undefined,
            major: major != null ? String(major) : undefined,
            name: className != null ? String(className) : undefined,
        }
    }

    if (!migrated.encryption) migrated.encryption = {}
    return { config: migrated, migrated: true }
}

export const readLocalConfig = async ({ scope = 'class' } = {}) => {
    try {
        const text = await fileSystemManager.readFile(configPath(scope))
        if (!text) return null
        return safeJsonParse(text)
    } catch {
        return null
    }
}

export const writeLocalConfig = async (config, { scope = 'class' } = {}) => {
    await fileSystemManager.writeFile(configPath(scope), JSON.stringify(config ?? {}, null, 2))
}

export const ensureLocalConfig = async ({ scope = 'class' } = {}) => {
    const scopedRaw = await readLocalConfig({ scope })
    let raw = scopedRaw
    let shouldWriteScoped = false

    if (!raw) {
        const legacyText = await fileSystemManager.readFile('config.json')
        const legacy = legacyText ? safeJsonParse(legacyText) : null
        if (legacy) {
            raw = legacy
            shouldWriteScoped = true
        }
    }

    const { config, migrated } = migrateLocalConfig(raw)
    if (migrated || shouldWriteScoped) {
        await writeLocalConfig(config, { scope })
    }
    return config
}

export const getLocalClassInfo = (config) => {
    const classConfig = config?.class
    if (!classConfig || typeof classConfig !== 'object') return null
    const grade = classConfig.grade != null ? String(classConfig.grade) : undefined
    const major = classConfig.major != null ? String(classConfig.major) : undefined
    const name = classConfig.name != null ? String(classConfig.name) : undefined
    if (!grade || !major || !name) return null
    return { grade, major, class: name }
}

const SERVER_CONFIG_FALLBACK = {
    version: '0.0.0',
    year: 2025,
    semester: 2,
    studentRequiredCategories: [],
    studentRequiredExtraItemNumbers: [],
    adminRequiredCategories: [],
    adminRequiredExtraItemNumbers: [],
    totalScorePenaltyCategoryCodes: ['惩罚分'],
    totalScoreNegativeItemNumbers: [8882],
}

const buildServerConfigDefault = () => {
    const fallbackEnc = SERVER_CONFIG_FALLBACK?.encryption ?? {}
    return {
        ...SERVER_CONFIG_FALLBACK,
        encryption: {
            enabled: false,
            rsaPublicKeyJwk: null,
            rsaAlgorithm: { name: 'RSA-OAEP', hash: 'SHA-256' },
            aesAlgorithm: { name: 'AES-GCM', length: 256 },
            ...(fallbackEnc?.rsaAlgorithm ? { rsaAlgorithm: fallbackEnc.rsaAlgorithm } : {}),
            ...(fallbackEnc?.aesAlgorithm ? { aesAlgorithm: fallbackEnc.aesAlgorithm } : {}),
        },
    }
}

const migrateServerConfigKeys = (raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const migrated = { ...raw }

    if (migrated.studentRequiredCategories == null && Array.isArray(migrated.studentNeedUpdate)) {
        migrated.studentRequiredCategories = migrated.studentNeedUpdate
    }
    if (
        migrated.studentRequiredExtraItemNumbers == null &&
        Array.isArray(migrated.studentNeedUpdateExtraItems)
    ) {
        migrated.studentRequiredExtraItemNumbers = migrated.studentNeedUpdateExtraItems
    }
    if (
        migrated.adminRequiredCategories == null &&
        Array.isArray(migrated.studentNeedUpdateShowZeroCategories)
    ) {
        migrated.adminRequiredCategories = migrated.studentNeedUpdateShowZeroCategories
    }
    if (
        migrated.adminRequiredExtraItemNumbers == null &&
        Array.isArray(migrated.studentNeedUpdateShowZeroItems)
    ) {
        migrated.adminRequiredExtraItemNumbers = migrated.studentNeedUpdateShowZeroItems
    }

    delete migrated.studentNeedUpdate
    delete migrated.studentNeedUpdateExtraItems
    delete migrated.studentNeedUpdateShowZeroCategories
    delete migrated.studentNeedUpdateShowZeroItems

    return migrated
}

let serverConfigCached = null
let serverConfigCachedPromise = null

const importPublicConfigModule = async (url) => {
    const sep = url.includes('?') ? '&' : '?'
    const mod = await import(/* @vite-ignore */ `${url}${sep}t=${Date.now()}`)
    return mod?.default ?? mod
}

const getServerConfigUrl = () => {
    const base = import.meta.env.BASE_URL || '/'
    return new URL(
        `${base.replace(/\/?$/, '/')}configs/config.js`,
        window.location.origin,
    ).toString()
}

export const getServerConfig = async ({ force = false } = {}) => {
    if (!force && serverConfigCached) return serverConfigCached
    if (!force && serverConfigCachedPromise) return serverConfigCachedPromise

    serverConfigCachedPromise = (async () => {
        try {
            const data = await importPublicConfigModule(getServerConfigUrl())
            if (!data || typeof data !== 'object') throw new Error('invalid config.js format')
            const merged = { ...buildServerConfigDefault(), ...(data ?? {}) }
            serverConfigCached = migrateServerConfigKeys(merged)
            return serverConfigCached
        } catch {
            serverConfigCached = buildServerConfigDefault()
            return serverConfigCached
        } finally {
            serverConfigCachedPromise = null
        }
    })()

    return serverConfigCachedPromise
}

export const getServerConfigFallback = () => {
    return serverConfigCached ?? buildServerConfigDefault()
}

let studentConfigCached = null
let studentConfigCachedPromise = null

const buildStudentConfigDefault = () => ({
    version: 0,
    revision: 0,
    time: { student: 0, class: 0, grade: 0 },
    data: {
        personal: {
            年份: { data: '', name: 'year', type: 'number', required: true, disabled: true },
            学期: { data: '', name: 'semester', type: 'number', required: true, disabled: true },
        },
        dyf: {},
    },
})

const getStudentConfigUrl = () => {
    const base = import.meta.env.BASE_URL || '/'
    return new URL(
        `${base.replace(/\/?$/, '/')}configs/student.js`,
        window.location.origin,
    ).toString()
}

export const getStudentConfig = async ({ force = false } = {}) => {
    if (!force && studentConfigCached) return studentConfigCached
    if (!force && studentConfigCachedPromise) return studentConfigCachedPromise

    studentConfigCachedPromise = (async () => {
        try {
            const data = await importPublicConfigModule(getStudentConfigUrl())
            if (!data || typeof data !== 'object') throw new Error('invalid student.js format')
            studentConfigCached = data ?? buildStudentConfigDefault()
            return studentConfigCached
        } catch {
            studentConfigCached = studentConfigCached ?? buildStudentConfigDefault()
            return studentConfigCached
        } finally {
            studentConfigCachedPromise = null
        }
    })()

    return studentConfigCachedPromise
}

export const getStudentConfigFallback = () => studentConfigCached
