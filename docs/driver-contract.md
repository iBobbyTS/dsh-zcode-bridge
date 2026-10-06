# ZCode driver skeleton contract

核验日期：2026-10-06。实现基线：`cc4fbc720ec8705918ed4ab5aaef85728067d2e9`。
本节只占用 factory、建立空会话和持久化身份绑定；输入、事件翻译、历史修复、目录导入与模型适配属于后续任务。

## 契约 probe

证据根：

- `DSH=/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/dsh-official`，源码包版本 `0.2.1-alpha.1`。
- `NPM=/private/tmp/dsh-local-npm-verify/npm/node_modules/@deepseek-ai`，npm 实物版本 `0.2.0-rc.2`（只读）。

实际执行（exit 0）：

```sh
node packages/driver/contract-probe.mjs \
  /private/tmp/dsh-local-npm-verify/npm/node_modules \
  /Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/dsh-official
```

probe 去掉注释/空白/分号后逐项比较接口体、事件清单和 header 闭集，并导入 npm 的真实 `agentEvents`，核验三个派发方法的载体和 subject 注入。结果：**逐项一致**，未发现动摇本任务前提的契约差异。版本号有差异，driver 的 DSH peer 精确钉为 npm 实测的 `0.2.0-rc.2`；Cordis 沿官方 npm peer 风格钉为 `~4.0.4`。driver 必需的接口 peer 不标 optional。

| 项目 | 源码证据 | npm 实物证据 | 结果 |
|---|---|---|---|
| `AgentFactory.createAgent(ownerCtx, options)` / `resume(ownerCtx, options)` | `$DSH/packages/core/agent/src/index.ts:171` | `$NPM/dsh-agent/lib/types/index.d.ts:153` | 一致 |
| `AgentHandle { agent, dispose(): Promise<void> }` | 同文件 `:160` | 同文件 `:143` | 一致 |
| 调用方 `sessionId`、`resumeSessionId`、setup/commit、signal、owner | 同文件 `:63/:125` | 同文件 `:48/:109` | 一致 |
| `agent/*` 事件词汇 | `$DSH/packages/core/agent/src/runtime-types.ts:245` | `$NPM/dsh-agent/lib/types/runtime-types.d.ts:241` | 一致，见下方清单 |
| `AgentEventDispatch` 与融合 subject/carrier | `$DSH/packages/core/agent/src/dispatch.ts:55/:107` | `$NPM/dsh-agent/lib/types/dispatch.d.ts:44/:93`，`lib/index.js:242` | 一致；npm 三方法实际派发通过 |
| `SessionHeader` | `$DSH/packages/core/session/src/types.ts:94` | `$NPM/dsh-session/lib/types/types.d.ts:58` | 一致 |
| V4 header 闭集 | `$DSH/packages/session/session-format-v3-to-v4/src/validation.ts:19` | `$NPM/dsh-session-format-v3-to-v4/lib/index.js:946` | 一致 |
| `SessionEvent.ignorable?: true` | `$DSH/packages/core/session/src/types.ts:511` | `$NPM/dsh-session/lib/types/types.d.ts:507` | 一致 |

事件清单（12）：`agent/created`、`agent/disposed`、`agent/status`、`agent/inbox/inserted`、`agent/inbox/claimed`、`agent/inbox/discarded`、`agent/pre-step`、`agent/request`、`agent/request-error`、`agent/assistant-stream`、`agent/turn-stopping`、`agent/error`。

Header 必需字段：`version/id/createdAt/isSeeded/delegationDepth`；可选字段：`cwd/parentSession/origin/agentPreset`。没有外部会话 ID 扩展字段。

npm `dsh-agent` 实际运行时导出：`AgentRegistry/default`、`agentCarrier`、`agentEvents`、`assembleContextFor`、`emitAgentEvent`、`foldConsumedWork`、`installModelSelection`；`AgentFactory` 和 `AgentHandle` 是类型接口，没有运行时构造器。driver 通过工厂对象实现接口，调用官方 `createScope` 和 `agentEvents`。

## 实现约束与身份

