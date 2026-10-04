# S02-P2 handoff — scratch windowless Host launcher

任务：`../.agent-work/tasks/S02-P2-TASK.md`；消费 `PLAN-PHASE2.md` S02、排除项、按落点的集成依赖，以及 [S01 判定](../probes/AUTH-PHASE2-S01.md) 的落点表、协调边界、拓扑输入与必要回调表。bridge `feat/zcode-runtime-bridge`，基线 `0249f90`；DSH `21fb059745ddc1b78e387c24f3987b68569de236` 无改动；reference `29628c9`/官方 App 只读；EXECUTE_WITH_COMMIT，不 push。

**自评 PARTIAL：scratch 状态面、Main 合同、安装/生命周期和错误路径已实现并实测；实际 provider 请求拦截未装入官方 Host，S04 必须 NOT_RUN(cannot-enforce)。** 不宣称登录、会话/命令切换、共享 GUI 写 authority 或模型执行可用。本 handoff 是实现者交付，不是独立 review CLEAN 或主 agent acceptance。

## 实现清单

| 落点 | 实现 |
|---|---|
| `packages/host/launcher/config.mjs` | 必填 scratch/只读制品/固定 Electron；逐落点、双 env、cwd 与符号链接断言；新 run only；官方 Host 18 文件和 CLI digest 校验 |
| `bootstrap.cjs` / `main.mjs` | 在依赖加载前注册 uncaught/rejection handlers；禁激活、绑定 Electron 路径；fork 官方 `out/host/index.js`；唯一 hostId、deliveryKind、InitLocal 与 transferred MessagePort；安全状态输出 |
| `channel.mjs` | 官方二进制 tags/varint/嵌套 bytes；200、100/101/102/103、201/202/203/204；错误字段、取消、timeout、event listen/unlisten、传输退出；pending 128 / subscriptions 64 上限 |
| `authority.mjs` / `host-bus.mjs` | bridge Main 拥有正式 bus；只读移植官方 reference bus/schema（Apache-2.0，65 个源码 hash）；register/workspace/lease/owner/event/stream；短生命周期补充 replay/timer teardown |
| `launcher/index.mjs` | Node 监督器、可取消状态 watch、严格状态端点；只回收自建 detached group，正常 Host dispose 后 TERM/KILL 清余树；不按进程名杀进程 |
| `packages/host/{runtime,index}.mjs` | 既有专用 `/zcode-bridge` 通道 `launcher` 状态/services/watch；BridgeHost `host-backed` 接入点；默认 restricted-cli 和既有 fail-safe 保留 |
| scripts/tests | 42 条新 Node 单测、真实 DSH carrier 集成、installed package 往返、真实 Electron 三种故障注入；[使用说明](../host-launcher.md) |

## 落点断言与运行边界

`R=scratchRoot/runs/<fresh UUID>`。未配置 scratch、已有 R、任何符号链接逃逸、真实 home/`.zcode`/Library root、env/cwd 不一致都在 fork 前拒绝。新 R 是必要条件：官方 InitLocal 会迁移写库，还可能 warm existing tasks，不能把它当只读状态启动。路径既在 Node preflight 断言，也在 Electron Main 中验证实际 env/cwd/`app.getPath`，后者发生在官方 Host fork 之前。

| 域 | 显式绑定 |
|---|---|
| settings | `HOME=USERPROFILE=ZCODE_DESKTOP_HOME_DIR=R/home`；settings 落 `home/.zcode/v2/setting.json`；不继承最高优先级覆盖 |
| tasks/provider/credentials/CA | `ZCODE_DATA_BASE_DIR=R/data-base`；tasks `data-base/.zcode/v2/tasks-index.sqlite`；只记录文件元数据，不读 key/pem/credential 值 |
| session DB | `ZCODE_SESSION_DB_PATH=SESSION_DB=R/session-db/db.sqlite`，独立绝对路径 |
| CLI/default home | `HOME=R/home`；附加 `ZCODE_HOME=R/runtime-home`，不以未证的 ZCODE_HOME 消费作为隔离保证 |
| Electron writable paths | home、appData、userData、sessionData、logs、temp、crashDumps、desktop/documents/downloads/music/pictures/videos 全 scratch；exe/module/resources 属于只读制品 |
| cwd / 内层环境 | Main/utility cwd 和 agentSpawnFallbackCwd=`R/workspace`；runtimeProcessEnvPatch 重新构造，与外层绑定一致；无凭据/proxy/preload 继承；cwd 下仅只读 CLI 资源引用 |
| Keychain/network | 不是“HOME 隔离了 Keychain”：外层 Seatbelt 拒绝真实 home 非必要代码读取、run 外写入、network、securityd/trustd 服务 |
| 安装器 | 最终安装 run 显式 scratch HOME/USERPROFILE、XDG、空 npm user/global config、npm cache、pnpm HOME/store；ignore-scripts；早期安装记录不作为 cache 隔离证明 |

