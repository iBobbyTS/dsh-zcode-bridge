# S14 — 正式账号可用入口、usage/诊断与辅助生成

## 身份、范围与交付状态

- TASK：`/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tasks/S14-TASK.md`，完整先读后执行；合同 PLAN-FULL S14 + R08/R14/R15/R18/R22。模式 EXECUTE_WITH_COMMIT。
- bridge 起点 `4c07dd8`，分支 `feat/zcode-runtime-bridge`；DSH 克隆 `/Users/ibobby/Projects/dsh-zcode-acp/dsh`（HEAD `21fb059`）**本期无任何改动**（消费点沿用 bridge 自带 client 插件与既有 session-area seam，未触及 DSH 产品/测试文件），故无 DSH 提交。reference/ZCode（`29628c9a`）与官方 App 只读。
- 当前 worker 的 requested executor/model/effort 与 observed 记录在本会话不可见，记 UNKNOWN，由主调度保留真实 dispatch。未启动子代理；未执行独立 A/B 或父节 admission。
- 自评 **COMPLETE（受限范围内）**：usage/session usage/process diagnostics 在真实 headless（0 模型调用）实测可达并真实往返；账号面经源码 + 真实 -32601 证实**无 app-server 载体**，如实呈现 UNKNOWN、不实现登录入口；辅助生成面按模型触发如实 gated、从不调用。fixtures 全覆盖、回归全绿。
- 全程真实模型调用 **0**；未碰官方 GUI、真实用户数据、凭据、`session/close`。所有真实读取只在**专用临时 HOME + 临时 workspace**（隔离官方存储）内执行，真实用户 `~/.zcode` 未被读写。

## 首先执行的真实 headless 可达性检查（TASK 第 1 条）

先执行 `node scripts/capture-s14.mjs /Applications/ZCode.app`（0 模型调用；隔离 HOME/workspace；官方 3.14.4.7912，cjs SHA-256 `fad4c35c…6275f`），再实现测试。原始证据 `tests/fixtures/s14/official.json`、[capture log](../probes/checks/s14-capture.log)；生产 `InsightsClient` / `V4Conversation.sessionUsage()` 走同一 peer 的 oracle 记在 `official.productionOracle`。

| 面 | 真实结果（0 模型调用） | 判定 |
|---|---|---|
| 账号 `account/status` | 官方 `runtime-rejected` `-32601` | **不可达**（无 handler；与 AUTH-SOURCE-RESEARCH E06 一致） |
| workspace usage `usage/stats {range:'30d'}` | 真实官方 `appUsageSnapshot`（隔离库全 0：`summary.totalTokens=0`、`source:"agent-db"`、heatmap/dailyModelUsage 空） | **可达**（真实空态） |
| workspace usage `usage/stats {range:'all'}` | 真实官方快照（全 0） | **可达** |
| session usage `session/usage {sessionId}` | 真实官方 `zcodeTaskTokenUsageResult`（隔离 draft 全 0） | **可达**（scoped） |
| process 诊断 `process/childProcesses` | 真实 `{processes:[]}`（无 MCP 子进程） | **可达**（真实空态） |
| 辅助生成取消 `workspace/cancelGenerateText {operationId:'s14-never-created'}` | 真实 `{operationId,cancelled:false}` | **可达**（纯 map miss，非模型） |
| 辅助生成 `workspace/generateText` | **未调用**（触发模型） | **gated**（红线 0 模型） |
| 连通性测试 `provider/testModelConnectivity` | **未调用**（触发模型） | **gated** |
| `process/resourceSample` 通知 | 采样器首周期只建基线、60s 后才发；本次 capture 收到 **0** 条 | 可达通知面，样本按时到达才有；无样本如实显示“尚未收到” |

关键结论：**账号面确实 Host 专用、无正式 RPC**（E06 + 真实 -32601），因此不实现登录/账号查询、不逆向、不猜状态；usage/诊断面可达，实测真实往返；辅助生成面按模型触发 gated，桥从不调用。

