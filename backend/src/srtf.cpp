#include "SchedulerDispatch.hpp"
#include <algorithm>
#include <vector>
#include <string>
#include <climits>
#include <unordered_map>

// Shortest Remaining Time First — Preemptive SJF
json run_srtf(const json& input) {
    struct Proc {
        std::string pid;
        int arrival, burst, priority;
        int remaining;
        bool started = false;
        bool done    = false;
        int  first_run = -1;   // for response_time
        int  completion_time = 0;
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

    // Find time range
    int max_time = 0;
    int min_arrival = INT_MAX;
    for (const auto& p : procs) {
        max_time = std::max(max_time, p.arrival + p.burst);
        min_arrival = std::min(min_arrival, p.arrival);
    }

    json gantt_chart = json::array();
    int current_time = min_arrival;
    int completed    = 0;

    std::string last_pid = "";
    int segment_start = current_time;

    while (completed < n) {
        int idx = -1;
        int min_rem = INT_MAX;
        for (int i = 0; i < n; ++i) {
            if (!procs[i].done && procs[i].arrival <= current_time) {
                if (procs[i].remaining < min_rem ||
                   (procs[i].remaining == min_rem && procs[i].arrival < procs[idx == -1 ? i : idx].arrival)) {
                    min_rem = procs[i].remaining;
                    idx = i;
                }
            }
        }

        if (idx == -1) {
            // CPU idle — advance to next arrival
            if (last_pid != "" && last_pid != "IDLE") {
                gantt_chart.push_back({{"pid", last_pid}, {"start", segment_start}, {"end", current_time}});
            }
            // Find next arrival
            int next = INT_MAX;
            for (const auto& p : procs) {
                if (!p.done && p.arrival > current_time)
                    next = std::min(next, p.arrival);
            }
            if (next == INT_MAX) break;
            last_pid = "IDLE";
            segment_start = current_time;
            current_time = next;
            continue;
        }

        // Record first run time (response time)
        if (!procs[idx].started) {
            procs[idx].started   = true;
            procs[idx].first_run = current_time;
        }

        // Check if a new process arrives that has shorter remaining time
        // Find the next event: either a process arrival or this process finishing
        int time_to_finish = procs[idx].remaining;
        int next_arrival   = INT_MAX;
        for (int i = 0; i < n; ++i) {
            if (!procs[i].done && procs[i].arrival > current_time)
                next_arrival = std::min(next_arrival, procs[i].arrival);
        }

        int run_until;
        if (next_arrival == INT_MAX) {
            run_until = current_time + time_to_finish;
        } else {
            run_until = std::min(current_time + time_to_finish, next_arrival);
        }

        // Gantt segment tracking
        if (procs[idx].pid != last_pid) {
            if (!last_pid.empty() && last_pid != "IDLE") {
                gantt_chart.push_back({{"pid", last_pid}, {"start", segment_start}, {"end", current_time}});
            } else if (last_pid == "IDLE") {
                // skip idle segments
            }
            segment_start = current_time;
            last_pid = procs[idx].pid;
        }

        int elapsed = run_until - current_time;
        procs[idx].remaining -= elapsed;
        current_time = run_until;

        if (procs[idx].remaining == 0) {
            procs[idx].done            = true;
            procs[idx].completion_time = current_time;
            ++completed;
            // close current segment
            gantt_chart.push_back({{"pid", procs[idx].pid}, {"start", segment_start}, {"end", current_time}});
            last_pid      = "";
            segment_start = current_time;
        }
    }

    // Close any open segment
    if (!last_pid.empty() && last_pid != "IDLE") {
        gantt_chart.push_back({{"pid", last_pid}, {"start", segment_start}, {"end", current_time}});
    }

    // Build metrics — order by original process list
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
