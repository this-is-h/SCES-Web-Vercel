import { saveAs } from 'file-saver'
import { createLogger } from '@/utils/logger'

const log = createLogger('excel')

let excelJsPromise = null
const loadExcelJs = () => {
    if (!excelJsPromise) {
        excelJsPromise = import('exceljs')
            .then((mod) => mod?.default ?? mod)
            .catch((e) => {
                log.error('exceljs 加载失败', e)
                excelJsPromise = null
                throw new Error('EXCELJS_LOAD_FAILED')
            })
    }
    return excelJsPromise
}

const getPersonalKeysFromConfig = (studentConfig) => {
    const personal = studentConfig?.data?.personal
    if (!personal || typeof personal !== 'object') return []
    return Object.keys(personal)
}

const buildDyfIndex = (studentConfig) => {
    const dyf = studentConfig?.data?.dyf
    const categoryToNumbers = new Map()
    const allNumbers = new Set()
    if (!dyf || typeof dyf !== 'object') return { dyf: null, categoryToNumbers, allNumbers }

    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        const numbers = []
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const num = item?.number
                if (num == null) continue
                numbers.push(num)
                allNumbers.add(num)
            }
        }
        categoryToNumbers.set(categoryName, numbers)
    }

    return { dyf, categoryToNumbers, allNumbers }
}

const resolveExportCategories = (studentConfig, categories) => {
    const dyf = studentConfig?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return []
    const allowedList = Object.keys(dyf)
    const allowedSet = new Set(allowedList)
    if (Array.isArray(categories) && categories.length) {
        return categories.filter((c) => allowedSet.has(c))
    }
    return allowedList
}

const getPersonalCellWidth = (key) => {
    const labelText = String(key || '')
    const base = Math.max(10, Math.ceil(labelText.length * 2.2))
    return Math.min(28, base)
}

const getStudentPersonalValue = (student, key) => {
    const personal = student?.data?.personal
    const personalValue = personal?.[key]?.data
    if (personalValue == null) return ''
    if (typeof personalValue === 'object') {
        const optionValue = personalValue.value ?? personalValue.label
        return optionValue != null ? String(optionValue) : ''
    }
    return String(personalValue)
}

export const getCategorySumHeader = (categoryName) => {
    const s = String(categoryName || '')
    return s.endsWith('分') ? `${s}总和` : `${s}分总和`
}

export const buildDyfCategoryItems = (studentConfig) => {
    const dyf = studentConfig?.data?.dyf
    const categories = []
    if (!dyf || typeof dyf !== 'object') return categories

    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        const items = []
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                if (item?.number == null) continue
                items.push({ number: item.number, description: item.description })
            }
        }
        categories.push({ categoryName, items })
    }
    return categories
}

const buildStudentScoreMap = (student, categories) => {
    const map = new Map()
    const dyf = student?.data?.dyf
    if (!dyf || typeof dyf !== 'object') return map

    for (const categoryName of categories) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const num = item?.number
                if (num == null) continue
                const raw = Number(item?.score ?? 0)
                map.set(num, Number.isFinite(raw) ? raw : 0)
            }
        }
    }

    return map
}

