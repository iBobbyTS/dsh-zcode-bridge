# S06 — Queue、Guide、模型模式与目标配置

## 身份与范围

- TASK：父工作区 `.agent-work/tasks/S06-TASK.md`，PLAN-FULL S06，R07/R08/R14/R22；EXECUTE_WITH_COMMIT。
- bridge 起点 `22e94b4`；DSH 起点 `cf7893e40f`；两仓均为 `feat/zcode-runtime-bridge`。本 worker 未启动子代理、未执行独立 A/B 评审或父节 admission。
- 用户指定 external codex / gpt-6.1-sol / high / yolo；本会话没有可独立核验的 observed model/effort 或 external agent_id，记 UNKNOWN，由主调度保存 dispatch 证据。
- reference/ZCode 与官方 App 只读。真实采集只用本轮专用 workspace、无 firstInput draft、自有 headless 子进程；不碰官方 GUI、用户 Session 或凭据，未调用 session/close，模型调用为 0。
- DSH 仅改消费点的测试与测试解析配置；不改 native agent、模型默认配置、持久化格式或生产 API。

## 实现与权威状态

1. `packages/client/input-controls.mjs` / `.jsx`：Queue/Guide/Start now 显式 delivery、队列编辑/上移/下移/删除/立即发送、暂停/恢复、held clear/keep 确认、模型/思考/协作模式、follow-up、goal、workspace 操作。配置表单是未提交草稿；上方 next selection 来自官方 snapshot，当前模型只读取 running turn 的 assistantText.model。当前执行 mode 没有独立投影，明确显示 not projected。
2. 每次 sendText/sendGoalCommand 冻结官方 `config.modelSelection/mode/planEnabled`；不借用 DSH 模型默认配置。队列显示每项已 admission 的 selection/mode、requested/admitted delivery、steer/fallback、dispatch 与身份。切换会话配置不会改已有队列的 canonical intent。
3. held 确认是官方 composer 同类的局部确认草稿，保存打开时的 logEpoch、queueItemId/sourceCommandId 集合与完整 input。确认时按集合和身份匹配，另一端插入/删除/身份替换或 epoch 改变会阻止旧确认。wire 携带冻结的 `expectedHeldQueueItemIds`；Host 再验集合，官方 CLI 还在 mutation 前核验。没有复制 S05 `snapshot.pendingInteractions` 或另建 pending registry；原 S05 卡片继续消费同一 snapshot。
4. `V4Conversation.submit` 补充 official availability、queue item/target/reservation/compact-edit、held membership 守卫。队列操作沿用官方 CAS；UI 基于最新权威队列叠加单个身份绑定的局部 preview，ACK/失败/过期后清除 preview，不把保存的旧整队列写回。accepted/duplicate 只表示受理，未知 ACK 按既有 transport fail-safe 关闭；丢 ACK 保留 outcome-unknown，UI 从既有 ledger 提供按原 commandId query 的入口，不重发。
5. `ConversationController`、`RemoteConversation` 与 Host RPC 连接已核实输入 allowlist 和 scoped workspace 操作；workspace 路由由 handle 所属 owner 派生，不接收任意 workspace。当前生产 Host 的 runnable 仍为 false：新入口在 restricted 状态禁用，直接 RPC 同样返回 runtime-restricted，未开放模型调用。Stop 保持 expectedForegroundExecutionId 守卫；没有用取消本地等待替代 Stop。
6. workspace/readPresentation 返回展示 mode/slash 目录；两种偏好更新只消费正式返回值，展示“last official response”，不称其为可持续订阅的当前值。偏好当前值读取与目标 Host model catalog 未核实，标不可用，不填本地默认值、不写 localStorage/DSH 配置。配置与队列区域可滚动/折叠，composer 保持可见。

## Carrier 核实表

固定 reference revision：`29628c9acdb81b703bbd4080c207a0e7ce5e276e`。`packages/shared/src/zcode-protocol-v4/command.ts`、`input-intent.ts`、`submission.ts`、`session-config.ts`、`snapshot.ts`；CLI `commands/handlers/{queue,session-flow,model-config,goal-compact}.ts`；官方 UI `ConversationComposer.tsx`、`SessionPane.tsx`、`slashCommands.ts` 为逐项来源。官方 App 3.14.4.7912 / SHA-256 `fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f` 的 bundle 中存在下列 command/偏好方法与关键 payload 词；真实非模型往返另见 capture，词存在本身不充当 busy oracle。

