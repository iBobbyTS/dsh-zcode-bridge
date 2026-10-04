# AUTH Phase 2 S01 — 账号材料来源与拓扑判定

判定：**S02 可继续 scratch Host 产品化；当前隔离 profile 未登录，真实 HOME 准备与共享写均 NO-GO，登录解锁未验证。** 官方账号 producer 属于 Host 内的文件态凭据服务，现有证据不支持“OAuth 必须读取官方 Keychain item 才能运行”的说法。任何可能触及真实 Keychain/用户数据的后续路线仍须 S01 判定、PLAN delta 评审和用户原话确认三重门。

执行时间：2026-10-04 15:19 UTC 起；bridge `feat/zcode-runtime-bridge`，基线 `6e5c1be0b41ee59608042d4879104404ac6fbddd`。任务权威完整读取：`.agent-work/tasks/S01-P2-TASK.md`；计划权威：`PLAN-PHASE2.md` S01、需求修订记录、排除项与集成条件依赖。仅增加本文、checks 与 handoff；零产品改动、不 push。本文给出有界判定，不代表主 agent acceptance、双独立 review 或 M0 解锁。

## 证据索引与分级

路径均相对 [checks/auth-phase2-s01/](checks/auth-phase2-s01/)。12 个证据组；文件数量及 SHA-256 以 `evidence-manifest.json` 为准。STATIC、LIVE、CONTRACT-HARNESS 和 NOT_RUN 分别标记，不互相替代。

| ID | 文件 | 覆盖 |
|---|---|---|
| P01 | `artifact-identity.json` | 官方 ASAR/cjs、未改动提取 Host/Main 的身份与 hash |
| P02 | `real-home-metadata.json` | 真实 `~/.zcode` 深度 2 的 scandir/lstat；仅文件名、类型、大小、mode、mtime |
| P03 | `static-source.txt` | reference@29628c9 的 producer、存储、消费、初始化与 Main bus 源码行号/hash |
| P04 | `packaged-anchors.json`, `packaged-flow-paths.json` | 官方安装包同类实现的静态锚点与字节偏移 |
| P05 | `signing-metadata.json` | 官方 Developer ID / scratch Electron ad-hoc 签名和 entitlements 元数据 |
| P06 | `keychain-sentinel.json` | 随机哨兵名称、无 `-w` 的存在性查找：exit 44 / item-not-found / stdout 0 B |
| P07 | `s01-host-a/*` | Main 17559 / Host 17578 的真实隔离状态往返、进程与文件落点 |
| P08 | `s01-host-b/*` | Main 17558 / Host 17579；与 A 时间重叠的另一真实隔离 Host |
| P09 | `live-summary.json`, `probe-s01-main.cjs`, `run-s01.py`, `probe-s01.sb` | 白名单、sandbox、10 次状态 RPC、无窗、清理、GUI 清单一致 |
| P10 | `reference-authority-s01.cjs`, `reference-authority-s01.json` | reference 原 bridge/bus/schema 的合成合同动态执行，66 个加载源码 hash |
| P11 | `attempt-ledger.json`, `reference-authority-s01-attempt1-error.log` | 失败尝试、被禁网的后台配置刷新、警告与 NOT_RUN 入账 |
| P12 | `verification.json`, `evidence-manifest.json` | 证据一致性、资源退出、docs-only 边界验证与归档清单 |

P01：ASAR `232e913ea13d60bd0ecc86bf9f2f145328809608fe4d48e76685d61a8076aef0`；cjs `fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`；Host `c143ce16c61ad1d01d8cbfca0a0e2f506aa5afa3858db3f088e69ecf11d588d3`，与 Phase 1 相同。未写官方安装包、ASAR 或 reference。

## 账号材料归属

