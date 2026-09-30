Bisa. Masalah utamanya memang bukan sekadar jumlah data, tetapi **cara frontend meminta dan merender data historis**. Saya sarankan memisahkan mode **Realtime** untuk periode pendek dan mode **Historical Snapshot** untuk periode panjang, sekaligus membuat interface dan pilihan periode sepenuhnya dinamis dari `.env`.

Berikut prompt/PRD yang bisa langsung Anda berikan ke Antigravity untuk **memodifikasi aplikasi yang sudah ada**, bukan membuat ulang dari nol.

# PRD — Improvement MikroTik Traffic Monitor

## Dynamic Interface Configuration + Optimasi Traffic Graph

**Versi:** 1.1.0
**Platform:** Ubuntu Server / STB Ubuntu
**Jenis:** Web Application
**Basis:** Aplikasi MikroTik Traffic Monitor versi 1.0 yang SUDAH BERJALAN
**Tujuan:** Memperbaiki performa grafik trafik tanpa mengubah fokus utama aplikasi.

---

# 1. Instruksi Utama untuk AI Coding Agent

Aplikasi MikroTik Traffic Monitor versi 1.0 sudah dibuat dan berjalan.

**JANGAN membuat aplikasi baru dari awal.**

Lakukan modifikasi terhadap source code yang sudah ada.

Fokus perubahan hanya pada:

1. Optimasi Traffic Graph agar periode panjang tidak menyebabkan aplikasi lag.
2. Memisahkan mode realtime dan historical.
3. Membuat daftar interface sepenuhnya dinamis berdasarkan `.env`.
4. Membuat daftar pilihan periode grafik sepenuhnya dinamis berdasarkan `.env`.
5. Mengurangi request database yang tidak diperlukan.
6. Mengurangi jumlah data yang dikirim ke browser.
7. Mengurangi beban rendering chart pada browser.
8. Mempertahankan seluruh fitur versi 1.0 yang sudah berjalan.

**Jangan mengubah fitur lain di luar kebutuhan ini.**

---

# 2. Masalah Saat Ini

Pada versi 1.0:

* Grafik 5 menit masih ringan.
* Grafik 15 menit masih ringan.
* Grafik 30 menit masih dapat digunakan.
* Ketika memilih 1 jam atau lebih, aplikasi mulai terasa berat.
* Browser melakukan terlalu banyak request.
* Query database dapat mengambil terlalu banyak data.
* Chart harus merender terlalu banyak titik data.
* Jika grafik terus diperbarui secara realtime, periode panjang menyebabkan beban semakin besar.

Contoh:

Polling 5 detik:

```text
1 menit   = 12 titik
5 menit   = 60 titik
15 menit  = 180 titik
30 menit  = 360 titik
1 jam     = 720 titik
6 jam     = 4.320 titik
12 jam    = 8.640 titik
24 jam    = 17.280 titik
```

Jika beberapa interface ditampilkan sekaligus, jumlah data dan proses rendering menjadi semakin besar.

---

# 3. Tujuan Perubahan

Tujuan utama:

> **Grafik periode pendek tetap realtime, sedangkan grafik periode panjang menjadi historical snapshot yang tidak terus-menerus melakukan request database.**

Prinsip:

```text
5m
15m
30m
    ↓
REALTIME

1h
6h
12h
24h
    ↓
HISTORICAL / SNAPSHOT
```

Dengan demikian:

```text
Realtime graph
→ terus diperbarui

Historical graph
→ hanya mengambil data ketika periode dipilih
→ tidak melakukan polling terus-menerus
```

---

# 4. Prinsip Arsitektur Baru

Gunakan konsep:

```text
                  MikroTik
                     │
                     ▼
              Backend Worker
                     │
                     ▼
                  SQLite
                     │
             ┌───────┴────────┐
             │                │
             ▼                ▼
       Realtime API      Historical API
             │                │
             ▼                ▼
       Realtime Graph    Snapshot Graph
```

Browser tidak boleh melakukan polling database untuk periode panjang.

---

# 5. Dynamic Interface Configuration

Daftar interface HARUS sepenuhnya berasal dari `.env`.

Contoh:

```env
MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ,ether3-WAHED
```

Jika `.env` diubah menjadi:

```env
MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ,ether3-WAHED,ether4-ISP
```

frontend otomatis menampilkan:

```text
ether1-BAROKAH
ether2-BIZ
ether3-WAHED
ether4-ISP
```

