# browser-computer-use HANDOFF — Browser / Computer Use 正式宿主回调与可见交互

## 身份、边界与状态

- 权威：`../.agent-work/tasks/browser-computer-use-TASK.md` 完整任务包、PLAN-FULL browser-computer-use、REQUIREMENTS R02/R08/R09/R21/R22；执行模式 **EXECUTE_WITH_COMMIT**。
- bridge 基线 `4ff84e3`，分支 `feat/zcode-runtime-bridge`；DSH 基线 `21fb059`，本节 **无 DSH 仓改动/提交**：webui 消费沿用 live-session-permission-stop `renderSessionArea`，具体视图仍由 bridge Client bundle 提供。没有为“两仓”形式要求制造无必要改动。
- reference/ZCode `29628c9acdb81b703bbd4080c207a0e7ce5e276e` 与官方 App 只读。实际 executor/model/effort 的调度证据由父节保存；本会话不自行推测 observed 身份。未启动子代理，未执行独立 A/B 或 admission。
- 自评：**COMPLETE（TASK 已接受受限范围）**。正式 browser reverse responder、注册观察、Computer Use 事件/权限/图片呈现已实现；**真实 browser/CUA 动作成功仍 NOT_RUN，执行能力 gated**。本节不能据此宣布原 PLAN 的真实动作 AC 完成或模型鉴权解锁。
- 红线：0 模型调用；临时 HOME/workspace；无官方 GUI/用户数据/凭据读取；无 Desktop 外壳、CUA helper 启动、TCC 授权、安全机制绕过或 `session/close`；未接 DSH/Chrome MCP 替代执行器；无第二持久存储。

## 核心探测报告与正式路径判定

探测顺序：先完整读 TASK、official-runtime-install auth 问题一、catalog-management/background-subagents 基座与 reference 宿主链；先真实 headless 注册/空态采集，再实现 responder。后续补采安装包 SDK 自检与物理 helper 制品，最终证据为 [official.json](../../tests/fixtures/browser-computer-use/official.json)、[capture log](../probes/checks/browser-computer-use-capture.log)。

正式 App 3.14.4 / build 3.14.4.7912，官方 cjs SHA-256 `fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`。仅 App-owned Electron **Node 模式**运行 `app-server --stdio`，不启动 Desktop。所有源代码锚点下文相对只读 `reference/ZCode@29628c9`；安装包锚点明确另列，避免把开源占位包当成产品实现。

### 真实 headless / 非模型结果

| 面 | 实际结果 | 能证明 / 限制 |
|---|---|---|
| `runtime/capabilities` | `{independentPlanState:true}` | 协议通；不是 browser/CUA availability 位。 |
| `plugins/list` | browser-use enabled=true、hostMcpServerNames=[node_repl]；node-repl-host enabled=true；两者 mcpServerNames=[]；zcode-cua 未列出 | 已登记插件与宿主元数据，不代表注册了可执行工具/backend。 |
| `mcp/list` status（含 session materialization 后）、connect | 全部 `{statuses:{}}` | 真空态；不虚造 node_repl/CUA 工具条目。未找到 app-server 的独立 tool-list 方法，具体工具注册状态 **unverified（R16）**。 |
| `v4/command createSession` → subscribe | accepted、live、真实空投影，无 browser/CUA 动作/权限事件 | create/subscribe 未调用模型。 |
| 真实 reverse request | `server-1 session/requestRuntimePreferences`，本探测按 -32601 拒绝，官方随后采用缺省并成功创建会话 | 实际官方 stdout 请求→持管道方应答链存在。**这不是 browser 请求实采**。 |
| 主动调用 `interaction/browserList` / `interaction/browserExecute` | 均 -32601 | 只排除主动 request 方向；不能用于否定 reverse carrier。 |
| 安装包 CUA SDK 非模型自检 | 官方 launcher 导入原 SDK，`setupComputerUseRuntime({globals:{}})` 返回 “runtime bridge is unavailable … desktop or shared-host session” | 实测缺 bridge 的正式拒绝；初始化 guard 在 call/socket/helper 前，未执行 Computer Use。 |
| CUA helper 制品 | `Resources/cua-helper/ZCode Computer Use.app/…/MacOS/ZCode Computer Use` 存在 | helper **已随 App 打包**；其运行态/连接/权限/TCC/第三方宿主资格 UNKNOWN，不是“helper 未安装”或“权限已拒绝”。 |
| browser reverse 真实动作触发 | 本次无 browserList/Execute reverse 帧，无模型启动 | browser-specific 实采 **NOT_RUN**；源码+安装包载体证据与注入 responder checks 分别列出。 |

### 三路线判定表（TASK 核心第 1/2 条）

