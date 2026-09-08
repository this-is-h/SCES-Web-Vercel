<script setup>
import { ref, watch, onMounted, onUnmounted, toRaw, unref, computed, nextTick } from 'vue'
import localforage from 'localforage'
import { showNotify } from 'vant'
import { getStudentConfig } from '@/utils/config'
import Compressor from 'compressorjs'
import { showLoadingToast, closeToast, showToast } from 'vant'
import { getServerConfig } from '@/utils/config'
import { createDyfText } from '@/utils/dyfFile'
import { saveAs } from 'file-saver'
import {
    findStudentJsFirstDiffPath,
    mergeStudentStateKeepingUserData,
} from '@/utils/studentConfigSync'
import { applyLeadershipTrainingHighestRule } from '@/utils/leadershipTrainingScore'
import { calculateTotalScore, resolveTotalScoreConfig } from '@/utils/totalScore'
import { formatPenaltyCategoryTitle, formatPenaltyItemLabel } from '@/utils/penaltyDisplay'
import { buildStudentExportPayload } from '@/utils/studentStorage'
import feedbackImg from '@/assets/img/feedback.jpg'

const EXPORT_CONFIRM_MESSAGE =
    '班级管理端每学期每名学生仅能导入一次\n请确保信息完全正确、分数全部申请、证明材料完整且正确后再导入并发送给班级管理员。'
const FEEDBACK_CANCEL_MESSAGE = '旧反馈渠道\n（不推荐）'

const exportConfirmOpen = ref(false)
const exportScorePreviewOpen = ref(false)
const exportInFlight = ref(false)
const exportScorePreviewRows = ref([])
const exportScorePreviewTotal = ref(0)
const exportScorePreviewChanged = ref(false)
const exportFinalizeInProgress = ref(false)
const dialogFeedback = ref(false)
const lastLocalSaveError = ref('')
const EXPORT_FINALIZED_VERSION = 'student-export-finalized-v1'

// 检测URL中的get参数
function getUrlParam(name) {
    const url = new URL(window.location.href)
    return url.searchParams.get(name)
}

// 检测pc参数，如果pc=true则引入touch-emulator
if (getUrlParam('pc') === 'true') {
    import('@vant/touch-emulator')
}

const serverConfig = ref(null)
const ensureServerConfig = async () => {
    if (serverConfig.value) return serverConfig.value
    serverConfig.value = await getServerConfig({ force: true })
    return serverConfig.value
}

const VERSION = computed(() => serverConfig.value?.version ?? '')
// 调试开关：设置为false关闭所有调试日志
const DEBUG = false

// 调试日志函数
const debugLog = (...args) => {
    if (DEBUG) {
        console.log(...args)
    }
}

// 调试错误函数
const debugError = (...args) => {
    if (DEBUG) {
        console.error(...args)
    }
}

// 调试警告函数
const debugWarn = (...args) => {
    if (DEBUG) {
        console.warn(...args)
    }
}

// 说明：
// - 旧版本曾使用 serialize-javascript + eval 反序列化本地数据（存在代码执行风险）。
// - 当前已改为 JSON 存储；如检测到旧数据格式，将提示用户“一键还原”。

// 上传前处理函数：将 File 对象压缩为 WebP 格式
function beforeUploaderRead(file) {
    if (!file.type.startsWith('image/')) {
        showToast('请上传图片文件')
        return false
    }

    showLoadingToast({
        message: '图片处理中...',
        forbidClick: true,
    })

    // 根据文件大小设置不同的quality值
    let quality = 0.6
    const fileSize = file.size // 单位：字节
    const oneMB = 1024 * 1024 // 1MB = 1048576字节
    debugLog('文件大小:', fileSize / oneMB, 'MB')

    if (fileSize < oneMB) {
        // 小于1m的文件，quality取0.8
        quality = 0.8
    } else if (fileSize < 2 * oneMB) {
        // 1m-2m的文件，quality取0.6
        quality = 0.6
    } else if (fileSize < 3 * oneMB) {
        // 2-3m的文件，quality取0.4
        quality = 0.4
    } else {
        // 大于3m的文件，quality取0.2
        quality = 0.2
    }

    return new Promise((resolve, reject) => {
        new Compressor(file, {
            success(result) {
                debugLog('压缩成功:', result.size / oneMB, 'MB')
                resolve(result)
            },
            error(err) {
                debugError(err.message)
                reject(err)
            },
            strict: true,
            checkOrientation: true,
            quality: quality,
            mimeType: 'image/webp',
        })
    })
        .catch(() => {
            showToast('图片处理失败')
            return false
        })
        .finally(() => {
            closeToast()
        })
}

// 辅助函数：将 Base64 转换为 Blob
function base64ToBlob(base64String) {
    try {
        // 处理带 data:image/png;base64, 前缀的 base64
        const base64Data = base64String.includes('base64,')
            ? base64String.split(',')[1]
            : base64String

        const byteCharacters = atob(base64Data)
        const byteArrays = []

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512)
            const byteNumbers = new Array(slice.length)

            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i)
            }

            const byteArray = new Uint8Array(byteNumbers)
            byteArrays.push(byteArray)
        }

        // 从 base64 字符串中提取 MIME 类型
        const mimeType = base64String.includes('data:')
            ? base64String.match(/data:(.*?);/)[1]
            : 'application/octet-stream'

        return new Blob(byteArrays, { type: mimeType })
    } catch (error) {
        console.error('Base64 转换 Blob 失败:', error)
        return null
    }
}

