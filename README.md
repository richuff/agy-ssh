# agy-ssh

> **🌐 [中文版 / Chinese Documentation](./README_zh.md)**

An embedded SSH server manager and persistent shell session environment for Google Antigravity. Provides a dedicated **SSH Manager** sidebar panel, an interactive Linux-style terminal, and a comprehensive **Model Context Protocol (MCP)** toolset for AI agents.

All data is processed strictly locally; the internal API listens exclusively on `127.0.0.1`.

---

## Key Features

- **Long-lived Persistent Shell Sessions**:
  - Sessions stay active in-memory **until Antigravity restarts**.
  - **Full state retention**: continuous commands retain working directory (`cd /path`), exported environment variables (`export KEY=val`), activated Python virtual environments (`source venv/bin/activate`), and custom shell aliases.
  - Built-in 15-second SSH2 keepalive ping prevents idle dropouts from firewalls or remote hosts.
  - Automatic reconnection ensures sessions are available on-demand.

- **Unified Session Pool & Realtime Execution Mirroring**:
  - The sidebar Web UI terminal and AI chat agents (via MCP) **share the same connection and session pool**.
  - Central in-memory log buffer records all command executions and outputs.
  - MCP tool executions from the chat window stream into the corresponding server terminal in real-time with zero extraneous blank lines, matching standard Linux console output format:
    ```bash
    user@remote-host:/var/www$ git status
    On branch main
    nothing to commit, working tree clean
    ```

- **Deep Model Context Protocol (MCP) Integration**:
  - Automatically registers the `ssh-manager` MCP server with eager and lazy-loaded tools for chat and background agents:
    - `ssh_list_servers`: List configured SSH servers.
    - `ssh_session_start`: Spawn an interactive persistent shell on a target server.
    - `ssh_session_send`: Execute commands in a persistent session while preserving `cwd` and environment.
    - `ssh_session_list`: Inspect active sessions, including working directories, uptime, and idle duration.
    - `ssh_session_close`: Terminate specific or all active sessions.
    - `ssh_execute`: One-shot remote execution (transparently reuses active persistent sessions).
    - `ssh_health_check`: Retrieve CPU, memory, disk usage, and system load.
    - `ssh_connection_status`: Check and manage the underlying SSH pool.
    - `ssh_upload` / `ssh_download`: High-speed SFTP file transfers.
    - `ssh_history`: View audited command execution logs.

- **Server & Credential Management**:
  - Automatically parses and imports host definitions from `~/.ssh/config`.
  - Supports private keys (with passphrase) and password credentials.
  - Sensitive credentials are encrypted locally using AES-256-GCM.
  - Clean search bar with instant autocomplete and focus ring optimization.

- **Safety Guardrails & Local Audit**:
  - Intercepts destructive patterns (e.g., `rm -rf /`, `mkfs`, `dd of=/dev/*`, fork bombs, accidental `shutdown`/`reboot`).
  - Full audit trail recorded in `~/.agy-ssh/audit.log`.

---

## Installation

### From Antigravity Plugin Manager or CLI

Install directly from the GitHub repository:

```bash
agy plugin install https://github.com/richuff/agy-ssh
```

Or clone into your local Antigravity plugin directory:

```bash
# Windows
git clone https://github.com/richuff/agy-ssh.git %USERPROFILE%\.gemini\config\plugins\agy-ssh

# Linux / macOS
git clone https://github.com/richuff/agy-ssh.git ~/.gemini/config/plugins/agy-ssh
```

Restart Antigravity or reload plugins. The **SSH Manager** item will appear in your Antigravity navigation menu.

---

## Architecture

```
agy-ssh/
├── mcp-server.mjs          # MCP Server (Stdio JSON-RPC 2.0 for Chat & Agent tools)
├── mcp_config.json         # MCP service registration descriptor
├── plugin.json             # Antigravity plugin manifest
├── skills/
│   └── agy-ssh/
│       └── SKILL.md        # Agent workflow guide and instruction rules
└── sidecars/ssh-panel/
    ├── bootstrap.mjs       # Process supervisor: launches HTTP backend & CDP injector
    ├── server.mjs          # Persistent local HTTP API daemon (127.0.0.1:18761)
    ├── main.mjs            # CDP injector injecting UI into Antigravity
    ├── panel.js            # Frontend terminal, server manager & session viewer
    └── sidecar.json        # Sidecar process configuration
```

---

## MCP Tools Reference

When chatting with Antigravity models or delegating to agents, the following tools are available out-of-the-box:

| Tool | Parameters | Description |
|---|---|---|
| `ssh_list_servers` | None | Lists all saved and imported SSH servers |
| `ssh_session_start` | `server`, `name` (optional) | Starts a persistent shell session on the server |
| `ssh_session_send` | `session`, `command`, `timeout` | Sends a command to a persistent session, retaining state |
| `ssh_session_list` | None | Lists active persistent sessions with cwd and status |
| `ssh_session_close` | `session` (optional) | Closes a specific session or all sessions |
| `ssh_execute` | `server`, `command`, `timeout` | Executes command on remote server (reuses session by default) |
| `ssh_health_check` | `server`, `detailed` | Inspects remote CPU, memory, disk, and load |
| `ssh_upload` | `server`, `localPath`, `remotePath` | SFTP upload local file to remote host |
| `ssh_download` | `server`, `remotePath`, `localPath` | SFTP download remote file to local machine |
| `ssh_history` | `limit`, `server` | Views command execution and audit log |

---

## Local HTTP API Endpoints

The internal daemon runs locally on `127.0.0.1:18761`:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/status` | GET | Service status, server count, and active session count |
| `/api/servers` | GET, POST, PUT, DELETE | Server configuration management |
| `/api/credentials` | GET, POST, DELETE | Credential and auth profile management |
| `/api/exec` | POST | Execute command via persistent session pool |
| `/api/sessions/start` | POST | Explicitly spawn interactive persistent session |
| `/api/sessions/send` | POST | Send command to persistent session `{ session, command }` |
| `/api/sessions/list` | GET, POST | Query active sessions, CWD, and idle time |
| `/api/sessions/close` | POST | Close persistent session |
| `/api/connection/status`| POST | Inspect or reconnect connection pool |
| `/api/health-check` | POST | Retrieve CPU, memory, disk & system load |
| `/api/sftp/upload` | POST | SFTP file upload `{ server, localPath, remotePath }` |
| `/api/sftp/download` | POST | SFTP file download `{ server, remotePath, localPath }` |
| `/api/history` | GET | Audit log and command execution history |
| `/api/test` | POST | Test connectivity and credentials `{ server }` |

---

## License

[MIT License](LICENSE) © [richuff](https://github.com/richuff)
