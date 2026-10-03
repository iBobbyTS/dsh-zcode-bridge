# S07 HANDOFF — 附件与正式共享上下文能安全进入正确会话

## 1. 身份与边界

- TASK：父工作区 `.agent-work/tasks/S07-TASK.md`，PLAN-FULL S07，R08/R17/R22；EXECUTE_WITH_COMMIT。
- bridge 起点 `d8e8409`（`feat/zcode-runtime-bridge`）；DSH 起点 `76c5156`（同名分支，仅消费点/测试配置有界编辑并单独成组）。reference/ZCode 与官方 App 只读。
- 本 worker 未启动子代理、未执行独立 A/B 评审或父节 admission；不宣称 CLEAN。
- 红线遵守：0 模型调用（capture allowlist 只含 createSession/deleteSession/discardSharedContext 与 attachment 面，实测 `paidModelCalls=0`）；不碰官方 GUI/真实用户 Session/凭据；未调用 session/close；不造第二存储；不提供任意主机路径后门；移植保留来源（SOURCE/NOTICE/LICENSE + `scripts/vendor-v4.mjs` 可重建）；受限态不标 available。

---

## 2. 实现清单

### Host（bridge）

1. `packages/host/vendor/zcode/v4.mjs`：由只读 reference 重新移植（`scripts/vendor-v4.mjs`，revision `29628c9`，71 个 shared/schema 源文件，SOURCES.json 记录哈希）。新增 official schema 导出：attachment begin/chunk/commit/abort/read/previewSource/conversationAttachmentRead/conversationAttachmentStat/attachmentPut、`attachmentRefSchema`、`sharedContextRefSchema`、`sharedContextImportStateSchema`。
2. `packages/host/attachment.mjs`：官方渲染端事务的等价实现——`ATTACHMENT_UPLOAD_CHUNK_BYTES=384*1024`、base64 严格解码、SHA-256 whole-file checksum、`uploadAttachmentTransaction`（begin→chunk*→commit，任何 begin 之后失败即 abort，committed begin 幂等返回，server progress 校验）。
3. `packages/host/conversation.mjs`：
   - `attachmentAdmission`（live + snapshot；不要求 runnable——官方附件面与模型鉴权无关，实测可达）。
   - `attachmentStart/attachmentChunk/attachmentCommit/attachmentAbort`（host 生成 uploadId、`connectionId`/`sessionId` 由 owner 派生；staged/committed 分表；committed 本地撤回≠runtime 删除）。
   - `uploadAttachment`（整文件便捷入口，内部仍走官方 384 KiB 分片；不存在 full-data wire RPC）。
   - `attachmentRead`（图/视频/PDF 预览）、`conversationAttachmentStat`（metadata）、`conversationAttachmentRead`（share/任意已授权 MIME）。
   - `#boundAttachmentRef`：ref 必须是本会话已 commit 或当前 session 投影行附件；跨会话/任意路径拒绝 `attachment-ref-unbound`。
   - `submit` 校验：sendText 的 `attachments` 每个 ref 必须已绑定；`context_refs` 必须匹配投影中 pending/reserved 的 import；`discardSharedContext` 仅允许 pending 且 contextId 匹配。
4. `packages/host/runtime.mjs` / `index.mjs`：`conversationOperation` 增加 attachmentStart/Chunk/Commit/Abort/Read/conversationAttachmentStat/conversationAttachmentRead；RPC payload 逐操作白名单；`discardSharedContext` 纳入 MANAGEMENT_COMMANDS。

### Client（bridge，DSH webui 方向）

5. `packages/client/attachment.mjs`：浏览器端同一事务（WebCrypto checksum、384 KiB 分片），无 node 依赖。
6. `packages/client/remote-conversation.mjs`：以 scoped RPC 驱动 start/chunk/commit/abort，`uploadAttachment` 分片过线；read/stat 委托。
7. `packages/client/conversation-view.jsx`：`ConversationController` 暴露 uploadAttachment/attachmentRead/conversationAttachmentStat/conversationAttachmentRead/discardSharedContext；userInput 行渲染附件并提供官方 Stat/Preview/Read（错误如实显示，不做路径读取）。
8. `packages/client/input-controls.mjs` / `.jsx`：`inputSubmission` 支持 attachments + context_refs；附件选择/进度/取消/移除；shared context 身份展示、“Include in next input”、仅 pending 可 Withdraw；无文本但有附件也可发送；发送 accepted 后清空本地附件。

