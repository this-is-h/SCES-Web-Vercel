import { fileSystemManager } from '@/utils/FileSystemManager'
import { safeJsonParse } from '@/utils/json'

const normalizeScope = (scope) => {
    const s = scope == null ? 'class' : String(scope)
    return s === 'grade' ? 'grade' : 'class'
}

const scopePath = (scope, path) => `${normalizeScope(scope)}/${path}`.replace(/\/+/g, '/')
const needUpdateScoreCapsField = '__needUpdateScoreCaps'

export { safeJsonParse }

export const sanitizeFileName = (name) => {
    if (!name) return 'file'
    return String(name)
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
}

export const getStudentIdentity = (student) => {
    const personal = student?.data?.personal
    const name = personal?.姓名?.data
    const id = personal?.学号?.data
    return { name, id }
}

export const getStudentSemester = (student) => {
    const personal = student?.data?.personal
    const year = personal?.年份?.data ?? personal?.year?.data
    const semester = personal?.学期?.data ?? personal?.semester?.data
    if (year == null || semester == null) return null
    return `${String(year)}-${String(semester)}`
}

export const getStudentClassInfo = (student) => {
    const personal = student?.data?.personal ?? {}
    const normalize = (v) =>
        String(v ?? '')
            .trim()
            .replace(/级$/, '')
    return {
        grade: normalize(personal?.年级?.data),
        major: String(personal?.专业?.data ?? '').trim(),
        class: String(personal?.班级?.data ?? '').trim(),
    }
}

export const setStudentClassInfo = ({ student, classInfo }) => {
    if (!student || typeof student !== 'object') return false
    if (!student.data || typeof student.data !== 'object') student.data = {}
    if (!student.data.personal || typeof student.data.personal !== 'object')
        student.data.personal = {}

    const grade = String(classInfo?.grade ?? '')
        .trim()
        .replace(/级$/, '')
    const major = String(classInfo?.major ?? '').trim()
    const clazz = String(classInfo?.class ?? classInfo?.name ?? '').trim()
    if (!grade || !major || !clazz) return false

    const personal = student.data.personal
    const before = getStudentClassInfo(student)

    if (!personal.年级 || typeof personal.年级 !== 'object') personal.年级 = {}
    if (!personal.专业 || typeof personal.专业 !== 'object') personal.专业 = {}
    if (!personal.班级 || typeof personal.班级 !== 'object') personal.班级 = {}

    personal.年级.data = grade
    personal.专业.data = major
    personal.班级.data = clazz

    const after = getStudentClassInfo(student)
    return (
        before.grade !== after.grade || before.major !== after.major || before.class !== after.class
    )
}

export const validateStudentBelongsToClass = ({ student, classInfo }) => {
    const expected = {
        grade: String(classInfo?.grade ?? '')
            .trim()
            .replace(/级$/, ''),
        major: String(classInfo?.major ?? '').trim(),
        class: String(classInfo?.class ?? classInfo?.name ?? '').trim(),
    }
    if (!expected.grade || !expected.major || !expected.class) {
        return { ok: false, message: '未设置班级信息，无法验证学生班级归属' }
    }

    const actual = getStudentClassInfo(student)
    const missing = []
    if (!actual.grade) missing.push('年级')
    if (!actual.major) missing.push('专业')
    if (!actual.class) missing.push('班级')
    if (missing.length) {
        return {
            ok: false,
            message: `导入文件缺少班级归属信息（${missing.join('/')}）`,
        }
    }

    if (
        actual.grade === expected.grade &&
        actual.major === expected.major &&
        actual.class === expected.class
    ) {
        return { ok: true }
    }

    return {
        ok: false,
        message: `非本班学生，已拒绝导入：文件为 ${actual.grade}级 ${actual.major} ${actual.class}，当前班级为 ${expected.grade}级 ${expected.major} ${expected.class}`,
    }
}

