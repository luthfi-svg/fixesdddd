/**
 * LUTLOAD CONFIG
 *
 * Semua credential dibaca dari environment variable.
 * JANGAN menaruh token GitHub/Telegram di file ini.
 */

function env(name, fallback = '') {
  const value = process.env[name];
  return value === undefined ? fallback : String(value).trim();
}

function csv(name) {
  return env(name)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  telegram: {
    botToken: env('TELEGRAM_BOT_TOKEN'),
    adminIds: csv('TELEGRAM_ADMIN_IDS'),
    webhookSecret: env('TELEGRAM_WEBHOOK_SECRET'),
    setupKey: env('TELEGRAM_SETUP_KEY')
  },

  control: {
    provider: 'github-gist',
    gistId: env('GITHUB_GIST_ID'),
    githubToken: env('GITHUB_TOKEN'),
    stateFileName: env('GITHUB_GIST_STATE_FILE', 'site-state.json'),
    visitorLogFileName: env('GITHUB_GIST_VISITOR_LOG_FILE', 'visitor-logs.json')
  },

  site: {
    name: 'LUTLOAD',
    defaultOpen: true
  }
};
