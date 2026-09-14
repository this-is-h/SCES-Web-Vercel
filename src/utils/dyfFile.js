import {
    aesGcmDecryptChunk,
    aesGcmEncryptChunk,
    base64ToBytes,
    bytesToBase64,
    bytesToUtf8,
    importRsaPrivateKey,
    importRsaPublicKey,
    randomBytes,
    rsaDecrypt,
    rsaEncrypt,
    utf8ToBytes,
} from '@/utils/crypto'
import { safeJsonParse } from '@/utils/json'
import { fileSystemManager } from '@/utils/FileSystemManager'
import { getStudentFolderName, getStudentDir, scopePath } from '@/utils/studentStorage'

export const DYF_SCHEMA_VERSION = 5
export const DYF_MAGIC = 'SCESDYF'
export const DYF_FORMAT_VERSION = 5
export const DEFAULT_DYF_CHUNK_SIZE = 4 * 1024 * 1024
const MIN_CHUNK = 1024
const MAX_CHUNK = 64 * 1024 * 1024
const FRAME_HEADER_SIZE = 17 // kind u8 | frameIndex u32 | streamId u32 | plainLen u32 | cipherLen u32
const FRAME_TAG_BYTES = 16
const MANIFEST_STREAM = 0xffffffff
const KIND_MANIFEST = 0
const KIND_ASSET = 1
const KIND_STUDENT = 2

// 旧版（v3 inline / 裸 JSON）体积硬上限：整文件必须能装进一个 JS 字符串（V8 ≈536MB）。
const LEGACY_INLINE_MAX_BYTES = 400 * 1024 * 1024

// ---- 小工具 ----

const ascii7 = (value) => {
    const out = new Uint8Array(7)
    for (let i = 0; i < 7; i++) out[i] = value.charCodeAt(i) & 0xff
    return out
}

const concatBytes = (...parts) => {
    const total = parts.reduce((s, p) => s + p.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const part of parts) {
        out.set(part, offset)
        offset += part.length
    }
    return out
}

const sha256Hex = async (bytes) => {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const packFrameHeader = ({ kind, frameIndex, streamId, plainLen, cipherLen }) => {
    const buf = new ArrayBuffer(FRAME_HEADER_SIZE)
    const view = new DataView(buf)
    view.setUint8(0, kind)
    view.setUint32(1, frameIndex, false)
    view.setUint32(5, streamId, false)
    view.setUint32(9, plainLen, false)
    view.setUint32(13, cipherLen, false)
    return new Uint8Array(buf)
}

const unpackFrameHeader = (bytes) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return {
        kind: view.getUint8(0),
        frameIndex: view.getUint32(1, false),
        streamId: view.getUint32(5, false),
        plainLen: view.getUint32(9, false),
        cipherLen: view.getUint32(13, false),
    }
}

const computeFrameCount = (byteLength, chunkSize) => Math.ceil(byteLength / chunkSize)

const splitRanges = (byteLength, chunkSize) => {
    const ranges = []
    if (byteLength <= 0) return ranges
    for (let start = 0; start < byteLength; start += chunkSize) {
        ranges.push({ start, end: Math.min(start + chunkSize, byteLength) })
    }
    return ranges
}

// ---- 证据源 / 学生 JSON 中的证据引用处理 ----

// 流式解码 data URL → Uint8Array（分块 atob，避免超大 base64 字符串整段驻留）。
const decodeDataUrlToBytes = (dataUrl) => {
    const match = String(dataUrl).match(/^data:([^;,]+)(?:;charset=[^;,]*)?;base64,([\s\S]*)$/)
    if (!match) return null
    const mime = match[1]
    const b64 = match[2]
    const CHUNK = 0x8000 - (0x8000 % 4) // 4 的倍数，保证分块 atob 对齐
    const parts = []
    for (let i = 0; i < b64.length; i += CHUNK) {
        const bin = atob(b64.slice(i, i + CHUNK))
        const bytes = new Uint8Array(bin.length)
        for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j)
        parts.push(bytes)
    }
    return { bytes: concatBytes(...parts), mime }
}