### DSH 克隆（仅消费点测试，单独提交）

9. `packages/client/ui-session/tests/zcode-attachment.client.spec.tsx`、`tests/bridge-ambient.client.ts` 声明、`vitest.config.ts` 新增 `@dsh-zcode/bridge-s07` / `@dsh-zcode/bridge-attachment` 别名。

---

## 3. Carrier 核实表（reference revision `29628c9`；App 3.14.4.7912 / SHA-256 `fad4c35c4c36ec210d8a06d3fa0e77de23c8545e2eb6ff90aea1eb38d1e6275f`）

| 能力 | 已核实 wire / 生效点 | 状态与真实验证 |
|---|---|---|
| begin | `v4/attachment/begin`，`v4AttachmentBeginParamsSchema`；`AttachmentUploadRegistry.begin`（`apps/zcode-cli/.../attachment-upload-registry.ts`）；schema：zero-byte⇔zero-chunk、totalBytes≤20MiB、totalChunks≤64；registry：`chunkCountInsufficient` | **已实现**；真实捕获 staging/nextChunkIndex、zero-byte+1chunk 与 65 chunks 被 schema 拒、totalBytes>chunks*512KiB 返回 `fault.attachment.chunkCountInsufficient` |
| chunk | `v4/attachment/chunk`；decoded ≤512KiB；相同重复片幂等返回原 nextChunkIndex；异内容 `chunkConflict`；gap/empty/tooManyChunks/totalBytesExceeded | **已实现**；真实捕获 duplicate 返回同一 nextChunkIndex；fixture 覆盖冲突片真实 fault |
| commit | `v4/attachment/commit`；chunks/receivedBytes/checksum 全等才落 artifact；committed begin/commit 幂等同 ref | **已实现**；真实捕获 commit→ref、begin-again(state=committed,同ref)、commit-again 同 ref |
| abort | `v4/attachment/abort`；committed 不被删除；abort 后 commit=`uploadNotFound` | **已实现**；真实捕获 abort={} 与 commit-after-abort 真实 fault；UI abort 后不显示可用附件 |
| preview read | `v4/attachment/read`（image/video/pdf，≤512KiB/块，按 session row 授权）；`attachmentPreviewSource` 仅 Desktop local video | **已实现 carrier + 绑定校验**；真实捕获方法派发与 `fault.attachment.previewRefNotAuthorized`；**成功读取已发送附件 gated**（需模型轮产生 userInput 行）。`attachmentPreviewSource` 按 web 方向不实现（attachmentRead 对 web 返回 chunked） |
| share/plain read | `v4/conversation/attachmentRead`（任意已授权 MIME，row+index 授权） | **已实现**；真实捕获派发与 `fault.attachment.shareReadNotAuthorized`；成功读取 gated |
| stat | `v4/conversation/attachmentStat`（metadata-only；`target.rowId` 为 number） | **已实现**；真实捕获派发与 `fault.attachment.shareStatNotAuthorized`；成功 stat gated |
| session-bound send | `sendText{text,attachments:attachmentRefSchema[],context_refs}`（`command.ts`）；`SessionPane.tsx` 注入 `context_refs` | **已实现**；fixture 验证命令 wire 含 attachments/context_refs 且宿主先验 ref 归属；**真实发送 gated**（模型轮） |
| shared context use | `sendText.context_refs` max 1 `{kind:'shared_context_import',context_id}`；CLI 将 import 由 pending→reserved | **已实现**；仅匹配投影中 pending/reserved 的 contextId；fixture 覆盖 |
| shared context withdraw | `discardSharedContext{contextId}`；CLI 仅 pending→discarded；不删除/改写源会话 | **已实现**；真实捕获未导入时官方 `fault.command.inputRejected`“shared context is not pending”；fixture 覆盖 pending/attached/discarded/legacy 拒绝 |
| shared context import creation | legacy `session/create` 的 `importedHistory.source='sharedContext'`（`server-operations.ts`），内容来自外部 share 抓取 | **不可用**：V4 无 runtime import 命令；外部 share 载体不在本 section 范围。已导入上下文的使用/撤回不受影响 |
| attachment identity | `attachment-ref.ts {ref,fileName,mime,bytes,previewRef?}`；UI 分派 localPath（零上传）vs dataBase64/textContent（put） | **已实现身份绑定**；跨会话 ref 与任意路径（`/etc/passwd`、`file://`、他会话 artifact）在 read/stat/send 前均 `attachment-ref-unbound`，不做路径读取 |
| arbitrary host path read | — | **拒绝**：无任何接受路径的入口；读取只经官方 session/row 授权 carrier |
| unknown type | 任意合法 MIME 可上传；read 媒体仅 image/video/pdf，其余走 conversationAttachmentRead；legacy shared-context 仅 `{title}` | **fail-safe**：未知 MIME 走 document 读取并如实显示官方 fault；legacy 无 contextId 不作为可用身份；不 crash |

