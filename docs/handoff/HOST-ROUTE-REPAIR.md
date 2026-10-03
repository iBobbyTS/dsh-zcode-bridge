# Host 专属路由修复 worker handoff

结论：bridge 自身的 Context 归属已修正；真实生产 carrier 仍需 DSH 侧修复 `HostConnectionService.rpc` getter。**本交付不宣称真实 profile 问题已解决，也不宣称浏览器 oracle 已通过。** DSH 产品代码保持只读、工作树无改动。

基线：bridge `7bc10ac`，分支 `feat/zcode-runtime-bridge`；DSH `0f2509d325`。未点击 connect、未启动官方 GUI、模型调用 0。

## 根因与修复边界

1. bridge 的反应式 `ctx.inject(['webServer'], callback)` 创建拥有 `webServer` 权限的子 fiber，但原 callback 捕获外层 `ctx` 来读 `connection.rpc` 并创建 effect。外层只有 `connection` 依赖。修复让子 `webCtx` 持有读服务和注册 effect；runtime 本身仍由父 host fiber 持有。
2. DSH `packages/client/connection/src/rpc-host.ts:86` 的 `get rpc()` 使用 `const owner = this.ctx`。Cordis `vendor/cordis/src/utils.ts:165` 会用 `createShadow()` 包装 service getter 的 receiver；此时 `this.ctx` 是调用方 Context 加服务提供方的 shadow。`reflect.ts:156` 的权限查找以 shadow 指向的提供方 fiber 为准。Connection 的提供方未注入 `webServer`，所以 `register()` 内的 `owner.webServer.register(route)` 仍抛 `cannot get property "webServer" without inject`，即使 bridge 已使用正确的子 Context。
3. 注入子 fiber FAILED（3），父 host fiber ACTIVE（2）；boot 没有父 host 激活错误不能证明其子路由已注册。原 mock 在根 Context `provide('webServer', {})` 且替换 `rpc.handle`，没有覆盖实际 Service getter/shadow 权限路径。

DSH 侧最小修复方向（需主 agent 授权后实施并独立审查）：在 RPC getter 捕获 owner 前去掉服务 getter 的 shadow，保留调用方 Context 的 fiber、依赖和隔离作用域。例如用 Cordis 已导出的 `getTraceable()`：

```ts
const shadow = this.ctx
const owner = getTraceable(shadow, shadow)
```

本 worker 没有把反射/权限绕过 shim 放入 bridge 产品代码，也没有复制 DSH 的认证或 RPC envelope adapter。应在 DSH owner 修复此边界，并检查同类 getter 的 Context 捕获。

## 决定性实验

| bridge | DSH getter | 结果 |
| --- | --- | --- |
| 原实现 | 原实现 | 路由不存在；真实隔离 profile GET 404 |
| 修正为子 `webCtx` | 原实现 | 独立 compiled-lib probe：子 fiber FAILED、POST 404；真实已认证 web profile：POST 405（SPA fallback） |
| 原实现 | 进程内去 shadow 的对照 | 早/晚 WebServer 两项回归都失败（POST 404） |
| 修正为子 `webCtx` | 进程内去 shadow 的对照 | 早/晚 WebServer 两项通过，替换依赖后重新注册、host 卸载后 POST 404、未认证 401 |
| 修正为子 `webCtx` | 真实 web 进程内去 shadow 的对照 | launch token 换 cookie 成功，POST `/zcode-bridge/status` **200 JSON**，reason=`not-connected`；没有 connect |

对照 shim 仅存在测试进程和隔离 HOME 外的本地诊断文件；没有改写 DSH 仓库文件或作为产品修复交付。真实 web 进程通过 `NODE_OPTIONS=--import .../shadow-free-connection-control.mjs` 加载同一对照，随后已停止。原主 agent 的 3080 server 未停止。

注意 HTTP oracle：DSH `rpcFetchHandler()` 只接受带 `client-request` envelope 的 **POST**。即使路由正确，已认证 GET `/zcode-bridge/status` 仍是 404 `not found`，见真实 web 对照证据。不要增加 GET carrier 语义来满足错误的探测方法。

## 可重跑诊断与检查

`node scripts/diagnose-host-route.mjs` 使用 DSH compiled libs、实际 Connection/WebServer 和临时 loopback 端口，对比未修改 getter 与进程内去 shadow 对照。未修上游时 exit 1 是有意保留的未解决 oracle；stdout 不包含 launch token 或 cookie。`DSH_CHECKOUT` 可覆盖默认 `../dsh`。

| 检查 | 结果 |
| --- | --- |
| `npm test` | 45/45 PASS |
| `npm run build` | PASS |
| `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | 25/25 PASS；原 23 项 + 2 项明确以去 shadow 对照隔离上游缺陷的 bridge 回归 |
| `../dsh/node_modules/.bin/oxlint packages/host/index.mjs tests/host-route.dsh.spec.ts scripts/diagnose-host-route.mjs` | PASS |
| `git diff --check` | PASS |
| 未修改上游的 compiled-lib oracle | FAIL，子 fiber 权限错误，POST 404（未解决） |
| 未修改上游的真实隔离 web oracle | FAIL，认证后 POST 405（未解决） |
| 真实隔离 web 的进程内 getter 对照 | PASS，认证后 POST 200 / JSON |
| 浏览器横幅主 agent 复验 | NOT_RUN；须先修 DSH getter 后重新安装 bridge profile 副本 |

证据：[独立路由诊断](../probes/checks/host-route-diagnostic.json)、[真实 web 对照](../probes/checks/host-route-web-control.json)。测试中的 shim 是上游前提的对照，不能将 25/25 解释为真实 profile 已通过。

隔离启动须**同时**显式设置 HOME 和 DSH_HOME（本环境已有 `DSH_HOME=/Users/ibobby/.dsh`）：

```sh
HOME=/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/host-route-web-home \
DSH_HOME=/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/host-route-web-home/.dsh \
node apps/cli/lib/bin.js web \
  --patch /Users/ibobby/Projects/dsh-zcode-acp/dsh/apps/cli/config/examples/zcode-bridge/cordis.patch.yml \
  --port 3081 --no-open
```

`--patch` 必须在应用参数 `--port` 前，否则 launcher 将后续参数交给 web 应用并报 unknown option。

## 环境操作疏漏记录

最初只覆盖 HOME，未检查继承的 DSH_HOME，导致一次 plugin add 和一次 3081 boot 触及 `/Users/ibobby/.dsh/profiles/web`。已停止误启进程、移除本次新增的 `@dsh-zcode/bridge` 依赖及其 bundle；未发送任务、未点击 connect、未启动 GUI。boot 自动重写了该 profile 的 `cordis.yml`/`cordis.patch.yml`；缺少操作前快照，不能保证这两项已逐字节恢复，也不能声称完全未触碰真实用户 profile。后续所有 profile 实验均同时设置了两项隔离变量。
