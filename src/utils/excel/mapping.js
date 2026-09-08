import { createLogger } from '../logger.js'

const log = createLogger('excel.mapping')

const REQUIRED_SHEETS = ['总表', '基础分分表']
const TEMPLATE_PATH = '/example.xlsx'
const HEADER_SCAN_LIMIT = 20

let excelJsPromise = null
let mappingCache = null

const loadExcelJs = async () => {
    if (!excelJsPromise) {
        excelJsPromise = import('exceljs').then((mod) => mod?.default ?? mod)
    }
    return excelJsPromise
}

const normalizeText = (value) =>
    String(value == null ? '' : value)
        .replace(/\s+/g, '')
        .trim()

const normalizeCellValue = (value) => {
    if (value == null) return ''
    if (typeof value !== 'object') return value
    if (typeof value.text === 'string') return value.text
    if (Array.isArray(value.richText)) return value.richText.map((x) => x.text || '').join('')
    if (value.result != null) return value.result
    return ''
}

const collectDyfNumbers = (studentConfig) => {
    const dyf = studentConfig?.data?.dyf
    const numberSet = new Set()
    const categoryNumbers = new Map()
    if (!dyf || typeof dyf !== 'object') return { numberSet, categoryNumbers }
    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        const list = []
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const num = Number(item?.number)
                if (!Number.isFinite(num)) continue
                list.push(num)
                numberSet.add(num)
            }
        }
        categoryNumbers.set(categoryName, list)
    }
    return { numberSet, categoryNumbers }
}

const getPersonalKeys = (studentConfig) => {
    const personal = studentConfig?.data?.personal
    if (!personal || typeof personal !== 'object') return []
    return Object.keys(personal)
}

const getWorksheetMerges = (worksheet) => {
    const merges = Array.isArray(worksheet?.model?.merges) ? worksheet.model.merges : []
    return merges.slice().sort((a, b) => String(a).localeCompare(String(b)))
}

const extractHeader = (worksheet, studentConfig) => {
    const personalKeys = new Set(getPersonalKeys(studentConfig))
    const dyf = collectDyfNumbers(studentConfig)
    const maxColumns = Math.max(worksheet.actualColumnCount || 0, worksheet.columnCount || 0, 1)
    const merges = getWorksheetMerges(worksheet)
    let bestRow = 1
    let bestScore = -1
    const headerRowCandidates = []
    const matrix = []
    for (let row = 1; row <= HEADER_SCAN_LIMIT; row++) {
        const line = []
        let score = 0
        let hasSeq = false
        let hasId = false
        for (let col = 1; col <= maxColumns; col++) {
            const raw = normalizeCellValue(worksheet.getRow(row).getCell(col).value)
            line.push(raw)
            const text = normalizeText(raw)
            if (!text) continue
            if (text === '序号') hasSeq = true
            if (text.includes('学号')) hasId = true
            if (personalKeys.has(text)) score += 2
            const num = Number.parseInt(text, 10)
            if (Number.isFinite(num) && dyf.numberSet.has(num)) score += 2
            if (text.includes('学号') || text.includes('姓名') || text.includes('班级')) score += 1
        }
        matrix.push(line)
        if (hasSeq && hasId) headerRowCandidates.push(row)
        if (score > bestScore) {
            bestScore = score
            bestRow = row
        }
    }
    if (headerRowCandidates.length) {
        bestRow = Math.max(...headerRowCandidates)
    }
    const headerRows = matrix.slice(0, bestRow)
    const expanded = headerRows.map((row) => row.map((x) => normalizeCellValue(x)))
    for (const merge of merges) {
        const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(merge)
        if (!match) continue
        const [, c1, r1, c2, r2] = match
        const rowStart = Number(r1)
        const rowEnd = Number(r2)
        if (rowStart > bestRow || rowEnd < 1) continue
        const colStart = colNameToIndex(c1)
        const colEnd = colNameToIndex(c2)
        const topValue = normalizeCellValue(worksheet.getRow(rowStart).getCell(colStart).value)
        for (let rr = Math.max(1, rowStart); rr <= Math.min(bestRow, rowEnd); rr++) {
            for (let cc = colStart; cc <= colEnd; cc++) {
                if (expanded[rr - 1]) expanded[rr - 1][cc - 1] = topValue
            }
        }
    }
    const lastRowValues = expanded[bestRow - 1] || []
    return {
        sheetName: worksheet.name,
        headerRows: expanded,
        lastHeaderRowIndex: bestRow,
        lastRowValues,
        merges,
        maxColumns,
        dyfCategoryNumbers: dyf.categoryNumbers,
    }
}

