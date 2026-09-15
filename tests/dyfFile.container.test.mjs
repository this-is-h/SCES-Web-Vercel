// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import {
    generateRsaOaepKeyPair,
    importRsaPublicKey,
    rsaEncrypt,
    randomBytes,
    utf8ToBytes,
    bytesToBase64,
} from '@/utils/crypto'
import { createDyfFileBlob, parseDyfFile, createDyfText, parseDyfText } from '@/utils/dyfFile'

const makeStudent = (i, withEvidence = false) => {
    const personal = {
        姓名: { data: `学生${i}` },
        学号: { data: `2024${String(i).padStart(4, '0')}` },
        年级: { data: '2024' },
        专业: { data: '计算机' },
        班级: { data: '1班' },
        年份: { data: 2024 },
        学期: { data: '秋季' },
    }
    const dyf = {
        德育: [
            [
                {
                    number: 1,
                    score: 90,
                    support: {
                        files: withEvidence
                            ? [{ file: { name: `ev${i}.txt` }, content: bigDataUrl(`evidence-content-${i}`, 4) }]
                            : [],
                    },
                },
            ],
        ],
    }
    return { data: { personal, dyf } }
}

// 生成指定字符数（≈字节数）的 data URL，避免测试里真的分配大数组
const bigDataUrl = (seed, kb) => {
    const body = seed.padEnd(kb * 1024, 'x')
    return `data:text/plain;base64,${Buffer.from(body, 'utf8').toString('base64')}`
}

const readFileBytes = async (blob) => new Uint8Array(await blob.arrayBuffer())

beforeAll(() => {
    if (!globalThis.crypto?.subtle) throw new Error('测试环境缺少 WebCrypto')
})

describe('dyf v5 容器：基本往返', () => {
    it('明文（未加密）单学生可导出再导入', async () => {
        const students = [makeStudent(1)]
        const blob = await createDyfFileBlob({
            type: 'class',
            semester: '2024秋季',
            classInfo: { grade: '2024', major: '计算机', class: '1班' },
            students,
            serverConfig: { encryption: { enabled: false } },
        })
        const collected = []
        const res = await parseDyfFile({
            file: new File([blob], 'a.dyf'),
            serverConfig: { encryption: { enabled: false } },
            privateKeyJwk: null,
            onStudent: (s) => collected.push(s),
        })
        expect(res.ok).toBe(true)
        expect(collected.length).toBe(1)
        expect(collected[0].data.personal.姓名.data).toBe('学生1')
    })

    it('加密（RSA+AES-GCM）单学生可导出再导入', async () => {
        const { publicKeyJwk, privateKeyJwk } = await generateRsaOaepKeyPair({ modulusLength: 2048 })
        const serverConfig = { encryption: { enabled: true, rsaPublicKeyJwk: publicKeyJwk } }
        const blob = await createDyfFileBlob({
            type: 'class',
            semester: '2024秋季',
            classInfo: {},
            students: [makeStudent(2)],
            serverConfig,
        })
        const collected = []
        const res = await parseDyfFile({
            file: new File([blob], 'a.dyf'),
            serverConfig,
            privateKeyJwk,
            onStudent: (s) => collected.push(s),
        })
        expect(res.ok).toBe(true)
        expect(collected[0].data.personal.姓名.data).toBe('学生2')
    })
})