| 路线 | browser-use | computer-use | 源码 + 实证锚点 / 判定 |
|---|---|---|---|
| (a) app-server stdio reverse 回调 | **carrier 可承载**；bridge 已作为正式请求应答器/观察者接线；没有正式 executor 时回空 discovery / backend_unavailable | **执行不走同类 stdio reverse**；操作与权限通知、v4 图片投影可以观察 | `browser-control-broker.ts:54,87,120` 调用 context.requestClient；`server.ts:406,805,855,893` 同管道 result/error 结算与 schema 校验；`transport.ts:74,156` NDJSON 与 response 绕队列。真实 prefs reverse + create 成功、cjs 字符串及源码；browser-specific 帧仍 NOT_RUN。不能从 auth 回调类推 browser executor 已就绪。 |
| (b) Host / Main / helper 执行面 | 官方 GUI Host 注入 Main bridge → Electron parentPort → WebContentsView/CDP；当前 headless bridge 无该 executor，**gated** | shared node_repl → CUA runtime → helper socket；当前无已核实 socket/宿主资格，**gated** | `zcodeAgentService.ts:2402,2432`、`desktop/host/browserControlMainBridge.ts:11,56,116`、`desktop/host/index.ts:233,2432,2877`；`node-repl-host/src/server.ts:372`、`node.ts:1194,1850,1876`。真实目录/空状态与 SDK unavailable；物理 helper 存在。**不将所有 helper 路径笼统判成 GUI-only/永不可达**，只判当前 bridge 无正式连接。 |
| (c) DSH webui 宿主呈现面 | **可达（观察侧）**：注册、请求/响应/错误、精确 browserId/generation/tab、图片 | **可达（观察侧）**：官方事件 envelope、权限 owner/accessibility/screenRecording、node_repl app/image 与 CUA 输出卡 | 已复用 live-session-permission-stop session area、衔接 background-subagents 面板；真实空态/注册实跑+注入生命周期检查、宽窄 Chrome 隔离截图。webui 呈现不成为 browser backend，不产生假的可执行能力。 |

**R09 判断**：browser reverse responder 是 agent 所需正式桥接，不能借 Desktop 外壳排除；因此已经实现。Main/CDP executor 与 CUA helper 当前未获连接，保持 gated；没有为了纳入而启动外壳/签名绕过/自建替代 executor。

### 安装包与开源差异（关键证据）

- cjs 中正式字符串：browserList `line 72 / byte 787391`，browserExecute `72 / 787443`，computer-use operation-event `72 / 784290`，v4 permission-observation `98 / 1124985`；原 artifact SHA 固定，详细 offsets 在 official.json。这些是静态 carrier 证据，不是假称实际执行。
- `reference/packages/zcode-cua/README.md:3`、`broker.js:39` 明确是 unavailable placeholder，**不能用它推断安装包也没有 CUA**。
- 安装包 `glm/packages/zcode-cua-plugin/scripts/computer-use-client.mjs:888` guard 要求 bridge.call；SDK SHA `e44e8ecc6ea289076f61e6b62f7793947c6e9ab8c222a5e87353891d43db1143`。已实际调用缺 bridge self-check。
- 安装包 `glm/packages/node-repl-host/dist/mcp/server.js:117848` 从 broker socket env 捕获 runtime；`:115958` 建立 BrokerClient；`:116064` 包含 standalone helper 懒启动，`:116102` 的 launcher 注释/参数说明签名身份门。该文件 SHA `076d0f3da77460f02d01f66030d6c49176f6420a4cb659b266fc1c7295eefe9a`。这是候选正式制品路径，**未启动/未验证资格**；不能以含 launcher 就宣布 bridge 可执行。dev escape 未启用。
- `bundled-plugins.ts:235` 在 seed/discovery 层按 feature flag suppress CUA；因此“本隔离实例无 CUA plugin”与“安装包有 helper/SDK”不冲突。没有修改 flag 来强行解锁。

## Carrier 核实表（逐项）

