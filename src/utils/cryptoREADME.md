# crypto 使用手册

## 📋 概述

`crypto` 是一个加密工具库，提供了各种加密相关的功能，包括字符串转换、随机字节生成、Base64 编码/解码、RSA 加密/解密、AES-GCM 加密/解密等。

### 核心功能
- UTF-8 字符串与字节转换
- 随机字节生成
- Base64 编码与解码
- RSA-OAEP 密钥对生成
- RSA 加密与解密
- AES-GCM 加密与解密
- 密钥对验证

## 🚀 快速开始

### 安装

该工具是项目内置工具，无需单独安装，直接导入使用即可。

### 导入

```javascript
// 导入所有函数
import * as crypto from '@/utils/crypto'

// 或按需导入
import { 
  utf8ToBytes, 
  bytesToUtf8, 
  randomBytes, 
  generateRsaOaepKeyPair,
  rsaEncrypt,
  rsaDecrypt
} from '@/utils/crypto'
```

## 📖 API 文档

### 1. 字符串与字节转换

#### 1.1 utf8ToBytes(text)

**描述**：将 UTF-8 字符串转换为字节数组

**参数**：
- `text` (string) - 要转换的字符串

**返回值**：`Uint8Array` - 转换后的字节数组

**示例**：

```javascript
const bytes = crypto.utf8ToBytes('Hello, World!')
console.log('字节数组:', bytes)
```

#### 1.2 bytesToUtf8(bytes)

**描述**：将字节数组转换为 UTF-8 字符串

**参数**：
- `bytes` (Uint8Array) - 要转换的字节数组

**返回值**：`string` - 转换后的字符串

**示例**：

```javascript
const bytes = new Uint8Array([72, 101, 108, 108, 111])
const text = crypto.bytesToUtf8(bytes)
console.log('字符串:', text) // 输出: Hello
```

### 2. 随机字节生成

#### 2.1 randomBytes(length)

**描述**：生成指定长度的随机字节数组

**参数**：
- `length` (number) - 字节数组长度

**返回值**：`Uint8Array` - 随机字节数组

**示例**：

```javascript
// 生成 32 字节随机数（用于 AES 密钥）
const keyBytes = crypto.randomBytes(32)
console.log('随机字节:', keyBytes)

// 生成 12 字节随机数（用于 AES-GCM IV）
const ivBytes = crypto.randomBytes(12)
console.log('IV 字节:', ivBytes)
```

### 3. Base64 编码与解码

#### 3.1 bytesToBase64(bytes)

**描述**：将字节数组转换为 Base64 字符串

**参数**：
- `bytes` (Uint8Array) - 要编码的字节数组

**返回值**：`string` - Base64 编码字符串

**示例**：

```javascript
const bytes = crypto.utf8ToBytes('Hello')
const base64 = crypto.bytesToBase64(bytes)
console.log('Base64:', base64) // 输出: SGVsbG8=
```

#### 3.2 base64ToBytes(b64)

**描述**：将 Base64 字符串转换为字节数组

**参数**：
- `b64` (string) - Base64 编码字符串

**返回值**：`Uint8Array` - 解码后的字节数组

**示例**：

```javascript
const bytes = crypto.base64ToBytes('SGVsbG8=')
const text = crypto.bytesToUtf8(bytes)
console.log('解码结果:', text) // 输出: Hello
```

### 4. RSA 加密相关

#### 4.1 generateRsaOaepKeyPair(options)

**描述**：生成 RSA-OAEP 密钥对

**参数**：
- `options` (object) - 可选配置
  - `modulusLength` (number) - 密钥长度，默认 2048
  - `hash` (string) - 哈希算法，默认 'SHA-256'

**返回值**：`Promise<{publicKeyJwk, privateKeyJwk}>` - 包含公钥和私钥的 JWK 格式

**示例**：

```javascript
async function generateKeys() {
  const { publicKeyJwk, privateKeyJwk } = await crypto.generateRsaOaepKeyPair({
    modulusLength: 2048,
    hash: 'SHA-256'
  })
  console.log('公钥:', publicKeyJwk)
  console.log('私钥:', privateKeyJwk)
  return { publicKeyJwk, privateKeyJwk }
}
```

