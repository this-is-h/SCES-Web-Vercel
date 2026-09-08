# 贡献指南（SCES-Web-Vercel · 预览版门户）

本仓库采用**简化版 Git Flow** 与 **Conventional Commits（约定式提交）**，由钩子与 CI 强制落地。

## 分支模型

| 分支                                 | 生命周期 | 用途                                                                                              |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `main`                               | 永久     | 生产分支，绑定 Vercel 生产部署（git 集成）；**禁止直接提交/推送**，只接受 develop→main 的发布合并 |
| `develop`                            | 永久     | 日常开发主分支（默认分支），所有 PR 指向这里                                                      |
| `feature/*` / `bugfix/*` / `chore/*` | 短期     | 功能 / 缺陷 / 杂务，从 develop 创建，完成后 PR 合并回 develop                                     |
| `hotfix/*`                           | 短期     | 紧急修复，从 main 创建，完成后合并回 main 与 develop                                              |

规则：分支名必须符合前缀（CI 拒绝违规分支）；`develop`/`main` 开启保护（强制 PR + 状态检查；`main` 禁止直推）。

## 提交规范（commit-msg 钩子强制）

格式：`<type>(<scope>): <subject>`

- `type` 必填：`feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `build` `ci` `revert`
- `scope` 可选，小写：本仓常用 `src` `views` `components` `utils` `excel` `configs` `updates` `docs` `build` `ci` `deps`
- `subject` 必填：祈使句、首字母小写、≤50 字符、句尾无句号；header ≤72

示例：`fix(configs): 调整 911 项步长为 0.5`、`feat(views): 添加年级总览移动端适配`

配套纪律：每提交单一问题；单次 ≤300 行；提交前 `pnpm type-check` + 相关测试自测。

## 钩子与 CI 门禁

- `pre-commit`：`lint-staged`（eslint --fix + prettier --write 暂存文件）+ `pnpm type-check`；`commit-msg`：commitlint。
- CI：编译门禁（`pnpm build`）+ Lint + 测试（vitest）+ `pnpm audit`（high 阻断）+ gitleaks + 分支名校验。
- 覆盖率门禁：现有测试基线（excelFlow 等）纳入后按团队基线补 vitest 覆盖率 ≥80%（与 SCES-Shared 一致）。

## 部署

- **Vercel git 集成绑定本仓库 `main`**：合并到 main 自动生产部署；PR 自动预览部署；
- `public/updates/latest.json` 由 `SCES-Management-Desktop-Electron` 的 release CI **跨仓推送**到本仓库 main（自动化，勿手改）；
- `public/download.html` 指向 SCES-Management-Desktop-Electron 的 GitHub Release 安装包（版本带 `profileId`）。

## 维护约定

- `public/configs/` 为预览端运行配置（学期、必填类别、步长等），改动走 PR 并按提交规范留言；
