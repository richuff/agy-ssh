# agy-ssh

> **🌐 [English Documentation](./README.md)**

Google Antigravity 页面内嵌的 SSH 服务器管理与持久化交互终端插件。在导航侧边栏提供原生的 **SSH 管理** 入口、全功能的 Linux 风格终端界面，以及面向 AI 对话与 Agent 代理的完整 **Model Context Protocol (MCP)** 工具集。

所有数据均在本地安全处理，内部 API 仅监听 `127.0.0.1`，绝不上传云端。

---

## 核心特性

- **长效持久化 Shell 会话（Persistent Sessions）**：
  - 会话在后台常驻内存，**除非完全退出或重启 Antigravity**，否则会话始终保持连接。
  - **完整的上下文状态继承**：跨轮次执行 `cd /path`、`export VAR=...`、激活 Python 虚拟环境（`source venv/bin/activate`）、自定义 shell 别名等，后续命令持续有效。
  - 内置每 15 秒心跳保活（SSH2 keepalive ping），免遭网络波动或中间网关空闲切断。
  - 支持断线自动重连，保障远程终端随时可用。

- **统一会话池与实时执行同步（Realtime Mirroring）**：
  - 侧边栏 Web 终端与 AI 智能体（通过 MCP）**共享同一个连接与会话池**。
  - 内置中央内存执行日志缓冲区（Central Log Buffer），完整保留所有操作记录。
  - 在 AI 对话中通过 MCP 调用的远程命令与结果，会实时流式镜像同步到对应服务器的终端窗口中。
  - 采用标准 Linux 终端显示风格，去除多余空行，呈现原汁原味的控制台排版：
    ```bash
    user@remote-host:/var/www$ git status
    On branch main
    nothing to commit, working tree clean
    ```

- **深度集成 Model Context Protocol (MCP)**：
  - 自动向 Antigravity 注册 `ssh-manager` MCP 服务，支持对话与后台 Agent 实时调用：
    - `ssh_list_servers`：列出已配置和导入的 SSH 服务器。
    - `ssh_session_start`：在目标服务器上开启长效交互式 Shell 会话。
    - `ssh_session_send`：在持久化会话中发送命令，保留 `cwd` 与环境变量。
    - `ssh_session_list`：查看当前活跃会话（含工作目录、存活时长、空闲时间）。
    - `ssh_session_close`：关闭指定会话或全部活跃会话。
    - `ssh_execute`：直接执行远程命令（默认复用已开启的持久化会话）。
    - `ssh_health_check`：一键巡检目标服务器的 CPU、内存、磁盘与系统负载。
    - `ssh_connection_status`：检查、重连与管理底层 SSH 连接池。
    - `ssh_upload` / `ssh_download`：SFTP 高速文件双向传输。
    - `ssh_history`：查看审计与历史命令执行记录。

- **服务器与凭据管理**：
  - 自动扫描并导入本地 `~/.ssh/config` 中的主机配置。
  - 支持 SSH 私钥（含 Passphrase）与密码认证凭据。
  - 凭据数据采用本地 AES-256-GCM 算法加密存储，安全无忧。
  - 专属搜索栏与下拉选择，去除了浏览器默认蓝色轮廓线，交互视觉更纯净。

- **安全防护与本地审计**：
  - 智能拦截危险破坏性指令（如 `rm -rf /`、`mkfs`、`dd of=/dev/*`、fork bomb、误触 `shutdown`/`reboot` 等）。
  - 所有执行记录完整写入本地 `~/.agy-ssh/audit.log` 审计日志。

---

## 安装方法

### 通过 Antigravity 插件管理器或 CLI 安装

直接通过 GitHub 仓库链接安装：

```bash
agy plugin install https://github.com/richuff/agy-ssh
```

或克隆到 Antigravity 本地插件目录：

