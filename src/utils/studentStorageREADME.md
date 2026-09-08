# StudentStorage 工具使用文档

## 1. 工具简介

**StudentStorage** 是一个学生数据存储管理工具，用于处理学生数据的存储、读取、规范化和证据文件管理。它支持将学生数据写入磁盘、处理证据文件、提取学生身份信息等功能。

**主要功能：**
- 学生身份信息提取和管理
- 学期信息处理和规范化
- 文件名清理和生成
- 证据文件处理和存储
- 学生数据写入磁盘
- 证据文件嵌入（用于导出）
- 学生目录结构管理

## 2. 核心 API

### 2.1 安全 JSON 解析

```javascript
import { safeJsonParse } from '@/utils/studentStorage'

const data = safeJsonParse(jsonString)
```

**参数：**
- `text` - JSON 字符串

**返回值：**
- 解析后的对象，解析失败时返回 null

**功能说明：**
- 安全地解析 JSON 字符串
- 捕获可能的解析错误，避免程序崩溃

### 2.2 文件名清理

```javascript
import { sanitizeFileName } from '@/utils/studentStorage'

const safeFileName = sanitizeFileName('学生 123/456.txt')
```

**参数：**
- `name` - 原始文件名

**返回值：**
- 清理后的安全文件名

**功能说明：**
- 移除或替换不安全的文件名字符（\/:*?"<>|）
- 清理多余的空白字符
- 去除首尾空白
- 如果输入为空，返回 'file'

### 2.3 获取学生身份信息

```javascript
import { getStudentIdentity } from '@/utils/studentStorage'

const { name, id } = getStudentIdentity(student)
```

**参数：**
- `student` - 学生数据对象

**返回值：**
- 包含 `name`（姓名）和 `id`（学号）的对象

**功能说明：**
- 从学生数据中提取姓名和学号
- 支持从 `student.data.personal` 路径获取信息

### 2.4 获取学生学期信息

```javascript
import { getStudentSemester } from '@/utils/studentStorage'

const semester = getStudentSemester(student)
```

**参数：**
- `student` - 学生数据对象

**返回值：**
- 学期字符串（格式："年份-学期"），如果信息不完整返回 null

**功能说明：**
- 从学生数据中提取年份和学期信息
- 支持多种字段命名方式（年份/year，学期/semester）
- 生成标准化的学期字符串

### 2.5 学期值规范化

```javascript
import { normalizeSemesterValue } from '@/utils/studentStorage'

const semester = normalizeSemesterValue(value)
```

**参数：**
- `val` - 学期值（可以是字符串、数字或对象）

**返回值：**
- 规范化后的学期字符串，无效输入返回 null

**功能说明：**
- 将不同类型的学期值规范化为字符串
- 支持从对象的 value 或 label 属性中提取值

### 2.6 规范化 DYF 键

```javascript
import { normalizeDyfKeys } from '@/utils/studentStorage'

normalizeDyfKeys(student)
```

**参数：**
- `student` - 学生数据对象

**返回值：**
- 无

**功能说明：**
- 保持数据结构的一致性

### 2.7 规范化证据文件

```javascript
import { normalizeEvidenceFiles } from '@/utils/studentStorage'

await normalizeEvidenceFiles(student, 'class/semesters/2023-1/students/张三_123456/evidence')
```

**参数：**
- `student` - 学生数据对象
- `evidenceDirPath` - 证据文件存储目录路径

**返回值：**
- Promise，完成时无返回值

**功能说明：**
- 处理学生数据中的证据文件
- 将 data URL 格式的文件内容写入磁盘
- 生成唯一的文件名
- 更新学生数据中的文件引用

### 2.8 获取学生文件夹名称

```javascript
import { getStudentFolderName } from '@/utils/studentStorage'

const folderName = getStudentFolderName({ name: '张三', id: '123456' })
```

**参数：**
- `name` - 学生姓名
- `id` - 学生学号

