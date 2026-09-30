# MikroTik Traffic Monitor (v1.1.0)

Aplikasi web ringan untuk memonitor trafik jaringan dari router MikroTik melalui RouterOS API pada **STB / Server Ubuntu Linux**.

---

## 🌟 Fitur Utama (v1.1.0)

- **Dynamic Monitored Interfaces**: Daftar interface tidak di-hardcode. Cukup ubah `.env` (`MONITORED_INTERFACES`), frontend & backend otomatis menyesuaikan tanpa perlu mengubah source code.
- **Dynamic Graph Periods**: Pilihan periode grafik sepenuhnya diatur dari `.env` (`GRAPH_PERIODS`), mendukung menit (`m`), jam (`h`), hingga hari (`d`).
- **Realtime vs Historical Snapshot Mode**:
  - **Mode Realtime** ($\le$ `GRAPH_REALTIME_MAX`, contoh: `5m`, `15m`, `30m`): Grafik otomatis ter-update secara berkala (default 5 detik) dengan indikator **`● LIVE`**.
  - **Mode Historical Snapshot** ($>$ `GRAPH_REALTIME_MAX`, contoh: `1h`, `6h`, `12h`, `24h`): Diambil sekali dari SQLite (*snapshot*) tanpa polling terus-menerus ke database. Dilengkapi tombol **`↻ Refresh`** manual.
- **Backend Time-Bucket Downsampling**: Data historis periode panjang (misal 24 jam / 17.280 titik) di-downsample secara otomatis oleh backend menjadi maksimal 500 titik (*time-bucket averaging*) sehingga rendering browser sangat ringan di STB/HP.
- **Single SQL Query for Multi-Interface**: Pengambilan trafik untuk "Semua Interface" dieksekusi dalam 1 request HTTP dan 1 query SQL efisien berbasis indeks.
- **Resource Efisien**: Menggunakan SQLite, FastAPI, dan single worker thread. Konsumsi RAM dan CPU sangat rendah.
- **Auto Reconnect & Graceful Handling**: Tidak crash saat MikroTik restart atau offline.

---

## 🛠️ Persyaratan Sistem

- **OS**: Ubuntu Linux (Desktop / Server / STB Ubuntu)
- **Python**: v3.9+
- **Database**: SQLite3 (Bawaan Python)

---

## 🚀 Panduan Instalasi di Ubuntu STB

### 1. Install Dependency Sistem
```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git
```

### 2. Prepare Direktori & Source Code
```bash
cd /opt
sudo git clone https://github.com/ilamazuliaf/mikrotik-traffic-monitor.git
cd mikrotik-traffic-monitor
sudo chown -R $USER:$USER /opt/mikrotik-traffic-monitor
```

### 3. Buat Virtual Environment Python & Install Requirements
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
nano .env
```

Isi variabel konfigurasi sesuai kebutuhan:
```env
# MikroTik RouterOS API
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=monitor
MIKROTIK_PASSWORD=password_mikrotik_anda
MIKROTIK_USE_SSL=false

# Daftar Interface yang Dimonitor (Single Source of Truth, dipisahkan koma)
MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ,ether3-WAHED

# Interval Polling (detik)
POLL_INTERVAL=5

# Lokasi Database SQLite
DATABASE_PATH=./data/traffic.db

# Web Server Setup
WEB_HOST=0.0.0.0
WEB_PORT=8080

# Pengaturan Grafik Dinamis (PRD v1.1.0)
GRAPH_PERIODS=5m,15m,30m,1h,6h,12h,24h
GRAPH_DEFAULT_PERIOD=15m
GRAPH_REALTIME_MAX=30m
GRAPH_REFRESH_INTERVAL=5000
GRAPH_MAX_POINTS=500
```

---

## ⚙️ Jalankan Manual / Testing

Jalankan server aplikasi secara manual:
```bash
venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```
Buka browser dan akses:
`http://IP-STB:8080` (contoh: `http://192.168.88.10:8080`)

---

## 🔄 Mengaktifkan Systemd Service (Auto-Start Boot STB)

Agar aplikasi otomatis berjalan saat STB di-reboot dan otomatis restart jika terjadi error:

### 1. Salin File Service
```bash
sudo cp mikrotik-traffic-monitor.service /etc/systemd/system/
```

### 2. Enable & Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable mikrotik-traffic-monitor
sudo systemctl start mikrotik-traffic-monitor
```

### 3. Cek Status & Log Service
```bash
sudo systemctl status mikrotik-traffic-monitor
journalctl -u mikrotik-traffic-monitor -f
```

---

## 📡 REST API Endpoints

- `GET /api/config`: Mengembalikan konfigurasi dinamis interface, periode grafik, default period, dan threshold realtime.
- `GET /api/status`: Mengembalikan status koneksi MikroTik (`online`/`offline`) & waktu update terakhir.
- `GET /api/interfaces`: Mengembalikan statistik trafik terkini dari seluruh interface terkonfigurasi.
- `GET /api/traffic?interface=all&period=15m&mode=realtime`: Mengembalikan data trafik historis/realtime dengan backend downsampling otomatis.

---

## 🔒 Security Note
Pastikan password MikroTik Anda tersimpan di file `.env` dan **TIDAK PERNAH** di-commit ke Git. File `.env` sudah berada dalam `.gitignore`.
