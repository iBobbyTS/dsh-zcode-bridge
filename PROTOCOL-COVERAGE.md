# 协议声明基线与开发归属

**这是静态入口清单，不是已支持/已运行协议清单。** 基于用户上传的ZCode source与官方cjs，用只读AST比较五类声明。静态匹配只表示所查 key/literal 一致，不表示 live 验证或本计划完整对等完成。S07 当前实现/差距列与静态声明核验分别维护；运行证据级别见下方索引。

每行绑定来源文件和line，`新Owner` 引用当前 PLAN-FULL 的 S01–S08；`OldOwner` 保留旧 S01–S16 历史编号。归属依据为 REQUIREMENTS D5 批准的 S01-PARITY-ASSIGNMENT，D3 删除裁决及 TASK-S06 明确的延期优先。正式方向/carrier/handler/schema/GUI需要在所属section追踪；不把源码共享类型表当CLI可达证明。没有官方GUI入口的内部协议只实现正确内部行为，不强造按钮。

| 类别 | 源码声明数 | bundle对应数 | 静态结论 |
|---|---:|---:|---|
| legacy-methods | 74 | 74 | key/literal matched（S07 installed 3.14.4） |
| legacy-notifications | 7 | 7 | key/literal matched（S07 installed 3.14.4） |
| v4-methods | 31 | 31 | key/literal matched（S07 installed 3.14.4） |
| v4-notifications | 4 | 4 | key/literal matched（S07 installed 3.14.4） |
| v4-commands | 34 | 34 | key + inline payload shape matched（S07 installed 3.14.4） |

不能将不同层级项简单相加当“协议总数”，也不能从此得出实现覆盖率。版本 banner/安装是 S07/S08 的产品能力，并非上述协议表项。

## legacy-methods