// 主函数：更新 JSON 对象中的 objectUrl (恢复文件预览)
function updateFileUrlsInObject(obj, shouldRevoke = true) {
    debugLog('开始更新文件 URLs...')

    // 处理 Vue 的响应式对象
    const rawObj = toRaw(unref(obj))

    if (!rawObj || typeof rawObj !== 'object') {
        debugWarn('无效的输入对象，直接返回')
        return obj
    }

    // 创建深拷贝（保持响应式）
    const result = Array.isArray(rawObj) ? [...rawObj] : { ...rawObj }

    // 递归遍历对象
    const traverseAndUpdate = (target) => {
        if (!target || typeof target !== 'object') {
            return
        }

        // 检查是否是文件数据对象
        if (
            target.content &&
            typeof target.content === 'string' &&
            target.content.includes('base64')
        ) {
            // 如果已有旧 objectUrl，先释放（可选）
            if (shouldRevoke && target.objectUrl && target.objectUrl.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(target.objectUrl)
                    debugLog('已释放旧 objectUrl:', target.objectUrl)
                } catch (e) {
                    // 忽略释放错误
                    debugWarn('释放旧 objectUrl 失败:', e)
                }
            }

            // 从 base64 生成新的 objectUrl
            const blob = base64ToBlob(target.content)
            if (blob) {
                target.objectUrl = URL.createObjectURL(blob)
                if (target.url) {
                    delete target.url
                }
                debugLog('已生成新的 objectUrl:', target.objectUrl)
            }
        }

        // 递归处理对象或数组
        if (Array.isArray(target)) {
            for (let i = 0; i < target.length; i++) {
                if (target[i] && typeof target[i] === 'object') {
                    traverseAndUpdate(target[i])
                }
            }
        } else {
            for (const key in target) {
                if (
                    target[key] &&
                    typeof target[key] === 'object' &&
                    key !== 'file' // 避免递归 file 对象
                ) {
                    traverseAndUpdate(target[key])
                }
            }
        }
    }

    traverseAndUpdate(result)
    debugLog('文件 URLs 更新完成')
    return result
}

function revokeObjectUrlsInObject(obj) {
    const rawObj = toRaw(unref(obj))
    const traverse = (target) => {
        if (!target || typeof target !== 'object') return
        if (
            target.objectUrl &&
            typeof target.objectUrl === 'string' &&
            target.objectUrl.startsWith('blob:')
        ) {
            try {
                URL.revokeObjectURL(target.objectUrl)
            } catch {}
            delete target.objectUrl
        }
        if (Array.isArray(target)) {
            for (const it of target) traverse(it)
            return
        }
        for (const key in target) traverse(target[key])
    }
    traverse(rawObj)
}

// --- 数据处理逻辑 ---

// 1. 保存前预处理 (直接修改 data)
// 功能：规范化文件对象Url，清理零分项文件
function preprocessBeforeSave(studentFormState) {
    debugLog('开始数据预处理 (保存前)...')

    const traverseAndProcess = (target) => {
        if (!target || typeof target !== 'object') return

        // 逻辑1: 处理 files 数组 (如果存在且有 url 属性，将其转为 objectUrl)
        if (Array.isArray(target) && target.length > 0 && target[0].objectUrl !== undefined) {
            target.forEach((fileItem) => {
                if (fileItem && typeof fileItem === 'object' && fileItem.url) {
                    console.log('原始 fileItem:', fileItem)
                    debugLog('更新 objectUrl 从', fileItem.url, '到', fileItem.objectUrl)
                    fileItem.objectUrl = fileItem.url
                    delete fileItem.url
                    console.log('更新后的 fileItem:', fileItem)
                }
            })
        }

        // 逻辑2: 清理零分项目的证明材料
        // 检查是否是评分项目（有score和support属性）
        if (
            Object.prototype.hasOwnProperty.call(target, 'score') &&
            Object.prototype.hasOwnProperty.call(target, 'support')
        ) {
            // 如果score为0，清空support.files和img
            if (target.score === 0) {
                if (target.support && typeof target.support === 'object') {
                    if (Array.isArray(target.support.files)) {
                        if (target.support.files.length > 0) target.support.files = []
                    } else if (target.support.files != null) {
                        target.support.files = []
                    }

                    if (Array.isArray(target.support.img)) {
                        if (target.support.img.length > 0) target.support.img = []
                    } else if (target.support.img != null) {
                        target.support.img = []
                    }
                }
            }
        }

        // 递归
        if (Array.isArray(target)) {
            target.forEach(traverseAndProcess)
        } else {
            for (const key in target) {
                traverseAndProcess(target[key])
            }
        }
    }

    traverseAndProcess(studentFormState)
    return studentFormState
}

// 2. 导出前预处理 (直接修改 data)
// 功能：处理 1311-1351 最大分值逻辑
function preprocessBeforeExport(studentFormState) {
    debugLog('开始导出前预处理 (直接修改)...')
    const { changed, keptScore, keptNumber, candidates } =
        applyLeadershipTrainingHighestRule(studentFormState)
    if (candidates > 0) {
        debugLog(`学干培养保留分数 ${keptScore}，项目 ${keptNumber}`)
    }

    if (studentFormState.time) studentFormState.time.student = Date.now()

    return { changed }
}

// 3. 创建导出数据副本 (深拷贝) - 二次预处理
// 功能：移除多余属性 (personal: required, disabled...; dyf: description, score_type)
function buildExportPayload(sourceData) {
    debugLog('创建导出数据副本 (二次预处理)...')
    return buildStudentExportPayload(sourceData)
}

// --- 状态与生命周期 ---

const studentFormState = ref({ data: { personal: {}, dyf: {} } })
const studentTemplate = ref(null)
const deepClonePreserveRegExp = (input) => {
    const rawInput = toRaw(input)
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(rawInput)
        } catch {}
    }

    const seen = new Map()
    const clone = (v) => {
        if (v == null || typeof v !== 'object') return v
        const rawV = toRaw(v)
        if (rawV instanceof RegExp) return new RegExp(rawV.source, rawV.flags)
        if (rawV instanceof Date) return new Date(rawV.getTime())
        if (seen.has(rawV)) return seen.get(rawV)
        if (Array.isArray(rawV)) {
            const arr = []
            seen.set(rawV, arr)
            for (const it of rawV) arr.push(clone(it))
            return arr
        }
        const out = {}
        seen.set(rawV, out)
        for (const k of Object.keys(rawV)) out[k] = clone(rawV[k])
        return out
    }
    return clone(rawInput)
}

