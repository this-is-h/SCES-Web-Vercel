<script setup>
import { computed, ref, watch } from 'vue'

const modelValue = defineModel({ default: () => [] })
const props = defineProps({
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    parse: { type: Function, default: (v) => String(v).trim() },
    format: { type: Function, default: (v) => String(v) },
})

const input = ref('')

const normalized = computed(() => (Array.isArray(modelValue.value) ? modelValue.value : []))

const addOne = (raw) => {
    if (props.disabled) return
    const v = props.parse(raw)
    if (v == null) return
    const s = String(v).trim()
    if (!s) return
    if (normalized.value.some((x) => String(x) === s)) return
    modelValue.value = [...normalized.value, v]
}

const addFromText = (text) => {
    const parts = String(text || '')
        .split(/,|\n|\r|\t|;/g)
        .map((s) => s.trim())
        .filter(Boolean)
    for (const p of parts) addOne(p)
}

const removeAt = (idx) => {
    if (props.disabled) return
    const next = normalized.value.slice()
    next.splice(idx, 1)
    modelValue.value = next
}

const onKeydown = (e) => {
    if (props.disabled) return
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
        e.preventDefault()
        addFromText(input.value)
        input.value = ''
    }
    if (e.key === 'Backspace' && !input.value && normalized.value.length) {
        removeAt(normalized.value.length - 1)
    }
}

const onBlur = () => {
    if (props.disabled) return
    addFromText(input.value)
    input.value = ''
}

watch(
    () => modelValue.value,
    (v) => {
        if (!Array.isArray(v)) modelValue.value = []
    },
    { immediate: true },
)
</script>

<template>
    <div class="w-full flex flex-wrap items-center gap-2 rounded-md border border-default bg-default px-2 py-2">
        <UBadge
            v-for="(tag, idx) in normalized"
            :key="String(tag) + ':' + idx"
            color="neutral"
            variant="subtle"
            class="gap-1"
        >
            <span class="max-w-[220px] truncate">{{ format(tag) }}</span>
            <UButton
                v-if="!disabled"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                class="p-0"
                @click="removeAt(idx)"
            />
        </UBadge>
        <input
            v-model="input"
            class="min-w-[120px] flex-1 bg-transparent outline-none text-sm"
            :placeholder="placeholder"
            :disabled="disabled"
            @keydown="onKeydown"
            @blur="onBlur"
        />
    </div>
</template>

<style scoped></style>