| 生产 / 存储 / 消费 | 判定及证据 |
|---|---|
| OAuth producer | Host `OAuthService` 的 start/poll/callback → `persistOAuthSession` → `OAuthCredentialRepo`；repo 持久化 provider token、profile、共享 JWT 与 active-provider 指针。STATIC P03/P04；本次未产生或查看任何真实值 |
| 文件存储 | `createCredentialService` → `getAppConfigDir()/credentials.json`，通过官方 cipher provider 加密；默认 provider 为 AES-256-GCM，支持官方 secret env，fallback 绑定平台/HOME/OS 用户。只分析实现，不推导密钥、不解密。P03/P04 |
| Provider 文件 | `provider_config.json` 和账号 overlay/选择描述配置与权益；不能替代 OAuth 或套餐材料。Individual/Team 派生材料通过 accountProviderCredentialStore / credentialService 消费；bridge 不调用 credential channel。P03、AUTH-SOURCE E07/E15–E18 |
| 模型请求消费者 | `createAccountProviderRequestAuthService` 按 Start/Individual/Team 解析；Start 消费官方 JWT，Individual 消费官方套餐材料，Team 由官方 resolver 取得。Host accountRequestAuthService 通过进程内 WeakMap 持有，未暴露为通用 RPC（E06/E07） |
| wire 消费 | 官方 CLI requestClient 反向请求 `interaction/requestProviderRuntimeHeaders` → Host 服务自动解析并回复；`requestAuth.apiKey` 是官方 wire 字段，不能因名称当作 API-key fallback（E01–E05）。本次没有触发 challenge |
| Keychain 与签名 | 当前 Host bundle 内 `safeStorage` / `Keychain` / `keychain` 字符串均 0；实际 credential 函数及 fallback 均存在。reference 注释说未来可切换 safeStorage。Main 的 `Keychain` 锚点是 Chrome Safe Storage 导入实现，非 OAuth store。此静态覆盖不证明整个 App 永远不触及 Keychain |

P02 LIVE：`v2/credentials.json` 存在，21,347 B、0600；`v2/setting.json` 4,899 B；tasks DB 7,864,320 B。**存在与大小不证明登录账号、token 有效性、套餐资格、加密格式或可解密性**。未打开这些文件、未读取 DB、未跟随符号链接；深度 2 未枚举 `cli/db` 内容。官方 GUI 的登录状态仍 UNKNOWN。

P05 LIVE：官方 App 为 Developer ID（Team `8A5X4JJ39T`），自建 Electron 为 ad-hoc/no team；所显示官方 App entitlements 无 keychain access group。签名差异不等于已证明凭据 ACL 拒绝。P06 随机哨兵 query 没有数据输出，返回“item could not be found”，**不能标记为权限拒绝，也不能证明官方 item 存在/不存在**。未查询任何官方 item；未创建、更新、删除或解密任何 Keychain item。哨兵创建/读回与官方 item ACL 测试 NOT_RUN，真实 login Keychain 写入红线仍有效。

### AUTH-SOURCE E01–E22 对照

| 原证据 | 本次衔接 |
|---|---|
| E01–E04 | 保留 NDJSON 反向请求/应答结论；S02 应让 Host 拥有内层 CLI pipe，bridge 使用外层 Channel；未发起模型 challenge |
| E05–E07 | P03/P04 固定 producer 与进程内 resolver；P07/P08 证明账号服务可装配并返回 signed-out，未证明材料解析成功 |
| E08–E12 | utilityProcess + transferred MessagePort + Channel Initialize 实跑；与 server WS/SocketProtocol、CLI NDJSON 分层，未附加官方 GUI |
| E13–E18 | standalone/overlay/env 不能给现有独立 app-server 自动增加 Host auth；不得复制 resolver/导入真实凭据来绕过边界 |
| E19–E21 | UI Plugin/sampling 不提供新账号 source；本节不调用 sampling，也不扩大协议 |
| E22 | 两个 fresh scratch Host 都实际创建 tasks/session DB；启动本身存在迁移写入，不能以“只发状态 RPC”声称启动只读 |

## 隔离动态探测与 OAuth 形态

复用 Phase 1 提取副本与 Electron 41.0.3 / Node 24.14.0。两个 Main 同时启动，各自持有自己的 utilityProcess、MessagePort、HOME、DATA_BASE_DIR、session DB 与 Electron 路径。InitLocal 增加唯一 `hostId` 与 `deliveryKind=desktop_window`，无 workspace attach/warmup。自有 Main 禁止激活，最终均 `windowEvents=0 / windows=0 / webContents=0`。

复现入口（从 Phase 1 scratch 根目录运行，使用新 run 名避免覆盖原证据；归档脚本副本依赖该 scratch 的 Electron/official-extracted 布局）：

```sh
python3 run-s01.py s01-replay-a
python3 run-s01.py s01-replay-b
node reference-authority-s01.cjs
```

