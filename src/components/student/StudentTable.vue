<script setup>
import { computed, ref, useSlots, watch } from 'vue'
import { saveAs } from 'file-saver'

const props = defineProps({
    title: { type: String, default: '学生列表' },
    countText: { type: String, default: '' },

    columns: { type: Array, required: true },
    rows: { type: Array, default: () => [] },

    isLoading: { type: Boolean, default: false },
    loadError: { type: String, default: '' },

    emptyText: { type: String, default: '暂无数据' },

    sticky: { type: [String, Boolean], default: 'header' },
    tableClass: { type: String, default: 'custom-table-v3 w-full' },

    tableMeta: {
        type: Object,
        default: () => ({
            class: {
                tr: (row) =>
                    `${row.index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-900/20' : ''} hover:bg-gray-100 dark:hover:bg-white/10`,
            },
        }),
    },
    tableUi: {
        type: Object,
        default: () => ({
            root: 'h-full',
            base: 'w-full text-sm',
            thead: 'bg-[var(--el-table-header-bg-color)] text-[var(--el-table-header-text-color)]',
            tbody: 'bg-[var(--el-table-bg-color)] text-[var(--el-table-text-color)]',
            th: 'whitespace-nowrap px-2 py-1 text-xs font-medium',
            td: 'whitespace-nowrap px-2 py-1',
        }),
    },

    cardClass: { type: String, default: 'w-full grow flex flex-col h-full overflow-hidden' },
    cardUi: {
        type: Object,
        default: () => ({
            body: 'grow p-0 sm:p-0 flex flex-col min-h-0 overflow-hidden',
            header: 'shrink-0 py-2 px-4 sm:py-2 sm:px-4',
        }),
    },

    sorting: { type: Array, default: undefined },
    defaultSorting: { type: Array, default: () => [] },
    columnPinning: { type: Object, default: undefined },
    defaultColumnPinning: {
        type: Object,
        default: () => ({ left: ['index', 'name'], right: ['total', 'actions'] }),
    },

    disableActions: { type: Boolean, default: false },
    showViewAction: { type: Boolean, default: true },
    showDeleteAction: { type: Boolean, default: true },
    rowActionPermission: { type: Function, default: null },
})

const emit = defineEmits([
    'update:sorting',
    'update:columnPinning',
    'view',
    'delete',
    'row-click',
    'export-success',
    'export-error',
])

const internalSorting = ref(props.defaultSorting)
const internalColumnPinning = ref(props.defaultColumnPinning)

const sortingModel = computed({
    get() {
        return props.sorting ?? internalSorting.value
    },
    set(v) {
        if (props.sorting === undefined) internalSorting.value = v
        emit('update:sorting', v)
    },
})

const columnPinningModel = computed({
    get() {
        return props.columnPinning ?? internalColumnPinning.value
    },
    set(v) {
        if (props.columnPinning === undefined) internalColumnPinning.value = v
        emit('update:columnPinning', v)
    },
})

const filterHiddenColumns = (cols) => {
    const list = Array.isArray(cols) ? cols : []
    const result = []
    for (const col of list) {
        if (!col || col.hidden) continue
        if (Array.isArray(col.columns)) {
            const children = filterHiddenColumns(col.columns)
            if (!children.length) continue
            result.push({ ...col, columns: children })
        } else {
            result.push(col)
        }
    }
    return result
}

const visibleColumns = computed(() => filterHiddenColumns(props.columns))
const hasRows = computed(() => (props.rows?.length ?? 0) > 0)

const defaultRowActionPermission = (row, actionKey) => {
    const fn = props.rowActionPermission
    if (typeof fn !== 'function') return true
    const permission = fn(row)
    if (permission && typeof permission === 'object') return Boolean(permission[actionKey])
    return Boolean(permission)
}

const isExporting = ref(false)
const scrollRef = ref(null)

const VIRTUAL_THRESHOLD = 400
const VIRTUAL_BATCH = 200
const virtualEnabled = computed(() => (props.rows?.length ?? 0) > VIRTUAL_THRESHOLD)
const renderCount = ref(virtualEnabled.value ? Math.min(VIRTUAL_BATCH, props.rows.length) : 0)

