// algorithms/fcfs/fcfs.cpp
// First Come First Serve (Non-Preemptive) Scheduling
// Compile: emcc fcfs.cpp -o fcfs.js -s MODULARIZE=1 -s EXPORT_NAME="FCFSModule"
//          -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' -I ../../third_party -O2

#include <emscripten/emscripten.h>
#include <nlohmann/json.hpp>
#include <algorithm>
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
        int remaining;
    };

    std::vector<Process> procs;
    for (auto& p : input["processes"]) {
        procs.push_back({
            p["pid"].get<std::string>(),
            p["arrival_time"].get<int>(),
            p["burst_time"].get<int>(),
            p.count("priority") ? p["priority"].get<int>() : 0,
            p["burst_time"].get<int>()
        });
    }

    // Sort by arrival time; tie-break by original order (stable)
    std::stable_sort(procs.begin(), procs.end(), [](const Process& a, const Process& b) {
        return a.arrival_time < b.arrival_time;
    });

    int current_time = 0;
    json gantt_chart = json::array();
    json process_metrics = json::array();

    double total_waiting = 0, total_turnaround = 0, total_response = 0;

    for (auto& p : procs) {
        // If CPU is idle, jump to this process's arrival
        if (current_time < p.arrival_time) {
            current_time = p.arrival_time;
        }

        int start_time = current_time;
        int completion_time = current_time + p.burst_time;
        int turnaround_time = completion_time - p.arrival_time;
        int waiting_time = turnaround_time - p.burst_time;
        int response_time = start_time - p.arrival_time;

        gantt_chart.push_back({
            {"pid", p.pid},
            {"start", start_time},
            {"end", completion_time}
        });

        process_metrics.push_back({
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
    }

    int n = (int)procs.size();
    json output = {
        {"gantt_chart", gantt_chart},
        {"process_metrics", process_metrics},
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
