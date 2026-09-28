````markdown
# PRD — MikroTik Traffic Monitor

## 1. Informasi Produk

**Nama Produk:** MikroTik Traffic Monitor  
**Versi:** 1.0.0  
**Platform:** Linux Ubuntu Server / STB Ubuntu  
**Jenis:** Web Application  
**Fokus:** Monitoring trafik interface MikroTik  
**Database:** SQLite  
**Akses:** Browser melalui jaringan lokal

---

# 2. Ringkasan Produk

MikroTik Traffic Monitor adalah aplikasi web ringan yang digunakan untuk memonitor trafik jaringan dari router MikroTik melalui MikroTik RouterOS API.

Aplikasi akan berjalan pada STB yang menggunakan Ubuntu Linux dan dapat diakses melalui browser menggunakan alamat IP STB.

Aplikasi hanya memonitor tiga interface MikroTik:

1. `ether1-BAROKAH`
2. `ether2-BIZ`
3. `ether3-WAHED`

Aplikasi tidak digunakan untuk melakukan konfigurasi atau perubahan pada MikroTik.

Fokus utama aplikasi:

- Monitoring trafik RX/download.
- Monitoring trafik TX/upload.
- Monitoring trafik secara realtime.
- Grafik trafik dari waktu ke waktu.
- Penyimpanan data historis.
- Menampilkan status koneksi MikroTik.
- Menampilkan status interface yang dimonitor.

---

# 3. Tujuan Produk

## 3.1 Tujuan Utama

Menyediakan dashboard sederhana untuk mengetahui kondisi trafik jaringan pada tiga interface MikroTik secara realtime dan historis.

## 3.2 Tujuan Teknis

Aplikasi harus:

- Ringan dijalankan pada STB Ubuntu.
- Tidak membutuhkan resource besar.
- Mudah diinstal.
- Mudah dikonfigurasi.
- Mudah dipelihara.
- Dapat berjalan sebagai systemd service.
- Tetap menyimpan data historis setelah browser ditutup.
- Tetap dapat berjalan ketika MikroTik sementara tidak tersedia.
- Tidak melakukan konfigurasi apa pun terhadap MikroTik.

---

# 4. Scope Produk

## 4.1 Fitur yang Termasuk

### A. MikroTik API Connection

Aplikasi dapat terhubung ke MikroTik melalui RouterOS API.

Konfigurasi:

```env
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=monitor
MIKROTIK_PASSWORD=password
````

Opsional:

```env
MIKROTIK_USE_SSL=false
```

Aplikasi harus mendukung API port yang dapat dikonfigurasi.

---

### B. Interface Monitoring

Hanya interface berikut yang dimonitor:

```text
ether1-BAROKAH
ether2-BIZ
ether3-WAHED
```

Aplikasi tidak boleh menampilkan interface lain dari MikroTik.

Daftar interface harus disimpan sebagai konfigurasi aplikasi sehingga tidak perlu melakukan hard-code di banyak tempat.

Contoh:

```env
MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ,ether3-WAHED
```

---

### C. Realtime Traffic Monitoring

Aplikasi mengambil counter trafik dari MikroTik secara berkala.

Data utama:

* RX Bytes
* TX Bytes
* RX Bandwidth
* TX Bandwidth
* Interface Status

Polling default:

```env
POLL_INTERVAL=5
```

Artinya aplikasi mengambil data setiap 5 detik.

Polling interval harus dapat dikonfigurasi.

Nilai minimum yang direkomendasikan:

```text
5 detik
```

Jangan melakukan polling terlalu agresif.

---

# 5. Perhitungan Bandwidth

MikroTik memberikan counter:

```text
rx-byte
tx-byte
```

Counter tersebut bersifat kumulatif.

Aplikasi harus menghitung bandwidth berdasarkan perubahan counter.

Formula:

```text
RX bps =
(current_rx_bytes - previous_rx_bytes) * 8
/ elapsed_seconds
```

```text
TX bps =
(current_tx_bytes - previous_tx_bytes) * 8
/ elapsed_seconds
```

Contoh:

```text
RX sebelumnya = 100 MB
RX sekarang   = 110 MB
Interval      = 5 detik

