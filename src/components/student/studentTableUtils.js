import { buildDyfCategoryItems } from '@/utils/studentScoreExcel'
import {
    calculateTotalScore as calculateTotalScoreByDetail,
    collectScoreDetails,
} from '@/utils/totalScore'
import { formatPenaltyCategoryTitle, formatPenaltyItemLabel } from '@/utils/penaltyDisplay'

export const buildStudentCategoryItems = (config) =>
    buildDyfCategoryItems(config).filter((c) => c?.items?.length)

export const calculateTotalScore = (
    dyfData,
    penaltyCategoryCodes = ['惩罚分'],
    negativeItemNumbers = ['8882'],
) =>
    calculateTotalScoreByDetail(
        collectScoreDetails(dyfData),
        penaltyCategoryCodes,
        negativeItemNumbers,
    )

export const buildScoreIndex = (dyfData) => {
    const map = new Map()
    if (!dyfData || typeof dyfData !== 'object') return map
    for (const category in dyfData) {
        const groups = dyfData[category]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                if (!item?.number) continue
                map.set(item.number, item.score ?? 0)
            }
        }
    }
    return map
}

export const buildStudentTableRows = ({
    students = [],
    categoryItems = [],
    penaltyCategoryCodes = ['惩罚分'],
    negativeItemNumbers = ['8882'],
} = {}) => {
    const list = Array.isArray(students) ? students : []
    return list.map((s) => {
        const p = s?.data?.personal ?? {}
        const scoreIndex = buildScoreIndex(s?.data?.dyf)
        const scores = {}
        const categoryTotals = {}
        for (const category of categoryItems) {
            let subtotal = 0
            for (const item of category?.items || []) {
                const raw = Number(scoreIndex.get(item.number) ?? 0)
                const val = Number.isFinite(raw) ? raw : 0
                scores[item.number] = val
                subtotal += val
            }
            categoryTotals[category.categoryName] = Number(subtotal.toFixed(2))
        }
        return {
            id: String(p?.学号?.data ?? ''),
            name: String(p?.姓名?.data ?? ''),
            grade: String(p?.年级?.data ?? ''),
            major: String(p?.专业?.data ?? ''),
            class: String(p?.班级?.data ?? ''),
            total: calculateTotalScore(s?.data?.dyf, penaltyCategoryCodes, negativeItemNumbers),
            scores,
            categoryTotals,
        }
    })
}

export const buildStudentTableColumns = ({
    categoryItems = [],
    nameRowSpan,
    penaltyDisplayConfig,
} = {}) => {
    const grouped = (Array.isArray(categoryItems) ? categoryItems : []).map((cat) => {
        const categoryTitle = formatPenaltyCategoryTitle(cat.categoryName, penaltyDisplayConfig)
        const children = (cat.items || []).map((item) => ({
            id: `score_${item.number}`,
            header: formatPenaltyItemLabel(item.number, {
                config: penaltyDisplayConfig,
            }),
            accessorFn: (row) => row?.scores?.[item.number] ?? 0,
            size: 80,
            minSize: 80,
            maxSize: 80,
            meta: { class: { th: 'text-center', td: 'text-center' } },
        }))

        children.push({
            id: `sum_${cat.categoryName}`,
            header: `${categoryTitle}总和`,
            accessorFn: (row) => row?.categoryTotals?.[cat.categoryName] ?? 0,
            size: 80,
            minSize: 80,
            maxSize: 80,
            meta: {
                class: {
                    th: 'text-center font-bold bg-gray-50 dark:bg-gray-800',
                    td: 'text-center font-bold bg-gray-50 dark:bg-gray-800',
                },
            },
        })

        return {
            id: `cat_${cat.categoryName}`,
            header: categoryTitle,
            columns: children,
            meta: { class: { th: 'text-center' } },
        }
    })

    const nameCol = {
        accessorKey: 'name',
        header: '姓名',
        size: 100,
        minSize: 100,
        maxSize: 100,
        meta: {
            class: {
                th: 'text-center min-w-[100px] max-w-[100px]',
                td: 'text-center min-w-[100px] max-w-[100px] truncate',
            },
        },
    }

    if (nameRowSpan) nameCol.rowSpan = nameRowSpan

    return [
        {
            id: 'index',
            header: '序号',
            accessorFn: (_row, index) => index + 1,
            size: 60,
            minSize: 60,
            maxSize: 60,
            meta: {
                class: {
                    th: 'text-center min-w-[60px] max-w-[60px]',
                    td: 'text-center min-w-[60px] max-w-[60px] truncate',
                },
            },
        },
        nameCol,
        ...grouped,
        {
            accessorKey: 'total',
            header: '总分',
            enableSorting: true,
            size: 100,
            minSize: 100,
            maxSize: 100,
            meta: {
                class: {
                    th: 'text-center min-w-[100px] max-w-[100px]',
                    td: 'text-center min-w-[100px] max-w-[100px]',
                },
            },
        },
        {
            id: 'actions',
            header: '操作',
            size: 140,
            minSize: 140,
            maxSize: 140,
            cell: () => '',
            meta: {
                class: {
                    th: 'text-center min-w-[140px] max-w-[140px]',
                    td: 'text-center min-w-[140px] max-w-[140px]',
                },
            },
        },
    ]
}

export const formatDate = (d) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}${mm}${dd}_${hh}${mi}`
}

export const safeNamePart = (v) =>
    String(v || '')
        .replace(/[\\/:*?"<>|]/g, '_')
        .trim()
