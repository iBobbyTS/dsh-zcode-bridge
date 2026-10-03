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

在实现前全面检视 `reference/ZCode` 中的 `command.ts` (176–205)、`workspace-hook-review.ts` (20–77)、`workspaceHookReviewCommands.ts`、`ElicitationDialog.tsx` (267–298)、`V4InteractionDialogs.tsx`、`interactionAutoResolutionCommand.ts`、`interaction-background.ts`。核实结果如下：

| 命令 / 交互能力 | 官方 Reference 源码依据 | Wire Payload 形状 | 实现状态 | 说明 / 证据 |
|---|---|---|---|---|
| `resolveInteraction` (Elicitation / 问卷) | `command.ts:176-188`, `ElicitationDialog.tsx:267-298` | `{ interactionId, answer: { action, content: { answers, answer_0 } } }` | **已实现** | 官方 wire 形状。支持 multi-question 逐题切换、draft 暂存不丢失、accept / decline / cancel。 |
| `snoozeInteractionAutoResolution` | `command.ts:205-207`, `interactionAutoResolutionCommand.ts:9-45` | `{ interactionId }` | **已实现** | 倒计时交互支持“用户首次输入自动延期”，发送 snooze 命令；消费命令 ACK，若 rejected 则回滚显示并呈现告警。 |
| `respondWorkspaceHookReview` | `command.ts:189-191`, `workspace-hook-review.ts:20-49` | `{ ...target, decision: { action: 'trust_selected', reviewItemIds } }` | **已实现** | 平铺形状。支持信任勾选的 hook items（单项或 bulk trust）。`target` 严格携带 `sessionId`, `bundleDigest`, `reviewFlowId`, `generation`, `interactionId`。 |
| `toggleWorkspaceHookReviewItem` | `command.ts:192-195`, `workspace-hook-review.ts:33-49` | `{ ...target, reviewItemId, enabled }` | **已实现** | 平铺形状。允许用户在安全审核中切换单个 hook 的 `configuredEnabled`。审核卡片保持处于 review 状态。 |
| `revokeWorkspaceHookTrust` | `command.ts:196-201`, `workspace-hook-review.ts:33-63` | `{ ...target, reviewItemIds }` | **已实现** | 平铺形状。允许撤销已信任 hook 项。已信任状态显示撤销按钮。 |
| `requestWorkspaceHookReview` | `command.ts:203`, `workspace-hook-review.ts:67-77`, `workspaceHookReviewCommands.ts:45` | `{ sessionId, workspaceIdentity, bundleDigest }` | **已实现** | 软准入横幅 (`workspaceHookAdmission`) 提供触发入口，用户点击发起重新审核。缺少 `workspaceIdentity` 遵循 R16 禁用并提示。 |
| 本地脱机持久 Hook Trust 存储 (无会话) | `workspace-hook-review.ts:210` | N/A (依赖宿主本地 SQLite/Keychain) | **标不可用 (R16)** | 受限态下无官方持久会话与安全宿主信任库支持，遵照 R16 标不可用并在界面/命令中拒绝假成功。 |

---

## 4. 交付清单 (Deliverables)

1. **Host 契约守卫 (`packages/host/conversation.mjs`)**:
   - `V4Conversation.submit`: 补齐 `snoozeInteractionAutoResolution`, `respondWorkspaceHookReview`, `toggleWorkspaceHookReviewItem`, `revokeWorkspaceHookTrust` 的 pending interaction 确认校验，未确认或不匹配抛出 `interaction-unconfirmed`。
