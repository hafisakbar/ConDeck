# ConDeck

Virtual Stream Deck untuk OBS Studio. **ConDeck Desktop** (Electron) menjadi host: menyimpan konfigurasi, menjalankan action, menghubungkan OBS, dan melayani remote. **ConDeck Mobile** (PWA) hanya menjadi remote controller.

> **Your Stream. Your Control.**

## Status Implementasi

Pengembangan mengikuti `DEVELOPMENT_ROADMAP.md`, satu phase per iterasi. Kita bisa

| Phase                 | Cakupan                                                                                       | Status     |
| --------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| 1 — Foundation        | Monorepo, Electron, React, Tailwind, SQLite + Drizzle, preload aman, IPC, dashboard, navigasi | ✅ Selesai |
| 2 — Deck Builder      | Deck, page, button grid, button editor, icon & colour customization, profile edit/delete      | ✅ Selesai |
| 3 — Action Engine     | Action registry, validasi, eksekusi, feedback                                                 | ✅ Selesai |
| 4 — OBS Integration   | OBS WebSocket v5, scene/stream/record/audio                                                   | ✅ Selesai |
| 5 — Mobile Remote     | PWA, WebSocket server, QR pairing, device auth                                                | ✅ Selesai |
| 6 — Testing & Release | E2E, security, installer Windows                                                              | ⏳ Belum   |

Halaman yang fiturnya belum masuk phase terkait menampilkan keterangan eksplisit, bukan data palsu.

### Yang sudah bisa dilakukan (Phase 1 + 2 + 3 + 4 + 5)

- Membuat, mengganti nama, mengubah ukuran grid, dan menghapus deck. Default 3 × 3, dengan preset 4 × 4, 5 × 3, 5 × 5 dan ukuran custom 1–8 baris/kolom.
- Menambah, mengganti nama, dan menghapus halaman. Posisi halaman otomatis dirapikan setelah penghapusan.
- Menambah tombol di slot kosong, lalu mengubah label, ikon, warna latar, warna teks, dan status aktifnya.
- Memindahkan tombol ke slot lain, dan menggandakan tombol ke slot kosong berikutnya.
- Mengedit dan menghapus profil; deck, halaman, dan tombol di dalamnya ikut terhapus.
- Menyimpan satu action per tombol dari Action Registry: 7 action OBS, 2 action System (buka aplikasi, buka URL) dan 2 action Navigation (halaman berikutnya/sebelumnya).
- Konfigurasi action divalidasi dengan schema khusus per jenis action sebelum ditulis ke database; konfigurasi tidak valid ditolak dengan pesan yang jelas.
- Menjalankan action dari grid editor lewat tombol play: status berjalan, hasil sukses, dan pesan gagal tampil langsung di tombol dan panel properti.
- Action hanya dieksekusi berdasarkan tombol (button id) melalui registry; renderer tidak pernah mengirim perintah bebas dan tidak ada eksekusi shell.
- Action Navigation mengubah halaman deck aktif di desktop; action System membuka aplikasi/URL dengan handler default OS.
- Menghubungkan OBS Studio lewat OBS WebSocket v5 dari halaman Integrations: host, port, password, test connection, connect/disconnect, dan toggle aktif/nonaktif.
- Action OBS benar-benar mengontrol OBS: pindah scene, mulai/hentikan streaming, mulai/hentikan recording, toggle dan set mute audio input — dengan konfirmasi dari respons OBS, bukan asumsi sukses.
- Status OBS disinkronkan real-time: mengganti scene atau memulai stream langsung di OBS ikut tampil di ConDeck, begitu juga saat koneksi terputus.
- Daftar scene OBS dipakai sebagai pilihan di editor action, jadi nama scene tidak perlu diketik manual saat OBS terhubung.
- Password OBS tidak pernah disimpan plaintext: hanya disimpan sebagai ciphertext Electron `safeStorage` di kolom `credential_reference`.
- Semua perubahan langsung tersimpan ke SQLite dan tetap ada setelah aplikasi ditutup.
- Menyalakan remote server dari halaman Remote Devices: port (default 43821), start/stop, dan alamat LAN yang bisa dibuka dari HP.
- Membuat pairing code berumur 2 menit beserta QR code; kode sekali pakai dan dibatasi 5 percobaan.
- Memasangkan HP dengan memindai QR (token ada di fragment URL, tidak pernah dikirim ke server) atau mengetik alamat + kode secara manual.
- Kredensial perangkat dibuat acak 32 byte, disimpan di HP, dan desktop hanya menyimpan hash SHA-256-nya; verifikasi memakai perbandingan waktu konstan.
- Melihat daftar perangkat yang terhubung dan mencabut aksesnya; socket perangkat yang dicabut langsung diputus.
- Remote menampilkan deck profil aktif apa adanya — halaman, ukuran grid, label, ikon, dan warna — lalu menjalankan action yang sama dengan desktop lewat `button.press`.
- Status OBS (terhubung, live, recording, scene) dan hasil action tampil di HP; deck yang diubah di desktop langsung dikirim ulang.
- Remote tidak punya akses database dan tidak bisa mengirim perintah bebas: hanya `auth.pair`, `auth.resume`, `deck.get`, `button.press`, `page.change`, dan `ping` yang diterima.
- HP menyambung ulang otomatis dengan heartbeat 15 detik, dan berhenti mencoba ketika kredensialnya sudah dicabut.

