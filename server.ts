import express from "express";
import path from "path";
import { spawn, ChildProcess, execSync } from "child_process";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import {
  generateWanVideo,
  generateQwenImage,
  generateMuseTalkVideo,
  getAssetsManifest,
  deleteAssetFromManifest,
} from "./server/newgenEngine";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "stdout" | "stderr" | "system" | "command";
  text: string;
}

let activeProcess: ChildProcess | null = null;
let activeCommand: string | null = null;
let activeProcessId: string | null = null;
const MAX_LOGS = 3000;
const LOG_FILE = "/tmp/terminal_session_history.json";

function loadPersistedLogs(): LogEntry[] {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const data = fs.readFileSync(LOG_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed.slice(-MAX_LOGS);
    }
  } catch (err) {}
  return [];
}

const logBuffer: LogEntry[] = loadPersistedLogs();

// Persistent session directory
let currentSessionCwd: string = fs.existsSync(path.resolve(process.cwd(), "newgen"))
  ? path.resolve(process.cwd(), "newgen")
  : process.cwd();
let previousSessionCwd: string = process.cwd();

// SSE connected clients
const sseClients = new Set<express.Response>();

function broadcast(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function persistLogs() {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logBuffer.slice(-MAX_LOGS)));
  } catch (err) {}
}

function appendLog(type: LogEntry["type"], text: string) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString().split("T")[1].replace("Z", ""),
    type,
    text,
  };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }
  persistLogs();
  broadcast("log", entry);
  return entry;
}

function clearDpkgLocks() {
  try {
    execSync("fuser -k -9 /var/lib/dpkg/lock-frontend 2>/dev/null || true");
    execSync('pkill -9 -f "/usr/bin/dpkg" 2>/dev/null || true');
    execSync('pkill -9 -f "apt-get" 2>/dev/null || true');
    execSync("rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock /var/cache/apt/archives/lock 2>/dev/null || true");
    execSync("DEBIAN_FRONTEND=noninteractive dpkg --configure -a --force-confdef --force-confold 2>/dev/null || true");
  } catch (err) {}
}

function setupGitConfig() {
  try {
    execSync('git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f" 2>/dev/null || true');
    execSync('git config --global filter.lfs.process "git-lfs filter-process --skip" 2>/dev/null || true');
    execSync('git config --global filter.lfs.required false 2>/dev/null || true');
    execSync('git config --global core.autocrlf input 2>/dev/null || true');
  } catch (err) {}
}

function autoRecoverGitLfs(text: string, currentDir: string) {
  try {
    // Detect folder from "Cloning into 'xyz'..." or find git repo
    const cloneMatch = text.match(/Cloning into '([^']+)'/);
    const candidateDirs = [
      cloneMatch ? path.resolve(currentDir, cloneMatch[1]) : null,
      path.resolve(currentDir, "vidgen"),
      path.resolve(process.cwd(), "newgen", "vidgen"),
      currentDir,
    ].filter((d): d is string => !!d && fs.existsSync(path.join(d, ".git")));

    for (const targetDir of candidateDirs) {
      appendLog("system", `[Auto-Fix: Missing Git LFS object detected in ${path.basename(targetDir)}. Recovering working tree...]`);
      execSync('git config --global filter.lfs.smudge "git-lfs smudge --skip -- %f"', { cwd: targetDir });
      execSync('git config --global filter.lfs.process "git-lfs filter-process --skip"', { cwd: targetDir });
      execSync('git config --global filter.lfs.required false', { cwd: targetDir });
      execSync('GIT_LFS_SKIP_SMUDGE=1 git restore --source=HEAD :/', { cwd: targetDir });
      execSync('GIT_LFS_SKIP_SMUDGE=1 git reset --hard HEAD', { cwd: targetDir });
      appendLog("system", `[Auto-Fix: All repository files in '${path.basename(targetDir)}' successfully checked out!]`);
      break;
    }
  } catch (err: any) {
    appendLog("system", `[Auto-Fix notice: ${err.message}]`);
  }
}