- `agents.setFactory()` 是第一项注册动作；准确的单例冲突消息被捕获后返回 `blocked-official-loop-active`。其它错误保留失败语义。blocked 时不注册投影、不连接 ZCode、不替换官方 factory。
- occupied 后才注册标准 `turnBoundary@2` 和 `inbox@1` 的纯 fold。官方时序证据：`$DSH/packages/core/agent/src/index.ts:358`、`agent-loop/src/index.ts:364`、`packages/session/session-projection/src/index.ts:273`。
- host 通过 Cordis `zcodeBridgeHost` 服务共享已有 `BridgeHost` 和 launcher。driver 的 `LauncherPeer` 只拥有协议监听器，不销毁 host、不新增进程或认证路径。空 `createSession` 不带 `firstInput`，不会启动模型轮次（`packages/host/vendor/zcode/v4.mjs:8555`）。
- 新建：先验证/prepare 官方调用方 ID，再获取 ZCode draft ACK；在尚未公布的 log seed 中加入 `zcode-driver/conversation-bound` 事件，持久化后按 `sessions.enter → agents.enter → sessions.announce → await agents.announce` 公布。header 中没有绑定字段。
- 绑定示例：`{type:'zcode-driver/conversation-bound', seq:0, time:<epoch>, ignorable:true, data:{sessionId:'DSH-X', zcodeConversationId:'zcode-conv-Y'}}`。
- `Session.append()` 没有 `ignorable` 写入参数（源码 `packages/core/session/src/index.ts:718`，npm `dsh-session/lib/types/index.d.ts:246`）；不能传第三参数假装落盘。实现重新 prepare 未公布的 seed，保持官方 ID/header，并把完整 envelope 经写句柄 append。未公布 setup 追加的事件同批持久化。
- 恢复：`persistence.open(id,'write') → read(0)`；有绑定用 ZCode id，无绑定使用 SessionId 本身（导入身份路径）。无效/相互矛盾绑定拒绝。interrupted-turn repair 本节未实现。
- setup、commit、announce 失败时关闭写句柄、移除两 registry 条目、释放 scope。已经交付给监听器的创建通知无法撤回，按官方 registry 语义配对 disposed；本节不宣称撤回通知。ZCode 已确认但 DSH 创建失败的空 draft 不执行远端删除补偿。
- Agent 基线 idle，inbox 空；无活跃活动 cancel 是 no-op；maintenance 支持取消与 whenIdle 等待。输入方法显式报 `driver-command-unavailable`。带历史的 create 显式拒绝，避免以空 draft 假装继承历史。
- teardown memoized：停驱/等待 maintenance → 关闭写句柄 → agent 反注册 → session 分离 → scope 释放；caller signal 返回前解除。owner/provider 在 setup/load 阶段退出会取消，晚到的写句柄也会关闭。Cordis composite effect 将 factory 清除放在 live handle drain 之后。
- status 扩展：`value.driverState = {state, reason}`，state 为 `blocked-official-loop-active` / `occupied` / `unavailable` / `disposed`。互锁说明在 reason；UI 提示不属本节。

## 验收结果

1. 契约 probe：exit 0，逐项一致。
2. `node --test tests/zcode-driver-factory.test.mjs`：12/12，通过双占用时序、身份 create→显式拒绝 prompt→resume、导入无绑定 fallback、idle/maintenance、setup/commit/announce 回滚、晚到句柄关闭、owner/provider 卸载、host status、bundle 行与空 draft launcher 通道。
3. 隔离 npm web profile 实测：两次 HTTP 200、`ok=true`、`pluginErrors=[]`、launcher `ready`、auth `authenticated`。官方 loop 启用：`driverState.state=blocked-official-loop-active`；隔离 profile 手动追加 `{id:'agent-loop',disabled:true}` 后：`occupied`。交付 patch 不含官方 disabled 行。
4. `npm test`：465/465 通过（基线 453 + 新增 12）；`npm run build`：exit 0。构建命令仍只处理现有 client；driver 是直接可导入的 ESM，新包尚未接入根 build/发布文件图，见下方边界缺口。
5. 新增 `index.mjs` 和 `factory.mjs` 的 Node ESM 动态 import：exit 0。未运行依赖外部 `../dsh` 的 vitest/`.dsh.spec.ts`，不将其报为通过。

额外实物验证：直接使用 npm Cordis/AgentRegistry/SessionStore/SessionProjectionRegistry 与 npm JSONL persistence 创建 `DSH-X`；落盘读回 binding 保留 `ignorable:true`；恢复目标为 `zcode-conv-Y`；最终两个 live registry 都返回 undefined。ZCode transport 为最小桩，不宣称已验证真实 prompt。

