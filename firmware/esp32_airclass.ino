#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// --- KONFIGURASI WIFI ---
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// --- KONFIGURASI THINGSPEAK ---
// Kanal A (Data Sensor)
String writeAPIKey = "XDM0XOLE8DSWU1EE"; 

// Kanal B (Perintah Kendali Jarak Jauh)
String readAPIKey = "L4M5T06RXQ9MR1AS";
String channelB_ID = "3547380";

// --- KONFIGURASI PIN ---
#define DHTPIN 4
#define DHTTYPE DHT22
#define MQ2_PIN 34
#define DEBU_PIN 35
#define PIR_PIN 27
#define RELAY_PIN 26
#define BUZZER_PIN 25
#define LED_HIJAU 18
#define LED_KUNING 19
#define LED_MERAH 23

DHT dht(DHTPIN, DHTTYPE);
Adafruit_SSD1306 display(128, 64, &Wire, -1);

// --- VARIABEL GLOBAL ---
unsigned long lastThingSpeakTime = 0;
unsigned long lastSensorReadTime = 0;

// Variabel Timer Logika Kipas Otomatis (Histeresis 60 detik)
unsigned long timerBaikMulai = 0;   // Timestamp dimulainya kondisi BAIK
bool timerBaikAktif = false;        // Penanda apakah timer histeresis 60s sedang berjalan

bool kipasState = false;            // Status perintah kipas pada mode manual
bool modeManual = false;            // false = Otomatis, true = Manual
bool pirTerakhir = false;
unsigned long lastPirTime = 0;
int statusUdara = 0;                // 0=Baik, 1=Sedang, 2=Buruk
float suhu = 0, kelembaban = 0;
int indeksGas = 0, debu = 0;

// --- MODEL SIMULASI DINAMIKA UDARA RUANGAN (VENTILASI KIPAS AKTIF) ---
// Variabel dinamis ruangan yang terpengaruh oleh kerja kipas exhaust
float roomGas = 20.0;
float roomDebu = 35.0;
float roomSuhu = 26.5;
float roomLembab = 55.0;
int lastPotGas = -1;
int lastPotDebu = -1;

void setup() {
  Serial.begin(115200);
  
  // Inisialisasi Pin
  pinMode(MQ2_PIN, INPUT);
  pinMode(DEBU_PIN, INPUT);
  pinMode(PIR_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_HIJAU, OUTPUT);
  pinMode(LED_KUNING, OUTPUT);
  pinMode(LED_MERAH, OUTPUT);
  
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Inisialisasi Sensor & OLED
  dht.begin();
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0, 10);
  display.println("Menghubungkan WiFi...");
  display.display();

  // Koneksi WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Terhubung!");
  
  display.clearDisplay();
  display.setCursor(0, 10);
  display.println("WiFi Terhubung!");
  display.display();
  delay(1000);
}

