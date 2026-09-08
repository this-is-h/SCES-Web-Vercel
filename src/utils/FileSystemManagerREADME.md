# FileSystemManager 使用手册

## 📋 概述

`FileSystemManager` 是一个文件系统管理工具，封装了 File System Access API，提供文件/文件夹的授权、读写及持久化能力。

### 核心功能
- 浏览器支持检测
- 文件夹授权与撤销
- 文件读写操作
- 目录结构读取
- 项目结构初始化

## 🚀 快速开始

### 安装

该工具是项目内置工具，无需单独安装，直接导入使用即可。

### 导入

```javascript
import { fileSystemManager } from '@/utils/FileSystemManager'
// 或导入类
import FileSystemManager from '@/utils/FileSystemManager'
```

## 📖 API 文档

### 1. 类：FileSystemManager

#### 构造函数

```javascript
const manager = new FileSystemManager()
```

#### 实例方法

##### 1.1 isSupported()

**描述**：检测浏览器是否支持 File System Access API

**参数**：无

**返回值**：`boolean` - 是否支持

**示例**：

```javascript
if (!fileSystemManager.isSupported()) {
  console.error('浏览器不支持 File System Access API')
}
```

##### 1.2 restoreHandle()

**描述**：从本地存储恢复文件夹句柄

**参数**：无

**返回值**：`Promise<{handle: FileSystemDirectoryHandle|null, authorized: boolean}>` - 恢复结果

**示例**：

```javascript
async function restoreAccess() {
  const { handle, authorized } = await fileSystemManager.restoreHandle()
  if (authorized) {
    console.log('已恢复授权')
  } else {
    console.log('需要重新授权')
  }
}
```

##### 1.3 authorize(forceNew = false)

**描述**：请求用户授权文件夹

**参数**：
- `forceNew` (boolean) - 是否强制重新选择文件夹，默认 false

**返回值**：`Promise<FileSystemDirectoryHandle>` - 授权的文件夹句柄

**示例**：

```javascript
async function authorizeFolder() {
  try {
    await fileSystemManager.authorize()
    console.log('授权成功')
  } catch (error) {
    console.error('授权失败:', error)
  }
}

// 强制重新选择文件夹
async function selectNewFolder() {
  await fileSystemManager.authorize(true)
  console.log('已选择新文件夹')
}
```

##### 1.4 revoke()

**描述**：撤销授权（清除本地存储的句柄）

**参数**：无

**返回值**：`Promise<void>`

**示例**：

```javascript
async function revokeAccess() {
  await fileSystemManager.revoke()
  console.log('授权已撤销')
}
```

##### 1.5 initializeProjectStructure(rootHandle)

**描述**：初始化项目目录结构说明文件

**参数**：
- `rootHandle` (FileSystemDirectoryHandle) - 根目录句柄

**返回值**：`Promise<void>`

**示例**：

```javascript
async function initStructure() {
  const handle = await fileSystemManager.authorize()
  await fileSystemManager.initializeProjectStructure(handle)
  console.log('项目结构已初始化')
}
```

##### 1.6 getFileHandle(path, create = false)

**描述**：获取文件句柄（支持路径，如 'semesters/2025-1/config.json'）

**参数**：
- `path` (string) - 相对路径
- `create` (boolean) - 是否自动创建，默认 false

**返回值**：`Promise<FileSystemFileHandle>` - 文件句柄

**示例**：

```javascript
async function getHandle() {
  const fileHandle = await fileSystemManager.getFileHandle('test.txt', true)
  console.log('获取文件句柄成功')
}
```

##### 1.7 writeFile(path, content)

**描述**：写入文件内容

**参数**：
- `path` (string) - 文件路径
- `content` (string|Blob|BufferSource) - 内容

**返回值**：`Promise<void>`

**示例**：

```javascript
async function writeFile() {
  // 写入文本
  await fileSystemManager.writeFile('test.txt', 'Hello World!')
  
  // 写入 Blob
  const blob = new Blob(['Hello Blob!'], { type: 'text/plain' })
  await fileSystemManager.writeFile('blob.txt', blob)
  
  console.log('文件写入成功')
}
```

##### 1.8 readFile(path)

**描述**：读取文件内容 (文本)

**参数**：
- `path` (string) - 文件路径

**返回值**：`Promise<string|null>` - 文件内容，失败返回 null

**示例**：

```javascript
async function readFile() {
  const content = await fileSystemManager.readFile('test.txt')
  if (content) {
    console.log('文件内容:', content)
  } else {
    console.log('文件读取失败')
  }
}
```

##### 1.9 readDirectoryStructure(path = '', depth = null, currentDepth = 0)

**描述**：递归读取目录结构

**参数**：
- `path` (string) - 相对路径，默认为根目录
- `depth` (number|null) - 读取深度，null 表示无限深度
- `currentDepth` (number) - 当前递归深度（内部使用）

**返回值**：`Promise<Array<{name: string, kind: 'file'|'directory', path: string, children?: Array}>>` - 目录结构

**示例**：

```javascript
async function readDir() {
  // 读取整个目录结构
  const structure = await fileSystemManager.readDirectoryStructure()
  console.log('完整目录结构:', structure)
  
  // 读取指定路径，限制深度
  const partial = await fileSystemManager.readDirectoryStructure('semesters', 2)
  console.log('部分目录结构:', partial)
}
```

### 2. 默认实例

```javascript
// 已创建好的默认实例，可直接使用
import { fileSystemManager } from '@/utils/FileSystemManager'
```

## 🔧 高级用法

### 1. 完整的授权流程

