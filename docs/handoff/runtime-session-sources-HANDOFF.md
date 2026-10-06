# runtime-session-sources HANDOFF — Runtime Session sources and native preservation

**自评：PARTIAL。最小来源契约、native 保持、只读官方摘要、隔离及释放检查已完成；正式 ZCode 创建/继续与完整新建双 runtime B02 oracle 仍依赖 official-runtime-install 前提。**

执行模式：EXECUTE_WITH_COMMIT。仅两仓 `feat/zcode-runtime-bridge` 分支；未 push、未合主干。付费模型调用 0。未操作官方 GUI、未写 App/reference 仓、未读取或保存凭据值。此交接不是父节双审或 acceptance。

## 候选与基线

| 仓库 | 冻结基线 | 本节提交 |
|---|---|---|
| DSH | upstream `da00f7f5358f2949383b35c14f548bc20187d80c`；任务起点 `8d7ae201baaf6ce3562440eebdcb7b41d14f29f4` | `8fae3d701a`：runtime-addressed Client 契约/native adapter/seam 文档；`3055d244b8`：例子 package 改名与双语对 |
| bridge | `1d53825` | `d37ee29`：Host/Client 来源、B02、正确 factory 构建与 client package 改名；本交接与 check 输出随后独立 docs 提交，最终 HEAD 以 Git 为准 |

DSH 产品改动仅 `session-controller/src/client/contract/source.ts` 与 `/client` 入口的新增导出；没有修改 native loop、persistence、factory、ClientSessions 原实现、ui-session 原实现或 module resolver。例子配置与文档另组提交。bridge 原有未跟踪 `.DS_Store` 保留。

## 主 agent 裁决与接入修复

1. 使用 `@dsh-zcode/bridge-client`，避开 `stripClientSuffix('@dsh-zcode/client')` 将 package 名当作 `/client` export 剥离的问题。同步修改两仓 manifest、bridge lockfile、bundle patch、构建 id、install-probe、测试及消费者。DSH resolver 产品代码改动为 0。历史 official-runtime-install 安装日志保持原样。
2. bridge 生产 `./client` artifact 改为 DSH 的 classic-script `__ModuleLoader__.load({id,factory})`，通过 module-table `require` 获取已安装 DSH API。ESM `client-test.mjs` 仅用于 Node/jsdom 测试。真实 ClientModuleSystem + Loader 已验证 factory、来源和页面注册，以及 entry 移除后的释放；原失败 oracle 转绿。失败输出保留在 [before-rename](../probes/checks/runtime-session-sources-client-mount-before-rename.log)。
3. DSH `docs/seam/upstream.json` 使用 release tag `dsh-v0.2.0-rc.2`，裸 head 只记在本仓交接。**实际本地 tag 指向 `639ed015397290b3745d163aafe02ffee4aa3f84`，不是 `da00f7f…`；已核验它是冻结基线的祖先。** 没有移动 tag，也没有把它称为精确冻结 commit。精确基线见上表，release 身份见 DSH seam metadata。
4. 补齐触碰文档及 official-runtime-install 示例的中文 counterpart、language switcher 与 pairing record；示例安装/配置语义保留。最终 doc-sync 42/42，包括 pairing 与 repository references，均通过。

## 实现与最小契约

