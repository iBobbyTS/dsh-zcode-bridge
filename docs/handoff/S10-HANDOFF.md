# S10 HANDOFF — 后台任务、subagent 观察与取消

## 身份、边界与交付状态

- TASK：`/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tasks/S10-TASK.md`；PLAN-FULL S10 业务合同 + R02/R08/R13/R16/R22。
- bridge 起点 `eaa9767`，分支 `feat/zcode-runtime-bridge`；模式 EXECUTE_WITH_COMMIT。DSH 克隆 `/Users/ibobby/Projects/dsh-zcode-acp/dsh`（HEAD `21fb059`）**本期无任何改动**（消费点沿用 S03.B 的 `renderSessionArea` seam，未触及 DSH 产品/测试文件），故无 DSH 提交。reference/ZCode（`29628c9a`）与官方 App 只读。
- 当前 worker 的 requested executor/model/effort 与 observed 记录在本会话不可见，记 UNKNOWN，由主调度保留真实 dispatch。未启动子代理；未执行独立 A/B 或父节 admission。
- 自评 **COMPLETE（受限范围内）**：列表/观察/取消 carrier 在真实 headless（0 模型调用）实测可达，空态与官方拒绝语义真实往返；fixtures 覆盖生命周期、取消成功/拒绝、空态、迟到/未知身份与未知类型 fail-safe；回归全绿。
- 0 模型调用：**从未创建真实后台任务或 subagent 实例**（0 模型红线）。观察对象的生命周期帧为在真实官方 envelope 上注入 `backgroundWorks`/`subagents` 状态键（provenance 逐项标注）；空态与不存在 id 的官方拒绝为真实实测。未碰官方 GUI、真实用户数据、凭据、`session/close`。

## 首先执行的真实 headless 可达性探测（TASK 第 1 条）

先执行 `node scripts/capture-s10.mjs`（0 模型调用），隔离 `HOME`+临时 workspace，启动已验证官方 3.14.4.7912（cjs SHA-256 `fad4c35c…6275f`）。原始证据 `tests/fixtures/s10/official.json`、[capture log](../probes/checks/s10-capture.log)。

| 面 | 真实结果（0 模型调用） | 判定 |
|---|---|---|
| v4 会话投影空态 | `v4/conversation/subscribe` → `status:"live"`，`backgroundWorks:[]`、`subagents:{revision:0,childSessionIds:[],running:[],endedTotal:0}`、`control.activeWorks:[]`、`canStop:false` | **可达**（真实空态，非伪造） |
| subagent 实例列表 `session/subagents` | 用官方非模型 `importedHistory` 持久化父会话后返回 `{revision:1,childSessionIds:[],running:[],ended:{total:0,items:[]}}` | **可达**（真实空态） |
| `session/subagents`（未持久 draft / 未知 id） | 官方 `runtime-rejected` `-32004`（sessionUnavailable） | **可达**（官方拒绝如实） |
| 后台输出 `v4/conversation/backgroundBashOutput`（未知 workId） | `{kind:"unavailable",workId:"…"}` | **可达** |
| v4 取消 `v4/command cancelBackgroundWork`（未知 workId） | ACK `status:"failed"`，`reasonCode:"fault.command.backgroundWorkCancelRejected.not_found"`，`message:"… background_task_not_found"` | **可达**（官方拒绝，非假成功） |
| v4 取消（未知 v4 session） | ACK `status:"rejected"`，`reasonCode:"proto.sessionNotFound"` | **可达** |
| legacy 取消 `session/cancelBackgroundTask`（未知 taskId） | `{cancelled:false,reason:"background_task_not_found",status:"lost",taskId:"…"}`（结构化结果，非异常） | **可达**（已核实，未接线） |
| legacy 取消（未知 session） | `runtime-rejected` `-32004` | **可达**（官方拒绝） |

关键结论：**真实后台任务/subagent 实例的创建需要模型执行（gated）**；但列表/状态/进度/取消的 carrier 面、空态与不存在 id 的官方拒绝语义在真实 headless 全部可达，因此实现为真实往返而非标 gated。官方投影不提供百分比进度，桥不虚造。

