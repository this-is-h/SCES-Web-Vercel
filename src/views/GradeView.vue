<script setup>
import { computed, onMounted, provide, ref, watch } from 'vue'
import { fileSystemManager } from '@/utils/FileSystemManager'
import {
    ensureLocalConfig,
    getServerConfig,
    getServerConfigFallback,
    writeLocalConfig,
} from '@/utils/config'
import { createAppToast } from '@/utils/toast'
import { verifyRsaKeyPair } from '@/utils/crypto'
import { generateRsaOaepKeyPair } from '@/utils/crypto'
import { saveAs } from 'file-saver'
import { mapFileSystemErrorToUserMessage } from '@/utils/error'

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

const navMenuItems = ref([
    {
        label: '总览',
        icon: 'i-line-md:gauge',
        to: '/grade/index',
    },
    {
        label: '学生管理',
        icon: 'i-line-md:account',
        to: '/grade/student',
        defaultOpen: true,
        children: [
            { label: '总体情况', to: '/grade/student/overview' },
            { label: '单个预览', to: '/grade/student/preview' },
        ],
    },
    {
        label: '设置',
        icon: 'i-line-md:cog',
        to: '/grade/settings',
    },
])
const active = ref()

provide('currentSemester', semesterItem)
provide('fsAuthorized', isAuthorized)
provide('fsChecking', isChecking)

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
const isBootstrapExporting = ref(false)
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
        const localConfig = await ensureLocalConfig({ scope: 'grade' })
        const next = {
            ...localConfig,
            encryption: {
                ...(localConfig.encryption ?? {}),
                privateKeyJwk,
            },
        }
        await writeLocalConfig(next, { scope: 'grade' })
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
        keyGateMessage.value =
            '服务器未配置密钥，无法使用。请点击“更新密钥并导出”，上传生成的 config.json 到服务器后再验证。'
        keyWasFromLocal.value = false
        keyFileName.value = ''
        isKeyGateOpen.value = true
        return
    }

    const localConfig = await ensureLocalConfig({ scope: 'grade' })
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
        appToast.error({
            title: '读取失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '读取 key 文件',
            }),
        })
    }
}

const buildExportConfigPayload = ({ rsaPublicKeyJwk }) => {
    const cfg = serverConfig.value || {}
    const year = Number(cfg.year)
    const semester = Number(cfg.semester)
    const studentRequiredCategories = Array.isArray(cfg.studentRequiredCategories)
        ? cfg.studentRequiredCategories
        : []
    const studentRequiredExtraItemNumbers = Array.isArray(cfg.studentRequiredExtraItemNumbers)
        ? cfg.studentRequiredExtraItemNumbers
        : []
    const adminRequiredCategories = Array.isArray(cfg.adminRequiredCategories)
        ? cfg.adminRequiredCategories
        : []
    const adminRequiredExtraItemNumbers = Array.isArray(cfg.adminRequiredExtraItemNumbers)
        ? cfg.adminRequiredExtraItemNumbers
        : []
    const totalScorePenaltyCategoryCodes = Array.isArray(cfg.totalScorePenaltyCategoryCodes)
        ? cfg.totalScorePenaltyCategoryCodes
        : []
    const totalScoreNegativeItemNumbers = Array.isArray(cfg.totalScoreNegativeItemNumbers)
        ? cfg.totalScoreNegativeItemNumbers
        : []
    return {
        version: cfg.version,
        year: Number.isFinite(year) ? year : cfg.year,
        semester: Number.isFinite(semester) ? semester : cfg.semester,
        studentRequiredCategories,
        studentRequiredExtraItemNumbers,
        adminRequiredCategories,
        adminRequiredExtraItemNumbers,
        totalScorePenaltyCategoryCodes,
        totalScoreNegativeItemNumbers,
        encryption: {
            enabled: true,
            rsaPublicKeyJwk,
            rsaAlgorithm: cfg.encryption?.rsaAlgorithm ?? { name: 'RSA-OAEP', hash: 'SHA-256' },
            aesAlgorithm: cfg.encryption?.aesAlgorithm ?? { name: 'AES-GCM', length: 256 },
        },
    }
}

