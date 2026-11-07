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
`packages/action-engine`, `packages/obs-integration`, `packages/websocket-protocol` **sengaja belum dibuat** karena implementasinya adalah isi Phase 3–5. Membuatnya sekarang hanya akan menghasilkan stub kosong yang melanggar aturan "jangan membuat mock implementation".

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

---

## 3. Utang teknis yang diketahui (dicatat, bukan disembunyikan)

1. Binding native Electron belum diverifikasi di lingkungan build saat ini (Linux tanpa GUI, target Windows). Aplikasi Electron belum dijalankan dan dilihat secara visual.
2. Remote server, device authentication, dan QR pairing (Phase 5) belum diimplementasikan.
3. Multi-action per tombol, drag & drop, custom image, soundboard dan macro belum ada (roadmap v1.1).
4. Action yang melewati batas waktu tidak dapat dibatalkan: hasilnya dilaporkan `ACTION_TIMEOUT`, tetapi promise handler (termasuk request OBS) tetap berjalan sampai selesai. Pembatalan sungguhan perlu AbortSignal di `ObsPort`.
5. ConDeck tidak melakukan auto-reconnect: bila OBS ditutup atau WebSocket-nya dimatikan, status berubah ke `DISCONNECTED` dan pengguna perlu menekan Connect lagi.
6. Koneksi OBS hanya memakai `ws://` (LAN/localhost). `wss://` dengan sertifikat kustom belum didukung.
7. Nama audio input untuk action mute masih diketik manual; daftar input audio dari OBS belum ditampilkan karena roadmap Phase 4 hanya mensyaratkan daftar scene.
8. Belum ada electron-builder config/installer (Phase 6).
