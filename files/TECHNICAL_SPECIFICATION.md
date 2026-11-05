# ConDeck — Technical Specification

**Version:** 1.0  
**Document Type:** Technical Specification  
**Related Document:** ConDeck Product Requirements Document (PRD)

## 1. Project Overview

ConDeck adalah aplikasi virtual Stream Deck yang dirancang untuk membantu streamer mengontrol aktivitas streaming melalui tombol-tombol yang dapat dikustomisasi.

ConDeck memiliki dua bagian utama:

- **Desktop Application:** Aplikasi utama yang berjalan di Windows dan bertindak sebagai host, pusat konfigurasi, penyimpanan data, integrasi OBS, serta pengelola koneksi perangkat.
- **Mobile Application:** Remote controller yang diakses melalui browser smartphone menggunakan jaringan lokal (LAN). Mobile berfungsi sebagai pengendali tombol yang telah dikonfigurasi melalui Desktop.

Sistem menggunakan pendekatan local-first. Pengguna tidak diwajibkan membuat akun atau menggunakan layanan cloud untuk menjalankan fitur inti.

## 2. Technology Stack

### 2.1 Desktop Application

| Teknologi | Kegunaan |
|---|---|
| Electron | Desktop application framework |
| React | UI development |
| TypeScript | Type safety |
| Vite | Development server dan bundler |
| Tailwind CSS | Styling |
| Zustand | State management |
| Node.js | Backend runtime |
| SQLite | Local database |
| Drizzle ORM | Database access dan schema management |
| Zod | Data validation |
| Lucide React | Icon library |
| Framer Motion | UI animation |
| electron-builder | Packaging dan installer |
| Vitest | Unit testing |
| Playwright | End-to-end testing |

### 2.2 Mobile Application

| Teknologi | Kegunaan |
|---|---|
| React | Mobile interface |
| TypeScript | Type safety |
| Vite | Build tooling |
| Tailwind CSS | Styling |
| PWA | Installable web application |
| WebSocket | Komunikasi real-time dengan Desktop |

Mobile tidak perlu mengakses database secara langsung. Semua data dan eksekusi perintah dikelola oleh Desktop.

### 2.3 Shared Packages

Gunakan pnpm workspace untuk mengelola monorepo.

Shared packages digunakan untuk:

- Type definitions.
- WebSocket message schemas.
- Validation schemas.
- Shared utilities.
- Action definitions.
- Protocol constants.

## 3. System Architecture

### 3.1 Architecture Overview

ConDeck menggunakan arsitektur Client-Host.

Desktop berperan sebagai Host, sedangkan Mobile menjadi Remote Client.

Alur sistem:

1. Desktop dijalankan oleh pengguna.
2. Desktop memuat konfigurasi dan database lokal.
3. Desktop menghubungkan diri ke OBS Studio.
4. Desktop menjalankan local WebSocket server.
5. Mobile terhubung ke alamat IP Desktop melalui jaringan lokal.
6. Mobile menerima konfigurasi deck dan halaman.
7. Ketika tombol ditekan, Mobile mengirimkan event ke Desktop.
8. Desktop memvalidasi event dan menjalankan action.
9. Hasil eksekusi dikirim kembali ke Mobile.

### 3.2 Main Components

**Desktop Main Process**
- Mengelola lifecycle aplikasi.
- Mengelola database.
- Menjalankan local server.
- Mengelola OBS connection.
- Menjalankan action engine.
- Mengelola autentikasi perangkat.

**Desktop Renderer**
- Menampilkan dashboard.
- Mengelola deck editor.
- Menampilkan pengaturan.
- Menampilkan status OBS dan perangkat.

**Action Engine**
- Membaca konfigurasi action.
- Memvalidasi parameter.
- Menjalankan action berdasarkan registry.
- Mengirimkan hasil eksekusi.

**OBS Integration**
- Menghubungkan aplikasi ke OBS WebSocket v5.
- Mengirim perintah OBS.
- Menerima status koneksi dan respons.

**Mobile Remote**
- Menampilkan deck dan tombol.
- Mengirim event tombol.
- Menerima pembaruan halaman dan status.
- Menampilkan feedback eksekusi.

## 4. Project Structure

Gunakan struktur monorepo berikut:

