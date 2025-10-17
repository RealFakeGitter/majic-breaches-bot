const { Client } = require('revolt.js');
const http = require('http');

// Health check server
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      bot: client?.user?.username || 'Not connected'
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

const client = new Client();

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL;

if (!CONVEX_SITE_URL) {
  console.error('CONVEX_SITE_URL environment variable is required');
  process.exit(1);
}

client.on('ready', async () => {
  console.log(`Revolt bot logged in as ${client.user.username}!`);
});

client.on('message', async (message) => {
  // Ignore messages from bots
  if (message.author?.bot) return;
  
  const content = message.content?.trim();
  if (!content || !content.startsWith('!breach')) return;
  
  const args = content.split(' ').slice(1);
  const command = args[0]?.toLowerCase();
  
  try {
    if (command === 'search') {
      if (args.length < 2) {
        await message.reply('Usage: `!breach search <query>`');
        return;
      }
      
      const query = args.slice(1).join(' ');
      
      // Call Convex API
      const response = await fetch(`${CONVEX_SITE_URL}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit: 10, platform: 'revolt' }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        let replyText = `🔍 **Search Results for "${query}"**\nFound ${data.results.length} result(s)\n\n`;
        
        // Add results (limit to first 5 for message length)
        const displayResults = data.results.slice(0, 5);
        displayResults.forEach((result, index) => {
          replyText += `**${index + 1}. ${result.breachName}**\n`;
          replyText += `Date: ${result.breachDate || 'Unknown'}\n`;
          replyText += `Field: ${result.matchedField}\n`;
          replyText += `Data: ${result.dataTypes.join(', ')}\n\n`;
        });
        
        if (data.results.length > 5) {
          replyText += `*Showing first 5 of ${data.results.length} results*`;
        }
        
        await message.reply(replyText);
      } else {
        await message.reply(`🔍 No breaches found for "${query}"`);
      }
    } else if (command === 'stats') {
      const response = await fetch(`${CONVEX_SITE_URL}/api/stats`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const stats = await response.json();
      
      const replyText = `📊 **Bot Statistics**\n\n` +
        `Total Searches: ${stats.totalSearches.toLocaleString()}\n` +
        `Total Results: ${stats.totalResults.toLocaleString()}`;
      
      await message.reply(replyText);
    } else if (command === 'help') {
      const helpText = `🤖 **Majic Breaches Bot Help**\n\n` +
        `**Commands:**\n` +
        `\`!breach search <query>\` - Search for breaches\n` +
        `\`!breach stats\` - Show bot statistics\n` +
        `\`!breach help\` - Show this help message\n\n` +
        `*Use responsibly for educational and security research purposes only*`;
      
      await message.reply(helpText);
    }
  } catch (error) {
    console.error('Error handling command:', error);
    await message.reply('An error occurred while processing your request. Please try again later.');
  }
});

client.on('error', error => {
  console.error('Revolt client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.loginBot(process.env.REVOLT_BOT_TOKEN);
