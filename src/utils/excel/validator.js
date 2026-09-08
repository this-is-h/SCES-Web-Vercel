import { createLogger } from '../logger.js'

const log = createLogger('excel.validator')

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

const toNumber = (value, fallback = 0) => {
    const raw = normalizeCellValue(value)
    if (raw == null || raw === '') return fallback
    const num = Number.parseFloat(String(raw).replace(/[，,]/g, '').trim())
    return Number.isFinite(num) ? num : fallback
}

const stableJson = (value) => JSON.stringify(value)

const digestSha256 = async (text) => {
    const payload = new TextEncoder().encode(String(text || ''))
    if (typeof crypto !== 'undefined' && crypto?.subtle) {
        const hash = await crypto.subtle.digest('SHA-256', payload)
        return Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
    }
    const nodeCrypto = await import('node:crypto')
    return nodeCrypto.createHash('sha256').update(Buffer.from(payload)).digest('hex')
}

const callAppendOperationLog = async (payload) => {
    try {
        const mod = await import('../operationLog.js')
        if (typeof mod?.appendOperationLog === 'function') {
            await mod.appendOperationLog(payload)
        }
    } catch (e) {
        log.warn('操作日志模块不可用', e)
    }
}

const extractDataRangeRows = (worksheet, idCol, dataStartRow) => {
    const last = worksheet.lastRow?.number || worksheet.rowCount || dataStartRow
    const rows = []
    for (let r = dataStartRow; r <= last; r++) {
        const idValue = normalizeText(worksheet.getRow(r).getCell(idCol).value)
        if (!idValue) continue
        rows.push(r)
    }
    return rows
}

export const computeSheetChecksum = async ({
    worksheet,
    dataRows,
    maxCol,
    formulaCols = new Set(),
}) => {
    const list = []
    for (const rowIndex of dataRows) {
        const row = worksheet.getRow(rowIndex)
        const line = []
        for (let col = 1; col <= maxCol; col++) {
            if (formulaCols.has(col)) continue
            line.push(normalizeCellValue(row.getCell(col).value))
        }
        list.push(line)
    }
    return await digestSha256(stableJson(list))
}

export const readChecksumMetaSheet = (workbook) => {
    const sheet = workbook.getWorksheet('__checksum__')
    if (!sheet) return null
    const meta = {}
    const last = sheet.lastRow?.number || sheet.rowCount || 0
    for (let r = 1; r <= last; r++) {
        const key = normalizeText(sheet.getRow(r).getCell(1).value)
        const value = normalizeText(sheet.getRow(r).getCell(2).value)
        if (!key) continue
        meta[key] = value
    }
    return meta
}

export const writeChecksumMetaSheet = ({ workbook, payload }) => {
    let sheet = workbook.getWorksheet('__checksum__')
    if (!sheet) sheet = workbook.addWorksheet('__checksum__', { state: 'hidden' })
    sheet.state = 'hidden'
    const lines = Object.entries(payload || {})
    sheet.spliceRows(1, sheet.rowCount || 0)
    lines.forEach(([key, value], idx) => {
        sheet.getRow(idx + 1).getCell(1).value = key
        sheet.getRow(idx + 1).getCell(2).value = String(value ?? '')
    })
}

export const validateRequiredColumns = ({ sheetName, mapping, requiredKeys }) => {
    const missing = []
    for (const key of requiredKeys || []) {
        if (!mapping?.[key]) missing.push(key)
    }
    if (missing.length) {
        return {
            ok: false,
            message: `${sheetName}缺少必要字段: ${missing.join('、')}`,
            missing,
        }
    }
    return { ok: true, missing: [] }
}

export const validateUniqueStudentIds = ({ worksheet, idCol, dataStartRow }) => {
    const seen = new Map()
    const errors = []
    const rows = extractDataRangeRows(worksheet, idCol, dataStartRow)
    for (const rowIndex of rows) {
        const id = normalizeText(worksheet.getRow(rowIndex).getCell(idCol).value)
        if (!id) {
            errors.push({ rowIndex, colIndex: idCol, message: '学号缺失' })
            continue
        }
        if (seen.has(id)) {
            errors.push({
                rowIndex,
                colIndex: idCol,
                message: `学号重复，首次出现于第 ${seen.get(id)} 行`,
            })
            continue
        }
        seen.set(id, rowIndex)
    }
    return { ok: errors.length === 0, rows, errors }
}

export const recalculateRowTotals = ({ scoreMap }) => {
    const base = toNumber(scoreMap?.基础分, 0)
    const reward = toNumber(scoreMap?.奖励分, 0)
    const punish = toNumber(scoreMap?.惩罚分, 0)
    const n8881 = toNumber(scoreMap?.['8881'], 0)
    const n8882 = toNumber(scoreMap?.['8882'], 0)
    const special = n8881 - n8882
    const total = base + reward - punish + special
    return {
        基础分: Number(base.toFixed(2)),
        奖励分: Number(reward.toFixed(2)),
        惩罚分: Number(punish.toFixed(2)),
        第八项第三条总和: Number(special.toFixed(2)),
        总分: Number(total.toFixed(2)),
    }
}

export const validateFormulaDiff = ({ actual, expected, threshold = 0.01 }) => {
    const a = toNumber(actual, 0)
    const b = toNumber(expected, 0)
    return Math.abs(a - b) <= threshold
}

export const markErrorRow = (worksheet, rowIndex, maxCol) => {
    for (let c = 1; c <= maxCol; c++) {
        const cell = worksheet.getRow(rowIndex).getCell(c)
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC7CE' },
        }
    }
}

export const appendTemplateChangeLog = async ({
    scope = 'grade',
    changed = [],
    unmappedColumns = [],
    strategy = '自动重建字段映射并保持导入导出兼容',
}) => {
    if (!changed.length && !unmappedColumns.length) return
    try {
        await callAppendOperationLog({
            scope,
            entry: {
                type: 'excel_template_mapping_changed',
                changed,
                unmappedColumns,
                strategy,
            },
        })
    } catch (e) {
        log.warn('写入模板变更日志失败', e)
    }
}

export const extractCellNumber = (worksheet, rowIndex, colIndex) =>
    toNumber(worksheet.getRow(rowIndex).getCell(colIndex).value, 0)
