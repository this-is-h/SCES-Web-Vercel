<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
    ensureLocalConfig,
    getServerConfig,
    getStudentConfig,
    writeLocalConfig,
} from '@/utils/config'
import InputTags from '@/components/InputTags.vue'
import { createAppToast } from '@/utils/toast'
import { generateRsaOaepKeyPair } from '@/utils/crypto'
import { parseDyfText } from '@/utils/dyfFile'
import { saveAs } from 'file-saver'
import { mapFileSystemErrorToUserMessage } from '@/utils/error'

const toast = useToast()
const appToast = createAppToast(toast)

const fsAuthorized = inject('fsAuthorized', ref(false))
const fsChecking = inject('fsChecking', ref(false))

const isLoading = ref(false)
const isExporting = ref(false)
const isUpdatingKey = ref(false)
const isDyfParsing = ref(false)

const studentConfig = ref(null)
const serverConfig = ref(null)
const settingSections = [
    { key: 'basic', label: '基础设置', icon: 'i-lucide-settings' },
    { key: 'export', label: '配置导出', icon: 'i-lucide-file-json' },
    { key: 'dyfViewer', label: 'DYF解密查看', icon: 'i-lucide-file-search' },
]
const activeSection = ref('basic')
const dyfFileInput = ref(null)
const dyfFileName = ref('')
const dyfRawOutput = ref('')
const dyfParsedPayload = ref(null)
const dyfObjectUrls = ref([])
const draft = ref({
    year: '',
    semester: '',
    studentRequiredCategories: [],
    studentRequiredExtraItemNumbers: [],
    adminRequiredCategories: [],
    adminRequiredExtraItemNumbers: [],
    totalScorePenaltyCategoryCodes: [],
    totalScoreNegativeItemNumbers: [],
    encryptionEnabled: true,
    rsaPublicKeyJwk: null,
})

const validCategorySet = computed(() => {
    const dyf = studentConfig.value?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return new Set()
    return new Set(Object.keys(dyf))
})

const validItemNumberSet = computed(() => {
    const dyf = studentConfig.value?.data?.dyf
    const set = new Set()
    if (!dyf || typeof dyf !== 'object') return set
    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const n = Number(item?.number)
                if (Number.isFinite(n)) set.add(n)
            }
        }
    }
    return set
})

onMounted(async () => {
    studentConfig.value = await getStudentConfig()
})

const invalidNeedUpdate = computed(() => {
    const set = validCategorySet.value
    return (draft.value.studentRequiredCategories || []).filter((x) => !set.has(String(x)))
})

const invalidExtraItems = computed(() => {
    const set = validItemNumberSet.value
    return (draft.value.studentRequiredExtraItemNumbers || []).filter((x) => !set.has(Number(x)))
})

const invalidShowZeroCategories = computed(() => {
    const set = validCategorySet.value
    return (draft.value.adminRequiredCategories || []).filter((x) => !set.has(String(x)))
})

const invalidShowZeroItems = computed(() => {
    const set = validItemNumberSet.value
    return (draft.value.adminRequiredExtraItemNumbers || []).filter((x) => !set.has(Number(x)))
})

const BASIC_LABEL_MAP = {
    name: '姓名',
    studentName: '姓名',
    studentNo: '学号',
    studentId: '学号',
    id: '学号',
    year: '年份',
    semester: '学期',
    grade: '年级',
    major: '专业',
    class: '班级',
}

const TIME_LABEL_MAP = {
    student: '学生填写时间',
    class: '班级修改时间',
    grade: '年级修改时间',
    exportFinalized: '导出确认时间',
}

const mapBasicLabel = (key) => BASIC_LABEL_MAP[key] || key
const mapTimeLabel = (key) => TIME_LABEL_MAP[key] || key

const toBeijingTimeText = (raw) => {
    if (raw == null || raw === '') return ''
    let date = null
    if (raw instanceof Date) {
        date = raw
    } else if (typeof raw === 'number') {
        const ms = raw < 1e12 ? raw * 1000 : raw
        date = new Date(ms)
    } else if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if (!trimmed) return ''
        if (/^\d+$/.test(trimmed)) {
            const n = Number(trimmed)
            const ms = n < 1e12 ? n * 1000 : n
            date = new Date(ms)
        } else {
            date = new Date(trimmed)
        }
    }
    if (!date || Number.isNaN(date.getTime())) return String(raw)
    const text = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(date)
    return `${text}`
}

