/**
 * MikroTik Traffic Monitor - Frontend Engine v1.1.1
 * Fully dynamic interface & graph period management following .env via /api/config.
 * Supports hot-reloading configurations, dynamic cards, and Realtime vs Historical Snapshot modes.
 */

// Default Fallback Configuration (if backend /api/config is unreachable at start)
const DEFAULT_CONFIG = {
  interfaces: ['ether1-BAROKAH', 'ether2-BIZ', 'ether3-WAHED'],
  graph_periods: [
    { value: '5m', label: '5 Menit', mode: 'realtime' },
    { value: '15m', label: '15 Menit', mode: 'realtime' },
    { value: '30m', label: '30 Menit', mode: 'realtime' },
    { value: '1h', label: '1 Jam', mode: 'historical' },
    { value: '6h', label: '6 Jam', mode: 'historical' },
    { value: '12h', label: '12 Jam', mode: 'historical' },
    { value: '24h', label: '24 Jam', mode: 'historical' }
  ],
  default_period: '15m',
  realtime_max: '30m',
  poll_interval: 5
};

// Application State
let appConfig = { ...DEFAULT_CONFIG };
let monitoredInterfaces = [...DEFAULT_CONFIG.interfaces];
let selectedInterfaceFilter = 'all'; // 'all' or interface name
let selectedPeriodFilter = '15m';
let currentMode = 'realtime'; // 'realtime' or 'historical'
let pollIntervalSeconds = 5;

let countdownTimer = null;
let lastSuccessfulUpdate = null;
let lastSnapshotTimestamp = null;
let trafficChart = null;
let sparklineHistory = {};

// Demo/Mock mode states
let isManualDemoMode = false;
let isAutoDemoFallback = false;
let mockHistoricalPoints = [];

// Visual color palette generator for dynamic interfaces
const PRESET_COLORS = {
  'ether1-BAROKAH': { rx: { line: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' }, tx: { line: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' } },
  'ether2-BIZ':     { rx: { line: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' }, tx: { line: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' } },
  'ether3-WAHED':   { rx: { line: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }, tx: { line: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' } },
  'total':          { rx: { line: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' }, tx: { line: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)' } }
};

/**
 * Generates consistent colors for any dynamic interface name
 */
function getInterfaceColors(ifaceName) {
  if (PRESET_COLORS[ifaceName]) {
    return PRESET_COLORS[ifaceName];
  }
  let hash = 0;
  for (let i = 0; i < ifaceName.length; i++) {
    hash = ifaceName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hueRx = Math.abs(hash) % 360;
  const hueTx = (hueRx + 140) % 360;

  return {
    rx: { line: `hsl(${hueRx}, 85%, 60%)`, bg: `hsla(${hueRx}, 85%, 60%, 0.15)` },
    tx: { line: `hsl(${hueTx}, 85%, 65%)`, bg: `hsla(${hueTx}, 85%, 65%, 0.15)` }
  };
}

/**
 * Bandwidth calculation & formatting
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

/**
 * Parses time string (e.g. "5m", "10m", "1h", "24h", "7d") into seconds
 */
function parsePeriodToSeconds(periodStr) {
  if (!periodStr) return 900;
  const match = String(periodStr).trim().match(/^(\d+)([mhdwy])$/i);
  if (!match) return 900;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit === 'm') return val * 60;
  if (unit === 'h') return val * 3600;
  if (unit === 'd') return val * 86400;
  if (unit === 'w') return val * 604800;
  if (unit === 'y') return val * 31536000;
  return 900;
}

/**
 * Formats period code into human readable label
 */
function getPeriodLabel(periodStr) {
  if (!periodStr) return periodStr;
  const match = String(periodStr).trim().match(/^(\d+)([mhdwy])$/i);
  if (!match) return periodStr;
  const val = match[1];
  const unit = match[2].toLowerCase();
  if (unit === 'm') return `${val} Menit`;
  if (unit === 'h') return `${val} Jam`;
  if (unit === 'd') return `${val} Hari`;
  if (unit === 'w') return `${val} Minggu`;
  if (unit === 'y') return `${val} Tahun`;
  return periodStr;
}

/**
 * Determines whether a period is realtime or historical snapshot
 */
function isPeriodRealtime(periodValue) {
  const periods = appConfig.graph_periods || DEFAULT_CONFIG.graph_periods;
  const periodObj = periods.find(p => (typeof p === 'string' ? p : p.value) === periodValue);

  if (periodObj && typeof periodObj === 'object' && periodObj.mode) {
    return periodObj.mode === 'realtime';
  }

  const maxSec = parsePeriodToSeconds(appConfig.realtime_max || '30m');
  const periodSec = parsePeriodToSeconds(periodValue);
  return periodSec <= maxSec;
}

// Initialization on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  initChart();
  initDemoToggle();
  initRefreshButton();
  initVisibilityListener();

  // Load dynamic configuration from backend
  await loadConfig();

  // Initial Data Fetch
  await applyFilterChange(true);
});