**返回值：**
- 学生文件夹名称（格式："姓名_学号"）

**功能说明：**
- 生成规范化的学生文件夹名称
- 使用 sanitizeFileName 清理输入

### 2.9 获取学生目录路径

```javascript
import { getStudentDir } from '@/utils/studentStorage'

const studentDir = getStudentDir({ scope: 'class', semester: '2023-1', name: '张三', id: '123456' })
```

**参数：**
- `scope` - 作用域（'class' 或 'grade'），默认为 'class'
- `semester` - 学期
- `name` - 学生姓名
- `id` - 学生学号

**返回值：**
- 学生目录路径

**功能说明：**
- 生成规范化的学生目录路径
- 格式：`${scope}/semesters/${semester}/students/${name}_${id}`

### 2.10 将学生数据写入磁盘

```javascript
import { writeStudentToDisk } from '@/utils/studentStorage'

const result = await writeStudentToDisk({ scope: 'class', semester: '2023-1', student })
```

**参数：**
- `scope` - 作用域（'class' 或 'grade'），默认为 'class'
- `semester` - 学期
- `student` - 学生数据对象

**返回值：**
- Promise，解析为包含以下属性的对象：
  - `studentDir` - 学生目录路径
  - `infoPath` - 学生信息文件路径
  - `evidenceDir` - 证据文件目录路径
  - `name` - 学生姓名
  - `id` - 学生学号

**功能说明：**
- 规范化学生数据中的 DYF 键
- 提取学生身份信息
- 生成学生目录路径
- 规范化证据文件
- 将学生数据写入 info.json 文件

### 2.11 嵌入证据文件用于导出

```javascript
import { embedEvidenceFilesForExport } from '@/utils/studentStorage'

const studentWithEmbeddedFiles = await embedEvidenceFilesForExport({ scope: 'class', semester: '2023-1', student })
```

**参数：**
- `scope` - 作用域（'class' 或 'grade'），默认为 'class'
- `semester` - 学期
- `student` - 学生数据对象

**返回值：**
- Promise，解析为嵌入了证据文件的学生数据对象

**功能说明：**
- 克隆学生数据对象
- 提取学生身份信息
- 生成学生目录路径
- 读取证据文件并转换为 data URL
- 将证据文件嵌入到学生数据中
- 对于无法读取的文件，保持原始引用

## 3. 内部功能

### 3.1 数据 URL 转换为 Blob

**StudentStorage** 内部使用 `dataUrlToBlob` 函数将 data URL 转换为 Blob 对象：

```javascript
const { blob, mime } = dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
```

### 3.2 MIME 类型转换为文件扩展名

**StudentStorage** 内部使用 `extFromMime` 函数根据 MIME 类型获取文件扩展名：

```javascript
const ext = extFromMime('image/png') // 返回 'png'
```

### 3.3 ArrayBuffer 转换为 Base64

**StudentStorage** 内部使用 `arrayBufferToBase64` 函数将 ArrayBuffer 转换为 Base64 字符串：

```javascript
const base64 = arrayBufferToBase64(arrayBuffer)
```

### 3.4 获取唯一文件名

**StudentStorage** 内部使用 `getUniqueFileName` 函数生成唯一的文件名：

```javascript
const uniqueFileName = await getUniqueFileName('class/evidence', 'file.txt')
```

## 4. 使用示例

### 4.1 基本使用 - 写入学生数据

```javascript
import { writeStudentToDisk } from '@/utils/studentStorage'

const student = {
  data: {
    personal: {
      姓名: { data: '张三' },
      学号: { data: '123456' },
      年份: { data: '2023' },
      学期: { data: '1' }
    },
    dyf: {
      '奖励分': [
        [
          {
            number: '1',
            support: {
              files: [
                {
                  content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                  file: { name: 'certificate.png' }
                }
              ]
            }
          }
        ]
      ]
    }
  }
}

try {
  const result = await writeStudentToDisk({
    scope: 'class',
    semester: '2023-1',
    student
  })
  
  console.log('学生数据已写入:', result.studentDir)
} catch (error) {
  console.error('写入学生数据失败:', error)
}
```

