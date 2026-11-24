#!/usr/bin/env node
/**
 * server.mjs — agy-ssh 本地 HTTP 后端（支持长期持久化会话与 MCP 联动）
 *
 * API：
 *   GET    /api/status
 *   GET|POST|PUT|DELETE  /api/servers            服务器增删改查
 *   GET|POST|DELETE      /api/credentials        凭据（角色）管理
 *   POST   /api/exec                            执行命令（支持持久化会话与一次性模式）
 *   POST   /api/test                            测试连接
 *   GET    /api/history
 *   POST   /api/known-hosts/remove
 *   POST   /api/sessions/start                  开启持久化交互式 Shell 会话
 *   POST   /api/sessions/send                   在持久化会话中发送命令（保留 cwd、环境变量）
 *   GET|POST /api/sessions/list                 查询活跃持久化会话列表
 *   POST   /api/sessions/close                  关闭持久化会话
 *   POST   /api/connection/status               连接池状态与重连管理
 *   POST   /api/health-check                    服务器健康状态与指标检查
 *   POST   /api/sftp/upload                     SFTP 文件上传
 *   POST   /api/sftp/download                   SFTP 文件下载
 *
 * 会话持久性：
 *   - 保持长连接池与持久 Shell 流
 *   - 启用 SSH2 keepalive ping（15s），防止空闲超时被远程断开
 *   - 掉线时自动重连并恢复就绪状态
 *   - 除非 Antigravity 宿主重启（本 Sidecar 进程退出），否则会话持续存活
 */
import http from "node:http";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const require = createRequire(import.meta.url);
let ssh2 = null;
try { ssh2 = require("ssh2"); } catch (e) { console.error("[agy-ssh] ssh2 未加载:", e.message); }
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { homedir, hostname as osHostname } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(homedir(), ".agy-ssh");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const CREDS_FILE = path.join(DATA_DIR, "credentials.json");
const AUDIT_LOG = path.join(DATA_DIR, "audit.log");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const PORT_FILE = path.join(__dirname, "port.json");

mkdirSync(DATA_DIR, { recursive: true });

/* ---------------- 凭据加解密 ----------------
 * AES-256-GCM，密钥由机器信息派生（用户名 + hostname + 固定盐）。
 */
const KEY = createHash("sha256")
  .update([process.env.USERNAME || process.env.USER || "user",
           process.env.COMPUTERNAME || osHostname(),
           "agy-ssh-v2"].join("|"))
  .digest();

function encrypt(text) {
  if (!text) return "";
  try {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", KEY, iv);
    const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
    const tag = c.getAuthTag();
    return "aes:" + Buffer.concat([iv, tag, enc]).toString("base64");
  } catch (e) {
    return "b64:" + Buffer.from(text, "utf8").toString("base64");
  }
}

function decrypt(stored) {
  if (!stored) return "";
  const kind = stored.split(":")[0];
  const val = stored.slice(kind.length + 1);
  if (kind === "aes") {
    try {
      const raw = Buffer.from(val, "base64");
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const enc = raw.subarray(28);
      const d = createDecipheriv("aes-256-gcm", KEY, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
    } catch (e) {
      console.error("[agy-ssh] 解密失败:", e.message);
      return "";
    }
  }
  if (kind === "b64" || kind === "plain") return Buffer.from(val, "base64").toString("utf8");
  return stored;
}

/* ---------------- 存储 ---------------- */
function readJson(file, def) {
  if (!existsSync(file)) return def;
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { return def; }
}
function writeJson(file, obj) {
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    writeFileSync(temp, JSON.stringify(obj, null, 2), { encoding: "utf8", flag: "wx" });
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
}

function loadServers() {
  return readJson(SERVERS_FILE, null);
}
function saveServers(list) {
  writeJson(SERVERS_FILE, list);
}
function loadCreds() {
  return readJson(CREDS_FILE, []);
}
function saveCreds(list) {
  writeJson(CREDS_FILE, list);
}

/* ---------------- 首次从 ~/.ssh/config 导入 ---------------- */
function importSSHConfig() {
  const f = path.join(homedir(), ".ssh", "config");
  if (!existsSync(f)) return [];
  const text = readFileSync(f, "utf8");
  const out = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(\S+)\s+(.+)$/);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "host") {
      if (cur) out.push(cur);
      cur = { name: v, hostname: v, user: "", port: 22, identityFile: "" };
    } else if (cur) {
      if (k === "hostname") cur.hostname = v;
      else if (k === "user") cur.user = v;
      else if (k === "port") cur.port = Number(v) || 22;
      else if (k === "identityfile") cur.identityFile = v.replace(/^"|"$/g, "");
    }
  }
  if (cur) out.push(cur);
  return out.filter((s) => s.name !== "*");
}

function ensureServers() {
  let s = loadServers();
  if (s === null) {
    s = importSSHConfig();
    saveServers(s);
    audit({ action: "import-ssh-config", count: s.length });
  }
  return s;
}

