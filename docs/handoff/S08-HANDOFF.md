# S08 HANDOFF — 历史分支、重试、文件回退与压缩

## 身份、范围与交付状态

- TASK：`/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tasks/S08-TASK.md`；PLAN-FULL S08；R02/R08/R16/R17/R22。完整 TASK 先读后执行；模式 EXECUTE_WITH_COMMIT。
- bridge 起点 `4785b7d`，DSH 起点 `3802a2ff13`，两仓均为 `feat/zcode-runtime-bridge`。DSH 只改 Session 消费点测试、测试声明和 alias。reference/ZCode 与官方 App 只读。
- 当前 worker 的 requested executor/model/effort 为 external codex / gpt-6.1-sol / high；独立可核验的 observed model/effort、external agent_id 在本会话不可见，记 UNKNOWN，由主调度保留真实 dispatch 记录。未启动子代理；未执行独立 A/B 或父节 admission。
- 自评 **PARTIAL**：受限实现、fixtures、真实命令可达性与回归交付完成；真实两轮模型历史/成功文件回退/成功稳定 fork/成功压缩恢复仍 gated。没有以 fixture PASS 替代真实成功，也没有将 restricted 标为 available。
- 全程真实模型调用 0；未碰官方 GUI、真实用户会话、凭据、session/close、DSH git reset 或文件回退模拟。测试中的临时文件写入仅为显式注入服务器端口的 hash oracle，不是产品实现或真实官方 checkpoint 证据。

## 首先执行的真实 headless 可达性检查

先执行 `scripts/capture-s08.mjs`，再写产品实现。只用官方已验证 Helper+cjs 启动自有 headless child、专用临时 workspace、无 firstInput draft；订阅并验证空 rows 后才探测不存在的 row。所有会话清理由官方 deleteSession 完成，订阅 cancel、child EOF、专用 workspace 清理；stderr 只计字节。

正式安装：App 3.14.4.7912，cjs SHA-256 `fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`；只读 reference `29628c9acdb81b703bbd4080c207a0e7ce5e276e`。

真实结果在 `tests/fixtures/s08/official.json` 与 [capture log](../probes/checks/s08-capture.log)：

- create draft/subscribe/delete 成功。
- `forkAssistant`、`applyFileRewind`、`editUserQuery`、`retryTurn` 对空 draft 的不存在 row 均原生 `stale / proto.staleTarget`；不存在的历史目标在模型执行之前拒绝。
- fileChanges/fileRewindPreview 方法均可达：原生 JSON-RPC `-32603`，错误事实分别为 `Error: proto.staleTarget` 与 `Error: proto.staleLogEpoch`。
- `createSelectionSideSession {}` 实际尝试，原生 **failed / fault.command.executionFailed / Session not found**。空 draft 没有可 fork 的持久记录；不是成功创建。
- `compact {}` 只对专用不存在 session ID 探测，原生 **rejected / proto.sessionNotFound**。没有向真实 draft 发可进入 `ensureModelReady`/后台模型的有效 compact。
- successful stable fork/file checkpoint apply 需要已有有效历史；当前自有空 draft 无该历史，成功面 **NOT_RUN**。edit/retry 新 turn、带 firstInput 的侧会话和有效 compact 会触发模型，**NOT_RUN**。

脚本对 method、command、compact session ID、空历史与目标 row 均有限制，selection 禁止 firstInput。仅别名化本轮自有 workspace/session IDs；不会落盘用户数据、原始 stderr 或全栈诊断。重新采集的结果仍是失败/拒绝，不假造正例。

## Carrier 核实表

路径均相对于只读 reference/ZCode；纯 schema 由 `scripts/vendor-v4.mjs` 重建，沿用 SOURCE/NOTICE/LICENSE 与固定 revision，不导入 services/runtime。

