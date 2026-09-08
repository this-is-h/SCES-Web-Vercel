<template>
    <div class="flex flex-col gap-4 p-4 h-full overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="grid grid-cols-4 gap-2 grow-2">
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">总人数</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ stats.total }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">平均分</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ stats.avg }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">最高分</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ stats.max }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">最低分</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ stats.min }}
                    </div>
                </UCard>
            </div>

            <div class="flex flex-col items-center gap-3 grow">
                <input
                    ref="studentFileInput"
                    type="file"
                    accept=".json,.dyf"
                    multiple
                    class="hidden"
                    @change="handleStudentFileChange"
                />

                <div class="flex gap-2">
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
                    <UButton
                        icon="i-lucide-wand-2"
                        label="一键补全基础分"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                        :loading="isCompletingBase"
                        :disabled="
                            isCompletingBase ||
                            isExporting ||
                            isMaterialExporting ||
                            isStudentImporting ||
                            migrationLocked ||
                            !studentConfig
                        "
                        @click="openCompleteBaseConfirm"
                    />
                </div>

                <div class="flex items-center gap-1">
                    <UButton
                        icon="i-lucide-download"
                        label="导出班级材料（.dyf）"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                        :loading="isMaterialExporting"
                        :disabled="
                            isStudentImporting ||
                            isExporting ||
                            isMaterialExporting ||
                            (students?.length ?? 0) === 0
                        "
                        @click="exportClassMaterial"
                    />
                    <UButton
                        icon="i-lucide-download"
                        label="导出表格（.xlsx）"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                        :loading="isExporting"
                        :disabled="isExporting || isMaterialExporting"
                        @click="exportAll"
                    />
                </div>
            </div>
        </div>

        <UModal
            v-model:open="isCompleteBaseModalOpen"
            title="确认补全基础分"
            :description="completeBaseConfirmDescription"
            :ui="{ description: 'whitespace-pre-line', footer: 'justify-end' }"
        >
            <template #footer>
                <UButton
                    color="neutral"
                    variant="ghost"
                    label="取消"
                    :disabled="isCompletingBase || migrationLocked"
                    @click="closeCompleteBaseConfirm"
                />
                <UButton
                    color="primary"
                    label="确认补全"
                    :loading="isCompletingBase"
                    :disabled="migrationLocked"
                    @click="confirmCompleteBase"
                />
            </template>
        </UModal>

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

        <UModal
            v-model:open="isConflictResolveModalOpen"
            title="学号冲突处理"
            :description="conflictResolveDescription"
            :ui="{ description: 'whitespace-pre-line', footer: 'justify-end' }"
        >
            <template #body>
                <div class="space-y-2">
                    <div v-for="option in conflictDecisionOptions" :key="option.key" class="p-2">
                        <UButton
                            block
                            color="neutral"
                            :variant="
                                selectedConflictOptionKey === option.key ? 'solid' : 'outline'
                            "
                            :label="option.label"
                            @click="selectConflictOption(option.key)"
                        />
                        <div v-if="option.hint" class="text-xs text-default/70 mt-1">
                            {{ option.hint }}
                        </div>
                    </div>
                </div>
            </template>
            <template #footer>
                <UButton
                    color="neutral"
                    variant="ghost"
                    label="暂不处理"
                    :disabled="isConflictResolving"
                    @click="closeConflictResolveModal"
                />
                <UButton
                    color="warning"
                    label="下一步确认"
                    :disabled="!selectedConflictOptionKey || isConflictResolving"
                    @click="openConflictConfirmModal"
                />
            </template>
        </UModal>

        <UModal
            v-model:open="isConflictConfirmModalOpen"
            title="二次确认"
            :description="conflictConfirmDescription"
            :ui="{ description: 'whitespace-pre-line', footer: 'justify-end' }"
        >
            <template #footer>
                <UButton
                    color="neutral"
                    variant="ghost"
                    label="返回修改"
                    :disabled="isConflictResolving"
                    @click="isConflictConfirmModalOpen = false"
                />
                <UButton
                    color="error"
                    label="确认执行"
                    :loading="isConflictResolving"
                    @click="confirmConflictDecision"
                />
            </template>
        </UModal>

        <StudentTable
            :title="'学生列表'"
            :count-text="`${tableRows.length} 人`"
            :columns="tableColumns"
            :rows="tableRows"
            :is-loading="isLoading"
            :load-error="loadError"
            empty-text="暂无数据"
            :default-sorting="[{ id: 'total', desc: true }]"
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

