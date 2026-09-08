<script setup>
import { computed, inject, provide, ref, watch } from 'vue'
import { ensureLocalConfig, getLocalClassInfo, getServerConfig } from '@/utils/config'
import { parseDyfText } from '@/utils/dyfFile'
import { createAppToast } from '@/utils/toast'
import {
    getStudentIdentity,
    getStudentSemester,
    normalizeImportedStudentPayload,
    normalizeDyfKeys,
    normalizeSemesterValue,
    validateStudentBelongsToClass,
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
    store.studentsFor({ scope: 'class', semester: normalizedSemester.value }),
)
const isLoading = computed(() =>
    store.isLoadingFor({ scope: 'class', semester: normalizedSemester.value }),
)
const loadError = computed(() =>
    store.loadErrorFor({ scope: 'class', semester: normalizedSemester.value }),
)
const isMigrating = computed(() =>
    store.isMigratingFor({ scope: 'class', semester: normalizedSemester.value }),
)

const notifyMigrationIfNeeded = (semester) => {
    const migratedCount = store.consumeMigrationNotice({ scope: 'class', semester })
    if (migratedCount <= 0) return
    appToast.info(`检测到 ${migratedCount} 份旧版学生数据，已自动迁移`)
}

const importStudent = async (text) => {
    const semester = normalizedSemester.value
    if (!semester) return { ok: false, message: '当前学期无效' }

    const serverConfig = await getServerConfig()
    const localConfig = await ensureLocalConfig({ scope: 'class' })
    const localClassInfo = getLocalClassInfo(localConfig)
    const privateKeyJwk = localConfig?.encryption?.privateKeyJwk

    const dyf = await parseDyfText({ text, serverConfig, privateKeyJwk })
    if (!dyf.ok) return { ok: false, message: dyf.message }
    if (dyf.type !== 'student')
        return { ok: false, message: '该文件不是个人材料，无法作为学生导入' }

    const parsed = normalizeImportedStudentPayload(dyf.payload)
    if (!parsed) return { ok: false, message: '导入文件缺少有效学生数据结构' }
    const { name, id } = getStudentIdentity(parsed) || {}
    if (!name || !id) return { ok: false, message: '导入文件缺少学生信息（姓名/学号）', name, id }

    const belongCheck = validateStudentBelongsToClass({
        student: parsed,
        classInfo: localClassInfo,
    })
    if (!belongCheck.ok) return { ok: false, message: belongCheck.message, name, id }

    const importedId = id
    if (importedId != null) {
        const deleted = await store.isStudentDeleted({
            scope: 'class',
            semester,
            id: importedId,
        })
        if (deleted) {
            const r = await store.restoreStudentFromLocalById({
                scope: 'class',
                semester,
                id: importedId,
                importedStudent: parsed,
            })
            if (!r?.ok) return { ...(r || {}), ok: false, status: 'error' }
            return { ...(r || {}), ok: true, status: 'restored', statusText: RESTORE_STATUS_TEXT }
        }
    }

    normalizeDyfKeys(parsed)

    const fileSemester = getStudentSemester(parsed)
    if (!fileSemester) return { ok: false, message: '导入文件缺少学期信息（年份/学期）', name, id }
    if (String(fileSemester) !== String(semester)) {
        return {
            ok: false,
            message: `导入文件学期为 ${fileSemester}，与当前学期 ${semester} 不一致`,
            name,
            id,
        }
    }

    const r = await store.addStudent({ scope: 'class', semester, student: parsed })
    return { ...(r || {}), status: r?.status || (r?.ok ? 'success' : 'error') }
}

const updateStudent = async (student) => {
    const semester = normalizedSemester.value
    if (!semester) return
    if (store.isMigratingFor({ scope: 'class', semester })) return
    await store.updateStudent({ scope: 'class', semester, student })
}

const removeStudent = async (id) => {
    const semester = normalizedSemester.value
    if (!semester) return
    if (store.isMigratingFor({ scope: 'class', semester })) return
    await store.removeStudent({ scope: 'class', semester, id })
}

const resolveStudentIdConflict = async ({ id, keepStudent, keepNone = false }) => {
    const semester = normalizedSemester.value
    if (!semester) return { ok: false, message: '当前学期无效' }
    return await store.resolveStudentIdConflict({
        scope: 'class',
        semester,
        id,
        keepStudent,
        keepNone,
    })
}

const standardizeStudentsClassInfo = async () => {
    const semester = normalizedSemester.value
    if (!semester) throw new Error('当前学期无效')
    return await store.standardizeStudentsClassInfo({ scope: 'class', semester })
}

provide('studentData', {
    students,
    importStudent,
    resolveStudentIdConflict,
    updateStudent,
    removeStudent,
    standardizeStudentsClassInfo,
    currentSemester: computed(() => normalizedSemester.value || ''),
    isLoading,
    loadError,
    isMigrating,
})

watch(
    [fsAuthorized, normalizedSemester],
    async ([authorized, semester]) => {
        if (!authorized || !semester) return
        await store.loadStudents({ scope: 'class', semester, silent: true })
        notifyMigrationIfNeeded(semester)
    },
    { immediate: true },
)
</script>

<template>
    <RouterView />
</template>

<style scoped></style>