### auth 关系探测结论（0 模型调用）

- 真实 headless（官方 Helper+cjs，`app-server --stdio`）创建无 firstInput draft（`createSession`，非模型调用）后：
  - **上传管线与模型 auth 无关**：begin/chunk/commit/abort 全部真实达且行为符合官方；唯一前置是 CLI 内存在 session record（`v4-bridge.ts` 的 `putSessionAttachment`）。无凭据、无模型输入。
  - **read/stat 方法可达但成功受 row 授权**：对未随消息发送的 committed artifact，真实返回 `previewRefNotAuthorized` / `shareStatNotAuthorized` / `shareReadNotAuthorized`。成功需已发送 userInput 行（模型轮）→ 在本红线内 gated。
  - **discardSharedContext 可达**：无 pending import 时真实返回 `fault.command.inputRejected`。
- 因此 bridge 将附件资源面（upload/read/stat）与模型执行面分开：`attachmentAdmission` 只需 live+snapshot，`admission`（发送）仍要求 runnable。

---

## 4. Fixtures 与真实采集

- `scripts/capture-s07.mjs`：真实 headless 采集（allowlist 无模型输入）。输出 `tests/fixtures/s07/official-attachment.json`（chunk 字节以 `<base64:N bytes>` 占位，保留 wire 语义）；证据见 [s07-capture.log](../probes/checks/s07-capture.log)（22 exchanges，`paidModelCalls=0`，真实 fault 原文含 `fault.attachment.uploadNotFound`/`chunkCountInsufficient`/`previewRefNotAuthorized`/`shareStatNotAuthorized`/`shareReadNotAuthorized`）。
- `scripts/make-s07-fixtures.mjs`：以真实 s06 busy 快照为基派生 `success/attached/discarded/legacy.json`。userInput 行附件与 sharedContextImport 注入（无法在 0 模型下真实产生），每份 provenance 明列注入项。
- `tests/fixtures/s07-runtime.mjs`：注入式服务端边界，Producer 为真实 `V4Conversation` + vendored schema；begin/chunk/commit/abort 按官方 `AttachmentUploadRegistry` 语义（重复片/冲突片/gap/incomplete/abort 后 notFound），支持 `failCommit`/`dropCommit`/commit 延迟。
- `tests/s07-attachment.test.mjs`（12 项）、`tests/s07.dsh.spec.ts`（7 项）、DSH 侧 `zcode-attachment.client.spec.tsx`（2 项）。

---

## 5. Checks 实跑

