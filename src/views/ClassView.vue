<script setup>
import { computed, ref, onMounted, provide, watch } from 'vue'
import Cascader from '@/components/ClassCascader.vue'
import { fileSystemManager } from '@/utils/FileSystemManager'
import * as z from 'zod'
import {
    ensureLocalConfig,
    getLocalClassInfo,
    getServerConfig,
    getServerConfigFallback,
    getStudentConfig,
    writeLocalConfig,
} from '@/utils/config'
import { createAppToast } from '@/utils/toast'
import { verifyRsaKeyPair } from '@/utils/crypto'
import { mapFileSystemErrorToUserMessage } from '@/utils/error'

const debug = (...args) => {
    if (import.meta.env.DEV) console.debug('[ClassView]', ...args)
}

const toast = useToast()
const appToast = createAppToast(toast)

const isSupported = ref(true)
const isAuthorized = ref(true)
const directoryHandle = ref(null)
const directoryName = ref('')
const isChecking = ref(true)
const serverConfig = ref(getServerConfigFallback())
const semesters = ref([])
const semesterItems = ref([])
const semesterItem = ref('')
const isFolderInitialization = ref(false)
const classInfo = ref({
    grade: undefined,
    major: undefined,
    class: undefined,
})
const classInfoRefreshNonce = ref(0)
const isClassInfoSaving = ref(false)

const classCascaderOptions = ref([])
const classCascaderTitles = ref(['学院', '专业', '班级'])

const navMenuItems = ref([
    {
        label: '总览',
        icon: 'i-line-md:gauge',
        to: '/class/index',
    },
    {
        label: '学生管理',
        icon: 'i-line-md:account',
        to: '/class/student',
        defaultOpen: true,
        children: [
            {
                label: '总体情况',
                to: '/class/student/overview',
            },
            {
                label: '单个预览',
                to: '/class/student/preview',
            },
        ],
    },
    {
        label: '设置',
        icon: 'i-line-md:cog',
        to: '/class/settings',
    },
])
const active = ref()

provide('currentSemester', semesterItem)
provide('fsAuthorized', isAuthorized)
provide('fsChecking', isChecking)
provide('classInfo', classInfo)
provide('classInfoRefreshNonce', classInfoRefreshNonce)

const isGateOpen = ref(false)
watch(
    [isSupported, isAuthorized],
    ([supported, authorized]) => {
        isGateOpen.value = !supported || !authorized
    },
    { immediate: true },
)

const isKeyGateOpen = ref(false)
const isKeyGateBusy = ref(false)
const keyGateMessage = ref('')
const keyWasFromLocal = ref(false)
const keyFileInput = ref(null)
const keyFileName = ref('')
const canUploadKey = computed(() =>
    Boolean(
        serverConfig.value?.encryption?.enabled && serverConfig.value?.encryption?.rsaPublicKeyJwk,
    ),
)

const verifyAndStorePrivateKey = async ({ privateKeyJwk, fromLocal }) => {
    const cfg = serverConfig.value
    const publicKeyJwk = cfg?.encryption?.rsaPublicKeyJwk
    const algorithm = cfg?.encryption?.rsaAlgorithm
    if (!publicKeyJwk) return { ok: false, message: '服务器未配置公钥，无法验证密钥' }

    isKeyGateBusy.value = true
    try {
        const ok = await verifyRsaKeyPair({ publicKeyJwk, privateKeyJwk, algorithm })
        if (!ok) {
            return {
                ok: false,
                message: fromLocal ? '密钥已过期，请重新输入' : '密钥错误，请检查后重试',
            }
        }
        const localConfig = await ensureLocalConfig({ scope: 'class' })
        const next = {
            ...localConfig,
            encryption: {
                ...(localConfig.encryption ?? {}),
                privateKeyJwk,
            },
        }
        await writeLocalConfig(next, { scope: 'class' })
        return { ok: true }
    } catch (e) {
        return { ok: false, message: e?.message || '验证失败' }
    } finally {
        isKeyGateBusy.value = false
    }
}

