#include "SchedulerDispatch.hpp"
#include <algorithm>
#include <vector>
#include <string>

// First Come First Served (non-preemptive)
json run_fcfs(const json& input) {
    struct Proc {
        std::string pid;
        int arrival, burst, priority;
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

    // Sort by arrival time (ties broken by original order / pid)
    std::stable_sort(procs.begin(), procs.end(), [](const Proc& a, const Proc& b) {
        return a.arrival < b.arrival;
    });

    json gantt_chart = json::array();
    json process_metrics = json::array();

    int current_time = 0;
    double total_wt = 0, total_tat = 0, total_rt = 0;

    for (const auto& p : procs) {
        // CPU is idle until this process arrives
        if (current_time < p.arrival) {
            current_time = p.arrival;
        }

        int start_time      = current_time;
        int completion_time = start_time + p.burst;
        int turnaround_time = completion_time - p.arrival;
        int waiting_time    = turnaround_time - p.burst;
        int response_time   = start_time - p.arrival;

        gantt_chart.push_back({
            {"pid",   p.pid},
            {"start", start_time},
            {"end",   completion_time}
        });

        process_metrics.push_back({
            {"pid",             p.pid},
            {"completion_time", completion_time},
            {"turnaround_time", turnaround_time},
            {"waiting_time",    waiting_time},
            {"response_time",   response_time}
        });

        total_wt  += waiting_time;
        total_tat += turnaround_time;
        total_rt  += response_time;
        current_time = completion_time;
    }

    int n = static_cast<int>(procs.size());
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