void loop() {
  // 1. BACA SENSOR & MODEL VENTILASI RUANGAN (Tiap 2 detik)
  if (millis() - lastSensorReadTime > 2000) {
    lastSensorReadTime = millis();
    
    // Baca input sensor fisik / simulator Wokwi
    float rawSuhu = dht.readTemperature();
    float rawLembab = dht.readHumidity();
    int rawGas = map(analogRead(MQ2_PIN), 0, 4095, 0, 100);
    int rawDebu = map(analogRead(DEBU_PIN), 0, 4095, 0, 300);

    // Inisialisasi awal nilai ruangan
    if (lastPotGas == -1) {
      roomGas = rawGas;
      roomDebu = rawDebu;
      roomSuhu = isnan(rawSuhu) ? 26.5 : rawSuhu;
      roomLembab = isnan(rawLembab) ? 55.0 : rawLembab;
      lastPotGas = rawGas;
      lastPotDebu = rawDebu;
    }

    // Deteksi jika pengguna memutar slider potensiometer (Injeksi Polusi Baru di Wokwi)
    if (abs(rawGas - lastPotGas) > 4) {
      roomGas = rawGas; // Mengikuti input gas baru yang disetel pengguna
      lastPotGas = rawGas;
    }
    if (abs(rawDebu - lastPotDebu) > 8) {
      roomDebu = rawDebu; // Mengikuti input debu baru yang disetel pengguna
      lastPotDebu = rawDebu;
    }

    // Cek apakah relay kipas sedang AKTIF (Menyala)
    bool isKipasAktif = (digitalRead(RELAY_PIN) == HIGH);

    if (isKipasAktif) {
      // ==============================================================
      // SIMULASI EFEK FISIK VENTILASI: KIPAS MENORMALKAN UDARA PERLAHAN
      // ==============================================================
      
      // 1. Gas berkurang secara bertahap menuju batas udara bersih (~20)
      if (roomGas > 20.0) {
        roomGas -= 3.0; // Berkurang 3 poin tiap 2 detik
        if (roomGas < 20.0) roomGas = 20.0;
      }
      
      // 2. Debu berkurang secara bertahap menuju baseline bersih (~35 ug/m3)
      if (roomDebu > 35.0) {
        roomDebu -= 6.0; // Berkurang 6 ug/m3 tiap 2 detik
        if (roomDebu < 35.0) roomDebu = 35.0;
      }

      // 3. Suhu dinormalkan perlahan menuju rentang optimal (~26°C)
      if (roomSuhu > 26.0) {
        roomSuhu -= 0.2;
        if (roomSuhu < 26.0) roomSuhu = 26.0;
      } else if (roomSuhu < 26.0) {
        roomSuhu += 0.2;
        if (roomSuhu > 26.0) roomSuhu = 26.0;
      }

      // 4. Kelembapan dinormalkan perlahan menuju rentang nyaman (~55%)
      if (roomLembab > 55.0) {
        roomLembab -= 0.5;
        if (roomLembab < 55.0) roomLembab = 55.0;
      } else if (roomLembab < 55.0) {
        roomLembab += 0.5;
        if (roomLembab > 55.0) roomLembab = 55.0;
      }

    } else {
      // ==============================================================
      // KIPAS MATI: Jika slider polusi disetel tinggi, polusi menumpuk
      // ==============================================================
      if (rawGas > roomGas) {
        roomGas += (rawGas - roomGas) * 0.35;
      }
      if (rawDebu > roomDebu) {
        roomDebu += (rawDebu - roomDebu) * 0.35;
      }
      if (!isnan(rawSuhu)) roomSuhu = rawSuhu;
      if (!isnan(rawLembab)) roomLembab = rawLembab;
    }

    // Simpan ke variabel sensor sistem
    suhu = roomSuhu;
    kelembaban = roomLembab;
    indeksGas = (int)(roomGas + 0.5);
    debu = (int)(roomDebu + 0.5);

    // Deteksi Kehadiran (PIR)
    if (digitalRead(PIR_PIN) == HIGH) {
      pirTerakhir = true;
      lastPirTime = millis();
    } else if (millis() - lastPirTime > 600000) { // 10 menit
      pirTerakhir = false;
    }

    // Tentukan Status Kualitas Udara (Tabel 7)
    // Parameter terburuk menentukan status keseluruhan
    statusUdara = 0; // Asumsi Baik
    if (indeksGas > 40 || debu > 75 || suhu < 18 || suhu > 30 || kelembaban < 40 || kelembaban > 65) {
      statusUdara = 1; // Sedang
    }
    if (indeksGas > 70 || debu > 150) {
      statusUdara = 2; // Buruk
    }
  }

  // 2. BACA PERINTAH DARI THINGSPEAK KANAL B (Tiap 15 detik)
  if (millis() - lastThingSpeakTime > 15000) {
    bacaPerintahCloud();
  }

  // 3. ATUR INDIKATOR VISUAL & AUDIO (LED & Buzzer)
  digitalWrite(LED_HIJAU, statusUdara == 0);
  digitalWrite(LED_KUNING, statusUdara == 1);
  digitalWrite(LED_MERAH, statusUdara == 2);
  // Buzzer berbunyi saat status BURUK (alarm keselamatan)
  digitalWrite(BUZZER_PIN, statusUdara == 2 ? HIGH : LOW);

  // 4. LOGIKA KENDALI KIPAS (REVISI ALGORITMA DENGAN HISTERESIS 60 DETIK)
  if (modeManual) {
    // Mode Manual: Relay langsung mengikuti perintah dari Channel B (field2)
    digitalWrite(RELAY_PIN, kipasState ? HIGH : LOW);
    // Reset timer histeresis otomatis
    timerBaikAktif = false;
  } else {
    // Mode Otomatis (Revisi Respons Lingkungan):
    // - Status SEDANG (1) : Kipas LANGSUNG NYALA (ON) untuk membantu ventilasi
    // - Status BURUK  (2) : Kipas LANGSUNG NYALA (ON) untuk pembuangan gas/debu
    // - Status BAIK   (0) : Kipas MATI (OFF) setelah kondisi BAIK bertahan 60 detik stabil
    if (statusUdara == 1 || statusUdara == 2) {
      digitalWrite(RELAY_PIN, HIGH);
      // Batalkan timer kondisi BAIK jika sebelumnya sedang menghitung
      timerBaikAktif = false;
    } else if (statusUdara == 0) {
      // Status kualitas udara saat ini BAIK
      if (digitalRead(RELAY_PIN) == HIGH) {
        // Kipas sedang menyala, mulai atau lanjutkan hitungan 60 detik
        if (!timerBaikAktif) {
          timerBaikMulai = millis();
          timerBaikAktif = true;
          Serial.println("[KIPAS OTOMATIS] Status BAIK terdeteksi. Memulai hitungan 60 detik sebelum OFF...");
        } else {
          // Timer sedang berjalan, periksa apakah sudah genap 60.000 ms (60 detik)
          if (millis() - timerBaikMulai >= 60000) {
            digitalWrite(RELAY_PIN, LOW); // Matikan kipas exhaust
            timerBaikAktif = false;
            Serial.println("[KIPAS OTOMATIS] Kondisi BAIK stabil 60 detik. Kipas dimatikan (OFF).");
          }
        }
      } else {
        // Kipas memang sudah OFF dalam kondisi standby
        timerBaikAktif = false;
      }
    }
  }

  // 5. KIRIM DATA KE THINGSPEAK KANAL A (Tiap 20 detik)
  if (millis() - lastThingSpeakTime > 20000) {
    lastThingSpeakTime = millis();
    kirimDataThingSpeak();
  }

  // 6. TAMPILAN OLED LOKAL
  updateOLED();
}

