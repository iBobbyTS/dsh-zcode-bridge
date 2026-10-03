# S05 交付清单与实现备忘：用户交互、计划审核与 Hook Trust 完整可操作

## 1. 任务背景与执行模式

- **任务定位**：SFD `dsh-zcode-bridge` 之 S05 交付（用户交互、计划审核与 Hook trust 完整可操作）。
- **执行角色**：`impl_std` 实现 worker（external agy / gemini-3.8-flash / high / yolo），模式 `EXECUTE_WITH_COMMIT`。
- **主写域**：`dsh-zcode-bridge`（分支 `feat/zcode-runtime-bridge`，起点 HEAD `656f64d`）。
- **DSH 克隆**：`/Users/ibobby/Projects/dsh-zcode-acp/dsh`（分支 `feat/zcode-runtime-bridge`，HEAD `cf7893e40f`，保持纯只读，本次无变更）。
- **参考上游**：`reference/ZCode` / 官方 App 只读对照。

---

## 2. 受限态建模与红线遵守

1. **受限态显式呈现**：
   - 顶部状态栏清晰标注 `Runtime: restricted (official auth-gated)`。
   - 交互卡片族标注 `Fixture-driven pending interaction (live runtime is auth-gated)`，严禁宣称已获得模型授权。
2. **0 伪造 / 0 模型调用**：
   - `paidModelCalls = 0`，全流程 0 次真实模型计费调用。
   - 不伪造官方未返回的成功状态，网络/服务回包严格回显官方 `status` 与 `reasonCode`。
3. **单个权威 Pending Registry**：
   - 完全复用 S03.B 的 authoritative pending 机制，基于 `snapshot.pendingInteractions`，不另起前端第二缓存/状态注册表。
4. **Fail-safe 未知类型防护**：
   - 遇到未识别的交互类型（如 `unrecognizedAutonomousTelemetryGate`），按有界结构安全降级呈现，不妄猜字段语义，保障 UI 与进程永不崩溃。
5. **不 YOLO 默认值**：
   - 官方多题 questionnaire 若无默认值则置空，答题草稿在题间来回切换时不丢失；取消操作仅提交 `{ action: 'cancel' }`。
6. **无 session/close 泄漏**：
   - 借用流释放仅调用自身清理，不向上游发送 `session/close`。

---

## 3. Carrier 先核实后实现表 (Carrier Verification Matrix)

在实现前全面检视 `reference/ZCode` 中的 `command.ts`、`workspace-hook-review.ts`、`workspaceHookReviewCommands.ts`、`ElicitationDialog.tsx`、`V4InteractionDialogs.tsx`、`interaction-background.ts`。核实结果如下：

| 命令 / 交互能力 | 官方 Reference 源码依据 | Wire Payload 形状 | 实现状态 | 说明 / 证据 |
|---|---|---|---|---|
| `resolveInteraction` (Elicitation / 问卷) | `command.ts:474`, `ElicitationDialog.tsx:160` | `{ interactionId, answer: { action, content: { answers } } }` | **已实现** | 官方 wire 形状。支持 multi-question 逐题切换、draft 暂存不丢失、accept / decline / cancel。 |
| `snoozeInteractionAutoResolution` | `command.ts:488`, `interaction-background.ts:24` | `{ interactionId }` | **已实现** | 倒计时交互支持“用户首次输入自动延期”，发送 snooze 命令并保持倒计时挂起。 |
| `respondWorkspaceHookReview` | `command.ts:511`, `workspace-hook-review.ts:320` | `{ target, decision: { reviewItemIds } }` | **已实现** | 支持信任勾选的 hook items（单项或 bulk trust）。`target` 严格携带 `sessionId`, `bundleDigest`, `reviewFlowId`, `generation`, `interactionId`。 |
| `toggleWorkspaceHookReviewItem` | `command.ts:522`, `workspace-hook-review.ts:335` | `{ target, reviewItemId, enabled }` | **已实现** | 允许用户在安全审核中切换单个 hook 的 `configuredEnabled`。审核卡片保持处于 review 状态。 |
| `revokeWorkspaceHookTrust` | `command.ts:533`, `workspace-hook-review.ts:348` | `{ ...target, reviewItemIds }` | **已实现** | 允许撤销已信任 hook 项。已信任状态显示撤销按钮。 |
| `requestWorkspaceHookReview` | `workspaceHookReviewCommands.ts:45` | `{ target }` | **已实现** | 软准入横幅 (`workspaceHookAdmission`) 提供触发入口，用户点击可发起重新审核。 |
| 本地脱机持久 Hook Trust 存储 (无会话) | `workspace-hook-review.ts:210` | N/A (依赖宿主本地 SQLite/Keychain) | **标不可用 (R16)** | 受限态下无官方持久会话与安全宿主信任库支持，遵照 R16 标不可用并在界面/命令中拒绝假成功。 |

---

## 4. 交付清单 (Deliverables)

1. **Host 契约守卫 (`packages/host/conversation.mjs`)**:
   - `V4Conversation.submit`: 补齐 `snoozeInteractionAutoResolution`, `respondWorkspaceHookReview`, `toggleWorkspaceHookReviewItem`, `revokeWorkspaceHookTrust` 的 pending interaction 确认校验，未确认或不匹配抛出 `interaction-unconfirmed`。
