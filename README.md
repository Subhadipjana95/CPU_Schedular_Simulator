# CPU Scheduling Simulator

A full-stack CPU scheduling simulator with a **C++ REST API backend** (Crow) and a **Next.js frontend** (shadcn/ui).

![architecture](https://img.shields.io/badge/Architecture-C%2B%2B%20%2B%20Next.js-indigo)
![algorithms](https://img.shields.io/badge/Algorithms-5-violet)
![license](https://img.shields.io/badge/License-MIT-green)

---

## Supported Algorithms

| Algorithm | Key | Preemptive |
|-----------|-----|------------|
| First Come First Served | `fcfs` | ❌ |
| Shortest Job First | `sjf` | ❌ |
| Shortest Remaining Time First | `srtf` | ✅ |
| Round Robin | `round_robin` | ✅ |
| Priority | `priority` | ❌ |

---

## Architecture

```
Next.js (localhost:3000)  ──POST /api/schedule──▶  Crow C++ (localhost:8080)
         ◀─────────────────────JSON response──────────────────────────────────
```

---

## Local Development

You need two terminals — one for the backend and one for the frontend.

### Prerequisites
- **Backend**: CMake ≥ 3.16, GCC/Clang/MSVC with C++17 support, Git
- **Frontend**: Node.js ≥ 18, npm

---

### Terminal 1 — Backend (C++ HTTP Server)

**Option A (Easiest — One Click Batch Script):**
```cmd
cd backend
.\run.bat
```

**Option B (Manual with g++ / MinGW):**
```powershell
cd backend
mkdir build ; cd build
g++ -std=c++17 -O2 -I..\include -I..\third_party ..\main.cpp ..\src\fcfs.cpp ..\src\sjf.cpp ..\src\srtf.cpp ..\src\round_robin.cpp ..\src\priority.cpp -o server.exe -lws2_32
.\server.exe
```

The server starts on **http://localhost:8080**.

---

### Terminal 2 — Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## API Reference

### `POST /api/schedule`

**Request body:**
```json
{
  "algorithm": "round_robin",
  "quantum": 2,
  "processes": [
    { "pid": "P1", "arrival_time": 0, "burst_time": 5, "priority": 1 },
    { "pid": "P2", "arrival_time": 1, "burst_time": 3, "priority": 2 }
  ]
}
```

**Response:**
```json
{
  "gantt_chart": [
    { "pid": "P1", "start": 0, "end": 2 },
    { "pid": "P2", "start": 2, "end": 4 }
  ],
  "process_metrics": [
    { "pid": "P1", "completion_time": 5, "turnaround_time": 5, "waiting_time": 0, "response_time": 0 }
  ],
  "averages": {
    "avg_waiting_time": 3.33,
    "avg_turnaround_time": 6.0,
    "avg_response_time": 1.5
  }
}
```

### `GET /api/health`
Returns `{"status":"ok"}`.

---

## Deployment

### Frontend → Vercel

1. Push your repo to GitHub.
2. Import the repo in Vercel — set the **Root Directory** to `frontend/`.
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-backend-url`.
4. Deploy.

### Backend → Render / Railway / Fly.io

Using the included `backend/Dockerfile`:

```bash
cd backend
docker build -t cpu-scheduler-backend .
docker run -p 8080:8080 cpu-scheduler-backend
```

Or point Render/Railway/Fly.io at the `backend/` folder — they auto-build from the Dockerfile.

> **CORS**: Once deployed, replace `"*"` in `main.cpp`'s `add_cors` lambda with your real Vercel URL (e.g., `https://your-app.vercel.app`).

---

## Project Structure

```
├── backend/
│   ├── CMakeLists.txt          # CMake build — auto-fetches Crow v1.2.0
│   ├── main.cpp                # Crow HTTP server, CORS, /api/schedule route
│   ├── Dockerfile
│   ├── include/
│   │   ├── Process.hpp
│   │   ├── SchedulerResult.hpp
│   │   └── SchedulerDispatch.hpp
│   ├── src/
│   │   ├── fcfs.cpp
│   │   ├── sjf.cpp
│   │   ├── srtf.cpp
│   │   ├── round_robin.cpp
│   │   └── priority.cpp
│   └── third_party/nlohmann/json.hpp
└── frontend/
    ├── app/page.tsx            # Main simulator page
    ├── components/
    │   ├── AlgorithmSelector.tsx
    │   ├── ProcessInputTable.tsx
    │   ├── GanttChart.tsx
    │   └── MetricsTable.tsx
    ├── lib/api.ts              # runScheduler() fetch wrapper
    └── .env.local              # NEXT_PUBLIC_API_URL=http://localhost:8080
```
