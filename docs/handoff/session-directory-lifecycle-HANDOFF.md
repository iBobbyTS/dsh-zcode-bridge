# session-directory-lifecycle HANDOFF — 会话目录、生命周期与同 store 双客户端

## 边界、身份与结论

- TASK：父工作区 `.agent-work/tasks/session-directory-lifecycle-TASK.md`；业务合同为 PLAN-FULL session-directory-lifecycle、R05/R10/R11/R16/R22/R23。完整任务包、transport-v4-convergence/live-session-permission-stop handoff 已读取。
- 本轮为 impl_large 实现 worker，EXECUTE_WITH_COMMIT。bridge 基线 `0119c6d`；DSH 基线 `4eea594840bd89b5a49367aa17c0b4c33556b72e`；两仓均在已授权 `feat/zcode-runtime-bridge`，开工时 clean。没有 push、merge、reset 或修改 reference/App。
- 用户指定 external codex / gpt-6.1-sol / high / yolo；本会话没有独立可核验的 observed model/effort 或外部 agent_id，记 UNKNOWN，由主调度保留真实 dispatch 证据。子代理 NOT_USED；本 worker 不执行独立 A/B 审查、不做父节 admission、不归档父 PLAN。
- **候选为 PARTIAL**：实现、受控一致性和规定回归已交付；真实官方无模型会话 rename 返回 `fault.command.executionFailed / Session not found`，不能宣称 create→list→search→open→rename→delete 成功全链。GUI 共享 authority、模型 continuation 和冷恢复仍 gated。本节没有用 fixture 成功覆盖真实失败。

## 实现清单与 authority 建模

| 范围 | 实现 / consumer |
|---|---|
| 发现与分页 | `BridgeHost.listSessions` 明传 limit=50；饱和时按 50→100→200…重读官方前缀，达到配置 `catalogLimit` 后明确 `complete:false/truncated:true`。默认 4096、允许 50–65536；同 ID 重复或错误 workspace fail closed。单会话 targeted read 不改变全局目录的完整性声明；断线/失败撤下 complete。官方没有 cursor/offset/search：分页是当前目录快照的本地页，搜索是标题或未命名会话 ID 的本地匹配，刷新会重新读取权威事实。不会暗示官方分页 cursor 或全文搜索。 |
| 生命周期 owner | Host `openConversation` 为每个视图持有独立 V4 owner/不可猜 handle，最多 64 个；open cancellation 和 release 清理订阅，不发 session/close。`conversation` RPC 仅接受 open/state/connect/release、renameSession/deleteSession、既有命令 id 的 query；不能从 UI 设置 runnable、authority、clientId 或管理能力。 |
| restricted 管理 | `managementAdmission` 仅允许已验证安装、live snapshot 的 rename/delete；模型 `admission` 仍 false，状态仍 restricted。能力为已核实 carrier，并不保证每个 Session 具备持久记录；原生失败照常公开。archive/pin 未核实 CLI carrier，UI 明确 unavailable，不本地伪造。 |
| command / CAS | 全部生命周期写入使用 transport-v4-convergence submit/query ledger。Web 发起前生成 UUIDv7，未知结果保留原 id，只有显式 query，不重发。CAS 命令可显式携带旧 baseRevision；严格使用官方集合。**rename/delete 不在官方强制 CAS 集合中**，不伪造标题 CAS 或自建双写仲裁。官方 stale config 冲突保留原 status/reasonCode/revisionAtDecision。 |
| 删除 fencing | 只有官方 accepted/duplicate ACK（含后来 query 得到的 ACK）才记删除；同步 fence 同 session 的所有 V4 owner，再退订。Host 目录与所有 RuntimeSessions 按完整 key 过滤 tombstone，迟到帧/迟到旧目录不能复活。失败、unknown、临时离线不等于删除。 |
| Web UI | bridge `ZCodeDirectory` 消费既有侧栏新增可选槽位，提供搜索、分页、刷新、打开/继续、按组展示。`ZCodeSessionPanel` 位于既有 main keyed panel，消费同一 foreign conversation renderer，提供官方 rename/delete、失败/未知结果与显式查询；删除需要具体确认，断开仅 release 当前视图。无模型发送入口。 |
| DSH-only 分组 | 浏览器设置 `dsh.zcode.local-groups`，完整 runtime+authority+workspace+sessionId key。名称变化保留关联；官方删除清除本地关联；离线不清组。UI 明示本地展示，存储错误可见；没有写入官方 DB 或 ZCode 分组状态。 |
| DSH 消费点 | 仅 ui-workspace 的可选 `sidebar.workspaces.runtimeDirectory` 声明、注册、expanded 渲染、对应测试与 README 中英文契约/配对记录。没有 native Agent、Session 持久格式、队列、导航服务或配置修改。 |

