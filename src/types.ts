export interface LogEntry {
  id: string;
  timestamp: string;
  type: "stdout" | "stderr" | "system" | "command";
  text: string;
}

export interface TerminalStatus {
  isRunning: boolean;
  command: string | null;
  processId: string | null;
  bufferLength?: number;
  exitCode?: number | null;
  cwd?: string;
  relativeCwd?: string;
}

export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  uptime: number;
  cwd: string;
  memInfo: string;
  hasNewgen: boolean;
  newgenFiles: string[];
}

export interface GpuDeviceProbe {
  hasPhysicalGpu: boolean;
  gpuCount: number;
  gpuModel: string;
  vramMb: number;
  cudaAvailable: boolean;
  driverVersion: string;
  nvidiaSmiOutput: string;
  deviceFiles: string[];
  procDriverPaths: string[];
  pciScan: string[];
  accelScan: string[];
  cpuSummary: {
    model: string;
    cores: number;
    arch: string;
    flags: string[];
  };
  kernelInfo: string;
  containerRuntime: string;
  verdict: string;
  verdictDetails: string;
}

export interface EndpointAuditItem {
  path: string;
  method: "GET" | "POST" | "SSE";
  category: "Terminal Control" | "System Diagnostics" | "Google & AI" | "Export & Assets";
  description: string;
  accessScope: "Internal REST" | "Streaming" | "External Outbound" | "Public Reverse Proxy";
  parameters?: string;
  exampleResponse?: string;
}

export interface ExternalConnectionItem {
  service: string;
  provider: string;
  endpointUrl: string;
  protocol: string;
  purpose: string;
  authMethod: string;
  gpuHardwareNote: string;
  status: "Connected" | "Configured" | "Unavailable / Unmounted" | "Restricted Ingress";
}
