#pragma once
#include <string>

struct Process {
    std::string pid;
    int arrival_time;
    int burst_time;
    int priority;      // lower value = higher priority (used by priority scheduler)
    int remaining_time; // used by SRTF

    Process() : arrival_time(0), burst_time(0), priority(0), remaining_time(0) {}
};
