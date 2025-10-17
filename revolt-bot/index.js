import { Client } from 'revolt.js';
import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import WebSocket from 'ws';

// Polyfill WebSocket for Node.js environment
global.WebSocket = WebSocket;

dotenv.config();

console.log('🔧 Environment check:');
console.log('- Node version:', process.version);
console.log('- REVOLT_BOT_TOKEN exists:', !!process.env.REVOLT_BOT_TOKEN);
console.log('- CONVEX_URL exists:', !!process.env.CONVEX_URL);

const client = new Client();
const convex = new ConvexHttpClient(process.env.CONVEX_URL);

let botUserId = null;

client.on('ready', async () => {
  console.log(`✅ Revolt bot logged in as ${client.user?.username || client.user?.display_name || 'Unknown'}!`);
  
  // Debug: Log all available properties
  console.log('🔍 Debug - client.user object:', JSON.stringify(client.user, null, 2));
  console.log('🔍 Debug - client properties:', Object.keys(client));
  
  // Store bot user ID for self-message detection - try multiple properties
  botUserId = client.user?._id || client.user?.id || client.user?.user_id;
  
  // If still undefined, try getting it from the client itself
  if (!botUserId && client.userId) {
    botUserId = client.userId;
  }
  
  // Try other possible properties
  if (!botUserId && client.user) {
    // Try all properties on the user object
    const userProps = Object.keys(client.user);
    console.log('🔍 Available user properties:', userProps);
    
    // Look for any property that might be the ID
    for (const prop of userProps) {
      if (prop.toLowerCase().includes('id')) {
        console.log(`🔍 Found ID-like property: ${prop} = ${client.user[prop]}`);
        if (!botUserId) {
          botUserId = client.user[prop];
        }
      }
    }
  }
  
  console.log(`🤖 Bot ID stored: ${botUserId}`);
  console.log('✅ Client ready! Listening for messages...');
});

// Main message handler
client.on('messageCreate', async (message) => {
  try {
    // Get author ID
    const authorId = message.author_id || message.author?.id;
    
    // Debug: Log message details
    console.log(`🔍 Debug - Message author_id: ${message.author_id}`);
    console.log(`🔍 Debug - Message author?.id: ${message.author?.id}`);
    console.log(`🔍 Debug - Bot ID: ${botUserId}`);
    console.log(`🔍 Debug - Author ID: ${authorId}`);
    
    // CRITICAL: Ignore messages from the bot itself
    if (botUserId && authorId === botUserId) {
      console.log('🤖 Ignoring own message');
      return; // Silent ignore - no logging to prevent spam
    }
    
    // Ignore messages without author ID
    if (!authorId) {
      return;
    }

    const content = message.content?.trim();
    if (!content) {
      return;
    }
    
    // CRITICAL: Don't respond to error messages to prevent loops
    if (content.startsWith('❌') || content.includes('Unknown command') || content.includes('Error:')) {
      return;
    }
    
    console.log(`📨 Processing message: "${content}" from ${authorId}`);
    
    // Only process !breach commands
    if (!content.startsWith('!breach')) {
      return;
    }

    const parts = content.split(' ');
    const command = parts[1]?.toLowerCase();

    try {
      if (command === 'search') {
        const query = parts.slice(2).join(' ');
        
        if (!query) {
          await message.reply({
            content: "❌ Please provide a search query!\nUsage: `!breach search <query>`",
          });
          return;
        }

        // Send initial "searching" message
        const searchingMsg = await message.reply({
          content: "🔍 Searching breaches...",
        });

        try {
          // Call the Convex action
          const result = await convex.action('revolt_bot.handleRevoltCommandNew', {
            content: content,
            authorId: authorId,
            channelId: message.channel_id || message.channel?.id || "unknown",
            serverId: message.channel?.server_id || undefined,
          });

          if (!result) {
            await searchingMsg.edit({
              content: "❌ No response from search service",
            });
            return;
          }

          // Handle file results
          if (result.fileUrl && result.fileName) {
            try {
              await searchingMsg.edit({
                content: result.content + "\n\n📎 **File download:** " + result.fileUrl,
              });
            } catch (fileError) {
              console.error('File handling error:', fileError);
              await searchingMsg.edit({
                content: result.content,
              });
            }
          } else {
            await searchingMsg.edit({
              content: result.content,
            });
          }

        } catch (error) {
          console.error('Search error:', error);
          await searchingMsg.edit({
            content: `❌ Search failed: ${error.message || "Unknown error"}`,
          });
        }
      }
      else if (command === 'help' || command === 'stats' || command === 'test') {
        const result = await convex.action('revolt_bot.handleRevoltCommandNew', {
          content: content,
          authorId: authorId,
          channelId: message.channel_id || message.channel?.id || "unknown",
          serverId: message.channel?.server_id || undefined,
        });

        await message.reply({
          content: result.content,
        });
      }
      else {
        await message.reply({
          content: "❌ Unknown command. Use `!breach help` for available commands.",
        });
      }

    } catch (error) {
      console.error('Error handling message:', error);
      try {
        await message.reply({
          content: "❌ An error occurred while processing your request.",
        });
      } catch (replyError) {
        console.error('Error sending error reply:', replyError);
      }
    }
  } catch (outerError) {
    console.error('Outer error in message handler:', outerError);
  }
});

// Connection events
client.on('connecting', () => {
  console.log('🔄 Connecting to Revolt...');
});

client.on('connected', () => {
  console.log('🔗 Connected to Revolt!');
});

client.on('dropped', () => {
  console.log('⚠️ Connection to Revolt dropped');
});

// Error handlers
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Login function
async function loginBot() {
  try {
    console.log('🚀 Starting Revolt bot login...');
    
    if (!process.env.REVOLT_BOT_TOKEN) {
      throw new Error('REVOLT_BOT_TOKEN environment variable is not set');
    }
    
    console.log('Token length:', process.env.REVOLT_BOT_TOKEN.length);
    
    const result = await client.loginBot(process.env.REVOLT_BOT_TOKEN);
    console.log('✅ Login successful!');
  } catch (error) {
    console.error('❌ Failed to login to Revolt:', error);
    if (error.response) {
      console.error('HTTP Response:', error.response.status, error.response.statusText);
    }
    process.exit(1);
  }
}

// Start the bot
setTimeout(() => {
  loginBot();
}, 1000);
