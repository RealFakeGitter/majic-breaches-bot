// Simple HTTP server to keep the bot alive on hosting platforms
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Revolt Bot is alive!\n');
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🌐 Keep-alive server running on port ${port}`);
});

module.exports = server;