const normalizeVantRules = (rules) => {
    if (!Array.isArray(rules)) return []
    const stripPattern = (rule) => {
        const rest = { ...rule }
        delete rest.pattern
        return rest
    }
    return rules
        .map((rule) => {
            if (!rule || typeof rule !== 'object') return null
            if (!('pattern' in rule)) return rule
            const pattern = rule.pattern
            if (pattern == null) return rule
            if (pattern instanceof RegExp) return rule
            if (typeof pattern === 'string') {
                try {
                    return { ...rule, pattern: new RegExp(pattern) }
                } catch {
                    return stripPattern(rule)
                }
            }
            if (
                typeof pattern === 'object' &&
                typeof pattern.source === 'string' &&
                typeof pattern.flags === 'string'
            ) {
                try {
                    return { ...rule, pattern: new RegExp(pattern.source, pattern.flags) }
                } catch {
                    return stripPattern(rule)
                }
            }
            return stripPattern(rule)
        })
        .filter(Boolean)
}

const onCascaderFinish = (index, data, payload) => {
    if (index == '班级信息') {
        const field = data.field
        const studentFormState = data.studentFormState
        field.cascader.show = false

        if (!field || typeof field !== 'object') return
        if (!field.cascader || typeof field.cascader !== 'object') field.cascader = {}

        const selectedOptions = payload?.selectedOptions

        field.data = selectedOptions.map((option) => option.text).join(' ')

        console.log(studentFormState.data.personal)
        selectedOptions.map((option, index) => {
            const title = field.cascader.titles[index]
            if (title in studentFormState.data.personal) {
                studentFormState.data.personal[title].data = option.text
            }
        })
    }
}

const repairPersonalPatternRulesFromTemplate = (state, template) => {
    const tplPersonal = template?.data?.personal
    const stPersonal = state?.data?.personal
    if (!tplPersonal || typeof tplPersonal !== 'object') return
    if (!stPersonal || typeof stPersonal !== 'object') return

    for (const key of Object.keys(tplPersonal)) {
        const tplField = tplPersonal[key]
        const stField = stPersonal[key]
        if (!tplField || typeof tplField !== 'object') continue
        if (!stField || typeof stField !== 'object') continue
        if ('pattern' in tplField) stField.pattern = tplField.pattern
    }
}

const resetDataFromTemplate = (template) => {
    studentFormState.value = deepClonePreserveRegExp(template || {})
    if (studentFormState.value?.data?.personal?.['年份'])
        studentFormState.value.data.personal['年份'].data = ''
    if (studentFormState.value?.data?.personal?.['学期'])
        studentFormState.value.data.personal['学期'].data = ''
}

const extraItemsSet = computed(
    () =>
        new Set((serverConfig.value?.studentRequiredExtraItemNumbers || []).map((n) => String(n))),
)
const needUpdateSet = computed(
    () => new Set((serverConfig.value?.studentRequiredCategories || []).map((n) => String(n))),
)
const visibleDyfSections = computed(() => {
    const dyf = studentFormState.value?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return []

    const sections = []
    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue

        const showAll = !serverConfig.value || needUpdateSet.value.has(String(categoryName))
        const filteredGroups = []

        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            const group = groups[groupIndex]
            if (!Array.isArray(group)) continue

            const items = showAll
                ? group
                : group.filter(
                      (item) =>
                          item?.number != null && extraItemsSet.value.has(String(item.number)),
                  )

            if (items.length > 0) filteredGroups.push({ groupIndex, items })
        }

        if (showAll || filteredGroups.length > 0) {
            sections.push({ categoryName, groups: filteredGroups })
        }
    }

    return sections
})

const formatCategoryTitleText = (categoryName) =>
    formatPenaltyCategoryTitle(categoryName, serverConfig.value)

const formatItemNumberText = (itemNumber) =>
    formatPenaltyItemLabel(itemNumber, {
        config: serverConfig.value,
    })

const formatEvidenceTitle = (itemNumber) => {
    const numberText = formatItemNumberText(itemNumber)
    if (!numberText) return '证明材料'
    return `证明材料（${numberText}）`
}

const dataIsProcessing = ref(false)
const isWechatBrowser = ref(false)
const suspendAutoSave = ref(false)
const configSyncState = ref({ inProgress: false, failed: false, lastError: '' })
let saveDebounceTimer = null

const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const CONFIG_SYNC_OVERLAY_MIN_MS = 800
const configSyncOverlay = ref({ active: false, shownAt: 0 })
const showConfigSyncOverlay = (step, percent) => {
    if (!configSyncOverlay.value.active) {
        configSyncOverlay.value = { active: true, shownAt: Date.now() }
    }
    showLoadingToast({
        message: step ? `加载中 ${percent}%\n${step}` : `加载中 ${percent}%`,
        forbidClick: true,
        duration: 0,
    })
}
const hideConfigSyncOverlay = async () => {
    if (configSyncOverlay.value.active) {
        const elapsed = Date.now() - configSyncOverlay.value.shownAt
        if (elapsed < CONFIG_SYNC_OVERLAY_MIN_MS) {
            await delay(CONFIG_SYNC_OVERLAY_MIN_MS - elapsed)
        }
    }
    closeToast()
    configSyncOverlay.value = { active: false, shownAt: 0 }
}
const cancelScheduledSave = () => {
    if (!saveDebounceTimer) return
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
}

const cloneAsPlainObject = (input) => {
    const deepToRaw = (obj) => {
        if (!obj || typeof obj !== 'object') return obj
        const rawObj = toRaw(obj)
        if (Array.isArray(rawObj)) return rawObj.map((item) => deepToRaw(item))
        const result = {}
        for (const key in rawObj) {
            if (Object.prototype.hasOwnProperty.call(rawObj, key)) {
                result[key] = deepToRaw(rawObj[key])
            }
        }
        return result
    }
    const rawData = deepToRaw(input)
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(rawData)
        } catch {}
    }
    return JSON.parse(JSON.stringify(rawData))
}

const mapLocalSaveErrorMessage = (error) => {
    const raw = String(error?.message || error || '')
    if (raw.includes('QuotaExceededError')) {
        return '本地存储空间不足，请清理浏览器站点数据后重试'
    }
    if (raw.includes('DataCloneError')) {
        return '存在不可保存的数据，请减少附件后重试'
    }
    if (raw.includes('structuredClone') || raw.includes('is not defined')) {
        return '当前浏览器不支持本地保存能力，请更换浏览器后重试'
    }
    if (raw.includes('circular')) {
        return '存在异常数据，请刷新页面后重试'
    }
    return '本地保存失败，请稍后重试'
}

