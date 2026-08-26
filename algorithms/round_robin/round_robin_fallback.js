// algorithms/round_robin/round_robin_fallback.js
// Pure JavaScript fallback for Round Robin (used when WASM is not available)

window.RoundRobin_fallback = function(inputJson) {
    const input   = JSON.parse(inputJson);
    const quantum = (input.quantum && input.quantum > 0) ? input.quantum : 2;

    const procs = input.processes.map(p => ({
        ...p,
        remaining:    p.burst_time,
        responded:    false,
        responseTime: -1,
        completionTime: -1,
        inQueue:      false
    }));

    const n = procs.length;
    if (n === 0) return JSON.stringify({ gantt_chart: [], process_metrics: [], averages: { avg_waiting_time: 0, avg_turnaround_time: 0, avg_response_time: 0 } });

    // Sort by arrival to establish initial order
    const order = [...Array(n).keys()].sort((a, b) => procs[a].arrival_time - procs[b].arrival_time);
    let currentTime = procs[order[0]].arrival_time;
    let completed = 0;
    const ganttChart = [];
    const queue = []; // indices

    // Enqueue processes arrived at start
    for (const i of order) {
        if (procs[i].arrival_time <= currentTime) {
            queue.push(i);
            procs[i].inQueue = true;
        }
    }

    while (completed < n) {
        if (queue.length === 0) {
            let next = Infinity;
            for (const i of order)
                if (procs[i].remaining > 0 && !procs[i].inQueue) next = Math.min(next, procs[i].arrival_time);
            if (!isFinite(next)) break;
            currentTime = next;
            for (const i of order) {
                if (procs[i].remaining > 0 && !procs[i].inQueue && procs[i].arrival_time <= currentTime) {
                    queue.push(i);
                    procs[i].inQueue = true;
                }
            }
            continue;
        }

        const idx = queue.shift();
        const p = procs[idx];

        if (!p.responded) { p.responseTime = currentTime - p.arrival_time; p.responded = true; }

        const execTime = Math.min(quantum, p.remaining);
        const start    = currentTime;
        const end      = currentTime + execTime;

        ganttChart.push({ pid: p.pid, start, end });

        p.remaining  -= execTime;
        currentTime   = end;

        // Enqueue newly arrived processes
        for (const i of order) {
            if (procs[i].remaining > 0 && !procs[i].inQueue && procs[i].arrival_time <= currentTime) {
                queue.push(i);
                procs[i].inQueue = true;
            }
        }

        if (p.remaining > 0) {
            queue.push(idx);
        } else {
            p.completionTime = currentTime;
            completed++;
        }
    }

    const processMetrics = [];
    let totalWaiting = 0, totalTurnaround = 0, totalResponse = 0;

    for (const p of procs) {
        const turnaround = p.completionTime - p.arrival_time;
        const waiting    = turnaround - p.burst_time;

        processMetrics.push({
            pid: p.pid, arrival_time: p.arrival_time, burst_time: p.burst_time,
            completion_time: p.completionTime, turnaround_time: turnaround,
            waiting_time: waiting, response_time: p.responseTime
        });

        totalWaiting    += waiting;
        totalTurnaround += turnaround;
        totalResponse   += p.responseTime;
    }

    return JSON.stringify({
        gantt_chart: ganttChart,
        process_metrics: processMetrics,
        averages: {
            avg_waiting_time:    totalWaiting    / n,
            avg_turnaround_time: totalTurnaround / n,
            avg_response_time:   totalResponse   / n
        }
    });
};
