# Installed ZCode 3.14.4 declaration diff — protocol-audit

Checked 2026-10-05 against bridge `91f0c92`, `reference/ZCode@29628c9`, and the read-only installed `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs`. The rebound root ledger supplies the 150 declaration identities. No installed JS was evaluated, imported or executed; no official Host/helper was launched. Source is a reference, the installed artifact is the target.

| Result | Declaration rows |
|---|---:|
| Verified identical within the declaration comparison below | 150 |
| Diverged (key, wire name, inline payload shape) | 0 |
| Installed-only in the five located tables | 0 |
| Source-only in the five located tables | 0 |

These are declaration rows across different layers, not 150 independent protocols or a runtime support percentage. **Identical** means property keys + string wire literals for four constant tables (116 rows), and keys + inline payload schema expressions for the 34 command rows. Method/notification declarations contain no request/result schema; their matching literals cannot establish those schemas, handlers, carrier reachability, authentication or GUI parity. The named command-schema dependencies checked below are additional bounded static evidence, not a full bundle equivalence claim.

## Artifact identity and method

- App bundle ID: `dev.zcode.app`; Info.plist version `3.14.4`, build `3.14.4.7912` (PlistBuddy reads only).
- Runtime bytes: **14820968**; SHA-256 `fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`.
- Source root `package.json` reports **3.14.3**, while installed Info.plist reports **3.14.4**: a version-metadata divergence, outside the 150 declarations. Source CLI package reports **0.16.9** (a separate package version, not the App version). Neither source metadata value is used to promote or classify the installed verified tuple.
- Five AST candidates resolved uniquely (one per table); TypeScript **6.0.3**, parse diagnostics: **0**. Scanner reads source/bundle and writes its report; it never evaluates the installed artifact.
- Command expression comparison removes comments, whitespace, TypeScript-only syntax and minifier identifier spellings; esbuild syntax normalization handles source `if` versus emitted boolean short-circuit refinements. It does not run the expressions. Enum members, field names, nesting, optional/nullable/strict/min/max and refinement conditions remain part of the comparison.
- Each row below binds the source symbol/property and line to its installed property UTF-16 offset. Installed line/column for table locations is included because the bundle is minified. Offsets are UTF-16 code units, not byte offsets.
- Source-versus-installed declaration divergences: **none found within these five tables**. Minified local identifiers are recorded separately; they are not wire renames or missing API entries. This does not claim that the source repository and installed App are identical outside this boundary.

Read-only rerun from the parent workspace (already installed TypeScript; no package install):

```sh
node scripts/inspect-protocol.cjs --source reference/ZCode \
  --runtime /Applications/ZCode.app/Contents/Resources/glm/zcode.cjs \
  --out .agent-work/tmp/protocol-audit/static-report.json \
  --typescript .agent-work/tmp/dsh-official/node_modules/typescript/lib/typescript.js
```

The inline shape comparison, dependency bindings and real metadata render are retained as `../.agent-work/tmp/protocol-audit/shapes.cjs`, `shapes.json`, `real-check.mjs`, `real-check.json`, and `real-settings.html`. The declaration inspector's `DECLARATION_TABLES_MATCH` verdict alone checks keys/literals, so the command shapes were separately inspected below.

## Per-row differences

`none` explicitly means no missing/key/wire-name delta for constants, or no key/inline-payload-shape delta for commands. All 150 source-line/OldOwner tuples are preserved in [PROTOCOL-COVERAGE](protocol-coverage.md); the source property names below are retained even where the ledger displays a wire literal.

### legacy-methods

Source `packages/shared/src/zcode-protocol/index.ts` / `zcodeProtocolMethods`; source 74 / installed 74. Installed table line 72, column 186230, offset 784219; one candidate.