export const normalizeSemesterValue = (semesterInput) => {
    if (!semesterInput) return null
    if (typeof semesterInput === 'string') return semesterInput
    if (typeof semesterInput === 'number') return String(semesterInput)
    if (typeof semesterInput === 'object') {
        const rawValue = semesterInput.value ?? semesterInput.label
        return rawValue != null ? String(rawValue) : null
    }
    return String(semesterInput)
}

const legacy11xxOldSequence = [
    '1111',
    '1112',
    '1113',
    '1114',
    '1111',
    '1112',
    '1113',
    '1114',
    '1111',
    '1112',
    '1113',
    '1114',
    '1111',
    '1112',
    '1113',
    '1114',
]

const legacy11xxNextSequence = [
    '1111',
    '1112',
    '1113',
    '1114',
    '1121',
    '1122',
    '1123',
    '1124',
    '1131',
    '1132',
    '1133',
    '1134',
    '1141',
    '1142',
    '1143',
    '1144',
]

const isLegacy11xxWindow = (group, startIndex) => {
    if (!Array.isArray(group)) return false
    if (startIndex < 0 || startIndex + legacy11xxOldSequence.length > group.length) return false
    for (let offset = 0; offset < legacy11xxOldSequence.length; offset++) {
        const number = group[startIndex + offset]?.number
        if (String(number ?? '') !== legacy11xxOldSequence[offset]) return false
    }
    return true
}

const rewriteLegacy11xxWindow = (group, startIndex) => {
    let changed = false
    for (let offset = 0; offset < legacy11xxNextSequence.length; offset++) {
        const item = group[startIndex + offset]
        if (!item || typeof item !== 'object') continue
        const nextCode = legacy11xxNextSequence[offset]
        const current = item.number
        const normalizedCurrent = String(current ?? '')
        if (normalizedCurrent === nextCode) continue
        item.number = typeof current === 'number' ? Number(nextCode) : nextCode
        changed = true
    }
    return changed
}

export const normalizeDyfKeys = (student) => {
    const dyf = student?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return false
    let changed = false
    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (
                let startIndex = 0;
                startIndex <= group.length - legacy11xxOldSequence.length;
                startIndex++
            ) {
                if (!isLegacy11xxWindow(group, startIndex)) continue
                if (rewriteLegacy11xxWindow(group, startIndex)) changed = true
                startIndex += legacy11xxOldSequence.length - 1
            }
        }
    }
    return changed
}

const getNeedUpdateKey = (categoryName, groupIndex, itemIndex) =>
    `${categoryName}::${groupIndex}::${itemIndex}`

const toNeedUpdateScoreCapsMap = (rawCaps) => {
    const caps = new Map()
    if (!rawCaps || typeof rawCaps !== 'object') return caps
    for (const [key, value] of Object.entries(rawCaps)) {
        const score = Number(value)
        if (Number.isFinite(score)) caps.set(key, score)
    }
    return caps
}

const normalizeEvidenceFileNames = (rawFiles) => {
    if (!Array.isArray(rawFiles)) return { files: [], changed: rawFiles != null }
    const files = []
    let changed = false
    for (const entry of rawFiles) {
        if (typeof entry === 'string') {
            const trimmed = entry.trim()
            if (!trimmed) {
                changed = true
                continue
            }
            if (trimmed !== entry) changed = true
            files.push(trimmed)
            continue
        }
        const name = String(entry?.file?.name ?? '').trim()
        if (name) {
            files.push(name)
        }
        changed = true
    }
    return { files, changed }
}

