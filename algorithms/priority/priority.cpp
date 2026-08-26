// algorithms/priority/priority.cpp
// Priority Scheduling (Non-Preemptive and Preemptive)
// Lower priority number = higher priority
// Compile: emcc priority.cpp -o priority.js -s MODULARIZE=1 -s EXPORT_NAME="PriorityModule"
//          -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' -I ../../third_party -O2

#include <emscripten/emscripten.h>
#include <nlohmann/json.hpp>
#include <algorithm>
#include <climits>
#include <string>
#include <vector>

using json = nlohmann::json;

// ── Non-preemptive priority ─────────────────────────────
static json run_non_preemptive(std::vector<json>& procs_raw) {
    struct Process {
        std::string pid;
        int arrival_time, burst_time, priority;
        bool done;
    };

    std::vector<Process> procs;
    for (auto& p : procs_raw) {
        procs.push_back({
            p["pid"].get<std::string>(),
            p["arrival_time"].get<int>(),
            p["burst_time"].get<int>(),
            p.count("priority") ? p["priority"].get<int>() : 0,
            false
        });
    }

    int n = (int)procs.size();
    int current_time = 0, completed = 0;
    json gantt = json::array(), metrics = json::array();
    double tw = 0, tt = 0, tr = 0;

    while (completed < n) {
        int idx = -1, best_priority = INT_MAX;

        for (int i = 0; i < n; i++) {
            if (!procs[i].done && procs[i].arrival_time <= current_time) {
                if (procs[i].priority < best_priority) {
                    best_priority = procs[i].priority;
                    idx = i;
                } else if (procs[i].priority == best_priority && idx != -1 &&
                           procs[i].arrival_time < procs[idx].arrival_time) {
                    idx = i;
                }
            }
        }

        if (idx == -1) {
            int next = INT_MAX;
            for (auto& p : procs) if (!p.done) next = std::min(next, p.arrival_time);
            current_time = next;
            continue;
        }

        auto& p = procs[idx];
        int start_time      = current_time;
        int completion_time = current_time + p.burst_time;
        int turnaround      = completion_time - p.arrival_time;
        int waiting         = turnaround - p.burst_time;
        int response        = start_time - p.arrival_time;

        gantt.push_back({{"pid", p.pid}, {"start", start_time}, {"end", completion_time}});
        metrics.push_back({
            {"pid", p.pid}, {"arrival_time", p.arrival_time}, {"burst_time", p.burst_time},
            {"priority", p.priority},
            {"completion_time", completion_time}, {"turnaround_time", turnaround},
            {"waiting_time", waiting}, {"response_time", response}
        });

        tw += waiting; tt += turnaround; tr += response;
        current_time = completion_time;
        p.done = true;
        completed++;
    }

    return {
        {"gantt_chart", gantt}, {"process_metrics", metrics},
        {"averages", {{"avg_waiting_time", tw/n}, {"avg_turnaround_time", tt/n}, {"avg_response_time", tr/n}}}
    };
}

// ── Preemptive priority (tick-by-tick) ──────────────────
static json run_preemptive(std::vector<json>& procs_raw) {
    struct Process {
        std::string pid;
        int arrival_time, burst_time, priority;
        int remaining;
        bool started;
        int start_time, completion_time;
    };

    std::vector<Process> procs;
    for (auto& p : procs_raw) {
        int bt = p["burst_time"].get<int>();
        procs.push_back({
            p["pid"].get<std::string>(),
            p["arrival_time"].get<int>(), bt,
            p.count("priority") ? p["priority"].get<int>() : 0,
            bt, false, -1, -1
        });
    }

    int n = (int)procs.size();
    int min_arrival = INT_MAX;
    for (auto& p : procs) min_arrival = std::min(min_arrival, p.arrival_time);

    int current_time = min_arrival, completed = 0;
    std::string last_pid;
    int segment_start = current_time;
    json gantt = json::array();

    while (completed < n) {
        int idx = -1, best_priority = INT_MAX;

        for (int i = 0; i < n; i++) {
            if (procs[i].remaining <= 0) continue;
            if (procs[i].arrival_time > current_time) continue;
            if (procs[i].priority < best_priority) {
                best_priority = procs[i].priority;
                idx = i;
            } else if (procs[i].priority == best_priority && idx != -1 &&
                       procs[i].arrival_time < procs[idx].arrival_time) {
                idx = i;
            }
        }

        if (idx == -1) {
            if (!last_pid.empty()) {
                gantt.push_back({{"pid", last_pid}, {"start", segment_start}, {"end", current_time}});
                last_pid = "";
            }
            int next = INT_MAX;
            for (auto& p : procs) if (p.remaining > 0) next = std::min(next, p.arrival_time);
            current_time = next;
            segment_start = current_time;
            continue;
        }

        auto& chosen = procs[idx];
        if (!chosen.started) { chosen.started = true; chosen.start_time = current_time; }

        if (chosen.pid != last_pid) {
            if (!last_pid.empty())
                gantt.push_back({{"pid", last_pid}, {"start", segment_start}, {"end", current_time}});
            segment_start = current_time;
            last_pid = chosen.pid;
        }

        chosen.remaining--;
        current_time++;

        if (chosen.remaining == 0) {
            chosen.completion_time = current_time;
            completed++;
        }
    }

    if (!last_pid.empty())
        gantt.push_back({{"pid", last_pid}, {"start", segment_start}, {"end", current_time}});

    json metrics = json::array();
    double tw = 0, tt = 0, tr = 0;
    for (auto& p : procs) {
        int turnaround = p.completion_time - p.arrival_time;
        int waiting    = turnaround - p.burst_time;
        int response   = p.start_time - p.arrival_time;

        metrics.push_back({
            {"pid", p.pid}, {"arrival_time", p.arrival_time}, {"burst_time", p.burst_time},
            {"priority", p.priority},
            {"completion_time", p.completion_time}, {"turnaround_time", turnaround},
            {"waiting_time", waiting}, {"response_time", response}
        });
        tw += waiting; tt += turnaround; tr += response;
    }

    return {
        {"gantt_chart", gantt}, {"process_metrics", metrics},
        {"averages", {{"avg_waiting_time", tw/n}, {"avg_turnaround_time", tt/n}, {"avg_response_time", tr/n}}}
    };
}

// ── WASM Export ─────────────────────────────────────────
extern "C" {

EMSCRIPTEN_KEEPALIVE
const char* run_schedule(const char* input_json) {
    json input = json::parse(input_json);

    bool preemptive = false;
    if (input.count("preemptive")) preemptive = input["preemptive"].get<bool>();

    std::vector<json> procs_raw;
    for (auto& p : input["processes"]) procs_raw.push_back(p);

    json output = preemptive ? run_preemptive(procs_raw) : run_non_preemptive(procs_raw);

    static std::string result;
    result = output.dump();
    return result.c_str();
}

} // extern "C"
