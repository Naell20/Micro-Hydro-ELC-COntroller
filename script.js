// --- 1. DOM Elements ---
// Inputs
const sliderWater = document.getElementById('sliderWater');
const btnMainLoad = document.getElementById('btnMainLoad');
const sliderELC = document.getElementById('sliderELC');
const btnReset = document.getElementById('btnReset');

// Displays
const valWaterFlow = document.getElementById('valWaterFlow');
const valELC = document.getElementById('valELC');
const dispRPM = document.getElementById('dispRPM');
const dispVolt = document.getElementById('dispVolt');
const dispError = document.getElementById('dispError');
const dispMain = document.getElementById('dispMain');
const dispDummy = document.getElementById('dispDummy');
const controllerStatus = document.getElementById('controllerStatus');
const wheel = document.getElementById('waterWheel');
const dummyBg = document.getElementById('dummyBg');

// --- 2. State & Physics Variables ---
const SETPOINT = 12.0;
const DT = 0.05; // 50ms time step for physics
const INERTIA = 2.0; // Resistance to speed change
const VOLT_MULTIPLIER = 0.12; // RPM to Volt (100 RPM = 12V)
const FRICTION_COEFFICIENT = 0.1;
const SETPOINT_RPM = SETPOINT / VOLT_MULTIPLIER;
const FLOW_START_THRESHOLD = 30;
const DISPLAY_FLOW_SCALE = 1.5;
const TORQUE_PER_FLOW_PERCENT = 1.6;
const ELC_SLEW_RATE = 100; // Maximum dummy-load movement per second (%/s)
const ELC_SPEED_CORRECTION = 2;

let waterFlow = parseFloat(sliderWater.value) * DISPLAY_FLOW_SCALE;
let isMainLoadOn = true;
let mainLoadValue = 70.0;
let dummyLoadValue = 0.0; // Automatic dummy-load output (0 to 100)

function getTurbineTorque() {
    return Math.max(0, waterFlow - FLOW_START_THRESHOLD) * TORQUE_PER_FLOW_PERCENT;
}

function getRpmWithoutDummyLoad() {
    const loadPerRpm = mainLoadValue / SETPOINT_RPM + FRICTION_COEFFICIENT;
    return Math.min(SETPOINT_RPM, getTurbineTorque() / loadPerRpm);
}

let rpm = getRpmWithoutDummyLoad();
let voltage = rpm * VOLT_MULTIPLIER;

// --- 3. Event Listeners ---
sliderWater.addEventListener('input', (e) => {
    const displayedFlow = parseFloat(e.target.value);
    waterFlow = displayedFlow * DISPLAY_FLOW_SCALE;
    valWaterFlow.innerText = displayedFlow + '%';
});

btnMainLoad.addEventListener('click', () => {
    isMainLoadOn = !isMainLoadOn;
    if (isMainLoadOn) {
        btnMainLoad.innerText = 'Lampu ON (70W)';
        btnMainLoad.className = 'w-full py-3 rounded-lg font-bold text-white transition-all bg-green-600 hover:bg-green-500 shadow-[0_0_15px_rgba(22,163,74,0.4)]';
        mainLoadValue = 70.0;
    } else {
        btnMainLoad.innerText = 'Lampu OFF (0W)';
        btnMainLoad.className = 'w-full py-3 rounded-lg font-bold text-white transition-all bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)]';
        mainLoadValue = 0.0;
    }
    dispMain.innerText = mainLoadValue + ' W';
});

btnReset.addEventListener('click', () => {
    rpm = getRpmWithoutDummyLoad();
    voltage = rpm * VOLT_MULTIPLIER;
    dummyLoadValue = 0;
    sliderELC.value = '0';
    valELC.innerText = '0.0%';
    
    // Clear chart
    chart.data.labels = Array(MAX_DATA_POINTS).fill('');
    chart.data.datasets[0].data = Array(MAX_DATA_POINTS).fill(voltage);
    chart.update();
});

// --- 4. Chart.js Setup ---
const ctx = document.getElementById('voltageChart').getContext('2d');
const MAX_DATA_POINTS = 100; // 5 seconds history at 50ms tick

const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(MAX_DATA_POINTS).fill(''),
        datasets: [
            {
                label: 'Actual Voltage (V)',
                borderColor: '#22c55e', // Tailwind green-500
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.2,
                data: Array(MAX_DATA_POINTS).fill(voltage),
                fill: true
            },
            {
                label: 'Setpoint (12V)',
                borderColor: '#9ca3af', // Tailwind gray-400
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                data: Array(MAX_DATA_POINTS).fill(12.0),
                fill: false
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Turn off animation for performance & oscilloscope look
        interaction: { intersect: false },
        plugins: {
            legend: {
                labels: { color: '#e5e7eb', font: { family: "'Inter', sans-serif" } }
            }
        },
        scales: {
            x: {
                display: true,
                grid: { color: '#374151' }, // gray-700
                ticks: { display: false } // Hide labels to look like continuous flow
            },
            y: {
                display: true,
                min: 8,
                max: 16,
                grid: { color: '#374151' },
                ticks: {
                    color: '#9ca3af',
                    font: { family: "'JetBrains Mono', monospace" },
                    callback: function(value) { return value.toFixed(1) + ' V'; }
                }
            }
        }
    }
});

