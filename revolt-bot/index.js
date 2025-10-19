// Auto-generate package.json if it doesn't exist
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  const packageJson = {
    "name": "majic-breaches-revolt-bot",
    "version": "1.0.0",
    "description": "Revolt bot for Majic Breaches search",
    "main": "index.js",
    "scripts": {
      "start": "node index.js",
      "dev": "node index.js",
      "build": "echo 'No build step required'"
    },
    "dependencies": {
      "revolt.js": "^7.2.0",
      "convex": "^1.28.0",
      "dotenv": "^16.6.1",
      "node-fetch": "^3.3.2"
    },
    "engines": {
      "node": ">=18.0.0"
    }
  };
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('Generated package.json');
}

require('dotenv').config();
const { Client } = require('revolt.js');

// Import fetch for Node.js compatibility
let fetch;
try {
  // Try to use native fetch (Node 18+)
  fetch = globalThis.fetch;
  if (!fetch) {
    throw new Error('No native fetch');
  }
  console.log('✅ Using native fetch');
} catch (error) {
  // Fallback to node-fetch for older Node versions
  try {
    fetch = require('node-fetch');
    console.log('✅ Using node-fetch');
  } catch (fetchError) {
    console.error('❌ No fetch implementation available. Please install node-fetch or use Node 18+');
    process.exit(1);
  }
}

// Import keep-alive functionality
try {
  require('./keep-alive');
} catch (error) {
  console.log('Keep-alive not found, continuing without it...');
}

// Validate environment variables
const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  console.error('❌ No CONVEX_URL found! Please set CONVEX_URL environment variable.');
  process.exit(1);
}

console.log(`🔗 Connecting to Convex: ${convexUrl}`);

const client = new Client({
  unreads: true,
  autoReconnect: true,
});