const checkKeyGate = async () => {
    if (!isAuthorized.value || isChecking.value) return
    serverConfig.value = await getServerConfig({ force: true })
    if (!canUploadKey.value) {
        keyGateMessage.value = '服务器未配置密钥，无法使用。'
        keyWasFromLocal.value = false
        keyFileName.value = ''
        isKeyGateOpen.value = true
        return
    }

    const localConfig = await ensureLocalConfig({ scope: 'class' })
    const privateKeyJwk = localConfig?.encryption?.privateKeyJwk
    if (!privateKeyJwk) {
        keyGateMessage.value = '需要验证密钥。请上传“key”文件。'
        keyFileName.value = ''
        keyWasFromLocal.value = false
        isKeyGateOpen.value = true
        return
    }

    keyWasFromLocal.value = true
    const result = await verifyAndStorePrivateKey({ privateKeyJwk, fromLocal: true })
    if (result.ok) {
        isKeyGateOpen.value = false
        return
    }

    keyGateMessage.value = result.message
    keyFileName.value = ''
    isKeyGateOpen.value = true
}

const triggerKeyFileInput = () => {
    keyFileInput.value?.click()
}

const handleKeyFileChange = async (event) => {
    const file = event?.target?.files?.[0]
    event.target.value = ''
    if (!file) return
    keyFileName.value = file.name || 'key'
    try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        const jwk = parsed?.privateKeyJwk ?? parsed
        const result = await verifyAndStorePrivateKey({ privateKeyJwk: jwk, fromLocal: false })
        if (result.ok) {
            isKeyGateOpen.value = false
            appToast.success({ title: '验证通过', description: '已保存密钥，下次将自动验证' })
            return
        }
        keyGateMessage.value = result.message
        appToast.error({ title: '验证失败', description: result.message })
    } catch (e) {
        appToast.error({ title: '读取失败', description: e?.message || '无法读取 key 文件' })
    }
}

watch(
    semesterItem,
    (v) => {
        debug('semesterItem', v)
    },
    { immediate: true },
)

const restoreHandle = async () => {
    isSupported.value = fileSystemManager.isSupported()
    if (!isSupported.value) {
        isChecking.value = false
        return
    }

    const { handle, authorized } = await fileSystemManager.restoreHandle()
    if (handle) {
        directoryHandle.value = handle
        directoryName.value = handle.name
        isAuthorized.value = authorized
    } else {
        isAuthorized.value = false
    }
    isChecking.value = false
}

const authorizeFolder = async () => {
    try {
        const handle = await fileSystemManager.authorize(false)
        directoryHandle.value = handle
        directoryName.value = handle.name
        isAuthorized.value = true
        debug('authorizeFolder', directoryName.value)
        const semesterTree = ref(
            await fileSystemManager.readDirectoryStructure('class/semesters', 1),
        )
        semesters.value = semesterTree.value
            .filter((item) => item.kind === 'directory')
            .filter(
                (item) => item.name !== `${serverConfig.value.year}-${serverConfig.value.semester}`,
            )
            .map((item) => item.name)
        semesters.value.unshift(`${serverConfig.value.year}-${serverConfig.value.semester}`)
        semesterItem.value = semesters.value[0]
        semesterItems.value = [...semesters.value]

        // 检查config.json
        await checkConfigFile()
        await checkKeyGate()
    } catch (e) {
        if (e.name !== 'AbortError') {
            appToast.error({
                title: '授权失败',
                description: mapFileSystemErrorToUserMessage(e, {
                    action: '授权文件夹',
                    pathHints: ['class/semesters', 'class/config.json'],
                }),
            })
        }
    }
}

const changeFolder = async () => {
    try {
        const handle = await fileSystemManager.authorize(true)
        directoryHandle.value = handle
        directoryName.value = handle.name
        isAuthorized.value = true
        debug('changeFolder', directoryName.value)
        const semesterTree = ref(
            await fileSystemManager.readDirectoryStructure('class/semesters', 1),
        )
        semesters.value = semesterTree.value
            .filter((item) => item.kind === 'directory')
            .filter(
                (item) => item.name !== `${serverConfig.value.year}-${serverConfig.value.semester}`,
            )
            .map((item) => item.name)
        semesters.value.unshift(`${serverConfig.value.year}-${serverConfig.value.semester}`)
        semesterItem.value = semesters.value[0]
        semesterItems.value = [...semesters.value]

        // 检查config.json
        await checkConfigFile()
        await checkKeyGate()
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Change folder failed:', e)
        }
    }
}