// 读取一个证据条目为 {size, mime, name, readSlice}；支持磁盘路径、内存 dataURL、File。
const openEvidenceSource = async (entry, studentEvidenceDir) => {
    if (typeof entry === 'string') {
        const trimmed = entry.trim()
        if (!trimmed) return null
        const fh = await fileSystemManager.getFileHandle(`${studentEvidenceDir}/${trimmed}`, false)
        const file = await fh.getFile()
        return {
            name: trimmed,
            mime: file.type || 'application/octet-stream',
            size: file.size,
            readSlice: async (start, end) =>
                new Uint8Array(await file.slice(start, end).arrayBuffer()),
        }
    }
    if (entry && typeof entry === 'object') {
        const name = String(entry?.file?.name ?? '').trim() || 'evidence.bin'
        if (typeof entry.content === 'string' && entry.content.startsWith('data:')) {
            const decoded = decodeDataUrlToBytes(entry.content)
            if (!decoded || decoded.bytes.length === 0) return null
            return {
                name,
                mime: decoded.mime || 'application/octet-stream',
                size: decoded.bytes.length,
                readSlice: async (start, end) => decoded.bytes.subarray(start, end),
            }
        }
        const file = entry.file
        if (file && typeof file.slice === 'function' && Number.isFinite(file.size)) {
            if (file.size < 1) return null
            return {
                name: String(file.name || name),
                mime: file.type || 'application/octet-stream',
                size: file.size,
                readSlice: async (start, end) =>
                    new Uint8Array(await file.slice(start, end).arrayBuffer()),
            }
        }
    }
    return null
}

const walkStudentEvidence = (student) => {
    const out = []
    const dyf = student?.data?.dyf
    if (!dyf || typeof dyf !== 'object' || Array.isArray(dyf)) return out
    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        for (let g = 0; g < groups.length; g++) {
            const group = groups[g]
            if (!Array.isArray(group)) continue
            for (let i = 0; i < group.length; i++) {
                const files = group[i]?.support?.files
                if (!Array.isArray(files)) continue
                for (let f = 0; f < files.length; f++) {
                    out.push({
                        category: categoryName,
                        group: g,
                        item: i,
                        file: f,
                        entry: files[f],
                    })
                }
            }
        }
    }
    return out
}

const setStudentRef = (student, loc, ref) => {
    const files = student?.data?.dyf?.[loc.category]?.[loc.group]?.[loc.item]?.support?.files
    if (Array.isArray(files) && files[loc.file] !== undefined) files[loc.file] = ref
}

// 学生 JSON 内的 ref → 磁盘文件名 / 占位（依是否成功落盘）。
const rewriteStudentRefs = (student, writtenNames, assets) => {
    const dyf = student?.data?.dyf
    if (!dyf || typeof dyf !== 'object' || Array.isArray(dyf)) return
    for (const categoryName of Object.keys(dyf)) {
        const groups = dyf[categoryName]
        if (!Array.isArray(groups)) continue
        for (let g = 0; g < groups.length; g++) {
            const group = groups[g]
            if (!Array.isArray(group)) continue
            for (let i = 0; i < group.length; i++) {
                const files = group[i]?.support?.files
                if (!Array.isArray(files)) continue
                for (let f = 0; f < files.length; f++) {
                    const entry = files[f]
                    if (entry && typeof entry === 'object' && Number.isInteger(entry.ref)) {
                        const name = writtenNames.get(entry.ref)
                        files[f] = name
                            ? name
                            : { file: { name: assets[entry.ref]?.n || '' }, ref: entry.ref }
                    }
                }
            }
        }
    }
}

const identityOf = (s) => ({
    name: String(s?.data?.personal?.姓名?.data ?? '').trim(),
    id: String(s?.data?.personal?.学号?.data ?? '').trim(),
})

// 学生素材目录与文件夹键：与 studentStorage.getStudentDir / getStudentFolderName 完全一致，
// 确保导出、导入落盘、读取三处使用相同路径，证据不会因命名差异丢失。
const studentEvidenceDir = (scope, semester, { name, id }) => {
    const dir = getStudentDir({ scope, semester, name, id })
    return `${dir}/evidence`
}
const folderKeyOf = ({ name, id }) => getStudentFolderName({ name, id })

/**
 * 导入端证据落盘器：将资产 Blob 写入目标学生目录（与 writeStudentToDisk 路径一致），
 * 返回最终落盘文件名，供容器把学生 JSON 中的 ref 还原为磁盘名。
 * folderKey 即 getStudentFolderName 结果（"姓名_学号"），直接使用，避免二次拆分。
 *
 * @param {'class'|'grade'|'student'} scope
 * @param {string} semester
 */
export const makeImportEvidenceSink = ({ scope, semester }) => {
    return async ({ folderKey, name, blob }) => {
        if (!folderKey || !name) return null
        try {
            const dir = scopePath(scope, `semesters/${semester}/students/${folderKey}/evidence`)
            await fileSystemManager.writeFile(`${dir}/${name}`, blob)
            return name
        } catch {
            return null
        }
    }
}

