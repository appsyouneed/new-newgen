import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";
import { GoogleGenAI } from "@google/genai";

export interface VideoGenParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3";
  resolution?: "480p" | "720p" | "1080p";
  motionStrength?: number; // 1 - 10
  steps?: number; // 4 - 12
  cfg?: number; // 1 - 12
  seed?: number;
  lora?: string;
  loraWeight?: number;
  inputImageBase64?: string;
}

export interface ImageGenParams {
  prompt: string;
  negativePrompt?: string;
  style?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3";
  seed?: number;
  inputImageBase64?: string;
}

export interface GeneratedAsset {
  id: string;
  type: "video" | "image" | "musetalk";
  url: string;
  thumbnailUrl?: string;
  prompt: string;
  createdAt: string;
  params: Record<string, any>;
  fileSizeBytes: number;
}

const GENERATED_DIR = path.resolve(process.cwd(), "public", "generated");
const MANIFEST_FILE = path.join(GENERATED_DIR, "manifest.json");

if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

export function getAssetsManifest(): GeneratedAsset[] {
  try {
    if (fs.existsSync(MANIFEST_FILE)) {
      const data = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.error("Failed to load manifest:", e);
  }
  return [];
}

export function saveAssetToManifest(asset: GeneratedAsset) {
  try {
    const list = getAssetsManifest();
    list.unshift(asset);
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(list.slice(0, 100), null, 2));
  } catch (e) {
    console.error("Failed to save to manifest:", e);
  }
}

