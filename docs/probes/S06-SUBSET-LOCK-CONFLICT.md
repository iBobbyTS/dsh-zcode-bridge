# S06 前置子集：双 Host 共库锁 / 冲突实测

**结论：Route B 首次初始化 / 只读观察为「需额外条件」，存储锁测试没有发现 NO-GO；原始 sessions-index 的跨 Host 活跃信号为 LIVE FAIL，禁止仅凭其 phase 放行写入。** 完整 S06 的运行 authority oracle、跨池并发 turn/CAS、租约让渡与 owner 命令未执行；本报告不能解锁共享执行或宣称 S06 全节完成。

任务权威为 `../.agent-work/PLAN-PHASE2.md` 的 S06 锁/冲突子集、集成条件依赖及 P10/P12/P13–P18/P20–P22。bridge 基线 `27874ea462822077dc463d6292e923439bb75b49`，分支 `feat/zcode-runtime-bridge`；有界 launcher 配置提交 `2fe192d`。DSH `21fb059745ddc1b78e387c24f3987b68569de236`、reference `29628c9acdb81b703bbd4080c207a0e7ce5e276e` 均只读。官方 Electron 41.0.3 / Host / CLI 制品使用 S02 同一身份校验，不修改 App 或 ASAR。

## LIVE 判定表

| 项目 | LIVE 判定 | 实测结果 / 证据 |
|---|---|---|
| 两库在线备份 | **PASS** | 对真实 `~/.zcode/v2/tasks-index.sqlite` 和 `~/.zcode/cli/db/db.sqlite` 分别执行 sandboxed `sqlite3 -readonly … '.backup …'`；均 exit 0，副本 `integrity_check=ok`。tasks 8,052,736 B，session 2,344,095,744 B。命令、时间、SHA256、聚合计数见 [backup.json](checks/s06-subset/backup.json)。两次备份不是跨库原子快照。 |
| ① 双 Host 并发启动 / 锁 | **PASS（当前 schema）** | 两 launcher 同时启动，同一复制 tasks 库外部持有 `BEGIN IMMEDIATE`；A/B 均发布 `preparing_host_storage / waiting_for_lock`，释放后均 ready。tasks/session migration 均 `kind=none, executedCount=0, committedCount=0`；tasks baseline `0003_official_glm_selection`，session baseline `0022_backfilled_session_reasoning`。见 [startup.json](checks/s06-subset/startup.json)、[rpc-log.json](checks/s06-subset/rpc-log.json)。没有构造旧 schema，initialize/upgrade SQL 并发执行 **NOT_RUN**。 |
| ② 同会话元数据写冲突 | **PARTIAL：task 产品元数据 PASS；session-store rename 被官方拒绝** | 8 轮两侧同 ID `zcode-task.renameTask` 共 16 次均成功；成功回包先后交错，不出现固定 A/B 优先规则。再持有 tasks 写锁约 500 ms，同时发起两侧 rename，释放后两调用均成功，等待耗时见 [conflict-lock.json](checks/s06-subset/conflict-lock.json)。并发 archive/unarchive 均成功。正式握手身份下直接 `zcode-agent.sendConversationCommandV4(renameSession)` 两侧均返回 `ZCODE_AGENT_PROVIDER_NOT_READY`，未进入 session-store 同写阶段，见 [direct-session-rename.json](checks/s06-subset/direct-session-rename.json)。不把 task API 成功当作 session DB rename 成功。 |
| ③ task_status 跨 Host / P12 信号链 | **DB 信号 PASS；原始 sessions-index 链 LIVE FAIL** | A Main 对合成任务注入 `running→completed`（同时更新标量列、meta_json 与 updatedAt）；B 的官方 `zcode-task.listTasks` 两次读到对应状态。B 的正式 sessions-index 初始 / running / completed 快照仍为 `completedSuccess, sessionEnded=true, hasBackgroundWork=false`，lastActivityAt 没有跟随 tasks.updatedAt，见 [visibility.json](checks/s06-subset/visibility.json)、[rpc-log.json](checks/s06-subset/rpc-log.json)。这是实际负结果，不能称「Host B sessions-index 读到 running」。 |
| ④ 异常退出 / WAL | **PASS（受控注入范围）** | SIGKILL A 官方 utility Host，并立即 SIGKILL 持有注入事务的 A Main；B 保持原实例继续运行。session DB 先提交一个标题，再在 `BEGIN IMMEDIATE` 内写另一个未提交标题；B 官方按 ID `listSessions` 读到已提交标题，未提交标题没有生效；B 官方 task rename/read 继续成功，B Main 的固定 session SQL 写入也由 B 官方列表读回。见 [wal-recovery.json](checks/s06-subset/wal-recovery.json)、[wal-session-write.json](checks/s06-subset/wal-session-write.json)。注入事务属于 probe Main，不声称测到了官方 Host 正在提交 session 事务时的内部恢复语义。 |
| 最终完整性 / 原数据保留 | **PASS（明确验证范围）** | 两库 `integrity_check=ok`，原 tasks 和 session 主表所有原始行的内容 SHA256 与初始备份相等；全表计数仅 tasks/session 各 +1 个合成行，其余无增减，包括 model_usage/turn_usage/tool_usage/automation_runs。见 [db-final-verification.json](checks/s06-subset/db-final-verification.json)。未逐行散列 message/part 正文，不声称全库内容级哈希验证。 |