## Prasyarat

- **Windows 10/11 64-bit** (target rilis) — proyek dapat di-typecheck/build di OS lain, tetapi aplikasi Electron belum diuji di luar Windows.
- Node.js >= 20.19
- pnpm 10 (`npm i -g pnpm@10`)
- OBS Studio 28+ dengan WebSocket server aktif (Tools → WebSocket Server Settings)

## Instalasi

```bash
pnpm install
# better-sqlite3 harus dikompilasi ulang untuk ABI Electron (sekali per instalasi, di mesin Windows)
pnpm --filter @condeck/desktop rebuild:native
pnpm dev
```

`pnpm dev` akan: mem-build main + preload process, menjalankan Vite dev server (port 5273), lalu membuka Electron.

## Perintah

| Perintah           | Fungsi                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| `pnpm dev`         | Jalankan ConDeck Desktop (development)                                 |
| `pnpm dev:mobile`  | Jalankan ConDeck Mobile (Vite, port 5274) untuk pengembangan UI remote |
| `pnpm build`       | Build produksi renderer + Electron main/preload                        |
| `pnpm typecheck`   | TypeScript check seluruh workspace                                     |
| `pnpm lint`        | ESLint                                                                 |
| `pnpm test`        | Vitest (unit + integration, tanpa GUI)                                 |
| `pnpm db:generate` | Generate migrasi SQL Drizzle setelah mengubah `schema.ts`              |

## Remote di HP

1. Build aplikasi mobile: `pnpm --filter @condeck/mobile build` (sudah termasuk dalam `pnpm build`).
2. Jalankan desktop (`pnpm dev`), buka **Remote Devices**, tentukan port, lalu nyalakan server remote.
3. Pastikan HP dan komputer berada di Wi-Fi yang sama, lalu pindai QR yang muncul. Bila kamera tidak bisa membuka tautannya, buka alamat yang tertulis dan tempelkan pairing code secara manual.
4. Setelah dipasangkan, HP mengingat kredensialnya dan menyambung ulang sendiri setiap kali halaman dibuka.

Catatan:

- Alamat yang dipakai QR adalah alamat LAN terbaik yang ditemukan (Wi-Fi/Ethernet diutamakan). Adapter virtual seperti VirtualBox, Hyper-V, WSL, atau VPN juga muncul di daftar alamat tetapi tidak bisa dijangkau HP — coba alamat berikutnya bila yang pertama timeout.
- Windows Firewall harus mengizinkan port remote (default 43821) untuk jaringan privat; tanpa itu HP tidak dapat membuka halaman. Jika jaringan Wi-Fi dikenali sebagai "Public", ubah profil jaringannya ke Private atau izinkan ConDeck di profil tersebut.
- Router dengan "client isolation"/"AP isolation" memblokir komunikasi antar perangkat di Wi-Fi yang sama; matikan opsi itu bila tersedia.
- Remote disajikan lewat HTTP biasa di LAN. Service worker dan prompt “Install app” memerlukan HTTPS, jadi tanpa itu halaman tetap berfungsi sebagai web app selama server desktop hidup — “Add to Home Screen” di iOS masih bisa, tetapi mode offline tidak.
- `pnpm dev:mobile` hanya untuk mengembangkan UI remote: buka di browser, lalu isi alamat desktop dan pairing code secara manual.
- Mencabut perangkat dari desktop langsung memutus koneksinya; HP berhenti mencoba dan diminta pairing ulang.

