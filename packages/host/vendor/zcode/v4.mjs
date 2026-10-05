/*! Derived from ZCode @29628c9acdb81b703bbd4080c207a0e7ce5e276e; Copyright 2026 Z.AI Co., Ltd. Apache-2.0 (LICENSE).
 * Modified: selective ESM bundle of shared schemas/pure functions, TypeScript erased; services excluded.
 * Regenerate with scripts/vendor-v4.mjs; see SOURCES.json for provenance. */

// ../reference/ZCode/packages/shared/src/localTtft.ts
import { z } from "zod";
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
var diagnosticTime = z.number().finite().nonnegative();
var localTtftDetailSchema = z.object({
  id: z.string().min(1).max(128),
  stage: z.enum([...LOCAL_TTFT_PREPARATION_STAGES, "attempt", "retry_wait", "user_confirmation"]),
  start: diagnosticTime,
  end: diagnosticTime.optional(),
  outcome: z.enum(["completed", "failed", "cancelled", "first_output"]).optional(),
  requestId: z.string().min(1).max(128).optional(),
  logicalCallId: z.string().min(1).max(128).optional(),
  role: z.enum(["response", "preparation"]).optional(),
  source: z.enum(["renderer", "cli"])
}).strict().refine((value) => value.end === void 0 || value.end >= value.start);
var time = z.number().finite().nonnegative();
var identifier = z.string().min(1).max(128);
var localTtftContextSchema = z.object({ version: z.literal(1), observationId: z.string().uuid() }).strict();
var localTtftClockSchema = z.object({ instanceId: identifier, receivedAt: time, sentAt: time }).strict();
var localTtftOutputKindSchema = z.enum(["text", "reasoning", "tool"]);
var localTtftFactsSchema = z.object({
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
  details: z.array(localTtftDetailSchema).max(LOCAL_TTFT_MAX_DETAILS).optional(),
  truncated: z.boolean().optional(),
  revision: z.number().int().nonnegative().optional(),
  sendMode: z.enum(["idle", "queued", "guided"]).optional(),
  clockInvalid: z.boolean().optional(),
  receivedAt: time,
  admittedAt: time.optional(),
  executionAt: time.optional(),
  requestAt: time.optional(),
  outputAt: time.optional(),
  outputKind: localTtftOutputKindSchema.optional(),
  terminal: z.enum(["completed", "failed", "cancelled", "rejected", "interrupted"]).optional(),
  excluded: z.enum(["busy", "retry", "unsupported", "failed", "capacity"]).optional()
}).strict();
var localTtftIntervalSchema = z.object({
  stage: z.enum(LOCAL_TTFT_STAGES),
  start: time,
  end: time,
  source: z.enum(["renderer", "cli", "aligned"])
}).strict().refine((interval) => interval.end >= interval.start);
var localTtftRecordSchema = z.object({
  version: z.literal(1),
  observationId: z.string().uuid(),
  commandId: identifier.optional(),
  sessionId: identifier.optional(),
  turnId: identifier.optional(),
  productTurnId: identifier.optional(),
  queryId: identifier.optional(),
  requestId: identifier.optional(),
  logicalCallId: identifier.optional(),
  cliVersion: identifier.optional(),
  cliInstanceId: identifier.optional(),
  kind: z.enum(["start", "first_output", "first_text", "no_text", "excluded", "checkpoint"]),
  outcome: z.enum([
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
  quality: z.enum(["complete", "missing", "clock_invalid"]),
  clockErrorMs: time.optional(),
  intervals: z.array(localTtftIntervalSchema).max(6),
  checkpointId: identifier.optional(),
  details: z.array(localTtftDetailSchema).max(LOCAL_TTFT_MAX_DETAILS).optional(),
  truncated: z.boolean().optional(),
  sendMode: z.enum(["idle", "queued", "guided"]).optional(),
  visibility: z.enum(["foreground", "background", "background_returned"]).optional(),
  visibilityChanges: z.array(z.object({ at: time, foreground: z.boolean() }).strict()).max(32).optional(),
  userWaitMs: time.optional(),
  executionMs: time.optional(),
  timingReliable: z.boolean().optional(),
  cliTimingReliable: z.boolean().optional(),
  provider: identifier.optional(),
  model: identifier.optional()
}).strict().refine((record) => record.end >= record.start);
var localTtftBatchSchema = z.object({
  version: z.literal(1),
  rendererInstanceId: identifier,
  sequence: z.number().int().nonnegative(),
  records: z.array(localTtftRecordSchema).max(32),
  dropped: z.number().int().nonnegative()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/command.ts
import { z as z50 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/core.ts
import { z as z2 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-media-policy.ts
var VIDEO_INPUT_MAX_BYTES = 30 * 1024 * 1024;

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/core.ts
var V4_WIRE_PROTOCOL_VERSION = 3;
var conversationRowTargetSchema = z2.object({
  rowId: z2.number().int().nonnegative(),
  entityId: z2.string().trim().min(1)
}).strict();
var timestampSchema = z2.number();
var streamablePathSchema = z2.enum(["text", "inputText", "output.text", "summaryText"]);
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
import { z as z3 } from "zod";
var attachmentRefSchema = z3.object({
  ref: z3.string(),
  fileName: z3.string(),
  mime: z3.string(),
  bytes: z3.number(),
  previewRef: z3.string().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/transport.ts
import { z as z30 } from "zod";

// ../reference/ZCode/packages/shared/src/usage-stats.ts
import { z as z4 } from "zod";
var APP_USAGE_RANGES = ["all", "7d", "30d"];
var appUsageFavoriteModelSchema = z4.object({
  modelId: z4.string().nullable(),
  totalTokens: z4.number(),
  share: z4.number()
});
var appUsageSummarySchema = z4.object({
  totalTokens: z4.number(),
  inputTokens: z4.number(),
  outputTokens: z4.number(),
  reasoningTokens: z4.number(),
  cacheCreationTokens: z4.number(),
  cacheReadTokens: z4.number(),
  cacheHitRate: z4.number(),
  totalSessions: z4.number(),
  totalTurns: z4.number(),
  toolCallCount: z4.number(),
  toolErrorRate: z4.number(),
  modelErrorRate: z4.number(),
  avgTimeToFirstTokenMs: z4.number().nullable(),
  avgTurnDurationMs: z4.number().nullable(),
  activeDays: z4.number(),
  currentStreakDays: z4.number(),
  longestSessionMs: z4.number(),
  longestStreakDays: z4.number(),
  peakDayTokens: z4.number(),
  favoriteModel: appUsageFavoriteModelSchema.nullable()
});
var appUsageHeatmapCellSchema = z4.object({
  date: z4.string(),
  level: z4.union([z4.literal(0), z4.literal(1), z4.literal(2), z4.literal(3), z4.literal(4)]),
  totalTokens: z4.number(),
  turnCount: z4.number(),
  toolCallCount: z4.number()
});
var appUsageHeatmapWeekSchema = z4.object({
  weekIndex: z4.number(),
  days: z4.array(appUsageHeatmapCellSchema.nullable())
});
var appUsageHeatmapSchema = z4.object({
  startDate: z4.string().nullable(),
  endDate: z4.string().nullable(),
  maxTokens: z4.number(),
  weeks: z4.array(appUsageHeatmapWeekSchema)
});
var appUsageDailyModelItemSchema = z4.object({
  modelId: z4.string().nullable(),
  totalTokens: z4.number()
});
var appUsageDailyModelUsageSchema = z4.object({
  date: z4.string(),
  models: z4.array(appUsageDailyModelItemSchema)
});
var appUsageModelUsageSchema = z4.object({
  modelId: z4.string().nullable(),
  totalTokens: z4.number(),
  inputTokens: z4.number(),
  outputTokens: z4.number(),
  requestCount: z4.number(),
  share: z4.number()
});
var appUsageToolUsageSchema = z4.object({
  toolName: z4.string(),
  callCount: z4.number(),
  errorCount: z4.number(),
  errorRate: z4.number(),
  avgDurationMs: z4.number().nullable()
});
var appUsageSnapshotSchema = z4.object({
  range: z4.enum(APP_USAGE_RANGES),
  generatedAt: z4.number(),
  timeZone: z4.string(),
  source: z4.literal("agent-db"),
  summary: appUsageSummarySchema,
  heatmap: appUsageHeatmapSchema,
  dailyModelUsage: z4.array(appUsageDailyModelUsageSchema),
  models: z4.array(appUsageModelUsageSchema),
  tools: z4.array(appUsageToolUsageSchema)
});

// ../reference/ZCode/packages/shared/src/zcode-protocol-legacy-types.ts
import { z as z6 } from "zod";

// ../reference/ZCode/packages/shared/src/model-selection.ts
import { z as z5 } from "zod";
var modelSelectionSchema = z5.object({
  providerId: z5.string().trim().min(1),
  modelId: z5.string().trim().min(1),
  options: z5.object({
    reasoningLevel: z5.string().trim().min(1).optional()
  }).strict().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-legacy-types.ts
var nonEmptyString = z6.string().trim().min(1);
var jsonObjectSchema = z6.record(z6.string(), z6.unknown());
var timestampMsSchema = z6.number().int().nonnegative();
var zcodeDeliveryKindSchema = z6.enum(["desktop-continuous", "web-remote-replayable"]);
var zcodeMessageVisibilitySchema = z6.enum(["user-visible", "model-only"]);
var zcodeSyntheticUserMessageSourceSchema = z6.enum([
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
var zcodeWorkspaceRefSchema = z6.object({
  workspacePath: nonEmptyString,
  workspaceIdentity: nonEmptyString.optional(),
  remoteSessionId: nonEmptyString.optional(),
  workspaceKey: nonEmptyString
}).strict();
var zcodePermissionDecisionSchema = z6.enum(["allow", "deny", "escalate", "modify"]);
var zcodePermissionRuleBehaviorSchema = z6.enum(["allow", "deny", "ask"]);
var zcodePermissionRuleValueSchema = z6.object({
  toolName: nonEmptyString,
  ruleContent: z6.string().optional()
}).strict();
var zcodePermissionUpdateSchema = z6.object({
  type: z6.literal("addRules"),
  behavior: zcodePermissionRuleBehaviorSchema,
  rules: z6.array(zcodePermissionRuleValueSchema).min(1)
}).strict();
var zcodePermissionResponseSchema = z6.object({
  decision: zcodePermissionDecisionSchema,
  reason: z6.string().optional(),
  modifiedInput: z6.unknown().optional(),
  permissionUpdates: z6.array(zcodePermissionUpdateSchema).optional()
}).strict();
var zcodeSessionModeSchema = z6.enum(["plan", "build", "edit", "yolo", "auto"]);
var zcodeSessionStatusSchema = z6.enum([
  "idle",
  "running",
  "waiting",
  "paused",
  "completed",
  "error"
]);
var zcodeSessionKindSchema = z6.enum([
  "interactive",
  "fork",
  "selection_side_chat",
  "workflow_parent",
  "workflow_child",
  "subagent_child",
  "nested_workflow_child"
]);
var zcodeSessionGoalSchema = z6.object({
  sessionId: nonEmptyString,
  targetId: nonEmptyString,
  objective: nonEmptyString,
  // 旧版持久化 session target 不包含 summaryTitle。
  // 协议读取历史 snapshot 时补 null，避免老会话恢复失败。
  summaryTitle: z6.string().min(1).nullable().default(null),
  status: z6.enum(["active", "paused", "budget_limited", "complete"]),
  tokenBudget: z6.number().int().positive().nullable(),
  tokensUsed: z6.number().int().nonnegative(),
  timeUsedSeconds: z6.number().int().nonnegative(),
  activeInputId: nonEmptyString.nullable().optional(),
  activeRunStartedAtMs: timestampMsSchema.nullable().optional(),
  activeRunLastSeenAtMs: timestampMsSchema.nullable().optional(),
  createdAt: timestampMsSchema,
  updatedAt: timestampMsSchema
}).strict();
var zcodeSessionGoalVerificationSchema = z6.object({
  nextAction: z6.string().nullable().optional(),
  passed: z6.boolean(),
  reason: z6.string()
}).strict();
var zcodeSessionGoalVerificationTimelineSchema = z6.object({
  version: z6.literal(1),
  kind: z6.literal("synthetic"),
  type: z6.literal("goal_verification"),
  display: z6.literal("separator"),
  targetId: nonEmptyString,
  verificationId: nonEmptyString,
  status: z6.enum(["started", "completed", "failed_closed", "cancelled"]),
  verification: zcodeSessionGoalVerificationSchema.optional(),
  goalIteration: z6.number().int().positive().optional(),
  anchorAssistantMessageId: nonEmptyString.optional(),
  anchorTurnId: nonEmptyString.optional(),
  startedAt: timestampMsSchema.optional(),
  updatedAt: timestampMsSchema
}).strict();
var zcodeSessionInfoSchema = z6.object({
  sessionId: nonEmptyString,
  workspace: zcodeWorkspaceRefSchema,
  parentSessionId: nonEmptyString.optional(),
  traceId: nonEmptyString.optional(),
  sessionKind: zcodeSessionKindSchema,
  title: z6.string(),
  titleSource: z6.enum(["default", "first_input", "generated", "custom"]).optional(),
  mode: zcodeSessionModeSchema,
  status: zcodeSessionStatusSchema,
  model: modelSelectionSchema.optional(),
  target: zcodeSessionGoalSchema.nullable().optional(),
  createdAt: timestampMsSchema,
  updatedAt: timestampMsSchema,
  archivedAt: timestampMsSchema.optional()
}).strict();
var zcodeInteractionRequestOriginSchema = z6.object({
  kind: z6.literal("subagent"),
  agentId: nonEmptyString,
  agentType: nonEmptyString,
  childSessionId: nonEmptyString,
  childTurnId: nonEmptyString.optional(),
  description: z6.string().optional(),
  parentSessionId: nonEmptyString,
  parentToolCallId: nonEmptyString.optional(),
  parentTurnId: nonEmptyString.optional()
}).strict();
var messageTimeSchema = z6.object({
  created: timestampMsSchema,
  completed: timestampMsSchema.optional()
}).strict();
var zcodeTokenUsageSchema = z6.object({
  total: z6.number().int().nonnegative().optional(),
  input: z6.number().int().nonnegative(),
  output: z6.number().int().nonnegative(),
  reasoning: z6.number().int().nonnegative(),
  cache: z6.object({
    read: z6.number().int().nonnegative(),
    write: z6.number().int().nonnegative()
  }).strict()
}).strict();
var zcodeMessageSemanticsSchema = z6.object({
  origin: z6.enum(["real_user", "agent_runtime", "system", "migration", "import"]),
  kind: z6.enum([
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
  source: z6.string().optional(),
  commandName: z6.string().optional(),
  uiVisibility: z6.enum(["visible", "hidden", "debug"]),
  providerVisibility: z6.enum(["visible", "hidden"]),
  transcriptVisibility: z6.enum(["visible", "hidden"])
}).strict();
var zcodeUserMessageInfoSchema = z6.object({
  messageId: nonEmptyString,
  sessionId: nonEmptyString,
  role: z6.literal("user"),
  time: messageTimeSchema,
  agent: nonEmptyString,
  // 旧消息或未绑定会话的合成消息可能没有请求来源；不借默认模型补写。
  model: modelSelectionSchema.optional(),
  system: z6.string().optional(),
  tools: z6.record(z6.string(), z6.boolean()).optional(),
  synthetic: z6.boolean().optional(),
  source: zcodeSyntheticUserMessageSourceSchema.optional(),
  visibility: zcodeMessageVisibilitySchema.optional(),
  semantics: zcodeMessageSemanticsSchema.optional(),
  metadata: jsonObjectSchema.optional()
}).strict();
var zcodeAssistantMessageInfoSchema = z6.object({
  messageId: nonEmptyString,
  sessionId: nonEmptyString,
  role: z6.literal("assistant"),
  time: messageTimeSchema,
  parentMessageId: nonEmptyString,
  agent: nonEmptyString,
  model: modelSelectionSchema.optional(),
  path: z6.object({
    cwd: nonEmptyString,
    root: nonEmptyString
  }).strict(),
  cost: z6.number().nonnegative(),
  tokens: zcodeTokenUsageSchema,
  finish: z6.string().optional(),
  error: jsonObjectSchema.optional(),
  semantics: zcodeMessageSemanticsSchema.optional(),
  structured: z6.unknown().optional()
}).strict();
var zcodeMessageInfoSchema = z6.discriminatedUnion("role", [
  zcodeUserMessageInfoSchema,
  zcodeAssistantMessageInfoSchema
]);
var partBaseSchema = z6.object({
  partId: nonEmptyString,
  sessionId: nonEmptyString,
  messageId: nonEmptyString
});
var zcodeToolStateSchema = z6.discriminatedUnion("status", [
  z6.object({
    status: z6.literal("pending"),
    input: jsonObjectSchema,
    raw: z6.string()
  }).strict(),
  z6.object({
    status: z6.literal("running"),
    input: jsonObjectSchema,
    title: z6.string().optional(),
    metadata: jsonObjectSchema.optional(),
    startedAt: timestampMsSchema
  }).strict(),
  z6.object({
    status: z6.literal("completed"),
    input: jsonObjectSchema,
    output: z6.string(),
    title: z6.string(),
    metadata: jsonObjectSchema,
    startedAt: timestampMsSchema,
    completedAt: timestampMsSchema
  }).strict(),
  z6.object({
    status: z6.literal("error"),
    input: jsonObjectSchema,
    error: z6.string(),
    metadata: jsonObjectSchema.optional(),
    startedAt: timestampMsSchema,
    completedAt: timestampMsSchema
  }).strict()
]);
var zcodeTimelineModelSelectionSchema = modelSelectionSchema.extend({
  label: z6.string().optional()
});
var zcodeTimelinePartTimeSchema = z6.object({
  start: timestampMsSchema.optional(),
  end: timestampMsSchema.optional()
}).strict();
var zcodeTimelinePartSchema = partBaseSchema.extend({
  type: z6.literal("timeline"),
  timelineType: z6.enum([
    "context_compaction",
    "goal_verification",
    "session_fork",
    "model_change"
  ]),
  display: z6.enum(["separator", "worklog"]),
  status: z6.string().optional(),
  anchorMessageId: nonEmptyString.optional(),
  anchorTurnId: nonEmptyString.optional(),
  time: zcodeTimelinePartTimeSchema.optional(),
  operationId: z6.string().optional(),
  trigger: z6.enum(["manual", "auto", "partial", "reactive", "session_memory"]).optional(),
  phase: z6.enum(["standalone_turn", "pre_request", "mid_turn", "reactive"]).optional(),
  compactReason: z6.string().optional(),
  boundaryId: z6.string().optional(),
  summaryMessageId: nonEmptyString.optional(),
  preCompactTokenCount: z6.number().int().nonnegative().optional(),
  postCompactTokenCount: z6.number().int().nonnegative().optional(),
  truePostCompactTokenCount: z6.number().int().nonnegative().optional(),
  attempt: z6.number().int().nonnegative().optional(),
  maxAttempts: z6.number().int().nonnegative().optional(),
  reason: z6.string().optional(),
  targetId: z6.string().optional(),
  verificationId: z6.string().optional(),
  goalIteration: z6.number().int().nonnegative().optional(),
  verification: z6.object({
    passed: z6.boolean(),
    reason: z6.string(),
    nextAction: z6.string().nullable().optional()
  }).strict().optional(),
  parentSessionId: nonEmptyString.optional(),
  targetMessageId: nonEmptyString.optional(),
  targetCheckpointId: z6.string().optional(),
  restoredFileCount: z6.number().int().nonnegative().optional(),
  fromModel: zcodeTimelineModelSelectionSchema.optional(),
  toModel: zcodeTimelineModelSelectionSchema.extend({
    label: nonEmptyString
  }).optional()
}).strict();
var zcodeMessagePartSchema = z6.discriminatedUnion("type", [
  partBaseSchema.extend({
    type: z6.literal("text"),
    text: z6.string(),
    synthetic: z6.boolean().optional(),
    ignored: z6.boolean().optional(),
    metadata: jsonObjectSchema.optional()
  }).strict(),
  partBaseSchema.extend({
    type: z6.literal("reasoning"),
    text: z6.string(),
    metadata: jsonObjectSchema.optional()
  }).strict(),
  partBaseSchema.extend({
    type: z6.literal("file"),
    mime: nonEmptyString,
    filename: z6.string().optional(),
    url: nonEmptyString,
    metadata: jsonObjectSchema.optional()
  }).strict(),
  partBaseSchema.extend({
    type: z6.literal("tool"),
    callId: nonEmptyString,
    tool: nonEmptyString,
    state: zcodeToolStateSchema,
    metadata: jsonObjectSchema.optional()
  }).strict(),
  partBaseSchema.extend({ type: z6.literal("step-start"), snapshot: z6.string().optional() }).strict(),
  partBaseSchema.extend({
    type: z6.literal("step-finish"),
    reason: z6.string(),
    snapshot: z6.string().optional(),
    cost: z6.number().nonnegative(),
    tokens: zcodeTokenUsageSchema
  }).strict(),
  partBaseSchema.extend({ type: z6.literal("snapshot"), snapshot: z6.string() }).strict(),
  partBaseSchema.extend({
    type: z6.literal("patch"),
    hash: nonEmptyString,
    files: z6.array(z6.string())
  }).strict(),
  partBaseSchema.extend({
    type: z6.literal("compaction"),
    auto: z6.boolean(),
    reason: z6.string().optional(),
    summaryMessageId: nonEmptyString.optional(),
    metadata: jsonObjectSchema.optional()
  }).strict(),
  zcodeTimelinePartSchema,
  partBaseSchema.extend({
    type: z6.literal("subagent"),
    prompt: z6.string(),
    description: z6.string(),
    agent: nonEmptyString,
    model: modelSelectionSchema.optional(),
    command: z6.string().optional()
  }).strict(),
  partBaseSchema.extend({ type: z6.literal("agent"), name: nonEmptyString }).strict(),
  partBaseSchema.extend({
    type: z6.literal("retry"),
    attempt: z6.number().int().nonnegative(),
    error: jsonObjectSchema
  }).strict()
]);
var zcodeMessageWithPartsSchema = z6.object({
  info: zcodeMessageInfoSchema,
  parts: z6.array(zcodeMessagePartSchema)
}).strict();
var zcodeSessionApiRetryStatusSchema = z6.object({
  kind: z6.literal("api_retry"),
  attempt: z6.number().int().positive(),
  maxRetries: z6.number().int().nonnegative(),
  retryDelayMs: z6.number().int().nonnegative(),
  errorStatus: z6.number().int().nonnegative().nullable(),
  error: z6.string()
}).strict();
var zcodeSessionContextCacheUsageSchema = z6.object({
  inputTokens: z6.number().int().nonnegative(),
  cacheReadTokens: z6.number().int().nonnegative(),
  cacheWriteTokens: z6.number().int().nonnegative(),
  latestHitRate: z6.number().nonnegative().nullable().optional(),
  hitRateRequestCount: z6.number().int().nonnegative().optional(),
  totalInputTokens: z6.number().int().nonnegative().optional(),
  totalCacheReadTokens: z6.number().int().nonnegative().optional(),
  totalCacheWriteTokens: z6.number().int().nonnegative().optional(),
  hitRate: z6.number().nonnegative().nullable()
}).strict();
var zcodeContextUsageBreakdownSourceSchema = z6.enum([
  "system_prompt",
  "meta_user_context",
  "skills",
  "tool_prompt",
  "system_tool_schemas",
  "mcp_tool_schemas",
  "messages"
]);
var zcodeContextUsageBreakdownItemSchema = z6.object({
  source: zcodeContextUsageBreakdownSourceSchema,
  chars: z6.number().int().nonnegative()
}).strict();
var zcodeContextUsageBreakdownSchema = z6.array(zcodeContextUsageBreakdownItemSchema);
var zcodeSessionContextUsageSchema = z6.object({
  used: z6.number().int().nonnegative(),
  size: z6.number().int().positive(),
  cost: z6.object({
    amount: z6.number().nonnegative(),
    currency: nonEmptyString
  }).strict().nullable().optional(),
  cache: zcodeSessionContextCacheUsageSchema.optional(),
  breakdown: zcodeContextUsageBreakdownSchema.optional()
}).strict();
var zcodeSessionRuntimeStateSchema = z6.object({
  eventSeq: z6.number().int().nonnegative(),
  stateRevision: z6.number().int().nonnegative(),
  deliveryKind: zcodeDeliveryKindSchema.optional(),
  activeTurnId: nonEmptyString.optional(),
  activeTurnKind: z6.enum(["regular", "compact", "rewind"]).optional(),
  pendingRequestIds: z6.array(nonEmptyString),
  apiRetry: zcodeSessionApiRetryStatusSchema.nullable().optional(),
  contextUsage: zcodeSessionContextUsageSchema.optional(),
  goalVerifications: z6.array(zcodeSessionGoalVerificationSchema).optional(),
  goalVerificationTimeline: z6.array(zcodeSessionGoalVerificationTimelineSchema).optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/delta.ts
import { z as z24 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/rows.ts
import { z as z16 } from "zod";

// ../reference/ZCode/packages/shared/src/execution-output-preview.ts
import { z as z7 } from "zod";
var OUTPUT_PREVIEW_MAX_CHARACTERS = 4096;
var executionOutputPreviewSchema = z7.object({
  text: z7.string().max(OUTPUT_PREVIEW_MAX_CHARACTERS),
  fullText: z7.string().max(OUTPUT_PREVIEW_MAX_CHARACTERS),
  totalLines: z7.number().int().nonnegative(),
  totalBytes: z7.number().int().nonnegative(),
  linesEstimated: z7.boolean()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-row-meta.ts
import { z as z11 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/create-workflow-display.ts
import { z as z8 } from "zod";
var namePatternSchema = z8.object({
  head: z8.string().min(1).max(128).optional(),
  tail: z8.string().min(1).max(128).optional()
}).strict();
var workflowEdgeSchema = z8.object({
  from: z8.string().min(1).max(64),
  to: z8.string().min(1).max(64),
  back: z8.literal(true).optional()
}).strict();
var toolCallCreateWorkflowCausalityGraphSchema = z8.object({
  steps: z8.array(
    z8.object({
      id: z8.string().min(1).max(64),
      kind: z8.enum(["ask", "world-read"]),
      label: z8.string().min(1).max(128),
      // 内联 `agent()` receiver 让 label 落到兜底串时，那个名字的静态形状。
      labelPattern: namePatternSchema.optional(),
      line: z8.number().int().positive().optional(),
      column: z8.number().int().positive().optional(),
      lane: z8.string().min(1).max(64),
      lanes: z8.array(z8.string().min(1).max(64)).max(32).optional(),
      // 展开自的站点 id，只出现在 may-set 车道展开的拷贝上（实时叠加的关联键）；
      // 加字段是 additive 的，不带它的旧载荷照常通过 .strict()。
      source: z8.string().min(1).max(64).optional(),
      // 作者用 `phase("…")` 标记划入的阶段。
      // 与图的 phases / phaseEdges / exits 同进同退：全在场或全缺席。
      phase: z8.string().min(1).max(64).optional(),
      repeat: z8.enum(["stack", "serial"]).optional()
    }).strict()
  ).max(64),
  lanes: z8.array(
    z8.object({
      id: z8.string().min(1).max(64),
      name: z8.string().min(1).max(128).optional(),
      // `name` 缺席而 agent() 首参是带洞的模板串时的静态形状；与 name 互斥。
      namePattern: namePatternSchema.optional(),
      line: z8.number().int().positive().optional(),
      column: z8.number().int().positive().optional()
    }).strict()
  ).max(32),
  // 参与者 = 每阶段一张子代理卡（工作区 / 未解析同形）；数组顺序就是交接序，第一张是开局者。
  // fan-out 家族按字面量基数展开成 member，基数未知时一张 many 卡。
  participants: z8.array(
    z8.object({
      id: z8.string().min(1).max(64),
      phase: z8.string().min(1).max(64),
      lane: z8.string().min(1).max(64),
      steps: z8.array(z8.string().min(1).max(64)).min(1).max(64),
      member: z8.object({ index: z8.number().int().nonnegative(), of: z8.number().int().positive() }).strict().optional(),
      many: z8.literal(true).optional()
    }).strict()
  ).max(64),
  // 交接 = 参与者之间的 runs after；types 是跨越它的产物类型（检视器素材，不上箭头）。
  handoffs: z8.array(
    workflowEdgeSchema.extend({ types: z8.array(z8.string().min(1).max(128)).min(1).max(8).optional() }).strict()
  ).max(256),
  // 阶段词汇表：作者施加的分组结构，主画面以它为节点。与 phaseEdges / exits / Step.phase
  // 全有或全无——零标记脚本全缺席，UI 据此退回 step/车道视图。零成员阶段也在表里。
  // `unphased` 无 name，显示名由 UI 本地化。
  phases: z8.array(
    z8.object({
      id: z8.string().min(1).max(64),
      name: z8.string().min(1).max(128).optional(),
      line: z8.number().int().positive().optional(),
      column: z8.number().int().positive().optional(),
      // 进入本阶段时还在跑的其他阶段（它们的 strand 尚未 join），阶段表序，不含自己，
      // 为空时缺席。是节点事实而不是边——控制没有从那里转移过来，所以不进 phaseEdges。
      // 时间轴据此把相邻阶段折成一条分叉的「带」，侧栏迷你轨道画成双线段。
      alongside: z8.array(z8.string().min(1).max(64)).min(1).max(32).optional()
    }).strict()
  ).max(32).optional(),
  phaseEdges: z8.array(workflowEdgeSchema).max(128).optional(),
  // 控制流可在其后正常完成的阶段（阶段视图的「阶段 → 返回物」箭头）；组内可为空数组。
  exits: z8.array(z8.string().min(1).max(64)).max(32).optional(),
  sink: z8.array(z8.string().min(1).max(64)).max(64).optional(),
  truncated: z8.boolean().optional()
}).strict();
var toolCallCreateWorkflowDisplaySchema = z8.object({
  kind: z8.literal("create_workflow"),
  ok: z8.boolean(),
  errorCount: z8.number().int().nonnegative(),
  diagnostics: z8.array(
    z8.object({
      line: z8.number().int().nonnegative(),
      column: z8.number().int().nonnegative(),
      code: z8.number().int().nonnegative(),
      message: z8.string().min(1).max(2048)
    }).strict()
  ).max(100),
  causalityGraph: toolCallCreateWorkflowCausalityGraphSchema.optional(),
  truncated: z8.boolean().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-runs.ts
import { z as z10 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-artifacts.ts
import { z as z9 } from "zod";
var workflowRunArtifactKindSchema = z9.enum([
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
var workflowRunArtifactVersionSchema = z9.object({
  version: z9.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  title: z9.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxTitleLength).optional(),
  description: z9.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxDescriptionLength).optional(),
  contentType: z9.string().min(1).max(128).optional(),
  /** 该版本在 store 里的字节数（内容成员才有）。 */
  bytes: z9.number().int().nonnegative().optional(),
  /** store 的 `zcode-artifact://…`；**只给 CLI 侧用**，模型与 renderer 都读不了它。 */
  uri: z9.string().min(1).max(512).optional(),
  /** 工作区相对的原路径（`file` 才有）——卡片的「在工作区显示」按它定位。 */
  sourcePath: z9.string().min(1).max(1024).optional(),
  /** 预置看板的 spec（canonical）。形状由 UI 的四个渲染器各自解释，协议不复述。 */
  spec: z9.unknown().optional(),
  /** 发布时刻（epoch 毫秒）。 */
  publishedAt: z9.number().int().nonnegative(),
  /** 这一版属于 run 的交付物；引擎盖章，按 id 粘着。 */
  primary: z9.literal(true).optional()
}).strict();
var workflowRunArtifactSchema = z9.object({
  id: z9.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxIdLength),
  kind: workflowRunArtifactKindSchema,
  title: z9.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxTitleLength).optional(),
  description: z9.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxDescriptionLength).optional(),
  contentType: z9.string().min(1).max(128).optional(),
  sourcePath: z9.string().min(1).max(1024).optional(),
  spec: z9.unknown().optional(),
  /** 最新版号（= `versions` 末项的 version）。 */
  version: z9.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  /** 版本升序。失败的发布**不在**这里：失败行不认领 id / 种类 / 版本。 */
  versions: z9.array(workflowRunArtifactVersionSchema).max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  /** 打了这个 id 标签的 `report` 条目数（预置看板的数据量；内容产物恒 0）。 */
  itemCount: z9.number().int().nonnegative(),
  /** run 的交付物（至多一件）；清单以它带头。 */
  primary: z9.literal(true).optional()
}).strict();
var workflowRunArtifactSummarySchema = z9.object({
  id: z9.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxIdLength),
  kind: workflowRunArtifactKindSchema,
  title: z9.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxTitleLength).optional(),
  version: z9.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  contentType: z9.string().min(1).max(128).optional(),
  bytes: z9.number().int().nonnegative().optional(),
  itemCount: z9.number().int().nonnegative().optional(),
  /** run 的交付物（至多一件）。UI 据它排先后与选形态；缺席即不是。 */
  primary: z9.literal(true).optional()
}).strict();
var v4ConversationWorkflowRunArtifactsParamsSchema = z9.object({
  sessionId: z9.string().min(1),
  runId: z9.string().min(1)
}).strict();
var v4ConversationWorkflowRunArtifactsResultSchema = z9.object({
  /** 按首次出现顺序（= journal 里该 id 第一条 artifact 行的 ordinal）。 */
  artifacts: z9.array(workflowRunArtifactSchema)
}).strict();
var v4ConversationWorkflowRunArtifactDataParamsSchema = z9.object({
  sessionId: z9.string().min(1),
  runId: z9.string().min(1),
  artifactId: z9.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxIdLength),
  /** 只取 sequence 严格大于该值的条目；缺省从头取。 */
  afterSequence: z9.number().int().nonnegative().optional(),
  /** 缺省 200、钳 [1, 500]——两者都在网关侧执行（存储层不得自造页大小，也不得再钳）。 */
  limit: z9.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxItemsPerPage).optional()
}).strict();
var v4ConversationWorkflowRunArtifactDataResultSchema = z9.object({
  items: z9.array(
    z9.object({
      /** journal sequence——回传成 `afterSequence` 就是下一页的游标。 */
      sequence: z9.number().int().nonnegative(),
      /** 产出该条目的 report 站点（如 `report#1`）。 */
      siteId: z9.string().min(1).max(64),
      ordinal: z9.number().int().nonnegative(),
      /**
       * 条目原值，**不做预览序列化**：看板的纯函数要按字段路径取数
       * （`ChartSpec.x.field` 形如 "timing.after"），拿到一段 pretty JSON 文本就没法取了。
       * 单条在线上已由 `REPORT_CAPS.maxItemSerializedBytes`（32KB）与事件载荷有界化
       * 双重保证，这里不再叠一层界。
       */
      item: z9.unknown()
    }).strict()
  ),
  /** 本页取满 limit 且后面仍有条目（网关多取一条判定）。 */
  hasMore: z9.boolean()
}).strict();
var v4ConversationWorkflowRunArtifactReadParamsSchema = z9.object({
  sessionId: z9.string().min(1),
  runId: z9.string().min(1),
  artifactId: z9.string().min(1).max(WORKFLOW_ARTIFACT_LIMITS.maxIdLength),
  version: z9.number().int().positive().max(WORKFLOW_ARTIFACT_LIMITS.maxVersions),
  offset: z9.number().int().nonnegative(),
  limit: z9.number().int().positive().max(PROTOCOL_V4_LIMITS.attachmentChunkMaxBytes)
}).strict();
var v4ConversationWorkflowRunArtifactReadResultSchema = z9.object({
  /** base64（不带 data: 前缀）；解码后 ≤ attachmentChunkMaxBytes。 */
  dataBase64: z9.string(),
  /**
   * 该版本的 contentType，取 journal 记录上的值（driver 按扩展名表算出、`opts.contentType`
   * 可覆盖）——那是 UI 分派渲染器的**精确匹配**契约。刻意不像 attachmentRead 那样把
   * mediaType 限死在 image/video/pdf：产物的合法类型就是 driver 那张 17 项扩展名表加
   * `application/octet-stream`，限死会让 markdown 与 office 文件整条读不出来。
   */
  mediaType: z9.string().min(1).max(128),
  /** 该版本的总字节数（≤ ARTIFACT_CAPS.maxFileBytes = attachmentMaxBytes）。 */
  totalBytes: z9.number().int().nonnegative().max(PROTOCOL_V4_LIMITS.attachmentMaxBytes),
  /** 下一块的 offset；本块读到尾时为 null。 */
  nextOffset: z9.number().int().positive().nullable()
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
var workflowRunPhaseSchema = z10.object({
  name: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength),
  rounds: z10.number().int().positive()
});
var workflowRunUnlistedPhaseSchema = z10.object({
  phaseName: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength).optional(),
  actors: z10.number().int().nonnegative(),
  actorsSettled: z10.number().int().nonnegative().optional(),
  actorsFailed: z10.number().int().nonnegative().optional(),
  settled: z10.number().int().nonnegative()
});
var workflowRunUsageSchema = z10.object({
  spentTokens: z10.number().int().nonnegative(),
  nodesUsed: z10.number().int().nonnegative(),
  /**
   * 撞上 {@link WORKFLOW_RUNS_LIMITS.maxNodes} 被**拒之表外**的实例数，以及其中已结算的条数。`truncated` 只说得出「有东西没进来」，说不出
   * 有多少——于是一个 3000 路 fan-out 的 run 在读面上会显示成「1024 步」，那是一句假话。
   *
   * 两条都是**加出来**的计数（被拒实例根本不在表里，没有可去重的身份），所以归约只在事件
   * **抬过水位**时才计，重传的队尾事件不会把它们越推越高。`run-started` 连同整个 usage 一起
   * 清零：resume 会把脚本前缀重发一遍，不清零等于把两世的步数加在一起。零时整个键缺席。
   */
  nodesUnlisted: z10.number().int().nonnegative().optional(),
  nodesUnlistedSettled: z10.number().int().nonnegative().optional()
});
var workflowRunActorSchema = z10.object({
  siteId: z10.string().min(1).max(64),
  ordinal: z10.number().int().nonnegative(),
  name: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxActorNameLength).optional(),
  sessionId: z10.string().min(1).max(256).optional(),
  status: z10.enum(["waiting", "running", "completed"]),
  /**
   * 这个实例**出生**在哪个阶段：它的 ordinal 被铸造的那一刻，控制流所在的 `phase("…")` 标记名。UI 按**名字**与 `phases[].name`
   * 关联——名字是引擎与分析器唯一共享的词汇，所以界与 `maxPhaseNameLength` 同值。
   *
   * 缺席有两种读法，消费者都要认：出生在任何标记之前（脚本没写 `phase()`，或写在后面），
   * 或者发事件的是不带这个键的旧 CLI。
   */
  phaseName: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength).optional()
});
var workflowRunNodeLastToolSchema = z10.object({
  name: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxLastToolNameLength),
  target: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxLastToolTargetLength).optional()
});
var workflowRunNodeSchema = z10.object({
  siteId: z10.string().min(1).max(64),
  ordinal: z10.number().int().nonnegative(),
  kind: z10.enum(["ask", "world-read"]).optional(),
  phase: z10.enum(["queued", "dispatched", "executing", "waiting", "repairing", "nudged", "settled"]),
  outcome: z10.enum(["ok", "failed", "cancelled"]).optional(),
  cached: z10.boolean().optional(),
  /** 该节点所属 actor 的站点 id（world-read 无 actor）。 */
  actorSiteId: z10.string().min(1).max(64).optional(),
  actorOrdinal: z10.number().int().nonnegative().optional(),
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
  phaseName: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength).optional(),
  /**
   * 这次 ask 的**任务**：作者写的 `instructions` 的头 240 字，随 `node-queued` 到达。读面据它回答「这个子代理被派去干什么」——
   * 相位只说得出「在跑」，说不出在跑什么。
   *
   * 是**作者原文**的头，不含引擎后来追加的尾注（那些是运行时脚手架，不是任务）。
   * 缺席有两种读法，消费者都要认：world-read 节点（没有指令），或不带这个键的旧 CLI/旧 journal。
   */
  instructionsHead: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxInstructionsHeadLength).optional(),
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
  turn: z10.number().int().positive().optional(),
  toolCalls: z10.number().int().nonnegative().optional(),
  lastTool: workflowRunNodeLastToolSchema.optional()
});
var workflowRunConcurrencySchema = z10.object({
  key: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxConcurrencyKeyLength).optional(),
  cap: z10.number().int().positive(),
  ceiling: z10.number().int().positive(),
  limit: z10.number().int().positive().optional(),
  cooldownMs: z10.number().int().nonnegative().optional()
});
var workflowRunReportSchema = z10.object({
  siteId: z10.string().min(1).max(64),
  ordinal: z10.number().int().nonnegative(),
  preview: z10.string().max(WORKFLOW_RUNS_LIMITS.maxReportPreviewLength),
  /**
   * `report(item, artifactId)` 的第二实参：这条条目喂给哪个**预置看板**。缺席 = 没打标签，照旧只进 Results 区。
   *
   * 带标签的条目**仍然进 `reports`**：一条通道一套上限，标签只是多一个去处，不是改道。
   * 上界与产物 id 同（64），因为它就是一个产物 id。
   */
  artifactId: z10.string().min(1).max(64).optional()
});
var workflowRunPendingQuestionSchema = z10.object({
  /** 全局唯一的问题 id（形如 `dwfq-<runId 片段>-<seq>`）。主代理按它作答。 */
  qid: z10.string().min(1).max(128),
  actorSiteId: z10.string().min(1).max(64).optional(),
  actorOrdinal: z10.number().int().nonnegative().optional(),
  actorName: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxActorNameLength).optional(),
  question: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxQuestionLength),
  context: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxQuestionLength).optional(),
  /**
   * 提问时刻（epoch 毫秒），由事件携带——本模块是纯归约，没有时钟可用。
   *
   * 事件侧**必填**（driver 是唯一生产者，与停驻记录取同一个 `Date.now()`），这里仍然 optional：
   * 老开发机上的 journal 可能重放出 askedAt 之前的事件。所以渲染侧按「有则显示等待时长」处理，
   * 缺席不是错误。
   */
  askedAt: z10.number().int().nonnegative().optional()
});
var workflowRunSchema = z10.object({
  runId: z10.string().min(1).max(128),
  /** 发起该 run 的 CreateWorkflow 工具调用（工具卡 → 详情页的关联键）。 */
  toolCallId: z10.string().min(1).max(128).optional(),
  status: z10.enum(["pending", "running", "completed", "errored", "stopped"]),
  /** `status === "stopped"` 才在场。 */
  stopReason: z10.enum(["user", "model", "provider", "interrupted", "superseded"]).optional(),
  /**
   * lineage 的两端：本 run 修订自哪个 run
   * （`run-started` 载荷的 `resumedFrom`），以及本 run 被哪次修订停下并替代（`run-settled` 载荷的
   * `supersededBy`，只随 `stopReason: "superseded"` 出现）。两者都 optional，理由与 `reports` 同：
   * 往已有状态键追加字段，旧 CLI 不发它们时少一个键是退化，不是整帧被丢。
   */
  resumedFrom: z10.string().min(1).max(128).optional(),
  supersededBy: z10.string().min(1).max(128).optional(),
  usage: workflowRunUsageSchema,
  error: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxErrorLength).optional(),
  /**
   * 可恢复。**为真才在场**。
   *
   * 由 CLI 在 `run-settled` 载荷上按 resume 门的同一个谓词给出（live 由 toProgressPayload 算，
   * 冷回放由补种按 journal 行算），reducer 只搬运——UI 绝不自行按 status + failureCode 推导
   * （两处谓词总有一天不一致：按钮亮着但命令被拒）。optional 的理由与 `reports` 同：往已有
   * 状态键追加字段，旧 CLI 不发它时少一个键是退化，不是整帧被丢。
   */
  resumable: z10.literal(true).optional(),
  resultPreview: z10.string().max(WORKFLOW_RUNS_LIMITS.maxResultPreviewLength).optional(),
  actors: z10.array(workflowRunActorSchema).max(WORKFLOW_RUNS_LIMITS.maxActors),
  nodes: z10.array(workflowRunNodeSchema).max(WORKFLOW_RUNS_LIMITS.maxNodes),
  /**
   * `report(item)` 交出的渐进产物，按报告顺序。**零条时整个键缺席**（不是空数组）：
   * Results 区据此整区不渲染，而不是给不用 `report` 的工作流留一节空壳。
   *
   * 刻意 optional 而不是必填：这是往一个**已有状态键**上追加字段，而已知键上的解析错误
   * 不会被剥离——它会让整个 `state.updated` patch 失败、整帧被丢。
   * 必填意味着任何一个不发 reports 的旧 CLI 都会触发那一档；optional 让它退化成「少一个键」。
   */
  reports: z10.array(workflowRunReportSchema).max(WORKFLOW_RUNS_LIMITS.maxReports).optional(),
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
  pendingQuestions: z10.array(workflowRunPendingQuestionSchema).max(WORKFLOW_RUNS_LIMITS.maxPendingQuestions).optional(),
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
  concurrencyCeiling: z10.number().int().positive().max(WORKFLOW_RUNS_LIMITS.maxConcurrencyCeiling).optional(),
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
  subagentModel: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxSubagentModelLength).optional(),
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
  artifacts: z10.array(workflowRunArtifactSummarySchema).max(WORKFLOW_RUNS_LIMITS.maxArtifacts).optional(),
  /**
   * 被进入过的阶段，按首次进入顺序。
   * **零条时整个键缺席**；optional 的理由与 `reports` 逐字相同（旧 CLI 不发它，少一个键是退化
   * 不是错误）。时间线据它给零成员的站点灯、给所有站补「第一个 ask 派发之前」那段的 running。
   */
  phases: z10.array(workflowRunPhaseSchema).max(WORKFLOW_RUNS_LIMITS.maxPhases).optional(),
  /** 控制流最后进入的阶段名（最后一条 `phase-entered`）；从未进入过任何阶段时缺席。 */
  currentPhase: z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength).optional(),
  /**
   * 脚本**声明**的阶段表，按声明序（`run-launched.phaseNames`）。与 `phases`（已进入的）互补：侧栏迷你轨道据此画出前方还没到的站点。
   * 零条 / 旧 CLI / 无标记脚本时整个键缺席。
   */
  phaseNames: z10.array(z10.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength)).max(WORKFLOW_RUNS_LIMITS.maxPhases).optional(),
  /**
   * 与 `phaseNames` **按位置对齐**的「同时在跑」表（`run-launched.phaseAlongside`）：
   * `phaseAlongside[i]` 是进入 `phaseNames[i]` 时 strand 仍在跑的其他阶段的**下标**，下标落在
   * `phaseNames` 这张表上。侧栏迷你轨道据此把并行的两站之间画成双线段
   *
   * 依附 `phaseNames`：后者不在场时它一定不在场；没有任何阶段并行时同样缺席——缺席就是
   * 「这条轨道是一条直线」。归约保证每个下标都落在被接受的那张表里（workflow-runs-phases.ts）。
   */
  phaseAlongside: z10.array(z10.array(z10.number().int().nonnegative()).max(WORKFLOW_RUNS_LIMITS.maxPhases)).max(WORKFLOW_RUNS_LIMITS.maxPhases).optional(),
  /**
   * 界在各个出生阶段上花掉了多少（见 {@link workflowRunUnlistedPhaseSchema}）。**一格都没有时
   * 整个键缺席**。表长比 `maxPhases` 多一格：那一格是「无阶段」，它与具名阶段共用同一张表。
   *
   * 表满之后新阶段的归属**丢掉**，run 级两个计数器照旧准——一个站点可以少一个它本来就没有的
   * 数字，run 的总数不可以说假话。
   */
  unlistedByPhase: z10.array(workflowRunUnlistedPhaseSchema).max(WORKFLOW_RUNS_LIMITS.maxPhases + 1).optional(),
  /**
   * actors / nodes / reports / pendingQuestions / artifacts / phases 触到上限后置位；
   * 原始事实仍在 journal。淘汰（给活的新人腾位）同样置位：这条 run 的条目表已经装不下它
   * 自己的事实了，而 `run-started` 正是按这一位决定新一世要不要从空表重开。
   */
  truncated: z10.boolean().optional(),
  /** 最后一条已归约事件的 journal sequence；抬升即事件日志重取的触发条件。 */
  lastEventSequence: z10.number().int().nonnegative()
});
var workflowRunsStateSchema = z10.object({
  revision: z10.number().int().nonnegative(),
  runs: z10.array(workflowRunSchema).max(WORKFLOW_RUNS_LIMITS.maxRuns)
});

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-row-meta.ts
var workflowNotificationMetaSchema = z11.discriminatedUnion("kind", [
  z11.object({
    kind: z11.literal("terminal"),
    status: z11.enum(["completed", "errored", "stopped"]),
    // `status === "stopped"` 才在场。
    stopReason: z11.enum(["user", "model", "provider", "interrupted", "superseded"]).optional(),
    summary: z11.string().min(1).max(500),
    result: z11.string().max(4e3).optional(),
    resultForm: z11.enum(["prose", "json"]).optional(),
    resultTruncated: z11.literal(true).optional(),
    error: z11.string().max(2e3).optional(),
    reports: z11.object({
      count: z11.number().int().nonnegative(),
      shown: z11.number().int().nonnegative(),
      preview: z11.array(z11.string().max(500)).max(8)
    }).optional(),
    // 用户面产物的 chips 载荷。
    // ⚠ 术语：这里的 artifact 是脚本经 `artifact.*` 发布给用户看的产出，与同一载荷上的
    // `result`（脚本顶层返回值，引擎内部也叫 artifact）无关。
    // 只带 chip 画得下的字段：字节数 / 条目数点开侧板即可看到，chip 上放不下。
    // 上界 8，超出（含被种类过滤掉的）置 artifactsTruncated；title 的 120 与
    // ARTIFACT_CAPS.maxTitleLength 同值，发射侧就地截断。
    // 例外是交付物（`primary`）那一条：它还带 `description`（≤ 500，同 ARTIFACT_CAPS），因为
    // 完成卡把它画成一行带文字的交付物，冷 transcript 上只有这个载荷可读。清单 primary 在前。
    artifacts: z11.array(
      z11.object({
        id: z11.string().min(1).max(64),
        kind: z11.enum(["file", "markdown", "chart", "table", "metrics", "board"]),
        title: z11.string().max(120).optional(),
        version: z11.number().int().positive(),
        contentType: z11.string().max(255).optional(),
        primary: z11.literal(true).optional(),
        description: z11.string().max(500).optional()
      })
    ).max(8).optional(),
    artifactsTruncated: z11.literal(true).optional(),
    durationMs: z11.number().nonnegative().optional()
  }),
  z11.object({
    kind: z11.literal("escalation"),
    qid: z11.string().min(1),
    actor: z11.string().min(1),
    question: z11.string().min(1).max(4e3),
    context: z11.string().max(4e3).optional(),
    askedAt: z11.number().optional()
  }),
  // run 级停滞：每个 stall 段一条，不是终态。
  z11.object({
    kind: z11.literal("stall"),
    sinceMs: z11.number().int().nonnegative(),
    reason: z11.string().max(64).optional(),
    cap: z11.number().int().nonnegative().optional()
  })
]);
var backgroundResultOriginMetaSchema = z11.object({
  // 三个取值与 contracts 的 BackgroundResultOriginMeta 保持同步。
  // "workflow" 是 dynamic-workflow run（workId ≡ runId），复用整条后台通知管线。
  backgroundSource: z11.enum(["bash", "subagent", "workflow"]),
  workId: z11.string().min(1),
  title: z11.string().min(1),
  // 只在 backgroundSource === "workflow" 的单条通知轮上在场；zod 剥离未知键，
  // 这里不加即整条链路静默丢——本字段是 manifest 渲染的唯一数据源。
  workflowNotification: workflowNotificationMetaSchema.optional()
});
var workflowSubagentModelTextSchema = z11.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxSubagentModelLength);
var workflowSettingsAmendMetaSchema = z11.object({
  // 修订自哪个 run。**缺席 = 就地生效**：只改并发上限、run
  // 又在飞时，那次「配置」不停这次 run、也不另起一次，于是没有前驱可指——`runId` 指的就是被调整的
  // 那一个。渲染端据此只出那一行、不再出卡（同一条 run 画两张卡会读成两次运行）。
  // 此字段为可选；生产者和消费者需使用一致的 schema 才能解析就地调整的设置记录。
  predecessorRunId: z11.string().min(1).max(128).optional(),
  subagentModel: z11.object({
    from: workflowSubagentModelTextSchema.optional(),
    to: workflowSubagentModelTextSchema.optional()
  }).optional(),
  maxConcurrency: z11.object({
    from: z11.number().int().positive().optional(),
    to: z11.number().int().positive().optional()
  }).optional(),
  ceiling: z11.number().int().positive().optional()
});
var workflowLaunchMetaSchema = z11.object({
  // runId ≡ workId：驱动启动轮 run 卡的实时状态 / 步数，也是取消 / 恢复 / 详情侧板的联接键。
  runId: z11.string().min(1).max(128),
  // launch-<uuid> 前缀（区别于模型工具调用 id）；与合成 CreateWorkflow toolCall 同一个 id。
  toolCallId: z11.string().min(1).max(128),
  // 解析结果里的工作流名（由 agent 填，用户与模型都不能另起）。中枢启动恒在场；设置轮
  // 取被调整的 run 自己的名字，没起过名的 run 就没有——卡片与侧板照任何无名 run 的规矩换用兜底词，
  // 而不是把一个 run id 当标题。
  name: z11.string().min(1).max(200).optional(),
  // scope / path 只属于中枢启动：设置轮（下方 `amend`）改的是一个已有 run，没有保存文件可指。
  // 记录在案的偏斜：旧桌面上它们是必填，新 CLI 的设置轮在那里 parse 失败、整行被丢（与
  // origin 闭集加值同一档）；中枢启动轮两者恒在，不受影响。
  scope: z11.enum(["project", "global"]).optional(),
  // 命中的脚本落盘路径；仅供详情 / 诊断，卡片不显示。1024 覆盖深层全局 / 项目路径。
  path: z11.string().min(1).max(1024).optional(),
  // 实参键值表（卡片渲染源）。有界：序列化 ≤ 4KB，与 contracts 侧 TurnStartedPayload 同界，
  // 防止把整个大对象塞进每条持久消息与活事件。
  args: z11.record(z11.string(), z11.unknown()).refine((value) => JSON.stringify(value).length <= 4096, {
    message: "workflowLaunch.args JSON must be \u2264 4096 bytes"
  }).optional(),
  // 说明行（若有）；与实参窗 / 中枢卡同一段文案，500 与通知 summary 同界。
  description: z11.string().max(500).optional(),
  // 启动前编译得到的 create_workflow display（有界因果图 + 诊断）：run 详情侧板按 toolCallId 找
  // 「发起行」取图，直接启动没有工具行，图从这里取。与工具行 display 同一 schema。
  // 同样不设门：图解析失败只是这一行没有图，不拒整帧（见 toolDisplay.ts 注释）。
  display: toolCallCreateWorkflowDisplaySchema.optional().catch(void 0),
  // 本次 run 实际执行的脚本原文（侧板 Script 区），对应工具行的 input.script；上界与 contracts
  // WORKFLOW_LAUNCH_SCRIPT_MAX_CHARS 同值。
  script: z11.string().max(256e3).optional(),
  // 设置轮才在场：这次 run 是用「配置」从哪个 run 修订来的、改了什么。
  amend: workflowSettingsAmendMetaSchema.optional()
});

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/toolDisplay.ts
import { z as z15 } from "zod";

// ../reference/ZCode/packages/shared/src/bash-output-display.ts
import { z as z12 } from "zod";
var bashOutputDisplaySchema = z12.object({
  kind: z12.literal("bash_output"),
  output: z12.string().max(15e4),
  truncated: z12.boolean(),
  outputPath: z12.string().min(1).max(32768).optional()
}).strict();

// ../reference/ZCode/packages/shared/src/official-mcp-tool-error.ts
var OFFICIAL_MCP_TOOL_ERROR_CODES = ["quota_exceeded", "coding_plan_required"];
var OFFICIAL_MCP_TOOL_ERROR_CODE_SET = new Set(OFFICIAL_MCP_TOOL_ERROR_CODES);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/cuaPermission.ts
import { z as z13 } from "zod";
var cuaRequestAccessStatusSchema = z13.object({
  schemaVersion: z13.literal(1),
  platform: z13.literal("darwin"),
  grantOwner: z13.string().min(1),
  accessibility: z13.enum(["granted", "stale", "denied"]),
  screenRecording: z13.enum(["granted", "denied", "unknown"])
}).strict();
var cuaPermissionObservationSchema = z13.object({
  schemaVersion: z13.literal(1),
  eventId: z13.string().min(1),
  eventSeq: z13.number().int().nonnegative(),
  occurredAt: timestampSchema,
  sessionId: z13.string().min(1),
  turnId: z13.string().min(1).optional(),
  toolCallId: z13.string().min(1),
  permissionStatus: cuaRequestAccessStatusSchema
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-observation-display.ts
import { z as z14 } from "zod";
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
var usageSchema = z14.object({
  spentTokens: z14.number(),
  nodesObserved: z14.number(),
  nodesRunning: z14.number(),
  nodesCompleted: z14.number(),
  nodesFailed: z14.number()
}).strict();
var actorSchema = z14.object({
  siteId: z14.string(),
  ordinal: z14.number(),
  name: z14.string().optional()
}).strict();
var workflowRunPhaseViewSchema = z14.object({
  name: z14.string().min(1).max(128),
  state: z14.enum(["done", "current", "ahead", "unfinished"]),
  rounds: z14.number().int().nonnegative(),
  nodesSettled: z14.number().int().nonnegative(),
  nodesRunning: z14.number().int().nonnegative(),
  enteredAt: z14.number().optional(),
  exitedAt: z14.number().optional()
}).strict();
var workflowRunLastToolSchema = z14.object({
  name: z14.string().min(1).max(64),
  target: z14.string().max(120).optional(),
  at: z14.number().optional()
}).strict();
var workflowRunSubagentViewSchema = z14.object({
  siteId: z14.string().min(1),
  ordinal: z14.number().int().nonnegative(),
  name: z14.string().max(128).optional(),
  state: z14.enum(["idle", "executing", "waiting", "parked", "done", "failed", "unfinished"]),
  phaseName: z14.string().max(128).optional(),
  instructionsHead: z14.string().max(240).optional(),
  startedAt: z14.number().optional(),
  turn: z14.number().int().nonnegative().optional(),
  toolCalls: z14.number().int().nonnegative().optional(),
  lastTool: workflowRunLastToolSchema.optional(),
  waitCause: z14.enum(["slot", "backoff"]).optional(),
  retryAfterMs: z14.number().nonnegative().optional(),
  waitSince: z14.number().optional(),
  parkedOn: z14.string().optional(),
  stepsSettled: z14.number().int().nonnegative(),
  stepsFailed: z14.number().int().nonnegative(),
  tokens: z14.number().int().nonnegative(),
  lastProgressAt: z14.number().optional()
}).strict();
var workflowRunHealthSchema = z14.object({
  lastProgressAt: z14.number().optional(),
  stalledSince: z14.number().optional(),
  concurrency: z14.object({
    effective: z14.number().int().nonnegative(),
    cap: z14.number().int().positive(),
    reason: z14.string().max(240).optional(),
    since: z14.number().optional()
  }).strict().optional(),
  consecutiveFailures: z14.number().int().nonnegative(),
  cachedSteps: z14.number().int().nonnegative(),
  leftoverRunning: z14.number().int().positive().optional(),
  pendingQuestionsKnown: z14.boolean()
}).strict();
var diagnosticSchema = z14.object({
  line: z14.number().int().nonnegative(),
  column: z14.number().int().nonnegative(),
  code: z14.number().int().nonnegative(),
  message: z14.string().min(1).max(2048)
}).strict();
var workflowRunSummaryRowSchema = z14.object({
  runId: z14.string().min(1),
  label: z14.string(),
  labelSource: z14.enum(["name", "script"]),
  status: z14.enum(WORKFLOW_RUN_OBSERVATION_STATUSES),
  stopReason: z14.enum(WORKFLOW_RUN_STOP_REASONS).optional(),
  ownedByThisSession: z14.boolean(),
  possiblyInterrupted: z14.boolean().optional(),
  createdAt: z14.number(),
  updatedAt: z14.number(),
  spentTokens: z14.number()
}).strict();
var toolCallGetWorkflowRunDisplaySchema = z14.object({
  kind: z14.literal("get_workflow_run"),
  runId: z14.string().min(1),
  label: z14.string(),
  status: z14.enum(WORKFLOW_RUN_OBSERVATION_STATUSES),
  stopReason: z14.enum(WORKFLOW_RUN_STOP_REASONS).optional(),
  possiblyInterrupted: z14.boolean().optional(),
  // 情势截面五件全部可选：情势上线前持久化的 transcript 载荷没有这些键，而本 schema 是
  // strict 的——设成必填会让升级后打开的每一条历史会话里这张卡整块被剥、退化成纯文本。
  // 构造侧每次仍然全填（CLI 侧同款注释）。
  summary: z14.string().max(400).optional(),
  generatedAt: z14.number().optional(),
  usage: usageSchema,
  phases: z14.array(workflowRunPhaseViewSchema).max(32).optional(),
  subagents: z14.array(workflowRunSubagentViewSchema).max(64).optional(),
  health: workflowRunHealthSchema.optional(),
  actors: z14.array(actorSchema).max(32),
  logTail: z14.array(
    z14.object({
      sequence: z14.number(),
      message: z14.string().max(1024),
      // 事件落 journal 的时刻（epoch ms）；卡上的「多久以前」对 generatedAt 算。
      // 可选：这一列在情势截面之前的载荷上不存在，读旧行时缺席而不是拒收。
      at: z14.number().optional()
    }).strict()
  ).max(40),
  result: z14.string().max(4e3).optional(),
  error: z14.object({
    code: z14.string(),
    message: z14.string()
  }).strict().optional(),
  truncated: z14.boolean().optional()
}).strict();
var toolCallListWorkflowRunsDisplaySchema = z14.object({
  kind: z14.literal("list_workflow_runs"),
  runs: z14.array(workflowRunSummaryRowSchema).max(50),
  truncated: z14.boolean().optional()
}).strict();
var toolCallEvalWorkflowSnippetDisplaySchema = z14.object({
  kind: z14.literal("eval_workflow_snippet"),
  ok: z14.boolean(),
  diagnostics: z14.array(diagnosticSchema).max(100),
  logs: z14.array(z14.string().max(1024)).max(40),
  response: z14.string().max(4e3),
  durationMs: z14.number().int().nonnegative(),
  truncated: z14.boolean().optional()
}).strict();
var toolCallSavedWorkflowListDisplaySchema = z14.object({
  kind: z14.literal("saved_workflow_list"),
  workflows: z14.array(
    z14.object({
      name: z14.string().min(1),
      description: z14.string().max(2048).optional(),
      whenToUse: z14.string().max(2048).optional(),
      scope: z14.string(),
      path: z14.string().min(1),
      argNames: z14.array(z14.string()).max(32)
    }).strict()
  ).max(50),
  invalid: z14.array(
    z14.object({
      path: z14.string().min(1),
      reason: z14.string().max(1024).optional()
    }).strict()
  ).optional(),
  truncated: z14.boolean().optional()
}).strict();
var toolCallListModelsDisplaySchema = z14.object({
  kind: z14.literal("list_models"),
  current: z14.string().optional(),
  models: z14.array(
    z14.object({
      id: z14.string().min(1),
      providerId: z14.string().min(1),
      modelId: z14.string().min(1),
      providerLabel: z14.string().max(2048).optional(),
      reasoningLevels: z14.array(z14.string()),
      defaultReasoningLevel: z14.string().optional(),
      contextWindow: z14.number().optional(),
      disabledReason: z14.string().max(2048).optional()
    }).strict()
  ).max(100),
  truncated: z14.boolean().optional()
}).strict();
var toolCallResumeWorkflowRunDisplaySchema = z14.object({
  kind: z14.literal("resume_workflow_run"),
  runId: z14.string().min(1)
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/toolDisplay.ts
var toolResultDisplaySchema = z15.discriminatedUnion("kind", [
  bashOutputDisplaySchema,
  z15.object({
    kind: z15.literal("file_diff"),
    filePath: z15.string().min(1),
    additions: z15.number().int().nonnegative(),
    deletions: z15.number().int().nonnegative(),
    structuredPatch: z15.array(
      z15.object({
        oldStart: z15.number().int(),
        oldLines: z15.number().int(),
        newStart: z15.number().int(),
        newLines: z15.number().int(),
        lines: z15.array(z15.string())
      })
    ),
    truncated: z15.boolean().optional()
  }),
  z15.object({
    kind: z15.literal("local_agent_message"),
    status: z15.enum(["success", "failed"]),
    error: z15.string().optional(),
    message: z15.string().optional()
  }),
  z15.object({
    kind: z15.literal("task_stop"),
    taskId: z15.string().min(1),
    taskType: z15.string().min(1),
    command: z15.string().min(1).optional(),
    message: z15.string().min(1),
    truncated: z15.boolean().optional()
  }),
  z15.object({
    kind: z15.literal("task_output"),
    retrievalStatus: z15.enum(["success", "not_ready", "timeout"]),
    taskStatus: z15.string().min(1).max(64).optional(),
    output: z15.string().min(1).max(2e3).optional(),
    truncated: z15.literal(true).optional()
  }),
  z15.object({
    kind: z15.literal("respond_to_coordinator"),
    status: z15.enum(["success", "failed"])
  }),
  z15.object({
    kind: z15.literal("cua"),
    schemaVersion: z15.literal(1),
    toolName: z15.string().min(1),
    status: z15.enum(["success", "failed"]),
    // 旧 v1 snapshot 曾重复携带 ToolCallRow.input；只为历史回放继续接受。
    input: z15.string().optional(),
    structuredContent: z15.string().optional(),
    text: z15.string().optional(),
    errorCode: z15.string().optional(),
    suggestedAction: z15.string().optional(),
    permissionStatus: cuaRequestAccessStatusSchema.optional(),
    targetApp: z15.object({
      schemaVersion: z15.literal(1),
      displayName: z15.string().trim().min(1).max(512).optional(),
      iconLocators: z15.array(
        z15.discriminatedUnion("kind", [
          z15.object({
            kind: z15.literal("darwin-bundle-id"),
            value: z15.string().trim().min(1).max(512)
          }).strict(),
          z15.object({
            kind: z15.literal("windows-executable-path"),
            value: z15.string().trim().min(1).max(32768)
          }).strict(),
          z15.object({
            kind: z15.literal("windows-aumid"),
            value: z15.string().trim().min(1).max(512)
          }).strict()
        ])
      ).max(3)
    }).strict().optional(),
    media: z15.array(
      z15.object({
        mimeType: z15.string().min(1),
        data: z15.string().min(1).max(349528).optional(),
        artifactUri: z15.string().min(1).optional()
      })
    ).max(4).optional(),
    truncated: z15.boolean().optional()
  }),
  z15.object({
    kind: z15.literal("mcp_tool"),
    serverName: z15.string().min(1).max(256),
    toolName: z15.string().min(1).max(256),
    description: z15.string().min(1).max(4 * 1024).optional(),
    // 与 toolCallMcpDisplaySchema 同源：不在这里声明，zod 会把 agent 下发的 unavailable
    // 静默 strip 掉，官方 MCP 额度提示在 v4 链路上失效（同本文件顶部 display strip 的坑）。
    unavailable: z15.object({ code: z15.enum(OFFICIAL_MCP_TOOL_ERROR_CODES) }).strict().optional()
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
var toolOutputSchema = z15.object({
  text: z15.string(),
  display: toolResultDisplaySchema.optional().catch(void 0),
  truncated: z15.object({
    totalBytes: z15.number(),
    ref: z15.string()
  }).optional()
});
var toolProgressSchema = z15.object({
  bytes: z15.number(),
  previewLine: z15.string().optional(),
  updatedAt: timestampSchema
});
var toolCallNodeReplCuaAppDisplaySchema = z15.object({
  appKey: z15.string().trim().min(1).max(2048),
  displayName: z15.string().trim().min(1).max(512).optional()
}).strict();
var toolCallNodeReplImageDisplaySchema = z15.object({
  kind: z15.literal("node_repl_images"),
  // images 可选：CUA 的纯动作 cell 没有截图，但仍要携带 app 身份。kind 名保留不动，
  // 改名会让已持久化的 row 在这条 strict union 里整段校验失败。
  images: z15.array(
    z15.object({
      base64: z15.string().min(1).max(200 * 1024),
      mimeType: z15.string().regex(/^image\/[a-z0-9.+-]+$/iu)
    }).strict()
  ).min(1).max(2).optional(),
  app: toolCallNodeReplCuaAppDisplaySchema.optional(),
  truncated: z15.boolean().optional(),
  source: z15.literal("browser_turn_end").optional()
}).strict();
var toolCallTaskOutputDisplaySchema = z15.object({
  kind: z15.literal("task_output"),
  retrievalStatus: z15.enum(["success", "not_ready", "timeout"]),
  taskStatus: z15.string().min(1).max(64).optional(),
  output: z15.string().min(1).max(2e3).optional(),
  truncated: z15.literal(true).optional()
}).strict();
var toolCallRespondToCoordinatorDisplaySchema = z15.object({
  kind: z15.literal("respond_to_coordinator"),
  status: z15.enum(["success", "failed"])
}).strict();
var toolCallMcpDisplaySchema = z15.object({
  kind: z15.literal("mcp_tool"),
  serverName: z15.string().min(1).max(256),
  toolName: z15.string().min(1).max(256),
  description: z15.string().min(1).max(4 * 1024).optional(),
  /**
   * 官方 Server MCP 判定本次调用不可用（额度耗尽 / 无 Coding Plan）时下发的结构化标识。
   * CLI 侧只在官方来源 + isError 时填充，UI 据此在输入框上方提示。
   * 与 CLI contracts 的 mcpToolResultDisplayPayloadSchema 必须同步——两侧都是 strict，
   * 少加一处会让整条 row 校验失败。
   */
  unavailable: z15.object({ code: z15.enum(OFFICIAL_MCP_TOOL_ERROR_CODES) }).strict().optional()
}).strict();
var toolCallDisplaySchema = z15.discriminatedUnion("kind", [
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
  rowId: z16.number(),
  turnId: z16.string(),
  // canonical identity：新 CLI 每行必传；optional 只用于兼容旧版帧。
  // entityId 定位持久实体，productTurnId 是产品轮次，不得由 UI 重猜。
  entityId: z16.string().min(1).optional(),
  productTurnId: z16.string().min(1).optional(),
  visibility: z16.literal("visible").optional(),
  createdAt: timestampSchema,
  createdAtSeq: z16.number(),
  // 缺省全 false；只下发为 true 的键。canRewind 不在载荷内（rewind = editUserQuery 的 UI 入口）。
  actions: z16.object({
    canFork: z16.literal(true).optional(),
    canEdit: z16.literal(true).optional(),
    canRetry: z16.literal(true).optional(),
    canRewindFiles: z16.literal(true).optional(),
    editDisposition: z16.enum(["rewind", "fork"]).optional()
  }).optional()
};
var rowActionsSchema = rowBaseFields.actions;
var turnWorkSegmentSchema = z16.object({
  segmentId: z16.string().min(1),
  triggerEntityId: z16.string().min(1).optional(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  activeMs: z16.number().nonnegative().optional()
});
var turnHeaderRowSchema = z16.object({
  ...rowBaseFields,
  kind: z16.literal("turnHeader"),
  // workflowLaunch：中枢直接启动的 controlOnly 轮。
  // 记录在案的偏斜：闭集枚举加值 → 旧桌面 + 新 CLI 时该行 parse 失败被丢（与下方
  // backgroundSource: "workflow" 加值同一档），CLI 与桌面同批发布下接受。
  origin: z16.enum([
    "userInput",
    "backgroundResult",
    "goalContinuation",
    "editRerun",
    "workflowLaunch"
  ]),
  // 执行语义由 CLI 投影裁决；UI 不得根据输入文本或 duration 反推。
  // optional 仅用于兼容旧 snapshot，新的 turnHeader 一律显式写入。
  executionKind: z16.enum(["agent", "controlOnly"]).optional(),
  // 当前 query 的命令归因与历史轮次数；optional 兼容旧 transcript/snapshot。
  sourceCommandId: z16.string().optional(),
  historyRoundCount: z16.number().int().nonnegative().optional(),
  state: z16.enum(["running", "completedSuccess", "completedInterrupted", "failed"]),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  // 权威工时：排除权限等待/用户输入等待/verifier 等待。
  activeMs: z16.number().optional(),
  // guide 不切 product turn，但每条 accepted guide 都开启独立视觉工作段。
  // 普通 turn 缺省以保持旧 snapshot 兼容；一旦出现 guide，CLI 负责完整投影首段与后续段。
  workSegments: z16.array(turnWorkSegmentSchema).optional(),
  originMeta: backgroundResultOriginMetaSchema.optional(),
  // origin === "workflowLaunch" 的轮上在场（活投影来源）；与 originMeta 并列，不复用其形状。
  workflowLaunch: workflowLaunchMetaSchema.optional(),
  fileChanges: z16.object({
    additions: z16.number(),
    deletions: z16.number(),
    files: z16.number(),
    state: z16.enum(["active", "reverted"]).optional()
  }).optional()
});
var userInputRowSchema = z16.object({
  ...rowBaseFields,
  kind: z16.literal("userInput"),
  text: z16.string(),
  // text 从此下标起是引擎附加文本（dwf ask 尾注 /
  // nudge），GUI 把它折进默认收起的披露；0 = 整条都是；缺席 = 无（老转录、非工作流会话）。
  epilogueStart: z16.number().int().nonnegative().optional(),
  // workflowLaunch：中枢直接启动轮的用户可见行。
  // 消息文本仍进 text（旧客户端 / TUI 的降级呈现就是那句规范英文）；新客户端用下方
  // workflowLaunch 元数据画轮尾 run 卡而非气泡。闭集加值的偏斜同 turnHeader.origin 注释。
  origin: z16.enum([
    "realUser",
    "backgroundResult",
    "goalContinuation",
    "mailbox",
    "synthetic",
    "workflowLaunch"
  ]),
  originMeta: z16.object({
    // 与 backgroundResultOriginMetaSchema 同一组取值（含 workflow run 的 "workflow"）。
    backgroundSource: z16.enum(["bash", "subagent", "workflow"]).optional(),
    workId: z16.string().optional(),
    senderSessionId: z16.string().optional(),
    senderLabel: z16.string().optional()
  }).optional(),
  // origin === "workflowLaunch" 的行上在场；与 originMeta 并列，与 turnHeader 上同一份。
  workflowLaunch: workflowLaunchMetaSchema.optional(),
  // 经 turn-steer 注入（guideModeTurnSteer）。
  guided: z16.literal(true).optional(),
  // realUser/guided 必带；系统来源缺省。overlay 收口锚点。
  sourceCommandId: z16.string().optional(),
  // edit/retry 会生成新的 sourceCommandId；该字段固定指向 canonical input 根，
  // 用于一次性恢复预算等跨重跑 lineage 判定。旧 transcript 可缺省。
  rootSourceCommandId: z16.string().optional(),
  // 提交端身份由 CLI admission 写入；旧 transcript 可缺省。
  clientId: z16.string().optional(),
  attachments: z16.array(
    z16.object({
      ref: z16.string(),
      fileName: z16.string(),
      mime: z16.string(),
      bytes: z16.number(),
      previewRef: z16.string().optional()
    })
  ).optional()
});
var assistantTextRowSchema = z16.object({
  ...rowBaseFields,
  kind: z16.literal("assistantText"),
  // 同一模型 response 的正文与工具共享此 ID；optional 兼容旧 snapshot。
  assistantResponseId: z16.string().min(1).optional(),
  text: z16.string(),
  state: z16.enum(["streaming", "complete", "interrupted", "failed"]),
  model: z16.string().optional(),
  feedback: z16.enum(["like", "dislike"]).optional()
});
var reasoningRowSchema = z16.object({
  ...rowBaseFields,
  kind: z16.literal("reasoning"),
  // 同一模型 response 的思考、正文与工具共享此 ID；optional 兼容旧 snapshot。
  assistantResponseId: z16.string().min(1).optional(),
  text: z16.string(),
  state: z16.enum(["streaming", "complete", "interrupted"]),
  durationMs: z16.number().optional()
});
var cuaAppIdentitySchema = z16.object({
  pid: z16.number().int().positive(),
  name: z16.string().trim().min(1).max(256),
  bundleId: z16.string().trim().min(1).max(512).optional()
}).strict();
var toolCallRowSchema = z16.object({
  ...rowBaseFields,
  kind: z16.literal("toolCall"),
  // 同一模型 response 的正文与工具共享此 ID；optional 兼容旧 snapshot。
  assistantResponseId: z16.string().min(1).optional(),
  toolCallId: z16.string(),
  toolName: z16.string(),
  status: z16.enum(["inputStreaming", "pendingApproval", "running", "success", "error", "cancelled"]),
  inputText: z16.string(),
  input: z16.unknown().optional(),
  cuaApp: cuaAppIdentitySchema.optional(),
  output: toolOutputSchema.optional(),
  // display 解析失败只丢这张卡的载荷，不拒整条 row（理由见 toolDisplay.ts 的 toolOutputSchema
  // 注释：装饰载荷不得决定 row/帧/订阅的生死）。
  display: toolCallDisplaySchema.optional().catch(void 0),
  // status=error 时必带。
  error: z16.object({ code: z16.string(), message: z16.string() }).optional(),
  // 仅 replayable 档运行中出现，终态清除。
  progress: toolProgressSchema.optional(),
  // continuous/replayable 共用的有界 Bash 内容，终态或后台移交时清除。
  outputPreview: executionOutputPreviewSchema.optional(),
  // status=pendingApproval 时指向 pendingInteractions 项。
  approvalInteractionId: z16.string().optional(),
  backgrounded: z16.literal(true).optional(),
  workId: z16.string().optional(),
  startedAt: timestampSchema.optional(),
  endedAt: timestampSchema.optional()
});
var conversationArtifactTypeSchema = z16.enum([
  "pdf",
  "pptx",
  "docx",
  "xlsx",
  "image",
  "html",
  "md",
  "text"
]);
var artifactRowSchema = z16.object({
  ...rowBaseFields,
  kind: z16.literal("artifact"),
  artifactVersionId: z16.string().trim().min(1),
  logicalArtifactKey: z16.string().trim().min(1),
  displayName: z16.string().trim().min(1),
  artifactType: conversationArtifactTypeSchema,
  mimeType: z16.string().trim().min(1),
  sizeBytes: z16.number().int().nonnegative(),
  sha256: z16.string().regex(/^[0-9a-f]{64}$/u),
  ref: z16.string().trim().min(1),
  state: z16.literal("current")
});
var subagentRowSchema = z16.object({
  ...rowBaseFields,
  kind: z16.literal("subagent"),
  // 触发该子智能体的 Agent/Task 工具调用；并发 spawn 顺序不可作为关联依据。
  parentToolCallId: z16.string().optional(),
  subagentType: z16.string(),
  status: z16.enum(["running", "success", "failed", "cancelled"]),
  summaryText: z16.string(),
  // 存在 → UI 可下钻订阅 conversation/<childSessionId>（不内嵌 child rows）。
  childSessionId: z16.string().optional(),
  backgrounded: z16.literal(true).optional(),
  workId: z16.string().optional(),
  startedAt: timestampSchema.optional(),
  endedAt: timestampSchema.optional()
});
var hookExecutionDescriptorSchema = z16.object({
  clientVisible: z16.literal(true),
  sourceKind: z16.enum(["user", "plugin", "project", "internal"]),
  sourcePath: z16.string().optional(),
  pluginId: z16.string().optional(),
  pluginName: z16.string().optional(),
  statusMessage: z16.string().optional(),
  executionType: z16.enum(["process", "command"]),
  executionMode: z16.enum(["foreground", "background"]),
  commandDisplay: z16.string(),
  timeoutMs: z16.number().int().positive()
}).strict();
var hookExecutionProjectionSchema = z16.object({
  hookRunId: z16.string().min(1),
  hookIndex: z16.number().int().nonnegative(),
  // 同一 runId 已观察到 HookRunStarted 才为 true；admission-only blocked 为 false。
  didExecute: z16.boolean(),
  state: z16.enum(["running", "completed", "failed"]),
  outcome: z16.enum(["success", "blocked", "failed", "cancelled", "timed_out"]).optional(),
  blockReason: z16.string().trim().min(1).optional(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  durationMs: z16.number().nonnegative().optional(),
  displayName: z16.string().trim().min(1),
  sourceKind: z16.enum(["user", "plugin", "project"]),
  pluginName: z16.string().optional(),
  toolName: z16.string().optional()
}).strict();
var hookInvocationRowSchema = z16.object({
  ...rowBaseFields,
  kind: z16.literal("hookInvocation"),
  hookInvocationId: z16.string().min(1),
  hookEventName: z16.enum([
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "PostToolUseFailure",
    "Stop"
  ]),
  hookCount: z16.number().int().positive(),
  state: z16.enum(["running", "completed", "failed"]),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  durationMs: z16.number().nonnegative().optional(),
  lane: z16.enum(["assistantWork", "toolBefore", "toolAfter"]),
  anchorToolCallId: z16.string().optional(),
  executions: z16.array(hookExecutionProjectionSchema)
});
var timelineMarkerPayloadSchema = z16.union([
  z16.object({
    type: z16.literal("compact"),
    origin: z16.enum(["manual", "auto"]),
    status: z16.enum(["running", "success", "failed", "noop", "cancelled"]),
    tokensBefore: z16.number().optional(),
    tokensAfter: z16.number().optional(),
    summaryRef: z16.string().optional()
  }),
  // 出现在 child 会话首部（forkTimelineIsBoundary）。
  z16.object({
    type: z16.literal("forkNotice"),
    parentSessionId: z16.string(),
    parentRowId: z16.number()
  }),
  // 出现在 parent（可选展示）。
  z16.object({
    type: z16.literal("forkCreated"),
    childSessionId: z16.string(),
    atRowId: z16.number()
  }),
  z16.object({
    type: z16.literal("modelChange"),
    fromProvider: z16.string(),
    fromModel: z16.string(),
    toProvider: z16.string(),
    toModel: z16.string(),
    toThought: z16.string()
  }),
  z16.object({
    type: z16.literal("modelChange"),
    // 显式 ∅→X 模型边界没有来源；never 保证两个来源字段不能只出现一个，
    // 避免 renderer 接收到半个 provider/model 元组。
    fromProvider: z16.never().optional(),
    fromModel: z16.never().optional(),
    toProvider: z16.string(),
    toModel: z16.string(),
    toThought: z16.string()
  }),
  z16.object({
    type: z16.literal("goalSet"),
    objective: z16.string(),
    previousObjective: z16.string().optional()
  }),
  z16.object({
    type: z16.literal("goalVerify"),
    iteration: z16.number(),
    outcome: z16.enum(["running", "pass", "notSatisfied", "failed"]),
    detail: z16.string().optional()
  }),
  z16.object({
    type: z16.literal("retryNotice"),
    attempt: z16.number(),
    reasonCode: z16.string()
  }),
  // workspace 域动作在时间线上的回执。
  z16.object({
    type: z16.literal("checkpointRestored"),
    checkpointId: z16.string()
  })
]);
var timelineMarkerLaneSchema = z16.enum([
  "assistantWork",
  "turnTailBoundary",
  "lightBoundary"
]);
var timelineMarkerRowSchema = z16.object({
  ...rowBaseFields,
  kind: z16.literal("timelineMarker"),
  // 用户触发的 marker 必带。
  sourceCommandId: z16.string().optional(),
  lane: timelineMarkerLaneSchema.optional(),
  marker: timelineMarkerPayloadSchema
});
var conversationRowSchema = z16.discriminatedUnion("kind", [
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

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/snapshot.ts
import { z as z23 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/input-intent.ts
import { z as z20 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/submission.ts
import { z as z18 } from "zod";
var submissionModeSchema = z18.enum(["build", "edit", "plan", "yolo"]);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/shared-context-ref.ts
import { z as z19 } from "zod";
var sharedContextRefSchema = z19.object({
  kind: z19.literal("shared_context_import"),
  context_id: z19.string().trim().min(1)
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/input-intent.ts
var conversationInputDeliverySchema = z20.object({
  requested: z20.enum(["auto", "startNow", "queue", "guide"]),
  admitted: z20.enum(["startNow", "queue", "guide"]),
  fallbackReasonCode: z20.string().optional()
}).strict();
var conversationInputOrderSchema = z20.object({
  admissionSeq: z20.number().int().nonnegative(),
  queuePosition: z20.number().int().nonnegative().optional()
}).strict();
var conversationInputSteerSchema = z20.object({
  state: z20.enum(["notRequested", "submitting", "steering", "guided", "fellBack"]),
  reasonCode: z20.string().optional()
}).strict();
var conversationInputDispatchSchema = z20.object({
  state: z20.enum(["admitted", "queued", "reserved", "promoting", "drained"]),
  reservationId: z20.string().optional()
}).strict();
var conversationInputIntentSchema = z20.object({
  sourceCommandId: z20.string().min(1),
  queueItemId: z20.string().min(1),
  clientId: z20.string().min(1),
  // compact 是可排队的维护意图；消费时走 compact lifecycle，不投影为 user row。
  kind: z20.enum(["sendText", "sendGoalCommand", "compact"]),
  text: z20.string(),
  attachments: z20.array(attachmentRefSchema).default([]),
  // optional 只服务旧 snapshot hydration；新 admission 必须填入完整 Submission。
  modelSelection: modelSelectionSchema.optional(),
  mode: submissionModeSchema.optional(),
  planEnabled: z20.boolean().optional(),
  sharedContextRefs: z20.array(sharedContextRefSchema).max(1).optional(),
  delivery: conversationInputDeliverySchema,
  order: conversationInputOrderSchema,
  steer: conversationInputSteerSchema,
  dispatch: conversationInputDispatchSchema,
  admittedAt: timestampSchema,
  provenance: z20.object({
    sourceCommandId: z20.string().min(1),
    queueItemId: z20.string().min(1).optional(),
    clientId: z20.string().min(1).optional()
  }).strict().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workspace-hook-review.ts
import { z as z21 } from "zod";
var nonEmptyStringSchema = z21.string().trim().min(1);
var positiveIntegerSchema = z21.number().int().positive();
var nonnegativeIntegerSchema = z21.number().int().nonnegative();
var sha256DigestSchema = z21.string().regex(/^[a-f0-9]{64}$/u);
var workspaceHookReviewTrustStateSchema = z21.enum([
  "not_applicable",
  "pending_trust",
  "trusted_persistent",
  "blocked_untrusted",
  "blocked_policy",
  "revoked",
  "stale_digest"
]);
var workspaceHookReviewDecisionSchema = z21.object({
  action: z21.literal("trust_selected"),
  reviewItemIds: z21.array(nonEmptyStringSchema).min(1)
}).strict().superRefine((decision, context) => {
  if ("reviewItemIds" in decision && decision.reviewItemIds) {
    addDuplicateItemIssue(decision.reviewItemIds, context, ["reviewItemIds"]);
  }
});
var workspaceHookReviewCommandTargetSchema = z21.object({
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
var workspaceHookTrustRevokeTargetSchema = z21.object({
  sessionId: nonEmptyStringSchema,
  remoteSessionId: nonEmptyStringSchema.optional(),
  workspaceIdentity: nonEmptyStringSchema,
  bundleDigest: sha256DigestSchema,
  hookDeclarationDigests: z21.array(sha256DigestSchema).min(1)
}).strict().superRefine((target, context) => {
  addDuplicateItemIssue(target.hookDeclarationDigests, context, ["hookDeclarationDigests"]);
});
var requestWorkspaceHookReviewTargetSchema = z21.object({
  sessionId: nonEmptyStringSchema,
  remoteSessionId: nonEmptyStringSchema.optional(),
  workspaceIdentity: nonEmptyStringSchema,
  bundleDigest: sha256DigestSchema
}).strict();
var workspaceHookReviewRequestPayloadSchema = z21.object({
  kind: z21.literal("workspaceHookReview"),
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
  sourceFiles: z21.array(
    z21.object({
      path: nonEmptyStringSchema,
      displayPath: nonEmptyStringSchema,
      editable: z21.boolean()
    }).strict()
  ),
  summary: z21.object({
    eventCount: nonnegativeIntegerSchema,
    hookCount: nonnegativeIntegerSchema,
    pendingCount: nonnegativeIntegerSchema
  }).strict(),
  items: z21.array(
    z21.object({
      reviewItemId: nonEmptyStringSchema,
      event: z21.enum([
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PermissionRequest",
        "PostToolUse",
        "PostToolUseFailure",
        "Stop"
      ]),
      matcher: z21.string().optional(),
      type: z21.enum(["command", "process"]),
      displayName: nonEmptyStringSchema,
      displayCommand: nonEmptyStringSchema,
      sourcePath: nonEmptyStringSchema,
      resolvedTimeoutMs: positiveIntegerSchema,
      resolvedMaxOutputBytes: positiveIntegerSchema,
      executionMode: z21.enum(["foreground", "background"]),
      configuredEnabled: z21.boolean(),
      editable: z21.boolean(),
      trustState: workspaceHookReviewTrustStateSchema
    }).strict()
  ),
  warningCode: z21.literal("workspace_hooks_execute_code")
}).strict().superRefine((request, context) => {
  if (request.deadlineAt < request.createdAt) {
    context.addIssue({
      code: z21.ZodIssueCode.custom,
      path: ["deadlineAt"],
      message: "deadlineAt must not precede createdAt"
    });
  }
  if (request.summary.hookCount !== request.items.length) {
    context.addIssue({
      code: z21.ZodIssueCode.custom,
      path: ["summary", "hookCount"],
      message: "hookCount must match the immutable request items"
    });
  }
  const eventCount = new Set(request.items.map((item) => item.event)).size;
  if (request.summary.eventCount !== eventCount) {
    context.addIssue({
      code: z21.ZodIssueCode.custom,
      path: ["summary", "eventCount"],
      message: "eventCount must match the immutable request items"
    });
  }
  const pendingCount = request.items.filter(
    (item) => ["pending_trust", "revoked", "stale_digest"].includes(item.trustState)
  ).length;
  if (request.summary.pendingCount !== pendingCount) {
    context.addIssue({
      code: z21.ZodIssueCode.custom,
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
var presentWorkspaceHookReviewRequestSchema = z21.object({
  reviewFlowId: nonEmptyStringSchema,
  generation: positiveIntegerSchema,
  interactionId: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  workspaceIdentity: nonEmptyStringSchema,
  bundleDigest: sha256DigestSchema,
  settingsSection: z21.literal("hooks"),
  settingsScope: z21.literal("workspace")
}).strict();
function addDuplicateItemIssue(values, context, path) {
  if (new Set(values).size === values.length) return;
  context.addIssue({
    code: z21.ZodIssueCode.custom,
    path,
    message: "review item ids must be unique"
  });
}

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/session-config.ts
import { z as z22 } from "zod";
var sessionConfigStateSchema = z22.object({
  /** Session 接受并持久化的稀疏选择意图；provider/model/thought 仅为 UI effective 投影。 */
  modelSelection: modelSelectionSchema.optional(),
  provider: z22.string(),
  model: z22.string(),
  thought: z22.string(),
  // 思考档位是当前模型的能力，不是 workspace/UI 偏好。
  // default 仅用于兼容旧快照；新 agent 必须从 runtime 投影实际集合。
  thoughtLevels: z22.array(z22.string()).default([]),
  followupMode: z22.enum(["queue", "guide"]),
  // additive（冻结面演进，同 meta 的裁决口径）：agent 协作模式（core CollaborationMode）。
  // 必须带 default 才不破坏旧快照/旧发送端的解析；投影经 SessionModeChanged 事件更新。
  mode: z22.string().default("build"),
  planEnabled: z22.boolean().optional(),
  /** 明确审批结果；草稿按 interactionId 消费一次，普通 mode 更新不重置它。 */
  permissionGrant: z22.object({ interactionId: z22.string().min(1) }).optional(),
  /** 最近工具转换的关联，供草稿定向同步；不新增可见历史事件。 */
  planTransition: z22.object({
    toolCallId: z22.string(),
    planEnabled: z22.boolean()
  }).optional()
});
var sessionModelTransitionSchema = z22.object({
  eventId: z22.string().min(1),
  origin: z22.literal("registryFallback"),
  from: z22.object({
    provider: z22.string(),
    model: z22.string()
  }),
  to: z22.object({
    provider: z22.string(),
    model: z22.string()
  })
});

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/snapshot.ts
var sessionPhaseSchema = z23.enum([
  // draft 裁决保留——纯内存态、sessions-index 可见、无 row、
  // 不落盘、CLI 重启即消失；firstInput 到达 → prewarming/running。
  "draft",
  "prewarming",
  "running",
  "completedSuccess",
  "completedInterrupted",
  "error"
]);
var stopTargetKindSchema = z23.enum([
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
var activeWorkSummarySchema = z23.object({
  kind: z23.enum([
    "primaryTurn",
    "foregroundSubagent",
    "compact",
    "goalVerifier",
    "goalContinuation",
    "turnSteer"
  ]),
  foregroundExecutionId: z23.string().min(1).optional(),
  startedAt: timestampSchema
});
var errorAttributionSchema = z23.object({
  source: z23.enum(["provider", "runtime", "tool", "network"]).optional(),
  reason: z23.string().min(1).max(160).optional(),
  errorPhase: z23.enum([
    "prepare",
    "configuration",
    "connect",
    "response",
    "stream",
    "parse",
    "validation",
    "unhandled"
  ]).optional(),
  exceptionKind: z23.enum([
    "api_call",
    "generic",
    "protocol",
    "provider_business",
    "transport",
    "type_error",
    "validation"
  ]).optional(),
  providerId: z23.string().min(1).max(160).optional(),
  modelId: z23.string().min(1).max(160).optional(),
  providerKind: z23.string().min(1).max(160).optional(),
  transport: z23.enum(["http", "sse", "websocket"]).optional(),
  statusCode: z23.number().int().min(100).max(599).optional(),
  providerErrorCode: z23.string().min(1).max(160).optional(),
  retryable: z23.boolean().optional()
}).strict();
var sessionErrorInfoSchema = z23.object({
  code: z23.string(),
  message: z23.string(),
  recoverable: z23.boolean(),
  at: timestampSchema,
  source: z23.enum(["provider", "runtime", "tool", "network"]),
  traceId: z23.string().optional(),
  detail: z23.string().optional(),
  underlyingErrorMessage: z23.string().optional(),
  underlyingErrorDetail: z23.string().optional(),
  attribution: errorAttributionSchema.optional()
});
var apiRetryStateSchema = z23.object({
  attempt: z23.number(),
  maxAttempts: z23.number(),
  nextRetryAt: timestampSchema,
  reasonCode: z23.string()
});
var sessionControlSchema = z23.object({
  phase: sessionPhaseSchema,
  // 派生值（= phase ∈ completed*），为 UI 便利保留。
  sessionEnded: z23.boolean(),
  canStop: z23.boolean(),
  stopState: z23.enum(["idle", "stoppable", "stopping"]),
  stopTargetKind: stopTargetKindSchema,
  // 轻量证据/悬浮提示用，UI 不得据此推导 flag。
  // hasBackgroundWork 不在载荷内：客户端按 backgroundWorks.some(w => w.status === "running") 一行派生。
  activeWorks: z23.array(activeWorkSummarySchema),
  lastError: sessionErrorInfoSchema.nullable(),
  apiRetry: apiRetryStateSchema.nullable()
});
var actionAvailabilitySchema = z23.discriminatedUnion("allowed", [
  z23.object({ allowed: z23.literal(true) }),
  // reasonCode = product-protocol guard id，驱动禁用态 tooltip。
  z23.object({ allowed: z23.literal(false), reasonCode: z23.string() })
]);
var sessionActionAvailabilitySchema = z23.object({
  fork: actionAvailabilitySchema,
  compact: actionAvailabilitySchema,
  switchModelConfig: actionAvailabilitySchema,
  setFollowupMode: actionAvailabilitySchema,
  queueEdit: actionAvailabilitySchema,
  sendQueuedNow: actionAvailabilitySchema,
  pauseGoal: actionAvailabilitySchema,
  resumeGoal: actionAvailabilitySchema
});
var inputRoutingSchema = z23.object({
  // choice：held（completed+queue>0+autoDrain=false）下
  // 输入不静默入队，客户端呈现「清空 queue 后发送 / 保留 queue 立即发送」。
  mode: z23.enum(["startNow", "enqueue", "guide", "reject", "choice"]),
  // mode=reject 必带；enqueue/guide/choice 可带（如 guide 不合格回退原因）。
  reasonCode: z23.string().optional()
});
var sessionMetaStateSchema = z23.object({
  title: z23.string(),
  // default = 未命名；generated = 模型自动生成；custom = 用户显式重命名（不再被自动标题覆盖）。
  titleSource: z23.enum(["default", "generated", "custom"])
});
var sessionUsageStateSchema = z23.object({
  contextWindow: z23.object({
    usedTokens: z23.number(),
    maxTokens: z23.number(),
    autoCompactThresholdTokens: z23.number().nullable(),
    cache: zcodeSessionContextCacheUsageSchema.optional(),
    breakdown: zcodeContextUsageBreakdownSchema.optional()
  }).nullable(),
  cumulative: z23.object({
    inputTokens: z23.number(),
    outputTokens: z23.number(),
    cacheReadTokens: z23.number(),
    cacheWriteTokens: z23.number()
  })
});
var queueItemSchema = conversationInputIntentSchema.extend({
  dispatch: conversationInputDispatchSchema.extend({
    state: z23.enum(["queued", "reserved", "promoting"])
  }),
  toolDisallowlist: z23.array(z23.string().min(1)).optional()
});
var queueStateSchema = z23.object({
  items: z23.array(queueItemSchema),
  // stop 后 = false（暂停队列）；setAutoDrain 恢复。
  autoDrain: z23.boolean(),
  // additive：旧快照缺省时 UI 使用通用暂停文案；Stop/TurnError 可显示原因文案。
  pauseReason: z23.enum(["stopped", "manual", "error"]).optional()
});
var PERMISSION_FULL_ACCESS_OPTION_ID = "fullAccess";
var permissionOptionSchema = z23.object({
  optionId: z23.string(),
  label: z23.string(),
  kind: z23.enum(["allowOnce", "allowAlways", "deny", "custom"]),
  response: zcodePermissionResponseSchema.optional()
});
var permissionRequestPayloadSchema = z23.object({
  kind: z23.literal("permission"),
  toolCallId: z23.string(),
  toolName: z23.string(),
  summary: z23.string(),
  detail: z23.unknown(),
  // additive：旧 snapshot 缺省时 UI 不显示反馈输入；V4 新投影可显式开启。
  freeText: z23.boolean().optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  // 工具自报的确认预览，复用 row 的 display 投影（同一有界形状）。缺省 = 纯文本 ask。
  // 同样不设门：预览解析失败退化成纯文本 ask，不拒整份 snapshot（见 toolDisplay.ts 注释）。
  display: toolCallDisplaySchema.optional().catch(void 0),
  // 独立 additive 能力：旧 UI 忽略此字段，仍只显示原 options，不出现半实现授权入口。
  fullAccessOption: permissionOptionSchema.extend({
    optionId: z23.literal(PERMISSION_FULL_ACCESS_OPTION_ID),
    kind: z23.literal("custom")
  }).optional(),
  options: z23.array(permissionOptionSchema)
});
var userInputOptionPayloadSchema = z23.object({
  value: z23.string(),
  label: z23.string(),
  description: z23.string().optional(),
  preview: z23.string().optional()
});
var userInputQuestionPayloadSchema = z23.object({
  question: z23.string(),
  header: z23.string(),
  options: z23.array(userInputOptionPayloadSchema),
  multiSelect: z23.boolean().optional()
});
var userInputRequestPayloadSchema = z23.object({
  kind: z23.literal("userInput"),
  prompt: z23.string(),
  freeText: z23.boolean(),
  options: z23.array(z23.object({ optionId: z23.string(), label: z23.string() })).optional(),
  // true → 输入框按密码处理，客户端不入草稿/历史。
  sensitive: z23.boolean().optional(),
  toolName: z23.string().optional(),
  toolCallId: z23.string().optional(),
  traceId: z23.string().optional(),
  input: z23.unknown().optional(),
  schema: z23.unknown().optional(),
  questions: z23.array(userInputQuestionPayloadSchema).optional(),
  currentQuestionIndex: z23.number().optional(),
  answerDrafts: z23.record(z23.string(), z23.array(z23.string())).optional(),
  origin: zcodeInteractionRequestOriginSchema.optional()
});
var interactionAutoResolutionSchema = z23.discriminatedUnion("state", [
  z23.object({
    state: z23.enum(["hiddenGrace", "visibleCountdown"]),
    startedAt: timestampSchema,
    visibleAt: timestampSchema,
    deadlineAt: timestampSchema
  }),
  z23.object({
    state: z23.literal("snoozed"),
    startedAt: timestampSchema,
    snoozedAt: timestampSchema
  })
]);
var pendingInteractionSchema = z23.object({
  interactionId: z23.string(),
  kind: z23.enum(["permission", "userInput", "workspaceHookReview"]),
  // null = 会话级（如 provider 交互和 workspace Hook review）。
  anchorRowId: z23.number().nullable(),
  createdAt: timestampSchema,
  autoResolution: interactionAutoResolutionSchema.optional(),
  payload: z23.discriminatedUnion("kind", [
    permissionRequestPayloadSchema,
    userInputRequestPayloadSchema,
    workspaceHookReviewRequestPayloadSchema
  ])
}).superRefine((interaction, context) => {
  if (interaction.kind !== interaction.payload.kind) {
    context.addIssue({
      code: z23.ZodIssueCode.custom,
      path: ["kind"],
      message: "pending interaction kind must match payload kind"
    });
  }
  if (interaction.kind === "workspaceHookReview" && interaction.autoResolution) {
    context.addIssue({
      code: z23.ZodIssueCode.custom,
      path: ["autoResolution"],
      message: "workspaceHookReview cannot use AskUserQuestion auto-resolution"
    });
  }
  if (interaction.payload.kind === "workspaceHookReview" && interaction.interactionId !== interaction.payload.interactionId) {
    context.addIssue({
      code: z23.ZodIssueCode.custom,
      path: ["interactionId"],
      message: "workspaceHookReview interaction id must match its immutable payload"
    });
  }
});
var commandStateSummarySchema = z23.object({
  commandId: z23.string(),
  clientId: z23.string(),
  type: z23.string(),
  state: z23.enum(["accepted", "executing"]),
  at: timestampSchema
});
var backgroundWorkSummarySchema = z23.object({
  workId: z23.string(),
  // workflow = workflow run（CreateWorkflow）。**闭集加值的偏斜代价**：
  // 旧桌面收到未知值时整个 state.updated patch 解析失败（已知键的非法值是错误，不是剥离），
  // 于是整帧被 assembler 拒收，且 resync 的 snapshot 携带同一个值、同样失败——不能优雅降级。
  // CLI 与桌面同批发布才使它可接受。
  kind: z23.enum(["bash", "subagent", "workflow"]),
  title: z23.string(),
  // resultPending = 已完成、结果在 continuation inbox 等待前台空闲；
  // 投递后条目消失（结果本体成为 origin=backgroundResult 的 userInput row）。
  status: z23.enum(["running", "resultPending", "failed", "cancelled"]),
  startedAt: timestampSchema,
  endedAt: timestampSchema.optional(),
  cancellable: z23.boolean().optional(),
  blocked: z23.boolean().optional(),
  anchorRowId: z23.number().nullable(),
  childSessionId: z23.string().optional()
});
var runningSubagentSummarySchema = z23.object({
  childSessionId: z23.string(),
  agentId: z23.string().optional(),
  toolCallId: z23.string().optional(),
  subagentType: z23.string(),
  title: z23.string(),
  summary: z23.string().optional(),
  status: z23.enum(["running", "waiting", "blocked"]),
  startedAt: timestampSchema.optional()
});
var subagentProjectionStateSchema = z23.object({
  revision: z23.number().int().nonnegative(),
  childSessionIds: z23.array(z23.string()),
  running: z23.array(runningSubagentSummarySchema),
  endedTotal: z23.number().int().nonnegative()
});
var planItemSchema = z23.object({
  id: z23.string(),
  content: z23.string(),
  status: z23.enum(["pending", "inProgress", "completed"])
});
var goalIterationStateSchema = z23.object({
  iteration: z23.number().int().positive(),
  items: z23.array(planItemSchema),
  updatedAt: timestampSchema
});
var goalStateSchema = z23.object({
  // default 仅用于旧快照兼容；新投影始终携带当前 target 身份和计时事实。
  targetId: z23.string().default(""),
  objective: z23.string(),
  summaryTitle: z23.string().nullable().default(null),
  timeUsedSeconds: z23.number().int().nonnegative().default(0),
  activeRunStartedAtMs: z23.number().int().nonnegative().nullable().default(null),
  // paused：stop 作用于任何 foreground work 时 target 强制进入（stopPausesActiveGoalTarget）。
  // notSatisfied 与 failed 分离：前者是有效结论，后者是验证过程失败。
  status: z23.enum(["active", "paused", "verifying", "verified", "notSatisfied", "failed"]),
  iteration: z23.number(),
  verifications: z23.array(
    z23.object({
      iteration: z23.number(),
      outcome: z23.enum(["pass", "notSatisfied", "failed"]),
      at: timestampSchema,
      anchorRowId: z23.number().nullable(),
      reason: z23.string().optional(),
      nextAction: z23.string().optional()
    })
  ),
  iterations: z23.array(goalIterationStateSchema).default([])
});
var planStateSchema = z23.object({
  items: z23.array(planItemSchema),
  updatedAt: timestampSchema
});
var rowsWindowSchema = z23.object({
  // 尾部窗口，rowId 升序。
  window: z23.array(conversationRowSchema),
  // 当前全序行数（截断后会减小；仅用于滚动条估计）。
  totalCount: z23.number(),
  // 全序第一行 rowId；window 首行等于它 ⇔ 已到顶（游标分页判定）。
  firstRowId: z23.number().nullable()
});
var workspaceHookAdmissionStateSchema = z23.object({
  pendingCount: z23.number().int().nonnegative(),
  bundleDigest: z23.string(),
  workspaceIdentity: z23.string().optional()
});
var conversationSnapshotSchema = z23.object({
  protocolVersion: z23.literal(1),
  sessionId: z23.string(),
  logEpoch: z23.string(),
  // 快照对齐水位（= 所在帧 toSeq；从内存投影原子取值）。
  seq: z23.number(),
  revision: z23.number(),
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
  pendingInteractions: z23.array(pendingInteractionSchema),
  pendingCommands: z23.array(commandStateSummarySchema),
  backgroundWorks: z23.array(backgroundWorkSummarySchema),
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

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/delta.ts
var statePatchSchema = z24.object({
  revision: z24.number().optional(),
  control: sessionControlSchema.optional(),
  sharedContextImport: sharedContextImportStateSchema.optional(),
  availability: sessionActionAvailabilitySchema.optional(),
  inputRouting: inputRoutingSchema.optional(),
  meta: sessionMetaStateSchema.optional(),
  config: sessionConfigStateSchema.optional(),
  modelTransition: sessionModelTransitionSchema.nullable().optional(),
  usage: sessionUsageStateSchema.optional(),
  queue: queueStateSchema.optional(),
  pendingInteractions: z24.array(pendingInteractionSchema).optional(),
  pendingCommands: z24.array(commandStateSummarySchema).optional(),
  backgroundWorks: z24.array(backgroundWorkSummarySchema).optional(),
  subagents: subagentProjectionStateSchema.optional(),
  // workflow run 的实时运行态。容器本身不 strict，所以旧桌面收到这个新键只是**剥离一个键**、
  // 保住 patch 其余全部键——这正是它不需要任何版本偏斜防御的原因。
  workflowRuns: workflowRunsStateSchema.optional(),
  goal: goalStateSchema.nullable().optional(),
  plan: planStateSchema.nullable().optional(),
  // 软门禁：null = pending 清零(提示条消失);对象 = 待审核状态更新。
  workspaceHookAdmission: workspaceHookAdmissionStateSchema.nullable().optional()
});
var workflowRunHeaderSchema = workflowRunSchema.omit({ actors: true, nodes: true });
var workflowRunHeaderPatchSchema = workflowRunHeaderSchema.partial();
var workflowRunHeaderKeySchema = workflowRunHeaderSchema.keyof();
var workflowRunEntryRefSchema = workflowRunActorSchema.pick({
  siteId: true,
  ordinal: true
});
var conversationDeltaSchema = z24.discriminatedUnion("op", [
  // 追加到尾部（99%）。
  z24.object({ op: z24.literal("row.appended"), row: conversationRowSchema }),
  // 按 rowId 整行替换（状态机迁移）。
  z24.object({ op: z24.literal("row.upserted"), row: conversationRowSchema }),
  // 删除该行及之后所有（edit/retry 分支）。作用于客户端已加载集合中所有 rowId >= fromRowId 的行。
  z24.object({ op: z24.literal("row.removed"), fromRowId: z24.number() }),
  // 流式文本追加。仅允许作用于流式态行（服务端保证，客户端可断言）。
  z24.object({
    op: z24.literal("row.delta"),
    rowId: z24.number(),
    path: streamablePathSchema,
    append: z24.string()
  }),
  z24.object({ op: z24.literal("state.updated"), patch: statePatchSchema }),
  /**
   * 一条 dwf run 的键级增量。`revision` 是**这次变化之后**的 `workflowRuns.revision`（绝对值）；
   * 一条引擎事件最多产生一条本 op（节点相位、派生的 actor 状态、用量、水位一起落地，原子）。
   *
   * 六个载荷各有各的语义：`run` 按键整体替换、`cleared` 说哪些键变成了缺席、
   * `removedActors` / `removedNodes` 按 (siteId, ordinal) 删条目、`actors` / `nodes` 按同一个键
   * 整条 upsert。四张表的界与状态键同值——增量不该能拼出一个非法的状态。
   *
   * **施加序是 header → 删除 → upsert**，写在这里也写在字段序上：同一个键在一条 op 里被删又被加
   * （溢出过的 run 在 resume 时清表重开，或一个条目被淘汰后又回来）必须落在表尾，才与顺序施加
   * 两条 op 的结果一致。
   */
  z24.object({
    op: z24.literal("workflowRun.updated"),
    runId: workflowRunSchema.shape.runId,
    revision: workflowRunsStateSchema.shape.revision,
    run: workflowRunHeaderPatchSchema.optional(),
    cleared: z24.array(workflowRunHeaderKeySchema).max(workflowRunHeaderKeySchema.options.length).optional(),
    removedActors: z24.array(workflowRunEntryRefSchema).max(WORKFLOW_RUNS_LIMITS.maxActors).optional(),
    removedNodes: z24.array(workflowRunEntryRefSchema).max(WORKFLOW_RUNS_LIMITS.maxNodes).optional(),
    actors: z24.array(workflowRunActorSchema).max(WORKFLOW_RUNS_LIMITS.maxActors).optional(),
    nodes: z24.array(workflowRunNodeSchema).max(WORKFLOW_RUNS_LIMITS.maxNodes).optional()
  }),
  /** 这条 run 被生产者淘汰了（只有生产者淘汰，而且必须说出来——客户端永远不自行施加上界）。 */
  z24.object({
    op: z24.literal("workflowRun.removed"),
    runId: workflowRunSchema.shape.runId,
    revision: workflowRunsStateSchema.shape.revision
  })
]);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/sessions-index.ts
import { z as z26 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/sessions-index-workflow-activity.ts
import { z as z25 } from "zod";
var SESSION_WORKFLOW_ACTIVITY_MAX_RUNS = 4;
var sessionWorkflowPhaseStatusSchema = z25.enum(["pending", "running", "done", "failed"]);
var sessionWorkflowPhaseSummarySchema = z25.object({
  name: z25.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength),
  status: sessionWorkflowPhaseStatusSchema,
  /**
   * 进入本站时仍在跑的其他站的**下标**（下标落在本 `phases` 数组上），来自
   * `run.phaseAlongside`。侧栏据此把并行的两站之间画成双线段。只有声明表那条路有这个事实——
   * 退化路（已进入的 phase）是按进入序拼出来的，没有并行可言，所以那时整个键缺席。
   */
  alongside: z25.array(z25.number().int().nonnegative()).max(WORKFLOW_RUNS_LIMITS.maxPhases).optional()
});
var sessionWorkflowRunSummarySchema = z25.object({
  runId: z25.string().min(1),
  /** 发起行的工具调用 id：点击运行行打开 run pane 的键；直接启动的 run 也有（`launch-` 前缀）。 */
  toolCallId: z25.string().min(1).optional(),
  /** 工作流后台工作的标题（= run 的展示名）；投影里没有对应后台工作时缺席。 */
  name: z25.string().min(1).optional(),
  status: workflowRunSchema.shape.status,
  stopReason: workflowRunSchema.shape.stopReason,
  /** 后台工作的开始时刻，tooltip 的 elapsed 用；没有后台工作时缺席。 */
  startedAt: timestampSchema.optional(),
  /**
   * 站点表，声明序：`run.phaseNames`（run-launched 带来的声明表）在场用它，否则退化为已进入的
   * phase + 当前 phase（进入序）。两者都没有时为空数组，UI 画一个隐含站点「Workflow」。
   */
  phases: z25.array(sessionWorkflowPhaseSummarySchema).max(WORKFLOW_RUNS_LIMITS.maxPhases),
  currentPhase: z25.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxPhaseNameLength).optional(),
  /** status === "running" 的子代理数（tooltip 的「{n} agents working」）。 */
  agentsWorking: z25.number().int().nonnegative()
});
var sessionWorkflowActivitySchema = z25.object({
  runs: z25.array(sessionWorkflowRunSummarySchema).max(SESSION_WORKFLOW_ACTIVITY_MAX_RUNS)
});

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/sessions-index.ts
var sessionPendingInteractionSummarySchema = z26.object({
  interactionId: z26.string(),
  kind: z26.enum(["permission", "userInput"]),
  // 只下发轻量工具身份，侧栏据此区分 AskUserQuestion 与其他阻塞确认；不携带问题或答案。
  toolName: z26.string().optional(),
  autoResolution: interactionAutoResolutionSchema.optional()
});
var pendingInteractionSummarySchema = z26.object({
  permissionCount: z26.number().int().nonnegative(),
  userInputCount: z26.number().int().nonnegative()
});
var sessionSummarySchema = z26.object({
  sessionId: z26.string(),
  workspaceId: z26.string(),
  // fork 树。
  parentSessionId: z26.string().optional(),
  title: z26.string(),
  // custom = 用户显式重命名；default/generated 都不是产品语义上的手动标题。
  // optional 是为了兼容旧 sessions-index frame / 旧持久化摘要。
  titleSource: sessionMetaStateSchema.shape.titleSource.optional(),
  phase: sessionPhaseSchema,
  sessionEnded: z26.boolean(),
  // 列表小圆点用（此处保留布尔，避免为侧栏订阅整个 backgroundWorks）。
  hasBackgroundWork: z26.boolean(),
  // 侧栏工作流运行行：有界的 run 摘要，
  // 只装画迷你轨道要的字段；会话没有任何 run 时缺席。optional 兼容旧 frame / 旧 CLI。
  workflowActivity: sessionWorkflowActivitySchema.optional(),
  pendingInteraction: sessionPendingInteractionSummarySchema.optional(),
  // 侧栏只需要 kind/count，不下发问题、命令或答案等敏感 payload。
  // optional 兼容旧 sessions-index frame / stored summary。
  pendingInteractionSummary: pendingInteractionSummarySchema.optional(),
  goalStatus: goalStateSchema.shape.status.optional(),
  // 未读推导：客户端本地记 lastSeenActivityAt 比较（不用 seq，epoch 会重置）。
  lastActivityAt: timestampSchema,
  // ≤120 字符。
  lastAssistantPreview: z26.string().optional(),
  createdAt: timestampSchema
});
var sessionsIndexSnapshotSchema = z26.object({
  protocolVersion: z26.literal(1),
  workspaceId: z26.string(),
  // host 级列表日志代际（与各 session 的 logEpoch 无关）。
  logEpoch: z26.string(),
  // 无序；排序是客户端展示逻辑。
  sessions: z26.array(sessionSummarySchema)
});
var sessionsIndexDeltaSchema = z26.discriminatedUnion("op", [
  // conflation key = sessionId。
  z26.object({ op: z26.literal("session.upserted"), session: sessionSummarySchema }),
  z26.object({ op: z26.literal("session.removed"), sessionId: z26.string() })
]);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workspace-config.ts
import { z as z27 } from "zod";
var workspaceConfigSelectValueSchema = z27.object({
  value: z27.string(),
  name: z27.string(),
  description: z27.string().optional(),
  // 值来源：原生模型列表或会话侧注入项（UI 去重与展示控制）。
  origin: z27.enum(["native", "injected"]).optional(),
  // 模型选项所属供应商/分组 id（provider → model 分组选择）。
  modelProviderId: z27.string().optional(),
  modelProviderName: z27.string().optional(),
  // 缺失表示旧 payload/能力未知；空数组表示 catalog 已知没有可选 reasoning 档位。
  modelThoughtLevels: z27.array(z27.string()).optional(),
  modelDefaultThoughtLevel: z27.string().optional()
});
var workspaceConfigOptionSchema = z27.object({
  id: z27.string(),
  name: z27.string(),
  description: z27.string().optional(),
  category: z27.string().optional(),
  type: z27.enum(["select", "boolean"]),
  currentValue: z27.union([z27.string(), z27.boolean()]),
  options: z27.array(workspaceConfigSelectValueSchema).optional()
});
var workspaceSlashCommandSchema = z27.object({
  name: z27.string(),
  description: z27.string(),
  inputHint: z27.string().optional(),
  source: z27.enum(["builtin", "custom"]).optional()
});
var workspaceConfigStateSchema = z27.object({
  configOptions: z27.array(workspaceConfigOptionSchema),
  slashCommands: z27.array(workspaceSlashCommandSchema)
});
var workspaceConfigSnapshotSchema = z27.object({
  protocolVersion: z27.literal(1),
  workspaceId: z27.string(),
  // host 级配置日志代际（与 sessions-index 的 logEpoch 同构、彼此独立）。
  logEpoch: z27.string(),
  config: workspaceConfigStateSchema
});
var workspaceConfigDeltaSchema = z27.discriminatedUnion("op", [
  z27.object({ op: z27.literal("config.updated"), config: workspaceConfigStateSchema })
]);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/wire.ts
import { z as z29 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/wire-binary.ts
import { z as z28 } from "zod";
var topicWireBase64Schema = z28.string().min(4).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u);
function crc32WireBytes(bytes) {
  let crc = 4294967295;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
    }
  }
  return ((crc ^ 4294967295) >>> 0).toString(16).padStart(8, "0");
}
var BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function encodeWireBytesBase64(bytes) {
  let result = "";
  let block = [];
  for (let offset = 0; offset < bytes.byteLength; offset += 3) {
    const a = bytes[offset] ?? 0;
    const hasB = offset + 1 < bytes.byteLength;
    const hasC = offset + 2 < bytes.byteLength;
    const b = hasB ? bytes[offset + 1] ?? 0 : 0;
    const c = hasC ? bytes[offset + 2] ?? 0 : 0;
    block.push(
      BASE64_ALPHABET[a >>> 2],
      BASE64_ALPHABET[(a & 3) << 4 | b >>> 4],
      hasB ? BASE64_ALPHABET[(b & 15) << 2 | c >>> 6] : "=",
      hasC ? BASE64_ALPHABET[c & 63] : "="
    );
    if (block.length >= 16384) {
      result += block.join("");
      block = [];
    }
  }
  return result + block.join("");
}
function decodeWireBase64(value) {
  if (!topicWireBase64Schema.safeParse(value).success) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const output = new Uint8Array(value.length / 4 * 3 - padding);
  let writeOffset = 0;
  for (let offset = 0; offset < value.length; offset += 4) {
    const a = BASE64_ALPHABET.indexOf(value[offset]);
    const b = BASE64_ALPHABET.indexOf(value[offset + 1]);
    const c = value[offset + 2] === "=" ? 0 : BASE64_ALPHABET.indexOf(value[offset + 2]);
    const d = value[offset + 3] === "=" ? 0 : BASE64_ALPHABET.indexOf(value[offset + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) return null;
    const combined = a << 18 | b << 12 | c << 6 | d;
    if (writeOffset < output.length) output[writeOffset++] = combined >>> 16;
    if (writeOffset < output.length) {
      output[writeOffset++] = combined >>> 8 & 255;
    }
    if (writeOffset < output.length) output[writeOffset++] = combined & 255;
  }
  return output;
}

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/wire.ts
var topicWireChecksumSchema = z29.object({
  algorithm: z29.literal("crc32"),
  value: z29.string().regex(/^[0-9a-f]{8}$/u)
}).strict();
var topicFrameDeliveryKindSchema = z29.enum(["initial", "online", "recovery"]);
var topicWireFrameCandidateSchema = z29.discriminatedUnion("kind", [
  z29.object({
    wireVersion: z29.literal(V4_WIRE_PROTOCOL_VERSION),
    kind: z29.literal("complete"),
    // ownership 路由只读 topic/subId；坏 deliveryKind 必须进入 owned assembler
    // 产生 typed fault，不能在 service 边界 warn/drop 后让 store 永久等待。
    deliveryKind: z29.unknown().optional(),
    logicalFrameId: z29.string().min(1),
    logicalFrameOrdinal: z29.number(),
    topic: z29.string().min(1),
    subscriptionId: z29.string().min(1),
    // inner payload 故意不在 service route boundary 校验；缺失/类型/extra 由
    // ownership 后 assembler 统一转 typed fault，避免早期 warn/drop 永久 loading。
    frame: z29.unknown().optional()
  }).passthrough(),
  z29.object({
    wireVersion: z29.literal(V4_WIRE_PROTOCOL_VERSION),
    kind: z29.literal("fragment"),
    deliveryKind: z29.unknown().optional(),
    logicalFrameId: z29.string().min(1),
    logicalFrameOrdinal: z29.number(),
    topic: z29.string().min(1),
    subscriptionId: z29.string().min(1),
    fragmentIndex: z29.unknown().optional(),
    fragmentCount: z29.unknown().optional(),
    logicalBytes: z29.unknown().optional(),
    checksum: z29.unknown().optional(),
    dataBase64: z29.unknown().optional()
  }).passthrough()
]);
function createTopicWireFrameSchema(frameSchema) {
  return z29.discriminatedUnion("kind", [
    z29.object({
      wireVersion: z29.literal(V4_WIRE_PROTOCOL_VERSION),
      kind: z29.literal("complete"),
      deliveryKind: topicFrameDeliveryKindSchema,
      logicalFrameId: z29.string().min(1),
      logicalFrameOrdinal: z29.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      topic: z29.string().min(1),
      subscriptionId: z29.string().min(1),
      frame: frameSchema
    }).strict(),
    z29.object({
      wireVersion: z29.literal(V4_WIRE_PROTOCOL_VERSION),
      kind: z29.literal("fragment"),
      deliveryKind: topicFrameDeliveryKindSchema,
      logicalFrameId: z29.string().min(1),
      logicalFrameOrdinal: z29.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      topic: z29.string().min(1),
      subscriptionId: z29.string().min(1),
      fragmentIndex: z29.number().int().nonnegative(),
      fragmentCount: z29.number().int().positive().max(PROTOCOL_V4_LIMITS.logicalFrameAssemblyMaxFragments),
      logicalBytes: z29.number().int().positive(),
      checksum: topicWireChecksumSchema,
      dataBase64: topicWireBase64Schema
    }).strict()
  ]).superRefine((wire, context) => {
    const value = wire;
    if (value.kind === "fragment") {
      if (value.fragmentIndex >= value.fragmentCount) {
        context.addIssue({
          code: "custom",
          message: "fragmentIndex must be smaller than fragmentCount",
          path: ["fragmentIndex"]
        });
      }
      if (value.fragmentCount > value.logicalBytes) {
        context.addIssue({
          code: "custom",
          message: "fragmentCount cannot exceed logicalBytes",
          path: ["fragmentCount"]
        });
      }
      return;
    }
    const frame = value.frame;
    if (frame.topic !== value.topic) {
      context.addIssue({
        code: "custom",
        message: "complete wire topic must match logical frame topic",
        path: ["topic"]
      });
    }
    if (frame.subscriptionId !== value.subscriptionId) {
      context.addIssue({
        code: "custom",
        message: "complete wire subscriptionId must match logical frame subscriptionId",
        path: ["subscriptionId"]
      });
    }
  });
}

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/transport.ts
var hostCapabilitiesSchema = z30.object({
  nativeDialogs: z30.boolean(),
  localTerminal: z30.boolean(),
  // ws binary（relay 链路探测用）。
  binaryFrames: z30.boolean(),
  compression: z30.enum(["none", "permessage-deflate"]),
  // Wire-compatible：旧 Host 缺失等价于 false；调用方必须用 === true 判断。
  workspaceHookReview: z30.boolean().optional(),
  independentPlanState: z30.boolean().optional(),
  /**
   * 本 Host 会发 `workflowRun.*` 键级增量（delta.ts 的两条 op），因而 `workflowRuns` 的
   * actors / nodes 可以到 1024 而不是旧界的 256。没有这个位的消费者收到的仍是整键
   * `state.updated`，并且先经 `clampWorkflowRunsForLegacy` 裁到旧界。
   */
  workflowRunDeltas: z30.boolean().optional()
});
var helloMessageSchema = z30.object({
  kind: z30.literal("hello"),
  protocolVersion: z30.literal(V4_WIRE_PROTOCOL_VERSION),
  connectionId: z30.string(),
  clientMode: z30.enum(["desktop-continuous", "web-remote-replayable"]),
  deliveryProfile: z30.enum(["continuous", "replayable"]),
  // 首次时钟校准。
  serverTime: timestampSchema,
  capabilities: hostCapabilitiesSchema,
  // 此处只留位。
  auth: z30.object({ userId: z30.string().optional() })
}).strict().superRefine((hello, context) => {
  const expectedProfile = hello.clientMode === "desktop-continuous" ? "continuous" : "replayable";
  if (hello.deliveryProfile !== expectedProfile) {
    context.addIssue({
      code: "custom",
      message: "trusted clientMode and deliveryProfile must match",
      path: ["deliveryProfile"]
    });
  }
});
var clientHelloSchema = z30.object({
  kind: z30.literal("clientHello"),
  protocolVersion: z30.literal(V4_WIRE_PROTOCOL_VERSION),
  clientId: z30.string(),
  clientKind: z30.enum(["desktop", "web", "mobileRemote", "mobileApp"]).optional(),
  appVersion: z30.string(),
  // 缺失代表旧客户端，不具备 Settings-centered review UI。
  capabilities: z30.object({
    workspaceHookReviewUi: z30.boolean().optional(),
    /**
     * 本客户端认得 `workflowRun.*` 增量。⚠ 声明规则是**单向**的：客户端只有在 Host 的
     * hello 里见到 `workflowRunDeltas === true` 时才能带上这个键——这个 capabilities 对象
     * 是 `.strict()` 的，老 Host 见到不认识的键会整条 clientHello 解析失败、连接握不上手。
     */
    workflowRunDeltas: z30.boolean().optional()
  }).strict().optional()
}).strict();
var subscribeParamsSchema = z30.object({
  // "conversation/<sessionId>" | "sessions-index/<workspaceId>" | ...
  topic: z30.string(),
  // 水位不变量：仅当客户端真持有该时刻一致状态才允许带。
  base: z30.object({ logEpoch: z30.string(), seq: z30.number() }).optional(),
  // QoS hint，只影响调度，不影响语义。
  visibility: z30.enum(["foreground", "background"]).optional()
}).strict();
var subscribeAckSchema = z30.object({
  subscriptionId: z30.string(),
  // resume = base 有效，从 base.seq 续传增量；否则 snapshot。
  mode: z30.enum(["snapshot", "resume"]),
  logEpoch: z30.string()
});
var openTimingMsSchema = z30.number().int().nonnegative().optional();
var openTimingCountSchema = z30.number().int().nonnegative().optional();
var conversationOpenTimingSchema = z30.object({
  version: z30.literal(1),
  hostPrepareMs: openTimingMsSchema,
  providerRegistrySyncMs: openTimingMsSchema,
  taskMetaReadMs: openTimingMsSchema,
  cliRequestMs: openTimingMsSchema,
  cliBootstrapMs: openTimingMsSchema,
  cliSessionRestoreMs: openTimingMsSchema,
  initialFrameEncodeMs: openTimingMsSchema,
  cliProcessState: z30.enum(["spawned", "reused"]).optional(),
  sessionRuntimeState: z30.enum(["cold", "warm"]).optional(),
  snapshotRowCount: openTimingCountSchema
}).strict();
var conversationSubscribeAckSchema = subscribeAckSchema.extend({
  openTiming: conversationOpenTimingSchema.optional()
});
function createTopicFrameSchema(snapshotSchema, deltaSchema) {
  return z30.object({
    topic: z30.string(),
    // 代际标识，防旧流交错。
    subscriptionId: z30.string(),
    // 区间记账 (fromSeq, toSeq]；snapshot 帧 fromSeq 固定为 0。
    fromSeq: z30.number(),
    toSeq: z30.number(),
    // CLI 时钟，供 clockOffset 估计。
    sentAt: timestampSchema,
    payload: z30.discriminatedUnion("kind", [
      z30.object({ kind: z30.literal("snapshot"), snapshot: snapshotSchema }),
      z30.object({ kind: z30.literal("deltas"), deltas: z30.array(deltaSchema) })
    ])
  });
}
var conversationTopicFrameSchema = createTopicFrameSchema(
  conversationSnapshotSchema,
  conversationDeltaSchema
).extend({
  ttft: localTtftFactsSchema.optional(),
  ttftRelated: z30.array(localTtftFactsSchema).max(16).optional()
}).superRefine((frame, context) => {
  if (!frame.topic.startsWith("conversation/") || frame.topic.length === "conversation/".length) {
    context.addIssue({ code: "custom", message: "invalid conversation topic", path: ["topic"] });
  }
});
var conversationTopicWireFrameSchema = createTopicWireFrameSchema(
  conversationTopicFrameSchema
).superRefine((wire, context) => {
  if (!wire.topic.startsWith("conversation/") || wire.topic.length === "conversation/".length) {
    context.addIssue({ code: "custom", message: "invalid conversation topic", path: ["topic"] });
  }
});
var conversationTopicWireCandidateSchema = topicWireFrameCandidateSchema.superRefine(
  (wire, context) => {
    if (!wire.topic.startsWith("conversation/") || wire.topic.length === "conversation/".length) {
      context.addIssue({ code: "custom", message: "invalid conversation topic", path: ["topic"] });
    }
  }
);
var sessionsIndexTopicFrameSchema = createTopicFrameSchema(
  sessionsIndexSnapshotSchema,
  sessionsIndexDeltaSchema
).superRefine((frame, context) => {
  if (!frame.topic.startsWith("sessions-index/") || frame.topic.length === "sessions-index/".length) {
    context.addIssue({ code: "custom", message: "invalid sessions-index topic", path: ["topic"] });
  }
});
var sessionsIndexTopicWireFrameSchema = createTopicWireFrameSchema(
  sessionsIndexTopicFrameSchema
).superRefine((wire, context) => {
  if (!wire.topic.startsWith("sessions-index/") || wire.topic.length === "sessions-index/".length) {
    context.addIssue({ code: "custom", message: "invalid sessions-index topic", path: ["topic"] });
  }
});
var sessionsIndexTopicWireCandidateSchema = topicWireFrameCandidateSchema.superRefine(
  (wire, context) => {
    if (!wire.topic.startsWith("sessions-index/") || wire.topic.length === "sessions-index/".length) {
      context.addIssue({
        code: "custom",
        message: "invalid sessions-index topic",
        path: ["topic"]
      });
    }
  }
);
var workspaceConfigTopicFrameSchema = createTopicFrameSchema(
  workspaceConfigSnapshotSchema,
  workspaceConfigDeltaSchema
).superRefine((frame, context) => {
  if (!frame.topic.startsWith("workspace-config/") || frame.topic.length === "workspace-config/".length) {
    context.addIssue({
      code: "custom",
      message: "invalid workspace-config topic",
      path: ["topic"]
    });
  }
});
var workspaceConfigTopicWireFrameSchema = createTopicWireFrameSchema(
  workspaceConfigTopicFrameSchema
).superRefine((wire, context) => {
  if (!wire.topic.startsWith("workspace-config/") || wire.topic.length === "workspace-config/".length) {
    context.addIssue({
      code: "custom",
      message: "invalid workspace-config topic",
      path: ["topic"]
    });
  }
});
var workspaceConfigTopicWireCandidateSchema = topicWireFrameCandidateSchema.superRefine(
  (wire, context) => {
    if (!wire.topic.startsWith("workspace-config/") || wire.topic.length === "workspace-config/".length) {
      context.addIssue({
        code: "custom",
        message: "invalid workspace-config topic",
        path: ["topic"]
      });
    }
  }
);
var routedTopicFrameSchema = z30.union([
  conversationTopicFrameSchema,
  sessionsIndexTopicFrameSchema,
  workspaceConfigTopicFrameSchema
]);
var routedTopicWireFrameSchema = z30.union([
  conversationTopicWireFrameSchema,
  sessionsIndexTopicWireFrameSchema,
  workspaceConfigTopicWireFrameSchema
]);
var routedTopicWireCandidateSchema = z30.union([
  conversationTopicWireCandidateSchema,
  sessionsIndexTopicWireCandidateSchema,
  workspaceConfigTopicWireCandidateSchema
]);
var v4BackgroundBashOutputParamsSchema = z30.strictObject({
  sessionId: z30.string().min(1),
  workId: z30.string().min(1)
});
var v4ConnectionFlowStateSchema = z30.enum(["saturated", "drained", "closed"]);
var v4ConnectionFlowParamsSchema = z30.object({
  connectionId: z30.string().min(1),
  state: v4ConnectionFlowStateSchema
}).strict();
var v4ConnectionFlowResultSchema = z30.object({}).strict();
var MAX_LEGACY_TASK_IDS_PER_SUBSCRIBE = 200;
var v4ConversationSubscribeParamsSchema = subscribeParamsSchema.extend({
  connectionId: z30.string(),
  clientMode: z30.enum(["desktop-continuous", "web-remote-replayable"]),
  // 当前可信 attachment 的 workspace；cold resume 优先使用它恢复身份，live 不消费。
  workspace: zcodeWorkspaceRefSchema.optional(),
  /** host 从当前 remote workspace 的 tasks-index 精确读取的旧任务归属 allowlist。 */
  legacyTaskIds: z30.array(z30.string().min(1)).max(MAX_LEGACY_TASK_IDS_PER_SUBSCRIBE).optional(),
  // 仅供 host→CLI cold resume 使用；live conversation 不消费该 hint。
  resumeThoughtLevel: z30.string().trim().min(1).optional(),
  /**
   * 这条订阅收不收 `workflowRun.*` 键级增量。与 `clientMode` 同族：由**可信 host** 从该连接的
   * clientHello 注入，面向 UI 的 subscribe 选不了它——一个客户端能不能认得增量是连接的事实，
   * 不是某一次订阅可以自选的口味。缺席 = 按旧消费者处理（整键 patch + 旧界裁剪）。
   */
  workflowRunDeltas: z30.boolean().optional()
});
var v4ConversationSubscribeResultSchema = z30.object({
  ack: conversationSubscribeAckSchema
}).strict();
var v4SessionsIndexSubscribeResultSchema = z30.object({
  ack: subscribeAckSchema
}).strict();
var v4WorkspaceConfigSubscribeResultSchema = z30.object({
  ack: subscribeAckSchema
}).strict();
var conversationResyncParamsSchema = z30.object({
  subscriptionId: z30.string().trim().min(1).max(1024),
  base: z30.object({
    logEpoch: z30.string().trim().min(1).max(1024),
    seq: z30.number().int().nonnegative()
  }).strict().nullable(),
  forceSnapshot: z30.boolean().optional()
}).strict();
var v4ConversationResyncParamsSchema = conversationResyncParamsSchema.extend({
  topic: z30.string().trim().min(1).max(2048),
  connectionId: z30.string().trim().min(1).max(1024)
}).strict();
var v4ConversationResyncResultSchema = z30.object({
  ack: subscribeAckSchema
}).strict();
var v4ConversationUnsubscribeParamsSchema = z30.object({
  topic: z30.string().trim().min(1).max(2048),
  subscriptionId: z30.string().trim().min(1).max(1024),
  connectionId: z30.string().trim().min(1).max(1024)
}).strict();
var v4ConversationRowsRangeParamsSchema = z30.object({
  sessionId: z30.string(),
  /** Host attachment injects this trusted value; renderer callers omit it. */
  clientMode: z30.enum(["desktop-continuous", "web-remote-replayable"]).optional(),
  // 取 rowId < beforeRowId 的行；缺省 = 从当前尾部向前。
  beforeRowId: z30.number().optional(),
  limit: z30.number().min(1).max(PROTOCOL_V4_LIMITS.rowsRangeMaxLimit)
});
var v4ConversationRowsRangeResultSchema = z30.object({
  // rowId 升序。
  rows: z30.array(conversationRowSchema),
  // 服务端取值时的水位/纪元；与 fileChanges 等只读查询共用，避免跨 revision 拼接发布数据。
  atSeq: z30.number(),
  atRevision: z30.number().int().nonnegative(),
  atLogEpoch: z30.string(),
  // beforeRowId 方向是否还有更早的行。
  hasMore: z30.boolean()
});
var v4ConversationPlansParamsSchema = z30.object({
  sessionId: z30.string().min(1)
}).strict();
var v4ConversationPlansResultSchema = z30.object({
  // 当前有效分支的终态 ExitPlanMode，rowId 降序（最新优先）。
  plans: z30.array(toolCallRowSchema),
  atSeq: z30.number().int().nonnegative(),
  atLogEpoch: z30.string().min(1)
}).strict();
var readonlyDiffHunkSchema = z30.object({
  oldStart: z30.number(),
  oldLines: z30.number(),
  newStart: z30.number(),
  newLines: z30.number(),
  lines: z30.array(z30.string())
}).strict();
var v4ConversationFileChangesParamsSchema = z30.object({
  sessionId: z30.string().min(1),
  target: conversationRowTargetSchema,
  baseRevision: z30.number().int().nonnegative(),
  baseLogEpoch: z30.string().trim().min(1)
}).strict();
var v4ConversationFileChangesResultSchema = z30.object({
  files: z30.number().int().nonnegative(),
  additions: z30.number().int().nonnegative(),
  deletions: z30.number().int().nonnegative(),
  state: z30.enum(["active", "reverted"]).optional(),
  items: z30.array(
    z30.object({
      path: z30.string().min(1),
      additions: z30.number().int().nonnegative(),
      deletions: z30.number().int().nonnegative(),
      writeCount: z30.number().int().nonnegative(),
      toolNames: z30.array(z30.string()),
      patches: z30.array(readonlyDiffHunkSchema)
    }).strict()
  )
}).strict();
var v4ConversationWorkflowRunEventsParamsSchema = z30.object({
  sessionId: z30.string().min(1),
  runId: z30.string().min(1),
  /** 只取 sequence 严格大于该值的事件；缺省从头取。 */
  afterSequence: z30.number().int().nonnegative().optional(),
  limit: z30.number().int().positive().max(500).optional()
}).strict();
var v4ConversationWorkflowRunEventsResultSchema = z30.object({
  events: z30.array(
    z30.object({
      sequence: z30.number().int().nonnegative(),
      type: z30.string().min(1).max(64),
      // 载荷已在 CLI 侧经 boundDynamicWorkflowRunEventPayload 有界化（同一次序列化
      // 也喂给 workflowRuns 投影）。这里不再复述引擎的事件形状：读端按种类解释。
      payload: z30.record(z30.string(), z30.unknown()),
      truncated: z30.boolean().optional()
    }).strict()
  ),
  /** 本页取满 limit 且后面仍有事件。 */
  hasMore: z30.boolean()
}).strict();
var v4ConversationWorkflowRunsParamsSchema = z30.object({
  sessionId: z30.string().min(1),
  /** 返回条数上限；缺省与钳制在 CLI 侧（枚举面有界，绝不无界扫库）。 */
  limit: z30.number().int().positive().max(64).optional()
}).strict();
var v4ConversationWorkflowRunSummarySchema = z30.object({
  runId: z30.string().min(1),
  /** 发起 run 的 CreateWorkflow 工具调用 id（工具卡 → 详情页/Resume 的关联键）；老 run 缺席。 */
  toolCallId: z30.string().min(1).optional(),
  /**
   * 展示标签，服务端读时派生（`name` → 脚本首行 → runId）。optional 是偏斜安全：
   * 老 CLI 不发这个键，读侧回落 runId——少一个标签是退化，不是错误。
   * 上限与派生侧的 80 字符对齐后留一倍余量（用户起的 `name` 不受派生上限约束）。
   */
  label: z30.string().min(1).max(160).optional(),
  /** 最后更新时间（epoch 毫秒，journal 的 `dwf_run.time_updated`）。缺席即不显示时间。 */
  updatedAt: z30.number().int().nonnegative().optional(),
  // 与 workflowRuns 投影同一套五值词汇；
  // 此查询使用独立的 schema，新增查询状态不改变投影侧的状态键。
  status: z30.enum(["completed", "errored", "pending", "running", "stopped"]),
  /** `status === "stopped"` 才在场。词表与观察面共用一份——这里曾各抄一遍，于是引擎多出
   * `superseded` 时这份 strict schema 把整页 run 目录拒掉（桌面端表现为
   * 「读取 run 摘要失败」，任务列表计数与目录页一起空白）。 */
  stopReason: z30.enum(WORKFLOW_RUN_STOP_REASONS).optional(),
  // lineage：修订出来的 run 带前驱，
  // 被替代的 run 带后继（只随 `stopReason: "superseded"`）。两者 optional：老 CLI 不发。
  resumedFrom: z30.string().min(1).optional(),
  supersededBy: z30.string().min(1).optional(),
  /** errored / stopped(provider|interrupted) 的结构化失败编码（`ProviderStop` / `Interrupted` …）。 */
  failureCode: z30.string().min(1).max(64).optional(),
  failureMessage: z30.string().max(2048).optional(),
  /** 是否可恢复。CLI 按 resume 门的同一个谓词算好——UI 绝不自行推导（两处谓词会漂移）。 */
  resumable: z30.boolean()
}).strict();
var v4ConversationWorkflowRunsResultSchema = z30.object({
  /** 最近更新在前（排序在存储层）。 */
  runs: z30.array(v4ConversationWorkflowRunSummarySchema)
}).strict();
var v4ConversationFileRewindPreviewParamsSchema = z30.object({
  sessionId: z30.string().min(1),
  target: conversationRowTargetSchema,
  baseRevision: z30.number().int().nonnegative(),
  baseLogEpoch: z30.string().trim().min(1)
}).strict();
var v4WorkspaceFileRewindSafeFileSchema = z30.object({
  action: z30.enum(["restore", "delete"]),
  operationCount: z30.number().int().nonnegative(),
  path: z30.string().min(1),
  toolNames: z30.array(z30.string())
}).strict();
var v4WorkspaceFileRewindUnsafeFileSchema = z30.object({
  currentHash: z30.string().optional(),
  expectedHash: z30.string().optional(),
  message: z30.string().optional(),
  operationCount: z30.number().int().nonnegative(),
  path: z30.string().min(1),
  reason: z30.enum([
    "checkpoint_missing",
    "checkpoint_unreadable",
    "external_modified",
    "file_read_failed",
    "unsupported_checkpoint"
  ]),
  toolNames: z30.array(z30.string())
}).strict();
var v4WorkspaceFileRewindIgnoredFileSchema = z30.object({
  operationCount: z30.number().int().nonnegative(),
  path: z30.string().min(1),
  reason: z30.literal("bash_ignored"),
  toolNames: z30.array(z30.string())
}).strict();
var v4ConversationFileRewindPreviewResultSchema = z30.object({
  canApply: z30.boolean(),
  ignoredFiles: z30.array(v4WorkspaceFileRewindIgnoredFileSchema),
  safeFiles: z30.array(v4WorkspaceFileRewindSafeFileSchema),
  unsafeFiles: z30.array(v4WorkspaceFileRewindUnsafeFileSchema)
}).strict();
var v4UsageStatsParamsSchema = z30.object({
  range: z30.enum(APP_USAGE_RANGES),
  timeZone: z30.string().optional()
}).strict();
var v4ConversationUsageParamsSchema = z30.object({
  sessionId: z30.string().min(1)
}).strict();
var v4ConversationUsageResultSchema = z30.object({
  sessionId: z30.string().min(1),
  totalTokens: z30.number().int().nonnegative(),
  inputTokens: z30.number().int().nonnegative(),
  outputTokens: z30.number().int().nonnegative(),
  reasoningTokens: z30.number().int().nonnegative(),
  cacheCreationTokens: z30.number().int().nonnegative(),
  cacheReadTokens: z30.number().int().nonnegative(),
  modelRequestCount: z30.number().int().nonnegative(),
  modelErrorCount: z30.number().int().nonnegative(),
  inputBaselineBySource: z30.record(z30.string(), z30.number().int().nonnegative())
}).strict();
var v4AttachmentPutParamsSchema = z30.object({
  sessionId: z30.string().min(1),
  fileName: z30.string().min(1),
  mime: z30.string().min(1),
  // base64（不带 data: 前缀）；解码后字节数 ≤ PROTOCOL_V4_LIMITS.attachmentMaxBytes。
  dataBase64: z30.string().min(1)
}).strict();
var v4AttachmentPutResultSchema = z30.object({
  ref: z30.string().min(1)
});
var v4AttachmentUploadIdSchema = z30.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
var v4AttachmentChecksumSchema = z30.string().regex(/^sha256:[0-9a-f]{64}$/);
var v4AttachmentBeginParamsSchema = z30.object({
  connectionId: z30.string().min(1),
  uploadId: v4AttachmentUploadIdSchema,
  sessionId: z30.string().min(1),
  fileName: z30.string().min(1).max(255).regex(/^[^\0\r\n]+$/),
  mime: z30.string().min(3).max(255).regex(/^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/),
  totalBytes: z30.number().int().min(0).max(PROTOCOL_V4_LIMITS.attachmentMaxBytes),
  totalChunks: z30.number().int().min(0).max(PROTOCOL_V4_LIMITS.attachmentUploadMaxChunks),
  checksum: v4AttachmentChecksumSchema
}).strict().superRefine((value, context) => {
  if (value.totalBytes === 0 !== (value.totalChunks === 0)) {
    context.addIssue({
      code: "custom",
      message: "zero-byte upload must declare zero chunks",
      path: ["totalChunks"]
    });
  }
});
var v4AttachmentBeginResultSchema = z30.discriminatedUnion("state", [
  z30.object({
    uploadId: v4AttachmentUploadIdSchema,
    state: z30.literal("staging"),
    nextChunkIndex: z30.number().int().nonnegative()
  }).strict(),
  z30.object({
    uploadId: v4AttachmentUploadIdSchema,
    state: z30.literal("committed"),
    nextChunkIndex: z30.number().int().nonnegative(),
    ref: z30.string().min(1)
  }).strict()
]);
function decodedBase64ByteLength2(value) {
  if (value.length === 0) return 0;
  if (value.length % 4 !== 0) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    const code = value.charCodeAt(index);
    const valid = code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57 || code === 43 || code === 47;
    if (!valid) return null;
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) return null;
  }
  return value.length / 4 * 3 - padding;
}
var v4AttachmentChunkParamsSchema = z30.object({
  connectionId: z30.string().min(1),
  uploadId: v4AttachmentUploadIdSchema,
  sessionId: z30.string().min(1),
  chunkIndex: z30.number().int().nonnegative(),
  dataBase64: z30.string()
}).strict().superRefine((value, context) => {
  const decodedBytes = decodedBase64ByteLength2(value.dataBase64);
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
      message: "attachment chunk exceeds decoded byte limit",
      path: ["dataBase64"]
    });
  }
});
var v4AttachmentChunkResultSchema = z30.object({
  uploadId: v4AttachmentUploadIdSchema,
  nextChunkIndex: z30.number().int().nonnegative()
}).strict();
var v4AttachmentTerminalParamsSchema = z30.object({
  connectionId: z30.string().min(1),
  uploadId: v4AttachmentUploadIdSchema,
  sessionId: z30.string().min(1)
}).strict();
var v4AttachmentCommitParamsSchema = v4AttachmentTerminalParamsSchema;
var v4AttachmentCommitResultSchema = v4AttachmentPutResultSchema.strict();
var v4AttachmentAbortParamsSchema = v4AttachmentTerminalParamsSchema;
var v4AttachmentAbortResultSchema = z30.object({}).strict();
var v4AttachmentReadParamsSchema = z30.object({
  sessionId: z30.string().min(1),
  ref: z30.string().min(1),
  // 新 renderer 用稳定 row 身份 + 附件序号消除同一路径跨轮歧义；两者必须成对出现。
  target: conversationRowTargetSchema.optional(),
  attachmentIndex: z30.number().int().nonnegative().optional(),
  offset: z30.number().int().nonnegative(),
  limit: z30.number().int().positive().max(PROTOCOL_V4_LIMITS.attachmentChunkMaxBytes)
}).strict().superRefine((value, context) => {
  if (value.target === void 0 === (value.attachmentIndex === void 0)) return;
  context.addIssue({
    code: "custom",
    message: "target and attachmentIndex must be provided together",
    path: value.target === void 0 ? ["target"] : ["attachmentIndex"]
  });
});
var v4AttachmentPreviewSourceParamsSchema = z30.object({
  sessionId: z30.string().min(1),
  ref: z30.string().min(1),
  target: conversationRowTargetSchema.optional(),
  attachmentIndex: z30.number().int().nonnegative().optional(),
  clientMode: z30.enum(["desktop-continuous", "web-remote-replayable"])
}).strict().superRefine((value, context) => {
  if (value.target === void 0 === (value.attachmentIndex === void 0)) return;
  context.addIssue({
    code: "custom",
    message: "target and attachmentIndex must be provided together",
    path: value.target === void 0 ? ["target"] : ["attachmentIndex"]
  });
});
var v4AttachmentPreviewSourceResultSchema = z30.union([
  z30.object({
    kind: z30.literal("local_path"),
    path: z30.string().min(1),
    mediaType: z30.string().refine((value) => value.startsWith("video/"), {
      message: "local attachment preview only supports video media types"
    })
  }).strict(),
  z30.object({ kind: z30.literal("chunked") }).strict()
]);
var v4AttachmentReadResultSchema = z30.object({
  dataBase64: z30.string(),
  mediaType: z30.string().refine(
    (value) => value.startsWith("image/") || value.startsWith("video/") || value.split(";", 1)[0]?.trim().toLowerCase() === "application/pdf",
    "attachment preview only supports image/video/pdf media types"
  ),
  totalBytes: z30.number().int().nonnegative().max(PROTOCOL_V4_LIMITS.attachmentPreviewMaxBytes),
  nextOffset: z30.number().int().positive().nullable()
}).strict().superRefine((value, context) => {
  if (value.mediaType.startsWith("image/") && value.totalBytes > PROTOCOL_V4_LIMITS.attachmentMaxBytes) {
    context.addIssue({
      code: "too_big",
      maximum: PROTOCOL_V4_LIMITS.attachmentMaxBytes,
      origin: "number",
      inclusive: true,
      message: "image preview exceeds total byte limit",
      path: ["totalBytes"]
    });
  }
  const decodedBytes = decodedBase64ByteLength2(value.dataBase64);
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
      message: "attachment read chunk exceeds decoded byte limit",
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
var v4ConversationAttachmentReadParamsSchema = z30.object({
  sessionId: z30.string().min(1),
  ref: z30.string().min(1),
  target: conversationRowTargetSchema,
  attachmentIndex: z30.number().int().nonnegative(),
  offset: z30.number().int().nonnegative(),
  limit: z30.number().int().positive().max(PROTOCOL_V4_LIMITS.attachmentChunkMaxBytes)
}).strict();
var v4ConversationAttachmentReadResultSchema = z30.object({
  dataBase64: z30.string(),
  mediaType: z30.string().min(1),
  totalBytes: z30.number().int().nonnegative().max(PROTOCOL_V4_LIMITS.attachmentPreviewMaxBytes),
  nextOffset: z30.number().int().positive().nullable()
}).strict().superRefine((value, context) => {
  const decodedBytes = decodedBase64ByteLength2(value.dataBase64);
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
      message: "attachment read chunk exceeds decoded byte limit",
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
var v4ConversationAttachmentStatParamsSchema = z30.object({
  sessionId: z30.string().min(1),
  ref: z30.string().min(1),
  target: conversationRowTargetSchema,
  attachmentIndex: z30.number().int().nonnegative()
}).strict();
var v4ConversationAttachmentStatResultSchema = z30.object({
  mediaType: z30.string().min(1),
  // stat 是 metadata-only 探测，必须能表达超过传输上限的真实大小，否则
  // 「已知容量超限」无法在选择阶段作为阻断项呈现（见 attachmentStatMaxBytes 注释）。
  totalBytes: z30.number().int().nonnegative().max(PROTOCOL_V4_LIMITS.attachmentStatMaxBytes),
  mtimeMs: z30.number().finite().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/model-execution.ts
import { z as z31 } from "zod";
var modelExecutionSchema = z31.object({
  memoryExtraction: z31.literal("skip").optional(),
  selectionScope: z31.literal("execution"),
  requestAuth: z31.object({
    apiKey: z31.string().min(1).optional(),
    headers: z31.record(z31.string().min(1), z31.string().min(1)).optional()
  }).strict().optional(),
  subagents: z31.object({
    foregroundModel: z31.literal("submission"),
    background: z31.literal("deny")
  }).strict().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/bots.ts
import { z as z33 } from "zod";

// ../reference/ZCode/packages/shared/src/zcode-agent-policy.ts
import { z as z32 } from "zod";
var ZCODE_AGENT_PROVIDER = "glm";
var zcodeAgentProviderSchema = z32.literal(ZCODE_AGENT_PROVIDER);

// ../reference/ZCode/packages/shared/src/bots.ts
var botProviders = [
  "telegram",
  "webhook",
  "feishu",
  "lark",
  "weixin",
  "discord",
  "wecom"
];
var zcodeAutomationBotDeliveryTargetSchema = z33.object({
  provider: z33.enum(["feishu", "lark", "weixin"]),
  botId: z33.string().trim().min(1),
  providerUserId: z33.string().trim().min(1),
  chatType: z33.enum(["private", "group"])
}).strict();
var botAllowedCommandsSchema = z33.object({
  status: z33.boolean(),
  new: z33.boolean(),
  workspace: z33.boolean(),
  model: z33.boolean(),
  mode: z33.boolean().optional(),
  thoughtLevel: z33.boolean(),
  sandboxMode: z33.boolean().optional(),
  approvalPolicy: z33.boolean().optional(),
  // 兼容旧 bot-config.json；/cli 命令已移除，新配置不会再写入这个字段。
  cli: z33.boolean().optional(),
  reply: z33.boolean()
}).strict();
var botCurrentOptionsSchema = z33.object({
  modelSelection: modelSelectionSchema.optional(),
  mode: z33.string().min(1).optional(),
  sandboxMode: z33.string().min(1).optional(),
  approvalPolicy: z33.string().min(1).optional(),
  // 兼容旧 bot-config.json；CLI provider 现在统一由 ZCode Protocol 侧配置决定。
  cli: z33.literal(ZCODE_AGENT_PROVIDER).optional()
}).strict();
var botDraftOptionsSchema = z33.object({
  provider: z33.literal(ZCODE_AGENT_PROVIDER),
  modelSelection: modelSelectionSchema.optional(),
  mode: z33.string().min(1).optional()
}).strict();
var botElicitationOptionSchema = z33.object({
  value: z33.string(),
  label: z33.string(),
  description: z33.string().optional()
}).strict();
var botElicitationQuestionSchema = z33.object({
  question: z33.string(),
  header: z33.string(),
  options: z33.array(botElicitationOptionSchema),
  multiSelect: z33.boolean().optional()
}).strict();
var botPendingElicitationSchema = z33.object({
  taskId: z33.string().min(1),
  requestId: z33.string().min(1),
  runId: z33.string().min(1),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  actorKey: z33.string().min(1).optional(),
  currentQuestionIndex: z33.number().int().min(0),
  questions: z33.array(botElicitationQuestionSchema),
  answers: z33.record(z33.string(), z33.array(z33.string())),
  renderContext: z33.object({
    kind: z33.literal("plan_approval"),
    plan: z33.string().min(1)
  }).strict().optional(),
  expandedCustomAnswerQuestionIndexes: z33.array(z33.number().int().min(0)).optional(),
  handledAt: z33.number().optional()
}).strict();
var botConfigSchema = z33.object({
  id: z33.string().min(1),
  name: z33.string(),
  provider: z33.enum(botProviders),
  enabled: z33.boolean(),
  credentialRef: z33.string().min(1).optional(),
  webhookSecretRef: z33.string().min(1).optional(),
  webhookUrl: z33.string().url().optional(),
  webhookAuthHeaderName: z33.string().min(1).optional(),
  feishuAppId: z33.string().min(1).optional(),
  providerUserId: z33.string().min(1).optional(),
  displayName: z33.string().optional(),
  allowedWorkspaces: z33.array(z33.string().min(1)),
  allowedCommands: botAllowedCommandsSchema,
  currentOptions: botCurrentOptionsSchema,
  replyMode: z33.enum([
    "assistant_changes",
    "assistant_toolcalls_changes",
    "summary_changes",
    "streaming_card"
  ])
}).strict();
var botsConfigFileSchema = z33.object({
  version: z33.literal(3),
  bots: z33.array(botConfigSchema)
}).strict();
var botsStateFileSchema = z33.object({
  version: z33.literal(3),
  bots: z33.record(
    z33.string(),
    z33.object({
      botId: z33.string().min(1),
      workspacePath: z33.string().min(1),
      workspaceIdentity: z33.string().min(1).optional(),
      workspaceId: z33.string().min(1).optional(),
      mode: z33.enum(["draft", "task"]),
      activeTaskId: z33.string().min(1).nullable(),
      draftOptions: botDraftOptionsSchema.optional(),
      pendingPermissionOptions: z33.array(
        z33.object({
          requestId: z33.string().min(1),
          optionId: z33.string().min(1),
          command: z33.enum(["approve", "deny"]),
          label: z33.string().min(1),
          response: zcodePermissionResponseSchema,
          handledAt: z33.number().optional()
        })
      ).optional(),
      pendingElicitation: botPendingElicitationSchema.optional(),
      telegramOffset: z33.number().optional(),
      weixinGetUpdatesBuf: z33.string().optional(),
      weixinActivatedAt: z33.number().optional(),
      updatedAt: z33.number()
    })
  )
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-run-settings-command.ts
import { z as z34 } from "zod";
var amendWorkflowRunSettingsPayloadSchema = z34.object({
  /** ≡ runId，与取消、恢复同一个身份等式。 */
  workId: z34.string(),
  /** 规范串 `providerId/modelId[$level]`；`null` = 子代理回到会话模型。 */
  subagentModel: z34.string().min(1).max(WORKFLOW_RUNS_LIMITS.maxSubagentModelLength).nullable().optional(),
  /** 同时运行的子代理上限；`null` = 解除本 run 自己的界（回到本机上限）。agent 侧钳到 `[1, 天花板]`。 */
  maxConcurrency: z34.number().int().min(1).nullable().optional()
});
var amendWorkflowRunSettingsResultSchema = z34.object({
  type: z34.literal("amendWorkflowRunSettings"),
  runId: z34.string().min(1),
  toolCallId: z34.string().min(1),
  supersededRunId: z34.string().min(1).optional()
});
var workflowRunSettingsRejectionReasonSchema = z34.enum([
  "not_found",
  "not_configurable",
  "unchanged",
  "script_missing",
  "model_unavailable",
  "compile_failed",
  "missing_boundaries",
  "start_failed"
]);

// ../reference/ZCode/packages/shared/src/database-startup.ts
import { z as z35 } from "zod";
var databaseStartupErrorCodeSchema = z35.enum([
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
var databaseStartupErrorDetailsSchema = z35.object({
  sqliteCode: z35.number().int().optional(),
  systemCode: z35.string().max(64).optional(),
  migrationId: z35.string().max(128).optional()
});
var startupDiskSummarySchema = z35.object({
  scopeId: z35.string().max(128),
  observedAvailableDropPeakBytes: z35.number().finite().nonnegative().nullable(),
  minAvailableBytes: z35.number().finite().nonnegative().nullable(),
  quality: z35.enum(["complete", "partial", "unknown"]),
  sampledAt: z35.number().finite().nonnegative().nullable()
}).strict();
var databaseStartupPhaseSchema = z35.enum([
  "starting",
  "preparing_host_storage",
  "preparing_session_storage",
  "starting_services",
  "ready",
  "failed"
]);
var databaseMigrationIdSchema = z35.string().regex(/^[a-zA-Z_0-9-]{1,128}$/);
var databaseMigrationFactsSchema = z35.object({
  kind: z35.enum(["none", "initialize", "upgrade"]),
  executedCount: z35.number().int().nonnegative(),
  committedCount: z35.number().int().nonnegative(),
  // null 表示锁内账本为空；缺失表示尚未取得可信起点。
  lastAppliedMigrationId: databaseMigrationIdSchema.nullable().optional()
}).strict().superRefine((facts, context) => {
  if (facts.committedCount > facts.executedCount || facts.kind === "none" && facts.executedCount !== 0)
    context.addIssue({ code: "custom", message: "Invalid migration execution facts" });
});
var databaseStartupStateSchema = z35.object({
  schemaVersion: z35.literal(1),
  startupId: z35.string().min(1).max(128),
  attemptId: z35.string().min(1).max(128),
  sequence: z35.number().int().nonnegative(),
  startedAt: z35.number().finite().nonnegative(),
  updatedAt: z35.number().finite().nonnegative(),
  phase: databaseStartupPhaseSchema,
  databasePhase: z35.enum(["checking", "waiting_for_lock", "migrating", "committing", "maintaining", "ready"]).optional(),
  migration: databaseMigrationFactsSchema.optional(),
  currentMigration: databaseMigrationFactsSchema.optional(),
  migrationBaselines: z35.array(
    z35.object({
      databaseId: z35.string().min(1).max(128),
      databaseKind: z35.enum(["tasks-index", "session"]),
      lastAppliedMigrationId: databaseMigrationIdSchema.nullable().optional()
    }).strict()
  ).optional(),
  finalDatabase: z35.boolean().optional(),
  failedPhase: databaseStartupPhaseSchema.optional(),
  errorCode: databaseStartupErrorCodeSchema.optional(),
  ...databaseStartupErrorDetailsSchema.shape,
  disk: z35.array(startupDiskSummarySchema).max(8)
}).strict();
var databaseStartupPortPayloadSchema = z35.object({
  databaseStartupId: z35.string().min(1).max(128)
}).strict();
var databaseStartupControlSchema = z35.discriminatedUnion("action", [
  z35.object({ action: z35.literal("snapshot") }).strict(),
  z35.object({ action: z35.literal("exit") }).strict(),
  z35.object({ action: z35.literal("retry"), attemptId: z35.string().min(1).max(128) }).strict()
]);

// ../reference/ZCode/packages/shared/src/background-bash-output.ts
import { z as z36 } from "zod";
var BACKGROUND_BASH_OUTPUT_MAX_BYTES = 8192;
var backgroundBashOutputSchema = z36.strictObject({
  kind: z36.literal("output"),
  workId: z36.string().min(1),
  status: z36.enum(["running", "completed", "failed", "timed_out", "cancelled", "spawn_error"]),
  output: z36.string().max(BACKGROUND_BASH_OUTPUT_MAX_BYTES),
  truncated: z36.boolean(),
  outputPath: z36.string().min(1)
});
var backgroundBashOutputResultSchema = z36.union([
  backgroundBashOutputSchema,
  z36.strictObject({
    kind: z36.enum(["unavailable", "unsupported", "read_failed"]),
    workId: z36.string().min(1),
    code: z36.string().optional()
  })
]);

// ../reference/ZCode/packages/shared/src/zcode-protocol/index.ts
import { z as z49 } from "zod";

// ../reference/ZCode/packages/shared/src/process-diagnostic.ts
import { z as z37 } from "zod";
var ZCODE_PROCESS_DIAGNOSTIC_NAME_MAX_CHARS = 128;
var ZCODE_PROCESS_DIAGNOSTIC_MESSAGE_MAX_CHARS = 4e3;
var ZCODE_PROCESS_DIAGNOSTIC_STACK_MAX_CHARS = 16e3;
var ZCODE_PROCESS_DIAGNOSTIC_MAX_LINE_CHARS = 128 * 1024;
var processErrorKindSchema = z37.enum(["uncaughtException", "unhandledRejection"]);
var zcodeProcessDiagnosticSchema = z37.object({
  version: z37.literal(1),
  errorId: z37.uuid(),
  kind: processErrorKindSchema,
  origin: processErrorKindSchema,
  name: z37.string().min(1).max(ZCODE_PROCESS_DIAGNOSTIC_NAME_MAX_CHARS),
  message: z37.string().max(ZCODE_PROCESS_DIAGNOSTIC_MESSAGE_MAX_CHARS),
  stack: z37.string().max(ZCODE_PROCESS_DIAGNOSTIC_STACK_MAX_CHARS).optional(),
  occurredAt: z37.number().int().nonnegative()
}).strict();

// ../reference/ZCode/packages/shared/src/model-config.ts
import { z as z38 } from "zod";

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
  return z38.string().min(1).superRefine((source, context) => {
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
var completeEnumOptionSpecDataSchema = z38.object({
  /** 按语义强度从低到高排列；首项是辅助调用可选的最低公开档位。 */
  values: z38.array(
    z38.string().refine((value) => value.trim().length > 0, "reasoningLevel.values \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32")
  ).min(1, "reasoningLevel.values \u4E0D\u80FD\u4E3A\u7A7A").refine((values) => new Set(values).size === values.length, "reasoningLevel.values \u4E0D\u80FD\u91CD\u590D").readonly(),
  map: optionMapSchema("reasoningLevel")
}).strict();
var completeLimitOptionSpecDataSchema = z38.object({
  max: z38.number().int().positive(),
  map: optionMapSchema("maxOutputTokens")
}).strict();
var enumOptionSpecDataSchema = z38.object(sparseShape(completeEnumOptionSpecDataSchema.shape)).strict();
var limitOptionSpecDataSchema = z38.object(sparseShape(completeLimitOptionSpecDataSchema.shape)).strict();
var completeModelInputFormatDataSchema = z38.object({
  supportsText: z38.boolean(),
  supportsImage: z38.boolean(),
  supportsVideo: z38.boolean(),
  supportsAudio: z38.boolean(),
  supportsPdf: z38.boolean()
}).strict();
var completeModelOutputFormatDataSchema = z38.object({ supportsText: z38.boolean() }).strict();
var modelInputFormatDataSchema = z38.object(sparseShape(completeModelInputFormatDataSchema.shape)).strict();
var modelOutputFormatDataSchema = z38.object(sparseShape(completeModelOutputFormatDataSchema.shape)).strict();
var completeModelPropertiesDataSchema = z38.object({
  requiresMfjsToolSchema: z38.boolean(),
  contextWindow: z38.number().int().positive(),
  inputFormat: completeModelInputFormatDataSchema,
  outputFormat: completeModelOutputFormatDataSchema,
  supportsToolCall: z38.boolean(),
  supportsJsonSchemaOutput: z38.boolean(),
  supportsNativeWebSearch: z38.boolean(),
  supportsMidConversationSystem: z38.boolean()
}).strict();
var modelPropertiesDataSchema = z38.object({
  ...sparseShape(completeModelPropertiesDataSchema.shape),
  inputFormat: modelInputFormatDataSchema.nullable().optional(),
  outputFormat: modelOutputFormatDataSchema.nullable().optional()
}).strict();
var completeModelOptionSpecsDataSchema = z38.object({
  reasoningLevel: completeEnumOptionSpecDataSchema,
  maxOutputTokens: completeLimitOptionSpecDataSchema
}).strict();
var modelOptionSpecsDataSchema = z38.object({
  ...sparseShape(completeModelOptionSpecsDataSchema.shape),
  reasoningLevel: enumOptionSpecDataSchema.nullable().optional(),
  maxOutputTokens: limitOptionSpecDataSchema.nullable().optional()
}).strict();
var completeModelConfigDataSchema = z38.object({
  enabled: z38.boolean(),
  properties: completeModelPropertiesDataSchema,
  optionSpecs: completeModelOptionSpecsDataSchema
}).strict();
var modelConfigDataSchema = z38.object({
  ...sparseShape(completeModelConfigDataSchema.shape),
  properties: modelPropertiesDataSchema.nullable().optional(),
  optionSpecs: modelOptionSpecsDataSchema.nullable().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/account-provider-state.ts
import { z as z39 } from "zod";
var accountProviderUnavailableReasonSchema = z39.enum([
  "not-authenticated",
  "not-connected",
  "credential-failed",
  "not-entitled"
]);

// ../reference/ZCode/packages/shared/src/browser-use/commands.ts
import { z as z41 } from "zod";

// ../reference/ZCode/packages/shared/src/browser-use/command-metadata.ts
import { z as z40 } from "zod";
var BROWSER_VIEWPORT_LIMITS = {
  minWidth: 320,
  maxWidth: 3840,
  minHeight: 320,
  maxHeight: 2160
};
var browserViewportSizeSchema = z40.object({
  width: z40.number().int().positive(),
  height: z40.number().int().positive()
}).strict();
var browserViewportInputSchema = browserViewportSizeSchema.extend({
  width: z40.number().int().min(BROWSER_VIEWPORT_LIMITS.minWidth).max(BROWSER_VIEWPORT_LIMITS.maxWidth),
  height: z40.number().int().min(BROWSER_VIEWPORT_LIMITS.minHeight).max(BROWSER_VIEWPORT_LIMITS.maxHeight)
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
var browserViewportZoomSchema = z40.enum(BROWSER_VIEWPORT_ZOOM_OPTIONS);
var DEFAULT_BROWSER_VIEWPORT_ZOOM = "fit";
var embeddedBrowserViewportPreferenceSchema = z40.object({
  mode: z40.enum(["normal", "responsive"]),
  viewport: browserViewportInputSchema,
  zoom: browserViewportZoomSchema
}).strict();
var DEFAULT_EMBEDDED_BROWSER_VIEWPORT_PREFERENCE = {
  mode: "normal",
  viewport: { width: 393, height: 852 },
  zoom: DEFAULT_BROWSER_VIEWPORT_ZOOM
};
var browserCommandMethodSchema = z40.enum([
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
var browserClientModeSchema = z40.enum(["desktop-continuous", "web-remote-replayable"]);
var browserCommandContextSchema = z40.object({
  /** workspaceIdentity?.trim() || workspacePath，用于隔离与受控 tab 复用。 */
  workspaceKey: z40.string().min(1),
  sessionId: z40.string().min(1),
  /** 受控 tab id；缺省表示该 session 的活动受控 tab。 */
  tabId: z40.string().min(1).optional(),
  requestId: z40.string().min(1),
  clientMode: browserClientModeSchema
}).strict();
var browserErrorCodeSchema = z40.enum([
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
var browserPageStateSchema = z40.object({
  url: z40.string(),
  title: z40.string(),
  canGoBack: z40.boolean(),
  canGoForward: z40.boolean(),
  scrollX: z40.number().optional(),
  scrollY: z40.number().optional(),
  viewportWidth: z40.number().optional(),
  viewportHeight: z40.number().optional()
}).strict();

// ../reference/ZCode/packages/shared/src/browser-use/commands.ts
var browserMouseButtonSchema = z41.enum(["left", "right", "middle"]);
var browserKeyModifierSchema = z41.enum([
  "Alt",
  "Control",
  "ControlOrMeta",
  "Meta",
  "Shift"
]);
var browserPointSchema = z41.object({ x: z41.number(), y: z41.number() }).strict();
var browserRecordingDurationSchema = z41.number().int().nonnegative().max(9e4);
var browserRecordingSelectorSchema = z41.string().trim().min(1).max(2e3);
var browserRecordingActionSchema = z41.discriminatedUnion("type", [
  z41.object({ type: z41.literal("wait"), durationMs: browserRecordingDurationSchema }).strict(),
  z41.object({
    type: z41.literal("click"),
    selector: browserRecordingSelectorSchema.optional(),
    x: z41.number().optional(),
    y: z41.number().optional(),
    button: browserMouseButtonSchema.optional(),
    doubleClick: z41.boolean().optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z41.object({
    type: z41.literal("type"),
    selector: browserRecordingSelectorSchema,
    text: z41.string().max(1e5),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z41.object({
    type: z41.literal("hover"),
    selector: browserRecordingSelectorSchema.optional(),
    x: z41.number().optional(),
    y: z41.number().optional(),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z41.object({
    type: z41.literal("move"),
    x: z41.number(),
    y: z41.number(),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z41.object({
    type: z41.literal("scroll"),
    deltaX: z41.number().optional(),
    deltaY: z41.number(),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z41.object({
    type: z41.literal("scrollTo"),
    selector: browserRecordingSelectorSchema.optional(),
    x: z41.number().optional(),
    y: z41.number().optional(),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z41.object({
    type: z41.literal("wheel"),
    deltaX: z41.number().optional(),
    deltaY: z41.number(),
    times: z41.number().int().min(1).max(100).optional(),
    intervalMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z41.object({
    type: z41.literal("drag"),
    path: z41.array(browserPointSchema).min(2).max(200),
    durationMs: browserRecordingDurationSchema.optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict(),
  z41.object({
    type: z41.literal("waitFor"),
    selector: browserRecordingSelectorSchema,
    state: z41.enum(["attached", "detached", "visible", "hidden"]).optional(),
    timeoutMs: z41.number().int().positive().max(3e4).optional(),
    delayAfterMs: browserRecordingDurationSchema.optional()
  }).strict()
]);
var browserRecordingOptionsSchema = z41.object({
  viewport: browserViewportInputSchema.optional(),
  fps: z41.number().int().min(1).max(60).optional(),
  jpegQuality: z41.number().int().min(1).max(100).optional(),
  maxDurationMs: z41.number().int().min(1e3).max(9e4).optional(),
  settleMs: browserRecordingDurationSchema.optional(),
  showCursor: z41.boolean().optional(),
  actions: z41.array(browserRecordingActionSchema).max(500).optional()
}).strict();
var browserRecordingOutputPathSchema = z41.string().trim().min(1).max(2e3).refine((value) => !/^[/\\]/u.test(value) && !/^[A-Za-z]:[/\\]/u.test(value), {
  message: "recording outputPath must be relative to the workspace"
}).refine(
  (value) => !value.split(/[\\/]+/u).some((segment) => segment === ".." || segment === "." || segment.length === 0),
  { message: "recording outputPath cannot escape the workspace" }
).refine((value) => value.toLowerCase().endsWith(".webm"), {
  message: "recording outputPath must end with .webm"
});
var browserPlaywrightLocatorOperationSchema = z41.enum([
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
var browserPlaywrightModifierSchema = z41.enum([
  "Alt",
  "Control",
  "ControlOrMeta",
  "Meta",
  "Shift"
]);
var browserPlaywrightTimeoutSchema = z41.number().int().positive().optional();
var browserPlaywrightSelectOptionSchema = z41.object({
  value: z41.string().optional(),
  label: z41.string().optional(),
  index: z41.number().int().nonnegative().optional()
}).strict().refine(
  (selection) => selection.value !== void 0 || selection.label !== void 0 || selection.index !== void 0,
  "Select option requires value, label, or index"
);
var browserPlaywrightActionSchema = z41.discriminatedUnion("name", [
  z41.object({ name: z41.literal("domSnapshot") }).strict(),
  z41.object({
    name: z41.literal("elementInfo"),
    x: z41.number(),
    y: z41.number(),
    includeNonInteractable: z41.boolean().optional()
  }).strict(),
  z41.object({
    name: z41.literal("elementScreenshot"),
    x: z41.number(),
    y: z41.number(),
    includeNonInteractable: z41.boolean().optional()
  }).strict(),
  z41.object({
    name: z41.literal("evaluate"),
    expression: z41.string().min(1),
    expressionKind: z41.enum(["string", "function"]),
    arg: z41.unknown().optional(),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z41.object({
    name: z41.literal("waitForLoadState"),
    state: z41.enum(["load", "domcontentloaded", "networkidle"]).optional(),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z41.object({
    name: z41.literal("waitForURL"),
    url: z41.string().min(1),
    waitUntil: z41.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional(),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z41.object({
    name: z41.literal("waitForEvent"),
    event: z41.enum(["download", "filechooser"]),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z41.object({
    name: z41.literal("downloadPath"),
    downloadId: z41.string().min(1),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z41.object({
    name: z41.literal("fileChooserSetFiles"),
    fileChooserId: z41.string().min(1),
    files: z41.array(z41.string()).min(1),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict(),
  z41.object({
    name: z41.literal("locator"),
    selector: z41.string().min(1),
    operation: browserPlaywrightLocatorOperationSchema,
    value: z41.unknown().optional(),
    arg: z41.unknown().optional(),
    expression: z41.string().min(1).optional(),
    expressionKind: z41.enum(["string", "function"]).optional(),
    attribute: z41.string().min(1).optional(),
    checked: z41.boolean().optional(),
    replace: z41.boolean().optional(),
    force: z41.boolean().optional(),
    button: browserMouseButtonSchema.optional(),
    modifiers: z41.array(browserPlaywrightModifierSchema).optional(),
    state: z41.enum(["attached", "detached", "visible", "hidden"]).optional(),
    selections: z41.array(browserPlaywrightSelectOptionSchema).min(1).optional(),
    timeoutMs: browserPlaywrightTimeoutSchema
  }).strict()
]);
var browserCommandSchema = z41.discriminatedUnion("method", [
  z41.object({
    method: z41.literal("navigate"),
    url: z41.string().min(1),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({ method: z41.literal("back"), tabId: z41.string().optional() }).strict(),
  z41.object({ method: z41.literal("forward"), tabId: z41.string().optional() }).strict(),
  z41.object({ method: z41.literal("reload"), tabId: z41.string().optional() }).strict(),
  z41.object({
    method: z41.literal("snapshot"),
    maxElements: z41.number().int().positive().optional(),
    includeHidden: z41.boolean().optional(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("click"),
    // ref（快照句柄）与坐标 (x,y) 二选一：ref 走 dom_cua 式定位，(x,y) 走 cua 视觉坐标定位。
    ref: z41.string().min(1).optional(),
    x: z41.number().optional(),
    y: z41.number().optional(),
    button: browserMouseButtonSchema.optional(),
    doubleClick: z41.boolean().optional(),
    modifiers: z41.array(browserKeyModifierSchema).optional(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("fill"),
    ref: z41.string().min(1),
    value: z41.string(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("type"),
    ref: z41.string().min(1).optional(),
    text: z41.string(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("press"),
    key: z41.string().min(1),
    ref: z41.string().min(1).optional(),
    modifiers: z41.array(browserKeyModifierSchema).optional(),
    tabId: z41.string().optional()
  }).strict(),
  // CUA 组合键输入：keys 是一个组合键，必须保留逐键 down/up 顺序，不能压成末键 + bitmask。
  z41.object({
    method: z41.literal("cuaKeypress"),
    keys: z41.array(z41.string().min(1)).min(1),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("scroll"),
    ref: z41.string().min(1).optional(),
    x: z41.number().optional(),
    y: z41.number().optional(),
    tabId: z41.string().optional()
  }).strict(),
  // CUA 滚动输入：视口锚点与滚动 delta 是两组不同坐标，且可携带 modifier。
  z41.object({
    method: z41.literal("cuaScroll"),
    x: z41.number(),
    y: z41.number(),
    scrollX: z41.number(),
    scrollY: z41.number(),
    modifiers: z41.array(browserKeyModifierSchema).optional(),
    tabId: z41.string().optional()
  }).strict(),
  // DOM CUA 滚动输入：nodeId 缺省时从视口中心滚动；存在时从该节点中心滚动。
  z41.object({
    method: z41.literal("domCuaScroll"),
    nodeId: z41.string().min(1).optional(),
    scrollX: z41.number(),
    scrollY: z41.number(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("screenshot"),
    ref: z41.string().min(1).optional(),
    fullPage: z41.boolean().optional(),
    // 区域截图：CDP Page.captureScreenshot 的 clip（视口 CSS px）。与 fullPage 互斥。
    clip: z41.object({
      x: z41.number(),
      y: z41.number(),
      width: z41.number().positive(),
      height: z41.number().positive()
    }).strict().optional(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({ method: z41.literal("getState"), tabId: z41.string().optional() }).strict(),
  // hover：移动鼠标到元素(ref)或坐标(x,y)，触发 hover 态（cua move / dom_cua 定位后 move）。
  z41.object({
    method: z41.literal("hover"),
    ref: z41.string().min(1).optional(),
    x: z41.number().optional(),
    y: z41.number().optional(),
    modifiers: z41.array(browserKeyModifierSchema).optional(),
    tabId: z41.string().optional()
  }).strict(),
  // select：对 <select> 选择一个或多个 option（按 value 或可见文本匹配）。
  z41.object({
    method: z41.literal("select"),
    ref: z41.string().min(1),
    values: z41.array(z41.string()).min(1),
    tabId: z41.string().optional()
  }).strict(),
  // check：设置 checkbox/radio 勾选态（checked 缺省为 true）。
  z41.object({
    method: z41.literal("check"),
    ref: z41.string().min(1),
    checked: z41.boolean().optional(),
    tabId: z41.string().optional()
  }).strict(),
  // drag：从 起点(fromRef 或 from{x,y}) 拖到 终点(toRef 或 to{x,y})，走 CDP Input 合成鼠标拖拽。
  z41.object({
    method: z41.literal("drag"),
    fromRef: z41.string().min(1).optional(),
    toRef: z41.string().min(1).optional(),
    from: browserPointSchema.optional(),
    to: browserPointSchema.optional(),
    modifiers: z41.array(browserKeyModifierSchema).optional(),
    tabId: z41.string().optional()
  }).strict(),
  // CUA drag 输入：完整 path 是公共合同，backend 必须逐点发送而不是只取首尾。
  z41.object({
    method: z41.literal("cuaDrag"),
    path: z41.array(browserPointSchema).min(1),
    modifiers: z41.array(browserKeyModifierSchema).optional(),
    tabId: z41.string().optional()
  }).strict(),
  // elementInfo：给视口坐标 (x,y)，反查该点命中元素的信息（role/name/rect/selector），打通视觉↔结构。
  z41.object({
    method: z41.literal("elementInfo"),
    x: z41.number(),
    y: z41.number(),
    tabId: z41.string().optional()
  }).strict(),
  // evaluate：在页面作用域执行 JS 表达式，返回可 JSON 序列化的结果。
  z41.object({
    method: z41.literal("evaluate"),
    expression: z41.string().min(1),
    tabId: z41.string().optional()
  }).strict(),
  // getDialog：读取当前 JS 弹窗（alert/confirm/prompt/beforeunload）信息，无则返回 dialog=null。
  z41.object({ method: z41.literal("getDialog"), tabId: z41.string().optional() }).strict(),
  // handleDialog：接受/取消当前 JS 弹窗；prompt 可带 promptText。
  z41.object({
    method: z41.literal("handleDialog"),
    accept: z41.boolean(),
    promptText: z41.string().optional(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("waitFor"),
    selector: z41.string().min(1).optional(),
    text: z41.string().min(1).optional(),
    textGone: z41.string().min(1).optional(),
    timeoutMs: z41.number().int().positive().optional(),
    tabId: z41.string().optional()
  }).strict(),
  // PlaywrightAPI.waitForTimeout：固定等待只接受非负整数，0 表示让出一次 timer tick。
  z41.object({
    method: z41.literal("playwrightWaitForTimeout"),
    timeoutMs: z41.number().int().nonnegative(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("playwright"),
    action: browserPlaywrightActionSchema,
    tabId: z41.string().optional()
  }).strict(),
  z41.object({ method: z41.literal("capabilities"), tabId: z41.string().optional() }).strict(),
  z41.object({ method: z41.literal("browserVisibilityGet") }).strict(),
  z41.object({ method: z41.literal("browserVisibilitySet"), visible: z41.boolean() }).strict(),
  browserViewportInputSchema.extend({
    method: z41.literal("browserViewportSet"),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({ method: z41.literal("browserViewportReset"), tabId: z41.string().optional() }).strict(),
  z41.object({
    method: z41.literal("recordingStart"),
    options: browserRecordingOptionsSchema.optional(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("recordingStatus"),
    recordingId: z41.string().trim().min(1),
    outputPath: browserRecordingOutputPathSchema.optional(),
    tabId: z41.string().optional()
  }).strict(),
  z41.object({
    method: z41.literal("recordingCancel"),
    recordingId: z41.string().trim().min(1),
    tabId: z41.string().optional()
  }).strict(),
  // tabs.get(id) 的 backend 激活步骤：校验并更新该 scope selected tab；renderer 决定前台展示或后台记录。
  z41.object({ method: z41.literal("activateTab"), tabId: z41.string().min(1) }).strict(),
  z41.object({ method: z41.literal("newTab") }).strict(),
  z41.object({ method: z41.literal("listUserTabs") }).strict(),
  z41.object({ method: z41.literal("claimTab"), tabId: z41.string().min(1) }).strict(),
  z41.object({
    method: z41.literal("finalizeTabs"),
    keep: z41.array(
      z41.object({ tabId: z41.string().min(1), status: z41.enum(["handoff", "deliverable"]) }).strict()
    )
  }).strict(),
  z41.object({ method: z41.literal("markDeliverable"), tabId: z41.string().min(1) }).strict(),
  z41.object({ method: z41.literal("markHandoff"), tabId: z41.string().min(1) }).strict(),
  z41.object({ method: z41.literal("nameSession"), name: z41.string().trim().min(1) }).strict(),
  z41.object({
    method: z41.literal("finalize"),
    tabId: z41.string().optional(),
    deliverable: z41.boolean().optional()
  }).strict(),
  z41.object({ method: z41.literal("turnEnded"), turnId: z41.string().min(1).optional() }).strict(),
  z41.object({ method: z41.literal("closeSession") }).strict(),
  z41.object({ method: z41.literal("cancelRequest"), requestId: z41.string().min(1) }).strict(),
  // close：关闭指定受控 tab（tabId 缺省=当前 tab）。manager 层处理：detach + 通知 renderer 卸载 webview。
  z41.object({ method: z41.literal("close"), tabId: z41.string().optional() }).strict(),
  // list：枚举当前会话窗口下所有受控 tab 摘要。manager 层拦截处理，返回 result.tabs。
  z41.object({ method: z41.literal("list") }).strict()
]);

// ../reference/ZCode/packages/shared/src/browser-use/backend.ts
import { z as z42 } from "zod";
var browserBackendTypeSchema = z42.enum(["iab", "extension", "cdp"]);
var browserCapabilityDescriptorSchema = z42.object({
  id: z42.string().trim().min(1),
  description: z42.string().trim().min(1)
}).strict();
var browserBackendDescriptorSchema = z42.object({
  id: z42.string().trim().min(1),
  /** 同一 runtime id 的连接代次；旧代次对象不得自动漂移到新连接。 */
  generation: z42.number().int().nonnegative().default(0),
  type: browserBackendTypeSchema,
  name: z42.string().trim().min(1),
  capabilities: z42.object({
    browser: z42.array(browserCapabilityDescriptorSchema).optional(),
    tab: z42.array(browserCapabilityDescriptorSchema).optional()
  }).strict(),
  apiSupportOverrides: z42.record(z42.string(), z42.boolean()).optional(),
  /** metadata 只允许非敏感字符串，禁止把 credential 混入 discovery。 */
  metadata: z42.record(z42.string(), z42.string()).optional()
}).strict();
var browserSessionContextKindSchema = z42.enum(["live", "cached"]);
var browserDiscoveryContextSchema = z42.object({
  requestId: z42.string().trim().min(1),
  workspaceKey: z42.string().trim().min(1),
  workspacePath: z42.string().trim().min(1),
  workspaceIdentity: z42.string().trim().min(1).optional(),
  remoteSessionId: z42.string().trim().min(1).optional(),
  sessionId: z42.string().trim().min(1),
  turnId: z42.string().trim().min(1).optional(),
  clientMode: browserClientModeSchema,
  sessionContext: browserSessionContextKindSchema
}).strict();
var browserSessionContextSchema = browserDiscoveryContextSchema.extend({
  browserId: z42.string().trim().min(1),
  browserGeneration: z42.number().int().nonnegative()
}).strict();
var browserBackendListResultSchema = z42.object({ browsers: z42.array(browserBackendDescriptorSchema) }).strict();

// ../reference/ZCode/packages/shared/src/browser-use/result.ts
import { z as z44 } from "zod";

// ../reference/ZCode/packages/shared/src/browser-use/snapshot.ts
import { z as z43 } from "zod";
var browserElementRectSchema = z43.object({
  x: z43.number(),
  y: z43.number(),
  width: z43.number(),
  height: z43.number()
}).strict();
var browserSnapshotElementSchema = z43.object({
  ref: z43.string().min(1),
  tag: z43.string(),
  role: z43.string().optional(),
  /** accessibleName */
  name: z43.string().optional(),
  text: z43.string().optional(),
  value: z43.string().optional(),
  disabled: z43.boolean().optional(),
  checked: z43.boolean().optional(),
  selector: z43.string(),
  xpath: z43.string(),
  rect: browserElementRectSchema,
  inViewport: z43.boolean(),
  /** 父级可交互元素的 ref（层级线索；顶层/无父可交互元素时省略）。 */
  parentRef: z43.string().optional(),
  /** 元素来源的 frame 路径（同源 iframe 穿透时标注，如 "0>2"；主文档省略）。 */
  framePath: z43.string().optional(),
  /** 有界稳定属性，用于从 DOM 事实构造 locator；不返回 class/style/src 等高噪声字段。 */
  attributes: z43.record(z43.string(), z43.string()).optional()
}).strict();
var browserSnapshotDomNodeSchema = z43.object({
  tag: z43.string(),
  depth: z43.number().int().nonnegative(),
  inViewport: z43.boolean(),
  ref: z43.string().min(1).optional(),
  role: z43.string().optional(),
  name: z43.string().optional(),
  text: z43.string().optional(),
  attributes: z43.record(z43.string(), z43.string()).optional()
}).strict();
var browserSnapshotSchema = z43.object({
  url: z43.string(),
  title: z43.string(),
  /**
   * 有界的可见语义 DOM；optional 保持旧 backend/result 的协议兼容。
   * 必须排在 elements 前定义：Zod 会按 schema 顺序重建对象，大页面工具结果被截断时
   * 应先让模型看到页面语义，而不是 selector/xpath/rect 等动作细节。
   */
  dom: z43.array(browserSnapshotDomNodeSchema).optional(),
  /** 语义 DOM 节点超过内部预算时置 true。 */
  domTruncated: z43.boolean().optional(),
  elements: z43.array(browserSnapshotElementSchema),
  /** 元素数超过 maxElements 时截断。 */
  truncated: z43.boolean()
}).strict();

// ../reference/ZCode/packages/shared/src/browser-use/result.ts
var browserTabSummarySchema = z44.object({
  tabId: z44.string(),
  url: z44.string(),
  title: z44.string(),
  /** guest 当前真实 CSS viewport；normal/free-size 均必须返回。 */
  viewport: browserViewportSizeSchema,
  /**
   * main 侧最近可见/激活的内置浏览器 tab。用于让 agent 在用户手动改地址后，
   * 先绑定并读取当前页面，而不是误读 session 默认 tab。
   */
  active: z44.boolean().optional(),
  lifecycle: z44.enum(["active", "deliverable", "handoff"]).optional()
}).strict();
var browserUserTabInfoSchema = z44.object({
  id: z44.string().min(1),
  lastOpened: z44.string().optional(),
  tabGroup: z44.string().optional(),
  title: z44.string().optional(),
  url: z44.string().optional()
}).strict();
var browserDialogSchema = z44.object({
  type: z44.enum(["alert", "confirm", "prompt", "beforeunload"]),
  message: z44.string(),
  defaultPrompt: z44.string().optional()
}).strict();
var browserResponseMetaSchema = z44.object({
  browserUse: z44.literal(true),
  backendType: browserBackendTypeSchema,
  browserId: z44.string().min(1),
  browserGeneration: z44.number().int().nonnegative(),
  openTabIds: z44.array(z44.string()),
  tabId: z44.string().optional(),
  currentUrl: z44.string().optional(),
  lifecycle: z44.enum(["active", "deliverable", "handoff", "closed"]).optional()
}).strict();
var browserRecordingArtifactSchema = z44.object({
  path: z44.string().min(1),
  mimeType: z44.literal("video/webm"),
  width: z44.number().int().positive(),
  height: z44.number().int().positive(),
  fps: z44.number().positive(),
  durationMs: z44.number().nonnegative(),
  frameCount: z44.number().int().nonnegative()
}).strict();
var browserRecordingJobSchema = z44.object({
  id: z44.string().min(1),
  status: z44.enum(["running", "completed", "failed", "cancelled"]),
  phase: z44.enum(["preparing", "capturing", "finalizing", "completed", "failed", "cancelled"]),
  progress: z44.number().min(0).max(1),
  startedAt: z44.number().nonnegative(),
  updatedAt: z44.number().nonnegative(),
  artifact: browserRecordingArtifactSchema.optional(),
  error: z44.string().optional()
}).strict();
var browserCommandResultSchema = z44.object({
  ok: z44.boolean(),
  state: browserPageStateSchema.optional(),
  snapshot: browserSnapshotSchema.optional(),
  image: z44.object({ base64: z44.string(), mimeType: z44.literal("image/png") }).strict().optional(),
  /** list 命令返回：只包含当前 window/workspace/session/generation scope 可见的 tabs。 */
  tabs: z44.array(browserTabSummarySchema).optional(),
  /** BrowserUser.openTabs() 返回；与当前 session 自有 tabs.list() 严格分离。 */
  userTabs: z44.array(browserUserTabInfoSchema).optional(),
  /** newTab 返回的单个真实 tab。 */
  tab: browserTabSummarySchema.optional(),
  /** evaluate 返回：页面表达式的可 JSON 序列化结果。 */
  value: z44.unknown().optional(),
  /** elementInfo 返回：坐标命中元素的信息（复用快照元素结构；未命中则省略）。 */
  element: browserSnapshotElementSchema.optional(),
  /** getDialog 返回：当前 JS 弹窗信息；无弹窗时为 null。 */
  dialog: browserDialogSchema.nullable().optional(),
  /** WebView 异步录制任务；main 临时 path 会在 Host materialize 后改写为 workspace path。 */
  recording: browserRecordingJobSchema.optional(),
  error: z44.object({
    code: browserErrorCodeSchema,
    message: z44.string(),
    sideEffect: z44.enum(["none", "uncertain"]).optional()
  }).strict().optional(),
  meta: browserResponseMetaSchema.optional(),
  elapsedMs: z44.number().nonnegative()
}).strict();

// ../reference/ZCode/packages/shared/src/validationAppSettings.ts
import { z as z47 } from "zod";

// ../reference/ZCode/packages/shared/src/remoteAssetInstallMode.ts
var REMOTE_ASSET_INSTALL_MODES = ["local-download-upload", "remote-download"];

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

// ../reference/ZCode/packages/shared/src/wslUserValidation.ts
import { z as z45 } from "zod";
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
var wslUserSchema = z45.string().trim().max(WSL_USER_MAX_LENGTH).refine((value) => value.length === 0 || isValidWslUser(value), {
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

// ../reference/ZCode/packages/shared/src/provider-family-connection-selection.ts
import { z as z46 } from "zod";
var nonEmptyString2 = z46.string().trim().min(1);
var providerFamilyConnectionSelectionSchema = z46.discriminatedUnion("kind", [
  z46.object({ kind: z46.literal("start-plan") }).strict(),
  z46.object({ kind: z46.literal("individual-coding-plan") }).strict(),
  z46.object({
    kind: z46.literal("team-coding-plan"),
    productId: nonEmptyString2,
    organizationId: nonEmptyString2,
    projectId: nonEmptyString2
  }).strict()
]);
var providerFamilyConnectionSelectionSettingsSchema = z46.object({
  zai: providerFamilyConnectionSelectionSchema.optional(),
  bigmodel: providerFamilyConnectionSelectionSchema.optional()
}).partial();

// ../reference/ZCode/packages/shared/src/validationAppSettings.ts
var appSettingsOccupationSchema = z47.enum([
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
var nonEmptyStringSchema2 = z47.string().trim().min(1);
var localeSchema = z47.enum(["zh-CN", "en-US"]);
var localePreferenceSchema = z47.enum(["system", "zh-CN", "en-US"]);
var zcodeInteractionBehaviorSchema = z47.enum(["queue", "guide"]);
var electronReleaseChannelSchema = z47.enum(["stable", "preview"]);
var desktopZoomLevelSchema = z47.number().int().min(-3).max(5);
var desktopWindowSizeSchema = z47.object({
  width: z47.number().int().min(480),
  height: z47.number().int().min(640),
  maximized: z47.boolean()
});
var integratedTerminalShellSelectionSchema = z47.discriminatedUnion("mode", [
  z47.object({
    mode: z47.literal("auto")
  }),
  z47.object({
    mode: z47.literal("shell"),
    dialect: z47.enum(["cmd", "git-bash"]),
    id: nonEmptyStringSchema2,
    label: nonEmptyStringSchema2,
    path: nonEmptyStringSchema2
  })
]);
var providerFamilyDomainSchema = z47.enum(["zai", "bigmodel"]);
var postUpdateReleaseNotesPayloadSchema = z47.object({
  version: nonEmptyStringSchema2,
  title: nonEmptyStringSchema2,
  markdown: nonEmptyStringSchema2,
  releaseDate: nonEmptyStringSchema2.optional(),
  releaseNotesByLocale: z47.partialRecord(
    localeSchema,
    z47.object({ title: nonEmptyStringSchema2, markdown: nonEmptyStringSchema2 })
  ).optional()
});
var skippedElectronUpdateVersionsSchema = z47.partialRecord(electronReleaseChannelSchema, nonEmptyStringSchema2).default({});
var remoteWorkspaceTargetSchema = z47.discriminatedUnion("kind", [
  z47.object({
    kind: z47.literal("ssh"),
    host: nonEmptyStringSchema2,
    port: z47.number().int().positive().max(65535).optional(),
    username: nonEmptyStringSchema2,
    sshConfigAlias: nonEmptyStringSchema2.optional(),
    privateKeyPath: z47.string().optional(),
    assetInstallMode: z47.enum(REMOTE_ASSET_INSTALL_MODES).optional(),
    resourcePackages: z47.object({
      selectedPackageIds: z47.array(z47.string().refine(isKnownRemoteResourcePackageId)).optional()
    }).optional(),
    passwordCredentialKey: nonEmptyStringSchema2.optional(),
    privateKeyPassphraseCredentialKey: nonEmptyStringSchema2.optional()
  }),
  z47.object({
    kind: z47.literal("wsl"),
    distro: z47.string().optional(),
    // 远程历史重连会直接使用 settings 中的 WSL user，必须和连接入口共用校验，避免绕过 UI 后污染 identity/日志。
    user: wslUserSchema.optional()
  }),
  z47.object({
    kind: z47.literal("docker"),
    container: nonEmptyStringSchema2
  })
]);
var appWorkspaceSessionEntrySchema = z47.discriminatedUnion("kind", [
  z47.object({
    kind: z47.literal("local"),
    workspacePath: nonEmptyStringSchema2,
    workspacePurpose: z47.enum(["project", "conversation"]).default("project")
  }),
  z47.object({
    kind: z47.literal("remote"),
    workspacePath: nonEmptyStringSchema2,
    localWorkspacePath: nonEmptyStringSchema2.optional(),
    workspaceIdentity: nonEmptyStringSchema2.optional(),
    target: remoteWorkspaceTargetSchema,
    lastOpenedAt: z47.number().int().nonnegative(),
    lastConnectionStatus: z47.enum(["connected", "failed"]),
    lastConnectionError: z47.string().optional()
  })
]);
var zcodeEndpointOriginSchema = z47.preprocess((value) => {
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
}, z47.string().optional());
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
var legacyRemoteWorkspaceHistoryEntrySchema = z47.object({
  id: nonEmptyStringSchema2,
  workspacePath: nonEmptyStringSchema2,
  localWorkspacePath: nonEmptyStringSchema2.optional(),
  workspaceIdentity: nonEmptyStringSchema2.optional(),
  target: remoteWorkspaceTargetSchema,
  lastOpenedAt: z47.number().int().nonnegative(),
  lastConnectionStatus: z47.enum(["connected", "failed"]),
  lastConnectionError: z47.string().optional()
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
var appSettingsObjectSchema = z47.object({
  recentProjects: z47.array(z47.string()).default([]),
  locale: localeSchema.default("zh-CN"),
  // 快捷键用户覆盖（语义校验在 ui/src/shortcuts 生效表阶段容错，schema 只管形状）
  shortcutBindings: z47.record(z47.string(), z47.array(z47.string())).optional(),
  localePreference: localePreferenceSchema.default("system"),
  terminalInheritSystemProfile: z47.boolean().default(true),
  terminalFontFamily: nonEmptyStringSchema2.optional(),
  integratedTerminalShell: integratedTerminalShellSelectionSchema.optional(),
  httpProxy: nonEmptyStringSchema2.optional(),
  httpProxyNoProxy: nonEmptyStringSchema2.optional(),
  httpProxyCaCertPath: nonEmptyStringSchema2.optional(),
  embeddedBrowserAllowInsecureCertificates: z47.boolean().default(false),
  embeddedBrowserViewportPreference: embeddedBrowserViewportPreferenceSchema.default(
    DEFAULT_EMBEDDED_BROWSER_VIEWPORT_PREFERENCE
  ),
  // 输入框电脑操作入口改为默认不展示，设置项保留、默认关闭。
  // default 只对缺省字段生效，显式存过 false 的用户仍保持展示。
  computerUseComposerEntryHidden: z47.boolean().default(true),
  taskAutoArchiveEnabled: z47.boolean().default(false),
  taskAutoArchiveOlderThanDays: z47.number().int().positive().max(365).default(7),
  closeToTrayOnWindows: z47.boolean().default(true),
  closeToTrayOnWindowsMigrationInitialized: z47.boolean().default(true),
  keepAwakeWhileRunning: z47.boolean().default(false),
  desktopZoomLevel: desktopZoomLevelSchema.optional(),
  desktopWindowSize: desktopWindowSizeSchema.optional(),
  desktopChromiumHardwareAccelerationEnabled: z47.boolean().default(true),
  messageStreamShowReasoning: z47.boolean().default(true),
  messageStreamShowReasoningMigrationInitialized: z47.boolean().default(true),
  messageStreamShowTodos: z47.boolean().default(false),
  toolGroupingExploreEnabled: z47.boolean().default(true),
  toolGroupingTerminalEnabled: z47.boolean().default(true),
  toolGroupingChangesEnabled: z47.boolean().default(false),
  zcodeInteractionBehavior: zcodeInteractionBehaviorSchema.default("queue"),
  askUserQuestionAutoResolutionEnabled: z47.boolean().default(true),
  modelIoFullRetentionEnabled: z47.boolean().default(false),
  startPlanRecommendationDismissed: z47.boolean().default(false),
  providerFamilyConnectionSelections: providerFamilyConnectionSelectionSettingsSchema.default({}),
  providerFamilyDomain: providerFamilyDomainSchema.optional(),
  providerFamilyDomainUpdatedAt: z47.number().int().nonnegative().optional(),
  providerFamilyDomainMigrated: z47.boolean().default(false),
  nativeSearchEnhancementsEnabled: z47.boolean().default(true),
  onboardingOccupation: appSettingsOccupationSchema.nullish(),
  proactiveSuggestionsEnabled: z47.boolean().optional(),
  memoryEnabled: z47.boolean().default(false),
  lastWorkspaceSession: z47.array(appWorkspaceSessionEntrySchema).default([]),
  lastActiveTabIndex: z47.number().int().nonnegative().default(0),
  lastActiveTaskByWorkspace: z47.record(z47.string(), z47.string()).optional(),
  dataBaseDir: z47.string().trim().min(1).optional(),
  pendingPostUpdateReleaseNotes: postUpdateReleaseNotesPayloadSchema.optional(),
  receivePreviewUpdates: z47.boolean().default(false),
  autoDownloadAndInstallUpdates: z47.boolean().default(false),
  skippedElectronUpdateVersions: skippedElectronUpdateVersionsSchema,
  settingsSyncFirstRunPromptHandled: z47.boolean().optional(),
  zcodeEndpointOrigin: zcodeEndpointOriginSchema.optional()
});
var appSettingsSchema = z47.preprocess(
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
var appSettingsPatchSchema = z47.object({
  recentProjects: z47.array(z47.string()).optional(),
  locale: localeSchema.optional(),
  shortcutBindings: z47.record(z47.string(), z47.array(z47.string())).optional(),
  localePreference: localePreferenceSchema.optional(),
  terminalInheritSystemProfile: z47.boolean().optional(),
  terminalFontFamily: nonEmptyStringSchema2.optional(),
  integratedTerminalShell: integratedTerminalShellSelectionSchema.optional(),
  httpProxy: nonEmptyStringSchema2.optional(),
  httpProxyNoProxy: nonEmptyStringSchema2.optional(),
  httpProxyCaCertPath: nonEmptyStringSchema2.optional(),
  embeddedBrowserAllowInsecureCertificates: z47.boolean().optional(),
  embeddedBrowserViewportPreference: embeddedBrowserViewportPreferenceSchema.optional(),
  computerUseComposerEntryHidden: z47.boolean().optional(),
  taskAutoArchiveEnabled: z47.boolean().optional(),
  taskAutoArchiveOlderThanDays: z47.number().int().positive().max(365).optional(),
  closeToTrayOnWindows: z47.boolean().optional(),
  keepAwakeWhileRunning: z47.boolean().optional(),
  closeToTrayOnWindowsMigrationInitialized: z47.boolean().optional(),
  desktopZoomLevel: desktopZoomLevelSchema.optional(),
  desktopWindowSize: desktopWindowSizeSchema.optional(),
  desktopChromiumHardwareAccelerationEnabled: z47.boolean().optional(),
  messageStreamShowReasoning: z47.boolean().optional(),
  messageStreamShowReasoningMigrationInitialized: z47.boolean().optional(),
  messageStreamShowTodos: z47.boolean().optional(),
  toolGroupingExploreEnabled: z47.boolean().optional(),
  toolGroupingTerminalEnabled: z47.boolean().optional(),
  toolGroupingChangesEnabled: z47.boolean().optional(),
  zcodeInteractionBehavior: zcodeInteractionBehaviorSchema.optional(),
  askUserQuestionAutoResolutionEnabled: z47.boolean().optional(),
  modelIoFullRetentionEnabled: z47.boolean().optional(),
  startPlanRecommendationDismissed: z47.boolean().optional(),
  providerFamilyConnectionSelections: providerFamilyConnectionSelectionSettingsSchema.optional(),
  providerFamilyDomain: z47.union([providerFamilyDomainSchema, z47.literal("")]).optional(),
  providerFamilyDomainUpdatedAt: z47.number().int().nonnegative().optional(),
  providerFamilyDomainMigrated: z47.boolean().optional(),
  nativeSearchEnhancementsEnabled: z47.boolean().optional(),
  onboardingOccupation: z47.enum([
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
  proactiveSuggestionsEnabled: z47.boolean().optional(),
  memoryEnabled: z47.boolean().optional(),
  lastWorkspaceSession: z47.array(appWorkspaceSessionEntrySchema).optional(),
  lastActiveTabIndex: z47.number().int().nonnegative().optional(),
  lastActiveTaskByWorkspace: z47.record(z47.string(), z47.string()).optional(),
  dataBaseDir: z47.string().trim().min(1).optional(),
  pendingPostUpdateReleaseNotes: postUpdateReleaseNotesPayloadSchema.optional(),
  receivePreviewUpdates: z47.boolean().optional(),
  autoDownloadAndInstallUpdates: z47.boolean().optional(),
  skippedElectronUpdateVersions: z47.partialRecord(electronReleaseChannelSchema, nonEmptyStringSchema2).optional(),
  settingsSyncFirstRunPromptHandled: z47.boolean().optional(),
  zcodeEndpointOrigin: zcodeEndpointOriginSchema.optional()
});

// ../reference/ZCode/packages/shared/src/zcode-task-mode-schema.ts
import { z as z48 } from "zod";
var zcodeTaskModeSchema = z48.enum(["yolo", "plan", "edit", "auto", "autoEdit", "build"]);

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

// ../reference/ZCode/packages/shared/src/zcode-protocol/index.ts
var ZCODE_PROTOCOL_NAME = "ZCode Protocol";
var ZCODE_PROTOCOL_VERSION = 1;
var zcodeRuntimeCapabilitiesSchema = z49.object({
  independentPlanState: z49.boolean().optional()
});
var nonEmptyString3 = z49.string().trim().min(1);
var jsonObjectSchema2 = z49.record(z49.string(), z49.unknown());
var timestampMsSchema2 = z49.number().int().nonnegative();
var protocolInstantSchema = z49.union([timestampMsSchema2, nonEmptyString3, z49.date()]);
var zcodeNodeReplImageToolResultDisplaySchema = z49.object({
  kind: z49.literal("node_repl_images"),
  images: z49.array(
    z49.object({
      base64: z49.string().min(1).max(200 * 1024),
      mimeType: z49.string().regex(/^image\/[a-z0-9.+-]+$/iu)
    }).strict()
  ).min(1).max(2),
  truncated: z49.boolean().optional(),
  source: z49.literal("browser_turn_end").optional()
}).strict();
var zcodeWorkflowNamePatternSchema = z49.object({
  head: z49.string().min(1).max(128).optional(),
  tail: z49.string().min(1).max(128).optional()
}).strict();
var zcodeWorkflowEdgeSchema = z49.object({
  from: z49.string().min(1).max(64),
  to: z49.string().min(1).max(64),
  back: z49.literal(true).optional()
}).strict();
var zcodeCreateWorkflowCausalityGraphDisplaySchema = z49.object({
  steps: z49.array(
    z49.object({
      id: z49.string().min(1).max(64),
      kind: z49.enum(["ask", "world-read"]),
      label: z49.string().min(1).max(128),
      // 内联 `agent()` receiver 让 label 落到兜底串时，那个名字的静态形状。
      labelPattern: zcodeWorkflowNamePatternSchema.optional(),
      line: z49.number().int().positive().optional(),
      column: z49.number().int().positive().optional(),
      lane: z49.string().min(1).max(64),
      lanes: z49.array(z49.string().min(1).max(64)).max(32).optional(),
      // 展开自的站点 id，只出现在 may-set 车道展开的拷贝上（实时叠加的关联键）；
      // 加字段是 additive 的，不带它的旧载荷照常通过 .strict()。
      source: z49.string().min(1).max(64).optional(),
      // 作者用 `phase("…")` 标记划入的阶段。
      // 与图的 phases / phaseEdges / exits 同进同退：全在场或全缺席。
      phase: z49.string().min(1).max(64).optional(),
      repeat: z49.enum(["stack", "serial"]).optional()
    }).strict()
  ).max(64),
  lanes: z49.array(
    z49.object({
      id: z49.string().min(1).max(64),
      name: z49.string().min(1).max(128).optional(),
      // `name` 缺席而 agent() 首参是带洞的模板串时的静态形状；与 name 互斥。
      namePattern: zcodeWorkflowNamePatternSchema.optional(),
      line: z49.number().int().positive().optional(),
      column: z49.number().int().positive().optional()
    }).strict()
  ).max(32),
  // 参与者与交接；镜像 v4。
  participants: z49.array(
    z49.object({
      id: z49.string().min(1).max(64),
      phase: z49.string().min(1).max(64),
      lane: z49.string().min(1).max(64),
      steps: z49.array(z49.string().min(1).max(64)).min(1).max(64),
      member: z49.object({ index: z49.number().int().nonnegative(), of: z49.number().int().positive() }).strict().optional(),
      many: z49.literal(true).optional()
    }).strict()
  ).max(64),
  handoffs: z49.array(
    zcodeWorkflowEdgeSchema.extend({ types: z49.array(z49.string().min(1).max(128)).min(1).max(8).optional() }).strict()
  ).max(256),
  // 阶段词汇表：作者施加的分组结构，主画面以它为节点。与 phaseEdges / exits / Step.phase
  // 全有或全无——零标记脚本全缺席，UI 据此退回 step/车道视图。零成员阶段也在表里。
  // `unphased` 无 name，显示名由 UI 本地化。
  phases: z49.array(
    z49.object({
      id: z49.string().min(1).max(64),
      name: z49.string().min(1).max(128).optional(),
      line: z49.number().int().positive().optional(),
      column: z49.number().int().positive().optional(),
      // 进入本阶段时还在跑的其他阶段（它们的 strand 尚未 join），阶段表序，不含自己，
      // 为空时缺席。是节点事实而不是边——控制没有从那里转移过来，所以不进 phaseEdges。
      // 时间轴据此把相邻阶段折成一条分叉的「带」，侧栏迷你轨道画成双线段。
      alongside: z49.array(z49.string().min(1).max(64)).min(1).max(32).optional()
    }).strict()
  ).max(32).optional(),
  phaseEdges: z49.array(zcodeWorkflowEdgeSchema).max(128).optional(),
  // 控制流可在其后正常完成的阶段（阶段视图的「阶段 → 返回物」箭头）；组内可为空数组。
  exits: z49.array(z49.string().min(1).max(64)).max(32).optional(),
  sink: z49.array(z49.string().min(1).max(64)).max(64).optional(),
  truncated: z49.boolean().optional()
}).strict();
var zcodeCreateWorkflowToolResultDisplaySchema = z49.object({
  kind: z49.literal("create_workflow"),
  ok: z49.boolean(),
  errorCount: z49.number().int().nonnegative(),
  diagnostics: z49.array(
    z49.object({
      line: z49.number().int().nonnegative(),
      column: z49.number().int().nonnegative(),
      code: z49.number().int().nonnegative(),
      message: z49.string().min(1).max(2048)
    }).strict()
  ).max(100),
  causalityGraph: zcodeCreateWorkflowCausalityGraphDisplaySchema.optional(),
  truncated: z49.boolean().optional()
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
var zcodeProtocolRequestIdSchema = z49.union([z49.string(), z49.number().int()]);
var zcodeProtocolTraceSchema = z49.object({
  traceparent: nonEmptyString3.optional(),
  traceId: nonEmptyString3.optional(),
  parentId: nonEmptyString3.optional(),
  spanId: nonEmptyString3.optional()
}).strict();
var zcodeProtocolRequestSchema = z49.object({
  id: zcodeProtocolRequestIdSchema,
  method: nonEmptyString3,
  params: z49.unknown().optional(),
  trace: zcodeProtocolTraceSchema.optional()
}).strict();
var zcodeProtocolNotificationSchema = z49.object({
  method: nonEmptyString3,
  params: z49.unknown().optional(),
  trace: zcodeProtocolTraceSchema.optional()
}).strict();
var zcodeProtocolResponseSchema = z49.object({
  id: zcodeProtocolRequestIdSchema,
  result: z49.unknown()
}).strict();
var zcodeProtocolErrorSchema = z49.object({
  id: zcodeProtocolRequestIdSchema,
  error: z49.object({
    code: z49.number().int(),
    message: nonEmptyString3,
    data: z49.unknown().optional()
  }).strict()
}).strict();
var zcodeProtocolMessageSchema = z49.union([
  zcodeProtocolRequestSchema,
  zcodeProtocolNotificationSchema,
  zcodeProtocolResponseSchema,
  zcodeProtocolErrorSchema
]);
var zcodeStorageStartupStateSchema = z49.object({
  schemaVersion: z49.literal(1),
  attemptId: z49.string().min(1).max(128),
  sequence: z49.number().int().positive(),
  databaseId: z49.string().min(1).max(128),
  databaseKind: z49.enum(["session", "tasks-index"]),
  phase: z49.enum(["checking", "waiting_for_lock", "migrating", "committing", "ready", "failed"]),
  // 包含锁内、版本 SQL 之前的可选 lastAppliedMigrationId；旧通知仍可解析。
  migration: databaseMigrationFactsSchema.optional(),
  elapsedMs: z49.number().nonnegative().finite(),
  completed: z49.number().int().nonnegative().optional(),
  total: z49.number().int().nonnegative().optional(),
  errorCode: databaseStartupErrorCodeSchema.optional(),
  ...databaseStartupErrorDetailsSchema.shape
}).strict().superRefine((state, context) => {
  if (state.phase === "failed" && !state.errorCode)
    context.addIssue({ code: "custom", message: "failed requires errorCode" });
});
var zcodeMcpTelemetryPlatformSchema = z49.enum([
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
var zcodeMcpTelemetryArchSchema = z49.enum([
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
var zcodeMcpTelemetryBaseSchema = z49.object({
  arch: zcodeMcpTelemetryArchSchema,
  occurredAt: z49.number().int().nonnegative(),
  platform: zcodeMcpTelemetryPlatformSchema
}).strict();
var zcodeMcpProcessTelemetryBaseShape = {
  mcpId: z49.string().regex(
    /^(?:builtin:(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+(?::(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+)*|(?:plugin|custom):[a-f0-9]{12})$/
  ),
  mcpInstanceId: nonEmptyString3,
  mcpIsolation: z49.enum(["session", "workspace"]),
  mcpSource: z49.enum(["builtin", "plugin", "custom"])
};
var zcodeMcpTelemetryEventSchema = z49.discriminatedUnion("kind", [
  zcodeMcpTelemetryBaseSchema.extend({
    kind: z49.literal("process_start"),
    ...zcodeMcpProcessTelemetryBaseShape
  }).strict(),
  zcodeMcpTelemetryBaseSchema.extend({
    kind: z49.literal("process_crash"),
    ...zcodeMcpProcessTelemetryBaseShape,
    affectedSessionCount: z49.number().int().nonnegative().max(1e4),
    exitCode: z49.number().int().nullable(),
    signal: nonEmptyString3.nullable(),
    uptimeMs: z49.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
  }).strict(),
  zcodeMcpTelemetryBaseSchema.extend({
    kind: z49.literal("session_startup"),
    configuredCount: z49.number().int().nonnegative().max(1e4),
    connectedCount: z49.number().int().nonnegative().max(1e4),
    failedCount: z49.number().int().nonnegative().max(1e4),
    processCount: z49.number().int().nonnegative().max(1e4),
    sessionId: nonEmptyString3
  }).strict(),
  zcodeMcpTelemetryBaseSchema.extend({
    kind: z49.literal("memory"),
    ...zcodeMcpProcessTelemetryBaseShape,
    memoryKb: z49.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
    memoryScope: z49.enum(["process_tree", "direct_process"]),
    orphanSuspected: z49.boolean(),
    ownerSessionCount: z49.number().int().nonnegative().max(1e4),
    unownedSeconds: z49.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
  }).strict()
]);
var ZCODE_MCP_RESOURCE_SAMPLE_INTERVAL_MS = 5 * 6e4;
var zcodeMcpResourceSampleSchema = z49.object({
  mcpId: zcodeMcpProcessTelemetryBaseShape.mcpId,
  instanceToken: z49.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  sampledAt: z49.number().int().nonnegative(),
  intervalMs: z49.number().finite().positive(),
  processCount: z49.number().int().positive().max(1e5),
  rssKbTotal: z49.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  rssKbMaxProcess: z49.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  cpuTimeMsDelta: z49.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  uptimeMinutes: z49.number().int().nonnegative(),
  platform: zcodeMcpTelemetryPlatformSchema,
  arch: zcodeMcpTelemetryArchSchema,
  logicalCpuCount: z49.number().int().positive().max(4096),
  totalMemoryGb: z49.number().int().nonnegative().max(1048576)
}).strict();
var zcodeMcpResourceSamplesSchema = z49.array(zcodeMcpResourceSampleSchema).max(1024);
var BASH_RESOURCE_SAMPLE_INTERVAL_MS = 15e3;
var BASH_RESOURCE_MAX_SAMPLES = 20;
var zcodeToolExecResourceSchema = z49.object({
  // 同一完成事实可能经多个 Host 转发；随机标识仅供 main 去重，旧 CLI 缺字段仍兼容。
  completionToken: z49.string().uuid().optional(),
  platform: zcodeMcpTelemetryPlatformSchema,
  toolName: z49.literal("bash"),
  durationMs: z49.number().finite().min(BASH_RESOURCE_SAMPLE_INTERVAL_MS),
  exitKind: z49.enum(["completed", "timeout", "killed", "error"]),
  treeRssKbPeak: z49.number().finite().nonnegative().optional(),
  treeCpuTimeMs: z49.number().finite().nonnegative().optional(),
  sampleCount: z49.number().int().nonnegative().max(BASH_RESOURCE_MAX_SAMPLES),
  cliRssKb: z49.number().finite().nonnegative(),
  systemFreeMemoryKb: z49.number().finite().nonnegative()
}).strict();
var zcodeProcessResourceSampleSchema = z49.object({
  platform: z49.enum([
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
  arch: z49.enum([
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
  logicalCpuCount: z49.number().int().positive().max(4096),
  intervalMs: z49.number().int().positive().max(7 * 24 * 60 * 60 * 1e3),
  cpuCores: z49.number().finite().nonnegative().max(4096),
  cpuPercent: z49.number().finite().nonnegative().max(1e5),
  rssKb: z49.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  /**
   * 以下四项为遥测新增字段，全部可选：旧 CLI 发来的样本仍能通过校验，因此
   * **不递增协议握手版本号**（握手版本是兼容性开关，不是字段版本）。
   */
  heapUsedKb: z49.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  uptimeMinutes: z49.number().int().nonnegative().max(10 * 365 * 24 * 60).optional(),
  totalMemoryGb: z49.number().int().nonnegative().max(1048576).optional(),
  /**
   * CLI 进程启动时随机生成的实例标识，仅供 app 侧 main 统计「同时存活几个 CLI 进程」
   * 与「最大单进程 RSS」。不进 ARMS 属性、不含 pid。收紧字符集是隐私红线的机械保障：
   * 路径、workspace 标识这类内容不可能通过校验。
   */
  instanceToken: z49.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional()
}).strict();
var zcodeProcessChildProcessesParamsSchema = z49.object({}).strict();
var zcodeProcessChildProcessSchema = z49.object({
  pid: z49.number().int().positive(),
  serverName: nonEmptyString3,
  mcpSource: z49.enum(["builtin", "plugin", "custom"]),
  /** 官方/第三方插件的插件名（`plugin:<name>:<key>` 的 name，或官方 host MCP 对应插件）；custom 无 */
  pluginName: nonEmptyString3.optional()
}).strict();
var zcodeProcessChildProcessesResultSchema = z49.object({
  processes: z49.array(zcodeProcessChildProcessSchema).max(1e4)
}).strict();
var zcodeTurnInputSourceSchema = zcodeSyntheticUserMessageSourceSchema;
var zcodeSessionPersistenceSchema = z49.enum(["immediate", "deferred"]);
var zcodePermissionOptionSchema = z49.object({
  optionId: nonEmptyString3,
  kind: nonEmptyString3,
  name: nonEmptyString3,
  description: z49.string().optional(),
  response: zcodePermissionResponseSchema
}).strict();
var zcodeProtocolMcpEntrySchema = z49.object({
  name: nonEmptyString3,
  value: z49.string()
}).strict();
var zcodeProtocolMcpOAuthSchema = z49.union([
  z49.object({
    type: z49.literal("client_credentials"),
    clientId: nonEmptyString3,
    clientSecret: nonEmptyString3,
    clientName: nonEmptyString3.optional(),
    scope: z49.string().optional()
  }).strict(),
  z49.object({
    type: z49.literal("authorization_code"),
    clientId: nonEmptyString3.optional(),
    clientSecret: nonEmptyString3.optional(),
    clientName: nonEmptyString3.optional(),
    redirectPath: nonEmptyString3.optional(),
    scope: z49.string().optional()
  }).strict()
]);
var zcodeProtocolMcpServerSchema = z49.union([
  z49.object({
    name: nonEmptyString3,
    command: nonEmptyString3,
    args: z49.array(z49.string()),
    env: z49.array(zcodeProtocolMcpEntrySchema),
    isolation: z49.enum(["session", "workspace"]).optional(),
    protocolVersion: z49.enum(["legacy", "auto", "2026-07-28"]).optional(),
    timeoutMs: z49.number().int().positive().optional()
  }).strict(),
  z49.object({
    name: nonEmptyString3,
    type: z49.enum(["http", "sse"]),
    url: nonEmptyString3,
    headers: z49.array(zcodeProtocolMcpEntrySchema),
    oauth: zcodeProtocolMcpOAuthSchema.optional(),
    isolation: z49.enum(["session", "workspace"]).optional(),
    protocolVersion: z49.enum(["legacy", "auto", "2026-07-28"]).optional(),
    timeoutMs: z49.number().int().positive().optional()
  }).strict()
]);
var zcodeMcpServerStatusKindSchema = z49.enum([
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
var mcpServerFailureKindSchema = z49.enum(MCP_SERVER_FAILURE_KINDS);
var zcodeMcpServerStatusSnapshotSchema = z49.object({
  status: zcodeMcpServerStatusKindSchema,
  transport: z49.enum(["stdio", "http", "sse"]),
  toolCount: z49.number().int().nonnegative(),
  updatedAt: nonEmptyString3,
  error: z49.string().optional(),
  failureKind: mcpServerFailureKindSchema.optional(),
  serverRequestId: nonEmptyString3.optional(),
  protocolEra: z49.enum(["legacy", "modern"]).optional(),
  authorization: z49.object({
    type: z49.literal("oauth_authorization_code"),
    authorizationUrl: nonEmptyString3,
    startedAt: nonEmptyString3
  }).strict().optional()
}).strict();
var zcodeMcpListModeSchema = z49.enum(["connect", "status"]);
var zcodeMcpListParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  mcpServers: z49.array(zcodeProtocolMcpServerSchema).optional(),
  mode: zcodeMcpListModeSchema.default("connect")
}).strict();
var zcodeMcpListResultSchema = z49.object({
  statuses: z49.record(z49.string(), zcodeMcpServerStatusSnapshotSchema)
}).strict();
var zcodeSessionImportMessageSchema = z49.object({
  role: z49.enum(["user", "assistant"]),
  content: z49.string(),
  timestamp: timestampMsSchema2.optional()
}).strict();
var zcodeSessionImportHistorySchema = z49.discriminatedUnion("source", [
  z49.object({
    source: z49.literal("claudeCode"),
    title: z49.string().optional(),
    createdAt: timestampMsSchema2.optional(),
    updatedAt: timestampMsSchema2.optional(),
    messages: z49.array(zcodeSessionImportMessageSchema).min(1)
  }).strict(),
  z49.object({
    source: z49.literal("sharedContext"),
    title: z49.string().trim().min(1),
    createdAt: timestampMsSchema2.optional(),
    markdown: z49.string().min(1),
    provenance: z49.object({
      shareId: z49.string().trim().min(1),
      contextId: z49.string().trim().min(1).optional(),
      shareUrl: z49.string().url().optional(),
      status: z49.enum(["pending", "reserved", "attached", "discarded"]).optional(),
      projectionSha256: z49.string().regex(/^[0-9a-f]{64}$/u),
      artifactSetSha256: z49.string().regex(/^[0-9a-f]{64}$/u),
      formatterVersion: z49.literal(1),
      markdownSha256: z49.string().regex(/^[0-9a-f]{64}$/u),
      installedArtifacts: z49.array(
        z49.object({
          artifactId: z49.string().trim().min(1),
          workspaceRelativePath: z49.string().trim().min(1)
        }).strict()
      )
    }).strict()
  }).strict()
]);
var zcodeThoughtLevelOptionSchema = z49.object({
  value: nonEmptyString3,
  label: nonEmptyString3,
  description: z49.string().optional()
}).strict();
var zcodeModelReasoningOptionsSchema = z49.object({
  levels: z49.array(zcodeThoughtLevelOptionSchema),
  defaultLevel: nonEmptyString3.optional()
}).strict();
var zcodeModelFormatPropertiesSchema = completeModelPropertiesDataSchema.pick({
  inputFormat: true,
  outputFormat: true
});
var zcodeModelOptionSchema = z49.object({
  ref: modelSelectionSchema,
  label: nonEmptyString3,
  providerLabel: nonEmptyString3.optional(),
  description: z49.string().optional(),
  contextWindow: z49.number().int().positive().optional(),
  maxOutputTokens: z49.number().int().positive().optional(),
  reasoning: zcodeModelReasoningOptionsSchema.optional(),
  properties: zcodeModelFormatPropertiesSchema,
  disabledReason: z49.string().optional()
}).strict();
var zcodeAccountAccessSchema = z49.discriminatedUnion("planKind", [
  z49.object({
    type: z49.literal("zhipu-account"),
    family: z49.enum(["zai", "bigmodel"]),
    planKind: z49.literal("start-plan")
  }).strict(),
  z49.object({
    type: z49.literal("zhipu-account"),
    family: z49.enum(["zai", "bigmodel"]),
    planKind: z49.literal("individual-coding-plan")
  }).strict(),
  z49.object({
    type: z49.literal("zhipu-account"),
    family: z49.enum(["zai", "bigmodel"]),
    planKind: z49.literal("team-coding-plan"),
    productId: nonEmptyString3,
    organizationId: nonEmptyString3,
    projectId: nonEmptyString3
  }).strict()
]);
var zcodeProviderAccountAccessSchema = z49.object({
  type: z49.literal("zhipu-account"),
  accountType: z49.enum(["zai", "bigmodel"]),
  mode: z49.enum(["start-plan", "individual-coding-plan", "team-coding-plan", "off-peak"]),
  entitled: z49.boolean()
}).strict();
var zcodeSessionTodoItemSchema = z49.object({
  content: nonEmptyString3,
  status: z49.enum(["pending", "in_progress", "completed"]),
  priority: z49.enum(["high", "medium", "low"])
}).strict();
var zcodeSessionGoalStatsSchema = z49.object({
  timeUsedSeconds: z49.number().int().nonnegative(),
  tokensUsed: z49.number().int().nonnegative(),
  tokenBudget: z49.number().int().positive().nullable(),
  contextUsed: z49.number().int().nonnegative(),
  contextWindow: z49.number().int().nonnegative(),
  toolCallCount: z49.number().int().nonnegative(),
  iterationCount: z49.number().int().nonnegative()
}).strict();
var zcodeSessionTodoGroupSchema = z49.object({
  id: nonEmptyString3,
  source: z49.enum(["goal_iteration", "session"]),
  goalIteration: z49.number().int().positive().optional(),
  targetId: nonEmptyString3.optional(),
  startedAt: timestampMsSchema2.optional(),
  updatedAt: timestampMsSchema2.optional(),
  todos: z49.array(zcodeSessionTodoItemSchema)
}).strict();
var zcodeSessionSettingsStateSchema = z49.object({
  model: z49.object({
    // 未绑定是合法恢复状态；不能为满足协议而伪造模型或阻断历史读取。
    current: modelSelectionSchema.optional(),
    available: z49.array(zcodeModelOptionSchema),
    lastUsed: modelSelectionSchema.optional()
  }).strict(),
  thoughtLevel: z49.object({
    enabled: z49.boolean(),
    current: nonEmptyString3.optional(),
    defaultLevel: nonEmptyString3.optional(),
    available: z49.array(zcodeThoughtLevelOptionSchema)
  }).strict(),
  mode: z49.object({
    current: zcodeSessionModeSchema
  }).strict(),
  permission: z49.object({
    mode: zcodeSessionModeSchema.optional(),
    rulesRevision: z49.number().int().nonnegative().optional()
  }).strict().optional()
}).strict();
var zcodePendingPermissionSchema = z49.object({
  requestId: nonEmptyString3,
  toolCallId: nonEmptyString3,
  toolName: nonEmptyString3,
  reason: z49.string(),
  riskLevel: z49.enum(["low", "medium", "high", "critical"]),
  input: z49.unknown().optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  options: z49.array(zcodePermissionOptionSchema).min(1),
  requestedAt: timestampMsSchema2
}).strict();
var zcodeActiveToolCallSchema = z49.object({
  toolCallId: nonEmptyString3,
  toolName: nonEmptyString3,
  status: z49.enum(["pending", "running", "completed", "failed", "denied"]),
  startedAt: timestampMsSchema2.optional()
}).strict();
var zcodeSessionProjectionSchema = z49.object({
  sessionId: nonEmptyString3,
  status: zcodeSessionStatusSchema,
  mode: zcodeSessionModeSchema,
  turnCount: z49.number().int().nonnegative(),
  totalTokenCount: z49.number().int().nonnegative(),
  contextUsed: z49.number().int().nonnegative(),
  contextWindow: z49.number().int().nonnegative(),
  currentTurnId: nonEmptyString3.optional(),
  pendingPermissions: z49.array(zcodePendingPermissionSchema),
  activeToolCalls: z49.array(zcodeActiveToolCallSchema),
  backgroundJobs: z49.array(jsonObjectSchema2),
  target: zcodeSessionGoalSchema.nullable().optional(),
  lastError: z49.object({
    type: nonEmptyString3,
    code: nonEmptyString3.optional(),
    message: nonEmptyString3,
    detail: z49.string().optional(),
    attribution: errorAttributionSchema.optional()
  }).strict().optional()
}).strict();
var zcodeSlashCommandSchema = z49.object({
  name: nonEmptyString3,
  description: z49.string(),
  inputHint: z49.string().optional(),
  source: z49.enum(["builtin", "custom"]).optional()
}).strict();
var zcodeModelStreamingKindSchema = z49.enum([
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
var zcodeModelStreamingEventPayloadSchema = z49.object({
  assistantMessageId: z49.string().optional(),
  delta: z49.string().optional(),
  done: z49.boolean().optional(),
  input: z49.unknown().optional(),
  kind: zcodeModelStreamingKindSchema,
  partId: z49.string().optional(),
  providerExecuted: z49.boolean().optional(),
  toolCallId: z49.string().optional(),
  toolName: z49.string().optional()
}).strict();
var zcodeSessionStateSnapshotSchema = z49.object({
  protocol: z49.object({
    name: z49.literal(ZCODE_PROTOCOL_NAME),
    version: z49.literal(ZCODE_PROTOCOL_VERSION)
  }).strict(),
  session: zcodeSessionInfoSchema,
  settings: zcodeSessionSettingsStateSchema,
  projection: zcodeSessionProjectionSchema,
  runtime: zcodeSessionRuntimeStateSchema,
  messages: z49.array(zcodeMessageWithPartsSchema),
  goalStats: zcodeSessionGoalStatsSchema.optional(),
  todos: z49.array(zcodeSessionTodoItemSchema).optional(),
  todoGroups: z49.array(zcodeSessionTodoGroupSchema).optional(),
  slashCommands: z49.array(zcodeSlashCommandSchema).optional()
}).strict();
var zcodeEventEnvelopeSchema = z49.object({
  eventId: nonEmptyString3,
  sessionId: nonEmptyString3,
  turnId: nonEmptyString3.optional(),
  seq: z49.number().int().nonnegative(),
  traceId: nonEmptyString3.optional(),
  timestamp: timestampMsSchema2,
  deliveryKind: zcodeDeliveryKindSchema.optional()
}).strict();
var zcodeComputerUseOperationEventBaseSchema = z49.object({
  eventId: nonEmptyString3,
  sequenceNumber: z49.number().int().nonnegative(),
  sessionId: nonEmptyString3,
  timestamp: timestampMsSchema2
}).strict();
var zcodeComputerUseTurnStartedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z49.literal("turn-started"),
  turnId: nonEmptyString3
});
var zcodeComputerUseTurnCompletedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z49.literal("turn-completed"),
  turnId: nonEmptyString3
});
var zcodeComputerUseTurnFailedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z49.literal("turn-failed"),
  turnId: nonEmptyString3
});
var zcodeComputerUseToolScheduledEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z49.literal("tool-scheduled"),
  turnId: nonEmptyString3,
  toolCallId: nonEmptyString3,
  toolName: nonEmptyString3,
  // 这个 cell 是否在用 Computer Use。只表达布尔事实，不再携带动作名——旧的
  // operationAction 靠从模型源码里抽取动作名得到，SDK 面一变就整体失配（见
  // bootstrap/src/zcode-protocol/computer-use-operation-event.ts 的 usesComputerUse）。
  // 只挂在 scheduled 上：ToolCallStartedPayload 没有 input，start 时已拿不到模型源码。
  computerUse: z49.literal(true).optional()
});
var zcodeComputerUseToolStartedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z49.literal("tool-started"),
  turnId: nonEmptyString3.optional(),
  toolCallId: nonEmptyString3,
  toolName: nonEmptyString3.optional()
});
var zcodeComputerUseSessionClosedEventSchema = zcodeComputerUseOperationEventBaseSchema.extend({
  kind: z49.literal("session-closed")
});
var zcodeComputerUseOperationEventSchema = z49.discriminatedUnion("kind", [
  zcodeComputerUseTurnStartedEventSchema,
  zcodeComputerUseTurnCompletedEventSchema,
  zcodeComputerUseTurnFailedEventSchema,
  zcodeComputerUseToolScheduledEventSchema,
  zcodeComputerUseToolStartedEventSchema,
  zcodeComputerUseSessionClosedEventSchema
]);
var zcodeSessionEventTypeSchema = z49.enum([
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
var zcodeProtocolErrorDetailSchema = z49.object({
  type: nonEmptyString3,
  message: nonEmptyString3,
  stack: z49.string().optional(),
  code: z49.string().optional(),
  detail: z49.string().optional(),
  underlyingErrorMessage: z49.string().optional(),
  underlyingErrorDetail: z49.string().optional(),
  attribution: errorAttributionSchema.optional(),
  retryable: z49.boolean().optional(),
  data: z49.unknown().optional()
}).strict();
var zcodeSessionCreatedEventPayloadSchema = z49.object({
  mode: zcodeSessionModeSchema,
  contextWindow: z49.number().int().nonnegative()
}).strict();
var zcodeSessionResumedEventPayloadSchema = z49.object({
  directory: nonEmptyString3,
  interruptedToolCount: z49.number().int().nonnegative(),
  messageCount: z49.number().int().nonnegative(),
  partCount: z49.number().int().nonnegative(),
  recoveredCompactTimelineCount: z49.number().int().nonnegative().optional(),
  recoveredSteerInputCount: z49.number().int().nonnegative().optional(),
  resumedTodoCount: z49.number().int().nonnegative().optional()
}).strict();
var zcodeSessionTitleUpdatedEventPayloadSchema = z49.object({
  messageID: nonEmptyString3.optional(),
  previousTitle: z49.string(),
  source: z49.enum(["default", "first_input", "generated", "custom"]),
  title: z49.string()
}).strict();
var zcodeTurnStartedEventPayloadSchema = z49.object({
  turnNumber: z49.number().int().nonnegative(),
  input: z49.string(),
  inputId: nonEmptyString3.optional(),
  queryId: nonEmptyString3.optional(),
  inputSource: zcodeTurnInputSourceSchema.optional(),
  inputVisibility: zcodeMessageVisibilitySchema.optional(),
  executionKind: z49.enum(["agent", "controlOnly"]).optional(),
  targetId: nonEmptyString3.optional(),
  messageId: nonEmptyString3.optional(),
  foregroundExecutionId: nonEmptyString3.optional(),
  intent: jsonObjectSchema2.optional(),
  originMeta: jsonObjectSchema2.optional(),
  // runtime 会透传后台唤醒来源，strict schema 必须同步声明以免丢弃整条事件。
  backgroundSource: z49.enum(["bash", "subagent"]).optional(),
  attachments: z49.array(jsonObjectSchema2).optional()
}).strict();
var zcodeTurnSteerSourceSchema = z49.enum(["plan_approval_feedback", "workflow_refine_feedback"]);
var zcodeTurnSteerCommandKindSchema = z49.enum(["sendText", "sendGoalCommand", "compact"]);
var zcodeTurnSteerDeliverySchema = z49.enum(["queue", "guide"]);
var zcodeTurnSteerQueuedEventPayloadSchema = z49.object({
  pendingInputId: nonEmptyString3,
  inputId: nonEmptyString3.optional(),
  queryId: nonEmptyString3.optional(),
  input: z49.string(),
  inputPreview: z49.string(),
  inputSize: z49.number().int().nonnegative(),
  commandKind: zcodeTurnSteerCommandKindSchema.optional(),
  source: zcodeTurnSteerSourceSchema.optional(),
  toolDisallowlist: z49.array(nonEmptyString3).optional(),
  delivery: zcodeTurnSteerDeliverySchema.optional(),
  targetTurnId: nonEmptyString3,
  queueLength: z49.number().int().nonnegative(),
  intent: jsonObjectSchema2.optional()
}).strict();
var zcodeTurnSteerDrainedEventPayloadSchema = z49.object({
  pendingInputIds: z49.array(nonEmptyString3),
  queryIds: z49.array(nonEmptyString3).optional(),
  targetTurnId: nonEmptyString3,
  injectedMessageIds: z49.array(nonEmptyString3),
  drainedInputs: z49.array(
    z49.object({
      pendingInputId: nonEmptyString3,
      messageId: nonEmptyString3,
      text: z49.string(),
      delivery: zcodeTurnSteerDeliverySchema.optional(),
      intent: jsonObjectSchema2.optional(),
      toolDisallowlist: z49.array(nonEmptyString3).optional()
    }).strict()
  ).optional()
}).strict();
var zcodeTurnCompletedEventPayloadSchema = z49.object({
  response: z49.string(),
  tokenCount: z49.number().int().nonnegative(),
  usage: z49.unknown().optional(),
  toolCallCount: z49.number().int().nonnegative(),
  historyRoundCount: z49.number().int().nonnegative().optional(),
  duration: z49.number().nonnegative(),
  // runtime turn.completed 会附带 cacheStats，协议 schema 之前漏掉该字段。
  // strict 校验失败会让桌面端丢掉终态事件，表现为消息已完成但 UI 一直没有回复。
  cacheStats: z49.object({
    totalMessages: z49.number().int().nonnegative(),
    cachedMessages: z49.number().int().nonnegative(),
    lastCacheHit: z49.boolean(),
    cacheReadTokens: z49.number().int().nonnegative().optional()
  }).strict().optional(),
  inputId: nonEmptyString3.optional(),
  resultType: z49.enum([
    "success",
    // "cancelled": 用户主动中断属于正常结束，复用 turn.completed 上报，避免被映射成 turn.failed。
    "cancelled",
    "error_max_turns",
    "error_max_budget",
    "error_during_execution",
    "error_max_tool_calls"
  ]),
  backgroundSubagentResultConsumed: z49.boolean().optional()
}).strict();
var zcodeTurnFailedEventPayloadSchema = z49.object({
  error: zcodeProtocolErrorDetailSchema,
  turnPhase: z49.string(),
  inputId: nonEmptyString3.optional(),
  backgroundSubagentResultConsumed: z49.boolean().optional()
}).strict();
var zcodeMessageUpsertedEventPayloadSchema = z49.object({
  content: z49.string(),
  attachments: z49.array(z49.unknown()).optional(),
  toolCalls: z49.array(z49.unknown()).optional(),
  type: z49.string().optional(),
  compactBoundary: z49.unknown().optional()
}).strict();
var zcodeMessageRemovedEventPayloadSchema = z49.object({
  messageId: nonEmptyString3,
  reason: z49.string().optional()
}).strict();
var zcodeMessagePartDeltaEventPayloadSchema = z49.object({
  messageId: nonEmptyString3,
  partId: nonEmptyString3,
  field: z49.enum(["text", "reasoning", "input", "output"]).optional(),
  delta: z49.string()
}).strict();
var zcodeMessagePartUpsertedEventPayloadSchema = z49.object({
  part: zcodeMessagePartSchema
}).strict();
var zcodeMessagePartRemovedEventPayloadSchema = z49.object({
  messageId: nonEmptyString3,
  partId: nonEmptyString3,
  reason: z49.string().optional()
}).strict();
var zcodeToolCallBasePayloadSchema = z49.object({
  toolCallId: nonEmptyString3,
  toolName: z49.string().optional(),
  parentToolCallId: nonEmptyString3.optional(),
  source: z49.enum(["subagent"]).optional(),
  agentId: nonEmptyString3.optional(),
  agentType: nonEmptyString3.optional(),
  // subagent mirror 会携带后台归因；strict schema 漏字段会让 session/event 整条被丢弃。
  background: z49.boolean().optional(),
  childSessionId: nonEmptyString3.optional(),
  childToolCallId: nonEmptyString3.optional(),
  description: z49.string().optional()
}).strict();
var zcodeToolUpdatedEventPayloadSchema = z49.discriminatedUnion("kind", [
  zcodeToolCallBasePayloadSchema.extend({
    kind: z49.literal("scheduled"),
    // 修复：CLI 调度事件已携带所属消息 ID；漏声明会让严格校验丢弃整条事件。
    assistantMessageId: nonEmptyString3.optional(),
    toolName: nonEmptyString3,
    input: z49.unknown().optional(),
    inputByteLength: z49.number().int().nonnegative().optional(),
    inputOmitted: z49.boolean().optional(),
    inputRef: z49.literal("model_stream").optional(),
    dependencies: z49.array(nonEmptyString3).optional(),
    parallelGroupIndex: z49.number().int().nonnegative().optional(),
    canRunParallel: z49.boolean().optional(),
    schedule: jsonObjectSchema2.optional()
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z49.literal("started"),
    startedAt: protocolInstantSchema
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z49.literal("progress"),
    elapsedMs: z49.number().nonnegative().optional(),
    pid: z49.number().int().optional(),
    stdoutBytes: z49.number().int().nonnegative().optional(),
    stderrBytes: z49.number().int().nonnegative().optional(),
    outputBytes: z49.number().int().nonnegative().optional(),
    outputPreview: executionOutputPreviewSchema.optional(),
    stdoutTail: z49.string().optional(),
    stderrTail: z49.string().optional()
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z49.literal("result"),
    result: zcodeToolResultObjectSchema,
    duration: z49.number().nonnegative()
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z49.literal("error"),
    error: zcodeProtocolErrorDetailSchema
  }).strict(),
  z49.object({
    kind: z49.literal("batch"),
    toolCallIds: z49.array(nonEmptyString3),
    successCount: z49.number().int().nonnegative(),
    errorCount: z49.number().int().nonnegative()
  }).strict(),
  zcodeToolCallBasePayloadSchema.extend({
    kind: z49.literal("raw"),
    payload: jsonObjectSchema2
  }).strict()
]);
var zcodePermissionRequestedEventPayloadSchema = z49.object({
  requestId: nonEmptyString3.optional(),
  toolCallId: nonEmptyString3,
  toolName: nonEmptyString3,
  riskLevel: z49.enum(["low", "medium", "high", "critical"]),
  reason: z49.string(),
  input: z49.unknown(),
  suggestedPermissionUpdates: z49.array(zcodePermissionUpdateSchema).optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  options: z49.array(zcodePermissionOptionSchema).min(1),
  childSessionId: nonEmptyString3.optional(),
  background: z49.boolean().optional()
}).strict();
var zcodePermissionResolvedEventPayloadSchema = z49.object({
  requestId: nonEmptyString3.optional(),
  toolCallId: nonEmptyString3,
  toolName: nonEmptyString3.optional(),
  decision: zcodePermissionDecisionSchema.optional(),
  reason: z49.string().optional(),
  modifiedInput: z49.unknown().optional(),
  inputSummary: z49.unknown().optional(),
  childSessionId: nonEmptyString3.optional(),
  background: z49.boolean().optional()
}).strict();
var zcodeUserInputRequestedEventPayloadSchema = z49.object({
  requestId: nonEmptyString3,
  prompt: z49.string(),
  inputType: z49.enum(["text", "choice", "confirm"]).optional(),
  choices: z49.array(z49.string()).optional()
}).strict();
var zcodeUserInputResolvedEventPayloadSchema = z49.object({
  requestId: nonEmptyString3,
  value: z49.unknown().optional(),
  cancelled: z49.boolean().optional()
}).strict();
var zcodeSessionClosedEventPayloadSchema = z49.object({
  reason: z49.string().optional()
}).strict();
function zcodeSessionEventEnvelopeFor(type, payload) {
  return zcodeEventEnvelopeSchema.extend({
    type: z49.literal(type),
    payload: payload.optional()
  });
}
var zcodeSessionEventSchema = z49.discriminatedUnion("type", [
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
var zcodeSessionEventsResultSchema = z49.object({
  events: z49.array(zcodeSessionEventSchema)
}).strict();
var zcodeSessionMessagesResultSchema = z49.object({
  messages: z49.array(zcodeMessageWithPartsSchema)
}).strict();
var zcodeStateUpdatedNotificationSchema = z49.object({
  type: z49.literal("state.updated"),
  scope: z49.enum(["server", "workspace", "session"]),
  workspace: zcodeWorkspaceRefSchema.optional(),
  sessionId: nonEmptyString3.optional(),
  revision: z49.number().int().nonnegative(),
  reason: z49.string().optional(),
  patch: z49.unknown()
}).strict();
var zcodeSessionSubscribeParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  deliveryKind: zcodeDeliveryKindSchema,
  afterSeq: z49.number().int().nonnegative().optional(),
  includeSnapshot: z49.boolean().default(false)
}).strict();
var zcodeSessionSubscribeResultSchema = z49.object({
  sessionId: nonEmptyString3,
  eventSeq: z49.number().int().nonnegative(),
  events: z49.array(zcodeSessionEventSchema),
  snapshot: zcodeSessionStateSnapshotSchema.optional()
}).strict();
var zcodeSessionListResultSchema = z49.object({
  sessions: z49.array(zcodeSessionInfoSchema)
}).strict();
var zcodeSessionSubagentBaseSchema = z49.object({
  childSessionId: nonEmptyString3,
  agentId: nonEmptyString3.optional(),
  toolCallId: nonEmptyString3.optional(),
  subagentType: nonEmptyString3,
  title: nonEmptyString3,
  summary: z49.string().optional(),
  startedAt: z49.number().int().nonnegative().optional(),
  endedAt: z49.number().int().nonnegative().optional()
}).strict();
var zcodeSessionRunningSubagentSchema = zcodeSessionSubagentBaseSchema.extend({
  status: z49.enum(["running", "waiting", "blocked"])
});
var zcodeSessionEndedSubagentSchema = zcodeSessionSubagentBaseSchema.extend({
  status: z49.enum(["success", "failed", "cancelled", "lost"])
});
var zcodeSessionSubagentsResultSchema = z49.object({
  revision: z49.number().int().nonnegative(),
  childSessionIds: z49.array(nonEmptyString3),
  running: z49.array(zcodeSessionRunningSubagentSchema),
  ended: z49.object({
    total: z49.number().int().nonnegative(),
    items: z49.array(zcodeSessionEndedSubagentSchema),
    nextCursor: nonEmptyString3.optional()
  }).strict()
}).strict();
var zcodeSessionCreateParamsSchema = z49.object({
  sessionId: nonEmptyString3.optional(),
  workspace: zcodeWorkspaceRefSchema,
  parentSessionId: nonEmptyString3.optional(),
  mode: zcodeSessionModeSchema.optional(),
  model: modelSelectionSchema.optional(),
  persistence: zcodeSessionPersistenceSchema.optional(),
  thoughtLevel: nonEmptyString3.optional(),
  titleGenerationEnabled: z49.boolean().optional(),
  mcpServers: z49.array(zcodeProtocolMcpServerSchema).optional(),
  toolAllowlist: z49.array(nonEmptyString3).optional(),
  toolDenylist: z49.array(nonEmptyString3).optional(),
  importedHistory: zcodeSessionImportHistorySchema.optional(),
  // host 只按本地服务装配/远程/端形态决定是否注册工具，不读取灰度；
  // 缺省不下发 = 不注册；灰度与套餐准入在实际创建的 Host handler 校验。
  offPeakToolEnabled: z49.boolean().optional(),
  // 动态工作流灰度：与 offPeakToolEnabled 同一
  // 模式——host 裁决后下发，缺省不下发 = 不注册工作流工具簇（fail-closed）。
  dynamicWorkflowEnabled: z49.boolean().optional()
}).strict();
var zcodeSessionResumeParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  workspace: zcodeWorkspaceRefSchema.optional(),
  // 旧 session 尚无 runtime/model_selection entry 时，由同 task 的索引元数据提供迁移 hint。
  thoughtLevel: nonEmptyString3.optional(),
  mcpServers: z49.array(zcodeProtocolMcpServerSchema).optional(),
  // 冷恢复重建 runtime 时必须沿用 create 的工具面约束（否则会绕过 allow/deny，尤其 CUA 会话）。
  toolAllowlist: z49.array(nonEmptyString3).optional(),
  toolDenylist: z49.array(nonEmptyString3).optional(),
  // 与 create 同语义；resume 不带会导致冷恢复丢 Off-Peak 工具面。
  offPeakToolEnabled: z49.boolean().optional(),
  // 与 create 同语义；resume 不带会导致冷恢复丢工作流工具簇。
  dynamicWorkflowEnabled: z49.boolean().optional()
}).strict();
var zcodeSessionListParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema.optional(),
  // 显式身份查询包含隐藏会话；普通列表仍只返回主任务，避免索引修复激活 runtime。
  sessionIds: z49.array(nonEmptyString3).min(1).max(64).optional(),
  includeArchived: z49.boolean().default(false),
  limit: z49.number().int().positive().optional()
}).strict();
var zcodeSessionSubagentsParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  endedCursor: nonEmptyString3.optional(),
  endedLimit: z49.number().int().positive().max(100).default(20)
}).strict();
var zcodeUsageStatsParamsSchema = z49.object({
  range: z49.enum(APP_USAGE_RANGES),
  timeZone: z49.string().optional()
}).strict();
var zcodeTaskTokenUsageParamsSchema = z49.object({
  sessionId: nonEmptyString3
}).strict();
var zcodeTaskTokenUsageResultSchema = z49.object({
  sessionId: nonEmptyString3,
  totalTokens: z49.number().int().nonnegative(),
  inputTokens: z49.number().int().nonnegative(),
  outputTokens: z49.number().int().nonnegative(),
  reasoningTokens: z49.number().int().nonnegative(),
  cacheCreationTokens: z49.number().int().nonnegative(),
  cacheReadTokens: z49.number().int().nonnegative(),
  modelRequestCount: z49.number().int().nonnegative(),
  modelErrorCount: z49.number().int().nonnegative(),
  inputBaselineBySource: z49.record(z49.string(), z49.number().int().nonnegative())
}).strict();
var zcodeSessionReadParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  deliveryKind: zcodeDeliveryKindSchema.optional(),
  messageLimit: z49.number().int().positive().optional(),
  afterSeq: z49.number().int().nonnegative().optional()
}).strict();
var zcodeSessionMessagesParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  afterMessageId: nonEmptyString3.optional(),
  limit: z49.number().int().positive().optional()
}).strict();
var zcodeSessionEventsParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  afterSeq: z49.number().int().nonnegative().optional(),
  limit: z49.number().int().positive().optional()
}).strict();
var zcodeSessionRuntimePreferencesScopeSchema = z49.enum([
  "runtime-materialization",
  "user-execution"
]);
var zcodeSessionRequestRuntimePreferencesParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  scope: zcodeSessionRuntimePreferencesScopeSchema
}).strict();
var DEFAULT_ZCODE_MODEL_CONTEXT_BUDGET_STRATEGY = "preflight-v1";
var zcodeModelContextBudgetStrategySchema = z49.enum(["legacy", "preflight-v1"]);
var zcodeSessionRuntimePreferencesResultSchema = z49.object({
  nativeSearchEnhancementsEnabled: z49.boolean(),
  memoryEnabled: z49.boolean().default(false),
  askUserQuestionAutoResolutionEnabled: z49.boolean().default(true),
  integratedTerminalShell: integratedTerminalShellSelectionSchema.optional(),
  // 兼容旧 Host：缺少字段时在协议解析边界使用当前默认策略。
  modelContextBudgetStrategy: zcodeModelContextBudgetStrategySchema.default(
    DEFAULT_ZCODE_MODEL_CONTEXT_BUDGET_STRATEGY
  )
}).strict();
var zcodeBrowserAmbientContextSchema = z49.object({
  tabCount: z49.number().int().positive().max(100),
  currentUrl: z49.string().trim().min(1).max(4096).optional()
}).strict();
var zcodeSessionSendParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  modelSelection: modelSelectionSchema.optional(),
  modelExecution: modelExecutionSchema.optional(),
  inputId: nonEmptyString3.optional(),
  queryId: nonEmptyString3.optional(),
  content: z49.string(),
  attachments: z49.array(jsonObjectSchema2).optional(),
  browserAmbientContext: zcodeBrowserAmbientContextSchema.optional(),
  expectedRevision: z49.number().int().nonnegative().optional(),
  expectedProviderRevision: nonEmptyString3.optional(),
  automationId: nonEmptyString3.optional(),
  offPeakTaskId: nonEmptyString3.optional(),
  offPeakRunType: z49.enum(["init", "resume"]).optional(),
  botDeliveryTarget: zcodeAutomationBotDeliveryTargetSchema.optional(),
  toolDenylist: z49.array(nonEmptyString3).optional()
}).strict().superRefine((payload, context) => {
  if (payload.automationId && payload.offPeakTaskId) {
    context.addIssue({
      code: z49.ZodIssueCode.custom,
      message: "automationId and offPeakTaskId are mutually exclusive"
    });
  }
  if (payload.offPeakRunType && !payload.offPeakTaskId) {
    context.addIssue({
      code: z49.ZodIssueCode.custom,
      message: "offPeakRunType requires offPeakTaskId",
      path: ["offPeakRunType"]
    });
  }
  if (payload.modelExecution && !payload.modelSelection) {
    context.addIssue({
      code: z49.ZodIssueCode.custom,
      message: "modelExecution requires modelSelection",
      path: ["modelExecution"]
    });
  }
});
var zcodeSessionSendResultSchema = z49.object({
  sessionId: nonEmptyString3,
  accepted: z49.literal(true),
  stateRevision: z49.number().int().nonnegative()
}).strict();
var zcodeSessionHistoryTargetSchema = z49.discriminatedUnion("kind", [
  z49.object({
    kind: z49.literal("turn"),
    turnIndex: z49.number().int().nonnegative()
  }).strict(),
  z49.object({
    kind: z49.literal("message"),
    messageId: nonEmptyString3
  }).strict(),
  z49.object({
    kind: z49.literal("checkpoint"),
    checkpointId: nonEmptyString3
  }).strict(),
  z49.object({
    kind: z49.literal("latestCheckpoint")
  }).strict()
]);
var zcodeSessionForkParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  target: zcodeSessionHistoryTargetSchema.default({
    kind: "latestCheckpoint"
  }),
  expectedRevision: z49.number().int().nonnegative().optional()
}).strict();
var zcodeSessionForkResultSchema = z49.object({
  forkedSessionId: nonEmptyString3,
  parentSessionId: nonEmptyString3.optional(),
  targetMessageId: nonEmptyString3.optional(),
  targetCheckpointId: nonEmptyString3.optional(),
  response: z49.string(),
  snapshot: zcodeSessionStateSnapshotSchema
}).strict();
var zcodeSessionCompactParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  inputId: nonEmptyString3.optional(),
  instructions: z49.string().optional(),
  expectedRevision: z49.number().int().nonnegative().optional()
}).strict();
var zcodeSessionCompactResultSchema = z49.object({
  response: z49.string(),
  snapshot: zcodeSessionStateSnapshotSchema,
  compact: z49.object({
    state: z49.enum(["accepted", "already_running"]),
    inputId: nonEmptyString3.optional(),
    operationId: nonEmptyString3.optional()
  }).strict().optional()
}).strict();
var zcodeSessionGoalActionSchema = z49.enum([
  "show",
  "set",
  "replace",
  "pause",
  "resume",
  "clear"
]);
var zcodeSessionGoalParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  inputId: nonEmptyString3.optional(),
  action: zcodeSessionGoalActionSchema,
  objective: z49.string().optional(),
  expectedRevision: z49.number().int().nonnegative().optional()
}).strict();
var zcodeSessionGoalResultSchema = z49.object({
  response: z49.string(),
  snapshot: zcodeSessionStateSnapshotSchema,
  startedTurn: z49.boolean().optional()
}).strict();
var zcodeSessionStopParamsSchema = z49.object({
  sessionId: nonEmptyString3
}).strict();
var zcodeBackgroundTaskInfoStatusSchema = z49.enum([
  "running",
  "completed",
  "failed",
  "timed_out",
  "cancelled",
  "spawn_error",
  "lost"
]);
var zcodeBackgroundTaskInfoSchema = z49.object({
  taskId: nonEmptyString3,
  toolCallId: nonEmptyString3.optional(),
  toolName: nonEmptyString3.optional(),
  taskKind: z49.enum(["bash", "subagent"]).optional(),
  blocked: z49.boolean().optional(),
  blockedReason: z49.string().optional(),
  cancellable: z49.boolean().optional(),
  cancelRequestedAt: protocolInstantSchema.optional(),
  command: z49.string().optional(),
  description: z49.string().optional(),
  status: zcodeBackgroundTaskInfoStatusSchema,
  pid: z49.number().int().positive().optional(),
  startedAt: protocolInstantSchema.optional(),
  completedAt: protocolInstantSchema.optional(),
  outputPath: z49.string().optional(),
  stderrPersistedOutputPath: z49.string().optional(),
  stdoutPersistedOutputPath: z49.string().optional(),
  outputBytes: z49.number().int().nonnegative().optional(),
  outputTruncated: z49.boolean().optional(),
  outputTail: z49.string().optional(),
  stderrBytes: z49.number().int().nonnegative().optional(),
  stderrTail: z49.string().optional(),
  stdoutBytes: z49.number().int().nonnegative().optional(),
  stdoutTail: z49.string().optional(),
  terminalId: nonEmptyString3.optional()
}).strict();
var zcodeSessionCancelBackgroundTaskParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  taskId: nonEmptyString3
}).strict();
var zcodeSessionCancelBackgroundTaskResultSchema = z49.object({
  cancelled: z49.boolean(),
  reason: z49.string().optional(),
  snapshot: zcodeBackgroundTaskInfoSchema.optional(),
  status: zcodeBackgroundTaskInfoStatusSchema,
  taskId: nonEmptyString3
}).strict();
var zcodeSessionSetModelParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  model: modelSelectionSchema,
  expectedRevision: z49.number().int().nonnegative().optional(),
  persistAsWorkspaceLastUsed: z49.boolean().default(true)
}).strict();
var zcodeSessionSetThoughtLevelParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  thoughtLevel: nonEmptyString3.optional(),
  expectedRevision: z49.number().int().nonnegative().optional(),
  persistAsWorkspaceLastUsed: z49.boolean().default(true)
}).strict();
var zcodeSessionSetModeParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  mode: zcodeSessionModeSchema,
  expectedRevision: z49.number().int().nonnegative().optional()
}).strict();
var zcodeSessionCloseParamsSchema = z49.object({
  sessionId: nonEmptyString3,
  expectedPersistence: zcodeSessionPersistenceSchema.optional()
}).strict();
var zcodeSessionCloseResultSchema = z49.object({
  closed: z49.boolean().optional()
}).strict();
var zcodeWorkspaceReadPresentationParamsSchema = z49.object({ workspace: zcodeWorkspaceRefSchema }).strict();
var zcodeWorkspacePresentationSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  mode: zcodeSessionModeSchema,
  slashCommands: z49.array(zcodeSlashCommandSchema)
}).strict();
var workspaceHookSha256DigestSchema = z49.string().regex(/^[a-f0-9]{64}$/u);
var zcodeWorkspaceHookTrustGrantParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  bundleDigest: workspaceHookSha256DigestSchema,
  hookDeclarationDigest: workspaceHookSha256DigestSchema
}).strict();
var zcodeWorkspaceHookTrustGrantReasonCodeSchema = z49.enum([
  "workspace_hooks_blocked_by_policy",
  "workspace_hooks_bundle_changed",
  "workspace_hooks_snapshot_mismatch",
  "workspace_hooks_policy_requires_pretrust",
  "workspace_hooks_trust_store_corrupt",
  "workspace_hooks_config_unreadable"
]);
var zcodeWorkspaceHookTrustGrantResultSchema = z49.object({
  accepted: z49.boolean(),
  reasonCode: zcodeWorkspaceHookTrustGrantReasonCodeSchema.optional()
}).strict();
var zcodeWorkspaceModelToolCallSchema = z49.object({
  id: nonEmptyString3,
  name: nonEmptyString3,
  input: z49.unknown()
}).strict();
var zcodeWorkspaceModelMessageSchema = z49.discriminatedUnion("role", [
  z49.object({ role: z49.literal("system"), content: z49.string() }).strict(),
  z49.object({ role: z49.literal("user"), content: z49.string() }).strict(),
  z49.object({
    role: z49.literal("assistant"),
    content: z49.string(),
    toolCalls: z49.array(zcodeWorkspaceModelToolCallSchema).optional()
  }).strict(),
  z49.object({
    role: z49.literal("tool"),
    content: z49.string(),
    toolCallId: nonEmptyString3,
    toolName: nonEmptyString3,
    isError: z49.boolean().optional()
  }).strict()
]);
var zcodeWorkspaceModelToolSchema = z49.object({
  name: nonEmptyString3,
  description: z49.string().optional(),
  inputSchema: z49.record(z49.string(), z49.unknown())
}).strict();
var zcodeWorkspaceGenerateTextParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  selection: modelSelectionSchema,
  prompt: nonEmptyString3.optional(),
  messages: z49.array(zcodeWorkspaceModelMessageSchema).min(1).optional(),
  tools: z49.array(zcodeWorkspaceModelToolSchema).optional(),
  querySource: nonEmptyString3,
  maxOutputTokens: z49.number().int().positive().optional(),
  operationId: nonEmptyString3.optional()
}).strict().refine((value) => value.prompt !== void 0 || value.messages !== void 0, {
  message: "prompt \u6216 messages \u81F3\u5C11\u9700\u8981\u63D0\u4F9B\u4E00\u4E2A"
});
var zcodeWorkspaceGenerateTextResultSchema = z49.object({
  text: z49.string(),
  selection: modelSelectionSchema,
  toolCalls: z49.array(zcodeWorkspaceModelToolCallSchema).optional(),
  // 可选以兼容仍在运行的旧 app-server；新 CLI 始终返回结构化结束原因。
  finishReason: z49.string().optional(),
  usage: z49.object({
    inputTokens: z49.number().nonnegative().optional(),
    outputTokens: z49.number().nonnegative().optional(),
    totalTokens: z49.number().nonnegative().optional(),
    cacheReadTokens: z49.number().nonnegative().optional(),
    cacheWriteTokens: z49.number().nonnegative().optional(),
    reasoningTokens: z49.number().nonnegative().optional(),
    serverToolUse: z49.object({
      webSearchRequests: z49.number().nonnegative().optional(),
      webFetchRequests: z49.number().nonnegative().optional()
    }).strict().optional()
  }).strict().optional()
}).strict();
var zcodeWorkspaceCancelGenerateTextParamsSchema = z49.object({ operationId: nonEmptyString3 }).strict();
var zcodeWorkspaceCancelGenerateTextResultSchema = z49.object({ operationId: nonEmptyString3, cancelled: z49.boolean() }).strict();
var zcodeProviderTestModelConnectivityParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  selection: modelSelectionSchema
}).strict();
var zcodeProviderTestModelConnectivityResultSchema = z49.object({ success: z49.literal(true) }).strict();
var zcodeProviderUpdateAccountConfigParamsSchema = z49.object({
  revision: nonEmptyString3,
  basedOnZCodeBuiltinRevision: nonEmptyString3,
  // Provider Config 的字段校验由 @zcode/provider 负责；协议层只约束可传输信封。
  providers: z49.record(z49.string(), z49.unknown()),
  // 账号状态与 Overlay 必须一起传递，否则 Worker 会丢失非当前套餐的执行门禁。
  states: z49.record(
    z49.string(),
    z49.object({
      availability: z49.enum(["available", "pending", "unavailable", "unknown"]),
      entitled: z49.boolean(),
      unavailableReason: accountProviderUnavailableReasonSchema.optional(),
      current: z49.boolean().optional(),
      connectionKey: z49.string().optional(),
      effectiveAt: z49.number().finite().optional()
    }).strict()
  )
}).strict();
var zcodeProviderUpdateAccountConfigResultSchema = z49.object({
  // 收到账号结果不代表配套 Built-in 已到达；应用版本只能读取 Registry 快照。
  receivedRevision: nonEmptyString3,
  providerCount: z49.number().int().nonnegative(),
  status: z49.enum(["received", "unchanged"])
}).strict();
var zcodeInteractionPreferencesSchema = z49.object({
  askUserQuestionAutoResolutionEnabled: z49.boolean()
}).strict();
var zcodeWorkspaceUpdateInteractionPreferencesParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  preferences: zcodeInteractionPreferencesSchema
}).strict();
var zcodeWorkspaceUpdateInteractionPreferencesResultSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  askUserQuestionAutoResolutionEnabled: z49.boolean(),
  snoozedInteractionCount: z49.number().int().nonnegative()
}).strict();
var zcodeModelIoPreferencesSchema = z49.object({
  fullRetentionEnabled: z49.boolean()
}).strict();
var zcodeWorkspaceUpdateModelIoPreferencesParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  preferences: zcodeModelIoPreferencesSchema
}).strict();
var zcodeWorkspaceUpdateModelIoPreferencesResultSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  fullRetentionEnabled: z49.boolean(),
  updatedSessionCount: z49.number().int().nonnegative()
}).strict();
var zcodeWorkspaceUpdateOffPeakToolPolicyParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z49.boolean()
}).strict();
var zcodeWorkspaceUpdateOffPeakToolPolicyResultSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z49.boolean()
}).strict();
var zcodeWorkspaceUpdateDynamicWorkflowPolicyParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z49.boolean()
}).strict();
var zcodeWorkspaceUpdateDynamicWorkflowPolicyResultSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z49.boolean()
}).strict();
var zcodePermissionRequestParamsSchema = z49.object({
  requestId: nonEmptyString3,
  sessionId: nonEmptyString3,
  turnId: nonEmptyString3.optional(),
  toolCallId: nonEmptyString3,
  toolName: nonEmptyString3,
  reason: z49.string(),
  riskLevel: z49.enum(["low", "medium", "high", "critical"]),
  input: z49.unknown(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  options: z49.array(zcodePermissionOptionSchema).min(1)
}).strict();
var zcodeBrowserListParamsSchema = z49.object({
  requestId: nonEmptyString3,
  sessionId: nonEmptyString3,
  turnId: nonEmptyString3.optional(),
  workspaceKey: nonEmptyString3,
  workspacePath: nonEmptyString3,
  workspaceIdentity: nonEmptyString3.optional(),
  remoteSessionId: nonEmptyString3.optional(),
  clientMode: browserClientModeSchema,
  sessionContext: browserSessionContextKindSchema
}).strict();
var zcodeBrowserListResultSchema = browserBackendListResultSchema;
var zcodeBrowserExecuteParamsSchema = z49.object({
  requestId: nonEmptyString3,
  sessionId: nonEmptyString3,
  turnId: nonEmptyString3.optional(),
  browserId: nonEmptyString3.optional(),
  browserGeneration: z49.number().int().nonnegative().optional(),
  workspaceKey: nonEmptyString3.optional(),
  workspacePath: nonEmptyString3.optional(),
  workspaceIdentity: nonEmptyString3.optional(),
  remoteSessionId: nonEmptyString3.optional(),
  clientMode: browserClientModeSchema.optional(),
  sessionContext: browserSessionContextKindSchema.optional(),
  command: browserCommandSchema
}).strict();
var zcodeBrowserExecuteResultSchema = browserCommandResultSchema;
var zcodeUserInputOptionSchema = z49.object({
  value: nonEmptyString3,
  label: nonEmptyString3,
  description: z49.string().optional(),
  preview: z49.string().optional()
}).strict();
var zcodeUserInputQuestionSchema = z49.object({
  question: nonEmptyString3,
  header: nonEmptyString3,
  options: z49.array(zcodeUserInputOptionSchema).min(1),
  multiSelect: z49.boolean().optional()
}).strict();
var zcodeUserInputRequestParamsSchema = z49.object({
  requestId: nonEmptyString3,
  sessionId: nonEmptyString3,
  turnId: nonEmptyString3.optional(),
  toolCallId: nonEmptyString3.optional(),
  toolName: nonEmptyString3.optional(),
  prompt: z49.string().optional(),
  questions: z49.array(zcodeUserInputQuestionSchema).min(1).optional(),
  input: z49.unknown().optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  schema: z49.unknown().optional()
}).strict();
var zcodeUserInputResponseSchema = z49.object({
  action: z49.enum(["accept", "decline", "cancel"]),
  content: jsonObjectSchema2.optional(),
  reason: z49.string().optional()
}).strict();
var zcodeProviderRuntimeHeadersRequestReasonSchema = z49.enum(["model-request"]);
var zcodeProviderRuntimeHeadersRequestParamsSchema = z49.object({
  requestId: nonEmptyString3,
  sessionId: nonEmptyString3,
  turnId: nonEmptyString3.optional(),
  workspace: zcodeWorkspaceRefSchema,
  modelSelection: modelSelectionSchema,
  providerId: nonEmptyString3,
  accountAccess: zcodeProviderAccountAccessSchema.optional(),
  reason: zcodeProviderRuntimeHeadersRequestReasonSchema
}).strict();
var zcodeProviderRuntimeHeadersCancelledSchema = z49.object({
  requestId: nonEmptyString3,
  sessionId: nonEmptyString3,
  workspace: zcodeWorkspaceRefSchema
}).strict();
var zcodeProviderRuntimeHeadersResponseSchema = z49.discriminatedUnion("headersApplied", [
  z49.object({
    headersApplied: z49.literal(true),
    // 合并重接：成功必须携带当前请求的鉴权材料，不依赖旧 Registry 已被写入。
    requestAuth: z49.object({
      apiKey: nonEmptyString3.optional(),
      headers: z49.record(nonEmptyString3, nonEmptyString3).optional()
    }).strict(),
    errorMessage: nonEmptyString3.optional()
  }).strict(),
  z49.object({
    headersApplied: z49.literal(false),
    errorMessage: nonEmptyString3.optional()
  }).strict()
]);
var zcodeOfficialMcpAuthHeadersRequestParamsSchema = z49.object({
  requestId: nonEmptyString3,
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString3,
  mcpKey: nonEmptyString3,
  targetOrigin: nonEmptyString3
}).strict();
var zcodeOfficialMcpAuthFailureReasonSchema = z49.enum(
  OFFICIAL_MCP_AUTH_PORT_FAILURE_REASONS
);
var zcodeOfficialMcpAuthHeadersResponseSchema = z49.discriminatedUnion("ok", [
  z49.object({
    ok: z49.literal(true),
    headers: z49.record(z49.string(), z49.string())
  }).strict(),
  z49.object({
    ok: z49.literal(false),
    reason: zcodeOfficialMcpAuthFailureReasonSchema
  }).strict()
]);
var zcodePluginOptionValueSchema = z49.union([z49.string(), z49.number(), z49.boolean()]);
var zcodePluginScopeSchema = z49.enum(["user", "workspace"]);
var zcodePluginHookDetailSchema = z49.object({
  event: nonEmptyString3,
  matcher: z49.string().optional(),
  type: z49.enum(["command", "process"]),
  command: nonEmptyString3,
  args: z49.array(z49.string()).optional(),
  async: z49.boolean().optional(),
  shell: z49.union([z49.literal(true), z49.string()]).optional(),
  timeout: z49.number().positive().optional(),
  timeoutMs: z49.number().int().positive().optional(),
  statusMessage: z49.string().optional(),
  sourcePath: z49.string(),
  runnable: z49.boolean()
}).strict();
var zcodePluginUserConfigOptionSchema = z49.object({
  default: zcodePluginOptionValueSchema.optional(),
  description: z49.string().optional(),
  required: z49.boolean().optional(),
  sensitive: z49.boolean().optional(),
  title: z49.string().optional(),
  type: z49.enum(["string", "number", "boolean", "directory", "file"]).optional()
}).strict();
var zcodePluginComponentKindSchema = z49.enum(["agent", "command", "skill", "hook", "mcp"]);
var zcodePluginComponentItemSchema = z49.object({
  name: nonEmptyString3,
  // 描述来自组件 frontmatter（SKILL.md / command / agent）或 manifest；缺失时省略，不伪造。
  description: z49.string().optional()
}).strict();
var zcodePluginComponentGroupSchema = z49.object({
  kind: zcodePluginComponentKindSchema,
  items: z49.array(zcodePluginComponentItemSchema)
}).strict();
var zcodePluginInfoSchema = z49.object({
  id: nonEmptyString3,
  name: nonEmptyString3,
  description: z49.string().optional(),
  version: z49.string().optional(),
  enabled: z49.boolean(),
  source: nonEmptyString3,
  marketplace: nonEmptyString3,
  // manifest（plugin.json）的作者/主页回退字段；商店 listing 缺失时详情页信息区用它兜底。
  author: z49.string().optional(),
  authorUrl: z49.string().optional(),
  homepage: z49.string().optional(),
  skillCount: z49.number().int().nonnegative().optional(),
  skillRootCount: z49.number().int().nonnegative(),
  commandRootCount: z49.number().int().nonnegative(),
  // 权威组件清单（名称 + 可选描述），由 CLI 对插件根目录枚举得出，与启用态无关。
  // 详情 UI 直接展示，取代旧的「数量取协议、名称靠 UI 侧 join」脆弱方案。optional 兼容旧 payload。
  components: z49.array(zcodePluginComponentGroupSchema).optional(),
  declaredMcpServerNames: z49.array(z49.string()).optional(),
  hostMcpServerNames: z49.array(z49.string()).optional(),
  mcpServerNames: z49.array(z49.string()),
  hookDetails: z49.array(zcodePluginHookDetailSchema).optional(),
  rootPath: z49.string(),
  userConfig: z49.record(z49.string(), zcodePluginUserConfigOptionSchema).optional(),
  configuredOptions: z49.record(z49.string(), zcodePluginOptionValueSchema).optional(),
  // 缺省表示 package 可用；missing 用于保留已声明但目标 Host 尚未物化的配置行。
  packageStatus: z49.literal("missing").optional(),
  rootSource: zcodePluginScopeSchema.optional(),
  enabledSource: zcodePluginScopeSchema.optional(),
  optionSources: z49.record(z49.string(), zcodePluginScopeSchema).optional()
}).strict();
var zcodePluginDiagnosticSchema = z49.object({
  code: z49.string(),
  message: z49.string(),
  severity: z49.enum(["warning", "error"]).optional(),
  pluginId: z49.string().optional()
}).strict();
var zcodePluginsListParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  configScope: zcodePluginScopeSchema.optional()
}).strict();
var zcodePluginsListResultSchema = z49.object({
  plugins: z49.array(zcodePluginInfoSchema),
  diagnostics: z49.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginReferenceCatalogEntrySchema = z49.object({
  // 仅 referenceCatalogWithCategory 返回；旧入口保持原结构。
  category: nonEmptyString3.optional(),
  pluginId: nonEmptyString3,
  name: nonEmptyString3,
  marketplace: nonEmptyString3,
  icon: z49.string().optional(),
  // 商店 listing 的 display-only 本地化显示名投影（沿 icon 先例）：让 Picker 能按
  // 中文显示名搜索/展示；locale 解析复用 shared 的 plugin-display-name helper。
  displayName: z49.string().optional(),
  displayNameI18n: z49.record(z49.string(), z49.string()).optional(),
  // 仅供 Picker 展示，不进入能力身份或 model-only reminder。
  description: z49.string().optional(),
  descriptionI18n: z49.record(z49.string(), z49.string()).optional(),
  enabled: z49.boolean(),
  // 非空 = 与其他 enabled Plugin 共享 manifest name 的 V1 fail closed 冲突：
  // Picker 禁选并展示原因，runtime 解析按 ambiguous 跳过。
  conflictingPluginIds: z49.array(nonEmptyString3),
  skillQualifiedNames: z49.array(nonEmptyString3),
  mcpServerNames: z49.array(nonEmptyString3),
  // 旧 Host 不投影该字段时按空数组兼容；只有新 Agent 会把它用于 reminder live 交集。
  subagentNames: z49.array(nonEmptyString3).default([])
}).strict();
var zcodePluginsReferenceCatalogParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  // 已有 Session 的 Picker 必须带 sessionId 才能拿到 session-owned catalog；
  // session 不存在时按协议错误 fail closed，禁止静默回退 workspace authority。
  sessionId: nonEmptyString3.optional()
}).strict();
var zcodePluginsReferenceCatalogResultSchema = z49.object({
  authority: z49.enum(["session", "workspace"]),
  plugins: z49.array(zcodePluginReferenceCatalogEntrySchema)
}).strict();
var zcodeSkillReferenceCatalogEntrySchema = z49.object({
  id: nonEmptyString3,
  name: nonEmptyString3,
  description: z49.string(),
  path: nonEmptyString3,
  scope: z49.enum(["workspace", "user", "plugin"]),
  enabled: z49.literal(true),
  pluginName: nonEmptyString3.optional()
}).strict();
var zcodeSkillsReferenceCatalogParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  // 带 sessionId 时必须命中该进程内的 resident Session；未知 Session fail closed，
  // 禁止回退到 workspace 当前目录而把新 Skill 泄漏进旧对话。
  sessionId: nonEmptyString3.optional()
}).strict();
var zcodeSkillsReferenceCatalogResultSchema = z49.object({
  authority: z49.enum(["session", "workspace"]),
  skills: z49.array(zcodeSkillReferenceCatalogEntrySchema)
}).strict();
var zcodeSavedWorkflowArgTypeSchema = z49.enum(["string", "number", "boolean", "json"]);
var zcodeSavedWorkflowArgDeclarationSchema = z49.object({
  type: zcodeSavedWorkflowArgTypeSchema,
  description: z49.string().optional(),
  required: z49.boolean().optional(),
  default: z49.unknown().optional()
}).strict();
var zcodeSavedWorkflowArgsDeclarationSchema = z49.record(
  z49.string(),
  zcodeSavedWorkflowArgDeclarationSchema
);
var zcodeSavedWorkflowMetaSchema = z49.object({
  description: nonEmptyString3,
  whenToUse: nonEmptyString3.optional(),
  args: zcodeSavedWorkflowArgsDeclarationSchema.optional()
}).strict();
var zcodeSavedWorkflowScopeSchema = z49.enum(["project", "global"]);
var zcodeSavedWorkflowEntrySchema = z49.object({
  name: nonEmptyString3,
  description: z49.string(),
  whenToUse: z49.string().optional(),
  args: zcodeSavedWorkflowArgsDeclarationSchema.optional(),
  scope: zcodeSavedWorkflowScopeSchema,
  path: nonEmptyString3
}).strict();
var zcodeSavedWorkflowInvalidEntrySchema = z49.object({ path: nonEmptyString3, reason: nonEmptyString3 }).strict();
var zcodeSavedWorkflowFailureReasonSchema = z49.enum([
  "invalid_name",
  "not_found",
  "parse_error",
  "read_error"
]);
var zcodeSavedWorkflowFailureSchema = z49.object({
  ok: z49.literal(false),
  reason: zcodeSavedWorkflowFailureReasonSchema,
  detail: z49.string().optional()
}).strict();
var zcodeWorkflowsListParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  // 缺省即 `project`（本项目档）。给 `global` 时改扫本机 `~/.zcode/workflows/`；此时 `workspace`
  // 仍必填，但只是**载体运行时**——协议处理器对全局档不读它的路径。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeWorkflowsListResultSchema = z49.object({
  workflows: z49.array(zcodeSavedWorkflowEntrySchema),
  invalid: z49.array(zcodeSavedWorkflowInvalidEntrySchema),
  // 扫过的目录（本地绝对路径），即使目录还不存在也回：GUI 的文件监听靠它 watch。
  dir: nonEmptyString3
}).strict();
var zcodeWorkflowsGetParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString3,
  // 缺省 `project`；`global` 时只查本机全局根。`workspace` 语义同 list（全局档只当载体）。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeWorkflowsGetResultSchema = z49.union([
  z49.object({
    ok: z49.literal(true),
    name: nonEmptyString3,
    path: nonEmptyString3,
    scope: zcodeSavedWorkflowScopeSchema,
    meta: zcodeSavedWorkflowMetaSchema,
    /** 脚本本体（frontmatter 之后逐字节），即被类型检查与执行的那一份。 */
    script: z49.string()
  }).strict(),
  zcodeSavedWorkflowFailureSchema
]);
var zcodeWorkflowsUpdateMetaParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString3,
  meta: zcodeSavedWorkflowMetaSchema,
  // 缺省 `project`；`global` 时只写本机全局根那一份。`workspace` 语义同 list。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeWorkflowsUpdateMetaResultSchema = z49.union([
  z49.object({ ok: z49.literal(true), path: nonEmptyString3 }).strict(),
  zcodeSavedWorkflowFailureSchema
]);
var zcodeWorkflowsDeleteParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString3,
  // 缺省 `project`；`global` 时按 scope 选根删除（不再写死 roots[0]）。`workspace` 语义同 list。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeWorkflowsDeleteResultSchema = z49.union([
  z49.object({ ok: z49.literal(true), path: nonEmptyString3 }).strict(),
  zcodeSavedWorkflowFailureSchema
]);
var ZCODE_WORKFLOWS_RUNS_MAX_LIMIT = 50;
var zcodeWorkflowsRunsParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  /** 只要这个名字的 run（`dwf_run.name` 字面等值）；缺省即本项目全部 run。 */
  name: nonEmptyString3.optional(),
  limit: z49.number().int().min(1).max(ZCODE_WORKFLOWS_RUNS_MAX_LIMIT),
  // 缺省 `project`：只查 `dwf_run.cwd === workspacePath` 的 run。`global` 时**不**按 cwd 过滤，
  // 跨所有项目取该名字的运行历史（全局工作流在任何项目里跑，历史因此跨 cwd）；结果行带 `cwd`
  // 供 GUI 标项目。`workspace` 语义同 list（全局档只当载体）。
  scope: zcodeSavedWorkflowScopeSchema.optional()
}).strict();
var zcodeSavedWorkflowRunStatusSchema = z49.enum([
  "pending",
  "running",
  "completed",
  "errored",
  "stopped"
]);
var zcodeSavedWorkflowRunStopReasonSchema = z49.enum([
  "user",
  "model",
  "provider",
  "interrupted",
  "superseded"
]);
var zcodeSavedWorkflowRunSchema = z49.object({
  runId: nonEmptyString3,
  name: z49.string().optional(),
  status: zcodeSavedWorkflowRunStatusSchema,
  // `status === "stopped"` 才在场。
  stopReason: zcodeSavedWorkflowRunStopReasonSchema.optional(),
  createdAt: z49.number(),
  updatedAt: z49.number(),
  spentTokens: z49.number(),
  /** 发起它的会话与 CreateWorkflow 工具调用：有这两个才能从中枢打开实例详情。老行可缺。 */
  parentSessionId: z49.string().optional(),
  toolCallId: z49.string().optional(),
  args: z49.record(z49.string(), z49.unknown()).optional(),
  // 实际运行的项目目录（`dwf_run.cwd`）。全局档的 `workflows/runs` 跨 cwd 查询，GUI 用它给
  // 每行标项目；项目档变体里它恒等于 workspacePath，GUI 可忽略。老行可缺。
  cwd: z49.string().optional(),
  // 这次运行发布的**用户面产物**：中枢的运行历史行在
  // 状态词之后画一串 kind chips，详情页头部的「最近产物」条取最近一次 completed run 的这一份。
  // ⚠ 术语：这里的 artifact 是脚本经 `artifact.*` 发布给用户看的产出，不是脚本的顶层返回值。
  // 只带 chip 画得下的字段（≤ 8 件，取最新版的元数据）；字节与条目经 v4 查询按需读。
  // optional，照上面 `cwd` 的先例：老 CLI 不发，少一个键是退化不是错误。
  artifacts: z49.array(
    z49.object({
      id: nonEmptyString3,
      kind: z49.enum(["file", "markdown", "chart", "table", "metrics", "board"]),
      title: z49.string().optional(),
      version: z49.number(),
      contentType: z49.string().optional()
    }).strict()
  ).max(8).optional()
}).strict();
var zcodeWorkflowsRunsResultSchema = z49.object({
  runs: z49.array(zcodeSavedWorkflowRunSchema),
  /** 为真时才在场：还有更多 run 没进这一页（多取一条判定，不是 length === limit）。 */
  truncated: z49.literal(true).optional()
}).strict();
var zcodeWorkflowsMoveParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString3
}).strict();
var zcodeWorkflowsMoveResultSchema = z49.union([
  z49.object({
    ok: z49.literal(true),
    /** 源落点路径（全局根，搬走前）。 */
    from: nonEmptyString3,
    /** 目标落点路径（项目根，搬到处）。 */
    to: nonEmptyString3
  }).strict(),
  z49.object({
    ok: z49.literal(false),
    // target_exists：目标档已有同名（move 不覆盖）；not_found：源档没有这个名字；
    // read_error / write_error：搬运时的 I/O 失败；invalid_name：名字先验没过。
    reason: z49.enum(["invalid_name", "not_found", "target_exists", "read_error", "write_error"]),
    path: z49.string().optional(),
    detail: z49.string().optional()
  }).strict()
]);
var zcodePluginSuggestedReferenceStatusSchema = z49.enum([
  "ready",
  "disabled",
  "missing",
  "conflict",
  "unavailable"
]);
var zcodePluginOperationStateSchema = z49.enum([
  "checking",
  "refreshing",
  "installing",
  "enabling",
  "cancelling",
  "cancelled",
  "complete",
  "failed"
]);
var zcodePluginOperationProgressNotificationSchema = z49.object({
  operationId: nonEmptyString3,
  state: z49.literal("refreshing")
}).strict();
var zcodePluginsResolveSuggestedReferenceParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  stableId: nonEmptyString3,
  operationId: nonEmptyString3,
  clientMode: zcodeDeliveryKindSchema,
  deliveryKind: zcodeDeliveryKindSchema
}).strict();
var zcodePluginsSetEnabledParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString3,
  enabled: z49.boolean(),
  operationId: nonEmptyString3.optional(),
  scope: zcodePluginScopeSchema.optional()
}).strict();
var zcodePluginsSetEnabledResultSchema = z49.object({
  plugin: zcodePluginInfoSchema,
  enabled: z49.boolean()
}).strict();
var zcodePluginStoreListingSchema = z49.object({
  displayName: z49.string().optional(),
  displayNameI18n: z49.record(z49.string(), z49.string()).optional(),
  descriptionI18n: z49.record(z49.string(), z49.string()).optional(),
  icon: z49.string().optional(),
  category: z49.string().optional(),
  author: z49.string().optional(),
  authorUrl: z49.string().optional(),
  homepage: z49.string().optional(),
  privacyPolicy: z49.string().optional(),
  termsOfService: z49.string().optional(),
  heroImage: z49.string().optional(),
  examplePrompts: z49.array(z49.string()).optional(),
  examplePromptsI18n: z49.record(z49.string(), z49.array(z49.string())).optional(),
  /**
   * 需要付费套餐才好用的插件：市场目录条目声明 `requiresPaidPlan: true`，
   * UI 在标题右侧展示提示图标。描述的是「使用条件」而非「插件是收费商品」——
   * 不参与安装门禁与计费，命名也不绑定具体套餐商品名。
   */
  requiresPaidPlan: z49.boolean().optional()
}).strict();
var zcodePluginsResolveSuggestedReferenceResultSchema = z49.object({
  stableId: nonEmptyString3,
  status: zcodePluginSuggestedReferenceStatusSchema,
  marketplace: nonEmptyString3.optional(),
  pluginName: nonEmptyString3.optional(),
  sourceTrust: z49.literal("official").optional(),
  // 官方 Marketplace listing 的可选展示投影；不参与身份、安装或权限判断。
  icon: z49.string().optional(),
  listing: zcodePluginStoreListingSchema.optional(),
  diagnostics: z49.array(zcodePluginDiagnosticSchema)
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
var zcodePluginMarketplaceSummarySchema = z49.object({
  id: nonEmptyString3,
  name: nonEmptyString3,
  source: jsonObjectSchema2,
  description: z49.string().optional(),
  lastUpdated: z49.string().optional(),
  pluginCount: z49.number().int().nonnegative(),
  isOfficial: z49.boolean().optional(),
  // 目录顶层 featured 策展名单（商店「公开」分段 Featured 区）。
  featured: z49.array(z49.string()).optional(),
  refreshFailure: z49.object({
    code: z49.string(),
    failedAt: z49.string(),
    message: z49.string()
  }).strict().optional()
}).strict();
var zcodeAvailablePluginSummarySchema = z49.object({
  id: nonEmptyString3,
  name: nonEmptyString3,
  marketplace: nonEmptyString3,
  description: z49.string().optional(),
  version: z49.string().optional(),
  installed: z49.boolean(),
  componentTypes: z49.array(z49.string()).optional(),
  listing: zcodePluginStoreListingSchema.optional()
}).strict();
var zcodeInstalledPluginSummarySchema = z49.object({
  id: nonEmptyString3,
  name: nonEmptyString3,
  marketplace: nonEmptyString3,
  description: z49.string().optional(),
  version: z49.string().optional(),
  enabled: z49.boolean(),
  scope: zcodePluginScopeSchema,
  installPath: z49.string().optional(),
  installedAt: z49.string().optional(),
  componentTypes: z49.array(z49.string()).optional(),
  hookDetails: z49.array(zcodePluginHookDetailSchema).optional(),
  updateStatus: z49.enum(["none", "update-available", "version-changed"]).optional(),
  latestVersion: z49.string().optional(),
  listing: zcodePluginStoreListingSchema.optional()
}).strict();
var zcodePluginsOverviewParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  configScope: zcodePluginScopeSchema.optional()
}).strict();
var zcodePluginsOverviewResultSchema = z49.object({
  marketplaces: z49.array(zcodePluginMarketplaceSummarySchema),
  availablePlugins: z49.array(zcodeAvailablePluginSummarySchema),
  installedPlugins: z49.array(zcodeInstalledPluginSummarySchema),
  restorableBuiltins: z49.array(zcodeAvailablePluginSummarySchema),
  diagnostics: z49.array(zcodePluginDiagnosticSchema),
  capability: z49.object({
    supported: z49.boolean(),
    reason: z49.string().optional()
  }).strict()
}).strict();
var zcodePluginsMarketplaceAddParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  source: nonEmptyString3,
  dryRun: z49.boolean().optional(),
  operationId: nonEmptyString3.optional()
}).strict();
var zcodePluginsMarketplaceRemoveParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  marketplace: nonEmptyString3
}).strict();
var zcodePluginsMarketplaceUpdateParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  marketplace: nonEmptyString3.optional(),
  operationId: nonEmptyString3.optional()
}).strict();
var zcodePluginsMarketplaceMutationResultSchema = z49.object({
  marketplace: zcodePluginMarketplaceSummarySchema.optional(),
  marketplaces: z49.array(zcodePluginMarketplaceSummarySchema).optional(),
  diagnostics: z49.array(zcodePluginDiagnosticSchema).optional()
}).strict();
var zcodePluginsInstallParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginName: nonEmptyString3,
  marketplace: nonEmptyString3,
  scope: zcodePluginScopeSchema.optional(),
  dryRun: z49.boolean().optional(),
  operationId: nonEmptyString3.optional()
}).strict();
var zcodePluginsCancelOperationParamsSchema = z49.object({
  operationId: nonEmptyString3
}).strict();
var zcodePluginsCancelOperationResultSchema = z49.object({
  operationId: nonEmptyString3,
  cancelled: z49.boolean()
}).strict();
var zcodePluginsUninstallParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString3.optional(),
  pluginName: nonEmptyString3.optional(),
  marketplace: nonEmptyString3.optional(),
  removeCache: z49.boolean().optional()
}).strict();
var zcodePluginsInstallResultSchema = z49.object({
  installedPlugins: z49.array(zcodeInstalledPluginSummarySchema),
  dependencyClosure: z49.array(z49.string()),
  diagnostics: z49.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginsUninstallResultSchema = z49.object({
  removedPlugin: zcodeInstalledPluginSummarySchema.optional(),
  diagnostics: z49.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginsUpdateParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString3.optional(),
  marketplace: nonEmptyString3.optional()
}).strict();
var zcodePluginsRestoreBuiltinParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString3
}).strict();
var zcodePluginsRestoreBuiltinResultSchema = z49.object({
  pluginId: nonEmptyString3,
  diagnostics: z49.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginsConfigureParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString3,
  options: jsonObjectSchema2,
  clearOptionKeys: z49.array(nonEmptyString3).optional(),
  scope: zcodePluginScopeSchema.optional(),
  dryRun: z49.boolean().optional()
}).strict();
var zcodePluginsConfigureResultSchema = z49.object({
  pluginId: nonEmptyString3,
  diagnostics: z49.array(zcodePluginDiagnosticSchema)
}).strict();
var zcodePluginsResetConfigParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString3,
  scope: zcodePluginScopeSchema.optional()
}).strict();
var zcodePluginsValidateParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginName: nonEmptyString3.optional(),
  marketplace: nonEmptyString3.optional(),
  source: nonEmptyString3.optional()
}).strict();
var zcodePluginsValidateResultSchema = z49.object({
  ok: z49.boolean(),
  diagnostics: z49.array(zcodePluginDiagnosticSchema),
  compatibility: z49.object({
    runnable: z49.array(z49.string()),
    diagnosticOnly: z49.array(z49.string()),
    unsupported: z49.array(z49.string())
  }).strict()
}).strict();
var zcodePluginsDescribeParamsSchema = z49.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginName: nonEmptyString3,
  marketplace: nonEmptyString3
}).strict();
var zcodePluginsDescribeResultSchema = z49.object({
  components: z49.array(zcodePluginComponentGroupSchema),
  diagnostics: z49.array(zcodePluginDiagnosticSchema).optional(),
  // 插件包内 plugin.json 的展示性回退字段；未安装候选详情页信息区在商店 listing 缺失时兜底。
  metadata: z49.object({
    author: z49.string().optional(),
    authorUrl: z49.string().optional(),
    homepage: z49.string().optional(),
    version: z49.string().optional()
  }).strict().optional()
}).strict();
var zcodeAutomationScheduleRuleSchema = z49.object({
  unit: z49.enum(["minute", "hourly", "daily", "weekly", "monthly", "yearly"]),
  interval: z49.number().int().positive(),
  hour: z49.number().int().min(0).max(23),
  minute: z49.number().int().min(0).max(59),
  anchorAt: z49.number().int(),
  weekdays: z49.array(z49.number().int().min(0).max(6)).optional(),
  monthDays: z49.array(z49.number().int().min(1).max(31)).optional(),
  /** yearly 用：1-12 人类月份。缺省回退 anchorAt 的月份（兼容未写该字段的旧记录）。 */
  months: z49.array(z49.number().int().min(1).max(12)).optional(),
  monthlyMode: z49.enum(["date", "weekday"]).optional()
}).strict();
var zcodeAutomationIntervalUnitSchema = z49.enum([
  "minute",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly"
]);
var zcodeAutomationProtocolSchema = z49.object({
  automationId: nonEmptyString3,
  title: z49.string(),
  cronExpr: nonEmptyString3,
  prompt: nonEmptyString3,
  modelSelection: modelSelectionSchema.optional(),
  mode: zcodeTaskModeSchema.optional(),
  targetTaskId: nonEmptyString3.optional(),
  enabled: z49.boolean(),
  lifecycleStatus: z49.enum(["active", "completed", "failed", "paused"]),
  nextRunAt: timestampMsSchema2.optional(),
  lastRunAt: timestampMsSchema2.optional(),
  runCount: z49.number().int().nonnegative(),
  recurring: z49.boolean(),
  maxRuns: z49.number().int().positive().optional(),
  // 自定义重复规则；缺省时调度回退到解析 cronExpr。会话卡片必须读到本字段才能展示
  // cron 无法表达的真实间隔（如每50小时、每40天，兼容 cronExpr 只是 0 * * * *）。
  scheduleRule: zcodeAutomationScheduleRuleSchema.optional()
}).strict();
var zcodeAutomationCreateParamsSchema = z49.object({
  title: z49.string().optional(),
  cronExpr: nonEmptyString3,
  relativeDelayMinutes: z49.number().int().positive().max(525600).optional(),
  prompt: nonEmptyString3,
  modelSelection: modelSelectionSchema.optional(),
  mode: zcodeTaskModeSchema.optional(),
  targetTaskId: nonEmptyString3.optional(),
  botDeliveryTarget: zcodeAutomationBotDeliveryTargetSchema.optional(),
  recurring: z49.boolean().optional(),
  maxRuns: z49.number().int().positive().optional(),
  // 会话侧自定义重复 carrier：每 N 分钟/小时/天/周/月/年均通过此字段归一化为权威 scheduleRule，
  // cronExpr 仅作合法兼容展示。
  intervalUnit: zcodeAutomationIntervalUnitSchema.optional(),
  interval: z49.number().int().min(1).max(200).optional()
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
var zcodeAutomationCreateResultSchema = z49.object({ automation: zcodeAutomationProtocolSchema }).strict();
var zcodeAutomationUpdateParamsSchema = z49.object({
  automationId: nonEmptyString3,
  title: nonEmptyString3.optional(),
  cronExpr: nonEmptyString3.optional(),
  prompt: nonEmptyString3.optional(),
  recurring: z49.boolean().optional(),
  maxRuns: z49.number().int().positive().nullable().optional(),
  // 会话侧自定义重复 carrier（同 create 侧语义）。
  intervalUnit: zcodeAutomationIntervalUnitSchema.optional(),
  interval: z49.number().int().min(1).max(200).optional()
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
var zcodeAutomationUpdateResultSchema = z49.object({ automation: zcodeAutomationProtocolSchema }).strict();
var zcodeAutomationListParamsSchema = z49.object({}).strict();
var zcodeAutomationListResultSchema = z49.object({ automations: z49.array(zcodeAutomationProtocolSchema) }).strict();
var zcodeAutomationCheckTaskBindingParamsSchema = z49.object({ targetTaskId: nonEmptyString3 }).strict();
var zcodeAutomationCheckTaskBindingResultSchema = z49.object({ bound: z49.boolean() }).strict();
var zcodeAutomationDeleteParamsSchema = z49.object({ automationId: nonEmptyString3 }).strict();
var zcodeAutomationDeleteResultSchema = z49.object({ deleted: z49.boolean() }).strict();
var zcodeOffPeakPermissionModeSchema = z49.enum(["build", "edit", "plan", "yolo"]);
var zcodeOffPeakCreateParamsSchema = z49.object({
  title: nonEmptyString3,
  prompt: nonEmptyString3,
  permissionMode: zcodeOffPeakPermissionModeSchema.optional(),
  model: nonEmptyString3.optional(),
  thoughtLevel: nonEmptyString3.optional(),
  // 会话内创建绑定当前会话（对齐 automation/create 的 targetTaskId），由 CLI 端口填入。
  boundSessionId: nonEmptyString3.optional()
}).strict();
var zcodeOffPeakTaskSnapshotSchema = z49.object({
  offPeakTaskId: nonEmptyString3,
  title: z49.string(),
  status: z49.enum(["queued", "paused", "running", "completed", "failed", "cancelled"]),
  queuePosition: z49.number().int().positive().optional(),
  sessionId: nonEmptyString3.optional(),
  createdAt: z49.number().int().nonnegative()
}).strict();
var zcodeOffPeakCreateResultSchema = z49.discriminatedUnion("ok", [
  z49.object({ ok: z49.literal(true), task: zcodeOffPeakTaskSnapshotSchema }).strict(),
  z49.object({
    ok: z49.literal(false),
    failureStage: z49.enum(["client_validation", "ticket_request", "local_persist"]),
    errorCategory: z49.enum([
      "client_validation",
      "eligibility_3101",
      "quota_3103",
      "network",
      "invalid_response",
      "local_persist",
      "unknown"
    ]),
    errorCode: z49.string()
  }).strict()
]);
var zcodeOffPeakListParamsSchema = z49.object({}).strict();
var zcodeOffPeakListResultSchema = z49.object({ tasks: z49.array(zcodeOffPeakTaskSnapshotSchema) }).strict();
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
var zcodeProtocolEmptyResultSchema = z49.object({}).strict();
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
var zcodeStoragePreparationFrameSchema = z49.discriminatedUnion("method", [
  z49.object({
    method: z49.literal("startup/storagePath"),
    params: z49.object({ path: z49.string().min(1).max(32768) }).strict()
  }).strict(),
  z49.object({ method: z49.literal("startup/storagePrepared"), params: z49.object({}).strict() }).strict(),
  z49.object({ method: z49.literal("startup/storageState"), params: zcodeStorageStartupStateSchema }).strict()
]);
var zcodeStoragePathReadySchema = z49.object({ method: z49.literal("startup/storagePathReady"), reuse: z49.boolean().optional() }).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/command.ts
var createSessionRequestedConfigSchema = z50.object({
  modelSelection: modelSelectionSchema.optional(),
  provider: z50.string().optional(),
  model: z50.string().optional(),
  thought: z50.string().optional(),
  followupMode: z50.enum(["queue", "guide"]).optional(),
  // createSession.config 表达“请求覆盖字段”，不能复用 snapshot 的
  // sessionConfigStateSchema.partial()；snapshot 为兼容旧快照给 mode 设了 default("build")，
  // 会把“没传 mode”误变成“请求切回 build”，覆盖 workspace 默认 yolo。
  mode: z50.string().optional(),
  planEnabled: z50.boolean().optional()
});
var commandPayloadSchemas = {
  // firstInput 缺省 → phase=draft 空会话；携带 → 直接 turnHeader+userInput rows。
  createSession: z50.object({
    workspaceId: z50.string(),
    firstInput: z50.object({
      text: z50.string(),
      attachments: z50.array(attachmentRefSchema).optional(),
      modelSelection: modelSelectionSchema.optional(),
      mode: submissionModeSchema.optional(),
      planEnabled: z50.boolean().optional()
    }).optional(),
    config: createSessionRequestedConfigSchema.optional(),
    // MCP 是 runtime 启动期配置，必须随 create 一次性进入 record，不能在首发后补写。
    mcpServers: z50.array(zcodeProtocolMcpServerSchema).optional(),
    // Off-Peak 工具面 flag，与 legacy session/create 等价——V4 createSession 是桌面
    // 新会话的实际创建路径，不透传则 OffPeakCreate/OffPeakList 永不注册。additive，
    // 旧 CLI 的 z.object 会静默丢弃该键（fail-closed）。
    offPeakToolEnabled: z50.boolean().optional(),
    // 动态工作流灰度 flag，与 offPeakToolEnabled 同一模式。
    dynamicWorkflowEnabled: z50.boolean().optional()
  }),
  // 父会话由 envelope.sessionId 指定；服务端从父 record 派生完整运行配置。
  // firstInput 存在时，child 创建完成后立即启动首条普通输入；缺省则保持空副屏。
  createSelectionSideSession: z50.object({
    firstInput: z50.object({
      text: z50.string().trim().min(1),
      // 提交推荐只覆盖新 child 的完整选择，缺省保留父 runtime 继承。
      modelSelection: modelSelectionSchema.optional()
    }).optional()
  }),
  // 按 inputRouting 裁决：startNow / enqueue / guide / choice。
  // heldQueueDisposition：held 状态（inputRouting.mode=choice）下必带；
  // clear→清空 queue 后 startNow，keep→保留 queue 立即 startNow。
  sendText: z50.object({
    text: z50.string(),
    attachments: z50.array(attachmentRefSchema).optional(),
    // Desktop Cmd/Ctrl+Enter 只覆盖本次 busy input，不改 session followupMode。
    // startNow 由 CLI 原子抢占当前 turn，不经过 queue admission。
    requestedDelivery: z50.enum(["startNow", "queue", "guide"]).optional(),
    browserAmbientContext: zcodeBrowserAmbientContextSchema.optional(),
    // Share handover 只允许当前 session 的一个已导入上下文；完整正文由 runtime 从
    // 持久化 provenance 解析，不能随 command 从 renderer 传入。
    context_refs: z50.array(sharedContextRefSchema).max(1).optional(),
    heldQueueDisposition: z50.enum(["clearQueueAndSend", "keepQueueAndSend"]).optional(),
    // 暂停队列确认框打开时看到的 queueItemId 集合。CLI 在执行 clear/keep 前校验，
    // 防止桌面/手机并发增删后把用户没确认过的新队列一并处置。
    expectedHeldQueueItemIds: z50.array(z50.string().min(1)).optional(),
    // 迁移期允许旧发送端缺省；CLI admission 会把当前 Session Selection 固定进
    // canonical intent。Renderer 切换完成后，第一方用户提交始终显式携带这两项。
    modelSelection: modelSelectionSchema.optional(),
    mode: submissionModeSchema.optional(),
    planEnabled: z50.boolean().optional(),
    // 本次执行仍使用上面的标准 Selection；这里只携带不持久化语义、动态鉴权和 child 策略。
    // 仅 idle startNow 接受，防止 Secret/Ticket 进入普通 CommandInbox。
    modelExecution: modelExecutionSchema.optional(),
    automationId: z50.string().min(1).optional(),
    offPeakTaskId: z50.string().min(1).optional(),
    offPeakRunType: z50.enum(["init", "resume"]).optional(),
    // Bot 来源只由 Host 注入，用于 CronCreate 在当前 turn 内读取并持久化回推地址。
    botDeliveryTarget: zcodeAutomationBotDeliveryTargetSchema.optional(),
    // 定时任务会话的后续用户输入也必须保持 turn-scoped 工具面隔离；不能借用
    // automationId，否则会把普通用户输入误标成一次 automation 派发。
    toolDisallowlist: z50.array(z50.string().min(1)).optional()
  }).superRefine((payload, context) => {
    if (payload.automationId && payload.offPeakTaskId) {
      context.addIssue({
        code: z50.ZodIssueCode.custom,
        message: "automationId and offPeakTaskId are mutually exclusive"
      });
    }
    if (payload.offPeakRunType && !payload.offPeakTaskId) {
      context.addIssue({
        code: z50.ZodIssueCode.custom,
        message: "offPeakRunType requires offPeakTaskId",
        path: ["offPeakRunType"]
      });
    }
    if (payload.modelExecution && !payload.modelSelection) {
      context.addIssue({
        code: z50.ZodIssueCode.custom,
        message: "modelExecution requires modelSelection",
        path: ["modelExecution"]
      });
    }
  }),
  sendGoalCommand: z50.object({
    text: z50.string(),
    displayText: z50.string().optional(),
    modelSelection: modelSelectionSchema.optional(),
    mode: submissionModeSchema.optional(),
    planEnabled: z50.boolean().optional(),
    heldQueueDisposition: z50.enum(["clearQueueAndSend", "keepQueueAndSend"]).optional(),
    expectedHeldQueueItemIds: z50.array(z50.string().min(1)).optional()
  }),
  stop: z50.object({
    // 来自 activeWorks；CLI 用它拒绝会误杀后续无关执行的迟到 Stop。
    expectedForegroundExecutionId: z50.string().min(1).optional()
  }),
  // compact 是输入型维护命令：idle 时立即执行，busy/held 时进入 FIFO。
  // 因为 admission 与当前 revision 无关，不走 CAS；sourceCommandId 提供幂等边界。
  compact: z50.object({}),
  // running 时对稳定 assistant row 可用。
  forkAssistant: z50.object({ target: conversationRowTargetSchema }),
  applyFileRewind: z50.object({ target: conversationRowTargetSchema }),
  editUserQuery: z50.object({
    target: conversationRowTargetSchema,
    newText: z50.string(),
    attachments: z50.array(attachmentRefSchema).optional(),
    // 缺省 preserve：仅切 conversation branch；rewind 会先安全恢复该轮文件。
    workspaceMode: z50.enum(["preserve", "rewind"]).optional()
  }),
  retryTurn: z50.object({ target: conversationRowTargetSchema }),
  setAssistantFeedback: z50.object({
    target: conversationRowTargetSchema,
    feedback: z50.enum(["like", "dislike"]).nullable()
  }),
  sendQueuedNow: z50.object({ queueItemId: z50.string() }),
  editQueueItem: z50.object({ queueItemId: z50.string(), newText: z50.string() }),
  // beforeQueueItemId = null → 移到队尾。
  reorderQueueItem: z50.object({
    queueItemId: z50.string(),
    beforeQueueItemId: z50.string().nullable()
  }),
  deleteQueueItem: z50.object({ queueItemId: z50.string() }),
  setAutoDrain: z50.object({ autoDrain: z50.boolean() }),
  // 先到先得，晚到 noop（reasonCode=proto.alreadyResolved）。
  resolveInteraction: z50.object({
    interactionId: z50.string(),
    answer: z50.object({
      optionId: z50.string().optional(),
      freeText: z50.string().optional(),
      // （elicitation 回执收敛）：AskUserQuestion/plan-approval 的
      // 多题答案与注解无损承载。action 存在时 CLI broker 按 accept/decline/cancel
      // 精确映射（content 直传旧 userInput response 语义）；缺省沿用
      // optionId/freeText 兼容路径，旧客户端行为不变。
      action: z50.enum(["accept", "decline", "cancel"]).optional(),
      content: z50.record(z50.string(), z50.unknown()).optional()
    })
  }),
  respondWorkspaceHookReview: workspaceHookReviewCommandTargetSchema.extend({
    decision: workspaceHookReviewDecisionSchema
  }),
  toggleWorkspaceHookReviewItem: workspaceHookReviewCommandTargetSchema.extend({
    reviewItemId: z50.string().trim().min(1),
    enabled: z50.boolean()
  }),
  revokeWorkspaceHookTrust: z50.union([
    workspaceHookReviewCommandTargetSchema.extend({
      reviewItemIds: z50.array(z50.string().trim().min(1)).min(1)
    }),
    workspaceHookTrustRevokeTargetSchema
  ]),
  // 软门禁：按需开审核 flow,克隆 revoke non-flow target 但不带 hookDeclarationDigests。
  requestWorkspaceHookReview: requestWorkspaceHookReviewTargetSchema,
  // AskUserQuestion 首次有效操作永久暂停本次自动结束；重复/迟到调用为幂等 noop。
  snoozeInteractionAutoResolution: z50.object({
    interactionId: z50.string()
  }),
  switchModelConfig: z50.object({
    provider: z50.string(),
    model: z50.string(),
    thought: z50.string()
  }),
  // additive（冻结面按黄金测试背书演进）：agent 协作模式切换。
  // 值域 = core CollaborationMode 的可切换子集（auto 非用户可切，不进 UI 命令面）。
  switchCollaborationMode: z50.object({
    mode: z50.enum(["build", "edit", "plan", "yolo"])
  }),
  setFollowupMode: z50.object({ mode: z50.enum(["queue", "guide"]) }),
  pauseGoal: z50.object({}),
  resumeGoal: z50.object({}),
  cancelBackgroundWork: z50.object({ workId: z50.string() }),
  // cancel & resume：恢复一个已取消 / 被进程死亡
  // 打断的 dwf run。workId ≡ runId（与 cancelBackgroundWork 同一个身份等式）；`name` 可选，
  // 喂恢复后完成通知的主题（重启后原 CreateWorkflow 工具 input 不可得）。刻意不携
  // baseRevision：与 cancelBackgroundWork 同类（workflowRuns 面免 revision，假 CAS 失败
  // 只会误伤）。门在 CLI 侧（可恢复集 = cancelled ∪ failed+Interrupted），拒绝以
  // fault.command.workflowRunResumeRejected.<reason> 回 ACK。
  resumeWorkflowRun: z50.object({ workId: z50.string(), name: z50.string().optional() }),
  // startSavedWorkflow：中枢「运行」不再合成
  // 对话文案，直接请 agent 在新会话里启动已保存工作流。与 cancelBackgroundWork / resumeWorkflowRun
  // 同类：不携 baseRevision（workflowRuns 面免 revision，假 CAS 失败只会误伤）。name 由 agent 从
  // 解析结果填（不变式 6），命令不收 name 覆盖。
  // 拒绝以 fault.command.savedWorkflowStartRejected.<reason> 回 ACK（词表见下方
  // savedWorkflowStartRejectionReasonSchema）；能力缺席（无 dwf 端口）→ V4CapabilityUnsupportedError
  // （与 resumeWorkflowRun 同一条错误）。
  startSavedWorkflow: z50.object({
    name: z50.string().min(1),
    scope: z50.enum(["project", "global"]).optional(),
    args: z50.record(z50.string(), z50.unknown()).optional()
  }),
  // amendWorkflowRunSettings：run 卡 / 详情页的「配置」直接请 agent 以新设置修订 run，不经模型轮。载荷、结果与拒绝
  // 词表见 workflow-run-settings-command.ts；能力缺席 → V4CapabilityUnsupportedError。
  amendWorkflowRunSettings: amendWorkflowRunSettingsPayloadSchema,
  renameSession: z50.object({ title: z50.string() }),
  deleteSession: z50.object({}),
  discardSharedContext: z50.object({ contextId: z50.string().trim().min(1) }).strict()
};
var commandTypeSchema = z50.enum(
  Object.keys(commandPayloadSchemas)
);
var savedWorkflowStartRejectionReasonSchema = z50.enum([
  "invalid_name",
  "not_found",
  "invalid_args",
  "compile_failed",
  "session_busy",
  "start_failed"
]);
var COMMANDS_REQUIRING_BASE_REVISION = /* @__PURE__ */ new Set([
  "applyFileRewind",
  "forkAssistant",
  "editUserQuery",
  "retryTurn",
  "setAssistantFeedback",
  "sendQueuedNow",
  "editQueueItem",
  "reorderQueueItem",
  "deleteQueueItem",
  "setAutoDrain",
  "switchModelConfig",
  "switchCollaborationMode",
  "setFollowupMode",
  "pauseGoal",
  "resumeGoal"
]);
var ROW_TARGETING_COMMANDS = /* @__PURE__ */ new Set([
  "applyFileRewind",
  "forkAssistant",
  "editUserQuery",
  "retryTurn",
  "setAssistantFeedback"
]);
var commandEnvelopeSchema = z50.object({
  ttft: localTtftContextSchema.optional(),
  // uuid v7，客户端生成，重试不变。
  commandId: z50.string(),
  clientId: z50.string(),
  // createSession 时为 null。
  sessionId: z50.string().nullable(),
  baseRevision: z50.number().optional(),
  baseLogEpoch: z50.string().trim().min(1).optional(),
  type: commandTypeSchema,
  payload: z50.unknown(),
  // 客户端时钟，仅遥测；服务端不用于任何裁决。
  issuedAt: timestampSchema
});
function parseCommandEnvelope(value) {
  const envelope = commandEnvelopeSchema.safeParse(value);
  if (!envelope.success) return { ok: false, error: envelope.error };
  const payload = commandPayloadSchemas[envelope.data.type].safeParse(envelope.data.payload);
  if (!payload.success) return { ok: false, error: payload.error };
  if (COMMANDS_REQUIRING_BASE_REVISION.has(envelope.data.type) && envelope.data.baseRevision === void 0 || ROW_TARGETING_COMMANDS.has(envelope.data.type) && envelope.data.baseLogEpoch === void 0) {
    return {
      ok: false,
      error: new z50.ZodError([
        {
          code: "custom",
          path: [envelope.data.baseRevision === void 0 ? "baseRevision" : "baseLogEpoch"],
          message: "CAS commands require baseRevision and baseLogEpoch"
        }
      ])
    };
  }
  return {
    ok: true,
    envelope: { ...envelope.data, payload: payload.data }
  };
}
var commandResultSchema = z50.discriminatedUnion("type", [
  z50.object({
    type: z50.enum(["createSession", "createSelectionSideSession", "forkAssistant"]),
    sessionId: z50.string(),
    input: z50.object({
      delivery: z50.enum(["startNow", "queue", "guide"]),
      inputId: z50.string(),
      // Core admission ACK 不等待 TurnStarted；messageId 可能由后续事件补齐。
      messageId: z50.string().optional()
    }).optional()
  }),
  z50.object({
    type: z50.literal("resolveInteraction"),
    resolvedBy: z50.object({
      clientId: z50.string(),
      optionId: z50.string().optional()
    })
  }),
  z50.object({
    type: z50.literal("applyFileRewind"),
    applied: z50.boolean(),
    preview: v4ConversationFileRewindPreviewResultSchema,
    response: z50.string()
  }),
  z50.object({
    type: z50.literal("editUserQuery"),
    // fork 仅保留旧 ACK 解码兼容；新 editUserQuery 不再生成 child session。
    disposition: z50.enum(["rewind", "fork", "blocked"]),
    sessionId: z50.string().min(1),
    reasonCode: z50.string().min(1).optional(),
    preview: v4ConversationFileRewindPreviewResultSchema.optional()
  }),
  z50.object({
    // startSavedWorkflow accepted ACK：
    // runId 联接启动轮 run 卡状态 / 通知 / 侧板；toolCallId = launch-<uuid>，联接合成 CreateWorkflow 轮。
    type: z50.literal("startSavedWorkflow"),
    runId: z50.string().min(1),
    toolCallId: z50.string().min(1)
  }),
  amendWorkflowRunSettingsResultSchema,
  z50.object({
    // messageId 只在 TurnStarted 后作为旁路归因补齐；Core admission ACK 不等待
    // projection commit，不能把 messageId 作为输入 accepted 的必要条件。
    type: z50.literal("inputAccepted"),
    delivery: z50.enum(["startNow", "queue", "guide"]),
    inputId: z50.string(),
    messageId: z50.string().optional()
  }),
  z50.object({
    // restart discarded 过去只返回一个无差别 fault，renderer 无法区分
    // runtime-local queue 与仍需人工确认的 startNow。delivery 来自 session_input
    // 持久事实，不能由客户端按当前 UI phase 猜测。
    type: z50.literal("inputDisposition"),
    delivery: z50.enum(["startNow", "queue", "guide"])
  })
]);
var commandAckSchema = z50.object({
  /** 会话创建期采用的 App Memory 开关；旧发送端缺省表示未知。 */
  memoryEnabled: z50.boolean().optional(),
  ttftExcluded: z50.literal("capacity").optional(),
  commandId: z50.string(),
  // accepted 不承诺跨 CLI 进程存活；最终收口以权威数据（sourceCommandId）为准。
  status: z50.enum(["accepted", "rejected", "stale", "duplicate", "noop", "failed"]),
  // rejected/stale/noop/failed 必带；= guard id 或 fault code（命名空间）。
  reasonCode: z50.string().optional(),
  message: z50.string().optional(),
  revisionAtDecision: z50.number(),
  // duplicate 回放缓存结果；accepted 亦可即时带（fork）。
  result: commandResultSchema.optional()
});
var commandKeySchema = z50.object({
  // null 只属于全局/createSession 幂等桶；session 命令必须携带 sessionId。
  sessionId: z50.string().nullable(),
  commandId: z50.string().min(1)
}).strict();
var commandsQueryParamsSchema = z50.object({
  commands: z50.array(commandKeySchema).min(1).max(64),
  clock: z50.literal(true).optional()
}).strict().refine(
  (params) => !params.clock || params.commands.every((key) => key.sessionId === null),
  "clock probes cannot query session commands"
);
var commandQueryItemSchema = z50.object({
  key: commandKeySchema,
  result: z50.union([commandAckSchema, z50.literal("unknown")])
}).strict();
var commandsQueryResultSchema = z50.object({
  results: z50.array(commandQueryItemSchema).min(1).max(64),
  clock: localTtftClockSchema.optional()
}).strict();

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-runs-delta.ts
var WORKFLOW_RUN_KEYS = Object.keys(workflowRunSchema.shape);
var WORKFLOW_RUN_KEY_SET = new Set(WORKFLOW_RUN_KEYS);
var WORKFLOW_RUN_HEADER_KEYS = WORKFLOW_RUN_KEYS.filter(
  (key) => key !== "actors" && key !== "nodes"
);
var runShape = workflowRunSchema.shape;
var WORKFLOW_RUN_REQUIRED_HEADER_KEYS = WORKFLOW_RUN_HEADER_KEYS.filter((key) => !runShape[key].safeParse(void 0).success);
function workflowRunEntryKey(entry) {
  return `${entry.siteId}\0${entry.ordinal}`;
}
function canonicalWorkflowRun(run) {
  const source = run;
  const canonical = {};
  for (const key of WORKFLOW_RUN_KEYS) {
    const value = source[key];
    if (value !== void 0) canonical[key] = value;
  }
  for (const key of Object.keys(source)) {
    if (WORKFLOW_RUN_KEY_SET.has(key)) continue;
    const value = source[key];
    if (value !== void 0) canonical[key] = value;
  }
  return canonical;
}
function isCompleteWorkflowRunHeader(header) {
  if (typeof header !== "object" || header === null) return false;
  const record = header;
  return WORKFLOW_RUN_REQUIRED_HEADER_KEYS.every((key) => record[key] !== void 0);
}
function applyWorkflowRunUpdated(state, delta) {
  const runs = state?.runs ?? [];
  const revision = Math.max(state?.revision ?? 0, delta.revision);
  const index = runs.findIndex((run) => run.runId === delta.runId);
  if (index < 0) {
    if (!isCompleteWorkflowRunHeader(delta.run)) {
      return state !== void 0 && state.revision === revision ? state : { revision, runs };
    }
    const born = canonicalWorkflowRun({
      ...delta.run,
      actors: delta.actors === void 0 ? [] : [...delta.actors],
      nodes: delta.nodes === void 0 ? [] : [...delta.nodes]
    });
    return { revision, runs: [...runs, born] };
  }
  const existing = runs[index];
  const merged = { ...existing, ...delta.run };
  for (const key of delta.cleared ?? []) delete merged[key];
  const actors = removeWorkflowRunEntries(existing.actors, delta.removedActors);
  const nodes = removeWorkflowRunEntries(existing.nodes, delta.removedNodes);
  if (actors !== existing.actors) merged.actors = actors;
  if (nodes !== existing.nodes) merged.nodes = nodes;
  if (delta.actors !== void 0 && delta.actors.length > 0) {
    merged.actors = upsertWorkflowRunEntries(actors, delta.actors);
  }
  if (delta.nodes !== void 0 && delta.nodes.length > 0) {
    merged.nodes = upsertWorkflowRunEntries(nodes, delta.nodes);
  }
  const next = [...runs];
  next[index] = canonicalWorkflowRun(merged);
  return { revision, runs: next };
}
function applyWorkflowRunRemoved(state, delta) {
  const runs = state?.runs ?? [];
  const revision = Math.max(state?.revision ?? 0, delta.revision);
  const remaining = runs.filter((run) => run.runId !== delta.runId);
  if (remaining.length === runs.length) {
    return state !== void 0 && state.revision === revision ? state : { revision, runs };
  }
  return { revision, runs: remaining };
}
function removeWorkflowRunEntries(current, removed) {
  if (removed === void 0 || removed.length === 0) return current;
  const dropped = new Set(removed.map(workflowRunEntryKey));
  const next = current.filter((entry) => !dropped.has(workflowRunEntryKey(entry)));
  return next.length === current.length ? current : next;
}
function upsertWorkflowRunEntries(current, incoming) {
  const next = [...current];
  const indexByKey = /* @__PURE__ */ new Map();
  next.forEach((entry, index) => indexByKey.set(workflowRunEntryKey(entry), index));
  for (const entry of incoming) {
    const key = workflowRunEntryKey(entry);
    const index = indexByKey.get(key);
    if (index === void 0) {
      indexByKey.set(key, next.length);
      next.push(entry);
      continue;
    }
    next[index] = entry;
  }
  return next;
}

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/apply.ts
function appendToRow(row, path, append) {
  switch (path) {
    case "text":
      if (row.kind === "assistantText" || row.kind === "reasoning") {
        return { ...row, text: row.text + append };
      }
      return row;
    case "inputText":
      if (row.kind === "toolCall") {
        return { ...row, inputText: row.inputText + append };
      }
      return row;
    case "output.text":
      if (row.kind === "toolCall" && row.output) {
        return {
          ...row,
          output: { ...row.output, text: row.output.text + append }
        };
      }
      return row;
    case "summaryText":
      if (row.kind === "subagent") {
        return { ...row, summaryText: row.summaryText + append };
      }
      return row;
  }
}
function applyConversationDelta(snapshot, delta) {
  switch (delta.op) {
    case "row.appended":
      return {
        ...snapshot,
        rows: {
          ...snapshot.rows,
          window: [...snapshot.rows.window, delta.row],
          totalCount: snapshot.rows.totalCount + 1,
          firstRowId: snapshot.rows.firstRowId ?? delta.row.rowId
        }
      };
    case "row.upserted": {
      const index = snapshot.rows.window.findIndex((row) => row.rowId === delta.row.rowId);
      if (index === -1) return snapshot;
      const window = [...snapshot.rows.window];
      window[index] = delta.row;
      return { ...snapshot, rows: { ...snapshot.rows, window } };
    }
    case "row.removed": {
      const window = snapshot.rows.window.filter((row) => row.rowId < delta.fromRowId);
      const removed = snapshot.rows.window.length - window.length;
      const removesEntireActiveBranch = snapshot.rows.firstRowId !== null && delta.fromRowId <= snapshot.rows.firstRowId;
      return {
        ...snapshot,
        rows: {
          ...snapshot.rows,
          window,
          // rewind 首轮后 rowId 继续单调递增；若保留旧 firstRowId，UI 会把
          // 旧分支留下的 rowId 空洞误判成“加载更早”。全量和尾窗都必须在从首行
          // 开始裁剪时清空 active-branch 分页锚点与计数，下一次 append 再建立新首行。
          totalCount: removesEntireActiveBranch ? 0 : Math.max(0, snapshot.rows.totalCount - removed),
          firstRowId: removesEntireActiveBranch ? null : snapshot.rows.firstRowId
        }
      };
    }
    case "row.delta": {
      const index = snapshot.rows.window.findIndex((row) => row.rowId === delta.rowId);
      const target = snapshot.rows.window[index];
      if (index === -1 || target === void 0) return snapshot;
      const window = [...snapshot.rows.window];
      window[index] = appendToRow(target, delta.path, delta.append);
      return { ...snapshot, rows: { ...snapshot.rows, window } };
    }
    case "state.updated":
      return { ...snapshot, ...delta.patch };
    // workflowRuns 是唯一开了增量口子的状态键（delta.ts 的注释讲了为什么）。规则整份住在
    // workflow-runs-delta.ts：两个 twin 都只转调它，两边的语义因此没有走散的余地。
    case "workflowRun.updated":
      return {
        ...snapshot,
        workflowRuns: applyWorkflowRunUpdated(snapshot.workflowRuns, delta)
      };
    case "workflowRun.removed":
      return {
        ...snapshot,
        workflowRuns: applyWorkflowRunRemoved(snapshot.workflowRuns, delta)
      };
  }
}
function applyConversationDeltas(snapshot, deltas) {
  let current = snapshot;
  for (const delta of deltas) {
    current = applyConversationDelta(current, delta);
  }
  return current;
}

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/wire-codec.ts
var CHANNEL_EVENT_RESPONSE_TYPE = 204;
var SOCKET_PROTOCOL_HEADER_BYTES = 13;
function vqlByteLength(value) {
  let bytes = 1;
  for (let remaining = value >>> 7; remaining > 0; remaining >>>= 7) bytes += 1;
  return bytes;
}
function measureTopicNotificationEnvelopeBytes(wire) {
  const cliNdjsonBytes = utf8JsonByteLength({
    method: "v4/conversation/frame",
    params: wire
  }) + 1;
  const wireJsonBytes = utf8JsonByteLength(wire);
  const maxEventIdJsonBytes = String(Number.MAX_SAFE_INTEGER).length;
  const maxEventIdSerializedBytes = 1 + vqlByteLength(maxEventIdJsonBytes) + maxEventIdJsonBytes;
  const channelHeaderBytes = 1 + vqlByteLength(2) + 1 + vqlByteLength(CHANNEL_EVENT_RESPONSE_TYPE) + maxEventIdSerializedBytes;
  const channelPayloadBytes = channelHeaderBytes + 1 + vqlByteLength(wireJsonBytes) + wireJsonBytes;
  const channelSocketBytes = channelPayloadBytes + SOCKET_PROTOCOL_HEADER_BYTES;
  const dataBase64Bytes = 4 * Math.ceil(channelPayloadBytes / 3);
  const transportId = "x".repeat(PROTOCOL_V4_LIMITS.transportEnvelopeIdMaxChars);
  const mobileRelayFixedBytes = utf8JsonByteLength({
    type: "data",
    payload: {
      zcode_type: "rpc-frame",
      bridgeSessionId: transportId,
      bridgeGeneration: Number.MAX_SAFE_INTEGER,
      recoveryId: transportId,
      seq: Number.MAX_SAFE_INTEGER,
      dataBase64: ""
    },
    client_ts: Number.MAX_SAFE_INTEGER,
    server_ts: Number.MAX_SAFE_INTEGER
  });
  const mobileRelayBytes = mobileRelayFixedBytes + dataBase64Bytes;
  return {
    cliNdjsonBytes,
    channelSocketBytes,
    mobileRelayBytes,
    maxBytes: Math.max(cliNdjsonBytes, channelSocketBytes, mobileRelayBytes)
  };
}
function utf8JsonByteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
function encodeJson(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}
var TopicWireFrameEncodingError = class extends Error {
  constructor(reasonCode) {
    super(reasonCode);
    this.reasonCode = reasonCode;
    this.name = "TopicWireFrameEncodingError";
  }
};
function hardBound(value, maximum, name) {
  const resolved = value ?? maximum;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new TopicWireFrameEncodingError(`proto.invalidLimit.${name}`);
  }
  return Math.min(Math.floor(resolved), maximum);
}
function makeFragment(params) {
  return {
    wireVersion: V4_WIRE_PROTOCOL_VERSION,
    kind: "fragment",
    deliveryKind: params.options.deliveryKind,
    logicalFrameId: params.options.logicalFrameId,
    logicalFrameOrdinal: params.options.logicalFrameOrdinal,
    topic: params.options.topic,
    subscriptionId: params.options.subscriptionId,
    fragmentIndex: params.fragmentIndex,
    fragmentCount: params.fragmentCount,
    logicalBytes: params.logicalBytes,
    checksum: params.checksum,
    dataBase64: params.dataBase64
  };
}
function findFragmentByteBudget(params) {
  let low = 1;
  let high = Math.min(params.logicalBytes, params.maxPhysicalFrameBytes);
  let best = 0;
  const worstCount = params.logicalBytes;
  while (low <= high) {
    const candidate = Math.floor((low + high) / 2);
    const dataBase64 = "A".repeat(4 * Math.ceil(candidate / 3));
    const wire = makeFragment({
      options: params.options,
      fragmentIndex: Math.max(0, worstCount - 1),
      fragmentCount: worstCount,
      logicalBytes: params.logicalBytes,
      checksum: params.checksum,
      dataBase64
    });
    if (params.options.measurePhysicalFrameBytes(wire) <= params.maxPhysicalFrameBytes) {
      best = candidate;
      low = candidate + 1;
    } else {
      high = candidate - 1;
    }
  }
  return best;
}
function encodeTopicWireFrames(frame, options) {
  const maxPhysicalFrameBytes = hardBound(
    options.maxPhysicalFrameBytes,
    PROTOCOL_V4_LIMITS.maxFrameBytes,
    "maxPhysicalFrameBytes"
  );
  const maxAssemblyBytes = hardBound(
    options.maxAssemblyBytes,
    PROTOCOL_V4_LIMITS.logicalFrameAssemblyMaxBytes,
    "maxAssemblyBytes"
  );
  const logical = encodeJson(frame);
  if (logical.byteLength > maxAssemblyBytes) {
    throw new TopicWireFrameEncodingError("proto.frameAssemblyTooLarge");
  }
  const complete = {
    wireVersion: V4_WIRE_PROTOCOL_VERSION,
    kind: "complete",
    deliveryKind: options.deliveryKind,
    logicalFrameId: options.logicalFrameId,
    logicalFrameOrdinal: options.logicalFrameOrdinal,
    topic: options.topic,
    subscriptionId: options.subscriptionId,
    frame
  };
  if (options.measurePhysicalFrameBytes(complete) <= maxPhysicalFrameBytes) {
    return [complete];
  }
  const checksum = {
    algorithm: "crc32",
    value: crc32WireBytes(logical)
  };
  const chunkBytes = findFragmentByteBudget({
    options,
    logicalBytes: logical.byteLength,
    checksum,
    maxPhysicalFrameBytes
  });
  if (chunkBytes < 1) {
    throw new TopicWireFrameEncodingError("proto.frameEnvelopeTooLarge");
  }
  const fragmentCount = Math.ceil(logical.byteLength / chunkBytes);
  if (fragmentCount > PROTOCOL_V4_LIMITS.logicalFrameAssemblyMaxFragments) {
    throw new TopicWireFrameEncodingError("proto.frameFragmentCountExceeded");
  }
  const frames = [];
  for (let fragmentIndex = 0; fragmentIndex < fragmentCount; fragmentIndex += 1) {
    const start = fragmentIndex * chunkBytes;
    const end = Math.min(start + chunkBytes, logical.byteLength);
    const wire = makeFragment({
      options,
      fragmentIndex,
      fragmentCount,
      logicalBytes: logical.byteLength,
      checksum,
      dataBase64: encodeWireBytesBase64(logical.subarray(start, end))
    });
    if (options.measurePhysicalFrameBytes(wire) > maxPhysicalFrameBytes) {
      throw new TopicWireFrameEncodingError("proto.frameEnvelopeTooLarge");
    }
    frames.push(wire);
  }
  return frames;
}

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/wire-fault.ts
var WIRE_FAULT_INVALID_PAYLOAD = "proto.frameAssemblyInvalidPayload";

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/wire-assembler.ts
var COMPLETE_WIRE_KEYS = /* @__PURE__ */ new Set([
  "wireVersion",
  "kind",
  "deliveryKind",
  "logicalFrameId",
  "logicalFrameOrdinal",
  "topic",
  "subscriptionId",
  "frame"
]);
var FRAGMENT_WIRE_KEYS = /* @__PURE__ */ new Set([
  "wireVersion",
  "kind",
  "deliveryKind",
  "logicalFrameId",
  "logicalFrameOrdinal",
  "topic",
  "subscriptionId",
  "fragmentIndex",
  "fragmentCount",
  "logicalBytes",
  "checksum",
  "dataBase64"
]);
var CHECKSUM_KEYS = /* @__PURE__ */ new Set(["algorithm", "value"]);
function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}
function parseDeliveryKind(value) {
  return value === "initial" || value === "online" || value === "recovery" ? value : null;
}
function hasValidFragmentInner(wire) {
  if (!hasOnlyKeys(wire, FRAGMENT_WIRE_KEYS) || typeof wire.fragmentIndex !== "number" || typeof wire.fragmentCount !== "number" || typeof wire.logicalBytes !== "number" || typeof wire.dataBase64 !== "string" || typeof wire.checksum !== "object" || wire.checksum === null || Array.isArray(wire.checksum) || !hasOnlyKeys(wire.checksum, CHECKSUM_KEYS)) {
    return false;
  }
  const checksum = wire.checksum;
  return typeof checksum.algorithm === "string" && typeof checksum.value === "string";
}
function routeKey(topic, subscriptionId) {
  return `${topic}\0${subscriptionId}`;
}
function bytesEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
function frameMatchesEnvelope(frame, wire) {
  if (typeof frame !== "object" || frame === null) return false;
  const value = frame;
  return value.topic === wire.topic && value.subscriptionId === wire.subscriptionId;
}
function hardBound2(value, maximum, name) {
  const resolved = value ?? maximum;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
  return Math.min(Math.floor(resolved), maximum);
}
var TopicWireFrameAssembler = class {
  constructor(frameSchema, options = {}) {
    this.frameSchema = frameSchema;
    this.maxAssemblyBytes = hardBound2(
      options.maxAssemblyBytes,
      PROTOCOL_V4_LIMITS.logicalFrameAssemblyMaxBytes,
      "maxAssemblyBytes"
    );
    this.maxFragments = hardBound2(
      options.maxFragments,
      PROTOCOL_V4_LIMITS.logicalFrameAssemblyMaxFragments,
      "maxFragments"
    );
    this.maxConcurrentAssemblies = hardBound2(
      options.maxConcurrentAssemblies,
      PROTOCOL_V4_LIMITS.logicalFrameAssemblyMaxConcurrent,
      "maxConcurrentAssemblies"
    );
    this.maxStagedDecodedBytes = hardBound2(
      options.maxStagedDecodedBytes,
      PROTOCOL_V4_LIMITS.logicalFrameAssemblyMaxStagedBytes,
      "maxStagedDecodedBytes"
    );
    this.timeoutMs = hardBound2(
      options.timeoutMs,
      PROTOCOL_V4_LIMITS.logicalFrameAssemblyTimeoutMs,
      "timeoutMs"
    );
    this.maxPhysicalFrameBytes = hardBound2(
      options.maxPhysicalFrameBytes,
      PROTOCOL_V4_LIMITS.maxFrameBytes,
      "maxPhysicalFrameBytes"
    );
  }
  assemblies = /* @__PURE__ */ new Map();
  /** 每 route 的单调 ordinal tombstone；不会像 bounded id LRU 一样淘汰后复活旧帧。 */
  settledByRoute = /* @__PURE__ */ new Map();
  stagedDecodedBytes = 0;
  maxAssemblyBytes;
  maxFragments;
  maxConcurrentAssemblies;
  maxStagedDecodedBytes;
  timeoutMs;
  maxPhysicalFrameBytes;
  accept(wire, now = Date.now()) {
    const events = this.expire(now);
    const key = routeKey(wire.topic, wire.subscriptionId);
    if (!Number.isSafeInteger(wire.logicalFrameOrdinal) || wire.logicalFrameOrdinal < 1) {
      events.push(this.fault(wire, "proto.frameAssemblyMetadataMismatch"));
      return events;
    }
    const settled = this.settledByRoute.get(key);
    if (settled) {
      if (wire.logicalFrameOrdinal < settled.logicalFrameOrdinal) return events;
      if (wire.logicalFrameOrdinal === settled.logicalFrameOrdinal) {
        if (wire.logicalFrameId !== settled.logicalFrameId) {
          events.push(this.fault(wire, "proto.frameAssemblyOrdinalConflict"));
        }
        return events;
      }
    }
    const deliveryKind = parseDeliveryKind(wire.deliveryKind);
    if (deliveryKind === "recovery") {
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event?.kind === "fault" && event.fault.topic === wire.topic && event.fault.subscriptionId === wire.subscriptionId && event.fault.logicalFrameOrdinal < wire.logicalFrameOrdinal) {
          events.splice(index, 1);
        }
      }
    }
    const current = this.assemblies.get(key);
    if (current) {
      if (wire.logicalFrameOrdinal < current.logicalFrameOrdinal) return events;
      if (wire.logicalFrameOrdinal === current.logicalFrameOrdinal) {
        if (wire.logicalFrameId !== current.logicalFrameId) {
          this.release(key, current);
          this.settle(key, current);
          events.push(this.fault(wire, "proto.frameAssemblyOrdinalConflict"));
          return events;
        }
      } else {
        this.release(key, current);
        this.settle(key, current);
        if (deliveryKind !== "recovery") {
          events.push(this.fault(current, "proto.frameAssemblySuperseded"));
        }
      }
    }
    if (deliveryKind === null) {
      this.releaseAndSettle(key, wire);
      events.push(this.fault(wire, "proto.frameAssemblyMetadataMismatch"));
      return events;
    }
    if (wire.kind === "complete") {
      if (!hasOnlyKeys(wire, COMPLETE_WIRE_KEYS) || !Object.prototype.hasOwnProperty.call(wire, "frame")) {
        this.releaseAndSettle(key, wire);
        events.push(this.fault(wire, "proto.frameAssemblyMetadataMismatch"));
        return events;
      }
      if (measureTopicNotificationEnvelopeBytes(wire).maxBytes > this.maxPhysicalFrameBytes) {
        this.releaseAndSettle(key, wire);
        events.push(this.fault(wire, "proto.frameEnvelopeTooLarge"));
        return events;
      }
      const active = this.assemblies.get(key);
      if (active) {
        this.release(key, active);
        this.settle(key, active);
        events.push(this.fault(active, "proto.frameAssemblyMetadataMismatch"));
        return events;
      }
      const logicalBytes = new TextEncoder().encode(JSON.stringify(wire.frame)).byteLength;
      if (logicalBytes > this.maxAssemblyBytes) {
        this.settle(key, wire);
        events.push(this.fault(wire, "proto.frameAssemblyTooLarge"));
        return events;
      }
      if (!frameMatchesEnvelope(wire.frame, wire)) {
        this.settle(key, wire);
        events.push(this.fault(wire, "proto.frameAssemblyMetadataMismatch"));
        return events;
      }
      const parsed2 = this.frameSchema.safeParse(wire.frame);
      if (!parsed2.success) {
        this.settle(key, wire);
        events.push(this.fault(wire, WIRE_FAULT_INVALID_PAYLOAD));
        return events;
      }
      this.settle(key, wire);
      events.push({ kind: "complete", frame: parsed2.data, deliveryKind });
      return events;
    }
    if (!hasValidFragmentInner(wire)) {
      this.releaseAndSettle(key, wire);
      events.push(this.fault(wire, "proto.frameAssemblyMetadataMismatch"));
      return events;
    }
    if (measureTopicNotificationEnvelopeBytes(wire).maxBytes > this.maxPhysicalFrameBytes) {
      this.releaseAndSettle(key, wire);
      events.push(this.fault(wire, "proto.frameEnvelopeTooLarge"));
      return events;
    }
    if (wire.fragmentCount > this.maxFragments) {
      this.releaseAndSettle(key, wire);
      events.push(this.fault(wire, "proto.frameFragmentCountExceeded"));
      return events;
    }
    if (wire.logicalBytes > this.maxAssemblyBytes) {
      this.releaseAndSettle(key, wire);
      events.push(this.fault(wire, "proto.frameAssemblyTooLarge"));
      return events;
    }
    if (!Number.isInteger(wire.fragmentCount) || wire.fragmentCount < 1 || !Number.isInteger(wire.fragmentIndex) || wire.fragmentIndex < 0 || wire.fragmentIndex >= wire.fragmentCount || !Number.isInteger(wire.logicalBytes) || wire.logicalBytes < 1 || wire.fragmentCount > wire.logicalBytes || wire.checksum.algorithm !== "crc32" || !/^[0-9a-f]{8}$/u.test(wire.checksum.value)) {
      this.releaseAndSettle(key, wire);
      events.push(this.fault(wire, "proto.frameAssemblyMetadataMismatch"));
      return events;
    }
    const decoded = decodeWireBase64(wire.dataBase64);
    if (!decoded) {
      this.releaseAndSettle(key, wire);
      events.push(this.fault(wire, "proto.frameAssemblyInvalidBase64"));
      return events;
    }
    let assembly = this.assemblies.get(key);
    if (assembly) {
      if (assembly.fragmentCount !== wire.fragmentCount || assembly.deliveryKind !== deliveryKind || assembly.logicalBytes !== wire.logicalBytes || assembly.checksum.algorithm !== wire.checksum.algorithm || assembly.checksum.value !== wire.checksum.value) {
        this.release(key, assembly);
        this.settle(key, assembly);
        events.push(this.fault(wire, "proto.frameAssemblyMetadataMismatch"));
        return events;
      }
    } else {
      if (this.assemblies.size >= this.maxConcurrentAssemblies) {
        this.settle(key, wire);
        events.push(this.fault(wire, "proto.frameAssemblyConcurrentLimit"));
        return events;
      }
      if (this.stagedDecodedBytes + decoded.byteLength > this.maxStagedDecodedBytes) {
        this.settle(key, wire);
        events.push(this.fault(wire, "proto.frameAssemblyBudgetExceeded"));
        return events;
      }
      assembly = {
        deliveryKind,
        logicalFrameId: wire.logicalFrameId,
        logicalFrameOrdinal: wire.logicalFrameOrdinal,
        topic: wire.topic,
        subscriptionId: wire.subscriptionId,
        fragmentCount: wire.fragmentCount,
        logicalBytes: wire.logicalBytes,
        checksum: { algorithm: "crc32", value: wire.checksum.value },
        fragments: Array.from(
          { length: wire.fragmentCount },
          () => void 0
        ),
        receivedCount: 0,
        decodedBytes: 0,
        firstSeenAt: now
      };
      this.assemblies.set(key, assembly);
    }
    const previous = assembly.fragments[wire.fragmentIndex];
    if (previous) {
      if (!bytesEqual(previous, decoded)) {
        this.release(key, assembly);
        this.settle(key, assembly);
        events.push(this.fault(wire, "proto.frameAssemblyFragmentConflict"));
      }
      return events;
    }
    if (this.stagedDecodedBytes + decoded.byteLength > this.maxStagedDecodedBytes) {
      this.release(key, assembly);
      this.settle(key, assembly);
      events.push(this.fault(wire, "proto.frameAssemblyBudgetExceeded"));
      return events;
    }
    if (assembly.decodedBytes + decoded.byteLength > assembly.logicalBytes) {
      this.release(key, assembly);
      this.settle(key, assembly);
      events.push(this.fault(wire, "proto.frameAssemblyLengthMismatch"));
      return events;
    }
    assembly.fragments[wire.fragmentIndex] = decoded;
    assembly.receivedCount += 1;
    assembly.decodedBytes += decoded.byteLength;
    this.stagedDecodedBytes += decoded.byteLength;
    if (assembly.receivedCount !== assembly.fragmentCount) return events;
    this.release(key, assembly);
    if (assembly.decodedBytes !== assembly.logicalBytes) {
      this.settle(key, assembly);
      events.push(this.fault(assembly, "proto.frameAssemblyLengthMismatch"));
      return events;
    }
    const logical = new Uint8Array(assembly.decodedBytes);
    let offset = 0;
    for (const fragment of assembly.fragments) {
      if (!fragment) {
        this.settle(key, assembly);
        events.push(this.fault(assembly, "proto.frameAssemblyLengthMismatch"));
        return events;
      }
      logical.set(fragment, offset);
      offset += fragment.byteLength;
    }
    if (crc32WireBytes(logical) !== assembly.checksum.value) {
      this.settle(key, assembly);
      events.push(this.fault(assembly, "proto.frameAssemblyChecksumMismatch"));
      return events;
    }
    let json;
    try {
      json = new TextDecoder("utf-8", { fatal: true }).decode(logical);
    } catch {
      this.settle(key, assembly);
      events.push(this.fault(assembly, "proto.frameAssemblyInvalidUtf8"));
      return events;
    }
    let value;
    try {
      value = JSON.parse(json);
    } catch {
      this.settle(key, assembly);
      events.push(this.fault(assembly, "proto.frameAssemblyInvalidJson"));
      return events;
    }
    if (!frameMatchesEnvelope(value, assembly)) {
      this.settle(key, assembly);
      events.push(this.fault(assembly, "proto.frameAssemblyMetadataMismatch"));
      return events;
    }
    const parsed = this.frameSchema.safeParse(value);
    if (!parsed.success) {
      this.settle(key, assembly);
      events.push(this.fault(assembly, WIRE_FAULT_INVALID_PAYLOAD));
      return events;
    }
    this.settle(key, assembly);
    events.push({ kind: "complete", frame: parsed.data, deliveryKind: assembly.deliveryKind });
    return events;
  }
  expire(now = Date.now()) {
    const events = [];
    for (const [key, assembly] of this.assemblies) {
      if (now - assembly.firstSeenAt < this.timeoutMs) continue;
      this.release(key, assembly);
      this.settle(key, assembly);
      events.push(this.fault(assembly, "proto.frameAssemblyTimedOut"));
    }
    return events;
  }
  discard(topic, subscriptionId) {
    const key = routeKey(topic, subscriptionId);
    const assembly = this.assemblies.get(key);
    if (assembly) this.release(key, assembly);
    this.settledByRoute.delete(key);
  }
  /** fault 后释放该 route 的 active bytes，但保留 ordinal tombstone 防旧 replay 复活。 */
  abort(topic, subscriptionId) {
    const key = routeKey(topic, subscriptionId);
    const assembly = this.assemblies.get(key);
    if (!assembly) return;
    this.release(key, assembly);
    this.settle(key, assembly);
  }
  clear() {
    this.assemblies.clear();
    this.settledByRoute.clear();
    this.stagedDecodedBytes = 0;
  }
  getStats() {
    return { assemblies: this.assemblies.size, stagedDecodedBytes: this.stagedDecodedBytes };
  }
  get nextExpiryAt() {
    let next = null;
    for (const assembly of this.assemblies.values()) {
      const expiresAt = assembly.firstSeenAt + this.timeoutMs;
      if (next === null || expiresAt < next) next = expiresAt;
    }
    return next;
  }
  release(key, assembly) {
    if (this.assemblies.get(key) !== assembly) return;
    this.assemblies.delete(key);
    this.stagedDecodedBytes -= assembly.decodedBytes;
  }
  settle(key, frame) {
    const previous = this.settledByRoute.get(key);
    if (previous && previous.logicalFrameOrdinal > frame.logicalFrameOrdinal) return;
    this.settledByRoute.set(key, {
      logicalFrameId: frame.logicalFrameId,
      logicalFrameOrdinal: frame.logicalFrameOrdinal
    });
  }
  releaseAndSettle(key, frame) {
    const active = this.assemblies.get(key);
    if (active && active.logicalFrameOrdinal === frame.logicalFrameOrdinal && active.logicalFrameId === frame.logicalFrameId) {
      this.release(key, active);
    }
    this.settle(key, frame);
  }
  fault(source, reasonCode) {
    const deliveryKind = parseDeliveryKind(source.deliveryKind);
    return {
      kind: "fault",
      fault: {
        ...deliveryKind === null ? {} : { deliveryKind },
        reasonCode,
        logicalFrameId: source.logicalFrameId,
        logicalFrameOrdinal: source.logicalFrameOrdinal,
        topic: source.topic,
        subscriptionId: source.subscriptionId
      }
    };
  }
};

// ../reference/ZCode/packages/shared/src/zcode-protocol/index.ts
import { z as z51 } from "zod";
var ZCODE_PROTOCOL_NAME2 = "ZCode Protocol";
var ZCODE_PROTOCOL_VERSION2 = 1;
var zcodeRuntimeCapabilitiesSchema2 = z51.object({
  independentPlanState: z51.boolean().optional()
});
var nonEmptyString4 = z51.string().trim().min(1);
var jsonObjectSchema3 = z51.record(z51.string(), z51.unknown());
var timestampMsSchema3 = z51.number().int().nonnegative();
var protocolInstantSchema2 = z51.union([timestampMsSchema3, nonEmptyString4, z51.date()]);
var zcodeNodeReplImageToolResultDisplaySchema2 = z51.object({
  kind: z51.literal("node_repl_images"),
  images: z51.array(
    z51.object({
      base64: z51.string().min(1).max(200 * 1024),
      mimeType: z51.string().regex(/^image\/[a-z0-9.+-]+$/iu)
    }).strict()
  ).min(1).max(2),
  truncated: z51.boolean().optional(),
  source: z51.literal("browser_turn_end").optional()
}).strict();
var zcodeWorkflowNamePatternSchema2 = z51.object({
  head: z51.string().min(1).max(128).optional(),
  tail: z51.string().min(1).max(128).optional()
}).strict();
var zcodeWorkflowEdgeSchema2 = z51.object({
  from: z51.string().min(1).max(64),
  to: z51.string().min(1).max(64),
  back: z51.literal(true).optional()
}).strict();
var zcodeCreateWorkflowCausalityGraphDisplaySchema2 = z51.object({
  steps: z51.array(
    z51.object({
      id: z51.string().min(1).max(64),
      kind: z51.enum(["ask", "world-read"]),
      label: z51.string().min(1).max(128),
      // 内联 `agent()` receiver 让 label 落到兜底串时，那个名字的静态形状。
      labelPattern: zcodeWorkflowNamePatternSchema2.optional(),
      line: z51.number().int().positive().optional(),
      column: z51.number().int().positive().optional(),
      lane: z51.string().min(1).max(64),
      lanes: z51.array(z51.string().min(1).max(64)).max(32).optional(),
      // 展开自的站点 id，只出现在 may-set 车道展开的拷贝上（实时叠加的关联键）；
      // 加字段是 additive 的，不带它的旧载荷照常通过 .strict()。
      source: z51.string().min(1).max(64).optional(),
      // 作者用 `phase("…")` 标记划入的阶段。
      // 与图的 phases / phaseEdges / exits 同进同退：全在场或全缺席。
      phase: z51.string().min(1).max(64).optional(),
      repeat: z51.enum(["stack", "serial"]).optional()
    }).strict()
  ).max(64),
  lanes: z51.array(
    z51.object({
      id: z51.string().min(1).max(64),
      name: z51.string().min(1).max(128).optional(),
      // `name` 缺席而 agent() 首参是带洞的模板串时的静态形状；与 name 互斥。
      namePattern: zcodeWorkflowNamePatternSchema2.optional(),
      line: z51.number().int().positive().optional(),
      column: z51.number().int().positive().optional()
    }).strict()
  ).max(32),
  // 参与者与交接；镜像 v4。
  participants: z51.array(
    z51.object({
      id: z51.string().min(1).max(64),
      phase: z51.string().min(1).max(64),
      lane: z51.string().min(1).max(64),
      steps: z51.array(z51.string().min(1).max(64)).min(1).max(64),
      member: z51.object({ index: z51.number().int().nonnegative(), of: z51.number().int().positive() }).strict().optional(),
      many: z51.literal(true).optional()
    }).strict()
  ).max(64),
  handoffs: z51.array(
    zcodeWorkflowEdgeSchema2.extend({ types: z51.array(z51.string().min(1).max(128)).min(1).max(8).optional() }).strict()
  ).max(256),
  // 阶段词汇表：作者施加的分组结构，主画面以它为节点。与 phaseEdges / exits / Step.phase
  // 全有或全无——零标记脚本全缺席，UI 据此退回 step/车道视图。零成员阶段也在表里。
  // `unphased` 无 name，显示名由 UI 本地化。
  phases: z51.array(
    z51.object({
      id: z51.string().min(1).max(64),
      name: z51.string().min(1).max(128).optional(),
      line: z51.number().int().positive().optional(),
      column: z51.number().int().positive().optional(),
      // 进入本阶段时还在跑的其他阶段（它们的 strand 尚未 join），阶段表序，不含自己，
      // 为空时缺席。是节点事实而不是边——控制没有从那里转移过来，所以不进 phaseEdges。
      // 时间轴据此把相邻阶段折成一条分叉的「带」，侧栏迷你轨道画成双线段。
      alongside: z51.array(z51.string().min(1).max(64)).min(1).max(32).optional()
    }).strict()
  ).max(32).optional(),
  phaseEdges: z51.array(zcodeWorkflowEdgeSchema2).max(128).optional(),
  // 控制流可在其后正常完成的阶段（阶段视图的「阶段 → 返回物」箭头）；组内可为空数组。
  exits: z51.array(z51.string().min(1).max(64)).max(32).optional(),
  sink: z51.array(z51.string().min(1).max(64)).max(64).optional(),
  truncated: z51.boolean().optional()
}).strict();
var zcodeCreateWorkflowToolResultDisplaySchema2 = z51.object({
  kind: z51.literal("create_workflow"),
  ok: z51.boolean(),
  errorCount: z51.number().int().nonnegative(),
  diagnostics: z51.array(
    z51.object({
      line: z51.number().int().nonnegative(),
      column: z51.number().int().nonnegative(),
      code: z51.number().int().nonnegative(),
      message: z51.string().min(1).max(2048)
    }).strict()
  ).max(100),
  causalityGraph: zcodeCreateWorkflowCausalityGraphDisplaySchema2.optional(),
  truncated: z51.boolean().optional()
}).strict();
var zcodeToolResultObjectSchema2 = jsonObjectSchema3.superRefine((result, context) => {
  const display = result.display;
  if (typeof display !== "object" || display === null || Array.isArray(display)) {
    return;
  }
  const kind = display.kind;
  const schemaByKind = {
    node_repl_images: zcodeNodeReplImageToolResultDisplaySchema2,
    create_workflow: zcodeCreateWorkflowToolResultDisplaySchema2,
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
var zcodeProtocolRequestIdSchema2 = z51.union([z51.string(), z51.number().int()]);
var zcodeProtocolTraceSchema2 = z51.object({
  traceparent: nonEmptyString4.optional(),
  traceId: nonEmptyString4.optional(),
  parentId: nonEmptyString4.optional(),
  spanId: nonEmptyString4.optional()
}).strict();
var zcodeProtocolRequestSchema2 = z51.object({
  id: zcodeProtocolRequestIdSchema2,
  method: nonEmptyString4,
  params: z51.unknown().optional(),
  trace: zcodeProtocolTraceSchema2.optional()
}).strict();
var zcodeProtocolNotificationSchema2 = z51.object({
  method: nonEmptyString4,
  params: z51.unknown().optional(),
  trace: zcodeProtocolTraceSchema2.optional()
}).strict();
var zcodeProtocolResponseSchema2 = z51.object({
  id: zcodeProtocolRequestIdSchema2,
  result: z51.unknown()
}).strict();
var zcodeProtocolErrorSchema2 = z51.object({
  id: zcodeProtocolRequestIdSchema2,
  error: z51.object({
    code: z51.number().int(),
    message: nonEmptyString4,
    data: z51.unknown().optional()
  }).strict()
}).strict();
var zcodeProtocolMessageSchema2 = z51.union([
  zcodeProtocolRequestSchema2,
  zcodeProtocolNotificationSchema2,
  zcodeProtocolResponseSchema2,
  zcodeProtocolErrorSchema2
]);
var zcodeStorageStartupStateSchema2 = z51.object({
  schemaVersion: z51.literal(1),
  attemptId: z51.string().min(1).max(128),
  sequence: z51.number().int().positive(),
  databaseId: z51.string().min(1).max(128),
  databaseKind: z51.enum(["session", "tasks-index"]),
  phase: z51.enum(["checking", "waiting_for_lock", "migrating", "committing", "ready", "failed"]),
  // 包含锁内、版本 SQL 之前的可选 lastAppliedMigrationId；旧通知仍可解析。
  migration: databaseMigrationFactsSchema.optional(),
  elapsedMs: z51.number().nonnegative().finite(),
  completed: z51.number().int().nonnegative().optional(),
  total: z51.number().int().nonnegative().optional(),
  errorCode: databaseStartupErrorCodeSchema.optional(),
  ...databaseStartupErrorDetailsSchema.shape
}).strict().superRefine((state, context) => {
  if (state.phase === "failed" && !state.errorCode)
    context.addIssue({ code: "custom", message: "failed requires errorCode" });
});
var zcodeMcpTelemetryPlatformSchema2 = z51.enum([
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
var zcodeMcpTelemetryArchSchema2 = z51.enum([
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
var zcodeMcpTelemetryBaseSchema2 = z51.object({
  arch: zcodeMcpTelemetryArchSchema2,
  occurredAt: z51.number().int().nonnegative(),
  platform: zcodeMcpTelemetryPlatformSchema2
}).strict();
var zcodeMcpProcessTelemetryBaseShape2 = {
  mcpId: z51.string().regex(
    /^(?:builtin:(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+(?::(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+)*|(?:plugin|custom):[a-f0-9]{12})$/
  ),
  mcpInstanceId: nonEmptyString4,
  mcpIsolation: z51.enum(["session", "workspace"]),
  mcpSource: z51.enum(["builtin", "plugin", "custom"])
};
var zcodeMcpTelemetryEventSchema2 = z51.discriminatedUnion("kind", [
  zcodeMcpTelemetryBaseSchema2.extend({
    kind: z51.literal("process_start"),
    ...zcodeMcpProcessTelemetryBaseShape2
  }).strict(),
  zcodeMcpTelemetryBaseSchema2.extend({
    kind: z51.literal("process_crash"),
    ...zcodeMcpProcessTelemetryBaseShape2,
    affectedSessionCount: z51.number().int().nonnegative().max(1e4),
    exitCode: z51.number().int().nullable(),
    signal: nonEmptyString4.nullable(),
    uptimeMs: z51.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
  }).strict(),
  zcodeMcpTelemetryBaseSchema2.extend({
    kind: z51.literal("session_startup"),
    configuredCount: z51.number().int().nonnegative().max(1e4),
    connectedCount: z51.number().int().nonnegative().max(1e4),
    failedCount: z51.number().int().nonnegative().max(1e4),
    processCount: z51.number().int().nonnegative().max(1e4),
    sessionId: nonEmptyString4
  }).strict(),
  zcodeMcpTelemetryBaseSchema2.extend({
    kind: z51.literal("memory"),
    ...zcodeMcpProcessTelemetryBaseShape2,
    memoryKb: z51.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
    memoryScope: z51.enum(["process_tree", "direct_process"]),
    orphanSuspected: z51.boolean(),
    ownerSessionCount: z51.number().int().nonnegative().max(1e4),
    unownedSeconds: z51.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
  }).strict()
]);
var ZCODE_MCP_RESOURCE_SAMPLE_INTERVAL_MS2 = 5 * 6e4;
var zcodeMcpResourceSampleSchema2 = z51.object({
  mcpId: zcodeMcpProcessTelemetryBaseShape2.mcpId,
  instanceToken: z51.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  sampledAt: z51.number().int().nonnegative(),
  intervalMs: z51.number().finite().positive(),
  processCount: z51.number().int().positive().max(1e5),
  rssKbTotal: z51.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  rssKbMaxProcess: z51.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  cpuTimeMsDelta: z51.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  uptimeMinutes: z51.number().int().nonnegative(),
  platform: zcodeMcpTelemetryPlatformSchema2,
  arch: zcodeMcpTelemetryArchSchema2,
  logicalCpuCount: z51.number().int().positive().max(4096),
  totalMemoryGb: z51.number().int().nonnegative().max(1048576)
}).strict();
var zcodeMcpResourceSamplesSchema2 = z51.array(zcodeMcpResourceSampleSchema2).max(1024);
var BASH_RESOURCE_SAMPLE_INTERVAL_MS2 = 15e3;
var BASH_RESOURCE_MAX_SAMPLES2 = 20;
var zcodeToolExecResourceSchema2 = z51.object({
  // 同一完成事实可能经多个 Host 转发；随机标识仅供 main 去重，旧 CLI 缺字段仍兼容。
  completionToken: z51.string().uuid().optional(),
  platform: zcodeMcpTelemetryPlatformSchema2,
  toolName: z51.literal("bash"),
  durationMs: z51.number().finite().min(BASH_RESOURCE_SAMPLE_INTERVAL_MS2),
  exitKind: z51.enum(["completed", "timeout", "killed", "error"]),
  treeRssKbPeak: z51.number().finite().nonnegative().optional(),
  treeCpuTimeMs: z51.number().finite().nonnegative().optional(),
  sampleCount: z51.number().int().nonnegative().max(BASH_RESOURCE_MAX_SAMPLES2),
  cliRssKb: z51.number().finite().nonnegative(),
  systemFreeMemoryKb: z51.number().finite().nonnegative()
}).strict();
var zcodeProcessResourceSampleSchema2 = z51.object({
  platform: z51.enum([
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
  arch: z51.enum([
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
  logicalCpuCount: z51.number().int().positive().max(4096),
  intervalMs: z51.number().int().positive().max(7 * 24 * 60 * 60 * 1e3),
  cpuCores: z51.number().finite().nonnegative().max(4096),
  cpuPercent: z51.number().finite().nonnegative().max(1e5),
  rssKb: z51.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  /**
   * 以下四项为遥测新增字段，全部可选：旧 CLI 发来的样本仍能通过校验，因此
   * **不递增协议握手版本号**（握手版本是兼容性开关，不是字段版本）。
   */
  heapUsedKb: z51.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  uptimeMinutes: z51.number().int().nonnegative().max(10 * 365 * 24 * 60).optional(),
  totalMemoryGb: z51.number().int().nonnegative().max(1048576).optional(),
  /**
   * CLI 进程启动时随机生成的实例标识，仅供 app 侧 main 统计「同时存活几个 CLI 进程」
   * 与「最大单进程 RSS」。不进 ARMS 属性、不含 pid。收紧字符集是隐私红线的机械保障：
   * 路径、workspace 标识这类内容不可能通过校验。
   */
  instanceToken: z51.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional()
}).strict();
var zcodeProcessChildProcessesParamsSchema2 = z51.object({}).strict();
var zcodeProcessChildProcessSchema2 = z51.object({
  pid: z51.number().int().positive(),
  serverName: nonEmptyString4,
  mcpSource: z51.enum(["builtin", "plugin", "custom"]),
  /** 官方/第三方插件的插件名（`plugin:<name>:<key>` 的 name，或官方 host MCP 对应插件）；custom 无 */
  pluginName: nonEmptyString4.optional()
}).strict();
var zcodeProcessChildProcessesResultSchema2 = z51.object({
  processes: z51.array(zcodeProcessChildProcessSchema2).max(1e4)
}).strict();
var zcodeTurnInputSourceSchema2 = zcodeSyntheticUserMessageSourceSchema;
var zcodeSessionPersistenceSchema2 = z51.enum(["immediate", "deferred"]);
var zcodePermissionOptionSchema2 = z51.object({
  optionId: nonEmptyString4,
  kind: nonEmptyString4,
  name: nonEmptyString4,
  description: z51.string().optional(),
  response: zcodePermissionResponseSchema
}).strict();
var zcodeProtocolMcpEntrySchema2 = z51.object({
  name: nonEmptyString4,
  value: z51.string()
}).strict();
var zcodeProtocolMcpOAuthSchema2 = z51.union([
  z51.object({
    type: z51.literal("client_credentials"),
    clientId: nonEmptyString4,
    clientSecret: nonEmptyString4,
    clientName: nonEmptyString4.optional(),
    scope: z51.string().optional()
  }).strict(),
  z51.object({
    type: z51.literal("authorization_code"),
    clientId: nonEmptyString4.optional(),
    clientSecret: nonEmptyString4.optional(),
    clientName: nonEmptyString4.optional(),
    redirectPath: nonEmptyString4.optional(),
    scope: z51.string().optional()
  }).strict()
]);
var zcodeProtocolMcpServerSchema2 = z51.union([
  z51.object({
    name: nonEmptyString4,
    command: nonEmptyString4,
    args: z51.array(z51.string()),
    env: z51.array(zcodeProtocolMcpEntrySchema2),
    isolation: z51.enum(["session", "workspace"]).optional(),
    protocolVersion: z51.enum(["legacy", "auto", "2026-07-28"]).optional(),
    timeoutMs: z51.number().int().positive().optional()
  }).strict(),
  z51.object({
    name: nonEmptyString4,
    type: z51.enum(["http", "sse"]),
    url: nonEmptyString4,
    headers: z51.array(zcodeProtocolMcpEntrySchema2),
    oauth: zcodeProtocolMcpOAuthSchema2.optional(),
    isolation: z51.enum(["session", "workspace"]).optional(),
    protocolVersion: z51.enum(["legacy", "auto", "2026-07-28"]).optional(),
    timeoutMs: z51.number().int().positive().optional()
  }).strict()
]);
var zcodeMcpServerStatusKindSchema2 = z51.enum([
  "connecting",
  "connected",
  "disabled",
  "disconnected",
  "failed",
  "untrusted"
]);
var MCP_SERVER_FAILURE_KINDS2 = [
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
var mcpServerFailureKindSchema2 = z51.enum(MCP_SERVER_FAILURE_KINDS2);
var zcodeMcpServerStatusSnapshotSchema2 = z51.object({
  status: zcodeMcpServerStatusKindSchema2,
  transport: z51.enum(["stdio", "http", "sse"]),
  toolCount: z51.number().int().nonnegative(),
  updatedAt: nonEmptyString4,
  error: z51.string().optional(),
  failureKind: mcpServerFailureKindSchema2.optional(),
  serverRequestId: nonEmptyString4.optional(),
  protocolEra: z51.enum(["legacy", "modern"]).optional(),
  authorization: z51.object({
    type: z51.literal("oauth_authorization_code"),
    authorizationUrl: nonEmptyString4,
    startedAt: nonEmptyString4
  }).strict().optional()
}).strict();
var zcodeMcpListModeSchema2 = z51.enum(["connect", "status"]);
var zcodeMcpListParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  mcpServers: z51.array(zcodeProtocolMcpServerSchema2).optional(),
  mode: zcodeMcpListModeSchema2.default("connect")
}).strict();
var zcodeMcpListResultSchema2 = z51.object({
  statuses: z51.record(z51.string(), zcodeMcpServerStatusSnapshotSchema2)
}).strict();
var zcodeSessionImportMessageSchema2 = z51.object({
  role: z51.enum(["user", "assistant"]),
  content: z51.string(),
  timestamp: timestampMsSchema3.optional()
}).strict();
var zcodeSessionImportHistorySchema2 = z51.discriminatedUnion("source", [
  z51.object({
    source: z51.literal("claudeCode"),
    title: z51.string().optional(),
    createdAt: timestampMsSchema3.optional(),
    updatedAt: timestampMsSchema3.optional(),
    messages: z51.array(zcodeSessionImportMessageSchema2).min(1)
  }).strict(),
  z51.object({
    source: z51.literal("sharedContext"),
    title: z51.string().trim().min(1),
    createdAt: timestampMsSchema3.optional(),
    markdown: z51.string().min(1),
    provenance: z51.object({
      shareId: z51.string().trim().min(1),
      contextId: z51.string().trim().min(1).optional(),
      shareUrl: z51.string().url().optional(),
      status: z51.enum(["pending", "reserved", "attached", "discarded"]).optional(),
      projectionSha256: z51.string().regex(/^[0-9a-f]{64}$/u),
      artifactSetSha256: z51.string().regex(/^[0-9a-f]{64}$/u),
      formatterVersion: z51.literal(1),
      markdownSha256: z51.string().regex(/^[0-9a-f]{64}$/u),
      installedArtifacts: z51.array(
        z51.object({
          artifactId: z51.string().trim().min(1),
          workspaceRelativePath: z51.string().trim().min(1)
        }).strict()
      )
    }).strict()
  }).strict()
]);
var zcodeThoughtLevelOptionSchema2 = z51.object({
  value: nonEmptyString4,
  label: nonEmptyString4,
  description: z51.string().optional()
}).strict();
var zcodeModelReasoningOptionsSchema2 = z51.object({
  levels: z51.array(zcodeThoughtLevelOptionSchema2),
  defaultLevel: nonEmptyString4.optional()
}).strict();
var zcodeModelFormatPropertiesSchema2 = completeModelPropertiesDataSchema.pick({
  inputFormat: true,
  outputFormat: true
});
var zcodeModelOptionSchema2 = z51.object({
  ref: modelSelectionSchema,
  label: nonEmptyString4,
  providerLabel: nonEmptyString4.optional(),
  description: z51.string().optional(),
  contextWindow: z51.number().int().positive().optional(),
  maxOutputTokens: z51.number().int().positive().optional(),
  reasoning: zcodeModelReasoningOptionsSchema2.optional(),
  properties: zcodeModelFormatPropertiesSchema2,
  disabledReason: z51.string().optional()
}).strict();
var zcodeAccountAccessSchema2 = z51.discriminatedUnion("planKind", [
  z51.object({
    type: z51.literal("zhipu-account"),
    family: z51.enum(["zai", "bigmodel"]),
    planKind: z51.literal("start-plan")
  }).strict(),
  z51.object({
    type: z51.literal("zhipu-account"),
    family: z51.enum(["zai", "bigmodel"]),
    planKind: z51.literal("individual-coding-plan")
  }).strict(),
  z51.object({
    type: z51.literal("zhipu-account"),
    family: z51.enum(["zai", "bigmodel"]),
    planKind: z51.literal("team-coding-plan"),
    productId: nonEmptyString4,
    organizationId: nonEmptyString4,
    projectId: nonEmptyString4
  }).strict()
]);
var zcodeProviderAccountAccessSchema2 = z51.object({
  type: z51.literal("zhipu-account"),
  accountType: z51.enum(["zai", "bigmodel"]),
  mode: z51.enum(["start-plan", "individual-coding-plan", "team-coding-plan", "off-peak"]),
  entitled: z51.boolean()
}).strict();
var zcodeSessionTodoItemSchema2 = z51.object({
  content: nonEmptyString4,
  status: z51.enum(["pending", "in_progress", "completed"]),
  priority: z51.enum(["high", "medium", "low"])
}).strict();
var zcodeSessionGoalStatsSchema2 = z51.object({
  timeUsedSeconds: z51.number().int().nonnegative(),
  tokensUsed: z51.number().int().nonnegative(),
  tokenBudget: z51.number().int().positive().nullable(),
  contextUsed: z51.number().int().nonnegative(),
  contextWindow: z51.number().int().nonnegative(),
  toolCallCount: z51.number().int().nonnegative(),
  iterationCount: z51.number().int().nonnegative()
}).strict();
var zcodeSessionTodoGroupSchema2 = z51.object({
  id: nonEmptyString4,
  source: z51.enum(["goal_iteration", "session"]),
  goalIteration: z51.number().int().positive().optional(),
  targetId: nonEmptyString4.optional(),
  startedAt: timestampMsSchema3.optional(),
  updatedAt: timestampMsSchema3.optional(),
  todos: z51.array(zcodeSessionTodoItemSchema2)
}).strict();
var zcodeSessionSettingsStateSchema2 = z51.object({
  model: z51.object({
    // 未绑定是合法恢复状态；不能为满足协议而伪造模型或阻断历史读取。
    current: modelSelectionSchema.optional(),
    available: z51.array(zcodeModelOptionSchema2),
    lastUsed: modelSelectionSchema.optional()
  }).strict(),
  thoughtLevel: z51.object({
    enabled: z51.boolean(),
    current: nonEmptyString4.optional(),
    defaultLevel: nonEmptyString4.optional(),
    available: z51.array(zcodeThoughtLevelOptionSchema2)
  }).strict(),
  mode: z51.object({
    current: zcodeSessionModeSchema
  }).strict(),
  permission: z51.object({
    mode: zcodeSessionModeSchema.optional(),
    rulesRevision: z51.number().int().nonnegative().optional()
  }).strict().optional()
}).strict();
var zcodePendingPermissionSchema2 = z51.object({
  requestId: nonEmptyString4,
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  reason: z51.string(),
  riskLevel: z51.enum(["low", "medium", "high", "critical"]),
  input: z51.unknown().optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  options: z51.array(zcodePermissionOptionSchema2).min(1),
  requestedAt: timestampMsSchema3
}).strict();
var zcodeActiveToolCallSchema2 = z51.object({
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  status: z51.enum(["pending", "running", "completed", "failed", "denied"]),
  startedAt: timestampMsSchema3.optional()
}).strict();
var zcodeSessionProjectionSchema2 = z51.object({
  sessionId: nonEmptyString4,
  status: zcodeSessionStatusSchema,
  mode: zcodeSessionModeSchema,
  turnCount: z51.number().int().nonnegative(),
  totalTokenCount: z51.number().int().nonnegative(),
  contextUsed: z51.number().int().nonnegative(),
  contextWindow: z51.number().int().nonnegative(),
  currentTurnId: nonEmptyString4.optional(),
  pendingPermissions: z51.array(zcodePendingPermissionSchema2),
  activeToolCalls: z51.array(zcodeActiveToolCallSchema2),
  backgroundJobs: z51.array(jsonObjectSchema3),
  target: zcodeSessionGoalSchema.nullable().optional(),
  lastError: z51.object({
    type: nonEmptyString4,
    code: nonEmptyString4.optional(),
    message: nonEmptyString4,
    detail: z51.string().optional(),
    attribution: errorAttributionSchema.optional()
  }).strict().optional()
}).strict();
var zcodeSlashCommandSchema2 = z51.object({
  name: nonEmptyString4,
  description: z51.string(),
  inputHint: z51.string().optional(),
  source: z51.enum(["builtin", "custom"]).optional()
}).strict();
var zcodeModelStreamingKindSchema2 = z51.enum([
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
var zcodeModelStreamingEventPayloadSchema2 = z51.object({
  assistantMessageId: z51.string().optional(),
  delta: z51.string().optional(),
  done: z51.boolean().optional(),
  input: z51.unknown().optional(),
  kind: zcodeModelStreamingKindSchema2,
  partId: z51.string().optional(),
  providerExecuted: z51.boolean().optional(),
  toolCallId: z51.string().optional(),
  toolName: z51.string().optional()
}).strict();
var zcodeSessionStateSnapshotSchema2 = z51.object({
  protocol: z51.object({
    name: z51.literal(ZCODE_PROTOCOL_NAME2),
    version: z51.literal(ZCODE_PROTOCOL_VERSION2)
  }).strict(),
  session: zcodeSessionInfoSchema,
  settings: zcodeSessionSettingsStateSchema2,
  projection: zcodeSessionProjectionSchema2,
  runtime: zcodeSessionRuntimeStateSchema,
  messages: z51.array(zcodeMessageWithPartsSchema),
  goalStats: zcodeSessionGoalStatsSchema2.optional(),
  todos: z51.array(zcodeSessionTodoItemSchema2).optional(),
  todoGroups: z51.array(zcodeSessionTodoGroupSchema2).optional(),
  slashCommands: z51.array(zcodeSlashCommandSchema2).optional()
}).strict();
var zcodeEventEnvelopeSchema2 = z51.object({
  eventId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  seq: z51.number().int().nonnegative(),
  traceId: nonEmptyString4.optional(),
  timestamp: timestampMsSchema3,
  deliveryKind: zcodeDeliveryKindSchema.optional()
}).strict();
var zcodeComputerUseOperationEventBaseSchema2 = z51.object({
  eventId: nonEmptyString4,
  sequenceNumber: z51.number().int().nonnegative(),
  sessionId: nonEmptyString4,
  timestamp: timestampMsSchema3
}).strict();
var zcodeComputerUseTurnStartedEventSchema2 = zcodeComputerUseOperationEventBaseSchema2.extend({
  kind: z51.literal("turn-started"),
  turnId: nonEmptyString4
});
var zcodeComputerUseTurnCompletedEventSchema2 = zcodeComputerUseOperationEventBaseSchema2.extend({
  kind: z51.literal("turn-completed"),
  turnId: nonEmptyString4
});
var zcodeComputerUseTurnFailedEventSchema2 = zcodeComputerUseOperationEventBaseSchema2.extend({
  kind: z51.literal("turn-failed"),
  turnId: nonEmptyString4
});
var zcodeComputerUseToolScheduledEventSchema2 = zcodeComputerUseOperationEventBaseSchema2.extend({
  kind: z51.literal("tool-scheduled"),
  turnId: nonEmptyString4,
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  // 这个 cell 是否在用 Computer Use。只表达布尔事实，不再携带动作名——旧的
  // operationAction 靠从模型源码里抽取动作名得到，SDK 面一变就整体失配（见
  // bootstrap/src/zcode-protocol/computer-use-operation-event.ts 的 usesComputerUse）。
  // 只挂在 scheduled 上：ToolCallStartedPayload 没有 input，start 时已拿不到模型源码。
  computerUse: z51.literal(true).optional()
});
var zcodeComputerUseToolStartedEventSchema2 = zcodeComputerUseOperationEventBaseSchema2.extend({
  kind: z51.literal("tool-started"),
  turnId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4.optional()
});
var zcodeComputerUseSessionClosedEventSchema2 = zcodeComputerUseOperationEventBaseSchema2.extend({
  kind: z51.literal("session-closed")
});
var zcodeComputerUseOperationEventSchema2 = z51.discriminatedUnion("kind", [
  zcodeComputerUseTurnStartedEventSchema2,
  zcodeComputerUseTurnCompletedEventSchema2,
  zcodeComputerUseTurnFailedEventSchema2,
  zcodeComputerUseToolScheduledEventSchema2,
  zcodeComputerUseToolStartedEventSchema2,
  zcodeComputerUseSessionClosedEventSchema2
]);
var zcodeSessionEventTypeSchema2 = z51.enum([
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
var zcodeProtocolErrorDetailSchema2 = z51.object({
  type: nonEmptyString4,
  message: nonEmptyString4,
  stack: z51.string().optional(),
  code: z51.string().optional(),
  detail: z51.string().optional(),
  underlyingErrorMessage: z51.string().optional(),
  underlyingErrorDetail: z51.string().optional(),
  attribution: errorAttributionSchema.optional(),
  retryable: z51.boolean().optional(),
  data: z51.unknown().optional()
}).strict();
var zcodeSessionCreatedEventPayloadSchema2 = z51.object({
  mode: zcodeSessionModeSchema,
  contextWindow: z51.number().int().nonnegative()
}).strict();
var zcodeSessionResumedEventPayloadSchema2 = z51.object({
  directory: nonEmptyString4,
  interruptedToolCount: z51.number().int().nonnegative(),
  messageCount: z51.number().int().nonnegative(),
  partCount: z51.number().int().nonnegative(),
  recoveredCompactTimelineCount: z51.number().int().nonnegative().optional(),
  recoveredSteerInputCount: z51.number().int().nonnegative().optional(),
  resumedTodoCount: z51.number().int().nonnegative().optional()
}).strict();
var zcodeSessionTitleUpdatedEventPayloadSchema2 = z51.object({
  messageID: nonEmptyString4.optional(),
  previousTitle: z51.string(),
  source: z51.enum(["default", "first_input", "generated", "custom"]),
  title: z51.string()
}).strict();
var zcodeTurnStartedEventPayloadSchema2 = z51.object({
  turnNumber: z51.number().int().nonnegative(),
  input: z51.string(),
  inputId: nonEmptyString4.optional(),
  queryId: nonEmptyString4.optional(),
  inputSource: zcodeTurnInputSourceSchema2.optional(),
  inputVisibility: zcodeMessageVisibilitySchema.optional(),
  executionKind: z51.enum(["agent", "controlOnly"]).optional(),
  targetId: nonEmptyString4.optional(),
  messageId: nonEmptyString4.optional(),
  foregroundExecutionId: nonEmptyString4.optional(),
  intent: jsonObjectSchema3.optional(),
  originMeta: jsonObjectSchema3.optional(),
  // runtime 会透传后台唤醒来源，strict schema 必须同步声明以免丢弃整条事件。
  backgroundSource: z51.enum(["bash", "subagent"]).optional(),
  attachments: z51.array(jsonObjectSchema3).optional()
}).strict();
var zcodeTurnSteerSourceSchema2 = z51.enum(["plan_approval_feedback", "workflow_refine_feedback"]);
var zcodeTurnSteerCommandKindSchema2 = z51.enum(["sendText", "sendGoalCommand", "compact"]);
var zcodeTurnSteerDeliverySchema2 = z51.enum(["queue", "guide"]);
var zcodeTurnSteerQueuedEventPayloadSchema2 = z51.object({
  pendingInputId: nonEmptyString4,
  inputId: nonEmptyString4.optional(),
  queryId: nonEmptyString4.optional(),
  input: z51.string(),
  inputPreview: z51.string(),
  inputSize: z51.number().int().nonnegative(),
  commandKind: zcodeTurnSteerCommandKindSchema2.optional(),
  source: zcodeTurnSteerSourceSchema2.optional(),
  toolDisallowlist: z51.array(nonEmptyString4).optional(),
  delivery: zcodeTurnSteerDeliverySchema2.optional(),
  targetTurnId: nonEmptyString4,
  queueLength: z51.number().int().nonnegative(),
  intent: jsonObjectSchema3.optional()
}).strict();
var zcodeTurnSteerDrainedEventPayloadSchema2 = z51.object({
  pendingInputIds: z51.array(nonEmptyString4),
  queryIds: z51.array(nonEmptyString4).optional(),
  targetTurnId: nonEmptyString4,
  injectedMessageIds: z51.array(nonEmptyString4),
  drainedInputs: z51.array(
    z51.object({
      pendingInputId: nonEmptyString4,
      messageId: nonEmptyString4,
      text: z51.string(),
      delivery: zcodeTurnSteerDeliverySchema2.optional(),
      intent: jsonObjectSchema3.optional(),
      toolDisallowlist: z51.array(nonEmptyString4).optional()
    }).strict()
  ).optional()
}).strict();
var zcodeTurnCompletedEventPayloadSchema2 = z51.object({
  response: z51.string(),
  tokenCount: z51.number().int().nonnegative(),
  usage: z51.unknown().optional(),
  toolCallCount: z51.number().int().nonnegative(),
  historyRoundCount: z51.number().int().nonnegative().optional(),
  duration: z51.number().nonnegative(),
  // runtime turn.completed 会附带 cacheStats，协议 schema 之前漏掉该字段。
  // strict 校验失败会让桌面端丢掉终态事件，表现为消息已完成但 UI 一直没有回复。
  cacheStats: z51.object({
    totalMessages: z51.number().int().nonnegative(),
    cachedMessages: z51.number().int().nonnegative(),
    lastCacheHit: z51.boolean(),
    cacheReadTokens: z51.number().int().nonnegative().optional()
  }).strict().optional(),
  inputId: nonEmptyString4.optional(),
  resultType: z51.enum([
    "success",
    // "cancelled": 用户主动中断属于正常结束，复用 turn.completed 上报，避免被映射成 turn.failed。
    "cancelled",
    "error_max_turns",
    "error_max_budget",
    "error_during_execution",
    "error_max_tool_calls"
  ]),
  backgroundSubagentResultConsumed: z51.boolean().optional()
}).strict();
var zcodeTurnFailedEventPayloadSchema2 = z51.object({
  error: zcodeProtocolErrorDetailSchema2,
  turnPhase: z51.string(),
  inputId: nonEmptyString4.optional(),
  backgroundSubagentResultConsumed: z51.boolean().optional()
}).strict();
var zcodeMessageUpsertedEventPayloadSchema2 = z51.object({
  content: z51.string(),
  attachments: z51.array(z51.unknown()).optional(),
  toolCalls: z51.array(z51.unknown()).optional(),
  type: z51.string().optional(),
  compactBoundary: z51.unknown().optional()
}).strict();
var zcodeMessageRemovedEventPayloadSchema2 = z51.object({
  messageId: nonEmptyString4,
  reason: z51.string().optional()
}).strict();
var zcodeMessagePartDeltaEventPayloadSchema2 = z51.object({
  messageId: nonEmptyString4,
  partId: nonEmptyString4,
  field: z51.enum(["text", "reasoning", "input", "output"]).optional(),
  delta: z51.string()
}).strict();
var zcodeMessagePartUpsertedEventPayloadSchema2 = z51.object({
  part: zcodeMessagePartSchema
}).strict();
var zcodeMessagePartRemovedEventPayloadSchema2 = z51.object({
  messageId: nonEmptyString4,
  partId: nonEmptyString4,
  reason: z51.string().optional()
}).strict();
var zcodeToolCallBasePayloadSchema2 = z51.object({
  toolCallId: nonEmptyString4,
  toolName: z51.string().optional(),
  parentToolCallId: nonEmptyString4.optional(),
  source: z51.enum(["subagent"]).optional(),
  agentId: nonEmptyString4.optional(),
  agentType: nonEmptyString4.optional(),
  // subagent mirror 会携带后台归因；strict schema 漏字段会让 session/event 整条被丢弃。
  background: z51.boolean().optional(),
  childSessionId: nonEmptyString4.optional(),
  childToolCallId: nonEmptyString4.optional(),
  description: z51.string().optional()
}).strict();
var zcodeToolUpdatedEventPayloadSchema2 = z51.discriminatedUnion("kind", [
  zcodeToolCallBasePayloadSchema2.extend({
    kind: z51.literal("scheduled"),
    // 修复：CLI 调度事件已携带所属消息 ID；漏声明会让严格校验丢弃整条事件。
    assistantMessageId: nonEmptyString4.optional(),
    toolName: nonEmptyString4,
    input: z51.unknown().optional(),
    inputByteLength: z51.number().int().nonnegative().optional(),
    inputOmitted: z51.boolean().optional(),
    inputRef: z51.literal("model_stream").optional(),
    dependencies: z51.array(nonEmptyString4).optional(),
    parallelGroupIndex: z51.number().int().nonnegative().optional(),
    canRunParallel: z51.boolean().optional(),
    schedule: jsonObjectSchema3.optional()
  }).strict(),
  zcodeToolCallBasePayloadSchema2.extend({
    kind: z51.literal("started"),
    startedAt: protocolInstantSchema2
  }).strict(),
  zcodeToolCallBasePayloadSchema2.extend({
    kind: z51.literal("progress"),
    elapsedMs: z51.number().nonnegative().optional(),
    pid: z51.number().int().optional(),
    stdoutBytes: z51.number().int().nonnegative().optional(),
    stderrBytes: z51.number().int().nonnegative().optional(),
    outputBytes: z51.number().int().nonnegative().optional(),
    outputPreview: executionOutputPreviewSchema.optional(),
    stdoutTail: z51.string().optional(),
    stderrTail: z51.string().optional()
  }).strict(),
  zcodeToolCallBasePayloadSchema2.extend({
    kind: z51.literal("result"),
    result: zcodeToolResultObjectSchema2,
    duration: z51.number().nonnegative()
  }).strict(),
  zcodeToolCallBasePayloadSchema2.extend({
    kind: z51.literal("error"),
    error: zcodeProtocolErrorDetailSchema2
  }).strict(),
  z51.object({
    kind: z51.literal("batch"),
    toolCallIds: z51.array(nonEmptyString4),
    successCount: z51.number().int().nonnegative(),
    errorCount: z51.number().int().nonnegative()
  }).strict(),
  zcodeToolCallBasePayloadSchema2.extend({
    kind: z51.literal("raw"),
    payload: jsonObjectSchema3
  }).strict()
]);
var zcodePermissionRequestedEventPayloadSchema2 = z51.object({
  requestId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  riskLevel: z51.enum(["low", "medium", "high", "critical"]),
  reason: z51.string(),
  input: z51.unknown(),
  suggestedPermissionUpdates: z51.array(zcodePermissionUpdateSchema).optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  options: z51.array(zcodePermissionOptionSchema2).min(1),
  childSessionId: nonEmptyString4.optional(),
  background: z51.boolean().optional()
}).strict();
var zcodePermissionResolvedEventPayloadSchema2 = z51.object({
  requestId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4.optional(),
  decision: zcodePermissionDecisionSchema.optional(),
  reason: z51.string().optional(),
  modifiedInput: z51.unknown().optional(),
  inputSummary: z51.unknown().optional(),
  childSessionId: nonEmptyString4.optional(),
  background: z51.boolean().optional()
}).strict();
var zcodeUserInputRequestedEventPayloadSchema2 = z51.object({
  requestId: nonEmptyString4,
  prompt: z51.string(),
  inputType: z51.enum(["text", "choice", "confirm"]).optional(),
  choices: z51.array(z51.string()).optional()
}).strict();
var zcodeUserInputResolvedEventPayloadSchema2 = z51.object({
  requestId: nonEmptyString4,
  value: z51.unknown().optional(),
  cancelled: z51.boolean().optional()
}).strict();
var zcodeSessionClosedEventPayloadSchema2 = z51.object({
  reason: z51.string().optional()
}).strict();
function zcodeSessionEventEnvelopeFor2(type, payload) {
  return zcodeEventEnvelopeSchema2.extend({
    type: z51.literal(type),
    payload: payload.optional()
  });
}
var zcodeSessionEventSchema2 = z51.discriminatedUnion("type", [
  zcodeSessionEventEnvelopeFor2("session.created", zcodeSessionCreatedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("session.resumed", zcodeSessionResumedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("session.updated", jsonObjectSchema3),
  zcodeSessionEventEnvelopeFor2("session.titleUpdated", zcodeSessionTitleUpdatedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("session.closed", zcodeSessionClosedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("turn.started", zcodeTurnStartedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("turn.steerQueued", zcodeTurnSteerQueuedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("turn.steerDrained", zcodeTurnSteerDrainedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("turn.completed", zcodeTurnCompletedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("turn.failed", zcodeTurnFailedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("message.upserted", zcodeMessageUpsertedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("message.removed", zcodeMessageRemovedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("part.started", zcodeMessagePartUpsertedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("part.delta", zcodeMessagePartDeltaEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("part.upserted", zcodeMessagePartUpsertedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("part.removed", zcodeMessagePartRemovedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("model.streaming", zcodeModelStreamingEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("tool.updated", zcodeToolUpdatedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("permission.requested", zcodePermissionRequestedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("permission.resolved", zcodePermissionResolvedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("userInput.requested", zcodeUserInputRequestedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("userInput.resolved", zcodeUserInputResolvedEventPayloadSchema2),
  zcodeSessionEventEnvelopeFor2("checkpoint.created", jsonObjectSchema3),
  zcodeSessionEventEnvelopeFor2("rewind.triggered", jsonObjectSchema3),
  zcodeSessionEventEnvelopeFor2("streamRecovery.updated", jsonObjectSchema3)
]);
var zcodeSessionEventsResultSchema2 = z51.object({
  events: z51.array(zcodeSessionEventSchema2)
}).strict();
var zcodeSessionMessagesResultSchema2 = z51.object({
  messages: z51.array(zcodeMessageWithPartsSchema)
}).strict();
var zcodeStateUpdatedNotificationSchema2 = z51.object({
  type: z51.literal("state.updated"),
  scope: z51.enum(["server", "workspace", "session"]),
  workspace: zcodeWorkspaceRefSchema.optional(),
  sessionId: nonEmptyString4.optional(),
  revision: z51.number().int().nonnegative(),
  reason: z51.string().optional(),
  patch: z51.unknown()
}).strict();
var zcodeSessionSubscribeParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  deliveryKind: zcodeDeliveryKindSchema,
  afterSeq: z51.number().int().nonnegative().optional(),
  includeSnapshot: z51.boolean().default(false)
}).strict();
var zcodeSessionSubscribeResultSchema2 = z51.object({
  sessionId: nonEmptyString4,
  eventSeq: z51.number().int().nonnegative(),
  events: z51.array(zcodeSessionEventSchema2),
  snapshot: zcodeSessionStateSnapshotSchema2.optional()
}).strict();
var zcodeSessionListResultSchema2 = z51.object({
  sessions: z51.array(zcodeSessionInfoSchema)
}).strict();
var zcodeSessionSubagentBaseSchema2 = z51.object({
  childSessionId: nonEmptyString4,
  agentId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4.optional(),
  subagentType: nonEmptyString4,
  title: nonEmptyString4,
  summary: z51.string().optional(),
  startedAt: z51.number().int().nonnegative().optional(),
  endedAt: z51.number().int().nonnegative().optional()
}).strict();
var zcodeSessionRunningSubagentSchema2 = zcodeSessionSubagentBaseSchema2.extend({
  status: z51.enum(["running", "waiting", "blocked"])
});
var zcodeSessionEndedSubagentSchema2 = zcodeSessionSubagentBaseSchema2.extend({
  status: z51.enum(["success", "failed", "cancelled", "lost"])
});
var zcodeSessionSubagentsResultSchema2 = z51.object({
  revision: z51.number().int().nonnegative(),
  childSessionIds: z51.array(nonEmptyString4),
  running: z51.array(zcodeSessionRunningSubagentSchema2),
  ended: z51.object({
    total: z51.number().int().nonnegative(),
    items: z51.array(zcodeSessionEndedSubagentSchema2),
    nextCursor: nonEmptyString4.optional()
  }).strict()
}).strict();
var zcodeSessionCreateParamsSchema2 = z51.object({
  sessionId: nonEmptyString4.optional(),
  workspace: zcodeWorkspaceRefSchema,
  parentSessionId: nonEmptyString4.optional(),
  mode: zcodeSessionModeSchema.optional(),
  model: modelSelectionSchema.optional(),
  persistence: zcodeSessionPersistenceSchema2.optional(),
  thoughtLevel: nonEmptyString4.optional(),
  titleGenerationEnabled: z51.boolean().optional(),
  mcpServers: z51.array(zcodeProtocolMcpServerSchema2).optional(),
  toolAllowlist: z51.array(nonEmptyString4).optional(),
  toolDenylist: z51.array(nonEmptyString4).optional(),
  importedHistory: zcodeSessionImportHistorySchema2.optional(),
  // host 只按本地服务装配/远程/端形态决定是否注册工具，不读取灰度；
  // 缺省不下发 = 不注册；灰度与套餐准入在实际创建的 Host handler 校验。
  offPeakToolEnabled: z51.boolean().optional(),
  // 动态工作流灰度：与 offPeakToolEnabled 同一
  // 模式——host 裁决后下发，缺省不下发 = 不注册工作流工具簇（fail-closed）。
  dynamicWorkflowEnabled: z51.boolean().optional()
}).strict();
var zcodeSessionResumeParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  workspace: zcodeWorkspaceRefSchema.optional(),
  // 旧 session 尚无 runtime/model_selection entry 时，由同 task 的索引元数据提供迁移 hint。
  thoughtLevel: nonEmptyString4.optional(),
  mcpServers: z51.array(zcodeProtocolMcpServerSchema2).optional(),
  // 冷恢复重建 runtime 时必须沿用 create 的工具面约束（否则会绕过 allow/deny，尤其 CUA 会话）。
  toolAllowlist: z51.array(nonEmptyString4).optional(),
  toolDenylist: z51.array(nonEmptyString4).optional(),
  // 与 create 同语义；resume 不带会导致冷恢复丢 Off-Peak 工具面。
  offPeakToolEnabled: z51.boolean().optional(),
  // 与 create 同语义；resume 不带会导致冷恢复丢工作流工具簇。
  dynamicWorkflowEnabled: z51.boolean().optional()
}).strict();
var zcodeSessionListParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema.optional(),
  // 显式身份查询包含隐藏会话；普通列表仍只返回主任务，避免索引修复激活 runtime。
  sessionIds: z51.array(nonEmptyString4).min(1).max(64).optional(),
  includeArchived: z51.boolean().default(false),
  limit: z51.number().int().positive().optional()
}).strict();
var zcodeSessionSubagentsParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  endedCursor: nonEmptyString4.optional(),
  endedLimit: z51.number().int().positive().max(100).default(20)
}).strict();
var zcodeUsageStatsParamsSchema2 = z51.object({
  range: z51.enum(APP_USAGE_RANGES),
  timeZone: z51.string().optional()
}).strict();
var zcodeUsageStatsResultSchema = appUsageSnapshotSchema;
var zcodeTaskTokenUsageParamsSchema2 = z51.object({
  sessionId: nonEmptyString4
}).strict();
var zcodeTaskTokenUsageResultSchema2 = z51.object({
  sessionId: nonEmptyString4,
  totalTokens: z51.number().int().nonnegative(),
  inputTokens: z51.number().int().nonnegative(),
  outputTokens: z51.number().int().nonnegative(),
  reasoningTokens: z51.number().int().nonnegative(),
  cacheCreationTokens: z51.number().int().nonnegative(),
  cacheReadTokens: z51.number().int().nonnegative(),
  modelRequestCount: z51.number().int().nonnegative(),
  modelErrorCount: z51.number().int().nonnegative(),
  inputBaselineBySource: z51.record(z51.string(), z51.number().int().nonnegative())
}).strict();
var zcodeSessionReadParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  deliveryKind: zcodeDeliveryKindSchema.optional(),
  messageLimit: z51.number().int().positive().optional(),
  afterSeq: z51.number().int().nonnegative().optional()
}).strict();
var zcodeSessionMessagesParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  afterMessageId: nonEmptyString4.optional(),
  limit: z51.number().int().positive().optional()
}).strict();
var zcodeSessionEventsParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  afterSeq: z51.number().int().nonnegative().optional(),
  limit: z51.number().int().positive().optional()
}).strict();
var zcodeSessionRuntimePreferencesScopeSchema2 = z51.enum([
  "runtime-materialization",
  "user-execution"
]);
var zcodeSessionRequestRuntimePreferencesParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  scope: zcodeSessionRuntimePreferencesScopeSchema2
}).strict();
var DEFAULT_ZCODE_MODEL_CONTEXT_BUDGET_STRATEGY2 = "preflight-v1";
var zcodeModelContextBudgetStrategySchema2 = z51.enum(["legacy", "preflight-v1"]);
var zcodeSessionRuntimePreferencesResultSchema2 = z51.object({
  nativeSearchEnhancementsEnabled: z51.boolean(),
  memoryEnabled: z51.boolean().default(false),
  askUserQuestionAutoResolutionEnabled: z51.boolean().default(true),
  integratedTerminalShell: integratedTerminalShellSelectionSchema.optional(),
  // 兼容旧 Host：缺少字段时在协议解析边界使用当前默认策略。
  modelContextBudgetStrategy: zcodeModelContextBudgetStrategySchema2.default(
    DEFAULT_ZCODE_MODEL_CONTEXT_BUDGET_STRATEGY2
  )
}).strict();
var zcodeBrowserAmbientContextSchema2 = z51.object({
  tabCount: z51.number().int().positive().max(100),
  currentUrl: z51.string().trim().min(1).max(4096).optional()
}).strict();
var zcodeSessionSendParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  modelSelection: modelSelectionSchema.optional(),
  modelExecution: modelExecutionSchema.optional(),
  inputId: nonEmptyString4.optional(),
  queryId: nonEmptyString4.optional(),
  content: z51.string(),
  attachments: z51.array(jsonObjectSchema3).optional(),
  browserAmbientContext: zcodeBrowserAmbientContextSchema2.optional(),
  expectedRevision: z51.number().int().nonnegative().optional(),
  expectedProviderRevision: nonEmptyString4.optional(),
  automationId: nonEmptyString4.optional(),
  offPeakTaskId: nonEmptyString4.optional(),
  offPeakRunType: z51.enum(["init", "resume"]).optional(),
  botDeliveryTarget: zcodeAutomationBotDeliveryTargetSchema.optional(),
  toolDenylist: z51.array(nonEmptyString4).optional()
}).strict().superRefine((payload, context) => {
  if (payload.automationId && payload.offPeakTaskId) {
    context.addIssue({
      code: z51.ZodIssueCode.custom,
      message: "automationId and offPeakTaskId are mutually exclusive"
    });
  }
  if (payload.offPeakRunType && !payload.offPeakTaskId) {
    context.addIssue({
      code: z51.ZodIssueCode.custom,
      message: "offPeakRunType requires offPeakTaskId",
      path: ["offPeakRunType"]
    });
  }
  if (payload.modelExecution && !payload.modelSelection) {
    context.addIssue({
      code: z51.ZodIssueCode.custom,
      message: "modelExecution requires modelSelection",
      path: ["modelExecution"]
    });
  }
});
var zcodeSessionSendResultSchema2 = z51.object({
  sessionId: nonEmptyString4,
  accepted: z51.literal(true),
  stateRevision: z51.number().int().nonnegative()
}).strict();
var zcodeSessionHistoryTargetSchema2 = z51.discriminatedUnion("kind", [
  z51.object({
    kind: z51.literal("turn"),
    turnIndex: z51.number().int().nonnegative()
  }).strict(),
  z51.object({
    kind: z51.literal("message"),
    messageId: nonEmptyString4
  }).strict(),
  z51.object({
    kind: z51.literal("checkpoint"),
    checkpointId: nonEmptyString4
  }).strict(),
  z51.object({
    kind: z51.literal("latestCheckpoint")
  }).strict()
]);
var zcodeSessionForkParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  target: zcodeSessionHistoryTargetSchema2.default({
    kind: "latestCheckpoint"
  }),
  expectedRevision: z51.number().int().nonnegative().optional()
}).strict();
var zcodeSessionForkResultSchema2 = z51.object({
  forkedSessionId: nonEmptyString4,
  parentSessionId: nonEmptyString4.optional(),
  targetMessageId: nonEmptyString4.optional(),
  targetCheckpointId: nonEmptyString4.optional(),
  response: z51.string(),
  snapshot: zcodeSessionStateSnapshotSchema2
}).strict();
var zcodeSessionCompactParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  inputId: nonEmptyString4.optional(),
  instructions: z51.string().optional(),
  expectedRevision: z51.number().int().nonnegative().optional()
}).strict();
var zcodeSessionCompactResultSchema2 = z51.object({
  response: z51.string(),
  snapshot: zcodeSessionStateSnapshotSchema2,
  compact: z51.object({
    state: z51.enum(["accepted", "already_running"]),
    inputId: nonEmptyString4.optional(),
    operationId: nonEmptyString4.optional()
  }).strict().optional()
}).strict();
var zcodeSessionGoalActionSchema2 = z51.enum([
  "show",
  "set",
  "replace",
  "pause",
  "resume",
  "clear"
]);
var zcodeSessionGoalParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  inputId: nonEmptyString4.optional(),
  action: zcodeSessionGoalActionSchema2,
  objective: z51.string().optional(),
  expectedRevision: z51.number().int().nonnegative().optional()
}).strict();
var zcodeSessionGoalResultSchema2 = z51.object({
  response: z51.string(),
  snapshot: zcodeSessionStateSnapshotSchema2,
  startedTurn: z51.boolean().optional()
}).strict();
var zcodeSessionStopParamsSchema2 = z51.object({
  sessionId: nonEmptyString4
}).strict();
var zcodeBackgroundTaskInfoStatusSchema2 = z51.enum([
  "running",
  "completed",
  "failed",
  "timed_out",
  "cancelled",
  "spawn_error",
  "lost"
]);
var zcodeBackgroundTaskInfoSchema2 = z51.object({
  taskId: nonEmptyString4,
  toolCallId: nonEmptyString4.optional(),
  toolName: nonEmptyString4.optional(),
  taskKind: z51.enum(["bash", "subagent"]).optional(),
  blocked: z51.boolean().optional(),
  blockedReason: z51.string().optional(),
  cancellable: z51.boolean().optional(),
  cancelRequestedAt: protocolInstantSchema2.optional(),
  command: z51.string().optional(),
  description: z51.string().optional(),
  status: zcodeBackgroundTaskInfoStatusSchema2,
  pid: z51.number().int().positive().optional(),
  startedAt: protocolInstantSchema2.optional(),
  completedAt: protocolInstantSchema2.optional(),
  outputPath: z51.string().optional(),
  stderrPersistedOutputPath: z51.string().optional(),
  stdoutPersistedOutputPath: z51.string().optional(),
  outputBytes: z51.number().int().nonnegative().optional(),
  outputTruncated: z51.boolean().optional(),
  outputTail: z51.string().optional(),
  stderrBytes: z51.number().int().nonnegative().optional(),
  stderrTail: z51.string().optional(),
  stdoutBytes: z51.number().int().nonnegative().optional(),
  stdoutTail: z51.string().optional(),
  terminalId: nonEmptyString4.optional()
}).strict();
var zcodeSessionCancelBackgroundTaskParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  taskId: nonEmptyString4
}).strict();
var zcodeSessionCancelBackgroundTaskResultSchema2 = z51.object({
  cancelled: z51.boolean(),
  reason: z51.string().optional(),
  snapshot: zcodeBackgroundTaskInfoSchema2.optional(),
  status: zcodeBackgroundTaskInfoStatusSchema2,
  taskId: nonEmptyString4
}).strict();
var zcodeSessionSetModelParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  model: modelSelectionSchema,
  expectedRevision: z51.number().int().nonnegative().optional(),
  persistAsWorkspaceLastUsed: z51.boolean().default(true)
}).strict();
var zcodeSessionSetThoughtLevelParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  thoughtLevel: nonEmptyString4.optional(),
  expectedRevision: z51.number().int().nonnegative().optional(),
  persistAsWorkspaceLastUsed: z51.boolean().default(true)
}).strict();
var zcodeSessionSetModeParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  mode: zcodeSessionModeSchema,
  expectedRevision: z51.number().int().nonnegative().optional()
}).strict();
var zcodeSessionCloseParamsSchema2 = z51.object({
  sessionId: nonEmptyString4,
  expectedPersistence: zcodeSessionPersistenceSchema2.optional()
}).strict();
var zcodeSessionCloseResultSchema2 = z51.object({
  closed: z51.boolean().optional()
}).strict();
var zcodeWorkspaceReadPresentationParamsSchema2 = z51.object({ workspace: zcodeWorkspaceRefSchema }).strict();
var zcodeWorkspacePresentationSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  mode: zcodeSessionModeSchema,
  slashCommands: z51.array(zcodeSlashCommandSchema2)
}).strict();
var workspaceHookSha256DigestSchema2 = z51.string().regex(/^[a-f0-9]{64}$/u);
var zcodeWorkspaceHookTrustGrantParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  bundleDigest: workspaceHookSha256DigestSchema2,
  hookDeclarationDigest: workspaceHookSha256DigestSchema2
}).strict();
var zcodeWorkspaceHookTrustGrantReasonCodeSchema2 = z51.enum([
  "workspace_hooks_blocked_by_policy",
  "workspace_hooks_bundle_changed",
  "workspace_hooks_snapshot_mismatch",
  "workspace_hooks_policy_requires_pretrust",
  "workspace_hooks_trust_store_corrupt",
  "workspace_hooks_config_unreadable"
]);
var zcodeWorkspaceHookTrustGrantResultSchema2 = z51.object({
  accepted: z51.boolean(),
  reasonCode: zcodeWorkspaceHookTrustGrantReasonCodeSchema2.optional()
}).strict();
var zcodeWorkspaceModelToolCallSchema2 = z51.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  input: z51.unknown()
}).strict();
var zcodeWorkspaceModelMessageSchema2 = z51.discriminatedUnion("role", [
  z51.object({ role: z51.literal("system"), content: z51.string() }).strict(),
  z51.object({ role: z51.literal("user"), content: z51.string() }).strict(),
  z51.object({
    role: z51.literal("assistant"),
    content: z51.string(),
    toolCalls: z51.array(zcodeWorkspaceModelToolCallSchema2).optional()
  }).strict(),
  z51.object({
    role: z51.literal("tool"),
    content: z51.string(),
    toolCallId: nonEmptyString4,
    toolName: nonEmptyString4,
    isError: z51.boolean().optional()
  }).strict()
]);
var zcodeWorkspaceModelToolSchema2 = z51.object({
  name: nonEmptyString4,
  description: z51.string().optional(),
  inputSchema: z51.record(z51.string(), z51.unknown())
}).strict();
var zcodeWorkspaceGenerateTextParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  selection: modelSelectionSchema,
  prompt: nonEmptyString4.optional(),
  messages: z51.array(zcodeWorkspaceModelMessageSchema2).min(1).optional(),
  tools: z51.array(zcodeWorkspaceModelToolSchema2).optional(),
  querySource: nonEmptyString4,
  maxOutputTokens: z51.number().int().positive().optional(),
  operationId: nonEmptyString4.optional()
}).strict().refine((value) => value.prompt !== void 0 || value.messages !== void 0, {
  message: "prompt \u6216 messages \u81F3\u5C11\u9700\u8981\u63D0\u4F9B\u4E00\u4E2A"
});
var zcodeWorkspaceGenerateTextResultSchema2 = z51.object({
  text: z51.string(),
  selection: modelSelectionSchema,
  toolCalls: z51.array(zcodeWorkspaceModelToolCallSchema2).optional(),
  // 可选以兼容仍在运行的旧 app-server；新 CLI 始终返回结构化结束原因。
  finishReason: z51.string().optional(),
  usage: z51.object({
    inputTokens: z51.number().nonnegative().optional(),
    outputTokens: z51.number().nonnegative().optional(),
    totalTokens: z51.number().nonnegative().optional(),
    cacheReadTokens: z51.number().nonnegative().optional(),
    cacheWriteTokens: z51.number().nonnegative().optional(),
    reasoningTokens: z51.number().nonnegative().optional(),
    serverToolUse: z51.object({
      webSearchRequests: z51.number().nonnegative().optional(),
      webFetchRequests: z51.number().nonnegative().optional()
    }).strict().optional()
  }).strict().optional()
}).strict();
var zcodeWorkspaceCancelGenerateTextParamsSchema2 = z51.object({ operationId: nonEmptyString4 }).strict();
var zcodeWorkspaceCancelGenerateTextResultSchema2 = z51.object({ operationId: nonEmptyString4, cancelled: z51.boolean() }).strict();
var zcodeProviderTestModelConnectivityParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  selection: modelSelectionSchema
}).strict();
var zcodeProviderTestModelConnectivityResultSchema2 = z51.object({ success: z51.literal(true) }).strict();
var zcodeProviderUpdateAccountConfigParamsSchema2 = z51.object({
  revision: nonEmptyString4,
  basedOnZCodeBuiltinRevision: nonEmptyString4,
  // Provider Config 的字段校验由 @zcode/provider 负责；协议层只约束可传输信封。
  providers: z51.record(z51.string(), z51.unknown()),
  // 账号状态与 Overlay 必须一起传递，否则 Worker 会丢失非当前套餐的执行门禁。
  states: z51.record(
    z51.string(),
    z51.object({
      availability: z51.enum(["available", "pending", "unavailable", "unknown"]),
      entitled: z51.boolean(),
      unavailableReason: accountProviderUnavailableReasonSchema.optional(),
      current: z51.boolean().optional(),
      connectionKey: z51.string().optional(),
      effectiveAt: z51.number().finite().optional()
    }).strict()
  )
}).strict();
var zcodeProviderUpdateAccountConfigResultSchema2 = z51.object({
  // 收到账号结果不代表配套 Built-in 已到达；应用版本只能读取 Registry 快照。
  receivedRevision: nonEmptyString4,
  providerCount: z51.number().int().nonnegative(),
  status: z51.enum(["received", "unchanged"])
}).strict();
var zcodeInteractionPreferencesSchema2 = z51.object({
  askUserQuestionAutoResolutionEnabled: z51.boolean()
}).strict();
var zcodeWorkspaceUpdateInteractionPreferencesParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  preferences: zcodeInteractionPreferencesSchema2
}).strict();
var zcodeWorkspaceUpdateInteractionPreferencesResultSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  askUserQuestionAutoResolutionEnabled: z51.boolean(),
  snoozedInteractionCount: z51.number().int().nonnegative()
}).strict();
var zcodeModelIoPreferencesSchema2 = z51.object({
  fullRetentionEnabled: z51.boolean()
}).strict();
var zcodeWorkspaceUpdateModelIoPreferencesParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  preferences: zcodeModelIoPreferencesSchema2
}).strict();
var zcodeWorkspaceUpdateModelIoPreferencesResultSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  fullRetentionEnabled: z51.boolean(),
  updatedSessionCount: z51.number().int().nonnegative()
}).strict();
var zcodeWorkspaceUpdateOffPeakToolPolicyParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z51.boolean()
}).strict();
var zcodeWorkspaceUpdateOffPeakToolPolicyResultSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z51.boolean()
}).strict();
var zcodeWorkspaceUpdateDynamicWorkflowPolicyParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z51.boolean()
}).strict();
var zcodeWorkspaceUpdateDynamicWorkflowPolicyResultSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  enabled: z51.boolean()
}).strict();
var zcodePermissionRequestParamsSchema2 = z51.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4,
  toolName: nonEmptyString4,
  reason: z51.string(),
  riskLevel: z51.enum(["low", "medium", "high", "critical"]),
  input: z51.unknown(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  options: z51.array(zcodePermissionOptionSchema2).min(1)
}).strict();
var zcodeBrowserListParamsSchema2 = z51.object({
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
var zcodeBrowserListResultSchema2 = browserBackendListResultSchema;
var zcodeBrowserExecuteParamsSchema2 = z51.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  browserId: nonEmptyString4.optional(),
  browserGeneration: z51.number().int().nonnegative().optional(),
  workspaceKey: nonEmptyString4.optional(),
  workspacePath: nonEmptyString4.optional(),
  workspaceIdentity: nonEmptyString4.optional(),
  remoteSessionId: nonEmptyString4.optional(),
  clientMode: browserClientModeSchema.optional(),
  sessionContext: browserSessionContextKindSchema.optional(),
  command: browserCommandSchema
}).strict();
var zcodeBrowserExecuteResultSchema2 = browserCommandResultSchema;
var zcodeUserInputOptionSchema2 = z51.object({
  value: nonEmptyString4,
  label: nonEmptyString4,
  description: z51.string().optional(),
  preview: z51.string().optional()
}).strict();
var zcodeUserInputQuestionSchema2 = z51.object({
  question: nonEmptyString4,
  header: nonEmptyString4,
  options: z51.array(zcodeUserInputOptionSchema2).min(1),
  multiSelect: z51.boolean().optional()
}).strict();
var zcodeUserInputRequestParamsSchema2 = z51.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  toolCallId: nonEmptyString4.optional(),
  toolName: nonEmptyString4.optional(),
  prompt: z51.string().optional(),
  questions: z51.array(zcodeUserInputQuestionSchema2).min(1).optional(),
  input: z51.unknown().optional(),
  origin: zcodeInteractionRequestOriginSchema.optional(),
  schema: z51.unknown().optional()
}).strict();
var zcodeUserInputResponseSchema2 = z51.object({
  action: z51.enum(["accept", "decline", "cancel"]),
  content: jsonObjectSchema3.optional(),
  reason: z51.string().optional()
}).strict();
var zcodeProviderRuntimeHeadersRequestReasonSchema2 = z51.enum(["model-request"]);
var zcodeProviderRuntimeHeadersRequestParamsSchema2 = z51.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  turnId: nonEmptyString4.optional(),
  workspace: zcodeWorkspaceRefSchema,
  modelSelection: modelSelectionSchema,
  providerId: nonEmptyString4,
  accountAccess: zcodeProviderAccountAccessSchema2.optional(),
  reason: zcodeProviderRuntimeHeadersRequestReasonSchema2
}).strict();
var zcodeProviderRuntimeHeadersCancelledSchema2 = z51.object({
  requestId: nonEmptyString4,
  sessionId: nonEmptyString4,
  workspace: zcodeWorkspaceRefSchema
}).strict();
var zcodeProviderRuntimeHeadersResponseSchema2 = z51.discriminatedUnion("headersApplied", [
  z51.object({
    headersApplied: z51.literal(true),
    // 合并重接：成功必须携带当前请求的鉴权材料，不依赖旧 Registry 已被写入。
    requestAuth: z51.object({
      apiKey: nonEmptyString4.optional(),
      headers: z51.record(nonEmptyString4, nonEmptyString4).optional()
    }).strict(),
    errorMessage: nonEmptyString4.optional()
  }).strict(),
  z51.object({
    headersApplied: z51.literal(false),
    errorMessage: nonEmptyString4.optional()
  }).strict()
]);
var zcodeOfficialMcpAuthHeadersRequestParamsSchema2 = z51.object({
  requestId: nonEmptyString4,
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4,
  mcpKey: nonEmptyString4,
  targetOrigin: nonEmptyString4
}).strict();
var zcodeOfficialMcpAuthFailureReasonSchema2 = z51.enum(
  OFFICIAL_MCP_AUTH_PORT_FAILURE_REASONS
);
var zcodeOfficialMcpAuthHeadersResponseSchema2 = z51.discriminatedUnion("ok", [
  z51.object({
    ok: z51.literal(true),
    headers: z51.record(z51.string(), z51.string())
  }).strict(),
  z51.object({
    ok: z51.literal(false),
    reason: zcodeOfficialMcpAuthFailureReasonSchema2
  }).strict()
]);
var zcodePluginOptionValueSchema2 = z51.union([z51.string(), z51.number(), z51.boolean()]);
var zcodePluginScopeSchema2 = z51.enum(["user", "workspace"]);
var zcodePluginHookDetailSchema2 = z51.object({
  event: nonEmptyString4,
  matcher: z51.string().optional(),
  type: z51.enum(["command", "process"]),
  command: nonEmptyString4,
  args: z51.array(z51.string()).optional(),
  async: z51.boolean().optional(),
  shell: z51.union([z51.literal(true), z51.string()]).optional(),
  timeout: z51.number().positive().optional(),
  timeoutMs: z51.number().int().positive().optional(),
  statusMessage: z51.string().optional(),
  sourcePath: z51.string(),
  runnable: z51.boolean()
}).strict();
var zcodePluginUserConfigOptionSchema2 = z51.object({
  default: zcodePluginOptionValueSchema2.optional(),
  description: z51.string().optional(),
  required: z51.boolean().optional(),
  sensitive: z51.boolean().optional(),
  title: z51.string().optional(),
  type: z51.enum(["string", "number", "boolean", "directory", "file"]).optional()
}).strict();
var zcodePluginComponentKindSchema2 = z51.enum(["agent", "command", "skill", "hook", "mcp"]);
var zcodePluginComponentItemSchema2 = z51.object({
  name: nonEmptyString4,
  // 描述来自组件 frontmatter（SKILL.md / command / agent）或 manifest；缺失时省略，不伪造。
  description: z51.string().optional()
}).strict();
var zcodePluginComponentGroupSchema2 = z51.object({
  kind: zcodePluginComponentKindSchema2,
  items: z51.array(zcodePluginComponentItemSchema2)
}).strict();
var zcodePluginInfoSchema2 = z51.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  description: z51.string().optional(),
  version: z51.string().optional(),
  enabled: z51.boolean(),
  source: nonEmptyString4,
  marketplace: nonEmptyString4,
  // manifest（plugin.json）的作者/主页回退字段；商店 listing 缺失时详情页信息区用它兜底。
  author: z51.string().optional(),
  authorUrl: z51.string().optional(),
  homepage: z51.string().optional(),
  skillCount: z51.number().int().nonnegative().optional(),
  skillRootCount: z51.number().int().nonnegative(),
  commandRootCount: z51.number().int().nonnegative(),
  // 权威组件清单（名称 + 可选描述），由 CLI 对插件根目录枚举得出，与启用态无关。
  // 详情 UI 直接展示，取代旧的「数量取协议、名称靠 UI 侧 join」脆弱方案。optional 兼容旧 payload。
  components: z51.array(zcodePluginComponentGroupSchema2).optional(),
  declaredMcpServerNames: z51.array(z51.string()).optional(),
  hostMcpServerNames: z51.array(z51.string()).optional(),
  mcpServerNames: z51.array(z51.string()),
  hookDetails: z51.array(zcodePluginHookDetailSchema2).optional(),
  rootPath: z51.string(),
  userConfig: z51.record(z51.string(), zcodePluginUserConfigOptionSchema2).optional(),
  configuredOptions: z51.record(z51.string(), zcodePluginOptionValueSchema2).optional(),
  // 缺省表示 package 可用；missing 用于保留已声明但目标 Host 尚未物化的配置行。
  packageStatus: z51.literal("missing").optional(),
  rootSource: zcodePluginScopeSchema2.optional(),
  enabledSource: zcodePluginScopeSchema2.optional(),
  optionSources: z51.record(z51.string(), zcodePluginScopeSchema2).optional()
}).strict();
var zcodePluginDiagnosticSchema2 = z51.object({
  code: z51.string(),
  message: z51.string(),
  severity: z51.enum(["warning", "error"]).optional(),
  pluginId: z51.string().optional()
}).strict();
var zcodePluginsListParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  configScope: zcodePluginScopeSchema2.optional()
}).strict();
var zcodePluginsListResultSchema2 = z51.object({
  plugins: z51.array(zcodePluginInfoSchema2),
  diagnostics: z51.array(zcodePluginDiagnosticSchema2)
}).strict();
var zcodePluginReferenceCatalogEntrySchema2 = z51.object({
  // 仅 referenceCatalogWithCategory 返回；旧入口保持原结构。
  category: nonEmptyString4.optional(),
  pluginId: nonEmptyString4,
  name: nonEmptyString4,
  marketplace: nonEmptyString4,
  icon: z51.string().optional(),
  // 商店 listing 的 display-only 本地化显示名投影（沿 icon 先例）：让 Picker 能按
  // 中文显示名搜索/展示；locale 解析复用 shared 的 plugin-display-name helper。
  displayName: z51.string().optional(),
  displayNameI18n: z51.record(z51.string(), z51.string()).optional(),
  // 仅供 Picker 展示，不进入能力身份或 model-only reminder。
  description: z51.string().optional(),
  descriptionI18n: z51.record(z51.string(), z51.string()).optional(),
  enabled: z51.boolean(),
  // 非空 = 与其他 enabled Plugin 共享 manifest name 的 V1 fail closed 冲突：
  // Picker 禁选并展示原因，runtime 解析按 ambiguous 跳过。
  conflictingPluginIds: z51.array(nonEmptyString4),
  skillQualifiedNames: z51.array(nonEmptyString4),
  mcpServerNames: z51.array(nonEmptyString4),
  // 旧 Host 不投影该字段时按空数组兼容；只有新 Agent 会把它用于 reminder live 交集。
  subagentNames: z51.array(nonEmptyString4).default([])
}).strict();
var zcodePluginsReferenceCatalogParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  // 已有 Session 的 Picker 必须带 sessionId 才能拿到 session-owned catalog；
  // session 不存在时按协议错误 fail closed，禁止静默回退 workspace authority。
  sessionId: nonEmptyString4.optional()
}).strict();
var zcodePluginsReferenceCatalogResultSchema2 = z51.object({
  authority: z51.enum(["session", "workspace"]),
  plugins: z51.array(zcodePluginReferenceCatalogEntrySchema2)
}).strict();
var zcodeSkillReferenceCatalogEntrySchema2 = z51.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  description: z51.string(),
  path: nonEmptyString4,
  scope: z51.enum(["workspace", "user", "plugin"]),
  enabled: z51.literal(true),
  pluginName: nonEmptyString4.optional()
}).strict();
var zcodeSkillsReferenceCatalogParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  // 带 sessionId 时必须命中该进程内的 resident Session；未知 Session fail closed，
  // 禁止回退到 workspace 当前目录而把新 Skill 泄漏进旧对话。
  sessionId: nonEmptyString4.optional()
}).strict();
var zcodeSkillsReferenceCatalogResultSchema2 = z51.object({
  authority: z51.enum(["session", "workspace"]),
  skills: z51.array(zcodeSkillReferenceCatalogEntrySchema2)
}).strict();
var zcodeSavedWorkflowArgTypeSchema2 = z51.enum(["string", "number", "boolean", "json"]);
var zcodeSavedWorkflowArgDeclarationSchema2 = z51.object({
  type: zcodeSavedWorkflowArgTypeSchema2,
  description: z51.string().optional(),
  required: z51.boolean().optional(),
  default: z51.unknown().optional()
}).strict();
var zcodeSavedWorkflowArgsDeclarationSchema2 = z51.record(
  z51.string(),
  zcodeSavedWorkflowArgDeclarationSchema2
);
var zcodeSavedWorkflowMetaSchema2 = z51.object({
  description: nonEmptyString4,
  whenToUse: nonEmptyString4.optional(),
  args: zcodeSavedWorkflowArgsDeclarationSchema2.optional()
}).strict();
var zcodeSavedWorkflowScopeSchema2 = z51.enum(["project", "global"]);
var zcodeSavedWorkflowEntrySchema2 = z51.object({
  name: nonEmptyString4,
  description: z51.string(),
  whenToUse: z51.string().optional(),
  args: zcodeSavedWorkflowArgsDeclarationSchema2.optional(),
  scope: zcodeSavedWorkflowScopeSchema2,
  path: nonEmptyString4
}).strict();
var zcodeSavedWorkflowInvalidEntrySchema2 = z51.object({ path: nonEmptyString4, reason: nonEmptyString4 }).strict();
var zcodeSavedWorkflowFailureReasonSchema2 = z51.enum([
  "invalid_name",
  "not_found",
  "parse_error",
  "read_error"
]);
var zcodeSavedWorkflowFailureSchema2 = z51.object({
  ok: z51.literal(false),
  reason: zcodeSavedWorkflowFailureReasonSchema2,
  detail: z51.string().optional()
}).strict();
var zcodeWorkflowsListParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  // 缺省即 `project`（本项目档）。给 `global` 时改扫本机 `~/.zcode/workflows/`；此时 `workspace`
  // 仍必填，但只是**载体运行时**——协议处理器对全局档不读它的路径。
  scope: zcodeSavedWorkflowScopeSchema2.optional()
}).strict();
var zcodeWorkflowsListResultSchema2 = z51.object({
  workflows: z51.array(zcodeSavedWorkflowEntrySchema2),
  invalid: z51.array(zcodeSavedWorkflowInvalidEntrySchema2),
  // 扫过的目录（本地绝对路径），即使目录还不存在也回：GUI 的文件监听靠它 watch。
  dir: nonEmptyString4
}).strict();
var zcodeWorkflowsGetParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString4,
  // 缺省 `project`；`global` 时只查本机全局根。`workspace` 语义同 list（全局档只当载体）。
  scope: zcodeSavedWorkflowScopeSchema2.optional()
}).strict();
var zcodeWorkflowsGetResultSchema2 = z51.union([
  z51.object({
    ok: z51.literal(true),
    name: nonEmptyString4,
    path: nonEmptyString4,
    scope: zcodeSavedWorkflowScopeSchema2,
    meta: zcodeSavedWorkflowMetaSchema2,
    /** 脚本本体（frontmatter 之后逐字节），即被类型检查与执行的那一份。 */
    script: z51.string()
  }).strict(),
  zcodeSavedWorkflowFailureSchema2
]);
var zcodeWorkflowsUpdateMetaParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString4,
  meta: zcodeSavedWorkflowMetaSchema2,
  // 缺省 `project`；`global` 时只写本机全局根那一份。`workspace` 语义同 list。
  scope: zcodeSavedWorkflowScopeSchema2.optional()
}).strict();
var zcodeWorkflowsUpdateMetaResultSchema2 = z51.union([
  z51.object({ ok: z51.literal(true), path: nonEmptyString4 }).strict(),
  zcodeSavedWorkflowFailureSchema2
]);
var zcodeWorkflowsDeleteParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString4,
  // 缺省 `project`；`global` 时按 scope 选根删除（不再写死 roots[0]）。`workspace` 语义同 list。
  scope: zcodeSavedWorkflowScopeSchema2.optional()
}).strict();
var zcodeWorkflowsDeleteResultSchema2 = z51.union([
  z51.object({ ok: z51.literal(true), path: nonEmptyString4 }).strict(),
  zcodeSavedWorkflowFailureSchema2
]);
var ZCODE_WORKFLOWS_RUNS_MAX_LIMIT2 = 50;
var zcodeWorkflowsRunsParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  /** 只要这个名字的 run（`dwf_run.name` 字面等值）；缺省即本项目全部 run。 */
  name: nonEmptyString4.optional(),
  limit: z51.number().int().min(1).max(ZCODE_WORKFLOWS_RUNS_MAX_LIMIT2),
  // 缺省 `project`：只查 `dwf_run.cwd === workspacePath` 的 run。`global` 时**不**按 cwd 过滤，
  // 跨所有项目取该名字的运行历史（全局工作流在任何项目里跑，历史因此跨 cwd）；结果行带 `cwd`
  // 供 GUI 标项目。`workspace` 语义同 list（全局档只当载体）。
  scope: zcodeSavedWorkflowScopeSchema2.optional()
}).strict();
var zcodeSavedWorkflowRunStatusSchema2 = z51.enum([
  "pending",
  "running",
  "completed",
  "errored",
  "stopped"
]);
var zcodeSavedWorkflowRunStopReasonSchema2 = z51.enum([
  "user",
  "model",
  "provider",
  "interrupted",
  "superseded"
]);
var zcodeSavedWorkflowRunSchema2 = z51.object({
  runId: nonEmptyString4,
  name: z51.string().optional(),
  status: zcodeSavedWorkflowRunStatusSchema2,
  // `status === "stopped"` 才在场。
  stopReason: zcodeSavedWorkflowRunStopReasonSchema2.optional(),
  createdAt: z51.number(),
  updatedAt: z51.number(),
  spentTokens: z51.number(),
  /** 发起它的会话与 CreateWorkflow 工具调用：有这两个才能从中枢打开实例详情。老行可缺。 */
  parentSessionId: z51.string().optional(),
  toolCallId: z51.string().optional(),
  args: z51.record(z51.string(), z51.unknown()).optional(),
  // 实际运行的项目目录（`dwf_run.cwd`）。全局档的 `workflows/runs` 跨 cwd 查询，GUI 用它给
  // 每行标项目；项目档变体里它恒等于 workspacePath，GUI 可忽略。老行可缺。
  cwd: z51.string().optional(),
  // 这次运行发布的**用户面产物**：中枢的运行历史行在
  // 状态词之后画一串 kind chips，详情页头部的「最近产物」条取最近一次 completed run 的这一份。
  // ⚠ 术语：这里的 artifact 是脚本经 `artifact.*` 发布给用户看的产出，不是脚本的顶层返回值。
  // 只带 chip 画得下的字段（≤ 8 件，取最新版的元数据）；字节与条目经 v4 查询按需读。
  // optional，照上面 `cwd` 的先例：老 CLI 不发，少一个键是退化不是错误。
  artifacts: z51.array(
    z51.object({
      id: nonEmptyString4,
      kind: z51.enum(["file", "markdown", "chart", "table", "metrics", "board"]),
      title: z51.string().optional(),
      version: z51.number(),
      contentType: z51.string().optional()
    }).strict()
  ).max(8).optional()
}).strict();
var zcodeWorkflowsRunsResultSchema2 = z51.object({
  runs: z51.array(zcodeSavedWorkflowRunSchema2),
  /** 为真时才在场：还有更多 run 没进这一页（多取一条判定，不是 length === limit）。 */
  truncated: z51.literal(true).optional()
}).strict();
var zcodeWorkflowsMoveParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  name: nonEmptyString4
}).strict();
var zcodeWorkflowsMoveResultSchema2 = z51.union([
  z51.object({
    ok: z51.literal(true),
    /** 源落点路径（全局根，搬走前）。 */
    from: nonEmptyString4,
    /** 目标落点路径（项目根，搬到处）。 */
    to: nonEmptyString4
  }).strict(),
  z51.object({
    ok: z51.literal(false),
    // target_exists：目标档已有同名（move 不覆盖）；not_found：源档没有这个名字；
    // read_error / write_error：搬运时的 I/O 失败；invalid_name：名字先验没过。
    reason: z51.enum(["invalid_name", "not_found", "target_exists", "read_error", "write_error"]),
    path: z51.string().optional(),
    detail: z51.string().optional()
  }).strict()
]);
var zcodePluginSuggestedReferenceStatusSchema2 = z51.enum([
  "ready",
  "disabled",
  "missing",
  "conflict",
  "unavailable"
]);
var zcodePluginOperationStateSchema2 = z51.enum([
  "checking",
  "refreshing",
  "installing",
  "enabling",
  "cancelling",
  "cancelled",
  "complete",
  "failed"
]);
var zcodePluginOperationProgressNotificationSchema2 = z51.object({
  operationId: nonEmptyString4,
  state: z51.literal("refreshing")
}).strict();
var zcodePluginsResolveSuggestedReferenceParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  stableId: nonEmptyString4,
  operationId: nonEmptyString4,
  clientMode: zcodeDeliveryKindSchema,
  deliveryKind: zcodeDeliveryKindSchema
}).strict();
var zcodePluginsSetEnabledParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4,
  enabled: z51.boolean(),
  operationId: nonEmptyString4.optional(),
  scope: zcodePluginScopeSchema2.optional()
}).strict();
var zcodePluginsSetEnabledResultSchema2 = z51.object({
  plugin: zcodePluginInfoSchema2,
  enabled: z51.boolean()
}).strict();
var zcodePluginStoreListingSchema2 = z51.object({
  displayName: z51.string().optional(),
  displayNameI18n: z51.record(z51.string(), z51.string()).optional(),
  descriptionI18n: z51.record(z51.string(), z51.string()).optional(),
  icon: z51.string().optional(),
  category: z51.string().optional(),
  author: z51.string().optional(),
  authorUrl: z51.string().optional(),
  homepage: z51.string().optional(),
  privacyPolicy: z51.string().optional(),
  termsOfService: z51.string().optional(),
  heroImage: z51.string().optional(),
  examplePrompts: z51.array(z51.string()).optional(),
  examplePromptsI18n: z51.record(z51.string(), z51.array(z51.string())).optional(),
  /**
   * 需要付费套餐才好用的插件：市场目录条目声明 `requiresPaidPlan: true`，
   * UI 在标题右侧展示提示图标。描述的是「使用条件」而非「插件是收费商品」——
   * 不参与安装门禁与计费，命名也不绑定具体套餐商品名。
   */
  requiresPaidPlan: z51.boolean().optional()
}).strict();
var zcodePluginsResolveSuggestedReferenceResultSchema2 = z51.object({
  stableId: nonEmptyString4,
  status: zcodePluginSuggestedReferenceStatusSchema2,
  marketplace: nonEmptyString4.optional(),
  pluginName: nonEmptyString4.optional(),
  sourceTrust: z51.literal("official").optional(),
  // 官方 Marketplace listing 的可选展示投影；不参与身份、安装或权限判断。
  icon: z51.string().optional(),
  listing: zcodePluginStoreListingSchema2.optional(),
  diagnostics: z51.array(zcodePluginDiagnosticSchema2)
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
var zcodePluginMarketplaceSummarySchema2 = z51.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  source: jsonObjectSchema3,
  description: z51.string().optional(),
  lastUpdated: z51.string().optional(),
  pluginCount: z51.number().int().nonnegative(),
  isOfficial: z51.boolean().optional(),
  // 目录顶层 featured 策展名单（商店「公开」分段 Featured 区）。
  featured: z51.array(z51.string()).optional(),
  refreshFailure: z51.object({
    code: z51.string(),
    failedAt: z51.string(),
    message: z51.string()
  }).strict().optional()
}).strict();
var zcodeAvailablePluginSummarySchema2 = z51.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  marketplace: nonEmptyString4,
  description: z51.string().optional(),
  version: z51.string().optional(),
  installed: z51.boolean(),
  componentTypes: z51.array(z51.string()).optional(),
  listing: zcodePluginStoreListingSchema2.optional()
}).strict();
var zcodeInstalledPluginSummarySchema2 = z51.object({
  id: nonEmptyString4,
  name: nonEmptyString4,
  marketplace: nonEmptyString4,
  description: z51.string().optional(),
  version: z51.string().optional(),
  enabled: z51.boolean(),
  scope: zcodePluginScopeSchema2,
  installPath: z51.string().optional(),
  installedAt: z51.string().optional(),
  componentTypes: z51.array(z51.string()).optional(),
  hookDetails: z51.array(zcodePluginHookDetailSchema2).optional(),
  updateStatus: z51.enum(["none", "update-available", "version-changed"]).optional(),
  latestVersion: z51.string().optional(),
  listing: zcodePluginStoreListingSchema2.optional()
}).strict();
var zcodePluginsOverviewParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  configScope: zcodePluginScopeSchema2.optional()
}).strict();
var zcodePluginsOverviewResultSchema2 = z51.object({
  marketplaces: z51.array(zcodePluginMarketplaceSummarySchema2),
  availablePlugins: z51.array(zcodeAvailablePluginSummarySchema2),
  installedPlugins: z51.array(zcodeInstalledPluginSummarySchema2),
  restorableBuiltins: z51.array(zcodeAvailablePluginSummarySchema2),
  diagnostics: z51.array(zcodePluginDiagnosticSchema2),
  capability: z51.object({
    supported: z51.boolean(),
    reason: z51.string().optional()
  }).strict()
}).strict();
var zcodePluginsMarketplaceAddParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  source: nonEmptyString4,
  dryRun: z51.boolean().optional(),
  operationId: nonEmptyString4.optional()
}).strict();
var zcodePluginsMarketplaceRemoveParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  marketplace: nonEmptyString4
}).strict();
var zcodePluginsMarketplaceUpdateParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  marketplace: nonEmptyString4.optional(),
  operationId: nonEmptyString4.optional()
}).strict();
var zcodePluginsMarketplaceMutationResultSchema2 = z51.object({
  marketplace: zcodePluginMarketplaceSummarySchema2.optional(),
  marketplaces: z51.array(zcodePluginMarketplaceSummarySchema2).optional(),
  diagnostics: z51.array(zcodePluginDiagnosticSchema2).optional()
}).strict();
var zcodePluginsInstallParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginName: nonEmptyString4,
  marketplace: nonEmptyString4,
  scope: zcodePluginScopeSchema2.optional(),
  dryRun: z51.boolean().optional(),
  operationId: nonEmptyString4.optional()
}).strict();
var zcodePluginsCancelOperationParamsSchema2 = z51.object({
  operationId: nonEmptyString4
}).strict();
var zcodePluginsCancelOperationResultSchema2 = z51.object({
  operationId: nonEmptyString4,
  cancelled: z51.boolean()
}).strict();
var zcodePluginsUninstallParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4.optional(),
  pluginName: nonEmptyString4.optional(),
  marketplace: nonEmptyString4.optional(),
  removeCache: z51.boolean().optional()
}).strict();
var zcodePluginsInstallResultSchema2 = z51.object({
  installedPlugins: z51.array(zcodeInstalledPluginSummarySchema2),
  dependencyClosure: z51.array(z51.string()),
  diagnostics: z51.array(zcodePluginDiagnosticSchema2)
}).strict();
var zcodePluginsUninstallResultSchema2 = z51.object({
  removedPlugin: zcodeInstalledPluginSummarySchema2.optional(),
  diagnostics: z51.array(zcodePluginDiagnosticSchema2)
}).strict();
var zcodePluginsUpdateParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4.optional(),
  marketplace: nonEmptyString4.optional()
}).strict();
var zcodePluginsRestoreBuiltinParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4
}).strict();
var zcodePluginsRestoreBuiltinResultSchema2 = z51.object({
  pluginId: nonEmptyString4,
  diagnostics: z51.array(zcodePluginDiagnosticSchema2)
}).strict();
var zcodePluginsConfigureParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4,
  options: jsonObjectSchema3,
  clearOptionKeys: z51.array(nonEmptyString4).optional(),
  scope: zcodePluginScopeSchema2.optional(),
  dryRun: z51.boolean().optional()
}).strict();
var zcodePluginsConfigureResultSchema2 = z51.object({
  pluginId: nonEmptyString4,
  diagnostics: z51.array(zcodePluginDiagnosticSchema2)
}).strict();
var zcodePluginsResetConfigParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginId: nonEmptyString4,
  scope: zcodePluginScopeSchema2.optional()
}).strict();
var zcodePluginsValidateParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginName: nonEmptyString4.optional(),
  marketplace: nonEmptyString4.optional(),
  source: nonEmptyString4.optional()
}).strict();
var zcodePluginsValidateResultSchema2 = z51.object({
  ok: z51.boolean(),
  diagnostics: z51.array(zcodePluginDiagnosticSchema2),
  compatibility: z51.object({
    runnable: z51.array(z51.string()),
    diagnosticOnly: z51.array(z51.string()),
    unsupported: z51.array(z51.string())
  }).strict()
}).strict();
var zcodePluginsDescribeParamsSchema2 = z51.object({
  workspace: zcodeWorkspaceRefSchema,
  pluginName: nonEmptyString4,
  marketplace: nonEmptyString4
}).strict();
var zcodePluginsDescribeResultSchema2 = z51.object({
  components: z51.array(zcodePluginComponentGroupSchema2),
  diagnostics: z51.array(zcodePluginDiagnosticSchema2).optional(),
  // 插件包内 plugin.json 的展示性回退字段；未安装候选详情页信息区在商店 listing 缺失时兜底。
  metadata: z51.object({
    author: z51.string().optional(),
    authorUrl: z51.string().optional(),
    homepage: z51.string().optional(),
    version: z51.string().optional()
  }).strict().optional()
}).strict();
var zcodeAutomationScheduleRuleSchema2 = z51.object({
  unit: z51.enum(["minute", "hourly", "daily", "weekly", "monthly", "yearly"]),
  interval: z51.number().int().positive(),
  hour: z51.number().int().min(0).max(23),
  minute: z51.number().int().min(0).max(59),
  anchorAt: z51.number().int(),
  weekdays: z51.array(z51.number().int().min(0).max(6)).optional(),
  monthDays: z51.array(z51.number().int().min(1).max(31)).optional(),
  /** yearly 用：1-12 人类月份。缺省回退 anchorAt 的月份（兼容未写该字段的旧记录）。 */
  months: z51.array(z51.number().int().min(1).max(12)).optional(),
  monthlyMode: z51.enum(["date", "weekday"]).optional()
}).strict();
var zcodeAutomationIntervalUnitSchema2 = z51.enum([
  "minute",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly"
]);
var zcodeAutomationProtocolSchema2 = z51.object({
  automationId: nonEmptyString4,
  title: z51.string(),
  cronExpr: nonEmptyString4,
  prompt: nonEmptyString4,
  modelSelection: modelSelectionSchema.optional(),
  mode: zcodeTaskModeSchema.optional(),
  targetTaskId: nonEmptyString4.optional(),
  enabled: z51.boolean(),
  lifecycleStatus: z51.enum(["active", "completed", "failed", "paused"]),
  nextRunAt: timestampMsSchema3.optional(),
  lastRunAt: timestampMsSchema3.optional(),
  runCount: z51.number().int().nonnegative(),
  recurring: z51.boolean(),
  maxRuns: z51.number().int().positive().optional(),
  // 自定义重复规则；缺省时调度回退到解析 cronExpr。会话卡片必须读到本字段才能展示
  // cron 无法表达的真实间隔（如每50小时、每40天，兼容 cronExpr 只是 0 * * * *）。
  scheduleRule: zcodeAutomationScheduleRuleSchema2.optional()
}).strict();
var zcodeAutomationCreateParamsSchema2 = z51.object({
  title: z51.string().optional(),
  cronExpr: nonEmptyString4,
  relativeDelayMinutes: z51.number().int().positive().max(525600).optional(),
  prompt: nonEmptyString4,
  modelSelection: modelSelectionSchema.optional(),
  mode: zcodeTaskModeSchema.optional(),
  targetTaskId: nonEmptyString4.optional(),
  botDeliveryTarget: zcodeAutomationBotDeliveryTargetSchema.optional(),
  recurring: z51.boolean().optional(),
  maxRuns: z51.number().int().positive().optional(),
  // 会话侧自定义重复 carrier：每 N 分钟/小时/天/周/月/年均通过此字段归一化为权威 scheduleRule，
  // cronExpr 仅作合法兼容展示。
  intervalUnit: zcodeAutomationIntervalUnitSchema2.optional(),
  interval: z51.number().int().min(1).max(200).optional()
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
var zcodeAutomationCreateResultSchema2 = z51.object({ automation: zcodeAutomationProtocolSchema2 }).strict();
var zcodeAutomationUpdateParamsSchema2 = z51.object({
  automationId: nonEmptyString4,
  title: nonEmptyString4.optional(),
  cronExpr: nonEmptyString4.optional(),
  prompt: nonEmptyString4.optional(),
  recurring: z51.boolean().optional(),
  maxRuns: z51.number().int().positive().nullable().optional(),
  // 会话侧自定义重复 carrier（同 create 侧语义）。
  intervalUnit: zcodeAutomationIntervalUnitSchema2.optional(),
  interval: z51.number().int().min(1).max(200).optional()
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
var zcodeAutomationUpdateResultSchema2 = z51.object({ automation: zcodeAutomationProtocolSchema2 }).strict();
var zcodeAutomationListParamsSchema2 = z51.object({}).strict();
var zcodeAutomationListResultSchema2 = z51.object({ automations: z51.array(zcodeAutomationProtocolSchema2) }).strict();
var zcodeAutomationCheckTaskBindingParamsSchema2 = z51.object({ targetTaskId: nonEmptyString4 }).strict();
var zcodeAutomationCheckTaskBindingResultSchema2 = z51.object({ bound: z51.boolean() }).strict();
var zcodeAutomationDeleteParamsSchema2 = z51.object({ automationId: nonEmptyString4 }).strict();
var zcodeAutomationDeleteResultSchema2 = z51.object({ deleted: z51.boolean() }).strict();
var zcodeOffPeakPermissionModeSchema2 = z51.enum(["build", "edit", "plan", "yolo"]);
var zcodeOffPeakCreateParamsSchema2 = z51.object({
  title: nonEmptyString4,
  prompt: nonEmptyString4,
  permissionMode: zcodeOffPeakPermissionModeSchema2.optional(),
  model: nonEmptyString4.optional(),
  thoughtLevel: nonEmptyString4.optional(),
  // 会话内创建绑定当前会话（对齐 automation/create 的 targetTaskId），由 CLI 端口填入。
  boundSessionId: nonEmptyString4.optional()
}).strict();
var zcodeOffPeakTaskSnapshotSchema2 = z51.object({
  offPeakTaskId: nonEmptyString4,
  title: z51.string(),
  status: z51.enum(["queued", "paused", "running", "completed", "failed", "cancelled"]),
  queuePosition: z51.number().int().positive().optional(),
  sessionId: nonEmptyString4.optional(),
  createdAt: z51.number().int().nonnegative()
}).strict();
var zcodeOffPeakCreateResultSchema2 = z51.discriminatedUnion("ok", [
  z51.object({ ok: z51.literal(true), task: zcodeOffPeakTaskSnapshotSchema2 }).strict(),
  z51.object({
    ok: z51.literal(false),
    failureStage: z51.enum(["client_validation", "ticket_request", "local_persist"]),
    errorCategory: z51.enum([
      "client_validation",
      "eligibility_3101",
      "quota_3103",
      "network",
      "invalid_response",
      "local_persist",
      "unknown"
    ]),
    errorCode: z51.string()
  }).strict()
]);
var zcodeOffPeakListParamsSchema2 = z51.object({}).strict();
var zcodeOffPeakListResultSchema2 = z51.object({ tasks: z51.array(zcodeOffPeakTaskSnapshotSchema2) }).strict();
var zcodeProtocolMethods2 = {
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
var zcodeProtocolEmptyResultSchema2 = z51.object({}).strict();
var zcodeProtocolSessionMethodContracts2 = {
  [zcodeProtocolMethods2.workspaceHookTrustGrant]: {
    params: zcodeWorkspaceHookTrustGrantParamsSchema2,
    result: zcodeWorkspaceHookTrustGrantResultSchema2
  },
  [zcodeProtocolMethods2.mcpList]: {
    params: zcodeMcpListParamsSchema2,
    result: zcodeMcpListResultSchema2
  },
  [zcodeProtocolMethods2.interactionBrowserList]: {
    params: zcodeBrowserListParamsSchema2,
    result: zcodeBrowserListResultSchema2
  },
  [zcodeProtocolMethods2.interactionBrowserExecute]: {
    params: zcodeBrowserExecuteParamsSchema2,
    result: zcodeBrowserExecuteResultSchema2
  }
};
var zcodeStoragePreparationFrameSchema2 = z51.discriminatedUnion("method", [
  z51.object({
    method: z51.literal("startup/storagePath"),
    params: z51.object({ path: z51.string().min(1).max(32768) }).strict()
  }).strict(),
  z51.object({ method: z51.literal("startup/storagePrepared"), params: z51.object({}).strict() }).strict(),
  z51.object({ method: z51.literal("startup/storageState"), params: zcodeStorageStartupStateSchema2 }).strict()
]);
var zcodeStoragePathReadySchema2 = z51.object({ method: z51.literal("startup/storagePathReady"), reuse: z51.boolean().optional() }).strict();

// ../reference/ZCode/packages/shared/src/background-bash-output.ts
import { z as z52 } from "zod";
var BACKGROUND_BASH_OUTPUT_MAX_BYTES2 = 8192;
var backgroundBashOutputSchema2 = z52.strictObject({
  kind: z52.literal("output"),
  workId: z52.string().min(1),
  status: z52.enum(["running", "completed", "failed", "timed_out", "cancelled", "spawn_error"]),
  output: z52.string().max(BACKGROUND_BASH_OUTPUT_MAX_BYTES2),
  truncated: z52.boolean(),
  outputPath: z52.string().min(1)
});
var backgroundBashOutputResultSchema2 = z52.union([
  backgroundBashOutputSchema2,
  z52.strictObject({
    kind: z52.enum(["unavailable", "unsupported", "read_failed"]),
    workId: z52.string().min(1),
    code: z52.string().optional()
  })
]);

// ../reference/ZCode/packages/shared/src/zcode-protocol-v4/workflow-workspace.ts
import { z as z53 } from "zod";
var WORKFLOW_WORKSPACE_LIMITS = {
  /** 一次清单最多多少行；超界由网关截尾并置 `truncated`。 */
  maxNodes: 2e3,
  /** `op` 名的长度（`git-changed-files` 是最长的那个）。 */
  maxOpLength: 32,
  /** 实参个数（引擎侧截断后 ≤ 8；未截断的原值按 facade 签名 ≤ 3）。 */
  maxArgs: 16,
  /** 失败信息的展示长度；超长由宿主切尾。 */
  maxErrorMessageLength: 2e3,
  /** 正文一次最多读回多少字节（截断而不是拒绝——这是审计面，不是脚本的取数面）。 */
  resultMaxBytes: 32 * 1024
};
var workflowRunWorkspaceNodeKindSchema = z53.enum(["world-read", "world-run"]);
var workflowRunWorkspaceNodeStatusSchema = z53.enum(["running", "completed", "failed"]);
var workflowRunWorkspaceNodeErrorSchema = z53.object({
  code: z53.string().min(1).max(64),
  message: z53.string().max(WORKFLOW_WORKSPACE_LIMITS.maxErrorMessageLength)
}).strict();
var workflowRunWorkspaceNodeSummarySchema = z53.object({
  resultBytes: z53.number().int().nonnegative(),
  resultCount: z53.number().int().nonnegative().optional(),
  exitCode: z53.number().int().optional(),
  stdoutBytes: z53.number().int().nonnegative().optional(),
  stderrBytes: z53.number().int().nonnegative().optional()
}).strict();
var workflowRunWorkspaceNodeSchema = z53.object({
  siteId: z53.string().min(1).max(64),
  ordinal: z53.number().int().nonnegative(),
  kind: workflowRunWorkspaceNodeKindSchema,
  op: z53.string().min(1).max(WORKFLOW_WORKSPACE_LIMITS.maxOpLength).optional(),
  args: z53.array(z53.unknown()).max(WORKFLOW_WORKSPACE_LIMITS.maxArgs).optional(),
  inputTruncated: z53.literal(true).optional(),
  status: workflowRunWorkspaceNodeStatusSchema,
  error: workflowRunWorkspaceNodeErrorSchema.optional(),
  summary: workflowRunWorkspaceNodeSummarySchema.optional(),
  /** journal 行的建立 / 最近更新时刻（epoch 毫秒）；二者之差就是这一步的耗时。 */
  createdAt: z53.number().int().nonnegative(),
  updatedAt: z53.number().int().nonnegative()
}).strict();
var v4ConversationWorkflowRunWorkspaceParamsSchema = z53.object({
  sessionId: z53.string().min(1),
  runId: z53.string().min(1)
}).strict();
var v4ConversationWorkflowRunWorkspaceResultSchema = z53.object({
  /** 按落库先后（journal 行 id 升序 = 引擎准入顺序）。 */
  nodes: z53.array(workflowRunWorkspaceNodeSchema).max(WORKFLOW_WORKSPACE_LIMITS.maxNodes),
  /** 清单超过 maxNodes 被截尾。 */
  truncated: z53.boolean().optional()
}).strict();
var v4ConversationWorkflowRunNodeResultParamsSchema = z53.object({
  sessionId: z53.string().min(1),
  runId: z53.string().min(1),
  siteId: z53.string().min(1).max(64),
  ordinal: z53.number().int().nonnegative(),
  /** 缺省与上限都是 resultMaxBytes；网关钳制。 */
  maxBytes: z53.number().int().positive().max(WORKFLOW_WORKSPACE_LIMITS.resultMaxBytes).optional()
}).strict();
var v4ConversationWorkflowRunNodeResultResultSchema = z53.object({
  status: workflowRunWorkspaceNodeStatusSchema,
  /** 有界化后的正文；running 行与 failed 行缺席。 */
  result: z53.unknown().optional(),
  error: workflowRunWorkspaceNodeErrorSchema.optional(),
  truncated: z53.boolean(),
  /** 截断前的序列化字节数。 */
  totalBytes: z53.number().int().nonnegative()
}).strict();
export {
  COMMANDS_REQUIRING_BASE_REVISION,
  PROTOCOL_V4_LIMITS,
  ROW_TARGETING_COMMANDS,
  TopicWireFrameAssembler,
  applyConversationDeltas,
  attachmentRefSchema,
  backgroundBashOutputResultSchema2 as backgroundBashOutputResultSchema,
  backgroundBashOutputSchema2 as backgroundBashOutputSchema,
  clientHelloSchema,
  commandAckSchema,
  commandsQueryResultSchema,
  conversationTopicFrameSchema,
  conversationTopicWireCandidateSchema,
  crc32WireBytes,
  cuaPermissionObservationSchema,
  encodeTopicWireFrames,
  helloMessageSchema,
  measureTopicNotificationEnvelopeBytes,
  parseCommandEnvelope,
  sharedContextImportStateSchema,
  sharedContextRefSchema,
  toolCallCreateWorkflowDisplaySchema,
  v4AttachmentAbortParamsSchema,
  v4AttachmentAbortResultSchema,
  v4AttachmentBeginParamsSchema,
  v4AttachmentBeginResultSchema,
  v4AttachmentChunkParamsSchema,
  v4AttachmentChunkResultSchema,
  v4AttachmentCommitParamsSchema,
  v4AttachmentCommitResultSchema,
  v4AttachmentPreviewSourceParamsSchema,
  v4AttachmentPreviewSourceResultSchema,
  v4AttachmentPutParamsSchema,
  v4AttachmentPutResultSchema,
  v4AttachmentReadParamsSchema,
  v4AttachmentReadResultSchema,
  v4BackgroundBashOutputParamsSchema,
  v4ConversationAttachmentReadParamsSchema,
  v4ConversationAttachmentReadResultSchema,
  v4ConversationAttachmentStatParamsSchema,
  v4ConversationAttachmentStatResultSchema,
  v4ConversationFileChangesParamsSchema,
  v4ConversationFileChangesResultSchema,
  v4ConversationFileRewindPreviewParamsSchema,
  v4ConversationFileRewindPreviewResultSchema,
  v4ConversationResyncParamsSchema,
  v4ConversationResyncResultSchema,
  v4ConversationSubscribeParamsSchema,
  v4ConversationSubscribeResultSchema,
  v4ConversationUnsubscribeParamsSchema,
  v4ConversationWorkflowRunArtifactDataParamsSchema,
  v4ConversationWorkflowRunArtifactDataResultSchema,
  v4ConversationWorkflowRunArtifactReadParamsSchema,
  v4ConversationWorkflowRunArtifactReadResultSchema,
  v4ConversationWorkflowRunArtifactsParamsSchema,
  v4ConversationWorkflowRunArtifactsResultSchema,
  v4ConversationWorkflowRunEventsParamsSchema,
  v4ConversationWorkflowRunEventsResultSchema,
  v4ConversationWorkflowRunNodeResultParamsSchema,
  v4ConversationWorkflowRunNodeResultResultSchema,
  v4ConversationWorkflowRunWorkspaceParamsSchema,
  v4ConversationWorkflowRunWorkspaceResultSchema,
  v4ConversationWorkflowRunsParamsSchema,
  v4ConversationWorkflowRunsResultSchema,
  zcodeAutomationCheckTaskBindingParamsSchema2 as zcodeAutomationCheckTaskBindingParamsSchema,
  zcodeAutomationCheckTaskBindingResultSchema2 as zcodeAutomationCheckTaskBindingResultSchema,
  zcodeAutomationCreateParamsSchema2 as zcodeAutomationCreateParamsSchema,
  zcodeAutomationCreateResultSchema2 as zcodeAutomationCreateResultSchema,
  zcodeAutomationDeleteParamsSchema2 as zcodeAutomationDeleteParamsSchema,
  zcodeAutomationDeleteResultSchema2 as zcodeAutomationDeleteResultSchema,
  zcodeAutomationIntervalUnitSchema2 as zcodeAutomationIntervalUnitSchema,
  zcodeAutomationListParamsSchema2 as zcodeAutomationListParamsSchema,
  zcodeAutomationListResultSchema2 as zcodeAutomationListResultSchema,
  zcodeAutomationProtocolSchema2 as zcodeAutomationProtocolSchema,
  zcodeAutomationScheduleRuleSchema2 as zcodeAutomationScheduleRuleSchema,
  zcodeAutomationUpdateParamsSchema2 as zcodeAutomationUpdateParamsSchema,
  zcodeAutomationUpdateResultSchema2 as zcodeAutomationUpdateResultSchema,
  zcodeBrowserExecuteParamsSchema2 as zcodeBrowserExecuteParamsSchema,
  zcodeBrowserExecuteResultSchema2 as zcodeBrowserExecuteResultSchema,
  zcodeBrowserListParamsSchema2 as zcodeBrowserListParamsSchema,
  zcodeBrowserListResultSchema2 as zcodeBrowserListResultSchema,
  zcodeComputerUseOperationEventSchema2 as zcodeComputerUseOperationEventSchema,
  zcodeMcpListParamsSchema2 as zcodeMcpListParamsSchema,
  zcodeMcpListResultSchema2 as zcodeMcpListResultSchema,
  zcodeOffPeakCreateParamsSchema2 as zcodeOffPeakCreateParamsSchema,
  zcodeOffPeakCreateResultSchema2 as zcodeOffPeakCreateResultSchema,
  zcodeOffPeakListParamsSchema2 as zcodeOffPeakListParamsSchema,
  zcodeOffPeakListResultSchema2 as zcodeOffPeakListResultSchema,
  zcodeOffPeakPermissionModeSchema2 as zcodeOffPeakPermissionModeSchema,
  zcodeOffPeakTaskSnapshotSchema2 as zcodeOffPeakTaskSnapshotSchema,
  zcodePluginInfoSchema2 as zcodePluginInfoSchema,
  zcodePluginOperationProgressNotificationSchema2 as zcodePluginOperationProgressNotificationSchema,
  zcodePluginOperationStateSchema2 as zcodePluginOperationStateSchema,
  zcodePluginsCancelOperationParamsSchema2 as zcodePluginsCancelOperationParamsSchema,
  zcodePluginsCancelOperationResultSchema2 as zcodePluginsCancelOperationResultSchema,
  zcodePluginsConfigureParamsSchema2 as zcodePluginsConfigureParamsSchema,
  zcodePluginsConfigureResultSchema2 as zcodePluginsConfigureResultSchema,
  zcodePluginsDescribeParamsSchema2 as zcodePluginsDescribeParamsSchema,
  zcodePluginsDescribeResultSchema2 as zcodePluginsDescribeResultSchema,
  zcodePluginsInstallParamsSchema2 as zcodePluginsInstallParamsSchema,
  zcodePluginsInstallResultSchema2 as zcodePluginsInstallResultSchema,
  zcodePluginsListParamsSchema2 as zcodePluginsListParamsSchema,
  zcodePluginsListResultSchema2 as zcodePluginsListResultSchema,
  zcodePluginsMarketplaceAddParamsSchema2 as zcodePluginsMarketplaceAddParamsSchema,
  zcodePluginsMarketplaceMutationResultSchema2 as zcodePluginsMarketplaceMutationResultSchema,
  zcodePluginsMarketplaceRemoveParamsSchema2 as zcodePluginsMarketplaceRemoveParamsSchema,
  zcodePluginsMarketplaceUpdateParamsSchema2 as zcodePluginsMarketplaceUpdateParamsSchema,
  zcodePluginsOverviewParamsSchema2 as zcodePluginsOverviewParamsSchema,
  zcodePluginsOverviewResultSchema2 as zcodePluginsOverviewResultSchema,
  zcodePluginsReferenceCatalogParamsSchema2 as zcodePluginsReferenceCatalogParamsSchema,
  zcodePluginsReferenceCatalogResultSchema2 as zcodePluginsReferenceCatalogResultSchema,
  zcodePluginsResetConfigParamsSchema2 as zcodePluginsResetConfigParamsSchema,
  zcodePluginsResolveSuggestedReferenceParamsSchema2 as zcodePluginsResolveSuggestedReferenceParamsSchema,
  zcodePluginsResolveSuggestedReferenceResultSchema2 as zcodePluginsResolveSuggestedReferenceResultSchema,
  zcodePluginsRestoreBuiltinParamsSchema2 as zcodePluginsRestoreBuiltinParamsSchema,
  zcodePluginsRestoreBuiltinResultSchema2 as zcodePluginsRestoreBuiltinResultSchema,
  zcodePluginsSetEnabledParamsSchema2 as zcodePluginsSetEnabledParamsSchema,
  zcodePluginsSetEnabledResultSchema2 as zcodePluginsSetEnabledResultSchema,
  zcodePluginsUninstallParamsSchema2 as zcodePluginsUninstallParamsSchema,
  zcodePluginsUninstallResultSchema2 as zcodePluginsUninstallResultSchema,
  zcodePluginsUpdateParamsSchema2 as zcodePluginsUpdateParamsSchema,
  zcodePluginsValidateParamsSchema2 as zcodePluginsValidateParamsSchema,
  zcodePluginsValidateResultSchema2 as zcodePluginsValidateResultSchema,
  zcodeProcessChildProcessesParamsSchema2 as zcodeProcessChildProcessesParamsSchema,
  zcodeProcessChildProcessesResultSchema2 as zcodeProcessChildProcessesResultSchema,
  zcodeProcessResourceSampleSchema2 as zcodeProcessResourceSampleSchema,
  zcodeProviderTestModelConnectivityParamsSchema2 as zcodeProviderTestModelConnectivityParamsSchema,
  zcodeProviderTestModelConnectivityResultSchema2 as zcodeProviderTestModelConnectivityResultSchema,
  zcodeSessionCancelBackgroundTaskParamsSchema2 as zcodeSessionCancelBackgroundTaskParamsSchema,
  zcodeSessionCancelBackgroundTaskResultSchema2 as zcodeSessionCancelBackgroundTaskResultSchema,
  zcodeSessionSubagentsParamsSchema2 as zcodeSessionSubagentsParamsSchema,
  zcodeSessionSubagentsResultSchema2 as zcodeSessionSubagentsResultSchema,
  zcodeSkillsReferenceCatalogParamsSchema2 as zcodeSkillsReferenceCatalogParamsSchema,
  zcodeSkillsReferenceCatalogResultSchema2 as zcodeSkillsReferenceCatalogResultSchema,
  zcodeTaskTokenUsageParamsSchema2 as zcodeTaskTokenUsageParamsSchema,
  zcodeTaskTokenUsageResultSchema2 as zcodeTaskTokenUsageResultSchema,
  zcodeUsageStatsParamsSchema2 as zcodeUsageStatsParamsSchema,
  zcodeUsageStatsResultSchema,
  zcodeWorkflowsDeleteParamsSchema2 as zcodeWorkflowsDeleteParamsSchema,
  zcodeWorkflowsDeleteResultSchema2 as zcodeWorkflowsDeleteResultSchema,
  zcodeWorkflowsGetParamsSchema2 as zcodeWorkflowsGetParamsSchema,
  zcodeWorkflowsGetResultSchema2 as zcodeWorkflowsGetResultSchema,
  zcodeWorkflowsListParamsSchema2 as zcodeWorkflowsListParamsSchema,
  zcodeWorkflowsListResultSchema2 as zcodeWorkflowsListResultSchema,
  zcodeWorkflowsMoveParamsSchema2 as zcodeWorkflowsMoveParamsSchema,
  zcodeWorkflowsMoveResultSchema2 as zcodeWorkflowsMoveResultSchema,
  zcodeWorkflowsRunsParamsSchema2 as zcodeWorkflowsRunsParamsSchema,
  zcodeWorkflowsRunsResultSchema2 as zcodeWorkflowsRunsResultSchema,
  zcodeWorkflowsUpdateMetaParamsSchema2 as zcodeWorkflowsUpdateMetaParamsSchema,
  zcodeWorkflowsUpdateMetaResultSchema2 as zcodeWorkflowsUpdateMetaResultSchema,
  zcodeWorkspacePresentationSchema2 as zcodeWorkspacePresentationSchema,
  zcodeWorkspaceReadPresentationParamsSchema2 as zcodeWorkspaceReadPresentationParamsSchema,
  zcodeWorkspaceUpdateInteractionPreferencesParamsSchema2 as zcodeWorkspaceUpdateInteractionPreferencesParamsSchema,
  zcodeWorkspaceUpdateInteractionPreferencesResultSchema2 as zcodeWorkspaceUpdateInteractionPreferencesResultSchema,
  zcodeWorkspaceUpdateModelIoPreferencesParamsSchema2 as zcodeWorkspaceUpdateModelIoPreferencesParamsSchema,
  zcodeWorkspaceUpdateModelIoPreferencesResultSchema2 as zcodeWorkspaceUpdateModelIoPreferencesResultSchema
};
