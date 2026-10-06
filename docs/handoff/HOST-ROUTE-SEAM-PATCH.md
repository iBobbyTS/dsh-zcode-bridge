# Host route seam patch worker handoff

已按主 agent 的 session-create 有界 seam 授权准备 DSH 修正：`4eea594840bd89b5a49367aa17c0b4c33556b72e`（`fix(connection): retain caller context for host route registries`）。`connection.rpc` 与 `connection.fetch` getter 通过 Cordis 的 `getTraceable(this.ctx, this.ctx)` 保留调用方 Context；只修正注册 owner，不改变认证、RPC envelope、路由选择或 body/response 处理。双语记录位于 DSH `docs/seam/connection-route-owner.md`，上游身份为 `dsh-v0.2.0-rc.2`。

此提交位于 `/private/tmp/dsh-getter-seam-work/dsh`，直接基于指定 DSH 工作克隆的 `0f2509d325ab58941352354d3497474e5d2a7dc3`。当前会话的写权限不包含原 DSH 仓，也不包含原 bridge 的 `.git`；直接 DSH 编辑被拒绝，未绕过限制。原工作克隆未应用该提交。

bridge 本次只撤除 `tests/host-route.dsh.spec.ts` 中的临时 getter shim，使早/晚 WebServer HTTP 回归直接消费原生 getter。产品实现继续使用已提交的子 `webCtx` 注册，未增加反射绕过或复制 transport 实现。

## 验证

| 检查 | 结果 |
| --- | --- |
| DSH Host + Client face `tsc -b` | PASS |
| DSH Connection host/client bundles | PASS |
| DSH caller-owner 无 socket 回归 | 3/3 PASS；原 getter 的早/晚两项均失败；包含禁止借用提供方注入权限 |
| DSH Connection 全量 + WebServer 受影响面 | 164 PASS / 9 FAIL，173 总数；loopback listen EPERM 及其后续失败，未宣称全量通过 |
| bridge `npm test` | 45/45 PASS |
| bridge build | PASS |
| bridge DSH 集成（已撤 shim） | 19 PASS / 6 FAIL，25 总数；2 项 listen EPERM、4 项 official installation discovery 失败 |
| 两仓变更文件 oxlint、diff check | PASS |
| DSH Markdown links/wrap、repository references、doc budgets、全部 863 个双语 pair、package dependencies、export JSDoc、Cordis catalog freshness | PASS |
| `pnpm run doc-sync` | FAIL，tsx IPC listen EPERM |
| Client catalog freshness | FAIL，7 项 ui-session slot 文档/重复声明问题；原 DSH 基线执行同一检查也报相同 7 项，未扩大补丁范围 |
| 原生 getter 的真实隔离 `dsh web` | 启动到 WebServer 后被 `listen EPERM 127.0.0.1:3082` 阻止，未取得认证 POST 200 |

真实 web 尝试同时设置 `HOME=/private/tmp/dsh-getter-seam-work/web-home` 和 `DSH_HOME=/private/tmp/dsh-getter-seam-work/web-home/.dsh`，并清空 NODE_OPTIONS；没有加载 getter 对照补丁。本轮不触碰真实 `~/.dsh`，官方 App 未写入，模型调用 0。

## 主 agent 后续

恢复原 DSH 仓和两仓 `.git` 的写权限后，集成两份候选；允许本地 socket 的环境复跑全量 Connection、bridge 集成、doc-sync 及真实认证 POST `/zcode-bridge/status`。Client catalog 的基线问题需要主 agent 单独处理或明确归属。当前交付是已提交、可评审的候选，**不是已经在指定原克隆完成集成或已通过真实 web 验收的结果**。