Tidak boleh ada daftar interface hard-code di JavaScript.

---

# 6. Dynamic Interface Requirement

Backend harus menjadi sumber utama konfigurasi interface.

Frontend mendapatkan daftar interface dari backend.

Contoh:

```http
GET /api/config
```

Response:

```json
{
  "interfaces": [
    "ether1-BAROKAH",
    "ether2-BIZ",
    "ether3-WAHED"
  ]
}
```

Frontend kemudian membuat:

* Interface card.
* Filter interface grafik.
* Legend grafik.
* Selector interface.

berdasarkan response tersebut.

Jika jumlah interface berubah, frontend otomatis mengikuti.

---

# 7. Tidak Boleh Hard-Code Interface

Jangan melakukan:

```javascript
const interfaces = [
    "ether1-BAROKAH",
    "ether2-BIZ",
    "ether3-WAHED"
];
```

Gunakan:

```javascript
const interfaces = config.interfaces;
```

Backend juga tidak boleh mempunyai daftar interface kedua yang berbeda dari `.env`.

`.env` menjadi single source of truth.

---

# 8. Dynamic Graph Period Configuration

Pilihan periode grafik juga HARUS berasal dari `.env`.

Contoh:

```env
GRAPH_PERIODS=5m,15m,30m,1h,6h,12h,24h
```

Frontend otomatis membuat pilihan:

```text
5 Menit
15 Menit
30 Menit
1 Jam
6 Jam
12 Jam
24 Jam
```

Jika `.env` diubah:

```env
GRAPH_PERIODS=5m,10m,20m,1h,3h,6h,12h,24h,7d
```

frontend otomatis mengikuti konfigurasi tersebut.

Tidak boleh hard-code pilihan periode di frontend.

---

# 9. Format Graph Period

Backend harus memahami unit:

```text
m = menit
h = jam
d = hari
```

Contoh:

```text
5m
15m
30m
1h
6h
12h
24h
7d
```

Frontend menampilkan label yang mudah dibaca:

```text
5 Menit
15 Menit
30 Menit
1 Jam
6 Jam
12 Jam
24 Jam
7 Hari
```

Label dapat dibuat otomatis berdasarkan nilai periode.

---

# 10. Default Graph Period

Default:

```env
GRAPH_DEFAULT_PERIOD=15m
```

Jika ingin mengubah default:

```env
GRAPH_DEFAULT_PERIOD=30m
```

frontend mengikuti konfigurasi.

Pastikan default period harus terdapat di `GRAPH_PERIODS`.

Jika tidak terdapat, gunakan period pertama yang tersedia.

---

# 11. Realtime Threshold

Tambahkan konfigurasi:

```env
GRAPH_REALTIME_MAX=30m
```

Artinya:

```text
<= 30m
→ realtime

> 30m
→ historical snapshot
```

Contoh:

```text
5m   → REALTIME
15m  → REALTIME
30m  → REALTIME

1h   → HISTORICAL
6h   → HISTORICAL
12h  → HISTORICAL
24h  → HISTORICAL
```

Jangan hard-code `30m`.

Nilai harus berasal dari `.env`.

---

# 12. Realtime Graph Mode

Untuk periode yang berada di bawah atau sama dengan:

```env
GRAPH_REALTIME_MAX=30m
```

gunakan mode realtime.

Contoh:

```text
5m
15m
30m
```

Behavior:

```text
Backend polling MikroTik
        ↓
SQLite
        ↓
Frontend mengambil data terbaru
        ↓
Chart diperbarui
```

Interval update frontend dapat menggunakan:

```env
GRAPH_REFRESH_INTERVAL=5000
```

Default:

```text
5000 ms
```

---

# 13. Historical Graph Mode

Untuk periode lebih besar dari:

```env
GRAPH_REALTIME_MAX=30m
```

gunakan historical mode.

Contoh:

```text
1h
6h
12h
24h
```

Behavior:

```text
User memilih 24h
       ↓
Frontend request API
       ↓
Backend query SQLite
       ↓
Backend melakukan aggregation/downsampling
       ↓
Backend mengirim data ringkas
       ↓
Frontend render chart
       ↓
SELESAI
```

Setelah data ditampilkan:

**JANGAN melakukan polling otomatis.**

Browser tidak perlu terus meminta database.

---

# 14. Historical Mode Tidak Realtime

Jika user memilih:

