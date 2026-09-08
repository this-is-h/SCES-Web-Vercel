export const importStudentsFromFiles = async ({ files, importStudent, onProgress }) => {
    const list = Array.from(files || [])
    const results = []
    let done = 0
    let total = 0

    const normalizeRow = (row, fileName) => {
        const merged = { fileName: fileName || '', ...(row || {}) }
        if (!merged.status) merged.status = merged.ok ? 'success' : 'error'
        return merged
    }

    for (const file of list) {
        let fileTotal = 1
        let fileDone = 0
        total += fileTotal
        if (typeof onProgress === 'function') onProgress({ done, total })
        const progress = {
            setTotal: (nextTotal) => {
                const normalized = Number(nextTotal)
                if (!Number.isFinite(normalized) || normalized < 1) return
                const safeTotal = Math.floor(normalized)
                if (safeTotal === fileTotal) return
                total += safeTotal - fileTotal
                fileTotal = safeTotal
                if (typeof onProgress === 'function') onProgress({ done, total })
            },
            advance: (step = 1) => {
                const normalized = Number(step)
                if (!Number.isFinite(normalized) || normalized <= 0) return
                const safeStep = Math.floor(normalized)
                fileDone += safeStep
                done += safeStep
                if (typeof onProgress === 'function') onProgress({ done, total })
            },
        }
        try {
            const text = await file.text()
            const result = await importStudent(text, progress)
            const details = result?.details
            if (Array.isArray(details) && details.length > 0) {
                for (const d of details) results.push(normalizeRow(d, file?.name))
            } else {
                results.push(normalizeRow(result, file?.name))
            }
        } catch (e) {
            results.push({
                ok: false,
                fileName: file?.name || '',
                name: '-',
                id: '-',
                status: 'error',
                message: e?.message || '导入失败',
            })
        } finally {
            if (fileDone === 0) done += fileTotal
            else if (fileDone < fileTotal) done += fileTotal - fileDone
            if (typeof onProgress === 'function') onProgress({ done, total })
        }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const restoredCount = results.filter((r) => r.status === 'restored').length
    const failCount = results.filter((r) => r.status !== 'success' && r.status !== 'restored').length
    const okCount = successCount + restoredCount
    return { results, okCount, successCount, restoredCount, failCount }
}
