# ReportError 工具使用文档

## 1. 工具简介

**ReportError** 是一个错误报告工具，用于标准化错误处理、记录错误日志并通过自定义事件分发错误信息。它支持多种错误类型的标准化处理，并能识别代码块加载错误。

**主要功能：**
- 错误标准化：将各种类型的错误转换为标准 Error 对象
- 错误日志记录：使用 Logger 工具记录错误信息
- 错误事件分发：通过自定义事件将错误信息分发给应用的其他部分
- 代码块加载错误检测：识别并标记代码块加载错误
- 错误上下文管理：支持添加错误相关的上下文信息

## 2. 核心 API

### 2.1 报告错误

```javascript
import { reportError } from '@/utils/reportError'

reportError(error, { operation: '用户登录' })
```

**参数：**
- `err` - 错误对象、字符串或其他类型的错误信息
- `context` - 可选的上下文信息，用于提供错误发生时的相关信息

**返回值：**
- 标准化后的 Error 对象

**功能说明：**
- 将错误标准化为标准 Error 对象
- 使用 Logger 记录错误信息，包括消息、堆栈和上下文
- 通过自定义事件 'app:error' 分发错误信息
- 检测是否为代码块加载错误
- 返回标准化后的错误对象

## 3. 内部功能

### 3.1 错误标准化

**ReportError** 内部使用 `normalizeError` 函数将各种类型的错误转换为标准 Error 对象：

1. 如果已经是 Error 对象，直接返回
2. 如果是字符串，创建一个新的 Error 对象
3. 如果是其他类型，尝试通过 JSON.stringify 转换为字符串，然后创建 Error 对象
4. 如果 JSON.stringify 失败，使用 String() 转换后创建 Error 对象

### 3.2 代码块加载错误检测

**ReportError** 内部使用 `isChunkLoadError` 函数检测是否为代码块加载错误：

- 检测错误消息中是否包含以下关键词：
  - 'Loading chunk'
  - 'Failed to fetch dynamically imported module'
  - 'Importing a module script failed'
  - 'ChunkLoadError'

### 3.3 错误事件分发

**ReportError** 通过以下方式分发错误事件：

```javascript
window.dispatchEvent(
  new CustomEvent('app:error', {
    detail: {
      message: e.message,
      stack: e.stack,
      context,
      chunkLoad: isChunkLoadError(e),
      at: Date.now(),
    },
  }),
)
```

## 4. 使用示例

### 4.1 基本使用

```javascript
import { reportError } from '@/utils/reportError'

try {
  // 可能抛出错误的操作
  throw new Error('操作失败')
} catch (error) {
  // 报告错误
  reportError(error)
}
```

### 4.2 带上下文信息的使用

```javascript
import { reportError } from '@/utils/reportError'

const handleUserLogin = async (username, password) => {
  try {
    // 登录操作
    const response = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    
    if (!response.ok) {
      throw new Error('登录失败')
    }
  } catch (error) {
    // 带上下文信息报告错误
    reportError(error, {
      operation: '用户登录',
      username,
      timestamp: new Date().toISOString()
    })
    throw error
  }
}
```

### 4.3 处理不同类型的错误

```javascript
import { reportError } from '@/utils/reportError'

// 处理字符串错误
reportError('参数错误')

// 处理对象错误
reportError({ code: 404, message: '资源不存在' })

// 处理标准错误对象
reportError(new Error('网络请求失败'))

// 处理 undefined 或 null
reportError(undefined)
reportError(null)
```

### 4.4 监听错误事件

```javascript
// 在应用的某个地方监听错误事件
window.addEventListener('app:error', (event) => {
  const { message, stack, context, chunkLoad, at } = event.detail
  
  console.log('捕获到应用错误:', {
    message,
    stack,
    context,
    chunkLoad,
    timestamp: new Date(at).toISOString()
  })
  
  // 可以在这里执行额外的错误处理逻辑，如：
  // 1. 显示错误提示给用户
  // 2. 发送错误到远程监控服务
  // 3. 对于代码块加载错误，尝试刷新页面
  if (chunkLoad) {
    console.log('检测到代码块加载错误，建议刷新页面')
  }
})
```

### 4.5 与其他工具集成

```javascript
import { reportError } from '@/utils/reportError'
import { createLogger } from '@/utils/logger'

const logger = createLogger('api-service')

export const fetchData = async (url) => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    logger.error('API 请求失败', { url })
    reportError(error, { url, operation: 'fetchData' })
    throw error
  }
}
```

## 5. 错误事件结构

当 **ReportError** 分发错误事件时，事件的 detail 属性包含以下信息：

