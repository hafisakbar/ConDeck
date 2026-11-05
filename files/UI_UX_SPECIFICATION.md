# ConDeck — UI/UX Specification

**Version:** 1.0  
**Document Type:** UI/UX Design Specification  
**Related Document:** ConDeck PRD

## 1. Design Overview

ConDeck merupakan aplikasi kontrol streaming yang harus terasa modern, profesional, cepat, dan mudah digunakan.

Desain tidak boleh terasa seperti dashboard admin generik. Tampilan harus mengutamakan pengalaman pengguna yang sedang mengontrol aktivitas streaming.

Referensi utama adalah konsep virtual Stream Deck, bukan menyalin tampilan aplikasi lain secara langsung.

Tagline:

**Your Stream. Your Control.**

## 2. Design Principles

1. Clean and modern.
2. Dark-first interface.
3. Clear visual hierarchy.
4. Minimal unnecessary elements.
5. Fast interaction.
6. Consistent components.
7. Responsive mobile layout.
8. Visual feedback for every important action.

## 3. Visual Direction

Gunakan gaya visual:

- Dark interface sebagai tema utama.
- Neutral dark background.
- Surface contrast untuk membedakan panel.
- Satu warna aksen utama yang konsisten.
- Rounded corners secukupnya.
- Subtle borders.
- Soft shadows.
- Smooth transitions.
- Typography yang mudah dibaca.

Hindari:

- Terlalu banyak gradient.
- Efek glow berlebihan.
- Glassmorphism di seluruh komponen.
- Terlalu banyak warna aksen.
- Animasi yang mengganggu.
- Dashboard yang terlalu padat.

## 4. Desktop Application Layout

### 4.1 Main Navigation

Desktop memiliki navigasi utama:

- Dashboard.
- Decks.
- Devices.
- Integrations.
- Settings.

Navigasi harus konsisten pada seluruh halaman.

### 4.2 Dashboard

Dashboard menjadi halaman awal aplikasi.

Informasi utama:

- OBS connection status.
- Active profile.
- Active deck.
- Connected devices.
- Quick access ke Deck Editor.
- Recent activity.

Dashboard harus ringkas dan menampilkan informasi yang benar-benar berguna.

### 4.3 Deck Editor

Deck Editor adalah fitur utama ConDeck.

Layout terdiri dari:

- Navigation atau toolbar.
- Deck selector.
- Page selector.
- Button grid.
- Button properties panel.
- Preview area.

Pengguna dapat memilih tombol untuk membuka konfigurasi tombol tersebut.

Fitur utama:

- Add button.
- Edit button.
- Delete button.
- Move button.
- Change icon.
- Change label.
- Change background color.
- Configure action.
- Preview button.

Grid harus dapat disesuaikan berdasarkan jumlah baris dan kolom deck.

### 4.4 Button Editor

Button editor digunakan untuk mengatur tampilan dan perilaku tombol.

Properties:

- Label.
- Icon.
- Image.
- Background color.
- Text color.
- Action type.
- Action configuration.
- Enabled state.

Tampilan konfigurasi harus berubah sesuai action type yang dipilih.

### 4.5 Device Management

Menampilkan:

- Pair new device.
- QR pairing.
- Connected devices.
- Device name.
- Connection status.
- Last seen.
- Revoke device access.

### 4.6 OBS Integration

Menampilkan:

- OBS connection status.
- Host.
- Port.
- Password input.
- Connect button.
- Disconnect button.
- Connection feedback.

Password harus disamarkan dan tidak ditampilkan kembali sebagai plaintext.

### 4.7 Settings

Pengaturan mencakup:

- General.
- Appearance.
- Network.
- Storage.
- About.

## 5. Mobile Application Layout

Mobile adalah remote controller, bukan aplikasi pengaturan utama.

Prioritas desain:

- Full-screen control interface.
- Large touch targets.
- Grid buttons.
- Page navigation.
- Connection status.
- Action feedback.