## Struktur

```text
condeck/
├── apps/mobile/           # PWA remote (Vite + React, disajikan server desktop)
├── apps/desktop/
│   ├── electron/
│   │   ├── main/          # lifecycle, window, IPC, services (database, dashboard)
│   │   └── preload/       # contextBridge — satu-satunya jembatan ke renderer
│   ├── src/
│   │   ├── components/    # layout, ui, activity, dashboard, profiles, deck
│   │   ├── pages/         # 7 halaman sesuai PRD §7.2
│   │   ├── stores/        # Zustand
│   │   └── lib/           # bridge, format, navigasi
│   └── scripts/dev.mjs    # dev runner
├── packages/
│   ├── config/            # tsconfig base
│   ├── shared/            # tipe + schema Zod + kontrak IPC
│   ├── action-engine/     # registry, port, executor action
│   ├── obs-integration/   # klien OBS WebSocket v5 + sinkronisasi status
│   ├── websocket-protocol/# kontrak pesan remote (Zod, envelope, close code)
│   └── database/          # schema Drizzle, migrasi, repository
├── docs/                  # catatan keputusan arsitektur
└── pnpm-workspace.yaml
```

## Keamanan

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`.
- Renderer tidak memiliki akses Node.js maupun SQLite; semua data lewat IPC.
- IPC memakai allowlist channel (`packages/shared/src/ipc.ts`) dan validasi Zod di main process.
- Action hanya berjalan lewat registry (`packages/action-engine`); konfigurasi diparse ulang sebelum eksekusi, satu eksekusi per tombol, dan timeout 10 detik.
- Action System memakai `shell.openPath`/`shell.openExternal` tanpa shell, hanya menerima path absolut dan URL http(s).
- Navigasi dan `window.open` dibatasi; `webview` diblokir.
- CSP ketat disuntikkan ke HTML hasil build (dev server dikecualikan karena kebutuhan HMR).
- Password OBS disimpan lewat Electron `safeStorage`; database hanya menyimpan referensi ciphertext. Sistem tanpa credential store aman (mis. Linux tanpa keyring) ditolak saat menyimpan password.
- Logger meredaksi field `password`, `secret`, `token`, `credential`, `hash`.
- Remote server hanya menerima pesan yang lolos schema Zod (maksimum 8 KB per pesan) dan hanya setelah perangkat terautentikasi; tidak ada channel untuk menjalankan shell atau perintah bebas.
- Pairing code disimpan di memori (bukan database), berumur 2 menit, sekali pakai, dan hangus setelah 5 percobaan.
- Kredensial perangkat hanya dikirim sekali saat pairing; database menyimpan hash SHA-256 dan perbandingan memakai `timingSafeEqual`. Respons remote memakai header CSP ketat (`connect-src 'self' ws: wss:`).

## Database

- Lokasi: `<userData>/condeck.db` (Windows: `%APPDATA%/ConDeck/condeck.db`).
- Pragmas: `foreign_keys = ON`, `journal_mode = WAL`.
- Schema: `packages/database/src/schema.ts` (10 tabel sesuai `DATABASE_DESIGN.md`).
- Migrasi: di-generate Drizzle Kit ke `packages/database/drizzle`, dibundel sebagai raw SQL dan diterapkan otomatis saat aplikasi start (`__condeck_migrations`).

Menambah perubahan schema: ubah `schema.ts` → `pnpm db:generate` → daftarkan file SQL baru di `packages/database/src/migrate.ts`.

## Catatan Pengembangan

- `pnpm dev` membangun main/preload sekali. Setelah mengubah `apps/desktop/electron/**`, hentikan dan jalankan ulang `pnpm dev`.
- Renderer memakai HMR normal dari Vite.
- Keputusan arsitektur dan resolusi konflik antar-dokumen dicatat di `docs/DECISIONS.md`.
