/**
 * AIRCLASS - ThingSpeak API Service
 * Menangani pengambilan data telemetri Channel A dan pengiriman perintah Channel B.
 */

class ThingSpeakService {
  constructor() {
    this.lastCommandTime = 0;
    this.commandCooldown = 15000; // Rate limit ThingSpeak 15 detik
  }

  getConfig() {
    return window.airclassConfig ? window.airclassConfig.get() : {};
  }

  /**
   * Mengambil feed sensor terbaru dari Channel A
   */
  async fetchLatestTelemetry() {
    const config = this.getConfig();
    const channelId = config.channelAId;
    let url = `https://api.thingspeak.com/channels/${channelId}/feeds/last.json`;
    if (config.channelAReadKey) {
      url += `?api_key=${encodeURIComponent(config.channelAReadKey)}`;
    }

    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`ThingSpeak Channel A HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return this.parseFeed(data);
    } catch (err) {
      console.error('Error fetching Channel A latest:', err);
      throw err;
    }
  }

  /**
   * Mengambil data historis Channel A berdasarkan rentang menit atau jumlah data
   */
  async fetchHistoricalTelemetry(minutes = 60) {
    const config = this.getConfig();
    const channelId = config.channelAId;
    
    // Hitung perkiraan hasil jika menggunakan parameter results atau minutes
    let url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?minutes=${minutes}`;
    if (config.channelAReadKey) {
      url += `&api_key=${encodeURIComponent(config.channelAReadKey)}`;
    }

    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`ThingSpeak Historical HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      
      // Jika feed kosong karena rentang waktu pendek dan ESP32 tidak aktif sekarang, fallback ambil 100 data terakhir
      if (!data.feeds || data.feeds.length === 0) {
        let fallbackUrl = `https://api.thingspeak.com/channels/${channelId}/feeds.json?results=100`;
        if (config.channelAReadKey) fallbackUrl += `&api_key=${encodeURIComponent(config.channelAReadKey)}`;
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          return {
            channel: fallbackData.channel,
            feeds: (fallbackData.feeds || []).map(f => this.parseFeed(f)),
            isFallback: true
          };
        }
      }

      return {
        channel: data.channel,
        feeds: (data.feeds || []).map(f => this.parseFeed(f)),
        isFallback: false
      };
    } catch (err) {
      console.error('Error fetching Channel A historical:', err);
      throw err;
    }
  }

  /**
   * Mengambil status perintah terakhir dari Channel B
   */
  async fetchLatestCommand() {
    const config = this.getConfig();
    const channelId = config.channelBId;
    let url = `https://api.thingspeak.com/channels/${channelId}/feeds/last.json`;
    if (config.channelBReadKey) {
      url += `?api_key=${encodeURIComponent(config.channelBReadKey)}`;
    }

    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`ThingSpeak Channel B HTTP ${response.status}`);
      }
      const data = await response.json();
      return {
        mode: data.field1 !== undefined && data.field1 !== null ? parseInt(data.field1, 10) : 0, // 0=Otomatis, 1=Manual
        fan: data.field2 !== undefined && data.field2 !== null ? parseInt(data.field2, 10) : 0,  // 0=OFF, 1=ON
        createdAt: data.created_at,
        entryId: data.entry_id
      };
    } catch (err) {
      console.warn('Gagal membaca Channel B status:', err.message);
      return null;
    }
  }

  /**
   * Mengirim perintah ke Channel B (Mode dan Kipas)
   * @param {number} mode 0=Otomatis, 1=Manual
   * @param {number} fan 0=OFF, 1=ON
   */
  async sendControlCommand(mode, fan) {
    const now = Date.now();
    const elapsed = now - this.lastCommandTime;
    if (elapsed < this.commandCooldown) {
      const remainingSec = Math.ceil((this.commandCooldown - elapsed) / 1000);
      throw new Error(`Harap tunggu ${remainingSec} detik sebelum mengirim perintah lagi (Batas ThingSpeak 15s).`);
    }

    const config = this.getConfig();
    const writeKey = config.channelBWriteKey || '';

    // 1. Coba kirim via server lokal proxy (aman untuk write API key)
    try {
      const serverRes = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, fan, writeKey })
      });
      if (serverRes.ok) {
        const resJson = await serverRes.json();
        if (resJson.success) {
          this.lastCommandTime = Date.now();
          return { success: true, method: 'backend', entryId: resJson.entryId };
        }
      } else {
        const errJson = await serverRes.json().catch(() => ({}));
        if (errJson.error && !errJson.error.includes('belum diisi')) {
          throw new Error(errJson.error);
        }
      }
    } catch (e) {
      if (e.message && !e.message.includes('Failed to fetch') && !e.message.includes('belum diisi')) {
        throw e;
      }
      // Backend mungkin tidak dijalankan (mode client-only / static file), lanjut ke direct API
    }

    // 2. Direct browser fetch ke ThingSpeak Update API
    if (!writeKey) {
      throw new Error('Write API Key Channel B belum dikonfigurasi. Silakan buka menu Pengaturan (Settings) di sidebar kiri dan masukkan Write API Key Channel B Anda.');
    }

    const updateUrl = `https://api.thingspeak.com/update?api_key=${encodeURIComponent(writeKey)}&field1=${mode}&field2=${fan}`;
    const response = await fetch(updateUrl, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Gagal mengirim ke ThingSpeak (HTTP ${response.status})`);
    }

    const text = await response.text();
    const entryId = parseInt(text.trim(), 10);
    if (isNaN(entryId) || entryId <= 0) {
      throw new Error('ThingSpeak menolak update (kemungkinan terlalu cepat < 15 detik atau API key salah).');
    }

    this.lastCommandTime = Date.now();
    return { success: true, method: 'direct', entryId };
  }

  /**
   * Helper konversi feed mentah ThingSpeak menjadi objek data terstruktur
   */
  parseFeed(raw) {
    if (!raw) return null;

    const temp = raw.field1 !== null && raw.field1 !== undefined ? parseFloat(raw.field1) : null;
    const humidity = raw.field2 !== null && raw.field2 !== undefined ? parseFloat(raw.field2) : null;
    const gasIndex = raw.field3 !== null && raw.field3 !== undefined ? parseInt(raw.field3, 10) : null;
    const dust = raw.field4 !== null && raw.field4 !== undefined ? parseInt(raw.field4, 10) : null;
    
    // Status Udara: 0=Baik, 1=Sedang, 2=Buruk
    let airStatus = raw.field5 !== null && raw.field5 !== undefined ? parseInt(raw.field5, 10) : null;
    // Jika field5 tidak ada atau null, hitung berdasarkan logika Tabel 7
    if (airStatus === null && (temp !== null || gasIndex !== null || dust !== null)) {
      airStatus = this.calculateAirStatus(temp, humidity, gasIndex, dust);
    }

    const fanState = raw.field6 !== null && raw.field6 !== undefined ? parseInt(raw.field6, 10) === 1 : false;
    const occupancy = raw.field7 !== null && raw.field7 !== undefined ? parseInt(raw.field7, 10) === 1 : false;
    const isManualMode = raw.field8 !== null && raw.field8 !== undefined ? parseInt(raw.field8, 10) === 1 : false;

    return {
      entryId: raw.entry_id,
      createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
      temp: temp !== null && !isNaN(temp) ? Number(temp.toFixed(1)) : 0,
      humidity: humidity !== null && !isNaN(humidity) ? Number(humidity.toFixed(1)) : 0,
      gasIndex: gasIndex !== null && !isNaN(gasIndex) ? gasIndex : 0,
      dust: dust !== null && !isNaN(dust) ? dust : 0,
      airStatus: airStatus !== null ? airStatus : 0, // 0=Baik, 1=Sedang, 2=Buruk
      fanState,      // true=ON, false=OFF
      occupancy,     // true=OCCUPIED, false=UNOCCUPIED
      isManualMode   // true=Manual, false=Otomatis
    };
  }

  /**
   * Logika klasifikasi kualitas udara sesuai Tabel 7 Laporan Tugas Akhir:
   * Gas <= 40 (Baik), 41-70 (Sedang), > 70 (Buruk)
   * Debu <= 75 (Baik), 76-150 (Sedang), > 150 (Buruk)
   * Suhu 18-30 (Baik), diluar rentang (Sedang)
   * Kelembapan 40-65 (Baik), diluar rentang (Sedang)
   * Status keseluruhan mengikuti parameter terburuk.
   */
  calculateAirStatus(temp, hum, gas, dust) {
    let status = 0; // Baik
    
    // Periksa kondisi sedang
    if (gas > 40 || dust > 75 || temp < 18 || temp > 30 || hum < 40 || hum > 65) {
      status = 1; // Sedang
    }
    // Periksa kondisi buruk (hanya gas dan debu yang dapat memicu Buruk)
    if (gas > 70 || dust > 150) {
      status = 2; // Buruk
    }
    return status;
  }
}

// Global instance
window.thingspeakService = new ThingSpeakService();
