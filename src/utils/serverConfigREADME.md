# ServerConfig 工具使用文档

## 1. 工具简介

**ServerConfig** 是一个服务器配置管理工具，用于获取和管理应用的服务器配置。它支持从远程 config.js 文件获取配置，并在获取失败时使用本地回退配置。同时，它还提供了配置缓存机制，提高性能。

**主要功能：**
- 从远程服务器获取配置文件
- 本地回退配置支持
- 配置缓存机制
- 强制刷新配置
- 加密配置管理
- 配置合并与默认值处理

## 2. 核心 API

### 2.1 获取服务器配置

```javascript
import { getServerConfig } from '@/utils/serverConfig'

const config = await getServerConfig()
```

**参数：**
- `force` - 布尔值，默认为 false。设置为 true 时，会强制刷新配置，忽略缓存

**返回值：**
- Promise，解析为配置对象

**功能说明：**
- 从远程 config.js 文件获取配置
- 如果配置已缓存且未强制刷新，直接返回缓存的配置
- 如果正在获取配置（有未完成的请求），返回该请求的 Promise
- 如果获取失败，使用本地回退配置
- 合并配置与默认值

### 2.2 获取回退配置

```javascript
import { getServerConfigFallback } from '@/utils/serverConfig'

const config = getServerConfigFallback()
```

**参数：**
- 无

**返回值：**
- 配置对象

**功能说明：**
- 立即返回当前缓存的配置或默认配置
- 不进行网络请求
- 用于需要同步获取配置的场景

## 3. 内部功能

### 3.1 配置构建

**ServerConfig** 内部使用 `buildDefault` 函数构建默认配置：

1. 基于本地回退配置 `fallbackConfig`
2. 为加密配置设置默认值：
   - `enabled: false`
   - `rsaPublicKeyJwk: null`
   - `rsaAlgorithm: { name: 'RSA-OAEP', hash: 'SHA-256' }`
   - `aesAlgorithm: { name: 'AES-GCM', length: 256 }`
3. 如果本地回退配置中包含加密算法配置，则使用本地配置

### 3.2 配置 URL 生成

**ServerConfig** 内部使用 `getConfigUrl` 函数生成配置文件的 URL：

1. 使用 `import.meta.env.BASE_URL` 作为基础路径，如果不存在则使用 '/' 作为默认值
2. 确保基础路径以 '/' 结尾
3. 拼接 'config.js' 路径
4. 使用当前页面的 origin 作为根 URL

### 3.3 配置缓存

**ServerConfig** 使用以下缓存机制：

- `cached` - 存储已获取的配置
- `cachedPromise` - 存储正在进行的配置获取请求

这确保了：
1. 多次调用 `getServerConfig` 时，不会发起重复的网络请求
2. 配置获取失败后，会使用本地回退配置
3. 可以通过 `force` 参数强制刷新配置

## 4. 使用示例

### 4.1 基本使用

```javascript
import { getServerConfig } from '@/utils/serverConfig'

// 获取配置
const config = await getServerConfig()
console.log('服务器配置:', config)
```

### 4.2 强制刷新配置

```javascript
import { getServerConfig } from '@/utils/serverConfig'

// 强制刷新配置
const freshConfig = await getServerConfig({ force: true })
console.log('刷新后的配置:', freshConfig)
```

### 4.3 同步获取配置

```javascript
import { getServerConfigFallback } from '@/utils/serverConfig'

// 同步获取配置（使用缓存或默认值）
const config = getServerConfigFallback()
console.log('当前配置:', config)
```

### 4.4 在应用初始化时获取配置

```javascript
import { getServerConfig } from '@/utils/serverConfig'

// 应用初始化
const initApp = async () => {
  try {
    // 获取配置
    const config = await getServerConfig()
    
    // 使用配置初始化应用
    console.log('应用初始化，使用配置:', config)
    
    // 初始化其他服务
    initServices(config)
  } catch (error) {
    console.error('应用初始化失败:', error)
  }
}

initApp()
```

### 4.5 监听配置变化

```javascript
import { getServerConfig } from '@/utils/serverConfig'

// 定期检查配置更新
const checkConfigUpdate = async () => {
  try {
    const config = await getServerConfig({ force: true })
    console.log('配置已更新:', config)
  } catch (error) {
    console.error('检查配置更新失败:', error)
  }
}

// 每5分钟检查一次配置更新
setInterval(checkConfigUpdate, 5 * 60 * 1000)
```

## 5. 配置结构

**ServerConfig** 生成的配置结构如下：

```javascript
{
  // 应用配置...
  encryption: {
    enabled: false,              // 是否启用加密
    rsaPublicKeyJwk: null,       // RSA 公钥（JWK 格式）
    rsaAlgorithm: {              // RSA 算法配置
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    aesAlgorithm: {              // AES 算法配置
      name: 'AES-GCM',
      length: 256
    }
    // 其他加密配置...
  }
  // 其他配置...
}
```

## 6. 最佳实践

1. **在应用启动时获取配置** - 在应用初始化阶段获取配置，确保后续操作使用最新的配置

