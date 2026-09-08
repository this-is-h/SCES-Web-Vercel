<script setup>
import { ref, inject, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { createAppToast } from '@/utils/toast'
import { ensureLocalConfig, getLocalClassInfo, getServerConfig } from '@/utils/config'
import { normalizeSemesterValue } from '@/utils/studentStorage'
import { useStudentDataStore } from '@/stores/studentDataStore'
import { mapFileSystemErrorToUserMessage } from '@/utils/error'
import {
    calculateTotalScore,
    collectScoreDetails,
    resolveTotalScoreConfig,
} from '@/utils/totalScore'

const toast = useToast()
const appToast = createAppToast(toast)

const currentSemester = inject('currentSemester', ref(''))
const fsAuthorized = inject('fsAuthorized', ref(false))
const fsChecking = inject('fsChecking', ref(true))
const injectedClassInfo = inject('classInfo', null)
const classInfoRefreshNonce = inject('classInfoRefreshNonce', ref(0))

const store = useStudentDataStore()
const normalizedSemester = computed(() => normalizeSemesterValue(currentSemester.value))
const classInfoLoading = ref(false)
const classInfoError = ref('')
const classInfoSyncing = ref(false)
const isLoading = computed(
    () =>
        classInfoLoading.value ||
        store.isLoadingFor({ scope: 'class', semester: normalizedSemester.value }),
)
const loadError = computed(
    () =>
        classInfoError.value ||
        store.loadErrorFor({ scope: 'class', semester: normalizedSemester.value }),
)
const classInfo = ref({
    grade: '',
    major: '',
    class: '',
})
const serverConfig = ref(null)
const totalScoreConfig = computed(() => resolveTotalScoreConfig(serverConfig.value))
onMounted(async () => {
    serverConfig.value = await getServerConfig()
})
const effectiveClassInfo = computed(() => injectedClassInfo?.value ?? classInfo.value)
const students = computed(() =>
    store.studentsFor({ scope: 'class', semester: normalizedSemester.value }),
)

const analyzeEvidence = (dyfData) => {
    const result = {
        scoredItems: 0,
        missingEvidenceItems: 0,
        evidenceFiles: 0,
    }
    if (!dyfData || typeof dyfData !== 'object') return result
    for (const category in dyfData) {
        const groups = dyfData[category]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const score = Number(item?.score ?? 0)
                if (!Number.isFinite(score) || score === 0) continue
                result.scoredItems++
                const files = item?.support?.files
                if (Array.isArray(files)) {
                    result.evidenceFiles += files.length
                    if (files.length === 0) result.missingEvidenceItems++
                } else {
                    result.missingEvidenceItems++
                }
            }
        }
    }
    return result
}

const loadClassInfo = async () => {
    const localConfig = await ensureLocalConfig({ scope: 'class' })
    const info = getLocalClassInfo(localConfig)
    classInfo.value = info ?? { grade: '', major: '', class: '' }
}

const refresh = async ({ silent = false } = {}) => {
    const semester = normalizedSemester.value
    if (!semester) return
    if (!silent) classInfoLoading.value = true
    classInfoError.value = ''
    try {
        await Promise.all([
            loadClassInfo(),
            store.loadStudents({ scope: 'class', semester, silent: true }),
        ])
    } catch (e) {
        classInfoError.value = mapFileSystemErrorToUserMessage(e, {
            action: '加载班级数据',
            pathHints: ['class/config.json', `class/semesters/${semester}/students`],
        })
        appToast.error({ title: '加载失败', description: classInfoError.value })
    } finally {
        classInfoLoading.value = false
    }
}

watch(
    [fsChecking, fsAuthorized, currentSemester],
    async ([checking, authorized, semester]) => {
        if (checking) return
        if (!authorized) return
        if (!semester) return
        await refresh({ silent: true })
    },
    { immediate: true },
)

watch(
    classInfoRefreshNonce,
    async () => {
        if (fsChecking.value) return
        if (!fsAuthorized.value) return
        if (!normalizedSemester.value) return

        let timer = null
        try {
            timer = setTimeout(() => {
                classInfoSyncing.value = true
            }, 120)
            await refresh({ silent: true })
        } finally {
            if (timer) clearTimeout(timer)
            classInfoSyncing.value = false
        }
    },
    { flush: 'post' },
)