<script setup>
import { ref, inject, computed, onMounted, nextTick, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import {
    ensureLocalConfig,
    getLocalClassInfo,
    getServerConfig,
    getStudentConfig,
} from '@/utils/config'
import { exportStudentScoresXlsx } from '@/utils/excel'
import StudentTable from '@/components/student/StudentTable.vue'
import ImportResult from '@/components/ImportResult.vue'
import {
    buildStudentCategoryItems,
    buildStudentTableColumns,
    buildStudentTableRows,
    safeNamePart,
} from '@/components/student/studentTableUtils'
import { importStudentsFromFiles } from '@/utils/importStudentsFromFiles'
import { createAppToast } from '@/utils/toast'
import { embedEvidenceFilesForExport } from '@/utils/studentStorage'
import { saveAs } from 'file-saver'
import { createDyfText } from '@/utils/dyfFile'
import { useStudentDeleteStore } from '@/stores/studentDeleteStore'
import { useCurrentStudentStore } from '@/stores/currentStudentStore'
import { mapFileSystemErrorToUserMessage } from '@/utils/error'
import { resolveTotalScoreConfig } from '@/utils/totalScore'

const toast = useToast()
const appToast = createAppToast(toast)
const router = useRouter()
const navigateTo = (path) => router.push(path)

const {
    students,
    removeStudent,
    updateStudent,
    importStudent,
    resolveStudentIdConflict,
    standardizeStudentsClassInfo,
    currentSemester,
    isLoading,
    loadError,
    isMigrating,
} = inject('studentData')
const migrationLocked = computed(() => Boolean(isMigrating?.value))

const buildSemesterPathHints = () => {
    const semester = String(currentSemester?.value || '').trim()
    if (!semester) return ['class/config.json']
    return [
        `class/semesters/${semester}/students`,
        `class/semesters/${semester}/students/_deleted_students.json`,
        'class/config.json',
    ]
}

const studentConfig = ref(null)
const penaltyDisplayConfig = ref(null)
const totalScoreConfig = ref(resolveTotalScoreConfig())
onMounted(async () => {
    const [nextStudentConfig, nextServerConfig] = await Promise.all([
        getStudentConfig(),
        getServerConfig(),
    ])
    studentConfig.value = nextStudentConfig
    penaltyDisplayConfig.value = nextServerConfig
    totalScoreConfig.value = resolveTotalScoreConfig(nextServerConfig)
})

const selectedGrade = ref('全部')
const selectedClass = ref('全部')

const {
    state: deleteState,
    deleteDescription,
    openDeleteModal,
    closeDeleteModal,
} = useStudentDeleteStore()
const currentStudentStore = useCurrentStudentStore()

const isExporting = ref(false)

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
const importConflictRows = ref([])
const importConflictGroups = ref([])
const importConflictCursor = ref(0)
const selectedConflictOptionKey = ref('')
const isConflictResolving = ref(false)
const isConflictResolveModalOpen = ref(false)
const isConflictConfirmModalOpen = ref(false)

const currentConflictGroup = computed(
    () => importConflictGroups.value[importConflictCursor.value] || null,
)

const conflictResolveDescription = computed(() => {
    const group = currentConflictGroup.value
    if (!group) return ''
    const idx = importConflictCursor.value + 1
    const total = importConflictGroups.value.length
    if (group.hasLocalExisting) {
        return `检测到学号冲突（${idx}/${total}）：学号 ${group.id}。\n请选择本学号最终保留的学生，或选择“全部不保留”。`
    }
    return `检测到学号冲突（${idx}/${total}）：学号 ${group.id}。\n请选择本学号最终保留的学生。`
})

const conflictDecisionOptions = computed(() => {
    const group = currentConflictGroup.value
    if (!group) return []
    const candidates = Array.isArray(group.candidates) ? group.candidates : []
    const options = candidates.map((row, index) => ({
        key: `keep:${index}`,
        label: `保留 ${row.name || '-'}（学号 ${row.id || '-'}）`,
        hint: row.locked ? '该学生已被固定，将优先作为保留对象' : '',
        candidate: row,
    }))
    if (group.hasLocalExisting) {
        options.push({
            key: 'drop-all',
            label: '全部不保留',
            hint: '将删除本地该学号相关信息，本次冲突全部丢弃',
            candidate: null,
        })
    }
    return options
})

const conflictConfirmDescription = computed(() => {
    const group = currentConflictGroup.value
    if (!group) return ''
    const selected = conflictDecisionOptions.value.find(
        (it) => it.key === selectedConflictOptionKey.value,
    )
    if (!selected) return ''
    if (selected.key === 'drop-all') {
        return `你将删除学号 ${group.id} 的本地信息，并且本次冲突不保留任何学生。\n该操作不可撤销，请确认是否继续。`
    }
    return `你将固定学号 ${group.id} 对应学生为 ${selected?.candidate?.name || '-'}。\n后续再遇到同学号不同姓名将直接拒绝导入，不再弹出选择。\n该操作不可撤销，请确认是否继续。`
})

const buildConflictKey = (candidate) => `${candidate?.id || ''}::${candidate?.name || ''}`

const mergeConflictGroup = (targetMap, conflict) => {
    const id = String(conflict?.id || '').trim()
    if (!id) return
    const existing = targetMap.get(id) || { id, candidates: [] }
    const append = (candidate) => {
        if (!candidate?.student) return
        const name = String(candidate?.name || '').trim()
        if (!name) return
        const key = buildConflictKey({ id, name })
        if (existing.candidates.some((it) => buildConflictKey(it) === key)) return
        existing.candidates.push({
            id,
            name,
            source: candidate?.source || 'import',
            locked: Boolean(candidate?.locked),
            student: candidate.student,
        })
    }
    for (const row of Array.isArray(conflict?.candidates) ? conflict.candidates : []) append(row)
    append(conflict?.incoming)
    targetMap.set(id, existing)
}

const collectConflictGroups = (results) => {
    const provisionalIds = new Set(
        (Array.isArray(results) ? results : [])
            .filter((row) => row?.status === 'success' && row?.savedNow === true)
            .map((row) => String(row?.id || '').trim())
            .filter(Boolean),
    )
    const map = new Map()
    for (const row of Array.isArray(results) ? results : []) {
        if (row?.status !== 'conflict') continue
        mergeConflictGroup(map, row?.conflict)
    }
    return Array.from(map.values()).map((group) => {
        const hasLocalCandidate = (Array.isArray(group?.candidates) ? group.candidates : []).some(
            (candidate) => String(candidate?.source || 'import') !== 'import',
        )
        const id = String(group?.id || '').trim()
        const hasLocalExisting = hasLocalCandidate && !provisionalIds.has(id)
        return { ...group, hasLocalExisting }
    })
}

const isMaterialExporting = ref(false)
const materialExportProgress = ref({ done: 0, total: 0 })

const isCompletingBase = ref(false)
const isCompleteBaseModalOpen = ref(false)
const completeBasePreview = ref({ studentsToUpdate: 0, baseItemCount: 0 })

const completeBaseConfirmDescription = computed(() => {
    const { studentsToUpdate, baseItemCount } = completeBasePreview.value || {}
    return `将为“基础分全部为 0”的学生，一键补全 ${baseItemCount || 0} 个基础分项目为满分。\n预计影响 ${studentsToUpdate || 0} 位学生。\n此操作不可撤销，是否继续？`
})

const handleDelete = (student) => {
    openDeleteModal(student)
}

const handleView = (student) => {
    currentStudentStore.currentStudentId = String(student?.id ?? '')
    navigateTo('/class/student/preview')
}

const confirmDelete = async () => {
    if (migrationLocked.value) return
    if (deleteState.target) {
        try {
            await removeStudent(deleteState.target.id)
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
}

const sanitizeFileName = (name) => {
    if (!name) return 'file'
    return String(name)
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
}

const exportClassMaterial = async () => {
    if (isMaterialExporting.value || isStudentImporting.value || isExporting.value) return

    isMaterialExporting.value = true
    try {
        const semester = currentSemester?.value
        if (!semester) throw new Error('当前学期无效')
        const localConfig = await ensureLocalConfig({ scope: 'class' })
        const classInfo = getLocalClassInfo(localConfig)
        if (!classInfo) throw new Error('缺少班级信息，请先在设置中完善')

        if (typeof standardizeStudentsClassInfo === 'function') {
            await standardizeStudentsClassInfo()
        }

        const list = students.value || []
        materialExportProgress.value = { done: 0, total: list.length }
        const packedStudents = []
        for (const s of list) {
            const embedded = await embedEvidenceFilesForExport({
                scope: 'class',
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
        const payload = { semester, class: classInfo, students: packedStudents }
        const text = await createDyfText({ type: 'class', payload, serverConfig })

        const fileName = sanitizeFileName(
            `${classInfo.grade}-${classInfo.major}-${classInfo.class}_${semester}_整班材料.dyf`,
        )
        saveAs(new Blob([text], { type: 'application/json' }), fileName)
        appToast.success({ title: '导出成功', description: '已生成整班材料文件' })
    } catch (e) {
        appToast.error({
            title: '导出失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '导出整班材料',
                pathHints: buildSemesterPathHints(),
            }),
        })
    } finally {
        isMaterialExporting.value = false
        materialExportProgress.value = { done: 0, total: 0 }
    }
}

const categoryItems = computed(() => buildStudentCategoryItems(studentConfig.value))

const baseRows = computed(() => {
    let data = buildStudentTableRows({
        students: students.value || [],
        categoryItems: categoryItems.value,
        penaltyCategoryCodes: totalScoreConfig.value.penaltyCategoryCodes,
        negativeItemNumbers: totalScoreConfig.value.negativeItemNumbers,
    })

    if (selectedGrade.value && selectedGrade.value !== '全部')
        data = data.filter((item) => String(item.grade).includes(selectedGrade.value))
    if (selectedClass.value && selectedClass.value !== '全部')
        data = data.filter((item) => String(item.class).includes(selectedClass.value))
    return data
})

const exportStudents = computed(() => {
    let list = students.value || []
    if (selectedGrade.value && selectedGrade.value !== '全部') {
        list = list.filter((s) =>
            String(s?.data?.personal?.年级?.data || '').includes(selectedGrade.value),
        )
    }
    if (selectedClass.value && selectedClass.value !== '全部') {
        list = list.filter((s) =>
            String(s?.data?.personal?.班级?.data || '').includes(selectedClass.value),
        )
    }
    return list
})

const tableData = computed(() => {
    const data = [...baseRows.value]
    data.sort((a, b) => Number(b.total) - Number(a.total))
    return data
})

const tableRows = computed(() => tableData.value)

const tableColumns = computed(() =>
    buildStudentTableColumns({
        categoryItems: categoryItems.value,
        penaltyDisplayConfig: penaltyDisplayConfig.value,
    }),
)

const stats = computed(() => {
    const list = tableRows.value || []
    const total = list.length
    if (!total) return { total: 0, avg: 0, max: 0, min: 0 }

    let sum = 0
    let max = -Infinity
    let min = Infinity
    for (const row of list) {
        const v = Number(row?.total ?? 0)
        if (Number.isNaN(v)) continue
        sum += v
        if (v > max) max = v
        if (v < min) min = v
    }

    const avg = Number((sum / total).toFixed(1))
    return {
        total,
        avg,
        max: Number.isFinite(max) ? max : 0,
        min: Number.isFinite(min) ? min : 0,
    }
})

const exportCategoriesAll = computed(() => {
    const dyf = studentConfig.value?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return []
    return Object.keys(dyf)
})

const normalizeMajorName = (major) =>
    String(major || '')
        .replace(/专业/g, '')
        .trim()

const buildClassExportFileName = (list) => {
    const first = (Array.isArray(list) ? list : [])[0]
    const grade = String(first?.data?.personal?.年级?.data || selectedGrade.value || '20XX').trim()
    const major = normalizeMajorName(first?.data?.personal?.专业?.data)
    const cls =
        selectedClass.value && selectedClass.value !== '全部'
            ? String(selectedClass.value)
            : String(first?.data?.personal?.班级?.data || 'XX班')
    const title = `${grade}级${major}${cls}综合素质测评分数核算表`
    return `${safeNamePart(title)}.xlsx`
}
const exportAll = async () => {
    if (!exportCategoriesAll.value.length) {
        appToast.error({ title: '导出失败', description: '未找到德育分配置' })
        return
    }
    isExporting.value = true
    try {
        if (typeof standardizeStudentsClassInfo === 'function') {
            await standardizeStudentsClassInfo()
        }
        const filename = buildClassExportFileName(exportStudents.value)
        await exportStudentScoresXlsx({
            filename,
            studentConfig: studentConfig.value,
            scope: 'class',
            className: selectedClass.value === '全部' ? '' : selectedClass.value,
            sheets: [
                {
                    name: '总表',
                    categories: exportCategoriesAll.value,
                    students: exportStudents.value,
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

const rebuildImportResultSummary = (results) => {
    const list = Array.isArray(results) ? results : []
    const successCount = list.filter(
        (r) => r.status === 'success' || r.status === 'resolved',
    ).length
    const restoredCount = list.filter((r) => r.status === 'restored').length
    const failCount = list.filter(
        (r) =>
            r.status !== 'success' &&
            r.status !== 'resolved' &&
            r.status !== 'restored' &&
            r.status !== 'dropped',
    ).length
    return { successCount, restoredCount, failCount }
}

const selectConflictOption = (key) => {
    selectedConflictOptionKey.value = key
}

const closeConflictResolveModal = () => {
    isConflictResolveModalOpen.value = false
}

const openConflictConfirmModal = () => {
    if (!selectedConflictOptionKey.value) return
    isConflictConfirmModalOpen.value = true
}

const applyConflictDecisionToRows = ({ id, status, message, statusText }) => {
    const targetId = String(id || '')
    if (!targetId) return
    importConflictRows.value = importConflictRows.value.map((row) => {
        if (String(row?.id || '') !== targetId || row?.status !== 'conflict') return row
        return {
            ...row,
            ok: status === 'resolved' || status === 'dropped',
            status,
            statusText: statusText || row?.statusText || '',
            message: message || row?.message || '',
        }
    })
}

const moveToNextConflict = () => {
    importConflictCursor.value += 1
    selectedConflictOptionKey.value = ''
    isConflictConfirmModalOpen.value = false
    if (importConflictCursor.value >= importConflictGroups.value.length) {
        isConflictResolveModalOpen.value = false
        return false
    }
    return true
}

const startConflictResolveFlow = () => {
    importConflictCursor.value = 0
    selectedConflictOptionKey.value = ''
    isConflictConfirmModalOpen.value = false
    isConflictResolveModalOpen.value = importConflictGroups.value.length > 0
}

const confirmConflictDecision = async () => {
    if (isConflictResolving.value) return
    const group = currentConflictGroup.value
    if (!group) return
    if (typeof resolveStudentIdConflict !== 'function') {
        appToast.error({ title: '处理失败', description: '未找到 resolveStudentIdConflict 能力' })
        return
    }
    const selected = conflictDecisionOptions.value.find(
        (it) => it.key === selectedConflictOptionKey.value,
    )
    if (!selected) return

    isConflictResolving.value = true
    try {
        if (selected.key === 'drop-all') {
            const r = await resolveStudentIdConflict({ id: group.id, keepNone: true })
            if (!r?.ok) throw new Error(r?.message || '冲突处理失败')
            applyConflictDecisionToRows({
                id: group.id,
                status: 'dropped',
                statusText: '冲突已丢弃',
                message: r?.message || '',
            })
        } else {
            const candidate = selected?.candidate
            const r = await resolveStudentIdConflict({
                id: group.id,
                keepStudent: candidate?.student,
                keepNone: false,
            })
            if (!r?.ok) throw new Error(r?.message || '冲突处理失败')
            applyConflictDecisionToRows({
                id: group.id,
                status: 'resolved',
                statusText: '冲突已固定',
                message: r?.message || '',
            })
        }
        const hasNext = moveToNextConflict()
        if (!hasNext) {
            const { successCount, restoredCount, failCount } = rebuildImportResultSummary(
                importConflictRows.value,
            )
            studentImportResults.value = {
                success: successCount,
                fail: failCount,
                restored: restoredCount,
                details: importConflictRows.value
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
            appToast.success({ title: '冲突处理完成', description: '已完成本次导入冲突决策' })
        }
    } catch (e) {
        appToast.error({
            title: '冲突处理失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '处理学号冲突',
                pathHints: buildSemesterPathHints(),
            }),
        })
    } finally {
        isConflictResolving.value = false
    }
}

const showImportOutcome = ({ results, successCount, restoredCount, failCount }) => {
    if (failCount === 0 && restoredCount === 0) {
        appToast.success({
            title: '导入成功',
            description: `成功导入 ${successCount} 名学生`,
        })
        return
    }
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

const rollbackProvisionalConflictSaves = async () => {
    if (!Array.isArray(importConflictGroups.value) || importConflictGroups.value.length === 0)
        return
    if (typeof resolveStudentIdConflict !== 'function') return
    const provisionalIds = importConflictGroups.value
        .map((g) => String(g?.id || '').trim())
        .filter(Boolean)
        .filter((id) =>
            importConflictRows.value.some(
                (r) =>
                    String(r?.id || '') === id && r?.status === 'success' && r?.savedNow === true,
            ),
        )
    const uniqueIds = Array.from(new Set(provisionalIds))
    for (const id of uniqueIds) {
        const rollback = await resolveStudentIdConflict({ id, keepNone: true })
        if (!rollback?.ok) throw new Error(rollback?.message || `撤销临时导入失败（学号 ${id}）`)
    }
    if (uniqueIds.length === 0) return
    importConflictRows.value = importConflictRows.value.map((row) => {
        const sid = String(row?.id || '')
        if (!uniqueIds.includes(sid)) return row
        if (row?.status === 'success' && row?.savedNow === true) {
            return {
                ...row,
                ok: false,
                status: 'conflict',
                statusText: '待冲突决策',
                message: '检测到同批次学号冲突，已暂不保存，待你确认保留对象',
            }
        }
        return row
    })
}

const handleStudentFileChange = async (event) => {
    if (migrationLocked.value) {
        if (event?.target) event.target.value = ''
        appToast.warning({ title: '请稍后', description: '正在迁移旧数据，请稍后再试' })
        return
    }
    if (isStudentImporting.value) return
    if (typeof importStudent !== 'function') {
        appToast.error({ title: '导入失败', description: '未找到 importStudent 能力' })
        return
    }

    try {
        isStudentImporting.value = true
        const files = Array.from(event?.target?.files || [])
        if (!files.length) return

        studentImportProgress.value = { done: 0, total: files.length }
        const { results } = await importStudentsFromFiles({
            files,
            importStudent,
            onProgress: (p) => (studentImportProgress.value = p),
        })

        isStudentImporting.value = false

        importConflictRows.value = Array.isArray(results) ? results.slice() : []
        importConflictGroups.value = collectConflictGroups(importConflictRows.value)
        if (importConflictGroups.value.length > 0) {
            await rollbackProvisionalConflictSaves()
            startConflictResolveFlow()
            appToast.warning({
                title: '检测到学号冲突',
                description: `共 ${importConflictGroups.value.length} 个学号冲突，请先完成保留决策`,
            })
            return
        }

        const { successCount, restoredCount, failCount } = rebuildImportResultSummary(
            importConflictRows.value,
        )
        showImportOutcome({
            results: importConflictRows.value,
            successCount,
            restoredCount,
            failCount,
        })
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

const clone = (obj) => {
    const raw = toRaw(obj)
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(raw)
        } catch {}
    }
    return JSON.parse(JSON.stringify(raw))
}

const ensureStudentDyf = (student) => {
    if (!student?.data) return
    if (!student.data.dyf || typeof student.data.dyf !== 'object') student.data.dyf = {}

    const template = studentConfig.value?.data?.dyf
    if (!template || typeof template !== 'object') return

    for (const categoryName of Object.keys(template)) {
        const tmplGroups = template[categoryName]
        if (!Array.isArray(tmplGroups)) continue

        if (!Array.isArray(student.data.dyf[categoryName])) {
            student.data.dyf[categoryName] = clone(tmplGroups)
            continue
        }

        const stuGroups = student.data.dyf[categoryName]
        for (let gi = 0; gi < tmplGroups.length; gi++) {
            const tmplGroup = tmplGroups[gi]
            if (!Array.isArray(tmplGroup)) continue
            if (!Array.isArray(stuGroups[gi])) {
                stuGroups[gi] = clone(tmplGroup)
                continue
            }
            const stuGroup = stuGroups[gi]
            const tmplByNum = new Map(tmplGroup.map((it) => [it?.number, it]))
            for (let ii = 0; ii < tmplGroup.length; ii++) {
                const tmplItem = tmplGroup[ii]
                if (!tmplItem?.number) continue
                const stuItem = stuGroup[ii]
                if (!stuItem?.number) {
                    stuGroup[ii] = clone(tmplItem)
                    continue
                }
                if (stuItem.number !== tmplItem.number) {
                    const replacement = tmplByNum.get(stuItem.number)
                    if (replacement) {
                        stuGroup[ii] = { ...clone(replacement), ...stuItem }
                    } else {
                        stuGroup[ii] = clone(tmplItem)
                    }
                }
            }
        }
    }
}

const buildItemRefIndex = (student) => {
    const map = new Map()
    const dyf = student?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return map
    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                if (!item?.number) continue
                map.set(item.number, item)
            }
        }
    }
    return map
}

const getItemFromRefIndex = (refIndex, num) =>
    refIndex?.get?.(num) || refIndex?.get?.(String(num)) || null

const runWithLimit = async (items, limit, fn) => {
    const queue = [...items]
    const workers = Array.from({ length: Math.max(1, limit) }, async () => {
        while (queue.length) {
            const it = queue.shift()
            if (!it) break
            await fn(it)
        }
    })
    await Promise.all(workers)
}

const normalizeNumberArray = (arr) =>
    (Array.isArray(arr) ? arr : []).map((v) => Number(v)).filter((v) => Number.isFinite(v))

const getFullScoreFromTemplateItem = (item) => {
    const scoreType = item?.score_type
    const max = Number(scoreType?.max)
    if (Number.isFinite(max)) return max

    const options = scoreType?.options
    if (options && typeof options === 'object') {
        const values = Array.isArray(options) ? options : Object.values(options)
        const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v))
        if (nums.length) return Math.max(...nums)
    }

    const fallback = Number(item?.max)
    if (Number.isFinite(fallback)) return fallback
    return 0
}

const buildBaseTemplateMeta = async () => {
    const baseGroups = studentConfig.value?.data?.dyf?.['基础分']
    if (!Array.isArray(baseGroups)) return { baseNumbers: [], fullScoreByNumber: new Map() }

    const serverConfig = await getServerConfig()
    const extraSet = new Set(normalizeNumberArray(serverConfig?.studentRequiredExtraItemNumbers))

    const items = baseGroups
        .flatMap((g) => (Array.isArray(g) ? g : []))
        .filter((it) => it?.number != null)

    const fullScoreByNumber = new Map()
    for (const it of items) {
        const num = Number(it.number)
        if (!Number.isFinite(num)) continue
        if (extraSet.has(num)) continue
        fullScoreByNumber.set(num, getFullScoreFromTemplateItem(it))
    }

    return { baseNumbers: Array.from(fullScoreByNumber.keys()), fullScoreByNumber }
}

const listStudentsToCompleteBase = async () => {
    const { baseNumbers } = await buildBaseTemplateMeta()
    if (!baseNumbers.length) return { baseNumbers, targets: [] }

    const list = students.value || []
    const targets = []
    for (const s of list) {
        const refIndex = buildItemRefIndex(s)
        let allZero = true
        for (const num of baseNumbers) {
            const scoreRaw = Number(getItemFromRefIndex(refIndex, num)?.score ?? 0)
            const score = Number.isFinite(scoreRaw) ? scoreRaw : 0
            if (score !== 0) {
                allZero = false
                break
            }
        }
        if (allZero) targets.push(s)
    }
    return { baseNumbers, targets }
}

const openCompleteBaseConfirm = async () => {
    if (migrationLocked.value) return
    if (
        isCompletingBase.value ||
        isExporting.value ||
        isMaterialExporting.value ||
        isStudentImporting.value
    )
        return
    if (!studentConfig.value) {
        appToast.error({ title: '操作失败', description: '德育分配置未加载完成' })
        return
    }

    try {
        const { baseNumbers, targets } = await listStudentsToCompleteBase()
        if (!baseNumbers.length) {
            appToast.error({ title: '操作失败', description: '未找到可补全的基础分项目配置' })
            return
        }
        completeBasePreview.value = {
            studentsToUpdate: targets.length,
            baseItemCount: baseNumbers.length,
        }
        isCompleteBaseModalOpen.value = true
    } catch (e) {
        appToast.error({
            title: '操作失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '预检查补全基础分',
                pathHints: buildSemesterPathHints(),
            }),
        })
    }
}

const closeCompleteBaseConfirm = () => {
    isCompleteBaseModalOpen.value = false
}

const confirmCompleteBase = async () => {
    if (migrationLocked.value) return
    if (isCompletingBase.value) return
    if (typeof updateStudent !== 'function') {
        appToast.error({ title: '操作失败', description: '未找到 updateStudent 能力' })
        return
    }

    isCompletingBase.value = true
    isCompleteBaseModalOpen.value = false
    try {
        const { baseNumbers, fullScoreByNumber } = await buildBaseTemplateMeta()
        if (!baseNumbers.length) throw new Error('未找到可补全的基础分项目配置')

        const list = students.value || []
        const toPersist = []
        for (const s of list) {
            const preIndex = buildItemRefIndex(s)
            let allZero = true
            for (const num of baseNumbers) {
                const scoreRaw = Number(getItemFromRefIndex(preIndex, num)?.score ?? 0)
                const score = Number.isFinite(scoreRaw) ? scoreRaw : 0
                if (score !== 0) {
                    allZero = false
                    break
                }
            }
            if (!allZero) continue

            ensureStudentDyf(s)
            const refIndex = buildItemRefIndex(s)

            let changed = false
            for (const num of baseNumbers) {
                const item = getItemFromRefIndex(refIndex, num)
                if (!item) continue
                const full = Number(fullScoreByNumber.get(num) ?? 0)
                if (!Number.isFinite(full)) continue
                const prev = Number(item.score ?? 0)
                const prevScore = Number.isFinite(prev) ? prev : 0
                if (prevScore !== full) {
                    item.score = full
                    changed = true
                }
            }
            if (changed) toPersist.push(s)
        }

        await runWithLimit(toPersist, 5, async (stu) => {
            await updateStudent(stu)
        })

        await nextTick()
        appToast.success({
            title: '补全完成',
            description: `已成功补全 ${toPersist.length} 位学生的基础分`,
        })
    } catch (e) {
        appToast.error({
            title: '补全失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '补全基础分',
                pathHints: buildSemesterPathHints(),
            }),
        })
    } finally {
        isCompletingBase.value = false
    }
}
</script>

<style scoped></style>
