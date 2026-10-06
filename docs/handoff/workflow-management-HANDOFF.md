# workflow-management — Workflow 管理、运行门禁、图与用户面产物

## 身份与边界

- TASK：父工作区 `.agent-work/tasks/workflow-management-TASK.md`，完整读取；合同 PLAN-FULL workflow-management、R02/R08/R18/R22，沿用 transport-v4-convergence/live-session-permission-stop/interaction-plan-review-trust/catalog-management/background-subagents/browser-computer-use 的 command、投影、workAdmission、scoped handle 与宿主观察 seam。
- 执行模式 EXECUTE_WITH_COMMIT；bridge 基线 `14e3fea36d69bf6aa20780085318d2a66f7e04db`，`feat/zcode-runtime-bridge`；DSH 基线 `21fb059745ddc1b78e387c24f3987b68569de236`，未改动。现有 DSH session-area 消费 seam 足够，无需消费点补丁或空提交。
- 本轮为实现 worker，未执行独立 A/B review、父节 admission、archive 或审计 pack。用户指定 external codex / gpt-6.1-sol / high / yolo；本会话没有独立可核验的 observed model/effort 或 external agent_id，记 UNKNOWN，由主控保留 dispatch 证据。未启动子代理。
- reference `zai-org/ZCode@29628c9acdb81b703bbd4080c207a0e7ce5e276e` 与官方 App 只读。仅启动自有官方 stdio 子进程；隔离临时 HOME/workspace；未接触真实用户数据、凭据、GUI、TCC 或共享进程。没有 session/close。模型调用 **0**。

## 可达性先探测：结论与范围修正

**TASK 的“大概率可达”是探测假设，不是成功事实。** 实测管理/查询入口可达，但本版本没有新定义 save RPC，也没有 saved-definition graph RPC。

1. `workflows/list` project/global 实际返回空目录；`get/updateMeta/delete/move` 对未存在名字实际回 `{ok:false,reason:'not_found'}`；`workflows/runs` 和 session journal runs 实际为空。
2. `workflows/save` 与 `workflows/graph` 实际 `-32601`。完整 command schema 与 server dispatcher 无对应方法；保存新定义只有 **SaveWorkflow 工具**（alwaysAsk + 官方审批 + 同步 typecheck/write），本 carrier 没有独立工具调用入口。**未直接写 `.zcode/workflows`、未移植工具 handler、未创建第二存储。** UI 明确 unavailable；元数据保存与新定义保存分开。
3. graph 正式来源是 `toolCall.display / toolCall.output.display` 的 `create_workflow`，以及 `workflowLaunch.display`；本次真实空会话没有图。因此图成功展示来自显式 injected fixtures，不能称为真实编译图或运行 oracle。
4. `workflowRunEvents/Artifacts/ArtifactData/Workspace` 对不存在 run 回真实空页；这不是“run 存在且产物已生成”。正确参数的 `workflowRunArtifactRead/NodeResult` 对未知身份回 `-32603`，真实读取拒绝保留。
5. raw `startSavedWorkflow/resumeWorkflowRun/amendWorkflowRunSettings/cancelBackgroundWork` 仅对专用环境不存在的名字/run 实测，均在 lookup 阶段官方 failed/not_found，未进入编译/submission/model。生产 `V4Conversation` 在同一真实 peer 实跑管理/查询和三项执行本地 gate，`productionOracle` 记录 `runtime-restricted`。
6. `amendWorkflowRunSettings` 的仅并发变更在 live run 可由官方 retune 原地应用；not_live 会继续走创建后继路径（`dynamic-workflow-run-settings.ts:136`）。因此不能把整个设置命令当成安全非模型配置。当前统一 gated，UI 文案为“may start a successor”。元数据设置则走正式 updateMeta。

证据：[official.json](../../tests/fixtures/workflow-management/official.json)、[capture log](../probes/checks/workflow-management-capture.log)。官方安装包 `3.14.4.7912`，cjs SHA-256 `fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`。最终 capture 只建一个无 firstInput 的专用 v4 draft；stdio EOF/owned-child 清理后删除临时 HOME/workspace，不需要 session/close。

## Carrier 核实表（逐项）

源码路径以 reference 根为前缀；`shared` 指 `packages/shared/src`，`bootstrap` 指 `apps/zcode-cli/packages/bootstrap/src`。

