# fileDownload 使用手册

## 📋 概述

`fileDownload` 是一个文件下载工具，提供了简单的文件下载功能，支持下载 Blob 文件和文本文件。

### 核心功能
- 下载 Blob 文件
- 下载文本文件
- 支持自定义文件名
- 支持自定义 MIME 类型
- 自动处理 URL 创建和清理

## 🚀 快速开始

### 安装

该工具是项目内置工具，无需单独安装，直接导入使用即可。

### 导入

```javascript
import { downloadFile, downloadText } from '@/utils/fileDownload'
```

## 📖 API 文档

### 1. 函数

#### 1.1 downloadFile({ fileName, blob })

**描述**：下载 Blob 文件

**参数**：
- `fileName` (string) - 下载的文件名
- `blob` (Blob) - 要下载的 Blob 对象

**返回值**：无

**示例**：

```javascript
function downloadBlobExample() {
  // 创建文本 Blob
  const textBlob = new Blob(['Hello, World!'], { type: 'text/plain' })
  downloadFile({ fileName: 'example.txt', blob: textBlob })
  
  // 创建 JSON Blob
  const jsonBlob = new Blob([JSON.stringify({ name: '张三', id: '20250001' }, null, 2)], { type: 'application/json' })
  downloadFile({ fileName: 'data.json', blob: jsonBlob })
}
```

#### 1.2 downloadText({ fileName, text, mime })

**描述**：下载文本文件

**参数**：
- `fileName` (string) - 下载的文件名
- `text` (string) - 要下载的文本内容
- `mime` (string) - MIME 类型，默认为 'application/json'

**返回值**：无

**示例**：

```javascript
function downloadTextExample() {
  // 下载纯文本
  downloadText({ fileName: 'hello.txt', text: 'Hello, World!', mime: 'text/plain' })
  
  // 下载 JSON
  const jsonContent = JSON.stringify({ name: '张三', id: '20250001' }, null, 2)
  downloadText({ fileName: 'data.json', text: jsonContent, mime: 'application/json' })
  
  // 下载 CSV
  const csvContent = '姓名,学号,成绩\n张三,20250001,95\n李四,20250002,88'
  downloadText({ fileName: 'scores.csv', text: csvContent, mime: 'text/csv' })
}
```

## 🎯 使用示例

### 1. 基本用法

```javascript
// 下载文本文件
function downloadSimpleText() {
  const content = '这是一个简单的文本文件示例。\n包含多行内容。\n第三行内容。'
  downloadText({ 
    fileName: 'sample.txt', 
    text: content, 
    mime: 'text/plain' 
  })
}

// 下载 JSON 文件
function downloadJsonData() {
  const data = {
    name: '学生德育分管理系统',
    version: '1.0.0',
    students: [
      { id: '20250001', name: '张三', score: 95 },
      { id: '20250002', name: '李四', score: 88 },
      { id: '20250003', name: '王五', score: 92 }
    ]
  }
  
  downloadText({ 
    fileName: 'students.json', 
    text: JSON.stringify(data, null, 2), 
    mime: 'application/json' 
  })
}

// 下载 Blob 文件
function downloadBlobData() {
  // 从 canvas 创建 Blob
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'red'
  ctx.fillRect(0, 0, 100, 100)
  
  canvas.toBlob((blob) => {
    if (blob) {
      downloadFile({ fileName: 'canvas.png', blob })
    }
  }, 'image/png')
}
```

### 2. 高级用法

#### 2.1 下载 Base64 编码的文件

```javascript
function downloadBase64File(base64, fileName, mimeType) {
  // 将 Base64 转换为 Blob
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: mimeType })
  
  // 下载 Blob
  downloadFile({ fileName, blob })
}

// 使用示例
function downloadImageFromBase64() {
  // 示例 Base64 编码的图片（红色 1x1 像素）
  const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  downloadBase64File(base64Image, 'red-pixel.png', 'image/png')
}
```

