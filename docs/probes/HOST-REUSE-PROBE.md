Host 复用有界 LIVE 探测报告（2026-10-03，America/Edmonton）

**Phase 1 结论：结构与无窗口启动可行；隔离环境明确没有账号来源；真实模型鉴权仍未验证。** 本报告只提供证据，不采纳路线、不宣告 R15 合规或 M0 解锁。付费模型调用 **0/1**，第 6 项 **NOT_RUN**。

任务权威为 `.agent-work/tasks/HOST-REUSE-PROBE.md`；已读 AUTH-SOURCE-RESEARCH（E06/E09/E22/B02）、official-runtime-install-PROBES、PLAN-FULL official-runtime-install/B05。reference/ZCode 固定 HEAD `29628c9acdb81b703bbd4080c207a0e7ce5e276e`；使用安装包 3.14.4，不用 OSS Host 替代制品。工作产物全部留在本 scratch。

**执行环境与边界**

- macOS 26.6.2 / 25G83 / arm64；App 3.14.4 / build 3.14.4.7912。
- 自建 Main：npm `electron@41.0.3`，LIVE Electron 41.0.3 / Node 24.14.0 / arm64，与 official-runtime-install 官方 helper 版本匹配。
- ASAR SHA-256：`232e913ea13d60bd0ecc86bf9f2f145328809608fe4d48e76685d61a8076aef0`。
- 官方 cjs SHA-256：`fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`。
- 提取 Host 入口 SHA-256：`c143ce16c61ad1d01d8cbfca0a0e2f506aa5afa3858db3f088e69ecf11d588d3`，1,498,022 B。ASAR packed 文件逐一验证其内置 integrity；共提取 27,060 文件，320,109,886 B。未修改 Host/index/chunks，未写回 App。
- `HOME`、`ZCODE_DATA_BASE_DIR`、`ZCODE_HOME`、`ZCODE_SESSION_DB_PATH`、Electron userData/sessionData/logs/temp 都分别指向 `runs/<run>/` 下。settings 实际跟随 HOME，tasks/provider 跟随 DATA_BASE_DIR，二者不可混为一个覆盖变量。
- 外层 `sandbox-exec` 拒绝真实用户目录读取（仅允许 scratch 与确切父目录）、拒绝 scratch 外写入（/dev 除外）、拒绝网络及 securityd/trustd 服务。没有触碰 ~/.zcode、Keychain 或 GUI 存储，没有读取/导出凭据值。无登录、无凭据导入、无全局配置/hooks 修改。
- Main 禁止激活、无 BrowserWindow、无工作区 Agent warmup。Chromium 子 sandbox 因嵌套 sandbox EPERM 在 scratch 启动参数中关闭；上述外层访问控制保持有效。这是探测环境安排，不是产品运行配置结论。

**命令与产物**

以下命令均从 `/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/host-reuse-probe/` 执行；每次真实 launch 的完整命令、cwd、非敏感 allowlist env 在 `runs/<run>/launch.json`。

```sh
HOME="$PWD/npm-home" npm_config_cache="$PWD/npm-cache" ELECTRON_CACHE="$PWD/electron-cache" npm install --save-exact electron@41.0.3 --no-audit --no-fund
python3 extract-asar.py
python3 run-probe.py isolated
python3 run-probe.py migration
python3 run-probe.py settings-live
python3 run-probe.py lock-live --hold-lock
```

Electron 下载仅来自 npm electron 依赖安装链。npm 11 的脚本审批使 postinstall 未执行；手动 install.js 两次均退出 0 却未完整展开。缓存 zip 对照 npm checksums.json 核对 SHA-256 `d8aeeb263b234a243411e02b3828e9349fe976417798334cba9f34f6eae28d7e` 后，以 `/usr/bin/unzip -oq <scratch缓存zip> -d node_modules/electron/dist` 展开成功。安装脚本展开失败的根因未确定，不据此认定 Node 26 缺陷。

共 **6 次 Electron 探测启动**：`empty`（严格父目录读取策略导致 helper 定位 FATAL，Main 未 ready）、`parents`（Main/Host spawn 成功，Chromium 嵌套 sandbox EPERM 后退出）、以及 4 次成功启动。`migration` 的首次合成 fixture 放在 DATA_BASE_DIR，settings 并未消费；该负对照揭示路径差异。随后 `settings-live` 使用正确的 scratch HOME 路径，获得迁移写回证据。失败尝试不记 PASS。

