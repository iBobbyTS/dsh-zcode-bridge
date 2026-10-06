# launcher-recovery handoff

**Auth 翻转成功：scratch signed-out/not-connected → 首次真实 HOME 官方 OAuth authenticated，Z.AI Individual provider connected/current/executable；不是把官方 GUI 登出再登录。** 自评 **PARTIAL**：核心首次 LIVE 与观察窗通过；真实活跃 task 激励、用户 GUI 对照及修正后持久 web 查看实例仍待 main。此交付不是独立 review CLEAN 或 acceptance。

任务权威 `/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tasks/launcher-recovery-TASK.md`（已全文阅读）；计划 conversation-runtime/有界探测条目；前置 AUTH-PHASE2-official-runtime-install 与 queue-guide-goal-subset-lock-conflict（已完整读取）。bridge `feat/zcode-runtime-bridge` 基线 `341111d`，EXECUTE_WITH_COMMIT，不 push。DSH `21fb059745ddc1b78e387c24f3987b68569de236` 零编辑，reference/官方制品零编辑。主 agent 拥有后续独立评审；没有派发子 agent。

## 实现与落点

- `launcher/{live-http,config}.mjs`：两份公开工件存在性/文件名/hash + official-runtime-install 判定、用户 Live HTTP 选择、delta CLEAN、备份原话、子集双 CLEAN/有界 GO；无工件/变更→scratch+可解释拒绝。real HOME、DATA_BASE real HOME（官方再加 `.zcode/v2`）、默认 session DB；desktop HOME override 如实沿用。拒绝 custom cipher env（仅检测 presence）。scratch temp Unix socket 长度在 fork 前断言。
- Electron/cwd/资源/证据写 scratch；bridge 不 mkdir 或写真实 `.zcode`。官方 Host 初始化与联网自然副作用是授权范围；只读 RPC 不能据此宣称启动无写入。network enabled；Seatbelt 禁 Keychain 文件与 securityd。没有 Chrome import / safeStorage / Keychain item 操作。
- Main：未实现 scheduler 唤醒/结算回调，未 spawn scheduler，未发送 cron/off-peak/session work 消息。InitLocal 不提供 workspacePath/agentWarmupTargets。白名单无 prompt/auto-title/tester/warmup/流恢复/session close。官方只读 CLI 因 session/list 启动，不同于 warmup/会话激活。
- `write-gate.mjs`/Main/Host endpoint：以官方共享 task metadata + `updatedAt`（明确映射为 lastActivityAt，非 raw-index 值）+我方 Main lease 内存判断；每个事件刷新 `getTaskMeta`；无写 dispatch、无踢下线。自动化绑定警示。无 shared CAS/租约互斥证明。
- Host-backed 专用 `/zcode-bridge` auth/status/catalog/preflight；多 workspace 真实 task 行进入既有 sidebar source。client 状态卡 authenticated；打开显示只读 metadata（不伪造冷历史读取）。三分判定轮询、草稿保留；所有 conversation-runtime Send 保持禁用。DSH 产品代码零改动。

## 首次 LIVE 证据链

证据目录 [launcher-recovery](../probes/checks/launcher-recovery/)，核心 [live-attempt1/result.json](../probes/checks/launcher-recovery/live-attempt1/result.json)。此前 `tsx` 未传 DSH tsconfig 时 module-not-found，发生在 Context/Host 创建前；随后加 `--tsconfig ../dsh/tsconfig.base.json` 才完成首个真实 HOME 启动。目录编号 1 是**真实 Host attempt**，stdout 文件 attempt2 是第二次 harness 物理调用，不混计。

