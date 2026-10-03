# S01 — 有界探测记录

时间：2026-10-02 America/Edmonton（部分日志 UTC 为 2026-10-03）。执行仓库 bridge@7bbfce8 起、DSH@da00f7f；分支均 feat/zcode-runtime-bridge。ZCode 源码 29628c9 / 3.14.3；实际 App 3.14.4。任务权威为 S01-TASK.md / PLAN-FULL S01。付费模型调用 **0**。下列 STATIC、LIVE、NOT_RUN 分开记账，未将协议可连当作账号已登录。

## A1 安装与真实执行身份

- `sw_vers; uname -m`：macOS 26.6.2 / 25G83 / arm64。
- `/usr/libexec/PlistBuddy -c Print:CFBundleIdentifier -c Print:CFBundleShortVersionString -c Print:CFBundleVersion -c Print:CFBundleExecutable /Applications/ZCode.app/Contents/Info.plist`：dev.zcode.app / 3.14.4 / 3.14.4.7912 / ZCode。
- `shasum -a 256 .../Contents/Resources/glm/zcode.cjs`：fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f。`stat -f %z` 实测 14,820,968B，与已验证静态样本一致。
- `mdfind 'kMDItemCFBundleIdentifier == "dev.zcode.app"'`：仅 /Applications/ZCode.app。最早使用错误 identifier ai.zcode.desktop 的查询为空，已纠正；不把空查询当作单安装证据。
- Helper：Contents/Frameworks/ZCode Helper.app/Contents/MacOS/ZCode Helper。`ELECTRON_RUN_AS_NODE=1 <helper> -e <metadata>` 真实回显同一 execPath、Electron 41.0.3、Node 24.14.0、arm64。官方进程管理源码 zcodeAgentProcessManager.ts:410–434 使用同一 packaged Electron Node 启动形式。
- 受控 app-server 运行时 `lsof -a -p <owned pid> -d txt -Fn` 确认实际打开的 executable 与 Electron framework 均位于上述官方 App。完整非敏感证据：[official-roundtrip.log](checks/official-roundtrip.log)。退出码 0。
- 官方 provider 配置存在于 Contents/Resources/config/provider/zcode-builtin.json；CLI 默认相对定位在 glm/provider，直接启动会失败。必须走正式 `ZCODE_BUILTIN_PROVIDER_CONFIG_FILE` 指定官方 bundled 配置（provider-runtime-env.ts:58–63；desktopProviderConfig.ts）。不是复制配置或 API-key 替代。
- native 资源存在性：Resources/tools/ripgrep/rg、Resources/cua-helper/ZCode Computer Use.app 以及 app.asar.unpacked 下 node-pty helper。CUA/PTY 实际功能 NOT_RUN，属后续边界；核心 Electron helper 缺失已有独立错误原因与真实文件系统 fixture。
- framing：stdout 为 legacy NDJSON `{id,method,params}`、response `{id,result}` / `{id,error}`、notification `{method,params}`；不添加 jsonrpc。startup/storageState 为通知。stderr 独立，仅统计字节，不保存 raw diagnostics。成功路径 stderr=0B。依据 CLI protocol-console.ts、bootstrap zcode-protocol/transport.ts。

首次 helper `--version` 探测漏设 ELECTRON_RUN_AS_NODE，**新建探测进程**进入 Electron 初始化后报 Unable to find helper app 并自行退出（pid 46436）；它不是通过的 headless 证据，也没有操作已有 GUI。此后所有 helper 启动都强制 Node 模式。用户 GUI 及其已有进程从未被退出、杀死或重启。

## A2 carrier 判定

[逐项 carrier 表](S01-CARRIERS.md)覆盖 74 legacy + 31 V4 声明，以 shared schema → CLI server dispatch → zcodeAgentService Host consumer → GUI IZCodeAgentService consumer 路由分类。该表是静态 carrier 证据，不是全协议 LIVE 验收。