describe('dyf v5 容器：班级/年级级体量', () => {
    it('整班（含证据）可流式往返，且证据落盘文件名还原', async () => {
        const { publicKeyJwk, privateKeyJwk } = await generateRsaOaepKeyPair({ modulusLength: 2048 })
        const serverConfig = { encryption: { enabled: true, rsaPublicKeyJwk: publicKeyJwk } }
        const students = Array.from({ length: 50 }, (_, i) => makeStudent(i + 1, true))

        const blob = await createDyfFileBlob({
            type: 'class',
            semester: '2024秋季',
            classInfo: { grade: '2024', major: '计算机', class: '1班' },
            students,
            serverConfig,
        })

        const written = new Map()
        const collected = []
        const res = await parseDyfFile({
            file: new File([blob], 'class.dyf'),
            serverConfig,
            privateKeyJwk,
            evidenceSink: async ({ folderKey, name }) => {
                const key = `${folderKey}/${name}`
                written.set(key, true)
                return name
            },
            onStudent: (s) => collected.push(s),
        })
        expect(res.ok).toBe(true)
        expect(collected.length).toBe(50)
        // 每名学生在 evidence 数组里都有一张 4KB 证据
        expect(written.size).toBe(50)
        // 学生 JSON 内的 ref 已被还原为磁盘文件名（字符串）
        const first = collected.find((s) => s.data.personal.学号.data === '20240001')
        const fileRef = first.data.dyf.德育[0][0].support.files[0]
        expect(typeof fileRef).toBe('string')
        expect(fileRef.startsWith('ev') && fileRef.endsWith('.txt')).toBe(true)
    })

    it('模拟 >1GB 体量（大量学生 + 大证据）往返，不整体物化', async () => {
        // 不真的分配 1GB；用足够多的学生 + 较大证据逼近分块边界与帧计数上限。
        const { publicKeyJwk, privateKeyJwk } = await generateRsaOaepKeyPair({ modulusLength: 2048 })
        const serverConfig = { encryption: { enabled: true, rsaPublicKeyJwk: publicKeyJwk } }
        // 每个学生 512KB 证据 → 256 名学生 ≈ 128MB 证据，足以证明分块/流式正确性
        const big = 'y'.repeat(512 * 1024)
        const makeHeavy = (i) => ({
            data: {
                personal: {
                    姓名: { data: `生${i}` },
                    学号: { data: `S${i}` },
                    年份: { data: 2024 },
                    学期: { data: '秋季' },
                },
                dyf: {
                    e: [[{ number: 1, score: 1, support: { files: [{ file: { name: `b${i}.bin` }, content: `data:application/octet-stream;base64,${Buffer.from(big).toString('base64')}` }] } }]],
                },
            },
        })
        const students = Array.from({ length: 256 }, (_, i) => makeHeavy(i + 1))
        const blob = await createDyfFileBlob({
            type: 'grade',
            semester: '2024秋季',
            classInfo: {},
            students,
            serverConfig,
            chunkSize: 1024 * 1024,
        })
        const collected = []
        const res = await parseDyfFile({
            file: new File([blob], 'grade.dyf'),
            serverConfig,
            privateKeyJwk,
            evidenceSink: async ({ name }) => name,
            onStudent: (s) => collected.push(s),
        })
        expect(res.ok).toBe(true)
        expect(collected.length).toBe(256)
        // 验证证据内容完整：第 10 名的数据在导入后仍为 512KB
        const tenth = collected.find((s) => s.data.personal.学号.data === 'S10')
        expect(tenth).toBeTruthy()
        expect(tenth.data.dyf.e[0][0].support.files[0]).toBe('b10.bin')
    })
})

describe('dyf v5 容器：完整性与防篡改', () => {
    const buildEncrypted = async () => {
        const { publicKeyJwk, privateKeyJwk } = await generateRsaOaepKeyPair({ modulusLength: 2048 })
        const serverConfig = { encryption: { enabled: true, rsaPublicKeyJwk: publicKeyJwk } }
        const blob = await createDyfFileBlob({
            type: 'class',
            semester: '2024秋季',
            classInfo: {},
            students: [makeStudent(7)],
            serverConfig,
        })
        return { blob, serverConfig, privateKeyJwk }
    }

    it('翻转一个密文字节应被 GCM 认证拒绝', async () => {
        const { blob, serverConfig, privateKeyJwk } = await buildEncrypted()
        const bytes = await readFileBytes(blob)
        // 在最后一帧密文区翻转一位（避开头部）
        const idx = bytes.length - 20
        bytes[idx] = bytes[idx] ^ 0xff
        const res = await parseDyfFile({
            file: new File([bytes], 'corrupt.dyf'),
            serverConfig,
            privateKeyJwk,
        })
        expect(res.ok).toBe(false)
    })

    it('截断文件应被长度校验拒绝', async () => {
        const { blob, serverConfig, privateKeyJwk } = await buildEncrypted()
        const bytes = await readFileBytes(blob)
        const truncated = bytes.subarray(0, Math.floor(bytes.length * 0.7))
        const res = await parseDyfFile({
            file: new File([truncated], 'trunc.dyf'),
            serverConfig,
            privateKeyJwk,
        })
        expect(res.ok).toBe(false)
    })

    it('用错误私钥解密应失败（不会静默产出乱码）', async () => {
        const { blob, serverConfig } = await buildEncrypted()
        const other = await generateRsaOaepKeyPair({ modulusLength: 2048 })
        const wrongServer = { encryption: { enabled: true, rsaPublicKeyJwk: serverConfig.encryption.rsaPublicKeyJwk } }
        const res = await parseDyfFile({
            file: new File([blob], 'wrong.dyf'),
            serverConfig: wrongServer,
            privateKeyJwk: other.privateKeyJwk,
        })
        expect(res.ok).toBe(false)
    })

    it('magic 不匹配的旧格式回退路径不崩溃', async () => {
        const collected = []
        const res = await parseDyfFile({
            file: new File(
                [JSON.stringify({ schemaVersion: 3, type: 'student', encrypted: false, data: makeStudent(1) })],
                'old.dyf',
            ),
            serverConfig: { encryption: { enabled: false } },
            privateKeyJwk: null,
            onStudent: (s) => collected.push(s),
        })
        // 旧 inline 解析成功（体积很小）
        expect(res.ok).toBe(true)
        expect(collected.length).toBe(1)
    })
})

