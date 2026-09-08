const PENALTY_SUFFIX = '（此项分值需扣除）'

const toText = (value) => {
    if (value == null) return ''
    return String(value)
}

const normalizeTextToken = (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return ''
    const text = toText(value).trim()
    return text ? text : ''
}

const normalizeNumberToken = (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return ''
    if (typeof value === 'string' && value.trim() === '') return ''
    const number = Number(value)
    if (!Number.isFinite(number)) return ''
    return String(number)
}

const normalizeStringArray = (value) => {
    if (!Array.isArray(value)) return []
    const list = []
    for (const item of value) {
        if (typeof item !== 'string' && typeof item !== 'number') continue
        const normalized = normalizeTextToken(stripPenaltySuffix(item))
        if (normalized) list.push(normalized)
    }
    return list
}

const normalizeNumberArray = (value) => {
    if (!Array.isArray(value)) return []
    const list = []
    for (const item of value) {
        const normalized = normalizeNumberToken(item)
        if (normalized) list.push(normalized)
    }
    return list
}

const stripPenaltySuffix = (value) => {
    const text = toText(value)
    if (text.endsWith(PENALTY_SUFFIX)) {
        return text.slice(0, -PENALTY_SUFFIX.length)
    }
    return text
}

export const resolvePenaltyDisplayRule = (config) => ({
    penaltyCategoryCodes: new Set(normalizeStringArray(config?.totalScorePenaltyCategoryCodes)),
    negativeItemNumbers: new Set(normalizeNumberArray(config?.totalScoreNegativeItemNumbers)),
})

export const shouldAppendPenaltySuffix = (
    { text, itemNumber } = {},
    config,
    { target = 'category' } = {},
) => {
    const rule = resolvePenaltyDisplayRule(config)
    if (!rule.penaltyCategoryCodes.size && !rule.negativeItemNumbers.size) return false

    const textToken = normalizeTextToken(stripPenaltySuffix(text))
    const itemToken = normalizeNumberToken(itemNumber ?? stripPenaltySuffix(text))

    if (target === 'category') return Boolean(textToken && rule.penaltyCategoryCodes.has(textToken))

    if (target === 'item') return Boolean(itemToken && rule.negativeItemNumbers.has(itemToken))
    return false
}

export const formatPenaltyDisplayText = (value, { itemNumber, config, target = 'category' } = {}) => {
    const baseText = stripPenaltySuffix(toText(value))
    if (!baseText) return ''
    if (
        shouldAppendPenaltySuffix(
            { text: baseText, itemNumber },
            config,
            { target },
        )
    ) {
        return `${baseText}${PENALTY_SUFFIX}`
    }
    return baseText
}

export const formatPenaltyCategoryTitle = (categoryName, config) =>
    formatPenaltyDisplayText(categoryName, { config, target: 'category' })

export const formatPenaltyItemLabel = (itemNumber, { config } = {}) =>
    formatPenaltyDisplayText(itemNumber, { itemNumber, config, target: 'item' })

export const getPenaltySuffix = () => PENALTY_SUFFIX
