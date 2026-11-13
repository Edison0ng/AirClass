/**
 * AIRCLASS - Main Application Coordinator
 * Mengelola navigasi tab, polling telemetri otomatis, status koneksi perangkat, dan modal dialog
 */

class AirClassApp {
  constructor() {
    this.pollTimer = null;
    this.countdownTimer = null;
    this.remainingSeconds = 20;
    this.currentTab = 'home';
    this.lastSuccessfulFetch = null;
  }

  init() {
    this.initNavigation();
    this.initModals();
    this.initRefreshButton();

    // Inisialisasi controller anak
    window.homeController.init();

    // Pengambilan data pertama kali
    this.fetchData();

    // Mulai siklus polling berkala
    this.startPolling();
  }

  /**
   * Pengaturan Navigasi Tab (Home vs Analytics)
   */
  initNavigation() {
    const navItems = document.querySelectorAll('.nav-menu-item[data-tab]');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Handle link langsung dari Home ke Analytics
    const linkToAnalytics = document.getElementById('link-to-analytics');
    if (linkToAnalytics) {
      linkToAnalytics.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab('analytics');
      });
    }
  }

  switchTab(tabName) {
    if (this.currentTab === tabName) return;
    this.currentTab = tabName;

    // Update active nav button
    document.querySelectorAll('.nav-menu-item[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab visibility
    const tabHome = document.getElementById('tab-home');
    const tabAnalytics = document.getElementById('tab-analytics');

    if (tabName === 'home') {
      if (tabHome) tabHome.style.display = 'block';
      if (tabAnalytics) tabAnalytics.style.display = 'none';
    } else if (tabName === 'analytics') {
      if (tabHome) tabHome.style.display = 'none';
      if (tabAnalytics) tabAnalytics.style.display = 'block';

      // Inisialisasi dan load data historis jika belum pernah
      window.analyticsController.init();
      window.analyticsController.loadHistoricalData(window.analyticsController.currentRangeMinutes);
    }

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Mengatur Modal Pengaturan dan Informasi
   */
  initModals() {
    // Tombol pembuka modal
    const btnOpenSettings = document.getElementById('nav-btn-settings');
    const btnOpenAbout = document.getElementById('nav-btn-about');

    const modalSettings = document.getElementById('modal-settings');
    const modalAbout = document.getElementById('modal-about');

    const closeButtons = document.querySelectorAll('.modal-close-btn, .modal-backdrop');

    if (btnOpenSettings && modalSettings) {
      btnOpenSettings.addEventListener('click', () => {
        this.populateSettingsForm();
        modalSettings.classList.add('modal-open');
      });
    }

    if (btnOpenAbout && modalAbout) {
      btnOpenAbout.addEventListener('click', () => {
        modalAbout.classList.add('modal-open');
      });
    }

    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (modalSettings) modalSettings.classList.remove('modal-open');
        if (modalAbout) modalAbout.classList.remove('modal-open');
      });
    });

    // Form Pengaturan Simpan & Reset
    const formSettings = document.getElementById('form-settings');
    if (formSettings) {
      formSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }

    const btnResetSettings = document.getElementById('btn-reset-settings');
    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', () => {
        if (confirm('Kembalikan konfigurasi ke nilai bawaan?')) {
          window.airclassConfig.resetConfig();
          this.populateSettingsForm();
          this.showToast('Konfigurasi dikembalikan ke bawaan.', 'info');
          this.fetchData();
        }
      });
    }
  }

  populateSettingsForm() {
    const cfg = window.airclassConfig.get();
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('cfg-channel-a-id', cfg.channelAId);
    setVal('cfg-channel-a-read', cfg.channelAReadKey);
    setVal('cfg-channel-a-write', cfg.channelAWriteKey);
    setVal('cfg-channel-b-id', cfg.channelBId);
    setVal('cfg-channel-b-read', cfg.channelBReadKey);
    setVal('cfg-channel-b-write', cfg.channelBWriteKey);
  }

  saveSettings() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const newConfig = {
      channelAId: getVal('cfg-channel-a-id'),
      channelAReadKey: getVal('cfg-channel-a-read'),
      channelAWriteKey: getVal('cfg-channel-a-write'),
      channelBId: getVal('cfg-channel-b-id'),
      channelBReadKey: getVal('cfg-channel-b-read'),
      channelBWriteKey: getVal('cfg-channel-b-write')
    };

    window.airclassConfig.saveConfig(newConfig);
    const modalSettings = document.getElementById('modal-settings');
    if (modalSettings) modalSettings.classList.remove('modal-open');
    this.showToast('Pengaturan berhasil disimpan!', 'success');
    
    // Refresh data dengan konfigurasi baru
    this.fetchData();
    if (this.currentTab === 'analytics') {
      window.analyticsController.loadHistoricalData(window.analyticsController.currentRangeMinutes);
    }
  }

  /**
   * Tombol Manual Refresh
   */
  initRefreshButton() {
    const btn = document.getElementById('btn-manual-refresh');
    if (btn) {
      btn.addEventListener('click', () => {
        btn.classList.add('rotating');
        this.fetchData().finally(() => {
          setTimeout(() => btn.classList.remove('rotating'), 600);
        });
      });
    }
  }

  /**
   * Polling berkala
   */
  startPolling() {
    const cfg = window.airclassConfig.get();
    const intervalSec = Math.round((cfg.refreshInterval || 20000) / 1000);
    this.remainingSeconds = intervalSec;

    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);

    // Timer hitung mundur di UI
    this.countdownTimer = setInterval(() => {
      this.remainingSeconds--;
      const timerEl = document.getElementById('poll-countdown');
      if (timerEl) {
        timerEl.textContent = `${this.remainingSeconds}s`;
      }
      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = intervalSec;
      }
    }, 1000);

    // Timer Fetch
    this.pollTimer = setInterval(() => {
      this.fetchData();
    }, cfg.refreshInterval || 20000);
  }

  /**
   * Mengambil data terbaru dari ThingSpeak
   */
  async fetchData() {
    const cfg = window.airclassConfig.get();
    try {
      const data = await window.thingspeakService.fetchLatestTelemetry();
      this.lastSuccessfulFetch = Date.now();
      
      // Update UI Home
      window.homeController.updateTelemetry(data);
      
      // Update preview chart pada Home jika sedang di tab Home
      if (this.currentTab === 'home') {
        window.homeController.updatePreviewCharts(window.homeController.previewRangeMinutes);
      }

      // Update badge status koneksi
      this.updateConnectionBadges(true, data.createdAt);
      this.updateLastUpdateText(data.createdAt);

    } catch (err) {
      console.warn('Gagal memperbarui telemetri:', err);
      this.updateConnectionBadges(false, null);
      this.showToast(`Koneksi ThingSpeak: ${err.message}`, 'error');
    }
  }

  /**
   * Update Status Badges di Top Header
   */
  updateConnectionBadges(isThingSpeakConnected, lastDataTimestamp) {
    const badgeTs = document.getElementById('badge-ts-connected');
    const badgeEsp = document.getElementById('badge-esp-connected');
    const badgeSys = document.getElementById('badge-sys-online');

    // 1. ThingSpeak Status
    if (badgeTs) {
      if (isThingSpeakConnected) {
        badgeTs.className = 'status-pill-header pill-connected';
        badgeTs.innerHTML = '<span class="pill-dot"></span><span>ThingSpeak Connected</span>';
      } else {
        badgeTs.className = 'status-pill-header pill-disconnected';
        badgeTs.innerHTML = '<span class="pill-dot"></span><span>ThingSpeak Disconnected</span>';
      }
    }

    // 2. System Status
    if (badgeSys) {
      badgeSys.className = 'status-pill-header pill-online';
      badgeSys.innerHTML = '<span class="pill-dot"></span><span>System Online</span>';
    }

    // 3. ESP32 Connection Status
    if (badgeEsp) {
      if (!isThingSpeakConnected || !lastDataTimestamp) {
        badgeEsp.className = 'status-pill-header pill-unknown';
        badgeEsp.innerHTML = '<span class="pill-dot"></span><span>ESP32 Unknown</span>';
        return;
      }

      const cfg = window.airclassConfig.get();
      const ageMs = Date.now() - new Date(lastDataTimestamp).getTime();

      if (ageMs < (cfg.esp32Timeout || 90000)) {
        badgeEsp.className = 'status-pill-header pill-connected';
        badgeEsp.innerHTML = '<span class="pill-dot"></span><span>ESP32 Connected</span>';
      } else if (ageMs < 300000) { // < 5 menit
        badgeEsp.className = 'status-pill-header pill-standby';
        badgeEsp.innerHTML = '<span class="pill-dot"></span><span>ESP32 Standby</span>';
      } else {
        badgeEsp.className = 'status-pill-header pill-offline';
        badgeEsp.innerHTML = '<span class="pill-dot"></span><span>ESP32 Offline</span>';
      }
    }
  }

  updateLastUpdateText(timestamp) {
    const el = document.getElementById('header-last-update');
    if (!el) return;

    if (!timestamp) {
      el.textContent = 'Belum ada data';
      return;
    }

    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    el.textContent = `${dateStr}, ${timeStr}`;
  }

  /**
   * Sistem Toast Notification yang Elegan
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    let icon = 'ℹ';
    if (type === 'success') icon = '✔';
    if (type === 'warning') icon = '⚠';
    if (type === 'error') icon = '✖';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }
}

// Inisialisasi saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  window.airclassApp = new AirClassApp();
  window.airclassApp.init();
});