Traffic:
(110 - 100) MB × 8 / 5

≈ 16 Mbps
```

Jangan menampilkan counter bytes sebagai bandwidth.

---

# 6. Satuan Trafik

Bandwidth harus diformat secara otomatis.

Gunakan:

```text
bps
Kbps
Mbps
Gbps
```

Contoh:

```text
512 Kbps
12.45 Mbps
105.32 Mbps
1.25 Gbps
```

Aturan:

```text
< 1 Kbps      → bps
1 Kbps–999 Kbps → Kbps
1 Mbps–999 Mbps → Mbps
>= 1 Gbps     → Gbps
```

Gunakan maksimal 2 angka desimal pada dashboard.

---

# 7. Dashboard

Dashboard adalah halaman utama aplikasi.

Tidak diperlukan halaman yang kompleks.

## Layout

```text
====================================================

             MIKROTIK TRAFFIC MONITOR

====================================================

MikroTik:
● ONLINE

Last Update:
08:30:25

----------------------------------------------------

ETHER1-BAROKAH

Status       RUNNING

DOWNLOAD
125.40 Mbps

UPLOAD
18.72 Mbps

----------------------------------------------------

ETHER2-BIZ

Status       RUNNING

DOWNLOAD
85.21 Mbps

UPLOAD
12.43 Mbps

----------------------------------------------------

ETHER3-WAHED

Status       RUNNING

DOWNLOAD
42.15 Mbps

UPLOAD
8.31 Mbps

----------------------------------------------------

TRAFFIC GRAPH

[ Grafik ]

----------------------------------------------------
```

---

# 8. Interface Card

Setiap interface ditampilkan dalam sebuah card.

Contoh:

```text
ether1-BAROKAH

● RUNNING

RX
125.40 Mbps

TX
18.72 Mbps
```

Card harus menampilkan:

* Nama interface.
* Status.
* RX.
* TX.

Status:

```text
RUNNING
NOT RUNNING
NOT FOUND
UNKNOWN
```

---

# 9. Status MikroTik

Dashboard harus menampilkan status koneksi MikroTik.

Status:

```text
ONLINE
OFFLINE
CONNECTING
```

Jika MikroTik offline:

```text
MIKROTIK OFFLINE

Last successful update:
08:25:12
```

Aplikasi tidak boleh crash ketika MikroTik offline.

Backend harus mencoba reconnect secara otomatis.

---

# 10. Grafik Trafik

Grafik merupakan fitur utama aplikasi.

Gunakan line chart.

Grafik minimal memiliki:

```text
RX
TX
```

Sumbu X:

```text
Waktu
```

Sumbu Y:

```text
Bandwidth
```

---

# 11. Pilihan Interface Grafik

Dashboard menyediakan filter:

```text
[ Semua Interface ]

[ ether1-BAROKAH ]

[ ether2-BIZ ]

[ ether3-WAHED ]
```

Jika:

```text
Semua Interface
```

dipilih, tampilkan trafik ketiga interface.

Jika interface tertentu dipilih, hanya tampilkan interface tersebut.

---

# 12. Pilihan Periode Grafik

Sediakan pilihan:

```text
5 Menit
15 Menit
30 Menit
1 Jam
6 Jam
12 Jam
24 Jam
```

Default:

```text
15 Menit
```

---

# 13. Realtime Graph

Grafik harus diperbarui otomatis ketika data baru tersedia.

Default polling:

```text
5 detik
```

Ketika data baru diterima:

1. Backend menyimpan data.
2. Frontend mengambil data terbaru.
3. Grafik diperbarui.
4. Tidak perlu reload halaman.

Gunakan mekanisme ringan.

Tidak diperlukan WebSocket jika polling HTTP sudah mencukupi.

---

# 14. Historical Data

Aplikasi harus menyimpan data trafik ke SQLite.

Data minimal:

```text
id
timestamp
interface_name
rx_bytes
tx_bytes
rx_bps
tx_bps
```

Contoh:

```text
1
2026-09-28 08:30:00
ether1-BAROKAH
152345678
28345678
125400000
18720000
```

---

# 15. Database

Gunakan:

```text
SQLite
```

Alasan:

* Ringan.
* Tidak membutuhkan database server terpisah.
* Cocok untuk STB.
* Mudah backup.
* Mudah dipindahkan.
* Resource rendah.

Lokasi default:

```text
data/traffic.db
```

Lokasi dapat dikonfigurasi melalui:

```env
DATABASE_PATH=./data/traffic.db
```

---

# 16. Database Index

Untuk menjaga performa query, buat index minimal:

```text
timestamp
interface_name
timestamp + interface_name
```

Contoh:

```sql
CREATE INDEX idx_traffic_timestamp
ON traffic_data(timestamp);