| 检查项 | 命令 | 结果 | 证据 |
|---|---|---|---|
| Bridge Node 全量 | `npm test` | **82/82 PASS**（原 70 保留 + 12 S07） | [s07-node.log](../probes/checks/s07-node.log) |
| DSH bridge 集成 | `node ../dsh/node_modules/vitest/vitest.mjs run --config scripts/dsh-vitest.config.mjs` | **73/73 PASS**（原 66 + 7） | [s07-integration.log](../probes/checks/s07-integration.log) |
| DSH native 回归 | `pnpm_config_verify_deps_before_run=false pnpm vitest run packages/api/session-controller/tests packages/client/ui-session/tests packages/client/ui-workspace/tests` | **1371/1371 PASS**（原 1369 + 2） | [s07-native.log](../probes/checks/s07-native.log) |
| DSH 消费点 | `... vitest run packages/client/ui-session/tests/zcode-attachment.client.spec.tsx` | **2/2 PASS** | [s07-dsh-consumer.log](../probes/checks/s07-dsh-consumer.log) |
| DSH 类型 | `pnpm typecheck:contracts-ready` | **PASS** | [s07-types.log](../probes/checks/s07-types.log) |
| Bridge build | `npm run build` | **PASS** | [s07-bridge-build.log](../probes/checks/s07-bridge-build.log) |
| DSH full build | `pnpm_config_verify_deps_before_run=false pnpm build` | **PASS; 355 artifacts** | [s07-dsh-build.log](../probes/checks/s07-dsh-build.log) |
| 真实非模型采集 | `node scripts/capture-s07.mjs` | **PASS; paidModelCalls=0** | [s07-capture.log](../probes/checks/s07-capture.log) |
| oxlint（两仓 S07 触碰文件） | `oxlint [...]` | **0 warnings / 0 errors** | [bridge](../probes/checks/s07-lint.log) / [DSH](../probes/checks/s07-dsh-lint.log) |
| whitespace | `git diff --check`（两仓） | **PASS** | — |

NOT_RUN（fixture PASS 不替代）：
- 真实 sendText 携带已发送附件成功（AC 正例端到端）：0 模型红线；上传链真实、命令 fixture、发送 gated。
- 真实已发送附件的成功 read/stat；真实 shared-context import 创建（外部 share 载体）；官方 GUI/共享用户 Session/浏览器视觉 oracle（明文禁令，浏览器 oracle 归主 agent）。

---

## 6. 给后续节的契约

- 附件一律走 `V4Conversation` 的同一 owner：`attachmentStart/Chunk/Commit/Abort/uploadAttachment` 与 read/stat；不得另建存储/注册表；host 生成 uploadId 与 connectionId，客户端不得提供 sessionId。
- 资源面准入 `attachmentAdmission`（live+snapshot）与模型面 `admission`（runnable）分离；受限 host 可上传但永不发送。
- ref 身份 = 本会话 committed 或当前投影行附件；发送/读取前必须经 `#boundAttachmentRef`；禁止任何主机路径读取入口。
- `discardSharedContext` 只改本会话 import 状态（pending→discarded），**不是**删除源会话；S08 fork/历史不得把撤回当会话删除。
- shared context import 创建不可用（legacy session/create + 外部 share），后续若要补需先核实 carrier 与外部依赖。
- 未来 auth owner 获得可信 runnable 后，先补真实 send-with-attachment 与成功 read/stat oracle，再谈把发送标 available；不得从 UI payload 开通。

---

## 7. 提交与自评

- bridge：`feat(host): vendor official attachment and shared-context protocol schemas`、`feat(attachment): add session-bound upload/read/stat and shared-context controls`、`test(attachment): cover official upload semantics, identity binding, and DSH seat`、`docs(handoff): record S07 carriers, real capture, and checks`。
- DSH：`test(ui-session): cover official ZCode attachment upload through session seat`（消费点测试与别名，单独成组）。
- 自评：**PARTIAL**。受限态实现与要求交付范围 6 项已交付；上传全链、权限/身份、共享上下文使用/撤回为真实/ fixture 证据；AC 的“发送后可用”与成功 read/stat 因 0 模型红线 gated，已如实记录且未标 available。需要主调度独立双覆盖与父节 admission；本 worker 不宣称 CLEAN 或整体 feature 完成。
