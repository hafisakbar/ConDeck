# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# ConDeck – Virtual Stream Deck Application

**Version:** 1.0  
**Status:** Product Specification  
**Product Name:** ConDeck  
**Product Category:** Streaming Control Software  
**Target Platform:** Windows Desktop + Mobile Remote  
**Primary Integration:** OBS Studio  
**Architecture:** Local-first, Desktop Host + Mobile Client

---

# 1. PRODUCT OVERVIEW

## 1.1 Product Description

ConDeck adalah aplikasi virtual Stream Deck yang memungkinkan pengguna mengontrol aktivitas streaming dan berbagai fungsi OBS Studio melalui tombol digital yang dapat dikustomisasi.

Aplikasi terdiri dari dua komponen utama:

1. **ConDeck Desktop:** Aplikasi utama berbasis Windows yang bertindak sebagai pusat kendali, konfigurasi, dan eksekusi perintah.
2. **ConDeck Mobile:** Remote controller berbasis web yang dapat diakses melalui smartphone atau tablet menggunakan jaringan lokal.

ConDeck memungkinkan pengguna membuat tombol virtual, mengatur icon, warna, fungsi, halaman, dan profile sesuai kebutuhan streaming.

Pengguna dapat menjalankan berbagai perintah seperti mengganti scene OBS, memulai atau menghentikan streaming, mengontrol recording, mengatur audio, serta menjalankan soundboard dan macro.

Produk dirancang sebagai alternatif Stream Deck berbasis software tanpa mengharuskan pengguna membeli perangkat hardware khusus.

## 1.2 Product Vision

Menjadi aplikasi virtual Stream Deck yang fleksibel, mudah digunakan, dan dapat dikustomisasi untuk memberikan pengalaman kontrol streaming profesional melalui perangkat desktop dan mobile.

## 1.3 Problem Statement

Penggunaan Stream Deck fisik memiliki beberapa keterbatasan:

- Membutuhkan pembelian perangkat tambahan.
- Jumlah tombol bergantung pada perangkat yang digunakan.
- Tidak semua streamer membutuhkan hardware khusus.
- Pengguna yang sudah memiliki smartphone belum tentu memanfaatkannya sebagai perangkat kontrol.
- Pengaturan dan fleksibilitas kontrol dapat menjadi terbatas sesuai perangkat yang dimiliki.

ConDeck bertujuan mengatasi keterbatasan tersebut melalui solusi software yang memanfaatkan komputer dan smartphone pengguna.

---

# 2. PRODUCT OBJECTIVES

## 2.1 Primary Objectives

1. Menyediakan virtual Stream Deck yang dapat digunakan tanpa hardware khusus.
2. Memungkinkan kontrol OBS Studio melalui desktop dan smartphone.
3. Menyediakan sistem custom button yang fleksibel.
4. Menyediakan komunikasi real-time antara desktop dan mobile.
5. Menyediakan sistem profile dan multi-page deck.
6. Menyediakan pengalaman pengguna yang sederhana, cepat, dan profesional.

## 2.2 Secondary Objectives

- Menyediakan soundboard.
- Mendukung macro dan multi-action.
- Mendukung custom icon dan image.
- Menyediakan sistem backup dan restore.
- Mendukung berbagai integrasi tambahan.
- Menyediakan fondasi plugin system untuk pengembangan berikutnya.

## 2.3 Product Success Metrics

Keberhasilan ConDeck diukur berdasarkan:

| Metric | Target |
|---|---|
| Desktop startup | Berjalan tanpa critical error |
| OBS integration | Semua action P0 berhasil diuji |
| Mobile pairing | Berhasil pada jaringan lokal yang didukung |
| Button execution | Memberikan feedback yang akurat |
| Configuration persistence | Konfigurasi tidak hilang setelah restart |
| Reconnection | Mampu memulihkan koneksi setelah gangguan |
| Security | Perangkat tidak terotorisasi ditolak |
| Stability | Tidak ada critical bug pada pengujian MVP |

---

# 3. TARGET USERS

## 3.1 Primary Users

**Streamers**

Pengguna yang melakukan livestream melalui OBS Studio dan membutuhkan akses cepat ke berbagai kontrol streaming.

Kebutuhan:
- Mengganti scene.
- Mengontrol streaming.
- Mengontrol recording.
- Mengatur audio.
- Menjalankan soundboard.

## 3.2 Secondary Users

