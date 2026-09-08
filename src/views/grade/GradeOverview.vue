<script setup>
import { computed, inject, ref, watch, onMounted } from 'vue'
import { normalizeSemesterValue } from '@/utils/studentStorage'
import { useStudentDataStore } from '@/stores/studentDataStore'
import { getServerConfig } from '@/utils/config'
import {
    calculateTotalScore,
    collectScoreDetails,
    resolveTotalScoreConfig,
} from '@/utils/totalScore'

const currentSemester = inject('currentSemester', ref(''))
const fsAuthorized = inject('fsAuthorized', ref(false))
const fsChecking = inject('fsChecking', ref(false))

const store = useStudentDataStore()
const normalizedSemester = computed(() => normalizeSemesterValue(currentSemester.value))
const students = computed(() =>
    store.studentsFor({ scope: 'grade', semester: normalizedSemester.value }),
)
const isLoading = computed(() =>
    store.isLoadingFor({ scope: 'grade', semester: normalizedSemester.value }),
)
const loadError = computed(() =>
    store.loadErrorFor({ scope: 'grade', semester: normalizedSemester.value }),
)
const serverConfig = ref(null)
const totalScoreConfig = computed(() => resolveTotalScoreConfig(serverConfig.value))
onMounted(async () => {
    serverConfig.value = await getServerConfig()
})

const refresh = async () => {
    const semester = normalizedSemester.value
    if (!fsAuthorized.value || !semester) return
    await store.loadStudents({ scope: 'grade', semester })
}

watch(
    [fsChecking, fsAuthorized, currentSemester],
    ([checking, authorized, semester]) => {
        if (checking) return
        if (!authorized || !semester) return
        refresh()
    },
    { immediate: true },
)

const gradeFilter = ref('全部')
const gradeOptions = computed(() => {
    const set = new Set(
        students.value.map((s) => String(s?.data?.personal?.年级?.data ?? '')).filter(Boolean),
    )
    return [
        '全部',
        ...Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true })),
    ]
})

const lowScoreThreshold = 60

const filteredStudents = computed(() => {
    const list = students.value || []
    if (gradeFilter.value === '全部') return list
    return list.filter((s) => String(s?.data?.personal?.年级?.data ?? '') === gradeFilter.value)
})

const classStats = computed(() => {
    const groups = new Map()
    for (const s of students.value) {
        const p = s?.data?.personal ?? {}
        const grade = String(p?.年级?.data ?? '')
        const major = String(p?.专业?.data ?? '')
        const cls = String(p?.班级?.data ?? '')
        if (!grade || !major || !cls) continue
        if (gradeFilter.value !== '全部' && grade !== gradeFilter.value) continue

        const key = `${grade}||${major}||${cls}`
        if (!groups.has(key)) {
            groups.set(key, { grade, major, class: cls, count: 0, sum: 0, lowCount: 0 })
        }
        const g = groups.get(key)
        const total = calculateTotalScore(
            collectScoreDetails(s?.data?.dyf),
            totalScoreConfig.value.penaltyCategoryCodes,
            totalScoreConfig.value.negativeItemNumbers,
        )
        g.count++
        g.sum += total
        if (total < lowScoreThreshold) g.lowCount++
    }

    const list = Array.from(groups.values()).map((g) => ({
        ...g,
        avg: g.count ? Number((g.sum / g.count).toFixed(2)) : 0,
    }))
    return list
})

const overviewStats = computed(() => {
    const list = filteredStudents.value || []
    const gradeSet = new Set()
    const majorSet = new Set()
    let totalScore = 0
    let minScore = null
    let maxScore = null
    let lowCount = 0

    for (const s of list) {
        const p = s?.data?.personal ?? {}
        const grade = String(p?.年级?.data ?? '')
        const major = String(p?.专业?.data ?? '')
        if (grade) gradeSet.add(grade)
        if (major) majorSet.add(major)

        const total = calculateTotalScore(
            collectScoreDetails(s?.data?.dyf),
            totalScoreConfig.value.penaltyCategoryCodes,
            totalScoreConfig.value.negativeItemNumbers,
        )
        totalScore += total
        if (minScore == null || total < minScore) minScore = total
        if (maxScore == null || total > maxScore) maxScore = total
        if (total < lowScoreThreshold) lowCount += 1
    }

    const avg = list.length ? Number((totalScore / list.length).toFixed(2)) : 0
    return {
        students: list.length,
        classes: classStats.value.length,
        grades: gradeSet.size,
        majors: majorSet.size,
        avg,
        min: minScore ?? 0,
        max: maxScore ?? 0,
        low: lowCount,
    }
})

