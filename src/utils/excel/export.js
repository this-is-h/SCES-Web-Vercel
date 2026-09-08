import { getTemplateMapping } from './mapping.js'
import {
    appendTemplateChangeLog,
    computeSheetChecksum,
    recalculateRowTotals,
    writeChecksumMetaSheet,
} from './validator.js'
import { buildDiffFormula, buildRefFormula, buildSumFormula, buildTotalFormula } from './formula.js'

const normalizeText = (value) => String(value == null ? '' : value).trim()

const pickSemesterName = (semester) => (String(semester) === '2' ? '秋季' : '春季')

const readPersonalValue = (student, key) => {
    const personal = student?.data?.personal
    const raw = personal?.[key]?.data
    if (raw == null) return ''
    if (typeof raw === 'object') return String(raw?.value ?? raw?.label ?? '')
    return raw
}

const getStudentId = (student) => normalizeText(student?.data?.personal?.学号?.data)
const getStudentClass = (student) => normalizeText(student?.data?.personal?.班级?.data)
const getStudentGrade = (student) => normalizeText(student?.data?.personal?.年级?.data)
const getStudentMajor = (student) => normalizeText(student?.data?.personal?.专业?.data)
const getStudentCollege = (student) => normalizeText(student?.data?.personal?.学院?.data)
const getStudentClassInfo = (student) => normalizeText(student?.data?.personal?.班级信息?.data)
const getStudentYear = (student) => normalizeText(student?.data?.personal?.年份?.data)
const getStudentSemester = (student) => normalizeText(student?.data?.personal?.学期?.data)
const normalizeMajorName = (major) =>
    String(major || '')
        .replace(/专业/g, '')
        .trim()

const flattenClassOrder = (studentConfig) => {
    const options = studentConfig?.data?.personal?.班级信息?.cascader?.options
    const out = []
    const walk = (nodes, path = []) => {
        for (const node of Array.isArray(nodes) ? nodes : []) {
            const label = normalizeText(node?.text ?? node?.value)
            const nextPath = label ? [...path, label] : path
            if (Array.isArray(node?.children) && node.children.length) {
                walk(node.children, nextPath)
                continue
            }
            const classAliases = Array.from(
                new Set(
                    [normalizeText(node?.text), normalizeText(node?.value), label].filter(Boolean),
                ),
            )
            out.push({
                college: normalizeText(path[0]),
                major: normalizeText(path[1]),
                classAliases,
            })
        }
    }
    walk(options)
    return out
}

const createClassOrderResolver = (studentConfig) => {
    const classOrder = flattenClassOrder(studentConfig)
    const rankByFull = new Map()
    const rankByMajorClass = new Map()
    const rankByClass = new Map()
    for (let i = 0; i < classOrder.length; i++) {
        const entry = classOrder[i]
        for (const alias of entry.classAliases) {
            const fullKey = `${entry.college}|${entry.major}|${alias}`
            const majorClassKey = `${entry.major}|${alias}`
            if (!rankByFull.has(fullKey)) rankByFull.set(fullKey, i)
            if (!rankByMajorClass.has(majorClassKey)) rankByMajorClass.set(majorClassKey, i)
            if (!rankByClass.has(alias)) rankByClass.set(alias, i)
        }
    }
    return { rankByFull, rankByMajorClass, rankByClass }
}

const readClassContext = (student) => {
    let college = getStudentCollege(student)
    let major = getStudentMajor(student)
    let className = getStudentClass(student)
    const classInfo = getStudentClassInfo(student)
    if (classInfo) {
        const separators = [/\s*\/\s*/, /\s*>\s*/, /\s+/]
        for (const sep of separators) {
            const parts = classInfo
                .split(sep)
                .map((part) => normalizeText(part))
                .filter(Boolean)
            if (parts.length < 3) continue
            college = college || parts[0]
            major = major || parts[1]
            className = className || parts[parts.length - 1]
            break
        }
    }
    return { college, major, className }
}

const resolveClassRank = (student, resolver) => {
    const { college, major, className } = readClassContext(student)
    const fullKey = `${college}|${major}|${className}`
    const majorClassKey = `${major}|${className}`
    const fallbackRank = Number.MAX_SAFE_INTEGER
    if (resolver.rankByFull.has(fullKey)) {
        return { rank: resolver.rankByFull.get(fullKey), groupKey: fullKey }
    }
    if (resolver.rankByMajorClass.has(majorClassKey)) {
        return { rank: resolver.rankByMajorClass.get(majorClassKey), groupKey: majorClassKey }
    }
    if (resolver.rankByClass.has(className)) {
        return { rank: resolver.rankByClass.get(className), groupKey: className }
    }
    return {
        rank: fallbackRank,
        groupKey: `${majorClassKey}|${getStudentClassInfo(student)}`,
    }
}

