<template>
    <div class="w-full h-full flex overflow-hidden">
        <div class="min-w-72 w-72 h-full overflow-hidden pl-4 pr-1 py-2 flex flex-col">
            <h1 class="text-base font-bold mb-2">学生列表</h1>
            <UTree
                ref="treeRef"
                :items="studentTree"
                v-model="selectedTreeItem"
                v-model:expanded="expandedKeys"
                :get-key="getTreeKey"
                selection-behavior="replace"
                class="overflow-y-auto flex-1"
            />
            <div class="flex flex-col justify-center items-center mt-2">
                <input
                    type="file"
                    ref="fileInput"
                    accept=".json,.dyf"
                    multiple
                    class="hidden"
                    @change="handleFileChange"
                />
                <div class="flex flex-col gap-2 w-full">
                    <UButton
                        color="neutral"
                        variant="soft"
                        :loading="isImporting"
                        :disabled="isImporting || migrationLocked"
                        :ui="{
                            base: 'flex justify-center items-center',
                        }"
                        @click="triggerFileInput"
                    >
                        导入材料
                    </UButton>
                </div>
            </div>
        </div>
        <USeparator orientation="vertical" class="h-full" />
        <div class="flex-1 min-w-0 h-full flex flex-col">
            <div
                v-if="selectedStudent"
                class="px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
            >
                <div class="flex items-start justify-center gap-2">
                    <div class="grow min-w-0">
                        <UTooltip :text="personal.姓名?.data ?? '未命名'">
                            <div class="text-lg font-bold text-highlighted truncate">
                                {{ personal.姓名?.data ?? '未命名' }}
                            </div>
                        </UTooltip>
                        <div class="text-xs text-default/60 mt-0.5">
                            学号：{{ personal.学号?.data ?? '-' }}
                        </div>
                    </div>
                    <div class="rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
                        <div class="text-[11px] text-default/60 text-nowrap">年级</div>
                        <div class="text-sm font-medium text-highlighted text-nowrap">
                            {{ personal.年级?.data ?? '-' }}
                        </div>
                    </div>
                    <div class="rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
                        <div class="text-[11px] text-default/60 text-nowrap">专业</div>
                        <div class="text-sm font-medium text-highlighted text-nowrap">
                            {{ personal.专业?.data ?? '-' }}
                        </div>
                    </div>
                    <div class="rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
                        <div class="text-[11px] text-default/60 text-nowrap">班级</div>
                        <div class="text-sm font-medium text-highlighted text-nowrap">
                            {{ personal.班级?.data ?? '-' }}
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-if="selectedStudent"
                class="w-full grid grid-cols-2 gap-4 flex-1 min-h-0 p-2 overflow-hidden"
            >
                <div
                    class="px-2 pb-4 bg-gray-50 dark:bg-white/5 rounded-md overflow-hidden overflow-y-auto min-h-0"
                >
                    <template v-for="category in leftCategories" :key="category.categoryName">
                        <div class="text-md font-bold mb-2 ml-2 mt-6">
                            {{ formatCategoryTitleText(category.categoryName) }}
                        </div>
                        <template v-for="group in category.groups" :key="group.groupIndex">
                            <InputCell
                                v-for="entry in group.entries"
                                :key="entry.item.number"
                                class="mb-2"
                                :title="
                                    formatItemNumberText(entry.item.number, category.categoryName)
                                "
                                :content="entry.item.description"
                                :type="entry.item.score_type"
                                :disabled="migrationLocked"
                                :requested-score="
                                    shouldShowRequestedScore(
                                        category.categoryName,
                                        entry.item.number,
                                    )
                                        ? selectedStudent.data.dyf[category.categoryName][
                                              group.groupIndex
                                          ][entry.itemIndex].max_score
                                        : null
                                "
                                v-model:score="
                                    selectedStudent.data.dyf[category.categoryName][
                                        group.groupIndex
                                    ][entry.itemIndex].score
                                "
                                :evidence="
                                    getEvidenceUrls(
                                        selectedStudent.data.dyf[category.categoryName][
                                            group.groupIndex
                                        ][entry.itemIndex].support?.files,
                                    )
                                "
                            />
                        </template>
                    </template>
                </div>

                <div
                    class="px-2 pb-4 bg-gray-50 dark:bg-white/5 rounded-md overflow-hidden overflow-y-auto min-h-0"
                >
                    <template v-if="visibleNeedUpdate.length">
                        <template
                            v-for="category in visibleNeedUpdate"
                            :key="category.categoryName"
                        >
                            <div class="text-md font-bold mb-2 ml-2 mt-6">
                                {{ formatCategoryTitleText(category.categoryName) }}
                            </div>
                            <template v-for="group in category.groups" :key="group.groupIndex">
                                <InputCell
                                    v-for="entry in group.entries"
                                    :key="entry.item.number"
                                    class="mb-2"
                                    :title="
                                        formatItemNumberText(
                                            entry.item.number,
                                            category.categoryName,
                                        )
                                    "
                                    :content="entry.item.description"
                                    :type="entry.item.score_type"
                                    :disabled="migrationLocked"
                                    :requested-score="
                                        shouldShowRequestedScore(
                                            category.categoryName,
                                            entry.item.number,
                                        )
                                            ? selectedStudent.data.dyf[category.categoryName][
                                                  group.groupIndex
                                              ][entry.itemIndex].max_score
                                            : null
                                    "
                                    v-model:score="
                                        selectedStudent.data.dyf[category.categoryName][
                                            group.groupIndex
                                        ][entry.itemIndex].score
                                    "
                                    :evidence="
                                        getEvidenceUrls(
                                            selectedStudent.data.dyf[category.categoryName][
                                                group.groupIndex
                                            ][entry.itemIndex].support?.files,
                                        )
                                    "
                                />
                            </template>
                        </template>
                    </template>
                    <div
                        v-else
                        class="h-full w-full flex items-center justify-center text-sm text-default/60"
                    >
                        该学生无相关材料
                    </div>
                </div>
            </div>

            <div v-else class="w-full h-full flex justify-center items-center text-default/60">
                请选择一个学生查看详情
            </div>
        </div>

        <ImportResult
            v-model:result-open="isImportResultModalOpen"
            v-model:loading-open="isImporting"
            :details="importResults.details"
            :success-count="importResults.success"
            :fail-count="importResults.fail"
            :progress="importProgress"
        />
    </div>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref, watch, toRaw } from 'vue'