## Carrier 核实表（逐项）

路径相对只读 `reference/ZCode`；结果 schema 在 `packages/shared/src/zcode-protocol{,-v4}`。

| 项目 | 正式 carrier / 生效 owner | 实现、真实结果与限制 |
|---|---|---|
| 后台工作列表/状态/进度 | v4 会话投影 `snapshot.backgroundWorks`（`snapshot.ts:362` `backgroundWorkSummarySchema`，`:494`）；`control.activeWorks`（`:137`）；由 `v4/conversation/frame` 权威下发 | 客户端面板直接从 `conversation.state.snapshot` 读取，**不缓存**；未造百分比。 |
| subagent 运行态投影 | v4 `snapshot.subagents`（`snapshot.ts:384` `runningSubagentSummarySchema`，`:396` `subagentProjectionStateSchema`，`:496`） | 运行中实例列表/状态由投影给出；ended 详情走 cursor query。 |
| subagent 实例目录（ended 分页） | legacy `session/subagents` → `server.ts:575` → `server-operations.ts:1673 listSessionSubagents`；投影 `subagent-session-query.ts:384`、分页 `:474`；schema `shared/…/index.ts:1544/1612` | 实现 `V4Conversation.listSubagents`（params/result 双校验）。真实空态与 `-32004` 拒绝均实测。 |
| 后台 bash 输出 | v4 `v4/conversation/backgroundBashOutput` → `transport.ts:345`、params `:388` → `v4-gateway.ts:1922`；core `background-bash-output.ts:5`；result union `shared/src/background-bash-output.ts:15` | 实现 `readBackgroundBashOutput`；校验 union（output/unavailable/unsupported/read_failed）。未知 workId 真实回 `unavailable`。 |
| 取消（生效面） | v4 命令 `cancelBackgroundWork {workId}` → `command.ts:221` → handler `interaction-background.ts:177`；workId ≡ 旧 taskId | `submit({type:'cancelBackgroundWork',payload:{workId}})`；workId 空值本地拒绝；未知/过期 id **不本地过滤**，交官方权威拒绝并原样呈现 reasonCode。 |
| 取消（legacy，已核实未接线） | legacy `session/cancelBackgroundTask` → `server.ts:590` → `server-operations.ts:2650`；core `methods/background.ts:45`；schema `index.ts:1931/1941` | 真实可达且回结构化结果；官方注释标明 host 客户端方法已收敛到 v4 `cancelBackgroundWork`，本节按现行 GUI 路径只接 v4。legacy 不标不可用（已核实），亦不接线。 |
| 取消不作用后续新执行 | 官方 workId 唯一；ACK 为唯一权威 | 取消记录只在官方投影离开 running 后收口；后续新 workId 不继承任何旧取消状态。 |
| 进度百分比 / 原生不支持取消 | 官方 schema 无百分比；`cancellable` 为官方布尔位 | 不虚造进度；`cancellable!==true` 时不提供取消入口；官方 `capabilityUnsupported` 原样呈现。 |

## 实现清单

1. **Host `packages/host/conversation.mjs`**：
   - 新增 `WORK_COMMANDS={'cancelBackgroundWork'}`；新增 `workAdmission`（live+projection 即可，**不要求 runnable**——后台工作的观察/取消是 session-scoped 事实，受限 runtime 仍可携带真实后台工作；提交后由官方能力位/目标校验裁决）。
   - `submit`：work 命令走 `workAdmission`；`cancelBackgroundWork` 仅校验 `workId` 非空，不按快照过滤（过期 id 必须由官方拒绝，不得静默改道或误杀）。
   - `listSubagents({endedCursor,endedLimit})`、`readBackgroundBashOutput({workId})`、`cancelBackgroundWork({workId})`；均 param/result schema 双校验，校验失败 fail closed。
   - 命令记录携 `workId`；`#reconcileCommands` 中取消命令的终态来自官方权威投影（work 离开 running/消失 → completed；仍 running → running），**无乐观状态写入快照**。