const sortStudentsForExport = ({ students, scope, studentConfig, className }) => {
    const list = Array.isArray(students) ? students.slice() : []
    if (scope === 'class') {
        return list
            .filter((s) => !className || getStudentClass(s) === String(className))
            .sort((a, b) =>
                getStudentId(a).localeCompare(getStudentId(b), 'zh-Hans-CN', { numeric: true }),
            )
    }
    const classOrderResolver = createClassOrderResolver(studentConfig)
    return list.sort((a, b) => {
        const ra = resolveClassRank(a, classOrderResolver)
        const rb = resolveClassRank(b, classOrderResolver)
        const ai = ra.rank
        const bi = rb.rank
        if (ai !== bi) return ai - bi
        if (ra.groupKey !== rb.groupKey) {
            return ra.groupKey.localeCompare(rb.groupKey, 'zh-Hans-CN', { numeric: true })
        }
        return getStudentId(a).localeCompare(getStudentId(b), 'zh-Hans-CN', { numeric: true })
    })
}

const collectStudentScoreByNumber = (student) => {
    const dyf = student?.data?.dyf
    const map = new Map()
    for (const category of Object.keys(dyf || {})) {
        const groups = dyf?.[category]
        for (const group of Array.isArray(groups) ? groups : []) {
            for (const item of Array.isArray(group) ? group : []) {
                const num = Number(item?.number)
                if (!Number.isFinite(num)) continue
                const score = Number(item?.score)
                map.set(String(num), Number.isFinite(score) ? Number(score.toFixed(2)) : 0)
            }
        }
    }
    return map
}

const toExportScoreCellValue = (score) => {
    const numeric = Number(score)
    if (!Number.isFinite(numeric)) return null
    if (Math.abs(numeric) < 0.000001) return null
    return numeric
}

const getComputedColumn = (computedBySheet, sheetName, includesText) => {
    const map = computedBySheet?.[sheetName] || {}
    const pairs = Object.entries(map)
    for (const [name, pos] of pairs) {
        if (String(name).includes(includesText)) return pos?.colIndex || -1
    }
    return -1
}

const findColumnByHeader = (headerMeta, keyword) => {
    const values = headerMeta?.lastRowValues || []
    for (let i = 0; i < values.length; i++) {
        if (String(values[i] || '').includes(keyword)) return i + 1
    }
    const top = headerMeta?.headerRows?.[0] || []
    for (let i = 0; i < top.length; i++) {
        if (String(top[i] || '').includes(keyword)) return i + 1
    }
    return -1
}

const setDataCell = ({ row, colIndex, value, headerMeta }) => {
    if (colIndex <= 0) return
    const cell = row.getCell(colIndex)
    cell.value = value
    const headerCell = row.worksheet.getRow(headerMeta.lastHeaderRowIndex).getCell(colIndex)
    if (headerCell?.font) cell.font = { ...headerCell.font, bold: false }
    if (headerCell?.border) cell.border = { ...headerCell.border }
    cell.alignment = {
        ...(headerCell?.alignment || {}),
        horizontal: 'center',
        vertical: 'middle',
    }
}

const updateHeaderMetaColumn = ({ headerMeta, colIndex, text }) => {
    while ((headerMeta.lastRowValues || []).length < colIndex) headerMeta.lastRowValues.push('')
    headerMeta.lastRowValues[colIndex - 1] = text
    for (let i = 0; i < (headerMeta.headerRows || []).length; i++) {
        while ((headerMeta.headerRows[i] || []).length < colIndex) headerMeta.headerRows[i].push('')
    }
    if (Array.isArray(headerMeta.headerRows) && headerMeta.headerRows.length) {
        headerMeta.headerRows[0][colIndex - 1] = text
        headerMeta.headerRows[headerMeta.lastHeaderRowIndex - 1][colIndex - 1] = text
    }
    headerMeta.maxColumns = Math.max(headerMeta.maxColumns || 0, colIndex)
}

