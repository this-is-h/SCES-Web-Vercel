# dyfFile 使用手册

## 📋 概述

`dyfFile` 是一个 DYF 文件处理工具，用于创建和解析 DYF 格式的文件，支持加密和非加密模式。DYF 格式是学生德育分管理系统使用的一种数据交换格式。

### 核心功能
- 创建 DYF 文本文件
- 解析 DYF 文本文件
- 支持加密和解密
- 兼容旧版本格式
- 自动处理 schema 版本

## 🚀 快速开始

### 安装

该工具是项目内置工具，无需单独安装，直接导入使用即可。

### 导入

```javascript
import { 
  createDyfText, 
  parseDyfText, 
  DYF_SCHEMA_VERSION 
} from '@/utils/dyfFile'
```

## 📖 API 文档

### 1. 常量

#### 1.1 DYF_SCHEMA_VERSION

**描述**：当前 DYF schema 版本

**值**：`3`

**用途**：用于标识 DYF 文件的版本，确保兼容性

### 2. 函数

#### 2.1 createDyfText({ type, payload, serverConfig })

**描述**：创建 DYF 文本

**参数**：
- `type` (string) - 文件类型，如 'student'
- `payload` (object) - 要存储的数据
- `serverConfig` (object) - 服务器配置，包含加密相关设置
  - `encryption` (object) - 加密配置
    - `enabled` (boolean) - 是否启用加密
    - `rsaPublicKeyJwk` (object) - RSA 公钥

**返回值**：`Promise<string>` - 生成的 DYF 文本

**示例**：

```javascript
async function createNonEncryptedDyf() {
  const dyfText = await createDyfText({
    type: 'student',
    payload: {
      personal: {
        姓名: { data: '张三' },
        学号: { data: '20250001' }
      }
    }
  })
  console.log('非加密 DYF:', dyfText)
  return dyfText
}

async function createEncryptedDyf(serverConfig) {
  const dyfText = await createDyfText({
    type: 'student',
    payload: {
      personal: {
        姓名: { data: '张三' },
        学号: { data: '20250001' }
      }
    },
    serverConfig // 包含 RSA 公钥的配置
  })
  console.log('加密 DYF:', dyfText)
  return dyfText
}
```

#### 2.2 parseDyfText({ text, serverConfig, privateKeyJwk })

**描述**：解析 DYF 文本

**参数**：
- `text` (string) - DYF 文本内容
- `serverConfig` (object) - 服务器配置
- `privateKeyJwk` (object) - RSA 私钥，用于解密

**返回值**：`Promise<{ok: boolean, message?: string, type?: string, payload?: object}>` - 解析结果

**返回对象说明**：
- `ok` (boolean) - 是否解析成功
- `message` (string) - 错误信息，仅在 `ok` 为 false 时存在
- `type` (string) - 文件类型，仅在 `ok` 为 true 时存在
- `payload` (object) - 解析的数据，仅在 `ok` 为 true 时存在

**示例**：

```javascript
async function parseDyf(text, privateKeyJwk, serverConfig) {
  const result = await parseDyfText({
    text,
    privateKeyJwk, // 用于解密
    serverConfig
  })
  
  if (result.ok) {
    console.log('解析成功:', result.type, result.payload)
    return result.payload
  } else {
    console.error('解析失败:', result.message)
    return null
  }
}
```

## 🎯 使用示例

### 1. 基本用法（非加密）

```javascript
async function basicExample() {
  // 创建 DYF 文本
  const dyfText = await createDyfText({
    type: 'student',
    payload: {
      personal: {
        姓名: { data: '张三' },
        学号: { data: '20250001' },
        年级: { data: '2025' },
        专业: { data: '计算机' },
        班级: { data: '1班' }
      },
      dyf: {
        基础分: [[{ number: 111, score: 100 }]],
        奖励分: [[{ number: 211, score: 20 }]],
        惩罚分: [[{ number: 311, score: 5 }]]
      }
    }
  })
  
  console.log('创建的 DYF 文本:', dyfText)
  
  // 解析 DYF 文本
  const parseResult = await parseDyfText({ text: dyfText })
  
  if (parseResult.ok) {
    console.log('解析结果:', parseResult.payload)
  } else {
    console.error('解析失败:', parseResult.message)
  }
}

// 运行示例
basicExample()
```

