---
name: agy-ssh
description: Manage and execute commands on remote SSH servers using persistent sessions and MCP tools. Connect to servers, run commands with context and environment retention, monitor system health, and manage sessions across Antigravity chat and sidebar UI.
---

# SSH Manager (agy-ssh)

The `agy-ssh` plugin provides SSH server management, long-lived persistent shell sessions, and MCP tool access directly within Antigravity.

## Core Capabilities

1. **Persistent Shell Sessions**:
   - Sessions remain open indefinitely until Antigravity is restarted.
   - Interactive shell context (`cwd`, exported environment variables, virtualenvs, command history) persists across commands and conversation turns.
   - Built-in keepalive ping (15s) ensures connections do not drop during idle periods.
   - Automatic reconnect if disconnected.

2. **MCP Tool Integration**:
   - The assistant can interact with SSH servers using the `ssh-manager` MCP tools.
   - Available tools include:
     - `ssh_list_servers`: List all configured SSH servers from `~/.agy-ssh/servers.json`.
     - `ssh_session_start`: Start a new persistent interactive shell session on a server.
     - `ssh_session_send`: Send a command to an existing session, maintaining persistent working directory and environment variables.
     - `ssh_session_list`: List active persistent sessions with current directory, uptime, and idle time.
     - `ssh_session_close`: Terminate an active session (or all sessions).
     - `ssh_execute`: Execute a command (routes to the server's persistent session by default or one-shot).
     - `ssh_health_check`: Get CPU, memory, disk, and uptime metrics.
     - `ssh_connection_status`: Inspect or manage connection pools.
     - `ssh_history`: View recent execution logs.
     - `ssh_upload` / `ssh_download`: SFTP file transfers.

3. **Unified Session Context**:
   - Sessions are shared between the Web UI panel in the Antigravity sidebar and the conversation MCP tools.