| 能力 | 已核实 wire / 生效点 | 实现与真实验证 |
|---|---|---|
| Queue / Guide / Start now | `sendText {text, requestedDelivery?: queue\|guide\|startNow, modelSelection, mode, planEnabled?}`；Start now 原子抢占，Guide 是否 steer/fallback 由 CLI admission 决定 | 已实现；生产 V4 + 注入 fixture 覆盖三种；真实 busy NOT_RUN |
| queue identity / intent | `queueItemId` ≡ core pendingInputId，`sourceCommandId` 是原输入来源；`delivery/order/steer/dispatch` 直接消费 vendored schema | 已实现；不按数组下标删项，不为 promotion 重建原 command 身份 |
| edit | `editQueueItem {queueItemId,newText}` + baseRevision；compact 不可编辑 | 已实现；fixture；真实 busy NOT_RUN |
| reorder | `reorderQueueItem {queueItemId,beforeQueueItemId:string\|null}` + baseRevision；null 为队尾 | 已实现；两个区分明显的输入上下移动及 authority 收口 fixture |
| delete | `deleteQueueItem {queueItemId}` + baseRevision | 已实现；失败/过期只清本地 preview，未请求 runtime undo |
| immediate send | `sendQueuedNow {queueItemId}` + baseRevision；CLI reserve/promote 保留完整原 input intent | 已实现；reserved 禁用，未在 ACK 时假删队列；真实 busy NOT_RUN |
| pause / resume queue | `setAutoDrain {autoDrain:boolean}` + baseRevision；Stop 后 queue 暂停由投影决定 | 已实现；fixture；采集脚本不触发 drain/model |
| held disposition | `sendText/sendGoalCommand` 的 `heldQueueDisposition:clearQueueAndSend\|keepQueueAndSend` + `expectedHeldQueueItemIds:string[]`；CLI `applyHeldQueueDisposition` 在 mutation 前检查集合 | 已实现；另一端插入后旧 clear/keep 均阻止发送，Host 也拒绝旧 wire；不构造 resolveInteraction |
| model / thinking | `switchModelConfig {provider,model,thought}` + baseRevision；Session Selection 用于随后创建的 Active Model，当前 Active Model 不被重写 | 已实现；当前/下次/已排队 selection fixture；真实同值 config.unchanged/noop 已采集，真实 busy 换不同模型 NOT_RUN |
| collaboration | `switchCollaborationMode {mode:build\|edit\|plan\|yolo}` + baseRevision；SessionModeChanged 投影；input 同时冻结 submission mode | 已实现；真实 edit→build 与投影更新已采集，无 YOLO 默认 |
| follow-up | `setFollowupMode {mode:queue\|guide}` + baseRevision；单次 delivery 不写 session followupMode | 已实现；真实 guide 与同 id query、resync 投影已采集 |
| goal objective | `sendGoalCommand {text:objective,displayText?,modelSelection,mode,planEnabled?,held...}`；busy 的 canonical kind 是 sendGoalCommand，delivery 为 queue | 已实现；复用官方纯 slash parser，`/goal replace X` 不把整段 slash 文本当 objective；fixtures 验 wire |
| goal resume / pause | `resumeGoal {}` / `pauseGoal {}` + baseRevision；`/goal resume` 解析为 resumeGoal；官方 composer 不支持的 clear/show/slash shortcut 明示不可用 | 已实现；fixtures；真实 goal/model 任务 NOT_RUN |
| workspace presentation | `workspace/readPresentation {workspace}` → `{workspace,mode,slashCommands}`，不是 session model catalog/偏好当前值 | 已实现；正式 schema、workspace identity 校验、真实生产 owner 往返 PASS |
| workspace interaction preference | `workspace/updateInteractionPreferences {workspace,preferences:{askUserQuestionAutoResolutionEnabled}}` → 同 workspace/value/snoozedInteractionCount | 已实现；正式 schema；专用 headless workspace false/true + V4 owner false 往返 PASS；受限 UI 禁用写入 |
| workspace model I/O preference | `workspace/updateModelIoPreferences {workspace,preferences:{fullRetentionEnabled}}` → 同 workspace/value/updatedSessionCount | 已实现；正式 schema；专用 headless workspace false/true + V4 owner false 往返 PASS；受限 UI 禁用写入 |
| workspace preference current reads | reference 的 session/requestRuntimePreferences 是 CLI 向可信 Host 的反向请求；readPresentation/workspace-config 不含这两项当前值 | **不可用**：没有已核实的该连接权威 read carrier；不借用反向请求做客户端 getter |
| workspace-config topic / model catalog | workspace-config 是整体替换的展示态，官方 dispatch 复用 V4 topic carrier；新 model catalog 由目标 Host ModelSelectionView 提供 | 展示读走已真实核实的 readPresentation；**model catalog 不可用**：未暴露目标 Host service；允许手工提出模型草稿，由正式命令决定接受/拒绝，无自建目录 |
| active execution mode/provider details | snapshot.config 是会话选择，rows 没有当前 Active Model 的完整 mode/provider 快照 | **不可用**：当前 model 仅取 response row；不从 config 或队列反推当前执行 mode |

S03.A vendored command/input-intent schema 继续优先复用。workspace params/result 新增正式 schema 导出仍在同一 shared 依赖闭包，71 个源文件，SOURCES.json 固定 revision/hash，保留 Apache-2.0 LICENSE/NOTICE。官方 dependency-free slash parser 单独移植到 `packages/client/vendor/zcode`，保留来源/hash/许可，用 `scripts/vendor-input-commands.mjs` 重建；没有移植 App services/UI 状态管理。

