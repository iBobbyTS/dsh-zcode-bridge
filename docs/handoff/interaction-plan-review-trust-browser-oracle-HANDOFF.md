# interaction-plan-review-trust HANDOFF — DSH web GUI 真实浏览器 oracle

> 首行说明：`.agent-work/tasks/interaction-plan-review-trust-TASK.md` **不存在**；本节按派发提示 + PLAN-PHASE2 `## interaction-plan-review-trust` + 排除项全权执行。

## 边界与身份

- Feature dsh-zcode-bridge；Section interaction-plan-review-trust（PLAN-PHASE2 `## interaction-plan-review-trust`）；实现者 native `@impl_std`；模式 EXECUTE_WITH_COMMIT，不 push。
- 主写域 bridge `feat/zcode-runtime-bridge`，基线 `de0f556`；**DSH 仓 `21fb059745…` 零改动**。reference/官方 App 只读。
- 本节交付**纯 oracle 证据 + 一份真实浏览器层**，无产品代码改动（`npm run build` 产物与已提交内容逐字节一致，`git diff` 为空）。
- 浏览器工具说明：本会话没有可调用的 chrome-devtools / browser-use MCP 工具命名空间；改用**同一** Chrome DevTools MCP 的 CLI 二进制（`chrome-devtools-mcp@1.7.0`，本地安装于 scratch，不写全局）驱动已安装的 Google Chrome（headless），仍是真实 Chrome/真实 DOM/真实截图，不是 jsdom。

## 环境与隔离

- 隔离布局 `.agent-work/tmp/interaction-plan-review-trust/`：`home`（HOME）、`home/.dsh`（DSH_HOME）、`workspace`、`shots/`、`logs/`。
- DSH 来自本仓 `node apps/cli/lib/bin.js web --no-open --port 3091`（0.2.0-rc.2-21fb059）；bridge 双插件经 `dsh plugin --profile web add file:<bridge> file:<bridge>/packages/host file:<bridge>/packages/client` 装入隔离 web profile。
- 认证走启动打印的 process-token URL；Chrome 导航到该 URL。**未登录、未输入 API Key（“稍后配置”）、未读凭据**。
- 未触碰真实 `~/.zcode`、真实 DSH profile、真实 Keychain；官方 GUI 进程仅观察、从未发信号。

## Oracle 清单逐项判定

| # | oracle 项 | R | 判定 | 真实操作 / 证据 |
|---|---|---|---|---|
| 1 | 状态卡：连接状态/安装身份/restricted 文案 | R05/R08/R22 | **PASS** | 隔离 profile 点击 “Connect official runtime”；`Restricted: protocol connected; official request authentication unavailable`、`Account: Official authentication source unavailable`、安装 3.14.4/3.14.4.7912、Electron 41.0.3·Node 24.14.0·arm64、cjs SHA-256、`session/list` 往返、按钮 disabled。截图 `03-status-card-restricted-connected.png` |
| 2 | 版本 banner（新版本警告 + 三种 dismiss + 关闭不解除 fail-safe） | R19/R20 | **PASS** | 假 App（Info.plist 3.15.0/3.15.0.9999，Frameworks/Resources 只读 symlink 到真实 App）→ 真连接 → banner “official ZCode 3.15.0 is newer than the highest verified version 3.14.4.” 真按钮点击：`once` 立即隐藏且不落盘（reload 后重现）；`this-version` 落盘 `{"v":1,"thisVersion":["3.15.0"],...}` 且 reload 后保持隐藏；`new-next-version` 落盘 `newNextVersion:[{"from":"3.15.0","skipped":null}]`；banner 与分级 fail-safe 同时可见时关闭 banner，fail-safe 提示保持。截图 `04/06/07/08/09` |
| 3 | 错误域呈现（注入可解释失败→UI 显示原因） | R22 | **PASS** | (a) stub runtime 写非法 NDJSON → 状态 “Official protocol frame was invalid”；(b) appPath 指向不存在路径 → “Official ZCode installation was not found”；初始页显示 `官方操作失败: host-unreachable`。截图 `10-error-domain-installation-missing.png` |
| 4 | fail-safe 分级可见性（core/非核心） | R20/R22 | **PASS** | 非核心：杀死自有官方 runtime 子进程后经 UI 触发 ZCode source 读 → `Optional capabilities isolated: session-source. Other paths keep working.`；核心：stub runtime 非法帧 `protocol-invalid` → `Core protocol incompatibility: new side effects are stopped; reconnect to retry.`；fresh connect 会 reset（实测）。截图 `06/08` |
| 5 | 双 runtime 会话面：native/ZCode 身份区分 + logo 可访问名 + ZCode 入口未就绪 | R05/R07 | **PASS** | a11y snapshot：native `DeepSeek Harness（原生）` pressed=true；ZCode 条目 aria-pressed=false、`受限未就绪`；logo `span role=img aria-label="ZCode"`；侧栏 `region "ZCode 会话"` 含共享会话未验证 / bridge 自有 store / 模型执行受限文案。截图 `02/05` |
| 6 | ZCode 会话区（R07：DSH-only 功能在 ZCode Session 隐藏/禁用）真实渲染 | R07 | **NOT_RUN** | scratch 工作区 0 个官方会话，受限 Host 从不创建会话，无法在真实浏览器打开 ZCode ConversationView。既有 live-session-permission-stop/installable-bundle jsdom 覆盖保留，**不**重述为 GUI 证据。 |