2. **Host 接线 `runtime.mjs`/`index.mjs`**：`conversationOperation` 新增 `subagents`/`backgroundOutput` 操作与 `WORK_COMMANDS` 命令准入；endpoint key 白名单加入 `endedCursor/endedLimit/workId`（UI 不能透传 session/authority）。
3. **Client `packages/client/remote-conversation.mjs`**：`listSubagents`/`readBackgroundBashOutput`/`cancelBackgroundWork` 走 scoped RPC，不缓存官方事实。
4. **Client 视图 `packages/client/conversation-view.jsx`**：
   - `ZCodeWorkPanel`：后台工作列表（kind/title/官方 status/cancellable/blocked）、bash 输出读取（output 尾窗 + truncated + outputPath，或官方 unavailable/unsupported/read_failed 原因）、取消入口（仅 `cancellable===true` 且 admission 允许，等待期禁用）、官方 ACK 状态/reasonCode 回显；subagent 运行实例列表与取消（取消身份取匹配 `childSessionId` 的官方 workId）、ended 分页加载；未知 kind/未知 status 有界降级 `[unrecognized official work]`。
   - 接入 `ZCodeConversationView`（ControlBar 之后），随 S03.B `renderSessionArea` seam 呈现。
5. **Vendor `packages/host/vendor/zcode/v4.mjs`**：选择性移植官方 `zcodeSessionSubagentsParams/Result`、`zcodeSessionCancelBackgroundTaskParams/Result`、`v4BackgroundBashOutputParams`、`backgroundBashOutputSchema/Result`；`scripts/vendor-v4.mjs` 新模块置于 exports 末尾以免重编号（增量仅 27 行 + SOURCES.json）。
6. **回归/探测**：`scripts/capture-s10.mjs`、`scripts/make-s10-fixtures.mjs`、`tests/s10-work.test.mjs`（7 项）、`tests/s10.dsh.spec.ts`（8 项）。

## Fixtures 与真实性

| Fixture | 真实性 / 注入 |
|---|---|
| `tests/fixtures/s10/official.json` | 官方真实采集（隔离 HOME/workspace）；空态与四类未知 id 拒绝均为实测，paidModelCalls=0。 |
| `tests/fixtures/s10/empty.json` | 从 official.json 严格投影：真实空投影 + 真实拒绝结果；无注入。 |
| `tests/fixtures/s10/lifecycle.json` | 真实官方 s03a snapshot/ACK envelope 上**注入** `backgroundWorks`/`subagents` 状态键（bash running→cancelled，subagent running→resultPending，随后新增一个无关新 work）；provenance 明示注入，**不冒充真实运行中的任务**。 |

## 不变量与安全中间态

- **列表/状态/进度只来自官方投影**：`backgroundWorks`/`subagents`/`control.activeWorks`；桥不建第二存储、不缓存为权威。
- **身份完整与过期拒绝**：取消身份=官方 `workId`（≡legacy taskId），由 envelope 的 sessionId 绑定到本会话；未知/过期 id 交官方拒绝，`fault.command.backgroundWorkCancelRejected.not_found` / `-32004` / `proto.sessionNotFound` 原样呈现，绝不假成功。
- **取消不作用后续新执行**：官方 workId 唯一；测试覆盖取消 bash work 后新增无关 work 仍 running 且无任何取消记录/回落。
- **乐观 UI 仅等待期**：ACK accepted 且 work 仍 running 时记 `running`（等待），只有官方投影离开 running 才收口 `completed`；快照状态从不在本地改。
- **空态如实**：真实空投影渲染“无后台工作/无运行 subagent”，不伪造行。
- **受限态不标 available**：`workAdmission` 只表示可读官方投影/可发官方取消；面板不宣称模型执行可用；`cancellable!==true` 时不提供入口；不虚造进度百分比。
- **fail-safe**：未知 kind/status、结果 schema 不合、未知通知均不崩不猜；输出读取以最新官方结果替换（`unavailable` 不保留陈旧尾窗）。

## Checks 实跑

