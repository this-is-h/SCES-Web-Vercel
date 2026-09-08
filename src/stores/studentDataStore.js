import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { fileSystemManager } from '@/utils/FileSystemManager'
import { ensureLocalConfig, getLocalClassInfo } from '@/utils/config'
import {
    buildStudentInfoPayload,
    getStudentIdentity,
    getStudentSemester,
    getStudentClassInfo,
    normalizeDyfKeys,
    normalizeSemesterValue,
    safeJsonParse,
    setStudentClassInfo,
    validateStudentBelongsToClass,
    writeStudentToDisk,
} from '@/utils/studentStorage'

const normalizeScope = (scope) => (String(scope || 'class') === 'grade' ? 'grade' : 'class')

const getDeletedStudentsFilePath = ({ scope, semester }) => {
    if (!semester) return null
    return `${normalizeScope(scope)}/semesters/${semester}/students/_deleted_students.json`
}

const studentIdConflictLockField = '__学号冲突锁定'

const isStudentIdConflictLocked = (student) => {
    const raw = student?.data?.personal?.[studentIdConflictLockField]?.data
    if (raw === true || raw === 1) return true
    const normalized = String(raw ?? '')
        .trim()
        .toLowerCase()
    return (
        normalized === '1' ||
        normalized === 'true' ||
        normalized === 'yes' ||
        normalized === 'locked'
    )
}

const setStudentIdConflictLock = ({ student, locked }) => {
    if (!student || typeof student !== 'object') return false
    if (!student.data || typeof student.data !== 'object') student.data = {}
    if (!student.data.personal || typeof student.data.personal !== 'object')
        student.data.personal = {}
    const before = student.data.personal?.[studentIdConflictLockField]?.data
    if (locked) {
        if (!student.data.personal[studentIdConflictLockField]) {
            student.data.personal[studentIdConflictLockField] = { data: '1' }
            return true
        }
        if (String(before ?? '') !== '1') {
            student.data.personal[studentIdConflictLockField] = { data: '1' }
            return true
        }
        return false
    }
    if (student.data.personal[studentIdConflictLockField] == null) return false
    delete student.data.personal[studentIdConflictLockField]
    return true
}

const isSameStudentByIdentity = (a, b) => {
    const ai = getStudentIdentity(a) || {}
    const bi = getStudentIdentity(b) || {}
    if (!ai.id || !bi.id || !ai.name || !bi.name) return false
    return String(ai.id) === String(bi.id) && String(ai.name) === String(bi.name)
}

const sortByStudentId = (list) => {
    const arr = Array.isArray(list) ? list.slice() : []
    arr.sort((a, b) => {
        const ida = a?.data?.personal?.学号?.data ?? ''
        const idb = b?.data?.personal?.学号?.data ?? ''
        return String(ida).localeCompare(String(idb), 'zh-Hans-CN', { numeric: true })
    })
    return arr
}

const mapLimit = async (items, limit, worker) => {
    const results = new Array(items.length)
    let nextIndex = 0
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++
            results[index] = await worker(items[index], index)
        }
    })
    await Promise.all(workers)
    return results
}