```javascript
async function completeAuthFlow() {
  // 1. 检测浏览器支持
  if (!fileSystemManager.isSupported()) {
    console.error('浏览器不支持 File System Access API')
    return
  }
  
  // 2. 尝试恢复之前的授权
  const { authorized } = await fileSystemManager.restoreHandle()
  
  // 3. 如果未授权，请求授权
  if (!authorized) {
    try {
      await fileSystemManager.authorize()
      console.log('授权成功')
    } catch (error) {
      console.error('授权失败:', error)
      return
    }
  }
  
  // 4. 授权成功后，进行文件操作
  await fileSystemManager.writeFile('test.txt', '授权测试成功!')
  console.log('操作完成')
}
```

### 2. 批量文件操作

```javascript
async function batchOperations() {
  const files = [
    { path: 'file1.txt', content: '内容1' },
    { path: 'file2.txt', content: '内容2' },
    { path: 'file3.txt', content: '内容3' }
  ]
  
  for (const file of files) {
    try {
      await fileSystemManager.writeFile(file.path, file.content)
      console.log(`已写入: ${file.path}`)
    } catch (error) {
      console.error(`写入失败 ${file.path}:`, error)
    }
  }
}
```

### 3. 目录结构遍历与处理

```javascript
async function processDirectory() {
  const structure = await fileSystemManager.readDirectoryStructure()
  
  function traverse(items, indent = 0) {
    for (const item of items) {
      const prefix = '  '.repeat(indent)
      console.log(`${prefix}${item.kind === 'directory' ? '📁' : '📄'} ${item.name}`)
      if (item.children && item.children.length > 0) {
        traverse(item.children, indent + 1)
      }
    }
  }
  
  traverse(structure)
}
```

## 🚨 错误处理

### 常见错误及解决方案

| 错误类型 | 描述 | 解决方案 |
|---------|------|----------|
| BROWSER_NOT_SUPPORTED | 浏览器不支持 File System Access API | 使用支持的浏览器，如 Chrome、Edge |
| PERMISSION_DENIED | 用户拒绝授权 | 重新请求授权，确保用户允许访问 |
| NO_ROOT_HANDLE | 未授权文件夹 | 先调用 authorize() 获取授权 |
| AbortError | 用户取消选择 | 捕获错误，不做处理或提示用户 |

### 错误处理示例

```javascript
async function safeOperation() {
  try {
    await fileSystemManager.authorize()
    await fileSystemManager.writeFile('data.json', JSON.stringify({ key: 'value' }))
    console.log('操作成功')
  } catch (error) {
    if (error.message === 'BROWSER_NOT_SUPPORTED') {
      console.error('请使用支持的浏览器')
    } else if (error.message === 'PERMISSION_DENIED') {
      console.error('请授权文件系统访问权限')
    } else if (error.name === 'AbortError') {
      console.log('用户取消操作')
    } else {
      console.error('操作失败:', error)
    }
  }
}
```

## 📝 配置与依赖

### 依赖
- `localforage` - 用于持久化存储文件夹句柄
- `@/utils/logger` - 用于日志记录

### 配置项

| 配置项 | 类型 | 默认值 | 描述 |
|-------|------|-------|------|
| handleKey | string | 'directoryHandle' | 存储文件夹句柄的键名 |

## 🚀 性能优化

1. **缓存授权状态**：授权成功后，句柄会自动持久化，下次访问时可直接恢复
2. **批量操作**：对于多个文件操作，建议使用 Promise.all 并行处理
3. **深度限制**：读取目录结构时，根据需要设置深度限制，避免读取过多内容
4. **错误处理**：合理处理错误，避免因单个操作失败而影响整个流程

## 🤝 最佳实践

1. **授权时机**：在用户首次需要文件系统访问时再请求授权，不要提前授权
2. **路径管理**：使用相对路径，避免硬编码绝对路径
3. **错误处理**：对所有异步操作添加 try-catch 块
4. **用户体验**：在授权和文件操作过程中提供适当的加载状态和反馈
5. **安全性**：不要存储敏感信息在未加密的文件中

## 🔍 调试技巧

### 查看授权状态

```javascript
async function checkAuthStatus() {
  const { handle, authorized } = await fileSystemManager.restoreHandle()
  console.log('授权状态:', {
    hasHandle: !!handle,
    authorized
  })
}
```

### 查看目录结构

```javascript
async function debugDirectory() {
  try {
    const structure = await fileSystemManager.readDirectoryStructure('', 3)
    console.log('目录结构:', JSON.stringify(structure, null, 2))
  } catch (error) {
    console.error('读取目录结构失败:', error)
  }
}
```

## 📞 问题反馈

如果在使用过程中遇到问题，请：

1. 检查浏览器是否支持 File System Access API
2. 确保已正确授权文件夹访问权限
3. 查看控制台是否有相关错误信息
4. 参考本文档的错误处理部分

## 📋 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2025-01-01 | 初始版本 |
| v1.1.0 | 2025-03-15 | 优化错误处理 |
| v1.2.0 | 2025-06-20 | 增加目录结构读取深度限制 |

## 🎯 总结

`FileSystemManager` 是一个功能强大的文件系统管理工具，通过封装 File System Access API，提供了简单易用的接口来操作本地文件系统。它支持：

- 文件夹授权与持久化
- 文件的读写操作
- 目录结构的读取
- 项目结构的初始化

使用 `FileSystemManager` 可以为应用提供更强大的本地文件处理能力，提升用户体验。

---

**本文档由开发团队维护，如有更新请及时查阅。**

*最后更新时间：2026-02-16*
