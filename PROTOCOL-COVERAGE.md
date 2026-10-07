# 协议声明基线与开发归属

**这是静态入口清单，不是已支持/已运行协议清单。** 基于用户上传的ZCode source与官方cjs，用只读AST比较五类声明。静态匹配只表示所查 key/literal 一致，不表示 live 验证或本计划完整对等完成。protocol-audit 当前实现/差距列与静态声明核验分别维护；运行证据级别见下方索引。

每行绑定来源文件和line，`新Owner`（当前归属）以合并重排计划的功能名表达；`OldOwner`（历史归属）以原始阶段的功能名表达。归属依据为 需求层批准的 parity assignment、删除裁决及明确延期优先。正式方向/carrier/handler/schema/GUI需要在所属section追踪；不把源码共享类型表当CLI可达证明。没有官方GUI入口的内部协议只实现正确内部行为，不强造按钮。

| 类别 | 源码声明数 | bundle对应数 | 静态结论 |
|---|---:|---:|---|
| legacy-methods | 74 | 74 | key/literal matched（protocol-audit 核验 installed 3.14.4） |
| legacy-notifications | 7 | 7 | key/literal matched（protocol-audit 核验 installed 3.14.4） |
| v4-methods | 31 | 31 | key/literal matched（protocol-audit 核验 installed 3.14.4） |
| v4-notifications | 4 | 4 | key/literal matched（protocol-audit 核验 installed 3.14.4） |
| v4-commands | 34 | 34 | key + inline payload shape matched（protocol-audit 核验 installed 3.14.4） |

不能将不同层级项简单相加当“协议总数”，也不能从此得出实现覆盖率。版本 banner/安装是 protocol-audit/closure-acceptance 的产品能力，并非上述协议表项。

## legacy-methods

