# S03.A — transport、命令关联与 V4 状态收敛

## 边界与身份

- TASK：父工作区 `.agent-work/tasks/S03A-TASK.md`；合同为 PLAN-FULL S03.A + 父级不变量、B01/B03/B04/B08、R02/R22。
- 基线：bridge `de32b10c6601d665a650575fa9af3a3dc5e550c1`，分支 `feat/zcode-runtime-bridge`。工作模式 EXECUTE_WITH_COMMIT，不 push。
- 本轮是实现 worker。用户指定 executor/model/effort 为 external codex / gpt-6.1-sol / high；本会话没有独立可核验的 observed model/effort 或外部 agent_id，记 UNKNOWN，由主调度保留实际 dispatch 证据。没有启动子代理，也没有执行独立 A/B 审查或父节 admission。
- DSH 无文件改动；reference/ZCode 与官方 App 只读。未读取或依赖 `.agent-work/tmp/host-reuse-probe/`；未访问账号材料、官方 GUI、模型任务。所有真实采集均只在自有 headless 子进程内操作本轮专用 workspace 的无输入 draft，模型调用 0。

## 实现清单

| 交付项 | Owner / 实现 |
|---|---|
| Transport | `packages/host/protocol.mjs`：逐行有界 NDJSON，粘包总量不会误触单行限额；分片/UTF-8 分割，fatal UTF-8 校验；缓冲容量按倍数增长，逐字节大帧不会反复复制全部前缀；带残帧 EOF 为 protocol-truncated；正常 EOF、协议错误、超时、abort 分开；正向 pending 与反向 pending/retired 独立，即使 id 文本相同也不互相结算；反向 server-N 可异步应答、超时和关闭时 abort。 |
| Backpressure | output.write(false) 后排队，drain 后续写；默认单行/排队预算各 1 MiB，正向/反向 pending 各 256；超限 fail closed；已取消/超时的未发送项从队列移除，BridgeError.sent 区分是否已写给 runtime。已退休 id 有界保留，过旧未识别回复 fail closed，不能匹配到新请求。 |
| ACK/query | `packages/host/conversation.mjs`：UUIDv7、commandId、sessionId、snapshot revision/logEpoch；CAS/row-target 规则采用移植的 command schema；query 精确匹配 sessionId+commandId。accepted/duplicate 维持 accepted-awaiting-terminal；超时/已发送 abort/EOF 为 outcome-unknown；query unknown 不重发；未写入的失败为 not-sent。运行/等待/终态只来自同 epoch、同 sourceCommandId 的权威 turnHeader，等待交互需匹配 anchorRowId 所属 turn。 |
| V4 重组与恢复 | 移植的 TopicWireFrameAssembler 校验 fragments、base64、CRC32、UTF-8、JSON、schema、ordinal、总量和时限；只完成后原子 apply。保留实际持有的 baseline；ACK(snapshot) 不构成 baseline。旧 subscription 帧被隔离；同 epoch 过期区间不推进；缺口不猜补。same-sub resync ACK 后用 recovery 标记收口；错误 recovery / 缺帧 deadline 保持 error，用户可显式 retry/connect。ACK→首帧及 ACK→recovery→gap 同批竞态有检查。 |
| 取消 / admission | cancelCommand 只取消客户端等待，不假冒 runtime stop；stop 必须携带当前 activeWorks 的 expectedForegroundExecutionId 且 canStop。订阅 cancel 幂等，移除 listener、释放 assembly/timer、退订确知的 id，并等待在途 ACK 后清理 owned orphan；官方退订拒绝/不确定在 cleanupError 中保留。BridgeHost.createConversation 校验实际 authority/workspace/session；当前 restricted Host 的 admission 永远 false。 |
| 真实 fixtures | `tests/fixtures/s03a/{official,success,failure,gap,lateframe}.json`；采集、派生脚本入仓，详见下节。 |