```text
1h
6h
12h
24h
```

maka grafik dianggap sebagai snapshot.

Misalnya user memilih:

```text
24 Jam
```

Backend mengambil data 24 jam terakhir satu kali.

Setelah chart selesai ditampilkan:

```text
NO AUTO REFRESH
NO DATABASE POLLING
NO CHART RE-RENDER
```

Grafik hanya diperbarui jika:

1. User memilih periode lain.
2. User memilih interface lain.
3. User menekan tombol refresh historical.
4. Browser melakukan reload.

---

# 15. Tombol Refresh Historical

Pada historical mode, tampilkan tombol:

```text
↻ Refresh
```

Contoh:

```text
24 Jam    [↻ Refresh]
```

Ketika ditekan:

```text
GET /api/traffic
```

dijalankan kembali.

Tanpa tombol tersebut, tidak ada request berkala.

---

# 16. Informasi Mode Grafik

Tambahkan indikator kecil:

Untuk realtime:

```text
● LIVE
Updated 5 seconds ago
```

Untuk historical:

```text
● HISTORICAL
Snapshot: 30 Sep 2026 18:30
```

Tujuannya agar user mengetahui bahwa grafik 24 jam bukan realtime.

---

# 17. Backend Traffic API

API lama:

```http
GET /api/traffic
```

boleh dipertahankan.

Namun API harus mendukung mode:

```text
mode=realtime
mode=historical
```

Contoh:

```http
/api/traffic?interface=ether1-BAROKAH&period=15m&mode=realtime
```

dan:

```http
/api/traffic?interface=ether1-BAROKAH&period=24h&mode=historical
```

Jika mode tidak diberikan, backend boleh menentukan otomatis berdasarkan:

```env
GRAPH_REALTIME_MAX
```

---

# 18. Backend Harus Melakukan Aggregation

Jangan mengirim seluruh data 5 detik untuk periode panjang.

Contoh 24 jam:

```text
17.280 raw points
```

Jangan kirim semuanya ke browser.

Backend harus melakukan aggregation/downsampling.

Target jumlah titik:

```text
Realtime:
gunakan data asli

Historical:
maksimal sekitar 300–500 titik
```

Konfigurasi:

```env
GRAPH_MAX_POINTS=500
```

---

# 19. Contoh Aggregation

Jika user memilih:

```text
5m
```

dan data:

```text
5 detik
```

maka:

```text
60 titik
```

boleh dikirim apa adanya.

Untuk:

```text
1h
```

data:

```text
720 titik
```

dapat diubah menjadi:

```text
maksimal 500 titik
```

Untuk:

```text
24h
```

data:

```text
17.280 titik
```

menjadi sekitar:

```text
500 titik
```

---

# 20. Metode Aggregation

Gunakan metode sederhana dan efisien.

Pilihan yang direkomendasikan:

```text
time bucket averaging
```

atau:

```text
min/max/average
```

Untuk setiap bucket waktu:

```text
timestamp
avg_rx_bps
avg_tx_bps
```

Contoh:

```json
{
  "timestamp": "2026-09-30T18:00:00+07:00",
  "rx_bps": 125000000,
  "tx_bps": 18000000
}
```

Tidak perlu mengirim raw data apabila historical mode.

---

# 21. Historical Resolution Otomatis

Lebih baik gunakan resolusi otomatis berdasarkan periode.

Contoh:

```text
5m
→ 5 second

15m
→ 5 second

30m
→ 5 second

1h
→ 10 second / 15 second

6h
→ 1 minute

12h
→ 2 minute

24h
→ 5 minute
```

Nilai tersebut tidak wajib hard-code.

Boleh dibuat configurable melalui `.env`.

Contoh:

```env
GRAPH_RESOLUTION_5M=raw
GRAPH_RESOLUTION_15M=raw
GRAPH_RESOLUTION_30M=raw
GRAPH_RESOLUTION_1H=15s
GRAPH_RESOLUTION_6H=1m
GRAPH_RESOLUTION_12H=2m
GRAPH_RESOLUTION_24H=5m
```

Jika implementasi konfigurasi per periode terlalu kompleks, gunakan:

```env
GRAPH_MAX_POINTS=500
```

dan lakukan automatic downsampling.

Prioritas adalah kesederhanaan.

---

# 22. Jangan Query SQLite Terus-menerus

Realtime:

```text
boleh query data terbaru secara berkala
```

