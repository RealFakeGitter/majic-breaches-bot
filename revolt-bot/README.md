# Majic Breaches Revolt Bot

A standalone Revolt bot that connects to the Majic Breaches Convex backend for breach searching.

## Setup

1. Create a Revolt bot at https://developers.revolt.chat/
2. Copy the bot token
3. Copy `.env.example` to `.env` and fill in your values:
   ```
   REVOLT_BOT_TOKEN=your_revolt_bot_token_here
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

- `!breach search <query>` - Search for breaches
- `!breach stats` - Show bot statistics
- `!breach help` - Show help information

## Invite Link

Use the bot invite link from the Revolt developer portal to add the bot to servers.
