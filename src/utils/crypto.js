const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export const utf8ToBytes = (text) => textEncoder.encode(String(text))
export const bytesToUtf8 = (bytes) => textDecoder.decode(bytes)

export const randomBytes = (length) => {
    const out = new Uint8Array(length)
    crypto.getRandomValues(out)
    return out
}

export const bytesToBase64 = (bytes) => {
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
}

export const base64ToBytes = (b64) => {
    const binary = atob(String(b64 || ''))
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
}

const normalizeRsaAlgorithm = (alg) => {
    const hash = typeof alg?.hash === 'string' ? alg.hash : alg?.hash?.name
    return { name: 'RSA-OAEP', hash: hash || 'SHA-256' }
}

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

export const aesGcmEncrypt = async ({ keyBytes, plaintextBytes }) => {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
        'encrypt',
    ])
    const iv = randomBytes(12)
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes)
    return { iv, ciphertext: new Uint8Array(buf) }
}

export const aesGcmDecrypt = async ({ keyBytes, iv, ciphertextBytes }) => {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
        'decrypt',
    ])
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextBytes)
    return new Uint8Array(buf)
}
