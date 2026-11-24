#!/usr/bin/env node
/**
 * mcp-server.mjs — agy-ssh MCP 服务端（Stdio JSON-RPC 2.0 协议）
 *
 * 与 Antigravity 深度联动：
 * 1. 响应 initialize、tools/list、tools/call、ping 等标准 MCP 请求。
 * 2. 动态读取工具模式并代理请求至本地持久化后端（http://127.0.0.1:18761）。
 * 3. 共享同一进程级长会话池，使 AI 对话中的 MCP 工具调用与前端面板 Web UI 拥有完全相同的会话上下文与持久状态。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取本地 API 服务端口
function getApiPort() {
  const portFile = path.join(__dirname, "sidecars", "ssh-panel", "port.json");
  if (fs.existsSync(portFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(portFile, "utf8"));
      if (data.port) return data.port;
    } catch (e) {}
  }
  return Number(process.env.AGY_SSH_PORT) || 18761;
}

// HTTP 请求封装
function apiRequest(method, pathname, body = null) {
  const port = getApiPort();
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: pathname,
      method,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
      timeout: 305000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data || "{}");
          resolve(parsed);
        } catch (e) {
          resolve({ ok: false, error: data || `HTTP ${res.statusCode}` });
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`无法连接 agy-ssh 后端服务 (127.0.0.1:${port}): ${err.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("请求 agy-ssh 后端服务超时"));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// 读取工具模式 (带内存缓存，避免高频请求重复扫描磁盘与 JSON 解析)
let cachedTools = null;
function getToolDefinitions() {
  if (cachedTools && cachedTools.length > 0) return cachedTools;
  const schemaDir = path.join(os.homedir(), ".gemini", "antigravity", "mcp", "ssh-manager");
  const tools = [];

  if (fs.existsSync(schemaDir)) {
    try {
      const files = fs.readdirSync(schemaDir);
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(schemaDir, f), "utf8"));
          if (raw.name && raw.parameters) {
            tools.push({
              name: raw.name,
              description: raw.description || "",
              inputSchema: raw.parameters,
            });
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  if (tools.length === 0) {
    // 内置模式兜底
    tools.push(
      {
        name: "ssh_list_servers",
        description: "Lists all SSH servers defined in the loaded configuration.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "ssh_session_start",
        description: "Opens a new persistent interactive shell on the named configured server and returns a generated session ID.",
        inputSchema: {
          type: "object",
          properties: {
            server: { type: "string", description: "Server name from configuration" },
            name: { type: "string", description: "Optional session name for identification" },
          },
          required: ["server"],
        },
      },
      {
        name: "ssh_session_send",
        description: "Runs one command inside an already-open session identified by its session ID, reusing the persisted working directory, environment, and history.",
        inputSchema: {
          type: "object",
          properties: {
            session: { type: "string", description: "Session ID from ssh_session_start" },
            command: { type: "string", description: "Command to execute in the session" },
            timeout: { type: "number", description: "Command timeout in milliseconds (default: 30000)" },
          },
          required: ["session", "command"],
        },
      },
      {
        name: "ssh_session_list",
        description: "Lists currently active SSH sessions with their ID, server, state, working directory, command count, age, and idle time.",
        inputSchema: {
          type: "object",
          properties: {
            server: { type: "string", description: "Filter by server name" },
          },
        },
      },
      {
        name: "ssh_session_close",
        description: "Terminates an open SSH session given its session ID.",
        inputSchema: {
          type: "object",
          properties: {
            session: { type: "string", description: "Session ID to close (or 'all' to close all sessions)" },
          },
          required: ["session"],
        },
      },
      {
        name: "ssh_execute",
        description: "Runs a shell command over SSH on a named configured server and returns stdout, stderr, and exit code.",
        inputSchema: {
          type: "object",
          properties: {
            server: { type: "string", description: "Server name from configuration" },
            command: { type: "string", description: "Command to execute" },
            cwd: { type: "string", description: "Working directory (optional)" },
            timeout: { type: "number", description: "Timeout in ms" },
          },
          required: ["server", "command"],
        },
      },
      {
        name: "ssh_connection_status",
        description: "Inspects and manages the pooled SSH connections held by this server process.",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["status", "reconnect", "disconnect", "cleanup"] },
            server: { type: "string" },
          },
          required: ["action"],
        },
      },
      {
        name: "ssh_health_check",
        description: "Runs a read-only health check on the named server.",
        inputSchema: {
          type: "object",
          properties: {
            server: { type: "string" },
            detailed: { type: "boolean" },
          },
          required: ["server"],
        },
      },
      {
        name: "ssh_history",
        description: "Returns the in-memory log of SSH commands previously run.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number" },
            server: { type: "string" },
            search: { type: "string" },
            success: { type: "boolean" },
          },
        },
      }
    );
  }

  if (tools.length > 0) cachedTools = tools;
  return tools;
}

// 处理具体工具调用
async function handleToolCall(name, args) {
  switch (name) {
    case "ssh_list_servers": {
      const res = await apiRequest("GET", "/api/servers");
      if (!res.ok) throw new Error(res.error || "获取服务器列表失败");
      const list = (res.servers || []).map((s) => ({
        name: s.name,
        host: s.hostname || s.name,
        user: s.user || (s.credentialId ? "已关联凭据" : "系统默认"),
        port: s.port || 22,
        authType: s.credentialId ? "credential" : (s.identityFile ? "key" : "default"),
        group: s.group || "默认",
        defaultDirectory: "~",
      }));
      return list;
    }

    case "ssh_session_start": {
      const { server: serverName, name: sessionLabel } = args || {};
      if (!serverName) throw new Error("缺少必需参数: server");
      const res = await apiRequest("POST", "/api/sessions/start", {
        server: serverName,
        name: sessionLabel,
      });
      if (!res.ok) throw new Error(res.error || "创建会话失败");
      return res.session;
    }

    case "ssh_session_send": {
      const { session, command, timeout } = args || {};
      if (!session) throw new Error("缺少必需参数: session");
      if (!command) throw new Error("缺少必需参数: command");
      const res = await apiRequest("POST", "/api/sessions/send", {
        session,
        command,
        timeout: timeout || 30000,
        source: "mcp",
      });
      if (res.error) throw new Error(res.error);
      return {
        output: res.stdout || "",
        stderr: res.stderr || "",
        exitCode: res.code ?? 0,
        cwd: res.cwd || "",
        duration: res.ms || 0,
        ok: res.ok,
      };
    }

    case "ssh_session_list": {
      const { server: serverFilter } = args || {};
      const res = await apiRequest("POST", "/api/sessions/list", {
        server: serverFilter || "",
      });
      if (!res.ok) throw new Error(res.error || "获取会话列表失败");
      return res.sessions || [];
    }

    case "ssh_session_close": {
      const { session } = args || {};
      if (!session) throw new Error("缺少必需参数: session");
      const res = await apiRequest("POST", "/api/sessions/close", { session });
      if (!res.ok) throw new Error(res.error || "关闭会话失败");
      return { success: true, closedCount: res.closed };
    }

    case "ssh_execute": {
      const { server: serverName, command, cwd, timeout } = args || {};
      if (!serverName) throw new Error("缺少必需参数: server");
      if (!command) throw new Error("缺少必需参数: command");
      const fullCmd = cwd ? `cd ${cwd} && ${command}` : command;
      const res = await apiRequest("POST", "/api/exec", {
        server: serverName,
        command: fullCmd,
        timeout: timeout || 30000,
        source: "mcp",
      });
      if (res.error) throw new Error(res.error);
      return {
        stdout: res.stdout || "",
        stderr: res.stderr || "",
        exitCode: res.code ?? 0,
        cwd: res.cwd || cwd || "",
        duration: res.ms || 0,
        ok: res.ok,
      };
    }

    case "ssh_connection_status": {
      const { action = "status", server: serverName } = args || {};
      const res = await apiRequest("POST", "/api/connection/status", {
        action,
        server: serverName,
      });
      if (!res.ok) throw new Error(res.error || "操作连接池失败");
      return res;
    }

    case "ssh_health_check": {
      const { server: serverName, detailed } = args || {};
      if (!serverName) throw new Error("缺少必需参数: server");
      const res = await apiRequest("POST", "/api/health-check", {
        server: serverName,
        detailed,
      });
      if (!res.ok) throw new Error(res.error || "健康检查执行失败");
      return res;
    }

    case "ssh_history": {
      const { limit = 20, server: serverFilter, search, success } = args || {};
      const res = await apiRequest("GET", "/api/history");
      if (!res.ok) throw new Error(res.error || "获取历史记录失败");
      let list = res.history || [];
      if (serverFilter) list = list.filter((h) => h.server?.toLowerCase().includes(serverFilter.toLowerCase()));
      if (search) list = list.filter((h) => h.command?.includes(search));
      if (success !== undefined) list = list.filter((h) => !!h.ok === !!success);
      return list.slice(0, limit);
    }

    case "ssh_upload": {
      const { server: serverName, localPath, remotePath } = args || {};
      if (!serverName || !localPath || !remotePath) throw new Error("缺少必需参数: server, localPath 或 remotePath");
      const res = await apiRequest("POST", "/api/sftp/upload", {
        server: serverName,
        localPath,
        remotePath,
      });
      if (!res.ok) throw new Error(res.error || "SFTP 上传失败");
      return res;
    }

    case "ssh_download": {
      const { server: serverName, remotePath, localPath } = args || {};
      if (!serverName || !remotePath || !localPath) throw new Error("缺少必需参数: server, remotePath 或 localPath");
      const res = await apiRequest("POST", "/api/sftp/download", {
        server: serverName,
        remotePath,
        localPath,
      });
      if (!res.ok) throw new Error(res.error || "SFTP 下载失败");
      return res;
    }

    default:
      // 通用回退：若未专门实现，尝试以命令方式在会话或执行接口中运行
      throw new Error(`工具 ${name} 在当前版本中暂未注册处理器`);
  }
}

// 格式化输出为 MCP 标准响应
function formatResult(value) {
  if (typeof value === "string") {
    return { content: [{ type: "text", text: value }] };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

// 统一 JSON-RPC 消息处理
async function handleMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  const { id, method, params } = msg;

  if (method === "notifications/initialized") {
    // 客户端通知，无需回复
    return;
  }

  if (method === "ping") {
    sendResponse(id, {});
    return;
  }

  if (method === "initialize") {
    sendResponse(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: "ssh-manager",
        version: "2.1.0",
      },
    });
    return;
  }

  if (method === "tools/list") {
    const tools = getToolDefinitions();
    sendResponse(id, { tools });
    return;
  }

  if (method === "tools/call") {
    const { name, arguments: toolArgs } = params || {};
    try {
      const result = await handleToolCall(name, toolArgs || {});
      sendResponse(id, formatResult(result));
    } catch (err) {
      sendResponse(id, {
        isError: true,
        content: [{ type: "text", text: "执行错误: " + err.message }],
      });
    }
    return;
  }

  // 未知方法
  if (id !== undefined) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
}

function sendResponse(id, result) {
  const payload = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write(payload + "\n");
}

function sendError(id, code, message) {
  const payload = JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
  process.stdout.write(payload + "\n");
}

// 标准输入行缓冲流解析
let inputBuffer = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  inputBuffer += chunk;

  // 支持 Content-Length 帧与换行符分隔的 JSON-RPC 消息
  while (true) {
    if (inputBuffer.startsWith("Content-Length:")) {
      const headerEnd = inputBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const match = inputBuffer.slice(0, headerEnd).match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        inputBuffer = inputBuffer.slice(headerEnd + 4);
        continue;
      }
      const len = parseInt(match[1], 10);
      const totalLen = headerEnd + 4 + len;
      if (inputBuffer.length < totalLen) break;
      const body = inputBuffer.slice(headerEnd + 4, totalLen);
      inputBuffer = inputBuffer.slice(totalLen);
      try {
        const msg = JSON.parse(body);
        handleMessage(msg);
      } catch (e) {}
    } else {
      const newlineIndex = inputBuffer.indexOf("\n");
      if (newlineIndex === -1) break;
      const line = inputBuffer.slice(0, newlineIndex).trim();
      inputBuffer = inputBuffer.slice(newlineIndex + 1);
      if (line) {
        try {
          const msg = JSON.parse(line);
          handleMessage(msg);
        } catch (e) {}
      }
    }
  }
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