CREATE INDEX idx_traffic_interface
ON traffic_data(interface_name);

CREATE INDEX idx_traffic_interface_timestamp
ON traffic_data(interface_name, timestamp);
```

---

# 17. Data Retention

Karena aplikasi berjalan pada STB, database tidak boleh bertambah tanpa batas.

Implementasikan cleanup otomatis.

Minimum:

```text
Data detail:
24 jam
```

Data lebih lama dapat dihapus jika belum ada mekanisme aggregation.

Jika memungkinkan, implementasikan aggregation:

```text
0–24 jam:
data 5 detik

1–7 hari:
data agregasi 1 menit

8–30 hari:
data agregasi 5 menit
```

Namun:

**Prioritas utama adalah stabilitas dan penggunaan resource rendah.**

Jika aggregation membuat sistem terlalu kompleks, gunakan retention sederhana.

---

# 18. REST API

Backend harus menyediakan REST API internal.

## GET /api/status

Mengembalikan status aplikasi dan MikroTik.

Contoh:

```json
{
  "mikrotik": "online",
  "last_update": "2026-09-28T08:30:25+07:00"
}
```

---

## GET /api/interfaces

Mengembalikan tiga interface yang dimonitor.

Contoh:

```json
{
  "interfaces": [
    {
      "name": "ether1-BAROKAH",
      "status": "running",
      "rx_bps": 125400000,
      "tx_bps": 18720000
    },
    {
      "name": "ether2-BIZ",
      "status": "running",
      "rx_bps": 85210000,
      "tx_bps": 12430000
    },
    {
      "name": "ether3-WAHED",
      "status": "running",
      "rx_bps": 42150000,
      "tx_bps": 8310000
    }
  ]
}
```

---

## GET /api/traffic

Parameter:

```text
interface
period
```

Contoh:

```text
/api/traffic?interface=ether1-BAROKAH&period=15m
```

atau:

```text
/api/traffic?interface=all&period=1h
```

Response:

```json
{
  "interface": "ether1-BAROKAH",
  "period": "15m",
  "data": [
    {
      "timestamp": "2026-09-28T08:20:00+07:00",
      "rx_bps": 120000000,
      "tx_bps": 18000000
    },
    {
      "timestamp": "2026-09-28T08:20:05+07:00",
      "rx_bps": 125000000,
      "tx_bps": 19000000
    }
  ]
}
```

---

# 19. Backend Architecture

Arsitektur:

```text
                   Browser
                      |
                      |
                    HTTP
                      |
                      v
             +----------------+
             |    FastAPI     |
             +----------------+
                 /       \
                /         \
               v           v
          SQLite DB     MikroTik API
                           |
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
       ether1-BAROKAH  ether2-BIZ  ether3-WAHED
```

---

# 20. Polling Worker

Backend harus memiliki background worker untuk mengambil data dari MikroTik.

Flow:

```text
START
  |
  v
Connect MikroTik
  |
  v
Ambil statistik interface
  |
  v
Hitung RX/TX bps
  |
  v
Simpan SQLite
  |
  v
Sleep 5 detik
  |
  v
Ulangi
```

Jika koneksi gagal:

```text
Connect
   |
   X
FAILED
   |
   v
Set status OFFLINE
   |
   v
Wait
   |
   v