## Fixtures、checks 与限制

- `scripts/make-s06-fixtures.mjs` 以 S03.A 真实捕获的空 snapshot 派生 busy/held/inserted/switched/reordered/guided 六个样本。每个 provenance 明示 control、queue、config、rows、goal 等为注入，经过官方 frame schema；真实 Producer 为 V4Conversation/ProtocolPeer，不用假 conversation 代替命令协调层。
- `scripts/capture-s06.mjs` 只允许 create/delete 本轮 draft、配置 command、展示读和两种偏好更新；不发送 sendText/goal/queue drain。真实生产 owner 完成 subscribe→config/query/resync→workspace carrier→cancel，最后删除自有 draft并关闭自有 child/workspace。`tests/fixtures/s06/official-config.json` 保存真实返回；stderr 仅计字节。
- [完整检查索引](../probes/checks/s06-checks.json)：Node **70/70 PASS**（保留原 62）；DSH bridge integration **66/66 PASS**（保留原 54）；DSH native **1369/1369 PASS**（保留原 1367，新增两项消费点）；DSH contracts-ready typecheck PASS；bridge build PASS；DSH full build PASS（355 client artifacts）；targeted oxlint exit 0、两仓 diff/staged whitespace PASS。
- UI oracle 覆盖三种 delivery、编辑/重排/删除/promotion/autoDrain、held clear/keep 与另一端插入、当前/下次与队列选择冻结、配置失败草稿、canonical goal、unknown/lost ACK、workspace 正式响应、restricted DSH seat。Node 另覆盖 original-id query、未知 ACK fail-closed、reserved/availability/held guards、旧 Stop target 不碰 new execution。
- [布局检查](../probes/checks/s06-visual.json) / wide、390px narrow、restricted PNG 是明确标注的 injected visual fixture，无 browser error、无横向溢出；已人工查看窄屏图，队列独立滚动，composer 可见。不是官方 GUI/live busy oracle。
- 开工 baseline Node 62/62。中间修正过 fixture 在 jsdom 下的路径解析、跨仓 React 实例解析与 DSH 测试 props 的类型错误；最终所需 checks 均通过。既有 restricted route 回归改为期望 `runtime-restricted`（S06 已核实的输入 command 可达 owner，但 owner 不准入），仍断言没有任何实际 v4/command 写入，没有放宽 restricted admission。
- **NOT_RUN**：真实 busy queue/Guide/startNow/promotion/held/Stop-newturn、真实 busy 不同模型切换与完整模型/goal oracle（auth-gated，0 模型输入）；官方 GUI/共享用户 Session（任务禁令）；偏好当前值 read、Host model catalog/当前 execution mode（carrier 不可用）。fixture PASS 不替代这些检查。

## 给后续节的契约

- 使用同一 V4Conversation、pendingInteractions、ledger 和 authority/workspace/session owner；不得另建 config/pending 存储。`workspaceConfiguration(kind,preferences)` 只接 presentation/interaction/modelIo，workspace 从 owner 派生，响应经正式 schema 与身份校验，不自动重试；超时不能推断未接受。
- UI submitInputCommand 进入现有 command 路径；受限 Host 永远不开放模型/队列配置写动作。未来 auth owner 需先获得可信 runnable，再补真实 busy/双端/切模型 oracle，不通过 UI payload 开通。
- readPresentation 的 mode 是 workspace 展示/default，不能拿来覆盖 session config、已入队 selection 或正在执行的模型。模型目录须接正式 Host ModelSelectionView；手工草稿值不是 catalog/current authority。
- held 是局部身份绑定的确认草稿；S05 交互继续只来自 pendingInteractions。配置/队列 ACK 不能改写本地权威 snapshot。后续有明确配置终态 carrier 前，ledger 保留 accepted-awaiting-terminal；不能为了回收 ledger 把 ACK 当 execution-completed。
- DSH 新增消费点测试从 sibling bridge 导入真实 Producer/view；test-only ambient 声明与 React alias 不改变生产依赖。既有标准 Slot target 类型仍声明 native SessionReference，测试用明确 foreign-branch fixture cast；未扩大该跨 owner 类型面。

## 提交与自评

bridge：`6cd4758`（独立官方 schema/parser 移植）、`d0b18f7`（输入/队列/配置实现、fixtures 与真实采集）、`b914c22`（未知结果的原 commandId UI 查询）。DSH：`76c5156ea3`（消费点测试、声明与测试 React 解析）；本记录的最终提交不自引用尚未产生的 hash。两个仓库按 Conventional Commits 分块提交，无 push/main merge/历史重写。

自评：S06 受限态实现候选与要求的 fixture/非模型真实证据已交付；真实模型 busy 与尚未暴露的权威 read/catalog 保持 NOT_RUN/不可用。需要主调度独立双覆盖与父节 admission；本 worker 不宣称 CLEAN 或整体 feature 完成。
