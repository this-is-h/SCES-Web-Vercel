const LEADERSHIP_TRAINING_MIN_NUMBER = 1311
const LEADERSHIP_TRAINING_MAX_NUMBER = 1351

const normalizeNumber = (value) => {
    const number = Number(value)
    if (!Number.isFinite(number)) return null
    return number
}

const normalizeScore = (value) => {
    const score = Number(value)
    if (!Number.isFinite(score)) return 0
    return score
}

export const isLeadershipTrainingNumber = (value) => {
    const number = normalizeNumber(value)
    if (number == null) return false
    return number >= LEADERSHIP_TRAINING_MIN_NUMBER && number <= LEADERSHIP_TRAINING_MAX_NUMBER
}

const collectLeadershipItems = (root) => {
    const items = []
    const visit = (target) => {
        if (!target || typeof target !== 'object') return
        if (Array.isArray(target)) {
            for (const item of target) visit(item)
            return
        }
        if (isLeadershipTrainingNumber(target.number) && Object.prototype.hasOwnProperty.call(target, 'score')) {
            items.push(target)
        }
        for (const key of Object.keys(target)) visit(target[key])
    }
    visit(root)
    return items
}

const compareLeadershipItem = (currentBest, candidate) => {
    if (!currentBest) return candidate
    const bestScore = normalizeScore(currentBest.score)
    const candidateScore = normalizeScore(candidate.score)
    if (candidateScore > bestScore) return candidate
    if (candidateScore < bestScore) return currentBest

    const bestNumber = normalizeNumber(currentBest.number) ?? -Infinity
    const candidateNumber = normalizeNumber(candidate.number) ?? -Infinity
    if (candidateNumber > bestNumber) return candidate
    return currentBest
}

export const applyLeadershipTrainingHighestRule = (state) => {
    const items = collectLeadershipItems(state)
    if (items.length === 0) {
        return { changed: false, keptNumber: null, keptScore: 0, candidates: 0 }
    }

    const keptItem = items.reduce(compareLeadershipItem, null)
    const keptScore = normalizeScore(keptItem?.score)
    let changed = false

    for (const item of items) {
        const nextScore = item === keptItem ? keptScore : 0
        const prevScore = normalizeScore(item?.score)
        if (prevScore !== nextScore) changed = true
        item.score = nextScore
    }

    return {
        changed,
        keptNumber: keptItem?.number ?? null,
        keptScore,
        candidates: items.length,
    }
}
