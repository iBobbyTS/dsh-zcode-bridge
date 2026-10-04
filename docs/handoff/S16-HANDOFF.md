# S16 HANDOFF — 可安装双插件 bundle、版本 banner、局部隔离、卸载/更新不损坏会话

## 身份、范围与交付状态

- TASK：`/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tasks/S16-TASK.md`；PLAN-FULL "## S16"；R07/R13/R19/R20/R23；模式 EXECUTE_WITH_COMMIT。
- 主写域 bridge 仓（`feat/zcode-runtime-bridge`，起点 `3b69054`）；DSH 克隆 `/Users/ibobby/Projects/dsh-zcode-acp/dsh` HEAD `21fb059` **本期无改动**（本节消费点是 bridge 自带 client 插件与临时隔离 profile，未触及 DSH 产品/测试文件，故无 DSH 提交）。reference/ZCode 与官方 App 只读。
- 0 模型调用；未碰官方 GUI/凭据/真实用户 profile；遵守 session/close 禁令；受限态不标 available；不造第二会话存储；未伪造兼容性结论。
- 自评 **COMPLETE（受限范围内）**：版本 banner、分级 fail-safe、双插件安装元数据、隔离 profile 自安装/更新/卸载真实往返、卸载/更新生命周期与资源清理、兼容证据首条记录均实现并实测；真实 packaged GUI 挂载按 TASK 受限态口径以生产挂载链（jsdom + 真实 DSH renderer）覆盖，packaged GUI 记 NOT_RUN。

## 交付实现清单

1. **版本运行真值表 `packages/host/compatibility.mjs`**：`VERIFIED_VERSIONS` 是 bridge 自身已验证 tuple 记录（首条=S01 实测 3.14.4/3.14.4.7912/cjs `fad4c35c…6275f`）；`highestVerifiedVersion` 从记录派生，不从 ZCode 源码版本自动填。`classifyInstallation` 输出 verified / newer-unverified / identity-mismatch（同版本不同 digest，不复用旧证据）/ other-unverified / unknown（中性）；仅 newer-unverified 触发 `bannerRequired`，版本超前不阻断。`packages/host/installation.mjs` 的 `VERIFIED` 改为引用该单一来源，行为不变。
2. **分级 fail-safe `packages/host/fail-safe.mjs`**：按受影响不变量分级——core（`protocol-invalid`/`protocol-truncated`/`capabilities-invalid`/`sessions-invalid` 等）标记 `incompatible:true`、停止新副作用、仅保留安全 stop 路径（`stop`/`cancelBackgroundWork`）；non-core（catalog/insights/automation/remote 等可选能力）只隔离该能力；未知 code 中性、不做兼容性断言。
3. **Host 接线 `packages/host/runtime.mjs`**：`status` 增加 `failSafe` 与 `compatibility` 投影；连接重置即 `failSafe.reset()`；连接终态/onClose 观察失败 code；会话 error 事件上报核心错误；`conversationOperation` 的 command 在 core 时抛 `runtime-incompatible`（安全 stop 除外）；`catalogOperate` 在 core 时停止；catalog/insights 失败记入非核心隔离但不阻断其他路径。
4. **版本 banner 与本地偏好 `packages/client/compatibility.mjs` + `client.jsx`**：三种 dismiss——`once`（仅当前显示会话、不落盘）、`this-version`（持久化精确版本键，更高版本重新提醒）、`new-next-version`（持久化并一次性跳过紧邻更高版本，再高版本重新提醒）；dismiss 是 bridge 自身本地设置（`dsh.zcode.compat-dismiss`，R14），与 host fail-safe 分开存储，关闭 banner 不解除隔离（R20）。StatusCard 增加 banner、未知版本中性提示、身份不一致提示、core/非核心可见状态、以及宿主/客户端插件版本不一致时的 restart 提示。
5. **安装元数据 `bridge-bundle.json`**：双插件 id/包/kind/version、bundle version、ZCode 兼容声明、DSH cohort、`restartRequiredOnVersionChange`。与根 `package.json`、两插件 `package.json`、`cordis.patch.yml` 一致性由测试断言。
6. **兼容证据记录 `docs/compatibility/COMPATIBILITY-RECORD.json`**：按 `templates/COMPATIBILITY-RECORD.json` 模式的实际首条记录（见下）。
7. **测试**：`tests/s16-compatibility.test.mjs`（8）、`tests/s16-failsafe.test.mjs`（5）、`tests/s16-lifecycle.test.mjs`（3）、`tests/s16-profile-roundtrip.test.mjs`（3）、`tests/s16.dsh.spec.ts`（7，含真实 DSH renderer 挂载链与 native/ZCode 身份区分 smoke）、`tests/fixtures/s16-runtime.mjs`、`tests/fixtures/s16/profile-roundtrip.json`。

## 版本 banner 语义（R19/R20）

