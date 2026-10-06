# automation-offpeak — Automation / Off-Peak 正式操作与门禁行为

## 身份、范围与交付状态

- TASK：`/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tasks/automation-offpeak-TASK.md`，完整先读后执行；合同 PLAN-FULL automation-offpeak + R02/R08/R18/R22，沿用 official-runtime-install carrier 分类、catalog-management/background-subagents 目录与观察、workflow-management 运行门禁、account-usage-diagnostics 账号 UNKNOWN 与 v4 优先级。模式 EXECUTE_WITH_COMMIT。
- bridge 起点 `d36077d`，分支 `feat/zcode-runtime-bridge`；DSH 克隆 `/Users/ibobby/Projects/dsh-zcode-acp/dsh`（HEAD `21fb059`）**本期无任何改动**（消费点沿用 bridge 自带 client 插件与既有 session-area/sidebar seam），故无 DSH 提交。reference/ZCode（`29628c9a`）与官方 App 只读。
- 当前 worker 的 requested executor/model/effort 与 observed 记录在本会话不可见，记 UNKNOWN，由主调度保留真实 dispatch。未启动子代理；未执行独立 A/B 或父节 admission。
- 自评 **COMPLETE（受限范围内）**：可达性真实探测（0 模型调用）证明 automation/offPeak 全部管理载体是 **Host 消费的反向方法**，app-server 无请求面（每个都真实 -32601）；据此不实现第二存储/调度器，而是如实呈现不可用与 UNKNOWN、对反向回调 fail-closed，并以官方 schema 注入 fixtures 覆盖生命周期/受限/未知语义。回归全绿。
- 全程真实模型调用 **0**；未创建任何真实 automation/off-peak 任务或运行；未碰官方 GUI、真实用户数据、凭据、`session/close`。所有真实探测只在**专用临时 HOME + 临时 workspace**（隔离官方存储）内执行。

## 首先执行的真实 headless 可达性检查（TASK 第 1 条）

先执行 `node scripts/capture-automation-offpeak.mjs /Applications/ZCode.app`（0 模型调用；隔离 HOME/workspace；官方 3.14.4.7912，cjs SHA-256 `fad4c35c…6275f`），再实现。原始证据 `tests/fixtures/automation-offpeak/official.json`、[capture log](../probes/checks/automation-offpeak-capture.log)；生产 `AutomationClient.state()` 走同一 peer 的 oracle 记在 `official.productionOracle`。

| 面 | 真实结果（0 模型调用） | 判定 |
|---|---|---|
| `automation/list` | 官方 `runtime-rejected` `-32601` | **不可请求**（app-server 无 case） |
| `automation/checkTaskBinding`（未知 targetTaskId） | `-32601` | **不可请求** |
| `automation/update`（未知 id） | `-32601` | **不可请求** |
| `automation/delete`（未知 id） | `-32601` | **不可请求** |
| `automation/create`（合法 params，未落库） | `-32601` | **不可请求**（无任务被创建） |
| `offPeak/list` | `-32601` | **不可请求** |
| `offPeak/create`（合法 params） | `-32601` | **不可请求**（无任务被创建） |
| `workspace/updateOffPeakToolPolicy {enabled:false}` | 真实 `{workspace, enabled:false}` | **可请求**，但只是 Host→CLI 工具门同步，非管理/反馈载体 |
| `runtime/capabilities` | `{independentPlanState:true}` | 可达（无 automation 能力位） |

关键结论：`automation/*` 与 `offPeak/*` 是 **CLI 反向请求 Host** 的载体（`createProtocolAutomationPort` / `createProtocolOffPeakPort` 调 `context.requestClient(...)`），由**官方 Host 的 `zcodeAgentService`** 应答并持有 `automationService`/`offPeakTaskService` 存储。CLI app-server dispatcher 对其无 case，故任何连到该 app-server 的客户端都无法请求它们。既有 v4 也没有对应管理命令。因此管理、绑定、取消、运行反馈都属于「无 app-server 载体」；桥不成为第二 automation Host、不写 `.zcode` 任务文件、不伪造任务/运行。运行执行触发模型，gated。