| 项目 | 实测 |
|---|---|
| scratch baseline | `scratch-final/live.json`：signed-out、activeProviderPresent=false、0 executable；provider 状态不连接。独立 scratch 环境，不是 GUI 的前态 |
| 三重门 | `live-http-artifacts.json`：official-runtime-install b769f1…f79a9；PLAN fdac98…6f91f；实际核验 各探测条目；备份目录 metadata 存在 |
| real auth | `connected.json`/`launcher-states.jsonl`：OAuth authenticated，`account:zai-individual-coding-plan` connected/current=true/entitled=true/executable=true；其他账号不可用事实分别保留。没有导出 userInfo/credential/profile |
| official session/task surface | `sessionListCount=1`（官方按 ID persistent list，未 resume）；全量非归档/pinned GLM tasks 318：317 completed、1 error。`catalog.json` 保存全地址/标题/状态，真实 session 由 Host 内层默认 DB 提供；不是第二 CLI store |
| DSH carrier | 真 Context + WebServer + HostConnectionService 的 `/zcode-bridge/connect` 返回 state/auth=authenticated、connected=true；sessions 返回真实多 workspace read-only catalog |
| headless/coexistence | windowEvents/windows/WebContents 全 0；`gui-before.json` 与 `gui-after.json` 一致；`owned-remaining.json=[]`；只 ps 观察 GUI |
| network effects | 网络开启；首个真实 run 未捕获可归类 builtin-config stdout 事件，刷新成功/失败 **UNKNOWN**，不能写成成功。scratch 控制明确观察到 background config failure。没有读真实日志来补证 |

主 agent 仍需安排用户将真实目录与官方 GUI 对照，当前 `shared-task-store` 只表示同一官方持久化 surface，非 GUI oracle PASS。最终补丁中的 account-only auth 筛选/恢复监视/错误分类/长度 guard 没有在失败后自行再跑真实 HOME；首启证据适用于其已实际执行路径，最终头完整 LIVE 仍待 main。

## 观察窗与 0 模型请求口径

`baseline.json` 时间 1791140855334 → 最后 sample 1791140873200，约 **17.866 秒**，3 次采样。官方 usage `source=agent-db`：totalTokens **11224418509**、requestCount **78913**、totalTurns **3122**、toolCallCount **93601**，三次均完全相等。318 task 未新增，未出现新的 running/trace 行。9 种实际 RPC（5 状态 + listTasks/listPinnedTasks/listSessions/getAppUsageStats）都在固定 allowlist。schedulerPolicy 全 false。见 `observations.json`；最终比较器也拒绝既有 completed→running，同 trace 不漏检。

**构造性 0 + 窗口侧证 PASS**：没有发起任何模型方法。`ProviderRequestGate` 仍 installed/enforceable=false，不把 sent=0 当实际计量。Live HTTP 无禁网，不能宣称请求层硬拦截；Host 首启→首个 usage baseline 之间缺乏独立请求级计量，三重侧证仅覆盖记录窗口。共享 usage 若增长不归因我方，立即停止并记 attribution unknown。

## 闸门判定表

| 输入 | 判定/准入 | 证据 |
|---|---|---|
| fresh running、非我方 | active/other，禁写、保留视图 | Node 判定级 + UI 合成；**真实活跃会话激励已做→FAIL（false-idle，见修复轮更新）** |
| 我方内存 active（DB 缺失也优先） | active/ours，normal busy、禁重复写 | Node 判定级；无真实我方 turn |
| fresh 官方查询 + completed/error | idle/none，eligible | 真 idle `gates.json`，completed 自动化绑定会话；conversation-runtime 仍无实际写入 |
| task 缺失、未知 status、查询陈旧/未来 timestamp | unknown，禁写 | Node 判定级 |
| running 的 activity 陈旧 | unknown，禁写 | Node 判定级，不把陈旧 running 当空闲 |
| cronAutomationId/offPeakTaskId | 警示可能后台自动运行 | 真实 idle cron 绑定 + 单测 |
| active→unknown→idle 自动刷新 | 禁写/禁写/恢复 draft eligibility，草稿保持、Send 禁用 | jsdom 三分矩阵；不是 GUI LIVE |

首启及后续3次 official listTasks 均无 running。用户原有后台任务可能已结束；已异步请求仍运行的标题/ID，未收到。没有制造模型请求来补格，没有用 cold sessions-index completedSuccess 放行。