- DSH [source contract](../../../dsh/packages/api/session-controller/src/client/contract/source.ts) 定义 `SessionRuntime`、`RuntimeSessionAddress`、`RuntimeSessionKey`、`RuntimeSessionSummary`、`SessionSourceAvailability`、`NativeSourceReference`、`ZCodeSourceReference` 与 `RuntimeSourceReference`；从 `@deepseek-ai/dsh-api-session-controller/client` 导出。
- 地址固定 runtime/authority/workspace/upstream sessionId；UI key 是 `dsh-source:` + JSON tuple，不能当 native SessionId。地址 parser 在 wire/保存引用处验证并冻结；未知/异常 binding 拒绝。旧 native id 显式经 `legacyAddress` 解析，不查当前创建默认值，不改旧日志。
- `createNativeSessionSource` 只适配已安装 `ISessions`。native create、refresh、retain 原样委托；`NativeSourceReference.native` 就是原 `SessionReference`，保留 ready、binding、Context、event source、prompt、queue 与 reference lifetime。没有第二个 factory 或执行历史。
- bridge [RuntimeSessions](../../packages/client/sources.mjs) 暴露统一只读 list、ZCode availability、显式 runtime 的 create、retain、refresh、只读 refreshAddress 和 async dispose。它经既有 `sessions` injection 提供 `ctx.runtimeSessions`；没有 source registry、actor、DB 或通用 agent 平台。接口声明在 [sources.d.ts](../../packages/client/sources.d.ts)，creation-defaults-visibility 使用 `@dsh-zcode/bridge-client/sources` 的 type import 与 Cordis 服务，生产 UI 不直接构造另一个 adapter。
- native authority 是浏览器 Host origin，workspace 是 `native-session-store`；cwd 仍为摘要字段。ZCode authority 是 `official-headless:<owned-process nonce>`，workspace 是 Host 核验的规范目录。该地址只承诺当前自有进程，**不声称 GUI shared storage 或冷恢复可用**。进程替换不重写旧地址；Host 拒绝旧 authority/workspace。
- Host 新增认证 carrier endpoint `zcode-bridge/sessions`，仅接受可选地址查询，经既有 BridgeHost/ProtocolPeer 直通官方 `session/list`。定向查询发送 `sessionIds`；native/错 authority/错 workspace 在发官方请求前拒绝。没有 raw command、resume、create、prompt、权限、mode 或 queue endpoint。
- ZCode 引用只有固定地址、只读 summary/availability 和 release，不带 DSH Context、SessionFace、events 或 prompt。当前 state 保持 restricted/unavailable；create/open-for-execution/nativeAgent 三个 capability 均 false。ZCode `create` 在路由处报 `zcode-source-not-ready`，不会 fallback。running 为 unknown，不把官方 status 猜成 DSH loop 状态。
- 后发读取与 connection generation 阻止旧响应覆盖；断线撤回 ZCode rows，保留引用身份。release/adapter unload 移除监听，释放持有引用，abort 并等待官方读取 settle；Host fiber 独立等待其自有 child 退出。没有 session/close，也没有触碰用户 GUI 进程。

Consumer 清单、类型 owner、上游 release 身份和可移除条件随 DSH seam commit 记录于 [seam reference](../../../dsh/docs/seam/zcode-runtime-source.md)。没有 SessionEventMap/持久化类型变更或 model-visible 输入，无需 Session-format acknowledgement；没有新增执行 transcript snapshot。bridge 包未发布，所有本地消费者已更新；没有已发布 DSH API 改名。

## 同一 B02 fixture 与 creation-defaults-visibility 消费约束

共享 fixture：[tests/fixtures/b02.mjs](../../tests/fixtures/b02.mjs)。`B02.D1` 与 `B02.Z1` 均为 `same-id`，但 runtime 与 authority 不同；初始默认 zcode，改为 native 后保存的 Z1 key/address 仍走 ZCode。unknown binding 拒绝，legacy id 显式 native。creation-defaults-visibility 复用这个 export，不另造一套身份数据。

本节 producer fixture 使用明确测试 catalog 响应。它覆盖同名 ID 分离、默认值只用于 create 入参、Z1 固定地址重新 retain/查询、D1 native path、未知 binding 与不可变地址。**受限 ZCode 的新建按拒绝验证；fixture 中 Z1 是上游测试目录行，不是伪称经统一 GUI 创建成功的官方 Session。** 正式完整 B02 新建 Z1/D1、设置持久化、重启、真实统一侧栏/会话区域 oracle 归 creation-defaults-visibility/父节，并仍受 official-runtime-install 的 auth/偏好 callback/shared authority 前提限制。

