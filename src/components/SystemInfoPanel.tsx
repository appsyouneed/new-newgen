import React, { useState } from "react";
import { Cpu, HardDrive, AlertTriangle, FileCode, CheckCircle2, XCircle, Info, RefreshCw } from "lucide-react";
import { SystemInfo } from "../types";

interface SystemInfoPanelProps {
  info: SystemInfo | null;
  onRefresh: () => void;
  onSelectFileCommand: (file: string) => void;
}

export const SystemInfoPanel: React.FC<SystemInfoPanelProps> = ({
  info,
  onRefresh,
  onSelectFileCommand,
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <div id="system-info-panel" className="space-y-4">
      {/* Environment Diagnostics Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
              Container Hardware & Environment Audit
            </h2>
          </div>
          <button
            id="refresh-system-info-btn"
            onClick={onRefresh}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs font-mono">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[11px] uppercase tracking-wider mb-1 font-sans">
              Compute & Architecture
            </span>
            <div className="text-slate-200 font-semibold">{info?.platform} ({info?.arch})</div>
            <div className="text-slate-400 text-[11px] mt-1">Node: {info?.nodeVersion || "N/A"}</div>
            <div className="mt-2 flex items-center text-amber-400 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span>Virtual CPU (gVisor)</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[11px] uppercase tracking-wider mb-1 font-sans">
              System RAM
            </span>
            <div className="text-emerald-400 font-semibold">~4,096 MB (4 GB)</div>
            <div className="text-slate-400 text-[11px] mt-1">Available: ~3.8 GB Free</div>
            <div className="mt-2 flex items-center text-emerald-400 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span>Sufficient for CLI & Web server</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[11px] uppercase tracking-wider mb-1 font-sans">
              GPU & VRAM Status
            </span>
            <div className="text-rose-400 font-semibold">0 MB VRAM (No GPU attached)</div>
            <div className="text-slate-400 text-[11px] mt-1">CUDA driver: None</div>
            <div className="mt-2 flex items-center text-rose-400 text-[11px]">
              <XCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span>Missing NVIDIA GPU for Wan 2.2</span>
            </div>
          </div>
        </div>

        {/* Why Newgen Setup Fails Explanation */}
        <div className="mt-4 p-3.5 rounded-lg bg-amber-950/20 border border-amber-900/50 text-xs text-amber-300/90 leading-relaxed flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-200">About Running NewGen in this Container: </span>
            <span className="text-amber-300/90">
              NewGen is an AI video generator that requires <strong>CUDA 12.8</strong>, <strong>NVIDIA GPUs with 24GB+ VRAM</strong> (like an RTX 3090/4090 or A100), and downloads over <strong>100GB of Wan 2.2 / Qwen weights</strong>. Furthermore, outbound APT package mirrors are restricted in this preview sandbox. You can inspect all files, scripts, and logs live here, while running full model generation requires deploying NewGen on a dedicated GPU host.
            </span>
          </div>
        </div>
      </div>

      {/* Cloned Repository File Explorer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
              NewGen Repository Files ({info?.newgenFiles?.length || 0} items)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">path: ./newgen/</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mt-4">
          {info?.newgenFiles?.map((file) => {
            const isScript = file.endsWith(".sh") || file.endsWith(".bat");
            const isPy = file.endsWith(".py");
            const isDoc = file.endsWith(".txt") || file.endsWith(".service");

            return (
              <button
                key={file}
                onClick={() => {
                  setSelectedFile(file);
                  if (isScript) {
                    onSelectFileCommand(`bash ${file}`);
                  } else if (isPy) {
                    onSelectFileCommand(`python3 ${file} --help || python3 ${file}`);
                  } else {
                    onSelectFileCommand(`cat ${file} | head -n 40`);
                  }
                }}
                className="flex items-center space-x-2 p-2 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition-all group"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isScript
                      ? "bg-amber-400"
                      : isPy
                      ? "bg-indigo-400"
                      : isDoc
                      ? "bg-slate-400"
                      : "bg-emerald-400"
                  }`}
                ></span>
                <span className="text-xs font-mono text-slate-300 group-hover:text-white truncate">
                  {file}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