- LIVE stdio：runtime/capabilities→`{independentPlanState:true}`；session/list→`{sessions:[]}`；workspace/readPresentation→workspace/mode/slashCommands。请求包含正式 workspacePath 与 workspaceKey，session/list limit=5。
- LIVE `v4/controller/subscribe`、resync、unsubscribe 均 -32601。CLI server.ts:461–714 无这三个 case；不从共享声明推定可调。
- `controller/hello` 不是正式 CLI method，试探返回 -32601。真正 helloConversationV4 / initializeConversationV4 是 Host service RPC：zcodeAgentConnectionScope.ts:668–676 → GUI ui/v4/agentV4ConnectionHandshake.ts:27–35。packages/server 的 SocketProtocol/ChannelServer stdio 与 CLI NDJSON **是不同 carrier**；desktopHostProcess.ts:257 通过 Electron utilityProcess / MessagePort 装配本地 Host。没有据此构造外部 attach。
- 账号示例 `account/status` 返回 -32601，单独这个结果不证明所有账号能力不存在。服务源码与 CLI dispatch 一并确认：app-server 的 provider/updateAccountConfig 是配置同步入口，不是登录、登出、凭据解析器；正式账号服务在 Host 装配（services/node.ts:1494 等）。没有已验证的外部正式账号来源。
- reverse auth：interaction/requestProviderRuntimeHeaders → provider-runtime-headers.ts → Host zcodeAgentService.ts:2245–2295。缺 accountRequestAuthService/accountAccess 时官方 Host 立即回应 headersApplied:false。bridge 遵循同样的失败 response 形状，没有复制后台鉴权实现。
- LIVE reverse session/requestRuntimePreferences 在受控 session/create 时出现；探测只返回禁用增强搜索/记忆/自动问答的正式偏好形状。生产 S01 bridge 不实现恢复/创建入口，对未支持 reverse callback 明确 -32601；未来 S02/S04 必须补正式偏好来源。
- LIVE 证据：[carrier-live.log](checks/carrier-live.log)，退出码 0；所有错误 id 均归属原请求。

## A3 配置、能力与鉴权前提

正式读取 runtime/capabilities 与 workspace/readPresentation 成功。它们不含登录/权益确认。实际账号登录状态 **UNKNOWN**（未读账号库，未读取 token/header，未调用后台服务）。bridge 的 `auth=unavailable` 表示这个客户端缺正式请求鉴权来源，不表示用户已登出。

App-server 的 process-provider-registry-runtime.ts:48–59 仅在 standalone 模式装配凭据来源；当前 app-server 调用没有该选项。正式 Prompt CLI/TUI 的 standalone 来源属于另一执行路径，不能静默替换全功能 app-server authority。没有转用它，也没有 API-key fallback。正式 auth 未确认可用，因此只读模型任务 NOT_RUN；付费模型调用 0/1。

bridge 状态为 restricted / official-auth-source-missing；未提供“可运行”绿色状态。新 tuple 未验证时为 restricted / runtime-unverified。实际身份、账号来源与共享会话验证分开显示。

## A4 会话、锁、多客户端

测试 workspace：/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/s01-probe/zcode-test-workspace。GUI 打开态，通过 `ps -axo pid,ppid,comm` 仅观察到用户官方进程；没有向其发送控制信号。

- 受控官方 session/create（不指定 id；persistence=immediate；titleGenerationEnabled=false；mcpServers=[]；toolAllowlist=[]）成功，当前进程 session/list 能列出 1 个测试会话；未发送 prompt、未执行工具。最初两次 create 参数分别因 persistence='persistent' 与普通 create 显式 id 被 -32602 拒绝；没有把错误计为成功。
- EOF 后按已保存的**自有测试 session id**冷恢复返回 -32004 Session not found，第二进程同 workspace list=0。只记录自有 id 的脱敏错误，无用户会话内容。[cold-resume.log](checks/cold-resume.log)，命令退出 0、业务恢复为拒绝。不得把该 oracle 写成恢复 PASS。
- server-operations.ts:1622–1670 列表会合并驻留内存会话与持久 store；进程内可见不等于落盘。CLI 默认 storage.sessionDbPath 为 ~/.zcode/cli/db/db.sqlite（contracts/config/index.ts:303），正式 ZCODE_SESSION_DB_PATH 可以指定来源（adapters/config/env-config.adapter.ts:29），但当前没有验证与 GUI authority 对齐的来源。因此不猜数据库路径、不直读/直改 GUI store。
- 两个新建自有 headless 实例同时 capability/list 成功，pid 82493、82494；无数据库 busy/lock rejection，仅证明当前**只读查询并存**。[two-clients.json](checks/two-clients.json)。没有进行并发写、没有使用用户已有会话。多客户端写/官方 GUI 同一持久会话一致性 NOT_RUN。
- GUI 关闭态 **NOT_RUN / deferred LIVE_VERIFY**：硬红线禁止自行关闭用户 GUI。自启 headless 无窗口路径已运行，不等于用户 GUI 完全关闭场景通过。