client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user?.username || 'Unknown'}!`);
  console.log(`🤖 Bot ID: ${client.user?._id || 'Unknown'}`);
  console.log(`🔗 Connected to ${client.servers?.size || 0} servers`);
  
  // List all servers and channels for debugging
  if (client.servers) {
    console.log('📋 Server details:');
    for (const [serverId, server] of client.servers) {
      console.log(`  Server: ${server.name} (ID: ${serverId})`);
      if (server.channels) {
        for (const [channelId, channel] of server.channels) {
          console.log(`    Channel: ${channel.name} (ID: ${channelId})`);
        }
      }
    }
  }
  
  console.log('🎯 Ready to receive commands!');
});

// Try both message events
client.on('message', async (message) => {
  console.log('📨 "message" event triggered');
  await handleMessage(message);
});

client.on('messageCreate', async (message) => {
  console.log('📨 "messageCreate" event triggered');
  await handleMessage(message);
});

async function handleMessage(message) {
  // Enhanced logging for debugging
  console.log(`📨 Message received:`);
  console.log(`  Content: "${message.content || 'No content'}"`);
  console.log(`  Author: ${message.author?.username || 'Unknown'}`);
  console.log(`  Channel: ${message.channel?._id || 'Unknown'}`);
  console.log(`  Is Bot: ${message.author?.bot || false}`);
  
  // Ignore messages from bots
  if (message.author?.bot) {
    console.log('🤖 Ignoring bot message');
    return;
  }
  
  // Temporary: respond to any message for testing
  if (message.content === 'test') {
    console.log('🧪 Test message detected, sending response...');
    try {
      await message.reply('✅ Bot is receiving messages!');
      console.log('✅ Test response sent');
    } catch (error) {
      console.error('❌ Failed to send test response:', error);
    }
    return;
  }
  
  // Only respond to messages that start with !breach
  if (!message.content?.startsWith('!breach')) {
    console.log('❌ Message does not start with !breach');
    return;
  }
  
  console.log('✅ Processing !breach command');
  
  const args = message.content.slice(7).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  
  try {
    if (command === 'ping') {
      console.log('🏓 Sending ping response...');
      await message.reply('🏓 Pong! Bot is working!');
      console.log('✅ Ping response sent successfully');
      return;
    } else if (command === 'search') {
      if (args.length === 0) {
        await message.reply('❌ Please provide a search query. Usage: `!breach search <query>`');
        return;
      }
      
      const query = args.join(' ');
      console.log(`Revolt search: ${query}`);
      
      // Use the correct HTTP endpoint with fetch
      const searchUrl = `${convexUrl}/api/search`;
      console.log(`Making request to: ${searchUrl}`);
      
      const requestBody = {
        query,
        limit: 10,
        platform: 'revolt'
      };
      console.log('🔍 Request body:', JSON.stringify(requestBody, null, 2));
      
      try {
        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        console.log('🔍 Response status:', searchResponse.status);
        console.log('🔍 Response ok:', searchResponse.ok);

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error('Search API error:', errorText);
          await message.reply(`❌ Search failed: ${errorText}`);
          return;
        }

        const searchData = await searchResponse.json();
        
        // Debug logging to see what we're getting
        console.log('🔍 Search API Response:', JSON.stringify(searchData, null, 2));
        console.log('🔍 searchData.success:', searchData.success);
        console.log('🔍 searchData.results:', searchData.results);
        console.log('🔍 searchData.results.length:', searchData.results?.length);
        
        if (!searchData.success || !searchData.results || searchData.results.length === 0) {
          console.log('❌ No results condition triggered');
          await message.reply(`🔍 No results found for: **${query}**\n\nDebug info:\n- Success: ${searchData.success}\n- Results: ${searchData.results ? searchData.results.length : 'null'}\n- Error: ${searchData.error || 'none'}`);
          return;
        }
        
        const preview = searchData.results.slice(0, 2);
        let response = `🔍 **Breach Search Results**\n\nFound **${searchData.resultCount}** results for: **${query}**\n\n`;
        
        preview.forEach((breach, index) => {
          // Truncate breach name if it's too long
          const truncatedBreachName = breach.breachName.length > 200 
            ? breach.breachName.substring(0, 200) + '...' 
            : breach.breachName;
          
          response += `**${index + 1}. ${truncatedBreachName}**\n`;
          if (breach.breachDate) {
            response += `📅 Date: ${breach.breachDate}\n`;
          }
          response += `🎯 Matched Field: ${breach.matchedField}\n`;
          response += `📋 Data Types: ${breach.dataTypes.join(', ')}\n`;
          
          // Show the actual breach content (email, password, etc.) with better formatting
          if (breach.content) {
            response += `\n**🔍 Breach Data:**\n`;
            const contentLines = breach.content.split('\n').filter(line => line.trim());
            // Limit to first 8 lines for Revolt (more generous than Discord)
            const limitedLines = contentLines.slice(0, 8);
            limitedLines.forEach(line => {
              response += `\`${line}\`\n`;
            });
            if (contentLines.length > 8) {
              response += `*... and ${contentLines.length - 8} more lines*\n`;
            }
          }
          
          if (breach.recordCount) {
            response += `📊 Records: ${breach.recordCount.toLocaleString()}\n`;
          }
          response += '\n';
        });
        
        if (searchData.resultCount > 2) {
          response += `*... and ${searchData.resultCount - 2} more results*\n\n`;
        }
        
        // Use the correct web app URL - prioritize WEB_APP_URL, then fallback to a default
        const webAppUrl = process.env.WEB_APP_URL || 'https://majic-breaches-bot.vercel.app';
        response += `🔗 **[View Full Results](${webAppUrl}/search-results?id=${searchData.searchId})**\n\n`;
        response += `⚠️ *Use responsibly for security research purposes only*`;
        
        await message.reply(response);
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        await message.reply('❌ Failed to connect to search service');
      }
      
    } else if (command === 'stats') {
      try {
        const statsUrl = `${convexUrl}/api/stats`;
        const statsResponse = await fetch(statsUrl);
        
        if (!statsResponse.ok) {
          await message.reply('❌ Failed to get statistics');
          return;
        }
        
        const stats = await statsResponse.json();
        
        const response = `📊 **Bot Statistics**\n\n🔍 Total Searches: **${stats.totalSearches.toLocaleString()}**\n📋 Total Results: **${stats.totalResults.toLocaleString()}**`;
        
        await message.reply(response);
      } catch (fetchError) {
        console.error('Stats fetch error:', fetchError);
        await message.reply('❌ Failed to get statistics');
      }
      
    } else if (command === 'help') {
      const response = `🤖 **Majic Breaches Bot Help**\n\nSearch data breaches for security research and OSINT purposes.\n\n**Commands:**\n\`!breach ping\` - Test bot connection\n\`!breach search <query>\` - Search breaches\n\`!breach stats\` - Show statistics\n\`!breach help\` - Show this help\n\n⚠️ **Important:** This bot is for educational and security research purposes only. Use responsibly and in accordance with applicable laws.`;
      
      await message.reply(response);
    } else {
      await message.reply('❌ Unknown command. Use `!breach help` for available commands.');
    }
  } catch (error) {
    console.error('Command error:', error);
    try {
      await message.reply('❌ An error occurred while processing your request.');
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
}

// Enhanced error handling and logging
client.on('error', (error) => {
  console.error('Revolt client error:', error);
});

client.on('disconnect', () => {
  console.log('Disconnected from Revolt');
});

// Add more debugging events
client.on('packet', (packet) => {
  if (packet.type === 'Message') {
    console.log('📦 Raw message packet received:', JSON.stringify(packet, null, 2));
  }
});

client.on('messageCreate', (message) => {
  console.log('🆕 messageCreate event fired:', message.content);
});

client.on('messageUpdate', (message) => {
  console.log('📝 messageUpdate event fired:', message.content);
});

// Log all events for debugging
const originalEmit = client.emit;
client.emit = function(event, ...args) {
  if (event !== 'packet') { // Don't log packet events to avoid spam
    console.log(`🎪 Event fired: ${event}`);
  }
  return originalEmit.call(this, event, ...args);
};

// Login with better error handling
const token = process.env.REVOLT_BOT_TOKEN || process.env.REVOLT_TOKEN;
if (!token || token === 'YOUR_ACTUAL_TOKEN_HERE') {
  console.error('❌ No valid bot token found! Please set REVOLT_BOT_TOKEN environment variable.');
  console.error('Current token value:', token ? 'Set but may be placeholder' : 'Not set');
  process.exit(1);
}

console.log('🔄 Attempting to login to Revolt...');
console.log('Token length:', token.length);
console.log('Token starts with:', token.substring(0, 10) + '...');

client.loginBot(token).then(() => {
  console.log('✅ Login successful!');
}).catch(error => {
  console.error('❌ Failed to login to Revolt:', error);
  console.error('Error details:', error.message);
  process.exit(1);
});

/*
PACKAGE.JSON CONTENT FOR REVOLT BOT:
{
  "name": "majic-breaches-revolt-bot",
  "version": "1.0.0",
  "description": "Revolt bot for Majic Breaches search",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "revolt.js": "^7.2.0",
    "convex": "^1.28.0",
    "dotenv": "^16.6.1",
    "node-fetch": "^3.3.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
*/