| Ledger declaration | Source property : line | Installed property offset | Missing / name / shape differences |
|---|---|---:|---|
| `runtime/capabilities` | `runtimeCapabilities` : 3564 | 784220 | none |
| `computer-use/operation-event` | `computerUseOperationEvent` : 3565 | 784263 | none |
| `session/create` | `sessionCreate` : 3566 | 784320 | none |
| `session/resume` | `sessionResume` : 3567 | 784351 | none |
| `session/list` | `sessionList` : 3568 | 784382 | none |
| `session/subagents` | `sessionSubagents` : 3569 | 784409 | none |
| `session/requestRuntimePreferences` | `sessionRequestRuntimePreferences` : 3570 | 784446 | none |
| `session/read` | `sessionRead` : 3571 | 784515 | none |
| `session/messages` | `sessionMessages` : 3572 | 784542 | none |
| `session/events` | `sessionEvents` : 3573 | 784577 | none |
| `session/debug` | `sessionDebug` : 3574 | 784608 | none |
| `session/subscribe` | `sessionSubscribe` : 3575 | 784637 | none |
| `session/send` | `sessionSend` : 3578 | 784674 | none |
| `session/stop` | `sessionStop` : 3581 | 784701 | none |
| `session/cancelBackgroundTask` | `sessionCancelBackgroundTask` : 3584 | 784728 | none |
| `session/fork` | `sessionFork` : 3588 | 784787 | none |
| `session/compact` | `sessionCompact` : 3589 | 784814 | none |
| `session/goal` | `sessionGoal` : 3590 | 784847 | none |
| `session/close` | `sessionClose` : 3591 | 784874 | none |
| `session/setModel` | `sessionSetModel` : 3594 | 784903 | none |
| `session/setThoughtLevel` | `sessionSetThoughtLevel` : 3598 | 784938 | none |
| `session/setMode` | `sessionSetMode` : 3599 | 784987 | none |
| `workspace/readPresentation` | `workspaceReadPresentation` : 3600 | 785020 | none |
| `workspace/hooks/trustGrant` | `workspaceHookTrustGrant` : 3601 | 785075 | none |
| `provider/updateAccountConfig` | `providerUpdateAccountConfig` : 3603 | 785128 | none |
| `workspace/updateInteractionPreferences` | `workspaceUpdateInteractionPreferences` : 3604 | 785187 | none |
| `workspace/updateModelIoPreferences` | `workspaceUpdateModelIoPreferences` : 3605 | 785266 | none |
| `workspace/updateOffPeakToolPolicy` | `workspaceUpdateOffPeakToolPolicy` : 3608 | 785337 | none |
| `workspace/updateDynamicWorkflowPolicy` | `workspaceUpdateDynamicWorkflowPolicy` : 3610 | 785406 | none |
| `workspace/generateText` | `workspaceGenerateText` : 3613 | 785483 | none |
| `workspace/cancelGenerateText` | `workspaceCancelGenerateText` : 3614 | 785530 | none |
| `provider/testModelConnectivity` | `providerTestModelConnectivity` : 3615 | 785589 | none |
| `mcp/list` | `mcpList` : 3616 | 785652 | none |
| `plugins/list` | `pluginsList` : 3617 | 785671 | none |
| `plugins/referenceCatalog` | `pluginsReferenceCatalog` : 3618 | 785698 | none |
| `plugins/referenceCatalogWithCategory` | `pluginsReferenceCatalogWithCategory` : 3619 | 785749 | none |
| `skills/referenceCatalog` | `skillsReferenceCatalog` : 3620 | 785824 | none |
| `workflows/list` | `workflowsList` : 3622 | 785873 | none |
| `workflows/get` | `workflowsGet` : 3623 | 785904 | none |
| `workflows/updateMeta` | `workflowsUpdateMeta` : 3624 | 785933 | none |
| `workflows/delete` | `workflowsDelete` : 3625 | 785976 | none |
| `workflows/runs` | `workflowsRuns` : 3626 | 786011 | none |
| `workflows/move` | `workflowsMove` : 3628 | 786042 | none |
| `plugins/resolveSuggestedReference` | `pluginsResolveSuggestedReference` : 3629 | 786073 | none |
| `plugins/setEnabled` | `pluginsSetEnabled` : 3630 | 786142 | none |
| `plugins/overview` | `pluginsOverview` : 3631 | 786181 | none |
| `plugins/marketplace/add` | `pluginsMarketplaceAdd` : 3632 | 786216 | none |
| `plugins/marketplace/remove` | `pluginsMarketplaceRemove` : 3633 | 786264 | none |
| `plugins/marketplace/update` | `pluginsMarketplaceUpdate` : 3634 | 786318 | none |
| `plugins/install` | `pluginsInstall` : 3635 | 786372 | none |
| `plugins/cancelOperation` | `pluginsCancelOperation` : 3636 | 786405 | none |
| `plugins/uninstall` | `pluginsUninstall` : 3637 | 786454 | none |
| `plugins/update` | `pluginsUpdate` : 3638 | 786491 | none |
| `plugins/restoreBuiltin` | `pluginsRestoreBuiltin` : 3639 | 786522 | none |
| `plugins/configure` | `pluginsConfigure` : 3640 | 786569 | none |
| `plugins/resetConfig` | `pluginsResetConfig` : 3641 | 786606 | none |
| `plugins/validate` | `pluginsValidate` : 3642 | 786647 | none |
| `plugins/describe` | `pluginsDescribe` : 3643 | 786682 | none |
| `automation/create` | `automationCreate` : 3644 | 786717 | none |
| `automation/update` | `automationUpdate` : 3645 | 786754 | none |
| `automation/checkTaskBinding` | `automationCheckTaskBinding` : 3646 | 786791 | none |
| `automation/list` | `automationList` : 3647 | 786848 | none |
| `automation/delete` | `automationDelete` : 3648 | 786881 | none |
| `offPeak/create` | `offPeakCreate` : 3650 | 786918 | none |
| `offPeak/list` | `offPeakList` : 3651 | 786949 | none |
| `usage/stats` | `usageStats` : 3654 | 786976 | none |
| `session/usage` | `sessionUsage` : 3657 | 787001 | none |
| `process/childProcesses` | `processChildProcesses` : 3659 | 787030 | none |
| `interaction/requestPermission` | `interactionRequestPermission` : 3660 | 787077 | none |
| `interaction/requestUserInput` | `interactionRequestUserInput` : 3661 | 787138 | none |
| `interaction/requestProviderRuntimeHeaders` | `interactionRequestProviderRuntimeHeaders` : 3662 | 787197 | none |
| `interaction/requestOfficialMcpAuthHeaders` | `interactionRequestOfficialMcpAuthHeaders` : 3663 | 787282 | none |
| `interaction/browserList` | `interactionBrowserList` : 3665 | 787367 | none |
| `interaction/browserExecute` | `interactionBrowserExecute` : 3666 | 787416 | none |

