import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  Trash2,
  Copy,
  Check,
  ArrowDown,
  Terminal as TerminalIcon,
  Folder,
  Activity,
  Maximize2,
  Minimize2,
  HelpCircle,
} from "lucide-react";
import { LogEntry, TerminalStatus } from "../types";
import { formatLogText } from "../utils/ansi";

interface TerminalViewProps {
  logs: LogEntry[];
  status: TerminalStatus;
  onRunCommand: (command: string, cwd: string) => Promise<void>;
  onKillProcess: () => Promise<void>;
  onClearLogs: () => Promise<void>;
  onSendInput: (text: string) => Promise<void>;
  connected: boolean;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  logs,
  status,
  onRunCommand,
  onKillProcess,
  onClearLogs,
  onSendInput,
  connected,
}) => {
  const [commandInput, setCommandInput] = useState("");
  const [stdinInput, setStdinInput] = useState("");
  const [cwd, setCwd] = useState("newgen");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Sync active directory from server status
  useEffect(() => {
    if (status.relativeCwd) {
      setCwd(status.relativeCwd);
    } else if (status.cwd) {
      setCwd(status.cwd);
    }
  }, [status.relativeCwd, status.cwd]);

  // Timer for running process
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status.isRunning) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [status.isRunning]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd || status.isRunning) return;

    setCommandHistory((prev) => [cmd, ...prev.filter((c) => c !== cmd)]);
    setHistoryIndex(-1);
    setCommandInput(""); // Clears command input field immediately after submission
    await onRunCommand(cmd, cwd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIdx = historyIndex + 1;
        setHistoryIndex(newIdx);
        setCommandInput(commandHistory[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        setCommandInput(commandHistory[newIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput("");
      }
    }
  };

  const handleCopyLogs = () => {
    const raw = logs.map((l) => `[${l.timestamp}] [${l.type}] ${formatLogText(l.text)}`).join("\n");
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickPresets = [
    { label: "Clone VidGen (Auto-LFS)", cmd: "git clone https://github.com/appsyouneed/vidgen.git" },
    { label: "cd vidgen", cmd: "cd vidgen" },
    { label: "cd ..", cmd: "cd .." },
    { label: "List files (ls -lah)", cmd: "ls -lah" },
    { label: "Run bash setup.sh", cmd: "bash setup.sh" },
    { label: "View steps.txt", cmd: "cat steps.txt" },
    { label: "Check Python / Pip", cmd: "python3 --version && which python3" },
    { label: "Memory & CPU", cmd: "free -m && top -b -n 1 | head -n 12" },
  ];

  const filteredLogs = filterText
    ? logs.filter((l) => l.text.toLowerCase().includes(filterText.toLowerCase()))
    : logs;

  return (
    <div
      id="terminal-container"
      className={`flex flex-col bg-slate-950 text-slate-100 rounded-xl border border-slate-800 shadow-2xl overflow-hidden transition-all ${
        isFullscreen ? "fixed inset-2 z-50 rounded-xl" : "h-[740px] w-full"
      }`}
    >
      {/* Terminal Titlebar */}
      <div
        id="terminal-titlebar"
        className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 select-none"
      >
        <div className="flex items-center space-x-3">
          {/* Traffic light dots */}
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block border border-rose-600/40"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block border border-amber-600/40"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block border border-emerald-600/40"></span>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
            <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-slate-200">
              {status.isRunning ? (
                <span className="flex items-center gap-1.5 text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  Running: {status.command} ({elapsedSeconds}s)
                </span>
              ) : (
                <span>bash — {cwd}/</span>
              )}
            </span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center space-x-2">
          {/* Connection Status Indicator */}
          <div
            className={`flex items-center space-x-1.5 text-xs px-2 py-1 rounded border ${
              connected
                ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400"
                : "bg-rose-950/60 border-rose-800/60 text-rose-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            ></span>
            <span className="font-mono text-[11px]">{connected ? "LIVE SSE" : "OFFLINE"}</span>
          </div>

          {/* Search filter input */}
          <input
            type="text"
            placeholder="Filter logs..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="text-xs bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 w-32 md:w-44 font-mono"
          />

          {/* Auto scroll toggle */}
          <button
            id="toggle-autoscroll-btn"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded text-xs border transition-colors flex items-center gap-1 ${
              autoScroll
                ? "bg-slate-800 border-slate-700 text-emerald-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle Auto-scroll"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">{autoScroll ? "Lock" : "Free"}</span>
          </button>

          {/* Copy button */}
          <button
            id="copy-terminal-btn"
            onClick={handleCopyLogs}
            className="p-1.5 rounded text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy all logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear logs */}
          <button
            id="clear-terminal-btn"
            onClick={onClearLogs}
            className="p-1.5 rounded text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
            title="Clear output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen toggle */}
          <button
            id="fullscreen-terminal-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div
        id="quick-presets-bar"
        className="flex items-center space-x-2 px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto text-xs scrollbar-thin"
      >
        <span className="text-slate-400 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap">
          Quick Launch:
        </span>
        {quickPresets.map((preset) => (
          <button
            key={preset.label}
            disabled={status.isRunning}
            onClick={() => {
              setCommandInput(preset.cmd);
              onRunCommand(preset.cmd, cwd);
            }}
            className="whitespace-nowrap px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 disabled:opacity-50 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-mono transition-all"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Terminal Output Screen */}
      <div
        ref={terminalContainerRef}
        id="terminal-output-viewport"
        className="flex-1 p-4 overflow-y-auto font-mono text-[13px] leading-relaxed bg-[#0b0f19] text-slate-300 selection:bg-indigo-600/40 selection:text-white"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 select-none">
            <TerminalIcon className="w-10 h-10 text-slate-700 stroke-[1.5]" />
            <p className="text-sm font-sans text-slate-400">Terminal ready. No logs in buffer.</p>
            <p className="text-xs text-slate-500 max-w-sm text-center">
              Execute a command or click a quick launch button above (like{" "}
              <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">bash setup.sh</code>) to stream output in real time.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const cleanText = formatLogText(log.text);
            return (
              <div key={log.id} className="flex items-start space-x-2.5 hover:bg-slate-900/40 px-1 rounded py-0.5 group">
                <span className="text-slate-600 text-[11px] select-none shrink-0 pt-[1px]">
                  {log.timestamp}
                </span>

                {log.type === "command" && (
                  <span className="text-emerald-400 font-semibold break-all flex items-center gap-1.5">
                    <span className="text-emerald-500 select-none">❯</span> {cleanText}
                  </span>
                )}

                {log.type === "stdout" && (
                  <span className="text-slate-200 whitespace-pre-wrap break-all">{cleanText}</span>
                )}

                {log.type === "stderr" && (
                  <span className="text-rose-400 whitespace-pre-wrap break-all bg-rose-950/20 px-1 rounded">
                    {cleanText}
                  </span>
                )}

                {log.type === "system" && (
                  <span className="text-amber-400 italic font-sans text-xs break-all bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/40">
                    {cleanText}
                  </span>
                )}
              </div>
            );
          })
        )}

        {status.isRunning && (
          <div className="flex items-center space-x-2 text-amber-400 pt-2 px-1 text-xs">
            <span className="inline-block w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
            <span>Executing... ({elapsedSeconds}s elapsed)</span>
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>

      {/* Interactive Stdin & Auto-Prompt Handler Bar (When Process Is Running) */}
      {status.isRunning && (
        <div
          id="stdin-interactive-bar"
          className="px-4 py-2.5 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs select-none"
        >
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 font-medium text-[11px] uppercase tracking-wider">
              Auto-Prompt Handler:
            </span>
            <span className="text-[11px] text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
              Auto-Keep Defaults (force-confold / N)
            </span>
          </div>

          {/* Quick interactive replies to stdin */}
          <div className="flex items-center space-x-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-sans mr-1">Quick Reply (stdin):</span>
            <button
              id="send-default-n-btn"
              type="button"
              onClick={() => onSendInput("N")}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium hover:border-slate-500 transition-colors"
              title="Send 'N' (Keep currently-installed version)"
            >
              N (Keep Default)
            </button>
            <button
              id="send-enter-btn"
              type="button"
              onClick={() => onSendInput("")}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium hover:border-slate-500 transition-colors"
              title="Send [ENTER] newline"
            >
              ⏎ [ENTER]
            </button>
            <button
              id="send-y-btn"
              type="button"
              onClick={() => onSendInput("Y")}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium hover:border-slate-500 transition-colors"
              title="Send 'Y' (Yes)"
            >
              Y (Yes)
            </button>
            <button
              id="send-i-btn"
              type="button"
              onClick={() => onSendInput("I")}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium hover:border-slate-500 transition-colors"
              title="Send 'I' (Install package version)"
            >
              I (Install)
            </button>

            {/* Custom stdin input */}
            <div className="flex items-center ml-2 space-x-1">
              <input
                id="custom-stdin-input"
                type="text"
                value={stdinInput}
                onChange={(e) => setStdinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSendInput(stdinInput);
                    setStdinInput("");
                  }
                }}
                placeholder="Type stdin response..."
                className="w-32 sm:w-40 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                id="submit-stdin-btn"
                type="button"
                onClick={() => {
                  onSendInput(stdinInput);
                  setStdinInput("");
                }}
                className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium font-mono"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Input Bar */}
      <form
        id="terminal-input-form"
        onSubmit={handleSubmit}
        className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2.5"
      >
        {/* Working Directory Indicator & Selector */}
        <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-300 shrink-0">
          <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <select
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            disabled={status.isRunning}
            className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer max-w-[140px] truncate"
            title={`Active working directory: ${status.cwd || cwd}`}
          >
            {cwd && cwd !== "newgen" && cwd !== "newgen/vidgen" && cwd !== "." && (
              <option value={cwd} className="bg-slate-900 text-slate-200">
                {cwd}
              </option>
            )}
            <option value="newgen" className="bg-slate-900 text-slate-200">
              newgen
            </option>
            <option value="newgen/vidgen" className="bg-slate-900 text-slate-200">
              newgen/vidgen
            </option>
            <option value="." className="bg-slate-900 text-slate-200">
              . (root)
            </option>
          </select>
        </div>

        {/* Command Input with real prompt prefix */}
        <div className="flex-1 relative flex items-center">
          <span className="absolute left-3 text-emerald-400 font-mono text-xs select-none font-bold">
            ❯
          </span>
          <input
            id="terminal-command-input"
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status.isRunning}
            placeholder={
              status.isRunning
                ? "Process is running..."
                : `Enter command in ${cwd} (e.g. cd vidgen, git clone ..., ls -lah)...`
            }
            className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded font-mono text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
          />
        </div>

        {/* Action button (Run or Kill) */}
        {status.isRunning ? (
          <button
            id="kill-process-btn"
            type="button"
            onClick={onKillProcess}
            className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-rose-900/30 transition-all cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop (SIGTERM)</span>
          </button>
        ) : (
          <button
            id="run-command-btn"
            type="submit"
            disabled={!commandInput.trim()}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-indigo-900/30 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Execute</span>
          </button>
        )}
      </form>
    </div>
  );
};