### 2. 加密用法

```javascript
async function encryptedExample() {
  // 假设我们有服务器配置，包含 RSA 公钥
  const serverConfig = {
    encryption: {
      enabled: true,
      rsaPublicKeyJwk: {
        // RSA 公钥的 JWK 格式
        kty: 'RSA',
        e: 'AQAB',
        n: '...' // 公钥的 n 值
      },
      rsaAlgorithm: {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      }
    }
  }
  
  // 创建加密的 DYF 文本
  const encryptedDyf = await createDyfText({
    type: 'student',
    payload: {
      personal: {
        姓名: { data: '张三' },
        学号: { data: '20250001' }
      }
    },
    serverConfig
  })
  
  console.log('加密的 DYF 文本:', encryptedDyf)
  
  // 解析加密的 DYF 文本
  // 需要提供私钥
  const privateKeyJwk = {
    // RSA 私钥的 JWK 格式
    kty: 'RSA',
    e: 'AQAB',
    n: '...',
    d: '...',
    p: '...',
    q: '...',
    dp: '...',
    dq: '...',
    qi: '...'
  }
  
  const parseResult = await parseDyfText({
    text: encryptedDyf,
    privateKeyJwk,
    serverConfig
  })
  
  if (parseResult.ok) {
    console.log('解密成功:', parseResult.payload)
  } else {
    console.error('解密失败:', parseResult.message)
  }
}

// 运行示例
encryptedExample()
```

### 3. 批量处理

```javascript
async function batchProcessing(files) {
  const results = []
  
  for (const file of files) {
    try {
      // 读取文件内容
      const text = await file.text()
      
      // 解析 DYF 文件
      const parseResult = await parseDyfText({ text })
      
      if (parseResult.ok) {
        results.push({
          fileName: file.name,
          success: true,
          data: parseResult.payload
        })
      } else {
        results.push({
          fileName: file.name,
          success: false,
          error: parseResult.message
        })
      }
    } catch (error) {
      results.push({
        fileName: file.name,
        success: false,
        error: error.message
      })
    }
  }
  
  console.log('批量处理结果:', results)
  
  // 统计成功和失败的数量
  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount
  
  console.log(`成功: ${successCount}, 失败: ${failureCount}`)
  
  return results
}

// 使用示例
const fileInput = document.querySelector('input[type="file"]')
fileInput.addEventListener('change', async (e) => {
  await batchProcessing(e.target.files)
})
```

### 4. 与文件系统集成

```javascript
import { fileSystemManager } from '@/utils/FileSystemManager'

async function saveAndLoadDyf() {
  // 授权文件系统
  await fileSystemManager.authorize()
  
  // 创建 DYF 文本
  const dyfText = await createDyfText({
    type: 'student',
    payload: {
      personal: {
        姓名: { data: '张三' },
        学号: { data: '20250001' }
      }
    }
  })
  
  // 保存到文件
  const filePath = 'students/张三_20250001.dyf'
  await fileSystemManager.writeFile(filePath, dyfText)
  console.log('文件已保存:', filePath)
  
  // 从文件加载
  const loadedText = await fileSystemManager.readFile(filePath)
  if (loadedText) {
    const parseResult = await parseDyfText({ text: loadedText })
    if (parseResult.ok) {
      console.log('从文件加载成功:', parseResult.payload)
    } else {
      console.error('从文件加载失败:', parseResult.message)
    }
  }
}

// 运行示例
saveAndLoadDyf()
```

