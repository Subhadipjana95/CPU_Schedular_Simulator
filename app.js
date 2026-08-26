/**
 * app.js — CPU Scheduling Simulator Orchestrator
 * Loads WASM modules on demand, falls back to pure-JS implementations,
 * renders Gantt chart on <canvas>, metrics table, and Chart.js comparison chart.
 */

'use strict';

// ── Process Color Palette ────────────────────────────────
const PROCESS_COLORS = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
    '#f43f5e', '#ec4899', '#06b6d4', '#84cc16',
    '#fb923c', '#a855f7', '#14b8a6', '#ef4444'
];

function getProcessColor(pid) {
    // Deterministic color based on PID string
    let hash = 0;
    for (let i = 0; i < pid.length; i++) {
        hash = (hash * 31 + pid.charCodeAt(i)) | 0;
    }
    return PROCESS_COLORS[Math.abs(hash) % PROCESS_COLORS.length];
}

// ── Algorithm Configuration ──────────────────────────────
const ALGO_CONFIG = {
    fcfs:        { file: 'fcfs',        exportName: 'FCFSModule',       fallback: 'FCFS_fallback',       label: 'FCFS' },
    sjf:         { file: 'sjf',         exportName: 'SJFModule',        fallback: 'SJF_fallback',        label: 'SJF' },
    srtf:        { file: 'srtf',        exportName: 'SRTFModule',       fallback: 'SRTF_fallback',       label: 'SRTF' },
    round_robin: { file: 'round_robin', exportName: 'RoundRobinModule', fallback: 'RoundRobin_fallback', label: 'Round Robin' },
    priority:    { file: 'priority',    exportName: 'PriorityModule',   fallback: 'Priority_fallback',   label: 'Priority' },
};

// ── Module Cache ─────────────────────────────────────────
const loadedModules  = {};   // WASM module instances
const loadedFallbacks = {};  // Fallback script load status
let usingWasm = false;       // Whether last run used WASM

// ── History (for comparison chart) ──────────────────────
const runHistory = [];

// ── State ────────────────────────────────────────────────
let processCounter = 0;

// ── DOM Refs ─────────────────────────────────────────────
const processTableBody    = document.getElementById('process-table-body');
const algoSelect          = document.getElementById('algo-select');
const quantumRow          = document.getElementById('quantum-row');
const quantumInput        = document.getElementById('quantum-input');
const priorityVariantRow  = document.getElementById('priority-variant-row');
const addProcessBtn       = document.getElementById('add-process-btn');
const clearProcessBtn     = document.getElementById('clear-process-btn');
const runBtn              = document.getElementById('run-btn');
const errorMsg            = document.getElementById('error-msg');
const wasmStatusEl        = document.getElementById('wasm-status');
const emptyState          = document.getElementById('empty-state');
const resultsContainer    = document.getElementById('results-container');
const ganttCanvas         = document.getElementById('gantt-canvas');
const metricsTableBody    = document.getElementById('metrics-table-body');
const metricsTableFoot    = document.getElementById('metrics-table-foot');
const statWaiting         = document.getElementById('stat-waiting');
const statTurnaround      = document.getElementById('stat-turnaround');
const statResponse        = document.getElementById('stat-response');
const historyList         = document.getElementById('history-list');
const comparisonContainer = document.getElementById('comparison-chart-container');
const algoRunLabel        = document.getElementById('algo-run-label');
const ganttTooltip        = document.getElementById('gantt-tooltip');
const priorityCols        = document.querySelectorAll('.priority-col');

let comparisonChart = null;  // Chart.js instance

// ── Gantt Tooltip State ──────────────────────────────────
let ganttSegments = [];

// ──────────────────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────────────────
function init() {
    // Seed 3 default processes
    addProcess(0, 5, 2);
    addProcess(1, 3, 1);
    addProcess(2, 8, 3);

    algoSelect.addEventListener('change', onAlgoChange);
    addProcessBtn.addEventListener('click', () => addProcess());
    clearProcessBtn.addEventListener('click', clearAllProcesses);
    runBtn.addEventListener('click', onRun);

    onAlgoChange();
    updateWasmStatus('unknown');
}

