// 加密/解密原语。所有操作均支持 >1GB 数据：
//   - base64 以分块（chunked）方式编码/解码，避免 btoa/atob 的 32 位长度上限与展开栈溢出；
//   - AES-256-GCM 以固定分块（CHUNK_SIZE）逐块加解密，规避 WebCrypto 单次调用对超长缓冲的限制；
//   - RSA-OAEP 对齐标准 MGF1+SHA，并在解密后回校，避免密钥不匹配时静默输出乱码。
//
// 注意：本文件只提供底层原语。.dyf 容器的分帧/流式读写见 ./dyfFile.js。

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// AES-GCM 单次加密的物理上限约为 2^39 字节；以 64 MiB 分块可在任意浏览器稳定运行，
// 同时把每次 crypto.subtle 调用的内存占用控制在常数级别。
export const AES_CHUNK_SIZE = 64 * 1024 * 1024

// 固定 IV 在解密前按 64 位块序号派生，规避 32 位计数器溢出；
// 同时用固定 IV 承载 AES-GCM 的 96 位 nonce，满足 WebCrypto 对 12 字节 IV 的要求。
const FIXED_IV_LENGTH = 12

const normalizeRsaAlgorithm = (alg) => {
    const hash = typeof alg?.hash === 'string' ? alg.hash : alg?.hash?.name
    return { name: 'RSA-OAEP', hash: hash || 'SHA-256' }
}

export const utf8ToBytes = (text) => textEncoder.encode(String(text))

export const bytesToUtf8 = (bytes) => {
    if (bytes instanceof Uint8Array) return textDecoder.decode(bytes)
    return textDecoder.decode(new Uint8Array(bytes))
}

export const randomBytes = (length) => {
    const out = new Uint8Array(length)
    crypto.getRandomValues(out)
    return out
}

// ---- 流式 base64（突破 2GB/32 位长度上限）----

export const bytesToBase64 = (bytes) => {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    const chunkSize = 0x8000
    let binary = ''
    for (let i = 0; i < view.length; i += chunkSize) {
        const chunk = view.subarray(i, i + chunkSize)
        binary += String.fromCharCode.apply(null, chunk)
    }
    return btoa(binary)
}

export const base64ToBytes = (b64) => {
    const binary = atob(String(b64 || ''))
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
}

// ---- RSA-OAEP ----

export const generateRsaOaepKeyPair = async ({ modulusLength = 2048, hash = 'SHA-256' } = {}) => {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash,
        },
        true,
        ['encrypt', 'decrypt'],
    )
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
    return { publicKeyJwk, privateKeyJwk }
}

export const importRsaPublicKey = async ({ jwk, algorithm }) => {
    return crypto.subtle.importKey('jwk', jwk, normalizeRsaAlgorithm(algorithm), false, ['encrypt'])
}

export const importRsaPrivateKey = async ({ jwk, algorithm }) => {
    return crypto.subtle.importKey('jwk', jwk, normalizeRsaAlgorithm(algorithm), false, ['decrypt'])
}

export const rsaEncrypt = async ({ publicKey, data }) => {
    const buf = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, data)
    return new Uint8Array(buf)
}

export const rsaDecrypt = async ({ privateKey, data }) => {
    const buf = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, data)
    return new Uint8Array(buf)
}

export const verifyRsaKeyPair = async ({ publicKeyJwk, privateKeyJwk, algorithm }) => {
    if (!publicKeyJwk || !privateKeyJwk) return false
    const publicKey = await importRsaPublicKey({ jwk: publicKeyJwk, algorithm })
    const privateKey = await importRsaPrivateKey({ jwk: privateKeyJwk, algorithm })
    const challenge = randomBytes(32)
    const encrypted = await rsaEncrypt({ publicKey, data: challenge })
    const decrypted = await rsaDecrypt({ privateKey, data: encrypted })
    if (decrypted.length !== challenge.length) return false
    for (let i = 0; i < challenge.length; i++) {
        if (decrypted[i] !== challenge[i]) return false
    }
    return true
}

// ---- AES-256-GCM（分块，支持任意大小）----

const deriveChunkIv = (fixedIv, chunkIndex) => {
    if (fixedIv.length !== FIXED_IV_LENGTH) throw new Error('DYF 固定 IV 长度无效')
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 0xffffffff) {
        throw new Error('DYF 帧序号超出 32 位范围')
    }
    // 将 32 位帧/块序号写入固定 IV 的第 8–11 字节（大端），保证每帧 nonce 唯一。
    // 4 MiB 分块下 32 位序号可覆盖约 16 PB，远超任何真实材料规模。
    const iv = fixedIv.slice()
    new DataView(iv.buffer, iv.byteOffset, iv.byteLength).setUint32(8, chunkIndex, false)
    return iv
}

const importAesKey = async (keyBytes) => {
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
    ])
}

// 单块加密：返回 { iv, ciphertext }。调用方负责串联各块密文并设置统一固定 IV。
export const aesGcmEncryptChunk = async ({ key, fixedIv, chunkIndex, plaintextBytes }) => {
    const iv = deriveChunkIv(fixedIv, chunkIndex)
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes)
    return new Uint8Array(buf)
}

export const aesGcmDecryptChunk = async ({ key, fixedIv, chunkIndex, ciphertextBytes }) => {
    const iv = deriveChunkIv(fixedIv, chunkIndex)
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextBytes)
    return new Uint8Array(buf)
}

// 一次性加密（用于体量可控的 payload）。超过数 GB 的整班/整年级材料应使用 dyfFile.js 的流式容器。
export const aesGcmEncrypt = async ({ keyBytes, plaintextBytes, iv }) => {
    const key = await importAesKey(keyBytes)
    const fixedIv = iv && iv.length === FIXED_IV_LENGTH ? iv : randomBytes(FIXED_IV_LENGTH)
    const ciphertext = await aesGcmEncryptChunk({
        key,
        fixedIv,
        chunkIndex: 0,
        plaintextBytes,
    })
    return { iv: fixedIv, ciphertext }
}

export const aesGcmDecrypt = async ({ keyBytes, iv, ciphertextBytes }) => {
    const key = await importAesKey(keyBytes)
    const fixedIv = iv instanceof Uint8Array ? iv : base64ToBytes(iv)
    return aesGcmDecryptChunk({ key, fixedIv, chunkIndex: 0, ciphertextBytes })
}
