# minimal-turn-usage handoff — 唯一一次最小模型任务与非空 usage

**实际消耗：2 次模型请求（1 条 prompt），其中主 turn 1 + 官方自动标题 1；会话内 usage `modelRequestCount=2`、`totalTokens=23916`（input 23901 / output 15 / cacheRead 192），`modelErrorCount=0`。距 30 上限余量 28。** 任务权威文件 `.agent-work/tasks/minimal-turn-usage-TASK.md` **不存在**；本节按派发提示全权执行。bridge `feat/zcode-runtime-bridge`，基线 `20ac937`，EXECUTE_WITH_COMMIT，不 push。

## 计数口径与逐次入账

计数单位=官方 runtime 实际发出的每次模型请求；归属口径=**新会话的官方 `getTaskTokenUsage`**（不是共享账号 app usage——官方 GUI 与派发本 agent 的主会话并发在跑，app usage 增量不归因我方）。

| 尝试 | 运行目录 | 结果 | 会话创建 | 模型请求 | 证据 |
|---|---|---|---|---|---|
| 1 | `web-muuc5cq1` | FAIL `live-http-read-failed` | 否 | **0** | `send-before-attempt1.json`；失败态 `failed-attempt-states.json` |
| 2 | `web-muuc7r3v` | FAIL `live-http-read-failed` | 否 | **0** | `attempt2-sandbox-denial.json`（本地诊断：`EPERM ... stat '/Users/ibobby/.zcode/agents'`）；`observation-orphan-check.json` 无 orphan 行 |
| 3 | `web-muuca2t5` | **DELIVERED** createTask+sendPrompt 受理 | 是 `sess_100bfd37-…` | **2** | `send-result.json` / `task-usage.json` / `final-row.json` / `turn-samples.json` |

attempt 1/2 在 `zcode-task.createTask` 即失败、无任何会话行、无 prompt，故 **0 模型请求**；attempt 3 才是唯一一次 prompt。app usage 同时段 `requestCount 80375→80403（+28）`、`totalTokens +2,421,230`，**不可归因**（并发官方 GUI/主会话），已如实区分，未计入我方预算。

## 实现（发送路径解锁，有界）

- `packages/host/launcher/minimal-turn.mjs`（新）：一次性 dispatch（claim 标记按 runRoot，重启再武装）。claim 在任何副作用前落盘（`<runRoot>/minimal-turn-usage.json`），随后 `zcode-task.createTask`（新会话，workspace=launcher scratch cwd，mode `yolo`，`deferPersistenceUntilFirstPrompt`）+ `zcode-task.sendPrompt`（固定 prompt `Reply with exactly: ok`，`toolDenylist:[CronCreate,OffPeakCreate]`）。不接受任何 caller address/prompt/model/session id；无 resume/close/retry。
- `observation.mjs`：新增 `LIVE_HTTP_SEND_CALLS`（`zcode-task.createTask/sendPrompt`）与 `LIVE_HTTP_ALLOWED_CALLS`；conversation-runtime 只读白名单 `LIVE_HTTP_READ_CALLS` 不变。
- `launcher/main.mjs`：新增 `sendMinimalTask` 操作（单发+写账本 `writeRpc` 与只读账本 `rpc` 分离）、`taskUsage` 只读操作（`zcode-agent.getTaskTokenUsage`）；`safeCall` 现在强制只读白名单，`safeSend` 强制写白名单；失败时把有界错误信息落 scratch `launcher-read-errors.jsonl`（不回传 DSH）。
- `launcher/index.mjs`：放行 `sendMinimalTask`（carrier 超时 120s）与 `taskUsage`。
- `runtime.mjs`：`runMinimalTurn()`（host-backed only，注入 bridge-owned address）与 `taskUsage(address)`（authority/workspace 校验）。
- `index.mjs`：`/zcode-bridge` 端点 `ownTurn`（空 payload）与 `taskUsage`（仅 address）。
- `directory-view.jsx`：侧栏 minimal-turn-usage 控件（`Bridge-owned minimal turn (minimal-turn-usage)`）经同一 `/zcode-bridge/ownTurn` 发起，展示新 task、写账本、归属闸门、会话 usage 回读。
- **sandbox 修复（根因）**：`config.mjs` live-http Seatbelt 只读放行**初版**为 `~/.zcode`、`~/.agents`、`~/.claude` 三根 → `5ca3e4d` 复审**收窄为仅 `~/.zcode`**（`~/.agents`/`~/.claude` 无 EPERM 证据移除；未来逐根放行须带诊断证据）。`~/.zcode` 覆盖官方 runtime 启动会话时读取的 user-scope 数据（subagent profiles/skills/commands/hooks）与官方凭据/agents 文件。写仍限于 runRoot+settings/DB 根；Keychain/securityd 拒绝不变。收窄后 profile 未在 live 上实测 createTask（0 请求约束）；下次真实 createTask 兼作活体探针——若官方 runtime stat `~/.agents`/`~/.claude` 再报 EPERM，按证据逐根放行。

