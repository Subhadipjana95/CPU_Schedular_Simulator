#pragma once
#include <string>
#include <vector>

struct GanttSegment {
    std::string pid;
    int start;
    int end;
};

struct ProcessMetric {
    std::string pid;
    int completion_time;
    int turnaround_time;
    int waiting_time;
    int response_time;
};

struct SchedulerResult {
    std::vector<GanttSegment> gantt_chart;
    std::vector<ProcessMetric> process_metrics;
    double avg_waiting_time;
    double avg_turnaround_time;
    double avg_response_time;
};
