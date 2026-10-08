# docs 文档地图

本目录只保存面向维护者的稳定文档。worker handoff、探测判定报告、原始证据等过程产物不进本目录（规则见下）。2026-10-08 已把历史过程记录整体移出至 `.agent-work/archive/20261008-1454_docs-process-records/`（26 份 handoff、5 份探测报告、checks/ 证据树共 749 文件 / 12.9MB）；其中 docs/probes/checks 证据树已按用户裁决从 git 历史中清除，物理副本仅存在于该归档目录与同目录 pre-purge bundle。

## 协议层

- [protocol-coverage.md](protocol-coverage.md) — 150 行协议声明账本（活文档）：每行绑定来源文件/行号、当前归属与实现状态；随 npm 发布。
- [protocol-diff-3.14.4.md](protocol-diff-3.14.4.md) — 已安装 ZCode 3.14.4 与源码声明的比对快照（150 一致 / 0 分歧）。
- [carrier-inventory.md](carrier-inventory.md) — 150 条目的 carrier 分类（stdio / 反向通知 / Host 服务 RPC）。

## 契约与运行

- [driver-contract.md](driver-contract.md) — ZCode driver 契约（factory 占用、会话生命周期、命令控制面、存量迁移）。
- [host-launcher.md](host-launcher.md) — scratch Host launcher 的配置、校验与生命周期。
- [npm-acceptance.md](npm-acceptance.md) — 隔离 npm 验收环境 runbook（配套 `scripts/start-npm-acceptance.mjs`）。

## 收口报告

- [closure-entry-report.md](closure-entry-report.md) 与 [closure-gap-handoff.md](closure-gap-handoff.md) — 由 `node scripts/generate-closure-report.mjs` 从 protocol-coverage.md 生成，勿手改。
- [closure-residual-nits.md](closure-residual-nits.md) — 开放 NIT 台账（人工维护，结项后更新）。

## 归置规则

| 内容类型 | 去向 |
|---|---|
| 协议账本 / 审计快照 / 契约 / runbook / 生成报告 / 开放台账 | `docs/` |
| worker handoff、任务包、评审记录 | `.agent-work/archive/<时代目录>/` |
| 探针脚本输出、日志、截图、捕获数据 | `.agent-work/tmp/<task-slug>/` |