const ensureGradeExtraColumns = ({ worksheet, headerMeta, scope }) => {
    if (scope !== 'grade') return {}
    const required = ['年级', '专业', '班级']
    const result = {}
    for (const key of required) {
        let col = findColumnByHeader(headerMeta, key)
        if (col > 0) {
            result[key] = col
            continue
        }
        col = (headerMeta.maxColumns || worksheet.columnCount || 0) + 1
        const styleSourceCol =
            findColumnByHeader(headerMeta, '学号') || findColumnByHeader(headerMeta, '姓名') || 1
        worksheet.getColumn(col).width = worksheet.getColumn(styleSourceCol).width
        const styleSourceCell = worksheet
            .getRow(headerMeta.lastHeaderRowIndex)
            .getCell(styleSourceCol)
        const headerCell = worksheet.getRow(headerMeta.lastHeaderRowIndex).getCell(col)
        headerCell.value = key
        headerCell.style = { ...(styleSourceCell.style || {}) }
        if (headerMeta.lastHeaderRowIndex > 1) {
            const row1Cell = worksheet.getRow(1).getCell(col)
            row1Cell.value = key
            row1Cell.style = { ...(worksheet.getRow(1).getCell(styleSourceCol).style || {}) }
        }
        updateHeaderMetaColumn({ headerMeta, colIndex: col, text: key })
        result[key] = col
    }
    return result
}

const buildSheetTitle = ({ scope, sheetName, className, students }) => {
    const first = (students || [])[0] || null
    if (scope === 'grade') {
        const year = getStudentYear(first) || getStudentGrade(first) || 'xxxx'
        const season = pickSemesterName(getStudentSemester(first) || 1)
        if (sheetName === '基础分分表') return `${year}年${season}学期基础分明细`
        return `${year}年${season}学期综合素质测评分数核算表`
    }
    const grade = getStudentGrade(first) || '20XX'
    const major = normalizeMajorName(getStudentMajor(first))
    const cls = className || getStudentClass(first) || 'XX班'
    const classInfo = `${grade}级${major}${cls}`
    if (sheetName === '基础分分表') return `${classInfo}基础分明细`
    return `${classInfo}综合素质测评分数核算表`
}

const applySheetTitle = ({ worksheet, headerMeta, title }) => {
    const rows = headerMeta?.headerRows || []
    const targetKeys = ['综合素质测评分数核算表', '基础分明细']
    for (let r = 0; r < rows.length; r++) {
        const rowData = rows[r] || []
        for (let c = 0; c < rowData.length; c++) {
            const text = String(rowData[c] || '')
            if (!text) continue
            if (!targetKeys.some((k) => text.includes(k))) continue
            worksheet.getRow(r + 1).getCell(c + 1).value = title
            return
        }
    }
    worksheet.getRow(1).getCell(1).value = title
}

const getCategoryRanges = ({ mappingInfo, studentConfig, sheetName }) => {
    const ranges = new Map()
    const categoryToNumbers =
        mappingInfo?.headerBySheet?.[sheetName]?.dyfCategoryNumbers || new Map()
    for (const [categoryName, numbers] of categoryToNumbers.entries()) {
        let start = -1
        let end = -1
        for (const num of numbers) {
            const pos = mappingInfo?.mapping?.[String(num)]
            if (!pos || pos.sheetName !== sheetName) continue
            if (start === -1 || pos.colIndex < start) start = pos.colIndex
            if (end === -1 || pos.colIndex > end) end = pos.colIndex
        }
        if (start > 0 && end > 0) ranges.set(categoryName, { start, end })
    }
    const dyf = studentConfig?.data?.dyf
    if (ranges.size === 0 && dyf && typeof dyf === 'object') {
        for (const categoryName of Object.keys(dyf)) {
            const nums = []
            for (const group of dyf[categoryName] || []) {
                for (const item of group || []) {
                    const num = Number(item?.number)
                    if (Number.isFinite(num)) nums.push(num)
                }
            }
            let start = -1
            let end = -1
            for (const num of nums) {
                const pos = mappingInfo?.mapping?.[String(num)]
                if (!pos || pos.sheetName !== sheetName) continue
                if (start === -1 || pos.colIndex < start) start = pos.colIndex
                if (end === -1 || pos.colIndex > end) end = pos.colIndex
            }
            if (start > 0 && end > 0) ranges.set(categoryName, { start, end })
        }
    }
    return ranges
}