creation-defaults-visibility 的具体 owner 与操作约束：

| 消费点 | 本节提供的契约 | B 的工作 |
|---|---|---|
| 创建与 settings | `RuntimeSessions.create({runtime,...nativeOptions})`；ZCode 明确拒绝 | 用既有 settings 保存默认，仅给新建传入；受限入口显示未就绪，不标 available |
| sidebar/导航 | `list` 的 `RuntimeSessionSummary.key/address` | 用完整 key 寻址；logo/tooltip 本地化、可访问；不能把 upstream id 直接放进 native route |
| 当前会话/UiSession/Conversation | `RuntimeSourceReference.runtime` discriminant | native 分支才把 `.native` 交给现有 SessionProvider；ZCode 切换必须卸载前一个 native Provider，不能合成 native binding/SessionSnapshot |
| 能力控件与插件 | foreign ref 无 Agent Context/权限/mode/queue | 按 availability 隐藏或禁用 native-only 控件；不能调用 root `ctx.sessions` 打开 foreign id |
| 恢复与错误 | address/key parser、`legacyAddress`、`refreshAddress` | 恢复不读默认；错地址保持 ZCode 身份并解释拒绝；不猜 storage，不重绑另一个进程 |
| 生命周期 | source subscribe disposer、reference.release、async adapter dispose | UI owner 持有并释放每个引用/订阅；使用已注册服务，不再注册 factory/source adapter |

## Checks 实跑

所有以下最终检查均 exit 0；表内链接保留实际 command/output/exit。pnpm 脚本使用 `pnpm_config_verify_deps_before_run=false` 防止 pnpm 11 在 run/exec 前隐式执行 dependency install；未关闭产品 sandbox 或质量门禁。

| 检查 | 命令与输出 | 结果与范围 |
|---|---|---|
| bridge build | `npm run build`；[log](../probes/checks/runtime-session-sources-bridge-build.log) | PASS；生产 classic factory 与 ESM 测试 artifact |
| bridge 单测基线 | `npm test`；[log](../probes/checks/runtime-session-sources-bridge-unit.log) | 12/12 PASS；ProtocolPeer、failure、child lifecycle 保持 |
| bridge DSH 集成 | `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs`；[log](../probes/checks/runtime-session-sources-bridge-integration.log) | 14/14 PASS；official-runtime-install 6 + runtime-session-sources 8；含真实 ClientModuleSystem/Loader factory、B02、native route-entry hook/tool/prompt 桩 0、旧响应 fencing、dispose、真实官方 Host RPC→source |
| native 全量 owner 回归 | `node node_modules/vitest/vitest.mjs run packages/api/session-controller/tests packages/client/ui-session/tests`；[log](../probes/checks/runtime-session-sources-dsh-native-regression.log) | 44 files / 934 tests PASS；包括 native create/reopen、原 binding/原 prompt path、同 owner 既有测试 |
| Client 类型检查 | `node node_modules/typescript/bin/tsc -b packages/api/session-controller/tsconfig.client.json`；[log](../probes/checks/runtime-session-sources-client-typecheck.log) | PASS；依赖 Host generated declarations 已建立 |
| owning Client artifact | `node node_modules/tsdown/dist/run.mjs --config-loader native --filter @deepseek-ai/dsh-api-session-controller/client --env.DSH_BUILD_FACE client`；[log](../probes/checks/runtime-session-sources-dsh-client-build.log) | PASS；新 public /client exports 编译为 owning bundle |
| oxlint 全仓 | `pnpm run lint:contracts-ready`；[log](../probes/checks/runtime-session-sources-dsh-oxlint.log) | PASS；没有放宽 lint 规则 |
| 文档全量门禁 | `pnpm run doc-sync`；[log](../probes/checks/runtime-session-sources-doc-sync.log) | 42/42 PASS，0 skip |
| 实际 plugin-manager 安装 | `node ../dsh/node_modules/tsx/dist/cli.mjs --tsconfig ../dsh/tsconfig.base.json scripts/install-probe.ts`；[log](../probes/checks/runtime-session-sources-plugin-install.log) | PASS；改名包与两个 export artifact 存在，临时 profile 已释放 |
| 官方最小来源 probe | production BridgeHost connect/listSessions/dispose；[exact invocation](../probes/checks/runtime-session-sources-official-source.log) | PASS；官方 3.14.4、自有 headless、restricted、sharedSessions unverified、0 model calls、dispose 完成 |
| whitespace | 最终两仓 `git diff --check` 与 staged `git diff --cached --check` | PASS；仅明确列出的文件 staged；build log 以 JSON 保留原始 stdout |