可分离代码以独立提交移植：`packages/host/vendor/zcode/v4.mjs` 只导出 shared command/schema、logical apply、wire assembler/codec/binary、limits 和 Host handshake schema/helper。71 个纯 shared/schema 依赖文件经 esbuild tree-shaking 后约 407 kB；完整 nested payload 校验使该依赖闭包较大，没有导入 services、UI、CLI gateway 或运行时装配。zod 固定为与源 shared 包相同的 4.6.5。

来源为 `zai-org/ZCode@29628c9acdb81b703bbd4080c207a0e7ce5e276e`。保留 Apache-2.0 LICENSE、原 NOTICE.md、版权与修改声明；SOURCES.json 保存各源文件 SHA-256、导出名单和固定 revision。`node scripts/vendor-v4.mjs ../reference/ZCode` 可重建；其 resolver 拒绝 shared/model-option-map 之外的移植依赖。reference 不参与 bridge 的日常 build 或运行。

## Fixtures 与真实检查

`node scripts/capture-s03a.mjs` 启动已验证官方 3.14.4.7912 Helper + cjs（SHA-256 `fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`），创建专用临时 workspace：

1. capabilities/query unknown；非法 sendText payload 在 admission 被拒绝，不提交任何模型输入。
2. createSession 无 firstInput，取得 draft；V4 replayable subscribe、配置命令 setFollowupMode、同 id query、stale revision、resync；continuous 使用另一个 connection 的独立 subscription。
3. 新增生产 V4Conversation 直接在同一官方 draft 完成 connect → 非模型配置命令 → query → force-snapshot resync → cancel。`official.json.productionOracle` 保存结果：live/replayable、seq 1→2、ACK 与 query 均 accepted-awaiting-terminal。
4. 删除本轮 draft；关闭自有 stdio、等待自有 child 清理、移除专用 workspace。没有 session/close 或 GUI 操作。原始 stderr 仅计字节，不收集正文。

仅将本轮 workspace/session/subscription 标识别名化，保留 wire 字段、epoch、水位和官方 ACK。第一次加入 renameSession 检查时，官方无落盘 draft 返回 Session not found/failed；这保留为真实 failure 样例，没有掩盖或假定 draft 是持久 Session。

`node scripts/make-s03a-fixtures.mjs` 从 official.json 派生四个可复用包：

| Fixture | 真实性 / 注入 |
|---|---|
| success | 官方 initial snapshot、online delta、recovery snapshot、subscribe ACK、非模型 accepted command；无人工修改字段。 |
| failure | 官方 rejected/failed/stale ACK 及原 reasonCode；无人工修改字段。 |
| gap | 从真实空 delta 与 snapshot 修改 watermark/interval/ordinal：持有 10 → `(10,12]` → `(13,14]`，缺口 `(12,13]`，权威 recovery 到 14。provenance 列出每项修改。 |
| lateframe | 同真实 online delta 改为 old-subscription 和 `(14,1000]`；provenance 明示故障注入。 |

B04 sendText 丢 ACK、人工 turnHeader/interaction、CRC/UTF-8/fragment 故障由同一 source fixture 和移植 schema 驱动。人工 turn/交互不是实际模型产出；真实配置 ACK 不能被声称为真实 sendText 工具执行 oracle。官方 continuous/replayable 是不同 subscription 的完整 snapshot；不会把 continuous 数据宣称为可 replay 的 durable log。

## Checks 实跑

机器可重跑入口：`node scripts/check-s03a.mjs`；完整命令、stdout、stderr、exit 保存为 [s03a-checks.json](../probes/checks/s03a-checks.json)。