const clearDyfObjectUrls = () => {
    for (const url of dyfObjectUrls.value) {
        URL.revokeObjectURL(url)
    }
    dyfObjectUrls.value = []
}

const registerDyfObjectUrl = (url) => {
    dyfObjectUrls.value.push(url)
    return url
}

const base64ToImageUrl = ({ base64, mimeType }) => {
    if (!base64 || typeof base64 !== 'string') return ''
    const clean = base64.trim()
    if (!clean) return ''
    const byteChars = atob(clean)
    const array = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i += 1) {
        array[i] = byteChars.charCodeAt(i)
    }
    const blob = new Blob([array], { type: mimeType || 'image/png' })
    return registerDyfObjectUrl(URL.createObjectURL(blob))
}

const isPreviewableImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false
    return /^(data:image\/|blob:|https?:\/\/)/i.test(url.trim())
}

const extractPreviewImageUrl = (entry) => {
    if (!entry) return ''
    if (typeof entry === 'string') {
        return isPreviewableImageUrl(entry) ? entry : ''
    }
    if (typeof entry !== 'object') return ''
    const direct = entry.url ?? entry.src
    if (typeof direct === 'string' && isPreviewableImageUrl(direct)) return direct
    const content = entry.content
    if (typeof content === 'string') {
        return isPreviewableImageUrl(content) ? content : ''
    }
    if (content && typeof content === 'object') {
        const data = content.data
        if (typeof data === 'string') {
            if (isPreviewableImageUrl(data)) return data
            const mimeType = content.type || entry?.file?.type
            if (typeof mimeType === 'string' && mimeType.startsWith('image/')) {
                try {
                    return base64ToImageUrl({ base64: data, mimeType })
                } catch {
                    return ''
                }
            }
        }
    }
    return ''
}

const dyfVisualBasicInfo = computed(() => {
    const payload = dyfParsedPayload.value
    const personal = payload?.data?.personal
    if (!personal || typeof personal !== 'object') return []
    const preferredKeys = ['姓名', '学号', '年级', '专业', '班级', '年份', '学期']
    const extractValue = (field) => {
        if (field && typeof field === 'object' && 'data' in field) {
            const raw = field.data
            if (raw && typeof raw === 'object') {
                return raw.value ?? raw.label ?? JSON.stringify(raw)
            }
            return raw
        }
        return field
    }
    const result = []
    for (const key of preferredKeys) {
        if (!(key in personal)) continue
        const value = extractValue(personal[key])
        if (value == null || String(value).trim() === '') continue
        result.push({ label: key, value: String(value) })
    }
    if (result.length) return result
    for (const [key, field] of Object.entries(personal)) {
        const value = extractValue(field)
        if (value == null || String(value).trim() === '') continue
        result.push({ label: mapBasicLabel(String(key)), value: String(value) })
    }
    return result
})

const dyfVisualTimeInfo = computed(() => {
    const payload = dyfParsedPayload.value
    const time = payload?.time
    const personal = payload?.data?.personal
    const extractData = (key) => {
        const field = personal?.[key]
        if (field && typeof field === 'object' && 'data' in field) return field.data
        return null
    }
    const rows = []
    const year = extractData('年份')
    const semester = extractData('学期')
    if (year != null && String(year).trim() !== '')
        rows.push({ label: '年份', value: String(year) })
    if (semester != null && String(semester).trim() !== '') {
        rows.push({ label: '学期', value: String(semester) })
    }
    if (time && typeof time === 'object') {
        for (const [key, value] of Object.entries(time)) {
            if (value == null) continue
            const label = mapTimeLabel(String(key))
            if (typeof value === 'object') {
                const raw = value.at ?? value.value ?? value.ts ?? value.time ?? value.version
                const valueText = toBeijingTimeText(raw)
                rows.push({ label, value: valueText || JSON.stringify(value) })
                continue
            }
            const valueText = toBeijingTimeText(value)
            rows.push({ label, value: valueText || String(value) })
        }
    }
    return rows
})

