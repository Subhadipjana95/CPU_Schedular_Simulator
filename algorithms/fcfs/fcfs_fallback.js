// algorithms/fcfs/fcfs_fallback.js
// Pure JavaScript fallback for FCFS (used when WASM is not available)

window.FCFS_fallback = function(inputJson) {
    const input  = JSON.parse(inputJson);
    const procs  = [...input.processes];

    // Sort by arrival time (stable)
    procs.sort((a, b) => a.arrival_time - b.arrival_time);

    let currentTime = 0;
    const ganttChart     = [];
    const processMetrics = [];
    let totalWaiting = 0, totalTurnaround = 0, totalResponse = 0;

    for (const p of procs) {
        if (currentTime < p.arrival_time) currentTime = p.arrival_time;

        const startTime      = currentTime;
        const completionTime = currentTime + p.burst_time;
        const turnaroundTime = completionTime - p.arrival_time;
        const waitingTime    = turnaroundTime - p.burst_time;
        const responseTime   = startTime - p.arrival_time;

        ganttChart.push({ pid: p.pid, start: startTime, end: completionTime });

        processMetrics.push({
            pid: p.pid,
            arrival_time: p.arrival_time,
            burst_time: p.burst_time,
            completion_time: completionTime,
            turnaround_time: turnaroundTime,
            waiting_time: waitingTime,
            response_time: responseTime
        });

        totalWaiting    += waitingTime;
        totalTurnaround += turnaroundTime;
        totalResponse   += responseTime;
        currentTime      = completionTime;
    }

    const n = procs.length;
    return JSON.stringify({
        gantt_chart: ganttChart,
        process_metrics: processMetrics,
        averages: {
            avg_waiting_time:    n > 0 ? totalWaiting    / n : 0,
            avg_turnaround_time: n > 0 ? totalTurnaround / n : 0,
            avg_response_time:   n > 0 ? totalResponse   / n : 0
        }
    });
};