showConfigSyncOverlay('初始化', 0)

const normalizeSemesterField = (v) => String(v ?? '').trim()
const getSemesterFromState = (state) => {
    const personal = state?.data?.personal
    return {
        year: normalizeSemesterField(personal?.['年份']?.data),
        semester: normalizeSemesterField(personal?.['学期']?.data),
    }
}
const validateServerSemester = (semesterInfo) => {
    const year = normalizeSemesterField(semesterInfo?.year)
    const semester = normalizeSemesterField(semesterInfo?.semester)
    if (!year || !semester) throw new Error('invalid config.js semester fields')
    return { year, semester }
}
const fetchServerConfigForSemesterSync = async () => {
    const data = await getServerConfig({ force: true })
    if (!data || typeof data !== 'object') throw new Error('invalid config.js format')
    return data
}
const resetStudentState = async ({ year, semester, notifyMessage, notifyType = 'success' }) => {
    try {
        suspendAutoSave.value = true
        cancelScheduledSave()
        if (!studentTemplate.value) studentTemplate.value = await getStudentConfig()
        resetDataFromTemplate(studentTemplate.value)
        studentFormState.value.data.personal['年份'].data = year ?? ''
        studentFormState.value.data.personal['学期'].data = semester ?? ''
        const savedOk = await saveDataToLocal(studentFormState.value)
        if (!savedOk) throw new Error('save local data failed')
        if (notifyMessage) {
            showNotify({
                message: notifyMessage,
                duration: 3000,
                position: 'top',
                type: notifyType,
            })
        }
    } finally {
        suspendAutoSave.value = false
    }
}

const fillSemesterFields = async ({ year, semester, notifyMessage, notifyType = 'primary' }) => {
    try {
        suspendAutoSave.value = true
        cancelScheduledSave()
        if (!studentFormState.value?.data?.personal) {
            throw new Error('invalid student form state')
        }
        studentFormState.value.data.personal['年份'].data = year ?? ''
        studentFormState.value.data.personal['学期'].data = semester ?? ''
        const savedOk = await saveDataToLocal(studentFormState.value)
        if (!savedOk) throw new Error(lastLocalSaveError.value || 'save local data failed')
        if (notifyMessage) {
            showNotify({
                message: notifyMessage,
                duration: 3000,
                position: 'top',
                type: notifyType,
            })
        }
    } finally {
        suspendAutoSave.value = false
    }
}

const syncSemesterIfNeeded = async () => {
    const localSemester = getSemesterFromState(studentFormState.value)
    try {
        const rawConfig = await fetchServerConfigForSemesterSync()
        const serverSemester = validateServerSemester(rawConfig)
        const hasLocalSemester = Boolean(localSemester.year && localSemester.semester)
        if (hasLocalSemester) {
            if (
                localSemester.year === serverSemester.year &&
                localSemester.semester === serverSemester.semester
            )
                return
            await resetStudentState({
                year: serverSemester.year,
                semester: serverSemester.semester,
                notifyMessage: '学期信息已更新，相关数据已重置',
                notifyType: 'primary',
            })
        } else {
            await fillSemesterFields({
                year: serverSemester.year,
                semester: serverSemester.semester,
                notifyMessage: '检测到学期信息缺失，已自动补全',
                notifyType: 'warning',
            })
        }

        try {
            serverConfig.value = await getServerConfig({ force: true })
        } catch {}
    } catch (e) {
        console.error('学期同步检测失败，将保持原有本地数据不变:', e)
    }
}

const fetchStudentConfigForStructureSync = async () => {
    const data = await getStudentConfig({ force: true })
    if (!data || typeof data !== 'object') throw new Error('invalid student.js format')
    if (!data.data || typeof data.data !== 'object') throw new Error('invalid student.js data')
    if (!data.data.personal || typeof data.data.personal !== 'object')
        throw new Error('invalid student.js personal')
    if (!data.data.dyf || typeof data.data.dyf !== 'object')
        throw new Error('invalid student.js dyf')
    return data
}

const runConfigStructureSync = async ({ manual = false } = {}) => {
    if (configSyncState.value.inProgress) return
    configSyncState.value = { inProgress: true, failed: false, lastError: '' }

    const setProgress = manual
        ? (step, percent) => {
              showConfigSyncOverlay(step, percent)
          }
        : () => {}

    try {
        setProgress('读取结构', 10)
        const serverStudentConfig = await fetchStudentConfigForStructureSync()
        const serverTemplate = serverStudentConfig
        studentTemplate.value = serverTemplate

        setProgress('对比结构', 35)
        const diffPath = findStudentJsFirstDiffPath({
            serverTemplate,
            localState: studentFormState.value,
        })
        const mismatch = Boolean(diffPath)

        if (!mismatch) {
            setProgress('完成', 100)
            await hideConfigSyncOverlay()
            if (manual) {
                showNotify({
                    message: '配置同步完成',
                    duration: 2000,
                    position: 'top',
                    type: 'success',
                })
            }
            console.info('[ConfigSync] no changes')
            return
        }

        setProgress('合并数据', 70)
        const { nextState, removedItems, addedItems } = mergeStudentStateKeepingUserData({
            localState: studentFormState.value,
            serverTemplate: serverTemplate,
        })

        setProgress('保存本地', 90)
        suspendAutoSave.value = true
        studentFormState.value = nextState
        const savedOk = await saveDataToLocal(studentFormState.value)
        if (!savedOk) throw new Error('save local data failed')
        suspendAutoSave.value = false

        setProgress('完成', 100)
        await hideConfigSyncOverlay()

        showNotify({
            message: '数据已更新',
            duration: 2500,
            position: 'top',
            type: 'success',
        })

        console.info('[ConfigSync] merged', {
            addedCount: addedItems.length,
            removedCount: removedItems.length,
            added: addedItems.slice(0, 50),
            removed: removedItems.slice(0, 50),
            diffPath,
        })
    } catch (e) {
        await hideConfigSyncOverlay()
        const msg = String(e?.message || e || 'unknown error')
        configSyncState.value = { inProgress: false, failed: true, lastError: msg }
        console.error('[ConfigSync] failed:', e)
        showNotify({
            message: '配置同步失败，可点击右上角“重试同步”',
            duration: 5000,
            position: 'top',
            type: 'danger',
        })
        return
    } finally {
        if (suspendAutoSave.value) suspendAutoSave.value = false
        configSyncState.value = {
            ...configSyncState.value,
            inProgress: false,
        }
    }
}