## Carrier 核实表（逐项）

源码路径相对只读 `reference/ZCode`；结果 schema 在 `packages/shared/src/zcode-protocol/index.ts`（`appUsageSnapshotSchema`/`zcodeProcessResourceSampleSchema` 来自 `packages/shared/src/usage-stats.ts`、`processResourceTelemetry.ts`）。CLI dispatch `apps/zcode-cli/packages/bootstrap/src/zcode-protocol/server.ts`。

| 入口 | 正式载体 / 源锚点 | 真实程度与本节行为 |
|---|---|---|
| 账号状态 / 登录 / 登出 / 订阅 | **无 app-server RPC**；account 服务在 Host 进程内（E06：`services/src/node.ts:1494/2085/2614`，明确不暴露通用 RPC）；唯一 account 形状方法是 `provider/updateAccountConfig`（配置同步，非登录/状态查询） | 实现 `InsightsClient.account()`：`state:'unknown'`、`reason:'official-account-carrier-not-exposed'`、`login.available:false`。按 R15 不读凭据、不逆向鉴权、不调内部服务。真实探测 `account/status` = `-32601`。 |
| workspace 用量 | `usage/stats` → `server.ts:710` → `server-operations.ts:1768 getUsageStats`；params `zcodeUsageStatsParamsSchema`，result `appUsageSnapshotSchema` | 实现 `read('usageStats',{range})`；每次 fresh 官方读、无本地缓存；单位/窗口/缺失语义（`avgTimeToFirstTokenMs:null` 等）原样保留。 |
| session 用量 | `session/usage` → `server.ts:714` → `getTaskTokenUsage`（与 `v4/conversation/usage` 同 usage store） | 实现 `V4Conversation.sessionUsage()`；**scoped**——只取会话绑定 address.sessionId，调用方传值被忽略；纯聚合读，不消耗模型 admission、不留本地计数。 |
| process/MCP 资源诊断 | `process/childProcesses` → `server.ts:676` → `listChildProcesses(mcpTelemetry.listProcesses())`；params `{}`，result `{processes:[{pid,serverName,mcpSource,pluginName?}]}` | 实现 `read('childProcesses')`；纯内存列表、无 I/O；空即真实空。 |
| 进程资源样本 | `process/resourceSample` 通知（`resource-sampler.ts:27`；schema `zcodeProcessResourceSampleSchema`） | `InsightsClient` 订阅该通知，schema 校验后仅保留最新一个样本；非法/额外字段丢弃；无样本如实 null。**未发给任何存储**。 |
| 辅助文本生成 | `workspace/generateText` → `server.ts:636` → `generateWorkspaceText` | **gated**：呈现为 `{available:false,reason:'model-execution-gated'}`，桥不实现调用入口、不伪造生成结果。取消/连通性同。 |
| 辅助生成取消 | `workspace/cancelGenerateText` → `server.ts:640 cancelWorkspaceGenerateText`（纯 controller map 查询） | 已核实且真实回 `{cancelled:false}`；仍按 gated 呈现（无已启动的生成则无意义），不暴露可用按钮。 |
| 连通性测试 | `provider/testModelConnectivity` → `server.ts:642` → `workspace-model-runtime.ts:37` | **gated**：触发模型，不调用。 |
| session 调试面 | `session/debug` → `server.ts:712` → `session-debug.ts:154 querySessionDebug`；需 **resident session**，快照含 `requestHeaders/responseHeaders/message` | 已核实 carrier，但 **本节不接线**：PLAN 交付面为 usage/session usage/process-MCP 诊断；该面要求驻留会话且携带 headers，按“不保存请求 headers/secret”不引入。未标不可用（carrier 存在），属未接线。 |
| 内部内存诊断 | `collectMemoryDiagnostics()` 仅经 `process/resourceSample` 通知的 `counters` 内部日志面，无查询 RPC | 不作为独立查询面；不伪造。 |

## 实现清单

