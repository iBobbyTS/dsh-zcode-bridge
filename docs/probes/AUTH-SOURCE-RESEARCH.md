# 归档说明

本文件为『正式 auth 来源有界研究』报告原文（研究 worker：external codex/gpt-6.1-sol/high，agent_id 10000544，session 01a10106-719f-7903-8ba9-be4e90fb1c71，2026-10-03 COMPLETED）。研究全程只读（未联网、未访问 ~/.zcode、未操作 GUI、未启动 runtime、0 模型调用），报告经 final_text 交付，由主 agent 机械归档。判定：**BLOCKED-NEEDS-DECISION**——conversation-runtime/M0"可运行"部分的解锁路径需要用户决策（见问题四选项表）。


# 正式 auth 来源有界研究报告：conversation-runtime/M0 解锁判定

## 执行摘要（8 行）

1. **判定：BLOCKED-NEEDS-DECISION**；当前既定接入路径缺少符合合同的正式账号鉴权来源，M0"可运行"部分未解锁。
2. **修正关键推断：CLI stdio 可以承载 auth 反向请求，也允许持有该管道的外部进程应答。**
3. `controller/hello`、`account/status` 返回 -32601，不能证明 auth 反向回调不可达。
4. 官方 Host 自动解析账号材料并经 CLI stdio 回传；解析器是 Host 进程内能力，明确不暴露为通用 RPC。
5. ChannelServer 支持独立服务客户端；官方桌面 GUI 使用 window-scoped utilityProcess/MessagePort，未找到第三方附加到该 Host 的正式入口。
6. 环境变量、provider schema 和 app-server 启动参数没有外部账号解析器声明；配置路径与账号 overlay 不能提供请求鉴权材料。
7. `feat/ui-plugin` 增加页面桥、sampling 和沙箱能力，没有增加插件账号 API 或外部 auth provider；sampling 仍依赖既有鉴权。
8. 全程只读、未联网、未访问 `~/.zcode`、未操作 GUI、未启动 runtime、模型调用为 0。

## 研究对象固定身份

| 标记 | 对象 |
|---|---|
| `@29628c9` | reference/ZCode（29628c9acdb81b703bbd4080c207a0e7ce5e276e） |
| `@662c30be` | 本地 origin/feat/ui-plugin（662c30bea4e833acaacbfb745a65eb09c23d55f8） |
| `@722a8b5` | 读取 official-runtime-install 文档时 bridge HEAD |
| `B-CJS` | App 3.14.4 glm/zcode.cjs（sha256 fad4c35c…d1e6275f） |
| `B-ASAR` | App 3.14.4 app.asar（sha256 232e913ea13d60bd0ecc86bf9f2f145328809608fe4d48e76685d61a8076aef0） |

## 证据表（研究 worker 原文）

