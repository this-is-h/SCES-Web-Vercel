# LocalConfig 工具使用文档

## 1. 工具简介

**LocalConfig** 是一个用于管理本地配置文件的工具，提供配置文件的读取、写入、迁移和管理功能。它支持不同作用域的配置管理，并确保配置文件格式的一致性。

**主要功能：**
- 配置文件迁移（处理旧格式配置文件）
- 读取本地配置
- 写入本地配置
- 确保配置文件存在
- 获取班级信息

## 2. 核心 API

### 2.1 配置迁移

```javascript
import { migrateLocalConfig } from '@/utils/localConfig'

const { config, migrated } = migrateLocalConfig(rawConfig)
```

**参数：**
- `raw` - 原始配置对象（可能是旧格式）

**返回值：**
- `config` - 迁移后的配置对象
- `migrated` - 布尔值，表示是否进行了迁移

**功能说明：**
- 将旧格式的配置文件迁移到新格式
- 添加 schemaVersion 字段
- 处理班级信息的结构变化
- 确保 encryption 字段存在

### 2.2 读取本地配置

```javascript
import { readLocalConfig } from '@/utils/localConfig'

const config = await readLocalConfig({ scope: 'class' })
```

**参数：**
- `scope` - 配置作用域，可选值：'class'（默认）或 'grade'

**返回值：**
- 配置对象，读取失败时返回 null

**功能说明：**
- 从指定作用域的配置文件中读取配置
- 使用 FileSystemManager 进行文件操作
- 自动处理 JSON 解析错误

### 2.3 写入本地配置

```javascript
import { writeLocalConfig } from '@/utils/localConfig'

await writeLocalConfig(config, { scope: 'class' })
```

**参数：**
- `config` - 要写入的配置对象
- `scope` - 配置作用域，可选值：'class'（默认）或 'grade'

**功能说明：**
- 将配置对象写入指定作用域的配置文件
- 使用 JSON.stringify 格式化配置内容，添加缩进以提高可读性

### 2.4 确保本地配置存在

```javascript
import { ensureLocalConfig } from '@/utils/localConfig'

const config = await ensureLocalConfig({ scope: 'class' })
```

**参数：**
- `scope` - 配置作用域，可选值：'class'（默认）或 'grade'

**返回值：**
- 确保存在的配置对象

**功能说明：**
- 检查指定作用域的配置文件是否存在
- 如果不存在，尝试从旧格式的 config.json 文件中读取
- 对读取的配置进行迁移
- 如果进行了迁移或需要写入作用域配置，将配置写回文件

### 2.5 获取班级信息

```javascript
import { getLocalClassInfo } from '@/utils/localConfig'

const classInfo = getLocalClassInfo(config)
```

**参数：**
- `config` - 配置对象

**返回值：**
- 班级信息对象，包含 grade、major 和 class 字段
- 如果班级信息不完整，返回 null

**功能说明：**
- 从配置对象中提取班级信息
- 确保返回的字段都是字符串类型
- 验证班级信息的完整性

## 3. 配置文件结构

### 3.1 新格式（Schema Version 1）

```json
{
  "schemaVersion": 1,
  "class": {
    "grade": "2023",
    "major": "计算机科学",
    "name": "1班"
  },
  "encryption": {
    "enabled": false
  },
  "otherSettings": {
    "key": "value"
  }
}
```

### 3.2 旧格式（自动迁移）

```json
{
  "grade": "2023",
  "major": "计算机科学",
  "class": "1班",
  "otherSettings": {
    "key": "value"
  }
}
```

## 4. 作用域管理

**LocalConfig** 支持两种作用域的配置管理：

| 作用域 | 配置文件路径 | 用途 |
|--------|-------------|------|
| class  | class/config.json | 班级级别的配置 |
| grade  | grade/config.json | 年级级别的配置 |

## 5. 使用示例

### 5.1 基本配置管理

```javascript
import { readLocalConfig, writeLocalConfig, ensureLocalConfig } from '@/utils/localConfig'

// 确保配置文件存在并获取配置
const config = await ensureLocalConfig({ scope: 'class' })

// 修改配置
config.class.name = '2班'
config.encryption.enabled = true

// 保存配置
await writeLocalConfig(config, { scope: 'class' })

// 读取配置
const updatedConfig = await readLocalConfig({ scope: 'class' })
console.log('Updated config:', updatedConfig)
```

### 5.2 年级级配置

```javascript
import { ensureLocalConfig, writeLocalConfig } from '@/utils/localConfig'

// 获取年级配置
const gradeConfig = await ensureLocalConfig({ scope: 'grade' })

// 修改年级配置
gradeConfig.schoolName = '示例大学'

// 保存年级配置
await writeLocalConfig(gradeConfig, { scope: 'grade' })
```

### 5.3 获取班级信息

```javascript
import { readLocalConfig, getLocalClassInfo } from '@/utils/localConfig'

// 读取配置
const config = await readLocalConfig({ scope: 'class' })

// 获取班级信息
const classInfo = getLocalClassInfo(config)
if (classInfo) {
  console.log(`班级信息: ${classInfo.grade}级 ${classInfo.major} ${classInfo.class}`)
} else {
  console.log('班级信息不完整')
}
```

## 6. 依赖关系

**LocalConfig** 依赖于以下工具：

- **FileSystemManager** - 用于文件系统操作

## 7. 错误处理

- 读取文件失败时，`readLocalConfig` 会返回 null 而不是抛出异常
- JSON 解析错误会被捕获并返回 null
- 写入文件操作可能会抛出异常，建议在调用时使用 try-catch 捕获

## 8. 最佳实践

1. **始终使用 ensureLocalConfig** - 在首次使用配置时，使用 `ensureLocalConfig` 确保配置文件存在并进行必要的迁移

2. **使用适当的作用域** - 根据配置的适用范围选择合适的作用域（class 或 grade）

3. **定期备份配置** - 配置文件包含重要信息，建议定期备份

4. **验证配置完整性** - 在使用配置前，验证关键字段是否存在

5. **合理处理错误** - 虽然 `readLocalConfig` 会捕获错误，但仍建议在调用 `writeLocalConfig` 时使用 try-catch 处理可能的异常

## 9. 配置迁移说明

**LocalConfig** 会自动处理以下迁移：

1. **添加 schemaVersion** - 确保配置文件有版本标识

2. **重构班级信息** - 将 grade、major、class 字段移动到 class 对象中

3. **添加 encryption 字段** - 确保加密配置字段存在

4. **向后兼容** - 支持从旧格式的 config.json 文件中读取配置

## 10. 性能考虑

- 文件操作是异步的，建议使用 async/await 处理
- 配置文件通常较小，读取和写入操作应该很快
- 对于频繁读取的配置，可以考虑在内存中缓存

## 11. 安全注意事项

- 配置文件可能包含敏感信息，确保文件系统访问权限正确设置
- 加密相关配置应妥善保管
- 避免在配置文件中存储明文密码或其他敏感凭据