#### 4.2 importRsaPublicKey({ jwk, algorithm })

**描述**：导入 RSA 公钥

**参数**：
- `jwk` (object) - JWK 格式的公钥
- `algorithm` (object) - 算法配置

**返回值**：`Promise<CryptoKey>` - 导入的公钥对象

**示例**：

```javascript
async function importPublicKey(jwk) {
  const publicKey = await crypto.importRsaPublicKey({ jwk })
  console.log('导入公钥成功')
  return publicKey
}
```

#### 4.3 importRsaPrivateKey({ jwk, algorithm })

**描述**：导入 RSA 私钥

**参数**：
- `jwk` (object) - JWK 格式的私钥
- `algorithm` (object) - 算法配置

**返回值**：`Promise<CryptoKey>` - 导入的私钥对象

**示例**：

```javascript
async function importPrivateKey(jwk) {
  const privateKey = await crypto.importRsaPrivateKey({ jwk })
  console.log('导入私钥成功')
  return privateKey
}
```

#### 4.4 rsaEncrypt({ publicKey, data })

**描述**：使用 RSA 公钥加密数据

**参数**：
- `publicKey` (CryptoKey) - 公钥对象
- `data` (Uint8Array) - 要加密的数据

**返回值**：`Promise<Uint8Array>` - 加密后的数据

**示例**：

```javascript
async function encryptData(publicKey, plaintext) {
  const data = crypto.utf8ToBytes(plaintext)
  const encrypted = await crypto.rsaEncrypt({ publicKey, data })
  console.log('加密后:', crypto.bytesToBase64(encrypted))
  return encrypted
}
```

#### 4.5 rsaDecrypt({ privateKey, data })

**描述**：使用 RSA 私钥解密数据

**参数**：
- `privateKey` (CryptoKey) - 私钥对象
- `data` (Uint8Array) - 要解密的数据

**返回值**：`Promise<Uint8Array>` - 解密后的数据

**示例**：

```javascript
async function decryptData(privateKey, encryptedData) {
  const decrypted = await crypto.rsaDecrypt({ privateKey, data: encryptedData })
  const plaintext = crypto.bytesToUtf8(decrypted)
  console.log('解密后:', plaintext)
  return plaintext
}
```

#### 4.6 verifyRsaKeyPair({ publicKeyJwk, privateKeyJwk, algorithm })

**描述**：验证 RSA 密钥对是否匹配

**参数**：
- `publicKeyJwk` (object) - JWK 格式的公钥
- `privateKeyJwk` (object) - JWK 格式的私钥
- `algorithm` (object) - 算法配置

**返回值**：`Promise<boolean>` - 密钥对是否匹配

**示例**：

```javascript
async function verifyKeys(publicKeyJwk, privateKeyJwk) {
  const isValid = await crypto.verifyRsaKeyPair({ 
    publicKeyJwk, 
    privateKeyJwk 
  })
  console.log('密钥对是否有效:', isValid)
  return isValid
}
```

### 5. AES-GCM 加密相关

#### 5.1 aesGcmEncrypt({ keyBytes, plaintextBytes })

**描述**：使用 AES-GCM 加密数据

**参数**：
- `keyBytes` (Uint8Array) - 密钥字节数组（16、24 或 32 字节）
- `plaintextBytes` (Uint8Array) - 要加密的明文数据

**返回值**：`Promise<{iv, ciphertext}>` - 包含 IV 和密文的对象
- `iv` (Uint8Array) - 初始化向量
- `ciphertext` (Uint8Array) - 加密后的密文

**示例**：

```javascript
async function encryptWithAes(keyBytes, plaintext) {
  const plaintextBytes = crypto.utf8ToBytes(plaintext)
  const { iv, ciphertext } = await crypto.aesGcmEncrypt({ 
    keyBytes, 
    plaintextBytes 
  })
  console.log('IV:', crypto.bytesToBase64(iv))
  console.log('密文:', crypto.bytesToBase64(ciphertext))
  return { iv, ciphertext }
}
```

#### 5.2 aesGcmDecrypt({ keyBytes, iv, ciphertextBytes })

