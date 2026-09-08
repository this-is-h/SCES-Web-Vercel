# appToast 使用手册

## 📋 概述

`appToast` 是一个应用消息提示工具，基于传入的 toast 实例创建统一的消息提示方法，支持多种类型的消息提示。

### 核心功能
- 成功消息提示
- 错误消息提示
- 警告消息提示
- 信息消息提示
- 支持自定义配置

## 🚀 快速开始

### 安装

该工具是项目内置工具，无需单独安装，直接导入使用即可。

### 导入

```javascript
import { createAppToast } from '@/utils/appToast'
```

## 📖 API 文档

### 1. createAppToast(toast)

**描述**：创建消息提示实例

**参数**：
- `toast` (object) - 底层 toast 实例，需包含 `add` 方法

**返回值**：`object` - 消息提示实例，包含 success、error、warning、info 方法

**返回对象方法**：

#### 1.1 success(input)

**描述**：显示成功消息

**参数**：
- `input` (string|object) - 消息内容或配置对象
  - 字符串：直接作为消息内容
  - 对象：
    - `title` (string) - 消息标题
    - 其他配置项：根据底层 toast 实例支持的配置

**返回值**：无

#### 1.2 error(input)

**描述**：显示错误消息

**参数**：同 success 方法

**返回值**：无

#### 1.3 warning(input)

**描述**：显示警告消息

**参数**：同 success 方法

**返回值**：无

#### 1.4 info(input)

**描述**：显示信息消息

**参数**：同 success 方法

**返回值**：无

## 🎯 使用示例

### 基本用法

```javascript
import { createAppToast } from '@/utils/appToast'

// 假设已有 toast 实例
// 例如使用 Vant UI 的 Toast
// import { showToast } from 'vant'

// 或使用其他 UI 库的 toast
const toast = {
  add: (options) => {
    // 实现 toast 显示逻辑
    console.log('Toast:', options)
  }
}

// 创建 appToast 实例
const appToast = createAppToast(toast)

// 显示成功消息
appToast.success('操作成功')

// 显示错误消息
appToast.error('操作失败')

// 显示警告消息
appToast.warning('警告信息')

// 显示信息消息
appToast.info('提示信息')
```

### 自定义配置

```javascript
// 使用配置对象
appToast.success({
  title: '操作成功',
  duration: 3000, // 持续时间（毫秒）
  position: 'top', // 位置
  // 其他配置项根据底层 toast 实例而定
})

appToast.error({
  title: '操作失败',
  duration: 4000,
  position: 'bottom'
})
```

### 与 UI 库集成

#### 与 Vant UI 集成

```javascript
import { showToast } from 'vant'
import { createAppToast } from '@/utils/appToast'

// 创建适配 Vant 的 toast 实例
const vantToast = {
  add: (options) => {
    showToast({
      message: options.title,
      type: options.color === 'success' ? 'success' : 
             options.color === 'error' ? 'fail' : 
             options.color === 'warning' ? 'warning' : 'info',
      duration: options.duration || 2000,
      position: options.position || 'top'
    })
  }
}

const appToast = createAppToast(vantToast)

// 使用
appToast.success('操作成功')
appToast.error('操作失败')
```

#### 与 Element Plus 集成

```javascript
import { ElMessage } from 'element-plus'
import { createAppToast } from '@/utils/appToast'

// 创建适配 Element Plus 的 toast 实例
const elementToast = {
  add: (options) => {
    ElMessage({
      message: options.title,
      type: options.color === 'success' ? 'success' : 
             options.color === 'error' ? 'error' : 
             options.color === 'warning' ? 'warning' : 'info',
      duration: options.duration || 3000,
      showClose: options.showClose || false
    })
  }
}

const appToast = createAppToast(elementToast)

// 使用
appToast.success('操作成功')
appToast.error('操作失败')
```

## 🔧 高级用法

### 1. 统一消息配置

```javascript
// 创建统一配置的 toast 实例
const createConfiguredToast = (toast) => {
  const appToast = createAppToast(toast)
  
  // 包装方法，添加统一配置
  return {
    success: (message) => appToast.success({
      title: message,
      duration: 2000,
      position: 'top'
    }),
    error: (message) => appToast.error({
      title: message,
      duration: 3000,
      position: 'top'
    }),
    warning: (message) => appToast.warning({
      title: message,
      duration: 2500,
      position: 'top'
    }),
    info: (message) => appToast.info({
      title: message,
      duration: 2000,
      position: 'top'
    })
  }
}

// 使用
const configuredToast = createConfiguredToast(toast)
configuredToast.success('操作成功')
```

### 2. 消息队列管理

```javascript
// 简单的消息队列管理
class ToastQueue {
  constructor(toast) {
    this.appToast = createAppToast(toast)
    this.queue = []
    this.isProcessing = false
  }
  
  add(type, message, options = {}) {
    this.queue.push({ type, message, options })
    if (!this.isProcessing) {
      this.processQueue()
    }
  }
  
  async processQueue() {
    this.isProcessing = true
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()
      const { type, message, options } = item
      
      // 显示消息
      this.appToast[type]({
        title: message,
        ...options
      })
      
      // 等待消息显示完成
      await new Promise(resolve => {
        setTimeout(resolve, options.duration || 2000)
      })
    }
    
    this.isProcessing = false
  }
  
  success(message, options = {}) {
    this.add('success', message, options)
  }
  
  error(message, options = {}) {
    this.add('error', message, options)
  }
  
  warning(message, options = {}) {
    this.add('warning', message, options)
  }
  
  info(message, options = {}) {
    this.add('info', message, options)
  }
}

// 使用
const toastQueue = new ToastQueue(toast)
toastQueue.success('操作1成功')
toastQueue.success('操作2成功')
toastQueue.error('操作3失败')
```

