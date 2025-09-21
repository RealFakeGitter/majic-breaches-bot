# Majic Breaches Discord Bot

A standalone Discord bot that connects to the Majic Breaches Convex backend for breach searching.

## Setup

1. Create a Discord application and bot at https://discord.com/developers/applications
2. Copy the bot token
3. Copy `.env.example` to `.env` and fill in your values:
   ```
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   CONVEX_URL=your_convex_deployment_url_here
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the bot:
   ```bash
   npm start
   ```

## Commands

- `/search <query> [limit]` - Search for breaches
- `/stats` - Show bot statistics  
- `/help` - Show help information

## Invite Link

Generate an invite link with these permissions:
- Send Messages
- Use Slash Commands
- Embed Links

Permission integer: `2048`
Scopes: `bot applications.commands`