watch(
    () => props.rows,
    (next) => {
        if (!virtualEnabled.value) {
            renderCount.value = 0
            return
        }
        renderCount.value = Math.min(VIRTUAL_BATCH, next?.length ?? 0)
        if (scrollRef.value) scrollRef.value.scrollTop = 0
    },
    { deep: false },
)

const displayRows = computed(() => {
    const rows = Array.isArray(props.rows) ? props.rows : []
    if (!virtualEnabled.value) return rows
    return rows.slice(0, Math.max(0, renderCount.value))
})

let scrollTicking = false
const onScroll = () => {
    if (!virtualEnabled.value) return
    if (scrollTicking) return
    scrollTicking = true
    requestAnimationFrame(() => {
        scrollTicking = false
        const el = scrollRef.value
        if (!el) return
        const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
        if (remaining > 400) return
        const total = props.rows?.length ?? 0
        if (renderCount.value >= total) return
        renderCount.value = Math.min(total, renderCount.value + VIRTUAL_BATCH)
    })
}

const escapeCsv = (value) => {
    const s = String(value ?? '')
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
}

const exportCsv = async ({ rows, columns, fileName }) => {
    const cols = Array.isArray(columns) ? columns : []
    if (!cols.length) throw new Error('导出列为空')
    const headerLine = cols.map((col) => escapeCsv(col.header)).join(',')
    const lines = [headerLine]
    for (const row of rows) {
        const line = cols
            .map((col) => {
                const raw = typeof col.value === 'function' ? col.value(row) : row?.[col.key]
                return escapeCsv(raw)
            })
            .join(',')
        lines.push(line)
    }
    const text = '\uFEFF' + lines.join('\r\n')
    saveAs(new Blob([text], { type: 'text/csv;charset=utf-8' }), fileName)
}

const exportXlsx = async ({ rows, columns, fileName, sheetName }) => {
    const cols = Array.isArray(columns) ? columns : []
    if (!cols.length) throw new Error('导出列为空')
    const mod = await import('exceljs')
    const ExcelJS = mod?.default ?? mod
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(sheetName || 'Sheet1')

    worksheet.columns = cols.map((col) => ({
        header: col.header,
        key: col.key,
        width:
            typeof col.width === 'number'
                ? col.width
                : Math.min(28, Math.max(10, Math.ceil(String(col.header || '').length * 2.2))),
    }))

    worksheet.getRow(1).font = { bold: true }
    for (let i = 0; i < cols.length; i++) {
        const col = cols[i]
        if (col && col.numFmt) worksheet.getColumn(i + 1).numFmt = col.numFmt
    }

    for (const row of rows) {
        const rowObj = {}
        for (const col of cols) {
            rowObj[col.key] = typeof col.value === 'function' ? col.value(row) : row?.[col.key]
        }
        worksheet.addRow(rowObj)
    }

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(
        new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        fileName,
    )
}

const exportData = async (options = {}) => {
    if (isExporting.value) return
    const format = options.format || 'xlsx'
    const rows = Array.isArray(options.rows) ? options.rows : props.rows
    const columns = Array.isArray(options.columns) ? options.columns : []
    const fileName = String(
        options.fileName || `export_${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`,
    )
    const sheetName = options.sheetName || '学生列表'
    if (!rows.length) throw new Error('无可导出数据')

    isExporting.value = true
    try {
        if (format === 'csv') {
            await exportCsv({ rows, columns, fileName })
        } else {
            await exportXlsx({ rows, columns, fileName, sheetName })
        }
        emit('export-success', { format, fileName })
    } catch (e) {
        emit('export-error', e)
        throw e
    } finally {
        isExporting.value = false
    }
}

defineExpose({ exportData, isExporting })

