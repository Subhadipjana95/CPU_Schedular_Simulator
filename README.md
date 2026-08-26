# ⚡ CPU Scheduling Simulator

A full-stack CPU scheduling simulation tool featuring an ultra-fast **C++ HTTP backend** and a modern **Next.js + shadcn/ui frontend**. It calculates scheduling metrics in real time and renders interactive Gantt charts.

---

## 🛠️ Tech Stack

- **Backend:** C++17, Native Sockets (Winsock on Windows / POSIX on Linux), [nlohmann/json](https://github.com/nlohmann/json)
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS, [shadcn/ui](https://ui.shadcn.com), Lucide Icons
- **Deployment:** Docker (Backend on Render), Vercel (Frontend)

---

## 🧠 Supported Algorithms

1. **FCFS** — First Come First Served (Non-preemptive)
2. **SJF** — Shortest Job First (Non-preemptive)
3. **SRTF** — Shortest Remaining Time First (Preemptive SJF)
4. **Round Robin** — Preemptive with configurable Time Quantum
5. **Priority** — Non-preemptive (lower value = higher priority)

---

## 📁 Project Structure

```
CPU_Schedular_Simulator/
├── backend/                    # C++ REST API Server
│   ├── include/                # Header files & algorithm definitions
│   │   ├── Process.hpp
│   │   ├── SchedulerResult.hpp
│   │   └── SchedulerDispatch.hpp
│   ├── src/                    # Algorithm implementations
│   │   ├── fcfs.cpp
│   │   ├── sjf.cpp
│   │   ├── srtf.cpp
│   │   ├── round_robin.cpp
│   │   └── priority.cpp
│   ├── third_party/            # nlohmann/json.hpp
│   ├── main.cpp                # High-performance HTTP server & router
│   ├── run.bat                 # 1-click Windows build & run script
│   └── Dockerfile              # Container config for cloud deployment
│
└── frontend/                   # Next.js Web Application
    ├── app/
    │   ├── layout.tsx          # Root layout & meta tags
    │   └── page.tsx            # Main simulator dashboard
    ├── components/             # Reusable UI & visualization components
    │   ├── AlgorithmSelector.tsx
    │   ├── ProcessInputTable.tsx
    │   ├── GanttChart.tsx
    │   └── MetricsTable.tsx
    ├── lib/
    │   └── api.ts              # Typed API client
    └── .env.local              # Backend URL configuration
```

---

## 🔄 System Workflow

```
┌────────────────────────────────┐                 ┌───────────────────────────────┐
│       Next.js Frontend         │                 │       C++ Backend Server      │
│     (http://localhost:3000)    │                 │    (http://localhost:8080)    │
└──────────────┬─────────────────┘                 └───────────────┬───────────────┘
               │                                                   │
               │   1. POST /api/schedule (JSON payload)            │
               │ ────────────────────────────────────────────────> │
               │                                                   │ 2. Parses JSON
               │                                                   │ 3. Dispatches to algorithm
               │                                                   │ 4. Computes Gantt & Metrics
               │   5. JSON Response                                │
               │ <──────────────────────────────────────────────── │
               │                                                   │
 6. Renders Gantt Chart & Tables                                   │
```

---

## 💻 How to Run Locally

You will need **two terminals** running simultaneously:

### 1️⃣ Start the Backend (C++)

Open a terminal and run:

**On Windows (Easiest):**
```cmd
cd backend
run.bat
```

*(Or compile manually with `g++`:)*
```bash
cd backend
mkdir build && cd build
g++ -std=c++17 -O2 -I../include -I../third_party ../main.cpp ../src/fcfs.cpp ../src/sjf.cpp ../src/srtf.cpp ../src/round_robin.cpp ../src/priority.cpp -o server.exe -lws2_32
./server.exe
```

The backend will start on **`http://localhost:8080`**.

---

### 2️⃣ Start the Frontend (Next.js)

Open a second terminal and run:

```bash
cd frontend
npm install
npm run dev
```

The web app will be accessible at **`http://localhost:3000`**.

---

## 🌐 API Reference

### `POST /api/schedule`
Executes a scheduling simulation.

**Payload:**
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

### `GET /api/health`
Health check endpoint used for monitoring & keepalive.
```json
{ "status": "ok" }
```