### legacy-notifications

Source `packages/shared/src/zcode-protocol/index.ts` / `zcodeProtocolNotifications`; source 7 / installed 7. Installed table line 72, column 137921, offset 735910; one candidate.

| Ledger declaration | Source property : line | Installed property offset | Missing / name / shape differences |
|---|---|---:|---|
| `startup/storageState` | `storageStartup` : 336 | 735911 | none |
| `interaction/providerRuntimeHeadersCancelled` | `providerRuntimeHeadersCancelled` : 337 | 735949 | none |
| `process/mcpTelemetry` | `mcpTelemetry` : 338 | 736027 | none |
| `process/mcpResourceSamples` | `mcpResourceSamples` : 339 | 736063 | none |
| `process/toolExecResource` | `toolExecResource` : 340 | 736111 | none |
| `plugins/operationProgress` | `pluginOperationProgress` : 341 | 736155 | none |
| `process/resourceSample` | `processResourceSample` : 342 | 736207 | none |

### v4-methods

Source `packages/shared/src/zcode-protocol-v4/transport.ts` / `V4_METHODS`; source 31 / installed 31. Installed table line 98, column 54904, offset 1123034; one candidate.

| Ledger declaration | Source property : line | Installed property offset | Missing / name / shape differences |
|---|---|---:|---|
| `v4/connection/flow` | `connectionFlow` : 333 | 1123035 | none |
| `v4/controller/subscribe` | `controllerSubscribe` : 334 | 1123071 | none |
| `v4/controller/resync` | `controllerResync` : 335 | 1123117 | none |
| `v4/controller/unsubscribe` | `controllerUnsubscribe` : 336 | 1123157 | none |
| `v4/conversation/subscribe` | `conversationSubscribe` : 337 | 1123207 | none |
| `v4/conversation/resync` | `conversationResync` : 338 | 1123257 | none |
| `v4/conversation/unsubscribe` | `conversationUnsubscribe` : 339 | 1123301 | none |
| `v4/conversation/rowsRange` | `conversationRowsRange` : 341 | 1123355 | none |
| `v4/conversation/plans` | `conversationPlans` : 343 | 1123405 | none |
| `v4/conversation/fileChanges` | `conversationFileChanges` : 344 | 1123447 | none |
| `v4/conversation/backgroundBashOutput` | `backgroundBashOutput` : 345 | 1123501 | none |
| `v4/conversation/fileRewindPreview` | `conversationFileRewindPreview` : 346 | 1123561 | none |
| `v4/conversation/workflowRunEvents` | `conversationWorkflowRunEvents` : 349 | 1123627 | none |
| `v4/conversation/workflowRuns` | `conversationWorkflowRuns` : 350 | 1123693 | none |
| `v4/conversation/workflowRunArtifacts` | `conversationWorkflowRunArtifacts` : 356 | 1123749 | none |
| `v4/conversation/workflowRunArtifactData` | `conversationWorkflowRunArtifactData` : 357 | 1123821 | none |
| `v4/conversation/workflowRunArtifactRead` | `conversationWorkflowRunArtifactRead` : 358 | 1123899 | none |
| `v4/conversation/workflowRunWorkspace` | `conversationWorkflowRunWorkspace` : 361 | 1123977 | none |
| `v4/conversation/workflowRunNodeResult` | `conversationWorkflowRunNodeResult` : 362 | 1124049 | none |
| `v4/usage/stats` | `usageStats` : 366 | 1124123 | none |
| `v4/conversation/usage` | `conversationUsage` : 367 | 1124151 | none |
| `v4/attachment/begin` | `attachmentBegin` : 370 | 1124193 | none |
| `v4/attachment/chunk` | `attachmentChunk` : 371 | 1124231 | none |
| `v4/attachment/commit` | `attachmentCommit` : 372 | 1124269 | none |
| `v4/attachment/abort` | `attachmentAbort` : 373 | 1124309 | none |
| `v4/attachment/read` | `attachmentRead` : 375 | 1124347 | none |
| `v4/conversation/attachmentRead` | `conversationAttachmentRead` : 377 | 1124383 | none |
| `v4/conversation/attachmentStat` | `conversationAttachmentStat` : 379 | 1124443 | none |
| `v4/attachment/previewSource` | `attachmentPreviewSource` : 381 | 1124503 | none |
| `v4/commands/query` | `commandsQuery` : 382 | 1124557 | none |
| `v4/command` | `command` : 383 | 1124591 | none |

