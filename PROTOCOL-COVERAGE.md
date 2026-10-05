# 协议声明基线与开发归属

**这是静态入口清单，不是已支持/已运行协议清单。** 基于用户上传的ZCode source与官方cjs，用只读AST比较五类声明。静态匹配只表示所查 key/literal 一致，不表示 live 验证或本计划完整对等完成。实现/运行证据与此归属表分开维护。

每行绑定来源文件和line，`新Owner` 引用当前 PLAN-FULL 的 S01–S08；`OldOwner` 保留旧 S01–S16 历史编号。归属依据为 REQUIREMENTS D5 批准的 S01-PARITY-ASSIGNMENT，D3 删除裁决及 TASK-S06 明确的延期优先。正式方向/carrier/handler/schema/GUI需要在所属section追踪；不把源码共享类型表当CLI可达证明。没有官方GUI入口的内部协议只实现正确内部行为，不强造按钮。

| 类别 | 源码声明数 | bundle对应数 | 静态结论 |
|---|---:|---:|---|
| legacy-methods | 74 | 74 | key/literal matched（commands仅key） |
| legacy-notifications | 7 | 7 | key/literal matched（commands仅key） |
| v4-methods | 31 | 31 | key/literal matched（commands仅key） |
| v4-notifications | 4 | 4 | key/literal matched（commands仅key） |
| v4-commands | 34 | 34 | key/literal matched（commands仅key） |

不能将不同层级项简单相加当“协议总数”，也不能从此得出实现覆盖率。版本 banner/安装是 S07/S08 的产品能力，并非上述协议表项。

## legacy-methods