| 入口 | 正式载体 / 源锚点 | 真实程度与本节行为 |
|---|---|---|
| 保存新定义 | `SaveWorkflow` tool；contracts/tools/save-workflow.ts；core/tool/handlers/save-workflow.ts:158,234,271 | 无 standalone RPC/command；探测 `workflows/save` -32601。当前 unavailable；不绕过 alwaysAsk、编译、审批或写文件。成功保存 NOT_RUN。 |
| 列表 | `workflows/list`；shared/zcode-protocol/index.ts:2754；bootstrap/zcode-protocol/server.ts:654；saved-workflows.ts:53 | project/global 两组真实空态；严格 schema、每次 fresh official read。 |
| 打开 | `workflows/get`；index.ts:2773；saved-workflows.ts:73 | 真 not_found；同名必须携 scope；结果 name/scope 不符拒绝。正常 meta/script 打开用 fixtures。 |
| 元数据设置/保存 | `workflows/updateMeta`；index.ts:2798；saved-workflows.ts:105 | 真 not_found；官方保存成功 fixture；写后 reread，不本地覆写正文；无 CAS 是正式语义，不造 CAS。 |
| 删除 | `workflows/delete`；index.ts:2814；saved-workflows.ts:130 | 真 not_found；UI 显式核对 scope/name 才允许删除；官方结果 authoritative。 |
| 全局移回项目 | `workflows/move`；index.ts:2911；saved-workflows.ts:249 | 真 not_found；只收 name，官方固定 global→project、不覆盖；反向不存在，不造第二操作。 |
| 保存定义的历史 | `workflows/runs`；index.ts:2830；saved-workflows.ts:160 | 真空态；limit≤50，truncated 明示，global 历史保留 cwd/parentSessionId，详情须在所属会话读取。 |
| session 冷发现 | `v4/conversation/workflowRuns`；shared/zcode-protocol-v4/transport.ts:654；bootstrap/zcode-protocol-v4/v4-gateway.ts:1634 | 真空態；limit≤64，resumable 来自官方，不从 status 推导。 |
| 事件页 | `v4/conversation/workflowRunEvents`；transport.ts:597；v4-gateway.ts:1609 | 真空页；journal sequence cursor + hasMore；未知类型保留名称，详情 unavailable，不猜进度。 |
| 图 | `create_workflow.causalityGraph` / `workflowLaunch.display`；shared/zcode-protocol-v4/create-workflow-display.ts:136；workflow-row-meta.ts:153 | 官方投影 schema 验证 fixtures；阶段/参与者/交接/alongside/回边/engine return/truncated 分开显示；不分析脚本。saved graph RPC -32601；真实有图 NOT_RUN。 |
| 运行 | `v4/command startSavedWorkflow`；command.ts:236；bootstrap/.../commands/handlers/interaction-background.ts:250 | 真官方 failed `fault.command.savedWorkflowStartRejected.not_found`；生产本地 runtime-restricted。name+scope+args正式 shape，不合成提示词。 |
| 恢复 | `v4/command resumeWorkflowRun`；command.ts:228；interaction-background.ts:213 | 真官方 failed `fault.command.workflowRunResumeRejected.not_found`；生产 gated；workId≡runId，resume 同 run 的新 incarnation 必须等待 journal 水位推进。 |
| 运行设置 | `v4/command amendWorkflowRunSettings`；command.ts:243；workflow-run-settings-command.ts:17；interaction-background.ts:288 | 真官方 failed `fault.command.workflowRunSettingsRejected.not_found`；生产 gated；省略/null/value 三态及新 runId/toolCallId 原样保留。 |
| 取消 | `v4/command cancelBackgroundWork`；沿 background-subagents | 真 failed `fault.command.backgroundWorkCancelRejected.not_found`；已存在工作可不经模型 admission 取消；ACK 后还看 workflow/background 投影，不能凭缺 backgroundWorks 把仍 running 的 workflow 标 completed。 |
| 用户面产物清单 | `v4/conversation/workflowRunArtifacts`；workflow-artifacts.ts:145；v4-gateway.ts:1656 | 真空清单；fixtures 六种官方 kind/schema、版本、primary/sourcePath、itemCount；不把引擎返回值当产物。未知 kind fail closed。 |
| 产物数据页 | `.../workflowRunArtifactData`；workflow-artifacts.ts:168；v4-gateway.ts:1676 | 真空页；artifactId/runId/sessionId绑定、limit/sequence/hasMore；WebUI 按数据列显示，复杂 spec 未复刻官方图表 renderer。 |
| 产物内容块 | `.../workflowRunArtifactRead`；workflow-artifacts.ts:219；v4-gateway.ts:1720,1849 | 正确参数未知身份真 -32603；fixtures content/version/chunk；正式 session→run→artifact/version授权留给官方；不收 uri/path、不读磁盘。校验base64、chunk bytes、total/nextOffset；文本escaped，二进制preview不可用。 |
| run workspace | `.../workflowRunWorkspace`；workflow-workspace.ts:88；v4-gateway.ts:1749 | 真空 nodes；fixtures op/siteId/ordinal/status/inputTruncated/list truncated；只读。 |
| 节点结果 | `.../workflowRunNodeResult`；workflow-workspace.ts:114；v4-gateway.ts:1776 | 正确siteId+ordinal的未知身份真 -32603；fixtures completed/failed/truncated/totalBytes；不接受猜的 nodeId。 |
| 在 workspace 打开产物 | sourcePath 只是 official metadata | 只呈现路径，navigation carrier 未核实，明确 unavailable，不能任意文件读取或假打开。 |

