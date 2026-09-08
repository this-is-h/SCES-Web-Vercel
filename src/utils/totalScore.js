export const DEFAULT_PENALTY_CATEGORY_CODES = ['惩罚分']
export const DEFAULT_NEGATIVE_ITEM_NUMBERS = ['8882']

const normalizeStringList = (list = []) =>
    Array.from(
        new Set(
            (Array.isArray(list) ? list : []).map((v) => String(v ?? '').trim()).filter(Boolean),
        ),
    )

export const resolveTotalScoreConfig = (serverConfig = {}) => {
    const penaltyCategoryCodes = normalizeStringList(serverConfig?.totalScorePenaltyCategoryCodes)
    const negativeItemNumbers = normalizeStringList(serverConfig?.totalScoreNegativeItemNumbers)
    return {
        penaltyCategoryCodes: penaltyCategoryCodes.length
            ? penaltyCategoryCodes
            : DEFAULT_PENALTY_CATEGORY_CODES,
        negativeItemNumbers: negativeItemNumbers.length
            ? negativeItemNumbers
            : DEFAULT_NEGATIVE_ITEM_NUMBERS,
    }
}

export const collectScoreDetails = (dyfData) => {
    const details = []
    if (!dyfData || typeof dyfData !== 'object') return details
    for (const categoryCode of Object.keys(dyfData)) {
        const groups = dyfData[categoryCode]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const score = Number(item?.score ?? 0)
                if (!Number.isFinite(score)) continue
                details.push({
                    categoryCode: String(categoryCode ?? ''),
                    itemNumber: String(item?.number ?? ''),
                    score,
                })
            }
        }
    }
    return details
}

export const calculateTotalScore = (
    detailList = [],
    penaltyCategoryCodes = DEFAULT_PENALTY_CATEGORY_CODES,
    negativeItemNumbers = DEFAULT_NEGATIVE_ITEM_NUMBERS,
) => {
    const details = Array.isArray(detailList) ? detailList : []
    const penaltyCategorySet = new Set(normalizeStringList(penaltyCategoryCodes))
    const negativeItemSet = new Set(normalizeStringList(negativeItemNumbers))
    const categorySubtotalMap = new Map()

    for (const detail of details) {
        const categoryCode = String(detail?.categoryCode ?? '')
        const itemNumber = String(detail?.itemNumber ?? '')
        const score = Number(detail?.score ?? 0)
        if (!Number.isFinite(score) || !categoryCode) continue
        const signedScore = negativeItemSet.has(itemNumber) ? -score : score
        categorySubtotalMap.set(
            categoryCode,
            (categorySubtotalMap.get(categoryCode) ?? 0) + signedScore,
        )
    }

    let total = 0
    for (const [categoryCode, subtotal] of categorySubtotalMap.entries()) {
        total += penaltyCategorySet.has(categoryCode) ? -subtotal : subtotal
    }
    return Number(total.toFixed(2))
}