源码：`packages/shared/src/zcode-protocol/index.ts`，声明 `zcodeProtocolMethods`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner |
|---|---:|---|---|---|---|---|---|
| `runtime/capabilities` | 3564 | S01 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 |
| `computer-use/operation-event` | 3565 | S11 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | Y | N | 延期（D5） |
| `session/create` | 3566 | S02 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `session/resume` | 3567 | S04 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `session/list` | 3568 | S04 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `session/subagents` | 3569 | S10 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `session/requestRuntimePreferences` | 3570 | S06 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 |
| `session/read` | 3571 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `session/messages` | 3572 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `session/events` | 3573 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 |
| `session/debug` | 3574 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `session/subscribe` | 3575 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 |
| `session/send` | 3578 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `session/stop` | 3581 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `session/cancelBackgroundTask` | 3584 | S10 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `session/fork` | 3588 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S04 |
| `session/compact` | 3589 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S04 |
| `session/goal` | 3590 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `session/close` | 3591 | S04 | 产品生命周期；绝不能作connection dispose；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S03 |
| `session/setModel` | 3594 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `session/setThoughtLevel` | 3598 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `session/setMode` | 3599 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `workspace/readPresentation` | 3600 | S06 | D5 批准归 S06；官方 Host readWorkspacePresentation；只读工作区 mode/slash commands 入口（修正 TASK-S06 误写） | Y | Y | Y | S06 |
| `workspace/hooks/trustGrant` | 3601 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 |
| `provider/updateAccountConfig` | 3603 | S01 | 不可据此推断提供login/token取得能力；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 |
| `workspace/updateInteractionPreferences` | 3604 | S06 | carrier/handler及UI语义按所属节核实；官方 GUI 的 setting.update → syncAppRuntimePreferences；作用于官方 active workspaces | Y | Y | Y | S06 |
| `workspace/updateModelIoPreferences` | 3605 | S06 | carrier/handler及UI语义按所属节核实；官方 GUI 的 setting.update → syncAppRuntimePreferences；作用于官方 active workspaces | Y | Y | Y | S06 |
| `workspace/updateOffPeakToolPolicy` | 3608 | S13 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S06 |
| `workspace/updateDynamicWorkflowPolicy` | 3610 | S12 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S06 |
| `workspace/generateText` | 3613 | S14 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S06 |
| `workspace/cancelGenerateText` | 3614 | S14 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S06 |
| `provider/testModelConnectivity` | 3615 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `mcp/list` | 3616 | S09 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `plugins/list` | 3617 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/referenceCatalog` | 3618 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/referenceCatalogWithCategory` | 3619 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `skills/referenceCatalog` | 3620 | S09 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `workflows/list` | 3622 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `workflows/get` | 3623 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `workflows/updateMeta` | 3624 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `workflows/delete` | 3625 | S12 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） |
| `workflows/runs` | 3626 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `workflows/move` | 3628 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `plugins/resolveSuggestedReference` | 3629 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/setEnabled` | 3630 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/overview` | 3631 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/marketplace/add` | 3632 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/marketplace/remove` | 3633 | S09 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） |
| `plugins/marketplace/update` | 3634 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/install` | 3635 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/cancelOperation` | 3636 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/uninstall` | 3637 | S09 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） |
| `plugins/update` | 3638 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/restoreBuiltin` | 3639 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/configure` | 3640 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/resetConfig` | 3641 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/validate` | 3642 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `plugins/describe` | 3643 | S09 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `automation/create` | 3644 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `automation/update` | 3645 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `automation/checkTaskBinding` | 3646 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `automation/list` | 3647 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `automation/delete` | 3648 | S13 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） |
| `offPeak/create` | 3650 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `offPeak/list` | 3651 | S13 | carrier/handler及UI语义按所属节核实；S06 通过官方 Host facade（非 stdio 正向直调） | Y | Y | Y | S06 |
| `usage/stats` | 3654 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `session/usage` | 3657 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `process/childProcesses` | 3659 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `interaction/requestPermission` | 3660 | S05 | reverse interaction；基础UI在S03，高级合同S05 | Y | Y | Y | S02 |
| `interaction/requestUserInput` | 3661 | S05 | reverse interaction；基础UI在S03，高级合同S05 | Y | Y | Y | S02 |
| `interaction/requestProviderRuntimeHeaders` | 3662 | S01 | reverse auth；正式凭据来源待实测，非登录API；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 |
| `interaction/requestOfficialMcpAuthHeaders` | 3663 | S01 | reverse auth；保留official origin trust边界；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 |
| `interaction/browserList` | 3665 | S11 | reverse browser host责任；不得忽略；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | Y | N | 延期（D5） |
| `interaction/browserExecute` | 3666 | S11 | reverse browser host责任；不得自动换MCP；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | Y | N | 延期（D5） |
## legacy-notifications

源码：`packages/shared/src/zcode-protocol/index.ts`，声明 `zcodeProtocolNotifications`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner |
|---|---:|---|---|---|---|---|---|
| `startup/storageState` | 336 | S01 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 |
| `interaction/providerRuntimeHeadersCancelled` | 337 | S01 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S05 |
| `process/mcpTelemetry` | 338 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） |
| `process/mcpResourceSamples` | 339 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） |
| `process/toolExecResource` | 340 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） |
| `plugins/operationProgress` | 341 | S09 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮；S06 通过官方 Host facade（非 stdio 正向直调） | Y | N（内部往返） | N（随所属入口） | S06 |
| `process/resourceSample` | 342 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） |
## v4-methods

源码：`packages/shared/src/zcode-protocol-v4/transport.ts`，声明 `V4_METHODS`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner |
|---|---:|---|---|---|---|---|---|
| `v4/connection/flow` | 333 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 |
| `v4/controller/subscribe` | 334 | S04 | 声明存在；本次未定位直接CLI handler，不推定stdio可调；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S04 |
| `v4/controller/resync` | 335 | S04 | 声明存在；本次未定位直接CLI handler，不推定stdio可调；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S04 |
| `v4/controller/unsubscribe` | 336 | S04 | 声明存在；本次未定位直接CLI handler，不推定stdio可调；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S04 |
| `v4/conversation/subscribe` | 337 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 |
| `v4/conversation/resync` | 338 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 |
| `v4/conversation/unsubscribe` | 339 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 |
| `v4/conversation/rowsRange` | 341 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `v4/conversation/plans` | 343 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `v4/conversation/fileChanges` | 344 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `v4/conversation/backgroundBashOutput` | 345 | S10 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `v4/conversation/fileRewindPreview` | 346 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `v4/conversation/workflowRunEvents` | 349 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/conversation/workflowRuns` | 350 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/conversation/workflowRunArtifacts` | 356 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/conversation/workflowRunArtifactData` | 357 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/conversation/workflowRunArtifactRead` | 358 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/conversation/workflowRunWorkspace` | 361 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/conversation/workflowRunNodeResult` | 362 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/usage/stats` | 366 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/conversation/usage` | 367 | S14 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/attachment/begin` | 370 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/attachment/chunk` | 371 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/attachment/commit` | 372 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/attachment/abort` | 373 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/attachment/read` | 375 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/conversation/attachmentRead` | 377 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/conversation/attachmentStat` | 379 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/attachment/previewSource` | 381 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `v4/commands/query` | 382 | S03 | carrier/handler及UI语义按所属节核实；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 |
| `v4/command` | 383 | S03 | dispatcher，不等于其34种payload已实现；内部载体随所属能力，不另造按钮 | Y | N（内部往返） | N（随所属入口） | S02 |
## v4-notifications

源码：`packages/shared/src/zcode-protocol-v4/transport.ts`，声明 `V4_NOTIFICATIONS`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner |
|---|---:|---|---|---|---|---|---|
| `v4/conversation/frame` | 409 | S03 | 嵌套topic/row/delta/wire还需展开 | Y | Y | Y | S02 |
| `v4/telemetry/event` | 411 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） |
| `v4/telemetry/local-ttft` | 412 | S14 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | N（内部） | N | 延期（D5） |
| `v4/cua/permission-observation` | 414 | S11 | carrier/handler及UI语义按所属节核实；D5/TASK-S06 批准延期；不以替代入口宣称完成 | Y | Y | N | 延期（D5） |
## v4-commands

源码：`packages/shared/src/zcode-protocol-v4/command.ts`，声明 `commandPayloadSchemas`。

| 声明项 | 源码行 | OldOwner | 路径/边界提醒 | 外露 | GUI入口 | 必做 | 新Owner |
|---|---:|---|---|---|---|---|---|
| `createSession` | 46 | S02 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `createSelectionSideSession` | 69 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `sendText` | 81 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `sendGoalCommand` | 135 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S06 |
| `stop` | 144 | S03 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `compact` | 150 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `forkAssistant` | 152 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `applyFileRewind` | 153 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `editUserQuery` | 154 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `retryTurn` | 161 | S08 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `setAssistantFeedback` | 162 | S08 | carrier/handler及UI语义按所属节核实；TASK-S06 明确反馈入口归 S06 | Y | Y | Y | S06 |
| `sendQueuedNow` | 166 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `editQueueItem` | 167 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `reorderQueueItem` | 169 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S02 |
| `deleteQueueItem` | 173 | S06 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） |
| `setAutoDrain` | 174 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S02 |
| `resolveInteraction` | 176 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `respondWorkspaceHookReview` | 189 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 |
| `toggleWorkspaceHookReviewItem` | 192 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 |
| `revokeWorkspaceHookTrust` | 196 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 |
| `requestWorkspaceHookReview` | 203 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S05 |
| `snoozeInteractionAutoResolution` | 205 | S05 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `switchModelConfig` | 208 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `switchCollaborationMode` | 215 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `setFollowupMode` | 218 | S06 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S02 |
| `pauseGoal` | 219 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S02 |
| `resumeGoal` | 220 | S06 | carrier/handler及UI语义按所属节核实；S06 加法 UI 消费，保留 D5 协议 owner | Y | Y | Y | S02 |
| `cancelBackgroundWork` | 221 | S10 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `resumeWorkflowRun` | 228 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `startSavedWorkflow` | 236 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `amendWorkflowRunSettings` | 243 | S12 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S06 |
| `renameSession` | 244 | S04 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |
| `deleteSession` | 245 | S04 | carrier/handler及UI语义按所属节核实；D3/TASK-S06：DSH 不提供删除/卸载/移除入口 | Y | Y | N | 延期（D3） |
| `discardSharedContext` | 246 | S07 | carrier/handler及UI语义按所属节核实 | Y | Y | Y | S03 |

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
