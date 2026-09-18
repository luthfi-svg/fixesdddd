# LUTLOAD - Deployment & GitHub Gist Control

## 1. Mengapa muncul `Bad credentials`?

Error `GitHub Gist error: Bad credentials` berarti GitHub menolak token yang digunakan server. Versi proyek ini tidak lagi menyimpan credential di `config.js`.

**Jika token lama pernah dibagikan atau masuk ke ZIP/repository, revoke token tersebut dan buat token baru. Jangan kirim token baru ke orang lain.**

## 2. Environment Variables Vercel

Tambahkan di Vercel → Project → Settings → Environment Variables:

```text
GITHUB_TOKEN=token_github_baru
GITHUB_GIST_ID=id_gist
GITHUB_GIST_STATE_FILE=site-state.json

TELEGRAM_BOT_TOKEN=token_bot_baru
TELEGRAM_ADMIN_IDS=123456789
TELEGRAM_WEBHOOK_SECRET=buat_secret_acak
TELEGRAM_SETUP_KEY=buat_key_acak
```

Untuk beberapa admin Telegram:

```text
TELEGRAM_ADMIN_IDS=123456789,987654321
```

Pilih environment yang digunakan deployment, lalu redeploy.

## 3. GitHub Gist

Gist harus memiliki file dengan nama persis:

```text
site-state.json
```

Contoh isi:

```json
{
  "open": true,
  "message": "Website aktif.",
  "updatedAt": "2026-09-18T00:00:00.000Z",
  "source": "manual"
}
```

## 4. Token GitHub

Token harus dapat mengakses Gist yang dipakai. Jika menggunakan classic Personal Access Token, scope `gist` diperlukan untuk membaca/menulis Gist.

Jika menggunakan token yang tidak mendukung akses Gist atau token sudah expired/revoked, API akan mengembalikan error 401/403.

## 5. Tes sebelum Telegram

Setelah deploy, buka:

```text
https://DOMAIN-KAMU/api/status
```

Jika normal, hasilnya kira-kira:

```json
{
  "status": true,
  "open": true,
  "message": "Website aktif.",
  "source": "github-gist"
}
```

Jika credential salah, endpoint sekarang mengembalikan HTTP 503 dan pesan yang lebih jelas, bukan berpura-pura bahwa website OPEN.

## 6. Setup webhook Telegram

Setelah environment variable terpasang, panggil endpoint setup menggunakan `TELEGRAM_SETUP_KEY`:

```text
https://DOMAIN-KAMU/api/setup-telegram?key=SETUP_KEY&url=https://DOMAIN-KAMU
```

Endpoint ini memasang webhook Telegram ke:

```text
https://DOMAIN-KAMU/api/telegram
```

## 7. Perintah Telegram

Admin yang ID-nya ada di `TELEGRAM_ADMIN_IDS` dapat memakai:

```text
/open
/close
/status
/help
```

## 8. Setelah mengubah Environment Variables

Vercel perlu deployment baru agar Function membaca nilai environment yang baru. Gunakan **Redeploy** pada deployment terbaru.

## 9. Jangan commit secret

File `.env`, token, setup key, dan webhook secret tidak boleh masuk Git. Gunakan `.env.example` sebagai template saja.
