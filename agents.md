# web 预览版 — Agents

本目录的 Claude Code 子代理定义位于根目录 `.claude/agents/`（Claude Code 实际加载的位置）。

## 可用代理

| 代理 | 用途 |
|------|------|
| `web-preview-dev` | web 预览版开发与维护（Vue 3 代码、测试、修复） |
| `web-preview-review` | web 预览版代码审查（性能、正确性、与正式版架构一致性） |
| `architect` | 架构评审（设计一致性、数据模型、命名规范） |

## 使用

在 web 目录下工作时，Claude Code 会自动加载 `web/CLAUDE.md` 作为上下文。需要专项任务时调用对应代理，例如：

- 修复预览版性能问题 → `web-preview-review`
- 迁移预览版已验证技术到正式版 → `architect`（评审迁移方案）

## 注意

- 预览版是**参考实现**，改动时注意与正式版架构（`docs/ARCHITECTURE.md`）保持一致，避免引入正式版不采纳的模式。