两次 replay 若验证同时并存须由调用者并发启动；本次原 run 已并发启动并在 P09 记录重叠时间。reference harness 使用既有 DSH TypeScript 和 zod 依赖，只读加载源码，未安装包/运行构建。

每个 Host 只发送五个 RPC：`oauth.restoreCachedSessionState`、`oauth.getActiveProvider`、`oauth.getProviders`、`provider-settings.getView`、`setting.get`。`call()` 发包前强制 allowlist；Phase 1 的 connectivity tester 片段已从本次脚本移除。各 5/5 正常响应：signed-out、active=null、OAuth providers=`bigmodel,zai`，六个账号 provider 均不可执行/not-connected，运行 Registry providerCount=0。未输出 profile/token/credential 值。各 runner exit 0（约 11 秒）；ready 时间重叠；16 个官方 GUI 记录前后逐项相同；自有进程退出。

外层 sandbox：拒绝 scratch 外写入（`/dev` 除外）、拒绝真实用户目录内容读取、拒绝 network、拒绝 securityd/securityd.xpc/trustd mach lookup。Chromium `no-sandbox` 沿用 Phase 1 处理嵌套 sandbox EPERM，外层策略保留。这是探测运行配置，不是产品安全配置验收。Host 初始化的 CA key/pem 只在 scratch 文件系统中生成，未读内容；它不是 Keychain 哨兵项。

OAuth STATIC 形态：UI `useOAuth` → `oauth.startOAuthWithPolling(provider)` → 官方 API init/poll → URL 返回 → platform.registerOAuthState / openExternal → deep-link state 路由 / Host.handleCallback；完成路径持久化至 credential repo。Host 的账号业务代码没有 BrowserWindow 依赖；官方桌面入口使用已有 renderer、外部浏览器和 Main state→window 路由。**无窗口的非登录态已 LIVE；自建 Main 登录 UI/浏览器回跳、poll 成功与最终凭据落点未 LIVE。**

本次没有调用 start/poll/callback/refresh/logout/restoreSession；它们不在状态白名单内，成功路径还可能产生写入。不能用静态 file store 结论撤销 Keychain 不随 HOME 重定向的系统边界。隔离 profile 登录若启用系统浏览器、Electron OS crypto/Chrome 导入或其他新增路径，仍需逐项证明真实落点不被触及；有真实落点即三重门。这里没有执行到登录完成，也不声称已实测登录写入。

## 落点解析表

`R` = `.agent-work/tmp/host-reuse-probe/runs/s01-host-a`（B 同构）。默认列是 STATIC 解析，不是启动默认 HOME 的结果；实际默认配置可覆盖路径，未经读取无法确定真实 GUI 的最终自定义落点。

| 域 | 默认/解析优先级 | 本次实际隔离落点 | 默认触及真实数据 / 证据 |
|---|---|---|---|
| settings | `HOME` 或 homedir → `.zcode/v2/setting.json`；不跟随 DATA_BASE_DIR | `R/home/.zcode/v2/setting.json`（fresh 未产生文件）；setting.get LIVE；Phase 1 settings-live 合成迁移已证此位置 | 是；P03/P04。S01 不制造账号选择，不以选择证明 auth |
| tasks / provider / credentials / CA | setDataBaseDir > `ZCODE_DATA_BASE_DIR` > 启动 HOME/homedir → `.zcode/v2` | `R/data-base/.zcode/v2/{tasks-index.sqlite,provider_config.json,certs/...}` LIVE；`credentials.json` 在空账号分支未产生，路径 STATIC | 是；tasks 文件 147,456 B；provider 206 B；P03/P04/P07/P08。credential 写入尚未 LIVE |
| session DB | storage config / `ZCODE_SESSION_DB_PATH`（也支持 SESSION_DB）；相对路径按 runtime cwd；默认 homedir `/.zcode/cli/db/db.sqlite` | 显式绝对 `R/session-db/db.sqlite`，LIVE 413,696 B；不与 tasks DB 合并 | 是；P03、env-config.adapter.ts:24–32、P07/P08。不把 DATA_BASE_DIR 当 session DB 隔离变量 |
| CLI config/home | 默认 `~/.zcode/cli`，HOME 影响默认路径；`ZCODE_HOME` 并未找到这条链的可靠消费证据 | `HOME=R/home`；额外设 `ZCODE_HOME=R/runtime-home`，不以该变量作为隔离保证 | 默认是；文件配置与绝对 session env 必须分别验证 |
| Electron userData/sessionData/logs/temp | Main app.setPath；Electron 默认用户应用目录 | `R/{userData,sessionData,logs,tmp}` 显式绑定 | 默认是；P09 launch/main_ready |
| Keychain | OS 当前用户 securityd/login 域；不随 HOME / DATA_BASE_DIR / session env 改址 | 没有配置“隔离 Keychain”；拒绝 OS 服务/真实文件路径访问；只做无数据随机存在性 lookup | 系统域是；P06 仅 missing sentinel，非官方 ACL oracle。完整登录写入 NOT_RUN |
| 运行租约 | Main `TaskRealtimeBus.leases` 内存 Map，workspaceKey+taskId，ownerHostId/runId；不是 SQLite 锁/磁盘 lock | 两个自建 Main 相互独立；真实状态探测没有 acquire 消息；reference harness 两个 bus 各自可授予同目标 | 不会自动共享官方 Main；P03/P10。同库不能建立共同租约 authority |
| cwd / 内层环境 | agentSpawnFallbackCwd + runtimeProcessEnvPatch；startup storage Worker 与后续 Agent 都须覆盖 | `R/workspace`；HOME/DATA_BASE/session/provider path 明确传递 | 默认可能走真实 workspace；P09；实际任务 Agent spawn 未执行 |

