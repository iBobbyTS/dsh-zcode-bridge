# S03.B HANDOFF — 实时会话、基本 permission/ask-user 与停止 UI

## 1. 边界与身份

- **Feature**: `dsh-zcode-bridge`；**Section**: `S03.B`（S03.A 之上）；**Implementer**: `impl_std`（external agy / gemini-3.8-flash / high / yolo）。
- **执行模式**: EXECUTE_WITH_COMMIT；主写域为 bridge 仓（`feat/zcode-runtime-bridge`，基线 `a2af134`）；DSH 克隆（`/Users/ibobby/Projects/dsh-zcode-acp/dsh`，基线 `6df8848d1`，分支 `feat/zcode-runtime-bridge`）仅限挂载消费点有界编辑并单独提交。
- **现实边界**: 0 模型调用；不接触任何账号凭据；不碰官方 GUI 进程；遵守 session/close 禁令；受限态（auth gated）如实展示，绝不标为 available。
- **方向裁定**: DSH 侧以 Web UI 为呈现目标；真实浏览器 oracle 由主 agent 执行。

---

## 2. 交付实现清单

### bridge 仓 (`dsh-zcode-bridge`)

1. **`packages/host/conversation.mjs`**:
   - 为 `V4Conversation` 增加了标准外部 Store 订阅接口：`subscribe(listener)` 与私有 Set `#listeners`，兼容 `useSyncExternalStore`。

2. **`packages/client/conversation-view.jsx`**:
   - `ConversationController`：反应式控制器，封装 `V4Conversation`，提供 `subscribe`、`getSnapshot`、`connect()`、`resync()`、`stop()`、`resolveInteraction()` 及资源清理。
   - `ZCodeStatusBanner`：渲染状态徽标（`idle`/`connecting`/`live`/`resyncing`/`error`/`closed`）、专有元数据芯片（`Epoch`、`Seq`、`Rev`、`Profile`、`SubscriptionId`），以及官方受限提示（R08 专有节点，不压成文本）。
   - `ZCodeAlerts`：渲染序列缺口告警（`zcode-gap-alert`）、重新同步中告警（`zcode-resyncing-alert`）及确定性会话错误告警（`zcode-error-alert`），带显式「Reconnect」重连按钮。
   - `ZCodeControlBar`：停止执行控制栏（`zcode-control-bar`），严格绑定当前前台执行 `expectedForegroundExecutionId`；当无前台执行或运行时受限时，如实禁用并说明原因（B04 规范）。
   - `ZCodePendingInteractions`：
     - `permission` 交互卡：展示待审批工具名称、调用参数/原因、操作选项按钮（`allowOnce`、`allowAlways`、`deny` 等），以及官方决策原因。
     - `userInput` 交互卡：展示提示词、文本输入框、选项按钮与提交，支持等待用户输入状态。
     - 重复/过期响应处理：调用后展示官方返回的确定性状态（如 `proto.alreadyResolved` / `noop`），绝不虚标成功。
   - `ZCodeCommandLedger`：命令台账，明确区分 ACK/受理（`sent-unconfirmed` / `accepted-awaiting-terminal`）、执行中（`running` / `waiting`）与终态（`completed` / `failed` / `rejected` / `stale` / `noop`）。
   - `ZCodeRowsList`：会话行列表渲染：
     - `turnHeader`：轮次标识与工时元数据。
     - `userInput`：用户输入原始呈现。
     - `reasoning`：**专有独立思考块**（`zcode-reasoning-row`），包含耗时芯片与折叠/展开内容，**绝不与 assistantText 压平成普通文本**（R08 合规）。
     - `toolCall`：工具卡片，展示工具名、调用状态、输入参数、输出结果与错误信息。
     - `assistantText`：助手文本正文。
   - `ZCodeConversationView`：全功能主容器，组合所有子组件。