// --- 5. Main Simulation Loop ---
function simulateLoop() {
    // --- A. Physics Engine ---
    const turbineTorque = getTurbineTorque();
    const generatorLoad = (mainLoadValue + dummyLoadValue) * (rpm / SETPOINT_RPM);
    const friction = FRICTION_COEFFICIENT * rpm;
    const netTorque = turbineTorque - generatorLoad - friction;
    
    let acceleration = netTorque / INERTIA;
    rpm += acceleration * DT;
    
    // Safety Clamps (Mechanics don't go negative)
    if (rpm < 0) rpm = 0;
    
    // Calculate Generator Output
    voltage = rpm * VOLT_MULTIPLIER;
    
    // --- B. ELC ballast-load control ---
    let error = voltage - SETPOINT;
    const excessLoad = turbineTorque - mainLoadValue - FRICTION_COEFFICIENT * SETPOINT_RPM;
    const speedCorrection = (rpm - SETPOINT_RPM) * ELC_SPEED_CORRECTION;
    const targetDummyLoad = Math.min(100, Math.max(0, excessLoad + speedCorrection));
    const maxLoadChange = ELC_SLEW_RATE * DT;
    const loadDifference = targetDummyLoad - dummyLoadValue;
    dummyLoadValue += Math.min(maxLoadChange, Math.max(-maxLoadChange, loadDifference));
    sliderELC.value = dummyLoadValue.toFixed(1);
    valELC.innerText = dummyLoadValue.toFixed(1) + '%';

    // --- C. Update UI ---
    // Texts
    dispRPM.innerText = rpm.toFixed(1);
    dispVolt.innerText = voltage.toFixed(2);
    dispError.innerText = (voltage > SETPOINT ? '+' : '') + error.toFixed(2) + 'V';
    dispDummy.innerText = dummyLoadValue.toFixed(1) + ' %';

    if (error > 0.05 && dummyLoadValue >= 99.5) {
        controllerStatus.innerText = 'BATAS DUMMY LOAD';
        controllerStatus.className = 'text-xs font-mono text-red-400';
    } else if (error < -0.05 && dummyLoadValue <= 0.5 && turbineTorque < mainLoadValue + FRICTION_COEFFICIENT * SETPOINT_RPM) {
        controllerStatus.innerText = 'DEBIT KURANG';
        controllerStatus.className = 'text-xs font-mono text-red-400';
    } else if (error > 0.05 && dummyLoadValue > 0.5) {
        controllerStatus.innerText = 'MENAMBAH BEBAN';
        controllerStatus.className = 'text-xs font-mono text-yellow-400';
    } else if (error < -0.05) {
        controllerStatus.innerText = 'MELEPAS BEBAN';
        controllerStatus.className = 'text-xs font-mono text-blue-300';
    } else {
        controllerStatus.innerText = 'STABIL';
        controllerStatus.className = 'text-xs font-mono text-green-400';
    }
    
    // Update Voltage Color based on status
    if (voltage > 13.5 || voltage < 10.5) {
        dispVolt.className = "text-3xl font-mono font-bold text-red-500 neon-text-red";
        chart.data.datasets[0].borderColor = '#ef4444'; // Red
        chart.data.datasets[0].backgroundColor = 'rgba(239, 68, 68, 0.1)';
    } else if (voltage > 12.5 || voltage < 11.5) {
        dispVolt.className = "text-3xl font-mono font-bold text-yellow-400";
        chart.data.datasets[0].borderColor = '#eab308'; // Yellow
        chart.data.datasets[0].backgroundColor = 'rgba(234, 179, 8, 0.1)';
    } else {
        dispVolt.className = "text-3xl font-mono font-bold text-green-400 neon-text-green";
        chart.data.datasets[0].borderColor = '#22c55e'; // Green
        chart.data.datasets[0].backgroundColor = 'rgba(34, 197, 94, 0.1)';
    }

    // Wheel Animation Speed
    if (rpm <= 0.001) {
        wheel.style.animationPlayState = 'paused';
    } else {
        wheel.style.animationPlayState = 'running';
        // 60 seconds / rpm = seconds per revolution
        let speedSecs = 60 / rpm;
        // clamp speed for visual sanity
        if (speedSecs < 0.1) speedSecs = 0.1;
        wheel.style.animationDuration = speedSecs + 's';
    }

    // Dummy Load Background Glow effect based on PWM
    dummyBg.style.opacity = (dummyLoadValue / 100) * 0.5;

    // --- D. Update Chart ---
    chart.data.labels.push('');
    chart.data.datasets[0].data.push(voltage);
    chart.data.datasets[1].data.push(SETPOINT);
    
    // Scroll by removing oldest point
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.shift();
    
    chart.update();
}

// Run simulation loop every 50 milliseconds
window.onload = () => {
    setInterval(simulateLoop, 50);
};