<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createAppToast } from '@/utils/toast'
import StudentTable from '@/components/student/StudentTable.vue'
import ImportResult from '@/components/ImportResult.vue'
import {
    buildStudentCategoryItems,
    buildStudentTableColumns,
    buildStudentTableRows,
    safeNamePart,
} from '@/components/student/studentTableUtils'
import { getServerConfig, getStudentConfig } from '@/utils/config'
import { exportStudentScoresXlsx } from '@/utils/excel'
import { importStudentsFromFiles } from '@/utils/importStudentsFromFiles'
import { createDyfText } from '@/utils/dyfFile'
import { embedEvidenceFilesForExport } from '@/utils/studentStorage'
import { saveAs } from 'file-saver'
import { useStudentDeleteStore } from '@/stores/studentDeleteStore'
import { useCurrentStudentStore } from '@/stores/currentStudentStore'
import { mapFileSystemErrorToUserMessage } from '@/utils/error'
import { resolveTotalScoreConfig } from '@/utils/totalScore'
const studentData = inject('studentData')
const isLoading = computed(() => studentData?.isLoading?.value ?? false)
const loadError = computed(() => studentData?.loadError?.value ?? '')
const migrationLocked = computed(() => Boolean(studentData?.isMigrating?.value))

const toast = useToast()
const appToast = createAppToast(toast)
const router = useRouter()
const navigateTo = (path) => router.push(path)

const isExporting = ref(false)

const {
    state: deleteState,
    deleteDescription,
    openDeleteModal,
    closeDeleteModal,
} = useStudentDeleteStore()
const currentStudentStore = useCurrentStudentStore()

const tableColumns = computed(() =>
    buildStudentTableColumns({
        categoryItems: visibleCategoryItems.value || [],
        nameRowSpan: 2,
        penaltyDisplayConfig: penaltyDisplayConfig.value,
    }),
)

const studentFileInput = ref(null)
const isStudentImporting = ref(false)
const studentImportProgress = ref({ done: 0, total: 0 })
const isStudentImportResultModalOpen = ref(false)
const studentImportResults = ref({
    success: 0,
    fail: 0,
    restored: 0,
    details: [],
})

watch(isStudentImportResultModalOpen, (v) => {
    if (import.meta.env.DEV && localStorage.getItem('debugTooltip') === '1') {
        console.debug('[grade][StudentOverview] importResultModal', Boolean(v))
    }
})

const gradeFilter = ref('全部')
const majorFilter = ref('全部')
const classFilter = ref('全部')
const keyword = ref('')
const keywordDebounced = ref('')
let keywordTimer = null
watch(
    keyword,
    (v) => {
        if (keywordTimer) clearTimeout(keywordTimer)
        keywordTimer = setTimeout(() => {
            keywordDebounced.value = String(v || '')
                .trim()
                .toLowerCase()
        }, 150)
    },
    { immediate: true },
)

const studentConfig = ref(null)
const penaltyDisplayConfig = ref(null)
const totalScoreConfig = ref(resolveTotalScoreConfig())
const categoryItems = ref([])
const visibleCategories = ref([])

const categorySelectOptions = computed(() => categoryItems.value.map((c) => c.categoryName))

const visibleCategoryItems = computed(() => {
    return categoryItems.value.filter((c) => visibleCategories.value.includes(c.categoryName))
})

const studentRows = computed(() =>
    buildStudentTableRows({
        students: studentsAll.value,
        categoryItems: categoryItems.value,
        penaltyCategoryCodes: totalScoreConfig.value.penaltyCategoryCodes,
        negativeItemNumbers: totalScoreConfig.value.negativeItemNumbers,
    }),
)

onMounted(async () => {
    const [nextStudentConfig, nextServerConfig] = await Promise.all([
        getStudentConfig(),
        getServerConfig(),
    ])
    studentConfig.value = nextStudentConfig
    penaltyDisplayConfig.value = nextServerConfig
    totalScoreConfig.value = resolveTotalScoreConfig(nextServerConfig)
    categoryItems.value = buildStudentCategoryItems(studentConfig.value)
    visibleCategories.value = categoryItems.value.map((c) => c.categoryName)
    if (import.meta.env.DEV && localStorage.getItem('debugTooltip') === '1') {
        console.debug('[grade][StudentOverview] mounted')
    }
})

const gradeOptions = computed(() => {
    const set = new Set(studentRows.value.map((s) => s.grade).filter(Boolean))
    return [
        '全部',
        ...Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true })),
    ]
})

