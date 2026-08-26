// algorithms/sjf/sjf.cpp
// Shortest Job First (Non-Preemptive) Scheduling
// Compile: emcc sjf.cpp -o sjf.js -s MODULARIZE=1 -s EXPORT_NAME="SJFModule"
//          -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' -I ../../third_party -O2

#include <emscripten/emscripten.h>
#include <nlohmann/json.hpp>
#include <algorithm>
#include <climits>
#include <string>
#include <vector>

using json = nlohmann::json;

extern "C" {

EMSCRIPTEN_KEEPALIVE
const char* run_schedule(const char* input_json) {
    json input = json::parse(input_json);

    struct Process {
        std::string pid;
        int arrival_time;
        int burst_time;
        int priority;
        bool done;
    };

    std::vector<Process> procs;
    for (auto& p : input["processes"]) {
        procs.push_back({
            p["pid"].get<std::string>(),
            p["arrival_time"].get<int>(),
            p["burst_time"].get<int>(),
            p.count("priority") ? p["priority"].get<int>() : 0,
            false
        });
    }

    int n = (int)procs.size();
    int current_time = 0;
    int completed = 0;

    json gantt_chart = json::array();
    json process_metrics_list = json::array();

    struct Metric {
        std::string pid;
        int arrival_time, burst_time, completion_time;
        int turnaround_time, waiting_time, response_time;
    };
    std::vector<Metric> metrics(n);

    double total_waiting = 0, total_turnaround = 0, total_response = 0;

    while (completed < n) {
        // Find the shortest burst among arrived, not-done processes
        int idx = -1;
        int min_burst = INT_MAX;

        for (int i = 0; i < n; i++) {
            if (!procs[i].done && procs[i].arrival_time <= current_time) {
                if (procs[i].burst_time < min_burst) {
                    min_burst = procs[i].burst_time;
                    idx = i;
                } else if (procs[i].burst_time == min_burst && idx != -1 &&
                           procs[i].arrival_time < procs[idx].arrival_time) {
                    // Tie-break: earlier arrival
                    idx = i;
                }
            }
        }

        if (idx == -1) {
            // CPU idle — advance time to next arrival
            int next_arrival = INT_MAX;
            for (int i = 0; i < n; i++) {
                if (!procs[i].done && procs[i].arrival_time < next_arrival)
                    next_arrival = procs[i].arrival_time;
            }
            current_time = next_arrival;
            continue;
        }

        auto& p = procs[idx];
        int start_time      = current_time;
        int completion_time = current_time + p.burst_time;
        int turnaround_time = completion_time - p.arrival_time;
        int waiting_time    = turnaround_time - p.burst_time;
        int response_time   = start_time - p.arrival_time;

        gantt_chart.push_back({
            {"pid", p.pid},
            {"start", start_time},
            {"end", completion_time}
        });

        process_metrics_list.push_back({
            {"pid", p.pid},
            {"arrival_time", p.arrival_time},
            {"burst_time", p.burst_time},
            {"completion_time", completion_time},
            {"turnaround_time", turnaround_time},
            {"waiting_time", waiting_time},
            {"response_time", response_time}
        });

        total_waiting    += waiting_time;
        total_turnaround += turnaround_time;
        total_response   += response_time;

        current_time = completion_time;
        p.done = true;
        completed++;
    }

    json output = {
        {"gantt_chart", gantt_chart},
        {"process_metrics", process_metrics_list},
        {"averages", {
            {"avg_waiting_time",    n > 0 ? total_waiting    / n : 0.0},
            {"avg_turnaround_time", n > 0 ? total_turnaround / n : 0.0},
            {"avg_response_time",   n > 0 ? total_response   / n : 0.0}
        }}
    };

    static std::string result;
    result = output.dump();
    return result.c_str();
}

} // extern "C"