const slots = useSlots()
const passthroughSlotNames = computed(() => {
    const names = Object.keys(slots || {})
    const reserved = new Set([
        'default',
        'header',
        'header-append',
        'row-actions',
        'empty',
        'loading',
        'error',
        'actions-cell',
        'total-header',
    ])
    return names.filter((n) => !reserved.has(n))
})
</script>

<template>
    <UCard :class="cardClass" :ui="cardUi">
        <template #header>
            <div class="flex items-center justify-between gap-4">
                <div class="font-medium text-highlighted">{{ title }}</div>
                <div class="flex items-center gap-3">
                    <div v-if="countText" class="text-xs text-default/50">{{ countText }}</div>
                    <slot name="header-append" />
                </div>
            </div>
        </template>

        <div class="h-full relative flex flex-col min-h-0">
            <div
                v-if="isLoading"
                class="absolute inset-0 flex items-center justify-center text-sm text-default/60 bg-white/50 z-50"
            >
                <slot name="loading">正在加载学生数据</slot>
            </div>
            <div
                v-else-if="loadError"
                class="absolute inset-0 flex items-center justify-center text-sm text-red-600 bg-white/50 z-50"
            >
                <slot name="error">{{ loadError }}</slot>
            </div>

            <div
                v-if="hasRows"
                ref="scrollRef"
                class="flex-1 min-h-0 overflow-auto"
                @scroll="onScroll"
            >
                <UTable
                    :columns="visibleColumns"
                    :data="displayRows"
                    :sticky="sticky"
                    v-model:sorting="sortingModel"
                    v-model:columnPinning="columnPinningModel"
                    :meta="tableMeta"
                    :class="tableClass"
                    :ui="tableUi"
                >
                    <template
                        v-for="name in passthroughSlotNames"
                        :key="name"
                        v-slot:[name]="slotProps"
                    >
                        <slot :name="name" v-bind="slotProps" />
                    </template>

                    <template v-if="$slots['total-header']" #total-header="slotProps">
                        <slot name="total-header" v-bind="slotProps" />
                    </template>
                    <template v-else #total-header="{ column }">
                        <button
                            type="button"
                            class="w-full flex items-center justify-center gap-1"
                            @click="column.getToggleSortingHandler()?.($event)"
                        >
                            <span>总分</span>
                            <UIcon
                                v-if="column.getIsSorted() === 'asc'"
                                name="i-lucide-chevron-up"
                                class="size-3 text-default/60"
                            />
                            <UIcon
                                v-else-if="column.getIsSorted() === 'desc'"
                                name="i-lucide-chevron-down"
                                class="size-3 text-default/60"
                            />
                            <UIcon
                                v-else
                                name="i-lucide-chevrons-up-down"
                                class="size-3 text-default/60"
                            />
                        </button>
                    </template>

                    <template #actions-cell="slotProps">
                        <slot name="row-actions" v-bind="slotProps">
                            <slot name="actions-cell" v-bind="slotProps">
                                <div class="flex items-center justify-center gap-2">
                                    <UButton
                                        v-if="showViewAction"
                                        size="xs"
                                        color="neutral"
                                        variant="soft"
                                        :disabled="
                                            disableActions ||
                                            !defaultRowActionPermission(
                                                slotProps?.row?.original,
                                                'view',
                                            )
                                        "
                                        @click="emit('view', slotProps?.row?.original)"
                                    >
                                        查看
                                    </UButton>
                                    <UButton
                                        v-if="showDeleteAction"
                                        size="xs"
                                        color="error"
                                        variant="ghost"
                                        icon="i-lucide-trash"
                                        :disabled="
                                            disableActions ||
                                            !defaultRowActionPermission(
                                                slotProps?.row?.original,
                                                'delete',
                                            )
                                        "
                                        @click="emit('delete', slotProps?.row?.original)"
                                    >
                                        删除
                                    </UButton>
                                </div>
                            </slot>
                        </slot>
                    </template>
                </UTable>
            </div>

            <div v-else class="h-full flex items-center justify-center text-sm text-default/60">
                <slot name="empty">{{ emptyText }}</slot>
            </div>
        </div>
    </UCard>
</template>

<style scoped></style>