#### 2.2 下载二进制文件

```javascript
async function downloadBinaryFile(url, fileName) {
  try {
    //  fetch 文件
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    // 获取 Blob
    const blob = await response.blob()
    
    // 下载文件
    downloadFile({ fileName, blob })
    
    console.log('文件下载成功:', fileName)
  } catch (error) {
    console.error('下载失败:', error)
  }
}

// 使用示例
function downloadFromUrl() {
  const fileUrl = 'https://example.com/sample.pdf'
  downloadBinaryFile(fileUrl, 'sample.pdf')
}
```

#### 2.3 批量下载文件

```javascript
function batchDownload(files) {
  files.forEach((file, index) => {
    // 延迟下载，避免浏览器阻塞
    setTimeout(() => {
      if (file.text) {
        downloadText({ 
          fileName: file.name, 
          text: file.text, 
          mime: file.mime 
        })
      } else if (file.blob) {
        downloadFile({ 
          fileName: file.name, 
          blob: file.blob 
        })
      }
    }, index * 100) // 每个文件延迟 100ms
  })
}

// 使用示例
function downloadMultipleFiles() {
  const files = [
    {
      name: 'file1.txt',
      text: '这是文件 1 的内容',
      mime: 'text/plain'
    },
    {
      name: 'file2.json',
      text: JSON.stringify({ name: '文件 2' }, null, 2),
      mime: 'application/json'
    },
    {
      name: 'file3.csv',
      text: '列1,列2,列3\n值1,值2,值3',
      mime: 'text/csv'
    }
  ]
  
  batchDownload(files)
}
```

#### 2.4 下载生成的 Excel 文件

```javascript
async function downloadExcelFile(data, fileName) {
  try {
    // 假设使用 exceljs 库生成 Excel
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Sheet 1')
    
    // 添加表头
    worksheet.addRow(['姓名', '学号', '成绩'])
    
    // 添加数据
    data.forEach(item => {
      worksheet.addRow([item.name, item.id, item.score])
    })
    
    // 生成 Blob
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    
    // 下载文件
    downloadFile({ fileName, blob })
    
    console.log('Excel 文件下载成功:', fileName)
  } catch (error) {
    console.error('生成 Excel 失败:', error)
  }
}

// 使用示例
function downloadStudentScores() {
  const studentData = [
    { name: '张三', id: '20250001', score: 95 },
    { name: '李四', id: '20250002', score: 88 },
    { name: '王五', id: '20250003', score: 92 }
  ]
  
  downloadExcelFile(studentData, '学生成绩.xlsx')
}
```

### 3. 与其他工具集成

#### 3.1 与 dyfFile 集成

```javascript
import { createDyfText } from '@/utils/dyfFile'

async function downloadDyfFile(studentData, fileName) {
  try {
    // 创建 DYF 文本
    const dyfText = await createDyfText({
      type: 'student',
      payload: studentData
    })
    
    // 下载 DYF 文件
    downloadText({ 
      fileName, 
      text: dyfText, 
      mime: 'application/json' 
    })
    
    console.log('DYF 文件下载成功:', fileName)
  } catch (error) {
    console.error('生成 DYF 失败:', error)
  }
}

// 使用示例
function downloadStudentDyf() {
  const studentData = {
    personal: {
      姓名: { data: '张三' },
      学号: { data: '20250001' }
    },
    dyf: {
      基础分: [[{ number: 111, score: 100 }]]
    }
  }
  
  downloadDyfFile(studentData, '张三_20250001.dyf')
}
```

#### 3.2 与 FileSystemManager 集成

```javascript
import { fileSystemManager } from '@/utils/FileSystemManager'

async function saveAndDownloadFile() {
  try {
    // 授权文件系统
    await fileSystemManager.authorize()
    
    // 写入文件到本地
    const content = '这是要保存和下载的内容'
    await fileSystemManager.writeFile('local-file.txt', content)
    console.log('文件已保存到本地')
    
    // 同时下载文件
    downloadText({ 
      fileName: 'downloaded-file.txt', 
      text: content, 
      mime: 'text/plain' 
    })
    console.log('文件已开始下载')
  } catch (error) {
    console.error('操作失败:', error)
  }
}

// 使用示例
saveAndDownloadFile()
```