```text
condeck/
├── apps/
│   ├── desktop/
│   │   ├── electron/
│   │   │   ├── main/
│   │   │   ├── preload/
│   │   │   └── services/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   └── styles/
│   │   └── package.json
│   │
│   └── mobile/
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── features/
│       │   ├── hooks/
│       │   ├── stores/
│       │   └── styles/
│       └── package.json
│
├── packages/
│   ├── shared/
│   ├── database/
│   ├── action-engine/
│   ├── obs-integration/
│   ├── websocket-protocol/
│   └── config/
│
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 5. OBS Integration

Integrasi OBS menggunakan OBS WebSocket v5 melalui library `obs-websocket-js`.

Default OBS WebSocket port: `4455`.

Fitur integrasi MVP:

- Connect dan disconnect OBS.
- Mendapatkan daftar scene.
- Mengganti active scene.
- Memulai dan menghentikan streaming.
- Memulai dan menghentikan recording.
- Mengaktifkan dan menonaktifkan microphone mute.
- Menampilkan status koneksi OBS.

Perintah OBS yang menjadi prioritas:

| Fitur | OBS Request |
|---|---|
| Get scenes | GetSceneList |
| Switch scene | SetCurrentProgramScene |
| Start streaming | StartStream |
| Stop streaming | StopStream |
| Start recording | StartRecord |
| Stop recording | StopRecord |
| Set microphone mute | SetInputMute |

Semua perintah harus menangani kondisi gagal, timeout, dan OBS yang terputus.

Jangan menganggap perintah berhasil sebelum menerima respons yang sesuai dari OBS.

## 6. Action Engine

Action Engine bertugas menerjemahkan konfigurasi tombol menjadi perintah yang dapat dieksekusi.

Gunakan pendekatan Action Registry.

Setiap action memiliki:

- Action ID.
- Action type.
- Configuration schema.
- Validation rules.
- Execution handler.
- Result status.

Contoh jenis action:

- OBS: Switch Scene.
- OBS: Start Streaming.
- OBS: Stop Streaming.
- OBS: Start Recording.
- OBS: Stop Recording.
- OBS: Toggle Microphone.
- Navigation: Change Page.

Mobile hanya boleh mengirimkan button ID dan informasi event yang diperlukan. Mobile tidak boleh mengirimkan kode program atau perintah shell bebas untuk dieksekusi Desktop.

## 7. Electron Security

Implementasikan keamanan Electron dengan ketentuan:

- `contextIsolation: true`
- `nodeIntegration: false`
- Gunakan preload script.
- Gunakan IPC dengan channel allowlist.
- Validasi semua input IPC.
- Jangan memberikan akses Node.js langsung ke renderer.
- Simpan kredensial sensitif menggunakan Electron `safeStorage` jika tersedia.
- Jangan menyimpan password OBS dalam bentuk plaintext.

## 8. Local Network Communication

Desktop menyediakan local HTTP server untuk kebutuhan pairing dan WebSocket server untuk komunikasi real-time.

Default port ConDeck: `43821`, tetapi harus dapat dikonfigurasi.

Ketentuan:

- Deteksi konflik port.
- Tampilkan alamat IP host.
- Izinkan pengguna mengatur jaringan yang digunakan.
- Jangan menganggap jaringan Wi-Fi pribadi selalu aman.
- Gunakan mekanisme autentikasi perangkat.
- Jangan mengekspos server ke internet secara default.

Untuk autentikasi dan komunikasi yang sensitif, gunakan transport terenkripsi jika memungkinkan. Jangan mengirim kredensial permanen melalui koneksi WebSocket plaintext.

## 9. Error Handling

Semua komponen harus menangani:

- OBS disconnected.
- WebSocket disconnected.
- Mobile device disconnected.
- Invalid request.
- Unauthorized device.
- Database error.
- Action execution failed.
- Port conflict.
- Network timeout.

Error harus disampaikan menggunakan pesan yang mudah dipahami pengguna.

## 10. Development Rules

1. Gunakan TypeScript untuk seluruh kode aplikasi.
2. Hindari penggunaan `any` tanpa alasan yang kuat.
3. Pisahkan business logic dari UI.
4. Gunakan shared packages untuk tipe dan schema yang dipakai lintas aplikasi.
5. Gunakan Zod untuk validasi input dan pesan komunikasi.
6. Jangan mengakses database langsung dari renderer.
7. Jangan mengimplementasikan fitur di luar scope tanpa memperbarui PRD.
8. Pastikan setiap fitur dapat diuji secara terpisah.
9. Jangan menggunakan mock data sebagai pengganti integrasi nyata pada fitur yang sudah memasuki tahap implementasi.
10. Dokumentasikan keputusan arsitektur yang berdampak besar.

## 11. Implementation Priority

**P0 — MVP**
- Desktop foundation.
- Dashboard.
- Deck editor.
- Button configuration.
- SQLite persistence.
- Action Engine.
- OBS integration.
- Mobile remote.
- QR pairing.
- WebSocket communication.

**P1 — Enhancement**
- Custom icons.
- Custom images.
- Soundboard.
- Macro actions.
- Improved feedback.
- Device management.

**P2 — Future**
- Plugin system.
- Additional streaming integrations.
- Advanced automation.
- Optional cloud synchronization.

## 12. Acceptance Criteria

Implementasi dianggap memenuhi spesifikasi apabila:

- Desktop dapat dijalankan di Windows.
- Pengguna dapat membuat dan mengedit deck.
- Konfigurasi tersimpan secara lokal.
- OBS dapat terhubung melalui WebSocket v5.
- Tombol dapat menjalankan perintah OBS.
- Mobile dapat terhubung melalui LAN.
- Mobile dapat mengontrol action yang dikonfigurasi.
- Perangkat tidak dikenal ditolak.
- Koneksi dapat pulih setelah terputus.
- Tidak ada akses Node.js langsung dari renderer.

**Catatan:** Dokumen ini menjadi acuan teknis implementasi ConDeck dan harus dibaca bersama PRD utama.