**Content Creators**

Pengguna yang membutuhkan shortcut dan kontrol multimedia.

**Gamers**

Pengguna yang ingin menggunakan tombol virtual untuk menjalankan perintah tertentu.

**Presenters**

Pengguna yang membutuhkan kontrol presentasi dan media melalui perangkat mobile.

---

# 4. PRODUCT SCOPE

## 4.1 MVP Features

Fitur berikut wajib tersedia pada rilis pertama.

| Feature | Description | Priority |
|---|---|---|
| Desktop Application | Aplikasi utama Windows | P0 |
| Dashboard | Ringkasan status aplikasi | P0 |
| Virtual Deck | Grid tombol virtual | P0 |
| Button Editor | Konfigurasi tombol | P0 |
| Action Engine | Mesin eksekusi perintah | P0 |
| OBS Integration | Integrasi OBS WebSocket | P0 |
| Scene Switching | Mengganti scene OBS | P0 |
| Streaming Control | Start/Stop Streaming | P0 |
| Recording Control | Start/Stop Recording | P0 |
| Audio Control | Mute/Unmute audio | P0 |
| Profile Management | Mengelola profile | P0 |
| Page Management | Mengelola halaman deck | P0 |
| Mobile Remote | Kontrol melalui smartphone | P0 |
| QR Pairing | Menghubungkan perangkat | P0 |
| WebSocket | Komunikasi real-time | P0 |
| Local Database | Penyimpanan konfigurasi | P0 |
| Device Management | Mengelola perangkat terhubung | P0 |

## 4.2 Version 1.1 Features

- Soundboard.
- Macro.
- Multi-action.
- Custom image upload.
- Drag and drop.
- Custom grid size.
- Application launcher.
- Keyboard shortcuts.
- Backup and restore.

## 4.3 Version 2.0 Features

- Plugin system.
- Custom plugin API.
- Additional streaming integrations.
- Automatic profile switching.
- Cloud synchronization (optional).
- Plugin marketplace.
- Advanced audio control.

Fitur Version 2.0 tidak boleh menjadi ketergantungan bagi MVP.

---

# 5. FUNCTIONAL REQUIREMENTS

## 5.1 Dashboard

Dashboard merupakan halaman utama aplikasi.

Komponen:
- Application status.
- OBS connection status.
- Mobile connection status.
- Active profile.
- Quick actions.
- Recent activity.
- Navigation menu.

System behavior:
- Menampilkan status OBS berdasarkan koneksi aktual.
- Menampilkan jumlah perangkat yang terhubung.
- Menampilkan aktivitas terbaru.
- Menyediakan akses cepat ke Deck Editor.
- Memungkinkan pengguna mengaktifkan atau menghentikan Remote Server.

## 5.2 Virtual Deck Editor

Pengguna dapat membuat dan mengatur tombol virtual.

Requirements:
- Membuat tombol.
- Menghapus tombol.
- Mengedit tombol.
- Mengubah posisi tombol.
- Mengatur jumlah baris dan kolom.
- Mengatur icon.
- Mengatur warna.
- Mengatur label.
- Mengatur action.
- Menggandakan tombol.
- Menampilkan preview tombol.

Default grid: 3 × 3.

Pilihan grid tambahan:
- 4 × 4.
- 5 × 3.
- 5 × 5.
- Custom configuration.

## 5.3 Button Customization

Setiap tombol memiliki konfigurasi:

- Button ID.
- Button name.
- Button label.
- Icon.
- Background color.
- Text color.
- Image.
- Action type.
- Action configuration.
- Enabled status.

Setiap tombol harus memiliki feedback visual saat ditekan dan saat action selesai dijalankan.

## 5.4 Action Engine

Action Engine bertugas menjalankan perintah berdasarkan konfigurasi tombol.

Kategori action MVP:

**OBS Actions**
- Switch Scene.
- Start Streaming.
- Stop Streaming.
- Start Recording.
- Stop Recording.
- Toggle Audio Mute.
- Set Audio Mute.

**System Actions**
- Open Application.
- Open URL.

**Navigation Actions**
- Next Page.
- Previous Page.

Setiap action harus:
- Memiliki validasi konfigurasi.
- Memiliki status eksekusi.
- Mengembalikan hasil.
- Menangani error.
- Mendukung feedback visual.
- Mengikuti aturan concurrency agar tidak terjadi eksekusi ganda yang tidak diinginkan.

