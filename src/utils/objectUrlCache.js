export const createObjectUrlCache = ({ maxEntries = 200 } = {}) => {
    const max = Math.max(1, Number(maxEntries) || 200)
    const cache = new Map()

    const revoke = (url) => {
        try {
            if (url) URL.revokeObjectURL(url)
        } catch {}
    }

    const touch = (key) => {
        const val = cache.get(key)
        if (!val) return null
        cache.delete(key)
        cache.set(key, val)
        return val
    }

    const ensureLimit = () => {
        while (cache.size > max) {
            const oldestKey = cache.keys().next().value
            const oldest = cache.get(oldestKey)
            cache.delete(oldestKey)
            revoke(oldest?.url)
        }
    }

    return {
        get(key) {
            const v = touch(String(key))
            return v?.url ?? null
        },
        set(key, blob) {
            const k = String(key)
            const existing = cache.get(k)
            if (existing?.url) revoke(existing.url)
            const url = URL.createObjectURL(blob)
            cache.set(k, { url })
            ensureLimit()
            return url
        },
        clear() {
            for (const v of cache.values()) revoke(v?.url)
            cache.clear()
        },
        size() {
            return cache.size
        },
    }
}
