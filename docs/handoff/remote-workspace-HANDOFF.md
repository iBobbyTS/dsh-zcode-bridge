# remote-workspace — Mac 客户端正式 remote workspace/session/SSH/WSL

## 范围、身份与结论

- 完整先读 TASK `/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tasks/remote-workspace-TASK.md`；合同 PLAN-FULL remote-workspace + R02/R11/R21/R22，按 TASK 已授权受限态执行。沿用 AUTH-SOURCE-RESEARCH、browser-computer-use/automation-offpeak Host 专用判定和 session-directory-lifecycle 完整会话身份。EXECUTE_WITH_COMMIT。
- bridge 起点 `bbbe6c41b130dbb06a3e08a1dc575f2586aa9e81`，分支 `feat/zcode-runtime-bridge`；DSH 克隆起点及最终均为 `21fb059745ddc1b78e387c24f3987b68569de236`，工作树干净，**无 DSH 源码/测试配置修改、无 DSH 提交**：既有 sidebar/main 消费槽位已经满足呈现需要，不造空提交。reference 与官方 App 只读。
- reference/ZCode `29628c9acdb81b703bbd4080c207a0e7ce5e276e`；官方 App `3.14.4 / 3.14.4.7912`，cjs SHA-256 `fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`；app.asar SHA-256 本轮重新只读核验为 `232e913ea13d60bd0ecc86bf9f2f145328809608fe4d48e76685d61a8076aef0`，与 AUTH-SOURCE-RESEARCH B02 一致。
- Requested worker：external codex / gpt-6.1-sol / high / yolo；本会话可独立核验的 external agent_id、observed model/effort/transport 为 **UNKNOWN**，由父调度保留实际 dispatch。子代理 NOT_USED；本 worker 不执行独立 A/B、父节接纳或父 PLAN 归档。
- 自评 **COMPLETE（TASK 受限范围）**：完成双路可达性核实、三分类判定、legacy/v4 检查、不可用/UNKNOWN 呈现、身份拒绝与回归。原 PLAN 的真实 Mac→远端 workspace/续接/工具/断线恢复 oracle **NOT_RUN**；没有把本地或 fixture 成功算作 remote 成功。
- 真实模型调用 **0**。只启动自有官方 app-server child，专用临时 HOME/workspace；未碰官方 GUI、真实用户数据/凭据、独立 server/zcode-server-cli、真实 SSH/WSL/Docker、`session/close`。未新增 remote 存储、连接器、执行器或隧道服务。

## 探测报告：源码 + 真实 headless

### A. 源码路由核实

下列源码路径相对只读 reference/ZCode。