**描述**：使用 AES-GCM 解密数据

**参数**：
- `keyBytes` (Uint8Array) - 密钥字节数组
- `iv` (Uint8Array) - 初始化向量
- `ciphertextBytes` (Uint8Array) - 要解密的密文

**返回值**：`Promise<Uint8Array>` - 解密后的明文数据

**示例**：

```javascript
async function decryptWithAes(keyBytes, iv, ciphertextBytes) {
  const plaintextBytes = await crypto.aesGcmDecrypt({ 
    keyBytes, 
    iv, 
    ciphertextBytes 
  })
  const plaintext = crypto.bytesToUtf8(plaintextBytes)
  console.log('解密后:', plaintext)
  return plaintext
}
```

## 🎯 使用示例

### 1. RSA 加密/解密完整示例

```javascript
async function rsaExample() {
  try {
    // 1. 生成密钥对
    console.log('1. 生成密钥对...')
    const { publicKeyJwk, privateKeyJwk } = await crypto.generateRsaOaepKeyPair()
    
    // 2. 导入密钥
    console.log('2. 导入密钥...')
    const publicKey = await crypto.importRsaPublicKey({ jwk: publicKeyJwk })
    const privateKey = await crypto.importRsaPrivateKey({ jwk: privateKeyJwk })
    
    // 3. 准备要加密的数据
    const plaintext = 'Hello, RSA Encryption!'
    console.log('3. 原始数据:', plaintext)
    
    // 4. 加密数据
    console.log('4. 加密数据...')
    const data = crypto.utf8ToBytes(plaintext)
    const encrypted = await crypto.rsaEncrypt({ publicKey, data })
    console.log('5. 加密后:', crypto.bytesToBase64(encrypted))
    
    // 6. 解密数据
    console.log('6. 解密数据...')
    const decrypted = await crypto.rsaDecrypt({ privateKey, data: encrypted })
    const decryptedText = crypto.bytesToUtf8(decrypted)
    console.log('7. 解密后:', decryptedText)
    
    // 8. 验证密钥对
    console.log('8. 验证密钥对...')
    const isValid = await crypto.verifyRsaKeyPair({ publicKeyJwk, privateKeyJwk })
    console.log('9. 密钥对是否有效:', isValid)
    
  } catch (error) {
    console.error('RSA 示例失败:', error)
  }
}

// 运行示例
rsaExample()
```

### 2. AES-GCM 加密/解密完整示例

```javascript
async function aesExample() {
  try {
    // 1. 生成密钥（32 字节 = 256 位）
    console.log('1. 生成密钥...')
    const keyBytes = crypto.randomBytes(32)
    console.log('2. 密钥:', crypto.bytesToBase64(keyBytes))
    
    // 2. 准备要加密的数据
    const plaintext = 'Hello, AES-GCM Encryption!'
    console.log('3. 原始数据:', plaintext)
    
    // 3. 加密数据
    console.log('4. 加密数据...')
    const plaintextBytes = crypto.utf8ToBytes(plaintext)
    const { iv, ciphertext } = await crypto.aesGcmEncrypt({ 
      keyBytes, 
      plaintextBytes 
    })
    console.log('5. IV:', crypto.bytesToBase64(iv))
    console.log('6. 密文:', crypto.bytesToBase64(ciphertext))
    
    // 4. 解密数据
    console.log('7. 解密数据...')
    const decryptedBytes = await crypto.aesGcmDecrypt({ 
      keyBytes, 
      iv, 
      ciphertextBytes: ciphertext 
    })
    const decryptedText = crypto.bytesToUtf8(decryptedBytes)
    console.log('8. 解密后:', decryptedText)
    
  } catch (error) {
    console.error('AES 示例失败:', error)
  }
}

// 运行示例
aesExample()
```

### 3. 混合加密示例（RSA + AES）

