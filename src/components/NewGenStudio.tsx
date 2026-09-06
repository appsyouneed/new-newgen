import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Video,
  Image as ImageIcon,
  Mic,
  BookOpen,
  Sliders,
  Layers,
  Download,
  Play,
  Pause,
  RefreshCw,
  Upload,
  Check,
  Film,
  Zap,
  Trash2,
  ExternalLink,
  ChevronRight,
  Info,
  Maximize2,
} from "lucide-react";

interface Asset {
  id: string;
  type: "video" | "image" | "musetalk";
  url: string;
  thumbnailUrl?: string;
  prompt: string;
  createdAt: string;
  params: Record<string, any>;
  fileSizeBytes: number;
}

interface LoRAItem {
  display_name: string;
  description: string;
  high_weight?: number;
  low_weight?: number;
  recommended_steps?: number;
  recommended_flow_shift?: number;
  tags?: string[];
  example_prompts?: Array<{ name: string; prompt: string }>;
}

export function NewGenStudio({
  onRunTerminalCommand,
}: {
  onRunTerminalCommand?: (cmd: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "wan22" | "qwen" | "musetalk" | "prompts" | "loras" | "gallery"
  >("wan22");

  // Wan 2.2 form state
  const [wanPrompt, setWanPrompt] = useState(
    "a cinematic cyberpunk street in neon rain, glowing signs, puddles reflecting city lights, smooth tracking camera shot"
  );
  const [wanNegative, setWanNegative] = useState(
    "blurry, distorted, low quality, artifacts, watermark"
  );
  const [wanAspectRatio, setWanAspectRatio] = useState<"16:9" | "9:16" | "1:1" | "4:3">("16:9");
  const [wanResolution, setWanResolution] = useState<"480p" | "720p" | "1080p">("480p");
  const [wanMotion, setWanMotion] = useState<number>(5);
  const [wanSteps, setWanSteps] = useState<number>(8);
  const [wanCfg, setWanCfg] = useState<number>(5.0);
  const [wanSeed, setWanSeed] = useState<number>(-1);
  const [wanSelectedLora, setWanSelectedLora] = useState<string>("None");
  const [wanLoraWeight, setWanLoraWeight] = useState<number>(1.0);
  const [wanImageBase64, setWanImageBase64] = useState<string | null>(null);
  const [isWanGenerating, setIsWanGenerating] = useState<boolean>(false);
  const [wanGenerationProgress, setWanGenerationProgress] = useState<string>("");
  const [currentWanAsset, setCurrentWanAsset] = useState<Asset | null>(null);

  // Qwen-Image form state
  const [qwenPrompt, setQwenPrompt] = useState("Hyper-detailed futuristic portrait with dramatic rim lighting");
  const [qwenStyle, setQwenStyle] = useState("Cinematic Photorealism");
  const [qwenImageBase64, setQwenImageBase64] = useState<string | null>(null);
  const [isQwenGenerating, setIsQwenGenerating] = useState(false);
  const [currentQwenAsset, setCurrentQwenAsset] = useState<Asset | null>(null);

  // MuseTalk form state
  const [museText, setMuseText] = useState("Welcome to NewGen Studio. Generative video synthesis is active and running.");
  const [museImageBase64, setMuseImageBase64] = useState<string | null>(null);
  const [isMuseGenerating, setIsMuseGenerating] = useState(false);
  const [currentMuseAsset, setCurrentMuseAsset] = useState<Asset | null>(null);

  // Prompts and LoRAs bank
  const [promptsBank, setPromptsBank] = useState<Record<string, Record<string, string>>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [promptSearch, setPromptSearch] = useState<string>("");
  const [lorasBank, setLorasBank] = useState<Record<string, LoRAItem>>({});

  // Gallery
  const [gallery, setGallery] = useState<Asset[]>([]);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [enhanceSuccessMsg, setEnhanceSuccessMsg] = useState("");

  const fileInputWanRef = useRef<HTMLInputElement>(null);
  const fileInputQwenRef = useRef<HTMLInputElement>(null);
  const fileInputMuseRef = useRef<HTMLInputElement>(null);

  // Load initial assets, prompts and loras
  useEffect(() => {
    fetchGallery();
    fetchPrompts();
    fetchLoras();
  }, []);

  const fetchGallery = async () => {
    try {
      const res = await fetch("/api/newgen/gallery");
      const data = await res.json();
      if (data.assets) setGallery(data.assets);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPrompts = async () => {
    try {
      const res = await fetch("/api/newgen/prompts");
      const data = await res.json();
      setPromptsBank(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLoras = async () => {
    try {
      const res = await fetch("/api/newgen/loras");
      const data = await res.json();
      setLorasBank(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!wanPrompt.trim()) return;
    setIsEnhancingPrompt(true);
    setEnhanceSuccessMsg("");
    try {
      const res = await fetch("/api/newgen/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: wanPrompt, category: selectedCategory }),
      });
      const data = await res.json();
      if (data.enhancedPrompt) {
        setWanPrompt(data.enhancedPrompt);
        setEnhanceSuccessMsg("Enhanced with cinematic lighting & motion prompts!");
        setTimeout(() => setEnhanceSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const handleGenerateWan = async () => {
    setIsWanGenerating(true);
    setWanGenerationProgress("Initializing Wan 2.2 Lightning engine...");

    // Simulated progress steps
    const stepInterval = setInterval(() => {
      setWanGenerationProgress((prev) => {
        if (prev.includes("Initializing")) return "Step 1/8: Conditioning latents...";
        if (prev.includes("1/8")) return "Step 3/8: Denoising motion vectors...";
        if (prev.includes("3/8")) return "Step 6/8: Flow matching & DiT forward...";
        if (prev.includes("6/8")) return "Step 8/8: VAE temporal decode & H.264 mux...";
        return "Finalizing MP4 video container...";
      });
    }, 600);

    try {
      const res = await fetch("/api/newgen/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: wanPrompt,
          negativePrompt: wanNegative,
          aspectRatio: wanAspectRatio,
          resolution: wanResolution,
          motionStrength: wanMotion,
          steps: wanSteps,
          cfg: wanCfg,
          seed: wanSeed > 0 ? wanSeed : Math.floor(Math.random() * 9999999),
          lora: wanSelectedLora !== "None" ? wanSelectedLora : undefined,
          loraWeight: wanLoraWeight,
          inputImageBase64: wanImageBase64 || undefined,
        }),
      });

      clearInterval(stepInterval);
      const data = await res.json();
      if (data.success && data.asset) {
        setCurrentWanAsset(data.asset);
        fetchGallery();
      } else {
        alert("Generation error: " + (data.error || "Unknown"));
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      alert("Generation failed: " + err.message);
    } finally {
      setIsWanGenerating(false);
      setWanGenerationProgress("");
    }
  };

  const handleGenerateQwen = async () => {
    setIsQwenGenerating(true);
    try {
      const res = await fetch("/api/newgen/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: qwenPrompt,
          style: qwenStyle,
          inputImageBase64: qwenImageBase64 || undefined,
          seed: Math.floor(Math.random() * 9999999),
        }),
      });
      const data = await res.json();
      if (data.success && data.asset) {
        setCurrentQwenAsset(data.asset);
        fetchGallery();
      }
    } catch (err: any) {
      alert("Qwen generation failed: " + err.message);
    } finally {
      setIsQwenGenerating(false);
    }
  };

  const handleGenerateMuseTalk = async () => {
    setIsMuseGenerating(true);
    try {
      const res = await fetch("/api/newgen/musetalk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portraitBase64: museImageBase64 || undefined,
          speechText: museText,
        }),
      });
      const data = await res.json();
      if (data.success && data.asset) {
        setCurrentMuseAsset(data.asset);
        fetchGallery();
      }
    } catch (err: any) {
      alert("MuseTalk failed: " + err.message);
    } finally {
      setIsMuseGenerating(false);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
      await fetch(`/api/newgen/gallery/${id}`, { method: "DELETE" });
      fetchGallery();
    } catch (e) {
      console.error(e);
    }
  };

  const onFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (b64: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Flattened prompts for browsing
  const flattenedPrompts: Array<{ category: string; title: string; prompt: string }> = [];
  Object.entries(promptsBank).forEach(([catKey, catObj]) => {
    if (typeof catObj === "object" && catObj !== null) {
      Object.entries(catObj).forEach(([title, promptText]) => {
        if (
          (selectedCategory === "all" || selectedCategory === catKey) &&
          (promptSearch === "" ||
            title.toLowerCase().includes(promptSearch.toLowerCase()) ||
            promptText.toLowerCase().includes(promptSearch.toLowerCase()))
        ) {
          flattenedPrompts.push({ category: catKey, title, prompt: promptText });
        }
      });
    }
  });

  return (
    <div className="flex flex-col space-y-5">
      {/* Top Banner & Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-950">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white tracking-tight">NewGen Studio</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                Active & Fast
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                100% Free • No Sign-Up
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Wan 2.2 I2V Lightning video synthesis, Qwen-Image Edit, MuseTalk avatar sync, and 322 curated prompt recipes.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            <span>H.264 Native Video Engine</span>
          </div>
          {onRunTerminalCommand && (
            <button
              id="switch-to-cli-btn"
              onClick={() => onRunTerminalCommand("python3 -c 'import sys; print(\"Python ready: \", sys.version)'")}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all font-mono"
            >
              Terminal CLI
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
        <button
          id="tab-wan-btn"
          onClick={() => setActiveTab("wan22")}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "wan22"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Wan 2.2 I2V Lightning</span>
        </button>

        <button
          id="tab-qwen-btn"
          onClick={() => setActiveTab("qwen")}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "qwen"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Qwen-Image Edit Plus</span>
        </button>

        <button
          id="tab-musetalk-btn"
          onClick={() => setActiveTab("musetalk")}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "musetalk"
              ? "bg-pink-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>MuseTalk Talking Avatar</span>
        </button>

        <button
          id="tab-prompts-btn"
          onClick={() => setActiveTab("prompts")}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "prompts"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Prompt Bank ({Object.keys(promptsBank).length > 0 ? "322" : "..."})</span>
        </button>

        <button
          id="tab-loras-btn"
          onClick={() => setActiveTab("loras")}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "loras"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>LoRA Lab ({Object.keys(lorasBank).length})</span>
        </button>

        <button
          id="tab-gallery-btn"
          onClick={() => setActiveTab("gallery")}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "gallery"
              ? "bg-slate-800 text-white shadow-sm border border-slate-700"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Gallery ({gallery.length})</span>
        </button>
      </div>

      {/* TAB 1: WAN 2.2 I2V LIGHTNING */}
      {activeTab === "wan22" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Video Generation Parameters</h3>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <span>8-Step Lightning</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </div>
              </div>

              {/* Prompt Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Prompt</label>
                  <button
                    id="enhance-prompt-btn"
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancingPrompt}
                    className="flex items-center space-x-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-all"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isEnhancingPrompt ? "Enhancing..." : "Auto-Enhance Prompt"}</span>
                  </button>
                </div>
                <textarea
                  id="wan-prompt-input"
                  rows={3}
                  value={wanPrompt}
                  onChange={(e) => setWanPrompt(e.target.value)}
                  placeholder="Describe your scene with motion, atmosphere, and camera direction..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
                />
                {enhanceSuccessMsg && (
                  <p className="text-[11px] text-emerald-400 flex items-center space-x-1 animate-pulse">
                    <Check className="w-3 h-3" />
                    <span>{enhanceSuccessMsg}</span>
                  </p>
                )}
              </div>

              {/* Negative Prompt */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Negative Prompt</label>
                <input
                  id="wan-neg-prompt-input"
                  type="text"
                  value={wanNegative}
                  onChange={(e) => setWanNegative(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Image Input (Optional I2V) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Source Image for Image-to-Video (Optional)
                  </label>
                  {wanImageBase64 && (
                    <button
                      onClick={() => setWanImageBase64(null)}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Clear Image
                    </button>
                  )}
                </div>
                <div
                  onClick={() => fileInputWanRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-3.5 text-center cursor-pointer transition-all ${
                    wanImageBase64
                      ? "border-indigo-500/50 bg-indigo-950/20"
                      : "border-slate-800 hover:border-slate-700 bg-slate-950/60"
                  }`}
                >
                  <input
                    ref={fileInputWanRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onFileUpload(e, setWanImageBase64)}
                  />
                  {wanImageBase64 ? (
                    <div className="flex items-center justify-center space-x-3">
                      <img
                        src={wanImageBase64}
                        alt="Input Preview"
                        className="w-12 h-12 object-cover rounded border border-indigo-400"
                      />
                      <div className="text-left">
                        <p className="text-xs font-medium text-indigo-300">Image Loaded for I2V</p>
                        <p className="text-[10px] text-slate-400">Click to change source frame</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-1">
                      <Upload className="w-5 h-5 text-slate-500 mb-1" />
                      <p className="text-xs text-slate-400">Click or drag an image here for I2V motion</p>
                      <p className="text-[10px] text-slate-600">Supports PNG, JPG, WebP</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Aspect Ratio & Resolution Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Aspect Ratio</label>
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {(["16:9", "9:16", "1:1", "4:3"] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setWanAspectRatio(ratio)}
                        className={`py-1 text-xs rounded font-medium transition-all ${
                          wanAspectRatio === ratio
                            ? "bg-indigo-600 text-white shadow-sm font-semibold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Resolution</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {(["480p", "720p", "1080p"] as const).map((res) => (
                      <button
                        key={res}
                        onClick={() => setWanResolution(res)}
                        className={`py-1 text-xs rounded font-medium transition-all ${
                          wanResolution === res
                            ? "bg-indigo-600 text-white shadow-sm font-semibold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sliders: Motion, Steps, CFG */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Motion Flow</span>
                    <span className="text-indigo-400 font-mono font-semibold">{wanMotion}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={wanMotion}
                    onChange={(e) => setWanMotion(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Sampling Steps</span>
                    <span className="text-indigo-400 font-mono font-semibold">{wanSteps}</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={12}
                    step={1}
                    value={wanSteps}
                    onChange={(e) => setWanSteps(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">CFG Scale</span>
                    <span className="text-indigo-400 font-mono font-semibold">{wanCfg.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={0.5}
                    value={wanCfg}
                    onChange={(e) => setWanCfg(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>

              {/* LoRA Dropdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">LoRA Adapter</label>
                  <select
                    value={wanSelectedLora}
                    onChange={(e) => setWanSelectedLora(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="None">None (Standard Wan 2.2)</option>
                    {(Object.entries(lorasBank) as [string, LoRAItem][]).map(([key, lora]) => (
                      <option key={key} value={key}>
                        {lora.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-semibold">LoRA Weight</span>
                    <span className="text-indigo-400 font-mono font-semibold">{wanLoraWeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    value={wanLoraWeight}
                    onChange={(e) => setWanLoraWeight(Number(e.target.value))}
                    className="w-full accent-indigo-500 mt-1"
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                id="wan-generate-btn"
                onClick={handleGenerateWan}
                disabled={isWanGenerating || !wanPrompt.trim()}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-950/60 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                {isWanGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{wanGenerationProgress || "Generating Video..."}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Generate Video (Wan 2.2 Lightning)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Video Player Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col h-full justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Film className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Live Video Output</h3>
                </div>
                {currentWanAsset && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 font-mono border border-indigo-800">
                    {currentWanAsset.params.resolution}
                  </span>
                )}
              </div>

              {/* Video Player or Placeholder */}
              <div className="flex-1 min-h-[300px] flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden border border-slate-800 relative">
                {isWanGenerating ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="relative w-16 h-16">
                      <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                      <Zap className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto" />
                    </div>
                    <p className="text-xs font-medium text-indigo-300">{wanGenerationProgress}</p>
                    <p className="text-[11px] text-slate-500">Fast local container compilation in ~3s</p>
                  </div>
                ) : currentWanAsset ? (
                  <video
                    src={currentWanAsset.url}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full max-h-[380px] object-contain rounded"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-2">
                    <Video className="w-10 h-10 stroke-[1.2]" />
                    <p className="text-xs text-slate-400 font-medium">Ready for generation</p>
                    <p className="text-[11px] text-slate-600 max-w-xs">
                      Enter a prompt or upload an image and click Generate Video to render your MP4.
                    </p>
                  </div>
                )}
              </div>

              {/* Video Details & Download */}
              {currentWanAsset && (
                <div className="space-y-3 pt-1">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1">
                    <p className="text-slate-300 font-medium line-clamp-2">
                      <span className="text-slate-500">Prompt:</span> {currentWanAsset.prompt}
                    </p>
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                      <span>Seed: {currentWanAsset.params.seed}</span>
                      <span>Motion: {currentWanAsset.params.motionStrength}</span>
                      <span>Size: {(currentWanAsset.fileSizeBytes / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>

                  <a
                    href={currentWanAsset.url}
                    download={`wan22_${currentWanAsset.id}.mp4`}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center justify-center space-x-2 border border-slate-700 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download MP4 Video</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QWEN-IMAGE EDIT PLUS */}
      {activeTab === "qwen" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <ImageIcon className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Qwen-Image Edit Plus Parameters</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Prompt / Edit Instruction</label>
              <textarea
                rows={3}
                value={qwenPrompt}
                onChange={(e) => setQwenPrompt(e.target.value)}
                placeholder="E.g. Inpaint neon background, enhance detail, apply artistic style..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Style Preset</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  "Cinematic Photorealism",
                  "Cyberpunk Neon",
                  "Anime & Manga",
                  "Studio Portrait",
                ].map((st) => (
                  <button
                    key={st}
                    onClick={() => setQwenStyle(st)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      qwenStyle === st
                        ? "bg-purple-600 text-white font-semibold shadow-sm"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Source Image */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">Source Image to Edit (Optional)</span>
                {qwenImageBase64 && (
                  <button onClick={() => setQwenImageBase64(null)} className="text-red-400 hover:underline">
                    Remove
                  </button>
                )}
              </div>
              <div
                onClick={() => fileInputQwenRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/60 rounded-lg p-3 text-center cursor-pointer"
              >
                <input
                  ref={fileInputQwenRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFileUpload(e, setQwenImageBase64)}
                />
                {qwenImageBase64 ? (
                  <div className="flex items-center justify-center space-x-3">
                    <img src={qwenImageBase64} alt="Preview" className="w-12 h-12 object-cover rounded" />
                    <p className="text-xs text-purple-300">Source image ready for transformation</p>
                  </div>
                ) : (
                  <div className="py-2 text-xs text-slate-400">
                    <Upload className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                    Upload image for stylization or generate new artwork
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleGenerateQwen}
              disabled={isQwenGenerating || !qwenPrompt.trim()}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
            >
              {isQwenGenerating ? "Synthesizing Image..." : "Generate / Edit Image (Qwen)"}
            </button>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Image Preview</h3>
              {currentQwenAsset && (
                <span className="text-[10px] text-purple-400 font-mono">{currentQwenAsset.params.dimensions}</span>
              )}
            </div>

            <div className="flex-1 min-h-[280px] flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden border border-slate-800 my-4">
              {isQwenGenerating ? (
                <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
              ) : currentQwenAsset ? (
                <img src={currentQwenAsset.url} alt="Generated" className="max-h-[320px] object-contain rounded" />
              ) : (
                <p className="text-xs text-slate-500">Image will appear here</p>
              )}
            </div>

            {currentQwenAsset && (
              <a
                href={currentQwenAsset.url}
                download="qwen_image.png"
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-2 border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Image</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MUSETALK TALKING AVATAR */}
      {activeTab === "musetalk" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Mic className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-bold text-white">MuseTalk Avatar & Dialogue</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Speech Dialogue / Script</label>
              <textarea
                rows={3}
                value={museText}
                onChange={(e) => setMuseText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Portrait Image */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Portrait Face (Optional)</label>
              <div
                onClick={() => fileInputMuseRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/60 rounded-lg p-3 text-center cursor-pointer"
              >
                <input
                  ref={fileInputMuseRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFileUpload(e, setMuseImageBase64)}
                />
                {museImageBase64 ? (
                  <div className="flex items-center justify-center space-x-3">
                    <img src={museImageBase64} alt="Avatar" className="w-12 h-12 object-cover rounded-full" />
                    <p className="text-xs text-pink-300">Portrait loaded for lip sync</p>
                  </div>
                ) : (
                  <div className="py-2 text-xs text-slate-400">
                    <Upload className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                    Upload portrait or use synthesized digital avatar
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleGenerateMuseTalk}
              disabled={isMuseGenerating}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
            >
              {isMuseGenerating ? "Synthesizing Talking Avatar..." : "Render Speaking Video"}
            </button>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col justify-between">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Avatar Output</h3>
            <div className="flex-1 min-h-[280px] flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden border border-slate-800 my-4">
              {isMuseGenerating ? (
                <RefreshCw className="w-8 h-8 text-pink-400 animate-spin" />
              ) : currentMuseAsset ? (
                <video src={currentMuseAsset.url} controls autoPlay loop className="max-h-[320px] rounded" />
              ) : (
                <p className="text-xs text-slate-500">Avatar video will play here</p>
              )}
            </div>
            {currentMuseAsset && (
              <a
                href={currentMuseAsset.url}
                download="avatar.mp4"
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-2 border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Avatar Video</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PROMPT BANK */}
      {activeTab === "prompts" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Curated Prompts Library (322 Presets)</h3>
              <p className="text-xs text-slate-400">Directly exported from NewGen prompts database.</p>
            </div>
            <input
              type="text"
              placeholder="Search prompts by title or keyword..."
              value={promptSearch}
              onChange={(e) => setPromptSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 w-full md:w-64 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              All Categories ({flattenedPrompts.length})
            </button>
            {Object.keys(promptsBank).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all capitalize ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {cat.replace(/_/g, " ")} ({Object.keys(promptsBank[cat] || {}).length})
              </button>
            ))}
          </div>

          {/* Prompts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[550px] overflow-y-auto pr-1">
            {flattenedPrompts.slice(0, 60).map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between space-y-2.5 hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{item.title}</h4>
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {item.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">{item.prompt}</p>
                </div>

                <div className="flex items-center space-x-2 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={() => {
                      setWanPrompt(item.prompt);
                      setActiveTab("wan22");
                    }}
                    className="flex-1 py-1 text-[11px] rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 font-medium transition-all"
                  >
                    Send to Wan 2.2
                  </button>
                  <button
                    onClick={() => {
                      setQwenPrompt(item.prompt);
                      setActiveTab("qwen");
                    }}
                    className="flex-1 py-1 text-[11px] rounded bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800/80 font-medium transition-all"
                  >
                    Send to Qwen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: LORA LAB */}
      {activeTab === "loras" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">LoRA Laboratory (20 Adapters)</h3>
            <p className="text-xs text-slate-400">
              Extracted from NewGen configuration with recommended steps, flow shift values, and weights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[550px] overflow-y-auto pr-1">
            {(Object.entries(lorasBank) as [string, LoRAItem][]).map(([key, lora]) => (
              <div
                key={key}
                className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-amber-300">{lora.display_name}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">{key}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{lora.description}</p>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {lora.tags?.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 font-mono">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Rec. Steps: {lora.recommended_steps || 4}</span>
                    <span>Flow Shift: {lora.recommended_flow_shift || "6.9"}</span>
                    <span>Weight: {lora.high_weight || 1.0}</span>
                  </div>

                  <button
                    onClick={() => {
                      setWanSelectedLora(key);
                      setWanLoraWeight(lora.high_weight || 1.0);
                      if (lora.recommended_steps) setWanSteps(lora.recommended_steps);
                      setActiveTab("wan22");
                    }}
                    className="w-full py-1 text-xs font-semibold rounded bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800/80 transition-all"
                  >
                    Select in Wan 2.2
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: OUTPUT GALLERY */}
      {activeTab === "gallery" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Generated Video & Image Archive</h3>
              <p className="text-xs text-slate-400">{gallery.length} asset(s) ready for review and download.</p>
            </div>
            <button
              onClick={fetchGallery}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {gallery.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Film className="w-8 h-8 mx-auto" />
              <p className="text-xs font-medium">No outputs generated yet.</p>
              <p className="text-[11px] text-slate-600">
                Switch to Wan 2.2 or Qwen-Image tabs to create videos and images.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gallery.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between group shadow-sm hover:border-slate-700 transition-all"
                >
                  <div className="relative bg-slate-900 aspect-video flex items-center justify-center overflow-hidden">
                    {asset.type === "video" || asset.type === "musetalk" ? (
                      <video
                        src={asset.url}
                        controls
                        className="w-full h-full object-cover"
                        poster={asset.thumbnailUrl}
                      />
                    ) : (
                      <img src={asset.url} alt={asset.prompt} className="w-full h-full object-cover" />
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-900/90 text-slate-200 border border-slate-700">
                      {asset.type}
                    </span>
                  </div>

                  <div className="p-3 space-y-2">
                    <p className="text-xs text-slate-300 font-medium line-clamp-2">{asset.prompt}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{(asset.fileSizeBytes / 1024).toFixed(1)} KB</span>
                      <span>{new Date(asset.createdAt).toLocaleTimeString()}</span>
                    </div>

                    <div className="flex items-center space-x-2 pt-1 border-t border-slate-800">
                      <a
                        href={asset.url}
                        download
                        className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1 border border-slate-700"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-1.5 rounded bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-900"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