## 5.5 OBS Integration

ConDeck menggunakan OBS WebSocket versi 5.

Konfigurasi:
- Host.
- Port.
- Password.
- Connection status.
- Connect.
- Disconnect.
- Test connection.

Default port: 4455.

Fungsi:
- Mengambil daftar scene.
- Mengganti scene.
- Memulai streaming.
- Menghentikan streaming.
- Memulai recording.
- Menghentikan recording.
- Mengontrol mute audio.
- Membaca perubahan status OBS.

Status OBS harus disinkronisasikan secara real-time.

Contohnya, ketika pengguna mengganti scene langsung melalui OBS, tampilan ConDeck juga harus mengikuti perubahan tersebut.

## 5.6 Mobile Remote Controller

Smartphone bertindak sebagai remote controller.

Fitur:
- Pairing melalui QR Code.
- Manual connection.
- Button grid.
- Page navigation.
- Real-time synchronization.
- Connection status.
- Reconnection.
- Fullscreen mode.
- Responsive layout.
- Portrait dan landscape support.

Mobile harus menggunakan konfigurasi deck yang sama dengan desktop.

Mobile tidak boleh menjalankan perintah OBS secara langsung.

## 5.7 Profile Management

Pengguna dapat membuat beberapa profile.

Contoh:
- Streaming.
- Gaming.
- Productivity.
- Presentation.

Setiap profile dapat memiliki deck dan halaman sendiri.

Pengguna dapat:
- Membuat profile.
- Mengedit profile.
- Menghapus profile.
- Mengaktifkan profile.
- Mengatur deck pada masing-masing profile.

## 5.8 Page Management

Pengguna dapat membuat beberapa halaman dalam satu deck.

Contoh:

Profile Streaming:
- Main.
- Audio.
- Scenes.
- Recording.

Pengguna dapat berpindah halaman melalui desktop maupun mobile.

## 5.9 Device Management

Desktop menyediakan pengelolaan perangkat yang terhubung.

Fitur:
- Menampilkan perangkat.
- Menampilkan nama perangkat.
- Menampilkan status koneksi.
- Menampilkan waktu terakhir terhubung.
- Memutuskan perangkat.
- Mencabut akses perangkat.

---

# 6. USER FLOW

## 6.1 Initial Setup

1. Pengguna membuka ConDeck Desktop.
2. Aplikasi menampilkan onboarding.
3. Pengguna membuat profile pertama.
4. Pengguna mengatur koneksi OBS.
5. Pengguna membuat deck pertama.
6. Pengguna menambahkan tombol.
7. Pengguna dapat mencoba tombol dari desktop.

## 6.2 OBS Connection Flow

1. Pengguna membuka Integration Settings.
2. Memilih OBS Studio.
3. Memasukkan host dan port.
4. Memasukkan password OBS jika diperlukan.
5. Menekan Connect.
6. Sistem memvalidasi koneksi.
7. Dashboard menampilkan status OBS Connected.

## 6.3 Mobile Pairing Flow

1. Pengguna membuka menu Remote.
2. Mengaktifkan Remote Server.
3. Desktop menghasilkan QR Code.
4. Pengguna memindai QR menggunakan smartphone.
5. Mobile mengirim permintaan pairing.
6. Desktop memvalidasi pairing.
7. Perangkat diotorisasi.
8. Mobile menerima konfigurasi deck.
9. Mobile siap digunakan.

## 6.4 Button Execution Flow

1. Pengguna menekan tombol.
2. Sistem menerima button ID.
3. Action Engine mengambil konfigurasi tombol.
4. Sistem memvalidasi action.
5. Sistem menjalankan perintah.
6. OBS memberikan respons.
7. Sistem mengirim hasil eksekusi.
8. Interface menampilkan feedback.

---

# 7. UI/UX REQUIREMENTS

## 7.1 Design Direction

ConDeck menggunakan desain modern, profesional, minimalis, dan berorientasi pada kebutuhan streamer.

Design principles:
- Dark-first interface.
- Clean layout.
- Minimal visual clutter.
- Consistent spacing.
- Clear typography.
- Subtle animations.
- Consistent button styling.
- Responsive mobile interface.

Hindari penggunaan gradient, glow, dan glassmorphism secara berlebihan.

## 7.2 Desktop Navigation