### v4-notifications

Source `packages/shared/src/zcode-protocol-v4/transport.ts` / `V4_NOTIFICATIONS`; source 4 / installed 4. Installed table line 98, column 56698, offset 1124828; one candidate.

| Ledger declaration | Source property : line | Installed property offset | Missing / name / shape differences |
|---|---|---:|---|
| `v4/conversation/frame` | `conversationFrame` : 409 | 1124829 | none |
| `v4/telemetry/event` | `conversationTelemetryFact` : 411 | 1124871 | none |
| `v4/telemetry/local-ttft` | `localTtftFacts` : 412 | 1124918 | none |
| `v4/cua/permission-observation` | `cuaPermissionObservation` : 414 | 1124959 | none |

### v4-commands

Source `packages/shared/src/zcode-protocol-v4/command.ts` / `commandPayloadSchemas`; source 34 / installed 34. Installed table line 98, column 71758, offset 1139888; one candidate.

| Ledger declaration | Source property : line | Installed property offset | Missing / name / shape differences |
|---|---|---:|---|
| `createSession` | `createSession` : 46 | 1139889 | none |
| `createSelectionSideSession` | `createSelectionSideSession` : 69 | 1140253 | none |
| `sendText` | `sendText` : 81 | 1140385 | none |
| `sendGoalCommand` | `sendGoalCommand` : 135 | 1141548 | none |
| `stop` | `stop` : 144 | 1141854 | none |
| `compact` | `compact` : 150 | 1141930 | none |
| `forkAssistant` | `forkAssistant` : 152 | 1141951 | none |
| `applyFileRewind` | `applyFileRewind` : 153 | 1141987 | none |
| `editUserQuery` | `editUserQuery` : 154 | 1142025 | none |
| `retryTurn` | `retryTurn` : 161 | 1142171 | none |
| `setAssistantFeedback` | `setAssistantFeedback` : 162 | 1142203 | none |
| `sendQueuedNow` | `sendQueuedNow` : 166 | 1142293 | none |
| `editQueueItem` | `editQueueItem` : 167 | 1142342 | none |
| `reorderQueueItem` | `reorderQueueItem` : 169 | 1142410 | none |
| `deleteQueueItem` | `deleteQueueItem` : 173 | 1142502 | none |
| `setAutoDrain` | `setAutoDrain` : 174 | 1142553 | none |
| `resolveInteraction` | `resolveInteraction` : 176 | 1142600 | none |
| `respondWorkspaceHookReview` | `respondWorkspaceHookReview` : 189 | 1142845 | none |
| `toggleWorkspaceHookReviewItem` | `toggleWorkspaceHookReviewItem` : 192 | 1142899 | none |
| `revokeWorkspaceHookTrust` | `revokeWorkspaceHookTrust` : 196 | 1143001 | none |
| `requestWorkspaceHookReview` | `requestWorkspaceHookReview` : 203 | 1143110 | none |
| `snoozeInteractionAutoResolution` | `snoozeInteractionAutoResolution` : 205 | 1143141 | none |
| `switchModelConfig` | `switchModelConfig` : 208 | 1143210 | none |
| `switchCollaborationMode` | `switchCollaborationMode` : 215 | 1143296 | none |
| `setFollowupMode` | `setFollowupMode` : 218 | 1143376 | none |
| `pauseGoal` | `pauseGoal` : 219 | 1143435 | none |
| `resumeGoal` | `resumeGoal` : 220 | 1143458 | none |
| `cancelBackgroundWork` | `cancelBackgroundWork` : 221 | 1143482 | none |
| `resumeWorkflowRun` | `resumeWorkflowRun` : 228 | 1143533 | none |
| `startSavedWorkflow` | `startSavedWorkflow` : 236 | 1143608 | none |
| `amendWorkflowRunSettings` | `amendWorkflowRunSettings` : 243 | 1143757 | none |
| `renameSession` | `renameSession` : 244 | 1143786 | none |
| `deleteSession` | `deleteSession` : 245 | 1143829 | none |
| `discardSharedContext` | `discardSharedContext` : 246 | 1143856 | none |