const retryConfigSync = () => {
    void runConfigStructureSync({ manual: true })
}

// 页面加载
onMounted(async () => {
    debugLog('页面加载，开始从本地存储获取数据...')
    const userAgent = window.navigator.userAgent.toLowerCase()
    isWechatBrowser.value = userAgent.includes('micromessenger')

    try {
        studentTemplate.value = await getStudentConfig()
        resetDataFromTemplate(studentTemplate.value)
        serverConfig.value = await ensureServerConfig()
        if (
            serverConfig.value?.year != null &&
            !studentFormState.value.data.personal['年份'].data
        ) {
            studentFormState.value.data.personal['年份'].data = serverConfig.value.year
        }
        if (
            serverConfig.value?.semester != null &&
            !studentFormState.value.data.personal['学期'].data
        ) {
            studentFormState.value.data.personal['学期'].data = serverConfig.value.semester
        }
    } catch (e) {
        debugError('读取服务端配置失败:', e)
    }

    try {
        const savedData = await localforage.getItem('StudentData')
        if (savedData) {
            try {
                const parsed = JSON.parse(
                    typeof savedData === 'string' ? savedData : String(savedData),
                )
                const payload =
                    parsed && typeof parsed === 'object' && 'schemaVersion' in parsed
                        ? parsed.data
                        : parsed
                if (
                    payload &&
                    typeof payload === 'object' &&
                    payload.data &&
                    typeof payload.data === 'object' &&
                    payload.data.personal &&
                    typeof payload.data.personal === 'object' &&
                    payload.data.dyf &&
                    typeof payload.data.dyf === 'object'
                ) {
                    studentFormState.value = updateFileUrlsInObject(payload)
                    repairPersonalPatternRulesFromTemplate(
                        studentFormState.value,
                        studentTemplate.value,
                    )
                    debugLog('已恢复本地数据')
                } else {
                    throw new Error('invalid local student data')
                }
            } catch (e) {
                const msg = String(e?.message || e || '')
                if (msg.includes('invalid local student data')) {
                    showNotify({
                        message: '检测到本地数据异常，已使用初始数据',
                        duration: 5000,
                        position: 'top',
                        type: 'warning',
                    })
                } else {
                    debugError('检测到旧版本数据格式，无法安全解析，将使用默认数据', e)
                    showNotify({
                        message: '检测到旧版本数据格式，请点击“一键还原”后重新填写',
                        duration: 5000,
                        position: 'top',
                        type: 'warning',
                    })
                }
            }
        } else {
            debugLog('本地存储中没有数据，使用默认数据')
        }
    } catch (error) {
        debugError('获取本地数据失败:', error)
    }

    await runConfigStructureSync({ manual: false })

    setTimeout(() => {
        void syncSemesterIfNeeded()
    }, 0)
})

onUnmounted(() => {
    revokeObjectUrlsInObject(studentFormState)
})

// --- 核心操作 ---

// 保存数据到本地 (包含预处理)
let saveInFlight = Promise.resolve(true)
const saveDataToLocal = async (studentStateToSave) => {
    const run = async () => {
        dataIsProcessing.value = true
        debugLog('数据变化，开始保存...')
        try {
            lastLocalSaveError.value = ''
            preprocessBeforeSave(studentStateToSave)
            const stateForSave = cloneAsPlainObject(studentStateToSave)
            const payload = JSON.stringify({ schemaVersion: 2, data: stateForSave })
            await localforage.setItem('StudentData', payload)
            debugLog('数据已保存到本地存储')
            return true
        } catch (error) {
            lastLocalSaveError.value = mapLocalSaveErrorMessage(error)
            debugError('保存数据失败:', error)
            return false
        } finally {
            dataIsProcessing.value = false
        }
    }

    const next = saveInFlight.then(run, run)
    saveInFlight = next.then(
        () => true,
        () => true,
    )
    return next
}

// 监听数据变化
const scheduleSave = () => {
    cancelScheduledSave()
    saveDebounceTimer = setTimeout(() => {
        void saveDataToLocal(studentFormState.value)
        saveDebounceTimer = null
    }, 800)
}

watch(
    studentFormState,
    () => {
        if (suspendAutoSave.value) return
        if (
            !exportFinalizeInProgress.value &&
            studentFormState.value?.time?.exportFinalized?.value
        ) {
            studentFormState.value.time.exportFinalized = {
                value: false,
                version: EXPORT_FINALIZED_VERSION,
                at: Date.now(),
            }
        }
        scheduleSave()
    },
    { deep: true, flush: 'post' },
)

// 一键还原
const resetToInitial = async () => {
    debugLog('开始一键还原...')
    const serverConfigValue = await ensureServerConfig()
    await resetStudentState({
        year: serverConfigValue?.year ?? '',
        semester: serverConfigValue?.semester ?? '',
        notifyMessage: '已还原为初始状态',
        notifyType: 'success',
    })
}