import InputCell from '@/components/InputCell.vue'
import ImportResult from '@/components/ImportResult.vue'
import { fileSystemManager } from '@/utils/FileSystemManager'
import { getServerConfig, getServerConfigFallback, getStudentConfig } from '@/utils/config'
import { createAppToast } from '@/utils/toast'
import { useCurrentStudentStore } from '@/stores/currentStudentStore'
import { createObjectUrlCache } from '@/utils/objectUrlCache'
import { mapFileSystemErrorToUserMessage } from '@/utils/error'
import { formatPenaltyCategoryTitle, formatPenaltyItemLabel } from '@/utils/penaltyDisplay'

const { students, updateStudent, currentSemester, importDyf, importStudent, isMigrating } =
    inject('studentData')
const migrationLocked = computed(() => Boolean(isMigrating?.value))

const buildSemesterPathHints = () => {
    const semester = String(currentSemester?.value || '').trim()
    if (!semester) return ['grade/config.json']
    return [
        `grade/semesters/${semester}/students`,
        `grade/semesters/${semester}/students/_deleted_students.json`,
        'grade/config.json',
    ]
}

const toast = useToast()
const appToast = createAppToast(toast)
const currentStudentStore = useCurrentStudentStore()

const treeRef = ref(null)
const expandedKeys = ref([])

const studentConfig = ref(null)
const serverConfig = ref(getServerConfigFallback())

const buildGroupedTree = (list) => {
    const groupedTreeIndex = new Map()
    for (const student of list || []) {
        const personal = student?.data?.personal ?? {}
        const grade = String(personal?.年级?.data ?? '未填写年级')
        const major = String(personal?.专业?.data ?? '未填写专业')
        const className = String(personal?.班级?.data ?? '未填写班级')
        const studentId = String(personal?.学号?.data ?? '')
        const name = String(personal?.姓名?.data ?? '未命名')
        if (!studentId) continue

        if (!groupedTreeIndex.has(grade)) groupedTreeIndex.set(grade, new Map())
        const majors = groupedTreeIndex.get(grade)
        if (!majors.has(major)) majors.set(major, new Map())
        const classes = majors.get(major)
        if (!classes.has(className)) classes.set(className, [])
        classes.get(className).push({
            label: name,
            value: studentId,
            icon: 'i-solar:user-bold-duotone',
        })
    }

    const toItems = (map, parentKey = '') => {
        return Array.from(map.entries()).map(([label, nodeOrLeaf]) => {
            const key = parentKey ? `${parentKey}-${label}` : label
            if (nodeOrLeaf instanceof Map) {
                return { label, key, children: toItems(nodeOrLeaf, key) }
            }
            return { label, key, children: nodeOrLeaf }
        })
    }

    const items = toItems(groupedTreeIndex)
    const sortLeaf = (arr) => {
        arr.sort((a, b) =>
            String(a.value).localeCompare(String(b.value), 'zh-Hans-CN', { numeric: true }),
        )
    }
    const walk = (nodeList) => {
        for (const node of nodeList) {
            if (Array.isArray(node.children) && node.children.length && node.children[0]?.value) {
                sortLeaf(node.children)
            } else if (Array.isArray(node.children)) {
                walk(node.children)
            }
        }
    }
    walk(items)
    return items
}