export const createDyfFileBlob = async ({
    type,
    semester,
    classInfo,
    students,
    serverConfig,
    chunkSize = DEFAULT_DYF_CHUNK_SIZE,
    onProgress,
}) => {
    if (type !== 'student' && type !== 'class' && type !== 'grade') {
        throw new Error('dyf 导出必须指定 type（student/class/grade）')
    }
    if (!Number.isInteger(chunkSize) || chunkSize < MIN_CHUNK || chunkSize > MAX_CHUNK) {
        throw new Error('dyf 分帧大小必须位于 1KiB–64MiB 之间')
    }

    const cfg = serverConfig ?? {}
    const encryption = cfg.encryption ?? {}
    const encrypted = Boolean(encryption.enabled && encryption.rsaPublicKeyJwk)
    if (encryption.enabled && !encryption.rsaPublicKeyJwk) {
        throw new Error('服务器已启用加密但缺少公钥，无法导出')
    }

    const list = Array.from(students || [])
    if (!list.length) throw new Error('没有可导出的学生数据')

    const manifest = {
        format: 'sces-dyf-web',
        formatVersion: DYF_FORMAT_VERSION,
        type,
        semester: semester ?? null,
        class: classInfo ?? null,
        createdAt: Date.now(),
        students: [],
        assets: [],
    }
    const studentBlobs = []
    const assetSources = [] // 与 manifest.assets 同序

    for (let si = 0; si < list.length; si++) {
        const original = list[si]
        const { name, id } = identityOf(original)
        const material = safeJsonParse(JSON.stringify(original))
        if (!material || typeof material !== 'object') {
            throw new Error(`学生 #${si + 1}（${name || '?'}）序列化失败`)
        }
        const fk = name && id ? folderKeyOf({ name, id }) : ''
        if (fk) {
            const evidenceDir = studentEvidenceDir(type, semester, { name, id })
            const locs = walkStudentEvidence(material)
            for (const loc of locs) {
                let source = null
                try {
                    source = await openEvidenceSource(loc.entry, evidenceDir)
                } catch {
                    source = null
                }
                if (!source) {
                    // 证据文件缺失/不可读：原样保留该条目（字符串名或对象），不阻塞导出。
                    continue
                }
                const assetIdx = manifest.assets.length
                assetSources.push(source)
                manifest.assets.push({
                    s: si,
                    c: loc.category,
                    g: loc.group,
                    i: loc.item,
                    f: loc.file,
                    n: source.name,
                    m: source.mime,
                    z: source.size,
                })
                setStudentRef(material, loc, { ref: assetIdx })
            }
        }
        const json = JSON.stringify(material)
        const bytes = utf8ToBytes(json)
        const sha = await sha256Hex(bytes)
        manifest.students.push({
            n: bytes.length,
            f: computeFrameCount(bytes.length, chunkSize),
            h: sha,
            k: fk,
        })
        studentBlobs.push(new Blob([bytes]))
        if (onProgress) onProgress({ stage: 'collect', done: si + 1, total: list.length })
        if ((si & 7) === 7) await new Promise((r) => setTimeout(r, 0))
    }

    const manifestBytes = utf8ToBytes(JSON.stringify(manifest))
    const manifestSha = await sha256Hex(manifestBytes)
    const manifestFrames = Math.max(1, computeFrameCount(manifestBytes.length, chunkSize))
    const assetFrames = manifest.assets.reduce(
        (s, a) => s + Math.max(1, computeFrameCount(a.z, chunkSize)),
        0,
    )
    const studentFrames = manifest.students.reduce((s, e) => s + e.f, 0)
    const frameCount = manifestFrames + assetFrames + studentFrames

    const keyBytes = randomBytes(32)
    const fixedIv = randomBytes(12)
    let headerKey = null
    if (encrypted) {
        const publicKey = await importRsaPublicKey({
            jwk: encryption.rsaPublicKeyJwk,
            algorithm: encryption.rsaAlgorithm,
        })
        headerKey = bytesToBase64(await rsaEncrypt({ publicKey, data: keyBytes }))
    }

    const header = {
        format: 'sces-dyf-web',
        formatVersion: DYF_FORMAT_VERSION,
        type,
        encrypted,
        algorithm: encrypted ? 'AES-256-GCM-FRAME-v1' : 'PLAIN-FRAME-v1',
        chunkSize,
        frameCount,
        manifestSize: manifestBytes.length,
        manifestFrameCount: manifestFrames,
        manifestHash: manifestSha,
        studentCount: manifest.students.length,
        assetCount: manifest.assets.length,
        students: manifest.students,
        assets: manifest.assets.map((a) => ({
            s: a.s,
            c: a.c,
            g: a.g,
            i: a.i,
            f: a.f,
            n: a.n,
            m: a.m,
            z: a.z,
        })),
        createdAt: manifest.createdAt,
        key: headerKey,
        iv: bytesToBase64(fixedIv),
    }
    const headerBytes = utf8ToBytes(JSON.stringify(header))
    const headerLenBuf = new ArrayBuffer(8)
    new DataView(headerLenBuf).setBigUint64(0, BigInt(headerBytes.length), false)

    const parts = []
    let pending = []
    let pendingBytes = 0
    const FLUSH_BYTES = 64 * 1024 * 1024
    const flush = () => {
        if (!pending.length) return
        parts.push(new Blob(pending))
        pending = []
        pendingBytes = 0
    }
    const emit = (bytes) => {
        pending.push(bytes)
        pendingBytes += bytes.length
        if (pendingBytes >= FLUSH_BYTES) flush()
    }

    const aesKey = encrypted
        ? await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
        : null

    let frameIndex = 0
    const emitFrame = async (kind, streamId, plainBytes) => {
        const cipherPart = encrypted
            ? await aesGcmEncryptChunk({
                  key: aesKey,
                  fixedIv,
                  chunkIndex: frameIndex,
                  plaintextBytes: plainBytes,
              })
            : plainBytes
        emit(
            packFrameHeader({
                kind,
                frameIndex,
                streamId,
                plainLen: plainBytes.length,
                cipherLen: cipherPart.length,
            }),
        )
        emit(cipherPart)
        frameIndex += 1
        if (onProgress) onProgress({ stage: 'write', done: frameIndex, total: frameCount })
    }

    emit(
        concatBytes(
            ascii7(DYF_MAGIC),
            new Uint8Array([DYF_FORMAT_VERSION]),
            new Uint8Array(headerLenBuf),
            headerBytes,
        ),
    )

    // manifest 帧（至少 1 帧）
    const manifestRanges = splitRanges(manifestBytes.length, chunkSize)
    if (manifestRanges.length === 0) {
        await emitFrame(KIND_MANIFEST, MANIFEST_STREAM, new Uint8Array(0))
    } else {
        for (const { start, end } of manifestRanges) {
            await emitFrame(KIND_MANIFEST, MANIFEST_STREAM, manifestBytes.subarray(start, end))
        }
    }

    // 资产帧：逐块从磁盘/File 读，逐块加密写出，内存峰值 = 1 块
    for (let ai = 0; ai < manifest.assets.length; ai++) {
        const asset = manifest.assets[ai]
        const source = assetSources[ai]
        let written = 0
        const ranges = splitRanges(asset.z, chunkSize)
        if (ranges.length === 0) {
            await emitFrame(KIND_ASSET, ai, new Uint8Array(0))
        } else {
            for (const { start, end } of ranges) {
                const chunk = await source.readSlice(start, end)
                if (!chunk || chunk.length !== end - start) {
                    throw new Error(`证据文件读取不完整：${asset.n}`)
                }
                await emitFrame(KIND_ASSET, ai, chunk)
                written += chunk.length
            }
        }
        if (written !== asset.z) {
            throw new Error(`证据文件大小不一致：${asset.n}（声明 ${asset.z}，实际 ${written}）`)
        }
        assetSources[ai] = null
        if ((ai & 63) === 63) await new Promise((r) => setTimeout(r, 0))
    }

    // 学生帧
    for (let si = 0; si < studentBlobs.length; si++) {
        const entry = manifest.students[si]
        const blob = studentBlobs[si]
        let written = 0
        for (const { start, end } of splitRanges(entry.n, chunkSize)) {
            const buf = await blob.slice(start, end).arrayBuffer()
            await emitFrame(KIND_STUDENT, si, new Uint8Array(buf))
            written += end - start
        }
        if (written !== entry.n) throw new Error('学生帧写入不完整')
        studentBlobs[si] = null
        if ((si & 63) === 63) await new Promise((r) => setTimeout(r, 0))
    }
    flush()

    if (frameIndex !== frameCount) {
        throw new Error(`dyf 帧数不一致：写入 ${frameIndex}，预期 ${frameCount}`)
    }
    return new Blob(parts, { type: 'application/octet-stream' })
}

