# 优雅关停与 Checkpoint Flush 核验报告

## 1. 概述与结论

- **核验目标**：验证在宿主（DSH Web Server）收到停机信号（`SIGTERM` / `SIGINT`）时，桥接层触发的优雅停机阶梯（`stdin EOF` 1500ms → `SIGTERM` 1000ms → `SIGKILL` 1000ms）是否给官方 `app-server` 预留了足够的时间完成会话 Checkpoint 及事件持久化落盘。
- **核验结论**：**充足**（维持现状，无需调整 `packages/host/runtime.mjs` 参数）。

---

## 2. DSH 信号 → Pool 生命周期完整调用链与源码锚点

在 DeepSeek Harness 环境中，Web Server 停机信号驱动官方进程回收的完整调用链路如下：

1. **信号捕获（DSH CLI Profile Boot）**
   - 源码锚点：`reference/deepseek-harness/apps/cli/src/profile-boot.ts:280-281`
     - `process.on('SIGTERM', () => { interrupt(0) })`
     - `process.on('SIGINT', () => { interrupt(130) })`
   - 源码锚点：`reference/deepseek-harness/apps/cli/src/profile-boot.ts:269`
     - `const shutdown = createProcessShutdown(dispose)`
   - 源码锚点：`reference/deepseek-harness/apps/cli/src/profile-boot.ts:256-263`
     - `dispose()` 闭包触发 `await app.current?.fiber.dispose()`。

2. **有界停机控制器（Process Shutdown Controller）**
   - 源码锚点：`reference/deepseek-harness/apps/cli/src/process-shutdown.ts:4`
     - `export const PROCESS_SHUTDOWN_TIMEOUT_MS = 5_000`（DSH 宿主提供 5.0 秒全局优雅回收硬上限）。
   - 源码锚点：`reference/deepseek-harness/apps/cli/src/process-shutdown.ts:52-63, 69-76`
     - 首次收到 `SIGTERM`/`SIGINT` 调用 `interrupt(code)`，触发 `start(code, true)`，设定 5000ms 兜底定时器并执行 `Promise.resolve().then(dispose)`。

3. **Cordis 插件树注销与 Fiber Effect 析构**
   - 源码锚点：`reference/deepseek-harness/vendor/cordis/src/fiber.ts:265-296`
     - `this.dispose` 驱动当前 Fiber 状态转为 `UNLOADING` 并执行 `this._unload()`。
   - 源码锚点：`reference/deepseek-harness/vendor/cordis/src/fiber.ts:675-686`
     - `_unload()` 遍历 `this._disposables` 并通过 `runDisposable(dispose)` 执行注册的销毁回调。

4. **桥接插件资源释放（DSH ZCode ACP Plugin apply）**
   - 源码锚点：`packages/host/index.mjs:75, 78`
     - `const host = new BridgeHost({ ... });`
     - `ctx.effect(() => () => host.dispose(), 'zcode-bridge: owned runtime');`
     - Cordis Fiber 卸载时，自动触发该 Disposer，调用 `host.dispose()`。

5. **BridgeHost 释放**
   - 源码锚点：`packages/host/runtime.mjs:317-322`
     - `BridgeHost.dispose()` 执行 `await this.pool?.dispose();`（以及非池化单例降级路径下的 `await this.#stop?.();`）。

6. **AppServerPool 优雅关停**
   - 源码锚点：`packages/host/app-server-pool.mjs:197-208`
     - `AppServerPool.dispose()` 遍历活跃条目并调用 `this.#stop(entry)`，随后等待 `await Promise.allSettled([...this.#stops]);`。
   - 源码锚点：`packages/host/app-server-pool.mjs:178-179`
     - `#stop(entry)` 内部注册并执行：`Promise.resolve().then(() => stopOwned(child, exited))`。

7. **优雅阶梯停机执行（stopOwned）**
   - 源码锚点：`packages/host/runtime.mjs:325-331`
     - 执行 `child.stdin.end()` → 等待 1500ms → 若未退出执行 `child.kill('SIGTERM')` → 等待 1000ms → 若未退出执行 `child.kill('SIGKILL')`。

---

## 3. 官方 App-Server 在 stdin EOF 后的行为核验

官方 `app-server` 进程（由 `zcode-cli app-server --stdio` 启动）接收到 `stdin EOF` 后的具体流程如下：

1. **入口分发与 Transport 挂载**
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/cli/src/run.ts:538-545, 268-277`
     - `app-server` 命中 `runZCodeProtocolCommand`，调用 `runProtocolAgent({ input: ctx.stdin, output: ctx.stdout, ... })`。
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/bootstrap/src/zcode-protocol-entrypoint.ts:310-319, 334, 346`
     - 创建 `connection = new ZCodeProtocolNdjsonConnection({ input, output, ... })` 并执行 `connection.start()`。
     - 入口挂起于 `await connection.waitForClose()`。

