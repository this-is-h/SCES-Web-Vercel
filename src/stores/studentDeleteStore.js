import { computed, reactive } from 'vue'

const state = reactive({
    isDeleteModalOpen: false,
    target: null,
})

export const useStudentDeleteStore = () => {
    const deleteDescription = computed(() => {
        if (!state.target) return ''
        return `确定要删除学生 ${state.target.name} （${state.target.id}） 吗？\n注意：这仅会从列表中移除，下次导入时仍然采用旧信息。`
    })

    const openDeleteModal = (student) => {
        state.target = student
        state.isDeleteModalOpen = true
    }

    const closeDeleteModal = () => {
        state.isDeleteModalOpen = false
        state.target = null
    }

    return {
        state,
        deleteDescription,
        openDeleteModal,
        closeDeleteModal,
    }
}
