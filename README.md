# ConDeck

Virtual Stream Deck untuk OBS Studio. **ConDeck Desktop** (Electron) menjadi host: menyimpan konfigurasi, menjalankan action, menghubungkan OBS, dan melayani remote. **ConDeck Mobile** (PWA) hanya menjadi remote controller.

> **Your Stream. Your Control.**

## Status Implementasi

Pengembangan mengikuti `DEVELOPMENT_ROADMAP.md`, satu phase per iterasi.

| Phase | Cakupan | Status |
|---|---|---|
| 1 — Foundation | Monorepo, Electron, React, Tailwind, SQLite + Drizzle, preload aman, IPC, dashboard, navigasi | ✅ Selesai |
| 2 — Deck Builder | Deck, page, button grid, button editor, icon & colour customization, profile edit/delete | ✅ Selesai |
| 3 — Action Engine | Action registry, validasi, eksekusi, feedback | ✅ Selesai (OBS menunggu Phase 4) |
| 4 — OBS Integration | OBS WebSocket v5, scene/stream/record/audio | ⏳ Belum |
| 5 — Mobile Remote | PWA, WebSocket server, QR pairing, device auth | ⏳ Belum |
| 6 — Testing & Release | E2E, security, installer Windows | ⏳ Belum |

Halaman yang fiturnya belum masuk phase terkait menampilkan keterangan eksplisit, bukan data palsu.

### Yang sudah bisa dilakukan (Phase 1 + 2 + 3)

- Membuat, mengganti nama, mengubah ukuran grid, dan menghapus deck. Default 3 × 3, dengan preset 4 × 4, 5 × 3, 5 × 5 dan ukuran custom 1–8 baris/kolom.
- Menambah, mengganti nama, dan menghapus halaman. Posisi halaman otomatis dirapikan setelah penghapusan.
- Menambah tombol di slot kosong, lalu mengubah label, ikon, warna latar, warna teks, dan status aktifnya.
- Memindahkan tombol ke slot lain, dan menggandakan tombol ke slot kosong berikutnya.
- Mengedit dan menghapus profil; deck, halaman, dan tombol di dalamnya ikut terhapus.
- Menyimpan satu action per tombol dari Action Registry: 7 action OBS, 2 action System (buka aplikasi, buka URL) dan 2 action Navigation (halaman berikutnya/sebelumnya).
- Konfigurasi action divalidasi dengan schema khusus per jenis action sebelum ditulis ke database; konfigurasi tidak valid ditolak dengan pesan yang jelas.
- Menjalankan action dari grid editor lewat tombol play: status berjalan, hasil sukses, dan pesan gagal tampil langsung di tombol dan panel properti.
- Action hanya dieksekusi berdasarkan tombol (button id) melalui registry; renderer tidak pernah mengirim perintah bebas dan tidak ada eksekusi shell.
- Action Navigation mengubah halaman deck aktif di desktop; action System membuka aplikasi/URL dengan handler default OS; action OBS tervalidasi tetapi melaporkan `OBS_DISCONNECTED` sampai integrasi OBS (Phase 4).
- Semua perubahan langsung tersimpan ke SQLite dan tetap ada setelah aplikasi ditutup.

## Prasyarat

- **Windows 10/11 64-bit** (target rilis) — proyek dapat di-typecheck/build di OS lain, tetapi aplikasi Electron belum diuji di luar Windows.
- Node.js >= 20.19
- pnpm 10 (`npm i -g pnpm@10`)
- OBS Studio 28+ dengan WebSocket server aktif (dibutuhkan mulai Phase 4)

## Instalasi

```bash
pnpm install
# better-sqlite3 harus dikompilasi ulang untuk ABI Electron (sekali per instalasi, di mesin Windows)
pnpm --filter @condeck/desktop rebuild:native
pnpm dev
```

`pnpm dev` akan: mem-build main + preload process, menjalankan Vite dev server (port 5273), lalu membuka Electron.

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm dev` | Jalankan ConDeck Desktop (development) |
| `pnpm build` | Build produksi renderer + Electron main/preload |
| `pnpm typecheck` | TypeScript check seluruh workspace |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (unit + integration, tanpa GUI) |
| `pnpm db:generate` | Generate migrasi SQL Drizzle setelah mengubah `schema.ts` |

## Struktur

```text
condeck/
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
- Logger meredaksi field `password`, `secret`, `token`, `credential`, `hash`.

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