const handleBootstrapKeyExport = async () => {
    if (isBootstrapExporting.value || isKeyGateBusy.value) return
    isBootstrapExporting.value = true
    try {
        const { publicKeyJwk, privateKeyJwk } = await generateRsaOaepKeyPair()
        const localConfig = await ensureLocalConfig({ scope: 'grade' })
        const nextLocal = {
            ...localConfig,
            encryption: {
                ...(localConfig.encryption ?? {}),
                privateKeyJwk,
            },
        }
        await writeLocalConfig(nextLocal, { scope: 'grade' })

        const payload = buildExportConfigPayload({ rsaPublicKeyJwk: publicKeyJwk })
        saveAs(
            new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
            'config.json',
        )
        saveAs(
            new Blob([JSON.stringify(privateKeyJwk, null, 2)], { type: 'application/json' }),
            'key',
        )
        appToast.success({
            title: '已导出',
            description: '请上传 config.json 到服务器，然后再回来验证 key 文件',
        })
    } catch (e) {
        appToast.error({
            title: '导出失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '生成并导出密钥',
                pathHints: ['grade/config.json'],
            }),
        })
    } finally {
        isBootstrapExporting.value = false
    }
}

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

const loadSemesters = async () => {
    const semesterTree = ref(await fileSystemManager.readDirectoryStructure('grade/semesters', 1))
    semesters.value = semesterTree.value
        .filter((item) => item.kind === 'directory')
        .filter((item) => item.name !== `${serverConfig.value.year}-${serverConfig.value.semester}`)
        .map((item) => item.name)
    semesters.value.unshift(`${serverConfig.value.year}-${serverConfig.value.semester}`)
    semesterItem.value = semesters.value[0]
    semesterItems.value = [...semesters.value]
}

const getGradePathHints = () => ['grade/semesters', 'grade/config.json']

const authorizeFolder = async () => {
    try {
        const handle = await fileSystemManager.authorize(false)
        directoryHandle.value = handle
        directoryName.value = handle.name
        isAuthorized.value = true
        await loadSemesters()
        await checkKeyGate()
    } catch (e) {
        if (e.name !== 'AbortError') {
            appToast.error({
                title: '授权失败',
                description: mapFileSystemErrorToUserMessage(e, {
                    action: '授权文件夹',
                    pathHints: getGradePathHints(),
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
        await loadSemesters()
        await checkKeyGate()
    } catch (e) {
        if (e.name !== 'AbortError') {
            appToast.error({
                title: '切换失败',
                description: mapFileSystemErrorToUserMessage(e, {
                    action: '切换文件夹',
                    pathHints: getGradePathHints(),
                }),
            })
        }
    }
}

const revokeAuthorization = async () => {
    await fileSystemManager.revoke()
    directoryHandle.value = null
    directoryName.value = ''
    isAuthorized.value = false
}

// 跳转问题反馈页面
const toFeedback = () => {
    window.open('https://txc.qq.com/products/799027', '_blank')
}

onMounted(async () => {
    serverConfig.value = await getServerConfig()
    await restoreHandle()
    if (isAuthorized.value) {
        try {
            await loadSemesters()
            await checkKeyGate()
        } catch {
            await loadSemesters()
            await checkKeyGate()
        }
    }
})
</script>

<template>
    <UApp>
        <UHeader>
            <template #title>
                <div class="flex flex-col font-bold items-center text-xl text-highlighted">
                    <span class="text-xl">学生德育分管理系统</span>
                    <span class="text-sm text-default/50">（年级端）</span>
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
                        为了导入和管理年级数据，请选择一个本地文件夹作为工作目录。所有数据将存储在您选择的文件夹中。
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
                    <div v-if="canUploadKey" class="flex flex-col gap-2">
                        <UButton
                            color="neutral"
                            :loading="isKeyGateBusy"
                            :disabled="isKeyGateBusy"
                            accept=".json"
                            @click="triggerKeyFileInput"
                        >
                            上传 key 文件
                        </UButton>
                        <div v-if="keyFileName" class="text-xs text-default/50">
                            已选择：{{ keyFileName }}
                        </div>
                    </div>
                    <div v-else class="flex flex-col gap-2">
                        <UButton
                            color="neutral"
                            variant="soft"
                            :loading="isBootstrapExporting"
                            :disabled="isKeyGateBusy || isBootstrapExporting"
                            @click="handleBootstrapKeyExport"
                        >
                            更新密钥并导出
                        </UButton>
                        <div class="text-xs text-default/50">
                            将导出 config.json 与 key 文件（请上传 config.json 到服务器）
                        </div>
                    </div>
                    <p v-if="keyWasFromLocal" class="mt-2 text-xs text-default/40">
                        检测到本地已保存密钥，但验证失败；请上传新的 key 文件进行更新。
                    </p>
                </div>
            </template>
            <template #footer>
                <UButton
                    v-if="canUploadKey"
                    color="neutral"
                    variant="soft"
                    :disabled="isKeyGateBusy"
                    @click="triggerKeyFileInput"
                >
                    选择文件
                </UButton>
            </template>
        </UModal>
    </UApp>
</template>

<style scoped></style>