/**
 * Loads dynamic configuration from /api/config
 */
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      appConfig = { ...DEFAULT_CONFIG, ...data };
      isAutoDemoFallback = false;
    } else {
      if (!isManualDemoMode) isAutoDemoFallback = true;
    }
  } catch (err) {
    if (!isManualDemoMode) isAutoDemoFallback = true;
  }

  monitoredInterfaces = appConfig.interfaces || DEFAULT_CONFIG.interfaces;
  pollIntervalSeconds = appConfig.poll_interval || 5;

  const periods = appConfig.graph_periods || DEFAULT_CONFIG.graph_periods;
  const periodValues = periods.map(p => (typeof p === 'string' ? p : p.value));

  if (!periodValues.includes(selectedPeriodFilter)) {
    selectedPeriodFilter = appConfig.default_period || periodValues[0] || '15m';
  }

  renderDynamicCards();
  renderDynamicFilters();
  updateOfflineBanner();
}

/**
 * Dynamically updates configuration if backend settings (.env) changed
 */
function updateConfigIfChanged(newConfig) {
  if (!newConfig) return;

  const newInterfaces = newConfig.interfaces || [];
  const newPeriods = newConfig.graph_periods || [];

  const interfacesChanged = JSON.stringify(newInterfaces) !== JSON.stringify(appConfig.interfaces);
  const periodsChanged = JSON.stringify(newPeriods) !== JSON.stringify(appConfig.graph_periods);
  const defaultChanged = newConfig.default_period !== appConfig.default_period;

  if (interfacesChanged || periodsChanged || defaultChanged) {
    appConfig = { ...DEFAULT_CONFIG, ...newConfig };
    monitoredInterfaces = appConfig.interfaces || DEFAULT_CONFIG.interfaces;
    pollIntervalSeconds = appConfig.poll_interval || 5;

    renderDynamicCards();
    renderDynamicFilters();

    const isRealtime = isPeriodRealtime(selectedPeriodFilter);
    currentMode = isRealtime ? 'realtime' : 'historical';
    updateModeBadgeUI();
    fetchChartData();
  }
}

/**
 * Dynamically builds interface cards based on MONITORED_INTERFACES
 */