## 隔离环境附录与剩余边界

首先实际执行现有脚本：

```sh
node scripts/start-npm-acceptance.mjs --prepare-only --diagnose-version-seams --port 3214
```

新 npm 安装失败：`npm-install` exit 1，`ETIMEDOUT`；记录在 `/var/folders/93/2s7hmqvj0t13nr6xmnkcbthc0000gn/T/dsh-closure-acceptance-npm-lzrsmi/npm-install.log`。没有修改脚本。

后续隔离实测使用 `/private/tmp/zcode-driver-isolated`：将只读 npm rc.2 实物和 web profile 复制到该新目录，只复制 profile 配置/包而不复制原会话存储；更新副本 host 入口、bundle patch，加入 driver 包和 profile dependency。沿用脚本的 launcher 配置，把 scratchRoot 改为 `/private/tmp/dshw/d1`，为两次启动分配 `blocked` / `occupied` runId。只有副本 profile 写官方 disable。启动官方 `dsh web --no-open --port 3214`，从该子进程生成的本地凭据请求 status，随后终止这两个自有 web 子进程。

实际结果：`/private/tmp/zcode-driver-isolated/results.json`；执行器：同目录 `probe.mjs`。blocked PID 29601；occupied PID 29873，均已停止。host 沿用副本 profile 已有的精确 rc.2 compatibility exemption；driver 自身 rc.2 peer 无需 exemption。这证明 npm 实物的加载互锁，不能当作新 registry 安装成功或 host alpha peer 已兼容的证明。

剩余约束：

- 授权写入路径不含根 `package.json`、lockfile、`scripts/build.mjs` 和正式安装脚本。根 dependencies/files 还没有 driver，build 图也没有 driver 检查；本节只能通过 bundle 行、独立 file 包安装和直接 import 验证。需要父级在拥有这些路径的任务中收口，不能把现有 build exit 0 等同“driver 已进入根图”。
- 外部 vitest 环境不可用；本节用导入解析检查替代，没有运行浏览器人工验收或真实模型 prompt。
- 官方插件行只在隔离 profile 手动禁用。blocked 不会热切换到 occupied，需要重载 driver/profile。

## 命令控制面检查点修复（c24a567）

本次记录以 `c24a56712cec9f399d87e860d7c4c86583ab5431` 为修复基线。父级 manifest 修订只允许 host 的 `conversation.mjs` 在 `ackSettledControls` 一行加入 `renameSession`；其余 host 管道保持只读。该命令的 ACK 终结控制操作，由原 V4 账本判为 completed，不等待 turn-header。

### 官方命令入口

- 官方 `SessionController.rename/updateQueue` 的 Remote 方法委托给同一 `commands` 对象（源码 `$DSH/packages/api/session-controller/src/index.ts:410` 及 updateQueue 委托；npm rc.2 `dsh-api-session-controller/lib/index.js:3077/:3113`）。driver 在该异步命令边界安装可释放包装。`sessionTitle.rename` 保留同步原签名；rename 先复用官方 `normalizeSessionTitle` 和标题服务的 `config.maxTitleBytes`，再取得 ZCode ACK 与强制 snapshot 回读，最后调用原 sessionTitle 服务写 DSH。ZCode 拒绝、歧义结果或回读标题不一致均报明确错误，DSH 标题不提前写入。此进程内 seam 依赖经实物核验的 rc.2 `commands` 和 `config` 字段；相关可选 peer 精确钉为 rc.2，服务缺席时 injector 等待，不抢占其注册。
- 官方 `updateQueue {kind:'steer'}` 的 `remove → steer` 复合调用继续经过原守卫（`$DSH/packages/api/session-controller/src/commands.ts:475/:495`）。driver 使用按异步请求隔离、单次使用的 transfer 上下文：确认 queueItemId 且运行中时调用 `sendQueuedNow`，保留队列项直到官方 snapshot 确认消费；仅本地未派发时以 durable splice 移至 next-step，并按原确定性 commandId 发 `sendText(requestedDelivery:'guide')`。普通 remove 请求不获得该上下文，继续拒绝。
- `deleteQueueItem` 是 ZCode 已定义的协议命令（`packages/host/vendor/zcode/v4.mjs:8676`）。删除入口限制来自 `PROTOCOL-COVERAGE.md:177` 的 DSH 产品裁决，不能表述成“ZCode 协议不支持删除”。
- `ready()` 成功且未知在途命令完成同 ID query 后，重新派发仍在 inbox、尚未进入 V4 账本且未关联远端队列的 inputs。派发期间复用单个 flight，commandId 不变；失败时保留 pending input 并派发 `agent/error`。V4 已跟踪的命令继续由原账本和 query 负责，不重新发送。launcher 恢复 ready 时也触发此恢复屏障。
- snapshot 错误、暂不支持的 interaction 和不可映射的队列内容均设置 lastError 并通过 `agent/error` 通知；不改 DSH 事件翻译管道。