| Check | 最终结果 |
|---|---|
| npm test | 39/39 PASS，0 skip；B01/B03/B04/B08、EOF/缓冲/粘包/UTF-8/id 冲突/取消；same-batch、query wrong key、epoch replacement、CRC/assembly timeout/size、等待 anchor、stop target、observer failure 与退订拒绝。 |
| npm run build | PASS；既有 Client ESM/classic artifact 正常。 |
| node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs | 14/14 PASS；原 S01/S02 集成零回归，DSH 未改。 |
| 真实 capture + 派生脚本 | PASS；官方 ACK、V4 两种 profile、生产协调层往返、query/resync/cancel；paidModelCalls=0。脚本输出为 official.json + 四份派生 fixture。 |
| 实际 plugin-manager 安装 | PASS；[s03a-install.json](../probes/checks/s03a-install.json)。--ignore-scripts 专用临时 profile；实际 import 安装后的 Host/runtime，验证新 schema 与 zod 依赖可加载及 LICENSE 入包；profile 已清理。 |
| git diff --check / staged whitespace | PASS。 |

TASK 的“既有 18+14”与冻结 HEAD 中实际测试数量不同：开工实跑 Node 为 12/12，DSH 为 14/14。原 12 项保留；最初新增 6 项 transport 边界扩展成 18，再加入大帧与本节 Host/V4 检查成为 39。没有删除、跳过或替换原基线。

一次新增 fragment 测试以 1000 bytes 作跨 carrier physical budget，被正式 encoder 拒绝为 proto.frameEnvelopeTooLarge；因 mobile envelope 固定开销超预算，将测试预算修正为 3000，未放宽产品限额。其后所有 targeted checks 通过。

NOT_RUN：真实模型首发/工具或 permission/ask-user 任务/停止执行/持久冷恢复、官方或 DSH packaged GUI oracle、共享 GUI Session authority。原因：S03.A 明确禁止模型调用及 GUI 操作；正式账号来源与父节 oracle 由 S03.B/父级处理。Host hello LIVE 为 NOT_RUN：CLI 无对应握手 carrier；B08 使用源 schema 严格测试，不能从 runtime/capabilities 推断可信增量位。没有用 fixtures PASS 替代这些结果。

## 给 S03.B 的 API 契约

- `host.createConversation(address, {onChange})` 返回 scoped V4Conversation；对象不自动 connect，不注册 DSH Session 来源 seam。只有 host 实际 connected、address 对应自身 authority/workspace 时创建；默认 trusted profile 为 replayable。
- `connect({forceSnapshot?})` 的 Promise 表示 subscribe ACK。snapshot 模式等待正式首帧后 live；resume ACK 与实际持有的 epoch/seq base 匹配时，直接以该水位 live/续流，随后消费 initial replay 或 online 增量。ACK 不提供 server currentSeq，不从 ACK 猜测或推进水位。ACK 与通知可能同一 read 到达，owner 在 peer.onResult 中同步建立。
- `state` 是 clone：status = idle/connecting/live/resyncing/error/closed；snapshot 为官方公开 schema 原子投影；profile、commands、error、gap、cleanupError、observerErrors、admission 可供消费。error 或 resyncing 的旧 snapshot 仅作已确认历史，不能据此开放动作。
- `submit({type,payload,commandId?},{signal?})` 验证 schema、CAS、target 与 admission，返回跟踪状态；不自动重发。commandId 默认 UUIDv7，同一活跃记录重复 submit 被拒绝。`queryCommand(id,{signal?})` 只查询已跟踪的同一 key，不产生新 id。ACK 保留原 status/reasonCode/revisionAtDecision；已受理无终态的确定展示为 accepted-awaiting-terminal，不能翻译为 completed。
- `cancelCommand(id)` 只 abort 等待；返回首次是否取消。实际停止用显式 stop command，并携带当前 projection 的 foregroundExecutionId；客户端取消不会撤销已执行副作用。
- `resync({forceSnapshot?})` 保持 subId；base 仅取实际 apply 的 snapshot。其 Promise 是 ACK/请求结算，不等于 recovery frame 到位。error 可显式 connect/resync；坏 recovery 进入确定 error，不无界自动重试。
- `cancel()` 返回幂等清理 Promise；也处理 subscribe 在途晚 ACK。ACK 永久丢失时客户端无法猜测 server subId；本地状态仍关闭，最终远端释放依赖 owned connection/runtime 生命周期，cleanupError 保留不确定性。不要把远端未知宣称为已成功退订。
- CLI 当前无 Host hello：订阅不发送 workflowRunDeltas。`negotiatedClientHello` 仅供未来真实 Host hello carrier；只有明确 ===true 的能力才带新增严格字段。clientMode/runnable/connectionId/capability 位归可信 Host owner，不能从 UI payload 透传。continuous 和 replayable 分别建 owner/baseline；仅 V4 conversation physical 帧进入 assembler，其余通知隔离。
- UI 必须同时使用 admission 与官方 availability/row actions，permission/ask-user 必须来自此 snapshot 的 pendingInteractions。当前 Host 永远 restricted，因此本节 API 不开放实际执行控件，也没有新增 `/api` 动作 endpoint。
- ledger 默认 128 条，先回收已终结记录；未知/accepted 未收口记录不静默淘汰，满后 command-pending-limit。没有可关联 turnHeader 的命令不推断执行终态；尾窗之外的终态仍需后继正式 query/history owner 提供证据。