const revokeAuthorization = async () => {
    await fileSystemManager.revoke()
    directoryHandle.value = null
    directoryName.value = ''
    isAuthorized.value = false
    debug('revokeAuthorization')
}

// 完善验证规则
const schema = z.object({
    grade: z.string('请输入年级').regex(/^\d{4}$/, '年级应为四位数年份，如2024'),
    classPath: z
        .array(z.string())
        .length(3, '请选择完整的班级信息')
        .refine((arr) => arr.every((x) => String(x || '').trim()), '请选择完整的班级信息'),
})

const state = ref({
    grade: undefined,
    classPath: [],
})

const findClassPathByMajorAndClass = ({ options, major, clazz }) => {
    const m = major == null ? '' : String(major)
    const c = clazz == null ? '' : String(clazz)
    if (!m || !c) return []
    const list = Array.isArray(options) ? options : []
    for (const college of list) {
        const majors = Array.isArray(college?.children) ? college.children : []
        for (const mj of majors) {
            if (String(mj?.text ?? '') !== m) continue
            const classes = Array.isArray(mj?.children) ? mj.children : []
            for (const cl of classes) {
                if (String(cl?.text ?? '') !== c) continue
                return [
                    String(college?.text ?? ''),
                    String(mj?.text ?? ''),
                    String(cl?.text ?? ''),
                ].filter(Boolean)
            }
        }
    }
    return []
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

// 检查并读取config.json
const checkConfigFile = async () => {
    if (!isAuthorized.value || !directoryHandle.value) return

    try {
        const localConfig = await ensureLocalConfig({ scope: 'class' })
        const info = getLocalClassInfo(localConfig)
        if (info) {
            classInfo.value = info
            isFolderInitialization.value = false
        } else {
            isFolderInitialization.value = true
        }
    } catch (e) {
        console.error('检查config.json失败:', e)
        // 出错时视为需要初始化
        isFolderInitialization.value = true
    }
}

// 处理用户确认班级信息
const handleConfirmClassInfo = async () => {
    try {
        isClassInfoSaving.value = true
        // 验证输入
        const validatedData = schema.parse(state.value)
        const [, major, clazz] = validatedData.classPath

        // 更新classInfo
        classInfo.value = {
            grade: validatedData.grade,
            major,
            class: clazz,
        }

        const localConfig = await ensureLocalConfig({ scope: 'class' })
        const next = {
            ...localConfig,
            class: {
                grade: validatedData.grade,
                major,
                name: clazz,
            },
        }
        await writeLocalConfig(next, { scope: 'class' })
        classInfoRefreshNonce.value += 1
        isFolderInitialization.value = false
        appToast.success({ title: '保存成功', description: '班级信息已保存' })
    } catch (e) {
        // 验证失败提示
        appToast.error({
            title: '验证失败',
            description: e.errors?.[0]?.message || '输入信息有误，请检查',
        })
    } finally {
        isClassInfoSaving.value = false
    }
}

// 跳转问题反馈页面
const toFeedback = () => {
    window.open('https://txc.qq.com/products/799027', '_blank')
}

onMounted(async () => {
    serverConfig.value = await getServerConfig()
    await loadClassCascaderConfig()
    await restoreHandle()
    if (isAuthorized.value) {
        try {
            const semesterTree = ref(
                await fileSystemManager.readDirectoryStructure('class/semesters', 1),
            )
            semesters.value = semesterTree.value
                .filter((item) => item.kind === 'directory')
                .filter(
                    (item) =>
                        item.name !== `${serverConfig.value.year}-${serverConfig.value.semester}`,
                )
                .map((item) => item.name)
            semesters.value.unshift(`${serverConfig.value.year}-${serverConfig.value.semester}`)
            semesterItem.value = semesters.value[0]
            semesterItems.value = [...semesters.value]

            // 检查config.json
            await checkConfigFile()
            await checkKeyGate()
        } catch (e) {
            console.warn('Failed to read directory structure:', e)
            // 出错时检查config.json
            await checkConfigFile()
            await checkKeyGate()
        }
    }
})

watch(
    [isFolderInitialization, classCascaderOptions],
    ([open]) => {
        if (!open) return
        const info = classInfo.value
        if (info?.grade) state.value.grade = info.grade
        const path = findClassPathByMajorAndClass({
            options: classCascaderOptions.value,
            major: info?.major,
            clazz: info?.class,
        })
        if (path.length === 3) state.value.classPath = path
    },
    { immediate: true },
)
</script>

<template>
    <UApp>
        <UModal
            v-model:open="isFolderInitialization"
            title="设置您的班级信息"
            description="您随后可以在设置中查看和修改班级信息。"
            :ui="{ footer: 'justify-end', body: 'flex items-center justify-center' }"
            :close="false"
            :dismissible="false"
        >
            <template #body>
                <UForm :schema="schema" :state="state" class="space-y-4">
                    <UFormField label="请输入您的年级" name="grade">
                        <UInput v-model="state.grade" />
                    </UFormField>

                    <UFormField label="请选择您的班级信息" name="classPath">
                        <Cascader
                            v-model="state.classPath"
                            :options="classCascaderOptions"
                            :titles="classCascaderTitles"
                            :disabled="isClassInfoSaving"
                        />
                    </UFormField>
                </UForm>
            </template>

            <template #footer>
                <UButton
                    label="确认"
                    color="neutral"
                    :loading="isClassInfoSaving"
                    :disabled="isClassInfoSaving"
                    @click="handleConfirmClassInfo"
                />
            </template>
        </UModal>
        <UHeader>
            <template #title>
                <div class="flex flex-col font-bold items-center text-xl text-highlighted">
                    <span class="text-xl">学生德育分管理系统</span>
                    <span class="text-sm text-default/50">（班级评议小组）</span>
                </div>
            </template>
            <UNavigationMenu v-model="active" :items="navMenuItems" />
            <template #body>
                <UNavigationMenu
                    v-model="active"
                    :items="navMenuItems"
                    orientation="vertical"
                    class="-mx-2.5"
                />
            </template>
            <template #right>
                <UButton color="info" variant="ghost" size="sm" @click="toFeedback">
                    问题反馈
                </UButton>
                <UPopover
                    v-if="isAuthorized"
                    mode="hover"
                    :ui="{
                        content: 'z-100',
                    }"
                >
                    <UButton color="neutral" variant="ghost" size="sm">
                        <template #leading>
                            <UIcon name="i-mingcute:folder-zip-line" class="size-4" />
                        </template>
                        <span class="max-w-[80px] truncate">{{ directoryName }}</span>
                    </UButton>
                    <template #content>
                        <div class="p-1 flex flex-col min-w-[160px]">
                            <UButton
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                icon="i-lucide-refresh-cw"
                                class="justify-start"
                                @click="changeFolder"
                            >
                                切换文件夹
                            </UButton>
                            <UButton
                                color="error"
                                variant="ghost"
                                size="sm"
                                icon="i-lucide-log-out"
                                class="justify-start"
                                @click="revokeAuthorization"
                            >
                                取消授权
                            </UButton>
                        </div>
                    </template>
                </UPopover>
                <USelectMenu
                    v-if="isAuthorized"
                    v-model="semesterItem"
                    :items="semesterItems"
                    :ui="{
                        trailingIcon:
                            'group-data-[state=open]:rotate-180 transition-transform duration-200',
                        content: 'z-100',
                    }"
                    icon="i-mingcute:time-line"
                />
            </template>
        </UHeader>

        <UMain class="overflow-x-hidden overflow-y-auto h-[calc(100vh-var(--ui-header-height))]">
            <RouterView />
        </UMain>

        <UModal
            v-model:open="isGateOpen"
            :close="false"
            :dismissible="false"
            :ui="{ body: 'p-0 text-center' }"
        >
            <template #body>
                <div v-if="isChecking" class="py-8">
                    <UIcon
                        name="i-lucide:loader-2"
                        class="size-10 animate-spin text-primary mx-auto mb-4"
                    />
                    <p class="text-default/60">正在检查文件系统权限...</p>
                </div>

                <div v-else-if="!isSupported" class="py-2">
                    <div
                        class="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4"
                    >
                        <UIcon name="i-lucide:alert-triangle" class="size-5" />
                    </div>
                    <h2 class="text-xl font-bold mb-2 text-highlighted">浏览器不支持</h2>
                    <p class="text-default/60 mb-6 text-sm">
                        您的浏览器不支持文件系统访问 API，无法使用此应用。请使用最新版本的
                        <strong>Chrome、Edge</strong> 或 <strong>Opera</strong> 浏览器。
                    </p>
                </div>

                <div v-else class="py-2">
                    <div
                        class="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4"
                    >
                        <UIcon name="i-lucide:folder-lock" class="size-5" />
                    </div>
                    <h2 class="text-xl font-bold mb-2 text-highlighted">需要文件夹授权</h2>
                    <p class="text-default/60 mb-6 text-sm">
                        为了保存和管理学生德育分数据，请选择一个本地文件夹作为工作目录。所有数据将存储在您选择的文件夹中。<br />
                        如果您是第一次使用，请在本地新建一个空文件夹并选择它。<br />
                        如果您使用过此应用，可以选择之前已授权的文件夹，我们将读取其中的数据。
                    </p>
                    <div class="flex flex-col gap-3">
                        <UButton
                            block
                            size="lg"
                            icon="i-lucide-folder-open"
                            @click="authorizeFolder"
                        >
                            {{ directoryHandle ? '重新授权 ' + directoryName : '选择文件夹' }}
                        </UButton>
                        <p v-if="directoryHandle" class="text-xs text-default/40">
                            之前的授权已过期，请点击按钮重新确认权限。
                        </p>
                    </div>
                </div>
            </template>
        </UModal>

        <UModal
            v-model:open="isKeyGateOpen"
            :close="false"
            :dismissible="false"
            :ui="{ body: 'p-0 text-center', footer: 'justify-end' }"
        >
            <template #body>
                <div class="py-6 px-4">
                    <div
                        class="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4"
                    >
                        <UIcon
                            :name="isKeyGateBusy ? 'i-lucide:loader-2' : 'i-lucide:key-round'"
                            :class="isKeyGateBusy ? 'size-5 animate-spin' : 'size-5'"
                        />
                    </div>
                    <h2 class="text-xl font-bold mb-2 text-highlighted">需要密钥验证</h2>
                    <p class="text-default/60 mb-4 text-sm">
                        {{ keyGateMessage || '请验证密钥后继续使用。' }}
                    </p>
                    <input
                        type="file"
                        ref="keyFileInput"
                        class="hidden"
                        accept=".json"
                        @change="handleKeyFileChange"
                    />
                    <div class="flex flex-col gap-2">
                        <UButton
                            color="neutral"
                            :loading="isKeyGateBusy"
                            :disabled="isKeyGateBusy || !canUploadKey"
                            @click="triggerKeyFileInput"
                        >
                            上传 key 文件
                        </UButton>
                        <div v-if="keyFileName" class="text-xs text-default/50">
                            已选择：{{ keyFileName }}
                        </div>
                    </div>
                    <p v-if="keyWasFromLocal" class="mt-2 text-xs text-default/40">
                        检测到本地已保存密钥，但验证失败；请上传新的 key 文件进行更新。
                    </p>
                </div>
            </template>
            <template #footer>
                <UButton
                    color="neutral"
                    variant="soft"
                    :disabled="isKeyGateBusy || !canUploadKey"
                    @click="triggerKeyFileInput"
                >
                    选择文件
                </UButton>
            </template>
        </UModal>
    </UApp>
</template>

<style scoped></style>
