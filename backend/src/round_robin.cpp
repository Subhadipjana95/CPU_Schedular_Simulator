#include "SchedulerDispatch.hpp"
#include <algorithm>
#include <vector>
#include <string>
#include <queue>

// Round Robin scheduling with time quantum
json run_round_robin(const json& input) {
    int quantum = input.value("quantum", 1);

    struct Proc {
        std::string pid;
        int arrival, burst, priority;
        int remaining;
        int first_run    = -1;
        int completion_time = 0;
    };

    std::vector<Proc> procs;
    for (const auto& p : input.at("processes")) {
        Proc pr;
        pr.pid       = p.at("pid").get<std::string>();
        pr.arrival   = p.at("arrival_time").get<int>();
        pr.burst     = p.at("burst_time").get<int>();
        pr.priority  = p.value("priority", 0);
        pr.remaining = pr.burst;
        procs.push_back(pr);
    }

    int n = static_cast<int>(procs.size());
    if (n == 0) {
        json out;
        out["gantt_chart"] = json::array();
        out["process_metrics"] = json::array();
        out["averages"] = {{"avg_waiting_time",0},{"avg_turnaround_time",0},{"avg_response_time",0}};
        return out;
    }

    // Sort by arrival time to determine enqueue order
    // We'll use indices into the original procs array
    std::vector<int> arrival_order(n);
    for (int i = 0; i < n; ++i) arrival_order[i] = i;
    std::stable_sort(arrival_order.begin(), arrival_order.end(), [&](int a, int b) {
        return procs[a].arrival < procs[b].arrival;
    });

    json gantt_chart = json::array();

    std::queue<int> ready;   // indices into procs
    int current_time = procs[arrival_order[0]].arrival;
    int enqueued     = 0;
    int completed    = 0;

    // Enqueue all processes that have already arrived at start time
    while (enqueued < n && procs[arrival_order[enqueued]].arrival <= current_time) {
        ready.push(arrival_order[enqueued++]);
    }

    while (completed < n) {
        if (ready.empty()) {
            // Idle — jump to next arrival
            if (enqueued < n) {
                current_time = procs[arrival_order[enqueued]].arrival;
                while (enqueued < n && procs[arrival_order[enqueued]].arrival <= current_time) {
                    ready.push(arrival_order[enqueued++]);
                }
            }
            continue;
        }

        int idx = ready.front();
        ready.pop();

        // First time this process runs
        if (procs[idx].first_run == -1) {
            procs[idx].first_run = current_time;
        }

        int run_time = std::min(quantum, procs[idx].remaining);
        int start    = current_time;
        int end      = current_time + run_time;

        gantt_chart.push_back({
            {"pid",   procs[idx].pid},
            {"start", start},
            {"end",   end}
        });

        procs[idx].remaining -= run_time;
        current_time = end;

        // Enqueue newly arrived processes (arrived during this slice, before re-queueing current)
        while (enqueued < n && procs[arrival_order[enqueued]].arrival <= current_time) {
            ready.push(arrival_order[enqueued++]);
        }

        if (procs[idx].remaining == 0) {
            procs[idx].completion_time = current_time;
            ++completed;
        } else {
            // Re-enqueue at back
            ready.push(idx);
        }
    }

    json process_metrics = json::array();
    double total_wt = 0, total_tat = 0, total_rt = 0;

    for (const auto& p : procs) {
        int tat = p.completion_time - p.arrival;
        int wt  = tat - p.burst;
        int rt  = p.first_run - p.arrival;
        total_tat += tat;
        total_wt  += wt;
        total_rt  += rt;
        process_metrics.push_back({
            {"pid",             p.pid},
            {"completion_time", p.completion_time},
            {"turnaround_time", tat},
            {"waiting_time",    wt},
            {"response_time",   rt}
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
