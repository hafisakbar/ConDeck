# ConDeck — Development Roadmap

**Version:** 1.0  
**Document Type:** Development Plan  
**Target Platform:** Windows Desktop + Mobile PWA

## 1. Development Objective

Roadmap ini menjadi panduan pengerjaan ConDeck dari tahap awal hingga MVP siap digunakan.

Pengerjaan dilakukan secara bertahap. Setiap tahap harus memiliki hasil yang dapat diuji sebelum melanjutkan ke tahap berikutnya.

Prioritas utama adalah menghasilkan sistem yang benar-benar berfungsi, bukan sekadar tampilan UI.

## 2. Development Strategy

Gunakan pendekatan incremental development.

Urutan pengerjaan:

1. Foundation.
2. Desktop UI dan Deck Builder.
3. Database dan Action Engine.
4. OBS Integration.
5. Mobile Remote.
6. Integration Testing dan Release.

Jangan mengerjakan seluruh fitur sekaligus.

## 3. Phase 1 — Foundation

**Objective:** Menyiapkan fondasi proyek.

Tasks:

- Membuat repository.
- Menginisialisasi pnpm workspace.
- Mengatur TypeScript.
- Membuat Electron application.
- Mengintegrasikan React dan Vite.
- Mengatur Tailwind CSS.
- Membuat struktur folder.
- Mengatur secure preload.
- Menyiapkan SQLite.
- Mengintegrasikan Drizzle ORM.
- Menyiapkan logging dan error handling.

Deliverables:

- Desktop application dapat dijalankan.
- Struktur monorepo siap digunakan.
- Database dapat dibuat dan diakses.
- IPC dasar berfungsi.
- Konfigurasi keamanan Electron diterapkan.

Acceptance Criteria:

- Aplikasi dapat dijalankan di Windows.
- Tidak ada error fatal saat startup.
- Database dapat menyimpan dan membaca data.
- Renderer tidak memiliki akses Node.js langsung.

## 4. Phase 2 — Desktop UI & Deck Builder

**Objective:** Membuat antarmuka utama dan pengelolaan deck.

Tasks:

- Membuat Dashboard.
- Membuat sidebar navigation.
- Membuat halaman Deck Editor.
- Membuat grid tombol.
- Membuat create deck.
- Membuat edit deck.
- Membuat delete deck.
- Membuat create page.
- Membuat edit page.
- Membuat delete page.
- Membuat button editor.
- Membuat button customization.
- Membuat icon selection.
- Membuat color customization.
- Membuat penyimpanan konfigurasi.

Deliverables:

- Dashboard berfungsi.
- Pengguna dapat membuat deck.
- Pengguna dapat menambahkan halaman.
- Pengguna dapat membuat dan mengatur tombol.
- Konfigurasi tersimpan secara lokal.

Acceptance Criteria:

- Deck dapat dibuat dan diedit.
- Tombol dapat dipindahkan atau diubah posisinya.
- Perubahan tersimpan setelah aplikasi ditutup.
- Tidak ada posisi tombol duplikat dalam satu halaman.

## 5. Phase 3 — Action Engine

**Objective:** Membuat sistem eksekusi action.

Tasks:

- Membuat Action Registry.
- Membuat action schema.
- Membuat validation handler.
- Membuat execution handler.
- Menghubungkan action dengan button.
- Membuat execution result.
- Membuat error feedback.
- Membuat action status.

Deliverables:

- Action Engine dapat menjalankan action berdasarkan konfigurasi tombol.
- Action dapat ditambahkan dan dihapus.
- Action dapat divalidasi.
- Action gagal dapat memberikan informasi error.

Acceptance Criteria:

- Action hanya berjalan melalui registry.
- Konfigurasi tidak valid ditolak.
- Hasil eksekusi dapat ditampilkan.
- Tidak ada arbitrary command execution dari Mobile.

## 6. Phase 4 — OBS Integration

**Objective:** Mengintegrasikan ConDeck dengan OBS Studio.

Tasks:

- Mengintegrasikan `obs-websocket-js`.
- Membuat halaman OBS settings.
- Membuat input host, port, dan password.
- Membuat Connect dan Disconnect.
- Mengambil daftar scene.
- Membuat Switch Scene action.
- Membuat Start Streaming action.
- Membuat Stop Streaming action.
- Membuat Start Recording action.
- Membuat Stop Recording action.
- Membuat Microphone Mute action.
- Membuat status synchronization.

Deliverables:

- OBS dapat terhubung.
- Daftar scene dapat diambil.
- Tombol dapat mengontrol OBS.
- Status streaming dan recording dapat ditampilkan.

Acceptance Criteria:

- Koneksi OBS dapat dilakukan.
- Action sesuai dengan respons OBS.
- Koneksi terputus dapat ditangani.
- Password tidak disimpan plaintext.
- Status OBS diperbarui dengan benar.

## 7. Phase 5 — Mobile Remote

**Objective:** Membuat Mobile sebagai remote controller.