/* ---------------- 安全 ---------------- */
const DENY = [
  /rm\s+-rf\s+[\/\\](\s|$)/i, /rm\s+-rf\s+\*/i, /mkfs\b/i,
  /\bdd\s+.*of=\/dev\//i, />\s*\/dev\/sd[a-z]/i, /:\(\)\{.*\};/i,
  /shutdown\b/i, /reboot\b/i, /init\s+0/i, /chmod\s+-R\s+777\s+\//i,
];
function checkCommand(cmd) {
  for (const re of DENY) if (re.test(cmd)) return re.source;
  return null;
}
function audit(entry) {
  try { appendFileSync(AUDIT_LOG, JSON.stringify({ at: Date.now(), ...entry }) + "\n"); }
  catch (e) {}
}
function readHistory() { return readJson(HISTORY_FILE, []); }
function pushHistory(entry) {
  const h = readHistory();
  h.unshift({ at: Date.now(), ...entry });
  writeJson(HISTORY_FILE, h.slice(0, 100));
}

function connectionCredential(server, body = {}) {
  const id = body.credentialId ?? server.credentialId;
  if (id) {
    const credential = loadCreds().find((item) => item.id === id);
    if (!credential) return { error: "凭据角色已不存在，请编辑服务器并重新选择登录方式" };
    return { credential };
  }
  if (body.username || body.password) {
    if (body.hostname !== undefined &&
        (body.hostname !== (server.hostname || server.name) || body.port !== (server.port || 22))) {
      return { error: "服务器地址已变更，请刷新后重新连接" };
    }
    return {
      credential: {
        username: String(body.username || ""),
        password: body.password ? encrypt(String(body.password)) : "",
      },
    };
  }
  return { credential: null };
}

/* ---------------- 一次性 SSH 执行（回退/测试用） ---------------- */
function execSSHPassword(host, port, username, password, command, timeoutMs) {
  return new Promise((resolve) => {
    if (!ssh2) return resolve({ ok: false, err: "ssh2 库未加载，无法使用密码认证" });
    const { Client } = ssh2;
    const conn = new Client();
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { conn.end(); } catch (e) {}
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, err: "连接/执行超时" }), timeoutMs);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) return finish({ ok: false, err: err.message });
        let out = "", stderr = "";
        stream.on("data", (d) => (out += d.toString()));
        stream.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
        stream.on("close", (code) => finish({ ok: code === 0, code, out, err: stderr }));
      });
    });
    conn.on("error", (e) => finish({ ok: false, err: e.message }));

    try {
      conn.connect({ host, port: port || 22, username, password, readyTimeout: Math.min(timeoutMs, 15000) });
    } catch (e) {
      finish({ ok: false, err: e.message });
    }
  });
}

function execSSHKey(server, command, cred, timeoutMs) {
  return new Promise((resolve) => {
    const args = [
      "-o", "BatchMode=yes",
      "-o", "ConnectTimeout=8",
      "-o", "StrictHostKeyChecking=accept-new",
      "-p", String(server.port || 22),
    ];
    const user = (cred && cred.username) || server.user || "";
    const host = server.hostname || server.name;
    const identity = (cred && cred.identityFile) || server.identityFile;
    if (identity) args.push("-i", identity.replace(/^~\//, homedir() + "/"));
    if (user) args.push(user + "@" + host);
    else args.push(host);
    args.push(command);

    const p = spawn("ssh", args, { windowsHide: true });
    let out = "", err = "", done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; p.kill(); resolve({ ok: false, out, err: err + "\n[超时]" }); }
    }, timeoutMs);
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (err += c));
    p.on("close", (code) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ ok: code === 0, code, out, err });
    });
    p.on("error", (e) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ ok: false, out, err: e.message });
    });
  });
}

function execSSH(server, command, cred, timeoutMs = 30000) {
  const password = cred && cred.password ? decrypt(cred.password) : "";
  if (password) {
    const username = cred.username || server.user;
    if (!username) return Promise.resolve({ ok: false, err: "密码登录需要 SSH 用户名" });
    return execSSHPassword(
      server.hostname || server.name,
      server.port || 22,
      username,
      password, command, timeoutMs);
  }
  return execSSHKey(server, command, cred, timeoutMs);
}

/* ---------------- 长期持久化 SSH 会话管理器 ---------------- */
class PersistentSession {
  constructor(id, server, cred, name) {
    this.id = id;
    this.server = server.name;
    this.serverConfig = server;
    this.cred = cred;
    this.name = name || server.name;
    this.cwd = "~";
    this.createdAt = Date.now();
    this.lastActiveAt = Date.now();
    this.commandCount = 0;
    this.state = "connecting";
    this.queue = [];
    this.running = false;
    this.currentTask = null;
    this.stdoutBuf = "";
    this.stderrBuf = "";
    this.client = null;
    this.stream = null;
    this.reconnecting = false;
  }