const studentTree = computed(() => buildGroupedTree(students.value || []))
const getTreeKey = (item) => String(item?.key ?? item?.value ?? item?.label ?? '')

const getSelectedId = (item) => {
    const raw = item?.value ?? item?.id ?? item?.data?.personal?.学号?.data
    return raw != null ? String(raw) : ''
}

const findNodeByValue = (nodes, value) => {
    if (!nodes || !Array.isArray(nodes)) return null
    for (const node of nodes) {
        if (String(node.value) === String(value)) return node
        if (node.children) {
            const found = findNodeByValue(node.children, value)
            if (found) return found
        }
    }
    return null
}

const findParentKeysByValue = (nodes, value, parents = []) => {
    if (!nodes || !Array.isArray(nodes)) return null
    for (const node of nodes) {
        if (String(node.value) === String(value)) return parents
        if (node.children) {
            const key = getTreeKey(node)
            const found = findParentKeysByValue(node.children, value, [...parents, key])
            if (found) return found
        }
    }
    return null
}

onMounted(async () => {
    studentConfig.value = await getStudentConfig()
    serverConfig.value = await getServerConfig()
})

const formatCategoryTitleText = (categoryName) =>
    formatPenaltyCategoryTitle(categoryName, serverConfig.value)

const formatItemNumberText = (itemNumber) =>
    formatPenaltyItemLabel(itemNumber, {
        config: serverConfig.value,
    })

const studentRequiredCategories = computed(
    () => serverConfig.value?.studentRequiredCategories ?? [],
)
const studentRequiredExtraItemNumberSet = computed(
    () =>
        new Set((serverConfig.value?.studentRequiredExtraItemNumbers ?? []).map((n) => Number(n))),
)
const shouldShowRequestedScore = (categoryName, itemNumber) => {
    const categoryMatched = studentRequiredCategories.value.includes(categoryName)
    const number = Number(itemNumber)
    const extraMatched =
        Number.isFinite(number) && studentRequiredExtraItemNumberSet.value.has(number)
    return categoryMatched || extraMatched
}

const showZeroCategories = ref(new Set())
const showZeroItems = ref(new Set())
const showZeroCategoriesErrorShown = ref(false)
const showZeroItemsErrorShown = ref(false)
watch(
    () => [
        serverConfig.value?.adminRequiredCategories,
        serverConfig.value?.adminRequiredExtraItemNumbers,
    ],
    ([rawCats, rawItems]) => {
        if (rawCats == null) {
            showZeroCategories.value = new Set()
        } else if (!Array.isArray(rawCats)) {
            showZeroCategories.value = new Set()
            if (!showZeroCategoriesErrorShown.value) {
                showZeroCategoriesErrorShown.value = true
                appToast.error({
                    title: '配置错误',
                    description: 'adminRequiredCategories 格式不正确，应为字符串数组',
                })
            }
        } else {
            showZeroCategories.value = new Set(
                rawCats.map((v) => String(v || '').trim()).filter(Boolean),
            )
        }

        if (rawItems == null) {
            showZeroItems.value = new Set()
        } else if (!Array.isArray(rawItems)) {
            showZeroItems.value = new Set()
            if (!showZeroItemsErrorShown.value) {
                showZeroItemsErrorShown.value = true
                appToast.error({
                    title: '配置错误',
                    description: 'adminRequiredExtraItemNumbers 格式不正确，应为数字数组',
                })
            }
        } else {
            const out = new Set()
            for (const v of rawItems) {
                const n = Number(v)
                if (Number.isFinite(n)) out.add(n)
            }
            showZeroItems.value = out
        }
    },
    { immediate: true },
)

