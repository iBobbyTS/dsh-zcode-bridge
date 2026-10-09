允许直接更新reference内的仓库，不需要额外询问授权。
用户提出要求后，先验证是否能通过dsh插件接入；如果无法接入且需要大量自建UI或只能用其他方法绕过官方建议路径，询问用户意见。
需修改过桥接逻辑后，先进行[@browser-use](plugin://browser-use@zcode-plugins-official) 验证，通过了再补测试。
