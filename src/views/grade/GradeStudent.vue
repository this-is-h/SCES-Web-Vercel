<script setup>
import { computed, inject, provide, ref, watch } from 'vue'
import { ensureLocalConfig, getServerConfig } from '@/utils/config'
import { parseDyfFile, makeImportEvidenceSink } from '@/utils/dyfFile'
import { createAppToast } from '@/utils/toast'
import {
    getStudentIdentity,
    getStudentSemester,
    normalizeImportedStudentPayload,
    normalizeDyfKeys,
    normalizeSemesterValue,
} from '@/utils/studentStorage'
import { useStudentDataStore } from '@/stores/studentDataStore'
const currentSemester = inject('currentSemester', ref(''))
const fsAuthorized = inject('fsAuthorized', ref(false))
const toast = useToast()
const appToast = createAppToast(toast)

const store = useStudentDataStore()
const normalizedSemester = computed(() => normalizeSemesterValue(currentSemester.value))

const RESTORE_STATUS_TEXT = '本地恢复'

const students = computed(() =>
    store.studentsFor({ scope: 'grade', semester: normalizedSemester.value }),
)
const isLoading = computed(() =>
    store.isLoadingFor({ scope: 'grade', semester: normalizedSemester.value }),
)
const loadError = computed(() =>
    store.loadErrorFor({ scope: 'grade', semester: normalizedSemester.value }),
)
const isMigrating = computed(() =>
    store.isMigratingFor({ scope: 'grade', semester: normalizedSemester.value }),
)

const notifyMigrationIfNeeded = (semester) => {
    const migratedCount = store.consumeMigrationNotice({ scope: 'grade', semester })
    if (migratedCount <= 0) return
    appToast.info(`检测到 ${migratedCount} 份旧版学生数据，已自动迁移`)
}

const importStudentObject = async ({ student, semester }) => {
    const normalizedStudent = normalizeImportedStudentPayload(student)
    if (!normalizedStudent) {
        return { ok: false, message: '导入文件缺少有效学生数据结构' }
    }
    student = normalizedStudent
    const importedId = student?.data?.personal?.学号?.data
    if (importedId != null) {
        const deleted = await store.isStudentDeleted({
            scope: 'grade',
            semester,
            id: importedId,
        })
        if (deleted) {
            const r = await store.restoreStudentFromLocalById({
                scope: 'grade',
                semester,
                id: importedId,
            })
            if (!r?.ok) return { ...(r || {}), ok: false, status: 'error' }
            return { ...(r || {}), ok: true, status: 'restored', statusText: RESTORE_STATUS_TEXT }
        }
    }

    normalizeDyfKeys(student)
    const { name, id } = getStudentIdentity(student) || {}

    const fileSemester = getStudentSemester(student)
    if (!fileSemester) return { ok: false, message: '导入文件缺少学期信息（年份/学期）', name, id }
    if (String(fileSemester) !== String(semester)) {
        return {
            ok: false,
            message: `导入文件学期为 ${fileSemester}，与当前学期 ${semester} 不一致`,
            name,
            id,
        }
    }
    if (!name || !id) return { ok: false, message: '导入文件缺少学生信息（姓名/学号）', name, id }

    const r = await store.addStudent({ scope: 'grade', semester, student })
    return { ...(r || {}), status: r?.ok ? 'success' : 'error' }
}

const buildEvidenceSink = () =>
    makeImportEvidenceSink({ scope: 'grade', semester: normalizedSemester.value })
const importStudent = async (file) => {
    const semester = normalizedSemester.value
    if (!semester) return { ok: false, message: '当前学期无效' }

    const serverConfig = await getServerConfig()
    const localConfig = await ensureLocalConfig({ scope: 'grade' })
    const privateKeyJwk = localConfig?.encryption?.privateKeyJwk
    const evidenceSink = buildEvidenceSink()

    const dyf = await parseDyfFile({
        file,
        serverConfig,
        privateKeyJwk,
        evidenceSink,
        onMeta: (meta) => {
            if (meta.type !== 'student') throw new Error('该文件不是个人材料，无法作为学生导入')
        },
        onStudent: async (student) => {
            const r = await importStudentObject({ student, semester })
            if (!r?.ok) throw new Error(r?.message || '导入失败')
        },
    })
    if (!dyf.ok) return { ok: false, message: dyf.message }
    return { ok: true, status: 'success' }
}

