<script setup>
import { ref, inject, watch, computed } from 'vue'
import * as z from 'zod'
import { createAppToast } from '@/utils/toast'
import { createLogger } from '@/utils/logger'
import { fileSystemManager } from '@/utils/FileSystemManager'
import {
    ensureLocalConfig,
    getServerConfig,
    getServerConfigFallback,
    getStudentConfig,
    writeLocalConfig,
} from '@/utils/config'
import { appendOperationLog } from '@/utils/operationLog'
import { validateStudentBelongsToClass, getStudentIdentity } from '@/utils/studentStorage'
import { useStudentDataStore } from '@/stores/studentDataStore'
import { mapFileSystemErrorToUserMessage } from '@/utils/error'

const toast = useToast()
const appToast = createAppToast(toast)
const log = createLogger('ClassSettings')
const studentStore = useStudentDataStore()

// Inject authorization state from parent
const isAuthorized = inject('fsAuthorized')
const isChecking = inject('fsChecking')
const injectedClassInfo = inject('classInfo', null)
const classInfoRefreshNonce = inject('classInfoRefreshNonce', null)

// Schema definition (copied from ClassView.vue)
const schema = z.object({
    grade: z.string('请输入年级').regex(/^\d{4}$/, '年级应为四位数年份，如2024'),
    college: z.string('请选择学院').min(1, '请选择学院'),
    major: z.string('请选择专业').min(1, '请选择专业'),
    class: z.string('请选择班级').min(1, '请选择班级').regex(/.*班$/, '班级需以"班"结尾，如1班'),
})

const state = ref({
    grade: undefined,
    college: '',
    major: undefined,
    class: undefined,
})

const isLoading = ref(false)
const serverConfig = ref(getServerConfigFallback())

const classCascaderOptions = ref([])
const classCascaderTitles = ref(['学院', '专业', '班级'])

const findNodeByText = (list, text) => {
    const s = text == null ? '' : String(text)
    return Array.isArray(list) ? list.find((x) => String(x?.text ?? '') === s) : undefined
}

const collegeItems = computed(() =>
    Array.isArray(classCascaderOptions.value)
        ? classCascaderOptions.value.map((x) => String(x?.text ?? '')).filter(Boolean)
        : [],
)

const majorItems = computed(() => {
    const college = findNodeByText(classCascaderOptions.value, state.value.college)
    const list = college?.children
    return Array.isArray(list) ? list.map((x) => String(x?.text ?? '')).filter(Boolean) : []
})

const classItems = computed(() => {
    const college = findNodeByText(classCascaderOptions.value, state.value.college)
    const major = findNodeByText(college?.children, state.value.major)
    const list = major?.children
    return Array.isArray(list) ? list.map((x) => String(x?.text ?? '')).filter(Boolean) : []
})

const findCollegeByMajorAndClass = ({ options, major, clazz }) => {
    const m = major == null ? '' : String(major)
    const c = clazz == null ? '' : String(clazz)
    if (!m || !c) return ''
    const list = Array.isArray(options) ? options : []
    for (const college of list) {
        const majors = Array.isArray(college?.children) ? college.children : []
        for (const mj of majors) {
            if (String(mj?.text ?? '') !== m) continue
            const classes = Array.isArray(mj?.children) ? mj.children : []
            for (const cl of classes) {
                if (String(cl?.text ?? '') !== c) continue
                return String(college?.text ?? '')
            }
        }
    }
    return ''
}

const loadClassCascaderConfig = async () => {
    try {
        const cfg = await getStudentConfig()
        const field = cfg?.data?.personal?.班级信息
        const options = field?.cascader?.options
        const titles = field?.cascader?.titles
        classCascaderOptions.value = Array.isArray(options) ? options : []
        classCascaderTitles.value = Array.isArray(titles) ? titles : ['学院', '专业', '班级']
    } catch {
        classCascaderOptions.value = []
        classCascaderTitles.value = ['学院', '专业', '班级']
    }
}

const isHydrating = ref(false)

const settingSections = [
    { key: 'basic', label: '基本设置', icon: 'i-lucide-settings' },
    { key: 'class', label: '班级设置', icon: 'i-lucide-school' },
]
const activeSection = ref('basic')