Menu:
1. Dashboard.
2. My Deck.
3. Profiles.
4. Integrations.
5. Remote Devices.
6. Activity Logs.
7. Settings.

## 7.3 Deck Editor Layout

Layout terdiri dari:

- Topbar.
- Sidebar.
- Deck canvas.
- Button grid.
- Properties inspector.
- Bottom toolbar.

Pengguna harus dapat mengatur tombol dengan mudah melalui interaksi visual.

## 7.4 Mobile Interface

Mobile harus memiliki:
- Fullscreen deck.
- Touch-friendly buttons.
- Page navigation.
- Connection indicator.
- Minimal interface.
- Portrait dan landscape support.

---

# 8. TECHNICAL REQUIREMENTS

## 8.1 Technology Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Electron |
| Frontend | React |
| Language | TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Database | SQLite |
| ORM | Drizzle ORM |
| Runtime | Node.js |
| Communication | WebSocket |
| OBS Integration | obs-websocket-js |
| Validation | Zod |
| Icons | Lucide React |
| Animation | Framer Motion |
| Packaging | electron-builder |
| Testing | Vitest + Playwright |
| Monorepo | pnpm workspaces |

## 8.2 Application Architecture

ConDeck menggunakan arsitektur Desktop Host dan Mobile Client.

Desktop bertanggung jawab atas:
- Database.
- OBS Integration.
- Action Execution.
- Local Server.
- Device Authentication.
- Configuration Management.

Mobile bertanggung jawab atas:
- Menampilkan deck.
- Mengirim button events.
- Menampilkan action feedback.
- Menerima konfigurasi.
- Menampilkan status koneksi.

Semua action harus dieksekusi oleh desktop.

## 8.3 Communication Protocol

Komunikasi menggunakan WebSocket melalui jaringan lokal.

Contoh event:
- auth.pair
- auth.resume
- deck.get
- deck.snapshot
- deck.updated
- button.press
- action.started
- action.completed
- action.failed
- obs.status
- ping
- pong

Semua pesan harus memiliki format JSON yang konsisten, request ID, timestamp, dan validasi schema.

## 8.4 Database

Database utama menggunakan SQLite.

Tabel:
- profiles.
- decks.
- pages.
- buttons.
- actions.
- integrations.
- devices.
- device_sessions.
- media_assets.
- activity_logs.

Database harus mendukung relasi, foreign keys, migration, dan transaction.

Credential sensitif tidak boleh disimpan sebagai plaintext.

## 8.5 Security

- Menggunakan Electron context isolation.
- Menonaktifkan Node integration pada renderer.
- Menggunakan IPC allowlist.
- Menggunakan autentikasi perangkat.
- Menggunakan pairing token sementara.
- Mendukung pencabutan akses perangkat.
- Memvalidasi semua WebSocket messages.
- Membatasi akses remote pada jaringan lokal.
- Tidak mengekspos kredensial OBS ke mobile.
- Tidak menerima arbitrary shell commands dari mobile.

---

# 9. NON-FUNCTIONAL REQUIREMENTS

| Category | Requirement |
|---|---|
| Performance | Interaksi UI harus terasa responsif |
| Reliability | Tidak crash ketika OBS disconnect |
| Security | Device authentication |
| Compatibility | Windows 10/11 64-bit |
| Storage | Local persistence |
| Network | Wi-Fi dan Ethernet |
| Maintainability | Modular architecture |
| Scalability | Plugin-ready architecture |
| Recovery | Automatic reconnect |
| Usability | Interface mudah dipahami |

Target respons action lokal adalah di bawah 150 ms untuk operasi yang memungkinkan, dengan tetap memperhitungkan latensi OBS dan jaringan.

---

# 10. DEVELOPMENT ROADMAP

## Phase 1 – Foundation

- Setup monorepo.
- Setup Electron.
- Setup React.
- Setup TypeScript.
- Setup Tailwind.
- Setup SQLite.
- Implementasi IPC.
- Implementasi dashboard.
- Implementasi navigasi.

**Deliverable:** Desktop application foundation.

## Phase 2 – Deck Builder

- Profile management.
- Deck management.
- Page management.
- Button grid.
- Button editor.
- Customization.
- Database persistence.

**Deliverable:** Functional Virtual Deck.

## Phase 3 – Action Engine & OBS

- Action registry.
- Action executor.
- OBS integration.
- Scene switching.
- Streaming control.
- Recording control.
- Audio control.
- Status synchronization.