## Command payload shape evidence

All 34 normalized inline expressions matched. The installed spellings in the next table bind source schema references; matching a referenced identifier alone is not sufficient evidence, so its declaration expression was also inspected. 22 schema dependency expressions were traversed: 20 normalized AST/token comparisons matched; two hook-review refinement expressions required explicit local/helper-name normalization and static control-flow inspection. `addDuplicateItemIssue` at `workspace-hook-review.ts:199` corresponds to installed `XVt` at offset 688829: both add the same custom issue at the same path only when `new Set(values).size !== values.length`. The trust-revoke callback's second local parameter spelling (`s`/`t`) is a minifier delta; field/refinement behavior is unchanged. No shape divergence is inferred from that spelling.

| Source schema binding | Installed binding | Source file : line | Installed initializer offset | Difference |
|---|---|---|---:|---|
| `attachmentRefSchema` | `Mpe` | `packages/shared/src/zcode-protocol-v4/attachment-ref.ts` : 4 | 648298 | none (normalized) |
| `modelSelectionSchema` | `Pu` | `packages/shared/src/model-selection.ts` : 4 | 508947 | none (normalized) |
| `submissionModeSchema` | `Npe` | `packages/shared/src/zcode-protocol-v4/submission.ts` : 4 | 648450 | none (normalized) |
| `createSessionRequestedConfigSchema` | `Les` | `packages/shared/src/zcode-protocol-v4/command.ts` : 30 | 1139642 | none (normalized) |
| `zcodeProtocolMcpServerSchema` | `Ype` | `packages/shared/src/zcode-protocol/index.ts` : 629 | 741188 | none (normalized) |
| `zcodeBrowserAmbientContextSchema` | `xYe` | `packages/shared/src/zcode-protocol/index.ts` : 1723 | 759593 | none (normalized) |
| `sharedContextRefSchema` | `NZe` | `packages/shared/src/zcode-protocol-v4/shared-context-ref.ts` : 3 | 648519 | none (normalized) |
| `modelExecutionSchema` | `QZe` | `packages/shared/src/model-execution.ts` : 4 | 700437 | none (normalized) |
| `zcodeAutomationBotDeliveryTargetSchema` | `Wpe` | `packages/shared/src/bots.ts` : 41 | 703359 | none (normalized) |
| `conversationRowTargetSchema` | `NR` | `packages/shared/src/zcode-protocol-v4/core.ts` : 10 | 646735 | none (normalized) |
| `workspaceHookReviewCommandTargetSchema` | `XZe` | `packages/shared/src/zcode-protocol-v4/workspace-hook-review.ts` : 33 | 689497 | none (normalized) |
| `workspaceHookReviewDecisionSchema` | `Nee` | `packages/shared/src/zcode-protocol-v4/workspace-hook-review.ts` : 20 | 689303 | none (manual helper/local-name normalization) |
| `workspaceHookTrustRevokeTargetSchema` | `Ior` | `packages/shared/src/zcode-protocol-v4/workspace-hook-review.ts` : 50 | 689670 | none (manual helper/local-name normalization) |
| `requestWorkspaceHookReviewTargetSchema` | `Cor` | `packages/shared/src/zcode-protocol-v4/workspace-hook-review.ts` : 67 | 689900 | none (normalized) |
| `amendWorkflowRunSettingsPayloadSchema` | `Y0r` | `packages/shared/src/zcode-protocol-v4/workflow-run-settings-command.ts` : 15 | 1138462 | none (normalized) |
| `nonEmptyString` | `Dn` | `packages/shared/src/zcode-protocol/index.ts` : 84 | 732351 | none (normalized) |
| `zcodeProtocolMcpEntrySchema` | `Bir` | `packages/shared/src/zcode-protocol/index.ts` : 600 | 740796 | none (normalized) |
| `zcodeProtocolMcpOAuthSchema` | `C5i` | `packages/shared/src/zcode-protocol/index.ts` : 607 | 740846 | none (normalized) |
| `nonEmptyStringSchema` | `eh` | `packages/shared/src/zcode-protocol-v4/workspace-hook-review.ts` : 4 | 689037 | none (normalized) |
| `sha256DigestSchema` | `zpe` | `packages/shared/src/zcode-protocol-v4/workspace-hook-review.ts` : 7 | 689133 | none (normalized) |
| `positiveIntegerSchema` | `qAe` | `packages/shared/src/zcode-protocol-v4/workspace-hook-review.ts` : 5 | 689066 | none (normalized) |
| `WORKFLOW_RUNS_LIMITS` | `$a` | `packages/shared/src/zcode-protocol-v4/workflow-runs.ts` : 14 | 665330 | none (normalized) |

