# ConDeck — Architecture Decision Log

Catatan keputusan teknis yang berdampak besar (TECHNICAL_SPECIFICATION.md §10.10).
Dokumen sumber tetap menjadi acuan utama; file ini hanya mencatat keputusan implementasi dan konflik antar-dokumen.

---

## 1. Konflik antar-dokumen dan resolusinya

### 1.1 Item navigasi desktop

- **PRD §7.2** menyebut 7 menu: Dashboard, My Deck, Profiles, Integrations, Remote Devices, Activity Logs, Settings.
- **UI_UX_SPECIFICATION §4.1** menyebut 5 menu: Dashboard, Decks, Devices, Integrations, Settings.

**Resolusi:** mengikuti PRD (prioritas 1 — scope produk). Sidebar memakai 7 item agar Profiles dan Activity Logs tetap dapat diakses. Label disesuaikan dengan istilah PRD ("My Deck", "Remote Devices", "Activity Logs").
**Dampak:** UI_UX_SPECIFICATION §4.1 perlu diselaraskan pada pembaruan dokumen berikutnya.

### 1.2 Urutan phase dan posisi Dashboard

- **PRD §10** memasukkan Dashboard dan navigasi di Phase 1, serta menggabungkan Action Engine + OBS di Phase 3.
- **DEVELOPMENT_ROADMAP** menaruh Dashboard di Phase 2, dan memisahkan Action Engine (Phase 3) dari OBS Integration (Phase 4).

**Resolusi:** urutan pengerjaan mengikuti DEVELOPMENT_ROADMAP (prioritas 6 — acuan urutan). Phase 1 tetap memuat Dashboard + navigasi (sesuai PRD), tetapi isinya dibatasi pada data nyata yang sudah tersedia: status aplikasi, profil aktif, jumlah deck, jumlah perangkat, status OBS, dan activity log. Komponen deck/button editor menyusul di Phase 2.
**Dampak:** tidak ada; kedua dokumen tetap terpenuhi untuk Phase 1.

### 1.3 Status OBS

PRD mensyaratkan status OBS berdasarkan koneksi aktual. Sebelum Phase 4, status diturunkan dari tabel `integrations`:
`NOT_CONFIGURED` (belum ada baris), `DISABLED` (integrasi dinonaktifkan), `DISCONNECTED` (terkonfigurasi tapi belum tersambung) — tidak pernah ada `CONNECTED` palsu.

Sejak Phase 4, `CONNECTED` hanya dilaporkan ketika klien OBS WebSocket benar-benar terhubung, dan status lain tetap memakai aturan di atas sebagai fallback.

---

## 2. Keputusan arsitektur

### ADR-001 — Struktur monorepo

Dibuat sekarang: `packages/shared`, `packages/database`, `packages/config`.
`packages/action-engine`, `packages/obs-integration`, `packages/websocket-protocol` **sengaja belum dibuat** karena implementasinya adalah isi Phase 3–5. Membuatnya sekarang hanya akan menghasilkan stub kosong yang melanggar aturan "jangan membuat mock implementation". (Ketiganya sudah dibuat saat phase-nya dikerjakan: action-engine di Phase 3, obs-integration di Phase 4, websocket-protocol di Phase 5.)

Status terkini: `action-engine` dibuat di Phase 3 dan `obs-integration` di Phase 4; `websocket-protocol` menyusul di Phase 5.

Konsekuensi: struktur folder final tetap sesuai TECHNICAL_SPECIFICATION §4, hanya bertambah saat phase terkait dikerjakan.

### ADR-002 — Build Electron memakai Vite

Main process dan preload dibundel dengan Vite (library mode, output CJS) memakai konfigurasi terpisah, bukan bundler tambahan. Alasan: tetap dalam stack yang ditentukan, tanpa dependency build baru, dan workspace package (TypeScript) dapat di-bundle langsung sehingga tidak perlu langkah build terpisah per package.

`better-sqlite3` dan `electron` ditandai external karena keduanya native/runtime module.

### ADR-003 — Migrasi dibundel sebagai raw SQL

Drizzle Kit menghasilkan `packages/database/drizzle/0000_init.sql`. Runner internal (`packages/database/src/migrate.ts`) meng-import SQL tersebut dengan `?raw` dan menerapkannya dalam transaksi, mencatat setiap migrasi pada tabel `__condeck_migrations`.

