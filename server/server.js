/**
 * AIRCLASS - Node.js Express Backend & ThingSpeak Secure Proxy
 * Menyediakan server static web dan proxy aman untuk pengiriman perintah Channel B
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Coba memuat dotenv jika terinstall, atau baca manual .env
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  // Manual parser sederhana jika dotenv belum terpasang
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        val = val.trim().replace(/(^['"]|['"]$)/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Sajikan file statis dari root project
const rootDir = path.join(__dirname, '..');
app.use(express.static(rootDir));

// Throttling state untuk ThingSpeak update
let lastUpdateTime = 0;
const THROTTLE_MS = 15000;

/**
 * GET /api/config
 * Mengembalikan konfigurasi publik ke frontend tanpa membocorkan Write API Key
 */
app.get('/api/config', (req, res) => {
  res.json({
    channelAId: process.env.CHANNEL_A_ID || '3547378',
    channelAReadKey: process.env.CHANNEL_A_READ_KEY || '',
    channelBId: process.env.CHANNEL_B_ID || '3547380',
    channelBReadKey: process.env.CHANNEL_B_READ_KEY || 'L4M5T06RXQ9MR1AS',
    hasWriteKeyConfigured: !!(process.env.CHANNEL_B_WRITE_KEY && process.env.CHANNEL_B_WRITE_KEY.trim() !== '')
  });
});

/**
 * POST /api/control
 * Mengirim perintah kendali ke ThingSpeak Channel B (Field 1: Mode, Field 2: Kipas)
 */
app.post('/api/control', async (req, res) => {
  const { mode, fan } = req.body;

  // Validasi parameter sesuai spesifikasi Laporan & ESP32
  if (mode !== 0 && mode !== 1) {
    return res.status(400).json({ error: 'Nilai mode tidak valid. Harus 0 (Otomatis) atau 1 (Manual).' });
  }
  if (fan !== 0 && fan !== 1) {
    return res.status(400).json({ error: 'Nilai kipas tidak valid. Harus 0 (OFF) atau 1 (ON).' });
  }

  // Ambil writeKey dari request body atau dari environment variable .env
  const writeKey = req.body.writeKey || process.env.CHANNEL_B_WRITE_KEY;
  if (!writeKey || writeKey.trim() === '' || writeKey.includes('YOUR_CHANNEL_B_WRITE_KEY')) {
    return res.status(400).json({
      error: 'Write API Key Channel B belum diisi. Silakan masukkan Write API Key pada menu Pengaturan (Settings) di pojok kiri bawah atau file server/.env.'
    });
  }

  // Periksa jeda 15 detik batas ThingSpeak
  const now = Date.now();
  const elapsed = now - lastUpdateTime;
  if (elapsed < THROTTLE_MS) {
    const sisa = Math.ceil((THROTTLE_MS - elapsed) / 1000);
    return res.status(429).json({
      error: `ThingSpeak rate limit aktif. Harap tunggu ${sisa} detik lagi.`
    });
  }

  try {
    const updateUrl = `https://api.thingspeak.com/update?api_key=${encodeURIComponent(writeKey)}&field1=${mode}&field2=${fan}`;
    const tsRes = await fetch(updateUrl, { method: 'POST' });
    
    if (!tsRes.ok) {
      return res.status(tsRes.status).json({
        error: `ThingSpeak mengembalikan status HTTP ${tsRes.status}`
      });
    }

    const responseBody = await tsRes.text();
    const entryId = parseInt(responseBody.trim(), 10);

    if (isNaN(entryId) || entryId <= 0) {
      return res.status(400).json({
        error: 'ThingSpeak mengembalikan 0 (Pembaruan ditolak atau Write API Key salah).'
      });
    }

    lastUpdateTime = Date.now();
    return res.json({
      success: true,
      entryId: entryId,
      mode: mode,
      fan: fan,
      message: `Perintah berhasil dikirim ke ThingSpeak Channel B (Entry #${entryId}).`
    });

  } catch (err) {
    console.error('Error saat menghubungi ThingSpeak:', err);
    return res.status(500).json({ error: 'Gagal terhubung ke API ThingSpeak: ' + err.message });
  }
});

// Fallback untuk route selain API
app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🚀 AIRCLASS Dashboard Server berjalan di: http://localhost:${PORT}`);
  console.log(`📡 Channel A Telemetri Sensor: ${process.env.CHANNEL_A_ID || '3547378'}`);
  console.log(`🎮 Channel B Kendali Kipas:    ${process.env.CHANNEL_B_ID || '3547380'}`);
  console.log('========================================================');
});
