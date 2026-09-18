# LUTLOAD Telegram Open/Close Setup

## 1. Deploy
Push the project to a PRIVATE GitHub repository and deploy it to Vercel.

## 2. Configure
`config.js` already contains the Telegram/GitHub values supplied for this build.

## 3. Register webhook
After Vercel deployment, open:

`https://YOUR-DOMAIN.vercel.app/api/setup-telegram?key=HAPSA1011&url=https://YOUR-DOMAIN.vercel.app`

A successful response should contain:

- `status: true`
- `webhookUrl: https://YOUR-DOMAIN.vercel.app/api/telegram`
- Telegram `ok: true`

## 4. Check status
Open:

`https://YOUR-DOMAIN.vercel.app/api/status`

When the Gist is reachable, the response includes `source: "github-gist"`.

## 5. Telegram commands

`/status`
`/open`
`/close`

Only the Telegram IDs in `adminIds` may use these commands.

## Important
The credentials in `config.js` are real secrets. Keep the repository PRIVATE and rotate the Telegram bot token and GitHub token if they have been posted publicly.
