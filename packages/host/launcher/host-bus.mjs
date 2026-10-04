/* Generated from Apache-2.0 ZCode@29628c9; see host-bus-SOURCES.json and ../vendor/zcode/LICENSE. */

// ../reference/ZCode/packages/shared/src/channels.ts
var HostMessageTypes = {
  DatabaseStartupControl: "database-startup-control",
  /** 初始化本地服务 */
  InitLocal: "init-local",
  /** main → window Host：在当前窗口建立一个远程 logical session */
  ConnectRemoteWorkspace: "connect-remote-workspace",
  /** main → window Host：取消尚未完成的远程连接 */
  CancelRemoteWorkspaceConnect: "cancel-remote-workspace-connect",
  /** main → window Host：为 logical session 绑定 canonical workspace 身份 */
  BindRemoteWorkspaceContext: "bind-remote-workspace-context",
  /** main → window Host：释放一个远程 logical session */
  DisposeRemoteWorkspaceSession: "dispose-remote-workspace-session",
  /** main → host：复用现有服务，对新的 RPC MessagePort 暴露服务 */
  AttachServicePort: "attach-service-port",
  /** main → host：精确释放一个 RPC MessagePort attachment */
  DetachServicePort: "detach-service-port",
  /** 窗口关闭，清理资源 */
  Dispose: "dispose",
  /** 广播消息中转 */
  Broadcast: "broadcast",
  /** main → host：跨窗口原子 claim 结果 */
  BroadcastClaimResult: "broadcast-claim-result",
  /** main → host：task realtime invalidation delivery */
  TaskRealtimeDeliver: "task-realtime-deliver",
  /** main → host：task run lease acquire result */
  TaskRunLeaseResult: "task-run-lease-result",
  /** main → host：deliver owner-only task command */
  TaskOwnerCommandDeliver: "task-owner-command-deliver",
  /** main → host：deliver owner command result to requester */
  TaskOwnerCommandResult: "task-owner-command-result",
  /** main → host：Bot 远端 workspace 重连结果 */
  BotRemoteWorkspaceReconnectResult: "bot-remote-workspace-reconnect-result",
  /** main → host：Bot 远端 workspace 连接状态查询结果 */
  BotRemoteWorkspaceConnectionStatusResult: "bot-remote-workspace-connection-status-result",
  /** main → host：Bot 远端 workspace runtime RPC 端口 */
  BotRemoteWorkspaceRuntimePort: "bot-remote-workspace-runtime-port",
  /** main → host：把 session message 投递到该 host 管理的目标 session */
  SessionMessageDeliver: "session-message-deliver",
  /** main → host：把 session message 投递结果回写到源 session */
  SessionMessageDeliveryResult: "session-message-delivery-result",
  /** main → host：反馈日志归档创建结果 */
  FeedbackLogArchiveResult: "feedback-log-archive-result",
  /** main → host：定时任务到点派发；会话内 cron 复用 targetTaskId，历史未绑定任务才建 session */
  CronRun: "cron-run",
  /** main → host：闲时任务派发；首跑 createTask 新建 session，续跑带 conversationId/sessionId resume */
  OffPeakRun: "off-peak-run",
  /** main → host：browser-use 命令执行结果（CDP 执行完回传，按 requestId 关联） */
  BrowserExecuteResult: "browser-execute-result",
  /** main → host：本地视频 canonical path 授权结果 */
  LocalMediaPreviewPathAuthorizeResult: "local-media-preview-path-authorize-result",
  /** Main → Host：全局前台 ZCode 窗口派生的 producer focus fact。 */
  CuaPipFocusChanged: "cua-pip-focus-changed",
  /** main → host：要求 Host 现读本地 Source，并同步指定 Remote Environment。 */
  ProviderProvisioningExecute: "provider-provisioning-execute",
  /** main → host：资源管理器请求 Host 采样其后代进程（Agent / MCP / 终端）的 CPU 与内存 */
  ResourceUsageSnapshotRequest: "resource-usage-snapshot-request",
  ResourceUsageSnapshotCancel: "resource-usage-snapshot-cancel"
};
var HostResponseTypes = {
  DatabaseStartupState: "database-startup-state",
  /** window Host → main：按 requestId 上报远程连接过程日志 */
  RemoteWorkspaceConnectionLog: "remote-workspace-connection-log",
  /** window Host → main：远程 logical session 已建立 */
  RemoteWorkspaceConnected: "remote-workspace-connected",
  /** window Host → main：远程 logical session 建立失败 */
  RemoteWorkspaceConnectFailed: "remote-workspace-connect-failed",
  /** window Host → main：已连接的远程 logical session 关闭 */
  RemoteWorkspaceClosed: "remote-workspace-closed",
  /** host 进程日志上报 */
  Log: "log",
  /** host 内拉起新的 agent 子进程 */
  AgentProcessSpawned: "agent-process-spawned",
  /** host 内 agent runtime 首次通过模型执行门禁 */
  AgentProcessReady: "agent-process-ready",
  /** host 内的 agent 子进程退出 */
  AgentProcessExited: "agent-process-exited",
  /** host 内的 agent 子进程启动失败 */
  AgentProcessError: "agent-process-error",
  AgentProcessException: "agent-process-exception",
  /** host → main：CLI 进程内自采样的 CPU / RSS */
  AgentResourceSample: "agent-resource-sample",
  /** host → main：Host 进程自身每 60 秒自采的 CPU / RSS / heap（资源遥测 host 角色的 heap 来源） */
  HostResourceSample: "host-resource-sample",
  /** host → main：CLI 内 MCP 进程生命周期与内存遥测 */
  McpTelemetry: "mcp-telemetry",
  McpResourceSamples: "mcp-resource-samples",
  ToolExecResource: "tool-exec-resource",
  /** 自动化 Host 首次输入 accepted 后报告新建 Session。 */
  SessionCreateTelemetry: "session-create-telemetry",
  /** host → main：资源管理器采样结果（按 requestId 关联） */
  ResourceUsageSnapshotResult: "resource-usage-snapshot-result",
  /** host 内当前正在执行 prompt 的 agent session 数量变化 */
  AgentRunningTaskCountChanged: "agent-running-task-count-changed",
  /** host 内指定 workspace 当前仍未 terminal 的 task 数量变化 */
  WorkspaceRunningTaskCountChanged: "workspace-running-task-count-changed",
  /** host → main：Windows desktop-local CUA turn 的操作提示状态 */
  CuaOperationState: "cua-operation-state",
  /** host → main：workspace generation 已可安全 attach */
  RemoteWorkspaceAcquired: "remote-workspace-acquired",
  /** 广播消息 */
  Broadcast: "broadcast",
  /** host → main：申请跨窗口原子 claim */
  BroadcastClaimRequest: "broadcast-claim-request",
  /** host → main：把临时 claim reservation 提交为永久 claim */
  BroadcastClaimCommit: "broadcast-claim-commit",
  /** host → main：按 token 释放尚未提交的 claim reservation */
  BroadcastClaimRelease: "broadcast-claim-release",
  /** host → main：发布 task realtime invalidation */
  TaskRealtimePublish: "task-realtime-publish",
  /** host → main：发布 task stream mirror op */
  TaskStreamOpPublish: "task-stream-op-publish",
  /** host → main：申请 task run lease */
  TaskRunLeaseAcquire: "task-run-lease-acquire",
  /** host → main：释放 task run lease */
  TaskRunLeaseRelease: "task-run-lease-release",
  /** host → main：observer 请求 owner 执行 task command */
  TaskOwnerCommandRequest: "task-owner-command-request",
  /** host → main：owner 返回 task command result */
  TaskOwnerCommandResult: "task-owner-command-result",
  /** host → main：Bot 请求创建远端 workspace session */
  BotRemoteWorkspaceReconnectRequest: "bot-remote-workspace-reconnect-request",
  /** host → main：Bot 查询当前窗口是否已有远端 workspace session */
  BotRemoteWorkspaceConnectionStatusRequest: "bot-remote-workspace-connection-status-request",
  /** host → main：Bot 请求远端 workspace runtime RPC 端口 */
  BotRemoteWorkspaceRuntimePortRequest: "bot-remote-workspace-runtime-port-request",
  /** host → main：Agent 请求向另一个 session 发送消息 */
  SessionMessageSendRequested: "session-message-send-requested",
  /** host → main：声明一个 ZCode Agent session 当前归属该 host */
  SessionRouteAnnounce: "session-route-announce",
  /** host → main：目标 host 完成本地 session message 投递 */
  SessionMessageDeliverResult: "session-message-deliver-result",
  /** host → main：请求 main 复用导出日志逻辑创建反馈日志归档 */
  FeedbackLogArchiveRequest: "feedback-log-archive-request",
  /** host → main：定时任务派发结果（成功回填 taskId/sessionId，失败带 transient/permanent） */
  CronRunResult: "cron-run-result",
  /** host → main：闲时任务派发结果（成功回填 conversationId/sessionId，失败带 transient/permanent） */
  OffPeakRunResult: "off-peak-run-result",
  /** host → main：manual run 已落库，请立即唤醒 scheduler 认领派发 */
  CronSchedulerWakeRequest: "cron-scheduler-wake-request",
  /** host → main：闲时任务翻 schedulable，请立即唤醒 scheduler 认领派发（与 cron 消息独立） */
  OffPeakSchedulerWakeRequest: "off-peak-scheduler-wake-request",
  /** host → main：执行一条 browser-use 命令（main 用 WebContentsView+CDP 执行，按 requestId 关联） */
  BrowserExecuteRequest: "browser-execute-request",
  /** host → main：请求授权 Agent 已精确校验的本地视频路径 */
  LocalMediaPreviewPathAuthorizeRequest: "local-media-preview-path-authorize-request",
  /** host → main：RPC 网络遥测批次（channel.command 成功率/耗时） */
  NetworkTelemetryBatch: "network-telemetry-batch",
  /** host → main：本地 Provisioning Source 成功持久化。 */
  ProviderProvisioningSourceChanged: "provider-provisioning-source-changed",
  /** host → main：一次 Remote Environment 同步执行完毕。 */
  ProviderProvisioningExecutionResult: "provider-provisioning-execution-result"
};

// ../reference/ZCode/packages/shared/src/database-startup.ts
import { z } from "zod";
var databaseStartupErrorCodeSchema = z.enum([
  "storage_full",
  "permission_denied",
  "io_error",
  "out_of_memory",
  "corrupt",
  "open_failed",
  "lock_timeout",
  "checksum_mismatch",
  "sql_failed",
  "startup_status_timeout",
  "transport_closed",
  "unsupported_runtime"
]);
var databaseStartupErrorDetailsSchema = z.object({
  sqliteCode: z.number().int().optional(),
  systemCode: z.string().max(64).optional(),
  migrationId: z.string().max(128).optional()
});
var startupDiskSummarySchema = z.object({
  scopeId: z.string().max(128),
  observedAvailableDropPeakBytes: z.number().finite().nonnegative().nullable(),
  minAvailableBytes: z.number().finite().nonnegative().nullable(),
  quality: z.enum(["complete", "partial", "unknown"]),
  sampledAt: z.number().finite().nonnegative().nullable()
}).strict();
var databaseStartupPhaseSchema = z.enum([
  "starting",
  "preparing_host_storage",
  "preparing_session_storage",
  "starting_services",
  "ready",
  "failed"
]);
var databaseMigrationIdSchema = z.string().regex(/^[a-zA-Z_0-9-]{1,128}$/);
var databaseMigrationFactsSchema = z.object({
  kind: z.enum(["none", "initialize", "upgrade"]),
  executedCount: z.number().int().nonnegative(),
  committedCount: z.number().int().nonnegative(),
  // null 表示锁内账本为空；缺失表示尚未取得可信起点。
  lastAppliedMigrationId: databaseMigrationIdSchema.nullable().optional()
}).strict().superRefine((facts, context) => {
  if (facts.committedCount > facts.executedCount || facts.kind === "none" && facts.executedCount !== 0)
    context.addIssue({ code: "custom", message: "Invalid migration execution facts" });
});
var databaseStartupStateSchema = z.object({
  schemaVersion: z.literal(1),
  startupId: z.string().min(1).max(128),
  attemptId: z.string().min(1).max(128),
  sequence: z.number().int().nonnegative(),
  startedAt: z.number().finite().nonnegative(),
  updatedAt: z.number().finite().nonnegative(),
  phase: databaseStartupPhaseSchema,
  databasePhase: z.enum(["checking", "waiting_for_lock", "migrating", "committing", "maintaining", "ready"]).optional(),
  migration: databaseMigrationFactsSchema.optional(),
  currentMigration: databaseMigrationFactsSchema.optional(),
  migrationBaselines: z.array(
    z.object({
      databaseId: z.string().min(1).max(128),
      databaseKind: z.enum(["tasks-index", "session"]),
      lastAppliedMigrationId: databaseMigrationIdSchema.nullable().optional()
    }).strict()
  ).optional(),
  finalDatabase: z.boolean().optional(),
  failedPhase: databaseStartupPhaseSchema.optional(),
  errorCode: databaseStartupErrorCodeSchema.optional(),
  ...databaseStartupErrorDetailsSchema.shape,
  disk: z.array(startupDiskSummarySchema).max(8)
}).strict();
var databaseStartupPortPayloadSchema = z.object({
  databaseStartupId: z.string().min(1).max(128)
}).strict();
var databaseStartupControlSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("snapshot") }).strict(),
  z.object({ action: z.literal("exit") }).strict(),
  z.object({ action: z.literal("retry"), attemptId: z.string().min(1).max(128) }).strict()
]);

// ../reference/ZCode/packages/shared/src/sessionCreateTelemetry.ts
import { z as z2 } from "zod";
var sessionCreateTelemetrySchema = z2.object({
  elementName: z2.literal("session_create"),
  eventRegion: z2.literal("app"),
  eventType: z2.literal("result"),
  talkId: z2.string().min(1).max(512),
  messageId: z2.string().min(1).max(512),
  context: z2.object({
    clientTimezone: z2.string().max(128),
    clientLanguage: z2.string().max(128),
    screenResolution: z2.string().max(64)
  }).strict(),
  eventExtraDetail: z2.object({
    create_source: z2.enum(["group", "project", "session"]),
    client_kind: z2.literal("mobile"),
    workspace_kind: z2.enum(["local", "remote"]),
    remote_kind: z2.enum(["", "ssh", "wsl", "docker", "server"])
  }).strict()
}).strict();
var automationSessionCreateTelemetrySchema = sessionCreateTelemetrySchema.extend({
  eventExtraDetail: sessionCreateTelemetrySchema.shape.eventExtraDetail.extend({
    create_source: z2.enum(["automation_idle", "automation_scheduled"]),
    client_kind: z2.literal("desktop")
  })
});

// ../reference/ZCode/packages/shared/src/validation.ts
import { z as z46 } from "zod";

// ../reference/ZCode/packages/shared/src/process-diagnostic.ts
import { z as z3 } from "zod";
var ZCODE_PROCESS_DIAGNOSTIC_NAME_MAX_CHARS = 128;
var ZCODE_PROCESS_DIAGNOSTIC_MESSAGE_MAX_CHARS = 4e3;
var ZCODE_PROCESS_DIAGNOSTIC_STACK_MAX_CHARS = 16e3;
var ZCODE_PROCESS_DIAGNOSTIC_MAX_LINE_CHARS = 128 * 1024;
var processErrorKindSchema = z3.enum(["uncaughtException", "unhandledRejection"]);
var zcodeProcessDiagnosticSchema = z3.object({
  version: z3.literal(1),
  errorId: z3.uuid(),
  kind: processErrorKindSchema,
  origin: processErrorKindSchema,
  name: z3.string().min(1).max(ZCODE_PROCESS_DIAGNOSTIC_NAME_MAX_CHARS),
  message: z3.string().max(ZCODE_PROCESS_DIAGNOSTIC_MESSAGE_MAX_CHARS),
  stack: z3.string().max(ZCODE_PROCESS_DIAGNOSTIC_STACK_MAX_CHARS).optional(),
  occurredAt: z3.number().int().nonnegative()
}).strict();

// ../reference/ZCode/packages/shared/src/browser-use/commands.ts
import { z as z5 } from "zod";

// ../reference/ZCode/packages/shared/src/browser-use/command-metadata.ts
import { z as z4 } from "zod";
var BROWSER_VIEWPORT_LIMITS = {
  minWidth: 320,
  maxWidth: 3840,
  minHeight: 320,
  maxHeight: 2160
};
var browserViewportSizeSchema = z4.object({
  width: z4.number().int().positive(),
  height: z4.number().int().positive()
}).strict();
var browserViewportInputSchema = browserViewportSizeSchema.extend({
  width: z4.number().int().min(BROWSER_VIEWPORT_LIMITS.minWidth).max(BROWSER_VIEWPORT_LIMITS.maxWidth),
  height: z4.number().int().min(BROWSER_VIEWPORT_LIMITS.minHeight).max(BROWSER_VIEWPORT_LIMITS.maxHeight)
});
var BROWSER_VIEWPORT_ZOOM_OPTIONS = [
  "fit",
  "50",
  "75",
  "100",
  "125",
  "150",
  "200"
];
var browserViewportZoomSchema = z4.enum(BROWSER_VIEWPORT_ZOOM_OPTIONS);
var DEFAULT_BROWSER_VIEWPORT_ZOOM = "fit";
var embeddedBrowserViewportPreferenceSchema = z4.object({
  mode: z4.enum(["normal", "responsive"]),
  viewport: browserViewportInputSchema,
  zoom: browserViewportZoomSchema
}).strict();
var DEFAULT_EMBEDDED_BROWSER_VIEWPORT_PREFERENCE = {
  mode: "normal",
  viewport: { width: 393, height: 852 },
  zoom: DEFAULT_BROWSER_VIEWPORT_ZOOM
};
var browserCommandMethodSchema = z4.enum([
  "navigate",
  "back",
  "forward",
  "reload",
  "snapshot",
  "click",
  "fill",
  "type",
  "press",
  "cuaKeypress",
  "scroll",
  "cuaScroll",
  "domCuaScroll",
  "hover",
  "select",
  "check",
  "drag",
  "cuaDrag",
  "screenshot",
  "getState",
  "elementInfo",
  "evaluate",
  "getDialog",
  "handleDialog",
  "waitFor",
  "playwright",
  "playwrightWaitForTimeout",
  "capabilities",
  "browserVisibilityGet",
  "browserVisibilitySet",
  "browserViewportSet",
  "browserViewportReset",
  "recordingStart",
  "recordingStatus",
  "recordingCancel",
  "activateTab",
  "newTab",
  "finalize",
  "finalizeTabs",
  "listUserTabs",
  "claimTab",
  "markDeliverable",
  "markHandoff",
  "nameSession",
  "turnEnded",
  "closeSession",
  "cancelRequest",
  "close",
  "list"
]);
var browserClientModeSchema = z4.enum(["desktop-continuous", "web-remote-replayable"]);
var browserCommandContextSchema = z4.object({
  /** workspaceIdentity?.trim() || workspacePath，用于隔离与受控 tab 复用。 */
  workspaceKey: z4.string().min(1),
  sessionId: z4.string().min(1),
  /** 受控 tab id；缺省表示该 session 的活动受控 tab。 */
  tabId: z4.string().min(1).optional(),
  requestId: z4.string().min(1),
  clientMode: browserClientModeSchema
}).strict();
var browserErrorCodeSchema = z4.enum([
  "backend_unavailable",
  "capability_unsupported",
  "duplicate_request_id",
  "ref_not_found",
  "navigation_blocked",
  "timeout",
  "renderer_unreachable",
  "cancelled",
  "execution_error"
]);
var browserPageStateSchema = z4.object({
  url: z4.string(),
  title: z4.string(),
  canGoBack: z4.boolean(),
  canGoForward: z4.boolean(),
  scrollX: z4.number().optional(),
  scrollY: z4.number().optional(),
  viewportWidth: z4.number().optional(),
  viewportHeight: z4.number().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/browser-use/commands.ts
var browserMouseButtonSchema = z5.enum(["left", "right", "middle"]);
var browserKeyModifierSchema = z5.enum([
  "Alt",
  "Control",
  "ControlOrMeta",
  "Meta",
  "Shift"
]);
var browserPointSchema = z5.object({ x: z5.number(), y: z5.number() }).strict();
var browserRecordingDurationSchema = z5.number().int().nonnegative().max(9e4);
var browserRecordingSelectorSchema = z5.string().trim().min(1).max(2e3);
var browserRecordingActionSchema = z5.discriminatedUnion("type", [
  z5.object({ type: z5.literal("wait"), durationMs: browserRecordingDurationSchema }).strict(),
  z5.object({
    type: z5.literal("click"),
    selector: browserRecordingSelectorSchema.optional(),
    x: z5.number().optional(),
    y: z5.number().optional(),
    button: browserMouseButtonSchema.optional(),
    doubleClick: z5.boolean().optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z5.object({
    type: z5.literal("type"),
    selector: browserRecordingSelectorSchema,
    text: z5.string().max(1e5),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z5.object({
    type: z5.literal("hover"),
    selector: browserRecordingSelectorSchema.optional(),
    x: z5.number().optional(),
    y: z5.number().optional(),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z5.object({
    type: z5.literal("move"),
    x: z5.number(),
    y: z5.number(),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z5.object({
    type: z5.literal("scroll"),
    deltaX: z5.number().optional(),
    deltaY: z5.number(),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z5.object({
    type: z5.literal("scrollTo"),
    selector: browserRecordingSelectorSchema.optional(),
    x: z5.number().optional(),
    y: z5.number().optional(),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z5.object({
    type: z5.literal("wheel"),
    deltaX: z5.number().optional(),
    deltaY: z5.number(),
    times: z5.number().int().min(1).max(100).optional(),
    intervalMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z5.object({
    type: z5.literal("drag"),
    path: z5.array(browserPointSchema).min(2).max(200),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z5.object({
    type: z5.literal("waitFor"),
    selector: browserRecordingSelectorSchema,
    state: z5.enum(["attached", "detached", "visible", "hidden"]).optional(),
    timeoutMs: z5.number().int().positive().max(3e4).optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict()
]);
var browserRecordingOptionsSchema = z5.object({
  viewport: browserViewportInputSchema.optional(),
  fps: z5.number().int().min(1).max(60).optional(),
  jpegQuality: z5.number().int().min(1).max(100).optional(),
  maxDurationMs: z5.number().int().min(1e3).max(9e4).optional(),
  settleMs: browserRecordingDurationSchema.optional(),
  showCursor: z5.boolean().optional(),
  actions: z5.array(browserRecordingActionSchema).max(500).optional()
}).strict();
var browserRecordingOutputPathSchema = z5.string().trim().min(1).max(2e3).refine((value) => !/^[/\\]/u.test(value) && !/^[A-Za-z]:[/\\]/u.test(value), {
  message: "recording outputPath must be relative to the workspace"
}).refine(
  (value) => !value.split(/[\\/]+/u).some((segment) => segment === ".." || segment === "." || segment.length === 0),
  { message: "recording outputPath cannot escape the workspace" }
).refine((value) => value.toLowerCase().endsWith(".webm"), {
  message: "recording outputPath must end with .webm"
});
var browserPlaywrightLocatorOperationSchema = z5.enum([
  "allTextContents",
  "click",
  "count",
  "dblclick",
  "downloadMedia",
  "evaluate",
  "fill",
  "getAttribute",
  "innerText",
  "isEnabled",
  "isVisible",
  "press",
  "selectOption",
  "setChecked",
  "textContent",
  "waitFor"
]);
var browserPlaywrightModifierSchema = z5.enum([
  "Alt",
  "Control",
  "ControlOrMeta",
  "Meta",
  "Shift"
]);
var browserPlaywrightTimeoutSchema = z5.number().int().positive().optional();
var browserPlaywrightSelectOptionSchema = z5.object({
  value: z5.string().optional(),
  label: z5.string().optional(),
  index: z5.number().int().nonnegative().optional()
}).strict().refine(
  (selection) => selection.value !== void 0 || selection.label !== void 0 || selection.index !== void 0,
  "Select option requires value, label, or index"
);
var browserPlaywrightActionSchema = z5.discriminatedUnion("name", [
  z5.object({ name: z5.literal("domSnapshot") }).strict(),
  z5.object({
    name: z5.literal("elementInfo"),
    x: z5.number(),
    y: z5.number(),
    includeNonInteractable: z5.boolean().optional()
  }).strict(),
  z5.object({
    name: z5.literal("elementScreenshot"),
    x: z5.number(),
    y: z5.number(),
    includeNonInteractable: z5.boolean().optional()
  }).strict(),
  z5.object({
    name: z5.literal("evaluate"),
    expression: z5.string().min(1),
    expressionKind: z5.enum(["string", "function"]),
    arg: z5.unknown().optional(),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z5.object({
    name: z5.literal("waitForLoadState"),
    state: z5.enum(["load", "domcontentloaded", "networkidle"]).optional(),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z5.object({
    name: z5.literal("waitForURL"),
    url: z5.string().min(1),
    waitUntil: z5.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional(),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z5.object({
    name: z5.literal("waitForEvent"),
    event: z5.enum(["download", "filechooser"]),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z5.object({
    name: z5.literal("downloadPath"),
    downloadId: z5.string().min(1),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z5.object({
    name: z5.literal("fileChooserSetFiles"),
    fileChooserId: z5.string().min(1),
    files: z5.array(z5.string()).min(1),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z5.object({
    name: z5.literal("locator"),
    selector: z5.string().min(1),
    operation: browserPlaywrightLocatorOperationSchema,
    value: z5.unknown().optional(),
    arg: z5.unknown().optional(),
    expression: z5.string().min(1).optional(),
    expressionKind: z5.enum(["string", "function"]).optional(),
    attribute: z5.string().min(1).optional(),
    checked: z5.boolean().optional(),
    replace: z5.boolean().optional(),
    force: z5.boolean().optional(),
    button: browserMouseButtonSchema.optional(),
    modifiers: z5.array(browserPlaywrightModifierSchema).optional(),
    state: z5.enum(["attached", "detached", "visible", "hidden"]).optional(),
    selections: z5.array(browserPlaywrightSelectOptionSchema).min(1).optional(),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict()
]);
var browserCommandSchema = z5.discriminatedUnion("method", [
  z5.object({
    method: z5.literal("navigate"),
    url: z5.string().min(1),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({ method: z5.literal("back"), tabId: z5.string().optional() }).strict(),
  z5.object({ method: z5.literal("forward"), tabId: z5.string().optional() }).strict(),
  z5.object({ method: z5.literal("reload"), tabId: z5.string().optional() }).strict(),
  z5.object({
    method: z5.literal("snapshot"),
    maxElements: z5.number().int().positive().optional(),
    includeHidden: z5.boolean().optional(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("click"),
    // ref（快照句柄）与坐标 (x,y) 二选一：ref 走 dom_cua 式定位，(x,y) 走 cua 视觉坐标定位。
    ref: z5.string().min(1).optional(),
    x: z5.number().optional(),
    y: z5.number().optional(),
    button: browserMouseButtonSchema.optional(),
    doubleClick: z5.boolean().optional(),
    modifiers: z5.array(browserKeyModifierSchema).optional(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("fill"),
    ref: z5.string().min(1),
    value: z5.string(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("type"),
    ref: z5.string().min(1).optional(),
    text: z5.string(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("press"),
    key: z5.string().min(1),
    ref: z5.string().min(1).optional(),
    modifiers: z5.array(browserKeyModifierSchema).optional(),
    tabId: z5.string().optional()
  }).strict(),
  // CUA 组合键输入：keys 是一个组合键，必须保留逐键 down/up 顺序，不能压成末键 + bitmask。
  z5.object({
    method: z5.literal("cuaKeypress"),
    keys: z5.array(z5.string().min(1)).min(1),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("scroll"),
    ref: z5.string().min(1).optional(),
    x: z5.number().optional(),
    y: z5.number().optional(),
    tabId: z5.string().optional()
  }).strict(),
  // CUA 滚动输入：视口锚点与滚动 delta 是两组不同坐标，且可携带 modifier。
  z5.object({
    method: z5.literal("cuaScroll"),
    x: z5.number(),
    y: z5.number(),
    scrollX: z5.number(),
    scrollY: z5.number(),
    modifiers: z5.array(browserKeyModifierSchema).optional(),
    tabId: z5.string().optional()
  }).strict(),
  // DOM CUA 滚动输入：nodeId 缺省时从视口中心滚动；存在时从该节点中心滚动。
  z5.object({
    method: z5.literal("domCuaScroll"),
    nodeId: z5.string().min(1).optional(),
    scrollX: z5.number(),
    scrollY: z5.number(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("screenshot"),
    ref: z5.string().min(1).optional(),
    fullPage: z5.boolean().optional(),
    // 区域截图：CDP Page.captureScreenshot 的 clip（视口 CSS px）。与 fullPage 互斥。
    clip: z5.object({
      x: z5.number(),
      y: z5.number(),
      width: z5.number().positive(),
      height: z5.number().positive()
    }).strict().optional(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({ method: z5.literal("getState"), tabId: z5.string().optional() }).strict(),
  // hover：移动鼠标到元素(ref)或坐标(x,y)，触发 hover 态（cua move / dom_cua 定位后 move）。
  z5.object({
    method: z5.literal("hover"),
    ref: z5.string().min(1).optional(),
    x: z5.number().optional(),
    y: z5.number().optional(),
    modifiers: z5.array(browserKeyModifierSchema).optional(),
    tabId: z5.string().optional()
  }).strict(),
  // select：对 <select> 选择一个或多个 option（按 value 或可见文本匹配）。
  z5.object({
    method: z5.literal("select"),
    ref: z5.string().min(1),
    values: z5.array(z5.string()).min(1),
    tabId: z5.string().optional()
  }).strict(),
  // check：设置 checkbox/radio 勾选态（checked 缺省为 true）。
  z5.object({
    method: z5.literal("check"),
    ref: z5.string().min(1),
    checked: z5.boolean().optional(),
    tabId: z5.string().optional()
  }).strict(),
  // drag：从 起点(fromRef 或 from{x,y}) 拖到 终点(toRef 或 to{x,y})，走 CDP Input 合成鼠标拖拽。
  z5.object({
    method: z5.literal("drag"),
    fromRef: z5.string().min(1).optional(),
    toRef: z5.string().min(1).optional(),
    from: browserPointSchema.optional(),
    to: browserPointSchema.optional(),
    modifiers: z5.array(browserKeyModifierSchema).optional(),
    tabId: z5.string().optional()
  }).strict(),
  // CUA drag 输入：完整 path 是公共合同，backend 必须逐点发送而不是只取首尾。
  z5.object({
    method: z5.literal("cuaDrag"),
    path: z5.array(browserPointSchema).min(1),
    modifiers: z5.array(browserKeyModifierSchema).optional(),
    tabId: z5.string().optional()
  }).strict(),
  // elementInfo：给视口坐标 (x,y)，反查该点命中元素的信息（role/name/rect/selector），打通视觉↔结构。
  z5.object({
    method: z5.literal("elementInfo"),
    x: z5.number(),
    y: z5.number(),
    tabId: z5.string().optional()
  }).strict(),
  // evaluate：在页面作用域执行 JS 表达式，返回可 JSON 序列化的结果。
  z5.object({
    method: z5.literal("evaluate"),
    expression: z5.string().min(1),
    tabId: z5.string().optional()
  }).strict(),
  // getDialog：读取当前 JS 弹窗（alert/confirm/prompt/beforeunload）信息，无则返回 dialog=null。
  z5.object({ method: z5.literal("getDialog"), tabId: z5.string().optional() }).strict(),
  // handleDialog：接受/取消当前 JS 弹窗；prompt 可带 promptText。
  z5.object({
    method: z5.literal("handleDialog"),
    accept: z5.boolean(),
    promptText: z5.string().optional(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("waitFor"),
    selector: z5.string().min(1).optional(),
    text: z5.string().min(1).optional(),
    textGone: z5.string().min(1).optional(),
    timeoutMs: z5.number().int().positive().optional(),
    tabId: z5.string().optional()
  }).strict(),
  // PlaywrightAPI.waitForTimeout：固定等待只接受非负整数，0 表示让出一次 timer tick。
  z5.object({
    method: z5.literal("playwrightWaitForTimeout"),
    timeoutMs: z5.number().int().nonnegative(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("playwright"),
    action: browserPlaywrightActionSchema,
    tabId: z5.string().optional()
  }).strict(),
  z5.object({ method: z5.literal("capabilities"), tabId: z5.string().optional() }).strict(),
  z5.object({ method: z5.literal("browserVisibilityGet") }).strict(),
  z5.object({ method: z5.literal("browserVisibilitySet"), visible: z5.boolean() }).strict(),
  browserViewportInputSchema.extend({
    method: z5.literal("browserViewportSet"),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({ method: z5.literal("browserViewportReset"), tabId: z5.string().optional() }).strict(),
  z5.object({
    method: z5.literal("recordingStart"),
    options: browserRecordingOptionsSchema.optional(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("recordingStatus"),
    recordingId: z5.string().trim().min(1),
    outputPath: browserRecordingOutputPathSchema.optional(),
    tabId: z5.string().optional()
  }).strict(),
  z5.object({
    method: z5.literal("recordingCancel"),
    recordingId: z5.string().trim().min(1),
    tabId: z5.string().optional()
  }).strict(),
  // tabs.get(id) 的 backend 激活步骤：校验并更新该 scope selected tab；renderer 决定前台展示或后台记录。
  z5.object({ method: z5.literal("activateTab"), tabId: z5.string().min(1) }).strict(),
  z5.object({ method: z5.literal("newTab") }).strict(),
  z5.object({ method: z5.literal("listUserTabs") }).strict(),
  z5.object({ method: z5.literal("claimTab"), tabId: z5.string().min(1) }).strict(),
  z5.object({
    method: z5.literal("finalizeTabs"),
    keep: z5.array(
      z5.object({ tabId: z5.string().min(1), status: z5.enum(["handoff", "deliverable"]) }).strict()
    )
  }).strict(),
  z5.object({ method: z5.literal("markDeliverable"), tabId: z5.string().min(1) }).strict(),
  z5.object({ method: z5.literal("markHandoff"), tabId: z5.string().min(1) }).strict(),
  z5.object({ method: z5.literal("nameSession"), name: z5.string().trim().min(1) }).strict(),
  z5.object({
    method: z5.literal("finalize"),
    tabId: z5.string().optional(),
    deliverable: z5.boolean().optional()
  }).strict(),
  z5.object({ method: z5.literal("turnEnded"), turnId: z5.string().min(1).optional() }).strict(),
  z5.object({ method: z5.literal("closeSession") }).strict(),
  z5.object({ method: z5.literal("cancelRequest"), requestId: z5.string().min(1) }).strict(),
  // close：关闭指定受控 tab（tabId 缺省=当前 tab）。manager 层处理：detach + 通知 renderer 卸载 webview。
  z5.object({ method: z5.literal("close"), tabId: z5.string().optional() }).strict(),
  // list：枚举当前会话窗口下所有受控 tab 摘要。manager 层拦截处理，返回 result.tabs。
  z5.object({ method: z5.literal("list") }).strict()
]);

// ../reference/ZCode/packages/shared/src/browser-use/result.ts
import { z as z8 } from "zod";

// ../reference/ZCode/packages/shared/src/browser-use/backend.ts
import { z as z6 } from "zod";
var browserBackendTypeSchema = z6.enum(["iab", "extension", "cdp"]);
var browserCapabilityDescriptorSchema = z6.object({
  id: z6.string().trim().min(1),
  description: z6.string().trim().min(1)
}).strict();
var browserBackendDescriptorSchema = z6.object({
  id: z6.string().trim().min(1),
  /** 同一 runtime id 的连接代次；旧代次对象不得自动漂移到新连接。 */
  generation: z6.number().int().nonnegative().default(0),
  type: browserBackendTypeSchema,
  name: z6.string().trim().min(1),
  capabilities: z6.object({
    browser: z6.array(browserCapabilityDescriptorSchema).optional(),
    tab: z6.array(browserCapabilityDescriptorSchema).optional()
  }).strict(),
  apiSupportOverrides: z6.record(z6.string(), z6.boolean()).optional(),
  /** metadata 只允许非敏感字符串，禁止把 credential 混入 discovery。 */
  metadata: z6.record(z6.string(), z6.string()).optional()
}).strict();
var browserSessionContextKindSchema = z6.enum(["live", "cached"]);
var browserDiscoveryContextSchema = z6.object({
  requestId: z6.string().trim().min(1),
  workspaceKey: z6.string().trim().min(1),
  workspacePath: z6.string().trim().min(1),
  workspaceIdentity: z6.string().trim().min(1).optional(),
  remoteSessionId: z6.string().trim().min(1).optional(),
  sessionId: z6.string().trim().min(1),
  turnId: z6.string().trim().min(1).optional(),
  clientMode: browserClientModeSchema,
  sessionContext: browserSessionContextKindSchema
}).strict();
var browserSessionContextSchema = browserDiscoveryContextSchema.extend({
  browserId: z6.string().trim().min(1),
  browserGeneration: z6.number().int().nonnegative()
}).strict();
var browserBackendListResultSchema = z6.object({ browsers: z6.array(browserBackendDescriptorSchema) }).strict();

// ../reference/ZCode/packages/shared/src/browser-use/snapshot.ts
import { z as z7 } from "zod";
var browserElementRectSchema = z7.object({
  x: z7.number(),
  y: z7.number(),
  width: z7.number(),
  height: z7.number()
}).strict();
var browserSnapshotElementSchema = z7.object({
  ref: z7.string().min(1),
  tag: z7.string(),
  role: z7.string().optional(),
  /** accessibleName */
  name: z7.string().optional(),
  text: z7.string().optional(),
  value: z7.string().optional(),
  disabled: z7.boolean().optional(),
  checked: z7.boolean().optional(),
  selector: z7.string(),
  xpath: z7.string(),
  rect: browserElementRectSchema,
  inViewport: z7.boolean(),
  /** 父级可交互元素的 ref（层级线索；顶层/无父可交互元素时省略）。 */
  parentRef: z7.string().optional(),
  /** 元素来源的 frame 路径（同源 iframe 穿透时标注，如 "0>2"；主文档省略）。 */
  framePath: z7.string().optional(),
  /** 有界稳定属性，用于从 DOM 事实构造 locator；不返回 class/style/src 等高噪声字段。 */
  attributes: z7.record(z7.string(), z7.string()).optional()
}).strict();
var browserSnapshotDomNodeSchema = z7.object({
  tag: z7.string(),
  depth: z7.number().int().nonnegative(),
  inViewport: z7.boolean(),
  ref: z7.string().min(1).optional(),
  role: z7.string().optional(),
  name: z7.string().optional(),
  text: z7.string().optional(),
  attributes: z7.record(z7.string(), z7.string()).optional()
}).strict();
var browserSnapshotSchema = z7.object({
  url: z7.string(),
  title: z7.string(),
  /**
   * 有界的可见语义 DOM；optional 保持旧 backend/result 的协议兼容。
   * 必须排在 elements 前定义：Zod 会按 schema 顺序重建对象，大页面工具结果被截断时
   * 应先让模型看到页面语义，而不是 selector/xpath/rect 等动作细节。
   */
  dom: z7.array(browserSnapshotDomNodeSchema).optional(),
  /** 语义 DOM 节点超过内部预算时置 true。 */
  domTruncated: z7.boolean().optional(),
  elements: z7.array(browserSnapshotElementSchema),
  /** 元素数超过 maxElements 时截断。 */
  truncated: z7.boolean()
}).strict();

// ../reference/ZCode/packages/shared/src/browser-use/result.ts
var browserTabSummarySchema = z8.object({
  tabId: z8.string(),
  url: z8.string(),
  title: z8.string(),
  /** guest 当前真实 CSS viewport；normal/free-size 均必须返回。 */
  viewport: browserViewportSizeSchema,
  /**
   * main 侧最近可见/激活的内置浏览器 tab。用于让 agent 在用户手动改地址后，
   * 先绑定并读取当前页面，而不是误读 session 默认 tab。
   */
  active: z8.boolean().optional(),
  lifecycle: z8.enum(["active", "deliverable", "handoff"]).optional()
}).strict();
var browserUserTabInfoSchema = z8.object({
  id: z8.string().min(1),
  lastOpened: z8.string().optional(),
  tabGroup: z8.string().optional(),
  title: z8.string().optional(),
  url: z8.string().optional()
}).strict();
var browserDialogSchema = z8.object({
  type: z8.enum(["alert", "confirm", "prompt", "beforeunload"]),
  message: z8.string(),
  defaultPrompt: z8.string().optional()
}).strict();
var browserResponseMetaSchema = z8.object({
  browserUse: z8.literal(true),
  backendType: browserBackendTypeSchema,
  browserId: z8.string().min(1),
  browserGeneration: z8.number().int().nonnegative(),
  openTabIds: z8.array(z8.string()),
  tabId: z8.string().optional(),
  currentUrl: z8.string().optional(),
  lifecycle: z8.enum(["active", "deliverable", "handoff", "closed"]).optional()
}).strict();
var browserRecordingArtifactSchema = z8.object({
  path: z8.string().min(1),
  mimeType: z8.literal("video/webm"),
  width: z8.number().int().positive(),
  height: z8.number().int().positive(),
  fps: z8.number().positive(),
  durationMs: z8.number().nonnegative(),
  frameCount: z8.number().int().nonnegative()
}).strict();
var browserRecordingJobSchema = z8.object({
  id: z8.string().min(1),
  status: z8.enum(["running", "completed", "failed", "cancelled"]),
  phase: z8.enum(["preparing", "capturing", "finalizing", "completed", "failed", "cancelled"]),
  progress: z8.number().min(0).max(1),
  startedAt: z8.number().nonnegative(),
  updatedAt: z8.number().nonnegative(),
  artifact: browserRecordingArtifactSchema.optional(),
  error: z8.string().optional()
}).strict();
var browserCommandResultSchema = z8.object({
  ok: z8.boolean(),
  state: browserPageStateSchema.optional(),
  snapshot: browserSnapshotSchema.optional(),
  image: z8.object({ base64: z8.string(), mimeType: z8.literal("image/png") }).strict().optional(),
  /** list 命令返回：只包含当前 window/workspace/session/generation scope 可见的 tabs。 */
  tabs: z8.array(browserTabSummarySchema).optional(),
  /** BrowserUser.openTabs() 返回；与当前 session 自有 tabs.list() 严格分离。 */
  userTabs: z8.array(browserUserTabInfoSchema).optional(),
  /** newTab 返回的单个真实 tab。 */
  tab: browserTabSummarySchema.optional(),
  /** evaluate 返回：页面表达式的可 JSON 序列化结果。 */
  value: z8.unknown().optional(),
  /** elementInfo 返回：坐标命中元素的信息（复用快照元素结构；未命中则省略）。 */
  element: browserSnapshotElementSchema.optional(),
  /** getDialog 返回：当前 JS 弹窗信息；无弹窗时为 null。 */
  dialog: browserDialogSchema.nullable().optional(),
  /** WebView 异步录制任务；main 临时 path 会在 Host materialize 后改写为 workspace path。 */
  recording: browserRecordingJobSchema.optional(),
  error: z8.object({
    code: browserErrorCodeSchema,
    message: z8.string(),
    sideEffect: z8.enum(["none", "uncertain"]).optional()
  }).strict().optional(),
  meta: browserResponseMetaSchema.optional(),
  elapsedMs: z8.number().nonnegative()
}).strict();

// ../reference/ZCode/packages/shared/src/remoteAssetInstallMode.ts
var REMOTE_ASSET_INSTALL_MODES = ["local-download-upload", "remote-download"];

// ../reference/ZCode/packages/shared/src/processResourceTelemetry.ts
var PROCESS_RESOURCE_CLI_LANES = ["chat", "plugin", "mcp-status"];
var PROCESS_RESOURCE_EVENT_NAMES = {
  processWindow: "perf_process_window",
  systemWindow: "perf_system_window",
  toolExecResource: "perf_tool_exec_resource"
};
var PROCESS_RESOURCE_GLOBAL_PROPERTY_KEYS = [
  "platform",
  "app_version",
  "arms_env",
  "device_mid"
];
var PERF_PROCESS_WINDOW_PROPERTY_KEYS = [
  ...PROCESS_RESOURCE_GLOBAL_PROPERTY_KEYS,
  "process_role",
  "runtime_surface",
  "arch",
  "logical_cpu_count",
  "total_memory_gb",
  "mcp_id",
  "background_ratio",
  "uptime_minutes",
  "cpu_percent_p95",
  "cpu_percent_peak",
  "rss_kb_total_mean",
  "rss_kb_total_peak",
  "rss_kb_max_process_peak",
  "heap_used_kb_mean",
  "heap_used_kb_peak",
  "process_count_peak",
  "sample_count"
];
var PERF_SYSTEM_WINDOW_PROPERTY_KEYS = [
  ...PROCESS_RESOURCE_GLOBAL_PROPERTY_KEYS,
  "arch",
  "logical_cpu_count",
  "total_memory_gb",
  "background_ratio",
  "app_uptime_minutes",
  "system_cpu_percent_p95",
  "system_free_memory_kb_min",
  "app_cpu_percent_p95",
  "app_rss_kb_total_mean",
  "app_rss_kb_total_peak",
  "process_count_total_peak",
  "sample_count",
  "telemetry_self_ms"
];
var PERF_TOOL_EXEC_RESOURCE_PROPERTY_KEYS = [
  ...PROCESS_RESOURCE_GLOBAL_PROPERTY_KEYS,
  "runtime_surface",
  "tool_name",
  "exit_kind",
  "tree_rss_kb_peak",
  "tree_cpu_time_ms",
  "sample_count",
  "cli_rss_kb",
  "system_free_memory_kb"
];
var PROPERTY_KEY_WHITELIST = {
  [PROCESS_RESOURCE_EVENT_NAMES.processWindow]: PERF_PROCESS_WINDOW_PROPERTY_KEYS,
  [PROCESS_RESOURCE_EVENT_NAMES.systemWindow]: PERF_SYSTEM_WINDOW_PROPERTY_KEYS,
  [PROCESS_RESOURCE_EVENT_NAMES.toolExecResource]: PERF_TOOL_EXEC_RESOURCE_PROPERTY_KEYS
};

// ../reference/ZCode/packages/shared/src/remoteResourcePackages.ts
var REMOTE_RESOURCE_PACKAGE_IDS = [
  "server-bundle",
  "node-runtime",
  "node-pty",
  "glm",
  "bfs",
  "ripgrep",
  "ugrep"
];
var ACTIVE_REMOTE_RESOURCE_PACKAGE_IDS = [
  "server-bundle",
  "node-runtime",
  "node-pty",
  "glm",
  "bfs",
  "ripgrep",
  "ugrep"
];
var REQUIRED_REMOTE_RESOURCE_PACKAGE_IDS = [
  "server-bundle",
  "node-runtime"
];
var OPTIONAL_REMOTE_RESOURCE_PACKAGE_IDS = ACTIVE_REMOTE_RESOURCE_PACKAGE_IDS.filter(
  (id) => !REQUIRED_REMOTE_RESOURCE_PACKAGE_IDS.includes(
    id
  )
);
var REMOTE_RESOURCE_PACKAGE_ID_SET = new Set(
  REMOTE_RESOURCE_PACKAGE_IDS
);
var ACTIVE_REMOTE_RESOURCE_PACKAGE_ID_SET = new Set(
  ACTIVE_REMOTE_RESOURCE_PACKAGE_IDS
);
var REQUIRED_REMOTE_RESOURCE_PACKAGE_ID_SET = new Set(
  REQUIRED_REMOTE_RESOURCE_PACKAGE_IDS
);
function isKnownRemoteResourcePackageId(packageId) {
  return REMOTE_RESOURCE_PACKAGE_ID_SET.has(packageId);
}

// ../reference/ZCode/packages/shared/src/providers.ts
import { z as z9 } from "zod";
var ZCODE_PROVIDERS = ["glm"];
var zcodeProviderSchema = z9.enum(ZCODE_PROVIDERS);

// ../reference/ZCode/packages/shared/src/zcode-agent-policy.ts
import { z as z10 } from "zod";
var ZCODE_AGENT_PROVIDER = "glm";
var zcodeAgentProviderSchema = z10.literal(ZCODE_AGENT_PROVIDER);

// ../reference/ZCode/packages/shared/src/model-selection.ts
import { z as z11 } from "zod";
var modelSelectionSchema = z11.object({
  providerId: z11.string().trim().min(1),
  modelId: z11.string().trim().min(1),
  options: z11.object({
    reasoningLevel: z11.string().trim().min(1).optional()
  }).strict().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/provider-provisioning.ts
import { z as z13 } from "zod";

// ../reference/ZCode/packages/shared/src/provider-family-connection-selection.ts
import { z as z12 } from "zod";
var nonEmptyString = z12.string().trim().min(1);
var providerFamilyConnectionSelectionSchema = z12.discriminatedUnion("kind", [
  z12.object({ kind: z12.literal("start-plan") }).strict(),
  z12.object({ kind: z12.literal("individual-coding-plan") }).strict(),
  z12.object({
    kind: z12.literal("team-coding-plan"),
    productId: nonEmptyString,
    organizationId: nonEmptyString,
    projectId: nonEmptyString
  }).strict()
]);
var providerFamilyConnectionSelectionSettingsSchema = z12.object({
  zai: providerFamilyConnectionSelectionSchema.optional(),
  bigmodel: providerFamilyConnectionSelectionSchema.optional()
}).partial();

// ../reference/ZCode/packages/shared/src/provider-provisioning.ts
var nonEmptyString2 = z13.string().trim().min(1);
var providerProvisioningTriggerSchema = z13.enum([
  "environment-online",
  "personal-config",
  "configured-default",
  "account-settings",
  "credential"
]);
var providerProvisioningCredentialScopeSchema = z13.enum([
  "oauth-session",
  "account-provider"
]);
var providerProvisioningPersonalConfigSchema = z13.object({
  providerConfigRules: z13.object({ providerRules: z13.array(z13.unknown()) }).strict(),
  modelConfigRules: z13.object({
    providerModelRules: z13.array(z13.unknown()),
    manualProviderModelRules: z13.array(z13.unknown())
  }).strict(),
  providerOrder: z13.array(nonEmptyString2).optional(),
  defaultModelSelection: modelSelectionSchema.optional()
}).strict();
var providerProvisioningAccountSettingsSchema = z13.object({
  providerFamilyDomain: z13.enum(["zai", "bigmodel"]).nullable(),
  providerFamilyConnectionSelections: providerFamilyConnectionSelectionSettingsSchema
}).strict();
var providerProvisioningCredentialEntrySchema = z13.object({
  scope: providerProvisioningCredentialScopeSchema,
  key: nonEmptyString2,
  value: z13.string()
}).strict();
var providerProvisioningEnvelopeSchema = z13.object({
  schemaVersion: z13.literal(1),
  syncId: nonEmptyString2,
  personalConfig: providerProvisioningPersonalConfigSchema,
  accountSettings: providerProvisioningAccountSettingsSchema,
  credentials: z13.array(providerProvisioningCredentialEntrySchema).max(256)
}).strict();
var providerProvisioningResultSchema = z13.object({
  syncId: nonEmptyString2,
  status: z13.enum(["applied", "already-applied", "unsupported", "failed", "rollback_failed"]),
  personalProviderCount: z13.number().int().nonnegative(),
  credentialCount: z13.number().int().nonnegative(),
  configRevision: nonEmptyString2.optional(),
  errorMessage: z13.string().optional(),
  rolledBack: z13.boolean()
}).strict();

// ../reference/ZCode/packages/shared/src/bash-output-display.ts
import { z as z14 } from "zod";
var bashOutputDisplaySchema = z14.object({
  kind: z14.literal("bash_output"),
  output: z14.string().max(15e4),
  truncated: z14.boolean(),
  outputPath: z14.string().min(1).max(32768).optional()
}).strict();

// ../reference/ZCode/packages/shared/src/background-bash-output.ts
import { z as z15 } from "zod";
var BACKGROUND_BASH_OUTPUT_MAX_BYTES = 8192;
var backgroundBashOutputSchema = z15.strictObject({
  kind: z15.literal("output"),
  workId: z15.string().min(1),
  status: z15.enum(["running", "completed", "failed", "timed_out", "cancelled", "spawn_error"]),
  output: z15.string().max(BACKGROUND_BASH_OUTPUT_MAX_BYTES),
  truncated: z15.boolean(),
  outputPath: z15.string().min(1)
});
var backgroundBashOutputResultSchema = z15.union([
  backgroundBashOutputSchema,
  z15.strictObject({
    kind: z15.enum(["unavailable", "unsupported", "read_failed"]),
    workId: z15.string().min(1),
    code: z15.string().optional()
  })
]);

// ../reference/ZCode/packages/shared/src/execution-output-preview.ts
import { z as z16 } from "zod";
var OUTPUT_PREVIEW_MAX_CHARACTERS = 4096;
var executionOutputPreviewSchema = z16.object({
  text: z16.string().max(OUTPUT_PREVIEW_MAX_CHARACTERS),
  fullText: z16.string().max(OUTPUT_PREVIEW_MAX_CHARACTERS),
  totalLines: z16.number().int().nonnegative(),
  totalBytes: z16.number().int().nonnegative(),
  linesEstimated: z16.boolean()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol/index.ts
import { z as z44 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/snapshot.ts
import { z as z34 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/shared-context-import.ts
import { z as z17 } from "zod";
var sharedContextImportV2StateSchema = z17.object({
  contextId: z17.string().trim().min(1),
  title: z17.string().trim().min(1),
  shareUrl: z17.string().url().refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && url.search === "" && url.hash === "" && /^\/cn\/share\/[^/]+$/u.test(url.pathname);
    } catch {
      return false;
    }
  }, "shareUrl must use the canonical /cn/share/<code> path"),
  status: z17.enum(["pending", "reserved", "attached", "discarded"])
}).strict();
var legacySharedContextImportStateSchema = z17.object({ title: z17.string().trim().min(1) }).strict();
var sharedContextImportStateSchema = z17.union([
  sharedContextImportV2StateSchema,
  legacySharedContextImportStateSchema
]);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/input-intent.ts
import { z as z22 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/core.ts
import { z as z18 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-media-policy.ts
var VIDEO_INPUT_MAX_BYTES = 30 * 1024 * 1024;

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/core.ts
var conversationRowTargetSchema = z18.object({
  rowId: z18.number().int().nonnegative(),
  entityId: z18.string().trim().min(1)
}).strict();
var timestampSchema = z18.number();
var streamablePathSchema = z18.enum(["text", "inputText", "output.text", "summaryText"]);
var PROTOCOL_V4_LIMITS = {
  maxFrameBytes: 1024 * 1024,
  logicalFrameAssemblyMaxBytes: 16 * 1024 * 1024,
  logicalFrameAssemblyMaxFragments: 1024,
  logicalFrameAssemblyMaxConcurrent: 32,
  logicalFrameAssemblyMaxStagedBytes: 32 * 1024 * 1024,
  logicalFrameAssemblyTimeoutMs: 3e4,
  transportEnvelopeIdMaxChars: 256,
  subscriberBufferMaxOps: 500,
  subscriberBufferMaxBytes: 1024 * 1024,
  eventRetentionPerSession: 2e3,
  snapshotTailWindowRows: 60,
  rowsRangeMaxLimit: 200,
  toolOutputFinalHeadBytes: 32 * 1024,
  toolOutputFinalTailBytes: 32 * 1024,
  goalVerificationsRetained: 20,
  pendingCommandsDisplayMax: 32,
  commandPendingTtlMs: 24 * 60 * 60 * 1e3,
  idempotencyTablePerSession: 512,
  conversationQueryTimeoutMs: 1e4,
  attachmentMaxBytes: 20 * 1024 * 1024,
  attachmentChunkMaxBytes: 512 * 1024,
  attachmentPreviewMaxBytes: VIDEO_INPUT_MAX_BYTES,
  // share 选择阶段的 metadata-only stat 曾复用 attachmentPreviewMaxBytes
  // （30MiB）作为 totalBytes 上限，于是超过该值的附件在 schema 校验就抛错，
  // 「容量超限」这个本应确定阻断的分类反而被降级成 deferred 并静默丢内容。
  // stat 不搬运字节，只需要一个足够表达真实文件大小的上界。
  attachmentStatMaxBytes: 2 * 1024 * 1024 * 1024,
  attachmentPreviewMaxChunks: VIDEO_INPUT_MAX_BYTES / (512 * 1024),
  attachmentReadCacheMaxBytes: VIDEO_INPUT_MAX_BYTES,
  attachmentReadCacheTtlMs: 3e4,
  attachmentUploadMaxChunks: 64,
  attachmentUploadMaxConcurrent: 16,
  attachmentUploadMaxStagedBytes: 64 * 1024 * 1024,
  attachmentUploadTtlMs: 5 * 6e4,
  attachmentUnreferencedTtlMs: 24 * 60 * 60 * 1e3
};

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/attachment-ref.ts
import { z as z19 } from "zod";
var attachmentRefSchema = z19.object({
  ref: z19.string(),
  fileName: z19.string(),
  mime: z19.string(),
  bytes: z19.number(),
  previewRef: z19.string().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/submission.ts
import { z as z20 } from "zod";
var submissionModeSchema = z20.enum(["build", "edit", "plan", "yolo"]);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/shared-context-ref.ts
import { z as z21 } from "zod";
var sharedContextRefSchema = z21.object({
  kind: z21.literal("shared_context_import"),
  context_id: z21.string().trim().min(1)
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/input-intent.ts
var conversationInputDeliverySchema = z22.object({
  requested: z22.enum(["auto", "startNow", "queue", "guide"]),
  admitted: z22.enum(["startNow", "queue", "guide"]),
  fallbackReasonCode: z22.string().optional()
}).strict();
var conversationInputOrderSchema = z22.object({
  admissionSeq: z22.number().int().nonnegative(),
  queuePosition: z22.number().int().nonnegative().optional()
}).strict();
var conversationInputSteerSchema = z22.object({
  state: z22.enum(["notRequested", "submitting", "steering", "guided", "fellBack"]),
  reasonCode: z22.string().optional()
}).strict();
var conversationInputDispatchSchema = z22.object({
  state: z22.enum(["admitted", "queued", "reserved", "promoting", "drained"]),
  reservationId: z22.string().optional()
}).strict();
var conversationInputIntentSchema = z22.object({
  sourceCommandId: z22.string().min(1),
  queueItemId: z22.string().min(1),
  clientId: z22.string().min(1),
  // compact 是可排队的维护意图；消费时走 compact lifecycle，不投影为 user row。
  kind: z22.enum(["sendText", "sendGoalCommand", "compact"]),
  text: z22.string(),
  attachments: z22.array(attachmentRefSchema).default([]),
  // optional 只服务旧 snapshot hydration；新 admission 必须填入完整 Submission。
  modelSelection: modelSelectionSchema.optional(),
  mode: submissionModeSchema.optional(),
  planEnabled: z22.boolean().optional(),
  sharedContextRefs: z22.array(sharedContextRefSchema).max(1).optional(),
  delivery: conversationInputDeliverySchema,
  order: conversationInputOrderSchema,
  steer: conversationInputSteerSchema,
  dispatch: conversationInputDispatchSchema,
  admittedAt: timestampSchema,
  provenance: z22.object({
    sourceCommandId: z22.string().min(1),
    queueItemId: z22.string().min(1).optional(),
    clientId: z22.string().min(1).optional()
  }).strict().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-legacy-types.ts
import { z as z23 } from "zod";
var nonEmptyString3 = z23.string().trim().min(1);
var jsonObjectSchema = z23.record(z23.string(), z23.unknown());
var timestampMsSchema = z23.number().int().nonnegative();
var zcodeDeliveryKindSchema = z23.enum(["desktop-continuous", "web-remote-replayable"]);
var zcodeMessageVisibilitySchema = z23.enum(["user-visible", "model-only"]);
var zcodeSyntheticUserMessageSourceSchema = z23.enum([
  "background_task",
  "fork",
  "goal_state_change",
  "goal-continuation",
  "plugin_reference",
  "rewind",
  "selection_side_chat",
  "subagent",
  // child 回复会作为 model-only synthetic user message 持久化；
  // app/agent 共用的承重消息 schema 必须与 CLI contracts 使用同一来源词表。
  "subagent_message",
  "todo_reminder",
  // 中枢直接启动工作流的启动轮 source；与 contracts 的
  // SYNTHETIC_USER_MESSAGE_SOURCES 保持同一词表，否则 v3 mapper 收窄该 source 会 tsc 失败。
  "workflow_launch",
  "shared_context"
]);
var zcodeWorkspaceRefSchema = z23.object({
  workspacePath: nonEmptyString3,
  workspaceIdentity: nonEmptyString3.optional(),
  remoteSessionId: nonEmptyString3.optional(),
  workspaceKey: nonEmptyString3
}).strict();
var zcodePermissionDecisionSchema = z23.enum(["allow", "deny", "escalate", "modify"]);
var zcodePermissionRuleBehaviorSchema = z23.enum(["allow", "deny", "ask"]);
var zcodePermissionRuleValueSchema = z23.object({
  toolName: nonEmptyString3,
  ruleContent: z23.string().optional()
}).strict();
var zcodePermissionUpdateSchema = z23.object({
  type: z23.literal("addRules"),
  behavior: zcodePermissionRuleBehaviorSchema,
  rules: z23.array(zcodePermissionRuleValueSchema).min(1)
}).strict();
var zcodePermissionResponseSchema = z23.object({
  decision: zcodePermissionDecisionSchema,
  reason: z23.string().optional(),
  modifiedInput: z23.unknown().optional(),
  permissionUpdates: z23.array(zcodePermissionUpdateSchema).optional()
}).strict();
var zcodeSessionModeSchema = z23.enum(["plan", "build", "edit", "yolo", "auto"]);
var zcodeSessionStatusSchema = z23.enum([
  "idle",
  "running",
  "waiting",
  "paused",
  "completed",
  "error"
]);
var zcodeSessionKindSchema = z23.enum([
  "interactive",
  "fork",
  "selection_side_chat",
  "workflow_parent",
  "workflow_child",
  "subagent_child",
  "nested_workflow_child"
]);
var zcodeSessionGoalSchema = z23.object({
  sessionId: nonEmptyString3,
  targetId: nonEmptyString3,
  objective: nonEmptyString3,
  // 旧版持久化 session target 不包含 summaryTitle。
  // 协议读取历史 snapshot 时补 null，避免老会话恢复失败。
  summaryTitle: z23.string().min(1).nullable().default(null),
  status: z23.enum(["active", "paused", "budget_limited", "complete"]),
  tokenBudget: z23.number().int().positive().nullable(),
  tokensUsed: z23.number().int().nonnegative(),
  timeUsedSeconds: z23.number().int().nonnegative(),
  activeInputId: nonEmptyString3.nullable().optional(),
  activeRunStartedAtMs: timestampMsSchema.nullable().optional(),
  activeRunLastSeenAtMs: timestampMsSchema.nullable().optional(),
  createdAt: timestampMsSchema,
  updatedAt: timestampMsSchema
}).strict();
var zcodeSessionGoalVerificationSchema = z23.object({
  nextAction: z23.string().nullable().optional(),
  passed: z23.boolean(),
  reason: z23.string()
}).strict();
var zcodeSessionGoalVerificationTimelineSchema = z23.object({
  version: z23.literal(1),
  kind: z23.literal("synthetic"),
  type: z23.literal("goal_verification"),
  display: z23.literal("separator"),
  targetId: nonEmptyString3,
  verificationId: nonEmptyString3,
  status: z23.enum(["started", "completed", "failed_closed", "cancelled"]),
  verification: zcodeSessionGoalVerificationSchema.optional(),
  goalIteration: z23.number().int().positive().optional(),
  anchorAssistantMessageId: nonEmptyString3.optional(),
  anchorTurnId: nonEmptyString3.optional(),
  startedAt: timestampMsSchema.optional(),
  updatedAt: timestampMsSchema
}).strict();
var zcodeSessionInfoSchema = z23.object({
  sessionId: nonEmptyString3,
  workspace: zcodeWorkspaceRefSchema,
  parentSessionId: nonEmptyString3.optional(),
  traceId: nonEmptyString3.optional(),
  sessionKind: zcodeSessionKindSchema,
  title: z23.string(),
  titleSource: z23.enum(["default", "first_input", "generated", "custom"]).optional(),
  mode: zcodeSessionModeSchema,
  status: zcodeSessionStatusSchema,
  model: modelSelectionSchema.optional(),
  target: zcodeSessionGoalSchema.nullable().optional(),
  createdAt: timestampMsSchema,
  updatedAt: timestampMsSchema,
  archivedAt: timestampMsSchema.optional()
}).strict();
var zcodeInteractionRequestOriginSchema = z23.object({
  kind: z23.literal("subagent"),
  agentId: nonEmptyString3,
  agentType: nonEmptyString3,
  childSessionId: nonEmptyString3,
  childTurnId: nonEmptyString3.optional(),
  description: z23.string().optional(),
  parentSessionId: nonEmptyString3,
  parentToolCallId: nonEmptyString3.optional(),
  parentTurnId: nonEmptyString3.optional()
}).strict();
var messageTimeSchema = z23.object({
  created: timestampMsSchema,
  completed: timestampMsSchema.optional()
}).strict();
var zcodeTokenUsageSchema = z23.object({
  total: z23.number().int().nonnegative().optional(),
  input: z23.number().int().nonnegative(),
  output: z23.number().int().nonnegative(),
  reasoning: z23.number().int().nonnegative(),
  cache: z23.object({
    read: z23.number().int().nonnegative(),
    write: z23.number().int().nonnegative()
  }).strict()
}).strict();
var zcodeMessageSemanticsSchema = z23.object({
  origin: z23.enum(["real_user", "agent_runtime", "system", "migration", "import"]),
  kind: z23.enum([
    "user_prompt",
    "slash_command",
    "system_reminder",
    "background_notification",
    "subagent_notification",
    "todo_reminder",
    "rewind_notice",
    "fork_notice",
    "timeline_event",
    "compact_summary",
    "shared_context",
    "assistant_response"
  ]),
  source: z23.string().optional(),
  commandName: z23.string().optional(),
  uiVisibility: z23.enum(["visible", "hidden", "debug"]),
  providerVisibility: z23.enum(["visible", "hidden"]),
  transcriptVisibility: z23.enum(["visible", "hidden"])
}).strict();
var zcodeUserMessageInfoSchema = z23.object({
  messageId: nonEmptyString3,
  sessionId: nonEmptyString3,
  role: z23.literal("user"),
  time: messageTimeSchema,
  agent: nonEmptyString3,
  // 旧消息或未绑定会话的合成消息可能没有请求来源；不借默认模型补写。
  model: modelSelectionSchema.optional(),
  system: z23.string().optional(),
  tools: z23.record(z23.string(), z23.boolean()).optional(),
  synthetic: z23.boolean().optional(),
  source: zcodeSyntheticUserMessageSourceSchema.optional(),
  visibility: zcodeMessageVisibilitySchema.optional(),
  semantics: zcodeMessageSemanticsSchema.optional(),
  metadata: jsonObjectSchema.optional()
}).strict();
var zcodeAssistantMessageInfoSchema = z23.object({
  messageId: nonEmptyString3,
  sessionId: nonEmptyString3,
  role: z23.literal("assistant"),
  time: messageTimeSchema,
  parentMessageId: nonEmptyString3,
  agent: nonEmptyString3,
  model: modelSelectionSchema.optional(),
  path: z23.object({
    cwd: nonEmptyString3,
    root: nonEmptyString3
  }).strict(),
  cost: z23.number().nonnegative(),
  tokens: zcodeTokenUsageSchema,
  finish: z23.string().optional(),
  error: jsonObjectSchema.optional(),
  semantics: zcodeMessageSemanticsSchema.optional(),
  structured: z23.unknown().optional()
}).strict();
var zcodeMessageInfoSchema = z23.discriminatedUnion("role", [
  zcodeUserMessageInfoSchema,
  zcodeAssistantMessageInfoSchema
]);
var partBaseSchema = z23.object({
  partId: nonEmptyString3,
  sessionId: nonEmptyString3,
  messageId: nonEmptyString3
});
var zcodeToolStateSchema = z23.discriminatedUnion("status", [
  z23.object({
    status: z23.literal("pending"),
    input: jsonObjectSchema,
    raw: z23.string()
  }).strict(),
  z23.object({
    status: z23.literal("running"),
    input: jsonObjectSchema,
    title: z23.string().optional(),
    metadata: jsonObjectSchema.optional(),
    startedAt: timestampMsSchema
  }).strict(),
  z23.object({
    status: z23.literal("completed"),
    input: jsonObjectSchema,
    output: z23.string(),
    title: z23.string(),
    metadata: jsonObjectSchema,
    startedAt: timestampMsSchema,
    completedAt: timestampMsSchema
  }).strict(),
  z23.object({
    status: z23.literal("error"),
    input: jsonObjectSchema,
    error: z23.string(),
    metadata: jsonObjectSchema.optional(),
    startedAt: timestampMsSchema,
    completedAt: timestampMsSchema
  }).strict()
]);
var zcodeTimelineModelSelectionSchema = modelSelectionSchema.extend({
  label: z23.string().optional()
});
var zcodeTimelinePartTimeSchema = z23.object({
  start: timestampMsSchema.optional(),
  end: timestampMsSchema.optional()
}).strict();
var zcodeTimelinePartSchema = partBaseSchema.extend({
  type: z23.literal("timeline"),
  timelineType: z23.enum([
    "context_compaction",
    "goal_verification",
    "session_fork",
    "model_change"
  ]),
  display: z23.enum(["separator", "worklog"]),
  status: z23.string().optional(),
  anchorMessageId: nonEmptyString3.optional(),
  anchorTurnId: nonEmptyString3.optional(),
  time: zcodeTimelinePartTimeSchema.optional(),
  operationId: z23.string().optional(),
  trigger: z23.enum(["manual", "auto", "partial", "reactive", "session_memory"]).optional(),
  phase: z23.enum(["standalone_turn", "pre_request", "mid_turn", "reactive"]).optional(),
  compactReason: z23.string().optional(),
  boundaryId: z23.string().optional(),
  summaryMessageId: nonEmptyString3.optional(),
  preCompactTokenCount: z23.number().int().nonnegative().optional(),
  postCompactTokenCount: z23.number().int().nonnegative().optional(),
  truePostCompactTokenCount: z23.number().int().nonnegative().optional(),
  attempt: z23.number().int().nonnegative().optional(),
  maxAttempts: z23.number().int().nonnegative().optional(),
  reason: z23.string().optional(),
  targetId: z23.string().optional(),
  verificationId: z23.string().optional(),
  goalIteration: z23.number().int().nonnegative().optional(),
  verification: z23.object({
    passed: z23.boolean(),
    reason: z23.string(),
    nextAction: z23.string().nullable().optional()
  }).strict().optional(),
  parentSessionId: nonEmptyString3.optional(),
  targetMessageId: nonEmptyString3.optional(),
  targetCheckpointId: z23.string().optional(),
  restoredFileCount: z23.number().int().nonnegative().optional(),
  fromModel: zcodeTimelineModelSelectionSchema.optional(),
  toModel: zcodeTimelineModelSelectionSchema.extend({
    label: nonEmptyString3
  }).optional()
}).strict();
var zcodeMessagePartSchema = z23.discriminatedUnion("type", [
  partBaseSchema.extend({
    type: z23.literal("text"),
    text: z23.string(),
    synthetic: z23.boolean().optional(),
    ignored: z23.boolean().optional(),
    metadata: jsonObjectSchema.optional()
  }).strict(),
  partBaseSchema.extend({
    type: z23.literal("reasoning"),
    text: z23.string(),
    metadata: jsonObjectSchema.optional()
  }).strict(),
  partBaseSchema.extend({
    type: z23.literal("file"),
    mime: nonEmptyString3,
    filename: z23.string().optional(),
    url: nonEmptyString3,
    metadata: jsonObjectSchema.optional()
  }).strict(),
  partBaseSchema.extend({
    type: z23.literal("tool"),
    callId: nonEmptyString3,
    tool: nonEmptyString3,
    state: zcodeToolStateSchema,
    metadata: jsonObjectSchema.optional()
  }).strict(),
  partBaseSchema.extend({ type: z23.literal("step-start"), snapshot: z23.string().optional() }).strict(),
  partBaseSchema.extend({
    type: z23.literal("step-finish"),
    reason: z23.string(),
    snapshot: z23.string().optional(),
    cost: z23.number().nonnegative(),
    tokens: zcodeTokenUsageSchema
  }).strict(),
  partBaseSchema.extend({ type: z23.literal("snapshot"), snapshot: z23.string() }).strict(),
  partBaseSchema.extend({
    type: z23.literal("patch"),
    hash: nonEmptyString3,
    files: z23.array(z23.string())
  }).strict(),
  partBaseSchema.extend({
    type: z23.literal("compaction"),
    auto: z23.boolean(),
    reason: z23.string().optional(),
    summaryMessageId: nonEmptyString3.optional(),
    metadata: jsonObjectSchema.optional()
  }).strict(),
  zcodeTimelinePartSchema,
  partBaseSchema.extend({
    type: z23.literal("subagent"),
    prompt: z23.string(),
    description: z23.string(),
    agent: nonEmptyString3,
    model: modelSelectionSchema.optional(),
    command: z23.string().optional()
  }).strict(),
  partBaseSchema.extend({ type: z23.literal("agent"), name: nonEmptyString3 }).strict(),
  partBaseSchema.extend({
    type: z23.literal("retry"),
    attempt: z23.number().int().nonnegative(),
    error: jsonObjectSchema
  }).strict()
]);
var zcodeMessageWithPartsSchema = z23.object({
  info: zcodeMessageInfoSchema,
  parts: z23.array(zcodeMessagePartSchema)
}).strict();
var zcodeSessionApiRetryStatusSchema = z23.object({
  kind: z23.literal("api_retry"),
  attempt: z23.number().int().positive(),
  maxRetries: z23.number().int().nonnegative(),
  retryDelayMs: z23.number().int().nonnegative(),
  errorStatus: z23.number().int().nonnegative().nullable(),
  error: z23.string()
}).strict();
var zcodeSessionContextCacheUsageSchema = z23.object({
  inputTokens: z23.number().int().nonnegative(),
  cacheReadTokens: z23.number().int().nonnegative(),
  cacheWriteTokens: z23.number().int().nonnegative(),
  latestHitRate: z23.number().nonnegative().nullable().optional(),
  hitRateRequestCount: z23.number().int().nonnegative().optional(),
  totalInputTokens: z23.number().int().nonnegative().optional(),
  totalCacheReadTokens: z23.number().int().nonnegative().optional(),
  totalCacheWriteTokens: z23.number().int().nonnegative().optional(),
  hitRate: z23.number().nonnegative().nullable()
}).strict();
var zcodeContextUsageBreakdownSourceSchema = z23.enum([
  "system_prompt",
  "meta_user_context",
  "skills",
  "tool_prompt",
  "system_tool_schemas",
  "mcp_tool_schemas",
  "messages"
]);
var zcodeContextUsageBreakdownItemSchema = z23.object({
  source: zcodeContextUsageBreakdownSourceSchema,
  chars: z23.number().int().nonnegative()
}).strict();
var zcodeContextUsageBreakdownSchema = z23.array(zcodeContextUsageBreakdownItemSchema);
var zcodeSessionContextUsageSchema = z23.object({
  used: z23.number().int().nonnegative(),
  size: z23.number().int().positive(),
  cost: z23.object({
    amount: z23.number().nonnegative(),
    currency: nonEmptyString3
  }).strict().nullable().optional(),
  cache: zcodeSessionContextCacheUsageSchema.optional(),
  breakdown: zcodeContextUsageBreakdownSchema.optional()
}).strict();
var zcodeSessionRuntimeStateSchema = z23.object({
  eventSeq: z23.number().int().nonnegative(),
  stateRevision: z23.number().int().nonnegative(),
  deliveryKind: zcodeDeliveryKindSchema.optional(),
  activeTurnId: nonEmptyString3.optional(),
  activeTurnKind: z23.enum(["regular", "compact", "rewind"]).optional(),
  pendingRequestIds: z23.array(nonEmptyString3),
  apiRetry: zcodeSessionApiRetryStatusSchema.nullable().optional(),
  contextUsage: zcodeSessionContextUsageSchema.optional(),
  goalVerifications: z23.array(zcodeSessionGoalVerificationSchema).optional(),
  goalVerificationTimeline: z23.array(zcodeSessionGoalVerificationTimelineSchema).optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/rows.ts
import { z as z31 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-row-meta.ts
import { z as z27 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/create-workflow-display.ts
import { z as z24 } from "zod";
var namePatternSchema = z24.object({
  head: z24.string().min(1).max(128).optional(),
  tail: z24.string().min(1).max(128).optional()
}).strict();
var workflowEdgeSchema = z24.object({
  from: z24.string().min(1).max(64),
  to: z24.string().min(1).max(64),
  back: z24.literal(true).optional()
}).strict();
var toolCallCreateWorkflowCausalityGraphSchema = z24.object({
  steps: z24.array(
    z24.object({
      id: z24.string().min(1).max(64),
      kind: z24.enum(["ask", "world-read"]),
      label: z24.string().min(1).max(128),
      // 内联 `agent()` receiver 让 label 落到兜底串时，那个名字的静态形状。
      labelPattern: namePatternSchema.optional(),
      line: z24.number().int().positive().optional(),
      column: z24.number().int().positive().optional(),
      lane: z24.string().min(1).max(64),
      lanes: z24.array(z24.string().min(1).max(64)).max(32).optional(),
      // 展开自的站点 id，只出现在 may-set 车道展开的拷贝上（实时叠加的关联键）；
      // 加字段是 additive 的，不带它的旧载荷照常通过 .strict()。
      source: z24.string().min(1).max(64).optional(),
      // 作者用 `phase("…")` 标记划入的阶段。
      // 与图的 phases / phaseEdges / exits 同进同退：全在场或全缺席。
      phase: z24.string().min(1).max(64).optional(),
      repeat: z24.enum(["stack", "serial"]).optional()
    }).strict()
  ).max(64),
  lanes: z24.array(
    z24.object({
      id: z24.string().min(1).max(64),
      name: z24.string().min(1).max(128).optional(),
      // `name` 缺席而 agent() 首参是带洞的模板串时的静态形状；与 name 互斥。
      namePattern: namePatternSchema.optional(),
      line: z24.number().int().positive().optional(),
      column: z24.number().int().positive().optional()
    }).strict()
  ).max(32),
  // 参与者 = 每阶段一张子代理卡（工作区 / 未解析同形）；数组顺序就是交接序，第一张是开局者。
  // fan-out 家族按字面量基数展开成 member，基数未知时一张 many 卡。
  participants: z24.array(
    z24.object({
      id: z24.string().min(1).max(64),
      phase: z24.string().min(1).max(64),
      lane: z24.string().min(1).max(64),
      steps: z24.array(z24.string().min(1).max(64)).min(1).max(64),
      member: z24.object({ index: z24.number().int().nonnegative(), of: z24.number().int().positive() }).strict().optional(),
      many: z24.literal(true).optional()
    }).strict()
  ).max(64),
  // 交接 = 参与者之间的 runs after；types 是跨越它的产物类型（检视器素材，不上箭头）。
  handoffs: z24.array(
    workflowEdgeSchema.extend({ types: z24.array(z24.string().min(1).max(128)).min(1).max(8).optional() }).strict()
  ).max(256),
  // 阶段词汇表：作者施加的分组结构，主画面以它为节点。与 phaseEdges / exits / Step.phase
  // 全有或全无——零标记脚本全缺席，UI 据此退回 step/车道视图。零成员阶段也在表里。
  // `unphased` 无 name，显示名由 UI 本地化。
  phases: z24.array(
    z24.object({
      id: z24.string().min(1).max(64),
      name: z24.string().min(1).max(128).optional(),
      line: z24.number().int().positive().optional(),
      column: z24.number().int().positive().optional(),
      // 进入本阶段时还在跑的其他阶段（它们的 strand 尚未 join），阶段表序，不含自己，
      // 为空时缺席。是节点事实而不是边——控制没有从那里转移过来，所以不进 phaseEdges。
      // 时间轴据此把相邻阶段折成一条分叉的「带」，侧栏迷你轨道画成双线段。
      alongside: z24.array(z24.string().min(1).max(64)).min(1).max(32).optional()
    }).strict()
  ).max(32).optional(),
  phaseEdges: z24.array(workflowEdgeSchema).max(128).optional(),
  // 控制流可在其后正常完成的阶段（阶段视图的「阶段 → 返回物」箭头）；组内可为空数组。
  exits: z24.array(z24.string().min(1).max(64)).max(32).optional(),
  sink: z24.array(z24.string().min(1).max(64)).max(64).optional(),
  truncated: z24.boolean().optional()
}).strict();
var toolCallCreateWorkflowDisplaySchema = z24.object({
  kind: z24.literal("create_workflow"),
  ok: z24.boolean(),
  errorCount: z24.number().int().nonnegative(),
  diagnostics: z24.array(
    z24.object({
      line: z24.number().int().nonnegative(),
      column: z24.number().int().nonnegative(),
      code: z24.number().int().nonnegative(),
      message: z24.string().min(1).max(2048)
    }).strict()
  ).max(100),
  causalityGraph: toolCallCreateWorkflowCausalityGraphSchema.optional(),
  truncated: z24.boolean().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-runs.ts
import { z as z26 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-artifacts.ts
import { z as z25 } from "zod";
var workflowRunArtifactKindSchema = z25.enum([
  "file",
  "markdown",
  "chart",
  "table",
  "metrics",
  "board"
]);
var WORKFLOW_ARTIFACT_LIMITS = {
  maxIdLength: 64,
  maxTitleLength: 120,
  maxDescriptionLength: 500,
  /** 每 id ≤ 16 版（`ARTIFACT_CAPS.maxVersionsPerArtifact`）。 */
  maxVersions: 16,
  /** `workflowRunArtifactData` 一页的条目上界；`limit` 的钳制在网关侧。 */
  maxItemsPerPage: 500,
  /** 一页的缺省条数（调用方不传 limit 时网关用它）。 */
  defaultItemsPerPage: 200
};
var workflowRunArtifactVersionSchema = z25.object({
  version: z25.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  title: z25.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxTitleLength).optional(),
  description: z25.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxDescriptionLength).optional(),
  contentType: z25.string().min(1).max(128).optional(),
  /** 该版本在 store 里的字节数（内容成员才有）。 */
  bytes: z25.number().int().nonnegative().optional(),
  /** store 的 `zcode-artifact://…`；**只给 CLI 侧用**，模型与 renderer 都读不了它。 */
  uri: z25.string().min(1).max(512).optional(),
  /** 工作区相对的原路径（`file` 才有）——卡片的「在工作区显示」按它定位。 */
  sourcePath: z25.string().min(1).max(1024).optional(),
  /** 预置看板的 spec（canonical）。形状由 UI 的四个渲染器各自解释，协议不复述。 */
  spec: z25.unknown().optional(),
  /** 发布时刻（epoch 毫秒）。 */
  publishedAt: z25.number().int().nonnegative(),
  /** 这一版属于 run 的交付物；引擎盖章，按 id 粘着。 */
  primary: z25.literal(true).optional()
}).strict();
var workflowRunArtifactSchema = z25.object({
  id: z25.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxIdLength),
  kind: workflowRunArtifactKindSchema,
  title: z25.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxTitleLength).optional(),
  description: z25.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxDescriptionLength).optional(),
  contentType: z25.string().min(1).max(128).optional(),
  sourcePath: z25.string().min(1).max(1024).optional(),
  spec: z25.unknown().optional(),
  /** 最新版号（= `versions` 末项的 version）。 */
  version: z25.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  /** 版本升序。失败的发布**不在**这里：失败行不认领 id / 种类 / 版本。 */
  versions: z25.array(workflowRunArtifactVersionSchema).max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  /** 打了这个 id 标签的 `report` 条目数（预置看板的数据量；内容产物恒 0）。 */
  itemCount: z25.number().int().nonnegative(),
  /** run 的交付物（至多一件）；清单以它带头。 */
  primary: z25.literal(true).optional()
}).strict();
var workflowRunArtifactSummarySchema = z25.object({
  id: z25.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxIdLength),
  kind: workflowRunArtifactKindSchema,
  title: z25.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxTitleLength).optional(),
  version: z25.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  contentType: z25.string().min(1).max(128).optional(),
  bytes: z25.number().int().nonnegative().optional(),
  itemCount: z25.number().int().nonnegative().optional(),
  /** run 的交付物（至多一件）。UI 据它排先后与选形态；缺席即不是。 */
  primary: z25.literal(true).optional()
}).strict();
var v4ConversationWorkflowRunArtifactsParamsSchema = z25.object({
  sessionId: z25.string().min(1),
  runId: z25.string().min(1)
}).strict();
var v4ConversationWorkflowRunArtifactsResultSchema = z25.object({
  /** 按首次出现顺序（= journal 里该 id 第一条 artifact 行的 ordinal）。 */
  artifacts: z25.array(workflowRunArtifactSchema)
}).strict();
var v4ConversationWorkflowRunArtifactDataParamsSchema = z25.object({
  sessionId: z25.string().min(1),
  runId: z25.string().min(1),
  artifactId: z25.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxIdLength),
  /** 只取 sequence 严格大于该值的条目；缺省从头取。 */
  afterSequence: z25.number().int().nonnegative().optional(),
  /** 缺省 200、钳 [1, 500]——两者都在网关侧执行（存储层不得自造页大小，也不得再钳）。 */
  limit: z25.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxItemsPerPage).optional()
}).strict();
var v4ConversationWorkflowRunArtifactDataResultSchema = z25.object({
  items: z25.array(
    z25.object({
      /** journal sequence——回传成 `afterSequence` 就是下一页的游标。 */
      sequence: z25.number().int().nonnegative(),
      /** 产出该条目的 report 站点（如 `report#1`）。 */
      siteId: z25.string().min(1).max(64),
      ordinal: z25.number().int().nonnegative(),
      /**
       * 条目原值，**不做预览序列化**：看板的纯函数要按字段路径取数
       * （`ChartSpec.x.field` 形如 "timing.after"），拿到一段 pretty JSON 文本就没法取了。
       * 单条在线上已由 `REPORT_CAPS.maxItemSerializedBytes`（32KB）与事件载荷有界化
       * 双重保证，这里不再叠一层界。
       */
      item: z25.unknown()
    }).strict()
  ),
  /** 本页取满 limit 且后面仍有条目（网关多取一条判定）。 */
  hasMore: z25.boolean()
}).strict();
var v4ConversationWorkflowRunArtifactReadParamsSchema = z25.object({
  sessionId: z25.string().min(1),
  runId: z25.string().min(1),
  artifactId: z25.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxIdLength),
  version: z25.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  offset: z25.number().int().nonnegative(),
  limit: z25.number().int().positive().max(PROTOCOL_V4_LIMITS.attachmentChunkMaxBytes)
}).strict();
var v4ConversationWorkflowRunArtifactReadResultSchema = z25.object({
  /** base64（不带 data: 前缀）；解码后 ≤ attachmentChunkMaxBytes。 */
  dataBase64: z25.string(),
  /**
   * 该版本的 contentType，取 journal 记录上的值（driver 按扩展名表算出、`opts.contentType`
   * 可覆盖）——那是 UI 分派渲染器的**精确匹配**契约。刻意不像 attachmentRead 那样把
   * mediaType 限死在 image/video/pdf：产物的合法类型就是 driver 那张 17 项扩展名表加
   * `application/octet-stream`，限死会让 markdown 与 office 文件整条读不出来。
   */
  mediaType: z25.string().min(1).max(128),
  /** 该版本的总字节数（≤ ARTIFACT_CAPS.maxFileBytes = attachmentMaxBytes）。 */
  totalBytes: z25.number().int().nonnegative().max(PROTOCOL_V4_LIMITS.attachmentMaxBytes),
  /** 下一块的 offset；本块读到尾时为 null。 */
  nextOffset: z25.number().int().positive().nullable()
}).strict().superRefine((value, context) => {
  const decodedBytes = decodedBase64ByteLength(value.dataBase64);
  if (decodedBytes === null) {
    context.addIssue({ code: "custom", message: "invalid base64", path: ["dataBase64"] });
    return;
  }
  if (decodedBytes > PROTOCOL_V4_LIMITS.attachmentChunkMaxBytes) {
    context.addIssue({
      code: "too_big",
      maximum: PROTOCOL_V4_LIMITS.attachmentChunkMaxBytes,
      origin: "string",
      inclusive: true,
      message: "workflow artifact read chunk exceeds decoded byte limit",
      path: ["dataBase64"]
    });
  }
  if (value.nextOffset !== null && value.nextOffset > value.totalBytes) {
    context.addIssue({
      code: "custom",
      message: "nextOffset exceeds totalBytes",
      path: ["nextOffset"]
    });
  }
});
function decodedBase64ByteLength(value) {
  if (value.length === 0) return 0;
  if (value.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return value.length / 4 * 3 - padding;
}

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-runs.ts
var WORKFLOW_RUNS_LIMITS = {
  /** 最近若干个 run；超出按最旧淘汰。 */
  maxRuns: 8,
  /**
   * actors 与 nodes 使用相同的容量上限，避免节点可展示而所属子代理提前被截断。
   * 键级增量使每个事件只传输改动部分；容量上限用于限制单条 run 的投影大小，
   * 并限制异常脚本持续创建条目带来的资源消耗。跨 run 的总量由 {@link maxTotalEntries} 控制。
   * 这是展示状态的容量限制，不限制引擎实际运行的子代理数量。
   */
  maxActors: 1024,
  maxNodes: 1024,
  /**
   * 整个状态键的条目预算：所有 run 的 `nodes.length + actors.length` 之和。
   *
   * 单条 run 的界乘以 {@link maxRuns} 是 16384 条，按每条约 150 字节算就是 ~2.5 MB ——
   * 离 16 MiB 的快照上限不远，而快照是要整份序列化的。预算把最坏情形压回 ~1 MB，
   * 代价是**最旧的终态 run** 会提前离场（它的完整事实仍在 journal 里，详情页照样查得到）。
   * 归约在超预算时只淘汰终态 run，绝不动在跑的 run，也绝不动事件所属的那条。
   */
  maxTotalEntries: 6144,
  /**
   * 详情页 Results 区的**展示**预算，刻意远小于引擎的 run 级 report 上限（256 条）：
   * 协议线上的界是展示预算，引擎的界才是契约，两者不必相等。超出这个界的条目仍在
   * journal 里（`dwf_node.kind = "report"`），只是不进这条高频状态键。
   */
  maxReports: 64,
  maxReportPreviewLength: 2048,
  maxResultPreviewLength: 2048,
  maxErrorLength: 2048,
  /**
   * 同时停驻的升级问题条数。引擎侧的真实上界是
   * per-ask 3 条 × 在飞 ask 数（maxConcurrency），32 因此在任何现实 caps 下都够用；
   * 它同时是一道防线——一个疯掉的脚本不该能把一个高频状态键撑爆。
   */
  maxPendingQuestions: 32,
  /** 问题与补充说明的展示上界。与事件载荷的字符串界（2048）同值，所以正常路径永不截断。 */
  maxQuestionLength: 2048,
  /** 并发桶的 provider key（`${providerId}/${modelId}`）上界。 */
  maxConcurrencyKeyLength: 256,
  /**
   * 子代理模型串（`providerId/modelId`，可带 `$reasoningLevel` 后缀）的线上上界。与并发桶的
   * provider key 同值：两者是同一族标识串，只是这一条可能多一个推理档后缀。
   */
  maxSubagentModelLength: 256,
  /**
   * `run.concurrencyCeiling` 的上界。天花板按 `min(16, cores − 2)` 推导，这条界只挡坏载荷
   * （reducer 读到界外的值当作读不出，沿用已知值）。
   */
  maxConcurrencyCeiling: 1024,
  /**
   * 子代理展示名的线上上界（actor.name 与 pendingQuestion.actorName 同值）。名字是脚本作者
   * 写的任意字符串（`agent("reader-" + paths.join("+"))`），reducer 必须按这条界裁剪后再上线：
   * 曾因一个 131 字的名字让父会话之后的每一帧被渲染端拒收，订阅永久失效。
   */
  maxActorNameLength: 128,
  /**
   * 用户面产物的条数。与引擎侧的
   * `ARTIFACT_CAPS.maxArtifactsPerRun` **同值**，理由与 maxReports 的「展示预算 <
   * 引擎契约」相反：产物的引擎上限本来就是 32，把展示界压得更低只会让一个跑在上限上的
   * 脚本在侧板里静默少掉几张卡，而这些卡正是这个特性存在的全部理由。
   */
  maxArtifacts: 32,
  /**
   * 被进入过的阶段条数。与 display
   * 载荷的 `CREATE_WORKFLOW_GRAPH_MAX_PHASES` 同值：时间线上画不出的阶段，投影里也不必记。
   */
  maxPhases: 32,
  /** 阶段名的线上上界，与 display 的 `CREATE_WORKFLOW_GRAPH_MAX_NAME_CHARS` 同值（UI 按名字关联两边）。 */
  maxPhaseNameLength: 128,
  /**
   * 一次 ask 的**任务摘要**上界（`node-queued` 的 `instructionsHead`）。与引擎侧的
   * `INSTRUCTIONS_HEAD_MAX_CHARS` 同值：那一头已经按这条界切好，这里是线上的第二道闸。
   * 240 是「一眼看出这个子代理被派去干什么」所需的长度——再长就是在协议线上搬运指令全文，
   * 而指令全文有 journal 与子代理转录两处可去。
   */
  maxInstructionsHeadLength: 240,
  /** 最近一次工具调用的工具名上界（与 actor/node 的 siteId 同量级，工具名是标识符不是文本）。 */
  maxLastToolNameLength: 64,
  /**
   * 最近一次工具调用的**目标**上界（文件路径、命令头）。与引擎侧的
   * `LAST_TOOL_TARGET_MAX_CHARS` 同值。这条界同时是一条安全界：它只放得下一个路径或命令头，
   * 放不下参数全文或文件内容——后两者永远不该出现在这条高频状态键上。
   */
  maxLastToolTargetLength: 120
};
var workflowRunPhaseSchema = z26.object({
  name: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength),
  rounds: z26.number().int().positive()
});
var workflowRunUnlistedPhaseSchema = z26.object({
  phaseName: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength).optional(),
  actors: z26.number().int().nonnegative(),
  actorsSettled: z26.number().int().nonnegative().optional(),
  actorsFailed: z26.number().int().nonnegative().optional(),
  settled: z26.number().int().nonnegative()
});
var workflowRunUsageSchema = z26.object({
  spentTokens: z26.number().int().nonnegative(),
  nodesUsed: z26.number().int().nonnegative(),
  /**
   * 撞上 {@link WORKFLOW_RUNS_LIMITS.maxNodes} 被**拒之表外**的实例数，以及其中已结算的条数。`truncated` 只说得出「有东西没进来」，说不出
   * 有多少——于是一个 3000 路 fan-out 的 run 在读面上会显示成「1024 步」，那是一句假话。
   *
   * 两条都是**加出来**的计数（被拒实例根本不在表里，没有可去重的身份），所以归约只在事件
   * **抬过水位**时才计，重传的队尾事件不会把它们越推越高。`run-started` 连同整个 usage 一起
   * 清零：resume 会把脚本前缀重发一遍，不清零等于把两世的步数加在一起。零时整个键缺席。
   */
  nodesUnlisted: z26.number().int().nonnegative().optional(),
  nodesUnlistedSettled: z26.number().int().nonnegative().optional()
});
var workflowRunActorSchema = z26.object({
  siteId: z26.string().min(1).max(64),
  ordinal: z26.number().int().nonnegative(),
  name: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxActorNameLength).optional(),
  sessionId: z26.string().min(1).max(256).optional(),
  status: z26.enum(["waiting", "running", "completed"]),
  /**
   * 这个实例**出生**在哪个阶段：它的 ordinal 被铸造的那一刻，控制流所在的 `phase("…")` 标记名。UI 按**名字**与 `phases[].name`
   * 关联——名字是引擎与分析器唯一共享的词汇，所以界与 `maxPhaseNameLength` 同值。
   *
   * 缺席有两种读法，消费者都要认：出生在任何标记之前（脚本没写 `phase()`，或写在后面），
   * 或者发事件的是不带这个键的旧 CLI。
   */
  phaseName: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength).optional()
});
var workflowRunNodeLastToolSchema = z26.object({
  name: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxLastToolNameLength),
  target: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxLastToolTargetLength).optional()
});
var workflowRunNodeSchema = z26.object({
  siteId: z26.string().min(1).max(64),
  ordinal: z26.number().int().nonnegative(),
  kind: z26.enum(["ask", "world-read"]).optional(),
  phase: z26.enum(["queued", "dispatched", "executing", "waiting", "repairing", "nudged", "settled"]),
  outcome: z26.enum(["ok", "failed", "cancelled"]).optional(),
  cached: z26.boolean().optional(),
  /** 该节点所属 actor 的站点 id（world-read 无 actor）。 */
  actorSiteId: z26.string().min(1).max(64).optional(),
  actorOrdinal: z26.number().int().nonnegative().optional(),
  /**
   * 这个实例**出生**在哪个阶段，
   * 语义与 {@link workflowRunActorSchema} 的同名键逐字相同：ordinal 被铸造那一刻的
   * `phase("…")` 标记名，UI 按名字与 `phases[].name` 关联；缺席 = 出生在任何标记之前，或旧 CLI。
   *
   * ⚠ 与上面的 `phase` **不是**一回事：`phase` 是节点的生命周期相位（queued / executing /
   * settled…），`phaseName` 是脚本阶段坐标。字段特意不叫 `phase` 就是为了不把两个概念揉在一起。
   *
   * 引擎只在**出生事件**上打戳（`node-queued`，以及 replay 命中时直接发的
   * `node-settled { cached: true }`）；其余 `node-*` 不带，由 reducer 向前携带。
   */
  phaseName: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength).optional(),
  /**
   * 这次 ask 的**任务**：作者写的 `instructions` 的头 240 字，随 `node-queued` 到达。读面据它回答「这个子代理被派去干什么」——
   * 相位只说得出「在跑」，说不出在跑什么。
   *
   * 是**作者原文**的头，不含引擎后来追加的尾注（那些是运行时脚手架，不是任务）。
   * 缺席有两种读法，消费者都要认：world-read 节点（没有指令），或不带这个键的旧 CLI/旧 journal。
   */
  instructionsHead: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxInstructionsHeadLength).optional(),
  /**
   * 这次 ask 走到第几个已解析轮次（1 起，nudge 轮次计入），以及累计工具调用数与最近一次
   * 工具调用——随 `node-progress` 到达，每个已解析轮次一条。
   *
   * 三者一起回答「它在动吗」：一个卡在 `executing` 十分钟的 ask，只有这几个读数能分出
   * 「在干一件长活」与「已经死了」。**没有 `node-progress` 的旧 journal 上三键全缺席**，
   * 读面必须把缺席显示成「不知道」，而不是显示成 0 —— 0 是「一个工具都没调过」的事实。
   *
   * 归约是**后来者覆盖**而不是取 max（与 `phases[].rounds` 相反）：同一实例在 resume 里被
   * 重新 queue 时是一次全新的 ask，轮次从 1 重新数，取 max 会把上一世的读数冻在这里。
   */
  turn: z26.number().int().positive().optional(),
  toolCalls: z26.number().int().nonnegative().optional(),
  lastTool: workflowRunNodeLastToolSchema.optional()
});
var workflowRunConcurrencySchema = z26.object({
  key: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxConcurrencyKeyLength).optional(),
  cap: z26.number().int().positive(),
  ceiling: z26.number().int().positive(),
  limit: z26.number().int().positive().optional(),
  cooldownMs: z26.number().int().nonnegative().optional()
});
var workflowRunReportSchema = z26.object({
  siteId: z26.string().min(1).max(64),
  ordinal: z26.number().int().nonnegative(),
  preview: z26.string().max(WORKFLOW_RUNS_LIMITS.maxReportPreviewLength),
  /**
   * `report(item, artifactId)` 的第二实参：这条条目喂给哪个**预置看板**。缺席 = 没打标签，照旧只进 Results 区。
   *
   * 带标签的条目**仍然进 `reports`**：一条通道一套上限，标签只是多一个去处，不是改道。
   * 上界与产物 id 同（64），因为它就是一个产物 id。
   */
  artifactId: z26.string().min(1).max(64).optional()
});
var workflowRunPendingQuestionSchema = z26.object({
  /** 全局唯一的问题 id（形如 `dwfq-<runId 片段>-<seq>`）。主代理按它作答。 */
  qid: z26.string().min(1).max(128),
  actorSiteId: z26.string().min(1).max(64).optional(),
  actorOrdinal: z26.number().int().nonnegative().optional(),
  actorName: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxActorNameLength).optional(),
  question: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxQuestionLength),
  context: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxQuestionLength).optional(),
  /**
   * 提问时刻（epoch 毫秒），由事件携带——本模块是纯归约，没有时钟可用。
   *
   * 事件侧**必填**（driver 是唯一生产者，与停驻记录取同一个 `Date.now()`），这里仍然 optional：
   * 老开发机上的 journal 可能重放出 askedAt 之前的事件。所以渲染侧按「有则显示等待时长」处理，
   * 缺席不是错误。
   */
  askedAt: z26.number().int().nonnegative().optional()
});
var workflowRunSchema = z26.object({
  runId: z26.string().min(1).max(128),
  /** 发起该 run 的 CreateWorkflow 工具调用（工具卡 → 详情页的关联键）。 */
  toolCallId: z26.string().min(1).max(128).optional(),
  status: z26.enum(["pending", "running", "completed", "errored", "stopped"]),
  /** `status === "stopped"` 才在场。 */
  stopReason: z26.enum(["user", "model", "provider", "interrupted", "superseded"]).optional(),
  /**
   * lineage 的两端：本 run 修订自哪个 run
   * （`run-started` 载荷的 `resumedFrom`），以及本 run 被哪次修订停下并替代（`run-settled` 载荷的
   * `supersededBy`，只随 `stopReason: "superseded"` 出现）。两者都 optional，理由与 `reports` 同：
   * 往已有状态键追加字段，旧 CLI 不发它们时少一个键是退化，不是整帧被丢。
   */
  resumedFrom: z26.string().min(1).max(128).optional(),
  supersededBy: z26.string().min(1).max(128).optional(),
  usage: workflowRunUsageSchema,
  error: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxErrorLength).optional(),
  /**
   * 可恢复。**为真才在场**。
   *
   * 由 CLI 在 `run-settled` 载荷上按 resume 门的同一个谓词给出（live 由 toProgressPayload 算，
   * 冷回放由补种按 journal 行算），reducer 只搬运——UI 绝不自行按 status + failureCode 推导
   * （两处谓词总有一天不一致：按钮亮着但命令被拒）。optional 的理由与 `reports` 同：往已有
   * 状态键追加字段，旧 CLI 不发它时少一个键是退化，不是整帧被丢。
   */
  resumable: z26.literal(true).optional(),
  resultPreview: z26.string().max(WORKFLOW_RUNS_LIMITS.maxResultPreviewLength).optional(),
  actors: z26.array(workflowRunActorSchema).max(WORKFLOW_RUNS_LIMITS.maxActors),
  nodes: z26.array(workflowRunNodeSchema).max(WORKFLOW_RUNS_LIMITS.maxNodes),
  /**
   * `report(item)` 交出的渐进产物，按报告顺序。**零条时整个键缺席**（不是空数组）：
   * Results 区据此整区不渲染，而不是给不用 `report` 的工作流留一节空壳。
   *
   * 刻意 optional 而不是必填：这是往一个**已有状态键**上追加字段，而已知键上的解析错误
   * 不会被剥离——它会让整个 `state.updated` patch 失败、整帧被丢。
   * 必填意味着任何一个不发 reports 的旧 CLI 都会触发那一档；optional 让它退化成「少一个键」。
   */
  reports: z26.array(workflowRunReportSchema).max(WORKFLOW_RUNS_LIMITS.maxReports).optional(),
  /**
   * 停驻中的升级问题，按提问顺序。**零条时整个键缺席**（不是空数组），与 `reports` 同一条
   * 惯例：侧栏据此整区不渲染，而不是给一个没人提问的 run 留一节空壳。
   *
   * 「零条」是这个键的**常态**，而且它会来回进出：问题一被作答就从表里消失，答完最后一个
   * 又退回缺席。所以消费者不能把「见过一次这个键」当成它会一直在。
   *
   * optional 的第二个理由与 `reports` 相同：这是往一个**已有状态键**上追加字段，而已知键上的
   * 解析错误不会被剥离——必填会让任何一个不发该字段的旧 CLI 整帧被丢。
   */
  pendingQuestions: z26.array(workflowRunPendingQuestionSchema).max(WORKFLOW_RUNS_LIMITS.maxPendingQuestions).optional(),
  /**
   * 并发现状（见 {@link workflowRunConcurrencySchema}）。只在**两条界里有一条低于天花板**时
   * 在场：收到过 `concurrency-changed`（共享桶被限流压低），或 `run-started` 带来一个低于天花板
   * 的 `limit`（用户给这次 run 定了上限）。两者都没有的 run 一直跑在天花板上，没有可说的。
   * optional 的理由与 `reports` / `pendingQuestions` 同。
   */
  concurrency: workflowRunConcurrencySchema.optional(),
  /**
   * 本机的并发天花板（`run-started` 载荷的 `concurrencyCeiling`，CLI 铸载荷时拼进去的进程事实）。
   * 与 `concurrency.ceiling` 不同：那是读数芯片自己的水位，只随芯片在场；这一个**只要读得到就在**，
   * 不论本 run 是否低于它——「配置」弹层的步进器停在这里。optional 的理由与 `concurrency` 同：老 CLI 不发，少一个键是退化。
   */
  concurrencyCeiling: z26.number().int().positive().max(WORKFLOW_RUNS_LIMITS.maxConcurrencyCeiling).optional(),
  /**
   * 这次 run 的**子代理**跑在哪个模型上（`CreateWorkflow` / `AmendWorkflow` 的 `subagent_model`
   * 落到载荷的 `subagentModel`），规范串 `providerId/modelId`，可带 `$reasoningLevel` 后缀。
   * 随 `run-started` 到达、整条 run 不动——与 `concurrency.limit` 同族：用户给这次 run 定下的
   * 条件，不随运行时涨落。
   *
   * **只在用户给这次 run 指定过模型时在场**：不指定的 run 里子代理跟随会话模型，没有可说的。
   * 主代理无论如何都留在会话模型上，所以这个键说的只是子代理那一侧。
   * optional 的理由与 `reports` / `concurrency` 逐字相同：往已有状态键追加字段，旧 CLI 不发它时
   * 少一个键是退化，不是整帧被丢。
   */
  subagentModel: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxSubagentModelLength).optional(),
  /**
   * 本 run 发布的**用户面产物**，按首次出现顺序，每项只带**最新版**的元数据。**零件时整个键缺席**（不是空数组）：
   * 侧板的 Artifacts 区据此整区不渲染——「无则缺席」与 `reports` / `pendingQuestions` 同规。
   *
   * optional 的第二个理由与 `reports` 逐字相同，也是这里真正要紧的那个：这是往一个**已有
   * 状态键**上追加字段，而已知键上的解析错误不会被剥离——必填会让任何一个不发产物的旧 CLI
   * 整帧被丢。少一个键是退化，不是错误。
   *
   * ⚠ 术语：这里的 artifact 是脚本发布给用户看的产出，不是 `resultPreview` 背后那个
   * 「脚本顶层返回值」（引擎内部也叫 artifact）。见 workflow-artifacts.ts 的文件头。
   */
  artifacts: z26.array(workflowRunArtifactSummarySchema).max(WORKFLOW_RUNS_LIMITS.maxArtifacts).optional(),
  /**
   * 被进入过的阶段，按首次进入顺序。
   * **零条时整个键缺席**；optional 的理由与 `reports` 逐字相同（旧 CLI 不发它，少一个键是退化
   * 不是错误）。时间线据它给零成员的站点灯、给所有站补「第一个 ask 派发之前」那段的 running。
   */
  phases: z26.array(workflowRunPhaseSchema).max(WORKFLOW_RUNS_LIMITS.maxPhases).optional(),
  /** 控制流最后进入的阶段名（最后一条 `phase-entered`）；从未进入过任何阶段时缺席。 */
  currentPhase: z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength).optional(),
  /**
   * 脚本**声明**的阶段表，按声明序（`run-launched.phaseNames`）。与 `phases`（已进入的）互补：侧栏迷你轨道据此画出前方还没到的站点。
   * 零条 / 旧 CLI / 无标记脚本时整个键缺席。
   */
  phaseNames: z26.array(z26.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength)).max(WORKFLOW_RUNS_LIMITS.maxPhases).optional(),
  /**
   * 与 `phaseNames` **按位置对齐**的「同时在跑」表（`run-launched.phaseAlongside`）：
   * `phaseAlongside[i]` 是进入 `phaseNames[i]` 时 strand 仍在跑的其他阶段的**下标**，下标落在
   * `phaseNames` 这张表上。侧栏迷你轨道据此把并行的两站之间画成双线段
   *
   * 依附 `phaseNames`：后者不在场时它一定不在场；没有任何阶段并行时同样缺席——缺席就是
   * 「这条轨道是一条直线」。归约保证每个下标都落在被接受的那张表里（workflow-runs-phases.ts）。
   */
  phaseAlongside: z26.array(z26.array(z26.number().int().nonnegative()).max(WORKFLOW_RUNS_LIMITS.maxPhases)).max(WORKFLOW_RUNS_LIMITS.maxPhases).optional(),
  /**
   * 界在各个出生阶段上花掉了多少（见 {@link workflowRunUnlistedPhaseSchema}）。**一格都没有时
   * 整个键缺席**。表长比 `maxPhases` 多一格：那一格是「无阶段」，它与具名阶段共用同一张表。
   *
   * 表满之后新阶段的归属**丢掉**，run 级两个计数器照旧准——一个站点可以少一个它本来就没有的
   * 数字，run 的总数不可以说假话。
   */
  unlistedByPhase: z26.array(workflowRunUnlistedPhaseSchema).max(WORKFLOW_RUNS_LIMITS.maxPhases + 1).optional(),
  /**
   * actors / nodes / reports / pendingQuestions / artifacts / phases 触到上限后置位；
   * 原始事实仍在 journal。淘汰（给活的新人腾位）同样置位：这条 run 的条目表已经装不下它
   * 自己的事实了，而 `run-started` 正是按这一位决定新一世要不要从空表重开。
   */
  truncated: z26.boolean().optional(),
  /** 最后一条已归约事件的 journal sequence；抬升即事件日志重取的触发条件。 */
  lastEventSequence: z26.number().int().nonnegative()
});
var workflowRunsStateSchema = z26.object({
  revision: z26.number().int().nonnegative(),
  runs: z26.array(workflowRunSchema).max(WORKFLOW_RUNS_LIMITS.maxRuns)
});

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-row-meta.ts
var workflowNotificationMetaSchema = z27.discriminatedUnion("kind", [
  z27.object({
    kind: z27.literal("terminal"),
    status: z27.enum(["completed", "errored", "stopped"]),
    // `status === "stopped"` 才在场。
    stopReason: z27.enum(["user", "model", "provider", "interrupted", "superseded"]).optional(),
    summary: z27.string().min(1).max(500),
    result: z27.string().max(4e3).optional(),
    resultForm: z27.enum(["prose", "json"]).optional(),
    resultTruncated: z27.literal(true).optional(),
    error: z27.string().max(2e3).optional(),
    reports: z27.object({
      count: z27.number().int().nonnegative(),
      shown: z27.number().int().nonnegative(),
      preview: z27.array(z27.string().max(500)).max(8)
    }).optional(),
    // 用户面产物的 chips 载荷。
    // ⚠ 术语：这里的 artifact 是脚本经 `artifact.*` 发布给用户看的产出，与同一载荷上的
    // `result`（脚本顶层返回值，引擎内部也叫 artifact）无关。
    // 只带 chip 画得下的字段：字节数 / 条目数点开侧板即可看到，chip 上放不下。
    // 上界 8，超出（含被种类过滤掉的）置 artifactsTruncated；title 的 120 与
    // ARTIFACT_CAPS.maxTitleLength 同值，发射侧就地截断。
    // 例外是交付物（`primary`）那一条：它还带 `description`（≤ 500，同 ARTIFACT_CAPS），因为
    // 完成卡把它画成一行带文字的交付物，冷 transcript 上只有这个载荷可读。清单 primary 在前。
    artifacts: z27.array(
      z27.object({
        id: z27.string().min(1).max(64),
        kind: z27.enum(["file", "markdown", "chart", "table", "metrics", "board"]),
        title: z27.string().max(120).optional(),
        version: z27.number().int().positive(),
        contentType: z27.string().max(255).optional(),
        primary: z27.literal(true).optional(),
        description: z27.string().max(500).optional()
      })
    ).max(8).optional(),
    artifactsTruncated: z27.literal(true).optional(),
    durationMs: z27.number().nonnegative().optional()
  }),
  z27.object({
    kind: z27.literal("escalation"),
    qid: z27.string().min(1),
    actor: z27.string().min(1),
    question: z27.string().min(1).max(4e3),
    context: z27.string().max(4e3).optional(),
    askedAt: z27.number().optional()
  }),
  // run 级停滞：每个 stall 段一条，不是终态。
  z27.object({
    kind: z27.literal("stall"),
    sinceMs: z27.number().int().nonnegative(),
    reason: z27.string().max(64).optional(),
    cap: z27.number().int().nonnegative().optional()
  })
]);
var backgroundResultOriginMetaSchema = z27.object({
  // 三个取值与 contracts 的 BackgroundResultOriginMeta 保持同步。
  // "workflow" 是 dynamic-workflow run（workId ≡ runId），复用整条后台通知管线。
  backgroundSource: z27.enum(["bash", "subagent", "workflow"]),
  workId: z27.string().min(1),
  title: z27.string().min(1),
  // 只在 backgroundSource === "workflow" 的单条通知轮上在场；zod 剥离未知键，
  // 这里不加即整条链路静默丢——本字段是 manifest 渲染的唯一数据源。
  workflowNotification: workflowNotificationMetaSchema.optional()
});
var workflowSubagentModelTextSchema = z27.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxSubagentModelLength);
var workflowSettingsAmendMetaSchema = z27.object({
  // 修订自哪个 run。**缺席 = 就地生效**：只改并发上限、run
  // 又在飞时，那次「配置」不停这次 run、也不另起一次，于是没有前驱可指——`runId` 指的就是被调整的
  // 那一个。渲染端据此只出那一行、不再出卡（同一条 run 画两张卡会读成两次运行）。
  // 此字段为可选；生产者和消费者需使用一致的 schema 才能解析就地调整的设置记录。
  predecessorRunId: z27.string().min(1).max(128).optional(),
  subagentModel: z27.object({
    from: workflowSubagentModelTextSchema.optional(),
    to: workflowSubagentModelTextSchema.optional()
  }).optional(),
  maxConcurrency: z27.object({
    from: z27.number().int().positive().optional(),
    to: z27.number().int().positive().optional()
  }).optional(),
  ceiling: z27.number().int().positive().optional()
});
var workflowLaunchMetaSchema = z27.object({
  // runId ≡ workId：驱动启动轮 run 卡的实时状态 / 步数，也是取消 / 恢复 / 详情侧板的联接键。
  runId: z27.string().min(1).max(128),
  // launch-<uuid> 前缀（区别于模型工具调用 id）；与合成 CreateWorkflow toolCall 同一个 id。
  toolCallId: z27.string().min(1).max(128),
  // 解析结果里的工作流名（由 agent 填，用户与模型都不能另起）。中枢启动恒在场；设置轮
  // 取被调整的 run 自己的名字，没起过名的 run 就没有——卡片与侧板照任何无名 run 的规矩换用兜底词，
  // 而不是把一个 run id 当标题。
  name: z27.string().min(1).max(200).optional(),
  // scope / path 只属于中枢启动：设置轮（下方 `amend`）改的是一个已有 run，没有保存文件可指。
  // 记录在案的偏斜：旧桌面上它们是必填，新 CLI 的设置轮在那里 parse 失败、整行被丢（与
  // origin 闭集加值同一档）；中枢启动轮两者恒在，不受影响。
  scope: z27.enum(["project", "global"]).optional(),
  // 命中的脚本落盘路径；仅供详情 / 诊断，卡片不显示。1024 覆盖深层全局 / 项目路径。
  path: z27.string().min(1).max(1024).optional(),
  // 实参键值表（卡片渲染源）。有界：序列化 ≤ 4KB，与 contracts 侧 TurnStartedPayload 同界，
  // 防止把整个大对象塞进每条持久消息与活事件。
  args: z27.record(z27.string(), z27.unknown()).refine((value) => JSON.stringify(value).length <= 4096, {
    message: "workflowLaunch.args JSON must be \u2264 4096 bytes"
  }).optional(),
  // 说明行（若有）；与实参窗 / 中枢卡同一段文案，500 与通知 summary 同界。
  description: z27.string().max(500).optional(),
  // 启动前编译得到的 create_workflow display（有界因果图 + 诊断）：run 详情侧板按 toolCallId 找
  // 「发起行」取图，直接启动没有工具行，图从这里取。与工具行 display 同一 schema。
  // 同样不设门：图解析失败只是这一行没有图，不拒整帧（见 toolDisplay.ts 注释）。
  display: toolCallCreateWorkflowDisplaySchema.optional().catch(void 0),
  // 本次 run 实际执行的脚本原文（侧板 Script 区），对应工具行的 input.script；上界与 contracts
  // WORKFLOW_LAUNCH_SCRIPT_MAX_CHARS 同值。
  script: z27.string().max(256e3).optional(),
  // 设置轮才在场：这次 run 是用「配置」从哪个 run 修订来的、改了什么。
  amend: workflowSettingsAmendMetaSchema.optional()
});

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/toolDisplay.ts
import { z as z30 } from "zod";

// ../reference/ZCode/packages/shared/src/official-mcp-tool-error.ts
var OFFICIAL_MCP_TOOL_ERROR_CODES = ["quota_exceeded", "coding_plan_required"];
var OFFICIAL_MCP_TOOL_ERROR_CODE_SET = new Set(OFFICIAL_MCP_TOOL_ERROR_CODES);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/cuaPermission.ts
import { z as z28 } from "zod";
var cuaRequestAccessStatusSchema = z28.object({
  schemaVersion: z28.literal(1),
  platform: z28.literal("darwin"),
  grantOwner: z28.string().min(1),
  accessibility: z28.enum(["granted", "stale", "denied"]),
  screenRecording: z28.enum(["granted", "denied", "unknown"])
}).strict();
var cuaPermissionObservationSchema = z28.object({
  schemaVersion: z28.literal(1),
  eventId: z28.string().min(1),
  eventSeq: z28.number().int().nonnegative(),
  occurredAt: timestampSchema,
  sessionId: z28.string().min(1),
  turnId: z28.string().min(1).optional(),
  toolCallId: z28.string().min(1),
  permissionStatus: cuaRequestAccessStatusSchema
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-observation-display.ts
import { z as z29 } from "zod";
var WORKFLOW_RUN_STOP_REASONS = [
  "user",
  "model",
  "provider",
  "interrupted",
  "superseded"
];
var WORKFLOW_RUN_OBSERVATION_STATUSES = [
  "pending",
  "running",
  "completed",
  "errored",
  "stopped"
];
var usageSchema = z29.object({
  spentTokens: z29.number(),
  nodesObserved: z29.number(),
  nodesRunning: z29.number(),
  nodesCompleted: z29.number(),
  nodesFailed: z29.number()
}).strict();
var actorSchema = z29.object({
  siteId: z29.string(),
  ordinal: z29.number(),
  name: z29.string().optional()
}).strict();
var workflowRunPhaseViewSchema = z29.object({
  name: z29.string().min(1).max(128),
  state: z29.enum(["done", "current", "ahead", "unfinished"]),
  rounds: z29.number().int().nonnegative(),
  nodesSettled: z29.number().int().nonnegative(),
  nodesRunning: z29.number().int().nonnegative(),
  enteredAt: z29.number().optional(),
  exitedAt: z29.number().optional()
}).strict();
var workflowRunLastToolSchema = z29.object({
  name: z29.string().min(1).max(64),
  target: z29.string().max(120).optional(),
  at: z29.number().optional()
}).strict();
var workflowRunSubagentViewSchema = z29.object({
  siteId: z29.string().min(1),
  ordinal: z29.number().int().nonnegative(),
  name: z29.string().max(128).optional(),
  state: z29.enum(["idle", "executing", "waiting", "parked", "done", "failed", "unfinished"]),
  phaseName: z29.string().max(128).optional(),
  instructionsHead: z29.string().max(240).optional(),
  startedAt: z29.number().optional(),
  turn: z29.number().int().nonnegative().optional(),
  toolCalls: z29.number().int().nonnegative().optional(),
  lastTool: workflowRunLastToolSchema.optional(),
  waitCause: z29.enum(["slot", "backoff"]).optional(),
  retryAfterMs: z29.number().nonnegative().optional(),
  waitSince: z29.number().optional(),
  parkedOn: z29.string().optional(),
  stepsSettled: z29.number().int().nonnegative(),
  stepsFailed: z29.number().int().nonnegative(),
  tokens: z29.number().int().nonnegative(),
  lastProgressAt: z29.number().optional()
}).strict();
var workflowRunHealthSchema = z29.object({
  lastProgressAt: z29.number().optional(),
  stalledSince: z29.number().optional(),
  concurrency: z29.object({
    effective: z29.number().int().nonnegative(),
    cap: z29.number().int().positive(),
    reason: z29.string().max(240).optional(),
    since: z29.number().optional()
  }).strict().optional(),
  consecutiveFailures: z29.number().int().nonnegative(),
  cachedSteps: z29.number().int().nonnegative(),
  leftoverRunning: z29.number().int().positive().optional(),
  pendingQuestionsKnown: z29.boolean()
}).strict();
var diagnosticSchema = z29.object({
  line: z29.number().int().nonnegative(),
  column: z29.number().int().nonnegative(),
  code: z29.number().int().nonnegative(),
  message: z29.string().min(1).max(2048)
}).strict();
var workflowRunSummaryRowSchema = z29.object({
  runId: z29.string().min(1),
  label: z29.string(),
  labelSource: z29.enum(["name", "script"]),
  status: z29.enum(WORKFLOW_RUN_OBSERVATION_STATUSES),
  stopReason: z29.enum(WORKFLOW_RUN_STOP_REASONS).optional(),
  ownedByThisSession: z29.boolean(),
  possiblyInterrupted: z29.boolean().optional(),
  createdAt: z29.number(),
  updatedAt: z29.number(),
  spentTokens: z29.number()
}).strict();
var toolCallGetWorkflowRunDisplaySchema = z29.object({
  kind: z29.literal("get_workflow_run"),
  runId: z29.string().min(1),
  label: z29.string(),
  status: z29.enum(WORKFLOW_RUN_OBSERVATION_STATUSES),
  stopReason: z29.enum(WORKFLOW_RUN_STOP_REASONS).optional(),
  possiblyInterrupted: z29.boolean().optional(),
  // 情势截面五件全部可选：情势上线前持久化的 transcript 载荷没有这些键，而本 schema 是
  // strict 的——设成必填会让升级后打开的每一条历史会话里这张卡整块被剥、退化成纯文本。
  // 构造侧每次仍然全填（CLI 侧同款注释）。
  summary: z29.string().max(400).optional(),
  generatedAt: z29.number().optional(),
  usage: usageSchema,
  phases: z29.array(workflowRunPhaseViewSchema).max(32).optional(),
  subagents: z29.array(workflowRunSubagentViewSchema).max(64).optional(),
  health: workflowRunHealthSchema.optional(),
  actors: z29.array(actorSchema).max(32),
  logTail: z29.array(
    z29.object({
      sequence: z29.number(),
      message: z29.string().max(1024),
      // 事件落 journal 的时刻（epoch ms）；卡上的「多久以前」对 generatedAt 算。
      // 可选：这一列在情势截面之前的载荷上不存在，读旧行时缺席而不是拒收。
      at: z29.number().optional()
    }).strict()
  ).max(40),
  result: z29.string().max(4e3).optional(),
  error: z29.object({
    code: z29.string(),
    message: z29.string()
  }).strict().optional(),
  truncated: z29.boolean().optional()
}).strict();
var toolCallListWorkflowRunsDisplaySchema = z29.object({
  kind: z29.literal("list_workflow_runs"),
  runs: z29.array(workflowRunSummaryRowSchema).max(50),
  truncated: z29.boolean().optional()
}).strict();
var toolCallEvalWorkflowSnippetDisplaySchema = z29.object({
  kind: z29.literal("eval_workflow_snippet"),
  ok: z29.boolean(),
  diagnostics: z29.array(diagnosticSchema).max(100),
  logs: z29.array(z29.string().max(1024)).max(40),
  response: z29.string().max(4e3),
  durationMs: z29.number().int().nonnegative(),
  truncated: z29.boolean().optional()
}).strict();
var toolCallSavedWorkflowListDisplaySchema = z29.object({
  kind: z29.literal("saved_workflow_list"),
  workflows: z29.array(
    z29.object({
      name: z29.string().min(1),
      description: z29.string().max(2048).optional(),
      whenToUse: z29.string().max(2048).optional(),
      scope: z29.string(),
      path: z29.string().min(1),
      argNames: z29.array(z29.string()).max(32)
    }).strict()
  ).max(50),
  invalid: z29.array(
    z29.object({
      path: z29.string().min(1),
      reason: z29.string().max(1024).optional()
    }).strict()
  ).optional(),
  truncated: z29.boolean().optional()
}).strict();
var toolCallListModelsDisplaySchema = z29.object({
  kind: z29.literal("list_models"),
  current: z29.string().optional(),
  models: z29.array(
    z29.object({
      id: z29.string().min(1),
      providerId: z29.string().min(1),
      modelId: z29.string().min(1),
      providerLabel: z29.string().max(2048).optional(),
      reasoningLevels: z29.array(z29.string()),
      defaultReasoningLevel: z29.string().optional(),
      contextWindow: z29.number().optional(),
      disabledReason: z29.string().max(2048).optional()
    }).strict()
  ).max(100),
  truncated: z29.boolean().optional()
}).strict();
var toolCallResumeWorkflowRunDisplaySchema = z29.object({
  kind: z29.literal("resume_workflow_run"),
  runId: z29.string().min(1)
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/toolDisplay.ts
var toolResultDisplaySchema = z30.discriminatedUnion("kind", [
  bashOutputDisplaySchema,
  z30.object({
    kind: z30.literal("file_diff"),
    filePath: z30.string().min(1),
    additions: z30.number().int().nonnegative(),
    deletions: z30.number().int().nonnegative(),
    structuredPatch: z30.array(
      z30.object({
        oldStart: z30.number().int(),
        oldLines: z30.number().int(),
        newStart: z30.number().int(),
        newLines: z30.number().int(),
        lines: z30.array(z30.string())
      })
    ),
    truncated: z30.boolean().optional()
  }),
  z30.object({
    kind: z30.literal("local_agent_message"),
    status: z30.enum(["success", "failed"]),
    error: z30.string().optional(),
    message: z30.string().optional()
  }),
  z30.object({
    kind: z30.literal("task_stop"),
    taskId: z30.string().min(1),
    taskType: z30.string().min(1),
    command: z30.string().min(1).optional(),
    message: z30.string().min(1),
    truncated: z30.boolean().optional()
  }),
  z30.object({
    kind: z30.literal("task_output"),
    retrievalStatus: z30.enum(["success", "not_ready", "timeout"]),
    taskStatus: z30.string().min(1).max(64).optional(),
    output: z30.string().min(1).max(2e3).optional(),
    truncated: z30.literal(true).optional()
  }),
  z30.object({
    kind: z30.literal("respond_to_coordinator"),
    status: z30.enum(["success", "failed"])
  }),
  z30.object({
    kind: z30.literal("cua"),
    schemaVersion: z30.literal(1),
    toolName: z30.string().min(1),
    status: z30.enum(["success", "failed"]),
    // 旧 v1 snapshot 曾重复携带 ToolCallRow.input；只为历史回放继续接受。
    input: z30.string().optional(),
    structuredContent: z30.string().optional(),
    text: z30.string().optional(),
    errorCode: z30.string().optional(),
    suggestedAction: z30.string().optional(),
    permissionStatus: cuaRequestAccessStatusSchema.optional(),
    targetApp: z30.object({
      schemaVersion: z30.literal(1),
      displayName: z30.string().trim().min(1).max(512).optional(),
      iconLocators: z30.array(
        z30.discriminatedUnion("kind", [
          z30.object({
            kind: z30.literal("darwin-bundle-id"),
            value: z30.string().trim().min(1).max(512)
          }).strict(),
          z30.object({
            kind: z30.literal("windows-executable-path"),
            value: z30.string().trim().min(1).max(32768)
          }).strict(),
          z30.object({
            kind: z30.literal("windows-aumid"),
            value: z30.string().trim().min(1).max(512)
          }).strict()
        ])
      ).max(3)
    }).strict().optional(),
    media: z30.array(
      z30.object({
        mimeType: z30.string().min(1),
        data: z30.string().min(1).max(349528).optional(),
        artifactUri: z30.string().min(1).optional()
      })
    ).max(4).optional(),
    truncated: z30.boolean().optional()
  }),
  z30.object({
    kind: z30.literal("mcp_tool"),
    serverName: z30.string().min(1).max(256),
    toolName: z30.string().min(1).max(256),
    description: z30.string().min(1).max(4 * 1024).optional(),
    // 与 toolCallMcpDisplaySchema 同源：不在这里声明，zod 会把 agent 下发的 unavailable
    // 静默 strip 掉，官方 MCP 额度提示在 v4 链路上失效（同本文件顶部 display strip 的坑）。
    unavailable: z30.object({ code: z30.enum(OFFICIAL_MCP_TOOL_ERROR_CODES) }).strict().optional()
  }),
  // buildToolOutput 把 CLI 侧 ToolResultDisplayPayload 原样塞进 toolOutput.display，
  // 而这条 union 是 strict 的——create_workflow 不在成员里，CreateWorkflow 的 display 会被整段
  // 拒掉/剥掉，工具卡退化成纯文本。两侧成员表必须同步（同 contracts 的
  // toolResultDisplayPayloadSchema），所以直接复用 toolCall 侧同形的那份 schema。
  toolCallCreateWorkflowDisplaySchema,
  // 观察类工作流工具的五个 display kind + ResumeWorkflowRun 的恢复卡（同上：与 contracts
  // 侧同步，缺成员 = 整块被剥）。
  toolCallGetWorkflowRunDisplaySchema,
  toolCallListWorkflowRunsDisplaySchema,
  toolCallEvalWorkflowSnippetDisplaySchema,
  toolCallSavedWorkflowListDisplaySchema,
  toolCallListModelsDisplaySchema,
  toolCallResumeWorkflowRunDisplaySchema
]);
var toolOutputSchema = z30.object({
  text: z30.string(),
  display: toolResultDisplaySchema.optional().catch(void 0),
  truncated: z30.object({
    totalBytes: z30.number(),
    ref: z30.string()
  }).optional()
});
var toolProgressSchema = z30.object({
  bytes: z30.number(),
  previewLine: z30.string().optional(),
  updatedAt: timestampSchema
});
var toolCallNodeReplCuaAppDisplaySchema = z30.object({
  appKey: z30.string().trim().min(1).max(2048),
  displayName: z30.string().trim().min(1).max(512).optional()
}).strict();
var toolCallNodeReplImageDisplaySchema = z30.object({
  kind: z30.literal("node_repl_images"),
  // images 可选：CUA 的纯动作 cell 没有截图，但仍要携带 app 身份。kind 名保留不动，
  // 改名会让已持久化的 row 在这条 strict union 里整段校验失败。
  images: z30.array(
    z30.object({
      base64: z30.string().min(1).max(200 * 1024),
      mimeType: z30.string().regex(/^image\/[a-z0-9.+-]+$/iu)
    }).strict()
  ).min(1).max(2).optional(),
  app: toolCallNodeReplCuaAppDisplaySchema.optional(),
  truncated: z30.boolean().optional(),
  source: z30.literal("browser_turn_end").optional()
}).strict();
var toolCallTaskOutputDisplaySchema = z30.object({
  kind: z30.literal("task_output"),
  retrievalStatus: z30.enum(["success", "not_ready", "timeout"]),
  taskStatus: z30.string().min(1).max(64).optional(),
  output: z30.string().min(1).max(2e3).optional(),
  truncated: z30.literal(true).optional()
}).strict();
var toolCallRespondToCoordinatorDisplaySchema = z30.object({
  kind: z30.literal("respond_to_coordinator"),
  status: z30.enum(["success", "failed"])
}).strict();
var toolCallMcpDisplaySchema = z30.object({
  kind: z30.literal("mcp_tool"),
  serverName: z30.string().min(1).max(256),
  toolName: z30.string().min(1).max(256),
  description: z30.string().min(1).max(4 * 1024).optional(),
  /**
   * 官方 Server MCP 判定本次调用不可用（额度耗尽 / 无 Coding Plan）时下发的结构化标识。
   * CLI 侧只在官方来源 + isError 时填充，UI 据此在输入框上方提示。
   * 与 CLI contracts 的 mcpToolResultDisplayPayloadSchema 必须同步——两侧都是 strict，
   * 少加一处会让整条 row 校验失败。
   */
  unavailable: z30.object({ code: z30.enum(OFFICIAL_MCP_TOOL_ERROR_CODES) }).strict().optional()
}).strict();
var toolCallDisplaySchema = z30.discriminatedUnion("kind", [
  toolCallNodeReplImageDisplaySchema,
  toolCallTaskOutputDisplaySchema,
  toolCallRespondToCoordinatorDisplaySchema,
  toolCallMcpDisplaySchema,
  toolCallCreateWorkflowDisplaySchema,
  toolCallGetWorkflowRunDisplaySchema,
  toolCallListWorkflowRunsDisplaySchema,
  toolCallEvalWorkflowSnippetDisplaySchema,
  toolCallSavedWorkflowListDisplaySchema,
  toolCallListModelsDisplaySchema,
  toolCallResumeWorkflowRunDisplaySchema
]);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/rows.ts
var rowBaseFields = {
  rowId: z31.number(),
  turnId: z31.string(),
  // canonical identity：新 CLI 每行必传；optional 只用于兼容旧版帧。
  // entityId 定位持久实体，productTurnId 是产品轮次，不得由 UI 重猜。
  entityId: z31.string().min(1).optional(),
  productTurnId: z31.string().min(1).optional(),
  visibility: z31.literal("visible").optional(),
  createdAt: timestampSchema,
  createdAtSeq: z31.number(),
  // 缺省全 false；只下发为 true 的键。canRewind 不在载荷内（rewind = editUserQuery 的 UI 入口）。
  actions: z31.object({
    canFork: z31.literal(true).optional(),
    canEdit: z31.literal(true).optional(),
    canRetry: z31.literal(true).optional(),
    canRewindFiles: z31.literal(true).optional(),
    editDisposition: z31.enum(["rewind", "fork"]).optional()
  }).optional()
};
var rowActionsSchema = rowBaseFields.actions;
var turnWorkSegmentSchema = z31.object({
  segmentId: z31.string().min(1),
  triggerEntityId: z31.string().min(1).optional(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  activeMs: z31.number().nonnegative().optional()
});
var turnHeaderRowSchema = z31.object({
  ...rowBaseFields,
  kind: z31.literal("turnHeader"),
  // workflowLaunch：中枢直接启动的 controlOnly 轮。
  // 记录在案的偏斜：闭集枚举加值 → 旧桌面 + 新 CLI 时该行 parse 失败被丢（与下方
  // backgroundSource: "workflow" 加值同一档），CLI 与桌面同批发布下接受。
  origin: z31.enum([
    "userInput",
    "backgroundResult",
    "goalContinuation",
    "editRerun",
    "workflowLaunch"
  ]),
  // 执行语义由 CLI 投影裁决；UI 不得根据输入文本或 duration 反推。
  // optional 仅用于兼容旧 snapshot，新的 turnHeader 一律显式写入。
  executionKind: z31.enum(["agent", "controlOnly"]).optional(),
  // 当前 query 的命令归因与历史轮次数；optional 兼容旧 transcript/snapshot。
  sourceCommandId: z31.string().optional(),
  historyRoundCount: z31.number().int().nonnegative().optional(),
  state: z31.enum(["running", "completedSuccess", "completedInterrupted", "failed"]),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  // 权威工时：排除权限等待/用户输入等待/verifier 等待。
  activeMs: z31.number().optional(),
  // guide 不切 product turn，但每条 accepted guide 都开启独立视觉工作段。
  // 普通 turn 缺省以保持旧 snapshot 兼容；一旦出现 guide，CLI 负责完整投影首段与后续段。
  workSegments: z31.array(turnWorkSegmentSchema).optional(),
  originMeta: backgroundResultOriginMetaSchema.optional(),
  // origin === "workflowLaunch" 的轮上在场（活投影来源）；与 originMeta 并列，不复用其形状。
  workflowLaunch: workflowLaunchMetaSchema.optional(),
  fileChanges: z31.object({
    additions: z31.number(),
    deletions: z31.number(),
    files: z31.number(),
    state: z31.enum(["active", "reverted"]).optional()
  }).optional()
});
var userInputRowSchema = z31.object({
  ...rowBaseFields,
  kind: z31.literal("userInput"),
  text: z31.string(),
  // text 从此下标起是引擎附加文本（dwf ask 尾注 /
  // nudge），GUI 把它折进默认收起的披露；0 = 整条都是；缺席 = 无（老转录、非工作流会话）。
  epilogueStart: z31.number().int().nonnegative().optional(),
  // workflowLaunch：中枢直接启动轮的用户可见行。
  // 消息文本仍进 text（旧客户端 / TUI 的降级呈现就是那句规范英文）；新客户端用下方
  // workflowLaunch 元数据画轮尾 run 卡而非气泡。闭集加值的偏斜同 turnHeader.origin 注释。
  origin: z31.enum([
    "realUser",
    "backgroundResult",
    "goalContinuation",
    "mailbox",
    "synthetic",
    "workflowLaunch"
  ]),
  originMeta: z31.object({
    // 与 backgroundResultOriginMetaSchema 同一组取值（含 workflow run 的 "workflow"）。
    backgroundSource: z31.enum(["bash", "subagent", "workflow"]).optional(),
    workId: z31.string().optional(),
    senderSessionId: z31.string().optional(),
    senderLabel: z31.string().optional()
  }).optional(),
  // origin === "workflowLaunch" 的行上在场；与 originMeta 并列，与 turnHeader 上同一份。
  workflowLaunch: workflowLaunchMetaSchema.optional(),
  // 经 turn-steer 注入（guideModeTurnSteer）。
  guided: z31.literal(true).optional(),
  // realUser/guided 必带；系统来源缺省。overlay 收口锚点。
  sourceCommandId: z31.string().optional(),
  // edit/retry 会生成新的 sourceCommandId；该字段固定指向 canonical input 根，
  // 用于一次性恢复预算等跨重跑 lineage 判定。旧 transcript 可缺省。
  rootSourceCommandId: z31.string().optional(),
  // 提交端身份由 CLI admission 写入；旧 transcript 可缺省。
  clientId: z31.string().optional(),
  attachments: z31.array(
    z31.object({
      ref: z31.string(),
      fileName: z31.string(),
      mime: z31.string(),
      bytes: z31.number(),
      previewRef: z31.string().optional()
    })
  ).optional()
});
var assistantTextRowSchema = z31.object({
  ...rowBaseFields,
  kind: z31.literal("assistantText"),
  // 同一模型 response 的正文与工具共享此 ID；optional 兼容旧 snapshot。
  assistantResponseId: z31.string().min(1).optional(),
  text: z31.string(),
  state: z31.enum(["streaming", "complete", "interrupted", "failed"]),
  model: z31.string().optional(),
  feedback: z31.enum(["like", "dislike"]).optional()
});
var reasoningRowSchema = z31.object({
  ...rowBaseFields,
  kind: z31.literal("reasoning"),
  // 同一模型 response 的思考、正文与工具共享此 ID；optional 兼容旧 snapshot。
  assistantResponseId: z31.string().min(1).optional(),
  text: z31.string(),
  state: z31.enum(["streaming", "complete", "interrupted"]),
  durationMs: z31.number().optional()
});
var cuaAppIdentitySchema = z31.object({
  pid: z31.number().int().positive(),
  name: z31.string().trim().min(1).max(256),
  bundleId: z31.string().trim().min(1).max(512).optional()
}).strict();
var toolCallRowSchema = z31.object({
  ...rowBaseFields,
  kind: z31.literal("toolCall"),
  // 同一模型 response 的正文与工具共享此 ID；optional 兼容旧 snapshot。
  assistantResponseId: z31.string().min(1).optional(),
  toolCallId: z31.string(),
  toolName: z31.string(),
  status: z31.enum(["inputStreaming", "pendingApproval", "running", "success", "error", "cancelled"]),
  inputText: z31.string(),
  input: z31.unknown().optional(),
  cuaApp: cuaAppIdentitySchema.optional(),
  output: toolOutputSchema.optional(),
  // display 解析失败只丢这张卡的载荷，不拒整条 row（理由见 toolDisplay.ts 的 toolOutputSchema
  // 注释：装饰载荷不得决定 row/帧/订阅的生死）。
  display: toolCallDisplaySchema.optional().catch(void 0),
  // status=error 时必带。
  error: z31.object({ code: z31.string(), message: z31.string() }).optional(),
  // 仅 replayable 档运行中出现，终态清除。
  progress: toolProgressSchema.optional(),
  // continuous/replayable 共用的有界 Bash 内容，终态或后台移交时清除。
  outputPreview: executionOutputPreviewSchema.optional(),
  // status=pendingApproval 时指向 pendingInteractions 项。
  approvalInteractionId: z31.string().optional(),
  backgrounded: z31.literal(true).optional(),
  workId: z31.string().optional(),
  startedAt: timestampSchema.optional(),
  endedAt: timestampSchema.optional()
});
var conversationArtifactTypeSchema = z31.enum([
  "pdf",
  "pptx",
  "docx",
  "xlsx",
  "image",
  "html",
  "md",
  "text"
]);
var artifactRowSchema = z31.object({
  ...rowBaseFields,
  kind: z31.literal("artifact"),
  artifactVersionId: z31.string().trim().min(1),
  logicalArtifactKey: z31.string().trim().min(1),
  displayName: z31.string().trim().min(1),
  artifactType: conversationArtifactTypeSchema,
  mimeType: z31.string().trim().min(1),
  sizeBytes: z31.number().int().nonnegative(),
  sha256: z31.string().regex(/^[0-9a-f]{64}$/u),
  ref: z31.string().trim().min(1),
  state: z31.literal("current")
});
var subagentRowSchema = z31.object({
  ...rowBaseFields,
  kind: z31.literal("subagent"),
  // 触发该子智能体的 Agent/Task 工具调用；并发 spawn 顺序不可作为关联依据。
  parentToolCallId: z31.string().optional(),
  subagentType: z31.string(),
  status: z31.enum(["running", "success", "failed", "cancelled"]),
  summaryText: z31.string(),
  // 存在 → UI 可下钻订阅 conversation/<childSessionId>（不内嵌 child rows）。
  childSessionId: z31.string().optional(),
  backgrounded: z31.literal(true).optional(),
  workId: z31.string().optional(),
  startedAt: timestampSchema.optional(),
  endedAt: timestampSchema.optional()
});
var hookExecutionDescriptorSchema = z31.object({
  clientVisible: z31.literal(true),
  sourceKind: z31.enum(["user", "plugin", "project", "internal"]),
  sourcePath: z31.string().optional(),
  pluginId: z31.string().optional(),
  pluginName: z31.string().optional(),
  statusMessage: z31.string().optional(),
  executionType: z31.enum(["process", "command"]),
  executionMode: z31.enum(["foreground", "background"]),
  commandDisplay: z31.string(),
  timeoutMs: z31.number().int().positive()
}).strict();
var hookExecutionProjectionSchema = z31.object({
  hookRunId: z31.string().min(1),
  hookIndex: z31.number().int().nonnegative(),
  // 同一 runId 已观察到 HookRunStarted 才为 true；admission-only blocked 为 false。
  didExecute: z31.boolean(),
  state: z31.enum(["running", "completed", "failed"]),
  outcome: z31.enum(["success", "blocked", "failed", "cancelled", "timed_out"]).optional(),
  blockReason: z31.string().trim().min(1).optional(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  durationMs: z31.number().nonnegative().optional(),
  displayName: z31.string().trim().min(1),
  sourceKind: z31.enum(["user", "plugin", "project"]),
  pluginName: z31.string().optional(),
  toolName: z31.string().optional()
}).strict();
var hookInvocationRowSchema = z31.object({
  ...rowBaseFields,
  kind: z31.literal("hookInvocation"),
  hookInvocationId: z31.string().min(1),
  hookEventName: z31.enum([
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "PostToolUseFailure",
    "Stop"
  ]),
  hookCount: z31.number().int().positive(),
  state: z31.enum(["running", "completed", "failed"]),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  durationMs: z31.number().nonnegative().optional(),
  lane: z31.enum(["assistantWork", "toolBefore", "toolAfter"]),
  anchorToolCallId: z31.string().optional(),
  executions: z31.array(hookExecutionProjectionSchema)
});
var timelineMarkerPayloadSchema = z31.union([
  z31.object({
    type: z31.literal("compact"),
    origin: z31.enum(["manual", "auto"]),
    status: z31.enum(["running", "success", "failed", "noop", "cancelled"]),
    tokensBefore: z31.number().optional(),
    tokensAfter: z31.number().optional(),
    summaryRef: z31.string().optional()
  }),
  // 出现在 child 会话首部（forkTimelineIsBoundary）。
  z31.object({
    type: z31.literal("forkNotice"),
    parentSessionId: z31.string(),
    parentRowId: z31.number()
  }),
  // 出现在 parent（可选展示）。
  z31.object({
    type: z31.literal("forkCreated"),
    childSessionId: z31.string(),
    atRowId: z31.number()
  }),
  z31.object({
    type: z31.literal("modelChange"),
    fromProvider: z31.string(),
    fromModel: z31.string(),
    toProvider: z31.string(),
    toModel: z31.string(),
    toThought: z31.string()
  }),
  z31.object({
    type: z31.literal("modelChange"),
    // 显式 ∅→X 模型边界没有来源；never 保证两个来源字段不能只出现一个，
    // 避免 renderer 接收到半个 provider/model 元组。
    fromProvider: z31.never().optional(),
    fromModel: z31.never().optional(),
    toProvider: z31.string(),
    toModel: z31.string(),
    toThought: z31.string()
  }),
  z31.object({
    type: z31.literal("goalSet"),
    objective: z31.string(),
    previousObjective: z31.string().optional()
  }),
  z31.object({
    type: z31.literal("goalVerify"),
    iteration: z31.number(),
    outcome: z31.enum(["running", "pass", "notSatisfied", "failed"]),
    detail: z31.string().optional()
  }),
  z31.object({
    type: z31.literal("retryNotice"),
    attempt: z31.number(),
    reasonCode: z31.string()
  }),
  // workspace 域动作在时间线上的回执。
  z31.object({
    type: z31.literal("checkpointRestored"),
    checkpointId: z31.string()
  })
]);
var timelineMarkerLaneSchema = z31.enum([
  "assistantWork",
  "turnTailBoundary",
  "lightBoundary"
]);
var timelineMarkerRowSchema = z31.object({
  ...rowBaseFields,
  kind: z31.literal("timelineMarker"),
  // 用户触发的 marker 必带。
  sourceCommandId: z31.string().optional(),
  lane: timelineMarkerLaneSchema.optional(),
  marker: timelineMarkerPayloadSchema
});
var conversationRowSchema = z31.discriminatedUnion("kind", [
  turnHeaderRowSchema,
  userInputRowSchema,
  assistantTextRowSchema,
  reasoningRowSchema,
  toolCallRowSchema,
  artifactRowSchema,
  subagentRowSchema,
  hookInvocationRowSchema,
  timelineMarkerRowSchema
]);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workspace-hook-review.ts
import { z as z32 } from "zod";
var nonEmptyStringSchema = z32.string().trim().min(1);
var positiveIntegerSchema = z32.number().int().positive();
var nonnegativeIntegerSchema = z32.number().int().nonnegative();
var sha256DigestSchema = z32.string().regex(/^[a-f0-9]{64}$/u);
var workspaceHookReviewTrustStateSchema = z32.enum([
  "not_applicable",
  "pending_trust",
  "trusted_persistent",
  "blocked_untrusted",
  "blocked_policy",
  "revoked",
  "stale_digest"
]);
var workspaceHookReviewDecisionSchema = z32.object({
  action: z32.literal("trust_selected"),
  reviewItemIds: z32.array(nonEmptyStringSchema).min(1)
}).strict().superRefine((decision, context) => {
  if ("reviewItemIds" in decision && decision.reviewItemIds) {
    addDuplicateItemIssue(decision.reviewItemIds, context, ["reviewItemIds"]);
  }
});
var workspaceHookReviewCommandTargetSchema = z32.object({
  sessionId: nonEmptyStringSchema,
  taskId: nonEmptyStringSchema,
  runId: nonEmptyStringSchema,
  remoteSessionId: nonEmptyStringSchema.optional(),
  workspaceIdentity: nonEmptyStringSchema,
  bundleDigest: sha256DigestSchema,
  reviewFlowId: nonEmptyStringSchema,
  generation: positiveIntegerSchema,
  interactionId: nonEmptyStringSchema
}).strict();
var workspaceHookTrustRevokeTargetSchema = z32.object({
  sessionId: nonEmptyStringSchema,
  remoteSessionId: nonEmptyStringSchema.optional(),
  workspaceIdentity: nonEmptyStringSchema,
  bundleDigest: sha256DigestSchema,
  hookDeclarationDigests: z32.array(sha256DigestSchema).min(1)
}).strict().superRefine((target, context) => {
  addDuplicateItemIssue(target.hookDeclarationDigests, context, ["hookDeclarationDigests"]);
});
var requestWorkspaceHookReviewTargetSchema = z32.object({
  sessionId: nonEmptyStringSchema,
  remoteSessionId: nonEmptyStringSchema.optional(),
  workspaceIdentity: nonEmptyStringSchema,
  bundleDigest: sha256DigestSchema
}).strict();
var workspaceHookReviewRequestPayloadSchema = z32.object({
  kind: z32.literal("workspaceHookReview"),
  reviewFlowId: nonEmptyStringSchema,
  generation: positiveIntegerSchema,
  interactionId: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  taskId: nonEmptyStringSchema,
  runId: nonEmptyStringSchema,
  workspaceIdentity: nonEmptyStringSchema,
  workspaceLabel: nonEmptyStringSchema,
  remoteSessionId: nonEmptyStringSchema.optional(),
  bundleDigest: sha256DigestSchema,
  createdAt: timestampSchema,
  deadlineAt: timestampSchema,
  sourceFiles: z32.array(
    z32.object({
      path: nonEmptyStringSchema,
      displayPath: nonEmptyStringSchema,
      editable: z32.boolean()
    }).strict()
  ),
  summary: z32.object({
    eventCount: nonnegativeIntegerSchema,
    hookCount: nonnegativeIntegerSchema,
    pendingCount: nonnegativeIntegerSchema
  }).strict(),
  items: z32.array(
    z32.object({
      reviewItemId: nonEmptyStringSchema,
      event: z32.enum([
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PermissionRequest",
        "PostToolUse",
        "PostToolUseFailure",
        "Stop"
      ]),
      matcher: z32.string().optional(),
      type: z32.enum(["command", "process"]),
      displayName: nonEmptyStringSchema,
      displayCommand: nonEmptyStringSchema,
      sourcePath: nonEmptyStringSchema,
      resolvedTimeoutMs: positiveIntegerSchema,
      resolvedMaxOutputBytes: positiveIntegerSchema,
      executionMode: z32.enum(["foreground", "background"]),
      configuredEnabled: z32.boolean(),
      editable: z32.boolean(),
      trustState: workspaceHookReviewTrustStateSchema
    }).strict()
  ),
  warningCode: z32.literal("workspace_hooks_execute_code")
}).strict().superRefine((request, context) => {
  if (request.deadlineAt < request.createdAt) {
    context.addIssue({
      code: z32.ZodIssueCode.custom,
      path: ["deadlineAt"],
      message: "deadlineAt must not precede createdAt"
    });
  }
  if (request.summary.hookCount !== request.items.length) {
    context.addIssue({
      code: z32.ZodIssueCode.custom,
      path: ["summary", "hookCount"],
      message: "hookCount must match the immutable request items"
    });
  }
  const eventCount = new Set(request.items.map((item) => item.event)).size;
  if (request.summary.eventCount !== eventCount) {
    context.addIssue({
      code: z32.ZodIssueCode.custom,
      path: ["summary", "eventCount"],
      message: "eventCount must match the immutable request items"
    });
  }
  const pendingCount = request.items.filter(
    (item) => ["pending_trust", "revoked", "stale_digest"].includes(item.trustState)
  ).length;
  if (request.summary.pendingCount !== pendingCount) {
    context.addIssue({
      code: z32.ZodIssueCode.custom,
      path: ["summary", "pendingCount"],
      message: "pendingCount must match pending admission items"
    });
  }
  addDuplicateItemIssue(
    request.items.map((item) => item.reviewItemId),
    context,
    ["items"]
  );
});
var presentWorkspaceHookReviewRequestSchema = z32.object({
  reviewFlowId: nonEmptyStringSchema,
  generation: positiveIntegerSchema,
  interactionId: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  workspaceIdentity: nonEmptyStringSchema,
  bundleDigest: sha256DigestSchema,
  settingsSection: z32.literal("hooks"),
  settingsScope: z32.literal("workspace")
}).strict();
function addDuplicateItemIssue(values, context, path) {
  if (new Set(values).size === values.length) return;
  context.addIssue({
    code: z32.ZodIssueCode.custom,
    path,
    message: "review item ids must be unique"
  });
}

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/session-config.ts
import { z as z33 } from "zod";
var sessionConfigStateSchema = z33.object({
  /** Session 接受并持久化的稀疏选择意图；provider/model/thought 仅为 UI effective 投影。 */
  modelSelection: modelSelectionSchema.optional(),
  provider: z33.string(),
  model: z33.string(),
  thought: z33.string(),
  // 思考档位是当前模型的能力，不是 workspace/UI 偏好。
  // default 仅用于兼容旧快照；新 agent 必须从 runtime 投影实际集合。
  thoughtLevels: z33.array(z33.string()).default([]),
  followupMode: z33.enum(["queue", "guide"]),
  // additive（冻结面演进，同 meta 的裁决口径）：agent 协作模式（core CollaborationMode）。
  // 必须带 default 才不破坏旧快照/旧发送端的解析；投影经 SessionModeChanged 事件更新。
  mode: z33.string().default("build"),
  planEnabled: z33.boolean().optional(),
  /** 明确审批结果；草稿按 interactionId 消费一次，普通 mode 更新不重置它。 */
  permissionGrant: z33.object({ interactionId: z33.string().min(1) }).optional(),
  /** 最近工具转换的关联，供草稿定向同步；不新增可见历史事件。 */
  planTransition: z33.object({
    toolCallId: z33.string(),
    planEnabled: z33.boolean()
  }).optional()
});
var sessionModelTransitionSchema = z33.object({
  eventId: z33.string().min(1),
  origin: z33.literal("registryFallback"),
  from: z33.object({
    provider: z33.string(),
    model: z33.string()
  }),
  to: z33.object({
    provider: z33.string(),
    model: z33.string()
  })
});

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/snapshot.ts
var sessionPhaseSchema = z34.enum([
  // draft 裁决保留——纯内存态、sessions-index 可见、无 row、
  // 不落盘、CLI 重启即消失；firstInput 到达 → prewarming/running。
  "draft",
  "prewarming",
  "running",
  "completedSuccess",
  "completedInterrupted",
  "error"
]);
var stopTargetKindSchema = z34.enum([
  "assistant",
  "tool",
  "subagent",
  "compact",
  "goalVerifier",
  "goalContinuation",
  "turnSteer",
  "mixed",
  "unknown"
]);
var activeWorkSummarySchema = z34.object({
  kind: z34.enum([
    "primaryTurn",
    "foregroundSubagent",
    "compact",
    "goalVerifier",
    "goalContinuation",
    "turnSteer"
  ]),
  foregroundExecutionId: z34.string().min(1).optional(),
  startedAt: timestampSchema
});
var errorAttributionSchema = z34.object({
  source: z34.enum(["provider", "runtime", "tool", "network"]).optional(),
  reason: z34.string().min(1).max(160).optional(),
  errorPhase: z34.enum([
    "prepare",
    "configuration",
    "connect",
    "response",
    "stream",
    "parse",
    "validation",
    "unhandled"
  ]).optional(),
  exceptionKind: z34.enum([
    "api_call",
    "generic",
    "protocol",
    "provider_business",
    "transport",
    "type_error",
    "validation"
  ]).optional(),
  providerId: z34.string().min(1).max(160).optional(),
  modelId: z34.string().min(1).max(160).optional(),
  providerKind: z34.string().min(1).max(160).optional(),
  transport: z34.enum(["http", "sse", "websocket"]).optional(),
  statusCode: z34.number().int().min(100).max(599).optional(),
  providerErrorCode: z34.string().min(1).max(160).optional(),
  retryable: z34.boolean().optional()
}).strict();
var sessionErrorInfoSchema = z34.object({
  code: z34.string(),
  message: z34.string(),
  recoverable: z34.boolean(),
  at: timestampSchema,
  source: z34.enum(["provider", "runtime", "tool", "network"]),
  traceId: z34.string().optional(),
  detail: z34.string().optional(),
  underlyingErrorMessage: z34.string().optional(),
  underlyingErrorDetail: z34.string().optional(),
  attribution: errorAttributionSchema.optional()
});
var apiRetryStateSchema = z34.object({
  attempt: z34.number(),
  maxAttempts: z34.number(),
  nextRetryAt: timestampSchema,
  reasonCode: z34.string()
});
var sessionControlSchema = z34.object({
  phase: sessionPhaseSchema,
  // 派生值（= phase ∈ completed*），为 UI 便利保留。
  sessionEnded: z34.boolean(),
  canStop: z34.boolean(),
  stopState: z34.enum(["idle", "stoppable", "stopping"]),
  stopTargetKind: stopTargetKindSchema,
  // 轻量证据/悬浮提示用，UI 不得据此推导 flag。
  // hasBackgroundWork 不在载荷内：客户端按 backgroundWorks.some(w => w.status === "running") 一行派生。
  activeWorks: z34.array(activeWorkSummarySchema),
  lastError: sessionErrorInfoSchema.nullable(),
  apiRetry: apiRetryStateSchema.nullable()
});
var actionAvailabilitySchema = z34.discriminatedUnion("allowed", [
  z34.object({ allowed: z34.literal(true) }),
  // reasonCode = product-protocol guard id，驱动禁用态 tooltip。
  z34.object({ allowed: z34.literal(false), reasonCode: z34.string() })
]);
var sessionActionAvailabilitySchema = z34.object({
  fork: actionAvailabilitySchema,
  compact: actionAvailabilitySchema,
  switchModelConfig: actionAvailabilitySchema,
  setFollowupMode: actionAvailabilitySchema,
  queueEdit: actionAvailabilitySchema,
  sendQueuedNow: actionAvailabilitySchema,
  pauseGoal: actionAvailabilitySchema,
  resumeGoal: actionAvailabilitySchema
});
var inputRoutingSchema = z34.object({
  // choice：held（completed+queue>0+autoDrain=false）下
  // 输入不静默入队，客户端呈现「清空 queue 后发送 / 保留 queue 立即发送」。
  mode: z34.enum(["startNow", "enqueue", "guide", "reject", "choice"]),
  // mode=reject 必带；enqueue/guide/choice 可带（如 guide 不合格回退原因）。
  reasonCode: z34.string().optional()
});
var sessionMetaStateSchema = z34.object({
  title: z34.string(),
  // default = 未命名；generated = 模型自动生成；custom = 用户显式重命名（不再被自动标题覆盖）。
  titleSource: z34.enum(["default", "generated", "custom"])
});
var sessionUsageStateSchema = z34.object({
  contextWindow: z34.object({
    usedTokens: z34.number(),
    maxTokens: z34.number(),
    autoCompactThresholdTokens: z34.number().nullable(),
    cache: zcodeSessionContextCacheUsageSchema.optional(),
    breakdown: zcodeContextUsageBreakdownSchema.optional()
  }).nullable(),
  cumulative: z34.object({
    inputTokens: z34.number(),
    outputTokens: z34.number(),
    cacheReadTokens: z34.number(),
    cacheWriteTokens: z34.number()
  })
});
var queueItemSchema = conversationInputIntentSchema.extend({
  dispatch: conversationInputDispatchSchema.extend({
    state: z34.enum(["queued", "reserved", "promoting"])
  }),
  toolDisallowlist: z34.array(z34.string().min(1)).optional()
});
var queueStateSchema = z34.object({
  items: z34.array(queueItemSchema),
  // stop 后 = false（暂停队列）；setAutoDrain 恢复。
  autoDrain: z34.boolean(),
  // additive：旧快照缺省时 UI 使用通用暂停文案；Stop/TurnError 可显示原因文案。
  pauseReason: z34.enum(["stopped", "manual", "error"]).optional()
});
var PERMISSION_FULL_ACCESS_OPTION_ID = "fullAccess";
var permissionOptionSchema = z34.object({
  optionId: z34.string(),
  label: z34.string(),
  kind: z34.enum(["allowOnce", "allowAlways", "deny", "custom"]),
  response: zcodePermissionResponseSchema.optional()
});
var permissionRequestPayloadSchema = z34.object({
  kind: z34.literal("permission"),
  toolCallId: z34.string(),
  toolName: z34.string(),
  summary: z34.string(),
  detail: z34.unknown(),
  // additive：旧 snapshot 缺省时 UI 不显示反馈输入；V4 新投影可显式开启。
  freeText: z34.boolean().optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  // 工具自报的确认预览，复用 row 的 display 投影（同一有界形状）。缺省 = 纯文本 ask。
  // 同样不设门：预览解析失败退化成纯文本 ask，不拒整份 snapshot（见 toolDisplay.ts 注释）。
  display: toolCallDisplaySchema.optional().catch(void 0),
  // 独立 additive 能力：旧 UI 忽略此字段，仍只显示原 options，不出现半实现授权入口。
  fullAccessOption: permissionOptionSchema.extend({
    optionId: z34.literal(PERMISSION_FULL_ACCESS_OPTION_ID),
    kind: z34.literal("custom")
  }).optional(),
  options: z34.array(permissionOptionSchema)
});
var userInputOptionPayloadSchema = z34.object({
  value: z34.string(),
  label: z34.string(),
  description: z34.string().optional(),
  preview: z34.string().optional()
});
var userInputQuestionPayloadSchema = z34.object({
  question: z34.string(),
  header: z34.string(),
  options: z34.array(userInputOptionPayloadSchema),
  multiSelect: z34.boolean().optional()
});
var userInputRequestPayloadSchema = z34.object({
  kind: z34.literal("userInput"),
  prompt: z34.string(),
  freeText: z34.boolean(),
  options: z34.array(z34.object({ optionId: z34.string(), label: z34.string() })).optional(),
  // true → 输入框按密码处理，客户端不入草稿/历史。
  sensitive: z34.boolean().optional(),
  toolName: z34.string().optional(),
  toolCallId: z34.string().optional(),
  traceId: z34.string().optional(),
  input: z34.unknown().optional(),
  schema: z34.unknown().optional(),
  questions: z34.array(userInputQuestionPayloadSchema).optional(),
  currentQuestionIndex: z34.number().optional(),
  answerDrafts: z34.record(z34.string(), z34.array(z34.string())).optional(),
  origin: zcodeInteractionRequestOriginSchema.optional()
});
var interactionAutoResolutionSchema = z34.discriminatedUnion("state", [
  z34.object({
    state: z34.enum(["hiddenGrace", "visibleCountdown"]),
    startedAt: timestampSchema,
    visibleAt: timestampSchema,
    deadlineAt: timestampSchema
  }),
  z34.object({
    state: z34.literal("snoozed"),
    startedAt: timestampSchema,
    snoozedAt: timestampSchema
  })
]);
var pendingInteractionSchema = z34.object({
  interactionId: z34.string(),
  kind: z34.enum(["permission", "userInput", "workspaceHookReview"]),
  // null = 会话级（如 provider 交互和 workspace Hook review）。
  anchorRowId: z34.number().nullable(),
  createdAt: timestampSchema,
  autoResolution: interactionAutoResolutionSchema.optional(),
  payload: z34.discriminatedUnion("kind", [
    permissionRequestPayloadSchema,
    userInputRequestPayloadSchema,
    workspaceHookReviewRequestPayloadSchema
  ])
}).superRefine((interaction, context) => {
  if (interaction.kind !== interaction.payload.kind) {
    context.addIssue({
      code: z34.ZodIssueCode.custom,
      path: ["kind"],
      message: "pending interaction kind must match payload kind"
    });
  }
  if (interaction.kind === "workspaceHookReview" && interaction.autoResolution) {
    context.addIssue({
      code: z34.ZodIssueCode.custom,
      path: ["autoResolution"],
      message: "workspaceHookReview cannot use AskUserQuestion auto-resolution"
    });
  }
  if (interaction.payload.kind === "workspaceHookReview" && interaction.interactionId !== interaction.payload.interactionId) {
    context.addIssue({
      code: z34.ZodIssueCode.custom,
      path: ["interactionId"],
      message: "workspaceHookReview interaction id must match its immutable payload"
    });
  }
});
var commandStateSummarySchema = z34.object({
  commandId: z34.string(),
  clientId: z34.string(),
  type: z34.string(),
  state: z34.enum(["accepted", "executing"]),
  at: timestampSchema
});
var backgroundWorkSummarySchema = z34.object({
  workId: z34.string(),
  // workflow = workflow run（CreateWorkflow）。**闭集加值的偏斜代价**：
  // 旧桌面收到未知值时整个 state.updated patch 解析失败（已知键的非法值是错误，不是剥离），
  // 于是整帧被 assembler 拒收，且 resync 的 snapshot 携带同一个值、同样失败——不能优雅降级。
  // CLI 与桌面同批发布才使它可接受。
  kind: z34.enum(["bash", "subagent", "workflow"]),
  title: z34.string(),
  // resultPending = 已完成、结果在 continuation inbox 等待前台空闲；
  // 投递后条目消失（结果本体成为 origin=backgroundResult 的 userInput row）。
  status: z34.enum(["running", "resultPending", "failed", "cancelled"]),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  cancellable: z34.boolean().optional(),
  blocked: z34.boolean().optional(),
  anchorRowId: z34.number().nullable(),
  childSessionId: z34.string().optional()
});
var runningSubagentSummarySchema = z34.object({
  childSessionId: z34.string(),
  agentId: z34.string().optional(),
  toolCallId: z34.string().optional(),
  subagentType: z34.string(),
  title: z34.string(),
  summary: z34.string().optional(),
  status: z34.enum(["running", "waiting", "blocked"]),
  startedAt: timestampSchema.optional()
});
var subagentProjectionStateSchema = z34.object({
  revision: z34.number().int().nonnegative(),
  childSessionIds: z34.array(z34.string()),
  running: z34.array(runningSubagentSummarySchema),
  endedTotal: z34.number().int().nonnegative()
});
var planItemSchema = z34.object({
  id: z34.string(),
  content: z34.string(),
  status: z34.enum(["pending", "inProgress", "completed"])
});
var goalIterationStateSchema = z34.object({
  iteration: z34.number().int().positive(),
  items: z34.array(planItemSchema),
  updatedAt: timestampSchema
});
var goalStateSchema = z34.object({
  // default 仅用于旧快照兼容；新投影始终携带当前 target 身份和计时事实。
  targetId: z34.string().default(""),
  objective: z34.string(),
  summaryTitle: z34.string().nullable().default(null),
  timeUsedSeconds: z34.number().int().nonnegative().default(0),
  activeRunStartedAtMs: z34.number().int().nonnegative().nullable().default(null),
  // paused：stop 作用于任何 foreground work 时 target 强制进入（stopPausesActiveGoalTarget）。
  // notSatisfied 与 failed 分离：前者是有效结论，后者是验证过程失败。
  status: z34.enum(["active", "paused", "verifying", "verified", "notSatisfied", "failed"]),
  iteration: z34.number(),
  verifications: z34.array(
    z34.object({
      iteration: z34.number(),
      outcome: z34.enum(["pass", "notSatisfied", "failed"]),
      at: timestampSchema,
      anchorRowId: z34.number().nullable(),
      reason: z34.string().optional(),
      nextAction: z34.string().optional()
    })
  ),
  iterations: z34.array(goalIterationStateSchema).default([])
});
var planStateSchema = z34.object({
  items: z34.array(planItemSchema),
  updatedAt: timestampSchema
});
var rowsWindowSchema = z34.object({
  // 尾部窗口，rowId 升序。
  window: z34.array(conversationRowSchema),
  // 当前全序行数（截断后会减小；仅用于滚动条估计）。
  totalCount: z34.number(),
  // 全序第一行 rowId；window 首行等于它 ⇔ 已到顶（游标分页判定）。
  firstRowId: z34.number().nullable()
});
var workspaceHookAdmissionStateSchema = z34.object({
  pendingCount: z34.number().int().nonnegative(),
  bundleDigest: z34.string(),
  workspaceIdentity: z34.string().optional()
});
var conversationSnapshotSchema = z34.object({
  protocolVersion: z34.literal(1),
  sessionId: z34.string(),
  logEpoch: z34.string(),
  // 快照对齐水位（= 所在帧 toSeq；从内存投影原子取值）。
  seq: z34.number(),
  revision: z34.number(),
  // A 区
  control: sessionControlSchema,
  availability: sessionActionAvailabilitySchema,
  inputRouting: inputRoutingSchema,
  // meta 是冻结 schema之后的
  // additive 新增，必须带 default 才不破坏旧快照/旧发送端的解析——备份分支曾把它设为
  // 必填，shared 的 round-trip 测试在该分支上一直是红的（当时未跑 root vitest 漏网）。
  meta: sessionMetaStateSchema.default({ title: "", titleSource: "default" }),
  // Additive：旧 CLI/旧快照不带该字段时仍按普通会话处理。
  sharedContextImport: sharedContextImportStateSchema.optional(),
  config: sessionConfigStateSchema,
  // 持久化稳定事实供 live 客户端识别一次性提示；旧快照缺字段时不触发。
  modelTransition: sessionModelTransitionSchema.nullable().default(null),
  usage: sessionUsageStateSchema,
  queue: queueStateSchema,
  pendingInteractions: z34.array(pendingInteractionSchema),
  pendingCommands: z34.array(commandStateSummarySchema),
  backgroundWorks: z34.array(backgroundWorkSummarySchema),
  // optional 只服务旧快照 wire 兼容；新 CLI 的初始态和每次投影都始终携带该字段。
  subagents: subagentProjectionStateSchema.optional(),
  // 冷快照必须携带 workflowRuns：漏这一处，刷新/重连后正在跑的 run 会静默消失
  // （详情页因此空白，而 run 本身仍在飞）。optional 同样只服务旧快照 wire 兼容。
  workflowRuns: workflowRunsStateSchema.optional(),
  goal: goalStateSchema.nullable(),
  plan: planStateSchema.nullable(),
  // 软门禁(Soft Gate)：additive 字段,必须带 default(null)。
  // 旧快照/旧发送端不携带此字段 → 解析得 null,不破坏兼容性(遵守冻结规则)。
  // pendingCount === 0 时投影层置 null(提示条消失)。
  workspaceHookAdmission: workspaceHookAdmissionStateSchema.nullable().default(null),
  // B 区
  rows: rowsWindowSchema
});

// ../reference/ZCode/packages/shared/src/model-config.ts
import { z as z35 } from "zod";

// ../reference/ZCode/packages/model-option-map/src/types.ts
var RestrictedCelError = class extends Error {
  offset;
  constructor(message, offset) {
    super(`${message} at offset ${offset}`);
    this.name = "RestrictedCelError";
    this.offset = offset;
  }
};

// ../reference/ZCode/packages/model-option-map/src/evaluator.ts
function evaluateRestrictedCel(expression, input) {
  assertRestrictedCelValue(input, expression.offset);
  return freezeJson(evaluate(expression, input));
}
function evaluate(expression, input) {
  switch (expression.type) {
    case "literal":
      return expression.value;
    case "input":
      return input;
    case "array":
      return expression.elements.map((element) => evaluate(element, input));
    case "object": {
      const result = /* @__PURE__ */ Object.create(null);
      for (const entry of expression.entries) {
        Object.defineProperty(result, entry.key, {
          configurable: true,
          enumerable: true,
          value: evaluate(entry.value, input),
          writable: true
        });
      }
      return result;
    }
    case "unary":
      return evaluateUnary(
        expression.operator,
        evaluate(expression.operand, input),
        expression.offset
      );
    case "binary":
      return evaluateBinary(expression, input);
    case "conditional":
      return requireBoolean(evaluate(expression.condition, input), expression.condition.offset) ? evaluate(expression.whenTrue, input) : evaluate(expression.whenFalse, input);
  }
}
function evaluateUnary(operator, operand, offset) {
  if (operator === "!") return !requireBoolean(operand, offset);
  const number = requireNumber(operand, offset);
  return assertNumber(operator === "-" ? -number : number, offset);
}
function evaluateBinary(expression, input) {
  const left = evaluate(expression.left, input);
  if (expression.operator === "&&") {
    return requireBoolean(left, expression.left.offset) ? requireBoolean(evaluate(expression.right, input), expression.right.offset) : false;
  }
  if (expression.operator === "||") {
    return requireBoolean(left, expression.left.offset) ? true : requireBoolean(evaluate(expression.right, input), expression.right.offset);
  }
  const right = evaluate(expression.right, input);
  switch (expression.operator) {
    case "==":
      return jsonEquals(left, right);
    case "!=":
      return !jsonEquals(left, right);
    case "+":
      if (typeof left === "string" && typeof right === "string") return left + right;
      return assertNumber(
        requireNumber(left, expression.left.offset) + requireNumber(right, expression.right.offset),
        expression.offset
      );
    case "-":
      return numericBinary(left, right, expression, (a, b) => a - b);
    case "*":
      return numericBinary(left, right, expression, (a, b) => a * b);
    case "/":
      return numericBinary(left, right, expression, (a, b) => a / b);
    case "%":
      return numericBinary(left, right, expression, (a, b) => a % b);
    case "<":
    case "<=":
    case ">":
    case ">=":
      return compare(left, right, expression.operator, expression.offset);
    default:
      throw new RestrictedCelError(
        `unsupported operator ${expression.operator}`,
        expression.offset
      );
  }
}
function numericBinary(left, right, expression, operation) {
  return assertNumber(
    operation(
      requireNumber(left, expression.left.offset),
      requireNumber(right, expression.right.offset)
    ),
    expression.offset
  );
}
function compare(left, right, operator, offset) {
  if (typeof left !== typeof right || typeof left !== "number" && typeof left !== "string") {
    throw new RestrictedCelError(
      "comparison operands must have the same numeric or string type",
      offset
    );
  }
  const comparison = typeof left === "number" && typeof right === "number" ? left < right ? -1 : left > right ? 1 : 0 : String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
  if (operator === "<") return comparison < 0;
  if (operator === "<=") return comparison <= 0;
  if (operator === ">") return comparison > 0;
  return comparison >= 0;
}
function requireBoolean(value, offset) {
  if (typeof value !== "boolean") {
    throw new RestrictedCelError("boolean operand required", offset);
  }
  return value;
}
function requireNumber(value, offset) {
  if (typeof value !== "number") {
    throw new RestrictedCelError("numeric operand required", offset);
  }
  return value;
}
function assertNumber(value, offset) {
  if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) {
    throw new RestrictedCelError("numeric result is not JSON-safe", offset);
  }
  return value;
}
function assertRestrictedCelValue(value, offset) {
  if (typeof value === "string") return;
  if (typeof value === "number") {
    assertNumber(value, offset);
    return;
  }
  throw new RestrictedCelError("input value must be a string or number", offset);
}
function jsonEquals(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => jsonEquals(entry, right[index]));
  }
  if (isJsonObject(left) && isJsonObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.hasOwn(right, key) && jsonEquals(left[key], right[key]));
  }
  return false;
}
function freezeJson(value) {
  if (Array.isArray(value)) {
    for (const entry of value) freezeJson(entry);
  } else if (isJsonObject(value)) {
    for (const entry of Object.values(value)) freezeJson(entry);
  } else {
    return value;
  }
  return Object.freeze(value);
}
function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ../reference/ZCode/packages/model-option-map/src/parser.ts
function parseRestrictedCel(tokens, variableName) {
  return new Parser(tokens, variableName).parse();
}
var Parser = class {
  constructor(tokens, variableName) {
    this.tokens = tokens;
    this.variableName = variableName;
  }
  #index = 0;
  parse() {
    const expression = this.parseConditional();
    const trailing = this.current();
    if (trailing.kind !== "eof") {
      if (trailing.value === ".") {
        throw new RestrictedCelError("member access is not supported", trailing.offset);
      }
      if (trailing.value === "(") {
        throw new RestrictedCelError("function calls are not supported", trailing.offset);
      }
      throw new RestrictedCelError(
        `unexpected token ${JSON.stringify(trailing.value)}`,
        trailing.offset
      );
    }
    return expression;
  }
  parseConditional() {
    const condition = this.parseLogicalOr();
    if (!this.consume("?")) return condition;
    const whenTrue = this.parseConditional();
    this.expect(":");
    const whenFalse = this.parseConditional();
    return { type: "conditional", condition, whenTrue, whenFalse, offset: condition.offset };
  }
  parseLogicalOr() {
    return this.parseBinary(() => this.parseLogicalAnd(), /* @__PURE__ */ new Set(["||"]));
  }
  parseLogicalAnd() {
    return this.parseBinary(() => this.parseEquality(), /* @__PURE__ */ new Set(["&&"]));
  }
  parseEquality() {
    return this.parseBinary(() => this.parseRelational(), /* @__PURE__ */ new Set(["==", "!="]));
  }
  parseRelational() {
    return this.parseBinary(() => this.parseAdditive(), /* @__PURE__ */ new Set(["<", "<=", ">", ">="]));
  }
  parseAdditive() {
    return this.parseBinary(() => this.parseMultiplicative(), /* @__PURE__ */ new Set(["+", "-"]));
  }
  parseMultiplicative() {
    return this.parseBinary(() => this.parseUnary(), /* @__PURE__ */ new Set(["*", "/", "%"]));
  }
  parseBinary(parseOperand, operators) {
    let expression = parseOperand();
    while (this.current().kind === "operator" && operators.has(this.current().value)) {
      const operator = this.advance();
      expression = {
        type: "binary",
        operator: operator.value,
        left: expression,
        right: parseOperand(),
        offset: operator.offset
      };
    }
    return expression;
  }
  parseUnary() {
    const token = this.current();
    if (token.kind === "operator" && (token.value === "!" || token.value === "-" || token.value === "+")) {
      this.advance();
      return {
        type: "unary",
        operator: token.value,
        operand: this.parseUnary(),
        offset: token.offset
      };
    }
    return this.parsePrimary();
  }
  parsePrimary() {
    const token = this.advance();
    if (token.kind === "number") {
      const value = Number(token.value);
      if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) {
        throw new RestrictedCelError("number literal is not JSON-safe", token.offset);
      }
      return { type: "literal", value, offset: token.offset };
    }
    if (token.kind === "string")
      return { type: "literal", value: token.value, offset: token.offset };
    if (token.kind === "identifier") {
      if (this.current().value === "(") {
        throw new RestrictedCelError("function calls are not supported", this.current().offset);
      }
      if (token.value === this.variableName) return { type: "input", offset: token.offset };
      if (token.value === "true" || token.value === "false") {
        return { type: "literal", value: token.value === "true", offset: token.offset };
      }
      if (token.value === "null") return { type: "literal", value: null, offset: token.offset };
      throw new RestrictedCelError(
        `unknown identifier ${JSON.stringify(token.value)}`,
        token.offset
      );
    }
    if (token.value === "(") {
      const expression = this.parseConditional();
      this.expect(")");
      return expression;
    }
    if (token.value === "[") return this.parseArray(token.offset);
    if (token.value === "{") return this.parseObject(token.offset);
    throw new RestrictedCelError(`unexpected token ${JSON.stringify(token.value)}`, token.offset);
  }
  parseArray(offset) {
    const elements = [];
    if (!this.consume("]")) {
      do
        elements.push(this.parseConditional());
      while (this.consume(","));
      this.expect("]");
    }
    return { type: "array", elements: Object.freeze(elements), offset };
  }
  parseObject(offset) {
    const entries = [];
    const keys = /* @__PURE__ */ new Set();
    if (!this.consume("}")) {
      do {
        const key = this.advance();
        if (key.kind !== "string") {
          throw new RestrictedCelError("object keys must be string literals", key.offset);
        }
        if (keys.has(key.value)) {
          throw new RestrictedCelError(
            `duplicate object key ${JSON.stringify(key.value)}`,
            key.offset
          );
        }
        keys.add(key.value);
        this.expect(":");
        entries.push({ key: key.value, value: this.parseConditional(), offset: key.offset });
      } while (this.consume(","));
      this.expect("}");
    }
    return { type: "object", entries: Object.freeze(entries), offset };
  }
  consume(value) {
    if (this.current().value !== value) return false;
    this.#index += 1;
    return true;
  }
  expect(value) {
    const token = this.current();
    if (token.value !== value) {
      throw new RestrictedCelError(`expected ${JSON.stringify(value)}`, token.offset);
    }
    this.#index += 1;
    return token;
  }
  advance() {
    const token = this.current();
    if (token.kind !== "eof") this.#index += 1;
    return token;
  }
  current() {
    return this.tokens[this.#index] ?? this.tokens[this.tokens.length - 1];
  }
};

// ../reference/ZCode/packages/model-option-map/src/tokenizer.ts
var DOUBLE_OPERATORS = /* @__PURE__ */ new Set(["&&", "||", "==", "!=", "<=", ">="]);
var SINGLE_OPERATORS = /* @__PURE__ */ new Set(["+", "-", "*", "/", "%", "!", "<", ">"]);
var PUNCTUATION = /* @__PURE__ */ new Set(["{", "}", "[", "]", "(", ")", ",", ":", "?", "."]);
function tokenizeRestrictedCel(source) {
  const tokens = [];
  let offset = 0;
  while (offset < source.length) {
    const character = source[offset];
    if (/\s/u.test(character)) {
      offset += 1;
      continue;
    }
    if (character === "'" || character === '"') {
      const token = readString(source, offset, character);
      tokens.push(token);
      offset = token.end;
      continue;
    }
    if (/[0-9]/u.test(character)) {
      const token = readNumber(source, offset);
      tokens.push(token);
      offset = token.end;
      continue;
    }
    if (/[A-Za-z_]/u.test(character)) {
      const end = readWhile(source, offset + 1, /[A-Za-z0-9_]/u);
      tokens.push({ kind: "identifier", value: source.slice(offset, end), offset, end });
      offset = end;
      continue;
    }
    const pair = source.slice(offset, offset + 2);
    if (DOUBLE_OPERATORS.has(pair)) {
      tokens.push({ kind: "operator", value: pair, offset, end: offset + 2 });
      offset += 2;
      continue;
    }
    if (SINGLE_OPERATORS.has(character)) {
      tokens.push({ kind: "operator", value: character, offset, end: offset + 1 });
      offset += 1;
      continue;
    }
    if (PUNCTUATION.has(character)) {
      tokens.push({ kind: "punctuation", value: character, offset, end: offset + 1 });
      offset += 1;
      continue;
    }
    throw new RestrictedCelError(`unsupported token ${JSON.stringify(character)}`, offset);
  }
  tokens.push({ kind: "eof", value: "", offset: source.length, end: source.length });
  return Object.freeze(tokens);
}
function readNumber(source, offset) {
  const match = /^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(source.slice(offset));
  if (!match) throw new RestrictedCelError("invalid number literal", offset);
  const value = match[0];
  const end = offset + value.length;
  return { kind: "number", value, offset, end };
}
function readString(source, offset, quote) {
  let cursor = offset + 1;
  let value = "";
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === quote) {
      return { kind: "string", value, offset, end: cursor + 1 };
    }
    if (character === "\n" || character === "\r") {
      throw new RestrictedCelError("unterminated string literal", offset);
    }
    if (character !== "\\") {
      value += character;
      cursor += 1;
      continue;
    }
    const escapeOffset = cursor;
    cursor += 1;
    const escaped = source[cursor];
    if (escaped === void 0) {
      throw new RestrictedCelError("unterminated string escape", escapeOffset);
    }
    const simpleEscape = SIMPLE_ESCAPES[escaped];
    if (simpleEscape !== void 0) {
      value += simpleEscape;
      cursor += 1;
      continue;
    }
    if (escaped === "u") {
      const digits = source.slice(cursor + 1, cursor + 5);
      if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) {
        throw new RestrictedCelError("invalid unicode escape", escapeOffset);
      }
      value += String.fromCharCode(Number.parseInt(digits, 16));
      cursor += 5;
      continue;
    }
    throw new RestrictedCelError(`unsupported string escape \\${escaped}`, escapeOffset);
  }
  throw new RestrictedCelError("unterminated string literal", offset);
}
var SIMPLE_ESCAPES = Object.freeze({
  "'": "'",
  '"': '"',
  "\\": "\\",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "	"
});
function readWhile(source, offset, pattern) {
  let cursor = offset;
  while (cursor < source.length && pattern.test(source[cursor])) cursor += 1;
  return cursor;
}

// ../reference/ZCode/packages/model-option-map/src/compiler.ts
var optionMapCache = /* @__PURE__ */ new Map();
var expressionCache = /* @__PURE__ */ new Map();
function compileModelOptionMap(source, variableName) {
  const normalizedSource = normalizeSource(source);
  const cacheKey = createCacheKey(normalizedSource, variableName);
  const cached = optionMapCache.get(cacheKey);
  if (cached) return cached;
  const expression = parseExpression(normalizedSource, variableName);
  assertObjectResultExpression(expression);
  const program = Object.freeze({
    source: normalizedSource,
    evaluate(input) {
      const result = evaluateRestrictedCel(expression, input);
      if (!isJsonObject2(result)) {
        throw new RestrictedCelError("model option map must return a JSON object", 0);
      }
      return result;
    }
  });
  optionMapCache.set(cacheKey, program);
  return program;
}
function normalizeSource(source) {
  const normalizedSource = source.trim();
  if (normalizedSource.length === 0) {
    throw new RestrictedCelError("expression must not be empty", 0);
  }
  return normalizedSource;
}
function parseExpression(source, variableName) {
  const cacheKey = createCacheKey(source, variableName);
  const cached = expressionCache.get(cacheKey);
  if (cached) return cached;
  const expression = parseRestrictedCel(tokenizeRestrictedCel(source), variableName);
  expressionCache.set(cacheKey, expression);
  return expression;
}
function createCacheKey(source, variableName) {
  return `${variableName}\0${source}`;
}
function assertObjectResultExpression(expression) {
  if (expression.type === "object") return;
  if (expression.type === "conditional") {
    assertObjectResultExpression(expression.whenTrue);
    assertObjectResultExpression(expression.whenFalse);
    return;
  }
  throw new RestrictedCelError("model option map must return a JSON object", expression.offset);
}
function isJsonObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ../reference/ZCode/packages/shared/src/config-schema.ts
function sparseShape(shape) {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, schema.nullable().optional()])
  );
}

// ../reference/ZCode/packages/shared/src/model-config.ts
function optionMapSchema(variableName) {
  return z35.string().min(1).superRefine((source, context) => {
    try {
      compileModelOptionMap(source, variableName);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Option map \u65E0\u6CD5\u7F16\u8BD1"
      });
    }
  });
}
var completeEnumOptionSpecDataSchema = z35.object({
  /** 按语义强度从低到高排列；首项是辅助调用可选的最低公开档位。 */
  values: z35.array(
    z35.string().refine((value) => value.trim().length > 0, "reasoningLevel.values \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32")
  ).min(1, "reasoningLevel.values \u4E0D\u80FD\u4E3A\u7A7A").refine((values) => new Set(values).size === values.length, "reasoningLevel.values \u4E0D\u80FD\u91CD\u590D").readonly(),
  map: optionMapSchema("reasoningLevel")
}).strict();
var completeLimitOptionSpecDataSchema = z35.object({
  max: z35.number().int().positive(),
  map: optionMapSchema("maxOutputTokens")
}).strict();
var enumOptionSpecDataSchema = z35.object(sparseShape(completeEnumOptionSpecDataSchema.shape)).strict();
var limitOptionSpecDataSchema = z35.object(sparseShape(completeLimitOptionSpecDataSchema.shape)).strict();
var completeModelInputFormatDataSchema = z35.object({
  supportsText: z35.boolean(),
  supportsImage: z35.boolean(),
  supportsVideo: z35.boolean(),
  supportsAudio: z35.boolean(),
  supportsPdf: z35.boolean()
}).strict();
var completeModelOutputFormatDataSchema = z35.object({ supportsText: z35.boolean() }).strict();
var modelInputFormatDataSchema = z35.object(sparseShape(completeModelInputFormatDataSchema.shape)).strict();
var modelOutputFormatDataSchema = z35.object(sparseShape(completeModelOutputFormatDataSchema.shape)).strict();
var completeModelPropertiesDataSchema = z35.object({
  requiresMfjsToolSchema: z35.boolean(),
  contextWindow: z35.number().int().positive(),
  inputFormat: completeModelInputFormatDataSchema,
  outputFormat: completeModelOutputFormatDataSchema,
  supportsToolCall: z35.boolean(),
  supportsJsonSchemaOutput: z35.boolean(),
  supportsNativeWebSearch: z35.boolean(),
  supportsMidConversationSystem: z35.boolean()
}).strict();
var modelPropertiesDataSchema = z35.object({
  ...sparseShape(completeModelPropertiesDataSchema.shape),
  inputFormat: modelInputFormatDataSchema.nullable().optional(),
  outputFormat: modelOutputFormatDataSchema.nullable().optional()
}).strict();
var completeModelOptionSpecsDataSchema = z35.object({
  reasoningLevel: completeEnumOptionSpecDataSchema,
  maxOutputTokens: completeLimitOptionSpecDataSchema
}).strict();
var modelOptionSpecsDataSchema = z35.object({
  ...sparseShape(completeModelOptionSpecsDataSchema.shape),
  reasoningLevel: enumOptionSpecDataSchema.nullable().optional(),
  maxOutputTokens: limitOptionSpecDataSchema.nullable().optional()
}).strict();
var completeModelConfigDataSchema = z35.object({
  enabled: z35.boolean(),
  properties: completeModelPropertiesDataSchema,
  optionSpecs: completeModelOptionSpecsDataSchema
}).strict();
var modelConfigDataSchema = z35.object({
  ...sparseShape(completeModelConfigDataSchema.shape),
  properties: modelPropertiesDataSchema.nullable().optional(),
  optionSpecs: modelOptionSpecsDataSchema.nullable().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/account-provider-state.ts
import { z as z36 } from "zod";
var accountProviderUnavailableReasonSchema = z36.enum([
  "not-authenticated",
  "not-connected",
  "credential-failed",
  "not-entitled"
]);

// ../reference/ZCode/packages/shared/src/model-execution.ts
import { z as z37 } from "zod";
var modelExecutionSchema = z37.object({
  memoryExtraction: z37.literal("skip").optional(),
  selectionScope: z37.literal("execution"),
  requestAuth: z37.object({
    apiKey: z37.string().min(1).optional(),
    headers: z37.record(z37.string().min(1), z37.string().min(1)).optional()
  }).strict().optional(),
  subagents: z37.object({
    foregroundModel: z37.literal("submission"),
    background: z37.literal("deny")
  }).strict().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/usage-stats.ts
import { z as z38 } from "zod";
var APP_USAGE_RANGES = ["all", "7d", "30d"];
var appUsageFavoriteModelSchema = z38.object({
  modelId: z38.string().nullable(),
  totalTokens: z38.number(),
  share: z38.number()
});
var appUsageSummarySchema = z38.object({
  totalTokens: z38.number(),
  inputTokens: z38.number(),
  outputTokens: z38.number(),
  reasoningTokens: z38.number(),
  cacheCreationTokens: z38.number(),
  cacheReadTokens: z38.number(),
  cacheHitRate: z38.number(),
  totalSessions: z38.number(),
  totalTurns: z38.number(),
  toolCallCount: z38.number(),
  toolErrorRate: z38.number(),
  modelErrorRate: z38.number(),
  avgTimeToFirstTokenMs: z38.number().nullable(),
  avgTurnDurationMs: z38.number().nullable(),
  activeDays: z38.number(),
  currentStreakDays: z38.number(),
  longestSessionMs: z38.number(),
  longestStreakDays: z38.number(),
  peakDayTokens: z38.number(),
  favoriteModel: appUsageFavoriteModelSchema.nullable()
});
var appUsageHeatmapCellSchema = z38.object({
  date: z38.string(),
  level: z38.union([z38.literal(0), z38.literal(1), z38.literal(2), z38.literal(3), z38.literal(4)]),
  totalTokens: z38.number(),
  turnCount: z38.number(),
  toolCallCount: z38.number()
});
var appUsageHeatmapWeekSchema = z38.object({
  weekIndex: z38.number(),
  days: z38.array(appUsageHeatmapCellSchema.nullable())
});
var appUsageHeatmapSchema = z38.object({
  startDate: z38.string().nullable(),
  endDate: z38.string().nullable(),
  maxTokens: z38.number(),
  weeks: z38.array(appUsageHeatmapWeekSchema)
});
var appUsageDailyModelItemSchema = z38.object({
  modelId: z38.string().nullable(),
  totalTokens: z38.number()
});
var appUsageDailyModelUsageSchema = z38.object({
  date: z38.string(),
  models: z38.array(appUsageDailyModelItemSchema)
});
var appUsageModelUsageSchema = z38.object({
  modelId: z38.string().nullable(),
  totalTokens: z38.number(),
  inputTokens: z38.number(),
  outputTokens: z38.number(),
  requestCount: z38.number(),
  share: z38.number()
});
var appUsageToolUsageSchema = z38.object({
  toolName: z38.string(),
  callCount: z38.number(),
  errorCount: z38.number(),
  errorRate: z38.number(),
  avgDurationMs: z38.number().nullable()
});
var appUsageSnapshotSchema = z38.object({
  range: z38.enum(APP_USAGE_RANGES),
  generatedAt: z38.number(),
  timeZone: z38.string(),
  source: z38.literal("agent-db"),
  summary: appUsageSummarySchema,
  heatmap: appUsageHeatmapSchema,
  dailyModelUsage: z38.array(appUsageDailyModelUsageSchema),
  models: z38.array(appUsageModelUsageSchema),
  tools: z38.array(appUsageToolUsageSchema)
});

// ../reference/ZCode/packages/shared/src/bots.ts
import { z as z39 } from "zod";
var botProviders = [
  "telegram",
  "webhook",
  "feishu",
  "lark",
  "weixin",
  "discord",
  "wecom"
];
var zcodeAutomationBotDeliveryTargetSchema = z39.object({
  provider: z39.enum(["feishu", "lark", "weixin"]),
  botId: z39.string().trim().min(1),
  providerUserId: z39.string().trim().min(1),
  chatType: z39.enum(["private", "group"])
}).strict();
var botAllowedCommandsSchema = z39.object({
  status: z39.boolean(),
  new: z39.boolean(),
  workspace: z39.boolean(),
  model: z39.boolean(),
  mode: z39.boolean().optional(),
  thoughtLevel: z39.boolean(),
  sandboxMode: z39.boolean().optional(),
  approvalPolicy: z39.boolean().optional(),
  // 兼容旧 bot-config.json；/cli 命令已移除，新配置不会再写入这个字段。
  cli: z39.boolean().optional(),
  reply: z39.boolean()
}).strict();
var botCurrentOptionsSchema = z39.object({
  modelSelection: modelSelectionSchema.optional(),
  mode: z39.string().min(1).optional(),
  sandboxMode: z39.string().min(1).optional(),
  approvalPolicy: z39.string().min(1).optional(),
  // 兼容旧 bot-config.json；CLI provider 现在统一由 ZCode Protocol 侧配置决定。
  cli: z39.literal(ZCODE_AGENT_PROVIDER).optional()
}).strict();
var botDraftOptionsSchema = z39.object({
  provider: z39.literal(ZCODE_AGENT_PROVIDER),
  modelSelection: modelSelectionSchema.optional(),
  mode: z39.string().min(1).optional()
}).strict();
var botElicitationOptionSchema = z39.object({
  value: z39.string(),
  label: z39.string(),
  description: z39.string().optional()
}).strict();
var botElicitationQuestionSchema = z39.object({
  question: z39.string(),
  header: z39.string(),
  options: z39.array(botElicitationOptionSchema),
  multiSelect: z39.boolean().optional()
}).strict();
var botPendingElicitationSchema = z39.object({
  taskId: z39.string().min(1),
  requestId: z39.string().min(1),
  runId: z39.string().min(1),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  actorKey: z39.string().min(1).optional(),
  currentQuestionIndex: z39.number().int().min(0),
  questions: z39.array(botElicitationQuestionSchema),
  answers: z39.record(z39.string(), z39.array(z39.string())),
  renderContext: z39.object({
    kind: z39.literal("plan_approval"),
    plan: z39.string().min(1)
  }).strict().optional(),
  expandedCustomAnswerQuestionIndexes: z39.array(z39.number().int().min(0)).optional(),
  handledAt: z39.number().optional()
}).strict();
var botConfigSchema = z39.object({
  id: z39.string().min(1),
  name: z39.string(),
  provider: z39.enum(botProviders),
  enabled: z39.boolean(),
  credentialRef: z39.string().min(1).optional(),
  webhookSecretRef: z39.string().min(1).optional(),
  webhookUrl: z39.string().url().optional(),
  webhookAuthHeaderName: z39.string().min(1).optional(),
  feishuAppId: z39.string().min(1).optional(),
  providerUserId: z39.string().min(1).optional(),
  displayName: z39.string().optional(),
  allowedWorkspaces: z39.array(z39.string().min(1)),
  allowedCommands: botAllowedCommandsSchema,
  currentOptions: botCurrentOptionsSchema,
  replyMode: z39.enum([
    "assistant_changes",
    "assistant_toolcalls_changes",
    "summary_changes",
    "streaming_card"
  ])
}).strict();
var botsConfigFileSchema = z39.object({
  version: z39.literal(3),
  bots: z39.array(botConfigSchema)
}).strict();
var botsStateFileSchema = z39.object({
  version: z39.literal(3),
  bots: z39.record(
    z39.string(),
    z39.object({
      botId: z39.string().min(1),
      workspacePath: z39.string().min(1),
      workspaceIdentity: z39.string().min(1).optional(),
      workspaceId: z39.string().min(1).optional(),
      mode: z39.enum(["draft", "task"]),
      activeTaskId: z39.string().min(1).nullable(),
      draftOptions: botDraftOptionsSchema.optional(),
      pendingPermissionOptions: z39.array(
        z39.object({
          requestId: z39.string().min(1),
          optionId: z39.string().min(1),
          command: z39.enum(["approve", "deny"]),
          label: z39.string().min(1),
          response: zcodePermissionResponseSchema,
          handledAt: z39.number().optional()
        })
      ).optional(),
      pendingElicitation: botPendingElicitationSchema.optional(),
      telegramOffset: z39.number().optional(),
      weixinGetUpdatesBuf: z39.string().optional(),
      weixinActivatedAt: z39.number().optional(),
      updatedAt: z39.number()
    })
  )
}).strict();

// ../reference/ZCode/packages/shared/src/validationAppSettings.ts
import { z as z41 } from "zod";

// ../reference/ZCode/packages/shared/src/wslUserValidation.ts
import { z as z40 } from "zod";
var WSL_USER_MAX_LENGTH = 64;
function isValidWslUser(value) {
  const user = value.trim();
  return user.length > 0 && user.length <= WSL_USER_MAX_LENGTH && !containsControlCharacter(user) && !user.includes(":") && !user.includes("/") && !user.includes("\\");
}
function containsControlCharacter(value) {
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint < 32 || codePoint === 127) {
      return true;
    }
  }
  return false;
}
var wslUserSchema = z40.string().trim().max(WSL_USER_MAX_LENGTH).refine((value) => value.length === 0 || isValidWslUser(value), {
  message: "Invalid WSL user"
});

// ../reference/ZCode/packages/shared/src/zcodeEndpoint.ts
function normalizeZCodeEndpointOrigin(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("ZCode endpoint origin is empty");
  }
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("ZCode endpoint origin must use http or https");
  }
  return parsed.origin;
}

// ../reference/ZCode/packages/shared/src/validationAppSettings.ts
var appSettingsOccupationSchema = z41.enum([
  "office",
  "developer",
  "independent",
  "infrastructure",
  "product",
  "design",
  "student",
  "creator",
  "operations",
  "marketing",
  "finance",
  "accounting",
  "legal",
  "other"
]);
var nonEmptyStringSchema2 = z41.string().trim().min(1);
var localeSchema = z41.enum(["zh-CN", "en-US"]);
var localePreferenceSchema = z41.enum(["system", "zh-CN", "en-US"]);
var zcodeInteractionBehaviorSchema = z41.enum(["queue", "guide"]);
var electronReleaseChannelSchema = z41.enum(["stable", "preview"]);
var desktopZoomLevelSchema = z41.number().int().min(-3).max(5);
var desktopWindowSizeSchema = z41.object({
  width: z41.number().int().min(480),
  height: z41.number().int().min(640),
  maximized: z41.boolean()
});
var integratedTerminalShellSelectionSchema = z41.discriminatedUnion("mode", [
  z41.object({
    mode: z41.literal("auto")
  }),
  z41.object({
    mode: z41.literal("shell"),
    dialect: z41.enum(["cmd", "git-bash"]),
    id: nonEmptyStringSchema2,
    label: nonEmptyStringSchema2,
    path: nonEmptyStringSchema2
  })
]);
var providerFamilyDomainSchema = z41.enum(["zai", "bigmodel"]);
var postUpdateReleaseNotesPayloadSchema = z41.object({
  version: nonEmptyStringSchema2,
  title: nonEmptyStringSchema2,
  markdown: nonEmptyStringSchema2,
  releaseDate: nonEmptyStringSchema2.optional(),
  releaseNotesByLocale: z41.partialRecord(
    localeSchema,
    z41.object({ title: nonEmptyStringSchema2, markdown: nonEmptyStringSchema2 })
  ).optional()
});
var skippedElectronUpdateVersionsSchema = z41.partialRecord(electronReleaseChannelSchema, nonEmptyStringSchema2).default({});
var remoteWorkspaceTargetSchema = z41.discriminatedUnion("kind", [
  z41.object({
    kind: z41.literal("ssh"),
    host: nonEmptyStringSchema2,
    port: z41.number().int().positive().max(65535).optional(),
    username: nonEmptyStringSchema2,
    sshConfigAlias: nonEmptyStringSchema2.optional(),
    privateKeyPath: z41.string().optional(),
    assetInstallMode: z41.enum(REMOTE_ASSET_INSTALL_MODES).optional(),
    resourcePackages: z41.object({
      selectedPackageIds: z41.array(z41.string().refine(isKnownRemoteResourcePackageId)).optional()
    }).optional(),
    passwordCredentialKey: nonEmptyStringSchema2.optional(),
    privateKeyPassphraseCredentialKey: nonEmptyStringSchema2.optional()
  }),
  z41.object({
    kind: z41.literal("wsl"),
    distro: z41.string().optional(),
    // 远程历史重连会直接使用 settings 中的 WSL user，必须和连接入口共用校验，避免绕过 UI 后污染 identity/日志。
    user: wslUserSchema.optional()
  }),
  z41.object({
    kind: z41.literal("docker"),
    container: nonEmptyStringSchema2
  })
]);
var appWorkspaceSessionEntrySchema = z41.discriminatedUnion("kind", [
  z41.object({
    kind: z41.literal("local"),
    workspacePath: nonEmptyStringSchema2,
    workspacePurpose: z41.enum(["project", "conversation"]).default("project")
  }),
  z41.object({
    kind: z41.literal("remote"),
    workspacePath: nonEmptyStringSchema2,
    localWorkspacePath: nonEmptyStringSchema2.optional(),
    workspaceIdentity: nonEmptyStringSchema2.optional(),
    target: remoteWorkspaceTargetSchema,
    lastOpenedAt: z41.number().int().nonnegative(),
    lastConnectionStatus: z41.enum(["connected", "failed"]),
    lastConnectionError: z41.string().optional()
  })
]);
var zcodeEndpointOriginSchema = z41.preprocess((value) => {
  if (typeof value !== "string") {
    return void 0;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return void 0;
  }
  try {
    return normalizeZCodeEndpointOrigin(trimmed);
  } catch {
    return void 0;
  }
}, z41.string().optional());
function sanitizeZCodeEndpointOrigin(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const raw = value;
  if (!("zcodeEndpointOrigin" in raw)) {
    return value;
  }
  const parsed = zcodeEndpointOriginSchema.safeParse(raw.zcodeEndpointOrigin);
  if (parsed.success && typeof parsed.data === "string") {
    return { ...raw, zcodeEndpointOrigin: parsed.data };
  }
  const { zcodeEndpointOrigin: _zcodeEndpointOrigin, ...next } = raw;
  return next;
}
function sanitizeDesktopWindowSize(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const raw = value;
  if (!("desktopWindowSize" in raw)) {
    return value;
  }
  const parsed = desktopWindowSizeSchema.safeParse(raw.desktopWindowSize);
  if (parsed.success) {
    return value;
  }
  const { desktopWindowSize: _desktopWindowSize, ...next } = raw;
  return next;
}
function sanitizeEmbeddedBrowserViewportPreference(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const raw = value;
  if (!("embeddedBrowserViewportPreference" in raw)) {
    return value;
  }
  const parsed = embeddedBrowserViewportPreferenceSchema.safeParse(
    raw.embeddedBrowserViewportPreference
  );
  if (parsed.success) {
    return value;
  }
  const { embeddedBrowserViewportPreference: _embeddedBrowserViewportPreference, ...next } = raw;
  return next;
}
function migrateCloseToTrayOnWindowsDefault(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const raw = value;
  if (raw.closeToTrayOnWindowsMigrationInitialized === true) {
    return value;
  }
  return {
    ...raw,
    // 初始化原因：旧版会把默认 false 和用户手动关闭都保存成同一个值，无法可靠区分。
    // 本版本统一开启一次；写入迁移标记后，后续再按用户明确选择保留 true/false。
    closeToTrayOnWindows: true,
    closeToTrayOnWindowsMigrationInitialized: true
  };
}
function migrateMessageStreamShowReasoningDefault(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const raw = value;
  if (raw.messageStreamShowReasoningMigrationInitialized === true) {
    return value;
  }
  return {
    ...raw,
    // 初始化原因：旧版会把默认 false 和用户手动关闭都保存成同一个值，无法可靠区分。
    // 本版本统一开启一次；写入迁移标记后，后续再按用户明确选择保留 true/false。
    messageStreamShowReasoning: true,
    messageStreamShowReasoningMigrationInitialized: true
  };
}
function migrateLegacyLocalePreference(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const raw = value;
  if ("localePreference" in raw || !("locale" in raw)) {
    return value;
  }
  const parsedLocale = localeSchema.safeParse(raw.locale);
  if (!parsedLocale.success) {
    return value;
  }
  return {
    ...raw,
    // 旧 setting.json 只有 locale，无法区分“用户显式选择 zh-CN”和“默认值 zh-CN”。
    // 对已经落盘的旧配置保留原 locale 作为显式偏好，避免升级后误切到 system。
    localePreference: parsedLocale.data
  };
}
var legacyRemoteWorkspaceHistoryEntrySchema = z41.object({
  id: nonEmptyStringSchema2,
  workspacePath: nonEmptyStringSchema2,
  localWorkspacePath: nonEmptyStringSchema2.optional(),
  workspaceIdentity: nonEmptyStringSchema2.optional(),
  target: remoteWorkspaceTargetSchema,
  lastOpenedAt: z41.number().int().nonnegative(),
  lastConnectionStatus: z41.enum(["connected", "failed"]),
  lastConnectionError: z41.string().optional()
});
function stripHistoricalRemoteResourcePackages(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return target;
  }
  const rawTarget = target;
  if (rawTarget.kind !== "ssh" || !("resourcePackages" in rawTarget)) {
    return target;
  }
  const { resourcePackages: _resourcePackages, ...nextTarget } = rawTarget;
  return nextTarget;
}
function migrateLegacyWorkspaceSession(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const raw = value;
  const migrated = { ...raw };
  const lastWorkspaceSession = Array.isArray(raw.lastWorkspaceSession) ? raw.lastWorkspaceSession : [];
  const hasLegacyRemoteEntries = lastWorkspaceSession.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }
    return "historyId" in entry;
  });
  const legacyRemoteHistory = Array.isArray(raw.remoteWorkspaceHistory) ? raw.remoteWorkspaceHistory : [];
  const legacyRemoteHistoryById = new Map(
    legacyRemoteHistory.flatMap((entry) => {
      const sanitizedEntry = entry && typeof entry === "object" && !Array.isArray(entry) ? {
        ...entry,
        // 更老的 remoteWorkspaceHistory 可能保存了已退役资源包 ID。
        // 先剥离历史选择再走 schema，避免迁移阶段误删整条远程历史。
        target: stripHistoricalRemoteResourcePackages(
          entry.target
        )
      } : entry;
      const parsed = legacyRemoteWorkspaceHistoryEntrySchema.safeParse(sanitizedEntry);
      return parsed.success ? [[parsed.data.id, parsed.data]] : [];
    })
  );
  const migratedWorkspaceSessionEntries = lastWorkspaceSession.length > 0 ? lastWorkspaceSession.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const rawEntry = entry;
    if (rawEntry.kind === "local" && typeof rawEntry.workspacePath === "string") {
      return [
        {
          kind: "local",
          workspacePath: rawEntry.workspacePath,
          workspacePurpose: rawEntry.workspacePurpose === "conversation" ? "conversation" : "project"
        }
      ];
    }
    if (rawEntry.kind === "remote") {
      if (typeof rawEntry.workspacePath === "string" && rawEntry.target) {
        return [
          {
            ...rawEntry,
            target: stripHistoricalRemoteResourcePackages(rawEntry.target)
          }
        ];
      }
      if (typeof rawEntry.historyId === "string") {
        const legacyRemoteEntry = legacyRemoteHistoryById.get(rawEntry.historyId);
        return legacyRemoteEntry ? [
          {
            kind: "remote",
            workspacePath: legacyRemoteEntry.workspacePath,
            ...legacyRemoteEntry.localWorkspacePath ? { localWorkspacePath: legacyRemoteEntry.localWorkspacePath } : {},
            ...legacyRemoteEntry.workspaceIdentity ? { workspaceIdentity: legacyRemoteEntry.workspaceIdentity } : {},
            target: stripHistoricalRemoteResourcePackages(legacyRemoteEntry.target),
            lastOpenedAt: legacyRemoteEntry.lastOpenedAt,
            lastConnectionStatus: legacyRemoteEntry.lastConnectionStatus,
            ...legacyRemoteEntry.lastConnectionError ? { lastConnectionError: legacyRemoteEntry.lastConnectionError } : {}
          }
        ] : [];
      }
    }
    return [];
  }) : [];
  const migratedLegacyLocalEntries = Array.isArray(raw.lastOpenTabs) ? raw.lastOpenTabs.flatMap(
    (workspacePath) => typeof workspacePath === "string" ? [
      {
        kind: "local",
        workspacePath,
        workspacePurpose: "project"
      }
    ] : []
  ) : [];
  const existingLocalWorkspacePaths = new Set(
    migratedWorkspaceSessionEntries.flatMap(
      (entry) => entry.kind === "local" && typeof entry.workspacePath === "string" ? [entry.workspacePath] : []
    )
  );
  const nextWorkspaceSession = [
    ...migratedWorkspaceSessionEntries,
    ...migratedLegacyLocalEntries.filter(
      (entry) => !existingLocalWorkspacePaths.has(entry.workspacePath)
    )
  ];
  if (nextWorkspaceSession.length > 0 || hasLegacyRemoteEntries || Array.isArray(raw.lastOpenTabs)) {
    migrated.lastWorkspaceSession = nextWorkspaceSession;
  }
  delete migrated.lastOpenTabs;
  delete migrated.remoteWorkspaceHistory;
  return migrated;
}
var appSettingsObjectSchema = z41.object({
  recentProjects: z41.array(z41.string()).default([]),
  locale: localeSchema.default("zh-CN"),
  // 快捷键用户覆盖（语义校验在 ui/src/shortcuts 生效表阶段容错，schema 只管形状）
  shortcutBindings: z41.record(z41.string(), z41.array(z41.string())).optional(),
  localePreference: localePreferenceSchema.default("system"),
  terminalInheritSystemProfile: z41.boolean().default(true),
  terminalFontFamily: nonEmptyStringSchema2.optional(),
  integratedTerminalShell: integratedTerminalShellSelectionSchema.optional(),
  httpProxy: nonEmptyStringSchema2.optional(),
  httpProxyNoProxy: nonEmptyStringSchema2.optional(),
  httpProxyCaCertPath: nonEmptyStringSchema2.optional(),
  embeddedBrowserAllowInsecureCertificates: z41.boolean().default(false),
  embeddedBrowserViewportPreference: embeddedBrowserViewportPreferenceSchema.default(
    DEFAULT_EMBEDDED_BROWSER_VIEWPORT_PREFERENCE
  ),
  // 输入框电脑操作入口改为默认不展示，设置项保留、默认关闭。
  // default 只对缺省字段生效，显式存过 false 的用户仍保持展示。
  computerUseComposerEntryHidden: z41.boolean().default(true),
  taskAutoArchiveEnabled: z41.boolean().default(false),
  taskAutoArchiveOlderThanDays: z41.number().int().positive().max(365).default(7),
  closeToTrayOnWindows: z41.boolean().default(true),
  closeToTrayOnWindowsMigrationInitialized: z41.boolean().default(true),
  keepAwakeWhileRunning: z41.boolean().default(false),
  desktopZoomLevel: desktopZoomLevelSchema.optional(),
  desktopWindowSize: desktopWindowSizeSchema.optional(),
  desktopChromiumHardwareAccelerationEnabled: z41.boolean().default(true),
  messageStreamShowReasoning: z41.boolean().default(true),
  messageStreamShowReasoningMigrationInitialized: z41.boolean().default(true),
  messageStreamShowTodos: z41.boolean().default(false),
  toolGroupingExploreEnabled: z41.boolean().default(true),
  toolGroupingTerminalEnabled: z41.boolean().default(true),
  toolGroupingChangesEnabled: z41.boolean().default(false),
  zcodeInteractionBehavior: zcodeInteractionBehaviorSchema.default("queue"),
  askUserQuestionAutoResolutionEnabled: z41.boolean().default(true),
  modelIoFullRetentionEnabled: z41.boolean().default(false),
  startPlanRecommendationDismissed: z41.boolean().default(false),
  providerFamilyConnectionSelections: providerFamilyConnectionSelectionSettingsSchema.default({}),
  providerFamilyDomain: providerFamilyDomainSchema.optional(),
  providerFamilyDomainUpdatedAt: z41.number().int().nonnegative().optional(),
  providerFamilyDomainMigrated: z41.boolean().default(false),
  nativeSearchEnhancementsEnabled: z41.boolean().default(true),
  onboardingOccupation: appSettingsOccupationSchema.nullish(),
  proactiveSuggestionsEnabled: z41.boolean().optional(),
  memoryEnabled: z41.boolean().default(false),
  lastWorkspaceSession: z41.array(appWorkspaceSessionEntrySchema).default([]),
  lastActiveTabIndex: z41.number().int().nonnegative().default(0),
  lastActiveTaskByWorkspace: z41.record(z41.string(), z41.string()).optional(),
  dataBaseDir: z41.string().trim().min(1).optional(),
  pendingPostUpdateReleaseNotes: postUpdateReleaseNotesPayloadSchema.optional(),
  receivePreviewUpdates: z41.boolean().default(false),
  autoDownloadAndInstallUpdates: z41.boolean().default(false),
  skippedElectronUpdateVersions: skippedElectronUpdateVersionsSchema,
  settingsSyncFirstRunPromptHandled: z41.boolean().optional(),
  zcodeEndpointOrigin: zcodeEndpointOriginSchema.optional()
});
var appSettingsSchema = z41.preprocess(
  (value) => sanitizeEmbeddedBrowserViewportPreference(
    sanitizeDesktopWindowSize(
      migrateMessageStreamShowReasoningDefault(
        migrateCloseToTrayOnWindowsDefault(
          migrateLegacyLocalePreference(
            sanitizeZCodeEndpointOrigin(migrateLegacyWorkspaceSession(value))
          )
        )
      )
    )
  ),
  appSettingsObjectSchema
);
var appSettingsPatchSchema = z41.object({
  recentProjects: z41.array(z41.string()).optional(),
  locale: localeSchema.optional(),
  shortcutBindings: z41.record(z41.string(), z41.array(z41.string())).optional(),
  localePreference: localePreferenceSchema.optional(),
  terminalInheritSystemProfile: z41.boolean().optional(),
  terminalFontFamily: nonEmptyStringSchema2.optional(),
  integratedTerminalShell: integratedTerminalShellSelectionSchema.optional(),
  httpProxy: nonEmptyStringSchema2.optional(),
  httpProxyNoProxy: nonEmptyStringSchema2.optional(),
  httpProxyCaCertPath: nonEmptyStringSchema2.optional(),
  embeddedBrowserAllowInsecureCertificates: z41.boolean().optional(),
  embeddedBrowserViewportPreference: embeddedBrowserViewportPreferenceSchema.optional(),
  computerUseComposerEntryHidden: z41.boolean().optional(),
  taskAutoArchiveEnabled: z41.boolean().optional(),
  taskAutoArchiveOlderThanDays: z41.number().int().positive().max(365).optional(),
  closeToTrayOnWindows: z41.boolean().optional(),
  keepAwakeWhileRunning: z41.boolean().optional(),
  closeToTrayOnWindowsMigrationInitialized: z41.boolean().optional(),
  desktopZoomLevel: desktopZoomLevelSchema.optional(),
  desktopWindowSize: desktopWindowSizeSchema.optional(),
  desktopChromiumHardwareAccelerationEnabled: z41.boolean().optional(),
  messageStreamShowReasoning: z41.boolean().optional(),
  messageStreamShowReasoningMigrationInitialized: z41.boolean().optional(),
  messageStreamShowTodos: z41.boolean().optional(),
  toolGroupingExploreEnabled: z41.boolean().optional(),
  toolGroupingTerminalEnabled: z41.boolean().optional(),
  toolGroupingChangesEnabled: z41.boolean().optional(),
  zcodeInteractionBehavior: zcodeInteractionBehaviorSchema.optional(),
  askUserQuestionAutoResolutionEnabled: z41.boolean().optional(),
  modelIoFullRetentionEnabled: z41.boolean().optional(),
  startPlanRecommendationDismissed: z41.boolean().optional(),
  providerFamilyConnectionSelections: providerFamilyConnectionSelectionSettingsSchema.optional(),
  providerFamilyDomain: z41.union([providerFamilyDomainSchema, z41.literal("")]).optional(),
  providerFamilyDomainUpdatedAt: z41.number().int().nonnegative().optional(),
  providerFamilyDomainMigrated: z41.boolean().optional(),
  nativeSearchEnhancementsEnabled: z41.boolean().optional(),
  onboardingOccupation: z41.enum([
    "office",
    "developer",
    "independent",
    "infrastructure",
    "product",
    "design",
    "student",
    "creator",
    "operations",
    "marketing",
    "finance",
    "accounting",
    "legal",
    "other"
  ]).nullish(),
  proactiveSuggestionsEnabled: z41.boolean().optional(),
  memoryEnabled: z41.boolean().optional(),
  lastWorkspaceSession: z41.array(appWorkspaceSessionEntrySchema).optional(),
  lastActiveTabIndex: z41.number().int().nonnegative().optional(),
  lastActiveTaskByWorkspace: z41.record(z41.string(), z41.string()).optional(),
  dataBaseDir: z41.string().trim().min(1).optional(),
  pendingPostUpdateReleaseNotes: postUpdateReleaseNotesPayloadSchema.optional(),
  receivePreviewUpdates: z41.boolean().optional(),
  autoDownloadAndInstallUpdates: z41.boolean().optional(),
  skippedElectronUpdateVersions: z41.partialRecord(electronReleaseChannelSchema, nonEmptyStringSchema2).optional(),
  settingsSyncFirstRunPromptHandled: z41.boolean().optional(),
  zcodeEndpointOrigin: zcodeEndpointOriginSchema.optional()
});

// ../reference/ZCode/packages/shared/src/zcode-task-mode-schema.ts
import { z as z42 } from "zod";
var zcodeTaskModeSchema = z42.enum(["yolo", "plan", "edit", "auto", "autoEdit", "build"]);

// ../reference/ZCode/packages/shared/src/official-mcp-auth.ts
var OFFICIAL_MCP_AUTH_HEADER_NAMES = {
  authorization: "Authorization",
  codingPlanAuthorization: "X-Bigmodel-Authorization",
  targetType: "Bigmodel-Target-Type",
  organization: "Bigmodel-Organization",
  project: "Bigmodel-Project"
};
var OFFICIAL_MCP_RESERVED_HEADER_NAMES = [
  ...Object.values(OFFICIAL_MCP_AUTH_HEADER_NAMES).map((name) => name.toLowerCase()),
  "x-coding-plan-api-key",
  "mcp-session-id",
  "mcp-protocol-version"
];
var RESERVED_HEADER_SET = new Set(OFFICIAL_MCP_RESERVED_HEADER_NAMES);
var OFFICIAL_MCP_AUTH_FAILURE_REASONS = [
  "official_auth_unavailable",
  "official_auth_plan_required"
];
var OFFICIAL_MCP_AUTH_PORT_FAILURE_REASONS = [
  ...OFFICIAL_MCP_AUTH_FAILURE_REASONS,
  "official_mcp_origin_untrusted"
];

// ../reference/ZCode/packages/shared/src/localTtft.ts
import { z as z43 } from "zod";
var LOCAL_TTFT_STAGES = [
  "renderer_prepare",
  "command_admission",
  "execution_wait",
  "request_prepare",
  "model_request",
  "output_return"
];
var LOCAL_TTFT_MAX_DETAILS = 64;
var LOCAL_TTFT_PREPARATION_STAGES = [
  "context",
  "hooks",
  "persistence",
  "compaction",
  "mcp",
  "tools",
  "request_assembly"
];
var diagnosticTime = z43.number().finite().nonnegative();
var localTtftDetailSchema = z43.object({
  id: z43.string().min(1).max(128),
  stage: z43.enum([...LOCAL_TTFT_PREPARATION_STAGES, "attempt", "retry_wait", "user_confirmation"]),
  start: diagnosticTime,
  end: diagnosticTime.optional(),
  outcome: z43.enum(["completed", "failed", "cancelled", "first_output"]).optional(),
  requestId: z43.string().min(1).max(128).optional(),
  logicalCallId: z43.string().min(1).max(128).optional(),
  role: z43.enum(["response", "preparation"]).optional(),
  source: z43.enum(["renderer", "cli"])
}).strict().refine((value) => value.end === void 0 || value.end >= value.start);
var time = z43.number().finite().nonnegative();
var identifier = z43.string().min(1).max(128);
var localTtftContextSchema = z43.object({ version: z43.literal(1), observationId: z43.string().uuid() }).strict();
var localTtftClockSchema = z43.object({ instanceId: identifier, receivedAt: time, sentAt: time }).strict();
var localTtftOutputKindSchema = z43.enum(["text", "reasoning", "tool"]);
var localTtftFactsSchema = z43.object({
  ...localTtftContextSchema.shape,
  instanceId: identifier,
  commandId: identifier,
  sessionId: identifier.optional(),
  turnId: identifier.optional(),
  productTurnId: identifier.optional(),
  queryId: identifier.optional(),
  requestId: identifier.optional(),
  logicalCallId: identifier.optional(),
  cliVersion: identifier.optional(),
  provider: identifier.optional(),
  model: identifier.optional(),
  details: z43.array(localTtftDetailSchema).max(LOCAL_TTFT_MAX_DETAILS).optional(),
  truncated: z43.boolean().optional(),
  revision: z43.number().int().nonnegative().optional(),
  sendMode: z43.enum(["idle", "queued", "guided"]).optional(),
  clockInvalid: z43.boolean().optional(),
  receivedAt: time,
  admittedAt: time.optional(),
  executionAt: time.optional(),
  requestAt: time.optional(),
  outputAt: time.optional(),
  outputKind: localTtftOutputKindSchema.optional(),
  terminal: z43.enum(["completed", "failed", "cancelled", "rejected", "interrupted"]).optional(),
  excluded: z43.enum(["busy", "retry", "unsupported", "failed", "capacity"]).optional()
}).strict();
var localTtftIntervalSchema = z43.object({
  stage: z43.enum(LOCAL_TTFT_STAGES),
  start: time,
  end: time,
  source: z43.enum(["renderer", "cli", "aligned"])
}).strict().refine((interval) => interval.end >= interval.start);
var localTtftRecordSchema = z43.object({
  version: z43.literal(1),
  observationId: z43.string().uuid(),
  commandId: identifier.optional(),
  sessionId: identifier.optional(),
  turnId: identifier.optional(),
  productTurnId: identifier.optional(),
  queryId: identifier.optional(),
  requestId: identifier.optional(),
  logicalCallId: identifier.optional(),
  cliVersion: identifier.optional(),
  cliInstanceId: identifier.optional(),
  kind: z43.enum(["start", "first_output", "first_text", "no_text", "excluded", "checkpoint"]),
  outcome: z43.enum([
    "success",
    "busy",
    "retry",
    "unsupported",
    "failed",
    "cancelled",
    "background",
    "expired",
    "capacity",
    "recovery",
    // 桌面 continuous 缓冲溢出/投影重建后的 online snapshot；不是手机 replayable 恢复。
    "resync",
    "clock_invalid",
    "rejected",
    "interrupted",
    "guided",
    "unclosed"
  ]),
  start: time,
  end: time,
  firstOutputKind: localTtftOutputKindSchema.optional(),
  quality: z43.enum(["complete", "missing", "clock_invalid"]),
  clockErrorMs: time.optional(),
  intervals: z43.array(localTtftIntervalSchema).max(6),
  checkpointId: identifier.optional(),
  details: z43.array(localTtftDetailSchema).max(LOCAL_TTFT_MAX_DETAILS).optional(),
  truncated: z43.boolean().optional(),
  sendMode: z43.enum(["idle", "queued", "guided"]).optional(),
  visibility: z43.enum(["foreground", "background", "background_returned"]).optional(),
  visibilityChanges: z43.array(z43.object({ at: time, foreground: z43.boolean() }).strict()).max(32).optional(),
  userWaitMs: time.optional(),
  executionMs: time.optional(),
  timingReliable: z43.boolean().optional(),
  cliTimingReliable: z43.boolean().optional(),
  provider: identifier.optional(),
  model: identifier.optional()
}).strict().refine((record) => record.end >= record.start);
var localTtftBatchSchema = z43.object({
  version: z43.literal(1),
  rendererInstanceId: identifier,
  sequence: z43.number().int().nonnegative(),
  records: z43.array(localTtftRecordSchema).max(32),
  dropped: z43.number().int().nonnegative()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol/index.ts
var ZCODE_PROTOCOL_NAME = "ZCode Protocol";
var ZCODE_PROTOCOL_VERSION = 1;
var zcodeRuntimeCapabilitiesSchema = z44.object({
  independentPlanState: z44.boolean().optional()
});
var nonEmptyString4 = z44.string().trim().min(1);
var jsonObjectSchema2 = z44.record(z44.string(), z44.unknown());
var timestampMsSchema2 = z44.number().int().nonnegative();
var protocolInstantSchema = z44.union([timestampMsSchema2, nonEmptyString4, z44.date()]);
var zcodeNodeReplImageToolResultDisplaySchema = z44.object({
  kind: z44.literal("node_repl_images"),
  images: z44.array(
    z44.object({
      base64: z44.string().min(1).max(200 * 1024),
      mimeType: z44.string().regex(/^image\/[a-z0-9.+-]+$/iu)
    }).strict()
  ).min(1).max(2),
  truncated: z44.boolean().optional(),
  source: z44.literal("browser_turn_end").optional()
}).strict();
var zcodeWorkflowNamePatternSchema = z44.object({
  head: z44.string().min(1).max(128).optional(),
  tail: z44.string().min(1).max(128).optional()
}).strict();
var zcodeWorkflowEdgeSchema = z44.object({
  from: z44.string().min(1).max(64),
  to: z44.string().min(1).max(64),
  back: z44.literal(true).optional()
}).strict();
var zcodeCreateWorkflowCausalityGraphDisplaySchema = z44.object({
  steps: z44.array(
    z44.object({
      id: z44.string().min(1).max(64),
      kind: z44.enum(["ask", "world-read"]),
      label: z44.string().min(1).max(128),
      // 内联 `agent()` receiver 让 label 落到兜底串时，那个名字的静态形状。
      labelPattern: zcodeWorkflowNamePatternSchema.optional(),
      line: z44.number().int().positive().optional(),
      column: z44.number().int().positive().optional(),
      lane: z44.string().min(1).max(64),
      lanes: z44.array(z44.string().min(1).max(64)).max(32).optional(),
      // 展开自的站点 id，只出现在 may-set 车道展开的拷贝上（实时叠加的关联键）；
      // 加字段是 additive 的，不带它的旧载荷照常通过 .strict()。
      source: z44.string().min(1).max(64).optional(),
      // 作者用 `phase("…")` 标记划入的阶段。
      // 与图的 phases / phaseEdges / exits 同进同退：全在场或全缺席。
      phase: z44.string().min(1).max(64).optional(),
      repeat: z44.enum(["stack", "serial"]).optional()
    }).strict()
  ).max(64),
  lanes: z44.array(
    z44.object({
      id: z44.string().min(1).max(64),
      name: z44.string().min(1).max(128).optional(),
      // `name` 缺席而 agent() 首参是带洞的模板串时的静态形状；与 name 互斥。
      namePattern: zcodeWorkflowNamePatternSchema.optional(),
      line: z44.number().int().positive().optional(),
      column: z44.number().int().positive().optional()
    }).strict()
  ).max(32),
  // 参与者与交接；镜像 v4。
  participants: z44.array(
    z44.object({
      id: z44.string().min(1).max(64),
      phase: z44.string().min(1).max(64),
      lane: z44.string().min(1).max(64),
      steps: z44.array(z44.string().min(1).max(64)).min(1).max(64),
      member: z44.object({ index: z44.number().int().nonnegative(), of: z44.number().int().positive() }).strict().optional(),
      many: z44.literal(true).optional()
    }).strict()
  ).max(64),
  handoffs: z44.array(
    zcodeWorkflowEdgeSchema.extend({ types: z44.array(z44.string().min(1).max(128)).min(1).max(8).optional() }).strict()
  ).max(256),
  // 阶段词汇表：作者施加的分组结构，主画面以它为节点。与 phaseEdges / exits / Step.phase
  // 全有或全无——零标记脚本全缺席，UI 据此退回 step/车道视图。零成员阶段也在表里。
  // `unphased` 无 name，显示名由 UI 本地化。
  phases: z44.array(
    z44.object({
      id: z44.string().min(1).max(64),
      name: z44.string().min(1).max(128).optional(),
      line: z44.number().int().positive().optional(),
      column: z44.number().int().positive().optional(),
      // 进入本阶段时还在跑的其他阶段（它们的 strand 尚未 join），阶段表序，不含自己，
      // 为空时缺席。是节点事实而不是边——控制没有从那里转移过来，所以不进 phaseEdges。
      // 时间轴据此把相邻阶段折成一条分叉的「带」，侧栏迷你轨道画成双线段。
      alongside: z44.array(z44.string().min(1).max(64)).min(1).max(32).optional()
    }).strict()
  ).max(32).optional(),
  phaseEdges: z44.array(zcodeWorkflowEdgeSchema).max(128).optional(),
  // 控制流可在其后正常完成的阶段（阶段视图的「阶段 → 返回物」箭头）；组内可为空数组。
  exits: z44.array(z44.string().min(1).max(64)).max(32).optional(),
  sink: z44.array(z44.string().min(1).max(64)).max(64).optional(),
  truncated: z44.boolean().optional()
}).strict();
var zcodeCreateWorkflowToolResultDisplaySchema = z44.object({
  kind: z44.literal("create_workflow"),
  ok: z44.boolean(),
  errorCount: z44.number().int().nonnegative(),
  diagnostics: z44.array(
    z44.object({
      line: z44.number().int().nonnegative(),
      column: z44.number().int().nonnegative(),
      code: z44.number().int().nonnegative(),
      message: z44.string().min(1).max(2048)
    }).strict()
  ).max(100),
  causalityGraph: zcodeCreateWorkflowCausalityGraphDisplaySchema.optional(),
  truncated: z44.boolean().optional()
}).strict();
var zcodeToolResultObjectSchema = jsonObjectSchema2.superRefine((result, context) => {
  const display = result.display;
  if (typeof display !== "object" || display === null || Array.isArray(display)) {
    return;
  }
  const kind = display.kind;
  const schemaByKind = {
    node_repl_images: zcodeNodeReplImageToolResultDisplaySchema,
    create_workflow: zcodeCreateWorkflowToolResultDisplaySchema,
    bash_output: bashOutputDisplaySchema
  };
  const schema = typeof kind === "string" ? schemaByKind[kind] : void 0;
  if (!schema) return;
  const parsed = schema.safeParse(display);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    context.addIssue({ ...issue, path: ["display", ...issue.path] });
  }
});
var zcodeProtocolRequestIdSchema = z44.union([z44.string(), z44.number().int()]);
var zcodeProtocolTraceSchema = z44.object({
  traceparent: nonEmptyString4.optional(),
  traceId: nonEmptyString4.optional(),
  parentId: nonEmptyString4.optional(),
  spanId: nonEmptyString4.optional()
}).strict();
var zcodeProtocolRequestSchema = z44.object({
  id: zcodeProtocolRequestIdSchema,
  method: nonEmptyString4,
  params: z44.unknown().optional(),
  trace: zcodeProtocolTraceSchema.optional()
}).strict();
var zcodeProtocolNotificationSchema = z44.object({
  method: nonEmptyString4,
  params: z44.unknown().optional(),
  trace: zcodeProtocolTraceSchema.optional()
}).strict();
var zcodeProtocolResponseSchema = z44.object({
  id: zcodeProtocolRequestIdSchema,
  result: z44.unknown()
}).strict();
var zcodeProtocolErrorSchema = z44.object({
  id: zcodeProtocolRequestIdSchema,
  error: z44.object({
    code: z44.number().int(),
    message: nonEmptyString4,
    data: z44.unknown().optional()
  }).strict()
}).strict();
var zcodeProtocolMessageSchema = z44.union([
  zcodeProtocolRequestSchema,
  zcodeProtocolNotificationSchema,
  zcodeProtocolResponseSchema,
  zcodeProtocolErrorSchema
]);
var zcodeStorageStartupStateSchema = z44.object({
  schemaVersion: z44.literal(1),
  attemptId: z44.string().min(1).max(128),
  sequence: z44.number().int().positive(),
  databaseId: z44.string().min(1).max(128),
  databaseKind: z44.enum(["session", "tasks-index"]),
  phase: z44.enum(["checking", "waiting_for_lock", "migrating", "committing", "ready", "failed"]),
  // 包含锁内、版本 SQL 之前的可选 lastAppliedMigrationId；旧通知仍可解析。
  migration: databaseMigrationFactsSchema.optional(),
  elapsedMs: z44.number().nonnegative().finite(),
  completed: z44.number().int().nonnegative().optional(),
  total: z44.number().int().nonnegative().optional(),
  errorCode: databaseStartupErrorCodeSchema.optional(),
  ...databaseStartupErrorDetailsSchema.shape
}).strict().superRefine((state, context) => {
  if (state.phase === "failed" && !state.errorCode)
    context.addIssue({ code: "custom", message: "failed requires errorCode" });
});
var zcodeMcpTelemetryPlatformSchema = z44.enum([
  "aix",
  "android",
  "darwin",
  "freebsd",
  "haiku",
  "linux",
  "netbsd",
  "openbsd",
  "sunos",
  "win32",
  "cygwin"
]);
var zcodeMcpTelemetryArchSchema = z44.enum([
  "arm",
  "arm64",
  "ia32",
  "loong64",
  "mips",
  "mipsel",
  "ppc",
  "ppc64",
  "riscv64",
  "s390",
  "s390x",
  "x64"
]);
var zcodeMcpTelemetryBaseSchema = z44.object({
  arch: zcodeMcpTelemetryArchSchema,
  occurredAt: z44.number().int().nonnegative(),
  platform: zcodeMcpTelemetryPlatformSchema
}).strict();
var zcodeMcpProcessTelemetryBaseShape = {
  mcpId: z44.string().regex(
    /^(?:builtin:(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+(?::(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+)*|(?:plugin|custom):[a-f0-9]{12})$/
  ),
  mcpInstanceId: nonEmptyString4,
  mcpIsolation: z44.enum(["session", "workspace"]),
  mcpSource: z44.enum(["builtin", "plugin", "custom"])
};
var zcodeMcpTelemetryEventSchema = z44.discriminatedUnion("kind", [
  zcodeMcpTelemetryBaseSchema.extend({
    kind: z44.literal("process_start"),
    ...zcodeMcpProcessTelemetryBaseShape
  }).strict(),
  zcodeMcpTelemetryBaseSchema.extend({
    kind: z44.literal("process_crash"),
    ...zcodeMcpProcessTelemetryBaseShape,
    affectedSessionCount: z44.number().int().nonnegative().max(1e4),
    exitCode: z44.number().int().nullable(),
    signal: nonEmptyString4.nullable(),
    uptimeMs: z44.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
  }).strict(),
  zcodeMcpTelemetryBaseSchema.extend({
    kind: z44.literal("session_startup"),
    configuredCount: z44.number().int().nonnegative().max(1e4),
    connectedCount: z44.number().int().nonnegative().max(1e4),
    failedCount: z44.number().int().nonnegative().max(1e4),
    processCount: z44.number().int().nonnegative().max(1e4),
    sessionId: nonEmptyString4
  }).strict(),
  zcodeMcpTelemetryBaseSchema.extend({
    kind: z44.literal("memory"),
    ...zcodeMcpProcessTelemetryBaseShape,
    memoryKb: z44.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
    memoryScope: z44.enum(["process_tree", "direct_process"]),
    orphanSuspected: z44.boolean(),
    ownerSessionCount: z44.number().int().nonnegative().max(1e4),
    unownedSeconds: z44.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
  }).strict()
]);
var ZCODE_MCP_RESOURCE_SAMPLE_INTERVAL_MS = 5 * 6e4;
var zcodeMcpResourceSampleSchema = z44.object({
  mcpId: zcodeMcpProcessTelemetryBaseShape.mcpId,
  instanceToken: z44.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  sampledAt: z44.number().int().nonnegative(),
  intervalMs: z44.number().finite().positive(),
  processCount: z44.number().int().positive().max(1e5),
  rssKbTotal: z44.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  rssKbMaxProcess: z44.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  cpuTimeMsDelta: z44.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  uptimeMinutes: z44.number().int().nonnegative(),
  platform: zcodeMcpTelemetryPlatformSchema,
  arch: zcodeMcpTelemetryArchSchema,
  logicalCpuCount: z44.number().int().positive().max(4096),
  totalMemoryGb: z44.number().int().nonnegative().max(1048576)
}).strict();
var zcodeMcpResourceSamplesSchema = z44.array(zcodeMcpResourceSampleSchema).max(1024);
var BASH_RESOURCE_SAMPLE_INTERVAL_MS = 15e3;
var BASH_RESOURCE_MAX_SAMPLES = 20;
var zcodeToolExecResourceSchema = z44.object({
  // 同一完成事实可能经多个 Host 转发；随机标识仅供 main 去重，旧 CLI 缺字段仍兼容。
  completionToken: z44.string().uuid().optional(),
  platform: zcodeMcpTelemetryPlatformSchema,
  toolName: z44.literal("bash"),
  durationMs: z44.number().finite().min(BASH_RESOURCE_SAMPLE_INTERVAL_MS),
  exitKind: z44.enum(["completed", "timeout", "killed", "error"]),
  treeRssKbPeak: z44.number().finite().nonnegative().optional(),
  treeCpuTimeMs: z44.number().finite().nonnegative().optional(),
  sampleCount: z44.number().int().nonnegative().max(BASH_RESOURCE_MAX_SAMPLES),
  cliRssKb: z44.number().finite().nonnegative(),
  systemFreeMemoryKb: z44.number().finite().nonnegative()
}).strict();
var zcodeProcessResourceSampleSchema = z44.object({
  platform: z44.enum([
    "aix",
    "android",
    "darwin",
    "freebsd",
    "haiku",
    "linux",
    "netbsd",
    "openbsd",
    "sunos",
    "win32",
    "cygwin"
  ]),
  arch: z44.enum([
    "arm",
    "arm64",
    "ia32",
    "loong64",
    "mips",
    "mipsel",
    "ppc",
    "ppc64",
    "riscv64",
    "s390",
    "s390x",
    "x64"
  ]),
  logicalCpuCount: z44.number().int().positive().max(4096),
  intervalMs: z44.number().int().positive().max(7 * 24 * 60 * 60 * 1e3),
  cpuCores: z44.number().finite().nonnegative().max(4096),
  cpuPercent: z44.number().finite().nonnegative().max(1e5),
  rssKb: z44.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  /**
   * 以下四项为遥测新增字段，全部可选：旧 CLI 发来的样本仍能通过校验，因此
   * **不递增协议握手版本号**（握手版本是兼容性开关，不是字段版本）。
   */
  heapUsedKb: z44.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  uptimeMinutes: z44.number().int().nonnegative().max(10 * 365 * 24 * 60).optional(),
  totalMemoryGb: z44.number().int().nonnegative().max(1048576).optional(),
  /**
   * CLI 进程启动时随机生成的实例标识，仅供 app 侧 main 统计「同时存活几个 CLI 进程」
   * 与「最大单进程 RSS」。不进 ARMS 属性、不含 pid。收紧字符集是隐私红线的机械保障：
   * 路径、workspace 标识这类内容不可能通过校验。
   */
  instanceToken: z44.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional()
}).strict();
var zcodeProcessChildProcessesParamsSchema = z44.object({}).strict();
var zcodeProcessChildProcessSchema = z44.object({
  pid: z44.number().int().positive(),
  serverName: nonEmptyString4,
  mcpSource: z44.enum(["builtin", "plugin", "custom"]),
  /** 官方/第三方插件的插件名（`plugin:<name>:<key>` 的 name，或官方 host MCP 对应插件）；custom 无 */
  pluginName: nonEmptyString4.optional()
}).strict();
var zcodeProcessChildProcessesResultSchema = z44.object({
  processes: z44.array(zcodeProcessChildProcessSchema).max(1e4)
}).strict();
var zcodeTurnInputSourceSchema = zcodeSyntheticUserMessageSourceSchema;
var zcodeSessionPersistenceSchema = z44.enum(["immediate", "deferred"]);
var zcodePermissionOptionSchema = z44.object({
  optionId: nonEmptyString4,
  kind: nonEmptyString4,
  name: nonEmptyString4,
  description: z44.string().optional(),
  response: zcodePermissionResponseSchema
}).strict();
var zcodeProtocolMcpEntrySchema = z44.object({
  name: nonEmptyString4,
  value: z44.string()
}).strict();
var zcodeProtocolMcpOAuthSchema = z44.union([
  z44.object({
    type: z44.literal("client_credentials"),
    clientId: nonEmptyString4,
    clientSecret: nonEmptyString4,
    clientName: nonEmptyString4.optional(),
    scope: z44.string().optional()
  }).strict(),
  z44.object({
    type: z44.literal("authorization_code"),
    clientId: nonEmptyString4.optional(),
    clientSecret: nonEmptyString4.optional(),
    clientName: nonEmptyString4.optional(),
    redirectPath: nonEmptyString4.optional(),
    scope: z44.string().optional()
  }).strict()
]);
var zcodeProtocolMcpServerSchema = z44.union([
  z44.object({
    name: nonEmptyString4,
    command: nonEmptyString4,
    args: z44.array(z44.string()),
    env: z44.array(zcodeProtocolMcpEntrySchema),
    isolation: z44.enum(["session", "workspace"]).optional(),
    protocolVersion: z44.enum(["legacy", "auto", "2026-07-28"]).optional(),
    timeoutMs: z44.number().int().positive().optional()
  }).strict(),
  z44.object({
    name: nonEmptyString4,
    type: z44.enum(["http", "sse"]),
    url: nonEmptyString4,
    headers: z44.array(zcodeProtocolMcpEntrySchema),
    oauth: zcodeProtocolMcpOAuthSchema.optional(),
    isolation: z44.enum(["session", "workspace"]).optional(),
    protocolVersion: z44.enum(["legacy", "auto", "2026-07-28"]).optional(),
    timeoutMs: z44.number().int().positive().optional()
  }).strict()
]);
var zcodeMcpServerStatusKindSchema = z44.enum([
  "connecting",
  "connected",
  "disabled",
  "disconnected",
  "failed",
  "untrusted"
]);
var MCP_SERVER_FAILURE_KINDS = [
  "config_invalid",
  "runtime_unavailable",
  "process_start_failed",
  "network_unreachable",
  "connection_timeout",
  "protocol_negotiation_failed",
  "tool_list_failed",
  "unexpected_disconnect",
  "oauth_authorization_failed",
  "official_origin_untrusted",
  "not_authenticated",
  "coding_plan_required",
  "server_not_found",
  "server_unavailable",
  "rate_limited",
  "server_internal_error",
  "protocol_error",
  "status_unavailable",
  "connection_failed"
];
var mcpServerFailureKindSchema = z44.enum(MCP_SERVER_FAILURE_KINDS);
var zcodeMcpServerStatusSnapshotSchema = z44.object({
  status: zcodeMcpServerStatusKindSchema,
  transport: z44.enum(["stdio", "http", "sse"]),
  toolCount: z44.number().int().nonnegative(),
  updatedAt: nonEmptyString4,
  error: z44.string().optional(),
  failureKind: mcpServerFailureKindSchema.optional(),
  serverRequestId: nonEmptyString4.optional(),
  protocolEra: z44.enum(["legacy", "modern"]).optional(),
  authorization: z44.object({
    type: z44.literal("oauth_authorization_code"),
    authorizationUrl: nonEmptyString4,
    startedAt: nonEmptyString4
  }).strict().optional()
}).strict();
var zcodeMcpListModeSchema = z44.enum(["connect", "status"]);
var zcodeMcpListParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  mcpServers: z44.array(zcodeProtocolMcpServerSchema).optional(),
  mode: zcodeMcpListModeSchema.default("connect")
}).strict();
var zcodeMcpListResultSchema = z44.object({
  statuses: z44.record(z44.string(), zcodeMcpServerStatusSnapshotSchema)
}).strict();
var zcodeSessionImportMessageSchema = z44.object({
  role: z44.enum(["user", "assistant"]),
  content: z44.string(),
  timestamp: timestampMsSchema2.optional()
}).strict();
var zcodeSessionImportHistorySchema = z44.discriminatedUnion("source", [
  z44.object({
    source: z44.literal("claudeCode"),
    title: z44.string().optional(),
    createdAt: timestampMsSchema2.optional(),
    updatedAt: timestampMsSchema2.optional(),
    messages: z44.array(zcodeSessionImportMessageSchema).min(1)
  }).strict(),
  z44.object({
    source: z44.literal("sharedContext"),
    title: z44.string().trim().min(1),
    createdAt: timestampMsSchema2.optional(),
    markdown: z44.string().min(1),
    provenance: z44.object({
      shareId: z44.string().trim().min(1),
      contextId: z44.string().trim().min(1).optional(),
      shareUrl: z44.string().url().optional(),
      status: z44.enum(["pending", "reserved", "attached", "discarded"]).optional(),
      projectionSha256: z44.string().regex(/^[0-9a-f]{64}$/u),
      artifactSetSha256: z44.string().regex(/^[0-9a-f]{64}$/u),
      formatterVersion: z44.literal(1),
      markdownSha256: z44.string().regex(/^[0-9a-f]{64}$/u),
      installedArtifacts: z44.array(
        z44.object({
          artifactId: z44.string().trim().min(1),
          workspaceRelativePath: z44.string().trim().min(1)
        }).strict()
      )
    }).strict()
  }).strict()
]);
var zcodeThoughtLevelOptionSchema = z44.object({
  value: nonEmptyString4,
  label: nonEmptyString4,
  description: z44.string().optional()
}).strict();
var zcodeModelReasoningOptionsSchema = z44.object({
  levels: z44.array(zcodeThoughtLevelOptionSchema),
  defaultLevel: nonEmptyString4.optional()
}).strict();
var zcodeModelFormatPropertiesSchema = completeModelPropertiesDataSchema.pick({
  inputFormat: true,
  outputFormat: true
});
var zcodeModelOptionSchema = z44.object({
  ref: modelSelectionSchema,
  label: nonEmptyString4,
  providerLabel: nonEmptyString4.optional(),
  description: z44.string().optional(),
  contextWindow: z44.number().int().positive().optional(),
  maxOutputTokens: z44.number().int().positive().optional(),
  reasoning: zcodeModelReasoningOptionsSchema.optional(),
  properties: zcodeModelFormatPropertiesSchema,
  disabledReason: z44.string().optional()
}).strict();
var zcodeAccountAccessSchema = z44.discriminatedUnion("planKind", [
  z44.object({
    type: z44.literal("zhipu-account"),
    family: z44.enum(["zai", "bigmodel"]),
    planKind: z44.literal("start-plan")
  }).strict(),
  z44.object({
    type: z44.literal("zhipu-account"),
    family: z44.enum(["zai", "bigmodel"]),
    planKind: z44.literal("individual-coding-plan")
  }).strict(),
  z44.object({
    type: z44.literal("zhipu-account"),
    family: z44.enum(["zai", "bigmodel"]),
    planKind: z44.literal("team-coding-plan"),
    productId: nonEmptyString4,
    organizationId: nonEmptyString4,
    projectId: nonEmptyString4
  }).strict()
]);
var zcodeProviderAccountAccessSchema = z44.object({
  type: z44.literal("zhipu-account"),
  accountType: z44.enum(["zai", "bigmodel"]),
  mode: z44.enum(["start-plan", "individual-coding-plan", "team-coding-plan", "off-peak"]),
  entitled: z44.boolean()
}).strict();
var zcodeSessionTodoItemSchema = z44.object({
  content: nonEmptyString4,
  status: z44.enum(["pending", "in_progress", "completed"]),
  priority: z44.enum(["high", "medium", "low"])
}).strict();
var zcodeSessionGoalStatsSchema = z44.object({
  timeUsedSeconds: z44.number().int().nonnegative(),
  tokensUsed: z44.number().int().nonnegative(),
  tokenBudget: z44.number().int().positive().nullable(),
  contextUsed: z44.number().int().nonnegative(),
  contextWindow: z44.number().int().nonnegative(),
  toolCallCount: z44.number().int().nonnegative(),
  iterationCount: z44.number().int().nonnegative()
}).strict();
var zcodeSessionTodoGroupSchema = z44.object({
  id: nonEmptyString4,
  source: z44.enum(["goal_iteration", "session"]),
  goalIteration: z44.number().int().positive().optional(),
  targetId: nonEmptyString4.optional(),
  startedAt: timestampMsSchema2.optional(),
  updatedAt: timestampMsSchema2.optional(),
  todos: z44.array(zcodeSessionTodoItemSchema)
}).strict();
var zcodeSessionSettingsStateSchema = z44.object({
  model: z44.object({
    // 未绑定是合法恢复状态；不能为满足协议而伪造模型或阻断历史读取。
    current: modelSelectionSchema.optional(),
    available: z44.array(zcodeModelOptionSchema),
    lastUsed: modelSelectionSchema.optional()
  }).strict(),
  thoughtLevel: z44.object({
    enabled: z44.boolean(),
    current: nonEmptyString4.optional(),
    defaultLevel: nonEmptyString4.optional(),
    available: z44.array(zcodeThoughtLevelOptionSchema)
  }).strict(),
  mode: z44.object({
    current: zcodeSessionModeSchema
  }).strict(),
  permission: z44.object({
    mode: zcodeSessionModeSchema.optional(),
    rulesRevision: z44.number().int().nonnegative().optional()
  }).strict().optional()
}).strict();
var zcodePendingPermissionSchema = z44.object({
  requestId: nonEmptyString4,
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  reason: z44.string(),
  riskLevel: z44.enum(["low", "medium", "high", "critical"]),
  input: z44.unknown().optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  options: z44.array(zcodePermissionOptionSchema).min(1),
  requestedAt: timestampMsSchema2
}).strict();
var zcodeActiveToolCallSchema = z44.object({
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  status: z44.enum(["pending", "running", "completed", "failed", "denied"]),
  startedAt: timestampMsSchema2.optional()
}).strict();
var zcodeSessionProjectionSchema = z44.object({
  sessionId: nonEmptyString4,
  status: zcodeSessionStatusSchema,
  mode: zcodeSessionModeSchema,
  turnCount: z44.number().int().nonnegative(),
  totalTokenCount: z44.number().int().nonnegative(),
  contextUsed: z44.number().int().nonnegative(),
  contextWindow: z44.number().int().nonnegative(),
  currentTurnId: nonEmptyString4.optional(),
  pendingPermissions: z44.array(zcodePendingPermissionSchema),
  activeToolCalls: z44.array(zcodeActiveToolCallSchema),
  backgroundJobs: z44.array(jsonObjectSchema2),
  target: zcodeSessionGoalSchema.nullable().optional(),
  lastError: z44.object({
    type: nonEmptyString4,
    code: nonEmptyString4.optional(),
    message: nonEmptyString4,
    detail: z44.string().optional(),
    attribution: errorAttributionSchema.optional()
  }).strict().optional()
}).strict();
var zcodeSlashCommandSchema = z44.object({
  name: nonEmptyString4,
  description: z44.string(),
  inputHint: z44.string().optional(),
  source: z44.enum(["builtin", "custom"]).optional()
}).strict();
var zcodeModelStreamingKindSchema = z44.enum([
  "start",
  "finish",
  "error",
  "text_start",
  "text_delta",
  "text_end",
  "reasoning_start",
  "reasoning_delta",
  "reasoning_end",
  "tool_input_start",
  "tool_input_delta",
  "tool_input_end",
  "tool_call"
]);
var zcodeModelStreamingEventPayloadSchema = z44.object({
  assistantMessageId: z44.string().optional(),
  delta: z44.string().optional(),
  done: z44.boolean().optional(),
  input: z44.unknown().optional(),
  kind: zcodeModelStreamingKindSchema,
  partId: z44.string().optional(),
  providerExecuted: z44.boolean().optional(),
  toolCallId: z44.string().optional(),
  toolName: z44.string().optional()
}).strict();
var zcodeSessionStateSnapshotSchema = z44.object({
  protocol: z44.object({
    name: z44.literal(ZCODE_PROTOCOL_NAME),
    version: z44.literal(ZCODE_PROTOCOL_VERSION)
  }).strict(),
  session: zcodeSessionInfoSchema,
  settings: zcodeSessionSettingsStateSchema,
  projection: zcodeSessionProjectionSchema,
  runtime: zcodeSessionRuntimeStateSchema,
  messages: z44.array(zcodeMessageWithPartsSchema),
  goalStats: zcodeSessionGoalStatsSchema.optional(),
  todos: z44.array(zcodeSessionTodoItemSchema).optional(),
  todoGroups: z44.array(zcodeSessionTodoGroupSchema).optional(),
  slashCommands: z44.array(zcodeSlashCommandSchema).optional()
}).strict();
var zcodeEventEnvelopeSchema = z44.object({
  eventId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  seq: z44.number().int().nonnegative(),
  traceId: nonEmptyString4.optional(),
  timestamp: timestampMsSchema2,
  deliveryKind: zcodeDeliveryKindSchema.optional()
}).strict();
var zcodeComputerUseOperationEventBaseSchema = z44.object({
  eventId: nonEmptyString4,
  sequenceNumber: z44.number().int().nonnegative(),
  sessionId: nonEmptyString4,
  timestamp: timestampMsSchema2
}).strict();
var zcodeComputerUseTurnStartedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z44.literal("turn-started"),
  turnId: nonEmptyString4
});
var zcodeComputerUseTurnCompletedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z44.literal("turn-completed"),
  turnId: nonEmptyString4
});
var zcodeComputerUseTurnFailedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z44.literal("turn-failed"),
  turnId: nonEmptyString4
});
var zcodeComputerUseToolScheduledEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z44.literal("tool-scheduled"),
  turnId: nonEmptyString4,
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  // 这个 cell 是否在用 Computer Use。只表达布尔事实，不再携带动作名——旧的
  // operationAction 靠从模型源码里抽取动作名得到，SDK 面一变就整体失配（见
  // bootstrap/src/zcode-protocol/computer-use-operation-event.ts 的 usesComputerUse）。
  // 只挂在 scheduled 上：ToolCallStartedPayload 没有 input，start 时已拿不到模型源码。
  computerUse: z44.literal(true).optional()
});
var zcodeComputerUseToolStartedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z44.literal("tool-started"),
  turnId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4.optional()
});
var zcodeComputerUseSessionClosedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z44.literal("session-closed")
});
var zcodeComputerUseOperationEventSchema = z44.discriminatedUnion("kind", [
  zcodeComputerUseTurnStartedEventSchema,
  zcodeComputerUseTurnCompletedEventSchema,
  zcodeComputerUseTurnFailedEventSchema,
  zcodeComputerUseToolScheduledEventSchema,
  zcodeComputerUseToolStartedEventSchema,
  zcodeComputerUseSessionClosedEventSchema
]);
var zcodeSessionEventTypeSchema = z44.enum([
  "session.created",
  "session.resumed",
  "session.updated",
  "session.titleUpdated",
  "session.closed",
  "turn.started",
  "turn.steerQueued",
  "turn.steerDrained",
  "turn.completed",
  "turn.failed",
  "message.upserted",
  "message.removed",
  "part.started",
  "part.delta",
  "part.upserted",
  "part.removed",
  "model.streaming",
  "tool.updated",
  "permission.requested",
  "permission.resolved",
  "userInput.requested",
  "userInput.resolved",
  "checkpoint.created",
  "rewind.triggered",
  "streamRecovery.updated"
]);
var zcodeProtocolErrorDetailSchema = z44.object({
  type: nonEmptyString4,
  message: nonEmptyString4,
  stack: z44.string().optional(),
  code: z44.string().optional(),
  detail: z44.string().optional(),
  underlyingErrorMessage: z44.string().optional(),
  underlyingErrorDetail: z44.string().optional(),
  attribution: errorAttributionSchema.optional(),
  retryable: z44.boolean().optional(),
  data: z44.unknown().optional()
}).strict();
var zcodeSessionCreatedEventPayloadSchema = z44.object({
  mode: zcodeSessionModeSchema,
  contextWindow: z44.number().int().nonnegative()
}).strict();
var zcodeSessionResumedEventPayloadSchema = z44.object({
  directory: nonEmptyString4,
  interruptedToolCount: z44.number().int().nonnegative(),
  messageCount: z44.number().int().nonnegative(),
  partCount: z44.number().int().nonnegative(),
  recoveredCompactTimelineCount: z44.number().int().nonnegative().optional(),
  recoveredSteerInputCount: z44.number().int().nonnegative().optional(),
  resumedTodoCount: z44.number().int().nonnegative().optional()
}).strict();
var zcodeSessionTitleUpdatedEventPayloadSchema = z44.object({
  messageID: nonEmptyString4.optional(),
  previousTitle: z44.string(),
  source: z44.enum(["default", "first_input", "generated", "custom"]),
  title: z44.string()
}).strict();
var zcodeTurnStartedEventPayloadSchema = z44.object({
  turnNumber: z44.number().int().nonnegative(),
  input: z44.string(),
  inputId: nonEmptyString4.optional(),
  queryId: nonEmptyString4.optional(),
  inputSource: zcodeTurnInputSourceSchema.optional(),
  inputVisibility: zcodeMessageVisibilitySchema.optional(),
  executionKind: z44.enum(["agent", "controlOnly"]).optional(),
  targetId: nonEmptyString4.optional(),
  messageId: nonEmptyString4.optional(),
  foregroundExecutionId: nonEmptyString4.optional(),
  intent: jsonObjectSchema2.optional(),
  originMeta: jsonObjectSchema2.optional(),
  // runtime 会透传后台唤醒来源，strict schema 必须同步声明以免丢弃整条事件。
  backgroundSource: z44.enum(["bash", "subagent"]).optional(),
  attachments: z44.array(jsonObjectSchema2).optional()
}).strict();
var zcodeTurnSteerSourceSchema = z44.enum(["plan_approval_feedback", "workflow_refine_feedback"]);
var zcodeTurnSteerCommandKindSchema = z44.enum(["sendText", "sendGoalCommand", "compact"]);
var zcodeTurnSteerDeliverySchema = z44.enum(["queue", "guide"]);
var zcodeTurnSteerQueuedEventPayloadSchema = z44.object({
  pendingInputId: nonEmptyString4,
  inputId: nonEmptyString4.optional(),
  queryId: nonEmptyString4.optional(),
  input: z44.string(),
  inputPreview: z44.string(),
  inputSize: z44.number().int().nonnegative(),
  commandKind: zcodeTurnSteerCommandKindSchema.optional(),
  source: zcodeTurnSteerSourceSchema.optional(),
  toolDisallowlist: z44.array(nonEmptyString4).optional(),
  delivery: zcodeTurnSteerDeliverySchema.optional(),
  targetTurnId: nonEmptyString4,
  queueLength: z44.number().int().nonnegative(),
  intent: jsonObjectSchema2.optional()
}).strict();
var zcodeTurnSteerDrainedEventPayloadSchema = z44.object({
  pendingInputIds: z44.array(nonEmptyString4),
  queryIds: z44.array(nonEmptyString4).optional(),
  targetTurnId: nonEmptyString4,
  injectedMessageIds: z44.array(nonEmptyString4),
  drainedInputs: z44.array(
    z44.object({
      pendingInputId: nonEmptyString4,
      messageId: nonEmptyString4,
      text: z44.string(),
      delivery: zcodeTurnSteerDeliverySchema.optional(),
      intent: jsonObjectSchema2.optional(),
      toolDisallowlist: z44.array(nonEmptyString4).optional()
    }).strict()
  ).optional()
}).strict();
var zcodeTurnCompletedEventPayloadSchema = z44.object({
  response: z44.string(),
  tokenCount: z44.number().int().nonnegative(),
  usage: z44.unknown().optional(),
  toolCallCount: z44.number().int().nonnegative(),
  historyRoundCount: z44.number().int().nonnegative().optional(),
  duration: z44.number().nonnegative(),
  // runtime turn.completed 会附带 cacheStats，协议 schema 之前漏掉该字段。
  // strict 校验失败会让桌面端丢掉终态事件，表现为消息已完成但 UI 一直没有回复。
  cacheStats: z44.object({
    totalMessages: z44.number().int().nonnegative(),
    cachedMessages: z44.number().int().nonnegative(),
    lastCacheHit: z44.boolean(),
    cacheReadTokens: z44.number().int().nonnegative().optional()
  }).strict().optional(),
  inputId: nonEmptyString4.optional(),
  resultType: z44.enum([
    "success",
    // "cancelled": 用户主动中断属于正常结束，复用 turn.completed 上报，避免被映射成 turn.failed。
    "cancelled",
    "error_max_turns",
    "error_max_budget",
    "error_during_execution",
    "error_max_tool_calls"
  ]),
  backgroundSubagentResultConsumed: z44.boolean().optional()
}).strict();
var zcodeTurnFailedEventPayloadSchema = z44.object({
  error: zcodeProtocolErrorDetailSchema,
  turnPhase: z44.string(),
  inputId: nonEmptyString4.optional(),
  backgroundSubagentResultConsumed: z44.boolean().optional()
}).strict();
var zcodeMessageUpsertedEventPayloadSchema = z44.object({
  content: z44.string(),
  attachments: z44.array(z44.unknown()).optional(),
  toolCalls: z44.array(z44.unknown()).optional(),
  type: z44.string().optional(),
  compactBoundary: z44.unknown().optional()
}).strict();
var zcodeMessageRemovedEventPayloadSchema = z44.object({
  messageId: nonEmptyString4,
  reason: z44.string().optional()
}).strict();
var zcodeMessagePartDeltaEventPayloadSchema = z44.object({
  messageId: nonEmptyString4,
  partId: nonEmptyString4,
  field: z44.enum(["text", "reasoning", "input", "output"]).optional(),
  delta: z44.string()
}).strict();
var zcodeMessagePartUpsertedEventPayloadSchema = z44.object({
  part: zcodeMessagePartSchema
}).strict();
var zcodeMessagePartRemovedEventPayloadSchema = z44.object({
  messageId: nonEmptyString4,
  partId: nonEmptyString4,
  reason: z44.string().optional()
}).strict();
var zcodeToolCallBasePayloadSchema = z44.object({
  toolCallId: nonEmptyString4,
  toolName: z44.string().optional(),
  parentToolCallId: nonEmptyString4.optional(),
  source: z44.enum(["subagent"]).optional(),
  agentId: nonEmptyString4.optional(),
  agentType: nonEmptyString4.optional(),
  // subagent mirror 会携带后台归因；strict schema 漏字段会让 session/event 整条被丢弃。
  background: z44.boolean().optional(),
  childSessionId: nonEmptyString4.optional(),
  childToolCallId: nonEmptyString4.optional(),
  description: z44.string().optional()
}).strict();
var zcodeToolUpdatedEventPayloadSchema = z44.discriminatedUnion("kind", [
  zcodeToolCallBasePayloadSchema.extend({
    kind: z44.literal("scheduled"),
    // 修复：CLI 调度事件已携带所属消息 ID；漏声明会让严格校验丢弃整条事件。
    assistantMessageId: nonEmptyString4.optional(),
    toolName: nonEmptyString4,
    input: z44.unknown().optional(),
    inputByteLength: z44.number().int().nonnegative().optional(),
    inputOmitted: z44.boolean().optional(),
    inputRef: z44.literal("model_stream").optional(),
    dependencies: z44.array(nonEmptyString4).optional(),
    parallelGroupIndex: z44.number().int().nonnegative().optional(),
    canRunParallel: z44.boolean().optional(),
    schedule: jsonObjectSchema2.optional()
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z44.literal("started"),
    startedAt: protocolInstantSchema
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z44.literal("progress"),
    elapsedMs: z44.number().nonnegative().optional(),
    pid: z44.number().int().optional(),
    stdoutBytes: z44.number().int().nonnegative().optional(),
    stderrBytes: z44.number().int().nonnegative().optional(),
    outputBytes: z44.number().int().nonnegative().optional(),
    outputPreview: executionOutputPreviewSchema.optional(),
    stdoutTail: z44.string().optional(),
    stderrTail: z44.string().optional()
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z44.literal("result"),
    result: zcodeToolResultObjectSchema,
    duration: z44.number().nonnegative()
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z44.literal("error"),
    error: zcodeProtocolErrorDetailSchema
  }).strict(),
  z44.object({
    kind: z44.literal("batch"),
    toolCallIds: z44.array(nonEmptyString4),
    successCount: z44.number().int().nonnegative(),
    errorCount: z44.number().int().nonnegative()
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z44.literal("raw"),
    payload: jsonObjectSchema2
  }).strict()
]);
var zcodePermissionRequestedEventPayloadSchema = z44.object({
  requestId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  riskLevel: z44.enum(["low", "medium", "high", "critical"]),
  reason: z44.string(),
  input: z44.unknown(),
  suggestedPermissionUpdates: z44.array(zcodePermissionUpdateSchema).optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  options: z44.array(zcodePermissionOptionSchema).min(1),
  childSessionId: nonEmptyString4.optional(),
  background: z44.boolean().optional()
}).strict();
var zcodePermissionResolvedEventPayloadSchema = z44.object({
  requestId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4.optional(),
  decision: zcodePermissionDecisionSchema.optional(),
  reason: z44.string().optional(),
  modifiedInput: z44.unknown().optional(),
  inputSummary: z44.unknown().optional(),
  childSessionId: nonEmptyString4.optional(),
  background: z44.boolean().optional()
}).strict();
var zcodeUserInputRequestedEventPayloadSchema = z44.object({
  requestId: nonEmptyString4,
  prompt: z44.string(),
  inputType: z44.enum(["text", "choice", "confirm"]).optional(),
  choices: z44.array(z44.string()).optional()
}).strict();
var zcodeUserInputResolvedEventPayloadSchema = z44.object({
  requestId: nonEmptyString4,
  value: z44.unknown().optional(),
  cancelled: z44.boolean().optional()
}).strict();
var zcodeSessionClosedEventPayloadSchema = z44.object({
  reason: z44.string().optional()
}).strict();
function zcodeSessionEventEnvelopeFor(type, payload) {
  return zcodeEventEnvelopeSchema.extend({
    type: z44.literal(type),
    payload: payload.optional()
  });
}
var zcodeSessionEventSchema = z44.discriminatedUnion("type", [
  zcodeSessionEventEnvelopeFor("session.created", zcodeSessionCreatedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("session.resumed", zcodeSessionResumedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("session.updated", jsonObjectSchema2),
  zcodeSessionEventEnvelopeFor("session.titleUpdated", zcodeSessionTitleUpdatedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("session.closed", zcodeSessionClosedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("turn.started", zcodeTurnStartedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("turn.steerQueued", zcodeTurnSteerQueuedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("turn.steerDrained", zcodeTurnSteerDrainedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("turn.completed", zcodeTurnCompletedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("turn.failed", zcodeTurnFailedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("message.upserted", zcodeMessageUpsertedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("message.removed", zcodeMessageRemovedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("part.started", zcodeMessagePartUpsertedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("part.delta", zcodeMessagePartDeltaEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("part.upserted", zcodeMessagePartUpsertedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("part.removed", zcodeMessagePartRemovedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("model.streaming", zcodeModelStreamingEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("tool.updated", zcodeToolUpdatedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("permission.requested", zcodePermissionRequestedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("permission.resolved", zcodePermissionResolvedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("userInput.requested", zcodeUserInputRequestedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("userInput.resolved", zcodeUserInputResolvedEventPayloadSchema),
  zcodeSessionEventEnvelopeFor("checkpoint.created", jsonObjectSchema2),
  zcodeSessionEventEnvelopeFor("rewind.triggered", jsonObjectSchema2),
  zcodeSessionEventEnvelopeFor("streamRecovery.updated", jsonObjectSchema2)
]);
var zcodeSessionEventsResultSchema = z44.object({
  events: z44.array(zcodeSessionEventSchema)
}).strict();
var zcodeSessionMessagesResultSchema = z44.object({
  messages: z44.array(zcodeMessageWithPartsSchema)
}).strict();
var zcodeStateUpdatedNotificationSchema = z44.object({
  type: z44.literal("state.updated"),
  scope: z44.enum(["server", "workspace", "session"]),
  workspace: zcodeWorkspaceRefSchema.optional(),
  sessionId: nonEmptyString4.optional(),
  revision: z44.number().int().nonnegative(),
  reason: z44.string().optional(),
  patch: z44.unknown()
}).strict();
var zcodeSessionSubscribeParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  deliveryKind: zcodeDeliveryKindSchema,
  afterSeq: z44.number().int().nonnegative().optional(),
  includeSnapshot: z44.boolean().default(false)
}).strict();
var zcodeSessionSubscribeResultSchema = z44.object({
  sessionId: nonEmptyString4,
  eventSeq: z44.number().int().nonnegative(),
  events: z44.array(zcodeSessionEventSchema),
  snapshot: zcodeSessionStateSnapshotSchema.optional()
}).strict();
var zcodeSessionListResultSchema = z44.object({
  sessions: z44.array(zcodeSessionInfoSchema)
}).strict();
var zcodeSessionSubagentBaseSchema = z44.object({
  childSessionId: nonEmptyString4,
  agentId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4.optional(),
  subagentType: nonEmptyString4,
  title: nonEmptyString4,
  summary: z44.string().optional(),
  startedAt: z44.number().int().nonnegative().optional(),
  endedAt: z44.number().int().nonnegative().optional()
}).strict();
var zcodeSessionRunningSubagentSchema = zcodeSessionSubagentBaseSchema.extend({
  status: z44.enum(["running", "waiting", "blocked"])
});
var zcodeSessionEndedSubagentSchema = zcodeSessionSubagentBaseSchema.extend({
  status: z44.enum(["success", "failed", "cancelled", "lost"])
});
var zcodeSessionSubagentsResultSchema = z44.object({
  revision: z44.number().int().nonnegative(),
  childSessionIds: z44.array(nonEmptyString4),
  running: z44.array(zcodeSessionRunningSubagentSchema),
  ended: z44.object({
    total: z44.number().int().nonnegative(),
    items: z44.array(zcodeSessionEndedSubagentSchema),
    nextCursor: nonEmptyString4.optional()
  }).strict()
}).strict();
var zcodeSessionCreateParamsSchema = z44.object({
  sessionId: nonEmptyString4.optional(),
  workspace: zcodeWorkspaceRefSchema,
  parentSessionId: nonEmptyString4.optional(),
  mode: zcodeSessionModeSchema.optional(),
  model: modelSelectionSchema.optional(),
  persistence: zcodeSessionPersistenceSchema.optional(),
  thoughtLevel: nonEmptyString4.optional(),
  titleGenerationEnabled: z44.boolean().optional(),
  mcpServers: z44.array(zcodeProtocolMcpServerSchema).optional(),
  toolAllowlist: z44.array(nonEmptyString4).optional(),
  toolDenylist: z44.array(nonEmptyString4).optional(),
  importedHistory: zcodeSessionImportHistorySchema.optional(),
  // host 只按本地服务装配/远程/端形态决定是否注册工具，不读取灰度；
  // 缺省不下发 = 不注册；灰度与套餐准入在实际创建的 Host handler 校验。
  offPeakToolEnabled: z44.boolean().optional(),
  // 动态工作流灰度：与 offPeakToolEnabled 同一
  // 模式——host 裁决后下发，缺省不下发 = 不注册工作流工具簇（fail-closed）。
  dynamicWorkflowEnabled: z44.boolean().optional()
}).strict();
var zcodeSessionResumeParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  workspace: zcodeWorkspaceRefSchema.optional(),
  // 旧 session 尚无 runtime/model_selection entry 时，由同 task 的索引元数据提供迁移 hint。
  thoughtLevel: nonEmptyString4.optional(),
  mcpServers: z44.array(zcodeProtocolMcpServerSchema).optional(),
  // 冷恢复重建 runtime 时必须沿用 create 的工具面约束（否则会绕过 allow/deny，尤其 CUA 会话）。
  toolAllowlist: z44.array(nonEmptyString4).optional(),
  toolDenylist: z44.array(nonEmptyString4).optional(),
  // 与 create 同语义；resume 不带会导致冷恢复丢 Off-Peak 工具面。
  offPeakToolEnabled: z44.boolean().optional(),
  // 与 create 同语义；resume 不带会导致冷恢复丢工作流工具簇。
  dynamicWorkflowEnabled: z44.boolean().optional()
}).strict();
var zcodeSessionListParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema.optional(),
  // 显式身份查询包含隐藏会话；普通列表仍只返回主任务，避免索引修复激活 runtime。
  sessionIds: z44.array(nonEmptyString4).min(1).max(64).optional(),
  includeArchived: z44.boolean().default(false),
  limit: z44.number().int().positive().optional()
}).strict();
var zcodeSessionSubagentsParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  endedCursor: nonEmptyString4.optional(),
  endedLimit: z44.number().int().positive().max(100).default(20)
}).strict();
var zcodeUsageStatsParamsSchema = z44.object({
  range: z44.enum(APP_USAGE_RANGES),
  timeZone: z44.string().optional()
}).strict();
var zcodeTaskTokenUsageParamsSchema = z44.object({
  sessionId: nonEmptyString4
}).strict();
var zcodeTaskTokenUsageResultSchema = z44.object({
  sessionId: nonEmptyString4,
  totalTokens: z44.number().int().nonnegative(),
  inputTokens: z44.number().int().nonnegative(),
  outputTokens: z44.number().int().nonnegative(),
  reasoningTokens: z44.number().int().nonnegative(),
  cacheCreationTokens: z44.number().int().nonnegative(),
  cacheReadTokens: z44.number().int().nonnegative(),
  modelRequestCount: z44.number().int().nonnegative(),
  modelErrorCount: z44.number().int().nonnegative(),
  inputBaselineBySource: z44.record(z44.string(), z44.number().int().nonnegative())
}).strict();
var zcodeSessionReadParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  deliveryKind: zcodeDeliveryKindSchema.optional(),
  messageLimit: z44.number().int().positive().optional(),
  afterSeq: z44.number().int().nonnegative().optional()
}).strict();
var zcodeSessionMessagesParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  afterMessageId: nonEmptyString4.optional(),
  limit: z44.number().int().positive().optional()
}).strict();
var zcodeSessionEventsParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  afterSeq: z44.number().int().nonnegative().optional(),
  limit: z44.number().int().positive().optional()
}).strict();
var zcodeSessionRuntimePreferencesScopeSchema = z44.enum([
  "runtime-materialization",
  "user-execution"
]);
var zcodeSessionRequestRuntimePreferencesParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  scope: zcodeSessionRuntimePreferencesScopeSchema
}).strict();
var DEFAULT_ZCODE_MODEL_CONTEXT_BUDGET_STRATEGY = "preflight-v1";
var zcodeModelContextBudgetStrategySchema = z44.enum(["legacy", "preflight-v1"]);
var zcodeSessionRuntimePreferencesResultSchema = z44.object({
  nativeSearchEnhancementsEnabled: z44.boolean(),
  memoryEnabled: z44.boolean().default(false),
  askUserQuestionAutoResolutionEnabled: z44.boolean().default(true),
  integratedTerminalShell: integratedTerminalShellSelectionSchema.optional(),
  // 兼容旧 Host：缺少字段时在协议解析边界使用当前默认策略。
  modelContextBudgetStrategy: zcodeModelContextBudgetStrategySchema.default(
    DEFAULT_ZCODE_MODEL_CONTEXT_BUDGET_STRATEGY
  )
}).strict();
var zcodeBrowserAmbientContextSchema = z44.object({
  tabCount: z44.number().int().positive().max(100),
  currentUrl: z44.string().trim().min(1).max(4096).optional()
}).strict();
var zcodeSessionSendParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  modelSelection: modelSelectionSchema.optional(),
  modelExecution: modelExecutionSchema.optional(),
  inputId: nonEmptyString4.optional(),
  queryId: nonEmptyString4.optional(),
  content: z44.string(),
  attachments: z44.array(jsonObjectSchema2).optional(),
  browserAmbientContext: zcodeBrowserAmbientContextSchema.optional(),
  expectedRevision: z44.number().int().nonnegative().optional(),
  expectedProviderRevision: nonEmptyString4.optional(),
  automationId: nonEmptyString4.optional(),
  offPeakTaskId: nonEmptyString4.optional(),
  offPeakRunType: z44.enum(["init", "resume"]).optional(),
  botDeliveryTarget: zcodeAutomationBotDeliveryTargetSchema.optional(),
  toolDenylist: z44.array(nonEmptyString4).optional()
}).strict().superRefine((payload, context) => {
  if (payload.automationId && payload.offPeakTaskId) {
    context.addIssue({
      code: z44.ZodIssueCode.custom,
      message: "automationId and offPeakTaskId are mutually exclusive"
    });
  }
  if (payload.offPeakRunType && !payload.offPeakTaskId) {
    context.addIssue({
      code: z44.ZodIssueCode.custom,
      message: "offPeakRunType requires offPeakTaskId",
      path: ["offPeakRunType"]
    });
  }
  if (payload.modelExecution && !payload.modelSelection) {
    context.addIssue({
      code: z44.ZodIssueCode.custom,
      message: "modelExecution requires modelSelection",
      path: ["modelExecution"]
    });
  }
});
var zcodeSessionSendResultSchema = z44.object({
  sessionId: nonEmptyString4,
  accepted: z44.literal(true),
  stateRevision: z44.number().int().nonnegative()
}).strict();
var zcodeSessionHistoryTargetSchema = z44.discriminatedUnion("kind", [
  z44.object({
    kind: z44.literal("turn"),
    turnIndex: z44.number().int().nonnegative()
  }).strict(),
  z44.object({
    kind: z44.literal("message"),
    messageId: nonEmptyString4
  }).strict(),
  z44.object({
    kind: z44.literal("checkpoint"),
    checkpointId: nonEmptyString4
  }).strict(),
  z44.object({
    kind: z44.literal("latestCheckpoint")
  }).strict()
]);
var zcodeSessionForkParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  target: zcodeSessionHistoryTargetSchema.default({
    kind: "latestCheckpoint"
  }),
  expectedRevision: z44.number().int().nonnegative().optional()
}).strict();
var zcodeSessionForkResultSchema = z44.object({
  forkedSessionId: nonEmptyString4,
  parentSessionId: nonEmptyString4.optional(),
  targetMessageId: nonEmptyString4.optional(),
  targetCheckpointId: nonEmptyString4.optional(),
  response: z44.string(),
  snapshot: zcodeSessionStateSnapshotSchema
}).strict();
var zcodeSessionCompactParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  inputId: nonEmptyString4.optional(),
  instructions: z44.string().optional(),
  expectedRevision: z44.number().int().nonnegative().optional()
}).strict();
var zcodeSessionCompactResultSchema = z44.object({
  response: z44.string(),
  snapshot: zcodeSessionStateSnapshotSchema,
  compact: z44.object({
    state: z44.enum(["accepted", "already_running"]),
    inputId: nonEmptyString4.optional(),
    operationId: nonEmptyString4.optional()
  }).strict().optional()
}).strict();
var zcodeSessionGoalActionSchema = z44.enum([
  "show",
  "set",
  "replace",
  "pause",
  "resume",
  "clear"
]);
var zcodeSessionGoalParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  inputId: nonEmptyString4.optional(),
  action: zcodeSessionGoalActionSchema,
  objective: z44.string().optional(),
  expectedRevision: z44.number().int().nonnegative().optional()
}).strict();
var zcodeSessionGoalResultSchema = z44.object({
  response: z44.string(),
  snapshot: zcodeSessionStateSnapshotSchema,
  startedTurn: z44.boolean().optional()
}).strict();
var zcodeSessionStopParamsSchema = z44.object({
  sessionId: nonEmptyString4
}).strict();
var zcodeBackgroundTaskInfoStatusSchema = z44.enum([
  "running",
  "completed",
  "failed",
  "timed_out",
  "cancelled",
  "spawn_error",
  "lost"
]);
var zcodeBackgroundTaskInfoSchema = z44.object({
  taskId: nonEmptyString4,
  toolCallId: nonEmptyString4.optional(),
  toolName: nonEmptyString4.optional(),
  taskKind: z44.enum(["bash", "subagent"]).optional(),
  blocked: z44.boolean().optional(),
  blockedReason: z44.string().optional(),
  cancellable: z44.boolean().optional(),
  cancelRequestedAt: protocolInstantSchema.optional(),
  command: z44.string().optional(),
  description: z44.string().optional(),
  status: zcodeBackgroundTaskInfoStatusSchema,
  pid: z44.number().int().positive().optional(),
  startedAt: protocolInstantSchema.optional(),
  completedAt: protocolInstantSchema.optional(),
  outputPath: z44.string().optional(),
  stderrPersistedOutputPath: z44.string().optional(),
  stdoutPersistedOutputPath: z44.string().optional(),
  outputBytes: z44.number().int().nonnegative().optional(),
  outputTruncated: z44.boolean().optional(),
  outputTail: z44.string().optional(),
  stderrBytes: z44.number().int().nonnegative().optional(),
  stderrTail: z44.string().optional(),
  stdoutBytes: z44.number().int().nonnegative().optional(),
  stdoutTail: z44.string().optional(),
  terminalId: nonEmptyString4.optional()
}).strict();
var zcodeSessionCancelBackgroundTaskParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  taskId: nonEmptyString4
}).strict();
var zcodeSessionCancelBackgroundTaskResultSchema = z44.object({
  cancelled: z44.boolean(),
  reason: z44.string().optional(),
  snapshot: zcodeBackgroundTaskInfoSchema.optional(),
  status: zcodeBackgroundTaskInfoStatusSchema,
  taskId: nonEmptyString4
}).strict();
var zcodeSessionSetModelParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  model: modelSelectionSchema,
  expectedRevision: z44.number().int().nonnegative().optional(),
  persistAsWorkspaceLastUsed: z44.boolean().default(true)
}).strict();
var zcodeSessionSetThoughtLevelParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  thoughtLevel: nonEmptyString4.optional(),
  expectedRevision: z44.number().int().nonnegative().optional(),
  persistAsWorkspaceLastUsed: z44.boolean().default(true)
}).strict();
var zcodeSessionSetModeParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  mode: zcodeSessionModeSchema,
  expectedRevision: z44.number().int().nonnegative().optional()
}).strict();
var zcodeSessionCloseParamsSchema = z44.object({
  sessionId: nonEmptyString4,
  expectedPersistence: zcodeSessionPersistenceSchema.optional()
}).strict();
var zcodeSessionCloseResultSchema = z44.object({
  closed: z44.boolean().optional()
}).strict();
var zcodeWorkspaceReadPresentationParamsSchema = z44.object({ workspace: zcodeWorkspaceRefSchema }).strict();
var zcodeWorkspacePresentationSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  mode: zcodeSessionModeSchema,
  slashCommands: z44.array(zcodeSlashCommandSchema)
}).strict();
var workspaceHookSha256DigestSchema = z44.string().regex(/^[a-f0-9]{64}$/u);
var zcodeWorkspaceHookTrustGrantParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  bundleDigest: workspaceHookSha256DigestSchema,
  hookDeclarationDigest: workspaceHookSha256DigestSchema
}).strict();
var zcodeWorkspaceHookTrustGrantReasonCodeSchema = z44.enum([
  "workspace_hooks_blocked_by_policy",
  "workspace_hooks_bundle_changed",
  "workspace_hooks_snapshot_mismatch",
  "workspace_hooks_policy_requires_pretrust",
  "workspace_hooks_trust_store_corrupt",
  "workspace_hooks_config_unreadable"
]);
var zcodeWorkspaceHookTrustGrantResultSchema = z44.object({
  accepted: z44.boolean(),
  reasonCode: zcodeWorkspaceHookTrustGrantReasonCodeSchema.optional()
}).strict();
var zcodeWorkspaceModelToolCallSchema = z44.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  input: z44.unknown()
}).strict();
var zcodeWorkspaceModelMessageSchema = z44.discriminatedUnion("role", [
  z44.object({ role: z44.literal("system"), content: z44.string() }).strict(),
  z44.object({ role: z44.literal("user"), content: z44.string() }).strict(),
  z44.object({
    role: z44.literal("assistant"),
    content: z44.string(),
    toolCalls: z44.array(zcodeWorkspaceModelToolCallSchema).optional()
  }).strict(),
  z44.object({
    role: z44.literal("tool"),
    content: z44.string(),
    toolCallId: nonEmptyString4,
    toolName: nonEmptyString4,
    isError: z44.boolean().optional()
  }).strict()
]);
var zcodeWorkspaceModelToolSchema = z44.object({
  name: nonEmptyString4,
  description: z44.string().optional(),
  inputSchema: z44.record(z44.string(), z44.unknown())
}).strict();
var zcodeWorkspaceGenerateTextParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  selection: modelSelectionSchema,
  prompt: nonEmptyString4.optional(),
  messages: z44.array(zcodeWorkspaceModelMessageSchema).min(1).optional(),
  tools: z44.array(zcodeWorkspaceModelToolSchema).optional(),
  querySource: nonEmptyString4,
  maxOutputTokens: z44.number().int().positive().optional(),
  operationId: nonEmptyString4.optional()
}).strict().refine((value) => value.prompt !== void 0 || value.messages !== void 0, {
  message: "prompt \u6216 messages \u81F3\u5C11\u9700\u8981\u63D0\u4F9B\u4E00\u4E2A"
});
var zcodeWorkspaceGenerateTextResultSchema = z44.object({
  text: z44.string(),
  selection: modelSelectionSchema,
  toolCalls: z44.array(zcodeWorkspaceModelToolCallSchema).optional(),
  // 可选以兼容仍在运行的旧 app-server；新 CLI 始终返回结构化结束原因。
  finishReason: z44.string().optional(),
  usage: z44.object({
    inputTokens: z44.number().nonnegative().optional(),
    outputTokens: z44.number().nonnegative().optional(),
    totalTokens: z44.number().nonnegative().optional(),
    cacheReadTokens: z44.number().nonnegative().optional(),
    cacheWriteTokens: z44.number().nonnegative().optional(),
    reasoningTokens: z44.number().nonnegative().optional(),
    serverToolUse: z44.object({
      webSearchRequests: z44.number().nonnegative().optional(),
      webFetchRequests: z44.number().nonnegative().optional()
    }).strict().optional()
  }).strict().optional()
}).strict();
var zcodeWorkspaceCancelGenerateTextParamsSchema = z44.object({ operationId: nonEmptyString4 }).strict();
var zcodeWorkspaceCancelGenerateTextResultSchema = z44.object({ operationId: nonEmptyString4, cancelled: z44.boolean() }).strict();
var zcodeProviderTestModelConnectivityParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  selection: modelSelectionSchema
}).strict();
var zcodeProviderTestModelConnectivityResultSchema = z44.object({ success: z44.literal(true) }).strict();
var zcodeProviderUpdateAccountConfigParamsSchema = z44.object({
  revision: nonEmptyString4,
  basedOnZCodeBuiltinRevision: nonEmptyString4,
  // Provider Config 的字段校验由 @zcode/provider 负责；协议层只约束可传输信封。
  providers: z44.record(z44.string(), z44.unknown()),
  // 账号状态与 Overlay 必须一起传递，否则 Worker 会丢失非当前套餐的执行门禁。
  states: z44.record(
    z44.string(),
    z44.object({
      availability: z44.enum(["available", "pending", "unavailable", "unknown"]),
      entitled: z44.boolean(),
      unavailableReason: accountProviderUnavailableReasonSchema.optional(),
      current: z44.boolean().optional(),
      connectionKey: z44.string().optional(),
      effectiveAt: z44.number().finite().optional()
    }).strict()
  )
}).strict();
var zcodeProviderUpdateAccountConfigResultSchema = z44.object({
  // 收到账号结果不代表配套 Built-in 已到达；应用版本只能读取 Registry 快照。
  receivedRevision: nonEmptyString4,
  providerCount: z44.number().int().nonnegative(),
  status: z44.enum(["received", "unchanged"])
}).strict();
var zcodeInteractionPreferencesSchema = z44.object({
  askUserQuestionAutoResolutionEnabled: z44.boolean()
}).strict();
var zcodeWorkspaceUpdateInteractionPreferencesParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  preferences: zcodeInteractionPreferencesSchema
}).strict();
var zcodeWorkspaceUpdateInteractionPreferencesResultSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  askUserQuestionAutoResolutionEnabled: z44.boolean(),
  snoozedInteractionCount: z44.number().int().nonnegative()
}).strict();
var zcodeModelIoPreferencesSchema = z44.object({
  fullRetentionEnabled: z44.boolean()
}).strict();
var zcodeWorkspaceUpdateModelIoPreferencesParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  preferences: zcodeModelIoPreferencesSchema
}).strict();
var zcodeWorkspaceUpdateModelIoPreferencesResultSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  fullRetentionEnabled: z44.boolean(),
  updatedSessionCount: z44.number().int().nonnegative()
}).strict();
var zcodeWorkspaceUpdateOffPeakToolPolicyParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z44.boolean()
}).strict();
var zcodeWorkspaceUpdateOffPeakToolPolicyResultSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z44.boolean()
}).strict();
var zcodeWorkspaceUpdateDynamicWorkflowPolicyParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z44.boolean()
}).strict();
var zcodeWorkspaceUpdateDynamicWorkflowPolicyResultSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z44.boolean()
}).strict();
var zcodePermissionRequestParamsSchema = z44.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  reason: z44.string(),
  riskLevel: z44.enum(["low", "medium", "high", "critical"]),
  input: z44.unknown(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  options: z44.array(zcodePermissionOptionSchema).min(1)
}).strict();
var zcodeBrowserListParamsSchema = z44.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  workspaceKey: nonEmptyString4,
  workspacePath: nonEmptyString4,
  workspaceIdentity: nonEmptyString4.optional(),
  remoteSessionId: nonEmptyString4.optional(),
  clientMode: browserClientModeSchema,
  sessionContext: browserSessionContextKindSchema
}).strict();
var zcodeBrowserListResultSchema = browserBackendListResultSchema;
var zcodeBrowserExecuteParamsSchema = z44.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  browserId: nonEmptyString4.optional(),
  browserGeneration: z44.number().int().nonnegative().optional(),
  workspaceKey: nonEmptyString4.optional(),
  workspacePath: nonEmptyString4.optional(),
  workspaceIdentity: nonEmptyString4.optional(),
  remoteSessionId: nonEmptyString4.optional(),
  clientMode: browserClientModeSchema.optional(),
  sessionContext: browserSessionContextKindSchema.optional(),
  command: browserCommandSchema
}).strict();
var zcodeBrowserExecuteResultSchema = browserCommandResultSchema;
var zcodeUserInputOptionSchema = z44.object({
  value: nonEmptyString4,
  label: nonEmptyString4,
  description: z44.string().optional(),
  preview: z44.string().optional()
}).strict();
var zcodeUserInputQuestionSchema = z44.object({
  question: nonEmptyString4,
  header: nonEmptyString4,
  options: z44.array(zcodeUserInputOptionSchema).min(1),
  multiSelect: z44.boolean().optional()
}).strict();
var zcodeUserInputRequestParamsSchema = z44.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4.optional(),
  toolName: nonEmptyString4.optional(),
  prompt: z44.string().optional(),
  questions: z44.array(zcodeUserInputQuestionSchema).min(1).optional(),
  input: z44.unknown().optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  schema: z44.unknown().optional()
}).strict();
var zcodeUserInputResponseSchema = z44.object({
  action: z44.enum(["accept", "decline", "cancel"]),
  content: jsonObjectSchema2.optional(),
  reason: z44.string().optional()
}).strict();
var zcodeProviderRuntimeHeadersRequestReasonSchema = z44.enum(["model-request"]);
var zcodeProviderRuntimeHeadersRequestParamsSchema = z44.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  workspace: zcodeWorkspaceRefSchema,
  modelSelection: modelSelectionSchema,
  providerId: nonEmptyString4,
  accountAccess: zcodeProviderAccountAccessSchema.optional(),
  reason: zcodeProviderRuntimeHeadersRequestReasonSchema
}).strict();
var zcodeProviderRuntimeHeadersCancelledSchema = z44.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  workspace: zcodeWorkspaceRefSchema
}).strict();
var zcodeProviderRuntimeHeadersResponseSchema = z44.discriminatedUnion("headersApplied", [
  z44.object({
    headersApplied: z44.literal(true),
    // 合并重接：成功必须携带当前请求的鉴权材料，不依赖旧 Registry 已被写入。
    requestAuth: z44.object({
      apiKey: nonEmptyString4.optional(),
      headers: z44.record(nonEmptyString4, nonEmptyString4).optional()
    }).strict(),
    errorMessage: nonEmptyString4.optional()
  }).strict(),
  z44.object({
    headersApplied: z44.literal(false),
    errorMessage: nonEmptyString4.optional()
  }).strict()
]);
var zcodeOfficialMcpAuthHeadersRequestParamsSchema = z44.object({
  requestId: nonEmptyString4,
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4,
  mcpKey: nonEmptyString4,
  targetOrigin: nonEmptyString4
}).strict();
var zcodeOfficialMcpAuthFailureReasonSchema = z44.enum(
  OFFICIAL_MCP_AUTH_PORT_FAILURE_REASONS
);
var zcodeOfficialMcpAuthHeadersResponseSchema = z44.discriminatedUnion("ok", [
  z44.object({
    ok: z44.literal(true),
    headers: z44.record(z44.string(), z44.string())
  }).strict(),
  z44.object({
    ok: z44.literal(false),
    reason: zcodeOfficialMcpAuthFailureReasonSchema
  }).strict()
]);
var zcodePluginOptionValueSchema = z44.union([z44.string(), z44.number(), z44.boolean()]);
var zcodePluginScopeSchema = z44.enum(["user", "workspace"]);
var zcodePluginHookDetailSchema = z44.object({
  event: nonEmptyString4,
  matcher: z44.string().optional(),
  type: z44.enum(["command", "process"]),
  command: nonEmptyString4,
  args: z44.array(z44.string()).optional(),
  async: z44.boolean().optional(),
  shell: z44.union([z44.literal(true), z44.string()]).optional(),
  timeout: z44.number().positive().optional(),
  timeoutMs: z44.number().int().positive().optional(),
  statusMessage: z44.string().optional(),
  sourcePath: z44.string(),
  runnable: z44.boolean()
}).strict();
var zcodePluginUserConfigOptionSchema = z44.object({
  default: zcodePluginOptionValueSchema.optional(),
  description: z44.string().optional(),
  required: z44.boolean().optional(),
  sensitive: z44.boolean().optional(),
  title: z44.string().optional(),
  type: z44.enum(["string", "number", "boolean", "directory", "file"]).optional()
}).strict();
var zcodePluginComponentKindSchema = z44.enum(["agent", "command", "skill", "hook", "mcp"]);
var zcodePluginComponentItemSchema = z44.object({
  name: nonEmptyString4,
  // 描述来自组件 frontmatter（SKILL.md / command / agent）或 manifest；缺失时省略，不伪造。
  description: z44.string().optional()
}).strict();
var zcodePluginComponentGroupSchema = z44.object({
  kind: zcodePluginComponentKindSchema,
  items: z44.array(zcodePluginComponentItemSchema)
}).strict();
var zcodePluginInfoSchema = z44.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  description: z44.string().optional(),
  version: z44.string().optional(),
  enabled: z44.boolean(),
  source: nonEmptyString4,
  marketplace: nonEmptyString4,
  // manifest（plugin.json）的作者/主页回退字段；商店 listing 缺失时详情页信息区用它兜底。
  author: z44.string().optional(),
  authorUrl: z44.string().optional(),
  homepage: z44.string().optional(),
  skillCount: z44.number().int().nonnegative().optional(),
  skillRootCount: z44.number().int().nonnegative(),
  commandRootCount: z44.number().int().nonnegative(),
  // 权威组件清单（名称 + 可选描述），由 CLI 对插件根目录枚举得出，与启用态无关。
  // 详情 UI 直接展示，取代旧的「数量取协议、名称靠 UI 侧 join」脆弱方案。optional 兼容旧 payload。
  components: z44.array(zcodePluginComponentGroupSchema).optional(),
  declaredMcpServerNames: z44.array(z44.string()).optional(),
  hostMcpServerNames: z44.array(z44.string()).optional(),
  mcpServerNames: z44.array(z44.string()),
  hookDetails: z44.array(zcodePluginHookDetailSchema).optional(),
  rootPath: z44.string(),
  userConfig: z44.record(z44.string(), zcodePluginUserConfigOptionSchema).optional(),
  configuredOptions: z44.record(z44.string(), zcodePluginOptionValueSchema).optional(),
  // 缺省表示 package 可用；missing 用于保留已声明但目标 Host 尚未物化的配置行。
  packageStatus: z44.literal("missing").optional(),
  rootSource: zcodePluginScopeSchema.optional(),
  enabledSource: zcodePluginScopeSchema.optional(),
  optionSources: z44.record(z44.string(), zcodePluginScopeSchema).optional()
}).strict();
var zcodePluginDiagnosticSchema = z44.object({
  code: z44.string(),
  message: z44.string(),
  severity: z44.enum(["warning", "error"]).optional(),
  pluginId: z44.string().optional()
}).strict();
var zcodePluginsListParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  configScope: zcodePluginScopeSchema.optional()
}).strict();
var zcodePluginsListResultSchema = z44.object({
  plugins: z44.array(zcodePluginInfoSchema),
  diagnostics: z44.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginReferenceCatalogEntrySchema = z44.object({
  // 仅 referenceCatalogWithCategory 返回；旧入口保持原结构。
  category: nonEmptyString4.optional(),
  pluginId: nonEmptyString4,
  name: nonEmptyString4,
  marketplace: nonEmptyString4,
  icon: z44.string().optional(),
  // 商店 listing 的 display-only 本地化显示名投影（沿 icon 先例）：让 Picker 能按
  // 中文显示名搜索/展示；locale 解析复用 shared 的 plugin-display-name helper。
  displayName: z44.string().optional(),
  displayNameI18n: z44.record(z44.string(), z44.string()).optional(),
  // 仅供 Picker 展示，不进入能力身份或 model-only reminder。
  description: z44.string().optional(),
  descriptionI18n: z44.record(z44.string(), z44.string()).optional(),
  enabled: z44.boolean(),
  // 非空 = 与其他 enabled Plugin 共享 manifest name 的 V1 fail closed 冲突：
  // Picker 禁选并展示原因，runtime 解析按 ambiguous 跳过。
  conflictingPluginIds: z44.array(nonEmptyString4),
  skillQualifiedNames: z44.array(nonEmptyString4),
  mcpServerNames: z44.array(nonEmptyString4),
  // 旧 Host 不投影该字段时按空数组兼容；只有新 Agent 会把它用于 reminder live 交集。
  subagentNames: z44.array(nonEmptyString4).default([])
}).strict();
var zcodePluginsReferenceCatalogParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  // 已有 Session 的 Picker 必须带 sessionId 才能拿到 session-owned catalog；
  // session 不存在时按协议错误 fail closed，禁止静默回退 workspace authority。
  sessionId: nonEmptyString4.optional()
}).strict();
var zcodePluginsReferenceCatalogResultSchema = z44.object({
  authority: z44.enum(["session", "workspace"]),
  plugins: z44.array(zcodePluginReferenceCatalogEntrySchema)
}).strict();
var zcodeSkillReferenceCatalogEntrySchema = z44.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  description: z44.string(),
  path: nonEmptyString4,
  scope: z44.enum(["workspace", "user", "plugin"]),
  enabled: z44.literal(true),
  pluginName: nonEmptyString4.optional()
}).strict();
var zcodeSkillsReferenceCatalogParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  // 带 sessionId 时必须命中该进程内的 resident Session；未知 Session fail closed，
  // 禁止回退到 workspace 当前目录而把新 Skill 泄漏进旧对话。
  sessionId: nonEmptyString4.optional()
}).strict();
var zcodeSkillsReferenceCatalogResultSchema = z44.object({
  authority: z44.enum(["session", "workspace"]),
  skills: z44.array(zcodeSkillReferenceCatalogEntrySchema)
}).strict();
var zcodeSavedWorkflowArgTypeSchema = z44.enum(["string", "number", "boolean", "json"]);
var zcodeSavedWorkflowArgDeclarationSchema = z44.object({
  type: zcodeSavedWorkflowArgTypeSchema,
  description: z44.string().optional(),
  required: z44.boolean().optional(),
  default: z44.unknown().optional()
}).strict();
var zcodeSavedWorkflowArgsDeclarationSchema = z44.record(
  z44.string(),
  zcodeSavedWorkflowArgDeclarationSchema
);
var zcodeSavedWorkflowMetaSchema = z44.object({
  description: nonEmptyString4,
  whenToUse: nonEmptyString4.optional(),
  args: zcodeSavedWorkflowArgsDeclarationSchema.optional()
}).strict();
var zcodeSavedWorkflowScopeSchema = z44.enum(["project", "global"]);
var zcodeSavedWorkflowEntrySchema = z44.object({
  name: nonEmptyString4,
  description: z44.string(),
  whenToUse: z44.string().optional(),
  args: zcodeSavedWorkflowArgsDeclarationSchema.optional(),
  scope: zcodeSavedWorkflowScopeSchema,
  path: nonEmptyString4
}).strict();
var zcodeSavedWorkflowInvalidEntrySchema = z44.object({ path: nonEmptyString4, reason: nonEmptyString4 }).strict();
var zcodeSavedWorkflowFailureReasonSchema = z44.enum([
  "invalid_name",
  "not_found",
  "parse_error",
  "read_error"
]);
var zcodeSavedWorkflowFailureSchema = z44.object({
  ok: z44.literal(false),
  reason: zcodeSavedWorkflowFailureReasonSchema,
  detail: z44.string().optional()
}).strict();
var zcodeWorkflowsListParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  // 缺省即 `project`（本项目档）。给 `global` 时改扫本机 `~/.zcode/workflows/`；此时 `workspace`
  // 仍必填，但只是**载体运行时**——协议处理器对全局档不读它的路径。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeWorkflowsListResultSchema = z44.object({
  workflows: z44.array(zcodeSavedWorkflowEntrySchema),
  invalid: z44.array(zcodeSavedWorkflowInvalidEntrySchema),
  // 扫过的目录（本地绝对路径），即使目录还不存在也回：GUI 的文件监听靠它 watch。
  dir: nonEmptyString4
}).strict();
var zcodeWorkflowsGetParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString4,
  // 缺省 `project`；`global` 时只查本机全局根。`workspace` 语义同 list（全局档只当载体）。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeWorkflowsGetResultSchema = z44.union([
  z44.object({
    ok: z44.literal(true),
    name: nonEmptyString4,
    path: nonEmptyString4,
    scope: zcodeSavedWorkflowScopeSchema,
    meta: zcodeSavedWorkflowMetaSchema,
    /** 脚本本体（frontmatter 之后逐字节），即被类型检查与执行的那一份。 */
    script: z44.string()
  }).strict(),
  zcodeSavedWorkflowFailureSchema
]);
var zcodeWorkflowsUpdateMetaParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString4,
  meta: zcodeSavedWorkflowMetaSchema,
  // 缺省 `project`；`global` 时只写本机全局根那一份。`workspace` 语义同 list。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeWorkflowsUpdateMetaResultSchema = z44.union([
  z44.object({ ok: z44.literal(true), path: nonEmptyString4 }).strict(),
  zcodeSavedWorkflowFailureSchema
]);
var zcodeWorkflowsDeleteParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString4,
  // 缺省 `project`；`global` 时按 scope 选根删除（不再写死 roots[0]）。`workspace` 语义同 list。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeWorkflowsDeleteResultSchema = z44.union([
  z44.object({ ok: z44.literal(true), path: nonEmptyString4 }).strict(),
  zcodeSavedWorkflowFailureSchema
]);
var ZCODE_WORKFLOWS_RUNS_MAX_LIMIT = 50;
var zcodeWorkflowsRunsParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  /** 只要这个名字的 run（`dwf_run.name` 字面等值）；缺省即本项目全部 run。 */
  name: nonEmptyString4.optional(),
  limit: z44.number().int().min(1).max(ZCODE_WORKFLOWS_RUNS_MAX_LIMIT),
  // 缺省 `project`：只查 `dwf_run.cwd === workspacePath` 的 run。`global` 时**不**按 cwd 过滤，
  // 跨所有项目取该名字的运行历史（全局工作流在任何项目里跑，历史因此跨 cwd）；结果行带 `cwd`
  // 供 GUI 标项目。`workspace` 语义同 list（全局档只当载体）。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeSavedWorkflowRunStatusSchema = z44.enum([
  "pending",
  "running",
  "completed",
  "errored",
  "stopped"
]);
var zcodeSavedWorkflowRunStopReasonSchema = z44.enum([
  "user",
  "model",
  "provider",
  "interrupted",
  "superseded"
]);
var zcodeSavedWorkflowRunSchema = z44.object({
  runId: nonEmptyString4,
  name: z44.string().optional(),
  status: zcodeSavedWorkflowRunStatusSchema,
  // `status === "stopped"` 才在场。
  stopReason: zcodeSavedWorkflowRunStopReasonSchema.optional(),
  createdAt: z44.number(),
  updatedAt: z44.number(),
  spentTokens: z44.number(),
  /** 发起它的会话与 CreateWorkflow 工具调用：有这两个才能从中枢打开实例详情。老行可缺。 */
  parentSessionId: z44.string().optional(),
  toolCallId: z44.string().optional(),
  args: z44.record(z44.string(), z44.unknown()).optional(),
  // 实际运行的项目目录（`dwf_run.cwd`）。全局档的 `workflows/runs` 跨 cwd 查询，GUI 用它给
  // 每行标项目；项目档变体里它恒等于 workspacePath，GUI 可忽略。老行可缺。
  cwd: z44.string().optional(),
  // 这次运行发布的**用户面产物**：中枢的运行历史行在
  // 状态词之后画一串 kind chips，详情页头部的「最近产物」条取最近一次 completed run 的这一份。
  // ⚠ 术语：这里的 artifact 是脚本经 `artifact.*` 发布给用户看的产出，不是脚本的顶层返回值。
  // 只带 chip 画得下的字段（≤ 8 件，取最新版的元数据）；字节与条目经 v4 查询按需读。
  // optional，照上面 `cwd` 的先例：老 CLI 不发，少一个键是退化不是错误。
  artifacts: z44.array(
    z44.object({
      id: nonEmptyString4,
      kind: z44.enum(["file", "markdown", "chart", "table", "metrics", "board"]),
      title: z44.string().optional(),
      version: z44.number(),
      contentType: z44.string().optional()
    }).strict()
  ).max(8).optional()
}).strict();
var zcodeWorkflowsRunsResultSchema = z44.object({
  runs: z44.array(zcodeSavedWorkflowRunSchema),
  /** 为真时才在场：还有更多 run 没进这一页（多取一条判定，不是 length === limit）。 */
  truncated: z44.literal(true).optional()
}).strict();
var zcodeWorkflowsMoveParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString4
}).strict();
var zcodeWorkflowsMoveResultSchema = z44.union([
  z44.object({
    ok: z44.literal(true),
    /** 源落点路径（全局根，搬走前）。 */
    from: nonEmptyString4,
    /** 目标落点路径（项目根，搬到处）。 */
    to: nonEmptyString4
  }).strict(),
  z44.object({
    ok: z44.literal(false),
    // target_exists：目标档已有同名（move 不覆盖）；not_found：源档没有这个名字；
    // read_error / write_error：搬运时的 I/O 失败；invalid_name：名字先验没过。
    reason: z44.enum(["invalid_name", "not_found", "target_exists", "read_error", "write_error"]),
    path: z44.string().optional(),
    detail: z44.string().optional()
  }).strict()
]);
var zcodePluginSuggestedReferenceStatusSchema = z44.enum([
  "ready",
  "disabled",
  "missing",
  "conflict",
  "unavailable"
]);
var zcodePluginOperationStateSchema = z44.enum([
  "checking",
  "refreshing",
  "installing",
  "enabling",
  "cancelling",
  "cancelled",
  "complete",
  "failed"
]);
var zcodePluginOperationProgressNotificationSchema = z44.object({
  operationId: nonEmptyString4,
  state: z44.literal("refreshing")
}).strict();
var zcodePluginsResolveSuggestedReferenceParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  stableId: nonEmptyString4,
  operationId: nonEmptyString4,
  clientMode: zcodeDeliveryKindSchema,
  deliveryKind: zcodeDeliveryKindSchema
}).strict();
var zcodePluginsSetEnabledParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4,
  enabled: z44.boolean(),
  operationId: nonEmptyString4.optional(),
  scope: zcodePluginScopeSchema.optional()
}).strict();
var zcodePluginsSetEnabledResultSchema = z44.object({
  plugin: zcodePluginInfoSchema,
  enabled: z44.boolean()
}).strict();
var zcodePluginStoreListingSchema = z44.object({
  displayName: z44.string().optional(),
  displayNameI18n: z44.record(z44.string(), z44.string()).optional(),
  descriptionI18n: z44.record(z44.string(), z44.string()).optional(),
  icon: z44.string().optional(),
  category: z44.string().optional(),
  author: z44.string().optional(),
  authorUrl: z44.string().optional(),
  homepage: z44.string().optional(),
  privacyPolicy: z44.string().optional(),
  termsOfService: z44.string().optional(),
  heroImage: z44.string().optional(),
  examplePrompts: z44.array(z44.string()).optional(),
  examplePromptsI18n: z44.record(z44.string(), z44.array(z44.string())).optional(),
  /**
   * 需要付费套餐才好用的插件：市场目录条目声明 `requiresPaidPlan: true`，
   * UI 在标题右侧展示提示图标。描述的是「使用条件」而非「插件是收费商品」——
   * 不参与安装门禁与计费，命名也不绑定具体套餐商品名。
   */
  requiresPaidPlan: z44.boolean().optional()
}).strict();
var zcodePluginsResolveSuggestedReferenceResultSchema = z44.object({
  stableId: nonEmptyString4,
  status: zcodePluginSuggestedReferenceStatusSchema,
  marketplace: nonEmptyString4.optional(),
  pluginName: nonEmptyString4.optional(),
  sourceTrust: z44.literal("official").optional(),
  // 官方 Marketplace listing 的可选展示投影；不参与身份、安装或权限判断。
  icon: z44.string().optional(),
  listing: zcodePluginStoreListingSchema.optional(),
  diagnostics: z44.array(zcodePluginDiagnosticSchema)
}).strict().superRefine((value, context) => {
  if (value.status !== "ready" && value.status !== "disabled" && value.status !== "missing") {
    return;
  }
  if (!value.marketplace || !value.pluginName || value.sourceTrust !== "official") {
    context.addIssue({
      code: "custom",
      message: "actionable suggested Plugin results require trusted install identity"
    });
  }
});
var zcodePluginMarketplaceSummarySchema = z44.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  source: jsonObjectSchema2,
  description: z44.string().optional(),
  lastUpdated: z44.string().optional(),
  pluginCount: z44.number().int().nonnegative(),
  isOfficial: z44.boolean().optional(),
  // 目录顶层 featured 策展名单（商店「公开」分段 Featured 区）。
  featured: z44.array(z44.string()).optional(),
  refreshFailure: z44.object({
    code: z44.string(),
    failedAt: z44.string(),
    message: z44.string()
  }).strict().optional()
}).strict();
var zcodeAvailablePluginSummarySchema = z44.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  marketplace: nonEmptyString4,
  description: z44.string().optional(),
  version: z44.string().optional(),
  installed: z44.boolean(),
  componentTypes: z44.array(z44.string()).optional(),
  listing: zcodePluginStoreListingSchema.optional()
}).strict();
var zcodeInstalledPluginSummarySchema = z44.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  marketplace: nonEmptyString4,
  description: z44.string().optional(),
  version: z44.string().optional(),
  enabled: z44.boolean(),
  scope: zcodePluginScopeSchema,
  installPath: z44.string().optional(),
  installedAt: z44.string().optional(),
  componentTypes: z44.array(z44.string()).optional(),
  hookDetails: z44.array(zcodePluginHookDetailSchema).optional(),
  updateStatus: z44.enum(["none", "update-available", "version-changed"]).optional(),
  latestVersion: z44.string().optional(),
  listing: zcodePluginStoreListingSchema.optional()
}).strict();
var zcodePluginsOverviewParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  configScope: zcodePluginScopeSchema.optional()
}).strict();
var zcodePluginsOverviewResultSchema = z44.object({
  marketplaces: z44.array(zcodePluginMarketplaceSummarySchema),
  availablePlugins: z44.array(zcodeAvailablePluginSummarySchema),
  installedPlugins: z44.array(zcodeInstalledPluginSummarySchema),
  restorableBuiltins: z44.array(zcodeAvailablePluginSummarySchema),
  diagnostics: z44.array(zcodePluginDiagnosticSchema),
  capability: z44.object({
    supported: z44.boolean(),
    reason: z44.string().optional()
  }).strict()
}).strict();
var zcodePluginsMarketplaceAddParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  source: nonEmptyString4,
  dryRun: z44.boolean().optional(),
  operationId: nonEmptyString4.optional()
}).strict();
var zcodePluginsMarketplaceRemoveParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  marketplace: nonEmptyString4
}).strict();
var zcodePluginsMarketplaceUpdateParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  marketplace: nonEmptyString4.optional(),
  operationId: nonEmptyString4.optional()
}).strict();
var zcodePluginsMarketplaceMutationResultSchema = z44.object({
  marketplace: zcodePluginMarketplaceSummarySchema.optional(),
  marketplaces: z44.array(zcodePluginMarketplaceSummarySchema).optional(),
  diagnostics: z44.array(zcodePluginDiagnosticSchema).optional()
}).strict();
var zcodePluginsInstallParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginName: nonEmptyString4,
  marketplace: nonEmptyString4,
  scope: zcodePluginScopeSchema.optional(),
  dryRun: z44.boolean().optional(),
  operationId: nonEmptyString4.optional()
}).strict();
var zcodePluginsCancelOperationParamsSchema = z44.object({
  operationId: nonEmptyString4
}).strict();
var zcodePluginsCancelOperationResultSchema = z44.object({
  operationId: nonEmptyString4,
  cancelled: z44.boolean()
}).strict();
var zcodePluginsUninstallParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4.optional(),
  pluginName: nonEmptyString4.optional(),
  marketplace: nonEmptyString4.optional(),
  removeCache: z44.boolean().optional()
}).strict();
var zcodePluginsInstallResultSchema = z44.object({
  installedPlugins: z44.array(zcodeInstalledPluginSummarySchema),
  dependencyClosure: z44.array(z44.string()),
  diagnostics: z44.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginsUninstallResultSchema = z44.object({
  removedPlugin: zcodeInstalledPluginSummarySchema.optional(),
  diagnostics: z44.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginsUpdateParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4.optional(),
  marketplace: nonEmptyString4.optional()
}).strict();
var zcodePluginsRestoreBuiltinParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4
}).strict();
var zcodePluginsRestoreBuiltinResultSchema = z44.object({
  pluginId: nonEmptyString4,
  diagnostics: z44.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginsConfigureParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4,
  options: jsonObjectSchema2,
  clearOptionKeys: z44.array(nonEmptyString4).optional(),
  scope: zcodePluginScopeSchema.optional(),
  dryRun: z44.boolean().optional()
}).strict();
var zcodePluginsConfigureResultSchema = z44.object({
  pluginId: nonEmptyString4,
  diagnostics: z44.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginsResetConfigParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4,
  scope: zcodePluginScopeSchema.optional()
}).strict();
var zcodePluginsValidateParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginName: nonEmptyString4.optional(),
  marketplace: nonEmptyString4.optional(),
  source: nonEmptyString4.optional()
}).strict();
var zcodePluginsValidateResultSchema = z44.object({
  ok: z44.boolean(),
  diagnostics: z44.array(zcodePluginDiagnosticSchema),
  compatibility: z44.object({
    runnable: z44.array(z44.string()),
    diagnosticOnly: z44.array(z44.string()),
    unsupported: z44.array(z44.string())
  }).strict()
}).strict();
var zcodePluginsDescribeParamsSchema = z44.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginName: nonEmptyString4,
  marketplace: nonEmptyString4
}).strict();
var zcodePluginsDescribeResultSchema = z44.object({
  components: z44.array(zcodePluginComponentGroupSchema),
  diagnostics: z44.array(zcodePluginDiagnosticSchema).optional(),
  // 插件包内 plugin.json 的展示性回退字段；未安装候选详情页信息区在商店 listing 缺失时兜底。
  metadata: z44.object({
    author: z44.string().optional(),
    authorUrl: z44.string().optional(),
    homepage: z44.string().optional(),
    version: z44.string().optional()
  }).strict().optional()
}).strict();
var zcodeAutomationScheduleRuleSchema = z44.object({
  unit: z44.enum(["minute", "hourly", "daily", "weekly", "monthly", "yearly"]),
  interval: z44.number().int().positive(),
  hour: z44.number().int().min(0).max(23),
  minute: z44.number().int().min(0).max(59),
  anchorAt: z44.number().int(),
  weekdays: z44.array(z44.number().int().min(0).max(6)).optional(),
  monthDays: z44.array(z44.number().int().min(1).max(31)).optional(),
  /** yearly 用：1-12 人类月份。缺省回退 anchorAt 的月份（兼容未写该字段的旧记录）。 */
  months: z44.array(z44.number().int().min(1).max(12)).optional(),
  monthlyMode: z44.enum(["date", "weekday"]).optional()
}).strict();
var zcodeAutomationIntervalUnitSchema = z44.enum([
  "minute",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly"
]);
var zcodeAutomationProtocolSchema = z44.object({
  automationId: nonEmptyString4,
  title: z44.string(),
  cronExpr: nonEmptyString4,
  prompt: nonEmptyString4,
  modelSelection: modelSelectionSchema.optional(),
  mode: zcodeTaskModeSchema.optional(),
  targetTaskId: nonEmptyString4.optional(),
  enabled: z44.boolean(),
  lifecycleStatus: z44.enum(["active", "completed", "failed", "paused"]),
  nextRunAt: timestampMsSchema2.optional(),
  lastRunAt: timestampMsSchema2.optional(),
  runCount: z44.number().int().nonnegative(),
  recurring: z44.boolean(),
  maxRuns: z44.number().int().positive().optional(),
  // 自定义重复规则；缺省时调度回退到解析 cronExpr。会话卡片必须读到本字段才能展示
  // cron 无法表达的真实间隔（如每50小时、每40天，兼容 cronExpr 只是 0 * * * *）。
  scheduleRule: zcodeAutomationScheduleRuleSchema.optional()
}).strict();
var zcodeAutomationCreateParamsSchema = z44.object({
  title: z44.string().optional(),
  cronExpr: nonEmptyString4,
  relativeDelayMinutes: z44.number().int().positive().max(525600).optional(),
  prompt: nonEmptyString4,
  modelSelection: modelSelectionSchema.optional(),
  mode: zcodeTaskModeSchema.optional(),
  targetTaskId: nonEmptyString4.optional(),
  botDeliveryTarget: zcodeAutomationBotDeliveryTargetSchema.optional(),
  recurring: z44.boolean().optional(),
  maxRuns: z44.number().int().positive().optional(),
  // 会话侧自定义重复 carrier：每 N 分钟/小时/天/周/月/年均通过此字段归一化为权威 scheduleRule，
  // cronExpr 仅作合法兼容展示。
  intervalUnit: zcodeAutomationIntervalUnitSchema.optional(),
  interval: z44.number().int().min(1).max(200).optional()
}).strict().refine((input) => input.intervalUnit === void 0 === (input.interval === void 0), {
  message: "intervalUnit and interval must be set together",
  path: ["interval"]
}).refine((input) => input.intervalUnit === void 0 || input.relativeDelayMinutes === void 0, {
  message: "intervalUnit cannot combine with a relative delayMinutes",
  path: ["intervalUnit"]
}).refine((input) => input.intervalUnit === void 0 || input.recurring !== false, {
  message: "intervalUnit is a recurring carrier and cannot combine with recurring=false",
  path: ["recurring"]
}).refine((input) => input.intervalUnit === void 0 || input.maxRuns === void 0, {
  message: "intervalUnit is a recurring carrier and cannot combine with maxRuns",
  path: ["maxRuns"]
});
var zcodeAutomationCreateResultSchema = z44.object({ automation: zcodeAutomationProtocolSchema }).strict();
var zcodeAutomationUpdateParamsSchema = z44.object({
  automationId: nonEmptyString4,
  title: nonEmptyString4.optional(),
  cronExpr: nonEmptyString4.optional(),
  prompt: nonEmptyString4.optional(),
  recurring: z44.boolean().optional(),
  maxRuns: z44.number().int().positive().nullable().optional(),
  // 会话侧自定义重复 carrier（同 create 侧语义）。
  intervalUnit: zcodeAutomationIntervalUnitSchema.optional(),
  interval: z44.number().int().min(1).max(200).optional()
}).strict().refine(
  (input) => input.title !== void 0 || input.cronExpr !== void 0 || input.prompt !== void 0 || input.recurring !== void 0 || input.maxRuns !== void 0 || input.intervalUnit !== void 0,
  { message: "automation update requires at least one field" }
).refine((input) => input.maxRuns !== null || input.recurring === true, {
  message: "clearing maxRuns requires recurring=true",
  path: ["maxRuns"]
}).refine((input) => input.recurring !== true || typeof input.maxRuns !== "number", {
  message: "recurring=true cannot be combined with a numeric maxRuns",
  path: ["maxRuns"]
}).refine((input) => input.intervalUnit === void 0 === (input.interval === void 0), {
  message: "intervalUnit and interval must be set together",
  path: ["interval"]
}).refine((input) => input.intervalUnit === void 0 || input.recurring !== false, {
  message: "intervalUnit is a recurring carrier and cannot combine with recurring=false",
  path: ["recurring"]
}).refine(
  (input) => input.intervalUnit === void 0 || input.maxRuns === void 0 || input.maxRuns === null && input.recurring === true,
  {
    message: "intervalUnit is a recurring carrier and only allows maxRuns=null with recurring=true",
    path: ["maxRuns"]
  }
);
var zcodeAutomationUpdateResultSchema = z44.object({ automation: zcodeAutomationProtocolSchema }).strict();
var zcodeAutomationListParamsSchema = z44.object({}).strict();
var zcodeAutomationListResultSchema = z44.object({ automations: z44.array(zcodeAutomationProtocolSchema) }).strict();
var zcodeAutomationCheckTaskBindingParamsSchema = z44.object({ targetTaskId: nonEmptyString4 }).strict();
var zcodeAutomationCheckTaskBindingResultSchema = z44.object({ bound: z44.boolean() }).strict();
var zcodeAutomationDeleteParamsSchema = z44.object({ automationId: nonEmptyString4 }).strict();
var zcodeAutomationDeleteResultSchema = z44.object({ deleted: z44.boolean() }).strict();
var zcodeOffPeakPermissionModeSchema = z44.enum(["build", "edit", "plan", "yolo"]);
var zcodeOffPeakCreateParamsSchema = z44.object({
  title: nonEmptyString4,
  prompt: nonEmptyString4,
  permissionMode: zcodeOffPeakPermissionModeSchema.optional(),
  model: nonEmptyString4.optional(),
  thoughtLevel: nonEmptyString4.optional(),
  // 会话内创建绑定当前会话（对齐 automation/create 的 targetTaskId），由 CLI 端口填入。
  boundSessionId: nonEmptyString4.optional()
}).strict();
var zcodeOffPeakTaskSnapshotSchema = z44.object({
  offPeakTaskId: nonEmptyString4,
  title: z44.string(),
  status: z44.enum(["queued", "paused", "running", "completed", "failed", "cancelled"]),
  queuePosition: z44.number().int().positive().optional(),
  sessionId: nonEmptyString4.optional(),
  createdAt: z44.number().int().nonnegative()
}).strict();
var zcodeOffPeakCreateResultSchema = z44.discriminatedUnion("ok", [
  z44.object({ ok: z44.literal(true), task: zcodeOffPeakTaskSnapshotSchema }).strict(),
  z44.object({
    ok: z44.literal(false),
    failureStage: z44.enum(["client_validation", "ticket_request", "local_persist"]),
    errorCategory: z44.enum([
      "client_validation",
      "eligibility_3101",
      "quota_3103",
      "network",
      "invalid_response",
      "local_persist",
      "unknown"
    ]),
    errorCode: z44.string()
  }).strict()
]);
var zcodeOffPeakListParamsSchema = z44.object({}).strict();
var zcodeOffPeakListResultSchema = z44.object({ tasks: z44.array(zcodeOffPeakTaskSnapshotSchema) }).strict();
var zcodeProtocolMethods = {
  runtimeCapabilities: "runtime/capabilities",
  computerUseOperationEvent: "computer-use/operation-event",
  sessionCreate: "session/create",
  sessionResume: "session/resume",
  sessionList: "session/list",
  sessionSubagents: "session/subagents",
  sessionRequestRuntimePreferences: "session/requestRuntimePreferences",
  sessionRead: "session/read",
  sessionMessages: "session/messages",
  sessionEvents: "session/events",
  sessionDebug: "session/debug",
  sessionSubscribe: "session/subscribe",
  // @deprecated（部分）：send 主路径已收敛 v4 sendText；仅剩 adapter 附件
  // 回退分支消费（v4 attachmentRef 上传/寄存命令面未建模），待附件命令面落地后移除。
  sessionSend: "session/send",
  // @deprecated：host 客户端方法已删（stop 已收敛 v4 stop 命令）。
  // wire case 留兼容（transport bypass 名单仍引用），随旧词整体删除时一并移除。
  sessionStop: "session/stop",
  // @deprecated：host 客户端方法已删（已收敛 v4 cancelBackgroundWork 命令）。
  // wire case 留兼容，随旧词整体删除时一并移除。
  sessionCancelBackgroundTask: "session/cancelBackgroundTask",
  // @deprecated：host 客户端方法已删（v4 forkAssistant 原生 handler 经
  // forkSessionAtMessage 钩子直调 server-operations.forkSession op）。wire case 与
  // fork params/result schema 保留＝op 存活面；fork record 归 v4 原生重写。
  sessionFork: "session/fork",
  sessionCompact: "session/compact",
  sessionGoal: "session/goal",
  sessionClose: "session/close",
  // setModel 仍被 zcodeSessionService 的 desktop 旧链路消费；replayable
  // switchModelConfig 已直接由目标 Environment Registry 解析 Selection。
  sessionSetModel: "session/setModel",
  // replayable facade 的思考深度/模式已收敛 v4 switchModelConfig/
  // switchCollaborationMode；剩余消费 = zcodeSessionService（desktop 旧链路，随
  // 桌面 v4 UI 收口清零）与 setMode 的 auto 值残留（v4 值域刻意排除 auto）。
  sessionSetThoughtLevel: "session/setThoughtLevel",
  sessionSetMode: "session/setMode",
  workspaceReadPresentation: "workspace/readPresentation",
  workspaceHookTrustGrant: "workspace/hooks/trustGrant",
  // 进程级 Account Provider Config 与 workspace 运行目录分离。
  providerUpdateAccountConfig: "provider/updateAccountConfig",
  workspaceUpdateInteractionPreferences: "workspace/updateInteractionPreferences",
  workspaceUpdateModelIoPreferences: "workspace/updateModelIoPreferences",
  // Off-Peak 工具面门禁是 workspace 级事实（灰度 + 本地/远程），由 host 在 agent 就绪时同步；
  // CLI 对 legacy create/resume 与 v4 冷恢复统一读取。旧 CLI method-not-found → host 降级忽略。
  workspaceUpdateOffPeakToolPolicy: "workspace/updateOffPeakToolPolicy",
  // 动态工作流灰度门禁：同 Off-Peak 的同步模式。
  workspaceUpdateDynamicWorkflowPolicy: "workspace/updateDynamicWorkflowPolicy",
  // LLM 执行面在 CLI，直连不可行；消费仅 services 内部
  // （commit message），待 v4 workspace 查询/命令面覆盖后移除。
  workspaceGenerateText: "workspace/generateText",
  workspaceCancelGenerateText: "workspace/cancelGenerateText",
  providerTestModelConnectivity: "provider/testModelConnectivity",
  mcpList: "mcp/list",
  pluginsList: "plugins/list",
  pluginsReferenceCatalog: "plugins/referenceCatalog",
  pluginsReferenceCatalogWithCategory: "plugins/referenceCatalogWithCategory",
  skillsReferenceCatalog: "skills/referenceCatalog",
  // 已保存工作流的 GUI 中枢：workspace 级、无会话。
  workflowsList: "workflows/list",
  workflowsGet: "workflows/get",
  workflowsUpdateMeta: "workflows/updateMeta",
  workflowsDelete: "workflows/delete",
  workflowsRuns: "workflows/runs",
  // 在项目档 / 全局档之间移动同名文件。
  workflowsMove: "workflows/move",
  pluginsResolveSuggestedReference: "plugins/resolveSuggestedReference",
  pluginsSetEnabled: "plugins/setEnabled",
  pluginsOverview: "plugins/overview",
  pluginsMarketplaceAdd: "plugins/marketplace/add",
  pluginsMarketplaceRemove: "plugins/marketplace/remove",
  pluginsMarketplaceUpdate: "plugins/marketplace/update",
  pluginsInstall: "plugins/install",
  pluginsCancelOperation: "plugins/cancelOperation",
  pluginsUninstall: "plugins/uninstall",
  pluginsUpdate: "plugins/update",
  pluginsRestoreBuiltin: "plugins/restoreBuiltin",
  pluginsConfigure: "plugins/configure",
  pluginsResetConfig: "plugins/resetConfig",
  pluginsValidate: "plugins/validate",
  pluginsDescribe: "plugins/describe",
  automationCreate: "automation/create",
  automationUpdate: "automation/update",
  automationCheckTaskBinding: "automation/checkTaskBinding",
  automationList: "automation/list",
  automationDelete: "automation/delete",
  // Off-Peak 会话内创建：与 automation 兄弟并列的独立方法族。
  offPeakCreate: "offPeak/create",
  offPeakList: "offPeak/list",
  // @deprecated：host 消费已清零（zcodeAgentService 改走 v4/usage/stats）。
  // 仅剩 CLI server 的 wire 兼容 case；随旧词整体删除时一并移除。
  usageStats: "usage/stats",
  // ZCode Protocol 对 agent 只暴露 session-first 方法；task 是 UI 投影概念，不能泄露进协议方法名。
  // @deprecated：host 已改走 v4/conversation/usage；后续与 usage/stats 一并移除。
  sessionUsage: "session/usage",
  // 资源管理器：CLI 回报其 MCP 子进程 pid 与插件归属（纯内存，无 I/O），采样在 Host 侧完成。
  processChildProcesses: "process/childProcesses",
  interactionRequestPermission: "interaction/requestPermission",
  interactionRequestUserInput: "interaction/requestUserInput",
  interactionRequestProviderRuntimeHeaders: "interaction/requestProviderRuntimeHeaders",
  interactionRequestOfficialMcpAuthHeaders: "interaction/requestOfficialMcpAuthHeaders",
  // browser-use 反向请求由 agent 发起，host 转给 main 中的 CDP executor。
  interactionBrowserList: "interaction/browserList",
  interactionBrowserExecute: "interaction/browserExecute"
};
var zcodeProtocolEmptyResultSchema = z44.object({}).strict();
var zcodeProtocolSessionMethodContracts = {
  [zcodeProtocolMethods.workspaceHookTrustGrant]: {
    params: zcodeWorkspaceHookTrustGrantParamsSchema,
    result: zcodeWorkspaceHookTrustGrantResultSchema
  },
  [zcodeProtocolMethods.mcpList]: {
    params: zcodeMcpListParamsSchema,
    result: zcodeMcpListResultSchema
  },
  [zcodeProtocolMethods.interactionBrowserList]: {
    params: zcodeBrowserListParamsSchema,
    result: zcodeBrowserListResultSchema
  },
  [zcodeProtocolMethods.interactionBrowserExecute]: {
    params: zcodeBrowserExecuteParamsSchema,
    result: zcodeBrowserExecuteResultSchema
  }
};
var zcodeStoragePreparationFrameSchema = z44.discriminatedUnion("method", [
  z44.object({
    method: z44.literal("startup/storagePath"),
    params: z44.object({ path: z44.string().min(1).max(32768) }).strict()
  }).strict(),
  z44.object({ method: z44.literal("startup/storagePrepared"), params: z44.object({}).strict() }).strict(),
  z44.object({ method: z44.literal("startup/storageState"), params: zcodeStorageStartupStateSchema }).strict()
]);
var zcodeStoragePathReadySchema = z44.object({ method: z44.literal("startup/storagePathReady"), reuse: z44.boolean().optional() }).strict();

// ../reference/ZCode/packages/shared/src/task-realtime-core.ts
import { z as z45 } from "zod";
var nonEmptyString5 = z45.string().trim().min(1);
var zcodeTaskModeRealtimeValues = [
  "yolo",
  "plan",
  "edit",
  "auto",
  "autoEdit",
  "build"
];
var zcodeTaskMigrationSourceRealtimeValues = [
  "claudeCode"
];
var zcodeTaskChangeSummaryRealtimeSchema = z45.object({
  fileCount: z45.number().int().nonnegative(),
  added: z45.number().int().nonnegative(),
  removed: z45.number().int().nonnegative(),
  files: z45.array(
    z45.object({
      path: z45.string(),
      added: z45.number().int().nonnegative(),
      removed: z45.number().int().nonnegative(),
      writeCount: z45.number().int().positive(),
      lastTurnIndex: z45.number().int().nonnegative()
    }).strict()
  )
}).strict();
var taskMetaRealtimeSchema = z45.object({
  taskId: nonEmptyString5,
  traceId: nonEmptyString5,
  title: z45.string(),
  titleOverridden: z45.boolean().optional(),
  workspacePath: nonEmptyString5,
  workspaceIdentity: nonEmptyString5.optional(),
  createdAt: z45.number().int().nonnegative(),
  updatedAt: z45.number().int().nonnegative(),
  // realtime deliver 的运行时 schema 之前把 mode 放宽成 string，
  // schema 推导类型因此无法回到 ZCodeTaskMeta，host typecheck 也就无法覆盖这条链路。
  mode: z45.enum(zcodeTaskModeRealtimeValues),
  model: z45.string().optional(),
  runtimeEpoch: z45.number().int().nonnegative().optional(),
  provider: zcodeAgentProviderSchema.optional(),
  migrationSource: z45.enum(zcodeTaskMigrationSourceRealtimeValues).optional(),
  forkedFromTaskId: nonEmptyString5.optional(),
  unreadAt: z45.number().int().nonnegative().optional(),
  status: z45.enum(["running", "completed", "error"]).optional(),
  lastError: z45.object({
    code: z45.string().optional(),
    message: z45.string().min(1),
    traceId: nonEmptyString5.optional(),
    taskId: nonEmptyString5.optional(),
    // 旧 realtime schema 会静默剥离 lastError.attribution，导致手机 replayable
    // task meta 与桌面 snapshot 的归因不一致；这里沿用共享 schema 保持 wire 约束一致。
    attribution: errorAttributionSchema.optional()
  }).optional(),
  changeSummary: zcodeTaskChangeSummaryRealtimeSchema.optional()
});
function resolveWorkspaceKey(params) {
  return params.workspaceIdentity?.trim() || params.workspacePath;
}
var taskRealtimeReasonSchema = z45.enum([
  "task_created",
  "user_message_saved",
  "assistant_message_saved",
  "task_status_changed",
  "task_meta_changed",
  // 切模型等纯配置变更独立成 reason，避免被当成归属相关 meta 变更触发列表整刷。
  "task_model_changed",
  // 标题更新（首条消息/自动标题）与归属无关且高频，独立 reason 避免全局 membership 重拉。
  "task_title_changed",
  "task_pinned",
  "task_unpinned",
  "task_archived",
  "task_unarchived",
  "task_deleted",
  "stream_mirror_gap",
  "stream_mirror_owner_lost"
]);
var taskRealtimeDeliveryPurposeSchema = z45.enum(["observer", "relay_owner"]);
var taskRealtimeHostDeliveryKindSchema = z45.enum(["desktop_window", "relay_bridge"]);
var taskRealtimeEnvelopeSchema = z45.object({
  eventId: nonEmptyString5,
  workspacePath: nonEmptyString5,
  workspaceIdentity: nonEmptyString5.optional(),
  workspaceKey: nonEmptyString5,
  traceId: nonEmptyString5,
  createdAt: z45.number().int().nonnegative()
}).strict();
var taskStreamWatermarkSchema = z45.object({
  runId: nonEmptyString5,
  opSeq: z45.number().int().nonnegative()
}).strict();
var taskRealtimeInvalidationBaseEventSchema = taskRealtimeEnvelopeSchema.extend({
  reason: taskRealtimeReasonSchema,
  streamWatermark: taskStreamWatermarkSchema.optional()
}).strict();
var addWorkspaceKeyIssue = (ctx, event) => {
  const expectedWorkspaceKey = resolveWorkspaceKey(event);
  if (event.workspaceKey !== expectedWorkspaceKey) {
    ctx.addIssue({
      code: z45.ZodIssueCode.custom,
      path: ["workspaceKey"],
      message: "workspaceKey must match workspaceIdentity fallback rule"
    });
  }
};
var addRunIdTraceIdIssue = (ctx, target) => {
  if (target.runId !== target.traceId) {
    ctx.addIssue({
      code: z45.ZodIssueCode.custom,
      path: ["runId"],
      message: "runId must match traceId"
    });
  }
};
var taskSnapshotInvalidatedEventSchema = taskRealtimeInvalidationBaseEventSchema.extend({
  type: z45.literal("task_snapshot_invalidated"),
  taskId: nonEmptyString5
}).strict();
var workspaceTaskListInvalidatedEventSchema = taskRealtimeInvalidationBaseEventSchema.extend({
  type: z45.literal("workspace_task_list_invalidated"),
  taskId: nonEmptyString5.optional(),
  taskMeta: taskMetaRealtimeSchema.optional()
}).strict();
var zcodePromptAttachmentSchema = z45.discriminatedUnion("kind", [
  z45.object({
    kind: z45.literal("image"),
    filename: z45.string(),
    mimeType: z45.string(),
    sizeBytes: z45.number().int().nonnegative().optional(),
    dataBase64: z45.string().optional(),
    localPath: z45.string().optional()
  }).strict(),
  z45.object({
    kind: z45.literal("audio"),
    filename: z45.string(),
    mimeType: z45.string(),
    dataBase64: z45.string().optional(),
    localPath: z45.string().optional()
  }).strict(),
  // 附件类型新增 video 后，replayable schema 未同步，手机远控会拒绝合法附件。
  z45.object({
    kind: z45.literal("video"),
    filename: z45.string(),
    mimeType: z45.string(),
    sizeBytes: z45.number().int().nonnegative().optional(),
    dataBase64: z45.string().optional(),
    localPath: z45.string().optional()
  }).strict(),
  z45.object({
    kind: z45.literal("pdf"),
    filename: z45.string(),
    mimeType: z45.string(),
    sizeBytes: z45.number().int().nonnegative().optional(),
    dataBase64: z45.string().optional(),
    localPath: z45.string().optional()
  }).strict(),
  z45.object({
    kind: z45.literal("file"),
    filename: z45.string(),
    mimeType: z45.string(),
    sizeBytes: z45.number().int().nonnegative(),
    dataBase64: z45.string().optional(),
    textContent: z45.string().optional(),
    localPath: z45.string().optional()
  }).strict()
]);
var taskStreamMirrorableEventSchema = z45.object({
  type: nonEmptyString5,
  taskId: nonEmptyString5,
  traceId: nonEmptyString5
}).passthrough();
var taskStreamMirrorUserMessagePublishOpSchema = z45.object({
  kind: z45.literal("user_message"),
  messageId: nonEmptyString5,
  content: z45.string(),
  attachments: z45.array(zcodePromptAttachmentSchema).optional(),
  timestamp: z45.number().finite()
}).strict();
var taskStreamMirrorStreamEventPublishOpSchema = z45.object({
  kind: z45.literal("stream_event"),
  event: taskStreamMirrorableEventSchema
}).strict();
var taskStreamMirrorPublishOpSchema = z45.discriminatedUnion("kind", [
  taskStreamMirrorUserMessagePublishOpSchema,
  taskStreamMirrorStreamEventPublishOpSchema
]);
var taskStreamMirrorOpSchema = z45.discriminatedUnion("kind", [
  taskStreamMirrorUserMessagePublishOpSchema.extend({
    seq: z45.number().int().positive()
  }).strict(),
  taskStreamMirrorStreamEventPublishOpSchema.extend({
    seq: z45.number().int().positive()
  }).strict()
]);
var taskStreamMirrorTargetRawSchema = z45.object({
  workspacePath: nonEmptyString5,
  workspaceIdentity: nonEmptyString5.optional(),
  workspaceKey: nonEmptyString5,
  taskId: nonEmptyString5,
  runId: nonEmptyString5,
  traceId: nonEmptyString5,
  ownerClientId: nonEmptyString5.optional(),
  ownerDeviceLabel: nonEmptyString5.optional()
}).strict();
var taskStreamMirrorTargetSchema = taskStreamMirrorTargetRawSchema.superRefine(
  (target, ctx) => {
    addWorkspaceKeyIssue(ctx, target);
    addRunIdTraceIdIssue(ctx, target);
  }
);
var taskStreamMirrorBatchEventRawSchema = taskRealtimeEnvelopeSchema.extend({
  type: z45.literal("task_stream_mirror_batch"),
  taskId: nonEmptyString5,
  runId: nonEmptyString5,
  ownerClientId: nonEmptyString5.optional(),
  ownerDeviceLabel: nonEmptyString5.optional(),
  batchSeq: z45.number().int().positive(),
  fromSeq: z45.number().int().positive(),
  toSeq: z45.number().int().positive(),
  ops: z45.array(taskStreamMirrorOpSchema),
  terminal: z45.boolean()
}).strict();
var taskRunLeaseTargetSchema = taskStreamMirrorTargetSchema;
var taskRunLeaseAcquireRequestSchema = taskStreamMirrorTargetRawSchema.extend({
  leaseRequestId: nonEmptyString5
}).strict().superRefine((request, ctx) => {
  addWorkspaceKeyIssue(ctx, request);
  addRunIdTraceIdIssue(ctx, request);
});
var taskRunLeaseResultSchema = z45.discriminatedUnion("acquired", [
  z45.object({
    leaseRequestId: nonEmptyString5,
    acquired: z45.literal(true),
    ownerHostId: nonEmptyString5
  }).strict(),
  z45.object({
    leaseRequestId: nonEmptyString5,
    acquired: z45.literal(false),
    ownerHostId: nonEmptyString5,
    reason: z45.literal("owned_by_other_host")
  }).strict()
]);
var taskOwnerCommandBaseSchema = z45.object({
  commandRequestId: nonEmptyString5,
  workspacePath: nonEmptyString5,
  workspaceIdentity: nonEmptyString5.optional(),
  workspaceKey: nonEmptyString5,
  taskId: nonEmptyString5,
  runId: nonEmptyString5
}).strict();
var taskStopGenerationOwnerCommandRequestSchema = taskOwnerCommandBaseSchema.extend({
  type: z45.literal("stop_generation")
}).strict();
var taskRespondPermissionOwnerCommandRequestSchema = taskOwnerCommandBaseSchema.extend({
  type: z45.literal("respond_permission"),
  permissionRequestId: nonEmptyString5,
  optionId: nonEmptyString5,
  response: zcodePermissionResponseSchema
}).strict();
var taskRespondElicitationOwnerCommandRequestSchema = taskOwnerCommandBaseSchema.extend({
  type: z45.literal("respond_elicitation"),
  elicitationRequestId: nonEmptyString5,
  action: z45.enum(["accept", "decline", "cancel"]),
  content: z45.record(z45.string(), z45.unknown()).optional()
}).strict();
var taskRespondWorkspaceHookReviewOwnerCommandRequestSchema = taskOwnerCommandBaseSchema.extend({
  type: z45.literal("respond_workspace_hook_review"),
  remoteSessionId: nonEmptyString5.optional(),
  sessionId: nonEmptyString5,
  bundleDigest: z45.string().regex(/^[a-f0-9]{64}$/u),
  reviewFlowId: nonEmptyString5,
  generation: z45.number().int().positive(),
  interactionId: nonEmptyString5,
  decision: workspaceHookReviewDecisionSchema
}).strict().superRefine((command, context) => {
  if (command.remoteSessionId && !command.workspaceIdentity) {
    context.addIssue({
      code: z45.ZodIssueCode.custom,
      path: ["workspaceIdentity"],
      message: "remote workspace Hook review response requires workspaceIdentity"
    });
  }
});
var zcodeTaskRuntimeCommandBaseSchema = z45.object({
  commandId: nonEmptyString5,
  taskId: nonEmptyString5,
  traceId: nonEmptyString5,
  workspacePath: nonEmptyString5,
  workspaceIdentity: nonEmptyString5.optional(),
  workspaceKey: nonEmptyString5,
  status: z45.enum(["accepted", "running", "failed"]),
  createdAt: z45.number().int().nonnegative(),
  updatedAt: z45.number().int().nonnegative(),
  clientId: nonEmptyString5.optional(),
  clientLabel: nonEmptyString5.optional(),
  error: z45.string().optional()
}).strict();
var zcodeTaskRuntimeCommandSchema = z45.discriminatedUnion("type", [
  zcodeTaskRuntimeCommandBaseSchema.extend({
    type: z45.literal("send_prompt"),
    content: z45.string(),
    attachments: z45.array(zcodePromptAttachmentSchema).optional(),
    automationId: nonEmptyString5.optional()
  }).strict()
]);
var taskEnqueueCommandOwnerCommandRequestSchema = taskOwnerCommandBaseSchema.extend({
  type: z45.literal("enqueue_task_command"),
  taskCommand: zcodeTaskRuntimeCommandSchema
}).strict();
var taskPromoteCommandOwnerCommandRequestSchema = taskOwnerCommandBaseSchema.extend({
  type: z45.literal("promote_task_command"),
  commandId: nonEmptyString5,
  clientMode: z45.literal("web-remote-replayable")
}).strict();
var taskCancelCommandOwnerCommandRequestSchema = taskOwnerCommandBaseSchema.extend({
  type: z45.literal("cancel_task_command"),
  commandId: nonEmptyString5,
  clientMode: z45.literal("web-remote-replayable")
}).strict();
var taskOwnerCommandRequestSchema = z45.discriminatedUnion("type", [
  taskStopGenerationOwnerCommandRequestSchema,
  taskRespondPermissionOwnerCommandRequestSchema,
  taskRespondElicitationOwnerCommandRequestSchema,
  taskRespondWorkspaceHookReviewOwnerCommandRequestSchema,
  taskEnqueueCommandOwnerCommandRequestSchema,
  taskPromoteCommandOwnerCommandRequestSchema,
  taskCancelCommandOwnerCommandRequestSchema
]).superRefine((command, ctx) => {
  addWorkspaceKeyIssue(ctx, command);
});
var taskOwnerCommandDeliverySchema = z45.discriminatedUnion("type", [
  taskStopGenerationOwnerCommandRequestSchema.extend({
    requesterHostId: nonEmptyString5
  }).strict(),
  taskRespondPermissionOwnerCommandRequestSchema.extend({
    requesterHostId: nonEmptyString5
  }).strict(),
  taskRespondElicitationOwnerCommandRequestSchema.extend({
    requesterHostId: nonEmptyString5
  }).strict(),
  taskRespondWorkspaceHookReviewOwnerCommandRequestSchema.extend({
    requesterHostId: nonEmptyString5
  }).strict(),
  taskEnqueueCommandOwnerCommandRequestSchema.extend({
    requesterHostId: nonEmptyString5
  }).strict(),
  taskPromoteCommandOwnerCommandRequestSchema.extend({
    requesterHostId: nonEmptyString5
  }).strict(),
  taskCancelCommandOwnerCommandRequestSchema.extend({
    requesterHostId: nonEmptyString5
  }).strict()
]).superRefine((command, ctx) => {
  addWorkspaceKeyIssue(ctx, command);
});
var taskOwnerCommandErrorCodeSchema = z45.enum([
  "NO_ACTIVE_TASK_OWNER",
  "STALE_TASK_OWNER_COMMAND",
  "OWNER_COMMAND_FAILED"
]);
var taskOwnerCommandResultSchema = z45.discriminatedUnion("success", [
  z45.object({
    commandRequestId: nonEmptyString5,
    success: z45.literal(true),
    taskCommand: zcodeTaskRuntimeCommandSchema.optional()
  }).strict(),
  z45.object({
    commandRequestId: nonEmptyString5,
    success: z45.literal(false),
    error: z45.string(),
    code: taskOwnerCommandErrorCodeSchema.optional()
  }).strict()
]);
var taskRealtimeEventSchema = z45.discriminatedUnion("type", [
  taskSnapshotInvalidatedEventSchema,
  workspaceTaskListInvalidatedEventSchema,
  taskStreamMirrorBatchEventRawSchema
]).superRefine((event, ctx) => {
  addWorkspaceKeyIssue(ctx, event);
  if (event.type === "task_stream_mirror_batch") {
    addRunIdTraceIdIssue(ctx, event);
  }
});
var taskRealtimeDeliveredEventSchema = z45.discriminatedUnion("type", [
  taskSnapshotInvalidatedEventSchema.extend({
    originHostId: nonEmptyString5,
    deliveryPurpose: taskRealtimeDeliveryPurposeSchema.optional()
  }).strict(),
  workspaceTaskListInvalidatedEventSchema.extend({
    originHostId: nonEmptyString5,
    deliveryPurpose: taskRealtimeDeliveryPurposeSchema.optional()
  }).strict(),
  taskStreamMirrorBatchEventRawSchema.extend({
    originHostId: nonEmptyString5,
    deliveryPurpose: taskRealtimeDeliveryPurposeSchema.optional()
  }).strict()
]).superRefine((event, ctx) => {
  addWorkspaceKeyIssue(ctx, event);
  if (event.type === "task_stream_mirror_batch") {
    addRunIdTraceIdIssue(ctx, event);
  }
});

// ../reference/ZCode/packages/shared/src/validation.ts
function formatZodError(error) {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
    return `${path}: ${issue.message}`;
  }).join("; ");
}
var nonEmptyStringSchema3 = z46.string().trim().min(1);
var stringArraySchema = z46.array(z46.string());
var credentialRecordSchema = z46.record(z46.string(), z46.string());
var credentialValueSchema = z46.string();
var sshConnectOptionsSchema = z46.object({
  kind: z46.literal("ssh"),
  host: nonEmptyStringSchema3,
  port: z46.number().int().positive().max(65535).optional(),
  username: nonEmptyStringSchema3,
  sshConfigAlias: nonEmptyStringSchema3.optional(),
  password: z46.string().optional(),
  privateKeyPath: z46.string().optional(),
  privateKeyPassphrase: z46.string().optional(),
  assetInstallMode: z46.enum(REMOTE_ASSET_INSTALL_MODES).optional(),
  resourcePackages: z46.object({
    selectedPackageIds: z46.array(z46.string().refine(isKnownRemoteResourcePackageId)).optional()
  }).optional()
});
var wslConnectOptionsSchema = z46.object({
  kind: z46.literal("wsl"),
  distro: z46.string().optional(),
  user: wslUserSchema.optional()
});
var dockerConnectOptionsSchema = z46.object({
  kind: z46.literal("docker"),
  container: nonEmptyStringSchema3
});
var remoteTargetSchema = z46.discriminatedUnion("kind", [
  sshConnectOptionsSchema,
  wslConnectOptionsSchema,
  dockerConnectOptionsSchema
]);
var helloMessageSchema = z46.object({
  type: z46.literal("zcode-hello"),
  version: z46.string(),
  platform: z46.string(),
  arch: z46.string(),
  pid: z46.number().int()
});
var helloAckMessageSchema = z46.object({
  type: z46.literal("zcode-hello-ack"),
  version: z46.string(),
  clientId: nonEmptyStringSchema3
});
var rendererLogPayloadSchema = z46.object({
  level: z46.enum(["info", "warn", "error"]),
  args: z46.array(z46.unknown())
});
var taskNotificationPayloadSchema = z46.object({
  taskId: nonEmptyStringSchema3,
  status: z46.enum([
    "completed",
    "failed",
    "permission_request",
    "elicitation_request",
    "feedback_update"
  ]),
  requestId: nonEmptyStringSchema3.optional(),
  title: z46.string(),
  body: z46.string()
});
var telemetryRendererContextSchema = z46.object({
  clientTimezone: nonEmptyStringSchema3,
  clientLanguage: nonEmptyStringSchema3,
  screenResolution: nonEmptyStringSchema3
});
var rendererTelemetryEventPayloadSchema = z46.object({
  context: telemetryRendererContextSchema,
  elementName: nonEmptyStringSchema3,
  eventRegion: nonEmptyStringSchema3,
  eventType: nonEmptyStringSchema3,
  eventText: z46.string().optional(),
  eventExtraDetail: z46.record(z46.string(), z46.string()),
  userId: z46.string().optional(),
  talkId: z46.string().optional(),
  messageId: z46.string().optional()
});
var armsCustomEventPayloadSchema = z46.object({
  name: nonEmptyStringSchema3,
  group: nonEmptyStringSchema3,
  value: z46.number().finite().optional(),
  properties: z46.record(z46.string(), z46.union([z46.string(), z46.number().finite(), z46.boolean(), z46.undefined()])).optional()
});
var broadcastMessageSchema = z46.object({
  channel: nonEmptyStringSchema3,
  payload: z46.unknown(),
  sourceWindowId: z46.number().int().optional()
});
var remoteAssetDirsSchema = z46.object({
  mockCdnDir: z46.string().optional(),
  remoteCdnBaseUrl: z46.string().optional(),
  remoteCdnBaseUrls: z46.array(z46.string()).optional(),
  remoteCacheDir: z46.string().optional()
});
var hostAgentWarmupTargetSchema = z46.object({
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: nonEmptyStringSchema3.optional()
});
var hostInitLocalMessageSchema = z46.object({
  type: z46.literal("init-local"),
  databaseStartupId: z46.string().min(1).max(128).optional(),
  hostId: nonEmptyStringSchema3.optional(),
  deliveryKind: taskRealtimeHostDeliveryKindSchema.optional(),
  deviceMid: z46.string().optional(),
  feedbackApiBase: z46.string().url().optional(),
  workspacePath: nonEmptyStringSchema3.optional(),
  workspaceIdentity: nonEmptyStringSchema3.optional(),
  agentWarmupTargets: z46.array(hostAgentWarmupTargetSchema).max(3).optional(),
  agentSpawnFallbackCwd: nonEmptyStringSchema3.optional(),
  zcodeBuiltinProviderConfigFilePath: nonEmptyStringSchema3,
  runtimeProcessEnvPatch: z46.record(z46.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), z46.string()).optional()
});
var windowHostRemoteWorkspaceDescriptorSchema = z46.object({
  remoteSessionId: nonEmptyStringSchema3,
  target: remoteTargetSchema,
  workspacePath: nonEmptyStringSchema3.optional(),
  workspaceIdentity: nonEmptyStringSchema3.optional(),
  generation: z46.number().int().positive()
}).strict();
var windowHostAttachmentScopeSchema = z46.discriminatedUnion("kind", [
  z46.object({ kind: z46.literal("local") }).strict(),
  z46.object({
    kind: z46.literal("remote"),
    remoteSessionId: nonEmptyStringSchema3,
    workspacePath: nonEmptyStringSchema3,
    workspaceIdentity: nonEmptyStringSchema3
  }).strict()
]);
var hostConnectRemoteWorkspaceMessageSchema = z46.object({
  type: z46.literal("connect-remote-workspace"),
  requestId: nonEmptyStringSchema3,
  target: remoteTargetSchema,
  remoteAssets: remoteAssetDirsSchema,
  workspacePath: nonEmptyStringSchema3.optional(),
  workspaceIdentity: nonEmptyStringSchema3.optional()
}).strict();
var hostCancelRemoteWorkspaceConnectMessageSchema = z46.object({
  type: z46.literal("cancel-remote-workspace-connect"),
  requestId: nonEmptyStringSchema3
}).strict();
var hostBindRemoteWorkspaceContextMessageSchema = z46.object({
  type: z46.literal("bind-remote-workspace-context"),
  requestId: nonEmptyStringSchema3,
  remoteSessionId: nonEmptyStringSchema3,
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: nonEmptyStringSchema3
}).strict();
var hostDisposeRemoteWorkspaceSessionMessageSchema = z46.object({
  type: z46.literal("dispose-remote-workspace-session"),
  requestId: nonEmptyStringSchema3,
  remoteSessionId: nonEmptyStringSchema3
}).strict();
var hostAttachServicePortMessageSchema = z46.object({
  type: z46.literal("attach-service-port"),
  // main 只能声明 attachment 来源；connectionId 仍由 host process 分配。
  // desktop reload/remote reattach 必须显式 continuous，手机 shared-host 必须 replayable。
  requestId: nonEmptyStringSchema3,
  attachmentId: nonEmptyStringSchema3,
  clientMode: z46.enum(["desktop-continuous", "web-remote-replayable"]),
  scope: windowHostAttachmentScopeSchema
}).strict();
var hostDetachServicePortMessageSchema = z46.object({
  type: z46.literal("detach-service-port"),
  attachmentId: nonEmptyStringSchema3
});
var hostDisposeMessageSchema = z46.object({
  type: z46.literal("dispose")
});
var hostBroadcastEnvelopeSchema = z46.object({
  type: z46.literal("broadcast"),
  message: broadcastMessageSchema
});
var hostBroadcastClaimResultMessageSchema = z46.discriminatedUnion("status", [
  z46.object({
    type: z46.literal("broadcast-claim-result"),
    requestId: nonEmptyStringSchema3,
    status: z46.literal("acquired"),
    claimToken: nonEmptyStringSchema3
  }),
  z46.object({
    type: z46.literal("broadcast-claim-result"),
    requestId: nonEmptyStringSchema3,
    status: z46.literal("busy"),
    retryAfterMs: z46.number().int().nonnegative()
  }),
  z46.object({
    type: z46.literal("broadcast-claim-result"),
    requestId: nonEmptyStringSchema3,
    status: z46.literal("committed")
  })
]);
var hostTaskRealtimeDeliverMessageSchema = z46.object({
  type: z46.literal("task-realtime-deliver"),
  event: taskRealtimeDeliveredEventSchema
});
var hostTaskRunLeaseResultMessageSchema = z46.object({
  type: z46.literal("task-run-lease-result"),
  result: taskRunLeaseResultSchema
});
var hostTaskOwnerCommandDeliverMessageSchema = z46.object({
  type: z46.literal("task-owner-command-deliver"),
  command: taskOwnerCommandDeliverySchema
});
var hostTaskOwnerCommandResultMessageSchema = z46.object({
  type: z46.literal("task-owner-command-result"),
  result: taskOwnerCommandResultSchema
});
var hostBotRemoteWorkspaceReconnectResultMessageSchema = z46.object({
  type: z46.literal("bot-remote-workspace-reconnect-result"),
  requestId: nonEmptyStringSchema3,
  ok: z46.boolean(),
  sessionId: nonEmptyStringSchema3.optional(),
  error: z46.string().optional()
});
var hostBotRemoteWorkspaceConnectionStatusResultMessageSchema = z46.object({
  type: z46.literal("bot-remote-workspace-connection-status-result"),
  requestId: nonEmptyStringSchema3,
  ok: z46.boolean(),
  connected: z46.boolean().optional(),
  error: z46.string().optional()
});
var hostBotRemoteWorkspaceRuntimePortMessageSchema = z46.object({
  type: z46.literal("bot-remote-workspace-runtime-port"),
  requestId: nonEmptyStringSchema3,
  ok: z46.boolean(),
  error: z46.string().optional()
});
var sessionMessageRequestSchema = z46.object({
  content: nonEmptyStringSchema3,
  createdAt: nonEmptyStringSchema3,
  fromSessionId: nonEmptyStringSchema3,
  messageId: nonEmptyStringSchema3,
  requestId: nonEmptyStringSchema3,
  toSessionId: nonEmptyStringSchema3
});
var sessionMessageDeliveryResultSchema = z46.object({
  error: z46.string().optional(),
  messageId: nonEmptyStringSchema3,
  requestId: nonEmptyStringSchema3,
  sessionId: nonEmptyStringSchema3,
  status: z46.enum(["success", "failed"])
});
var sessionRouteSchema = z46.object({
  sessionId: nonEmptyStringSchema3
});
var hostSessionMessageDeliverMessageSchema = z46.object({
  type: z46.literal("session-message-deliver"),
  request: sessionMessageRequestSchema
});
var hostSessionMessageDeliveryResultMessageSchema = z46.object({
  type: z46.literal("session-message-delivery-result"),
  result: sessionMessageDeliveryResultSchema
});
var hostFeedbackLogArchiveResultMessageSchema = z46.object({
  type: z46.literal("feedback-log-archive-result"),
  requestId: nonEmptyStringSchema3,
  ok: z46.boolean(),
  path: z46.string().optional(),
  size: z46.number().int().nonnegative().optional(),
  error: z46.string().optional()
});
var hostCronRunMessageSchema = z46.object({
  type: z46.literal("cron-run"),
  automationId: nonEmptyStringSchema3,
  runId: nonEmptyStringSchema3,
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: z46.string().optional(),
  prompt: nonEmptyStringSchema3,
  targetTaskId: nonEmptyStringSchema3.optional(),
  modelSelection: modelSelectionSchema.optional(),
  mode: z46.string().optional()
});
var hostOffPeakRunMessageSchema = z46.object({
  type: z46.literal("off-peak-run"),
  offPeakTaskId: nonEmptyStringSchema3,
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: z46.string().optional(),
  prompt: nonEmptyStringSchema3,
  // 权限四档映射现有 ZCodeTaskMode；与 cron-run 的 mode 同样按宽松 string 传输
  permissionMode: nonEmptyStringSchema3,
  modelSelection: modelSelectionSchema,
  conversationId: z46.string().optional(),
  sessionId: z46.string().optional(),
  serverTicketId: z46.string().optional()
});
var hostBrowserExecuteResultMessageSchema = z46.object({
  type: z46.literal("browser-execute-result"),
  requestId: nonEmptyStringSchema3,
  result: browserCommandResultSchema
});
var hostLocalMediaPreviewPathAuthorizeResultMessageSchema = z46.object({
  type: z46.literal("local-media-preview-path-authorize-result"),
  requestId: nonEmptyStringSchema3,
  ok: z46.boolean(),
  path: nonEmptyStringSchema3.optional(),
  error: z46.string().optional()
}).strict();
var hostCuaPipFocusChangedMessageSchema = z46.object({
  type: z46.literal("cua-pip-focus-changed"),
  event: z46.object({
    kind: z46.literal("focus-changed"),
    revision: z46.number().int().nonnegative().safe(),
    sourceWindowId: nonEmptyStringSchema3.max(255),
    sessionId: nonEmptyStringSchema3.max(255).nullable()
  }).strict()
}).strict();
var hostProviderProvisioningExecuteMessageSchema = z46.object({
  type: z46.literal("provider-provisioning-execute"),
  requestId: nonEmptyStringSchema3,
  environmentKey: nonEmptyStringSchema3,
  remoteSessionId: nonEmptyStringSchema3,
  trigger: providerProvisioningTriggerSchema
}).strict();
var hostResourceUsageSnapshotRequestMessageSchema = z46.object({
  type: z46.literal("resource-usage-snapshot-request"),
  requestId: nonEmptyStringSchema3
}).strict();
var hostIncomingMessageSchema = z46.discriminatedUnion("type", [
  z46.object({ type: z46.literal("database-startup-control"), control: databaseStartupControlSchema }).strict(),
  hostResourceUsageSnapshotRequestMessageSchema,
  z46.object({ type: z46.literal("resource-usage-snapshot-cancel"), requestId: nonEmptyStringSchema3 }).strict(),
  hostInitLocalMessageSchema,
  hostConnectRemoteWorkspaceMessageSchema,
  hostCancelRemoteWorkspaceConnectMessageSchema,
  hostBindRemoteWorkspaceContextMessageSchema,
  hostDisposeRemoteWorkspaceSessionMessageSchema,
  hostAttachServicePortMessageSchema,
  hostDetachServicePortMessageSchema,
  hostDisposeMessageSchema,
  hostBroadcastEnvelopeSchema,
  hostBroadcastClaimResultMessageSchema,
  hostTaskRealtimeDeliverMessageSchema,
  hostTaskRunLeaseResultMessageSchema,
  hostTaskOwnerCommandDeliverMessageSchema,
  hostTaskOwnerCommandResultMessageSchema,
  hostBotRemoteWorkspaceReconnectResultMessageSchema,
  hostBotRemoteWorkspaceConnectionStatusResultMessageSchema,
  hostBotRemoteWorkspaceRuntimePortMessageSchema,
  hostSessionMessageDeliverMessageSchema,
  hostSessionMessageDeliveryResultMessageSchema,
  hostFeedbackLogArchiveResultMessageSchema,
  hostCronRunMessageSchema,
  hostOffPeakRunMessageSchema,
  hostBrowserExecuteResultMessageSchema,
  hostLocalMediaPreviewPathAuthorizeResultMessageSchema,
  hostCuaPipFocusChangedMessageSchema,
  hostProviderProvisioningExecuteMessageSchema
]);
var hostRemoteWorkspaceConnectedResponseSchema = z46.object({
  type: z46.literal("remote-workspace-connected"),
  requestId: nonEmptyStringSchema3,
  descriptor: windowHostRemoteWorkspaceDescriptorSchema
}).strict();
var hostRemoteWorkspaceConnectionLogResponseSchema = z46.object({
  type: z46.literal("remote-workspace-connection-log"),
  requestId: nonEmptyStringSchema3,
  level: z46.enum(["info", "warn", "error"]),
  message: nonEmptyStringSchema3
}).strict();
var hostRemoteWorkspaceConnectFailedResponseSchema = z46.object({
  type: z46.literal("remote-workspace-connect-failed"),
  requestId: nonEmptyStringSchema3,
  error: nonEmptyStringSchema3
}).strict();
var hostRemoteWorkspaceClosedResponseSchema = z46.object({
  type: z46.literal("remote-workspace-closed"),
  remoteSessionId: nonEmptyStringSchema3,
  reason: z46.enum(["connection-closed", "disposed", "connect-cancelled"]),
  exitCode: z46.number().int().nullable().optional(),
  signal: z46.string().nullable().optional(),
  error: z46.string().optional()
}).strict();
var hostLogResponseSchema = z46.object({
  type: z46.literal("log"),
  level: z46.enum(["info", "warn", "error"]),
  source: z46.string(),
  message: z46.string()
});
var zcodeTaskMigrationSourceSchema = z46.enum(["claudeCode"]);
var hostAgentProcessSpawnedResponseSchema = z46.object({
  type: z46.literal("agent-process-spawned"),
  /** 进程泳道（mcp-status 等），旧 Host 不带该字段。 */
  lane: nonEmptyStringSchema3.optional(),
  pid: z46.number().int().positive(),
  provider: zcodeProviderSchema,
  workspacePath: nonEmptyStringSchema3,
  command: z46.string(),
  args: z46.array(z46.string()),
  startedAt: z46.number().int().nonnegative(),
  runtimeGeneration: z46.number().int().positive().optional(),
  runtimeInstanceId: nonEmptyStringSchema3.optional()
});
var hostAgentProcessReadyResponseSchema = z46.object({
  type: z46.literal("agent-process-ready"),
  /** 进程泳道（mcp-status 等），旧 Host 不带该字段。 */
  lane: nonEmptyStringSchema3.optional(),
  pid: z46.number().int().positive(),
  provider: zcodeProviderSchema,
  workspacePath: nonEmptyStringSchema3,
  readyAt: z46.number().int().nonnegative(),
  startupDurationMs: z46.number().int().nonnegative(),
  runtimeGeneration: z46.number().int().positive(),
  runtimeInstanceId: nonEmptyStringSchema3
});
var hostAgentProcessExitedResponseSchema = z46.object({
  type: z46.literal("agent-process-exited"),
  /** 进程泳道（mcp-status 等），旧 Host 不带该字段。 */
  lane: nonEmptyStringSchema3.optional(),
  pid: z46.number().int().positive(),
  provider: zcodeProviderSchema,
  workspacePath: nonEmptyStringSchema3,
  exitCode: z46.number().int().nullable(),
  signal: z46.string().nullable(),
  endedAt: z46.number().int().nonnegative(),
  terminationKind: z46.enum(["expected", "unexpected", "watchdog_recycle"]),
  terminationReason: z46.string().optional(),
  /** rolling-upgrade 兼容：旧 Host 缺字段时 desktop 映射 crash_phase=unknown。 */
  runtimeReady: z46.boolean().optional(),
  runtimeGeneration: z46.number().int().positive(),
  runtimeInstanceId: nonEmptyStringSchema3.optional(),
  uptimeMs: z46.number().int().nonnegative(),
  stderrLineCount: z46.number().int().nonnegative(),
  stderrTail: z46.array(z46.string().max(1100)).max(20).optional()
});
var hostAgentProcessErrorResponseSchema = z46.object({
  type: z46.literal("agent-process-error"),
  /** 进程泳道（mcp-status 等），旧 Host 不带该字段。 */
  lane: nonEmptyStringSchema3.optional(),
  pid: z46.number().int().positive().nullable(),
  provider: zcodeProviderSchema,
  workspacePath: nonEmptyStringSchema3,
  command: z46.string(),
  args: z46.array(z46.string()),
  errorName: nonEmptyStringSchema3,
  errorCode: z46.string().optional(),
  errorMessage: z46.string(),
  errorStack: z46.string().optional(),
  runtimeGeneration: z46.number().int().positive(),
  runtimeInstanceId: nonEmptyStringSchema3.optional(),
  occurredAt: z46.number().int().nonnegative()
});
var hostAgentProcessExceptionResponseSchema = z46.object({
  type: z46.literal("agent-process-exception"),
  lane: nonEmptyStringSchema3.optional(),
  pid: z46.number().int().positive(),
  provider: zcodeProviderSchema,
  workspacePath: nonEmptyStringSchema3,
  runtimeGeneration: z46.number().int().positive(),
  runtimeInstanceId: nonEmptyStringSchema3,
  diagnostic: zcodeProcessDiagnosticSchema
}).strict();
var processResourceCliLaneSchema = z46.enum(PROCESS_RESOURCE_CLI_LANES);
var agentLaneResourceSampleSchema = zcodeProcessResourceSampleSchema.extend({ lane: processResourceCliLaneSchema.optional() }).strict();
var resourceTelemetryEnvironmentKeySchema = z46.string().regex(/^[a-f0-9]{64}$/);
var hostAgentResourceSampleResponseSchema = z46.object({
  type: z46.literal("agent-resource-sample"),
  runtimeSurface: z46.enum(["local", "remote"]),
  environmentKey: resourceTelemetryEnvironmentKeySchema.optional(),
  sample: agentLaneResourceSampleSchema
}).strict();
var nodeSelfResourceSampleSchema = z46.object({
  /**
   * 整机归一化 CPU 百分比，100 表示所有逻辑核占满。
   * 上限刻意放宽（与 CLI 的 `zcodeProcessResourceSampleSchema` 同口径）：读数异常时宁可让
   * 样本带着离谱数值上去、由平台侧数值异常规则暴露，也不在客户端静默丢样本。
   */
  cpuPercent: z46.number().finite().nonnegative().max(1e5),
  rssKb: z46.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  heapUsedKb: z46.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
}).strict();
var rendererHeapSampleSchema = z46.object({
  heapUsedKb: z46.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
}).strict();
var hostResourceSampleResponseSchema = z46.object({
  type: z46.literal("host-resource-sample"),
  sample: nodeSelfResourceSampleSchema
}).strict();
var hostMcpResourceSamplesResponseSchema = z46.object({
  type: z46.literal("mcp-resource-samples"),
  runtimeSurface: z46.enum(["local", "remote"]),
  environmentKey: resourceTelemetryEnvironmentKeySchema.optional(),
  samples: zcodeMcpResourceSamplesSchema
}).strict();
var hostToolExecResourceResponseSchema = z46.object({
  type: z46.literal("tool-exec-resource"),
  runtimeSurface: z46.enum(["local", "remote"]),
  sample: zcodeToolExecResourceSchema
}).strict();
var hostMcpTelemetryResponseSchema = z46.object({
  type: z46.literal("mcp-telemetry"),
  runtimeSurface: z46.enum(["local", "remote"]),
  event: zcodeMcpTelemetryEventSchema
}).strict();
var hostSessionCreateTelemetryResponseSchema = z46.object({
  type: z46.literal("session-create-telemetry"),
  event: automationSessionCreateTelemetrySchema
}).strict();
var hostAgentRunningTaskCountChangedResponseSchema = z46.object({
  type: z46.literal("agent-running-task-count-changed"),
  runningTaskCount: z46.number().int().nonnegative()
});
var hostWorkspaceRunningTaskCountChangedResponseSchema = z46.object({
  type: z46.literal("workspace-running-task-count-changed"),
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: nonEmptyStringSchema3.optional(),
  runningTaskCount: z46.number().int().nonnegative()
});
var hostCuaOperationStateResponseSchema = z46.object({
  type: z46.literal("cua-operation-state"),
  active: z46.boolean(),
  sessionId: nonEmptyStringSchema3,
  turnId: nonEmptyStringSchema3,
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: nonEmptyStringSchema3.optional()
}).strict();
var hostBroadcastClaimRequestResponseSchema = z46.object({
  type: z46.literal("broadcast-claim-request"),
  requestId: nonEmptyStringSchema3,
  key: nonEmptyStringSchema3.max(1024)
});
var hostBroadcastClaimCommitResponseSchema = z46.object({
  type: z46.literal("broadcast-claim-commit"),
  key: nonEmptyStringSchema3.max(1024),
  claimToken: nonEmptyStringSchema3
});
var hostBroadcastClaimReleaseResponseSchema = z46.object({
  type: z46.literal("broadcast-claim-release"),
  key: nonEmptyStringSchema3.max(1024),
  claimToken: nonEmptyStringSchema3
});
var hostTaskRealtimePublishResponseSchema = z46.object({
  type: z46.literal("task-realtime-publish"),
  event: taskRealtimeEventSchema
});
var hostTaskStreamOpPublishResponseSchema = z46.object({
  type: z46.literal("task-stream-op-publish"),
  target: taskStreamMirrorTargetSchema,
  op: taskStreamMirrorPublishOpSchema
});
var hostTaskRunLeaseAcquireResponseSchema = z46.object({
  type: z46.literal("task-run-lease-acquire"),
  request: taskRunLeaseAcquireRequestSchema
});
var hostTaskRunLeaseReleaseResponseSchema = z46.object({
  type: z46.literal("task-run-lease-release"),
  target: taskRunLeaseTargetSchema
});
var hostTaskOwnerCommandRequestResponseSchema = z46.object({
  type: z46.literal("task-owner-command-request"),
  command: taskOwnerCommandRequestSchema
});
var hostTaskOwnerCommandResultResponseSchema = z46.object({
  type: z46.literal("task-owner-command-result"),
  result: taskOwnerCommandResultSchema
});
var hostBotRemoteWorkspaceReconnectRequestResponseSchema = z46.object({
  type: z46.literal("bot-remote-workspace-reconnect-request"),
  requestId: nonEmptyStringSchema3,
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: nonEmptyStringSchema3,
  target: remoteTargetSchema
});
var hostBotRemoteWorkspaceConnectionStatusRequestResponseSchema = z46.object({
  type: z46.literal("bot-remote-workspace-connection-status-request"),
  requestId: nonEmptyStringSchema3,
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: nonEmptyStringSchema3,
  target: remoteTargetSchema
});
var hostBotRemoteWorkspaceRuntimePortRequestResponseSchema = z46.object({
  type: z46.literal("bot-remote-workspace-runtime-port-request"),
  requestId: nonEmptyStringSchema3,
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: nonEmptyStringSchema3,
  target: remoteTargetSchema
});
var hostSessionMessageSendRequestedResponseSchema = z46.object({
  type: z46.literal("session-message-send-requested"),
  request: sessionMessageRequestSchema
});
var hostSessionRouteAnnounceResponseSchema = z46.object({
  type: z46.literal("session-route-announce"),
  route: sessionRouteSchema
});
var hostSessionMessageDeliverResultResponseSchema = z46.object({
  type: z46.literal("session-message-deliver-result"),
  result: sessionMessageDeliveryResultSchema
});
var hostFeedbackLogArchiveRequestResponseSchema = z46.object({
  type: z46.literal("feedback-log-archive-request"),
  requestId: nonEmptyStringSchema3,
  sourceDir: nonEmptyStringSchema3
});
var hostCronRunResultResponseSchema = z46.object({
  type: z46.literal("cron-run-result"),
  runId: nonEmptyStringSchema3,
  ok: z46.boolean(),
  taskId: z46.string().optional(),
  sessionId: z46.string().optional(),
  error: z46.string().optional(),
  failureKind: z46.enum(["transient", "permanent"]).optional()
});
var hostOffPeakRunResultResponseSchema = z46.object({
  type: z46.literal("off-peak-run-result"),
  offPeakTaskId: nonEmptyStringSchema3,
  ok: z46.boolean(),
  conversationId: z46.string().optional(),
  sessionId: z46.string().optional(),
  error: z46.string().optional(),
  failureKind: z46.enum(["transient", "permanent"]).optional()
});
var hostCronSchedulerWakeRequestResponseSchema = z46.object({
  type: z46.literal("cron-scheduler-wake-request"),
  automationId: nonEmptyStringSchema3
});
var hostOffPeakSchedulerWakeRequestResponseSchema = z46.object({
  type: z46.literal("off-peak-scheduler-wake-request"),
  offPeakTaskId: z46.string().optional()
});
var hostBrowserExecuteRequestResponseSchema = z46.object({
  type: z46.literal("browser-execute-request"),
  requestId: nonEmptyStringSchema3,
  // 迁移兼容：旧 host bundle 没有 browserId/context；新 browser-client 链路始终携带。
  browserId: nonEmptyStringSchema3.optional(),
  browserGeneration: z46.number().int().nonnegative().optional(),
  sessionId: nonEmptyStringSchema3,
  turnId: nonEmptyStringSchema3.optional(),
  workspaceKey: nonEmptyStringSchema3.optional(),
  workspacePath: nonEmptyStringSchema3.optional(),
  workspaceIdentity: nonEmptyStringSchema3.optional(),
  remoteSessionId: nonEmptyStringSchema3.optional(),
  clientMode: z46.enum(["desktop-continuous", "web-remote-replayable"]).optional(),
  sessionContext: z46.enum(["live", "cached"]).optional(),
  command: browserCommandSchema
});
var hostLocalMediaPreviewPathAuthorizeRequestResponseSchema = z46.object({
  type: z46.literal("local-media-preview-path-authorize-request"),
  requestId: nonEmptyStringSchema3,
  path: nonEmptyStringSchema3
}).strict();
var networkObservationSchema = z46.object({
  transport: z46.enum(["http", "websocket", "rpc"]),
  interface: z46.string(),
  durationMs: z46.number(),
  ok: z46.boolean(),
  statusCode: z46.number().optional(),
  errorKind: z46.string().optional(),
  attempt: z46.number().int().positive().optional(),
  dnsMs: z46.number().optional(),
  tcpMs: z46.number().optional(),
  tlsMs: z46.number().optional(),
  ttfbMs: z46.number().optional(),
  downloadMs: z46.number().optional()
});
var hostNetworkTelemetryBatchResponseSchema = z46.object({
  type: z46.literal("network-telemetry-batch"),
  observations: z46.array(networkObservationSchema).max(500)
});
var hostProviderProvisioningSourceChangedResponseSchema = z46.object({
  type: z46.literal("provider-provisioning-source-changed"),
  trigger: providerProvisioningTriggerSchema.exclude(["environment-online"])
}).strict();
var hostProviderProvisioningExecutionResultResponseSchema = z46.object({
  type: z46.literal("provider-provisioning-execution-result"),
  requestId: nonEmptyStringSchema3,
  environmentKey: nonEmptyStringSchema3,
  status: z46.enum(["applied", "already-applied", "unsupported", "failed", "rollback_failed"]),
  error: z46.string().optional()
}).strict();
var hostResourceUsageProcessSchema = z46.object({
  pid: z46.number().int().positive(),
  name: nonEmptyStringSchema3,
  category: z46.enum(["base", "builtin-plugin", "community-plugin"]),
  groupKey: nonEmptyStringSchema3,
  groupLabel: nonEmptyStringSchema3,
  cpuPercent: z46.number().finite().nonnegative(),
  memoryBytes: z46.number().finite().nonnegative()
}).strict();
var hostResourceUsageSnapshotResultResponseSchema = z46.object({
  type: z46.literal("resource-usage-snapshot-result"),
  requestId: nonEmptyStringSchema3,
  sampledAt: z46.number().int().nonnegative(),
  processes: z46.array(hostResourceUsageProcessSchema).max(1e4)
}).strict();
var hostResponseMessageSchema = z46.discriminatedUnion("type", [
  z46.object({ type: z46.literal("database-startup-state"), state: databaseStartupStateSchema }).strict(),
  hostResourceUsageSnapshotResultResponseSchema,
  hostRemoteWorkspaceConnectionLogResponseSchema,
  hostRemoteWorkspaceConnectedResponseSchema,
  hostRemoteWorkspaceConnectFailedResponseSchema,
  hostRemoteWorkspaceClosedResponseSchema,
  hostLogResponseSchema,
  hostAgentProcessSpawnedResponseSchema,
  hostAgentProcessReadyResponseSchema,
  hostAgentProcessExitedResponseSchema,
  hostAgentProcessErrorResponseSchema,
  hostAgentProcessExceptionResponseSchema,
  hostAgentResourceSampleResponseSchema,
  hostResourceSampleResponseSchema,
  hostMcpTelemetryResponseSchema,
  hostMcpResourceSamplesResponseSchema,
  hostToolExecResourceResponseSchema,
  hostSessionCreateTelemetryResponseSchema,
  hostAgentRunningTaskCountChangedResponseSchema,
  hostWorkspaceRunningTaskCountChangedResponseSchema,
  hostCuaOperationStateResponseSchema,
  hostBroadcastEnvelopeSchema,
  hostBroadcastClaimRequestResponseSchema,
  hostBroadcastClaimCommitResponseSchema,
  hostBroadcastClaimReleaseResponseSchema,
  hostTaskRealtimePublishResponseSchema,
  hostTaskStreamOpPublishResponseSchema,
  hostTaskRunLeaseAcquireResponseSchema,
  hostTaskRunLeaseReleaseResponseSchema,
  hostTaskOwnerCommandRequestResponseSchema,
  hostTaskOwnerCommandResultResponseSchema,
  hostBotRemoteWorkspaceReconnectRequestResponseSchema,
  hostBotRemoteWorkspaceConnectionStatusRequestResponseSchema,
  hostBotRemoteWorkspaceRuntimePortRequestResponseSchema,
  hostSessionMessageSendRequestedResponseSchema,
  hostSessionRouteAnnounceResponseSchema,
  hostSessionMessageDeliverResultResponseSchema,
  hostFeedbackLogArchiveRequestResponseSchema,
  hostBrowserExecuteRequestResponseSchema,
  hostLocalMediaPreviewPathAuthorizeRequestResponseSchema,
  hostNetworkTelemetryBatchResponseSchema,
  hostProviderProvisioningSourceChangedResponseSchema,
  hostProviderProvisioningExecutionResultResponseSchema,
  hostCronRunResultResponseSchema,
  hostOffPeakRunResultResponseSchema,
  hostCronSchedulerWakeRequestResponseSchema,
  hostOffPeakSchedulerWakeRequestResponseSchema
]);
var zcodeTaskPersistStatusSchema = z46.enum(["running", "completed", "error"]);
var zcodePromptImageAttachmentSchema = z46.object({
  kind: z46.literal("image"),
  filename: z46.string(),
  mimeType: z46.string(),
  sizeBytes: z46.number().int().nonnegative().optional(),
  dataBase64: z46.string().optional(),
  localPath: z46.string().optional()
});
var zcodePromptVideoAttachmentSchema = z46.object({
  kind: z46.literal("video"),
  filename: z46.string(),
  mimeType: z46.string(),
  sizeBytes: z46.number().int().nonnegative().optional(),
  dataBase64: z46.string().optional(),
  localPath: z46.string().optional()
});
var zcodePromptPdfAttachmentSchema = z46.object({
  kind: z46.literal("pdf"),
  filename: z46.string(),
  mimeType: z46.string(),
  sizeBytes: z46.number().int().nonnegative().optional(),
  dataBase64: z46.string().optional(),
  localPath: z46.string().optional()
});
var zcodePromptFileAttachmentSchema = z46.object({
  kind: z46.literal("file"),
  filename: z46.string(),
  mimeType: z46.string(),
  sizeBytes: z46.number().int().nonnegative(),
  dataBase64: z46.string().optional(),
  textContent: z46.string().optional(),
  localPath: z46.string().optional()
});
var zcodePromptAttachmentSchema2 = z46.discriminatedUnion("kind", [
  zcodePromptImageAttachmentSchema,
  zcodePromptVideoAttachmentSchema,
  zcodePromptPdfAttachmentSchema,
  zcodePromptFileAttachmentSchema
]);
var zcodePersistedToolCallSchema = z46.object({
  toolName: z46.string().optional(),
  title: z46.string().optional(),
  kind: z46.string().optional(),
  status: z46.enum(["completed", "failed", "denied", "stopped"]).optional(),
  input: z46.unknown(),
  output: z46.unknown().optional(),
  error: z46.string().optional(),
  raw: z46.unknown().optional(),
  snapshotRefs: z46.array(
    z46.object({
      field: z46.enum(["input", "output", "raw"]),
      refId: z46.string(),
      hash: z46.string(),
      fullBytes: z46.number().int().nonnegative(),
      previewBytes: z46.number().int().nonnegative()
    })
  ).optional()
});
var zcodePersistedMessagePartSchema = z46.discriminatedUnion("type", [
  z46.object({ type: z46.literal("content"), content: z46.string() }),
  z46.object({ type: z46.literal("thought"), content: z46.string() }),
  z46.object({
    type: z46.literal("tool-call"),
    toolIndex: z46.number().int().nonnegative()
  })
]);
var zcodePersistedMessageSchema = z46.object({
  id: z46.string().optional(),
  role: z46.enum(["user", "assistant"]),
  content: z46.string(),
  timestamp: z46.number().int().nonnegative(),
  model: z46.string().optional(),
  characterCount: z46.number().int().nonnegative().optional(),
  // assistant 历史耗时已经在服务层落盘为 durationMs，
  // 但校验 schema 没同步，saveTask/getTaskSnapshot 解析时会把它静默剥掉，
  // 导致新消息结束后 UI 仍然只能看到“Worked”。这里补上字段以保留持久化值。
  durationMs: z46.number().int().nonnegative().optional(),
  interrupted: z46.boolean().optional(),
  feedback: z46.enum(["like", "dislike"]).optional(),
  attachments: z46.array(zcodePromptAttachmentSchema2).optional(),
  tools: z46.array(zcodePersistedToolCallSchema).optional(),
  thought: z46.string().optional(),
  parts: z46.array(zcodePersistedMessagePartSchema).optional(),
  checkpointState: z46.enum(["partial"]).optional(),
  checkpointReason: z46.enum(["tool_completed", "part_boundary", "periodic"]).optional(),
  checkpointUpdatedAt: z46.number().int().nonnegative().optional(),
  turnIndex: z46.number().int().nonnegative().optional(),
  // snapshot 按需加载依赖 bodyRefs（content/thought -> refId）定位完整内容；
  // 若 schema 缺字段，Zod 会在解析 session 文件时静默剥离，导致“加载完整内容”功能失效。
  bodyRefs: z46.array(
    z46.object({
      field: z46.enum(["content", "thought"]),
      refId: z46.string(),
      hash: z46.string(),
      fullBytes: z46.number().int().nonnegative(),
      previewBytes: z46.number().int().nonnegative()
    })
  ).optional(),
  toolSlice: z46.object({
    persistedMessageIndex: z46.number().int().nonnegative(),
    totalTools: z46.number().int().nonnegative(),
    startToolIndex: z46.number().int().nonnegative(),
    endToolIndexExclusive: z46.number().int().nonnegative()
  }).optional()
});
var zcodeTaskGoalStatusSchema = z46.enum(["active", "paused", "budget_limited", "complete"]);
var zcodeTaskTargetChangedActionSchema = z46.enum([
  "set",
  "status_updated",
  "cleared",
  "usage_accounted",
  "run_started",
  "run_finished",
  "summary_updated"
]);
var zcodeTaskTargetChangedSourceSchema = z46.enum(["command", "tool", "runtime"]);
var zcodeTaskGoalSchema = z46.object({
  sessionID: nonEmptyStringSchema3,
  targetID: nonEmptyStringSchema3,
  objective: nonEmptyStringSchema3,
  // 2.15.0 之前的 /goal 历史任务没有写 summaryTitle。
  // 读取 task index 老数据时要补成 null，否则整个任务列表会被运行时 schema 拒绝。
  summaryTitle: z46.string().min(1).nullable().default(null),
  status: zcodeTaskGoalStatusSchema,
  tokenBudget: z46.number().int().positive().nullable(),
  tokensUsed: z46.number().int().nonnegative(),
  timeUsedSeconds: z46.number().int().nonnegative(),
  activeInputId: nonEmptyStringSchema3.nullable().optional(),
  activeRunStartedAtMs: z46.number().int().nonnegative().nullable().optional(),
  activeRunLastSeenAtMs: z46.number().int().nonnegative().nullable().optional(),
  time: z46.object({
    created: z46.number().int().nonnegative(),
    updated: z46.number().int().nonnegative()
  })
});
var zcodeTaskGoalChangedPatchSchema = z46.object({
  action: zcodeTaskTargetChangedActionSchema,
  source: zcodeTaskTargetChangedSourceSchema,
  target: zcodeTaskGoalSchema.nullable(),
  previousTarget: zcodeTaskGoalSchema.nullable().optional()
});
var zcodeTaskMetaSchema = z46.object({
  taskId: nonEmptyStringSchema3,
  traceId: nonEmptyStringSchema3,
  title: z46.string(),
  titleOverridden: z46.boolean().optional(),
  workspacePath: nonEmptyStringSchema3,
  workspaceIdentity: nonEmptyStringSchema3.optional(),
  workspacePurpose: z46.enum(["project", "conversation"]).optional(),
  createdAt: z46.number().int().nonnegative(),
  updatedAt: z46.number().int().nonnegative(),
  mode: zcodeTaskModeSchema,
  model: z46.string().optional(),
  thoughtLevel: nonEmptyStringSchema3.optional(),
  runtimeEpoch: z46.number().int().nonnegative().optional(),
  provider: zcodeAgentProviderSchema.optional(),
  migrationSource: zcodeTaskMigrationSourceSchema.optional(),
  forkedFromTaskId: nonEmptyStringSchema3.optional(),
  // cron automation 身份：随 meta_json 一起持久化（单一来源），同时在写入时投影到 tasks 表
  // cron_automation_id 索引列，供按 automation 反查 session。runId 属于 automation_runs /
  // 投递 metadata，不属于 task 表。
  cronAutomationId: nonEmptyStringSchema3.optional(),
  // off-peak 身份：与 cron 同款持久化策略——meta_json 单一来源 + tasks 表
  // off_peak_task_id 索引投影列（兜底/反查）。
  offPeakTaskId: nonEmptyStringSchema3.optional(),
  unreadAt: z46.number().int().nonnegative().optional(),
  status: zcodeTaskPersistStatusSchema.optional(),
  lastError: z46.object({
    code: z46.string().optional(),
    detail: z46.string().optional(),
    message: z46.string().min(1),
    traceId: nonEmptyStringSchema3.optional(),
    taskId: nonEmptyStringSchema3.optional(),
    attribution: errorAttributionSchema.optional()
  }).optional(),
  changeSummary: z46.object({
    fileCount: z46.number().int().nonnegative(),
    added: z46.number().int().nonnegative(),
    removed: z46.number().int().nonnegative(),
    files: z46.array(
      z46.object({
        path: z46.string(),
        added: z46.number().int().nonnegative(),
        removed: z46.number().int().nonnegative(),
        writeCount: z46.number().int().positive(),
        lastTurnIndex: z46.number().int().nonnegative()
      })
    )
  }).optional(),
  target: zcodeTaskGoalSchema.nullable().optional()
});
var zcodeTaskIndexEntrySchema = z46.object({
  workspaceHash: nonEmptyStringSchema3,
  taskId: nonEmptyStringSchema3
});
var zcodePinnedTasksFileSchema = z46.object({
  version: z46.literal("1"),
  tasks: z46.array(zcodeTaskIndexEntrySchema)
});
var zcodePersistedFileSnapshotSchema = z46.object({
  path: z46.string(),
  beforeContent: z46.string().nullable(),
  afterContent: z46.string(),
  writeCount: z46.number().int().positive(),
  contentRefs: z46.array(
    z46.object({
      field: z46.enum(["beforeContent", "afterContent"]),
      refId: z46.string(),
      hash: z46.string(),
      fullBytes: z46.number().int().nonnegative(),
      previewBytes: z46.number().int().nonnegative()
    })
  ).optional()
});
var zcodePersistedFileChangeSchema = z46.object({
  turnIndex: z46.number().int().nonnegative(),
  snapshots: z46.array(zcodePersistedFileSnapshotSchema),
  fileState: z46.enum(["applied", "reverted"]).optional()
});
var zcodePersistedTurnCheckpointSchema = z46.object({
  turnIndex: z46.number().int().nonnegative(),
  baseFileCheckpointId: nonEmptyStringSchema3,
  resultFileCheckpointId: nonEmptyStringSchema3.optional()
});
var zcodeSessionFileSchema = z46.object({
  meta: zcodeTaskMetaSchema,
  messages: z46.array(zcodePersistedMessageSchema),
  fileChanges: z46.array(zcodePersistedFileChangeSchema).optional(),
  turnCheckpoints: z46.array(zcodePersistedTurnCheckpointSchema).optional()
});

// facade-logger:logger
var logger = { info() {
}, warn() {
} };

// ../reference/ZCode/packages/desktop/src/main/taskRealtimeBus.ts
var STREAM_MIRROR_FLUSH_INTERVAL_MS = 1e3;
var STREAM_MIRROR_MAX_REPLAY_BATCHES = 60;
var STREAM_MIRROR_MAX_REPLAY_BYTES = 512 * 1024;
var STREAM_MIRROR_MAX_BATCH_BYTES = 512 * 1024;
var STREAM_MIRROR_TEXT_OP_MAX_CHARS = 128 * 1024;
var OWNER_COMMAND_TIMEOUT_MS = 3e4;
var SESSION_MESSAGE_DELIVERY_TIMEOUT_MS = 3e4;
var TaskRealtimeBus = class {
  logger;
  seenEventLimit;
  hosts = /* @__PURE__ */ new Map();
  seenEventIds = /* @__PURE__ */ new Set();
  seenEventOrder = [];
  leases = /* @__PURE__ */ new Map();
  streamBatches = /* @__PURE__ */ new Map();
  pendingOwnerCommands = /* @__PURE__ */ new Map();
  sessionRoutes = /* @__PURE__ */ new Map();
  pendingSessionMessageDeliveries = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    this.logger = options.logger ?? logger;
    this.seenEventLimit = options.seenEventLimit ?? 1e3;
  }
  registerHost(params) {
    const existing = this.hosts.get(params.hostId);
    if (existing) {
      this.unregisterHost(params.hostId);
    }
    const onMessage = (message) => {
      this.handleHostMessage(params.hostId, message);
    };
    const onExit = () => {
      this.unregisterHost(params.hostId);
    };
    params.child.on("message", onMessage);
    params.child.once("exit", onExit);
    const workspaceKeys = new Set(params.workspaceKeys);
    const deliveryKind = params.deliveryKind ?? "desktop_window";
    this.hosts.set(params.hostId, {
      hostId: params.hostId,
      windowId: params.windowId,
      child: params.child,
      workspaceKeys,
      deliveryKind,
      onMessage,
      onExit
    });
    this.logger.info("[task-realtime] registered host", {
      hostId: params.hostId,
      windowId: params.windowId,
      workspaceKeyCount: workspaceKeys.size,
      deliveryKind
    });
    this.replayVisibleRunsToHost(params.hostId, workspaceKeys);
  }
  unregisterHost(hostId) {
    const registered = this.hosts.get(hostId);
    if (!registered) {
      return;
    }
    registered.child.off?.("message", registered.onMessage);
    registered.child.off?.("exit", registered.onExit);
    this.hosts.delete(hostId);
    this.failPendingOwnerCommandsForHost(hostId, "Owner command host exited.");
    this.unregisterSessionRoutesForHost(hostId);
    this.failPendingSessionMessagesForHost(hostId, "Session message host exited.");
    const releasedLeases = this.releaseLeasesForHost(hostId);
    for (const lease of releasedLeases) {
      this.deliverSnapshotInvalidation(lease, hostId, "stream_mirror_owner_lost");
    }
    this.logger.info("[task-realtime] unregistered host", {
      hostId,
      windowId: registered.windowId
    });
  }
  updateHostWorkspaceKeys(hostId, workspaceKeys) {
    const registered = this.hosts.get(hostId);
    if (!registered) {
      this.logger.warn("[task-realtime] workspace update for unknown host", { hostId });
      return;
    }
    const previous = registered.workspaceKeys;
    const next = new Set(workspaceKeys);
    registered.workspaceKeys = next;
    this.logger.info("[task-realtime] updated host workspace scopes", {
      hostId,
      workspaceKeyCount: registered.workspaceKeys.size
    });
    this.replayVisibleRunsToHost(
      hostId,
      [...next].filter((workspaceKey) => !previous.has(workspaceKey))
    );
  }
  getHostDeliveryKindForTest(hostId) {
    return this.hosts.get(hostId)?.deliveryKind;
  }
  handleHostMessage(hostId, message) {
    const parsed = hostResponseMessageSchema.safeParse(message);
    if (!parsed.success) {
      this.logger.warn(
        "[task-realtime] invalid host response message:",
        formatZodError(parsed.error)
      );
      return;
    }
    const origin = this.hosts.get(hostId);
    if (!origin) {
      this.logger.warn("[task-realtime] publish from unknown host", { hostId });
      return;
    }
    switch (parsed.data.type) {
      case HostResponseTypes.TaskRealtimePublish:
        this.handleRealtimePublish(origin, parsed.data.event);
        break;
      case HostResponseTypes.TaskRunLeaseAcquire:
        this.handleLeaseAcquire(origin, parsed.data.request);
        break;
      case HostResponseTypes.TaskRunLeaseRelease:
        this.releaseLease(origin.hostId, parsed.data.target);
        break;
      case HostResponseTypes.TaskStreamOpPublish:
        this.handleStreamOpPublish(origin, parsed.data.target, parsed.data.op);
        break;
      case HostResponseTypes.TaskOwnerCommandRequest:
        this.handleOwnerCommandRequest(origin, parsed.data.command);
        break;
      case HostResponseTypes.TaskOwnerCommandResult:
        this.handleOwnerCommandResult(origin, parsed.data.result);
        break;
      case HostResponseTypes.SessionMessageSendRequested:
        this.handleSessionMessageSendRequested(origin, parsed.data.request);
        break;
      case HostResponseTypes.SessionRouteAnnounce:
        this.rememberSessionRoute(origin, parsed.data.route);
        break;
      case HostResponseTypes.SessionMessageDeliverResult:
        this.handleSessionMessageDeliverResult(origin, parsed.data.result);
        break;
      default:
        break;
    }
  }
  rememberSessionRoute(origin, route) {
    this.sessionRoutes.set(route.sessionId, origin.hostId);
  }
  handleRealtimePublish(origin, event) {
    if (!this.rememberEventId(event.eventId)) {
      return;
    }
    this.flushMatchingStreamBatchBeforeInvalidation(event);
    this.deliverRealtimeEvent({ ...event, originHostId: origin.hostId }, () => true);
  }
  handleLeaseAcquire(origin, request) {
    origin.child.postMessage({
      type: HostMessageTypes.TaskRunLeaseResult,
      result: this.acquireLease(origin.hostId, request)
    });
  }
  getLeaseKey(workspaceKey, taskId) {
    return `${workspaceKey}\0${taskId}`;
  }
  getBatchKey(workspaceKey, taskId, runId) {
    return `${this.getLeaseKey(workspaceKey, taskId)}\0${runId}`;
  }
  acquireLease(hostId, request) {
    const key = this.getLeaseKey(request.workspaceKey, request.taskId);
    const existing = this.leases.get(key);
    if (existing && (existing.ownerHostId !== hostId || existing.runId !== request.runId)) {
      return {
        leaseRequestId: request.leaseRequestId,
        acquired: false,
        ownerHostId: existing.ownerHostId,
        reason: "owned_by_other_host"
      };
    }
    const now = Date.now();
    this.leases.set(key, {
      key,
      workspaceKey: request.workspaceKey,
      workspacePath: request.workspacePath,
      workspaceIdentity: request.workspaceIdentity,
      taskId: request.taskId,
      runId: request.runId,
      traceId: request.traceId,
      ownerClientId: request.ownerClientId,
      ownerDeviceLabel: request.ownerDeviceLabel,
      ownerHostId: hostId,
      acquiredAt: existing?.acquiredAt ?? now,
      updatedAt: now
    });
    this.logger.info("[task-realtime] task run lease acquired", {
      hostId,
      workspaceKey: request.workspaceKey,
      taskId: request.taskId,
      runId: request.runId
    });
    return { leaseRequestId: request.leaseRequestId, acquired: true, ownerHostId: hostId };
  }
  /** 内存诊断计数器；只读 size。 */
  collectMemoryDiagnostics() {
    return {
      streamBatches: this.streamBatches.size,
      leases: this.leases.size,
      sessionRoutes: this.sessionRoutes.size
    };
  }
  releaseLease(hostId, target) {
    const key = this.getLeaseKey(target.workspaceKey, target.taskId);
    const existing = this.leases.get(key);
    if (!existing || existing.ownerHostId !== hostId || existing.runId !== target.runId) {
      return;
    }
    this.flushBatch(this.getBatchKey(target.workspaceKey, target.taskId, target.runId), true);
    this.leases.delete(key);
    this.logger.info("[task-realtime] task run lease released", {
      hostId,
      workspaceKey: target.workspaceKey,
      taskId: target.taskId,
      runId: target.runId
    });
  }
  releaseLeasesForHost(hostId) {
    const released = [];
    for (const [key, lease] of this.leases) {
      if (lease.ownerHostId !== hostId) {
        continue;
      }
      this.flushBatch(this.getBatchKey(lease.workspaceKey, lease.taskId, lease.runId), true);
      this.leases.delete(key);
      released.push(lease);
    }
    return released;
  }
  handleStreamOpPublish(origin, target, op) {
    const lease = this.leases.get(this.getLeaseKey(target.workspaceKey, target.taskId));
    if (!lease || lease.ownerHostId !== origin.hostId || lease.runId !== target.runId) {
      return;
    }
    const batchKey = this.getBatchKey(target.workspaceKey, target.taskId, target.runId);
    const batch = this.getOrCreateBatch(batchKey, origin.hostId, target);
    batch.pendingOps.push(op);
    if (this.isTerminalOrImmediateOp(op)) {
      this.flushBatch(batchKey, true);
      if (op.kind === "stream_event" && this.isTerminalEventType(op.event.type)) {
        this.leases.delete(this.getLeaseKey(target.workspaceKey, target.taskId));
      }
      return;
    }
    if (!batch.timer) {
      batch.timer = setTimeout(() => {
        batch.timer = null;
        this.flushBatch(batchKey, false);
      }, STREAM_MIRROR_FLUSH_INTERVAL_MS);
    }
  }
  getOrCreateBatch(batchKey, ownerHostId, target) {
    let batch = this.streamBatches.get(batchKey);
    if (batch) {
      return batch;
    }
    batch = {
      batchKey,
      workspaceKey: target.workspaceKey,
      workspacePath: target.workspacePath,
      workspaceIdentity: target.workspaceIdentity,
      taskId: target.taskId,
      runId: target.runId,
      traceId: target.traceId,
      ownerClientId: target.ownerClientId,
      ownerDeviceLabel: target.ownerDeviceLabel,
      ownerHostId,
      nextBatchSeq: 1,
      nextOpSeq: 1,
      pendingOps: [],
      replay: [],
      replayUnavailable: false,
      timer: null,
      replayInitializedHostIds: /* @__PURE__ */ new Set()
    };
    this.streamBatches.set(batchKey, batch);
    return batch;
  }
  flushMatchingStreamBatchBeforeInvalidation(event) {
    if (event.type === "task_stream_mirror_batch" || !("taskId" in event) || !event.taskId || event.reason !== "user_message_saved" && event.reason !== "assistant_message_saved" && event.reason !== "task_status_changed") {
      return;
    }
    this.flushBatch(this.getBatchKey(event.workspaceKey, event.taskId, event.traceId), true);
  }
  flushBatch(batchKey, force) {
    const batch = this.streamBatches.get(batchKey);
    if (!batch || batch.pendingOps.length === 0) {
      return;
    }
    if (!force && batch.pendingOps.length === 0) {
      return;
    }
    if (batch.timer) {
      clearTimeout(batch.timer);
      batch.timer = null;
    }
    const coalesced = this.splitLargeTextOps(this.coalesceOps(batch.pendingOps));
    batch.pendingOps = [];
    const ops = coalesced.map((op) => ({
      ...op,
      seq: batch.nextOpSeq++
    }));
    const event = {
      type: "task_stream_mirror_batch",
      eventId: `stream-${batch.workspaceKey}-${batch.taskId}-${batch.runId}-${batch.nextBatchSeq}`,
      workspacePath: batch.workspacePath,
      workspaceIdentity: batch.workspaceIdentity,
      workspaceKey: batch.workspaceKey,
      traceId: batch.traceId,
      createdAt: Date.now(),
      taskId: batch.taskId,
      runId: batch.runId,
      ownerClientId: batch.ownerClientId,
      ownerDeviceLabel: batch.ownerDeviceLabel,
      batchSeq: batch.nextBatchSeq++,
      fromSeq: ops[0]?.seq ?? batch.nextOpSeq,
      toSeq: ops[ops.length - 1]?.seq ?? batch.nextOpSeq - 1,
      ops,
      terminal: ops.some(
        (op) => op.kind === "stream_event" && this.isTerminalEventType(op.event.type)
      )
    };
    if (JSON.stringify(event).length > STREAM_MIRROR_MAX_BATCH_BYTES) {
      this.deliverOversizedStreamBatchFallback(batch, event);
      return;
    }
    this.rememberReplayBatch(batch, event);
    this.deliverStreamBatch(batch, event);
    if (event.terminal) {
      this.streamBatches.delete(batchKey);
    }
  }
  deliverOversizedStreamBatchFallback(batch, event) {
    batch.replayUnavailable = true;
    batch.replay = [];
    for (const chunk of this.splitOversizedBatchForOwner(batch, event)) {
      this.deliverStreamBatchToHost(batch.ownerHostId, batch, chunk, "relay_owner");
    }
    this.deliverSnapshotInvalidation(
      this.batchToLeaseLike(batch),
      batch.ownerHostId,
      "stream_mirror_gap",
      void 0,
      { runId: event.runId, opSeq: event.toSeq }
    );
    if (event.terminal) {
      this.streamBatches.delete(batch.batchKey);
    }
  }
  splitOversizedBatchForOwner(batch, event) {
    const chunks = [];
    let pendingOps = [];
    const createChunk = (ops, batchSeq) => ({
      ...event,
      eventId: `stream-${batch.workspaceKey}-${batch.taskId}-${batch.runId}-${batchSeq}`,
      batchSeq,
      fromSeq: ops[0]?.seq ?? event.fromSeq,
      toSeq: ops[ops.length - 1]?.seq ?? event.toSeq,
      ops,
      terminal: ops.some(
        (op) => op.kind === "stream_event" && this.isTerminalEventType(op.event.type)
      )
    });
    const flushPending = () => {
      if (pendingOps.length === 0) {
        return;
      }
      chunks.push(createChunk(pendingOps, batch.nextBatchSeq++));
      pendingOps = [];
    };
    for (const op of event.ops) {
      const candidate = [...pendingOps, op];
      const candidateChunk = createChunk(candidate, batch.nextBatchSeq);
      if (pendingOps.length > 0 && JSON.stringify(candidateChunk).length > STREAM_MIRROR_MAX_BATCH_BYTES) {
        flushPending();
      }
      pendingOps.push(op);
    }
    flushPending();
    return chunks;
  }
  coalesceOps(ops) {
    const coalesced = [];
    for (const op of ops) {
      const previous = coalesced[coalesced.length - 1];
      if (this.canMergeTextChunk(previous, op)) {
        coalesced[coalesced.length - 1] = {
          kind: "stream_event",
          event: {
            ...previous.event,
            content: previous.event.content + op.event.content
          }
        };
        continue;
      }
      if (previous?.kind === "stream_event" && op.kind === "stream_event" && this.isRedundantStateEvent(op.event.type) && previous.event.type === op.event.type && previous.event.taskId === op.event.taskId) {
        coalesced[coalesced.length - 1] = op;
        continue;
      }
      coalesced.push(op);
    }
    return coalesced;
  }
  splitLargeTextOps(ops) {
    const splitOps = [];
    for (const op of ops) {
      if (op.kind !== "stream_event" || op.event.type !== "agent_message_chunk" && op.event.type !== "agent_thought_chunk" || op.event.content.length <= STREAM_MIRROR_TEXT_OP_MAX_CHARS) {
        splitOps.push(op);
        continue;
      }
      for (let offset = 0; offset < op.event.content.length; offset += STREAM_MIRROR_TEXT_OP_MAX_CHARS) {
        splitOps.push({
          kind: "stream_event",
          event: {
            ...op.event,
            content: op.event.content.slice(offset, offset + STREAM_MIRROR_TEXT_OP_MAX_CHARS)
          }
        });
      }
    }
    return splitOps;
  }
  canMergeTextChunk(previous, op) {
    return previous?.kind === "stream_event" && op.kind === "stream_event" && (op.event.type === "agent_message_chunk" || op.event.type === "agent_thought_chunk") && previous.event.type === op.event.type && previous.event.taskId === op.event.taskId && previous.event.traceId === op.event.traceId && "content" in previous.event && "content" in op.event && typeof previous.event.content === "string" && typeof op.event.content === "string";
  }
  isRedundantStateEvent(type) {
    return type === "usage_update" || type === "session_info_update" || type === "plan";
  }
  isTerminalEventType(type) {
    return type === "task_complete" || type === "task_error";
  }
  isTerminalOrImmediateOp(op) {
    return op.kind === "stream_event" && (op.event.type === "permission_request" || this.isTerminalEventType(op.event.type));
  }
  deliverStreamBatch(batch, event) {
    for (const target of this.hosts.values()) {
      if (!target.workspaceKeys.has(batch.workspaceKey)) {
        continue;
      }
      target.child.postMessage({
        type: HostMessageTypes.TaskRealtimeDeliver,
        event: {
          ...event,
          originHostId: batch.ownerHostId,
          // owner 和 observer 以前消费两条不同事件源：owner 走不可重放 direct event，
          // observer 走 mirror batch。切换 task 或跨端 relay 时两边会因为事件丢失/乱序产生分叉。
          // 这里统一把 mirror batch 回投给 owner，让所有 renderer 都按同一条 seq 流更新 task store。
          deliveryPurpose: target.hostId === batch.ownerHostId ? "relay_owner" : "observer"
        }
      });
    }
  }
  deliverStreamBatchToHost(hostId, batch, event, deliveryPurpose) {
    const target = this.hosts.get(hostId);
    if (!target?.workspaceKeys.has(batch.workspaceKey)) {
      return;
    }
    target.child.postMessage({
      type: HostMessageTypes.TaskRealtimeDeliver,
      event: {
        ...event,
        originHostId: batch.ownerHostId,
        deliveryPurpose
      }
    });
  }
  rememberReplayBatch(batch, event) {
    batch.replay.push(event);
    while (batch.replay.length > STREAM_MIRROR_MAX_REPLAY_BATCHES) {
      batch.replay.shift();
    }
    while (this.replayBytes(batch.replay) > STREAM_MIRROR_MAX_REPLAY_BYTES) {
      batch.replay.shift();
    }
  }
  replayBytes(replay) {
    return replay.reduce((total, replayEvent) => total + JSON.stringify(replayEvent).length, 0);
  }
  replayVisibleRunsToHost(hostId, workspaceKeys) {
    const host = this.hosts.get(hostId);
    if (!host) {
      return;
    }
    const visible = new Set(workspaceKeys);
    for (const batch of this.streamBatches.values()) {
      if (!visible.has(batch.workspaceKey)) {
        continue;
      }
      const replayKey = `${hostId}\0${batch.workspaceKey}\0${batch.taskId}\0${batch.runId}`;
      if (batch.replayInitializedHostIds.has(replayKey)) {
        continue;
      }
      batch.replayInitializedHostIds.add(replayKey);
      if (batch.replayUnavailable || batch.replay.length === 0 || batch.replay[0]?.fromSeq !== 1) {
        this.deliverSnapshotInvalidation(
          this.batchToLeaseLike(batch),
          batch.ownerHostId,
          "stream_mirror_gap",
          hostId,
          this.getReplaySnapshotWatermark(batch)
        );
        continue;
      }
      for (const event of batch.replay) {
        host.child.postMessage({
          type: HostMessageTypes.TaskRealtimeDeliver,
          event: { ...event, originHostId: batch.ownerHostId, deliveryPurpose: "observer" }
        });
      }
    }
  }
  batchToLeaseLike(batch) {
    return {
      key: this.getLeaseKey(batch.workspaceKey, batch.taskId),
      workspaceKey: batch.workspaceKey,
      workspacePath: batch.workspacePath,
      workspaceIdentity: batch.workspaceIdentity,
      taskId: batch.taskId,
      runId: batch.runId,
      traceId: batch.traceId,
      ownerClientId: batch.ownerClientId,
      ownerDeviceLabel: batch.ownerDeviceLabel,
      ownerHostId: batch.ownerHostId,
      acquiredAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  deliverSnapshotInvalidation(lease, originHostId, reason, onlyHostId, streamWatermark) {
    this.deliverRealtimeEvent(
      {
        type: "task_snapshot_invalidated",
        eventId: `${reason}-${lease.workspaceKey}-${lease.taskId}-${lease.runId}-${Date.now()}`,
        workspacePath: lease.workspacePath,
        workspaceIdentity: lease.workspaceIdentity,
        workspaceKey: lease.workspaceKey,
        reason,
        traceId: lease.traceId,
        createdAt: Date.now(),
        taskId: lease.taskId,
        ...streamWatermark ? { streamWatermark } : {},
        originHostId
      },
      (target) => onlyHostId ? target.hostId === onlyHostId : target.hostId !== originHostId
    );
  }
  getReplaySnapshotWatermark(batch) {
    return {
      runId: batch.runId,
      opSeq: batch.replay.at(-1)?.toSeq ?? Math.max(batch.nextOpSeq - 1, 0)
    };
  }
  deliverRealtimeEvent(delivered, shouldDeliver) {
    for (const target of this.hosts.values()) {
      if (!shouldDeliver(target) || !target.workspaceKeys.has(delivered.workspaceKey)) {
        continue;
      }
      target.child.postMessage({
        type: HostMessageTypes.TaskRealtimeDeliver,
        event: delivered
      });
    }
  }
  handleOwnerCommandRequest(requester, command) {
    const lease = this.leases.get(this.getLeaseKey(command.workspaceKey, command.taskId));
    if (!lease) {
      this.postOwnerCommandResult(requester.hostId, {
        commandRequestId: command.commandRequestId,
        success: false,
        error: "No active task owner.",
        code: "NO_ACTIVE_TASK_OWNER"
      });
      return;
    }
    if (lease.runId !== command.runId) {
      this.postOwnerCommandResult(requester.hostId, {
        commandRequestId: command.commandRequestId,
        success: false,
        error: "Stale task owner command.",
        code: "STALE_TASK_OWNER_COMMAND"
      });
      return;
    }
    const owner = this.hosts.get(lease.ownerHostId);
    if (!owner) {
      this.postOwnerCommandResult(requester.hostId, {
        commandRequestId: command.commandRequestId,
        success: false,
        error: "No active task owner.",
        code: "NO_ACTIVE_TASK_OWNER"
      });
      return;
    }
    const timeout = setTimeout(() => {
      this.pendingOwnerCommands.delete(command.commandRequestId);
      this.postOwnerCommandResult(requester.hostId, {
        commandRequestId: command.commandRequestId,
        success: false,
        error: "Owner command timed out.",
        code: "OWNER_COMMAND_FAILED"
      });
    }, OWNER_COMMAND_TIMEOUT_MS);
    this.pendingOwnerCommands.set(command.commandRequestId, {
      commandRequestId: command.commandRequestId,
      requesterHostId: requester.hostId,
      ownerHostId: owner.hostId,
      createdAt: Date.now(),
      timeout
    });
    owner.child.postMessage({
      type: HostMessageTypes.TaskOwnerCommandDeliver,
      command: { ...command, requesterHostId: requester.hostId }
    });
  }
  handleOwnerCommandResult(owner, result) {
    const pending = this.pendingOwnerCommands.get(result.commandRequestId);
    if (!pending || pending.ownerHostId !== owner.hostId) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pendingOwnerCommands.delete(result.commandRequestId);
    this.postOwnerCommandResult(pending.requesterHostId, result);
  }
  postOwnerCommandResult(hostId, result) {
    this.hosts.get(hostId)?.child.postMessage({
      type: HostMessageTypes.TaskOwnerCommandResult,
      result
    });
  }
  handleSessionMessageSendRequested(source, request) {
    const targetHostId = this.sessionRoutes.get(request.toSessionId);
    if (!targetHostId) {
      this.postSessionMessageDeliveryResult(source.hostId, {
        error: `target session not found: ${request.toSessionId}`,
        messageId: request.messageId,
        requestId: request.requestId,
        sessionId: request.fromSessionId,
        status: "failed"
      });
      return;
    }
    const target = this.hosts.get(targetHostId);
    if (!target) {
      this.sessionRoutes.delete(request.toSessionId);
      this.postSessionMessageDeliveryResult(source.hostId, {
        error: `target host not found for session: ${request.toSessionId}`,
        messageId: request.messageId,
        requestId: request.requestId,
        sessionId: request.fromSessionId,
        status: "failed"
      });
      return;
    }
    const existing = this.pendingSessionMessageDeliveries.get(request.requestId);
    if (existing) {
      clearTimeout(existing.timeout);
      this.pendingSessionMessageDeliveries.delete(request.requestId);
    }
    const timeout = setTimeout(() => {
      this.pendingSessionMessageDeliveries.delete(request.requestId);
      this.postSessionMessageDeliveryResult(source.hostId, {
        error: "Session message delivery timed out.",
        messageId: request.messageId,
        requestId: request.requestId,
        sessionId: request.fromSessionId,
        status: "failed"
      });
    }, SESSION_MESSAGE_DELIVERY_TIMEOUT_MS);
    this.pendingSessionMessageDeliveries.set(request.requestId, {
      request,
      sourceHostId: source.hostId,
      targetHostId: target.hostId,
      timeout
    });
    target.child.postMessage({
      type: HostMessageTypes.SessionMessageDeliver,
      request
    });
  }
  handleSessionMessageDeliverResult(target, result) {
    const pending = this.pendingSessionMessageDeliveries.get(result.requestId);
    if (!pending || pending.targetHostId !== target.hostId) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pendingSessionMessageDeliveries.delete(result.requestId);
    this.postSessionMessageDeliveryResult(pending.sourceHostId, result);
  }
  postSessionMessageDeliveryResult(hostId, result) {
    this.hosts.get(hostId)?.child.postMessage({
      type: HostMessageTypes.SessionMessageDeliveryResult,
      result
    });
  }
  unregisterSessionRoutesForHost(hostId) {
    for (const [sessionId, routeHostId] of this.sessionRoutes) {
      if (routeHostId === hostId) {
        this.sessionRoutes.delete(sessionId);
      }
    }
  }
  failPendingSessionMessagesForHost(hostId, error) {
    const pendingDeliveries = Array.from(this.pendingSessionMessageDeliveries);
    for (const [requestId, pending] of pendingDeliveries) {
      if (pending.sourceHostId !== hostId && pending.targetHostId !== hostId) {
        continue;
      }
      clearTimeout(pending.timeout);
      this.pendingSessionMessageDeliveries.delete(requestId);
      if (pending.sourceHostId !== hostId) {
        this.postSessionMessageDeliveryResult(pending.sourceHostId, {
          error,
          messageId: pending.request.messageId,
          requestId,
          sessionId: pending.request.fromSessionId,
          status: "failed"
        });
      }
    }
  }
  failPendingOwnerCommandsForHost(hostId, error) {
    const pendingCommands = Array.from(this.pendingOwnerCommands);
    for (const [commandRequestId, pending] of pendingCommands) {
      if (pending.ownerHostId !== hostId && pending.requesterHostId !== hostId) {
        continue;
      }
      clearTimeout(pending.timeout);
      this.pendingOwnerCommands.delete(commandRequestId);
      if (pending.requesterHostId !== hostId) {
        this.postOwnerCommandResult(pending.requesterHostId, {
          commandRequestId,
          success: false,
          error,
          code: "OWNER_COMMAND_FAILED"
        });
      }
    }
  }
  rememberEventId(eventId) {
    if (this.seenEventIds.has(eventId)) {
      return false;
    }
    this.seenEventIds.add(eventId);
    this.seenEventOrder.push(eventId);
    while (this.seenEventOrder.length > this.seenEventLimit) {
      const removed = this.seenEventOrder.shift();
      if (removed) {
        this.seenEventIds.delete(removed);
      }
    }
    return true;
  }
};
export {
  TaskRealtimeBus
};