const ensureRowStyles = (worksheet, dataStartRow, targetRow, maxCol) => {
    if (targetRow <= worksheet.rowCount) return
    const source = worksheet.getRow(dataStartRow)
    for (let r = worksheet.rowCount + 1; r <= targetRow; r++) {
        const row = worksheet.getRow(r)
        row.height = source.height
        row.hidden = source.hidden
        for (let c = 1; c <= maxCol; c++) {
            const sourceCell = source.getCell(c)
            const cell = row.getCell(c)
            cell.style = { ...(sourceCell.style || {}) }
            cell.numFmt = sourceCell.numFmt
            cell.font = sourceCell.font ? { ...sourceCell.font } : sourceCell.font
            cell.fill = sourceCell.fill ? { ...sourceCell.fill } : sourceCell.fill
            cell.border = sourceCell.border ? { ...sourceCell.border } : sourceCell.border
            cell.alignment = sourceCell.alignment
                ? { ...sourceCell.alignment }
                : sourceCell.alignment
        }
    }
}

const writeStudentRow = ({
    row,
    rowIndex,
    seqNo,
    student,
    mappingInfo,
    studentConfig,
    baseSheetTotalCol,
    summaryComputed,
    headerMeta,
    extraColumns,
    baseLinkedRowIndex,
}) => {
    const scoreMap = collectStudentScoreByNumber(student)
    const mapping = mappingInfo.mapping
    const seqCol = findColumnByHeader(headerMeta, '序号')
    setDataCell({ row, colIndex: seqCol, value: seqNo, headerMeta })
    const personalColMap = {
        学号: findColumnByHeader(headerMeta, '学号'),
        姓名: findColumnByHeader(headerMeta, '姓名'),
        班级: findColumnByHeader(headerMeta, '班级'),
        年级: extraColumns?.年级 || findColumnByHeader(headerMeta, '年级'),
        专业: extraColumns?.专业 || findColumnByHeader(headerMeta, '专业'),
    }
    for (const [key, col] of Object.entries(personalColMap)) {
        setDataCell({ row, colIndex: col, value: readPersonalValue(student, key), headerMeta })
    }
    for (const [key, pos] of Object.entries(mapping)) {
        if (pos.rowIndex >= rowIndex) continue
        if (pos.sheetName !== row.worksheet.name) continue
        if (pos.cellType === 'personal') continue
        if (pos.cellType === 'dyf') {
            const scoreValue = toExportScoreCellValue(scoreMap.get(key))
            setDataCell({
                row,
                colIndex: pos.colIndex,
                value: scoreValue,
                headerMeta,
            })
        }
    }
    const ranges = getCategoryRanges({
        mappingInfo,
        studentConfig,
        sheetName: row.worksheet.name,
    })
    const baseSheetRanges = getCategoryRanges({
        mappingInfo,
        studentConfig,
        sheetName: '基础分分表',
    })
    if (row.worksheet.name === '基础分分表') {
        const baseRange = ranges.get('基础分')
        if (baseRange && baseSheetTotalCol > 0) {
            const formula = buildSumFormula({
                rowIndex,
                startCol: baseRange.start,
                endCol: baseRange.end,
            })
            const baseTotal = Number(
                Array.from(scoreMap.entries())
                    .filter(([num]) => {
                        const pos = mapping[num]
                        return (
                            pos?.sheetName === '基础分分表' &&
                            pos.colIndex >= baseRange.start &&
                            pos.colIndex <= baseRange.end
                        )
                    })
                    .reduce((sum, [, v]) => sum + Number(v || 0), 0)
                    .toFixed(2),
            )
            setDataCell({
                row,
                colIndex: baseSheetTotalCol,
                value: { formula, result: baseTotal },
                headerMeta,
            })
        }
        return
    }
    const scoreTotals = {
        基础分: 0,
        奖励分: 0,
        惩罚分: 0,
        8881: Number(scoreMap.get('8881') || 0),
        8882: Number(scoreMap.get('8882') || 0),
    }
    for (const [category, range] of ranges.entries()) {
        const subtotal = Number(
            Array.from(scoreMap.entries())
                .filter(([num]) => {
                    const pos = mapping[num]
                    return (
                        pos?.sheetName === row.worksheet.name &&
                        pos.colIndex >= range.start &&
                        pos.colIndex <= range.end
                    )
                })
                .reduce((sum, [, v]) => sum + Number(v || 0), 0)
                .toFixed(2),
        )
        scoreTotals[category] = subtotal
        const sumCol = getComputedColumn(mappingInfo.computedBySheet, '总表', `${category}总和`)
        if (sumCol > 0) {
            const formula = buildSumFormula({
                rowIndex,
                startCol: range.start,
                endCol: range.end,
            })
            setDataCell({ row, colIndex: sumCol, value: { formula, result: subtotal }, headerMeta })
        }
    }
    const baseCol = summaryComputed.baseCol
    const rewardCol = summaryComputed.rewardCol
    const punishCol = summaryComputed.punishCol
    const specialCol = summaryComputed.specialCol
    const totalCol = summaryComputed.totalCol
    let baseTotalForSummary = Number(scoreTotals?.基础分 || 0)
    if (baseCol > 0 && baseSheetTotalCol > 0) {
        const baseRangeFromBaseSheet = baseSheetRanges.get('基础分')
        const baseTotalFromBaseSheet = baseRangeFromBaseSheet
            ? Number(
                  Array.from(scoreMap.entries())
                      .filter(([num]) => {
                          const pos = mapping[num]
                          return (
                              pos?.sheetName === '基础分分表' &&
                              pos.colIndex >= baseRangeFromBaseSheet.start &&
                              pos.colIndex <= baseRangeFromBaseSheet.end
                          )
                      })
                      .reduce((sum, [, v]) => sum + Number(v || 0), 0)
                      .toFixed(2),
              )
            : Number(scoreTotals?.基础分 || 0)
        baseTotalForSummary = baseTotalFromBaseSheet
        scoreTotals.基础分 = baseTotalFromBaseSheet
        setDataCell({
            row,
            colIndex: baseCol,
            value: {
                formula: buildRefFormula({
                    fromSheet: '基础分分表',
                    rowIndex: Number(baseLinkedRowIndex || rowIndex),
                    colIndex: baseSheetTotalCol,
                }),
                result: baseTotalForSummary,
            },
            headerMeta,
        })
    }
    if (specialCol > 0) {
        const n8881Pos = mapping['8881']
        const n8882Pos = mapping['8882']
        if (n8881Pos?.sheetName === '总表' && n8882Pos?.sheetName === '总表') {
            setDataCell({
                row,
                colIndex: specialCol,
                value: {
                    formula: buildDiffFormula({
                        rowIndex,
                        leftCol: n8881Pos.colIndex,
                        rightCol: n8882Pos.colIndex,
                    }),
                    result: Number((scoreTotals['8881'] - scoreTotals['8882']).toFixed(2)),
                },
                headerMeta,
            })
        }
    }
    const totals = recalculateRowTotals({
        scoreMap: {
            基础分: scoreTotals.基础分,
            奖励分: scoreTotals.奖励分,
            惩罚分: scoreTotals.惩罚分,
            8881: scoreTotals['8881'],
            8882: scoreTotals['8882'],
        },
    })
    if (totalCol > 0 && baseCol > 0 && rewardCol > 0 && punishCol > 0 && specialCol > 0) {
        setDataCell({
            row,
            colIndex: totalCol,
            value: {
                formula: buildTotalFormula({
                    rowIndex,
                    baseCol,
                    rewardCol,
                    punishCol,
                    specialCol,
                }),
                result: totals.总分,
            },
            headerMeta,
        })
    }
}