// ================= FUNGSI BANTUAN =================

void kirimDataThingSpeak() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = "http://api.thingspeak.com/update?api_key=" + writeAPIKey +
                 "&field1=" + String(suhu) +
                 "&field2=" + String(kelembaban) +
                 "&field3=" + String(indeksGas) +
                 "&field4=" + String(debu) +
                 "&field5=" + String(statusUdara) +
                 "&field6=" + String(digitalRead(RELAY_PIN)) +
                 "&field7=" + String(pirTerakhir ? 1 : 0) +
                 "&field8=" + String(modeManual ? 1 : 0);
                 
    http.begin(url);
    int httpCode = http.GET();
    if (httpCode > 0) {
      Serial.println("Data terkirim ke ThingSpeak Kanal A!");
    } else {
      Serial.println("Gagal kirim data ke ThingSpeak.");
    }
    http.end();
  }
}

void bacaPerintahCloud() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = "http://api.thingspeak.com/channels/" + channelB_ID + "/feeds/last.json?api_key=" + readAPIKey;
    
    http.begin(url);
    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      // Parsing JSON sederhana (mencari field1 dan field2)
      int modeIndex = payload.indexOf("\"field1\":\"");
      int kipasIndex = payload.indexOf("\"field2\":\"");
      
      if (modeIndex > 0) {
        String modeStr = payload.substring(modeIndex + 10, modeIndex + 11);
        modeManual = (modeStr == "1");
      }
      if (kipasIndex > 0) {
        String kipasStr = payload.substring(kipasIndex + 10, kipasIndex + 11);
        if (modeManual) kipasState = (kipasStr == "1");
      }
    }
    http.end();
  }
}

void updateOLED() {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.print("Suhu: "); display.print(suhu, 1); display.println(" C");
  display.print("Lembab: "); display.print(kelembaban, 1); display.println(" %");
  display.print("Gas: "); display.print(indeksGas); display.println(" (0-100)");
  display.print("Debu: "); display.print(debu); display.println(" ug/m3");
  
  display.print("Status: ");
  if (statusUdara == 0) display.println("BAIK");
  else if (statusUdara == 1) display.println("SEDANG");
  else display.println("BURUK");
  
  display.print("Mode: ");
  display.print(modeManual ? "Manual" : "Otomatis");
  display.print(" | Fan: ");
  display.println(digitalRead(RELAY_PIN) ? "ON" : "OFF");
  
  // Tampilkan sisa waktu hitung mundur jika timer histeresis sedang berjalan
  if (!modeManual && timerBaikAktif) {
    long sisaDetik = 60 - ((millis() - timerBaikMulai) / 1000);
    if (sisaDetik < 0) sisaDetik = 0;
    display.print("Timer Off: ");
    display.print(sisaDetik);
    display.println("s");
  }
  
  display.display();
}
