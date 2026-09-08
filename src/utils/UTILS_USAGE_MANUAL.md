# Utils 工具库使用手册

本文档详细介绍了 `src/utils/` 目录下所有工具文件的功能、用法和示例，帮助开发者快速理解和使用这些工具。

## 📁 目录结构

```text
src/utils/
├── FileSystemManager.js     # 文件系统管理器
├── appToast.js              # 应用消息提示
├── crypto.js                # 加密工具
├── dyfFile.js               # DYF 文件处理
├── fileDownload.js          # 文件下载
├── importStudentsFromFiles.js # 批量导入学生
├── localConfig.js           # 本地配置管理
├── logger.js                # 日志工具
├── reportError.js           # 错误报告
├── serverConfig.js          # 服务器配置
├── studentScoreExcel.js     # 学生成绩 Excel 处理
├── studentScoreExcel.test.js # Excel 处理测试
└── studentStorage.js        # 学生数据存储
```

## 📖 详细使用说明

### 1. FileSystemManager.js

#### 概述
文件系统管理器，封装了 File System Access API，提供文件/文件夹的授权、读写及持久化能力。

#### 主要功能
- 浏览器支持检测
- 文件夹授权与撤销
- 文件读写操作
- 目录结构读取
- 项目结构初始化

#### 导出对象
- `fileSystemManager`：默认实例
- `FileSystemManager`：类

#### 使用示例

```javascript
import { fileSystemManager } from '@/utils/FileSystemManager'

// 检测浏览器支持
if (!fileSystemManager.isSupported()) {
  console.error('浏览器不支持 File System Access API')
}

// 授权文件夹
async function authorizeFolder() {
  try {
    await fileSystemManager.authorize()
    console.log('授权成功')
  } catch (error) {
    console.error('授权失败:', error)
  }
}

// 写入文件
async function writeFile() {
  await fileSystemManager.writeFile('test.txt', 'Hello World!')
}

// 读取文件
async function readFile() {
  const content = await fileSystemManager.readFile('test.txt')
  console.log('文件内容:', content)
}

// 读取目录结构
async function readDir() {
  const structure = await fileSystemManager.readDirectoryStructure('', 3)
  console.log('目录结构:', structure)
}

// 撤销授权
async function revokeAccess() {
  await fileSystemManager.revoke()
  console.log('授权已撤销')
}
```

### 2. appToast.js

#### 概述
应用消息提示工具，基于传入的 toast 实例创建统一的消息提示方法。

#### 主要功能
- 成功消息
- 错误消息
- 警告消息
- 信息消息

#### 导出函数
- `createAppToast(toast)`：创建消息提示实例

#### 使用示例

```javascript
import { createAppToast } from '@/utils/appToast'

// 假设已有 toast 实例
const toast = useToast() // 示例：从 UI 库获取 toast 实例
const appToast = createAppToast(toast)

// 显示成功消息
appToast.success('操作成功')

// 显示错误消息
appToast.error('操作失败')

// 显示警告消息
appToast.warning('警告信息')

// 显示信息消息
appToast.info('提示信息')

// 支持传入配置对象
appToast.success({
  title: '操作成功',
  duration: 3000,
  position: 'top'
})
```

### 3. crypto.js

#### 概述
加密工具库，提供了各种加密相关的功能，包括 RSA、AES-GCM 加密等。

#### 主要功能
- 字符串与字节转换
- 随机字节生成
- Base64 编码/解码
- RSA 密钥对生成与加密/解密
- AES-GCM 加密/解密

#### 导出函数

