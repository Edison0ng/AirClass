# AIRCLASS — Smart Classroom Environmental Monitoring & Control System

> **Sistem Monitoring dan Pengendalian Kualitas Udara Ruang Belajar Berbasis Internet of Things (IoT)**  
> Terintegrasi langsung dengan mikrokontroler **ESP32** dan platform cloud **ThingSpeak**.  
> *(Versi Revisi Logika Kipas Otomatis Responsif: SEDANG = ON, BURUK = ON, BAIK = OFF setelah 60 detik)*

---

## 📋 Daftar Isi

1. [Tentang Sistem AIRCLASS](#tentang-sistem-airclass)
2. [Revisi Algoritma Pengendalian Kipas Otomatis](#revisi-algoritma-pengendalian-kipas-otomatis)
3. [Fitur Utama Dashboard](#fitur-utama-dashboard)
4. [Arsitektur & Pemetaan Pin ESP32](#arsitektur--pemetaan-pin-esp32)
5. [Integrasi ThingSpeak](#integrasi-thingspeak)
   - [Channel A — Telemetri Sensor](#channel-a--telemetri-sensor)
   - [Channel B — Perintah Kendali Kipas](#channel-b--perintah-kendali-kipas)
6. [Logika & Ambang Batas Klasifikasi Lingkungan](#logika--ambang-batas-klasifikasi-lingkungan)
   - [Perhatian Khusus Sensor Suhu & Kelembapan](#perhatian-khusus-sensor-suhu--kelembapan)
7. [Tabel 10 Skenario Pengujian Sistem](#tabel-10-skenario-pengujian-sistem)
8. [Struktur Folder Proyek](#struktur-folder-proyek)
9. [Panduan Instalasi & Menjalankan](#panduan-instalasi--menjalankan)
10. [Panduan Pengujian dengan Wokwi & ESP32](#panduan-pengujian-dengan-wokwi--esp32)
11. [Rekomendasi Pembaruan Laporan Tugas Akhir](#rekomendasi-pembaruan-laporan-tugas-akhir)
12. [Informasi Pengembang](#informasi-pengembang)

---

## 🌟 Tentang Sistem AIRCLASS

**AIRCLASS** dirancang untuk memantau kenyamanan dan kualitas udara di dalam ruang belajar (kelas/laboratorium) secara *real-time* sekaligus mengendalikan kipas *exhaust* secara otomatis maupun manual dari jarak jauh melalui platform cloud **ThingSpeak**.

Sistem ini mengombinasikan:
- **Deteksi multi-parameter**: Suhu, kelembapan, indeks gas, indeks debu, dan deteksi kehadiran penghuni.
- **Logika histeresis otomatis responsif**: Kipas exhaust menyala saat kualitas udara memburuk (SEDANG atau BURUK) dan baru mati setelah udara kembali BAIK selama 60 detik tanpa jeda.
- **Kendali ganda (Dual Mode)**: Mode Otomatis berbasis sensor dan Mode Manual jarak jauh melalui cloud.
- **Dashboard web modern**: Mengadopsi estetika *Modern Dark Navy* dengan visualisasi 8 grafik historis mandiri.

---

## 🔄 Revisi Algoritma Pengendalian Kipas Otomatis

### Perbandingan Algoritma Lama vs Baru:

| Aspek | Algoritma Lama | Algoritma Baru (Revisi) |
|---|---|---|
| **Status BURUK (2)** | Kipas menyala (ON) | Kipas menyala (ON) + Buzzer aktif |
| **Status SEDANG (1)** | Mempertahankan status kipas sebelumnya (*hysteresis*) | **Kipas langsung menyala (ON)** untuk sirkulasi & ventilasi |
| **Status BAIK (0)** | Kipas mati setelah status BAIK bertahan 60 detik | **Kipas mati (OFF)** setelah status BAIK stabil bertahan 60 detik |
| **Timer Histeresis** | Hanya aktif jika sebelumnya BURUK $\to$ BAIK | Aktif saat kipas ON dan status udara berubah menjadi BAIK |
| **Pembatalan Timer** | Timer di-reset jika kembali BURUK | **Timer dibatalkan seketika** jika udara berubah ke SEDANG atau BURUK |

### Aturan Operasional Kipas Otomatis:
1. **Status SEDANG (1)**: Kipas langsung menyala (`RELAY = HIGH`). Timer kondisi BAIK dibatalkan. Kipas berfungsi mempercepat sirkulasi udara dan pertukaran ventilasi ruangan.
2. **Status BURUK (2)**: Kipas langsung menyala (`RELAY = HIGH`). Buzzer aktif sebagai alarm audio keselamatan. Timer kondisi BAIK dibatalkan.
3. **Status BAIK (0)**:
   - Jika relay sedang menyala (`HIGH`), ESP32 mencatat `timerBaikMulai = millis()` dan mengaktifkan penanda `timerBaikAktif = true`.
   - Timer 60.000 ms (60 detik) dihitung secara non-blocking tanpa `delay()`.
   - Jika kondisi BAIK bertahan tanpa terputus selama $\ge 60$ detik, relay dimatikan (`RELAY = LOW`).
   - Jika sebelum 60 detik status udara kembali menjadi SEDANG atau BURUK, timer langsung dibatalkan (`timerBaikAktif = false`), kipas tetap/kembali menyala.

### Hubungan dengan Mode Manual:
- Pada **Mode Manual**, relay sepenuhnya dikendalikan oleh perintah Channel B Field 2 dari dashboard.
- Logika otomatis tidak menimpa mode manual.
- Saat berpindah dari **Manual ke Otomatis**, timer otomatis di-reset bersih sehingga kipas langsung menyesuaikan diri dengan kondisi kualitas udara terkini.
- Alarm keselamatan buzzer tetap menyala jika status BURUK, meskipun dalam Mode Manual.

---

## 🎯 Fitur Utama Dashboard

### 1. Tab 1 — HOME (Monitoring Aktual & Kendali)
- **Top Header Bar**:
  - Indikator status koneksi sistem (`System Online`).
  - Indikator status koneksi mikrokontroler (`ESP32 Connected / Standby / Offline`).
  - Indikator status koneksi ThingSpeak (`ThingSpeak Connected`).
  - Timestamp pembaruan data terakhir dan *countdown timer* 20 detik.
- **Air Quality Overview (Hero Card)**:
  - Cincin visual melingkar (*Circular Glow Ring*):
    - 🟢 **BAIK** (Hijau): Udara sehat, semua parameter dalam rentang optimal.
    - 🟡 **SEDANG** (Kuning): Satu atau lebih parameter berada di luar rentang optimal.
    - 🔴 **BURUK** (Merah): Indeks gas atau debu melebihi batas aman, kipas otomatis menyala, dan alarm buzzer berbunyi.
  - Checklist interaktif kondisi ke-4 parameter (Suhu, Kelembaban, Gas, Debu).
- **Sensor Monitoring Cards (4 Kartu)**:
  - **Suhu (°C)**: Rentang normal 18–30 °C.
  - **Kelembapan (%RH)**: Rentang normal 40–65%.
  - **Indeks Gas (0–100)**: Batas aman $\le 40$.
  - **Debu (µg/m³)**: Batas aman $\le 75$ µg/m³.
- **Kendali Kipas Exhaust (Ventilation Control)**:
  - Tag status mode: `AUTOMATIC MODE` atau `MANUAL MODE`.
  - Tag kondisi kipas: `FAN ON` atau `FAN OFF`.
  - Tag status kualitas udara: `UDARA: BAIK`, `UDARA: SEDANG`, `UDARA: BURUK`.
  - Badge histeresis: `MENUNGGU 60 DETIK` (kuning berkedip halus saat udara sudah BAIK namun kipas masih pending 60s sebelum mati).
  - Kotak penjelasan alasan operasional kipas (*Reason Box*).
  - Saklar mode operasi: `Otomatis` vs `Manual`.
  - Tombol aksi: `Fan ON` dan `Fan OFF` (terkunci otomatis saat mode Otomatis).
  - Animasi bilah kipas berputar sesuai kondisi riil **Channel A Field 6**.
- **Kehadiran Ruangan (Classroom Occupancy)**:
  - Indikator kehadiran berbasis sensor PIR (**Channel A Field 7**).
  - Status `Ada Penghuni` vs `Ruangan Kosong` (Hold window 10 menit).

### 2. Tab 2 — ANALYTICS (8 Grafik Historis Mandiri)
- **Bagian A: Parameter Lingkungan (Line Charts)**
  1. *Riwayat Suhu (°C)* — Field 1
  2. *Riwayat Kelembapan (%RH)* — Field 2
  3. *Riwayat Indeks Gas (0–100)* — Field 3
  4. *Riwayat Tingkat Debu (µg/m³)* — Field 4
  - Statistik ringkasan: Min, Avg, Max.
- **Bagian B: Riwayat Operasional Sistem (Step Charts)**
  5. *Status Kualitas Udara* — Field 5 (0 = BAIK, 1 = SEDANG, 2 = BURUK)
  6. *Kondisi Kipas Exhaust* — Field 6 (0 = OFF, 1 = ON)
  7. *Indikasi Kehadiran PIR* — Field 7 (0 = Tidak Terdeteksi, 1 = Terdeteksi)
  8. *Mode Operasi* — Field 8 (0 = Otomatis, 1 = Manual)

---

## 🔌 Arsitektur & Pemetaan Pin ESP32

| Komponen | Pin ESP32 | Mode Pin | Fungsi / Keterangan |
|---|---|---|---|
| **DHT22 (Data)** | `GPIO 4` | Digital Input | Sensor Suhu dan Kelembapan Udara |
| **MQ-2 (AO)** | `GPIO 34` | ADC1 (Input Only) | Proksi Indeks Gas (0–100) |
| **Potensiometer** | `GPIO 35` | ADC1 (Input Only) | Proksi Indeks Debu (0–300 µg/m³) |
| **PIR Motion Sensor** | `GPIO 27` | Digital Input | Deteksi Gerakan / Kehadiran Penghuni |
| **Modul Relay** | `GPIO 26` | Digital Output | Mengendalikan Kipas Exhaust (diwakili LED) |
| **Buzzer** | `GPIO 25` | Digital Output | Alarm Suara (aktif saat Status BURUK) |
| **LED Hijau** | `GPIO 18` | Digital Output | Indikator Status Udara BAIK (Resistor 220 Ω) |
| **LED Kuning** | `GPIO 19` | Digital Output | Indikator Status Udara SEDANG (Resistor 220 Ω) |
| **LED Merah** | `GPIO 23` | Digital Output | Indikator Status Udara BURUK (Resistor 220 Ω) |
| **OLED SSD1306 (SDA)** | `GPIO 21` | I2C SDA | Layar Display Lokal 128x64 |
| **OLED SSD1306 (SCL)** | `GPIO 22` | I2C SCL | Layar Display Lokal 128x64 |

---

## ☁ Integrasi ThingSpeak

### Channel A — Telemetri Sensor
- **Channel ID**: `3547378`
- **Kunci Tulis ESP32**: `XDM0XOLE8DSWU1EE`
- **Interval Pengiriman ESP32**: Setiap 20 detik

| Field | Parameter | Tipe Data | Nilai / Rentang |
|---|---|---|---|
| `field1` | Suhu | Float | °C |
| `field2` | Kelembapan | Float | %RH |
| `field3` | Indeks Gas | Integer | 0–100 |
| `field4` | Debu | Integer | µg/m³ |
| `field5` | Status Udara | Integer | 0 = BAIK, 1 = SEDANG, 2 = BURUK |
| `field6` | Kondisi Kipas | Integer | 0 = OFF, 1 = ON |
| `field7` | Kehadiran | Integer | 0 = Tidak Terdeteksi, 1 = Terdeteksi |
| `field8` | Mode Operasi | Integer | 0 = Otomatis, 1 = Manual |

### Channel B — Perintah Kendali Kipas
- **Channel ID**: `3547380`
- **Kunci Baca ESP32**: `L4M5T06RXQ9MR1AS`
- **Kunci Tulis Dashboard**: Diisi melalui file `.env` atau menu **Settings** di website.

| Field | Perintah | Nilai | Keterangan |
|---|---|---|---|
| `field1` | Mode Operasi | `0` atau `1` | `0` = Otomatis, `1` = Manual |
| `field2` | Perintah Kipas | `0` atau `1` | `0` = OFF, `1` = ON (berlaku saat Manual) |

---

## ⚖ Logika & Ambang Batas Klasifikasi Lingkungan

| Parameter | BAIK (0) | SEDANG (1) | BURUK (2) |
|---|:---:|:---:|:---:|
| **Indeks Gas (0–100)** | $\le 40$ | $41 - 70$ | $> 70$ |
| **Debu ($\mu\text{g}/\text{m}^3$)** | $\le 75$ | $76 - 150$ | $> 150$ |
| **Suhu ($^\circ\text{C}$)** | $18 - 30$ | Di luar rentang ($<18$ atau $>30$) | — |
| **Kelembapan ($\%\text{RH}$)** | $40 - 65$ | Di luar rentang ($<40$ atau $>65$) | — |

### Perhatian Khusus Sensor Suhu & Kelembapan:
- Status keseluruhan mengikuti parameter terburuk (*worst parameter*).
- Penyimpangan pada **Suhu** ($<18^\circ\text{C}$ atau $>30^\circ\text{C}$) atau **Kelembapan** ($<40\%$ atau $>65\%$) akan menaikkan status udara menjadi minimal **SEDANG (1)**.
- Karena pada algoritma baru status SEDANG menyalakan kipas otomatis, maka ketidaknyamanan termal atau kelembapan ekstrem akan mengaktifkan kipas exhaust.
- **Klarifikasi Teknis:** Kipas exhaust berfungsi membantu pertukaran udara dan ventilasi ruangan. Kipas exhaust **tidak berfungsi** sebagai pendingin presisi (seperti AC) maupun pengatur kelembapan presisi (seperti dehumidifier/humidifier). Dampak kipas terhadap kelembapan bergantung pada kondisi udara di luar ruangan.

---

## 🧪 Tabel 10 Skenario Pengujian Sistem

Berikut adalah 10 skenario pengujian wajib untuk memverifikasi logika baru:

| No | Skenario Pengujian | Kondisi Awal | Perubahan Masukan | Status Udara | Hasil yang Diharapkan (Relay / Kipas) | Indikator LED / Buzzer |
|:---:|---|---|---|:---:|---|---|
| **1** | Udara BAIK $\le$ 60 detik | Kipas ON | Semua parameter normal $\le 60\text{ s}$ | BAIK (0) | **Kipas TETAP ON** (menghitung histeresis 60 detik) | LED Hijau ON, Buzzer OFF |
| **2** | Udara BAIK bertahan 60 detik | Kipas ON, timer berjalan | Kondisi BAIK genap mencapai $60.000\text{ ms}$ | BAIK (0) | **Kipas MATI (OFF)** | LED Hijau ON, Buzzer OFF |
| **3** | Udara SEDANG terdeteksi | Kipas OFF | Gas naik (41–70) atau Debu (76–150) | SEDANG (1) | **Kipas LANGSUNG ON** | LED Kuning ON, Buzzer OFF |
| **4** | Udara BURUK terdeteksi | Kipas OFF | Gas $>70$ atau Debu $>150$ | BURUK (2) | **Kipas LANGSUNG ON** | LED Merah ON, **Buzzer AKTIF (ON)** |
| **5** | Dari BURUK turun ke SEDANG | Kipas ON, Buzzer ON | Gas/Debu turun ke level sedang | SEDANG (1) | **Kipas TETAP ON**, Buzzer mati | LED Kuning ON, Buzzer OFF |
| **6** | Dari SEDANG turun ke BAIK | Kipas ON | Semua sensor kembali ke rentang aman | BAIK (0) | **Kipas TETAP ON**, Timer 60 detik dimulai | LED Hijau ON, OLED menampilkan hitung sisa |
| **7** | Status BAIK terinterupsi sebelum 60 detik | Kipas ON, timer berjalan 25s | Gas/Debu tiba-tiba naik ke status SEDANG | SEDANG (1) | **Timer DIBATALKAN**, Kipas **TETAP ON** | LED Kuning ON, Buzzer OFF |
| **8** | Mode Manual: Perintah Fan ON | Mode Manual | Channel B: field1=1, field2=1 | Sembarang | **Kipas LANGSUNG ON** (mengabaikan sensor) | Mengikuti status sensor aktual |
| **9** | Mode Manual: Perintah Fan OFF | Mode Manual | Channel B: field1=1, field2=0 | Sembarang | **Kipas LANGSUNG OFF** (mengabaikan sensor) | Mengikuti status sensor aktual |
| **10** | Berpindah dari Manual ke Otomatis | Mode Manual, Kipas OFF | Channel B: field1=0, Udara SEDANG | SEDANG (1) | **Kipas LANGSUNG ON** mengikuti kondisi udara | LED Kuning ON, Timer di-reset bersih |

---

## 📁 Struktur Folder Proyek

```text
c:\Users\PC\Documents\wokwi+thingspeak\
│
├── index.html              # Antarmuka dashboard (Home & Analytics tabs)
├── package.json            # Dependensi Express & Node.js
├── README.md               # Dokumentasi sistem lengkap
├── AIRCLASS_Project.zip    # Berkas arsip unduhan lengkap
│
├── css/
│   └── style.css           # Styling Modern Dark Navy, Responsive Grid, Pulse Badges
│
├── js/
│   ├── config.js           # Konfigurasi Channel ID, Key, dan ambang batas
│   ├── thingspeak.js       # Layanan API ThingSpeak (Read A & Write B)
│   ├── home.js             # Controller Tab Home (Realtime cards, hero card, fan & PIR)
│   ├── analytics.js        # Controller Tab Analytics (8 grafik historis mandiri)
│   └── app.js              # Koordinator aplikasi, routing tab, status koneksi & modal
│
├── assets/
│   ├── logo.svg            # Logo vektor AIRCLASS (Cyan/Teal stream)
│   └── favicon.svg         # Favicon website
│
├── server/
│   ├── server.js           # Server Express.js (Static server + Proxy aman Channel B)
│   ├── .env.example        # Template konfigurasi environment variables
│   └── .env                # File konfigurasi environment variables lokal
│
└── firmware/
    ├── esp32_airclass.ino  # Kode program ESP32 Arduino C++ (Logika Baru)
    └── diagram.json        # Skema rangkaian simulator Wokwi
```

---

## 🚀 Panduan Instalasi & Menjalankan

1. **Buka terminal** di direktori proyek:
   ```bash
   cd c:\Users\PC\Documents\wokwi+thingspeak
   npm install
   ```

2. **Atur Environment Variables**:
   Buka file `server/.env` dan sesuaikan nilainya:
   ```env
   PORT=3000
   CHANNEL_A_ID=3547378
   CHANNEL_A_READ_KEY=
   CHANNEL_B_ID=3547380
   CHANNEL_B_READ_KEY=L4M5T06RXQ9MR1AS
   CHANNEL_B_WRITE_KEY=MASUKKAN_WRITE_KEY_CHANNEL_B_ANDA
   ```

3. **Jalankan server**:
   ```bash
   npm start
   ```

4. **Buka Dashboard**:
   Akses `http://localhost:3000` di peramban.

---

## 🧪 Panduan Pengujian dengan Wokwi & ESP32

1. Buka [Wokwi ESP32 Simulator](https://wokwi.com/).
2. Buat proyek baru ESP32 DevKit V1.
3. Salin isi file `firmware/esp32_airclass.ino` ke sketch Arduino.
4. Salin isi file `firmware/diagram.json` ke tab diagram JSON.
5. Tambahkan library di Library Manager:
   - `DHT sensor library`
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`
6. Jalankan simulasi (Play).
7. Geser potensiometer MQ-2 atau Debu:
   - Naikkan ke area SEDANG (gas > 40 atau debu > 75): Perhatikan LED Kuning menyala dan relay langsung aktif (LED biru kipas menyala).
   - Naikkan ke area BURUK (gas > 70 atau debu > 150): Perhatikan LED Merah menyala, relay tetap aktif, buzzer berbunyi.
   - Kembalikan ke area BAIK: Perhatikan OLED menampilkan `Timer Off: XXs`. Kipas tetap menyala hingga 60 detik habis, kemudian relay mati (LED biru kipas padam).

---

## 📝 Rekomendasi Pembaruan Laporan Tugas Akhir

Agar laporan tugas akhir selaras dengan implementasi sistem yang baru, perbarui bagian-bagian berikut:

1. **Sub-bab 2.7 (Desain Logika Kendali - Gambar 4 & Narasi):**
   - **Perubahan Narasi:** Ubah pernyataan bahwa *"kipas hanya menyala saat status BURUK"* menjadi *"kipas menyala secara proaktif saat status SEDANG maupun BURUK untuk mempercepat proses ventilasi ruang belajar"*.
   - **Diagram Alir (Flowchart Gambar 4):**
     - Dari percabangan *"Apakah status BURUK?"*, ubah menjadi percabangan *"Apakah status SEDANG atau BURUK?"*.
     - Jika YA $\to$ Kipas ON dan reset timer kondisi BAIK.
     - Jika TIDAK (status BAIK) $\to$ Periksa *"Apakah kipas sedang menyala?"*. Jika YA $\to$ Jalankan timer 60 detik. Jika bertahan $\ge 60$ detik $\to$ Kipas OFF. Jika kipas sudah OFF $\to$ Pertahankan Kipas OFF.
2. **Sub-bab 1.2 Tujuan & Sub-bab 2.9 Rancangan Dashboard:**
   - Tambahkan penjelasan mengenai *badge histeresis* pada dashboard web (`MENUNGGU 60 DETIK`) yang memberikan visibilitas waktu stabilisasi kepada pengguna.

---

## 👥 Informasi Pengembang

**Tugas Akhir Mata Kuliah Teknologi IoT**  
*Program Studi Sarjana Informatika — FMIPA Universitas Udayana (2026)*

- **I Putu Wahyu Eka Saputra** (2408561114)
- **Nyoman Triandi Candra Mulia** (2408561117)
- **I Nyoman Mahayana Tri Parikesit** (2408561135)
- **Satrio Palupi** (2408561138)  
*Dosen Pengampu:* **I Wayan Supriana, S.Si., M.Cs.**