const leftCategories = computed(() => {
    const templateDyf = studentConfig.value?.data?.dyf
    const needUpdate = studentRequiredCategories.value || []
    const extraSet = studentRequiredExtraItemNumberSet.value
    const showZeroCats = showZeroCategories.value
    const showZeroItemsSet = showZeroItems.value
    if (!templateDyf || typeof templateDyf !== 'object') return []

    const out = []
    for (const categoryName of Object.keys(templateDyf)) {
        if (needUpdate.includes(categoryName)) continue
        if (showZeroCats.has(categoryName)) continue
        const category = templateDyf[categoryName]
        if (!Array.isArray(category)) continue
        const groups = []
        for (let groupIndex = 0; groupIndex < category.length; groupIndex++) {
            const group = category[groupIndex]
            if (!Array.isArray(group)) continue
            const entries = []
            for (let itemIndex = 0; itemIndex < group.length; itemIndex++) {
                const item = group[itemIndex]
                const num = Number(item?.number)
                if (extraSet.has(num)) continue
                if (showZeroItemsSet.has(num)) continue
                entries.push({ item, itemIndex })
            }
            if (entries.length) groups.push({ groupIndex, entries })
        }
        if (groups.length) out.push({ categoryName, groups })
    }
    return out
})

const selectedStudent = ref(null)
const selectedTreeItem = ref(null)
const imageMap = ref(new Map())
const urlCache = createObjectUrlCache({ maxEntries: 200 })

const fileInput = ref(null)
const isImporting = ref(false)
const importProgress = ref({ done: 0, total: 0 })
const isImportResultModalOpen = ref(false)
const importResults = ref({
    success: 0,
    fail: 0,
    details: [],
})

const triggerFileInput = () => {
    if (migrationLocked.value) return
    fileInput.value?.click()
}

const handleFileChange = async (event) => {
    if (migrationLocked.value) {
        if (event?.target) event.target.value = ''
        return
    }
    if (isImporting.value) return
    try {
        isImporting.value = true
        const files = Array.from(event?.target?.files || [])
        if (!files.length) return

        importProgress.value = { done: 0, total: files.length }
        const details = []

        for (const f of files) {
            const text = await f.text()
            const r = importDyf ? await importDyf(text) : await importStudent(text)
            if (Array.isArray(r?.details) && r.details.length) {
                details.push(...r.details.map((d) => ({ ...d })))
            } else {
                details.push({ ...(r ?? {}), name: r?.name ?? '-', id: r?.id ?? '-' })
            }
            importProgress.value = { done: importProgress.value.done + 1, total: files.length }
        }

        const okCount = details.filter((d) => d.ok).length
        const failCount = details.length - okCount

        if (failCount === 0) {
            appToast.success({ title: '导入成功', description: `成功导入 ${okCount} 条记录` })
        } else {
            importResults.value = {
                success: okCount,
                fail: failCount,
                details: details
                    .filter((d) => !d.ok)
                    .map((d) => ({
                        name: d.name || '-',
                        id: d.id || '-',
                        status: 'error',
                        message: d.message,
                    })),
            }
            isImportResultModalOpen.value = true
            appToast.warning({
                title: '部分导入失败',
                description: `成功 ${okCount}，失败/跳过 ${failCount}`,
            })
        }
    } catch (e) {
        appToast.error({
            title: '导入失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '导入材料',
                pathHints: buildSemesterPathHints(),
            }),
        })
    } finally {
        isImporting.value = false
        importProgress.value = { done: 0, total: 0 }
        if (event?.target) event.target.value = ''
    }
}

const personal = computed(() => selectedStudent.value?.data?.personal || {})

const sanitizeFileName = (name) => {
    if (!name) return 'file'
    return String(name)
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
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
            for (let ii = 0; ii < tmplGroup.length; ii++) {
                const tmplItem = tmplGroup[ii]
                const stuItem = stuGroup[ii]
                if (!stuItem || typeof stuItem !== 'object') {
                    stuGroup[ii] = clone(tmplItem)
                    continue
                }
                if (stuItem.number == null) stuItem.number = tmplItem.number
                if (stuItem.description == null) stuItem.description = tmplItem.description
                if (stuItem.score_type == null) stuItem.score_type = tmplItem.score_type
                if (stuItem.support == null) stuItem.support = clone(tmplItem.support || {})
                if (stuItem.support && stuItem.support.files == null) stuItem.support.files = []
                if (stuItem.score == null) stuItem.score = 0
            }
        }
    }
}