function detectAndHandlePrompt(text: string, proc: ChildProcess, currentDir: string) {
  // Check for debconf / dpkg interactive prompts
  const defaultMatch = text.match(/\[default=([A-Za-z0-9]+)\]/i);
  if (defaultMatch && defaultMatch[1]) {
    const answer = defaultMatch[1];
    setTimeout(() => {
      try {
        proc.stdin?.write(`${answer}\n`);
        appendLog("system", `[Auto-Prompt-Handler: Answered '${answer}' (default) to interactive question]`);
      } catch (err) {}
    }, 150);
    return;
  }

  if (text.includes("(Y/I/N/O/D/Z)")) {
    setTimeout(() => {
      try {
        proc.stdin?.write("N\n");
        appendLog("system", `[Auto-Prompt-Handler: Answered 'N' (keep existing) to (Y/I/N/O/D/Z) prompt]`);
      } catch (err) {}
    }, 150);
    return;
  }

  if (/Do you want to continue\?\s*\[Y\/n\]/i.test(text) || /\[Y\/n\]/i.test(text)) {
    setTimeout(() => {
      try {
        proc.stdin?.write("Y\n");
        appendLog("system", `[Auto-Prompt-Handler: Answered 'Y' to continue prompt]`);
      } catch (err) {}
    }, 150);
    return;
  }

  if (/Press\s*(\[?ENTER\]?|any key)\s*to continue/i.test(text)) {
    setTimeout(() => {
      try {
        proc.stdin?.write("\n");
        appendLog("system", `[Auto-Prompt-Handler: Sent Enter to continue]`);
      } catch (err) {}
    }, 150);
    return;
  }

  // Check for Git LFS smudge failure
  if (
    text.includes("smudge filter lfs failed") ||
    text.includes("warning: Clone succeeded, but checkout failed") ||
    text.includes("retry with 'git restore --source=HEAD :/'")
  ) {
    setTimeout(() => {
      autoRecoverGitLfs(text, currentDir);
    }, 300);
  }
}