读取根限制涵盖安装后的 pnpm **逻辑 zod 链接和真实目录**，只授予该依赖精确读权限，不放宽它的父目录。官方制品只读引用，不写安装包/ASAR，不复制真实账号材料。官方 Main 的租约与此 Main 无共享协调入口：保持 NO-GO。

## Main 回调覆盖

| 合同 | owner/结果 | 实证级别 |
|---|---|---|
| register/unregister、hostId、workspace keys、deliveryKind | HostAuthority + 官方 bus；更新 visibility、退出清 lease/routes/pending；附加 replay/timer 清理 | 合同单测；真实 fork/InitLocal/exit LIVE |
| task-run-lease acquire/release | workspace identity key、单 owner、runId=traceId schema fencing；stale release 无效 | 合同单测；真实任务 NOT_RUN |
| owner command request/deliver/result | 实际 owner 才能 ack、stale run 拒绝、owner exit 失败；官方 30s timeout，不隐式重试 | 合同单测；真实执行 NOT_RUN |
| realtime publish/deliver | eventId 去重、1000 条有界缓存、workspace 可见性、不回环 | 合同单测 |
| stream op / batch / replay | owner/run gate、seq/batch、水位；60 batch/512KiB replay 界限；gap 和 owner-lost invalidation、两种 deliveryKind | 合同单测（61 batch 截断+watermark）；真实 runtime NOT_RUN |
| database startup relay | 安全字段投影到状态通道，真实 migration→ready | LIVE；retry/control 显式 disabled-s02 |
| attachment teardown | attach 请求带正式 requestId/scope/clientMode；detach 幂等；base port close + Host dispose | 合同单测；base port/exit LIVE；额外真实 attachment NOT_RUN |
| OAuth state/deep-link/browser | 显式禁用回调；不注册全局 URL handler、不打开浏览器、不声称登录可用 | disabled-s03；正式登录 NOT_RUN |
| session routes、session-message、cron/off-peak/browser/CUA | S02 不向 bus 放行可能启动工作的 session 路由；无执行入口 | disabled；session/close/closeSession/closeDeferredDraftSession 从未发出 |

## Provider 请求硬顶

`ProviderRequestGate.dispatchBeforeSend(send)` 在回调执行前同步占用请求预算，limit=0 发包前拒绝；limit=1 的第二次发包被拒绝，第一次 transport failure 仍耗尽预算。单测只用合成 callback，不发送请求。

**这不是已经安装的 provider hook。** 未改动官方 Host 的 request-auth resolver 和 app-server pipe 属于 Host 内部，状态 Channel 没有公开的逐模型请求 transport interceptor。没有把 prompt RPC 数量或 usage 当请求计数。实际状态明确 `installed=false/enforceable=false`，执行面关闭；S04 是 NOT_RUN(cannot-enforce)，不得解锁 1 次任务预算。本节 0 模型请求依据是 fresh scratch、五项 RPC 白名单和继承给全部子进程的 OS 禁网，不依据 gate 的 0 counter 或“没看到 usage”。

## Checks 实跑

证据目录：[host-launcher-s02](../probes/checks/host-launcher-s02/)。最终成功安装链为 `installed-isolated2/`；`installed-bootstrap/` 保留修复后的另一次成功链。更早失败文件没有替换成 PASS。

| 检查 | 结果 |
|---|---|
| 新 Node targeted | **42/42 PASS**，`targeted.log`；配置/落点/codec/lease/owner/event/stream/teardown/request budget/Host-backed |
| bridge Node | **260/260 PASS**，`node.log`，baseline 218 无回退 |
| DSH 集成 | **173/173 PASS**，18 文件，`integration.log`，baseline 172 无回退 |
| DSH native | **1373/1373 PASS**，60 文件，`native.log`；DSH head/文件未变，成功证据沿用该次实际重跑 |
| build / whitespace / lint | **PASS**；build、两仓 diff-check；最终 touched-file lint 0 warning/error（早期 CLI flag 失败单独保留） |
| clean profile install→installed launcher→DSH HTTP→uninstall | **LIVE PASS**；installer HOME/cache/store 全 scratch；自身 zod 声明及 createRequire.resolve 成功；install/remove exit 0；host bundle 包无残留 |
| non-login headless / owned tree / GUI coexistence | 最终两次 Host 各 5 状态 RPC；signed-out、0 executable provider；windows/WebContents/windowEvents=0；自有树全退出；每次 GUI ps 清单一致，仅观察 |
| crash bootstrap | **LIVE 3/3 PASS**：真实 host-bus 的缺失 zod import、uncaughtException、unhandledRejection；均 structured exit 2；fixture native dialog hook=0、windows/WebContents/windowEvents=0；不启动 Host、不发模型请求 |
| official identity | ASAR sha 与 S01 相同；18 Host 文件取 ASAR header integrity、启动逐一验证；CLI digest 与 S01 相同 |