| 项目 | 正式 carrier / 生效 owner | 实现、真实结果与限制 |
|---|---|---|
| assistant fork | `command.ts` forkAssistant + `fork.ts` stable target；CLI `commands/handlers/fork-edit-retry.ts` → resolveStableForkTarget/forkStableConversation | 实现；按 row.canFork 与 CAS/epoch，稳定 logical-turn 的末 assistant segment 可来自非末轮。只复制 conversation，parent 工作与文件不动；真实 staleTarget，非末轮成功 fixture，live 成功 gated。 |
| 选区侧会话 | createSelectionSideSession；`commands/handlers/selection-side-session.ts` → parent-derived config / child registration | 实现空 child、可选 firstInput.text。UI 提供选区文本输入；空 child 非模型面，firstInput 为模型面。真实空 draft 创建失败如上；fixture child 成功。不会声称复制任意选区历史或迁移 runtime。 |
| edit | editUserQuery `{target,newText,attachments?,workspaceMode?}`；fork-edit-retry → submitConversationRewind + startCanonicalIntent | 实现；默认 preserve，仅截断 active conversation branch 后用新 commandId 执行新输入；rewind 由官方文件事务成功后在 commit gate 截断 conversation。attachments 缺省保留原输入，显式 refs 执行 S07 绑定检查。真实 staleTarget；新 turn gated。 |
| 旧输入可编辑性 | product-projection resolveEditTarget / row.canEdit + editDisposition | 只使用正式动作，不根据文本或时间猜目标。**当前官方仅最后 realUser query 可编辑**；更早输入显示 disabled，不伪造 child edit/fork fallback（R16）。 |
| retry | retryTurn + canonical intent 在 rewind 前解析；submitConversationRewind → startCanonicalIntent | 实现；每次用户主动操作生成新 commandId，旧工具副作用可能重现；明确“execute again”。B04 outcome-unknown 只 query 原 commandId，不重发。真实 staleTarget；执行 gated。 |
| 文件 diff | `v4/conversation/fileChanges` + 正式 Params/Result schema；gateway.resolveQueryRowTarget/getConversationFileChanges | 实现 turnHeader 文件数/增删/路径/patch UI；sessionId 来自 owner，revision/epoch/row/entity 来自所观察投影。真实方法/staleTarget/staleLogEpoch，成功列表 fixture。 |
| 文件预览 | `v4/conversation/fileRewindPreview`；gateway → previewConversationFileRewind | 实现 restore/delete、safe/unsafe/ignored 原生原因；请求前后均检查 captured revision/epoch，迟到响应丢弃。真实方法与原生 stale，成功 checkpoint preview gated。 |
| 文件 apply | applyFileRewind；`commands/handlers/file-rewind.ts` → runtime.applyWorkspaceFileRewind | 实现，使用预览的原 CAS/epoch；过期禁用，canApply=false 禁用。官方 result.applied=false 如实显示；只改文件，conversation 保留。所有实际副作用由 ZCode 执行；没有 fs/git product 写入。真实 staleTarget，成功 apply gated。 |
| combined edit+rewind | editUserQuery.workspaceMode=rewind；fork-edit-retry 的 preview/applyWorkspaceFileRewind commitAfterApply | 实现显式模式，提示先检查对应 turn 的文件预览；unsafe/ignored/无 safeFiles 的官方 blocked result 和 preview 如实展示。fixture 覆盖 blocked；live 新执行 gated。 |
| compact | compact `{}`；`projection-state.ts computeAvailability`；`commands/handlers/goal-compact.ts` | 实现 availability + runnable admission、原生拒绝、FIFO queue 呈现；不直接改历史文本。active/queued compact 的操作锁拒绝重复。真实 unknown-session admission；有效运行及恢复 gated，fixtures 覆盖 marker/recovery。见下节合同差异。 |
| feedback | setAssistantFeedback `{target,feedback:like/dislike/null}`；`commands/handlers/assistant-feedback.ts` | 实现 assistant row 绑定、CAS、like/dislike/clear；只读原反馈，不乐观改写历史；fixture 覆盖。真实有效 assistant row 无法在红线下产生，NOT_RUN。 |
| branch 身份 | ACK result.sessionId + 不可变 owner runtime/authority/workspace | ACK result type 必须对应原命令，child id 非空且不同 parent；完整 address 交给 RuntimeSessions.open，沿 S04 runtimeSessionKey/catalog 校验。UI remount key 为无歧义完整 tuple。不存在跨 DSH/ZCode 导入或迁移（R17）。 |
| 未核实能力 | 任意旧输入改写、任意选区历史剪接、独立 conversation rewind command | **不可用**；当前正式 edit/retry 已承载 conversation rewind，不另造 command，不直接改数据文件（R16）。 |