## 失败态、失败尝试与恢复测试

- auth state helper 覆盖无账号、reauthentication-required、非账号 executable 不足以解锁（拒绝 API-key fallback）；真实撤销/真实损坏均 NOT_RUN。signed-out/reauthentication/credential recovery → stop，单 launcher 实例不自动重试。
- `scratch-corrupt.json`：仅在 fresh scratch 写入合成 `credentials.json` 密文格式；官方 Host 自行恢复 signed-out，文件 metadata 改变；未读取文件值、未复制真实材料、未重复启动。network/Keychain OS-denied，0 模型。
- 首轮 DSH 新 spec 用 JSX 写在 `.ts` 中，parse fail/no tests；改 React.createElement，最终通过。初始 lint 扫进 unchanged vendored host-bus 产生基线 unused warnings；touched files 最终 0 warnings/errors。native 首次选择含 ui-settings 的 51 files/969 passed，随后正确 owner 范围 60/1373 passed。
- 第一个 scratch harness 忘设 output 参数，短暂覆盖自己的既有 session-create evidence；新证据立即复制到 conversation-runtime，tracked session-create originals 从干净基线恢复，未留旧证据变更。
- 文件发现中有不存在路径/glob/过宽 HOME filename scan 权限错误及截断；没有打开秘密文件或 Keychain item；后续收窄到 repository source。没有把发现失败当完整覆盖。
- CUA 尝试 iab 不可用、Chrome accessibility/debugger 未附加；未操作官方 GUI，**浏览器视觉 PASS 不存在**。
- **持久 web viewer 首次 Live HTTP 失败**：`persistent-web/failed-launcher-states.jsonl` authVerified=true 后 status-query-failed；没有 ready/目录成功，立即停 Host/Main，不重试。标准 net.listen 对照证明 socket 121 bytes EINVAL vs 82 listening；short config+fork前断言已修，原症状在真实 HOME 中 **未重跑**。详见 `debug-notes.md`（adaptive-debugging）。GUI inventory before 此额外 attempt 未保存，不能宣称它前后逐项一致；after snapshot 保留。

## 留给主 agent 的持久服务器

当前只保留 DSH web server；状态-only 检查 `persistent-web-current.log` 为 not-connected / spawnedByCheck=false；尚未点击 Connect。base URL **http://127.0.0.1:3092/**；一次性 token 已在 commentary 交给 main，未提交到 Git。

- DSH_HOME `/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/launcher-recovery-web/dsh-home`，profile `profiles/web`，workspace sibling `workspace`；HOME `/Users/ibobby`，`ZCODE_DESKTOP_HOME_DIR` 如实沿用（本机未设）。Host/Electron scratch `/private/tmp/s3web/runs/web-muu88t5v`；初始化不会自动 Connect。
- supervisor **43609** / CLI **43658**；`.agent-work/tmp/launcher-recovery-web/server-pid.json` 是实时 owner 清单。用户要求保持，任务结束不主动关闭。接管/重启仅信号这些 own PID，禁进程名杀 GUI。
- 从 repo 运行 `HOME=/Users/ibobby node scripts/start-conversation-runtime-web.mjs`，脚本填写全部 profile/launcher/env 绑定并输出新的 token URL；旧 token 失效。web 子命令不支持 `--profile`，固定使用 web profile，首次错误 flag 已记失败。
- main/operator Connect → 侧栏 Refresh；只读 metadata card/闸门轮询，Send 禁用，不恢复/关闭/停止真实会话。`CONVERSATION_WEB_CHECK_OUTPUT=<fresh-dir> node scripts/check-conversation-runtime-web.mjs --observe-existing` 只观察既有实例；去掉 flag 会由调用者显式 Connect，请勿混用旧失败输出目录。

## 修复轮更新：CA3-launcher-recovery-01 真实活跃激励（2026-10-04，实现者 native @impl_std）

