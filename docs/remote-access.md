# 远程访问

服务默认监听 `127.0.0.1:12393`，不要直接开放服务器端口。

在本地电脑执行：

```bash
ssh -L 12393:127.0.0.1:12393 USER@SERVER
```

然后打开 `http://localhost:12393`。关闭 SSH 窗口即可关闭隧道。

本地浏览器推荐最新稳定版 Chrome 或 Edge，并在页面首次点击“开始说话”时允许麦克风。开发诊断应检查：

```javascript
window.isSecureContext
navigator.mediaDevices
window.SpeechRecognition
window.webkitSpeechRecognition
```

页面通过 `/verification/config` 显示 ASR 模式，不返回任何 LLM 密钥。WebSocket 地址为 `/client-ws`；浏览器开发者工具 Network 面板应看到状态为 `101 Switching Protocols`。若无权限，检查地址栏的麦克风权限，确认浏览器访问的是 `localhost`，再重新加载页面。
