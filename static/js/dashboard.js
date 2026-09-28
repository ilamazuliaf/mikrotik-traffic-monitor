/**
 * MikroTik Traffic Monitor - Dashboard JS Logic
 * Compatible with FastAPI backend & standalone preview demo mode
 */

// Configuration & Global State
const MONITORED_INTERFACES = [
  'ether1-BAROKAH',
  'ether2-BIZ',
  'ether3-WAHED'
];

let selectedInterfaceFilter = 'all'; // 'all' or interface name
let selectedPeriodFilter = '15m'; // '5m', '15m', '30m', '1h', '6h', '12h', '24h'
let pollIntervalSeconds = 5;
let pollTimer = null;
let countdownTimer = null;
let currentProgress = 0;
let lastSuccessfulUpdate = null;
let trafficChart = null;

// Mock mode control
let isDemoMode = false;
let mockHistoricalData = {};

// Color palette for interfaces and datasets
const COLOR_SCHEME = {
  'ether1-BAROKAH': {
    rx: { line: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    tx: { line: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' }
  },
  'ether2-BIZ': {
    rx: { line: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    tx: { line: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' }
  },
  'ether3-WAHED': {
    rx: { line: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    tx: { line: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
  },
  'total': {
    rx: { line: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
    tx: { line: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)' }
  }
};

/**
 * Bandwidth calculation & formatting (PRD Section 6)
 * Thresholds:
 * < 1 Kbps      => bps
 * 1 Kbps-999 Kbps => Kbps
 * 1 Mbps-999 Mbps => Mbps
 * >= 1 Gbps     => Gbps
 */
function splitBandwidth(bps) {
  if (bps === null || bps === undefined || isNaN(bps) || bps < 0) {
    return { val: '0', unit: 'bps' };
  }
  const numeric = Number(bps);
  if (numeric < 1000) {
    return { val: numeric.toFixed(0), unit: 'bps' };
  } else if (numeric < 1000000) {
    return { val: (numeric / 1000).toFixed(2), unit: 'Kbps' };
  } else if (numeric < 1000000000) {
    return { val: (numeric / 1000000).toFixed(2), unit: 'Mbps' };
  } else {
    return { val: (numeric / 1000000000).toFixed(2), unit: 'Gbps' };
  }
}

function formatBandwidth(bps) {
  const parts = splitBandwidth(bps);
  return `${parts.val} ${parts.unit}`;
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  initSparklines();
  initChart();
  initFilters();
  initDemoModeToggle();
  
  // Initial Fetch & Start Polling
  fetchDashboardData();
  startPollingProgress();
});

// Setup Filter Listeners
function initFilters() {
  const interfaceBtns = document.querySelectorAll('.filter-interface .btn-pill');
  interfaceBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      interfaceBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedInterfaceFilter = btn.getAttribute('data-interface');
      updateChartData();
    });
  });

  const periodBtns = document.querySelectorAll('.filter-period .btn-pill');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      periodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPeriodFilter = btn.getAttribute('data-period');
      updateChartData();
    });
  });
}

function initDemoModeToggle() {
  const toggle = document.getElementById('demoToggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      isDemoMode = e.target.checked;
      fetchDashboardData();
    });
  }
}

// Polling Loop with Visual Progress Bar
function startPollingProgress() {
  if (pollTimer) clearInterval(pollTimer);
  if (countdownTimer) clearInterval(countdownTimer);

  const progressBar = document.getElementById('pollingBar');
  const stepMs = 100;
  const totalMs = pollIntervalSeconds * 1000;
  let elapsedMs = 0;

  countdownTimer = setInterval(() => {
    elapsedMs += stepMs;
    currentProgress = (elapsedMs / totalMs) * 100;
    if (progressBar) progressBar.style.width = `${Math.min(currentProgress, 100)}%`;

    if (elapsedMs >= totalMs) {
      elapsedMs = 0;
      fetchDashboardData();
    }
  }, stepMs);
}

