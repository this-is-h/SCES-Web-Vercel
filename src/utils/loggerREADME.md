# Logger 工具使用文档

## 1. 工具简介

**Logger** 是一个轻量级的日志记录工具，提供了创建带有作用域的日志记录器的功能。它支持多个日志级别，并提供了友好的日志格式化功能。

**主要功能：**
- 创建带有作用域标识的日志记录器
- 支持 debug、info、warn、error 四个日志级别
- 自动添加时间戳
- 智能处理错误对象的序列化
- 仅在开发环境显示 debug 级别日志
- 安全的参数格式化，防止序列化错误

## 2. 核心 API

### 2.1 创建日志记录器

```javascript
import { createLogger } from '@/utils/logger'

const logger = createLogger('user-service')
```

**参数：**
- `scope` - 日志作用域标识，默认为 'app'

**返回值：**
- 日志记录器对象，包含 debug、info、warn、error 方法

**功能说明：**
- 创建一个带有指定作用域标识的日志记录器
- 作用域标识会作为前缀显示在每条日志中

### 2.2 日志级别方法

#### 2.2.1 debug 级别

```javascript
logger.debug('Debug message', { key: 'value' })
```

**参数：**
- 可变参数，支持任意数量和类型的参数

**功能说明：**
- 仅在开发环境中显示
- 用于详细的调试信息
- 自动添加时间戳和作用域前缀

#### 2.2.2 info 级别

```javascript
logger.info('Info message', { key: 'value' })
```

**参数：**
- 可变参数，支持任意数量和类型的参数

**功能说明：**
- 用于一般信息性消息
- 自动添加时间戳和作用域前缀
- 自动格式化非字符串参数

#### 2.2.3 warn 级别

```javascript
logger.warn('Warning message', { key: 'value' })
```

**参数：**
- 可变参数，支持任意数量和类型的参数

**功能说明：**
- 用于警告信息
- 自动添加时间戳和作用域前缀
- 自动格式化非字符串参数

#### 2.2.4 error 级别

```javascript
logger.error('Error message', errorObject)
```

**参数：**
- 可变参数，支持任意数量和类型的参数

**功能说明：**
- 用于错误信息
- 自动添加时间戳和作用域前缀
- 自动格式化非字符串参数
- 特别处理 Error 对象，显示错误名称、消息和堆栈

## 3. 使用示例

### 3.1 基本使用

```javascript
import { createLogger } from '@/utils/logger'

// 创建默认作用域的日志记录器
const logger = createLogger()

// 不同级别的日志
logger.debug('调试信息', { data: { id: 1, name: '测试' } })
logger.info('一般信息', '操作成功')
logger.warn('警告信息', '参数不合法')
logger.error('错误信息', new Error('操作失败'))
```

### 3.2 带作用域的使用

```javascript
import { createLogger } from '@/utils/logger'

// 创建带作用域的日志记录器
const userLogger = createLogger('user-service')
const apiLogger = createLogger('api-client')

// 使用带作用域的日志记录器
userLogger.info('用户登录', { userId: 123 })
apiLogger.error('API 请求失败', { url: '/api/data', status: 500 })
```

### 3.3 处理错误对象

```javascript
import { createLogger } from '@/utils/logger'

const logger = createLogger('error-handler')

try {
  // 可能抛出错误的操作
  throw new Error('测试错误')
} catch (error) {
  // 记录错误信息
  logger.error('捕获到错误', error)
}
```

### 3.4 复杂对象序列化

```javascript
import { createLogger } from '@/utils/logger'

const logger = createLogger('data-processor')

// 复杂对象
const complexData = {
  id: 1,
  name: '测试',
  nested: {
    level1: {
      level2: '深层数据'
    }
  },
  array: [1, 2, 3],
  date: new Date()
}

// 记录复杂对象
logger.info('处理数据', complexData)
```

## 4. 日志格式

**Logger** 生成的日志格式如下：

```
[scope] 2023-10-01T12:00:00.000Z message {"key":"value"}
```

**错误对象的日志格式：**

```
[scope] 2023-10-01T12:00:00.000Z Error: 错误消息
Error: 错误消息
    at file.js:1:1
    at ...
```

## 5. 环境检测

**Logger** 会自动检测运行环境：

- 在开发环境（`import.meta.env.DEV` 为 true）中，会显示所有级别的日志，包括 debug
- 在生产环境中，会忽略 debug 级别的日志

## 6. 错误处理

**Logger** 具有以下错误处理机制：

- 尝试使用 JSON.stringify 序列化非字符串参数
- 如果序列化失败，会使用 String() 方法转换
- 特别处理 Error 对象，显示其名称、消息和堆栈
- 捕获并处理可能的序列化错误，确保日志记录不会因参数问题而失败

## 7. 最佳实践

1. **为不同模块创建不同的日志记录器** - 使用作用域区分不同模块的日志

2. **使用适当的日志级别** - 根据消息的重要性选择合适的级别：
   - debug：详细的调试信息，仅在开发环境显示
   - info：一般信息性消息
   - warn：警告信息，需要关注但不影响正常运行
   - error：错误信息，影响正常运行的问题

3. **提供足够的上下文信息** - 在日志中包含相关的上下文数据，便于排查问题

4. **避免过度使用 debug 日志** - 在生产环境中 debug 日志会被忽略，但过多的 debug 调用仍会影响性能

5. **合理处理敏感信息** - 避免在日志中记录密码、令牌等敏感信息

6. **结构化日志数据** - 对于复杂数据，使用对象形式传递，便于后续分析

## 8. 性能考虑

- **轻量级设计** - Logger 是一个轻量级工具，不会显著影响应用性能

- **条件执行** - debug 日志仅在开发环境中执行，减少生产环境的开销

- **延迟序列化** - 仅在需要时才对参数进行序列化

- **错误处理** - 序列化错误会被捕获，确保日志记录不会因参数问题而失败

- **建议** - 对于高频操作，避免在循环中使用大量复杂对象作为日志参数

## 9. 与其他工具的集成

**Logger** 可以与其他工具集成：

### 9.1 与错误报告工具集成

```javascript
import { createLogger } from '@/utils/logger'
import { reportError } from '@/utils/reportError'

const logger = createLogger('error-service')

export const handleError = (error) => {
  logger.error('处理错误', error)
  reportError(error)
}
```

### 9.2 与监控工具集成

```javascript
import { createLogger } from '@/utils/logger'

const logger = createLogger('monitoring')

export const trackPerformance = (name, fn) => {
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  logger.info(`${name} 执行时间`, { duration: end - start })
  return result
}
```

## 10. 浏览器兼容性

**Logger** 依赖于以下浏览器特性：

- `console` 对象及其方法（debug、info、warn、error）
- `JSON.stringify` 方法
- `Date.toISOString` 方法

这些特性在所有现代浏览器中都可用，对于旧浏览器，会降级处理。

## 11. 测试建议

在测试中使用 **Logger** 时，建议：

1. **模拟 console 方法** - 在单元测试中，可以模拟 console 方法来验证日志输出

2. **测试不同级别的日志** - 确保不同级别的日志都能正确输出

3. **测试错误对象处理** - 确保 Error 对象能被正确格式化

4. **测试复杂对象序列化** - 确保复杂对象能被正确序列化

## 12. 代码优化建议

- **使用模块级别的日志记录器** - 在模块顶部创建日志记录器，避免重复创建

- **统一日志格式** - 在整个应用中使用一致的日志格式和级别

- **日志级别管理** - 考虑添加配置选项，允许在运行时调整日志级别

- **日志聚合** - 对于大型应用，考虑添加日志聚合功能，将日志发送到中央服务器