## 🔧 高级用法

### 1. 自定义加密配置

```javascript
async function customEncryption() {
  // 自定义加密配置
  const customConfig = {
    encryption: {
      enabled: true,
      rsaPublicKeyJwk: {
        // 自定义 RSA 公钥
      },
      rsaAlgorithm: {
        name: 'RSA-OAEP',
        hash: 'SHA-512' // 使用更强的哈希算法
      },
      aesAlgorithm: {
        name: 'AES-GCM',
        length: 256
      }
    }
  }
  
  // 创建加密 DYF
  const dyfText = await createDyfText({
    type: 'student',
    payload: {
      personal: {
        姓名: { data: '张三' },
        学号: { data: '20250001' }
      }
    },
    serverConfig: customConfig
  })
  
  console.log('使用自定义加密配置创建的 DYF:', dyfText)
}
```

### 2. 版本兼容性处理

```javascript
async function handleVersionCompatibility() {
  // 模拟旧版本 DYF 文本
  const oldVersionDyf = JSON.stringify({
    // 旧版本格式，没有 schemaVersion 或使用旧版本
    data: {
      personal: {
        姓名: '张三',
        学号: '20250001'
      }
    }
  })
  
  // 解析旧版本 DYF
  const parseResult = await parseDyfText({ text: oldVersionDyf })
  
  if (parseResult.ok) {
    console.log('成功解析旧版本 DYF:', parseResult.payload)
  } else {
    console.error('解析旧版本 DYF 失败:', parseResult.message)
  }
}
```

### 3. 错误处理与重试

```javascript
async function safeParseDyf(text, privateKeyJwk, serverConfig, maxRetries = 3) {
  let lastError
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await parseDyfText({
        text,
        privateKeyJwk,
        serverConfig
      })
      
      if (result.ok) {
        return result
      } else {
        lastError = result.message
        console.warn(`解析失败 (${i + 1}/${maxRetries}):`, lastError)
      }
    } catch (error) {
      lastError = error.message
      console.warn(`解析异常 (${i + 1}/${maxRetries}):`, lastError)
    }
    
    // 重试前等待
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return { ok: false, message: lastError || '解析失败' }
}

// 使用示例
async function retryExample() {
  const dyfText = await createDyfText({
    type: 'student',
    payload: { personal: { 姓名: { data: '张三' } } }
  })
  
  const result = await safeParseDyf(dyfText)
  if (result.ok) {
    console.log('解析成功:', result.payload)
  } else {
    console.error('解析失败:', result.message)
  }
}
```

## 🚨 错误处理

### 常见错误及解决方案

| 错误类型 | 描述 | 解决方案 |
|---------|------|----------|
| 文件格式不正确 | DYF 文件格式错误，无法解析为 JSON | 确保文件内容是有效的 JSON 格式 |
| 缺少私钥 | 解析加密文件时缺少私钥 | 提供正确的私钥 |
| 解密失败 | 私钥不正确或文件损坏 | 检查私钥是否正确，文件是否完整 |
| 无法识别的格式 | 文件格式不是 DYF 格式 | 确保文件是有效的 DYF 格式 |
| 服务器配置错误 | 加密配置不正确 | 检查服务器配置中的加密设置 |

### 错误处理示例

```javascript
async function errorHandlingExample() {
  try {
    // 尝试解析无效的 DYF 文本
    const invalidDyf = '这不是有效的 JSON'
    const result = await parseDyfText({ text: invalidDyf })
    
    if (!result.ok) {
      console.error('解析错误:', result.message)
      // 处理错误
    }
  } catch (error) {
    console.error('异常错误:', error)
    // 处理异常
  }
  
  try {
    // 尝试解析加密文件但缺少私钥
    const encryptedDyf = await createDyfText({
      type: 'student',
      payload: { personal: { 姓名: { data: '张三' } } },
      serverConfig: {
        encryption: {
          enabled: true,
          rsaPublicKeyJwk: { /* 公钥 */ }
        }
      }
    })
    
    const result = await parseDyfText({ text: encryptedDyf })
    if (!result.ok) {
      console.error('解析加密文件错误:', result.message)
      // 处理错误
    }
  } catch (error) {
    console.error('异常错误:', error)
    // 处理异常
  }
}

// 运行示例
errorHandlingExample()
```