## 实现与共享不变量

- `packages/host/workflow.mjs`：六项 management、七项 journal query 的明确白名单，使用只读移植的官方 params/result schemas。调用方不可覆盖 workspace/sessionId 或携 path/uri；未知 operation/额外字段/schema 错误拒绝。read 没有模型 admission，write 仍需已核实 installation 的 managementAdmission。
- `V4Conversation` / scoped RPC / `RemoteConversation` / `ConversationController`：新增 workflowManage/workflowRead，RPC 只接受 handle+kind+params，source identity 沿 immutable owner；开关/释放/断线后拒绝旧结果。没有全局 workflow cache、第二目录或第二 journal。
- command 白名单纳入 start/resume/amend；当前正式 BridgeHost 永远 restricted，因此三者不发给模型入口。成功 ACK fixtures 只关联 ACK runId/toolCallId；amend 的前驱不能结算后继；resume 不拿旧 stopped incarnation 的旧水位结算新命令。accepted/duplicate 不制造产物或进度。
- B04/B05：已写出元数据/delete/move 请求的 abort/timeout/EOF 或错误响应 shape → workflow-outcome-unknown；未写出保留 not-sent/cancelled；读取消只结束等待，不叫运行取消。模型命令复用原 commandId 查询、不重发。晚到 stdout/通知/异步 UI 结果按 owner/订阅/代际丢弃。
- WebUI 从 live-session-permission-stop 现有 session area 展示目录、打开的 meta/script、metadata 保存、删除/移回、history、live run、图与产物查询。作用域切换 remount 目录；run 切换 remount 详情；控制器/读 admission 替换 abort与清旧页面。官方拒绝/read error 清旧显示；没有“已运行/已生成”占位。
- graph 仅采用官方 fields：SVG纵向节点 + 独立边线、完整关系文字；alongside 是并行事实，不冒充控制边；truncated 明示。此前横排跨节点连线被遮挡，已修正并重验。
- 原始定义/产物成功、运行状态、branch/两 actor/后继生命周期均来自明确 synthetic fixtures；fixture内容从不进入正式存储或引擎。
- 未根据独立 capabilities/query 或 entitlement unknown 标 available；未冒充账号许可或复刻 workflow 引擎。

## Fixtures、checks 与可重跑证据

| Artifact | 来源 |
|---|---|
| tests/fixtures/workflow-management/official.json | 真官方runtime capture + 生产协调层read/gate oracle；临时path/session别名化；stderr仅计字节。 |
| empty.json | official.json严格真实空态/拒绝投影；injectedFields=[]。 |
| lifecycle.json | injected-semantic-fixture：真实transport-v4-convergence空snapshot envelope + 官方schemas；definitions、branch graph、两actor、run/节点/产物/数据/事件/后继均明确注入，非实际生成。 |
| workflow-management-wide/narrow.png | 隔离headless Chrome：真实空目录 + 注入生命周期/产物；不是官方GUI或实际运行oracle。 |

