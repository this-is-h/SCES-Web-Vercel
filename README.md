# SCES-Web-Vercel — 预览版门户

学生综合素质测评管理系统的 Web 预览端，基于 Vue 3、Vite 和 Pinia，提供学生申请、本地材料管理、班级/年级汇总及 Excel 导出。业务文件保存在用户授权的本地目录，不使用服务端数据库保存学生材料。

## 开发环境

- 使用 Node 22（至少 22.12）与 pnpm 10.9.0，与 CI 保持一致；`package.json` 的 engines 未声明 Node 24 支持。
- 本地目录读写依赖浏览器 `showDirectoryPicker`；开发前确认 File System Access API 可用，不能把普通页面可打开视为本地文件工作流兼容。
- Vue 单文件组件使用 Vue 官方编辑器扩展；类型检查由 `vue-tsc` 执行。

## 常用命令

```sh
pnpm install --frozen-lockfile
pnpm dev                 # Vite 开发服务，以终端输出地址为准
pnpm type-check          # Vue/TypeScript 类型检查
pnpm test:unit run       # 单次测试，与 CI 一致
pnpm lint                # 只检查，不自动修改源码
pnpm build               # 类型检查 + 生产构建
pnpm preview             # 本地预览构建产物
```

## Excel 导出

系统支持基于模板 `public/example.xlsx` 的双表导出能力，固定工作表为“总表”“基础分分表”，支持模板微调后的自动字段重建与变更日志记录。

### 命令脚本

```sh
npm run export:class
npm run export:grade
```

可选参数：

```sh
node ./src/utils/excel/runner.js class --students ./tmp/students.json --out ./tmp/class.xlsx
node ./src/utils/excel/runner.js grade --students ./tmp/students.json --out ./tmp/grade.xlsx
```

### 测试与覆盖率

`pnpm test:coverage` 可生成覆盖率报告，但本仓没有配置覆盖率阈值。现有回归位于 `tests/dyfFile.container.test.mjs` 和 `tests/studentStorage.test.mjs`，覆盖容器完整性、旧格式及附件字节往返；没有名为 `excelFlow.test.js` 的测试，Excel 模板变动仍需实际导出并核对工作表和公式。

## 架构与维护

- [架构说明](docs/architecture.md)：本地存储、`.dyf` 版本边界、附件和导出约束。
- [贡献指南](CONTRIBUTING.md)：分支、提交、测试及部署门禁。
- `public/configs/` 是预览端运行配置；与在线端契约的种子快照不是自动双向同步关系。