| 检查 | 命令 | 结果 / 证据 |
|---|---|---|
| bridge Node 全量 | `npm test` | **124/124 PASS**（新增 7 项；基线 117），0 skip；[log](../probes/checks/s10-node.log)。 |
| bridge DSH 集成 | `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **111/111 PASS**（新增 8 项；基线 103）；[log](../probes/checks/s10-integration.log)。 |
| DSH native 回归 | `pnpm_config_verify_deps_before_run=false pnpm vitest run packages/api/session-controller/tests packages/client/ui-session/tests packages/client/ui-workspace/tests` | **1373/1373 PASS**（60 文件）；[log](../probes/checks/s10-native.log)。 |
| DSH 类型检查 | `pnpm_config_verify_deps_before_run=false pnpm typecheck:contracts-ready` | **PASS**（0 error）；[log](../probes/checks/s10-types.log)。 |
| DSH 全量构建 | `pnpm_config_verify_deps_before_run=false pnpm build` | **PASS**（355 client artifacts）；[log](../probes/checks/s10-dsh-build.log)。 |
| bridge build | `npm run build` | **PASS**；[log](../probes/checks/s10-build.log)。 |
| 真实 headless 探测 | `node scripts/capture-s10.mjs /Applications/ZCode.app <tmp>` | **PASS**，paidModelCalls=0；[log](../probes/checks/s10-capture.log)。 |
| fixture 派生 | `node scripts/make-s10-fixtures.mjs` | **PASS**；[log](../probes/checks/s10-fixtures.log)。 |
| oxlint（改动文件） / `git diff --check` | `oxlint <touched>` / `git diff --check` | **0 warning 0 error** / **PASS**；[lint](../probes/checks/s10-lint.log)、[whitespace](../probes/checks/s10-whitespace.log)。 |
| DSH 仓改动 | — | **无**（无 DSH commit）。 |

## NOT_RUN

- 真实后台任务/subagent 实例生命周期（running→cancelled/success 等真实 transition）：`NOT_RUN（需要模型执行，0 模型红线）`；以官方 envelope + 注入状态键的 fixtures 覆盖，并在 `lifecycle.json` provenance 明示注入，**不冒充真实运行**。
- 真实取消一个正在运行的 bash/subagent：`NOT_RUN（同上）`；真实覆盖了未知/过期 id 的官方拒绝与真实空态。
- 官方 GUI / packaged GUI / 多客户端共享后台权威：`NOT_RUN`（红线）。
- 未以任何注入 fixture PASS 替代上列真实成功。

## 给后续契约

- Host API：`V4Conversation.listSubagents({endedCursor?,endedLimit?})`、`readBackgroundBashOutput({workId})`、`cancelBackgroundWork({workId})`；`state.workAdmission`。RPC：`conversation` endpoint 新增 `{operation:'subagents',handle,endedCursor?,endedLimit?}`、`{operation:'backgroundOutput',handle,workId}`、`{operation:'command',handle,command:{type:'cancelBackgroundWork',payload:{workId}}}`。
- 取消一律用 v4 `cancelBackgroundWork {workId}`；workId ≡ legacy taskId ≡ workflow runId。不要本地按快照过滤过期 id（会掩盖官方拒绝）；不要从投影推断百分比；不要在 DSH 复制后台状态。
- legacy `session/cancelBackgroundTask` 已核实但未接线（现行 GUI 走 v4）；如父节需要 legacy 兼容面，应另立有界项。
- `backgroundBashOutput` 只读现存执行器、不为查看恢复冷会话（官方语义）；未知 workId 即 `{kind:'unavailable'}`。
- subagent 取消身份：child 投影无 workId，须由匹配 `childSessionId` 的官方 backgroundWork 取得 workId；无匹配则只观察。

## 分块提交

- bridge `chore(protocol): vendor official background work and subagent schemas`。
- bridge `feat(work): expose official background work and subagent observation and cancel`。
- bridge `test(work): probe official reachability and cover work observation and cancel semantics`。
- bridge `docs(handoff): record S10 carrier verification, reachability probe and checks`。
- DSH 仓无提交；无 push、无主干 merge、无历史改写。

本 worker 只提供实际 Git/脚本/检查/fixture 证据，等待父节独立 A+B 覆盖与 admission；不自行宣称 CLEAN，不组装父级 audit pack。