const majorOptions = computed(() => {
    const set = new Set(
        studentRows.value
            .filter((s) => gradeFilter.value === '全部' || s.grade === gradeFilter.value)
            .map((s) => s.major)
            .filter(Boolean),
    )
    return [
        '全部',
        ...Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true })),
    ]
})

const classOptions = computed(() => {
    const set = new Set(
        studentRows.value
            .filter((s) => (gradeFilter.value === '全部' ? true : s.grade === gradeFilter.value))
            .filter((s) => (majorFilter.value === '全部' ? true : s.major === majorFilter.value))
            .map((s) => s.class)
            .filter(Boolean),
    )
    return [
        '全部',
        ...Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true })),
    ]
})

const studentsAll = computed(() => studentData?.students?.value ?? [])
const buildSemesterPathHints = () => {
    const semester = String(studentData?.currentSemester?.value || '').trim()
    if (!semester) return ['grade/config.json']
    return [
        `grade/semesters/${semester}/students`,
        `grade/semesters/${semester}/students/_deleted_students.json`,
        'grade/config.json',
    ]
}
const students = computed(() => {
    let list = studentsAll.value || []
    if (gradeFilter.value && gradeFilter.value !== '全部') {
        list = list.filter((s) =>
            String(s?.data?.personal?.年级?.data || '').includes(gradeFilter.value),
        )
    }
    if (majorFilter.value && majorFilter.value !== '全部') {
        list = list.filter((s) =>
            String(s?.data?.personal?.专业?.data || '').includes(majorFilter.value),
        )
    }
    if (classFilter.value && classFilter.value !== '全部') {
        list = list.filter((s) =>
            String(s?.data?.personal?.班级?.data || '').includes(classFilter.value),
        )
    }
    return list
})

const filteredRows = computed(() => {
    const kw = keywordDebounced.value
    const isDigits = kw && /^\d+$/.test(kw)
    return studentRows.value
        .filter((s) => (gradeFilter.value === '全部' ? true : s.grade === gradeFilter.value))
        .filter((s) => (majorFilter.value === '全部' ? true : s.major === majorFilter.value))
        .filter((s) => (classFilter.value === '全部' ? true : s.class === classFilter.value))
        .filter((s) => {
            if (!kw) return true
            const name = String(s.name || '').toLowerCase()
            const id = String(s.id || '').toLowerCase()
            const grade = String(s.grade || '').toLowerCase()
            const major = String(s.major || '').toLowerCase()
            const cls = String(s.class || '').toLowerCase()
            if (isDigits) return id.startsWith(kw)
            return (
                name.includes(kw) ||
                id.includes(kw) ||
                grade.includes(kw) ||
                major.includes(kw) ||
                cls.includes(kw)
            )
        })
        .sort((a, b) => String(a.id).localeCompare(String(b.id), 'zh-Hans-CN', { numeric: true }))
})

const isMaterialExporting = ref(false)
const materialExportProgress = ref({ done: 0, total: 0 })

const sanitizeFileName = (name) => {
    if (!name) return 'file'
    return String(name)
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
}

const matchesKeywordStudent = (student, kw) => {
    const q = String(kw || '')
        .trim()
        .toLowerCase()
    if (!q) return true
    const p = student?.data?.personal ?? {}
    const name = String(p?.姓名?.data ?? '').toLowerCase()
    const id = String(p?.学号?.data ?? '').toLowerCase()
    const grade = String(p?.年级?.data ?? '').toLowerCase()
    const major = String(p?.专业?.data ?? '').toLowerCase()
    const cls = String(p?.班级?.data ?? '').toLowerCase()
    const isDigits = /^\d+$/.test(q)
    if (isDigits) return id.startsWith(q)
    return (
        name.includes(q) ||
        id.includes(q) ||
        grade.includes(q) ||
        major.includes(q) ||
        cls.includes(q)
    )
}