// ---- 导入（读容器）----

const readAt = async (file, offset, length) => {
    if (offset < 0 || length < 0 || offset + length > file.size) {
        throw new Error('文件已截断（帧不完整）')
    }
    const buf = await file.slice(offset, offset + length).arrayBuffer()
    if (buf.byteLength !== length) throw new Error('文件已截断（读取字节不足）')
    return new Uint8Array(buf)
}

/**
 * 流式解析一个 .dyf 文件（v5 容器 / v3 inline / 裸 JSON）。
 *
 * @param {object} options
 * @param {File} options.file
 * @param {object} options.serverConfig
 * @param {object|null} options.privateKeyJwk
 * @param {(student: any, meta: {type: string, semester: any, classInfo: any, count: number}) => Promise<void>|void} options.onStudent
 * @param {(meta: object) => void} [options.onMeta]
 * @param {(asset: {si: number, category: string, group: number, item: number, fileIndex: number, name: string, mime: string, blob: Blob}) => Promise<string|null>|string|null} [options.evidenceSink]
 *        提供时：资产帧解密后拼装为 Blob 交给 sink 落盘，返回磁盘文件名并自动替换学生 JSON 中的 ref。
 * @param {(p: {stage: string, done: number, total: number}) => void} [options.onProgress]
 * @returns {Promise<{ok: boolean, type?: string, count?: number, message?: string}>}
 */