Reconnect
```

---

# 21. Anti Duplicate Polling

Pastikan hanya terdapat satu polling worker aktif.

Jangan sampai terjadi:

```text
Worker 1
Worker 2
Worker 3
Worker 4
```

yang mengambil data MikroTik secara bersamaan.

Aplikasi harus menggunakan satu background polling loop.

---

# 22. Error Handling

## MikroTik Offline

Jika MikroTik tidak dapat dihubungi:

```text
MIKROTIK OFFLINE
```

Tetap tampilkan:

```text
Last successful update
```

Data historis tetap dapat dibaca dari SQLite.

---

## Interface Tidak Ditemukan

Jika interface tidak ditemukan:

```text
ether1-BAROKAH

NOT FOUND
```

Interface lain tetap berjalan.

Contoh:

```text
ether1-BAROKAH → NOT FOUND
ether2-BIZ     → RUNNING
ether3-WAHED   → RUNNING
```

---

## API Timeout

Gunakan timeout yang wajar.

Jangan membuat polling worker menunggu tanpa batas.

Jika timeout:

1. Catat error.
2. Tandai koneksi sebagai offline/temporary error.
3. Tunggu interval berikutnya.
4. Coba reconnect.

---

# 23. Logging

Gunakan logging sederhana.

Minimal log:

```text
INFO
WARNING
ERROR
```

Contoh:

```text
INFO  MikroTik connected
INFO  Monitoring 3 interfaces
INFO  Traffic polling started
WARNING MikroTik connection lost
INFO  Reconnecting...
INFO  MikroTik connection restored
ERROR Interface ether1-BAROKAH not found
```

Jangan mencatat password MikroTik ke log.

---

# 24. Security

Credential MikroTik harus berada di `.env`.

Contoh:

```env
MIKROTIK_USERNAME=monitor
MIKROTIK_PASSWORD=xxxxxxxx
```

Jangan:

```python
password = "123456"
```

di source code.

Tambahkan:

```text
.env
```

ke `.gitignore`.

Frontend tidak boleh menerima:

```text
MIKROTIK_PASSWORD
```

atau credential lainnya.

---

# 25. MikroTik User Permission

Disarankan membuat user MikroTik khusus monitoring.

User tersebut hanya membutuhkan permission untuk membaca informasi interface/statistik.

Tidak membutuhkan permission:

```text
write
policy
sensitive
ftp
reboot
password
```

Gunakan prinsip least privilege.

---

# 26. Teknologi

Gunakan stack yang ringan.

Rekomendasi:

### Backend

```text
Python
FastAPI
```

### Database

```text
SQLite
```

### MikroTik API

Gunakan library Python yang stabil untuk RouterOS API.

### Frontend

Gunakan:

```text
HTML
CSS
JavaScript
```

Gunakan library chart yang ringan, misalnya:

```text
Chart.js
```

Jangan menggunakan frontend framework berat jika tidak diperlukan.

Tidak perlu:

```text
React
Next.js
Angular
Vue
```

kecuali terdapat alasan teknis yang benar-benar kuat.

Prioritaskan kesederhanaan.

---

# 27. Struktur Project

Struktur yang direkomendasikan:

```text
mikrotik-traffic-monitor/
│
├── app/
│   ├── __init__.py
│   ├── main.py
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── status.py
│   │   ├── interfaces.py
│   │   └── traffic.py
│   │
│   ├── mikrotik/
│   │   ├── __init__.py
│   │   ├── client.py
│   │   └── monitor.py
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   ├── database.py
│   │   └── models.py
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── traffic_service.py
│   │   └── cleanup_service.py
│   │
│   ├── config.py
│   └── templates/
│       └── index.html
│
├── static/
│   ├── css/
│   │   └── style.css
│   │
│   └── js/
│       ├── dashboard.js
│       └── chart.js
│
├── data/
│   └── traffic.db
│
├── tests/
│   ├── test_api.py
│   ├── test_traffic.py
│   └── test_database.py
│
├── .env
├── .env.example
├── .gitignore
├── requirements.txt
├── README.md
└── mikrotik-traffic-monitor.service
```

Struktur boleh disederhanakan jika implementasi membutuhkan struktur yang lebih ringan.

---

# 28. Environment Configuration

File:

```text
.env
```

Contoh:

```env
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=monitor
MIKROTIK_PASSWORD=password

MIKROTIK_USE_SSL=false

MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ,ether3-WAHED

POLL_INTERVAL=5

DATABASE_PATH=./data/traffic.db

