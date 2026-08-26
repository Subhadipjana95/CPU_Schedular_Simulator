# Build Prompt: CPU Scheduling Simulator (C++ REST API via Crow)

Copy everything below into your AI coding tool as the project brief. This replaces the
WASM architecture with a running C++ server. Your existing algorithm logic
(fcfs.cpp, sjf.cpp, srtf.cpp, round_robin.cpp, priority.cpp) is reusable —
see the Migration section at the bottom.

---

## Project Goal

Rebuild the CPU Scheduling Simulator so the C++ scheduling algorithms run in a
**persistent backend process** exposed over HTTP, instead of compiled to WebAssembly.

- **Backend:** C++ HTTP server using [Crow](https://github.com/CrowCpp/Crow) (header-only,
  Flask-like routing), compiled with a normal compiler (g++/clang/MSVC) — no Emscripten.
- **Frontend:** rebuilt as a **Next.js** app using **shadcn/ui** components (Button, Card,
  Table, Select, Dialog, etc.) instead of hand-rolled HTML/CSS. Everything is still
  frontend-only work — the C++/Crow backend and JSON contract are unaffected. The Gantt
  chart and process input form become reusable React components instead of DOM-manipulation
  functions in a single `app.js`.
- **Important trade-off you're accepting:** this is a real client-server architecture.
  The server must be running for the app to work — it can't be deployed as a static
  site anymore (no GitHub Pages). Plan to deploy it as a small always-on service
  (see Deployment section).

---

## Architecture

```
┌─────────────────────────┐    HTTP POST /api/schedule    ┌──────────────────────────┐
│  Next.js Frontend         │ ─────────────────────────────▶│    C++ Server (Crow)     │
│  app/page.tsx               │                                │  main.cpp — routes         │
│  components/ProcessTable.tsx │                               │  scheduler_dispatch.cpp    │
│  components/GanttChart.tsx   │◀───────────────────────────── │  fcfs.cpp, sjf.cpp, ...     │
│  components/ui/* (shadcn)     │        JSON response         │                            │
└─────────────────────────┘                                 └──────────────────────────┘
```

- **HTTP framework:** Crow (single-header-ish, easy CMake `FetchContent` integration,
  Flask-style route syntax).
- **JSON:** keep using `nlohmann/json` — you already have this dependency from the WASM build.
- **CORS:** Next.js and Crow are now two separate processes/origins (Next.js dev server on
  `:3000`, Crow on `:8080`), so Crow **must** send `Access-Control-Allow-Origin` headers for
  the Next.js origin. Crow no longer serves the frontend files itself. If you'd rather avoid
  CORS entirely, use a Next.js rewrite (`next.config.js` → `rewrites()`) to proxy
  `/api/schedule` to the Crow server, making requests same-origin from the browser's
  perspective — mention this option to the AI model as an alternative if CORS setup gets messy.
- **Port:** Crow listens on `localhost:8080`; Next.js dev server runs on `localhost:3000`.

---

## Folder Structure

```
project/
├── backend/
│   ├── CMakeLists.txt
│   ├── main.cpp                    # Crow app setup, routes, CORS headers
│   ├── include/
│   │   ├── Process.hpp             # shared struct: pid, arrival_time, burst_time, priority
│   │   ├── SchedulerResult.hpp     # shared struct: gantt_chart, process_metrics, averages
│   │   └── SchedulerDispatch.hpp   # maps algorithm name string -> function pointer
│   ├── src/
│   │   ├── fcfs.cpp                # same core logic as before, minus EMSCRIPTEN wrapper
│   │   ├── sjf.cpp
│   │   ├── srtf.cpp
│   │   ├── round_robin.cpp
│   │   └── priority.cpp
│   ├── third_party/
│   │   └── nlohmann/json.hpp
│   └── Dockerfile                  # for deployment
└── frontend/                        # Next.js app
    ├── app/
    │   ├── page.tsx                 # main simulator page
    │   └── layout.tsx
    ├── components/
    │   ├── ui/                      # shadcn/ui generated components (button, card, table, select, ...)
    │   ├── ProcessInputTable.tsx    # dynamic add/remove process rows
    │   ├── AlgorithmSelector.tsx    # dropdown + conditional quantum/priority fields
    │   ├── GanttChart.tsx           # renders gantt_chart segments
    │   └── MetricsTable.tsx         # renders process_metrics + averages
    ├── lib/
    │   └── api.ts                   # runScheduler() fetch wrapper
    ├── next.config.js               # optional rewrites() proxy to Crow backend
    └── package.json
```