## 提交、自评与纠偏

- `86b5a97`：独立 schema/纯函数移植、来源许可与固定依赖。
- `0627636`：NDJSON / 双向 correlation / backpressure 与 transport 边界检查。
- `a3b48ec`：命令/订阅协调层、Host scoped API、真实 fixtures、采集/派生脚本与故障检查。
- `9f671a2`：最终产品 head；分片缓冲按倍数增长、typed byte 输入、ACK 空 identity 拒绝、退订失败公开与检查。
- docs/checks 提交仅归档证据；handoff 不记录自身尚未产生的 commit hash。

自评：S03.A 交付锥完成，等待父节独立双覆盖与 admission；S03/M0/M1 的模型/GUI/共享持久世界仍未完成。建议主 agent 在 S03.B 接入时消费同一 fixture，并保留 received/accepted/执行/等待/终态的区别；不因 draft/配置往返成功把 auth 或 durable Session seam 标 available。审查应覆盖完整 S03.A 与 B 拼接候选，尤其同批帧、cancel 重入、query/ACK 与 epoch fencing 的组合。

本 worker 只提供实际 Git/脚本/检查/fixture 证据，不组装父级 audit pack，不自行宣称 CLEAN。

## CODE REPAIR — CA3-1 / CA3-2（2026-10-03）

本段为实现 worker 的有界修复记录；是否关闭评审发现、是否接纳候选仍归独立评审和主调度。修复基线 `ac85d11`。本轮未启动子代理，0 模型调用，reference/App 制品只读，DSH 仓无修改。

### CA3-1：deadline 与 ACK 必须归属仍存活的 flight

修复前的受控时钟回归复现了两条链：subscribe ACK 后、首帧前故障触发 recovery，旧 initial deadline 错判 recovery 超时；坏 recovery 已进入 error 后，迟到 ACK 修改 logEpoch 并武装新 deadline，随后自动把 error 翻成 resyncing。[修复前原始结果](../probes/checks/s03a-repair-repros.json) 保留 0/3 PASS 的失败证据（含 CA3-2）。

修复：`#fault` 和新的 `resync` flight 起飞前清除旧 frameTimer；subscribe/resync ACK 处理验证 error 状态和所捕获的 flight identity；`#deadline(flight)` 的武装及回调均检查该 identity、closed/error 状态。订阅 ACK 的 observer 若同步替换 flight，旧 ACK 不会取消或武装新 flight 的 deadline。

新增三条 CA3-1 回归（Node MockTimers，不靠真实 sleep 调概率）：

1. ACK→首帧窗口内注入坏帧；超过旧 initial deadline 时仍为 resyncing，只有自己的 recovery ACK 武装的新 deadline 能终结 recovery，之后保持确定 error。
2. ACK→首帧窗口内起 recovery；在 recovery ACK 前注入 owned 坏 recovery；迟到 ACK（带不同 epoch）不能改 epoch/error、不能武装自动重试；推进多倍 deadline 后仍只有一次 resync。
3. subscribe ACK observer 同步起 recovery；旧 ACK 不会给替换后的 flight 武装 initial deadline；随后正式 recovery ACK/frame 可正常收口为 live。