## Carrier 核实表（逐项，含 legacy/v4 与弃用状态）

源码路径相对只读 `reference/ZCode`；结果 schema 在 `packages/shared/src/zcode-protocol/index.ts`（`:3323–3561`），protocol method 名在 `:3644–3651`。

| 入口 | 正式载体 / 源锚点 | legacy/v4 与弃用 | 真实程度与本节行为 |
|---|---|---|---|
| automation 创建 | `automation/create`（legacy）；Host 应答 `services/src/zcode-agent/zcodeAgentService.ts:2491`；CLI 侧 `bootstrap/src/zcode-protocol/automation-port.ts` | **仅 legacy**；无 v4 管理命令、无 v4 successor；**非 @deprecated**（仍被 Host 使用），但方向为 CLI→Host 反向 | 不在请求面；真实 -32601。不可用，不实现存储 |
| automation 更新 | `automation/update`；`zcodeAgentService.ts:2753` | 同上 | 真实 -32601；未知/过期 id 由官方权威拒绝（此处根本不可请求，不本地伪造删除） |
| automation 绑定查询 | `automation/checkTaskBinding`；`zcodeAgentService.ts:2725` | 同上 | 真实 -32601 |
| automation 列表 | `automation/list`；`zcodeAgentService.ts:2699` | 同上 | 真实 -32601；不缓存/不造第二目录 |
| automation 删除 | `automation/delete`；`zcodeAgentService.ts:2795` | 同上 | 真实 -32601 |
| off-peak 创建 | `offPeak/create`（legacy）；`zcodeAgentService.ts:2552`；`bootstrap/.../offpeak-port.ts` | **仅 legacy**；无 v4；非 @deprecated，反向 | 真实 -32601。失败分类联合（failureStage/errorCategory）保留在 fixtures |
| off-peak 列表 | `offPeak/list`；`zcodeAgentService.ts:2664` | 同上 | 真实 -32601 |
| off-peak 工具门 | `workspace/updateOffPeakToolPolicy`；`bootstrap/.../off-peak-tool-policy.ts:10`；schema index.ts:2237 | legacy 方法名，**Host→CLI 同步**（非反向）；无 v4 | **可请求**且真实往返；仅置 `offPeakToolEnabled`，不含任务数据；桥不据它标管理可用 |
| v4 派发标记 | v4 `sendText` payload `automationId`/`offPeakTaskId`/`offPeakRunType`；`zcode-protocol-v4/command.ts:104–124` | v4 | 是运行派发标记，**非管理/反馈**；本节不接线 |
| v4 工具注册 flag | v4 `createSession` payload `offPeakToolEnabled`；`command.ts:63` | v4 | 灰度工具注册，非任务状态；不接线 |
| 运行/最近运行反馈 | **无 app-server 投影**：v4 snapshot / sessions-index 均无 automation/offPeak 字段；`automationService.listRuns`、`offPeakTaskService.list` 均为 Host 进程内服务（GUI 走 `IZCodeAgentService` IPC） | 无 legacy 亦无 v4 请求面 | 不可用 + 原因；不伪造状态/进度/产物 |
| 账号/资格 | 无 app-server RPC（account-usage-diagnostics / AUTH-SOURCE-RESEARCH E06；off-peak entitlement 走 Host `getCodingPlanSupport()`） | 无 | account **UNKNOWN**；off-peak entitlement **UNKNOWN**；不猜 |

## 实现清单