### 5.1 Connection Screen

Menampilkan:

- ConDeck branding.
- Host address input jika diperlukan.
- QR pairing instructions.
- Connect button.
- Connection error.

### 5.2 Remote Deck Screen

Menampilkan:

- Connection indicator.
- Current deck name.
- Current page.
- Button grid.
- Page navigation.

Tombol harus memiliki ukuran yang nyaman untuk disentuh.

Hindari tombol terlalu kecil atau jarak antartombol terlalu rapat.

### 5.3 Button Feedback

Setiap tombol harus memberikan feedback ketika disentuh:

- Press animation.
- Loading state ketika action berjalan.
- Success feedback.
- Error feedback.

Feedback tidak boleh hanya mengandalkan perubahan warna. Gunakan status visual yang jelas.

## 6. Responsive Design

Desktop:

- Optimalkan untuk resolusi laptop dan monitor.
- Layout dapat menyesuaikan ukuran jendela.
- Properties panel tidak boleh menutupi grid secara tidak sengaja.

Mobile:

- Optimalkan untuk smartphone portrait dan landscape.
- Grid menyesuaikan lebar layar.
- Tombol mempertahankan proporsi yang nyaman.
- Navigasi halaman tetap mudah dijangkau.
- Hindari horizontal scrolling yang tidak diperlukan.

## 7. Component System

Gunakan komponen reusable:

- Button.
- IconButton.
- Sidebar.
- Header.
- StatusIndicator.
- Card.
- Dialog.
- Dropdown.
- Input.
- Select.
- Toggle.
- Tabs.
- Tooltip.
- Toast.
- ButtonGrid.
- DeckCard.
- PageSelector.
- ConnectionStatus.

Komponen harus konsisten antara halaman yang menggunakan pola interaksi serupa.

## 8. Interaction Design

Gunakan interaksi yang konsisten:

- Hover untuk informasi tambahan pada Desktop.
- Click untuk memilih atau menjalankan aksi.
- Drag and drop untuk mengatur posisi tombol jika diimplementasikan.
- Modal untuk konfirmasi tindakan penting.
- Toast untuk feedback singkat.
- Loading state untuk proses asynchronous.
- Empty state untuk data yang belum tersedia.

Aksi seperti delete deck atau revoke device harus memiliki konfirmasi.

## 9. Accessibility

- Kontras teks harus memadai.
- Tombol memiliki label yang jelas.
- Jangan hanya menggunakan warna untuk menunjukkan status.
- Gunakan keyboard navigation pada Desktop.
- Berikan focus indicator.
- Gunakan ukuran touch target yang memadai pada Mobile.

## 10. Animation

Gunakan Framer Motion secara selektif.

Animasi yang diperbolehkan:

- Page transition.
- Modal transition.
- Button press.
- Sidebar transition.
- Toast appearance.
- Loading indicator.

Animasi harus ringan dan tidak menghambat respons aplikasi.

## 11. Design Consistency

Semua halaman harus mengikuti:

- Spacing system yang konsisten.
- Typography scale yang konsisten.
- Border radius yang konsisten.
- Warna dan status yang konsisten.
- Reusable component.
- Konsistensi icon.

Jangan membuat komponen dengan gaya visual berbeda tanpa alasan.

## 12. UI/UX Acceptance Criteria

Desain dianggap memenuhi spesifikasi apabila:

- Desktop memiliki navigasi yang jelas.
- Deck Editor mudah digunakan.
- Tombol dapat dikustomisasi.
- Mobile nyaman digunakan sebagai remote.
- Informasi koneksi terlihat jelas.
- Action memberikan feedback.
- Tampilan responsif.
- Tidak ada elemen visual yang mengganggu fungsi utama.

**Catatan:** Dokumen ini menjadi acuan desain dan implementasi UI/UX. Desain visual boleh berkembang selama tidak mengubah fungsi dan alur utama yang ditetapkan dalam PRD.