CA3-launcher-recovery-01 是「活跃禁写格从未被真实 running 会话激励」。本轮按合同用主 agent 会话自身作激励，**判定结果为 FAIL，不是 NOT_RUN**：官方共享 task metadata 对一个正在跑的真实会话仍报 `completed`，闸门因此返回 `idle/allowed`，即 **false-idle（活跃被当空闲）**。

- 激励源：驱动本派发的官方 GUI 主 agent 会话 `sess_2df40173-…`（标题 `dsh-zcode`，workspace `dsh-zcode-acp`）。进程链 `验证 subagent shell → zcode-cli(1878) → zcode-host-local-1(1843) → ZCode(1783)` 证明该 GUI 运行时正处于一个 open turn 内（正在执行本 subagent），而共享行状态为 `completed`、`lastActivityAt` 停在 1791143554641。约 90s×7 次 live 轮询与只读 DB 副本（含 WAL）查询均 0 running 行、0 running automation。
- 判定实测：对该真实活跃会话 `writePreflight` → `{decision:'idle', reason:'shared-task-confirmed-idle', allowed:true, owner:'none'}`（应为 active/official-gui-active-turn/allowed=false）。对照 completed 会话 → idle/allowed（PASS）。归属格仍为判定级（`tests/scratch-launcher-live-http.test.mjs:36` + queue-guide-goal 先例；0 模型请求/禁 session create 下无真实我方会话可造）。
- 根因（源码）：共享 tasks-index 的 `task_status` 对**已存在的会话**只在终态迁移写 completed/error（`zcodeTaskIndexSyncer.ts:567-624,661-699`；stream 事件同样只写 completed/error，`zcodeTaskServiceAdapter.ts:1420-1484`）；被 resume 的会话在下一轮 running 期间不会回写 running。`getTaskMeta`/`listSessions` 都读同一冷共享库（`zcodeTaskServiceAdapter.ts:2605-2608`；`zcodeAgentService.ts:3614-3635`），无跨 Host live 信号（queue-guide-goal 已记原始 sessions-index 跨 Host LIVE FAIL）。故闸门对“resume 后的活跃 turn”无法与空闲区分。
- **未改产品语义**：无有界修复可用（要加 live 信号必须扩展 `LIVE_HTTP_READ_CALLS`/订阅面，超出本 bounded 修复边界），按「发现真缺陷则上报、不改语义」返回 parent adjudication。证据 [active-stimulus/](../probes/checks/launcher-recovery-resume/active-stimulus/result.json)（`result.json`/`preflight-active-real.json`/`preflight-idle.json`/`process-ancestry.json`/`tasks-index-readonly.json`/`catalog.json`/`live-poll.txt`/`source-evidence.json`）；0 模型请求、0 写入、0 凭据读取、GUI 仅 ps。
- NIT 债务（不修）：Main 的 `rpc` 观测数组每次 `safeCall` 无界 `push`（`packages/host/launcher/main.mjs:25`），而 SharedTaskPanel 每 2s 轮询 `writePreflight`→`getTaskMeta`，长生命周期 Main 内该数组单增；建议后续改为有界环形/计数。
- 本轮 checks（无产品代码改动）：bridge Node **280/280 PASS**、DSH 集成 **177/177 PASS（19 files）**、build PASS；log 在证据目录（`node.log`/`integration.log`/`build.log`）。

## Checks 与交付

### 活性信号轮 活性信号修复轮（2026-10-04，impl_large；最新结论）

**usage 与 session.updatedAt 能在 open turn 内间歇移动；30 秒 usage 双采样候选仍对真实主会话 false-idle，活性信号轮 未闭合。候选已隔离，生产闸门与白名单恢复 `9c52540` 原状；停止扩大修复并升级 main。** 这不是 CODE CLEAN 或 acceptance。