### 4.2 提取学生信息

```javascript
import { getStudentIdentity, getStudentSemester } from '@/utils/studentStorage'

const student = {
  data: {
    personal: {
      姓名: { data: '李四' },
      学号: { data: '654321' },
      年份: { data: '2023' },
      学期: { data: '2' }
    }
  }
}

const identity = getStudentIdentity(student)
console.log('学生身份:', identity) // { name: '李四', id: '654321' }

const semester = getStudentSemester(student)
console.log('学生学期:', semester) // '2023-2'
```

### 4.3 导出学生数据（嵌入证据文件）

```javascript
import { embedEvidenceFilesForExport } from '@/utils/studentStorage'

const student = {
  data: {
    personal: {
      姓名: { data: '王五' },
      学号: { data: '987654' }
    },
    dyf: {
      '奖励分': [
        [
          {
            support: {
              files: ['certificate.png']
            }
          }
        ]
      ]
    }
  }
}

try {
  const studentWithEmbeddedFiles = await embedEvidenceFilesForExport({
    scope: 'class',
    semester: '2023-1',
    student
  })
  
  console.log('学生数据已嵌入证据文件:', studentWithEmbeddedFiles)
} catch (error) {
  console.error('嵌入证据文件失败:', error)
}
```

### 4.4 处理证据文件

```javascript
import { normalizeEvidenceFiles } from '@/utils/studentStorage'

const student = {
  data: {
    dyf: {
      '奖励分': [
        [
          {
            support: {
              files: [
                {
                  content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                  file: { name: 'certificate.png' }
                }
              ]
            }
          }
        ]
      ]
    }
  }
}

try {
  await normalizeEvidenceFiles(student, 'class/semesters/2023-1/students/张三_123456/evidence')
  console.log('证据文件已处理:', student.data.dyf['奖励分'][0][0].support.files)
} catch (error) {
  console.error('处理证据文件失败:', error)
}
```

## 5. 学生目录结构

**StudentStorage** 使用以下目录结构存储学生数据：

```
${scope}/
└── semesters/
    └── ${semester}/
        └── students/
            └── ${name}_${id}/
                ├── info.json          # 学生数据
                └── evidence/           # 证据文件目录
                    ├── certificate.png # 证据文件
                    └── ...
```

- `${scope}` - 作用域，通常为 'class' 或 'grade'
- `${semester}` - 学期，格式为 "年份-学期"
- `${name}_${id}` - 学生文件夹名称，格式为 "姓名_学号"

## 6. 最佳实践

1. **数据验证** - 在调用 `writeStudentToDisk` 前，验证学生数据是否包含必要的字段（姓名、学号）

2. **错误处理** - 使用 try-catch 包装异步操作，处理可能的错误

3. **路径管理** - 使用 `getStudentDir` 生成学生目录路径，避免手动拼接路径

4. **文件名安全** - 使用 `sanitizeFileName` 处理用户输入的文件名，避免安全问题

5. **证据文件管理** - 对于大文件，考虑在前端进行压缩或限制大小，避免性能问题

6. **数据备份** - 定期备份学生数据，防止数据丢失

7. **批量操作** - 对于批量学生数据操作，考虑使用 Promise.all 并行处理，提高性能

8. **内存管理** - 对于嵌入证据文件的操作，注意内存使用，特别是处理大量或大尺寸的证据文件时

## 7. 性能考虑

- **异步操作** - 大部分文件操作是异步的，不会阻塞主线程

- **文件 I/O** - 文件写入和读取操作可能较慢，特别是处理大文件时

- **内存使用** - 嵌入证据文件时，会将文件内容加载到内存中，可能导致内存使用增加

- **批量操作** - 对于多个学生的操作，建议使用并行处理

