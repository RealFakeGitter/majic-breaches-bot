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
  botUserId = client.user?._id;
  console.log(`🤖 Bot User ID stored: ${botUserId}`);
  console.log('Client ready! Listening for messages...');
});

client.on('messageCreate', async (message) => {
  try {
    const actualAuthorId = message.author_id || message.author?.id;
    
    console.log(`📨 Message: "${message.content}" from ${actualAuthorId}`);
    console.log(`🤖 Bot ID: ${botUserId}, Author ID: ${actualAuthorId}`);
    
    // CRITICAL: Skip messages from the bot itself
    if (botUserId && actualAuthorId === botUserId) {
      console.log('🤖 SKIPPING: Message from bot itself');
      return;
    }
    
    // Skip if no author ID
    if (!actualAuthorId) {
      console.log('⚠️ SKIPPING: No author ID');
      return;
    }

    const content = message.content?.trim();
    if (!content) {
      console.log('❌ SKIPPING: Empty content');
      return;
    }
    
    if (!content.startsWith('!breach')) {
      console.log(`❌ SKIPPING: Not a breach command: "${content}"`);
      return;
    }

    console.log(`✅ PROCESSING: ${content} from ${actualAuthorId}`);

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

        const searchingMsg = await message.reply({
          content: "🔍 Searching breaches...",
        });

        try {
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

          if (result.fileUrl && result.fileName) {
            await searchingMsg.edit({
              content: result.content + "\n\n📎 **File download:** " + result.fileUrl,
            });
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

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

async function loginBot() {
  try {
    console.log('🚀 Starting Revolt bot login...');
    
    if (!process.env.REVOLT_BOT_TOKEN) {
      throw new Error('REVOLT_BOT_TOKEN environment variable is not set');
    }
    
    await client.loginBot(process.env.REVOLT_BOT_TOKEN);
    console.log('✅ Login successful!');
  } catch (error) {
    console.error('❌ Failed to login to Revolt:', error);
    process.exit(1);
  }
}

setTimeout(() => {
  loginBot();
}, 1000);