// 导出个人材料
const exportPersonalMaterial = async () => {
    try {
        debugLog('开始导出流程...')

        // 1. 先进行保存操作 (包含保存预处理)
        // 注意：saveDataToLocal 是异步的，这里手动调用以确保顺序
        // await saveDataToLocal(data.value)
        if (dataIsProcessing.value) {
            showNotify({
                message: '数据正在处理中，请稍后重试',
                duration: 3000,
                position: 'top',
                type: 'danger',
            })
            return
        }

        const serverConfigValue = await ensureServerConfig()
        const semesterRaw =
            studentFormState.value?.data?.personal?.['学期']?.data ?? serverConfigValue?.semester
        const encryptionReady = Boolean(
            serverConfigValue?.encryption?.enabled &&
            serverConfigValue?.encryption?.rsaPublicKeyJwk,
        )
        if (!encryptionReady) {
            showNotify({
                message: '导出失败：服务器未配置公钥或未启用加密',
                duration: 3000,
                position: 'top',
                type: 'danger',
            })
            return
        }

        // 2. 检查是否有需要证明材料但未上传的项目
        const itemsMissingEvidenceFiles = []

        // 遍历 dyf 结构: dyf -> type -> category -> items array
        if (studentFormState.value.data && studentFormState.value.data.dyf) {
            Object.values(studentFormState.value.data.dyf).forEach((typeObj) => {
                if (typeObj && typeof typeObj === 'object') {
                    Object.values(typeObj).forEach((categoryItems) => {
                        if (Array.isArray(categoryItems)) {
                            categoryItems.forEach((item) => {
                                if (
                                    item &&
                                    typeof item === 'object' &&
                                    item.score != 0 &&
                                    item.support &&
                                    item.support.need === true &&
                                    (!item.support.files || item.support.files.length === 0)
                                ) {
                                    itemsMissingEvidenceFiles.push(item)
                                }
                            })
                        }
                    })
                }
            })
        }

        // 如果有缺少证明材料的项目，显示错误提示并中断导出
        if (itemsMissingEvidenceFiles.length > 0) {
            debugError('导出失败：有得分项目未上传证明材料', itemsMissingEvidenceFiles)
            showNotify({
                message: '导出失败：有得分项目未上传证明材料',
                duration: 3000,
                position: 'top',
                type: 'danger',
            })
            return
        }

        const finalizedMarker = studentFormState.value?.time?.exportFinalized
        if (
            finalizedMarker?.value !== true ||
            finalizedMarker?.version !== EXPORT_FINALIZED_VERSION
        ) {
            showNotify({
                message: '请先完成分数总览确认',
                duration: 3000,
                position: 'top',
                type: 'warning',
            })
            return
        }

        let exportMessage = '已尝试下载，请检查浏览器'
        let exportType = 'success'

        if (String(semesterRaw ?? '').trim() === '0') {
            exportMessage += '\n当前导出数据为测试学期记录'
            exportType = 'warning'
        }

        // 4. 二次预处理 (深拷贝，移除属性)
        const finalData = buildExportPayload(studentFormState.value)

        // 5. 导出文件
        const serializedData = await createDyfText({
            type: 'student',
            payload: finalData,
            serverConfig: serverConfigValue,
        })
        const fileName = `${studentFormState.value.data.personal['姓名'].data}_德育分材料_${new Date().toJSON()}.dyf`

        const blob = new File([serializedData], fileName, { type: 'application/json' })
        saveAs(blob, fileName)

        showNotify({
            message: exportMessage,
            duration: 5000,
            position: 'top',
            type: exportType,
        })

        debugLog('导出完成')
    } catch (error) {
        debugError('导出个人材料失败:', error)
        debugLog('导出数据:', toRaw(studentFormState.value))
        const rawMessage = typeof error?.message === 'string' ? error.message : ''
        let message = '导出失败，请重试'
        if (rawMessage.includes('NotSupportedError')) {
            message = '导出失败：当前浏览器不支持加密导出，请更换浏览器'
        } else if (rawMessage.includes('NotAllowedError') || rawMessage.includes('SecurityError')) {
            message = '导出失败：浏览器安全限制导致导出失败，请更换浏览器重试'
        } else if (rawMessage && rawMessage.length <= 60) {
            message = `导出失败：${rawMessage}`
        }
        showNotify({
            message,
            duration: 3000,
            position: 'top',
            type: 'danger',
        })
    }
}

const collectExportScorePreviewRows = (state) => {
    const dyf = state?.data?.dyf
    const rows = []

    if (dyf && typeof dyf === 'object') {
        for (const categoryName of Object.keys(dyf)) {
            const groups = dyf[categoryName]
            if (!Array.isArray(groups)) continue
            for (const group of groups) {
                if (!Array.isArray(group)) continue
                for (const item of group) {
                    const score = Number(item?.score ?? 0)
                    if (!Number.isFinite(score) || score === 0) continue
                    rows.push({
                        categoryName,
                        number: item?.number ?? '',
                        score: Number(score.toFixed(2)),
                    })
                }
            }
        }
    }
    return rows
}

const buildExportScorePreview = async () => {
    exportFinalizeInProgress.value = true
    try {
        lastLocalSaveError.value = ''
        const { changed } = preprocessBeforeExport(studentFormState.value)
        if (!studentFormState.value.time || typeof studentFormState.value.time !== 'object') {
            studentFormState.value.time = {}
        }
        studentFormState.value.time.exportFinalized = {
            value: true,
            version: EXPORT_FINALIZED_VERSION,
            at: Date.now(),
        }
        const savedOk = await saveDataToLocal(studentFormState.value)
        if (!savedOk) {
            if (!lastLocalSaveError.value) {
                lastLocalSaveError.value = '本地保存失败，请稍后重试'
            }
            return false
        }

        const rows = collectExportScorePreviewRows(studentFormState.value)
        const totalScoreConfig = resolveTotalScoreConfig(serverConfig.value)
        const detailList = rows.map((row) => ({
            categoryCode: row.categoryName,
            itemNumber: row.number,
            score: row.score,
        }))

        exportScorePreviewRows.value = rows
        exportScorePreviewTotal.value = calculateTotalScore(
            detailList,
            totalScoreConfig.penaltyCategoryCodes,
            totalScoreConfig.negativeItemNumbers,
        )
        exportScorePreviewChanged.value = changed
        return true
    } catch (error) {
        if (!lastLocalSaveError.value) {
            lastLocalSaveError.value = mapLocalSaveErrorMessage(error)
        }
        return false
    } finally {
        await nextTick()
        exportFinalizeInProgress.value = false
    }
}

const onExportSubmit = async () => {
    if (exportConfirmOpen.value || exportScorePreviewOpen.value || exportInFlight.value) return
    if (dataIsProcessing.value) {
        showNotify({
            message: '数据正在处理中，请稍后重试',
            duration: 3000,
            position: 'top',
            type: 'danger',
        })
        return
    }
    exportConfirmOpen.value = true
}

