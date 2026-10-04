# S09 HANDOFF — MCP、插件与 Skills 的目录和管理入口

## 身份、范围与交付状态

- TASK：`/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tasks/S09-TASK.md`；PLAN-FULL S09；R02/R07/R14/R18。完整 TASK 先读后执行；模式 EXECUTE_WITH_COMMIT。
- bridge 起点 `4958d1e`，分支 `feat/zcode-runtime-bridge`；DSH 克隆 `/Users/ibobby/Projects/dsh-zcode-acp/dsh` HEAD `21fb059` **本期无任何改动**（本节的 consumer 是 bridge 自带 client 插件，未触及 DSH 产品/测试文件，故无 DSH 提交）。reference/ZCode 与官方 App 只读。
- 当前 worker 的 requested executor/model/effort 与 observed 记录在本会话不可见，记 UNKNOWN，由主调度保留真实 dispatch。未启动子代理；未执行独立 A/B 或父节 admission。
- 自评 **COMPLETE**（受限范围内）：目录读面与管理写面均在真实 headless 实测可达并真实往返，fixtures 全覆盖、回归全绿；真实账号 entitlement 门禁的非空 MCP 状态与网络市场拒绝无法在 0 模型/无真实账号条件下实测，已按 R18 以官方 schema 注入 fixture 并如实标注，未把注入当实测成功。
- 全程真实模型调用 0；未碰官方 GUI、真实用户数据、凭据、session/close。所有真实管理操作只在**专用临时 HOME + 临时 workspace**（隔离官方存储）内执行，真实用户 `~/.zcode` 未被读写。

## 首先执行的真实 headless 可达性检查（TASK 第 1 条）

先执行 `scripts/capture-s09.mjs`（产品 `CatalogClient` 走真实官方 carrier），再写测试。脚本启动已验证官方 Helper+cjs（App 3.14.4.7912，cjs SHA-256 `fad4c35c…6275f`），spawn env 用 `runtimeEnv` 并将 `HOME` 指向临时目录，workspace 为临时目录；不访问真实账号/凭据。结果在 `tests/fixtures/s09/official.json` 与 [capture log](../probes/checks/s09-capture.log)。

**读面可达性（真实到达官方、0 模型调用）**：

| 读面 | 结果 |
|---|---|
| `mcp/list` mode=status / mode=connect | 真实往返；无配置 MCP 时 `{statuses:{}}`（空是真实状态，不是伪造） |
| `plugins/list`（默认 / configScope=workspace） | 真实返回官方内置插件（official 源、enabled、rootPath、components、declared/mcpServerNames） |
| `plugins/referenceCatalog`（workspace authority） | 真实返回 pluginId/marketplace/enabled/conflicts/skillQualifiedNames/mcpServerNames |
| `skills/referenceCatalog`（workspace authority） | 真实返回 plugin 源 skill（`glm:plugin:…`） |
| `plugins/overview` | 真实 marketplace/available/installed/restorable/diagnostics/capability |
| `plugins/validate`（bare / 带 pluginName+marketplace） | 真实返回 ok/diagnostics/compatibility（runnable/diagnosticOnly/unsupported） |
| `plugins/describe` | 真实返回 components + metadata |

**写面可达性（在隔离 HOME 内真实执行，官方结果权威）**：

| 写面 | 结果 |
|---|---|
| `plugins/marketplace/add`（dryRun / 本地 directory 源真实添加） | 真实往返；本地市场 `s09-local` 真实落盘到隔离存储 |
| `plugins/install`（本地市场，隔离存储） | 真实安装成功：`installedPlugins[0].id=s09-demo@s09-local`，version 1.0.0 |
| `plugins/install`（不存在的插件） | RPC 成功但官方 **diagnostics `plugin_dependency_missing`（severity error）、installedPlugins 空**——必须呈现为失败，不能当作新版本 |
| `plugins/setEnabled`（disable→enable） | 真实往返；返回官方 `plugin.enabled` 与 `enabledSource:"workspace"` |
| `plugins/configure` / `plugins/resetConfig` | 真实往返（隔离存储） |
| `plugins/validate` / `plugins/describe`（安装后） | 真实返回组件与兼容矩阵 |
| `plugins/update` / `plugins/uninstall`（removeCache） | 真实往返；uninstall 返回 removedPlugin |
| `plugins/restoreBuiltin` | 真实往返 |
| `plugins/marketplace/remove` | 真实往返 |
| `plugins/cancelOperation`（未知 operationId） | 真实 `{cancelled:false}`（不假报已取消） |
| 安装后 `plugins/overview` 复读 | 真实出现 installed 记录 `s09-demo@s09-local:1.0.0:enabled`；DSH 侧无乐观版本 |