2. **stdin EOF 捕获与 Drain**
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/bootstrap/src/zcode-protocol/transport.ts:22`
     - `const PROTOCOL_EOF_DRAIN_MS = 100;`
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/bootstrap/src/zcode-protocol/transport.ts:62-63, 97-112, 130-136`
     - `input.once('end', this.onClose)` / `input.once('close', this.onClose)`。
     - 进入 `onClose`：标记 `draining = true`，调用 `this.notifyTransportClosed(...)`（触发 `server.disconnectClient(...)` 取消 pending 客户端请求）。
     - 启动定时器：`this.drainTimer = setTimeout(() => this.finish(), PROTOCOL_EOF_DRAIN_MS)`（100ms 窗口）。
     - 待在飞消息执行完成（或 100ms 超时）后，调用 `finish()`，触发 `this.resolveClosed()`，解除 `connection.waitForClose()`。

3. **运行时有界资源清理阶梯（cleanupProtocolRuntime）**
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/bootstrap/src/zcode-protocol-entrypoint.ts:356-369`
     - `connection.waitForClose()` 结束后进入 `finally` 块，执行 `await cleanupProtocolRuntime(...)`。
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/bootstrap/src/zcode-protocol/runtime-cleanup.ts:10-11, 25, 30-38, 49-67`
     - `DEFAULT_CLEANUP_BUDGET_MS = 1_200;`（总清理硬预算 1200ms）。
     - `CLEANUP_STEP_BUDGET_MS = 400;`（单个步骤超时 400ms）。
     - 清理步骤依序推进：
       - Step 1: `sampler` / `mcp_telemetry` 停用。
       - Step 2: `sessions` -> `options.server?.shutdown()`（中止活跃执行会话并关闭 App）。
       - Step 3: `projections` -> `options.server?.disposeProjections()`。
       - Step 4: `mcp` / `mcp_pool` 释放。
       - Step 5: `session_store` -> `closeSessionStore(options.sessionStore)`（关闭 SQLite 数据库连接）。
     - 随后进程自然退出（exit 0）。

4. **Checkpoint 与事件持久化机制（运行时即时同步写）**
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/core/src/runtime/methods/events.ts:263-273`
     - 当发生 `SessionEventType.CheckpointCreated` 事件时，即刻调用 `await persistWorkspaceCheckpointEntry(this, event, traceContext)`。
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/core/src/runtime/methods/workspace-checkpoint-persistence.ts:28-51`
     - 立即调用 `await runtime.sessionStore.saveSessionEntry(...)` 写入类型为 `runtime/workspace_checkpoint` 的条目。
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/adapters/src/storage/session-store/sqlite-session-store.ts:2, 233, 296-298`
     - 使用 Node.js 内置同步 SQLite 驱动：`import { DatabaseSync } from "node:sqlite"`。
   - 源码锚点：`reference/ZCode/apps/zcode-cli/packages/adapters/src/storage/session-store/repositories/session-entries.ts:24-48`
     - 执行 `db.prepare(...).run(...)` —— **同步完成数据写盘**。
   - **机制结论**：官方会话 Checkpoint 与事件记录是在产生事件的瞬间立即通过同步 SQLite 操作落盘的，绝非在进程关闭阶段集中异步刷盘。退出清理阶段的 `closeSessionStore()` 仅需同步关闭文件句柄（耗时 < 1ms）。

---

## 4. 量化对比与时间界分析

| 阶段 / 行为 | 官方源码时间界 | 桥接阶梯设计 (`runtime.mjs`) | 余量评估 |
| :--- | :--- | :--- | :--- |
| **stdin EOF Drain** | 最多 100ms (`PROTOCOL_EOF_DRAIN_MS`) | 1500ms 第一阶段等待 | 充裕（余量 1400ms） |
| **Runtime 资源清理** | 硬上限 1200ms (`DEFAULT_CLEANUP_BUDGET_MS`)，单步上限 400ms | 1500ms（覆盖 EOF+清理） | 充裕（1500ms > 100ms + 1200ms = 1300ms） |
| **极端卡死后 SIGTERM** | 无信号拦截（操作系统默认终止进程） | 1000ms 第二阶段等待 | 充裕 |
| **总优雅窗口（至 SIGKILL 前）** | 极端最大 1300ms（正常情况下 50~150ms 退出） | 2500ms（1500ms + 1000ms） | 充裕（近两倍于官方硬上限） |
| **宿主级 Supervisor 窗口** | DSH `PROCESS_SHUTDOWN_TIMEOUT_MS` = 5000ms | 桥接最晚 2500ms 退出 | 充裕（远在 5.0s 限制内，不会被提前 SIGKILL） |

### 旁证验证
在此前针对进程非正常死亡的五轮实机恢复测试中（测试直接使用 `kill -9` 强行杀死正在运行的官方 `app-server`），官方 Checkpoint 均已完整存在于 SQLite 数据库中，未丢失历史、亦未触发不当重放。这一实机事实与上述源码核验结果完全吻合，印证了 Checkpoint 生成即落盘的同步特征。

---

## 5. 建议与动作

- **建议**：维持现状，无需改动 `packages/host/runtime.mjs` 中的 `stopOwned` 时间参数。
- **改动面**：仅新增本文档作为工程依据，不改动任何产品代码与测试代码。