function renderDynamicCards() {
  const container = document.getElementById('interfacesGrid');
  if (!container) return;

  const currentCardIds = Array.from(container.querySelectorAll('.card-interface')).map(c => c.id.replace('card-', ''));
  const isSame = currentCardIds.length === monitoredInterfaces.length &&
                 monitoredInterfaces.every((val, idx) => val === currentCardIds[idx]);

  if (isSame) return; // Skip re-rendering if card structure hasn't changed

  container.innerHTML = '';
  sparklineHistory = {};

  monitoredInterfaces.forEach((iface, idx) => {
    sparklineHistory[iface] = { rx: [], tx: [] };

    let iconLabel = `IF${idx + 1}`;
    const ethMatch = iface.match(/ether(\d+)/i);
    const wlanMatch = iface.match(/wlan(\d+)/i);
    const vlanMatch = iface.match(/vlan(\d+)/i);

    if (ethMatch) iconLabel = `ETH${ethMatch[1]}`;
    else if (wlanMatch) iconLabel = `WLAN${wlanMatch[1]}`;
    else if (vlanMatch) iconLabel = `VLAN${vlanMatch[1]}`;
    else if (iface.length <= 6) iconLabel = iface.toUpperCase();

    const cardHtml = `
      <article class="card-interface" id="card-${iface}">
        <div class="card-header">
          <div class="card-title">
            <div class="icon-eth">${iconLabel}</div>
            <h3>${iface}</h3>
          </div>
          <span class="card-status running">RUNNING</span>
        </div>

        <div class="metrics-group">
          <div class="metric-box rx">
            <div class="metric-label">
              <span>DOWNLOAD (RX)</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
            </div>
            <div>
              <span class="metric-value rx-val">0.00</span>
              <span class="metric-unit rx-unit">Mbps</span>
            </div>
          </div>

          <div class="metric-box tx">
            <div class="metric-label">
              <span>UPLOAD (TX)</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            </div>
            <div>
              <span class="metric-value tx-val">0.00</span>
              <span class="metric-unit tx-unit">Mbps</span>
            </div>
          </div>
        </div>

        <div class="sparkline-wrapper" id="sparkline-${iface}"></div>
      </article>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
  });
}

/**
 * Dynamically builds filter button groups for interfaces & periods
 */
function renderDynamicFilters() {
  // Interface filter group
  const interfaceGroup = document.getElementById('filterInterfaceGroup');
  if (interfaceGroup) {
    if (selectedInterfaceFilter !== 'all' && !monitoredInterfaces.includes(selectedInterfaceFilter)) {
      selectedInterfaceFilter = 'all';
    }

    interfaceGroup.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `btn-pill ${selectedInterfaceFilter === 'all' ? 'active' : ''}`;
    allBtn.setAttribute('data-interface', 'all');
    allBtn.textContent = 'Semua Interface';
    allBtn.addEventListener('click', () => onInterfaceFilterSelect('all', allBtn));
    interfaceGroup.appendChild(allBtn);

    monitoredInterfaces.forEach(iface => {
      const btn = document.createElement('button');
      btn.className = `btn-pill ${selectedInterfaceFilter === iface ? 'active' : ''}`;
      btn.setAttribute('data-interface', iface);
      btn.textContent = iface;
      btn.addEventListener('click', () => onInterfaceFilterSelect(iface, btn));
      interfaceGroup.appendChild(btn);
    });
  }

  // Period filter group
  const periodGroup = document.getElementById('filterPeriodGroup');
  if (periodGroup) {
    const periods = appConfig.graph_periods || DEFAULT_CONFIG.graph_periods;
    const periodValues = periods.map(p => (typeof p === 'string' ? p : p.value));

    if (!periodValues.includes(selectedPeriodFilter)) {
      selectedPeriodFilter = appConfig.default_period || periodValues[0] || '15m';
    }

    periodGroup.innerHTML = '';

    periods.forEach(pObj => {
      const val = typeof pObj === 'string' ? pObj : pObj.value;
      const label = typeof pObj === 'object' && pObj.label ? pObj.label : getPeriodLabel(val);

      const btn = document.createElement('button');
      btn.className = `btn-pill ${selectedPeriodFilter === val ? 'active' : ''}`;
      btn.setAttribute('data-period', val);
      btn.textContent = label;
      btn.addEventListener('click', () => onPeriodFilterSelect(val, btn));
      periodGroup.appendChild(btn);
    });
  }
}

function onInterfaceFilterSelect(iface, clickBtn) {
  const container = document.getElementById('filterInterfaceGroup');
  if (container) {
    container.querySelectorAll('.btn-pill').forEach(b => b.classList.remove('active'));
  }
  clickBtn.classList.add('active');
  selectedInterfaceFilter = iface;
  applyFilterChange();
}

function onPeriodFilterSelect(periodVal, clickBtn) {
  const container = document.getElementById('filterPeriodGroup');
  if (container) {
    container.querySelectorAll('.btn-pill').forEach(b => b.classList.remove('active'));
  }
  clickBtn.classList.add('active');
  selectedPeriodFilter = periodVal;
  applyFilterChange();
}

/**
 * Handles switching between Realtime vs Historical Snapshot mode
 */
async function applyFilterChange(isInitial = false) {
  const isRealtime = isPeriodRealtime(selectedPeriodFilter);
  currentMode = isRealtime ? 'realtime' : 'historical';

  updateModeBadgeUI();

  if (currentMode === 'realtime') {
    startPolling();
  } else {
    stopPolling();
  }

  await fetchDashboardData();
  await fetchChartData();
}

/**
 * Updates UI Mode Badge (LIVE vs HISTORICAL) & Refresh Button visibility
 */
function updateModeBadgeUI() {
  const badge = document.getElementById('graphModeBadge');
  const badgeText = document.getElementById('graphModeText');
  const refreshBtn = document.getElementById('btnRefreshHistorical');
  const progressBar = document.getElementById('pollingBar');
  const footerStatus = document.getElementById('footerRefreshStatus');
  const snapshotText = document.getElementById('snapshotTimeText');

  if (currentMode === 'realtime') {
    if (badge) {
      badge.className = 'mode-badge live';
      if (badgeText) badgeText.textContent = 'LIVE';
    }
    if (refreshBtn) refreshBtn.style.display = 'none';
    if (progressBar) progressBar.style.display = 'block';
    if (footerStatus) footerStatus.textContent = `${pollIntervalSeconds}s (Realtime)`;
    if (snapshotText) snapshotText.textContent = '';
  } else {
    if (badge) {
      badge.className = 'mode-badge historical';
      if (badgeText) badgeText.textContent = 'HISTORICAL';
    }
    if (refreshBtn) refreshBtn.style.display = 'inline-flex';
    if (progressBar) progressBar.style.display = 'none';
    if (footerStatus) footerStatus.textContent = 'Disabled (Historical Snapshot)';
    if (snapshotText && lastSnapshotTimestamp) {
      snapshotText.textContent = `Snapshot: ${lastSnapshotTimestamp}`;
    }
  }
}

/**
 * Manual Refresh Button for Historical Mode
 */
function initRefreshButton() {
  const btn = document.getElementById('btnRefreshHistorical');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.style.opacity = '0.6';
      await fetchChartData();
      btn.disabled = false;
      btn.style.opacity = '1';
    });
  }
}

/**
 * Polling progress bar & timer control
 */
function startPolling() {
  stopPolling();

  if (document.hidden) return;

  const progressBar = document.getElementById('pollingBar');
  const stepMs = 100;
  const totalMs = pollIntervalSeconds * 1000;
  let elapsedMs = 0;

  countdownTimer = setInterval(() => {
    elapsedMs += stepMs;
    const progress = (elapsedMs / totalMs) * 100;
    if (progressBar) progressBar.style.width = `${Math.min(progress, 100)}%`;

    if (elapsedMs >= totalMs) {
      elapsedMs = 0;
      if (currentMode === 'realtime') {
        fetchDashboardData();
        fetchChartData();
      }
    }
  }, stepMs);
}

function stopPolling() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  const progressBar = document.getElementById('pollingBar');
  if (progressBar) progressBar.style.width = '0%';
}

/**
 * Tab Visibility Optimization
 */
function initVisibilityListener() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      if (currentMode === 'realtime') {
        fetchDashboardData();
        fetchChartData();
        startPolling();
      }
    }
  });
}

function initDemoToggle() {
  const toggle = document.getElementById('demoToggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      isManualDemoMode = e.target.checked;
      updateOfflineBanner();
      applyFilterChange();
    });
  }
}

function updateOfflineBanner() {
  const toggle = document.getElementById('demoToggle');
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;

  if (isManualDemoMode) {
    if (toggle) toggle.checked = true;
    banner.querySelector('.banner-msg').textContent = 'Mode Simulasi Manual Aktif.';
    banner.classList.add('active');
  } else if (isAutoDemoFallback) {
    if (toggle) toggle.checked = true;
    banner.querySelector('.banner-msg').textContent = 'Backend FastAPI belum terhubung. Menjalankan Mode Simulasi Realtime.';
    banner.classList.add('active');
  } else {
    if (toggle) toggle.checked = false;
    banner.classList.remove('active');
  }
}

/**
 * Fetches router status, config & interface cards data (RX/TX bps)
 */
async function fetchDashboardData() {
  if (isManualDemoMode) {
    handleDemoCardsUpdate();
    return;
  }

  try {
    const [configRes, statusRes, interfacesRes] = await Promise.all([
      fetch('/api/config').catch(() => null),
      fetch('/api/status').catch(() => null),
      fetch('/api/interfaces').catch(() => null)
    ]);

    if (!configRes || !configRes.ok || !statusRes || !statusRes.ok || !interfacesRes || !interfacesRes.ok) {
      isAutoDemoFallback = true;
      updateOfflineBanner();
      handleDemoCardsUpdate();
      return;
    }

    if (isAutoDemoFallback) {
      isAutoDemoFallback = false;
      updateOfflineBanner();
    }

    const configData = await configRes.json();
    const statusData = await statusRes.json();
    const interfacesData = await interfacesRes.json();

    // Hot-reload dynamic config from .env if updated
    updateConfigIfChanged(configData);

    updateStatusUI(statusData.mikrotik, statusData.last_update);
    updateInterfacesUI(interfacesData.interfaces);

  } catch (err) {
    isAutoDemoFallback = true;
    updateOfflineBanner();
    handleDemoCardsUpdate();
  }
}

function updateStatusUI(status, lastUpdateStr) {
  const statusPill = document.getElementById('mikrotikStatusPill');
  const statusText = document.getElementById('mikrotikStatusText');
  const lastUpdateEl = document.getElementById('lastUpdateTime');
  const offlineBanner = document.getElementById('offlineBanner');

  const formattedTime = lastUpdateStr ? formatTimestamp(lastUpdateStr) : new Date().toLocaleTimeString('id-ID');

  if (status === 'online') {
    if (statusPill) statusPill.className = 'status-pill online';
    if (statusText) statusText.textContent = 'ONLINE';
    lastSuccessfulUpdate = formattedTime;
    if (offlineBanner && !isManualDemoMode && !isAutoDemoFallback) offlineBanner.classList.remove('active');
  } else if (status === 'offline') {
    if (statusPill) statusPill.className = 'status-pill offline';
    if (statusText) statusText.textContent = 'OFFLINE';
    if (offlineBanner) {
      offlineBanner.querySelector('.banner-msg').textContent = `MIKROTIK OFFLINE. Data snapshot terakhir: ${lastSuccessfulUpdate || formattedTime}`;
      offlineBanner.classList.add('active');
    }
  } else {
    if (statusPill) statusPill.className = 'status-pill connecting';
    if (statusText) statusText.textContent = 'CONNECTING';
  }

  if (lastUpdateEl) lastUpdateEl.textContent = formattedTime;
}

function formatTimestamp(isoStr) {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleTimeString('id-ID', { hour12: false });
  } catch (e) {
    return isoStr;
  }
}

function updateInterfacesUI(interfacesList) {
  if (!interfacesList || !Array.isArray(interfacesList)) return;

  interfacesList.forEach(iface => {
    const card = document.getElementById(`card-${iface.name}`);
    if (!card) return;

    const statusBadge = card.querySelector('.card-status');
    const rxValEl = card.querySelector('.rx-val');
    const rxUnitEl = card.querySelector('.rx-unit');
    const txValEl = card.querySelector('.tx-val');
    const txUnitEl = card.querySelector('.tx-unit');

    const statusUpper = (iface.status || 'UNKNOWN').toUpperCase();
    if (statusBadge) {
      statusBadge.textContent = statusUpper;
      statusBadge.className = statusUpper === 'RUNNING' ? 'card-status running' : 'card-status not_running';
    }

    const rxParsed = splitBandwidth(iface.rx_bps);
    const txParsed = splitBandwidth(iface.tx_bps);

    if (rxValEl) rxValEl.textContent = rxParsed.val;
    if (rxUnitEl) rxUnitEl.textContent = rxParsed.unit;
    if (txValEl) txValEl.textContent = txParsed.val;
    if (txUnitEl) txUnitEl.textContent = txParsed.unit;

    updateSparkline(iface.name, iface.rx_bps, iface.tx_bps);
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
  const colors = getInterfaceColors(ifaceName);

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
      ${rxPath ? `<path d="M ${rxPath}" fill="none" stroke="${colors.rx.line}" stroke-width="2" opacity="0.85"/>` : ''}
      ${txPath ? `<path d="M ${txPath}" fill="none" stroke="${colors.tx.line}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.85"/>` : ''}
    </svg>
  `;
}

/**
 * Initializes Chart.js instance
 */
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
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false
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
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
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
        line: { tension: 0.3, borderWidth: 2 },
        point: { radius: 0, hoverRadius: 5 }
      }
    }
  });
}