## 🚨 错误处理

### 常见错误及解决方案

| 错误类型 | 描述 | 解决方案 |
|---------|------|----------|
| 文件名无效 | 文件名包含无效字符 | 使用有效的文件名，避免使用特殊字符 |
| Blob 为空 | Blob 对象为空或无效 | 确保提供有效的 Blob 对象 |
| 浏览器不支持 | 浏览器不支持 download 属性 | 使用现代浏览器，如 Chrome、Firefox、Edge |
| 权限不足 | 浏览器阻止下载 | 确保用户交互触发下载，避免自动下载 |
| 文件过大 | 文件大小超过浏览器限制 | 对于大文件，考虑使用服务器端下载 |

### 错误处理示例

```javascript
function safeDownloadFile(options) {
  try {
    // 验证参数
    if (!options.fileName) {
      throw new Error('缺少文件名')
    }
    
    if (!options.blob && !options.text) {
      throw new Error('缺少文件内容')
    }
    
    // 下载文件
    if (options.blob) {
      downloadFile({ fileName: options.fileName, blob: options.blob })
    } else if (options.text) {
      downloadText({ 
        fileName: options.fileName, 
        text: options.text, 
        mime: options.mime 
      })
    }
    
    return { success: true }
  } catch (error) {
    console.error('下载失败:', error)
    return { success: false, error: error.message }
  }
}

// 使用示例
function downloadWithErrorHandling() {
  const result = safeDownloadFile({
    fileName: 'test.txt',
    text: '这是测试内容',
    mime: 'text/plain'
  })
  
  if (result.success) {
    console.log('下载请求已发起')
  } else {
    console.error('下载准备失败:', result.error)
  }
}
```

## 📝 配置与依赖

### 依赖

无外部依赖，使用浏览器内置的 API。

### 浏览器兼容性

| 功能 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| downloadFile | ✅ | ✅ | ✅ | ✅ |
| downloadText | ✅ | ✅ | ✅ | ✅ |

### 配置项

| 配置项 | 类型 | 默认值 | 描述 |
|-------|------|-------|------|
| fileName | string | 必需 | 下载的文件名 |
| blob | Blob | 可选 | 要下载的 Blob 对象（用于 downloadFile） |
| text | string | 可选 | 要下载的文本内容（用于 downloadText） |
| mime | string | 'application/json' | MIME 类型（用于 downloadText） |

## 🚀 性能优化

1. **避免频繁下载**：不要在短时间内触发多次下载，可能会被浏览器阻止
2. **合理使用延迟**：批量下载时使用适当的延迟，避免浏览器阻塞
3. **优化 Blob 大小**：对于大文件，考虑分块处理
4. **避免内存泄漏**：下载完成后，URL 对象会自动清理，无需手动处理
5. **使用适当的 MIME 类型**：根据文件内容设置正确的 MIME 类型

## 🤝 最佳实践

1. **用户交互触发**：确保下载操作由用户交互触发，避免自动下载
2. **清晰的文件名**：使用描述性的文件名，便于用户识别
3. **适当的 MIME 类型**：根据文件内容设置正确的 MIME 类型
4. **错误处理**：对下载操作添加错误处理
5. **批量下载限制**：批量下载时注意浏览器限制，避免同时下载过多文件
6. **进度反馈**：对于大文件下载，考虑添加进度反馈

### 示例：带进度反馈的下载