1. **Host carrier `packages/host/insights.mjs`**：`InsightsClient`（单 peer、无持久、无第二存储）。`read(kind,params)` 对 `usageStats`/`childProcesses` 做官方 params/result 双校验，未知 kind `insights-read-unknown` fail closed，caller 的 workspace/secret 字段被 schema 丢弃；`account()` 如实 UNKNOWN；`gated()` 如实 gated；订阅 `process/resourceSample` 仅保留最新合法样本；`dispose` 释放监听。导出 `INSIGHTS_READ_KINDS`/`GATED_CARRIERS`/`ACCOUNT_REASON`。
2. **Host 会话 `packages/host/conversation.mjs`**：新增 `sessionUsage()`，只发本会话绑定 `sessionId`，params/result 双校验（`session-usage-*-invalid`）。
3. **Host 接线 `runtime.mjs`/`index.mjs`**：`#connect` 成功后建 `InsightsClient`，重置/失败/dispose 时释放；新增 `insightsRead`/`insightsState`；`conversationOperation` 新增 `sessionUsage`；新端点 `insights`（仅 `state|read`，key 白名单，拒绝多余 payload 与非法 kind，UI 不能携 workspace/sessionId）。
4. **Client `packages/client/insights.mjs`**：`InsightsStore` 仅作官方事实的显示镜像；refresh 逐节读 `usageStats`/`childProcesses`/`state`，单节失败只标该节不可用并保留其它节；分节错误映射；`setRange` 仅接受官方三档；连接代际重置清快照，迟到结果不复活。
5. **Client 视图 `packages/client/insights-view.jsx`**：账号（UNKNOWN+原因+登录不可用+说明）、用量（三档区间、空态与数字/单位）、诊断（MCP 子进程列表/空态、最新进程样本）、辅助生成三面 gated 文本；`SessionUsage` 按需按钮触发（打开会话不发额外查询）。
6. **入口 `client.jsx` / `directory-view.jsx` / `remote-conversation.mjs`**：新增 `zcode-insights` 主面板与侧栏入口、locale、`RemoteConversation.sessionUsage`。
7. **回归/探测**：`scripts/capture-s14.mjs`、`scripts/make-s14-fixtures.mjs`、`tests/s14-insights.test.mjs`（9）、`tests/s14.dsh.spec.ts`（9）。

## Fixtures 与真实性

| Fixture | 真实性 / 注入 |
|---|---|
| `tests/fixtures/s14/official.json` | 官方真实采集（隔离 HOME/workspace，paidModelCalls=0）；账号 -32601、usage/session-usage/child-processes/cancel-generate 真实往返。 |
| `usage.json` | `emptyUsage`/`emptySessionUsage`/`childProcesses` **真实空态**；`nonEmptyUsage`/`nonEmptySessionUsage`/`childProcessesNonEmpty`/`resourceSample` **注入并用官方 zod schema 校验**（隔离 0 模型只能观测空库），provenance 逐项标注。 |
| `account.json` | 真实 `productionOracle.account`/`gated` + 真实 `account/status` -32601 记录。 |
| `unknown.json` | 按官方 schema 注入未来账号状态/未知 kind，用于 fail-safe。 |

## 不变量与安全中间态

- **账号 UNKNOWN 如实**：`auth:'unavailable'` 是本客户端请求鉴权缺失事实，不等于已登出；账号状态无 carrier 时不猜已登录/已登出，登录入口不实现（R15）。
- **不伪造**：usage 数字/诊断结论/生成结果都来自官方或如实空态/gated；`resourceSample` 未到即 null，不造样本；gated 面不实现调用、不显示可用。
- **scoped 身份**：session usage 只走会话绑定 `sessionId`；`insights` 端点不接受 caller workspace/sessionId/secret；`sessionUsage` UI 打开会话不发额外官方查询（按需）。
- **不造第二存储**：usage/diagnostics 无本地持久；`InsightsStore` 仅显示镜像，连接代际重置清空。
- **不保存 headers/secret**：不接 `session/debug`；`process/resourceSample` strict schema 拒绝路径/额外字段；官方 usage 结果按单位/窗口原样呈现。
- **R18/R22**：受限不标 available；官方拒绝/字段缺失如实展示且不崩；未知状态有界降级。