Normalized inline expression for each command (installed symbol spellings; syntax-only normalization, never executed):

`createSession` — source/installed identical, offset 1139889:

```js
let result=m.object({workspaceId:m.string(),firstInput:m.object({text:m.string(),attachments:m.array(Mpe).optional(),modelSelection:Pu.optional(),mode:Npe.optional(),planEnabled:m.boolean().optional()}).optional(),config:Les.optional(),mcpServers:m.array(Ype).optional(),offPeakToolEnabled:m.boolean().optional(),dynamicWorkflowEnabled:m.boolean().optional()});
```

`createSelectionSideSession` — source/installed identical, offset 1140253:

```js
let result=m.object({firstInput:m.object({text:m.string().trim().min(1),modelSelection:Pu.optional()}).optional()});
```

`sendText` — source/installed identical, offset 1140385:

```js
let result=m.object({text:m.string(),attachments:m.array(Mpe).optional(),requestedDelivery:m.enum(["startNow","queue","guide"]).optional(),browserAmbientContext:xYe.optional(),context_refs:m.array(NZe).max(1).optional(),heldQueueDisposition:m.enum(["clearQueueAndSend","keepQueueAndSend"]).optional(),expectedHeldQueueItemIds:m.array(m.string().min(1)).optional(),modelSelection:Pu.optional(),mode:Npe.optional(),planEnabled:m.boolean().optional(),modelExecution:QZe.optional(),automationId:m.string().min(1).optional(),offPeakTaskId:m.string().min(1).optional(),offPeakRunType:m.enum(["init","resume"]).optional(),botDeliveryTarget:Wpe.optional(),toolDisallowlist:m.array(m.string().min(1)).optional()}).superRefine((e,o)=>{e.automationId&&e.offPeakTaskId&&o.addIssue({code:m.ZodIssueCode.custom,message:"automationId and offPeakTaskId are mutually exclusive"}),e.offPeakRunType&&!e.offPeakTaskId&&o.addIssue({code:m.ZodIssueCode.custom,message:"offPeakRunType requires offPeakTaskId",path:["offPeakRunType"]}),e.modelExecution&&!e.modelSelection&&o.addIssue({code:m.ZodIssueCode.custom,message:"modelExecution requires modelSelection",path:["modelExecution"]})});
```

`sendGoalCommand` — source/installed identical, offset 1141548:

```js
let result=m.object({text:m.string(),displayText:m.string().optional(),modelSelection:Pu.optional(),mode:Npe.optional(),planEnabled:m.boolean().optional(),heldQueueDisposition:m.enum(["clearQueueAndSend","keepQueueAndSend"]).optional(),expectedHeldQueueItemIds:m.array(m.string().min(1)).optional()});
```

`stop` — source/installed identical, offset 1141854:

```js
let result=m.object({expectedForegroundExecutionId:m.string().min(1).optional()});
```

`compact` — source/installed identical, offset 1141930:

```js
let result=m.object({});
```

`forkAssistant` — source/installed identical, offset 1141951:

```js
let result=m.object({target:NR});
```

`applyFileRewind` — source/installed identical, offset 1141987:

```js
let result=m.object({target:NR});
```

`editUserQuery` — source/installed identical, offset 1142025:

```js
let result=m.object({target:NR,newText:m.string(),attachments:m.array(Mpe).optional(),workspaceMode:m.enum(["preserve","rewind"]).optional()});
```

`retryTurn` — source/installed identical, offset 1142171:

```js
let result=m.object({target:NR});
```

`setAssistantFeedback` — source/installed identical, offset 1142203:

```js
let result=m.object({target:NR,feedback:m.enum(["like","dislike"]).nullable()});
```

`sendQueuedNow` — source/installed identical, offset 1142293:

```js
let result=m.object({queueItemId:m.string()});
```

`editQueueItem` — source/installed identical, offset 1142342:

```js
let result=m.object({queueItemId:m.string(),newText:m.string()});
```

`reorderQueueItem` — source/installed identical, offset 1142410:

```js
let result=m.object({queueItemId:m.string(),beforeQueueItemId:m.string().nullable()});
```

`deleteQueueItem` — source/installed identical, offset 1142502:

```js
let result=m.object({queueItemId:m.string()});
```

`setAutoDrain` — source/installed identical, offset 1142553:

```js
let result=m.object({autoDrain:m.boolean()});
```

`resolveInteraction` — source/installed identical, offset 1142600:

```js
let result=m.object({interactionId:m.string(),answer:m.object({optionId:m.string().optional(),freeText:m.string().optional(),action:m.enum(["accept","decline","cancel"]).optional(),content:m.record(m.string(),m.unknown()).optional()})});
```

`respondWorkspaceHookReview` — source/installed identical, offset 1142845:

```js
let result=XZe.extend({decision:Nee});
```

`toggleWorkspaceHookReviewItem` — source/installed identical, offset 1142899:

```js
let result=XZe.extend({reviewItemId:m.string().trim().min(1),enabled:m.boolean()});
```

`revokeWorkspaceHookTrust` — source/installed identical, offset 1143001:

```js
let result=m.union([XZe.extend({reviewItemIds:m.array(m.string().trim().min(1)).min(1)}),Ior]);
```

`requestWorkspaceHookReview` — source/installed identical, offset 1143110:

```js
let result=Cor;
```

`snoozeInteractionAutoResolution` — source/installed identical, offset 1143141:

```js
let result=m.object({interactionId:m.string()});
```

`switchModelConfig` — source/installed identical, offset 1143210:

```js
let result=m.object({provider:m.string(),model:m.string(),thought:m.string()});
```

`switchCollaborationMode` — source/installed identical, offset 1143296:

```js
let result=m.object({mode:m.enum(["build","edit","plan","yolo"])});
```

`setFollowupMode` — source/installed identical, offset 1143376:

```js
let result=m.object({mode:m.enum(["queue","guide"])});
```

`pauseGoal` — source/installed identical, offset 1143435:

```js
let result=m.object({});
```

`resumeGoal` — source/installed identical, offset 1143458:

```js
let result=m.object({});
```

`cancelBackgroundWork` — source/installed identical, offset 1143482:

```js
let result=m.object({workId:m.string()});
```

`resumeWorkflowRun` — source/installed identical, offset 1143533:

```js
let result=m.object({workId:m.string(),name:m.string().optional()});
```

`startSavedWorkflow` — source/installed identical, offset 1143608:

```js
let result=m.object({name:m.string().min(1),scope:m.enum(["project","global"]).optional(),args:m.record(m.string(),m.unknown()).optional()});
```

`amendWorkflowRunSettings` — source/installed identical, offset 1143757:

```js
let result=Y0r;
```

`renameSession` — source/installed identical, offset 1143786:

```js
let result=m.object({title:m.string()});
```

