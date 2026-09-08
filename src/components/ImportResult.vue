<script setup>
import { computed } from 'vue'

const resultOpen = defineModel('resultOpen', { default: false })
const loadingOpen = defineModel('loadingOpen', { default: false })

const props = defineProps({
    resultTitle: { type: String, default: '导入结果' },
    loadingTitle: { type: String, default: '正在导入' },

    successLabel: { type: String, default: '成功' },
    failLabel: { type: String, default: '失败/跳过' },
    restoredLabel: { type: String, default: '本地恢复' },
    successIcon: { type: String, default: '' },
    failIcon: { type: String, default: '' },
    restoredIcon: { type: String, default: '' },

    successCount: { type: Number, default: 0 },
    failCount: { type: Number, default: 0 },
    restoredCount: { type: Number, default: 0 },
    showRestored: { type: Boolean, default: false },

    columns: { type: Array, default: () => [] },
    details: { type: Array, default: () => [] },

    progress: { type: Object, default: () => ({ done: 0, total: 0 }) },
    tooltipDelayDuration: { type: Number, default: 0 },
    tooltipContent: { type: Object, default: () => ({ side: 'top', sideOffset: 4 }) },

    resultModalUi: { type: Object, default: () => ({ footer: 'justify-end' }) },
    loadingModalUi: {
        type: Object,
        default: () => ({ body: 'flex flex-col items-center justify-center gap-3 py-6' }),
    },
    tableUi: {
        type: Object,
        default: () => ({
            th: 'whitespace-nowrap bg-gray-50 dark:bg-gray-800',
            td: 'whitespace-nowrap',
        }),
    },
    tableWrapperClass: { type: String, default: '' },

    nameCellClass: { type: String, default: 'truncate max-w-[100px]' },
    idCellClass: { type: String, default: 'truncate max-w-[120px]' },
    messageCellClass: { type: String, default: 'truncate max-w-[200px] text-default/60' },

    successCardClass: {
        type: String,
        default:
            'flex-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800',
    },
    successLabelClass: { type: String, default: 'text-xs text-green-600 dark:text-green-400' },
    successValueClass: {
        type: String,
        default: 'text-2xl font-bold text-green-700 dark:text-green-300',
    },

    failCardClass: {
        type: String,
        default:
            'flex-1 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800',
    },
    failLabelClass: { type: String, default: 'text-xs text-red-600 dark:text-red-400' },
    failValueClass: { type: String, default: 'text-2xl font-bold text-red-700 dark:text-red-300' },

    restoredCardClass: {
        type: String,
        default:
            'flex-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800',
    },
    restoredLabelClass: {
        type: String,
        default: 'text-xs text-yellow-700 dark:text-yellow-300',
    },
    restoredValueClass: {
        type: String,
        default: 'text-2xl font-bold text-yellow-800 dark:text-yellow-200',
    },

    closeLabel: { type: String, default: '关闭' },

    showReimport: { type: Boolean, default: false },
    reimportLabel: { type: String, default: '重新导入' },
    reimportButtonColor: { type: String, default: 'primary' },
    reimportButtonVariant: { type: String, default: 'solid' },
})

const emit = defineEmits(['reimport', 'closeResult'])

const tableWrapperClassComputed = computed(() => props.tableWrapperClass || '')
const columnsResolved = computed(() => {
    if (Array.isArray(props.columns) && props.columns.length) return props.columns
    return [
        { accessorKey: 'name', header: '姓名' },
        { accessorKey: 'id', header: '学号' },
        { accessorKey: 'status', header: '状态' },
        { accessorKey: 'message', header: '详情' },
    ]
})

const closeResult = () => {
    resultOpen.value = false
    emit('closeResult')
}

const showRestoredCard = computed(() => props.showRestored || props.restoredCount > 0)
</script>

