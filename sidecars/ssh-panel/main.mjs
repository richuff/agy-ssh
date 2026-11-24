#!/usr/bin/env node
/**
 * main.mjs — agy-ssh 面板注入器
 *
 * 1. 读 %APPDATA%\Antigravity\DevToolsActivePort 拿 CDP 端口
 * 2. WebSocket 连 browser 端点（Node 24 内置 WebSocket）
 * 3. Target.attachToTarget 附加主页面
 * 4. Runtime.evaluate 注入 panel.js
 * 5. 页面重载后自动重注入；优雅退出避免宿主启动死锁
 */
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PANEL_SCRIPT = path.join(__dirname, "panel.js");

const LOG = (...a) => console.log("[agy-ssh]", ...a);

function devToolsPortFile() {
  const home = homedir();
  if (process.platform === "darwin")
    return path.join(home, "Library", "Application Support", "Antigravity", "DevToolsActivePort");
  if (process.platform === "win32")
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Antigravity", "DevToolsActivePort");
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "Antigravity", "DevToolsActivePort");
}

function readPort() {
  const f = devToolsPortFile();
  if (!existsSync(f)) return null;
  try {
    const port = Number(readFileSync(f, "utf8").trim().split(/\r?\n/)[0]);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch { return null; }
}

function fetchJson(url, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => {
        try { resolve(JSON.parse(b)); }
        catch (e) { reject(e); }
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      const t = setTimeout(() => reject(new Error("connect timeout")), 8000);
      ws.addEventListener("open", () => { clearTimeout(t); resolve(); });
      ws.addEventListener("error", (e) => {
        clearTimeout(t);
        reject(new Error("ws error: " + (e?.message || "unknown")));
      });
      ws.addEventListener("message", (ev) => {
        let msg;
        try { msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)); }
        catch { return; }
        if (msg.id != null && this.pending.has(msg.id)) {
          const { resolve: rs, reject: rj } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rj(new Error(msg.error.message || JSON.stringify(msg.error)));
          else rs(msg.result);
        }
      });
    });
  }
  send(method, params = {}, sessionId) {
    if (!this.ws || this.ws.readyState !== 1) return Promise.reject(new Error("ws not open"));
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("cdp timeout: " + method));
        }
      }, 20000);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      try { this.ws.send(JSON.stringify(payload)); }
      catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }
  close() { try { this.ws?.close(); } catch (e) {} }
}

let cdp = null;
let sessionId = null;
let failures = 0;

async function ensureConnection(port) {
  if (cdp && cdp.ws && cdp.ws.readyState === 1 && sessionId) return;
  if (cdp) cdp.close();

  const ver = await fetchJson(`http://127.0.0.1:${port}/json/version`);
  cdp = new Cdp(ver.webSocketDebuggerUrl);
  await cdp.connect();

  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const page = targets.find((t) => t.type === "page" && /antigravity/i.test(t.title || ""))
    || targets.find((t) => t.type === "page");
  if (!page) throw new Error("没有可用页面");

  const att = await cdp.send("Target.attachToTarget", { targetId: page.id, flatten: true });
  sessionId = att.sessionId;
  LOG("已附加页面:", (page.title || "").slice(0, 40));
}

let cachedScript = "";
let cachedVersion = "";
let lastScriptMtime = 0;

function loadScriptInfo() {
  try {
    const stat = statSync(PANEL_SCRIPT);
    if (stat.mtimeMs !== lastScriptMtime || !cachedScript) {
      cachedScript = readFileSync(PANEL_SCRIPT, "utf8").replace(/<\/script/gi, "<\\/script");
      lastScriptMtime = stat.mtimeMs;
      const m = cachedScript.match(/PANEL_VERSION\s*=\s*["']([^"']+)["']/);
      cachedVersion = m ? m[1] : "";
    }
  } catch (e) {
    if (!cachedScript) cachedScript = readFileSync(PANEL_SCRIPT, "utf8").replace(/<\/script/gi, "<\\/script");
  }
  return { script: cachedScript, version: cachedVersion };
}

async function tick() {
  let isHealthy = false;
  try {
    const port = readPort();
    if (!port) throw new Error("DevToolsActivePort 未就绪");
    await ensureConnection(port);

    const { script, version } = loadScriptInfo();

    // 1. 发送轻量探测探针 (~70 字节)，检查当前页面是否已注入且版本一致且侧边栏入口依然存在
    if (version) {
      try {
        const probeExpr = `window.__agy_ssh_ver === "${version}" && !!document.getElementById("__agy_ssh_item__")`;
        const probeRes = await cdp.send("Runtime.evaluate", {
          expression: probeExpr,
          returnByValue: true,
          awaitPromise: false,
        }, sessionId);
        if (probeRes?.result?.value === true) {
          isHealthy = true;
        }
      } catch (e) {
        // 如果探针失败（例如页面刷新导致 sessionId 失效），走重新连接/注入逻辑
      }
    }

    if (isHealthy) {
      failures = 0;
      // 页面正常运行且无版本更新，将巡检间隔放宽到 15 秒，避免无谓占用 V8 与 CDP 资源
      setTimeout(tick, 15000);
      return;
    }

    // 2. 未注入或版本不匹配，执行完整脚本注入
    const r = await cdp.send("Runtime.evaluate", {
      expression: script,
      returnByValue: true,
      awaitPromise: false,
    }, sessionId);

    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      LOG("注入异常:", d.exception?.description || d.text);
      failures++;
    } else {
      if (r.result?.value && r.result.value !== "already-injected") {
        LOG("面板已注入:", r.result.value);
      }
      failures = 0;
    }
  } catch (e) {
    failures++;
    LOG("tick 失败:", e.message);
    cdp = null; sessionId = null;
  }

  const delay = failures > 0 ? Math.min(3000 + failures * 1000, 12000) : 4000;
  setTimeout(tick, delay);
}

let shuttingDown = false;
function shutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  LOG("收到 " + sig + "，退出");
  if (cdp) cdp.close();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGHUP", () => shutdown("SIGHUP"));
process.on("disconnect", () => shutdown("disconnect"));

LOG("启动，DevToolsActivePort:", devToolsPortFile());
tick();
setInterval(() => {}, 1 << 30);