Historical:

```text
query sekali
↓
aggregation
↓
return
↓
STOP
```

Jangan melakukan:

```text
24h graph
↓
request DB
↓
5 detik
↓
request DB
↓
5 detik
↓
request DB
↓
...
```

---

# 23. Optimasi Frontend

Frontend harus menghindari render chart penuh jika tidak diperlukan.

Untuk realtime:

gunakan:

```text
update dataset
```

bukan selalu:

```text
destroy chart
create chart baru
```

Jika menggunakan Chart.js, pertahankan instance chart dan update data secara efisien.

Hindari:

```javascript
chart.destroy();
new Chart(...);
```

setiap polling.

---

# 24. Batas Data Realtime

Realtime graph hanya menampilkan data sesuai periode yang dipilih.

Contoh:

```text
5m
```

hanya menyimpan/menampilkan window:

```text
now - 5 minutes
```

Data lama tidak perlu dikirim ke browser.

---

# 25. Sliding Window Realtime

Jika realtime graph menggunakan polling 5 detik:

```text
08:00:00
08:00:05
08:00:10
...
```

ketika data baru masuk:

```text
hapus titik yang sudah keluar dari window
tambahkan titik baru
```

Contoh 5 menit:

```text
maksimal sekitar 60 titik
```

30 menit:

```text
maksimal sekitar 360 titik
```

Jangan terus menambahkan data tanpa batas.

---

# 26. Historical Cache

Jika memungkinkan, gunakan cache sederhana di backend untuk historical query.

Contoh:

```text
24h + ether1-BAROKAH
```

disimpan sementara.

Jika browser lain meminta query yang sama dalam waktu singkat:

```text
gunakan cache
```

tidak perlu query SQLite ulang.

Namun cache bukan keharusan.

Jika membuat cache terlalu kompleks, jangan digunakan.

Prioritas:

```text
SQLite query efisien
+
aggregation
+
no polling historical
```

---

# 27. Multi Browser

Pastikan behavior:

```text
PC
HP
Laptop
```

tetap tidak menyebabkan worker MikroTik baru.

Tetap:

```text
1 MikroTik polling worker
```

Sedangkan browser hanya membaca API backend.

---

# 28. Dynamic Interface Card

Semua interface card harus dibuat berdasarkan:

```env
MONITORED_INTERFACES
```

Contoh:

```env
MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ
```

Frontend hanya menampilkan:

```text
ether1-BAROKAH
ether2-BIZ
```

Jika:

```env
MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ,ether3-WAHED,ether4-FOO
```

frontend otomatis menampilkan 4 card.

Tidak perlu mengubah JavaScript.

---

# 29. Dynamic Interface Graph Filter

Dropdown:

```text
Semua Interface
ether1-BAROKAH
ether2-BIZ
ether3-WAHED
```

harus dibuat otomatis dari API configuration.

Jika interface bertambah:

```text
ether4-FOO
```

dropdown otomatis menjadi:

```text
Semua Interface
ether1-BAROKAH
ether2-BIZ
ether3-WAHED
ether4-FOO
```

---

# 30. Semua Interface Mode

Jika user memilih:

```text
Semua Interface
```

backend boleh mengambil data untuk semua interface dalam satu request.

Contoh:

```http
/api/traffic?interface=all&period=24h
```

Backend melakukan aggregation per interface.

Response:

```json
{
  "period": "24h",
  "mode": "historical",
  "interfaces": {
    "ether1-BAROKAH": [],
    "ether2-BIZ": [],
    "ether3-WAHED": []
  }
}
```

Jangan membuat satu request HTTP untuk setiap interface jika dapat dihindari.

---

# 31. Satu Request Lebih Diutamakan

Hindari:

```text
GET /api/traffic?interface=ether1
GET /api/traffic?interface=ether2
GET /api/traffic?interface=ether3
```

untuk kebutuhan satu grafik "Semua Interface".

Lebih baik:

```text
GET /api/traffic?interface=all&period=24h
```

Backend mengembalikan seluruh data yang diperlukan.

---

# 32. API Configuration

Tambahkan endpoint:

```http
GET /api/config
```

Contoh response:

```json
{
  "interfaces": [
    "ether1-BAROKAH",
    "ether2-BIZ",
    "ether3-WAHED"
  ],
  "graph_periods": [
    {
      "value": "5m",
      "label": "5 Menit",
      "mode": "realtime"
    },
    {
      "value": "15m",
      "label": "15 Menit",
      "mode": "realtime"
    },
    {
      "value": "30m",
      "label": "30 Menit",
      "mode": "realtime"
    },
    {
      "value": "1h",
      "label": "1 Jam",
      "mode": "historical"
    },
    {
      "value": "6h",
      "label": "6 Jam",
      "mode": "historical"
    },
    {
      "value": "12h",
      "label": "12 Jam",
      "mode": "historical"
    },
    {
      "value": "24h",
      "label": "24 Jam",
      "mode": "historical"
    }
  ],
  "default_period": "15m",
  "realtime_max": "30m",
  "poll_interval": 5
}
```

Frontend menggunakan response ini sebagai sumber konfigurasi.

---

# 33. Environment Variables Baru

Pertahankan konfigurasi lama dan tambahkan:

```env
# MikroTik
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=monitor
MIKROTIK_PASSWORD=password
MIKROTIK_USE_SSL=false

# Interfaces
MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ,ether3-WAHED

# Polling
POLL_INTERVAL=5

# Database
DATABASE_PATH=./data/traffic.db

# Web
WEB_HOST=0.0.0.0
WEB_PORT=8080

# Graph
GRAPH_PERIODS=5m,15m,30m,1h,6h,12h,24h
GRAPH_DEFAULT_PERIOD=15m
GRAPH_REALTIME_MAX=30m
GRAPH_REFRESH_INTERVAL=5000
GRAPH_MAX_POINTS=500
```

---

# 34. Contoh Konfigurasi Alternatif

User dapat mengubah:

```env
GRAPH_PERIODS=5m,10m,20m,30m,1h,3h,6h,12h,24h
```

tanpa mengubah source code.

Atau:

```env
GRAPH_PERIODS=5m,15m,30m,1h,6h,12h,24h,7d
```

Frontend harus tetap bekerja.

---

# 35. Validasi Environment

Backend harus memvalidasi konfigurasi saat startup.

Contoh:

```text
GRAPH_DEFAULT_PERIOD
```

harus terdapat dalam:

```text
GRAPH_PERIODS
```

Jika tidak:

```text
WARNING Invalid GRAPH_DEFAULT_PERIOD
```

kemudian gunakan periode pertama sebagai fallback.

---

# 36. Validasi Realtime Threshold

Pastikan:

```text
GRAPH_REALTIME_MAX
```

merupakan periode yang valid.

Contoh:

```text
30m
```

Jika konfigurasi:

```text
GRAPH_REALTIME_MAX=1h
```

maka:

```text
5m
15m
30m
1h
```

menjadi realtime.

Sedangkan:

```text
6h
12h
24h
```

menjadi historical.

---

# 37. Database Optimization

Pastikan query menggunakan index.

Minimal:

```sql
CREATE INDEX IF NOT EXISTS idx_traffic_timestamp
ON traffic_data(timestamp);

CREATE INDEX IF NOT EXISTS idx_traffic_interface_timestamp
ON traffic_data(interface_name, timestamp);
```

Untuk query:

```text
interface + time range
```

gunakan:

```text
interface_name
+
timestamp
```

sehingga SQLite tidak melakukan full table scan jika tidak diperlukan.

---

# 38. Query Historical

Jangan mengambil data lebih banyak daripada yang diperlukan.

Jika user meminta:

```text
24h
```

query hanya:

```text
NOW - 24 HOURS
```

sampai:

```text
NOW
```

Jangan mengambil seluruh database kemudian melakukan filtering di Python.

---

# 39. Downsampling Backend

Historical data harus diproses sebelum dikirim ke frontend.

Contoh:

```text
SQLite
17.280 records
       ↓
aggregation
       ↓
500 records
       ↓
JSON
       ↓
Browser
```

Bukan:

```text
SQLite
17.280 records
       ↓
JSON 17.280 records
       ↓
Browser
       ↓
JavaScript aggregation
```

Prioritaskan backend aggregation agar browser STB/HP tidak bekerja terlalu berat.

---

# 40. Payload API

Jangan mengirim field yang tidak diperlukan untuk grafik.

Historical graph cukup:

```json
{
  "timestamp": "...",
  "rx_bps": 125000000,
  "tx_bps": 18000000
}
```

Tidak perlu mengirim:

```text
rx_bytes
tx_bytes
id
interface_name
```

berulang kali jika sudah tersedia pada parent object.

