// algorithms/srtf/srtf_fallback.js
// Pure JavaScript fallback for SRTF (Preemptive SJF) (used when WASM is not available)

window.SRTF_fallback = function(inputJson) {
    const input = JSON.parse(inputJson);
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
        let idx = -1, minRemaining = Infinity;

        for (let i = 0; i < n; i++) {
            if (procs[i].remaining <= 0 || procs[i].arrival_time > currentTime) continue;
            if (procs[i].remaining < minRemaining ||
               (procs[i].remaining === minRemaining && idx !== -1 &&
                procs[i].arrival_time < procs[idx].arrival_time)) {
                minRemaining = procs[i].remaining;
                idx = i;
            }
        }

        if (idx === -1) {
            if (lastPid !== null) {
                ganttChart.push({ pid: lastPid, start: segmentStart, end: currentTime });
                lastPid = null;
            }
            let next = Infinity;
            for (const p of procs) if (p.remaining > 0) next = Math.min(next, p.arrival_time);
            currentTime = next;
            segmentStart = currentTime;
            continue;
        }

        const chosen = procs[idx];
        if (!chosen.started) { chosen.started = true; chosen.startTime = currentTime; }

        if (chosen.pid !== lastPid) {
            if (lastPid !== null) ganttChart.push({ pid: lastPid, start: segmentStart, end: currentTime });
            segmentStart = currentTime;
            lastPid = chosen.pid;
        }

        chosen.remaining--;
        currentTime++;

        if (chosen.remaining === 0) {
            chosen.completionTime = currentTime;
            completed++;
        }
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
            completion_time: p.completionTime, turnaround_time: turnaround,
            waiting_time: waiting, response_time: response
        });

        totalWaiting    += waiting;
        totalTurnaround += turnaround;
        totalResponse   += response;
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
