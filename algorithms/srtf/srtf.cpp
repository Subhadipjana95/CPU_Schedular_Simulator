// algorithms/srtf/srtf.cpp
// Shortest Remaining Time First (Preemptive SJF) Scheduling
// Compile: emcc srtf.cpp -o srtf.js -s MODULARIZE=1 -s EXPORT_NAME="SRTFModule"
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
        int remaining;
        int priority;
        bool started;
        int start_time;       // first time it got CPU
        int completion_time;
    };

    std::vector<Process> procs;
    for (auto& p : input["processes"]) {
        int bt = p["burst_time"].get<int>();
        procs.push_back({
            p["pid"].get<std::string>(),
            p["arrival_time"].get<int>(),
            bt,
            bt,
            p.count("priority") ? p["priority"].get<int>() : 0,
            false, -1, -1
        });
    }

    int n = (int)procs.size();
    if (n == 0) {
        json empty = {{"gantt_chart", json::array()}, {"process_metrics", json::array()},
                      {"averages", {{"avg_waiting_time",0},{"avg_turnaround_time",0},{"avg_response_time",0}}}};
        static std::string res;
        res = empty.dump();
        return res.c_str();
    }

    // Find simulation bounds
    int total_burst = 0, min_arrival = INT_MAX;
    for (auto& p : procs) {
        total_burst += p.burst_time;
        min_arrival = std::min(min_arrival, p.arrival_time);
    }

    json gantt_chart = json::array();
    int current_time = min_arrival;
    int completed = 0;
    std::string last_pid = "";
    int segment_start = current_time;

    while (completed < n) {
        int idx = -1;
        int min_remaining = INT_MAX;

        for (int i = 0; i < n; i++) {
            if (procs[i].remaining <= 0) continue;
            if (procs[i].arrival_time > current_time) continue;

            if (procs[i].remaining < min_remaining) {
                min_remaining = procs[i].remaining;
                idx = i;
            } else if (procs[i].remaining == min_remaining && idx != -1 &&
                       procs[i].arrival_time < procs[idx].arrival_time) {
                idx = i;
            }
        }

        if (idx == -1) {
            // Idle
            if (!last_pid.empty()) {
                gantt_chart.push_back({{"pid", last_pid}, {"start", segment_start}, {"end", current_time}});
                last_pid = "";
            }
            // Jump to next arrival
            int next_arrival = INT_MAX;
            for (auto& p : procs)
                if (p.remaining > 0) next_arrival = std::min(next_arrival, p.arrival_time);
            current_time = next_arrival;
            segment_start = current_time;
            continue;
        }

        auto& chosen = procs[idx];

        if (!chosen.started) {
            chosen.started = true;
            chosen.start_time = current_time;
        }

        // If the running pid changes, record the previous segment
        if (chosen.pid != last_pid) {
            if (!last_pid.empty()) {
                gantt_chart.push_back({{"pid", last_pid}, {"start", segment_start}, {"end", current_time}});
            }
            segment_start = current_time;
            last_pid = chosen.pid;
        }

        // Tick one unit
        chosen.remaining--;
        current_time++;

        if (chosen.remaining == 0) {
            chosen.completion_time = current_time;
            completed++;
        }
    }

    // Close last segment
    if (!last_pid.empty()) {
        gantt_chart.push_back({{"pid", last_pid}, {"start", segment_start}, {"end", current_time}});
    }

    // Build metrics
    json process_metrics = json::array();
    double total_waiting = 0, total_turnaround = 0, total_response = 0;

    for (auto& p : procs) {
        int turnaround = p.completion_time - p.arrival_time;
        int waiting    = turnaround - p.burst_time;
        int response   = p.start_time - p.arrival_time;

        process_metrics.push_back({
            {"pid", p.pid},
            {"arrival_time", p.arrival_time},
            {"burst_time", p.burst_time},
            {"completion_time", p.completion_time},
            {"turnaround_time", turnaround},
            {"waiting_time", waiting},
            {"response_time", response}
        });

        total_waiting    += waiting;
        total_turnaround += turnaround;
        total_response   += response;
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