const topAvgClasses = computed(() => {
    return [...classStats.value].sort((a, b) => b.avg - a.avg).slice(0, 12)
})

const mostLowClasses = computed(() => {
    return [...classStats.value]
        .sort(
            (a, b) =>
                b.lowCount - a.lowCount || b.count - a.count || a.class.localeCompare(b.class),
        )
        .slice(0, 12)
})
</script>

<template>
    <div class="p-4 space-y-4">
        <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
                <div class="text-lg font-bold text-highlighted">年级总览</div>
                <div class="text-xs text-default/60">当前学期：{{ currentSemester || '-' }}</div>
            </div>
            <div class="flex items-center gap-2">
                <UFormField label="年级">
                    <USelectMenu v-model="gradeFilter" :items="gradeOptions" class="min-w-32" />
                </UFormField>
                <UButton
                    color="neutral"
                    variant="soft"
                    :loading="isLoading"
                    :disabled="!fsAuthorized"
                    @click="refresh"
                >
                    刷新
                </UButton>
            </div>
        </div>

        <UCard v-if="!fsAuthorized" class="w-full">
            <template #header>
                <div class="font-medium text-highlighted">需要授权文件夹</div>
            </template>
            <div class="text-sm text-default/60">请先在右上角完成文件夹授权。</div>
        </UCard>

        <UCard v-else-if="loadError" class="w-full">
            <template #header>
                <div class="font-medium text-highlighted">读取失败</div>
            </template>
            <div class="text-sm text-default/60">{{ loadError }}</div>
        </UCard>

        <div v-else class="space-y-4">
            <div class="grid grid-cols-6 gap-2">
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">学生人数</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ overviewStats.students }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">班级数量</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ overviewStats.classes }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">专业数量</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ overviewStats.majors }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">年级数量</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ overviewStats.grades }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">平均分</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ overviewStats.avg }}
                    </div>
                </UCard>
                <UCard :ui="{ body: 'p-2 sm:p-2 sm:px-4' }">
                    <div class="text-xs text-default/60">低分人数</div>
                    <div class="mt-1 text-2xl font-bold text-highlighted">
                        {{ overviewStats.low }}
                    </div>
                </UCard>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <UCard class="w-full">
                    <template #header>
                        <div class="flex items-center justify-between gap-4">
                            <div class="font-medium text-highlighted">均分较高的班级</div>
                            <div class="text-xs text-default/50">
                                Top {{ topAvgClasses.length }}
                            </div>
                        </div>
                    </template>
                    <div class="max-h-[55vh] overflow-y-auto">
                        <UTable
                            :data="topAvgClasses"
                            :columns="[
                                { accessorKey: 'grade', header: '年级' },
                                { accessorKey: 'major', header: '专业' },
                                { accessorKey: 'class', header: '班级' },
                                { accessorKey: 'avg', header: '均分' },
                                { accessorKey: 'count', header: '人数' },
                            ]"
                        />
                    </div>
                </UCard>

                <UCard class="w-full">
                    <template #header>
                        <div class="flex items-center justify-between gap-4">
                            <div class="font-medium text-highlighted">低分人数较多的班级</div>
                            <div class="text-xs text-default/50">
                                阈值 &lt; {{ lowScoreThreshold }}
                            </div>
                        </div>
                    </template>
                    <div class="max-h-[55vh] overflow-y-auto">
                        <UTable
                            :data="mostLowClasses"
                            :columns="[
                                { accessorKey: 'grade', header: '年级' },
                                { accessorKey: 'major', header: '专业' },
                                { accessorKey: 'class', header: '班级' },
                                { accessorKey: 'lowCount', header: '低分人数' },
                                { accessorKey: 'count', header: '总人数' },
                                { accessorKey: 'avg', header: '均分' },
                            ]"
                        />
                    </div>
                </UCard>
            </div>
        </div>
    </div>
</template>

<style scoped></style>