Alasan: aplikasi yang dipaketkan tidak dapat diandalkan membaca folder migrasi dari disk; dengan bundling, migrasi selalu tersedia dan idempoten.

### ADR-004 — Driver SQLite: `better-sqlite3`

`better-sqlite3` dipakai bersama `drizzle-orm/better-sqlite3` (sinkron, cepat, matang). Konsekuensi: binding native harus di-rebuild untuk ABI Electron (`pnpm --filter @condeck/desktop rebuild:native`). Langkah ini otomatis ditangani electron-builder saat packaging di Phase 6.

### ADR-005 — Navigasi renderer tanpa router

Navigasi antar halaman memakai Zustand (`useNavigationStore`) alih-alih menambah `react-router`. Stack tidak menyebut router, dan aplikasi hanya memiliki 7 halaman linear tanpa URL semantics (dimuat dari `file://`).

### ADR-006 — Tailwind CSS v4 (CSS-first)

Tailwind v4 dengan `@tailwindcss/vite`; design token didefinisikan di `@theme` pada `apps/desktop/src/index.css` (warna surface, aksen, radius, tipografi). Ini tetap "Tailwind CSS" sesuai batasan teknologi, dengan konfigurasi berbasis CSS yang lebih ringkas.

### ADR-007 — Kontrak IPC sebagai satu sumber kebenaran

`packages/shared/src/ipc.ts` mendefinisikan: daftar channel (allowlist), schema input Zod, envelope hasil (`{ ok: true, data }` / `{ ok: false, error }`), dan interface `ConDeckBridge` yang diimplementasikan preload dan dikonsumsi renderer.

Semua handler di main process melewati helper yang sama: parse dengan Zod → eksekusi → map `AppError` ke kode IPC → log tanpa data sensitif.

---

### ADR-008 — Deck baru otomatis memiliki satu halaman "Main"

`decks:create` membuat deck dan halaman pertama bernama "Main" (position 0) dalam satu transaksi. Alasan: DATABASE_DESIGN.md menghubungkan tombol ke halaman, sehingga deck tanpa halaman tidak dapat digunakan sama sekali; PRD §6.1 juga mengalirkan pengguna langsung dari "membuat deck" ke "menambahkan tombol".

### ADR-009 — Batas grid 1–8 kolom dan 1–8 baris

PRD §5.2 mengizinkan konfigurasi custom tanpa menyebut batas. Diterapkan batas 8 × 8 agar grid tetap terbaca di jendela desktop dan tiap slot masih cukup besar untuk label. Preset 3 × 3 (default), 4 × 4, 5 × 3 dan 5 × 5 disediakan sesuai PRD.

### ADR-010 — Memindahkan tombol lewat properties panel, bukan drag & drop

Acceptance criteria Phase 2 hanya mensyaratkan "tombol dapat dipindahkan atau diubah posisinya". Drag & drop tercatat sebagai fitur v1.1 pada PRD §4.2, sehingga pemindahan dilakukan dengan memilih slot tujuan di panel properti — berfungsi penuh tanpa menambah dependency dan tanpa mendahului scope v1.1.

### ADR-011 — Profile edit/delete ikut dikerjakan di Phase 2

DEVELOPMENT_ROADMAP §4 tidak menyebut profile management, tetapi PRD §10 (Phase 2) menyebutnya dan PRD §5.7 mensyaratkan create/edit/delete/activate. Karena PRD berprioritas lebih tinggi, `profiles:update` dan `profiles:delete` ditambahkan. Penghapusan memakai cascade database; bila profil aktif dihapus, profil tertua yang tersisa otomatis menjadi aktif agar aplikasi tetap punya konteks.

### ADR-012 — Konfigurasi action ditunda ke Phase 3

Button editor Phase 2 hanya menyimpan label, ikon, warna, status aktif, dan posisi. Panel properti menampilkan keterangan bahwa konfigurasi action menyusul di Action Engine, bukan field yang tidak berfungsi — sesuai aturan "jangan membuat mock implementation".

### ADR-013 — Konsistensi posisi halaman setelah penghapusan