// Primary Fetch Method
async function fetchDashboardData() {
  try {
    if (isDemoMode) {
      handleDemoData();
      return;
    }

    // Attempt real API call to FastAPI backend
    const [statusRes, interfacesRes] = await Promise.all([
      fetch('/api/status').catch(() => null),
      fetch('/api/interfaces').catch(() => null)
    ]);

    if (!statusRes || !statusRes.ok || !interfacesRes || !interfacesRes.ok) {
      // Backend not yet running -> fallback to demo mode automatically with subtle UI notification
      setDemoFallbackMode(true);
      handleDemoData();
      return;
    }

    setDemoFallbackMode(false);
    const statusData = await statusRes.json();
    const interfacesData = await interfacesRes.json();

    updateStatusUI(statusData.mikrotik, statusData.last_update);
    updateInterfacesUI(interfacesData.interfaces);
    updateChartData();

  } catch (err) {
    console.warn('API connection offline, running mock data:', err);
    setDemoFallbackMode(true);
    handleDemoData();
  }
}

function setDemoFallbackMode(enabled) {
  const toggle = document.getElementById('demoToggle');
  const banner = document.getElementById('offlineBanner');
  if (toggle && !toggle.checked && enabled) {
    toggle.checked = true;
    isDemoMode = true;
    if (banner) {
      banner.querySelector('.banner-msg').textContent = 'Backend FastAPI belum aktif atau router offline. Menjalankan Mode Simulasi Realtime.';
      banner.classList.add('active');
    }
  } else if (!enabled && banner) {
    banner.classList.remove('active');
  }
}

// Status Updates
function updateStatusUI(status, lastUpdateStr) {
  const statusPill = document.getElementById('mikrotikStatusPill');
  const statusText = document.getElementById('mikrotikStatusText');
  const lastUpdateEl = document.getElementById('lastUpdateTime');
  const offlineBanner = document.getElementById('offlineBanner');

  const formattedTime = lastUpdateStr ? formatTimestamp(lastUpdateStr) : new Date().toLocaleTimeString('id-ID');

  if (status === 'online') {
    statusPill.className = 'status-pill online';
    statusText.textContent = 'ONLINE';
    lastSuccessfulUpdate = formattedTime;
    if (offlineBanner && !isDemoMode) offlineBanner.classList.remove('active');
  } else if (status === 'offline') {
    statusPill.className = 'status-pill offline';
    statusText.textContent = 'OFFLINE';
    if (offlineBanner) {
      offlineBanner.querySelector('.banner-msg').textContent = `MIKROTIK OFFLINE. Last successful update: ${lastSuccessfulUpdate || formattedTime}`;
      offlineBanner.classList.add('active');
    }
  } else {
    statusPill.className = 'status-pill connecting';
    statusText.textContent = 'CONNECTING';
  }

  if (lastUpdateEl) lastUpdateEl.textContent = formattedTime;
}

function formatTimestamp(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('id-ID', { hour12: false });
  } catch (e) {
    return isoStr;
  }
}

// Interface Cards UI Update
function updateInterfacesUI(interfacesList) {
  if (!interfacesList || !Array.isArray(interfacesList)) return;

  interfacesList.forEach(iface => {
    const card = document.getElementById(`card-${iface.name}`);
    if (!card) return;

    // Status
    const statusBadge = card.querySelector('.card-status');
    const rxValEl = card.querySelector('.rx-val');
    const rxUnitEl = card.querySelector('.rx-unit');
    const txValEl = card.querySelector('.tx-val');
    const txUnitEl = card.querySelector('.tx-unit');

    const statusUpper = (iface.status || 'UNKNOWN').toUpperCase();
    statusBadge.textContent = statusUpper;
    
    if (statusUpper === 'RUNNING') {
      statusBadge.className = 'card-status running';
    } else {
      statusBadge.className = 'card-status not_running';
    }

    // Bandwidth formatting
    const rxParsed = splitBandwidth(iface.rx_bps);
    const txParsed = splitBandwidth(iface.tx_bps);

    if (rxValEl) rxValEl.textContent = rxParsed.val;
    if (rxUnitEl) rxUnitEl.textContent = rxParsed.unit;
    if (txValEl) txValEl.textContent = txParsed.val;
    if (txUnitEl) txUnitEl.textContent = txParsed.unit;

    // Update Sparkline
    updateSparkline(iface.name, iface.rx_bps, iface.tx_bps);
  });
}

