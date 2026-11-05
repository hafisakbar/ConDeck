# ConDeck — API & WebSocket Contract

**Version:** 1.0  
**Document Type:** Communication Protocol Specification  
**Architecture:** Desktop Host — Mobile Client

## 1. Overview

Dokumen ini menjelaskan protokol komunikasi antara ConDeck Desktop dan ConDeck Mobile.

Desktop bertindak sebagai server dan pusat eksekusi. Mobile bertindak sebagai client yang menampilkan deck dan mengirimkan event kontrol.

Komunikasi real-time menggunakan WebSocket.

Default port: `43821`  
Default WebSocket path: `/ws`

## 2. Communication Architecture

Alur komunikasi:

1. Mobile menemukan alamat host Desktop.
2. Mobile melakukan pairing.
3. Desktop memvalidasi permintaan pairing.
4. Desktop menerbitkan kredensial perangkat.
5. Mobile menggunakan kredensial tersebut untuk autentikasi berikutnya.
6. Setelah autentikasi berhasil, Desktop mengirimkan deck snapshot.
7. Mobile mengirimkan event ketika tombol ditekan.
8. Desktop memproses action dan mengirimkan hasilnya.

Mobile tidak boleh mengakses database secara langsung.

## 3. Transport

Gunakan:

- HTTP untuk informasi koneksi dan proses pairing.
- WebSocket untuk komunikasi real-time.
- JSON sebagai format pesan.
- Zod untuk validasi payload.

Untuk jaringan yang tidak sepenuhnya dipercaya, gunakan transport terenkripsi. Jangan mengirim token permanen melalui koneksi yang tidak aman.

## 4. Message Format

Format dasar:

```json
{
  "type": "event.name",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "payload": {}
}
```

Penjelasan:

| Field | Description |
|---|---|
| type | Nama event |
| requestId | Identitas request |
| timestamp | Waktu pengiriman |
| payload | Data event |

Semua pesan harus divalidasi sebelum diproses.

## 5. Pairing Protocol

### 5.1 Pairing Flow

1. Desktop membuka halaman Device Management.
2. Desktop membuat pairing token sementara.
3. Token ditampilkan dalam QR Code bersama alamat host.
4. Mobile melakukan scan QR Code.
5. Mobile mengirim permintaan pairing.
6. Desktop memvalidasi token dan masa berlakunya.
7. Jika diperlukan, Desktop meminta persetujuan pengguna.
8. Desktop menerbitkan device credential.
9. Mobile menyimpan kredensial dengan aman.
10. Mobile dapat melakukan autentikasi pada koneksi berikutnya.

Pairing token harus memiliki masa berlaku pendek, hanya dapat digunakan sesuai batas yang ditentukan, dan tidak boleh menjadi kredensial permanen.

### 5.2 Pairing Request

```json
{
  "type": "auth.pair",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "payload": {
    "pairingToken": "temporary-token",
    "deviceName": "My Smartphone",
    "deviceType": "mobile"
  }
}
```

### 5.3 Pairing Response

```json
{
  "type": "auth.pair.result",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:01.000Z",
  "payload": {
    "success": true,
    "deviceId": "device-uuid",
    "deviceCredential": "issued-credential"
  }
}
```

Kredensial hanya diberikan melalui proses autentikasi yang aman dan tidak boleh ditulis ke log.

## 6. Authentication

Setiap koneksi baru harus melalui autentikasi perangkat.

Contoh:

```json
{
  "type": "auth.resume",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "payload": {
    "deviceId": "device-uuid",
    "deviceCredential": "stored-credential"
  }
}
```

Server memvalidasi kredensial dan status perangkat.

Jika berhasil, server mengirim:

```json
{
  "type": "auth.result",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:01.000Z",
  "payload": {
    "success": true,
    "deviceId": "device-uuid"
  }
}
```

Jika gagal, koneksi ditolak.

## 7. Deck Synchronization

### 7.1 Request Deck

```json
{
  "type": "deck.get",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "payload": {}
}
```

### 7.2 Deck Snapshot

```json
{
  "type": "deck.snapshot",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:01.000Z",
  "payload": {
    "deckId": "deck-uuid",
    "name": "Main Deck",
    "pages": [
      {
        "id": "page-uuid",
        "name": "Main",
        "position": 0,
        "buttons": []
      }
    ]
  }
}
```