export const parseDyfFile = async ({
    file,
    serverConfig,
    privateKeyJwk,
    onStudent,
    onMeta,
    evidenceSink,
    onProgress,
}) => {
    try {
        return await parseDyfFileInner({
            file,
            serverConfig,
            privateKeyJwk,
            onStudent,
            onMeta,
            evidenceSink,
            onProgress,
        })
    } catch (e) {
        const msg = e?.message || String(e)
        if (/截断|不完整|无效|损坏|不一致|失败/.test(msg))
            return { ok: false, message: `文件已损坏或不是有效的 .dyf 文件：${msg}` }
        if (/Unsupported|OperationError|decrypt/i.test(msg))
            return { ok: false, message: '解密失败：密钥不匹配或文件已损坏' }
        return { ok: false, message: msg }
    }
}

const parseDyfFileInner = async ({
    file,
    serverConfig,
    privateKeyJwk,
    onStudent,
    onMeta,
    evidenceSink,
    onProgress,
}) => {
    if (!file || !Number.isFinite(file.size) || file.size <= 0) {
        return { ok: false, message: '文件为空或不可读' }
    }

    const magic = await readAt(file, 0, 8)
    const magicText = String.fromCharCode(...magic.subarray(0, 7))
    if (magicText !== DYF_MAGIC || magic[7] > DYF_FORMAT_VERSION) {
        return await parseLegacyInline({ file, serverConfig, privateKeyJwk, onStudent, onMeta })
    }
    const formatVersion = magic[7]
    if (formatVersion < DYF_FORMAT_VERSION) {
        return {
            ok: false,
            message: `不支持的 dyf 容器版本：v${formatVersion}（请用 v${DYF_FORMAT_VERSION} 重新导出）`,
        }
    }

    const lenBuf = await readAt(file, 8, 8)
    const headerLen = Number(
        new DataView(lenBuf.buffer, lenBuf.byteOffset, lenBuf.byteLength).getBigUint64(0, false),
    )
    if (headerLen < 2 || headerLen > 32 * 1024 * 1024)
        return { ok: false, message: 'dyf 头部长度无效' }
    const header = safeJsonParse(bytesToUtf8(await readAt(file, 16, headerLen)))
    if (!header || typeof header !== 'object') return { ok: false, message: 'dyf 头部解析失败' }
    const headerCheck = validateHeader(header, file.size)
    if (headerCheck) return { ok: false, message: headerCheck }

    const encrypted = header.encrypted === true
    if (encrypted && !privateKeyJwk) return { ok: false, message: '缺少私钥，无法解密导入文件' }

    let aesKey = null
    const fixedIv = base64ToBytes(header.iv)
    if (encrypted) {
        let keyBytes
        try {
            const algorithm = serverConfig?.encryption?.rsaAlgorithm
            const privateKey = await importRsaPrivateKey({ jwk: privateKeyJwk, algorithm })
            keyBytes = await rsaDecrypt({ privateKey, data: base64ToBytes(header.key) })
        } catch {
            return { ok: false, message: '私钥与文件不匹配（或私钥损坏），无法解密' }
        }
        if (keyBytes.length !== 32 || fixedIv.length !== 12) {
            return { ok: false, message: 'dyf 会话密钥参数无效' }
        }
        aesKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
            'decrypt',
        ])
    }

    const chunkSize = header.chunkSize
    const totalFrames = header.frameCount
    let offset = 16 + headerLen
    let frameSeq = 0

    const readFrame = async () => {
        if (frameSeq >= totalFrames) throw new Error('帧数超出文件声明')
        const fh = unpackFrameHeader(await readAt(file, offset, FRAME_HEADER_SIZE))
        offset += FRAME_HEADER_SIZE
        if (fh.frameIndex !== frameSeq) throw new Error('帧顺序错误（文件可能损坏）')
        if (fh.kind !== KIND_MANIFEST && fh.kind !== KIND_ASSET && fh.kind !== KIND_STUDENT) {
            throw new Error('未知帧类型')
        }
        if (fh.plainLen > chunkSize || fh.cipherLen > chunkSize + FRAME_TAG_BYTES) {
            throw new Error('帧长度无效')
        }
        const cipherBytes = await readAt(file, offset, fh.cipherLen)
        offset += fh.cipherLen
        let plain
        if (encrypted) {
            if (fh.cipherLen !== fh.plainLen + FRAME_TAG_BYTES) throw new Error('帧密文长度无效')
            try {
                plain = await aesGcmDecryptChunk({
                    key: aesKey,
                    fixedIv,
                    chunkIndex: frameSeq,
                    ciphertextBytes: cipherBytes,
                })
            } catch {
                throw new Error('帧认证失败（文件损坏或非本密钥加密）')
            }
            if (plain.length !== fh.plainLen) throw new Error('帧明文长度不匹配')
        } else {
            plain = cipherBytes
        }
        frameSeq += 1
        return { kind: fh.kind, streamId: fh.streamId, plain }
    }

    // 1) manifest
    const manifestChunks = []
    let manifestReceived = 0
    let manifest = null
    while (manifest === null && frameSeq < header.manifestFrameCount) {
        const f = await readFrame()
        if (f.kind !== KIND_MANIFEST || f.streamId !== MANIFEST_STREAM) {
            throw new Error('manifest 帧顺序无效')
        }
        manifestChunks.push(f.plain)
        manifestReceived += f.plain.length
        if (onProgress) onProgress({ stage: 'read', done: frameSeq, total: totalFrames })
        if (manifestReceived >= header.manifestSize) {
            const all = concatBytes(...manifestChunks)
            if (all.length !== header.manifestSize) throw new Error('manifest 长度不匹配')
            const sha = await sha256Hex(all)
            if (sha !== header.manifestHash) throw new Error('manifest 完整性校验失败')
            const parsed = safeJsonParse(bytesToUtf8(all))
            if (!parsed || typeof parsed !== 'object') throw new Error('manifest 内容无效')
            if (parsed.formatVersion !== DYF_FORMAT_VERSION || parsed.type !== header.type) {
                throw new Error('manifest 与头部不一致')
            }
            if (
                !Array.isArray(parsed.students) ||
                parsed.students.length !== header.studentCount ||
                parsed.students.some(
                    (e, i) => e?.n !== header.students[i]?.n || e?.h !== header.students[i]?.h,
                )
            ) {
                throw new Error('manifest 学生索引与头部不一致')
            }
            manifest = parsed
        }
    }
    if (manifest === null) throw new Error('manifest 帧缺失')
    if (frameSeq !== header.manifestFrameCount) throw new Error('manifest 帧数量不匹配')

    const assets = Array.isArray(manifest.assets) ? manifest.assets : []
    if (assets.length !== header.assetCount) throw new Error('manifest 资产索引与头部不一致')
    for (const a of assets) {
        if (
            !Number.isInteger(a?.s) ||
            a.s < 0 ||
            a.s >= header.studentCount ||
            !Number.isInteger(a?.z) ||
            a.z < 0 ||
            typeof a?.n !== 'string'
        ) {
            throw new Error('manifest 资产项无效')
        }
    }

    const meta = {
        type: header.type,
        semester: manifest.semester ?? null,
        classInfo: manifest.class ?? null,
        count: header.studentCount,
    }
    if (onMeta) onMeta(meta)

    // 2) 资产帧：逐资产拼装 → sink 落盘 → 释放
    const writtenNames = new Map()
    for (let ai = 0; ai < assets.length; ai++) {
        const a = assets[ai]
        const expectedFrames = Math.max(1, computeFrameCount(a.z, chunkSize))
        const chunks = []
        let received = 0
        for (let k = 0; k < expectedFrames; k++) {
            const f = await readFrame()
            if (f.kind !== KIND_ASSET || f.streamId !== ai) throw new Error('资产帧顺序错误')
            chunks.push(f.plain)
            received += f.plain.length
            if (onProgress) onProgress({ stage: 'read', done: frameSeq, total: totalFrames })
        }
        if (received !== a.z) throw new Error(`资产大小不匹配：${a.n}`)
        if (a.z > 0 && evidenceSink) {
            try {
                const studentKey = manifest.students[a.s]?.k || ''
                const stored = await evidenceSink({
                    si: a.s,
                    folderKey: studentKey,
                    category: a.c,
                    group: a.g,
                    item: a.i,
                    fileIndex: a.f,
                    name: a.n,
                    mime: a.m,
                    blob: new Blob(chunks, { type: a.m }),
                })
                if (stored) writtenNames.set(ai, stored)
            } catch {
                /* 落盘失败：保留 ref 占位 */
            }
        }
        chunks.length = 0
        if ((ai & 15) === 15) await new Promise((r) => setTimeout(r, 0))
    }

    // 3) 学生帧
    for (let si = 0; si < manifest.students.length; si++) {
        const entry = manifest.students[si]
        if (!Number.isInteger(entry.n) || entry.n < 1) throw new Error('学生帧索引无效')
        const chunks = []
        let received = 0
        const expectedFrames = computeFrameCount(entry.n, chunkSize)
        for (let k = 0; k < expectedFrames; k++) {
            const f = await readFrame()
            if (f.kind !== KIND_STUDENT) throw new Error('学生帧顺序错误（文件损坏）')
            if (f.streamId !== si) throw new Error('学生帧交错（文件损坏）')
            chunks.push(f.plain)
            received += f.plain.length
            if (onProgress) onProgress({ stage: 'read', done: frameSeq, total: totalFrames })
        }
        if (received !== entry.n) throw new Error('学生数据大小不匹配')
        const bytes = concatBytes(...chunks)
        const sha = await sha256Hex(bytes)
        if (sha !== entry.h) throw new Error('学生数据完整性校验失败')
        let student
        try {
            student = JSON.parse(bytesToUtf8(bytes))
        } catch {
            throw new Error('学生数据 JSON 解析失败')
        }
        rewriteStudentRefs(student, writtenNames, assets)
        const ret = await onStudent(student, meta)
        if (ret === false) {
            // 调用方提前停止（如预览）：跳过完整性尾检
            return { ok: true, type: header.type, count: si + 1, stopped: true }
        }
        if ((si & 31) === 0) await new Promise((r) => setTimeout(r, 0))
    }

    if (frameSeq !== header.frameCount) throw new Error('帧数量与头部不一致')
    if (offset !== file.size) throw new Error('文件包含多余数据（可能损坏）')

    return { ok: true, type: header.type, count: header.studentCount }
}