export const buildStudentInfoPayload = ({ student, scope = 'class' }) => {
    const normalizedScope = normalizeScope(scope)
    const legacyCaps = toNeedUpdateScoreCapsMap(student?.[needUpdateScoreCapsField])
    const nextPersonal = {}
    let changed = normalizeDyfKeys(student)

    const personal = student?.data?.personal
    if (personal && typeof personal === 'object') {
        for (const key of Object.keys(personal)) {
            if (key === '班级信息') {
                changed = true
                continue
            }
            const raw = personal[key]
            if (raw && typeof raw === 'object' && 'data' in raw) {
                nextPersonal[key] = { data: raw.data }
                if ('type' in raw || 'pattern' in raw || Object.keys(raw).length !== 1) {
                    changed = true
                }
            } else {
                nextPersonal[key] = { data: raw }
                changed = true
            }
        }
    }

    const nextDyf = {}
    const dyf = student?.data?.dyf
    if (dyf && typeof dyf === 'object') {
        for (const categoryName of Object.keys(dyf)) {
            const groups = dyf[categoryName]
            if (!Array.isArray(groups)) {
                changed = true
                continue
            }
            nextDyf[categoryName] = groups.map((group, groupIndex) => {
                if (!Array.isArray(group)) {
                    changed = true
                    return []
                }
                return group.map((item, itemIndex) => {
                    const source = item && typeof item === 'object' ? item : {}
                    if (source !== item) changed = true

                    const scoreValue = Number(source?.score ?? 0)
                    const score = Number.isFinite(scoreValue) ? scoreValue : 0
                    if (!Number.isFinite(scoreValue)) changed = true

                    const { files, changed: filesChanged } = normalizeEvidenceFileNames(
                        source?.support?.files,
                    )
                    if (filesChanged) changed = true
                    if (source?.support && !Array.isArray(source?.support?.files)) changed = true

                    const nextItem = {
                        number: source?.number,
                        score,
                        support: { files },
                    }

                    const hasDescription = Object.prototype.hasOwnProperty.call(
                        source,
                        'description',
                    )
                    const hasScoreType = Object.prototype.hasOwnProperty.call(source, 'score_type')
                    if (hasDescription || hasScoreType) changed = true

                    if (normalizedScope === 'class') {
                        const originalMaxScore = Number(source?.max_score)
                        let maxScore = Number.isFinite(originalMaxScore) ? originalMaxScore : null
                        if (maxScore === null) {
                            const legacyKey = getNeedUpdateKey(categoryName, groupIndex, itemIndex)
                            const legacyValue = legacyCaps.get(legacyKey)
                            if (Number.isFinite(legacyValue)) {
                                maxScore = legacyValue
                            }
                        }
                        if (maxScore === null) maxScore = score
                        nextItem.max_score = maxScore
                        if (!Number.isFinite(originalMaxScore) || originalMaxScore !== maxScore) {
                            changed = true
                        }
                    } else {
                        const originalMaxScore = Number(source?.max_score)
                        if (Number.isFinite(originalMaxScore)) {
                            nextItem.max_score = originalMaxScore
                        } else if (source?.max_score != null) {
                            changed = true
                        }
                    }

                    if (source?.support && Object.keys(source.support).length !== 1) changed = true
                    return nextItem
                })
            })
        }
    } else if (dyf != null) {
        changed = true
    }

    if (student?.[needUpdateScoreCapsField] != null) changed = true
    if (student && typeof student === 'object') {
        const keys = Object.keys(student)
        if (keys.length !== 1 || keys[0] !== 'data') changed = true
    }
    if (!student?.data || typeof student.data !== 'object') changed = true

    return {
        payload: {
            data: {
                personal: nextPersonal,
                dyf: nextDyf,
            },
        },
        changed,
    }
}

const normalizeTimePayload = (time) => {
    if (!time || typeof time !== 'object' || Array.isArray(time)) return undefined
    const result = {}
    for (const key of Object.keys(time)) {
        const value = time[key]
        if (value == null) continue
        if (typeof value !== 'object' || Array.isArray(value)) {
            result[key] = value
            continue
        }
        const child = {}
        for (const childKey of Object.keys(value)) {
            const childValue = value[childKey]
            if (childValue == null) continue
            if (typeof childValue === 'object') continue
            child[childKey] = childValue
        }
        if (Object.keys(child).length) result[key] = child
    }
    return Object.keys(result).length ? result : undefined
}

const normalizePersonalPayload = (personal) => {
    const out = {}
    if (!personal || typeof personal !== 'object') return out
    for (const key of Object.keys(personal)) {
        const entry = personal[key]
        if (entry && typeof entry === 'object' && 'data' in entry) {
            out[key] = { data: entry.data }
            continue
        }
        out[key] = { data: entry }
    }
    return out
}