| 函数名 | 描述 | 参数 | 返回值 |
|-------|------|------|-------|
| `utf8ToBytes` | UTF-8 字符串转字节 | `text` (string) | `Uint8Array` |
| `bytesToUtf8` | 字节转 UTF-8 字符串 | `bytes` (Uint8Array) | `string` |
| `randomBytes` | 生成随机字节 | `length` (number) | `Uint8Array` |
| `bytesToBase64` | 字节转 Base64 | `bytes` (Uint8Array) | `string` |
| `base64ToBytes` | Base64 转字节 | `b64` (string) | `Uint8Array` |
| `generateRsaOaepKeyPair` | 生成 RSA-OAEP 密钥对 | `options` (object) | `Promise<{publicKeyJwk, privateKeyJwk}>` |
| `importRsaPublicKey` | 导入 RSA 公钥 | `{jwk, algorithm}` | `Promise<CryptoKey>` |
| `importRsaPrivateKey` | 导入 RSA 私钥 | `{jwk, algorithm}` | `Promise<CryptoKey>` |
| `rsaEncrypt` | RSA 加密 | `{publicKey, data}` | `Promise<Uint8Array>` |
| `rsaDecrypt` | RSA 解密 | `{privateKey, data}` | `Promise<Uint8Array>` |
| `verifyRsaKeyPair` | 验证 RSA 密钥对 | `{publicKeyJwk, privateKeyJwk, algorithm}` | `Promise<boolean>` |
| `aesGcmEncrypt` | AES-GCM 加密 | `{keyBytes, plaintextBytes}` | `Promise<{iv, ciphertext}>` |
| `aesGcmDecrypt` | AES-GCM 解密 | `{keyBytes, iv, ciphertextBytes}` | `Promise<Uint8Array>` |

#### 使用示例

```javascript
import * as crypto from '@/utils/crypto'

// 生成 RSA 密钥对
async function generateKeys() {
  const { publicKeyJwk, privateKeyJwk } = await crypto.generateRsaOaepKeyPair()
  console.log('公钥:', publicKeyJwk)
  console.log('私钥:', privateKeyJwk)
  return { publicKeyJwk, privateKeyJwk }
}

// 加密解密示例
async function encryptDecryptExample() {
  // 生成密钥
  const { publicKeyJwk, privateKeyJwk } = await generateKeys()
  
  // 导入密钥
  const publicKey = await crypto.importRsaPublicKey({ jwk: publicKeyJwk })
  const privateKey = await crypto.importRsaPrivateKey({ jwk: privateKeyJwk })
  
  // 准备数据
  const data = crypto.utf8ToBytes('Hello, World!')
  
  // 加密
  const encrypted = await crypto.rsaEncrypt({ publicKey, data })
  console.log('加密后:', crypto.bytesToBase64(encrypted))
  
  // 解密
  const decrypted = await crypto.rsaDecrypt({ privateKey, data: encrypted })
  console.log('解密后:', crypto.bytesToUtf8(decrypted))
}

// AES-GCM 加密示例
async function aesExample() {
  const keyBytes = crypto.randomBytes(32) // 256 位密钥
  const plaintextBytes = crypto.utf8ToBytes('Hello, AES!')
  
  // 加密
  const { iv, ciphertext } = await crypto.aesGcmEncrypt({ keyBytes, plaintextBytes })
  console.log('AES 加密后:', crypto.bytesToBase64(ciphertext))
  
  // 解密
  const decrypted = await crypto.aesGcmDecrypt({ keyBytes, iv, ciphertextBytes: ciphertext })
  console.log('AES 解密后:', crypto.bytesToUtf8(decrypted))
}
```

### 4. dyfFile.js

#### 概述
DYF 文件处理工具，用于创建和解析 DYF 格式的文件，支持加密和非加密模式。

#### 主要功能
- 创建 DYF 文本
- 解析 DYF 文本
- 支持加密和解密

#### 导出对象
- `DYF_SCHEMA_VERSION`：当前 schema 版本
- `createDyfText`：创建 DYF 文本
- `parseDyfText`：解析 DYF 文本

#### 使用示例