Each algorithm file keeps its own scheduling logic completely separate (same principle
as before), and each frontend piece becomes its own reusable component instead of one
monolithic `app.js`.

---

## JSON Contract (unchanged from your WASM version)

**Request — `POST /api/schedule`:**
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
  "averages": { "avg_waiting_time": 3.33, "avg_turnaround_time": 6.0, "avg_response_time": 1.5 }
}
```

Keeping this identical to the WASM version means your Gantt chart and metrics-table
rendering code in `app.js` **doesn't need to change at all** — only the code that
calls into the scheduling logic changes.

---

## Backend Code Skeletons

**`include/SchedulerDispatch.hpp`** — the single dispatch point (this is your equivalent
of "JS decides which module to load" from the WASM version, just living server-side now):
```cpp
#pragma once
#include <nlohmann/json.hpp>
#include <functional>
#include <unordered_map>
#include <string>

using json = nlohmann::json;
using SchedulerFn = std::function<json(const json&)>;

json run_fcfs(const json& input);
json run_sjf(const json& input);
json run_srtf(const json& input);
json run_round_robin(const json& input);
json run_priority(const json& input);

inline const std::unordered_map<std::string, SchedulerFn>& scheduler_registry() {
    static const std::unordered_map<std::string, SchedulerFn> registry = {
        {"fcfs", run_fcfs},
        {"sjf", run_sjf},
        {"srtf", run_srtf},
        {"round_robin", run_round_robin},
        {"priority", run_priority},
    };
    return registry;
}
```

**`src/fcfs.cpp`** — same core logic as your WASM version, just without the Emscripten
wrapper and `extern "C"` boundary:
```cpp
#include "SchedulerDispatch.hpp"

json run_fcfs(const json& input) {
    // Same FCFS logic you already wrote for the WASM build.
    // Build gantt_chart, process_metrics, averages exactly as before.
    json output;
    // ... your existing algorithm code here ...
    return output;
}
```

**`main.cpp`** — Crow app with CORS enabled for the Next.js frontend's origin (no more
static file serving, since the frontend now lives and runs separately):
```cpp
#include "crow.h"
#include "SchedulerDispatch.hpp"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

int main() {
    crow::SimpleApp app;

    // Allow requests from the Next.js dev server / deployed frontend origin.
    // Tighten this to your actual deployed frontend URL before shipping.
    auto add_cors = [](crow::response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
    };

    CROW_ROUTE(app, "/api/schedule").methods(crow::HTTPMethod::OPTIONS)
    ([&add_cors](const crow::request&) {
        crow::response res(204);
        add_cors(res);
        return res;
    });

    CROW_ROUTE(app, "/api/schedule").methods(crow::HTTPMethod::POST)
    ([&add_cors](const crow::request& req) {
        try {
            json input = json::parse(req.body);
            std::string algo = input.at("algorithm").get<std::string>();

            const auto& registry = scheduler_registry();
            auto it = registry.find(algo);
            if (it == registry.end()) {
                crow::response res(400, R"({"error":"unknown algorithm"})");
                add_cors(res);
                return res;
            }

            json output = it->second(input);
            crow::response res(output.dump());
            res.set_header("Content-Type", "application/json");
            add_cors(res);
            return res;
        } catch (const std::exception& e) {
            crow::response res(400, std::string(R"({"error":")") + e.what() + R"("})");
            add_cors(res);
            return res;
        }
    });

    app.port(8080).multithreaded().run();
}
```
> If you'd rather not deal with CORS at all, use the Next.js `rewrites()` proxy option
> mentioned above instead, and drop the `add_cors` calls — the browser will see every
> request as same-origin.

**`CMakeLists.txt`** — fetches Crow automatically, no manual install needed:
```cmake
cmake_minimum_required(VERSION 3.16)
project(cpu_scheduler_server)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)
FetchContent_Declare(Crow
    GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
    GIT_TAG v1.2.0
)
FetchContent_MakeAvailable(Crow)