**目录/操作面判定**：读面与写面在真实 headless（0 模型调用）**均可达**，因此实现为真实往返，而不是标 gated。未核实项按 R16 列在 carrier 表。MCP 工具（tools/call 等）从未调用——本节只做目录读与管理，符合红线“不在 DSH 重跑 ZCode 的 MCP 工具”。

## Carrier 核实表（逐项）

路径相对只读 `reference/ZCode`；CLI 分发 `apps/zcode-cli/packages/bootstrap/src/zcode-protocol/server.ts:644–709`（legacy stdio，S01-CARRIERS 已分类）。结果 schema 在 `packages/shared/src/zcode-protocol/index.ts`。

| 项目 | 正式 carrier / 生效 owner | 实现、真实结果与限制 |
|---|---|---|
| MCP 列表 | `mcp/list` → `server.ts:644` `mcp.ts:30` `listMcpServers`；`mcp.ts:78` mode=status、`:94` mode=connect | 实现 `mcpList`（默认 status，可 connect）。官方 `McpServerStatusSnapshot`：status/toolCount/failureKind/authorization/protocolEra。真实空配置返回空；凭据/`mcpServers` 参数不从 UI 透传（见安全）。 |
| 插件目录 | `plugins/list` → `server.ts:646` `plugins.ts:201` | 实现 `pluginsList`；官方 source=official/cache/missing、enabled、components、declaredMcpServerNames；缺配置插件以 `source:"missing"` 回传。 |
| 插件引用目录 | `plugins/referenceCatalog` → `server.ts:650` `plugin-reference-catalog.ts:30`；`plugins/referenceCatalogWithCategory` → `server.ts:648` | 实现 `pluginReference`（无 category）。withCategory 为**已核实但未接线**（category 仅展示性）；未标不可用。 |
| Skill 引用目录 | `skills/referenceCatalog` → `server.ts:652` `skill-reference-catalog.ts:16` | 实现 `skillReference`；workspace authority（无 sessionId）；带 sessionId 时官方要求 resident session，本节不伪造 session authority。 |
| 总览 | `plugins/overview` → `server.ts:674` `plugins.ts:254` | 实现 `pluginsOverview`；marketplaces/available/installed/restorable/diagnostics/capability。 |
| 校验 | `plugins/validate` → `server.ts:706` `plugins.ts:461` | 实现 `pluginValidate`；官方 compatibility 三分类。 |
| 详情 | `plugins/describe` → `server.ts:708` `plugins.ts:487` | 实现 `pluginDescribe`；components + metadata。 |
| 市场增删刷 | `plugins/marketplace/{add,remove,update}` → `server.ts:680–689` `plugins.ts:278/297/313` | 实现三者；add 支持 dryRun；真实本地 directory 源与 remove 均往返。network/git 源属官方网络面，未在无网络/账号下试成功。 |
| 安装 | `plugins/install` → `server.ts:690` `plugins.ts:334` | 实现 `install`；真实安装成功与真实 `plugin_dependency_missing` 失败诊断都保留。官方返回记录 `scope:"user"`（即使请求 scope=workspace），按官方投影原样呈现，不加解释性改写。 |
| 取消 | `plugins/cancelOperation` → `server.ts:694` `server.ts:746` | 实现 `cancelOperation`；只按 operationId 中止对应链路，无匹配即 `cancelled:false`。 |
| 卸载/更新/恢复内置 | `plugins/uninstall` `plugins/update` `plugins/restoreBuiltin` → `server.ts:696–701` `plugins.ts:359/378/417` | 实现三者；真实往返（隔离存储）。 |
| 配置/reset | `plugins/configure` `plugins/resetConfig` → `server.ts:702–705` `plugins.ts:430/447` | 实现二者；真实往返。 |
| 启停 | `plugins/setEnabled` → `server.ts:670` `plugins.ts:229` | 实现 `setEnabled`；官方返回 `plugin.enabled`+`enabledSource`。 |
| 进度通知 | `plugins/operationProgress` → `plugin-reference-catalog.ts:144`；`server.ts:728` `withPluginOperationSignal` 按 operationId 建 AbortController | 实现按 operationId 关联；official schema 仅 `state:"refreshing"`，且仅 suggested-reference 流程发出。本节按事实只呈现“等待期 pending + 可选 refreshing”，**不虚造百分比/阶段**。 |
| 建议引用 | `plugins/resolveSuggestedReference` → `server.ts:666` `plugin-reference-catalog.ts:66` | 已核实，但不在 S09 交付清单（属于另一操作入口）；未接线，也不标不可用。 |
| 入口安全 | — | 只经官方 app-server stdio；无第二目录、无本地持久、无 MCP 工具、无密钥日志。 |