1. **Vendor `scripts/vendor-v4.mjs` + `packages/host/vendor/zcode/v4.mjs`**：追加导出官方 `zcodeAutomation*`/`zcodeOffPeak*` params/result/snapshot schema（置尾部保持既有导出顺序；仅 +19 行）。用于 fixtures 校验与 fail-safe，不新增任何执行逻辑。
2. **Host `packages/host/automation.mjs`**：`AutomationClient`（单 peer、无持久、无第二存储）。常量 `AUTOMATION_MANAGEMENT_REASON`/`AUTOMATION_FEEDBACK_REASON`/`OFF_PEAK_ENTITLEMENT_REASON`；`AUTOMATION_CARRIERS`（逐方法 `direction:'cli-to-host-reverse'`、`requestable:false`）；对 7 个反向方法 `registerRequestHandler`：合法 params → `HostCallbackError(-32601)`，非法 params → `-32602`，**从不返回任务/列表**；有界记录 + `onReverseSettled` 记 outcome；`dispose` 关闭未决观察。`state()` 输出 management/offPeak/runFeedback/account/reverse/admission 的如实投影。
3. **Host 接线 `runtime.mjs` / `index.mjs`**：`#connect` 成功后建 `AutomationClient`，重置/失败/dispose 释放；新增 `automationState()`；新端点 `automation`（仅 `state`，key 白名单，拒绝多余 payload，UI 无法携 workspace/sessionId）。
4. **Client `packages/client/automation.mjs`**：`AutomationStore` 仅作官方事实显示镜像；`refresh` 只读 `state`；连接代际重置清快照；失败不升级可用性。
5. **Client 视图 `packages/client/automation-view.jsx`**：管理/闲时/运行反馈/账号/反向观察分区；逐条展示 carrier 方向与 `requestable:false`、UNKNOWN 与原因、gated 执行；反向记录显示 method/identity/outcome；无任何 available 按钮或伪造行。
6. **入口 `client.jsx` / `directory-view.jsx`**：新增 `zcode-automation` 主面板与侧栏入口、locale。

## 不变量与安全中间态

- **管理面不可请求**：所有 management carrier `requestable:false` 来自真实 -32601，不是假设；UI 不显示创建/列出/绑定/取消入口。
- **不造第二存储 / 不造调度器**：AutomationClient 无任务/运行/反馈写入，无 SQLite、无文件、无定时器；反向回调一律 fail-closed，绝不冒充官方 Host。
- **身份完整**：反向 `automation/delete`/`update` 携带的 `automationId` 原样记录为 observation；未知/过期 id 不会被本地过滤成「已删除」，官方拒绝语义（此处为不可请求）如实。
- **不伪造反馈**：无运行不显示成功/进度/产物；未发生的运行不产生任何帧；`runFeedback.available:false`。
- **R18 受限账号**：account 与 off-peak entitlement 保持 UNKNOWN 并给原因；不猜已登录/已登出/已授权。
- **R22**：合法反向请求 -32601、非法 -32602、断开/取消 → outcome-unknown；迟到结果不翻成成功。
- **受限态不标 available**：`admission.allowed:false` 恒为管理面的诚实准入事实。

## Fixtures 与真实性

| Fixture | 真实性 / 注入 |
|---|---|
| `tests/fixtures/automation-offpeak/official.json` | 官方真实采集（隔离 HOME/workspace，paidModelCalls=0）：7 个管理载体真实 -32601；`workspace/updateOffPeakToolPolicy` 真实往返。 |
| `empty.json` | 从 official.json 严格投影，`injectedFields:[]`；真实拒绝与 policy 结果。 |
| `projection.json` | **injected-semantic-fixture**：automation list/create/update/delete/checkTaskBinding + off-peak list/create(ok/failure) 帧，逐项经 vendored 官方 schema 校验；非实际生成，不冒充运行。 |
| `restricted.json` | **injected-semantic-fixture**：account/entitlement UNKNOWN、官方形态 off-peak 不支持原因、反向回调观察记录；UNKNOWN 不由猜测消解。 |
| `unknown.json` | **injected-semantic-fixture**：未知 lifecycleStatus/status/failureStage/errorCategory 与未知条目，用于 fail-safe（这些帧按官方 schema 应被拒绝）。 |

## Checks 与可重跑证据

