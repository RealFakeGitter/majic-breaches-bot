// puppeteer.config.js
const { executablePath } = require('@sparticuz/chromium');

module.exports = {
  cacheDirectory: './.puppeteer_cache',  // Writable local dir (persists in Render's fs)
  executablePath: executablePath(),
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
  ]
};
