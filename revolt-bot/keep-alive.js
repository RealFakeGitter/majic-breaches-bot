const https = require('https');
const http = require('http');

class KeepAlive {
  constructor(url, interval = 10 * 60 * 1000) { // 10 minutes default
    this.url = url;
    this.interval = interval;
    this.timer = null;
  }

  start() {
    console.log(`Starting keep-alive pings to ${this.url} every ${this.interval / 1000} seconds`);
    
    this.timer = setInterval(() => {
      this.ping();
    }, this.interval);

    // Initial ping
    setTimeout(() => this.ping(), 5000); // Wait 5 seconds before first ping
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('Keep-alive pings stopped');
    }
  }

  ping() {
    const protocol = this.url.startsWith('https:') ? https : http;
    
    const req = protocol.get(this.url, (res) => {
      console.log(`Keep-alive ping: ${res.statusCode} - ${new Date().toISOString()}`);
    });

    req.on('error', (error) => {
      console.error('Keep-alive ping failed:', error.message);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      console.error('Keep-alive ping timeout');
    });
  }
}

module.exports = KeepAlive;