## 共库拓扑与隔离证明

两实例使用原 S02 `HostLauncher`、bootstrap、Channel codec、HostAuthority 和官方 InitLocal。probe 在各自新 run 中复制 S02 Main/无依赖 bootstrap，加入固定白名单 stdin 控制；生产 Main、默认 RPC 白名单和 DSH 产品端点没有扩展。生成过程见 [run-probe.mjs](checks/s06-subset/run-probe.mjs)、[main-adaptation.json](checks/s06-subset/main-adaptation.json)。状态中的 `execution=disabled-s03` 是原 S02 标记，本探测控制面不代表产品已有执行能力。

新增可选 `sharedDatabaseRoot` 只接受 `scratchRoot/shared-databases/<子目录>`，目录内容仅两库与其 WAL/SHM/journal；禁止符号链接祖先、额外文件（包括凭据）、其他路径越界。每个 run 的 data-base 仍独立，仅 `data-base/.zcode/v2/tasks-index.sqlite` 固定链接到共同副本；session DB 使用共同绝对路径。共享写权限为固定 DB/sidecar literals，未授予共享目录任意子文件写权限。所有 HOME/settings/provider/runtime/Electron paths、outer/inner env、launcher cwd 与 CLI 的实际 cwd 仍各自在本实例 run 下；两实例有不同 Main PID、Host PID、hostId 和 CLI PID。逻辑 workspaceIdentity 相同，仅用于让两侧无模型 CLI 查询同一合成会话，实际 cwd 不共用。

[launcher-A.json](checks/s06-subset/launcher-A.json)、[launcher-B.json](checks/s06-subset/launcher-B.json) 保存最终配置；[shared-fds.json](checks/s06-subset/shared-fds.json) 显示两个官方 Host 实际打开同一路径 tasks DB/WAL/SHM；[runtime-fds.json](checks/s06-subset/runtime-fds.json) 显示两侧 CLI 实际打开同一路径 session DB/WAL/SHM。因此不是仅配置字符串相同或两份副本各自成功。

默认 S02 profile 的 `deny network*` 也禁止官方 CLI 启动期 Node REPL browser broker 的 Unix socket。仅 probe profile 改为：继续拒绝所有 IP 网络和其他 Unix socket，只放行各自 `run/tmp/` 下的 Unix socket；生产 profile 没改。A/B 分别实际验证 IP outbound `EPERM`、共享目录额外文件写 `EPERM`、自身 scratch Unix socket allowed，见 [isolation.json](checks/s06-subset/isolation.json) 与最终 `.sb`。长 scratch 路径已改为短 `/private/tmp/s6-…`，但缩短路径没有解决 disposed；真正对照证据是只改变 Unix socket policy 后 CLI 查询成功。

## ② 的官方行为与不能推导的规则