## 实现清单

1. **Host carrier `packages/host/catalog.mjs`**：`CatalogClient`（单 peer、单 workspace、无持久）。`read(kind)` 校验官方 params/result schema，未知 kind fail closed；`operate(action)` 校验 params/result 后发起官方操作，按 operationId 记录 in-flight、拒绝重复活跃 id、`signal` 中止时发官方 `plugins/cancelOperation`；订阅 `plugins/operationProgress`，迟到/未知/非法通知丢弃；`dispose` 取消 pending 但保留有界操作事实。**只读目录不缓存为权威**。
2. **Host 接线 `runtime.mjs` / `index.mjs`**：`#connect` 成功后建 `CatalogClient`（`managementAllowed = installation.verified`），连接重置/失败/dispose 时释放；新增 `catalogRead`/`catalogOperate`/`catalogState`；`handleCatalog` 端点只允许 `read|operate|state` 且拒绝多余 payload key（不能经 UI 携带 workspace/runtime/密钥）。
3. **Client 镜像 `packages/client/catalog.mjs`**：`CatalogStore` 仅作官方事实的显示镜像 + 等待期 pending；回调 refresh 逐节读官方，单节被拒只标该节不可用不造行；`operate` 成功后 refresh 复读官方；`operationOutcome` 把官方 error 诊断判为失败。
4. **Client 视图 `packages/client/catalog-view.jsx`**：MCP/市场/已装/可装/插件引用/Skill 引用分区；启停/安装/卸载/更新/配置/reset/marketplace 增删刷/validate/describe/cancel；admission 拒绝时隐藏管理动作只留读面；账号未知与 entitlement 失败原因如实展示；未知状态/条目有界降级不崩。
5. **入口 `client.jsx`**：`main` slot 新增 `zcode-catalog` 面板；目录侧栏新增入口按钮（`onOpenCatalog`）。StatusCard 保持单一 `role="status"`，避免与既有 S01 渲染断言冲突。
6. **回归测试**：`tests/s09-catalog.test.mjs`（13 项）、`tests/s09.dsh.spec.ts`（11 项）、`tests/fixtures/s09-store.mjs`、派生 fixtures。

## 不变量与安全中间态

- **registered/installed/enabled/running/entitled 区分**：`plugins/list` 的 source(official/cache/missing)与 enabled；`overview` 的 installed vs available vs restorable；MCP 的 status(connecting/connected/disabled/disconnected/failed/untrusted) + failureKind(`not_authenticated`/`coding_plan_required`/oauth)；账号 `auth:"unavailable"` 原样展示。无官方状态时如实展示 denial，不猜、不绕过。
- **失败不当成功**：真实 install 失败返回 RPC ok + `diagnostics[severity=error]`；UI 判为失败并展示诊断，绝不把旧版本说成新版本。`cancelOperation` 未知 id 返回 `cancelled:false`。
- **progress 与 operationId 对应**：通知只附加到同 id 且未终态的 operation；迟到/未知/非法 state 丢弃，不污染当前。
- **乐观 UI 仅等待期**：仅显示“等待官方结果”，随后被官方结果替换并复读官方目录；`CatalogStore` 无本地权威状态。
- **不维护第二份目录 / 不重跑 MCP 工具**：所有读取经官方；测试断言无 `tools/call|tools/list|resources/read`。
- **不向日志输出 MCP 密钥**：`mcpList` 的 build 只传 `{workspace, mode}`，UI 传入的 `mcpServers`/env/headers 全部丢弃；测试断言重放参数不含 `TOKEN`。
- **R18**：entitlement/账号未知时目录照常读、管理写准入由 installation 校验与连接决定；官方拒绝(diagnostics/protocol error)如实呈现且不崩；不把受限标 available。
- **R07 能力可见性**：视图只渲染官方返回的官方能力；DSH-only 功能不冒充官方；DSH 未在 ZCode session 上叠 loop/tool。