### 3. 国际化支持

```javascript
// 国际化支持
const createI18nToast = (toast, i18n) => {
  const appToast = createAppToast(toast)
  
  return {
    success: (key, options = {}) => {
      const message = i18n.t(key)
      appToast.success({ title: message, ...options })
    },
    error: (key, options = {}) => {
      const message = i18n.t(key)
      appToast.error({ title: message, ...options })
    },
    warning: (key, options = {}) => {
      const message = i18n.t(key)
      appToast.warning({ title: message, ...options })
    },
    info: (key, options = {}) => {
      const message = i18n.t(key)
      appToast.info({ title: message, ...options })
    }
  }
}

// 使用
const i18nToast = createI18nToast(toast, i18n)
i18nToast.success('messages.success')
i18nToast.error('messages.error')
```

## 🚨 错误处理

### 常见错误及解决方案

| 错误类型 | 描述 | 解决方案 |
|---------|------|----------|
| toast 未定义 | 传入的 toast 参数为 undefined 或 null | 确保传入有效的 toast 实例 |
| toast.add 方法不存在 | 传入的 toast 实例没有 add 方法 | 确保 toast 实例包含 add 方法，或自行实现 |
| 消息不显示 | 消息配置错误或底层 toast 实例问题 | 检查底层 toast 实例是否正常工作 |

### 错误处理示例

```javascript
// 安全创建 appToast
function safeCreateAppToast(toast) {
  // 检查 toast 是否有效
  if (!toast || typeof toast.add !== 'function') {
    // 创建默认的控制台实现
    const defaultToast = {
      add: (options) => {
        console.log('Toast:', options.title || options)
      }
    }
    return createAppToast(defaultToast)
  }
  
  return createAppToast(toast)
}

// 使用
const appToast = safeCreateAppToast(toast)
appToast.success('操作成功')
```

## 📝 配置与依赖

### 依赖

无外部依赖，仅依赖传入的 toast 实例。

### 配置项

| 配置项 | 类型 | 默认值 | 描述 |
|-------|------|-------|------|
| toast | object | 必需 | 底层 toast 实例，需包含 add 方法 |

## 🚀 性能优化

1. **避免频繁调用**：不要在短时间内连续调用多个消息提示
2. **合理设置时长**：根据消息重要性设置合适的显示时长
3. **使用消息队列**：对于多个消息，使用队列管理，避免同时显示

## 🤝 最佳实践

1. **统一管理**：在应用入口处创建 appToast 实例，全局使用
2. **语义化使用**：根据消息类型选择合适的方法
3. **简洁明了**：消息内容要简洁明了，突出重点
4. **适度使用**：不要过度使用消息提示，避免干扰用户
5. **错误反馈**：对于用户操作的错误，提供明确的错误信息

### 示例：全局 toast 管理

```javascript
// utils/toast.js
import { createAppToast } from '@/utils/appToast'

// 假设使用 Vant UI
import { showToast } from 'vant'

const toast = {
  add: (options) => {
    showToast({
      message: options.title,
      type: options.color === 'success' ? 'success' : 
             options.color === 'error' ? 'fail' : 
             options.color === 'warning' ? 'warning' : 'info',
      duration: options.duration || 2000
    })
  }
}

const appToast = createAppToast(toast)

export default appToast

// 在其他文件中使用
import toast from '@/utils/toast'

toast.success('操作成功')
toast.error('操作失败')
```

## 🔍 调试技巧

### 查看消息配置

```javascript
// 调试模式下查看消息配置
const debugToast = {
  add: (options) => {
    console.log('Toast 配置:', options)
    // 实际显示消息
    // showToast(options)
  }
}

const appToast = createAppToast(debugToast)
appToast.success('测试消息')
```

### 模拟 toast 实例

```javascript
// 没有 UI 库时的模拟实现
const mockToast = {
  add: (options) => {
    const message = typeof options === 'string' ? options : options.title
    console.log(`[Toast] ${options.color || 'info'}: ${message}`)
    // 可以添加 DOM 元素模拟显示
    const toastElement = document.createElement('div')
    toastElement.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 4px;
      color: white;
      background: ${options.color === 'success' ? '#67C23A' : 
                  options.color === 'error' ? '#F56C6C' : 
                  options.color === 'warning' ? '#E6A23C' : '#409EFF'};
      z-index: 9999;
      font-size: 14px;
    `
    toastElement.textContent = message
    document.body.appendChild(toastElement)
    
    setTimeout(() => {
      toastElement.style.opacity = '0'
      toastElement.style.transition = 'opacity 0.3s'
      setTimeout(() => {
        document.body.removeChild(toastElement)
      }, 300)
    }, options.duration || 2000)
  }
}

const appToast = createAppToast(mockToast)
appToast.success('操作成功')
```

## 📞 问题反馈

如果在使用过程中遇到问题，请：

1. 检查传入的 toast 实例是否有效
2. 检查 toast 实例是否包含 add 方法
3. 查看控制台是否有相关错误信息
4. 参考本文档的错误处理部分

## 📋 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2025-01-01 | 初始版本 |
| v1.1.0 | 2025-03-15 | 优化参数处理 |
| v1.2.0 | 2025-06-20 | 增加类型支持 |

## 🎯 总结

`appToast` 是一个轻量级的消息提示工具，通过封装底层 toast 实例，提供了统一的消息提示接口。它支持：

- 多种类型的消息提示
- 灵活的配置选项
- 与各种 UI 库的集成
- 国际化支持

使用 `appToast` 可以为应用提供一致的消息提示体验，提升用户体验。

---

**本文档由开发团队维护，如有更新请及时查阅。**

*最后更新时间：2026-02-16*