## Checks 与可重跑证据

| Check | 实跑结果 |
|---|---|
| `node scripts/capture-s14.mjs /Applications/ZCode.app` | **PASS**，0 models；account -32601、usage/session-usage/child-processes/cancel-generate 真实；resourceSamples=0；[log](../probes/checks/s14-capture.log)。 |
| `node scripts/make-s14-fixtures.mjs` | **PASS**；注入值经官方 schema 校验；[log](../probes/checks/s14-fixtures.log)。 |
| `node --test tests/s14-insights.test.mjs` | **9/9 PASS**。 |
| `npm test` | **172/172 PASS**，基线 163；[log](../probes/checks/s14-node.log)。 |
| bridge DSH Vitest 全套 `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **149/149 PASS**，14 文件，基线 140；[log](../probes/checks/s14-integration.log)。 |
| DSH `pnpm_config_verify_deps_before_run=false pnpm exec vitest run packages/api/session-controller/tests packages/client/ui-session/tests packages/client/ui-workspace/tests` | **1373/1373 PASS**，60 文件；[log](../probes/checks/s14-native.log)。DSH 源码不变。 |
| DSH `pnpm run typecheck:contracts-ready` | PASS（exit 0）；[log](../probes/checks/s14-types.log)。 |
| DSH `pnpm run build` | PASS，355 client artifacts，既有 chunk-size warning；[log](../probes/checks/s14-dsh-build.log)。 |
| bridge `npm run build` | PASS；[log](../probes/checks/s14-build.log)。 |
| changed-file oxlint 1.76.0 / `git diff --check` | **0 warning 0 error / PASS**；[lint](../probes/checks/s14-lint.log)、[whitespace](../probes/checks/s14-whitespace.log)。 |

## NOT_RUN、后续契约与自评

- 非空真实 usage/session usage/非空 MCP 子进程、真实 `process/resourceSample` 样本：**NOT_RUN**（隔离临时 HOME 全空；样本需 60s 第二周期）。以官方 schema 注入 fixture 覆盖呈现，不冒充实测。
- 真实账号登录/账号状态/订阅/权益、真实生成/取消/连通性成功：**NOT_RUN**（无正式账号 carrier；模型触发按红线 0 调用）。账号面结论是“不可达”而非“空”，不标 available。
- `session/debug`、内部内存诊断查询面、官方 GUI/共享 GUI authority：**NOT_RUN/unavailable**（未接线/无正式 RPC/红线）。
- API：`host.insightsRead(kind,params,{signal})`（kind=`usageStats|childProcesses`）、`host.insightsState()`；RPC `rpc.call('/zcode-bridge','insights',{operation:'state'|'read',kind,params})`；session usage 经 `conversationOperation({operation:'sessionUsage',handle})` / `RemoteConversation.sessionUsage()`。
- 后续若官方新增账号/usage 变更/生成 carrier：必须核实正式 producer 与 entitlement 语义再接线；账号仍需保持“无 carrier 即 UNKNOWN”；生成类仍不得在无准入时触发模型；不得引入第二 usage/诊断存储。
- 自评：本 TASK 的**经实测界定的受限面**已实现并验证；全功能账号/真实非空 usage/生成 oracle 仍未取得。未自称父节 CLEAN/接纳或整个 SFD 完成。主控需冻结候选并进行独立 A+B。

## 分块提交

- `chore(protocol): vendor official usage and process diagnostic schemas`。
- `feat(insights): expose official account honesty usage and diagnostics`。
- `test(insights): probe official reachability and cover account usage and gated generation`。
- handoff/evidence 独立 docs(handoff) 提交；实际 hash 见 Git 及 worker final，不虚构本文件自身 hash。
- DSH 无文件改动、无提交；reference/官方 App 未改；无 push、merge、reset、clean 或历史改写。