  async connect() {
    if (this.state === "connected" && this.stream && this.client) return;
    this.state = "connecting";
    return new Promise((resolve, reject) => {
      if (!ssh2) return reject(new Error("ssh2 库未加载，无法使用持久化会话"));
      const { Client } = ssh2;
      const conn = new Client();
      let connected = false;

      const timer = setTimeout(() => {
        if (!connected) {
          try { conn.end(); } catch (e) {}
          this.state = "error";
          reject(new Error(`连接服务器 ${this.server} 超时 (15s)`));
        }
      }, 15000);

      conn.on("ready", () => {
        connected = true;
        clearTimeout(timer);
        this.client = conn;

        // 打开非 PTY 交互式 Shell 流（纯净 stdout/stderr，免去终端 ANSI 控制码干扰）
        conn.shell(false, (err, stream) => {
          if (err) {
            this.state = "error";
            try { conn.end(); } catch (e) {}
            return reject(err);
          }
          this.stream = stream;
          this.state = "connected";
          this.lastActiveAt = Date.now();

          stream.on("data", (d) => {
            this.stdoutBuf += d.toString("utf8");
            this.checkCompletion();
          });
          stream.stderr.on("data", (d) => {
            this.stderrBuf += d.toString("utf8");
            this.checkCompletion();
          });
          stream.on("close", () => {
            this.stream = null;
            if (this.state !== "closed") this.state = "disconnected";
          });

          // 会话启动稍作停顿以吞噬迎宾欢迎词，并获取初始 $PWD
          setTimeout(async () => {
            try {
              this.stdoutBuf = "";
              this.stderrBuf = "";
              const init = await this.run("pwd", 5000);
              if (init.cwd) this.cwd = init.cwd;
            } catch (e) {}
            resolve(this);
          }, 400);
        });
      });

      conn.on("error", (err) => {
        clearTimeout(timer);
        if (!connected) {
          this.state = "error";
          reject(err);
        } else {
          this.state = "disconnected";
        }
      });

      conn.on("close", () => {
        this.client = null;
        this.stream = null;
        if (this.state !== "closed") this.state = "disconnected";
      });

      const host = this.serverConfig.hostname || this.serverConfig.name;
      const port = this.serverConfig.port || 22;
      const password = this.cred && this.cred.password ? decrypt(this.cred.password) : "";
      const username = (this.cred && this.cred.username) || this.serverConfig.user;

      const opts = {
        host,
        port,
        username,
        readyTimeout: 15000,
        keepaliveInterval: 15000, // 每 15 秒心跳保活，防止路由器或服务器断链
        keepaliveCountMax: 10,
      };

      if (password) {
        opts.password = password;
      } else {
        const idFile = (this.cred && this.cred.identityFile) || this.serverConfig.identityFile;
        if (idFile) {
          const resolved = idFile.replace(/^~[\\/]/, homedir() + path.sep);
          if (existsSync(resolved)) {
            try { opts.privateKey = readFileSync(resolved); } catch (e) {}
          }
        }
        if (!opts.privateKey && process.env.SSH_AUTH_SOCK) {
          opts.agent = process.env.SSH_AUTH_SOCK;
        }
      }

      try {
        conn.connect(opts);
      } catch (e) {
        clearTimeout(timer);
        this.state = "error";
        reject(e);
      }
    });
  }

  async ensureReady() {
    if (this.state === "connected" && this.stream && this.client) return;
    if (this.reconnecting) {
      await new Promise((r) => setTimeout(r, 1000));
      return this.ensureReady();
    }
    this.reconnecting = true;
    try {
      try { this.stream?.end(); } catch (e) {}
      try { this.client?.end(); } catch (e) {}
      await this.connect();
    } finally {
      this.reconnecting = false;
    }
  }

  run(cmd, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const id = randomUUID().slice(0, 8);
      this.queue.push({ id, cmd, timeout, resolve, reject, startAt: Date.now() });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.running || this.queue.length === 0) return;
    this.running = true;
    const task = this.queue[0];
    this.currentTask = task;

    try {
      await this.ensureReady();
    } catch (err) {
      this.currentTask = null;
      this.running = false;
      this.queue.shift();
      task.resolve({
        ok: false,
        code: -1,
        stdout: "",
        stderr: "SSH连接已断开且重连失败: " + err.message,
        cwd: this.cwd,
        ms: Date.now() - task.startAt,
      });
      this.processQueue();
      return;
    }

    this.stdoutBuf = "";
    this.stderrBuf = "";
    this.lastActiveAt = Date.now();
    this.commandCount++;

    const sentinel = "__AGY_STATUS_" + task.id + "__";
    task.sentinel = sentinel;

    task.timer = setTimeout(() => {
      if (this.currentTask === task) {
        const ms = Date.now() - task.startAt;
        task.resolve({
          ok: false,
          code: -1,
          stdout: this.stdoutBuf,
          stderr: (this.stderrBuf ? this.stderrBuf + "\n" : "") + `[命令执行超时 (${task.timeout}ms)]`,
          cwd: this.cwd,
          ms,
        });
        this.currentTask = null;
        this.running = false;
        this.queue.shift();
        this.processQueue();
      }
    }, task.timeout);