WEB_HOST=0.0.0.0
WEB_PORT=8080
```

---

# 29. Web Server

Default:

```text
0.0.0.0:8080
```

Sehingga dashboard dapat dibuka:

```text
http://IP-STB:8080
```

Contoh:

```text
http://192.168.88.10:8080
```

Port harus dapat dikonfigurasi melalui `.env`.

---

# 30. Systemd

Aplikasi harus menyediakan service:

```text
mikrotik-traffic-monitor.service
```

Aplikasi harus:

* Start otomatis ketika Ubuntu boot.
* Restart otomatis jika aplikasi crash.
* Berjalan sebagai user non-root jika memungkinkan.
* Tidak membutuhkan login manual.

Contoh:

```ini
[Unit]
Description=MikroTik Traffic Monitor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=trafficmonitor
WorkingDirectory=/opt/mikrotik-traffic-monitor
EnvironmentFile=/opt/mikrotik-traffic-monitor/.env
ExecStart=/opt/mikrotik-traffic-monitor/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Sesuaikan dengan implementasi final.

---

# 31. Instalasi Ubuntu

README harus menjelaskan dari awal.

Contoh:

```bash
sudo apt update
sudo apt install python3 python3-venv python3-pip
```

Clone/copy aplikasi:

```bash
cd /opt
```

Buat virtual environment:

```bash
python3 -m venv venv
```

Install dependency:

```bash
pip install -r requirements.txt
```

Konfigurasi:

```bash
cp .env.example .env
nano .env
```

Test aplikasi:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Kemudian:

```text
http://IP-STB:8080
```

---

# 32. Systemd Installation

README harus memberikan:

```bash
sudo cp mikrotik-traffic-monitor.service /etc/systemd/system/
```

Kemudian:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mikrotik-traffic-monitor
sudo systemctl start mikrotik-traffic-monitor
```

Cek:

```bash
sudo systemctl status mikrotik-traffic-monitor
```

Log:

```bash
journalctl -u mikrotik-traffic-monitor -f
```

---

# 33. UI/UX

Desain harus:

* Sederhana.
* Bersih.
* Modern.
* Responsif.
* Mudah dibaca dari jauh.
* Cocok untuk dashboard monitoring.

Prioritas informasi:

1. Status MikroTik.
2. Trafik RX/TX saat ini.
3. Status interface.
4. Grafik trafik.
5. Waktu update terakhir.

Tidak perlu sidebar kompleks.

Tidak perlu menu administrasi.

Tidak perlu login pada versi 1.0 kecuali dibutuhkan untuk keamanan deployment.

---

# 34. Tampilan Warna Status

Status harus mudah dibedakan secara visual.

Contoh:

```text
ONLINE
RUNNING
```

menggunakan indikator visual positif.

Sedangkan:

```text
OFFLINE
NOT FOUND
```

menggunakan indikator visual peringatan.

Jangan membuat tampilan terlalu ramai.

---

# 35. Mobile Responsive

Dashboard harus tetap dapat digunakan pada:

```text
1920x1080
1366x768
1280x720
768x1024
390x844
```

Pada desktop:

```text
3 interface card
```

dapat ditampilkan berdampingan.

Pada mobile:

```text
1 card per baris
```

---

# 36. Refresh Behavior

Ketika browser melakukan refresh:

* Dashboard kembali tampil.
* Data historis tetap tersedia.
* Tidak membuat polling worker baru.
* Tidak membuat koneksi MikroTik baru dari setiap browser.
* Backend tetap memiliki satu polling worker.

---

# 37. Multi Browser

Jika dashboard dibuka oleh beberapa browser/client sekaligus:

```text
PC
HP
Laptop
```

backend tetap hanya melakukan satu polling ke MikroTik.

Jangan membuat:

```text
Browser 1 → MikroTik
Browser 2 → MikroTik
Browser 3 → MikroTik
```

Yang benar:

```text
                    MikroTik
                       |
                       v
                Backend Worker
                       |
                  SQLite/Memory
                       |
          +------------+------------+
          |            |            |
        PC           HP          Laptop