```javascript
import { createDyfText, parseDyfText } from '@/utils/dyfFile'

// 创建 DYF 文本（非加密）
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
}

// 创建加密 DYF 文本
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
}

// 解析 DYF 文本
async function parseDyf(text, privateKeyJwk, serverConfig) {
  const result = await parseDyfText({
    text,
    privateKeyJwk, // 用于解密
    serverConfig
  })
  
  if (result.ok) {
    console.log('解析成功:', result.type, result.payload)
  } else {
    console.error('解析失败:', result.message)
  }
}
```

### 5. fileDownload.js

#### 概述
文件下载工具，提供简单的文件下载功能。

#### 主要功能
- 下载 Blob 文件
- 下载文本文件

#### 导出函数
- `downloadFile`：下载文件
- `downloadText`：下载文本

#### 使用示例

```javascript
import { downloadFile, downloadText } from '@/utils/fileDownload'

// 下载 Blob 文件
function downloadBlobFile() {
  const blob = new Blob(['Hello, Blob!'], { type: 'text/plain' })
  downloadFile({
    fileName: 'example.txt',
    blob
  })
}

// 下载文本文件
function downloadJsonFile() {
  const jsonContent = JSON.stringify({ name: '张三', id: '20250001' }, null, 2)
  downloadText({
    fileName: 'student.json',
    text: jsonContent,
    mime: 'application/json'
  })
}
```

### 6. importStudentsFromFiles.js

#### 概述
批量导入学生工具，用于从多个文件中导入学生数据。

#### 主要功能
- 批量处理文件
- 支持进度回调
- 统一错误处理

#### 导出函数
- `importStudentsFromFiles`：批量导入学生

#### 使用示例

```javascript
import { importStudentsFromFiles } from '@/utils/importStudentsFromFiles'

// 批量导入学生
async function batchImportStudents(files) {
  const result = await importStudentsFromFiles({
    files,
    // 单个学生导入函数
    importStudent: async (text) => {
      // 解析文本并导入学生
      // 返回 { ok: boolean, message?: string, name?: string, id?: string }
      return { ok: true, name: '张三', id: '20250001' }
    },
    // 进度回调
    onProgress: ({ done, total }) => {
      console.log(`导入进度: ${done}/${total}`)
    }
  })
  
  console.log('导入结果:', result)
  console.log(`成功: ${result.okCount}, 失败: ${result.failCount}`)
}

// 使用示例
const fileInput = document.querySelector('input[type="file"]')
fileInput.addEventListener('change', async (e) => {
  await batchImportStudents(e.target.files)
})
```

### 7. localConfig.js

#### 概述
本地配置管理工具，用于读写和管理本地配置文件。

#### 主要功能
- 读取本地配置
- 写入本地配置
- 配置迁移
- 确保配置存在

#### 导出函数

| 函数名 | 描述 | 参数 | 返回值 |
|-------|------|------|-------|
| `migrateLocalConfig` | 迁移配置 | `raw` (object) | `{ config, migrated }` |
| `readLocalConfig` | 读取配置 | `{ scope = 'class' }` | `Promise<object|null>` |
| `writeLocalConfig` | 写入配置 | `config` (object), `{ scope = 'class' }` | `Promise<void>` |
| `ensureLocalConfig` | 确保配置存在 | `{ scope = 'class' }` | `Promise<object>` |
| `getLocalClassInfo` | 获取班级信息 | `config` (object) | `object|null` |

#### 使用示例

```javascript
import { readLocalConfig, writeLocalConfig, ensureLocalConfig, getLocalClassInfo } from '@/utils/localConfig'

// 读取配置
async function loadConfig() {
  const config = await readLocalConfig({ scope: 'class' })
  console.log('配置:', config)
}

// 写入配置
async function saveConfig() {
  const newConfig = {
    schemaVersion: 1,
    class: {
      grade: '2025',
      major: '计算机',
      name: '1班'
    },
    encryption: {}
  }
  await writeLocalConfig(newConfig, { scope: 'class' })
  console.log('配置已保存')
}

// 确保配置存在
async function setupConfig() {
  const config = await ensureLocalConfig({ scope: 'class' })
  console.log('当前配置:', config)
}

// 获取班级信息
function getClassInfo() {
  const config = { /* 配置对象 */ }
  const classInfo = getLocalClassInfo(config)
  console.log('班级信息:', classInfo)
}
```