---

# 41. Loading State

Ketika historical graph sedang mengambil data:

tampilkan:

```text
Loading historical data...
```

Jangan membuat browser terlihat hang.

Setelah selesai:

```text
24 Jam
● HISTORICAL
Snapshot: 18:35
```

---

# 42. Error Historical

Jika query historical gagal:

```text
Unable to load historical traffic data.
```

Tetap pertahankan dashboard.

Jangan menyebabkan seluruh aplikasi crash.

---

# 43. Empty Data

Jika tidak ada data:

```text
No traffic data available for this period.
```

Jangan menampilkan chart kosong yang membingungkan.

---

# 44. Perilaku Ketika MikroTik Offline

Jika MikroTik offline:

Realtime graph:

```text
STOP receiving new points
```

Historical graph:

```text
Tetap dapat membaca data SQLite
```

Ini penting.

MikroTik offline tidak berarti historical data hilang.

---

# 45. Historical Data Saat MikroTik Offline

Contoh:

```text
MikroTik OFFLINE
```

User memilih:

```text
24 Jam
```

Backend tetap boleh mengembalikan:

```text
data terakhir yang tersedia
```

Jika tidak ada data terbaru, jangan mengarang data.

Tampilkan:

```text
Historical data
Last recorded:
18:20:05
```

---

# 46. Frontend Timer Management

Pastikan ketika user berpindah:

```text
30m → 24h
```

timer realtime dihentikan.

Ketika:

```text
24h → 15m
```

timer realtime dibuat kembali.

Jangan membuat timer baru tanpa membersihkan timer lama.

Hindari:

```text
setInterval()
setInterval()
setInterval()
```

yang berjalan bersamaan.

Gunakan satu mekanisme polling frontend yang terkontrol.

---

# 47. Page Visibility Optimization

Jika browser berada di background/tab tidak aktif:

boleh menghentikan atau mengurangi refresh realtime.

Contoh:

```text
Browser visible
→ realtime 5 detik

Browser hidden
→ hentikan refresh

Browser visible kembali
→ ambil data terbaru
```

Ini opsional tetapi sangat direkomendasikan.

Tujuannya mengurangi beban CPU dan request.

---

# 48. Chart Rendering Optimization

Gunakan konfigurasi Chart.js yang efisien.

Contoh prinsip:

```text
animation: false
responsive: true
maintainAspectRatio: false
```

Untuk realtime graph:

```text
disable unnecessary animation
```

Jangan menggunakan animasi berat.

---

# 49. Jangan Re-render Seluruh Dashboard

Ketika data trafik berubah:

Jangan:

```text
reload page
```

Jangan:

```text
rebuild seluruh HTML
```

Update hanya:

```text
RX
TX
status
chart
last update
```

---

# 50. Acceptance Criteria Baru

## Dynamic Interface

* [ ] Interface berasal dari `.env`.
* [ ] Tidak ada hard-coded interface di frontend.
* [ ] Jumlah interface dapat berubah tanpa mengubah source code.
* [ ] Nama interface mengikuti `.env`.
* [ ] Interface card otomatis mengikuti konfigurasi.
* [ ] Graph filter otomatis mengikuti konfigurasi.

## Dynamic Period

* [ ] Period berasal dari `.env`.
* [ ] Tidak ada hard-coded period di frontend.
* [ ] Label period dibuat otomatis.
* [ ] Default period configurable.
* [ ] Realtime threshold configurable.

## Realtime

* [ ] 5m realtime.
* [ ] 15m realtime.
* [ ] 30m realtime.
* [ ] Realtime threshold configurable.
* [ ] Data baru masuk tanpa reload page.
* [ ] Sliding window digunakan.
* [ ] Tidak ada duplicate timer.

## Historical

* [ ] 1h dapat digunakan.
* [ ] 6h dapat digunakan.
* [ ] 12h dapat digunakan.
* [ ] 24h dapat digunakan.
* [ ] Historical tidak melakukan polling otomatis.
* [ ] Historical hanya request ketika dibutuhkan.
* [ ] Ada tombol refresh manual.
* [ ] Historical menggunakan aggregation/downsampling.

## Performance

* [ ] Browser tidak menerima ribuan data mentah untuk periode panjang.
* [ ] Historical maksimal sekitar `GRAPH_MAX_POINTS`.
* [ ] SQLite menggunakan index.
* [ ] Query dibatasi time range.
* [ ] Chart tidak dibuat ulang setiap polling.
* [ ] Tidak ada polling database untuk historical.
* [ ] Tidak ada duplicate polling worker.