function setChartOverlay(show, message = '', type = 'loading') {
  const overlay = document.getElementById('chartOverlay');
  const msgEl = document.getElementById('overlayMessage');
  const spinner = document.getElementById('overlaySpinner');

  if (!overlay) return;

  if (show) {
    overlay.style.display = 'flex';
    if (msgEl) msgEl.textContent = message;
    if (spinner) spinner.style.display = type === 'loading' ? 'block' : 'none';
  } else {
    overlay.style.display = 'none';
  }
}

/**
 * Fetches & renders graph data from backend API /api/traffic
 */
async function fetchChartData(forceRefresh = false) {
  if (!trafficChart) return;

  if (currentMode === 'historical') {
    setChartOverlay(true, 'Loading historical traffic data...', 'loading');
  }

  let timeData = [];
  let isSuccess = false;

  if (isManualDemoMode || isAutoDemoFallback) {
    timeData = getDemoTrafficData(selectedInterfaceFilter, selectedPeriodFilter);
    isSuccess = true;
  } else {
    try {
      const url = `/api/traffic?interface=${encodeURIComponent(selectedInterfaceFilter)}&period=${encodeURIComponent(selectedPeriodFilter)}&mode=${currentMode}`;
      const res = await fetch(url);

      if (res.ok) {
        const json = await res.json();
        timeData = json.data || [];
        isSuccess = true;
      } else {
        timeData = getDemoTrafficData(selectedInterfaceFilter, selectedPeriodFilter);
        isSuccess = true;
      }
    } catch (err) {
      if (currentMode === 'historical') {
        setChartOverlay(true, 'Unable to load historical traffic data.', 'error');
        return;
      }
      timeData = getDemoTrafficData(selectedInterfaceFilter, selectedPeriodFilter);
      isSuccess = true;
    }
  }

  if (isSuccess) {
    const nowStr = new Date().toLocaleTimeString('id-ID');
    lastSnapshotTimestamp = nowStr;

    if (currentMode === 'historical') {
      const snapshotText = document.getElementById('snapshotTimeText');
      if (snapshotText) snapshotText.textContent = `Snapshot: ${nowStr}`;
    }

    if (timeData.length === 0) {
      setChartOverlay(true, 'No traffic data available for this period.', 'empty');
      trafficChart.data.labels = [];
      trafficChart.data.datasets = [];
      trafficChart.update('none');
      return;
    }

    setChartOverlay(false);

    const labels = timeData.map(item => {
      const d = new Date(item.timestamp);
      return isNaN(d.getTime()) ? item.timestamp : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });

    const datasets = [];

    if (selectedInterfaceFilter === 'all') {
      monitoredInterfaces.forEach(iface => {
        const colors = getInterfaceColors(iface);
        datasets.push({
          label: `${iface} (RX)`,
          data: timeData.map(item => item[iface] ? item[iface].rx_bps : (item.rx_bps || 0)),
          borderColor: colors.rx.line,
          backgroundColor: colors.rx.bg,
          fill: false
        });
        datasets.push({
          label: `${iface} (TX)`,
          data: timeData.map(item => item[iface] ? item[iface].tx_bps : (item.tx_bps || 0)),
          borderColor: colors.tx.line,
          borderDash: [4, 4],
          backgroundColor: colors.tx.bg,
          fill: false
        });
      });
    } else {
      const colors = getInterfaceColors(selectedInterfaceFilter);
      datasets.push({
        label: `${selectedInterfaceFilter} Download (RX)`,
        data: timeData.map(item => item.rx_bps || 0),
        borderColor: colors.rx.line,
        backgroundColor: colors.rx.bg,
        fill: true
      });
      datasets.push({
        label: `${selectedInterfaceFilter} Upload (TX)`,
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
}

/**
 * Demo / Simulation Mode Generators
 */
function handleDemoCardsUpdate() {
  const now = new Date();
  const interfacesData = monitoredInterfaces.map((iface, i) => {
    const baseRx = 80000000 + (i * 30000000);
    const baseTx = 10000000 + (i * 5000000);
    const rx = Math.floor(baseRx + Math.random() * 25000000);
    const tx = Math.floor(baseTx + Math.random() * 4000000);
    return { name: iface, status: 'running', rx_bps: rx, tx_bps: tx };
  });

  pushMockHistory(now.toISOString(), interfacesData);
  updateStatusUI('online', now.toISOString());
  updateInterfacesUI(interfacesData);
}

function pushMockHistory(timestamp, interfacesData) {
  const entry = { timestamp };
  interfacesData.forEach(iface => {
    entry[iface.name] = { rx_bps: iface.rx_bps, tx_bps: iface.tx_bps };
  });

  mockHistoricalPoints.push(entry);

  if (mockHistoricalPoints.length > 500) {
    mockHistoricalPoints.shift();
  }
}

function getDemoTrafficData(ifaceFilter, periodStr) {
  if (mockHistoricalPoints.length === 0) {
    const now = Date.now();
    const periodSec = parsePeriodToSeconds(periodStr);
    const stepSec = Math.max(5, Math.floor(periodSec / 60));
    const totalPoints = 60;

    for (let i = totalPoints; i >= 0; i--) {
      const t = new Date(now - i * stepSec * 1000).toISOString();
      const interfacesData = monitoredInterfaces.map((iface, idx) => ({
        name: iface,
        rx_bps: Math.floor(60000000 + (idx * 40000000) + Math.random() * 30000000),
        tx_bps: Math.floor(8000000 + (idx * 5000000) + Math.random() * 5000000)
      }));
      pushMockHistory(t, interfacesData);
    }
  }

  const raw = mockHistoricalPoints;
  if (ifaceFilter === 'all') {
    return raw;
  }

  return raw.map(pt => ({
    timestamp: pt.timestamp,
    rx_bps: pt[ifaceFilter] ? pt[ifaceFilter].rx_bps : 0,
    tx_bps: pt[ifaceFilter] ? pt[ifaceFilter].tx_bps : 0
  }));
}