export const buildExportWorkbookBuffer = async ({
    studentConfig,
    students,
    scope = 'class',
    className = '',
    operator = '',
    templateBuffer,
}) => {
    const mappingInfo = await getTemplateMapping({ studentConfig, templateBuffer })
    await appendTemplateChangeLog({
        scope,
        changed: mappingInfo.changed,
        unmappedColumns: mappingInfo.unmappedColumns,
    })
    const workbook = mappingInfo.workbook
    const summarySheet = workbook.getWorksheet('总表')
    const baseSheet = workbook.getWorksheet('基础分分表')
    const summaryHeader = mappingInfo.headerBySheet['总表']
    const baseHeader = mappingInfo.headerBySheet['基础分分表']
    const sortedStudents = sortStudentsForExport({ students, scope, studentConfig, className })
    applySheetTitle({
        worksheet: summarySheet,
        headerMeta: summaryHeader,
        title: buildSheetTitle({
            scope,
            sheetName: '总表',
            className,
            students: sortedStudents,
        }),
    })
    applySheetTitle({
        worksheet: baseSheet,
        headerMeta: baseHeader,
        title: buildSheetTitle({
            scope,
            sheetName: '基础分分表',
            className,
            students: sortedStudents,
        }),
    })
    const summaryExtraColumns = ensureGradeExtraColumns({
        worksheet: summarySheet,
        headerMeta: summaryHeader,
        scope,
    })
    const baseExtraColumns = ensureGradeExtraColumns({
        worksheet: baseSheet,
        headerMeta: baseHeader,
        scope,
    })
    const summaryDataStart = summaryHeader.lastHeaderRowIndex + 1
    const baseDataStart = baseHeader.lastHeaderRowIndex + 1
    const baseSheetTotalCol = getComputedColumn(mappingInfo.computedBySheet, '基础分分表', '总分')
    const summaryComputed = {
        baseCol: getComputedColumn(mappingInfo.computedBySheet, '总表', '基础分'),
        rewardCol: getComputedColumn(mappingInfo.computedBySheet, '总表', '奖励分总和'),
        punishCol: getComputedColumn(mappingInfo.computedBySheet, '总表', '惩罚分总和'),
        specialCol: getComputedColumn(mappingInfo.computedBySheet, '总表', '第八项第三条总和'),
        totalCol: getComputedColumn(mappingInfo.computedBySheet, '总表', '总分'),
    }
    for (let i = 0; i < sortedStudents.length; i++) {
        const student = sortedStudents[i]
        const summaryRowIndex = summaryDataStart + i
        const baseRowIndex = baseDataStart + i
        ensureRowStyles(summarySheet, summaryDataStart, summaryRowIndex, summaryHeader.maxColumns)
        ensureRowStyles(baseSheet, baseDataStart, baseRowIndex, baseHeader.maxColumns)
        writeStudentRow({
            row: baseSheet.getRow(baseRowIndex),
            rowIndex: baseRowIndex,
            seqNo: i + 1,
            student,
            mappingInfo,
            studentConfig,
            baseSheetTotalCol,
            summaryComputed,
            headerMeta: baseHeader,
            extraColumns: baseExtraColumns,
        })
        writeStudentRow({
            row: summarySheet.getRow(summaryRowIndex),
            rowIndex: summaryRowIndex,
            seqNo: i + 1,
            student,
            mappingInfo,
            studentConfig,
            baseSheetTotalCol,
            summaryComputed,
            headerMeta: summaryHeader,
            extraColumns: summaryExtraColumns,
            baseLinkedRowIndex: baseRowIndex,
        })
    }
    const summaryFormulaCols = new Set(
        Object.values(summaryComputed)
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x) && x > 0),
    )
    const baseFormulaCols = new Set(baseSheetTotalCol > 0 ? [baseSheetTotalCol] : [])
    const summaryRows = Array.from(
        { length: sortedStudents.length },
        (_, i) => summaryDataStart + i,
    )
    const baseRows = Array.from({ length: sortedStudents.length }, (_, i) => baseDataStart + i)
    const summaryChecksum = await computeSheetChecksum({
        worksheet: summarySheet,
        dataRows: summaryRows,
        maxCol: summaryHeader.maxColumns,
        formulaCols: summaryFormulaCols,
    })
    const baseChecksum = await computeSheetChecksum({
        worksheet: baseSheet,
        dataRows: baseRows,
        maxCol: baseHeader.maxColumns,
        formulaCols: baseFormulaCols,
    })
    writeChecksumMetaSheet({
        workbook,
        payload: {
            summarySheetSha256: summaryChecksum,
            baseSheetSha256: baseChecksum,
            exportedAt: new Date().toISOString(),
            operator: String(operator || ''),
        },
    })
    return {
        buffer: await workbook.xlsx.writeBuffer(),
        checksums: { summaryChecksum, baseChecksum },
        mappingInfo,
        exportedCount: sortedStudents.length,
    }
}

export const exportStudentScoresWithTemplate = async ({
    filename,
    studentConfig,
    students,
    scope = 'class',
    className = '',
    operator = '',
    templateBuffer,
}) => {
    const { saveAs } = await import('file-saver')
    const result = await buildExportWorkbookBuffer({
        studentConfig,
        students,
        scope,
        className,
        operator,
        templateBuffer,
    })
    const blob = new Blob([result.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, filename)
    return result
}