| 锚点 | 事实与约束 |
|---|---|
| `apps/zcode-cli/packages/bootstrap/src/zcode-protocol/server.ts:459–718` | 完整 dispatcher 同时枚举 legacy 与 v4；没有 remote workspace/session 管理、SSH/WSL/Docker 连接或 Desktop IPC/HTTP case；default 为 `ProtocolRequestError(-32601)`。不是仅按名字搜索声明表下结论。 |
| `packages/shared/src/zcode-protocol/index.ts:3575`；`zcode-protocol-v4/command.ts:46–245,323–365` | legacy 方法表无 remote 管理 RPC；v4 的 command type 闭集无 connectRemote/remote 管理命令。createSession/renameSession/deleteSession 操作当前 runtime，不建立 remote authority。 |
| `packages/shared/src/zcode-protocol-legacy-types.ts:34–42`；`zcode-protocol/index.ts:2304,2325` | 正式 WorkspaceRef 保留 workspaceIdentity/remoteSessionId；browser 反向 params 也可带 remoteSessionId。这是 **已可信路由的上下文**，不是连接/发现 RPC；本节没有删掉这些协议字段或冒充可信 remote Host。 |
| `apps/zcode-cli/packages/bootstrap/src/zcode-protocol/server-operations.ts:1622–1669` | session/list 只读本进程 sessionStore/live registry，并按 workspaceIdentity/path 与 workspaceKey 过滤；它不是跨 server/Host remote 目录。bridge 沿用 session-directory-lifecycle scoped list，不新增第二目录，也不把 remote key 当本地路径查询。 |
| `packages/shared/src/zcode-protocol-v4/transport.ts:46,73,422–435` | web-remote-replayable/mobileRemote 是投影客户端种类；subscribe.workspace/legacyTaskIds 来自可信 Host attachment。它们不建立 SSH、WSL 或远端进程。 |
| `packages/desktop/src/main/desktopRemoteSessions.ts:164–190,241–309,662–762,881–941` | Main 持有 window→Host 与 logical session 路由，创建/转移 MessagePort；bind 检查窗口归属；attach 明确拒绝 MISSING/OFFLINE/WINDOW_MISMATCH/WORKSPACE_IDENTITY_MISMATCH；workspacePath、workspaceIdentity 与 workspaceKey 必须一致。official-runtime-install E09 的端口归属在本节精确核实。 |
| `packages/desktop/src/main/desktopMainIpcRemote.ts:497–591`；`desktop/src/preload/index.ts:257–278`；`shared/src/channels.ts:173–197` | connect/cancel/bind/dispose/discovery 与 remote log/closed/reconnect 走 Electron Main IPC，非 NDJSON forward/reverse methods。 |
| `packages/desktop/src/host/index.ts:2938–2976`；`packages/server/src/remote/create-backend.ts:6–41` | Desktop Main 发 HostMessage，窗口 Host 装配 createRemoteBackend/connectRemote，选择 SSH/WSL/Docker backend；执行/部署/远端 server 生命周期在 Host/独立进程。 |
| `packages/server/src/http.ts:318–367,419–446`；`server/src/entry-stdio.ts:39–52` | 独立 server 的 HTTP connect、server-info、capability、WS ChannelServer；`/ws/remote/:id` 的 id 一次取出，missing/unknown 关闭 4000/4004，并只装配 file/git/system/terminal 四个 service，不是完整 remote agent/session 目录。server stdio 先 zcode-hello/hello-ack，随后 SocketProtocol，不能当 app-server NDJSON。 |
| `packages/zcode-server-cli/src/server-core/http.ts:126–132` | Core 默认 127.0.0.1，非 loopback 在鉴权未接入时明确拒绝。未启动、未连接该服务；未把源码路径当作当前 App 对外 listener。 |
| `packages/server/src/remote/wsl-detect.ts:159–184`；`remote/remotePlatformSupport.ts:3–13` | 本机 WSL discovery 只在 win32；macOS 返回空数组是该 Windows-only 组合的实现行为，不能报为已探测 WSL 环境。现有 remote backend 要求 POSIX shell，拒绝 Windows 原生远端；没有把 WSL/Linux 远端协议从需求裁掉。 |

### B. 真实 headless oracle

运行 `node scripts/capture-remote-workspace.mjs /Applications/ZCode.app`，最终原始采集见 [official.json](../../tests/fixtures/remote-workspace/official.json)、[capture log](../probes/checks/remote-workspace-capture.log)。测试只向自有 app-server 的 NDJSON 管道发请求；**IPC/HTTP 名称发到 NDJSON 的负向结果仅证明此 transport 没有该 case，不能替代其原生 transport 功能实测**。通知名称也仅作为不存在的 forward request 探测，没有发送官方 Main 事件。

| 探测 | 官方实际结果 | 判定 |
|---|---|---|
| 11 个 Desktop IPC request/notification 名称 | 全部 `runtime-rejected / -32601` | Desktop Main 专用，当前 stdio 不可请求 |
| 6 个独立 server HTTP/WS 路径名（含 `/ws/remote/:id`） | 全部 `runtime-rejected / -32601` | 独立 server 专用，当前 stdio 不可请求；未发 HTTP/WS 请求 |
| `v4/command` + 人工未知 type `connectRemote` | 正式 ACK `status:rejected`, `reasonCode:proto.invalidPayload`, `revisionAtDecision:0` | v4/command 本身可达；该 type 非正式命令，未执行，不能称 -32601 或 -32602 |
| `runtime/capabilities` | `{independentPlanState:true}` | 可达，但无 remote 能力位，不推断连接可用 |
| `session/list` + 专用本地 workspace | 正式 `sessions:[]` | app-server stdio 可达，真实 **本地**空目录；不是 remote 空目录 |
| 无 firstInput 的 v4 createSession + subscribe | 本地投影 `live`，admission false，web-remote-replayable | 已有 v4 投影可达；没有 remote 连接或模型输入 |
| 同一 owned child 交给生产 BridgeHost 后 `remoteState()` | 本地 scope + connection unavailable、remote identities null、inventories null/UNKNOWN、所有 available false | 真实生产消费 oracle；未增加测试专用产品 attach 面 |