## 📝 配置与依赖

### 依赖

- `@/utils/crypto` - 用于加密和解密操作

### 配置项

| 配置项 | 类型 | 默认值 | 描述 |
|-------|------|-------|------|
| type | string | 必需 | 文件类型，如 'student' |
| payload | object | 必需 | 要存储的数据 |
| serverConfig | object | {} | 服务器配置，包含加密设置 |
| serverConfig.encryption | object | {} | 加密配置 |
| serverConfig.encryption.enabled | boolean | false | 是否启用加密 |
| serverConfig.encryption.rsaPublicKeyJwk | object | null | RSA 公钥 |
| serverConfig.encryption.rsaAlgorithm | object | { name: 'RSA-OAEP', hash: 'SHA-256' } | RSA 算法配置 |
| serverConfig.encryption.aesAlgorithm | object | { name: 'AES-GCM', length: 256 } | AES 算法配置 |

## 🚀 性能优化

1. **缓存加密配置**：如果需要多次创建加密 DYF，缓存服务器配置
2. **批量处理**：对于多个文件，使用 Promise.all 并行处理
3. **错误处理**：合理处理错误，避免因单个文件失败而影响整个流程
4. **内存管理**：对于大文件，避免一次性加载全部内容
5. **加密优化**：对于不需要加密的数据，使用非加密模式

## 🤝 最佳实践

1. **数据验证**：在创建 DYF 文件前，验证数据的有效性
2. **错误处理**：对所有异步操作添加错误处理
3. **版本管理**：注意 schema 版本的兼容性
4. **安全性**：对于敏感数据，使用加密模式
5. **备份**：定期备份 DYF 文件，防止数据丢失
6. **格式规范**：遵循 DYF 格式规范，确保文件可被正确解析

### 示例：数据验证

```javascript
function validateStudentData(data) {
  const errors = []
  
  // 验证个人信息
  if (!data.personal) {
    errors.push('缺少个人信息')
  } else {
    if (!data.personal.姓名?.data) {
      errors.push('缺少姓名')
    }
    if (!data.personal.学号?.data) {
      errors.push('缺少学号')
    }
  }
  
  // 验证德育分数据
  if (!data.dyf) {
    errors.push('缺少德育分数据')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

async function createValidDyf(studentData) {
  // 验证数据
  const validation = validateStudentData(studentData)
  if (!validation.valid) {
    console.error('数据验证失败:', validation.errors)
    return null
  }
  
  // 创建 DYF 文件
  const dyfText = await createDyfText({
    type: 'student',
    payload: studentData
  })
  
  return dyfText
}

// 使用示例
async function validationExample() {
  const studentData = {
    personal: {
      姓名: { data: '张三' },
      学号: { data: '20250001' }
    },
    dyf: {
      基础分: [[{ number: 111, score: 100 }]]
    }
  }
  
  const dyfText = await createValidDyf(studentData)
  if (dyfText) {
    console.log('创建成功:', dyfText)
  }
}
```

## 🔍 调试技巧

### 1. 查看 DYF 文件结构

```javascript
async function inspectDyfStructure() {
  const dyfText = await createDyfText({
    type: 'student',
    payload: {
      personal: {
        姓名: { data: '张三' },
        学号: { data: '20250001' }
      }
    }
  })
  
  console.log('DYF 文本:', dyfText)
  
  // 解析并查看结构
  const parsed = JSON.parse(dyfText)
  console.log('解析后的结构:', {
    schemaVersion: parsed.schemaVersion,
    type: parsed.type,
    encrypted: parsed.encrypted,
    hasData: !!parsed.data,
    hasKey: !!parsed.key,
    hasIv: !!parsed.iv
  })
}

// 运行示例
inspectDyfStructure()
```

