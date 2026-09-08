export const safeJsonParse = (text) => {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}
