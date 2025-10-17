import { Client } from 'revolt.js';
import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import WebSocket from 'ws';

// Polyfill WebSocket for Node.js environment
global.WebSocket = WebSocket;

dotenv.config();

// Add some debugging
console.log('🔧 Environment check:');
console.log('- Node version:', process.version);
console.log('- REVOLT_BOT_TOKEN exists:', !!process.env.REVOLT_BOT_TOKEN);
console.log('- CONVEX_URL exists:', !!process.env.CONVEX_URL);
console.log('- CONVEX_URL value:', process.env.CONVEX_URL);

const client = new Client();
const convex = new ConvexHttpClient(process.env.CONVEX_URL);

let botUserId = null; // Store bot's user ID

client.on('ready', async () => {
  console.log(`✅ Revolt bot logged in as ${client.user?.username || client.user?.display_name || 'Unknown'}!`);
  console.log(`Bot ID: ${client.user?._id}`);
  
  // Store the bot's user ID for message filtering
  botUserId = client.user?._id;
  
  console.log('Full user object:', JSON.stringify(client.user, null, 2));
  console.log('Client ready! Listening for messages...');
});

// Use messageCreate event (the correct one for Revolt.js)
client.on('messageCreate', async (message) => {
  console.log('📨 MESSAGE_CREATE EVENT FIRED - MAIN HANDLER!');
  try {
    console.log(`📨 Message received: "${message.content}" from ${message.author_id || message.author?.id}`);
    console.log('Channel ID:', message.channel_id);
    console.log('Bot user ID:', botUserId);
    
    // Get the actual author ID (could be author_id or author.id)
    const actualAuthorId = message.author_id || message.author?.id;
    
    // CRITICAL: Skip messages from the bot itself
    if (botUserId && actualAuthorId === botUserId) {
      console.log('🤖 Ignoring message from bot itself');
      return;
    }
    
    // Additional check: if no author ID found, it might be a system message
    if (!actualAuthorId) {
      console.log('⚠️ Message has no author ID, skipping');
      return;
    }

    const content = message.content?.trim();
    if (!content) {
      console.log('❌ Empty message content');
      return;
    }
    
    if (!content.startsWith('!breach')) {
      console.log(`❌ Message doesn't start with !breach: "${content}"`);
      
      // Test: respond to simple test messages (but not from bot)
      if (content.toLowerCase().includes('test') || content.toLowerCase().includes('hello')) {
        console.log('🧪 Test message detected, sending simple reply...');
        try {
          await message.reply({
            content: "🤖 I can see your message! Bot is working.",
          });
          console.log('✅ Simple reply sent successfully');
        } catch (replyError) {
          console.error('❌ Failed to send simple reply:', replyError);
        }
      }
      return;
    }

    console.log(`✅ Processing command: ${content} from ${actualAuthorId}`);

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
          // Call the Convex action for Revolt commands
          const result = await convex.action('revolt_bot:handleRevoltCommandNew', {
            content: content,
            authorId: actualAuthorId,
            channelId: message.channel_id || message.channel?.id || "unknown",
            serverId: message.channel?.server_id || undefined,
          });

          if (!result) {
            await searchingMsg.edit({
              content: "❌ No response from search service",
            });
            return;
          }

          // If there's a file URL, download and upload it to Revolt
          if (result.fileUrl && result.fileName) {
            try {
              // Download the file from Convex storage
              const fileResponse = await fetch(result.fileUrl);
              const fileBuffer = await fileResponse.buffer();

              // Upload file to Revolt (this is a simplified approach)
              // Note: Revolt file uploads require specific handling
              await searchingMsg.edit({
                content: result.content + "\n\n📎 **File download:** " + result.fileUrl,
              });
            } catch (fileError) {
              console.error('File upload error:', fileError);
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

      else if (command === 'help') {
        const result = await convex.action('revolt_bot:handleRevoltCommandNew', {
          content: content,
          authorId: actualAuthorId,
          channelId: message.channel_id || message.channel?.id || "unknown",
          serverId: message.channel?.server_id || undefined,
        });

        await message.reply({
          content: result.content,
        });
      }

      else if (command === 'stats') {
        const result = await convex.action('revolt_bot:handleRevoltCommandNew', {
          content: content,
          authorId: actualAuthorId,
          channelId: message.channel_id || message.channel?.id || "unknown",
          serverId: message.channel?.server_id || undefined,
        });

        await message.reply({
          content: result.content,
        });
      }

      else if (command === 'test') {
        const result = await convex.action('revolt_bot:handleRevoltCommandNew', {
          content: content,
          authorId: actualAuthorId,
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

// Add error handling and connection events
client.on('connecting', () => {
  console.log('🔄 Connecting to Revolt...');
});

client.on('connected', () => {
  console.log('🔗 Connected to Revolt!');
});

client.on('dropped', () => {
  console.log('⚠️ Connection to Revolt dropped');
});

// Add process error handlers
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Login with better error handling
async function loginBot() {
  try {
    console.log('🚀 Starting Revolt bot login...');
    
    if (!process.env.REVOLT_BOT_TOKEN) {
      throw new Error('REVOLT_BOT_TOKEN environment variable is not set');
    }
    
    console.log('Token length:', process.env.REVOLT_BOT_TOKEN.length);
    console.log('Token starts with:', process.env.REVOLT_BOT_TOKEN.substring(0, 10) + '...');
    
    const result = await client.loginBot(process.env.REVOLT_BOT_TOKEN);
    console.log('✅ Login result:', result);
    console.log('✅ Login successful!');
  } catch (error) {
    console.error('❌ Failed to login to Revolt:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error.constructor.name);
    if (error.response) {
      console.error('HTTP Response:', error.response.status, error.response.statusText);
    }
    process.exit(1);
  }
}

// Add a small delay before login to ensure everything is set up
setTimeout(() => {
  loginBot();
}, 1000);