const exportGradeMaterial = async () => {
    if (isMaterialExporting.value || isStudentImporting.value || isExporting.value) return

    isMaterialExporting.value = true
    try {
        const semester = studentData?.currentSemester?.value
        if (!semester) throw new Error('当前学期无效')

        const filterInfo = {
            grade: String(gradeFilter.value || '全部'),
            major: String(majorFilter.value || '全部'),
            class: String(classFilter.value || '全部'),
            keyword: String(keywordDebounced.value || '').trim(),
        }

        const list = (students.value || []).filter((s) =>
            matchesKeywordStudent(s, filterInfo.keyword),
        )
        if (!list.length) throw new Error('当前筛选条件下没有可导出的学生')
        materialExportProgress.value = { done: 0, total: list.length }
        const packedStudents = []
        for (const s of list) {
            const embedded = await embedEvidenceFilesForExport({
                scope: 'grade',
                semester,
                student: s,
            })
            packedStudents.push(embedded)
            materialExportProgress.value = { done: packedStudents.length, total: list.length }
        }

        const serverConfig = await getServerConfig()
        const encryptionReady = Boolean(
            serverConfig?.encryption?.enabled && serverConfig?.encryption?.rsaPublicKeyJwk,
        )
        if (!encryptionReady) throw new Error('服务器未配置公钥或未启用加密，无法导出')
        const payload = { semester, class: filterInfo, students: packedStudents }
        const text = await createDyfText({ type: 'class', payload, serverConfig })

        const fileName = sanitizeFileName(
            `${filterInfo.grade}-${filterInfo.major}-${filterInfo.class}_${semester}_年级材料.dyf`,
        )
        saveAs(new Blob([text], { type: 'application/json' }), fileName)
        appToast.success({ title: '导出成功', description: '已生成年级材料文件' })
    } catch (e) {
        appToast.error({
            title: '导出失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '导出当前材料',
                pathHints: buildSemesterPathHints(),
            }),
        })
    } finally {
        isMaterialExporting.value = false
        materialExportProgress.value = { done: 0, total: 0 }
    }
}

const exportAllMaterial = async () => {
    if (isMaterialExporting.value || isStudentImporting.value || isExporting.value) return

    isMaterialExporting.value = true
    try {
        const semester = studentData?.currentSemester?.value
        if (!semester) throw new Error('当前学期无效')

        const filterInfo = {
            grade: '全部',
            major: '全部',
            class: '全部',
        }

        const list = studentsAll.value || []
        if (!list.length) throw new Error('暂无可导出的学生')
        materialExportProgress.value = { done: 0, total: list.length }
        const packedStudents = []
        for (const s of list) {
            const embedded = await embedEvidenceFilesForExport({
                scope: 'grade',
                semester,
                student: s,
            })
            packedStudents.push(embedded)
            materialExportProgress.value = { done: packedStudents.length, total: list.length }
        }

        const serverConfig = await getServerConfig()
        const encryptionReady = Boolean(
            serverConfig?.encryption?.enabled && serverConfig?.encryption?.rsaPublicKeyJwk,
        )
        if (!encryptionReady) throw new Error('服务器未配置公钥或未启用加密，无法导出')
        const payload = { semester, class: filterInfo, students: packedStudents }
        const text = await createDyfText({ type: 'class', payload, serverConfig })

        const fileName = sanitizeFileName(`全部学生_${semester}_全部材料.dyf`)
        saveAs(new Blob([text], { type: 'application/json' }), fileName)
        appToast.success({ title: '导出成功', description: '已生成全部材料文件' })
    } catch (e) {
        appToast.error({
            title: '导出失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '导出全部材料',
                pathHints: buildSemesterPathHints(),
            }),
        })
    } finally {
        isMaterialExporting.value = false
        materialExportProgress.value = { done: 0, total: 0 }
    }
}

const exportCategoriesAll = computed(() => {
    const dyf = studentConfig.value?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return []
    return Object.keys(dyf)
})

const pickSeasonName = (semester) => (String(semester) === '2' ? '秋季' : '春季')

const buildGradeExportFileName = (list) => {
    const first = (Array.isArray(list) ? list : [])[0]
    const year = String(
        first?.data?.personal?.年份?.data || first?.data?.personal?.年级?.data || 'xxxx',
    )
    const season = pickSeasonName(first?.data?.personal?.学期?.data || 1)
    const title = `${year}年${season}学期综合素质测评分数核算表`
    return `${safeNamePart(title)}.xlsx`
}
const exportAll = async () => {
    if (!exportCategoriesAll.value.length) {
        appToast.error({ title: '导出失败', description: '未找到德育分配置' })
        return
    }
    isExporting.value = true
    try {
        const filename = buildGradeExportFileName(students.value)
        await exportStudentScoresXlsx({
            filename,
            studentConfig: studentConfig.value,
            scope: 'grade',
            sheets: [
                {
                    name: '总表',
                    categories: exportCategoriesAll.value,
                    students: students.value,
                },
            ].filter((s) => s.categories.length),
        })
        appToast.success({ title: '已导出', description: filename })
    } catch (e) {
        appToast.error({
            title: '导出失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '导出成绩表',
                pathHints: buildSemesterPathHints(),
            }),
        })
    } finally {
        isExporting.value = false
    }
}