1. **结构初始化 — LIVE PASS（隔离环境）**

   `probe-main.cjs` 使用 `utilityProcess.fork(official-extracted/out/host/index.js)`，传递 `{type:'init-local', databaseStartupId, agentSpawnFallbackCwd, zcodeBuiltinProviderConfigFilePath, runtimeProcessEnvPatch}`，并转移 `MessageChannelMain.port2`；Main 自持 port1 实现官方 Channel 二进制协议。初始化字段对照 shared/validation.ts:180 与 desktopHostProcess.ts:714–729；不是 require() 伪造 parentPort。

   `isolated` Main PID 46886，Host PID 46897；LIVE 状态为 `preparing_host_storage → preparing_session_storage → starting_services → ready`，日志为 `creating ChannelServer (deferInit=false)`、`local services ready, all channels registered`，收到 RPC Initialize=200 后 OAuth/Provider/Setting RPC 实际成功。Host 启动只使用未改动的官方提取副本；storage Worker 经 scratch bundled-resources/glm 的只读 symlink 定位官方 cjs。

   证据：`runs/isolated/events.jsonl`、`launch.json`、`observations.json`，以及 `extraction-manifest.json`。

2. **无窗口性 — LIVE PASS（成功启动均实测）**

   4 个成功 run 均有 `windowEvents=0`、`BrowserWindow.getAllWindows().length=0`、`webContents.getAllWebContents().length=0`。没有 BrowserWindow/Renderer/CUA 创建调用。Main 使用 `setActivationPolicy('prohibited')`，未调用官方 GUI。

   证据：各 run 的 `headless_final`，以及 own 进程树采样。早期失败 run 没有最终窗口计数，保留其失败状态。

3. **存储、迁移、锁 — LIVE PASS（仅 scratch）**

   空库启动：tasks 库完成 **3** 个 schema initialize migration；session 存储使合计 executed/committed 达 **25**（tasks 3 + session 22）。这是真实创建/迁移行为，不是静态推测；不是升级真实旧库的证据。

   空环境最终创建：`data-base/.zcode/v2/tasks-index.sqlite`（147,456 B）、`session-db/db.sqlite`（413,696 B）、bot-config/state.v3.json、provider_config.json、runtime/provider 下官方 builtin 配置缓存与刷新状态、`certs/zcode-network-ca.key/.pem`。运行中 tasks 库有 WAL/SHM；退出后 WAL/SHM 已回收。CA key 是隔离 Host 自行生成、模式 0600，未读取其内容。空 HOME 没有凭据文件，且没有自动创建 setting.json。

   合成 settings 迁移：在 `runs/settings-live/home/.zcode/v2/setting.json` 放置不含秘密的旧 locale/账号导航 key/两个旧偏好。Host 真实写回 defaults/migration flags；`providerFamilyConnectionSelections.zai={kind:'start-plan'}`，closeToTrayOnWindowsMigrationInitialized 和 messageStreamShowReasoningMigrationInitialized=true，旧导航字段保留。这只证明设置迁移路径；合成套餐选择不是账号身份或凭据。证据 `synthetic-settings-before.json` 与迁移后的 scratch setting.json。

   锁行为：`lock-live` 用 Python sqlite3 对复制的 scratch tasks 库持有 `BEGIN IMMEDIATE`，4.25s 后 rollback/release；Host 发布 `databasePhase=waiting_for_lock`，释放后 tasks/session 均 ready，migration kind=none、0/0，最后服务 ready。未造成 orphan 持锁。证据 `runs/lock-live/lock-control.json` 与 events.jsonl。

4. **账号服务装配与 auth 就绪性 — LIVE 有效无账号分支；真实 challenge/材料解析未验证**

   官方 Host 的 OAuth RPC `restoreCachedSessionState → {status:'signed-out'}`，`getActiveProvider → null`。ProviderSettings 返回六个 ZAI/BigModel Start/Individual/Team 账号 provider；均 executable=false，accountState.unavailableReason=`not-connected`，执行 Registry providerCount=0。

   在明确不可执行的账号 provider 上调用官方 `testModelConnectivity`，即时返回 `success:false / error.code:'provider-unavailable' / 'This provider is currently unavailable for connectivity testing.'`。安装包 chunk-FNQWK6LT.js 的实际条件分支已核对：该结果发生在 connectivity tester/Agent/model 执行前。因此该只读资格预检产生 **0 模型调用**。

   STATIC 配套：实际安装包保留 createAccountRequestAuthService/createAccountProviderRequestAuthService 与 AccountRequestCredentialUnavailableError；E06/E07/E09 的官方装配路径与 LIVE 服务表现一致。并未通过 RPC 调用内部 resolver，也未伪造 auth challenge。本次证明账号服务可用并明确无账号，不能证明真实 reverse auth challenge 成功或 R15 合规。官方 GUI 的实际登录状态仍 UNKNOWN。

   证据：`runs/settings-live/events.jsonl` 的 oauth_cached_state、provider_view、no_account_preflight；`evidence-summary.json`。

