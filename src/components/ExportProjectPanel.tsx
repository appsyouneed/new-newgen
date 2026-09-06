import React, { useState, useEffect } from "react";
import {
  Download,
  FileArchive,
  Check,
  Copy,
  FolderTree,
  Terminal,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Code,
  Layers,
  Sparkles,
} from "lucide-react";

interface DownloadInfo {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  lastModified: string;
}

export const ExportProjectPanel: React.FC = () => {
  const [downloadInfo, setDownloadInfo] = useState<DownloadInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedExtract, setCopiedExtract] = useState(false);

  const fetchDownloadInfo = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/download/info");
      if (res.ok) {
        const data = await res.json();
        setDownloadInfo(data);
      }
    } catch (err) {
      console.error("Failed to fetch download info", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchDownloadInfo();
  }, []);

  const downloadUrl = `${window.location.origin}/api/download/project-zip`;
  const curlCommand = `curl -fSL -o newgen-project.zip "${downloadUrl}"`;
  const extractCommand = `unzip newgen-project.zip -d newgen-app && cd newgen-app && npm install && npm run dev`;

  const handleCopy = (text: string, type: "curl" | "extract") => {
    navigator.clipboard.writeText(text);
    if (type === "curl") {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedExtract(true);
      setTimeout(() => setCopiedExtract(false), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-6">
      {/* Primary Download Card */}
      <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-2xl p-6 lg:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
              <FileArchive className="w-3.5 h-3.5" />
              <span>Full Archive Export Package</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Download Complete Project ZIP
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Export the complete codebase: the custom live streaming terminal server (Express + SSE), interactive web frontend (React + Tailwind), patched NewGen repository with non-interactive dpkg handlers, setup scripts, and configurations.
            </p>
            {downloadInfo && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400 font-mono">
                <span className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/70 text-slate-200">
                  📦 {downloadInfo.filename}
                </span>
                <span className="bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60 text-emerald-300">
                  ⚡ {downloadInfo.sizeFormatted}
                </span>
                <span className="text-slate-500">
                  Updated: {new Date(downloadInfo.lastModified).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <a
              id="download-project-zip-btn"
              href="/api/download/project-zip"
              download="newgen-terminal-full-project.zip"
              className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2.5 transition-all transform hover:-translate-y-0.5"
            >
              <Download className="w-4 h-4" />
              <span>Download ZIP ({downloadInfo?.sizeFormatted || "340 KB"})</span>
            </a>

            <button
              id="refresh-zip-btn"
              onClick={fetchDownloadInfo}
              disabled={isRefreshing}
              className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center justify-center space-x-2 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-400" : ""}`} />
              <span>{isRefreshing ? "Regenerating..." : "Re-pack Latest ZIP"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Package Contents Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Terminal className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">Full Live Terminal</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Bidirectional process streamer with Server-Sent Events (SSE), ANSI colorizer, child process runner, and real-time interactive stdin controller.
          </p>
          <ul className="text-[11px] text-slate-300 font-mono space-y-1 pt-1">
            <li>• server.ts (Express + Vite)</li>
            <li>• SSE log buffer & broadcast</li>
            <li>• Stdin reply pipeline</li>
          </ul>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">NewGen Automation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Autonomous debconf / dpkg auto-answer engine, lock-frontend cleanup routines, and the patched NewGen (Video & Photo generator) scripts.
          </p>
          <ul className="text-[11px] text-slate-300 font-mono space-y-1 pt-1">
            <li>• newgen/setup.sh (Non-interactive)</li>
            <li>• newgen/run.sh & autorun.sh</li>
            <li>• newgen/requirements.txt</li>
          </ul>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Code className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">React Frontend & Ready Dist</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Source UI with Tailwind styles, system hardware monitors, lock release controls, plus the ready-to-run compiled bundle.
          </p>
          <ul className="text-[11px] text-slate-300 font-mono space-y-1 pt-1">
            <li>• src/ (App, Terminal, Panels)</li>
            <li>• dist/ (compiled production bundle)</li>
            <li>• README.md (Setup instructions)</li>
          </ul>
        </div>
      </div>

      {/* Terminal Download Commands */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Download via Terminal (cURL / Wget)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Direct CLI Fetch</span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>1. Fetch ZIP Archive:</span>
              <button
                onClick={() => handleCopy(curlCommand, "curl")}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
              >
                {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCurl ? "Copied" : "Copy cURL"}</span>
              </button>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg font-mono text-xs text-slate-200 overflow-x-auto select-all">
              {curlCommand}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>2. Unpack and Run:</span>
              <button
                onClick={() => handleCopy(extractCommand, "extract")}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
              >
                {copiedExtract ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedExtract ? "Copied" : "Copy Command"}</span>
              </button>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto select-all">
              {extractCommand}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