## A5 失败与清理

B01/B05/B06、EOF、parse、timeout、cancel、dispose 的 fake peer/自有 process 检查真实运行：11 tests PASS / exit 0，[bridge-tests.log](checks/bridge-tests.log)。fake 只验证 parser 和资源生命周期。

- B01：legacy outbound 无 jsonrpc；拆分 UTF-8；foreign/numeric/invalid id 不会结算自己的请求；runtime error 保留 code、不会变成功。
- B05：受控 reverse auth 请求立即收到 headersApplied:false；取消 notification 不遗留 host auth pending；dispose 清空本地等待。没有 180s 队列。正式 runtime 触发模型 auth callback **NOT_RUN**，未为此消费无正式鉴权的模型调用。
- B06：没有 session/close；borrowed streams 不被 kill；Host 只持有自身 spawn 的 ChildProcess，EOF 后有界 SIGTERM/SIGKILL 只用于那个对象；测试中旁边无关进程保持存活。产品无 attach 入口、无通过发现 PID 进行清理的路径。
- missing installation 真路径 / missing helper 真临时 plist fixture / ENOENT 自有 spawn / metadata 阶段 dispose / EOF / 30ms timeout / AbortSignal 均有独立 oracle。deadline/cancel 只清理本地 pending，不自动重发，不宣称 runtime 未执行。

## DSH 入口与工具环境

生产使用既有 connection.rpc `/api` interceptor（沿用 DSH trust/auth admission），仅提供 status/connect；不接受原始 runtime command。Client 挂 `plugins.bundle.config` keyed slot，key=@dsh-zcode/bridge。Host/client unload 撤销 RPC/slot并 dispose 自有 runtime。

真实 official runtime → Host RPC → DSH production slot renderer 的 jsdom 检查 PASS；bundle/DSH overlay 使用已有 loadOverlayPatches/composeEntries。5 tests / exit 0，[dsh-integration.log](checks/dsh-integration.log)。真实 DSH GUI/packaged desktop oracle **NOT_RUN**，不是以 jsdom 冒充完整 GUI 验收。上游既有 ui-settings-agent-loop apply 与 plugin-manager patch：12 tests / exit 0，[dsh-baseline.log](checks/dsh-baseline.log)。

跨 checkout 测试使用 DSH 现有 aliases、standard decorator transform 和 vitestExecArgv。初始故障有：测试路径不在原 alias 范围、React 两份实例、keyed slot 漏 key、测试 context dispose API 用错、Node 26 webstorage masking jsdom、renderOpts 应使用 entryKey、locale face 未装配；均在对应边界修复并重跑原检查。没有为这些故障改 DSH seam。

依赖安装第一次 exit 1：lefthook 包 postinstall 先写了全局 /Users/ibobby/.githooks，DSH 根保护脚本随后拒绝覆盖 user-owned core.hooksPath。根据安装日志和生成文件标记，将备份 pre-push.old 复原、移除此次生成的 pre-commit/pre-merge-commit；生成文件保留于 .agent-work/tmp/s01-probe/hook-install-side-effect。未改变全局 gitconfig。DSH tracked 文件无依赖变更；仅本任务的配置例子可提交。以后执行依赖安装应先防止 dependency postinstall 的全局 hooks 副作用，不能把 DSH 根保护脚本当作其前置防护。

`pnpm exec` 在 pin 检查时再次尝试 root install 而 exit 1；改为直接 node node_modules/vitest/vitest.mjs。直接 plugin-manager 安装先在 jsdom 下遇 ERR_INVALID_URL_SCHEME（测试环境 URL carrier），转为真实 tsx Node oracle；file: specs 避免 pnpm link peer 警告。最终隔离 profile pin pnpm 11.7.0，真实安装 exit 0、bundle 登记且两个 export 文件存在，结果见 [plugin-install.log](checks/plugin-install.log)。没有绕过 plugin-manager 拒绝、没有 patch 上游实现。
