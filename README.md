# NewGen Terminal & Process Controller

A full-stack live terminal streamer, interactive process controller, and automated deployment suite for the NewGen (Video + Photo Generator) application.

## 🚀 Features

- **Live Streaming Terminal**: SSE (Server-Sent Events) bidirectional terminal runner executing bash/python commands with real-time ANSI-rendered output.
- **Auto-Prompt Resolver**: Automatic detection and handling of interactive debconf / dpkg questions (such as `mime.types [default=N]`, `[Y/n]`, and license prompts).
- **Dpkg Lock Recovery**: One-click and automated cleanup of hung `/var/lib/dpkg/lock-frontend` processes.
- **Full NewGen Suite**: Cloned and patched repository containing `setup.sh`, `run.sh`, `start.sh`, `autorun.sh`, `fix.sh`, and requirements.
- **Interactive Stdin Controls**: Send real-time interactive responses directly to active background processes.

---

## 📦 Project Structure

```
├── newgen/              # NewGen video & photo generator source & scripts
│   ├── setup.sh         # Non-interactive setup script (patched)
│   ├── run.sh           # Main runner script
│   ├── start.sh         # App start script
│   ├── autorun.sh       # Auto feeder and worker loop
│   ├── fix.sh / fix.py  # Self-healing dependency and configuration fixes
│   └── requirements.txt # Python package requirements
├── src/                 # React 18 + Tailwind CSS + Lucide frontend
│   ├── components/      # TerminalView, SystemInfoPanel, DownloadPanel
│   └── App.tsx          # Application shell & SSE event stream consumer
├── server.ts            # Express + Vite backend with process spawn & SSE
├── dist/                # Pre-compiled static assets and bundle
├── package.json         # Node scripts & dependencies
└── README.md            # Documentation
```

---

## 💻 Running Locally

### Requirements
- **Node.js**: v18 or later
- **Python**: 3.10+ (for NewGen scripts)
- **Linux / WSL2 / Docker** (recommended for apt/system dependencies)

### Quick Start
1. **Install Node dependencies**:
   ```bash
   npm install
   ```

2. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

3. **Run NewGen Setup**:
   Click the **Run setup.sh** quick preset in the web UI, or execute via terminal:
   ```bash
   cd newgen && bash setup.sh
   ```

---

## 🛠️ Auto-Fixes & Dpkg Recovery

If apt or dpkg is ever locked by another process:
```bash
# Force clear dpkg locks manually
fuser -k -9 /var/lib/dpkg/lock-frontend
rm -f /var/lib/dpkg/lock* /var/lib/apt/lists/lock* /var/cache/apt/archives/lock*
dpkg --configure -a --force-confdef --force-confold
```
Or click the **Clear Dpkg Locks** button inside the web console.