源码：`packages/shared/src/zcode-protocol/index.ts`，声明 `zcodeProtocolMethods`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `runtime/capabilities` | 3564 | S01 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `computer-use/operation-event` | 3565 | S11 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | Y | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/create` | 3566 | S02 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E01](#s07-实现证据索引)；官方 v4 create/firstInput、sendText、stop；legacy 功能经 v4 等价路由 |
| `session/resume` | 3567 | S04 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 部分（S02） | [E01](#s07-实现证据索引)；打开后订阅快照/恢复已有；未接 legacy 直调与完整历史分页/既有 config 水合 |
| `session/list` | 3568 | S04 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 已实现（S03） | [E02](#s07-实现证据索引)；官方 catalog 镜像/刷新、官方重命名与 🅩 前缀 |
| `session/subagents` | 3569 | S10 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留 subagents helper/旧测试；active relay 拒绝，无当前 DSH 子 agent 目录入口 |
| `session/requestRuntimePreferences` | 3570 | S06 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/read` | 3571 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E01](#s07-实现证据索引)；打开后订阅快照/恢复已有；未接 legacy 直调与完整历史分页/既有 config 水合 |
| `session/messages` | 3572 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E01](#s07-实现证据索引)；打开后订阅快照/恢复已有；未接 legacy 直调与完整历史分页/既有 config 水合 |
| `session/events` | 3573 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/debug` | 3574 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 未实现（S03） | [E08](#s07-实现证据索引)；仅保留声明/schema；当前诊断 UI 未接该 session debug carrier |
| `session/subscribe` | 3575 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/send` | 3578 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E01](#s07-实现证据索引)；官方 v4 create/firstInput、sendText、stop；legacy 功能经 v4 等价路由 |
| `session/stop` | 3581 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E01](#s07-实现证据索引)；官方 v4 create/firstInput、sendText、stop；legacy 功能经 v4 等价路由 |
| `session/cancelBackgroundTask` | 3584 | S10 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E06](#s07-实现证据索引)；当前 workflow run Cancel 经 cancelBackgroundWork；Bash/subagent 目录和取消入口未接 |
| `session/fork` | 3588 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S04 | 部分（S04） | [E08](#s07-实现证据索引)；保留 history/management helper/旧测试；active relay command allowlist 拒绝，无当前 DSH 对等入口 |
| `session/compact` | 3589 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S04 | 部分（S04） | [E08](#s07-实现证据索引)；保留 history/management helper/旧测试；active relay command allowlist 拒绝，无当前 DSH 对等入口 |
| `session/goal` | 3590 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E05](#s07-实现证据索引)；会话附件输入区纯文本 /goal 经 inputSubmission→官方 goal intent；ACK 不代表目标完成 |
| `session/close` | 3591 | S04 | 产品生命周期；绝不能作connection dispose；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S03 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `session/setModel` | 3594 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E03](#s07-实现证据索引)；官方模型/强度 picker→identity/effort 校验→switchModelConfig；确认后持久化 |
| `session/setThoughtLevel` | 3598 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E03](#s07-实现证据索引)；官方模型/强度 picker→identity/effort 校验→switchModelConfig；确认后持久化 |
| `session/setMode` | 3599 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 部分（S02） | [E03](#s07-实现证据索引)；create/send 携带 mode 且 relay 允许 switchCollaborationMode；当前 runtime/面板未提供切换 mode 的路由入口 |
| `workspace/readPresentation` | 3600 | S06 | D5 批准归 S06；官方 Host readWorkspacePresentation；只读工作区 mode/slash commands 入口（修正 TASK-S06 误写） | Y | Y | Y | S06 | 已实现（S06） | [E10](#s07-实现证据索引)；官方 Host 只读 presentation / setting.update→get→sync，app active workspace scope |
| `workspace/hooks/trustGrant` | 3601 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 | 部分（S05） | [E09](#s07-实现证据索引)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `provider/updateAccountConfig` | 3603 | S01 | 不可据此推断提供login/token取得能力；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workspace/updateInteractionPreferences` | 3604 | S06 | carrier/handler及UI语义按所属节核实；官方 GUI 的 setting.update → syncAppRuntimePreferences；作用于官方 active workspaces | Y | Y | Y | S06 | 已实现（S06） | [E10](#s07-实现证据索引)；官方 Host 只读 presentation / setting.update→get→sync，app active workspace scope |
| `workspace/updateModelIoPreferences` | 3605 | S06 | carrier/handler及UI语义按所属节核实；官方 GUI 的 setting.update → syncAppRuntimePreferences；作用于官方 active workspaces | Y | Y | Y | S06 | 已实现（S06） | [E10](#s07-实现证据索引)；官方 Host 只读 presentation / setting.update→get→sync，app active workspace scope |
| `workspace/updateOffPeakToolPolicy` | 3608 | S13 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S06 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workspace/updateDynamicWorkflowPolicy` | 3610 | S12 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S06 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workspace/generateText` | 3613 | S14 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S06 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workspace/cancelGenerateText` | 3614 | S14 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S06 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `provider/testModelConnectivity` | 3615 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E11](#s07-实现证据索引)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `mcp/list` | 3616 | S09 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/list` | 3617 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/referenceCatalog` | 3618 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/referenceCatalogWithCategory` | 3619 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `skills/referenceCatalog` | 3620 | S09 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `workflows/list` | 3622 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `workflows/get` | 3623 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `workflows/updateMeta` | 3624 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `workflows/delete` | 3625 | S12 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `workflows/runs` | 3626 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `workflows/move` | 3628 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `plugins/resolveSuggestedReference` | 3629 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/setEnabled` | 3630 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/overview` | 3631 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/marketplace/add` | 3632 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/marketplace/remove` | 3633 | S09 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `plugins/marketplace/update` | 3634 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/install` | 3635 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/cancelOperation` | 3636 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/uninstall` | 3637 | S09 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `plugins/update` | 3638 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/restoreBuiltin` | 3639 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/configure` | 3640 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/resetConfig` | 3641 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/validate` | 3642 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `plugins/describe` | 3643 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E13](#s07-实现证据索引)；S06 catalog UI→strict CatalogClient→官方 Host facade；删除入口禁用 |
| `automation/create` | 3644 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 部分（S06） | [E07](#s07-实现证据索引)；官方 Host cron GUI 子集可达/已测；targetTaskId、botDeliveryTarget、interval/intervalUnit 显式拒绝 |
| `automation/update` | 3645 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 部分（S06） | [E07](#s07-实现证据索引)；官方 Host cron GUI 子集可达/已测；targetTaskId、botDeliveryTarget、interval/intervalUnit 显式拒绝 |
| `automation/checkTaskBinding` | 3646 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E07](#s07-实现证据索引)；官方 Host 列表/绑定 read、off-peak 显式 create；不发明调度或 entitlement |
| `automation/list` | 3647 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E07](#s07-实现证据索引)；官方 Host 列表/绑定 read、off-peak 显式 create；不发明调度或 entitlement |
| `automation/delete` | 3648 | S13 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `offPeak/create` | 3650 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E07](#s07-实现证据索引)；官方 Host 列表/绑定 read、off-peak 显式 create；不发明调度或 entitlement |
| `offPeak/list` | 3651 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 | 已实现（S06） | [E07](#s07-实现证据索引)；官方 Host 列表/绑定 read、off-peak 显式 create；不发明调度或 entitlement |
| `usage/stats` | 3654 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E11](#s07-实现证据索引)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `session/usage` | 3657 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E11](#s07-实现证据索引)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `process/childProcesses` | 3659 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E11](#s07-实现证据索引)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `interaction/requestPermission` | 3660 | S05 | reverse interaction；基础UI在S03，高级合同S05 | Y | Y | Y | S02 | 已实现（S02） | [E01](#s07-实现证据索引)；native approval waterfall→resolveInteraction accept/decline/cancel；仲裁仅 assumed-single-answerer |
| `interaction/requestUserInput` | 3661 | S05 | reverse interaction；基础UI在S03，高级合同S05 | Y | Y | Y | S02 | 未实现（S02） | [E01](#s07-实现证据索引)；ZCodeAgent.ask 仅接 permission；userInput 明确 interaction-mapping-unavailable |
| `interaction/requestProviderRuntimeHeaders` | 3662 | S01 | reverse auth；正式凭据来源待实测，非登录API；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `interaction/requestOfficialMcpAuthHeaders` | 3663 | S01 | reverse auth；保留official origin trust边界；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `interaction/browserList` | 3665 | S11 | reverse browser host责任；不得忽略；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | Y | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `interaction/browserExecute` | 3666 | S11 | reverse browser host责任；不得自动换MCP；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | Y | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
## legacy-notifications

源码：`packages/shared/src/zcode-protocol/index.ts`，声明 `zcodeProtocolNotifications`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `startup/storageState` | 336 | S01 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `interaction/providerRuntimeHeadersCancelled` | 337 | S01 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `process/mcpTelemetry` | 338 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `process/mcpResourceSamples` | 339 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `process/toolExecResource` | 340 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `plugins/operationProgress` | 341 | S09 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮；S06 通过官方 Host facade（非 stdio 正向直调） | Y | N（内部往返） | N（随所属入口） | S06 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `process/resourceSample` | 342 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
## v4-methods

源码：`packages/shared/src/zcode-protocol-v4/transport.ts`，声明 `V4_METHODS`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `v4/connection/flow` | 333 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/controller/subscribe` | 334 | S04 | 声明存在；本次未定位直接CLI handler，不推定stdio可调；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S04 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/controller/resync` | 335 | S04 | 声明存在；本次未定位直接CLI handler，不推定stdio可调；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S04 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/controller/unsubscribe` | 336 | S04 | 声明存在；本次未定位直接CLI handler，不推定stdio可调；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S04 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/conversation/subscribe` | 337 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/conversation/resync` | 338 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/conversation/unsubscribe` | 339 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/conversation/rowsRange` | 341 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 部分（S02） | [E08](#s07-实现证据索引)；保留资源 helper/旧测试；active relay 无该查询映射，当前 native GUI 未消费 |
| `v4/conversation/plans` | 343 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留资源 helper/旧测试；active relay 无该查询映射，当前 native GUI 未消费 |
| `v4/conversation/fileChanges` | 344 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留资源 helper/旧测试；active relay 无该查询映射，当前 native GUI 未消费 |
| `v4/conversation/backgroundBashOutput` | 345 | S10 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留资源 helper/旧测试；active relay 无该查询映射，当前 native GUI 未消费 |
| `v4/conversation/fileRewindPreview` | 346 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留资源 helper/旧测试；active relay 无该查询映射，当前 native GUI 未消费 |
| `v4/conversation/workflowRunEvents` | 349 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRuns` | 350 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunArtifacts` | 356 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunArtifactData` | 357 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunArtifactRead` | 358 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunWorkspace` | 361 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/conversation/workflowRunNodeResult` | 362 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow UI→schema 校验/官方 Host workspace 路由；run read 与 receipt 分离 |
| `v4/usage/stats` | 366 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E11](#s07-实现证据索引)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `v4/conversation/usage` | 367 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E11](#s07-实现证据索引)；官方 Host usage/process/显式 connectivity；测试模型按钮仅 mock 验证 |
| `v4/attachment/begin` | 370 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E12](#s07-实现证据索引)；S06 attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/chunk` | 371 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E12](#s07-实现证据索引)；S06 attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/commit` | 372 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E12](#s07-实现证据索引)；S06 attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/abort` | 373 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E12](#s07-实现证据索引)；S06 attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/read` | 375 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E12](#s07-实现证据索引)；S06 attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/conversation/attachmentRead` | 377 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E12](#s07-实现证据索引)；S06 attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/conversation/attachmentStat` | 379 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E12](#s07-实现证据索引)；S06 attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/attachment/previewSource` | 381 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E12](#s07-实现证据索引)；S06 attachment UI→严格 session/claim/revision/epoch→官方 Host upload/read/abort |
| `v4/commands/query` | 382 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/command` | 383 | S03 | dispatcher，不等于其34种payload已实现；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
## v4-notifications

源码：`packages/shared/src/zcode-protocol-v4/transport.ts`，声明 `V4_NOTIFICATIONS`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `v4/conversation/frame` | 409 | S03 | 嵌套topic/row/delta/wire还需展开 | Y | Y | Y | S02 | 已实现（S02） | [E01](#s07-实现证据索引)；订阅保留 ACK/frame reservation；snapshot/delta 投影至 native 文本/工具/审批；非所有 row 变体全覆盖 |
| `v4/telemetry/event` | 411 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/telemetry/local-ttft` | 412 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `v4/cua/permission-observation` | 414 | S11 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | Y | N | 延期（D5） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
## v4-commands

源码：`packages/shared/src/zcode-protocol-v4/command.ts`，声明 `commandPayloadSchemas`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner | 当前实现（归属） | 代码/测试证据与差距 |
|---|---:|---|---|---|---|---|---|---|---|
| `createSession` | 46 | S02 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E01](#s07-实现证据索引)；官方 v4 create/firstInput、sendText、stop；legacy 功能经 v4 等价路由 |
| `createSelectionSideSession` | 69 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留 history/management helper/旧测试；active relay command allowlist 拒绝，无当前 DSH 对等入口 |
| `sendText` | 81 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E01](#s07-实现证据索引)；官方 v4 create/firstInput、sendText、stop；legacy 功能经 v4 等价路由 |
| `sendGoalCommand` | 135 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S06 | 已实现（S06） | [E05](#s07-实现证据索引)；会话附件输入区纯文本 /goal 经 inputSubmission→官方 goal intent；ACK 不代表目标完成 |
| `stop` | 144 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E01](#s07-实现证据索引)；官方 v4 create/firstInput、sendText、stop；legacy 功能经 v4 等价路由 |
| `compact` | 150 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留 history/management helper/旧测试；active relay command allowlist 拒绝，无当前 DSH 对等入口 |
| `forkAssistant` | 152 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留 history/management helper/旧测试；active relay command allowlist 拒绝，无当前 DSH 对等入口 |
| `applyFileRewind` | 153 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留 history/management helper/旧测试；active relay command allowlist 拒绝，无当前 DSH 对等入口 |
| `editUserQuery` | 154 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留 history/management helper/旧测试；active relay command allowlist 拒绝，无当前 DSH 对等入口 |
| `retryTurn` | 161 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留 history/management helper/旧测试；active relay command allowlist 拒绝，无当前 DSH 对等入口 |
| `setAssistantFeedback` | 162 | S08 | carrier/handler及UI语义按所属节核实；TASK-S06 明确反馈入口归 S06 | Y | Y | Y | S06 | 已实现（S06） | [E05](#s07-实现证据索引)；S06 assistant row feedback；revision/epoch/target admission，经 S04 durable receipt |
| `sendQueuedNow` | 166 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E04](#s07-实现证据索引)；S04 native dock 编辑/立即发送；官方回执与原始 input ID、队列内容以官方为准 |
| `editQueueItem` | 167 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E04](#s07-实现证据索引)；S04 native dock 编辑/立即发送；官方回执与原始 input ID、队列内容以官方为准 |
| `reorderQueueItem` | 169 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S02 | 已实现（S02） | [E05](#s07-实现证据索引)；S06 会话 dock 消费；durable S04 control/ACK，不乐观改写官方状态 |
| `deleteQueueItem` | 173 | S06 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `setAutoDrain` | 174 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S02 | 已实现（S02） | [E05](#s07-实现证据索引)；S06 会话 dock 消费；durable S04 control/ACK，不乐观改写官方状态 |
| `resolveInteraction` | 176 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 部分（S02） | [E01](#s07-实现证据索引)；permission 闭合；多题/freeText/userInput 当前未接 native UI |
| `respondWorkspaceHookReview` | 189 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 | 部分（S05） | [E09](#s07-实现证据索引)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `toggleWorkspaceHookReviewItem` | 192 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 | 部分（S05） | [E09](#s07-实现证据索引)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `revokeWorkspaceHookTrust` | 196 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 | 部分（S05） | [E09](#s07-实现证据索引)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `requestWorkspaceHookReview` | 203 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 | 部分（S05） | [E09](#s07-实现证据索引)；保留严格 hook helper/旧测试；active relay 无 trustGrant 映射且拒绝 review commands，当前 UI 未接 |
| `snoozeInteractionAutoResolution` | 205 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 部分（S02） | [E09](#s07-实现证据索引)；保留交互 helper/旧测试；active relay 拒绝且当前 native UI 无暂停自动结束入口 |
| `switchModelConfig` | 208 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E03](#s07-实现证据索引)；官方模型/强度 picker→identity/effort 校验→switchModelConfig；确认后持久化 |
| `switchCollaborationMode` | 215 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 部分（S02） | [E03](#s07-实现证据索引)；create/send 携带 mode 且 relay 允许 switchCollaborationMode；当前 runtime/面板未提供切换 mode 的路由入口 |
| `setFollowupMode` | 218 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 | 已实现（S02） | [E05](#s07-实现证据索引)；S06 会话 dock 消费；durable S04 control/ACK，不乐观改写官方状态 |
| `pauseGoal` | 219 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S02 | 已实现（S02） | [E05](#s07-实现证据索引)；S06 会话 dock 消费；durable S04 control/ACK，不乐观改写官方状态 |
| `resumeGoal` | 220 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S02 | 已实现（S02） | [E05](#s07-实现证据索引)；S06 会话 dock 消费；durable S04 control/ACK，不乐观改写官方状态 |
| `cancelBackgroundWork` | 221 | S10 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 部分（S06） | [E06](#s07-实现证据索引)；当前 workflow run Cancel 经 cancelBackgroundWork；Bash/subagent 目录和取消入口未接 |
| `resumeWorkflowRun` | 228 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow run UI→S04 durable control→官方 Host；ACK 是回执 |
| `startSavedWorkflow` | 236 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow run UI→S04 durable control→官方 Host；ACK 是回执 |
| `amendWorkflowRunSettings` | 243 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 | 已实现（S06） | [E06](#s07-实现证据索引)；S06 workflow run UI→S04 durable control→官方 Host；ACK 是回执 |
| `renameSession` | 244 | S04 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 已实现（S03） | [E02](#s07-实现证据索引)；官方 catalog 镜像/刷新、官方重命名与 🅩 前缀 |
| `deleteSession` | 245 | S04 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） | —（随所属入口/已批准延期，保留新Owner） | 非独立必做；不作实现完成声明 |
| `discardSharedContext` | 246 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 | 部分（S03） | [E08](#s07-实现证据索引)；保留 history/management helper/旧测试；active relay command allowlist 拒绝，无当前 DSH 对等入口 |

## 五表之外仍需完成的普查

| 面 | 开发归属 | 闭合条件 |
|---|---|---|
| startup控制帧、session/event等表外字面消息 | S01/S03 | 实际producer/dispatcher与消费者检索，不仅枚举常量表 |
| hello/clientHello、协商可信位、连接profile与continuous/replayable | S01/S03 | 真实carrier证明；不能每条transport都发送同一握手 |
| command envelope、ACK/result、errors、revision/epoch | S03/S04/S06/S08 | 成功/错误/重复/丢响应与原生状态变化相符 |
| frame topics、wire分片、delta ops、rows、snapshots、tool displays | S03/S05/S10/S11/S12 | 每个实存变体有decode/投影/consumer或有证据的非适用理由 |
| attachments/shared context的字节与来源权限 | S07 | 真实上传/read/abort与跨session拒绝 |
| plugin/MCP/skills/workflow/automation/offPeak嵌套结构及门禁 | S09/S12/S13 | 不只顶层method成功；操作结果、progress和GUI及denial齐全 |
| remote authority与host反向端口 | S01/S11/S15 | 正式身份、路由和运行位置已证实，不做私有协议旁路 |
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

## S06 归属落盘与证据边界

- 150 个声明行全部保留（74/7/31/4/34），OldOwner 不改写；新归属以 D5 + D3 + TASK-S06 为准。
- `外露=Y` 表示 S01 已确认的官方 Host/CLI/反向或通知载体；它不是本节 live 执行证据。内部往返依所属入口追踪，不独立造按钮。
- S06 入口：Plugins → @dsh-zcode/bridge 配置页；Settings → Zcode Bridge；ZCode 会话 composer dock → workflows/feedback/attachments/queue preferences。既有官方 model picker 保持原生。
- workspace/readPresentation 按 D5 归 S06 必做，repair wave 1 修正 TASK-S06 的误写并交付只读呈现入口；browser/computer-use/trajectory 按 D5 延期。删除/卸载/移除入口按 D3/TASK-S06 禁止。
- workspace off-peak/dynamic-workflow policy 是官方 Host 内部 entitlement 同步，辅助 generation/cancel 是官方 GUI 辅助请求内部链，不伪造独立配置状态或另造内部按钮。
- 本节 mock/headless/浏览器及包验证见 `.agent-work/handoffs/S06.md`；真实模型调用预算 0。S07 继续维护实现差距/安装版本差异；S08 执行 npm-installed official DSH 最终只读验收与人工写入清单。

## S07 实现证据索引

审计代码基线：`91f0c92`（S02–S06），2026-10-05。150 行及声明/源行/OldOwner/新Owner/必做均保留；110 个必做行逐行标注。已实现/部分/未实现是**当前官方 DSH 可达功能**的状态，不是静态匹配、测试计数或 live 对等验收结论。

- **已实现**：当前 UI/注册 Agent consumer 可达、生产 owner 路由/校验与行为测试存在；legacy 同功能转 v4/Host 时逐行明示，不能据此宣称 legacy wire 直调已接。Live/非全量 variant 限制保留。
- **部分**：保留 helper/旧测试而 active relay 不放行，或当前 GUI/参数/交互只覆盖部分功能。旧 fork UI 与未执行的 `.dsh.spec.ts` 不构成当前入口证据。
- **未实现**：仅声明/schema，或当前 owner 明确拒绝且无完成所需 consumer。
- 新Owner 是已批准责任归属；S04/S06 后续消费写在证据列，不改派 owner。S07 只记录差距，**未实现任何上述缺口**。S08 必须处理本计划必做残留或获得需求层裁决；本表没有擅自新增延期。

| 证据 | 当前生产 owner / consumer | 已存在的可执行行为测试；限制 |
|---|---|---|
| E01 | [zcode-agent](packages/host/zcode-agent.mjs)、[zcode-runtime](packages/host/zcode-runtime.mjs)、[execution relay](packages/host/launcher/execution.mjs)、[mirror-history](packages/host/mirror-history.mjs) | [s02-runtime](tests/s02-runtime.test.mjs)、[s03-create](tests/s03-create.test.mjs)、[s03-repair1](tests/s03-repair1.test.mjs)、[s03-repair2](tests/s03-repair2.test.mjs)、[s02-repair](tests/s02-repair.test.mjs)；permission-only，完整历史/非文本 row 不据此宣称完成 |
| E02 | [zcode-runtime](packages/host/zcode-runtime.mjs)、[mirror-guards](packages/host/mirror-guards.mjs) | [s03-directory](tests/s03-directory.test.mjs)、[s03-repair1](tests/s03-repair1.test.mjs)、[group-focus](tests/group-focus.test.mjs)；mock/native-consumer，真实 rename 不在本节验证 |
| E03 | [model-selection](packages/host/model-selection.mjs)、[mirror-guards](packages/host/mirror-guards.mjs)、[runtime-controls](packages/client/runtime-controls.mjs) | [s02-q1-final](tests/s02-q1-final.test.mjs)、[s03-create](tests/s03-create.test.mjs)；模型发现真实 read 见 S03 handoff；mode 切换无当前 consumer |
| E04 | [mirror-lifecycle](packages/host/mirror-lifecycle.mjs)、[zcode-agent](packages/host/zcode-agent.mjs)、[RuntimeLifecycleDock](packages/client/runtime-controls.mjs) | [s04-lifecycle](tests/s04-lifecycle.test.mjs)、[s04-client](tests/s04-client.test.mjs)；mock 与 saved-real renderer；跨进程仲裁未证实 |
| E05 | [parity command owner](packages/host/parity.mjs)、[session panels](packages/client/parity-controls.jsx)、[input-controls](packages/client/input-controls.mjs) | [s06-parity](tests/s06-parity.test.mjs)、[s06-parity-ui](tests/s06-parity-ui.test.mjs)、[s06-repair1](tests/s06-repair1.test.mjs)；mock/React，不是 live 写验收 |
| E06 | [workflow](packages/host/workflow.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[workflow panel](packages/client/workflow-view.jsx) | [s06-parity](tests/s06-parity.test.mjs)、[s06-parity-ui](tests/s06-parity-ui.test.mjs)、[s06-repair1](tests/s06-repair1.test.mjs)；所有七个 run query 的 workspace 身份已测，真实 run 写未验证 |
| E07 | [automation](packages/host/automation.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[automation panel](packages/client/parity-controls.jsx) | [s06-parity](tests/s06-parity.test.mjs)、[s06-parity-ui](tests/s06-parity-ui.test.mjs)、[s06-repair1](tests/s06-repair1.test.mjs)；保留 partial update 字段，create/update unsupported 字段明确拒绝 |
| E08 | [conversation helpers](packages/host/conversation.mjs) 对照 [active relay](packages/host/launcher/execution.mjs)、[mirror guards](packages/host/mirror-guards.mjs)、[active panels](packages/client/parity-controls.jsx) | [s08-history](tests/s08-history.test.mjs)、[s10-work](tests/s10-work.test.mjs) 等旧编号 helper mock 仍执行；不等于本计划 S08 已实现/当前 UI 可达；relay 缺映射/拒绝命令是 gap 证据 |
| E09 | [conversation hook/interaction helpers](packages/host/conversation.mjs) 对照 [active relay](packages/host/launcher/execution.mjs) | [s05-commands](tests/s05-commands.test.mjs) 为旧编号 helper 检查；新 S05 launcher/trust 不改该 owner，当前 consumer 未接 |
| E10 | [parity](packages/host/parity.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[workspace/preferences panels](packages/client/parity-controls.jsx) | [s06-parity](tests/s06-parity.test.mjs)、[s06-parity-ui](tests/s06-parity-ui.test.mjs)、[s06-repair1](tests/s06-repair1.test.mjs)；presentation retry 与 active-workspace 设置语义 |
| E11 | [insights](packages/host/insights.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[DiagnosticsExtras](packages/client/parity-controls.jsx) | [s06-parity](tests/s06-parity.test.mjs)、[s06-parity-ui](tests/s06-parity-ui.test.mjs)；本节真实 connectivity/model calls=0 |
| E12 | [attachment](packages/host/attachment.mjs)、[conversation](packages/host/conversation.mjs)、[AttachmentPanel](packages/client/parity-controls.jsx)、[parity](packages/host/parity.mjs) | [s07-attachment](tests/s07-attachment.test.mjs)、[s07-preview](tests/s07-preview.test.mjs) 为旧编号 helper 检查；当前消费者有 [s06-parity](tests/s06-parity.test.mjs)、[s06-parity-ui](tests/s06-parity-ui.test.mjs)、[s06-repair1](tests/s06-repair1.test.mjs)；真实上传未执行 |
| E13 | [catalog](packages/host/catalog.mjs)、[Host parity](packages/host/launcher/parity.mjs)、[catalog panel](packages/client/catalog-view.jsx) | [s06-parity](tests/s06-parity.test.mjs)、[s06-parity-ui](tests/s06-parity-ui.test.mjs)；官方 facade 别名见 launcher 表，不冒充 stdio 直调 |

安装版逐行声明核对和升级结果：[protocol-diff-3.14.4](docs/protocol-diff-3.14.4.md)。`必做=N` 行保留批准的 D3/D5 决策及内部从属语义；没有添加删除/卸载/移除入口。五表之外旧编号普查清单是历史调查面，不能作为本计划 S07 的新功能实施授权。

S07 必做当前状态计数（声明行，不是协议总数/产品覆盖率）：已实现 77；部分 31；未实现 2。所有真实写验收及 npm-installed official DSH read-only browser 验收仍归 S08。
