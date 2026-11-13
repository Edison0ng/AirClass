/**
 * AIRCLASS - Smart Classroom Environmental Monitoring & Control System
 * Configuration Module
 * 
 * Sesuai referensi:
 * - Channel A (Data Sensor): ID 3547378
 * - Channel B (Kendali Kipas & Mode): ID 3547380
 */

const DEFAULT_CONFIG = {
  // ThingSpeak Channel A (Sensor Telemetry - Ditulis ESP32, Dibaca Dashboard)
  channelAId: '3547378',
  channelAReadKey: '', // Publik, opsional diisi jika channel privat
  channelAWriteKey: 'XDM0XOLE8DSWU1EE', // Referensi kunci tulis ESP32

  // ThingSpeak Channel B (Command Control - Ditulis Dashboard, Dibaca ESP32)
  channelBId: '3547380',
  channelBReadKey: 'L4M5T06RXQ9MR1AS', // Kunci baca ESP32
  channelBWriteKey: '', // Diisi Write API Key Channel B oleh pengguna untuk kontrol

  // Interval polling data (milidetik) - Sesuai interval kirim ESP32 (20 detik)
  refreshInterval: 20000,

  // Ambang batas ESP32 timeout (milidetik) - Jika >90 detik tanpa data baru, anggap ESP32 standby/offline
  esp32Timeout: 90000,

  // Ambang Batas Klasifikasi Kualitas Udara (Sesuai Tabel 7 Laporan Tugas Akhir)
  thresholds: {
    temp: { minBaik: 18, maxBaik: 30, unit: '°C' },
    humidity: { minBaik: 40, maxBaik: 65, unit: '%RH' },
    gas: { maxBaik: 40, maxSedang: 70, unit: 'Indeks' },
    dust: { maxBaik: 75, maxSedang: 150, unit: 'µg/m³' }
  },

  // Metadata Sistem
  systemInfo: {
    name: 'AIRCLASS',
    fullName: 'Smart Classroom Environmental Monitoring & Control System',
    version: '1.0.0',
    controller: 'ESP32 DevKit V1',
    cloudPlatform: 'ThingSpeak IoT Cloud',
    room: 'Ruang Belajar A',
    institution: 'Universitas Udayana'
  }
};

class ConfigManager {
  constructor() {
    this.storageKey = 'airclass_config';
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_CONFIG, ...parsed, thresholds: DEFAULT_CONFIG.thresholds, systemInfo: DEFAULT_CONFIG.systemInfo };
      }
    } catch (e) {
      console.warn('Gagal membaca konfigurasi dari localStorage:', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (e) {
      console.error('Gagal menyimpan konfigurasi ke localStorage:', e);
    }
    return this.config;
  }

  resetConfig() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.warn(e);
    }
    this.config = { ...DEFAULT_CONFIG };
    return this.config;
  }

  get() {
    return this.config;
  }
}

// Global instance
window.airclassConfig = new ConfigManager();