- **建议** - 
  - 对于大文件，考虑分块处理
  - 避免在循环中重复执行文件操作
  - 对于频繁访问的路径，缓存结果

## 8. 与其他工具的集成

### 8.1 与文件系统管理器集成

```javascript
import { writeStudentToDisk } from '@/utils/studentStorage'
import { fileSystemManager } from '@/utils/FileSystemManager'

// 确保文件系统访问权限
await fileSystemManager.requestDirectoryAccess()

// 写入学生数据
const result = await writeStudentToDisk({ scope: 'class', semester: '2023-1', student })
console.log('学生数据已写入:', result.studentDir)
```

### 8.2 与加密工具集成

```javascript
import { writeStudentToDisk, embedEvidenceFilesForExport } from '@/utils/studentStorage'
import { encrypt } from '@/utils/crypto'
import { getServerConfig } from '@/utils/serverConfig'

const config = await getServerConfig()

// 导出并加密学生数据
const studentWithEmbeddedFiles = await embedEvidenceFilesForExport({ scope: 'class', semester: '2023-1', student })
const encryptedData = encrypt(studentWithEmbeddedFiles, config.encryption)

// 保存加密数据
await fileSystemManager.writeFile('class/students/encrypted/张三_123456.json', JSON.stringify(encryptedData))
```

### 8.3 与 DYF 文件工具集成

```javascript
import { writeStudentToDisk } from '@/utils/studentStorage'
import { createDyfFile } from '@/utils/dyfFile'

// 写入学生数据
const result = await writeStudentToDisk({ scope: 'class', semester: '2023-1', student })

// 创建 DYF 文件
const dyfFile = createDyfFile(student)

// 保存 DYF 文件
await fileSystemManager.writeFile(`${result.studentDir}/data.dyf`, JSON.stringify(dyfFile))
```

## 9. 浏览器兼容性

**StudentStorage** 依赖于以下浏览器特性：

- `JSON.parse` 和 `JSON.stringify` - 用于 JSON 处理
- `atob` - 用于 Base64 解码
- `Blob` - 用于文件处理
- `Uint8Array` - 用于二进制数据处理
- `async/await` - 用于异步操作

这些特性在所有现代浏览器中都可用，对于旧浏览器，可能需要添加相应的 polyfill。

## 10. 测试建议

在测试中使用 **StudentStorage** 时，建议：

1. **模拟文件系统** - 在单元测试中，模拟 fileSystemManager 的方法

2. **测试数据格式** - 测试不同格式的学生数据，确保工具能正确处理

3. **测试证据文件处理** - 测试不同类型的证据文件，包括 data URL 和文件引用

4. **测试错误处理** - 测试缺少必要字段的学生数据，确保工具能正确处理错误

5. **测试路径生成** - 测试不同输入下的路径生成，确保路径格式正确

## 11. 代码优化建议

- **错误处理增强** - 添加更详细的错误信息，便于排查问题

- **性能优化** - 对于大文件操作，考虑使用 Web Workers 处理

- **内存管理** - 添加证据文件大小限制，避免内存溢出

- **缓存机制** - 添加路径和文件名的缓存，减少重复计算

- **模块化** - 将功能进一步模块化，提高代码可维护性

- **类型定义** - 添加 TypeScript 类型定义，提高代码安全性

- **文档完善** - 为所有函数添加 JSDoc 注释，提高代码可读性

## 12. 安全注意事项

- **文件名安全** - 始终使用 `sanitizeFileName` 处理用户输入的文件名，避免路径遍历攻击

- **文件大小限制** - 限制证据文件的大小，避免恶意用户上传过大的文件

- **数据验证** - 验证学生数据的结构和内容，避免恶意数据导致的问题

- **权限管理** - 确保文件系统访问权限的正确管理，避免未授权访问

- **敏感信息** - 避免在学生数据中存储敏感信息，如密码、身份证号等

- **加密** - 对于敏感的学生数据，考虑使用加密工具进行保护