### 8. logger.js

#### 概述
日志工具，提供了不同级别的日志输出功能，支持开发环境和生产环境的区分。

#### 主要功能
- 调试日志
- 信息日志
- 警告日志
- 错误日志

#### 导出函数
- `createLogger`：创建日志实例

#### 使用示例

```javascript
import { createLogger } from '@/utils/logger'

// 创建日志实例
const log = createLogger('user')

// 调试日志（仅开发环境显示）
log.debug('这是调试信息', { userId: '20250001' })

// 信息日志
log.info('用户登录成功', { userId: '20250001' })

// 警告日志
log.warn('用户登录失败', { userId: '20250001', reason: '密码错误' })

// 错误日志
log.error('系统错误', new Error('数据库连接失败'))
```

### 9. reportError.js

#### 概述
错误报告工具，用于统一处理和报告错误。

#### 主要功能
- 错误标准化
- 错误日志记录
- 错误事件分发

#### 导出函数
- `reportError`：报告错误

#### 使用示例

```javascript
import { reportError } from '@/utils/reportError'

// 报告错误
try {
  // 可能出错的代码
  throw new Error('测试错误')
} catch (error) {
  reportError(error, {
    context: '用户操作',
    action: '提交表单',
    userId: '20250001'
  })
}

// 监听错误事件
window.addEventListener('app:error', (event) => {
  const { message, stack, context, chunkLoad } = event.detail
  console.log('捕获到错误:', message)
  // 可以在这里添加错误监控、上报等逻辑
})
```

### 10. serverConfig.js

#### 概述
服务器配置工具，用于获取和管理服务器配置。

#### 主要功能
- 获取服务器配置
- 配置缓存
- 回退配置

#### 导出函数
- `getServerConfig`：获取服务器配置
- `getServerConfigFallback`：获取回退配置

#### 使用示例

```javascript
import { getServerConfig, getServerConfigFallback } from '@/utils/serverConfig'

// 获取服务器配置
async function loadServerConfig() {
  try {
    const config = await getServerConfig()
    console.log('服务器配置:', config)
  } catch (error) {
    console.error('获取配置失败:', error)
  }
}

// 强制刷新配置
async function refreshConfig() {
  const config = await getServerConfig({ force: true })
  console.log('刷新后的配置:', config)
}

// 获取回退配置
function getFallbackConfig() {
  const config = getServerConfigFallback()
  console.log('回退配置:', config)
}
```

### 11. studentScoreExcel.js

#### 概述
学生成绩 Excel 处理工具，用于导出学生成绩 Excel 文件。

#### 主要功能
- 导出学生成绩到 Excel
- 支持多工作表
- 自动计算总分

#### 导出函数
- `exportStudentScoresXlsx`：导出 Excel 文件
- `buildStudentScoresXlsxBuffer`：构建 Excel 缓冲区

#### 使用示例

```javascript
import { exportStudentScoresXlsx } from '@/utils/studentScoreExcel'
import { getStudentConfig } from '@/utils/config'

// 导出学生成绩
async function exportScores() {
  const studentConfig = await getStudentConfig()
  const students = [
    {
      data: {
        personal: {
          姓名: { data: '张三' },
          学号: { data: '20250001' }
        },
        dyf: {
          基础分: [[{ number: 111, score: 10 }, { number: 112, score: 20 }]],
          奖励分: [[{ number: 211, score: 5 }]]
        }
      }
    }
  ]

  await exportStudentScoresXlsx({
    filename: '学生成绩.xlsx',
    sheets: [
      {
        name: '基础分',
        categories: ['基础分'],
        students
      },
      {
        name: '奖励分',
        categories: ['奖励分'],
        students
      }
    ],
    studentConfig
  })
}

```