### sendNow 证据与已知边界

冻结映射：`confirmed queueItemId + running → sendQueuedNow`；`local-only undispatched input + running → native splice + sendText(guide)`。

证据为既有 `packages/host/zcode-agent.mjs:264-269` 的 queueAction/sendNow 路由、`PROTOCOL-COVERAGE.md:174` 的已接入立即发送行为、V4 的 queueItemId schema 与 availability 守卫，以及 `tests/fixtures/transport-v4/success.json` 的 `sendQueuedNowRequiresRunning`。`tests/fixtures/queue-guide-goal/busy.json:80` 有 allowed:true，但其 provenance（同文件第 2–8 行）明确为真实空 capture 上注入的 busy 状态。`docs/handoff/queue-guide-goal-HANDOFF.md:31/:50` 说明 reserve/promote 保留原 input intent，并明确真实 busy promotion NOT_RUN。

**EVIDENCE_GAP**：以上支持运行态投递原语与官方 steer 前置对齐，尚不能证明 sendQueuedNow 必然注入当前 guide，或必然开启新 product turn。测试注释冻结该证据等级，待 **S05 隔离验收 --driver-mode 实证** 补齐；本次不发真实模型输入。

**歧义 create 的孤儿风险仍未修复（create 侧）**：`packages/driver/transport.mjs` 的每次 create 调用会生成新的 commandId。丢 ACK 时异常携带原 commandId/outcome-unknown，但 factory 尚未持久化该未绑定 create 的恢复指针；再次创建同一 DSH ID 可能铸新 commandId，令原已创建的 ZCode 会话成为未绑定孤儿。该项需要 create 原 ID 对账、身份绑定和 catalog 去重 owner 联合收口，本次按授权仅记录风险。

本次对应回归在 `tests/lifecycle-command-repair.test.mjs`：真实 npm SessionController/SessionTitle/Cordis 驱动复合入口、普通删除与并发隔离、rename ACK/回读/失败、方法恢复；fake peer 配真实 V4Conversation 覆盖断连在途后的同 ID 派发、失败保留及同步错误通知。效应与清理断言使用真实 Cordis。

## 存量迁移与目录检查点（本节）

### catalog 读侧与 rowsRange 读通道

- host 侧 `packages/host/zcode-runtime.mjs` 新增只读 `catalogSnapshot()`（`host.listSessions()` 或 launcher read `catalog` 的规范化投影：sessionId/workspace/title），并在 `installZCodeRuntime` 暴露为 `zcodeBridgeHost.zcodeCatalog`；mirror 发布链（`installMirrorGuards`/`refreshDirectory`/`publishDirectory`）未改动。
- `v4/conversation/rowsRange` 经 `PARITY_METHODS` 放行为 `conversationRowsRangeV4`，随 `PARITY_CALLS` 自动进入 `EXECUTION_CALLS`；launcher Main 的 `allowCalls` 由 `EXECUTION_CALLS` 组成，故 relay 与 `requestParity` 均可调用，`__zcodeTrustedV4Connection` 仍由官方 facade 从连接事实注入，调用方伪造被 `parity-identity-denied` 拒绝。
- 分页由 `packages/driver/history-backfill.mjs` 的 `collectHistoryPages` 实现：首页无 `beforeRowId`（尾部向前）、每页 ≤200（`PROTOCOL_V4_LIMITS.rowsRangeMaxLimit`）、`hasMore:false` 终止；游标停滞、超限页、畸形结果是显式错误（`rows-range-*`），不把部分历史当完整。

### 原生隐藏（迁移器）