| ID | 证据锚点 | 确认内容 |
|---|---|---|
| E01 | apps/zcode-cli/packages/bootstrap/src/zcode-protocol/provider-runtime-headers.ts:19–95@29628c9 | auth 端口调用 context.requestClient；180 秒时限、取消通知、失败处理 |
| E02 | …/zcode-protocol/server.ts:406–419,805–932@29628c9 | 输入 response/error 结算反向 pending；生成 server-N id、输出请求、校验结果 |
| E03 | …/zcode-protocol/transport.ts:60–77,156–169@29628c9；zcode-protocol-entrypoint.ts:310–320@29628c9 | NDJSON 双向连接；response 绕过普通请求队列；反向消息 sink 接同一输出 |
| E04 | packages/shared/src/zcode-protocol/index.ts:2381–2433@29628c9 | challenge、取消和 response 的严格 schema |
| E05 | packages/services/src/zcode-agent/zcodeAgentService.ts:1258–1313,1861–1890,2112,2245–2291@29628c9 | Host 监听 reverse request、自动解析与应答；缺解析器快速失败、取消归属检查 |
| E06 | packages/services/src/node.ts:660–664,1494–1515,2085–2089,2614@29628c9 | 账号服务创建、注入和进程内侧表；明确不暴露到通用 RPC |
| E07 | packages/services/src/model-provider/accountProviderRequestAuthService.ts:34–84@29628c9 | 按当前 account access 解析 Start、Individual、Team 材料 |
| E08 | packages/services/src/zcode-agent/zcodeAgentProcessManager.ts:412–434,1019–1037@29628c9 | 官方 packaged cjs 用 Electron Node 模式运行；子进程使用 pipe stdio |
| E09 | packages/desktop/src/main/desktopHostProcess.ts:257–279,714–729@29628c9；packages/desktop/src/host/index.ts:185,1986–2046,2295–2303,2729–2754,2838–2852@29628c9 | utilityProcess、Main 转移 MessagePort、Host 初始化和 attachment |
| E10 | zcodeAgentConnectionScope.ts:205–226,668–683@29628c9；packages/rpc/src/channelServer.ts:22–40,68–90@29628c9 | Channel 初始化及 service hello；V4 hello 的 auth:{} 不提供模型账号材料 |
| E11 | packages/server/src/http.ts:86–120,298–346,466–473@29628c9；hostCapability.ts:4,17–50@29628c9 | HTTP/WS 监听、通道暴露、访问 token、terminal/trusted-host 角色及一次性 capability |
| E12 | packages/server/src/entry-stdio.ts:39–73,90–94@29628c9；stdio.ts:56–73@29628c9 | server stdio 先 hello/ack，之后 SocketProtocol/ChannelServer；与 CLI NDJSON 不同 |
| E13 | …/app/process-provider-registry-runtime.ts:33–58,149–173@29628c9；zcode-protocol-entrypoint.ts:154–160@29628c9 | standalone 可装配凭据来源；app-server 不传 standalone |
| E14 | …/app/standalone-account-provider-runtime.ts:169–205@29628c9；packages/cli/src/prompt-command.ts:200–225@29628c9 | Prompt CLI 的直接鉴权端口；要求 Individual Coding Plan |
| E15 | packages/provider-node/src/runtime-paths.ts:1–30@29628c9；…/config/env-config.adapter.ts:14–62@29628c9 | provider 路径变量及 runtime 配置环境变量消费面 |
| E16 | packages/provider/src/config/provider-data-schema.ts:30–94@29628c9；config/schema.ts:26–30,59–67@29628c9；rule-data-schema.ts:108–120@29628c9 | provider access 类型有限；account overlay 仅成员/权益；固定账号 access 不可由 Personal 覆盖 |
| E17 | …/zcode-protocol/account-provider-config.ts:12–30@29628c9；app/types.ts:145–151,730–745@29628c9；packages/cli/src/arguments.ts:3–109@29628c9 | overlay 与请求材料分开；App 内部 DI 有端口，协议入口和 CLI 参数没有外部 auth provider 声明 |
| E18 | …/model/runner.ts:163–189@29628c9；packages/core/src/runtime/methods/model-runtime-headers.ts:25–65@29628c9 | 普通账号模型使用调用期端口；Off-Peak 使用注入 source；API-key 模型不消费账号端口 |
| E19 | UI_PLUGIN.md:16–32,335–363@662c30be；plugin-ui-bridge/CONTRACT.md:3–14@662c30be | UI Plugin API、桌面本地范围、既有 Agent sampling |
| E20 | plugin-ui-bridge/instanceAccounts.ts:5–38@662c30be；packages/services/src/node.ts:1682–1689@662c30be | accountContext 来自 Host 账号事实哈希，用于实例绑定及撤销 |
| E21 | packages/ui/src/plugin-ui/domain/buildPluginUiHostCapabilities.ts:9–50@662c30be；…/methods/sample-model.ts:67–87@662c30be | 页面能力无账号解析器；sampling 继续调用原 runtime headers 刷新 |
| E22 | packages/desktop/src/host/hostDatabaseStartup.ts:45–88@29628c9；host/index.ts:2780–2800,2824–2852@29628c9 | 自建 Host 包装会进入官方存储准备、服务装配及 settings migration 路径 |
| E23 | dsh-zcode-bridge/docs/probes/official-runtime-install-probes.md:23–35,53–55@722a8b5；official-runtime-install-HANDOFF.md:30–36,60–70@722a8b5 | 既有 -32601 探测、auth source 未验证、模型 auth LIVE 未运行 |
| B01 | B-CJS 静态字符串/代码位置 | 方法字符串偏移 787239；实际 auth requestClient 调用附近 14434416；反向请求准入错误附近 14667785 |
| B02 | B-ASAR 文件表及 package.json | version 3.14.4、main out/main/index.js；存在 out/host/index.js（1,498,022B），未发现独立产品 server/core CLI 入口 |

## 问题一：auth 反向回调载体与注册者资格（结论）

**CLI stdio 可以由外部进程应答。源码推翻了"auth reverse callback 在 CLI stdio 不可达"的概括。**

链路：账号模型请求 → runtime ProviderRuntimeHeadersPort → context.requestClient(interaction/requestProviderRuntimeHeaders) → 同一 NDJSON stdout 发出 server-N 请求 → 管道另一端写入带同一 id 的 result/error → server 结算 pending 并校验 response schema。E01–E04 + B01（安装包实际代码）。

