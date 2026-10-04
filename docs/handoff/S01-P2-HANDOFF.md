# S01 Phase 2 HANDOFF

判定：S02 可继续 scratch Host 产品化；隔离账号当前 signed-out，真实 HOME 准备、共享写 NO-GO。本节零产品代码改动，独立 docs commit；不 push，不执行父计划 admission/CODE A/B。完整判定与 12 个证据组：[AUTH-PHASE2-S01.md](../probes/AUTH-PHASE2-S01.md)。

- 权威：完整读取 `.agent-work/tasks/S01-P2-TASK.md`、PLAN-PHASE2 S01/需求修订记录/排除项；bridge 基线 `6e5c1be`、分支 `feat/zcode-runtime-bridge`。
- LIVE：两个未修改官方提取 Host 在独立 scratch Main 中时间重叠启动，10/10 状态 RPC，signed-out、active=null、provider not-connected；最终 0 窗口/0 WebContents、各 runner exit 0、官方 GUI 16 条清单一致、自有资源退出。
- 归属修正：OAuth/account材料由 Host credentialService 文件态 `DATA_BASE/.zcode/v2/credentials.json` 保存/消费，当前 bundle使用官方 AES-GCM provider；未证明有 OAuth Keychain 签名门槛。官方 item存在/ACL UNKNOWN。随机哨兵无数据查找 exit 44/item-not-found，未创建任何 Keychain item。
- 真实环境只做深度 2 scandir/lstat，未打开任何 `.zcode` 文件。官方安装、reference与 DSH只读。
- Main边界：reference原 bridge/bus/shared schema合成执行通过同 bus竞争/owner路由/stale拒绝/事件去重/让渡/退出；独立 bus可各自授予同目标。不是实际官方 Host任务 oracle，实际双 Host无任务租约消息。
- S02 输入：MessagePortProtocol/ChannelServer → connection-scoped zcode-agent/zcode-session/zcode-task → 官方 Host拥有内层 CLI pipe并自动处理 reverse auth；bridge不读取credential RPC。launcher负责Main leases/owner/events/streams/资源、逐落点隔离和请求级闸门。
- S03登录成功与落点LIVE、S06真实任务协调NOT_RUN；不得以contract harness或SQLite锁代替。任何可能触及真实数据/Keychain需PLAN delta评审+用户原话确认。
- S04预算与发出前第二请求阻断均未获验收；本节模型请求0、付费调用0、session/close及所有同义外层方法0。
- 初次reference harness缺模块exit1及后台配置刷新失败保留证据；修复loader后成功不覆盖原失败。
- 自评：有界判定与docs交付完成；auth可用性/完整运行authority未验证，未自评总体AC全部PASS，未请求M0解锁。

提交范围：`docs/probes/AUTH-PHASE2-S01.md`、`docs/probes/checks/auth-phase2-s01/`、本HANDOFF。最终commit以Git HEAD为准，证据计数/散列见manifest。scratch脚本原件位于`.agent-work/tmp/host-reuse-probe/`，probe codec不作为产品协议实现直接验收。