```javascript
async function hybridEncryptionExample() {
  try {
    // 1. 生成 RSA 密钥对
    console.log('1. 生成 RSA 密钥对...')
    const { publicKeyJwk, privateKeyJwk } = await crypto.generateRsaOaepKeyPair()
    const publicKey = await crypto.importRsaPublicKey({ jwk: publicKeyJwk })
    const privateKey = await crypto.importRsaPrivateKey({ jwk: privateKeyJwk })
    
    // 2. 生成 AES 密钥
    console.log('2. 生成 AES 密钥...')
    const aesKeyBytes = crypto.randomBytes(32)
    
    // 3. 准备要加密的数据
    const plaintext = 'Hello, Hybrid Encryption! This is a longer message that would be better encrypted with AES.'
    console.log('3. 原始数据:', plaintext)
    
    // 4. 使用 AES 加密数据
    console.log('4. 使用 AES 加密数据...')
    const plaintextBytes = crypto.utf8ToBytes(plaintext)
    const { iv, ciphertext } = await crypto.aesGcmEncrypt({ 
      keyBytes: aesKeyBytes, 
      plaintextBytes 
    })
    
    // 5. 使用 RSA 加密 AES 密钥
    console.log('5. 使用 RSA 加密 AES 密钥...')
    const encryptedAesKey = await crypto.rsaEncrypt({ 
      publicKey, 
      data: aesKeyBytes 
    })
    
    console.log('6. 加密后的 AES 密钥:', crypto.bytesToBase64(encryptedAesKey))
    console.log('7. IV:', crypto.bytesToBase64(iv))
    console.log('8. 密文:', crypto.bytesToBase64(ciphertext))
    
    // 6. 解密过程
    console.log('9. 开始解密...')
    
    // 7. 使用 RSA 解密 AES 密钥
    console.log('10. 使用 RSA 解密 AES 密钥...')
    const decryptedAesKey = await crypto.rsaDecrypt({ 
      privateKey, 
      data: encryptedAesKey 
    })
    
    // 8. 使用 AES 解密数据
    console.log('11. 使用 AES 解密数据...')
    const decryptedBytes = await crypto.aesGcmDecrypt({ 
      keyBytes: decryptedAesKey, 
      iv, 
      ciphertextBytes: ciphertext 
    })
    const decryptedText = crypto.bytesToUtf8(decryptedBytes)
    
    console.log('12. 解密后:', decryptedText)
    
  } catch (error) {
    console.error('混合加密示例失败:', error)
  }
}

// 运行示例
hybridEncryptionExample()
```

## 🔧 高级用法

### 1. 密钥管理

#### 1.1 保存和加载密钥

```javascript
// 保存密钥到本地存储
function saveKeys(publicKeyJwk, privateKeyJwk) {
  localStorage.setItem('rsaPublicKey', JSON.stringify(publicKeyJwk))
  localStorage.setItem('rsaPrivateKey', JSON.stringify(privateKeyJwk))
  console.log('密钥已保存')
}

// 从本地存储加载密钥
function loadKeys() {
  const publicKeyJson = localStorage.getItem('rsaPublicKey')
  const privateKeyJson = localStorage.getItem('rsaPrivateKey')
  
  if (!publicKeyJson || !privateKeyJson) {
    console.error('未找到保存的密钥')
    return null
  }
  
  try {
    const publicKeyJwk = JSON.parse(publicKeyJson)
    const privateKeyJwk = JSON.parse(privateKeyJson)
    return { publicKeyJwk, privateKeyJwk }
  } catch (error) {
    console.error('加载密钥失败:', error)
    return null
  }
}

// 使用示例
async function keyManagementExample() {
  // 生成并保存密钥
  const { publicKeyJwk, privateKeyJwk } = await crypto.generateRsaOaepKeyPair()
  saveKeys(publicKeyJwk, privateKeyJwk)
  
  // 加载密钥
  const keys = loadKeys()
  if (keys) {
    console.log('成功加载密钥')
    // 使用加载的密钥...
  }
}
```

#### 1.2 密钥强度选择

```javascript
// 根据安全需求选择不同的密钥长度
async function generateKeyWithStrength(strength) {
  let modulusLength
  switch (strength) {
    case 'low':
      modulusLength = 1024 // 不推荐，仅用于测试
      break
    case 'medium':
      modulusLength = 2048 // 默认，适用于大多数场景
      break
    case 'high':
      modulusLength = 4096 // 更高安全性， but slower
      break
    default:
      modulusLength = 2048
  }
  
  return await crypto.generateRsaOaepKeyPair({ modulusLength })
}

// 使用示例
async function keyStrengthExample() {
  console.log('生成高强度密钥...')
  const keys = await generateKeyWithStrength('high')
  console.log('密钥生成成功')
}
```