`pages:delete` menomori ulang halaman yang tersisa dalam dua fase (offset sementara lalu posisi final) agar unique index `(deck_id, position)` tidak dilanggar saat satu baris bergeser ke posisi baris lain.

### ADR-014 — Action Engine sebagai package dengan port

`packages/action-engine` berisi registry, executor dan antarmuka port (`ObsPort`, `SystemPort`, `NavigationPort`). Engine tidak meng-import Electron, database, maupun jaringan; efek samping selalu lewat port yang disuntikkan main process. Konsekuensi: handler action dapat diuji tanpa Electron, dan implementasi OBS di Phase 4 cukup mengganti `ObsPort`.

Di Phase 3, `ObsPort` selalu melaporkan `OBS_DISCONNECTED`. Action OBS tetap dapat dikonfigurasi dan divalidasi, tetapi eksekusinya gagal dengan pesan jelas — bukan sukses palsu (sesuai aturan "jangan membuat mock implementation"). Phase 4 mengganti implementasi port itu dengan klien OBS sungguhan tanpa mengubah engine atau handler action.

### ADR-015 — Satu action per tombol di Phase 3

PRD §4.2 mencantumkan multi-action sebagai fitur lanjutan (roadmap v1.1). Karena itu `actions:set` mengganti action yang ada pada posisi 0, bukan menumpuk action baru. Tabel `actions` tetap menyimpan kolom `position` sehingga multi-action dapat ditambahkan tanpa migrasi.

### ADR-016 — Eksekusi hanya lewat button id

Renderer mengirim `{ buttonId }` ke `actions:execute`; konfigurasi action dibaca dari database dan diparse ulang di engine sebelum handler dipanggil. Tidak ada jalur untuk mengirim action type, konfigurasi, atau perintah bebas dari renderer — dan nanti dari mobile (Phase 5). Ini memenuhi acceptance criteria "action hanya berjalan melalui registry" dan "tidak ada arbitrary command execution dari Mobile".

Action System memakai `shell.openPath`/`shell.openExternal` tanpa shell. Input dibatasi: path absolut saja (tanpa argumen tambahan) dan URL `http`/`https` saja.

### ADR-017 — Hasil eksekusi adalah data, bukan error IPC

Kegagalan saat menjalankan action (OBS terputus, timeout, error OS) dikembalikan sebagai `ActionExecutionResult` dengan `status: FAILED` dan `code` stabil, sehingga tombol selalu punya feedback. Envelope IPC `ok: false` hanya dipakai untuk request yang tidak valid: tombol tidak ditemukan, tombol dinonaktifkan, atau payload tidak lolos schema.

Executor menerapkan dua aturan PRD §5.4: satu eksekusi berjalan per tombol (`ACTION_BUSY`) dan batas waktu 10 detik (`ACTION_TIMEOUT`).

### ADR-018 — Navigasi halaman lewat event main → renderer

Halaman aktif dimiliki renderer, sehingga action `NAV_NEXT_PAGE`/`NAV_PREV_PAGE` dikirim balik sebagai event `navigation:request`. Preload memvalidasi payload dengan Zod dan hanya mengekspos fungsi berlangganan (tidak ada `ipcRenderer` mentah). Halaman terakhir/kembali ke halaman pertama (wrap around) dan event hanya memengaruhi deck yang sedang dibuka.

### ADR-019 — Aktivitas action ikut dicatat

`actions:set`, `actions:delete`, dan `actions:execute` menulis activity log (`ACTION_CONFIGURED`, `ACTION_REMOVED`, `ACTION_EXECUTED`, `ACTION_FAILED`). Log memuat button id, action type, status dan durasi, tanpa konfigurasi sensitif, sehingga halaman Activity Logs langsung berguna untuk menelusuri action yang gagal.

### ADR-020 — Klien OBS sebagai package dengan socket yang disuntikkan

`packages/obs-integration` membungkus `obs-websocket-js` v5, tetapi seluruh logika koneksi dan sinkronisasi status hanya berbicara pada antarmuka `ObsSocket` (connect/disconnect/call/event). Adapter nyata (`createObsSocket`) hanya berisi pemetaan tipe; test memakai socket palsu sehingga tidak ada koneksi jaringan saat `pnpm test`.

