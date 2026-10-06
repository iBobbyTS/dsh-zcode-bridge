# official-runtime-install HANDOFF — M0 官方安装连接与执行前提

**自评：PARTIAL。M0 尚未完成，不请求把 official-runtime-install 验收为 COMPLETE。**

任务：official-runtime-install-TASK.md；EXECUTE_WITH_COMMIT。实现者为本次派发 worker；不自行执行 CODE A/B 或父计划 admission。需求合同未修改。付费模型调用 0/1。无 push、无主干 merge、无 reset/clean/pull。

## 候选与提交

- bridge 产品/测试候选：`d658fc3`，feat: add official ZCode headless connection and DSH status plugins；基线 `7bbfce8`。
- DSH 配置提交：`8d7ae201baaf6ce3562440eebdcb7b41d14f29f4`，chore: add local ZCode bridge profile configuration；基线 `da00f7f5358f2949383b35c14f548bc20187d80c`。
- 本 HANDOFF、PROBES、carrier 表和非敏感 check 输出随独立 docs 提交交付；最终 HEAD 以 Git 为准。
- bridge 原有未跟踪 `.DS_Store` 保留。DSH tracked 产品代码无修改，只有 apps/cli/config/examples/zcode-bridge 三个配置/说明文件。两个 reference checkout 均 clean；官方 App 只读。

## 探测结论

| 项 | 结论 | 证据/限制 |
|---|---|---|
| 官方安装 | LIVE 3.14.4 / build 3.14.4.7912；cjs 14,820,968B / fad4c35…6275f | PlistBuddy / SHA-256 / Spotlight / lsof 一致 |
| 实际启动器 | LIVE App 内 ZCode Helper，Electron 41.0.3 / Node 24.14.0 / arm64 | ELECTRON_RUN_AS_NODE=1；actual process text paths 与 launcher 相符 |
| stdio | LIVE NDJSON legacy；capability/list/presentation 真实响应 | 没有添加 jsonrpc、没有虚构 hello |
| controller / hello | controller 三个正式声明均 -32601；hello 是 Host service RPC | CLI、ChannelServer、Electron MessagePort carrier 明确区分 |
| 账号前提 | 此 bridge 无已验证正式 auth provider；实际用户登录状态 UNKNOWN | 未读私有凭据；无模型调用；restricted，不标 available |
| 会话与存储 | 受控空会话进程内可见；EOF 后冷恢复 -32004 | 未证明与 GUI 同一持久 authority；CLI 默认 store 明示 |
| 并存 | 两个自有实例同时只读查询成功 | 不证明同会话并发写；用户 GUI 打开态未受操作 |
| GUI 关闭 | NOT_RUN / deferred LIVE_VERIFY | 必须用户配合；严禁 worker 自行关 GUI |
| 清理 | EOF 正常 exit 0；fake failure/timeout/cancel/dispose 清空 pending | 不发送 session/close；只持有/回收自有 ChildProcess |

完整记录：[official-runtime-install-probes.md](../probes/official-runtime-install-probes.md)；静态 carrier：[carrier-inventory.md](../probes/carrier-inventory.md)。74 legacy、31 V4、7+4 notifications 与 34 commands 的 carrier 层级有记录；该扫描不代表全部协议已 LIVE 通过。

## attach / launch 决策

采用 **launch official packaged app-server with owned headless child**。能在无新增 GUI 窗口的路径上真正交换协议，App metadata、launcher 和 loaded text path 可核对；EOF / plugin dispose 有明确资源归属。正式 provider 配置通过 ZCODE_BUILTIN_PROVIDER_CONFIG_FILE 指向 App 内资源。

不提供 attach：没有已验证、允许外部第三方绑定用户本地官方 Host 的入口。GUI 的 utilityProcess / MessagePort 和 packages/server 的 ChannelServer 不能与 CLI NDJSON 混用。没有通过启动新的官方 GUI 或私有宿主代码来冒充 R12。

本切片只证明官方 runtime carrier 能连。没有把 CLI 默认存储当成已对齐 GUI store，也没有为获得账号权益复制 accountRequestAuthService。正式 Host/auth 路径仍须上级按现有需求解决。

## 实现清单

- installation：Spotlight/明确 App 路径、bundle id/version/build、cjs hash、helper/provider config 可读/可执行检查、Electron Node metadata 自检。缺安装、缺 helper、缺 provider config 可分别解释；未知 tuple 受限。
- ProtocolPeer：有限 NDJSON buffer、UTF-8 分包、严格 id pending ownership、error code、reverse auth 快速负回应、未知 callback -32601、EOF/timeout/abort/dispose 清理。late timed-out response 不复活旧 pending，自动重发不存在。
- BridgeHost：去重 connect、metadata/dispose race 屏障、状态投影、受控 runtime/capabilities→session/list；只回收自己 spawn 的 ChildProcess，EOF 优先、有界 fallback signal。不接受 UI 原始 runtime command。
- Host plugin：既有 authenticated connection.rpc `/api` interceptor，status/connect 两个 endpoint，Cordis effect 撤销与资源释放。没有 DSH factory/loop/hooks/session seam。
- Client plugin：既有 plugins.bundle.config keyed slot；实际版本/hash/launcher/runtime PID、protocol round trip、restricted/auth source 和 sharedSessions unverified。请求代际 fencing 防止断线/卸载后旧 RPC 覆盖状态；页面及 RPC unload 真实测过。
- 本地 bundle profile：现有 dsh.bundle.patch 插入两个插件；DSH 克隆只给配置 override 与安装 manifest。真实 plugin-manager 在临时隔离 profile 安装 file: packages 并登记 bundle 成功，确认 Host/Client export 文件存在，随后删除自有临时 profile。