export const useStudentDataStore = defineStore('studentData', () => {
    const buckets = ref(new Map())
    const runIds = ref(new Map())
    const migrationNoticeCounts = ref(new Map())
    const migrationRunning = ref(new Map())

    const getStandardClassInfo = async ({ scope }) => {
        if (normalizeScope(scope) !== 'class') return null
        const config = await ensureLocalConfig({ scope: 'class' })
        return getLocalClassInfo(config)
    }

    const bucketKey = ({ scope, semester }) => {
        const scopeKey = normalizeScope(scope)
        const semesterKey = normalizeSemesterValue(semester)
        if (!semesterKey) return null
        return `${scopeKey}::${String(semesterKey)}`
    }

    const setMigrationRunning = ({ scope, semester, running }) => {
        const key = bucketKey({ scope, semester })
        if (!key) return
        if (running) {
            migrationRunning.value.set(key, true)
            return
        }
        migrationRunning.value.delete(key)
    }

    const isMigratingFor = ({ scope, semester }) => {
        const key = bucketKey({ scope, semester })
        if (!key) return false
        return Boolean(migrationRunning.value.get(key))
    }

    const addMigrationNotice = ({ scope, semester, count = 1 }) => {
        const key = bucketKey({ scope, semester })
        const delta = Number(count)
        if (!key || !Number.isFinite(delta) || delta <= 0) return
        const current = Number(migrationNoticeCounts.value.get(key) || 0)
        migrationNoticeCounts.value.set(key, current + delta)
    }

    const consumeMigrationNotice = ({ scope, semester }) => {
        const key = bucketKey({ scope, semester })
        if (!key) return 0
        const count = Number(migrationNoticeCounts.value.get(key) || 0)
        if (count > 0) migrationNoticeCounts.value.delete(key)
        return Number.isFinite(count) ? count : 0
    }

    const ensureBucket = ({ scope, semester }) => {
        const key = bucketKey({ scope, semester })
        if (!key) return null
        if (!buckets.value.has(key)) {
            buckets.value.set(
                key,
                reactive({
                    scope: normalizeScope(scope),
                    semester: String(normalizeSemesterValue(semester)),
                    students: [],
                    isLoading: false,
                    loadError: '',
                }),
            )
        }
        return buckets.value.get(key)
    }

    const studentsFor = ({ scope, semester }) => {
        const bucket = ensureBucket({ scope, semester })
        return bucket?.students || []
    }

    const isLoadingFor = ({ scope, semester }) => {
        const bucket = ensureBucket({ scope, semester })
        return Boolean(bucket?.isLoading)
    }

    const loadErrorFor = ({ scope, semester }) => {
        const bucket = ensureBucket({ scope, semester })
        return String(bucket?.loadError || '')
    }

    const readDeletedStudentIds = async ({ scope, semester }) => {
        const sem = normalizeSemesterValue(semester)
        const path = getDeletedStudentsFilePath({ scope, semester: sem })
        if (!path) return new Set()
        const exists = await fileSystemManager.exists(path)
        if (!exists) return new Set()
        const text = await fileSystemManager.readFile(path)
        const parsed = safeJsonParse(text)
        if (!Array.isArray(parsed)) return new Set()
        return new Set(
            parsed.map((x) => String(x)).filter((x) => x && x !== 'undefined' && x !== 'null'),
        )
    }

    const writeDeletedStudentIds = async ({ scope, semester, ids }) => {
        const sem = normalizeSemesterValue(semester)
        const path = getDeletedStudentsFilePath({ scope, semester: sem })
        if (!path) return
        await fileSystemManager.writeFile(path, JSON.stringify(Array.from(ids)))
    }

    const markStudentDeleted = async ({ scope, semester, id }) => {
        const sem = normalizeSemesterValue(semester)
        const studentId = id != null ? String(id) : ''
        if (!sem || !studentId) return
        const ids = await readDeletedStudentIds({ scope, semester: sem })
        if (ids.has(studentId)) return
        ids.add(studentId)
        await writeDeletedStudentIds({ scope, semester: sem, ids })
    }

    const unmarkStudentDeleted = async ({ scope, semester, id }) => {
        const sem = normalizeSemesterValue(semester)
        const studentId = id != null ? String(id) : ''
        if (!sem || !studentId) return
        const ids = await readDeletedStudentIds({ scope, semester: sem })
        if (!ids.has(studentId)) return
        ids.delete(studentId)
        await writeDeletedStudentIds({ scope, semester: sem, ids })
    }

    const isStudentDeleted = async ({ scope, semester, id }) => {
        const sem = normalizeSemesterValue(semester)
        const studentId = id != null ? String(id) : ''
        if (!sem || !studentId) return false
        const ids = await readDeletedStudentIds({ scope, semester: sem })
        return ids.has(studentId)
    }

    const findStudentFromDiskById = async ({ scope, semester, id }) => {
        const sem = normalizeSemesterValue(semester)
        const studentId = id != null ? String(id) : ''
        if (!sem || !studentId) return null
        let studentDirs = []
        try {
            studentDirs = await fileSystemManager.readDirectoryStructure(
                `${normalizeScope(scope)}/semesters/${sem}/students`,
                1,
            )
        } catch {
            return null
        }
        const dirs = (studentDirs || []).filter((d) => d.kind === 'directory')
        for (const dir of dirs) {
            try {
                const infoPath = `${dir.path}/info.json`
                const info = await fileSystemManager.readFile(infoPath)
                if (!info) continue
                const parsed = safeJsonParse(info)
                if (!parsed) continue
                const { payload, changed } = buildStudentInfoPayload({
                    student: parsed,
                    scope: normalizeScope(scope),
                })
                if (changed) {
                    await fileSystemManager.writeFile(infoPath, JSON.stringify(payload))
                    addMigrationNotice({ scope, semester: sem, count: 1 })
                }
                normalizeDyfKeys(payload)
                const pid = payload?.data?.personal?.学号?.data
                if (pid != null && String(pid) === studentId)
                    return { student: payload, infoPath, originalText: info }
            } catch {}
        }
        return null
    }

    const findStudentsFromDiskById = async ({ scope, semester, id }) => {
        const sem = normalizeSemesterValue(semester)
        const studentId = id != null ? String(id) : ''
        if (!sem || !studentId) return []
        let studentDirs = []
        try {
            studentDirs = await fileSystemManager.readDirectoryStructure(
                `${normalizeScope(scope)}/semesters/${sem}/students`,
                1,
            )
        } catch {
            return []
        }
        const dirs = (studentDirs || []).filter((d) => d.kind === 'directory')
        const matches = []
        for (const dir of dirs) {
            try {
                const infoPath = `${dir.path}/info.json`
                const info = await fileSystemManager.readFile(infoPath)
                if (!info) continue
                const parsed = safeJsonParse(info)
                if (!parsed) continue
                const { payload, changed } = buildStudentInfoPayload({
                    student: parsed,
                    scope: normalizeScope(scope),
                })
                if (changed) {
                    await fileSystemManager.writeFile(infoPath, JSON.stringify(payload))
                    addMigrationNotice({ scope, semester: sem, count: 1 })
                }
                normalizeDyfKeys(payload)
                const pid = payload?.data?.personal?.学号?.data
                if (pid == null || String(pid) !== studentId) continue
                const { name, id: sid } = getStudentIdentity(payload) || {}
                matches.push({
                    student: payload,
                    infoPath,
                    dirPath: dir.path,
                    name: String(name || ''),
                    id: String(sid || ''),
                    locked: isStudentIdConflictLocked(payload),
                })
            } catch {}
        }
        return matches
    }

    const getConflictCandidatesById = async ({ scope, semester, id }) => {
        const sem = normalizeSemesterValue(semester)
        const studentId = id != null ? String(id) : ''
        if (!sem || !studentId) return []
        const fromDisk = await findStudentsFromDiskById({ scope, semester: sem, id: studentId })
        const seen = new Set()
        const out = []
        const push = (entry) => {
            const student = entry?.student
            const { name, id: sid } = getStudentIdentity(student) || {}
            if (!name || !sid) return
            const key = `${String(sid)}::${String(name)}`
            if (seen.has(key)) return
            seen.add(key)
            out.push({
                source: entry?.source || 'local',
                name: String(name),
                id: String(sid),
                locked: Boolean(entry?.locked || isStudentIdConflictLocked(student)),
                student,
            })
        }
        for (const item of fromDisk) push(item)
        const bucket = ensureBucket({ scope, semester: sem })
        const fromBucket = (bucket?.students || []).filter(
            (s) => String(s?.data?.personal?.学号?.data ?? '') === studentId,
        )
        for (const student of fromBucket) {
            push({ source: 'list', student, locked: isStudentIdConflictLocked(student) })
        }
        return out
    }

    const clearStudentFromBucketById = ({ scope, semester, id }) => {
        const sem = normalizeSemesterValue(semester)
        const bucket = ensureBucket({ scope, semester: sem })
        if (!bucket) return
        const studentId = id != null ? String(id) : ''
        if (!studentId) return
        bucket.students = (bucket.students || []).filter(
            (s) => String(s?.data?.personal?.学号?.data ?? '') !== studentId,
        )
    }

    const removeStudentDataByIdFromDisk = async ({ scope, semester, id }) => {
        const sem = normalizeSemesterValue(semester)
        const studentId = id != null ? String(id) : ''
        if (!sem || !studentId) return
        const matches = await findStudentsFromDiskById({ scope, semester: sem, id: studentId })
        for (const row of matches) {
            const dirPath = String(row?.dirPath || '')
            if (!dirPath) continue
            await fileSystemManager.deleteEntry(dirPath, { recursive: true })
        }
    }

    const restoreStudentFromLocalById = async ({ scope, semester, id, importedStudent }) => {
        const sem = normalizeSemesterValue(semester)
        const studentIdInput = id != null ? String(id) : ''
        if (!sem)
            return { ok: false, message: '当前学期无效', name: '-', id: studentIdInput || '-' }
        if (!studentIdInput) return { ok: false, message: '缺少学号，无法恢复', name: '-', id: '-' }
        if (isMigratingFor({ scope, semester: sem })) {
            return {
                ok: false,
                message: '正在迁移旧数据，请稍后再试',
                name: '-',
                id: studentIdInput,
            }
        }

        const found = await findStudentFromDiskById({
            scope,
            semester: sem,
            id: studentIdInput,
        })
        if (!found?.student) {
            return {
                ok: false,
                message: '本地未找到该学生旧数据，无法恢复',
                name: '-',
                id: studentIdInput,
            }
        }
        const { student, infoPath, originalText } = found
        const { name, id: studentId } = getStudentIdentity(student) || {}
        if (!name || !studentId) {
            return {
                ok: false,
                message: '本地旧数据缺少姓名/学号，无法恢复',
                name: '-',
                id: studentIdInput,
            }
        }
        const fileSemester = getStudentSemester(student)
        if (fileSemester && String(fileSemester) !== String(sem)) {
            return {
                ok: false,
                message: `本地旧数据学期为 ${fileSemester}，与当前学期 ${sem} 不一致，无法恢复`,
                name,
                id: studentId,
            }
        }

        const bucket = ensureBucket({ scope, semester: sem })
        if (!bucket) return { ok: false, message: '无法初始化学生列表', name, id: studentId }

        const standardClassInfo = await getStandardClassInfo({ scope })
        const importedClassInfo = importedStudent ? getStudentClassInfo(importedStudent) : null
        const importedOk =
            importedClassInfo?.grade && importedClassInfo?.major && importedClassInfo?.class
        const targetClassInfo = importedOk ? importedClassInfo : standardClassInfo

        try {
            if (targetClassInfo) {
                const changed = setStudentClassInfo({ student, classInfo: targetClassInfo })
                if (changed) {
                    const { payload } = buildStudentInfoPayload({
                        scope: normalizeScope(scope),
                        student,
                    })
                    await fileSystemManager.writeFile(infoPath, JSON.stringify(payload))
                }
            }
            await unmarkStudentDeleted({ scope, semester: sem, id: studentId })
            upsertStudentInBucket({ scope, semester: sem, student })
            return {
                ok: true,
                message: '已从本地恢复',
                name,
                id: studentId,
            }
        } catch (e) {
            try {
                if (typeof originalText === 'string' && infoPath) {
                    await fileSystemManager.writeFile(infoPath, originalText)
                }
            } catch {}
            try {
                await markStudentDeleted({ scope, semester: sem, id: studentId })
            } catch {}
            return {
                ok: false,
                message: `恢复失败：${String(e?.message || e)}`,
                name,
                id: studentId,
            }
        }
    }

    const loadStudents = async ({ scope, semester, silent = false } = {}) => {
        const sem = normalizeSemesterValue(semester)
        const bucket = ensureBucket({ scope, semester: sem })
        if (!bucket || !sem) return

        const key = bucketKey({ scope, semester: sem })
        const nextRunId = (runIds.value.get(key) || 0) + 1
        runIds.value.set(key, nextRunId)
        setMigrationRunning({ scope, semester: sem, running: true })

        if (!silent) bucket.isLoading = true
        bucket.loadError = ''
        try {
            const deletedIds = await readDeletedStudentIds({ scope, semester: sem })
            let studentDirs = []
            try {
                studentDirs = await fileSystemManager.readDirectoryStructure(
                    `${normalizeScope(scope)}/semesters/${sem}/students`,
                    1,
                )
            } catch {
                bucket.students = []
                bucket.loadError = '读取学生列表失败'
                return
            }

            const dirs = (studentDirs || []).filter((d) => d.kind === 'directory')
            const batchSize = 80
            const list = []
            let migratedCount = 0

            for (let start = 0; start < dirs.length; start += batchSize) {
                if (runIds.value.get(key) !== nextRunId) return
                const batch = dirs.slice(start, start + batchSize)
                const parsedBatch = await mapLimit(batch, 8, async (dir) => {
                    const infoPath = `${dir.path}/info.json`
                    const info = await fileSystemManager.readFile(infoPath)
                    if (!info) return null
                    const parsed = safeJsonParse(info)
                    if (!parsed) return null
                    const { payload, changed } = buildStudentInfoPayload({
                        student: parsed,
                        scope: normalizeScope(scope),
                    })
                    if (changed) {
                        await fileSystemManager.writeFile(infoPath, JSON.stringify(payload))
                        migratedCount += 1
                    }
                    normalizeDyfKeys(payload)
                    const id = payload?.data?.personal?.学号?.data
                    if (id != null && deletedIds.has(String(id))) return null
                    const fileSemester = getStudentSemester(payload)
                    if (fileSemester && String(fileSemester) !== String(sem)) return null
                    return payload
                })
                list.push(...parsedBatch.filter(Boolean))
                bucket.students = sortByStudentId(list)
                await new Promise((r) => setTimeout(r, 0))
            }
            if (migratedCount > 0) {
                addMigrationNotice({ scope, semester: sem, count: migratedCount })
            }
        } catch (e) {
            bucket.students = []
            bucket.loadError = String(e?.message || '读取学生列表失败')
        } finally {
            if (!silent) bucket.isLoading = false
            if (runIds.value.get(key) === nextRunId) {
                setMigrationRunning({ scope, semester: sem, running: false })
            }
        }
    }

    const upsertStudentInBucket = ({ scope, semester, student }) => {
        const sem = normalizeSemesterValue(semester)
        const bucket = ensureBucket({ scope, semester: sem })
        if (!bucket || !student) return
        normalizeDyfKeys(student)
        const id = student?.data?.personal?.学号?.data
        if (id == null) return
        const studentId = String(id)
        const list = bucket.students || []
        const idx = list.findIndex((s) => String(s?.data?.personal?.学号?.data ?? '') === studentId)
        if (idx >= 0) {
            const next = list.slice()
            next[idx] = student
            bucket.students = sortByStudentId(next)
            return
        }
        bucket.students = sortByStudentId([...list, student])
    }

    const addStudent = async ({ scope, semester, student }) => {
        const sem = normalizeSemesterValue(semester)
        if (!sem) return { ok: false, message: '当前学期无效' }
        if (isMigratingFor({ scope, semester: sem })) {
            return { ok: false, message: '正在迁移旧数据，请稍后再试' }
        }

        normalizeDyfKeys(student)
        const standardClassInfo = await getStandardClassInfo({ scope })
        if (standardClassInfo) {
            const check = validateStudentBelongsToClass({ student, classInfo: standardClassInfo })
            if (!check?.ok) {
                const { name, id } = getStudentIdentity(student) || {}
                return { ok: false, message: check?.message || '非本班学生，已拒绝导入', name, id }
            }
            setStudentClassInfo({ student, classInfo: standardClassInfo })
        }
        const fileSemester = getStudentSemester(student)
        if (!fileSemester) {
            const { name, id } = getStudentIdentity(student) || {}
            return { ok: false, message: '导入文件缺少学期信息（年份/学期）', name, id }
        }
        if (String(fileSemester) !== String(sem)) {
            const { name, id } = getStudentIdentity(student) || {}
            return {
                ok: false,
                message: `导入文件学期为 ${fileSemester}，与当前学期 ${sem} 不一致`,
                name,
                id,
            }
        }

        const { name, id } = getStudentIdentity(student) || {}
        if (!name || !id)
            return { ok: false, message: '导入文件缺少学生信息（姓名/学号）', name, id }

        const studentId = String(id)
        const existingCandidates = await getConflictCandidatesById({
            scope,
            semester: sem,
            id: studentId,
        })
        const lockedCandidate = existingCandidates.find((row) => row?.locked)
        if (lockedCandidate && String(lockedCandidate?.name || '') !== String(name)) {
            return {
                ok: false,
                status: 'locked',
                message: `学号 ${studentId} 已固定为 ${lockedCandidate?.name || '指定学生'}，不允许导入其他姓名`,
                name,
                id,
            }
        }

        const sameStudent = existingCandidates.find((row) =>
            isSameStudentByIdentity(row?.student, student),
        )
        if (sameStudent) {
            const existingStudent = sameStudent?.student
            if (existingStudent)
                upsertStudentInBucket({ scope, semester: sem, student: existingStudent })
            return {
                ok: false,
                message: '学号与姓名均一致，视为同一学生，不允许重复导入',
                name,
                id,
            }
        }

        if (existingCandidates.length > 0) {
            return {
                ok: false,
                status: 'conflict',
                message: `学号 ${studentId} 存在姓名冲突，请先处理冲突后再导入`,
                name,
                id,
                conflict: {
                    id: studentId,
                    candidates: existingCandidates.map((row) => ({
                        source: row?.source || 'local',
                        id: String(row?.id || studentId),
                        name: String(row?.name || ''),
                        locked: Boolean(row?.locked),
                        student: row?.student || null,
                    })),
                    incoming: {
                        source: 'import',
                        id: studentId,
                        name: String(name),
                        locked: false,
                        student,
                    },
                },
            }
        }

        setStudentIdConflictLock({ student, locked: false })
        await writeStudentToDisk({ scope: normalizeScope(scope), semester: sem, student })
        await unmarkStudentDeleted({ scope, semester: sem, id })
        upsertStudentInBucket({ scope, semester: sem, student })
        return { ok: true, message: '导入成功', name, id, savedNow: true }
    }

    const resolveStudentIdConflict = async ({
        scope,
        semester,
        id,
        keepStudent,
        keepNone = false,
    }) => {
        const sem = normalizeSemesterValue(semester)
        const studentId = id != null ? String(id) : ''
        if (!sem || !studentId) return { ok: false, message: '学号无效，无法处理冲突' }
        if (isMigratingFor({ scope, semester: sem })) {
            return { ok: false, message: '正在迁移旧数据，请稍后再试' }
        }

        if (keepNone) {
            clearStudentFromBucketById({ scope, semester: sem, id: studentId })
            await removeStudentDataByIdFromDisk({ scope, semester: sem, id: studentId })
            await unmarkStudentDeleted({ scope, semester: sem, id: studentId })
            return {
                ok: true,
                status: 'dropped',
                message: `已删除学号 ${studentId} 的本地数据，且本次不保留任何冲突学生`,
                id: studentId,
            }
        }

        if (!keepStudent || typeof keepStudent !== 'object') {
            return { ok: false, message: '缺少需保留的学生数据' }
        }
        const identity = getStudentIdentity(keepStudent) || {}
        if (!identity?.name || String(identity?.id ?? '') !== studentId) {
            return { ok: false, message: '保留学生的学号或姓名无效' }
        }
        const standardClassInfo = await getStandardClassInfo({ scope })
        if (standardClassInfo)
            setStudentClassInfo({ student: keepStudent, classInfo: standardClassInfo })
        setStudentIdConflictLock({ student: keepStudent, locked: true })

        clearStudentFromBucketById({ scope, semester: sem, id: studentId })
        await removeStudentDataByIdFromDisk({ scope, semester: sem, id: studentId })
        await writeStudentToDisk({
            scope: normalizeScope(scope),
            semester: sem,
            student: keepStudent,
        })
        await unmarkStudentDeleted({ scope, semester: sem, id: studentId })
        upsertStudentInBucket({ scope, semester: sem, student: keepStudent })
        return {
            ok: true,
            status: 'resolved',
            message: `已固定学号 ${studentId} 对应学生为 ${identity.name}`,
            name: identity.name,
            id: studentId,
        }
    }

    const updateStudent = async ({ scope, semester, student }) => {
        const sem = normalizeSemesterValue(semester)
        if (!sem) return
        if (isMigratingFor({ scope, semester: sem })) return
        const { name, id } = getStudentIdentity(student) || {}
        if (!name || !id) return
        const standardClassInfo = await getStandardClassInfo({ scope })
        if (standardClassInfo) setStudentClassInfo({ student, classInfo: standardClassInfo })
        await writeStudentToDisk({ scope: normalizeScope(scope), semester: sem, student })
        await unmarkStudentDeleted({ scope, semester: sem, id })
        upsertStudentInBucket({ scope, semester: sem, student })
    }

    const removeStudent = async ({ scope, semester, id }) => {
        const sem = normalizeSemesterValue(semester)
        if (!sem) return
        if (isMigratingFor({ scope, semester: sem })) {
            throw new Error('正在迁移旧数据，请稍后再试')
        }
        const bucket = ensureBucket({ scope, semester: sem })
        if (!bucket) return
        const studentId = id != null ? String(id) : ''
        if (!studentId) return

        const before = bucket.students || []
        const next = before.filter((s) => String(s?.data?.personal?.学号?.data ?? '') !== studentId)
        bucket.students = next
        try {
            await markStudentDeleted({ scope, semester: sem, id: studentId })
        } catch (e) {
            bucket.students = before
            throw e
        }
    }

    const removeStudentsBatch = async ({ scope, semester, ids }) => {
        const sem = normalizeSemesterValue(semester)
        if (!sem) return { removedIds: [] }
        if (isMigratingFor({ scope, semester: sem })) {
            throw new Error('正在迁移旧数据，请稍后再试')
        }
        const bucket = ensureBucket({ scope, semester: sem })
        if (!bucket) return { removedIds: [] }

        const rawIds = Array.isArray(ids) ? ids : ids == null ? [] : [ids]
        const idSet = new Set(
            rawIds
                .map((x) => (x == null ? '' : String(x)))
                .map((x) => x.trim())
                .filter(Boolean),
        )
        if (idSet.size === 0) return { removedIds: [] }

        const before = bucket.students || []
        const removedIds = []
        const next = before.filter((s) => {
            const sid = String(s?.data?.personal?.学号?.data ?? '')
            if (!sid) return true
            if (!idSet.has(sid)) return true
            removedIds.push(sid)
            return false
        })
        if (removedIds.length === 0) return { removedIds: [] }

        bucket.students = next
        try {
            const deletedIds = await readDeletedStudentIds({ scope, semester: sem })
            for (const sid of removedIds) deletedIds.add(String(sid))
            await writeDeletedStudentIds({ scope, semester: sem, ids: deletedIds })
            return { removedIds }
        } catch (e) {
            bucket.students = before
            throw e
        }
    }

    const standardizeStudentsClassInfo = async ({ scope, semester, classInfo } = {}) => {
        const sem = normalizeSemesterValue(semester)
        if (!sem) throw new Error('当前学期无效')
        if (isMigratingFor({ scope, semester: sem })) {
            throw new Error('正在迁移旧数据，请稍后再试')
        }

        const standard =
            classInfo && classInfo.grade && classInfo.major && (classInfo.class || classInfo.name)
                ? classInfo
                : await getStandardClassInfo({ scope })
        if (!standard) throw new Error('缺少班级信息，请先在设置中完善')

        await loadStudents({ scope, semester: sem, silent: true })
        const bucket = ensureBucket({ scope, semester: sem })
        if (!bucket) return { updated: 0 }

        const list = Array.isArray(bucket.students) ? bucket.students : []
        const toUpdate = []
        for (const s of list) {
            if (!s) continue
            const changed = setStudentClassInfo({ student: s, classInfo: standard })
            if (changed) toUpdate.push(s)
        }
        if (!toUpdate.length) return { updated: 0 }

        await mapLimit(toUpdate, 5, async (s) => {
            const { id } = getStudentIdentity(s) || {}
            await writeStudentToDisk({ scope: normalizeScope(scope), semester: sem, student: s })
            if (id != null) await unmarkStudentDeleted({ scope, semester: sem, id })
        })

        const refreshed = ensureBucket({ scope, semester: sem })
        if (refreshed?.students) refreshed.students = sortByStudentId(refreshed.students)
        return { updated: toUpdate.length }
    }

    return {
        studentsFor,
        isLoadingFor,
        loadErrorFor,
        loadStudents,
        isStudentDeleted,
        restoreStudentFromLocalById,
        addStudent,
        resolveStudentIdConflict,
        updateStudent,
        removeStudent,
        removeStudentsBatch,
        standardizeStudentsClassInfo,
        consumeMigrationNotice,
        isMigratingFor,
    }
})