const getNeedUpdateKey = (categoryName, groupIndex, itemIndex) =>
    `${categoryName}::${groupIndex}::${itemIndex}`

const seenNeedUpdateKeys = ref(new Set())
watch(
    () =>
        String(
            selectedStudent.value?.data?.personal?.学号?.data ??
                selectedStudent.value?.data?.personal?.id?.data ??
                '',
        ),
    () => {
        seenNeedUpdateKeys.value = new Set()
    },
    { immediate: true },
)

const visibleNeedUpdate = computed(() => {
    const list = []
    const templateDyf = studentConfig.value?.data?.dyf
    const studentDyf = selectedStudent.value?.data?.dyf
    const needUpdate = studentRequiredCategories.value || []
    const extraSet = studentRequiredExtraItemNumberSet.value
    const showZeroCats = showZeroCategories.value
    const showZeroItemsSet = showZeroItems.value
    const forceShowByCategory = showZeroCats.size > 0
    const forceShowByItem = showZeroItemsSet.size > 0
    if (!templateDyf || typeof templateDyf !== 'object') return list
    if (!studentDyf || typeof studentDyf !== 'object') return list

    for (const categoryName of Object.keys(templateDyf)) {
        const category = templateDyf[categoryName]
        if (!Array.isArray(category)) continue

        const groups = []
        for (let groupIndex = 0; groupIndex < category.length; groupIndex++) {
            const group = category[groupIndex]
            if (!Array.isArray(group)) continue

            const entries = []
            for (let itemIndex = 0; itemIndex < group.length; itemIndex++) {
                const item = group[itemIndex]
                const number = Number(item?.number)
                const studentItem = studentDyf?.[categoryName]?.[groupIndex]?.[itemIndex]
                const score = Number(studentItem?.score ?? 0)
                const files = studentItem?.support?.files
                const hasEvidence = Array.isArray(files) && files.length > 0
                const shouldShowZero =
                    (forceShowByCategory && showZeroCats.has(categoryName)) ||
                    (forceShowByItem && showZeroItemsSet.has(number))
                const isRequired = needUpdate.includes(categoryName) || extraSet.has(number)
                if (!shouldShowZero && !isRequired) continue
                const key = getNeedUpdateKey(categoryName, groupIndex, itemIndex)
                const shouldKeepVisible = hasEvidence || seenNeedUpdateKeys.value.has(key)
                if (!shouldShowZero && score === 0 && !shouldKeepVisible) continue
                entries.push({ item, itemIndex })
            }
            if (entries.length > 0) groups.push({ groupIndex, entries })
        }
        if (groups.length > 0) list.push({ categoryName, groups })
    }
    return list
})

watch(
    visibleNeedUpdate,
    (nextList) => {
        const current = seenNeedUpdateKeys.value
        const next = new Set(current)
        let changed = false
        for (const category of nextList || []) {
            for (const group of category?.groups || []) {
                for (const entry of group?.entries || []) {
                    const key = getNeedUpdateKey(
                        category.categoryName,
                        group.groupIndex,
                        entry.itemIndex,
                    )
                    if (!next.has(key)) {
                        next.add(key)
                        changed = true
                    }
                }
            }
        }
        if (changed) seenNeedUpdateKeys.value = next
    },
    { immediate: true },
)

const autoSelectDefault = ref(true)
const isSyncingSelection = ref(false)

const findFirstLeaf = (nodes) => {
    if (!nodes || !Array.isArray(nodes)) return null
    for (const node of nodes) {
        if (node?.value != null && String(node.value)) return node
        const found = findFirstLeaf(node?.children)
        if (found) return found
    }
    return null
}

const setSelectedTreeItemSafe = (item) => {
    isSyncingSelection.value = true
    selectedTreeItem.value = item
    Promise.resolve().then(() => {
        isSyncingSelection.value = false
    })
}