2. **Client 交互卡片族与控制器 (`packages/client/conversation-view.jsx`)**:
   - `ConversationController`: 增加 `snoozeInteractionAutoResolution`, `respondWorkspaceHookReview`, `toggleWorkspaceHookReviewItem`, `revokeWorkspaceHookTrust`, `requestWorkspaceHookReview` 方法。
   - `buildElicitationContent(questions, drafts)`: 导出纯函数，精准遵循官方 elicitation answer 协议（多题单选/多选/freeText 格式化，对照 `ElicitationDialog.tsx:267-298`）。
   - `ZCodePendingInteractions`:
     - 软准入横幅：`workspaceHookAdmission` 触发 `requestWorkspaceHookReview`；当 admission 缺少 `workspaceIdentity` 时遵循 R16 禁用按钮并提供不可用说明，不进行 `state?.address` 死回退。
     - 多题问卷卡片：支持题目上下翻页、草稿不丢失、单选/复选/文本输入、首次交互自动触发 snooze 并核对 ACK 回执（若 rejected 则回滚 snoozed 显示并呈现官方告警语义）、接受/拒绝（带部分答案）/取消。
     - 计划审核卡片：显示 markdown 计划文本、快照计划条目状态清单、Goal 摘要与目标状态、Approve Plan（提交 approve）、Reject Plan（若输入反馈理由，按官方 GUI 等价通道提交 `accept + answer_0=feedback` 以触发官方 deny-with-reason 并保留反馈；无反馈时发送 `decline`）。
     - Hook 安全审核卡片：展示危险告警、工作区标识、Hook 计数、来源文件列表、条目启闭 toggle、单项/批量 trust、已信任项 revoke。
     - 官方结果回显：完整保留并回显官方 `status` 与 `reasonCode`（如 `proto.alreadyResolved` 来自 `command.ts:175` / `interaction-registry.ts:158`，`workspace_hooks_require_trust_capable_host` 来自 `workspaceHookReviewCommands.ts:115`，`workspace_hooks_snapshot_mismatch` 来自 `workspaceHookReviewCommands.ts:82` 等），不造假。倒计时过期由官方 `autoResolution` 状态机与 snapshot 权威同步，不编造非官方 RPC 错误码。
     - 未知交互 Fail-safe：渲染有界摘要，不崩不猜。
3. **测试夹具 (`tests/fixtures/s05/`)**:
   - `questionnaire.json`: 多题问卷（单选、多选、文本、草稿、autoResolution 倒计时）。
   - `plan-review.json`: 计划审批（ExitPlanMode、条目列表、Goal 状态）。
   - `hook-review.json`: Hook 安全审核与软准入横幅。
   - `expired-late-other.json`: 官方错误/幂等原因码（`proto.alreadyResolved`, `workspace_hooks_require_trust_capable_host`, `workspace_hooks_snapshot_mismatch`）。
   - `reconnect-recovery.json`: 断线重连与待处理交互恢复。
   - `unknown-interaction.json`: 未知交互类型容错。
   - 夹具生成脚本 `scripts/make-s05-fixtures.mjs`。
4. **自动化测试套件**:
   - `tests/s05-commands.test.mjs`: 5 个 Node 单元测试，验证命令交互防护、wire payload 构造、snooze 确认与拒绝流转、计划审核审批与带反馈驳回契约。
   - `tests/s05.dsh.spec.ts`: 14 个 DSH Vitest 集成测试，覆盖问卷答题、拒绝保留草稿、取消、计划通过、计划带反馈驳回、计划无反馈 decline、Hook 审核启闭/信任/撤销、官方原因回显 (alreadyResolved / hookHostUnsupported / hookMismatch)、自动倒计时过期状态机下线、snooze 拒绝回滚告警、缺工作区标识 R16 禁用、重连恢复、未知类型 Fail-safe 与 DSH `renderSessionArea` 挂载槽。

---

## 5. Checks 实跑矩阵

| Check 项 | 命令 | 结果 | 耗时 |
|---|---|---|---|
| Bridge 单元测试 (Node test runner) | `npm test` | **58/58 PASS** (新增 5 项，原 53 项无回退) | 1.1s |
| Bridge DSH 集成测试 (Vitest) | `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **50/50 PASS** (新增 s05 14 项，全 6 个套件 0 fail) | 5.7s |
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
