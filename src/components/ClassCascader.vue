<script setup>
import { computed } from 'vue'

const modelValue = defineModel({ default: () => [] })
const props = defineProps({
    options: { type: Array, default: () => [] },
    titles: { type: Array, default: () => ['学院', '专业', '班级'] },
    disabled: { type: Boolean, default: false },
})

const normalized = computed(() => (Array.isArray(modelValue.value) ? modelValue.value : []))

const findNodeByText = (list, text) => {
    const s = text == null ? '' : String(text)
    return Array.isArray(list) ? list.find((x) => String(x?.text ?? '') === s) : undefined
}

const collegeItems = computed(() =>
    Array.isArray(props.options) ? props.options.map((x) => String(x?.text ?? '')).filter(Boolean) : [],
)

const majorItems = computed(() => {
    const college = findNodeByText(props.options, normalized.value[0])
    const list = college?.children
    return Array.isArray(list) ? list.map((x) => String(x?.text ?? '')).filter(Boolean) : []
})

const classItems = computed(() => {
    const college = findNodeByText(props.options, normalized.value[0])
    const major = findNodeByText(college?.children, normalized.value[1])
    const list = major?.children
    return Array.isArray(list) ? list.map((x) => String(x?.text ?? '')).filter(Boolean) : []
})

const setAt = (index, value) => {
    const v = value == null ? '' : String(value)
    const next = normalized.value.slice()
    next[index] = v
    if (index <= 0) {
        next[1] = ''
        next[2] = ''
    } else if (index === 1) {
        next[2] = ''
    }
    modelValue.value = next.filter((x, i) => i <= 2).map((x) => (x == null ? '' : String(x)))
}

const college = computed({
    get: () => normalized.value[0] || '',
    set: (v) => setAt(0, v),
})

const major = computed({
    get: () => normalized.value[1] || '',
    set: (v) => setAt(1, v),
})

const clazz = computed({
    get: () => normalized.value[2] || '',
    set: (v) => setAt(2, v),
})
</script>

<template>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <USelectMenu
            v-model="college"
            :items="collegeItems"
            :placeholder="String(titles?.[0] ?? '学院')"
            :disabled="disabled"
            :ui="{
                base: 'min-w-[8em]',
                trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
                content: 'z-100',
            }"
        />
        <USelectMenu
            v-model="major"
            :items="majorItems"
            :placeholder="String(titles?.[1] ?? '专业')"
            :disabled="disabled || !college"
            clear
            :ui="{
                trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
                content: 'z-100',
            }"
        />
        <USelectMenu
            v-model="clazz"
            :items="classItems"
            :placeholder="String(titles?.[2] ?? '班级')"
            :disabled="disabled || !college || !major"
            clear
            :ui="{
                trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
                content: 'z-100',
            }"
        />
    </div>
</template>