const dyfVisualScoredItems = computed(() => {
    const payload = dyfParsedPayload.value
    const dyf = payload?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return []
    const rows = []
    for (const [category, groups] of Object.entries(dyf)) {
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const score = Number(item?.score)
                if (!Number.isFinite(score) || score === 0) continue
                const files = Array.isArray(item?.support?.files) ? item.support.files : []
                const previewUrls = files
                    .map((entry) => extractPreviewImageUrl(entry))
                    .filter((url) => typeof url === 'string' && url)
                rows.push({
                    category: String(category),
                    number: item?.number != null ? String(item.number) : '-',
                    score: String(score),
                    previewUrls,
                    thumbnails: previewUrls.slice(0, 2),
                    evidenceTotal: files.length,
                })
            }
        }
    }
    return rows
})

const normalizeExport = ({ rsaPublicKeyJwk } = {}) => {
    const cfg = serverConfig.value
    if (!cfg) return null

    const catSet = validCategorySet.value
    const numSet = validItemNumberSet.value
    const studentRequiredCategories = (draft.value.studentRequiredCategories || [])
        .map((v) => String(v).trim())
        .filter(Boolean)
        .filter((v) => catSet.has(v))

    const studentRequiredExtraItemNumbers = (draft.value.studentRequiredExtraItemNumbers || [])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
        .filter((n) => numSet.has(n))

    const adminRequiredCategories = (draft.value.adminRequiredCategories || [])
        .map((v) => String(v).trim())
        .filter(Boolean)
        .filter((v) => catSet.has(v))

    const adminRequiredExtraItemNumbers = (draft.value.adminRequiredExtraItemNumbers || [])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
        .filter((n) => numSet.has(n))
    const totalScorePenaltyCategoryCodes = (draft.value.totalScorePenaltyCategoryCodes || [])
        .map((v) => String(v).trim())
        .filter(Boolean)
    const totalScoreNegativeItemNumbers = (draft.value.totalScoreNegativeItemNumbers || [])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))

    const publicKey = rsaPublicKeyJwk ?? draft.value.rsaPublicKeyJwk ?? null
    const enabled = true

    return {
        version: cfg.version,
        year: Number(draft.value.year),
        semester: Number(draft.value.semester),
        studentRequiredCategories,
        studentRequiredExtraItemNumbers,
        adminRequiredCategories,
        adminRequiredExtraItemNumbers,
        totalScorePenaltyCategoryCodes,
        totalScoreNegativeItemNumbers,
        encryption: {
            enabled,
            rsaPublicKeyJwk: publicKey,
            rsaAlgorithm: cfg.encryption?.rsaAlgorithm ?? { name: 'RSA-OAEP', hash: 'SHA-256' },
            aesAlgorithm: cfg.encryption?.aesAlgorithm ?? { name: 'AES-GCM', length: 256 },
        },
    }
}

const refresh = async () => {
    isLoading.value = true
    try {
        const cfg = await getServerConfig({ force: true })
        serverConfig.value = cfg
        draft.value = {
            year: String(cfg.year ?? ''),
            semester: String(cfg.semester ?? ''),
            studentRequiredCategories: Array.isArray(cfg.studentRequiredCategories)
                ? [...cfg.studentRequiredCategories]
                : [],
            studentRequiredExtraItemNumbers: Array.isArray(cfg.studentRequiredExtraItemNumbers)
                ? [...cfg.studentRequiredExtraItemNumbers]
                : [],
            adminRequiredCategories: Array.isArray(cfg.adminRequiredCategories)
                ? [...cfg.adminRequiredCategories]
                : [],
            adminRequiredExtraItemNumbers: Array.isArray(cfg.adminRequiredExtraItemNumbers)
                ? [...cfg.adminRequiredExtraItemNumbers]
                : [],
            totalScorePenaltyCategoryCodes: Array.isArray(cfg.totalScorePenaltyCategoryCodes)
                ? [...cfg.totalScorePenaltyCategoryCodes]
                : [],
            totalScoreNegativeItemNumbers: Array.isArray(cfg.totalScoreNegativeItemNumbers)
                ? [...cfg.totalScoreNegativeItemNumbers]
                : [],
            encryptionEnabled: true,
            rsaPublicKeyJwk: cfg.encryption?.rsaPublicKeyJwk ?? null,
        }
    } catch (e) {
        appToast.error({
            title: '加载失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '加载服务端配置',
                pathHints: ['public/configs/config.js'],
            }),
        })
    } finally {
        isLoading.value = false
    }
}