3. **`packages/client/sources.mjs`**:
   - 在 `RuntimeSessions.retain()` 中，为持有会话实例的 ZCode 引用附加 `renderSessionArea: () => React.createElement(ZCodeConversationView, { conversation })` 消费能力。

4. **`packages/client/client.jsx`**:
   - 导出 `ZCodeConversationView` 与 `ConversationController`。
   - `npm run build` 生成 `packages/client/lib/client.js` 与 `packages/client/lib/client-test.mjs` 产物。

5. **`tests/s03.dsh.spec.ts`**:
   - 新增 8 项针对 S03.B 的完整真实 DOM / jsdom 测试，全面覆盖各生命周期状态、独立思考块、命令台账、交互审批与重复响应、B04 停止语义、断线缺口与重连、DSH seam 挂载，以及**官方 headless 真实 draft 会话往返渲染（0 模型调用、restricted 校验）**。

### DSH 克隆 (`dsh`)

1. **`packages/api/session-controller/src/client/contract/source.ts`**:
   - `ZCodeSourceReference` 契约添加可选属性 `readonly renderSessionArea?: () => unknown;`（仅加法式契约扩展）。

2. **`packages/client/ui-session/src/client/session-provider.tsx`**:
   - 挂载点 seam 支持：在 `binding.key === undefined` 分支中，当 session 为 ZCode 引用且具备 `renderSessionArea` 时，直接渲染其返回的会话区域视图；若未提供则保持返回 empty fallback（完全保留 S02.B 的空态卸载回退行为）。

---

## 3. Fixtures 消费表

| Fixture 文件 | 消费场景与断言 | 真实性保证 |
|---|---|---|
| `tests/fixtures/s03a/success.json` | 1. 测试 1：驱动 `initial` 快照与芯片元数据渲染（Epoch/Seq/Rev/Profile）；<br>2. 测试 2：驱动 `online` delta 行追加（turnHeader、userInput、reasoning、toolCall、assistantText）；<br>3. 测试 3：提供 accepted 命令响应；<br>4. 测试 5：驱动 activeWorks 停止目标。 | 官方真实采集，无人工伪造。 |
| `tests/fixtures/s03a/gap.json` | 测试 6：驱动序列步进（`advance`）与序列空洞（`gap`，从 12 跳至 14），断言 `zcode-gap-alert` 与 `zcode-resyncing-alert`。 | 真实空 delta/snapshot 水位修改派生。 |
| `tests/fixtures/s03a/failure.json` | 测试 3：消费 `failureFixture.commands[0].result`，驱动被拒绝命令（`proto.invalidPayload`）在台账中的错误呈现。 | 官方真实 rejected ACK 采集。 |
| `tests/fixtures/s03a/lateframe.json` | 测试 6：注入过期订阅帧（`old-subscription`），断言 live 会话正确丢弃该帧而不被污染或异常触发 resync。 | 官方 online delta 故障注入派生。 |
| `tests/fixtures/s03a/official.json` | 测试 8：校验已验证安装的官方 runtime 校验和与 `officialFixture.provenance.sha256`（`fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`）完全一致。 | 官方原生运行时 capture。 |

---

## 4. Checks 实跑结果