## Fixtures 与实跑检查

- `scripts/capture-s09.mjs`：真实采集（读+写，隔离 HOME/workspace），断言的本地市场/插件均为合成测试内容，非用户数据；tmp 路径别名化；stderr 只计字节。
- `scripts/make-s09-fixtures.mjs` 从 official.json 派生 `directory.json`（真实目录投影，含安装后 overview）、`operations.json`（真实管理结果，含真实失败诊断）、`entitlement.json`/`unknown.json`/`progress.json`（**按官方 schema 注入**，provenance 逐项标注；因无真实账号/无配置 MCP，不能充当实测成功）。
- 测试用 `tests/fixtures/s09-store.mjs` 为受控官方 stdio 假官方端口，无产品存储。

| 检查 | 实跑结果 / 证据 |
|---|---|
| `npm test` | **111/111 PASS**（原 98 保留），0 skip；[node](../probes/checks/s09-node.log)。 |
| bridge DSH 全集成 | **101/101 PASS**（原 90 保留），0 skip；[integration](../probes/checks/s09-integration.log)。 |
| DSH native 指定回归 | **1373/1373 PASS**，60 files；[native](../probes/checks/s09-native.log)。 |
| DSH `typecheck:contracts-ready` | **PASS**（0 error）；[types](../probes/checks/s09-types.log)。 |
| bridge build / DSH full build | **PASS / PASS，355 artifacts**；[bridge build](../probes/checks/s09-bridge-build.log)、[DSH build](../probes/checks/s09-dsh-build.log)。 |
| 真实 headless capture（读面+写面，隔离存储） | **PASS**，paidModelCalls=0；[capture](../probes/checks/s09-capture.log)。 |
| 两仓 touched-file oxlint / `git diff --check` | **0 error 0 warning / PASS**；[lint](../probes/checks/s09-lint.log)、[whitespace](../probes/checks/s09-whitespace.log)。 |
| DSH 仓改动 | **无**（无 DSH commit）。 |

## NOT_RUN

- 非空真实 MCP 连接状态（需配置真实 MCP/网络/账号）：`NOT_RUN`；本节以 `mcp/list` 真实空配置往返 + 官方 schema 注入 entitlement 状态覆盖。
- 真实账号 `not_authenticated`/`coding_plan_required` 与远程市场刷新/安装的官方拒绝：`NOT_RUN`（无真实账号/网络）；以官方 schema 注入 fixture 覆盖呈现，不冒充实测。
- 官方 GUI / DSH packaged GUI / 多客户端共享 catalog authority：`NOT_RUN`（红线）。
- `plugins/validate` 对**远程未安装源**的校验、`resolveSuggestedReference` 刷新：`NOT_RUN`（需网络）。
- 未以任何 fixture PASS 替代上述真实成功。

## 给后续契约

- 端点：`rpc.call('/zcode-bridge','catalog',{operation:'read',kind,params})`、`{operation:'operate',action,params,operationId?}`、`{operation:'state'}`；host 侧 `CatalogClient.read/operate/state`。kind/action 白名单见 `CATALOG_READ_KINDS`/`CATALOG_OPERATIONS`。
- 任何管理操作都应带 operationId（UI 生成 UUID）；官方 progress 与取消都按该 id 关联；同 id 活跃时 host 拒绝重复。
- 需要 session-scoped 插件/Skill 引用时，必须走 resident session 的 sessionId（官方 fail closed），不得回退 workspace authority。
- 后继不得在 DSH 复制目录、缓存为权威或代执行 MCP 工具；denial 一律以官方 diagnostics/protocol error 为准。
- 若父节要暴露 `referenceCatalogWithCategory` 或 `resolveSuggestedReference`，属新增接线（carrier 已核实），应另立有界项。

## 分块提交

- bridge `78b848f` — `chore(protocol): vendor official MCP plugin and skill schemas`。
- bridge `2b2701b` — `feat(catalog): expose official MCP plugin and skill directory and management`。
- bridge `6c48dce` — `test(catalog): probe official reachability and cover directory and management semantics`。
- docs/evidence 另组提交；本文件不虚构自身 commit hash。DSH 仓无提交；无 push、无主干 merge、无历史改写。

本 worker 只提供实际 Git/脚本/检查/fixture 证据，等待父节独立 A+B 覆盖与 admission；不自行宣称 CLEAN，不组装父级 audit pack。
