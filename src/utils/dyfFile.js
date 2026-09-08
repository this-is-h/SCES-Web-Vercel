import {
    aesGcmDecrypt,
    aesGcmEncrypt,
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

export const DYF_SCHEMA_VERSION = 3

export const createDyfText = async ({ type, payload, serverConfig }) => {
    const cfg = serverConfig ?? {}
    const encryption = cfg.encryption ?? {}
    const enabled = Boolean(encryption.enabled && encryption.rsaPublicKeyJwk)

    if (!enabled) {
        return JSON.stringify(
            {
                schemaVersion: DYF_SCHEMA_VERSION,
                type,
                encrypted: false,
                data: payload,
            },
            null,
            2,
        )
    }

    const keyBytes = randomBytes(32)
    const plaintext = utf8ToBytes(JSON.stringify(payload))
    const { iv, ciphertext } = await aesGcmEncrypt({ keyBytes, plaintextBytes: plaintext })

    const publicKey = await importRsaPublicKey({
        jwk: encryption.rsaPublicKeyJwk,
        algorithm: encryption.rsaAlgorithm,
    })
    const encryptedKey = await rsaEncrypt({ publicKey, data: keyBytes })

    return JSON.stringify(
        {
            schemaVersion: DYF_SCHEMA_VERSION,
            type,
            encrypted: true,
            alg: {
                rsa: encryption.rsaAlgorithm ?? { name: 'RSA-OAEP', hash: 'SHA-256' },
                aes: encryption.aesAlgorithm ?? { name: 'AES-GCM', length: 256 },
            },
            iv: bytesToBase64(iv),
            key: bytesToBase64(encryptedKey),
            data: bytesToBase64(ciphertext),
        },
        null,
        2,
    )
}

export const parseDyfText = async ({ text, serverConfig, privateKeyJwk }) => {
    const parsed = safeJsonParse(text)
    if (!parsed) return { ok: false, message: '文件格式不正确，无法解析为 JSON' }

    if (parsed.schemaVersion >= DYF_SCHEMA_VERSION && parsed.type && parsed.encrypted === false) {
        return { ok: true, type: parsed.type, payload: parsed.data }
    }

    if (parsed.schemaVersion >= DYF_SCHEMA_VERSION && parsed.type && parsed.encrypted === true) {
        if (!privateKeyJwk) return { ok: false, message: '缺少私钥，无法解密导入文件' }
        const cfg = serverConfig ?? {}
        const encryption = cfg.encryption ?? {}
        const algorithm = parsed.alg?.rsa ?? encryption.rsaAlgorithm
        try {
            const privateKey = await importRsaPrivateKey({ jwk: privateKeyJwk, algorithm })
            const keyBytes = await rsaDecrypt({ privateKey, data: base64ToBytes(parsed.key) })
            const plaintextBytes = await aesGcmDecrypt({
                keyBytes,
                iv: base64ToBytes(parsed.iv),
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
