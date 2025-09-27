# Majic Breaches - Separate Bot Applications Setup

Your website remains completely untouched! These are separate applications that connect to your existing Convex backend.

## Discord Bot Setup

1. **Create Discord Application:**
   - Go to https://discord.com/developers/applications
   - Click "New Application"
   - Name it "Majic Breaches Bot"
   - Go to "Bot" section and create a bot
   - Copy the bot token

2. **Setup Discord Bot:**
   ```bash
   cd discord-bot
   cp .env.example .env
   # Edit .env with your tokens
   npm install
   npm start
   ```

3. **Invite Bot to Server:**
   - Go to OAuth2 > URL Generator
   - Select scopes: `bot` and `applications.commands`
   - Select permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
   - Use the generated URL to invite the bot

## Revolt Bot Setup

1. **Create Revolt Bot:**
   - Go to https://developers.revolt.chat/
   - Create a new bot
   - Copy the bot token

2. **Setup Revolt Bot:**
   ```bash
   cd revolt-bot
   cp .env.example .env
   # Edit .env with your tokens
   npm install
   npm start
   ```

3. **Invite Bot to Server:**
   - Use the invite link from the Revolt developer portal

## Android App Setup

1. **Prerequisites:**
   - Install Android Studio
   - Install React Native CLI: `npm install -g @react-native-community/cli`

2. **Setup App:**
   ```bash
   cd android-app
   cp .env.example .env
   # Edit .env with your Convex URL
   npm install
   npm run android
   ```

3. **Build APK:**
   ```bash
   npm run build
   # APK will be in android/app/build/outputs/apk/release/
   ```

## Environment Variables Needed

For your Convex deployment, you'll need these environment variables:
- `DISCORD_CLIENT_ID` - From Discord Developer Portal
- `DISCORD_BOT_TOKEN` - From Discord Developer Portal  
- `REVOLT_BOT_ID` - From Revolt Developer Portal
- `REVOLT_BOT_TOKEN` - From Revolt Developer Portal
- `LEAKOSINT_API_TOKEN` - Your existing API token

## Features

### Discord Bot
- `/search <query> [limit]` - Search breaches
- `/stats` - Show statistics
- `/help` - Show help
- Rich embeds with formatted results
- Ephemeral responses for privacy

### Revolt Bot  
- `!breach search <query>` - Search breaches
- `!breach stats` - Show statistics
- `!breach help` - Show help
- Formatted text responses
- Edit messages for better UX

### Android App
- Native Android interface
- Search functionality
- Results history
- Material Design
- Offline viewing of previous searches
- APK generation for distribution

All applications connect to your existing Convex backend and use the same search functionality as your website!