| 项目 | 正式 carrier / 源锚点 | 本节接线与实测程度 |
|---|---|---|
| Browser discovery | `interaction/browserList`；shared/zcode-protocol/index.ts:2296；broker.ts:54；Host fallback zcodeAgentService.ts:2402 | params/result 官方双校验，按 reverse wire id 应答；无 executor 为 `{browsers:[]}`。真实正向 -32601 / 源码反向，回调 fixtures。 |
| Browser execute/result/error/image/meta | `interaction/browserExecute`；index.ts:2315；shared/browser-use/result.ts:103；zcodeAgentService.ts:2432 | 无 executor 回 `ok:false/backend_unavailable/sideEffect:none`；非法 params -32602，非法 provider result -32603；target meta 不允许漂移 backend/generation。真实 action NOT_RUN。 |
| Browser lifecycle/cancel | broker.ts:44,98,140（turnEnded、closeSession、cancelRequest） | 正式 command schema 可识别，生产 fallback 仍 unavailable；不自动 retry/关闭 tab/浏览器或发 session/close。真实取消/资源生命周期 NOT_RUN，fixture cancellation/target-closed 原样失败。 |
| Electron Host→Main | desktop/host/browserControlMainBridge.ts:11,56,116；shared/channels.ts:557,654；host/index.ts:2432,2877 | 专用消息面未连接；bridge 不加载/启动 Desktop。30s Main budget 与 bridge 默认 5s callback budget是不同 owner，后续启用实际 executor 前需再核实预算；目前 production 没有 executor。 |
| CUA execution | node-repl-host/src/cua-broker.ts:26,91；server.ts:372；node.ts:1194；安装包 server.js:115958,117166,117848 | helper socket，不是一个可猜的 interaction/computerExecute RPC。当前连接 unverified，SDK self-check 实测拒绝，helper不启动。 |
| CUA operation | `computer-use/operation-event`；index.ts:1049,1091；server-operations.ts:2994；computer-use-operation-event.ts:28,43；zcodeAgentService.ts:1951 | 校验、按 sessionId 过滤、eventId 去重。有 computerUse:true 才显示明确 CUA marker；turn/tool-started 未标记不猜动作名。真实流事件 NOT_RUN；fixtures。 |
| CUA permissions | `v4/cua/permission-observation`；transport.ts:414；v4-gateway.ts:801；v4-bridge.ts:1492；cua-permission-observation.ts:17；shared/cuaPermission.ts:37 | 显示历史观察中的 grantOwner/accessibility/stale/denied/screenRecording；不查询真实 TCC，不恢复历史为授权副作用，不开系统设置/自动授予。真实权限 UNKNOWN；fixtures。 |
| CUA/node_repl 图片与应用 | v4 toolCall.display node_repl_images / output.display cua；rows.ts:191；toolDisplay.ts:67,167,185；官方 UI cua-permission/CuaPermissionObservationAttachment.tsx:118 | 原会话行呈现 inline PNG/JPEG/WebP、app/target、errorCode/suggestedAction/permissionStatus/truncated。artifactUri-only 图片入口明确 gated（R16），不绕过官方 attachment carrier。fixture v4 schema完整校验。 |
| 插件/宿主注册 | `plugins/list` / `mcp/list`，沿用 catalog-management CatalogClient | 每次用户读取都真往返，不缓存目录为第二权威，不 enable/connect/运行工具（产品读 mode=status）。enabled 不解锁 execution；具体 tool list unverified。 |
| webui 呈现 | live-session-permission-stop renderSessionArea → ZCodeConversationView → HostToolsPanel / ToolResult | 真实受限实例已渲染并读取目录；fixtures覆盖错误/图片/权限；无 client-side executor/成功按钮。 |

## 实现清单与不变量

- `ProtocolPeer`：新增 lifecycle-owned `registerRequestHandler`、`onReverseSettled`、显式 `HostCallbackError`；保留 auth/未知 callback 缺省拒绝。callback response 与 forward request 分方向关联；仅持管道方写 `{id,result|error}`，不主动请求同名 method。
- `HostTools`：绑定本 process 的 workspace；严格官方 schemas；foreign workspace/remote identity拒绝，不把外来失败归到本地会话。合法请求与本地 schema拒绝可见；无 executor 的官方 fallback；32条瞬时观察上限、256 eventId 去重上限，图片预览256KiB上限；不持久化官方事实、工具目录、截图或目标资源。
- B05/R22：callback 超时/断连或 response 仍在背压队列便丢失 → **outcome-unknown/uncertain**；signal abort，晚到 result 丢弃，不自动再发/再执行。reply 的 responded 只表示写给 runtime，绝不叫动作 completed。输出背压下，未实际 write 的 reply 不先标 responded。未知/非法结果与官方结构化拒绝都可见。
- `V4Conversation`：注入 HostTools、state内提供本 session records；listener随 conversation关闭释放。`hostRegistration` 只需 live projection/workAdmission，不要求模型 runnable；endpoint只接受 operation+handle；无 caller workspace/session/executor字段。RemoteConversation走同一scoped RPC。
- UI：HostToolsPanel 放在 ControlBar 后、background-subagents WorkPanel 前；按完整会话身份 remount。按需新鲜注册读，失败清旧值；departing/controller替换 abort并fence迟到结果；始终 gated，权限未观察保持 unknown。ToolResult 消费官方 v4 visual metadata；普通 unknown display维持原fallback。
- `browserExecutor` 是 **仅同进程 provider seam**，生产 BridgeHost从未注入；fixtures用它注入成功/拒绝/延迟，仍标 executor-verification-required，不能作为正式executor已核实证据，也无RPC安装入口。

## Fixtures 与检查