const handleExportConfig = async () => {
    if (isExporting.value) return
    isExporting.value = true
    try {
        const payload = normalizeExport()
        if (!payload) return
        if (payload.encryption.enabled && !payload.encryption.rsaPublicKeyJwk) {
            appToast.error({ title: '导出失败', description: '启用加密时必须配置公钥' })
            return
        }
        if (
            invalidNeedUpdate.value.length ||
            invalidExtraItems.value.length ||
            invalidShowZeroCategories.value.length ||
            invalidShowZeroItems.value.length
        ) {
            appToast.warning({
                title: '已忽略无效项',
                description: '存在不在 student.js 中的项目',
            })
        }
        const content = `export default ${JSON.stringify(payload, null, 2)}\n`
        saveAs(new Blob([content], { type: 'text/javascript' }), 'config.js')
        appToast.success({
            title: '导出成功',
            description: '已生成 config.js，请手动上传到服务器',
        })
    } finally {
        isExporting.value = false
    }
}

const handleUpdateKeyAndExport = async () => {
    if (isUpdatingKey.value) return
    isUpdatingKey.value = true
    try {
        const cfg = serverConfig.value
        if (!cfg) return
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

        const payload = normalizeExport({ rsaPublicKeyJwk: publicKeyJwk })
        if (!payload) return
        payload.encryption.enabled = true
        payload.encryption.rsaPublicKeyJwk = publicKeyJwk

        const configContent = `export default ${JSON.stringify(payload, null, 2)}\n`
        saveAs(new Blob([configContent], { type: 'text/javascript' }), 'config.js')
        saveAs(
            new Blob([JSON.stringify(privateKeyJwk, null, 2)], { type: 'application/json' }),
            'key.json',
        )
        appToast.success({ title: '导出成功', description: '已导出 config.js 与 key.json' })
    } catch (e) {
        appToast.error({
            title: '导出失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '更新密钥并导出配置',
                pathHints: ['grade/config.json', 'public/configs/config.js'],
            }),
        })
    } finally {
        isUpdatingKey.value = false
    }
}

const triggerDyfFileInput = () => {
    dyfFileInput.value?.click()
}

const handleDyfFileChange = async (event) => {
    const file = event?.target?.files?.[0]
    event.target.value = ''
    if (!file) return
    clearDyfObjectUrls()
    dyfFileName.value = file.name || ''
    dyfRawOutput.value = ''
    dyfParsedPayload.value = null
    isDyfParsing.value = true
    try {
        const text = await file.text()
        const cfg = serverConfig.value ?? (await getServerConfig())
        const localConfig = await ensureLocalConfig({ scope: 'grade' })
        const privateKeyJwk = localConfig?.encryption?.privateKeyJwk ?? null
        const result = await parseDyfText({
            text,
            serverConfig: cfg,
            privateKeyJwk,
        })
        if (!result?.ok) {
            appToast.error({ title: '解析失败', description: result?.message || '无法解析该文件' })
            return
        }
        dyfParsedPayload.value = result.payload ?? null
        dyfRawOutput.value = JSON.stringify(
            {
                type: result.type,
                payload: result.payload,
            },
            null,
            2,
        )
        appToast.success({ title: '解析成功', description: '已展示解密后的原始数据（仅查看）' })
    } catch (e) {
        appToast.error({
            title: '读取失败',
            description: mapFileSystemErrorToUserMessage(e, {
                action: '读取并解析 dyf 文件',
            }),
        })
    } finally {
        isDyfParsing.value = false
    }
}

onBeforeUnmount(() => {
    clearDyfObjectUrls()
})

watch(
    [fsChecking, fsAuthorized],
    ([checking, authorized]) => {
        if (checking) return
        if (!authorized) return
        if (!serverConfig.value) refresh()
    },
    { immediate: true },
)
</script>