export const normalizeImportedStudentPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null
    let student = payload
    if (
        !student?.data?.personal &&
        !student?.data?.dyf &&
        (student?.personal || student?.dyf || student?.time)
    ) {
        student = {
            data: {
                personal: student.personal ?? {},
                dyf: student.dyf ?? {},
            },
            time: student.time,
        }
    } else if (student?.data?.data && (student?.data?.data?.personal || student?.data?.data?.dyf)) {
        student = {
            data: {
                personal: student.data.data.personal ?? {},
                dyf: student.data.data.dyf ?? {},
            },
            time: student.data.time ?? student.time,
        }
    }
    if (!student?.data || typeof student.data !== 'object') return null
    const normalized = {
        data: {
            personal: normalizePersonalPayload(student.data.personal),
            dyf:
                student.data.dyf &&
                typeof student.data.dyf === 'object' &&
                !Array.isArray(student.data.dyf)
                    ? student.data.dyf
                    : {},
        },
    }
    const time = normalizeTimePayload(student.time)
    if (time) normalized.time = time
    return normalized
}

export const buildStudentExportPayload = (student) => {
    const normalized = normalizeImportedStudentPayload(student)
    if (!normalized) return { data: { personal: {}, dyf: {} } }
    const normalizeExportPersonal = (personal) => {
        const out = normalizePersonalPayload(personal)
        delete out['班级信息']
        return out
    }
    const normalizeExportSupportFiles = (rawFiles) => {
        const files = []
        if (!Array.isArray(rawFiles)) return files
        for (const entry of rawFiles) {
            if (typeof entry === 'string') {
                const trimmed = entry.trim()
                if (trimmed) files.push(trimmed)
                continue
            }
            const content = typeof entry?.content === 'string' ? entry.content : ''
            const name = String(entry?.file?.name ?? '').trim()
            if (content && content.startsWith('data:')) {
                files.push({
                    file: name ? { name } : {},
                    content,
                })
                continue
            }
            if (name) files.push(name)
        }
        return files
    }
    const normalizeExportDyf = (dyf) => {
        const out = {}
        if (!dyf || typeof dyf !== 'object') return out
        for (const categoryName of Object.keys(dyf)) {
            const groups = dyf[categoryName]
            if (!Array.isArray(groups)) continue
            out[categoryName] = groups.map((group) => {
                if (!Array.isArray(group)) return []
                return group.map((item) => {
                    const source = item && typeof item === 'object' ? item : {}
                    const scoreValue = Number(source?.score ?? 0)
                    const score = Number.isFinite(scoreValue) ? scoreValue : 0
                    return {
                        number: source?.number,
                        score,
                        support: {
                            files: normalizeExportSupportFiles(source?.support?.files),
                        },
                    }
                })
            })
        }
        return out
    }
    const result = {
        data: {
            personal: normalizeExportPersonal(normalized?.data?.personal),
            dyf: normalizeExportDyf(normalized?.data?.dyf),
        },
    }
    const time = normalizeTimePayload(normalized.time)
    if (time) result.time = time
    return result
}

const dataUrlToBlob = (dataUrl) => {
    const dataUrlMatch = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/)
    if (!dataUrlMatch) return null
    const mimeType = dataUrlMatch[1]
    const base64Payload = dataUrlMatch[2]
    const binaryString = atob(base64Payload)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
    return { blob: new Blob([bytes], { type: mimeType }), mime: mimeType }
}

const extFromMime = (mime) => {
    const m = String(mime || '').toLowerCase()
    if (m.includes('image/webp')) return 'webp'
    if (m.includes('image/png')) return 'png'
    if (m.includes('image/jpeg')) return 'jpg'
    if (m.includes('application/pdf')) return 'pdf'
    return 'bin'
}

const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
}