## Multi Browser

* [ ] PC tidak membuat worker MikroTik baru.
* [ ] HP tidak membuat worker MikroTik baru.
* [ ] Laptop tidak membuat worker MikroTik baru.
* [ ] Backend tetap memiliki satu polling worker.

---

# 51. Target Performa

Dengan konfigurasi default:

```env
GRAPH_PERIODS=5m,15m,30m,1h,6h,12h,24h
GRAPH_REALTIME_MAX=30m
GRAPH_MAX_POINTS=500
```

Behavior harus:

```text
5m
→ realtime
→ ±60 points

15m
→ realtime
→ ±180 points

30m
→ realtime
→ ±360 points

1h
→ historical
→ <=500 points

6h
→ historical
→ <=500 points

12h
→ historical
→ <=500 points

24h
→ historical
→ <=500 points
```

Dengan demikian jumlah data yang dirender browser tetap terkendali.

---

# 52. Backward Compatibility

Jangan merusak:

* MikroTik connection.
* Polling worker backend.
* SQLite.
* Dashboard interface card.
* RX/TX calculation.
* Status MikroTik.
* Systemd.
* `.env`.
* README.
* Existing API yang masih digunakan.

Jika API perlu diubah, pertahankan compatibility sebisa mungkin.

---

# 53. Testing Wajib

Buat test untuk:

### Configuration

```text
MONITORED_INTERFACES
GRAPH_PERIODS
GRAPH_DEFAULT_PERIOD
GRAPH_REALTIME_MAX
GRAPH_MAX_POINTS
```

### Mode Detection

Test:

```text
5m  → realtime
15m → realtime
30m → realtime
1h  → historical
6h  → historical
12h → historical
24h → historical
```

Dengan threshold:

```text
GRAPH_REALTIME_MAX=30m
```

### Dynamic Interface

Test:

```text
2 interface
3 interface
5 interface
```

Pastikan frontend/backend tidak mengasumsikan selalu 3 interface.

### Aggregation

Test:

```text
1.000 records
10.000 records
20.000 records
```

hasil tidak boleh melebihi:

```text
GRAPH_MAX_POINTS
```

### Historical API

Pastikan:

```text
24h
```

tidak mengembalikan seluruh raw record jika melebihi batas.

### Timer

Pastikan:

```text
realtime → historical
```

menghentikan timer.

Dan:

```text
historical → realtime
```

membuat satu timer saja.

---

# 54. Recommended UI

Contoh:

```text
┌─────────────────────────────────────────────────────┐
│ MIKROTIK TRAFFIC MONITOR                            │
│                                                     │
│ ● ONLINE                       Last update 18:35:10 │
└─────────────────────────────────────────────────────┘


INTERFACES

┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ BAROKAH       │ │ BIZ           │ │ WAHED         │
│ ● RUNNING     │ │ ● RUNNING     │ │ ● RUNNING     │
│               │ │               │ │               │
│ RX 125 Mbps   │ │ RX 85 Mbps    │ │ RX 42 Mbps    │
│ TX 18 Mbps    │ │ TX 12 Mbps    │ │ TX 8 Mbps     │
└───────────────┘ └───────────────┘ └───────────────┘


TRAFFIC GRAPH

Interface:
[ Semua Interface ▼ ]

Period:
[ 15 Menit ▼ ]

● LIVE
Updated 5 seconds ago


             TRAFFIC GRAPH
       RX ───────────────
       TX ───────────────


Jika memilih 24 Jam:

Interface:
[ Semua Interface ▼ ]

Period:
[ 24 Jam ▼ ]

● HISTORICAL
Snapshot: 18:35:10

                         [ ↻ Refresh ]

             TRAFFIC GRAPH
       RX ───────────────
       TX ───────────────
```

---

# 55. Prioritas Implementasi

Urutan implementasi:

### P0

1. Dynamic interface dari `.env`.
2. Dynamic graph periods dari `.env`.
3. Realtime/historical mode.
4. Historical no polling.
5. Backend aggregation.
6. `GRAPH_MAX_POINTS`.
7. Frontend timer management.

### P1

8. Historical refresh button.
9. `/api/config`.
10. Loading state.
11. Empty state.
12. Chart optimization.
13. Page visibility optimization.