- 实际版本 > 已验证最高版本 → `newer-unverified` warning banner；三种关闭见上；新版本本身不阻断连接。
- 未知版本 → `unknown` 中性：显示"版本未确定、不做兼容性声明"，不标 available、不伪造支持。
- 同版本不同 digest/build → `identity-mismatch`：明确身份/验证不一致，不复用旧验证；"此版本关闭"仅是提示偏好而非豁免。
- banner 关闭与安全隔离分别存储；关闭 banner 不改变 `failSafe`。

## 分级 fail-safe 与卸载/更新不损坏会话

- **非核心 denial 仍可用**：目录能力响应形状不符时只隔离 `directory`，运行时保持 connected，安全读路径（session 列表）继续。
- **核心 decode 错误停止新副作用**：核心 frame/能力/会话投影不兼容 → `incompatible:true`、`stopsNewSideEffects:true`；`sendText`/管理命令抛 `runtime-incompatible`，`stop` 仍被允许。
- **未知版本中性**：无兼容性断言、无新副作用阻断。
- **unload/reload**：dispose 后 transport `data`/`end`/`close`/`drain` 监听全部释放，无 pending catalog 操作；自有 runtime 进程被回收，无关进程不动。
- **更新后旧会话可恢复**：bridge 不写第二会话存储（workspace 目录前后无变化），fresh 实例从官方 carrier 重新读取同一 sessionId；卸载清理无残留（`session/close` 从未发送）。

## 隔离 profile 自安装/更新/卸载真实往返（S09/S01 carrier 模式）

`scripts/capture-s16.ts`（真实 `runProfilePnpm`，临时隔离 profile，`--ignore-scripts`，不动真实用户安装）：

| 阶段 | 真实结果 |
|---|---|
| install | exit 0；安装 `@dsh-zcode/bridge` 0.1.0 + host 入口 + client 产物；bundle 元数据 0.1.0；profile 登记 bundle |
| update | exit 0；复制 bundle 升到 0.1.1 后重装，install 记录 0.1.1，运行常量仍 0.1.0 → `restartRequired:true`（不宣称已升级生效） |
| uninstall | exit 0；`node_modules/@dsh-zcode/{bridge,host,bridge-client}` 与 bundle 登记全部清除，无残留 |

证据：[profile-roundtrip](../probes/checks/s16-profile-roundtrip.log)；派生产物 `tests/fixtures/s16/profile-roundtrip.json`（`pass:true`）。

## 兼容证据记录（首条）

`docs/compatibility/COMPATIBILITY-RECORD.json`：decision `GO_WITH_LIMITS`；`highest_actually_verified_zcode_version = 3.14.4`；绑定 App 3.14.4 / build 3.14.4.7912 / cjs SHA-256 `fad4c35c…6275f`、DSH cohort 0.2.0-rc.2@21fb059、环境 darwin/arm64/Node 24.14.0/Electron 41.0.3。限制：auth 不可用（模型执行未认证）、packaged GUI/shared-GUI 写 authority NOT_RUN、同版本不同 digest 不复用证据。

## Checks 实跑

| 检查 | 结果 / 证据 |
|---|---|
| `npm test`（Node） | **209/209 PASS**，0 fail 0 skip（起点 189，+20）；[node](../probes/checks/s16-node.log) |
| bridge DSH 集成（vitest jsdom） | **171/171 PASS**（起点 164，+7）；[integration](../probes/checks/s16-integration.log) |
| DSH native 回归 | **1373/1373 PASS**，60 文件；[native](../probes/checks/s16-native.log) |
| bridge build | **PASS**；[build](../probes/checks/s16-build.log) |
| 真实 profile 往返 | **PASS**（install/update/uninstall，`pass:true`）；[roundtrip](../probes/checks/s16-profile-roundtrip.log) |
| touched-file oxlint | **0 warning 0 error**；[lint](../probes/checks/s16-lint.log) |
| 两仓 `git diff --check` | **PASS**；[whitespace](../probes/checks/s16-whitespace.log) |
| DSH 仓改动 | **无**（无 DSH 提交） |

## NOT_RUN

- 真实 packaged DSH GUI 挂载与真实浏览器交互：NOT_RUN（需用户配合/红线）；以生产 slot renderer + 真实 Host RPC 的 jsdom 挂载链覆盖。
- 官方账号 auth / 模型执行 / 双客户端共享会话写：NOT_RUN（无已验证正式 auth 来源、0 模型调用）。
- 卸载后"监听/孤儿进程"在真实宿主进程内的长期观测：以 BridgeHost dispose 监听计数与进程回收断言覆盖，未在 packaged GUI 宿主内重复。
- 未以 fixture PASS 替代上述真实结果。

## 分块提交

- bridge：host 兼容/fail-safe；client banner；S16 测试与 fixtures；profile 往返采集脚本；docs/handoff。最终 HEAD 以 Git 为准，本文件不虚构自身 commit hash。

本 worker 只提供实际 Git/脚本/检查/fixture 证据，等待父节独立 A+B 覆盖与 admission；不自评 CLEAN，不组装父级 audit pack。
