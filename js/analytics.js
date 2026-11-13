/**
 * AIRCLASS - Analytics Dashboard Controller
 * Mengelola 8 grafik historis mandiri dari ThingSpeak Channel A (Field 1 - Field 8)
 */

class AnalyticsController {
  constructor() {
    this.charts = {};
    this.currentRangeMinutes = 60;
    this.isLoading = false;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this.bindEvents();
    this.initAllCharts();
    this.isInitialized = true;
  }

  bindEvents() {
    // Tombol Filter Rentang Waktu (1 Jam, 6 Jam, 12 Jam, 24 Jam)
    const filterButtons = document.querySelectorAll('.analytics-range-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isLoading) return;
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRangeMinutes = parseInt(btn.dataset.minutes, 10) || 60;
        this.loadHistoricalData(this.currentRangeMinutes);
      });
    });

    // Tombol Refresh Manual Analytics
    const refreshBtn = document.getElementById('btn-refresh-analytics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadHistoricalData(this.currentRangeMinutes);
      });
    }
  }

  /**
   * Membuat konfigurasi dasar Chart.js yang konsisten dengan tema Dark Navy
   */
  getBaseChartConfig(yAxisConfig, isStepped = false) {
    return {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#38bdf8',
            bodyColor: '#f8fafc',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              maxTicksLimit: 8,
              maxRotation: 0
            }
          },
          y: {
            ...yAxisConfig,
            grid: { color: 'rgba(255, 255, 255, 0.06)', drawBorder: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              ...(yAxisConfig.ticks || {})
            }
          }
        },
        elements: {
          point: { radius: isStepped ? 3 : 2, hoverRadius: 6 },
          line: { borderWidth: 2, tension: isStepped ? 0 : 0.3 }
        }
      }
    };
  }

  /**
   * Inisialisasi kedelapan grafik secara terpisah
   */
  initAllCharts() {
    if (typeof Chart === 'undefined') {
      console.error('Chart.js belum dimuat!');
      return;
    }

    // ==========================================
    // BAGIAN A: PARAMETER LINGKUNGAN (1 - 4)
    // ==========================================

    // 1. Suhu (Field 1)
    const ctxTemp = document.getElementById('chart-history-temp');
    if (ctxTemp) {
      const cfg = this.getBaseChartConfig({
        title: { display: true, text: 'Suhu (°C)', color: '#94a3b8', font: { size: 12 } }
      });
      cfg.data.datasets = [{
        label: 'Suhu (°C)',
        data: [],
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.12)',
        fill: true
      }];
      this.charts.temp = new Chart(ctxTemp, cfg);
    }

    // 2. Kelembapan (Field 2)
    const ctxHum = document.getElementById('chart-history-hum');
    if (ctxHum) {
      const cfg = this.getBaseChartConfig({
        title: { display: true, text: 'Kelembapan (%RH)', color: '#94a3b8', font: { size: 12 } },
        min: 0,
        max: 100
      });
      cfg.data.datasets = [{
        label: 'Kelembapan (%RH)',
        data: [],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        fill: true
      }];
      this.charts.hum = new Chart(ctxHum, cfg);
    }

    // 3. Indeks Gas (Field 3)
    const ctxGas = document.getElementById('chart-history-gas');
    if (ctxGas) {
      const cfg = this.getBaseChartConfig({
        title: { display: true, text: 'Indeks Gas (0–100)', color: '#94a3b8', font: { size: 12 } },
        min: 0,
        max: 100
      });
      cfg.data.datasets = [{
        label: 'Indeks Gas',
        data: [],
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        fill: true
      }];
      this.charts.gas = new Chart(ctxGas, cfg);
    }

    // 4. Debu (Field 4)
    const ctxDust = document.getElementById('chart-history-dust');
    if (ctxDust) {
      const cfg = this.getBaseChartConfig({
        title: { display: true, text: 'Debu (µg/m³)', color: '#94a3b8', font: { size: 12 } },
        min: 0
      });
      cfg.data.datasets = [{
        label: 'Debu (µg/m³)',
        data: [],
        borderColor: '#eab308',
        backgroundColor: 'rgba(234, 179, 8, 0.12)',
        fill: true
      }];
      this.charts.dust = new Chart(ctxDust, cfg);
    }

    // ==========================================
    // BAGIAN B: RIWAYAT OPERASIONAL SISTEM (5 - 8)
    // ==========================================

    // 5. Status Kualitas Udara (Field 5, Step Chart: 0=Baik, 1=Sedang, 2=Buruk)
    const ctxStatus = document.getElementById('chart-history-status');
    if (ctxStatus) {
      const cfg = this.getBaseChartConfig({
        min: -0.2,
        max: 2.2,
        ticks: {
          stepSize: 1,
          callback: (v) => {
            if (v === 0) return 'BAIK';
            if (v === 1) return 'SEDANG';
            if (v === 2) return 'BURUK';
            return '';
          }
        }
      }, true);
      cfg.data.datasets = [{
        label: 'Status Kualitas Udara',
        data: [],
        stepped: true,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        fill: true,
        segment: {
          borderColor: ctx => {
            const val = ctx.p1.parsed.y;
            if (val >= 2) return '#ef4444';
            if (val >= 1) return '#f59e0b';
            return '#10b981';
          },
          backgroundColor: ctx => {
            const val = ctx.p1.parsed.y;
            if (val >= 2) return 'rgba(239, 68, 68, 0.15)';
            if (val >= 1) return 'rgba(245, 158, 11, 0.15)';
            return 'rgba(16, 185, 129, 0.15)';
          }
        }
      }];
      cfg.options.plugins.tooltip.callbacks = {
        label: (item) => {
          const v = item.parsed.y;
          return `Status: ${v === 0 ? 'BAIK' : (v === 1 ? 'SEDANG' : 'BURUK')}`;
        }
      };
      this.charts.status = new Chart(ctxStatus, cfg);
    }

    // 6. Kipas Exhaust (Field 6, Step Chart: 0=OFF, 1=ON)
    const ctxFan = document.getElementById('chart-history-fan');
    if (ctxFan) {
      const cfg = this.getBaseChartConfig({
        min: -0.2,
        max: 1.2,
        ticks: {
          stepSize: 1,
          callback: (v) => {
            if (v === 0) return 'OFF';
            if (v === 1) return 'ON';
            return '';
          }
        }
      }, true);
      cfg.data.datasets = [{
        label: 'Kipas Exhaust',
        data: [],
        stepped: true,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        fill: true
      }];
      cfg.options.plugins.tooltip.callbacks = {
        label: (item) => `Kipas: ${item.parsed.y === 1 ? 'ON' : 'OFF'}`
      };
      this.charts.fan = new Chart(ctxFan, cfg);
    }

    // 7. Kehadiran Ruangan PIR (Field 7, Step Chart: 0=Tidak Terdeteksi, 1=Terdeteksi)
    const ctxOcc = document.getElementById('chart-history-occupancy');
    if (ctxOcc) {
      const cfg = this.getBaseChartConfig({
        min: -0.2,
        max: 1.2,
        ticks: {
          stepSize: 1,
          callback: (v) => {
            if (v === 0) return 'Tidak Terdeteksi';
            if (v === 1) return 'Terdeteksi';
            return '';
          }
        }
      }, true);
      cfg.data.datasets = [{
        label: 'Kehadiran Ruangan',
        data: [],
        stepped: true,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true
      }];
      cfg.options.plugins.tooltip.callbacks = {
        label: (item) => `Kehadiran: ${item.parsed.y === 1 ? 'Terdeteksi' : 'Tidak Terdeteksi'}`
      };
      this.charts.occupancy = new Chart(ctxOcc, cfg);
    }

    // 8. Mode Operasi (Field 8, Step Chart: 0=Otomatis, 1=Manual)
    const ctxMode = document.getElementById('chart-history-mode');
    if (ctxMode) {
      const cfg = this.getBaseChartConfig({
        min: -0.2,
        max: 1.2,
        ticks: {
          stepSize: 1,
          callback: (v) => {
            if (v === 0) return 'Otomatis';
            if (v === 1) return 'Manual';
            return '';
          }
        }
      }, true);
      cfg.data.datasets = [{
        label: 'Mode Operasi',
        data: [],
        stepped: true,
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
        fill: true
      }];
      cfg.options.plugins.tooltip.callbacks = {
        label: (item) => `Mode: ${item.parsed.y === 1 ? 'Manual' : 'Otomatis'}`
      };
      this.charts.mode = new Chart(ctxMode, cfg);
    }
  }

  /**
   * Mengambil data historis sesuai rentang filter dan merender seluruh 8 grafik
   */
  async loadHistoricalData(minutes = 60) {
    this.setLoadingState(true);
    const noticeEl = document.getElementById('analytics-notice');
    if (noticeEl) noticeEl.textContent = `Memuat data historis ${minutes} menit terakhir dari ThingSpeak...`;

    try {
      const result = await window.thingspeakService.fetchHistoricalTelemetry(minutes);
      
      if (!result || !result.feeds || result.feeds.length === 0) {
        this.setEmptyState(true);
        if (noticeEl) noticeEl.textContent = 'Belum ada data historis dalam rentang waktu yang dipilih.';
        return;
      }

      this.setEmptyState(false);
      const feeds = result.feeds;

      if (noticeEl) {
        if (result.isFallback) {
          noticeEl.textContent = `Menampilkan ${feeds.length} data riwayat terakhir dari Channel A (Mode Fallback).`;
        } else {
          noticeEl.textContent = `Menampilkan ${feeds.length} data sensor dalam rentang ${minutes} menit terakhir.`;
        }
      }

      // Format sumbu X: Waktu
      const labels = feeds.map(f => {
        const d = new Date(f.createdAt);
        // Format jam:menit[:detik]
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      });

      // Update 1: Suhu
      if (this.charts.temp) {
        const data = feeds.map(f => f.temp);
        this.charts.temp.data.labels = labels;
        this.charts.temp.data.datasets[0].data = data;
        this.charts.temp.update();
        this.updateStats('temp', data, '°C');
      }

      // Update 2: Kelembapan
      if (this.charts.hum) {
        const data = feeds.map(f => f.humidity);
        this.charts.hum.data.labels = labels;
        this.charts.hum.data.datasets[0].data = data;
        this.charts.hum.update();
        this.updateStats('hum', data, '%RH');
      }

      // Update 3: Gas
      if (this.charts.gas) {
        const data = feeds.map(f => f.gasIndex);
        this.charts.gas.data.labels = labels;
        this.charts.gas.data.datasets[0].data = data;
        this.charts.gas.update();
        this.updateStats('gas', data, '');
      }

      // Update 4: Debu
      if (this.charts.dust) {
        const data = feeds.map(f => f.dust);
        this.charts.dust.data.labels = labels;
        this.charts.dust.data.datasets[0].data = data;
        this.charts.dust.update();
        this.updateStats('dust', data, 'µg/m³');
      }

      // Update 5: Status Udara
      if (this.charts.status) {
        const data = feeds.map(f => f.airStatus);
        this.charts.status.data.labels = labels;
        this.charts.status.data.datasets[0].data = data;
        this.charts.status.update();
      }

      // Update 6: Kipas
      if (this.charts.fan) {
        const data = feeds.map(f => f.fanState ? 1 : 0);
        this.charts.fan.data.labels = labels;
        this.charts.fan.data.datasets[0].data = data;
        this.charts.fan.update();
      }

      // Update 7: Kehadiran
      if (this.charts.occupancy) {
        const data = feeds.map(f => f.occupancy ? 1 : 0);
        this.charts.occupancy.data.labels = labels;
        this.charts.occupancy.data.datasets[0].data = data;
        this.charts.occupancy.update();
      }

      // Update 8: Mode Operasi
      if (this.charts.mode) {
        const data = feeds.map(f => f.isManualMode ? 1 : 0);
        this.charts.mode.data.labels = labels;
        this.charts.mode.data.datasets[0].data = data;
        this.charts.mode.update();
      }

    } catch (err) {
      console.error('Error saat memuat data historis analytics:', err);
      if (noticeEl) noticeEl.textContent = `Gagal mengambil data dari ThingSpeak: ${err.message}`;
    } finally {
      this.setLoadingState(false);
    }
  }

  updateStats(param, values, unit) {
    if (!values || values.length === 0) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const last = values[values.length - 1];

    const elMin = document.getElementById(`stat-min-${param}`);
    const elMax = document.getElementById(`stat-max-${param}`);
    const elAvg = document.getElementById(`stat-avg-${param}`);
    const elLast = document.getElementById(`stat-last-${param}`);

    if (elMin) elMin.textContent = `${min.toFixed(1)} ${unit}`.trim();
    if (elMax) elMax.textContent = `${max.toFixed(1)} ${unit}`.trim();
    if (elAvg) elAvg.textContent = `${avg.toFixed(1)} ${unit}`.trim();
    if (elLast) elLast.textContent = `${last.toFixed(1)} ${unit}`.trim();
  }

  setLoadingState(loading) {
    this.isLoading = loading;
    const loaders = document.querySelectorAll('.chart-loading-overlay');
    loaders.forEach(l => {
      l.style.display = loading ? 'flex' : 'none';
    });
  }

  setEmptyState(empty) {
    const emptyElements = document.querySelectorAll('.chart-empty-state');
    emptyElements.forEach(e => {
      e.style.display = empty ? 'flex' : 'none';
    });
  }
}

// Global instance
window.analyticsController = new AnalyticsController();