2. **合理使用缓存** - 默认情况下使用缓存的配置，避免频繁的网络请求

3. **适时强制刷新** - 在需要确保使用最新配置的场景下，使用 `force: true` 强制刷新

4. **使用回退配置** - 在需要同步获取配置的场景下，使用 `getServerConfigFallback`

5. **错误处理** - 虽然 `getServerConfig` 会捕获错误并使用回退配置，但仍建议在调用时使用 try-catch 处理可能的异常

6. **配置验证** - 在使用配置前，验证关键配置项是否存在和有效

7. **合理设置配置更新频率** - 不要过于频繁地强制刷新配置，以免增加服务器负担

## 7. 性能考虑

- **缓存机制** - 通过缓存减少网络请求，提高性能

- **并发请求处理** - 多个同时调用会共享同一个网络请求，避免重复请求

- **异步获取** - 配置获取是异步的，不会阻塞主线程

- **回退机制** - 网络请求失败时，快速切换到本地回退配置

- **建议** - 对于频繁使用的配置项，可以在获取配置后将其提取到局部变量中，减少对象访问开销

## 8. 与其他工具的集成

### 8.1 与加密工具集成

```javascript
import { getServerConfig } from '@/utils/serverConfig'
import { encrypt, decrypt } from '@/utils/crypto'

const secureData = async (data) => {
  const config = await getServerConfig()
  
  if (config.encryption.enabled && config.encryption.rsaPublicKeyJwk) {
    return encrypt(data, config.encryption)
  }
  
  return data
}
```

### 8.2 与日志工具集成

```javascript
import { getServerConfig } from '@/utils/serverConfig'
import { createLogger } from '@/utils/logger'

const initLogger = async () => {
  const config = await getServerConfig()
  const logger = createLogger('app')
  
  logger.info('应用启动，使用配置:', {
    environment: config.environment,
    version: config.version
  })
  
  return logger
}
```

### 8.3 与本地配置工具集成

```javascript
import { getServerConfig } from '@/utils/serverConfig'
import { ensureLocalConfig, writeLocalConfig } from '@/utils/localConfig'

const syncConfig = async () => {
  try {
    // 获取服务器配置
    const serverConfig = await getServerConfig()
    
    // 获取本地配置
    const localConfig = await ensureLocalConfig()
    
    // 同步服务器配置到本地
    if (serverConfig.defaults) {
      localConfig.defaults = { ...localConfig.defaults, ...serverConfig.defaults }
      await writeLocalConfig(localConfig)
    }
    
    return { serverConfig, localConfig }
  } catch (error) {
    console.error('同步配置失败:', error)
    throw error
  }
}
```

## 9. 浏览器兼容性

**ServerConfig** 依赖于以下浏览器特性：

- `fetch` - 用于获取远程配置文件
- `URL` - 用于构建配置文件的 URL
- `import.meta.env` - 用于获取 BASE_URL（可选）
- `Promise` - 用于异步操作

这些特性在所有现代浏览器中都可用，对于旧浏览器，可能需要添加相应的 polyfill。

## 10. 测试建议

在测试中使用 **ServerConfig** 时，建议：

1. **模拟 fetch** - 在单元测试中，模拟 fetch 函数以返回测试配置

2. **测试缓存行为** - 验证缓存机制是否正常工作

3. **测试错误处理** - 验证网络请求失败时是否正确使用回退配置

4. **测试强制刷新** - 验证 `force: true` 时是否正确刷新配置

5. **测试配置合并** - 验证配置合并和默认值处理是否正确

## 11. 代码优化建议

- **配置验证** - 添加配置验证逻辑，确保获取的配置符合预期结构

- **配置版本控制** - 考虑在配置中添加版本号，以便于处理配置结构变更

- **配置监控** - 添加配置变更监控，当配置发生变化时通知相关组件

- **错误重试** - 考虑添加网络请求失败时的重试机制

- **配置缓存过期** - 考虑添加配置缓存过期机制，自动刷新过期的配置

- **配置热更新** - 实现配置热更新机制，在配置变更时无需重启应用

## 12. 配置文件管理

### 12.1 远程配置文件

远程配置文件 `config.json` 应该包含应用运行所需的配置项，例如：

```json
{
  "environment": "production",
  "version": "1.0.0",
  "apiBaseUrl": "https://api.example.com",
  "encryption": {
    "enabled": true,
    "rsaPublicKeyJwk": {
      "kty": "RSA",
      "e": "AQAB",
      "n": "..."
    }
  },
  "defaults": {
    "pageSize": 20,
    "theme": "light"
  }
}
```

### 12.2 本地回退配置

本地回退配置 `@/config/config.json` 应该包含基本的默认配置，以便在网络请求失败时使用：

```json
{
  "environment": "development",
  "version": "1.0.0-dev",
  "apiBaseUrl": "http://localhost:3000",
  "encryption": {
    "enabled": false
  },
  "defaults": {
    "pageSize": 10,
    "theme": "light"
  }
}
```