对应独立 checkout 提交：`7f58545` — `fix(conversation): bind recovery deadlines and ACKs to their flight`。

### CA3-2：每个下游 conversation owner 占有独立且稳定的槽位

官方 publisher 每个 topic 内用 connectionId 索引单一 subscription；新 subscribe 替换该 key 的旧 subscription。修复前，同 Host 的两实例共用 sessionAuthority：测试中两次 subscribe 后 server slots 实际为 1（应为 2），第一实例失去后续帧。

修复：BridgeHost.createConversation 为每次创建生成 `${sessionAuthority}:${randomUUID()}`；该值存于现有不可变 V4Conversation.connectionId，同一实例 connect/resync/unsubscribe 始终沿用。仅 `${authority}:${sessionId}` 会使同 session 双开的两实例仍冲突，因此包含实例 UUID。没有改变 Session address、source seam、runnable/admission 或 clientId。

新增测试使用真实捕获的 snapshot/delta 和明确的 publisher boundary fixture：服务端严格按 `(connectionId, topic)` 替换槽位。断言双开均收到 seq 推进、左右实例分别重连仅替换自己的旧 subscription、另一个保持存活并继续收帧，以及取消一个不会移除另一个。

对应独立 checkout 提交：`47ed9d5` — `fix(host): isolate subscription slots for each conversation owner`。

### 实跑、环境限制与提交交付

- CA3-1 三条、CA3-2 一条 targeted 回归：4/4 PASS；新增回归在原候选上先复现失败。
- Node 全量：**43/43 PASS**，保留全部原 39 项；build PASS；`git diff --check` 与独立 checkout staged whitespace PASS。[完整默认路径检查](../probes/checks/s03a-checks.json)。
- DSH 全量确已重跑：**11/14 PASS，3 FAIL**。三个失败均为真实官方 headless 连接检查；当前 `mdfind` 返回空，而 `/Applications/ZCode.app` 存在。显式检查官方 3.14.4.7912 的 digest/launcher 成功；临时显式 appPath 重跑仍为 11/14。[显式路径检查](../probes/checks/s03a-repair-explicit-app-checks.json)。临时测试路径配置已撤回，原 DSH 集成断言未删除、未 stub、未 skip。
- 用未修改的 `ac85d11` 独立 checkout 与修复代码、相同显式 App/workspace 做对照，两者均 `connected:false / reason:transport-eof`。[环境与基线对照](../probes/checks/s03a-repair-environment.json)。因此本轮没有获得 14/14；具体 headless 启动失败原因未进一步读取原始 runtime 诊断，不能宣称此门禁已通过。完整 14/14 需主调度在可完成正式 headless 连接的环境中复跑。
- 不重采模型/GUI/账号内容；已有 fixtures 保持不变。

当前执行权限将主仓 `.git` 设为只读，且 approval policy=never。主仓 `git add` / `git commit` 尝试均因无法创建 `.git/index.lock`（Operation not permitted）失败；主仓 HEAD 仍为 `ac85d11`，代码与证据差异保留在工作区。

允许写入的独立 checkout：`/private/tmp/zcode-s03a-repair-vrj75X`，同名 feature 分支。上列两个 Conventional Commits 在该 checkout 实际生成；随后 docs commit 归档本记录和检查证据。交付 Git bundle：`/private/tmp/zcode-s03a-repair-vrj75X/S03A-REPAIR.bundle`，增量基于 `ac85d11`。由有主仓 `.git` 写权限的主调度导入/整合；没有 push、改写主仓历史或丢弃已有 `.DS_Store`。

本段取代旧 handoff 的“最终产品 head 9f671a2 / 最终 checks 全 PASS”作为当前修复候选状态；原记录保留其历史语境。 worker 完成修复与可复核 Git 交付，不自行宣称 CODE 评审闭合。