| Check | 实跑结果 |
|---|---|
| `node scripts/capture-automation-offpeak.mjs /Applications/ZCode.app` | **PASS**，0 models；7 管理载体 -32601、policy 往返；[log](../probes/checks/automation-offpeak-capture.log)。 |
| `node scripts/make-automation-offpeak-fixtures.mjs` | **PASS**；注入帧经官方 schema 校验；[log](../probes/checks/automation-offpeak-fixtures.log)。 |
| `node --test tests/automation-offpeak.test.mjs` | **8/8 PASS**；[log](../probes/checks/automation-offpeak-targeted-node.log)。 |
| bridge DSH Vitest `tests/automation-offpeak.dsh.spec.ts` | **6/6 PASS**；[log](../probes/checks/automation-offpeak-targeted-integration.log)。 |
| `npm test` | **182/182 PASS**，基线 174；[log](../probes/checks/automation-offpeak-node.log)。 |
| bridge DSH Vitest 全套 `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **157/157 PASS**，15 文件，基线 151；[log](../probes/checks/automation-offpeak-integration.log)。 |
| DSH `pnpm_config_verify_deps_before_run=false pnpm exec vitest run packages/api/session-controller/tests packages/client/ui-session/tests packages/client/ui-workspace/tests` | **1373/1373 PASS**，60 文件；[log](../probes/checks/automation-offpeak-native.log)。DSH 源码不变。 |
| DSH `pnpm run typecheck:contracts-ready` | PASS（exit 0）；[log](../probes/checks/automation-offpeak-types.log)。 |
| DSH `pnpm run build` | PASS（exit 0，355 client artifacts）；[log](../probes/checks/automation-offpeak-dsh-build.log)。 |
| bridge `npm run build` | PASS；[log](../probes/checks/automation-offpeak-build.log)。 |
| changed-file oxlint 1.76.0 / `git diff --check` | **0 warning 0 error / PASS**；[lint](../probes/checks/automation-offpeak-lint.log)、[whitespace](../probes/checks/automation-offpeak-whitespace.log)。 |

DSH 命令使用 `pnpm_config_verify_deps_before_run=false`，沿既有基线环境。

## NOT_RUN、后续契约与自评

- 真实 automation/off-peak 创建/列出/绑定/更新/删除/取消与真实运行反馈：**NOT_RUN**，app-server 无请求载体；实现它们需要桥自建第二任务存储与调度器（红线禁止）。以官方 schema 注入 lifecycle 帧覆盖语义，**不冒充实测**。
- 来自 CLI 工具轮的**真实反向回调**：**NOT_RUN**（需模型执行，0 模型红线）；以真实 ProtocolPeer 传输上的合成反向帧覆盖 fail-closed（Node 测试），不冒充真实运行。
- off-peak 真实 entitlement/eligibility 状态、真实账号：**NOT_RUN/UNKNOWN**（Host 服务事实，无 RPC）；不逆向、不猜。
- 官方 GUI / packaged GUI / 多客户端共享 automation authority：**NOT_RUN**（红线）。
- API：`host.automationState()`；RPC `rpc.call('/zcode-bridge','automation',{operation:'state'})`；client `AutomationStore.refresh()`。反向方法常量 `AUTOMATION_REVERSE_METHODS`。
- 后续若官方新增 automation/off-peak app-server 请求载体或运行反馈投影：必须先核实正式 producer、方向与弃用状态再接线条；**不得**在桥内建第二任务存储/调度器，**不得**在无载体时把 UNKNOWN 解析成已授权/已创建。反向处理器在桥未被正式接纳为 automation Host 前保持 fail-closed。
- 自评：本 TASK 的**经实测界定的受限面**已实现并验证；全功能管理/真实运行反馈 oracle 仍未取得（载体不存在）。未自称父节 CLEAN/接纳或整个 SFD 完成。主控需冻结候选并进行独立 A+B。

## 分块提交

- `chore(protocol): vendor official automation and off-peak schemas`。
- `feat(automation): expose official automation and off-peak honesty with fail-closed reverse callbacks`。
- `test(automation): probe official reachability and cover reverse fail-closed semantics`。
- `docs(handoff): record automation-offpeak carrier verification, reachability probe and checks`。
- DSH 无文件改动、无提交；reference/官方 App 未改；无 push、merge、reset、clean 或历史改写。