const getUniqueFileName = async (dirPath, fileName) => {
    const cleaned = sanitizeFileName(fileName)
    const dotIndex = cleaned.lastIndexOf('.')
    const baseName = dotIndex > 0 ? cleaned.slice(0, dotIndex) : cleaned
    const extension = dotIndex > 0 ? cleaned.slice(dotIndex) : ''
    for (let i = 0; i < 100; i++) {
        const candidate = i === 0 ? `${baseName}${extension}` : `${baseName} (${i})${extension}`
        try {
            await fileSystemManager.getFileHandle(`${dirPath}/${candidate}`, false)
        } catch {
            return candidate
        }
    }
    return `${baseName}-${Date.now()}${extension || '.bin'}`
}

export const normalizeEvidenceFiles = async (student, evidenceDirPath) => {
    const dyf = student?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return

    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const files = item?.support?.files
                if (!Array.isArray(files)) continue

                const newFiles = []
                for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
                    const fileEntry = files[fileIndex]
                    if (typeof fileEntry === 'string') {
                        newFiles.push(fileEntry)
                        continue
                    }
                    const content = fileEntry?.content
                    const originalName = fileEntry?.file?.name
                    if (typeof content === 'string' && content.startsWith('data:')) {
                        const parsed = dataUrlToBlob(content)
                        if (!parsed) continue
                        const ext = extFromMime(parsed.mime)
                        const preferred =
                            originalName || `${item?.number ?? 'evidence'}_${fileIndex}.${ext}`
                        const fileName = await getUniqueFileName(evidenceDirPath, preferred)
                        await fileSystemManager.writeFile(
                            `${evidenceDirPath}/${fileName}`,
                            parsed.blob,
                        )
                        newFiles.push(fileName)
                        continue
                    }
                    if (typeof originalName === 'string' && originalName.trim()) {
                        newFiles.push(originalName.trim())
                    }
                }
                const unchanged =
                    newFiles.length === files.length &&
                    newFiles.every((fileName, index) => fileName === files[index])
                if (!unchanged) {
                    item.support.files = newFiles
                }
            }
        }
    }
}

export const getStudentFolderName = ({ name, id }) => {
    return `${sanitizeFileName(name)}_${sanitizeFileName(id)}`
}

export const getStudentDir = ({ scope = 'class', semester, name, id }) => {
    return scopePath(scope, `semesters/${semester}/students/${getStudentFolderName({ name, id })}`)
}

export const writeStudentToDisk = async ({ scope = 'class', semester, student }) => {
    normalizeDyfKeys(student)
    const { name, id } = getStudentIdentity(student) || {}
    if (!name || !id) throw new Error('学生缺少姓名或学号')
    const studentDir = getStudentDir({ scope, semester, name, id })
    const infoPath = `${studentDir}/info.json`
    const evidenceDir = `${studentDir}/evidence`
    await normalizeEvidenceFiles(student, evidenceDir)
    const { payload } = buildStudentInfoPayload({ student, scope })
    await fileSystemManager.writeFile(infoPath, JSON.stringify(payload))
    return { studentDir, infoPath, evidenceDir, name, id }
}

export const embedEvidenceFilesForExport = async ({ scope = 'class', semester, student }) => {
    const cloned = JSON.parse(JSON.stringify(student))
    const { name, id } = getStudentIdentity(cloned) || {}
    if (!name || !id) return cloned
    const baseDir = getStudentDir({ scope, semester, name, id })
    const evidenceDir = `${baseDir}/evidence`

    const dyf = cloned?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return cloned

    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const files = item?.support?.files
                if (!Array.isArray(files) || files.length === 0) continue

                const embedded = []
                for (const f of files) {
                    if (typeof f !== 'string') continue
                    try {
                        const fh = await fileSystemManager.getFileHandle(
                            `${evidenceDir}/${f}`,
                            false,
                        )
                        const file = await fh.getFile()
                        const b64 = arrayBufferToBase64(await file.arrayBuffer())
                        embedded.push({
                            file: { name: f },
                            content: `data:${file.type || 'application/octet-stream'};base64,${b64}`,
                        })
                    } catch {
                        embedded.push(f)
                    }
                }
                item.support.files = embedded
            }
        }
    }

    return cloned
}
