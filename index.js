require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// INIZIALIZZAZIONE MICRO SERVER PER ACCOGLIERE RENDER
const app = express();
app.get('/', (req, res) => res.send('Bot Attivo 24/7 🚀'));

// CONFIGURAZIONE BOT DISCORD V14
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.on('ready', () => {
    console.log("-> BOT ONLINE E OPERATIVO AL 100%! 🟢");
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const t = message.content.toLowerCase().trim();
    
    if (t === 'gioca' || t === '!gioca' || message.mentions.users.has(client.user.id)) {
        message.reply(`Sto entrando... (Modalità Cloud Standalone)`);
    }
});

// AVVIO CORRETTO CON LETTURA DELLA CASSAFORTE DI RENDER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server web di controllo attivo sulla porta ${PORT}`);
    
    if (process.env.DISCORD_TOKEN) {
        console.log("Avvio del bot in corso con la cassaforte di Render...");
        client.login(process.env.DISCORD_TOKEN).catch((err) => {
            console.log("❌ Errore login:", err.message);
        });
    } else {
        console.log("❌ ERRORE: La variabile DISCORD_TOKEN nella scheda Environment è vuota!");
    }
});