```bash
# Windows
git clone https://github.com/richuff/agy-ssh.git %USERPROFILE%\.gemini\config\plugins\agy-ssh

# Linux / macOS
git clone https://github.com/richuff/agy-ssh.git ~/.gemini/config/plugins/agy-ssh
```

重启 Antigravity 或重新加载插件，即可在导航菜单看到 **SSH 管理** 入口。

---

## 项目架构

```
agy-ssh/
├── mcp-server.mjs          # MCP 服务端（Stdio JSON-RPC 2.0，供 AI 对话与 Agent 调用）
├── mcp_config.json         # MCP 服务注册描述清单
├── plugin.json             # Antigravity 插件配置清单
├── skills/
│   └── agy-ssh/
│       └── SKILL.md        # AI 技能指令规则与引导
└── sidecars/ssh-panel/
    ├── bootstrap.mjs       # 进程守护管理：同时拉起 HTTP 后端与 CDP 注入器
    ├── server.mjs          # 本地持久化 HTTP API 后端（127.0.0.1:18761）
    ├── main.mjs            # CDP 页面注入器
    ├── panel.js            # 前端终端面板、服务器列表与凭据配置 UI
    └── sidecar.json        # Sidecar 规范配置
```

---

## MCP 工具参考

在 Antigravity 中与模型对话或派遣 Agent 时，可直接使用以下工具：

| 工具名 | 参数 | 说明 |
|---|---|---|
| `ssh_list_servers` | 无 | 获取所有已配置和已导入的 SSH 服务器列表 |
| `ssh_session_start` | `server`, `name` (可选) | 在目标主机上建立长效交互式持久会话 |
| `ssh_session_send` | `session`, `command`, `timeout` | 向持久会话发送命令，自动维持工作路径和变量 |
| `ssh_session_list` | 无 | 查看活跃会话清单、当前路径及运行状态 |
| `ssh_session_close` | `session` (可选) | 关闭特定会话或清空所有会话 |
| `ssh_execute` | `server`, `command`, `timeout` | 直接执行远程命令（默认复用对应主机的持久会话） |
| `ssh_health_check` | `server`, `detailed` | 获取目标主机的 CPU、内存、磁盘与系统负载 |
| `ssh_upload` | `server`, `localPath`, `remotePath` | SFTP 上传本地文件到远程主机 |
| `ssh_download` | `server`, `remotePath`, `localPath` | SFTP 从远程主机下载文件到本地 |
| `ssh_history` | `limit`, `server` | 查看命令审计与执行历史记录 |

---

## 本地 HTTP API 端点

后台服务默认运行于本地 `127.0.0.1:18761`：

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/status` | GET | 查询插件状态、服务器总数与活跃持久会话数 |
| `/api/servers` | GET, POST, PUT, DELETE | 服务器配置管理 |
| `/api/credentials` | GET, POST, DELETE | 登录凭据与身份角色管理 |
| `/api/exec` | POST | 通过连接池执行远程命令 |
| `/api/sessions/start` | POST | 显式开启新的交互式持久会话 `{ server, name }` |
| `/api/sessions/send` | POST | 向持久会话发送执行命令 `{ session, command }` |
| `/api/sessions/list` | GET, POST | 查询活跃会话列表、当前工作路径与空闲时间 |
| `/api/sessions/close` | POST | 关闭指定持久会话 |
| `/api/connection/status`| POST | 检查、重连或清理底层 SSH 连接池 |
| `/api/health-check` | POST | 获取机器 CPU、内存、磁盘及系统负载 |
| `/api/sftp/upload` | POST | SFTP 文件上传 `{ server, localPath, remotePath }` |
| `/api/sftp/download` | POST | SFTP 文件下载 `{ server, remotePath, localPath }` |
| `/api/history` | GET | 审计日志与命令执行历史 |
| `/api/test` | POST | 测试服务器连通性与凭据正确性 `{ server }` |

---

## 开源协议

[MIT License](LICENSE) © [richuff](https://github.com/richuff)
