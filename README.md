# CPU Scheduling Simulator
### C++ → WebAssembly · Zero Backend · Five Algorithms

A fully **client-side** CPU Scheduling Simulator where every scheduling algorithm is written in **C++**, compiled to **WebAssembly** via Emscripten, and executed directly in the browser. No backend. No server. Pure C++ performance in the browser.

---

## Features

| Algorithm | Type | Variant |
|-----------|------|---------|
| **FCFS** — First Come First Serve | Non-preemptive | — |
| **SJF** — Shortest Job First | Non-preemptive | — |
| **SRTF** — Shortest Remaining Time First | Preemptive | — |
| **Round Robin** | Preemptive | Configurable quantum |
| **Priority** | Both | Non-preemptive & Preemptive |

- **Interactive Gantt chart** on `<canvas>` with hover tooltips
- **Per-process metrics**: arrival, burst, completion, turnaround, waiting, response times
- **Algorithm comparison chart** (Chart.js) — run multiple algorithms back-to-back and compare averages
- **Dynamic process table** — add/remove rows freely
- **JS Fallback** — works immediately without Emscripten (pure-JS implementations auto-activate if WASM isn't available)
- Premium dark-mode UI (glassmorphism, animated, responsive)

---

## Project Structure

```
cpu-scheduler/
├── index.html                          # UI
├── style.css                           # Dark-mode design system
├── app.js                              # WASM orchestrator + renderer
├── build.ps1                           # Windows build script
├── build.sh                            # Linux/macOS build script
├── third_party/
│   └── nlohmann/
│       └── json.hpp                    # Auto-downloaded by build script
└── algorithms/
    ├── fcfs/
    │   ├── fcfs.cpp                    # C++ source
    │   ├── fcfs_fallback.js            # Pure JS fallback
    │   ├── fcfs.js                     # [GENERATED] Emscripten glue
    │   └── fcfs.wasm                   # [GENERATED] WASM binary
    ├── sjf/   (same pattern)
    ├── srtf/  (same pattern)
    ├── round_robin/ (same pattern)
    └── priority/ (same pattern)
```

---

## Quick Start (with JS Fallback — no build required)

The simulator works **out of the box** using pure JavaScript fallbacks. Just serve the project:

```powershell
# Windows PowerShell
cd "C:\Users\subha\Downloads\CPU Schedular"
python -m http.server 8080
```

Then open **http://localhost:8080** in your browser.

> **Why a server?** WASM files must be served over HTTP, not `file://`. Python's built-in server is the easiest option.

---

## Building the C++ → WebAssembly Modules

For full C++ performance via WebAssembly, install Emscripten and run the build script.

### Step 1: Install Emscripten SDK

**Windows:**
```powershell
# In a directory of your choice (e.g. C:\emsdk)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
.\emsdk install latest
.\emsdk activate latest
.\emsdk_env.ps1       # Adds emcc to PATH for this session
```

**Linux / macOS / WSL:**
```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

Verify: `emcc --version` should print something like `emcc (Emscripten gcc/clang-like replacement) 3.x.x`.

### Step 2: Run the Build Script

**Windows (PowerShell):**
```powershell
cd "C:\Users\subha\Downloads\CPU Schedular"
.\build.ps1
```

**Linux / macOS / WSL:**
```bash
cd /path/to/cpu-schedular
chmod +x build.sh
./build.sh
```

The build script:
1. Verifies `emcc` is on PATH
2. Downloads `nlohmann/json` single-header (v3.11.3) if not already present
3. Compiles each `.cpp` file with `MODULARIZE=1` and a unique `EXPORT_NAME` so modules don't collide on the same page
4. Outputs `.js` glue + `.wasm` binary into each algorithm's folder

### Step 3: Serve Locally

```powershell
cd "C:\Users\subha\Downloads\CPU Schedular"
python -m http.server 8080
```

Open **http://localhost:8080**. The status badge in the UI will say **"Running on WebAssembly"** when compiled modules are loaded.

---

## Manual Build (per algorithm)

If you prefer to compile one algorithm at a time:

```bash
# From the project root (with emcc on PATH and third_party/ containing nlohmann/json)
emcc algorithms/fcfs/fcfs.cpp \
     -o algorithms/fcfs/fcfs.js \
     -s MODULARIZE=1 \
     -s EXPORT_NAME="FCFSModule" \
     -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
     -s ENVIRONMENT=web \
     -s ALLOW_MEMORY_GROWTH=1 \
     -I third_party \
     -std=c++17 \
     -O2
```

Repeat for each algorithm, changing the source file, output filename, and `EXPORT_NAME`:

| Algorithm | Source | Output | EXPORT_NAME |
|-----------|--------|--------|-------------|
| FCFS | `fcfs/fcfs.cpp` | `fcfs/fcfs.js` | `FCFSModule` |
| SJF | `sjf/sjf.cpp` | `sjf/sjf.js` | `SJFModule` |
| SRTF | `srtf/srtf.cpp` | `srtf/srtf.js` | `SRTFModule` |
| Round Robin | `round_robin/round_robin.cpp` | `round_robin/round_robin.js` | `RoundRobinModule` |
| Priority | `priority/priority.cpp` | `priority/priority.js` | `PriorityModule` |

---

## JSON Data Contract

All algorithms share the same input/output shape, so `app.js` has a single rendering path.

**Input:**
```json
{
  "quantum": 2,
  "preemptive": false,
  "processes": [
    { "pid": "P1", "arrival_time": 0, "burst_time": 5, "priority": 1 },
    { "pid": "P2", "arrival_time": 1, "burst_time": 3, "priority": 2 }
  ]
}
```

**Output:**
```json
{
  "gantt_chart": [
    { "pid": "P1", "start": 0, "end": 5 },
    { "pid": "P2", "start": 5, "end": 8 }
  ],
  "process_metrics": [
    { "pid": "P1", "arrival_time": 0, "burst_time": 5,
      "completion_time": 5, "turnaround_time": 5,
      "waiting_time": 0, "response_time": 0 }
  ],
  "averages": {
    "avg_waiting_time": 1.0,
    "avg_turnaround_time": 4.0,
    "avg_response_time": 1.0
  }
}
```

---

## Verification Examples

### FCFS — Expected Output

| PID | Arrival | Burst | Completion | Turnaround | Waiting | Response |
|-----|---------|-------|------------|------------|---------|----------|
| P1 | 0 | 5 | 5 | 5 | 0 | 0 |
| P2 | 1 | 3 | 8 | 7 | 4 | 4 |
| P3 | 2 | 8 | 16 | 14 | 6 | 6 |

Avg Waiting: **3.33** · Avg Turnaround: **8.67**

### Round Robin (Q=2) — Gantt Chart

```
P1[0-2] → P2[2-4] → P3[4-6] → P1[6-8] → P2[8-9] → P3[9-11] → P1[11-12] → P3[12-16]
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Algorithm Logic | C++17 (compiled to WASM) |
| Build Tool | Emscripten (`emcc`) |
| JSON Parsing | [nlohmann/json](https://github.com/nlohmann/json) v3.11.3 |
| Frontend | HTML5 + Vanilla CSS + Vanilla JS (no frameworks) |
| Charts | [Chart.js](https://www.chartjs.org/) v4.4.3 (CDN) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |

---

## Troubleshooting

**"WASM not available — using JavaScript fallback"**
→ The `.wasm` files haven't been built yet. Run `build.ps1` after installing Emscripten. The JS fallback produces identical results.

**"Failed to load fcfs.js"**
→ Make sure you're serving via HTTP (`python -m http.server 8080`), not opening `index.html` directly via `file://`.

**Emscripten compile error about `nlohmann/json.hpp` not found**
→ The build script should auto-download it. If it fails, manually download `json.hpp` from https://github.com/nlohmann/json/releases and place it at `third_party/nlohmann/json.hpp`.

**emcc not recognized**
→ Make sure you ran `.\emsdk_env.ps1` (Windows) or `source ./emsdk_env.sh` (Linux/macOS) in the same terminal session where you run the build script.
