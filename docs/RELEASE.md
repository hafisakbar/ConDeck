# ConDeck — Release & Installation

Panduan ini mencakup cara membuat installer Windows, memasangnya, dan hal-hal yang perlu diperiksa sebelum sebuah build disebut siap rilis (Phase 6).

## 1. Prasyarat build

- Windows 10/11 64-bit (untuk membuat installer NSIS).
- Node.js 20.19+ dan pnpm 10.20 (`corepack enable` atau `npm i -g pnpm@10.20.0`).
- OBS Studio dengan WebSocket server aktif (Tools → WebSocket Server Settings) untuk menguji integrasi.

Linux/macOS dapat menjalankan seluruh test dan build renderer, tetapi installer `.exe` dibuat di Windows (atau lewat workflow `release.yml` di `windows-latest`).

## 2. Membuat installer

```bash
pnpm install
pnpm build          # renderer desktop + Electron main/preload + PWA mobile
pnpm dist:win       # electron-builder: NSIS installer
```

Hasilnya ada di `release/`:

- `ConDeck-0.1.0-x64.exe` — installer NSIS (pilih folder instalasi, shortcut desktop + Start Menu).
- `win-unpacked/` — versi portable tanpa installer untuk pemeriksaan cepat.

Isi paket:

- Renderer desktop di dalam `app.asar`.
- `dist-electron/main` + `preload` (context isolation, sandbox).
- PWA mobile di `resources/mobile` — server remote menyajikannya dari `process.resourcesPath/mobile`.
- `better-sqlite3` di-rebuild untuk ABI Electron oleh `npmRebuild: true`.

Untuk build tanpa installer (memeriksa isi paket): `pnpm --filter @condeck/desktop dist:dir`.

## 3. Memasang

1. Jalankan `ConDeck-0.1.0-x64.exe`.
2. Windows SmartScreen dapat menampilkan “Windows protected your PC” karena installer belum ditandatangani. Pilih **More info → Run anyway** hanya untuk build yang kamu buat sendiri.
3. Pilih folder instalasi, lalu **Install**. ConDeck terbuka otomatis.

Instalasi tidak memerlukan hak administrator (`perMachine: false`).

## 4. Setelah instalasi

- **Database:** dibuat otomatis di `%APPDATA%\condeck\condeck.db` saat aplikasi pertama kali dijalankan. Migrasi dijalankan otomatis dan idempoten, jadi upgrade versi tidak menghapus data.
- **Log:** `%APPDATA%\condeck\logs\condeck.log`.
- **Firewall:** saat server remote pertama kali dinyalakan, izinkan ConDeck pada jaringan **Private** agar HP bisa terhubung (port default 43821).
- **Remote di HP:** buka **Devices**, nyalakan server remote, pindai QR. Alamat pertama yang ditampilkan adalah alamat Wi-Fi/Ethernet; alamat adapter virtual (VirtualBox/Hyper-V/VPN) ikut terdaftar tetapi tidak bisa dijangkau HP.
- **OBS:** buka **Integrations**, isi host/port/password OBS WebSocket, lalu Connect. Password disimpan lewat Electron `safeStorage` (tidak plaintext).

## 5. Upgrade

1. Tutup ConDeck.
2. Jalankan installer versi baru (menimpa instalasi lama; data pengguna tidak disentuh).
3. Buka ConDeck — migrasi database yang belum diterapkan dijalankan otomatis.

## 6. Uninstall

Windows Settings → Apps → ConDeck → Uninstall. Installer tidak menghapus `%APPDATA%\condeck` (`deleteAppDataOnUninstall: false`), sehingga deck dan perangkat yang sudah dipasangkan tetap ada bila ConDeck dipasang lagi. Hapus folder tersebut secara manual jika ingin benar-benar bersih.

## 7. Checklist rilis (Phase 6)

Semua langkah di bawah harus lulus sebelum build disebut siap:

- [ ] `pnpm -r typecheck` — bersih.
- [ ] `pnpm lint` — bersih.
- [ ] `pnpm test` — unit + integration (database, action engine, OBS client, remote server, mobile client).
- [ ] `pnpm build` — desktop + mobile.
- [ ] `pnpm test:e2e` — Playwright menjalankan PWA hasil build terhadap server remote sungguhan: pairing, render deck, tekan tombol, error pairing.
- [ ] `pnpm dist:win` — installer terbentuk di `release/`.
- [ ] Instal di Windows bersih, buka aplikasi, buat deck + tombol.
- [ ] Hubungkan OBS, jalankan Start/Stop Streaming dan switch scene dari desktop.
- [ ] Pairing HP di Wi-Fi yang sama, tekan tombol dari HP, cabut perangkat dan pastikan koneksinya terputus.

## 8. Batasan yang masih diketahui

- Installer belum ditandatangani (code signing) sehingga SmartScreen memperingatkan; sertifikat code signing belum disiapkan.
- Build installer hanya diverifikasi lewat konfigurasi dan workflow CI; instalasi pada mesin Windows fisik tetap perlu dilakukan manual sebelum rilis publik.
- E2E mencakup PWA mobile + server remote, belum menggabungkan UI Electron (butuh runner GUI/Windows).
- PWA remote memakai HTTP di LAN sehingga install penuh/offline (service worker) memerlukan HTTPS; lihat `docs/DECISIONS.md` ADR-027.