// Sparklines Rendering for Cards
const sparklineHistory = {};

function initSparklines() {
  MONITORED_INTERFACES.forEach(iface => {
    sparklineHistory[iface] = { rx: [], tx: [] };
  });
}

function updateSparkline(ifaceName, rxBps, txBps) {
  const container = document.getElementById(`sparkline-${ifaceName}`);
  if (!container) return;

  const history = sparklineHistory[ifaceName] || { rx: [], tx: [] };
  history.rx.push(rxBps || 0);
  history.tx.push(txBps || 0);

  if (history.rx.length > 20) history.rx.shift();
  if (history.tx.length > 20) history.tx.shift();

  sparklineHistory[ifaceName] = history;

  const width = container.clientWidth || 240;
  const height = 36;
  const max = Math.max(...history.rx, ...history.tx, 1000000);

  function getPathPoints(data) {
    if (data.length < 2) return '';
    return data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (val / max) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' L ');
  }

  const rxPath = getPathPoints(history.rx);
  const txPath = getPathPoints(history.tx);

  container.innerHTML = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      ${rxPath ? `<path d="M ${rxPath}" fill="none" stroke="#06b6d4" stroke-width="2" opacity="0.85"/>` : ''}
      ${txPath ? `<path d="M ${txPath}" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.85"/>` : ''}
    </svg>
  `;
}

// Interactive Chart.js setup
function initChart() {
  const ctx = document.getElementById('trafficChartContainer');
  if (!ctx) return;

  Chart.defaults.color = '#9ca3af';
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

  trafficChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            padding: 16,
            font: { size: 12, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12 },
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              return `${label}: ${formatBandwidth(value)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { maxRotation: 0, font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            font: { size: 11 },
            callback: function(value) {
              return formatBandwidth(value);
            }
          }
        }
      },
      elements: {
        line: { tension: 0.35, borderWidth: 2 },
        point: { radius: 0, hoverRadius: 5 }
      }
    }
  });
}

