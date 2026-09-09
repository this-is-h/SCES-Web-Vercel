# SCES-Web-Vercel — 预览版门户

学生综合素质测评管理系统（SCES）· 浏览器预览版（Vue 3 + Vite + Pinia + Nuxt UI + Element Plus + Vant + TailwindCSS + ExcelJS + Zod + Vitest），Vercel 托管。
实现学生端、班级端（三级）、年级端（一二级）预览与下载页。**预览版与其他端解耦**：不消费 `@sces/shared`、不承载版本元数据（版本真源在 SCES-Server）。

## 开发规范（必读，新会话遵守）

本仓库采用**简化版 Git Flow** 与 **Conventional Commits（约定式提交）**，由 husky 钩子与 CI 强制落地。详情见 `CONTRIBUTING.md`。

### 分支模型

- 长期分支：`main`（生产，Vercel 绑定 main 部署，禁直推）、`develop`（日常开发，默认分支，PR 指向这里）
- 短期分支：`feature/*`、`bugfix/*`、`hotfix/*`、`chore/*`、`release/*`（从 develop 创建，完成 PR 合并回 develop；hotfix 从 main 创建，合并回 main 与 develop）
- 分支名必须以前缀开头（CI 校验）；`main`/`develop` 开启保护（个人账号仓库暂无法强制，需自觉遵守）

### 提交规范（commit-msg 钩子强制）

格式：`<type>(<scope>): <subject>`

- `type` 必填：`feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `build` `ci` `revert`
- `scope` 可选、小写（本仓：src/views/components/utils/excel/configs/updates/docs/build/ci/deps）
- `subject` 必填：祈使句、首字母小写、**≤50 字符**、句尾无句号；header ≤72
- 违规提交会被 commitlint 直接拒绝（示例：`fix(configs): 调整 911 项步长为 0.5`）

### 钩子与 CI 门禁

- `pre-commit`：`lint-staged`（eslint --fix + prettier）+ `pnpm type-check`；`commit-msg`：commitlint
- CI：编译 + Lint + 测试（vitest，测试文件存在时触发）+ `pnpm audit`(high) + gitleaks + 分支名

## 目录结构

| 路径                   | 职责                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/`                 | 页面（student/class/grade）、组件、stores、excel 导出工具                                             |
| `public/download.html` | 安装包下载页（读 `https://sces.thisish.cn/updates/latest.json`，指向 SCES-Management GitHub Release） |
| `public/configs/`      | 预览端运行配置（学期、必填类别、步长等；改动走 PR）                                                   |
| `docs/`                | migration-primevue-nuxtui 等随仓文档                                                                  |

## 部署与跨仓约定

- **Vercel git 集成绑定本仓库 `main`**：合并 main 自动生产部署；PR 自动预览；
- 版本元数据 `latest.json` 由 SCES-Server 仓库维护（`updates/latest.json`），管理端 release CI 跨仓推送——**本仓库不托管版本元数据**；
- `public/configs/` 是预览端运行时配置（SCES-Server 契约种子推导源之一，改后需同步到 SCES-Server `contracts/seed-sources/` 并重新生成种子，见 SCES-Server CLAUDE）。

## 命令（仓库根）

```sh
pnpm install
pnpm dev                 # Vite 开发
pnpm build               # 类型检查 + 构建
pnpm test:unit           # vitest
pnpm lint                # ESLint
pnpm export:class|grade  # Excel 导出脚本
```