<template>
    <UModal v-model:open="resultOpen" :title="resultTitle" :ui="resultModalUi">
        <template #body>
            <div class="space-y-4">
                <div class="flex gap-4">
                    <div :class="successCardClass">
                        <div :class="successLabelClass">
                            <template v-if="successIcon">
                                <UIcon :name="successIcon" class="size-4 mr-1 align-[-2px]" />
                            </template>
                            {{ successLabel }}
                        </div>
                        <div :class="successValueClass">{{ successCount }}</div>
                    </div>
                    <div :class="failCardClass">
                        <div :class="failLabelClass">
                            <template v-if="failIcon">
                                <UIcon :name="failIcon" class="size-4 mr-1 align-[-2px]" />
                            </template>
                            {{ failLabel }}
                        </div>
                        <div :class="failValueClass">{{ failCount }}</div>
                    </div>
                    <div v-if="showRestoredCard" :class="restoredCardClass">
                        <div :class="restoredLabelClass">
                            <template v-if="restoredIcon">
                                <UIcon :name="restoredIcon" class="size-4 mr-1 align-[-2px]" />
                            </template>
                            {{ restoredLabel }}
                        </div>
                        <div :class="restoredValueClass">{{ restoredCount }}</div>
                    </div>
                </div>

                <div :class="tableWrapperClassComputed">
                    <UTable :columns="columnsResolved" :data="details" :ui="tableUi">
                        <template #name-cell="{ row }">
                            <UTooltip
                                :delay-duration="tooltipDelayDuration"
                                :content="tooltipContent"
                                :text="row.original.name"
                            >
                                <span :class="nameCellClass">
                                    {{ row.original.name }}
                                </span>
                            </UTooltip>
                        </template>
                        <template #id-cell="{ row }">
                            <UTooltip
                                :delay-duration="tooltipDelayDuration"
                                :content="tooltipContent"
                                :text="row.original.id"
                            >
                                <span :class="idCellClass">
                                    {{ row.original.id }}
                                </span>
                            </UTooltip>
                        </template>
                        <template #status-cell="{ row }">
                            <UBadge
                                :color="
                                    row.original.status === 'success'
                                        ? 'success'
                                        : row.original.status === 'restored'
                                          ? 'warning'
                                          : row.original.status === 'error'
                                            ? 'error'
                                            : 'neutral'
                                "
                                variant="subtle"
                                size="xs"
                            >
                                <div
                                    class="truncate max-w-[260px]"
                                    :title="
                                        row.original.statusText ||
                                        (row.original.status === 'success'
                                            ? '成功'
                                            : row.original.status === 'restored'
                                              ? '本地恢复'
                                              : '失败')
                                    "
                                >
                                    {{
                                        row.original.statusText ||
                                        (row.original.status === 'success'
                                            ? '成功'
                                            : row.original.status === 'restored'
                                              ? '本地恢复'
                                              : '失败')
                                    }}
                                </div>
                            </UBadge>
                        </template>
                        <template #message-cell="{ row }">
                            <UTooltip
                                :delay-duration="tooltipDelayDuration"
                                :content="tooltipContent"
                                :text="row.original.message"
                            >
                                <span :class="messageCellClass">
                                    {{ row.original.message }}
                                </span>
                            </UTooltip>
                        </template>
                    </UTable>
                </div>
            </div>
        </template>
        <template #footer>
            <UButton
                v-if="showReimport"
                :label="reimportLabel"
                :color="reimportButtonColor"
                :variant="reimportButtonVariant"
                @click="emit('reimport')"
            />
            <UButton :label="closeLabel" color="neutral" @click="closeResult" />
        </template>
    </UModal>

    <UModal
        v-model:open="loadingOpen"
        :title="loadingTitle"
        :close="false"
        :dismissible="false"
        :ui="loadingModalUi"
    >
        <template #body>
            <UIcon name="i-lucide:loader-2" class="size-6 animate-spin text-primary" />
            <div class="text-sm text-default/70">
                正在导入 {{ progress.done }}/{{ progress.total }}
            </div>
        </template>
    </UModal>
</template>