const validateHeader = (header, fileSize) => {
    if (header.format !== 'sces-dyf-web') return 'dyf 容器格式标识不支持'
    if (header.formatVersion !== DYF_FORMAT_VERSION) return 'dyf 容器版本不支持'
    if (header.type !== 'student' && header.type !== 'class' && header.type !== 'grade')
        return 'dyf 业务类型不支持'
    if (header.encrypted !== true && header.encrypted !== false) return 'dyf 加密标记缺失'
    if (header.algorithm !== 'AES-256-GCM-FRAME-v1' && header.algorithm !== 'PLAIN-FRAME-v1') {
        return 'dyf 算法不支持'
    }
    if (
        !Number.isInteger(header.chunkSize) ||
        header.chunkSize < MIN_CHUNK ||
        header.chunkSize > MAX_CHUNK
    ) {
        return 'dyf 分帧大小无效'
    }
    if (!Number.isInteger(header.frameCount) || header.frameCount < 1) return 'dyf 帧数无效'
    if (!Number.isInteger(header.manifestSize) || header.manifestSize < 2)
        return 'dyf manifest 大小无效'
    if (header.manifestSize > 64 * 1024 * 1024) return 'dyf manifest 异常过大'
    if (!Number.isInteger(header.manifestFrameCount) || header.manifestFrameCount < 1) {
        return 'dyf manifest 帧数无效'
    }
    if (!/^[0-9a-f]{64}$/.test(String(header.manifestHash))) return 'dyf manifest 哈希无效'
    if (!Number.isInteger(header.studentCount) || header.studentCount < 1) return 'dyf 学生数量无效'
    if (header.studentCount > 2_000_000) return 'dyf 学生数量异常'
    if (!Array.isArray(header.students) || header.students.length !== header.studentCount) {
        return 'dyf 学生索引缺失'
    }
    let studentFrames = 0
    for (const e of header.students) {
        if (
            !e ||
            !Number.isInteger(e.n) ||
            e.n < 1 ||
            !Number.isInteger(e.f) ||
            e.f < 1 ||
            !/^[0-9a-f]{64}$/.test(String(e.h))
        ) {
            return 'dyf 学生索引项无效'
        }
        if (e.f !== computeFrameCount(e.n, header.chunkSize)) return 'dyf 学生帧数与大小不一致'
        studentFrames += e.f
    }
    if (!Number.isInteger(header.assetCount) || header.assetCount < 0) return 'dyf 资产数量无效'
    if (header.assetCount > 20_000_000) return 'dyf 资产数量异常'
    if (studentFrames > header.frameCount) return 'dyf 学生帧数超过总帧数'
    if (header.encrypted === true && (!header.key || !header.iv)) return 'dyf 加密参数缺失'
    const minFile = 16 + studentFrames * FRAME_HEADER_SIZE
    if (fileSize < minFile) return '文件已截断（帧头不足）'
    return null
}