5. **与运行中官方 GUI 并存 — LIVE PASS（隔离存储/禁网范围）**

   4 个成功 run 的官方 GUI 进程清单均前后逐项一致，14 个记录（含 Main PID 22061；首次失败清单遗漏短名 Main，只记 13，不混作同一 oracle）。用 ps 的 pid/ppid/comm 只观察，没有读 GUI storage 内容或向其发送信号。lsof 只采样自有进程；打开的 tasks 数据路径均属于 scratch，未观察到 IP socket/端口或共享库冲突。

   此结论只覆盖独立存储、网络被外层策略拒绝的并存；不覆盖共用真实 GUI 数据库、启用网络后的端口分配或多 Host 共享 session authority。

   证据：各 run 的 gui-before/after.json、observations.json。所有记录的自有 PID 在最终 ps 核验均已退出；只通过创建时持有的 utilityProcess 对象 kill 自有 Host。

6. **唯一一次最小模型任务 — NOT_RUN**

   第 4 项未证明真实账号材料来源，明确得到 signed-out/not-connected。没有发起 prompt、Agent warmup、模型 connectivity tester 或 app-server 模型任务。官方 cjs 仅参与初始化所需的 storage Worker；这不构成 app-server 模型端到端成功。付费模型调用 0/1，未触发条件外调用。

**Phase 1 结论与待决点**

结构初始化、headless 与官方 GUI 隔离并存得到 LIVE 支持；E22 数据库初始化、设置迁移和写锁等待被 LIVE 证实。仅替换 Electron Main 并保留隔离存储，不会自动继承官方 GUI 的账号身份。再推进账号路径需要主 agent/用户裁定符合红线的正式材料来源；本 worker 没有把任何路径指向真实数据，也不请求共享 Keychain/凭据导出。

待决：R15 对内部 Host 初始化合同的接纳；官方 Host 自行执行 DB/settings migration 是否符合数据迁移合同；符合约束的独立账号 source/授权方式；R10/R11 下共享 session authority 与真实存储并发策略；禁网之外的 API/端口与签名/发布运行环境；未来满足账号来源条件后的唯一一次真实模型任务。

**go/no-go 证据摘要（8 行；供主 agent 裁定，非路线采纳）**

1. GO 证据：未改动的安装包 Host 可在自建 Electron 41.0.3 utilityProcess 中完成 InitLocal/MessagePort 初始化。
2. GO 证据：4 次成功启动均无窗口、无 WebContents，账号/配置服务 RPC 可往返。
3. GO 证据：隔离启动与运行中官方 GUI 清单并存一致，全部自有进程已退出。
4. 约束事实：Host 自动初始化 tasks/session schema，读取旧 settings 时会迁移写回，并等待数据库写锁。
5. NO-GO 证据（当前隔离 auth 解锁）：signed-out、active=null、账号 provider not-connected，预检 provider-unavailable。
6. 未证：真实 auth challenge/材料解析、模型任务、共享真实 session authority、联网运行时并存。
7. 下一门槛：先裁定合同与正式账号来源；不得以读取真实数据/导出秘密绕过本次边界。
8. 计费：0/1；第 6 项 NOT_RUN；本报告不宣告路线接受或 M0 完成。

---

> 归档说明（主 agent）：本报告由探测 worker（external codex/gpt-6.1-sol/high，agent_id 10000545，session 01a101c1-1570-7670-b89b-5f6f469a574d）于 2026-10-03 产出并保存于 .agent-work/tmp/host-reuse-probe/（含 run-probe.py、evidence-summary.json 与原始证据），主 agent 机械归档至本仓。判定要点：结构/无窗口 GO；存储迁移/锁行为实测；隔离环境无账号来源（真实数据 Phase 2 属用户决策点，未执行）。付费调用 0/1（0 次使用）。
