const https = require('https');
const http = require('http');

class KeepAlive {
  constructor(url, interval = 14 * 60 * 1000) { // 14 minutes for Render free tier
    this.url = url;
    this.interval = interval;
    this.timer = null;
    this.server = null;
  }

  start() {
    console.log(`Starting keep-alive pings to ${this.url} every ${this.interval / 1000} seconds`);
    
    // Start health check server for Render
    this.startHealthServer();
    
    this.timer = setInterval(() => {
      this.ping();
    }, this.interval);

    // Initial ping after 30 seconds
    setTimeout(() => this.ping(), 30000);
  }

  startHealthServer() {
    const port = process.env.PORT || 3000;
    
    this.server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(port, () => {
      console.log(`Health check server running on port ${port}`);
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('Keep-alive pings stopped');
    }
    
    if (this.server) {
      this.server.close(() => {
        console.log('Health check server stopped');
      });
    }
  }

  ping() {
    if (!this.url) {
      console.log('No URL configured for keep-alive pings');
      return;
    }

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

// Auto-start if URL is provided
const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL;
if (keepAliveUrl) {
  const keepAlive = new KeepAlive(keepAliveUrl);
  keepAlive.start();
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    keepAlive.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    keepAlive.stop();
    process.exit(0);
  });
}

module.exports = KeepAlive;