## 真实链与 usage 回读

- 新 task `sess_100bfd37-b1e5-4c8b-8d4c-17aeda37142e`，workspace `/private/tmp/s3web/runs/web-muuca2t5/workspace`（launcher scratch cwd），官方自动标题 `Request to reply exactly with ok`，状态 `completed`；共享 task 数 320→321（仅此一条）。
- `taskUsage` 非空回读：`totalTokens 23916 / input 23901 / output 15 / cacheRead 192 / modelRequestCount 2 / modelErrorCount 0`（`task-usage.json`；web UI 侧由控件 `Read session usage` 显示，`/zcode-bridge` JSON 证据）。
- 归属：会话由官方 Host 服务创建并入库（`zcode-task` 行 + 官方 usage 面），history authority 归 ZCode；`revision/logEpoch` 无暴露载体，**NOT_OBSERVED**。
- 写账本仅 `zcode-task.createTask`、`zcode-task.sendPrompt`；只读账本仍为 conversation-runtime 白名单并新增 `getTaskTokenUsage`；`schedulerPolicy` 全 false，headless `windowEvents/windows/webContents=0/0/0`。

## 闸门与缺口（如实）

- 目标新会话在 turn 运行期持有我方 lease（`authority.owns`），正常路径应为 `active/own-turn-busy/ours`。但最小 turn 在首次 4s 轮询前已终结、lease 随即释放，**运行期 own-turn-busy 未被采样**；turn 后取样为 `unverifiable/shared-terminal-task-liveness-unverifiable/none`（fail-closed，符合 盲区操作化轮 语义）。`preflight-final.json` 为准。
- task 行 `running` 中间帧同样未被采样（turn <4s）；观测到终态 `completed`。任务行创建与终态转换成立，running→completed 的中间帧 **NOT_OBSERVED**。
- 单发保护由判定级测试覆盖（第二次 `run` 在任何副作用前 `minimal-turn-already-claimed`）；未在 live 上二次触发（会停止 Main），未做第二条 prompt。**如实说明：claim 标记按 `runRoot` 计（`<runRoot>/minimal-turn-usage.json`），launcher 换新 runRoot 重启即重新武装；预算守卫=观察式对账（`accounting.json` 逐次入账）与 UI 单发路径，非持久硬闸**。未实现跨 runRoot 持久化（会越出本 section 写边界）。

## 健康

`health.json`：官方 GUI 前后 9/9 行完全一致（`gui-diff.txt` 空）；DSH 栈 supervisor 76764 / CLI 76766 / Main 76942 / Host 76964，agent runtime 子进程 2 个（idle，随 launcher 进程组回收）；成功 run 无 `launcher-read-errors.jsonl`；无 orphan 会话（两次失败 attempt 的 workspace 不存在于 listTasks）；无泄漏。web 栈保持运行于 3092（新一次性 token 见派发回报，未入 Git）。

## 回归与 checks

- bridge Node **299/299 PASS**（291 基线 + 8 新 `tests/minimal-turn-usage.test.mjs`）。
- DSH 集成 **179/179 PASS，20 files**（178 基线 + 新 `tests/minimal-turn-usage.dsh.spec.ts`）。
- build PASS；touched oxlint 0 warnings/0 errors；`git diff --check` PASS。
- 未跑 native（DSH 产品代码零编辑）、未跑完整 DSH build（无 DSH 改动）。

## NOT_RUN / 留给 main

- 未在真实浏览器点击 UI 按钮（live 二次触发会被单发保护拒绝并停止 Main）；UI 控制与端点由 jsdom spec + `/zcode-bridge` live 证据覆盖。
- 真实撤销/损坏、session close、共享写 CAS/full-queue-guide-goal 均沿用 conversation-runtime 边界外，未执行。
- 请求级硬顶机制仍不存在（session-create 已证），本节为观察式预算（有界探测条目）。
- sandbox 放行面是否需进一步扩展（`~/.gitconfig` 等）留待后续真实工具执行任务验证；本次最小 prompt 未触及工具面。