### 2. 数据加密最佳实践

#### 2.1 加密对象数据

```javascript
async function encryptObject(publicKey, data) {
  // 将对象转换为 JSON 字符串
  const jsonString = JSON.stringify(data)
  // 转换为字节
  const dataBytes = crypto.utf8ToBytes(jsonString)
  // 加密
  const encrypted = await crypto.rsaEncrypt({ publicKey, data: dataBytes })
  // 转换为 Base64
  return crypto.bytesToBase64(encrypted)
}

async function decryptObject(privateKey, encryptedBase64) {
  // 转换为字节
  const encryptedBytes = crypto.base64ToBytes(encryptedBase64)
  // 解密
  const decryptedBytes = await crypto.rsaDecrypt({ privateKey, data: encryptedBytes })
  // 转换为字符串
  const jsonString = crypto.bytesToUtf8(decryptedBytes)
  // 解析为对象
  return JSON.parse(jsonString)
}

// 使用示例
async function encryptObjectExample() {
  const { publicKeyJwk, privateKeyJwk } = await crypto.generateRsaOaepKeyPair()
  const publicKey = await crypto.importRsaPublicKey({ jwk: publicKeyJwk })
  const privateKey = await crypto.importRsaPrivateKey({ jwk: privateKeyJwk })
  
  const userData = {
    id: '20250001',
    name: '张三',
    email: 'zhangsan@example.com',
    sensitiveInfo: '这是敏感信息'
  }
  
  console.log('原始数据:', userData)
  
  const encrypted = await encryptObject(publicKey, userData)
  console.log('加密后:', encrypted)
  
  const decrypted = await decryptObject(privateKey, encrypted)
  console.log('解密后:', decrypted)
}
```

#### 2.2 处理大文件加密

```javascript
// 注意：RSA 不适合加密大文件，因为有长度限制
// 对于大文件，应使用 AES 加密，然后用 RSA 加密 AES 密钥

async function encryptLargeFile(file, publicKey) {
  // 生成 AES 密钥
  const aesKeyBytes = crypto.randomBytes(32)
  
  // 读取文件内容
  const fileContent = await file.arrayBuffer()
  const fileBytes = new Uint8Array(fileContent)
  
  // 使用 AES 加密文件
  const { iv, ciphertext } = await crypto.aesGcmEncrypt({ 
    keyBytes: aesKeyBytes, 
    plaintextBytes: fileBytes 
  })
  
  // 使用 RSA 加密 AES 密钥
  const encryptedAesKey = await crypto.rsaEncrypt({ 
    publicKey, 
    data: aesKeyBytes 
  })
  
  return {
    iv: crypto.bytesToBase64(iv),
    encryptedKey: crypto.bytesToBase64(encryptedAesKey),
    ciphertext: crypto.bytesToBase64(ciphertext),
    fileName: file.name,
    fileType: file.type
  }
}

// 使用示例
async function encryptFileExample(fileInput) {
  const file = fileInput.files[0]
  if (!file) return
  
  const { publicKeyJwk } = await crypto.generateRsaOaepKeyPair()
  const publicKey = await crypto.importRsaPublicKey({ jwk: publicKeyJwk })
  
  console.log('开始加密文件:', file.name)
  const encryptedFile = await encryptLargeFile(file, publicKey)
  console.log('文件加密成功')
  console.log('加密结果:', encryptedFile)
}
```

## 🚨 错误处理

### 常见错误及解决方案

| 错误类型 | 描述 | 解决方案 |
|---------|------|----------|
| 加密数据过长 | RSA 加密数据超过密钥长度限制 | 使用混合加密方案：AES 加密数据，RSA 加密 AES 密钥 |
| 密钥不匹配 | 加密和解密使用的密钥不匹配 | 确保使用正确的密钥对 |
| 算法不支持 | 浏览器不支持某些加密算法 | 检查浏览器兼容性，使用支持的算法 |
| 权限不足 | 加密操作需要安全上下文 | 在 HTTPS 环境下运行，或使用 localhost |
| 内存不足 | 处理大文件时内存不足 | 分块处理大文件，避免一次性加载全部内容 |

