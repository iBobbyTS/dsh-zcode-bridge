# ZCode driver skeleton contract

核验日期：2026-10-06。实现基线：`cc4fbc720ec8705918ed4ab5aaef85728067d2e9`。
本节只占用 factory、建立空会话和持久化身份绑定；输入、事件翻译、历史修复、目录导入与模型适配属于后续任务。

## 契约 probe

证据根：

- `DSH=/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/dsh-official`，源码包版本 `0.2.1-alpha.1`。
- `NPM=/private/tmp/dsh-local-npm-verify/npm/node_modules/@deepseek-ai`，npm 实物版本 `0.2.0-rc.2`（只读）。

实际执行（exit 0）：

```sh
node packages/driver/contract-probe.mjs \
  /private/tmp/dsh-local-npm-verify/npm/node_modules \
  /Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/dsh-official
```

probe 去掉注释/空白/分号后逐项比较接口体、事件清单和 header 闭集，并导入 npm 的真实 `agentEvents`，核验三个派发方法的载体和 subject 注入。结果：**逐项一致**，未发现动摇本任务前提的契约差异。版本号有差异，driver 的 DSH peer 精确钉为 npm 实测的 `0.2.0-rc.2`；Cordis 沿官方 npm peer 风格钉为 `~4.0.4`。driver 必需的接口 peer 不标 optional。

| 项目 | 源码证据 | npm 实物证据 | 结果 |
|---|---|---|---|
| `AgentFactory.createAgent(ownerCtx, options)` / `resume(ownerCtx, options)` | `$DSH/packages/core/agent/src/index.ts:171` | `$NPM/dsh-agent/lib/types/index.d.ts:153` | 一致 |
| `AgentHandle { agent, dispose(): Promise<void> }` | 同文件 `:160` | 同文件 `:143` | 一致 |
| 调用方 `sessionId`、`resumeSessionId`、setup/commit、signal、owner | 同文件 `:63/:125` | 同文件 `:48/:109` | 一致 |
| `agent/*` 事件词汇 | `$DSH/packages/core/agent/src/runtime-types.ts:245` | `$NPM/dsh-agent/lib/types/runtime-types.d.ts:241` | 一致，见下方清单 |
| `AgentEventDispatch` 与融合 subject/carrier | `$DSH/packages/core/agent/src/dispatch.ts:55/:107` | `$NPM/dsh-agent/lib/types/dispatch.d.ts:44/:93`，`lib/index.js:242` | 一致；npm 三方法实际派发通过 |
| `SessionHeader` | `$DSH/packages/core/session/src/types.ts:94` | `$NPM/dsh-session/lib/types/types.d.ts:58` | 一致 |
| V4 header 闭集 | `$DSH/packages/session/session-format-v3-to-v4/src/validation.ts:19` | `$NPM/dsh-session-format-v3-to-v4/lib/index.js:946` | 一致 |
| `SessionEvent.ignorable?: true` | `$DSH/packages/core/session/src/types.ts:511` | `$NPM/dsh-session/lib/types/types.d.ts:507` | 一致 |

事件清单（12）：`agent/created`、`agent/disposed`、`agent/status`、`agent/inbox/inserted`、`agent/inbox/claimed`、`agent/inbox/discarded`、`agent/pre-step`、`agent/request`、`agent/request-error`、`agent/assistant-stream`、`agent/turn-stopping`、`agent/error`。

Header 必需字段：`version/id/createdAt/isSeeded/delegationDepth`；可选字段：`cwd/parentSession/origin/agentPreset`。没有外部会话 ID 扩展字段。

npm `dsh-agent` 实际运行时导出：`AgentRegistry/default`、`agentCarrier`、`agentEvents`、`assembleContextFor`、`emitAgentEvent`、`foldConsumedWork`、`installModelSelection`；`AgentFactory` 和 `AgentHandle` 是类型接口，没有运行时构造器。driver 通过工厂对象实现接口，调用官方 `createScope` 和 `agentEvents`。

## 实现约束与身份