截图归档：`/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/interaction-plan-review-trust/shots/`（派发允许的非敏感路径；无凭据，仅隔离 scratch 路径）。机器可读汇总：`docs/probes/checks/interaction-plan-review-trust/oracle.json`。

## Checks 实跑

| 检查 | 结果 | 证据 |
|---|---|---|
| bridge Node | **260/260 PASS**（baseline 260 无回退） | [`node.log`](../probes/checks/interaction-plan-review-trust/node.log) |
| bridge build | **PASS** | [`build.log`](../probes/checks/interaction-plan-review-trust/build.log) |
| DSH 集成（jsdom） | **173/173 PASS**（baseline 173 无回退） | [`integration.log`](../probes/checks/interaction-plan-review-trust/integration.log) |
| DSH native | **1373/1373 PASS**，60 文件（baseline 1373 无回退，CSR 含 ui-workspace） | [`native.log`](../probes/checks/interaction-plan-review-trust/native.log) |
| 真实浏览器 oracle | 见上表 5 PASS / 1 NOT_RUN | `oracle.json` + 截图 |

命令：`npm test`；`npm run build`；`node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs`；`cd ../dsh && node node_modules/vitest/vitest.mjs run packages/api/session-controller/tests packages/client/ui-session/tests packages/client/ui-workspace/tests`。

## 红线

- **0 模型请求**：全程仅 bridge `status`/`connect` 与官方 `runtime/capabilities`、`session/list`；从未发送 prompt/sendText/turn，web UI 未获得任何模型消息。**这是“构造性 0”而非请求层强制观测**（session-create provider gate `installed=false`），如实标注。
- 仅隔离 profile；不碰真实用户 DSH 环境 / `~/.zcode` / Keychain / 官方 GUI 进程（仅观察）。
- 不读凭据；不执行登录；`session/close`/`closeSession` 从未发出。
- jsdom 既有测试保留；本节新增真实浏览器层，未用 jsdom 充当 GUI 证据。
- 清理：web server 已停、chrome-devtools daemon 已停、无残留 interaction-plan-review-trust 进程。

## 发现（记录未修）

- **FINDING-interaction-plan-review-trust-1（low，owner=bridge client `packages/client/sources.mjs`）**：官方 runtime 连接成功后，ZCode 运行入口的可用性原因保持旧值 `宿主不可达`，直到用户点目录面板 “刷新” 才更正为 `ZCode 执行来源未就绪`。证据：连接前后 aria-description 变化 + 截图 02/05 + 侧栏 `官方操作失败: host-unreachable`。
  - 未在本节修复：正确修复需要“Host 连接事件驱动的 source 刷新”seam（DSH connection generation 在 bridge Host 连接官方 runtime 时不变）；在 oracle 收口处引入无独立评审的跨组件改动会超出有界范围。建议作为独立 bounded follow-up（配 jsdom 回归）。
  - DSH 消费点无独立缺陷需报告（DSH 产品代码零改动）。

## NOT_RUN

- 真实 ZCode 会话区 GUI 渲染（R07 的会话内呈现）：无官方会话可打开（见上表 #6）。
- R19 `new-next-version` 的“更高版本重新提醒”链条：仅验证到 skip 落盘，未构造第三个更高版本假 App 复测重新提醒。
- 请求层 0 模型调用强制证明：依赖 session-create gate（`enforceable=false`），本节未提供请求层计数。
- 共享官方 GUI 会话、auth 登录、真实模型执行：不在本节范围。

## 自评与提交

自评 **COMPLETE（oracle 范围内）**：5/6 oracle 项在真实隔离 web UI + 真实 Chrome 上 PASS，1 项如实 NOT_RUN；回归 260/173/1373 无回退；红线条条保持；一份低危 bridge client UI 发现如实记录未修。本节不宣称独立 review CLEAN 或 main admission；无产品代码改动，提交为 docs/evidence-only。最终 HEAD 以 `git log` 为准。
