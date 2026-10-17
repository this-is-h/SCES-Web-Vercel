# 贡献指南（SCES-Web-Vercel · 预览版门户）

本仓库采用**简化版 Git Flow** 与 **Conventional Commits（约定式提交）**，由钩子与 CI 强制落地。

## 分支模型

| 分支                                 | 生命周期 | 用途                                                                                              |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `main`                               | 永久     | 生产分支，绑定 Vercel 生产部署（git 集成）；**禁止直接提交/推送**，只接受 develop→main 的发布合并 |
| `develop`                            | 永久     | 日常开发主分支（默认分支），所有 PR 指向这里                                                      |
| `feature/*` / `bugfix/*` / `chore/*` | 短期     | 功能 / 缺陷 / 杂务，从 develop 创建，完成后 PR 合并回 develop                                     |
| `hotfix/*`                           | 短期     | 紧急修复，从 main 创建，完成后合并回 main 与 develop                                              |

规则：CI 校验 PR 源分支和 push 当前分支；仓库管理员须为 `develop`/`main` 配置保护（强制 PR + 必需状态检查；`main` 禁止直推），workflow 不会自动开启远端保护。

## 提交规范（commit-msg 钩子强制）

格式：`<type>(<scope>): <subject>`

- `type` 必填：`feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `build` `ci` `revert`
- `scope` 可选，小写：本仓常用 `src` `views` `components` `utils` `excel` `configs` `updates` `docs` `build` `ci` `deps`
- `subject` 必填：祈使句、首字母小写、≤50 字符、句尾无句号；header ≤72

示例：`fix(configs): 调整 911 项步长为 0.5`、`feat(views): 添加年级总览移动端适配`

配套纪律：每提交单一问题；单次 ≤300 行；提交前 `pnpm type-check` + 相关测试自测。

## 钩子与 CI 门禁

- `pre-commit`：`lint-staged`（eslint --fix + prettier --write 暂存文件）+ `pnpm type-check`；`commit-msg`：commitlint。
- CI：`pnpm build`（含类型检查）+ `pnpm lint` + `pnpm test:unit run` + `pnpm audit --prod --audit-level high` + gitleaks + 分支名校验。
- `pnpm lint` 只读检查源码；自动修复仅由显式命令或暂存文件钩子执行。CI 测试必须实际运行，不因没有测试文件而跳过。
- 现有回归覆盖 `.dyf` 容器与附件存储。`pnpm test:coverage` 生成报告，但 `vitest.config.ts` 未配置覆盖率阈值；不宣称全仓或 Excel 公式已有 ≥80% 门禁。

## 部署

- **Vercel git 集成绑定本仓库 `main`**：合并到 main 自动生产部署；PR 自动预览部署；
- 桌面端更新清单由 `SCES-Server-Vercel/public/updates/latest.json` 托管；桌面发布 CI 向服务端 `develop` 创建 PR，不再向本仓 main 推送清单。
- 正式安装包位于公开仓库 [SCES-Management-Desktop-Releases](https://github.com/this-is-h/SCES-Management-Desktop-Releases/releases)。本仓 `public/download.html` 仍按旧源码仓路径拼接下载链接，尚未适配当前发布链路，不能作为正式下载入口。

## 维护约定

- `public/configs/` 为预览端运行配置（学期、必填类别、步长等），改动走 PR 并按提交规范留言；