所有目录/面板显示“官方 GUI 共享会话 unverified”和“自有实例存活期间有效”。authority 固定为 `official-headless:<nonce>`，不借用 GUI 的 namespace；进程更换不重定向旧 key。`availability.capabilities` 保持 `{create:false,open:false,nativeAgent:false}`；本节的 open 是自有实例的只读 V4 视图，runnable continuation 仍 unavailable。

**官方删除语义边界**：源码 session-mgmt handler 通过官方 runtime removal 关闭/摘除运行时记录，不承诺抹除所有持久历史。UI 不改 DB，不把 view release 当 delete，也不使用禁用的 `session/close` RPC。当前实例的删除 fencing 不构成跨进程持久删除承诺。

## 受控双客户端矩阵

| 场景 | Oracle / 结果 |
|---|---|
| 两个 RuntimeSessions 与两个 V4 owner 指向同一 Host/store | PASS；固定完整 key，独立 connectionId/订阅槽位；native 同 ID 不串。 |
| 交替 rename、同时 rename | PASS；官方 fixture 按其处理顺序广播，两视图及刷新目录收敛。不宣称标题存在 CAS。 |
| 同 revision 并发配置、旧 revision | PASS；受控 hold-frame 让第二端持有旧 snapshot，第二命令返回原生 stale；winning revision 保留，不重发。真实官方另验证旧 `setFollowupMode` revision 返回 `proto.staleRevision`。 |
| 删除 + 晚到 snapshot + 旧目录回复 | PASS；显式消费 session-directory-lifecycle lateframe fixture，两视图 closed/session-deleted，目录与本地组不复活。 |
| delete 的官方 ACK 丢失 | PASS；受控时钟触发 outcome-unknown，另一端暂不被假删；同 id query 确认 accepted 后 fence 双端，v4/command 总数仍为 1。 |
| Web 回复丢失 / query unknown | PASS；原 UUIDv7 不变；若 Host 已确认，读取其 ledger 收敛；未确认时显式 query 保留 unknown。没有自动新 command 或 resend。 |
| 断开→另一端 rename→重开 | PASS；release 仅退订，官方 store 仍在；同 key 重开读取新事实。 |
| 临时 read failure、disposed/late open ACK | PASS；原身份/本地组保持；视图 ACK 晚到释放 owned handle，没有 Session 删除。 |
| rename 的真实失败 / UI rollback | PASS（失败处理）；保留原生 reasonCode、原标题；仅清理编辑字段，不宣称撤销官方已受理命令。 |
| 官方 GUI 与 DSH 同时运行 | NOT_RUN：auth/authority gated；受控客户端不冒充 GUI。 |

## Fixtures、真实证据与 checks

`capture-session-lifecycle.mjs` 只创建自有官方 headless child + 专用临时 workspace，协议创建 3 个无输入会话；为生产 Host 消费测试，先撤下 capture peer，再把**同一个自有 child**交给 Host 的既有测试 spawn 注入。不新增产品 attach 面。所有会话最终由官方 deleteSession 清理，child EOF 清理、workspace 移除；stderr 只计字节。付费/真实模型调用 0。

真实结果保存在 `tests/fixtures/session-lifecycle/official.json`：create/list PASS；limit=2 返回 3（官方 live registry 补充会超过 limit，并非 stored-prefix 分页 oracle）；本地标题/ID 搜索正例 1、反例 0；两独立 V4 视图 open PASS；stale 配置原生拒绝；rename **FAILED**；delete PASS、剩余 0。ACK 和首帧可分批，因此脚本显式等待 live 投影，不能以 ACK 冒充 baseline。

`make-session-lifecycle-fixtures.mjs` 派生 pages/conflict/lateframe；每份 provenance 列出源与字段注入。pages 的 65 个不同 ID/标题检验 limit 50；lateframe 明确是人工 hold/identity/seq/revision 注入；rename failure 和 stale 来自真实记录。受控 store 使用 transport-v4-convergence 真实 snapshot schema，并明示 title/revision/时序修改。不是真实 GUI、付费模型或官方成功 rename 记录。

