#!/usr/bin/env node
// ---------------------------------------------------------------------------
// serve.mjs — zero-dependency Node static server with CORRECT MIME types
//             for AnimaStage / mmd_rtx.html.
//
// Why this exists:
//   A plain static server (and `python3 -m http.server`) serves .mjs as
//   "application/octet-stream" and may serve .wasm wrong too. Chrome enforces
//   strict MIME for ES module scripts and for WebAssembly.compileStreaming, so
//   the app's ES modules (e.g. vendor/mp4-muxer/build/mp4-muxer.mjs) and the
//   Ammo physics wasm (vendor/ammo/ammo.wasm.wasm) get REJECTED. This server
//   sends the right types so everything loads — all in JavaScript, no Python.
//
// Usage:   node serve.mjs            (defaults to port 8000)
//          node serve.mjs 8080       (custom port)
// Then:    open http://localhost:8000/mmd_rtx.html
// ---------------------------------------------------------------------------
import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const requestedPort = Number(process.argv[2]);
const START_PORT = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65535
  ? requestedPort
  : 8000;
const MAX_PORT_ATTEMPTS = 50;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",        // <-- the important one for ES modules
  ".wasm": "application/wasm",       // <-- the important one for WebAssembly
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".task": "application/octet-stream", // BlazePose model (binary, fetched as ArrayBuffer)
  ".pmx": "application/octet-stream",
  ".pmd": "application/octet-stream",
  ".vmd": "application/octet-stream",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/mmd_rtx.html";

    // resolve inside ROOT only (block path traversal)
    const filePath = resolve(ROOT, "." + normalize(urlPath));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + require_sep())) {
      res.writeHead(403); res.end("forbidden"); return;
    }

    let st;
    try { st = statSync(filePath); } catch { res.writeHead(404); res.end("404 not found"); return; }
    if (st.isDirectory()) { res.writeHead(403); res.end("directory listing disabled"); return; }

    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    const headers = {
      "Content-Type": type,
      "Content-Length": st.size,
      // This is a development server. Smart Pose and motion modules are edited
      // live, so caching JS for an hour can make a normal reload execute an old
      // IK/physics build and look as if the fix did not work.
      "Cache-Control": "no-store, no-cache, must-revalidate",
    };

    if (req.method === "HEAD") { res.writeHead(200, headers); res.end(); return; }

    res.writeHead(200, headers);
    const stream = createReadStream(filePath);
    stream.on("error", () => { try { res.destroy(); } catch (_) {} });
    stream.pipe(res);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

function require_sep() {
  // path separator for the startsWith guard, cross-platform
  return process.platform === "win32" ? "\\" : "/";
}

function openBrowser(url) {
  if (process.env.ANIMASTAGE_NO_OPEN === "1") return;

  try {
    if (process.platform === "win32") {
      const child = spawn(process.env.ComSpec || "cmd.exe", [
        "/d", "/s", "/c", `start "" "${url}"`,
      ], { detached: true, stdio: "ignore", windowsHide: true });
      child.unref();
    }
  } catch (error) {
    console.warn(`Could not open the browser automatically: ${error.message}`);
  }
}

function listenOnAvailablePort(port, attempt = 0) {
  const onError = (error) => {
    server.off("listening", onListening);

    if (error?.code === "EADDRINUSE" && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use; trying ${nextPort}...`);
      setImmediate(() => listenOnAvailablePort(nextPort, attempt + 1));
      return;
    }

    console.error(`AnimaStage server failed: ${error?.stack || error}`);
    process.exitCode = 1;
  };

  const onListening = () => {
    server.off("error", onError);
    const url = `http://127.0.0.1:${port}/mmd_rtx.html`;
    console.log(`AnimaStage Standalone: ${url}`);
    if (port !== START_PORT) {
      console.log(`  Port ${START_PORT} was busy, so this session is using port ${port}.`);
    }
    console.log("  (.mjs=text/javascript, .wasm=application/wasm — offline MediaPipe will load)");
    console.log("  Ctrl+C to stop.");
    openBrowser(url);
  };

  server.once("error", onError);
  server.once("listening", onListening);
  server.listen(port, "127.0.0.1");
}

listenOnAvailablePort(START_PORT);
