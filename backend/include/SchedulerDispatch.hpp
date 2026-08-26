#pragma once
#include <nlohmann/json.hpp>
#include <functional>
#include <unordered_map>
#include <string>

using json = nlohmann::json;
using SchedulerFn = std::function<json(const json&)>;

// Forward declarations — implemented in src/*.cpp
json run_fcfs(const json& input);
json run_sjf(const json& input);
json run_srtf(const json& input);
json run_round_robin(const json& input);
json run_priority(const json& input);

// Registry maps algorithm name -> function
inline const std::unordered_map<std::string, SchedulerFn>& scheduler_registry() {
    static const std::unordered_map<std::string, SchedulerFn> registry = {
        {"fcfs",        run_fcfs},
        {"sjf",         run_sjf},
        {"srtf",        run_srtf},
        {"round_robin", run_round_robin},
        {"priority",    run_priority},
    };
    return registry;
}