const triggerAddStudent = () => {
    if (migrationLocked.value) {
        appToast.warning({ title: '请稍后', description: '正在迁移旧数据，请稍后再试' })
        return
    }
    if (!studentFileInput.value) return
    studentFileInput.value.value = ''
    studentFileInput.value.click()
}

const handleStudentFileChange = async (event) => {
    if (migrationLocked.value) {
        if (event?.target) event.target.value = ''
        appToast.warning({ title: '请稍后', description: '正在迁移旧数据，请稍后再试' })
        return
    }
    if (isStudentImporting.value) return
    if (!studentData?.importDyf && !studentData?.importStudent) {
        appToast.error({ title: '导入失败', description: '未找到 importStudent 能力' })
        return
    }

    try {
        isStudentImporting.value = true
        const files = Array.from(event?.target?.files || [])
        if (!files.length) return

        studentImportProgress.value = { done: 0, total: files.length }
        const { results, successCount, restoredCount, failCount } = await importStudentsFromFiles({
            files,
            importStudent: async (text, progress) => {
                if (studentData?.importDyf) return await studentData.importDyf(text, progress)
                return await studentData.importStudent(text)
            },
            onProgress: (p) => (studentImportProgress.value = p),
        })

        isStudentImporting.value = false

        if (failCount === 0 && restoredCount === 0) {
            appToast.success({
                title: '导入成功',
                description: `成功导入 ${successCount} 名学生`,
            })
        } else {
            studentImportResults.value = {
                success: successCount,
                fail: failCount,
                restored: restoredCount,
                details: results
                    .filter((r) => r.status !== 'success')
                    .map((r) => ({
                        name: r.name || '-',
                        id: r.id || '-',
                        status: r.status || 'error',
                        statusText: r.statusText || '',
                        message: r.message || '',
                    })),
            }
            isStudentImportResultModalOpen.value = true
            if (failCount === 0) {
                appToast.success({
                    title: '导入完成',
                    description: `成功 ${successCount}，本地恢复 ${restoredCount}`,
                })
            } else {
                appToast.warning({
                    title: '部分导入失败',
                    description: `成功 ${successCount}，本地恢复 ${restoredCount}，失败/跳过 ${failCount}`,
                })
            }
        }
    } catch (error) {
        isStudentImporting.value = false
        appToast.error({
            title: '导入失败',
            description: mapFileSystemErrorToUserMessage(error, {
                action: '导入学生文件',
                pathHints: buildSemesterPathHints(),
            }),
        })
    } finally {
        if (event?.target) event.target.value = ''
    }
}

const handleDelete = (student) => {
    openDeleteModal(student)
}

const handleView = (student) => {
    currentStudentStore.currentStudentId = String(student?.id ?? '')
    navigateTo({ name: 'gradeStudentPreview' })
}

const confirmDelete = async () => {
    if (migrationLocked.value) return
    if (!deleteState.target) return
    try {
        await studentData?.removeStudent?.(deleteState.target.id)
        closeDeleteModal()
        appToast.success({ title: '已删除', description: '已从列表移除，并记录删除状态' })
    } catch (e) {
        appToast.error({
            title: '删除失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '删除学生',
                pathHints: buildSemesterPathHints(),
            }),
        })
    }
}
</script>