载体枚举（7 条 + 2 排除）：
1. **CLI app-server NDJSON stdio**——持有管道的外部进程即可应答（无官方 GUI 身份检查、无单独注册握手）；能应答协议，本身不提供官方账号材料。
2. **Host service 自动处理**——同进程装配者注入 IAccountRequestAuthService；官方自动路径。
3. **Electron MessagePort/ChannelServer**——模型 auth 在 Host 自动完成，不把 challenge 交给 Renderer；另一个 Electron 宿主可在自己进程树构造同类拓扑。
4. **packages/server SocketProtocol stdio**——外层服务载体，内部 Host 仍自动应答。
5. **HTTP/WebSocket ChannelServer**——正式外层服务客户端路径（/ws terminal-client；/ws/host 一次性 capability + TTL 30s；可配访问 token）；不暴露 accountRequestAuthService、不委托 auth challenge。
6. **Standalone Prompt CLI/TUI 直接端口**——官方 standalone bootstrap 装配 credential store + account source + 直接 headers port；当前端口要求 Individual Coding Plan；**app-server 不传 standalone**。
7. **同进程嵌入/Off-Peak source**——代码层 DI 能力，非 cjs 命令行外部声明。
排除：API-key provider（合同排除替代官方账号）；requestOfficialMcpAuthHeaders（独立 MCP 身份头，非模型账号出口）。

精确边界：应答=向管道写 {id,result|error}（不是调用同名 request method）；成功需 headersApplied:true+requestAuth 对象；180 秒时限；response 绕过普通请求队列防死锁；**requestAuth.apiKey 是官方 wire 字段（Start Plan JWT/Individual/Team 材料也装入该字段），不能因字段名判为 API-key fallback**。

**对 official-runtime-install 记录的修正**（研究建议，主 agent 已采纳为 PLAN 纠偏）：controller/hello 与账号示例 -32601 仍成立（只排除那些主动 request 方法）；应修正为——"CLI stdio 的 auth 反向请求与应答在源码及安装包中可达；现有 bridge 缺少符合合同的正式 auth 材料来源，真实模型鉴权尚未验证。"不改变 official-runtime-install PARTIAL / M0 未完成。

## 问题二：正式外部宿主路径（结论）

**问题二(a) 协议应答可行；正式官方账号来源未找到。** 账号解析器明确是 Local Host 进程内能力：getAccountRequestAuthService 从 WeakMap 取实例，注释明确"不随 ServiceCollection 暴露到通用 RPC Channel"（E06）；无远程注册/材料解析频道。资格边界来自装配与进程内持有，不是 GUI/签名身份检查——"代码可构造性"与"合同允许的产品接入"是两个结论。

**问题二(b) 独立服务客户端路径存在；官方桌面 Host 的第三方附加入口未找到。** 桌面拓扑：Main → window-scoped Host utilityProcess → Main 转移 MessagePort → Host service → 自有 app-server NDJSON stdio（E08–E09）。ChannelServer 不做 TCP/Unix listen；桌面 reload/remote attachment 端口均由官方 Main 新建转移，非外部可连端点。独立服务入口正式条件：通用 HTTP server（默认 3030、可配 ZCODE_SERVER_AUTH_TOKEN）、Trusted Host WS（一次性 capability）、zcode-server-cli Core（loopback-only）、server stdio——这些客户端使用所在 server 的账号 authority，不向官方 GUI 请求 auth 材料。**安装包 ASAR 无独立 server-core/server-cli/zcode-server 启动制品（B02）**，不能把"源码有 HTTP server"当成"当前桌面 App 对外监听"。

**问题二(c) 当前 app-server 无外部账号解析器声明接口。** Provider 路径 env 只定位配置；runtime config env 无账号解析器键；ZCODE_CREDENTIAL_SECRET 属官方凭据加密 adapter；provider schema access 仅 API-key 两种 + 固定 zhipu-account（无外部回调地址/模块/命令字段）；provider/updateAccountConfig 只同步 overlay/状态；CLI 参数无 auth-source/standalone 开关；RunZCodeProtocolAgentOptions 无账号 source；官方 standalone login/Prompt 不能让 app-server 自动消费其账号 store。

## 问题三：feat/ui-plugin 官方方向（结论）

新增宿主—插件接口（页面桥、sampling、沙箱、Gen UI），**没有新增插件模型账号 API、auth provider 注册器或外部宿主账号桥**；sampling 透传到已存在 Agent 并调用原 runtime headers 刷新——消费已有鉴权，不提供鉴权来源。instanceAccounts 的 accountContext 是 Host 账号事实哈希（实例绑定/撤销用），instance token 不能回应模型 auth challenge。核心 auth/server 路径 29628c9..662c30be diff 零修改。**单纯等待该分支发布不会消除 blocker。**