function runCommand(command: string, requestedCwd?: string): { ok: boolean; message?: string; cwd?: string } {
  if (activeProcess) {
    return { ok: false, message: "A process is already running. Terminate it first." };
  }

  // Determine working directory
  let resolvedCwd = currentSessionCwd;
  if (requestedCwd && requestedCwd.trim()) {
    const candidate = path.isAbsolute(requestedCwd)
      ? requestedCwd
      : path.resolve(currentSessionCwd, requestedCwd);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      resolvedCwd = candidate;
    }
  }

  const trimmedCmd = command.trim();

  // 1. Direct handling of `cd` commands so directory navigation persists
  const cdMatch = trimmedCmd.match(/^cd(?:\s+(.*))?$/);
  if (cdMatch) {
    const targetArg = (cdMatch[1] || "").trim();
    appendLog("command", `$ cd ${targetArg}`);
    let targetPath = "";
    if (!targetArg || targetArg === "~") {
      targetPath = process.env.HOME || "/root";
    } else if (targetArg === "-") {
      targetPath = previousSessionCwd || currentSessionCwd;
    } else {
      targetPath = path.resolve(resolvedCwd, targetArg);
    }

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      previousSessionCwd = currentSessionCwd;
      currentSessionCwd = targetPath;
      const rel = path.relative(process.cwd(), currentSessionCwd) || ".";
      appendLog("system", `[Directory changed: ${currentSessionCwd}]`);
      broadcast("cwd", { cwd: currentSessionCwd, relativeCwd: rel });
      return { ok: true, cwd: currentSessionCwd };
    } else {
      appendLog("stderr", `bash: cd: ${targetArg}: No such file or directory`);
      return { ok: true, cwd: currentSessionCwd };
    }
  }

  const pid = `${Date.now()}`;
  activeProcessId = pid;
  activeCommand = trimmedCmd;

  const relPrompt = path.relative(process.cwd(), resolvedCwd) || ".";
  appendLog("command", `$ (${relPrompt}) ${trimmedCmd}`);

  try {
    // Wrap command in bash to capture any subshell directory changes
    const bashScript = `
export GIT_LFS_SKIP_SMUDGE=1
export GIT_LFS_SKIP_DOWNLOAD_ERRORS=1
${trimmedCmd}
__AIS_RET=$?
pwd > /tmp/terminal_active_cwd
exit $__AIS_RET
`;

    const proc = spawn("bash", ["-c", bashScript], {
      cwd: resolvedCwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        FORCE_COLOR: "1",
        PYTHONUNBUFFERED: "1",
        GIT_LFS_SKIP_SMUDGE: "1",
        GIT_LFS_SKIP_DOWNLOAD_ERRORS: "1",
        DEBIAN_FRONTEND: "noninteractive",
        NEEDRESTART_MODE: "a",
        UCF_FORCE_CONFFOLD: "1",
        APT_LISTCHANGES_FRONTEND: "none",
        CI: "1",
      },
    });

    activeProcess = proc;
    broadcast("status", { isRunning: true, command: trimmedCmd, processId: pid });

    proc.stdout?.on("data", (chunk: Buffer) => {
      const raw = chunk.toString();
      detectAndHandlePrompt(raw, proc, resolvedCwd);
      const lines = raw.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i === lines.length - 1 && lines[i] === "") continue;
        appendLog("stdout", lines[i]);
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const raw = chunk.toString();
      detectAndHandlePrompt(raw, proc, resolvedCwd);
      const lines = raw.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i === lines.length - 1 && lines[i] === "") continue;
        appendLog("stderr", lines[i]);
      }
    });

    proc.on("close", (code, signal) => {
      // Check if command changed directory
      try {
        if (fs.existsSync("/tmp/terminal_active_cwd")) {
          const newDir = fs.readFileSync("/tmp/terminal_active_cwd", "utf-8").trim();
          if (newDir && fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
            if (newDir !== currentSessionCwd) {
              previousSessionCwd = currentSessionCwd;
              currentSessionCwd = newDir;
              const rel = path.relative(process.cwd(), currentSessionCwd) || ".";
              broadcast("cwd", { cwd: currentSessionCwd, relativeCwd: rel });
            }
          }
        }
      } catch (e) {}

      appendLog(
        "system",
        `[Process exited with code ${code !== null ? code : "null"}${signal ? ` (signal: ${signal})` : ""}]`
      );
      activeProcess = null;
      activeCommand = null;
      activeProcessId = null;
      broadcast("status", { isRunning: false, command: null, processId: null, exitCode: code });
    });

    proc.on("error", (err) => {
      appendLog("system", `[Process spawn error: ${err.message}]`);
      activeProcess = null;
      activeCommand = null;
      activeProcessId = null;
      broadcast("status", { isRunning: false, command: null, processId: null, error: err.message });
    });

    return { ok: true, cwd: currentSessionCwd };
  } catch (err: any) {
    appendLog("system", `[Execution failure: ${err.message}]`);
    activeProcess = null;
    activeCommand = null;
    activeProcessId = null;
    return { ok: false, message: err.message };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // SSE Stream
  app.get("/api/terminal/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseClients.add(res);

    const relativeCwd = path.relative(process.cwd(), currentSessionCwd) || ".";

    // Send initial snapshot with full history and current working directory
    res.write(
      `event: init\ndata: ${JSON.stringify({
        isRunning: !!activeProcess,
        command: activeCommand,
        processId: activeProcessId,
        cwd: currentSessionCwd,
        relativeCwd,
        history: logBuffer.slice(-MAX_LOGS),
      })}\n\n`
    );

    // Keep connection alive with periodic heartbeats to prevent proxy/browser timeouts
    const pingTimer = setInterval(() => {
      try {
        res.write(": keep-alive\n\n");
      } catch {
        clearInterval(pingTimer);
      }
    }, 12000);

    req.on("close", () => {
      clearInterval(pingTimer);
      sseClients.delete(res);
    });
  });

  // Run command endpoint
  app.post("/api/terminal/run", (req, res) => {
    const { command, cwd } = req.body;
    if (!command || typeof command !== "string") {
      res.status(400).json({ error: "Missing or invalid command string" });
      return;
    }
    const result = runCommand(command.trim(), cwd || ".");
    if (!result.ok) {
      res.status(409).json({ error: result.message });
      return;
    }
    res.json({ ok: true, command: command.trim() });
  });

  // Send interactive stdin input to running process
  app.post("/api/terminal/input", (req, res) => {
    const { input } = req.body;
    if (!activeProcess || !activeProcess.stdin) {
      res.status(400).json({ error: "No active process accepting input" });
      return;
    }

    try {
      const textToSend = input !== undefined ? String(input) : "";
      activeProcess.stdin.write(textToSend.endsWith("\n") ? textToSend : textToSend + "\n");
      appendLog("command", `[Sent stdin input]: ${textToSend || "<ENTER>"}`);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Kill running process
  app.post("/api/terminal/kill", (req, res) => {
    if (!activeProcess) {
      res.json({ ok: true, message: "No active process to terminate" });
      return;
    }

    try {
      activeProcess.kill("SIGTERM");
      setTimeout(() => {
        if (activeProcess) {
          activeProcess.kill("SIGKILL");
        }
      }, 1500);
      appendLog("system", "[Sent SIGTERM termination signal to process]");
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clear terminal logs
  app.post("/api/terminal/clear", (req, res) => {
    logBuffer.length = 0;
    broadcast("clear", {});
    res.json({ ok: true });
  });

  // Force unlock dpkg / apt locks
  app.post("/api/terminal/unlock", (req, res) => {
    try {
      clearDpkgLocks();
      appendLog("system", "[Manual Action: Cleared /var/lib/dpkg/lock-frontend and freed apt locks]");
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get status
  app.get("/api/terminal/status", (req, res) => {
    const relativeCwd = path.relative(process.cwd(), currentSessionCwd) || ".";
    res.json({
      isRunning: !!activeProcess,
      command: activeCommand,
      processId: activeProcessId,
      bufferLength: logBuffer.length,
      cwd: currentSessionCwd,
      relativeCwd,
    });
  });

  // System Diagnostics
  app.get("/api/system/info", (req, res) => {
    let memInfo = "";
    try {
      memInfo = fs.readFileSync("/proc/meminfo", "utf8");
    } catch {
      memInfo = "Unavailable";
    }

    const hasNewgen = fs.existsSync(path.resolve(process.cwd(), "newgen"));
    const newgenFiles = hasNewgen
      ? fs.readdirSync(path.resolve(process.cwd(), "newgen")).slice(0, 30)
      : [];

    res.json({
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      cwd: process.cwd(),
      memInfo: memInfo.split("\n").slice(0, 8).join("\n"),
      hasNewgen,
      newgenFiles,
    });
  });

  // Physical GPU and Hardware Accelerator Audit
  app.get("/api/system/gpu-audit", (req, res) => {
    let nvidiaSmiOutput = "nvidia-smi: command not found (no NVIDIA driver or utility installed)";
    let hasPhysicalGpu = false;
    let gpuCount = 0;
    let gpuModel = "None detected";
    let vramMb = 0;
    let cudaAvailable = false;
    let driverVersion = "None";

    try {
      const smiCheck = execSync("which nvidia-smi 2>/dev/null || true").toString().trim();
      if (smiCheck) {
        const output = execSync("nvidia-smi 2>&1 || true", { timeout: 3000 }).toString();
        nvidiaSmiOutput = output;
        if (output.includes("NVIDIA-SMI") && !output.includes("failed")) {
          hasPhysicalGpu = true;
          cudaAvailable = true;
          const nameMatch = output.match(/\|\s*\d+\s+([A-Za-z0-9\s]+?)\s+[A-Z]+\s*\|/);
          if (nameMatch) gpuModel = nameMatch[1].trim();
        }
      }
    } catch (err: any) {
      nvidiaSmiOutput = `Execution result: ${err.message}`;
    }

    // Check /dev for GPU and accelerator device nodes
    const deviceFiles: string[] = [];
    try {
      if (fs.existsSync("/dev")) {
        const devs = fs.readdirSync("/dev");
        for (const d of devs) {
          if (d.startsWith("nvidia") || d.startsWith("dri") || d.startsWith("nvhost") || d.startsWith("accel")) {
            deviceFiles.push(`/dev/${d}`);
          }
        }
      }
    } catch {}

    // Check /proc/driver/nvidia
    const procDriverPaths: string[] = [];
    try {
      if (fs.existsSync("/proc/driver/nvidia")) {
        procDriverPaths.push("/proc/driver/nvidia");
        const sub = fs.readdirSync("/proc/driver/nvidia");
        for (const s of sub) procDriverPaths.push(`/proc/driver/nvidia/${s}`);
      }
    } catch {}

    // Check /sys/bus/pci/devices
    const pciScan: string[] = [];
    try {
      if (fs.existsSync("/sys/bus/pci/devices")) {
        const pcis = fs.readdirSync("/sys/bus/pci/devices");
        pciScan.push(...pcis);
      }
    } catch {}

    // Check /sys/class/accel
    const accelScan: string[] = [];
    try {
      if (fs.existsSync("/sys/class/accel")) {
        accelScan.push(...fs.readdirSync("/sys/class/accel"));
      }
    } catch {}

    // Check CPU info
    let cpuModel = "AMD / Intel Virtual CPU";
    let cpuCores = 2;
    const cpuArch = process.arch;
    let cpuFlags: string[] = [];
    try {
      if (fs.existsSync("/proc/cpuinfo")) {
        const cpuinfo = fs.readFileSync("/proc/cpuinfo", "utf8");
        const modelMatch = cpuinfo.match(/model name\s*:\s*(.+)/i);
        if (modelMatch) cpuModel = modelMatch[1].trim();
        const coresMatch = cpuinfo.match(/cpu cores\s*:\s*(\d+)/i);
        if (coresMatch) cpuCores = parseInt(coresMatch[1], 10) || 2;
        const flagsMatch = cpuinfo.match(/flags\s*:\s*(.+)/i);
        if (flagsMatch) {
          cpuFlags = flagsMatch[1].split(/\s+/).slice(0, 16);
        }
      }
    } catch {}

    // Kernel & container virtualization
    let kernelInfo = "Linux virtual container";
    try {
      kernelInfo = fs.readFileSync("/proc/version", "utf8").trim();
    } catch {}

    const isGVisor = kernelInfo.toLowerCase().includes("gvisor") || fs.existsSync("/dev/gvisorsys");
    const containerRuntime = isGVisor
      ? "Google Cloud Run / gVisor Sandboxed Container (CPU-only)"
      : "Virtual Linux Container (CPU-only)";

    const verdict = hasPhysicalGpu
      ? `Physical GPU detected: ${gpuModel}`
      : "NO Physical GPU attached (0 GPUs, 0 MB VRAM)";

    const verdictDetails = hasPhysicalGpu
      ? "A physical GPU is mounted and directly accessible via CUDA drivers."
      : "This container runs on Google Cloud Run under gVisor virtualization. Standard Cloud Run containers provide virtualized CPU compute only. There are ZERO physical NVIDIA, AMD, or Intel PCIe GPUs attached. AI models requiring local CUDA acceleration (e.g. Wan 2.2, Qwen-Image, MuseTalk) cannot run on local hardware here and require either remote cloud GPU instances (Google Cloud G2/A2/A3, RunPod, Lambda Labs) or cloud AI APIs (Google Gemini API).";

    res.json({
      hasPhysicalGpu,
      gpuCount,
      gpuModel,
      vramMb,
      cudaAvailable,
      driverVersion,
      nvidiaSmiOutput,
      deviceFiles,
      procDriverPaths,
      pciScan,
      accelScan,
      cpuSummary: {
        model: cpuModel,
        cores: cpuCores,
        arch: cpuArch,
        flags: cpuFlags,
      },
      kernelInfo,
      containerRuntime,
      verdict,
      verdictDetails,
    });
  });

  // Google Gemini API connectivity check
  app.get("/api/system/google-api-check", async (req, res) => {
    const rawKey = process.env.GEMINI_API_KEY;
    const hasKey = !!rawKey && rawKey !== "MY_GEMINI_API_KEY" && rawKey.trim().length > 5;
    const maskedKey = hasKey
      ? `${rawKey!.substring(0, 6)}...${rawKey!.slice(-4)}`
      : "Not configured (Default placeholder)";

    if (!hasKey) {
      return res.json({
        configured: false,
        status: "API Key Not Configured",
        remoteEndpoint: "https://generativelanguage.googleapis.com",
        sdk: "@google/genai (v2.4.0)",
        maskedKey,
        message: "GEMINI_API_KEY is not configured in environment variables. Add your key in the AI Studio Settings / Secrets panel to enable Google AI calls.",
        gpuInfrastructure: "Google Cloud Tensor Processing Units (TPU v5e/v6e) & NVIDIA H100 Cloud Supercomputers (Managed remotely by Google)",
      });
    }

    const startTime = Date.now();
    try {
      const ai = new GoogleGenAI({ apiKey: rawKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: "Respond with the single word: Connected",
      });
      const durationMs = Date.now() - startTime;
      return res.json({
        configured: true,
        status: "Connected & Verified",
        remoteEndpoint: "https://generativelanguage.googleapis.com",
        sdk: "@google/genai (v2.4.0)",
        model: "gemini-3.8-flash",
        testOutput: response.text ? response.text.trim() : "Connected",
        latencyMs: durationMs,
        maskedKey,
        gpuInfrastructure: "Google Cloud TPU & GPU Data Centers (Processed remotely on Google Cloud infrastructure)",
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return res.json({
        configured: true,
        status: "Connection Failed",
        remoteEndpoint: "https://generativelanguage.googleapis.com",
        sdk: "@google/genai (v2.4.0)",
        latencyMs: durationMs,
        error: err.message,
        maskedKey,
        gpuInfrastructure: "Remote Google Cloud Infrastructure",
      });
    }
  });

  // Catalog of all endpoints and external connections
  app.get("/api/system/endpoints-catalog", (req, res) => {
    res.json({
      containerPort: 3000,
      hostBinding: "0.0.0.0",
      externalUrl: process.env.APP_URL || "https://ais-dev-7o5qr4bmydr72flne3zfep-624468472936.us-east1.run.app",
      networkNotes: "Port 3000 is the ONLY externally accessible port via the Google Cloud Run reverse proxy. Other ports (e.g. FTP port 2121) can only be accessed locally within the container.",
      endpoints: [
        {
          path: "/api/system/gpu-audit",
          method: "GET",
          category: "System Diagnostics",
          description: "Scans /dev, /proc, PCI bus, and nvidia-smi to verify physical GPU hardware presence and compute resources.",
          accessScope: "Internal REST",
        },
        {
          path: "/api/system/info",
          method: "GET",
          category: "System Diagnostics",
          description: "Returns container RAM, CPU architecture, Node.js version, and repository directory files.",
          accessScope: "Internal REST",
        },
        {
          path: "/api/system/google-api-check",
          method: "GET",
          category: "Google & AI",
          description: "Probes connection to Google Generative Language API (generativelanguage.googleapis.com) using @google/genai SDK.",
          accessScope: "External Outbound",
        },
        {
          path: "/api/system/endpoints-catalog",
          method: "GET",
          category: "System Diagnostics",
          description: "Returns the full catalog of all application endpoints, methods, and external connections.",
          accessScope: "Internal REST",
        },
        {
          path: "/api/terminal/stream",
          method: "SSE",
          category: "Terminal Control",
          description: "Real-time Server-Sent Events stream providing live stdout, stderr, process lifecycle events, and directory changes.",
          accessScope: "Streaming",
        },
        {
          path: "/api/terminal/run",
          method: "POST",
          category: "Terminal Control",
          description: "Dispatches and executes a bash command within the container session.",
          parameters: "{ command: string, cwd?: string }",
          accessScope: "Internal REST",
        },
        {
          path: "/api/terminal/input",
          method: "POST",
          category: "Terminal Control",
          description: "Writes interactive stdin input to the active running child process.",
          parameters: "{ input: string }",
          accessScope: "Internal REST",
        },
        {
          path: "/api/terminal/kill",
          method: "POST",
          category: "Terminal Control",
          description: "Sends SIGTERM and SIGKILL signals to terminate the active container process.",
          accessScope: "Internal REST",
        },
        {
          path: "/api/terminal/clear",
          method: "POST",
          category: "Terminal Control",
          description: "Flushes the in-memory terminal history log buffer.",
          accessScope: "Internal REST",
        },
        {
          path: "/api/terminal/unlock",
          method: "POST",
          category: "Terminal Control",
          description: "Force-kills locked dpkg/apt background locks and clears frontend locks.",
          accessScope: "Internal REST",
        },
        {
          path: "/api/terminal/status",
          method: "GET",
          category: "Terminal Control",
          description: "Fetches current process status, processId, active command, and working directory.",
          accessScope: "Internal REST",
        },
        {
          path: "/api/download/project-zip",
          method: "GET",
          category: "Export & Assets",
          description: "Builds and downloads a full ZIP archive of all project scripts, code, and configurations.",
          accessScope: "Public Reverse Proxy",
        },
        {
          path: "/api/download/info",
          method: "GET",
          category: "Export & Assets",
          description: "Returns ZIP archive size, file name, and last modified date.",
          accessScope: "Internal REST",
        },
      ],
      externalConnections: [
        {
          service: "Google Gemini API",
          provider: "Google Cloud",
          endpointUrl: "https://generativelanguage.googleapis.com",
          protocol: "HTTPS / REST & gRPC",
          purpose: "Cloud AI inference (text, multimodal, coding, reasoning) using remote Google TPU & GPU clusters.",
          authMethod: "Bearer API Key (GEMINI_API_KEY)",
          gpuHardwareNote: "Hosted on Google Cloud TPU/GPU data centers (no local GPU required).",
          status: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" ? "Connected" : "Configured",
        },
        {
          service: "Google Cloud Run Container Runtime",
          provider: "Google Cloud (us-east1)",
          endpointUrl: process.env.APP_URL || "https://ais-dev-7o5qr4bmydr72flne3zfep-624468472936.us-east1.run.app",
          protocol: "HTTPS / Reverse Proxy",
          purpose: "Web hosting and isolated execution environment for this application.",
          authMethod: "Session / Iframe Ingress",
          gpuHardwareNote: "Standard Cloud Run tier: Virtual CPU execution with 0 physical GPUs attached.",
          status: "Connected",
        },
        {
          service: "Hugging Face Model Hub",
          provider: "Hugging Face, Inc.",
          endpointUrl: "https://huggingface.co",
          protocol: "HTTPS / Git LFS",
          purpose: "Repository referenced by newgen/app.py for downloading QwenImage, Wan 2.2, and Diffusers weights.",
          authMethod: "Public / HF Token",
          gpuHardwareNote: "Model weights can be downloaded, but running inference requires external NVIDIA GPUs.",
          status: "Unavailable / Unmounted",
        },
        {
          service: "Local Container FTP Server (newgen/ftp.py)",
          provider: "pyftpdlib (Local Script)",
          endpointUrl: "ftp://0.0.0.0:2121",
          protocol: "FTP",
          purpose: "Script in newgen/ftp.py configured to expose container files over port 2121.",
          authMethod: "DummyAuthorizer (admin / YOUR_PASSWORD)",
          gpuHardwareNote: "File transfer only, no GPU acceleration.",
          status: "Restricted Ingress",
        },
      ],
      physicalGpuLocationsGuide: [
        {
          provider: "Google Cloud Compute Engine (GCE)",
          offerings: "G2 instances (NVIDIA L4 24GB), A2 instances (NVIDIA A100 40GB/80GB), A3 instances (NVIDIA H100 80GB)",
          howToConnect: "Provision a GCE GPU VM, run newgen/app.py or a FastAPI server on it, and call its endpoint via HTTPS.",
        },
        {
          provider: "Google Cloud Vertex AI",
          offerings: "Managed Online Endpoints with GPU accelerators (NVIDIA T4, L4, V100, A100)",
          howToConnect: "Deploy custom container image to Vertex AI Model Registry and issue prediction requests.",
        },
        {
          provider: "Serverless GPU Clouds (RunPod, Modal, Replicate, Together AI)",
          offerings: "Serverless pay-per-second GPU workers (RTX 4090, A100, H100)",
          howToConnect: "Expose Wan 2.2 or QwenImage as a serverless worker and connect via REST or WebSocket from this application.",
        },
      ],
    });
  });

  // Download Entire Project ZIP
  app.get("/api/download/project-zip", (req, res) => {
    try {
      execSync("python3 generate_zip.py", { cwd: process.cwd() });
      const zipPath = path.resolve(process.cwd(), "public", "newgen-terminal-full-project.zip");
      if (fs.existsSync(zipPath)) {
        res.download(zipPath, "newgen-terminal-full-project.zip");
      } else {
        res.status(404).json({ error: "ZIP file not found" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Download Info Metadata
  app.get("/api/download/info", (req, res) => {
    try {
      const zipPath = path.resolve(process.cwd(), "public", "newgen-terminal-full-project.zip");
      if (!fs.existsSync(zipPath)) {
        execSync("python3 generate_zip.py", { cwd: process.cwd() });
      }
      const stat = fs.statSync(zipPath);
      res.json({
        filename: "newgen-terminal-full-project.zip",
        sizeBytes: stat.size,
        sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
        lastModified: stat.mtime.toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // NEWGEN STUDIO SUITE ENDPOINTS
  // =========================================================================

  // Get prompts library from newgen
  app.get("/api/newgen/prompts", (req, res) => {
    try {
      const promptsPath = path.resolve(process.cwd(), "public", "newgen_prompts.json");
      if (fs.existsSync(promptsPath)) {
        const data = JSON.parse(fs.readFileSync(promptsPath, "utf-8"));
        return res.json(data);
      }
      res.json({});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get LoRAs library from newgen
  app.get("/api/newgen/loras", (req, res) => {
    try {
      const lorasPath = path.resolve(process.cwd(), "public", "newgen_loras.json");
      if (fs.existsSync(lorasPath)) {
        const data = JSON.parse(fs.readFileSync(lorasPath, "utf-8"));
        return res.json(data);
      }
      res.json({});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fast Video Generation (Wan 2.2 I2V Lightning Engine)
  app.post("/api/newgen/generate-video", async (req, res) => {
    try {
      const asset = await generateWanVideo(req.body);
      res.json({ success: true, asset });
    } catch (err: any) {
      console.error("Video generation failed:", err);
      res.status(500).json({ success: false, error: err.message || "Video generation failed" });
    }
  });

  // Fast Image Generation / Styling (Qwen-Image Edit Plus Engine)
  app.post("/api/newgen/generate-image", async (req, res) => {
    try {
      const asset = await generateQwenImage(req.body);
      res.json({ success: true, asset });
    } catch (err: any) {
      console.error("Image generation failed:", err);
      res.status(500).json({ success: false, error: err.message || "Image generation failed" });
    }
  });

  // MuseTalk Talking Avatar Generator
  app.post("/api/newgen/musetalk", async (req, res) => {
    try {
      const { portraitBase64, speechText } = req.body;
      const asset = await generateMuseTalkVideo(portraitBase64, speechText);
      res.json({ success: true, asset });
    } catch (err: any) {
      console.error("MuseTalk failed:", err);
      res.status(500).json({ success: false, error: err.message || "MuseTalk synthesis failed" });
    }
  });

  // Output Gallery
  app.get("/api/newgen/gallery", (req, res) => {
    try {
      const manifest = getAssetsManifest();
      res.json({ assets: manifest });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete from Gallery
  app.delete("/api/newgen/gallery/:id", (req, res) => {
    try {
      const deleted = deleteAssetFromManifest(req.params.id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Enhance Prompt via AI or Semantic Rules
  app.post("/api/newgen/enhance-prompt", async (req, res) => {
    const { prompt, category } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    try {
      if (process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are an expert diffusion prompt engineer for Wan 2.2 and Qwen-Image models. 
Enhance the following prompt to maximize cinematic visual quality, high dynamic range, natural physics, and anatomical realism. 
Keep it descriptive, concise (under 80 words), and return ONLY the enhanced prompt string without commentary or quotation marks.
Category: ${category || "General"}
Prompt: ${prompt}`,
                },
              ],
            },
          ],
        });
        const enhanced = response.text ? response.text.trim() : prompt;
        return res.json({ enhancedPrompt: enhanced, source: "gemini-2.5-flash" });
      }
    } catch (aiErr) {
      console.warn("Gemini prompt enhance fallback:", aiErr);
    }

    // Semantic rule-based enhancer fallback
    const cinematicQualities = [
      "cinematic 8k resolution, ultra-detailed textures, volumetric atmospheric lighting, photorealistic depth of field, 35mm lens, natural motion flow",
      "masterpiece composition, octane render style, highly intricate details, soft ambient occlusion, fluid dynamic lighting",
      "hyper-realistic, dynamic angle, studio grade color grading, cinematic illumination, highly coherent motion",
    ];
    const picked = cinematicQualities[Math.floor(Math.random() * cinematicQualities.length)];
    const ruleEnhanced = `${prompt}, ${picked}, remove all watermarks and overlays`;
    res.json({ enhancedPrompt: ruleEnhanced, source: "semantic-rules" });
  });

  // Vite middleware / production static
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            "**/newgen/**",
            "**/vidgen/**",
            "**/.git/**",
            "**/public/**",
            "**/dist/**",
            "**/tmp/**",
            "**/*.zip",
            "**/*.log",
            "**/node_modules/**",
          ],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Ensure git LFS skip and system configs are set on boot
  setupGitConfig();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Live Terminal Server running at http://localhost:${PORT}`);
  });
}

startServer();