`deleteSession` — source/installed identical, offset 1143829:

```js
let result=m.object({});
```

`discardSharedContext` — source/installed identical, offset 1143856:

```js
let result=m.object({contextId:m.string().trim().min(1)}).strict();
```

## Bridge naming and implementation differences

The absence of source/installed declaration differences does **not** mean every declaration is currently routed. Bridge facade aliases predate protocol-audit and are intentional translation points, separate from the source/installed audit:

| Declaration wire | Bridge peer alias → official Host facade |
|---|---|
| `plugins/overview` | `plugins/overview` → `getPluginsOverview` |
| `plugins/cancelOperation` | `plugins/cancelOperation` → `cancelPluginOperation` |
| `plugins/resetConfig` | `plugins/resetConfig` → `resetPluginConfig` |
| `plugins/validate` | `plugins/validate` → `validatePlugin` |
| `plugins/describe` | `plugins/describe` → `describePlugin` |

Wire spellings above match source and installed. The ledger binds the string wire, while the **source property's symbolic name** may be different (for example `pluginsOverview`, `pluginsCancelOperation`, `pluginsResetConfig`). These are property versus value identities, not protocol renames. [Host parity routing](../packages/host/launcher/parity.mjs) is the authoritative bridge translation table.

The current implementation ledger has **110 mandatory rows: 77 implemented, 31 partial, 2 unimplemented**, each with its approved owner and code/test evidence. Partial includes remaining old helpers whose current launcher carrier denies the request, not merely unfinished live verification. [Coverage status and evidence](protocol-coverage.md#protocol-coverage-index) records each gap. protocol-audit made no feature, route, isolation, compatibility-policy or verified-tuple changes.

## Upgrade exercise and current installed check

[Mock tests](../tests/protocol-upgrade.test.mjs) pass **4/4** through production BridgeHost status projection and existing React components, with injected inspection and process fixtures:

1. Baseline 3.14.4 tuple → `verified`; version visible, no upgrade/identity/core warning, details not forced open.
2. Same 3.14.4/build, simulated SHA-256 `000…000` → `identity-mismatch`, `verified=false`, `digestMatches=false`; the existing details open and show “unverified build or digest”. Digest drift alone does not fabricate core incompatibility.
3. Simulated 3.15.0/build/digest → `newer-unverified`; banner uses `highestVerified=3.14.4`. Local dismissal cannot verify the tuple.
4. Changed digest plus an invalid core session-list shape → identity warning **and** core incompatible notice, `blocksNewSideEffects=true`; attempted send rejects `runtime-incompatible` before any mock dispatch.

Read-only real check: current installed plist/build/digest exactly matches `VERIFIED_VERSIONS`; `compatibilityProjection` returns **verified / exact-verified-tuple**, `digestMatches=true`, `highestVerified=3.14.4`, `bannerRequired=false`. Rendering the **production** version notice and settings components with this measured tuple displays 3.14.4 and no identity/upgrade warning. This is an offline render over real static installation facts: no connected browser/Host health or new live runtime acceptance is claimed. Calling `inspectInstallation` would launch the Helper probe, so the check read only plist + bundle bytes instead.

closure-acceptance still owns npm-installed official DSH read-only browser acceptance, human write checklist, mandatory partial/unimplemented reconciliation, broader schemas/row variants outside this declaration comparison, and cross-process arbitration evidence. Approved deletion/deferral decisions remain unchanged; no delete entry was added. Real model calls, official commands and protected Host launches in protocol-audit: **0**.

## Recorded suite and boundaries

Final `npm test`: **444 tests / 444 pass / 0 fail / 0 skipped / 0 cancelled**, Node **v26.5.0**, npm **11.17.0** (`../.agent-work/tmp/protocol-audit/full-suite-final.log`). Initial full run: **444 tests / 443 pass / 1 fail / 0 skipped**; the existing settings-panel readPresentation ledger test required Owner to be the final Markdown column. It now asserts the same exposure/GUI/mandatory/owner values by column, retaining the OldOwner/no-deferral assertions while allowing protocol-audit's appended status/evidence columns. No production behavior changed.

Both root/bridge coverage copies are byte-identical. All original 150 declaration/source-line/OldOwner/exposure/GUI/mandatory/newOwner tuples are unchanged; 110 mandatory statuses are annotated. Both reference repositories have empty porcelain. Sandbox/HOME/process/isolation owners and installed artifact remain untouched. No push.