    // 格式：执行真实命令后，打印带有退出码和当前目录的哨兵标记
    const wrapped = task.cmd + '\nprintf "\\n' + sentinel + ':%d:%s\\n" $? "$PWD"\n';
    try {
      this.stream.write(wrapped);
    } catch (e) {
      clearTimeout(task.timer);
      this.currentTask = null;
      this.running = false;
      this.queue.shift();
      task.resolve({
        ok: false,
        code: -1,
        stdout: "",
        stderr: e.message,
        cwd: this.cwd,
        ms: Date.now() - task.startAt,
      });
      this.processQueue();
    }
  }

  checkCompletion() {
    if (!this.running || !this.currentTask) return;
    const task = this.currentTask;
    const marker = task.sentinel + ":";
    const idx = this.stdoutBuf.indexOf(marker);
    if (idx !== -1) {
      const rest = this.stdoutBuf.slice(idx + marker.length);
      const endIdx = rest.indexOf("\n");
      if (endIdx !== -1) {
        clearTimeout(task.timer);
        const meta = rest.slice(0, endIdx).trim();
        const colon = meta.indexOf(":");
        const code = parseInt(meta.slice(0, colon), 10);
        const cwd = meta.slice(colon + 1);
        let out = this.stdoutBuf.slice(0, idx);
        out = out.replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, "");
        let err = this.stderrBuf.replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, "");
        this.cwd = cwd || this.cwd;
        this.lastActiveAt = Date.now();
        const ms = Date.now() - task.startAt;

        this.currentTask = null;
        this.running = false;
        this.queue.shift();
        task.resolve({
          ok: code === 0,
          code,
          stdout: out,
          stderr: err,
          cwd: this.cwd,
          ms,
        });
        this.processQueue();
      }
    }
  }

  close() {
    this.state = "closed";
    try { this.stream?.write("exit\n"); } catch (e) {}
    try { this.stream?.end(); } catch (e) {}
    try { this.client?.end(); } catch (e) {}
    this.stream = null;
    this.client = null;
  }
}

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.serverDefaults = new Map();
  }

  get(id) {
    return this.sessions.get(id);
  }

  list(serverFilter) {
    const now = Date.now();
    const result = [];
    for (const [id, s] of this.sessions.entries()) {
      if (serverFilter && !s.server.toLowerCase().includes(serverFilter.toLowerCase())) continue;
      result.push({
        id: s.id,
        name: s.name || s.id,
        server: s.server,
        cwd: s.cwd,
        state: s.state,
        commandCount: s.commandCount,
        age: Math.floor((now - s.createdAt) / 1000),
        idleTime: Math.floor((now - s.lastActiveAt) / 1000),
      });
    }
    return result;
  }

  async close(id) {
    if (id === "all") {
      let count = 0;
      for (const [sid, s] of this.sessions.entries()) {
        try { s.close(); } catch (e) {}
        count++;
      }
      this.sessions.clear();
      this.serverDefaults.clear();
      return count;
    }
    const s = this.sessions.get(id);
    if (!s) return 0;
    try { s.close(); } catch (e) {}
    this.sessions.delete(id);
    for (const [srv, sid] of this.serverDefaults.entries()) {
      if (sid === id) this.serverDefaults.delete(srv);
    }
    return 1;
  }

  async getOrCreateSession(serverName, options = {}) {
    if (options.sessionId || options.session) {
      const sid = options.sessionId || options.session;
      const s = this.sessions.get(sid);
      if (!s) throw new Error(`会话未找到: ${sid}`);
      return s;
    }

    const existingId = this.serverDefaults.get(serverName);
    if (existingId) {
      const existing = this.sessions.get(existingId);
      if (existing && existing.state !== "closed") {
        return existing;
      }
    }

    const s = await this.createSession(serverName, options);
    this.serverDefaults.set(serverName, s.id);
    return s;
  }

  async createSession(serverName, options = {}) {
    const srv = ensureServers().find((s) => s.name === serverName);
    if (!srv) throw new Error(`服务器未找到: ${serverName}`);

    const { credential: cred, error } = connectionCredential(srv, options);
    if (error) throw new Error(error);

    const id = options.id || ("sess_" + randomUUID().replace(/-/g, "").slice(0, 12));
    const session = new PersistentSession(id, srv, cred, options.name || serverName);
    await session.connect();
    this.sessions.set(id, session);
    return session;
  }
}

const sessionManager = new SessionManager();

/* ---------------- 内存级终端日志记录 (Antigravity 运行期间保留，关闭后自动随进程释放) ---------------- */
const serverTerminalLogs = new Map(); // serverName -> Array<LogEntry>
const MAX_TERMINAL_LOGS = 1000;

function pushTerminalLog(serverName, entry) {
  if (!serverTerminalLogs.has(serverName)) {
    serverTerminalLogs.set(serverName, []);
  }
  const list = serverTerminalLogs.get(serverName);
  const logEntry = {
    id: entry.id || randomUUID(),
    timestamp: entry.timestamp || Date.now(),
    server: serverName,
    user: entry.user || "",
    host: entry.host || serverName,
    cwd: entry.cwd || "~",
    command: entry.command || "",
    stdout: (entry.stdout || "").replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, ""),
    stderr: (entry.stderr || "").replace(/^[\r\n]+/, "").replace(/[\r\n]+$/, ""),
    code: entry.code ?? 0,
    ok: entry.ok ?? (entry.code === 0),
    ms: entry.ms || 0,
    source: entry.source || "mcp",
  };
  list.push(logEntry);
  if (list.length > MAX_TERMINAL_LOGS) {
    list.shift();
  }
  return logEntry;
}

function getTerminalLogs(serverName, since = 0) {
  const list = serverTerminalLogs.get(serverName) || [];
  if (!since) return list;
  return list.filter((item) => item.timestamp > Number(since));
}

/* ---------------- HTTP ---------------- */
function json(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try { resolve(JSON.parse(b || "{}")); }
      catch { resolve({}); }
    });
  });
}