// ---- 旧格式（v3 inline / 裸 JSON）----

/**
 * 解析 .dyf 文本（v3 单块 JSON / 更早的裸学生 JSON）。仅供历史导出回退。
 */
export const parseDyfText = async ({ text, serverConfig, privateKeyJwk }) => {
    const parsed = safeJsonParse(text)
    if (!parsed) return { ok: false, message: '文件格式不正确，无法解析为 JSON' }

    if (parsed.schemaVersion >= 3 && parsed.type && parsed.encrypted === false) {
        return { ok: true, type: parsed.type, payload: parsed.data }
    }

    if (parsed.schemaVersion >= 3 && parsed.type && parsed.encrypted === true) {
        if (!privateKeyJwk) return { ok: false, message: '缺少私钥，无法解密导入文件' }
        const cfg = serverConfig ?? {}
        const encryption = cfg.encryption ?? {}
        const algorithm = parsed.alg?.rsa ?? encryption.rsaAlgorithm
        try {
            const privateKey = await importRsaPrivateKey({ jwk: privateKeyJwk, algorithm })
            const keyBytes = await rsaDecrypt({ privateKey, data: base64ToBytes(parsed.key) })
            const aesKey = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-GCM' },
                false,
                ['decrypt'],
            )
            const plaintextBytes = await aesGcmDecryptChunk({
                key: aesKey,
                fixedIv: base64ToBytes(parsed.iv),
                chunkIndex: 0,
                ciphertextBytes: base64ToBytes(parsed.data),
            })
            const payload = safeJsonParse(bytesToUtf8(plaintextBytes))
            if (!payload) return { ok: false, message: '解密成功但内容解析失败' }
            return { ok: true, type: parsed.type, payload }
        } catch (e) {
            return { ok: false, message: e?.message || '解密失败' }
        }
    }

    const possibleStudent = parsed?.data?.personal
        ? parsed
        : parsed?.data?.data?.personal
          ? parsed.data
          : parsed?.personal
            ? { data: parsed }
            : null
    if (possibleStudent) {
        return { ok: true, type: 'student', payload: possibleStudent }
    }

    return { ok: false, message: '无法识别的导入文件格式' }
}

