# MikroTik Traffic Monitor

Aplikasi web ringan untuk memonitor trafik jaringan dari router MikroTik melalui RouterOS API pada **STB / Server Ubuntu Linux**.

---

## 🌟 Fitur Utama

- **Realtime Monitoring**: Monitoring trafik RX (Download) dan TX (Upload) untuk 3 interface:
  - `ether1-BAROKAH`
  - `ether2-BIZ`
  - `ether3-WAHED`
- **Tampilan Dashboard Modern**: Menggunakan arsitektur glassmorphism yang responsif untuk desktop dan mobile.
- **Grafik Historis**: Line chart interaktif dengan filter periode `5m`, `15m`, `30m`, `1h`, `6h`, `12h`, `24h`.
- **Auto Reconnect & Graceful Handling**: Tidak crash saat MikroTik restart / offline.
- **Resource Efisien**: Menggunakan SQLite & FastAPI untuk konsumsi RAM dan CPU yang sangat rendah pada STB Ubuntu.
- **Single Background Worker**: Mencegah multiple connection ke MikroTik meskipun dashboard dibuka di banyak browser secara bersamaan.

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

### 2. Prepare Directori & Source Code
```bash
cd /opt
sudo git clone https://github.com/user/mikrotik-traffic-monitor.git
cd mikrotik-traffic-monitor
sudo chown -R $USER:$USER /opt/mikrotik-traffic-monitor
```

### 3. Buat Virtual Environment Python & Install Requirements
```bash
python3 -m venv venv
source venv/bin/python -m pip install --upgrade pip
venv/bin/pip install -r requirements.txt
```

### 4. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
nano .env
```

Isi konfigurasi sesuai router MikroTik Anda:
```env
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=monitor
MIKROTIK_PASSWORD=password_mikrotik_anda

MIKROTIK_USE_SSL=false

MONITORED_INTERFACES=ether1-BAROKAH,ether2-BIZ,ether3-WAHED

POLL_INTERVAL=5

DATABASE_PATH=./data/traffic.db

WEB_HOST=0.0.0.0
WEB_PORT=8080
```

---

## ⚙️ Uji Coba Manual

Jalankan server aplikasi secara manual untuk menguji:
```bash
venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```
Buka browser dan akses:
`http://IP-STB:8080` (contoh: `http://192.168.88.10:8080`)

---

## 🔄 Mengaktifkan Systemd Service (Auto-Start Boot STB)

Agar aplikasi otomatis berjalan saat STB di-reboot dan otomatis restart jika error:

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

- `GET /api/status`: Mengembalikan status koneksi MikroTik & waktu update terakhir.
- `GET /api/interfaces`: Mengembalikan statistik trafik terkini dari 3 interface yang dimonitor.
- `GET /api/traffic?interface=all&period=15m`: Mengembalikan data trafik historis berdasarkan filter interface dan periode.

---

## 🧪 Menguji Unit Test

Jalankan suite pengujian otomatis:
```bash
venv/bin/pytest
```

---

## 🔒 Security Note
Pastikan password MikroTik Anda tersimpan di file `.env` dan **TIDAK PERNAH** di-commit ke Git. File `.env` sudah dimasukkan ke `.gitignore`.