// Load config
const loadConfig = async () => {
    try {
        const localConfig = await ensureLocalConfig({ scope: 'class' })
        const cls = localConfig?.class
        if (cls?.grade && cls?.major && cls?.name) {
            isHydrating.value = true
            state.value = {
                grade: String(cls.grade),
                college: findCollegeByMajorAndClass({
                    options: classCascaderOptions.value,
                    major: cls.major,
                    clazz: cls.name,
                }),
                major: String(cls.major),
                class: String(cls.name),
            }
            isHydrating.value = false
        }
    } catch (e) {
        log.error('读取 config.json 失败', e)
        appToast.error({ title: '读取失败', description: '无法读取配置文件，请稍后重试' })
    }
}

// Save config
const handleSave = async () => {
    try {
        isLoading.value = true
        // Validate
        const validatedData = schema.parse(state.value)

        const semester = `${serverConfig.value.year}-${serverConfig.value.semester}`
        const nextClassInfo = {
            grade: String(validatedData.grade),
            major: String(validatedData.major),
            class: String(validatedData.class),
        }

        await studentStore.loadStudents({ scope: 'class', semester, silent: true })
        const loadError = studentStore.loadErrorFor({ scope: 'class', semester })
        if (loadError) throw new Error(loadError)
        const currentStudents = studentStore.studentsFor({ scope: 'class', semester })

        const toRemoveIds = []
        for (const student of currentStudents) {
            const { id } = getStudentIdentity(student) || {}
            if (!id) continue
            const check = validateStudentBelongsToClass({ student, classInfo: nextClassInfo })
            if (!check?.ok) toRemoveIds.push(String(id))
        }

        const currentConfig = await ensureLocalConfig({ scope: 'class' })
        const newConfig = {
            ...currentConfig,
            class: {
                grade: nextClassInfo.grade,
                major: nextClassInfo.major,
                name: nextClassInfo.class,
            },
        }

        const deletedPath = `class/semesters/${semester}/students/_deleted_students.json`
        const deletedBefore = (await fileSystemManager.readFile(deletedPath)) || ''

        let wroteConfig = false
        let wroteDeleted = false
        let logSnapshot = null
        try {
            await writeLocalConfig(newConfig, { scope: 'class' })
            wroteConfig = true

            const removal =
                toRemoveIds.length > 0
                    ? await studentStore.removeStudentsBatch({
                          scope: 'class',
                          semester,
                          ids: toRemoveIds,
                      })
                    : { removedIds: [] }
            wroteDeleted = toRemoveIds.length > 0

            logSnapshot = await appendOperationLog({
                scope: 'class',
                entry: {
                    type: 'class_settings_save',
                    semester,
                    before: currentConfig?.class ?? null,
                    after: newConfig?.class ?? null,
                    removedCount: removal.removedIds?.length || 0,
                    removedStudentIds: removal.removedIds || [],
                },
            })

            await studentStore.loadStudents({ scope: 'class', semester, silent: true })
            appToast.success({
                title: '保存成功',
                description:
                    removal.removedIds?.length > 0
                        ? `班级信息已更新，已移除 ${removal.removedIds.length} 名非本班学生`
                        : '班级信息已更新',
            })
            if (injectedClassInfo?.value) {
                injectedClassInfo.value = { ...nextClassInfo }
            }
            if (classInfoRefreshNonce?.value != null) {
                classInfoRefreshNonce.value += 1
            }
        } catch (e) {
            try {
                if (logSnapshot?.path) {
                    await fileSystemManager.writeFile(
                        logSnapshot.path,
                        logSnapshot.previousText || '',
                    )
                }
            } catch (re) {
                log.error('回滚操作日志失败', re)
            }
            try {
                if (wroteDeleted) {
                    await fileSystemManager.writeFile(deletedPath, deletedBefore)
                }
            } catch (re) {
                log.error('回滚删除标记失败', re)
            }
            try {
                if (wroteConfig) {
                    await writeLocalConfig(currentConfig, { scope: 'class' })
                }
            } catch (re) {
                log.error('回滚 config.json 失败', re)
            }
            try {
                await studentStore.loadStudents({ scope: 'class', semester, silent: true })
            } catch {}
            throw e
        }
    } catch (e) {
        if (e instanceof z.ZodError) {
            appToast.error({
                title: '验证失败',
                description: e.errors?.[0]?.message || '输入信息有误',
            })
        } else {
            log.error('保存 config.json 失败', e)
            appToast.error({
                title: '保存失败',
                description: mapFileSystemErrorToUserMessage(e, {
                    action: '保存班级设置',
                    pathHints: [
                        'class/config.json',
                        `class/semesters/${serverConfig.value.year}-${serverConfig.value.semester}/students`,
                        'class/logs/operations.jsonl',
                    ],
                }),
            })
        }
    } finally {
        isLoading.value = false
    }
}

