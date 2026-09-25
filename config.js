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
    analyticsFileName: env('GITHUB_GIST_ANALYTICS_FILE', 'analytics.json'),
    visitorFileName: env('GITHUB_GIST_VISITOR_FILE', 'visitor-logs.json'),
    errorFileName: env('GITHUB_GIST_ERROR_FILE', 'error-logs.json')
  },

  site: {
    name: 'LUTLOAD',
    defaultOpen: true
  },

  security: {
    rateLimitMax: Number(env('RATE_LIMIT_MAX', '30')) || 30,
    rateLimitWindowMs: Number(env('RATE_LIMIT_WINDOW_MS', '60000')) || 60000
  },

  analytics: {
    retentionDays: Number(env('ANALYTICS_RETENTION_DAYS', '90')) || 90,
    visitorRetentionDays: Number(env('VISITOR_RETENTION_DAYS', '7')) || 7
  }
};