## Main authority 协调边界

官方 `taskRealtimeBridge` 仅 InitLocal 且有 hostId 时装配。Host parentPort 发送 acquire/release、owner command、event/stream；Main bus 注册真实 child 与 workspace keys，保存租约并向 child 回投。省略 hostId 会使 realtime port=null；“Phase 1 RPC 通了”不能证明协调 Main 已实现。当前真实双 Host 只运行状态面，虽然给了 hostId，**没有运行任务，也没有发送租约/owner/stream消息**。

P10 CONTRACT-HARNESS 使用未修改 reference bridge/bus 和正式 shared schemas（VM 转译，zod 4.4.3；logger/noop、UUID、EventEmitter parent/child 适配器）。同一个 bus 的 A acquire=true，B acquire=false/owned_by_other_host；B owner command 转交 A，测试 listener 合成 success ack；stale run 被拒绝；同 eventId 发布两次各 listener 仅一次；A release 后 B acquire=true；owner exit 清租约。第二个独立 bus 的 C 同时 acquire=true。**合成 stop_generation 只在 harness listener 被确认，没有发给真实 Host/任务；不是实际停止操作。** 本 harness不执行 OSS runtime、不复制账号 resolver，不宣称安装包 task runtime已通过。

| 自建 Main 必须拥有 | 需要保持的官方合同 |
|---|---|
| Host register/unregister / hostId / workspace keys / deliveryKind | InitLocal 就绪与退出生命周期、同 Host 多 attachment、移除 Host 释放所有 lease/pending/routes |
| task-run-lease-acquire → task-run-lease-result；release | workspaceIdentity 优先 identity key；workspace+task 单 owner；runId fencing；不得用 DB 锁代替 |
| task-owner-command-request / deliver / result | 查 active owner、拒 stale run、仅收实际 owner 的结果、超时/owner exit 明确失败、不做隐式重试 |
| task-realtime-publish / deliver | eventId 去重与有界缓存、workspace visibility、origin 收敛、不回环 |
| task-stream-op-publish / stream mirror / replay | owner/run 验证、seq/watermark、batch、gap/owner-lost invalidation、desktop-continuous 与 web-remote-replayable 分别处理 |
| session-route-announce / session-message 路由及结果 | 如接入该面，由同 Main 负责路由生命周期；不能冒充 task command pipe；可能触发任务的消息在 S01 全禁 |
| 其他 Main 平台回调 | database startup relay、attachment teardown、登录 state/deep-link/browser 入口、网络生命周期；按能力明确实现/禁用。不能通过读取秘密来补回调 |

与运行中官方 Main **不能自动协调**：没有已验证第三方注册官方 bus 的公开 IPC/socket；MessagePort 由其 Main 创建转移，bus 为该进程内存；自行设相同 hostId、workspace、DB 路径不会加入它。官方 GUI 进程仅 ps 观察，没有信号或 IPC。**共享写维持 NO-GO**，即使后续 SQLite 同库读/锁测试成功；必须由 S06 证明正式协调路径。