## Compact 合同差异：需要主调度明确接纳

TASK/PLAN 写“busy/held 拒绝”。当前固定 reference 的正式 schema 注释、`projection-state.ts:computeAvailability`、`goal-compact.ts:compact` 和官方 SessionPane 都明确：busy/running/held → typed FIFO；draft 没有上下文 → idleCannotCompact；正在或已排队 compact → compactOperationLock。有效 compact 会做模型 readiness 并进入后台模型，不能在 0 模型红线内尝试成功执行。

本实现按“保持原生语义”采用当前正式 carrier：busy/held 按 availability 显示 **Queue context compaction**；队列受理维持 accepted-awaiting-terminal；不显示已压缩、不越过 held、不发 startNow、不修改历史文本。fixtures 同时覆盖 busy/held 的 queued admission、实际原生 rejection ACK，以及 compact lock 的本地禁发。**不宣称 busy/held 普遍拒绝这一文字 AC 已达成**；若父节坚持一律拒绝，则需要明确这是额外 UI 政策而非官方语义，再交给有界修复。

## 实现与时序契约

- Host `HISTORY_COMMANDS` 单一路由：fork/空 side/apply/feedback 属于已核实非模型管理面；edit/retry/compact/side.firstInput 必须 runnable。当前 production Host 保持 restricted。
- `historyQuery({kind,target,baseRevision,baseLogEpoch})` 仅支持两个正式文件读 carrier，返 `{kind,target,baseRevision,baseLogEpoch,result}`；RPC 白名单无 sessionId/path/runnable，session 路由完全由 opaque handle owner 派生。
- Web 的历史 row command 必须显式提交所观察 revision/epoch；Host RPC 缺失拒绝 `history-target-unconfirmed`。UI editor/preview 保存原 CAS，不能点击时偷偷取新 revision；过期 editor 要重开，过期 preview 要重取。
- edit/retry 可能改变 epoch：仅其 accepted/duplicate 后、**同 sourceCommandId 的权威 turnHeader** 能跨 epoch 收口；其他命令继续原 epoch fencing，不因无关联 compact marker 推断某 command 已完成。
- 所有历史记录均经原 command ledger。用户 retry 是新执行；query 永远原 ID。侧会话/fork 的未知结果有显式 Query original command；结果未知不自动创建另一个 child。
- preview 可 apply 仅说明官方当前判断。文件外部变化可能不抬 revision，最终官方 apply 重新校验，返回 applied=false/preview 时 UI 明示未回退，不在 DSH 处理文件冲突。
- S04 打开 child 仍需完整 address、当前目录/authority 校验；没有因为 child ACK 成功而解锁 model auth 或 GUI 共享 authority。

| Interleave | 结果/检查 |
|---|---|
| query 在途 → revision/epoch 换代 → 迟到 preview | Host 丢弃；不授权 apply；fixture PASS。 |
| editor/preview 已显示 → 另一端 revision 推进 | UI 禁用执行并要求重开/重取；fixture PASS。 |
| retry/edit ACK → new epoch recovery → 同 commandId turn terminal | 权威 header 收口，原文本/无关旧命令不冒领；fixture PASS。 |
| lost ACK → query unknown/accepted | 原 id 查询，v4/command 数不增加；fixture PASS。 |
| busy/held compact → queued ACK / lock rejection | queued 与 rejected 分开显示；不报完成；fixture PASS。 |
| compact → recovery snapshot+success marker | 历史文本保留、marker 正常展示、恢复后动作可用；fixture PASS。 |

## Fixtures 与实跑检查