const syncSelectionFromStore = (list) => {
    const sid = String(currentStudentStore.currentStudentId || '')
    if (!sid) {
        if (!autoSelectDefault.value) {
            if (selectedTreeItem.value) setSelectedTreeItemSafe(null)
            return
        }
        const first = findFirstLeaf(list)
        if (first?.value != null) {
            const nextId = String(first.value)
            autoSelectDefault.value = false
            currentStudentStore.currentStudentId = nextId
            setSelectedTreeItemSafe(first)
        }
        return
    }
    const found = findNodeByValue(list, sid)
    if (!found) {
        if (!autoSelectDefault.value) {
            currentStudentStore.currentStudentId = ''
            if (selectedTreeItem.value) setSelectedTreeItemSafe(null)
            return
        }
        const first = findFirstLeaf(list)
        if (first?.value != null) {
            const nextId = String(first.value)
            autoSelectDefault.value = false
            currentStudentStore.currentStudentId = nextId
            setSelectedTreeItemSafe(first)
            return
        }
        currentStudentStore.currentStudentId = ''
        setSelectedTreeItemSafe(null)
        return
    }
    autoSelectDefault.value = false
    if (getSelectedId(selectedTreeItem.value) !== sid) {
        setSelectedTreeItemSafe(found)
    }

    const parents = findParentKeysByValue(list, sid) || []
    if (parents.length) {
        const next = new Set(expandedKeys.value || [])
        for (const k of parents) next.add(k)
        expandedKeys.value = Array.from(next)
    }
}

watch(
    [selectedTreeItem, students],
    ([item, list]) => {
        const sid = item?.value != null ? String(item.value) : ''
        const found = sid
            ? (list || []).find((s) => String(s.data?.personal?.学号?.data) === sid)
            : null
        if (found) ensureStudentDyf(found)
        selectedStudent.value = found || null
    },
    { immediate: true },
)

watch(
    [() => currentStudentStore.currentStudentId, studentTree],
    ([, list]) => {
        const next = list || []
        if (!next.length) return
        syncSelectionFromStore(next)
    },
    { immediate: true, flush: 'post' },
)

watch(
    selectedTreeItem,
    (item) => {
        const sid = getSelectedId(item)
        if (!sid) {
            if (!isSyncingSelection.value && String(currentStudentStore.currentStudentId || '')) {
                autoSelectDefault.value = false
                currentStudentStore.currentStudentId = ''
            }
            return
        }
        autoSelectDefault.value = false
        if (String(currentStudentStore.currentStudentId || '') === sid) return
        currentStudentStore.currentStudentId = sid
    },
    { immediate: true },
)

const loadImages = async () => {
    if (!selectedStudent.value) return

    const name = selectedStudent.value.data?.personal?.姓名?.data
    const id = selectedStudent.value.data?.personal?.学号?.data
    if (!name || !id) return
    const evidencePath = `grade/semesters/${currentSemester.value}/students/${sanitizeFileName(name)}_${sanitizeFileName(id)}/evidence`

    const findFiles = (obj) => {
        let files = []
        if (!obj || typeof obj !== 'object') return files
        for (const key in obj) {
            if (key === 'files' && Array.isArray(obj[key])) {
                files = files.concat(obj[key])
            } else {
                files = files.concat(findFiles(obj[key]))
            }
        }
        return files
    }

    const allFiles = findFiles(selectedStudent.value.data?.dyf)
    const uniqueFiles = [...new Set(allFiles.filter((f) => typeof f === 'string'))]

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

    const nextMap = new Map()
    await runWithLimit(uniqueFiles, 6, async (fileName) => {
        const key = `${evidencePath}/${fileName}`
        const cachedUrl = urlCache.get(key)
        if (cachedUrl) {
            nextMap.set(fileName, cachedUrl)
            return
        }
        try {
            const fileHandle = await fileSystemManager.getFileHandle(`${evidencePath}/${fileName}`)
            const file = await fileHandle.getFile()
            const url = urlCache.set(key, file)
            nextMap.set(fileName, url)
        } catch {}
    })
    imageMap.value = nextMap
}

const getEvidenceUrls = (files) => {
    if (!files || !Array.isArray(files)) return []
    return files.map((f) => imageMap.value.get(f)).filter(Boolean)
}

watch(
    selectedStudent,
    async (newVal, oldVal) => {
        if (newVal !== oldVal) {
            await loadImages()
        }
    },
    { deep: false },
)

const createDebounce = (task, delayMs) => {
    let timeoutId
    return (...args) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => task(...args), delayMs)
    }
}

const debouncedUpdate = createDebounce(async (newVal) => {
    if (newVal) {
        await updateStudent(newVal)
    }
}, 1000)

watch(
    selectedStudent,
    (newVal) => {
        if (newVal && !migrationLocked.value) {
            debouncedUpdate(newVal)
        }
    },
    { deep: true },
)

onUnmounted(() => {
    urlCache.clear()
    imageMap.value = new Map()
})
</script>

<style scoped></style>