- 链：CA3-launcher-recovery-01 无真实激励 → active-stimulus 证实共享 completed 导致假空闲 → 活性信号轮 admission/修复裁定 → 本轮正/负信号探测 → 有界 usage 窗候选 → 原失败合同复验 **FAIL** → 隔离候选并保留升级证据。最新证据：[live-signal-fix/README.md](../probes/checks/launcher-recovery-resume/live-signal-fix/README.md)、[result.json](../probes/checks/launcher-recovery-resume/live-signal-fix/result.json)。
- 官方 `sessionUsage` 服务名是 `zcode-agent.getTaskTokenUsage`（下游 `v4/conversation/usage`）。第一组 5 次/63.076 秒主会话 974 requests、15,120,754 tokens 全静止；随后 3 次/约 31 秒 975→975→976。源码在**单次模型请求** completed/error/cancelled 时提交 usage，不是连续流活性，也不是只在整个 turn 终态刷新。不能把 usage 静止当占用结束。
- 精确 `listSessions(sessionIds=[id])` 的主会话 session.updatedAt 为 1791146320559→1791146320559→1791146617143，status 始终 idle；未返回 revision/logEpoch。`getTaskMeta` 8 次始终 completed/1791143554641。`readSession(existing-only)` 8 次均 sessionUnavailable (-32004)：观察 Host 不持有 GUI Host 的 live record。
- conversation 冷订阅：完成官方 hello/clientHello 后，两次有效尝试仍 `-32603 / fault.subscribe.resumeFailed / EPERM`，一次补 workspace 只读 grant 也未解决。revision/logEpoch **不可得/NOT_OBSERVED**，不能记为静止；没有进一步扩大写权限、读取真实 DB 或操作 GUI。确切 EPERM 路径/操作未定位。
- 候选实现完整保留在 [candidate.patch](../probes/checks/launcher-recovery-resume/live-signal-fix/candidate.patch)：可配置 2–30 秒 usage 双采样，移动→active/禁写；DB running/同 Host 归属优先；信号错误→unknown；静止后重新读 task；只增 getTaskTokenUsage 只读白名单和所需 preflight timeout。7 个新增判定级测试通过，Node 候选 **287/287 PASS**。**实际最大 30 秒窗**主会话仍 `idle/shared-task-and-usage-window-idle/allowed=true/changed=[]`（FAIL），completed 对照 idle/allowed=true（PASS）；见 [candidate-live/preflights.json](../probes/checks/launcher-recovery-resume/live-signal-fix/candidate-live/preflights.json)。真实候选走 bridge Main control preflight→官方 RPC，没有声称 DSH HTTP LIVE 通过。
- 失败候选已从生产源撤回，补丁可在隔离 checkout 应用复现，`git apply --check` PASS；不把此算法当作相应有界缺口的修复。下一有界任务须取得官方跨 Host active-turn/lease 真值、修复共享活动状态传播，或由 main 显式裁决静止时的产品语义。不能报告“所有官方信号仅终态写”，但也不能报告闸门闭合。
- 检查：最终生产源与基线一致，bridge Node **280/280 PASS**；DSH 集成 **177/177 PASS（19 files）**；build/diff-check PASS；候选额外测试 **287/287 PASS**。0 我方 prompt/模型执行 RPC、0 凭据读取、0 直开真实 SQLite、0 bridge 写真实 ~/.zcode、0 session close、0 DSH 产品编辑、0 push。官方 GUI 仅 ps，全部前后清单一致；自有进程组 remaining=[]；共享 usage 增长不冒充我方请求计量。
- 探针早期不合法 messageLimit、事件入参、遗漏握手/错误协议版本的失败均保存并在 README 如实解释，不计作有效冷订阅观测。未派发子 agent；既有用户持久 web viewer 未动。分块 Conventional Commits 见本轮 Git log（探针/隔离候选证据、handoff 升级说明）。

### 盲区操作化轮 盲区诚实操作化（2026-10-04，main 裁决；实现者 native @impl_std）