官方 metadata 表面是 `zcode-task`（archive/pin/unread 的持久化真相在 tasks-index），而 `zcode-session` 接口本身没有 rename/archive 方法。`zcodeTaskServiceAdapter.ts:2919` 的 rename 先修改 task index，再尽力经 `renameSession` 同步 CLI session store；同步失败只告警，保留 task-index 标题。实测 task 标题已更新，官方按 ID session 列表仍返回 `S06-fixture`，见 [session-after-rename.json](checks/s06-subset/session-after-rename.json)。直接 session rename 在本任务无凭据 / signed-out scratch 中被 provider readiness 门拒绝。因此记录为 PARTIAL，而不是假定两个有认证 Host 的 session-store rename 冲突已通过。

[conflicts.json](checks/s06-subset/conflicts.json) 保留每次请求起止时间与各自返回值；两侧各自返回标题，随后库内保留其中一个已提交标题。没有测试长期饥饿、锁超时阈值、失败重试策略或生产冲突概率；不从 8 轮样本发明 winner 优先级，也不推导 turn CAS/准入/跨侧 stop 规则。

## ③ 对 ledger 和 S03 闸门的影响

P12 的「runtime 活跃派生 task_status，再 upsert 到共享 tasks-index」源码方向依然成立；本次使用固定 SQL 注入，验证的是 DB→另一 Host 官方读取这一段，没有模型 turn，也没有声称动态 runtime→DB 派生经过 LIVE 激励。应区分 **共享 DB 可读的 task status** 与 **另一个 CLI 池的 sessions-index phase**。

reference `apps/zcode-cli/packages/bootstrap/src/zcode-protocol/v4-bridge.ts:1352–1420` 的冷存储 summaries 直接取 session store，并给出 `phase=completedSuccess/sessionEnded=true/hasBackgroundWork=false`；准确活动态来自自身池的 live projection。与本次负证据一致。B 已订阅并实际收到三份原始 snapshot，故失败不是未握手、错 event 参数或没收到帧。

S03 的写入事件闸门必须从官方 task metadata 服务刷新共享状态（或已验证的产品级 task-meta + sessions-index 合并面），不能只看原始 sessions-index。P15–P18 三分语义保持：对侧活动 turn→禁写、我方 turn→正常 busy、确定空闲→可写，未知/信号陈旧→禁写，保留草稿且不踢下线。任务库 schema 未发现 runnerHostId/ownerPid/turn owner 字段；本次 SQL 没有制造真实我方 turn，**归属真值仍须我方 Host 内存维护，归属算法 LIVE 未在此完成**。DB status/updatedAt 的可见性不是 owner/lease 协调证明。

**Route B 判定为需额外条件：** 可把当前 schema 的双 Host 迁移锁前置作为有界 GO 输入，S03 首启只能进行已授权的初始化与只读观察；按计划保留用户备份确认、Main scheduler 禁用/不发送 Host 派发消息、首启 0 模型请求观察窗与副作用入账。共享写/自动放行不能依赖原始 sessions-index「完成态」；正式带认证 session-store 同写与运行 authority oracle 未覆盖。没有测试完整旧库升级；若实际环境需升级，不得引用 `kind=none` 样本证明升级并发已通过。

## 失败、诊断与残余

完整尝试目录和 stdout 见 [attempt-ledger.json](checks/s06-subset/attempt-ledger.json)；后来的成功没有覆盖早期失败。