Alasan: keputusan dan penanganan error OBS bisa diuji, dan main process tetap pemilik satu-satunya koneksi. Paket ini di-bundle Vite ke main process, jadi aplikasi tidak bergantung pada `node_modules` saat runtime.

### ADR-021 — Password OBS lewat safeStorage, bukan kolom plaintext

Pengaturan OBS disimpan pada satu baris `integrations` (provider `obs`): host, port, `is_enabled`, dan `credential_reference`. Password dienkripsi `safeStorage.encryptString` lalu disimpan sebagai `safeStorage:v1:<base64>` di `credential_reference`; database tidak pernah memuat password asli. API pengaturan membedakan tiga arti: `password` tidak dikirim = pertahankan yang tersimpan, string kosong = hapus, string lain = ganti.

Jika OS tidak menyediakan credential store aman (Electron melaporkan backend `basic_text`, mis. Linux tanpa keyring), penyimpanan password ditolak dengan pesan jelas; menyimpan host/port tanpa password tetap diizinkan.

### ADR-022 — Status OBS didorong sebagai event, bukan polling

Main process mengirim snapshot `obs:status` setiap kali state berubah (connect/disconnect, scene berubah, stream/record mulai atau berhenti, input mute berubah, koneksi OBS terputus). Renderer hanya berlangganan lewat preload (`onObsStatus`) dan tidak pernah polling ke OBS. Sumber kebenaran adalah event OBS, bukan nilai yang baru saja dikirim ConDeck: perintah yang gagal tidak mengubah status.

`ObsSnapshot` memuat state koneksi, host/port tersimpan, `hasPassword`, scene aktif, daftar scene, status streaming dan recording. Dashboard dan halaman Integrations membaca snapshot yang sama.

### ADR-023 — Test connection memakai klien sementara

Tombol **Test connection** membuat klien OBS sekali pakai dari nilai form (tanpa menyimpannya), menghubungkan, membaca daftar scene, lalu memutus koneksi. Koneksi aktif tidak terganggu dan database tidak berubah. Kegagalan dikembalikan sebagai data `{ ok: false, message }` agar form bisa menampilkannya tanpa dianggap error IPC.

### ADR-024 — Timeout dan pemetaan error OBS

Koneksi dibatasi 8 detik dan setiap request OBS 10 detik (selaras dengan timeout Action Engine). Error OBS dipetakan ke pesan yang bisa ditindaklanjuti: kode 4009 (authentication failed) menjadi "OBS menolak password", kegagalan jaringan menjadi "tidak bisa menghubungi OBS di host:port", dan request yang gagal menjadi `OBS_REQUEST_FAILED` dengan pesan OBS.

Konsekuensi: request yang timeout dilaporkan `ACTION_TIMEOUT`/gagal, tetapi promise `obs-websocket-js` yang mendasarinya tidak dapat dibatalkan (dicatat di §3).

### ADR-025 — Editor action memakai daftar scene dari OBS

Field `sceneName` pada action Switch scene ditampilkan sebagai dropdown berisi scene dari snapshot OBS ketika OBS terhubung; nilai yang sudah tersimpan tetap muncul walau scene tersebut sudah tidak ada, supaya konfigurasi lama tidak hilang diam-diam. Saat OBS tidak terhubung, field tetap berupa input teks dan action tetap bisa disimpan — validasi nama scene sebenarnya dilakukan OBS saat eksekusi.

### ADR-026 — Remote sebagai PWA yang disajikan server desktop

ConDeck Mobile dibuat sebagai aplikasi web statis (`apps/mobile`, Vite + React + Tailwind) yang di-build ke `apps/mobile/dist` dan disajikan oleh server remote desktop di `http://<lan-ip>:43821/`. Tidak ada aplikasi native, tidak ada backend terpisah, dan tidak ada akses database dari HP: satu-satunya jalur data adalah WebSocket ke desktop.

Konsekuensi: HP harus berada di jaringan yang sama dengan desktop dan port remote harus diizinkan firewall. Karena halaman disajikan lewat HTTP biasa (bukan secure context), service worker tidak aktif di LAN; shell tetap bisa dipasang sebagai shortcut, tetapi tanpa mode offline. Path `dist` dicari di `CONDECK_MOBILE_DIR`, `resources/mobile` (build terpaket), atau `apps/mobile/dist` (development).