| 字段 | 类型 | 描述 |
|------|------|------|
| message | string | 错误消息 |
| stack | string | 错误堆栈信息 |
| context | object | 错误上下文信息 |
| chunkLoad | boolean | 是否为代码块加载错误 |
| at | number | 错误发生的时间戳（毫秒） |

## 6. 错误类型支持

**ReportError** 支持处理以下类型的错误：

1. **标准 Error 对象** - 直接使用
2. **字符串** - 转换为新的 Error 对象
3. **对象** - 尝试通过 JSON.stringify 转换为字符串
4. **其他类型** - 使用 String() 转换为字符串
5. **undefined 或 null** - 转换为对应的字符串表示

## 7. 最佳实践

1. **始终使用 try-catch** - 在可能抛出错误的操作周围使用 try-catch，并在 catch 块中报告错误

2. **提供详细的上下文信息** - 在报告错误时，提供尽可能详细的上下文信息，以便于排查问题

3. **监听错误事件** - 在应用的适当位置监听 'app:error' 事件，执行全局错误处理逻辑

4. **处理代码块加载错误** - 特别处理 chunkLoad 错误，例如提示用户刷新页面

5. **不要在错误处理中抛出新错误** - 确保错误处理逻辑本身不会抛出新错误

6. **合理使用错误报告** - 不要过度报告错误，只报告对排查问题有帮助的错误

7. **与日志工具配合使用** - 在报告错误前，使用 Logger 记录相关操作的日志

## 8. 性能考虑

- **轻量级设计** - ReportError 是一个轻量级工具，不会显著影响应用性能

- **错误标准化** - 错误标准化操作是同步的，但通常很快完成

- **事件分发** - 事件分发是异步的，不会阻塞主线程

- **错误处理** - 内部捕获可能的错误，确保错误报告过程本身不会失败

- **建议** - 对于高频操作，避免在循环中重复报告相同的错误

## 9. 与其他工具的集成

### 9.1 与 Logger 工具集成

```javascript
import { reportError } from '@/utils/reportError'
import { createLogger } from '@/utils/logger'

const logger = createLogger('service')

export const serviceMethod = async () => {
  try {
    // 业务逻辑
  } catch (error) {
    logger.error('服务方法执行失败')
    reportError(error, { method: 'serviceMethod' })
    throw error
  }
}
```

### 9.2 与全局错误处理器集成

```javascript
import { reportError } from '@/utils/reportError'

// 全局未捕获错误处理
window.addEventListener('error', (event) => {
  reportError(event.error, { type: '未捕获错误' })
})

// 全局未处理的 Promise 拒绝处理
window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason, { type: '未处理的 Promise 拒绝' })
})
```

### 9.3 与 UI 错误提示集成

```javascript
import { reportError } from '@/utils/reportError'
import { showToast } from '@/utils/appToast'

// 监听错误事件并显示提示
window.addEventListener('app:error', (event) => {
  const { message, chunkLoad } = event.detail
  
  if (chunkLoad) {
    showToast('应用资源加载失败，请刷新页面', 'error')
  } else {
    showToast(`操作失败: ${message}`, 'error')
  }
})
```

## 10. 浏览器兼容性

**ReportError** 依赖于以下浏览器特性：

- `window.dispatchEvent` - 用于分发错误事件
- `CustomEvent` - 用于创建自定义错误事件
- `Date.now()` - 用于获取错误发生的时间戳

这些特性在所有现代浏览器中都可用，对于旧浏览器，事件分发可能会失败，但会被内部捕获，不会影响错误报告的其他功能。

## 11. 测试建议

在测试中使用 **ReportError** 时，建议：

1. **模拟 window 对象** - 在单元测试中，模拟 window 对象以捕获错误事件

2. **测试不同类型的错误** - 确保各种类型的错误都能被正确标准化和报告

3. **测试上下文信息** - 验证上下文信息是否正确传递

4. **测试代码块加载错误检测** - 确保代码块加载错误能被正确识别

5. **测试事件分发** - 验证错误事件是否正确分发，以及事件数据是否完整

## 12. 代码优化建议

- **集中错误处理** - 创建统一的错误处理函数，避免在代码中重复错误处理逻辑

- **错误分类** - 根据错误类型添加分类信息，便于后续分析

- **错误统计** - 考虑添加错误统计功能，用于监控应用的错误率

- **远程错误监控** - 集成远程错误监控服务，以便于在生产环境中收集错误信息

- **错误恢复策略** - 为常见错误添加自动恢复策略，提高应用的稳定性