- `make-s08-fixtures.mjs` 基于 S03.A 正式 snapshot 派生 success/busy/held/locked，逐份明示 rows/actions/CAS/diff/checkpoint/compact facts 为注入。所有 frame 由官方 schema 校验。
- `s08-runtime.mjs` Producer 为实际 V4Conversation；测试服务器只有显式可驱动响应，无产品存储。两轮真实临时文件 hash oracle 的写入仅在测试函数的假官方端口阶段发生，不能充当 live file-rewind oracle。
- Host scoped RPC/router、生产 RemoteConversation、Controller、View 与 DSH Session renderer 均有消费检查。既有 B04 测试把错误的 turnHeader retry 目标修正为有正式 canRetry 的 assistant row，保留 CAS/epoch assertions，未删除基线。
- 初始 epoch 测试曾错误用 online snapshot 直接换 epoch，被既有 epoch guard 拒绝；测试改为正式 resync ACK+recovery snapshot，没有放宽产品 guard。初始 GUI 多元素 selector 改为 getAll，断言两条真实 fixture assistant 展示；未跳过失败测试。

| 检查 | 实跑结果/证据 |
|---|---|
| `npm test` | **97/97 PASS**，原 85 保留，0 skip；[Node](../probes/checks/s08-node.log)。 |
| bridge DSH 全集成 | **88/88 PASS**，原 78 保留，0 skip；[integration](../probes/checks/s08-integration.log)。最终测试端口 query 扩展后另跑 S08 **10/10 PASS**；[targeted](../probes/checks/s08-targeted-integration.log)。 |
| DSH native 指定回归 | **1373/1373 PASS**，60 files，原 1371 保留；[native](../probes/checks/s08-native.log)。 |
| DSH Session 消费点 | **2/2 PASS**；[consumer](../probes/checks/s08-dsh-consumer.log)。 |
| DSH `typecheck:contracts-ready` | **PASS**；[types](../probes/checks/s08-types.log)。 |
| bridge build / DSH full build | **PASS / PASS，355 artifacts**；[bridge build](../probes/checks/s08-bridge-build.log)、[DSH build](../probes/checks/s08-dsh-build.log)。 |
| 真实 headless capture | **PASS（可达/拒绝 oracle）**，paidModelCalls=0；不能解释成成功历史写入；[capture](../probes/checks/s08-capture.log)。 |
| 真实 Chrome headless 1100px/390px | **PASS**，no pageerror/横向或整页纵向溢出、历史内滚动；[visual](../probes/checks/s08-visual.json)。明确 injected fixture，非官方 GUI；人工查看 390px PNG。 |
| 两仓 touched-file oxlint、whitespace、DSH pre-commit hooks | **PASS**；[bridge lint](../probes/checks/s08-lint.log)、[DSH lint](../probes/checks/s08-dsh-lint.log)。初跑 DSH 3 个 lint error 已修正，未压制规则。 |

NOT_RUN：有效模型 edit/retry/compact/side.firstInput，真实稳定 fork，真实有两轮 checkpoint 的 preserve+rewind 正例，真实成功 file preview/apply，真实有效反馈，官方 GUI 双客户端/共享持久 authority。原因：禁止模型/真实用户历史/官方 GUI；当前无输入 draft 不提供稳定历史或 checkpoint，正式空 side 创建真实失败。DSH assembled web replay/full GUI sweep 未跑；本节只改 DSH 测试 alias/消费点测试，浏览器检查为 bridge 的明确注入渲染。父节不得将这些项目改写成已实测成功。

## 分块提交与后继约束

- bridge `c8a5830` — `feat(protocol): expose official history diff and rewind preview schemas`。
- bridge `208cd39` — `feat(history): add native branching retry rewind and compaction controls`。
- bridge `99908b8` — `test(history): probe official admission and cover branch file and retry semantics`。
- DSH `21fb059745` — `test(ui-session): cover native ZCode history controls in the Session seat`；两仓无 push、无主干 merge、无历史改写。
- docs/evidence 另组提交；本文件不虚构自身 commit hash。

后继须保留 sourceCommandId/完整 branch key/preview CAS；不能用 DSH Agent、git、文件操作、文本改写模拟任何历史效果。获得可信 runnable 与合法测试历史后，应补真实成功 fork/checkpoint/重执行/压缩 oracle，并处理上述 compact 文字合同差异，再由主调度独立 A/B 覆盖与接纳。本 worker 不宣称 CLEAN，不归档父级 PLAN 或组装父 audit pack。
