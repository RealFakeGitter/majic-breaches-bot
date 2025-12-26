const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

// --- Configuration ---
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
// --- POINT TO THE NEW SIMPLE API ---
const API_URL = process.env.API_URL || 'https://majicbreaches.iceiy.com';
const API_ENDPOINT = `${API_URL}/simple-api.php`; // Changed to simple-api.php

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
    console.log(`Making requests to API at: ${API_ENDPOINT}`);
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
        const response = await axios.post(API_ENDPOINT, { query: query });
        const data = response.data;
        console.log('Successfully received data from API.');
        await message.channel.send(createPaginatedEmbed(data, query));

    } catch (error) {
        console.error('!!! SEARCH ERROR !!!');
        console.error('Error Details:', error);

        let errorMessage = 'An unknown error occurred while searching.';
        if (error.response) {
            console.error('API Response Status:', error.response.status);
            console.error('API Response Data:', error.response.data);
            errorMessage = `API Error: ${error.response.status} - ${error.response.data.error || 'Unknown API Error'}`;
        } else if (error.request) {
            console.error('No response received from API. The server might be down.');
            errorMessage = 'Could not connect to the search API. The server may be down.';
        } else {
            console.error('Error Message:', error.message);
            errorMessage = `Request setup error: ${error.message}`;
        }
        
        try {
            await message.reply(errorMessage);
        } catch(replyError) {
            console.error('Failed to send error message to Discord:', replyError);
        }
    }
});

// --- Login ---
client.login(BOT_TOKEN);