## 失败入账与用户可见事件

详细 [attempt-ledger.json](../probes/checks/host-launcher-s02/attempt-ledger.json) 保留阶段、输出位置、已知结果和未保留的诊断，未把失败覆盖成 PASS。

1. **用户可见无窗口红线事件**：用户报告 `s02-profile-guGfqa` 的 Electron “Uncaught Exception” 原生对话框，`ERR_MODULE_NOT_FOUND: Cannot find package 'zod' ... launcher/host-bus.mjs`。早期 static import 先于 Main handlers，Electron 默认 handler 弹框；因此早期失败 run 的崩溃路径不能宣称无窗口。至少一次对话框由用户确认，其他早期 run 未测得原生对话框次数。
2. zod **不是缺少依赖声明**：基线和当前独立 Host 包均声明 `zod@4.6.5`。隔离策略漏了 pnpm 逻辑链接读权限；policy diagnostic 显示真实 zod package 可读、其 sibling node_modules/zod 链接路径 EPERM。先补精确链接读权限；再加入无 application import 的 CJS bootstrap，先注册 uncaught/rejection handlers并绑定路径，再动态 import Main。最终安装解析证明和上述三条 LIVE 故障测试闭合这两个缺陷。
3. targeted 初轮 9/32 PASS、23 FAIL：macOS tmpdir 的 `/var` 符号链接与 strict schema fixture（traceId/runId、多余字段、stream event 必要字段）。第二轮 30/32；随后 owner-exit fixture误取末尾 invalidation 当 result，31/32。修正正式 schema/查询后通过。前两轮原日志保留；第三轮原输出仅存在执行会话，不伪造独立原始日志。
4. 第一次 LIVE preflight ENOENT：错误猜测 CLI 为 `glm/index.cjs`；官方路径是 `glm/zcode.cjs`。发生在 Electron fork 之前；修正后状态往返成功。
5. 三次 installed pre-ready timeout 均是失败，后续 policy 对照定位上述权限边界。第一次 DSH source check 因 TS subpath alias `ERR_MODULE_NOT_FOUND` 失败，改为既有 DSH source 的明确只读引用后成功。
6. `installed-verified`：standalone launcher 已 PASS，但 DSH runner `ERR_ASSERTION`；旧 runner未保留失败 stage，**不编造根因**。后来补阶段诊断并实际完整重跑成功。
7. `installed-isolated`：官方 GUI inventory 增加 pid 7748/ppid 7415 的 Helper，断言失败。只记录清单差异，没有向其发信号/IPC，没有改检查标准；相同代码重跑 `installed-isolated2` 得到两个清单一致的 PASS。
8. 早期 package install 只绑定了 profile，未显式绑定 installer HOME/cache，无法证明其缓存写入全 scratch；最终修正安装器 env/store/config 并从全新 store实际安装。不声称早期 installer 外部缓存绝无写入。
9. 第一次 lint 使用不支持的 `--disable-plugin` flag 失败；改用该版本的正式 CLI 后通过。中间 unused-expression/unused-vars warnings 已修复；未改官方/reference/DSH 源码。

## NOT_RUN 与后继条件

- **NOT_RUN(cannot-enforce)**：实际 provider 请求级拦截/计数、真实模型请求、S04 硬顶。只交付未来 dispatch seam 的合成验证，不能当正式安装证据。
- 登录状态翻转、OAuth start/poll/callback/refresh、外部浏览器/deep-link 登录、凭据材料解析成功：NOT_RUN；S03 仍需原门禁与真实落点证明。
- 真实 Host runtime/session/command/stream/owner 执行，额外真实 attachment、跨 Main authority、共享真实库或 GUI 写：NOT_RUN；S06 正式协调前保持 NO-GO。
- 新下载/重新安装 Electron：NOT_RUN；本节安装插件到干净 profile，复用 S01 已安装的只读 Electron 41.0.3 并在每次 Main 启动核对版本。非 macOS/sandbox-exec 环境拒绝启动。
- 所有真实 credential/Keychain item 读取、导出、登录 Keychain 写、session close、自动标题、connectivity tester、warmup、流恢复、付费调用：未执行。早期用户可见错误框是明确记录的历史违反，修复后的三个错误路径测试通过。

## 提交与交接

- `773dec7 feat(host): add isolated windowless official Host launcher`（实现、42 单测、身份/provenance generators）。
- `37a1133 test(host): verify installed launcher lifecycle and headless failures`（DSH 集成、installed 往返和 bootstrap 故障测试）。
- 本 handoff、使用说明和实际证据另成 docs Conventional Commit；最终提交 hash 以 `git log` 为准。

主 agent 后续应以当前 code/test head 做独立 A/B bounded review，并如实保持 provider gate 缺口；本实现者未代替 acceptance、未派发评审、未 push。
