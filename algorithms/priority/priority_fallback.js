// algorithms/priority/priority_fallback.js
// Pure JavaScript fallback for Priority Scheduling (used when WASM is not available)
// Lower priority number = higher priority

window.Priority_fallback = function(inputJson) {
    const input      = JSON.parse(inputJson);
    const preemptive = !!input.preemptive;

    if (preemptive) return runPreemptive(input);
    return runNonPreemptive(input);
};

function runNonPreemptive(input) {
    const procs = input.processes.map(p => ({ ...p, done: false }));
    const n = procs.length;
    let currentTime = 0, completed = 0;
    const ganttChart = [], processMetrics = [];
    let totalWaiting = 0, totalTurnaround = 0, totalResponse = 0;

    while (completed < n) {
        let idx = -1, bestPriority = Infinity;

        for (let i = 0; i < n; i++) {
            if (!procs[i].done && procs[i].arrival_time <= currentTime) {
                const prio = procs[i].priority ?? 0;
                if (prio < bestPriority ||
                   (prio === bestPriority && idx !== -1 && procs[i].arrival_time < procs[idx].arrival_time)) {
                    bestPriority = prio;
                    idx = i;
                }
            }
        }

        if (idx === -1) {
            let next = Infinity;
            for (const p of procs) if (!p.done) next = Math.min(next, p.arrival_time);
            currentTime = next;
            continue;
        }

        const p = procs[idx];
        const startTime      = currentTime;
        const completionTime = currentTime + p.burst_time;
        const turnaround     = completionTime - p.arrival_time;
        const waiting        = turnaround - p.burst_time;
        const response       = startTime - p.arrival_time;

        ganttChart.push({ pid: p.pid, start: startTime, end: completionTime });
        processMetrics.push({
            pid: p.pid, arrival_time: p.arrival_time, burst_time: p.burst_time,
            priority: p.priority ?? 0,
            completion_time: completionTime, turnaround_time: turnaround,
            waiting_time: waiting, response_time: response
        });

        totalWaiting += waiting; totalTurnaround += turnaround; totalResponse += response;
        currentTime = completionTime;
        p.done = true;
        completed++;
    }

    return JSON.stringify({
        gantt_chart: ganttChart, process_metrics: processMetrics,
        averages: { avg_waiting_time: totalWaiting/n, avg_turnaround_time: totalTurnaround/n, avg_response_time: totalResponse/n }
    });
}

function runPreemptive(input) {
    const procs = input.processes.map(p => ({
        ...p,
        remaining: p.burst_time,
        started: false,
        startTime: -1,
        completionTime: -1
    }));

    const n = procs.length;
    if (n === 0) return JSON.stringify({ gantt_chart: [], process_metrics: [], averages: { avg_waiting_time: 0, avg_turnaround_time: 0, avg_response_time: 0 } });

    const minArrival = Math.min(...procs.map(p => p.arrival_time));
    let currentTime = minArrival, completed = 0;
    let lastPid = null, segmentStart = currentTime;
    const ganttChart = [];

    while (completed < n) {
        let idx = -1, bestPriority = Infinity;

        for (let i = 0; i < n; i++) {
            if (procs[i].remaining <= 0 || procs[i].arrival_time > currentTime) continue;
            const prio = procs[i].priority ?? 0;
            if (prio < bestPriority ||
               (prio === bestPriority && idx !== -1 && procs[i].arrival_time < procs[idx].arrival_time)) {
                bestPriority = prio;
                idx = i;
            }
        }

        if (idx === -1) {
            if (lastPid !== null) { ganttChart.push({ pid: lastPid, start: segmentStart, end: currentTime }); lastPid = null; }
            let next = Infinity;
            for (const p of procs) if (p.remaining > 0) next = Math.min(next, p.arrival_time);
            currentTime = next; segmentStart = currentTime;
            continue;
        }

        const chosen = procs[idx];
        if (!chosen.started) { chosen.started = true; chosen.startTime = currentTime; }

        if (chosen.pid !== lastPid) {
            if (lastPid !== null) ganttChart.push({ pid: lastPid, start: segmentStart, end: currentTime });
            segmentStart = currentTime; lastPid = chosen.pid;
        }

        chosen.remaining--; currentTime++;
        if (chosen.remaining === 0) { chosen.completionTime = currentTime; completed++; }
    }

    if (lastPid !== null) ganttChart.push({ pid: lastPid, start: segmentStart, end: currentTime });

    const processMetrics = [];
    let totalWaiting = 0, totalTurnaround = 0, totalResponse = 0;

    for (const p of procs) {
        const turnaround = p.completionTime - p.arrival_time;
        const waiting    = turnaround - p.burst_time;
        const response   = p.startTime - p.arrival_time;

        processMetrics.push({
            pid: p.pid, arrival_time: p.arrival_time, burst_time: p.burst_time,
            priority: p.priority ?? 0,
            completion_time: p.completionTime, turnaround_time: turnaround,
            waiting_time: waiting, response_time: response
        });
        totalWaiting += waiting; totalTurnaround += turnaround; totalResponse += response;
    }

    return JSON.stringify({
        gantt_chart: ganttChart, process_metrics: processMetrics,
        averages: { avg_waiting_time: totalWaiting/n, avg_turnaround_time: totalTurnaround/n, avg_response_time: totalResponse/n }
    });
}
