const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

// --- Configuration ---
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const LEAKOSINT_API_KEY = process.env.LEAKOSINT_API_KEY;

// --- Initialize Client ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- Helper function to create a paginated embed ---
function createPaginatedEmbed(data, query) {
    if (!data.List || data.List['No results found']) {
        return { embeds: [new EmbedBuilder().setTitle('No Results').setDescription(`No results found for "\${query}".`).setColor('#FF0000')] };
    }

    const embed = new EmbedBuilder()
        .setTitle(`Majic Breaches Search Results`)
        .setDescription(`Results for: \`${query}\`\nShowing first 10 entries. Click the button below to see all results.`)
        .setColor('#00bfff');

    let count = 0;
    for (const dbName in data.List) {
        if (dbName === 'No results found') continue;
        if (count >= 10) break;

        const breach = data.List[dbName];
        let fieldValue = `**Info:** ${breach.InfoLeak.split('\n')[0]}\n`;

        if (breach.Data && breach.Data.length > 0) {
            breach.Data.slice(0, 3).forEach(entry => {
                for (const key in entry) {
                    fieldValue += `\n**${key}:** \`${entry[key].substring(0, 100)}${entry[key].length > 100 ? '...' : ''}\``;
                }
                fieldValue += '\n---';
            });
        }
        
        embed.addFields({ name: `🔓 ${dbName}`, value: fieldValue.substring(0, 1024), inline: false });
        count++;
    }
    
    const fullResultsUrl = `https://leakosint.com/search?search=${encodeURIComponent(query)}`;
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('View Full Results on Leakosint')
                .setStyle(ButtonStyle.Link)
                .setURL(fullResultsUrl)
        );

    return { embeds: [embed], components: [row] };
}


// --- Event Listeners ---
client.once('ready', () => {
    console.log(`Logged in as \${client.user.tag}!`);
    console.log('Bot is ready to receive search commands.');
});

client.on('messageCreate', async message => {
    if (message.author.bot && message.author.id !== client.user.id) return;
    if (!message.content.startsWith('!search')) return;

    const query = message.content.substring(7).trim();
    if (!query) {
        return message.reply('Please provide a search term. Example: `!search email@example.com`');
    }

    console.log(`Received search command for query: "${query}"`);

    try {
        // --- THE FINAL, CORRECT FIX ---
        // Call the Leakosint API directly, but use the exact headers your browser uses.
        const apiUrl = `https://leakosint.com/api?query=${encodeURIComponent(query)}&key=${LEAKOSINT_API_KEY}`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Origin': 'https://majicbreaches.iceiy.com',
                'Referer': 'https://majicbreaches.iceiy.com/',
                'Sec-Ch-Ua': '"Chromium";v="143", "Not A(Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Linux"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'cross-site',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
            }
        });
        // --- END OF FIX ---

        const data = response.data;
        
        // --- DEBUGGING LOGS ---
        console.log('--- RAW API RESPONSE ---');
        console.log(JSON.stringify(data, null, 2));
        console.log('--- END RAW RESPONSE ---');
        // --- END DEBUGGING LOGS ---

        await message.channel.send(createPaginatedEmbed(data, query));

    } catch (error) {
        console.error('!!! SEARCH ERROR !!!');
        console.error('Error Details:', error);

        let errorMessage = 'An unknown error occurred while searching.';
        if (error.response) {
            console.error('API Response Status:', error.response.status);
            console.error('API Response Data:', error.response.data);
            errorMessage = `API Error: ${error.response.status} - \${error.response.data.error || 'Unknown API Error'}`;
        } else if (error.request) {
            console.error('No response received from API. The server might be down.');