// Fetch or calculate chart dataset based on filter selection
async function updateChartData() {
  if (!trafficChart) return;

  let timeData = [];

  if (isDemoMode) {
    timeData = getDemoTrafficData(selectedInterfaceFilter, selectedPeriodFilter);
  } else {
    try {
      const url = `/api/traffic?interface=${encodeURIComponent(selectedInterfaceFilter)}&period=${encodeURIComponent(selectedPeriodFilter)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        timeData = json.data || [];
      } else {
        timeData = getDemoTrafficData(selectedInterfaceFilter, selectedPeriodFilter);
      }
    } catch (e) {
      timeData = getDemoTrafficData(selectedInterfaceFilter, selectedPeriodFilter);
    }
  }

  // Format labels & datasets for Chart.js
  const labels = timeData.map(item => {
    const d = new Date(item.timestamp);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  const datasets = [];

  if (selectedInterfaceFilter === 'all') {
    // Show total RX & TX or per interface curves
    MONITORED_INTERFACES.forEach(iface => {
      const colors = COLOR_SCHEME[iface];
      datasets.push({
        label: `${iface} (RX)`,
        data: timeData.map(item => item[iface] ? item[iface].rx_bps : 0),
        borderColor: colors.rx.line,
        backgroundColor: colors.rx.bg,
        fill: false
      });
      datasets.push({
        label: `${iface} (TX)`,
        data: timeData.map(item => item[iface] ? item[iface].tx_bps : 0),
        borderColor: colors.tx.line,
        borderDash: [4, 4],
        backgroundColor: colors.tx.bg,
        fill: false
      });
    });
  } else {
    // Single interface detailed view
    const colors = COLOR_SCHEME[selectedInterfaceFilter] || COLOR_SCHEME.total;
    datasets.push({
      label: `Download (RX)`,
      data: timeData.map(item => item.rx_bps || 0),
      borderColor: colors.rx.line,
      backgroundColor: colors.rx.bg,
      fill: true
    });
    datasets.push({
      label: `Upload (TX)`,
      data: timeData.map(item => item.tx_bps || 0),
      borderColor: colors.tx.line,
      borderDash: [3, 3],
      backgroundColor: colors.tx.bg,
      fill: false
    });
  }

  trafficChart.data.labels = labels;
  trafficChart.data.datasets = datasets;
  trafficChart.update('none');
}

// Generator for Demo/Simulation Mode
function handleDemoData() {
  const now = new Date();

  // Generate dynamic realistic values
  const ether1Rx = Math.floor(110000000 + Math.random() * 35000000); // 110-145 Mbps
  const ether1Tx = Math.floor(15000000 + Math.random() * 8000000);   // 15-23 Mbps

  const ether2Rx = Math.floor(70000000 + Math.random() * 25000000);  // 70-95 Mbps
  const ether2Tx = Math.floor(10000000 + Math.random() * 5000000);   // 10-15 Mbps

  const ether3Rx = Math.floor(35000000 + Math.random() * 15000000);  // 35-50 Mbps
  const ether3Tx = Math.floor(5000000 + Math.random() * 4000000);    // 5-9 Mbps

  const interfacesData = [
    { name: 'ether1-BAROKAH', status: 'running', rx_bps: ether1Rx, tx_bps: ether1Tx },
    { name: 'ether2-BIZ', status: 'running', rx_bps: ether2Rx, tx_bps: ether2Tx },
    { name: 'ether3-WAHED', status: 'running', rx_bps: ether3Rx, tx_bps: ether3Tx }
  ];

  // Store in mock memory history
  pushMockHistory(now.toISOString(), interfacesData);

  updateStatusUI('online', now.toISOString());
  updateInterfacesUI(interfacesData);
  updateChartData();
}

function pushMockHistory(timestamp, interfacesData) {
  if (!mockHistoricalData.points) mockHistoricalData.points = [];

  const entry = { timestamp };
  interfacesData.forEach(iface => {
    entry[iface.name] = { rx_bps: iface.rx_bps, tx_bps: iface.tx_bps };
  });

  mockHistoricalData.points.push(entry);

  // Keep last 100 points
  if (mockHistoricalData.points.length > 100) {
    mockHistoricalData.points.shift();
  }
}

function getDemoTrafficData(ifaceFilter, periodStr) {
  if (!mockHistoricalData.points || mockHistoricalData.points.length === 0) {
    // Pre-populate initial mock points if empty
    const now = Date.now();
    mockHistoricalData.points = [];
    for (let i = 20; i >= 0; i--) {
      const t = new Date(now - i * 5000).toISOString();
      pushMockHistory(t, [
        { name: 'ether1-BAROKAH', rx_bps: 120000000 + Math.random() * 20000000, tx_bps: 18000000 + Math.random() * 4000000 },
        { name: 'ether2-BIZ', rx_bps: 80000000 + Math.random() * 15000000, tx_bps: 12000000 + Math.random() * 3000000 },
        { name: 'ether3-WAHED', rx_bps: 40000000 + Math.random() * 10000000, tx_bps: 7000000 + Math.random() * 2000000 }
      ]);
    }
  }

  const raw = mockHistoricalData.points;
  if (ifaceFilter === 'all') {
    return raw;
  }

  return raw.map(pt => ({
    timestamp: pt.timestamp,
    rx_bps: pt[ifaceFilter] ? pt[ifaceFilter].rx_bps : 0,
    tx_bps: pt[ifaceFilter] ? pt[ifaceFilter].tx_bps : 0
  }));
}