| Artifact | 真实性 |
|---|---|
| tests/fixtures/browser-computer-use/official.json | 官方实时capture；注册、空态、prefs reverse、正向拒绝、SDK self-check真实；0models，未注入 browser/CUA动作。 |
| empty.json | official.json的严格真实投影，injectedFields=[]。 |
| lifecycle.json | **明确 injected**：schema同源 browser请求/回答、图片/target拒绝/取消、CUA事件/权限；两条synthetic toolCall rows放入真实transport-v4-convergence空投影envelope。没有冒充真实执行或权限检查。 |
| browser-computer-use-wide.png / browser-computer-use-narrow.png | 隔离Chrome渲染：真实目录元数据 + 注入 reply/timeout/permission；观察侧视觉检查，**不是官方动作oracle**。 |

| 检查 | 实跑结果 / 证据 |
|---|---|
| `node scripts/capture-browser-computer-use.mjs /Applications/ZCode.app`、make-browser-computer-use-fixtures | **PASS**，0models；[capture](../probes/checks/browser-computer-use-capture.log)、[fixtures](../probes/checks/browser-computer-use-fixtures.log)。 |
| `npm test` | **141/141 PASS**，基线124；[log](../probes/checks/browser-computer-use-node.log)。 |
| `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **124/124 PASS**，基线111；[log](../probes/checks/browser-computer-use-integration.log)。 |
| DSH `pnpm … vitest run packages/api/session-controller/tests packages/client/ui-session/tests packages/client/ui-workspace/tests` | **1373/1373 PASS**，60文件；[log](../probes/checks/browser-computer-use-native.log)。 |
| DSH `pnpm … typecheck:contracts-ready` | **PASS**；[log](../probes/checks/browser-computer-use-types.log)。 |
| DSH `pnpm … build` | **PASS**，355 client artifacts；[log](../probes/checks/browser-computer-use-dsh-build.log)。DSH命令统一 `pnpm_config_verify_deps_before_run=false`，沿基线环境。 |
| bridge `npm run build` | **PASS**；[log](../probes/checks/browser-computer-use-build.log)。 |
| `node scripts/check-browser-visual.mjs` | **PASS**，1100px/390px、0 pageerror、0水平溢出；两张PNG已目视；[json](../probes/checks/browser-computer-use-visual.json)。 |
| changed-file oxlint / git diff --check | **PASS**，oxlint 1.76.0、0 diagnostics；[lint](../probes/checks/browser-computer-use-lint.log)、[whitespace](../probes/checks/browser-computer-use-whitespace.log)。 |

覆盖：真实注册/缺executor、same-wire-id reply/forward collision/auth fallback、invalid/foreign params、schema错误可见、失效 target/generation、权限拒绝/取消错误、超时/迟到/断连/背压、替代owner隔离、观察释放/有界去重、图片/应用/权限/未知入口、fresh目录与view替换、真实headless webui呈现。

## NOT_RUN 与后续契约

- 真实browser动作/CDP/IAB、browser-specific reverse请求实采：**NOT_RUN（模型触发与当前无正式执行器）**。没有以fixtures或正向 -32601替代该实证。
- 真实CUA action/权限探测/OS授权/helper启动/签名资格/取消/目标关闭：**NOT_RUN（连接与宿主资格未核实；禁止碰官方GUI/TCC或借dev escape绕过）**。已打包helper不可误报未安装；权限 UNKNOWN 不等于 denied。
- 安装包 standalone helper 路线有静态证据，但当前不接线、不启动；若后续纳入，须先判定正式Launcher身份、socket/authority归属、PiP/权限交互与0模型可测边界，不能复制placeholder或把DSH executor作为替代。
- 真实截图成功来源未核实；projection inline图片与fixture callback图片可呈现，artifactUri-only preview保持unverified/gated。不得自造本地截图存储。
- 独立父节 A+B/admission/audit pack：本 worker **NOT_RUN**；由父节冻结当前候选后执行。
- API：`state.hostTools`；`conversation.hostRegistration({signal})`；RPC `conversation {operation:'hostRegistration',handle}`。Host callbacks自动应答；webui是观察面，没有手工“已执行”应答入口。
- 后续正式executor必须保留browserId/generation/真实tab隔离、取消的possibly-sent语义、deadline与资源归属；不能仅凭启用plugin、SDK制品或模型auth解锁就标available。

## 分块提交

- `8cb1ea8` — chore(protocol): vendor official browser callbacks and CUA observation schemas。
- `6404de7` — feat(host): observe official browser callbacks and computer use in webui。
- `7d9cf58` — test(host): probe official browser and CUA carriers and failure semantics。
- `2325531` — fix(host): surface scoped browser callback schema rejections。
- 最终docs/evidence另组 `docs(handoff)`，真实hash见Git，不虚构本文件自身hash。
- DSH无改动；无push、主干merge或历史改写。父节仍负责独立review与接纳，不自称CLEAN。