源码：`packages/shared/src/zcode-protocol/index.ts`，声明 `zcodeProtocolMethods`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `runtime/capabilities` | 3564 | official-runtime-install | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | hooks-capabilities | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `computer-use/operation-event` | 3565 | browser-computer-use | carrier/handler 及 UI 语义按所属功能核实；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | Y | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/create` | 3566 | lifecycle-commands | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（driver） | [E01](#protocol-coverage-index)；官方会话创建经 driver session-controller 入口（tests/lifecycle-commands） |
| `session/resume` | 3567 | driver-legacy-migration | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 部分（driver） | [E01](#protocol-coverage-index)；driver resume + 全量回填（tests/driver-legacy-migration） |
| `session/list` | 3568 | driver-legacy-migration | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E02](#protocol-coverage-index)；driver LegacyDirectory 消费 catalog 读侧（tests/driver-legacy-migration） |
| `session/subagents` | 3569 | background-subagents | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 部分（session-reading） | [E08](#protocol-coverage-index)；保留 subagents helper/旧测试；active relay 拒绝，无当前 DSH 子 agent 目录入口 |
| `session/requestRuntimePreferences` | 3570 | queue-guide-goal | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | conversation-core | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/read` | 3571 | driver-legacy-migration | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E01](#protocol-coverage-index)；driver 会话转录由翻译层落盘（tests/lifecycle-events） |
| `session/messages` | 3572 | driver-legacy-migration | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E01](#protocol-coverage-index)；driver 会话转录由翻译层落盘（tests/lifecycle-events） |
| `session/events` | 3573 | conversation-runtime | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | conversation-core | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/debug` | 3574 | account-usage-diagnostics | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 未实现（session-reading） | [E08](#protocol-coverage-index)；仅保留声明/schema；当前诊断 UI 未接该 session debug carrier |
| `session/subscribe` | 3575 | conversation-runtime | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | conversation-core | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/send` | 3578 | lifecycle-commands | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（driver） | [E01](#protocol-coverage-index)；driver sendText 投递（tests/lifecycle-commands） |
| `session/stop` | 3581 | lifecycle-commands | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（driver） | [E01](#protocol-coverage-index)；driver stop 回执（tests/lifecycle-command-repair） |
| `session/cancelBackgroundTask` | 3584 | background-subagents | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 部分（session-reading） | [E06](#protocol-coverage-index)；当前 workflow run Cancel 经 cancelBackgroundWork；Bash/subagent 目录和取消入口未接 |
| `session/fork` | 3588 | fork-compact | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-lifecycle-controls | 已实现（driver） | [E08](#protocol-coverage-index)；driver fork.mjs 分支建立（tests/fork-compact） |
| `session/compact` | 3589 | fork-compact | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-lifecycle-controls | 已实现（driver） | [E08](#protocol-coverage-index)；driver compact.mjs 转发官方 compact（tests/fork-compact） |
| `session/goal` | 3590 | queue-guide-goal | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E05](#protocol-coverage-index)；会话附件输入区纯文本 /goal 经 inputSubmission→官方 goal intent；ACK 不代表目标完成 |
| `session/close` | 3591 | session-directory-lifecycle | 产品生命周期；绝不能作connection dispose；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | session-reading | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/setModel` | 3594 | driver-model-seat | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（driver） | [E03](#protocol-coverage-index)；driver 模型席位 selectModel 确认包装（tests/driver-model-seat） |
| `session/setThoughtLevel` | 3598 | driver-model-seat | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（driver） | [E03](#protocol-coverage-index)；driver 模型席位 effort 映射（tests/driver-model-seat） |
| `session/setMode` | 3599 | queue-guide-goal | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（conversation-core；closure-acceptance 收口） | [E14](#closure-evidence)；legacy mode 功能经 v4 switchCollaborationMode 等价路由；composer dock collaboration picker→session-lifecycle-controls durable control→active relay；仅官方 snapshot 更新持久化 mode/后续 input，无乐观改写 |
| `workspace/readPresentation` | 3600 | queue-guide-goal | 按批准归属 settings-panel；官方 Host readWorkspacePresentation；只读工作区 mode/slash commands 入口 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E10](#protocol-coverage-index)；官方 Host 只读 presentation / setting.update→get→sync，app active workspace scope |
| `workspace/hooks/trustGrant` | 3601 | interaction-plan-review-trust | carrier/handler及UI语义按所属节核实 | Y | Y | Y | hooks-capabilities | 部分（hooks-capabilities） | [E09](#protocol-coverage-index)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `provider/updateAccountConfig` | 3603 | official-runtime-install | 不可据此推断提供login/token取得能力；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | hooks-capabilities | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workspace/updateInteractionPreferences` | 3604 | queue-guide-goal | carrier/handler及UI语义按所属节核实；官方 GUI 的 setting.update → syncAppRuntimePreferences；作用于官方 active workspaces | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E10](#protocol-coverage-index)；官方 Host 只读 presentation / setting.update→get→sync，app active workspace scope |
| `workspace/updateModelIoPreferences` | 3605 | queue-guide-goal | carrier/handler及UI语义按所属节核实；官方 GUI 的 setting.update → syncAppRuntimePreferences；作用于官方 active workspaces | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E10](#protocol-coverage-index)；官方 Host 只读 presentation / setting.update→get→sync，app active workspace scope |
| `workspace/updateOffPeakToolPolicy` | 3608 | automation-offpeak | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | settings-panel | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workspace/updateDynamicWorkflowPolicy` | 3610 | workflow-management | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | settings-panel | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workspace/generateText` | 3613 | account-usage-diagnostics | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | settings-panel | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workspace/cancelGenerateText` | 3614 | account-usage-diagnostics | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | settings-panel | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `provider/testModelConnectivity` | 3615 | account-usage-diagnostics | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E11](#protocol-coverage-index)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `mcp/list` | 3616 | catalog-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/list` | 3617 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/referenceCatalog` | 3618 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/referenceCatalogWithCategory` | 3619 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `skills/referenceCatalog` | 3620 | catalog-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `workflows/list` | 3622 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `workflows/get` | 3623 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `workflows/updateMeta` | 3624 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `workflows/delete` | 3625 | workflow-management | carrier/handler 及 UI 语义按所属功能核实；删除裁决：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（删除/卸载/移除入口不提供） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workflows/runs` | 3626 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `workflows/move` | 3628 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `plugins/resolveSuggestedReference` | 3629 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/setEnabled` | 3630 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/overview` | 3631 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/marketplace/add` | 3632 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/marketplace/remove` | 3633 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；删除裁决：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（删除/卸载/移除入口不提供） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `plugins/marketplace/update` | 3634 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/install` | 3635 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/cancelOperation` | 3636 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/uninstall` | 3637 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；删除裁决：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（删除/卸载/移除入口不提供） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `plugins/update` | 3638 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/restoreBuiltin` | 3639 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/configure` | 3640 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/resetConfig` | 3641 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/validate` | 3642 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/describe` | 3643 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E13](#protocol-coverage-index)；settings-panel catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `automation/create` | 3644 | automation-offpeak | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 部分（settings-panel） | [E07](#protocol-coverage-index)；官方 Host cron GUI 子集可达/已测；targetTaskId、botDeliveryTarget、interval/intervalUnit 显式拒绝 |
| `automation/update` | 3645 | automation-offpeak | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 部分（settings-panel） | [E07](#protocol-coverage-index)；官方 Host cron GUI 子集可达/已测；targetTaskId、botDeliveryTarget、interval/intervalUnit 显式拒绝 |
| `automation/checkTaskBinding` | 3646 | automation-offpeak | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E07](#protocol-coverage-index)；官方 Host 列表/绑定 read、off-peak 显式 create；不发明调度或 entitlement |
| `automation/list` | 3647 | automation-offpeak | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E07](#protocol-coverage-index)；官方 Host 列表/绑定 read、off-peak 显式 create；不发明调度或 entitlement |
| `automation/delete` | 3648 | automation-offpeak | carrier/handler 及 UI 语义按所属功能核实；删除裁决：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（删除/卸载/移除入口不提供） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `offPeak/create` | 3650 | automation-offpeak | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E07](#protocol-coverage-index)；官方 Host 列表/绑定 read、off-peak 显式 create；不发明调度或 entitlement |
| `offPeak/list` | 3651 | automation-offpeak | carrier/handler 及 UI 语义按所属功能核实；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E07](#protocol-coverage-index)；官方 Host 列表/绑定 read、off-peak 显式 create；不发明调度或 entitlement |
| `usage/stats` | 3654 | account-usage-diagnostics | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E11](#protocol-coverage-index)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `session/usage` | 3657 | account-usage-diagnostics | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E11](#protocol-coverage-index)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `process/childProcesses` | 3659 | account-usage-diagnostics | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E11](#protocol-coverage-index)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `interaction/requestPermission` | 3660 | interaction-plan-review-trust | reverse interaction；基础 UI 在 conversation-runtime，高级合同在 interaction-plan-review-trust | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E01](#protocol-coverage-index)；native approval waterfall→resolveInteraction accept/decline/cancel；仲裁仅 assumed-single-answerer |
| `interaction/requestUserInput` | 3661 | interaction-plan-review-trust | reverse interaction；基础 UI 在 conversation-runtime，高级合同在 interaction-plan-review-trust | Y | Y | Y | conversation-core | 已实现（driver） | [E01](#protocol-coverage-index)；driver 装配已接通：官方 userQuestions 承接无计时普通变体，受限/带计时走插件问卷卡（tests/user-input-routing + user-input-card） |
| `interaction/requestProviderRuntimeHeaders` | 3662 | official-runtime-install | reverse auth；正式凭据来源待实测，非登录API；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | hooks-capabilities | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `interaction/requestOfficialMcpAuthHeaders` | 3663 | official-runtime-install | reverse auth；保留official origin trust边界；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | hooks-capabilities | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `interaction/browserList` | 3665 | browser-computer-use | reverse browser host 责任；不得忽略；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | Y | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `interaction/browserExecute` | 3666 | browser-computer-use | reverse browser host 责任；不得自动换 MCP；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | Y | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
## legacy-notifications

源码：`packages/shared/src/zcode-protocol/index.ts`，声明 `zcodeProtocolNotifications`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `startup/storageState` | 336 | official-runtime-install | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | hooks-capabilities | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `interaction/providerRuntimeHeadersCancelled` | 337 | official-runtime-install | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | hooks-capabilities | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `process/mcpTelemetry` | 338 | account-usage-diagnostics | carrier/handler 及 UI 语义按所属功能核实；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `process/mcpResourceSamples` | 339 | account-usage-diagnostics | carrier/handler 及 UI 语义按所属功能核实；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `process/toolExecResource` | 340 | account-usage-diagnostics | carrier/handler 及 UI 语义按所属功能核实；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `plugins/operationProgress` | 341 | catalog-management | carrier/handler 及 UI 语义按所属功能核实；内部载体随所属能力，不另造按钮；settings-panel 通过官方 Host facade（非 stdio 正向直调） | Y | N（内部往返） | N（随所属入口） | settings-panel | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `process/resourceSample` | 342 | account-usage-diagnostics | carrier/handler 及 UI 语义按所属功能核实；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
## v4-methods

源码：`packages/shared/src/zcode-protocol-v4/transport.ts`，声明 `V4_METHODS`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `v4/connection/flow` | 333 | conversation-runtime | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | conversation-core | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/controller/subscribe` | 334 | session-directory-lifecycle | 声明存在；本次未定位直接CLI handler，不推定stdio可调；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | session-lifecycle-controls | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/controller/resync` | 335 | session-directory-lifecycle | 声明存在；本次未定位直接CLI handler，不推定stdio可调；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | session-lifecycle-controls | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/controller/unsubscribe` | 336 | session-directory-lifecycle | 声明存在；本次未定位直接CLI handler，不推定stdio可调；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | session-lifecycle-controls | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/conversation/subscribe` | 337 | conversation-runtime | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | conversation-core | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/conversation/resync` | 338 | conversation-runtime | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | conversation-core | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/conversation/unsubscribe` | 339 | conversation-runtime | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | conversation-core | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/conversation/rowsRange` | 341 | conversation-runtime | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（driver） | [E08](#protocol-coverage-index)；driver 装配已接通：driver 分页回填 history-backfill（tests/driver-legacy-migration） |
| `v4/conversation/plans` | 343 | interaction-plan-review-trust | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（session-reading；closure-acceptance 收口） | [E14](#closure-evidence)；composer dock Read official plans→session-bound typed read→active relay conversationPlansV4；epoch/revision/owner 栅栏；只读 |
| `v4/conversation/fileChanges` | 344 | history-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（session-reading；closure-acceptance 收口） | [E14](#closure-evidence)；composer dock Read file changes→现有 historyQuery→active relay conversationFileChangesV4；row/revision/epoch 校验与 patch 呈现；只读 |
| `v4/conversation/backgroundBashOutput` | 345 | background-subagents | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 部分（session-reading） | [E08](#protocol-coverage-index)；保留资源 helper/旧测试；active relay 无该查询映射，当前 native GUI 未消费 |
| `v4/conversation/fileRewindPreview` | 346 | history-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（session-reading；closure-acceptance 收口） | [E14](#closure-evidence)；composer dock Preview file rewind→现有 historyQuery→active relay conversationFileRewindPreviewV4；官方 canRewindFiles 与 row/revision/epoch 校验；只读，不提供 apply |
| `v4/conversation/workflowRunEvents` | 349 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRuns` | 350 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunArtifacts` | 356 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunArtifactData` | 357 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunArtifactRead` | 358 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunWorkspace` | 361 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunNodeResult` | 362 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/usage/stats` | 366 | account-usage-diagnostics | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E11](#protocol-coverage-index)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `v4/conversation/usage` | 367 | account-usage-diagnostics | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E11](#protocol-coverage-index)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `v4/attachment/begin` | 370 | attachments-context | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E12](#protocol-coverage-index)；settings-panel attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/chunk` | 371 | attachments-context | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E12](#protocol-coverage-index)；settings-panel attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/commit` | 372 | attachments-context | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E12](#protocol-coverage-index)；settings-panel attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/abort` | 373 | attachments-context | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E12](#protocol-coverage-index)；settings-panel attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/read` | 375 | attachments-context | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E12](#protocol-coverage-index)；settings-panel attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/conversation/attachmentRead` | 377 | attachments-context | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E12](#protocol-coverage-index)；settings-panel attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/conversation/attachmentStat` | 379 | attachments-context | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E12](#protocol-coverage-index)；settings-panel attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/previewSource` | 381 | attachments-context | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E12](#protocol-coverage-index)；settings-panel attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/commands/query` | 382 | conversation-runtime | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | conversation-core | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/command` | 383 | conversation-runtime | dispatcher，不等于其34种payload已实现；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | conversation-core | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
## v4-notifications

源码：`packages/shared/src/zcode-protocol-v4/transport.ts`，声明 `V4_NOTIFICATIONS`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `v4/conversation/frame` | 409 | conversation-runtime | 嵌套topic/row/delta/wire还需展开 | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E01](#protocol-coverage-index)；订阅保留 ACK/frame reservation；snapshot/delta 投影至 native 文本/工具/审批；非所有 row 变体全覆盖 |
| `v4/telemetry/event` | 411 | account-usage-diagnostics | carrier/handler 及 UI 语义按所属功能核实；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/telemetry/local-ttft` | 412 | account-usage-diagnostics | carrier/handler 及 UI 语义按所属功能核实；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/cua/permission-observation` | 414 | browser-computer-use | carrier/handler 及 UI 语义按所属功能核实；浏览器/计算机使用能力尚未提供，已记录延期；不以替代入口宣称完成 | Y | Y | N | 延期（浏览器/计算机使用能力） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
## v4-commands

源码：`packages/shared/src/zcode-protocol-v4/command.ts`，声明 `commandPayloadSchemas`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `createSession` | 46 | session-create | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E01](#protocol-coverage-index)；官方 v4 create/firstInput、sendText、stop；legacy 功能经 v4 等价路由 |
| `createSelectionSideSession` | 69 | history-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E08](#protocol-coverage-index)；driver 装配已接通：driver 命令 + 插件卡（tests/history-mutations + history-mutations-card） |
| `sendText` | 81 | conversation-runtime | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E01](#protocol-coverage-index)；官方 v4 create/firstInput、sendText、stop；legacy 功能经 v4 等价路由 |
| `sendGoalCommand` | 135 | queue-guide-goal | carrier/handler 及 UI 语义按所属功能核实；settings-panel 加法 UI 消费，保留协议 owner | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E05](#protocol-coverage-index)；会话附件输入区纯文本 /goal 经 inputSubmission→官方 goal intent；ACK 不代表目标完成 |
| `stop` | 144 | conversation-runtime | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E01](#protocol-coverage-index)；官方 v4 create/firstInput、sendText、stop；legacy 功能经 v4 等价路由 |
| `compact` | 150 | history-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E08](#protocol-coverage-index)；driver 装配已接通：driver compact.mjs 转发官方 compact（tests/fork-compact） |
| `forkAssistant` | 152 | history-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E08](#protocol-coverage-index)；driver 装配已接通：driver fork.mjs 分支建立与绑定（tests/fork-compact） |
| `applyFileRewind` | 153 | history-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E08](#protocol-coverage-index)；driver 装配已接通：driver 命令 + 插件卡，预览/应用分离（tests/history-mutations + history-mutations-card） |
| `editUserQuery` | 154 | history-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E08](#protocol-coverage-index)；driver 装配已接通：driver 命令 + 插件卡，编辑切分支绑定一致（tests/history-mutations + history-mutations-card） |
| `retryTurn` | 161 | history-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E08](#protocol-coverage-index)；driver 装配已接通：driver 命令 + 插件卡（tests/history-mutations + history-mutations-card） |
| `setAssistantFeedback` | 162 | history-management | carrier/handler 及 UI 语义按所属功能核实；反馈入口归 settings-panel | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E05](#protocol-coverage-index)；settings-panel assistant row feedback；revision/epoch/target admission，经 session-lifecycle-controls durable receipt |
| `sendQueuedNow` | 166 | queue-guide-goal | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E04](#protocol-coverage-index)；session-lifecycle-controls native dock 编辑/立即发送；官方回执与原始 input ID、队列内容以官方为准 |
| `editQueueItem` | 167 | queue-guide-goal | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E04](#protocol-coverage-index)；session-lifecycle-controls native dock 编辑/立即发送；官方回执与原始 input ID、队列内容以官方为准 |
| `reorderQueueItem` | 169 | queue-guide-goal | carrier/handler 及 UI 语义按所属功能核实；settings-panel 加法 UI 消费，保留协议 owner | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E05](#protocol-coverage-index)；settings-panel 会话 dock 消费；durable session-lifecycle-controls control/ACK，不乐观改写官方状态 |
| `deleteQueueItem` | 173 | queue-guide-goal | carrier/handler 及 UI 语义按所属功能核实；删除裁决：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（删除/卸载/移除入口不提供） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `setAutoDrain` | 174 | queue-guide-goal | carrier/handler 及 UI 语义按所属功能核实；settings-panel 加法 UI 消费，保留协议 owner | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E05](#protocol-coverage-index)；settings-panel 会话 dock 消费；durable session-lifecycle-controls control/ACK，不乐观改写官方状态 |
| `resolveInteraction` | 176 | interaction-plan-review-trust | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（driver） | [E01](#protocol-coverage-index)；driver 装配已接通：driver 作答 permission/userInput；workspace hook review 只走自有命令族（tests/user-input-routing.test.mjs + tests/hook-review-panel.test.mjs） |
| `respondWorkspaceHookReview` | 189 | interaction-plan-review-trust | carrier/handler及UI语义按所属节核实 | Y | Y | Y | hooks-capabilities | 部分（hooks-capabilities） | [E09](#protocol-coverage-index)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `toggleWorkspaceHookReviewItem` | 192 | interaction-plan-review-trust | carrier/handler及UI语义按所属节核实 | Y | Y | Y | hooks-capabilities | 部分（hooks-capabilities） | [E09](#protocol-coverage-index)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `revokeWorkspaceHookTrust` | 196 | interaction-plan-review-trust | carrier/handler及UI语义按所属节核实 | Y | Y | Y | hooks-capabilities | 部分（hooks-capabilities） | [E09](#protocol-coverage-index)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `requestWorkspaceHookReview` | 203 | interaction-plan-review-trust | carrier/handler及UI语义按所属节核实 | Y | Y | Y | hooks-capabilities | 部分（hooks-capabilities） | [E09](#protocol-coverage-index)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `snoozeInteractionAutoResolution` | 205 | interaction-plan-review-trust | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 部分（conversation-core） | [E09](#protocol-coverage-index)；保留交互 helper/旧测试；active relay 拒绝且当前 native UI 无暂停自动结束入口 |
| `switchModelConfig` | 208 | queue-guide-goal | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E03](#protocol-coverage-index)；官方模型/强度 picker→identity/effort 校验→switchModelConfig；确认后持久化 |
| `switchCollaborationMode` | 215 | queue-guide-goal | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（conversation-core；closure-acceptance 收口） | [E14](#closure-evidence)；composer dock collaboration picker→session-lifecycle-controls durable control→active relay；仅官方 snapshot 更新持久化 mode/后续 input，无乐观改写 |
| `setFollowupMode` | 218 | queue-guide-goal | carrier/handler及UI语义按所属节核实 | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E05](#protocol-coverage-index)；settings-panel 会话 dock 消费；durable session-lifecycle-controls control/ACK，不乐观改写官方状态 |
| `pauseGoal` | 219 | queue-guide-goal | carrier/handler 及 UI 语义按所属功能核实；settings-panel 加法 UI 消费，保留协议 owner | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E05](#protocol-coverage-index)；settings-panel 会话 dock 消费；durable session-lifecycle-controls control/ACK，不乐观改写官方状态 |
| `resumeGoal` | 220 | queue-guide-goal | carrier/handler 及 UI 语义按所属功能核实；settings-panel 加法 UI 消费，保留协议 owner | Y | Y | Y | conversation-core | 已实现（conversation-core） | [E05](#protocol-coverage-index)；settings-panel 会话 dock 消费；durable session-lifecycle-controls control/ACK，不乐观改写官方状态 |
| `cancelBackgroundWork` | 221 | background-subagents | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 部分（settings-panel） | [E06](#protocol-coverage-index)；当前 workflow run Cancel 经 cancelBackgroundWork；Bash/subagent 目录和取消入口未接 |
| `resumeWorkflowRun` | 228 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow run UI→session-lifecycle-controls durable control→官方 Host；ACK 是回执 |
| `startSavedWorkflow` | 236 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow run UI→session-lifecycle-controls durable control→官方 Host；ACK 是回执 |
| `amendWorkflowRunSettings` | 243 | workflow-management | carrier/handler及UI语义按所属节核实 | Y | Y | Y | settings-panel | 已实现（settings-panel） | [E06](#protocol-coverage-index)；settings-panel workflow run UI→session-lifecycle-controls durable control→官方 Host；ACK 是回执 |
| `renameSession` | 244 | lifecycle-command-repair | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E02](#protocol-coverage-index)；driver rename 等待 ZCode ACK + 标题回读（tests/lifecycle-command-repair） |
| `deleteSession` | 245 | session-directory-lifecycle | carrier/handler 及 UI 语义按所属功能核实；删除裁决：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（删除/卸载/移除入口不提供） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `discardSharedContext` | 246 | attachments-context | carrier/handler及UI语义按所属节核实 | Y | Y | Y | session-reading | 已实现（driver） | [E08](#protocol-coverage-index)；driver 装配已接通：driver 命令 + 插件卡，仅 pending 可撤（tests/history-mutations） |

## 五表之外仍需完成的普查

| 面 | 开发归属 | 闭合条件 |
|---|---|---|
| startup控制帧、session/event等表外字面消息 | official-runtime-install/conversation-runtime | 实际producer/dispatcher与消费者检索，不仅枚举常量表 |
| hello/clientHello、协商可信位、连接profile与continuous/replayable | official-runtime-install/conversation-runtime | 真实carrier证明；不能每条transport都发送同一握手 |
| command envelope、ACK/result、errors、revision/epoch | conversation-runtime/session-directory-lifecycle/queue-guide-goal/history-management | 成功/错误/重复/丢响应与原生状态变化相符 |
| frame topics、wire分片、delta ops、rows、snapshots、tool displays | conversation-runtime/interaction-plan-review-trust/background-subagents/browser-computer-use/workflow-management | 每个实存变体有decode/投影/consumer或有证据的非适用理由 |
| attachments/shared context的字节与来源权限 | attachments-context | 真实上传/read/abort与跨session拒绝 |
| plugin/MCP/skills/workflow/automation/offPeak嵌套结构及门禁 | catalog-management/workflow-management/automation-offpeak | 不只顶层method成功；操作结果、progress和GUI及denial齐全 |
| remote authority与host反向端口 | official-runtime-install/browser-computer-use/remote-workspace | 正式身份、路由和运行位置已证实，不做私有协议旁路 |
| 官方GUI实际入口 | 各业务节 | handler→GUI双向检查；内部协议可无按钮，用户功能不可只raw JSON |

## 正式支持清单需要补充的字段

方向/carrier、实际handler、schema/result/error variants、运行前提、官方GUIconsumer、本桥owner、正反例、真实runtime身份与证据、entitlement/平台限制、差异来源。可在同一inventory扩充，不再维护第二份会互相漂移的清单。`not applicable`必须有版本/handler证据；不能用来隐藏未知或尚未实现。

## 重跑静态检查

```bash
node scripts/inspect-protocol.cjs \
  --source /absolute/path/ZCode \
  --runtime /absolute/path/zcode.cjs \
  --out /absolute/path/static-report.json \
  --typescript /absolute/path/typescript/lib/typescript.js
```

脚本只读取输入并写指定报告，不eval/require runtime。TypeScript须已安装，可省略`--typescript`使用本地可解析的package；不自动联网安装。退出0仅五表匹配，1=声明差异，2=缺失/歧义/解析失败，绝不等于产品兼容通过。源码symbol或minifier属性策略变化可能令扫描无法定位，必须调查而非认定协议已删除。

## settings-panel 归属落盘与证据边界

- 150 个声明行全部保留（74/7/31/4/34），历史归属列保留其历史语义；当前归属按批准延期与删除裁决落盘。
- `外露=Y` 表示官方运行时安装阶段已确认的官方 Host/CLI/反向或通知载体；它不是本节 live 执行证据。内部往返依所属入口追踪，不独立造按钮。
- settings-panel 入口：Plugins → @dsh-zcode/bridge 配置页；Settings → Zcode Bridge；ZCode 会话 composer dock → workflows/feedback/attachments/queue preferences。既有官方 model picker 保持原生。
- workspace/readPresentation 归 settings-panel 必做，并交付只读呈现入口；浏览器/计算机使用/trajectory 能力延期。删除/卸载/移除入口禁止。
- workspace off-peak/dynamic-workflow policy 是官方 Host 内部 entitlement 同步，辅助 generation/cancel 是官方 GUI 辅助请求内部链，不伪造独立配置状态或另造内部按钮。
- 本节 mock/headless/浏览器及包验证见历史 settings-panel 阶段交接（`.agent-work/handoffs/settings-panel.md`）；真实模型调用预算 0。protocol-audit 继续维护实现差距/安装版本差异；closure-acceptance 执行 npm-installed official DSH 最终只读验收与人工写入清单。

## protocol-coverage-index

审计代码基线：`91f0c92`（conversation-core 至 settings-panel 阶段），2026-10-05。150 行及声明/源行/历史归属/当前归属/必做均保留；110 个必做行逐行标注。已实现/部分/未实现是**当前官方 DSH 可达功能**的状态，不是静态匹配、测试计数或 live 对等验收结论。

- **已实现**：当前 UI/注册 Agent consumer 可达、生产 owner 路由/校验与行为测试存在；legacy 同功能转 v4/Host 时逐行明示，不能据此宣称 legacy wire 直调已接。Live/非全量 variant 限制保留。
- **部分**：保留 helper/旧测试而 active relay 不放行，或当前 GUI/参数/交互只覆盖部分功能。旧 fork UI 与未执行的 `.dsh.spec.ts` 不构成当前入口证据。
- **未实现**：仅声明/schema，或当前 owner 明确拒绝且无完成所需 consumer。
- 当前归属是已批准责任归属；session-lifecycle-controls/settings-panel 后续消费写在证据列，不改派 owner。protocol-audit 只记录差距，**未实现任何上述缺口**。closure-acceptance 必须处理本计划必做残留或获得需求层裁决；本表没有擅自新增延期。

| 证据 | 当前生产 owner / consumer | 已存在的可执行行为测试；限制 |
|---|---|---|
| E01 | [zcode-driver factory](packages/driver/factory.mjs)、[driver agent](packages/driver/agent.mjs)、[conversation](packages/host/conversation.mjs)、[execution relay](packages/host/launcher/execution.mjs) | [zcode-driver-factory](tests/zcode-driver-factory.test.mjs)、[zcode-driver-teardown](tests/zcode-driver-teardown.test.mjs)、[lifecycle-commands](tests/lifecycle-commands.test.mjs)、[lifecycle-command-repair](tests/lifecycle-command-repair.test.mjs)、[lifecycle-events](tests/lifecycle-events.test.mjs)；driver 唯一装配，permission 面见 E09 |
| E02 | [driver legacy directory](packages/driver/legacy-directory.mjs)、[zcode-runtime catalog read](packages/host/zcode-runtime.mjs) | [driver-legacy-migration](tests/driver-legacy-migration.test.mjs)、[settings-panel-parity](tests/settings-panel-parity.test.mjs)；driver catalog 读侧消费，镜像目录簿记已退役 |
| E03 | [model-selection](packages/host/model-selection.mjs)、[driver model seat](packages/driver/model-seat.mjs)、[zcode-llm](packages/host/zcode-llm.mjs) | [driver-model-seat](tests/driver-model-seat.test.mjs)、[model-selection](tests/model-selection.test.mjs)；driver selectModel 确认包装 + adapter replace 就绪唤醒 |
| E04 | [mirror-lifecycle](packages/host/mirror-lifecycle.mjs)、[driver legacy directory](packages/driver/legacy-directory.mjs) | [driver-legacy-migration](tests/driver-legacy-migration.test.mjs)、[lifecycle-events](tests/lifecycle-events.test.mjs)；引用仍存在的 lifecycle helper，client 并存 dock 已退役 |
| E05 | [parity command owner](packages/host/parity.mjs)、[session panels](packages/client/parity-controls.jsx)、[input-controls](packages/client/input-controls.mjs) | [settings-panel-parity](tests/settings-panel-parity.test.mjs)、[settings-panel-parity-ui](tests/settings-panel-parity-ui.test.mjs)、[protocol-coverage-repair](tests/protocol-coverage-repair.test.mjs)；mock/React，不是 live 写验收 |
| E06 | [workflow](packages/host/workflow.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[workflow panel](packages/client/workflow-view.jsx) | [settings-panel-parity](tests/settings-panel-parity.test.mjs)、[settings-panel-parity-ui](tests/settings-panel-parity-ui.test.mjs)、[protocol-coverage-repair](tests/protocol-coverage-repair.test.mjs)；所有七个 run query 的 workspace 身份已测，真实 run 写未验证 |
| E07 | [automation](packages/host/automation.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[automation panel](packages/client/parity-controls.jsx) | [settings-panel-parity](tests/settings-panel-parity.test.mjs)、[settings-panel-parity-ui](tests/settings-panel-parity-ui.test.mjs)、[protocol-coverage-repair](tests/protocol-coverage-repair.test.mjs)；保留 partial update 字段，create/update unsupported 字段明确拒绝 |
| E08 | [conversation](packages/host/conversation.mjs)、[driver history](packages/driver/history.mjs)、[driver fork](packages/driver/fork.mjs)、[driver compact](packages/driver/compact.mjs)、[active relay](packages/host/launcher/execution.mjs) | [history-mutations](tests/history-mutations.test.mjs)、[history-mutations-card](tests/history-mutations-card.test.mjs)、[fork-compact](tests/fork-compact.test.mjs)、[driver-legacy-migration](tests/driver-legacy-migration.test.mjs)；五命令/fork/compact/rowsRange 已接通 |
| E09 | [conversation hook/interaction helpers](packages/host/conversation.mjs) 对照 [active relay](packages/host/launcher/execution.mjs) | [interaction-commands](tests/interaction-commands.test.mjs) 为历史 helper 检查；hooks-capabilities launcher/trust 不改该 owner，当前 consumer 未接 |
| E10 | [parity](packages/host/parity.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[workspace/preferences panels](packages/client/parity-controls.jsx) | [settings-panel-parity](tests/settings-panel-parity.test.mjs)、[settings-panel-parity-ui](tests/settings-panel-parity-ui.test.mjs)、[protocol-coverage-repair](tests/protocol-coverage-repair.test.mjs)；presentation retry 与 active-workspace 设置语义 |
| E11 | [insights](packages/host/insights.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[DiagnosticsExtras](packages/client/parity-controls.jsx) | [settings-panel-parity](tests/settings-panel-parity.test.mjs)、[settings-panel-parity-ui](tests/settings-panel-parity-ui.test.mjs)；本节真实 connectivity/model calls=0 |
| E12 | [attachment](packages/host/attachment.mjs)、[conversation](packages/host/conversation.mjs)、[AttachmentPanel](packages/client/parity-controls.jsx)、[parity](packages/host/parity.mjs) | [attachments-context](tests/attachments-context.test.mjs)、[attachment-preview](tests/attachment-preview.test.mjs) 为旧编号 helper 检查；当前消费者有 [settings-panel-parity](tests/settings-panel-parity.test.mjs)、[settings-panel-parity-ui](tests/settings-panel-parity-ui.test.mjs)、[protocol-coverage-repair](tests/protocol-coverage-repair.test.mjs)；真实上传未执行 |
| E13 | [catalog](packages/host/catalog.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[catalog panel](packages/client/catalog-view.jsx) | [settings-panel-parity](tests/settings-panel-parity.test.mjs)、[settings-panel-parity-ui](tests/settings-panel-parity-ui.test.mjs)；官方 facade 别名见 launcher 表，不冒充 stdio 直调 |

安装版逐行声明核对和升级结果：[protocol-diff-3.14.4](docs/protocol-diff-3.14.4.md)。`必做=N` 行保留批准的删除与延期决策及内部从属语义；没有添加删除/卸载/移除入口。五表之外旧编号普查清单是历史调查面，不能作为本计划 protocol-audit 的新功能实施授权。

protocol-audit 必做当前状态计数（声明行，不是协议总数/产品覆盖率）：已实现 77；部分 31；未实现 2。所有真实写验收及 npm-installed official DSH read-only browser 验收仍归 closure-acceptance。

## closure-evidence

- **E14**：[active parity owner](packages/host/parity.mjs)、[launcher mapping](packages/host/launcher/parity.mjs)、[typed resources](packages/host/conversation.mjs)、[official mode projection](packages/host/zcode-agent.mjs)、[session panels](packages/client/parity-controls.jsx)。[history-integration](tests/history-integration.test.mjs) 与 [settings-panel-parity-ui](tests/settings-panel-parity-ui.test.mjs) 的 closure-acceptance 用例验证 active relay、官方 workspace/session、陈旧/跨 owner 结果拒绝、真实 renderer 点击、ACK 不乐观更新 mode 与后续 input；全部 mock/headless，真实写操作与 npm browser 验收未执行。
- protocol-audit 的 33 个差距行中 **5 收口 / 28 后继计划移交**；其中余下 **26 partial / 2 unimplemented**，详见 [显式延期交接](docs/closure-gap-handoff.md)。原必做/新Owner 列均保留，移交不是静态或 live 完成声明，不擅自认定需求 AC 已通过。
- 当前 110 必做：**82 已实现 / 26 部分 / 2 未实现**。150 行声明保持不变；本计划不宣称完整对等。npm 版本门禁/实际 seam 约束另见 [npm 环境](docs/npm-acceptance.md)。
