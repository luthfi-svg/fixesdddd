# LUTLOAD — Neo Brutalist Downloader

LUTLOAD adalah single-page downloader bergaya neo-brutalism untuk TikTok dan Instagram dengan kontrol OPEN/CLOSE melalui Telegram dan GitHub Gist.

## Yang sudah diperbaiki

- Credential GitHub dan Telegram **tidak lagi disimpan di `config.js`**.
- Kontrol GitHub Gist memakai environment variables.
- Error GitHub 401/403/404 sekarang diterjemahkan menjadi pesan yang jelas.
- `/api/status` tidak lagi mengembalikan status sukses ketika Gist gagal dibaca.
- Frontend tidak lagi **fail-open** ketika status backend gagal diverifikasi.
- Cache status dinonaktifkan agar perubahan OPEN/CLOSE cepat terbaca.
- Validasi `site-state.json` diperketat.
- `.env.example` tersedia sebagai template.
- `.gitignore` mencegah file `.env` ikut ter-commit.

## Struktur

```text
lutload-neobrutalist/
├─ api/
│  ├─ _lib/
│  │  ├─ control.js
│  │  └─ http.js
│  ├─ instagram.js
│  ├─ setup-telegram.js
│  ├─ status.js
│  ├─ telegram.js
│  └─ tiktok.js
├─ app.js
├─ config.js
├─ data-site-state.example.json
├─ favicon.svg
├─ index.html
├─ package.json
├─ vercel.json
├─ .env.example
├─ .gitignore
├─ README.md
└─ README-DEPLOY.md
```

## 1. Penting: revoke credential lama

ZIP/project versi lama berisi credential secara langsung. Jika credential tersebut pernah dibagikan, **revoke token GitHub dan token Telegram lama** lalu buat credential baru.

Jangan memasukkan credential baru ke source code.

## 2. Environment Variables Vercel

Di Vercel buka **Project → Settings → Environment Variables**, lalu tambahkan:

```text
GITHUB_TOKEN=token_github_baru
GITHUB_GIST_ID=id_gist
GITHUB_GIST_STATE_FILE=site-state.json

TELEGRAM_BOT_TOKEN=token_bot_baru
TELEGRAM_ADMIN_IDS=123456789
TELEGRAM_WEBHOOK_SECRET=secret_acak
TELEGRAM_SETUP_KEY=key_acak
```

Jika ada beberapa admin:

```text
TELEGRAM_ADMIN_IDS=123456789,987654321
```

Setelah mengubah environment variables, lakukan **Redeploy**.

## 3. GitHub Gist

Buat satu Gist dengan file persis:

```text
site-state.json
```

Isi awal:

```json
{
  "open": true,
  "message": "Website aktif.",
  "updatedAt": "2026-09-18T00:00:00.000Z",
  "source": "manual"
}
```

`GITHUB_GIST_ID` hanya berisi ID Gist, bukan URL penuh.

Token GitHub harus mempunyai akses untuk membaca dan mengubah Gist tersebut.

## 4. Tes kontrol sebelum Telegram

Setelah deploy, buka:

```text
https://DOMAIN-KAMU.vercel.app/api/status
```

Jika normal:

```json
{
  "status": true,
  "open": true,
  "message": "Website aktif.",
  "source": "github-gist"
}
```

Jika token salah, endpoint akan mengembalikan HTTP `503` dengan `CONTROL_READ_FAILED` dan pesan penyebabnya.

## 5. Setup Telegram

Setelah environment variables terpasang dan deployment baru aktif, buka:

```text
https://DOMAIN-KAMU.vercel.app/api/setup-telegram?key=SETUP_KEY&url=https://DOMAIN-KAMU.vercel.app
```

Ganti `DOMAIN-KAMU.vercel.app` dan `SETUP_KEY` sesuai deployment/environment milikmu.

Endpoint tersebut mengatur webhook Telegram ke:

```text
/api/telegram
```

## 6. Command Telegram

Admin yang ID-nya terdapat di `TELEGRAM_ADMIN_IDS` dapat menggunakan:

```text
/open
/close
/status
/start
/help
```

`/open` membuat website terbuka.

`/close` menutup website dan endpoint downloader akan menolak request baru dengan HTTP 503.

`/status` membaca status terbaru dari GitHub Gist.

## 7. Endpoint

### TikTok

```http
POST /api/tiktok
Content-Type: application/json

{"url":"https://www.tiktok.com/..."}
```

### Instagram

```http
POST /api/instagram
Content-Type: application/json

{"url":"https://www.instagram.com/reel/..."}
```

### Status

```http
GET /api/status
```

### Telegram

```http
POST /api/telegram
```

## 8. Local check

```bash
npm install
npm run check
```

Untuk menjalankan menggunakan Vercel CLI:

```bash
npx vercel dev
```

Jika menjalankan lokal, environment variables harus tersedia di environment lokal.
