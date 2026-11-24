# agy-ssh

Antigravity 页面内嵌的 SSH 服务器管理与持久化会话工具。在侧边栏新增「SSH 管理」入口，同时提供完整的 **MCP（Model Context Protocol）工具集** 与 **长期持久化会话引擎**。

所有数据在本地处理，API 只监听 `127.0.0.1`。

---

## 核心特性

- **长期持久化 Shell 会话**：
  - 会话在内存中长效驻留，**除非重启 Antigravity**，否则会话永不断开。
  - 完整保留上下文状态：连续执行 `cd /path`、`export VAR=...`、激活 Python 虚拟环境等，后续命令持续有效。
  - 内置每 15 秒心跳保活（SSH2 keepalive ping），免遭网络空闲断开。
  - 断线自动重连，保障会话随时可用。
- **对话内 MCP 深度协同（支持 Chat & Agent）**：
  - 自动注册 `ssh-manager` MCP 服务，AI 对话中可直接调用：
    - `ssh_list_servers`：列出已配置的 SSH 服务器列表。
    - `ssh_session_start`：在目标服务器上开启持久化交互式 Shell。
    - `ssh_session_send`：在持久化会话中发送命令，保留 `cwd` 与环境变量。
    - `ssh_session_list`：查看当前活跃的持久化会话（含运行目录、存活时长、空闲时长）。
    - `ssh_session_close`：关闭指定或全部会话。
    - `ssh_execute`：直接执行远程命令（默认复用持久化会话）。
    - `ssh_health_check`：一键获取远程机器的 CPU、内存、磁盘与系统负载。
    - `ssh_connection_status`：检查与重连连接池。
    - `ssh_upload` / `ssh_download`：SFTP 高速文件上传与下载。
- **统一会话池**：侧边栏 Web UI 终端与 AI 智能体在对话中的 MCP 调用共享同一个长连接池，状态实时互通。
- **服务器与凭据管理**：自动导入 `~/.ssh/config`，支持私钥与密码凭据（AES-256-GCM 本地加密保存）。
- **安全策略与审计**：拦截 `rm -rf /`、`mkfs`、`dd of=/dev/*`、fork bomb、`shutdown` 等危险操作，并在 `~/.agy-ssh/audit.log` 完整记录。

---

## 架构

```
agy-ssh/
├── mcp-server.mjs      MCP 服务端（Stdio JSON-RPC 2.0，供 Antigravity 对话与 Agent 调用）
├── mcp_config.json     MCP 服务注册配置
├── plugin.json         插件清单元数据
├── skills/
│   └── agy-ssh/        AI 技能指引（SKILL.md）
└── sidecars/ssh-panel/
    ├── bootstrap.mjs   入口：拉起 API 后端与 CDP 注入器
    ├── server.mjs      本地持久化 HTTP API（127.0.0.1:18761）
    ├── main.mjs        CDP 注入器
    ├── panel.js        前端 UI（侧边栏菜单项 + 浮层终端面板）
    └── sidecar.json    Sidecar 定义
```

### API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/status` | GET | 服务状态（包含版本、服务器数、活跃持久化会话数） |
| `/api/servers` | GET, POST, PUT, DELETE | 服务器配置管理 |
| `/api/credentials` | GET, POST, DELETE | 登录凭据（角色）管理 |
| `/api/exec` | POST | 执行远程命令（默认通过服务器持久化会话执行，保留 `cwd` 与变量） |
| `/api/sessions/start` | POST | 显式开启新的持久化交互式会话 `{ server, name }` |
| `/api/sessions/send` | POST | 在持久化会话中执行命令 `{ session, command, timeout }` |
| `/api/sessions/list` | GET, POST | 查询活跃会话列表及当前工作目录与空闲时间 |
| `/api/sessions/close` | POST | 关闭指定或全部持久化会话 `{ session }` |
| `/api/connection/status` | POST | 管理底层连接池（`status`, `reconnect`, `disconnect`, `cleanup`） |
| `/api/health-check` | POST | 获取机器 CPU、内存、磁盘及系统负载 `{ server, detailed }` |
| `/api/sftp/upload` | POST | SFTP 文件上传 `{ server, localPath, remotePath }` |
| `/api/sftp/download` | POST | SFTP 文件下载 `{ server, remotePath, localPath }` |
| `/api/history` | GET | 命令执行审计历史记录 |
| `/api/test` | POST | 测试服务器连通性 `{ server }` |

---

## License

MIT