const beforeExportDialogClose = async (action) => {
    if (action === 'confirm') {
        const previewReady = await buildExportScorePreview()
        if (!previewReady) {
            showNotify({
                message: `分数标准化失败：${lastLocalSaveError.value || '请重试'}`,
                duration: 3000,
                position: 'top',
                type: 'danger',
            })
            return false
        }
        await nextTick()
        exportScorePreviewOpen.value = true
    }
    return true
}

const beforeExportScorePreviewClose = async (action) => {
    if (action === 'confirm') {
        if (exportInFlight.value) return false
        exportInFlight.value = true
        showLoadingToast({
            message: '导出中...',
            forbidClick: true,
            duration: 0,
        })
        try {
            await exportPersonalMaterial()
        } finally {
            closeToast()
            exportInFlight.value = false
        }
    }
    return true
}

// 表单验证失败
const onFailed = (errors) => {
    debugLog('表单验证失败:', errors)
    showNotify({
        message: '导出失败，请检查填写内容',
        duration: 3000,
        position: 'top',
        type: 'danger',
    })
}

const dialogFeedbackCancel = () => {
    window.open('https://txc.qq.com/products/799027', '_blank')
}
</script>

<template>
    <div class="student-mobile-layout">
        <header>
            <van-nav-bar
                title="学生德育分管理系统"
                :right-text="configSyncState.failed ? '重试同步' : ''"
                @click-right="retryConfigSync"
            />
        </header>
        <main>
            <van-notice-bar
                v-if="getUrlParam('pc') != 'true' && isWechatBrowser"
                wrapable
                mode="closeable"
                :scrollable="false"
                text="您正在使用微信浏览器访问，由于微信浏览器的限制，无法导出个人材料，请使用其他浏览器访问。"
            />
            <h1 style="margin-top: 1em">学生申请</h1>
            <van-form
                @failed="onFailed"
                @submit="onExportSubmit"
                required="auto"
                scroll-to-error="true"
            >
                <h2>基本信息</h2>
                <van-cell-group inset style="margin-bottom: 20px">
                    <template v-for="(field, index) in studentFormState.data.personal" :key="index">
                        <van-field
                            v-if="field.type != 'cascader'"
                            v-model="field.data"
                            :name="field.name"
                            :label="index"
                            :placeholder="field.placeholder"
                            :type="field.type"
                            :disabled="field.disabled"
                            :rules="[
                                { required: field.required, message: '请填写' + index },
                                ...normalizeVantRules(field.pattern),
                            ]"
                        />
                        <template v-else-if="field.type == 'cascader'">
                            <van-field
                                v-model="field.data"
                                is-link
                                readonly
                                :label="index"
                                :name="field.name"
                                :placeholder="field.placeholder"
                                @click="field.cascader.show = true"
                                :rules="[
                                    { required: field.required, message: '请填写' + index },
                                    ...normalizeVantRules(field.pattern),
                                ]"
                            />
                            <van-popup v-model:show="field.cascader.show" round position="bottom">
                                <van-cascader
                                    v-model="field.cascader.data"
                                    :title="field.cascader.title"
                                    :options="field.cascader.options"
                                    @close="field.cascader.show = false"
                                    @finish="
                                        (payload) =>
                                            onCascaderFinish(
                                                index,
                                                {
                                                    field: field,
                                                    studentFormState: studentFormState,
                                                },
                                                payload,
                                            )
                                    "
                                >
                                    <template #options-top="{ tabIndex }">
                                        <div class="current-level">
                                            请选择 {{ field.cascader.titles[tabIndex] }}
                                        </div>
                                    </template>
                                </van-cascader>
                            </van-popup>
                        </template>
                    </template>
                </van-cell-group>
                <div v-for="section in visibleDyfSections" :key="section.categoryName">
                    <div style="margin-bottom: 20px">
                        <h2>
                            {{ formatCategoryTitleText(section.categoryName) }}
                        </h2>
                        <van-cell-group
                            inset
                            v-for="group in section.groups"
                            :key="group.groupIndex"
                            style="margin-bottom: 20px"
                        >
                            <div v-for="item in group.items" :key="item.number">
                                <van-cell
                                    :title="formatItemNumberText(item.number, section.categoryName)"
                                    :label="item.description"
                                    :value="item.score"
                                    center
                                >
                                    <template #value>
                                        <van-stepper
                                            v-if="item.score_type.type === 'stepper'"
                                            theme="round"
                                            v-model="item.score"
                                            :min="item.score_type.min"
                                            :max="item.score_type.max"
                                            :step="item.score_type.step"
                                            :decimal-length="item.score_type['decimal-length']"
                                        />
                                        <div
                                            v-if="item.score_type.type === 'radio'"
                                            class="radio-div"
                                        >
                                            <van-radio-group v-model="item.score">
                                                <van-radio
                                                    v-for="(radio, index) in item.score_type
                                                        .options"
                                                    :key="index"
                                                    :name="radio"
                                                    >{{ index }}</van-radio
                                                >
                                            </van-radio-group>
                                        </div>
                                    </template>
                                </van-cell>
                                <van-cell
                                    v-if="item.support.need && item.score != 0"
                                    :title="formatEvidenceTitle(item.number, section.categoryName)"
                                    :label="item.support.message"
                                    center
                                >
                                    <template #value>
                                        <van-uploader
                                            v-model="item.support.files"
                                            preview-size="18vw"
                                            :before-read="beforeUploaderRead"
                                        />
                                    </template>
                                </van-cell>
                            </div>
                        </van-cell-group>
                    </div>
                </div>
                <div style="margin: 16px">
                    <van-button
                        round
                        block
                        type="primary"
                        native-type="submit"
                        :loading="exportInFlight"
                        :disabled="exportInFlight"
                        style="margin-bottom: 10px"
                    >
                        导出个人材料
                    </van-button>
                    <van-button round block type="default" @click="resetToInitial">
                        还原初始状态
                    </van-button>
                </div>
            </van-form>
            <van-dialog
                v-model:show="exportConfirmOpen"
                title="导出前确认"
                :message="EXPORT_CONFIRM_MESSAGE"
                message-align="center"
                show-cancel-button
                confirm-button-text="确认导出"
                cancel-button-text="取消"
                :close-on-click-overlay="!exportInFlight"
                :confirm-button-disabled="exportInFlight"
                :cancel-button-disabled="exportInFlight"
                :before-close="beforeExportDialogClose"
            >
                <template #title>
                    <span>导出确认</span>
                </template>
                <template #default>
                    <div
                        class="van-dialog__message van-dialog__message--has-title"
                        style="
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 0.2em;
                        "
                    >
                        <span
                            >班级管理端每学期<strong>每名学生</strong>仅能<strong
                                >导入一次</strong
                            ></span
                        >
                        <span>请再次确认：</span>
                        <span style="color: var(--van-danger-color)"
                            ><strong>信息是否完全正确</strong></span
                        >
                        <span style="color: var(--van-danger-color)"
                            ><strong>分数是否全部申请</strong></span
                        >
                        <span style="color: var(--van-danger-color)"
                            ><strong>证明材料是否完整且正确</strong></span
                        >
                        请确认无误后再导出并发送给班级管理员
                    </div>
                </template>
            </van-dialog>
            <van-dialog
                v-model:show="exportScorePreviewOpen"
                title="导出分数总览"
                show-cancel-button
                confirm-button-text="确认导出"
                cancel-button-text="返回修改"
                :close-on-click-overlay="!exportInFlight"
                :confirm-button-disabled="exportInFlight"
                :cancel-button-disabled="exportInFlight"
                :before-close="beforeExportScorePreviewClose"
            >
                <template #default>
                    <div class="export-score-preview">
                        <div class="export-score-preview__total">
                            总分：<span style="color: var(--van-primary-color)">{{
                                exportScorePreviewTotal
                            }}</span>
                        </div>
                        <div v-if="exportScorePreviewChanged" class="export-score-preview__tip">
                            担任多个学生干部职务的，按最高职务赋分，不累计赋分<br />
                            学干培养分数已标准化，可直接导出
                        </div>
                        <div
                            v-if="exportScorePreviewRows.length > 0"
                            class="export-score-preview__list"
                        >
                            <div class="export-score-preview__header">
                                <span>项目</span>
                                <span>类别</span>
                                <span>单项分</span>
                            </div>
                            <div
                                v-for="(row, index) in exportScorePreviewRows"
                                :key="`${row.categoryName}-${row.number}-${index}`"
                                class="export-score-preview__row"
                            >
                                <span>{{
                                    formatItemNumberText(row.number, row.categoryName)
                                }}</span>
                                <span>{{ formatCategoryTitleText(row.categoryName) }}</span>
                                <span>{{ row.score }}</span>
                            </div>
                        </div>
                        <div v-else class="export-score-preview__empty">当前暂无已申请分数项目</div>
                    </div>
                </template>
            </van-dialog>
        </main>
        <footer>
            <div style="height: 40px; display: flex; align-items: center; justify-content: center">
                <p><span style="font-size: 10px">Powered by </span>H</p>
                <p class="separator">|</p>
                <a id="version">V {{ VERSION }}</a>
                <p class="separator">|</p>
                <!-- <p>
                    <a href="https://txc.qq.com/products/799027" target="_blank"> 问题反馈 </a>
                </p> -->
                <p>
                    <a @click="dialogFeedback = true"> 问题反馈 </a>
                </p>
                <van-dialog
                    id="feedbackdialog"
                    v-model:show="dialogFeedback"
                    title="问题反馈"
                    :showCancelButton="true"
                    :cancel-button-text="FEEDBACK_CANCEL_MESSAGE"
                    style="font-weight: normal"
                    @cancel="dialogFeedbackCancel"
                >
                    <div
                        class="van-dialog__message van-dialog__message--has-title"
                        style="font-weight: normal; padding-bottom: 0"
                    >
                        您可以截图或长摁保存图片<br />
                        使用微信扫一扫打开小程序进行反馈<br />
                        小程序内可能出现广告，请自行甄别
                    </div>
                    <van-image style="padding: 1em 0.5em" :src="feedbackImg" />
                </van-dialog>
                <p class="separator">|</p>
                <p>
                    <a href="https://txc.qq.com/products/799027" target="_blank">
                        <RouterLink to="/thanks"> 致谢名单 </RouterLink>
                    </a>
                </p>
            </div>
        </footer>
    </div>
