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

### 1.3 Status OBS sebelum Phase 4

PRD mensyaratkan status OBS berdasarkan koneksi aktual. Sebelum integrasi OBS ada, status diturunkan dari tabel `integrations`:
`NOT_CONFIGURED` (belum ada baris), `DISABLED` (integrasi dinonaktifkan), `DISCONNECTED` (terkonfigurasi tapi belum tersambung). Tidak ada state "CONNECTED" palsu sebelum Phase 4.

---

## 2. Keputusan arsitektur

### ADR-001 — Struktur monorepo

Dibuat sekarang: `packages/shared`, `packages/database`, `packages/config`.
`packages/action-engine`, `packages/obs-integration`, `packages/websocket-protocol` **sengaja belum dibuat** karena implementasinya adalah isi Phase 3–5. Membuatnya sekarang hanya akan menghasilkan stub kosong yang melanggar aturan "jangan membuat mock implementation".

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

## 3. Utang teknis yang diketahui (dicatat, bukan disembunyikan)

1. Binding native Electron belum diverifikasi di lingkungan build saat ini (Linux tanpa GUI, target Windows).
2. Integrasi OBS, action engine, remote server, dan QR pairing belum diimplementasikan (Phase 3–5).
3. Penghapusan profile dari UI belum tersedia (Phase 2 melengkapi CRUD profile; skema DB sudah mendukung cascade).
4. Belum ada electron-builder config/installer (Phase 6).
