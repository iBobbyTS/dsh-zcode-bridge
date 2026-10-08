# official-runtime-install carrier inventory

Source: ZCode 29628c9; official cjs digest matched fad4c35…6275f. This is carrier classification, not live coverage. CLI dispatch=server.ts:461–714; reverse consumers=zcodeAgentService.ts. Handler result schemas live beside each method in shared/zcode-protocol/index.ts or v4/transport.ts. GUI consumers use IZCodeAgentService/connection scope, not raw CLI names.

| Family | Method | Carrier evidence |
|---|---|---|
| legacy | `runtime/capabilities` | stdio (CLI dispatch, STATIC) |
| legacy | `computer-use/operation-event` | reverse notification; Host consumer zcodeAgentService.ts:1951 → GUI/Host executor (STATIC) |
| legacy | `session/create` | stdio (CLI dispatch, STATIC) |
| legacy | `session/resume` | stdio (CLI dispatch, STATIC) |
| legacy | `session/list` | stdio (CLI dispatch, STATIC) |
| legacy | `session/subagents` | stdio (CLI dispatch, STATIC) |
| legacy | `session/requestRuntimePreferences` | reverse (official Host consumer, STATIC) |
| legacy | `session/read` | stdio (CLI dispatch, STATIC) |
| legacy | `session/messages` | stdio (CLI dispatch, STATIC) |
| legacy | `session/events` | stdio (CLI dispatch, STATIC) |
| legacy | `session/debug` | stdio (CLI dispatch, STATIC) |
| legacy | `session/subscribe` | stdio (CLI dispatch, STATIC) |
| legacy | `session/send` | stdio (CLI dispatch, STATIC) |
| legacy | `session/stop` | stdio (CLI dispatch, STATIC) |
| legacy | `session/cancelBackgroundTask` | stdio (CLI dispatch, STATIC) |
| legacy | `session/fork` | stdio (CLI dispatch, STATIC) |
| legacy | `session/compact` | stdio (CLI dispatch, STATIC) |
| legacy | `session/goal` | stdio (CLI dispatch, STATIC) |
| legacy | `session/close` | stdio (CLI dispatch, STATIC) |
| legacy | `session/setModel` | stdio (CLI dispatch, STATIC) |
| legacy | `session/setThoughtLevel` | stdio (CLI dispatch, STATIC) |
| legacy | `session/setMode` | stdio (CLI dispatch, STATIC) |
| legacy | `workspace/readPresentation` | stdio (CLI dispatch, STATIC) |
| legacy | `workspace/hooks/trustGrant` | stdio (CLI dispatch, STATIC) |
| legacy | `provider/updateAccountConfig` | stdio (CLI dispatch, STATIC) |
| legacy | `workspace/updateInteractionPreferences` | stdio (CLI dispatch, STATIC) |
| legacy | `workspace/updateModelIoPreferences` | stdio (CLI dispatch, STATIC) |
| legacy | `workspace/updateOffPeakToolPolicy` | stdio (CLI dispatch, STATIC) |
| legacy | `workspace/updateDynamicWorkflowPolicy` | stdio (CLI dispatch, STATIC) |
| legacy | `workspace/generateText` | stdio (CLI dispatch, STATIC) |
| legacy | `workspace/cancelGenerateText` | stdio (CLI dispatch, STATIC) |
| legacy | `provider/testModelConnectivity` | stdio (CLI dispatch, STATIC) |
| legacy | `mcp/list` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/list` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/referenceCatalog` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/referenceCatalogWithCategory` | stdio (CLI dispatch, STATIC) |
| legacy | `skills/referenceCatalog` | stdio (CLI dispatch, STATIC) |
| legacy | `workflows/list` | stdio (CLI dispatch, STATIC) |
| legacy | `workflows/get` | stdio (CLI dispatch, STATIC) |
| legacy | `workflows/updateMeta` | stdio (CLI dispatch, STATIC) |
| legacy | `workflows/delete` | stdio (CLI dispatch, STATIC) |
| legacy | `workflows/runs` | stdio (CLI dispatch, STATIC) |
| legacy | `workflows/move` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/resolveSuggestedReference` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/setEnabled` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/overview` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/marketplace/add` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/marketplace/remove` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/marketplace/update` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/install` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/cancelOperation` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/uninstall` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/update` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/restoreBuiltin` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/configure` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/resetConfig` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/validate` | stdio (CLI dispatch, STATIC) |
| legacy | `plugins/describe` | stdio (CLI dispatch, STATIC) |
| legacy | `automation/create` | reverse (official Host consumer, STATIC) |
| legacy | `automation/update` | reverse (official Host consumer, STATIC) |
| legacy | `automation/checkTaskBinding` | reverse (official Host consumer, STATIC) |
| legacy | `automation/list` | reverse (official Host consumer, STATIC) |
| legacy | `automation/delete` | reverse (official Host consumer, STATIC) |
| legacy | `offPeak/create` | reverse (official Host consumer, STATIC) |
| legacy | `offPeak/list` | reverse (official Host consumer, STATIC) |
| legacy | `usage/stats` | stdio (CLI dispatch, STATIC) |
| legacy | `session/usage` | stdio (CLI dispatch, STATIC) |
| legacy | `process/childProcesses` | stdio (CLI dispatch, STATIC) |
| legacy | `interaction/requestPermission` | reverse (official Host consumer, STATIC) |
| legacy | `interaction/requestUserInput` | reverse (official Host consumer, STATIC) |
| legacy | `interaction/requestProviderRuntimeHeaders` | reverse (official Host consumer, STATIC) |
| legacy | `interaction/requestOfficialMcpAuthHeaders` | reverse (official Host consumer, STATIC) |
| legacy | `interaction/browserList` | reverse (official Host consumer, STATIC) |
| legacy | `interaction/browserExecute` | reverse (official Host consumer, STATIC) |
| v4 | `v4/connection/flow` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/controller/subscribe` | declared-not-reachable on app-server stdio; other carrier UNCONFIRMED |
| v4 | `v4/controller/resync` | declared-not-reachable on app-server stdio; other carrier UNCONFIRMED |
| v4 | `v4/controller/unsubscribe` | declared-not-reachable on app-server stdio; other carrier UNCONFIRMED |
| v4 | `v4/conversation/subscribe` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/resync` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/unsubscribe` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/rowsRange` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/plans` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/fileChanges` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/backgroundBashOutput` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/fileRewindPreview` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/workflowRunEvents` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/workflowRuns` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/workflowRunArtifacts` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/workflowRunArtifactData` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/workflowRunArtifactRead` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/workflowRunWorkspace` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/workflowRunNodeResult` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/usage/stats` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/usage` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/attachment/begin` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/attachment/chunk` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/attachment/commit` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/attachment/abort` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/attachment/read` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/attachmentRead` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/conversation/attachmentStat` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/attachment/previewSource` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/commands/query` | stdio (CLI dispatch, STATIC) |
| v4 | `v4/command` | stdio (CLI dispatch, STATIC) |

`helloConversationV4` / `initializeConversationV4`: host-only service RPC → zcodeAgentConnectionScope.ts:668–676 → ui/v4/agentV4ConnectionHandshake.ts:27–35. They are not CLI method names. Account login/logout/credential resolution are Host service capabilities, not inferred from provider/updateAccountConfig. The controller declarations have no CLI cases; -32601 probes recorded in official-runtime-install-PROBES.

## Notification carriers

Notifications below are STATIC classifications of the shared definitions; only startup/storageState was additionally observed LIVE.

| Family | Notification | Carrier |
|---|---|---|
| legacy | `startup/storageState` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| legacy | `interaction/providerRuntimeHeadersCancelled` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| legacy | `process/mcpTelemetry` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| legacy | `process/mcpResourceSamples` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| legacy | `process/toolExecResource` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| legacy | `plugins/operationProgress` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| legacy | `process/resourceSample` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| v4 | `v4/conversation/frame` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| v4 | `v4/telemetry/event` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| v4 | `v4/telemetry/local-ttft` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |
| v4 | `v4/cua/permission-observation` | app-server stdio notification / Host service forwarding; direction follows emitting handler, never a unary CLI request |

The 34 command keys use the `v4/command` envelope and its CLI dispatch (server.ts:565); they are not 34 extra stdio methods. Detailed per-command business owners remain in docs/protocol-coverage.md and later sections.