### ADR-027 — Kredensial perangkat: dikirim sekali, disimpan sebagai hash

Pairing code dibuat acak 32 byte, hanya hidup di memori, berumur 2 menit, sekali pakai, dan hangus setelah 5 percobaan. Saat pairing berhasil, desktop membuat kredensial perangkat acak 32 byte (base64url) dan mengirimkannya satu kali; database hanya menyimpan hash SHA-256 di `devices.credential_hash`, dan verifikasi memakai `timingSafeEqual`.

Kredensial disimpan di HP (localStorage) dan dikirim ulang pada setiap koneksi baru lewat `auth.resume`. Mencabut perangkat menutup socket yang sedang terbuka, dan HP yang ditolak berhenti mencoba lalu menghapus kredensialnya. Kode pairing tidak pernah masuk database maupun log.

### ADR-028 — Kontrak pesan sebagai package bersama

`packages/websocket-protocol` (Zod) memuat envelope `{ type, requestId, timestamp, payload }`, schema setiap pesan, konstanta (port 43821, path `/ws`, TTL pairing, interval heartbeat, batas 8 KB) dan close code. Desktop dan mobile memvalidasi pesan dengan schema yang sama sebelum apa pun dieksekusi.

Pesan yang tidak valid dijawab `error` dengan `INVALID_REQUEST`; pesan melebihi 8 KB langsung menutup koneksi (1009), dan batas 30 pesan per 5 detik per koneksi menutup koneksi dengan 4429.

### ADR-029 — Snapshot deck tanpa konfigurasi action

Remote menerima `deck.snapshot` berisi deck profil aktif: nama, kolom/baris, halaman, dan tombol dengan label, ikon, warna, status aktif, serta `hasAction` — tanpa konfigurasi action. Eksekusi tetap terjadi di desktop berdasarkan `buttonId` yang divalidasi terhadap deck aktif, jadi HP tidak pernah mengirim detail action.

Perubahan deck mengirim `deck.updated`, dan mobile merespons dengan `deck.get`. Status OBS didorong lewat `obs.status` setiap kali OBS berubah. Bila profil aktif belum punya deck, payload snapshot bernilai `null` dan mobile menampilkan keadaan kosong, bukan data palsu.

### ADR-030 — Pengaturan remote di tabel integrations

Port dan status aktif remote disimpan pada baris `integrations` provider `remote`, sama seperti pengaturan OBS, sehingga tidak perlu migrasi baru. Server dijalankan/dihentikan dari halaman Remote Devices dan statusnya dipublikasikan lewat event `remote:status`; pairing code hanya berada di status (memori) dan hilang saat aplikasi ditutup.

### ADR-031 — E2E memakai Playwright di dalam Vitest

E2E menjalankan PWA hasil build di Chromium headless, terhubung ke `createRemoteServer` sungguhan dengan SQLite sungguhan: pairing dari link QR, render deck, tekan tombol, dan error pairing. Runner-nya Vitest (bukan `@playwright/test`) agar alias workspace dan impor `?raw` migrasi SQL tetap bekerja tanpa build tambahan. Konsekuensi: E2E dijalankan dengan konfigurasi terpisah (`vitest.e2e.config.ts`, `pnpm test:e2e`) karena membutuhkan `apps/mobile/dist` dan Chromium.

### ADR-032 — Distribusi lewat electron-builder + workflow Windows

Paket Windows memakai electron-builder dengan target NSIS (`perMachine: false`, installer memilih folder, shortcut desktop/Start Menu) dan `extraResources` berisi `apps/mobile/dist` ke `resources/mobile` — jalur yang sudah dibaca `resolveMobileAssetsDir()` saat `app.isPackaged`. Native `better-sqlite3` di-rebuild oleh `npmRebuild: true`. Installer dibuat di `windows-latest` melalui `.github/workflows/release.yml`; CI Linux hanya memverifikasi typecheck, lint, test, build, dan E2E. Konsekuensi: installer belum ditandatangani (SmartScreen) dan instalasi di Windows fisik tetap harus diuji manual.

### ADR-033 — Deck 3D memakai three.js + react-three-fiber, preferensi tampilan di perangkat