const colNameToIndex = (name) => {
    const text = String(name || '').toUpperCase()
    let n = 0
    for (let i = 0; i < text.length; i++) n = n * 26 + (text.charCodeAt(i) - 64)
    return n
}

const parseHeaderKey = ({ text, personalSet, dyfNumberSet }) => {
    const normalized = normalizeText(text)
    if (!normalized) return { key: '', cellType: 'empty' }
    if (personalSet.has(normalized)) return { key: normalized, cellType: 'personal' }
    const num = Number.parseInt(normalized, 10)
    if (Number.isFinite(num) && dyfNumberSet.has(num)) return { key: String(num), cellType: 'dyf' }
    if (normalized.includes('学号')) return { key: '学号', cellType: 'personal' }
    if (normalized.includes('姓名')) return { key: '姓名', cellType: 'personal' }
    if (normalized.includes('班级')) return { key: '班级', cellType: 'personal' }
    return { key: normalized, cellType: 'computed' }
}

const buildSheetMapping = (headerMeta, studentConfig) => {
    const personalSet = new Set(getPersonalKeys(studentConfig))
    const dyfInfo = collectDyfNumbers(studentConfig)
    const mappings = {}
    const computed = {}
    const unmappedColumns = []
    for (let col = 1; col <= headerMeta.maxColumns; col++) {
        const primary = headerMeta.lastRowValues[col - 1]
        const fallback = headerMeta.headerRows?.[0]?.[col - 1]
        const keyInfo = parseHeaderKey({
            text: primary || fallback,
            personalSet,
            dyfNumberSet: dyfInfo.numberSet,
        })
        const value = {
            sheetName: headerMeta.sheetName,
            rowIndex: headerMeta.lastHeaderRowIndex,
            colIndex: col,
            cellType: keyInfo.cellType,
        }
        if (keyInfo.cellType === 'personal' || keyInfo.cellType === 'dyf') {
            mappings[keyInfo.key] = value
            continue
        }
        const name = normalizeText(primary || fallback)
        if (!name) continue
        computed[name] = value
        if (!name.includes('总') && !name.includes('合计') && !name.includes('序号')) {
            unmappedColumns.push({
                sheetName: headerMeta.sheetName,
                colIndex: col,
                fieldName: name,
            })
        }
    }
    return { mappings, computed, unmappedColumns }
}

const buildTemplateFingerprint = ({ headerBySheet, workbook }) => {
    const payload = {
        sheets: REQUIRED_SHEETS.map((name) => name),
        bookMerges: REQUIRED_SHEETS.map((sheetName) => ({
            sheetName,
            merges: getWorksheetMerges(workbook.getWorksheet(sheetName)),
        })),
        headers: REQUIRED_SHEETS.map((sheetName) => ({
            sheetName,
            headerRows: headerBySheet[sheetName]?.headerRows || [],
            lastHeaderRowIndex: headerBySheet[sheetName]?.lastHeaderRowIndex || 0,
        })),
    }
    return JSON.stringify(payload)
}