| 检查项 | 命令 | 结果 | 耗时 |
|---|---|---|---|
| Bridge 单元测试 | `npm test` | **45/45 PASS** (0 fail, 0 skip) | 304ms |
| Bridge DSH 规范单测 | `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **22/22 PASS** (s01: 6, s02: 8, s03: 8) | 6.31s |
| DSH 原生 vitest 回归 | `pnpm_config_verify_deps_before_run=false pnpm vitest run packages/api/session-controller/tests packages/client/ui-session/tests` | **952/952 PASS** (45 文件，0 fail) | 7.08s |
| DSH 类型检查 | `pnpm_config_verify_deps_before_run=false pnpm typecheck:contracts-ready` | **PASS** (0 errors) | 2.5s |
| DSH oxlint 代码门禁 | `./node_modules/.bin/oxlint <modified-files>` | **0 warnings, 0 errors** | 1.5s |
| Bridge oxlint 代码门禁 | `../dsh/node_modules/.bin/oxlint <modified-files>` | **0 warnings, 0 errors** | 29ms |
| DSH 文档门禁 | `pnpm_config_verify_deps_before_run=false pnpm test:docs` | **21/21 PASS** (0 failed) | 52.78s |
| Bridge 源码构建 | `npm run build` | **PASS** (生成 client.js / client-test.mjs) | 120ms |
| 两仓 git diff 空白检查 | `git diff --check` | **PASS** (无任何空白/换行隐患) | — |

---

## 5. Web UI 启动与挂载步骤（主 Agent 浏览器 Oracle 使用）

本实现已为 Web UI 端到端渲染做好全面就绪准备。主 Agent 执行真实浏览器 Oracle 验收时，请按如下步骤启动：

1. **构建 Bridge 客户端产物**:
   ```bash
   cd /Users/ibobby/Projects/dsh-zcode-acp/dsh-zcode-bridge
   npm run build
   ```
   产物位于 `packages/client/lib/client.js`。

2. **在 DSH Web 环境挂载与启动**:
   ```bash
   cd /Users/ibobby/Projects/dsh-zcode-acp/dsh
   # 启动 DSH Web 前端开发服务器（根据 DSH 现行规范关闭依赖自动校验）
   pnpm_config_verify_deps_before_run=false pnpm dev:web
   ```
   Web 服务默认启动在本地端口（如 `http://localhost:3000` 或控制台提示地址）。

3. **浏览器 Oracle 验证检查点**:
   - 打开浏览器访问对应地址，进入会话视图。
   - 当会话引用选中 ZCode 会话（`dsh-source:zcode:*`）且持有 `V4Conversation` 时，`SessionProvider` 会自动分发渲染 `ZCodeConversationView`。
   - **检查点 1（状态栏与元数据芯片）**：确认顶部状态卡包含 `[data-testid="zcode-status-badge"]`、`[data-testid="zcode-epoch"]`、`[data-testid="zcode-seq"]` 等芯片，且包含 `Runtime: restricted (official auth-gated)` 警示。
   - **检查点 2（独立思考块）**：在有多轮交互或回放时，确认模型思考渲染在 `[data-testid="zcode-reasoning-row"]` 独立卡片中，带有持续时间芯片，并未被压平成普通助手文本。
   - **检查点 3（控制栏与停止动作）**：确认 `[data-testid="zcode-stop-button"]` 存在；受限或空闲时显示明确禁用说明；存在前台执行时仅定位当前 `expectedForegroundExecutionId`。
   - **检查点 4（审批与询问）**：在有 pending 交互时确认 `zcode-permission-card` / `zcode-user-input-card` 正常交互，重复提交得到规范 noop 回显。

---

## 6. NOT_RUN 说明

- **真实付费模型调用**: NOT_RUN。依据项目红线与 S03.B 现实边界，绝不触发模型输入或消耗额度。
- **官方 GUI 进程端到端**: NOT_RUN。受限态（auth-gated）不伪造可用性，所有协议交互走官方无模型 draft 子进程验证。
- **真实浏览器界面交互**: 由本任务规范交接给主 Agent 执行验证，本 worker 提供就绪代码与步骤。

---

## 7. 自评与提交组织

本节交付物已完整满足 TASK-S03.B 全部 6 项交付标准、红线约束与回归底线。
两仓提交组织如下：
- **DSH 仓**: `feat(client/ui-session): mount ZCode session area renderer through SessionProvider seam (S03.B)`
- **Bridge 仓**:
  - `feat(client): implement ZCodeConversationView, pending controls, and stop UI`
  - `test(client): add S03.B DSH integration and official runtime checks`
  - `docs(handoff): record S03.B implementation, checks, and webui steps`