Panggung deck dirender dengan `three`, `@react-three/fiber`, dan `@react-three/drei` (RoundedBox, ContactShadows, Environment). Setiap tombol adalah mesh keycap + socket sendiri dengan raycast dari fiber, dan label/ikon digambar ke `CanvasTexture` (ikon Lucide diserialisasi lewat `renderToStaticMarkup`). Scene dimuat dengan `React.lazy` supaya three.js tidak masuk bundle halaman lain, dan ada fallback grid 2D bila WebGL tidak tersedia.

Batas data dijaga: `decks.columns`/`decks.rows` tetap satu-satunya sumber ukuran grid (1–8) dan tidak ada skema baru. Ukuran tombol, jarak, zoom, dan mode edit/live adalah preferensi tampilan murni, jadi disimpan di `localStorage` (`condeck.device.preferences`, `condeck.device.mode`) lewat `lib/device-preferences.ts`. Konsekuensinya preferensi tidak ikut tersinkron antar komputer, dan menghapus data situs mengembalikannya ke default.

Konsekuensi lain: bundle renderer bertambah satu chunk three.js (>500 kB) yang hanya diunduh saat halaman My Deck dibuka, sehingga peringatan `chunkSizeWarningLimit` Vite tetap muncul.

---

## 3. Utang teknis yang diketahui (dicatat, bukan disembunyikan)

1. Binding native Electron belum diverifikasi di lingkungan build saat ini (Linux tanpa GUI, target Windows). Aplikasi Electron belum dijalankan dan dilihat secara visual.
2. Remote (Phase 5) sudah berjalan dan diuji lewat integration test dengan HTTP/WebSocket sungguhan, tetapi belum dicoba pada HP fisik. PWA belum installable penuh karena LAN memakai HTTP (butuh HTTPS untuk service worker), dan belum ada dukungan `wss://`/sertifikat.
3. Rate limit remote dihitung per koneksi, bukan per IP/perangkat; pembatasan lintas koneksi dan proteksi brute force pairing di level jaringan belum ada.
4. Remote hanya menampilkan deck pertama dari profil aktif dan satu action per tombol; pemilihan deck dan multi-action menunggu roadmap v1.1.
5. Multi-action per tombol, drag & drop, custom image, soundboard dan macro belum ada (roadmap v1.1).
6. Action yang melewati batas waktu tidak dapat dibatalkan: hasilnya dilaporkan `ACTION_TIMEOUT`, tetapi promise handler (termasuk request OBS) tetap berjalan sampai selesai. Pembatalan sungguhan perlu AbortSignal di `ObsPort`.
7. ConDeck tidak melakukan auto-reconnect ke OBS: bila OBS ditutup atau WebSocket-nya dimatikan, status berubah ke `DISCONNECTED` dan pengguna perlu menekan Connect lagi. (Remote di HP sudah punya auto-reconnect sendiri.)
8. Koneksi OBS hanya memakai `ws://` (LAN/localhost). `wss://` dengan sertifikat kustom belum didukung.
9. Nama audio input untuk action mute masih diketik manual; daftar input audio dari OBS belum ditampilkan karena roadmap Phase 4 hanya mensyaratkan daftar scene.
10. Installer Windows sudah dikonfigurasi dan dibangun lewat workflow `windows-latest`, tetapi belum diverifikasi dengan instalasi pada mesin Windows fisik di lingkungan pengembangan ini. Installer juga belum ditandatangani (SmartScreen memperingatkan).
11. E2E mencakup PWA mobile + server remote + database, belum UI Electron (butuh runner GUI/Windows). Checklist manual di `docs/RELEASE.md` menutup celah ini sebelum rilis.
12. Performance testing masih terbatas pada pengukuran tidak formal: belum ada benchmark berkelanjutan untuk snapshot deck besar atau latensi remote di bawah beban.
13. Deck 3D baru diverifikasi lewat harness Chromium (screenshot `docs/screenshots`) dan unit test geometri grid, belum dijalankan di dalam Electron pada Windows. Render WebGL di GPU nyata, perilaku `safeStorage`, dan drag/zoom dengan trackpad masih perlu dicek manual.
14. Screenshot di `docs/screenshots` dihasilkan `scripts/preview/capture.mjs` dengan bridge tiruan; angkanya bukan bukti integrasi database/OBS.
