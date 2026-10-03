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
- `connect({forceSnapshot?})` 的 Promise 只表示 subscribe ACK，**state.status==='live' + snapshot** 才表示 projection 到位。ACK 与通知可能同一 read 到达，owner 在 peer.onResult 中同步建立。
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