add_executable(server
    main.cpp
    src/fcfs.cpp
    src/sjf.cpp
    src/srtf.cpp
    src/round_robin.cpp
    src/priority.cpp
)
target_include_directories(server PRIVATE include third_party)
target_link_libraries(server PRIVATE Crow::Crow)
```
(No `public/` folder or static-file routes needed anymore — the frontend is a separate
Next.js project under `frontend/`.)

---

## Frontend Rebuild: Next.js + shadcn/ui

The frontend is rewritten from scratch as a Next.js (App Router) project using
TypeScript and shadcn/ui components. Same JSON contract, same visual result, but as
composable, reusable React components instead of one `app.js` doing DOM manipulation.

**Setup:**
```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app
cd frontend
npx shadcn@latest init
npx shadcn@latest add button card table select input dialog
```

**`lib/api.ts`** — the fetch wrapper (equivalent of the old `runScheduler()`):
```typescript
export interface Process {
  pid: string;
  arrival_time: number;
  burst_time: number;
  priority?: number;
}

export interface SchedulePayload {
  algorithm: string;
  quantum?: number;
  processes: Process[];
}

export interface ScheduleResult {
  gantt_chart: { pid: string; start: number; end: number }[];
  process_metrics: {
    pid: string;
    completion_time: number;
    turnaround_time: number;
    waiting_time: number;
    response_time: number;
  }[];
  averages: {
    avg_waiting_time: number;
    avg_turnaround_time: number;
    avg_response_time: number;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function runScheduler(payload: SchedulePayload): Promise<ScheduleResult> {
  const res = await fetch(`${API_BASE}/api/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Scheduling request failed");
  }
  return res.json();
}
```

**`components/AlgorithmSelector.tsx`** — a reusable shadcn `Select`, showing/hiding the
quantum field conditionally:
```tsx
"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  algorithm: string;
  quantum: number;
  onAlgorithmChange: (algo: string) => void;
  onQuantumChange: (q: number) => void;
}

export function AlgorithmSelector({ algorithm, quantum, onAlgorithmChange, onQuantumChange }: Props) {
  return (
    <div className="flex items-end gap-4">
      <div>
        <Label>Algorithm</Label>
        <Select value={algorithm} onValueChange={onAlgorithmChange}>
          <SelectTrigger className="w-50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fcfs">FCFS</SelectItem>
            <SelectItem value="sjf">SJF</SelectItem>
            <SelectItem value="srtf">SRTF</SelectItem>
            <SelectItem value="round_robin">Round Robin</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {algorithm === "round_robin" && (
        <div>
          <Label>Quantum</Label>
          <Input type="number" min={1} value={quantum}
                 onChange={(e) => onQuantumChange(Number(e.target.value))} />
        </div>
      )}
    </div>
  );
}
```

**`components/GanttChart.tsx`** and **`components/MetricsTable.tsx`** should be built the
same way — each takes `ScheduleResult` fields as props and renders using shadcn's `Card`
and `Table` primitives (`Table`, `TableHeader`, `TableRow`, `TableCell`, etc.) instead of
hand-written `<div>`/`<table>` markup. Keep the Gantt chart's proportional-width bar logic
identical to the vanilla-JS version — only the markup changes from raw DOM calls to JSX.

**`app/page.tsx`** ties it together: holds process list + algorithm state, calls
`runScheduler()` on submit, and passes the result down into `<GanttChart>` and
`<MetricsTable>`.

Because the frontend and backend are now separate origins, set
`NEXT_PUBLIC_API_URL` in a `.env.local` file during development (`http://localhost:8080`)
and to the deployed Crow URL in production.

---

## Local Dev Workflow

Two processes now run side by side — the Crow backend and the Next.js dev server.

**Terminal 1 — backend:**
```bash
cd backend
mkdir build && cd build
cmake ..
cmake --build .
./server          # Windows: .\Debug\server.exe or .\server.exe depending on generator
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` (Next.js) — it calls the Crow API at `http://localhost:8080`
via `NEXT_PUBLIC_API_URL`.

---

## Deployment (this is the part WASM didn't need)

Now two things need hosting, and they're deployed independently:

- **Frontend (Next.js):** deploy to **Vercel** — it's built for Next.js specifically,
  free tier is generous, and it's a `git push` away once connected to your repo. Set
  `NEXT_PUBLIC_API_URL` as an environment variable in Vercel's dashboard pointing at
  your deployed backend URL.
- **Backend (Crow):** deploy to **Render / Railway / Fly.io** (all support "deploy from
  Dockerfile," free/cheap tiers) or a small VM (AWS/Oracle free tier) for more control.
  Whichever origin Vercel gives your frontend, add it to the backend's
  `Access-Control-Allow-Origin` header (replace the `"*"` in `main.cpp` with the real
  Vercel URL before shipping).

**`backend/Dockerfile`:**
```dockerfile
FROM gcc:13 AS build
WORKDIR /app
COPY . .
RUN apt-get update && apt-get install -y cmake && \
    mkdir build && cd build && cmake .. && cmake --build . --config Release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=build /app/build/server ./server
EXPOSE 8080
CMD ["./server"]
```
Push this to Render/Railway/Fly.io and point it at your `backend/` folder — it builds the
image and gives you a public URL. Use that URL as `NEXT_PUBLIC_API_URL` on the Vercel side.

---

## Migration Checklist (from your existing WASM repo)

| WASM version | REST API version |
|---|---|
| `algorithms/fcfs/fcfs.cpp` with `extern "C"` + `EMSCRIPTEN_KEEPALIVE` | `src/fcfs.cpp` — same logic, plain function `json run_fcfs(const json&)` |
| `algorithms/fcfs/fcfs_fallback.js` (JS fallback) | No longer needed — server always runs the real C++ |
| `build.sh` / `build.ps1` (Emscripten compile loop) | Replaced by normal `cmake --build` |
| Per-algorithm `EXPORT_NAME` (`FCFSModule`, etc.) | Replaced by the `scheduler_registry()` map in `SchedulerDispatch.hpp` |
| `app.js` dynamically loading `.js` glue files | `lib/api.ts` makes one `fetch('/api/schedule')` call |
| Docker used only to run Emscripten at build time | Docker now runs the actual C++ server at all times (or via Render/Railway) |
| `third_party/nlohmann/json.hpp` | Keep as-is, reused directly |
| `index.html` / `style.css` / hand-rolled DOM manipulation | Next.js app under `frontend/`, TypeScript + Tailwind + shadcn/ui components |
| Gantt chart built with raw `<div>`/canvas + manual sizing math | `components/GanttChart.tsx` — same sizing math, JSX markup, shadcn `Card` wrapper |
| Metrics table built with raw `<table>` | `components/MetricsTable.tsx` using shadcn `Table` primitives |
| Crow serving frontend files (same-origin) | Crow now only serves `/api/schedule`; CORS enabled for the separate Next.js origin |

---

## Instructions to the AI Model

1. Set up the CMake project with Crow via `FetchContent`, confirm a "hello world" route
   builds and runs before touching scheduling logic.
2. Port `fcfs.cpp` first: strip the Emscripten wrapper, expose `run_fcfs(const json&)`,
   wire it into `SchedulerDispatch.hpp`, and confirm `POST /api/schedule` with
   `{"algorithm":"fcfs", ...}` returns correct output — this is the vertical slice.
3. Port `sjf.cpp`, `srtf.cpp`, `round_robin.cpp`, `priority.cpp` the same way, one at a time,
   each checked against the same hand-verified example.
4. Scaffold the Next.js app under `frontend/` with `create-next-app` and `shadcn init`,
   then add the needed shadcn components (button, card, table, select, input, dialog).
5. Build `lib/api.ts` first and confirm it can successfully call the Crow backend's
   `/api/schedule` route (enable CORS on the backend, or set up the Next.js rewrite
   proxy — pick one and be consistent).
6. Build `AlgorithmSelector.tsx` and `ProcessInputTable.tsx` next, wiring them into
   `app/page.tsx` with local component state.
7. Build `GanttChart.tsx` and `MetricsTable.tsx` last, porting the proportional-width
   bar-sizing logic from the old vanilla-JS version into JSX — verify against the same
   hand-calculated example used for the backend.
8. Write a `backend/Dockerfile` and confirm the container builds and serves correctly
   locally (`docker build -t cpu-scheduler-backend . && docker run -p 8080:8080 cpu-scheduler-backend`)
   before deploying to Render/Railway/Fly.io.
9. Deploy the Next.js app to Vercel, set `NEXT_PUBLIC_API_URL` to the deployed backend's
   URL, and replace the `"*"` CORS origin in `main.cpp` with the real Vercel domain.
10. Update the README: remove Emscripten install instructions, document the two-service
    local dev workflow (Crow + Next.js dev server) and the split deployment (Vercel +
    Render/Railway/Fly.io).