**Deliverable:** OBS Control System.

## Phase 4 – Mobile Remote

- Mobile React application.
- Local HTTP server.
- WebSocket server.
- QR pairing.
- Device authentication.
- Mobile deck interface.
- Real-time synchronization.
- Reconnection.

**Deliverable:** Desktop + Mobile Remote.

## Phase 5 – Advanced Features

- Soundboard.
- Macro.
- Multi-action.
- Custom image.
- Drag and drop.
- Advanced grid.
- Activity logs.

**Deliverable:** Advanced ConDeck.

## Phase 6 – Testing & Release

- Unit testing.
- Integration testing.
- E2E testing.
- Security testing.
- Performance testing.
- Installer.
- Documentation.
- MVP release.

**Deliverable:** ConDeck v1.0.0.

---

# 11. ACCEPTANCE CRITERIA

MVP dianggap berhasil apabila:

1. Aplikasi berjalan pada Windows.
2. Pengguna dapat membuat profile.
3. Pengguna dapat membuat deck.
4. Pengguna dapat membuat dan mengatur tombol.
5. Konfigurasi tersimpan setelah restart.
6. OBS dapat dihubungkan.
7. Scene OBS dapat diganti melalui tombol.
8. Streaming dapat dimulai dan dihentikan.
9. Recording dapat dikontrol.
10. Audio dapat di-mute dan di-unmute.
11. HP dapat melakukan pairing melalui QR.
12. HP dapat menampilkan deck yang sama dengan desktop.
13. HP dapat mengontrol OBS melalui desktop.
14. Perubahan konfigurasi tersinkronisasi.
15. Koneksi dapat dipulihkan setelah gangguan.
16. Perangkat tidak terotorisasi ditolak.
17. Action gagal memberikan feedback yang jelas.
18. Aplikasi dapat dikemas menjadi installer Windows.

---

# 12. PROJECT STRUCTURE

```text
ConDeck/
├── apps/
│   ├── desktop/
│   │   ├── electron/
│   │   ├── src/
│   │   └── package.json
│   │
│   └── mobile/
│       ├── src/
│       └── package.json
│
├── packages/
│   ├── shared/
│   ├── database/
│   ├── action-engine/
│   ├── obs-integration/
│   └── websocket-protocol/
│
├── docs/
│   ├── PRD.md
│   ├── TECHNICAL_SPEC.md
│   ├── DATABASE.md
│   ├── API_CONTRACT.md
│   └── ROADMAP.md
│
├── package.json
└── pnpm-workspace.yaml
```

---

# 13. PRODUCT CONSTRAINTS

1. MVP berfokus pada Windows Desktop dan Mobile Browser.
2. OBS Studio merupakan integrasi streaming utama.
3. Fitur inti tidak membutuhkan akun atau cloud.
4. Mobile hanya berfungsi sebagai remote controller.
5. Desktop merupakan pusat eksekusi seluruh action.
6. Seluruh konfigurasi utama disimpan secara lokal.
7. Fitur tambahan tidak boleh merusak fungsi inti.
8. Pengembangan dilakukan secara bertahap berdasarkan milestone.

---

# 14. FUTURE DEVELOPMENT

Setelah MVP stabil, pengembangan dapat mencakup:

- Plugin ecosystem.
- Additional streaming integrations.
- Advanced soundboard.
- Spotify integration.
- Advanced audio routing.
- Application-specific profiles.
- Cloud backup.
- Custom plugin marketplace.
- Additional mobile capabilities.

Fitur masa depan tidak termasuk persyaratan wajib rilis pertama.

---

# 15. FINAL PRODUCT DEFINITION

ConDeck adalah aplikasi virtual Stream Deck berbasis desktop dan mobile yang memungkinkan pengguna mengontrol OBS Studio serta aktivitas streaming melalui tombol digital yang dapat dikustomisasi.

Desktop menjadi pusat konfigurasi dan eksekusi perintah, sedangkan smartphone berfungsi sebagai remote controller melalui jaringan lokal.

Produk mengutamakan fleksibilitas, performa, keamanan, dan kemudahan penggunaan dengan arsitektur modular yang memungkinkan penambahan integrasi dan fitur baru.

**Product Vision:** Make streaming control accessible, customizable, and hardware-independent.

**Product Name:** ConDeck  
**Tagline:** Your Stream. Your Control.  
**Initial Release:** ConDeck v1.0.0