const overviewRows = computed(() => {
    const list = students.value || []
    return list.map((s) => {
        const personal = s?.data?.personal || {}
        const name = personal.姓名?.data || ''
        const id = personal.学号?.data || ''
        const grade = personal.年级?.data || ''
        const clazz = personal.班级?.data || ''
        const evidence = analyzeEvidence(s?.data?.dyf)
        return {
            name,
            id,
            grade,
            class: clazz,
            total: calculateTotalScore(
                collectScoreDetails(s?.data?.dyf),
                totalScoreConfig.value.penaltyCategoryCodes,
                totalScoreConfig.value.negativeItemNumbers,
            ),
            scoredItems: evidence.scoredItems,
            missingEvidenceItems: evidence.missingEvidenceItems,
            evidenceFiles: evidence.evidenceFiles,
            hasIdentity: Boolean(name && id),
        }
    })
})

const totalStudents = computed(() => overviewRows.value.length)
const avgScore = computed(() => {
    if (!overviewRows.value.length) return 0
    const sum = overviewRows.value.reduce((acc, cur) => acc + Number(cur.total || 0), 0)
    return Number((sum / overviewRows.value.length).toFixed(1))
})
const maxScore = computed(() =>
    overviewRows.value.length ? Math.max(...overviewRows.value.map((r) => r.total)) : 0,
)
const minScore = computed(() =>
    overviewRows.value.length ? Math.min(...overviewRows.value.map((r) => r.total)) : 0,
)

const topStudents = computed(() => {
    const data = [...overviewRows.value]
    data.sort((a, b) => Number(b.total) - Number(a.total))
    return data.slice(0, 10)
})

const bottomStudents = computed(() => {
    const data = [...overviewRows.value]
    data.sort((a, b) => Number(a.total) - Number(b.total))
    return data.slice(0, 10)
})

const rankColumns = [
    { accessorKey: 'id', header: '学号' },
    { accessorKey: 'name', header: '姓名' },
    { accessorKey: 'total', header: '总分' },
]

const classTitle = computed(() => {
    const parts = []
    if (effectiveClassInfo.value.grade) parts.push(`${effectiveClassInfo.value.grade}级`)
    if (effectiveClassInfo.value.major) parts.push(effectiveClassInfo.value.major)
    if (effectiveClassInfo.value.class) parts.push(effectiveClassInfo.value.class)
    const t = parts.join(' ')
    return t || '未设置班级信息'
})

const semesterLabel = computed(() => String(currentSemester?.value || ''))
</script>