## 问题四：判定与人工选项（研究 worker 原文）

### 判定：BLOCKED-NEEDS-DECISION

对象是当前官方安装包、现有接入方向和 R01/R12/R15 合同下的 conversation-runtime/M0 可运行部分。理由：双向协议已存在且外部 stdio 应答可行（阻塞不在 framing/carrier）；官方账号 producer 在 Host 内部未作通用 RPC source；当前 bootstrap 无 standalone/外部 auth provider 声明；独立 server/同进程 DI/安装包 Host 模块构成候选路线但不能直接归为已接纳路径；未发布 UI Plugin 不提供来源。**该判定不是"第三方技术上永远无法使用官方 runtime"。**

### 候选选项与合同相容性

| 选项 | R01 | R15 | R12/其他 | 研究评价 |
|---|---|---|---|---|
| 等待官方外部 Host/账号接口 | 可继续用安装包 runtime | 若官方明确提供授权 broker 可满足 | 需无窗口生命周期支持 | 保留合同最直接；无交付时间证据 |
| 自建 Electron 宿主仅包装官方 cjs | 符合来源要求 | **不自动获得账号来源**；仍缺 producer | 可无官方窗口 | 只加包装不解锁 auth |
| **自建 Electron 宿主复用安装包 out/host/index.js** | 模型执行仍为未改动官方 cjs，可与"自己的 OSS runtime"区分 | 官方 Host 自己解析材料、bridge 不导出秘密，有相容解释空间；依赖内部初始化协议 | 可构造无窗口拓扑；须处理官方存储准备/并发 authority/Main 回调 | **有结构性候选证据（E06/E09/B02），未获合同接纳、未验证可运行** |
| 使用另一个官方独立 Web/server 发行包 | 是否属 R01"官方安装包中的 runtime"需确认 | 服务自持账号 authority | 需确认正式制品 | 源码有正式拓扑；当前桌面安装包无对应入口 |
| 缩小 conversation-runtime 到协议层及受限状态 | 相容 | 相容 | 可推进 codec/失败/取消/恢复检查 | 部分交付；M0/M1 真实模型任务仍未完成 |
| 依赖官方 GUI 在线附加 | 可相容 | 可相容 | 当前无第三方入口证据；与 R12 冲突 | 非直接解锁路线 |
| 等待 feat/ui-plugin 发布 | 仍需制品核验 | 当前 diff 无账号接口 | 限定桌面本地页面 | 当前证据不支持解锁 |

复用安装包 Host 的两种做法必须区分：复用官方制品及初始化合同（InitLocal + transferred MessagePort，自动装配官方账号服务，无证据要求 GUI 窗口）vs 复制/改造 OSS Host 或 resolver（进入排除项，不是同一方案）。前者仍有实质判定点：Host 初始化会准备任务/session 存储并创建带迁移的 settings 服务（E22），对"不得自己运行数据迁移"的解释、R15 对内部 Host 初始化的允许范围及 R10/R11 authority 均不能由 worker 决定。

### 对 SFD 台账的建议表述

> 正式 auth reverse callback 可经官方 app-server NDJSON stdio 由持有管道的外部客户端应答。当前 bridge 缺少符合 R15 的正式材料 producer，M0 可运行部分仍 BLOCKED-NEEDS-DECISION。安装包 Host 复用存在结构性候选，需合同判定及有界验证；不以协议可达、账号 overlay、UI sampling 或空会话探测宣布解锁。

## 搜索覆盖与验证限制

"未找到"范围：发布源码全树符号搜索（accountRequestAuthService/创建获取函数/requestProviderRuntimeHeaders/providerRuntimeHeadersPort/requestAuth 及 auth/source/provider 族）+ 生产装配/模型 adapter/子任务端口追踪；CLI 参数/协议入口/process registry/env adapter/shared runtime env/provider-node 路径/provider schema/overlay schema；RPC ChannelServer/ServiceCollection/server HTTP/stdio/Core/桌面 Main/Host/reload/remote attachment/provisioning；feat/ui-plugin diff 文件清单+核心 auth 路径差异+UI_PLUGIN 文档+插件 bridge/account binding/capability/沙箱 preload/sampling 刷新链；安装包 Resources 路径+ASAR 全文件表+入口元数据+cjs 实际反向请求代码。未读取任何凭据值、未访问 ~/.zcode；账号登录/套餐/entitlement 状态 UNKNOWN；未改文件/未构建/未执行登录或模型任务。