**main 裁决：不再把「终态 task + usage 静止」声明为 idle；把跨 Host 活性盲区作为第四判定态 `unverifiable` 暴露，并加一次性确认门。** 依据 活性信号轮 负结果（30 秒 usage 窗对真实主会话仍 false-idle，`getTaskMeta` 无 live 信号；[live-signal-fix/README.md](../probes/checks/launcher-recovery-resume/live-signal-fix/README.md)）。本轮交付**闸门 + 确认机制 + 判定级/jsdom 测试**；conversation-runtime 真实写入仍禁用，真实发送解锁归后续节。

- `write-gate.mjs`：终态 `completed`/`error` 非我方持有时返回 `decision:'unverifiable'`，`allowed:false`，`requiresConfirmation:true`，`reason:'shared-terminal-task-liveness-unverifiable'`，`blindSpot:'cross-host-live-turn-undetectable'`。仅当 `confirmed`（显式操作者确认）时转 `idle/allowed:true/reason:'shared-terminal-task-operator-confirmed'`。running / own / 缺失陈旧语义不变。
- usage 窗启发式：并入隔离候选的 `SharedWriteGate` 双采样，窗内 usage 计数或 `task.updatedAt` 移动 ⇒ `active`/禁写（无确认门）；静止仍 `unverifiable`（不升级为 idle）。窗长 `activityWindowMs` 默认 **5000 ms**、可配置 **2000–15000 ms**（不用 30 s）；只增只读白名单 `zcode-agent.getTaskTokenUsage`；preflight carrier 超时相应延长。注释如实标注为启发式、非保证。
- UI（`directory-view.jsx` `SharedTaskPanel`）：`unverifiable` 且未确认时呈现一次性确认（含「对侧实时运行无法完全判定（长工具等待期检测盲区）」文案）；确认按 address 记入模块级 Set（每会话每 DSH web 会话一次，刷新重问）；确认后该会话后续写入按 idle 呈现（draft 可用），但 `active`/`unknown` 仍覆盖确认、Send 在 conversation-runtime 恒禁用。

四态判定表：

| 输入 | decision | allowed | requiresConfirmation | 说明 |
|---|---|---|---|---|
| 非我方 fresh running | active | false | false | `official-gui-active-turn` 禁写 |
| 我方 Main lease | active | false | false | `own-turn-busy`，优先于 DB |
| 终态 completed/error，未确认 | **unverifiable** | false | **true** | 盲区，需一次性确认 |
| 终态，已显式确认（或窗内 usage/updatedAt 移动） | idle / active | true / false | false | 确认转 idle；移动判 active 禁写 |
| task 缺失/未知 status/陈旧/未来时间戳 | unknown | false | false | 保持 fail-closed |

- Checks：bridge Node **291/291 PASS**（280 基线 + 11：`tests/observation-unverifiable-gate.test.mjs` 9 + `scratch-launcher-live-http.test.mjs` 四态/确认 2）；DSH 集成 **178/178 PASS（19 files）**（177 基线 + 新确认流 1）；build PASS；`git diff --check` PASS。分块 commits：`14281fb`(host gate)、`cd7c8a2`(client UI)、`7576878`(host tests)、`0ae03c6`(client spec)。0 模型请求、0 凭据读取、0 session/close、0 DSH 产品编辑、0 push。

- bridge Node **277/277 PASS**；新 targeted **59/59**（既有 launcher43+新16）。DSH 集成 **176/176 PASS，19 files**。native **1373/1373 PASS，60 files**（DSH 未编辑）；build PASS；touched lint/diff-check PASS。log 在本证据目录。
- auth/core 首次 LIVE/真实 idle gate/三重窗/GUI并存 PASS；真实 active gate、GUI实际呈现与用户目录对照、修正后 viewer/final head LIVE **NOT_RUN/待 main**；真实模型写、session close、CAS/full-queue-guide-goal/跨侧 stop、真实撤销/损坏、Keychain item 操作均禁止/未执行。
- 分块 Conventional Commits：`601c44f` host/gate/tests；`22d03a2` client projection/UI tests；harness/docs/evidence（其 hash 见 Git log）。没有 push、独立评审、acceptance 或任务权威修改。审计证据由 main 打包；本实现者没有另造审计 ZIP。