物理 capture 共 3 次：首轮将未知 v4 type 错按 RPC 异常断言，故脚本 FAILED；实际 runtime 已返回 rejected ACK，保留 [首轮 JSON](../probes/checks/remote-workspace-capture-attempt1.json) 与 [日志](../probes/checks/remote-workspace-capture-attempt1.log)。第二轮修正 ACK 断言并等投影 live，16 outer carriers PASS；其临时输出随后被扩大清单的第三轮覆盖，未单独归档。第三轮加入 `/ws/remote/:id`，17 outer carriers PASS。全部模型调用 0；没有用脚本断言错误冒充 remote 功能失败。

## 三分类判定与 carrier 核实表（逐项、含弃用）

`可请求` 列指 **当前 app-server NDJSON**，不是原生 transport 的能力；所有 Desktop/独立 server 行均无 CLI legacy 方法/无 v4 remote successor。`非弃用` 表示当前 reference 声明/消费仍存在、无 @deprecated；不表示 bridge 可执行。

| 面 / 正式 carrier | 三分类 owner | legacy/v4 双路及弃用 | 可请求 / 本节 |
|---|---|---|---|
| `session/list`（本地 scoped 目录） | app-server stdio 可达 | legacy 仍正式，**非弃用**；v4 sessions-index 是已可信 runtime 的投影，非 remote connector，**非弃用** | 真实可达；沿用 session-directory-lifecycle，scope 为本地 owned authority |
| v4 `createSession` / `v4/conversation/subscribe` | app-server stdio 可达 | v4 正式，**非弃用**；WorkspaceRef remote 字段仍保留；无 remote 管理 type | 本地 draft/live 实测；不把 clientMode 解释为 remote connection |
| `zcode:connect-remote` | Desktop Main 专用 | Electron IPC，非 legacy/v4 RPC，**非弃用**；Host backend 执行 | -32601；连接 unavailable |
| `zcode:cancel-pending-remote-connection` | Desktop Main 专用 | 同上，**非弃用** | -32601；无 pending remote 请求可取消 |
| `zcode:bind-remote-workspace-session-context` | Desktop Main 专用 | 同上，**非弃用**；窗口/身份检查 | -32601；不接纳 caller remote identity |
| `zcode:dispose-remote-session` | Desktop Main 专用 | 同上，**非弃用**；不等同 session/close | -32601；无 remote dispose 按钮 |
| `zcode:list-ssh-config-aliases` | Desktop Main 专用 | 同上，**非弃用**；本机服务读 SSH config | -32601；不读真实 SSH config/凭据 |
| `zcode:list-wsl-distros` | Desktop Main 专用 | 同上，**非弃用**；Windows-only discovery | -32601；macOS 本机 WSL 组合单独 blocked |
| `zcode:is-docker-available` | Desktop Main 专用 | 同上，**非弃用** | -32601；未探测本机 daemon |
| `zcode:list-docker-containers` | Desktop Main 专用 | 同上，**非弃用** | -32601；不伪造容器列表 |
| `zcode:remote-connection-log` | Desktop Main 专用 | Main→Renderer notification，非 legacy/v4，**非弃用** | forward 请求 -32601；未收到连接日志，不伪造 |
| `zcode:remote-session-closed` | Desktop Main 专用 | Main→Renderer notification，**非弃用** | forward -32601；无断线/关闭成功事实 |
| `zcode:bot-remote-workspace-reconnected` | Desktop Main 专用 | Main→Renderer notification，**非弃用** | forward -32601；不伪造重连事件 |
| POST `/api/connect-remote` | 独立 server 专用 | HTTP，非 legacy/v4，**非弃用**；shared RemoteTarget ssh/wsl/docker | 名称发 NDJSON -32601；未连 server/SSH |
| WS `/ws/remote/:id` | 独立 server 专用 | WS/ChannelServer，非 legacy/v4，**非弃用**；一次 id，四服务面 | 名称发 NDJSON -32601；不是 remote agent/session RPC 替代 |
| GET `/api/server-info` | 独立 server 专用 | HTTP，**非弃用**；serverRemoteInfo version/workspaces/capabilities | 名称发 NDJSON -32601；官方远端 inventory UNKNOWN |
| POST `/api/rpc-host-capability` | 独立 server 专用 | HTTP，**非弃用**；一次 capability（AUTH E11） | 名称发 NDJSON -32601；不申请 capability |
| WS `/ws` | 独立 server 专用 | terminal-client / ChannelServer，**非弃用** | 名称发 NDJSON -32601；不假设可提升 trusted Host |
| WS `/ws/host` | 独立 server 专用 | capability 保护 trusted Host / ChannelServer，**非弃用** | 名称发 NDJSON -32601；未连接 |
| server `entry-stdio` / server-cli Core | 独立 server 专用 | zcode-hello/SocketProtocol 与 loopback HTTP，非 CLI legacy/v4；**非弃用** | 静态核实，启动 NOT_RUN（TASK 禁止） |
| remote workspace/session 恢复、发现、执行、断线恢复 | Desktop Main 路由 + Host/独立 server 权威 | 持久 workspace snapshot 在 shared/protocol.ts；runtime 会话协议保留；没有当前 stdio 的跨宿主管理 successor | unavailable/UNKNOWN；不创建本地同名会话或第二目录 |

