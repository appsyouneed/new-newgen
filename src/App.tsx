import React, { useState, useEffect, useCallback, useRef } from "react";
import { Terminal, Activity, Cpu, RefreshCw, AlertCircle, Download, FileArchive, Globe, Sparkles, Video } from "lucide-react";
import { LogEntry, TerminalStatus, SystemInfo } from "./types";
import { TerminalView } from "./components/TerminalView";
import { SystemInfoPanel } from "./components/SystemInfoPanel";
import { ExportProjectPanel } from "./components/ExportProjectPanel";
import { GpuEndpointsAuditor } from "./components/GpuEndpointsAuditor";
import { NewGenStudio } from "./components/NewGenStudio";

export default function App() {
  const [activeTab, setActiveTab] = useState<"newgen-studio" | "gpu-endpoints" | "terminal" | "diagnostics" | "export">("newgen-studio");
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      const saved = sessionStorage.getItem("ais_terminal_logs");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [status, setStatus] = useState<TerminalStatus>({
    isRunning: false,
    command: null,
    processId: null,
    cwd: "/app/applet/newgen",
    relativeCwd: "newgen",
  });
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [connected, setConnected] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Keep sessionStorage in sync
  useEffect(() => {
    try {
      if (logs.length > 0) {
        sessionStorage.setItem("ais_terminal_logs", JSON.stringify(logs.slice(-2000)));
      }
    } catch {}
  }, [logs]);

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/terminal/stream");
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setErrorBanner(null);
    };

    es.addEventListener("init", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setStatus((prev) => ({
          ...prev,
          isRunning: data.isRunning,
          command: data.command,
          processId: data.processId,
          cwd: data.cwd || prev.cwd,
          relativeCwd: data.relativeCwd || prev.relativeCwd,
        }));
        if (data.history && Array.isArray(data.history) && data.history.length > 0) {
          setLogs((prev) => {
            if (prev.length === 0) return data.history;
            const existingIds = new Set(prev.map((l) => l.id));
            const newEntries = data.history.filter((l: LogEntry) => !existingIds.has(l.id));
            return [...prev, ...newEntries];
          });
        }
      } catch (err) {
        console.error("Failed parsing init payload", err);
      }
    });

    es.addEventListener("log", (event: MessageEvent) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        setLogs((prev) => {
          if (prev.some((p) => p.id === entry.id)) return prev;
          const next = [...prev, entry];
          return next.length > 3000 ? next.slice(-2500) : next;
        });
      } catch (err) {
        console.error("Failed parsing log payload", err);
      }
    });

    es.addEventListener("status", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setStatus((prev) => ({
          ...prev,
          isRunning: data.isRunning,
          command: data.command,
          processId: data.processId,
          exitCode: data.exitCode,
        }));
      } catch (err) {
        console.error("Failed parsing status payload", err);
      }
    });

    es.addEventListener("cwd", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setStatus((prev) => ({
          ...prev,
          cwd: data.cwd,
          relativeCwd: data.relativeCwd,
        }));
      } catch (err) {
        console.error("Failed parsing cwd payload", err);
      }
    });

    es.addEventListener("clear", () => {
      setLogs([]);
      try {
        sessionStorage.removeItem("ais_terminal_logs");
      } catch {}
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Retry connection after 2.5s
      setTimeout(() => {
        connectSSE();
      }, 2500);
    };
  }, []);

  const fetchSystemInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/system/info");
      if (res.ok) {
        const data = await res.json();
        setSystemInfo(data);
      }
    } catch (err) {
      console.error("Failed fetching system info", err);
    }
  }, []);

  useEffect(() => {
    connectSSE();
    fetchSystemInfo();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connectSSE, fetchSystemInfo]);

  const handleRunCommand = async (command: string, cwd: string) => {
    setErrorBanner(null);
    try {
      const res = await fetch("/api/terminal/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, cwd }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorBanner(data.error || "Failed to start command");
      }
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to communicate with server");
    }
  };

  const handleKillProcess = async () => {
    try {
      await fetch("/api/terminal/kill", { method: "POST" });
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to terminate process");
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch("/api/terminal/clear", { method: "POST" });
      setLogs([]);
    } catch (err: any) {
      console.error("Failed clearing logs", err);
    }
  };

  const handleSendInput = async (input: string) => {
    try {
      await fetch("/api/terminal/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to send input to process");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-600/30 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur sticky top-0 z-30 px-4 lg:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-semibold text-slate-100 tracking-tight">
                  Live Terminal Console
                </h1>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  Container Shell
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time stdout/stderr stream, command runner & system process monitor
              </p>
            </div>
          </div>

          {/* Nav Tabs & Actions */}
          <div className="flex items-center space-x-2.5">
            <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1">
              <button
                id="tab-newgen-studio-btn"
                onClick={() => setActiveTab("newgen-studio")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "newgen-studio"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm"
                    : "text-indigo-400 hover:text-indigo-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>NewGen Studio</span>
              </button>
              <button
                id="tab-gpu-endpoints-btn"
                onClick={() => setActiveTab("gpu-endpoints")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "gpu-endpoints"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Endpoints & GPU Audit</span>
              </button>
              <button
                id="tab-terminal-btn"
                onClick={() => setActiveTab("terminal")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "terminal"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Live Console</span>
              </button>
              <button
                id="tab-diagnostics-btn"
                onClick={() => setActiveTab("diagnostics")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "diagnostics"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Environment & Files</span>
              </button>
              <button
                id="tab-export-btn"
                onClick={() => setActiveTab("export")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "export"
                    ? "bg-indigo-900/60 text-indigo-200 border border-indigo-700/50 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileArchive className="w-3.5 h-3.5" />
                <span>Export & ZIP</span>
              </button>
            </div>

            {/* Quick Download Button in Header */}
            <a
              id="header-direct-download-btn"
              href="/api/download/project-zip"
              download="newgen-terminal-full-project.zip"
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-medium border border-indigo-500/50 transition-all shadow-sm"
              title="Download entire project as ZIP"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
            </a>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {errorBanner && (
        <div className="bg-rose-950/80 border-b border-rose-900 px-4 py-2 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center space-x-2 max-w-7xl mx-auto w-full">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorBanner}</span>
            <button
              onClick={() => setErrorBanner(null)}
              className="ml-auto text-rose-400 hover:text-rose-200 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6">
        {activeTab === "newgen-studio" ? (
          <NewGenStudio
            onRunTerminalCommand={(cmd) => {
              setActiveTab("terminal");
              handleRunCommand(cmd, "newgen");
            }}
          />
        ) : activeTab === "gpu-endpoints" ? (
          <GpuEndpointsAuditor
            onRunConsoleCommand={(cmd) => {
              setActiveTab("terminal");
              handleRunCommand(cmd, "newgen");
            }}
          />
        ) : activeTab === "terminal" ? (
          <TerminalView
            logs={logs}
            status={status}
            onRunCommand={handleRunCommand}
            onKillProcess={handleKillProcess}
            onClearLogs={handleClearLogs}
            onSendInput={handleSendInput}
            connected={connected}
          />
        ) : activeTab === "diagnostics" ? (
          <SystemInfoPanel
            info={systemInfo}
            onRefresh={fetchSystemInfo}
            onSelectFileCommand={(cmd) => {
              setActiveTab("terminal");
              handleRunCommand(cmd, "newgen");
            }}
          />
        ) : (
          <ExportProjectPanel />
        )}
      </main>
    </div>
  );
}