真实模型执行、真实 GUI 创建/恢复/默认值重启、同官方 GUI 的 shared durable Session、用户 GUI 关闭态、正式 installed native agent-side hook oracle、GUI/GIF/recorded-session producer oracle：**NOT_RUN**，原因是 official-runtime-install 未验证 auth/shared authority 与 GUI 红线，且 creation-defaults-visibility 拥有 GUI。这些没有被 mock PASS 替代。

## 环境与先前失败

- native 既有 suites 最初被 `bundleRoster` 的本地依赖搜索阻止：bundle 自引用不在其搜索路径。加入 ignored `node_modules/@deepseek-ai/dsh-web-app -> ../../packages/bundle/web-app` 测试环境链接后全量通过；未改 resolver/manifest 产品逻辑。该链接保留供后续本机复测，未提交。
- 一次 `pnpm exec vitest` 自动触发 install，根 postinstall 拒绝改写全局 hooksPath。检查确认 `.gitconfig` hooksPath 和既有 `.githooks` 文件未变化；没有额外生成 hooks 或 backup。后续直接调用已安装工具/明确关闭 run 前的 install，安装 probe 仍使用 `--ignore-scripts`。没有修改 DSH lockfile。
- 首轮 fixture 使用 `/var` 而 Host 使用 canonical `/private/var` 导致 sessions-invalid；修正 fixture 从实际请求读取 workspace。首次 VM producer fixture 缺浏览器 AbortController；补真实 platform seed。source 新代码的初次 lint 指出 any-array destructuring、non-null assertion/arrow parens；已修复，最终全仓 oxlint PASS。
- 首轮 doc-sync 40/42：official-runtime-install 示例缺双语对、固定 hash 与门禁冲突。主 agent 的 tag/配对裁决已落实，最终 42/42。尝试按文档技能 fetch 时 DSH 无 origin，未 fetch/pull/移动基线；使用任务冻结 checkout。没有隐藏失败检查或重写其历史结果。
- 归档 docs commit 前，staged whitespace 检查指出 tsdown stdout 的尾空格；worker 漏拦了这次提交。随后将该日志的完整原始 stdout 编码为 JSON（字符未丢弃），以独立后续提交修正，并单独确认 staged/worktree whitespace 通过。

## 剩余阻塞与父节纠偏

1. 正式 ZCode auth source、create/resume 所需正式偏好 callback、GUI shared durable authority 仍由 official-runtime-install/后续 owner 解决；本节不能把安装存在或只读 round trip 当成执行可用。当前 native 可继续使用，ZCode 入口必须未就绪。
2. 当前 ZCode process authority 不能支撑跨进程恢复已存 GUI Session。后续必须先取得正式稳定 authority 的证据，再决定兼容；不能把冷恢复拒绝或 nonce 改变当成迁移到 native 的理由。
3. creation-defaults-visibility 可以消费已冻结的 types/fixture 并实现安全 UI，但完整父级新建 Z1/默认重启/共享世界 oracle 不能只靠本节 mock 或 factory mount 宣告 COMPLETE。用户 GUI 操作与正式账号前提若需人工，留给父节安排。
4. 主 agent 需在 PLAN 记录本地 tag 实际 head 与冻结基线不同；没有调整需求、tag 或 reference checkout。本 worker 未执行独立 A/B 评审。