结论不是“官方没有 remote 协议”：**正式 remote 路由/外层服务存在，当前接入的自有本地 app-server 不提供连接/宿主目录。** 未发现新增可安全直连的 remote 管理面，因此没有用猜测的 `remote/list`、伪 Host 或本地文件补齐。

## 实现与不变量

1. `packages/host/remote.mjs`：已核实 outer carrier 元数据（owner/transport/direction/deprecated/requestable），无转发/连接/存储；投影中 inventories `items:null` 表示不可读，remoteAuthority/remoteSessionId 恒 null，SSH/WSL/Docker 独立不可用原因。hostPlatform 是实际 process.platform，首宿主仍 macOS。
2. `BridgeHost.remoteState()`：仅活着的本地 peer 提供 scope，断线/dispose 清 scope；remote admission 恒 false。connect 对任何 `remote:` workspace（包括未来未知 kind）在 realpath/child launch 前报 `remote-workspace-unavailable`，不把远端路径落到本地。
3. `/zcode-bridge` `remote {operation:'state'}`：严格单字段、只读；拒绝目标、凭据、remoteSessionId/workspaceIdentity、其他操作；取消返回 cancelled。已有 sessions/open 的完整 authority/workspace 匹配继续拒绝 foreign/stale 同 sessionId，不默默重定向。
4. `RemoteStore`：仅瞬时显示镜像，无持久化；严格 bridge projection schema（**不是伪造的官方 schema**），不允许 available/connected/remote rows 或未来未知 target kind；失败/刷新/换连接先撤旧 scope，generation fence 迟到结果，dispose 释放 generation observer。
5. `ZCodeRemotePanel` + client/directory：既有 sidebar/workspaces/main 槽位新增 `zcode-remote`；中英展示远程管理 unavailable、不可读目录 UNKNOWN、本地 scope 与三个 target 原因。刷新只读状态，无连接/SSH/WSL/删除/取消副作用按钮；官方 carrier 名称放在折叠详情。现有会话面仍为 session-directory-lifecycle 本地 scoped 目录。
6. probes/fixtures：真实本地空目录与 production projection；disconnect/unknown kind 明确 injected。没有模拟成功 remote 行、连接状态、SSH session 或 WSL 环境。

## Checks、证据与 NOT_RUN

