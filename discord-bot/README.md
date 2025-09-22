# Majic Breaches Discord Bot

A standalone Discord bot that connects to the Majic Breaches Convex backend for breach searching.

## Free Hosting on Railway

### Step 1: Prepare Your Bot
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select your existing one
3. Go to "Bot" section and copy your bot token
4. Go to "General Information" and copy your Application ID (Client ID)

### Step 2: Deploy to Railway
1. Sign up at [Railway.app](https://railway.app) (free account)
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select this repository
4. Railway will automatically detect the `discord-bot` folder

### Step 3: Set Environment Variables
In Railway dashboard, go to your project → Variables tab and add:
```
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
CONVEX_URL=https://insightful-mongoose-187.convex.cloud
LEAKOSINT_API_TOKEN=your_leakosint_api_token_here
```

### Step 4: Deploy
Railway will automatically deploy your bot. Check the logs to ensure it's running.

## Alternative Free Hosting Options

### Render.com
1. Sign up at [Render.com](https://render.com)
2. Create new "Web Service" from GitHub
3. Set build command: `npm install`
4. Set start command: `node index.js`
5. Add environment variables

### Replit
1. Go to [Replit.com](https://replit.com)
2. Import from GitHub
3. Add environment variables in "Secrets" tab
4. Click "Run"

## Bot Invite Link

Generate an invite link with these permissions:
- Send Messages (2048)
- Use Slash Commands (2147483648)
- Embed Links (16384)

Permission integer: `2147485696`
Scopes: `bot applications.commands`

Example invite URL:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147485696&scope=bot%20applications.commands
```

## Commands

- `/search <query> [limit]` - Search for breaches
- `/stats` - Show bot statistics  
- `/help` - Show help information

## Troubleshooting

### Bot not responding to commands:
1. Check that bot is online in Discord
2. Verify environment variables are set correctly
3. Check Railway/hosting logs for errors
4. Ensure bot has proper permissions in Discord server

### Commands not showing up:
1. Wait up to 1 hour for global commands to sync
2. Try kicking and re-inviting the bot
3. Check bot permissions in server settings

### Search not working:
1. Verify `LEAKOSINT_API_TOKEN` is set
2. Check Convex deployment is accessible
3. Review hosting platform logs
