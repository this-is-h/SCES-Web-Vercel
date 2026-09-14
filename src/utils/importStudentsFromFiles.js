// 批量导入：逐个文件交给 importFile（基于 File 对象的流式解析；绝不把整文件读成 text）。
// progress.setTotal(n) 由 importFile 在获知文件内学生数后调用；progress.advance() 每处理一名学生一次。
export const importStudentsFromFiles = async ({ files, importFile, onProgress }) => {
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
        let fileTotal = 0
        let fileDone = 0
        const report = () => {
            if (typeof onProgress === 'function') onProgress({ done, total })
        }
        report()
        const progress = {
            setTotal: (nextTotal) => {
                const normalized = Number(nextTotal)
                if (!Number.isFinite(normalized) || normalized < 1) return
                const safeTotal = Math.floor(normalized)
                if (safeTotal === fileTotal) return
                total += safeTotal - fileTotal
                fileTotal = safeTotal
                report()
            },
            advance: (step = 1) => {
                const normalized = Number(step)
                if (!Number.isFinite(normalized) || normalized <= 0) return
                const safeStep = Math.floor(normalized)
                fileDone += safeStep
                done += safeStep
                report()
            },
        }
        try {
            const result = await importFile(file, progress)
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
            // 未上报进度的文件（如解析失败）：按 1 计，保证进度条可前进
            if (fileTotal === 0) {
                fileTotal = 1
                total += 1
            }
            if (fileDone < fileTotal) done += fileTotal - fileDone
            report()
        }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const restoredCount = results.filter((r) => r.status === 'restored').length
    const failCount = results.filter(
        (r) => r.status !== 'success' && r.status !== 'restored',
    ).length
    const okCount = successCount + restoredCount
    return { results, okCount, successCount, restoredCount, failCount }
}
