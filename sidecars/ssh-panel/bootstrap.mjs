#!/usr/bin/env node
/**
 * bootstrap.mjs — agy-ssh sidecar 入口
 * 同时拉起本地 API 服务（server.mjs）与 CDP 注入器（main.mjs）。
 * 两者任一退出时，本进程退出，由 restart_policy 统一重启。
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const children = [];
let shuttingDown = false;

function start(file) {
  const p = spawn(process.execPath, [path.join(__dirname, file)], {
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(p);
  p.on("exit", (code) => {
    if (!shuttingDown) {
      console.error("[agy-ssh] " + file + " 退出(code=" + code + ")，重启整个 sidecar");
      shutdown("child-exit");
    }
  });
  return p;
}

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch (e) {}
  }
  setTimeout(() => process.exit(0), 200);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGHUP", () => shutdown("SIGHUP"));
process.on("disconnect", () => shutdown("disconnect"));

console.log("[agy-ssh] bootstrap 启动");
start("server.mjs");
start("main.mjs");

setInterval(() => {}, 1 << 30);