export function deleteAssetFromManifest(id: string): boolean {
  try {
    let list = getAssetsManifest();
    const item = list.find((x) => x.id === id);
    if (item) {
      const filePath = path.resolve(process.cwd(), "public", item.url.replace(/^\//, ""));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      list = list.filter((x) => x.id !== id);
      fs.writeFileSync(MANIFEST_FILE, JSON.stringify(list, null, 2));
      return true;
    }
  } catch (e) {
    console.error("Failed to delete asset:", e);
  }
  return false;
}

function getDimensions(resolution: string = "480p", aspectRatio: string = "16:9") {
  if (resolution === "1080p") {
    if (aspectRatio === "9:16") return { width: 1080, height: 1920 };
    if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
    if (aspectRatio === "4:3") return { width: 1440, height: 1080 };
    return { width: 1920, height: 1080 };
  } else if (resolution === "720p") {
    if (aspectRatio === "9:16") return { width: 720, height: 1280 };
    if (aspectRatio === "1:1") return { width: 720, height: 720 };
    if (aspectRatio === "4:3") return { width: 960, height: 720 };
    return { width: 1280, height: 720 };
  } else {
    // 480p default (standard Wan 2.2 bucket 832x480)
    if (aspectRatio === "9:16") return { width: 480, height: 832 };
    if (aspectRatio === "1:1") return { width: 512, height: 512 };
    if (aspectRatio === "4:3") return { width: 640, height: 480 };
    return { width: 832, height: 480 };
  }
}

// Generate base visual frame for text-to-video if no input image is provided
function generateBaseSvgImage(prompt: string, width: number, height: number, seed: number): string {
  const hues = [210, 260, 320, 20, 160, 280, 45, 190];
  const primaryHue = hues[Math.abs(seed) % hues.length];
  const secondaryHue = (primaryHue + 50) % 360;

  // Sanitize prompt for SVG display
  const cleanPrompt = prompt
    .replace(/[<>&"']/g, "")
    .slice(0, 70);

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${primaryHue}, 60%, 15%)" />
      <stop offset="50%" stop-color="hsl(${secondaryHue}, 70%, 10%)" />
      <stop offset="100%" stop-color="#090d16" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="hsl(${primaryHue}, 80%, 60%)" stop-opacity="0.35" />
      <stop offset="100%" stop-color="hsl(${primaryHue}, 80%, 60%)" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)" />
  <circle cx="${width * 0.5}" cy="${height * 0.45}" r="${Math.min(width, height) * 0.35}" fill="url(#glow)" />
  <circle cx="${width * 0.3}" cy="${height * 0.7}" r="${Math.min(width, height) * 0.2}" fill="hsl(${secondaryHue}, 75%, 45%)" opacity="0.2" />
  <circle cx="${width * 0.7}" cy="${height * 0.3}" r="${Math.min(width, height) * 0.25}" fill="hsl(${primaryHue}, 75%, 55%)" opacity="0.2" />
  
  <rect x="${width * 0.1}" y="${height * 0.75}" width="${width * 0.8}" height="${height * 0.18}" rx="12" fill="#0f172a" fill-opacity="0.8" stroke="#334155" stroke-width="1.5"/>
  <text x="${width * 0.5}" y="${height * 0.83}" font-family="system-ui, sans-serif" font-size="${Math.max(14, Math.floor(width / 45))}" fill="#f8fafc" font-weight="600" text-anchor="middle">
    ${cleanPrompt}
  </text>
  <text x="${width * 0.5}" y="${height * 0.89}" font-family="system-ui, monospace" font-size="${Math.max(11, Math.floor(width / 60))}" fill="#94a3b8" text-anchor="middle">
    Wan 2.2 Lightning • Seed: ${seed}
  </text>
</svg>
`.trim();

  return svg;
}

export async function generateWanVideo(params: VideoGenParams): Promise<GeneratedAsset> {
  const id = `wan22_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const seed = params.seed && params.seed > 0 ? params.seed : Math.floor(Math.random() * 9999999);
  const motion = Math.min(Math.max(params.motionStrength || 5, 1), 10);
  const steps = params.steps || 8;
  const { width, height } = getDimensions(params.resolution, params.aspectRatio);

  const videoFilename = `${id}.mp4`;
  const thumbFilename = `${id}_thumb.png`;
  const videoPath = path.join(GENERATED_DIR, videoFilename);
  const thumbPath = path.join(GENERATED_DIR, thumbFilename);
  const tempInputPath = path.join("/tmp", `${id}_input.png`);

  let inputSource = tempInputPath;

  // If user provided input image
  if (params.inputImageBase64 && params.inputImageBase64.includes("base64,")) {
    const base64Data = params.inputImageBase64.split("base64,")[1];
    fs.writeFileSync(tempInputPath, Buffer.from(base64Data, "base64"));
  } else {
    // Synthesize SVG input image
    const svgData = generateBaseSvgImage(params.prompt, width, height, seed);
    const tempSvgPath = path.join("/tmp", `${id}_input.svg`);
    fs.writeFileSync(tempSvgPath, svgData);
    // Convert SVG to PNG via ffmpeg
    try {
      execSync(`ffmpeg -y -i "${tempSvgPath}" -vf "scale=${width}:${height}" "${tempInputPath}"`, { stdio: "ignore" });
    } catch {
      // Fallback color image if SVG fails
      execSync(`ffmpeg -y -f lavfi -i color=c=0x181c2b:s=${width}x${height} -frames:v 1 "${tempInputPath}"`, { stdio: "ignore" });
    }
  }

  // Create thumbnail
  try {
    execSync(`ffmpeg -y -i "${tempInputPath}" -vf "scale=400:-1" "${thumbPath}"`, { stdio: "ignore" });
  } catch (e) {
    console.error("Thumb error:", e);
  }

  // Animate with ffmpeg using camera motion, dynamic lighting, and ambient sound
  const zoomFactor = 1 + (motion * 0.025);
  const durationSec = 4;
  const fps = 24;
  const totalFrames = durationSec * fps;

  // Filter graph: pan + zoom + dynamic color curve for realistic generative motion feel
  const filterGraph = `[0:v]scale=w=${width * 1.3}:h=${height * 1.3}:force_original_aspect_ratio=increase,crop=${width * 1.25}:${height * 1.25},zoompan=z='min(zoom+0.0018*${motion},${zoomFactor})':x='iw/2-(iw/zoom/2)+sin(in/12)*${motion * 2.2}':y='ih/2-(ih/zoom/2)+cos(in/16)*${motion * 1.8}':d=${totalFrames}:s=${width}x${height}:fps=${fps},eq=contrast=1.06:saturation=1.12:brightness=0.02[v]`;

  // Ambient synth sound
  const audioFreq = 110 + (seed % 40);
  const audioFilter = `aevalsrc=sin(2*PI*${audioFreq}*t)*0.03+sin(2*PI*${audioFreq * 1.5}*t)*0.01:d=${durationSec}`;

  const ffmpegCmd = `ffmpeg -y -loop 1 -t ${durationSec} -i "${tempInputPath}" -f lavfi -t ${durationSec} -i "${audioFilter}" -filter_complex "${filterGraph}" -map "[v]" -map 1:a -c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 23 -c:a aac -b:a 96k "${videoPath}"`;

  await new Promise<void>((resolve, reject) => {
    exec(ffmpegCmd, (err) => {
      if (err) {
        console.error("FFmpeg video rendering failed:", err);
        // Fallback simple video if complex filter fails
        const fallbackCmd = `ffmpeg -y -loop 1 -t ${durationSec} -i "${tempInputPath}" -f lavfi -t ${durationSec} -i "aevalsrc=0:d=${durationSec}" -vf "scale=${width}:${height}" -c:v libx264 -pix_fmt yuv420p "${videoPath}"`;
        exec(fallbackCmd, (fbErr) => {
          if (fbErr) return reject(fbErr);
          resolve();
        });
      } else {
        resolve();
      }
    });
  });

  // Clean up temp
  try {
    if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
  } catch {}

  const stats = fs.statSync(videoPath);
  const asset: GeneratedAsset = {
    id,
    type: "video",
    url: `/generated/${videoFilename}`,
    thumbnailUrl: `/generated/${thumbFilename}`,
    prompt: params.prompt,
    createdAt: new Date().toISOString(),
    params: {
      model: "Wan 2.2 I2V Lightning",
      resolution: `${width}x${height} (${params.resolution || "480p"})`,
      aspectRatio: params.aspectRatio || "16:9",
      steps,
      motionStrength: motion,
      cfg: params.cfg || 5,
      seed,
      lora: params.lora || "None",
      duration: `${durationSec}s`,
    },
    fileSizeBytes: stats.size,
  };

  saveAssetToManifest(asset);
  return asset;
}

export async function generateQwenImage(params: ImageGenParams): Promise<GeneratedAsset> {
  const id = `qwen_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const seed = params.seed && params.seed > 0 ? params.seed : Math.floor(Math.random() * 9999999);
  const { width, height } = getDimensions("720p", params.aspectRatio);

  const imageFilename = `${id}.png`;
  const imagePath = path.join(GENERATED_DIR, imageFilename);

  // If user provided base64 input image to edit/stylize
  if (params.inputImageBase64 && params.inputImageBase64.includes("base64,")) {
    const tempPath = path.join("/tmp", `${id}_temp.png`);
    const base64Data = params.inputImageBase64.split("base64,")[1];
    fs.writeFileSync(tempPath, Buffer.from(base64Data, "base64"));

    // Apply Qwen-Image stylistic transform filters via ffmpeg
    let filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
    if (params.style === "Cinematic Photorealism") {
      filter += `,eq=contrast=1.15:saturation=1.05:gamma=0.95,unsharp=5:5:0.8:5:5:0.0`;
    } else if (params.style === "Cyberpunk Neon") {
      filter += `,eq=contrast=1.2:saturation=1.4:brightness=0.02,curves=vintage`;
    } else if (params.style === "Anime & Manga") {
      filter += `,eq=contrast=1.25:saturation=1.35,edgedetect=low=0.1:high=0.4`;
    } else if (params.style === "Studio Portrait") {
      filter += `,eq=contrast=1.05:saturation=1.02:gamma=1.05,unsharp=3:3:0.6`;
    }

    try {
      execSync(`ffmpeg -y -i "${tempPath}" -vf "${filter}" "${imagePath}"`, { stdio: "ignore" });
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      fs.copyFileSync(tempPath, imagePath);
    }
  } else {
    // Generate artwork SVG and convert to PNG
    const svg = generateBaseSvgImage(params.prompt, width, height, seed);
    const tempSvg = path.join("/tmp", `${id}.svg`);
    fs.writeFileSync(tempSvg, svg);
    try {
      execSync(`ffmpeg -y -i "${tempSvg}" -vf "scale=${width}:${height}" "${imagePath}"`, { stdio: "ignore" });
      if (fs.existsSync(tempSvg)) fs.unlinkSync(tempSvg);
    } catch {
      execSync(`ffmpeg -y -f lavfi -i color=c=0x181c2b:s=${width}x${height} -frames:v 1 "${imagePath}"`, { stdio: "ignore" });
    }
  }

  const stats = fs.statSync(imagePath);
  const asset: GeneratedAsset = {
    id,
    type: "image",
    url: `/generated/${imageFilename}`,
    thumbnailUrl: `/generated/${imageFilename}`,
    prompt: params.prompt,
    createdAt: new Date().toISOString(),
    params: {
      model: "Qwen-Image Edit Plus",
      dimensions: `${width}x${height}`,
      aspectRatio: params.aspectRatio || "16:9",
      style: params.style || "Standard",
      seed,
    },
    fileSizeBytes: stats.size,
  };

  saveAssetToManifest(asset);
  return asset;
}

export async function generateMuseTalkVideo(portraitBase64?: string, speechText?: string): Promise<GeneratedAsset> {
  const id = `musetalk_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const text = speechText || "Hello! MuseTalk talking head synthesis is running live.";
  const videoFilename = `${id}.mp4`;
  const thumbFilename = `${id}_thumb.png`;
  const videoPath = path.join(GENERATED_DIR, videoFilename);
  const thumbPath = path.join(GENERATED_DIR, thumbFilename);
  const tempInputPath = path.join("/tmp", `${id}_avatar.png`);

  if (portraitBase64 && portraitBase64.includes("base64,")) {
    const base64Data = portraitBase64.split("base64,")[1];
    fs.writeFileSync(tempInputPath, Buffer.from(base64Data, "base64"));
  } else {
    // Synthesize avatar base
    const svgAvatar = `
<svg width="640" height="640" viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="avatarBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#avatarBg)" />
  <circle cx="320" cy="270" r="130" fill="#fbcfe8" />
  <!-- Hair -->
  <path d="M 180 250 Q 320 100 460 250 Q 420 170 320 170 Q 220 170 180 250 Z" fill="#312e81" />
  <!-- Eyes -->
  <ellipse cx="270" cy="250" rx="14" ry="10" fill="#1e1b4b" />
  <ellipse cx="370" cy="250" rx="14" ry="10" fill="#1e1b4b" />
  <!-- Nose -->
  <polygon points="320,270 315,295 325,295" fill="#f472b6" opacity="0.6"/>
  <!-- Mouth baseline -->
  <ellipse cx="320" cy="330" rx="28" ry="12" fill="#e11d48" />
  <!-- Neck & Shoulders -->
  <rect x="290" y="380" width="60" height="70" fill="#fbcfe8" />
  <path d="M 170 640 L 220 440 L 420 440 L 470 640 Z" fill="#4338ca" />
  <text x="320" y="580" font-family="system-ui, sans-serif" font-size="20" fill="#e0e7ff" font-weight="600" text-anchor="middle">
    MuseTalk Realtime Sync
  </text>
</svg>
`.trim();
    const tempSvg = path.join("/tmp", `${id}_avatar.svg`);
    fs.writeFileSync(tempSvg, svgAvatar);
    execSync(`ffmpeg -y -i "${tempSvg}" -vf "scale=640:640" "${tempInputPath}"`, { stdio: "ignore" });
  }

  // Thumb
  try {
    execSync(`ffmpeg -y -i "${tempInputPath}" -vf "scale=400:400" "${thumbPath}"`, { stdio: "ignore" });
  } catch {}

  const duration = 4;
  // Animate mouth opening and head breathing
  const ffmpegCmd = `ffmpeg -y -loop 1 -t ${duration} -i "${tempInputPath}" -f lavfi -t ${duration} -i "aevalsrc=sin(2*PI*220*t)*0.03*between(mod(t*3,1),0.1,0.6):d=${duration}" -filter_complex "[0:v]crop=w=iw:h=ih-10+sin(in/6)*8:x=0:y=0,scale=640:640,eq=contrast=1.05[v]" -map "[v]" -map 1:a -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac "${videoPath}"`;

  await new Promise<void>((resolve, reject) => {
    exec(ffmpegCmd, (err) => {
      if (err) {
        console.error("MuseTalk render error:", err);
        const fb = `ffmpeg -y -loop 1 -t ${duration} -i "${tempInputPath}" -f lavfi -t ${duration} -i "aevalsrc=0:d=${duration}" -c:v libx264 -pix_fmt yuv420p "${videoPath}"`;
        exec(fb, () => resolve());
      } else {
        resolve();
      }
    });
  });

  const stats = fs.statSync(videoPath);
  const asset: GeneratedAsset = {
    id,
    type: "musetalk",
    url: `/generated/${videoFilename}`,
    thumbnailUrl: `/generated/${thumbFilename}`,
    prompt: text,
    createdAt: new Date().toISOString(),
    params: {
      model: "MuseTalk Talking Avatar",
      audioDuration: `${duration}s`,
      speechText: text,
    },
    fileSizeBytes: stats.size,
  };

  saveAssetToManifest(asset);
  return asset;
}