### 12. studentStorage.js

#### 概述
学生数据存储工具，用于管理学生数据的存储和读取。

#### 主要功能
- 学生数据写入磁盘
- 学生目录管理
- 证据文件处理
- 学生信息获取

#### 导出函数

| 函数名 | 描述 | 参数 | 返回值 |
|-------|------|------|-------|
| `safeJsonParse` | 安全解析 JSON | `text` (string) | `object|null` |
| `sanitizeFileName` | 清理文件名 | `name` (string) | `string` |
| `getStudentIdentity` | 获取学生身份 | `student` (object) | `{ name, id }` |
| `getStudentSemester` | 获取学生学期 | `student` (object) | `string|null` |
| `normalizeSemesterValue` | 标准化学期值 | `val` (any) | `string|null` |
| `normalizeDyfKeys` | 标准化 DYF 键 | `student` (object) | `void` |
| `normalizeEvidenceFiles` | 标准化证据文件 | `student` (object), `evidenceDirPath` (string) | `Promise<void>` |
| `getStudentFolderName` | 获取学生文件夹名 | `{ name, id }` | `string` |
| `getStudentDir` | 获取学生目录 | `{ scope, semester, name, id }` | `string` |
| `writeStudentToDisk` | 写入学生到磁盘 | `{ scope, semester, student }` | `Promise<object>` |
| `embedEvidenceFilesForExport` | 嵌入证据文件 | `{ scope, semester, student }` | `Promise<object>` |

#### 使用示例

```javascript
import { 
  writeStudentToDisk, 
  getStudentIdentity, 
  getStudentSemester,
  embedEvidenceFilesForExport
} from '@/utils/studentStorage'

// 写入学生数据
async function saveStudent(student) {
  try {
    const result = await writeStudentToDisk({
      scope: 'class',
      semester: '2025-1',
      student
    })
    console.log('学生已保存:', result)
  } catch (error) {
    console.error('保存失败:', error)
  }
}

// 获取学生信息
function getStudentInfo(student) {
  const identity = getStudentIdentity(student)
  const semester = getStudentSemester(student)
  console.log('学生身份:', identity)
  console.log('学期:', semester)
}

// 嵌入证据文件
async function prepareStudentForExport(student) {
  const studentWithEvidence = await embedEvidenceFilesForExport({
    scope: 'class',
    semester: '2025-1',
    student
  })
  console.log('包含证据的学生数据:', studentWithEvidence)
}
```

## 🚀 最佳实践

### 1. 工具使用建议

1. **模块化导入**：只导入需要的工具函数，减少不必要的依赖
2. **错误处理**：对所有异步操作添加适当的错误处理
3. **性能优化**：
   - 对于频繁使用的配置，考虑缓存结果
   - 对于大文件操作，使用流式处理
   - 避免在循环中进行同步文件读写

### 2. 常见问题解决

#### Q: FileSystemManager 授权失败
A: 确保浏览器支持 File System Access API，并且用户没有拒绝授权。

#### Q: 加密解密失败
A: 检查密钥是否正确，确保公钥和私钥配对使用。

#### Q: Excel 导出失败
A: 确保学生配置正确，并且学生数据格式符合要求。

#### Q: 本地配置读取失败
A: 检查文件系统权限，确保已授权文件系统访问。

## 📝 版本历史

- **v1.0.0**：初始版本，包含所有基础工具
- **v1.1.0**：新增 DYF 文件加密支持
- **v1.2.0**：优化 Excel 导出功能

## 🤝 贡献指南

如果您发现工具库有任何问题或需要添加新功能，请：

1. 检查现有代码，了解实现方式
2. 遵循现有代码风格和命名规范
3. 添加适当的注释和文档
4. 编写测试用例（如有必要）

## 📞 联系我们

如有任何问题或建议，请联系开发团队。

---

**本文档由开发团队维护，如有更新请及时查阅。**

*最后更新时间：2026-02-16*