### P2

14. Historical caching.
15. Per-period resolution configuration.

P2 tidak boleh menghambat P0.

---

# 56. Environment Final Example

Gunakan contoh berikut sebagai baseline:

```env
# ==========================================
# MikroTik
# ==========================================

MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=monitor
MIKROTIK_PASSWORD=password
MIKROTIK_USE_SSL=false


# ==========================================
# Interfaces
# ==========================================

MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ,ether3-WAHED


# ==========================================
# MikroTik Polling
# ==========================================

POLL_INTERVAL=5


# ==========================================
# Database
# ==========================================

DATABASE_PATH=./data/traffic.db


# ==========================================
# Web
# ==========================================

WEB_HOST=0.0.0.0
WEB_PORT=8080


# ==========================================
# Graph
# ==========================================

GRAPH_PERIODS=5m,15m,30m,1h,6h,12h,24h

GRAPH_DEFAULT_PERIOD=15m

GRAPH_REALTIME_MAX=30m

GRAPH_REFRESH_INTERVAL=5000

GRAPH_MAX_POINTS=500
```

---

# 57. Instruksi Akhir untuk AI Coding Agent

Setelah membaca PRD ini:

1. Inspect source code aplikasi versi 1.0 yang sudah ada.
2. Jangan membuat project baru.
3. Identifikasi bagian backend traffic API.
4. Identifikasi polling worker.
5. Identifikasi query SQLite.
6. Identifikasi frontend chart.
7. Identifikasi timer/polling frontend.
8. Identifikasi konfigurasi `.env`.
9. Implementasikan perubahan seminimal mungkin.
10. Pertahankan fitur yang sudah berjalan.
11. Jangan menambahkan fitur di luar PRD.

Kemudian lakukan:

```text
1. Dynamic interface configuration
2. Dynamic graph period configuration
3. Realtime mode
4. Historical mode
5. Historical aggregation
6. Graph max points
7. Frontend timer management
8. Historical manual refresh
9. API config endpoint
10. Performance optimization
11. Unit tests
12. Integration tests
13. Update README
14. Update .env.example
```

Setelah implementasi:

```text
Run tests
↓
Run application
↓
Test realtime 5m
↓
Test realtime 15m
↓
Test realtime 30m
↓
Test historical 1h
↓
Test historical 6h
↓
Test historical 12h
↓
Test historical 24h
↓
Test switching period repeatedly
↓
Test switching interface repeatedly
↓
Test multiple browser
↓
Test MikroTik offline
↓
Check CPU/RAM
↓
Fix any performance issue
```

## Hasil Akhir yang Diharapkan

Aplikasi harus memiliki behavior:

```text
                    TRAFFIC GRAPH
                          │
             ┌────────────┴────────────┐
             │                         │
          <=30m                       >30m
             │                         │
             ▼                         ▼
        REALTIME                   HISTORICAL
             │                         │
       Auto refresh                Load once
             │                         │
        Every 5 sec               No polling
             │                         │
       Sliding window            Aggregated
             │                         │
       Max raw points             Max 500 points
             │                         │
             ▼                         ▼
        5m / 15m / 30m           1h / 6h / 12h / 24h
```

Dan seluruh konfigurasi:

```text
Interface
Period
Default period
Realtime threshold
Refresh interval
Maximum graph points
```

harus dapat dikontrol melalui `.env`.

**Jangan hard-code jumlah interface.**

**Jangan hard-code pilihan periode.**

**Jangan melakukan polling database terus-menerus untuk historical graph.**

**Jangan mengirim ribuan raw records ke browser untuk periode panjang.**

**Jangan membuat polling worker MikroTik tambahan.**

Prioritas utama:

> **Ringan di STB, ringan di SQLite, ringan di browser, tetapi tetap realtime untuk periode pendek dan tetap memiliki historical graph untuk periode panjang.**

Menurut saya, desain **Realtime ≤ 30 menit + Historical > 30 menit + backend downsampling** adalah pilihan yang paling aman untuk aplikasi Anda. Bahkan jika nanti Anda menambahkan `7d` atau `30d`, browser tetap tidak akan menerima puluhan ribu titik data.

Yang paling penting dari PRD ini adalah **`GRAPH_MAX_POINTS=500` dan historical tidak dipolling**. Jadi 24 jam tetap bisa ditampilkan tanpa membuat Chart.js harus merender 17.280 titik per interface.