## CODE REPAIR wave 2 — CB3-1（2026-10-03）

实现基线为主仓 `9096823`（已包含 wave 1 的 `7f58545`、`47ed9d5`、`ccd6ab6`）；本段是 worker 修复交付，不自行关闭 CODE B 的评审发现。reference/App 制品只读、0 模型调用、DSH 仓与其集成测试断言未改。

**失败合同与证据**：正式 `conversation-topic-publisher.ts:833` 在 `base.seq === currentSeq` 时回 resume ACK，reservation 为 null，不发 initial frame。候选却给每个 subscribe ACK 武装 initial deadline、并将首条 online deltas 拒绝为 proto.initialDeliveryMismatch。新增回归在修复前均失败：持有 10 的 `(10,12]` online 未推进（实际仍为 10）；静默 resume 推进时钟后进入 resyncing（应保持 live）。[修复前原始结果](../probes/checks/s03a-wave2-repro.json) 保存 0/2 PASS。

**修复**：只调整 subscribe 的 resume ACK 分支。除既有 closed/generation/error/flight identity 外，明确验证实际持有 snapshot 的 logEpoch/seq 和 appliedBase 与本次请求 base 一致；通过后清除 initial flight/deadline，以原水位直接进入 live。新 subscription 的合法 online 或 initial replay 帧继续用原 reducer 消费。snapshot ACK 仍等正式首帧；resync 分支、异 epoch 拒绝、gap 检测和有界 fail-safe 不改。不从 ACK 猜 server currentSeq、不捏造或推进 baseline。

**新增回归（2 条，均覆盖 continuous/replayable 独立 owner）**：

1. 持有 epoch E/seq10，重订阅仅收到 resume ACK；ACK 与首条 online `(10,12]` 可同一 read 到达，直接推进到 12/live，未发 resync。
2. 持有 seq10，重订阅仅收到 resume ACK，完全没有 initial/online；受控时钟推进五倍 initial deadline 后仍 live/seq10/同 epoch，peer pending=0，未发 resync。

| 本轮检查 | 结果 / 证据 |
|---|---|
| CB3-1 targeted 回归 | 2/2 PASS；修复前 0/2，受控时钟，无概率 sleep。 |
| Node 全量 | **45/45 PASS**，保留原 43 项（含 wave 1 的 CA3-1/CA3-2 回归）。 |
| bridge build | PASS。 |
| DSH 集成全量 | 已实跑 **11/14 PASS，3 FAIL**；三个失败仍是实际官方 headless 连接检查，未删除、stub 或 skip。主 agent 可在其环境复跑 14/14。 |
| 基线对照 | 未修改 `9096823` 与本轮修复均默认 discovery 为 installation-missing；显式 `/Applications/ZCode.app`（3.14.4.7912、verified=true）启动均为 transport-eof。[本轮对照](../probes/checks/s03a-wave2-environment.json)。因此不能宣称本环境 DSH 14/14。 |
| whitespace | 主仓 `git diff --check`、独立 checkout staged/range whitespace PASS。 |

完整命令/stdout/stderr/exit 与本轮 product head 在 [s03a-checks.json](../probes/checks/s03a-checks.json)。本轮未复现真实官方 equal-watermark resume：本环境 headless 连接被上述环境问题阻塞；评审员的真实复现为输入证据，不冒充本 worker 新的 LIVE PASS。

代码/测试提交：`b88a594` — `fix(conversation): accept ACK-only resume from a held baseline`。独立 checkout 为 `/private/tmp/zcode-s03a-wave2-642Run`，同名 feature 分支；docs 提交随后归档本段与检查。增量 bundle `/private/tmp/zcode-s03a-wave2-642Run/S03A-WAVE2.bundle` 基于 `9096823`。主仓 `.git` 保持只读；工作区改动与 bundle 所含提交逐文件相同，无 push。本段作为当前候选说明取代前段的 wave 1 最终状态，历史证据仍保留。