<template>
    <div class="flex flex-col h-full gap-4 p-4 overflow-hidden">
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex flex-col gap-1">
                <div class="text-lg font-bold text-highlighted">
                    {{ classTitle }}
                </div>
                <div class="text-sm text-default/60 flex items-center gap-2">
                    <span>当前学期</span>
                    <UBadge variant="subtle" color="neutral" size="xs">
                        {{ semesterLabel }}
                    </UBadge>
                    <span v-if="isLoading" class="inline-flex items-center gap-1">
                        <UIcon name="i-lucide:loader-2" class="size-4 animate-spin text-primary" />
                        加载中
                    </span>
                    <span v-else-if="classInfoSyncing" class="inline-flex items-center gap-1">
                        <UIcon name="i-lucide:loader-2" class="size-4 animate-spin text-primary" />
                        同步中
                    </span>
                </div>
                <div v-if="loadError" class="text-sm text-red-600">
                    {{ loadError }}
                </div>
            </div>

            <div class="flex items-center gap-2">
                <UButton
                    size="sm"
                    color="neutral"
                    variant="subtle"
                    icon="i-lucide-refresh-cw"
                    :loading="isLoading"
                    :disabled="fsChecking || !fsAuthorized"
                    @click="refresh()"
                >
                    刷新
                </UButton>
                <RouterLink to="/class/student/overview">
                    <UButton size="sm" color="neutral" variant="subtle" icon="i-lucide-bar-chart-3">
                        学生总体
                    </UButton>
                </RouterLink>
                <RouterLink to="/class/student/preview">
                    <UButton size="sm" color="neutral" variant="subtle" icon="i-lucide-search">
                        单个预览
                    </UButton>
                </RouterLink>
                <RouterLink to="/class/settings">
                    <UButton size="sm" color="neutral" variant="subtle" icon="i-lucide-cog">
                        设置
                    </UButton>
                </RouterLink>
            </div>
        </div>

        <div
            v-if="fsChecking"
            class="flex items-center justify-center grow text-sm text-default/60"
        >
            <UIcon name="i-lucide:loader-2" class="size-5 animate-spin text-primary mr-2" />
            正在检查文件系统权限...
        </div>

        <div
            v-else-if="!fsAuthorized"
            class="flex items-center justify-center grow text-sm text-default/60"
        >
            请先在右上角授权工作目录后再查看班级总览
        </div>

        <template v-else>
            <div class="grid grid-cols-4 gap-2">
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">学生人数</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ totalStudents }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">平均分</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ avgScore }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">最高分</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ maxScore }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">最低分</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ minScore }}
                    </div>
                </UCard>
            </div>

            <div class="flex w-full gap-2 grow min-h-0">
                <UCard
                    class="p-1 grow min-h-0 overflow-hidden"
                    :ui="{
                        root: 'flex flex-col min-h-0',
                        body: 'p-0 sm:p-0 flex-1 min-h-0 overflow-auto',
                    }"
                >
                    <template #header>
                        <div class="flex items-center justify-between">
                            <div class="font-semibold">得分排行（前 10）</div>
                            <UBadge v-if="totalStudents" variant="subtle" color="neutral" size="xs">
                                {{ totalStudents }} 人
                            </UBadge>
                        </div>
                    </template>

                    <UTable
                        v-if="topStudents.length"
                        :columns="rankColumns"
                        :data="topStudents"
                        :ui="{
                            th: 'text-nowrap bg-gray-50 dark:bg-gray-800',
                            td: 'text-nowrap p-2',
                        }"
                        class="h-full"
                    >
                        <template #missingEvidenceItems-cell="{ row }">
                            <UBadge
                                size="xs"
                                variant="subtle"
                                :color="
                                    row.original.missingEvidenceItems > 0 ? 'warning' : 'success'
                                "
                            >
                                {{ row.original.missingEvidenceItems }}
                            </UBadge>
                        </template>
                    </UTable>
                    <div
                        v-else
                        class="h-full flex items-center justify-center text-sm text-default/60"
                    >
                        暂无学生数据
                    </div>
                </UCard>

                <UCard
                    class="p-1 grow min-h-0 overflow-hidden"
                    :ui="{
                        root: 'flex flex-col min-h-0',
                        body: 'p-0 sm:p-0 flex-1 min-h-0 overflow-auto',
                    }"
                >
                    <template #header>
                        <div class="flex items-center justify-between">
                            <div class="font-semibold">低分预警（后 10）</div>
                            <UBadge
                                v-if="bottomStudents.length"
                                variant="subtle"
                                color="neutral"
                                size="xs"
                            >
                                {{ bottomStudents.length }} 条
                            </UBadge>
                        </div>
                    </template>

                    <UTable
                        v-if="bottomStudents.length"
                        :columns="rankColumns"
                        :data="bottomStudents"
                        :ui="{
                            th: 'text-nowrap bg-gray-50 dark:bg-gray-800',
                            td: 'text-nowrap p-2',
                        }"
                        class="h-full"
                    >
                        <template #missingEvidenceItems-cell="{ row }">
                            <UBadge
                                size="xs"
                                variant="subtle"
                                :color="
                                    row.original.missingEvidenceItems > 0 ? 'warning' : 'success'
                                "
                            >
                                {{ row.original.missingEvidenceItems }}
                            </UBadge>
                        </template>
                    </UTable>
                    <div
                        v-else
                        class="h-full flex items-center justify-center text-sm text-default/60"
                    >
                        暂无学生数据
                    </div>
                </UCard>
            </div>
        </template>
    </div>
</template>

<style scoped></style>