| Check | 实跑结果 |
|---|---|
| `node scripts/capture-workflow-management.mjs /Applications/ZCode.app` | PASS，0models；[log](../probes/checks/workflow-management-capture.log)。初次探测在实现前；最终capture使用一个空v4 draft与生产workflow read/gate路径。 |
| `node scripts/make-workflow-management-fixtures.mjs` | PASS；[log](../probes/checks/workflow-management-fixtures.log)，graph/frame官方schema校验。 |
| `node --test tests/workflow-management.test.mjs` | **18/18 PASS**；[log](../probes/checks/workflow-management-targeted-node.log)。 |
| `npm test` | **159/159 PASS**，基线141；[log](../probes/checks/workflow-management-node.log)。 |
| DSH bridge Vitest 全套 `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **139/139 PASS**，13文件，基线124；[log](../probes/checks/workflow-management-integration.log)。最终workflow-management UI **15/15 PASS**包含在该完整回归；此前graph布线变化的独立UI检查 **13/13 PASS**，[targeted log](../probes/checks/workflow-management-targeted-integration.log)。 |
| DSH `pnpm exec vitest run packages/api/session-controller/tests packages/client/ui-session/tests packages/client/ui-workspace/tests` | **1373/1373 PASS**，60文件；[log](../probes/checks/workflow-management-native.log)。DSH源码不变，后续bridge-only语义与graph改动由bridge targeted/full覆盖，不重复native。 |
| DSH `pnpm run typecheck:contracts-ready` | PASS；[log](../probes/checks/workflow-management-types.log)。 |
| DSH `pnpm run build` | PASS，355 client artifacts；[log](../probes/checks/workflow-management-dsh-build.log)，既有chunk-size/plugin timing warnings。 |
| bridge `npm run build` | PASS；[log](../probes/checks/workflow-management-build.log)。 |
| `node scripts/check-workflow-visual.mjs` | PASS，1100px/390px，0 pageerror/水平溢出；[json](../probes/checks/workflow-management-visual.json)，PNG目视。 |
| changed-file oxlint / `git diff --check` | PASS，oxlint 1.76.0、无diagnostics；[lint](../probes/checks/workflow-management-lint.log)、[whitespace](../probes/checks/workflow-management-whitespace.log)。 |

归档stdout日志仅剥除行尾空白与EOF多余空行，保持原检查内容与结果；staged diff whitespace检查也通过。DSH命令使用 `pnpm_config_verify_deps_before_run=false`，沿已有基线环境。最初UI检查用 `.ts` 文件承载JSX被Vite拒绝；已改为React.createElement后通过，不改变测试配置或产品schema。首次read probe遗漏read version/offset和node siteId/ordinal，属于无效入参探测，不作为目标拒绝证据；已按官方schema修正，最终正确请求仍真实 -32603。

## NOT_RUN、后续契约与自评

- 新定义成功SaveWorkflow、保存后真实正向get/updateMeta/delete/move及有定义的graph：**NOT_RUN**，本版本standalone保存carrier不可用，零模型约束下专用环境无已保存定义。正常shape/命令/显示以fixtures验证；空态及未知身份拒绝真采。不得把metadata保存fixture称为新定义保存实测成功。
- 真实执行/恢复/运行设置/运行取消、非空节点/产物产生与跨会话真实授权拒绝：**NOT_RUN**，禁止模型且无实际run；真实错误probe针对unknown identity，不冒充真实unauthorized-run oracle。fixtures有对应成功/失败/取消/timeout/owner隔离语义。
- 正式账号entitlement **UNKNOWN**；复杂artifact spec专用chart/board renderer、二进制文件完整preview、workspace导航 **unavailable/unverified**。当前可查看artifact状态、数据页与文本块，不称为全媒体GUI等价。
- API：`conversation.workflowManage(kind,params,{signal})` / `.workflowRead(kind,params,{signal})`；RPC `{operation:'workflowManage'|'workflowRead',handle,kind,params}`；controller `.submitWorkflowCommand(command,{signal})` 接现有command/query路径；运行入口仍服从生产admission。
- 后续启用保存或执行必须核实正式carrier/账号/审批结论，保持name+scope、session→run→artifact/version授权、journal水位、后继归属、tri-state settings、未知结果不重发。不能仅移除disabled按钮或将工具handler注入bridge。
- 自评：本TASK的**经实测界定的受限面**已实现并验证；全功能正常运行/保存oracle仍未取得。未自称父节CLEAN/接纳或整个SFD完成。主控需冻结候选并进行独立A+B。

## 分块提交

- `ae77d57` — chore(protocol): vendor official workflow query and graph schemas。
- `f86747b` — feat(workflow): expose scoped management and gated run observation。
- `ce5dc58` — test(workflow): cover official reachability and lifecycle failures。
- handoff/evidence 独立 docs(handoff) 提交；实际hash见Git及worker final，不虚构本文件自己的hash。
- DSH无文件改动、无提交；reference/官方App未改；无push、merge、reset、clean或历史改写。