```javascript
async function downloadWithProgress(url, fileName) {
  try {
    // 显示进度条
    const progressBar = document.createElement('div')
    progressBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: 4px;
      background: blue;
      z-index: 9999;
      transition: width 0.3s ease;
    `
    document.body.appendChild(progressBar)
    
    // fetch 文件并跟踪进度
    const response = await fetch(url, {
      headers: {
        'Accept': '*/*'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const contentLength = response.headers.get('content-length')
    const total = parseInt(contentLength, 10)
    let loaded = 0
    
    const reader = response.body.getReader()
    const chunks = []
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      
      // 更新进度
      if (total) {
        const progress = Math.round((loaded / total) * 100)
        progressBar.style.width = `${progress}%`
      }
    }
    
    // 合并 chunks 为 Blob
    const blob = new Blob(chunks)
    
    // 下载文件
    downloadFile({ fileName, blob })
    
    // 移除进度条
    setTimeout(() => {
      document.body.removeChild(progressBar)
    }, 1000)
    
    console.log('文件下载成功:', fileName)
  } catch (error) {
    console.error('下载失败:', error)
    // 移除进度条
    const progressBar = document.querySelector('div[style*="background: blue"]')
    if (progressBar) {
      document.body.removeChild(progressBar)
    }
  }
}

// 使用示例
function downloadLargeFile() {
  const fileUrl = 'https://example.com/large-file.zip'
  downloadWithProgress(fileUrl, 'large-file.zip')
}
```

## 🔍 调试技巧

### 1. 查看下载状态

```javascript
function debugDownload() {
  // 创建一个可下载的链接
  const content = '调试下载内容'
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  
  console.log('Blob URL:', url)
  console.log('Blob 大小:', blob.size, 'bytes')
  console.log('Blob 类型:', blob.type)
  
  // 手动创建下载链接
  const a = document.createElement('a')
  a.href = url
  a.download = 'debug-file.txt'
  console.log('下载链接:', a)
  
  // 触发下载
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  // 清理 URL
  setTimeout(() => {
    URL.revokeObjectURL(url)
    console.log('URL 已清理')
  }, 100)
}

// 运行示例
debugDownload()
```

### 2. 测试不同类型的文件

```javascript
function testFileTypes() {
  const testFiles = [
    {
      name: 'text-file.txt',
      content: '这是文本文件',
      type: 'text/plain'
    },
    {
      name: 'json-file.json',
      content: JSON.stringify({ test: 'data' }, null, 2),
      type: 'application/json'
    },
    {
      name: 'csv-file.csv',
      content: 'name,value\n张三,100\n李四,90',
      type: 'text/csv'
    },
    {
      name: 'html-file.html',
      content: '<html><body><h1>测试</h1></body></html>',
      type: 'text/html'
    }
  ]
  
  testFiles.forEach((file, index) => {
    setTimeout(() => {
      console.log(`下载 ${file.name} (${file.type})`)
      downloadText({ 
        fileName: file.name, 
        text: file.content, 
        mime: file.type 
      })
    }, index * 200)
  })
}

// 运行示例
testFileTypes()
```

## 📞 问题反馈

如果在使用过程中遇到问题，请：

1. 检查浏览器是否支持下载功能
2. 确保文件名和文件内容有效
3. 查看控制台是否有相关错误信息
4. 参考本文档的错误处理部分
5. 测试简单的下载示例，逐步定位问题

## 📋 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2025-01-01 | 初始版本 |
| v1.1.0 | 2025-03-15 | 优化 URL 清理逻辑 |
| v1.2.0 | 2025-06-20 | 增加 MIME 类型默认值 |

## 🎯 总结

`fileDownload` 是一个轻量级的文件下载工具，提供了简单易用的 API 来下载各种类型的文件。它具有以下特点：

- 简单易用的 API
- 支持 Blob 和文本文件
- 自动处理 URL 创建和清理
- 与其他工具集成良好
- 支持各种文件类型

使用 `fileDownload` 工具，可以方便地在应用中实现文件下载功能，提升用户体验。

---

**本文档由开发团队维护，如有更新请及时查阅。**

*最后更新时间：2026-02-16*
