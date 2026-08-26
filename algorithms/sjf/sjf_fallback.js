// algorithms/sjf/sjf_fallback.js
// Pure JavaScript fallback for SJF Non-Preemptive (used when WASM is not available)

window.SJF_fallback = function(inputJson) {
    const input = JSON.parse(inputJson);
    const procs = input.processes.map((p, idx) => ({ ...p, done: false, _idx: idx }));

    const n = procs.length;
    let currentTime = 0, completed = 0;
    const ganttChart = [], processMetrics = [];
    let totalWaiting = 0, totalTurnaround = 0, totalResponse = 0;

    while (completed < n) {
        // Pick shortest burst among arrived, not-done processes
        let idx = -1, minBurst = Infinity;

        for (let i = 0; i < n; i++) {
            if (!procs[i].done && procs[i].arrival_time <= currentTime) {
                if (procs[i].burst_time < minBurst ||
                   (procs[i].burst_time === minBurst && idx !== -1 &&
                    procs[i].arrival_time < procs[idx].arrival_time)) {
                    minBurst = procs[i].burst_time;
                    idx = i;
                }
            }
        }

        if (idx === -1) {
            // Idle — jump to next arrival
            let nextArrival = Infinity;
            for (const p of procs) if (!p.done) nextArrival = Math.min(nextArrival, p.arrival_time);
            currentTime = nextArrival;
            continue;
        }

        const p = procs[idx];
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

        currentTime = completionTime;
        p.done = true;
        completed++;
    }

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