2. **Client 交互卡片族与控制器 (`packages/client/conversation-view.jsx`)**:
   - `ConversationController`: 增加 `snoozeInteractionAutoResolution`, `respondWorkspaceHookReview`, `toggleWorkspaceHookReviewItem`, `revokeWorkspaceHookTrust`, `requestWorkspaceHookReview` 方法。
   - `buildElicitationContent(questions, drafts)`: 导出纯函数，精准遵循官方 elicitation answer 协议（多题单选/多选/freeText 格式化）。
   - `ZCodePendingInteractions`:
     - 软准入横幅：`workspaceHookAdmission` 触发 `requestWorkspaceHookReview`。
     - 多题问卷卡片：支持题目上下翻页、草稿不丢失、单选/复选/文本输入、首次交互自动 snooze、接受/拒绝（带部分答案）/取消。
     - 计划审核卡片：显示 markdown 计划文本、快照计划条目状态清单、Goal 摘要与目标状态、Approve / Reject（支持输入反馈理由）。
     - Hook 安全审核卡片：展示危险告警、工作区标识、Hook 计数、来源文件列表、条目启闭 toggle、单项/批量 trust、已信任项 revoke。
     - 官方结果回显：完整保留并回显官方 `status` 与 `reasonCode`（如 `proto.alreadyResolved`, `proto.interactionExpired`, `proto.revoked`, `workspace_hooks_require_trust_capable_host` 等），不造假。
     - 未知交互 Fail-safe：渲染有界摘要，不崩不猜。
3. **测试夹具 (`tests/fixtures/s05/`)**:
   - `questionnaire.json`: 多题问卷（单选、多选、文本、草稿、自动解决倒计时）。
   - `plan-review.json`: 计划审批（ExitPlanMode、条目列表、Goal 状态）。
   - `hook-review.json`: Hook 安全审核与软准入横幅。
   - `expired-late-other.json`: 官方错误/幂等原因码。
   - `reconnect-recovery.json`: 断线重连与待处理交互恢复。
   - `unknown-interaction.json`: 未知交互类型容错。
   - 夹具生成脚本 `scripts/make-s05-fixtures.mjs`。
4. **自动化测试套件**:
   - `tests/s05-commands.test.mjs`: 3 个 Node 单元测试，验证命令交互防护、wire payload 构造与 snooze 处理。
   - `tests/s05.dsh.spec.ts`: 10 个 DSH Vitest 集成测试，覆盖问卷答题、拒绝保留草稿、取消、计划通过/拒绝、Hook 审核启闭/信任/撤销、官方原因回显、重连恢复、未知类型 Fail-safe 与 DSH `renderSessionArea` 挂载槽。

---

## 5. Checks 实跑矩阵

| Check 项 | 命令 | 结果 | 耗时 |
|---|---|---|---|
| Bridge 单元测试 (Node test runner) | `npm test` | **56/56 PASS** (新增 3 项，原 53 项无回退) | 790ms |
| Bridge DSH 集成测试 (Vitest) | `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **46/46 PASS** (新增 s05 10 项，全 6 个套件 0 fail) | 5.31s |
| DSH 原生定向回归 (Vitest) | `pnpm vitest run packages/api/session-controller/tests packages/client/ui-session/tests packages/client/ui-workspace/tests` | **1367/1367 PASS** (57 文件，0 fail) | 11.12s |
| DSH 类型检查 | `pnpm_config_verify_deps_before_run=false pnpm typecheck:contracts-ready` | **PASS** (0 errors) | 2.5s |
| DSH 文档门禁 | `pnpm_config_verify_deps_before_run=false pnpm test:docs` | **21/21 PASS** (0 failed) | 43.17s |
| DSH 全量构建 | `pnpm_config_verify_deps_before_run=false pnpm build` | **PASS** (355 client artifacts) | 2.48s |
| Bridge 源码构建 | `npm run build` | **PASS** (生成 client.js) | 120ms |
| 代码 Linter (oxlint) | `oxlint packages/client/conversation-view.jsx packages/host/conversation.mjs tests/s05*` | **0 errors, 0 warnings** | 29ms |
| Git Diff 空白检查 | `git diff --check` | **PASS** (0 warnings) | — |

---

## 6. NOT_RUN 声明

- **真实在线模型交互 Oracle**：`NOT_RUN（auth-gated）`。受官方授权壁垒保护，在未提供真实官方登录凭证的环境下保持受限，不作付费模型调用探测。
- **本地持久 Hook 信任存储**：`NOT_RUN（unavailable without host session storage per R16）`。

---

## 7. 给 S06 的契约与建议

1. **交互与审核闭环完成**：S05 已经实现了所有用户交互卡片族的权威收口、多题草稿持久性、审批理由输入和 Hook 审核 wire 命令。S06 若进入长会话/高级工作流，可直接依赖 `ZCodePendingInteractions` 与 `ConversationController` 交互方法。
2. **官方结果码协议遵循**：S06 继续使用 `status` 与 `reasonCode` 进行精确呈现，不可为了所谓“平滑体验”伪造 `success` 或省略 `alreadyResolved` / `expired` 状态。
3. **Fail-safe 机制延续**：任何新产生的 interaction kind 必须保留默认 fallback 分支，保证在未知扩展协议到达时不崩毁主会话视图。