### 错误处理示例

```javascript
async function safeEncrypt(publicKey, data) {
  try {
    // 检查数据长度
    const dataBytes = crypto.utf8ToBytes(data)
    if (dataBytes.length > 245) { // 2048 位 RSA 限制
      throw new Error('数据过长，请使用混合加密方案')
    }
    
    const encrypted = await crypto.rsaEncrypt({ publicKey, data: dataBytes })
    return { success: true, data: crypto.bytesToBase64(encrypted) }
  } catch (error) {
    console.error('加密失败:', error)
    return { success: false, error: error.message }
  }
}

async function safeDecrypt(privateKey, encryptedBase64) {
  try {
    const encryptedBytes = crypto.base64ToBytes(encryptedBase64)
    const decrypted = await crypto.rsaDecrypt({ privateKey, data: encryptedBytes })
    const decryptedText = crypto.bytesToUtf8(decrypted)
    return { success: true, data: decryptedText }
  } catch (error) {
    console.error('解密失败:', error)
    return { success: false, error: error.message }
  }
}

// 使用示例
async function errorHandlingExample() {
  const { publicKeyJwk, privateKeyJwk } = await crypto.generateRsaOaepKeyPair()
  const publicKey = await crypto.importRsaPublicKey({ jwk: publicKeyJwk })
  const privateKey = await crypto.importRsaPrivateKey({ jwk: privateKeyJwk })
  
  // 测试加密
  const encryptResult = await safeEncrypt(publicKey, 'Hello, World!')
  if (encryptResult.success) {
    console.log('加密成功:', encryptResult.data)
    
    // 测试解密
    const decryptResult = await safeDecrypt(privateKey, encryptResult.data)
    if (decryptResult.success) {
      console.log('解密成功:', decryptResult.data)
    } else {
      console.error('解密失败:', decryptResult.error)
    }
  } else {
    console.error('加密失败:', encryptResult.error)
  }
}
```

## 📝 配置与依赖

### 依赖

无外部依赖，使用浏览器内置的 `crypto` API。

### 浏览器兼容性

| 功能 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| UTF-8 转换 | ✅ | ✅ | ✅ | ✅ |
| 随机字节生成 | ✅ | ✅ | ✅ | ✅ |
| Base64 编码/解码 | ✅ | ✅ | ✅ | ✅ |
| RSA 密钥对生成 | ✅ | ✅ | ✅ | ✅ |
| RSA 加密/解密 | ✅ | ✅ | ✅ | ✅ |
| AES-GCM 加密/解密 | ✅ | ✅ | ✅ | ✅ |

### 安全注意事项

1. **密钥安全**：不要在客户端存储私钥，私钥应该仅在需要时使用
2. **HTTPS**：加密操作应在 HTTPS 环境下进行
3. **密钥长度**：推荐使用 2048 位或 4096 位 RSA 密钥
4. **数据长度**：RSA 加密有长度限制，大文件应使用 AES 加密
5. **随机数**：使用 `crypto.getRandomValues()` 生成随机数，不要使用 Math.random()

## 🚀 性能优化

1. **密钥重用**：不要频繁生成密钥对，应重用密钥
2. **缓存导入的密钥**：导入密钥是昂贵的操作，应缓存结果
3. **避免重复转换**：减少字符串和字节数组之间的重复转换
4. **大文件处理**：对于大文件，使用分块处理
5. **并行处理**：对于多个加密操作，使用 Promise.all 并行处理

## 🤝 最佳实践

1. **使用混合加密**：对于大多数场景，使用 AES 加密数据，RSA 加密 AES 密钥
2. **安全存储**：使用安全的方式存储密钥，如 Web Crypto API 的密钥存储
3. **定期更换密钥**：定期更换加密密钥，提高安全性
4. **验证数据完整性**：在加密前对数据进行哈希处理，确保数据完整性
5. **错误处理**：对所有加密操作添加错误处理
6. **日志记录**：记录加密操作的关键信息，但不要记录敏感数据