</template>

<style scoped>
.student-mobile-layout {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

main {
    height: calc(100% - 46px);
    overflow: hidden;
    overflow-y: auto;
    padding-bottom: 1em;
}

h1,
h2 {
    margin: 0 30px;
}

h1 {
    color: var(--van-doc-text-color-1);
    font-size: 20px;
    font-weight: bold;
}

h2 {
    color: var(--van-doc-text-color-4);
    font-size: 14px;
    font-weight: 400;
    padding: 0.7em 0;
}

.radio-div {
    display: flex;
    flex-direction: column;
    align-items: end;
}

.radio-div > .van-radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
}

.export-score-preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.export-score-preview__total {
    font-size: 16px;
    font-weight: 600;
    text-align: center;
}

.export-score-preview__tip {
    color: var(--van-warning-color);
    font-size: 12px;
    text-align: center;
}

.export-score-preview__list {
    max-height: 36vh;
    overflow-y: auto;
    border: 1px solid var(--van-border-color);
    border-radius: 8px;
}

.export-score-preview__header,
.export-score-preview__row {
    display: grid;
    grid-template-columns: 72px 1fr 72px;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    font-size: 13px;
}

.export-score-preview__header {
    position: sticky;
    top: 0;
    background: var(--van-background-2);
    font-weight: 600;
}

.export-score-preview__row + .export-score-preview__row {
    border-top: 1px solid var(--van-border-color);
}

.export-score-preview__empty {
    color: var(--van-text-color-2);
    text-align: center;
    padding: 12px 0;
}

footer {
    align-items: center;
    font-weight: bold;
    font-size: small;
}

footer a {
    color: currentColor;
}

p.separator {
    margin: 0 0.5em;
}

.current-level {
    font-size: 14px;
    padding: 16px 16px 0;
    color: var(--van-gray-6);
}

:deep(#feedbackdialog .van-dialog__cancel .van-button__text) {
    font-size: 14px;
    white-space: pre-line;
}
</style>