## 路线判定及后继输入

| 路线 | 当前判定 / LIVE 锚点 | 落点与门 | 对 S02–S06 的输入 |
|---|---|---|---|
| 全隔离 profile 状态/宿主准备 | GO（有界）；P07/P08 signed-out、独立 DB、无窗 | 所有文件落点 scratch，Keychain/网络拒绝；仅 scratch 门；不是 auth GO | S02 可以产品化 launcher/Channel adapter、Main 回调、模型请求闸门；S05 隔离 GUI 不受本结果阻塞 |
| 隔离 profile 官方登录流 | **当前 auth NO-GO / 完整登录 NOT_RUN**；P07/P08 无账号；P03/P04 提供 official polling/file producer 路线 | file landing 理论为 DATA_BASE/v2/credentials.json，但未写入验证；Keychain 系统域没有 HOME 隔离。若逐项证明仅 scratch 可继续 scratch 探测；凡可能触及真实 Keychain/browser profile/GUI 状态须 PLAN delta+用户原话确认 | S03 需用户完成官方登录、state 回跳/poll 路由、官方账号 active/connected 状态真实翻转；窗口需求仅静态。S04 请求级上限尚不能执行 |
| 真实 HOME 有界准备 | **当前 NO-GO**；P02 真实凭据/settings/tasks 存在，P07/P08 启动即迁移写 scratch DB，P03 corrupted OAuth 会清 store | 默认真实 `.zcode`；session DB 独立；Keychain 仍真实系统域；必须三重门，启动前逐落点隔离证据或相应 S06 并存子集证明 | 不可直接改 env 启动，也不可复制真实 credential 文件到新 HOME：cipher fallback 与 HOME 绑定且错误恢复可能删除材料。S06 只允许获准 scratch 库，不写回 |
| 共用真实 GUI session/tasks 写入 | **NO-GO**；P10 独立 Main bus 双 owner，P07/P08 未出现跨 Main 协调 | DB 与租约是两个 authority；无已验证共同 Main 协调入口 | S06 必须补真实双 Main/双 Host runtime租约/owner/events oracle；没有正式路径就维持共享写 NO-GO |

本次没有请求、假设或取得新用户权限。PLAN 已有“允许处理 auth”原话不等于允许触碰真实数据/Keychain，也不等于付费预算。

## 风险与并存表

| 风险/并存问题 | 当前观测 / 约束 |
|---|---|
| 运行中 GUI | P07/P08 16 个 pid/ppid/comm 记录一致；只覆盖独立存储/禁网非登录态，不覆盖网络开启、共享 DB 或登录 deep-link 的冲突 |
| Host 初始化写入 | 两份 fresh DB 的真实创建/迁移；禁止真实 HOME 启动做“只读资格检查” |
| settings 和 DATA_BASE 分离 | 单独 HOME 隔离不够；必须同时覆盖 session DB、Electron 数据、内层 env、workspace、Keychain 域 |
| 凭据复制/错误恢复 | 不复制、不解密；默认 cipher 与 HOME/用户关联；reference corrupt OAuth recovery 可删除 store，真实读取也可能写入 |
| OAuth 与 Chrome Keychain | 账号文件实现不是 Chrome import secret；禁用后者。静态未见 safeStorage 不作为未来登录真实写入的豁免 |
| 运行 authority | 双独立 Main 的内存租约互不协调；共用 DB 不足以证明同会话互斥 |
| 网络初始化副作用 | 两个 Host 的 built-in config background refresh 失败/invalid response，真实失败入账；不是登录失败或模型请求。网络开放后的副作用未验证 |
| 模型请求预算 | 发包白名单仅状态，模型任务/auto title/tester/warmup/recovery 0 次调用；无 workspace attach、无 prompt/session恢复/close。S02 请求级阻断钩子尚未落地，不能据此次 0 次证明 S04 硬顶可执行 |

## S02 Host Channel 拓扑输入