function cleanServer(s) {
  return {
    name: String(s.name || ""),
    hostname: String(s.hostname || s.name || ""),
    user: String(s.user || ""),
    port: Number(s.port) || 22,
    identityFile: String(s.identityFile || ""),
    group: String(s.group || "默认"),
    ...(s.credentialId ? { credentialId: String(s.credentialId) } : {}),
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const u = new URL(req.url, "http://127.0.0.1");
  const p = u.pathname;
  const method = req.method;

  try {
    /* ---- 状态 ---- */
    if (p === "/api/status") {
      return json(res, {
        ok: true,
        version: "2.1.0",
        servers: ensureServers().length,
        credentials: loadCreds().length,
        activeSessions: sessionManager.list().length,
        uptime: Math.floor(process.uptime()),
      });
    }

    /* ---- 服务器 CRUD ---- */
    if (p === "/api/servers" && method === "GET")
      return json(res, { ok: true, servers: ensureServers() });

    if (p === "/api/servers" && method === "POST") {
      const b = await readBody(req);
      const s = cleanServer(b);
      if (!s.name) return json(res, { ok: false, error: "缺少名称" }, 400);
      const list = ensureServers();
      if (list.some((x) => x.name === s.name)) return json(res, { ok: false, error: "名称已存在" }, 400);
      list.push(s); saveServers(list);
      audit({ action: "server-add", name: s.name });
      return json(res, { ok: true, servers: list });
    }

    if (p === "/api/servers" && method === "PUT") {
      const b = await readBody(req);
      const old = String(b.oldName || b.name || "");
      const s = cleanServer(b);
      if (!old || !s.name) return json(res, { ok: false, error: "缺少名称" }, 400);
      const list = ensureServers();
      const i = list.findIndex((x) => x.name === old);
      if (i < 0) return json(res, { ok: false, error: "未找到" }, 404);
      list[i] = s; saveServers(list);
      audit({ action: "server-edit", from: old, to: s.name });
      return json(res, { ok: true, servers: list });
    }

    if (p === "/api/servers" && method === "DELETE") {
      const b = await readBody(req);
      const name = String(b.name || "");
      const list = ensureServers().filter((x) => x.name !== name);
      saveServers(list);
      audit({ action: "server-delete", name });
      return json(res, { ok: true, servers: list });
    }

    if (p === "/api/servers/credential" && method === "POST") {
      const body = await readBody(req);
      const { server: name, hostname, port, username, password, id } = body;
      if (typeof username !== "string" || !username.trim() || typeof password !== "string" ||
          !password || typeof id !== "string" || !/^ssh-[0-9a-f]{32}$/.test(id)) {
        return json(res, { ok: false, error: "缺少有效的登录凭据" }, 400);
      }
      const servers = ensureServers();
      const index = servers.findIndex((s) => s.name === name);
      const current = servers[index];
      if (!current || (current.hostname || current.name) !== hostname || (current.port || 22) !== port) {
        return json(res, { ok: false, error: "服务器配置已变更，请刷新后重新连接" }, 409);
      }
      const credentials = loadCreds();
      const account = username.trim();
      const saved = credentials.find((item) =>
        item.username === account && item.password && decrypt(item.password) === password);
      if (current.credentialId && (current.credentialId === id || current.credentialId === saved?.id)) {
        return json(res, { ok: true, server: current });
      }
      if (current.credentialId || credentials.some((item) => item.id === id)) {
        return json(res, { ok: false, error: "凭据配置已变更，请刷新后重新连接" }, 409);
      }
      const credential = saved || {
        id, name: account, username: account, password: encrypt(password), identityFile: "",
      };
      const updated = { ...current, credentialId: credential.id };
      if (!saved) saveCreds([...credentials, credential]);
      try {
        servers[index] = updated;
        saveServers(servers);
      } catch (error) {
        if (!saved) saveCreds(credentials);
        throw error;
      }
      audit({ action: "credential-save", name: credential.name, server: current.name });
      return json(res, { ok: true, server: updated });
    }

    /* ---- 凭据 CRUD ---- */
    if (p === "/api/credentials" && method === "GET") {
      const list = loadCreds().map((c) => ({
        id: c.id, name: c.name, username: c.username,
        hasPassword: !!c.password, identityFile: c.identityFile,
      }));
      return json(res, { ok: true, credentials: list });
    }

    if (p === "/api/credentials" && method === "POST") {
      const b = await readBody(req);
      const list = loadCreds();
      const id = String(b.id || Date.now().toString(36));
      const i = list.findIndex((x) => x.id === id);
      const c = {
        id,
        name: String(b.name || ""),
        username: String(b.username || ""),
        password: b.password === undefined
          ? list[i]?.password || ""
          : b.password ? encrypt(String(b.password)) : "",
        identityFile: String(b.identityFile || ""),
      };
      if (!c.name) return json(res, { ok: false, error: "缺少角色名称" }, 400);
      if (i >= 0) list[i] = c; else list.push(c);
      saveCreds(list);
      audit({ action: "credential-save", name: c.name });
      return json(res, { ok: true, credentials: list.map((x) => ({ id: x.id, name: x.name, username: x.username, hasPassword: !!x.password })) });
    }

    if (p === "/api/credential/decrypt" && method === "POST") {
      const b = await readBody(req);
      const c = loadCreds().find((x) => x.id === String(b.id || ""));
      if (!c) return json(res, { ok: false, error: "凭据未找到" }, 404);
      audit({ action: "credential-decrypt", name: c.name });
      return json(res, { ok: true, username: c.username, password: decrypt(c.password) });
    }

    if (p === "/api/credentials" && method === "DELETE") {
      const b = await readBody(req);
      const id = String(b.id || "");
      const list = loadCreds().filter((x) => x.id !== id);
      saveCreds(list);
      audit({ action: "credential-delete", id });
      return json(res, { ok: true, credentials: list.map((x) => ({ id: x.id, name: x.name })) });
    }

    /* ---- 历史 ---- */
    if (p === "/api/history") return json(res, { ok: true, history: readHistory() });

    /* ---- 持久化会话管理 (Persistent Sessions) ---- */
    if (p === "/api/sessions/start" && method === "POST") {
      const b = await readBody(req);
      const serverName = String(b.server || "");
      if (!serverName) return json(res, { ok: false, error: "缺少 server 参数" }, 400);
      try {
        const s = await sessionManager.createSession(serverName, b);
        audit({ action: "session-start", session: s.id, server: serverName });
        return json(res, {
          ok: true,
          session: {
            id: s.id,
            name: s.name,
            server: s.server,
            cwd: s.cwd,
            state: s.state,
            createdAt: s.createdAt,
          },
        });
      } catch (err) {
        return json(res, { ok: false, error: err.message }, 500);
      }
    }

    if (p === "/api/sessions/send" && method === "POST") {
      const b = await readBody(req);
      const sid = String(b.session || b.sessionId || "");
      const command = String(b.command || "");
      if (!sid || !command) return json(res, { ok: false, error: "缺少 session 或 command 参数" }, 400);

      const s = sessionManager.get(sid);
      const denied = checkCommand(command);
      if (denied) {
        audit({ session: sid, command, denied, ok: false });
        if (s) {
          pushTerminalLog(s.server, {
            user: (s.cred && s.cred.username) || s.serverConfig.user || "user",
            host: s.serverConfig.hostname || s.serverConfig.name,
            cwd: s.cwd,
            command,
            stdout: "",
            stderr: "命令被安全策略拒绝: " + denied,
            code: 1,
            ok: false,
            ms: 0,
            source: b.source || "mcp",
          });
        }
        return json(res, { ok: false, error: "命令被安全策略拒绝: " + denied });
      }

      if (!s) return json(res, { ok: false, error: "会话未找到或已关闭: " + sid }, 404);

      const t0 = Date.now();
      const r = await s.run(command, Number(b.timeout) || 30000);
      const ms = Date.now() - t0;
      audit({ session: sid, server: s.server, command, ok: r.ok, ms });
      pushHistory({ server: s.server, command, ok: r.ok, ms, out: (r.stdout || "").slice(0, 500) });

      // 记录到内存终端日志，实时同步到 UI
      const user = (s.cred && s.cred.username) || s.serverConfig.user || "user";
      const host = s.serverConfig.hostname || s.serverConfig.name;
      pushTerminalLog(s.server, {
        user,
        host,
        cwd: r.cwd || s.cwd,
        command,
        stdout: r.stdout,
        stderr: r.stderr,
        code: r.code,
        ok: r.ok,
        ms,
        source: b.source || "mcp",
      });

      return json(res, { ok: r.ok, code: r.code, stdout: r.stdout, stderr: r.stderr, cwd: r.cwd, ms });
    }

    if ((p === "/api/sessions/list" && (method === "GET" || method === "POST")) ||
        (p === "/api/sessions" && method === "GET")) {
      const filter = req.method === "POST" ? (await readBody(req)).server : u.searchParams.get("server");
      const list = sessionManager.list(filter);
      return json(res, { ok: true, sessions: list });
    }

    if (p === "/api/sessions/close" && method === "POST") {
      const b = await readBody(req);
      const sid = String(b.session || b.sessionId || "");
      if (!sid) return json(res, { ok: false, error: "缺少 session 参数" }, 400);
      const closed = await sessionManager.close(sid);
      audit({ action: "session-close", session: sid, closed });
      return json(res, { ok: true, closed });
    }

    /* ---- 连接状态 / 重连 ---- */
    if (p === "/api/connection/status" && method === "POST") {
      const b = await readBody(req);
      const action = b.action || "status";
      if (action === "status") {
        return json(res, { ok: true, sessions: sessionManager.list() });
      }
      if (action === "reconnect") {
        const srv = String(b.server || "");
        if (!srv) return json(res, { ok: false, error: "缺少 server 参数" }, 400);
        await sessionManager.close(srv);
        const s = await sessionManager.getOrCreateSession(srv);
        return json(res, { ok: true, session: { id: s.id, state: s.state, cwd: s.cwd } });
      }
      if (action === "disconnect") {
        const srv = String(b.server || "");
        let closed = 0;
        for (const s of sessionManager.list()) {
          if (!srv || s.server === srv) closed += await sessionManager.close(s.id);
        }
        return json(res, { ok: true, closed });
      }
      if (action === "cleanup") {
        let closed = 0;
        for (const s of sessionManager.list()) {
          if (s.state === "closed" || s.state === "error") closed += await sessionManager.close(s.id);
        }
        return json(res, { ok: true, closed });
      }
      return json(res, { ok: false, error: "未知的 action" }, 400);
    }

    /* ---- 执行命令（统一支持持久化与向后兼容） ---- */
    if (p === "/api/exec" && method === "POST") {
      const b = await readBody(req);
      const name = String(b.server || "");
      const command = String(b.command || "");
      if (!name || !command) return json(res, { ok: false, error: "缺少 server 或 command" }, 400);

      const srv = ensureServers().find((s) => s.name === name);
      if (!srv) return json(res, { ok: false, error: "服务器未找到: " + name }, 404);

      const { credential: cred, error } = connectionCredential(srv, b);
      if (error) return json(res, { ok: false, error }, 400);

      const user = (cred && cred.username) || srv.user || "user";
      const host = srv.hostname || srv.name;

      const denied = checkCommand(command);
      if (denied) {
        audit({ server: name, command, denied, ok: false });
        pushTerminalLog(name, {
          user,
          host,
          cwd: "~",
          command,
          stdout: "",
          stderr: "命令被安全策略拒绝: " + denied,
          code: 1,
          ok: false,
          ms: 0,
          source: b.source || "mcp",
        });
        return json(res, { ok: false, error: "命令被安全策略拒绝: " + denied });
      }

      // 如果明确指定一次性执行模式 (oneShot)
      if (b.oneShot === true) {
        const t0 = Date.now();
        const r = await execSSH(srv, command, cred, Number(b.timeout) || 30000);
        const ms = Date.now() - t0;
        audit({ server: name, credential: cred?.name || null, command, ok: r.ok, ms });
        pushHistory({ server: name, command, ok: r.ok, ms, out: (r.out || "").slice(0, 500) });

        pushTerminalLog(name, {
          user,
          host,
          cwd: "~",
          command,
          stdout: r.out,
          stderr: r.err,
          code: r.code,
          ok: r.ok,
          ms,
          source: b.source || "mcp",
        });

        return json(res, { ok: r.ok, code: r.code, stdout: r.out, stderr: r.err, ms });
      }

      // 默认走长期持久化 Shell 会话（保留 cwd、环境变量、上下文）
      try {
        const s = await sessionManager.getOrCreateSession(name, {
          sessionId: b.session || b.sessionId,
          ...b,
        });
        const t0 = Date.now();
        const r = await s.run(command, Number(b.timeout) || 30000);
        const ms = Date.now() - t0;
        audit({ server: name, session: s.id, command, ok: r.ok, ms });
        pushHistory({ server: name, session: s.id, command, ok: r.ok, ms, out: (r.stdout || "").slice(0, 500) });

        pushTerminalLog(name, {
          user: (s.cred && s.cred.username) || srv.user || user,
          host,
          cwd: r.cwd || s.cwd,
          command,
          stdout: r.stdout,
          stderr: r.stderr,
          code: r.code,
          ok: r.ok,
          ms,
          source: b.source || "mcp",
        });

        return json(res, { ok: r.ok, code: r.code, stdout: r.stdout, stderr: r.stderr, cwd: r.cwd, ms, session: s.id });
      } catch (err) {
        // 如果持久化会话遇到问题，回退到一次性 SSH 执行并返回
        console.warn("[agy-ssh] 会话执行异常，回退一次性执行:", err.message);
        const t0 = Date.now();
        const r = await execSSH(srv, command, cred, Number(b.timeout) || 30000);
        const ms = Date.now() - t0;
        audit({ server: name, command, ok: r.ok, ms, fallback: true });
        pushHistory({ server: name, command, ok: r.ok, ms, out: (r.out || "").slice(0, 500) });

        pushTerminalLog(name, {
          user,
          host,
          cwd: "~",
          command,
          stdout: r.out,
          stderr: r.err,
          code: r.code,
          ok: r.ok,
          ms,
          source: b.source || "mcp",
        });

        return json(res, { ok: r.ok, code: r.code, stdout: r.out, stderr: r.err, ms });
      }
    }

    /* ---- 终端日志查询与管理 (内存级，长期保留至 Antigravity 退出) ---- */
    if (p === "/api/terminal/logs" && method === "GET") {
      const serverName = u.searchParams.get("server");
      const since = Number(u.searchParams.get("since") || 0);
      if (!serverName) return json(res, { ok: false, error: "缺少 server 参数" }, 400);

      const srv = ensureServers().find((s) => s.name === serverName);
      const activeSessionId = sessionManager.serverDefaults.get(serverName);
      const activeSession = activeSessionId ? sessionManager.sessions.get(activeSessionId) : null;
      const cred = srv ? connectionCredential(srv).credential : null;
      const user = (activeSession?.cred && activeSession.cred.username) ||
                   (cred && cred.username) || srv?.user || "user";
      const host = srv?.hostname || srv?.name || serverName;
      const cwd = activeSession?.cwd || "~";

      const logs = getTerminalLogs(serverName, since);
      return json(res, {
        ok: true,
        server: serverName,
        user,
        host,
        cwd,
        state: activeSession?.state || "idle",
        logs,
      });
    }

    if (p === "/api/terminal/logs" && method === "DELETE") {
      const serverName = u.searchParams.get("server");
      if (serverName) {
        serverTerminalLogs.delete(serverName);
      } else {
        serverTerminalLogs.clear();
      }
      return json(res, { ok: true, cleared: true });
    }

    /* ---- 测试 ---- */
    if (p === "/api/test" && method === "POST") {
      const b = await readBody(req);
      const srv = ensureServers().find((s) => s.name === String(b.server || ""));
      if (!srv) return json(res, { ok: false, error: "服务器未找到" }, 404);
      const { credential: cred, error } = connectionCredential(srv, b);
      if (error) return json(res, { ok: false, error }, 400);
      const r = await execSSH(srv, "echo __AGY_SSH_OK__", cred, 10000);
      return json(res, { ok: r.ok && (r.out || "").includes("__AGY_SSH_OK__"), out: r.out, err: r.err });
    }

    /* ---- 健康检查 ---- */
    if (p === "/api/health-check" && method === "POST") {
      const b = await readBody(req);
      const name = String(b.server || "");
      if (!name) return json(res, { ok: false, error: "缺少 server 参数" }, 400);
      const srv = ensureServers().find((s) => s.name === name);
      if (!srv) return json(res, { ok: false, error: "服务器未找到: " + name }, 404);
      const s = await sessionManager.getOrCreateSession(name, b);
      const resUptime = await s.run("uptime", 5000);
      const resMem = await s.run("free -m 2>/dev/null || cat /proc/meminfo | head -4", 5000);
      const resDisk = await s.run("df -h / 2>/dev/null | tail -1", 5000);

      return json(res, {
        ok: true,
        server: name,
        uptime: resUptime.stdout.trim(),
        memory: resMem.stdout.trim(),
        disk: resDisk.stdout.trim(),
        cwd: s.cwd,
        checkedAt: new Date().toISOString(),
      });
    }

    /* ---- SFTP 文件上传与下载 ---- */
    if (p === "/api/sftp/upload" && method === "POST") {
      const b = await readBody(req);
      const { server: srvName, localPath, remotePath } = b;
      if (!srvName || !localPath || !remotePath) {
        return json(res, { ok: false, error: "缺少 server、localPath 或 remotePath" }, 400);
      }
      const s = await sessionManager.getOrCreateSession(srvName, b);
      if (!s.client) return json(res, { ok: false, error: "SSH 客户端未就绪" }, 500);

      return new Promise((resolve) => {
        s.client.sftp((err, sftp) => {
          if (err) return resolve(json(res, { ok: false, error: err.message }, 500));
          sftp.fastPut(localPath, remotePath, (putErr) => {
            if (putErr) return resolve(json(res, { ok: false, error: putErr.message }, 500));
            audit({ action: "sftp-upload", server: srvName, localPath, remotePath, ok: true });
            resolve(json(res, { ok: true, localPath, remotePath }));
          });
        });
      });
    }

    if (p === "/api/sftp/download" && method === "POST") {
      const b = await readBody(req);
      const { server: srvName, remotePath, localPath } = b;
      if (!srvName || !remotePath || !localPath) {
        return json(res, { ok: false, error: "缺少 server、remotePath 或 localPath" }, 400);
      }
      const s = await sessionManager.getOrCreateSession(srvName, b);
      if (!s.client) return json(res, { ok: false, error: "SSH 客户端未就绪" }, 500);

      return new Promise((resolve) => {
        s.client.sftp((err, sftp) => {
          if (err) return resolve(json(res, { ok: false, error: err.message }, 500));
          sftp.fastGet(remotePath, localPath, (getErr) => {
            if (getErr) return resolve(json(res, { ok: false, error: getErr.message }, 500));
            audit({ action: "sftp-download", server: srvName, remotePath, localPath, ok: true });
            resolve(json(res, { ok: true, remotePath, localPath }));
          });
        });
      });
    }

    /* ---- known_hosts ---- */
    if (p === "/api/known-hosts/remove" && method === "POST") {
      const b = await readBody(req);
      const host = String(b.host || "");
      if (!host) return json(res, { ok: false, error: "缺少 host" }, 400);
      const kh = path.join(homedir(), ".ssh", "known_hosts");
      if (!existsSync(kh)) return json(res, { ok: false, error: "known_hosts 不存在" }, 404);
      const lines = readFileSync(kh, "utf8").split(/\r?\n/);
      const kept = lines.filter((l) => !l.trim().startsWith(host + " ") && !l.trim().startsWith(host + ","));
      const removed = lines.length - kept.length;
      if (removed > 0) {
        writeFileSync(kh + ".agy-ssh.bak", lines.join("\n"));
        writeFileSync(kh, kept.join("\n"));
        audit({ action: "known-hosts-remove", host, removed });
      }
      return json(res, { ok: true, removed, backup: kh + ".agy-ssh.bak" });
    }

    return json(res, { error: "not found" }, 404);
  } catch (e) {
    return json(res, { error: String(e?.message || e) }, 500);
  }
});

const PORT = Number(process.env.AGY_SSH_PORT) || 18761;
server.listen(PORT, "127.0.0.1", () => {
  try { writeFileSync(PORT_FILE, JSON.stringify({ port: PORT, pid: process.pid })); } catch (e) {}
  console.log("[agy-ssh] API 监听 http://127.0.0.1:" + PORT);
});
server.on("error", (e) => console.error("[agy-ssh] server error:", e.message));

let shuttingDown = false;
function shutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[agy-ssh] 正在退出，释放所有会话资源...");
  try { sessionManager.close("all"); } catch (e) {}
  try { server.close(); } catch (e) {}
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGHUP", () => shutdown("SIGHUP"));
process.on("disconnect", () => shutdown("disconnect"));

setInterval(() => {}, 1 << 30);
