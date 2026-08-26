// algorithms/round_robin/round_robin.cpp
// Round Robin Scheduling
// Compile: emcc round_robin.cpp -o round_robin.js -s MODULARIZE=1 -s EXPORT_NAME="RoundRobinModule"
//          -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' -I ../../third_party -O2

#include <emscripten/emscripten.h>
#include <nlohmann/json.hpp>
#include <algorithm>
#include <deque>
#include <string>
#include <vector>

using json = nlohmann::json;

extern "C" {

EMSCRIPTEN_KEEPALIVE
const char* run_schedule(const char* input_json) {
    json input = json::parse(input_json);

    int quantum = input.count("quantum") ? input["quantum"].get<int>() : 2;
    if (quantum <= 0) quantum = 2;

    struct Process {
        std::string pid;
        int arrival_time;
        int burst_time;
        int remaining;
        int priority;
        int response_time;   // first time on CPU - arrival
        int completion_time;
        bool responded;
        bool in_queue;
    };

    std::vector<Process> procs;
    for (auto& p : input["processes"]) {
        int bt = p["burst_time"].get<int>();
        procs.push_back({
            p["pid"].get<std::string>(),
            p["arrival_time"].get<int>(),
            bt, bt,
            p.count("priority") ? p["priority"].get<int>() : 0,
            -1, -1, false, false
        });
    }

    int n = (int)procs.size();
    if (n == 0) {
        json empty = {{"gantt_chart", json::array()}, {"process_metrics", json::array()},
                      {"averages", {{"avg_waiting_time",0},{"avg_turnaround_time",0},{"avg_response_time",0}}}};
        static std::string res; res = empty.dump(); return res.c_str();
    }

    // Sort by arrival time for initial ordering
    // We keep original indices
    std::vector<int> order(n);
    for (int i = 0; i < n; i++) order[i] = i;
    std::stable_sort(order.begin(), order.end(), [&](int a, int b) {
        return procs[a].arrival_time < procs[b].arrival_time;
    });

    json gantt_chart = json::array();
    int current_time = procs[order[0]].arrival_time;
    int completed = 0;

    // Ready queue holds indices
    std::deque<int> ready_queue;

    // Enqueue all processes that arrive at start
    for (int i : order) {
        if (procs[i].arrival_time <= current_time) {
            ready_queue.push_back(i);
            procs[i].in_queue = true;
        }
    }

    while (completed < n) {
        if (ready_queue.empty()) {
            // Idle — find next arrival
            int next_arrival = -1;
            for (int i : order) {
                if (procs[i].remaining > 0 && !procs[i].in_queue) {
                    if (next_arrival == -1 || procs[i].arrival_time < next_arrival)
                        next_arrival = procs[i].arrival_time;
                }
            }
            if (next_arrival == -1) break;
            current_time = next_arrival;
            // Enqueue newly arrived
            for (int i : order) {
                if (procs[i].remaining > 0 && !procs[i].in_queue && procs[i].arrival_time <= current_time) {
                    ready_queue.push_back(i);
                    procs[i].in_queue = true;
                }
            }
            continue;
        }

        int idx = ready_queue.front();
        ready_queue.pop_front();

        auto& p = procs[idx];

        // Record response time (first execution)
        if (!p.responded) {
            p.response_time = current_time - p.arrival_time;
            p.responded = true;
        }

        int exec_time = std::min(quantum, p.remaining);
        int start = current_time;
        int end   = current_time + exec_time;

        gantt_chart.push_back({{"pid", p.pid}, {"start", start}, {"end", end}});

        p.remaining  -= exec_time;
        current_time  = end;

        // Enqueue newly arrived processes during this slice (BEFORE re-enqueuing current)
        for (int i : order) {
            if (procs[i].remaining > 0 && !procs[i].in_queue && procs[i].arrival_time <= current_time) {
                ready_queue.push_back(i);
                procs[i].in_queue = true;
            }
        }

        if (p.remaining > 0) {
            // Re-enqueue current process at the back
            ready_queue.push_back(idx);
            // (in_queue stays true)
        } else {
            p.completion_time = current_time;
            completed++;
        }
    }

    // Build metrics
    json process_metrics = json::array();
    double total_waiting = 0, total_turnaround = 0, total_response = 0;

    for (auto& p : procs) {
        int turnaround = p.completion_time - p.arrival_time;
        int waiting    = turnaround - p.burst_time;

        process_metrics.push_back({
            {"pid", p.pid},
            {"arrival_time", p.arrival_time},
            {"burst_time", p.burst_time},
            {"completion_time", p.completion_time},
            {"turnaround_time", turnaround},
            {"waiting_time", waiting},
            {"response_time", p.response_time}
        });

        total_waiting    += waiting;
        total_turnaround += turnaround;
        total_response   += p.response_time;
    }

    json output = {
        {"gantt_chart", gantt_chart},
        {"process_metrics", process_metrics},
        {"averages", {
            {"avg_waiting_time",    total_waiting    / n},
            {"avg_turnaround_time", total_turnaround / n},
            {"avg_response_time",   total_response   / n}
        }}
    };

    static std::string result;
    result = output.dump();
    return result.c_str();
}

} // extern "C"