| 实跑命令 | 结果 / 日志 |
|---|---|
| `node scripts/capture-remote-workspace.mjs /Applications/ZCode.app` | **PASS（最终）**；17 outer -32601、v4 rejected ACK、本地 live、0 models；[capture](../probes/checks/remote-workspace-capture.log) |
| `node scripts/make-remote-workspace-fixtures.mjs` | **PASS**；[fixtures](../probes/checks/remote-workspace-fixtures.log) |
| `node --test tests/remote-workspace.test.mjs` | **7/7 PASS**；[targeted Node](../probes/checks/remote-workspace-targeted-node.log) |
| `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs tests/remote-workspace.dsh.spec.ts` | **7/7 PASS**；[targeted integration](../probes/checks/remote-workspace-targeted-integration.log) |
| `npm test` | **189/189 PASS**（基线 182）；[Node](../probes/checks/remote-workspace-node.log) |
| `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **164/164 PASS**（基线 157）；[integration](../probes/checks/remote-workspace-integration.log) |
| DSH `pnpm exec vitest run packages/api/session-controller/tests packages/client/ui-session/tests packages/client/ui-workspace/tests` | **1373/1373 PASS**，60 文件；[native](../probes/checks/remote-workspace-native.log) |
| DSH `pnpm run typecheck:contracts-ready` | **PASS**；[types](../probes/checks/remote-workspace-types.log) |
| DSH `pnpm run build` | **PASS**，355 client artifacts；[DSH build](../probes/checks/remote-workspace-dsh-build.log) |
| `npm run build` | **PASS**；[bridge build](../probes/checks/remote-workspace-build.log) |
| `node scripts/check-remote-visual.mjs` | **PASS**，1100px/390px、0 pageerror、0 overflow、0 available claim；[JSON](../probes/checks/remote-workspace-visual.json)、[wide](../probes/checks/remote-workspace-wide.png)、[narrow](../probes/checks/remote-workspace-narrow.png)，两图已目视 |
| changed-file oxlint / `git diff --check` | **PASS**；[lint](../probes/checks/remote-workspace-lint.log)、[whitespace](../probes/checks/remote-workspace-whitespace.log) |

DSH 命令沿用基线 `pnpm_config_verify_deps_before_run=false`。类型检查与 DSH build 实际有时间重叠，不声称其写出的产物完全独立；后者全量 build 成功，所有源码不变。日志只规范化行尾空白；checks manifest 保留运行结果与原始日志 SHA-256。最终 Node/集成/bridge build 在 lint 等价的 Array.from 修改后重跑；无放宽测试、无删除基线。

覆盖：真实负向 carrier/v4 rejection、本地空态与 remote unreadable 区分、UNKNOWN/受限/未来类型错误、endpoint 注入拒绝、已知/未知 remote key 不启动本地进程、foreign authority/workspace 同 ID 拒绝、断线 scope 清理、刷新失败/迟到/代际/释放、三个连接类型、中英视图、侧栏消费点。

**NOT_RUN**：正式 Desktop Main/Host attach；独立 HTTP/WS/server stdio/Core 启动；真实 SSH/WSL/Docker 连接/发现/部署；真实 remote workspace/session 发现/续接/工具执行/断线恢复；官方 GUI + DSH 共享 remote authority 并存；remote expired/window/identity mismatch 的官方实时拒绝。原因均为 TASK 红线/无已接纳连接与凭据路径，相关源码与拒绝 fixtures 不冒充实时 oracle。独立 A/B、父 admission/audit pack 由父流程完成，本 worker 未执行。

## 给后续节的契约与分块提交

- `remote` endpoint 是不可用原因与当前本地 scope 的显示契约，不能被调用方参数解锁；remote inventories null 不得改成空列表来暗示已查询。
- 首宿主 macOS 不变；WSL discovery 的 Windows Host 要求是精确组合限制，SSH/POSIX/独立 server 正式协议保留。未来 remote 路线必须先核验官方安装制品、Host 身份/attachment、远端 runtime authority、canonical workspace key、服务面、凭据正式来源、多客户端及断线恢复；不能凭 web-remote-replayable/clientKind 或 server-info 报可连接。
- remoteSessionId 是外层 logical connection identity，不是 agent sessionId；必须保留窗口/authority/workspace/generation，不能与 session-directory-lifecycle 本地 address 映射或共用同 ID 恢复。不得根据断线建本地同名会话，也不得拿 `/ws/remote/:id` 四服务代理冒充完整 agent/session authority。
- bridge 提交分组：`feat(host)`（受限投影/identity gate）、`feat(client)`（显示镜像/面板/入口）、`test(remote)`（官方 capture/fixtures/checks）、`docs(handoff)`（本交付文档/证据）。具体已产生 hash 见下方与 Git；不虚构本文件自身提交 hash。DSH 无修改，无 push、main merge 或历史改写。

已产生提交：`1e75fcf` Host；`699ae14` Client；`16f4c22` probes/fixtures/tests（最终产品/测试 head）。检查清单及原始日志 SHA-256 见 [remote-workspace-checks.json](../probes/checks/remote-workspace-checks.json)。文档/证据单独提交后不改变产品/测试候选。