## checks 实跑

| Check | 命令 / 输出 | Exit / 判定 |
|---|---|---|
| B01/B05/B06 + failure lifecycle + UI generation + real missing helper fixture | `npm test`；[bridge-tests.log](../probes/checks/bridge-tests.log) | 0；11 PASS（fake 不作正式 auth 证明） |
| Client build | `npm run build`；[build.log](../probes/checks/build.log) | 0；仅构建证据 |
| actual official metadata/process/roundtrip | `npm run probe -- <test workspace>`；[official-roundtrip.log](../probes/checks/official-roundtrip.log) | 0；connected=true / restricted / auth unavailable / paidCalls=0 |
| exact carriers | bounded phase-a.mjs；[carrier-live.log](../probes/checks/carrier-live.log) | 0；cap/list/presentation 正常，controller/account 示例 -32601 |
| cold empty test session resume | bounded resume.mjs；[cold-resume.log](../probes/checks/cold-resume.log) | 命令 0；恢复业务 oracle **拒绝 -32004** |
| two owned read-only runtimes | 两 BridgeHost 并行 connect/dispose；[two-clients.json](../probes/checks/two-clients.json) | 0；只读并存 PASS |
| DSH Cordis/slot/official→Host RPC→production slot renderer | `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs`；[dsh-integration.log](../probes/checks/dsh-integration.log) | 0；5 PASS，jsdom 与 fixture connection carrier，非真实 DSH GUI oracle |
| DSH 上游 targeted | `node node_modules/vitest/vitest.mjs run packages/client/ui-settings-agent-loop/tests/apply.client.spec.ts packages/boot/plugin-manager/tests/patch.spec.ts`；[dsh-baseline.log](../probes/checks/dsh-baseline.log) | 0；12 PASS |
| 现有 plugin-manager 真安装 | `node ../dsh/node_modules/tsx/dist/cli.mjs --tsconfig ../dsh/tsconfig.base.json scripts/install-probe.ts`；[plugin-install.log](../probes/checks/plugin-install.log) | 0；最终 pnpm 11.7.0，bundle 登记、export 文件存在 |
| 正式 runtime reverse model auth failure | NOT_RUN | auth 不满足；不为触发 callback 擅自调用模型 |
| 正式账号可用只读任务 | NOT_RUN | 无已验证正式 auth source；0 次模型调用 |
| GUI 完全关闭、真实 DSH GUI/desktop packaged mount、登录/登出、同一 GUI 持久会话恢复与并发写 | NOT_RUN | GUI 红线、authority/auth 未确认；不能用 jsdom/安装成功抵消 |
| CODE A / CODE B | NOT_RUN | 由主 agent 对冻结 official-runtime-install 父边界独立评审；worker 不自评为 clean |

每个 PASS 只覆盖表述的 oracle。此前 tool/build 配置失败、参数拒绝、依赖 hooks 副作用和修复均在 PROBES 中记录；不把失败尝试计为通过。

## Blockers / 待人工点 / PLAN 纠偏建议

1. **正式账号请求 auth source 未验证**：app-server 依赖 Host reverse callback；现有客户端没有可用正式来源。不要把账号已登录或官方安装存在当作 M0 account-ready。需要正式、允许外部宿主使用的 Host/账号接口证据；禁止私有 token、API-key fallback 或复制账号服务。
2. **共享持久会话 authority 未对齐**：当前空会话只证实驻留实例。CLI 默认数据库路径与 GUI authority 没有正式来源证明；冷恢复拒绝。session-directory-lifecycle 不应基于这次空列表/双进程只读 PASS 宣称共享世界可用。
3. **GUI 关闭态需要用户配合**：记为 deferred LIVE_VERIFY。headless 自启本身已通过，但用户现有 GUI 全关闭场景未测，不请 worker 自行操作。
4. **真实 DSH GUI/packaged oracle 未测**：插件实装、production slot renderer 与真实官方响应已覆盖；还需有隔离正式 DSH GUI 环境确认显示、人工入口与卸载，不用截图/HTTP 200 代替会话行为。
5. **环境记录**：DSH 依赖 lefthook 包在根保护脚本之前改写全局 hooks；按日志恢复 pre-push backup 并移除该次生成 hooks，生成文件保留在任务 tmp。今后 source dependency install 应先约束 dependency lifecycle scripts。没有修改上游 protection 或全局 gitconfig。

建议主 agent 在 PLAN 的 official-runtime-install 状态记录 PARTIAL 与上述技术 blockers，保持 requirements 原合同；后继只允许独立测试/文档任务，**不把未证实的正式 auth/shared-session 路径作为 session-create/conversation-runtime 大规模 UI 铺设前提**。不是要求降低 R10/R11/R12/R15。没有证据证明整个正式路径永远不存在，因此没有宣告 requirements 被推翻。

## AC 自评

- 官方安装/运行身份、missing App/helper/config、auth source 缺失分别解释：COMPLETE（该最小切片）。
- 官方受控请求响应到状态 UI：COMPLETE（真实 runtime + 实际 Host 代码 + production DSH renderer 的受控路径；真实应用 GUI 仍 NOT_RUN）。
- headless 自启：COMPLETE；用户 GUI 关闭态：NOT_RUN。
- 正式账号可运行/唯一只读模型任务：BLOCKED by auth source。
- GUI 同一持久会话发现/恢复/并发写：PARTIAL / 未验证；已观察冷恢复拒绝。
- official-runtime-install/M0 总体：**PARTIAL**。提交可供上级独立 review；不代表 acceptance 或 A/B CLEAN。
