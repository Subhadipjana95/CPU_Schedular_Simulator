#include "SchedulerDispatch.hpp"
#include <algorithm>
#include <vector>
#include <string>
#include <climits>

// Non-preemptive Priority Scheduling (lower priority value = higher priority)
json run_priority(const json& input) {
    struct Proc {
        std::string pid;
        int arrival, burst, priority;
        bool done = false;
    };

    std::vector<Proc> procs;
    for (const auto& p : input.at("processes")) {
        Proc pr;
        pr.pid      = p.at("pid").get<std::string>();
        pr.arrival  = p.at("arrival_time").get<int>();
        pr.burst    = p.at("burst_time").get<int>();
        pr.priority = p.value("priority", 0);
        procs.push_back(pr);
    }

    int n = static_cast<int>(procs.size());
    json gantt_chart     = json::array();
    json process_metrics = json::array();

    int current_time = 0;
    int completed    = 0;
    double total_wt = 0, total_tat = 0, total_rt = 0;

    struct Result {
        std::string pid;
        int ct, tat, wt, rt;
    };
    std::vector<Result> results;

    while (completed < n) {
        // Find available process with highest priority (lowest number)
        int idx = -1;
        int best_priority = INT_MAX;
        for (int i = 0; i < n; ++i) {
            if (!procs[i].done && procs[i].arrival <= current_time) {
                if (procs[i].priority < best_priority ||
                   (procs[i].priority == best_priority && idx != -1 && procs[i].arrival < procs[idx].arrival)) {
                    best_priority = procs[i].priority;
                    idx = i;
                }
            }
        }

        if (idx == -1) {
            // Idle — advance to next arrival
            int next_arrival = INT_MAX;
            for (int i = 0; i < n; ++i) {
                if (!procs[i].done)
                    next_arrival = std::min(next_arrival, procs[i].arrival);
            }
            current_time = next_arrival;
            continue;
        }

        int start_time      = current_time;
        int completion_time = start_time + procs[idx].burst;
        int turnaround_time = completion_time - procs[idx].arrival;
        int waiting_time    = turnaround_time - procs[idx].burst;
        int response_time   = start_time - procs[idx].arrival;

        gantt_chart.push_back({
            {"pid",   procs[idx].pid},
            {"start", start_time},
            {"end",   completion_time}
        });

        results.push_back({procs[idx].pid, completion_time, turnaround_time, waiting_time, response_time});
        total_wt  += waiting_time;
        total_tat += turnaround_time;
        total_rt  += response_time;

        procs[idx].done = true;
        current_time = completion_time;
        ++completed;
    }

    for (const auto& r : results) {
        process_metrics.push_back({
            {"pid",             r.pid},
            {"completion_time", r.ct},
            {"turnaround_time", r.tat},
            {"waiting_time",    r.wt},
            {"response_time",   r.rt}
        });
    }

    json output;
    output["gantt_chart"]     = gantt_chart;
    output["process_metrics"] = process_metrics;
    output["averages"] = {
        {"avg_waiting_time",    n > 0 ? total_wt  / n : 0.0},
        {"avg_turnaround_time", n > 0 ? total_tat / n : 0.0},
        {"avg_response_time",   n > 0 ? total_rt  / n : 0.0}
    };
    return output;
}