// ──────────────────────────────────────────────────────────
// Process Table Management
// ──────────────────────────────────────────────────────────
function addProcess(arrival = 0, burst = 4, priority = 1) {
    processCounter++;
    const pid = `P${processCounter}`;
    const color = getProcessColor(pid);

    const tr = document.createElement('tr');
    tr.dataset.pid = pid;
    tr.innerHTML = `
        <td>
          <span class="pid-badge" style="background:${color}">${pid}</span>
        </td>
        <td><input type="number" class="arrival-input" min="0" value="${arrival}" title="Arrival Time"></td>
        <td><input type="number" class="burst-input" min="1" value="${burst}" title="Burst Time"></td>
        <td class="priority-col ${algoSelect.value === 'priority' ? 'visible' : ''}">
          <input type="number" class="priority-input" min="1" max="99" value="${priority}" title="Priority">
        </td>
        <td>
          <button class="btn-remove" title="Remove Process">✕</button>
        </td>
    `;

    tr.querySelector('.btn-remove').addEventListener('click', () => {
        tr.style.opacity = '0';
        tr.style.transform = 'translateX(10px)';
        tr.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        setTimeout(() => tr.remove(), 200);
    });

    processTableBody.appendChild(tr);

    // Animate in
    tr.style.opacity = '0';
    tr.style.transform = 'translateY(-8px)';
    requestAnimationFrame(() => {
        tr.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        tr.style.opacity = '1';
        tr.style.transform = 'translateY(0)';
    });
}

function clearAllProcesses() {
    const rows = processTableBody.querySelectorAll('tr');
    rows.forEach((row, i) => {
        setTimeout(() => {
            row.style.opacity = '0';
            row.style.transform = 'translateX(10px)';
            row.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
            setTimeout(() => row.remove(), 180);
        }, i * 40);
    });
    processCounter = 0;
}

function collectProcesses() {
    const rows = processTableBody.querySelectorAll('tr');
    const processes = [];
    for (const row of rows) {
        const pid      = row.dataset.pid;
        const arrival  = parseInt(row.querySelector('.arrival-input').value) || 0;
        const burst    = parseInt(row.querySelector('.burst-input').value) || 0;
        const priInput = row.querySelector('.priority-input');
        const priority = priInput ? (parseInt(priInput.value) || 1) : 1;

        processes.push({ pid, arrival_time: arrival, burst_time: burst, priority });
    }
    return processes;
}

// ──────────────────────────────────────────────────────────
// Algorithm Selection
// ──────────────────────────────────────────────────────────
function onAlgoChange() {
    const algo = algoSelect.value;

    // Show/hide quantum row
    quantumRow.classList.toggle('visible', algo === 'round_robin');

    // Show/hide priority variant row
    priorityVariantRow.classList.toggle('visible', algo === 'priority');

    // Show/hide priority column
    priorityCols.forEach(col => col.classList.toggle('visible', algo === 'priority'));

    // Also toggle all priority-col cells in the tbody
    const bodyCols = processTableBody.querySelectorAll('.priority-col');
    bodyCols.forEach(col => col.classList.toggle('visible', algo === 'priority'));
}

// ──────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────
function validate(processes) {
    if (processes.length === 0) return 'Add at least one process.';
    for (const p of processes) {
        if (p.arrival_time < 0) return `${p.pid}: Arrival time must be ≥ 0.`;
        if (p.burst_time <= 0) return `${p.pid}: Burst time must be > 0.`;
        if (isNaN(p.arrival_time) || isNaN(p.burst_time)) return `${p.pid}: Invalid numeric value.`;
    }
    if (algoSelect.value === 'round_robin') {
        const q = parseInt(quantumInput.value);
        if (!q || q <= 0) return 'Quantum must be a positive integer.';
    }
    return null;
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('visible');
}

function clearError() {
    errorMsg.classList.remove('visible');
}