### 2. 测试加密性能

```javascript
async function testEncryptionPerformance() {
  const testData = {
    personal: {
      姓名: { data: '张三' },
      学号: { data: '20250001' },
      // 添加更多数据以测试性能
      ...Array.from({ length: 100 }, (_, i) => ({ [`字段${i}`]: { data: `值${i}` } }))
    }
  }
  
  // 测试非加密模式
  console.log('测试非加密模式...')
  const startNonEncrypted = performance.now()
  const nonEncrypted = await createDyfText({
    type: 'student',
    payload: testData
  })
  const endNonEncrypted = performance.now()
  console.log(`非加密模式耗时: ${(endNonEncrypted - startNonEncrypted).toFixed(2)}ms`)
  console.log(`非加密文件大小: ${nonEncrypted.length} 字节`)
  
  // 测试加密模式
  console.log('测试加密模式...')
  const startEncrypted = performance.now()
  const encrypted = await createDyfText({
    type: 'student',
    payload: testData,
    serverConfig: {
      encryption: {
        enabled: true,
        rsaPublicKeyJwk: { /* 公钥 */ }
      }
    }
  })
  const endEncrypted = performance.now()
  console.log(`加密模式耗时: ${(endEncrypted - startEncrypted).toFixed(2)}ms`)
  console.log(`加密文件大小: ${encrypted.length} 字节`)
}

// 运行示例
testEncryptionPerformance()
```

### 3. 验证解析结果

```javascript
async function verifyParseResult() {
  // 创建测试数据
  const testPayload = {
    personal: {
      姓名: { data: '张三' },
      学号: { data: '20250001' }
    },
    dyf: {
      基础分: [[{ number: 111, score: 100 }]]
    }
  }
  
  // 创建 DYF
  const dyfText = await createDyfText({
    type: 'student',
    payload: testPayload
  })
  
  // 解析 DYF
  const parseResult = await parseDyfText({ text: dyfText })
  
  // 验证结果
  if (parseResult.ok) {
    const parsedPayload = parseResult.payload
    const isMatch = JSON.stringify(parsedPayload) === JSON.stringify(testPayload)
    console.log('解析结果与原始数据是否匹配:', isMatch)
    
    if (!isMatch) {
      console.log('原始数据:', testPayload)
      console.log('解析结果:', parsedPayload)
    }
  } else {
    console.error('解析失败:', parseResult.message)
  }
}

// 运行示例
verifyParseResult()
```

## 📞 问题反馈

如果在使用过程中遇到问题，请：

1. 检查 DYF 文件格式是否正确
2. 确保加密配置和密钥正确
3. 查看控制台是否有相关错误信息
4. 参考本文档的错误处理部分
5. 测试解析简单的 DYF 文件，逐步定位问题

## 📋 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2025-01-01 | 初始版本 |
| v1.1.0 | 2025-03-15 | 增加加密支持 |
| v2.0.0 | 2025-06-20 | 优化文件格式 |
| v3.0.0 | 2025-09-10 | 改进加密算法，增加兼容性 |

## 🎯 总结

`dyfFile` 是一个功能强大的 DYF 文件处理工具，提供了创建和解析 DYF 格式文件的能力，支持加密和非加密模式。它具有以下特点：

- 简单易用的 API
- 支持加密和解密
- 兼容旧版本格式
- 自动处理 schema 版本
- 与其他工具集成良好

使用 `dyfFile` 工具，可以方便地在学生德育分管理系统中进行数据交换，确保数据的安全性和完整性。

---

**本文档由开发团队维护，如有更新请及时查阅。**

*最后更新时间：2026-02-16*
