import { toRaw } from 'vue'

const isObject = (v) => v != null && typeof v === 'object'

const isRegExp = (v) => v instanceof RegExp

const safeClone = (input) => {
    const rawInput = toRaw(input)
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(rawInput)
        } catch {}
    }

    const seen = new Map()
    const clone = (v) => {
        if (v == null) return v
        if (typeof v !== 'object') return v
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
        const proto = Object.getPrototypeOf(rawV)
        if (proto !== Object.prototype && proto !== null) return rawV
        const out = {}
        seen.set(rawV, out)
        for (const k of Object.keys(rawV)) out[k] = clone(rawV[k])
        return out
    }
    return clone(rawInput)
}

const isPlainObject = (v) => {
    if (!isObject(v)) return false
    if (Array.isArray(v)) return false
    const proto = Object.getPrototypeOf(v)
    return proto === Object.prototype || proto === null
}

const shouldIgnoreKey = (parentPath, key) => {
    if (key === 'score') return true
    if (key === 'objectUrl' || key === 'url') return true
    if (key === 'time') return true
    if (key === 'files' || key === 'img') {
        return parentPath === 'support' || parentPath.endsWith('.support')
    }
    if (key === 'data') {
        return parentPath === 'data.personal' || parentPath.startsWith('data.personal.')
    }
    return false
}

const joinPath = (base, key) => {
    if (!base) return String(key)
    if (typeof key === 'number') return `${base}[${key}]`
    return `${base}.${String(key)}`
}

export const findStudentJsFirstDiffPath = ({ serverTemplate, localState }) => {
    const stack = [{ a: serverTemplate, b: localState, path: '' }]

    while (stack.length) {
        const { a, b, path } = stack.pop()
        if (a === b) continue
        if (a == null || b == null) return path || '(root)'

        if (isRegExp(a) || isRegExp(b)) {
            if (!isRegExp(a) || !isRegExp(b)) return path || '(root)'
            if (a.source !== b.source || a.flags !== b.flags) return path || '(root)'
            continue
        }

        const ta = typeof a
        const tb = typeof b
        if (ta !== tb) return path || '(root)'

        if (Array.isArray(a) || Array.isArray(b)) {
            if (!Array.isArray(a) || !Array.isArray(b)) return path || '(root)'
            if (a.length !== b.length) return path || '(root)'
            for (let i = a.length - 1; i >= 0; i--) {
                stack.push({ a: a[i], b: b[i], path: joinPath(path, i) })
            }
            continue
        }

        if (isObject(a)) {
            if (!isObject(b)) return path || '(root)'

            const aPlain = isPlainObject(a)
            const bPlain = isPlainObject(b)
            if (aPlain !== bPlain) return path || '(root)'

            if (!aPlain) {
                if (String(a) !== String(b)) return path || '(root)'
                continue
            }

            const aKeys = Object.keys(a).filter((k) => !shouldIgnoreKey(path, k))
            const bKeys = Object.keys(b).filter((k) => !shouldIgnoreKey(path, k))
            if (aKeys.length !== bKeys.length) return path || '(root)'

            const bSet = new Set(bKeys)
            for (const k of aKeys) {
                if (!bSet.has(k)) return joinPath(path, k)
            }

            for (let i = aKeys.length - 1; i >= 0; i--) {
                const k = aKeys[i]
                stack.push({ a: a[k], b: b[k], path: joinPath(path, k) })
            }
            continue
        }

        if (a !== b) return path || '(root)'
    }

    return null
}

export const hasStudentJsMismatch = ({ serverTemplate, localState }) => {
    return Boolean(findStudentJsFirstDiffPath({ serverTemplate, localState }))
}

const buildLocalItemMap = (dyf) => {
    const map = new Map()
    if (!dyf || typeof dyf !== 'object') return map
    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        for (const group of groups) {
            if (!Array.isArray(group)) continue
            for (const item of group) {
                const key = String(item?.number ?? '').trim()
                if (key) map.set(key, item)
            }
        }
    }
    return map
}

export const mergeStudentStateKeepingUserData = ({ localState, serverTemplate }) => {
    const localDyf = localState?.data?.dyf
    const localPersonal = localState?.data?.personal
    const serverDyf = serverTemplate?.data?.dyf
    const serverPersonal = serverTemplate?.data?.personal

    const localItemMap = buildLocalItemMap(localDyf)
    const localItemSet = new Set(localItemMap.keys())
    const serverItemSet = new Set()

    const nextState = safeClone(serverTemplate)

    if (localState?.time && typeof localState.time === 'object') {
        nextState.time = safeClone(localState.time)
    }

    if (nextState?.data?.personal && serverPersonal && localPersonal) {
        for (const key of Object.keys(serverPersonal)) {
            const tplField = serverPersonal?.[key]
            const localField = localPersonal?.[key]
            if (!tplField || typeof tplField !== 'object') continue
            if (!localField || typeof localField !== 'object') continue

            if ('data' in tplField) {
                const tplData = tplField.data
                const localData = localField.data
                if (typeof tplData === typeof localData)
                    nextState.data.personal[key].data = localData
                else nextState.data.personal[key].data = tplData
            }

            if (tplField.cascader && typeof tplField.cascader === 'object') {
                const localC = localField.cascader
                if (localC && typeof localC === 'object' && 'data' in localC) {
                    if (!nextState.data.personal[key].cascader)
                        nextState.data.personal[key].cascader = {}
                    nextState.data.personal[key].cascader.data = safeClone(localC.data)
                }
            }
        }
    }

    if (nextState?.data?.dyf && serverDyf && typeof serverDyf === 'object') {
        for (const categoryName of Object.keys(serverDyf)) {
            const groups = nextState.data.dyf[categoryName]
            if (!Array.isArray(groups)) continue

            for (const group of groups) {
                if (!Array.isArray(group)) continue
                for (let i = 0; i < group.length; i++) {
                    const serverItem = group[i]
                    const numberKey = String(serverItem?.number ?? '').trim()
                    if (!numberKey) continue
                    serverItemSet.add(numberKey)

                    const localItem = localItemMap.get(numberKey)
                    if (!localItem || typeof localItem !== 'object') continue

                    if (typeof localItem.score === 'number') serverItem.score = localItem.score
                    else if (typeof serverItem.score !== 'number') serverItem.score = 0

                    if (localItem.support && typeof localItem.support === 'object') {
                        const mergedSupport = { ...(serverItem.support ?? {}) }
                        if (Array.isArray(localItem.support.files))
                            mergedSupport.files = safeClone(localItem.support.files)
                        else if (mergedSupport.files != null) delete mergedSupport.files

                        if (Array.isArray(localItem.support.img))
                            mergedSupport.img = safeClone(localItem.support.img)
                        else if (mergedSupport.img != null) delete mergedSupport.img

                        serverItem.support = mergedSupport
                    }
                }
            }
        }
    }

    const removedItems = [...localItemSet].filter((k) => !serverItemSet.has(k))
    const addedItems = [...serverItemSet].filter((k) => !localItemSet.has(k))

    return { nextState, removedItems, addedItems }
}