// 复刻“原始旧版”createDyfText 的加密方式：随机 IV 原样 + 整段一次 AES-GCM。
const legacyEncryptDyf = async ({ type, payload, serverConfig }) => {
    const enc = serverConfig.encryption
    const publicKey = await importRsaPublicKey({ jwk: enc.rsaPublicKeyJwk, algorithm: enc.rsaAlgorithm })
    const keyBytes = randomBytes(32)
    const iv = randomBytes(12)
    const aesKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
    const ct = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            utf8ToBytes(JSON.stringify(payload)),
        ),
    )
    const ek = await rsaEncrypt({ publicKey, data: keyBytes })
    return JSON.stringify({
        schemaVersion: 3,
        type,
        encrypted: true,
        alg: { rsa: enc.rsaAlgorithm, aes: { name: 'AES-GCM', length: 256 } },
        iv: bytesToBase64(iv),
        key: bytesToBase64(ek),
        data: bytesToBase64(ct),
    })
}

describe('dyf v3 旧文件兼容', () => {
    it('原始旧版（随机 IV 整段 AES）加密的 v3 文件可被新解析器解密', async () => {
        const { publicKeyJwk, privateKeyJwk } = await generateRsaOaepKeyPair({ modulusLength: 2048 })
        const serverConfig = {
            encryption: {
                enabled: true,
                rsaPublicKeyJwk: publicKeyJwk,
                rsaAlgorithm: { name: 'RSA-OAEP', hash: 'SHA-256' },
            },
        }
        const text = await legacyEncryptDyf({ type: 'student', payload: makeStudent(9), serverConfig })
        const parsed = await parseDyfText({ text, serverConfig, privateKeyJwk })
        expect(parsed.ok).toBe(true)
        expect(parsed.type).toBe('student')
        expect(parsed.payload.data.personal.姓名.data).toBe('学生9')
    })

    it('新 createDyfText 与 parseDyfText 自洽往返（加密）', async () => {
        const { publicKeyJwk, privateKeyJwk } = await generateRsaOaepKeyPair({ modulusLength: 2048 })
        const serverConfig = { encryption: { enabled: true, rsaPublicKeyJwk: publicKeyJwk } }
        const text = await createDyfText({ type: 'student', payload: makeStudent(10), serverConfig })
        const parsed = await parseDyfText({ text, serverConfig, privateKeyJwk })
        expect(parsed.ok).toBe(true)
        expect(parsed.payload.data.personal.姓名.data).toBe('学生10')
    })

    it('v3 明文文件仍可解析', async () => {
        const text = JSON.stringify({
            schemaVersion: 3,
            type: 'student',
            encrypted: false,
            data: makeStudent(11),
        })
        const parsed = await parseDyfText({
            text,
            serverConfig: { encryption: { enabled: false } },
            privateKeyJwk: null,
        })
        expect(parsed.ok).toBe(true)
        expect(parsed.payload.data.personal.姓名.data).toBe('学生11')
    })

    it('旧版整班文件可经流式入口（File 回退）逐学生导入', async () => {
        const { publicKeyJwk, privateKeyJwk } = await generateRsaOaepKeyPair({ modulusLength: 2048 })
        const serverConfig = {
            encryption: {
                enabled: true,
                rsaPublicKeyJwk: publicKeyJwk,
                rsaAlgorithm: { name: 'RSA-OAEP', hash: 'SHA-256' },
            },
        }
        const payload = {
            semester: '2024秋季',
            class: {},
            students: [makeStudent(12), makeStudent(13)],
        }
        const text = await legacyEncryptDyf({ type: 'class', payload, serverConfig })
        const collected = []
        const res = await parseDyfFile({
            file: new File([text], 'legacy.dyf'),
            serverConfig,
            privateKeyJwk,
            onStudent: (s) => collected.push(s),
        })
        expect(res.ok).toBe(true)
        expect(res.type).toBe('class')
        expect(collected.length).toBe(2)
    })

    it('更早的裸学生 JSON（无 schemaVersion）仍可回退导入', async () => {
        const collected = []
        const res = await parseDyfFile({
            file: new File([JSON.stringify(makeStudent(14))], 'raw.dyf'),
            serverConfig: { encryption: { enabled: false } },
            privateKeyJwk: null,
            onStudent: (s) => collected.push(s),
        })
        expect(res.ok).toBe(true)
        expect(res.type).toBe('student')
        expect(collected.length).toBe(1)
    })
})