Tasks:

- Membuat aplikasi React + Vite.
- Menyiapkan PWA.
- Membuat halaman connection.
- Membuat QR pairing.
- Membuat WebSocket server di Desktop.
- Membuat WebSocket client di Mobile.
- Membuat device authentication.
- Membuat deck synchronization.
- Membuat mobile button grid.
- Membuat page navigation.
- Membuat button press event.
- Membuat action feedback.
- Membuat reconnect mechanism.
- Membuat device management.

Deliverables:

- Mobile dapat terhubung ke Desktop.
- Mobile menampilkan deck.
- Tombol Mobile dapat mengontrol OBS melalui Desktop.
- Perangkat dapat dikelola.

Acceptance Criteria:

- Pairing melalui QR berhasil.
- Mobile dapat mengakses deck melalui LAN.
- Tombol dapat mengeksekusi action.
- Perangkat yang tidak diotorisasi ditolak.
- Mobile dapat reconnect setelah koneksi terputus.

## 8. Phase 6 — Testing & Release

**Objective:** Menstabilkan aplikasi dan menyiapkan distribusi.

Tasks:

- Unit testing.
- Integration testing.
- End-to-end testing.
- OBS connection testing.
- Mobile network testing.
- Database migration testing.
- Security testing.
- Performance testing.
- Error handling review.
- UI consistency review.
- Windows installer.
- Release documentation.

Deliverables:

- Aplikasi stabil.
- Installer Windows.
- Dokumentasi instalasi.
- Dokumentasi penggunaan.
- Release MVP.

Acceptance Criteria:

- Seluruh fitur P0 berfungsi.
- Tidak ada bug kritis yang diketahui.
- Database tetap konsisten.
- Aplikasi dapat diinstal dan dijalankan.
- Pengguna dapat menghubungkan Mobile dan OBS.

## 9. Release Milestones

| Version | Scope |
|---|---|
| 0.1 | Desktop foundation dan deck editor |
| 0.2 | Action Engine dan OBS integration |
| 0.3 | Mobile remote dan pairing |
| 0.9 | Beta testing dan stabilisasi |
| 1.0 | MVP release |
| 1.1 | Soundboard dan macro |
| 2.0 | Plugin system dan integrasi tambahan |

## 10. Priority Classification

**P0 — Must Have**

Fitur wajib untuk MVP:

- Desktop application.
- Dashboard.
- Deck editor.
- Button customization dasar.
- Database persistence.
- Action Engine.
- OBS integration.
- Mobile PWA.
- QR pairing.
- WebSocket communication.
- Device authentication.

**P1 — Should Have**

- Custom image.
- Soundboard.
- Macro.
- Advanced button feedback.
- Device management enhancement.

**P2 — Future Enhancement**

- Plugin system.
- Cloud synchronization opsional.
- Integrasi platform streaming lain.
- Advanced automation.
- Community presets.

## 11. Development Rules for AI

Ketika menggunakan AI untuk membantu pengerjaan:

1. Berikan dokumen PRD utama dan dokumen teknis terkait.
2. Kerjakan satu phase pada satu waktu.
3. Jangan langsung membuat seluruh aplikasi dalam satu prompt.
4. Minta AI menjelaskan file yang akan dibuat atau diubah.
5. Pastikan kode yang dibuat sesuai struktur proyek.
6. Jalankan aplikasi setelah setiap milestone.
7. Jangan mengganti teknologi tanpa alasan dan persetujuan.
8. Jangan membuat mock implementation untuk fitur yang seharusnya sudah berfungsi.
9. Pastikan perubahan tidak merusak fitur sebelumnya.
10. Perbarui dokumentasi jika terjadi perubahan arsitektur.

## 12. Estimated Timeline

Estimasi awal untuk satu developer:

| Phase | Estimasi |
|---|---|
| Foundation | 3–5 hari |
| Deck Builder | 5–8 hari |
| Action Engine | 4–6 hari |
| OBS Integration | 4–6 hari |
| Mobile Remote | 7–10 hari |
| Testing & Release | 4–7 hari |

Total estimasi: sekitar 4–6 minggu kerja efektif, dengan kemungkinan bertambah apabila ditemukan kendala teknis atau perubahan scope.

Estimasi ini bukan tenggat pasti.

## 13. Final Development Goal

MVP ConDeck dinyatakan selesai ketika pengguna dapat:

- Menjalankan ConDeck Desktop di Windows.
- Membuat deck dan tombol sendiri.
- Mengatur action setiap tombol.
- Menghubungkan ConDeck dengan OBS.
- Membuka ConDeck Mobile melalui smartphone.
- Melakukan pairing melalui QR Code.
- Mengontrol OBS melalui tombol Mobile.
- Melihat feedback dan status koneksi.

**Catatan:** Roadmap ini menjadi panduan pelaksanaan. PRD tetap menjadi sumber utama apabila terjadi perbedaan scope atau prioritas.