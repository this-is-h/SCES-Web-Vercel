// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { fileSystemManager } from '@/utils/FileSystemManager'
import { embedEvidenceFilesForExport, normalizeEvidenceFiles } from '@/utils/studentStorage'
import { createHash } from 'node:crypto'

vi.mock('@/utils/FileSystemManager', () => ({
    fileSystemManager: { getFileHandle: vi.fn(), writeFile: vi.fn() },
}))
afterEach(() => vi.resetAllMocks())

it.each([0, 1, 2, 1024 * 1024 - 1, 1024 * 1024, 1024 * 1024 + 1, 2 * 1024 * 1024 + 7])(
    'preserves all %i attachment bytes across export and import',
    async (size) => {
        const bytes = Uint8Array.from({ length: size }, (_, i) => i % 251)
        const file = new File([bytes], 'evidence.bin', { type: 'application/octet-stream' })
        fileSystemManager.getFileHandle.mockResolvedValue({ getFile: async () => file })
        const student = {
            data: {
                personal: { 姓名: { data: '学生' }, 学号: { data: '1001' } },
                dyf: { 德育: [[{ support: { files: ['evidence.bin'] } }]] },
            },
        }
        const exported = await embedEvidenceFilesForExport({ semester: '2026-1', student })
        const content = exported.data.dyf.德育[0][0].support.files[0].content
        const expected = `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}`
        const digest = (value) => createHash('sha256').update(value).digest('hex')
        expect(digest(content)).toBe(digest(expected))
        expect(student.data.dyf.德育[0][0].support.files).toEqual(['evidence.bin'])
        fileSystemManager.getFileHandle.mockRejectedValue(new Error('Not found'))
        await normalizeEvidenceFiles(exported, '/evidence')
        const [path, blob] = fileSystemManager.writeFile.mock.calls[0]
        expect(path).toBe('/evidence/evidence.bin')
        expect(digest(new Uint8Array(await blob.arrayBuffer()))).toBe(digest(bytes))
        expect(exported.data.dyf.德育[0][0].support.files).toEqual(['evidence.bin'])
    },
)
