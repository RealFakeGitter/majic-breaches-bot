const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

// --- Configuration ---
// The bot will now PREFER the URL from the environment variable,
// but will fall back to the hardcoded one if it's not set.
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_URL = process.env.API_URL || 'https://majicbreaches.iceiy.com'; // Fallback URL
const API_ENDPOINT = `${API_URL}/search.php`;

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
        return { embeds: [new EmbedBuilder().setTitle('No Results').setDescription(`No results found for "${query}".`).setColor('#FF0000')] };
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
            // Display first 3 data points as an example
            breach.Data.slice(0, 3).forEach(entry => {
                for (const key in entry) {
                    fieldValue += `\n**${key}:** \`${entry[key].substring(0, 100)}${entry[key].length > 100 ? '...' : ''}\``;
                }
                fieldValue += '\n---';
            });
        }
        
        embed.addFields({ name: `🔓 ${dbName}`, value: fieldValue.substring(0, 1020), inline: false });
        count++;
    }
    
    const fullResultsUrl = `${API_URL}?search=${encodeURIComponent(query)}`;
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('View Full Results')
                .setStyle(ButtonStyle.Link)
                .setURL(fullResultsUrl)
        );

    return { embeds: [embed], components: [row] };
}


// --- Event Listeners ---
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Making requests to API at: ${API_ENDPOINT}`); // This will log the correct URL
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!search')) return;

    const query = message.content.substring(7).trim();
    if (!query) {
        return message.reply('Please provide a search term. Example: `!search email@example.com`');
    }

    try {
        // This is a temporary message to let the user know we're working
        const loadingMessage = await message.reply({ content: 'Searching... please wait.' });

        // Make the request to your own API endpoint
        const response = await axios.post(API_ENDPOINT, { query: query }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const data = response.data;

        // Delete the "Searching..." message
        await loadingMessage.delete();

        // Send the formatted results
        await message.channel.send(createPaginatedEmbed(data, query));

    } catch (error) {
        console.error('Search Error:', error.response ? error.response.data : error.message);
        const errorMessage = error.response && error.response.data && error.response.data.error 
            ? `API Error: ${error.response.data.error}` 
            : 'An unknown error occurred while searching.';
        message.reply(errorMessage);
    }
});

// --- Login ---
client.login(BOT_TOKEN);
