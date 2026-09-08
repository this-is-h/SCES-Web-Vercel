<script setup>
import { computed, inject, provide, ref, watch } from 'vue'
import { ensureLocalConfig, getServerConfig } from '@/utils/config'
import { parseDyfText } from '@/utils/dyfFile'
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

const importStudent = async (text) => {
    const semester = normalizedSemester.value
    if (!semester) return { ok: false, message: '当前学期无效' }

    const serverConfig = await getServerConfig()
    const localConfig = await ensureLocalConfig({ scope: 'grade' })
    const privateKeyJwk = localConfig?.encryption?.privateKeyJwk

    const dyf = await parseDyfText({ text, serverConfig, privateKeyJwk })
    if (!dyf.ok) return { ok: false, message: dyf.message }
    if (dyf.type !== 'student')
        return { ok: false, message: '该文件不是个人材料，无法作为学生导入' }

    return await importStudentObject({ student: dyf.payload, semester })
}

const importDyf = async (text, progress) => {
    const semester = normalizedSemester.value
    if (!semester) return { ok: false, message: '当前学期无效' }

    const serverConfig = await getServerConfig()
    const localConfig = await ensureLocalConfig({ scope: 'grade' })
    const privateKeyJwk = localConfig?.encryption?.privateKeyJwk

    const dyf = await parseDyfText({ text, serverConfig, privateKeyJwk })
    if (!dyf.ok) return { ok: false, message: dyf.message }

    if (dyf.type === 'student') {
        const r = await importStudentObject({ student: dyf.payload, semester })
        progress?.setTotal?.(1)
        progress?.advance?.(1)
        return { ok: r.ok, message: r.message, details: [r] }
    }

    if (dyf.type === 'class') {
        const payloadSemester = dyf.payload?.semester
        if (!payloadSemester) return { ok: false, message: '整班材料缺少 semester 字段' }
        if (String(payloadSemester) !== String(semester)) {
            return {
                ok: false,
                message: `整班材料学期为 ${payloadSemester}，与当前学期 ${semester} 不一致`,
            }
        }
        const stuList = Array.isArray(dyf.payload?.students) ? dyf.payload.students : []
        progress?.setTotal?.(stuList.length || 1)
        const details = []
        for (const s of stuList) {
            details.push(await importStudentObject({ student: s, semester }))
            progress?.advance?.(1)
        }
        const okCount = details.filter((d) => d.ok).length
        const failCount = details.length - okCount
        return {
            ok: failCount === 0,
            message: `整班导入完成：成功 ${okCount}，失败/跳过 ${failCount}`,
            details,
        }
    }

    return { ok: false, message: '无法识别的导入类型' }
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