```

---

# 38. Performance Requirements

Target:

```text
CPU rendah
RAM rendah
Disk usage rendah
```

Aplikasi harus dapat berjalan pada STB dengan resource terbatas.

Hindari:

* proses background yang tidak diperlukan;
* polling berlebihan;
* query database setiap beberapa milidetik;
* library yang tidak digunakan;
* frontend framework berat.

---

# 39. Reliability

Jika MikroTik restart:

```text
MikroTik OFFLINE
       |
       v
Router kembali ONLINE
       |
       v
Backend reconnect
       |
       v
Monitoring berjalan kembali
```

Tidak diperlukan restart manual aplikasi.

---

# 40. Graceful Shutdown

Ketika aplikasi dihentikan:

* Polling worker berhenti dengan aman.
* Database connection ditutup.
* Tidak ada proses zombie.
* Tidak merusak database.

---

# 41. Testing

Buat unit test untuk:

### Traffic Calculation

Test:

```text
counter naik
counter tidak berubah
counter reset
counter lebih kecil dari sebelumnya
```

Jika counter lebih kecil dari sebelumnya, anggap MikroTik/interface counter telah reset.

Jangan menghasilkan nilai bandwidth negatif.

---

### Interface Filtering

Pastikan hanya:

```text
ether1-BAROKAH
ether2-BIZ
ether3-WAHED
```

yang diproses.

Interface lain harus diabaikan.

---

### API

Test:

```text
/api/status
/api/interfaces
/api/traffic
```

---

### Database

Test:

* Insert data.
* Query data.
* Query berdasarkan interface.
* Query berdasarkan periode.
* Cleanup data lama.

---

# 42. Acceptance Criteria

Aplikasi dianggap selesai apabila semua kondisi berikut terpenuhi.

## Connection

* [ ] Aplikasi dapat terhubung ke MikroTik API.
* [ ] Credential berasal dari `.env`.
* [ ] Password tidak muncul pada frontend.
* [ ] Password tidak muncul pada log.

## Interface

* [ ] ether1-BAROKAH dimonitor.
* [ ] ether2-BIZ dimonitor.
* [ ] ether3-WAHED dimonitor.
* [ ] Interface lain tidak ditampilkan.

## Traffic

* [ ] RX dapat ditampilkan.
* [ ] TX dapat ditampilkan.
* [ ] Bandwidth dihitung berdasarkan delta counter.
* [ ] Tidak ada nilai negatif.
* [ ] Satuan otomatis bps/Kbps/Mbps/Gbps.

## Realtime

* [ ] Polling berjalan otomatis.
* [ ] Default polling 5 detik.
* [ ] Polling interval configurable.
* [ ] Tidak ada duplicate polling worker.

## Graph

* [ ] Grafik RX tersedia.
* [ ] Grafik TX tersedia.
* [ ] Grafik diperbarui otomatis.
* [ ] Periode 5m tersedia.
* [ ] Periode 15m tersedia.
* [ ] Periode 30m tersedia.
* [ ] Periode 1h tersedia.
* [ ] Periode 6h tersedia.
* [ ] Periode 12h tersedia.
* [ ] Periode 24h tersedia.

## Database

* [ ] SQLite digunakan.
* [ ] Data trafik disimpan.
* [ ] Data tetap tersedia setelah browser refresh.
* [ ] Cleanup data lama tersedia.

## Failure Handling

* [ ] MikroTik offline tidak menyebabkan aplikasi crash.
* [ ] Reconnect otomatis.
* [ ] Interface tidak ditemukan ditangani.
* [ ] API timeout ditangani.

## Deployment

* [ ] Aplikasi dapat berjalan di Ubuntu.
* [ ] Aplikasi dapat diakses melalui browser.
* [ ] Systemd service tersedia.
* [ ] Auto-start setelah reboot.
* [ ] Auto-restart jika aplikasi crash.

---

# 43. Non-Goals

Fitur berikut TIDAK BOLEH dibuat pada versi 1.0:

* MikroTik configuration.
* Firewall management.
* NAT management.
* DHCP management.
* DNS management.
* Hotspot management.
* Queue configuration.
* Simple Queue management.
* User management MikroTik.
* Wireless configuration.
* VLAN configuration.
* Routing configuration.
* Reboot MikroTik.
* Backup MikroTik.
* Restore MikroTik.
* Terminal MikroTik.
* CPU monitoring.
* RAM monitoring.
* Temperature monitoring.
* Disk monitoring MikroTik.
* Interface configuration.
* Bandwidth limiting.
* Speed test.
* Internet speed test.
* Traffic shaping.
* Automatic network optimization.

Aplikasi harus tetap fokus pada:

> **MONITORING TRAFIK TIGA INTERFACE MIKROTIK**

---

# 44. Future Features

Fitur berikut boleh dipertimbangkan untuk versi berikutnya tetapi JANGAN diimplementasikan pada versi 1.0:

* Traffic alert.
* Telegram notification.
* Email notification.
* Traffic threshold.
* Export CSV.
* Export Excel.
* Traffic report.
* Daily/monthly report.
* Authentication.
* Multiple MikroTik router.
* Dark mode.
* Traffic peak statistics.

---

# 45. Prinsip Pengembangan

Gunakan prinsip:

```text
Simple
Lightweight
Reliable
Maintainable
Observable
```

Jangan over-engineering.

Jika terdapat dua pilihan teknologi yang sama-sama dapat menyelesaikan kebutuhan, pilih teknologi yang:

1. Lebih ringan.
2. Lebih sederhana.
3. Lebih mudah di-maintain.
4. Membutuhkan dependency lebih sedikit.
5. Lebih cocok untuk STB Ubuntu.

---

# 46. Prioritas Fitur

Prioritas P0 — Wajib:

```text
MikroTik API
Interface monitoring
RX/TX
Bandwidth calculation
Realtime dashboard
SQLite
Historical graph
Offline handling
Systemd
```

Prioritas P1:

```text
Data retention
Responsive UI
Logging
Unit test
```

Prioritas P2:

```text
Aggregation
Advanced UI
```

P2 tidak boleh menghambat P0.

---

# 47. Definition of Done

Development dianggap selesai apabila:

1. Source code lengkap tersedia.
2. Aplikasi dapat dijalankan pada Ubuntu.
3. MikroTik API dapat terhubung.
4. Ketiga interface terbaca.
5. Trafik RX/TX tampil realtime.
6. Grafik trafik tampil.
7. Data historis tersimpan.
8. Dashboard dapat dibuka melalui browser.
9. MikroTik offline dapat ditangani.
10. Systemd service berjalan.
11. Aplikasi otomatis berjalan setelah reboot STB.
12. README instalasi tersedia.
13. `.env.example` tersedia.
14. Test dasar tersedia.
15. Tidak ada fitur di luar scope monitoring trafik.

---

# 48. Instruksi untuk AI Coding Agent

Implementasikan aplikasi berdasarkan PRD ini.

Jangan langsung membuat fitur tambahan yang tidak tercantum.

Jika terdapat keputusan teknis yang belum ditentukan:

1. Pilih solusi paling sederhana.
2. Prioritaskan performa STB Ubuntu.
3. Hindari dependency yang tidak diperlukan.
4. Jangan mengubah scope produk.
5. Jangan membuat fitur administrasi MikroTik.
6. Jangan membuat koneksi MikroTik langsung dari browser.

Sebelum implementasi:

1. Analisis PRD.
2. Tentukan struktur project.
3. Tentukan dependency.
4. Implementasikan backend.
5. Implementasikan MikroTik API client.
6. Implementasikan traffic calculation.
7. Implementasikan SQLite.
8. Implementasikan polling worker.
9. Implementasikan REST API.
10. Implementasikan frontend.
11. Implementasikan grafik.
12. Implementasikan error handling.
13. Implementasikan cleanup.
14. Implementasikan systemd.
15. Buat README.
16. Jalankan test.
17. Perbaiki error yang ditemukan.

Jangan hanya membuat prototype atau mockup.

Hasil akhir harus berupa aplikasi yang benar-benar dapat dijalankan pada Ubuntu STB.

```

**Catatan:** PRD ini sengaja memisahkan **MikroTik API → backend → SQLite → browser**. Ini penting supaya kalau dashboard dibuka dari HP, laptop, dan PC sekaligus, ketiganya tidak membuat koneksi/polling sendiri-sendiri ke MikroTik.
```
