<script setup>
import { computed } from 'vue'
const props = defineProps({
    scoreMax: {
        type: Number,
        default: null,
    },
    requestedScore: {
        type: Number,
        default: null,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
})
const title = defineModel('title')
const content = defineModel('content')
const score = defineModel('score')
const type = defineModel('type')
const evidence = defineModel('evidence')
const evidenceLength = computed(() => (Array.isArray(evidence.value) ? evidence.value.length : 0))
const normalizedScoreMax = computed(() => {
    if (props.scoreMax === null || props.scoreMax === undefined) return null
    const value = Number(props.scoreMax)
    return Number.isFinite(value) ? value : null
})
const hasScoreMax = computed(() => normalizedScoreMax.value !== null)
const normalizedRequestedScore = computed(() => {
    if (props.requestedScore === null || props.requestedScore === undefined) return null
    const value = Number(props.requestedScore)
    return Number.isFinite(value) ? value : null
})
const hasRequestedScore = computed(() => normalizedRequestedScore.value !== null)

// 计算需要显示的证据图片，最多显示3张
const displayEvidence = computed(() => {
    if (!evidenceLength.value) {
        return []
    }
    // 如果数组长度大于3，只返回前3张
    return evidenceLength.value > 3 ? evidence.value.slice(0, 3) : evidence.value
})

const radioLabels = computed(() => {
    const opts = type.value?.options
    if (!opts || typeof opts !== 'object') return []
    const labels = []
    for (const label of Object.keys(opts)) {
        const val = Number(opts[label])
        if (!hasScoreMax.value || (Number.isFinite(val) && val <= normalizedScoreMax.value)) {
            labels.push(label)
        }
    }
    return labels
})

const selectedRadio = computed({
    get() {
        const opts = type.value?.options
        if (!opts || typeof opts !== 'object') return ''
        const current = Number(score.value ?? 0)
        for (const label of Object.keys(opts)) {
            if (Number(opts[label]) === current) return label
        }
        const zeroLabel = Object.keys(opts).find((k) => Number(opts[k]) === 0)
        return zeroLabel || Object.keys(opts)[0] || ''
    },
    set(label) {
        if (props.disabled) return
        const opts = type.value?.options
        if (!opts || typeof opts !== 'object') return
        if (!label) return
        const next = Number(opts[label])
        if (!Number.isFinite(next)) return
        if (hasScoreMax.value && next > normalizedScoreMax.value) return
        score.value = next
    },
})

const radioScoreText = computed(() => {
    const opts = type.value?.options
    if (!opts || typeof opts !== 'object') return ''
    const label = selectedRadio.value
    if (!label) return ''
    const val = opts[label]
    if (val == null) return ''
    return String(val)
})

const inputMax = computed(() => {
    const rawTypeMax = Number(type.value?.max)
    const hasTypeMax = Number.isFinite(rawTypeMax)
    if (hasTypeMax && hasScoreMax.value) return Math.min(rawTypeMax, normalizedScoreMax.value)
    if (hasTypeMax) return rawTypeMax
    if (hasScoreMax.value) return normalizedScoreMax.value
    return undefined
})
</script>

<template>
    <div class="w-full flex flex-col px-4 py-2 bg-white dark:bg-white/5 rounded-md overflow-hidden">
        <div class="text-sm font-bold mb-1 text-highlighted">{{ title }}</div>
        <div class="text-xs text-default/60">{{ content }}</div>
        <div v-if="evidenceLength > 0" class="flex items-center mt-1">
            <div class="text-xs font-bold text-default/60 mr-2">证明<br />材料</div>
            <div class="flex space-x-2 grow justify-center items-center">
                <el-image
                    v-for="(img, index) in displayEvidence"
                    :key="index"
                    class="w-15 h-15"
                    :src="img"
                    lazy
                    :zoom-rate="1.2"
                    :max-scale="7"
                    :min-scale="0.2"
                    :preview-src-list="evidence"
                    show-progress
                    :initial-index="index"
                    fit="cover"
                />
                <div v-if="evidenceLength > 3" class="text-xs font-bold text-default/60 ml-2">
                    …
                </div>
            </div>
            <div class="text-xs text-default/60 ml-2">共 {{ evidenceLength }} 张</div>
        </div>
        <div class="flex items-center justify-center mt-2">
            <template v-if="type.type == 'stepper'">
                <UInputNumber
                    v-model="score"
                    :disabled="disabled"
                    :min="type.min"
                    :max="inputMax"
                    :step="type.step"
                    size="sm"
                />
                <div class="text-sm text-default/70 ml-2">分</div>
                <div v-if="hasRequestedScore" class="text-xs text-default/60 ml-2">
                    学生申请 {{ normalizedRequestedScore }} 分
                </div>
            </template>
            <template v-else-if="type.type == 'radio'">
                <USelectMenu
                    v-model="selectedRadio"
                    :items="radioLabels"
                    :disabled="disabled"
                    size="sm"
                />
                <div class="text-sm text-default/70 ml-2">{{ radioScoreText }} 分</div>
                <div v-if="hasRequestedScore" class="text-xs text-default/60 ml-2">
                    学生申请 {{ normalizedRequestedScore }} 分
                </div>
            </template>
            <template v-else>
                <UInputNumber v-model="score" :disabled="disabled" size="sm" />
                <div class="text-sm text-default/70 ml-2">分</div>
                <div v-if="hasRequestedScore" class="text-xs text-default/60 ml-2">
                    学生申请 {{ normalizedRequestedScore }} 分
                </div>
            </template>
        </div>
    </div>
</template>