<template>
    <div class="p-4 space-y-4 flex flex-col h-full">
        <div class="flex flex-col gap-3">
            <div class="flex justify-center items-center gap-3">
                <input
                    ref="studentFileInput"
                    type="file"
                    accept=".json,.dyf"
                    multiple
                    class="hidden"
                    @change="handleStudentFileChange"
                />

                <UFieldGroup size="sm">
                    <UButton
                        icon="i-lucide-user-plus"
                        label="添加学生"
                        color="neutral"
                        variant="subtle"
                        :loading="isStudentImporting"
                        :disabled="
                            isStudentImporting ||
                            isExporting ||
                            isMaterialExporting ||
                            migrationLocked
                        "
                        @click="triggerAddStudent"
                    />
                </UFieldGroup>
                <div class="flex items-center gap-1">
                    <UFieldGroup size="sm">
                        <UButton
                            icon="i-lucide-download"
                            label="导出当前材料"
                            color="neutral"
                            variant="subtle"
                            :loading="isMaterialExporting"
                            :disabled="
                                isStudentImporting ||
                                isExporting ||
                                isMaterialExporting ||
                                (students?.length ?? 0) === 0
                            "
                            @click="exportGradeMaterial"
                        />
                        <UButton
                            icon="i-lucide-download"
                            label="导出全部材料"
                            color="neutral"
                            variant="subtle"
                            :loading="isMaterialExporting"
                            :disabled="
                                isStudentImporting ||
                                isExporting ||
                                isMaterialExporting ||
                                (studentsAll?.length ?? 0) === 0
                            "
                            @click="exportAllMaterial"
                        />
                    </UFieldGroup>
                    <span class="text-xs font-bold text-default/60">（.dyf）</span>
                </div>

                <div class="flex items-center gap-1">
                    <UButton
                        icon="i-lucide-download"
                        label="导出表格"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                        :loading="isExporting"
                        :disabled="isExporting || isMaterialExporting"
                        @click="exportAll"
                    />
                    <span class="text-xs font-bold text-default/60">（.xlsx）</span>
                </div>
            </div>
            <div class="flex gap-3">
                <UFormField label="年级">
                    <USelectMenu v-model="gradeFilter" :items="gradeOptions" />
                </UFormField>
                <UFormField label="专业">
                    <USelectMenu v-model="majorFilter" :items="majorOptions" />
                </UFormField>
                <UFormField label="班级">
                    <USelectMenu v-model="classFilter" :items="classOptions" />
                </UFormField>
                <UFormField label="显示项目">
                    <USelectMenu
                        v-model="visibleCategories"
                        :items="categorySelectOptions"
                        multiple
                    >
                        <template #trailing>
                            <UButton
                                v-if="visibleCategories.length"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                icon="i-lucide-x"
                                @click.stop="visibleCategories = []"
                            />
                        </template>
                    </USelectMenu>
                </UFormField>
                <div class="grow"></div>
                <UFormField label="搜索">
                    <UInput v-model="keyword" placeholder="姓名/学号/专业/班级" />
                </UFormField>
            </div>
        </div>

        <UModal
            v-model:open="deleteState.isDeleteModalOpen"
            title="确认删除"
            :description="deleteDescription"
            :ui="{ description: 'whitespace-pre-line', footer: 'justify-end' }"
        >
            <template #footer>
                <UButton color="neutral" variant="ghost" label="取消" @click="closeDeleteModal" />
                <UButton
                    color="error"
                    label="确认删除"
                    :disabled="migrationLocked"
                    @click="confirmDelete"
                />
            </template>
        </UModal>

        <StudentTable
            :title="'学生列表'"
            :count-text="`筛选后：${filteredRows.length} 人`"
            :columns="tableColumns"
            :rows="filteredRows"
            :is-loading="isLoading"
            :load-error="loadError"
            empty-text="暂无学生数据"
            :disable-actions="
                isStudentImporting || isExporting || isMaterialExporting || migrationLocked
            "
            @view="handleView"
            @delete="handleDelete"
        />

        <ImportResult
            v-model:result-open="isStudentImportResultModalOpen"
            v-model:loading-open="isStudentImporting"
            :details="studentImportResults.details"
            :success-count="studentImportResults.success"
            :fail-count="studentImportResults.fail"
            :restored-count="studentImportResults.restored"
            :show-restored="studentImportResults.restored > 0"
            :progress="studentImportProgress"
        />

        <UModal
            v-model:open="isMaterialExporting"
            title="正在导出"
            :close="false"
            :dismissible="false"
            :ui="{ body: 'flex flex-col items-center justify-center gap-3 py-6' }"
        >
            <template #body>
                <UIcon name="i-lucide:loader-2" class="size-6 animate-spin text-primary" />
                <div class="text-sm text-default/70">
                    正在导出 {{ materialExportProgress.done }}/{{ materialExportProgress.total }}
                </div>
            </template>
        </UModal>
        <div v-if="migrationLocked" class="text-sm text-warning-600 px-1">
            正在迁移旧数据，已临时禁用新增、删除与分数修改操作
        </div>
    </div>
</template>

<style scoped></style>