- `packages/driver/legacy-archive.mjs` 的 `runNativeArchive`：首启对 `sessionQuery.listSessions()` 的既有会话做**快照**（排除已含 `zcode-driver/conversation-bound` 的 ZCode 会话），快照先于归档落盘到 `DriverStateStore.value.nativeArchive`；逐条 `workspaceRegistry.archiveSession(id)`（durable、幂等、数据不删、可 unarchive）。中断重跑只续完冻结快照成员，迁移开始后新建的会话不会被归档。
- `packages/driver/driver-state.mjs` 为 driver 自有原子 JSON 状态（`zcode-bridge/driver-state.json`），与 mirror `RuntimeStore` 分离。

### 导入与急切回填

- `packages/driver/legacy-directory.mjs` 的 `LegacyDirectory.sync` 消费 `zcodeCatalog`：对每个 catalog 行 ensure DSH 会话，**SessionId = ZCode conversation id**，因此同一 ZCode 会话（含歧义 create 的两个 commandId 收养结果）按 id 天然去重，不会重复 ensure；`listPersistedIds` 保证跨重启也只收养一次。状态机 `placeholder`（`persistence.create` header + catalog 标题事件）→ `backfilling` → `readable`（或显式 `error`，由 `DriverStateStore` 持久化）。
- 回填复用 S02.B `ConversationEventTranslator.replay`/`mergeEventWindows`：整段 rowsRange 窗口一次性 `mergeEventWindows` 后重放，事件按 `session.append` 单调 seq 落盘；重复回填零新增（含 `session/end-seed` 边界只写一次）。附件经 `historyAttachmentReader`（row-scoped `v4/conversation/attachmentRead`）→ `renderAttachments` → DSH attachment store，历史行的附件引用可在 store 解析。
- **初始化屏障**：factory 变为可调用时即同步 `claimWriteGate()`（index 在 `installDriver` 之后、任何 `await` 之前调用）；在门被绑定或判定失败之前，resume 一律等待，绝不因「钩子未绑定」放行。绑定（`setWriteGate`→`directory.ensureReadable`）前若遗留服务未挂载/初始化抛错则 `failWriteGate`（显式 `legacy-write-gate-unavailable`），30s 未绑定则 `legacy-write-gate-timeout`，保持拒绝。直接 `installDriver`（无遗留接线，如单测）默认门为 open。catalog 轮询用构造器已解析的 `directory.intervalMs`（默认 5000ms），不接受未设置参数坍缩成 ~1ms 重叠循环。
- **写入门**：resume 在读取持久化之前经 `setWriteGate` 绑定的 `directory.ensureReadable` 完成/等待回填。占位态收到 open/prompt 时先完成回填，再公布会话；普通 driver 会话立即透传。回填失败显式记录为 `error`，不静默产生空转录。门不以「内存 catalog 行缺失」为由放行：只要持久化 `legacy[id]` 存在且非 `readable`、又无行/在途回填（重启、catalog 未 sync、peer 未连），即返回显式 `legacy-backfill-unavailable`；catalog 恢复后 sync 复入同 id 回填完成，下一次调用放行——不会把 title-only 占位 announce 出去，也不会把历史追加到 live turn 之后。
- **archived 语义**：`catalogSnapshot` 从 host-backed 的 `row.sharedTask.archived` 读取（顶层 `archived` 兼容保留）；restricted-cli 目录无 archived 概念，缺省即「未归档、不跳过」。

### 本次证据与缺口

- `tests/driver-legacy-migration.test.mjs`：迁移幂等/中断重跑/快照与 ZCode 会话排除、driver 状态文件往返、rowsRange 200 分页与跨页合并、幂等重放零新增、分页负例、状态机与发消息先行回填、同 id 去重、附件引用可解析、parity/relay 放行、resume 门时序；端到端用**真实 rc.2 `SessionStore` + JSONL persistence**：>200 行旧 zcode 会话在未激活 Agent 的情况下回填完成，冷读（`persistence.open/read`）含首窗口内容且 seq gap-free。
- **缺口（记录，不报为通过）**：未装配真实 `sessionQuery` 搜索与真实 workspace registry 的 `archiveSession/archivedSessionIds` 全链路（归档按 `archive(id)` 契约以注入替身验证，归档集合语义由 driver 状态断言）；官方列表/分页/搜索经 `sessionQuery` 的隔离环境实证仍归 S05 隔离验收。