const sha256Hex = async (text) => {
    const data = new TextEncoder().encode(String(text || ''))
    if (typeof crypto !== 'undefined' && crypto?.subtle) {
        const hash = await crypto.subtle.digest('SHA-256', data)
        return Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
    }
    const nodeCrypto = await import('node:crypto')
    return nodeCrypto.createHash('sha256').update(Buffer.from(data)).digest('hex')
}

const loadTemplateBuffer = async (templateBuffer) => {
    if (templateBuffer) return templateBuffer
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
        const res = await fetch(TEMPLATE_PATH, { cache: 'no-store' })
        if (!res.ok) throw new Error(`读取模板失败: ${res.status}`)
        return await res.arrayBuffer()
    }
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const filePath = path.resolve(process.cwd(), 'public', 'example.xlsx')
    const file = await fs.readFile(filePath)
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
}

export const buildTemplateMapping = async ({ studentConfig, templateBuffer }) => {
    const ExcelJS = await loadExcelJs()
    const workbook = new ExcelJS.Workbook()
    const buffer = await loadTemplateBuffer(templateBuffer)
    await workbook.xlsx.load(buffer)
    for (const required of REQUIRED_SHEETS) {
        if (!workbook.getWorksheet(required)) throw new Error(`模板缺少工作表：${required}`)
    }
    const headerBySheet = {}
    const mappings = {}
    const computedBySheet = {}
    const unmappedColumns = []
    for (const sheetName of REQUIRED_SHEETS) {
        const worksheet = workbook.getWorksheet(sheetName)
        const header = extractHeader(worksheet, studentConfig)
        headerBySheet[sheetName] = header
        const sheetMapping = buildSheetMapping(header, studentConfig)
        computedBySheet[sheetName] = sheetMapping.computed
        unmappedColumns.push(...sheetMapping.unmappedColumns)
        for (const [key, value] of Object.entries(sheetMapping.mappings)) {
            const prev = mappings[key]
            if (!prev || value.sheetName === '总表') mappings[key] = value
        }
    }
    const fingerprint = buildTemplateFingerprint({ headerBySheet, workbook })
    const fingerprintHash = await sha256Hex(fingerprint)
    return {
        workbook,
        templateBuffer: buffer,
        mapping: mappings,
        computedBySheet,
        headerBySheet,
        unmappedColumns,
        fingerprint,
        fingerprintHash,
        requiredSheets: REQUIRED_SHEETS.slice(),
    }
}

const diffMappings = (prev = {}, next = {}) => {
    const changed = []
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
    for (const key of keys) {
        const before = prev[key]
        const after = next[key]
        if (!before || !after) {
            changed.push({ key, before, after })
            continue
        }
        if (
            before.sheetName !== after.sheetName ||
            before.rowIndex !== after.rowIndex ||
            before.colIndex !== after.colIndex ||
            before.cellType !== after.cellType
        ) {
            changed.push({ key, before, after })
        }
    }
    return changed
}

export const getTemplateMapping = async ({ studentConfig, templateBuffer }) => {
    const next = await buildTemplateMapping({ studentConfig, templateBuffer })
    if (!mappingCache) {
        mappingCache = next
        if (next.unmappedColumns.length) log.warn('检测到未映射列', next.unmappedColumns)
        return { ...next, fromCache: false, changed: [] }
    }
    if (mappingCache.fingerprintHash === next.fingerprintHash) {
        return {
            ...mappingCache,
            workbook: next.workbook,
            templateBuffer: next.templateBuffer,
            fromCache: true,
            changed: [],
        }
    }
    const changed = diffMappings(mappingCache.mapping, next.mapping)
    mappingCache = next
    log.warn('模板发生变化，已自动重建字段映射', {
        changedCount: changed.length,
        changed,
        unmappedColumns: next.unmappedColumns,
    })
    return { ...next, fromCache: false, changed }
}

export const clearTemplateMappingCache = () => {
    mappingCache = null
}

export const getRequiredSheetNames = () => REQUIRED_SHEETS.slice()