- 单测首轮 42/43：新增测试用不存在 `/read-only` artifactRoot 调 sandboxProfile，ENOENT；改为现存 fixture 目录后通过。配置产品行为没有因该失败改变。
- LIVE attempt1：未握手的 sessions-index 返回 `fault.connection.handshakeRequired`；只读 CLI 查询 disposed；异常 Main 退出后原 HostLauncher 的 group kill 返回 EPERM，未捕获 rejection 使 harness 中断、WAL 收尾未完成。保留已得到的 task DB 写通证据，不以它代替完整 oracle。
- attempt2：正式 handshake 成功，CLI 仍 disposed；增加官方 lifecycle 的安全类别/path 投影，定位到 scratch broker socket。原始错误正文未保存，不重建为原始日志。
- attempt3：只缩短 scratch 路径，仍明确 `listen EPERM / operation not permitted`；排除「缩短即可恢复」假设。
- attempt4：只额外放行 run/tmp Unix socket，CLI 列表和 index subscribe ACK 成功；dynamic event 错传数组而不是 ProxyChannel 要求的单个参数对象，尚不能证明收到帧。
- attempt5：修正 event 参数后实际收到三份 index snapshot，确认运行态不跨池传递；`readSession(existing-only)` 对未加载合成会话返回 `-32004 Session is not active`，改用官方按 ID 持久化列表查询，不 activate/resume 会话。
- attempt6：正式按 ID list 证明 WAL 已提交/未提交区分，补 500 ms 写锁冲突；该轮之前没有直接测试 `renameSession` RPC。
- attempt7：直接 renameSession 的 clientId 不匹配 trusted handshake，返回 `fault.command.clientMismatch`，不是存储冲突结果；随后对齐握手 clientId、完整 issuedAt 信封。
- attempt8：合法直接 rename 两侧 `ZCODE_AGENT_PROVIDER_NOT_READY`；tasks conflict / raw-index 负结果 / Main crash WAL 证据均闭合；最后一轮增加官方 utility Host 的直接 SIGKILL，以对齐用户异常 Host 退出要求。
- 最终 attempt9：Host+Main crash、B 持续官方读写、DB status 写通与原始 index 负结果均复现；该轮未观察到 cleanup EPERM，最终 Main/Host/CLI 所有已观测自有 PID 清单为空。**此前 Main-only crash 多轮出现 group cleanup EPERM，产品 stop 没有修复**；harness 仅收集 unhandledRejection 以保住后续证据，不能把最后一轮没有报错当作异常清理缺陷已闭合。S03 应另行关注。
- isolation 检查首次从 settings 路径少退一层，找不到 `home/launcher.json`，在启动 sandbox 子检查之前 ENOENT；修正后两侧检查均符合预期。首个脚本保留，原错误只存在执行工具结果，没有伪造 raw log。
- 只读检索中 zsh 未匹配 glob 及 reference 外层目录无 Git HEAD 的命令失败，不涉及启动/真实数据读取；改用确切路径 / reference/ZCode 后成功。

诊断采用 [adaptive-debugging SKILL.md](/Users/ibobby/.codex/skills/adaptive-debugging/SKILL.md)，失败合同、假设/对照与未解决边界见 [debug-notes.md](checks/s06-subset/debug-notes.md)。未读取用户 crash reports、真实日志、凭据、Keychain 或 GUI 内容。

## 红线与检查

- **0 模型请求**：受控 RPC/command 白名单只有状态、持久化按 ID 列表、index 订阅、合成 ID rename/archive；command 类型只允许 `renameSession`。无 sendText/prompt/goal/auto-title/connectivity/warmup/recovery，也无 session/close。零请求结论依赖白名单 + OS IP 禁网 + 无可执行 provider + usage/run 表计数不增长，**不依赖 requestGate.sent=0**（仍 installed/enforceable=false）。Main 不构造 cron/off-peak scheduler，也不发送派发消息。
- 真实用户数据唯一入口为两个 read-only `.backup`（SQLite 按 WAL 规则读取其 sidecars）；没有 DB cp、凭据复制、真实 SQL 业务查询或写回。后续 scratch-to-scratch 库缩短路径使用 SQLite backup API。真实 GUI 只执行 ps 观察，清单见 [gui-before.json](checks/s06-subset/gui-before.json)、[gui-after.json](checks/s06-subset/gui-after.json)；清单自然变化不等于主动操作。
- 官方/DSH/reference 只读，Keychain 服务被 OS 拒绝；最终 Main 的 windowEvents/windows/WebContents 均 0；[owned-remaining.json](checks/s06-subset/owned-remaining.json) 为空。
- launcher 新配置/拒绝越界/禁止共享凭据/固定 DB grant 单测与 bridge Node 测试 **261/261 PASS**，见 [node-final.log](checks/s06-subset/node-final.log)；build PASS，见 [build-final.log](checks/s06-subset/build-final.log)。未改 UI，不复用或宣称 DSH/S05 GUI 测试本轮重跑。
- launcher 修改独立 commit；本报告和证据另作 docs commit；不 push。本实现者交付不代表独立 review CLEAN 或主 agent acceptance。真实副本 DB、WAL/SHM、run 生成文件不纳入 Git；证据 manifest 保存相对路径/SHA256。