Snapshot hanya berisi informasi yang dibutuhkan Mobile untuk menampilkan kontrol. Jangan mengirimkan rahasia integrasi atau konfigurasi internal yang tidak diperlukan.

### 7.3 Deck Updated

Desktop mengirim event `deck.updated` ketika konfigurasi deck berubah.

Mobile kemudian memperbarui tampilan berdasarkan data terbaru.

## 8. Button Execution

### 8.1 Button Press

```json
{
  "type": "button.press",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "payload": {
    "buttonId": "button-uuid"
  }
}
```

Desktop harus:

1. Memvalidasi sesi perangkat.
2. Memastikan tombol tersedia.
3. Memastikan tombol aktif.
4. Membaca konfigurasi action dari database lokal.
5. Memvalidasi konfigurasi action.
6. Menjalankan action melalui Action Registry.
7. Mengirim hasil eksekusi.

Jangan mempercayai konfigurasi action yang dikirim oleh Mobile.

### 8.2 Action Started

```json
{
  "type": "action.started",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.100Z",
  "payload": {
    "buttonId": "button-uuid"
  }
}
```

### 8.3 Action Completed

```json
{
  "type": "action.completed",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.500Z",
  "payload": {
    "buttonId": "button-uuid",
    "success": true
  }
}
```

### 8.4 Action Failed

```json
{
  "type": "action.failed",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.500Z",
  "payload": {
    "buttonId": "button-uuid",
    "success": false,
    "errorCode": "OBS_DISCONNECTED",
    "message": "OBS is not connected."
  }
}
```

## 9. Page Navigation

Gunakan event `page.change` untuk berpindah halaman.

Contoh:

```json
{
  "type": "page.change",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "payload": {
    "pageId": "page-uuid"
  }
}
```

Desktop memvalidasi apakah page ID tersedia di deck aktif.

## 10. OBS Status

Desktop mengirim status OBS kepada Mobile.

Contoh:

```json
{
  "type": "obs.status",
  "requestId": "uuid",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "payload": {
    "connected": true,
    "streaming": false,
    "recording": false
  }
}
```

Mobile hanya menampilkan status tersebut dan tidak mengelola koneksi OBS secara langsung.

## 11. Heartbeat

Gunakan:

- `ping`
- `pong`

Heartbeat digunakan untuk mendeteksi koneksi yang terputus atau tidak responsif.

Atur interval dan timeout secara konsisten, serta hindari menganggap perangkat aktif hanya berdasarkan koneksi socket yang belum ditutup.

## 12. Error Codes

| Error Code | Description |
|---|---|
| UNAUTHORIZED | Perangkat tidak memiliki izin |
| INVALID_TOKEN | Token tidak valid |
| TOKEN_EXPIRED | Token pairing kedaluwarsa |
| DEVICE_REVOKED | Akses perangkat dicabut |
| INVALID_REQUEST | Format request tidak valid |
| BUTTON_NOT_FOUND | Tombol tidak ditemukan |
| ACTION_FAILED | Action gagal dijalankan |
| OBS_DISCONNECTED | OBS tidak terhubung |
| SERVER_ERROR | Kesalahan internal |
| RATE_LIMITED | Permintaan terlalu sering |

## 13. Security Requirements

- Autentikasi pada setiap koneksi baru.
- Pairing token memiliki expiry.
- Device credential dapat dicabut.
- Validasi setiap payload.
- Batasi ukuran pesan.
- Terapkan rate limiting.
- Jangan menerima arbitrary shell commands.
- Jangan mempercayai ID tombol tanpa memvalidasi kepemilikannya.
- Jangan mengirimkan secret yang tidak diperlukan ke Mobile.
- Jangan menyimpan credential permanen dalam log.
- Tutup koneksi perangkat yang tidak sah.

## 14. Acceptance Criteria

Protokol dianggap siap apabila:

- Mobile dapat melakukan pairing.
- Mobile dapat autentikasi ulang.
- Desktop dapat mengirim deck snapshot.
- Perubahan deck dapat disinkronkan.
- Tombol Mobile dapat memicu action Desktop.
- Status action dapat diterima Mobile.
- Status OBS dapat disinkronkan.
- Koneksi dapat dipulihkan setelah terputus.
- Perangkat yang dicabut aksesnya tidak dapat terhubung kembali.

**Catatan:** Contoh JSON merupakan kontrak awal. Implementasi harus menggunakan schema validasi yang konsisten di Desktop dan Mobile.