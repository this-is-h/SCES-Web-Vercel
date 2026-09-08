import { defineStore } from 'pinia'

const STORAGE_KEY = 'studentSelection:selectedTreeItem'

const readStorage = () => {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

const writeStorage = (value) => {
    if (typeof window === 'undefined') return
    try {
        if (value == null) {
            window.localStorage.removeItem(STORAGE_KEY)
            return
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
        return
    }
}

export const useStudentSelectionStore = defineStore('studentSelection', {
    state: () => ({
        selectedTreeItem: readStorage(),
    }),
    actions: {
        setSelectedTreeItem(payload) {
            this.selectedTreeItem = payload ?? null
            writeStorage(this.selectedTreeItem)
        },
    },
})