1. bridge Node/DSH 的既有专用接入 → bridge 拥有的 Electron Main（launcher）→ 官方 `utilityProcess.fork(out/host/index.js)` → InitLocal+transferred MessagePort → `MessagePortProtocol`/`ChannelServer`。Initialize=200、request=100、promise response=201 的二进制编码来自官方 Channel 层；不得把外层误用成 CLI NDJSON。生产还必须实现错误、取消、event listen/unlisten、端口退出的正式协议，probe codec 仅验证五个调用。
2. Host `ServiceCollection` 公布 `oauth`、`provider-settings`、`setting` 和 `zcode-agent`、`zcode-session`、`zcode-task` 服务；每个 MessagePort 的 `createZCodeAgentConnectionScope` 注入独立 connectionId / desktop-continuous clientMode。材料 resolver 留在 Host 内部。P03/P07/P08；S02不得通过 credential RPC 导出值。
3. runtime 真实载体：`zcode-agent.initialize` / `getWorkspaceRuntimeIdentity` → Host 的 `ZCodeAgentProcessManager` 拥有官方 cjs app-server pipe，Host 自动处理 E01–E05 auth reverse requests。现有 BridgeHost 直接 app-server 连接应切换为 Host-backed execution authority，不能同时另起一个独立 CLI 当第二会话 owner。
4. session 载体：`zcode-session.initializeWorkspace/createSession/listSessions/readSession/resumeSession` 对应 Host session 服务；workspacePath/identity/remoteSessionId 必须贯通。`session/close` 及 Host `closeSession/closeDeferredDraftSession` 同样禁止发出；不能以换外层方法名绕过。
5. command/事件载体：`zcode-agent.sendConversationCommandV4`（command ack/query）、conversation subscribe/resync、`onDynamicConversationFrame`；sessions-index/workspace-config 各自 subscribe/frame。Host facade转发 CLI V4，保持 CommandInbox admission、run fencing、deliveryKind 与 client connection scope。Main parentPort realtime bus 是跨 Host authority 旁路，不是 renderer Channel RPC 的替代。
6. 上述 runtime/session/command 挂接本次为 STATIC，不纳入 S01 白名单。S02 应先落实逐落点断言、Main callback owner、resource teardown、provider每次实际请求的发出前阻断/计数钩子；无法正式安装此机制，S04 必须 NOT_RUN(cannot-enforce)。仅取消顶层 prompt 或事后 usage 计数不合格。

## NOT_RUN 与失败入账

- **NOT_RUN**：真实 OAuth start/poll/callback/refresh、登录状态翻转、登录凭据写入落点 LIVE、自建 Main 登录窗口/外部浏览器回跳；原因=状态白名单与真实系统域写入门禁，未伪造 callback/token/challenge。
- **NOT_RUN**：任何官方 Keychain item 读取/解密/查询、哨兵创建/读回、真实签名 ACL；随机 missing lookup只证明自己的返回值。
- **NOT_RUN**：真实 HOME Host 启动、真实 DB/credential复制、共享库写入、真实 GUI attach/关闭/信号。
- **NOT_RUN**：真实官方 Host 任务租约/owner 命令/stream 收敛；状态双 Host没有这些消息。P10是合成合同执行，完整 runtime oracle交给 S06，不能记 LIVE PASS。
- **NOT_RUN**：runtime/session/command/usage RPC、session create/resume/close、模型 challenge/任务/测试器/自动标题/流恢复/Agent warmup、付费调用与请求级钩子证明；调用数均 0。
- reference harness 初次 exit 1：缺少 `@zcode/model-option-map`。仅补充指向只读源码的 loader 映射后重跑 exit 0；失败原文保留 P11，第一次不记 PASS。
- 静态定位中不存在的猜测路径与 zsh wildcard 导致的退出 1/2、过宽搜索截断记录为 discovery failure；改用确切路径读取，不把截断输出当完整覆盖。codesign entitlements 的 `:` deprecated 警告保留；未改变制品。
- 2 次 Host background builtin config刷新失败如实保留。总体服务 ready / 状态 RPC成功，与刷新失败分别记账；不宣称联网可用或认证成功。

**0 模型请求、0 付费调用声明**：本次网络被外层拒绝，10 个实际发出的 RPC 全在五项状态白名单，未启动任务执行/会话恢复/工作区 warmup，也未调用任何模型路径；证据在 P07–P09。此声明不是以“没有 usage”推断。没有执行 provider 请求级计数钩子，尚不能为未来 S04 提供硬顶验收证据。S01 交付的是上述有界路线判定与后继合同；登录与真实运行协调 oracle 的缺口保留，主 agent需独立 review/admission。