日志保留 stdout/stderr 合并输出，归档时仅规范化行尾空白/末尾空行；原始日志 SHA-256 记在 checks，原件仍在本轮 `/tmp/session-lifecycle-*.log`。完整命令及输出见 [session-directory-lifecycle-checks.json](../probes/checks/session-directory-lifecycle-checks.json) 和其引用的日志。

| Check | 实跑结果 |
|---|---|
| Node 回归 | **52/52 PASS**，原 46 项保留、0 skip。 |
| bridge DSH 集成 | **36/36 PASS**，原 26 项保留、0 skip。 |
| native 定向回归 | **1367/1367 PASS**，含原 952 基线及 ui-workspace 消费范围。新增槽位文件另跑 **107/107 PASS**。 |
| bridge build / DSH full build | PASS / PASS；DSH 全量构建记录 355 client artifacts。 |
| changed-source/test oxlint / whitespace / DSH commit hooks | PASS，无源/test lint 警告。 |
| docs | **21/21 PASS**；初跑新增英文 README 配对失败，已补中文与 pairing sidecar，非忽略或放宽门禁。 |
| `pnpm test:gui` | **9799 PASS / 5 FAIL / 1 SKIP**，603 文件中 5 fail。失败：ui-chat/apply-wiring、ui-conversation/apply-wiring、ui-theme/elevation、ui-theme/radius、ui-trajectory/client-bundle；不在本节改动的产品文件。没有跑未修改基线对照，所以不把“范围外”升级成已证明 pre-existing。 |
| `DSH_SNAPSHOT=replay pnpm test:web:built` | 实跑 **42 PASS / 145 FAIL / 457 SKIP**；172 文件。主要为缺 Playwright Chromium headless 1228 / WebKit 可执行文件及由此产生的 fixture teardown 错误。浏览器交互 oracle 保持 **NOT_RUN（launch gated）**，不把尝试失败写成通过。全量 build 与该 replay 使用同一已构建 DSH candidate。 |

NOT_RUN：官方 GUI 双客户端/共享 store、真实模型 continuation、跨进程冷恢复、archive/pin carrier LIVE、本节在组装 DSH Web 中的真实浏览器交互。前四项受 TASK 红线/auth/authority/正式 carrier 约束；最后一项被上述 browser launcher 阻挡。真实成功 rename 不是 NOT_RUN，而是已尝试 **FAILED**。初期 probe 的 limit==2、ACK==live 假设被实际结果否定并纠正；未把这些脚本假设当产品事实。

## 给后续节的契约、自评与提交

- `listSessions` 的 catalog.complete/truncated、deleted 和 owned authority/lifetime 必须继续如实消费；cap 饱和时搜索不承诺全库。普通刷新重取快照，不把本地页数/本地组当官方索引状态。
- `conversation` handle 是一个视图 owner；释放只退订。新进程 nonce 变化，旧 address 失败，不自动映射；本地 tombstone 只限该 authority 生命周期。
- `managementAdmission` 与 `admission` 分开；新增非模型命令要核验正式 carrier，不能扩大 allowlist 解锁 sendText。official title/delete 本身无强制 CAS；后继不能把 task 要求改写成伪造官方 stale。
- commandId 在上行前固定。结果未知只能 query 原 owner/原 id；accepted-awaiting-terminal 不代表 completed。Host query 也执行已确认删除 fencing。关闭视图不抹除已接受命令事实。
- 本地分组保存按完整 key，只用于 DSH 展示。官方删除清组；断线与读失败不推断删除。
- 下一节应继续解决正式 auth/持久 authority 与成功 rename oracle；不能据本节 PASS 宣称 R10/R11 的跨 GUI 共享完成。本 worker 交付受限锥候选，等待独立 A/B 与主调度接纳，不自行标 CLEAN。

bridge：`e4bc7fc` Host；`1e5deff` Client；`83faee8` probes/fixtures/tests；`eab776c` 目录完整性修复及回归（产品与测试最终 head）。
DSH：`6bf54cca5f` 消费点；`9969fa8c71` 测试；`cf7893e40f` 双语消费契约（最终 head）。bridge docs/checks 另组提交；本文件不记录自身尚未产生的 hash。