// ──────────────────────────────────────────────────────────
// WASM Module Loading
// ──────────────────────────────────────────────────────────
async function loadFallbackScript(name) {
    if (loadedFallbacks[name]) return;
    return new Promise((resolve, reject) => {
        const script  = document.createElement('script');
        script.src    = `algorithms/${name}/${name}_fallback.js`;
        script.onload = () => { loadedFallbacks[name] = true; resolve(); };
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

async function loadWasmModule(name, exportName) {
    if (loadedModules[name]) return loadedModules[name];

    return new Promise((resolve, reject) => {
        const script  = document.createElement('script');
        script.src    = `algorithms/${name}/${name}.js`;
        script.onload = async () => {
            try {
                if (typeof window[exportName] !== 'function') throw new Error('Module factory not found');
                const moduleInstance = await window[exportName]();
                loadedModules[name] = moduleInstance;
                resolve(moduleInstance);
            } catch (e) { reject(e); }
        };
        script.onerror = () => reject(new Error(`Failed to load ${name}.js`));
        document.body.appendChild(script);
    });
}

// ──────────────────────────────────────────────────────────
// Run Scheduler
// ──────────────────────────────────────────────────────────
async function runScheduler(algoKey, payload) {
    const config = ALGO_CONFIG[algoKey];

    // Try WASM first
    try {
        const mod = await loadWasmModule(config.file, config.exportName);
        const run = mod.cwrap('run_schedule', 'string', ['string']);
        const result = run(JSON.stringify(payload));
        usingWasm = true;
        updateWasmStatus('wasm');
        return JSON.parse(result);
    } catch (wasmError) {
        // Fallback to pure JS
        console.warn(`[CPU Scheduler] WASM unavailable (${wasmError.message}), using JS fallback.`);
        usingWasm = false;
        updateWasmStatus('fallback');

        await loadFallbackScript(config.file);
        const fallbackFn = window[config.fallback];
        if (typeof fallbackFn !== 'function') throw new Error(`No fallback found for ${algoKey}`);

        const result = fallbackFn(JSON.stringify(payload));
        return JSON.parse(result);
    }
}

// ──────────────────────────────────────────────────────────
// Status Indicator
// ──────────────────────────────────────────────────────────
function updateWasmStatus(state) {
    wasmStatusEl.className = 'wasm-status';
    if (state === 'wasm') {
        wasmStatusEl.classList.add('wasm-ready');
        wasmStatusEl.innerHTML = '';
    } else if (state === 'fallback') {
        wasmStatusEl.classList.add('wasm-fallback');
        wasmStatusEl.innerHTML = '';
    } else {
        wasmStatusEl.innerHTML = '';
    }
}

// ──────────────────────────────────────────────────────────
// Main Run Handler
// ──────────────────────────────────────────────────────────
async function onRun() {
    clearError();

    const processes = collectProcesses();
    const validationError = validate(processes);
    if (validationError) { showError(validationError); return; }

    const algo = algoSelect.value;
    const payload = {
        quantum:    parseInt(quantumInput.value) || 2,
        processes:  processes,
        preemptive: document.getElementById('priority-preemptive')?.checked || false
    };

    // Show loading state
    runBtn.classList.add('loading');
    runBtn.disabled = true;

    try {
        const result = await runScheduler(algo, payload);
        renderResults(result, algo);
        addToHistory(algo, result, payload);
    } catch (err) {
        showError(`Error running scheduler: ${err.message}`);
        console.error(err);
    } finally {
        runBtn.classList.remove('loading');
        runBtn.disabled = false;
    }
}

// ──────────────────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────────────────
function renderResults(result, algo) {
    emptyState.style.display  = 'none';
    resultsContainer.style.display = 'block';

    // Update algorithm label
    algoRunLabel.textContent = ALGO_CONFIG[algo].label;
    if (algo === 'round_robin') algoRunLabel.textContent += ` (Q=${document.getElementById('quantum-input').value})`;
    if (algo === 'priority') algoRunLabel.textContent += document.getElementById('priority-preemptive')?.checked ? ' (Preemptive)' : ' (Non-Preemptive)';

    renderGantt(result.gantt_chart);
    renderMetricsTable(result.process_metrics, result.averages);
    renderStats(result.averages);

    // Reveal animation
    resultsContainer.classList.remove('result-reveal');
    void resultsContainer.offsetWidth; // force reflow
    resultsContainer.classList.add('result-reveal');
}

// ── Gantt Chart ──────────────────────────────────────────
function renderGantt(ganttData) {
    if (!ganttData || ganttData.length === 0) return;

    const totalTime = ganttData[ganttData.length - 1].end;
    const startTime = ganttData[0].start;
    const duration  = totalTime - startTime || 1;

    const dpr     = window.devicePixelRatio || 1;
    const wrapper = document.querySelector('.gantt-canvas-wrapper');
    const width   = wrapper.clientWidth || 800;
    const ROW_H   = 52;
    const LABEL_H = 28;
    const AXIS_H  = 24;
    const height  = ROW_H + LABEL_H + AXIS_H + 16;

    ganttCanvas.width  = width * dpr;
    ganttCanvas.height = height * dpr;
    ganttCanvas.style.width  = width + 'px';
    ganttCanvas.style.height = height + 'px';

    const ctx = ganttCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = 'rgba(17,24,39,0)'; // transparent, card bg handles it
    ctx.clearRect(0, 0, width, height);

    const BAR_Y = LABEL_H + 4;
    const BAR_H = ROW_H;

    ganttSegments = [];

    ganttData.forEach(seg => {
        const xStart = ((seg.start - startTime) / duration) * (width - 2) + 1;
        const xEnd   = ((seg.end   - startTime) / duration) * (width - 2) + 1;
        const segW   = Math.max(xEnd - xStart, 2);
        const color  = getProcessColor(seg.pid);

        // Segment bar
        ctx.save();
        ctx.beginPath();
        roundRect(ctx, xStart, BAR_Y, segW, BAR_H, 5);
        ctx.fillStyle = color + 'cc'; // semi-transparent
        ctx.fill();

        // Top highlight
        ctx.beginPath();
        roundRect(ctx, xStart + 1, BAR_Y + 1, segW - 2, 10, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill();
        ctx.restore();

        // PID Label (if wide enough)
        if (segW > 22) {
            ctx.save();
            ctx.font = `bold ${Math.min(12, segW / 2.5)}px "JetBrains Mono", monospace`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 3;
            ctx.fillText(seg.pid, xStart + segW / 2, BAR_Y + BAR_H / 2, segW - 4);
            ctx.restore();
        }

        // Store for tooltip
        ganttSegments.push({ seg, x: xStart, y: BAR_Y, w: segW, h: BAR_H });
    });

    // Time axis
    drawTimeAxis(ctx, ganttData, startTime, duration, width, BAR_Y + BAR_H + 6, AXIS_H);
}

function drawTimeAxis(ctx, ganttData, startTime, duration, width, y, axisH) {
    ctx.save();
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.textAlign = 'center';

    // Collect unique time points
    const times = new Set();
    ganttData.forEach(s => { times.add(s.start); times.add(s.end); });
    const sortedTimes = [...times].sort((a, b) => a - b);

    let lastX = -999;
    sortedTimes.forEach(t => {
        const x = ((t - startTime) / duration) * (width - 2) + 1;
        // Draw tick
        ctx.fillStyle = 'rgba(75,85,99,0.8)';
        ctx.fillRect(x - 0.5, y, 1, 6);
        // Draw label (avoid overlap)
        if (x - lastX > 20) {
            ctx.fillStyle = 'rgba(148,163,184,0.7)';
            ctx.fillText(t, x, y + 16);
            lastX = x;
        }
    });
    ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ── Gantt Tooltip ────────────────────────────────────────
ganttCanvas.addEventListener('mousemove', (e) => {
    const rect = ganttCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let hovered = null;
    for (const gs of ganttSegments) {
        if (mx >= gs.x && mx <= gs.x + gs.w && my >= gs.y && my <= gs.y + gs.h) {
            hovered = gs;
            break;
        }
    }

    if (hovered) {
        const { seg } = hovered;
        ganttTooltip.classList.add('visible');
        ganttTooltip.innerHTML = `
            <div class="tt-pid" style="color:${getProcessColor(seg.pid)}">${seg.pid}</div>
            <div class="tt-row"><span>Start</span><span class="tt-val">${seg.start}</span></div>
            <div class="tt-row"><span>End</span><span class="tt-val">${seg.end}</span></div>
            <div class="tt-row"><span>Duration</span><span class="tt-val">${seg.end - seg.start}</span></div>
        `;
        ganttTooltip.style.left = (e.clientX + 12) + 'px';
        ganttTooltip.style.top  = (e.clientY - 10) + 'px';
        ganttCanvas.style.cursor = 'crosshair';
    } else {
        ganttTooltip.classList.remove('visible');
        ganttCanvas.style.cursor = 'default';
    }
});

ganttCanvas.addEventListener('mouseleave', () => {
    ganttTooltip.classList.remove('visible');
});

// ── Metrics Table ────────────────────────────────────────
function renderMetricsTable(processMetrics, averages) {
    metricsTableBody.innerHTML = '';

    processMetrics.forEach(pm => {
        const color = getProcessColor(pm.pid);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
              <span class="pid-badge" style="background:${color};width:26px;height:26px;font-size:0.68rem">${pm.pid}</span>
            </td>
            <td>${pm.arrival_time}</td>
            <td>${pm.burst_time}</td>
            <td>${pm.completion_time}</td>
            <td>${pm.turnaround_time}</td>
            <td>${pm.waiting_time}</td>
            <td>${pm.response_time}</td>
        `;
        metricsTableBody.appendChild(tr);
    });

    // Footer (averages)
    metricsTableFoot.innerHTML = `
        <tr>
            <td>Averages</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>${averages.avg_turnaround_time.toFixed(2)}</td>
            <td>${averages.avg_waiting_time.toFixed(2)}</td>
            <td>${averages.avg_response_time.toFixed(2)}</td>
        </tr>
    `;
}

// ── Stats Cards ──────────────────────────────────────────
function renderStats(averages) {
    statWaiting.textContent     = averages.avg_waiting_time.toFixed(2);
    statTurnaround.textContent  = averages.avg_turnaround_time.toFixed(2);
    statResponse.textContent    = averages.avg_response_time.toFixed(2);
}

// ──────────────────────────────────────────────────────────
// History & Comparison Chart
// ──────────────────────────────────────────────────────────
function addToHistory(algo, result, payload) {
    const config = ALGO_CONFIG[algo];
    let label = config.label;
    if (algo === 'round_robin') label += ` Q=${payload.quantum}`;
    if (algo === 'priority') label += payload.preemptive ? ' (Pre)' : ' (Non-pre)';

    // Check for duplicate; update if same algo+variant
    const existingIdx = runHistory.findIndex(h => h.label === label);
    const entry = {
        label,
        avg_waiting_time:    result.averages.avg_waiting_time,
        avg_turnaround_time: result.averages.avg_turnaround_time,
        avg_response_time:   result.averages.avg_response_time,
        color: PROCESS_COLORS[runHistory.length % PROCESS_COLORS.length]
    };

    if (existingIdx !== -1) runHistory[existingIdx] = entry;
    else runHistory.push(entry);

    renderHistory();
    if (runHistory.length >= 2) renderComparisonChart();
}

function renderHistory() {
    historyList.innerHTML = '';
    runHistory.forEach((entry, idx) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="history-algo" style="color:${entry.color}">${entry.label}</span>
            <span class="history-metrics">
                W:${entry.avg_waiting_time.toFixed(1)} 
                T:${entry.avg_turnaround_time.toFixed(1)} 
                R:${entry.avg_response_time.toFixed(1)}
            </span>
            <button class="history-clear-btn" data-idx="${idx}" title="Remove">✕</button>
        `;
        div.querySelector('.history-clear-btn').addEventListener('click', (e) => {
            runHistory.splice(parseInt(e.target.dataset.idx), 1);
            renderHistory();
            if (runHistory.length < 2) {
                comparisonContainer.classList.remove('visible');
            } else {
                renderComparisonChart();
            }
        });
        historyList.appendChild(div);
    });
}

function renderComparisonChart() {
    comparisonContainer.classList.add('visible');
    const ctx = document.getElementById('comparison-chart').getContext('2d');

    const labels = runHistory.map(h => h.label);
    const colors = runHistory.map(h => h.color);

    if (comparisonChart) comparisonChart.destroy();

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Avg Waiting Time',
                    data: runHistory.map(h => +h.avg_waiting_time.toFixed(2)),
                    backgroundColor: colors.map(c => c + '99'),
                    borderColor: colors,
                    borderWidth: 2,
                    borderRadius: 6,
                },
                {
                    label: 'Avg Turnaround Time',
                    data: runHistory.map(h => +h.avg_turnaround_time.toFixed(2)),
                    backgroundColor: colors.map(c => c + '55'),
                    borderColor: colors,
                    borderWidth: 2,
                    borderDash: [4, 2],
                    borderRadius: 6,
                },
                {
                    label: 'Avg Response Time',
                    data: runHistory.map(h => +h.avg_response_time.toFixed(2)),
                    backgroundColor: colors.map(c => c + '33'),
                    borderColor: colors.map(c => c + 'aa'),
                    borderWidth: 1,
                    borderRadius: 6,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                },
                tooltip: {
                    backgroundColor: '#111827',
                    borderColor: 'rgba(139,92,246,0.4)',
                    borderWidth: 1,
                    titleColor: '#f0f4ff',
                    bodyColor: '#94a3b8',
                    titleFont: { family: 'Inter', weight: '600' },
                    bodyFont: { family: 'JetBrains Mono' },
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
                    grid:  { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } },
                    grid:  { color: 'rgba(255,255,255,0.05)' },
                    beginAtZero: true
                }
            }
        }
    });
}

// ──────────────────────────────────────────────────────────
// Resize: re-render Gantt on window resize
// ──────────────────────────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (ganttSegments.length > 0) {
            // Re-render with existing data
            const lastData = ganttSegments.map(gs => gs.seg);
            renderGantt(lastData);
        }
    }, 200);
});

// ──────────────────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