const importDyf = async (file, progress) => {
    const semester = normalizedSemester.value
    if (!semester) return { ok: false, message: '当前学期无效' }

    const serverConfig = await getServerConfig()
    const localConfig = await ensureLocalConfig({ scope: 'grade' })
    const privateKeyJwk = localConfig?.encryption?.privateKeyJwk
    const evidenceSink = buildEvidenceSink()

    const details = []
    const pending = []
    const BATCH_SIZE = 32
    let isBatch = false
    let batchSkipped = false

    const flushBatch = async () => {
        if (!pending.length) return
        const batch = pending.splice(0, pending.length)
        try {
            const results = await store.addStudentsBatch({
                scope: 'grade',
                semester,
                students: batch.map((b) => b.student),
            })
            for (let i = 0; i < batch.length; i++) {
                details.push({
                    ...(results[i] || { ok: false, message: '批量导入异常' }),
                    name: batch[i].name,
                    id: batch[i].id,
                })
            }
        } catch (e) {
            for (const b of batch) {
                details.push({
                    ok: false,
                    message: e?.message || '批量导入失败',
                    name: b.name,
                    id: b.id,
                })
            }
        }
    }

    const dyf = await parseDyfFile({
        file,
        serverConfig,
        privateKeyJwk,
        evidenceSink,
        onStudentProgress: (done, total) => {
            if (total > 0) progress?.setTotal?.(total)
        },
        onMeta: (meta) => {
            if (meta.type !== 'student' && meta.type !== 'class' && meta.type !== 'grade') {
                throw new Error('该文件不是可导入的材料类型')
            }
            isBatch = meta.type === 'class' || meta.type === 'grade'
            progress?.setTotal?.(meta.type === 'student' ? 1 : meta.count || 1)
        },
        onStudent: async (student, meta) => {
            if (meta.type === 'student') {
                const r = await importStudentObject({ student, semester })
                details.push(r)
                progress?.advance?.(1)
                return
            }
            if (meta.semester && String(meta.semester) !== String(semester)) {
                details.push({
                    ok: false,
                    message: `整批材料学期为 ${meta.semester}，与当前学期 ${semester} 不一致`,
                })
                progress?.advance?.(1)
                return
            }
            // 批量：累积到 pending，满 BATCH_SIZE 即批量写盘（O(1) 索引而非逐个扫目录）
            const { name, id } = getStudentIdentity(student) || {}
            pending.push({ student, name: String(name || ''), id: String(id || '') })
            if (pending.length >= BATCH_SIZE) {
                batchSkipped = true
                await flushBatch()
            }
            progress?.advance?.(1)
        },
    })
    if (!dyf.ok) return { ok: false, message: dyf.message }

    // 冲突文件回退到逐个导入（addStudentsBatch 内部也会对同号异名回退）
    if (batchSkipped || pending.length) await flushBatch()
    if (!isBatch && !details.length) {
        // 空文件兜底
        return { ok: true, message: '文件中未找到学生数据', details: [] }
    }
    const okCount = details.filter((d) => d.ok).length
    const failCount = details.length - okCount
    return {
        ok: failCount === 0,
        message: `整批导入完成：成功 ${okCount}，失败/跳过 ${failCount}`,
        details,
    }
}

const updateStudent = async (student) => {
    const semester = normalizedSemester.value
    if (!semester) return
    if (store.isMigratingFor({ scope: 'grade', semester })) return
    await store.updateStudent({ scope: 'grade', semester, student })
}

const removeStudent = async (id) => {
    const semester = normalizedSemester.value
    if (!semester) return
    if (store.isMigratingFor({ scope: 'grade', semester })) return
    await store.removeStudent({ scope: 'grade', semester, id })
}

provide('studentData', {
    students,
    importStudent,
    importDyf,
    updateStudent,
    removeStudent,
    currentSemester: computed(() => normalizedSemester.value || ''),
    isLoading,
    loadError,
    isMigrating,
})

watch(
    [fsAuthorized, normalizedSemester],
    async ([authorized, semester]) => {
        if (!authorized || !semester) return
        await store.loadStudents({ scope: 'grade', semester, silent: true })
        notifyMigrationIfNeeded(semester)
    },
    { immediate: true },
)
</script>

<template>
    <RouterView />
</template>

<style scoped></style>