/**
 * 生成 v3 单块 JSON 文本（学生端个人材料导出专用）。
 *
 * 班级/年级等批量材料一律使用 createDyfFileBlob 的流式容器；本函数仅保留给学生端单份材料
 * （体量可控），并采用与 v5 相同的流式安全原语（bytesToBase64 / 分块 AES-GCM），
 * 因此不再受旧实现 32 位 base64 长度上限与整段 spread 栈溢出影响。
 */
export const createDyfText = async ({ type, payload, serverConfig }) => {
    const cfg = serverConfig ?? {}
    const encryption = cfg.encryption ?? {}
    const enabled = Boolean(encryption.enabled && encryption.rsaPublicKeyJwk)
    if (encryption.enabled && !encryption.rsaPublicKeyJwk) {
        throw new Error('服务器已启用加密但缺少公钥，无法导出')
    }

    const plaintextBytes = utf8ToBytes(JSON.stringify(payload))

    if (!enabled) {
        return JSON.stringify({
            schemaVersion: DYF_SCHEMA_VERSION,
            type,
            encrypted: false,
            createdAt: Date.now(),
            data: payload,
        })
    }

    const publicKey = await importRsaPublicKey({
        jwk: encryption.rsaPublicKeyJwk,
        algorithm: encryption.rsaAlgorithm,
    })
    const keyBytes = randomBytes(32)
    const fixedIv = randomBytes(12)
    const aesKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
        'encrypt',
    ])
    const ciphertext = await aesGcmEncryptChunk({
        key: aesKey,
        fixedIv,
        chunkIndex: 0,
        plaintextBytes,
    })
    return JSON.stringify({
        schemaVersion: DYF_SCHEMA_VERSION,
        type,
        encrypted: true,
        createdAt: Date.now(),
        alg: { rsa: encryption.rsaAlgorithm, aes: 'AES-GCM' },
        iv: bytesToBase64(fixedIv),
        key: bytesToBase64(await rsaEncrypt({ publicKey, data: keyBytes })),
        data: bytesToBase64(ciphertext),
    })
}

const parseLegacyInline = async ({ file, serverConfig, privateKeyJwk, onStudent, onMeta }) => {
    if (file.size > LEGACY_INLINE_MAX_BYTES) {
        return {
            ok: false,
            message:
                '该旧版文件过大（旧格式无法流式解析）。请用新版重新导出；旧版超大文件仅支持管理端导入。',
        }
    }
    const text = await file.text()
    const legacy = await parseDyfText({ text, serverConfig, privateKeyJwk })
    if (!legacy.ok) return { ok: false, message: legacy.message }
    const payload = legacy.payload
    if (legacy.type === 'class') {
        const stuList = Array.isArray(payload?.students) ? payload.students : []
        const meta = {
            type: 'class',
            semester: payload?.semester ?? null,
            classInfo: payload?.class ?? null,
            count: stuList.length,
        }
        if (onMeta) onMeta(meta)
        for (const s of stuList) await onStudent(s, meta)
        return { ok: true, type: 'class', count: stuList.length }
    }
    const meta = { type: 'student', semester: null, classInfo: null, count: 1 }
    if (onMeta) onMeta(meta)
    await onStudent(payload, meta)
    return { ok: true, type: 'student', count: 1 }
}