const buildSheet = (workbook, { sheetName, students, categories, studentConfig, dyfIndex }) => {
    const worksheet = workbook.addWorksheet(sheetName)
    worksheet.views = [{ state: 'frozen', ySplit: 2 }]

    const personalKeys = getPersonalKeysFromConfig(studentConfig)
    const exportCategories = resolveExportCategories(studentConfig, categories)

    const columns = []
    columns.push({ kind: 'seq', header: '序号', mergeV: true, width: 8 })
    for (const key of personalKeys) {
        columns.push({
            kind: 'personal',
            personalKey: key,
            header: key,
            mergeV: true,
            width: getPersonalCellWidth(key),
        })
    }

    const categoryItemRanges = new Map()
    for (const categoryName of exportCategories) {
        const numbers = dyfIndex.categoryToNumbers.get(categoryName) || []
        let start = -1
        let end = -1
        for (const num of numbers) {
            const colIndex = columns.length + 1
            if (start === -1) start = colIndex
            end = colIndex
            columns.push({
                kind: 'item',
                category: categoryName,
                number: num,
                r1: categoryName,
                r2: String(num),
                mergeV: false,
                width: 10,
            })
        }
        if (start !== -1 && end !== -1) categoryItemRanges.set(categoryName, { start, end })

        columns.push({
            kind: 'sum',
            category: categoryName,
            header: getCategorySumHeader(categoryName),
            mergeV: true,
            width: 12,
            numFmt: '0.00',
        })
    }

    columns.push({ kind: 'total', header: '总分', mergeV: true, width: 10, numFmt: '0.00' })

    worksheet.columns = columns.map((colSpec) => ({ width: colSpec.width }))

    const row1 = new Array(columns.length).fill(null)
    const row2 = new Array(columns.length).fill(null)
    for (let i = 0; i < columns.length; i++) {
        const colSpec = columns[i]
        if (colSpec.kind === 'item') {
            row1[i] = colSpec.r1
            row2[i] = colSpec.r2
        } else {
            row1[i] = colSpec.header
            row2[i] = null
        }
    }

    for (const { start, end } of categoryItemRanges.values()) {
        for (let col = start + 1; col <= end; col++) row1[col - 1] = null
    }

    worksheet.addRow(row1)
    worksheet.addRow(row2)

    const r1 = worksheet.getRow(1)
    const r2 = worksheet.getRow(2)
    r1.height = 26
    r2.height = 20
    r1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    r2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    r1.font = { bold: true }
    r2.font = { bold: true }

    for (let col = 1; col <= columns.length; col++) {
        const colSpec = columns[col - 1]
        if (colSpec.mergeV) worksheet.mergeCells(1, col, 2, col)
        if (colSpec.numFmt) worksheet.getColumn(col).numFmt = colSpec.numFmt
    }

    for (const { start, end } of categoryItemRanges.values()) {
        if (end > start) worksheet.mergeCells(1, start, 1, end)
    }

    const studentRows = []
    for (const stu of students || []) {
        const scoreMap = buildStudentScoreMap(stu, exportCategories)
        const categoryTotals = new Map()
        let grandTotal = 0
        for (const categoryName of exportCategories) {
            const nums = dyfIndex.categoryToNumbers.get(categoryName) || []
            let subtotal = 0
            for (const num of nums) subtotal += scoreMap.get(num) ?? 0
            const fixed = Number(subtotal.toFixed(2))
            categoryTotals.set(categoryName, fixed)
            grandTotal += fixed
        }
        studentRows.push({
            student: stu,
            scoreMap,
            categoryTotals,
            grandTotal: Number(grandTotal.toFixed(2)),
        })
    }
    studentRows.sort((a, b) => b.grandTotal - a.grandTotal)

    const dataRows = []
    for (let idx = 0; idx < studentRows.length; idx++) {
        const { student: stu, scoreMap, categoryTotals, grandTotal } = studentRows[idx]
        const values = new Array(columns.length).fill(null)
        let col = 0
        values[col++] = idx + 1

        for (const key of personalKeys) {
            values[col++] = getStudentPersonalValue(stu, key)
        }

        for (const categoryName of exportCategories) {
            const nums = dyfIndex.categoryToNumbers.get(categoryName) || []
            for (const num of nums) {
                const rawScore = Number(scoreMap.get(num) ?? 0)
                const score = Number.isFinite(rawScore) ? rawScore : 0
                values[col++] = score
            }
            values[col++] = categoryTotals.get(categoryName) ?? 0
        }
        values[col++] = grandTotal

        dataRows.push(values)
    }

    if (dataRows.length) worksheet.addRows(dataRows)
    return worksheet
}

export const exportStudentScoresXlsx = async ({ filename, sheets, studentConfig }) => {
    const buffer = await buildStudentScoresXlsxBuffer({ sheets, studentConfig })
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, filename)
}

export const buildStudentScoresXlsxBuffer = async ({ sheets, studentConfig }) => {
    const ExcelJS = await loadExcelJs()
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'DYS'
    workbook.created = new Date()

    const dyfIndex = buildDyfIndex(studentConfig)
    for (const sheetSpec of sheets || []) {
        buildSheet(workbook, {
            sheetName: sheetSpec?.name || 'Sheet1',
            students: sheetSpec?.students || [],
            categories: sheetSpec?.categories || [],
            studentConfig,
            dyfIndex,
        })
    }

    return workbook.xlsx.writeBuffer()
}