- `agents.setFactory()` 是第一项注册动作；准确的单例冲突消息被捕获后返回 `blocked-official-loop-active`。其它错误保留失败语义。blocked 时不注册投影、不连接 ZCode、不替换官方 factory。
- occupied 后才注册标准 `turnBoundary@2` 和 `inbox@1` 的纯 fold。官方时序证据：`$DSH/packages/core/agent/src/index.ts:358`、`agent-loop/src/index.ts:364`、`packages/session/session-projection/src/index.ts:273`。
- host 通过 Cordis `zcodeBridgeHost` 服务共享已有 `BridgeHost` 和 launcher。driver 的 `LauncherPeer` 只拥有协议监听器，不销毁 host、不新增进程或认证路径。空 `createSession` 不带 `firstInput`，不会启动模型轮次（`packages/host/vendor/zcode/v4.mjs:8555`）。
- 新建：先验证/prepare 官方调用方 ID，再获取 ZCode draft ACK；在尚未公布的 log seed 中加入 `zcode-driver/conversation-bound` 事件，持久化后按 `sessions.enter → agents.enter → sessions.announce → await agents.announce` 公布。header 中没有绑定字段。
- 绑定示例：`{type:'zcode-driver/conversation-bound', seq:0, time:<epoch>, ignorable:true, data:{sessionId:'DSH-X', zcodeConversationId:'zcode-conv-Y'}}`。
- `Session.append()` 没有 `ignorable` 写入参数（源码 `packages/core/session/src/index.ts:718`，npm `dsh-session/lib/types/index.d.ts:246`）；不能传第三参数假装落盘。实现重新 prepare 未公布的 seed，保持官方 ID/header，并把完整 envelope 经写句柄 append。未公布 setup 追加的事件同批持久化。
- 恢复：`persistence.open(id,'write') → read(0)`；有绑定用 ZCode id，无绑定使用 SessionId 本身（导入身份路径）。无效/相互矛盾绑定拒绝。interrupted-turn repair 本节未实现。
- setup、commit、announce 失败时关闭写句柄、移除两 registry 条目、释放 scope。已经交付给监听器的创建通知无法撤回，按官方 registry 语义配对 disposed；本节不宣称撤回通知。ZCode 已确认但 DSH 创建失败的空 draft 不执行远端删除补偿。
- Agent 基线 idle，inbox 空；无活跃活动 cancel 是 no-op；maintenance 支持取消与 whenIdle 等待。输入方法显式报 `driver-command-unavailable`。带历史的 create 显式拒绝，避免以空 draft 假装继承历史。
- teardown memoized：停驱/等待 maintenance → 关闭写句柄 → agent 反注册 → session 分离 → scope 释放；caller signal 返回前解除。owner/provider 在 setup/load 阶段退出会取消，晚到的写句柄也会关闭。Cordis composite effect 将 factory 清除放在 live handle drain 之后。
- status 扩展：`value.driverState = {state, reason}`，state 为 `blocked-official-loop-active` / `occupied` / `unavailable` / `disposed`。互锁说明在 reason；UI 提示不属本节。

## 验收结果

1. 契约 probe：exit 0，逐项一致。
2. `node --test tests/zcode-driver-factory.test.mjs`：12/12，通过双占用时序、身份 create→显式拒绝 prompt→resume、导入无绑定 fallback、idle/maintenance、setup/commit/announce 回滚、晚到句柄关闭、owner/provider 卸载、host status、bundle 行与空 draft launcher 通道。
3. 隔离 npm web profile 实测：两次 HTTP 200、`ok=true`、`pluginErrors=[]`、launcher `ready`、auth `authenticated`。官方 loop 启用：`driverState.state=blocked-official-loop-active`；隔离 profile 手动追加 `{id:'agent-loop',disabled:true}` 后：`occupied`。交付 patch 不含官方 disabled 行。
4. `npm test`：465/465 通过（基线 453 + 新增 12）；`npm run build`：exit 0。构建命令仍只处理现有 client；driver 是直接可导入的 ESM，新包尚未接入根 build/发布文件图，见下方边界缺口。
5. 新增 `index.mjs` 和 `factory.mjs` 的 Node ESM 动态 import：exit 0。未运行依赖外部 `../dsh` 的 vitest/`.dsh.spec.ts`，不将其报为通过。

额外实物验证：直接使用 npm Cordis/AgentRegistry/SessionStore/SessionProjectionRegistry 与 npm JSONL persistence 创建 `DSH-X`；落盘读回 binding 保留 `ignorable:true`；恢复目标为 `zcode-conv-Y`；最终两个 live registry 都返回 undefined。ZCode transport 为最小桩，不宣称已验证真实 prompt。

## 隔离环境附录与剩余边界

首先实际执行现有脚本：

```sh
node scripts/start-npm-acceptance.mjs --prepare-only --diagnose-version-seams --port 3214
```

新 npm 安装失败：`npm-install` exit 1，`ETIMEDOUT`；记录在 `/var/folders/93/2s7hmqvj0t13nr6xmnkcbthc0000gn/T/dsh-closure-acceptance-npm-lzrsmi/npm-install.log`。没有修改脚本。

后续隔离实测使用 `/private/tmp/zcode-driver-isolated`：将只读 npm rc.2 实物和 web profile 复制到该新目录，只复制 profile 配置/包而不复制原会话存储；更新副本 host 入口、bundle patch，加入 driver 包和 profile dependency。沿用脚本的 launcher 配置，把 scratchRoot 改为 `/private/tmp/dshw/d1`，为两次启动分配 `blocked` / `occupied` runId。只有副本 profile 写官方 disable。启动官方 `dsh web --no-open --port 3214`，从该子进程生成的本地凭据请求 status，随后终止这两个自有 web 子进程。

实际结果：`/private/tmp/zcode-driver-isolated/results.json`；执行器：同目录 `probe.mjs`。blocked PID 29601；occupied PID 29873，均已停止。host 沿用副本 profile 已有的精确 rc.2 compatibility exemption；driver 自身 rc.2 peer 无需 exemption。这证明 npm 实物的加载互锁，不能当作新 registry 安装成功或 host alpha peer 已兼容的证明。

剩余约束：

- 授权写入路径不含根 `package.json`、lockfile、`scripts/build.mjs` 和正式安装脚本。根 dependencies/files 还没有 driver，build 图也没有 driver 检查；本节只能通过 bundle 行、独立 file 包安装和直接 import 验证。需要父级在拥有这些路径的任务中收口，不能把现有 build exit 0 等同“driver 已进入根图”。
- 外部 vitest 环境不可用；本节用导入解析检查替代，没有运行浏览器人工验收或真实模型 prompt。
- 官方插件行只在隔离 profile 手动禁用。blocked 不会热切换到 occupied，需要重载 driver/profile。
