# web — 预览版（参考实现）

## 项目概述

浏览器预览版（Vue 3），实现学生端、班级端（管理端三级）、年级端（管理端一二级）。**参考实现，不直接照搬**——正式版为 `user/wechat`（学生端）+ `management/desktop`（管理端）。预览版已验证的技术（混合加密、学号冲突锁定、Excel 导出、配置驱动表单）将迁移到正式版。

## 技术栈

Vue 3 + Vite + Pinia + Nuxt UI + Element Plus + Vant + TailwindCSS + ExcelJS + Zod + Vitest

## 目录结构

```
src/
├── views/            # 页面级组件
│   ├── student/      # 学生端（StudentView / StudentMobileView）
│   ├── class/        # 班级端（三级）：ClassOverview / ClassStudent / ClassSettings
│   └── grade/        # 年级端（一二级）：GradeOverview / GradeStudent / GradeSettings
├── components/       # 通用组件（student/StudentTable 等）
├── stores/           # Pinia stores（studentData / currentStudent / selection / delete）
├── utils/            # 业务工具（见下）
└── router/           # 路由（含移动端/PC 分流）
public/configs/       # 运行时配置（config.js 服务端配置、student.js 德育分模板）
```

## 核心模块（src/utils/）

| 文件 | 职责 |
|------|------|
| `crypto.js` | RSA-OAEP-256 + AES-GCM-256 混合加密、密钥对生成 |
| `dyfFile.js` | `.dyf` 申请文件生成/解析（加密 + 哈希） |
| `studentStorage.js` | 学生数据本地存储（File System Access API）、数据规范化 |
| `totalScore.js` | 德育分总分计算（惩罚分类目为负） |
| `config.js` | 配置加载（服务端配置 + 学生模板，带缓存与迁移） |
| `importStudentsFromFiles.js` | 批量导入 |
| `excel/` | Excel 导出（exceljs，模板驱动） |
| `FileSystemManager.js` | File System Access API 封装 |

## 数据流

- **学生端**：填写表单 → 导出加密 `.dyf` 文件。
- **班级端/年级端**：导入 `.dyf` → 本地文件系统存储 → 审核修改 → 导出。
- **存储**：File System Access API，`class|grade/semesters/<学期>/students/<姓名_学号>/info.json + evidence/`。
- **学号冲突**：`__学号冲突锁定` 字段 + 冲突处理弹窗（只能设置一次）。

## 开发命令

```sh
pnpm install
pnpm dev          # 开发
pnpm build        # 构建
pnpm test:unit    # Vitest 单元测试
pnpm lint         # ESLint
```

## 已知问题（正式版需解决）

- `StudentTable.vue` 的"虚拟滚动"是**增量渲染**（slice 前 N 行），非真窗口化虚拟滚动。
- 学生数据全量加载进内存（`studentDataStore` bucket）。
- 配置硬编码在 `public/configs/`，未从服务端拉取。
- 学生端导出依赖浏览器 File System Access API，兼容性受限。

## 与正式版的关系

- **迁移**：混合加密、学号冲突锁定、Excel 导出、配置驱动表单。
- **⚠️ 种子数据上游（勿随意删改）**：`web/public/configs/student.js`（106 项德育明细 + scoreType）与 `config.js`（required/penalty/negative 标记）是 `server/contracts` 励行书院种子的**权威数据源**——由 `server/contracts/scripts/lib/derive-lixing.mjs` 读取并推导。改这两个文件会改变契约种子（`verify:seeds` 逐字节比对会检出）；删除 web/ 会打断种子重建链。"参考实现不照搬"指的是**代码**，不含这两个配置数据源。
- **不迁移**：File System Access API 存储（正式版用 SQLite）、增量式虚拟滚动（正式版用真窗口化）、硬编码配置（正式版从服务端拉取）。