<template>
    <div class="p-4 space-y-4">
        <UCard v-if="!fsAuthorized" class="w-full">
            <template #header>
                <div class="font-medium text-highlighted">需要授权文件夹</div>
            </template>
            <div class="text-sm text-default/60">请先完成文件夹授权。</div>
        </UCard>

        <div v-else class="h-full flex items-start gap-4">
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
                    版本 v{{ serverConfig?.version ?? '-' }}
                </div>
            </div>

            <div class="flex-1 min-w-0">
                <div
                    v-if="activeSection === 'export'"
                    class="rounded-lg border border-default bg-default p-4 space-y-4"
                >
                    <div class="flex items-center justify-between gap-4">
                        <div class="min-w-0">
                            <div class="text-base font-semibold text-highlighted">配置导出</div>
                        </div>
                        <UButton
                            color="neutral"
                            variant="soft"
                            :loading="isLoading"
                            @click="refresh"
                        >
                            从服务器刷新
                        </UButton>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <UFormField label="当前学年">
                            <UInput v-model="draft.year" />
                        </UFormField>
                        <UFormField label="当前学期">
                            <UInput v-model="draft.semester" />
                        </UFormField>
                    </div>

                    <UFormField label="需要学生填写的类别" help="剩余项目可在管理端修改">
                        <InputTags
                            v-model="draft.studentRequiredCategories"
                            placeholder="输入后回车/逗号分隔"
                        />
                        <div v-if="invalidNeedUpdate.length" class="mt-2 text-xs text-red-600">
                            无效分类：{{ invalidNeedUpdate.join('、') }}
                        </div>
                    </UFormField>

                    <UFormField
                        label="需要学生填写的项目"
                        help="类别无需学生填写，但需要学生填写的某些单项"
                    >
                        <InputTags
                            v-model="draft.studentRequiredExtraItemNumbers"
                            placeholder="输入编号后回车/逗号分隔"
                            :parse="(v) => Number(String(v).trim())"
                            :format="(v) => String(v)"
                        />
                        <div v-if="invalidExtraItems.length" class="mt-2 text-xs text-red-600">
                            无效编号：{{ invalidExtraItems.join('、') }}
                        </div>
                    </UFormField>

                    <UFormField
                        label="管理端需要填写的类别"
                        help="学生填写的内容中，即使没有填写也需要管理端修改的类别"
                    >
                        <InputTags
                            v-model="draft.adminRequiredCategories"
                            placeholder="输入后回车/逗号分隔"
                        />
                        <div
                            v-if="invalidShowZeroCategories.length"
                            class="mt-2 text-xs text-red-600"
                        >
                            无效分类：{{ invalidShowZeroCategories.join('、') }}
                        </div>
                    </UFormField>

                    <UFormField
                        label="管理端需要填写的项目"
                        help="学生填写的内容中，即使没有填写也需要管理端修改的单项（不含在上一项类别中的项目）"
                    >
                        <InputTags
                            v-model="draft.adminRequiredExtraItemNumbers"
                            placeholder="输入编号后回车/逗号分隔"
                            :parse="(v) => Number(String(v).trim())"
                            :format="(v) => String(v)"
                        />
                        <div v-if="invalidShowZeroItems.length" class="mt-2 text-xs text-red-600">
                            无效编号：{{ invalidShowZeroItems.join('、') }}
                        </div>
                    </UFormField>

                    <div class="flex items-center justify-between gap-4">
                        <div>
                            <div class="font-medium">启用加密</div>
                            <div class="text-sm text-default/60">导出的 .dyf 文件必须加密。</div>
                        </div>
                        <USwitch v-model="draft.encryptionEnabled" disabled />
                    </div>

                    <div class="flex items-center justify-between gap-4">
                        <div>
                            <div class="font-medium text-highlighted">密钥状态</div>
                            <div class="text-sm text-default/60">
                                公钥：{{ draft.rsaPublicKeyJwk ? '已配置' : '未配置' }}
                            </div>
                        </div>
                        <div class="mt-3 flex gap-2 justify-end">
                            <UButton
                                color="neutral"
                                :loading="isExporting"
                                :disabled="isLoading || isExporting || isUpdatingKey"
                                @click="handleExportConfig"
                            >
                                直接导出配置
                            </UButton>
                            <UButton
                                color="neutral"
                                variant="soft"
                                :loading="isUpdatingKey"
                                :disabled="isLoading || isExporting || isUpdatingKey"
                                @click="handleUpdateKeyAndExport"
                            >
                                更新密钥并导出
                            </UButton>
                        </div>
                    </div>
                </div>

                <div
                    v-else-if="activeSection === 'dyfViewer'"
                    class="rounded-lg border border-default bg-default p-4 space-y-4"
                >
                    <input
                        ref="dyfFileInput"
                        type="file"
                        class="hidden"
                        accept=".dyf"
                        @change="handleDyfFileChange"
                    />
                    <div class="flex items-center justify-between gap-4">
                        <div class="min-w-0">
                            <div class="text-base font-semibold text-highlighted">DYF解密查看</div>
                            <div class="text-sm text-default/60 truncate">
                                {{
                                    dyfFileName
                                        ? `当前文件：${dyfFileName}`
                                        : '请上传一个学生 .dyf 文件'
                                }}
                            </div>
                        </div>
                        <UButton
                            color="neutral"
                            variant="soft"
                            :loading="isDyfParsing"
                            @click="triggerDyfFileInput"
                        >
                            上传 .dyf 文件
                        </UButton>
                    </div>
                    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <div class="rounded-lg border border-default p-3 bg-default">
                            <div class="text-sm font-semibold text-highlighted mb-2">基本信息</div>
                            <div v-if="dyfVisualBasicInfo.length" class="space-y-2">
                                <div
                                    v-for="item in dyfVisualBasicInfo"
                                    :key="item.label"
                                    class="flex justify-between gap-3 text-sm"
                                >
                                    <div class="text-default/60">{{ item.label }}</div>
                                    <div class="text-right break-all">{{ item.value }}</div>
                                </div>
                            </div>
                            <div v-else class="text-xs text-default/50">暂无可展示的基本信息</div>
                        </div>
                        <div class="rounded-lg border border-default p-3 bg-default">
                            <div class="text-sm font-semibold text-highlighted mb-2">时间</div>
                            <div v-if="dyfVisualTimeInfo.length" class="space-y-2">
                                <div
                                    v-for="item in dyfVisualTimeInfo"
                                    :key="item.label"
                                    class="flex justify-between gap-3 text-sm"
                                >
                                    <div class="text-default/60">{{ item.label }}</div>
                                    <div class="text-right break-all">{{ item.value }}</div>
                                </div>
                            </div>
                            <div v-else class="text-xs text-default/50">暂无可展示的时间信息</div>
                        </div>
                        <div class="rounded-lg border border-default p-3 bg-default">
                            <div class="text-sm font-semibold text-highlighted mb-2">
                                有分数的项目
                            </div>
                            <div v-if="dyfVisualScoredItems.length" class="space-y-2">
                                <div
                                    v-for="(item, index) in dyfVisualScoredItems"
                                    :key="`${item.category}-${item.number}-${index}`"
                                    class="text-sm border border-default rounded px-2 py-1 flex justify-between"
                                >
                                    <div>
                                        <div class="truncate">{{ item.category }}</div>
                                        <div class="text-xs text-default/60">
                                            编号 {{ item.number }} · 分数 {{ item.score }}
                                        </div>
                                    </div>
                                    <div
                                        v-if="item.thumbnails.length || item.evidenceTotal > 0"
                                        class="mt-2 flex items-center gap-2"
                                    >
                                        <el-image
                                            v-for="(img, imgIndex) in item.thumbnails"
                                            :key="`${img}-${imgIndex}`"
                                            class="w-8 h-8 rounded"
                                            :src="img"
                                            :preview-src-list="item.previewUrls"
                                            :initial-index="imgIndex"
                                            fit="cover"
                                            :zoom-rate="1.2"
                                            :max-scale="7"
                                            :min-scale="0.2"
                                            show-progress
                                        />
                                        <div
                                            v-if="item.evidenceTotal > 2"
                                            class="text-xs text-default/60"
                                        >
                                            …（共{{ item.evidenceTotal }}张）
                                        </div>
                                        <div
                                            v-else-if="
                                                item.evidenceTotal > 0 && !item.thumbnails.length
                                            "
                                            class="text-xs text-default/60"
                                        >
                                            共{{ item.evidenceTotal }}张（当前不可预览）
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="text-xs text-default/50">暂无有分数的项目</div>
                        </div>
                    </div>
                    <div class="rounded-lg border border-default overflow-hidden">
                        <textarea
                            :value="
                                dyfRawOutput ||
                                '暂无内容，上传 .dyf 文件后将在此显示解密后的原始数据。'
                            "
                            readonly
                            rows="22"
                            class="w-full px-3 py-2 text-xs font-mono bg-default text-default resize-y outline-none"
                        />
                    </div>
                </div>

                <div v-else class="rounded-lg border border-default bg-default p-4">
                    <div class="mb-4">
                        <h2 class="text-lg font-bold text-highlighted">基础设置</h2>
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

<style scoped></style>
