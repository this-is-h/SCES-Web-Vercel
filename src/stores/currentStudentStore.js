import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'studentSelection:currentStudentId'

const readStorage = () => {
    if (typeof window === 'undefined') return ''
    try {
        return String(window.sessionStorage.getItem(STORAGE_KEY) || '')
    } catch {
        return ''
    }
}

const writeStorage = (value) => {
    if (typeof window === 'undefined') return
    try {
        const v = String(value || '')
        if (!v) {
            window.sessionStorage.removeItem(STORAGE_KEY)
            return
        }
        window.sessionStorage.setItem(STORAGE_KEY, v)
    } catch {
        return
    }
}

export const useCurrentStudentStore = defineStore('currentStudent', () => {
    const currentStudentId = ref(readStorage())

    watch(
        currentStudentId,
        (value) => {
            writeStorage(value)
        },
        { flush: 'sync' },
    )

    return { currentStudentId }
})
