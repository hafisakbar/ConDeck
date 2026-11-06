# ConDeck

Virtual Stream Deck untuk OBS Studio. **ConDeck Desktop** (Electron) menjadi host: menyimpan konfigurasi, menjalankan action, menghubungkan OBS, dan melayani remote. **ConDeck Mobile** (PWA) hanya menjadi remote controller.

> **Your Stream. Your Control.**

## Status Implementasi

Pengembangan mengikuti `DEVELOPMENT_ROADMAP.md`, satu phase per iterasi.

| Phase | Cakupan | Status |
|---|---|---|
| 1 — Foundation | Monorepo, Electron, React, Tailwind, SQLite + Drizzle, preload aman, IPC, dashboard, navigasi | ✅ Selesai |
| 2 — Deck Builder | Deck, page, button grid, button editor, icon & colour customization, profile edit/delete | ✅ Selesai |
| 3 — Action Engine | Action registry, validasi, eksekusi, feedback | ⏳ Belum |
| 4 — OBS Integration | OBS WebSocket v5, scene/stream/record/audio | ⏳ Belum |
| 5 — Mobile Remote | PWA, WebSocket server, QR pairing, device auth | ⏳ Belum |
| 6 — Testing & Release | E2E, security, installer Windows | ⏳ Belum |

Halaman yang fiturnya belum masuk phase terkait menampilkan keterangan eksplisit, bukan data palsu.

### Yang sudah bisa dilakukan (Phase 1 + 2)

- Membuat, mengganti nama, mengubah ukuran grid, dan menghapus deck. Default 3 × 3, dengan preset 4 × 4, 5 × 3, 5 × 5 dan ukuran custom 1–8 baris/kolom.
- Menambah, mengganti nama, dan menghapus halaman. Posisi halaman otomatis dirapikan setelah penghapusan.
- Menambah tombol di slot kosong, lalu mengubah label, ikon, warna latar, warna teks, dan status aktifnya.
- Memindahkan tombol ke slot lain, dan menggandakan tombol ke slot kosong berikutnya.
- Mengedit dan menghapus profil; deck, halaman, dan tombol di dalamnya ikut terhapus.
- Semua perubahan langsung tersimpan ke SQLite dan tetap ada setelah aplikasi ditutup.

Konfigurasi action pada tombol belum tersedia karena itu bagian dari Action Engine (Phase 3); tombol saat ini menyimpan tampilannya saja.

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
│   │   ├── components/    # layout, ui, activity, dashboard, profiles
│   │   ├── pages/         # 7 halaman sesuai PRD §7.2
│   │   ├── stores/        # Zustand
│   │   └── lib/           # bridge, format, navigasi
│   └── scripts/dev.mjs    # dev runner
├── packages/
│   ├── config/            # tsconfig base
│   ├── shared/            # tipe + schema Zod + kontrak IPC
│   └── database/          # schema Drizzle, migrasi, repository
├── docs/                  # catatan keputusan arsitektur
└── pnpm-workspace.yaml
```

## Keamanan

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`.
- Renderer tidak memiliki akses Node.js maupun SQLite; semua data lewat IPC.
- IPC memakai allowlist channel (`packages/shared/src/ipc.ts`) dan validasi Zod di main process.
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
