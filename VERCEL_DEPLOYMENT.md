# Vercel Deployment Guide

## Quick Setup

1. **Fork/Clone this repository** to your GitHub account

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your forked repository

3. **Configure Environment Variables:**
   In your Vercel project settings, add these environment variables:

   **Required:**
   ```
   VITE_CONVEX_URL=https://your-deployment.convex.site
   LEAKOSINT_API_TOKEN=your_leakosint_api_token
   ```

   **Optional (for bots):**
   ```
   DISCORD_BOT_TOKEN=your_discord_bot_token
   DISCORD_CLIENT_ID=your_discord_client_id
   REVOLT_BOT_TOKEN=your_revolt_bot_token
   REVOLT_BOT_ID=your_revolt_bot_id
   WEB_APP_URL=https://your-app.vercel.app
   ```

4. **Deploy:**
   - Vercel will automatically build and deploy
   - Your app will be available at `https://your-app.vercel.app`

## Getting API Keys

### LeakOSINT API Token (Required)
1. Visit [LeakOSINT API](https://leakosintapi.com/)
2. Sign up for an account
3. Get your API token from the dashboard
4. Add it as `LEAKOSINT_API_TOKEN` in Vercel

### Convex Setup
1. Install Convex CLI: `npm install -g convex`
2. Run `npx convex dev` in your project
3. Follow the setup instructions
4. Copy the deployment URL to `VITE_CONVEX_URL`

## Build Configuration

The project includes:
- `vercel.json` - Vercel configuration
- `vite.config.ts` - Vite build configuration
- Proper TypeScript setup

## Troubleshooting

### Build Fails
- Ensure all required environment variables are set
- Check that `VITE_CONVEX_URL` is correct
- Verify TypeScript compilation passes

### Runtime Errors
- Check browser console for errors
- Verify API keys are working
- Ensure Convex deployment is active

## Features Included

- ✅ Web interface for breach search
- ✅ Real-time results display
- ✅ Responsive design
- ✅ Bot statistics
- ✅ API endpoints for Discord/Revolt bots
- ✅ File export (JSON, TXT, HTML)

## Bot Deployment

For Discord and Revolt bots, see:
- `discord-bot/README.md`
- `revolt-bot/README.md`

Both bots can be deployed to Render, Railway, or other Node.js hosting platforms.