## 🔍 调试技巧

### 1. 查看加密数据

```javascript
// 调试加密过程
function debugEncryption(step, data) {
  console.log(`[${step}]`, {
    type: typeof data,
    length: data.length,
    value: typeof data === 'string' ? data : Array.from(data),
    base64: data instanceof Uint8Array ? crypto.bytesToBase64(data) : undefined
  })
}

// 使用示例
async function debugExample() {
  const { publicKeyJwk } = await crypto.generateRsaOaepKeyPair()
  const publicKey = await crypto.importRsaPublicKey({ jwk: publicKeyJwk })
  
  const plaintext = 'Hello, Debug!'
  debugEncryption('原始数据', plaintext)
  
  const dataBytes = crypto.utf8ToBytes(plaintext)
  debugEncryption('转换为字节', dataBytes)
  
  const encrypted = await crypto.rsaEncrypt({ publicKey, data: dataBytes })
  debugEncryption('加密后', encrypted)
}
```

### 2. 测试密钥生成

```javascript
async function testKeyGeneration() {
  console.log('测试不同密钥长度的生成时间...')
  
  const keySizes = [1024, 2048, 4096]
  for (const size of keySizes) {
    const start = performance.now()
    await crypto.generateRsaOaepKeyPair({ modulusLength: size })
    const end = performance.now()
    console.log(`密钥长度 ${size} 位: ${(end - start).toFixed(2)}ms`)
  }
}

// 运行测试
testKeyGeneration()
```

### 3. 验证加密结果

```javascript
async function verifyEncryption() {
  const { publicKeyJwk, privateKeyJwk } = await crypto.generateRsaOaepKeyPair()
  const publicKey = await crypto.importRsaPublicKey({ jwk: publicKeyJwk })
  const privateKey = await crypto.importRsaPrivateKey({ jwk: privateKeyJwk })
  
  const testData = [
    'Hello',
    'Hello, World!',
    JSON.stringify({ key: 'value', number: 42, bool: true })
  ]
  
  for (const data of testData) {
    console.log(`测试数据: ${data}`)
    
    // 加密
    const dataBytes = crypto.utf8ToBytes(data)
    const encrypted = await crypto.rsaEncrypt({ publicKey, data: dataBytes })
    
    // 解密
    const decrypted = await crypto.rsaDecrypt({ privateKey, data: encrypted })
    const decryptedText = crypto.bytesToUtf8(decrypted)
    
    // 验证
    const isValid = decryptedText === data
    console.log(`验证结果: ${isValid ? '成功' : '失败'}`)
    if (!isValid) {
      console.log(`预期: ${data}`)
      console.log(`实际: ${decryptedText}`)
    }
    console.log('---')
  }
}

// 运行验证
verifyEncryption()
```

## 📞 问题反馈

如果在使用过程中遇到问题，请：

1. 检查浏览器是否支持 Web Crypto API
2. 确保在 HTTPS 环境下运行
3. 检查密钥长度是否合理
4. 查看控制台是否有相关错误信息
5. 参考本文档的错误处理部分

## 📋 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2025-01-01 | 初始版本 |
| v1.1.0 | 2025-03-15 | 优化 Base64 编码/解码性能 |
| v1.2.0 | 2025-06-20 | 增加 AES-GCM 支持 |
| v1.3.0 | 2025-09-10 | 增加密钥对验证功能 |

## 🎯 总结

`crypto` 是一个功能强大的加密工具库，提供了丰富的加密相关功能，包括：

- 字符串与字节转换
- 随机字节生成
- Base64 编码/解码
- RSA 加密/解密
- AES-GCM 加密/解密
- 密钥对验证

使用 `crypto` 工具库，可以为应用提供安全的数据加密能力，保护用户数据的安全。在使用过程中，应注意密钥安全、数据长度限制、浏览器兼容性等问题，并遵循最佳实践。

---

**本文档由开发团队维护，如有更新请及时查阅。**

*最后更新时间：2026-02-16*
