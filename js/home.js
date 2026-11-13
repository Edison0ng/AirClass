/**
 * AIRCLASS - Home Dashboard Controller
 * Mengelola pembaruan tampilan antarmuka tab Home (realtime telemetry, hero card, cards, fan control, occupancy)
 */

class HomeController {
  constructor() {
    this.latestData = null;
    this.latestCommand = null;
    this.isCommandPending = false;
    this.previewCharts = {};
    this.previewRangeMinutes = 60;
  }

  init() {
    this.bindEvents();
    this.initPreviewCharts();
  }

  bindEvents() {
    // Mode Switch buttons
    const btnModeAuto = document.getElementById('btn-mode-auto');
    const btnModeManual = document.getElementById('btn-mode-manual');
    const btnFanOn = document.getElementById('btn-fan-on');
    const btnFanOff = document.getElementById('btn-fan-off');

    if (btnModeAuto) {
      btnModeAuto.addEventListener('click', () => this.handleModeChange(0));
    }
    if (btnModeManual) {
      btnModeManual.addEventListener('click', () => this.handleModeChange(1));
    }
    if (btnFanOn) {
      btnFanOn.addEventListener('click', () => this.handleFanControl(1));
    }
    if (btnFanOff) {
      btnFanOff.addEventListener('click', () => this.handleFanControl(0));
    }

    // Mini Trend Range Filters on Home
    const rangeButtons = document.querySelectorAll('.home-range-btn');
    rangeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        rangeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mins = parseInt(btn.dataset.minutes, 10) || 60;
        this.previewRangeMinutes = mins;
        this.updatePreviewCharts(mins);
      });
    });
  }

  /**
   * Memperbarui antarmuka Home dari data telemetri terbaru Channel A
   */
  updateTelemetry(data) {
    if (!data) return;
    this.latestData = data;

    // 1. Update Air Quality Overview Hero Card
    this.renderAirQualityOverview(data);

    // 2. Update 4 Sensor Monitoring Cards
    this.renderSensorCards(data);

    // 3. Update Fan Status & Ventilation Control
    this.renderVentilationControl(data);

    // 4. Update Occupancy Panel
    this.renderOccupancy(data);

    // 5. Update Status Perangkat & Informasi Sistem
    this.renderSystemInfo(data);
  }

  /**
   * Update Air Quality Hero Card
   */
  renderAirQualityOverview(data) {
    const badgeEl = document.getElementById('hero-status-badge');
    const titleEl = document.getElementById('hero-status-title');
    const descEl = document.getElementById('hero-status-desc');
    const ringEl = document.getElementById('hero-status-ring');

    const checkTemp = document.getElementById('check-temp');
    const checkHum = document.getElementById('check-hum');
    const checkGas = document.getElementById('check-gas');
    const checkDust = document.getElementById('check-dust');

    let statusText = 'BAIK';
    let statusClass = 'status-baik';
    let headline = 'Udara Sehat!';
    let description = 'Kondisi kualitas udara ruang belajar saat ini baik dan aman untuk aktivitas belajar.';

    if (data.airStatus === 1) {
      statusText = 'SEDANG';
      statusClass = 'status-sedang';
      headline = 'Perlu Perhatian!';
      description = 'Kualitas udara dalam kategori sedang. Satu atau lebih parameter berada di luar rentang optimal.';
    } else if (data.airStatus === 2) {
      statusText = 'BURUK';
      statusClass = 'status-buruk';
      headline = 'Kualitas Udara Buruk!';
      description = 'Peringatan: Kadar gas atau debu melebihi batas aman! Kipas exhaust otomatis aktif & buzzer berbunyi.';
    }

    if (badgeEl) {
      badgeEl.textContent = statusText;
      badgeEl.className = `status-text-badge ${statusClass}`;
    }

    if (ringEl) {
      ringEl.className = `status-ring-container ${statusClass}`;
    }

    if (titleEl) titleEl.textContent = headline;
    if (descEl) descEl.textContent = description;

    // Checklist kondisi sensor
    const isTempOk = data.temp >= 18 && data.temp <= 30;
    const isHumOk = data.humidity >= 40 && data.humidity <= 65;
    const isGasOk = data.gasIndex <= 40;
    const isDustOk = data.dust <= 75;

    this.setChecklistState(checkTemp, isTempOk, 
      isTempOk ? `Suhu dalam rentang normal (${data.temp} °C)` : `Suhu di luar rentang normal (${data.temp} °C)`);
    this.setChecklistState(checkHum, isHumOk, 
      isHumOk ? `Kelembapan ideal (${data.humidity} %RH)` : `Kelembapan di luar rentang ideal (${data.humidity} %RH)`);
    this.setChecklistState(checkGas, isGasOk, 
      data.gasIndex <= 40 ? `Gas dalam batas aman (${data.gasIndex}/100)` : (data.gasIndex <= 70 ? `Gas sedang (${data.gasIndex}/100)` : `Gas BAHAYA (${data.gasIndex}/100)`));
    this.setChecklistState(checkDust, isDustOk, 
      data.dust <= 75 ? `Debu dalam batas aman (${data.dust} µg/m³)` : (data.dust <= 150 ? `Debu sedang (${data.dust} µg/m³)` : `Debu BAHAYA (${data.dust} µg/m³)`));
  }

  setChecklistState(element, isOk, text) {
    if (!element) return;
    element.innerHTML = `
      <span class="check-icon ${isOk ? 'icon-ok' : 'icon-warn'}">
        ${isOk ? '✔' : '⚠'}
      </span>
      <span class="check-label">${text}</span>
    `;
  }

  /**
   * Render 4 Kartu Sensor
   */
  renderSensorCards(data) {
    // 1. Suhu
    const valTemp = document.getElementById('card-val-temp');
    const badgeTemp = document.getElementById('card-badge-temp');
    if (valTemp) valTemp.textContent = `${data.temp.toFixed(1)} °C`;
    if (badgeTemp) {
      const isOk = data.temp >= 18 && data.temp <= 30;
      badgeTemp.textContent = isOk ? '● Normal' : '● Di Luar Rentang';
      badgeTemp.className = `card-badge ${isOk ? 'badge-normal' : 'badge-warning'}`;
    }

    // 2. Kelembapan
    const valHum = document.getElementById('card-val-hum');
    const badgeHum = document.getElementById('card-badge-hum');
    if (valHum) valHum.textContent = `${data.humidity.toFixed(1)} %`;
    if (badgeHum) {
      const isOk = data.humidity >= 40 && data.humidity <= 65;
      badgeHum.textContent = isOk ? '● Normal' : '● Di Luar Rentang';
      badgeHum.className = `card-badge ${isOk ? 'badge-normal' : 'badge-warning'}`;
    }

    // 3. Indeks Gas
    const valGas = document.getElementById('card-val-gas');
    const badgeGas = document.getElementById('card-badge-gas');
    if (valGas) valGas.textContent = `${data.gasIndex} / 100`;
    if (badgeGas) {
      if (data.gasIndex <= 40) {
        badgeGas.textContent = '● Normal';
        badgeGas.className = 'card-badge badge-normal';
      } else if (data.gasIndex <= 70) {
        badgeGas.textContent = '● Sedang';
        badgeGas.className = 'card-badge badge-warning';
      } else {
        badgeGas.textContent = '● Bahaya';
        badgeGas.className = 'card-badge badge-danger';
      }
    }

    // 4. Debu
    const valDust = document.getElementById('card-val-dust');
    const badgeDust = document.getElementById('card-badge-dust');
    if (valDust) valDust.textContent = `${data.dust} µg/m³`;
    if (badgeDust) {
      if (data.dust <= 75) {
        badgeDust.textContent = '● Normal';
        badgeDust.className = 'card-badge badge-normal';
      } else if (data.dust <= 150) {
        badgeDust.textContent = '● Sedang';
        badgeDust.className = 'card-badge badge-warning';
      } else {
        badgeDust.textContent = '● Bahaya';
        badgeDust.className = 'card-badge badge-danger';
      }
    }
  }

  /**
   * Render Ventilation Control (Revisi Logika Kipas Otomatis)
   */
  renderVentilationControl(data) {
    const isManual = data.isManualMode;
    const isFanOn = data.fanState;
    const airStatus = data.airStatus; // 0=Baik, 1=Sedang, 2=Buruk

    // 1. Update Mode Tag & Air Status Tag di Header Kartu Kendali
    const fanModeTag = document.getElementById('fan-mode-tag');
    const fanAirTag = document.getElementById('fan-air-tag');

    if (fanModeTag) {
      if (isManual) {
        fanModeTag.textContent = 'MANUAL MODE';
        fanModeTag.className = 'badge-status-mode pill-mode-manual';
      } else {
        fanModeTag.textContent = 'AUTOMATIC MODE';
        fanModeTag.className = 'badge-status-mode pill-mode-auto';
      }
    }

    if (fanAirTag) {
      if (airStatus === 0) {
        fanAirTag.textContent = 'UDARA: BAIK';
        fanAirTag.className = 'badge-status-air pill-air-baik';
      } else if (airStatus === 1) {
        fanAirTag.textContent = 'UDARA: SEDANG';
        fanAirTag.className = 'badge-status-air pill-air-sedang';
      } else {
        fanAirTag.textContent = 'UDARA: BURUK';
        fanAirTag.className = 'badge-status-air pill-air-buruk';
      }
    }

    // 2. Update Mode Toggle Buttons
    const btnAuto = document.getElementById('btn-mode-auto');
    const btnManual = document.getElementById('btn-mode-manual');
    if (btnAuto && btnManual) {
      if (isManual) {
        btnAuto.classList.remove('active');
        btnManual.classList.add('active');
      } else {
        btnAuto.classList.add('active');
        btnManual.classList.remove('active');
      }
    }

    // 3. Update Action Buttons (Fan ON / Fan OFF)
    // Tombol hanya aktif jika Mode Manual
    const btnFanOn = document.getElementById('btn-fan-on');
    const btnFanOff = document.getElementById('btn-fan-off');
    const fanControlNotice = document.getElementById('fan-control-notice');

    if (btnFanOn && btnFanOff) {
      btnFanOn.disabled = !isManual || this.isCommandPending;
      btnFanOff.disabled = !isManual || this.isCommandPending;

      if (isManual) {
        btnFanOn.classList.toggle('active-on', isFanOn);
        btnFanOff.classList.toggle('active-off', !isFanOn);
      } else {
        btnFanOn.classList.remove('active-on');
        btnFanOff.classList.remove('active-off');
      }
    }

    if (fanControlNotice) {
      if (isManual) {
        fanControlNotice.textContent = 'Mode Manual aktif. Anda dapat mengontrol kipas secara langsung. Buzzer keselamatan tetap aktif jika terdeteksi status BURUK.';
        fanControlNotice.className = 'control-notice notice-manual';
      } else {
        fanControlNotice.textContent = 'Mode Otomatis aktif. Kipas otomatis menyala saat status SEDANG atau BURUK, dan mati setelah kondisi BAIK bertahan 60 detik.';
        fanControlNotice.className = 'control-notice notice-auto';
      }
    }

    // 4. Animated Fan Graphic & Status Headline
    const fanGraphic = document.getElementById('fan-icon-graphic');
    const fanStatusText = document.getElementById('fan-status-text');
    const fanStateBadge = document.getElementById('fan-state-badge');
    const fanTimerBadge = document.getElementById('fan-timer-badge');

    if (fanGraphic) {
      if (isFanOn) {
        fanGraphic.classList.add('fan-spinning');
      } else {
        fanGraphic.classList.remove('fan-spinning');
      }
    }

    if (fanStatusText) {
      fanStatusText.textContent = isFanOn ? 'Kipas ON' : 'Kipas OFF';
    }

    if (fanStateBadge) {
      fanStateBadge.textContent = isFanOn ? 'FAN ON' : 'FAN OFF';
      fanStateBadge.className = `fan-state-pill ${isFanOn ? 'pill-active' : 'pill-standby'}`;
    }

    // 5. Timer Badge & Indikator Histeresis (MENUNGGU 60 DETIK)
    if (fanTimerBadge) {
      if (!isManual && airStatus === 0 && isFanOn) {
        // Kondisi udara sudah BAIK namun kipas masih ON (sedang menghitung timer histeresis 60 detik)
        fanTimerBadge.textContent = 'MENUNGGU 60 DETIK';
        fanTimerBadge.className = 'fan-timer-pill pill-waiting-timer';
      } else {
        fanTimerBadge.className = 'fan-timer-pill pill-timer-hidden';
      }
    }

    // 6. Penjelasan Alasan Kipas Menyala atau Mati (Reason Box)
    const reasonIcon = document.getElementById('fan-reason-icon');
    const reasonText = document.getElementById('fan-reason-text');

    if (reasonText && reasonIcon) {
      if (isManual) {
        reasonIcon.textContent = '🎮';
        reasonText.textContent = `Mode Manual: Kipas dikendalikan pengguna melalui dashboard (${isFanOn ? 'Kipas ON' : 'Kipas OFF'}).`;
      } else {
        // Mode Otomatis
        if (airStatus === 0) {
          if (isFanOn) {
            reasonIcon.textContent = '⏳';
            reasonText.textContent = 'Status BAIK: Menunggu kondisi BAIK stabil selama 60 detik sebelum kipas dimatikan oleh ESP32.';
          } else {
            reasonIcon.textContent = '✔';
            reasonText.textContent = 'Status BAIK: Kipas OFF (standby). Seluruh parameter kualitas udara dalam batas optimal.';
          }
        } else if (airStatus === 1) {
          reasonIcon.textContent = '🌪';
          reasonText.textContent = 'Status SEDANG: Kipas menyala untuk membantu ventilasi dan sirkulasi udara ruang belajar.';
        } else if (airStatus === 2) {
          reasonIcon.textContent = '🚨';
          reasonText.textContent = 'Status BURUK: Kipas menyala untuk membantu pembuangan udara tercemar (gas/debu). Alarm buzzer aktif!';
        }
      }
    }
  }

  /**
   * Render Occupancy
   */
  renderOccupancy(data) {
    const isOccupied = data.occupancy;
    const badgeEl = document.getElementById('occupancy-badge');
    const titleEl = document.getElementById('occupancy-title');
    const descEl = document.getElementById('occupancy-desc');
    const iconContainer = document.getElementById('occupancy-icon-box');

    if (badgeEl) {
      badgeEl.textContent = isOccupied ? 'TERDETEKSI' : 'KOSONG';
      badgeEl.className = `occupancy-pill ${isOccupied ? 'pill-occupied' : 'pill-empty'}`;
    }

    if (titleEl) {
      titleEl.textContent = isOccupied ? 'Ada Penghuni' : 'Ruangan Kosong';
    }

    if (descEl) {
      descEl.textContent = isOccupied 
        ? 'Gerakan terdeteksi oleh sensor PIR (jendela aktif 10 menit)' 
        : 'Tidak ada gerakan terdeteksi dalam 10 menit terakhir';
    }

    if (iconContainer) {
      iconContainer.className = `occupancy-icon-box ${isOccupied ? 'box-active' : 'box-idle'}`;
    }
  }

  /**
   * Render System Info & Status Perangkat
   */
  renderSystemInfo(data) {
    const devFan = document.getElementById('dev-status-fan');
    const devMode = document.getElementById('dev-status-mode');
    const devOcc = document.getElementById('dev-status-occupancy');

    if (devFan) {
      devFan.textContent = data.fanState ? 'ON' : 'OFF';
      devFan.className = `status-pill-small ${data.fanState ? 'pill-on' : 'pill-off'}`;
    }

    if (devMode) {
      devMode.textContent = data.isManualMode ? 'Manual' : 'Otomatis';
      devMode.className = `status-pill-small ${data.isManualMode ? 'pill-manual' : 'pill-auto'}`;
    }

    if (devOcc) {
      devOcc.textContent = data.occupancy ? 'Ada' : 'Kosong';
      devOcc.className = `status-pill-small ${data.occupancy ? 'pill-on' : 'pill-off'}`;
    }
  }

  /**
   * Handle Pergantian Mode (Otomatis vs Manual)
   */
  async handleModeChange(targetMode) {
    if (this.isCommandPending) return;

    const currentFanCommand = this.latestData ? (this.latestData.fanState ? 1 : 0) : 0;
    const modeName = targetMode === 1 ? 'Manual' : 'Otomatis';

    const confirmed = confirm(`Ubah mode sistem ke ${modeName.toUpperCase()}?\n\n` +
      (targetMode === 1 
        ? 'Dalam Mode Manual, kipas tidak lagi merespons otomatis terhadap kualitas udara dan harus dikendalikan secara manual.' 
        : 'Dalam Mode Otomatis, kipas akan kembali dikendalikan sepenuhnya oleh algoritma ESP32.'));
    
    if (!confirmed) return;

    await this.dispatchCommand(targetMode, currentFanCommand, `Mode sistem diubah ke ${modeName}`);
  }

  /**
   * Handle Pengendalian Kipas (ON vs OFF)
   */
  async handleFanControl(targetFan) {
    if (this.isCommandPending) return;

    if (!this.latestData || !this.latestData.isManualMode) {
      window.airclassApp.showToast('Kipas hanya dapat dikendalikan saat Mode Manual aktif!', 'warning');
      return;
    }

    const fanAction = targetFan === 1 ? 'MENYALAKAN (ON)' : 'MEMATIKAN (OFF)';
    const confirmed = confirm(`Kirim perintah untuk ${fanAction} kipas exhaust?`);
    if (!confirmed) return;

    await this.dispatchCommand(1, targetFan, `Perintah Kipas ${targetFan === 1 ? 'ON' : 'OFF'} terkirim`);
  }

  /**
   * Pengiriman perintah ke Channel B dengan animasi & feedback
   */
  async dispatchCommand(mode, fan, successMsg) {
    this.isCommandPending = true;
    this.updateCommandButtonStates(true);
    window.airclassApp.showToast('Mengirim perintah ke ThingSpeak Channel B...', 'info');

    try {
      const res = await window.thingspeakService.sendControlCommand(mode, fan);
      window.airclassApp.showToast(`✔ ${successMsg}! Menunggu konfirmasi ESP32 pada update berikutnya...`, 'success');
      
      // Berikan efek optimistic feedback sementara ESP32 membaca Channel B (siklus 15-20s)
      if (this.latestData) {
        this.latestData.isManualMode = (mode === 1);
        if (mode === 1) {
          // Kipas manual akan diupdate saat ESP32 mengeksekusi
        }
        this.renderVentilationControl(this.latestData);
      }
    } catch (err) {
      window.airclassApp.showToast(`Gagal mengirim perintah: ${err.message}`, 'error');
    } finally {
      this.isCommandPending = false;
      this.updateCommandButtonStates(false);
    }
  }

  updateCommandButtonStates(isPending) {
    const buttons = [
      document.getElementById('btn-mode-auto'),
      document.getElementById('btn-mode-manual'),
      document.getElementById('btn-fan-on'),
      document.getElementById('btn-fan-off')
    ];
    buttons.forEach(b => {
      if (b) {
        if (isPending) b.classList.add('btn-loading');
        else b.classList.remove('btn-loading');
      }
    });
  }

  /**
   * Inisialisasi Chart Preview pada Tab Home (sesuai Mockup)
   */
  initPreviewCharts() {
    if (typeof Chart === 'undefined') return;

    const commonLineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#38bdf8',
          bodyColor: '#f1f5f9',
          borderColor: '#1e293b',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 6 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        }
      },
      elements: {
        point: { radius: 2, hoverRadius: 5 },
        line: { tension: 0.3, borderWidth: 2 }
      }
    };

    // 1. Suhu Mini Chart
    const ctxTemp = document.getElementById('preview-chart-temp');
    if (ctxTemp) {
      this.previewCharts.temp = new Chart(ctxTemp, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Suhu (°C)', data: [], borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', fill: true }] },
        options: commonLineOptions
      });
    }

    // 2. Kelembapan Mini Chart
    const ctxHum = document.getElementById('preview-chart-hum');
    if (ctxHum) {
      this.previewCharts.hum = new Chart(ctxHum, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Kelembapan (%)', data: [], borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.1)', fill: true }] },
        options: commonLineOptions
      });
    }

    // 3. Indeks Gas Mini Chart
    const ctxGas = document.getElementById('preview-chart-gas');
    if (ctxGas) {
      this.previewCharts.gas = new Chart(ctxGas, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Gas (0-100)', data: [], borderColor: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.1)', fill: true }] },
        options: commonLineOptions
      });
    }

    // 4. Debu Mini Chart
    const ctxDust = document.getElementById('preview-chart-dust');
    if (ctxDust) {
      this.previewCharts.dust = new Chart(ctxDust, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Debu (µg/m³)', data: [], borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.1)', fill: true }] },
        options: commonLineOptions
      });
    }

    // 5. Riwayat Status Sistem (Step Chart Preview)
    const ctxStatus = document.getElementById('preview-chart-status');
    if (ctxStatus) {
      this.previewCharts.status = new Chart(ctxStatus, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Status Kualitas Udara',
            data: [],
            stepped: true,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            pointRadius: 2,
            segment: {
              borderColor: ctx => {
                const val = ctx.p1.parsed.y;
                if (val >= 2) return '#ef4444';
                if (val >= 1) return '#f59e0b';
                return '#10b981';
              }
            }
          }]
        },
        options: {
          ...commonLineOptions,
          scales: {
            ...commonLineOptions.scales,
            y: {
              min: 0,
              max: 2,
              ticks: {
                stepSize: 1,
                callback: (val) => val === 0 ? 'Baik' : (val === 1 ? 'Sedang' : (val === 2 ? 'Buruk' : ''))
              }
            }
          }
        }
      });
    }
  }

  /**
   * Update data preview charts
   */
  async updatePreviewCharts(minutes = 60) {
    try {
      const history = await window.thingspeakService.fetchHistoricalTelemetry(minutes);
      if (!history || !history.feeds || history.feeds.length === 0) return;

      const feeds = history.feeds;
      const labels = feeds.map(f => {
        const d = new Date(f.createdAt);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      });

      if (this.previewCharts.temp) {
        this.previewCharts.temp.data.labels = labels;
        this.previewCharts.temp.data.datasets[0].data = feeds.map(f => f.temp);
        this.previewCharts.temp.update();
      }

      if (this.previewCharts.hum) {
        this.previewCharts.hum.data.labels = labels;
        this.previewCharts.hum.data.datasets[0].data = feeds.map(f => f.humidity);
        this.previewCharts.hum.update();
      }

      if (this.previewCharts.gas) {
        this.previewCharts.gas.data.labels = labels;
        this.previewCharts.gas.data.datasets[0].data = feeds.map(f => f.gasIndex);
        this.previewCharts.gas.update();
      }

      if (this.previewCharts.dust) {
        this.previewCharts.dust.data.labels = labels;
        this.previewCharts.dust.data.datasets[0].data = feeds.map(f => f.dust);
        this.previewCharts.dust.update();
      }

      if (this.previewCharts.status) {
        this.previewCharts.status.data.labels = labels;
        this.previewCharts.status.data.datasets[0].data = feeds.map(f => f.airStatus);
        this.previewCharts.status.update();
      }
    } catch (e) {
      console.warn('Gagal memuat mini trend chart preview:', e);
    }
  }
}

// Global instance
window.homeController = new HomeController();