// Watch for authorization to load config
watch(
    [isChecking, isAuthorized],
    async ([checking, authorized]) => {
        if (!checking && authorized) {
            serverConfig.value = await getServerConfig()
            await loadClassCascaderConfig()
            await loadConfig()
        }
    },
    { immediate: true },
)

watch(
    () => state.value.college,
    () => {
        if (isHydrating.value) return
        state.value.major = ''
        state.value.class = ''
    },
    { flush: 'sync' },
)

watch(
    () => state.value.major,
    () => {
        if (isHydrating.value) return
        state.value.class = ''
    },
    { flush: 'sync' },
)
</script>

<template>
    <div class="p-4 h-full">
        <div class="h-full flex gap-4 items-start">
            <div class="w-56 shrink-0 rounded-lg border border-default bg-default p-2">
                <div class="px-2 py-2 text-sm font-semibold text-highlighted">设置</div>
                <div class="flex flex-col gap-1">
                    <UButton
                        v-for="item in settingSections"
                        :key="item.key"
                        :icon="item.icon"
                        :label="item.label"
                        color="neutral"
                        block
                        :variant="activeSection === item.key ? 'soft' : 'ghost'"
                        @click="activeSection = item.key"
                    />
                </div>
                <div class="mt-3 px-2 text-xs text-default/40">
                    版本 v{{ serverConfig.version }}
                </div>
            </div>

            <div class="flex-1 min-w-0">
                <div
                    v-if="activeSection === 'class'"
                    class="rounded-lg border border-default bg-default p-4"
                >
                    <div class="mb-4">
                        <h2 class="text-lg font-bold text-highlighted">班级信息设置</h2>
                        <p class="text-default/60 text-sm mt-1">
                            修改班级的基本信息，如年级、专业和班级名称。
                        </p>
                    </div>

                    <UForm :schema="schema" :state="state" @submit="handleSave" class="space-y-4">
                        <UFormField label="年级" name="grade" help="请输入四位数年份，如2022">
                            <UInput v-model="state.grade" placeholder="2022" />
                        </UFormField>

                        <UFormField label="学院" name="major" help="选择学院">
                            <USelectMenu
                                v-model="state.college"
                                :items="collegeItems"
                                :placeholder="String(classCascaderTitles?.[0] ?? '学院')"
                                :disabled="isLoading"
                                :ui="{
                                    trailingIcon:
                                        'group-data-[state=open]:rotate-180 transition-transform duration-200',
                                    content: 'z-100',
                                }"
                            />
                        </UFormField>

                        <UFormField label="专业" name="major" help="选择专业">
                            <USelectMenu
                                v-model="state.major"
                                :items="majorItems"
                                :placeholder="String(classCascaderTitles?.[1] ?? '专业')"
                                :disabled="isLoading || !state.college"
                                :ui="{
                                    trailingIcon:
                                        'group-data-[state=open]:rotate-180 transition-transform duration-200',
                                    content: 'z-100',
                                }"
                            />
                        </UFormField>

                        <UFormField label="班级" name="class" help="选择班级">
                            <USelectMenu
                                v-model="state.class"
                                :items="classItems"
                                :placeholder="String(classCascaderTitles?.[2] ?? '班级')"
                                :disabled="isLoading || !state.college || !state.major"
                                :ui="{
                                    trailingIcon:
                                        'group-data-[state=open]:rotate-180 transition-transform duration-200',
                                    content: 'z-100',
                                }"
                            />
                        </UFormField>

                        <div class="flex justify-end pt-4">
                            <UButton
                                type="submit"
                                label="保存修改"
                                :loading="isLoading"
                                color="neutral"
                            />
                        </div>
                    </UForm>
                </div>

                <div v-else class="rounded-lg border border-default bg-default p-4">
                    <div class="mb-4">
                        <h2 class="text-lg font-bold text-highlighted">基本设置</h2>
                        <p class="text-default/60 text-sm mt-1">个性化应用的展示与偏好。</p>
                    </div>

                    <div class="space-y-6">
                        <div class="flex items-center justify-between gap-4">
                            <div>
                                <div class="font-medium">主题</div>
                                <div class="text-sm text-default/60">
                                    选择浅色、深色或跟随系统。
                                </div>
                            </div>
                            <UColorModeSelect class="w-44" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
